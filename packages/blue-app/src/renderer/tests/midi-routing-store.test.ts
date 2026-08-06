import { describe, expect, it, beforeEach } from 'vitest';
import {
  useMidiRoutingStore,
  type MidiRoutingReconciliation,
} from '../stores/midi-routing-store';

describe('MIDI routing focus store', () => {
  beforeEach(() => {
    // Reset to defaults before each test.
    useMidiRoutingStore.setState({
      mode: 'focus',
      focusedTarget: null,
      focusRevision: 0,
    });
  });

  it('defaults to focus mode with no focused target', () => {
    const state = useMidiRoutingStore.getState();
    expect(state.mode).toBe('focus');
    expect(state.focusedTarget).toBeNull();
    expect(state.focusRevision).toBe(0);
  });

  it('publishes no diagnostic/error state', () => {
    const state = useMidiRoutingStore.getState();
    expect(state).not.toHaveProperty('error');
    expect(state).not.toHaveProperty('message');
    expect(state).not.toHaveProperty('lastFailure');
  });

  describe('explicit focus', () => {
    it('focuses a Track and replaces a previous Orchestra focus atomically', () => {
      useMidiRoutingStore.getState().focusOrchestra({
        projectSessionId: 1,
        assignmentId: 'assign-1',
        displayName: 'Pad',
      });
      expect(useMidiRoutingStore.getState().focusedTarget).toMatchObject({
        kind: 'orchestra',
        assignmentId: 'assign-1',
      });

      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      const state = useMidiRoutingStore.getState();
      expect(state.focusedTarget).toMatchObject({
        kind: 'track',
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      expect(state.focusRevision).toBeGreaterThan(0);
    });

    it('focusing retains the current mode (does not force focus mode)', () => {
      useMidiRoutingStore.getState().setMode('channel');
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      // Focus is stored but mode stays channel; routing ignores focus until switched.
      expect(useMidiRoutingStore.getState().mode).toBe('channel');
      expect(useMidiRoutingStore.getState().focusedTarget?.kind).toBe('track');
    });
  });

  describe('mode changes', () => {
    it('switches to channel mode and back without dropping focus metadata', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      useMidiRoutingStore.getState().setMode('channel');
      expect(useMidiRoutingStore.getState().focusedTarget?.kind).toBe('track');
      useMidiRoutingStore.getState().setMode('focus');
      expect(useMidiRoutingStore.getState().focusedTarget?.trackId).toBe('track-1');
    });
  });

  describe('target resolution', () => {
    it('resolves focus mode with no target to null (fail closed)', () => {
      expect(useMidiRoutingStore.getState().resolveTargetForNote(0)).toBeNull();
    });

    it('resolves a focused Track target without a channel assignment', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-7',
        displayName: 'Lead',
      });
      const target = useMidiRoutingStore.getState().resolveTargetForNote(3);
      expect(target).toEqual({ kind: 'track', trackId: 'track-7' });
    });

    it('resolves a focused Orchestra target by assignment id', () => {
      useMidiRoutingStore.getState().focusOrchestra({
        projectSessionId: 1,
        assignmentId: 'assign-2',
        displayName: 'Pad',
      });
      const target = useMidiRoutingStore.getState().resolveTargetForNote(5);
      expect(target).toEqual({ kind: 'orchestra', assignmentId: 'assign-2' });
    });

    it('resolves channel mode to the event channel regardless of focus', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      useMidiRoutingStore.getState().setMode('channel');
      expect(useMidiRoutingStore.getState().resolveTargetForNote(4)).toEqual({
        kind: 'channel',
        channel: 4,
      });
    });
  });

  describe('reconciliation', () => {
    it('refreshes display metadata while keeping stable identity', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Old',
      });
      const reconciliation: MidiRoutingReconciliation = {
        projectSessionId: 1,
        tracks: [
          {
            projectSessionId: 1,
            rootGroupId: 'root',
            trackId: 'track-1',
            displayName: 'New Name',
          },
        ],
        orchestra: [],
      };
      useMidiRoutingStore.getState().reconcileFocus(reconciliation);
      const focused = useMidiRoutingStore.getState().focusedTarget;
      expect(focused).toMatchObject({
        kind: 'track',
        trackId: 'track-1',
        displayName: 'New Name',
      });
    });

    it('clears focus whose Track identity is missing from the snapshot', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'gone',
        displayName: 'Gone',
      });
      useMidiRoutingStore.getState().reconcileFocus({
        projectSessionId: 1,
        tracks: [],
        orchestra: [],
      });
      expect(useMidiRoutingStore.getState().focusedTarget).toBeNull();
    });

    it('clears focus on session mismatch (project replacement)', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      useMidiRoutingStore.getState().reconcileFocus({
        projectSessionId: 2,
        tracks: [
          {
            projectSessionId: 2,
            rootGroupId: 'root',
            trackId: 'track-1',
            displayName: 'Bass',
          },
        ],
        orchestra: [],
      });
      expect(useMidiRoutingStore.getState().focusedTarget).toBeNull();
    });
  });

  describe('project-session clearing', () => {
    it('clears focus for the matching project session', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      useMidiRoutingStore.getState().clearFocusForProjectSession(1);
      expect(useMidiRoutingStore.getState().focusedTarget).toBeNull();
    });

    it('does not clear focus for a different project session', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      useMidiRoutingStore.getState().clearFocusForProjectSession(2);
      expect(useMidiRoutingStore.getState().focusedTarget?.trackId).toBe('track-1');
    });
  });

  describe('Blue Live restart retention', () => {
    it('retains focus across a Blue Live restart reconciliation of the same session', () => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'root',
        trackId: 'track-1',
        displayName: 'Bass',
      });
      // Blue Live restart: reconcile against the same project session and identity.
      useMidiRoutingStore.getState().reconcileFocus({
        projectSessionId: 1,
        tracks: [
          {
            projectSessionId: 1,
            rootGroupId: 'root',
            trackId: 'track-1',
            displayName: 'Bass',
          },
        ],
        orchestra: [],
      });
      expect(useMidiRoutingStore.getState().focusedTarget?.trackId).toBe('track-1');
    });
  });
});
