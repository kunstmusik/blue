/**
 * Field — a value instance for a PianoNote's custom field.
 */
import { FieldDef } from './field-def';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber } from '../../utilities/xml';

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

  static loadFromXML(
    data: Element,
    fieldTypes: Map<string, FieldDef>,
    context = new XmlLoadContext(data),
  ): Field {
    checkRoot(data, 'field', context);
    checkShape(data, ['name', 'val'], [], context);
    const name = data.getAttribute('name');
    const definition = name === null ? undefined : fieldTypes.get(name);
    if (!definition)
      throw context.error({
        code: 'reference',
        member: '@name',
        value: name ?? '',
        message: 'Piano note field has no declared definition.',
        recovery: 'Declare this field once in the enclosing PianoRoll.',
      });
    const text = data.getAttribute('val');
    if (text === null)
      throw context.error({
        code: 'value',
        member: '@val',
        message: 'Field value is required.',
        recovery: 'Supply a finite field value.',
      });
    const value = parseXmlNumber(text, context.at(data), '@val');
    if (value < definition.getMinValue() || value > definition.getMaxValue())
      throw context.error({
        code: 'value',
        member: '@val',
        value: text,
        message: 'Field value is outside its declared range.',
        recovery: 'Supply a value within the field range.',
      });
    const field = new Field(definition);
    field.setValue(value);
    return field;
  }
}
