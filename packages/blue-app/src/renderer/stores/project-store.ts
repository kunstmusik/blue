import { create } from 'zustand';
import { toast } from 'sonner';
import {
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
  Effect,
  Element,
  GenericInstrument,
  JavaScriptInstrument,
  PythonInstrument,
} from '@blue/data';
import {
  createEmptyProjectEditorSnapshot,
  createEmptyScratchPadSnapshot,
  createEmptyMixerSnapshot,
  createEmptyScoreDocumentSnapshot,
  createMixerEffectEntrySnapshot,
  createDefaultBsbWidgetSnapshot,
  createBsbRealtimeControlUpdate,
  createInstrumentSnapshot,
  collectBsbReplacementKeysFromSnapshotTree,
  ensureUniqueName,
  reconcileMixerSnapshotWithArrangement,
  type BlueLiveProjectSnapshot,
  type BlueLivePatch,
  type ClojureProjectSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
  type BlueX7InstrumentSnapshot,
  isValidBlueX7Patch,
  type BsbInterfacePatch,
  type BsbRealtimeControlUpdate,
  type BsbWidgetNodeSnapshot,
  type ArrangementRowSnapshot,
  type EmbeddedOpcodeListPatch,
  type GenericInstrumentSnapshot,
  type JavaScriptInstrumentSnapshot,
  type PythonInstrumentSnapshot,
  type MidiInputPatch,
  type MidiInputProcessorSnapshot,
  type InstrumentPatch,
  type InstrumentSnapshot,
  type MixerChannelEditableFields,
  type MixerChannelSnapshot,
  type MixerChainClipboardPayload,
  type MixerChainEntrySnapshot,
  type MixerEffectEntrySnapshot,
  type MixerPatch,
  type MixerSendEntrySnapshot,
  type MixerSnapshot,
  type NoteProcessorChainSnapshot,
  type PatternLayerSnapshot,
  type PatternScorePatch,
  type PatternSourceObjectSnapshot,
  type PresetGroupSnapshot,
  type PresetSnapshot,
  type ProjectDocumentPatch,
  type ProjectLoadedPayload,
  type ProjectEditorSnapshot,
  type ProjectPropertiesSnapshot,
  type ScratchPadPatch,
  type ScratchPadSnapshot,
  type MarkerSnapshot,
  type OrchestraPatch,
  type OrchestraSnapshot,
  type ProjectUdoPatch,
  type ScoreDocumentSnapshot,
  type ScoreLayerGroupSnapshot,
  type ScoreLayerGroupType,
  type ScoreLayerSnapshot,
  type TrackLayerGroupSnapshot,
  type TrackSnapshot,
  type TrackInstrumentSummary,
  type ScoreRowObjectSnapshot,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLocationRef,
  type ScorePatch,
  type SupportedNewInstrumentType,
  type TempoMapPatch,
  type ToolbarProjectTransportSnapshot,
  type UdoDefinitionSnapshot,
  areLayerRangesValid,
  isValidLayerRange,
  isValidLayerRangeTarget,
} from '../../shared/project-editor';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';
import {
  BSB_LINE_SELECTOR_HEIGHT,
  getHSliderBankDisplaySize,
  getVSliderBankDisplaySize,
  getBsbWidgetDisplaySize,
} from '../../shared/bsb-widget-layout';
import {
  EMPTY_UDO_SNAPSHOT,
  cloneUdoSnapshot,
  convertUdoSnapshotStyle,
  formatUdoListAsOpcodeText,
} from '../components/workbench/panels/udo/udo-snapshot-utils';
import {
  useMidiRoutingStore,
  type MidiRoutingReconciliation,
} from './midi-routing-store';
import { useLayerSelectionStore } from './layer-selection-store';
import {
  createProjectPatchQueue,
  type ProjectPatchQueue,
} from './project-store/project-patch-queue';
import {
  applyBsbInstrumentPatchToSnapshot,
} from './project-store/bsb-interface-snapshot';

export { applyBsbInterfacePatchToSnapshot } from './project-store/bsb-interface-snapshot';

interface ProjectState {
  title: string;
  author: string;
  sampleRate: string;
  version: string;
  filePath: string | null;
  sessionId: number;
  isLoading: boolean;
  isDirty: boolean;
  lastScorePatch: ScorePatch | null;
  loaded: boolean;
  globalOrc: string;
  globalSco: string;
  orchestra: OrchestraSnapshot;
  mixer: MixerSnapshot;
  projectProperties: ProjectPropertiesSnapshot;
  scratchPad: ScratchPadSnapshot;
  clojureProject: ClojureProjectSnapshot;
  transport: ToolbarProjectTransportSnapshot;
  tablesText: string;
  projectUdos: UdoDefinitionSnapshot[];
  generatedCsd: { text: string; title: string } | null;
  blueLive: BlueLiveProjectSnapshot | null;
  midiInput: MidiInputProcessorSnapshot | null;
  score: ScoreDocumentSnapshot;
  scrollToBeatTarget: number | null;
  audioClipEditorPreviewByObjectId: Record<string, AudioClipEditorPreview>;
  missingAudioSession: MissingAudioAssetsSession | null;
}

interface AudioClipEditorPreview {
  fileStartTime?: number;
  fadeIn?: number;
  fadeOut?: number;
}

interface ProjectActions {
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  setProjectInfo: (info: ProjectLoadedPayload | null) => void;
  setLoading: (loading: boolean) => void;
  markDirty: () => void;
  markClean: () => void;
  clearProject: () => void;
  applyProjectDocumentPatch: (patch: ProjectDocumentPatch) => Promise<void>;
  updateGlobalOrc: (globalOrc: string) => Promise<void>;
  updateGlobalSco: (globalSco: string) => Promise<void>;
  updateOrchestra: (orchestra: OrchestraPatch) => Promise<void>;
  updateProjectProperties: (
    patch: Partial<ProjectPropertiesSnapshot>,
  ) => Promise<void>;
  updateScratchPad: (patch: ScratchPadPatch) => Promise<void>;
  updateClojureProject: (
    clojureProject: ClojureProjectSnapshot,
  ) => Promise<void>;
  setLoopRendering: (loopRendering: boolean) => Promise<void>;
  addMarkerAtTime: (timeBeats: number) => void;
  addMarkerAtRenderStart: () => void;
  updateTablesText: (tablesText: string) => Promise<void>;
  applyProjectUdoPatch: (patch: ProjectUdoPatch) => Promise<void>;
  applyBlueLivePatch: (patch: BlueLivePatch) => Promise<void>;
  setGeneratedCsd: (csd: { text: string; title: string } | null) => void;
  generateCsdToScreen: () => Promise<void>;
  generateRealtimeCsdToScreen: () => Promise<void>;
  generateCsdToDisk: () => Promise<void>;
  flushPendingPatches: () => Promise<void>;
  moveScoreObjects: (moves: Array<{ objectId: string; targetStartBeats: number; targetLayerIndex?: number; targetGroupId?: string }>) => void;
  removeScoreObjects: (objectIds: ReadonlySet<string>) => void;
  addScoreObjects: (objects: Array<{ layerIndex: number; groupId: string; name: string; startBeats: number; durationBeats: number; startTimeBase?: string; durationTimeBase?: string; backgroundColor: number; objectType: string; isContainer: boolean; editorTarget?: ScoreObjectEditorTargetSnapshot; serializedXml?: string; barRenderer?: ScoreRowObjectSnapshot['barRenderer'] }>) => void;
  setLayerMute: (groupId: string, layerIndex: number, muted: boolean) => void;
  setLayerSolo: (groupId: string, layerIndex: number, solo: boolean) => void;
  renameLayer: (layerId: string, name: string) => void;
  setLayerHeight: (groupId: string, layerIndex: number, heightIndex: number) => void;
  addLayer: (groupId: string, layerIndex: number) => void;
  removeLayer: (groupId: string, layerIndex: number) => void;
  setScoreObjectColor: (objectIds: ReadonlySet<string>, color: number) => void;
  resizeScoreObjects: (resizes: Array<{ objectId: string; targetStartBeats: number; targetDurationBeats: number }>) => void;
  setScrollToBeatTarget: (beats: number | null) => void;
  navigateToNextMarker: () => void;
  navigateToPreviousMarker: () => void;
  rewindToStart: () => void;
  setAudioClipEditorPreview: (objectId: string, preview: AudioClipEditorPreview) => void;
  clearAudioClipEditorPreview: (objectId: string) => void;
  setMissingAudioSession: (session: MissingAudioAssetsSession | null) => void;
  applyMissingAudioResolvedSnapshot: (snapshot: ProjectEditorSnapshot) => void;
}

let projectPatchQueue: ProjectPatchQueue | null = null;
let storeSet: any;
let nextLocalScoreObjectId = 1;

function normalizeMixerPatchIdentifiers(patch: MixerPatch): MixerPatch {
  switch (patch.type) {
    case 'addSubChannel':
      return patch.channelId ? patch : { ...patch, channelId: crypto.randomUUID() };
    case 'addEffectFromLibrary':
      return patch.entryId ? patch : { ...patch, entryId: crypto.randomUUID() };
    case 'addSend':
      return patch.entryId ? patch : { ...patch, entryId: crypto.randomUUID() };
    default:
      return patch;
  }
}

function normalizeProjectDocumentPatch(patch: ProjectDocumentPatch): ProjectDocumentPatch {
  if (!patch.mixer) {
    return patch;
  }

  const mixer = normalizeMixerPatchIdentifiers(patch.mixer);
  return mixer === patch.mixer ? patch : { ...patch, mixer };
}

function createLocalScoreObjectId(objectType: string): string {
  const prefix = objectType === 'AudioClip' ? 'aclp' : 'sobj';
  return `local-${prefix}-${nextLocalScoreObjectId++}`;
}

function createDefaultPatternLayerSnapshot(groupId: string, layerIndex: number): PatternLayerSnapshot {
  const layerId = `pl-local-${groupId}-${layerIndex}`;
  const objectId = `local-sobj-pattern-${groupId}-${layerIndex}`;
  const sourceObject: PatternSourceObjectSnapshot = {
    objectId,
    objectType: 'GenericScore',
    name: '',
    backgroundColor: 0x404040,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      patternSource: { groupId, layerId, sourceObjectId: objectId },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: { kind: 'generic', labelLines: [''], timeBehavior: 'NONE', repeatPointBeats: null },
  };
  return {
    layerId,
    name: '',
    height: 44,
    muted: false,
    solo: false,
    items: [],
    sourceObject,
    activeCellIndices: [],
  };
}

function createDefaultScoreLayerSnapshot(groupId: string, layerIndex: number): ScoreLayerSnapshot {
  return {
    layerId: `${groupId}-layer-${layerIndex}`,
    name: '',
    height: 44,
    muted: false,
    solo: false,
    items: [],
  };
}

function createAddedLayerGroupSnapshot(groupType: ScoreLayerGroupType | undefined): ScoreLayerGroupSnapshot {
  const timestamp = Date.now();
  const groupId = `lg-${timestamp}`;
  const layers = [createDefaultScoreLayerSnapshot(groupId, 0)];

  switch (groupType ?? 'track') {
    case 'track': {
      const trackId = `${groupId}-track-0`;
      return {
        groupId,
        groupType: 'track',
        name: 'Track Layer Group',
        defaultHeightIndex: 0,
        layerCount: 1,
        isOpenableContainer: false,
        layers: [{
          ...layers[0]!,
          layerId: trackId,
          layerKind: 'track',
          instrument: null,
        }],
      };
    }
    case 'patterns':
      return {
        groupId,
        groupType: 'patterns',
        name: 'Patterns Layer Group',
        layerCount: 1,
        isOpenableContainer: false,
        patternBeatsLength: 4,
        effectivePatternBeatsLength: 4,
        layers: [createDefaultPatternLayerSnapshot(groupId, 0)],
      };
    case 'polyObject':
    default:
      return {
        groupId,
        groupType: 'polyObject',
        name: 'SoundObject Layer Group',
        layerCount: layers.length,
        isOpenableContainer: true,
        layers,
      };
  }
}

function splitBarLabelLines(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [''];
}

function applySharedPropertiesToBarRenderer(
  barRenderer: ScoreRowObjectSnapshot['barRenderer'],
  patch: {
    name?: string;
    subjectiveDuration?: { value: number; timeBase: string };
  },
): ScoreRowObjectSnapshot['barRenderer'] {
  let nextBarRenderer = barRenderer;

  if (patch.name !== undefined) {
    nextBarRenderer = {
      ...nextBarRenderer,
      labelLines: splitBarLabelLines(patch.name),
    };
  }

  if (patch.subjectiveDuration !== undefined && nextBarRenderer.kind === 'frozenSoundObject') {
    nextBarRenderer = {
      ...nextBarRenderer,
      currentDurationBeats: patch.subjectiveDuration.value,
    };
  }

  return nextBarRenderer;
}

function applySoundObjectBehaviorToBarRenderer(
  barRenderer: ScoreRowObjectSnapshot['barRenderer'],
  patch: {
    timeBehavior?: string;
    repeatPoint?: { value: number; timeBase: string } | null;
  },
): ScoreRowObjectSnapshot['barRenderer'] {
  switch (barRenderer.kind) {
    case 'generic':
    case 'letter':
    case 'pianoRoll':
      return {
        ...barRenderer,
        ...(patch.timeBehavior !== undefined ? { timeBehavior: patch.timeBehavior } : {}),
        ...(patch.repeatPoint !== undefined
          ? { repeatPointBeats: patch.repeatPoint?.value ?? null }
          : {}),
      };
    default:
      return barRenderer;
  }
}

function createOptimisticBarRendererSnapshot(object: {
  name: string;
  objectType: string;
  serializedXml?: string;
  barRenderer?: ScoreRowObjectSnapshot['barRenderer'];
}): ScoreRowObjectSnapshot['barRenderer'] {
  if (object.barRenderer) {
    return object.barRenderer;
  }

  if (object.objectType === 'AudioClip') {
    return {
      kind: 'audioClip',
      labelLines: splitBarLabelLines(object.name),
      audioFilePath: '',
      waveformKey: null,
      fileStartTimeBeats: 0,
      audioDurationBeats: 0,
      looping: true,
      fadeInBeats: 0,
      fadeInType: 'LINEAR',
      fadeOutBeats: 0,
      fadeOutType: 'LINEAR',
    };
  }

  return {
    kind: 'fallback',
    labelLines: splitBarLabelLines(object.name),
    reason: 'unknown-type',
  };
}

