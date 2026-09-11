import type { ProjectDocumentCommitReceipt, ProjectDocumentPatch } from './project-editor/contract';

export const PROJECT_HISTORY_COMMIT_CHANNEL = 'project-history:commit';
export const PROJECT_HISTORY_UNDO_CHANNEL = 'project-history:undo';
export const PROJECT_HISTORY_REDO_CHANNEL = 'project-history:redo';
export const PROJECT_HISTORY_READ_CHANNEL = 'project-history:read';
export const PROJECT_HISTORY_ENTRIES_CHANNEL = 'project-history:entries';
export const PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL = 'project-history:participant:register';
export const PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL =
  'project-history:participant:unregister';
export const PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL = 'project-history:boundary:prepare';
export const PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL = 'project-history:boundary:ack';
export const PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL = 'project-history:boundary:release';
export const PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL = 'project-history:oversize:cancel';
export const PROJECT_HISTORY_AVAILABILITY_CHANNEL = 'project-history:availability';
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

/**
 * Metadata carried by independent editor windows when they submit a project
 * patch through a domain-specific IPC route. The main process turns it into
 * the canonical history origin and revision fence.
 */
export interface ProjectHistoryContext {
  contextId: string;
  contextSequence: number;
  expectedRevision?: number;
  operationId?: string;
  label?: string;
  gestureId?: string;
  fieldId?: string;
  phase?: ProjectHistoryActionPhase;
  viewId?: string;
  selection?: ProjectHistorySelectionHint[];
  /** The settlement barrier whose captured prefix owns this submission. */
  barrierId?: string;
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
  /** Monotonic sequence assigned by the originating renderer context. */
  contextSequence?: number;
  origin?: ProjectHistoryOrigin;
  /** Tags the batch as a settlement-barrier prefix drain. */
  barrierId?: string;
  proposalToken?: string;
  /** Optional revision fence for callers that prepared a patch against a known base. */
  expectedRevision?: number;
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
  /** Current canonical document revision used by independent renderer contexts. */
  revision?: number;
  limitBytes?: number;
  maxEntries?: number;
  retentionStatus?: 'empty' | 'within-limit' | 'at-entry-limit' | 'at-byte-limit';
}

export type FocusedHistoryScope = 'project' | 'draft' | 'none';

/** Renderer-owned, focused-scope projection used to build the native menu. */
export interface FocusedHistoryAvailability {
  scope: FocusedHistoryScope;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
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

export type ProjectHistoryReadResponse =
  | ProjectHistoryStateProjection
  | ProjectHistoryInvalidResponse;

/**
 * Renderer-facing summary of one committed history entry for read-only
 * history views (spec 106). Deliberately excludes `record` mementos,
 * patches, and origin metadata so the panel IPC payload stays lightweight.
 */
export interface ProjectHistoryEntrySummary {
  readonly entryId: string;
  readonly label: string;
  readonly timestamp: number;
  readonly afterStateId: string;
}

export interface ProjectHistoryEntriesSnapshot {
  readonly documentId: string;
  readonly revision: number;
  readonly cursor: number;
  /** Oldest-first, identical to ProjectHistory.getEntries() order. */
  readonly entries: readonly ProjectHistoryEntrySummary[];
}

export type ProjectHistoryEntriesResponse =
  | ProjectHistoryEntriesSnapshot
  | ProjectHistoryInvalidResponse;

export interface ProjectHistoryControlResponse {
  ok: boolean;
  reason?: string;
}

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
  /** Prefix submissions that rejected or otherwise failed to settle. */
  failedPrefixCount?: number;
  /** Prefix submissions still unresolved after the drain attempt. */
  unresolvedPrefixCount?: number;
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
  originContextId?: string;
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

export function isProjectDocumentUpdatedEvent<TSnapshot = unknown>(
  value: unknown,
): value is ProjectDocumentUpdatedEvent<TSnapshot> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const hasSnapshot = Object.prototype.hasOwnProperty.call(candidate, 'snapshot');
  return (
    isNonEmptyString(candidate.documentId) &&
    isSafeNonNegativeInteger(candidate.sessionId) &&
    isSafeNonNegativeInteger(candidate.revision) &&
    typeof candidate.stateId === 'string' &&
    typeof candidate.isDirty === 'boolean' &&
    isProjectHistoryStateProjection(candidate.history) &&
    Array.isArray(candidate.acceptedOperationIds) &&
    candidate.acceptedOperationIds.every((operationId) => isNonEmptyString(operationId)) &&
    hasSnapshot &&
    candidate.snapshot !== undefined &&
    (candidate.sourceSequence === undefined ||
      isSafeNonNegativeInteger(candidate.sourceSequence)) &&
    (candidate.originContextId === undefined || isNonEmptyString(candidate.originContextId)) &&
    validateOrigin({
      selection: candidate.selectionHints,
      viewId: candidate.originViewId,
    }) &&
    (candidate.runtimeOutcomes === undefined ||
      (Array.isArray(candidate.runtimeOutcomes) &&
        candidate.runtimeOutcomes.every(isProjectRuntimeOutcome)))
  );
}

