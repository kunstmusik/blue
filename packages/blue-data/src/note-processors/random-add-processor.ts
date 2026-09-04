import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { JavaRandom } from '../sound-objects/jmask-support';

const JAVA_TYPE = 'blue.noteProcessor.RandomAddProcessor';

export class RandomAddProcessor extends NoteProcessor {
  private _pfield = 4;
  private _min = 0.0;
  private _max = 1.0;
  private _seedUsed = false;
  private _seed = 0;

  constructor();
  constructor(src: RandomAddProcessor);
  constructor(src?: RandomAddProcessor) {
    super();
    if (src) {
      this._pfield = src._pfield;
      this._min = src._min;
      this._max = src._max;
      this._seedUsed = src._seedUsed;
      this._seed = src._seed;
    }
  }

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  getMin(): string {
    return this._min.toString();
  }
  setMin(value: string): void {
    this._min = parseFloat(value);
  }

  getMax(): string {
    return this._max.toString();
  }
  setMax(value: string): void {
    this._max = parseFloat(value);
  }

  isSeedUsed(): boolean {
    return this._seedUsed;
  }
  setSeedUsed(seedUsed: boolean): void {
    this._seedUsed = seedUsed;
  }

  getSeed(): string {
    return this._seed.toString();
  }
  setSeed(seed: string): void {
    this._seed = parseInt(seed, 10);
  }

  override process(notes: NoteList): NoteList {
    const range = this._max - this._min;
    const r = this._seedUsed ? new JavaRandom(this._seed) : null;

    for (const note of notes) {
      let fieldVal: number;
      try {
        fieldVal = parseFloat(note.getPField(this._pfield)!);
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(fieldVal)) {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      const randVal = (r ? r.nextDouble() : Math.random()) * range + this._min;
      note.setPField((fieldVal + randVal).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'RandomAddProcessor';
  }

  override deepCopy(): RandomAddProcessor {
    return new RandomAddProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('min').setText(this.getMin());
    elem.addElement('max').setText(this.getMax());
    elem.addElement('seedUsed').setText(this._seedUsed.toString());
    elem.addElement('seed').setText(this.getSeed());
    return elem;
  }

  static loadFromXML(data: Element): RandomAddProcessor {
    const proc = new RandomAddProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const mn = data.getTextString('min');
    if (mn !== null) proc._min = parseFloat(mn);
    const mx = data.getTextString('max');
    if (mx !== null) proc._max = parseFloat(mx);
    const su = data.getTextString('seedUsed');
    if (su !== null) proc._seedUsed = su.toLowerCase() === 'true';
    const sd = data.getTextString('seed');
    if (sd !== null) proc._seed = parseInt(sd, 10);
    return proc;
  }
}
