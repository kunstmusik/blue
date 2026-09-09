import type { ProjectDocumentCommitReceipt, ProjectDocumentPatch } from './project-editor/contract';

export const PROJECT_HISTORY_COMMIT_CHANNEL = 'project-history:commit';
export const PROJECT_HISTORY_UNDO_CHANNEL = 'project-history:undo';
export const PROJECT_HISTORY_REDO_CHANNEL = 'project-history:redo';
export const PROJECT_HISTORY_READ_CHANNEL = 'project-history:read';
export const PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL = 'project-history:participant:register';
export const PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL =
  'project-history:participant:unregister';
export const PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL = 'project-history:boundary:prepare';
export const PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL = 'project-history:boundary:ack';
export const PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL = 'project-history:boundary:release';
export const PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL = 'project-history:oversize:cancel';
export const PROJECT_DOCUMENT_UPDATED_CHANNEL = 'project-document-updated';
export const PROJECT_RUNTIME_OUTCOME_CHANNEL = 'project-runtime:outcome';

export type ProjectHistoryActionPhase = 'single' | 'begin' | 'update' | 'end' | 'cancel';

export type ProjectHistoryTargetType =
  | 'scoreObject'
  | 'layer'
  | 'mixerChannel'
  | 'instrument'
  | 'parameter'
  | 'property'
  | 'text'
  | 'tables'
  | 'scratchPad'
  | 'udo'
  | 'midi'
  | 'transport';

export interface ProjectHistoryPrecondition {
  targetType: ProjectHistoryTargetType;
  targetId: string;
  field?: string;
  expectedValue?: unknown;
  expectedIdentity?: string;
}

export type ProjectHistorySelectionTargetType =
  | 'scoreObject'
  | 'layer'
  | 'mixerChannel'
  | 'instrument'
  | 'text'
  | 'parameter';

export interface ProjectHistorySelectionHint {
  targetType: ProjectHistorySelectionTargetType;
  targetId: string;
  range?: [number, number];
  subId?: string;
}

export interface ProjectHistoryOrigin {
  contextId?: string;
  viewId?: string;
  selection?: ProjectHistorySelectionHint[];
}

export interface ProjectHistoryCommitRequest {
  documentId: string;
  operationId: string;
  expectedRevision: number;
  contextSequence: number;
  label: string;
  gestureId?: string;
  fieldId?: string;
  phase?: ProjectHistoryActionPhase;
  patches?: ProjectDocumentPatch[];
  preconditions?: ProjectHistoryPrecondition[];
  origin?: ProjectHistoryOrigin;
  proposalToken?: string;
  barrierId?: string;
}

export interface ProjectHistoryUndoRequest {
  documentId: string;
  operationId: string;
  expectedRevision: number;
  contextSequence: number;
  origin?: ProjectHistoryOrigin;
}

export interface ProjectHistoryRedoRequest {
  documentId: string;
  operationId: string;
  expectedRevision: number;
  contextSequence: number;
  origin?: ProjectHistoryOrigin;
}

/**
 * Semantic metadata the legacy document-patch commit path forwards into the
 * history coordinator so an entry carries its action label and gesture
 * grouping instead of a generic "Edit Project" label.
 */
export interface ProjectDocumentCommitMetadata {
  label?: string;
  gestureId?: string;
  fieldId?: string;
  phase?: ProjectHistoryActionPhase;
  operationId?: string;
  origin?: ProjectHistoryOrigin;
  /** Tags the batch as a settlement-barrier prefix drain. */
  barrierId?: string;
  proposalToken?: string;
}

export interface ProjectHistoryReadRequest {
  documentId: string;
}

export type ProjectRuntimeOutcomeStatus = 'pending' | 'applied' | 'restart-required' | 'failed';

export interface ProjectRuntimeOutcome {
  performanceKind: 'timeline' | 'blueLive';
  generation: number;
  desiredRevision: number;
  appliedRevision?: number;
  status: ProjectRuntimeOutcomeStatus;
  message?: string;
  affectedOwnerIds?: string[];
}

export interface ProjectHistoryStateProjection {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  cursor: number;
  length: number;
  retainedBytes: number;
  savedStateId: string | null;
  stateId: string;
  limitBytes?: number;
  maxEntries?: number;
}

export type ProjectHistoryResponseStatus =
  | 'committed'
  | 'unchanged'
  | 'stale'
  | 'invalid'
  | 'busy'
  | 'oversize'
  | 'failed';

export interface ProjectHistoryCommittedResponse {
  status: 'committed';
  operationId: string;
  documentId: string;
  revision: number;
  stateId: string;
  isDirty: boolean;
  history: ProjectHistoryStateProjection;
  changedTargets?: string[];
  runtimeOutcomes?: ProjectRuntimeOutcome[];
  receipt?: ProjectDocumentCommitReceipt;
}

