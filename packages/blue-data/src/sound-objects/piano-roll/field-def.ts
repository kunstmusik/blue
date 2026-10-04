/**
 * FieldDef — defines a custom field for PianoNote p-field generation.
 */
import { FieldType } from './field-type';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber } from '../../utilities/xml';

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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): FieldDef {
    checkRoot(data, 'fieldDef', context);
    checkShape(data, ['name', 'fieldType', 'min', 'max', 'default'], [], context);
    const definition = new FieldDef();
    const name = data.getAttribute('name');
    if (name !== null) {
      if (!name.trim())
        throw context.error({
          code: 'value',
          member: '@name',
          value: name,
          message: 'Field definition name must not be empty.',
          recovery: 'Supply a nonempty field name.',
        });
      definition._fieldName = name;
    }
    const type = data.getAttribute('fieldType');
    if (type !== null) {
      if (!Object.values(FieldType).includes(type as FieldType))
        throw context.error({
          code: 'value',
          member: '@fieldType',
          value: type,
          message: 'Unsupported field type.',
          recovery: 'Choose CONTINUOUS or DISCRETE.',
        });
      definition._fieldType = type as FieldType;
    }
    for (const attr of ['min', 'max', 'default'] as const) {
      const text = data.getAttribute(attr);
      if (text === null) continue;
      const value = parseXmlNumber(text, context.at(data), '@' + attr);
      if (attr === 'min') definition._minValue = value;
      if (attr === 'max') definition._maxValue = value;
      if (attr === 'default') definition._defaultValue = value;
    }
    if (
      definition._minValue > definition._maxValue ||
      definition._defaultValue < definition._minValue ||
      definition._defaultValue > definition._maxValue
    )
      throw context.error({
        code: 'value',
        message: 'Field range/default is inconsistent.',
        recovery: 'Supply an ordered range containing the default value.',
      });
    return definition;
  }
}
