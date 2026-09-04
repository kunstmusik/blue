import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.TimeWarpProcessor';

export class TimeWarpProcessor extends NoteProcessor {
  private _timeWarpString = '0 60';

  constructor();
  constructor(src: TimeWarpProcessor);
  constructor(src?: TimeWarpProcessor) {
    super();
    if (src) {
      this._timeWarpString = src._timeWarpString;
    }
  }

  getTimeWarpString(): string {
    return this._timeWarpString;
  }
  setTimeWarpString(timeWarpString: string): void {
    this._timeWarpString = timeWarpString;
  }

  override process(notes: NoteList): NoteList {
    const tm = TempoMap.createTempoMap(this._timeWarpString);
    if (tm === null) {
      throw new NoteProcessorException('Error in tempo string', 0);
    }

    for (const note of notes) {
      let newStart: number;
      let newEnd: number;
      try {
        newStart = tm.beatsToSeconds(note.getStartTime());
        newEnd = tm.beatsToSeconds(note.getStartTime() + note.getSubjectiveDuration());
      } catch {
        throw new NoteProcessorException('Error in time warp', 0);
      }
      note.setStartTime(newStart);
      if (newEnd - newStart < 0) {
        throw new NoteProcessorException('Error in time warp', 0);
      }
      note.setSubjectiveDuration(newEnd - newStart);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'TimeWarpProcessor';
  }

  override deepCopy(): TimeWarpProcessor {
    return new TimeWarpProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('timeWarpString').setText(this.getTimeWarpString());
    return elem;
  }

  static loadFromXML(data: Element): TimeWarpProcessor {
    const proc = new TimeWarpProcessor();
    const tws = data.getTextString('timeWarpString');
    if (tws !== null) proc._timeWarpString = tws;
    return proc;
  }
}

class BeatTempoPair {
  beat = 0;
  tempo = 0;
}

class TempoMap {
  private _pairs: BeatTempoPair[];

  private constructor(pairs: BeatTempoPair[]) {
    this._pairs = pairs;
  }

  static createTempoMap(tempoString: string): TempoMap | null {
    const tokens = tempoString.trim().split(/\s+/);
    if (tokens.length % 2 !== 0) return null;

    const pairs: BeatTempoPair[] = [];
    for (let i = 0; i < tokens.length; i += 2) {
      const pair = new BeatTempoPair();
      pair.beat = parseFloat(tokens[i]);
      pair.tempo = parseFloat(tokens[i + 1]);
      if (isNaN(pair.beat) || isNaN(pair.tempo) || pair.beat < 0) {
        return null;
      }
      pairs.push(pair);
    }
    if (pairs.length === 0) return null;
    return new TempoMap(pairs);
  }

  beatsToSeconds(beat: number): number {
    if (this._pairs.length === 0) return 0;

    let seconds = 0;

    for (let i = 0; i < this._pairs.length - 1; i++) {
      const current = this._pairs[i];
      const next = this._pairs[i + 1];

      if (beat <= next.beat) {
        const bpm = (current.tempo + next.tempo) / 2;
        const secondsPerBeat = 60 / bpm;
        return seconds + (beat - current.beat) * secondsPerBeat;
      }

      const bpm = (current.tempo + next.tempo) / 2;
      const secondsPerBeat = 60 / bpm;
      seconds += (next.beat - current.beat) * secondsPerBeat;
    }

    const last = this._pairs[this._pairs.length - 1];
    const secondsPerBeat = 60 / last.tempo;
    return seconds + (beat - last.beat) * secondsPerBeat;
  }
}
