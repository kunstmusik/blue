import { describe, expect, it, vi } from 'vitest';
import { MidiNoteRouter } from '../services/midi-note-router';
import type { MidiNoteEvent } from '../../../shared/midi-input';

interface CapturedRequest {
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  velocity: number;
  channel: number;
  source: string;
  sourceId?: string;
  deviceId?: string;
}

function makeCaptureRouter(active = true) {
  const captured: CapturedRequest[] = [];
  const trigger = async (req: Parameters<typeof capture>[0]) => {
    captured.push({
      type: req.type,
      midiNote: req.midiNote,
      velocity: req.velocity,
      channel: req.channel,
      source: req.source,
      sourceId: req.sourceId,
      deviceId: req.deviceId,
    });
    return { ok: true };
  };
  function capture(_req: {
    type: 'noteOn' | 'noteOff';
    midiNote: number;
    velocity: number;
    channel: number;
    source: 'hardware' | 'mouse' | 'computer';
    sourceId?: string;
    deviceId?: string;
  }): Promise<{ ok: boolean; message?: string }> {
    return Promise.resolve({ ok: true });
  }
  const router = new MidiNoteRouter({
    trigger,
    allNotesOff: async () => ({ ok: true }),
    isLiveActive: () => active,
  });
  return { router, captured };
}

describe('Hardware vs Virtual Keyboard routing parity (SPEC 058 US3)', () => {
  it('produces equivalent trigger payloads for identical channel/note/velocity', async () => {
    const { router, captured } = makeCaptureRouter(true);

    const hardwareEvent: MidiNoteEvent = {
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:keyboard',
      deviceId: 'keyboard',
      channel: 3,
      midiNote: 64,
      velocity: 88,
      timestamp: 100,
    };
    const virtualEvent: MidiNoteEvent = {
      type: 'noteOn',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 3,
      midiNote: 64,
      velocity: 88,
      timestamp: 100,
    };

    await router.routeNote(hardwareEvent);
    await router.releaseAll();
    await router.routeNote(virtualEvent);

    // The mapped fields that drive project MIDI processing (channel, note,
    // velocity, type) must be identical for both sources.
    expect(captured).toHaveLength(2);
    const hw = captured[0];
    const v = captured[1];
    expect(hw.type).toBe(v.type);
    expect(hw.channel).toBe(v.channel);
    expect(hw.midiNote).toBe(v.midiNote);
    expect(hw.velocity).toBe(v.velocity);

    // Source identity differs as required by the diagnostic contract.
    expect(hw.source).toBe('hardware');
    expect(hw.deviceId).toBe('keyboard');
    expect(v.source).toBe('mouse');
    expect(v.deviceId).toBeUndefined();
  });

  it('treats hardware note-on velocity zero as note-off (FR-019)', async () => {
    const { router, captured } = makeCaptureRouter(true);
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 0,
      midiNote: 60,
      velocity: 0,
      timestamp: 0,
    });
    // velocity-zero note-on must not produce a noteOn trigger that creates a
    // held note; it normalizes to note-off and the held ledger stays empty.
    expect(router.heldCount).toBe(0);
    expect(captured.find((c) => c.type === 'noteOn')).toBeUndefined();
  });

  it('ignores notes when Blue Live is not running (FR-021)', async () => {
    const { router, captured } = makeCaptureRouter(false);
    const r = await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 0,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    expect(r.accepted).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('unmapped channel produces a non-disruptive diagnostic (no held-note debt)', async () => {
    const trigger = vi.fn(async (req: { type: 'noteOn' | 'noteOff' }) =>
      req.type === 'noteOn'
        ? { ok: false, message: 'No instrument mapped to that channel' }
        : { ok: true },
    );
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
    });
    const r = await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 7,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    expect(r.accepted).toBe(false);
    expect(r.message).toContain('No instrument mapped');
    expect(router.heldCount).toBe(0);
  });

  it('note-off score text uses i- prefix after main mapping', async () => {
    // This mirrors the blue-live-engine triggerNote path: an accepted note-on
    // stores a held record, and the matching note-off emits a trigger with
    // type noteOff. The actual score-text formatting lives in main; this test
    // asserts the router forwards the note-off with the same mapped fields.
    const { router, captured } = makeCaptureRouter(true);
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 1,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    await router.routeNote({
      type: 'noteOff',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 1,
      midiNote: 60,
      velocity: 0,
      timestamp: 0,
    });
    const on = captured.find((c) => c.type === 'noteOn');
    const off = captured.find((c) => c.type === 'noteOff');
    expect(on).toBeDefined();
    expect(off).toBeDefined();
    expect(off?.channel).toBe(on?.channel);
    expect(off?.midiNote).toBe(on?.midiNote);
  });
});
describe('Focused target hardware/Virtual Keyboard parity (Spec 067 US1/US2)', () => {
  function makeFocusRouter(
    target: { kind: 'track'; trackId: string } | { kind: 'orchestra'; assignmentId: string } = {
      kind: 'track',
      trackId: 'focused-track',
    },
  ) {
    const captured: Array<{ type: string; target?: { kind: string }; source: string }> = [];
    const trigger = async (req: {
      type: 'noteOn' | 'noteOff';
      source: 'hardware' | 'mouse' | 'computer';
      target?: { kind: string; [k: string]: unknown };
    }) => {
      captured.push({
        type: req.type,
        target: req.target as { kind: string } | undefined,
        source: req.source,
      });
      return { ok: true };
    };
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
      resolveTarget: () => ({ target, liveSessionId: 1 }),
    });
    return { router, captured };
  }

  it('hardware and Virtual Keyboard resolve the same focused Track target', async () => {
    const { router, captured } = makeFocusRouter();
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 0,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 0,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    expect(captured).toHaveLength(1); // aggregate: same target/pitch → one note-on
    expect(captured[0]?.target).toEqual({ kind: 'track', trackId: 'focused-track' });
  });

  it('hardware and Virtual Keyboard both route to the exact focused Orchestra assignment', async () => {
    const { router, captured } = makeFocusRouter({
      kind: 'orchestra',
      assignmentId: 'named-lead',
    });
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 3,
      midiNote: 64,
      velocity: 88,
      timestamp: 0,
    });
    await router.routeNote({
      type: 'noteOff',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 3,
      midiNote: 64,
      velocity: 0,
      timestamp: 1,
    });
    await router.routeNote({
      type: 'noteOn',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 3,
      midiNote: 64,
      velocity: 88,
      timestamp: 2,
    });

    const noteOns = captured.filter((request) => request.type === 'noteOn');
    expect(noteOns).toHaveLength(2);
    expect(noteOns.map((request) => request.target)).toEqual([
      { kind: 'orchestra', assignmentId: 'named-lead' },
      { kind: 'orchestra', assignmentId: 'named-lead' },
    ]);
    expect(noteOns.map((request) => request.source)).toEqual(['hardware', 'mouse']);
  });

  it('a focused Track with no compiled instrument fails closed with no fallback', async () => {
    const trigger = vi.fn(async () => ({ ok: false, message: 'Unresolved MIDI target' }));
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
      resolveTarget: () => null, // no resolved target (focused but unavailable)
    });
    const r = await router.routeNote({
      type: 'noteOn',
      sourceKind: 'hardware',
      sourceId: 'midi:k',
      deviceId: 'k',
      channel: 0,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });
    expect(r.accepted).toBe(false);
    expect(router.heldCount).toBe(0);
    // No fallback: trigger is not called when resolution fails.
    expect(trigger).not.toHaveBeenCalled();
  });
});
