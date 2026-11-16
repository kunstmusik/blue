import {
  Arrangement,
  AudioClip,
  BlueSynthBuilder,
  Effect,
  GlobalOrcSco,
  Instance,
  LiveData,
  MarkersList,
  MidiInputProcessor,
  Mixer,
  NoteProcessorChainMap,
  OpcodeList,
  PolyObject,
  ProjectProperties,
  Score,
  ScratchPadData,
  Sound,
  Tables,
  TrackLayerGroup,
  type BlueData,
  type Instrument,
  type SoundObject,
} from '@blue/data';
import type {
  ProjectDocumentPatch,
  ProjectDocumentPatchContext,
  InstrumentPatch,
  EffectEditablePatch,
  ScoreObjectEditorTargetSnapshot,
} from '../shared/project-editor/contract';
import { findMixerChannelById } from '../shared/project-editor';
import {
  copyAssignedScoreObjectIds,
  getMixerEntrySnapshotId,
  readGraphEditorMetadata,
  restoreGraphEditorMetadata,
} from '../shared/project-editor/identity';
import {
  assignHistoryNodeId,
  getHistoryNodeId,
  transferHistoryNodeIds,
} from '../shared/project-editor/history-node-identity';
import { applyInstrumentPatch } from '../shared/project-editor/snapshot-mixer-orchestra';
import { applyEffectEditablePatchToEffect } from '../shared/project-editor/patch-mixer-bluelive';
import { resolveEditorTarget } from '../shared/project-editor/snapshot-score';
import { applyProjectDocumentPatch } from '../shared/project-editor/patch-document';
import {
  applyScoreObjectLeafPatch,
  isScoreColorPatchAccepted,
  isScoreObjectLeafPatch,
  scorePatchTouchesMixerAudioChannels,
} from '../shared/project-editor/patch-score';
import {
  applyProjectGraphDelta,
  captureProjectGraphDeltaWithSnapshots,
  isNetZeroProjectGraphDelta,
  type GraphSnapshot,
  type ProjectGraphDelta,
} from './project-history-graph';

type BsbOwner = BlueSynthBuilder | Effect;
type IsolatedOwner = object;
type IsolatedSectionKey =
  | 'arrangement'
  | 'projectProperties'
  | 'globalOrcSco'
  | 'tables'
  | 'score'
  | 'soundObjectLibrary'
  | 'liveData'
  | 'scratchPad'
  | 'noteProcessorChainMap'
  | 'markersList'
  | 'midiInputProcessor'
  | 'mixer'
  | 'opcodeList';

interface OwnerGraphEntry {
  owner: IsolatedOwner;
  delta: ProjectGraphDelta;
  beforeSnapshot: GraphSnapshot;
  afterSnapshot: GraphSnapshot;
}

export interface PreparedBsbTransaction {
  readonly kind: 'bsb';
  readonly delta: ProjectGraphDelta;
  readonly changed: boolean;
  readonly patchChanged: boolean[];
  readonly patchAccepted: boolean[];
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
}

export interface PreparedIsolatedStructureResult {
  readonly delta: ProjectGraphDelta;
  readonly changed: boolean;
  readonly patchChanged: boolean[];
  readonly patchAccepted: boolean[];
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
}

function finalizeOwnerDeltas(
  data: BlueData,
  owners: Map<IsolatedOwner, IsolatedOwner>,
  onApplied?: () => void,
): {
  delta: ProjectGraphDelta;
  changed: boolean;
  apply(): void;
  getGroupingEndpointSnapshot(): GraphSnapshot;
} {
  const rootId = getHistoryNodeId(data);
  const delta: ProjectGraphDelta = {
    rootId,
    fields: [],
    contents: [],
    metadata: [],
    beforeNodes: [],
    afterNodes: [],
  };
  const ownerApplies: OwnerGraphEntry[] = [];
  for (const [before, after] of owners) {
    const {
      delta: part,
      beforeSnapshot,
      afterSnapshot,
    } = captureProjectGraphDeltaWithSnapshots(before, after);
    delta.fields.push(...part.fields);
    delta.contents.push(...part.contents);
    delta.metadata.push(...part.metadata);
    delta.beforeNodes.push(...part.beforeNodes);
    delta.afterNodes.push(...part.afterNodes);
    ownerApplies.push({ owner: before, delta: part, beforeSnapshot, afterSnapshot });
  }
  return {
    delta,
    changed: !isNetZeroProjectGraphDelta(delta),
    apply: () => {
      for (const item of ownerApplies) {
        applyProjectGraphDelta(item.owner, item.delta, 'after', item.beforeSnapshot);
      }
      onApplied?.();
    },
    getGroupingEndpointSnapshot: () => {
      const nodes = new Map() as GraphSnapshot['nodes'];
      const objects = new Map<number, object>();
      for (const item of ownerApplies) {
        for (const [id, node] of item.afterSnapshot.nodes) nodes.set(id, node);
        for (const [id, obj] of item.afterSnapshot.objects) objects.set(id, obj);
      }
      return { nodes, objects };
    },
  };
}

