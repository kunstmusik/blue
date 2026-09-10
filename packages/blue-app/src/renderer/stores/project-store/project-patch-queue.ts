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
  handlePrepareBoundary(
    event: PrepareHistoryBoundaryEvent,
    settle?: () => Promise<void> | void,
  ): Promise<void>;
  /** Resumes draft submissions after the settlement boundary releases. */
  handleReleaseBoundary(event: ReleaseHistoryBoundaryEvent): void;
  isSettlementPaused(): boolean;
  getContextSequence(): number;
  /** Reserves the next sequence for a command that is not a durable patch. */
  reserveContextSequence(): number;
  /** True when any of the given operation ids were submitted by this queue. */
  ownsOperationIds(operationIds: readonly string[]): boolean;
}

interface PendingTransaction {
  patches: ProjectDocumentPatch[];
  metadata?: ProjectDocumentCommitMetadata;
}

function canJoinPendingTransaction(
  transaction: PendingTransaction,
  metadata: ProjectDocumentCommitMetadata | undefined,
): boolean {
  if (metadata?.phase === 'begin' || metadata?.phase === 'single') return false;
  if (transaction.metadata?.phase === 'end' || transaction.metadata?.phase === 'single') {
    return false;
  }

  const transactionGestureId = transaction.metadata?.gestureId;
  const metadataGestureId = metadata?.gestureId;
  if (transactionGestureId || metadataGestureId) {
    return transactionGestureId !== undefined && transactionGestureId === metadataGestureId;
  }
  return true;
}

function mergePendingMetadata(
  previous: ProjectDocumentCommitMetadata | undefined,
  next: ProjectDocumentCommitMetadata | undefined,
): ProjectDocumentCommitMetadata | undefined {
  if (!next) return previous;
  if (!previous) return next;
  if (previous.gestureId === next.gestureId) {
    if (previous.phase === 'begin' && next.phase === 'update') {
      return { ...next, phase: 'begin' };
    }
    if (previous.phase === 'begin' && next.phase === 'end') {
      return { ...next, phase: 'single' };
    }
  }
  return next;
}

