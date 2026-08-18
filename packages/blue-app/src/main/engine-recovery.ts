import { randomUUID } from 'crypto';
import {
  ENGINE_RECOVERY_STATUS_CHANNEL,
  type EngineRecoveryAction,
  type EngineRecoveryFailureCategory,
  type EngineRecoverySessionKind,
  type EngineRecoveryStatus,
} from '../shared/engine-recovery';
import { broadcastToWorkbenchWindows } from './workbench-window-host';

export interface RecoveryExecutionResult<T> {
  ok: boolean;
  result?: T;
  failureCategory?: EngineRecoveryFailureCategory;
  errorMessage?: string;
  diagnostics?: string;
}

export class EngineRecoveryError extends Error {
  constructor(
    message: string,
    readonly failureCategory: EngineRecoveryFailureCategory,
  ) {
    super(message);
    this.name = 'EngineRecoveryError';
  }
}

export function classifyEngineFailure(
  error: unknown,
  stderr = '',
): EngineRecoveryFailureCategory {
  if (error instanceof EngineRecoveryError) {
    return error.failureCategory;
  }

  const text = (
    (error instanceof Error ? error.message : String(error)) +
    ' ' +
    stderr
  ).toLowerCase();

  if (
    text.includes('csound is not available') ||
    text.includes('csound 7 was not found') ||
    text.includes('csound_unavailable')
  ) {
    return 'runtime-unavailable';
  }

  if (
    text.includes('blue-engine not found') ||
    text.includes('blue engine is not available') ||
    text.includes('enoent')
  ) {
    return 'engine-unavailable';
  }

  if (
    text.includes('eaddrinuse') ||
    text.includes('address already in use') ||
    text.includes('address-contention') ||
    text.includes('zmq_bind') ||
    text.includes('bind error') ||
    text.includes('no isolated tcp endpoint pair available') ||
    text.includes('exhausted available tcp endpoint pairs')
  ) {
    return 'address-contention';
  }

  if (
    text.includes('timeout') ||
    text.includes('readiness-timeout') ||
    text.includes('timed out waiting for engine')
  ) {
    return 'readiness-timeout';
  }

  if (
    text.includes('session-unresponsive') ||
    text.includes('unresponsive') ||
    text.includes('econnrefused')
  ) {
    return 'session-unresponsive';
  }

  if (
    text.includes('cleanup-failed') ||
    text.includes('failed to kill') ||
    text.includes('zombie')
  ) {
    return 'cleanup-failed';
  }

  return 'unexpected';
}

export function isRecoverableFailure(category: EngineRecoveryFailureCategory): boolean {
  return (
    category === 'address-contention' ||
    category === 'readiness-timeout' ||
    category === 'session-unresponsive'
  );
}

/**
 * Filter and sanitize engine diagnostic text to ensure user privacy and focus.
 * Excludes project XML/CSD text, environment variable dumps, and personal user home paths.
 */
export function sanitizeEngineDiagnostics(raw: string): string {
  if (!raw || !raw.trim()) {
    return 'No diagnostic output captured.';
  }

  const lines = raw.split('\n');
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    // Exclude XML / CSD tag contents
    if (/<[a-zA-Z0-9_\-]+>|<\/[a-zA-Z0-9_\-]+>/.test(line)) {
      continue;
    }

    // Exclude environment variable dumps
    if (/^[A-Z0-9_]+=.+$/.test(line.trim())) {
      continue;
    }

    // Sanitize user home directories in paths: /Users/username/... or C:\Users\username\...
    let sanitized = line
      .replace(/\/Users\/[^/\\]+/g, '/Users/[user]')
      .replace(/\/home\/[^/\\]+/g, '/home/[user]')
      .replace(/C:\\Users\\[^\\]+/gi, 'C:\\Users\\[user]');

    sanitizedLines.push(sanitized);
  }

  const result = sanitizedLines.join('\n').trim();
  return result || 'No diagnostic output captured.';
}

export class EngineRecoveryCoordinator {
  private activeOperations = new Map<EngineRecoverySessionKind, string>();
  private emitStatusCallback: (status: EngineRecoveryStatus) => void;

  constructor(emitStatus?: (status: EngineRecoveryStatus) => void) {
    this.emitStatusCallback =
      emitStatus ??
      ((status) => {
        broadcastToWorkbenchWindows(ENGINE_RECOVERY_STATUS_CHANNEL, status);
      });
  }

  isSessionRecovering(sessionKind: EngineRecoverySessionKind): boolean {
    return this.activeOperations.has(sessionKind);
  }

  async runWithRecovery<T>(
    sessionKind: EngineRecoverySessionKind,
    operation: () => Promise<T>,
    cleanup: () => Promise<void>,
    getStderr?: () => string,
  ): Promise<RecoveryExecutionResult<T>> {
    if (this.activeOperations.has(sessionKind)) {
      return {
        ok: false,
        failureCategory: 'unexpected',
        errorMessage: 'A recovery operation is already in progress for this session.',
      };
    }

    const operationId = randomUUID();
    this.activeOperations.set(sessionKind, operationId);

    try {
      // Attempt 1: Run the initial operation.
      try {
        const result = await operation();
        return { ok: true, result };
      } catch (initialError: unknown) {
        const stderr = getStderr?.() ?? '';
        const category = classifyEngineFailure(initialError, stderr);
        const initialErrorMessage =
          initialError instanceof Error ? initialError.message : String(initialError);

        if (!isRecoverableFailure(category)) {
          this.emitStatusCallback({
            operationId,
            sessionKind,
            phase: 'failed',
            attempt: 1,
            message: `Audio engine failed: ${initialErrorMessage}`,
            failureCategory: category,
          });
          return {
            ok: false,
            failureCategory: category,
            errorMessage: initialErrorMessage,
            diagnostics: sanitizeEngineDiagnostics(stderr || initialErrorMessage),
          };
        }

        this.emitStatusCallback({
          operationId,
          sessionKind,
          phase: 'recovering',
          attempt: 1,
          message: 'Recovering audio engine...',
          failureCategory: category,
        });

        try {
          // Step 1: Clean up current-owner engine resources.
          await cleanup();

          // Step 2: Retry the operation.
          const retryResult = await operation();

          this.emitStatusCallback({
            operationId,
            sessionKind,
            phase: 'recovered',
            attempt: 1,
            message: 'Audio engine recovered',
          });

          return { ok: true, result: retryResult };
        } catch (retryError: unknown) {
          const retryStderr = getStderr?.() ?? '';
          const retryCategory = classifyEngineFailure(retryError, retryStderr);
          const retryErrorMessage =
            retryError instanceof Error ? retryError.message : String(retryError);

          this.emitStatusCallback({
            operationId,
            sessionKind,
            phase: 'failed',
            attempt: 1,
            message: `Audio engine recovery failed: ${retryErrorMessage}`,
            failureCategory: retryCategory,
          });

          return {
            ok: false,
            failureCategory: retryCategory,
            errorMessage: retryErrorMessage,
            diagnostics: sanitizeEngineDiagnostics(retryStderr || retryErrorMessage),
          };
        }
      }
    } finally {
      if (this.activeOperations.get(sessionKind) === operationId) {
        this.activeOperations.delete(sessionKind);
      }
    }
  }
}