function findAddScoreObjectsTargetGroupIndex(
  score: ScoreDocumentSnapshot,
  objects: Array<{ groupId: string; objectType: string }>,
): number {
  if (objects.length === 0) {
    return -1;
  }

  const groupId = objects[0].groupId;
  const allAudio = objects.every((object) => object.objectType === 'AudioClip');
  const allSoundObjects = objects.every((object) => object.objectType !== 'AudioClip');

  return score.layerGroups.findIndex((group) => (
    group.groupId === groupId
      && ((group.groupType === 'track' && (allAudio || allSoundObjects))
        || (group.groupType === 'polyObject' && allSoundObjects))
  ));
}

function getProjectPatchQueue(): ProjectPatchQueue {
  if (!projectPatchQueue) {
    projectPatchQueue = createProjectPatchQueue({
      commit: (patches) => window.blueAPI.commitProjectDocumentPatches([...patches]),
      fetchCanonicalSnapshot: () => window.blueAPI.getProjectDocument(),
      applyCanonicalSnapshot: (snapshot, preserveDirty) => applyProjectInfoToState(snapshot, preserveDirty),
      setDirty: (dirty) => storeSet({ isDirty: dirty }),
      reportBackgroundError: (error) => {
        toast.error(`Failed to save project changes: ${error instanceof Error ? error.message : String(error)}`);
      },
      logRefreshError: (error) => {
        console.error('[project-store] Failed to refresh canonical project state:', error);
      },
    });
  }
  return projectPatchQueue;
}

export function getProjectDocumentRevision(): number {
  return getProjectPatchQueue().getRevision();
}

export function acceptProjectDocumentRevision(sessionId: number, revision: number): void {
  getProjectPatchQueue().acceptRevision(sessionId, revision);
}

export const __testFlushPendingPatches = (): void => {
  void getProjectPatchQueue().flush().catch((error: unknown) => {
    toast.error(`Failed to save project changes: ${error instanceof Error ? error.message : String(error)}`);
  });
};

export const __testAwaitPendingPatches = async (): Promise<void> => {
  await getProjectPatchQueue().awaitPending();
};

export const __testClearPendingPatches = (): void => {
  getProjectPatchQueue().clearPending();
};

function resetTransientProjectMutationState(): void {
  getProjectPatchQueue().reset(0);
}

function buildRealtimeControlUpdate(
  patch: ProjectDocumentPatch,
): BsbRealtimeControlUpdate | undefined {
  if (!patch.orchestra || patch.orchestra.type !== 'updateInstrument') {
    return undefined;
  }

  const bsbPatch = patch.orchestra.patch.bsbInterface;
  if (!bsbPatch) {
    return undefined;
  }

  return createBsbRealtimeControlUpdate(
    { assignmentId: patch.orchestra.assignmentId },
    bsbPatch,
  );
}

function syncSummaryFromProperties(
  properties: ProjectPropertiesSnapshot,
): Pick<ProjectState, 'title' | 'author' | 'sampleRate'> {
  return {
    title: properties.title,
    author: properties.author,
    sampleRate: properties.sampleRate,
  };
}

function applyProjectInfoToState(
  info: ProjectLoadedPayload | null,
  preserveDirty: boolean,
): void {
  if (!info) {
    if (!preserveDirty) {
      resetTransientProjectMutationState();
      storeSet(buildInitialState());
      useMidiRoutingStore.getState().clearFocusForProjectSession();
      useLayerSelectionStore.getState().clear();
    }
    return;
  }

  let reconciliation: MidiRoutingReconciliation | undefined;
  storeSet((state: ProjectState) => {
    const incomingSessionId = info.sessionId ?? state.sessionId;
    if (incomingSessionId !== getProjectPatchQueue().getSessionId()) {
      getProjectPatchQueue().reset(incomingSessionId);
      useLayerSelectionStore.getState().clear();
    }

    const nextProjectProperties = info.projectProperties
      ? mergeProjectProperties(state.projectProperties, info.projectProperties)
      : state.projectProperties;
    const nextOrchestra = info.orchestra ?? state.orchestra;
    const nextScore = info.score ?? state.score;
    const nextTransport = info.transport
      ? {
          ...state.transport,
          ...info.transport,
          tempoMap: info.transport.tempoMap ?? state.transport.tempoMap,
        }
      : state.transport;
    const summary = info.projectProperties
      ? syncSummaryFromProperties(nextProjectProperties)
      : {
          title: state.title,
          author: state.author,
          sampleRate: state.sampleRate,
        };
      reconciliation = buildMidiRoutingReconciliation(
        nextScore,
        nextOrchestra,
        incomingSessionId,
      );

    return {
      ...state,
      title: info.title ?? summary.title,
      author: info.author ?? summary.author,
      sampleRate: info.sampleRate ?? summary.sampleRate,
      version: info.version ?? state.version,
      filePath: info.filePath ?? state.filePath,
      sessionId: incomingSessionId,
      loaded:
        info.loaded ??
        (info.filePath !== undefined
          ? info.filePath !== null
          : state.loaded || Boolean(info.globalOrc || info.globalSco || info.projectProperties)),
      isLoading: false,
      isDirty: preserveDirty ? state.isDirty : false,
      globalOrc: info.globalOrc ?? state.globalOrc,
      globalSco: info.globalSco ?? state.globalSco,
      orchestra: nextOrchestra,
      mixer: info.mixer
        ? info.mixer
        : info.orchestra
          ? reconcileMixerSnapshotWithArrangement(state.mixer, nextOrchestra)
          : state.mixer,
      projectProperties: nextProjectProperties,
      scratchPad: info.scratchPad
        ? { ...info.scratchPad }
        : state.scratchPad,
      clojureProject: info.clojureProject
        ? cloneClojureProjectSnapshot(info.clojureProject)
        : state.clojureProject,
      transport: nextTransport,
      tablesText: info.tablesText ?? state.tablesText,
      projectUdos: info.projectUdos ?? state.projectUdos,
      blueLive: info.blueLive ?? state.blueLive,
      midiInput: info.midiInput ?? state.midiInput,
      score: nextScore,
    };
  });
  if (reconciliation) {
    useMidiRoutingStore.getState().reconcileFocus(reconciliation);
  }
}

function buildMidiRoutingReconciliation(
  score: ScoreDocumentSnapshot,
  orchestra: OrchestraSnapshot,
  projectSessionId: number,
): MidiRoutingReconciliation {
  return {
    projectSessionId,
    tracks: score.layerGroups.flatMap((group) => (
      group.groupType === 'track'
        ? group.layers.map((layer) => ({
            projectSessionId,
            rootGroupId: group.groupId,
            trackId: layer.layerId,
            displayName: layer.name,
          }))
        : []
    )),
    orchestra: orchestra.arrangement.rows.map((row) => ({
      projectSessionId,
      assignmentId: row.assignmentId,
      displayName: row.instrumentName || '(unnamed)',
    })),
  };
}

function mergeProjectProperties(
  current: ProjectPropertiesSnapshot,
  patch: Partial<ProjectPropertiesSnapshot>,
): ProjectPropertiesSnapshot {
  return {
    ...current,
    ...patch,
  };
}

function cloneClojureProjectSnapshot(
  clojureProject: ClojureProjectSnapshot,
): ClojureProjectSnapshot {
  return {
    libraryEntries: clojureProject.libraryEntries.map((entry) => ({ ...entry })),
  };
}

function buildInitialState(): ProjectState {
  const snapshot = createEmptyProjectEditorSnapshot();
  return {
    title: snapshot.projectProperties.title,
    author: snapshot.projectProperties.author,
    sampleRate: snapshot.projectProperties.sampleRate,
    version: snapshot.version,
    filePath: snapshot.filePath,
    sessionId: snapshot.sessionId,
    isLoading: false,
    isDirty: false,
    lastScorePatch: null,
    loaded: snapshot.loaded,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: snapshot.orchestra,
    mixer: snapshot.mixer ?? createEmptyMixerSnapshot(),
    projectProperties: snapshot.projectProperties,
    scratchPad: snapshot.scratchPad ?? createEmptyScratchPadSnapshot(),
    clojureProject: snapshot.clojureProject,
    transport: snapshot.transport,
    tablesText: snapshot.tablesText,
    projectUdos: snapshot.projectUdos,
    generatedCsd: null,
    blueLive: snapshot.blueLive ?? null,
    midiInput: snapshot.midiInput ?? null,
    score: snapshot.score ?? createEmptyScoreDocumentSnapshot(),
    scrollToBeatTarget: null,
    audioClipEditorPreviewByObjectId: {},
    missingAudioSession: null,
  };
}

function cloneInstrumentSnapshot(instrument: InstrumentSnapshot): InstrumentSnapshot {
  return structuredClone(instrument);
}

function applyProjectUdoPatchToSnapshot(
  udos: UdoDefinitionSnapshot[],
  patch: ProjectUdoPatch,
): UdoDefinitionSnapshot[] {
  const list = udos.map((udo) => cloneUdoSnapshot(udo));

  switch (patch.type) {
    case 'add': {
      const def = patch.definition ?? EMPTY_UDO_SNAPSHOT;
      const index = patch.index ?? list.length;
      list.splice(index, 0, cloneUdoSnapshot(def));
      break;
    }
    case 'remove': {
      if (patch.index >= 0 && patch.index < list.length) {
        list.splice(patch.index, 1);
      }
      break;
    }
    case 'update': {
      if (patch.index >= 0 && patch.index < list.length) {
        list[patch.index] = { ...list[patch.index], ...patch.patch };
      }
      break;
    }
    case 'reorder': {
      if (
        patch.from >= 0 && patch.from < list.length &&
        patch.to >= 0 && patch.to < list.length &&
        patch.from !== patch.to
      ) {
        const [moved] = list.splice(patch.from, 1);
        list.splice(patch.to, 0, moved);
      }
      break;
    }
    case 'convertStyle': {
      if (patch.index >= 0 && patch.index < list.length) {
        list[patch.index] = convertUdoSnapshotStyle(list[patch.index]!, patch.style);
      }
      break;
    }
  }

  return list;
}

function applyTempoMapPatchToSnapshot(
  snap: import('../../../shared/project-editor').TempoMapSnapshot,
  patch: import('../../../shared/project-editor').TempoMapPatch,
): import('../../../shared/project-editor').TempoMapSnapshot {
  switch (patch.type) {
    case 'setTempoEnabled':
      return { ...snap, enabled: patch.enabled };
    case 'setTempoVisible':
      return { ...snap, visible: patch.visible };
    case 'addTempoPoint': {
      if (!isFinite(patch.point.beat) || patch.point.beat < 0) return snap;
      if (!isFinite(patch.point.tempo) || patch.point.tempo <= 0) return snap;
      for (const ep of snap.points) {
        if (Math.abs(ep.beat - patch.point.beat) < 0.001) return snap;
      }
      return { ...snap, points: [...snap.points, { ...patch.point }].sort((a, b) => a.beat - b.beat) };
    }
    case 'updateTempoPoint': {
      const idx = patch.index;
      if (idx < 0 || idx >= snap.points.length) return snap;
      const current = snap.points[idx];
      const newBeat = patch.patch.beat ?? current.beat;
      const newTempo = patch.patch.tempo ?? current.tempo;
      const newCurve = patch.patch.curveType ?? current.curveType;
      if (idx === 0 && newBeat !== 0) return snap;
      if (!isFinite(newTempo) || newTempo <= 0) return snap;
      if (idx > 0 && newBeat <= snap.points[idx - 1].beat) return snap;
      if (idx < snap.points.length - 1 && newBeat >= snap.points[idx + 1].beat) return snap;
      const newPoints = [...snap.points];
      newPoints[idx] = { ...current, beat: newBeat, tempo: newTempo, curveType: newCurve };
      return { ...snap, points: newPoints };
    }
    case 'setTempoCurveType': {
      const idx = patch.index;
      if (idx < 0 || idx >= snap.points.length) return snap;
      if (snap.points[idx].curveType === patch.curveType) return snap;
      const newPoints = [...snap.points];
      newPoints[idx] = { ...newPoints[idx], curveType: patch.curveType };
      return { ...snap, points: newPoints };
    }
    case 'removeTempoPoint': {
      if (patch.index <= 0 || patch.index >= snap.points.length || snap.points.length <= 1) return snap;
      return { ...snap, points: snap.points.filter((_, i) => i !== patch.index) };
    }
    case 'replaceTempoMap': {
      return { ...patch.map };
    }
    default:
      return snap;
  }
}

function recomputeMeterStartBeats(entries: import('../../../shared/project-editor').MeterSnapshot[]): import('../../../shared/project-editor').MeterSnapshot[] {
  const result: import('../../../shared/project-editor').MeterSnapshot[] = [];
  let accumulated = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    result.push({ ...e, startBeat: accumulated });
    if (i < entries.length - 1) {
      const beatsPerMeasure = e.numBeats * (4.0 / e.beatLength);
      accumulated += (entries[i + 1].measure - e.measure) * beatsPerMeasure;
    }
  }
  return result;
}

