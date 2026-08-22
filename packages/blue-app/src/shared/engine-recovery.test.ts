import { describe, it, expect } from 'vitest';
import {
  decodeEngineRecoveryStatus,
  isEngineRecoveryStatus,
  ENGINE_RECOVERY_STATUS_CHANNEL,
  ENGINE_RECOVERY_ACTION_CHANNEL,
  type EngineRecoveryStatus,
} from './engine-recovery';

describe('engine-recovery shared contract', () => {
  it('defines the expected channel constants', () => {
    expect(ENGINE_RECOVERY_STATUS_CHANNEL).toBe('engine-recovery-status');
    expect(ENGINE_RECOVERY_ACTION_CHANNEL).toBe('engine-recovery-action');
  });

  it('decodes valid recovering, recovered, and failed status payloads', () => {
    const recoveringPayload: EngineRecoveryStatus = {
      operationId: 'op-1234',
      sessionKind: 'realtime',
      phase: 'recovering',
      attempt: 1,
      message: 'Restarting engine after connection timeout...',
      failureCategory: 'readiness-timeout',
    };

    const decoded = decodeEngineRecoveryStatus(recoveringPayload);
    expect(decoded).toEqual(recoveringPayload);
    expect(isEngineRecoveryStatus(recoveringPayload)).toBe(true);

    const recoveredPayload: EngineRecoveryStatus = {
      operationId: 'op-1234',
      sessionKind: 'realtime',
      phase: 'recovered',
      attempt: 1,
      message: 'Audio engine recovered successfully',
    };
    expect(decodeEngineRecoveryStatus(recoveredPayload)).toEqual(recoveredPayload);

    const failedPayload: EngineRecoveryStatus = {
      operationId: 'op-1234',
      sessionKind: 'blue-live',
      phase: 'failed',
      attempt: 1,
      message: 'Failed to bind engine endpoint',
      failureCategory: 'address-contention',
    };
    expect(decodeEngineRecoveryStatus(failedPayload)).toEqual(failedPayload);
  });

  it('supports all valid failure categories', () => {
    const categories = [
      'engine-unavailable',
      'runtime-unavailable',
      'address-contention',
      'readiness-timeout',
      'session-unresponsive',
      'cleanup-failed',
      'unexpected',
    ] as const;

    for (const category of categories) {
      const payload = {
        operationId: 'op-cat',
        sessionKind: 'realtime' as const,
        phase: 'failed' as const,
        attempt: 1,
        message: `Failure: ${category}`,
        failureCategory: category,
      };
      const decoded = decodeEngineRecoveryStatus(payload);
      expect(decoded?.failureCategory).toBe(category);
    }
  });

  it('rejects null, non-objects, arrays, and missing required fields', () => {
    expect(decodeEngineRecoveryStatus(null)).toBeNull();
    expect(decodeEngineRecoveryStatus(undefined)).toBeNull();
    expect(decodeEngineRecoveryStatus('string')).toBeNull();
    expect(decodeEngineRecoveryStatus(123)).toBeNull();
    expect(decodeEngineRecoveryStatus([])).toBeNull();
    expect(decodeEngineRecoveryStatus({})).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        // missing operationId
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: '', // empty operationId
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        // missing sessionKind
        phase: 'recovering',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();
  });

  it('rejects invalid phases, session kinds, and failure categories', () => {
    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'invalid-kind',
        phase: 'recovering',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'unknown-phase',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'failed',
        attempt: 1,
        message: 'msg',
        failureCategory: 'not-a-category',
      }),
    ).toBeNull();
  });

  it('rejects invalid attempt numbers', () => {
    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 0, // must be positive integer
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: -1,
        message: 'msg',
      }),
    ).toBeNull();

    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1.5,
        message: 'msg',
      }),
    ).toBeNull();
  });

  it('rejects oversized text bounds', () => {
    const longOpId = 'a'.repeat(200);
    expect(
      decodeEngineRecoveryStatus({
        operationId: longOpId,
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1,
        message: 'msg',
      }),
    ).toBeNull();

    const longMessage = 'm'.repeat(2000);
    expect(
      decodeEngineRecoveryStatus({
        operationId: 'op-1',
        sessionKind: 'realtime',
        phase: 'recovering',
        attempt: 1,
        message: longMessage,
      }),
    ).toBeNull();
  });

  it('ensures no PID, process handles, or termination controls exist in decoded result', () => {
    const payloadWithInjectedPid = {
      operationId: 'op-1',
      sessionKind: 'realtime',
      phase: 'recovering',
      attempt: 1,
      message: 'recovering',
      pid: 99999,
      kill: () => {},
      process: {},
    };

    const decoded = decodeEngineRecoveryStatus(payloadWithInjectedPid);
    expect(decoded).not.toBeNull();
    expect(decoded).not.toHaveProperty('pid');
    expect(decoded).not.toHaveProperty('kill');
    expect(decoded).not.toHaveProperty('process');
  });
});