/** BSB-only batches prepare detached owners; every BSB operation uses the same graph delta. */
export function prepareBsbTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedBsbTransaction | null {
  const owners = new Map<BsbOwner, BsbOwner>();
  const patchChanged: boolean[] = [];
  for (const patch of patches) {
    if (Object.keys(patch).length !== 1) return null;
    let owner: BsbOwner | undefined;
    let edit: InstrumentPatch | EffectEditablePatch;
    if (patch.orchestra?.type === 'updateInstrument') {
      if (patch.orchestra.patch.name !== undefined) {
        return null;
      }
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (!(found instanceof BlueSynthBuilder)) return null;
      owner = found;
      edit = patch.orchestra.patch;
    } else if (patch.score?.type === 'updateTrackInstrument') {
      const ref = patch.score.track;
      if (
        ref.projectSessionId !== context?.projectSessionId ||
        ref.projectRevision !== context?.projectRevision
      )
        return null;
      const group = data
        .getScore()
        .find(
          (group) => group instanceof TrackLayerGroup && group.getUniqueId() === ref.rootGroupId,
        );
      const found =
        group instanceof TrackLayerGroup
          ? group.find((track) => track.getUniqueId() === ref.trackId)?.getInstrument()
          : undefined;
      if (!(found instanceof BlueSynthBuilder)) return null;
      owner = found;
      edit = patch.score.patch;
    } else if (patch.mixer?.type === 'updateEffect') {
      const effect = patch.mixer;
      const channel = findMixerChannelById(data.getMixer(), effect.channelId);
      const found = (
        effect.chain === 'pre' ? channel?.getPreEffects() : channel?.getPostEffects()
      )?.find((entry) => getMixerEntrySnapshotId(entry) === effect.entryId);
      if (!(found instanceof Effect)) return null;
      owner = found;
      edit = effect.patch;
    } else if (
      patch.score?.type === 'updateTypeSpecificEditor' &&
      Object.keys(patch.score.patch).length === 1 &&
      patch.score.patch.bsbInterfacePatch
    ) {
      const resolved = resolveEditorTarget(data, patch.score.target);
      if (!(resolved?.sObj instanceof Sound)) return null;
      owner = resolved.sObj.getBlueSynthBuilder();
      edit = {
        bsbInterface: patch.score.patch.bsbInterfacePatch as NonNullable<
          InstrumentPatch['bsbInterface']
        >,
      };
    } else return null;
    if (
      Object.keys(edit).length !== 1 ||
      !(
        ('bsbInterface' in edit && edit.bsbInterface) ||
        ('bsbWidgetValues' in edit && edit.bsbWidgetValues)
      )
    )
      return null;
    let candidate = owners.get(owner);
    if (!candidate) {
      candidate = owner.deepCopy('history') as BsbOwner;
      transferHistoryNodeIds(owner, candidate, (a, b) =>
        restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
      );
      owners.set(owner, candidate);
    }
    const before = candidate.saveAsXML().toXml();
    if (candidate instanceof Effect) applyEffectEditablePatchToEffect(candidate, edit);
    else applyInstrumentPatch(candidate, edit);
    if (candidate instanceof BlueSynthBuilder) candidate.getParameters();
    patchChanged.push(before !== candidate.saveAsXML().toXml());
  }
  const finalized = finalizeOwnerDeltas(data, owners);
  return {
    kind: 'bsb',
    ...finalized,
    patchChanged,
    patchAccepted: patches.map(() => true),
  };
}

