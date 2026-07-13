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
