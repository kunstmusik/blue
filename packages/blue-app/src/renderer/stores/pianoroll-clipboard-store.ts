import { create } from 'zustand';

export interface PianoRollNoteClipboardEntry {
  octave: number;
  scaleDegree: number;
  start: number;
  duration: number;
  fieldValues: number[];
  noteTemplate: string | null;
}

export interface PianoRollClipboard {
  notes: PianoRollNoteClipboardEntry[];
  sourceStartBeats: number;
  sourceScaleDegrees: number[];
  sourcePitchIndex?: number;
}

interface PianoRollClipboardState {
  clipboard: PianoRollClipboard | null;
  setClipboard: (clipboard: PianoRollClipboard | null) => void;
  clearClipboard: () => void;
}

function cloneClipboard(clipboard: PianoRollClipboard | null): PianoRollClipboard | null {
  if (!clipboard) {
    return null;
  }

  return {
    sourceStartBeats: clipboard.sourceStartBeats,
    sourceScaleDegrees: [...clipboard.sourceScaleDegrees],
    sourcePitchIndex: clipboard.sourcePitchIndex,
    notes: clipboard.notes.map((note) => ({
      octave: note.octave,
      scaleDegree: note.scaleDegree,
      start: note.start,
      duration: note.duration,
      fieldValues: [...note.fieldValues],
      noteTemplate: note.noteTemplate,
    })),
  };
}

export const usePianoRollClipboardStore = create<PianoRollClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) => set({ clipboard: cloneClipboard(clipboard) }),
  clearClipboard: () => set({ clipboard: null }),
}));