function isBsbSelectionPatch(patch: ProjectDocumentPatch): boolean {
  if (Object.keys(patch).length !== 1) return false;
  if (patch.score?.type === 'updateTypeSpecificEditor') {
    const value = patch.score.patch.bsbInterfacePatch as { type?: unknown } | undefined;
    return Object.keys(patch.score.patch).length === 1 && value?.type === 'selectWidget';
  }
  return false;
}

function cloneLeafOwner(source: Instrument | Effect | SoundObject | AudioClip): IsolatedOwner {
  return source instanceof AudioClip
    ? AudioClip.copyFrom(source)
    : (source.deepCopy('history') as IsolatedOwner);
}

function tryPrepareLeafOwnerTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedIsolatedStructureResult | null {
  const owners = new Map<IsolatedOwner, IsolatedOwner>();
  const patchChanged: boolean[] = [];

  const ensureCandidate = (
    source: Instrument | Effect | SoundObject | AudioClip,
  ): IsolatedOwner | null => {
    const existing = owners.get(source);
    if (existing) return existing;
    // If a batch mixes a container SoundObject (PolyObject or Instance) with another
    // leaf owner, fall back to section-level Score cloning so parent/child subtrees cannot overlap.
    if (
      owners.size > 0 &&
      (source instanceof PolyObject ||
        source instanceof Instance ||
        Array.from(owners.keys()).some(
          (owner) => owner instanceof PolyObject || owner instanceof Instance,
        ))
    ) {
      return null;
    }
    const copy = cloneLeafOwner(source);
    transferHistoryNodeIds(source, copy, (a, b) =>
      restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
    );
    owners.set(source, copy);
    return copy;
  };

  for (const patch of patches) {
    if (Object.keys(patch).length !== 1) return null;

    if (patch.orchestra?.type === 'updateInstrument') {
      if (patch.orchestra.patch.name !== undefined) {
        return null;
      }
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (patch.orchestra.patch.bsbInterface && !(found instanceof BlueSynthBuilder)) {
        throw new Error(
          `BSB instrument '${patch.orchestra.assignmentId}' no longer exists; edit rejected`,
        );
      }
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      const candidate = ensureCandidate(found);
      if (!candidate) return null;
      patchChanged.push(applyInstrumentPatch(candidate as Instrument, patch.orchestra.patch));
    } else if (patch.orchestra?.type === 'updateInstrumentComment') {
      const found = data.getArrangement().getInstrumentById(patch.orchestra.assignmentId);
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      const candidate = ensureCandidate(found);
      if (!candidate) return null;
      const changed = (candidate as Instrument).getComment() !== patch.orchestra.comment;
      if (changed) (candidate as Instrument).setComment(patch.orchestra.comment);
      patchChanged.push(changed);
    } else if (patch.score?.type === 'updateTrackInstrument') {
      const ref = patch.score.track;
      if (
        ref.projectSessionId !== context?.projectSessionId ||
        ref.projectRevision !== context?.projectRevision
      ) {
        return null;
      }
      const group = data
        .getScore()
        .find((g) => g instanceof TrackLayerGroup && g.getUniqueId() === ref.rootGroupId);
      const found =
        group instanceof TrackLayerGroup
          ? group.find((track) => track.getUniqueId() === ref.trackId)?.getInstrument()
          : undefined;
      if (!found) {
        patchChanged.push(false);
        continue;
      }
      if (patch.score.patch.bsbInterface && !(found instanceof BlueSynthBuilder)) {
        return null;
      }
      const candidate = ensureCandidate(found);
      if (!candidate) return null;
      patchChanged.push(applyInstrumentPatch(candidate as Instrument, patch.score.patch));
    } else if (patch.mixer?.type === 'updateEffect') {
      const effectPatch = patch.mixer;
      if (effectPatch.patch.effectXml !== undefined) return null;
      const channel = findMixerChannelById(data.getMixer(), effectPatch.channelId);
      const found = (
        effectPatch.chain === 'pre' ? channel?.getPreEffects() : channel?.getPostEffects()
      )?.find((entry) => getMixerEntrySnapshotId(entry) === effectPatch.entryId);
      if (!(found instanceof Effect)) {
        patchChanged.push(false);
        continue;
      }
      const candidate = ensureCandidate(found);
      if (!candidate) return null;
      patchChanged.push(applyEffectEditablePatchToEffect(candidate as Effect, effectPatch.patch));
    } else if (patch.score && isScoreObjectLeafPatch(patch.score)) {
      if (isBsbSelectionPatch(patch)) {
        patchChanged.push(false);
        continue;
      }
      const scorePatch = patch.score;
      const resolved = resolveEditorTarget(data, scorePatch.target);
      if (!resolved) {
        patchChanged.push(false);
        continue;
      }
      const colorAccepted =
        scorePatch.type === 'updateSharedProperties' &&
        scorePatch.patch.backgroundColor !== undefined
          ? isScoreColorPatchAccepted(data, scorePatch)
          : true;
      const candidate = ensureCandidate(resolved.sObj);
      if (!candidate) return null;
      patchChanged.push(
        applyScoreObjectLeafPatch(
          candidate as SoundObject | AudioClip,
          scorePatch,
          data.getScore().getTimeContext(),
          { colorAccepted },
        ),
      );
    } else {
      return null;
    }
  }

  const finalized = finalizeOwnerDeltas(data, owners);
  return {
    ...finalized,
    patchChanged,
    patchAccepted: patches.map(() => true),
  };
}

