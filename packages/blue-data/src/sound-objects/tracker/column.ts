import { Scale } from '../piano-roll/scale';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readText,
  readBoolean,
  readInt,
  readDouble,
} from '../../utilities/xml';
import { ObjRefLoadMap } from '../../serialization/obj-ref-map';
import { getBaseTen } from '../../utilities/score';

/** Tracker column that defines how a step value is interpreted and emitted into a note. */
export class Column {
  /** Tracker column type code for Csound octave.pitch-class values. */
  public static readonly TYPE_PCH = 0;
  /** Tracker column type code for Blue scale-degree pitch values. */
  public static readonly TYPE_BLUE_PCH = 1;
  /** Tracker column type code for MIDI pitch number values. */
  public static readonly TYPE_MIDI = 2;
  /** Tracker column type code for literal string values. */
  public static readonly TYPE_STR = 3;
  /** Tracker column type code for numeric values. */
  public static readonly TYPE_NUM = 4;

  /** Names of the supported tracker column types in type-code order. */
  public static readonly TYPES = ['PCH', 'blue PCH', 'MIDI', 'String', 'Number'];

  private _scale: Scale;
  private _outputFrequency = true;
  protected _name = 'col';
  private _rangeMin = 0;
  private _rangeMax = 0;
  protected _type = Column.TYPE_STR;
  private _restrictedToInteger = false;
  private _usingRange = false;

  /** Creates a default column or copies a supplied instance. */
  constructor(other?: Column) {
    if (other) {
      this._scale = new Scale(other._scale);
      this._outputFrequency = other._outputFrequency;
      this._name = other._name;
      this._rangeMin = other._rangeMin;
      this._rangeMax = other._rangeMax;
      this._type = other._type;
      this._restrictedToInteger = other._restrictedToInteger;
      this._usingRange = other._usingRange;
    } else {
      this._scale = new Scale();
    }
  }

  /** Returns the name stored on the column. */
  getName(): string {
    return this._name;
  }
  /** Sets the name stored on the column. */
  setName(name: string): void {
    this._name = name;
  }

  /** Returns the type stored on the column. */
  getType(): number {
    return this._type;
  }
  /** Sets the type stored on the column. */
  setType(type: number): void {
    this._type = type;
  }

  /** Reports whether the column accepts only whole numeric values. */
  isRestrictedToInteger(): boolean {
    return this._restrictedToInteger;
  }
  /** Sets the restricted to integer stored on the column. */
  setRestrictedToInteger(restricted: boolean): void {
    this._restrictedToInteger = restricted;
  }

  /** Reports whether the column limits values to its configured bounds. */
  isUsingRange(): boolean {
    return this._usingRange;
  }
  /** Sets the using range stored on the column. */
  setUsingRange(using: boolean): void {
    this._usingRange = using;
  }

  /** Returns the range min stored on the column. */
  getRangeMin(): number {
    return this._rangeMin;
  }
  /** Sets the range min stored on the column. */
  setRangeMin(min: number): void {
    this._rangeMin = min;
  }

  /** Returns the range max stored on the column. */
  getRangeMax(): number {
    return this._rangeMax;
  }
  /** Sets the range max stored on the column. */
  setRangeMax(max: number): void {
    this._rangeMax = max;
  }

  /** Returns the tuning scale used to interpret note pitches. */
  getScale(): Scale {
    return this._scale;
  }
  /** Sets the tuning scale used to interpret note pitches. */
  setScale(scale: Scale): void {
    this._scale = scale;
  }

  /** Reports whether pitch values are emitted as frequency. */
  isOutputFrequency(): boolean {
    return this._outputFrequency;
  }
  /** Sets the output frequency stored on the column. */
  setOutputFrequency(output: boolean): void {
    this._outputFrequency = output;
  }

