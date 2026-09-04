import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore } from '../stores/settings-store';

const localStorageStore: Record<string, string> = {};

vi.mock('../stores/settings-store', async () => {
  const actual = await vi.importActual<any>('../stores/settings-store');
  return actual;
});

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore[key] = value;
    },
    removeItem: (key: string) => {
      delete localStorageStore[key];
    },
    clear: () => {
      Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
    },
    get length() {
      return Object.keys(localStorageStore).length;
    },
    key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings store (T066)', () => {
  it('has default enginePath', () => {
    const state = useSettingsStore.getState();
    expect(state.enginePath).toBe('blue-engine');
  });

  it('setEnginePath updates value', () => {
    useSettingsStore.getState().setEnginePath('/usr/local/bin/csound');
    expect(useSettingsStore.getState().enginePath).toBe('/usr/local/bin/csound');
  });

  it('has default MIDI/OSC fields', () => {
    const state = useSettingsStore.getState();
    expect(state.midiInputDevice).toBe('');
    expect(state.midiOutputDevice).toBe('');
    expect(state.oscInputPort).toBe(0);
    expect(state.oscOutputPort).toBe(0);
    expect(state.oscOutputHost).toBe('localhost');
  });

  it('setMidiInputDevice updates value', () => {
    useSettingsStore.getState().setMidiInputDevice('MIDI Device 1');
    expect(useSettingsStore.getState().midiInputDevice).toBe('MIDI Device 1');
  });

  it('setOscOutputHost updates value', () => {
    useSettingsStore.getState().setOscOutputHost('192.168.1.100');
    expect(useSettingsStore.getState().oscOutputHost).toBe('192.168.1.100');
  });

  it('addRecentFile adds and deduplicates', () => {
    useSettingsStore.getState().addRecentFile('/a.blue');
    useSettingsStore.getState().addRecentFile('/b.blue');
    useSettingsStore.getState().addRecentFile('/a.blue');
    const files = useSettingsStore.getState().recentFiles;
    expect(files[0]).toBe('/a.blue');
    expect(files.filter((f: string) => f === '/a.blue')).toHaveLength(1);
  });

  it('removeRecentFile removes the file', () => {
    useSettingsStore.getState().addRecentFile('/c.blue');
    useSettingsStore.getState().removeRecentFile('/c.blue');
    expect(useSettingsStore.getState().recentFiles).not.toContain('/c.blue');
  });
});
