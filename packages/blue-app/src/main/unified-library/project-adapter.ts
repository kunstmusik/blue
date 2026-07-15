import { randomUUID } from 'node:crypto';
import type { BlueData, Instrument, SoundObject } from '@blue/data';
import {
  Effect,
  Element,
  Instance,
  OpcodeDefinition,
  PolyObject,
  UDOStyle,
  copyEffectForProject,
  copyInstrumentForProject,
  copySoundObjectForProject,
  copyUdoForProject,
  createSharedSoundObjectInstance,
  loadInstrumentFromXML,
  loadSoundObjectFromXML,
} from '@blue/data';
import { applyProjectDocumentPatch } from '../../shared/project-editor';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import type { RepositoryNode } from './repository';
import type {
  InsertionTargetSnapshot,
  LibraryInsertionMode,
  LibraryItemKey,
  LibraryItemPreview,
  LibrarySearchResult,
  LibraryType,
  ProjectMutationReceipt,
} from '../../shared/unified-library';

export interface ActiveLibraryProject {
  readonly data: BlueData;
  readonly sessionId: number;
  readonly revision?: number;
  readonly commit?: () => number;
}

export type ActiveLibraryProjectProvider = () => ActiveLibraryProject | null;

export interface ProjectInsertionInput {
  readonly key: LibraryItemKey;
  readonly payloadXml?: string;
  readonly target: InsertionTargetSnapshot;
  readonly mode: LibraryInsertionMode;
}

export interface ProjectLibraryEditorSource {
  readonly key: LibraryItemKey;
  readonly displayName: string;
  readonly objectType: string;
  readonly breadcrumb: readonly string[];
  readonly revision: string;
  readonly payloadXml: string;
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function supportStatus(objectType: string): 'supported' | 'unsupported' {
  return objectType.length > 0 ? 'supported' : 'unsupported';
}

function udoStyle(opcode: OpcodeDefinition): 'CLASSIC' | 'MODERN' {
  return opcode.getStyle() === UDOStyle.MODERN ? 'MODERN' : 'CLASSIC';
}

function unavailable(reason: string) {
  return { state: 'unavailable' as const, reason };
}

export class UnifiedLibraryProjectAdapter {
  private readonly deleteConfirmations = new Map<string, { key: string; revision: number; expiresAt: number }>();

  constructor(private readonly getActiveProject: ActiveLibraryProjectProvider) {}

  getProjectSessionId(): number | null {
    return this.getActiveProject()?.sessionId ?? null;
  }

  list(libraryType: LibraryType): LibrarySearchResult[] {
    const project = this.getActiveProject();
    if (!project || libraryType === 'effect') return [];

    if (libraryType === 'instrument') {
      return project.data.getArrangement().getArrangement().map((assignment) => {
        const objectType = assignment.instr?.constructor.name ?? '';
        return {
          key: {
            scope: 'projectOwned',
            libraryType: 'instrument',
            projectSessionId: project.sessionId,
            locator: { kind: 'instrument', assignmentId: assignment.arrangementId },
          },
          libraryType: 'instrument',
          scope: 'projectOwned',
          displayName: assignment.instr?.getName() || `Instrument ${assignment.arrangementId}`,
          breadcrumb: ['Project Orchestra'],
          supportStatus: supportStatus(objectType),
          objectType: objectType || 'Unknown Instrument',
          revision: hashText(assignment.instr?.saveAsXML().toXml() ?? assignment.arrangementId),
        };
      });
    }

    if (libraryType === 'udo') {
      return project.data.getOpcodeList().getOpcodes().map((opcode, index) => {
        const canonicalHash = hashText(opcode.saveAsXML().toXml());
        const style = udoStyle(opcode);
        return {
          key: {
            scope: 'projectOwned',
            libraryType: 'udo',
            projectSessionId: project.sessionId,
            locator: {
              kind: 'udo',
              sessionObjectId: `udo:${index}`,
              persistedFingerprint: {
                canonicalHash,
                opcodeName: opcode.getName(),
                style,
              },
            },
          },
          libraryType: 'udo',
          scope: 'projectOwned',
          displayName: opcode.getName(),
          breadcrumb: ['Project UDOs'],
          supportStatus: 'supported',
          objectType: 'blue.udo.UserDefinedOpcode',
          revision: canonicalHash,
        };
      });
    }

    const library = project.data.getSoundObjectLibrary();
    return library.getEntries().map(({ libraryId, object }) => {
      const fingerprint = library.createFingerprint(object);
      return {
        key: {
          scope: 'projectShared',
          libraryType: 'soundObject',
          projectSessionId: project.sessionId,
          locator: { kind: 'soundObject', libraryId, persistedFingerprint: fingerprint },
        },
        libraryType: 'soundObject',
        scope: 'projectShared',
        displayName: object.getName(),
        breadcrumb: ['Project Shared SoundObjects'],
        supportStatus: 'supported',
        objectType: fingerprint.objectType,
        revision: fingerprint.canonicalHash,
      };
    });
  }

