import { create } from 'zustand';
import { toast } from 'sonner';
import {
  BlueSynthBuilder,
  BlueX7,
  Effect,
  Element,
  GenericInstrument,
  JavaScriptInstrument,
} from '@blue/data';
import {
  createEmptyProjectEditorSnapshot,
  createEmptyMixerSnapshot,
  createEmptyScoreDocumentSnapshot,
  createMixerEffectEntrySnapshot,
  createDefaultBsbWidgetSnapshot,
  collectBsbReplacementKeysFromSnapshotTree,
  ensureUniqueName,
  reconcileMixerSnapshotWithArrangement,
  type BlueLiveProjectSnapshot,
  type BlueLivePatch,
  type ClojureProjectSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
  type BsbInterfacePatch,
  type BsbRealtimeControlUpdate,
  type BsbWidgetNodeSnapshot,
  type ArrangementRowSnapshot,
  type EmbeddedOpcodeListPatch,
  type GenericInstrumentSnapshot,
  type JavaScriptInstrumentSnapshot,
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
  type PresetGroupSnapshot,
  type PresetSnapshot,
  type ProjectDocumentPatch,
  type ProjectLoadedPayload,
  type ProjectEditorSnapshot,
  type ProjectPropertiesSnapshot,
  type MarkerSnapshot,
  type OrchestraPatch,
  type OrchestraSnapshot,
  type ProjectUdoPatch,
  type ScoreDocumentSnapshot,
  type ScoreLayerGroupSnapshot,
  type ScoreLayerGroupType,
  type ScoreLayerSnapshot,
  type ScoreRowObjectSnapshot,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLocationRef,
  type ScorePatch,
  type SupportedNewInstrumentType,
  type TempoMapPatch,
  type ToolbarProjectTransportSnapshot,
  type UdoDefinitionSnapshot,
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

let latestProjectPatchRequestId = 0;
let latestProjectSessionId = 0;

export function getProjectDocumentRevision(): number {
  return latestProjectPatchRequestId;
}

export function acceptProjectDocumentRevision(sessionId: number, revision: number): void {
  if (!Number.isInteger(sessionId) || sessionId < 0 || !Number.isInteger(revision) || revision < 0) return;
  if (sessionId !== latestProjectSessionId) {
    resetTransientProjectMutationState();
    latestProjectSessionId = sessionId;
  }
  latestProjectPatchRequestId = Math.max(latestProjectPatchRequestId, revision);
}

let pendingPatches: ProjectDocumentPatch[] = [];
let pendingPatchTimer: ReturnType<typeof setTimeout> | null = null;
let storeGet: any;
let storeSet: any;
const PATCH_FLUSH_DELAY_MS = 100;
let nextLocalScoreObjectId = 1;

let pendingFlushPromise: Promise<void> | null = null;
let pendingDirtyBaseline: boolean | null = null;
let pendingSequenceChanged = false;

function scorePatchRequiresCanonicalProjectRefresh(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'renameLayer':
    case 'renameLayerGroup':
    case 'moveLayerGroup':
    case 'removeLayerGroup':
    case 'assignAutomationToLayer':
    case 'removeAutomationFromLayer':
    case 'moveAutomationToLayer':
    case 'clearLayerAutomations':
    case 'cleanupLayerAutomation':
    case 'selectLayerAutomation':
    case 'setAutomationLineColor':
    case 'setAutomationPoints':
    case 'insertAutomationPoint':
    case 'deleteAutomationPoint':
    case 'moveAutomationPoint':
    case 'moveAutomationRange':
    case 'scaleAutomationRange':
      return true;
    case 'addLayerGroup':
      return patch.groupType === 'audio';
    default:
      return false;
  }
}

function patchesRequireCanonicalProjectRefresh(
  patches: ProjectDocumentPatch[],
): boolean {
  return patches.some(
    (patch) => (
      (patch.score !== undefined && scorePatchRequiresCanonicalProjectRefresh(patch.score))
      || patch.mixer?.type === 'renameChannelListGroup'
      || patch.clojureProject !== undefined
    ),
  );
}

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

  switch (groupType) {
    case 'audio':
      return {
        groupId,
        groupType: 'audio',
        name: 'Audio Layer Group',
        layerCount: layers.length,
        isOpenableContainer: false,
        layers,
      };
    case 'patterns':
      return {
        groupId,
        groupType: 'patterns',
        name: 'Patterns Layer Group',
        layerCount: layers.length,
        isOpenableContainer: false,
        layers,
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
      && ((group.groupType === 'audio' && allAudio) || (group.groupType === 'polyObject' && allSoundObjects))
  ));
}

function finishPendingDirtySequenceIfSettled(): void {
  if (pendingPatches.length > 0 || pendingDirtyBaseline === null) {
    return;
  }
  if (!pendingSequenceChanged) {
    storeSet({ isDirty: pendingDirtyBaseline });
  }
  pendingDirtyBaseline = null;
  pendingSequenceChanged = false;
}

const doFlushAsync = async (): Promise<void> => {
  const patches = pendingPatches.slice();
  pendingPatches = [];
  if (patches.length === 0) {
    return;
  }

  try {
    const receipt = await window.blueAPI.commitProjectDocumentPatches(patches);
    pendingSequenceChanged = pendingSequenceChanged || receipt.changed !== false;
    if (receipt?.revision !== undefined) {
      if (receipt.sessionId === latestProjectSessionId) {
        latestProjectPatchRequestId = receipt.revision;
      }
    }

    if (patchesRequireCanonicalProjectRefresh(patches)) {
      try {
        const snapshot = await window.blueAPI.getProjectDocument();
        if (snapshot) {
          applyProjectInfoToState(snapshot, true);
        }
      } catch (refreshErr: unknown) {
        console.error('[project-store] Failed to refresh canonical project state after commit:', refreshErr);
      }
    }
    finishPendingDirtySequenceIfSettled();
  } catch (err: unknown) {
    // Recover the canonical view and reject. Background callers attach their
    // own toast handler; explicit live-command barriers observe this rejection.
    try {
      const snapshot = await window.blueAPI.getProjectDocument();
      if (snapshot) {
        applyProjectInfoToState(snapshot, true);
      }
    } catch (recoveryErr: unknown) {
      console.error('[project-store] Failed to recover canonical project state after commit error:', recoveryErr);
    }
    finishPendingDirtySequenceIfSettled();
    throw err instanceof Error ? err : new Error(String(err));
  }
};

