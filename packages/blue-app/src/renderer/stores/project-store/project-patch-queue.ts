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
  ProjectHistoryStateProjection,
  ReleaseHistoryBoundaryEvent,
} from '../../../shared/project-history';

const PATCH_FLUSH_DELAY_MS = 100;

export interface ProjectPatchQueueCommitContext {
  barrierId?: string;
  metadata?: ProjectDocumentCommitMetadata;
  /** Revision against which a prepared Clojure replacement was built. */
  expectedRevision?: number;
}

export type ProjectPatchQueueClojureField = 'dependencyCoordinates' | 'version';

/** Stable intent for a text edit inside a Clojure library replacement list. */
export interface ProjectPatchQueueClojureFieldIntent {
  readonly entryId: string;
  readonly field: ProjectPatchQueueClojureField;
  readonly baseValue: string;
  readonly value: string;
}

export interface ProjectPatchQueuePendingPatch {
  readonly patch: ProjectDocumentPatch;
  readonly metadata?: ProjectDocumentCommitMetadata;
  readonly clojureFieldIntent?: ProjectPatchQueueClojureFieldIntent;
}

export interface ClojureFieldConflict {
  readonly id: string;
  /** Identity of the retained submission represented by this draft. */
  readonly transactionId: string;
  readonly entryId: string;
  readonly field: ProjectPatchQueueClojureField;
  readonly value: string;
}

export interface ClojureConflictReview {
  readonly conflict: ClojureFieldConflict;
  readonly canonicalValue: string | null;
  readonly revision: number;
}

export interface ProjectPatchQueueDependencies {
  commit(
    patches: readonly ProjectDocumentPatch[],
    context?: ProjectPatchQueueCommitContext,
  ): Promise<ProjectDocumentCommitReceipt>;
  fetchCanonicalSnapshot(): Promise<ProjectEditorSnapshot | null>;
  applyCanonicalSnapshot(
    snapshot: ProjectEditorSnapshot,
    preserveDirty: boolean,
    pendingPatches?: readonly ProjectPatchQueuePendingPatch[],
  ): void;
  setDirty(dirty: boolean): void;
  getCanonicalDirty?: () => boolean | undefined;
  /** Reads history/checkpoint state from the authoritative project owner. */
  fetchCanonicalHistoryProjection?: () => Promise<ProjectHistoryStateProjection | null | undefined>;
  reportBackgroundError(error: unknown): void;
  logRefreshError(error: unknown): void;
  onClojureConflictsChanged?: (conflicts: readonly ClojureFieldConflict[]) => void;
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
    clojureFieldIntent?: ProjectPatchQueueClojureFieldIntent,
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
  /** Returns queued/in-flight patches that must survive a canonical refresh. */
  getPendingPatches(): readonly ProjectPatchQueuePendingPatch[];
  getClojureConflicts(): readonly ClojureFieldConflict[];
  reviewClojureConflict(id: string): Promise<ClojureConflictReview>;
  resolveClojureConflict(review: ClojureConflictReview, value: string | null): Promise<void>;
}

interface PendingTransaction {
  id: string;
  patches: ProjectDocumentPatch[];
  metadata?: ProjectDocumentCommitMetadata;
  clojureFieldIntents: Array<ProjectPatchQueueClojureFieldIntent | undefined>;
  baseRevision: number;
}

function transactionHasClojureFieldIntent(transaction: PendingTransaction): boolean {
  return transaction.clojureFieldIntents.some((intent) => intent !== undefined);
}

function transactionHasClojurePatch(transaction: PendingTransaction): boolean {
  return transaction.patches.some((patch) => patch.clojureProject !== undefined);
}

