/**
 * Field — a value instance for a PianoNote's custom field.
 */
import { FieldDef } from './field-def';
import { Element } from '../../serialization/xml-reader';

export class Field {
  private _fieldDef: FieldDef;
  private _value: number;

  constructor(fieldDef: FieldDef) {
    this._fieldDef = fieldDef;
    this._value = fieldDef.convertToFieldType(fieldDef.getDefaultValue());
  }

  getFieldDef(): FieldDef {
    return this._fieldDef;
  }

  getValue(): number {
    return this._fieldDef.convertToFieldType(this._value);
  }

  setValue(value: number): void {
    const clamped = Math.max(
      this._fieldDef.getMinValue(),
      Math.min(value, this._fieldDef.getMaxValue()),
    );
    this._value = this._fieldDef.convertToFieldType(clamped);
  }

  saveAsXML(): Element {
    const elem = new Element('field');
    elem.setAttribute('name', this._fieldDef.getFieldName());
    elem.setAttribute('val', this.getValue().toString());
    return elem;
  }

  static loadFromXML(data: Element, fieldTypes: Map<string, FieldDef>): Field {
    const fieldName = data.getAttribute('name') ?? '';
    const fieldDef = fieldTypes.get(fieldName);
    if (!fieldDef) {
      // Create a placeholder fieldDef if not found
      const placeholder = new FieldDef();
      placeholder.setFieldName(fieldName);
      const f = new Field(placeholder);
      const valStr = data.getAttribute('val');
      if (valStr) f.setValue(parseFloat(valStr));
      return f;
    }
    const f = new Field(fieldDef);
    const valStr = data.getAttribute('val');
    if (valStr) f.setValue(parseFloat(valStr));
    return f;
  }
}