export interface ProjectHistoryUnchangedResponse {
  status: 'unchanged';
  operationId: string;
  documentId: string;
  revision: number;
  stateId: string;
  isDirty: boolean;
  history: ProjectHistoryStateProjection;
  receipt?: ProjectDocumentCommitReceipt;
}

export interface ProjectHistoryStaleResponse {
  status: 'stale';
  operationId: string;
  documentId: string;
  currentRevision: number;
  currentStateId: string;
  reason?: string;
}

export interface ProjectHistoryInvalidResponse {
  status: 'invalid';
  operationId: string;
  documentId: string;
  reason: string;
}

export interface ProjectHistoryBusyResponse {
  status: 'busy';
  operationId: string;
  documentId: string;
  reason: string;
}

export interface ProjectHistoryOversizeResponse {
  status: 'oversize';
  operationId: string;
  documentId: string;
  proposalToken: string;
  estimatedBytes: number;
  limitBytes: number;
  explanation: string;
}

export interface ProjectHistoryFailedResponse {
  status: 'failed';
  operationId: string;
  documentId: string;
  error: string;
}

export type ProjectHistoryResponse =
  | ProjectHistoryCommittedResponse
  | ProjectHistoryUnchangedResponse
  | ProjectHistoryStaleResponse
  | ProjectHistoryInvalidResponse
  | ProjectHistoryBusyResponse
  | ProjectHistoryOversizeResponse
  | ProjectHistoryFailedResponse;

export type ProjectHistoryBarrierReason = 'undo' | 'redo' | 'save' | 'replacement' | 'oversize';

export interface PrepareHistoryBoundaryEvent {
  barrierId: string;
  reason: ProjectHistoryBarrierReason;
}

export interface PrepareHistoryBoundaryAck {
  barrierId: string;
  contextId: string;
  lastAcknowledgedRevision: number;
  lastAcknowledgedSequence: number;
  outstandingPrefixCount: number;
}

export interface ReleaseHistoryBoundaryEvent {
  barrierId: string;
  status: 'ready' | 'aborted';
  reason?: string;
}

export interface ProjectDocumentUpdatedEvent<TSnapshot = unknown> {
  documentId: string;
  sessionId: number;
  revision: number;
  stateId: string;
  isDirty: boolean;
  history: ProjectHistoryStateProjection;
  acceptedOperationIds: string[];
  sourceSequence?: number;
  snapshot: TSnapshot;
  selectionHints?: ProjectHistorySelectionHint[];
  originViewId?: string;
  runtimeOutcomes?: ProjectRuntimeOutcome[];
}

export function isProjectHistoryResponse(value: unknown): value is ProjectHistoryResponse {
  if (!value || typeof value !== 'object') return false;
  const status = (value as { status?: unknown }).status;
  return (
    status === 'committed' ||
    status === 'unchanged' ||
    status === 'stale' ||
    status === 'invalid' ||
    status === 'busy' ||
    status === 'oversize' ||
    status === 'failed'
  );
}

export function isProjectDocumentUpdatedEvent(
  value: unknown,
): value is ProjectDocumentUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.documentId === 'string' &&
    typeof candidate.sessionId === 'number' &&
    typeof candidate.revision === 'number' &&
    typeof candidate.stateId === 'string' &&
    typeof candidate.isDirty === 'boolean' &&
    Array.isArray(candidate.acceptedOperationIds)
  );
}

export interface RegisterHistoryParticipantRequest {
  contextId: string;
  documentId: string;
  acceptedRevision: number;
}

export interface RegisterHistoryParticipantResponse {
  ok: boolean;
  activeBarrier?: PrepareHistoryBoundaryEvent;
}

export interface UnregisterHistoryParticipantRequest {
  contextId: string;
}

export interface CancelOversizeProposalRequest {
  proposalToken: string;
}

export interface ProjectRuntimeOutcomeEvent {
  documentId: string;
  revision: number;
  outcomes: ProjectRuntimeOutcome[];
}

export function isPrepareHistoryBoundaryEvent(
  value: unknown,
): value is PrepareHistoryBoundaryEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.barrierId === 'string' && typeof candidate.reason === 'string';
}

export function isReleaseHistoryBoundaryEvent(
  value: unknown,
): value is ReleaseHistoryBoundaryEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.barrierId === 'string' &&
    (candidate.status === 'ready' || candidate.status === 'aborted')
  );
}

export function isProjectRuntimeOutcomeEvent(value: unknown): value is ProjectRuntimeOutcomeEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.documentId === 'string' &&
    typeof candidate.revision === 'number' &&
    Array.isArray(candidate.outcomes)
  );
}
