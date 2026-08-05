import { create } from 'zustand';
import type { NoteProcessorEntrySnapshot } from '../../shared/project-editor';

interface NoteProcessorClipboardState {
  clipboard: NoteProcessorEntrySnapshot | null;
  setClipboard: (entry: NoteProcessorEntrySnapshot | null) => void;
  clearClipboard: () => void;
}

function cloneEntry(entry: NoteProcessorEntrySnapshot | null): NoteProcessorEntrySnapshot | null {
  return entry ? { ...entry, parameters: { ...entry.parameters } } : null;
}

export const useNoteProcessorClipboardStore = create<NoteProcessorClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (entry) => set({ clipboard: cloneEntry(entry) }),
  clearClipboard: () => set({ clipboard: null }),
}));
