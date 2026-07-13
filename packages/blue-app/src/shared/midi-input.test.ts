import { describe, expect, it } from 'vitest';
import {
  compareMidiInputDevicePreference,
  createDefaultMidiInputPreferences,
  getHardwareMidiSourceId,
  isValidMidiChannel,
  isValidMidiNote,
  isValidMidiVelocity,
  normalizeMidiInputPreferences,
  MIDI_INPUT_INITIALIZE_CHANNEL,
  MIDI_INPUT_PANEL_ID,
  MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
  MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
} from './midi-input';

describe('midi-input shared contract', () => {
  it('exposes stable IPC channel names', () => {
    expect(MIDI_INPUT_INITIALIZE_CHANNEL).toBe('midi-input:initialize-service');
    expect(MIDI_INPUT_SERVICE_COMMAND_CHANNEL).toBe('midi-input:service-command');
    expect(MIDI_INPUT_REQUEST_RESCAN_CHANNEL).toBe('midi-input:request-rescan');
  });

  it('default preferences are empty', () => {
    expect(createDefaultMidiInputPreferences()).toEqual({ devices: [] });
  });

  it('panel id is the documented constant', () => {
    expect(MIDI_INPUT_PANEL_ID).toBe('midi');
  });

  it('normalizes and deduplicates preferences by ID, dropping empty IDs', () => {
    const result = normalizeMidiInputPreferences({
      devices: [
        { id: 'b', name: 'B', manufacturer: 'M', version: '1', enabled: true },
        { id: 'a', name: 'A', manufacturer: '', version: '', enabled: false },
        { id: '', name: 'dropped', enabled: true },
        { id: 'a', name: 'A2', enabled: true },
      ],
    });
    expect(result.devices).toHaveLength(2);
    // Enabled first, then name.
    expect(result.devices[0]).toMatchObject({ id: 'a', enabled: true, name: 'A2' });
    expect(result.devices[1]).toMatchObject({ id: 'b', enabled: true });
  });

  it('preserves existing metadata when partial entries reappear in one call', () => {
    // Within a single normalize call, repeated IDs merge: last valid enabled
    // wins, but non-empty metadata from earlier partial entries is retained.
    const result = normalizeMidiInputPreferences({
      devices: [
        { id: 'a', name: 'A', manufacturer: 'M1', version: 'v1', enabled: true },
        { id: 'a', enabled: false },
      ],
    });
    expect(result.devices[0]?.enabled).toBe(false);
    expect(result.devices[0]?.name).toBe('A');
    expect(result.devices[0]?.manufacturer).toBe('M1');
    expect(result.devices[0]?.version).toBe('v1');
  });

  it('returns default when input is malformed', () => {
    expect(normalizeMidiInputPreferences(null)).toEqual({ devices: [] });
    expect(normalizeMidiInputPreferences({})).toEqual({ devices: [] });
    expect(normalizeMidiInputPreferences({ devices: 'nope' })).toEqual({
      devices: [],
    });
  });

  it('compareMidiInputDevicePreference orders enabled-first then name then id', () => {
    const list: Parameters<typeof compareMidiInputDevicePreference>[0][] = [
      { id: 'z', name: 'Zeta', manufacturer: '', version: '', enabled: false },
      { id: 'a', name: 'Alpha', manufacturer: '', version: '', enabled: true },
      { id: 'm', name: 'Mid', manufacturer: '', version: '', enabled: true },
    ];
    const sorted = [...list].sort(compareMidiInputDevicePreference);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'm', 'z']);
  });

  it('hardware source id is namespaced', () => {
    expect(getHardwareMidiSourceId('abc')).toBe('midi:abc');
  });

  it('range validators cover MIDI bounds', () => {
    expect(isValidMidiChannel(-1)).toBe(false);
    expect(isValidMidiChannel(0)).toBe(true);
    expect(isValidMidiChannel(15)).toBe(true);
    expect(isValidMidiChannel(16)).toBe(false);
    expect(isValidMidiChannel(1.5)).toBe(false);

    expect(isValidMidiNote(-1)).toBe(false);
    expect(isValidMidiNote(0)).toBe(true);
    expect(isValidMidiNote(127)).toBe(true);
    expect(isValidMidiNote(128)).toBe(false);

    expect(isValidMidiVelocity(0)).toBe(true);
    expect(isValidMidiVelocity(127)).toBe(true);
    expect(isValidMidiVelocity(200)).toBe(false);
  });
});