  search(query: string, typeFilter: LibraryType | 'all'): LibrarySearchResult[] {
    const normalized = query.normalize('NFKC').toLocaleLowerCase().trim();
    if (!normalized) return [];
    const types: readonly LibraryType[] = typeFilter === 'all'
      ? ['instrument', 'udo', 'soundObject']
      : [typeFilter];
    return types
      .flatMap((type) => this.list(type))
      .filter((item) => item.displayName.normalize('NFKC').toLocaleLowerCase().includes(normalized))
      .sort((left, right) => left.libraryType.localeCompare(right.libraryType)
        || left.displayName.localeCompare(right.displayName)
        || JSON.stringify(left.key).localeCompare(JSON.stringify(right.key)));
  }

  preview(key: LibraryItemKey): LibraryItemPreview | null {
    if (key.scope === 'user') return null;
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) return null;
    const entry = this.list(key.libraryType).find((candidate) => (
      JSON.stringify(candidate.key) === JSON.stringify(key)
    ));
    if (!entry) return null;

    if (key.locator.kind === 'instrument') {
      const assignmentId = key.locator.assignmentId;
      const assignment = project.data.getArrangement().getArrangement()
        .find((candidate) => candidate.arrangementId === assignmentId);
      if (!assignment?.instr) return null;
      const comment = assignment.instr.getComment();
      return this.createPreview(entry, {
        assignmentId: { state: 'available', value: assignment.arrangementId },
        comment: comment ? { state: 'available', value: comment } : unavailable('Not provided'),
      });
    }
    if (key.locator.kind === 'udo') {
      const fingerprint = key.locator.persistedFingerprint;
      const opcode = project.data.getOpcodeList().getOpcodes().find((candidate) => {
        return candidate.getName() === fingerprint.opcodeName
          && hashText(candidate.saveAsXML().toXml()) === fingerprint.canonicalHash;
      });
      if (!opcode) return null;
      return this.createPreview(entry, {
        style: { state: 'available', value: udoStyle(opcode) },
        inputs: { state: 'available', value: opcode.getInTypes() || opcode.getInputArguments() },
        outputs: { state: 'available', value: opcode.getOutTypes() },
        comments: opcode.getComments()
          ? { state: 'available', value: opcode.getComments() }
          : unavailable('Not provided'),
      });
    }
    const object = project.data.getSoundObjectLibrary().getObjectById(key.locator.libraryId)
      ?? project.data.getSoundObjectLibrary().findUniqueByFingerprint(key.locator.persistedFingerprint);
    if (!object) return null;
    return this.createPreview(entry, {
      objectType: { state: 'available', value: object.constructor.name },
      duration: { state: 'available', value: object.getSubjectiveDuration().getValue() },
    });
  }

