import { describe, expect, it } from 'vitest';
import {
  applyPianoRollPatchToPayload,
  buildPianoRollRestorePatch,
  CENTER_OCTAVE,
  type FieldDefSnapshot,
  GENERATE_FREQUENCY,
  GENERATE_MIDI,
  GENERATE_PCH,
  type PianoRollPayload,
  formatPianoRollPitch,
} from '../components/workbench/panels/score-object/editors/pianoroll/types';
import {
  NoteCanvasMouseListener,
  type NoteCanvasListenerCallbacks,
} from '../components/workbench/panels/score-object/editors/pianoroll/NoteCanvasMouseListener';

function createFieldDefinition(overrides: Partial<FieldDefSnapshot> = {}): FieldDefSnapshot {
  return {
    fieldName: 'AMP',
    fieldType: 'CONTINUOUS',
    minValue: 0,
    maxValue: 1,
    defaultValue: 0.5,
    ...overrides,
  };
}

function createPayload(overrides: Partial<PianoRollPayload> = {}): PianoRollPayload {
  return {
    instrumentId: '1',
    noteTemplate: 'i <INSTR_ID> <START> <DUR> <FREQ> <AMP>',
    pchGenerationMethod: GENERATE_MIDI,
    transposition: 0,
    pixelSecond: 40,
    noteHeight: 10,
    snapEnabled: false,
    snapValue: 'SIXTEENTH',
    useGlobalRuler: false,
    primaryTimeDisplay: 'BEATS',
    secondaryTimeDisplay: 'TIME',
    secondaryRulerEnabled: false,
    scale: {
      scaleName: '12TET',
      baseFrequency: 261.625565,
      octave: 2,
      ratios: Array.from({ length: 12 }, (_, index) => Math.pow(Math.pow(2, 1 / 12), index)),
    },
    fieldDefinitions: [createFieldDefinition()],
    notes: [
      {
        octave: CENTER_OCTAVE,
        scaleDegree: 0,
        start: 1,
        duration: 1,
        fieldValues: [0.5],
        noteTemplate: null,
      },
    ],
    capabilities: {
      fieldEditor: true,
      clipboard: true,
      undo: true,
      noteTemplateOverride: true,
    },
    deferredCapabilities: [],
    ...overrides,
  };
}

function createMouseEvent(
  overrides: Partial<
    MouseEventInit & {
      button: number;
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      clientX: number;
      clientY: number;
    }
  > = {},
) {
  return {
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX: 0,
    clientY: 0,
    preventDefault() {},
    stopPropagation() {},
    ...overrides,
  } as unknown as React.MouseEvent;
}

function createRect() {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON() {
      return this;
    },
  } as unknown as DOMRect;
}

function getMidiNoteY(octave: number, scaleDegree: number, noteHeight: number): number {
  return (127 - (octave * 12 + scaleDegree)) * noteHeight;
}

