import { describe, expect, it } from 'vitest';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import type { RuntimeOperationAck } from './project-runtime-reconciliation';
import type { RuntimeWorkOperation } from './project-runtime-reconciliation';

interface RecordingClient {
  applied: RuntimeWorkOperation[];
  channelValues: Map<string, number>;
}

function makeEngineClient(): RecordingClient & {
  applyOperation(operation: RuntimeWorkOperation): Promise<RuntimeOperationAck>;
} {
  const applied: RuntimeWorkOperation[] = [];
  const channelValues = new Map<string, number>();
  return {
    applied,
    channelValues,
    async applyOperation(operation) {
      applied.push(operation);
      if (operation.kind === 'channel-value') {
        channelValues.set(operation.channel, operation.value);
      }
      return { status: 'applied' };
    },
  };
}

function mixerLevel(level: number) {
  return { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level } } } as const;
}

const BINDINGS = new Map([
  ['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }],
]);

/**
 * US3 engine smoke: live reversals must be observable through engine control
 * readback — a resolved acknowledgement or an updated renderer knob alone is
 * not success. Uses the engine client protocol's channel store as the
 * readback surface.
 */
describe('global history engine integration (T040, US3)', () => {
  it('reads back live edits and audible reversals from the engine', async () => {
    const engine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, engine, new Map(BINDINGS));

    // Live edit during playback.
    const edit = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [mixerLevel(0.8)],
    });
    expect(edit[0]!.status).toBe('applied');
    expect(edit[0]!.appliedRevision).toBe(2);
    expect(engine.channelValues.get('gkMasterLevel')).toBe(0.8);

    // Undo restores the previous value; readback confirms the reversal.
    const undo = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 3,
      patches: [mixerLevel(0.25)],
    });
    expect(undo[0]!.status).toBe('applied');
    expect(engine.channelValues.get('gkMasterLevel')).toBe(0.25);
  });

  it('marks compiled changes restart-required without engine writes', async () => {
    const engine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, engine, new Map(BINDINGS));

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 4,
      patches: [{ globalOrc: 'instr 1\n endin\n' }],
    });

    expect(result[0]!.status).toBe('restart-required');
    expect(engine.applied).toHaveLength(0);
    expect(engine.channelValues.size).toBe(0);
  });

  it('never lets a superseded generation write into the new performance', async () => {
    let releaseAck: ((ack: RuntimeOperationAck) => void) | null = null;
    const oldEngine = makeEngineClient();
    oldEngine.applyOperation = async (operation) => {
      oldEngine.applied.push(operation);
      return new Promise<RuntimeOperationAck>((resolve) => {
        releaseAck = resolve;
      });
    };
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, oldEngine, new Map(BINDINGS));

    const staleCommit = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 5,
      patches: [mixerLevel(0.9)],
    });

    // Let the plan start so the request is genuinely in flight.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(releaseAck).not.toBeNull();

    // Playback restarts (new generation) while the old plan is in flight.
    const newEngine = makeEngineClient();
    reconciliation.registerPerformance('timeline', 2, newEngine, new Map(BINDINGS));
    releaseAck!({ status: 'applied' });

    const staleResult = await staleCommit;
    expect(staleResult).toHaveLength(0);

    // The new performance only ever sees work planned for its generation.
    const newCommit = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 6,
      patches: [mixerLevel(0.3)],
    });
    expect(newCommit[0]!.status).toBe('applied');
    expect(newEngine.channelValues.get('gkMasterLevel')).toBe(0.3);
    expect(oldEngine.channelValues.size).toBe(0);
  });

  it('writes only to running performances and skips stopped ones', async () => {
    const timelineEngine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, timelineEngine, new Map(BINDINGS));
    // Blue Live is stopped: not registered, no live synchronization duty.

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 7,
      patches: [mixerLevel(0.6)],
    });

    expect(timelineEngine.channelValues.get('gkMasterLevel')).toBe(0.6);
  });
});
