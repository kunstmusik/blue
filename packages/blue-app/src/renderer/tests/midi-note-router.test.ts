import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiNoteRouter } from '../services/midi-note-router';

function makeRouter(opts: { active?: boolean; trigger?: typeof defaultTrigger; allNotesOff?: () => Promise<{ ok: boolean }> } = {}) {
  const active = opts.active ?? true;
  const trigger = opts.trigger ?? defaultTrigger;
  const calls: { type: 'noteOn' | 'noteOff'; midiNote: number; channel: number; source: string; sourceId?: string }[] = [];
  const triggerWrapper = async (request: Parameters<typeof defaultTrigger>[0]) => {
    calls.push({ type: request.type, midiNote: request.midiNote, channel: request.channel, source: request.source, sourceId: request.sourceId });
    return trigger(request);
  };
  const allOff = opts.allNotesOff ?? (async () => ({ ok: true }));
  const router = new MidiNoteRouter({
    trigger: triggerWrapper,
    allNotesOff: allOff,
    isLiveActive: () => active,
  });
  return { router, calls };
}

const defaultTrigger = async () => ({ ok: true });

describe('MidiNoteRouter', () => {
  it('rejects out-of-range channels/notes/velocities', async () => {
    const { router } = makeRouter();
    const r1 = await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: -1, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(r1.accepted).toBe(false);
    const r2 = await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 200, velocity: 100, timestamp: 0 });
    expect(r2.accepted).toBe(false);
    const r3 = await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 200, timestamp: 0 });
    expect(r3.accepted).toBe(false);
  });

  it('normalizes hardware note-on velocity zero to note-off', async () => {
    const trigger = async (req: { type: 'noteOn' | 'noteOff' }) => ({ ok: true });
    const { router, calls } = makeRouter({ trigger });
    const res = await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 0, timestamp: 0 });
    expect(res.accepted).toBe(true);
    // velocity-zero note-on from hardware should not create a noteOn trigger.
    expect(calls.find((c) => c.type === 'noteOn')).toBeUndefined();
  });

  it('records aggregate references and only sends final note-off', async () => {
    const { router, calls } = makeRouter();
    // Same channel/note from two sources
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'virtual-keyboard:mouse:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(calls.filter((c) => c.type === 'noteOn')).toHaveLength(1);

    // One source releases — should NOT emit a note-off
    await router.routeNote({ type: 'noteOff', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 0, timestamp: 0 });
    const noteOffs = calls.filter((c) => c.type === 'noteOff');
    expect(noteOffs).toHaveLength(0);

    // Second source releases — NOW the final note-off fires
    await router.routeNote({ type: 'noteOff', sourceKind: 'mouse', sourceId: 'virtual-keyboard:mouse:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 0, timestamp: 0 });
    const final = calls.filter((c) => c.type === 'noteOff');
    expect(final).toHaveLength(1);
  });

  it('is idempotent for repeated note-ons of the same source key', async () => {
    const { router, calls } = makeRouter();
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(calls.filter((c) => c.type === 'noteOn')).toHaveLength(1);
  });

  it('release for an unknown source key is a no-op', async () => {
    const { router, calls } = makeRouter();
    await router.routeNote({ type: 'noteOff', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 0, timestamp: 0 });
    expect(calls).toHaveLength(0);
  });

  it('releaseSource releases only that source and emits final aggregate note-offs', async () => {
    const { router, calls } = makeRouter();
    // Hold the same note from two sources, then release only the hardware source.
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'virtual-keyboard:mouse:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.releaseSource('midi:a');
    // The aggregate count is now 1 — no final note-off yet.
    expect(calls.filter((c) => c.type === 'noteOff')).toHaveLength(0);
    expect(router.heldCount).toBe(1);

    await router.routeNote({ type: 'noteOff', sourceKind: 'mouse', sourceId: 'virtual-keyboard:mouse:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 0, timestamp: 0 });
    expect(calls.filter((c) => c.type === 'noteOff')).toHaveLength(1);
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
  });

  it('serializes note-off behind an in-flight note-on', async () => {
    let resolveNoteOn: (() => void) | null = null;
    const trigger = vi.fn(async (req: { type: 'noteOn' | 'noteOff' }) => {
      if (req.type === 'noteOn') {
        await new Promise<void>((resolve) => { resolveNoteOn = resolve; });
      }
      return { ok: true };
    });
    const { router } = makeRouter({ trigger });

    const noteOn = router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    const noteOff = router.routeNote({ type: 'noteOff', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 0, timestamp: 1 });
    await Promise.resolve();
    expect(trigger).toHaveBeenCalledTimes(1);

    resolveNoteOn?.();
    await Promise.all([noteOn, noteOff]);
    expect(trigger.mock.calls.map(([request]) => request.type)).toEqual(['noteOn', 'noteOff']);
    expect(router.heldCount).toBe(0);
  });

  it('failed note-on does not create cleanup debt', async () => {
    const trigger = async (req: { type: 'noteOn' | 'noteOff' }) =>
      req.type === 'noteOn' ? { ok: false, message: 'unmapped channel' } : { ok: true };
    const { router } = makeRouter({ trigger });
    const r = await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(r.accepted).toBe(false);
    expect(router.heldCount).toBe(0);
  });

  it('releaseAll triggers engine all-notes-off', async () => {
    const allNotesOff = vi.fn(async () => ({ ok: true }));
    const { router } = makeRouter({ allNotesOff });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:b', deviceId: 'b', channel: 0, midiNote: 64, velocity: 100, timestamp: 0 });
    await router.releaseAll();
    expect(allNotesOff).toHaveBeenCalledTimes(1);
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
  });

});

describe('MidiNoteRouter target-aware routing (Spec 067)', () => {
  type TriggerRecord = {
    type: 'noteOn' | 'noteOff';
    midiNote: number;
    channel: number;
    target?: { kind: string };
    liveSessionId?: number;
    sourceId?: string;
  };

  function makeTargetRouter(opts: {
    resolveTarget?: (channel: number) => { target: { kind: string; [k: string]: unknown }; liveSessionId: number } | null;
    triggerOk?: (req: TriggerRecord) => boolean;
  } = {}) {
    const calls: TriggerRecord[] = [];
    const resolveTarget = opts.resolveTarget ?? ((channel: number) => ({
      target: { kind: 'channel', channel },
      liveSessionId: 1,
    }));
    const triggerOk = opts.triggerOk ?? (() => true);
    const trigger = async (req: Parameters<typeof defaultTrigger>[0]) => {
      const record: TriggerRecord = {
        type: req.type,
        midiNote: req.midiNote,
        channel: req.channel,
        target: req.target as { kind: string } | undefined,
        liveSessionId: req.liveSessionId,
        sourceId: req.sourceId,
      };
      calls.push(record);
      return triggerOk(record) ? { ok: true } : { ok: false, message: 'rejected' };
    };
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
      resolveTarget,
    });
    return { router, calls };
  }

  const defaultTrigger = async () => ({ ok: true });

  it('resolves the target at note-on and forwards it with the live session id', async () => {
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: { kind: 'track', trackId: 'track-1' }, liveSessionId: 7 }),
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.target).toEqual({ kind: 'track', trackId: 'track-1' });
    expect(calls[0]?.liveSessionId).toBe(7);
  });

  it('retains the note-on target on the matching note-off', async () => {
    let session = 1;
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: { kind: 'track', trackId: 'track-1' }, liveSessionId: session }),
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    // Simulate a focus/session change before note-off.
    session = 2;
    await router.routeNote({ type: 'noteOff', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 0, timestamp: 1 });
    const off = calls.find((c) => c.type === 'noteOff');
    expect(off?.target).toEqual({ kind: 'track', trackId: 'track-1' });
    expect(off?.liveSessionId).toBe(1); // retained from note-on, not the current session
  });

  it('aggregates by (targetKey, midiNote) so equal pitch on different targets stays independent', async () => {
    const { router, calls } = makeTargetRouter({
      resolveTarget: (channel) =>
        channel === 0
          ? { target: { kind: 'track', trackId: 'track-a' }, liveSessionId: 1 }
          : { target: { kind: 'track', trackId: 'track-b' }, liveSessionId: 1 },
    });
    // Same pitch, two different targets — two independent note-ons.
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:b', deviceId: 'b', channel: 1, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(calls.filter((c) => c.type === 'noteOn')).toHaveLength(2);
    expect(router.aggregateHeldCount).toBe(2);
  });

  it('multiple sources on the same target/pitch share one aggregate note', async () => {
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: { kind: 'track', trackId: 'track-a' }, liveSessionId: 1 }),
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(calls.filter((c) => c.type === 'noteOn')).toHaveLength(1);
    expect(router.aggregateHeldCount).toBe(1);
  });

  it('source cleanup emits one final release per target/pitch aggregate', async () => {
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: { kind: 'track', trackId: 'track-a' }, liveSessionId: 1 }),
    });
    // A hardware source may hold the same target/pitch on more than one input channel.
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:shared', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:shared', deviceId: 'a', channel: 1, midiNote: 60, velocity: 100, timestamp: 0 });

    await router.releaseSource('midi:shared');

    expect(calls.filter((c) => c.type === 'noteOff')).toHaveLength(1);
    expect(calls.find((c) => c.type === 'noteOff')?.target).toEqual({ kind: 'track', trackId: 'track-a' });
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
  });

  it('rejects silently when no target resolves and creates no held state', async () => {
    const { router, calls } = makeTargetRouter({ resolveTarget: () => null });
    const res = await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(res.accepted).toBe(false);
    expect(router.heldCount).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('failed note-on creates no held state or aggregate entry', async () => {
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: { kind: 'track', trackId: 'track-x' }, liveSessionId: 1 }),
      triggerOk: (req) => req.type !== 'noteOn',
    });
    const res = await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:mouse', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    expect(res.accepted).toBe(false);
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('releaseSource emits the stored target on final release after a focus change', async () => {
    let current: { kind: string; [k: string]: unknown } = { kind: 'track', trackId: 'track-a' };
    const { router, calls } = makeTargetRouter({
      resolveTarget: () => ({ target: current, liveSessionId: 1 }),
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    current = { kind: 'orchestra', assignmentId: 'orchestra-b' }; // focus changed across target kinds
    await router.releaseSource('midi:a');
    const off = calls.find((c) => c.type === 'noteOff');
    expect(off?.target).toEqual({ kind: 'track', trackId: 'track-a' }); // original target
  });

  it('Direct Channel mode uses the event channel and does not retarget held notes on mode change', async () => {
    let mode: 'focus' | 'channel' = 'focus';
    const { router, calls } = makeTargetRouter({
      resolveTarget: (channel) =>
        mode === 'channel'
          ? { target: { kind: 'channel', channel }, liveSessionId: 1 }
          : { target: { kind: 'track', trackId: 'track-1' }, liveSessionId: 1 },
    });
    // Start a note in focus mode (targets track-1).
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:m', deviceId: null, channel: 2, midiNote: 60, velocity: 100, timestamp: 0 });
    // Switch to channel mode while held.
    mode = 'channel';
    // The matching note-off must still release the original track-1 target.
    await router.routeNote({ type: 'noteOff', sourceKind: 'mouse', sourceId: 'vk:m', deviceId: null, channel: 2, midiNote: 60, velocity: 0, timestamp: 1 });
    const off = calls.find((c) => c.type === 'noteOff');
    expect(off?.target).toEqual({ kind: 'track', trackId: 'track-1' });
  });
});

