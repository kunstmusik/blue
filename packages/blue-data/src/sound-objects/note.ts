import { formatBlueNumber, formatJavaDouble } from '../utilities/number-format';
import type { ScoreNormalizationOrigin } from '../score/score-generation-options';
import type { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import type { TimeContext } from '../time/time-context';

const TOKEN_PATTERN = /"[^"]*"|\[[^\]]*\]|\S*/g;

/** Render metadata used to recompute an audio file seek after score placement. */
export interface FileSeekProvenance {
  /** Index of the Csound p-field containing the file seek offset. */
  readonly pField: 4 | 5;
  /** Original absolute timeline position of the playback object in Csound beats. */
  readonly absoluteObjectStartBeat: number;
  /** Duration before render-window clipping, in Csound beats. */
  readonly originalDurationBeats: number;
  /** Initial file seek offset produced during note generation, in seconds. */
  readonly generatedOffsetSeconds: number;
  /** Shared origin used when normalizing or rebasing the generated note. */
  readonly normalizationOrigin: ScoreNormalizationOrigin;
}

/** Disposable Sound resource and envelope placement, before final instrument allocation. */
export interface SoundOccurrence {
  /** BlueSynthBuilder model associated with this generated occurrence. */
  readonly instrument: BlueSynthBuilder;
  /** Provisional Csound instrument number allocated for the occurrence. */
  readonly instrumentNumber: number;
  /** Persistent identifier of the owning score track. */
  readonly trackId?: string;
  /** Start of the occurrence's envelope in score time. */
  readonly envelopeStart: number;
  /** Duration of the occurrence's envelope in score time. */
  readonly envelopeDuration: number;
}

function evalBracketExpression(expr: string): string {
  try {
    const sanitized = expr.replace(/[^0-9+\-*/().eE\s]/g, '').trim();
    if (!sanitized) return '0';
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return result.toString();
    }
    return expr;
  } catch {
    return expr;
  }
}

/** One Csound instrument event with textual p-fields and numeric timing. */
export class Note {
  private _pFields = new Map<number, string>();
  private _startTime = 0;
  private _subjectiveDuration = 0;
  private _trackInstrumentTarget: 'assignable' | 'preserve' | undefined;
  private _fileSeekProvenance: FileSeekProvenance | undefined;
  private _soundOccurrence: SoundOccurrence | undefined;
  private _deferredFileSeek:
    | {
        /** One-based p-field index that carries the deferred file offset. */
        readonly pField: 4 | 5;
        /** Timing context used to convert the deferred seek interval. */
        readonly context: TimeContext;
      }
    | undefined;
  /** Whether Csound should treat the note as tied. */
  isTied = false;

  /** Creates a note with the requested number of p-fields initialized to sequential strings starting at zero. */
  static createNote(numPFields: number): Note {
    const note = new Note();
    for (let i = 1; i <= numPFields; i++) {
      note._pFields.set(i, (i - 1).toString());
    }
    return note;
  }

  /** Creates a note with the default p-field values used by Note.createNote. */
  static createBlank(numPFields: number): Note {
    return Note.createNote(numPFields);
  }

  /** Copies the source note, including its timing and render metadata. */
  static fromOther(other: Note): Note {
    const note = new Note();
    note._startTime = other._startTime;
    note._subjectiveDuration = other._subjectiveDuration;
    note._trackInstrumentTarget = other._trackInstrumentTarget;
    note._fileSeekProvenance = other._fileSeekProvenance;
    note._soundOccurrence = other._soundOccurrence;
    note._deferredFileSeek = other._deferredFileSeek;
    note.isTied = other.isTied;
    for (const [k, v] of other._pFields) {
      note._pFields.set(k, v);
    }
    return note;
  }

