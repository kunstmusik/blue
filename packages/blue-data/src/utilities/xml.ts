/**
 * XML utilities — helper functions for reading/writing common XML patterns.
 * Mirrors the Java XMLUtilities class.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';

/** Reject an unexpected owner root before reading its contents. */
export function checkRoot(
  elem: Element,
  expected: string | readonly string[],
  context = new XmlLoadContext(elem),
): void {
  const names = typeof expected === 'string' ? [expected] : expected;
  const actual = elem.getName();
  if (names.includes(actual)) return;
  throw context.at(elem).error({
    code: 'root',
    member: '#root',
    value: actual,
    message: `Unexpected XML root ${actual}; expected ${names.join(' or ')}.`,
    recovery: `Use one of the supported root elements: ${names.join(', ')}.`,
  });
}

/** Check an owner's immediate grammar; nested owners still validate themselves. */
export function checkShape(
  elem: Element,
  attributes: readonly string[],
  children: readonly string[],
  context = new XmlLoadContext(elem),
  repeated: readonly string[] = [],
  scalar = false,
): void {
  const at = context.at(elem);
  for (const attribute of elem.getAttributeNames()) {
    if (!attributes.includes(attribute))
      throw at.error({
        code: 'member',
        member: `@${attribute}`,
        value: elem.getAttribute(attribute)!,
        message: `Unexpected attribute ${attribute}.`,
        recovery: 'Remove or convert the unsupported attribute in a compatible editor.',
      });
  }
  if (!scalar && elem.getTextString().trim() !== '') {
    throw at.error({
      code: 'value',
      member: '#text',
      value: elem.getTextString().slice(0, 120),
      message: 'Container contains meaningful direct text.',
      recovery: 'Move the text to a supported scalar field.',
    });
  }
  const counts = new Map<string, number>();
  for (const child of elem.getElements()) {
    const name = child.getName();
    if (!children.includes(name))
      throw context.at(child).error({
        code: 'member',
        member: name,
        message: `Unexpected element ${name}.`,
        recovery: 'Remove or convert the unsupported element in a compatible editor.',
      });
    const count = (counts.get(name) ?? 0) + 1;
    counts.set(name, count);
    if (count > 1 && !repeated.includes(name))
      throw context.at(child).error({
        code: 'cardinality',
        member: name,
        message: `Duplicate singleton ${name}.`,
        recovery: 'Keep one unambiguous value.',
      });
  }
}

export function readText(elem: Element, context = new XmlLoadContext(elem)): string {
  checkShape(elem, [], [], context, [], true);
  return elem.getTextString();
}

export function parseXmlNumber(text: string, context: XmlLoadContext, member = '#text'): number {
  const token = text.trim();
  const value = Number(token);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) || !Number.isFinite(value)) {
    throw context.error({
      code: 'value',
      member,
      value: text,
      message: 'Expected a complete finite numeric token.',
      recovery: 'Supply a finite decimal number without trailing content.',
    });
  }
  return value;
}

export function parseXmlInteger(
  text: string,
  context: XmlLoadContext,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  member = '#text',
): number {
  const token = text.trim();
  const value = Number(token);
  if (!/^[+-]?\d+$/.test(token) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw context.error({
      code: 'value',
      member,
      value: text,
      message: `Expected an exact integer between ${min} and ${max}.`,
      recovery: 'Supply an integer within the supported range.',
    });
  }
  return value;
}

export function parseXmlBoolean(text: string, context: XmlLoadContext, member = '#text'): boolean {
  const token = text.trim().toLowerCase();
  if (token !== 'true' && token !== 'false')
    throw context.error({
      code: 'value',
      member,
      value: text,
      message: 'Expected true or false.',
      recovery: 'Supply a boolean token.',
    });
  return token === 'true';
}

export function readEnum<T extends string>(
  elem: Element,
  values: readonly T[],
  context = new XmlLoadContext(elem),
): T {
  const token = readText(elem, context).trim();
  if (!values.includes(token as T))
    throw context.at(elem).error({
      code: 'value',
      member: '#text',
      value: token,
      message: `Expected one of ${values.join(', ')}.`,
      recovery: 'Choose a supported enum value.',
    });
  return token as T;
}

/**
 * Write an integer value as a named XML element.
 * Creates: <name>value</name>
 */
export function writeInt(name: string, value: number): Element {
  const elem = new Element(name);
  elem.setText(value.toString());
  return elem;
}

/**
 * Read an integer value from a named XML element.
 */
export function readInt(
  elem: Element,
  context = new XmlLoadContext(elem),
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  return parseXmlInteger(readText(elem, context), context.at(elem), min, max);
}

/**
 * Write a double value as a named XML element.
 * Creates: <name>value</name>
 */
export function writeDouble(name: string, value: number): Element {
  const elem = new Element(name);
  if (!Number.isFinite(value)) {
    elem.setText(value.toString());
    return elem;
  }
  const text = value.toString();
  elem.setText(text.includes('.') || text.includes('e') || text.includes('E') ? text : text + '.0');
  return elem;
}

/**
 * Read a double value from a named XML element.
 */
export function readDouble(elem: Element, context = new XmlLoadContext(elem)): number {
  return parseXmlNumber(readText(elem, context), context.at(elem));
}

/**
 * Write a boolean value as a named XML element.
 * Creates: <name>true|false</name>
 */
export function writeBoolean(name: string, value: boolean): Element {
  const elem = new Element(name);
  elem.setText(value.toString());
  return elem;
}

/**
 * Read a boolean value from a named XML element.
 */
export function readBoolean(elem: Element, context = new XmlLoadContext(elem)): boolean {
  return parseXmlBoolean(readText(elem, context), context.at(elem));
}