export interface RegisterHistoryParticipantRequest {
  contextId: string;
  documentId: string;
  acceptedRevision: number;
}

export interface RegisterHistoryParticipantResponse {
  ok: boolean;
  reason?: string;
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
  /** Clears the last outcome for one stopped/recompiled performance. */
  clearPerformanceKind?: ProjectRuntimeOutcome['performanceKind'];
}

export type ProjectHistoryValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; reason: string };

export interface ProjectDocumentPatchBatchRequest {
  patches: ProjectDocumentPatch[];
  options?: ProjectDocumentCommitMetadata;
}

const HISTORY_ACTION_PHASES = new Set<ProjectHistoryActionPhase>([
  'single',
  'begin',
  'update',
  'end',
  'cancel',
]);

const HISTORY_TARGET_TYPES = new Set<ProjectHistoryTargetType>([
  'scoreObject',
  'layer',
  'mixerChannel',
  'instrument',
  'parameter',
  'property',
  'text',
  'tables',
  'scratchPad',
  'udo',
  'midi',
  'transport',
]);

const HISTORY_SELECTION_TARGET_TYPES = new Set<ProjectHistorySelectionTargetType>([
  'scoreObject',
  'layer',
  'mixerChannel',
  'instrument',
  'text',
  'parameter',
]);

const HISTORY_RETENTION_STATUSES = new Set<
  NonNullable<ProjectHistoryStateProjection['retentionStatus']>
>(['empty', 'within-limit', 'at-entry-limit', 'at-byte-limit']);

const RUNTIME_OUTCOME_STATUSES = new Set<ProjectRuntimeOutcomeStatus>([
  'pending',
  'applied',
  'restart-required',
  'failed',
]);

const PROJECT_HISTORY_PATCH_KEYS = new Set([
  'globalOrc',
  'globalSco',
  'tablesText',
  'scratchPad',
  'projectProperties',
  'clojureProject',
  'transport',
  'projectUdo',
  'midiInput',
  'blueLive',
  'mixer',
  'orchestra',
  'score',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for plain data records only; class instances (Date, Map, …) fail. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Patch-contract value policy for the structured-clone IPC transport (T120).
 *
 * History requests and patch batches cross the renderer/main boundary via
 * structured clone, which preserves property keys whose value is explicitly
 * `undefined` (unlike JSON.stringify, which drops them). Patch builders
 * legitimately spell out optional fields as `undefined` — for example
 * MixerPanel's `{ type: 'addSubChannel', name: undefined }` meaning
 * "auto-generate the name" — and every patch applier interprets
 * `field === undefined` as "not provided".
 *
 * Therefore:
 * - Explicit `undefined` property values, at any depth, are VALID and are
 *   treated as absent optional fields.
 * - Values the structured clone cannot carry or that no patch applier can
 *   interpret — functions, symbols, BigInts, class instances such as Date —
 *   are REJECTED up front with an explicit validation failure instead of
 *   being silently dropped or thrown across IPC.
 */
function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (value === undefined || value === null || typeof value === 'string') return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  return isPlainRecord(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function validateOrigin(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !['contextId', 'viewId', 'selection'].includes(key))) {
    return false;
  }
  if (value.contextId !== undefined && !isNonEmptyString(value.contextId)) return false;
  if (value.viewId !== undefined && !isNonEmptyString(value.viewId)) return false;
  if (value.selection !== undefined) {
    if (!Array.isArray(value.selection)) return false;
    for (const hint of value.selection) {
      if (!isRecord(hint) || !HISTORY_SELECTION_TARGET_TYPES.has(hint.targetType as never)) {
        return false;
      }
      if (!hasOnlyKeys(hint, ['targetType', 'targetId', 'range', 'subId'])) return false;
      if (!isNonEmptyString(hint.targetId)) return false;
      if (
        hint.range !== undefined &&
        (!Array.isArray(hint.range) ||
          hint.range.length !== 2 ||
          !hint.range.every((rangeValue) => Number.isSafeInteger(rangeValue) && rangeValue >= 0))
      ) {
        return false;
      }
      if (hint.subId !== undefined && !isNonEmptyString(hint.subId)) return false;
    }
  }
  return true;
}

export function isProjectHistoryStateProjection(
  value: unknown,
): value is ProjectHistoryStateProjection {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      'canUndo',
      'canRedo',
      'undoLabel',
      'redoLabel',
      'cursor',
      'length',
      'retainedBytes',
      'savedStateId',
      'stateId',
      'revision',
      'limitBytes',
      'maxEntries',
      'retentionStatus',
    ])
  ) {
    return false;
  }
  return (
    typeof value.canUndo === 'boolean' &&
    typeof value.canRedo === 'boolean' &&
    (value.undoLabel === null || typeof value.undoLabel === 'string') &&
    (value.redoLabel === null || typeof value.redoLabel === 'string') &&
    isSafeNonNegativeInteger(value.cursor) &&
    isSafeNonNegativeInteger(value.length) &&
    value.cursor <= value.length &&
    isSafeNonNegativeInteger(value.retainedBytes) &&
    (value.savedStateId === null || typeof value.savedStateId === 'string') &&
    typeof value.stateId === 'string' &&
    (value.revision === undefined || isSafeNonNegativeInteger(value.revision)) &&
    (value.limitBytes === undefined || isSafeNonNegativeInteger(value.limitBytes)) &&
    (value.maxEntries === undefined || isSafeNonNegativeInteger(value.maxEntries)) &&
    (value.retentionStatus === undefined ||
      HISTORY_RETENTION_STATUSES.has(value.retentionStatus as never))
  );
}

