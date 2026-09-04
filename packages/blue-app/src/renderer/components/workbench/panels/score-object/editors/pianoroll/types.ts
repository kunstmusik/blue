import type { SnapValueName } from '@blue/data';
import { TimeBase, snapValueToBeats } from '@blue/data';

export interface NoteSnapshot {
  octave: number;
  scaleDegree: number;
  start: number;
  duration: number;
  fieldValues: number[];
  noteTemplate?: string | null;
}

export interface ScaleSnapshot {
  scaleName: string;
  baseFrequency: number;
  octave: number;
  ratios: number[];
}

export interface FieldDefSnapshot {
  fieldName: string;
  fieldType: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}

export interface PianoRollCapabilities {
  fieldEditor: boolean;
  clipboard: boolean;
  undo: boolean;
  noteTemplateOverride: boolean;
}

export interface PianoRollNotePatch {
  octave: number;
  scaleDegree: number;
  start: number;
  duration: number;
  fieldValues?: number[];
  noteTemplate?: string | null;
}

export interface PianoRollNoteBatchOperation {
  kind: string;
  noteIndex?: number;
  note?: PianoRollNotePatch;
  notes?: PianoRollNotePatch[];
  noteIndices?: number[];
  deltaStart?: number;
  deltaDuration?: number;
  deltaOctave?: number;
  deltaScaleDegree?: number;
}

export interface PianoRollNoteBatch {
  operations: PianoRollNoteBatchOperation[];
}

export interface PianoRollPayload {
  instrumentId: string;
  noteTemplate: string;
  pchGenerationMethod: number;
  transposition: number;
  pixelSecond: number;
  noteHeight: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  useGlobalRuler: boolean;
  primaryTimeDisplay: string;
  secondaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  scale: ScaleSnapshot;
  fieldDefinitions: FieldDefSnapshot[];
  notes: NoteSnapshot[];
  capabilities: PianoRollCapabilities;
  deferredCapabilities: string[];
}

export const PCH_LABELS = ['Frequency', 'PCH', 'MIDI'];

export const GENERATE_FREQUENCY = 0;
export const GENERATE_PCH = 1;
export const GENERATE_MIDI = 2;

export const MIDI_NOTE_COUNT = 128;

export const NOTE_NAMES_12TET = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FULL = [
  'C',
  'C#/Db',
  'D',
  'D#/Eb',
  'E',
  'F',
  'F#/Gb',
  'G',
  'G#/Ab',
  'A',
  'A#/Bb',
  'B',
];

export const OCTAVES = 16;
export const CENTER_OCTAVE = 8;
export const PITCH_HEADER_WIDTH = 72;

export type DragMode =
  | 'NONE'
  | 'SELECTING'
  | 'MOVE'
  | 'RESIZE_LEFT'
  | 'RESIZE_RIGHT'
  | 'FIELD_EDIT'
  | 'CREATE';

export interface NoteData {
  noteIndex: number;
  originStart: number;
  originDuration: number;
  octave: number;
  scaleDegree: number;
}

export function getPitchLabel(scaleDegree: number, ratios: number[]): string {
  const numDegrees = ratios.length || 12;
  const degree = ((scaleDegree % numDegrees) + numDegrees) % numDegrees;
  if (numDegrees === 12) {
    return NOTE_NAMES_12TET[degree] ?? `${degree}`;
  }
  return `${degree}`;
}

export function formatPianoRollPitch(
  octave: number,
  scaleDegree: number,
  pchGenerationMethod: number,
  numScaleDegrees: number,
): string {
  const degreeCount = pchGenerationMethod === GENERATE_MIDI ? 12 : Math.max(1, numScaleDegrees);
  const degree = ((scaleDegree % degreeCount) + degreeCount) % degreeCount;

  switch (pchGenerationMethod) {
    case GENERATE_FREQUENCY:
      return `${octave}.${String(degree).padStart(2, '0')}`;
    case GENERATE_PCH:
      return `${octave}.${degree}`;
    case GENERATE_MIDI:
      return String(octave * 12 + degree);
    default:
      return `${octave}.${String(degree).padStart(2, '0')}`;
  }
}

export function snapBeatFloor(value: number, snapBeats: number): number {
  if (snapBeats <= 0) return value;
  return Math.floor(value / snapBeats) * snapBeats;
}

export function snapBeatRound(value: number, snapBeats: number): number {
  if (snapBeats <= 0) return value;
  return Math.round(value / snapBeats) * snapBeats;
}

export function getSnapBeats(
  snapEnabled: boolean,
  snapValue: SnapValueName,
  pixelSecond: number,
): number {
  if (!snapEnabled) return 0;
  return snapValueToBeats(snapValue, 60, 24, 44100, pixelSecond);
}

export const TIME_DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: TimeBase.BEATS, label: 'Beats' },
  { value: TimeBase.BBT, label: 'BBT' },
  { value: TimeBase.BBST, label: 'BBST' },
  { value: TimeBase.BBF, label: 'BBF' },
  { value: TimeBase.TIME, label: 'Time' },
  { value: TimeBase.SMPTE, label: 'SMPTE' },
  { value: TimeBase.SECONDS, label: 'Seconds' },
  { value: TimeBase.FRAME, label: 'Samples' },
];