  getEditorSource(key: LibraryItemKey): ProjectLibraryEditorSource | null {
    if (key.scope === 'user') return null;
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) return null;
    const entry = this.list(key.libraryType).find((candidate) => (
      JSON.stringify(candidate.key) === JSON.stringify(key)
    ));
    if (!entry) return null;
    const source = this.resolveInsertionSource(project, {
      key,
      target: {
        libraryType: key.libraryType,
        projectSessionId: project.sessionId,
        label: 'Editor',
        valid: true,
        targetRevision: String(project.revision ?? 0),
      },
      mode: 'independent',
    });
    return {
      key,
      displayName: source.displayName,
      objectType: source.value.constructor.name,
      breadcrumb: entry.breadcrumb,
      revision: String(entry.revision),
      payloadXml: source.value.saveAsXML().toXml(),
    };
  }

  saveEditorSource(
    key: LibraryItemKey,
    expectedRevision: string,
    payloadXml: string,
  ): ProjectLibraryEditorSource | null {
    if (key.scope === 'user') throw new Error('Project editor requires a project key');
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) return null;
    const current = this.getEditorSource(key);
    if (!current) return null;
    if (current.revision !== expectedRevision) throw new Error('Project editor conflict');
    const element = Element.parse(payloadXml);
    let changed = false;
    if (key.locator.kind === 'instrument') {
      const value = loadInstrumentFromXML(element);
      if (!value) throw new Error('Unsupported Instrument payload');
      changed = project.data.getArrangement().replaceInstrument(key.locator.assignmentId, value);
    } else if (key.locator.kind === 'udo') {
      const locator = key.locator;
      const opcodes = project.data.getOpcodeList().getOpcodes();
      const index = opcodes.findIndex((candidate) => (
        candidate.getName() === locator.persistedFingerprint.opcodeName
        && hashText(candidate.saveAsXML().toXml()) === locator.persistedFingerprint.canonicalHash
      ));
      changed = project.data.getOpcodeList().replaceOpcodeAt(index, OpcodeDefinition.loadFromXML(element));
    } else {
      const value = loadSoundObjectFromXML(element);
      if (!value) throw new Error('Unsupported SoundObject payload');
      changed = project.data.getSoundObjectLibrary().replaceObjectById(key.locator.libraryId, value);
    }
    if (!changed) return null;
    project.commit?.();

    const displayName = key.locator.kind === 'instrument'
      ? project.data.getArrangement().getInstrumentById(key.locator.assignmentId)?.getName() ?? current.displayName
      : key.locator.kind === 'udo'
        ? OpcodeDefinition.loadFromXML(element).getName()
        : project.data.getSoundObjectLibrary().getObjectById(key.locator.libraryId)?.getName() ?? current.displayName;
    const nextKey: LibraryItemKey = key.locator.kind === 'udo'
      ? {
          ...key,
          locator: {
            ...key.locator,
            persistedFingerprint: {
              ...key.locator.persistedFingerprint,
              canonicalHash: hashText(payloadXml),
              opcodeName: displayName,
            },
          },
        }
      : key;
    return {
      key: nextKey,
      displayName,
      objectType: key.locator.kind === 'udo' ? 'OpcodeDefinition' : current.objectType,
      breadcrumb: current.breadcrumb,
      revision: hashText(payloadXml),
      payloadXml,
    };
  }

  createContextTarget(
    libraryType: LibraryType,
    label: string,
    details: Partial<InsertionTargetSnapshot> = {},
  ): InsertionTargetSnapshot | null {
    const project = this.getActiveProject();
    if (!project) return null;
    const currentRevision = String(project.revision ?? 0);
    const requestedRevision = details.targetRevision === 'current'
      ? currentRevision
      : details.targetRevision ?? currentRevision;
    const valid = requestedRevision === currentRevision;
    return {
      libraryType,
      projectSessionId: project.sessionId,
      label,
      valid,
      ...(valid ? {} : { invalidReason: 'The destination changed. Choose it again.' }),
      ...details,
      targetRevision: requestedRevision,
    };
  }

  applyInsertion(input: ProjectInsertionInput): ProjectMutationReceipt {
    const project = this.requireCurrentTarget(input.target, input.key.libraryType);
    const source = this.resolveInsertionSource(project, input);
    const insertedIdentity = this.insertResolvedSource(project, input, source);
    const projectRevision = project.commit?.() ?? (project.revision ?? 0) + 1;
    return {
      projectSessionId: project.sessionId,
      projectRevision,
      libraryType: input.key.libraryType,
      insertedIdentity,
      message: `${source.displayName} was inserted into ${input.target.label}.`,
    };
  }

  getUsage(key: LibraryItemKey): { linkedInstanceCount: number; locations: readonly string[] } {
    if (key.scope === 'user' || key.locator.kind !== 'soundObject') {
      return { linkedInstanceCount: 0, locations: [] };
    }
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) return { linkedInstanceCount: 0, locations: [] };
    const libraryId = key.locator.libraryId;
    const locations: string[] = [];
    const visit = (group: PolyObject, path: string): void => {
      group.forEach((layer, layerIndex) => layer.forEach((object, objectIndex) => {
        const location = `${path}/layer-${layerIndex}/object-${objectIndex}`;
        if (object instanceof Instance && object.getLibraryId() === libraryId) {
          locations.push(location);
        } else if (object instanceof PolyObject) visit(object, location);
      }));
    };
    project.data.getScore().forEach((group, index) => {
      if (group instanceof PolyObject) visit(group, `score/group-${index}`);
    });
    return { linkedInstanceCount: locations.length, locations };
  }

  previewDelete(key: LibraryItemKey): {
    confirmationToken: string;
    linkedInstanceCount: number;
    locations: readonly string[];
    requiresConfirmation: boolean;
  } {
    if (key.scope === 'user') throw new Error('Project delete requires a project key');
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) throw new Error('Stale project session');
    const usage = this.getUsage(key);
    const confirmationToken = randomUUID();
    this.deleteConfirmations.set(confirmationToken, {
      key: JSON.stringify(key), revision: project.revision ?? 0, expiresAt: Date.now() + 60_000,
    });
    return {
      confirmationToken,
      linkedInstanceCount: usage.linkedInstanceCount,
      locations: usage.locations,
      requiresConfirmation: true,
    };
  }

  deleteProjectItem(key: LibraryItemKey, confirmationToken: string): ProjectMutationReceipt {
    if (key.scope === 'user') throw new Error('Project delete requires a project key');
    const project = this.getActiveProject();
    const confirmation = this.deleteConfirmations.get(confirmationToken);
    this.deleteConfirmations.delete(confirmationToken);
    if (!project || project.sessionId !== key.projectSessionId) throw new Error('Stale project session');
    if (
      !confirmation
      || confirmation.expiresAt < Date.now()
      || confirmation.key !== JSON.stringify(key)
      || confirmation.revision !== (project.revision ?? 0)
    ) throw new Error('Delete confirmation expired');

    let changed = false;
    let identity = '';
    if (key.locator.kind === 'instrument') {
      identity = key.locator.assignmentId;
      changed = project.data.getArrangement().removeInstrumentById(identity) !== null;
    } else if (key.locator.kind === 'udo') {
      const fingerprint = key.locator.persistedFingerprint;
      const index = project.data.getOpcodeList().getOpcodes().findIndex((opcode) => (
        opcode.getName() === fingerprint.opcodeName
        && hashText(opcode.saveAsXML().toXml()) === fingerprint.canonicalHash
      ));
      identity = key.locator.sessionObjectId;
      changed = project.data.getOpcodeList().removeOpcodeAt(index);
    } else {
      identity = key.locator.libraryId;
      const removeInstances = (group: PolyObject): void => {
        for (const layer of group) {
          for (let index = layer.length - 1; index >= 0; index -= 1) {
            const object = layer[index]!;
            if (object instanceof Instance && object.getLibraryId() === identity) {
              layer.splice(index, 1);
              changed = true;
            } else if (object instanceof PolyObject) removeInstances(object);
          }
        }
      };
      for (const group of project.data.getScore()) if (group instanceof PolyObject) removeInstances(group);
      changed = project.data.getSoundObjectLibrary().removeObjectById(identity) || changed;
    }
    if (!changed) throw new Error('Project library item not found');
    const projectRevision = project.commit?.() ?? (project.revision ?? 0) + 1;
    return {
      projectSessionId: project.sessionId,
      projectRevision,
      libraryType: key.libraryType,
      insertedIdentity: identity,
      message: 'Project library item and linked usages were removed.',
    };
  }

  async copyProjectItemToUser(
    key: LibraryItemKey,
    repository: UnifiedLibraryRepositoryClient,
    parentId: string,
  ): Promise<RepositoryNode> {
    if (key.scope === 'user') throw new Error('The item is already user-owned');
    const project = this.getActiveProject();
    if (!project || project.sessionId !== key.projectSessionId) throw new Error('Stale project session');
    const source = this.resolveInsertionSource(project, {
      key,
      target: {
        libraryType: key.libraryType,
        projectSessionId: project.sessionId,
        label: 'User Library',
        valid: true,
        targetRevision: String(project.revision ?? 0),
      },
      mode: 'independent',
    });
    const payloadXml = source.value.saveAsXML().toXml();
    return repository.createItem({
      libraryType: key.libraryType,
      parentId,
      displayName: source.displayName,
      payload: {
        embeddedName: source.displayName,
        objectType: source.value.constructor.name,
        supportStatus: 'supported',
        supportReasonCode: null,
        supportMessage: null,
        payloadXml,
        rawHash: hashText(payloadXml),
        canonicalContentHash: hashText(payloadXml),
        serializerRevision: '1',
        preview: {},
        dependencies: { itemOwned: [], unresolvedExternal: [] },
        metadataRevision: 1,
      },
    });
  }

  private requireCurrentTarget(
    target: InsertionTargetSnapshot,
    libraryType: LibraryType,
  ): ActiveLibraryProject {
    const project = this.getActiveProject();
    if (!project || project.sessionId !== target.projectSessionId) {
      throw new Error('Stale project session');
    }
    if (target.libraryType !== libraryType) throw new Error('Incompatible insertion target');
    if (target.targetRevision !== String(project.revision ?? 0)) throw new Error('Stale target revision');
    if (!target.valid) throw new Error(target.invalidReason ?? 'Invalid insertion target');
    return project;
  }

  private resolveInsertionSource(
    project: ActiveLibraryProject,
    input: ProjectInsertionInput,
  ): { displayName: string; value: Instrument | OpcodeDefinition | Effect | SoundObject; libraryId?: string } {
    if (input.key.scope === 'user') {
      if (!input.payloadXml) throw new Error('Library payload is unavailable');
      const element = Element.parse(input.payloadXml);
      switch (input.key.libraryType) {
        case 'instrument': {
          const value = loadInstrumentFromXML(element);
          if (!value) throw new Error('Unsupported instrument payload');
          return { displayName: value.getName(), value };
        }
        case 'udo': {
          const value = OpcodeDefinition.loadFromXML(element);
          return { displayName: value.getName(), value };
        }
        case 'effect': {
          const value = Effect.loadFromXML(element);
          return { displayName: value.getName(), value };
        }
        case 'soundObject': {
          const value = loadSoundObjectFromXML(element);
          if (!value) throw new Error('Unsupported SoundObject payload');
          return { displayName: value.getName(), value };
        }
      }
    }

    if (input.key.projectSessionId !== project.sessionId) throw new Error('Stale project session');
    const locator = input.key.locator;
    if (locator.kind === 'instrument') {
      const value = project.data.getArrangement().getInstrumentById(locator.assignmentId);
      if (!value) throw new Error('Project instrument not found');
      return { displayName: value.getName(), value };
    }
    if (locator.kind === 'udo') {
      const value = project.data.getOpcodeList().getOpcodes().find((candidate) => (
        candidate.getName() === locator.persistedFingerprint.opcodeName
        && hashText(candidate.saveAsXML().toXml()) === locator.persistedFingerprint.canonicalHash
      ));
      if (!value) throw new Error('Project UDO not found');
      return { displayName: value.getName(), value };
    }
    const library = project.data.getSoundObjectLibrary();
    const value = library.getObjectById(locator.libraryId)
      ?? library.findUniqueByFingerprint(locator.persistedFingerprint);
    if (!value) throw new Error('Project shared SoundObject not found');
    return { displayName: value.getName(), value, libraryId: locator.libraryId };
  }

  private insertResolvedSource(
    project: ActiveLibraryProject,
    input: ProjectInsertionInput,
    source: { displayName: string; value: Instrument | OpcodeDefinition | Effect | SoundObject; libraryId?: string },
  ): string {
    switch (input.key.libraryType) {
      case 'instrument': {
        const instrument = copyInstrumentForProject(source.value as Instrument);
        const id = project.data.getArrangement().getNextInstrumentId();
        project.data.getArrangement().addInstrument(instrument, id);
        return id;
      }
      case 'udo': {
        const opcode = copyUdoForProject(source.value as OpcodeDefinition);
        project.data.getOpcodeList().addOpcode(opcode);
        return hashText(opcode.saveAsXML().toXml());
      }
      case 'effect': {
        if (!input.target.channelId || !input.target.chain || input.target.insertIndex === undefined) {
          throw new Error('Effect target is incomplete');
        }
        const effect = copyEffectForProject(source.value as Effect);
        const entryId = randomUUID();
        const changed = applyProjectDocumentPatch(project.data, {
          mixer: {
            type: 'addEffectFromLibrary',
            channelId: input.target.channelId,
            chain: input.target.chain,
            libraryEffectId: input.key.scope === 'user' ? input.key.nodeId : 'project',
            effectXml: effect.saveAsXML().toXml(),
            insertIndex: input.target.insertIndex,
            entryId,
          },
        });
        if (!changed) throw new Error('Stale Effect target');
        return entryId;
      }
      case 'soundObject': {
        const location = input.target.location;
        if (!location) throw new Error('SoundObject target is incomplete');
        if (location.containerPath.length > 0) throw new Error('Nested SoundObject target is stale');
        const definition = source.value as SoundObject;
        const soundObject = input.mode === 'sharedInstance'
          ? createSharedSoundObjectInstance(definition, source.libraryId ?? '')
          : copySoundObjectForProject(definition);
        if (input.mode === 'sharedInstance' && !source.libraryId) {
          throw new Error('Only project shared SoundObjects can create shared instances');
        }
        const layerMatch = /-layer-(\d+)$/.exec(location.layerId);
        if (!layerMatch) throw new Error('SoundObject target layer is stale');
        const layerIndex = Number(layerMatch[1]);
        const selectionId = randomUUID();
        const durationBeats = soundObject.getSubjectiveDuration().toBeats(
          project.data.getScore().getTimeContext(),
        );
        const changed = applyProjectDocumentPatch(project.data, {
          score: {
            type: 'addScoreObjects',
            groupId: location.rootGroupId,
            objects: [{
              selectionId,
              layerIndex,
              objectType: soundObject.constructor.name,
              name: soundObject.getName(),
              startBeats: location.startTime,
              durationBeats,
              backgroundColor: soundObject.getBackgroundColor(),
              serializedXml: soundObject.saveAsXML().toXml(),
            }],
          },
        });
        if (!changed) throw new Error('Stale SoundObject target');
        if (soundObject instanceof Instance) {
          this.resolveNewSharedInstance(project.data, soundObject.getLibraryId(), definition);
        }
        return selectionId;
      }
    }
  }

  private resolveNewSharedInstance(data: BlueData, libraryId: string, definition: SoundObject): void {
    const visit = (group: PolyObject): void => {
      for (const layer of group) {
        for (const object of layer) {
          if (object instanceof Instance && object.getLibraryId() === libraryId && !object.getSoundObject()) {
            object.setSoundObject(definition);
            object.setLibraryId(libraryId);
          } else if (object instanceof PolyObject) {
            visit(object);
          }
        }
      }
    };
    for (const group of data.getScore()) if (group instanceof PolyObject) visit(group);
  }

  private createPreview(
    entry: LibrarySearchResult,
    fields: LibraryItemPreview['fields'],
  ): LibraryItemPreview {
    return {
      key: entry.key,
      displayName: entry.displayName,
      libraryType: entry.libraryType,
      scope: entry.scope,
      objectType: entry.objectType,
      supportStatus: entry.supportStatus,
      supportMessage: entry.supportStatus === 'unsupported'
        ? 'This project item contains data that cannot be edited safely.'
        : null,
      fields,
      dependencies: { itemOwned: [], unresolvedExternal: [] },
    };
  }
}