function applyMeterMapPatchToSnapshot(
  snap: import('../../../shared/project-editor').MeterMapSnapshot,
  patch: import('../../../shared/project-editor').MeterMapPatch,
): import('../../../shared/project-editor').MeterMapSnapshot {
  switch (patch.type) {
    case 'meter-map-set-entry': {
      const existing = snap.entries.findIndex((e) => e.measure === patch.measure);
      if (existing >= 0) {
        const newEntries = [...snap.entries];
        newEntries[existing] = { ...newEntries[existing], numBeats: patch.numBeats, beatLength: patch.beatLength };
        return { entries: recomputeMeterStartBeats(newEntries) };
      }
      const newEntries = [...snap.entries, { measure: patch.measure, numBeats: patch.numBeats, beatLength: patch.beatLength, startBeat: 0 }];
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-update-entry': {
      const idx = snap.entries.findIndex((e) => e.measure === patch.previousMeasure);
      if (idx < 0) return snap;
      if (idx === 0 && patch.measure !== 1) return snap;
      if (idx > 0 && patch.measure <= snap.entries[idx - 1].measure) return snap;
      if (idx < snap.entries.length - 1 && patch.measure >= snap.entries[idx + 1].measure) return snap;
      const newEntries = [...snap.entries];
      newEntries[idx] = { measure: patch.measure, numBeats: patch.numBeats, beatLength: patch.beatLength, startBeat: 0 };
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-remove-entry': {
      if (patch.measure <= 1) return snap;
      const idx = snap.entries.findIndex((e) => e.measure === patch.measure);
      if (idx <= 0 || snap.entries.length <= 1) return snap;
      const newEntries = snap.entries.filter((_, i) => i !== idx);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-replace': {
      const newEntries = patch.entries.map((e) => ({
        measure: e.measure,
        numBeats: e.numBeats,
        beatLength: e.beatLength,
        startBeat: 0,
      }));
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    default:
      return snap;
  }
}

function applyBlueLivePatchToSnapshot(
  snap: BlueLiveProjectSnapshot,
  patch: BlueLivePatch,
): BlueLiveProjectSnapshot {
  const next = {
    ...snap,
    bins: {
      ...snap.bins,
      cells: snap.bins.cells.map((col) => [...col]),
    },
    sets: snap.sets.map((set) => ({
      ...set,
      liveObjectIds: [...set.liveObjectIds],
    })),
  };

  switch (patch.type) {
    case 'updateOptions':
      if (patch.patch.commandLine !== undefined) next.commandLine = patch.patch.commandLine;
      if (patch.patch.commandLineEnabled !== undefined) next.commandLineEnabled = patch.patch.commandLineEnabled;
      if (patch.patch.commandLineOverride !== undefined) next.commandLineOverride = patch.patch.commandLineOverride;
      break;
    case 'updateTempoRepeat':
      if (patch.patch.tempo !== undefined) next.tempo = patch.patch.tempo;
      if (patch.patch.repeat !== undefined) next.repeat = patch.patch.repeat;
      if (patch.patch.repeatEnabled !== undefined) next.repeatEnabled = patch.patch.repeatEnabled;
      break;
    case 'updateLiveCodeText':
      next.liveCodeText = patch.text;
      break;
    case 'setCellEnabled':
      if (
        patch.column >= 0 &&
        patch.column < next.bins.cells.length &&
        patch.row >= 0 &&
        patch.row < next.bins.cells[patch.column]!.length
      ) {
        const cell = next.bins.cells[patch.column]![patch.row];
        if (cell) {
          next.bins.cells[patch.column]![patch.row] = { ...cell, enabled: patch.enabled };
        }
      }
      break;
    case 'setCell':
      if (
        patch.column >= 0
        && patch.column < next.bins.cells.length
        && patch.row >= 0
        && patch.row < next.bins.cells[patch.column]!.length
      ) {
        next.bins.cells[patch.column]![patch.row] = patch.cell
          ? { ...patch.cell }
          : null;
      }
      break;
    case 'insertRow':
      {
        const insertIndex = Math.min(Math.max(patch.index, 0), next.bins.rows);
        next.bins = {
          ...next.bins,
          rows: next.bins.rows + 1,
          cells: next.bins.cells.map((col) => {
            const nextCol = [...col];
            nextCol.splice(insertIndex, 0, null);
            return nextCol;
          }),
        };
      }
      break;
    case 'removeRow':
      if (next.bins.rows <= 1 || patch.index < 0 || patch.index >= next.bins.rows) {
        break;
      }
      next.bins = {
        ...next.bins,
        rows: next.bins.rows - 1,
        cells: next.bins.cells.map((col) => {
          const nextCol = [...col];
          nextCol.splice(patch.index, 1);
          return nextCol;
        }),
      };
      break;
    case 'insertColumn':
      {
        const insertIndex = Math.min(Math.max(patch.index, 0), next.bins.cells.length);
        const cells = [...next.bins.cells];
        cells.splice(insertIndex, 0, Array.from({ length: next.bins.rows }, () => null));
        next.bins = { ...next.bins, columns: next.bins.columns + 1, cells };
      }
      break;
    case 'removeColumn':
      if (next.bins.columns <= 1 || patch.index < 0 || patch.index >= next.bins.cells.length) {
        break;
      }
      {
        const cells = [...next.bins.cells];
        cells.splice(patch.index, 1);
        next.bins = { ...next.bins, columns: next.bins.columns - 1, cells };
      }
      break;
    case 'captureEnabledSet':
      next.sets = [
        ...next.sets,
        {
          name: `Set ${next.sets.length + 1}`,
          liveObjectIds: next.bins.cells
            .flatMap((col) => col)
            .filter((cell): cell is NonNullable<typeof cell> => cell !== null && cell.enabled)
            .map((cell) => cell.uniqueId),
        },
      ];
      break;
    case 'renameSet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        next.sets = next.sets.map((s, i) => i === patch.index ? { ...s, name: patch.name } : s);
      }
      break;
    case 'removeSet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        next.sets = next.sets.filter((_, i) => i !== patch.index);
      }
      break;
    case 'moveSet':
      if (patch.from >= 0 && patch.from < next.sets.length && patch.to >= 0 && patch.to < next.sets.length) {
        const sets = [...next.sets];
        const [moved] = sets.splice(patch.from, 1);
        sets.splice(patch.to, 0, moved);
        next.sets = sets;
      }
      break;
    case 'applySet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        const enabledIds = new Set(next.sets[patch.index]!.liveObjectIds);
        next.bins = {
          ...next.bins,
          cells: next.bins.cells.map((col) =>
            col.map((cell) => (cell ? { ...cell, enabled: enabledIds.has(cell.uniqueId) } : cell)),
          ),
        };
      }
      break;
  }

  return next;
}

function cloneMixerSnapshot(mixer: MixerSnapshot): MixerSnapshot {
  return structuredClone(mixer);
}

function generateUniqueSubChannelName(existingNames: ReadonlySet<string>): string {
  let index = existingNames.size + 1;
  while (true) {
    const name = `SubChannel${index}`;
    if (!existingNames.has(name)) {
      return name;
    }
    index++;
  }
}

function getMixerSourceChannels(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  const groupedChannels = mixer.channelListGroups.flatMap((group) => group.channels);
  return [...groupedChannels, ...mixer.channels];
}

function findMixerChannelSnapshotById(
  mixer: MixerSnapshot,
  channelId: string,
): MixerChannelSnapshot | null {
  if (channelId === 'master') {
    return mixer.master;
  }

  const source = getMixerSourceChannels(mixer).find((channel) => channel.id === channelId);
  if (source) {
    return source;
  }

  return mixer.subChannels.find((channel) => channel.id === channelId) ?? null;
}

function reconcileSubChannelNameInSnapshot(mixer: MixerSnapshot, oldName: string, newName: string): void {
  const allChannels = [...getMixerSourceChannels(mixer), ...mixer.subChannels, mixer.master];

  for (const channel of allChannels) {
    if (channel.outChannel === oldName) {
      channel.outChannel = newName;
    }

    for (const entry of [...channel.preChain, ...channel.postChain]) {
      if (entry.kind === 'send' && entry.sendChannel === oldName) {
        entry.sendChannel = newName;
      }
    }
  }
}

function reconcileSubChannelRemovedInSnapshot(mixer: MixerSnapshot, removedName: string): void {
  const allChannels = [...getMixerSourceChannels(mixer), ...mixer.subChannels, mixer.master];

  for (const channel of allChannels) {
    if (channel.outChannel === removedName) {
      channel.outChannel = 'Master';
    }

    for (const entry of [...channel.preChain, ...channel.postChain]) {
      if (entry.kind === 'send' && entry.sendChannel === removedName) {
        entry.sendChannel = 'Master';
      }
    }
  }
}

function findMixerChainEntrySnapshot(
  channel: MixerChannelSnapshot,
  chain: 'pre' | 'post',
  entryId: string,
): { chain: MixerChainEntrySnapshot[]; index: number; entry: MixerChainEntrySnapshot | null } {
  const entries = chain === 'pre' ? channel.preChain : channel.postChain;
  const index = entries.findIndex((entry) => entry.entryId === entryId);
  return {
    chain: entries,
    index,
    entry: index >= 0 ? entries[index] ?? null : null,
  };
}

function createEffectEntrySnapshotFromXml(
  effectXml: string,
  entryId: string,
  refs?: { projectRef?: { channelId: string; chain: 'pre' | 'post'; entryId: string } },
): MixerEffectEntrySnapshot {
  const effect = Effect.loadFromXML(Element.parse(effectXml));
  return createMixerEffectEntrySnapshot(effect, entryId, refs);
}

function applyChannelChainMutation(
  mixer: MixerSnapshot,
  channel: MixerChannelSnapshot,
  preChain: MixerChainEntrySnapshot[],
  postChain: MixerChainEntrySnapshot[],
): void {
  const updated = {
    ...channel,
    preChain,
    postChain,
  };

  if (channel.id === mixer.master.id) {
    (mixer as { master: MixerChannelSnapshot }).master = updated;
  } else {
    const groupIndex = mixer.channelListGroups.findIndex((group) =>
      group.channels.some((candidate) => candidate.id === channel.id),
    );
    if (groupIndex >= 0) {
      const group = mixer.channelListGroups[groupIndex]!;
      const nextGroup = {
        ...group,
        channels: group.channels.map((candidate) =>
          candidate.id === channel.id ? updated : candidate,
        ),
      };
      mixer.channelListGroups[groupIndex] = nextGroup;
      return;
    }

    const idx = mixer.channels.findIndex((c) => c.id === channel.id);
    if (idx >= 0) {
      mixer.channels[idx] = updated;
      return;
    }
    const subIdx = mixer.subChannels.findIndex((c) => c.id === channel.id);
    if (subIdx >= 0) {
      mixer.subChannels[subIdx] = updated;
    }
  }
}

function applyMixerPatchToSnapshot(
  mixer: MixerSnapshot,
  orchestra: OrchestraSnapshot,
  patch: MixerPatch,
): MixerSnapshot {
  const next = cloneMixerSnapshot(mixer);

  switch (patch.type) {
    case 'setMixerEnabled':
      next.enabled = patch.value;
      break;
    case 'updateExtraRenderTime':
      next.extraRenderTime = patch.value;
      break;
    case 'renameChannelListGroup': {
      const targetAssociation = patch.association.trim();
      const nextName = patch.name.trim();
      if (targetAssociation.length === 0 || nextName.length === 0) {
        break;
      }

      next.channelListGroups = next.channelListGroups.map((group) =>
        (group.association?.trim() ?? '') === targetAssociation
          ? { ...group, listName: nextName }
          : group,
      );
      break;
    }
    case 'updateChannel': {
      const channel =
        getMixerSourceChannels(next).find((candidate) => candidate.id === patch.channelId) ??
        next.subChannels.find((candidate) => candidate.id === patch.channelId) ??
        (next.master.id === patch.channelId ? next.master : null);
      if (!channel) {
        break;
      }

      const isSubChannel = next.subChannels.some((sc) => sc.id === channel.id);
      if (isSubChannel && patch.patch.name !== undefined && patch.patch.name !== channel.name) {
        reconcileSubChannelNameInSnapshot(next, channel.name, patch.patch.name);
      }

      next.channelListGroups = next.channelListGroups.map((group) => ({
        ...group,
        channels: group.channels.map((candidate) =>
          candidate.id === channel.id ? { ...candidate, ...patch.patch } : candidate,
        ),
      }));
      next.channels = next.channels.map((candidate) =>
        candidate.id === channel.id ? { ...candidate, ...patch.patch } : candidate,
      );
      next.subChannels = next.subChannels.map((candidate) =>
        candidate.id === channel.id ? { ...candidate, ...patch.patch } : candidate,
      );
      if (next.master.id === channel.id) {
        next.master = { ...next.master, ...patch.patch };
      }
      break;
    }
    case 'addSubChannel': {
      const newId = patch.channelId ?? crypto.randomUUID();
      const insertIndex = patch.insertIndex ?? next.subChannels.length;
      const existingNames = new Set(next.subChannels.map((ch) => ch.name));
      const defaultName = generateUniqueSubChannelName(existingNames);
      const nextSubChannel: MixerChannelSnapshot = {
        id: newId,
        name: patch.name ?? defaultName,
        channelKind: 'subChannel',
        outChannel: 'Master',
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      };
      const subChannels = [...next.subChannels];
      subChannels.splice(Math.min(Math.max(insertIndex, 0), subChannels.length), 0, nextSubChannel);
      next.subChannels = subChannels;
      break;
    }
    case 'removeSubChannel': {
      const removed = next.subChannels.find((sc) => sc.id === patch.channelId);
      if (removed) {
        reconcileSubChannelRemovedInSnapshot(next, removed.name);
      }
      next.subChannels = next.subChannels.filter((channel) => channel.id !== patch.channelId);
      break;
    }
    case 'addEffectFromLibrary':
    case 'addSend':
    case 'updateSend':
    case 'updateEffect':
    case 'removeChainEntry':
    case 'reorderChainEntry':
    case 'duplicateChainEntry':
    case 'copyChainEntry':
    case 'pasteChainEntries': {
      const channel = findMixerChannelSnapshotById(next, patch.channelId);
      if (!channel) {
        break;
      }

      const updateChain = (
        entries: MixerChainEntrySnapshot[],
        chainKind: 'pre' | 'post',
      ): MixerChainEntrySnapshot[] => {
        if (chainKind !== patch.chain) {
          return entries;
        }

        switch (patch.type) {
          case 'addEffectFromLibrary': {
            const entryId = patch.entryId ?? crypto.randomUUID();
            const nextEntries = [...entries];
            const effectXml = patch.effectXml ?? new Effect().saveAsXML().toXml();
            nextEntries.splice(
              Math.min(Math.max(patch.insertIndex ?? nextEntries.length, 0), nextEntries.length),
              0,
              createEffectEntrySnapshotFromXml(effectXml, entryId, {
                projectRef: {
                  channelId: patch.channelId,
                  chain: patch.chain,
                  entryId,
                },
              }),
            );
            return nextEntries;
          }
          case 'addSend': {
            const entryId = patch.entryId ?? crypto.randomUUID();
            const nextEntries = [...entries];
            nextEntries.splice(
              Math.min(Math.max(patch.insertIndex ?? nextEntries.length, 0), nextEntries.length),
              0,
              {
                entryId,
                kind: 'send',
                sendChannel: patch.sendChannel ?? 'Master',
                level: patch.level ?? 1,
                enabled: true,
              },
            );
            return nextEntries;
          }
          case 'updateSend':
            return entries.map((entry) =>
              entry.entryId === patch.entryId && entry.kind === 'send'
                ? {
                    ...entry,
                    ...(patch.patch.sendChannel !== undefined ? { sendChannel: patch.patch.sendChannel } : null),
                    ...(patch.patch.level !== undefined ? { level: patch.patch.level } : null),
                    ...(patch.patch.enabled !== undefined ? { enabled: patch.patch.enabled } : null),
                  }
                : entry,
            );
          case 'updateEffect':
            return entries.map((entry) => {
              if (entry.entryId !== patch.entryId || entry.kind !== 'effect') {
                return entry;
              }

              if (patch.patch.effectXml !== undefined) {
                return createEffectEntrySnapshotFromXml(patch.patch.effectXml, patch.entryId, {
                  projectRef: {
                    channelId: patch.channelId,
                    chain: patch.chain,
                    entryId: patch.entryId,
                  },
                });
              }

              const nextEntry = { ...entry };
              if (patch.patch.name !== undefined) nextEntry.name = patch.patch.name;
              if (patch.patch.enabled !== undefined) nextEntry.enabled = patch.patch.enabled;
              if (patch.patch.numIns !== undefined) nextEntry.numIns = patch.patch.numIns;
              if (patch.patch.numOuts !== undefined) nextEntry.numOuts = patch.patch.numOuts;
              if (patch.patch.style !== undefined) nextEntry.style = patch.patch.style;
              if (patch.patch.code !== undefined) nextEntry.code = patch.patch.code;
              if (patch.patch.comments !== undefined) nextEntry.comments = patch.patch.comments;
              return nextEntry;
            });
          case 'removeChainEntry':
            return entries.filter((entry) => entry.entryId !== patch.entryId);
          case 'reorderChainEntry': {
            const nextEntries = [...entries];
            if (
              patch.from < 0 ||
              patch.to < 0 ||
              patch.from >= nextEntries.length ||
              patch.to >= nextEntries.length ||
              patch.from === patch.to
            ) {
              return nextEntries;
            }
            const [moved] = nextEntries.splice(patch.from, 1);
            nextEntries.splice(patch.to, 0, moved);
            return nextEntries;
          }
          case 'duplicateChainEntry': {
            const dupIndex = entries.findIndex((e) => e.entryId === patch.entryId);
            if (dupIndex < 0) return entries;
            const original = entries[dupIndex];
            const nextEntries = [...entries];
            const clone: MixerChainEntrySnapshot =
              original.kind === 'effect'
                ? createEffectEntrySnapshotFromXml(original.effectXml, crypto.randomUUID(), {
                    projectRef: { channelId: patch.channelId, chain: patch.chain, entryId: crypto.randomUUID() },
                  })
                : {
                    ...original,
                    entryId: crypto.randomUUID(),
                  };
            nextEntries.splice(dupIndex + 1, 0, clone);
            return nextEntries;
          }
          case 'copyChainEntry':
            return entries;
          case 'pasteChainEntries': {
            const nextEntries = [...entries];
            const insertIndex = patch.index ?? nextEntries.length;
            for (let i = 0; i < patch.payload.entries.length; i++) {
              const entry = patch.payload.entries[i];
              const pasted: MixerChainEntrySnapshot =
                entry.kind === 'effect'
                  ? createEffectEntrySnapshotFromXml(entry.effectXml, entry.entryId + '-paste-' + i, {
                      projectRef: { channelId: patch.channelId, chain: patch.chain, entryId: entry.entryId + '-paste-' + i },
                    })
                  : { ...entry, entryId: entry.entryId + '-paste-' + i };
              nextEntries.splice(Math.min(insertIndex + i, nextEntries.length), 0, pasted);
            }
            return nextEntries;
          }
          case 'moveChainEntryAcrossChains':
            return entries;
          default:
            return entries;
        }
      };

      if (channel.id === next.master.id) {
        next.master = {
          ...next.master,
          preChain: updateChain(next.master.preChain, 'pre'),
          postChain: updateChain(next.master.postChain, 'post'),
        };
      } else {
        const nextPreChain = updateChain(channel.preChain, 'pre');
        const nextPostChain = updateChain(channel.postChain, 'post');
        applyChannelChainMutation(
          next,
          channel,
          nextPreChain,
          nextPostChain,
        );
      }
      break;
    }
    case 'moveChainEntryAcrossChains': {
      const fromChannel = findMixerChannelSnapshotById(next, patch.fromChannelId);
      const toChannel = findMixerChannelSnapshotById(next, patch.toChannelId);
      if (!fromChannel || !toChannel) break;

      const fromEntries = patch.fromChain === 'pre' ? fromChannel.preChain : fromChannel.postChain;
      const fromIndex = fromEntries.findIndex((e) => e.entryId === patch.entryId);
      if (fromIndex < 0) break;

      const [removed] = fromEntries.splice(fromIndex, 1);
      const toEntries = patch.toChain === 'pre' ? toChannel.preChain : toChannel.postChain;
      const insertIndex = patch.index ?? toEntries.length;
      toEntries.splice(Math.min(insertIndex, toEntries.length), 0, removed);

      applyChannelChainMutation(next, fromChannel, [...fromChannel.preChain], [...fromChannel.postChain]);
      applyChannelChainMutation(next, toChannel, [...toChannel.preChain], [...toChannel.postChain]);
      break;
    }
  }

  return next;
}

