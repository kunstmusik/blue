// @vitest-environment jsdom

import { vi } from 'vitest';

/**
 * Stub `window.blueAPI` so renderer code can import the MIDI surface without
 * loading Electron's preload. Tests extend this object as needed.
 */
const callbacks = new Map<string, Set<(payload: unknown) => void>>();

window.blueAPI = {
  initializeMidiInputService: vi.fn(async () => ({
    preferences: { devices: [] },
    cachedSnapshot: null,
  })),
  reportMidiInputServiceSnapshot: vi.fn(),
  acknowledgeMidiInputCommand: vi.fn(),
  onMidiInputServiceCommand: vi.fn((cb) => {
    const set = callbacks.get('command') ?? new Set();
    set.add(cb as (payload: unknown) => void);
    callbacks.set('command', set);
    return () => {
      set.delete(cb as (payload: unknown) => void);
    };
  }),
  getMidiInputServiceSnapshot: vi.fn(async () => null),
  requestMidiInputRescan: vi.fn(async () => ({ accepted: true })),
  onMidiInputServiceSnapshot: vi.fn((cb) => {
    const set = callbacks.get('snapshot') ?? new Set();
    set.add(cb as (payload: unknown) => void);
    callbacks.set('snapshot', set);
    return () => {
      set.delete(cb as (payload: unknown) => void);
    };
  }),
} as unknown as typeof window.blueAPI;
