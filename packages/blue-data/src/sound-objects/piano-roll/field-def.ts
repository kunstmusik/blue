/**
 * FieldDef — defines a custom field for PianoNote p-field generation.
 */
import { FieldType } from './field-type';
import { Element } from '../../serialization/xml-reader';

export class FieldDef {
  private _fieldName = 'field';
  private _minValue = 0.0;
  private _maxValue = 1.0;
  private _defaultValue = 1.0;
  private _fieldType: FieldType = FieldType.CONTINUOUS;

  getFieldName(): string {
    return this._fieldName;
  }
  setFieldName(name: string): void {
    this._fieldName = name;
  }

  getMinValue(): number {
    return this._minValue;
  }
  setMinValue(v: number): void {
    this._minValue = v;
  }

  getMaxValue(): number {
    return this._maxValue;
  }
  setMaxValue(v: number): void {
    this._maxValue = v;
  }

  getDefaultValue(): number {
    return this._defaultValue;
  }
  setDefaultValue(v: number): void {
    this._defaultValue = v;
  }

  getFieldType(): FieldType {
    return this._fieldType;
  }
  setFieldType(t: FieldType): void {
    this._fieldType = t;
  }

  convertToFieldType(val: number): number {
    if (this._fieldType === FieldType.DISCRETE) {
      return Math.round(val);
    }
    return val;
  }

  saveAsXML(): Element {
    const elem = new Element('fieldDef');
    elem.setAttribute('name', this._fieldName);
    elem.setAttribute('fieldType', this._fieldType);
    elem.setAttribute('min', this._minValue.toString());
    elem.setAttribute('max', this._maxValue.toString());
    elem.setAttribute('default', this._defaultValue.toString());
    return elem;
  }

  static loadFromXML(data: Element): FieldDef {
    const fd = new FieldDef();
    const name = data.getAttribute('name');
    if (name) fd._fieldName = name;
    const ft = data.getAttribute('fieldType');
    if (ft && Object.values(FieldType).includes(ft as FieldType)) {
      fd._fieldType = ft as FieldType;
    }
    const min = data.getAttribute('min');
    if (min) fd._minValue = parseFloat(min);
    const max = data.getAttribute('max');
    if (max) fd._maxValue = parseFloat(max);
    const def = data.getAttribute('default');
    if (def) fd._defaultValue = parseFloat(def);
    return fd;
  }
}
