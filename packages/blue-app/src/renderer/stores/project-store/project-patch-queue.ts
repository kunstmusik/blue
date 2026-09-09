import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  ProjectEditorSnapshot,
  ScorePatch,
} from '../../../shared/project-editor';
import type {
  PrepareHistoryBoundaryAck,
  PrepareHistoryBoundaryEvent,
  ProjectDocumentCommitMetadata,
  ReleaseHistoryBoundaryEvent,
} from '../../../shared/project-history';

const PATCH_FLUSH_DELAY_MS = 100;

export interface ProjectPatchQueueCommitContext {
  barrierId?: string;
  metadata?: ProjectDocumentCommitMetadata;
}

export interface ProjectPatchQueueDependencies {
  commit(
    patches: readonly ProjectDocumentPatch[],
    context?: ProjectPatchQueueCommitContext,
  ): Promise<ProjectDocumentCommitReceipt>;
  fetchCanonicalSnapshot(): Promise<ProjectEditorSnapshot | null>;
  applyCanonicalSnapshot(snapshot: ProjectEditorSnapshot, preserveDirty: boolean): void;
  setDirty(dirty: boolean): void;
  reportBackgroundError(error: unknown): void;
  logRefreshError(error: unknown): void;
  onStructuralScoreEdit?: () => void;
  /** Callback invoked when a patch submission returns an oversize history proposal. */
  onOversizeProposal?: (proposal: {
    token: string;
    estimatedBytes: number;
    limitBytes: number;
    explanation: string;
    documentId: string;
    revision: number;
    patches: readonly ProjectDocumentPatch[];
  }) => void;
  /** Participant identity for settlement boundary acknowledgements. */
  participantContextId?: string;
  /** Acknowledges zero outstanding prefix work for a settlement barrier. */
  acknowledgeBoundary?: (ack: PrepareHistoryBoundaryAck) => void;
}

export interface ProjectPatchQueue {
  enqueue(
    patch: ProjectDocumentPatch,
    dirtyBaseline: boolean,
    metadata?: ProjectDocumentCommitMetadata,
  ): void;
  flush(): Promise<void>;
  reset(sessionId?: number): void;
  acceptRevision(sessionId: number, revision: number): void;
  getRevision(): number;
  getSessionId(): number;
  awaitPending(): Promise<void>;
  clearPending(): void;
  /** Captures the pending prefix, pauses durable submissions, drains, and acknowledges. */
  handlePrepareBoundary(event: PrepareHistoryBoundaryEvent): Promise<void>;
  /** Resumes draft submissions after the settlement boundary releases. */
  handleReleaseBoundary(event: ReleaseHistoryBoundaryEvent): void;
  isSettlementPaused(): boolean;
  getContextSequence(): number;
  /** True when any of the given operation ids were submitted by this queue. */
  ownsOperationIds(operationIds: readonly string[]): boolean;
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
  let contextSequence = 0;
  let boundary: { barrierId: string } | null = null;
  let boundaryDrain: Promise<void> | null = null;
  let pendingMetadata: ProjectDocumentCommitMetadata | undefined;
  // Operation ids this queue submitted (in flight or recently acknowledged),
  // used to suppress echoes of our own operations in canonical publications.
  const trackedOperationIds = new Set<string>();
  const MAX_TRACKED_OPERATION_IDS = 256;

