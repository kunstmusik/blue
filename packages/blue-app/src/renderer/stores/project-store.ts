import { updateScoreGroupLayers } from '../lib/score-layer-snapshots';
import {
  applyBlueLivePatchToSnapshot,
  applyMidiInputPatchToSnapshot,
  applyOrchestraPatchSnapshot,
  applyProjectUdoPatchToSnapshot,
  bsbActionLabelContext,
  createDefaultMidiInputSnapshot,
} from './project-store/orchestra-snapshot-reducer';
import {
  applyMeterMapPatchToSnapshot,
  applyMoveScoreObjectsToSnapshot,
  updateScoreItemLocation,
  applyScorePatchToSnapshot,
  applyTempoMapPatchToSnapshot,
  computeEndOfScore,
  createLocalScoreObjectId,
  createOptimisticBarRendererSnapshot,
  findAddScoreObjectsTargetGroupIndex,
  resolveOptimisticScoreObjectColor,
} from './project-store/score-snapshot-reducer';
import {
  applyMixerPatchToSnapshot,
  applyTrackRenameToMixerSnapshot,
  applyMixerChannelRenameToTrackSnapshot,
} from './project-store/mixer-snapshot-reducer';
import { create } from 'zustand';
import type { PanLawDb } from '@blue/data';
import { toast } from 'sonner';
import { getProjectHistoryProjection } from '../hooks/use-project-history';
import {
  createEmptyProjectEditorSnapshot,
  createEmptyScratchPadSnapshot,
  createEmptyMixerSnapshot,
  createEmptyScoreDocumentSnapshot,
  createBsbRealtimeControlUpdate,
  reconcileMixerSnapshotWithArrangement,
  type BlueLiveProjectSnapshot,
  type BlueLivePatch,
  type ClojureProjectSnapshot,
  type BsbRealtimeControlUpdate,
  type MidiInputProcessorSnapshot,
  type MixerPatch,
  type MixerSnapshot,
  type ProjectDocumentPatch,
  type ProjectLoadedPayload,
  type ProjectEditorSnapshot,
  type ProjectPropertiesSnapshot,
  type ScratchPadPatch,
  type ScratchPadSnapshot,
  type OrchestraPatch,
  type OrchestraSnapshot,
  type ProjectUdoPatch,
  type ScoreDocumentSnapshot,
  type ScoreRowObjectSnapshot,
  type ScoreObjectEditorTargetSnapshot,
  type ScorePatch,
  type ToolbarProjectTransportSnapshot,
  type UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import type { MissingAudioAssetsSession } from '../../shared/missing-audio-assets';
import type {
  PrepareHistoryBoundaryEvent,
  ProjectDocumentCommitMetadata,
  ProjectHistorySelectionHint,
  ProjectRuntimeOutcome,
  ReleaseHistoryBoundaryEvent,
} from '../../shared/project-history';

/**
 * Stable participant identity for this renderer JS context. Dockview popouts
 * share the main renderer context; dedicated editor windows get their own.
 */
const RENDERER_PARTICIPANT_CONTEXT_ID = `renderer-${crypto.randomUUID()}`;
import {
  bsbInterfaceActionLabel,
  orchestraPatchActionLabel,
  mixerPatchActionLabel,
  effectiveTrackLayerMuteSoloMode,
} from '../../shared/project-editor';
import { useMidiRoutingStore, type MidiRoutingReconciliation } from './midi-routing-store';
import { useLayerSelectionStore } from './layer-selection-store';
import { useScoreSelectionStore } from './score-selection-store';
import {
  createProjectPatchQueue,
  type ProjectPatchQueue,
  type ProjectPatchQueueClojureFieldIntent,
  type ProjectPatchQueuePendingPatch,
  type ClojureFieldConflict,
} from './project-store/project-patch-queue';

export { applyBsbInterfacePatchToSnapshot } from './project-store/bsb-interface-snapshot';

interface ProjectState {
  title: string;
  author: string;
  sampleRate: string;
  version: string;
  filePath: string | null;
  sessionId: number;
  documentId: string | null;
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
  clojureFieldConflicts: readonly ClojureFieldConflict[];
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
  runtimeOutcomes: ProjectRuntimeOutcome[];
  runtimeOutcomeStatusText: string;
  activeOversizeProposal: OversizeProposalInfo | null;
}

export interface OversizeProposalInfo {
  token: string;
  estimatedBytes: number;
  limitBytes: number;
  explanation: string;
  documentId: string;
  revision: number;
  patches: readonly ProjectDocumentPatch[];
}

interface AudioClipEditorPreview {
  fileStartTime?: number;
  fadeIn?: number;
  fadeOut?: number;
}

const RUNTIME_OUTCOME_PRECEDENCE: Record<ProjectRuntimeOutcome['status'], number> = {
  applied: 0,
  pending: 1,
  'restart-required': 2,
  failed: 3,
};

function mergeRuntimeOutcome(
  previous: ProjectRuntimeOutcome | undefined,
  incoming: ProjectRuntimeOutcome,
): ProjectRuntimeOutcome {
  if (!previous || incoming.generation !== previous.generation) return incoming;

  const previousRank = RUNTIME_OUTCOME_PRECEDENCE[previous.status];
  const incomingRank = RUNTIME_OUTCOME_PRECEDENCE[incoming.status];
  const affectedOwnerIds = [
    ...new Set([...(previous.affectedOwnerIds ?? []), ...(incoming.affectedOwnerIds ?? [])]),
  ];

  // A successful operation can clear a failed obligation only when it names
  // the failed owner. Unrelated live work must not hide persistent failure.
  if (
    previous.status === 'failed' &&
    incoming.status === 'applied' &&
    (incoming.affectedOwnerIds ?? []).some((ownerId) =>
      (previous.affectedOwnerIds ?? []).includes(ownerId),
    )
  ) {
    return incoming;
  }

  if (incomingRank >= previousRank) {
    return { ...incoming, affectedOwnerIds };
  }

  return {
    ...previous,
    desiredRevision: incoming.desiredRevision,
    affectedOwnerIds,
  };
}

interface ProjectActions {
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  setProjectInfo: (info: ProjectLoadedPayload | null) => void;
  confirmOversizeProposal: () => Promise<void>;
  cancelOversizeProposal: () => Promise<void>;
  clearOversizeProposal: () => void;
  /**
   * Applies a canonical publication from main (other contexts, undo/redo
   * replays) without the load/reset semantics: pending local overlays and
   * selections survive, and the dirty projection comes from the event's
   * authoritative saved-checkpoint state rather than being reset.
   */
  refreshFromCanonical: (info: ProjectLoadedPayload, dirtyProjection: boolean) => void;
  /** Fetches and reapplies the current canonical document without resetting dirty state. */
  refreshCanonicalSnapshot: () => Promise<void>;
  handleRuntimeOutcomes: (
    outcomes: ProjectRuntimeOutcome[],
    context?: {
      documentId?: string;
      revision?: number;
      resetObsolete?: boolean;
      clearPerformanceKind?: ProjectRuntimeOutcome['performanceKind'];
    },
  ) => void;
  setLoading: (loading: boolean) => void;
  markDirty: () => void;
  markClean: () => void;
  clearProject: () => void;
  applyProjectDocumentPatch: (
    patch: ProjectDocumentPatch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  updateGlobalOrc: (globalOrc: string, metadata?: ProjectDocumentCommitMetadata) => Promise<void>;
  updateGlobalSco: (globalSco: string, metadata?: ProjectDocumentCommitMetadata) => Promise<void>;
  updateOrchestra: (
    orchestra: OrchestraPatch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  updateProjectProperties: (
    patch: Partial<ProjectPropertiesSnapshot>,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  updateScratchPad: (
    patch: ScratchPadPatch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  updateClojureProject: (
    clojureProject: ClojureProjectSnapshot,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  setLoopRendering: (
    loopRendering: boolean,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  addMarkerAtTime: (timeBeats: number, metadata?: ProjectDocumentCommitMetadata) => void;
  addMarkerAtRenderStart: () => void;
  updateTablesText: (tablesText: string, metadata?: ProjectDocumentCommitMetadata) => Promise<void>;
  applyProjectUdoPatch: (
    patch: ProjectUdoPatch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  applyBlueLivePatch: (
    patch: BlueLivePatch,
    metadata?: ProjectDocumentCommitMetadata,
  ) => Promise<void>;
  setGeneratedCsd: (csd: { text: string; title: string } | null) => void;
  generateCsdToScreen: () => Promise<void>;
  generateRealtimeCsdToScreen: () => Promise<void>;
  generateCsdToDisk: () => Promise<void>;
  flushPendingPatches: () => Promise<void>;
  moveScoreObjects: (
    moves: Array<{
      objectId: string;
      targetStartBeats: number;
      targetLayerIndex?: number;
      targetGroupId?: string;
    }>,
  ) => void;
  removeScoreObjects: (objectIds: ReadonlySet<string>) => void;
  addScoreObjects: (
    objects: Array<{
      layerIndex: number;
      groupId: string;
      name: string;
      startBeats: number;
      durationBeats: number;
      startTimeBase?: string;
      durationTimeBase?: string;
      backgroundColor?: number;
      objectType: string;
      isContainer: boolean;
      editorTarget?: ScoreObjectEditorTargetSnapshot;
      serializedXml?: string;
      barRenderer?: ScoreRowObjectSnapshot['barRenderer'];
    }>,
  ) => void;
  setLayerBackgroundColor: (groupId: string, layerIndex: number, color: number) => void;
  setLayerMute: (groupId: string, layerIndex: number, muted: boolean) => void;
  setLayerSolo: (groupId: string, layerIndex: number, solo: boolean) => void;
  /**
   * Spec 111: resolves which state a track header edit controls. 'audio'
   * targets the associated mixer channel; 'event' keeps layer-state patches.
   */
  resolveTrackHeaderAuthority: (
    groupId: string,
    layerId: string,
  ) =>
    | { authority: 'audio'; channelId: string; muted: boolean; solo: boolean }
    | { authority: 'event' };
  setTrackHeaderAudioMuteSolo: (
    groupId: string,
    layerId: string,
    field: 'muted' | 'solo',
    value: boolean,
  ) => void;
  setTrackHeaderMode: (mode: 'audio' | 'event') => void;
  setMixerPanning: (enabled: boolean) => void;
  setMixerPanLaw: (panLawDb: PanLawDb) => void;
  setMixerPanBoost: (panOffCenterBoost: boolean) => void;
  renameLayer: (layerId: string, name: string) => void;
  setLayerHeight: (groupId: string, layerIndex: number, heightIndex: number) => void;
  addLayer: (groupId: string, layerIndex: number) => void;
  removeLayer: (groupId: string, layerIndex: number) => void;
  setScoreObjectColor: (objectIds: ReadonlySet<string>, color: number) => void;
  resizeScoreObjects: (
    resizes: Array<{ objectId: string; targetStartBeats: number; targetDurationBeats: number }>,
  ) => void;
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

let blueLiveGridStructureVersion = 0;

function normalizeMixerPatchIdentifiers(patch: MixerPatch): MixerPatch {
  switch (patch.type) {
    case 'addSubChannel':
      return patch.channelId ? patch : { ...patch, channelId: crypto.randomUUID() };
    case 'addEffectFromLibrary':
      return patch.entryId ? patch : { ...patch, entryId: crypto.randomUUID() };
    case 'addSend':
      return patch.entryId ? patch : { ...patch, entryId: crypto.randomUUID() };
    case 'duplicateChainEntry':
      return patch.newEntryId?.trim() ? patch : { ...patch, newEntryId: crypto.randomUUID() };
    case 'pasteChainEntries':
      return patch.newEntryIds?.length === patch.payload.entries.length &&
        new Set(patch.newEntryIds).size === patch.newEntryIds.length &&
        patch.newEntryIds.every((entryId) => entryId.trim().length > 0)
        ? patch
        : {
            ...patch,
            newEntryIds: patch.payload.entries.map(() => crypto.randomUUID()),
          };
    default:
      return patch;
  }
}

function normalizeScorePatchIdentifiers(patch: ScorePatch): ScorePatch {
  if (patch.type === 'addTrackItem') {
    if (patch.item.selectionId?.trim()) {
      return patch;
    }
    const objectType = patch.item.objectType ?? patch.item.type ?? 'Unknown';
    return {
      ...patch,
      item: {
        ...patch.item,
        selectionId: createLocalScoreObjectId(objectType),
      },
    };
  }
  if (
    patch.type === 'addScoreObjects' &&
    patch.objects.some((object) => !object.selectionId?.trim())
  ) {
    return {
      ...patch,
      objects: patch.objects.map((object) =>
        object.selectionId?.trim()
          ? object
          : { ...object, selectionId: createLocalScoreObjectId(object.objectType) },
      ),
    };
  }
  return patch;
}

function normalizeProjectDocumentPatch(patch: ProjectDocumentPatch): ProjectDocumentPatch {
  let normalized = patch;
  if (normalized.score) {
    const score = normalizeScorePatchIdentifiers(normalized.score);
    if (score !== normalized.score) {
      normalized = { ...normalized, score };
    }
  }
  if (normalized.score?.type === 'addMarker' && !normalized.score.markerId) {
    normalized = {
      ...normalized,
      score: { ...normalized.score, markerId: `marker-${crypto.randomUUID()}` },
    };
  }
  const tempoPatch = normalized.transport?.tempoMapPatch;
  if (tempoPatch?.type === 'addTempoPoint' && !tempoPatch.point.pointId) {
    normalized = {
      ...normalized,
      transport: {
        ...normalized.transport,
        tempoMapPatch: {
          ...tempoPatch,
          point: { ...tempoPatch.point, pointId: `tempo-${crypto.randomUUID()}` },
        },
      },
    };
  }
  if (
    tempoPatch?.type === 'replaceTempoMap' &&
    tempoPatch.map.points.some((point) => !point.pointId)
  ) {
    normalized = {
      ...normalized,
      transport: {
        ...normalized.transport,
        tempoMapPatch: {
          ...tempoPatch,
          map: {
            ...tempoPatch.map,
            points: tempoPatch.map.points.map((point) => ({
              ...point,
              pointId: point.pointId ?? `tempo-${crypto.randomUUID()}`,
            })),
          },
        },
      },
    };
  }
  if (!normalized.mixer) return normalized;
  const mixer = normalizeMixerPatchIdentifiers(normalized.mixer);
  return mixer === normalized.mixer ? normalized : { ...normalized, mixer };
}

function getProjectPatchQueue(): ProjectPatchQueue {
  if (!projectPatchQueue) {
    projectPatchQueue = createProjectPatchQueue({
      participantContextId: RENDERER_PARTICIPANT_CONTEXT_ID,
      acknowledgeBoundary: (ack) => {
        void window.blueAPI.acknowledgeHistoryBoundary(ack).catch((error: unknown) => {
          console.error('[project-store] Failed to acknowledge history boundary:', error);
        });
      },
      commit: (patches, context) => {
        const metadata = context?.metadata;
        const selectedObjectIds = [...useScoreSelectionStore.getState().selectedObjectIds];
        const selection: ProjectHistorySelectionHint[] | undefined =
          metadata?.origin?.selection ??
          (patches.some((patch) => patch.score !== undefined)
            ? selectedObjectIds.map((targetId) => ({ targetType: 'scoreObject', targetId }))
            : undefined);
        return window.blueAPI.commitProjectDocumentPatches([...patches], {
          ...metadata,
          origin: {
            ...metadata?.origin,
            contextId: metadata?.origin?.contextId ?? RENDERER_PARTICIPANT_CONTEXT_ID,
            viewId: metadata?.origin?.viewId ?? 'workbench',
            ...(selection ? { selection } : {}),
          },
          barrierId: context?.barrierId,
          ...(context?.expectedRevision !== undefined
            ? { expectedRevision: context.expectedRevision }
            : {}),
        });
      },
      fetchCanonicalSnapshot: () => window.blueAPI.getProjectDocument(),
      fetchCanonicalHistoryProjection: async () => {
        const documentId = getProjectDocumentId();
        if (!documentId || typeof window.blueAPI.readProjectHistory !== 'function') return null;
        const projection = await window.blueAPI.readProjectHistory({ documentId });
        return 'status' in projection ? null : projection;
      },
      applyCanonicalSnapshot: (snapshot, preserveDirty, pendingPatches) =>
        applyProjectInfoToState(snapshot, preserveDirty, pendingPatches),
      setDirty: (dirty) => storeSet({ isDirty: dirty }),
      getCanonicalDirty: () => {
        const history = getProjectHistoryProjection();
        if (!history || history.revision !== projectPatchQueue?.getRevision()) return undefined;
        return history.stateId !== history.savedStateId;
      },
      onClojureConflictsChanged: (clojureFieldConflicts) => storeSet({ clojureFieldConflicts }),
      reportBackgroundError: (error) => {
        toast.error(
          `Failed to save project changes: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
      logRefreshError: (error) => {
        console.error('[project-store] Failed to refresh canonical project state:', error);
      },
      onOversizeProposal: (proposal) => {
        storeSet({ activeOversizeProposal: proposal });
      },
    });
  }
  return projectPatchQueue;
}

export function getProjectDocumentRevision(): number {
  return getProjectPatchQueue().getRevision();
}

/**
 * Returns the latest accepted document revision for `sessionId`, or `fallbackRevision`
 * when the patch queue is not tracking `sessionId`.
 */
export function getEffectiveProjectDocumentRevision(
  sessionId: number,
  fallbackRevision: number,
): number {
  if (!projectPatchQueue || projectPatchQueue.getSessionId() !== sessionId) {
    return fallbackRevision;
  }
  return Math.max(fallbackRevision, projectPatchQueue.getRevision());
}

/**
 * Returns true when the project patch queue has queued, blocked, or in-flight patches.
 */
export function hasPendingProjectDocumentPatches(): boolean {
  return projectPatchQueue?.hasPendingWork() ?? false;
}

export function getBlueLiveGridStructureVersion(): number {
  return blueLiveGridStructureVersion;
}

export function reviewClojureFieldConflict(id: string) {
  return getProjectPatchQueue().reviewClojureConflict(id);
}

export function resolveClojureFieldConflict(
  ...args: Parameters<ProjectPatchQueue['resolveClojureConflict']>
): Promise<void> {
  return getProjectPatchQueue().resolveClojureConflict(...args);
}

export async function flushProjectDocumentPatches(): Promise<number> {
  const queue = getProjectPatchQueue();
  await queue.flush();
  return queue.getRevision();
}

export function getProjectDocumentId(): string | null {
  const state = useProjectStore.getState();
  return state.documentId;
}

export function acceptProjectDocumentRevision(sessionId: number, revision: number): void {
  getProjectPatchQueue().acceptRevision(sessionId, revision);
}

/**
 * True when any of the given operation ids were submitted from this renderer
 * context, so a canonical publication acknowledging them must not be applied
 * over fresher optimistic state.
 */
export function ownsProjectDocumentOperationIds(operationIds: readonly string[]): boolean {
  return getProjectPatchQueue().ownsOperationIds(operationIds);
}

export function handleProjectHistoryBoundary(
  event: PrepareHistoryBoundaryEvent,
  settle?: () => Promise<void> | void,
): Promise<void> {
  return getProjectPatchQueue().handlePrepareBoundary(event, settle);
}

export function handleProjectHistoryRelease(event: ReleaseHistoryBoundaryEvent): void {
  getProjectPatchQueue().handleReleaseBoundary(event);
}

export function getProjectHistoryParticipantContextId(): string {
  return RENDERER_PARTICIPANT_CONTEXT_ID;
}

/**
 * Allocates the same monotonic sequence used by the durable patch queue for a
 * project history command. Undo/redo therefore cannot be mistaken for a
 * stale submission when a text editor has already committed a later prefix.
 */
export function reserveProjectHistoryContextSequence(): number {
  return getProjectPatchQueue().reserveContextSequence();
}

export const __testFlushPendingPatches = (): void => {
  void getProjectPatchQueue()
    .flush()
    .catch((error: unknown) => {
      toast.error(
        `Failed to save project changes: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
};

export const __testAwaitPendingPatches = async (): Promise<void> => {
  await getProjectPatchQueue().awaitPending();
};

export const __testClearPendingPatches = (): void => {
  getProjectPatchQueue().clearPending();
};

function resetTransientProjectMutationState(): void {
  blueLiveGridStructureVersion += 1;
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

  return createBsbRealtimeControlUpdate({ assignmentId: patch.orchestra.assignmentId }, bsbPatch);
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

function parseClojureFieldId(
  fieldId: string | undefined,
): { entryId: string; field: 'dependencyCoordinates' | 'version' } | null {
  if (!fieldId?.startsWith('clojure-library:')) return null;

  for (const field of ['dependencyCoordinates', 'version'] as const) {
    const suffix = `:${field === 'dependencyCoordinates' ? 'coordinates' : 'version'}`;
    if (!fieldId.endsWith(suffix)) continue;
    const entryId = fieldId.slice('clojure-library:'.length, -suffix.length);
    return entryId.length > 0 ? { entryId, field } : null;
  }

  return null;
}

function createClojureFieldIntent(
  patch: ProjectDocumentPatch,
  metadata: ProjectDocumentCommitMetadata | undefined,
  currentProject: ClojureProjectSnapshot,
): ProjectPatchQueueClojureFieldIntent | undefined {
  if (!patch.clojureProject) return undefined;
  const fieldIntent = parseClojureFieldId(metadata?.fieldId);
  if (!fieldIntent) return undefined;

  const currentEntry = currentProject.libraryEntries.find(
    (entry) => entry.entryId === fieldIntent.entryId,
  );
  const nextEntry = patch.clojureProject.libraryEntries.find(
    (entry) => entry.entryId === fieldIntent.entryId,
  );
  if (!currentEntry || !nextEntry) return undefined;

  return {
    ...fieldIntent,
    baseValue: currentEntry[fieldIntent.field],
    value: nextEntry[fieldIntent.field],
  };
}

function mergePendingClojureProjectPatches(
  canonical: ClojureProjectSnapshot,
  pendingPatches: readonly ProjectPatchQueuePendingPatch[],
): ClojureProjectSnapshot {
  let libraryEntries = canonical.libraryEntries.map((entry) => ({ ...entry }));
  const fieldIntents = new Map<
    string,
    { entryId: string; field: 'dependencyCoordinates' | 'version'; value: string }
  >();

  // Apply structural intents by identity while collecting text intents for a
  // final pass. A full replacement-list text patch contains other rows too;
  // only its declared field may overlay canonical content.
  for (const pending of pendingPatches) {
    const nextProject = pending.patch.clojureProject;
    if (!nextProject) continue;

    const fieldIntent =
      pending.clojureFieldIntent ?? parseClojureFieldId(pending.metadata?.fieldId);
    if (fieldIntent) {
      const entry = nextProject.libraryEntries.find(
        (candidate) => candidate.entryId === fieldIntent.entryId,
      );
      if (entry) {
        fieldIntents.set(`${fieldIntent.entryId}:${fieldIntent.field}`, {
          ...fieldIntent,
          value: pending.clojureFieldIntent?.value ?? entry[fieldIntent.field],
        });
      }
      continue;
    }

    const canonicalById = new Map(libraryEntries.map((entry) => [entry.entryId, entry]));
    libraryEntries = nextProject.libraryEntries.map((entry) => {
      const canonicalEntry = canonicalById.get(entry.entryId);
      return canonicalEntry ? { ...canonicalEntry } : { ...entry };
    });
  }

  for (const intent of fieldIntents.values()) {
    const index = libraryEntries.findIndex((entry) => entry.entryId === intent.entryId);
    if (index < 0) continue;
    const entry = libraryEntries[index];
    if (!entry) continue;
    libraryEntries[index] = { ...entry, [intent.field]: intent.value };
  }

  return { libraryEntries };
}

function applyProjectInfoToState(
  info: ProjectLoadedPayload | null,
  preserveDirty: boolean,
  pendingPatches: readonly ProjectPatchQueuePendingPatch[] = [],
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
    const incomingDocumentId = info.documentId ?? state.documentId;
    const queue = getProjectPatchQueue();
    const preservesPendingSession = incomingSessionId === queue.getSessionId();
    if (!preservesPendingSession) {
      blueLiveGridStructureVersion += 1;
      queue.reset(incomingSessionId);
      useLayerSelectionStore.getState().clear();
    } else if (
      info.blueLive &&
      state.blueLive &&
      (info.blueLive.bins.columns !== state.blueLive.bins.columns ||
        info.blueLive.bins.rows !== state.blueLive.bins.rows)
    ) {
      blueLiveGridStructureVersion += 1;
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
    reconciliation = buildMidiRoutingReconciliation(nextScore, nextOrchestra, incomingSessionId);
    const nextClojureProject = info.clojureProject
      ? mergePendingClojureProjectPatches(
          info.clojureProject,
          preservesPendingSession ? pendingPatches : [],
        )
      : state.clojureProject;

    return {
      ...state,
      title: info.title ?? summary.title,
      author: info.author ?? summary.author,
      sampleRate: info.sampleRate ?? summary.sampleRate,
      version: info.version ?? state.version,
      filePath: info.filePath ?? state.filePath,
      sessionId: incomingSessionId,
      documentId: incomingDocumentId,
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
      scratchPad: info.scratchPad ? { ...info.scratchPad } : state.scratchPad,
      clojureProject: nextClojureProject,
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
    tracks: score.layerGroups.flatMap((group) =>
      group.groupType === 'track'
        ? group.layers.map((layer) => ({
            projectSessionId,
            rootGroupId: group.groupId,
            trackId: layer.layerId,
            displayName: layer.name,
          }))
        : [],
    ),
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
    documentId: snapshot.documentId ?? null,
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
    clojureFieldConflicts: [],
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
    runtimeOutcomes: [],
    runtimeOutcomeStatusText: '',
    activeOversizeProposal: null,
  };
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

    confirmOversizeProposal: async () => {
      const proposal = get().activeOversizeProposal;
      if (!proposal) return;
      const currentDocId = get().documentId;
      const currentRev = getProjectDocumentRevision();
      if (proposal.documentId !== currentDocId || proposal.revision !== currentRev) {
        // Stale confirmation: reject and cancel
        await window.blueAPI.cancelOversizeProposal({ proposalToken: proposal.token });
        set({ activeOversizeProposal: null });
        return;
      }
      set({ activeOversizeProposal: null });
      await window.blueAPI.commitProjectDocumentPatches([...proposal.patches], {
        proposalToken: proposal.token,
        contextSequence: reserveProjectHistoryContextSequence(),
        origin: { contextId: RENDERER_PARTICIPANT_CONTEXT_ID, viewId: 'workbench' },
      });
    },

    cancelOversizeProposal: async () => {
      const proposal = get().activeOversizeProposal;
      if (!proposal) return;
      set({ activeOversizeProposal: null });
      await window.blueAPI.cancelOversizeProposal({ proposalToken: proposal.token });
    },

    clearOversizeProposal: () => {
      set({ activeOversizeProposal: null });
    },

    refreshFromCanonical: (info, dirtyProjection) => {
      applyProjectInfoToState(info, true, getProjectPatchQueue().getPendingPatches());
      set({ isDirty: dirtyProjection });
    },

    refreshCanonicalSnapshot: async () => {
      try {
        const snapshot = await window.blueAPI.getProjectDocument();
        if (snapshot) {
          applyProjectInfoToState(snapshot, true, getProjectPatchQueue().getPendingPatches());
        }
      } catch (error: unknown) {
        console.error('[project-store] Failed to refresh canonical project state:', error);
      }
    },

    handleRuntimeOutcomes: (outcomes, context) => {
      if (
        !outcomes ||
        (outcomes.length === 0 && !context?.resetObsolete && !context?.clearPerformanceKind)
      )
        return;
      const currentState = get();
      if (context?.documentId && currentState.documentId !== context.documentId) return;
      const currentRevision = getProjectDocumentRevision();
      if (context?.revision !== undefined && context.revision !== currentRevision) return;
      set((state) => {
        const map = new Map<ProjectRuntimeOutcome['performanceKind'], ProjectRuntimeOutcome>();
        for (const o of state.runtimeOutcomes) {
          map.set(o.performanceKind, o);
        }
        if (context?.resetObsolete && context.revision !== undefined) {
          const incomingKinds = new Set(outcomes.map((outcome) => outcome.performanceKind));
          for (const [kind, outcome] of map) {
            // A canonical revision can be cosmetic or otherwise have no work
            // for a performance. Preserve unresolved state for those kinds;
            // only a resolved baseline may be discarded before the incoming
            // outcome is merged.
            if (
              incomingKinds.has(kind) &&
              outcome.status === 'applied' &&
              outcome.desiredRevision < context.revision
            ) {
              map.delete(kind);
            }
          }
        }
        if (context?.clearPerformanceKind) {
          map.delete(context.clearPerformanceKind);
        }
        for (const o of outcomes) {
          const previous = map.get(o.performanceKind);
          if (
            previous &&
            (o.generation < previous.generation ||
              (o.generation === previous.generation &&
                o.desiredRevision < previous.desiredRevision))
          ) {
            continue;
          }
          map.set(o.performanceKind, mergeRuntimeOutcome(previous, o));
        }
        const updatedOutcomes = Array.from(map.values());

        let statusText = '';
        const hasFailed = updatedOutcomes.find((o) => o.status === 'failed');
        const hasRestart = updatedOutcomes.find((o) => o.status === 'restart-required');
        const hasPending = updatedOutcomes.find((o) => o.status === 'pending');
        const allApplied =
          updatedOutcomes.length > 0 && updatedOutcomes.every((o) => o.status === 'applied');

        if (hasFailed) {
          statusText = hasFailed.message
            ? `Live synchronization failed: ${hasFailed.message}`
            : 'Live synchronization failed';
          const previousFailed = state.runtimeOutcomes.find((o) => o.status === 'failed');
          const incomingFailure = outcomes.find((o) => o.status === 'failed');
          if (
            !previousFailed ||
            (incomingFailure !== undefined &&
              (incomingFailure.message !== previousFailed.message ||
                incomingFailure.performanceKind !== previousFailed.performanceKind))
          ) {
            toast.error(statusText);
          }
        } else if (hasRestart) {
          statusText = 'Restart required for playback to reflect all changes';
        } else if (hasPending) {
          statusText = 'Applying live changes...';
        } else if (allApplied) {
          statusText = 'Live changes applied';
        }

        return {
          runtimeOutcomes: updatedOutcomes,
          runtimeOutcomeStatusText: statusText,
        };
      });
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
        toast.error(
          `Failed to revert project: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    applyProjectDocumentPatch: async (patch, metadata) => {
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
        !normalizedPatch.score &&
        (!normalizedPatch.projectProperties ||
          Object.keys(normalizedPatch.projectProperties).length === 0) &&
        (!normalizedPatch.transport || Object.keys(normalizedPatch.transport).length === 0)
      ) {
        return;
      }

      const dirtyBaseline = get().isDirty;
      const clojureFieldIntent = createClojureFieldIntent(
        normalizedPatch,
        metadata,
        get().clojureProject,
      );

      set((state) => {
        const next: ProjectState = {
          ...state,
          isDirty: true,
        };

        if (normalizedPatch.score?.type === 'updateTimeState') {
          const format = normalizedPatch.score.patch;
          next.transport = {
            ...next.transport,
            smpteFrameRate: format.smpteFrameRate ?? next.transport.smpteFrameRate,
            smpteDropFrame: format.smpteDropFrame ?? next.transport.smpteDropFrame,
          };
        }

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

          if (
            normalizedPatch.mixer.type === 'updateChannel' &&
            normalizedPatch.mixer.patch.name !== undefined
          ) {
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
          next.clojureProject = cloneClojureProjectSnapshot(normalizedPatch.clojureProject);
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
          next.projectUdos = applyProjectUdoPatchToSnapshot(
            state.projectUdos,
            normalizedPatch.projectUdo,
          );
        }

        if (normalizedPatch.blueLive !== undefined && state.blueLive) {
          next.blueLive = applyBlueLivePatchToSnapshot(
            state.blueLive,
            normalizedPatch.blueLive,
            () => {
              blueLiveGridStructureVersion += 1;
            },
          );
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
          const orchestraPatch = normalizedPatch.orchestra;
          if (orchestraPatch.type === 'updateAssignment') {
            const oldId = orchestraPatch.assignmentId;
            const rowIndex = state.orchestra.arrangement.rows.findIndex(
              (row) => row.assignmentId === oldId,
            );
            const newId = next.orchestra.arrangement.rows[rowIndex]?.assignmentId;
            if (newId && newId !== oldId) {
              next.mixer = {
                ...next.mixer,
                channels: next.mixer.channels.map((channel) =>
                  channel.association === oldId
                    ? { ...channel, association: newId, name: newId }
                    : channel,
                ),
              };
            }
          }
          next.mixer = reconcileMixerSnapshotWithArrangement(next.mixer, next.orchestra);
        }

        return next;
      });

      const realtimeUpdate = buildRealtimeControlUpdate(normalizedPatch);
      if (realtimeUpdate) {
        void window.blueAPI.sendBsbRealtimeControlUpdate(realtimeUpdate).catch((err: unknown) => {
          toast.error(
            `Realtime BSB update failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }

      // The queue is the single choke point for durable patches: a mixer
      // patch submitted without an explicit label still gets a semantic
      // action label instead of the generic "Edit Project" fallback.
      const effectiveMetadata = metadata?.label
        ? metadata
        : normalizedPatch.mixer !== undefined
          ? { ...metadata, label: mixerPatchActionLabel(normalizedPatch.mixer) }
          : metadata;
      getProjectPatchQueue().enqueue(
        normalizedPatch,
        dirtyBaseline,
        effectiveMetadata,
        clojureFieldIntent,
      );
    },

    updateGlobalOrc: async (globalOrc, metadata) => {
      await get().applyProjectDocumentPatch({ globalOrc }, metadata);
    },

    updateGlobalSco: async (globalSco, metadata) => {
      await get().applyProjectDocumentPatch({ globalSco }, metadata);
    },

    updateOrchestra: async (orchestra, metadata) => {
      const label =
        orchestra.type === 'updateInstrument' && orchestra.patch.bsbInterface
          ? bsbInterfaceActionLabel(
              orchestra.patch.bsbInterface,
              bsbActionLabelContext(get().orchestra, orchestra.assignmentId),
            )
          : orchestraPatchActionLabel(orchestra);
      await get().applyProjectDocumentPatch({ orchestra }, { label, ...metadata });
    },

    updateProjectProperties: async (patch, metadata) => {
      await get().applyProjectDocumentPatch({ projectProperties: patch }, metadata);
    },

    updateScratchPad: async (patch, metadata) => {
      await get().applyProjectDocumentPatch({ scratchPad: patch }, metadata);
    },

    updateClojureProject: async (clojureProject, metadata) => {
      await get().applyProjectDocumentPatch(
        { clojureProject },
        { label: 'Update Clojure Project', ...metadata },
      );
    },

    setLoopRendering: async (loopRendering, metadata) => {
      await get().applyProjectDocumentPatch(
        {
          transport: { loopRendering },
        },
        {
          label: loopRendering ? 'Enable Loop Rendering' : 'Disable Loop Rendering',
          phase: 'single',
          ...metadata,
        },
      );
    },

    addMarkerAtTime: (timeBeats, metadata) => {
      void get().applyProjectDocumentPatch(
        {
          score: { type: 'addMarker', timeBeats: Math.max(0, timeBeats) },
        },
        {
          label: 'Add Marker',
          phase: 'single',
          ...metadata,
        },
      );
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
          currentPreview !== undefined &&
          currentPreview.fileStartTime === nextPreview.fileStartTime &&
          currentPreview.fadeIn === nextPreview.fadeIn &&
          currentPreview.fadeOut === nextPreview.fadeOut
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
        get().applyProjectDocumentPatch(
          { transport: { renderStartTime: newStartTime } },
          { label: 'Move Render Start to Next Marker' },
        );
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
      get().applyProjectDocumentPatch(
        { transport: { renderStartTime: newStartTime } },
        { label: 'Move Render Start to Previous Marker' },
      );
      set({ scrollToBeatTarget: newStartTime });
    },

    rewindToStart: () => {
      get().applyProjectDocumentPatch(
        { transport: { renderStartTime: 0, renderEndTime: -1 } },
        { label: 'Rewind to Start' },
      );
      set({ scrollToBeatTarget: 0 });
    },

    updateTablesText: async (tablesText, metadata) => {
      set({ tablesText });
      await get().applyProjectDocumentPatch({ tablesText }, metadata);
    },

    applyProjectUdoPatch: async (patch, metadata) => {
      await get().applyProjectDocumentPatch({ projectUdo: patch }, metadata);
    },

    applyBlueLivePatch: async (patch, metadata) => {
      await get().applyProjectDocumentPatch({ blueLive: patch }, metadata);
    },

    setGeneratedCsd: (csd: { text: string; title: string } | null) => {
      set({ generatedCsd: csd });
    },

    generateCsdToScreen: async () => {
      await get().flushPendingPatches();
      await window.blueAPI.generateCsdToScreen();
    },

    generateRealtimeCsdToScreen: async () => {
      await get().flushPendingPatches();
      await window.blueAPI.generateRealtimeCsdToScreen();
    },

    generateCsdToDisk: async () => {
      await get().flushPendingPatches();
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
        const newGroups = score.layerGroups.map((lg, groupIndex) => {
          const newLayers = updateScoreGroupLayers(lg, (sourceLayers) =>
            sourceLayers.map((layer, layerIndex) => ({
              ...layer,
              items: layer.items
                .filter((item) => !objectIds.has(item.objectId))
                .map((item, itemIdx) =>
                  updateScoreItemLocation(item, groupIndex, layerIndex, itemIdx),
                ),
            })),
          );
          return newLayers;
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
        backgroundColor?: number;
        serializedXml?: string;
        sourceTarget?: import('../../shared/project-editor').ScoreObjectEditorTargetSnapshot;
      }> = [];

      set((state) => {
        const score = state.score;
        const groupIndex = findAddScoreObjectsTargetGroupIndex(score, objects);
        if (groupIndex < 0) return state;
        const lg = score.layerGroups[groupIndex];
        const newLayers = updateScoreGroupLayers(lg, (sourceLayers) =>
          sourceLayers.map((layer, idx) => {
            const layerObjects = objects.filter((o) => o.layerIndex === idx);
            if (layerObjects.length === 0) return layer;
            return {
              ...layer,
              items: [
                ...layer.items,
                ...layerObjects.map((o, j) => {
                  const objectId = createLocalScoreObjectId(o.objectType);
                  const objectIndex = layer.items.length + j;
                  const isSObj = o.objectType !== 'AudioClip';
                  const resolvedColor = resolveOptimisticScoreObjectColor(score, layer, o);
                  const location = {
                    rootGroupIndex: groupIndex,
                    containerPath: [],
                    layerIndex: idx,
                    objectIndex,
                  };
                  const isInstance =
                    o.objectType === 'Instance' ||
                    o.editorTarget?.selectedObjectType === 'Instance';
                  const editorTarget = isInstance
                    ? {
                        selectionId: objectId,
                        selectedObjectType: 'Instance',
                        editorObjectType: o.editorTarget?.editorObjectType ?? o.objectType,
                        ownerKind: 'library' as const,
                        displayContext: 'instance' as const,
                        sourceInstanceLocation: location,
                        ...(o.editorTarget?.library ? { library: o.editorTarget.library } : {}),
                        supportsTimeBehavior: true,
                        supportsRepeatPoint: true,
                        supportsNoteProcessorChain: true,
                      }
                    : {
                        selectionId: objectId,
                        selectedObjectType: o.objectType,
                        editorObjectType: o.objectType,
                        ownerKind: 'timeline' as const,
                        displayContext: 'timeline' as const,
                        location,
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
                    backgroundColor: resolvedColor,
                    isContainer: o.isContainer,
                    serializedXml: o.serializedXml,
                    barRenderer: createOptimisticBarRendererSnapshot(o),
                    editorTarget,
                  };
                }),
              ],
            };
          }),
        );
        const newGroups = [...score.layerGroups];
        newGroups[groupIndex] = newLayers;
        return { score: { ...score, layerGroups: newGroups }, isDirty: true };
      });

      get()
        .applyProjectDocumentPatch(
          {
            score: {
              type: 'addScoreObjects',
              groupId: objects[0].groupId,
              objects: patchObjects,
            },
          },
          { label: 'Add Score Objects' },
        )
        .then(() => __testFlushPendingPatches());
    },

    setLayerBackgroundColor: (groupId, layerIndex, color) => {
      void get().applyProjectDocumentPatch(
        {
          score: {
            type: 'updateLayerState',
            groupId,
            layerIndex,
            patch: { backgroundColor: color },
          },
        },
        { label: 'Set Layer Color' },
      );
    },

    setLayerMute: (groupId, layerIndex, muted) => {
      void get().applyProjectDocumentPatch(
        {
          score: {
            type: 'updateLayerState',
            groupId,
            layerIndex,
            patch: { muted },
          },
        },
        { label: muted ? 'Mute Layer' : 'Unmute Layer' },
      );
    },

    setLayerSolo: (groupId, layerIndex, solo) => {
      void get().applyProjectDocumentPatch(
        {
          score: {
            type: 'updateLayerState',
            groupId,
            layerIndex,
            patch: { solo },
          },
        },
        { label: solo ? 'Solo Layer' : 'Unsolo Layer' },
      );
    },

    resolveTrackHeaderAuthority: (groupId, layerId) => {
      const state = get();
      const mixer = state.mixer;
      const mode = effectiveTrackLayerMuteSoloMode(
        state.score.trackLayerMuteSoloMode,
        mixer?.enabled ?? false,
      );
      if (mode !== 'audio' || !mixer) {
        return { authority: 'event' as const };
      }
      const allChannels = [
        ...mixer.channelListGroups.flatMap((group) => group.channels),
        ...mixer.channels,
        ...mixer.subChannels,
      ];
      const channel = allChannels.find((candidate) => candidate.association === layerId);
      if (!channel) {
        return { authority: 'event' as const };
      }
      return {
        authority: 'audio' as const,
        channelId: channel.id,
        muted: channel.muted,
        solo: channel.solo,
      };
    },

    setTrackHeaderAudioMuteSolo: (groupId, layerId, field, value) => {
      const state = get();
      const mixer = state.mixer;
      const effectiveMode = effectiveTrackLayerMuteSoloMode(
        state.score.trackLayerMuteSoloMode,
        mixer?.enabled ?? false,
      );
      const resolved = state.resolveTrackHeaderAuthority(groupId, layerId);
      if (resolved.authority !== 'audio') {
        // Missing association: refuse rather than silently editing event state.
        toast.error(
          'No mixer channel is associated with this track; its audio header cannot be edited. Reconnect the channel in the mixer first.',
        );
        return;
      }
      void state.applyProjectDocumentPatch(
        {
          mixer: {
            type: 'updateChannel',
            channelId: resolved.channelId,
            patch: { [field]: value },
            headerIntent: { expectedMode: effectiveMode, association: layerId },
          },
        },
        {
          label:
            field === 'muted'
              ? value
                ? 'Mute Channel'
                : 'Unmute Channel'
              : value
                ? 'Solo Channel'
                : 'Unsolo Channel',
        },
      );
    },

    setTrackHeaderMode: (mode) => {
      const score = get().score;
      if (score.trackLayerMuteSoloMode === mode) return;
      void get().applyProjectDocumentPatch(
        { score: { type: 'updateTrackLayerMuteSoloMode', mode } },
        {
          label:
            mode === 'audio' ? 'Set Track Header Mode to Audio' : 'Set Track Header Mode to Event',
        },
      );
    },

    setMixerPanning: (enabled) => {
      const mixer = get().mixer;
      if (mixer.panningEnabled === enabled) return;
      void get().applyProjectDocumentPatch(
        { mixer: { type: 'updateMixerPanning', panningEnabled: enabled } },
        { label: enabled ? 'Enable Panning' : 'Disable Panning' },
      );
    },

    setMixerPanLaw: (panLawDb) => {
      const mixer = get().mixer;
      if (mixer.panLawDb === panLawDb) return;
      void get().applyProjectDocumentPatch(
        { mixer: { type: 'updateMixerPanLaw', panLawDb } },
        { label: 'Set Pan Law' },
      );
    },

    setMixerPanBoost: (panOffCenterBoost) => {
      const mixer = get().mixer;
      if (mixer.panOffCenterBoost === panOffCenterBoost) return;
      void get().applyProjectDocumentPatch(
        { mixer: { type: 'updateMixerPanBoost', panOffCenterBoost } },
        { label: panOffCenterBoost ? 'Enable Off-center Boost' : 'Disable Off-center Boost' },
      );
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

      void get().applyProjectDocumentPatch(
        {
          score: {
            type: 'renameLayer',
            groupId: targetGroupId,
            layerIndex: targetLayerIndex,
            name: trimmedName,
          },
        },
        { label: 'Rename Layer' },
      );
    },

    setLayerHeight: (groupId, layerIndex, heightIndex) => {
      void get().applyProjectDocumentPatch(
        {
          score: {
            type: 'updateLayerState',
            groupId,
            layerIndex,
            patch: { heightIndex },
          },
        },
        { label: 'Resize Layer' },
      );
    },

    addLayer: (groupId, layerIndex) => {
      const patch: ProjectDocumentPatch = {
        score: { type: 'addLayer', groupId, layerIndex },
      };
      get()
        .applyProjectDocumentPatch(patch, { label: 'Add Layer' })
        .then(() => {
          __testFlushPendingPatches();
        });
    },

    removeLayer: (groupId, layerIndex) => {
      const patch: ProjectDocumentPatch = {
        score: { type: 'removeLayer', groupId, layerIndex },
      };
      get()
        .applyProjectDocumentPatch(patch, { label: 'Remove Layer' })
        .then(() => {
          __testFlushPendingPatches();
        });
    },

    setScoreObjectColor: (objectIds, color) => {
      set((state) => {
        const newGroups = state.score.layerGroups.map((lg) =>
          updateScoreGroupLayers(lg, (layers) =>
            layers.map((layer) => ({
              ...layer,
              items: layer.items.map((item) =>
                objectIds.has(item.objectId) ? { ...item, backgroundColor: color } : item,
              ),
            })),
          ),
        );
        return { score: { ...state.score, layerGroups: newGroups }, isDirty: true };
      });
    },

    resizeScoreObjects: (resizes) => {
      set((state) => {
        const newGroups = state.score.layerGroups.map((lg) =>
          updateScoreGroupLayers(lg, (layers) =>
            layers.map((layer) => ({
              ...layer,
              items: layer.items.map((item) => {
                const r = resizes.find((m) => m.objectId === item.objectId);
                if (!r) return item;
                return {
                  ...item,
                  startBeats: r.targetStartBeats,
                  durationBeats: r.targetDurationBeats,
                };
              }),
            })),
          ),
        );
        return { score: { ...state.score, layerGroups: newGroups }, isDirty: true };
      });
    },
  };
});