function createListenerHarness(
  overrides: {
    notes?: PianoRollPayload['notes'];
    selectedIndices?: Set<number>;
    selectedFieldDef?: FieldDefSnapshot | null;
    snapEnabled?: boolean;
  } = {},
) {
  const payload = createPayload({
    notes: overrides.notes ?? createPayload().notes,
    snapEnabled: overrides.snapEnabled ?? false,
  });
  const calls = {
    addNote: [] as Array<[number, number, number, number | undefined]>,
    commitNoteTimeEdit: [] as Array<Parameters<NoteCanvasListenerCallbacks['commitNoteTimeEdit']>>,
    commitFieldEdit: [] as Array<Parameters<NoteCanvasListenerCallbacks['commitFieldEdit']>>,
    setSelection: [] as Array<number[]>,
  };

  let selectedIndices = overrides.selectedIndices ?? new Set<number>();
  let pasteTarget: { startBeat: number; octave: number; scaleDegree: number } | null = null;

  const callbacks: NoteCanvasListenerCallbacks = {
    get notes() {
      return payload.notes;
    },
    get scale() {
      return payload.scale;
    },
    get fieldDefinitions() {
      return payload.fieldDefinitions;
    },
    get selectedIndices() {
      return selectedIndices;
    },
    get pixelSecond() {
      return payload.pixelSecond;
    },
    get noteHeight() {
      return payload.noteHeight;
    },
    get snapEnabled() {
      return payload.snapEnabled;
    },
    get snapBeats() {
      return 0;
    },
    get durationBeats() {
      return 8;
    },
    get selectedFieldDef() {
      return overrides.selectedFieldDef ?? payload.fieldDefinitions[0] ?? null;
    },
    get pchGenerationMethod() {
      return payload.pchGenerationMethod;
    },
    addNote: (...args) => {
      calls.addNote.push(args);
    },
    commitNoteTimeEdit: (...args) => {
      calls.commitNoteTimeEdit.push(args);
    },
    commitFieldEdit: (...args) => {
      calls.commitFieldEdit.push(args);
    },
    removeSelectedNotes() {},
    copySelectedNotes() {},
    cutSelectedNotes() {},
    pasteNotesAt() {},
    setPasteTarget(target) {
      pasteTarget = target;
    },
    setSelection(indices) {
      selectedIndices = new Set(indices);
      calls.setSelection.push([...indices]);
    },
    addToSelection(index) {
      selectedIndices = new Set([...selectedIndices, index]);
    },
    removeFromSelection(index) {
      selectedIndices = new Set([...selectedIndices].filter((value) => value !== index));
    },
    clearSelection() {
      selectedIndices = new Set();
    },
    requestRedraw() {},
    getCanvasRect() {
      return createRect();
    },
    getViewportRect() {
      return createRect();
    },
    getScrollPosition() {
      return { scrollLeft: 0, scrollTop: 0 };
    },
    getViewportSize() {
      return { width: 800, height: 600 };
    },
    setScrollPosition() {},
  };

  return {
    listener: new NoteCanvasMouseListener(callbacks),
    calls,
    payload,
    getPasteTarget: () => pasteTarget,
  };
}

describe('PianoRoll editor parity helpers', () => {
  it('formats note tooltip pitch text like Java PianoRollCanvas', () => {
    expect(formatPianoRollPitch(7, 7, GENERATE_FREQUENCY, 12)).toBe('7.07');
    expect(formatPianoRollPitch(7, 7, GENERATE_PCH, 12)).toBe('7.7');
    expect(formatPianoRollPitch(7, 7, GENERATE_MIDI, 12)).toBe('91');
  });

  it('applies note-template and field-definition patches to the renderer payload', () => {
    const payload = createPayload();

    const updated = applyPianoRollPatchToPayload(payload, {
      addFieldDef: createFieldDefinition({
        fieldName: 'PAN',
        fieldType: 'DISCRETE',
        minValue: 0,
        maxValue: 8,
        defaultValue: 5,
      }),
      pianoRollNoteBatch: {
        operations: [
          {
            kind: 'update',
            noteIndex: 0,
            note: {
              ...payload.notes[0]!,
              noteTemplate: 'i2 <START> <DUR> <FREQ> <AMP> <PAN>',
            },
          },
        ],
      },
    });

    expect(updated.notes[0]!.noteTemplate).toBe('i2 <START> <DUR> <FREQ> <AMP> <PAN>');
    expect(updated.fieldDefinitions).toHaveLength(2);
    expect(updated.notes[0]!.fieldValues).toEqual([0.5, 5]);
  });

  it('restores the previous payload state from an undo snapshot patch', () => {
    const payload = createPayload();
    const next = applyPianoRollPatchToPayload(payload, {
      scale: {
        scaleName: 'Modified',
        baseFrequency: 440,
        octave: 2,
        ratios: [1, 1.5],
      },
      fieldDefinitions: [
        createFieldDefinition({
          fieldName: 'PAN',
          fieldType: 'DISCRETE',
          minValue: 0,
          maxValue: 8,
          defaultValue: 6,
        }),
      ],
      pianoRollNoteBatch: {
        operations: [
          {
            kind: 'replace',
            notes: [
              {
                octave: CENTER_OCTAVE,
                scaleDegree: 4,
                start: 3,
                duration: 2,
                fieldValues: [6],
                noteTemplate: 'i2 0 1 60 6',
              },
            ],
          },
        ],
      },
    });

    const restored = applyPianoRollPatchToPayload(next, buildPianoRollRestorePatch(payload));

    expect(restored).toEqual(payload);
  });
});

