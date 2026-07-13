// @vitest-environment jsdom

import React, { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiNoteRouter } from '../services/midi-note-router';
import { useMidiInputStore } from '../stores/midi-input-store';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useProjectStore } from '../stores/project-store';
import {
  routeVirtualKeyboardNote,
  useMidiInputService,
} from '../hooks/use-midi-input-service';
import { FakeMidiAccess } from './helpers/fake-midi-access';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function MidiInputHost(): null {
  useMidiInputService();
  return null;
}

function renderHost(strict = false): { root: Root; container: HTMLDivElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(strict ? <StrictMode><MidiInputHost /></StrictMode> : <MidiInputHost />);
  });
  return { root, container };
}

function installMidiApi(
  initialize: () => Promise<{ preferences: { devices: [] }; cachedSnapshot: null }>,
): {
  onCommand: ReturnType<typeof vi.fn>;
  trigger: ReturnType<typeof vi.fn>;
  allNotesOff: ReturnType<typeof vi.fn>;
  unsubscriptions: Array<ReturnType<typeof vi.fn>>;
} {
  const unsubscriptions: Array<ReturnType<typeof vi.fn>> = [];
  const onCommand = vi.fn(() => {
    const unsubscribe = vi.fn();
    unsubscriptions.push(unsubscribe);
    return unsubscribe;
  });
  const trigger = vi.fn(async () => ({ ok: true }));
  const allNotesOff = vi.fn(async () => ({ ok: true }));
  window.blueAPI = {
    initializeMidiInputService: vi.fn(initialize),
    onMidiInputServiceCommand: onCommand,
    reportMidiInputServiceSnapshot: vi.fn(),
    acknowledgeMidiInputCommand: vi.fn(),
    triggerBlueLiveNote: trigger,
    sendBlueLiveAllNotesOff: allNotesOff,
  } as unknown as typeof window.blueAPI;
  return { onCommand, trigger, allNotesOff, unsubscriptions };
}

describe('MIDI service hook lifecycle', () => {
  const originalBlueAPI = window.blueAPI;
  const originalRequestMidiAccess = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess');

  beforeEach(() => {
    useMidiInputStore.getState().reset();
    useBlueLiveStore.getState().reset();
    useProjectStore.getState().clearProject();
    const access = new FakeMidiAccess();
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(async () => access),
    });
  });

  afterEach(() => {
    window.blueAPI = originalBlueAPI;
    if (originalRequestMidiAccess) {
      Object.defineProperty(navigator, 'requestMIDIAccess', originalRequestMidiAccess);
    } else {
      Reflect.deleteProperty(navigator, 'requestMIDIAccess');
    }
  });

  it('does not install a stale command subscription after StrictMode cleanup', async () => {
    let resolveFirst: ((value: { preferences: { devices: [] }; cachedSnapshot: null }) => void) | null = null;
    const first = new Promise<{ preferences: { devices: [] }; cachedSnapshot: null }>((resolve) => {
      resolveFirst = resolve;
    });
    const initialize = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue({ preferences: { devices: [] }, cachedSnapshot: null });
    const { onCommand, unsubscriptions } = installMidiApi(initialize);
    const { root, container } = renderHost(true);

    await act(async () => { await Promise.resolve(); });
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect((navigator as Navigator & { requestMIDIAccess: ReturnType<typeof vi.fn> }).requestMIDIAccess)
      .toHaveBeenCalledWith({ sysex: false });

    await act(async () => {
      resolveFirst?.({ preferences: { devices: [] }, cachedSnapshot: null });
      await first;
    });
    expect(onCommand).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    expect(unsubscriptions).toHaveLength(1);
    expect(unsubscriptions[0]).toHaveBeenCalledTimes(1);
    container.remove();
  });

  it('clears held notes across Blue Live stop and project replacement', async () => {
    const { trigger, allNotesOff } = installMidiApi(async () => ({
      preferences: { devices: [] },
      cachedSnapshot: null,
    }));
    useProjectStore.setState({ loaded: true, sessionId: 1 });
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });
    const { root, container } = renderHost();
    await act(async () => { await Promise.resolve(); });

    await routeVirtualKeyboardNote({ type: 'noteOn', source: 'mouse', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    useBlueLiveStore.getState().setStatusFromSnapshot({ status: 'idle', running: false, sessionId: 1 });
    await act(async () => { await Promise.resolve(); });
    expect(allNotesOff).toHaveBeenCalledTimes(1);

    useBlueLiveStore.getState().setStatusFromSnapshot({ status: 'running', running: true, sessionId: 2 });
    await routeVirtualKeyboardNote({ type: 'noteOn', source: 'mouse', channel: 0, midiNote: 60, velocity: 100, timestamp: 1 });
    useProjectStore.setState({ sessionId: 2 });
    await act(async () => { await Promise.resolve(); });
    expect(allNotesOff).toHaveBeenCalledTimes(2);

    await routeVirtualKeyboardNote({ type: 'noteOn', source: 'mouse', channel: 0, midiNote: 60, velocity: 100, timestamp: 2 });
    expect(trigger.mock.calls.filter(([request]) => request.type === 'noteOn')).toHaveLength(3);

    act(() => root.unmount());
    container.remove();
  });
});