  /** Parses note text with Csound shorthand values resolved against the previous note when applicable. */
  static createNoteFromText(text: string, previousNote?: Note | null): Note | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('i')) return null;

    try {
      const n = new Note();
      const cleanText = trimmed.substring(trimmed.indexOf('i') + 1);
      n.noteInit(cleanText, previousNote ?? null);
      return n;
    } catch {
      return null;
    }
  }

  /** Build a Note directly from pre-tokenized p-fields without bracket evaluation or carry. */
  static createFromTokens(tokens: readonly string[]): Note | null {
    if (tokens.length < 3) return null;
    const n = new Note();
    for (let i = 0; i < tokens.length; i++) {
      n._pFields.set(i + 1, tokens[i]!);
    }
    const rawDur = parseFloat(tokens[2]!);
    n._startTime = parseFloat(tokens[1]!);
    n.setSubjectiveDuration(rawDur);
    n.setTied(rawDur < 0);
    return n;
  }

  private noteInit(input: string, previousNote: Note | null): void {
    const buffer: string[] = [];

    const m = input.match(TOKEN_PATTERN);
    if (m) {
      for (const str of m) {
        if (!str) continue;
        if (str.charAt(0) === '[') {
          const evaluated = evalBracketExpression(str.substring(1, str.length - 1));
          buffer.push(evaluated);
        } else {
          buffer.push(str);
        }
      }
    }

    if (buffer.length < 3) throw new Error('Insufficient pfields');

    if (previousNote !== null) {
      let performCarry = buffer[0] === previousNote.getPField(1);

      if (!performCarry) {
        try {
          const instr1 = parseInt(buffer[0], 10);
          const instr2 = parseInt(previousNote.getPField(1) ?? '', 10);
          if (instr1 === instr2) performCarry = true;
        } catch {
          /* not numeric */
        }
      }

      if (performCarry) {
        const numFieldsToCopy = previousNote.getPCount() - buffer.length;
        if (numFieldsToCopy > 0) {
          for (
            let i = previousNote.getPCount() - numFieldsToCopy;
            i < previousNote.getPCount();
            i++
          ) {
            buffer.push(previousNote.getPField(i + 1) ?? '');
          }
        }
      }
    }

    for (let i = 0; i < buffer.length; i++) {
      this._pFields.set(i + 1, buffer[i]);
    }

    if (previousNote !== null) {
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === '.') {
          const prevVal = previousNote.getPField(i + 1);
          if (prevVal !== undefined) {
            this._pFields.set(i + 1, prevVal);
          }
        }
      }
    }

    const startTimeStr = this._pFields.get(2) ?? '0';
    const durStr = this._pFields.get(3) ?? '0';
    const rawDur = parseFloat(durStr);
    this._startTime = parseFloat(startTimeStr);
    this.setSubjectiveDuration(rawDur);
    this.setTied(rawDur < 0);
  }

  /** Returns the start position of the note in Csound beats. */
  getStartTime(): number {
    return this._startTime;
  }
  /** Sets the start position of the note in Csound beats. */
  setStartTime(time: number): void {
    if (this._soundOccurrence) {
      this._soundOccurrence = {
        ...this._soundOccurrence,
        envelopeStart: this._soundOccurrence.envelopeStart + time - this._startTime,
      };
    }
    this._startTime = time;
    this._pFields.set(2, formatJavaDouble(time));
  }

  /** Returns the nonnegative duration magnitude in Csound beats. */
  getSubjectiveDuration(): number {
    return this._subjectiveDuration;
  }
  /** Stores the absolute duration in Csound beats. The tie flag is set separately. */
  setSubjectiveDuration(duration: number): void {
    this._subjectiveDuration = Math.abs(duration);
  }

  /** Returns the effective duration used when computing the note's end. */
  getObjectiveDuration(): number {
    return this.getSubjectiveDuration();
  }

  /** Returns the note's end position in Csound beats. */
  getEndTime(): number {
    return this._startTime + this._subjectiveDuration;
  }

  /** Reports whether the note uses a negative duration to tie into a later event. */
  isTiedNote(): boolean {
    return this.isTied;
  }
  /** Sets the tie flag independently of the duration magnitude. */
  setTied(tied: boolean): void {
    this.isTied = tied;
  }

  /** Returns the number of stored Csound p-fields. */
  getPCount(): number {
    return this._pFields.size;
  }

  /** Reads a Csound p-field using its one-based index. */
  getPField(index: number): string | undefined {
    return this._pFields.get(index);
  }

  /**
   * Updates a Csound p-field in place. Fields 2 and 3 also update the cached start and duration.
   *
   * @param value - Score text for the field. Start and duration must be numeric text in Csound beats.
   * @param index - One-based p-field index.
   */
  setPField(value: string, index: number): void {
    this._pFields.set(index, value);
    if (index === 2) {
      this.setStartTime(parseFloat(value));
      this._pFields.set(index, value);
    }
    if (index === 3) {
      this.setSubjectiveDuration(parseFloat(value));
    }
  }

  /**
   * Transient render metadata. It intentionally never participates in score
   * text/XML serialization and is copied only while a render Note is copied.
   */
  getTrackInstrumentTarget(): 'assignable' | 'preserve' | undefined {
    return this._trackInstrumentTarget;
  }

  /** Controls whether track compilation can replace the note’s instrument ID. */
  setTrackInstrumentTarget(target: 'assignable' | 'preserve' | undefined): void {
    this._trackInstrumentTarget = target;
  }

  /** Returns the file seek provenance stored on the note. */
  getFileSeekProvenance(): FileSeekProvenance | undefined {
    return this._fileSeekProvenance;
  }

  /** Sets the file seek provenance stored on the note. */
  setFileSeekProvenance(provenance: FileSeekProvenance | undefined): void {
    this._fileSeekProvenance = provenance;
  }

  /** Returns the sound occurrence stored on the note. */
  getSoundOccurrence(): SoundOccurrence | undefined {
    return this._soundOccurrence;
  }

  /** Sets the sound occurrence stored on the note. */
  setSoundOccurrence(occurrence: SoundOccurrence | undefined): void {
    this._soundOccurrence = occurrence;
  }

  /** Returns the deferred file seek stored on the note. */
  getDeferredFileSeek(): typeof this._deferredFileSeek {
    return this._deferredFileSeek;
  }

  /** Sets the deferred file seek stored on the note. */
  setDeferredFileSeek(seek: typeof this._deferredFileSeek): void {
    this._deferredFileSeek = seek;
  }

  /** Returns a copy of the map keyed by one-based Csound p-field index. */
  getPFields(): Map<number, string> {
    return new Map(this._pFields);
  }

  /** Formats the note using Csound score syntax. */
  toScoreText(): string {
    const parts: string[] = [];
    parts.push('i' + (this._pFields.get(1) ?? '0'));
    parts.push(formatJavaDouble(this._startTime));
    if (this.isTied) {
      parts.push('-' + formatBlueNumber(this._subjectiveDuration));
    } else {
      parts.push(formatBlueNumber(this._subjectiveDuration));
    }
    for (let i = 4; ; i++) {
      const val = this._pFields.get(i);
      if (val === undefined) break;
      parts.push(val);
    }
    return parts.join('\t');
  }

  /** Formats the note as Csound score text. */
  toString(): string {
    return this.toScoreText();
  }

  /** Copies the note and its editable state. */
  deepCopy(): Note {
    return Note.fromOther(this);
  }
}