function copyClojureEntries(
  entries: readonly {
    entryId: string;
    dependencyCoordinates: string;
    version: string;
  }[],
): Array<{ entryId: string; dependencyCoordinates: string; version: string }> {
  return entries.map((entry) => ({ ...entry }));
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
    case 'setLayerHeights':
    case 'setLayerGroupDefaultHeight':
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
    case 'setLayerHeights':
    case 'setLayerGroupDefaultHeight':
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
  let blockedTransactions: PendingTransaction[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let dirtyBaseline: boolean | null = null;
  let sequenceChanged = false;
  let contextSequence = 0;
  let boundary: { barrierId: string } | null = null;
  let boundaryPendingTransactions: PendingTransaction[] = [];
  let boundaryDrain: Promise<void> | null = null;
  let boundaryPreparation: PendingTransaction | null = null;
  let submissionGeneration = 0;
  let inFlightTransaction: PendingTransaction | null = null;
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

  const finishDirtySequenceIfSettled = (
    authoritativeDirty?: boolean,
    requireAuthoritativeDirty = false,
  ): void => {
    if (
      pending.length > 0 ||
      blockedTransactions.length > 0 ||
      inFlightTransaction ||
      boundaryPendingTransactions.length > 0 ||
      dirtyBaseline === null
    )
      return;
    if (!sequenceChanged) {
      const canonicalDirty = requireAuthoritativeDirty
        ? authoritativeDirty
        : (authoritativeDirty ?? dependencies.getCanonicalDirty?.());
      if (canonicalDirty !== undefined || !requireAuthoritativeDirty) {
        dependencies.setDirty(canonicalDirty ?? dirtyBaseline);
      }
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

  const getPendingPatches = (): ProjectPatchQueuePendingPatch[] => {
    const mapTransaction = (transaction: PendingTransaction): ProjectPatchQueuePendingPatch[] =>
      transaction.patches.map((patch, index) => ({
        patch,
        metadata: transaction.metadata,
        ...(transaction.clojureFieldIntents[index]
          ? { clojureFieldIntent: transaction.clojureFieldIntents[index] }
          : {}),
      }));

    return [
      ...blockedTransactions.flatMap(mapTransaction),
      ...(inFlightTransaction ? mapTransaction(inFlightTransaction) : []),
      ...boundaryPendingTransactions.flatMap(mapTransaction),
      ...pending.flatMap(mapTransaction),
    ];
  };

  const applyCanonicalSnapshot = (snapshot: ProjectEditorSnapshot): void => {
    const pendingPatches = getPendingPatches().filter(({ patch }) => patch.clojureProject);
    if (pendingPatches.length > 0) {
      dependencies.applyCanonicalSnapshot(snapshot, true, pendingPatches);
    } else {
      dependencies.applyCanonicalSnapshot(snapshot, true);
    }
  };

  const getClojureConflicts = (): ClojureFieldConflict[] => {
    const conflicts = new Map<string, ClojureFieldConflict>();
    for (const transaction of blockedTransactions) {
      for (const intent of transaction.clojureFieldIntents) {
        if (!intent) continue;
        const id = JSON.stringify([
          submissionGeneration,
          transaction.id,
          intent.entryId,
          intent.field,
        ]);
        conflicts.set(id, {
          id,
          transactionId: transaction.id,
          entryId: intent.entryId,
          field: intent.field,
          value: intent.value,
        });
      }
    }
    return [...conflicts.values()];
  };

  const publishConflicts = (): void => {
    dependencies.onClojureConflictsChanged?.(getClojureConflicts());
  };

  const readConflict = async (id: string) => {
    if (boundary || inFlight)
      throw new Error('Wait for project changes to settle before resolving this draft');
    const generation = submissionGeneration;
    const revision = currentRevision;
    const snapshot = await dependencies.fetchCanonicalSnapshot();
    if (
      generation !== submissionGeneration ||
      revision !== currentRevision ||
      boundary ||
      inFlight
    ) {
      throw new Error('The project changed. Review the draft again.');
    }
    const conflict = getClojureConflicts().find((item) => item.id === id);
    if (!conflict || !snapshot?.clojureProject)
      throw new Error('This draft is no longer available');
    if (snapshot.sessionId !== undefined && snapshot.sessionId !== currentSessionId) {
      throw new Error('The project changed. Review the draft again.');
    }
    const entry = snapshot.clojureProject.libraryEntries.find(
      (item) => item.entryId === conflict.entryId,
    );
    return {
      snapshot,
      review: { conflict, revision, canonicalValue: entry?.[conflict.field] ?? null },
    };
  };

  const fetchAuthoritativeCanonicalDirty = async (): Promise<boolean | undefined> => {
    if (dependencies.fetchCanonicalHistoryProjection) {
      try {
        const projection = await dependencies.fetchCanonicalHistoryProjection();
        if (!projection || projection.revision !== currentRevision) return undefined;
        return projection.stateId !== projection.savedStateId;
      } catch (error) {
        dependencies.logRefreshError(error);
        return undefined;
      }
    }
    return dependencies.getCanonicalDirty?.();
  };

  const reviewClojureConflict = async (id: string): Promise<ClojureConflictReview> => {
    const { review } = await readConflict(id);
    return review;
  };

  const resolveClojureConflict = async (
    review: ClojureConflictReview,
    value: string | null,
  ): Promise<void> => {
    const { snapshot, review: current } = await readConflict(review.conflict.id);
    if (
      current.conflict.id !== review.conflict.id ||
      current.revision !== review.revision ||
      current.canonicalValue !== review.canonicalValue ||
      current.conflict.value !== review.conflict.value
    ) {
      throw new Error('The project or draft changed. Review the draft again.');
    }
    if (value !== null && current.canonicalValue === null) {
      throw new Error('This library was removed. Discard the draft to keep the project value.');
    }
    const resolutionGeneration = submissionGeneration;
    const resolutionRevision = currentRevision;
    const authoritativeDirty =
      value === null ? await fetchAuthoritativeCanonicalDirty() : undefined;
    if (
      resolutionGeneration !== submissionGeneration ||
      resolutionRevision !== currentRevision ||
      boundary ||
      inFlight
    ) {
      throw new Error('The project changed. Review the draft again.');
    }
    if (value === null && authoritativeDirty === undefined) {
      throw new Error('The project dirty state is unavailable. Try again.');
    }
    const { entryId, field, transactionId } = current.conflict;
    // Resolve only this field, even when a transaction also contains another
    // field's draft. Never clear another retained transaction for the same
    // field as conflict recovery.
    const releasedTransactions: PendingTransaction[] = [];
    blockedTransactions = blockedTransactions.flatMap((transaction) => {
      if (transaction.id !== transactionId) return [transaction];
      const indexes = transaction.patches
        .map((_, index) => index)
        .filter((index) => {
          const intent = transaction.clojureFieldIntents[index];
          return intent?.entryId !== entryId || intent.field !== field;
        });
      if (indexes.length === 0) return [];
      const remaining = {
        ...transaction,
        patches: indexes.map((index) => transaction.patches[index]!),
        clojureFieldIntents: indexes.map((index) => transaction.clojureFieldIntents[index]),
      };
      if (transactionHasClojureFieldIntent(remaining)) return [remaining];
      releasedTransactions.push(remaining);
      return [];
    });
    pending = [...releasedTransactions, ...pending];
    if (value !== null) {
      pending.push({
        id: crypto.randomUUID(),
        patches: [
          {
            clojureProject: {
              libraryEntries: snapshot.clojureProject.libraryEntries.map((entry) =>
                entry.entryId === entryId ? { ...entry, [field]: value } : { ...entry },
              ),
            },
          },
        ],
        metadata: {
          phase: 'single',
          label: 'Resolve Clojure Library Draft',
          fieldId: `clojure-library:${entryId}:${field === 'version' ? 'version' : 'coordinates'}`,
        },
        clojureFieldIntents: [{ entryId, field, baseValue: current.canonicalValue!, value }],
        baseRevision: currentRevision,
      });
    }
    publishConflicts();
    applyCanonicalSnapshot(snapshot);
    finishDirtySequenceIfSettled(authoritativeDirty, value === null);
    if (value !== null) await flush();
    else if (pending.length > 0) schedule();
  };

  const prepareTransactionSubmission = async (
    transaction: PendingTransaction,
  ): Promise<{ patches: ProjectDocumentPatch[]; expectedRevision?: number }> => {
    if (!transactionHasClojurePatch(transaction)) {
      return {
        patches: transaction.patches,
        ...(transaction.metadata?.expectedRevision !== undefined
          ? { expectedRevision: transaction.metadata.expectedRevision }
          : {}),
      };
    }

    if (!transactionHasClojureFieldIntent(transaction)) {
      // Structural replacement lists intentionally retain their original
      // revision fence. They must not silently replace unrelated canonical
      // rows after another context has committed.
      return { patches: transaction.patches, expectedRevision: transaction.baseRevision };
    }

    // A snapshot read is not atomic with revision publications. Keep the
    // pre-read fence: main rejects a stale list instead of accepting it under
    // a newer revision that happened to arrive while the read was pending.
    const expectedRevision = currentRevision;
    const expectedSessionId = currentSessionId;
    const canonical = await dependencies.fetchCanonicalSnapshot();
    if (canonical?.sessionId !== undefined && canonical.sessionId !== expectedSessionId) {
      throw new Error('The project changed while preparing the Clojure draft');
    }
    if (!canonical?.clojureProject) {
      throw new Error('Cannot submit a Clojure field edit without canonical project state');
    }

    let workingEntries = copyClojureEntries(canonical.clojureProject.libraryEntries);
    const patches = transaction.patches.map((patch, index) => {
      const nextProject = patch.clojureProject;
      if (!nextProject) return patch;

      const fieldIntent = transaction.clojureFieldIntents[index];
      if (fieldIntent) {
        const targetIndex = workingEntries.findIndex(
          (entry) => entry.entryId === fieldIntent.entryId,
        );
        if (targetIndex < 0) {
          throw new Error(
            `Clojure library field edit conflicts: entry '${fieldIntent.entryId}' no longer exists`,
          );
        }

        const target = workingEntries[targetIndex]!;
        const currentValue = target[fieldIntent.field];
        if (
          currentValue !== fieldIntent.baseValue &&
          currentValue !== fieldIntent.value &&
          fieldIntent.baseValue !== fieldIntent.value
        ) {
          throw new Error(
            `Clojure library field edit conflicts: ${fieldIntent.entryId}.${fieldIntent.field} changed remotely`,
          );
        }

        // A no-op local edit must not overwrite a remote value that arrived
        // while the editor was settling.
        const nextValue =
          currentValue !== fieldIntent.baseValue && fieldIntent.baseValue === fieldIntent.value
            ? currentValue
            : fieldIntent.value;
        workingEntries[targetIndex] = { ...target, [fieldIntent.field]: nextValue };
      } else {
        // This branch is only relevant if a caller batches a structural list
        // operation with a text edit. Preserve canonical values for existing
        // identities while retaining the requested order/additions.
        const canonicalById = new Map(workingEntries.map((entry) => [entry.entryId, entry]));
        workingEntries = nextProject.libraryEntries.map((entry) => {
          const existing = canonicalById.get(entry.entryId);
          return existing ? { ...existing } : { ...entry };
        });
      }

      return {
        ...patch,
        clojureProject: { libraryEntries: copyClojureEntries(workingEntries) },
      };
    });

    return { patches, expectedRevision };
  };

  const drain = async (): Promise<void> => {
    const generation = submissionGeneration;
    const transaction = pending.shift();
    if (!transaction) {
      finishDirtySequenceIfSettled();
      return;
    }
    inFlightTransaction = transaction;

    try {
      const prepared = await prepareTransactionSubmission(transaction);
      if (generation !== submissionGeneration) return;
      const patches = prepared.patches;
      contextSequence += 1;
      const metadata: ProjectDocumentCommitMetadata = {
        ...transaction.metadata,
        operationId: transaction.metadata?.operationId ?? `op-${crypto.randomUUID()}`,
        contextSequence: transaction.metadata?.contextSequence ?? contextSequence,
      };
      trackOperationId(metadata.operationId!);
      const receipt = await dependencies.commit(patches, {
        metadata,
        ...(prepared.expectedRevision !== undefined
          ? { expectedRevision: prepared.expectedRevision }
          : {}),
      });
      if (generation !== submissionGeneration) {
        if (inFlightTransaction === transaction) inFlightTransaction = null;
        return;
      }
      if (inFlightTransaction === transaction) inFlightTransaction = null;
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
          if (generation !== submissionGeneration) return;
          if (snapshot) applyCanonicalSnapshot(snapshot);
        } catch (error) {
          dependencies.logRefreshError(error);
        }
      }
      if (generation !== submissionGeneration) return;
      finishDirtySequenceIfSettled();
    } catch (error) {
      if (generation !== submissionGeneration) return;
      if (inFlightTransaction === transaction) inFlightTransaction = null;
      if (transactionHasClojureFieldIntent(transaction)) {
        blockedTransactions.push(transaction);
        publishConflicts();
      }
      try {
        const snapshot = await dependencies.fetchCanonicalSnapshot();
        if (generation !== submissionGeneration) return;
        if (snapshot) applyCanonicalSnapshot(snapshot);
      } catch (refreshError) {
        dependencies.logRefreshError(refreshError);
      }
      if (generation === submissionGeneration) finishDirtySequenceIfSettled();
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
    const generation = submissionGeneration;
    const isActive = (): boolean => boundary === active && generation === submissionGeneration;
    boundary = active;
    boundaryDrain = (async () => {
      // Pause before awaiting editor settlement. Settlement can synchronously
      // enqueue the editor's final value; the active boundary must own it.
      try {
        await settle?.();
      } catch (error) {
        if (!isActive()) return;
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
      if (!isActive()) return;

      const transactions = pending;
      pending = [];
      let drained = true;
      for (let index = 0; index < transactions.length; index++) {
        const transaction = transactions[index];
        inFlightTransaction = transaction;
        boundaryPendingTransactions = transactions.slice(index + 1);
        const drainedMetadata: ProjectDocumentCommitMetadata = {
          ...transaction.metadata,
          operationId: transaction.metadata?.operationId ?? `op-${crypto.randomUUID()}`,
          contextSequence: transaction.metadata?.contextSequence ?? contextSequence + 1,
        };
        trackOperationId(drainedMetadata.operationId!);
        try {
          boundaryPreparation = transaction;
          const prepared = await prepareTransactionSubmission(transaction);
          if (!isActive()) return;
          boundaryPreparation = null;
          const patches = prepared.patches;
          contextSequence += 1;
          drainedMetadata.contextSequence = contextSequence;
          const receipt = await dependencies.commit(patches, {
            barrierId: active.barrierId,
            metadata: drainedMetadata,
            ...(prepared.expectedRevision !== undefined
              ? { expectedRevision: prepared.expectedRevision }
              : {}),
          });
          if (!isActive()) {
            if (inFlightTransaction === transaction) inFlightTransaction = null;
            return;
          }
          if (inFlightTransaction === transaction) inFlightTransaction = null;
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
            boundaryPendingTransactions = [];
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
              if (!isActive()) return;
              if (snapshot) applyCanonicalSnapshot(snapshot);
            } catch (error) {
              dependencies.logRefreshError(error);
            }
          }
        } catch (error) {
          if (!isActive()) return;
          boundaryPreparation = null;
          if (inFlightTransaction === transaction) inFlightTransaction = null;
          drained = false;
          boundaryPendingTransactions = [];
          const retainsFieldDraft = transactionHasClojureFieldIntent(transaction);
          if (retainsFieldDraft) {
            blockedTransactions.push(transaction);
            publishConflicts();
          }
          pending = [...transactions.slice(index + (retainsFieldDraft ? 1 : 0)), ...pending];
          try {
            const snapshot = await dependencies.fetchCanonicalSnapshot();
            if (!isActive()) return;
            if (snapshot) applyCanonicalSnapshot(snapshot);
          } catch (refreshError) {
            dependencies.logRefreshError(refreshError);
          }
          if (!isActive()) return;
          // Conflicting prefix work becomes a retained draft; the nonzero
          // outstanding count keeps the barrier from resolving on this ack.
          dependencies.reportBackgroundError(
            error instanceof Error ? error : new Error(String(error)),
          );
          break;
        }
      }
      if (!isActive()) return;
      boundaryPendingTransactions = [];

      const unresolvedPrefixCount = countPendingPatches([...blockedTransactions, ...pending]);
      const boundaryDrained = drained && unresolvedPrefixCount === 0;

      dependencies.acknowledgeBoundary?.({
        barrierId: active.barrierId,
        contextId: dependencies.participantContextId ?? '',
        lastAcknowledgedRevision: currentRevision,
        lastAcknowledgedSequence: contextSequence,
        outstandingPrefixCount: boundaryDrained ? 0 : unresolvedPrefixCount,
        ...(boundaryDrained
          ? {}
          : {
              failedPrefixCount: unresolvedPrefixCount,
              unresolvedPrefixCount,
            }),
      });
    })();

    return boundaryDrain;
  };

  const handleReleaseBoundary = (event: ReleaseHistoryBoundaryEvent): void => {
    if (!boundary || boundary.barrierId !== event.barrierId) return;
    // Return only the unsent prefix. A preparation that resumes later no
    // longer owns these transactions and must not submit or clear them.
    pending = [
      ...(boundaryPreparation ? [boundaryPreparation] : []),
      ...boundaryPendingTransactions,
      ...pending,
    ];
    if (inFlightTransaction === boundaryPreparation) inFlightTransaction = null;
    boundaryPreparation = null;
    boundaryPendingTransactions = [];
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
    boundaryPreparation = null;
    boundary = null;
    boundaryDrain = null;
  };

  return {
    enqueue(patch, baseline, metadata, clojureFieldIntent) {
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
        transaction.clojureFieldIntents.push(clojureFieldIntent);
        transaction.metadata = mergePendingMetadata(transaction.metadata, metadata);
      } else {
        pending.push({
          id: crypto.randomUUID(),
          patches: [patch],
          metadata,
          clojureFieldIntents: [clojureFieldIntent],
          baseRevision: currentRevision,
        });
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
      boundaryPendingTransactions = [];
      inFlightTransaction = null;
      pending = [];
      blockedTransactions = [];
      publishConflicts();
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
        boundaryPendingTransactions = [];
        inFlightTransaction = null;
        pending = [];
        blockedTransactions = [];
        publishConflicts();
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
      boundaryPreparation = null;
      clearTimer();
      pending = [];
      blockedTransactions = [];
      publishConflicts();
      boundaryPendingTransactions = [];
      inFlightTransaction = null;
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

    getPendingPatches,
    getClojureConflicts,
    reviewClojureConflict,
    resolveClojureConflict,
  };
}
