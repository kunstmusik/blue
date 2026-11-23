import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';

/** Describes how notes emitted by a sound object participate in track instrument assignment. */
export type InstrumentTargetBehavior = 'assignable' | 'propagated' | 'preserve' | 'none';

/** Receives track-instrument targeting classification for generated notes. */
export interface InstrumentTargetCollector {
  /** Records the targeting behavior of a generated note. */
  mark(note: Note, behavior: InstrumentTargetBehavior): void;
}

/** Shared by an Instance and the PolyObject that normalizes its linked source. */
export interface ScoreNormalizationOrigin {
  /** Identity of the object that owns this render's normalization request. */
  readonly owner: object;
  /** Unnormalized origin in Csound beats, once determined. */
  originBeats?: number;
  /**
   * Stable origin in the linked PolyObject's child timeline. `null` means
   * the source is known to generate no notes; `undefined` means unsupported.
   */
  rangeOriginBeats?: number | null;
  /** The linked Instance permits range-origin generation for this request. */
  readonly allowRangeOrigin?: boolean;
}

/** Controls note generation and placement as a render traverses score layers. */
export interface ScoreGenerationOptions {
  /** Absolute score beat at local beat zero while descending nested PolyObjects. */
  readonly beatOrigin?: number;
  /** A parent PolyObject will rebase selected-range notes after child placement. */
  readonly deferRenderStartRebase?: boolean;
  /** A Sound-containing transformed source is generated whole; seek files after placement. */
  readonly deferFileSeek?: boolean;
  /** Pre-range minimum collected once by a linked source's owner PolyObject. */
  readonly normalizationOrigin?: ScoreNormalizationOrigin;
  /** Enables filtering based on whether other layers are soloed. */
  readonly processWithSolo?: boolean;
  /** Stable ID of the track whose notes are being generated. */
  readonly trackId?: string;
  /** Compiled instrument ID for notes that can use the owning track's assignment. */
  readonly instrumentOverrideId?: string;
  /** Optional observer for the classification of generated instrument targets. */
  readonly instrumentTargetCollector?: InstrumentTargetCollector;
  /**
   * Track header authority (Spec 111). When 'audio', Track groups generate
   * every event regardless of track event flags and take no part in global
   * event-solo discovery; audio mute/solo handles audibility. Absent or
   * 'event' preserves the legacy Java-compatible behavior.
   */
  readonly trackLayerMuteSoloMode?: 'audio' | 'event';
  /**
   * Spec 111 disk pruning: Track uniqueIds certified inaudible by the route
   * policy. Pruned tracks generate no events; their scheduling contribution
   * is reported through `prunedDurationSink` so the render duration is
   * unchanged. Disk generation only.
   */
  readonly pruneInaudibleTracks?: ReadonlySet<string>;
  /** Mutable sink collecting the unpruned duration bound of pruned tracks. */
  readonly prunedDurationSink?: {
    /** Accumulated duration bound for pruned tracks, in Csound beats. */
    value: number;
  };
}

/** Full generation options or a legacy boolean that supplies only the solo-filtering flag. */
export type ScoreGenerationOptionsOrSolo = ScoreGenerationOptions | boolean;

/** Converts a legacy solo flag or absent options into a generation options object. */
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

/** Mutates eligible notes to use the supplied runtime instrument ID while preserving Csound p1 suffixes. */
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
    collector?.mark(
      note,
      note.getTrackInstrumentTarget() === 'assignable' ? 'assignable' : 'preserve',
    );
  }
}
