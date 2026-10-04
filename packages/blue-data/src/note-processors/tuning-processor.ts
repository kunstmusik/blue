import { XmlLoadContext } from '../serialization/xml-load';
import { readText, parseXmlNumber } from '../utilities/xml';
import { validateProcessorXml } from './xml-policy';
import { Scale } from '../sound-objects/piano-roll/scale';

export interface TuningScaleReference {
  filename: string;
  baseFrequency?: number;
}
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
  private _scale = new Scale();
  private _scaleReference: TuningScaleReference | null = null;

  constructor();
  constructor(src: TuningProcessor);
  constructor(src?: TuningProcessor) {
    super();
    this._scale.baseFrequency = 261.626;
    this._scale.ratios = [...TWELVE_TET_RATIOS];
    if (src) {
      this._pfield = src._pfield;
      this._scale = new Scale(src._scale);
      this._scaleReference = src._scaleReference ? { ...src._scaleReference } : null;
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
    return this._scale.baseFrequency.toString();
  }
  setBaseFrequency(baseFrequency: string): void {
    const value = Number(baseFrequency);
    if (!Number.isFinite(value) || value <= 0)
      throw new RangeError('Tuning frequency must be positive and finite.');
    if (value === this._scale.baseFrequency) return;
    this._scale.baseFrequency = value;
    if (this._scaleReference) this._scaleReference.baseFrequency = value;
  }

  getRatios(): number[] {
    return this._scale.ratios;
  }
  setRatios(ratios: number[]): void {
    this._scale.ratios = ratios;
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
    const numScaleDegrees = this._scale.ratios.length;

    if (pitchIndex >= numScaleDegrees) {
      oct += Math.trunc(pitchIndex / numScaleDegrees);
      pitchIndex = pitchIndex % numScaleDegrees;
    }

    return (
      this._scale.baseFrequency *
      this._scale.ratios[pitchIndex] *
      Math.pow(this._scale.octave, oct - 8)
    );
  }

  getScaleReference(): TuningScaleReference | null {
    return this._scaleReference ? { ...this._scaleReference } : null;
  }

  resolveScale(scale: Scale): void {
    this._scale = Scale.loadFromXML(scale.saveAsXML());
    if (this._scaleReference?.baseFrequency !== undefined)
      this._scale.baseFrequency = this._scaleReference.baseFrequency;
    this._scaleReference = null;
  }

  override process(notes: NoteList): NoteList {
    if (this._scaleReference)
      throw new NoteProcessorException(
        'Unresolved external tuning scale: ' + this._scaleReference.filename,
        this._pfield,
      );
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
    if (this._scaleReference) {
      elem.addElement('scale').setText(this._scaleReference.filename);
      if (this._scaleReference.baseFrequency !== undefined)
        elem.addElement('baseFrequency').setText(String(this._scaleReference.baseFrequency));
    } else elem.addElement(this._scale.saveAsXML());
    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TuningProcessor {
    validateProcessorXml(data, 'TuningProcessor', context);
    const proc = new TuningProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = Number(pf);
    const top = data.getElement('baseFrequency');
    const override = top ? parseXmlNumber(readText(top, context), context.at(top)) : undefined;
    if (override !== undefined && override <= 0)
      throw context.at(top!).error({
        code: 'value',
        message: 'Tuning frequency must be positive.',
        recovery: 'Supply a positive frequency.',
      });
    const scale = data.getElement('scale');
    if (scale && scale.getElements().toArray().length === 0) {
      const filename = readText(scale, context);
      if (!filename.trim())
        throw context.at(scale).error({
          code: 'value',
          message: 'Empty external scale reference.',
          recovery: 'Supply a scale filename.',
        });
      proc._scaleReference = {
        filename,
        ...(override === undefined ? {} : { baseFrequency: override }),
      };
    } else if (scale) {
      const ratios = scale.getElement('ratios');
      if (ratios && !ratios.getElements().toArray().length && ratios.getTextString().trim()) {
        const clone = scale.clone();
        context.anchor(clone, scale);
        const target = clone.getElement('ratios')!;
        const tokens = readText(ratios, context).trim().split(/\s+/);
        target.setText('');
        for (const token of tokens) target.addElement('ratio').setText(token);
        proc._scale = Scale.loadFromXML(clone, context);
      } else proc._scale = Scale.loadFromXML(scale, context);
      const nested = scale.getElement('baseFrequency');
      if (override !== undefined && nested && override !== proc._scale.baseFrequency)
        throw context.at(top!).error({
          code: 'conflict',
          message: 'Conflicting tuning frequency values.',
          recovery: 'Keep one consistent frequency.',
        });
    }
    if (override !== undefined) proc._scale.baseFrequency = override;
    return proc;
  }
}
