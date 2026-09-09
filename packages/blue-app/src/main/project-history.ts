import { randomUUID } from 'node:crypto';
import type { BlueData } from '@blue/data';
import type {
  ProjectHistoryCommitRequest,
  ProjectHistoryUndoRequest,
  ProjectHistoryRedoRequest,
  ProjectHistoryReadRequest,
  ProjectHistoryResponse,
  ProjectHistoryStateProjection,
  ProjectDocumentUpdatedEvent,
  ProjectHistoryCommittedResponse,
  ProjectHistoryUnchangedResponse,
  ProjectHistoryStaleResponse,
  ProjectHistoryInvalidResponse,
  ProjectHistoryOversizeResponse,
  ProjectHistoryFailedResponse,
  ProjectHistoryBarrierReason,
  PrepareHistoryBoundaryEvent,
  PrepareHistoryBoundaryAck,
  ReleaseHistoryBoundaryEvent,
  RegisterHistoryParticipantRequest,
  RegisterHistoryParticipantResponse,
  UnregisterHistoryParticipantRequest,
  CancelOversizeProposalRequest,
  ProjectRuntimeOutcome,
} from '../shared/project-history';
import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
} from '../shared/project-editor/contract';
import { transferProjectEditorIdentities } from '../shared/project-editor/identity';
import type { ProjectSession, ProjectSessionSnapshot } from './project-session';
import type { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import {
  prepareTransaction,
  restoreStructuralMemento,
  rollbackScalarRecords,
  applyScalarFieldRecord,
  validatePreconditions,
  type PreparedTransaction,
  type PreparedScalarTransaction,
  type PreparedStructuralTransaction,
  type ScalarFieldRecord,
} from './project-history-memento';

export const DEFAULT_RETAINED_ENTRY_LIMIT = 200;
export const DEFAULT_RETAINED_BYTES_LIMIT = 64 * 1024 * 1024; // 64 MiB
export const GESTURE_GROUPING_TIMEOUT_MS = 500;
export const RECEIPT_CACHE_LIMIT = 500;

export interface HistoryEntry {
  readonly entryId: string;
  readonly documentId: string;
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly label: string;
  readonly sourceContextId?: string;
  readonly originViewId?: string;
  readonly gestureId?: string;
  readonly fieldId?: string;
  readonly timestamp: number;
  readonly retainedBytes: number;
  readonly record: HistoryRecord;
  /** Stable changed-target hints for reconciliation and selection restore. */
  readonly changedTargets?: readonly string[];
  readonly forwardPatches?: readonly ProjectDocumentPatch[];
  readonly inversePatches?: readonly ProjectDocumentPatch[];
}

/**
 * Derives stable changed-target hints from committed patches so replies and
 * publications identify which canonical owners a transition touched. IDs are
 * the stable canonical identities already carried by the patch members.
 */
function collectChangedTargets(patches: readonly ProjectDocumentPatch[]): string[] {
  const targets = new Set<string>();
  for (const patch of patches) {
    if (patch.globalOrc !== undefined) targets.add('text:globalOrc');
    if (patch.globalSco !== undefined) targets.add('text:globalSco');
    if (patch.tablesText !== undefined) targets.add('text:tablesText');
    if (patch.scratchPad !== undefined) targets.add('text:scratchPad');
    if (patch.clojureProject !== undefined) targets.add('clojureProject');
    if (patch.projectProperties !== undefined) targets.add('property:projectProperties');
    if (patch.transport !== undefined) targets.add('transport');
    if (patch.projectUdo !== undefined) targets.add('udo');
    if (patch.midiInput !== undefined) targets.add('midiInput');
    if (patch.blueLive !== undefined) targets.add('blueLive');
    if (patch.mixer !== undefined) {
      const m = patch.mixer;
      if (m.type === 'updateChannel') {
        targets.add(`mixerChannel:${m.channelId}`);
      } else if (m.type === 'setMixerEnabled' || m.type === 'updateExtraRenderTime') {
        targets.add('mixerChannel:mixer');
      } else if (
        m.type === 'updateEffect' ||
        m.type === 'updateSend' ||
        m.type === 'removeChainEntry' ||
        m.type === 'reorderChainEntry' ||
        m.type === 'duplicateChainEntry' ||
        m.type === 'copyChainEntry'
      ) {
        if ('entryId' in m) {
          targets.add(`mixerEntry:${m.channelId}:${m.entryId}`);
        } else {
          targets.add('mixer');
        }
      } else {
        targets.add('mixer');
      }
    }
    if (patch.orchestra !== undefined) {
      const o = patch.orchestra;
      if (
        (o.type === 'updateInstrument' ||
          o.type === 'updateInstrumentComment' ||
          o.type === 'replaceInstrument' ||
          o.type === 'convertGenericToBsb') &&
        'assignmentId' in o
      ) {
        targets.add(`instrument:${o.assignmentId}`);
      } else {
        targets.add('orchestra');
      }
    }
    if (patch.score !== undefined) {
      const sp = patch.score;
      if (sp.type === 'updateSharedProperties' || sp.type === 'updateSoundObjectBehavior') {
        targets.add(`scoreObject:${sp.target.selectionId}`);
      } else if (sp.type === 'updateLayerState') {
        targets.add(`layer:${sp.groupId}:${sp.layerIndex}`);
      } else if (sp.type === 'updateTrackInstrument' && 'track' in sp) {
        targets.add(`track:${sp.track.trackId}`);
      } else {
        targets.add('score');
      }
    }
  }
  return [...targets];
}

export type HistoryRecord =
  | { readonly kind: 'values'; readonly records: readonly ScalarFieldRecord[] }
  | {
      readonly kind: 'structure';
      readonly beforeMemento: BlueData;
      readonly afterMemento: BlueData;
    };

export interface ActiveGroupState {
  readonly gestureId?: string;
  readonly fieldId?: string;
  readonly sourceContextId?: string;
  readonly lastTimestamp: number;
}

export interface HistoryParticipantInfo {
  readonly contextId: string;
  readonly documentId: string;
  acceptedRevision: number;
  lastSequence: number;
}

interface ActiveBarrierState {
  readonly barrierId: string;
  readonly reason: ProjectHistoryBarrierReason;
  readonly pendingContextIds: Set<string>;
  readonly resolve: (result: { ok: boolean; reason?: string }) => void;
  readonly timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface ProjectHistoryDependencies {
  readonly session: ProjectSession;
  readonly publishUpdated?: (event: ProjectDocumentUpdatedEvent) => void | Promise<void>;
  readonly retainedEntryLimit?: number;
  readonly retainedBytesLimit?: number;
  readonly gestureGroupingTimeoutMs?: number;
  readonly broadcastPrepareBoundary?: (event: PrepareHistoryBoundaryEvent) => void | Promise<void>;
  readonly broadcastReleaseBoundary?: (event: ReleaseHistoryBoundaryEvent) => void | Promise<void>;
  readonly barrierTimeoutMs?: number;
  readonly reconciliation?: ProjectRuntimeReconciliation;
}

export function scalarRecordsToInversePatches(
  records: readonly ScalarFieldRecord[],
): ProjectDocumentPatch[] {
  const patches: ProjectDocumentPatch[] = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i]!;
    switch (rec.targetType) {
      case 'text':
        if (rec.targetId === 'globalOrc') {
          patches.push({ globalOrc: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: String(rec.beforeValue ?? '') });
        } else if (rec.targetId === 'scratchPad') {
          patches.push({
            scratchPad: { [rec.field]: rec.beforeValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        patches.push({
          projectProperties: { [rec.field]: rec.beforeValue } as NonNullable<
            ProjectDocumentPatch['projectProperties']
          >,
        });
        break;
      case 'transport':
        patches.push({
          transport: { [rec.field]: rec.beforeValue } as NonNullable<
            ProjectDocumentPatch['transport']
          >,
        });
        break;
      case 'mixerChannel':
        if (rec.targetId === 'mixer') {
          if (rec.field === 'enabled') {
            patches.push({ mixer: { type: 'setMixerEnabled', value: Boolean(rec.beforeValue) } });
          } else if (rec.field === 'extraRenderTime') {
            patches.push({
              mixer: { type: 'updateExtraRenderTime', value: Number(rec.beforeValue) },
            });
          }
        } else {
          patches.push({
            mixer: {
              type: 'updateChannel',
              channelId: rec.targetId,
              patch: { [rec.field]: rec.beforeValue } as never,
            },
          });
        }
        break;
      default:
        break;
    }
  }
  return patches;
}

export function scalarRecordsToForwardPatches(
  records: readonly ScalarFieldRecord[],
): ProjectDocumentPatch[] {
  const patches: ProjectDocumentPatch[] = [];
  for (const rec of records) {
    switch (rec.targetType) {
      case 'text':
        if (rec.targetId === 'globalOrc') {
          patches.push({ globalOrc: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'globalSco') {
          patches.push({ globalSco: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'tablesText') {
          patches.push({ tablesText: String(rec.afterValue ?? '') });
        } else if (rec.targetId === 'scratchPad') {
          patches.push({
            scratchPad: { [rec.field]: rec.afterValue } as NonNullable<
              ProjectDocumentPatch['scratchPad']
            >,
          });
        }
        break;
      case 'property':
        patches.push({
          projectProperties: { [rec.field]: rec.afterValue } as NonNullable<
            ProjectDocumentPatch['projectProperties']
          >,
        });
        break;
      case 'transport':
        patches.push({
          transport: { [rec.field]: rec.afterValue } as NonNullable<
            ProjectDocumentPatch['transport']
          >,
        });
        break;
      case 'mixerChannel':
        if (rec.targetId === 'mixer') {
          if (rec.field === 'enabled') {
            patches.push({ mixer: { type: 'setMixerEnabled', value: Boolean(rec.afterValue) } });
          } else if (rec.field === 'extraRenderTime') {
            patches.push({
              mixer: { type: 'updateExtraRenderTime', value: Number(rec.afterValue) },
            });
          }
        } else {
          patches.push({
            mixer: {
              type: 'updateChannel',
              channelId: rec.targetId,
              patch: { [rec.field]: rec.afterValue } as never,
            },
          });
        }
        break;
      default:
        break;
    }
  }
  return patches;
}

function estimateEntryBytes(record: HistoryRecord): number {
  const baseOverhead = 256;
  if (record.kind === 'values') {
    let bytes = baseOverhead;
    for (const r of record.records) {
      bytes += 64;
      bytes += (r.targetId.length + r.field.length) * 2;
      if (typeof r.beforeValue === 'string') bytes += r.beforeValue.length * 2;
      if (typeof r.afterValue === 'string') bytes += r.afterValue.length * 2;
    }
    return bytes;
  } else {
    // Structure: estimate via XML string representations
    let beforeBytes = 1024;
    let afterBytes = 1024;
    try {
      beforeBytes += record.beforeMemento.saveToString().length * 2;
      afterBytes += record.afterMemento.saveToString().length * 2;
    } catch {
      beforeBytes += 8192;
      afterBytes += 8192;
    }
    return baseOverhead + beforeBytes + afterBytes;
  }
}

export class ProjectHistory {
  private readonly session: ProjectSession;
  private readonly publishUpdated?: (event: ProjectDocumentUpdatedEvent) => void | Promise<void>;
  private readonly retainedEntryLimit: number;
  private readonly retainedBytesLimit: number;
  private readonly broadcastPrepareBoundary?: (
    event: PrepareHistoryBoundaryEvent,
  ) => void | Promise<void>;
  private readonly broadcastReleaseBoundary?: (
    event: ReleaseHistoryBoundaryEvent,
  ) => void | Promise<void>;
  private readonly barrierTimeoutMs: number;
  private readonly reconciliation?: ProjectRuntimeReconciliation;

  private entries: HistoryEntry[] = [];
  private cursor = 0;
  private savedStateId: string | null = null;
  private activeGroup: ActiveGroupState | null = null;
  private receiptCache = new Map<string, ProjectHistoryResponse>();
  private receiptFingerprints = new Map<string, string>();
  private pendingOversizeProposal: {
    token: string;
    documentId: string;
    expectedRevision: number;
    payloadFingerprint: string;
  } | null = null;

  private readonly participants = new Map<string, HistoryParticipantInfo>();
  private activeBarrier: ActiveBarrierState | null = null;
  private barrierReleasePromise: Promise<void> | null = null;
  private notifyBarrierReleased: (() => void) | null = null;
  private barrierExecutionQueue: Promise<unknown> = Promise.resolve();

  constructor(dependencies: ProjectHistoryDependencies) {
    this.session = dependencies.session;
    this.publishUpdated = dependencies.publishUpdated;
    this.retainedEntryLimit = dependencies.retainedEntryLimit ?? DEFAULT_RETAINED_ENTRY_LIMIT;
    this.retainedBytesLimit = dependencies.retainedBytesLimit ?? DEFAULT_RETAINED_BYTES_LIMIT;
    this.broadcastPrepareBoundary = dependencies.broadcastPrepareBoundary;
    this.broadcastReleaseBoundary = dependencies.broadcastReleaseBoundary;
    this.barrierTimeoutMs = dependencies.barrierTimeoutMs ?? 5000;
    this.reconciliation = dependencies.reconciliation;
  }

  getCursor(): number {
    return this.cursor;
  }

  getEntries(): readonly HistoryEntry[] {
    return this.entries;
  }

  getSavedStateId(): string | null {
    return this.savedStateId;
  }

  setSavedStateId(stateId: string | null): void {
    this.savedStateId = stateId;
  }

  checkpointSave(savedStateId?: string): void {
    this.closeGroup();
    const current = this.session.read();
    this.savedStateId = savedStateId ?? current.stateId;
  }

  markClean(): void {
    this.checkpointSave();
  }

  isDirty(): boolean {
    const current = this.session.read();
    if (!current.data) return false;
    return current.stateId !== this.savedStateId;
  }

  clear(): void {
    this.entries = [];
    this.cursor = 0;
    this.activeGroup = null;
    this.receiptCache.clear();
    this.receiptFingerprints.clear();
    this.pendingOversizeProposal = null;
  }

  closeGroup(): void {
    this.activeGroup = null;
  }

  read(request?: ProjectHistoryReadRequest): ProjectHistoryStateProjection {
    const current = this.session.read();
    const canUndo = this.cursor > 0;
    const canRedo = this.cursor < this.entries.length;
    const undoEntry = canUndo ? this.entries[this.cursor - 1] : undefined;
    const redoEntry = canRedo ? this.entries[this.cursor] : undefined;

    let retainedBytes = 0;
    for (const e of this.entries) {
      retainedBytes += e.retainedBytes;
    }

    return {
      canUndo,
      canRedo,
      undoLabel: undoEntry ? undoEntry.label : null,
      redoLabel: redoEntry ? redoEntry.label : null,
      cursor: this.cursor,
      length: this.entries.length,
      retainedBytes,
      savedStateId: this.savedStateId,
      stateId: current.stateId ?? '',
      limitBytes: this.retainedBytesLimit,
      maxEntries: this.retainedEntryLimit,
    };
  }

  private cacheReceipt(operationId: string, response: ProjectHistoryResponse): void {
    if (this.receiptCache.size >= RECEIPT_CACHE_LIMIT) {
      const firstKey = this.receiptCache.keys().next().value;
      if (firstKey !== undefined) {
        this.receiptCache.delete(firstKey);
        this.receiptFingerprints.delete(firstKey);
      }
    }
    this.receiptCache.set(operationId, response);
  }

  /**
   * Stable identity of a commit's semantic payload. Retries reuse the same
   * operationId with an identical fingerprint; a reused operationId carrying a
   * different payload is a conflict and must be rejected, never reapplied.
   */
  private static commitFingerprint(request: ProjectHistoryCommitRequest): string {
    return JSON.stringify([
      request.documentId,
      request.label,
      request.gestureId ?? null,
      request.fieldId ?? null,
      request.phase ?? 'single',
      request.patches ?? [],
    ]);
  }

  private enforceLimits(): void {
    let totalBytes = 0;
    for (const e of this.entries) {
      totalBytes += e.retainedBytes;
    }

    while (
      this.entries.length > 0 &&
      (this.entries.length > this.retainedEntryLimit || totalBytes > this.retainedBytesLimit)
    ) {
      const evicted = this.entries.shift()!;
      totalBytes -= evicted.retainedBytes;
      this.cursor = Math.max(0, this.cursor - 1);
    }
  }

  getActiveBarrier(): PrepareHistoryBoundaryEvent | null {
    if (!this.activeBarrier) return null;
    return {
      barrierId: this.activeBarrier.barrierId,
      reason: this.activeBarrier.reason,
    };
  }

  getParticipants(): readonly HistoryParticipantInfo[] {
    return Array.from(this.participants.values());
  }

  registerParticipant(
    request: RegisterHistoryParticipantRequest,
  ): RegisterHistoryParticipantResponse {
    this.participants.set(request.contextId, {
      contextId: request.contextId,
      documentId: request.documentId,
      acceptedRevision: request.acceptedRevision,
      lastSequence: 0,
    });

    if (this.activeBarrier) {
      this.activeBarrier.pendingContextIds.add(request.contextId);
      return {
        ok: true,
        activeBarrier: {
          barrierId: this.activeBarrier.barrierId,
          reason: this.activeBarrier.reason,
        },
      };
    }

    return { ok: true };
  }

  unregisterParticipant(request: UnregisterHistoryParticipantRequest): void {
    this.participants.delete(request.contextId);
    if (this.activeBarrier) {
      this.activeBarrier.pendingContextIds.delete(request.contextId);
      if (this.activeBarrier.pendingContextIds.size === 0) {
        this.activeBarrier.resolve({ ok: true });
      }
    }
  }

  acknowledgeBoundary(ack: PrepareHistoryBoundaryAck): void {
    const participant = this.participants.get(ack.contextId);
    if (participant) {
      participant.lastSequence = Math.max(participant.lastSequence, ack.lastAcknowledgedSequence);
      participant.acceptedRevision = Math.max(
        participant.acceptedRevision,
        ack.lastAcknowledgedRevision,
      );
    }

    if (!this.activeBarrier || this.activeBarrier.barrierId !== ack.barrierId) {
      return;
    }

    if (ack.outstandingPrefixCount > 0) {
      return;
    }

    this.activeBarrier.pendingContextIds.delete(ack.contextId);
    if (this.activeBarrier.pendingContextIds.size === 0) {
      this.activeBarrier.resolve({ ok: true });
    }
  }

  cancelOversizeProposal(request: CancelOversizeProposalRequest): void {
    if (this.pendingOversizeProposal?.token === request.proposalToken) {
      this.pendingOversizeProposal = null;
    }
  }

  abortBoundary(barrierId: string, reason = 'Settlement barrier aborted'): void {
    if (this.activeBarrier && this.activeBarrier.barrierId === barrierId) {
      this.activeBarrier.resolve({ ok: false, reason });
    }
  }

  private async waitForBarrierToRelease(): Promise<void> {
    while (this.activeBarrier !== null) {
      if (this.barrierReleasePromise) {
        await this.barrierReleasePromise;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  private initBarrierReleasePromise(): void {
    this.barrierReleasePromise = new Promise<void>((resolve) => {
      this.notifyBarrierReleased = () => {
        this.barrierReleasePromise = null;
        this.notifyBarrierReleased = null;
        resolve();
      };
    });
  }

  async settleBoundary(reason: ProjectHistoryBarrierReason): Promise<boolean> {
    return this.runSettlementBarrier(reason, async () => true);
  }

  async runSettlementBarrier<T>(
    reason: ProjectHistoryBarrierReason,
    action: () => Promise<T>,
  ): Promise<T> {
    const previousQueue = this.barrierExecutionQueue;
    let runResolve!: (val: unknown) => void;
    this.barrierExecutionQueue = new Promise((resolve) => {
      runResolve = resolve;
    });

    try {
      await previousQueue;
    } catch {
      // Ignore errors from previous barrier runs in the FIFO queue
    }

    try {
      const barrierId = `barrier-${randomUUID()}`;
      const contexts = Array.from(this.participants.keys());

      this.closeGroup();

      if (contexts.length > 0) {
        let resolveBarrier!: (result: { ok: boolean; reason?: string }) => void;
        const barrierPromise = new Promise<{ ok: boolean; reason?: string }>((resolve) => {
          resolveBarrier = resolve;
        });

        this.initBarrierReleasePromise();

        const timeoutHandle = setTimeout(() => {
          if (this.activeBarrier?.barrierId === barrierId) {
            resolveBarrier({
              ok: false,
              reason: `Settlement barrier timed out after ${this.barrierTimeoutMs}ms`,
            });
          }
        }, this.barrierTimeoutMs);

        this.activeBarrier = {
          barrierId,
          reason,
          pendingContextIds: new Set(contexts),
          resolve: resolveBarrier,
          timeoutHandle,
        };

        const prepEvt: PrepareHistoryBoundaryEvent = { barrierId, reason };
        try {
          await this.broadcastPrepareBoundary?.(prepEvt);
        } catch (err) {
          console.error('Error broadcasting prepare boundary:', err);
        }

        const barrierResult = await barrierPromise;
        clearTimeout(timeoutHandle);

        if (!barrierResult.ok) {
          this.activeBarrier = null;
          this.notifyBarrierReleased?.();
          const releaseEvt: ReleaseHistoryBoundaryEvent = {
            barrierId,
            status: 'aborted',
            reason: barrierResult.reason,
          };
          try {
            await this.broadcastReleaseBoundary?.(releaseEvt);
          } catch (err) {
            console.error('Error broadcasting aborted release boundary:', err);
          }
          throw new Error(barrierResult.reason ?? 'Settlement barrier aborted');
        }
      }

      let result: T;
      try {
        result = await action();
      } finally {
        this.activeBarrier = null;
        this.notifyBarrierReleased?.();
        const releaseEvt: ReleaseHistoryBoundaryEvent = {
          barrierId,
          status: 'ready',
        };
        try {
          await this.broadcastReleaseBoundary?.(releaseEvt);
        } catch (err) {
          console.error('Error broadcasting ready release boundary:', err);
        }
      }

      return result;
    } finally {
      runResolve(undefined);
    }
  }

  async commit(request: ProjectHistoryCommitRequest): Promise<ProjectHistoryResponse> {
    // Deduplication check: an identical retry replays the cached receipt; a
    // reused operationId with different content is a conflicting submission.
    const fingerprint = ProjectHistory.commitFingerprint(request);
    if (this.receiptCache.has(request.operationId)) {
      const knownFingerprint = this.receiptFingerprints.get(request.operationId);
      if (knownFingerprint !== undefined && knownFingerprint !== fingerprint) {
        const conflict: ProjectHistoryInvalidResponse = {
          status: 'invalid',
          operationId: request.operationId,
          documentId: request.documentId,
          reason: `Conflicting reuse of operationId ${request.operationId}: payload differs from the already-processed submission`,
        };
        return conflict;
      }
      return this.receiptCache.get(request.operationId)!;
    }
    this.receiptFingerprints.set(request.operationId, fingerprint);

    if (this.activeBarrier) {
      const isPrefix = request.barrierId === this.activeBarrier.barrierId;
      if (!isPrefix) {
        await this.waitForBarrierToRelease();
      }
    }

    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Document lifetime mismatch
    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${current.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const participant = request.origin?.contextId
      ? this.participants.get(request.origin.contextId)
      : undefined;

    // Monotonic sequence high-watermark check per context
    if (participant && request.contextSequence < participant.lastSequence) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      return resp;
    }

    // Revision mismatch with bounded stale retry
    if (request.expectedRevision !== current.revision) {
      const canRetry =
        request.preconditions &&
        request.preconditions.length > 0 &&
        validatePreconditions(current.data, request.preconditions).valid;

      if (!canRetry) {
        const resp: ProjectHistoryStaleResponse = {
          status: 'stale',
          operationId: request.operationId,
          documentId: request.documentId,
          currentRevision: current.revision,
          currentStateId: current.stateId ?? '',
          reason: `Revision mismatch (expected ${request.expectedRevision}, current ${current.revision})`,
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      }
    }

    if (participant) {
      participant.lastSequence = Math.max(participant.lastSequence, request.contextSequence);
    }

    // Handle gesture cancellation
    if (request.phase === 'cancel') {
      if (
        this.activeGroup &&
        this.cursor > 0 &&
        this.cursor === this.entries.length &&
        ((request.gestureId && this.activeGroup.gestureId === request.gestureId) ||
          (request.fieldId && this.activeGroup.fieldId === request.fieldId))
      ) {
        const entry = this.entries.pop()!;
        this.cursor--;
        this.activeGroup = null;

        if (this.reconciliation && entry.gestureId) {
          await this.reconciliation.drainPreviews(entry.gestureId);
        }

        if (entry.record.kind === 'values') {
          rollbackScalarRecords(current.data, entry.record.records);
          this.session.recordMutation({ changed: true, stateId: entry.beforeStateId });
        } else {
          restoreStructuralMemento(this.session, entry.record.beforeMemento, {
            stateId: entry.beforeStateId,
          });
        }

        const updatedSnap = this.session.read();
        const projection = this.read();

        const inversePatches =
          entry.inversePatches ??
          (entry.record.kind === 'values'
            ? scalarRecordsToInversePatches(entry.record.records)
            : [{ orchestra: { type: 'structuralChange' } as never }]);

        const runtimeOutcomes = this.reconciliation
          ? await this.reconciliation.reconcileCommit({
              documentId: updatedSnap.documentId!,
              revision: updatedSnap.revision,
              patches: inversePatches,
            })
          : undefined;

        const updatedEvent: ProjectDocumentUpdatedEvent = {
          documentId: updatedSnap.documentId!,
          sessionId: updatedSnap.sessionId,
          revision: updatedSnap.revision,
          stateId: updatedSnap.stateId!,
          isDirty: this.isDirty(),
          history: projection,
          acceptedOperationIds: [request.operationId],
          sourceSequence: request.contextSequence,
          snapshot: null,
          originViewId: request.origin?.viewId,
          runtimeOutcomes,
        };
        await this.publishUpdated?.(updatedEvent);

        const resp: ProjectHistoryCommittedResponse = {
          status: 'committed',
          operationId: request.operationId,
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          stateId: updatedSnap.stateId!,
          isDirty: this.isDirty(),
          history: projection,
          runtimeOutcomes,
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      } else {
        this.closeGroup();
        const resp: ProjectHistoryUnchangedResponse = {
          status: 'unchanged',
          operationId: request.operationId,
          documentId: current.documentId,
          revision: current.revision,
          stateId: current.stateId ?? '',
          isDirty: this.isDirty(),
          history: this.read(),
        };
        this.cacheReceipt(request.operationId, resp);
        return resp;
      }
    }

    // Prepare transaction
    const prep = prepareTransaction(current.data, request.patches ?? [], {
      preconditions: request.preconditions,
      context: {
        projectSessionId: current.sessionId,
        projectRevision: current.revision,
      },
    });

    if (prep.status === 'stale') {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: current.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: prep.reason,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (prep.status === 'invalid') {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: current.documentId,
        reason: prep.reason,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const { transaction } = prep;

    // Unchanged / empty transaction
    if (transaction.kind === 'empty' || !transaction.changed) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
        receipt: {
          revision: current.revision,
          sessionId: current.sessionId,
          changed: false,
          patchChanged: transaction.patchChanged
            ? [...transaction.patchChanged]
            : (request.patches?.map(() => false) ?? []),
          patchAccepted: transaction.patchAccepted
            ? [...transaction.patchAccepted]
            : (request.patches?.map(() => true) ?? []),
          documentId: current.documentId,
          stateId: current.stateId ?? '',
        },
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Check oversize limit for structural transaction
    const beforeStateId = current.stateId ?? `state-${randomUUID()}`;
    const nextStateId = `state-${randomUUID()}`;

    let historyRecord: HistoryRecord;
    if (transaction.kind === 'scalar') {
      historyRecord = {
        kind: 'values',
        records: transaction.records,
      };
    } else {
      historyRecord = {
        kind: 'structure',
        beforeMemento: transaction.beforeMemento,
        afterMemento: transaction.afterMemento,
      };
    }

    const estimatedBytes = estimateEntryBytes(historyRecord);

    // Oversize proposal handling
    if (request.proposalToken) {
      if (
        this.pendingOversizeProposal &&
        this.pendingOversizeProposal.token === request.proposalToken
      ) {
        if (
          this.pendingOversizeProposal.documentId !== current.documentId ||
          this.pendingOversizeProposal.expectedRevision !== request.expectedRevision ||
          this.pendingOversizeProposal.payloadFingerprint !== JSON.stringify(request.patches)
        ) {
          this.pendingOversizeProposal = null;
          if (transaction.kind === 'scalar') {
            transaction.rollback();
          }
          return {
            status: 'stale',
            operationId: request.operationId,
            documentId: current.documentId,
            currentRevision: current.revision,
            currentStateId: current.stateId ?? '',
            reason:
              'Oversize proposal confirmation is stale (document, revision, or payload changed)',
          };
        }
        // One-use consumption: clear pending token and reset retained history
        this.pendingOversizeProposal = null;
        this.clear();
      } else {
        if (transaction.kind === 'scalar') {
          transaction.rollback();
        }
        return {
          status: 'invalid',
          operationId: request.operationId,
          documentId: current.documentId,
          reason: 'Oversize proposal token is invalid or already consumed',
        };
      }
    } else if (estimatedBytes > this.retainedBytesLimit) {
      const token = `oversize-${randomUUID()}`;
      this.pendingOversizeProposal = {
        token,
        documentId: current.documentId,
        expectedRevision: request.expectedRevision,
        payloadFingerprint: JSON.stringify(request.patches),
      };
      const resp: ProjectHistoryOversizeResponse = {
        status: 'oversize',
        operationId: request.operationId,
        documentId: current.documentId,
        proposalToken: token,
        estimatedBytes,
        limitBytes: this.retainedBytesLimit,
        explanation: `Action of ${Math.round(estimatedBytes / (1024 * 1024))} MiB exceeds the ${Math.round(this.retainedBytesLimit / (1024 * 1024))} MiB history limit`,
      };
      // Rollback scalar transaction if it was applied
      if (transaction.kind === 'scalar') {
        transaction.rollback();
      }
      return resp;
    }

    // Truncate redo stack on new commit (chronological branch semantics)
    if (this.cursor < this.entries.length) {
      this.entries = this.entries.slice(0, this.cursor);
    }

    const forwardPatches = request.patches ? [...request.patches] : [];
    const inversePatches =
      historyRecord.kind === 'values'
        ? scalarRecordsToInversePatches(historyRecord.records)
        : [{ orchestra: { type: 'structuralChange' } as never }];

    // Check adjacent gesture grouping
    const now = Date.now();
    const canGroup =
      this.activeGroup !== null &&
      this.cursor > 0 &&
      now - this.activeGroup.lastTimestamp <= GESTURE_GROUPING_TIMEOUT_MS &&
      ((request.gestureId !== undefined && this.activeGroup.gestureId === request.gestureId) ||
        (request.fieldId !== undefined &&
          this.activeGroup.fieldId === request.fieldId &&
          this.activeGroup.sourceContextId === request.origin?.contextId));

    if (canGroup) {
      // Merge with top entry: keep original before-state, update after-state
      const top = this.entries[this.cursor - 1]!;
      let mergedRecord: HistoryRecord;

      if (top.record.kind === 'values' && historyRecord.kind === 'values') {
        mergedRecord = {
          kind: 'values',
          records: [...top.record.records, ...historyRecord.records],
        };
      } else {
        const beforeMem =
          top.record.kind === 'structure' ? top.record.beforeMemento : current.data.historyCopy();
        const afterMem =
          historyRecord.kind === 'structure'
            ? historyRecord.afterMemento
            : (transaction as PreparedStructuralTransaction).candidate;
        mergedRecord = {
          kind: 'structure',
          beforeMemento: beforeMem,
          afterMemento: afterMem,
        };
      }

      const mergedEntry: HistoryEntry = {
        entryId: top.entryId,
        documentId: current.documentId,
        beforeStateId: top.beforeStateId,
        afterStateId: nextStateId,
        label: request.label || top.label,
        sourceContextId: request.origin?.contextId ?? top.sourceContextId,
        originViewId: request.origin?.viewId ?? top.originViewId,
        gestureId: request.gestureId ?? top.gestureId,
        fieldId: request.fieldId ?? top.fieldId,
        timestamp: now,
        retainedBytes: estimateEntryBytes(mergedRecord),
        record: mergedRecord,
        changedTargets: [
          ...new Set([
            ...(top.changedTargets ?? []),
            ...collectChangedTargets(request.patches ?? []),
          ]),
        ],
        forwardPatches: [...(top.forwardPatches ?? []), ...forwardPatches],
        inversePatches:
          mergedRecord.kind === 'values'
            ? scalarRecordsToInversePatches(mergedRecord.records)
            : [{ orchestra: { type: 'structuralChange' } as never }],
      };

      this.entries[this.cursor - 1] = mergedEntry;
      this.activeGroup = {
        gestureId: request.gestureId,
        fieldId: request.fieldId,
        sourceContextId: request.origin?.contextId,
        lastTimestamp: now,
      };
    } else {
      // New history entry
      const newEntry: HistoryEntry = {
        entryId: `entry-${randomUUID()}`,
        documentId: current.documentId,
        beforeStateId,
        afterStateId: nextStateId,
        label: request.label,
        sourceContextId: request.origin?.contextId,
        originViewId: request.origin?.viewId,
        gestureId: request.gestureId,
        fieldId: request.fieldId,
        timestamp: now,
        retainedBytes: estimatedBytes,
        record: historyRecord,
        changedTargets: collectChangedTargets(request.patches ?? []),
        forwardPatches,
        inversePatches,
      };

      this.entries.push(newEntry);
      this.cursor = this.entries.length;

      if (request.phase === 'begin' || request.phase === 'update') {
        this.activeGroup = {
          gestureId: request.gestureId,
          fieldId: request.fieldId,
          sourceContextId: request.origin?.contextId,
          lastTimestamp: now,
        };
      } else {
        this.activeGroup = null;
      }
    }

    // Apply change to ProjectSession
    if (transaction.kind === 'structure') {
      this.session.publishCommittedDocument(transaction.candidate, {
        stateId: nextStateId,
      });
    } else {
      this.session.recordMutation({
        changed: true,
        stateId: nextStateId,
      });
    }

    if (request.phase === 'end') {
      this.closeGroup();
    }

    this.enforceLimits();

    const updatedSnap = this.session.read();
    const projection = this.read();

    const runtimeOutcomes = this.reconciliation
      ? await this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: request.patches ?? [],
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: null,
      selectionHints: request.origin?.selection,
      originViewId: request.origin?.viewId,
      runtimeOutcomes,
    };
    await this.publishUpdated?.(updatedEvent);

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      changedTargets: [...(this.entries[this.cursor - 1]?.changedTargets ?? [])],
      runtimeOutcomes,
      receipt: {
        revision: updatedSnap.revision,
        sessionId: updatedSnap.sessionId,
        changed: true,
        patchChanged: transaction.patchChanged
          ? [...transaction.patchChanged]
          : (request.patches?.map(() => true) ?? []),
        patchAccepted: transaction.patchAccepted
          ? [...transaction.patchAccepted]
          : (request.patches?.map(() => true) ?? []),
        documentId: updatedSnap.documentId!,
        stateId: updatedSnap.stateId!,
      },
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }

  async commitDirectMutation(options: {
    label: string;
    mutator: (candidate: BlueData) => boolean;
  }): Promise<ProjectDocumentCommitReceipt> {
    this.closeGroup();
    const current = this.session.read();
    if (!current.data || !current.documentId) {
      throw new Error('No active project session');
    }

    const beforeStateId = current.stateId ?? `state-${randomUUID()}`;
    const nextStateId = `state-${randomUUID()}`;

    const candidate = current.data.historyCopy();
    transferProjectEditorIdentities(current.data, candidate);

    const beforeMemento = current.data.historyCopy();
    transferProjectEditorIdentities(current.data, beforeMemento);

    const changed = options.mutator(candidate);
    if (!changed) {
      return {
        revision: current.revision,
        sessionId: current.sessionId,
        changed: false,
        documentId: current.documentId,
        stateId: current.stateId ?? '',
      };
    }

    const afterMemento = candidate.historyCopy();
    transferProjectEditorIdentities(candidate, afterMemento);

    // Truncate redo stack on new commit (chronological branch semantics)
    if (this.cursor < this.entries.length) {
      this.entries.splice(this.cursor);
    }

    const entry: HistoryEntry = {
      entryId: `entry-${randomUUID()}`,
      documentId: current.documentId,
      beforeStateId,
      afterStateId: nextStateId,
      label: options.label,
      timestamp: Date.now(),
      retainedBytes: estimateEntryBytes({ kind: 'structure', beforeMemento, afterMemento }),
      record: { kind: 'structure', beforeMemento, afterMemento },
      forwardPatches: [{ orchestra: { type: 'structuralChange' } as never }],
      inversePatches: [{ orchestra: { type: 'structuralChange' } as never }],
    };

    this.entries.push(entry);
    this.cursor = this.entries.length;
    this.activeGroup = null;

    this.session.publishCommittedDocument(candidate, { stateId: nextStateId });
    this.enforceLimits();

    const updatedSnap = this.session.read();
    const projection = this.read();

    const runtimeOutcomes = this.reconciliation
      ? await this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: [{ orchestra: { type: 'structuralChange' } as never }],
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      acceptedOperationIds: [],
      snapshot: null,
      runtimeOutcomes,
    };
    await this.publishUpdated?.(updatedEvent);

    return {
      revision: updatedSnap.revision,
      sessionId: updatedSnap.sessionId,
      changed: true,
      documentId: updatedSnap.documentId!,
      stateId: updatedSnap.stateId!,
    };
  }

  recordDirectStructureMutation(options: {
    label: string;
    beforeMemento: BlueData;
    afterMemento: BlueData;
  }): ProjectDocumentCommitReceipt {
    this.closeGroup();
    const current = this.session.read();
    if (!current.data || !current.documentId) {
      throw new Error('No active project session');
    }

    const beforeStateId = current.stateId ?? `state-${randomUUID()}`;
    const nextStateId = `state-${randomUUID()}`;

    // Truncate redo stack on new commit (chronological branch semantics)
    if (this.cursor < this.entries.length) {
      this.entries.splice(this.cursor);
    }

    const entry: HistoryEntry = {
      entryId: `entry-${randomUUID()}`,
      documentId: current.documentId,
      beforeStateId,
      afterStateId: nextStateId,
      label: options.label,
      timestamp: Date.now(),
      retainedBytes: estimateEntryBytes({
        kind: 'structure',
        beforeMemento: options.beforeMemento,
        afterMemento: options.afterMemento,
      }),
      record: {
        kind: 'structure',
        beforeMemento: options.beforeMemento,
        afterMemento: options.afterMemento,
      },
      forwardPatches: [{ orchestra: { type: 'structuralChange' } as never }],
      inversePatches: [{ orchestra: { type: 'structuralChange' } as never }],
    };

    this.entries.push(entry);
    this.cursor = this.entries.length;
    this.activeGroup = null;

    const receipt = this.session.recordMutation({ changed: true, stateId: nextStateId });
    this.enforceLimits();

    const updatedSnap = this.session.read();
    const projection = this.read();

    if (this.reconciliation) {
      void this.reconciliation
        .reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: [{ orchestra: { type: 'structuralChange' } as never }],
        })
        .catch((err) => {
          console.error('Error reconciling commit:', err);
        });
    }

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      acceptedOperationIds: [],
      snapshot: null,
    };
    void this.publishUpdated?.(updatedEvent);

    return receipt;
  }

  async undo(request: ProjectHistoryUndoRequest): Promise<ProjectHistoryResponse> {
    if (this.receiptCache.has(request.operationId)) {
      return this.receiptCache.get(request.operationId)!;
    }

    const initial = this.session.read();
    if (!initial.data || !initial.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== initial.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: initial.revision,
        currentStateId: initial.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${initial.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const expectedRevisionBeforeBarrier = initial.revision;

    try {
      return await this.runSettlementBarrier('undo', async () => {
        return this.executeUndo(request, expectedRevisionBeforeBarrier);
      });
    } catch (err) {
      const current = this.session.read();
      const resp: ProjectHistoryFailedResponse = {
        status: 'failed',
        operationId: request.operationId,
        documentId: current.documentId ?? request.documentId,
        error: err instanceof Error ? err.message : String(err),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }
  }

  private async executeUndo(
    request: ProjectHistoryUndoRequest,
    expectedRevisionBeforeBarrier: number,
  ): Promise<ProjectHistoryResponse> {
    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Document ID mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (
      current.revision === expectedRevisionBeforeBarrier &&
      request.expectedRevision !== current.revision
    ) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Revision mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (this.cursor <= 0) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Target entry is at cursor - 1
    const entry = this.entries[this.cursor - 1]!;
    this.cursor--;

    if (this.reconciliation && entry.gestureId) {
      await this.reconciliation.drainPreviews(entry.gestureId);
    }

    if (entry.record.kind === 'values') {
      rollbackScalarRecords(current.data, entry.record.records);
      this.session.recordMutation({ changed: true, stateId: entry.beforeStateId });
    } else {
      restoreStructuralMemento(this.session, entry.record.beforeMemento, {
        stateId: entry.beforeStateId,
      });
    }

    const updatedSnap = this.session.read();
    const projection = this.read();

    const inversePatches =
      entry.inversePatches ??
      (entry.record.kind === 'values'
        ? scalarRecordsToInversePatches(entry.record.records)
        : [{ orchestra: { type: 'structuralChange' } as never }]);

    const runtimeOutcomes = this.reconciliation
      ? await this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: inversePatches,
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: null,
      selectionHints: request.origin?.selection,
      originViewId: request.origin?.viewId,
      runtimeOutcomes,
    };
    await this.publishUpdated?.(updatedEvent);

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      changedTargets: [...(entry.changedTargets ?? [])],
      runtimeOutcomes,
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }

  async redo(request: ProjectHistoryRedoRequest): Promise<ProjectHistoryResponse> {
    if (this.receiptCache.has(request.operationId)) {
      return this.receiptCache.get(request.operationId)!;
    }

    const initial = this.session.read();
    if (!initial.data || !initial.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document in session',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== initial.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: initial.revision,
        currentStateId: initial.stateId ?? '',
        reason: `Document ID mismatch (expected ${request.documentId}, current ${initial.documentId})`,
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    const expectedRevisionBeforeBarrier = initial.revision;

    try {
      return await this.runSettlementBarrier('redo', async () => {
        return this.executeRedo(request, expectedRevisionBeforeBarrier);
      });
    } catch (err) {
      const current = this.session.read();
      const resp: ProjectHistoryFailedResponse = {
        status: 'failed',
        operationId: request.operationId,
        documentId: current.documentId ?? request.documentId,
        error: err instanceof Error ? err.message : String(err),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }
  }

  private async executeRedo(
    request: ProjectHistoryRedoRequest,
    expectedRevisionBeforeBarrier: number,
  ): Promise<ProjectHistoryResponse> {
    const current = this.session.read();

    if (!current.data || !current.documentId) {
      const resp: ProjectHistoryInvalidResponse = {
        status: 'invalid',
        operationId: request.operationId,
        documentId: request.documentId,
        reason: 'No active project document',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (request.documentId !== current.documentId) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Document ID mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (
      current.revision === expectedRevisionBeforeBarrier &&
      request.expectedRevision !== current.revision
    ) {
      const resp: ProjectHistoryStaleResponse = {
        status: 'stale',
        operationId: request.operationId,
        documentId: request.documentId,
        currentRevision: current.revision,
        currentStateId: current.stateId ?? '',
        reason: 'Revision mismatch',
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    if (this.cursor >= this.entries.length) {
      const resp: ProjectHistoryUnchangedResponse = {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: current.documentId,
        revision: current.revision,
        stateId: current.stateId ?? '',
        isDirty: this.isDirty(),
        history: this.read(),
      };
      this.cacheReceipt(request.operationId, resp);
      return resp;
    }

    // Target entry is at cursor
    const entry = this.entries[this.cursor]!;
    this.cursor++;

    if (this.reconciliation && entry.gestureId) {
      await this.reconciliation.drainPreviews(entry.gestureId);
    }

    if (entry.record.kind === 'values') {
      for (const rec of entry.record.records) {
        applyScalarFieldRecord(current.data, rec, 'forward');
      }
      this.session.recordMutation({ changed: true, stateId: entry.afterStateId });
    } else {
      restoreStructuralMemento(this.session, entry.record.afterMemento, {
        stateId: entry.afterStateId,
      });
    }

    const updatedSnap = this.session.read();
    const projection = this.read();

    const forwardPatches =
      entry.forwardPatches ??
      (entry.record.kind === 'values'
        ? scalarRecordsToForwardPatches(entry.record.records)
        : [{ orchestra: { type: 'structuralChange' } as never }]);

    const runtimeOutcomes = this.reconciliation
      ? await this.reconciliation.reconcileCommit({
          documentId: updatedSnap.documentId!,
          revision: updatedSnap.revision,
          patches: forwardPatches,
        })
      : undefined;

    const updatedEvent: ProjectDocumentUpdatedEvent = {
      documentId: updatedSnap.documentId!,
      sessionId: updatedSnap.sessionId,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      acceptedOperationIds: [request.operationId],
      sourceSequence: request.contextSequence,
      snapshot: null,
      selectionHints: request.origin?.selection,
      originViewId: request.origin?.viewId,
      runtimeOutcomes,
    };
    await this.publishUpdated?.(updatedEvent);

    const resp: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: updatedSnap.documentId!,
      revision: updatedSnap.revision,
      stateId: updatedSnap.stateId!,
      isDirty: this.isDirty(),
      history: projection,
      changedTargets: [...(entry.changedTargets ?? [])],
      runtimeOutcomes,
    };
    this.cacheReceipt(request.operationId, resp);
    return resp;
  }
}

export function createProjectHistory(dependencies: ProjectHistoryDependencies): ProjectHistory {
  return new ProjectHistory(dependencies);
}
