import { describe, expect, it } from 'vitest';
import {
  OSC_COMMAND_REGISTRY,
  OSC_DEFAULT_PREFERRED_PORT,
  createInitialOscServerRuntimeSnapshot,
  findOscCommand,
  findOscCommandById,
  isOscCommandEvent,
  isOscServerRuntimeSnapshot,
  isValidOscPort,
  normalizeOscServerPreferences,
} from './osc-control';

describe('OSC control shared contracts', () => {
  it('normalizes structured settings, legacy placeholders, and the Java default', () => {
    expect(normalizeOscServerPreferences({ preferredPort: 9000 }, 8000)).toEqual({ preferredPort: 9000 });
    expect(normalizeOscServerPreferences(undefined, 9001)).toEqual({ preferredPort: 9001 });
    expect(normalizeOscServerPreferences({ preferredPort: 0 }, 0)).toEqual({
      preferredPort: OSC_DEFAULT_PREFERRED_PORT,
    });
  });

  it('validates only whole UDP port numbers', () => {
    expect(isValidOscPort(1)).toBe(true);
    expect(isValidOscPort(65535)).toBe(true);
    expect(isValidOscPort(0)).toBe(false);
    expect(isValidOscPort(65536)).toBe(false);
    expect(isValidOscPort(8000.5)).toBe(false);
    expect(isValidOscPort('8000')).toBe(false);
  });

  it('keeps exactly the eight retained Java commands in ordered, displayable definitions', () => {
    expect(OSC_COMMAND_REGISTRY).toHaveLength(8);
    expect(OSC_COMMAND_REGISTRY.map((command) => command.addressPrefix)).toEqual([
      '/score/play',
      '/score/stop',
      '/score/rewind',
      '/score/markerNext',
      '/score/markerPrevious',
      '/blueLive/onOff',
      '/blueLive/recompile',
      '/blueLive/allNotesOff',
    ]);
    expect(OSC_COMMAND_REGISTRY.map((command) => command.category)).toEqual([
      'Score', 'Score', 'Score', 'Score', 'Score', 'Blue Live', 'Blue Live', 'Blue Live',
    ]);
    expect(OSC_COMMAND_REGISTRY.every((command) => command.description.length > 0)).toBe(true);
    expect(OSC_COMMAND_REGISTRY.every((command) => typeof command.execute === 'function')).toBe(true);
  });

  it('uses case-sensitive Java prefix matching and leaves the retired MIDI toggle unknown', () => {
    expect(findOscCommand('/score/play/alternate')?.id).toBe('score.play');
    expect(findOscCommand('/Score/play')).toBeNull();
    expect(findOscCommand('/blueLive/toggleMidiInput')).toBeNull();
    expect(findOscCommandById('blueLive.recompile')?.addressPrefix).toBe('/blueLive/recompile');
  });

  it('recognizes serializable runtime payloads', () => {
    const snapshot = createInitialOscServerRuntimeSnapshot({ preferredPort: 8000 });
    expect(isOscServerRuntimeSnapshot(snapshot)).toBe(true);
    expect(isOscCommandEvent({
      sequence: 1,
      commandId: 'score.play',
      receivedAddress: '/score/play',
      receivedAt: new Date().toISOString(),
    })).toBe(true);
  });
});
