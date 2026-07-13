import { create } from 'zustand';
import type {
  MidiInputServiceSnapshot,
} from '../../shared/midi-input';
import {
  compareMidiInputDevicePreference,
  type MidiInputDevicePreference,
  type MidiInputDeviceRuntime,
  type MidiInputPreferences,
} from '../../shared/midi-input';

/**
 * Renderer-side snapshot of MIDI input service observation. Owned by the
 * primary renderer; observer windows (Settings) receive cached snapshots
 * from main via the IPC snapshot-changed channel.
 *
 * Consumers must treat the snapshot as read-only. Enabled checkbox values in
 * the Settings draft come from `draftMidiInput` so unsaved edits remain
 * distinguishable from applied runtime state.
 */
interface MidiInputStoreState {
  /** Latest reported runtime snapshot (applied state). */
  snapshot: MidiInputServiceSnapshot | null;
  /** Settings draft that mirrors the current Settings UI editable state. */
  draftMidiInput: MidiInputPreferences;
  /** True when the draft differs from the most recently saved preferences. */
  draftDirty: boolean;
  /** Saved preferences echo so we can compute dirty state on Apply. */
  savedMidiInput: MidiInputPreferences;

  setSnapshot: (snapshot: MidiInputServiceSnapshot | null) => void;
  setSavedPreferences: (preferences: MidiInputPreferences) => void;
  beginDraftFromSaved: () => void;
  updateDraftDevice: (id: string, patch: Partial<MidiInputDevicePreference>) => void;
  setDraftDeviceEnabled: (id: string, enabled: boolean) => void;
  /**
   * Upsert a device into the draft from runtime observation. Used when the
   * user toggles enable on a device that was discovered live but had no
   * saved preference yet. Existing metadata is preserved unless the runtime
   * supplies fresher non-empty values.
   */
  upsertDraftDeviceFromRuntime: (
    runtime: Pick<MidiInputDeviceRuntime, 'id' | 'name' | 'manufacturer' | 'version'>,
    patch: Partial<MidiInputDevicePreference>,
  ) => void;
  resetDraftToSaved: () => void;
  reset: () => void;
}

function sortDevices(devices: MidiInputDevicePreference[]): MidiInputDevicePreference[] {
  return [...devices].sort(compareMidiInputDevicePreference);
}

function defaultRuntimeDevices(): MidiInputDeviceRuntime[] {
  return [];
}

export const useMidiInputStore = create<MidiInputStoreState>((set, get) => ({
  snapshot: null,
  draftMidiInput: { devices: [] },
  draftDirty: false,
  savedMidiInput: { devices: [] },

  setSnapshot: (snapshot) => {
    set({ snapshot });
  },

  setSavedPreferences: (preferences) => {
    const devices = sortDevices(preferences.devices);
    set({
      savedMidiInput: { devices },
      draftMidiInput: { devices: devices.map(cloneDevice) },
      draftDirty: false,
    });
  },

  beginDraftFromSaved: () => {
    const saved = get().savedMidiInput;
    set({
      draftMidiInput: { devices: saved.devices.map(cloneDevice) },
      draftDirty: false,
    });
  },

  updateDraftDevice: (id, patch) => {
    const current = get().draftMidiInput;
    const devices = current.devices.map((d) =>
      d.id === id ? { ...d, ...patch } : d,
    );
    set({
      draftMidiInput: { devices: sortDevices(devices) },
      draftDirty: true,
    });
  },

  setDraftDeviceEnabled: (id, enabled) => {
    get().updateDraftDevice(id, { enabled });
  },

  upsertDraftDeviceFromRuntime: (runtime, patch) => {
    const current = get().draftMidiInput;
    const existing = current.devices.find((d) => d.id === runtime.id);
    const merged: MidiInputDevicePreference = existing
      ? {
          ...existing,
          name: existing.name || runtime.name,
          manufacturer: existing.manufacturer || runtime.manufacturer,
          version: existing.version || runtime.version,
          ...patch,
        }
      : {
          id: runtime.id,
          name: runtime.name,
          manufacturer: runtime.manufacturer,
          version: runtime.version,
          enabled: false,
          ...patch,
        };
    const devices = existing
      ? current.devices.map((d) => (d.id === runtime.id ? merged : d))
      : [...current.devices, merged];
    set({
      draftMidiInput: { devices: sortDevices(devices) },
      draftDirty: true,
    });
  },

  resetDraftToSaved: () => {
    const saved = get().savedMidiInput;
    set({
      draftMidiInput: { devices: saved.devices.map(cloneDevice) },
      draftDirty: false,
    });
  },

  reset: () => {
    set({
      snapshot: null,
      draftMidiInput: { devices: [] },
      draftDirty: false,
      savedMidiInput: { devices: [] },
    });
  },
}));

function cloneDevice(d: MidiInputDevicePreference): MidiInputDevicePreference {
  return { ...d };
}

// Helper exported for tests / diagnostic callers.
export { defaultRuntimeDevices };