interface TrackSnapshotLocation {
  groupId: string;
  layerIndex: number;
  layerId: string;
}

function collectTrackSnapshotLocations(
  score: ScoreDocumentSnapshot,
): TrackSnapshotLocation[] {
  const result: TrackSnapshotLocation[] = [];

  for (const group of score.layerGroups) {
    if (group.groupType !== 'track') {
      continue;
    }

    group.layers.forEach((layer, layerIndex) => {
      result.push({
        groupId: group.groupId,
        layerIndex,
        layerId: layer.layerId,
      });
    });
  }

  return result;
}

function applyTrackRenameToMixerSnapshot(
  mixer: MixerSnapshot,
  score: ScoreDocumentSnapshot,
  patch: Extract<ScorePatch, { type: 'renameLayer' }>,
): MixerSnapshot {
  const tracks = collectTrackSnapshotLocations(score);
  const targetLayer = tracks.find(
    (layer) => layer.groupId === patch.groupId && layer.layerIndex === patch.layerIndex,
  );
  if (!targetLayer) {
    return mixer;
  }

  let changed = false;
  const nextChannelListGroups = mixer.channelListGroups.map((group) => {
    const nextGroupChannels = group.channels.map((channel) => {
      if (channel.association !== targetLayer.layerId || channel.name === patch.name) {
        return channel;
      }
      changed = true;
      return { ...channel, name: patch.name };
    });
    return nextGroupChannels === group.channels ? group : { ...group, channels: nextGroupChannels };
  });
  const nextChannels = mixer.channels.map((channel) => {
    if (channel.association !== targetLayer.layerId || channel.name === patch.name) {
      return channel;
    }
    changed = true;
    return { ...channel, name: patch.name };
  });

  return changed ? { ...mixer, channelListGroups: nextChannelListGroups, channels: nextChannels } : mixer;
}

function applyMixerChannelRenameToTrackSnapshot(
  score: ScoreDocumentSnapshot,
  mixer: MixerSnapshot,
  patch: Extract<MixerPatch, { type: 'updateChannel' }>,
): ScoreDocumentSnapshot {
  if (patch.patch.name === undefined) {
    return score;
  }

  const trackLocations = collectTrackSnapshotLocations(score);
  const trackIds = new Set(trackLocations.map((layer) => layer.layerId));
  const targetChannel = getMixerSourceChannels(mixer).find((channel) => channel.id === patch.channelId);
  const targetAssociation = targetChannel?.association;
  if (!targetAssociation || !trackIds.has(targetAssociation)) {
    return score;
  }

  const targetLayer = trackLocations.find((layer) => layer.layerId === targetAssociation);
  if (!targetLayer) {
    return score;
  }

  let changed = false;
  const nextLayerGroups = score.layerGroups.map((group) => {
    if (group.groupId !== targetLayer.groupId) {
      return group;
    }

    const nextLayers = group.layers.map((layer, layerIndex) => {
      if (layerIndex !== targetLayer.layerIndex || layer.name === patch.patch.name) {
        return layer;
      }

      changed = true;
      return { ...layer, name: patch.patch.name! };
    });

    return changed ? { ...group, layers: nextLayers } : group;
  });

  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}

function computeEndOfScore(score: ScoreDocumentSnapshot): number {
  let maxBeat = 0;
  for (const lg of score.layerGroups) {
    for (const layer of lg.layers) {
      for (const item of layer.items) {
        maxBeat = Math.max(maxBeat, item.startBeats + item.durationBeats);
      }
    }
  }
  return maxBeat;
}

function createDefaultMidiInputSnapshot(): MidiInputProcessorSnapshot {
  return {
    keyMapping: 'PCH',
    velocityMapping: 'MIDI',
    pitchConstant: '',
    ampConstant: '',
    scale: null,
  };
}

function applyMidiInputPatchToSnapshot(
  snap: MidiInputProcessorSnapshot,
  patch: MidiInputPatch,
): MidiInputProcessorSnapshot {
  const next = structuredClone(snap);

  switch (patch.type) {
    case 'updateKeyMapping':
      next.keyMapping = patch.value;
      break;
    case 'updateVelocityMapping':
      next.velocityMapping = patch.value;
      break;
    case 'updatePitchConstant':
      next.pitchConstant = patch.value;
      break;
    case 'updateAmpConstant':
      next.ampConstant = patch.value;
      break;
    case 'updateScale':
      next.scale = patch.scale ? structuredClone(patch.scale) : null;
      break;
  }

  return next;
}

function sameScoreObjectLocation(
  a: ScoreObjectLocationRef | undefined,
  b: ScoreObjectLocationRef | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.rootGroupIndex !== b.rootGroupIndex) return false;
  if (a.layerIndex !== b.layerIndex || a.objectIndex !== b.objectIndex) return false;
  if (a.containerPath.length !== b.containerPath.length) return false;
  for (let i = 0; i < a.containerPath.length; i++) {
    const segA = a.containerPath[i];
    const segB = b.containerPath[i];
    if (segA.layerIndex !== segB.layerIndex || segA.objectIndex !== segB.objectIndex) return false;
  }
  return true;
}

function isScoreItemMatchingTarget(
  item: ScoreLayerSnapshot['items'][number],
  target: ScoreObjectEditorTargetSnapshot,
): boolean {
  if (target.ownerKind === 'blueLive') return false;
  const itemTarget = item.editorTarget;
  if (!itemTarget) return false;

  if (target.location && sameScoreObjectLocation(itemTarget.location, target.location)) {
    return true;
  }
  if (
    target.sourceInstanceLocation
    && sameScoreObjectLocation(itemTarget.sourceInstanceLocation, target.sourceInstanceLocation)
  ) {
    return true;
  }

  return item.objectId === target.selectionId;
}

function updateScoreItemLocation(
  item: ScoreLayerSnapshot['items'][number],
  rootGroupIndex: number,
  layerIndex: number,
  objectIndex: number,
): ScoreLayerSnapshot['items'][number] {
  if (!item.editorTarget?.location) {
    return item;
  }

  return {
    ...item,
    editorTarget: {
      ...item.editorTarget,
      location: {
        ...item.editorTarget.location,
        rootGroupIndex,
        layerIndex,
        objectIndex,
      },
    },
  };
}

function applyMoveScoreObjectsToSnapshot(
  score: ScoreDocumentSnapshot,
  moves: Array<{ objectId: string; targetStartBeats: number; targetLayerIndex?: number; targetGroupId?: string }>,
): ScoreDocumentSnapshot {
  const moveMap = new Map(moves.map((move) => [move.objectId, move]));
  const movedIds = new Set(moves.map((move) => move.objectId));

  const additionsByGroupAndLayer = new Map<string, Map<number, Array<ScoreLayerSnapshot['items'][number]>>>();

  for (const lg of score.layerGroups) {
    for (let li = 0; li < lg.layers.length; li++) {
      for (const item of lg.layers[li].items) {
        const move = moveMap.get(item.objectId);
        if (!move) continue;

        const targetGroupId = move.targetGroupId ?? lg.groupId;
        const targetLi = move.targetLayerIndex ?? li;
        let groupMap = additionsByGroupAndLayer.get(targetGroupId);
        if (!groupMap) {
          groupMap = new Map();
          additionsByGroupAndLayer.set(targetGroupId, groupMap);
        }

        let list = groupMap.get(targetLi);
        if (!list) {
          list = [];
          groupMap.set(targetLi, list);
        }

        list.push({
          ...item,
          startBeats: Math.max(0, move.targetStartBeats),
        });
      }
    }
  }

  const newGroups = score.layerGroups.map((lg, groupIndex) => {
    const groupAdditions = additionsByGroupAndLayer.get(lg.groupId);
    const newLayers = lg.layers.map((layer, li) => {
      const kept = layer.items.filter((item) => !movedIds.has(item.objectId));
      const additions = groupAdditions?.get(li) ?? [];
      return {
        ...layer,
        items: [
          ...kept,
          ...additions.map((item, idx) => updateScoreItemLocation(item, groupIndex, li, kept.length + idx)),
        ],
      };
    });
    return { ...lg, layers: newLayers };
  });

  return { ...score, layerGroups: newGroups };
}

function cloneVisibleNoteProcessorChain(
  chain: NoteProcessorChainSnapshot | null,
): NoteProcessorChainSnapshot | undefined {
  if (!chain || chain.processors.length === 0) {
    return undefined;
  }
  return cloneSnapshotValue(chain);
}

function applyPatternCellsToLayer(layer: PatternLayerSnapshot, cellIndex: number, active: boolean): PatternLayerSnapshot {
  const has = layer.activeCellIndices.includes(cellIndex);
  if (active === has) return layer;
  if (active) {
    const next = [...layer.activeCellIndices, cellIndex];
    next.sort((a, b) => a - b);
    return { ...layer, activeCellIndices: next };
  }
  return { ...layer, activeCellIndices: layer.activeCellIndices.filter((index) => index !== cellIndex) };
}

/**
 * Optimistic projection for the canonical pattern patch family. Cell writes
 * apply immutably per row (unknown rows are skipped; the canonical snapshot
 * corrects them), and step-length writes update both raw and effective values.
 */
function applyPatternPatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: PatternScorePatch,
): ScoreDocumentSnapshot {
  if (patch.type === 'updatePatternBeatsLength') {
    const length = patch.patternBeatsLength;
    if (!Number.isInteger(length) || length <= 0) return score;
    const nextLayerGroups = score.layerGroups.map((lg) => (
      lg.groupType === 'patterns' && lg.groupId === patch.groupId && lg.patternBeatsLength !== length
        ? { ...lg, patternBeatsLength: length, effectivePatternBeatsLength: length }
        : lg
    ));
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.changes.length === 0) return score;
  let changed = false;
  const nextLayerGroups = score.layerGroups.map((lg) => {
    if (lg.groupType !== 'patterns' || lg.groupId !== patch.groupId) return lg;
    let layers = lg.layers;
    let groupChanged = false;
    for (const change of patch.changes) {
      if (!Number.isInteger(change.cellIndex) || change.cellIndex < 0) continue;
      const layerIndex = layers.findIndex((layer) => layer.layerId === change.layerId);
      if (layerIndex < 0) continue;
      const nextLayer = applyPatternCellsToLayer(layers[layerIndex]!, change.cellIndex, change.active);
      if (nextLayer === layers[layerIndex]) continue;
      layers = [...layers];
      layers[layerIndex] = nextLayer;
      groupChanged = true;
    }
    if (!groupChanged) return lg;
    changed = true;
    return { ...lg, layers };
  });
  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}

