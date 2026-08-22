export const ENGINE_RECOVERY_STATUS_CHANNEL = 'engine-recovery-status';
export const ENGINE_RECOVERY_ACTION_CHANNEL = 'engine-recovery-action';

export type EngineRecoveryPhase = 'recovering' | 'recovered' | 'failed';

export type EngineRecoverySessionKind = 'realtime' | 'blue-live';

export type EngineRecoveryFailureCategory =
  | 'engine-unavailable'
  | 'runtime-unavailable'
  | 'address-contention'
  | 'readiness-timeout'
  | 'session-unresponsive'
  | 'cleanup-failed'
  | 'unexpected';

export interface EngineRecoveryStatus {
  operationId: string;
  sessionKind: EngineRecoverySessionKind;
  phase: EngineRecoveryPhase;
  attempt: number;
  message: string;
  failureCategory?: EngineRecoveryFailureCategory;
}

export type EngineRecoveryAction = 'restart' | 'diagnostics' | 'cancel';

export interface EngineRecoveryActionRequest {
  operationId: string;
  action: EngineRecoveryAction;
}

const MAX_OPERATION_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 1000;

const VALID_PHASES = new Set<EngineRecoveryPhase>(['recovering', 'recovered', 'failed']);
const VALID_SESSION_KINDS = new Set<EngineRecoverySessionKind>(['realtime', 'blue-live']);
const VALID_FAILURE_CATEGORIES = new Set<EngineRecoveryFailureCategory>([
  'engine-unavailable',
  'runtime-unavailable',
  'address-contention',
  'readiness-timeout',
  'session-unresponsive',
  'cleanup-failed',
  'unexpected',
]);

export function isEngineRecoveryStatus(raw: unknown): raw is EngineRecoveryStatus {
  return decodeEngineRecoveryStatus(raw) !== null;
}

export function decodeEngineRecoveryStatus(raw: unknown): EngineRecoveryStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.operationId !== 'string' || !record.operationId.trim()) {
    return null;
  }
  const operationId = record.operationId.trim();
  if (operationId.length > MAX_OPERATION_ID_LENGTH) {
    return null;
  }

  if (typeof record.sessionKind !== 'string' || !VALID_SESSION_KINDS.has(record.sessionKind as EngineRecoverySessionKind)) {
    return null;
  }
  const sessionKind = record.sessionKind as EngineRecoverySessionKind;

  if (typeof record.phase !== 'string' || !VALID_PHASES.has(record.phase as EngineRecoveryPhase)) {
    return null;
  }
  const phase = record.phase as EngineRecoveryPhase;

  if (typeof record.attempt !== 'number' || !Number.isInteger(record.attempt) || record.attempt < 1) {
    return null;
  }
  const attempt = record.attempt;

  if (typeof record.message !== 'string') {
    return null;
  }
  const message = record.message.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  let failureCategory: EngineRecoveryFailureCategory | undefined;
  if (record.failureCategory !== undefined && record.failureCategory !== null) {
    if (
      typeof record.failureCategory !== 'string' ||
      !VALID_FAILURE_CATEGORIES.has(record.failureCategory as EngineRecoveryFailureCategory)
    ) {
      return null;
    }
    failureCategory = record.failureCategory as EngineRecoveryFailureCategory;
  }

  // Construct a clean display-only object without any process IDs, handles, or injected properties
  const result: EngineRecoveryStatus = {
    operationId,
    sessionKind,
    phase,
    attempt,
    message,
  };

  if (failureCategory) {
    result.failureCategory = failureCategory;
  }

  return result;
}