function isScoreAutomationPatchType(type: string): boolean {
  return (
    type === 'assignAutomationToLayer' ||
    type === 'removeAutomationFromLayer' ||
    type === 'moveAutomationToLayer' ||
    type === 'clearLayerAutomations' ||
    type === 'selectLayerAutomation' ||
    type === 'setAutomationLineColor' ||
    type === 'setAutomationResolution' ||
    type === 'setAutomationPoints' ||
    type === 'insertAutomationPoint' ||
    type === 'deleteAutomationPoint' ||
    type === 'moveAutomationPoint' ||
    type === 'cleanupLayerAutomation' ||
    type === 'moveAutomationRange' ||
    type === 'scaleAutomationRange'
  );
}

function getScorePatchTargets(
  sp: NonNullable<ProjectDocumentPatch['score']>,
): ScoreObjectEditorTargetSnapshot[] {
  const targets: ScoreObjectEditorTargetSnapshot[] = [];
  if ('target' in sp && sp.target) {
    targets.push(sp.target);
  }
  if ('targets' in sp && Array.isArray(sp.targets)) {
    targets.push(...sp.targets);
  }
  if ('updates' in sp && Array.isArray(sp.updates)) {
    for (const update of sp.updates) {
      if (update && typeof update === 'object' && 'target' in update && update.target) {
        targets.push(update.target);
      }
    }
  }
  if ('moves' in sp && Array.isArray(sp.moves)) {
    for (const move of sp.moves) {
      if (move && typeof move === 'object' && 'target' in move && move.target) {
        targets.push(move.target);
      }
    }
  }
  if ('objects' in sp && Array.isArray(sp.objects)) {
    for (const obj of sp.objects) {
      if (obj && typeof obj === 'object' && 'sourceTarget' in obj && obj.sourceTarget) {
        targets.push(obj.sourceTarget);
      }
    }
  }
  return targets;
}