const startFlush = (): Promise<void> => {
  if (pendingFlushPromise) {
    return pendingFlushPromise;
  }

  pendingFlushPromise = doFlushAsync().finally(() => {
    pendingFlushPromise = null;
  });

  return pendingFlushPromise;
};

const scheduleFlush = (): void => {
  if (pendingPatchTimer) {
    clearTimeout(pendingPatchTimer);
  }

  pendingPatchTimer = setTimeout(() => {
    pendingPatchTimer = null;
    void startFlush().catch((err: unknown) => {
      toast.error(`Failed to save project changes: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, PATCH_FLUSH_DELAY_MS);
};

export const __testFlushPendingPatches = (): void => {
  if (pendingPatchTimer) {
    clearTimeout(pendingPatchTimer);
    pendingPatchTimer = null;
  }

  void startFlush().catch((err: unknown) => {
    toast.error(`Failed to save project changes: ${err instanceof Error ? err.message : String(err)}`);
  });
};

export const __testAwaitPendingPatches = async (): Promise<void> => {
  while (pendingFlushPromise) {
    await pendingFlushPromise.catch(() => undefined);
  }
};

export const __testClearPendingPatches = (): void => {
  if (pendingPatchTimer) {
    clearTimeout(pendingPatchTimer);
    pendingPatchTimer = null;
  }

  pendingPatches = [];
  pendingFlushPromise = null;
  pendingDirtyBaseline = null;
  pendingSequenceChanged = false;
};

function resetTransientProjectMutationState(): void {
  latestProjectPatchRequestId = 0;
  latestProjectSessionId = 0;
  pendingPatches = [];
  pendingDirtyBaseline = null;
  pendingSequenceChanged = false;
  if (pendingPatchTimer) {
    clearTimeout(pendingPatchTimer);
    pendingPatchTimer = null;
  }
  pendingFlushPromise = null;
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

  const baseUpdate = {
    assignmentId: patch.orchestra.assignmentId,
    widgetId: bsbPatch.type === 'updateWidgetProperties' || bsbPatch.type === 'updateSliderBankValue'
      ? bsbPatch.widgetId
      : undefined,
  };

  switch (bsbPatch.type) {
    case 'updateWidgetProperties': {
      const properties = bsbPatch.properties;
      if (typeof properties.value === 'number') {
        return {
          ...baseUpdate,
          widgetId: bsbPatch.widgetId,
          kind: 'value',
          payload: { value: properties.value },
        };
      }

      if (typeof properties.selectedIndex === 'number') {
        return {
          ...baseUpdate,
          widgetId: bsbPatch.widgetId,
          kind: 'selectedIndex',
          payload: { selectedIndex: properties.selectedIndex },
        };
      }

      if (typeof properties.selected === 'boolean') {
        return {
          ...baseUpdate,
          widgetId: bsbPatch.widgetId,
          kind: 'selected',
          payload: { selected: properties.selected },
        };
      }

      if (typeof properties.xValue === 'number' && typeof properties.yValue === 'number') {
        return {
          ...baseUpdate,
          widgetId: bsbPatch.widgetId,
          kind: 'xy',
          payload: { xValue: properties.xValue, yValue: properties.yValue },
        };
      }

      return undefined;
    }
    case 'updateSliderBankValue':
      return {
        ...baseUpdate,
        widgetId: bsbPatch.widgetId,
        kind: 'sliderBank',
        payload: {
          value: bsbPatch.value,
          sliderIndex: bsbPatch.sliderIndex,
        },
      };
    default:
      return undefined;
  }
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
    }
    return;
  }

  storeSet((state: ProjectState) => {
    const incomingSessionId = info.sessionId ?? state.sessionId;
    if (incomingSessionId !== latestProjectSessionId) {
      resetTransientProjectMutationState();
      latestProjectSessionId = incomingSessionId;
    }

    const nextProjectProperties = info.projectProperties
      ? mergeProjectProperties(state.projectProperties, info.projectProperties)
      : state.projectProperties;
    const nextOrchestra = info.orchestra ?? state.orchestra;
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
      clojureProject: info.clojureProject
        ? cloneClojureProjectSnapshot(info.clojureProject)
        : state.clojureProject,
      transport: nextTransport,
      tablesText: info.tablesText ?? state.tablesText,
      projectUdos: info.projectUdos ?? state.projectUdos,
      blueLive: info.blueLive ?? state.blueLive,
      midiInput: info.midiInput ?? state.midiInput,
      score: info.score ?? state.score,
    };
  });
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

interface AudioLayerSnapshotLocation {
  groupId: string;
  layerIndex: number;
  layerId: string;
}

function collectAudioLayerSnapshotLocations(
  score: ScoreDocumentSnapshot,
): AudioLayerSnapshotLocation[] {
  const result: AudioLayerSnapshotLocation[] = [];

  for (const group of score.layerGroups) {
    if (group.groupType !== 'audio') {
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

function applyAudioLayerRenameToMixerSnapshot(
  mixer: MixerSnapshot,
  score: ScoreDocumentSnapshot,
  patch: Extract<ScorePatch, { type: 'renameLayer' }>,
): MixerSnapshot {
  const audioLayers = collectAudioLayerSnapshotLocations(score);
  const targetLayer = audioLayers.find(
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

function applyMixerChannelRenameToAudioLayerSnapshot(
  score: ScoreDocumentSnapshot,
  mixer: MixerSnapshot,
  patch: Extract<MixerPatch, { type: 'updateChannel' }>,
): ScoreDocumentSnapshot {
  if (patch.patch.name === undefined) {
    return score;
  }

  const audioLayerLocations = collectAudioLayerSnapshotLocations(score);
  const audioLayerIds = new Set(audioLayerLocations.map((layer) => layer.layerId));
  const targetChannel = getMixerSourceChannels(mixer).find((channel) => channel.id === patch.channelId);
  const targetAssociation = targetChannel?.association;
  if (!targetAssociation || !audioLayerIds.has(targetAssociation)) {
    return score;
  }

  const targetLayer = audioLayerLocations.find((layer) => layer.layerId === targetAssociation);
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

function applyScorePatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: ScorePatch,
): ScoreDocumentSnapshot {
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
      const newLayer: ScoreLayerSnapshot = {
        layerId: `layer-${Date.now()}`,
        name: '',
        height: 44,
        muted: false,
        solo: false,
        items: [],
      };
      const layers = [...lg.layers];
      layers.splice(patch.layerIndex + 1, 0, newLayer);
      return { ...lg, layers, layerCount: layers.length };
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
          if (item.editorTarget?.editorObjectType === 'TrackerObject') {
            const nextEditor = { ...item.editorTarget } as any;
            if (typePatch.steps !== undefined) nextEditor.steps = typePatch.steps;
            if (typePatch.stepsPerBeat !== undefined) nextEditor.stepsPerBeat = typePatch.stepsPerBeat;
            if (typePatch.octave !== undefined) nextEditor.octave = typePatch.octave;
            if (typePatch.showNoteNames !== undefined) nextEditor.showNoteNames = typePatch.showNoteNames;

            return { ...item, editorTarget: nextEditor };
          }

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
  return { ...instrument };
}

function cloneArrangementRowSnapshot(row: ArrangementRowSnapshot): ArrangementRowSnapshot {
  return { ...row };
}

function clonePresetGroupSnapshot(
  group: PresetGroupSnapshot,
): PresetGroupSnapshot {
  return {
    ...group,
    subGroups: group.subGroups.map((subGroup) => clonePresetGroupSnapshot(subGroup)),
    presets: group.presets.map((preset) => ({
      ...preset,
      values: preset.values ? { ...preset.values } : undefined,
    })),
  };
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
    case 'generic': {
      const instrument = new GenericInstrument();
      return {
        assignmentId,
        type: 'generic',
        name: instrument.getName(),
        enabled,
        comment: instrument.getComment(),
        text: instrument.getText(),
        globalOrc: instrument.getGlobalOrc(),
        globalSco: instrument.getGlobalSco(),
      };
    }
    case 'javascript': {
      const instrument = new JavaScriptInstrument();
      return {
        assignmentId,
        type: 'javascript',
        name: instrument.getName(),
        enabled,
        comment: instrument.getComment(),
        text: instrument.getText(),
        globalOrc: instrument.getGlobalOrc(),
        globalSco: instrument.getGlobalSco(),
      };
    }
    case 'blueX7': {
      const instrument = new BlueX7();
      return {
        assignmentId,
        type: 'blueX7',
        name: instrument.getName(),
        enabled,
        comment: instrument.getComment(),
      };
    }
    case 'blueSynthBuilder': {
      const instrument = new BlueSynthBuilder();
      return {
        assignmentId,
        type: 'blueSynthBuilder',
        name: instrument.getName(),
        enabled,
        comment: instrument.getComment(),
        instrumentText: instrument.getInstrumentText(),
        alwaysOnInstrumentText: instrument.getAlwaysOnInstrumentText(),
        globalOrc: instrument.getGlobalOrc(),
        globalSco: instrument.getGlobalSco(),
        objectNames: [],
        widgets: [],
        editEnabled: true,
        gridSettings: { columns: 8, rows: 4, snap: true },
        widgetTree: { id: 'root', type: 'BSBRootGroup', objectName: '', x: 0, y: 0, width: 0, height: 0, value: 0, minimum: 0, maximum: 1, properties: {}, editable: true, children: [] },
      };
    }
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

  const previousObjectNames = orchestra.instruments[instrumentIndex]!.objectNames;
  const previousWidgets = orchestra.instruments[instrumentIndex]!.widgets;
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
      const preserveWidgetMetadata = shouldPreserveWidgetMetadataForBsbPatch(patch.bsbInterface);
      applyBsbInterfacePatchToSnapshot(instrument, patch.bsbInterface);
      if (preserveWidgetMetadata) {
        instrument.objectNames = previousObjectNames;
        instrument.widgets = previousWidgets;
      }
    }
  }
}

export function applyBsbInterfacePatchToSnapshot(
  instrument: BlueSynthBuilderInstrumentSnapshot,
  patch: BsbInterfacePatch,
): void {
  const getSnapshotWidgetValue = (node: BsbWidgetNodeSnapshot): number => {
    if (node.type === 'BSBValue' && typeof node.properties.defaultValue === 'number') {
      return node.properties.defaultValue;
    }
    if (node.type === 'BSBCheckBox') {
      return node.properties.selected === true ? 1 : 0;
    }
    if (node.type === 'BSBDropdown' && typeof node.properties.selectedIndex === 'number') {
      return node.properties.selectedIndex;
    }
    return typeof node.value === 'number' ? node.value : 0;
  };

  const clampToRange = (value: number, minimum: number, maximum: number): number => (
    Math.min(maximum, Math.max(minimum, value))
  );

  const snapToResolution = (value: number, minimum: number, maximum: number, resolution: number): number => {
    if (!Number.isFinite(resolution) || resolution <= 0) {
      return clampToRange(value, minimum, maximum);
    }

    const snapped = minimum + (Math.round((value - minimum) / resolution) * resolution);
    return clampToRange(snapped, minimum, maximum);
  };

  const rescaleValue = (
    value: number,
    oldMinimum: number,
    oldMaximum: number,
    newMinimum: number,
    newMaximum: number,
    resolution: number,
  ): number => {
    if (oldMaximum === oldMinimum) {
      return snapToResolution(newMinimum, newMinimum, newMaximum, resolution);
    }

    const normalized = (value - oldMinimum) / (oldMaximum - oldMinimum);
    const nextValue = newMinimum + (normalized * (newMaximum - newMinimum));
    return snapToResolution(nextValue, newMinimum, newMaximum, resolution);
  };

  const getNodeResolution = (node: BsbWidgetNodeSnapshot): number => (
    typeof node.properties.resolution === 'number' ? node.properties.resolution : -1
  );

  const rescaleNodeMinimum = (node: BsbWidgetNodeSnapshot, newMinimum: number): void => {
    const oldMinimum = node.minimum;
    const oldMaximum = node.maximum;

    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliders = Array.isArray(node.properties.sliders)
        ? node.properties.sliders as Array<{ value?: number }>
        : [];
      node.minimum = newMinimum;
      node.properties.minimum = newMinimum;
      node.properties.sliders = sliders.map((slider) => ({
        ...slider,
        value: rescaleValue(
          typeof slider.value === 'number' ? slider.value : oldMinimum,
          oldMinimum,
          oldMaximum,
          newMinimum,
          oldMaximum,
          getNodeResolution(node),
        ),
      }));
      return;
    }

    node.minimum = newMinimum;
    node.properties.minimum = newMinimum;
    node.value = rescaleValue(node.value, oldMinimum, oldMaximum, newMinimum, oldMaximum, getNodeResolution(node));
    if (node.type === 'BSBValue') {
      node.properties.defaultValue = node.value;
    }
  };

  const rescaleNodeMaximum = (node: BsbWidgetNodeSnapshot, newMaximum: number): void => {
    const oldMinimum = node.minimum;
    const oldMaximum = node.maximum;

    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliders = Array.isArray(node.properties.sliders)
        ? node.properties.sliders as Array<{ value?: number }>
        : [];
      node.maximum = newMaximum;
      node.properties.maximum = newMaximum;
      node.properties.sliders = sliders.map((slider) => ({
        ...slider,
        value: rescaleValue(
          typeof slider.value === 'number' ? slider.value : oldMinimum,
          oldMinimum,
          oldMaximum,
          oldMinimum,
          newMaximum,
          getNodeResolution(node),
        ),
      }));
      return;
    }

    node.maximum = newMaximum;
    node.properties.maximum = newMaximum;
    node.value = rescaleValue(node.value, oldMinimum, oldMaximum, oldMinimum, newMaximum, getNodeResolution(node));
    if (node.type === 'BSBValue') {
      node.properties.defaultValue = node.value;
    }
  };

  const syncWidgetListFromTree = (): void => {
    if (!instrument.widgetTree?.children) {
      instrument.widgets = [];
      return;
    }

    const nextWidgets: typeof instrument.widgets = [];
    const visit = (node: BsbWidgetNodeSnapshot): void => {
      if (node.objectName) {
        nextWidgets.push({
          objectName: node.objectName,
          widgetType: node.type,
          value: getSnapshotWidgetValue(node),
          minimum: node.minimum,
          maximum: node.maximum,
        });
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    };

    instrument.widgetTree.children.forEach(visit);
    instrument.widgets = nextWidgets.sort((left, right) => left.objectName.localeCompare(right.objectName));
  };

  const syncSliderBankLayout = (node: BsbWidgetNodeSnapshot): void => {
    const sliderCount = Array.isArray(node.properties.sliders)
      ? Math.max(1, node.properties.sliders.length)
      : typeof node.properties.numberOfSliders === 'number'
        ? Math.max(1, node.properties.numberOfSliders)
        : 1;
    const gap = typeof node.properties.gap === 'number' ? node.properties.gap : 5;
    const showValue = node.properties.valueDisplayEnabled === true;

    if (node.type === 'BSBHSliderBank') {
      const sliderWidth = typeof node.properties.sliderWidth === 'number' ? node.properties.sliderWidth : 150;
      const size = getHSliderBankDisplaySize(sliderCount, sliderWidth, gap, showValue);
      node.width = size.width;
      node.height = size.height;
    } else if (node.type === 'BSBVSliderBank') {
      const sliderHeight = typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
      const size = getVSliderBankDisplaySize(sliderCount, sliderHeight, gap, showValue);
      node.width = size.width;
      node.height = size.height;
    }
  };

  const parsePresetNumber = (raw: string): number | null => {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseLegacyPresetNumber = (raw: string): number | null => {
    return parsePresetNumber(raw.startsWith('ver2:') ? raw.substring(5) : raw);
  };

  const applyLineObjectPreset = (
    node: BsbWidgetNodeSnapshot,
    raw: string,
  ): void => {
    const existingLines = Array.isArray(node.properties.lines)
      ? (node.properties.lines as Array<{
          varName?: string;
          min?: number;
          max?: number;
          color?: string;
          points?: Array<{ x: number; y: number }>;
        }>).map((line) => ({
          ...line,
          points: Array.isArray(line.points) ? line.points.map((point) => ({ ...point })) : [],
        }))
      : [];

    const parts = raw.split('@_@');
    let version = 1;
    let startIndex = 0;
    if (parts[0]?.startsWith('version=')) {
      version = parseInt(parts[0].substring(8), 10) || 1;
      startIndex = 1;
    }

    for (let index = startIndex; index < parts.length; index++) {
      const values = parts[index].split(':');
      const lineName = values[0];
      const lineIndex = existingLines.findIndex((candidate) => candidate.varName === lineName);
      if (lineIndex < 0) continue;

      const line = existingLines[lineIndex]!;
      const min = typeof line.min === 'number' ? line.min : 0;
      const max = typeof line.max === 'number' ? line.max : 1;
      const range = max - min;
      const points: Array<{ x: number; y: number }> = [];

      for (let valueIndex = 1; valueIndex < values.length; valueIndex += 2) {
        const nextX = parseFloat(values[valueIndex]);
        const nextY = parseFloat(values[valueIndex + 1]);
        if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) continue;

        points.push({
          x: nextX,
          y: version === 1 ? (nextY * range) + min : nextY,
        });
      }

      existingLines[lineIndex] = { ...line, points };
    }

    node.properties = { ...node.properties, lines: existingLines };
  };

  const applyPresetValueToNode = (
    node: BsbWidgetNodeSnapshot,
    raw: string,
  ): void => {
    if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
      const sliderValues = raw.split(':');
      const sliderCount = typeof node.properties.numberOfSliders === 'number'
        ? Math.max(1, node.properties.numberOfSliders)
        : Array.isArray(node.properties.sliders)
          ? Math.max(1, node.properties.sliders.length)
          : 1;
      const existingSliders = Array.isArray(node.properties.sliders)
        ? (node.properties.sliders as Array<{ value?: number }>).map((slider) => ({ ...slider }))
        : Array.from({ length: sliderCount }, () => ({ value: node.minimum ?? 0 }));
      const nextSliders = existingSliders.slice(0, sliderCount);

      for (let index = 0; index < Math.min(nextSliders.length, sliderValues.length); index++) {
        const parsed = parsePresetNumber(sliderValues[index]);
        if (parsed === null) continue;
        nextSliders[index] = { ...nextSliders[index], value: parsed };
      }

      node.properties = { ...node.properties, sliders: nextSliders };
      return;
    }

    if (node.type === 'BSBCheckBox') {
      const selected = raw.startsWith('ver2:')
        ? (parseLegacyPresetNumber(raw) ?? 0) > 0
        : raw.toLowerCase() === 'true';
      node.properties = { ...node.properties, selected };
      node.value = selected ? 1 : 0;
      return;
    }

    if (node.type === 'BSBDropdown') {
      let selectedIndex: number | null = null;
      if (raw.startsWith('id:')) {
        const uniqueId = raw.substring(3);
        const items = Array.isArray(node.properties.dropdownItems)
          ? node.properties.dropdownItems as Array<{ uniqueId?: string }>
          : [];
        const index = items.findIndex((item) => item?.uniqueId === uniqueId);
        selectedIndex = index >= 0 ? index : null;
      } else {
        selectedIndex = parseLegacyPresetNumber(raw);
      }

      if (selectedIndex !== null) {
        node.properties = { ...node.properties, selectedIndex };
        node.value = selectedIndex;
      }
      return;
    }

    if (node.type === 'BSBTextField') {
      node.properties = { ...node.properties, textValue: raw };
      return;
    }

    if (node.type === 'BSBValue') {
      const parsed = parseLegacyPresetNumber(raw);
      if (parsed !== null) {
        node.properties = { ...node.properties, defaultValue: parsed };
        node.value = parsed;
      }
      return;
    }

    if (node.type === 'BSBXYController') {
      const parts = raw.split(':');
      let nextX = Number.NaN;
      let nextY = Number.NaN;

      const xMin = typeof node.properties.xMin === 'number' ? node.properties.xMin : 0;
      const xMax = typeof node.properties.xMax === 'number' ? node.properties.xMax : 1;
      const yMin = typeof node.properties.yMin === 'number' ? node.properties.yMin : 0;
      const yMax = typeof node.properties.yMax === 'number' ? node.properties.yMax : 1;

      if (parts.length === 2) {
        const relativeX = parsePresetNumber(parts[0]);
        const relativeY = parsePresetNumber(parts[1]);
        if (relativeX !== null && relativeY !== null) {
          nextX = (relativeX * (xMax - xMin)) + xMin;
          nextY = (relativeY * (yMax - yMin)) + yMin;
        }
      } else if (parts.length >= 3) {
        nextX = parseFloat(parts[1]);
        nextY = parseFloat(parts[2]);
      }

      if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
        node.properties = { ...node.properties, xValue: nextX, yValue: nextY };
      }
      return;
    }

    if (node.type === 'BSBFileSelector') {
      node.properties = { ...node.properties, fileName: raw };
      return;
    }

    if (node.type === 'BSBSubChannelDropdown') {
      node.properties = { ...node.properties, channelOutput: raw };
      return;
    }

    if (node.type === 'BSBLineObject') {
      applyLineObjectPreset(node, raw);
      return;
    }

    if (node.type === 'BSBKnob') {
      if (raw.indexOf(':') < 0) {
        const relative = parsePresetNumber(raw);
        if (relative !== null) {
          node.value = (relative * (node.maximum - node.minimum)) + node.minimum;
        }
      } else {
        const parsed = parsePresetNumber(raw.substring(raw.indexOf(':') + 1));
        if (parsed !== null) {
          node.value = parsed;
        }
      }
      return;
    }

    const parsed = parseLegacyPresetNumber(raw);
    if (parsed !== null) {
      node.value = parsed;
    }
  };

  const cloneWidgetNode = (node: BsbWidgetNodeSnapshot): BsbWidgetNodeSnapshot => cloneSnapshotValue(node);

  const createPastedWidgetId = (): string => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pasted-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  const normalizePastedWidgetNode = (raw: unknown): BsbWidgetNodeSnapshot | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const record = raw as Record<string, unknown>;
    if (typeof record.type !== 'string') {
      return null;
    }

    const node = cloneSnapshotValue(record) as BsbWidgetNodeSnapshot;
    node.id = createPastedWidgetId();
    node.objectName = typeof node.objectName === 'string' ? node.objectName : '';
    node.x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0;
    node.y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0;
    node.width = typeof node.width === 'number' && Number.isFinite(node.width) ? node.width : 60;
    node.height = typeof node.height === 'number' && Number.isFinite(node.height) ? node.height : 24;
    node.value = typeof node.value === 'number' && Number.isFinite(node.value) ? node.value : 0;
    node.minimum = typeof node.minimum === 'number' && Number.isFinite(node.minimum) ? node.minimum : 0;
    node.maximum = typeof node.maximum === 'number' && Number.isFinite(node.maximum) ? node.maximum : 1;
    node.editable = node.editable !== false;
    node.properties = node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? cloneSnapshotValue(node.properties)
      : {};

    if (Array.isArray(record.children)) {
      node.children = record.children
        .map((child) => normalizePastedWidgetNode(child))
        .filter((child): child is BsbWidgetNodeSnapshot => child !== null);
    }

    return node;
  };

  const syncWidgetTreeLayout = (
    previousNode: BsbWidgetNodeSnapshot | undefined,
    nextNode: BsbWidgetNodeSnapshot,
  ): BsbWidgetNodeSnapshot => {
    if (previousNode === nextNode) {
      return nextNode;
    }

    let nextLayoutNode = nextNode;

    if (nextNode.children && nextNode.children.length > 0) {
      const previousChildren = previousNode?.children ?? [];
      const nextChildren = nextNode.children.map((child, index) =>
        syncWidgetTreeLayout(previousChildren[index], child));
      const childrenChanged = nextChildren.some((child, index) => child !== nextNode.children?.[index]);
      if (childrenChanged) {
        nextLayoutNode = cloneWidgetNode(nextNode);
        nextLayoutNode.children = nextChildren;
      }
    }

    if (nextLayoutNode.type !== 'BSBRootGroup' && nextLayoutNode.type !== 'BSBGroup') {
      const size = getBsbWidgetDisplaySize(nextLayoutNode);
      if (nextLayoutNode.width !== size.width || nextLayoutNode.height !== size.height) {
        if (nextLayoutNode === nextNode) {
          nextLayoutNode = { ...nextNode };
        }
        nextLayoutNode.width = size.width;
        nextLayoutNode.height = size.height;
      }
    }

    return nextLayoutNode;
  };

  const rebuildWidgetIndexes = (): void => {
    if (!instrument.widgetTree?.children) {
      instrument.objectNames = [];
      instrument.widgets = [];
      return;
    }

    instrument.objectNames = collectObjectNamesFromTree(instrument.widgetTree);
    syncWidgetListFromTree();
  };

  const commitWidgetTreeMutation = (
    previousNode: BsbWidgetNodeSnapshot | undefined,
    nextNode: BsbWidgetNodeSnapshot,
  ): void => {
    instrument.widgetTree = syncWidgetTreeLayout(previousNode, nextNode);
    rebuildWidgetIndexes();
  };

  const updateWidgetTreeById = (
    node: BsbWidgetNodeSnapshot,
    widgetId: string,
    updater: (
      nextNode: BsbWidgetNodeSnapshot,
    ) => boolean,
  ): {
    node: BsbWidgetNodeSnapshot;
    changed: boolean;
  } => {
    if (node.id === widgetId) {
      const nextNode = cloneWidgetNode(node);
      return updater(nextNode)
        ? { node: nextNode, changed: true }
        : { node, changed: false };
    }

    if (!node.children) {
      return { node, changed: false };
    }

    let changed = false;
    const nextChildren = node.children.map((child) => {
      const result = updateWidgetTreeById(child, widgetId, updater);
      if (result.changed) {
        changed = true;
      }
      return result.node;
    });

    if (!changed) {
      return { node, changed: false };
    }

    const nextNode = cloneWidgetNode(node);
    nextNode.children = nextChildren;
    return { node: nextNode, changed: true };
  };

  const removeWidgetFromTree = (
    node: BsbWidgetNodeSnapshot,
    widgetId: string,
  ): {
    node: BsbWidgetNodeSnapshot;
    removed: boolean;
  } => {
    if (!node.children || node.children.length === 0) {
      return { node, removed: false };
    }

    const directIndex = node.children.findIndex((child) => child.id === widgetId);
    if (directIndex >= 0) {
      const nextNode = cloneWidgetNode(node);
      const nextChildren = node.children.slice();
      nextChildren.splice(directIndex, 1);
      nextNode.children = nextChildren;
      return { node: nextNode, removed: true };
    }

    let removed = false;
    const nextChildren = node.children.map((child) => {
      const result = removeWidgetFromTree(child, widgetId);
      if (result.removed) {
        removed = true;
      }
      return result.node;
    });

    if (!removed) {
      return { node, removed: false };
    }

    const nextNode = cloneWidgetNode(node);
    nextNode.children = nextChildren;
    return { node: nextNode, removed: true };
  };

  const applyPresetToTree = (
    node: BsbWidgetNodeSnapshot,
    valuesMap: Record<string, string>,
  ): {
    node: BsbWidgetNodeSnapshot;
    changed: boolean;
  } => {
    let nextNode = node;
    let changed = false;

    if (node.objectName && Object.prototype.hasOwnProperty.call(valuesMap, node.objectName)) {
      const raw = valuesMap[node.objectName];
      if (raw !== undefined) {
        nextNode = cloneWidgetNode(node);
        applyPresetValueToNode(nextNode, raw);
        changed = true;
      }
    }

    if (node.children) {
      let childrenChanged = false;
      const nextChildren = node.children.map((child) => {
        const result = applyPresetToTree(child, valuesMap);
        if (result.changed) {
          childrenChanged = true;
        }
        return result.node;
      });

      if (childrenChanged) {
        if (!changed) {
          nextNode = cloneWidgetNode(node);
          changed = true;
        }
        nextNode.children = nextChildren;
      }
    }

    return { node: nextNode, changed };
  };

  switch (patch.type) {
    case 'setEditEnabled':
      instrument.editEnabled = patch.value;
      break;
    case 'selectWidget':
      break;
    case 'updateWidgetProperties': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        for (const [key, value] of Object.entries(patch.properties)) {
          switch (key) {
            case 'objectName': node.objectName = value as string; break;
            case 'x': node.x = value as number; break;
            case 'y': node.y = value as number; break;
            case 'width': node.width = value as number; break;
            case 'height': node.height = value as number; break;
            case 'value': node.value = value as number; break;
            case 'defaultValue':
              node.properties.defaultValue = value as number;
              if (node.type === 'BSBValue') {
                node.value = value as number;
              }
              break;
            case 'minimum':
              rescaleNodeMinimum(node, value as number);
              break;
            case 'maximum':
              rescaleNodeMaximum(node, value as number);
              break;
            case 'selectedIndex':
              node.properties.selectedIndex = value as number;
              node.value = value as number;
              break;
            case 'sliderWidth':
              node.properties.sliderWidth = value as number;
              if (node.type === 'BSBHSliderBank') {
                syncSliderBankLayout(node);
              } else {
                node.width = (value as number) + (node.properties.valueDisplayEnabled ? 50 : 0);
              }
              break;
            case 'sliderHeight':
              node.properties.sliderHeight = value as number;
              if (node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              } else {
                node.height = (value as number) + (node.properties.valueDisplayEnabled ? 30 : 0);
              }
              break;
            case 'knobWidth':
              node.properties.knobWidth = value as number;
              node.width = value as number;
              break;
            case 'canvasWidth':
              node.properties.canvasWidth = value as number;
              node.width = value as number;
              break;
            case 'canvasHeight':
              node.properties.canvasHeight = value as number;
              node.height = node.type === 'BSBLineObject'
                ? (value as number) + BSB_LINE_SELECTOR_HEIGHT
                : (value as number);
              break;
            case 'textFieldWidth':
              node.properties.textFieldWidth = value as number;
              node.width = node.type === 'BSBFileSelector'
                ? (value as number) + 30
                : (value as number);
              break;
            case 'numberOfSliders': {
              const nextCount = Math.max(1, value as number);
              const previous = Array.isArray(node.properties.sliders)
                ? node.properties.sliders as Array<{ value?: number }>
                : [];
              node.properties.numberOfSliders = nextCount;
              node.properties.sliders = Array.from(
                { length: nextCount },
                (_unused, index) => previous[index] ?? { value: node.minimum ?? 0 },
              );
              syncSliderBankLayout(node);
              break;
            }
            case 'valueDisplayEnabled':
              node.properties.valueDisplayEnabled = value;
              if (node.type === 'BSBHSlider') {
                const sliderWidth = typeof node.properties.sliderWidth === 'number' ? node.properties.sliderWidth : 150;
                node.width = sliderWidth + (value ? 50 : 0);
              } else if (node.type === 'BSBVSlider') {
                const sliderHeight = typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
                node.height = sliderHeight + (value ? 30 : 0);
              } else if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              }
              break;
            case 'gap':
              node.properties.gap = value as number;
              if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
                syncSliderBankLayout(node);
              }
              break;
            case 'dropdownItems':
              if (Array.isArray(value)) {
                node.properties.dropdownItems = value.map((item) => {
                  const record = item as Record<string, unknown>;
                  return {
                    name: typeof record.name === 'string' ? record.name : '',
                    value: typeof record.value === 'string' ? record.value : '',
                    uniqueId: typeof record.uniqueId === 'string' && record.uniqueId.length > 0
                      ? record.uniqueId
                      : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                          ? `dropdown-${crypto.randomUUID()}`
                          : `dropdown-${Date.now()}-${Math.random().toString(16).slice(2)}`),
                  };
                });
              } else {
                node.properties.dropdownItems = value as unknown;
              }
              break;
            default: node.properties[key] = value; break;
          }
        }
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'updateSliderBankValue': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        const sliderCount = typeof node.properties.numberOfSliders === 'number'
          ? Math.max(1, node.properties.numberOfSliders)
          : Array.isArray(node.properties.sliders)
            ? Math.max(1, node.properties.sliders.length)
            : 1;
        const sliders = Array.isArray(node.properties.sliders)
          ? [...(node.properties.sliders as Array<{ value?: number }>)]
          : Array.from({ length: sliderCount }, () => ({ value: node.minimum ?? 0 }));
        if (patch.sliderIndex < 0 || patch.sliderIndex >= sliders.length) {
          return false;
        }
        sliders[patch.sliderIndex] = {
          ...sliders[patch.sliderIndex],
          value: patch.value,
        };
        node.properties.sliders = sliders;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'moveWidget': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        node.x = patch.x;
        node.y = patch.y;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'resizeWidget': {
      if (!instrument.widgetTree) break;
      const result = updateWidgetTreeById(instrument.widgetTree, patch.widgetId, (node) => {
        node.width = patch.width;
        node.height = patch.height;
        return true;
      });
      if (result.changed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
    case 'updateGridSettings':
      instrument.gridSettings = { ...instrument.gridSettings, ...patch.patch };
      break;
    case 'applyPreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetUniqueId = patch.presetUniqueId;
        instrument.presetGroup.currentPresetModified = false;
        const preset = findPresetById(instrument.presetGroup, patch.presetUniqueId);
        if (preset?.values && instrument.widgetTree) {
          const result = applyPresetToTree(instrument.widgetTree, preset.values);
          if (result.changed) {
            commitWidgetTreeMutation(instrument.widgetTree, result.node);
          }
        }
      }
      break;
    case 'updatePreset':
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetModified = false;
      }
      break;
    case 'addPreset':
      // Optimistic update - actual preset creation happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
        instrument.presetGroup.currentPresetModified = false;
      }
      break;
    case 'addPresetGroup':
      // Optimistic update - actual group creation happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
      }
      break;
    case 'synchronizePresets':
      // Optimistic update - actual sync happens on main process
      if (instrument.presetGroup) {
        instrument.presetGroup = clonePresetGroupSnapshot(instrument.presetGroup);
      }
      break;
    case 'updateEmbeddedOpcodeList':
      instrument.opcodeListText = patch.opcodeList;
      break;
    case 'addWidget': {
      if (!instrument.widgetTree) break;
      const newNode = createDefaultBsbWidgetSnapshot(patch.widgetType);
      if (!newNode) break;
      newNode.x = patch.x;
      newNode.y = patch.y;
      const targetId = patch.parentGroupId;
      if (targetId) {
        const result = updateWidgetTreeById(instrument.widgetTree, targetId, (node) => {
          if (node.type !== 'BSBGroup') {
            return false;
          }
          node.children = [...(node.children ?? []), cloneWidgetNode(newNode)];
          return true;
        });
        if (result.changed) {
          commitWidgetTreeMutation(instrument.widgetTree, result.node);
        }
      } else {
        const nextRoot = cloneWidgetNode(instrument.widgetTree);
        nextRoot.children = [...(nextRoot.children ?? []), cloneWidgetNode(newNode)];
        commitWidgetTreeMutation(instrument.widgetTree, nextRoot);
      }
      break;
    }
    case 'pasteWidgets': {
      if (!instrument.widgetTree) break;
      let parsed: unknown;
      try {
        parsed = JSON.parse(patch.widgetData);
      } catch {
        break;
      }
      if (!Array.isArray(parsed)) break;

      const pastedNodes = parsed
        .map((node) => normalizePastedWidgetNode(node))
        .filter((node): node is BsbWidgetNodeSnapshot => node !== null);
      if (pastedNodes.length === 0) break;

      const existingNames = new Set(collectObjectNamesFromTree(instrument.widgetTree));
      for (const node of pastedNodes) {
        ensureUniqueName(node, existingNames);
      }

      const targetId = patch.parentGroupId;
      if (targetId) {
        const result = updateWidgetTreeById(instrument.widgetTree, targetId, (node) => {
          if (node.type !== 'BSBGroup') {
            return false;
          }
          node.children = [...(node.children ?? []), ...pastedNodes.map((pasted) => cloneWidgetNode(pasted))];
          return true;
        });
        if (result.changed) {
          commitWidgetTreeMutation(instrument.widgetTree, result.node);
        }
      } else {
        const nextRoot = cloneWidgetNode(instrument.widgetTree);
        nextRoot.children = [...(nextRoot.children ?? []), ...pastedNodes.map((pasted) => cloneWidgetNode(pasted))];
        commitWidgetTreeMutation(instrument.widgetTree, nextRoot);
      }
      break;
    }
    case 'removeWidget': {
      if (!instrument.widgetTree) break;
      const result = removeWidgetFromTree(instrument.widgetTree, patch.widgetId);
      if (result.removed) {
        commitWidgetTreeMutation(instrument.widgetTree, result.node);
      }
      break;
    }
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
      instrument.opcodeListText = formatUdoListAsOpcodeText(udolist);
      break;
    }
    case 'removeUdo': {
      const removeUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.index >= 0 && patch.index < removeUdolist.length) {
        removeUdolist.splice(patch.index, 1);
      }
      instrument.udolist = removeUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(removeUdolist);
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
      instrument.opcodeListText = formatUdoListAsOpcodeText(updateUdolist);
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
      instrument.opcodeListText = formatUdoListAsOpcodeText(convertedUdolist);
      break;
    }
    case 'reorderUdo': {
      const reorderUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.from >= 0 && patch.from < reorderUdolist.length && patch.to >= 0 && patch.to < reorderUdolist.length) {
        const [moved] = reorderUdolist.splice(patch.from, 1);
        reorderUdolist.splice(patch.to, 0, moved);
      }
      instrument.udolist = reorderUdolist;
      instrument.opcodeListText = formatUdoListAsOpcodeText(reorderUdolist);
      break;
    }
    case 'randomize':
      break;
  }
}

function shouldPreserveWidgetMetadataForBsbPatch(patch: BsbInterfacePatch): boolean {
  switch (patch.type) {
    case 'updateWidgetProperties': {
      const properties = patch.properties as Record<string, unknown>;
      return !(
        Object.prototype.hasOwnProperty.call(properties, 'objectName')
        || Object.prototype.hasOwnProperty.call(properties, 'lines')
        || Object.prototype.hasOwnProperty.call(properties, 'numberOfSliders')
        || Object.prototype.hasOwnProperty.call(properties, 'sliders')
      );
    }
    case 'updateSliderBankValue':
    case 'moveWidget':
    case 'resizeWidget':
    case 'setEditEnabled':
    case 'selectWidget':
    case 'updateGridSettings':
    case 'applyPreset':
    case 'updatePreset':
    case 'addPreset':
    case 'addPresetGroup':
    case 'synchronizePresets':
    case 'updateEmbeddedOpcodeList':
    case 'randomize':
      return true;
    case 'addWidget':
    case 'removeWidget':
    default:
      return false;
  }
}

function applyEmbeddedOpcodeListPatchToSnapshot(
  instrument: (GenericInstrumentSnapshot | JavaScriptInstrumentSnapshot),
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

function collectObjectNamesFromTree(node: BsbWidgetNodeSnapshot): string[] {
  return collectBsbReplacementKeysFromSnapshotTree(node);
}

function findPresetById(
  group: PresetGroupSnapshot | undefined,
  uniqueId: string,
): PresetSnapshot | undefined {
  if (!group) return undefined;
  for (const p of group.presets) {
    if (p.uniqueId === uniqueId) return p;
  }
  for (const sub of group.subGroups) {
    const found = findPresetById(sub, uniqueId);
    if (found) return found;
  }
  return undefined;
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
      nextRows.push({
        assignmentId,
        enabled: pastedInstrument.enabled,
        instrumentName: pastedInstrument.name,
        instrumentType: pastedInstrument.type,
        instrumentSummary: pastedInstrument.type,
        editable: true,
      });
      nextInstruments.push(pastedInstrument);
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
  storeGet = get;
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

    if (pendingDirtyBaseline === null) {
      pendingDirtyBaseline = get().isDirty;
      pendingSequenceChanged = false;
    }

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
          next.score = applyMixerChannelRenameToAudioLayerSnapshot(
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
          next.mixer = applyAudioLayerRenameToMixerSnapshot(
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

    pendingPatches.push(normalizedPatch);

    scheduleFlush();
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

  generateCsdToDisk: async () => {
    await window.blueAPI.generateCsdToDisk();
  },

  flushPendingPatches: async () => {
    if (pendingPatchTimer) {
      clearTimeout(pendingPatchTimer);
      pendingPatchTimer = null;
    }
    // Drain both a currently active commit and any edits queued while it was in
    // flight. The raw commit promise rejects, so live commands cannot continue
    // after a failed acknowledgement.
    while (pendingFlushPromise || pendingPatches.length > 0) {
      await (pendingFlushPromise ?? startFlush());
    }
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
