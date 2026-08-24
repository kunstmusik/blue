import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  ProjectEditorSnapshot,
  ScorePatch,
} from '../../../shared/project-editor';

const PATCH_FLUSH_DELAY_MS = 100;

export interface ProjectPatchQueueDependencies {
  commit(patches: readonly ProjectDocumentPatch[]): Promise<ProjectDocumentCommitReceipt>;
  fetchCanonicalSnapshot(): Promise<ProjectEditorSnapshot | null>;
  applyCanonicalSnapshot(snapshot: ProjectEditorSnapshot, preserveDirty: boolean): void;
  setDirty(dirty: boolean): void;
  reportBackgroundError(error: unknown): void;
  logRefreshError(error: unknown): void;
}

export interface ProjectPatchQueue {
  enqueue(patch: ProjectDocumentPatch, dirtyBaseline: boolean): void;
  flush(): Promise<void>;
  reset(sessionId?: number): void;
  acceptRevision(sessionId: number, revision: number): void;
  getRevision(): number;
  getSessionId(): number;
  awaitPending(): Promise<void>;
  clearPending(): void;
}

function scorePatchRequiresCanonicalProjectRefresh(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'moveLayerRange':
    case 'removeLayerRanges':
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
    case 'setAutomationResolution':
    case 'moveAutomationRange':
    case 'scaleAutomationRange':
    case 'convertScoreObjectToObjectBuilder':
    case 'convertToPolyObject':
      return true;
    case 'addLayerGroup':
      return patch.groupType === 'track' || patch.groupType === 'patterns';
    case 'updateSoundObjectBehavior':
    case 'replaceNoteProcessorChain':
      return (patch as { target?: { patternSource?: unknown } }).target?.patternSource !== undefined;
    case 'addScoreObjects':
      return patch.objects.some((object) => object.objectType === 'PolyObject');
    case 'addTrackItem':
    case 'moveTrackItems':
    case 'removeTrackItems':
    case 'setSubjectiveDurationToObjective':
    case 'replaceTrackNoteProcessorChain':
    case 'createTrackInstrument':
    case 'replaceTrackInstrument':
    case 'clearTrackInstrument':
    case 'updateTrackInstrument':
      return true;
    default:
      return false;
  }
}

function patchesRequireCanonicalProjectRefresh(
  patches: readonly ProjectDocumentPatch[],
): boolean {
  return patches.some(
    (patch) => (
      (patch.score !== undefined && scorePatchRequiresCanonicalProjectRefresh(patch.score))
      || patch.mixer?.type === 'renameChannelListGroup'
      || patch.clojureProject !== undefined
    ),
  );
}

function patchesRequireMutationAcknowledgement(
  patches: readonly ProjectDocumentPatch[],
): boolean {
  return patches.some((patch) => (
    patch.score?.type === 'createTrackInstrument'
    || patch.score?.type === 'replaceTrackInstrument'
    || patch.score?.type === 'clearTrackInstrument'
  ));
}

export function createProjectPatchQueue(
  dependencies: ProjectPatchQueueDependencies,
): ProjectPatchQueue {
  let currentSessionId = 0;
  let currentRevision = 0;
  let pending: ProjectDocumentPatch[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let dirtyBaseline: boolean | null = null;
  let sequenceChanged = false;

  const finishDirtySequenceIfSettled = (): void => {
    if (pending.length > 0 || dirtyBaseline === null) return;
    if (!sequenceChanged) {
      dependencies.setDirty(dirtyBaseline);
    }
    dirtyBaseline = null;
    sequenceChanged = false;
  };

  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const drain = async (): Promise<void> => {
    const patches = pending.slice();
    pending = [];
    if (patches.length === 0) {
      finishDirtySequenceIfSettled();
      return;
    }

    try {
      const receipt = await dependencies.commit(patches);
      if (receipt.changed === false && patchesRequireMutationAcknowledgement(patches)) {
        throw new Error('Track instrument change was not applied; the project may have changed. Please try again.');
      }

      sequenceChanged = sequenceChanged || receipt.changed !== false;
      if (receipt.sessionId === currentSessionId && Number.isInteger(receipt.revision)) {
        currentRevision = Math.max(currentRevision, receipt.revision);
      }

      if (patchesRequireCanonicalProjectRefresh(patches)) {
        try {
          const snapshot = await dependencies.fetchCanonicalSnapshot();
          if (snapshot) dependencies.applyCanonicalSnapshot(snapshot, true);
        } catch (error) {
          dependencies.logRefreshError(error);
        }
      }
      finishDirtySequenceIfSettled();
    } catch (error) {
      try {
        const snapshot = await dependencies.fetchCanonicalSnapshot();
        if (snapshot) dependencies.applyCanonicalSnapshot(snapshot, true);
      } catch (refreshError) {
        dependencies.logRefreshError(refreshError);
      }
      finishDirtySequenceIfSettled();
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  const start = (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const schedule = (): void => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void start().catch(dependencies.reportBackgroundError);
    }, PATCH_FLUSH_DELAY_MS);
  };

  const flush = async (): Promise<void> => {
    clearTimer();
    while (inFlight || pending.length > 0) {
      await (inFlight ?? start());
    }
  };

  return {
    enqueue(patch, baseline) {
      if (dirtyBaseline === null) {
        dirtyBaseline = baseline;
        sequenceChanged = false;
      }
      pending.push(patch);
      schedule();
    },

    flush,

    reset(sessionId) {
      clearTimer();
      pending = [];
      dirtyBaseline = null;
      sequenceChanged = false;
      if (sessionId !== undefined) {
        currentSessionId = sessionId;
        currentRevision = 0;
      }
    },

    acceptRevision(sessionId, revision) {
      if (!Number.isInteger(sessionId) || sessionId < 0 || !Number.isInteger(revision) || revision < 0) return;
      if (sessionId !== currentSessionId) {
        clearTimer();
        pending = [];
        dirtyBaseline = null;
        sequenceChanged = false;
        currentSessionId = sessionId;
        currentRevision = 0;
      }
      currentRevision = Math.max(currentRevision, revision);
    },

    getRevision() {
      return currentRevision;
    },

    getSessionId() {
      return currentSessionId;
    },

    async awaitPending() {
      while (inFlight) {
        await inFlight.catch(() => undefined);
      }
    },

    clearPending() {
      clearTimer();
      pending = [];
      dirtyBaseline = null;
      sequenceChanged = false;
    },
  };
}