function addIsolatedSectionsForPatch(
  patch: ProjectDocumentPatch,
  sections: Set<IsolatedSectionKey>,
  rootFields: Set<PropertyKey>,
): boolean {
  if (patch.clojureProject !== undefined) {
    rootFields.add('pluginDataXml');
  }
  if (patch.globalOrc !== undefined || patch.globalSco !== undefined) {
    sections.add('globalOrcSco');
  }
  if (patch.tablesText !== undefined) {
    sections.add('tables');
  }
  if (patch.scratchPad !== undefined) {
    sections.add('scratchPad');
  }
  if (patch.projectUdo !== undefined) {
    sections.add('opcodeList');
  }
  if (patch.projectProperties !== undefined) {
    sections.add('projectProperties');
  }
  if (patch.midiInput !== undefined) {
    sections.add('midiInputProcessor');
  }
  if (patch.blueLive !== undefined) {
    sections.add('liveData');
  }
  if (patch.transport !== undefined) {
    if (
      patch.transport.renderStartTime !== undefined ||
      patch.transport.renderEndTime !== undefined ||
      patch.transport.loopRendering !== undefined
    ) {
      // Updating the start can implicitly clear the end.
      rootFields.add('renderStartTime');
      rootFields.add('renderEndTime');
      rootFields.add('loopRendering');
    }
    if (
      patch.transport.tempoMap ||
      patch.transport.tempoMapPatch ||
      patch.transport.meterMapPatch
    ) {
      sections.add('score');
    }
  }
  if (patch.mixer !== undefined) {
    sections.add('mixer');
    if (
      patch.mixer.type === 'renameChannelListGroup' ||
      (patch.mixer.type === 'updateChannel' && patch.mixer.patch.name !== undefined)
    ) {
      sections.add('score');
    }
  }
  if (patch.orchestra !== undefined) {
    sections.add('arrangement');
    sections.add('mixer');
  }
  if (patch.score !== undefined) {
    const sp = patch.score;
    if (
      sp.type === 'convertToPolyObject' ||
      (sp.type === 'addScoreObjects' &&
        sp.objects.some(
          (object) =>
            object.sourceTarget ||
            object.objectType === 'Instance' ||
            object.serializedXml?.includes('Instance'),
        )) ||
      (sp.type === 'addTrackItem' &&
        (sp.item.objectType === 'Instance' ||
          sp.item.type === 'Instance' ||
          sp.item.serializedXml?.includes('Instance')))
    ) {
      sections.add('soundObjectLibrary');
    }
    const targets = getScorePatchTargets(sp);
    const changesPlacement =
      sp.type === 'convertToPolyObject' ||
      sp.type === 'moveScoreObjects' ||
      sp.type === 'removeScoreObjects';
    if (
      targets.some(
        (t) => t.ownerKind === 'library' && !(changesPlacement && t.displayContext === 'instance'),
      )
    ) {
      return false;
    }
    if (
      targets.some(
        (t) =>
          t.ownerKind === 'blueLive' || t.displayContext === 'blueLive' || t.blueLive !== undefined,
      )
    ) {
      sections.add('liveData');
    }
    if (sp.type === 'addMarker' || sp.type === 'updateMarker' || sp.type === 'removeMarker') {
      sections.add('markersList');
    } else if (
      sp.type === 'saveNamedNoteProcessorChain' ||
      sp.type === 'deleteNamedNoteProcessorChain'
    ) {
      sections.add('noteProcessorChainMap');
    } else {
      sections.add('score');
      if (sp.type === 'updateTimeState') {
        sections.add('markersList');
      }
      if (isScoreAutomationPatchType(sp.type)) {
        sections.add('arrangement');
        sections.add('mixer');
      }
      if (scorePatchTouchesMixerAudioChannels(sp)) {
        sections.add('mixer');
      }
    }
  }
  return true;
}

function cloneProjectSection(data: BlueData, key: IsolatedSectionKey): object {
  switch (key) {
    case 'arrangement':
      return new Arrangement(data.getArrangement(), 'history');
    case 'projectProperties':
      return new ProjectProperties(data.getProjectProperties());
    case 'globalOrcSco':
      return new GlobalOrcSco(data.getGlobalOrcSco());
    case 'tables':
      return new Tables(data.getTableSet());
    case 'score':
      return new Score(data.getScore(), 'history', true);
    case 'soundObjectLibrary':
      return data.getSoundObjectLibrary().forkForInstanceRegistration();
    case 'liveData':
      return data.getLiveData().deepCopy('history');
    case 'scratchPad':
      return new ScratchPadData(data.getScratchPadData());
    case 'noteProcessorChainMap':
      return new NoteProcessorChainMap(data.getNoteProcessorChainMap());
    case 'markersList':
      return new MarkersList(data.getMarkersList());
    case 'midiInputProcessor':
      return new MidiInputProcessor(data.getMidiInputProcessor());
    case 'mixer':
      return data.getMixer().deepCopy('history');
    case 'opcodeList':
      return new OpcodeList(data.getOpcodeList());
  }
}

