import { describe, expect, it, vi } from 'vitest';
import {
  classifyEngineFailure,
  EngineRecoveryCoordinator,
  isRecoverableFailure,
  sanitizeEngineDiagnostics,
} from './engine-recovery';
import type { EngineRecoveryStatus } from '../shared/engine-recovery';

describe('EngineRecoveryCoordinator', () => {
  it('classifies unrecoverable missing runtime and engine binaries correctly', () => {
    expect(classifyEngineFailure(new Error('Csound 7 was not found'))).toBe('runtime-unavailable');
    expect(classifyEngineFailure(new Error('blue-engine not found in PATH'))).toBe(
      'engine-unavailable',
    );
    expect(isRecoverableFailure('runtime-unavailable')).toBe(false);
    expect(isRecoverableFailure('engine-unavailable')).toBe(false);
  });

  it('classifies recoverable failures correctly', () => {
    expect(classifyEngineFailure(new Error('EADDRINUSE: address already in use'))).toBe(
      'address-contention',
    );
    expect(classifyEngineFailure(new Error('timed out waiting for engine readiness'))).toBe(
      'readiness-timeout',
    );
    expect(classifyEngineFailure(new Error('ECONNREFUSED'))).toBe('session-unresponsive');
    expect(
      classifyEngineFailure(
        new Error(
          'No isolated TCP endpoint pair available (address-contention): Exhausted available TCP endpoint pairs after 20 attempts starting from port 5555',
        ),
      ),
    ).toBe('address-contention');
    expect(isRecoverableFailure('address-contention')).toBe(true);
    expect(isRecoverableFailure('readiness-timeout')).toBe(true);
    expect(isRecoverableFailure('session-unresponsive')).toBe(true);
    expect(isRecoverableFailure('unexpected')).toBe(false);
    expect(isRecoverableFailure('cleanup-failed')).toBe(false);
  });

  it('performs one automatic retry on recoverable failure and succeeds', async () => {
    const statuses: EngineRecoveryStatus[] = [];
    const coordinator = new EngineRecoveryCoordinator((status) => statuses.push(status));

    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('EADDRINUSE: port 5555 busy');
      }
      return 'playback-started';
    });
    const cleanup = vi.fn(async () => {});

    const outcome = await coordinator.runWithRecovery('realtime', operation, cleanup);

    expect(outcome.ok).toBe(true);
    expect(outcome.result).toBe('playback-started');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);

    expect(statuses.length).toBe(2);
    expect(statuses[0].phase).toBe('recovering');
    expect(statuses[0].attempt).toBe(1);
    expect(statuses[1].phase).toBe('recovered');
    expect(statuses[1].attempt).toBe(1);
    expect(statuses[0].operationId).toBe(statuses[1].operationId);
  });

  it('fails boundedly after 1 retry failure without looping', async () => {
    const statuses: EngineRecoveryStatus[] = [];
    const coordinator = new EngineRecoveryCoordinator((status) => statuses.push(status));

    const operation = vi.fn(async () => {
      throw new Error('timed out waiting for engine readiness');
    });
    const cleanup = vi.fn(async () => {});

    const outcome = await coordinator.runWithRecovery('realtime', operation, cleanup);

    expect(outcome.ok).toBe(false);
    expect(outcome.failureCategory).toBe('readiness-timeout');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);

    expect(statuses.length).toBe(2);
    expect(statuses[0].phase).toBe('recovering');
    expect(statuses[1].phase).toBe('failed');
  });

  it('does not retry unrecoverable missing Csound failure', async () => {
    const statuses: EngineRecoveryStatus[] = [];
    const coordinator = new EngineRecoveryCoordinator((status) => statuses.push(status));

    const operation = vi.fn(async () => {
      throw new Error('Csound is not available');
    });
    const cleanup = vi.fn(async () => {});

    const outcome = await coordinator.runWithRecovery('realtime', operation, cleanup);

    expect(outcome.ok).toBe(false);
    expect(outcome.failureCategory).toBe('runtime-unavailable');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({
      phase: 'failed',
      attempt: 1,
      failureCategory: 'runtime-unavailable',
    });
  });

  it('rejects concurrent recovery requests for the same session kind', async () => {
    const coordinator = new EngineRecoveryCoordinator();

    let resolveOp1!: () => void;
    const op1Pending = new Promise<string>((resolve) => {
      resolveOp1 = () => resolve('ok');
    });

    let attempts = 0;
    const op1 = async () => {
      attempts++;
      if (attempts === 1) throw new Error('EADDRINUSE');
      return op1Pending;
    };

    const run1 = coordinator.runWithRecovery('realtime', op1, async () => {});
    await Promise.resolve();
    await Promise.resolve();

    // Concurrent request while recovery is underway
    const run2 = await coordinator.runWithRecovery(
      'realtime',
      async () => 'op2',
      async () => {},
    );

    expect(run2.ok).toBe(false);
    expect(run2.errorMessage).toContain('already in progress');

    resolveOp1();
    await run1;
  });

  it('claims the recovery slot before the initial operation begins', async () => {
    const coordinator = new EngineRecoveryCoordinator();
    let releaseInitial!: () => void;
    let attempts = 0;
    const initialReleased = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });

    const firstRun = coordinator.runWithRecovery(
      'realtime',
      async () => {
        attempts += 1;
        if (attempts > 1) return 'recovered';
        await initialReleased;
        throw new Error('EADDRINUSE: address already in use');
      },
      async () => {},
    );

    await Promise.resolve();
    const secondRun = await coordinator.runWithRecovery(
      'realtime',
      async () => 'second',
      async () => {},
    );

    expect(secondRun.ok).toBe(false);
    expect(secondRun.errorMessage).toContain('already in progress');

    releaseInitial();
    const firstResult = await firstRun;
    expect(firstResult.ok).toBe(true);
  });

  describe('diagnostic privacy and Csound output sanitization', () => {
    it('redacts user home directories from diagnostics', () => {
      const raw =
        'Error in /Users/stevenyi/work/blue-electron/project.csd at line 10\nWindows error in C:\\Users\\stevenyi\\AppData\\Local';
      const sanitized = sanitizeEngineDiagnostics(raw);

      expect(sanitized).not.toContain('stevenyi');
      expect(sanitized).toContain('/Users/[user]');
      expect(sanitized).toContain('C:\\Users\\[user]');
    });

    it('excludes project XML and CSD tags from diagnostics', () => {
      const raw =
        '<CsoundSynthesizer>\n<CsOptions>\n-odac\n</CsOptions>\ncsound error: invalid table length\n</CsoundSynthesizer>';
      const sanitized = sanitizeEngineDiagnostics(raw);

      expect(sanitized).not.toContain('<CsoundSynthesizer>');
      expect(sanitized).not.toContain('<CsOptions>');
      expect(sanitized).not.toContain('</CsOptions>');
      expect(sanitized).toContain('csound error: invalid table length');
    });

    it('excludes environment variable dumps from diagnostics', () => {
      const raw = 'PATH=/usr/bin:/bin\nSECRET_KEY=12345\nEngine startup failed: exit code 1';
      const sanitized = sanitizeEngineDiagnostics(raw);

      expect(sanitized).not.toContain('SECRET_KEY');
      expect(sanitized).toContain('Engine startup failed: exit code 1');
    });
  });
});
