import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.TuningProcessor';

const TWELVE_TET_RATIOS: number[] = [];
for (let i = 0; i < 12; i++) {
  TWELVE_TET_RATIOS.push(Math.pow(2, i / 12));
}

export class TuningProcessor extends NoteProcessor {
  private _pfield = 4;
  private _baseFrequency = 261.626;
  private _ratios = [...TWELVE_TET_RATIOS];

  constructor();
  constructor(src: TuningProcessor);
  constructor(src?: TuningProcessor) {
    super();
    if (src) {
      this._pfield = src._pfield;
      this._baseFrequency = src._baseFrequency;
      this._ratios = [...src._ratios];
    }
  }

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    const p = parseInt(pfield, 10);
    if (p > 3) {
      this._pfield = p;
    }
  }

  getBaseFrequency(): string {
    return this._baseFrequency.toString();
  }
  setBaseFrequency(baseFrequency: string): void {
    this._baseFrequency = parseFloat(baseFrequency);
  }

  getRatios(): number[] {
    return this._ratios;
  }
  setRatios(ratios: number[]): void {
    this._ratios = ratios;
  }

  private convert(val: string): number {
    const index = val.indexOf('.');
    let oct: number;
    let pch: number;

    if (index === -1) {
      oct = parseInt(val, 10);
      pch = 0.0;
    } else {
      oct = parseInt(val.substring(0, index), 10);
      pch = parseFloat(val.substring(index + 1));
    }

    let pitchIndex = Math.trunc(pch);
    const numScaleDegrees = this._ratios.length;

    if (pitchIndex >= numScaleDegrees) {
      oct += Math.trunc(pitchIndex / numScaleDegrees);
      pitchIndex = pitchIndex % numScaleDegrees;
    }

    return this._baseFrequency * this._ratios[pitchIndex] * Math.pow(2, oct - 8);
  }

  override process(notes: NoteList): NoteList {
    for (const note of notes) {
      const pcount = note.getPCount();
      if (this._pfield < 1 || this._pfield > pcount) {
        throw new NoteProcessorException('Missing pfield', this._pfield);
      }

      const val = note.getPField(this._pfield)!.trim();
      let freq: number;
      try {
        freq = this.convert(val);
      } catch {
        throw new NoteProcessorException('Error converting scale', this._pfield);
      }

      note.setPField(freq.toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'TuningProcessor';
  }

  override deepCopy(): TuningProcessor {
    return new TuningProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this._pfield.toString());
    const scaleElem = elem.addElement('scale');
    scaleElem.addElement('baseFrequency').setText(this._baseFrequency.toString());
    const ratiosStr = this._ratios.map((r) => r.toString()).join('\n');
    scaleElem.addElement('ratios').setText(ratiosStr);
    return elem;
  }

  static loadFromXML(data: Element): TuningProcessor {
    const proc = new TuningProcessor();

    const bf = data.getTextString('baseFrequency');
    if (bf !== null) proc._baseFrequency = parseFloat(bf);

    const pf = data.getTextString('pfield');
    if (pf !== null) {
      const p = parseInt(pf, 10);
      if (p > 3) proc._pfield = p;
    }

    const scaleElem = data.getElement('scale');
    if (scaleElem !== null) {
      const scaleBf = scaleElem.getTextString('baseFrequency');
      if (scaleBf !== null) proc._baseFrequency = parseFloat(scaleBf);

      const ratiosText = scaleElem.getTextString('ratios');
      if (ratiosText !== null) {
        const tokens = ratiosText.trim().split(/\s+/);
        if (tokens.length > 0 && tokens[0].length > 0) {
          proc._ratios = tokens.map((t) => parseFloat(t));
        }
      }
    }

    return proc;
  }
}