function getProjectSection(data: BlueData, key: IsolatedSectionKey): object {
  switch (key) {
    case 'arrangement':
      return data.getArrangement();
    case 'projectProperties':
      return data.getProjectProperties();
    case 'globalOrcSco':
      return data.getGlobalOrcSco();
    case 'tables':
      return data.getTableSet();
    case 'score':
      return data.getScore();
    case 'soundObjectLibrary':
      return data.getSoundObjectLibrary();
    case 'liveData':
      return data.getLiveData();
    case 'scratchPad':
      return data.getScratchPadData();
    case 'noteProcessorChainMap':
      return data.getNoteProcessorChainMap();
    case 'markersList':
      return data.getMarkersList();
    case 'midiInputProcessor':
      return data.getMidiInputProcessor();
    case 'mixer':
      return data.getMixer();
    case 'opcodeList':
      return data.getOpcodeList();
  }
}

function tryPrepareSectionOwnerTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedIsolatedStructureResult | null {
  const requiredSections = new Set<IsolatedSectionKey>();
  const rootFields = new Set<PropertyKey>();
  for (const patch of patches) {
    if (!addIsolatedSectionsForPatch(patch, requiredSections, rootFields)) return null;
  }
  if (requiredSections.size === 0 && rootFields.size === 0) return null;

  // The detached root shares read-only project sections with the active project.
  // Every mutable section is copied before applying any patch.
  const candidate: BlueData = Object.assign(Object.create(Object.getPrototypeOf(data)), data);
  assignHistoryNodeId(candidate, getHistoryNodeId(data));
  restoreGraphEditorMetadata(candidate, readGraphEditorMetadata(data));
  for (const key of requiredSections) {
    const source = getProjectSection(data, key);
    const field = Reflect.ownKeys(data).find((field) => Reflect.get(data, field) === source);
    if (field === undefined) return null;
    const copy = cloneProjectSection(data, key);
    transferHistoryNodeIds(source, copy, (a, b) =>
      restoreGraphEditorMetadata(b, readGraphEditorMetadata(a)),
    );
    Reflect.set(candidate, field, copy);
    rootFields.add(field);
  }
  const copyScoreIds = requiredSections.has('score') || requiredSections.has('liveData');
  if (copyScoreIds) {
    copyAssignedScoreObjectIds(data, candidate);
    // Undoing a removed Instance must still resolve its canonical definition
    // when this was the only reference in the edited score or Live section.
    if (data.getSoundObjectLibrary().size() > 0) rootFields.add('sObjLib');
  }

  const patchChanged = patches.map((patch) =>
    isBsbSelectionPatch(patch) ? false : applyProjectDocumentPatch(candidate, patch, context),
  );
  const { delta, beforeSnapshot, afterSnapshot } = captureProjectGraphDeltaWithSnapshots(
    data,
    candidate,
    rootFields,
  );
  return {
    delta,
    changed: !isNetZeroProjectGraphDelta(delta),
    patchChanged,
    patchAccepted: patches.map(() => true),
    apply() {
      applyProjectGraphDelta(data, delta, 'after', beforeSnapshot);
      if (copyScoreIds) copyAssignedScoreObjectIds(candidate, data);
    },
    getGroupingEndpointSnapshot: () => afterSnapshot,
  };
}

/**
 * Prepares isolated leaf edits (instruments, effects, single ScoreObjects/AudioClips) or
 * section-scoped structural edits by cloning only the modified leaf/section(s) instead of
 * calling `data.historyCopy()`.
 */
export function prepareIsolatedOwnerStructureTransaction(
  data: BlueData,
  patches: readonly ProjectDocumentPatch[],
  context?: ProjectDocumentPatchContext,
): PreparedIsolatedStructureResult | null {
  if (patches.length === 0) return null;
  return (
    tryPrepareLeafOwnerTransaction(data, patches, context) ??
    tryPrepareSectionOwnerTransaction(data, patches, context)
  );
}