function applyPatternSourceSharedProperties(
  score: ScoreDocumentSnapshot,
  target: ScoreObjectEditorTargetSnapshot,
  patch: { name?: string; backgroundColor?: number },
): ScoreDocumentSnapshot {
  const ref = target.patternSource!;
  let changed = false;
  const nextLayerGroups = score.layerGroups.map((lg) => {
    if (lg.groupType !== 'patterns' || lg.groupId !== ref.groupId) return lg;
    const layers = lg.layers.map((layer) => {
      if (layer.layerId !== ref.layerId || layer.sourceObject.objectId !== ref.sourceObjectId) return layer;
      let sourceObject = layer.sourceObject;
      if (patch.name !== undefined && sourceObject.name !== patch.name) {
        sourceObject = {
          ...sourceObject,
          name: patch.name,
          barRenderer: { ...sourceObject.barRenderer, labelLines: splitBarLabelLines(patch.name) },
        };
      }
      if (patch.backgroundColor !== undefined && sourceObject.backgroundColor !== patch.backgroundColor) {
        sourceObject = { ...sourceObject, backgroundColor: patch.backgroundColor };
      }
      if (sourceObject === layer.sourceObject) return layer;
      changed = true;
      return { ...layer, sourceObject };
    });
    return { ...lg, layers };
  });
  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}

function applyScorePatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: ScorePatch,
): ScoreDocumentSnapshot {
  if (
    patch.type === 'addTrackItem'
    || patch.type === 'moveTrackItems'
    || patch.type === 'resizeTrackItems'
    || patch.type === 'removeTrackItems'
    || patch.type === 'replaceTrackNoteProcessorChain'
    || patch.type === 'createTrackInstrument'
    || patch.type === 'replaceTrackInstrument'
    || patch.type === 'clearTrackInstrument'
    || patch.type === 'updateTrackInstrument'
  ) {
    return applyTrackPatchToSnapshot(score, patch);
  }

  if (patch.type === 'updatePatternCells' || patch.type === 'updatePatternBeatsLength') {
    return applyPatternPatchToSnapshot(score, patch);
  }

  if (patch.type === 'updateSharedProperties' && patch.target.patternSource) {
    return applyPatternSourceSharedProperties(score, patch.target, patch.patch);
  }

  if (patch.type === 'removeScoreObjects') {
    if (patch.targets.length === 0) return score;
    const nextLayerGroups = score.layerGroups.map((lg) => ({
      ...lg,
      layers: lg.layers.map((layer) => ({
        ...layer,
        items: layer.items.filter((item) =>
          !patch.targets.some((target) => isScoreItemMatchingTarget(item, target))),
      })),
    }));
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveScoreObjects') {
    return applyMoveScoreObjectsToSnapshot(score, patch.moves);
  }

  if (patch.type === 'addLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      // Pattern rows need the full pattern snapshot shape; a generic layer
      // snapshot would be missing the required source/cell fields before the
      // canonical refresh arrives.
      const newLayer: ScoreLayerSnapshot = lg.groupType === 'patterns'
        ? createDefaultPatternLayerSnapshot(lg.groupId, patch.layerIndex + 1)
        : {
          layerId: `layer-${Date.now()}`,
          name: '',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        };
      const layers = [...lg.layers];
      layers.splice(patch.layerIndex + 1, 0, newLayer);
      return { ...lg, layers, layerCount: layers.length } as ScoreLayerGroupSnapshot;
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'removeLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const layers = lg.layers.filter((_l, i) => i !== patch.layerIndex);
      return { ...lg, layers, layerCount: layers.length };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const { layerIndex, targetIndex } = patch;
      if (layerIndex < 0 || layerIndex >= lg.layers.length) return lg;
      const clampedTarget = Math.max(0, Math.min(targetIndex, lg.layers.length - 1));
      if (layerIndex === clampedTarget) return lg;
      const layers = [...lg.layers];
      const [moved] = layers.splice(layerIndex, 1);
      layers.splice(clampedTarget, 0, moved!);
      return { ...lg, layers };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveLayerRange') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const { startIndex, endIndex, targetIndex } = patch;
      if (!isValidLayerRange(startIndex, endIndex, lg.layers.length)
        || !isValidLayerRangeTarget(startIndex, endIndex, targetIndex, lg.layers.length)) return lg;
      const count = endIndex - startIndex + 1;
      if (startIndex === targetIndex) return lg;
      const layers = [...lg.layers];
      const moved = layers.splice(startIndex, count);
      layers.splice(targetIndex, 0, ...moved);
      return { ...lg, layers };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'removeLayerRanges') {
    const ranges = patch.ranges;
    if (!areLayerRangesValid(ranges, (groupId) => (
      score.layerGroups.find((group) => group.groupId === groupId)?.layers.length
    ))) return score;

    const byGroup = new Map<string, Array<{ startIndex: number; endIndex: number }>>();
    for (const r of ranges) {
      let list = byGroup.get(r.groupId);
      if (!list) {
        list = [];
        byGroup.set(r.groupId, list);
      }
      list.push({ startIndex: r.startIndex, endIndex: r.endIndex });
    }

    let nextLayerGroups = score.layerGroups.map((lg) => {
      const groupRanges = byGroup.get(lg.groupId);
      if (!groupRanges || groupRanges.length === 0) return lg;
      const sorted = [...groupRanges].sort((a, b) => b.startIndex - a.startIndex);
      let layers = [...lg.layers];
      for (const r of sorted) {
        layers.splice(r.startIndex, r.endIndex - r.startIndex + 1);
      }
      return { ...lg, layers, layerCount: layers.length };
    });

    if (patch.deleteEmptyLayerGroups) {
      const affectedGroupIds = new Set(ranges.map((range) => range.groupId));
      nextLayerGroups = nextLayerGroups.filter((lg) => (
        !affectedGroupIds.has(lg.groupId) || lg.layers.length > 0
      ));
    }

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateLayerState') {
    const layerUnit = 22;
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      if (patch.layerIndex < 0 || patch.layerIndex >= lg.layers.length) return lg;

      const layers = lg.layers.map((layer, index) => {
        if (index !== patch.layerIndex) return layer;

        return {
          ...layer,
          ...(patch.patch.muted !== undefined ? { muted: patch.patch.muted } : {}),
          ...(patch.patch.solo !== undefined ? { solo: patch.patch.solo } : {}),
          ...(patch.patch.heightIndex !== undefined ? { height: (Math.max(0, patch.patch.heightIndex) + 1) * layerUnit } : {}),
        };
      });

      return { ...lg, layers };
    });

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'renameLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      if (patch.layerIndex < 0 || patch.layerIndex >= lg.layers.length) return lg;
      const layers = lg.layers.map((layer, index) =>
        index === patch.layerIndex ? { ...layer, name: patch.name } : layer);
      return { ...lg, layers };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'renameLayerGroup') {
    const nextLayerGroups = score.layerGroups.map((lg) =>
      lg.groupId === patch.groupId ? { ...lg, name: patch.name } : lg);
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateTimeState') {
    const { patch: tsPatch } = patch;
    return {
      ...score,
      timeState: { ...score.timeState, ...tsPatch },
    };
  }

  if (patch.type === 'updateTypeSpecificEditor') {
    const { target, patch: typePatch } = patch;

    const nextLayerGroups = score.layerGroups.map((lg) => ({
      ...lg,
      layers: lg.layers.map((layer) => ({
        ...layer,
        items: layer.items.map((item) => {
          if (!isScoreItemMatchingTarget(item, target)) return item;
          if (item.barRenderer.kind === 'audioClip') {
            return {
              ...item,
              barRenderer: {
                ...item.barRenderer,
                ...(typePatch.fadeInType !== undefined ? { fadeInType: typePatch.fadeInType as typeof item.barRenderer.fadeInType } : {}),
                ...(typePatch.fadeOutType !== undefined ? { fadeOutType: typePatch.fadeOutType as typeof item.barRenderer.fadeOutType } : {}),
              },
            };
          }

          return item;
        }),
      })),
    }));

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'addMarker') {
    const name = patch.name ?? `Marker ${score.markers.length + 1}`;
    const newMarker: MarkerSnapshot = {
      name,
      time: patch.timeBeats,
      timeBase: score.timeState.primaryTimeDisplay,
      sourceIndex: score.markers.length,
    };
    return { ...score, markers: [...score.markers, newMarker] };
  }

  if (patch.type === 'updateMarker') {
    const markers = score.markers.map((m, i) => {
      if (i !== patch.sourceIndex) return m;
      return {
        ...m,
        ...(patch.patch.name !== undefined ? { name: patch.patch.name } : {}),
        ...(patch.patch.timeBeats !== undefined ? { time: patch.patch.timeBeats } : {}),
        ...(patch.patch.timeBase !== undefined ? { timeBase: patch.patch.timeBase } : {}),
      };
    });
    return { ...score, markers };
  }

  if (patch.type === 'removeMarker') {
    const markers = score.markers
      .filter((_m, i) => i !== patch.sourceIndex)
      .map((m, i) => ({ ...m, sourceIndex: i }));
    return { ...score, markers };
  }

  if (patch.type === 'moveLayerGroup') {
    const groups = [...score.layerGroups];
    const sourceIdx = groups.findIndex((g) => g.groupId === patch.groupId);
    if (sourceIdx === -1) return score;
    const clampedTarget = Math.max(0, Math.min(patch.targetIndex, groups.length - 1));
    if (sourceIdx === clampedTarget) return score;
    const [removed] = groups.splice(sourceIdx, 1);
    groups.splice(clampedTarget, 0, removed!);
    return { ...score, layerGroups: groups };
  }

  if (patch.type === 'removeLayerGroup') {
    const layerGroups = score.layerGroups.filter((g) => g.groupId !== patch.groupId);
    return { ...score, layerGroups };
  }

  if (patch.type === 'addLayerGroup') {
    const insertAt = patch.insertAtIndex ?? score.layerGroups.length;
    const layerGroups = [...score.layerGroups];
    layerGroups.splice(insertAt, 0, createAddedLayerGroupSnapshot(patch.groupType));
    return { ...score, layerGroups };
  }

  if (patch.type === 'replaceScopedNoteProcessorChain') {
    const noteProcessorChain = cloneVisibleNoteProcessorChain(patch.chain);

    if (patch.scope === 'rootScore') {
      return { ...score, rootNoteProcessorChain: noteProcessorChain };
    }

    const nextLayerGroups = score.layerGroups.map((group) => {
      if (group.groupId !== patch.groupId) return group;

      if (patch.scope === 'layerGroup') {
        return { ...group, noteProcessorChain };
      }

      if (patch.layerIndex < 0 || patch.layerIndex >= group.layers.length) {
        return group;
      }

      const layers = group.layers.map((layer, index) => (
        index === patch.layerIndex ? { ...layer, noteProcessorChain } : layer
      ));
      return { ...group, layers };
    });

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateSoundObjectBehavior') {
    const nextLayerGroups = score.layerGroups.map((lg) => ({
      ...lg,
      layers: lg.layers.map((layer) => ({
        ...layer,
        items: layer.items.map((item) => {
          if (!isScoreItemMatchingTarget(item, patch.target)) return item;

          return {
            ...item,
            barRenderer: applySoundObjectBehaviorToBarRenderer(item.barRenderer, patch.patch),
          };
        }),
      })),
    }));

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'assignAutomationToLayer'
    || patch.type === 'removeAutomationFromLayer'
    || patch.type === 'moveAutomationToLayer'
    || patch.type === 'clearLayerAutomations'
    || patch.type === 'cleanupLayerAutomation'
    || patch.type === 'selectLayerAutomation'
    || patch.type === 'setAutomationLineColor'
    || patch.type === 'setAutomationPoints'
    || patch.type === 'insertAutomationPoint'
    || patch.type === 'deleteAutomationPoint'
    || patch.type === 'moveAutomationPoint'
    || patch.type === 'setAutomationResolution'
  ) {
    return score;
  }

  if (patch.type !== 'updateSharedProperties') return score;

  const { name, startTime, subjectiveDuration, backgroundColor } = patch.patch;

  const nextLayerGroups = score.layerGroups.map((lg) => ({
    ...lg,
    layers: lg.layers.map((layer) => ({
      ...layer,
      items: layer.items.map((item) => {
        if (!isScoreItemMatchingTarget(item, patch.target)) return item;
        const next = { ...item };
        if (name !== undefined) next.name = name;
        if (backgroundColor !== undefined) next.backgroundColor = backgroundColor;
        if (startTime !== undefined) {
          next.startBeats = startTime.value;
          next.startTimeBase = startTime.timeBase;
        }
        if (subjectiveDuration !== undefined) {
          next.durationBeats = subjectiveDuration.value;
          next.durationTimeBase = subjectiveDuration.timeBase;
        }
        next.barRenderer = applySharedPropertiesToBarRenderer(next.barRenderer, patch.patch);
        return next;
      }),
    })),
  }));

  return { ...score, layerGroups: nextLayerGroups };
}

function applyTrackPatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: Extract<ScorePatch, {
    type:
      | 'addTrackItem'
      | 'moveTrackItems'
      | 'resizeTrackItems'
      | 'removeTrackItems'
      | 'replaceTrackNoteProcessorChain'
      | 'createTrackInstrument'
      | 'replaceTrackInstrument'
      | 'clearTrackInstrument'
      | 'updateTrackInstrument'
  }>,
): ScoreDocumentSnapshot {
  const findTrack = (groupId: string, trackId: string) => {
    const group = score.layerGroups.find((candidate) => candidate.groupId === groupId && candidate.groupType === 'track');
    if (!group || group.groupType !== 'track') return null;
    const layerIndex = group.layers.findIndex((layer) => layer.layerId === trackId);
    if (layerIndex < 0) return null;
    return { group, layerIndex, layer: group.layers[layerIndex]! };
  };

  const findItem = (groupId: string, trackId: string, objectId?: string, objectIndex?: number) => {
    const target = findTrack(groupId, trackId);
    if (!target) return null;
    const index = objectId
      ? target.layer.items.findIndex((item) => item.objectId === objectId)
      : objectIndex ?? -1;
    if (index < 0 || index >= target.layer.items.length) return null;
    return { ...target, itemIndex: index, item: target.layer.items[index]! };
  };

  if (patch.type === 'addTrackItem') {
    const target = findTrack(patch.track.rootGroupId, patch.track.trackId);
    if (!target) return score;
    const objectType = patch.item.objectType ?? patch.item.type ?? 'Unknown';
    const objectId = `local-${objectType === 'AudioClip' ? 'aclp' : 'sobj'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ScoreRowObjectSnapshot = {
      objectId,
      objectType,
      name: patch.item.name ?? objectType,
      startBeats: patch.startBeats,
      durationBeats: patch.item.durationBeats ?? 1,
      startTimeBase: patch.item.startTimeBase ?? 'BEATS',
      durationTimeBase: patch.item.durationTimeBase ?? 'BEATS',
      backgroundColor: patch.item.backgroundColor ?? 0x404040,
      isContainer: false,
      editorTarget: {
        selectionId: objectId,
        selectedObjectType: objectType,
        editorObjectType: objectType,
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: {
          rootGroupIndex: score.layerGroups.indexOf(target.group),
          containerPath: [],
          layerIndex: target.layerIndex,
          objectIndex: target.layer.items.length,
          rootGroupId: target.group.groupId,
          layerId: target.layer.layerId,
          trackId: target.layer.layerId,
          layerKind: 'track',
        },
        supportsTimeBehavior: objectType !== 'AudioClip',
        supportsRepeatPoint: objectType !== 'AudioClip',
        supportsNoteProcessorChain: objectType !== 'AudioClip',
      },
      serializedXml: patch.item.serializedXml,
      barRenderer: {
        kind: objectType === 'AudioClip' ? 'audioClip' : 'fallback',
        labelLines: [patch.item.name ?? objectType],
        ...(objectType === 'AudioClip'
          ? {
            audioFilePath: '',
            waveformKey: null,
            fileStartTimeBeats: 0,
            audioDurationBeats: 0,
            looping: true,
            fadeInBeats: 0,
            fadeInType: 'LINEAR' as const,
            fadeOutBeats: 0,
            fadeOutType: 'LINEAR' as const,
          }
          : { reason: 'missing-data' as const }),
      } as ScoreRowObjectSnapshot['barRenderer'],
    };
    const layers = score.layerGroups.map((group) => {
      if (group.groupId !== target.group.groupId || group.groupType !== 'track') return group;
      return {
        ...group,
        layers: group.layers.map((layer, index) => index === target.layerIndex
          ? { ...layer, items: [...layer.items, item] }
          : layer),
      };
    });
    return { ...score, layerGroups: layers };
  }

  if (patch.type === 'removeTrackItems') {
    const targets = patch.targets.map((target) => findItem(
      target.track.rootGroupId,
      target.track.trackId,
      target.objectId,
      target.objectIndex,
    ));
    if (targets.some((target) => !target)) return score;
    const itemIds = new Set((targets as Array<NonNullable<typeof targets[number]>>).map((target) => target.item.objectId));
    const layerGroups = score.layerGroups.map((group) => group.groupType === 'track'
      ? {
        ...group,
        layers: group.layers.map((layer) => ({
          ...layer,
          items: layer.items.filter((item) => !itemIds.has(item.objectId)),
        })),
      }
      : group);
    return { ...score, layerGroups };
  }

  if (patch.type === 'moveTrackItems') {
    const resolved = patch.moves.map((move) => ({
      source: findItem(move.source.track.rootGroupId, move.source.track.trackId, move.source.objectId, move.source.objectIndex),
      destination: findTrack(move.destination.rootGroupId, move.destination.trackId),
      move,
    }));
    if (resolved.some((entry) => !entry.source || !entry.destination)) return score;
    const movedIds = new Set(resolved.map((entry) => entry.source!.item.objectId));
    const destinations = new Map<string, Array<{ item: ScoreRowObjectSnapshot; start: number }>>();
    for (const entry of resolved) {
      const bucket = destinations.get(entry.destination!.layer.layerId) ?? [];
      bucket.push({ item: entry.source!.item, start: entry.move.targetStartBeats });
      destinations.set(entry.destination!.layer.layerId, bucket);
    }
    const layerGroups = score.layerGroups.map((group) => group.groupType === 'track'
      ? {
        ...group,
        layers: group.layers.map((layer) => {
          const additions = destinations.get(layer.layerId) ?? [];
          const items = layer.items
            .filter((item) => !movedIds.has(item.objectId))
            .concat(additions.map(({ item, start }) => ({ ...item, startBeats: start })));
          return { ...layer, items };
        }),
      }
      : group);
    return { ...score, layerGroups };
  }

  if (patch.type === 'resizeTrackItems') {
    const resolved = patch.resizes.map((resize) => ({
      target: findItem(
        resize.target.track.rootGroupId,
        resize.target.track.trackId,
        resize.target.objectId,
        resize.target.objectIndex,
      ),
      resize,
    }));
    if (resolved.some((entry) => !entry.target)) return score;
    const itemIds = new Set(resolved.map((entry) => entry.target!.item.objectId));
    if (itemIds.size !== resolved.length) return score;
    const byId = new Map(resolved.map((entry) => [entry.target!.item.objectId, entry.resize]));
    const layerGroups = score.layerGroups.map((group) => group.groupType === 'track'
      ? {
        ...group,
        layers: group.layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            const resize = byId.get(item.objectId);
            if (!resize) return item;
            return {
              ...item,
              startBeats: resize.targetStartBeats,
              durationBeats: resize.targetDurationBeats,
            };
          }),
        })),
      }
      : group);
    return { ...score, layerGroups };
  }

  const target = findTrack(patch.track.rootGroupId, patch.track.trackId);
  if (!target) return score;
  if (patch.type === 'replaceTrackNoteProcessorChain') {
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) => group.groupId === target.group.groupId && group.groupType === 'track'
        ? { ...group, layers: group.layers.map((layer, index) => index === target.layerIndex ? { ...layer, noteProcessorChain: cloneVisibleNoteProcessorChain(patch.chain) } : layer) }
        : group),
    };
  }
  if (patch.type === 'clearTrackInstrument') {
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) => group.groupId === target.group.groupId && group.groupType === 'track'
        ? { ...group, layers: group.layers.map((layer, index) => index === target.layerIndex ? { ...layer, instrument: null } : layer) }
        : group),
    };
  }
  if (patch.type === 'createTrackInstrument' || patch.type === 'replaceTrackInstrument') {
    const instrument = patch.type === 'createTrackInstrument'
      ? { type: patch.instrumentType, instrumentType: patch.instrumentType, name: '', comment: '', enabled: true, supported: true, trackId: target.layer.layerId }
      : { type: patch.instrument.type, instrumentType: patch.instrument.instrumentType, name: patch.instrument.name, comment: patch.instrument.comment, enabled: patch.instrument.enabled, supported: patch.instrument.type !== 'unknown', trackId: target.layer.layerId, snapshot: cloneSnapshotValue(patch.instrument) };
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) => group.groupId === target.group.groupId && group.groupType === 'track'
        ? { ...group, layers: group.layers.map((layer, index) => index === target.layerIndex ? { ...layer, instrument } : layer) }
        : group),
    };
  }
  if (patch.type === 'updateTrackInstrument') {
    const current = target.layer.instrument;
    if (!current) return score;
    const nextSummary = { ...current };
    const nextSnapshot = current.snapshot ? { ...current.snapshot } : undefined;
    if (patch.patch.name !== undefined) {
      nextSummary.name = patch.patch.name;
      if (nextSnapshot) nextSnapshot.name = patch.patch.name;
    }
    if (patch.patch.comment !== undefined) {
      nextSummary.comment = patch.patch.comment;
      if (nextSnapshot) nextSnapshot.comment = patch.patch.comment;
    }
    if (patch.patch.enabled !== undefined) {
      nextSummary.enabled = patch.patch.enabled;
      if (nextSnapshot) nextSnapshot.enabled = patch.patch.enabled;
    }
    if (nextSnapshot) nextSummary.snapshot = nextSnapshot;
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) => group.groupId === target.group.groupId && group.groupType === 'track'
        ? { ...group, layers: group.layers.map((layer, index) => index === target.layerIndex ? { ...layer, instrument: nextSummary } : layer) }
        : group),
    };
  }
  return score;
}

function cloneSnapshotValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneSnapshotValue(item)) as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneSnapshotValue(item);
  }
  return next as T;
}

function cloneInstrumentSnapshotForMutation<T extends InstrumentSnapshot>(instrument: T): T {
  if (instrument.type === 'blueX7') {
    const x7 = instrument as unknown as BlueX7InstrumentSnapshot;
    return {
      ...x7,
      voice: x7.voice ? cloneBlueX7Voice(x7.voice) : x7.voice,
    } as unknown as T;
  }
  return { ...instrument };
}

function updateBlueX7OperatorEnableParameters(
  instrument: BlueX7InstrumentSnapshot,
  enabled: readonly boolean[],
): void {
  if (!instrument.parameters || enabled.length !== 6) {
    return;
  }
  instrument.parameters = instrument.parameters.map((parameter) => {
    const match = /^operator\.([1-6])\.enabled$/.exec(parameter.semanticKey);
    if (!match) {
      return parameter;
    }
    const operatorIndex = Number(match[1]) - 1;
    return {
      ...parameter,
      fixedValue: enabled[operatorIndex] ? 1 : 0,
    };
  });
}

function cloneArrangementRowSnapshot(row: ArrangementRowSnapshot): ArrangementRowSnapshot {
  return { ...row };
}


function cloneOrchestraSnapshot(orchestra: OrchestraSnapshot): OrchestraSnapshot {
  return {
    ...orchestra,
    arrangement: {
      ...orchestra.arrangement,
    },
    instruments: orchestra.instruments,
    temporaryLibrary: orchestra.temporaryLibrary,
  };
}

function cloneArrangementRowsForMutation(orchestra: OrchestraSnapshot): ArrangementRowSnapshot[] {
  const nextRows = orchestra.arrangement.rows.slice();
  orchestra.arrangement.rows = nextRows;
  return nextRows;
}

function cloneInstrumentsForMutation(orchestra: OrchestraSnapshot): InstrumentSnapshot[] {
  const nextInstruments = orchestra.instruments.slice();
  orchestra.instruments = nextInstruments;
  return nextInstruments;
}

function getNextArrangementId(rows: ArrangementRowSnapshot[]): string {
  let max = 0;
  for (const row of rows) {
    const value = Number.parseInt(row.assignmentId, 10);
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return String(max + 1);
}

function createDefaultInstrumentSnapshot(
  instrumentType: SupportedNewInstrumentType,
  assignmentId: string,
  enabled = true,
): InstrumentSnapshot {
  switch (instrumentType) {
    case 'generic': return createInstrumentSnapshot(assignmentId, new GenericInstrument(), enabled);
    case 'javascript': return createInstrumentSnapshot(assignmentId, new JavaScriptInstrument(), enabled);
    case 'python': return createInstrumentSnapshot(assignmentId, new PythonInstrument(), enabled);
    case 'blueX7': return createInstrumentSnapshot(assignmentId, new BlueX7(), enabled);
    case 'blueSynthBuilder': return createInstrumentSnapshot(assignmentId, new BlueSynthBuilder(), enabled);
  }

  throw new Error(`Unsupported instrument type: ${instrumentType}`);
}

function updateInstrumentSnapshot(
  orchestra: OrchestraSnapshot,
  assignmentId: string,
  patch: InstrumentPatch,
): void {
  const instrumentIndex = orchestra.instruments.findIndex((candidate) => candidate.assignmentId === assignmentId);
  const rowIndex = orchestra.arrangement.rows.findIndex((candidate) => candidate.assignmentId === assignmentId);

  if (instrumentIndex < 0) {
    return;
  }

  const nextInstruments = cloneInstrumentsForMutation(orchestra);
  const instrument = cloneInstrumentSnapshotForMutation(nextInstruments[instrumentIndex]!);
  nextInstruments[instrumentIndex] = instrument;

  const rowNeedsMutation = patch.name !== undefined || patch.enabled !== undefined;
  let row = rowIndex >= 0 ? orchestra.arrangement.rows[rowIndex]! : undefined;
  if (rowNeedsMutation && rowIndex >= 0 && row) {
    const nextRows = cloneArrangementRowsForMutation(orchestra);
    row = cloneArrangementRowSnapshot(nextRows[rowIndex]!);
    nextRows[rowIndex] = row;
  }

  if (patch.name !== undefined) {
    instrument.name = patch.name;
    if (row) {
      row.instrumentName = patch.name;
    }
  }

  if (patch.enabled !== undefined) {
    instrument.enabled = patch.enabled;
    if (row) {
      row.enabled = patch.enabled;
    }
  }

  if (patch.comment !== undefined) {
    instrument.comment = patch.comment;
  }

  if (instrument.type === 'generic' || instrument.type === 'javascript' || instrument.type === 'python') {
    if (patch.text !== undefined) {
      instrument.text = patch.text;
    }
    if (patch.globalOrc !== undefined) {
      instrument.globalOrc = patch.globalOrc;
    }
    if (patch.globalSco !== undefined) {
      instrument.globalSco = patch.globalSco;
    }
    if (patch.embeddedOpcodeList) {
      applyEmbeddedOpcodeListPatchToSnapshot(instrument, patch.embeddedOpcodeList);
    }
  } else if (instrument.type === 'blueSynthBuilder') {
    if (patch.instrumentText !== undefined) {
      instrument.instrumentText = patch.instrumentText;
    }
    if (patch.alwaysOnInstrumentText !== undefined) {
      instrument.alwaysOnInstrumentText = patch.alwaysOnInstrumentText;
    }
    if (patch.globalOrc !== undefined) {
      instrument.globalOrc = patch.globalOrc;
    }
    if (patch.globalSco !== undefined) {
      instrument.globalSco = patch.globalSco;
    }
    if (patch.bsbWidgetValues) {
      instrument.widgets = instrument.widgets.map((widget) => {
        const value = patch.bsbWidgetValues?.[widget.objectName];
        return value === undefined ? widget : { ...widget, value };
      });
    }
    if (patch.bsbOpcodeListText !== undefined) {
      instrument.opcodeListText = patch.bsbOpcodeListText;
    }
    if (patch.bsbInterface) {
      applyBsbInstrumentPatchToSnapshot(instrument, patch.bsbInterface);
    }
  } else if (instrument.type === 'blueX7') {
    const x7 = instrument as BlueX7InstrumentSnapshot;
    if (patch.blueX7 && x7.voice && isValidBlueX7Patch(patch.blueX7)) {
      const p = patch.blueX7;
      const v = x7.voice;
      switch (p.type) {
        case 'setCommonField':
          if (p.field === 'operatorEnabled') {
            const enabled = p.value as [boolean, boolean, boolean, boolean, boolean, boolean];
            v.common = { ...v.common, operatorEnabled: [...enabled] };
            updateBlueX7OperatorEnableParameters(x7, enabled);
          } else {
            v.common = { ...v.common, [p.field]: p.value };
          }
          break;
        case 'setOperatorEnabled':
          if (p.operatorIndex >= 0 && p.operatorIndex < 6) {
            const nextEnabled = [...v.common.operatorEnabled] as [boolean, boolean, boolean, boolean, boolean, boolean];
            nextEnabled[p.operatorIndex] = p.enabled;
            v.common = { ...v.common, operatorEnabled: nextEnabled };
            updateBlueX7OperatorEnableParameters(x7, nextEnabled);
          }
          break;
        case 'setLfoField':
          v.lfo = { ...v.lfo, [p.field]: p.value };
          break;
        case 'setOperatorField':
          if (p.operatorIndex >= 0 && p.operatorIndex < 6) {
            const nextOps = [...v.operators] as typeof v.operators;
            nextOps[p.operatorIndex] = { ...nextOps[p.operatorIndex], [p.field]: p.value };
            v.operators = nextOps;
          }
          break;
        case 'setSharedOscillatorSync':
          v.operators = v.operators.map((op) => ({ ...op, sync: p.value })) as typeof v.operators;
          break;
        case 'setSharedPitchModulationSensitivity':
          v.operators = v.operators.map((op) => ({ ...op, modulationPitch: p.value })) as typeof v.operators;
          break;
        case 'setOperatorEnvelopePoint':
          if (p.operatorIndex >= 0 && p.operatorIndex < 6 && p.stageIndex >= 0 && p.stageIndex < 4) {
            const nextOps = [...v.operators] as typeof v.operators;
            const nextEnv = [...nextOps[p.operatorIndex].envelope] as typeof nextOps[0]['envelope'];
            nextEnv[p.stageIndex] = { ...p.point };
            nextOps[p.operatorIndex] = { ...nextOps[p.operatorIndex], envelope: nextEnv };
            v.operators = nextOps;
          }
          break;
        case 'setPitchEnvelopePoint':
          if (p.stageIndex >= 0 && p.stageIndex < 4) {
            const nextPeg = [...v.pitchEnvelope] as typeof v.pitchEnvelope;
            nextPeg[p.stageIndex] = { ...p.point };
            v.pitchEnvelope = nextPeg;
          }
          break;
        case 'setCsoundPostCode':
          v.csoundPostCode = p.text;
          break;
        case 'replaceVoice':
          x7.voice = cloneBlueX7Voice(p.voice);
          break;
      }
      const syncs = x7.voice.operators.map((op) => op.sync);
      const pmss = x7.voice.operators.map((op) => op.modulationPitch);
      x7.sharedOscillatorSync = syncs.every((s) => s === syncs[0]) ? syncs[0] : 'mixed';
      x7.sharedPitchModulationSensitivity = pmss.every((s) => s === pmss[0]) ? pmss[0] : 'mixed';
    }
  }
}


function applyEmbeddedOpcodeListPatchToSnapshot(
  instrument: (GenericInstrumentSnapshot | JavaScriptInstrumentSnapshot | PythonInstrumentSnapshot),
  patch: EmbeddedOpcodeListPatch,
): void {
  switch (patch.type) {
    case 'addUdo': {
      const udolist = instrument.udolist ? [...instrument.udolist] : [];
      const newUdo = patch.definition
        ? cloneUdoSnapshot(patch.definition)
        : cloneUdoSnapshot(EMPTY_UDO_SNAPSHOT);
      if (patch.index !== undefined && patch.index >= 0 && patch.index <= udolist.length) {
        udolist.splice(patch.index, 0, newUdo);
      } else {
        udolist.push(newUdo);
      }
      instrument.udolist = udolist;
      break;
    }
    case 'removeUdo': {
      const removeUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.index >= 0 && patch.index < removeUdolist.length) {
        removeUdolist.splice(patch.index, 1);
      }
      instrument.udolist = removeUdolist;
      break;
    }
    case 'updateUdo': {
      const updateUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < updateUdolist.length) {
        updateUdolist[patch.index] = { ...updateUdolist[patch.index], ...patch.patch };
      }
      instrument.udolist = updateUdolist;
      break;
    }
    case 'convertUdoStyle': {
      const convertedUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < convertedUdolist.length) {
        convertedUdolist[patch.index] = convertUdoSnapshotStyle(
          convertedUdolist[patch.index]!,
          patch.style,
        );
      }
      instrument.udolist = convertedUdolist;
      break;
    }
    case 'reorderUdo': {
      const reorderUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.from >= 0 && patch.from < reorderUdolist.length && patch.to >= 0 && patch.to < reorderUdolist.length) {
        const [moved] = reorderUdolist.splice(patch.from, 1);
        reorderUdolist.splice(patch.to, 0, moved);
      }
      instrument.udolist = reorderUdolist;
      break;
    }
  }
}


function applyOrchestraPatchSnapshot(
  orchestra: OrchestraSnapshot,
  patch: OrchestraPatch,
): OrchestraSnapshot {
  const next = cloneOrchestraSnapshot(orchestra);

  switch (patch.type) {
    case 'addInstrument': {
      const assignmentId = getNextArrangementId(next.arrangement.rows);
      const instrument = createDefaultInstrumentSnapshot(patch.instrumentType, assignmentId);
      const nextRows = cloneArrangementRowsForMutation(next);
      const nextInstruments = cloneInstrumentsForMutation(next);
      nextRows.push({
        assignmentId,
        enabled: instrument.enabled,
        instrumentName: instrument.name,
        instrumentType: instrument.type,
        instrumentSummary: instrument.type,
        editable: true,
      });
      nextInstruments.push(instrument);
      break;
    }
    case 'removeAssignment': {
      next.arrangement.rows = next.arrangement.rows.filter(
        (row) => row.assignmentId !== patch.assignmentId,
      );
      next.instruments = next.instruments.filter(
        (instrument) => instrument.assignmentId !== patch.assignmentId,
      );
      break;
    }
    case 'duplicateAssignment': {
      const sourceRow = next.arrangement.rows.find(
        (row) => row.assignmentId === patch.sourceAssignmentId,
      );
      const sourceInstrument = next.instruments.find(
        (instrument) => instrument.assignmentId === patch.sourceAssignmentId,
      );
      if (sourceRow && sourceInstrument) {
        const assignmentId = getNextArrangementId(next.arrangement.rows);
        const duplicatedInstrument = cloneInstrumentSnapshot(sourceInstrument);
        duplicatedInstrument.assignmentId = assignmentId;
        const nextRows = cloneArrangementRowsForMutation(next);
        const nextInstruments = cloneInstrumentsForMutation(next);
        nextRows.push({
          ...sourceRow,
          assignmentId,
        });
        nextInstruments.push(duplicatedInstrument);
      }
      break;
    }
    case 'pasteInstrument': {
      const assignmentId = getNextArrangementId(next.arrangement.rows);
      const pastedInstrument = cloneInstrumentSnapshot(patch.instrument);
      pastedInstrument.assignmentId = assignmentId;
      const nextRows = cloneArrangementRowsForMutation(next);
      const nextInstruments = cloneInstrumentsForMutation(next);
      const pastedRow = {
        assignmentId,
        enabled: pastedInstrument.enabled,
        instrumentName: pastedInstrument.name,
        instrumentType: pastedInstrument.type,
        instrumentSummary: pastedInstrument.type,
        editable: true,
      };
      const insertAfterIndex = patch.insertAfterAssignmentId
        ? nextRows.findIndex((row) => row.assignmentId === patch.insertAfterAssignmentId)
        : -1;
      const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextRows.length;
      nextRows.splice(insertIndex, 0, pastedRow);
      nextInstruments.splice(insertIndex, 0, pastedInstrument);
      break;
    }
    case 'updateAssignment': {
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const instrumentIndex = next.instruments.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const row = rowIndex >= 0 ? cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!) : undefined;
      const instrument = instrumentIndex >= 0
        ? cloneInstrumentSnapshotForMutation(next.instruments[instrumentIndex]!)
        : undefined;

      if (rowIndex >= 0 && row) {
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
      }
      if (instrumentIndex >= 0 && instrument) {
        next.instruments = next.instruments.slice();
        next.instruments[instrumentIndex] = instrument;
      }

      if (row) {
        if (patch.enabled !== undefined) {
          row.enabled = patch.enabled;
          if (instrument) {
            instrument.enabled = patch.enabled;
          }
        }

        if (patch.nextAssignmentId && patch.nextAssignmentId.trim()) {
          const nextAssignmentId = patch.nextAssignmentId.trim();
          const duplicate = next.arrangement.rows.some(
            (candidate) =>
              candidate !== row && candidate.assignmentId === nextAssignmentId,
          );
          if (!duplicate && row.assignmentId !== nextAssignmentId) {
            const oldId = row.assignmentId;
            row.assignmentId = nextAssignmentId;
            if (instrument) {
              instrument.assignmentId = nextAssignmentId;
            }
            const channel = next.channels.find(
              (ch) => ch.association === oldId,
            );
            if (channel) {
              next.channels = next.channels.map((ch) =>
                ch.association === oldId
                  ? { ...ch, association: nextAssignmentId, name: nextAssignmentId }
                  : ch,
              );
            }
          }
        }
      }
      break;
    }
    case 'replaceInstrument': {
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      if (rowIndex >= 0) {
        const row = cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!);
        const instrument = createDefaultInstrumentSnapshot(
          patch.instrumentType,
          patch.assignmentId,
          row.enabled,
        );
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
        row.instrumentType = instrument.type;
        row.instrumentName = instrument.name;
        row.instrumentSummary = instrument.type;
        const index = next.instruments.findIndex(
          (candidate) => candidate.assignmentId === patch.assignmentId,
        );
        if (index >= 0) {
          next.instruments = next.instruments.slice();
          next.instruments[index] = instrument;
        }
      }
      break;
    }
    case 'convertGenericToBsb': {
      const source = next.instruments.find(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      if (source?.type === 'generic' && rowIndex >= 0) {
        const row = cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!);
        const converted: InstrumentSnapshot = {
          assignmentId: source.assignmentId,
          type: 'blueSynthBuilder',
          name: source.name,
          enabled: source.enabled,
          comment: source.comment,
          instrumentText: source.text,
          alwaysOnInstrumentText: '',
          globalOrc: source.globalOrc,
          globalSco: source.globalSco,
          objectNames: [],
          widgets: [],
          editEnabled: true,
          gridSettings: { columns: 8, rows: 4, snap: true },
          widgetTree: { id: 'root', type: 'BSBRootGroup', objectName: '', x: 0, y: 0, width: 0, height: 0, value: 0, minimum: 0, maximum: 1, properties: {}, editable: true, children: [] },
        };
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
        row.instrumentType = converted.type;
        row.instrumentName = converted.name;
        row.instrumentSummary = converted.type;
        const index = next.instruments.findIndex(
          (candidate) => candidate.assignmentId === patch.assignmentId,
        );
        if (index >= 0) {
          next.instruments = next.instruments.slice();
          next.instruments[index] = converted;
        }
      }
      break;
    }
    case 'updateInstrument': {
      updateInstrumentSnapshot(next, patch.assignmentId, patch.patch);
      break;
    }
    case 'updateInstrumentComment': {
      updateInstrumentSnapshot(next, patch.assignmentId, { comment: patch.comment });
      break;
    }
  }

  return next;
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => {
  storeSet = set;
  return {
  ...buildInitialState(),

  loadProject: async () => {
    set({ isLoading: true });
    try {
      const filePath = await window.blueAPI.openFile();
      if (filePath) {
        // The main process will send project-loaded IPC event
        // which triggers setProjectInfo via useIPCListeners
        return;
      }
      set({ isLoading: false });
    } catch (err: unknown) {
      toast.error(`Failed to open file: ${err instanceof Error ? err.message : String(err)}`);
      set({ isLoading: false });
    }
  },

  saveProject: async () => {
    try {
      const filePath = await window.blueAPI.saveFile();
      if (filePath) {
        set({
          filePath,
          isDirty: false,
        });
      }
    } catch (err: unknown) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  saveProjectAs: async () => {
    try {
      const filePath = await window.blueAPI.saveFileAs();
      if (filePath) {
        set({ filePath, isDirty: false });
      }
    } catch (err: unknown) {
      toast.error(`Save As failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

    setProjectInfo: (info) => {
      applyProjectInfoToState(info, false);
    },

  setLoading: (isLoading) => set({ isLoading }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

    clearProject: () => {
      resetTransientProjectMutationState();
      set(buildInitialState());
      useMidiRoutingStore.getState().clearFocusForProjectSession();
      useLayerSelectionStore.getState().clear();
    },

  revertProject: async () => {
    try {
      const snapshot = await window.blueAPI.getProjectDocument();
      if (snapshot) {
        applyProjectInfoToState(snapshot, true);
      }
    } catch (err: unknown) {
      toast.error(`Failed to revert project: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  applyProjectDocumentPatch: async (patch) => {
    const normalizedPatch = normalizeProjectDocumentPatch(patch);

    if (!get().loaded) {
      toast.error('No project is loaded');
      return;
    }

    if (
      normalizedPatch.globalOrc === undefined &&
      normalizedPatch.globalSco === undefined &&
      normalizedPatch.orchestra === undefined &&
      normalizedPatch.mixer === undefined &&
      normalizedPatch.clojureProject === undefined &&
      (!normalizedPatch.scratchPad || Object.keys(normalizedPatch.scratchPad).length === 0) &&
      normalizedPatch.tablesText === undefined &&
      normalizedPatch.projectUdo === undefined &&
      normalizedPatch.blueLive === undefined &&
      normalizedPatch.midiInput === undefined &&
      (!normalizedPatch.score) &&
      (!normalizedPatch.projectProperties || Object.keys(normalizedPatch.projectProperties).length === 0) &&
      (!normalizedPatch.transport || Object.keys(normalizedPatch.transport).length === 0)
    ) {
      return;
    }

    const dirtyBaseline = get().isDirty;

    set((state) => {
      const next: ProjectState = {
        ...state,
        isDirty: true,
      };

      if (normalizedPatch.globalOrc !== undefined) {
        next.globalOrc = normalizedPatch.globalOrc;
      }

      if (normalizedPatch.globalSco !== undefined) {
        next.globalSco = normalizedPatch.globalSco;
      }

      if (normalizedPatch.orchestra !== undefined) {
        next.orchestra = applyOrchestraPatchSnapshot(state.orchestra, normalizedPatch.orchestra);
      }

      if (normalizedPatch.mixer !== undefined) {
        next.mixer = applyMixerPatchToSnapshot(
          state.mixer ?? createEmptyMixerSnapshot(),
          next.orchestra,
          normalizedPatch.mixer,
        );

        if (normalizedPatch.mixer.type === 'updateChannel' && normalizedPatch.mixer.patch.name !== undefined) {
          next.score = applyMixerChannelRenameToTrackSnapshot(
            state.score,
            next.mixer,
            normalizedPatch.mixer,
          );
        }
      }

      if (normalizedPatch.projectProperties) {
        next.projectProperties = mergeProjectProperties(
          state.projectProperties,
          normalizedPatch.projectProperties,
        );

        if (normalizedPatch.projectProperties.title !== undefined) {
          next.title = normalizedPatch.projectProperties.title;
        }
        if (normalizedPatch.projectProperties.author !== undefined) {
          next.author = normalizedPatch.projectProperties.author;
        }
        if (normalizedPatch.projectProperties.sampleRate !== undefined) {
          next.sampleRate = normalizedPatch.projectProperties.sampleRate;
        }
      }

      if (normalizedPatch.clojureProject !== undefined) {
        next.clojureProject = cloneClojureProjectSnapshot(
          normalizedPatch.clojureProject,
        );
      }

      if (normalizedPatch.scratchPad !== undefined) {
        next.scratchPad = {
          ...state.scratchPad,
          ...normalizedPatch.scratchPad,
        };
      }

      if (normalizedPatch.transport) {
        const nextTransport = {
          ...state.transport,
          ...normalizedPatch.transport,
          tempoMap: normalizedPatch.transport.tempoMap
            ? { ...state.transport.tempoMap, ...normalizedPatch.transport.tempoMap }
            : state.transport.tempoMap,
        };

        if (normalizedPatch.transport.tempoMapPatch) {
          nextTransport.tempoMap = applyTempoMapPatchToSnapshot(
            nextTransport.tempoMap,
            normalizedPatch.transport.tempoMapPatch,
          );
        }

        if (normalizedPatch.transport.meterMapPatch) {
          nextTransport.meterMap = applyMeterMapPatchToSnapshot(
            nextTransport.meterMap,
            normalizedPatch.transport.meterMapPatch,
          );
        }

        if (nextTransport.renderEndTime <= nextTransport.renderStartTime) {
          nextTransport.renderEndTime = -1;
        }

        next.transport = nextTransport;
      }

      if (normalizedPatch.tablesText !== undefined) {
        next.tablesText = normalizedPatch.tablesText;
      }

      if (normalizedPatch.projectUdo !== undefined) {
        next.projectUdos = applyProjectUdoPatchToSnapshot(state.projectUdos, normalizedPatch.projectUdo);
      }

      if (normalizedPatch.blueLive !== undefined && state.blueLive) {
        next.blueLive = applyBlueLivePatchToSnapshot(state.blueLive, normalizedPatch.blueLive);
      }

      if (normalizedPatch.midiInput !== undefined) {
        next.midiInput = applyMidiInputPatchToSnapshot(
          state.midiInput ?? createDefaultMidiInputSnapshot(),
          normalizedPatch.midiInput,
        );
      }

      if (normalizedPatch.score !== undefined) {
        next.score = applyScorePatchToSnapshot(state.score, normalizedPatch.score);
        next.lastScorePatch = normalizedPatch.score;

        if (normalizedPatch.score.type === 'renameLayer') {
          next.mixer = applyTrackRenameToMixerSnapshot(
            next.mixer,
            next.score,
            normalizedPatch.score,
          );
        }
      }

      if (normalizedPatch.orchestra !== undefined) {
        next.mixer = reconcileMixerSnapshotWithArrangement(
          next.mixer,
          next.orchestra,
        );
      }

      return next;
    });

    const realtimeUpdate = buildRealtimeControlUpdate(normalizedPatch);
    if (realtimeUpdate) {
      void window.blueAPI.sendBsbRealtimeControlUpdate(realtimeUpdate).catch((err: unknown) => {
        toast.error(`Realtime BSB update failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    getProjectPatchQueue().enqueue(normalizedPatch, dirtyBaseline);
  },

  updateGlobalOrc: async (globalOrc) => {
    await get().applyProjectDocumentPatch({ globalOrc });
  },

  updateGlobalSco: async (globalSco) => {
    await get().applyProjectDocumentPatch({ globalSco });
  },

  updateOrchestra: async (orchestra) => {
    await get().applyProjectDocumentPatch({ orchestra });
  },

  updateProjectProperties: async (patch) => {
    await get().applyProjectDocumentPatch({ projectProperties: patch });
  },

  updateScratchPad: async (patch) => {
    await get().applyProjectDocumentPatch({ scratchPad: patch });
  },

  updateClojureProject: async (clojureProject) => {
    await get().applyProjectDocumentPatch({ clojureProject });
  },

  setLoopRendering: async (loopRendering) => {
    await get().applyProjectDocumentPatch({
      transport: { loopRendering },
    });
  },

  addMarkerAtTime: (timeBeats) => {
    get().applyProjectDocumentPatch({
      score: { type: 'addMarker', timeBeats: Math.max(0, timeBeats) },
    });
  },

  addMarkerAtRenderStart: () => {
    get().addMarkerAtTime(get().transport.renderStartTime);
  },

  setScrollToBeatTarget: (beats) => {
    set({ scrollToBeatTarget: beats });
  },

  setAudioClipEditorPreview: (objectId, preview) => {
    set((state) => {
      const currentPreview = state.audioClipEditorPreviewByObjectId[objectId];
      const nextPreview = { ...currentPreview, ...preview };

      if (
        currentPreview !== undefined
        && currentPreview.fileStartTime === nextPreview.fileStartTime
        && currentPreview.fadeIn === nextPreview.fadeIn
        && currentPreview.fadeOut === nextPreview.fadeOut
      ) {
        return state;
      }

      return {
        audioClipEditorPreviewByObjectId: {
          ...state.audioClipEditorPreviewByObjectId,
          [objectId]: nextPreview,
        },
      };
    });
  },

  clearAudioClipEditorPreview: (objectId) => {
    set((state) => {
      if (!(objectId in state.audioClipEditorPreviewByObjectId)) {
        return state;
      }

      const nextPreviewByObjectId = { ...state.audioClipEditorPreviewByObjectId };
      delete nextPreviewByObjectId[objectId];
      return {
        audioClipEditorPreviewByObjectId: nextPreviewByObjectId,
      };
    });
  },

  setMissingAudioSession: (session) => {
    set({ missingAudioSession: session });
  },

  applyMissingAudioResolvedSnapshot: (snapshot) => {
    applyProjectInfoToState(snapshot, true);
    set({ isDirty: true });
  },

  navigateToNextMarker: () => {
    const { transport, score } = get();
    const currentStartTime = transport.renderStartTime;
    const markers = score.markers;
    let selected: { time: number } | null = null;
    for (const marker of markers) {
      if (marker.time > currentStartTime) {
        selected = marker;
        break;
      }
    }
    const endOfScore = computeEndOfScore(score);
    const newStartTime = selected ? selected.time : endOfScore;
    if (newStartTime > currentStartTime) {
      get().applyProjectDocumentPatch({ transport: { renderStartTime: newStartTime } });
      set({ scrollToBeatTarget: newStartTime });
    }
  },

  navigateToPreviousMarker: () => {
    const { transport, score } = get();
    const currentStartTime = transport.renderStartTime;
    const markers = score.markers;
    let selected: { time: number } | null = null;
    for (let i = markers.length - 1; i >= 0; i--) {
      if (markers[i]!.time < currentStartTime) {
        selected = markers[i]!;
        break;
      }
    }
    const newStartTime = selected ? selected.time : 0;
    get().applyProjectDocumentPatch({ transport: { renderStartTime: newStartTime } });
    set({ scrollToBeatTarget: newStartTime });
  },

  rewindToStart: () => {
    get().applyProjectDocumentPatch({
      transport: { renderStartTime: 0, renderEndTime: -1 },
    });
    set({ scrollToBeatTarget: 0 });
  },

  updateTablesText: async (tablesText) => {
    set({ tablesText });
    await get().applyProjectDocumentPatch({ tablesText });
  },

  applyProjectUdoPatch: async (patch) => {
    await get().applyProjectDocumentPatch({ projectUdo: patch });
  },

  applyBlueLivePatch: async (patch) => {
    await get().applyProjectDocumentPatch({ blueLive: patch });
  },

  setGeneratedCsd: (csd: { text: string; title: string } | null) => {
    set({ generatedCsd: csd });
  },

  generateCsdToScreen: async () => {
    await window.blueAPI.generateCsdToScreen();
  },

  generateRealtimeCsdToScreen: async () => {
    await window.blueAPI.generateRealtimeCsdToScreen();
  },

  generateCsdToDisk: async () => {
    await window.blueAPI.generateCsdToDisk();
  },

  flushPendingPatches: async () => {
    await getProjectPatchQueue().flush();
  },

  moveScoreObjects: (moves) => {
    set((state) => {
      return {
        score: applyMoveScoreObjectsToSnapshot(state.score, moves),
        isDirty: true,
      };
    });
  },

  removeScoreObjects: (objectIds) => {
    set((state) => {
      const score = state.score;
      const newGroups = score.layerGroups.map((lg) => {
        const newLayers = lg.layers.map((layer) => ({
          ...layer,
          items: layer.items.filter((item) => !objectIds.has(item.objectId)),
        }));
        return { ...lg, layers: newLayers };
      });
      return { score: { ...score, layerGroups: newGroups }, isDirty: true };
    });
  },

  addScoreObjects: (objects) => {
    if (objects.length === 0) {
      return;
    }

    const patchObjects: Array<{
      selectionId: string;
      layerIndex: number;
      objectType: string;
      name: string;
      startBeats: number;
      durationBeats: number;
      startTimeBase?: string;
      durationTimeBase?: string;
      backgroundColor: number;
      serializedXml?: string;
      sourceTarget?: import('../../../shared/project-editor').ScoreObjectEditorTargetSnapshot;
    }> = [];

    set((state) => {
      const score = state.score;
      const groupIndex = findAddScoreObjectsTargetGroupIndex(score, objects);
      if (groupIndex < 0) return state;
      const lg = score.layerGroups[groupIndex];
      const newLayers = lg.layers.map((layer, idx) => {
        const layerObjects = objects.filter((o) => o.layerIndex === idx);
        if (layerObjects.length === 0) return layer;
        return {
          ...layer,
          items: [...layer.items, ...layerObjects.map((o, j) => {
            const objectId = createLocalScoreObjectId(o.objectType);
            const objectIndex = layer.items.length + j;
            const isSObj = o.objectType !== 'AudioClip';
            const editorTarget = {
              selectionId: objectId,
              selectedObjectType: o.objectType,
              editorObjectType: o.objectType,
              ownerKind: 'timeline' as const,
              displayContext: 'timeline' as const,
              location: {
                rootGroupIndex: groupIndex,
                containerPath: [],
                layerIndex: idx,
                objectIndex,
              },
              supportsTimeBehavior: isSObj,
              supportsRepeatPoint: isSObj,
              supportsNoteProcessorChain: isSObj,
            };
            patchObjects.push({
              selectionId: objectId,
              layerIndex: o.layerIndex,
              objectType: o.objectType,
              name: o.name,
              startBeats: o.startBeats,
              durationBeats: o.durationBeats,
              startTimeBase: o.startTimeBase,
              durationTimeBase: o.durationTimeBase,
              backgroundColor: o.backgroundColor,
              serializedXml: o.serializedXml,
              sourceTarget: o.editorTarget,
            });
            return {
              objectId,
              objectType: o.objectType,
              name: o.name,
              startBeats: o.startBeats,
              durationBeats: o.durationBeats,
              startTimeBase: o.startTimeBase ?? 'BEATS',
              durationTimeBase: o.durationTimeBase ?? 'BEATS',
              backgroundColor: o.backgroundColor,
              isContainer: o.isContainer,
              serializedXml: o.serializedXml,
              barRenderer: createOptimisticBarRendererSnapshot(o),
              editorTarget,
            };
          })],
        };
      });
      const newGroups = [...score.layerGroups];
      newGroups[groupIndex] = { ...lg, layers: newLayers };
      return { score: { ...score, layerGroups: newGroups }, isDirty: true };
    });

    get().applyProjectDocumentPatch({
      score: {
        type: 'addScoreObjects',
        groupId: objects[0].groupId,
        objects: patchObjects,
      },
    }).then(() => __testFlushPendingPatches());
  },

  setLayerMute: (groupId, layerIndex, muted) => {
    void get().applyProjectDocumentPatch({
      score: {
        type: 'updateLayerState',
        groupId,
        layerIndex,
        patch: { muted },
      },
    });
  },

  setLayerSolo: (groupId, layerIndex, solo) => {
    void get().applyProjectDocumentPatch({
      score: {
        type: 'updateLayerState',
        groupId,
        layerIndex,
        patch: { solo },
      },
    });
  },

  renameLayer: (layerId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    let targetGroupId: string | null = null;
    let targetLayerIndex = -1;
    for (const group of get().score.layerGroups) {
      const layerIndex = group.layers.findIndex((layer) => layer.layerId === layerId);
      if (layerIndex >= 0) {
        targetGroupId = group.groupId;
        targetLayerIndex = layerIndex;
        break;
      }
    }

    if (!targetGroupId || targetLayerIndex < 0) {
      return;
    }

    void get().applyProjectDocumentPatch({
      score: {
        type: 'renameLayer',
        groupId: targetGroupId,
        layerIndex: targetLayerIndex,
        name: trimmedName,
      },
    });
  },

  setLayerHeight: (groupId, layerIndex, heightIndex) => {
    void get().applyProjectDocumentPatch({
      score: {
        type: 'updateLayerState',
        groupId,
        layerIndex,
        patch: { heightIndex },
      },
    });
  },

  addLayer: (groupId, layerIndex) => {
    const patch: ProjectDocumentPatch = {
      score: { type: 'addLayer', groupId, layerIndex },
    };
    get().applyProjectDocumentPatch(patch).then(() => {
      __testFlushPendingPatches();
    });
  },

  removeLayer: (groupId, layerIndex) => {
    const patch: ProjectDocumentPatch = {
      score: { type: 'removeLayer', groupId, layerIndex },
    };
    get().applyProjectDocumentPatch(patch).then(() => {
      __testFlushPendingPatches();
    });
  },

  setScoreObjectColor: (objectIds, color) => {
    set((state) => {
      const newGroups = state.score.layerGroups.map((lg) => ({
        ...lg,
        layers: lg.layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) =>
            objectIds.has(item.objectId) ? { ...item, backgroundColor: color } : item
          ),
        })),
      }));
      return { score: { ...state.score, layerGroups: newGroups }, isDirty: true };
    });
  },

  resizeScoreObjects: (resizes) => {
    set((state) => {
      const newGroups = state.score.layerGroups.map((lg) => ({
        ...lg,
        layers: lg.layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            const r = resizes.find((m) => m.objectId === item.objectId);
            if (!r) return item;
            return { ...item, startBeats: r.targetStartBeats, durationBeats: r.targetDurationBeats };
          }),
        })),
      }));
      return { score: { ...state.score, layerGroups: newGroups }, isDirty: true };
    });
  },
};
});