describe('MidiNoteRouter lifecycle stress (Spec 067 US4)', () => {
  type TriggerRecord = {
    type: 'noteOn' | 'noteOff';
    midiNote: number;
    target?: { kind: string };
    liveSessionId?: number;
    sourceId?: string;
  };

  function makeStressRouter(resolveTarget: (channel: number) => { target: { kind: string; [k: string]: unknown }; liveSessionId: number } | null) {
    const calls: TriggerRecord[] = [];
    const trigger = async (req: Parameters<typeof defaultTrigger>[0]) => {
      calls.push({
        type: req.type, midiNote: req.midiNote,
        target: req.target as { kind: string } | undefined,
        liveSessionId: req.liveSessionId, sourceId: req.sourceId,
      });
      return { ok: true };
    };
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
      resolveTarget,
    });
    return { router, calls };
  }
  const defaultTrigger = async () => ({ ok: true });

  it('focus change between note-on and note-off keeps the release on the original target', async () => {
    let trackId = 'track-a';
    const { router, calls } = makeStressRouter(() => ({ target: { kind: 'track', trackId }, liveSessionId: 1 }));
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    trackId = 'track-b';
    await router.routeNote({ type: 'noteOff', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 0, timestamp: 1 });
    const off = calls.find((c) => c.type === 'noteOff');
    expect(off?.target).toEqual({ kind: 'track', trackId: 'track-a' });
  });

  it('equal pitch across two targets releases only the targeted one', async () => {
    const { router, calls } = makeStressRouter((channel) => ({
      target: channel === 0 ? { kind: 'track', trackId: 'a' } : { kind: 'track', trackId: 'b' },
      liveSessionId: 1,
    }));
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:b', deviceId: 'b', channel: 1, midiNote: 60, velocity: 100, timestamp: 0 });
    // Release only source a (target a); target b must keep sounding.
    await router.releaseSource('midi:a');
    const offs = calls.filter((c) => c.type === 'noteOff');
    expect(offs).toHaveLength(1);
    expect(offs[0]?.target).toEqual({ kind: 'track', trackId: 'a' });
    expect(router.heldCount).toBe(1);
  });

  it('100-cycle focus/switch/release leaves no stuck notes', async () => {
    const { router } = makeStressRouter((channel) => ({
      target: { kind: 'track', trackId: `track-${channel}` },
      liveSessionId: 1,
    }));
    for (let i = 0; i < 100; i++) {
      await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: `midi:${i}`, deviceId: `${i}`, channel: i % 16, midiNote: 60, velocity: 100, timestamp: i });
      await router.releaseSource(`midi:${i}`);
    }
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
  });

  it('releaseAll clears ledgers before all-notes-off so a new generation gets no late events', async () => {
    let allNotesOffSeenHeld = true;
    const allNotesOff = vi.fn(async () => {
      // By the time all-notes-off runs, the router must already have cleared its ledgers.
      allNotesOffSeenHeld = router.heldCount > 0 || router.aggregateHeldCount > 0;
      return { ok: true };
    });
    const calls: TriggerRecord[] = [];
    const router = new MidiNoteRouter({
      trigger: async (req) => { calls.push({ type: req.type, midiNote: req.midiNote }); return { ok: true }; },
      allNotesOff,
      isLiveActive: () => true,
      resolveTarget: (channel) => ({ target: { kind: 'channel', channel }, liveSessionId: 1 }),
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'vk:m', deviceId: null, channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.releaseAll();
    expect(allNotesOffSeenHeld).toBe(false); // ledgers cleared first
    expect(router.heldCount).toBe(0);
  });
});
