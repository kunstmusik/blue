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
  onStructuralScoreEdit?: () => void;
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

export function isStructuralScorePatch(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'moveLayerRange':
    case 'removeLayerRanges':
    case 'addLayerGroup':
    case 'removeLayerGroup':
    case 'moveLayerGroup':
    case 'removeScoreObjects':
    case 'moveScoreObjects':
    case 'convertToPolyObject':
    case 'convertScoreObjectToObjectBuilder':
    case 'removeTrackItems':
    case 'moveTrackItems':
      return true;
    default:
      return false;
  }
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
      return (
        (patch as { target?: { patternSource?: unknown } }).target?.patternSource !== undefined
      );
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

function patchesRequireCanonicalProjectRefresh(patches: readonly ProjectDocumentPatch[]): boolean {
  return patches.some(
    (patch) =>
      (patch.score !== undefined && scorePatchRequiresCanonicalProjectRefresh(patch.score)) ||
      patch.mixer?.type === 'renameChannelListGroup' ||
      patch.clojureProject !== undefined,
  );
}

function isMutationAcknowledgementPatch(patch: ProjectDocumentPatch): boolean {
  return (
    patch.score?.type === 'createTrackInstrument' ||
    patch.score?.type === 'replaceTrackInstrument' ||
    patch.score?.type === 'clearTrackInstrument' ||
    isScoreColorPatch(patch)
  );
}

function isTrackInstrumentAcknowledgementPatch(patch: ProjectDocumentPatch): boolean {
  return isMutationAcknowledgementPatch(patch) && !isScoreColorPatch(patch);
}

function patchesRequireMutationAcknowledgement(patches: readonly ProjectDocumentPatch[]): boolean {
  return patches.some(isMutationAcknowledgementPatch);
}

function isScoreColorPatch(patch: ProjectDocumentPatch): boolean {
  const scorePatch = patch.score;
  if (!scorePatch) return false;
  if (scorePatch.type === 'setScoreObjectBackgroundColors') return true;
  if (scorePatch.type === 'updateLayerState') {
    return scorePatch.patch.backgroundColor !== undefined;
  }
  return (
    scorePatch.type === 'updateSharedProperties' && scorePatch.patch.backgroundColor !== undefined
  );
}

function hasUnacknowledgedMutation(
  patches: readonly ProjectDocumentPatch[],
  receipt: ProjectDocumentCommitReceipt,
): boolean {
  if (!patchesRequireMutationAcknowledgement(patches)) return false;

  const colorStatuses = receipt.patchAccepted ?? receipt.patchChanged;
  if (patches.some(isScoreColorPatch)) {
    if (colorStatuses === undefined) {
      // Keep compatibility with older receipts while the live document IPC
      // contract rolls out the per-patch acknowledgement field.
      return receipt.changed === false;
    }

    if (colorStatuses.length !== patches.length) return true;

    if (patches.some((patch, index) => isScoreColorPatch(patch) && colorStatuses[index] !== true)) {
      return true;
    }
  }

  if (patches.some(isTrackInstrumentAcknowledgementPatch)) {
    if (receipt.patchChanged === undefined) return receipt.changed === false;
    if (receipt.patchChanged.length !== patches.length) return true;

    if (
      patches.some(
        (patch, index) =>
          isTrackInstrumentAcknowledgementPatch(patch) && receipt.patchChanged?.[index] !== true,
      )
    ) {
      return true;
    }
  }

  return false;
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
      sequenceChanged = sequenceChanged || receipt.changed !== false;
      if (receipt.sessionId === currentSessionId && Number.isInteger(receipt.revision)) {
        currentRevision = Math.max(currentRevision, receipt.revision);
      }

      if (hasUnacknowledgedMutation(patches, receipt)) {
        const isColorPatch = patches.some(isScoreColorPatch);
        const message = isColorPatch
          ? 'Score object color change was not applied; the project may have changed. Please try again.'
          : 'Track instrument change was not applied; the project may have changed. Please try again.';
        throw new Error(message);
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
      if (patch.score && isStructuralScorePatch(patch.score)) {
        dependencies.onStructuralScoreEdit?.();
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
      if (
        !Number.isInteger(sessionId) ||
        sessionId < 0 ||
        !Number.isInteger(revision) ||
        revision < 0
      )
        return;
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