export function clonePianoRollScale(scale: ScaleSnapshot): ScaleSnapshot {
  return {
    scaleName: scale.scaleName,
    baseFrequency: scale.baseFrequency,
    octave: scale.octave,
    ratios: [...scale.ratios],
  };
}

export function clonePianoRollFieldDefinitions(
  fieldDefinitions: FieldDefSnapshot[],
): FieldDefSnapshot[] {
  return fieldDefinitions.map((fieldDefinition) => ({ ...fieldDefinition }));
}

export function clonePianoRollNotes(notes: NoteSnapshot[]): NoteSnapshot[] {
  return notes.map((note) => ({
    ...note,
    fieldValues: [...note.fieldValues],
  }));
}

export function clonePianoRollPayload(payload: PianoRollPayload): PianoRollPayload {
  return {
    ...payload,
    scale: clonePianoRollScale(payload.scale),
    fieldDefinitions: clonePianoRollFieldDefinitions(payload.fieldDefinitions),
    notes: clonePianoRollNotes(payload.notes),
    capabilities: { ...payload.capabilities },
    deferredCapabilities: [...payload.deferredCapabilities],
  };
}

export function applyPianoRollPatchToPayload(
  payload: PianoRollPayload,
  patch: Record<string, unknown>,
): PianoRollPayload {
  const next = clonePianoRollPayload(payload);
  const previousFieldDefinitions = clonePianoRollFieldDefinitions(next.fieldDefinitions);

  if (patch.instrumentId !== undefined) next.instrumentId = patch.instrumentId as string;
  if (patch.noteTemplate !== undefined) next.noteTemplate = patch.noteTemplate as string;
  if (patch.pchGenerationMethod !== undefined)
    next.pchGenerationMethod = patch.pchGenerationMethod as number;
  if (patch.transposition !== undefined) next.transposition = patch.transposition as number;
  if (patch.pixelSecond !== undefined) next.pixelSecond = patch.pixelSecond as number;
  if (patch.noteHeight !== undefined) next.noteHeight = patch.noteHeight as number;
  if (patch.snapEnabled !== undefined) next.snapEnabled = patch.snapEnabled as boolean;
  if (patch.snapValue !== undefined) next.snapValue = patch.snapValue as SnapValueName;
  if (patch.useGlobalRuler !== undefined) next.useGlobalRuler = patch.useGlobalRuler as boolean;
  if (patch.primaryTimeDisplay !== undefined)
    next.primaryTimeDisplay = patch.primaryTimeDisplay as string;
  if (patch.secondaryTimeDisplay !== undefined)
    next.secondaryTimeDisplay = patch.secondaryTimeDisplay as string;
  if (patch.secondaryRulerEnabled !== undefined)
    next.secondaryRulerEnabled = patch.secondaryRulerEnabled as boolean;

  if (patch.scale !== undefined) {
    next.scale = clonePianoRollScale(patch.scale as ScaleSnapshot);
  }

  if (Array.isArray(patch.fieldDefinitions)) {
    next.fieldDefinitions = normalizeFieldDefinitions(patch.fieldDefinitions as FieldDefSnapshot[]);
  }

  if (patch.addFieldDef !== undefined) {
    next.fieldDefinitions = [
      ...next.fieldDefinitions,
      normalizeFieldDefinition(patch.addFieldDef as FieldDefSnapshot),
    ];
  }

  if (patch.updateFieldDef !== undefined) {
    const update = patch.updateFieldDef as Partial<FieldDefSnapshot> & { index: number };
    if (update.index >= 0 && update.index < next.fieldDefinitions.length) {
      const current = next.fieldDefinitions[update.index]!;
      next.fieldDefinitions = next.fieldDefinitions.map((fieldDefinition, index) => {
        if (index !== update.index) return fieldDefinition;
        return normalizeFieldDefinition({
          ...current,
          ...update,
        });
      });
    }
  }

  if (typeof patch.removeFieldDef === 'number') {
    next.fieldDefinitions = next.fieldDefinitions.filter(
      (_, index) => index !== patch.removeFieldDef,
    );
  }

  if (patch.pianoRollNoteBatch !== undefined) {
    next.notes = applyPianoRollNoteBatch(
      next.notes,
      patch.pianoRollNoteBatch as PianoRollNoteBatch,
    );
  }

  if (
    patch.fieldDefinitions !== undefined ||
    patch.addFieldDef !== undefined ||
    patch.updateFieldDef !== undefined ||
    patch.removeFieldDef !== undefined
  ) {
    next.notes = realignPianoRollNotes(next.notes, previousFieldDefinitions, next.fieldDefinitions);
  }

  return next;
}