describe('NoteCanvasMouseListener', () => {
  it('commits a created note from shift-drag on empty canvas', () => {
    const harness = createListenerHarness({ notes: [] });
    const y = getMidiNoteY(CENTER_OCTAVE, 0, harness.payload.noteHeight) + 5;

    harness.listener.mousePressed(createMouseEvent({ clientX: 80, clientY: y, shiftKey: true }));
    harness.listener.mouseDragged(createMouseEvent({ clientX: 120, clientY: y, shiftKey: true }));
    harness.listener.mouseReleased(createMouseEvent({ clientX: 120, clientY: y, shiftKey: true }));

    expect(harness.calls.addNote).toHaveLength(1);
    expect(harness.calls.addNote[0]![0]).toBeCloseTo(2);
    expect(harness.calls.addNote[0]![1]).toBe(0);
    expect(harness.calls.addNote[0]![2]).toBe(CENTER_OCTAVE);
    expect(harness.calls.addNote[0]![3]).toBeCloseTo(1.125);
    expect(harness.getPasteTarget()).toEqual({
      startBeat: 2,
      octave: CENTER_OCTAVE,
      scaleDegree: 0,
    });
  });

  it('commits moved note timing and pitch from drag gestures', () => {
    const note = createPayload().notes[0]!;
    const harness = createListenerHarness({ notes: [note], selectedIndices: new Set([0]) });
    const startX = note.start * harness.payload.pixelSecond + 10;
    const startY = getMidiNoteY(note.octave, note.scaleDegree, harness.payload.noteHeight) + 5;

    harness.listener.mousePressed(createMouseEvent({ clientX: startX, clientY: startY }));
    harness.listener.mouseDragged(createMouseEvent({ clientX: startX + 40, clientY: startY - 20 }));
    harness.listener.mouseReleased(
      createMouseEvent({ clientX: startX + 40, clientY: startY - 20 }),
    );

    expect(harness.calls.commitNoteTimeEdit).toHaveLength(1);
    expect(harness.calls.commitNoteTimeEdit[0]![1][0]).toMatchObject({
      noteIndex: 0,
      originStart: 2,
      originDuration: 1,
      octave: CENTER_OCTAVE,
      scaleDegree: 2,
    });
  });

  it('commits field edits for the selected note set', () => {
    const note = createPayload().notes[0]!;
    const harness = createListenerHarness({ notes: [note], selectedIndices: new Set([0]) });
    const startX = note.start * harness.payload.pixelSecond + 10;
    const startY = getMidiNoteY(note.octave, note.scaleDegree, harness.payload.noteHeight) + 5;

    harness.listener.mousePressed(
      createMouseEvent({ clientX: startX, clientY: startY, ctrlKey: true }),
    );
    harness.listener.mouseDragged(
      createMouseEvent({ clientX: startX, clientY: startY - 50, ctrlKey: true }),
    );
    harness.listener.mouseReleased(
      createMouseEvent({ clientX: startX, clientY: startY - 50, ctrlKey: true }),
    );

    expect(harness.calls.commitFieldEdit).toHaveLength(1);
    expect(harness.calls.commitFieldEdit[0]![0]).toEqual([0]);
    expect(harness.calls.commitFieldEdit[0]![1]).toBe(0);
    expect(harness.calls.commitFieldEdit[0]![3][0]).toBeGreaterThan(0.5);
  });

  it('selects notes covered by a marquee drag', () => {
    const payload = createPayload({
      notes: [
        createPayload().notes[0]!,
        {
          octave: CENTER_OCTAVE,
          scaleDegree: 4,
          start: 5,
          duration: 1,
          fieldValues: [0.25],
          noteTemplate: null,
        },
      ],
    });
    const harness = createListenerHarness({ notes: payload.notes });
    const note = payload.notes[0]!;
    const noteX = note.start * payload.pixelSecond;
    const noteY = getMidiNoteY(note.octave, note.scaleDegree, payload.noteHeight);

    harness.listener.mousePressed(createMouseEvent({ clientX: noteX - 20, clientY: noteY - 20 }));
    harness.listener.mouseDragged(createMouseEvent({ clientX: noteX + 60, clientY: noteY + 20 }));
    harness.listener.mouseReleased(createMouseEvent({ clientX: noteX + 60, clientY: noteY + 20 }));

    expect(harness.calls.setSelection.at(-1)).toEqual([0]);
  });
});
