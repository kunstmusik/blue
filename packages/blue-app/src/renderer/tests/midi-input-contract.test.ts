// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import './mock-blueapi';
import { MIDI_INPUT_INITIALIZE_CHANNEL } from '../../shared/midi-input';

describe('window.blueAPI MIDI input surface', () => {
  it('exposes the narrow methods required by SPEC 058', () => {
    expect(typeof window.blueAPI?.initializeMidiInputService).toBe('function');
    expect(typeof window.blueAPI?.reportMidiInputServiceSnapshot).toBe('function');
    expect(typeof window.blueAPI?.acknowledgeMidiInputCommand).toBe('function');
    expect(typeof window.blueAPI?.onMidiInputServiceCommand).toBe('function');
    expect(typeof window.blueAPI?.getMidiInputServiceSnapshot).toBe('function');
    expect(typeof window.blueAPI?.requestMidiInputRescan).toBe('function');
    expect(typeof window.blueAPI?.onMidiInputServiceSnapshot).toBe('function');
  });

  it('initialization channel name matches the documented constant', () => {
    expect(MIDI_INPUT_INITIALIZE_CHANNEL).toBe('midi-input:initialize-service');
  });

  it('onMidiInputServiceCommand returns an unsubscribe function', () => {
    const unsub = window.blueAPI!.onMidiInputServiceCommand(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('onMidiInputServiceSnapshot returns an unsubscribe function', () => {
    const unsub = window.blueAPI!.onMidiInputServiceSnapshot(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