export function isProjectRuntimeOutcome(value: unknown): value is ProjectRuntimeOutcome {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'performanceKind',
      'generation',
      'desiredRevision',
      'appliedRevision',
      'status',
      'message',
      'affectedOwnerIds',
    ])
  ) {
    return false;
  }
  return (
    (value.performanceKind === 'timeline' || value.performanceKind === 'blueLive') &&
    isSafeNonNegativeInteger(value.generation) &&
    isSafeNonNegativeInteger(value.desiredRevision) &&
    (value.appliedRevision === undefined || isSafeNonNegativeInteger(value.appliedRevision)) &&
    RUNTIME_OUTCOME_STATUSES.has(value.status as ProjectRuntimeOutcomeStatus) &&
    (value.message === undefined || isNonEmptyString(value.message, 2000)) &&
    (value.affectedOwnerIds === undefined ||
      (Array.isArray(value.affectedOwnerIds) &&
        value.affectedOwnerIds.every((ownerId) => isNonEmptyString(ownerId))))
  );
}

export function isProjectHistoryContext(value: unknown): value is ProjectHistoryContext {
  if (!isRecord(value)) return false;
  if (
    Object.keys(value).some(
      (key) =>
        ![
          'contextId',
          'contextSequence',
          'expectedRevision',
          'operationId',
          'label',
          'gestureId',
          'fieldId',
          'phase',
          'viewId',
          'selection',
          'barrierId',
        ].includes(key),
    )
  ) {
    return false;
  }
  if (
    !isNonEmptyString(value.contextId) ||
    !isSafeNonNegativeInteger(value.contextSequence) ||
    (value.expectedRevision !== undefined && !isSafeNonNegativeInteger(value.expectedRevision)) ||
    (value.operationId !== undefined && !isNonEmptyString(value.operationId)) ||
    (value.label !== undefined && !isNonEmptyString(value.label, 1000)) ||
    (value.gestureId !== undefined && !isNonEmptyString(value.gestureId)) ||
    (value.fieldId !== undefined && !isNonEmptyString(value.fieldId)) ||
    (value.phase !== undefined && !HISTORY_ACTION_PHASES.has(value.phase as never)) ||
    (value.barrierId !== undefined && !isNonEmptyString(value.barrierId))
  ) {
    return false;
  }
  return validateOrigin({
    contextId: value.contextId,
    viewId: value.viewId,
    selection: value.selection,
  });
}

function validatePatch(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  if (Object.keys(value).some((key) => !PROJECT_HISTORY_PATCH_KEYS.has(key))) return false;
  return Object.values(value).every((member) => isJsonValue(member));
}

function validatePreconditions(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!isRecord(item) || !HISTORY_TARGET_TYPES.has(item.targetType as never)) return false;
    if (
      !hasOnlyKeys(item, ['targetType', 'targetId', 'field', 'expectedValue', 'expectedIdentity'])
    ) {
      return false;
    }
    if (
      !isNonEmptyString(item.targetId) ||
      (item.field !== undefined && !isNonEmptyString(item.field))
    ) {
      return false;
    }
    if (item.expectedIdentity !== undefined && !isNonEmptyString(item.expectedIdentity)) {
      return false;
    }
    return item.expectedValue === undefined || isJsonValue(item.expectedValue);
  });
}

