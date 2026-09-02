import { useRef, useState } from 'react';
import { clamp } from '@blue/data';

export type VirtualKeyboardPressSource = 'mouse' | 'computer';

export interface VirtualKeyboardPressedNote {
  midiNote: number;
  source: VirtualKeyboardPressSource;
}

export interface VirtualKeyboardState {
  channel: number;
  octave: number;
  velocity: number;
  velocityOverride: boolean;
  isFocused: boolean;
  pressedNotes: VirtualKeyboardPressedNote[];
  setChannel: (channel: number) => void;
  setOctave: (octave: number) => void;
  setVelocity: (velocity: number) => void;
  setVelocityOverride: (enabled: boolean) => void;
  setFocused: (focused: boolean) => void;
  hasPressedNote: (midiNote: number, source?: VirtualKeyboardPressSource) => boolean;
  pressNote: (midiNote: number, source: VirtualKeyboardPressSource) => boolean;
  releaseNote: (midiNote: number, source: VirtualKeyboardPressSource) => boolean;
  clearPressedNotes: () => void;
}

function clampMidiValue(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return clamp(Math.trunc(value), minimum, maximum);
}

export function useVirtualKeyboardState(): VirtualKeyboardState {
  const [channel, setChannelState] = useState(0);
  const [octave, setOctaveState] = useState(5);
  const [velocity, setVelocityState] = useState(127);
  const [velocityOverride, setVelocityOverrideState] = useState(false);
  const [isFocused, setFocusedState] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<VirtualKeyboardPressedNote[]>([]);
  const pressedNotesMapRef = useRef<Map<number, Set<VirtualKeyboardPressSource>>>(new Map());

  const syncPressedNotes = () => {
    const nextNotes: VirtualKeyboardPressedNote[] = [];
    for (const [midiNote, sources] of pressedNotesMapRef.current.entries()) {
      for (const source of sources) {
        nextNotes.push({ midiNote, source });
      }
    }
    nextNotes.sort((a, b) => a.midiNote - b.midiNote || a.source.localeCompare(b.source));
    setPressedNotes(nextNotes);
  };

  const setChannel = (nextChannel: number) => {
    setChannelState(clampMidiValue(nextChannel, 0, 15));
  };

  const setOctave = (nextOctave: number) => {
    setOctaveState(clampMidiValue(nextOctave, 0, 7));
  };

  const setVelocity = (nextVelocity: number) => {
    setVelocityState(clampMidiValue(nextVelocity, 0, 127));
  };

  const pressNote = (midiNote: number, source: VirtualKeyboardPressSource) => {
    const note = clampMidiValue(midiNote, 0, 127);
    const existing = pressedNotesMapRef.current.get(note);
    if (existing?.has(source)) {
      return false;
    }

    const nextSources = existing ?? new Set<VirtualKeyboardPressSource>();
    nextSources.add(source);
    pressedNotesMapRef.current.set(note, nextSources);
    syncPressedNotes();
    return true;
  };

  const releaseNote = (midiNote: number, source: VirtualKeyboardPressSource) => {
    const note = clampMidiValue(midiNote, 0, 127);
    const existing = pressedNotesMapRef.current.get(note);
    if (!existing?.has(source)) {
      return false;
    }

    existing.delete(source);
    if (existing.size === 0) {
      pressedNotesMapRef.current.delete(note);
    }
    syncPressedNotes();
    return true;
  };

  const clearPressedNotes = () => {
    pressedNotesMapRef.current.clear();
    setPressedNotes([]);
  };

  const hasPressedNote = (midiNote: number, source?: VirtualKeyboardPressSource) => {
    const note = clampMidiValue(midiNote, 0, 127);
    const existing = pressedNotesMapRef.current.get(note);
    if (!existing) {
      return false;
    }

    return source ? existing.has(source) : existing.size > 0;
  };

  return {
    channel,
    octave,
    velocity,
    velocityOverride,
    isFocused,
    pressedNotes,
    setChannel,
    setOctave,
    setVelocity,
    setVelocityOverride: setVelocityOverrideState,
    setFocused: setFocusedState,
    hasPressedNote,
    pressNote,
    releaseNote,
    clearPressedNotes,
  };
}