function countPendingPatches(transactions: readonly PendingTransaction[]): number {
  return transactions.reduce((count, transaction) => count + transaction.patches.length, 0);
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
  let pending: PendingTransaction[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let dirtyBaseline: boolean | null = null;
  let sequenceChanged = false;
  let contextSequence = 0;
  let boundary: { barrierId: string } | null = null;
  let boundaryDrain: Promise<void> | null = null;
  let submissionGeneration = 0;
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
    const generation = submissionGeneration;
    const transaction = pending.shift();
    if (!transaction) {
      finishDirtySequenceIfSettled();
      return;
    }
    const { patches } = transaction;

    try {
      contextSequence += 1;
      const metadata: ProjectDocumentCommitMetadata = {
        ...transaction.metadata,
        operationId: transaction.metadata?.operationId ?? `op-${crypto.randomUUID()}`,
        contextSequence: transaction.metadata?.contextSequence ?? contextSequence,
      };
      trackOperationId(metadata.operationId!);
      const receipt = await dependencies.commit(patches, { metadata });
      if (generation !== submissionGeneration) return;
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
      // A receipt carrying `error` means main rejected the batch outright
      // (for example invalid patch metadata). Without this guard the edit
      // exists only in the optimistic local snapshot and is silently lost.
      if (receipt.error) {
        throw new Error(receipt.error);
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
      if (generation !== submissionGeneration) return;
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
      void flush().catch(dependencies.reportBackgroundError);
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

  const handlePrepareBoundary = (
    event: PrepareHistoryBoundaryEvent,
    settle?: () => Promise<void> | void,
  ): Promise<void> => {
    if (boundary) return boundaryDrain ?? Promise.resolve();
    clearTimer();
    const active = { barrierId: event.barrierId };
    boundary = active;
    boundaryDrain = (async () => {
      // Pause before awaiting editor settlement. Settlement can synchronously
      // enqueue the editor's final value; the active boundary must own it.
      try {
        await settle?.();
      } catch (error) {
        // Keep the unresolved editor draft queued and fail closed. Main will
        // reject this acknowledgement, aborting the barrier instead of
        // replaying history over input that never settled.
        dependencies.reportBackgroundError(
          error instanceof Error ? error : new Error(String(error)),
        );
        dependencies.acknowledgeBoundary?.({
          barrierId: active.barrierId,
          contextId: dependencies.participantContextId ?? '',
          lastAcknowledgedRevision: currentRevision,
          lastAcknowledgedSequence: contextSequence,
          outstandingPrefixCount: Math.max(1, pending.length),
          failedPrefixCount: 1,
          unresolvedPrefixCount: 1,
        });
        return;
      }
      // Let the pre-boundary submission settle so the captured prefix keeps
      // its submission order relative to work already sent to main.
      await inFlight?.catch(() => undefined);
      if (boundary !== active) return;

      const transactions = pending;
      pending = [];
      let drained = true;
      for (let index = 0; index < transactions.length; index++) {
        const transaction = transactions[index];
        const patches = transaction.patches;
        const drainedMetadata: ProjectDocumentCommitMetadata = {
          ...transaction.metadata,
          operationId: transaction.metadata?.operationId ?? `op-${crypto.randomUUID()}`,
          contextSequence: transaction.metadata?.contextSequence ?? contextSequence + 1,
        };
        trackOperationId(drainedMetadata.operationId!);
        try {
          contextSequence += 1;
          drainedMetadata.contextSequence = contextSequence;
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
            pending = [...transactions.slice(index), ...pending];
            drained = false;
            break;
          }
          sequenceChanged = sequenceChanged || receipt.changed !== false;
          if (receipt.sessionId === currentSessionId && Number.isInteger(receipt.revision)) {
            currentRevision = Math.max(currentRevision, receipt.revision);
          }
          // An error-bearing receipt is a rejected prefix submission even
          // when the IPC call itself resolved successfully. Keep the prefix
          // queued and abort the settlement barrier instead of acknowledging
          // a clean boundary over optimistic-only state.
          if (receipt.error) {
            throw new Error(receipt.error);
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
          pending = [...transactions.slice(index), ...pending];
          dependencies.reportBackgroundError(
            error instanceof Error ? error : new Error(String(error)),
          );
          break;
        }
      }

      dependencies.acknowledgeBoundary?.({
        barrierId: active.barrierId,
        contextId: dependencies.participantContextId ?? '',
        lastAcknowledgedRevision: currentRevision,
        lastAcknowledgedSequence: contextSequence,
        outstandingPrefixCount: drained ? 0 : countPendingPatches(pending),
        ...(drained
          ? {}
          : {
              failedPrefixCount: countPendingPatches(pending),
              unresolvedPrefixCount: countPendingPatches(pending),
            }),
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
      const transaction = pending[pending.length - 1];
      if (transaction && canJoinPendingTransaction(transaction, metadata)) {
        transaction.patches.push(patch);
        transaction.metadata = mergePendingMetadata(transaction.metadata, metadata);
      } else {
        pending.push({ patches: [patch], metadata });
      }
      if (!boundary) {
        schedule();
      }
    },

    flush,

    reset(sessionId) {
      submissionGeneration += 1;
      clearTimer();
      clearBoundary();
      pending = [];
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
        submissionGeneration += 1;
        clearTimer();
        clearBoundary();
        pending = [];
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
      submissionGeneration += 1;
      clearTimer();
      pending = [];
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

    reserveContextSequence() {
      contextSequence += 1;
      return contextSequence;
    },

    ownsOperationIds(operationIds) {
      return operationIds?.some((id) => trackedOperationIds.has(id)) ?? false;
    },
  };
}