  /** Checks whether supplied text is valid for this column's type and bounds. */
  isValid(input: string): boolean {
    const val = input.trim();
    if (val.length === 0) return true;

    let parts: string[];
    let retVal = false;

    switch (this._type) {
      case Column.TYPE_PCH:
        parts = val.split('.');
        if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
          retVal = false;
        } else {
          const fVal = parseFloat(val);
          retVal = !isNaN(fVal);
        }
        break;
      case Column.TYPE_BLUE_PCH:
        parts = val.split('.');
        if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
          retVal = false;
        } else {
          try {
            parseInt(parts[0], 10);
            parseInt(parts[1], 10);
            retVal = !parts[1].startsWith('0') || parts[1].length <= 1;
          } catch {
            retVal = false;
          }
        }
        break;
      case Column.TYPE_NUM:
        try {
          if (this._restrictedToInteger) {
            const num = parseInt(val, 10);
            if (this._usingRange) {
              retVal = num >= Math.floor(this._rangeMin) && num <= Math.floor(this._rangeMax);
            } else {
              retVal = true;
            }
          } else {
            const num = parseFloat(val);
            if (this._usingRange) {
              retVal = num >= this._rangeMin && num <= this._rangeMax;
            } else {
              retVal = true;
            }
          }
        } catch {
          retVal = false;
        }
        break;
      case Column.TYPE_MIDI:
        try {
          const num = parseInt(val, 10);
          retVal = num >= 0 && num < 128;
        } catch {
          retVal = false;
        }
        break;
      case Column.TYPE_STR:
        retVal = true;
        break;
    }
    return retVal;
  }

  /** Returns the initial value when no explicit value is supplied. */
  getDefaultValue(): string {
    switch (this._type) {
      case Column.TYPE_PCH:
      case Column.TYPE_BLUE_PCH:
        return '8.00';
      case Column.TYPE_NUM:
        if (this._restrictedToInteger) {
          return Math.floor(this._rangeMax).toString();
        }
        return this._rangeMax.toString();
      case Column.TYPE_MIDI:
        return '60';
      case Column.TYPE_STR:
        return '';
      default:
        return '';
    }
  }

  /** Returns the value produced by stepping the supplied cell value up. */
  getIncrementValue(val: string): string | null {
    switch (this._type) {
      case Column.TYPE_PCH: {
        const baseTen = getBaseTen(val) + 1;
        const oct = Math.floor(baseTen / 12);
        const pch = baseTen % 12;
        let pchStr = pch.toString();
        if (pch < 10) pchStr = '0' + pchStr;
        return oct + '.' + pchStr;
      }
      case Column.TYPE_BLUE_PCH: {
        const parts = val.split('.');
        const scaleDegrees = this._scale.getNumScaleDegrees();
        const iBaseTen = parseInt(parts[0], 10) * scaleDegrees + parseInt(parts[1], 10) + 1;
        const iOctave = Math.floor(iBaseTen / scaleDegrees);
        const iScaleDegree = iBaseTen % scaleDegrees;
        return iOctave + '.' + iScaleDegree;
      }
      case Column.TYPE_NUM: {
        let dNumVal = parseFloat(val) + 1;
        if (this._usingRange && dNumVal > this._rangeMax) {
          dNumVal = this._rangeMax;
        }
        return this._restrictedToInteger ? Math.floor(dNumVal).toString() : dNumVal.toString();
      }
      case Column.TYPE_MIDI: {
        const midiVal = parseInt(val, 10) + 1;
        if (midiVal > 127) return null;
        return midiVal.toString();
      }
      case Column.TYPE_STR:
        return null;
      default:
        return null;
    }
  }

  /** Returns the value produced by stepping the supplied cell value down. */
  getDecrementValue(val: string): string | null {
    switch (this._type) {
      case Column.TYPE_PCH: {
        const baseTen = getBaseTen(val) - 1;
        const oct = Math.floor(baseTen / 12);
        const pch = baseTen % 12;
        let pchStr = pch.toString();
        if (pch < 10) pchStr = '0' + pchStr;
        return oct + '.' + pchStr;
      }
      case Column.TYPE_BLUE_PCH: {
        const parts = val.split('.');
        const scaleDegrees = this._scale.getNumScaleDegrees();
        const iBaseTen = parseInt(parts[0], 10) * scaleDegrees + parseInt(parts[1], 10) - 1;
        const iOctave = Math.floor(iBaseTen / scaleDegrees);
        const iScaleDegree = iBaseTen % scaleDegrees;
        return iOctave + '.' + iScaleDegree;
      }
      case Column.TYPE_NUM: {
        let dNumVal = parseFloat(val) - 1;
        if (this._usingRange && dNumVal < this._rangeMin) {
          dNumVal = this._rangeMin;
        }
        return this._restrictedToInteger ? Math.floor(dNumVal).toString() : dNumVal.toString();
      }
      case Column.TYPE_MIDI: {
        const midiVal = parseInt(val, 10) - 1;
        if (midiVal < 0) return null;
        return midiVal.toString();
      }
      case Column.TYPE_STR:
        return null;
      default:
        return null;
    }
  }

  /** Serializes the column and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const retVal = new Element('column');
    retVal.addElement('name').setText(this._name);
    retVal.addElement('rangeMin').setText(this._rangeMin.toString());
    retVal.addElement('rangeMax').setText(this._rangeMax.toString());
    retVal.addElement('type').setText(this._type.toString());
    retVal.addElement('restrictedToInteger').setText(this._restrictedToInteger.toString());
    retVal.addElement('usingRange').setText(this._usingRange.toString());
    retVal.addElement(this._scale.saveAsXML());
    retVal.addElement('outputFrequency').setText(this._outputFrequency.toString());
    return retVal;
  }

  /** Reconstructs the column from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context = new XmlLoadContext(data),
  ): Column {
    checkRoot(data, ['column', 'track'], context);
    checkShape(
      data,
      [],
      [
        'name',
        'rangeMin',
        'rangeMax',
        'type',
        'restrictedToInteger',
        'usingRange',
        'scale',
        'outputFrequency',
      ],
      context,
    );
    const retVal = new Column();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      switch (nodeName) {
        case 'scale':
          retVal.setScale(Scale.loadFromXML(node, context));
          break;
        case 'outputFrequency':
          retVal._outputFrequency = readBoolean(node, context);
          break;
        case 'name':
          retVal._name = readText(node, context);
          break;
        case 'rangeMin':
          retVal._rangeMin = readDouble(node, context);
          break;
        case 'rangeMax':
          retVal._rangeMax = readDouble(node, context);
          break;
        case 'type':
          retVal._type = readInt(node, context, 0, 4);
          break;
        case 'restrictedToInteger':
          retVal._restrictedToInteger = readBoolean(node, context);
          break;
        case 'usingRange':
          retVal._usingRange = readBoolean(node, context);
          break;
      }
    }
    return retVal;
  }
}

export class PitchColumn extends Column {
  constructor() {
    super();
    this._name = 'pch';
    this._type = Column.TYPE_PCH;
  }
}

export class AmpColumn extends Column {
  constructor() {
    super();
    this._name = 'db';
    this._type = Column.TYPE_NUM;
    this.setRangeMax(90.0);
  }
}