function validateCommitMetadata(value: unknown): boolean {
  if (value === undefined) return true;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'label',
      'gestureId',
      'fieldId',
      'phase',
      'operationId',
      'contextSequence',
      'origin',
      'barrierId',
      'proposalToken',
      'expectedRevision',
    ])
  ) {
    return false;
  }
  return (
    (value.label === undefined || isNonEmptyString(value.label, 1000)) &&
    (value.gestureId === undefined || isNonEmptyString(value.gestureId)) &&
    (value.fieldId === undefined || isNonEmptyString(value.fieldId)) &&
    (value.phase === undefined || HISTORY_ACTION_PHASES.has(value.phase as never)) &&
    (value.operationId === undefined || isNonEmptyString(value.operationId)) &&
    (value.contextSequence === undefined || isSafeNonNegativeInteger(value.contextSequence)) &&
    validateOrigin(value.origin) &&
    (value.barrierId === undefined || isNonEmptyString(value.barrierId)) &&
    (value.proposalToken === undefined || isNonEmptyString(value.proposalToken)) &&
    (value.expectedRevision === undefined || isSafeNonNegativeInteger(value.expectedRevision))
  );
}

function valid<T>(value: T): ProjectHistoryValidationResult<T> {
  return { valid: true, value };
}

function invalid(reason: string): ProjectHistoryValidationResult<never> {
  return { valid: false, reason };
}

export function validateProjectDocumentPatchBatchRequest(
  patches: unknown,
  options?: unknown,
): ProjectHistoryValidationResult<ProjectDocumentPatchBatchRequest> {
  if (!Array.isArray(patches) || patches.length === 0 || !patches.every(validatePatch)) {
    return invalid('Project document patch batch is invalid');
  }
  if (!validateCommitMetadata(options)) {
    return invalid('Project document commit metadata is invalid');
  }
  return valid({
    patches: patches as ProjectDocumentPatch[],
    options: options as ProjectDocumentCommitMetadata | undefined,
  });
}

function validateCommonActionRequest(
  value: unknown,
  additionalKeys: readonly string[] = [],
): { request: Record<string, unknown> } | { reason: string } {
  if (!isRecord(value)) return { reason: 'History request must be an object' };
  if (
    !hasOnlyKeys(value, [
      'documentId',
      'operationId',
      'expectedRevision',
      'contextSequence',
      'origin',
      ...additionalKeys,
    ])
  ) {
    return { reason: 'History request contains unexpected fields' };
  }
  for (const key of ['documentId', 'operationId']) {
    if (!isNonEmptyString(value[key])) return { reason: `History request requires ${key}` };
  }
  if (!isSafeNonNegativeInteger(value.expectedRevision)) {
    return { reason: 'History request expectedRevision must be a non-negative safe integer' };
  }
  if (!isSafeNonNegativeInteger(value.contextSequence)) {
    return { reason: 'History request contextSequence must be a non-negative safe integer' };
  }
  if (!validateOrigin(value.origin)) return { reason: 'History request origin is invalid' };
  return { request: value };
}

export function validateProjectHistoryCommitRequest(
  value: unknown,
): ProjectHistoryValidationResult<ProjectHistoryCommitRequest> {
  const common = validateCommonActionRequest(value, [
    'label',
    'gestureId',
    'fieldId',
    'phase',
    'patches',
    'preconditions',
    'proposalToken',
    'barrierId',
  ]);
  if ('reason' in common) return invalid(common.reason);
  const request = common.request;
  if (!isNonEmptyString(request.label, 1000)) return invalid('History commit label is invalid');
  if (request.gestureId !== undefined && !isNonEmptyString(request.gestureId)) {
    return invalid('History commit gestureId is invalid');
  }
  if (request.fieldId !== undefined && !isNonEmptyString(request.fieldId)) {
    return invalid('History commit fieldId is invalid');
  }
  if (request.phase !== undefined && !HISTORY_ACTION_PHASES.has(request.phase as never)) {
    return invalid('History commit phase is invalid');
  }
  if (
    request.patches !== undefined &&
    (!Array.isArray(request.patches) || !request.patches.every(validatePatch))
  ) {
    return invalid('History commit patches are invalid');
  }
  if (!validatePreconditions(request.preconditions)) {
    return invalid('History commit preconditions are invalid');
  }
  for (const key of ['proposalToken', 'barrierId'] as const) {
    if (request[key] !== undefined && !isNonEmptyString(request[key])) {
      return invalid(`History commit ${key} is invalid`);
    }
  }
  return valid(value as ProjectHistoryCommitRequest);
}

