import { describe, expect, it } from 'vitest';
import { MixerGatePublisher } from './mixer-mute-solo-runtime';
import {
  createTestGateCatalog,
  FakeMixerGateEngine,
  TEST_GATE_SIGNATURE,
} from './mixer-mute-solo-test-support';

function createPublisher(options?: {
  engine?: FakeMixerGateEngine;
  maxBatchEntries?: number;
  observeAttempts?: number;
  observeDelayMs?: number;
  stageRetryDelayMs?: number;
}) {
  const engine = options?.engine ?? new FakeMixerGateEngine();
  const publisher = new MixerGatePublisher(engine, {
    maxBatchEntries: options?.maxBatchEntries,
    observeAttempts: options?.observeAttempts ?? 4,
    observeDelayMs: options?.observeDelayMs ?? 1,
    stageRetryDelayMs: options?.stageRetryDelayMs ?? 1,
  });
  return { engine, publisher };
}

describe('MixerGatePublisher', () => {
  it('stages the complete vector into the inactive bank and publishes commit token 1', async () => {
    const { engine, publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(2));

    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0, 1]);
    expect(result.ok).toBe(true);
    expect(result.commitToken).toBe(1);

    // Bank 1 (inactive, since initial commit 0 selects bank 0) carries the vector.
    expect(engine.getBankValue('gk_blue_mixgate_0_1')).toBe(0);
    expect(engine.getBankValue('gk_blue_mixgate_1_1')).toBe(1);
    expect(engine.getBankValue('gk_blue_mixgate_commit')).toBe(1);
    expect(engine.appliedToken).toBe(1);
    // Bank 0 was never touched.
    expect(engine.getBankValue('gk_blue_mixgate_0_0')).toBeUndefined();
  });

  it('alternates banks and monotonically increases commit tokens', async () => {
    const { engine, publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(1));

    expect((await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1])).commitToken).toBe(1);
    expect((await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0])).commitToken).toBe(2);
    expect((await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1])).commitToken).toBe(3);

    // Token 2 selected bank 0 (staged value 0); token 3 selected bank 1
    // (restaged to 1). Bank contents reflect the last staged vector.
    expect(engine.getBankValue('gk_blue_mixgate_0_0')).toBe(0);
    expect(engine.getBankValue('gk_blue_mixgate_0_1')).toBe(1);
    expect(engine.getBankValue('gk_blue_mixgate_commit')).toBe(3);
  });

  it('batches large vectors at the engine bound without exceeding it', async () => {
    const { engine, publisher } = createPublisher({ maxBatchEntries: 4 });
    publisher.setBindings('timeline', createTestGateCatalog(10));

    const values = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, values);
    expect(result.ok).toBe(true);

    // 10 gates = 3 stage batches (4/4/2) + 1 commit write.
    expect(engine.writes).toHaveLength(4);
    for (const write of engine.writes) {
      expect(write.length).toBeLessThanOrEqual(4);
    }
  });

  it('keeps staging and the commit token in separate writes', async () => {
    const { engine, publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(1));

    await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0]);
    const commitWrites = engine.writes.filter((write) =>
      write.some((entry) => entry.name === 'gk_blue_mixgate_commit'),
    );
    expect(commitWrites).toHaveLength(1);
    expect(commitWrites[0]).toHaveLength(1);
  });

  it('retries queue-full rejections while bounded', async () => {
    const { engine, publisher } = createPublisher({ stageRetryDelayMs: 1 });
    publisher.setBindings('timeline', createTestGateCatalog(1));
    engine.failureMode = 'queue-full-once';

    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(result.ok).toBe(true);
    expect(engine.appliedToken).toBe(1);
  });

  it('fails without publishing the commit token when staging keeps failing', async () => {
    const { engine, publisher } = createPublisher({ stageRetryDelayMs: 1 });
    publisher.setBindings('timeline', createTestGateCatalog(1));
    engine.failureMode = 'queue-full-always';

    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0]);
    expect(result.ok).toBe(false);
    expect(result.commitToken).toBeUndefined();
    // No commit write was ever issued.
    expect(
      engine.writes.some((write) => write.some((entry) => entry.name === 'gk_blue_mixgate_commit')),
    ).toBe(false);
    // The audible state is untouched.
    expect(engine.appliedToken).toBe(0);
  });

  it('fails closed when the batch capability is missing', async () => {
    const { engine, publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(1));
    engine.failureMode = 'missing-capability';

    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('batch-channels-v1');
  });

  it('does not reuse the old bank while a delayed applied echo is unobserved', async () => {
    const { engine, publisher } = createPublisher({ observeAttempts: 2, observeDelayMs: 1 });
    publisher.setBindings('timeline', createTestGateCatalog(1));
    engine.failureMode = 'applied-echo-delayed';
    engine.echoDelayRemaining = 10;

    const first = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0]);
    expect(first.ok).toBe(false);
    expect(first.unconfirmed).toBe(true);
    expect(first.commitToken).toBe(1);

    // The commit was published; the pending token blocks bank reuse.
    const second = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(second.ok).toBe(false);
    expect(second.unconfirmed).toBe(true);

    // Once the echo catches up, the pending token settles and publication proceeds.
    engine.echoDelayRemaining = 0;
    const third = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(third.ok).toBe(true);
    expect(third.commitToken).toBe(2);
  });

  it('rejects vectors with the wrong length or an unknown topology signature', async () => {
    const { publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(2));

    const stale = await publisher.publish('timeline', 'other-topology', [1, 1]);
    expect(stale).toEqual({ ok: false, message: 'gate-topology-changed' });

    const wrongLength = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(wrongLength.ok).toBe(false);
  });

  it('fails when no catalog is registered for the performance kind', async () => {
    const { publisher } = createPublisher();
    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);
    expect(result).toEqual({ ok: false, message: 'gate-bindings-unavailable' });
  });

  it('keeps timeline and blueLive catalogs and tokens independent', async () => {
    const { engine, publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(1));
    publisher.setBindings('blueLive', createTestGateCatalog(2));

    await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0]);
    const live = await publisher.publish('blueLive', TEST_GATE_SIGNATURE, [1, 1]);
    expect(live.ok).toBe(true);
    expect(live.commitToken).toBe(1);
    expect(engine.getBankValue('gk_blue_mixgate_commit')).toBe(1);
  });

  it('resets token state when a new generation registers bindings', async () => {
    const { publisher } = createPublisher();
    publisher.setBindings('timeline', createTestGateCatalog(1));
    await publisher.publish('timeline', TEST_GATE_SIGNATURE, [1]);

    publisher.setBindings('timeline', createTestGateCatalog(1));
    const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, [0]);
    // New generation starts from CSD-initialized banks with commit 0 again.
    expect(result.commitToken).toBe(1);
  });
});
