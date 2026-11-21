import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml, canonicalSeed } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { JavaRandom } from '../sound-objects/jmask-support';
import { readBoolean } from '../utilities/xml';

const JAVA_TYPE = 'blue.noteProcessor.RandomMultiplyProcessor';

/** Multiplies a p-field by a uniformly sampled value, with an optional reproducible seed. */
export class RandomMultiplyProcessor extends NoteProcessor {
  private _pfield = 4;
  private _min = 0.0;
  private _max = 1.0;
  private _seedUsed = false;
  private _seed = '0';

  /** Creates a random multiply processor initialized with its default settings. */
  constructor();
  /** Creates a random multiply processor using the source instance’s settings. */
  constructor(src: RandomMultiplyProcessor);
  constructor(src?: RandomMultiplyProcessor) {
    super();
    if (src) {
      this._pfield = src._pfield;
      this._min = src._min;
      this._max = src._max;
      this._seedUsed = src._seedUsed;
      this._seed = src._seed;
    }
  }

  /** Returns the one-based Csound p-field index. */
  getPfield(): string {
    return this._pfield.toString();
  }
  /** Sets the one-based Csound p-field index. */
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  /** Returns the minimum random value. */
  getMin(): string {
    return this._min.toString();
  }
  /** Sets the minimum random value. */
  setMin(value: string): void {
    this._min = parseFloat(value);
  }

  /** Returns the maximum random value. */
  getMax(): string {
    return this._max.toString();
  }
  /** Sets the maximum random value. */
  setMax(value: string): void {
    this._max = parseFloat(value);
  }

  /** Reports whether the random multiply processor uses the configured random seed. */
  isSeedUsed(): boolean {
    return this._seedUsed;
  }
  /** Controls whether generation uses the configured seed. */
  setSeedUsed(seedUsed: boolean): void {
    this._seedUsed = seedUsed;
  }

  /** Returns the pseudo-random seed. */
  getSeed(): string {
    return this._seed;
  }
  /** Sets the pseudo-random seed. */
  setSeed(seed: string | number): void {
    this._seed = canonicalSeed(seed);
  }

  override process(notes: NoteList): NoteList {
    const range = this._max - this._min;
    const r = this._seedUsed ? new JavaRandom(BigInt(this._seed)) : null;

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
      note.setPField((fieldVal * randVal).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'RandomMultiplyProcessor';
  }

  override deepCopy(): RandomMultiplyProcessor {
    return new RandomMultiplyProcessor(this);
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

  /** Reconstructs the random multiply processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): RandomMultiplyProcessor {
    validateProcessorXml(data, 'RandomMultiplyProcessor', context);
    const proc = new RandomMultiplyProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const mn = data.getTextString('min');
    if (mn !== null) proc._min = parseFloat(mn);
    const mx = data.getTextString('max');
    if (mx !== null) proc._max = parseFloat(mx);
    const seedUsed = data.getElement('seedUsed');
    if (seedUsed) proc._seedUsed = readBoolean(seedUsed, context);
    const sd = data.getTextString('seed');
    if (sd !== null) proc._seed = canonicalSeed(sd);
    return proc;
  }
}
