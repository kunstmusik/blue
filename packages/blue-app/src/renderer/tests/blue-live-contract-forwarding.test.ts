import { describe, expect, it } from 'vitest';
import type {
  BlueLiveNoteTarget,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
} from '../../shared/project-editor';

/**
 * Spec 067 — the preload and renderer-global contract forward the optional
 * `target`/`liveSessionId` request fields unchanged. Preload never resolves
 * project state; it only serializes the request for main. These tests pin the
 * serializable shape so the IPC bridge stays a pass-through.
 */
describe('Blue Live note trigger forwarding contract (Spec 067)', () => {
  it('a request may carry a Track target and a nonnegative liveSessionId', () => {
    const request: BlueLiveNoteTriggerRequest = {
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'track-1' },
      liveSessionId: 3,
    };
    expect(request.target).toEqual({ kind: 'track', trackId: 'track-1' });
    expect(request.liveSessionId).toBe(3);
  });

  it('a request may carry an Orchestra target', () => {
    const request: BlueLiveNoteTriggerRequest = {
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 2,
      source: 'hardware',
      target: { kind: 'orchestra', assignmentId: 'assign-2' },
      liveSessionId: 3,
    };
    expect(request.target).toEqual({ kind: 'orchestra', assignmentId: 'assign-2' });
  });

  it('a request may carry a channel target for explicit compatibility', () => {
    const request: BlueLiveNoteTriggerRequest = {
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 5,
      source: 'hardware',
      target: { kind: 'channel', channel: 5 },
    };
    expect(request.target).toEqual({ kind: 'channel', channel: 5 });
    expect(request.liveSessionId).toBeUndefined();
  });

  it('omitting target/liveSessionId is a valid legacy direct-channel request', () => {
    const request: BlueLiveNoteTriggerRequest = {
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
    };
    expect(request.target).toBeUndefined();
    expect(request.liveSessionId).toBeUndefined();
  });

  it('the target union is serializable (no functions or symbols)', () => {
    const targets: BlueLiveNoteTarget[] = [
      { kind: 'track', trackId: 't' },
      { kind: 'orchestra', assignmentId: 'a' },
      { kind: 'channel', channel: 0 },
    ];
    for (const target of targets) {
      const json = JSON.parse(JSON.stringify(target)) as BlueLiveNoteTarget;
      expect(json).toEqual(target);
    }
  });

  it('the trigger result remains a plain ok/message/submittedScoreText object', () => {
    const result: BlueLiveNoteTriggerResult = { ok: false, message: 'Unresolved MIDI target' };
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('the request preserves all source-identity fields alongside the target', () => {
    const request: BlueLiveNoteTriggerRequest = {
      type: 'noteOn',
      midiNote: 64,
      velocity: 80,
      channel: 1,
      source: 'hardware',
      sourceId: 'midi:device-1',
      deviceId: 'device-1',
      timestamp: 12345,
      target: { kind: 'track', trackId: 'track-7' },
      liveSessionId: 9,
    };
    expect(request.sourceId).toBe('midi:device-1');
    expect(request.deviceId).toBe('device-1');
    expect(request.timestamp).toBe(12345);
  });
});
