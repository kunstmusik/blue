/**
 * FieldDef — defines a custom field for PianoNote p-field generation.
 */
import { FieldType } from './field-type';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber } from '../../utilities/xml';

/** Defines a named piano-roll field, its numeric bounds, and its default value. */
export class FieldDef {
  private _fieldName = 'field';
  private _minValue = 0.0;
  private _maxValue = 1.0;
  private _defaultValue = 1.0;
  private _fieldType: FieldType = FieldType.CONTINUOUS;

  /** Returns the field name stored on the field def. */
  getFieldName(): string {
    return this._fieldName;
  }
  /** Sets the field name stored on the field def. */
  setFieldName(name: string): void {
    this._fieldName = name;
  }

  /** Returns the lower bound for configured values. */
  getMinValue(): number {
    return this._minValue;
  }
  /** Sets the lower bound for configured values. */
  setMinValue(v: number): void {
    this._minValue = v;
  }

  /** Returns the upper bound for configured values. */
  getMaxValue(): number {
    return this._maxValue;
  }
  /** Sets the upper bound for configured values. */
  setMaxValue(v: number): void {
    this._maxValue = v;
  }

  /** Returns the initial value when no explicit value is supplied. */
  getDefaultValue(): number {
    return this._defaultValue;
  }
  /** Sets the initial value when no explicit value is supplied. */
  setDefaultValue(v: number): void {
    this._defaultValue = v;
  }

  /** Returns the field type stored on the field def. */
  getFieldType(): FieldType {
    return this._fieldType;
  }
  /** Sets the field type stored on the field def. */
  setFieldType(t: FieldType): void {
    this._fieldType = t;
  }

  /** Converts a numeric field value to the representation used by the selected field type. */
  convertToFieldType(val: number): number {
    if (this._fieldType === FieldType.DISCRETE) {
      return Math.round(val);
    }
    return val;
  }

  /** Serializes the field def and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('fieldDef');
    elem.setAttribute('name', this._fieldName);
    elem.setAttribute('fieldType', this._fieldType);
    elem.setAttribute('min', this._minValue.toString());
    elem.setAttribute('max', this._maxValue.toString());
    elem.setAttribute('default', this._defaultValue.toString());
    return elem;
  }

  /** Reconstructs the field def from its Blue XML element, using the supplied diagnostic context when provided. */
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