export function validateProjectHistoryUndoRequest(
  value: unknown,
): ProjectHistoryValidationResult<ProjectHistoryUndoRequest> {
  const common = validateCommonActionRequest(value);
  return 'reason' in common ? invalid(common.reason) : valid(value as ProjectHistoryUndoRequest);
}

export function validateProjectHistoryRedoRequest(
  value: unknown,
): ProjectHistoryValidationResult<ProjectHistoryRedoRequest> {
  const common = validateCommonActionRequest(value);
  return 'reason' in common ? invalid(common.reason) : valid(value as ProjectHistoryRedoRequest);
}

export function validateProjectHistoryReadRequest(
  value: unknown,
): ProjectHistoryValidationResult<ProjectHistoryReadRequest | undefined> {
  if (value === undefined) return valid(undefined);
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['documentId']) ||
    !isNonEmptyString(value.documentId)
  ) {
    return invalid('History read request documentId is invalid');
  }
  return valid(value as unknown as ProjectHistoryReadRequest);
}

export function validateRegisterHistoryParticipantRequest(
  value: unknown,
): ProjectHistoryValidationResult<RegisterHistoryParticipantRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['contextId', 'documentId', 'acceptedRevision']) ||
    !isNonEmptyString(value.contextId) ||
    !isNonEmptyString(value.documentId) ||
    !isSafeNonNegativeInteger(value.acceptedRevision)
  ) {
    return invalid('History participant registration is invalid');
  }
  return valid(value as unknown as RegisterHistoryParticipantRequest);
}

export function validateUnregisterHistoryParticipantRequest(
  value: unknown,
): ProjectHistoryValidationResult<UnregisterHistoryParticipantRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['contextId']) ||
    !isNonEmptyString(value.contextId)
  ) {
    return invalid('History participant unregister request is invalid');
  }
  return valid(value as unknown as UnregisterHistoryParticipantRequest);
}

export function validatePrepareHistoryBoundaryAck(
  value: unknown,
): ProjectHistoryValidationResult<PrepareHistoryBoundaryAck> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'barrierId',
      'contextId',
      'lastAcknowledgedRevision',
      'lastAcknowledgedSequence',
      'outstandingPrefixCount',
      'failedPrefixCount',
      'unresolvedPrefixCount',
    ]) ||
    !isNonEmptyString(value.barrierId) ||
    !isNonEmptyString(value.contextId) ||
    !isSafeNonNegativeInteger(value.lastAcknowledgedRevision) ||
    !isSafeNonNegativeInteger(value.lastAcknowledgedSequence) ||
    !isSafeNonNegativeInteger(value.outstandingPrefixCount) ||
    (value.failedPrefixCount !== undefined && !isSafeNonNegativeInteger(value.failedPrefixCount)) ||
    (value.unresolvedPrefixCount !== undefined &&
      !isSafeNonNegativeInteger(value.unresolvedPrefixCount))
  ) {
    return invalid('History boundary acknowledgement is invalid');
  }
  return valid(value as unknown as PrepareHistoryBoundaryAck);
}

export function validateCancelOversizeProposalRequest(
  value: unknown,
): ProjectHistoryValidationResult<CancelOversizeProposalRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['proposalToken']) ||
    !isNonEmptyString(value.proposalToken)
  ) {
    return invalid('History oversize cancellation request is invalid');
  }
  return valid(value as unknown as CancelOversizeProposalRequest);
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
    hasOnlyKeys(candidate, ['documentId', 'revision', 'outcomes', 'clearPerformanceKind']) &&
    isNonEmptyString(candidate.documentId) &&
    isSafeNonNegativeInteger(candidate.revision) &&
    Array.isArray(candidate.outcomes) &&
    candidate.outcomes.every(isProjectRuntimeOutcome) &&
    (candidate.clearPerformanceKind === undefined ||
      candidate.clearPerformanceKind === 'timeline' ||
      candidate.clearPerformanceKind === 'blueLive')
  );
}

export function isFocusedHistoryAvailability(value: unknown): value is FocusedHistoryAvailability {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, ['scope', 'canUndo', 'canRedo', 'undoLabel', 'redoLabel']) &&
    (value.scope === 'project' || value.scope === 'draft' || value.scope === 'none') &&
    typeof value.canUndo === 'boolean' &&
    typeof value.canRedo === 'boolean' &&
    (value.undoLabel === null || isNonEmptyString(value.undoLabel, 1000)) &&
    (value.redoLabel === null || isNonEmptyString(value.redoLabel, 1000))
  );
}