export function buildPianoRollRestorePatch(payload: PianoRollPayload): Record<string, unknown> {
  return {
    instrumentId: payload.instrumentId,
    noteTemplate: payload.noteTemplate,
    pchGenerationMethod: payload.pchGenerationMethod,
    transposition: payload.transposition,
    pixelSecond: payload.pixelSecond,
    noteHeight: payload.noteHeight,
    snapEnabled: payload.snapEnabled,
    snapValue: payload.snapValue,
    useGlobalRuler: payload.useGlobalRuler,
    primaryTimeDisplay: payload.primaryTimeDisplay,
    secondaryTimeDisplay: payload.secondaryTimeDisplay,
    secondaryRulerEnabled: payload.secondaryRulerEnabled,
    scale: clonePianoRollScale(payload.scale),
    fieldDefinitions: clonePianoRollFieldDefinitions(payload.fieldDefinitions),
    pianoRollNoteBatch: {
      operations: [{ kind: 'replace', notes: clonePianoRollNotes(payload.notes) }],
    },
  };
}

function applyPianoRollNoteBatch(notes: NoteSnapshot[], batch: PianoRollNoteBatch): NoteSnapshot[] {
  let nextNotes = clonePianoRollNotes(notes);

  for (const operation of batch.operations) {
    switch (operation.kind) {
      case 'add': {
        if (operation.note) {
          nextNotes.push(normalizeNoteSnapshot(operation.note));
        }
        break;
      }
      case 'addMany': {
        if (operation.notes) {
          nextNotes = [...nextNotes, ...operation.notes.map(normalizeNoteSnapshot)];
        }
        break;
      }
      case 'remove': {
        if (operation.noteIndices) {
          const removeSet = new Set(operation.noteIndices);
          nextNotes = nextNotes.filter((_, index) => !removeSet.has(index));
        }
        break;
      }
      case 'move': {
        if (operation.noteIndex !== undefined) {
          nextNotes = nextNotes.map((note, index) => {
            if (index !== operation.noteIndex) return note;
            return {
              ...note,
              start: note.start + (operation.deltaStart ?? 0),
              octave: note.octave + (operation.deltaOctave ?? 0),
              scaleDegree: note.scaleDegree + (operation.deltaScaleDegree ?? 0),
            };
          });
        }
        break;
      }
      case 'resize': {
        if (operation.noteIndex !== undefined) {
          nextNotes = nextNotes.map((note, index) => {
            if (index !== operation.noteIndex) return note;
            return {
              ...note,
              duration: Math.max(0.125, note.duration + (operation.deltaDuration ?? 0)),
            };
          });
        }
        break;
      }
      case 'update': {
        if (operation.noteIndex !== undefined && operation.note) {
          nextNotes = nextNotes.map((note, index) => {
            if (index !== operation.noteIndex) return note;
            return normalizeNoteSnapshot({
              ...note,
              ...operation.note,
            });
          });
        }
        break;
      }
      case 'replace': {
        if (operation.notes) {
          nextNotes = operation.notes.map(normalizeNoteSnapshot);
        }
        break;
      }
    }
  }

  return nextNotes;
}

function normalizeFieldDefinitions(fieldDefinitions: FieldDefSnapshot[]): FieldDefSnapshot[] {
  return fieldDefinitions.map(normalizeFieldDefinition);
}

function normalizeFieldDefinition(fieldDefinition: Partial<FieldDefSnapshot>): FieldDefSnapshot {
  return {
    fieldName: fieldDefinition.fieldName ?? 'field',
    fieldType: fieldDefinition.fieldType ?? 'CONTINUOUS',
    minValue: fieldDefinition.minValue ?? 0,
    maxValue: fieldDefinition.maxValue ?? 1,
    defaultValue: fieldDefinition.defaultValue ?? 1,
  };
}

function normalizeNoteSnapshot(note: PianoRollNotePatch): NoteSnapshot {
  return {
    octave: note.octave,
    scaleDegree: note.scaleDegree,
    start: note.start,
    duration: note.duration,
    fieldValues: note.fieldValues ? [...note.fieldValues] : [],
    noteTemplate: note.noteTemplate ?? null,
  };
}

function realignPianoRollNotes(
  notes: NoteSnapshot[],
  previousFieldDefinitions: FieldDefSnapshot[],
  nextFieldDefinitions: FieldDefSnapshot[],
): NoteSnapshot[] {
  return notes.map((note) => ({
    ...note,
    fieldValues: nextFieldDefinitions.map((fieldDefinition, index) => {
      const previousIndex = previousFieldDefinitions.findIndex(
        (previousFieldDefinition) =>
          previousFieldDefinition.fieldName === fieldDefinition.fieldName,
      );
      const value =
        previousIndex >= 0
          ? (note.fieldValues[previousIndex] ?? fieldDefinition.defaultValue)
          : (note.fieldValues[index] ?? fieldDefinition.defaultValue);
      return normalizeFieldValue(value, fieldDefinition);
    }),
  }));
}

function normalizeFieldValue(value: number, fieldDefinition: FieldDefSnapshot): number {
  const clamped = Math.max(fieldDefinition.minValue, Math.min(value, fieldDefinition.maxValue));
  if (fieldDefinition.fieldType === 'DISCRETE') {
    return Math.round(clamped);
  }
  return clamped;
}
