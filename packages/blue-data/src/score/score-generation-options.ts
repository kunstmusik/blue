import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';

export type InstrumentTargetBehavior =
  | 'assignable'
  | 'propagated'
  | 'preserve'
  | 'none';

export interface InstrumentTargetCollector {
  mark(note: Note, behavior: InstrumentTargetBehavior): void;
}

export interface ScoreGenerationOptions {
  readonly processWithSolo?: boolean;
  readonly trackId?: string;
  readonly instrumentOverrideId?: string;
  readonly instrumentTargetCollector?: InstrumentTargetCollector;
}

export type ScoreGenerationOptionsOrSolo = ScoreGenerationOptions | boolean;

export function normalizeScoreGenerationOptions(
  options: ScoreGenerationOptionsOrSolo | undefined,
): ScoreGenerationOptions {
  if (typeof options === 'boolean') {
    return { processWithSolo: options };
  }
  return options ?? {};
}

/**
 * Replace the instrument portion of a Csound p1 without changing authored
 * score data. Fractional and negative suffix semantics are retained.
 */
export function replaceTrackInstrumentP1(
  authoredP1: string | undefined,
  runtimeInstrumentId: string | number,
): string | undefined {
  if (authoredP1 === undefined) return undefined;

  const value = authoredP1.trim();
  if (value.length === 0) return authoredP1;

  const runtimeId = String(runtimeInstrumentId);
  const numeric = /^(-?)(\d+)(\.\d+)?$/.exec(value);
  if (numeric) {
    const sign = numeric[1] ?? '';
    const suffix = numeric[3] ?? '';
    return `${sign}${runtimeId}${suffix}`;
  }

  // A quoted p1 or a valid symbolic p1 names an instrument. Track assignment
  // deliberately replaces that name with the deterministic render ID.
  if (/^"[^"\r\n]+"$/.test(value) || /^[A-Za-z_][A-Za-z0-9_.$:-]*$/.test(value)) {
    return runtimeId;
  }

  // Malformed p1 text is authored data. Preserve it so the existing Csound
  // diagnostic remains visible instead of silently corrupting the note.
  return authoredP1;
}

export function applyTrackInstrumentOverride(
  notes: NoteList,
  runtimeInstrumentId: string | number,
  collector?: InstrumentTargetCollector,
): void {
  for (const note of notes) {
    const target = note.getTrackInstrumentTarget();
    if (target !== 'assignable') continue;

    const nextP1 = replaceTrackInstrumentP1(note.getPField(1), runtimeInstrumentId);
    if (nextP1 !== undefined) {
      note.setPField(nextP1, 1);
    }
    collector?.mark(note, 'assignable');
  }
}

export function markTrackInstrumentTargets(
  notes: NoteList,
  behavior: InstrumentTargetBehavior,
  collector?: InstrumentTargetCollector,
): void {
  for (const note of notes) {
    if (note.getTrackInstrumentTarget() === undefined) {
      note.setTrackInstrumentTarget(
        behavior === 'assignable' || behavior === 'propagated' ? 'assignable' : 'preserve',
      );
    }
    collector?.mark(note, note.getTrackInstrumentTarget() === 'assignable' ? 'assignable' : 'preserve');
  }
}
