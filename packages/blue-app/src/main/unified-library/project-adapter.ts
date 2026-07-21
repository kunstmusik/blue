import { randomUUID } from 'node:crypto';
import type { BlueData, Instrument, OpcodeList, SoundObject } from '@blue/data';
import {
  AudioClip,
  BlueSynthBuilder,
  Effect,
  Element,
  GenericInstrument,
  Instance,
  JavaScriptInstrument,
  OpcodeDefinition,
  PolyObject,
  PythonInstrument,
  TimeBase,
  TimeDuration,
  UDOStyle,
  copyEffectForProject,
  copyInstrumentForProject,
  copySoundObjectForProject,
  copyUdoForProject,
  createSharedSoundObjectInstance,
  loadInstrumentFromXML,
  loadSoundObjectFromXML,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createMixerSnapshot,
  resolveScoreInsertionLocation,
  resolveTimelineTarget,
} from '../../shared/project-editor';
import { getAvailableNumericArrangementId } from '../../shared/unified-library';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import type { RepositoryNode } from './repository';
import type {
  InsertionTargetSnapshot,
  LibraryExactTransferTarget,
  LibraryInsertionMode,
  LibraryItemKey,
  LibraryItemPreview,
  LibrarySearchResult,
  LibraryType,
  ProjectUdoLocator,
  ProjectMutationReceipt,
  ScoreTimelineSoundObjectRequest,
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

export interface TimelineSoundObjectSource {
  readonly displayName: string;
  readonly objectType: string;
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

function getInstrumentOpcodeList(data: BlueData, assignmentId: string): OpcodeList | null {
  const instrument = data.getArrangement().getInstrumentById(assignmentId);
  if (
    instrument instanceof GenericInstrument
    || instrument instanceof JavaScriptInstrument
    || instrument instanceof PythonInstrument
    || instrument instanceof BlueSynthBuilder
  ) {
    return instrument.getOpcodeList();
  }
  return null;
}

function getOpcodeListForLocator(data: BlueData, locator: ProjectUdoLocator): OpcodeList | null {
  return locator.instrumentAssignmentId
    ? getInstrumentOpcodeList(data, locator.instrumentAssignmentId)
    : data.getOpcodeList();
}

function findOpcodeIndex(opcodeList: OpcodeList, locator: ProjectUdoLocator): number {
  return opcodeList.getOpcodes().findIndex((opcode) => (
    opcode.getName() === locator.persistedFingerprint.opcodeName
    && hashText(opcode.saveAsXML().toXml()) === locator.persistedFingerprint.canonicalHash
  ));
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

  getProjectRevision(): number | null {
    return this.getActiveProject()?.revision ?? null;
  }

  getTimelineSoundObjectSource(
    request: ScoreTimelineSoundObjectRequest,
  ): TimelineSoundObjectSource {
    const { soundObject } = this.resolveTimelineSoundObject(request);
    const portable = soundObject instanceof Instance
      ? soundObject.getSoundObject()
      : soundObject;
    if (!portable) throw new Error('The selected shared SoundObject is unavailable.');
    return {
      displayName: portable.getName(),
      objectType: portable.constructor.name,
      payloadXml: portable.saveAsXML().toXml(),
    };
  }

  addTimelineSoundObjectToProjectLibrary(
    request: ScoreTimelineSoundObjectRequest,
  ): ProjectMutationReceipt {
    const { project, soundObject, layer, objectIndex } = this.resolveTimelineSoundObject(request);
    if (soundObject instanceof Instance) {
      throw new Error('This timeline item is already linked to Project SoundObjects.');
    }

    const definition = copySoundObjectForProject(soundObject);
    const duration = definition.getSubjectiveDuration();
    if (
      duration.getTimeBase() !== TimeBase.BEATS
      && (
        duration.getTimeBase() === TimeBase.BBT
        || duration.getTimeBase() === TimeBase.BBST
        || duration.getTimeBase() === TimeBase.BBF
      )
    ) {
      definition.setSubjectiveDuration(TimeDuration.beats(
        duration.toBeats(project.data.getScore().getTimeContext()),
      ));
    }

    const libraryId = project.data.getSoundObjectLibrary().addObject(definition);
    const instance = createSharedSoundObjectInstance(definition, libraryId);
    instance.setStartTime(definition.getStartTime());
    instance.setSubjectiveDuration(definition.getSubjectiveDuration());
    layer[objectIndex] = instance;

    const projectRevision = project.commit?.() ?? (project.revision ?? 0) + 1;
    return {
      projectSessionId: project.sessionId,
      projectRevision,
      libraryType: 'soundObject',
      insertedIdentity: libraryId,
      message: `${definition.getName()} was added to Project SoundObjects.`,
    };
  }

  validateTransferTarget(target: LibraryExactTransferTarget, libraryType: LibraryType): string | null {
    const project = this.getActiveProject();
    if (!project || project.sessionId !== target.projectSessionId) return 'The destination project changed.';
    if ((project.revision ?? 0) !== target.projectRevision) return 'The destination changed. Choose it again.';
    const expectedType = target.kind === 'orchestra'
      ? 'instrument'
      : target.kind === 'projectUdo'
        ? 'udo'
        : target.kind === 'effectChain'
          ? 'effect'
          : 'soundObject';
    if (libraryType !== expectedType) return 'This item type cannot be placed at that destination.';

    if (target.kind === 'orchestra') {
      const assignmentIds = project.data.getArrangement().getArrangement()
        .map((assignment) => assignment.arrangementId);
      return getAvailableNumericArrangementId(assignmentIds, target.insertIndex) === null
        ? 'No unused numeric instrument ID is available at that Orchestra position.'
        : null;
    }
    if (target.kind === 'projectUdo') {
      const opcodeList = target.instrumentAssignmentId
        ? getInstrumentOpcodeList(project.data, target.instrumentAssignmentId)
        : project.data.getOpcodeList();
      if (!opcodeList) return 'The Instrument UDO destination changed.';
      return Number.isInteger(target.insertIndex)
        && target.insertIndex >= 0
        && target.insertIndex <= opcodeList.size()
        ? null
        : 'The UDO insertion position changed.';
    }
    if (target.kind === 'projectSoundObjectLibrary') return null;
    if (target.kind === 'effectChain') {
      const mixer = createMixerSnapshot(project.data.getMixer());
      const channels = [
        mixer.master,
        ...mixer.channels,
        ...mixer.subChannels,
        ...mixer.channelListGroups.flatMap((group) => group.channels),
      ];
      const channel = channels.find((candidate) => (
        candidate.id === target.channelId || candidate.association === target.channelId
      ));
      if (!channel) return 'The mixer channel changed.';
      const chain = target.chain === 'pre' ? channel.preChain : channel.postChain;
      if (chain.map((entry) => entry.entryId).join(':') !== target.chainRevision) return 'The Effect chain changed.';
      return Number.isInteger(target.insertIndex)
        && target.insertIndex >= 0
        && target.insertIndex <= chain.length
        ? null
        : 'The Effect insertion position changed.';
    }

    if (target.timeContextRevision !== String(target.projectRevision)) return 'The Score time context changed.';
    if (!Number.isFinite(target.location.startTime) || target.location.startTime < 0) return 'The Score time position is invalid.';
    return resolveScoreInsertionLocation(project.data, target.location)
      ? null
      : 'The Score path or layer changed.';
  }

  list(libraryType: LibraryType): LibrarySearchResult[] {
    const project = this.getActiveProject();
    if (!project) return [];

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
          parentId: null,
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
      const createResult = (
        opcode: OpcodeDefinition,
        index: number,
        instrumentAssignmentId?: string,
        instrumentName?: string,
      ): LibrarySearchResult => {
        const canonicalHash = hashText(opcode.saveAsXML().toXml());
        const style = udoStyle(opcode);
        return {
          key: {
            scope: 'projectOwned',
            libraryType: 'udo',
            projectSessionId: project.sessionId,
            locator: {
              kind: 'udo',
              ...(instrumentAssignmentId ? { instrumentAssignmentId } : {}),
              sessionObjectId: instrumentAssignmentId
                ? `instrument:${instrumentAssignmentId}:udo:${index}`
                : `udo:${index}`,
              persistedFingerprint: {
                canonicalHash,
                opcodeName: opcode.getName(),
                style,
              },
            },
          },
          parentId: null,
          libraryType: 'udo',
          scope: 'projectOwned',
          displayName: opcode.getName(),
          breadcrumb: instrumentAssignmentId
            ? ['Project Orchestra', `${instrumentAssignmentId} ${instrumentName ?? 'Instrument'}`, 'UDOs']
            : ['Project UDOs'],
          supportStatus: 'supported',
          objectType: 'blue.udo.UserDefinedOpcode',
          revision: canonicalHash,
        };
      };
      const projectUdos = project.data.getOpcodeList().getOpcodes()
        .map((opcode, index) => createResult(opcode, index));
      const instrumentUdos = project.data.getArrangement().getArrangement().flatMap((assignment) => {
        const opcodeList = getInstrumentOpcodeList(project.data, assignment.arrangementId);
        if (!opcodeList) return [];
        return opcodeList.getOpcodes().map((opcode, index) => createResult(
          opcode,
          index,
          assignment.arrangementId,
          assignment.instr?.getName(),
        ));
      });
      return [...projectUdos, ...instrumentUdos];
    }

    if (libraryType === 'effect') {
      const mixer = createMixerSnapshot(project.data.getMixer());
      const channels = [
        mixer.master,
        ...mixer.channels,
        ...mixer.subChannels,
        ...mixer.channelListGroups.flatMap((group) => group.channels),
      ];
      return channels.flatMap((channel) => (
        (['pre', 'post'] as const).flatMap((chain) => (
          (chain === 'pre' ? channel.preChain : channel.postChain)
            .filter((entry) => entry.kind === 'effect')
            .map((entry) => ({
              key: {
                scope: 'projectOwned' as const,
                libraryType: 'effect' as const,
                projectSessionId: project.sessionId,
                locator: { kind: 'effect' as const, channelId: channel.id, chain, entryId: entry.entryId },
              },
              parentId: null,
              libraryType: 'effect' as const,
              scope: 'projectOwned' as const,
              displayName: entry.name || 'Unnamed Effect',
              breadcrumb: [channel.name, chain === 'pre' ? 'Pre Effects' : 'Post Effects'],
              supportStatus: 'supported' as const,
              objectType: 'Effect',
              revision: hashText(entry.effectXml),
            }))
        ))
      ));
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
        parentId: null,
        libraryType: 'soundObject',
        scope: 'projectShared',
        displayName: object.getName(),
        breadcrumb: ['Project Library', 'SoundObjects'],
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
      ? ['instrument', 'udo', 'soundObject', 'effect']
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
      const opcodeList = getOpcodeListForLocator(project.data, key.locator);
      const index = opcodeList ? findOpcodeIndex(opcodeList, key.locator) : -1;
      const opcode = index >= 0 ? opcodeList?.getOpcode(index) : undefined;
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
    if (key.locator.kind === 'effect') {
      const source = this.resolveInsertionSource(project, {
        key,
        target: {
          libraryType: 'effect', projectSessionId: project.sessionId, label: 'Preview',
          valid: true, targetRevision: String(project.revision ?? 0),
        },
        mode: 'independent',
      });
      const effect = source.value as Effect;
      return this.createPreview(entry, {
        inputs: { state: 'available', value: effect.getNumIns() },
        outputs: { state: 'available', value: effect.getNumOuts() },
        comments: effect.getComments()
          ? { state: 'available', value: effect.getComments() }
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
    const entry = this.list(key.libraryType).find((candidate) => {
      if (
        key.locator.kind === 'soundObject'
        && candidate.key.scope !== 'user'
        && candidate.key.locator.kind === 'soundObject'
      ) {
        return candidate.key.locator.libraryId === key.locator.libraryId;
      }
      return JSON.stringify(candidate.key) === JSON.stringify(key);
    });
    if (!entry) return null;
    const source = this.resolveInsertionSource(project, {
      key: entry.key,
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
      const opcodeList = getOpcodeListForLocator(project.data, locator);
      const index = opcodeList ? findOpcodeIndex(opcodeList, locator) : -1;
      changed = opcodeList?.replaceOpcodeAt(index, OpcodeDefinition.loadFromXML(element)) ?? false;
    } else if (key.locator.kind === 'effect') {
      const value = Effect.loadFromXML(element);
      changed = applyProjectDocumentPatch(project.data, {
        mixer: {
          type: 'updateEffect',
          channelId: key.locator.channelId,
          chain: key.locator.chain,
          entryId: key.locator.entryId,
          patch: { effectXml: value.saveAsXML().toXml() },
        },
      });
    } else {
      const value = loadSoundObjectFromXML(element);
      if (!value) throw new Error('Unsupported SoundObject payload');
      changed = project.data.getSoundObjectLibrary().replaceObjectById(key.locator.libraryId, value);
      if (changed) {
        this.relinkSharedInstances(project.data, key.locator.libraryId, value);
      }
    }
    if (!changed) return null;
    project.commit?.();

    const displayName = key.locator.kind === 'instrument'
      ? project.data.getArrangement().getInstrumentById(key.locator.assignmentId)?.getName() ?? current.displayName
      : key.locator.kind === 'udo'
        ? OpcodeDefinition.loadFromXML(element).getName()
        : key.locator.kind === 'effect'
          ? Effect.loadFromXML(element).getName()
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
      const opcodeList = getOpcodeListForLocator(project.data, key.locator);
      const index = opcodeList ? findOpcodeIndex(opcodeList, key.locator) : -1;
      identity = key.locator.sessionObjectId;
      changed = opcodeList?.removeOpcodeAt(index) ?? false;
    } else if (key.locator.kind === 'effect') {
      identity = key.locator.entryId;
      changed = applyProjectDocumentPatch(project.data, {
        mixer: {
          type: 'removeChainEntry',
          channelId: key.locator.channelId,
          chain: key.locator.chain,
          entryId: key.locator.entryId,
        },
      });
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

  private resolveTimelineSoundObject(request: ScoreTimelineSoundObjectRequest): {
    project: ActiveLibraryProject;
    soundObject: SoundObject;
    layer: Array<SoundObject | AudioClip>;
    objectIndex: number;
  } {
    const project = this.getActiveProject();
    if (!project || project.sessionId !== request.projectSessionId) {
      throw new Error('The source project changed.');
    }
    if ((project.revision ?? 0) !== request.projectRevision) {
      throw new Error('The selected SoundObject changed. Copy it again.');
    }
    const resolved = resolveTimelineTarget(project.data.getScore(), {
      rootGroupIndex: request.location.rootGroupIndex,
      containerPath: request.location.containerPath.map((segment) => ({ ...segment })),
      layerIndex: request.location.layerIndex,
      objectIndex: request.location.objectIndex,
    });
    if (!resolved) throw new Error('The selected timeline SoundObject is no longer available.');
    if (resolved.sObj instanceof AudioClip) {
      throw new Error('Audio clips cannot be stored in the SoundObject Library.');
    }
    return {
      project,
      soundObject: resolved.sObj,
      layer: resolved.layer,
      objectIndex: resolved.objectIndex,
    };
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
      const opcodeList = getOpcodeListForLocator(project.data, locator);
      const index = opcodeList ? findOpcodeIndex(opcodeList, locator) : -1;
      const value = index >= 0 ? opcodeList?.getOpcode(index) : undefined;
      if (!value) throw new Error('Project UDO not found');
      return { displayName: value.getName(), value };
    }
    if (locator.kind === 'effect') {
      const mixer = createMixerSnapshot(project.data.getMixer());
      const channels = [
        mixer.master,
        ...mixer.channels,
        ...mixer.subChannels,
        ...mixer.channelListGroups.flatMap((group) => group.channels),
      ];
      const channel = channels.find((candidate) => candidate.id === locator.channelId);
      const chain = locator.chain === 'pre' ? channel?.preChain : channel?.postChain;
      const entry = chain?.find((candidate) => candidate.kind === 'effect' && candidate.entryId === locator.entryId);
      if (!entry || entry.kind !== 'effect') throw new Error('Project Effect not found');
      return { displayName: entry.name || 'Unnamed Effect', value: Effect.loadFromXML(Element.parse(entry.effectXml)) };
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
        const arrangement = project.data.getArrangement();
        const insertIndex = input.target.insertIndex ?? arrangement.size();
        const assignmentId = getAvailableNumericArrangementId(
          arrangement.getArrangement().map((assignment) => assignment.arrangementId),
          insertIndex,
        );
        if (assignmentId === null) {
          throw new Error('No unused numeric instrument ID is available at that Orchestra position.');
        }
        const id = arrangement.addInstrumentAtIndex(
          instrument,
          insertIndex,
          assignmentId,
        );
        return id;
      }
      case 'udo': {
        const opcode = copyUdoForProject(source.value as OpcodeDefinition);
        const opcodeList = input.target.instrumentAssignmentId
          ? getInstrumentOpcodeList(project.data, input.target.instrumentAssignmentId)
          : project.data.getOpcodeList();
        if (!opcodeList) throw new Error('The Instrument UDO destination changed.');
        opcodeList.addOpcodeAt(input.target.insertIndex ?? opcodeList.size(), opcode);
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
        if (input.target.destinationKind === 'projectSoundObjectLibrary') {
          const definition = copySoundObjectForProject(source.value as SoundObject);
          return project.data.getSoundObjectLibrary().addObject(definition);
        }
        const location = input.target.location;
        if (!location) throw new Error('SoundObject target is incomplete');
        const resolvedTarget = resolveScoreInsertionLocation(project.data, location);
        if (!resolvedTarget) throw new Error('SoundObject target path or layer is stale');
        const definition = source.value as SoundObject;
        const soundObject = input.mode === 'sharedInstance'
          ? createSharedSoundObjectInstance(definition, source.libraryId ?? '')
          : copySoundObjectForProject(definition);
        if (input.mode === 'sharedInstance' && !source.libraryId) {
          throw new Error('Only project shared SoundObjects can create shared instances');
        }
        const selectionId = randomUUID();
        const durationBeats = soundObject.getSubjectiveDuration().toBeats(
          project.data.getScore().getTimeContext(),
        );
        const changed = applyProjectDocumentPatch(project.data, {
          score: {
            type: 'addScoreObjects',
            groupId: resolvedTarget.groupId,
            objects: [{
              selectionId,
              layerIndex: resolvedTarget.layerIndex,
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
    this.relinkSharedInstances(data, libraryId, definition, true);
  }

  private relinkSharedInstances(
    data: BlueData,
    libraryId: string,
    definition: SoundObject,
    onlyMissing = false,
  ): void {
    const visit = (group: PolyObject): void => {
      for (const layer of group) {
        for (const object of layer) {
          if (
            object instanceof Instance
            && object.getLibraryId() === libraryId
            && (!onlyMissing || !object.getSoundObject())
          ) {
            const name = object.getName();
            const backgroundColor = object.getBackgroundColor();
            object.setSoundObject(definition);
            object.setLibraryId(libraryId);
            if (!onlyMissing) {
              object.setName(name);
              object.setBackgroundColor(backgroundColor);
            }
          } else if (object instanceof PolyObject) {
            visit(object);
          }
        }
      }
    };
    for (const group of data.getScore()) if (group instanceof PolyObject) visit(group);
    for (const { object } of data.getSoundObjectLibrary().getEntries()) {
      if (object instanceof PolyObject) visit(object);
    }
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
