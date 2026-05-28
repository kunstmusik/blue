import { formatBlueNumber, formatJavaDouble } from '../utilities/number-format';

const TOKEN_PATTERN = /"[^"]*"|\[[^\]]*\]|\S*/g;

function evalBracketExpression(expr: string): string {
  try {
    const sanitized = expr
      .replace(/[^0-9+\-*/().eE\s]/g, '')
      .trim();
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

export class Note {
  private _pFields = new Map<number, string>();
  private _startTime = 0;
  private _subjectiveDuration = 0;
  isTied = false;

  static createNote(numPFields: number): Note {
    const note = new Note();
    for (let i = 1; i <= numPFields; i++) {
      note._pFields.set(i, (i - 1).toString());
    }
    return note;
  }

  static createBlank(numPFields: number): Note {
    return Note.createNote(numPFields);
  }

  static fromOther(other: Note): Note {
    const note = new Note();
    note._startTime = other._startTime;
    note._subjectiveDuration = other._subjectiveDuration;
    note.isTied = other.isTied;
    for (const [k, v] of other._pFields) {
      note._pFields.set(k, v);
    }
    return note;
  }

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
        } catch { /* not numeric */ }
      }

      if (performCarry) {
        const numFieldsToCopy = previousNote.getPCount() - buffer.length;
        if (numFieldsToCopy > 0) {
          for (let i = previousNote.getPCount() - numFieldsToCopy; i < previousNote.getPCount(); i++) {
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

  getStartTime(): number { return this._startTime; }
  setStartTime(time: number): void {
    this._startTime = time;
    this._pFields.set(2, formatJavaDouble(time));
  }

  getSubjectiveDuration(): number { return this._subjectiveDuration; }
  setSubjectiveDuration(duration: number): void {
    this._subjectiveDuration = Math.abs(duration);
  }

  getObjectiveDuration(): number { return this.getSubjectiveDuration(); }

  getEndTime(): number { return this._startTime + this._subjectiveDuration; }

  isTiedNote(): boolean { return this.isTied; }
  setTied(tied: boolean): void { this.isTied = tied; }

  getPCount(): number { return this._pFields.size; }

  getPField(index: number): string | undefined {
    return this._pFields.get(index);
  }

  setPField(value: string, index: number): void {
    this._pFields.set(index, value);
    if (index === 2) {
      this._startTime = parseFloat(value);
    }
    if (index === 3) {
      this.setSubjectiveDuration(parseFloat(value));
    }
  }

  getPFields(): Map<number, string> {
    return new Map(this._pFields);
  }

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

  toString(): string {
    return this.toScoreText();
  }

  deepCopy(): Note {
    return Note.fromOther(this);
  }
}