  const trackOperationId = (operationId: string): void => {
    trackedOperationIds.add(operationId);
    if (trackedOperationIds.size > MAX_TRACKED_OPERATION_IDS) {
      const oldest = trackedOperationIds.values().next().value;
      if (oldest !== undefined) trackedOperationIds.delete(oldest);
    }
  };

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
      const metadata: ProjectDocumentCommitMetadata = {
        ...pendingMetadata,
        operationId: pendingMetadata?.operationId ?? `op-${crypto.randomUUID()}`,
      };
      pendingMetadata = undefined;
      trackOperationId(metadata.operationId!);
      const receipt = await dependencies.commit(patches, { metadata });
      if (receipt.oversizeProposal) {
        dependencies.onOversizeProposal?.({
          token: receipt.oversizeProposal.token,
          estimatedBytes: receipt.oversizeProposal.estimatedBytes,
          limitBytes: receipt.oversizeProposal.limitBytes,
          explanation: receipt.oversizeProposal.explanation,
          documentId: receipt.documentId ?? '',
          revision: receipt.revision,
          patches,
        });
        finishDirtySequenceIfSettled();
        return;
      }
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
    if (boundary) {
      throw new Error(
        'Project patch queue is paused for a history settlement boundary; submission rejected',
      );
    }
    clearTimer();
    while (inFlight || pending.length > 0) {
      await (inFlight ?? start());
    }
  };

  const handlePrepareBoundary = (event: PrepareHistoryBoundaryEvent): Promise<void> => {
    if (boundary) return boundaryDrain ?? Promise.resolve();
    clearTimer();
    const active = { barrierId: event.barrierId };
    boundary = active;
    boundaryDrain = (async () => {
      // Let the pre-boundary submission settle so the captured prefix keeps
      // its submission order relative to work already sent to main.
      await inFlight?.catch(() => undefined);
      if (boundary !== active) return;

      const patches = pending;
      pending = [];
      const drainedMetadata: ProjectDocumentCommitMetadata = {
        ...pendingMetadata,
        operationId: pendingMetadata?.operationId ?? `op-${crypto.randomUUID()}`,
      };
      pendingMetadata = undefined;
      trackOperationId(drainedMetadata.operationId!);
      let drained = true;
      if (patches.length > 0) {
        try {
          contextSequence += 1;
          const receipt = await dependencies.commit(patches, {
            barrierId: active.barrierId,
            metadata: drainedMetadata,
          });
          if (boundary !== active) return;
          if (receipt.oversizeProposal) {
            dependencies.onOversizeProposal?.({
              token: receipt.oversizeProposal.token,
              estimatedBytes: receipt.oversizeProposal.estimatedBytes,
              limitBytes: receipt.oversizeProposal.limitBytes,
              explanation: receipt.oversizeProposal.explanation,
              documentId: receipt.documentId ?? '',
              revision: receipt.revision,
              patches,
            });
            drained = false;
            return;
          }
          sequenceChanged = sequenceChanged || receipt.changed !== false;
          if (receipt.sessionId === currentSessionId && Number.isInteger(receipt.revision)) {
            currentRevision = Math.max(currentRevision, receipt.revision);
          }
          if (hasUnacknowledgedMutation(patches, receipt)) {
            const message = patches.some(isScoreColorPatch)
              ? 'Score object color change was not applied; the project may have changed. Please try again.'
              : 'Track instrument change was not applied; the project may have changed. Please try again.';
            throw new Error(message);
          }
          if (patchesRequireCanonicalProjectRefresh(patches)) {
            try {
              const snapshot = await dependencies.fetchCanonicalSnapshot();
              if (boundary !== active) return;
              if (snapshot) dependencies.applyCanonicalSnapshot(snapshot, true);
            } catch (error) {
              dependencies.logRefreshError(error);
            }
          }
        } catch (error) {
          drained = false;
          try {
            const snapshot = await dependencies.fetchCanonicalSnapshot();
            if (boundary !== active) return;
            if (snapshot) dependencies.applyCanonicalSnapshot(snapshot, true);
          } catch (refreshError) {
            dependencies.logRefreshError(refreshError);
          }
          if (boundary !== active) return;
          // Conflicting prefix work becomes a retained draft; the nonzero
          // outstanding count keeps the barrier from resolving on this ack.
          pending.push(...patches);
          dependencies.reportBackgroundError(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }

      dependencies.acknowledgeBoundary?.({
        barrierId: active.barrierId,
        contextId: dependencies.participantContextId ?? '',
        lastAcknowledgedRevision: currentRevision,
        lastAcknowledgedSequence: contextSequence,
        outstandingPrefixCount: drained ? 0 : patches.length,
      });
    })();

    return boundaryDrain;
  };

  const handleReleaseBoundary = (event: ReleaseHistoryBoundaryEvent): void => {
    if (!boundary || boundary.barrierId !== event.barrierId) return;
    boundary = null;
    boundaryDrain = null;
    if (pending.length > 0) {
      // Drafts accumulated during the pause resume through the normal flush
      // timer so main revalidates them against the released revision base.
      schedule();
    } else {
      finishDirtySequenceIfSettled();
    }
  };

  const clearBoundary = (): void => {
    boundary = null;
    boundaryDrain = null;
  };

  return {
    enqueue(patch, baseline, metadata) {
      if (dirtyBaseline === null) {
        dirtyBaseline = baseline;
        sequenceChanged = false;
      }
      if (patch.score && isStructuralScorePatch(patch.score)) {
        dependencies.onStructuralScoreEdit?.();
      }
      // The most recent semantic metadata wins for the flushed batch: a
      // gesture's completed action label describes the batch it closes.
      pendingMetadata = metadata ?? pendingMetadata;
      pending.push(patch);
      if (!boundary) {
        schedule();
      }
    },

    flush,

    reset(sessionId) {
      clearTimer();
      clearBoundary();
      pending = [];
      pendingMetadata = undefined;
      trackedOperationIds.clear();
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
        clearBoundary();
        pending = [];
        pendingMetadata = undefined;
        trackedOperationIds.clear();
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
      while (inFlight || boundaryDrain) {
        await (inFlight ?? boundaryDrain)!.catch(() => undefined);
      }
    },

    clearPending() {
      clearTimer();
      pending = [];
      pendingMetadata = undefined;
      dirtyBaseline = null;
      sequenceChanged = false;
    },

    handlePrepareBoundary,

    handleReleaseBoundary,

    isSettlementPaused() {
      return boundary !== null;
    },

    getContextSequence() {
      return contextSequence;
    },

    ownsOperationIds(operationIds) {
      return operationIds?.some((id) => trackedOperationIds.has(id)) ?? false;
    },
  };
}