describe('MIDI session cleanup invariants', () => {
  it('releaseAll clears every held note and emits an engine all-notes-off', async () => {
    const allOff = vi.fn(async () => ({ ok: true }));
    const router = new MidiNoteRouter({
      trigger: async () => ({ ok: true }),
      allNotesOff: allOff,
      isLiveActive: () => true,
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.routeNote({ type: 'noteOn', sourceKind: 'mouse', sourceId: 'virtual-keyboard:mouse:mouse', deviceId: null, channel: 0, midiNote: 64, velocity: 100, timestamp: 0 });

    await router.releaseAll();

    expect(allOff).toHaveBeenCalledTimes(1);
    expect(router.heldCount).toBe(0);
    expect(router.aggregateHeldCount).toBe(0);
  });

  it('repeated releaseAll is idempotent (no extra all-notes-off calls)', async () => {
    const allOff = vi.fn(async () => ({ ok: true }));
    const router = new MidiNoteRouter({
      trigger: async () => ({ ok: true }),
      allNotesOff: allOff,
      isLiveActive: () => true,
    });
    await router.routeNote({ type: 'noteOn', sourceKind: 'hardware', sourceId: 'midi:a', deviceId: 'a', channel: 0, midiNote: 60, velocity: 100, timestamp: 0 });
    await router.releaseAll();
    await router.releaseAll();
    await router.releaseAll();
    expect(allOff).toHaveBeenCalledTimes(1);
  });

  it('clears the ledger across 100 repeated note and cleanup cycles', async () => {
    const allOff = vi.fn(async () => ({ ok: true }));
    const router = new MidiNoteRouter({
      trigger: async () => ({ ok: true }),
      allNotesOff: allOff,
      isLiveActive: () => true,
    });

    for (let cycle = 0; cycle < 100; cycle += 1) {
      await router.routeNote({
        type: 'noteOn',
        sourceKind: 'hardware',
        sourceId: 'midi:a',
        deviceId: 'a',
        channel: cycle % 16,
        midiNote: 36 + (cycle % 48),
        velocity: 100,
        timestamp: cycle,
      });
      await router.releaseAll();
      expect(router.heldCount).toBe(0);
      expect(router.aggregateHeldCount).toBe(0);
    }

    expect(allOff).toHaveBeenCalledTimes(100);
  });

  it('releaseSource on a never-heard source is a no-op', async () => {
    const trigger = vi.fn(async () => ({ ok: true }));
    const router = new MidiNoteRouter({
      trigger,
      allNotesOff: async () => ({ ok: true }),
      isLiveActive: () => true,
    });
    await router.releaseSource('midi:never');
    expect(trigger).not.toHaveBeenCalled();
  });
});

describe('MIDI store', () => {
  beforeEach(() => {
    useMidiInputStore.getState().reset();
    useBlueLiveStore.getState().reset();
    useProjectStore.getState().clearProject();
  });

  it('preserves the latest snapshot revision and clears on reset', () => {
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'a',
      revision: 42,
      phase: 'ready',
      devices: [],
      message: null,
      updatedAt: 0,
    });
    expect(useMidiInputStore.getState().snapshot?.revision).toBe(42);
    useMidiInputStore.getState().reset();
    expect(useMidiInputStore.getState().snapshot).toBeNull();
  });

  it('setSavedPreferences mirrors saved into draft and clears dirty', () => {
    useMidiInputStore.getState().setSavedPreferences({
      devices: [
        { id: 'a', name: 'A', manufacturer: '', version: '', enabled: true },
      ],
    });
    expect(useMidiInputStore.getState().draftMidiInput.devices).toHaveLength(1);
    expect(useMidiInputStore.getState().draftDirty).toBe(false);
  });

  it('toggling a draft device marks the store dirty', () => {
    useMidiInputStore.getState().setSavedPreferences({
      devices: [{ id: 'a', name: 'A', manufacturer: '', version: '', enabled: true }],
    });
    useMidiInputStore.getState().setDraftDeviceEnabled('a', false);
    expect(useMidiInputStore.getState().draftMidiInput.devices[0]?.enabled).toBe(false);
    expect(useMidiInputStore.getState().draftDirty).toBe(true);
  });
});
