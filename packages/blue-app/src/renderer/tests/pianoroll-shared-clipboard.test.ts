import { beforeEach, describe, expect, it } from 'vitest';

import { usePianoRollClipboardStore } from '../stores/pianoroll-clipboard-store';

describe('shared Piano Roll clipboard', () => {
  beforeEach(() => usePianoRollClipboardStore.getState().clearClipboard());

  it('exposes one detached note payload to every Piano Roll editor subscriber', () => {
    const source = {
      notes: [{
        octave: 8,
        scaleDegree: 0,
        start: 1,
        duration: 2,
        fieldValues: [0.5, 440],
      }],
      sourceStartBeats: 1,
      sourceScaleDegrees: [56],
      sourcePitchIndex: 0,
    };

    usePianoRollClipboardStore.getState().setClipboard(source);
    source.notes[0]!.fieldValues[0] = 1;
    source.sourceScaleDegrees[0] = 99;

    const targetEditorView = usePianoRollClipboardStore.getState().clipboard;
    expect(targetEditorView).toEqual({
      notes: [{
        octave: 8,
        scaleDegree: 0,
        start: 1,
        duration: 2,
        fieldValues: [0.5, 440],
      }],
      sourceStartBeats: 1,
      sourceScaleDegrees: [56],
      sourcePitchIndex: 0,
    });
  });
});
