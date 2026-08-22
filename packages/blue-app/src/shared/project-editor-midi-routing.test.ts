import { describe, expect, it } from 'vitest';
import type { BlueLiveNoteTarget, BlueLiveNoteTriggerRequest } from './project-editor';
import {
  MAX_BLUE_LIVE_TARGET_ID_LENGTH,
  blueLiveTargetIdentityKey,
  blueLiveTargetKey,
  isBoundedTargetIdentity,
  isNonnegativeInteger,
} from './midi-input';

describe('Blue Live note target shared contract', () => {
  describe('BlueLiveNoteTarget union', () => {
    it('supports a Track target', () => {
      const target: BlueLiveNoteTarget = { kind: 'track', trackId: 'track-1' };
      expect(target.kind).toBe('track');
      expect(target).toMatchObject({ trackId: 'track-1' });
    });

    it('supports an Orchestra target', () => {
      const target: BlueLiveNoteTarget = {
        kind: 'orchestra',
        assignmentId: 'assign-2',
      };
      expect(target.kind).toBe('orchestra');
      expect(target).toMatchObject({ assignmentId: 'assign-2' });
    });

    it('supports a channel target', () => {
      const target: BlueLiveNoteTarget = { kind: 'channel', channel: 3 };
      expect(target.kind).toBe('channel');
      expect((target as { channel: number }).channel).toBe(3);
    });
  });

  describe('omitted-target compatibility', () => {
    it('a request without target or liveSessionId is a valid legacy direct-channel request', () => {
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

    it('a request may carry a focus target and a nonnegative session fence', () => {
      const request: BlueLiveNoteTriggerRequest = {
        type: 'noteOn',
        midiNote: 60,
        velocity: 100,
        channel: 0,
        source: 'mouse',
        target: { kind: 'track', trackId: 'track-1' },
        liveSessionId: 7,
      };
      expect(request.target?.kind).toBe('track');
      expect(request.liveSessionId).toBe(7);
    });
  });

  describe('bounded non-empty identity validation', () => {
    it('accepts a non-empty bounded string identity', () => {
      expect(isBoundedTargetIdentity('track-1')).toBe(true);
      expect(isBoundedTargetIdentity('a'.repeat(MAX_BLUE_LIVE_TARGET_ID_LENGTH))).toBe(true);
    });

    it('rejects empty, over-long, and non-string identities', () => {
      expect(isBoundedTargetIdentity('')).toBe(false);
      expect(isBoundedTargetIdentity('a'.repeat(MAX_BLUE_LIVE_TARGET_ID_LENGTH + 1))).toBe(false);
      expect(isBoundedTargetIdentity(null)).toBe(false);
      expect(isBoundedTargetIdentity(undefined)).toBe(false);
      expect(isBoundedTargetIdentity(123)).toBe(false);
    });

    it('accepts whitespace-only strings of bounded length (callers trim)', () => {
      expect(isBoundedTargetIdentity('   ')).toBe(true);
    });
  });

  describe('liveSessionId validation', () => {
    it('accepts nonnegative integers', () => {
      expect(isNonnegativeInteger(0)).toBe(true);
      expect(isNonnegativeInteger(1)).toBe(true);
      expect(isNonnegativeInteger(42)).toBe(true);
    });

    it('rejects negative, fractional, and non-number values', () => {
      expect(isNonnegativeInteger(-1)).toBe(false);
      expect(isNonnegativeInteger(1.5)).toBe(false);
      expect(isNonnegativeInteger(Number.NaN)).toBe(false);
      expect(isNonnegativeInteger('7')).toBe(false);
      expect(isNonnegativeInteger(null)).toBe(false);
      expect(isNonnegativeInteger(undefined)).toBe(false);
    });
  });

  describe('channel target agreement', () => {
    it('a channel target that matches the request channel is consistent', () => {
      const request: BlueLiveNoteTriggerRequest = {
        type: 'noteOn',
        midiNote: 60,
        velocity: 100,
        channel: 5,
        source: 'hardware',
        target: { kind: 'channel', channel: 5 },
      };
      expect(
        request.target?.kind === 'channel' && request.target.channel === request.channel,
      ).toBe(true);
    });

    it('a channel target that disagrees with the request channel is malformed', () => {
      const request: BlueLiveNoteTriggerRequest = {
        type: 'noteOn',
        midiNote: 60,
        velocity: 100,
        channel: 5,
        source: 'hardware',
        target: { kind: 'channel', channel: 6 },
      };
      const disagree =
        request.target?.kind === 'channel' && request.target.channel !== request.channel;
      expect(disagree).toBe(true);
    });
  });

  describe('collision-safe target keys', () => {
    it('encodes the kind so a track and orchestra cannot collide', () => {
      const trackKey = blueLiveTargetIdentityKey({ kind: 'track', trackId: 'shared' });
      const orchKey = blueLiveTargetIdentityKey({
        kind: 'orchestra',
        assignmentId: 'shared',
      });
      const chanKey = blueLiveTargetIdentityKey({ kind: 'channel', channel: 1 });
      expect(trackKey).not.toBe(orchKey);
      expect(trackKey).not.toBe(chanKey);
      expect(orchKey).not.toBe(chanKey);
    });

    it('survives user-controlled ids that contain separator-like characters', () => {
      const tricky = 'evil\u0000orchestra\u0000other';
      const trackKey = blueLiveTargetIdentityKey({ kind: 'track', trackId: tricky });
      const orchKey = blueLiveTargetIdentityKey({
        kind: 'orchestra',
        assignmentId: 'other',
      });
      expect(trackKey).not.toBe(orchKey);
      // The track kind prefix still wins even with a crafted id.
      expect(trackKey.startsWith('track\u0000')).toBe(true);
    });

    it('includes the MIDI note in the aggregate key but not the identity key', () => {
      const identity = blueLiveTargetIdentityKey({ kind: 'track', trackId: 't1' });
      const agg60 = blueLiveTargetKey({ kind: 'track', trackId: 't1' }, 60);
      const agg61 = blueLiveTargetKey({ kind: 'track', trackId: 't1' }, 61);
      expect(agg60).not.toBe(agg61);
      expect(agg60.startsWith(identity)).toBe(true);
      expect(agg61.startsWith(identity)).toBe(true);
    });

    it('keeps equal pitch on different targets independent', () => {
      const a = blueLiveTargetKey({ kind: 'track', trackId: 't1' }, 60);
      const b = blueLiveTargetKey({ kind: 'track', trackId: 't2' }, 60);
      expect(a).not.toBe(b);
    });
  });
});
