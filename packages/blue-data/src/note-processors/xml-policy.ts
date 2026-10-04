import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import {
  checkShape,
  readText,
  parseXmlNumber,
  parseXmlInteger,
  parseXmlBoolean,
} from '../utilities/xml';

const fields: Record<string, readonly string[]> = {
  AddProcessor: ['pfield', 'pFieldIndex', 'value'],
  MultiplyProcessor: ['pfield', 'pFieldIndex', 'value'],
  EqualsProcessor: ['pfield', 'value'],
  InversionProcessor: ['pfield', 'value'],
  PchAddProcessor: ['pfield', 'value'],
  PchInversionProcessor: ['pfield', 'value'],
  RandomAddProcessor: ['pfield', 'min', 'max', 'seedUsed', 'seed'],
  RandomMultiplyProcessor: ['pfield', 'min', 'max', 'seedUsed', 'seed'],
  LineAddProcessor: ['pfield', 'lineAddString'],
  LineMultiplyProcessor: ['pfield', 'lineMultiplyString'],
  RetrogradeProcessor: [],
  RotateProcessor: ['noteIndex'],
  TimeWarpProcessor: ['timeWarpString'],
  SwitchProcessor: ['pfield1', 'pfield2'],
  SubListProcessor: ['start', 'end'],
  TuningProcessor: ['pfield', 'scale', 'baseFrequency'],
  PythonProcessor: ['code'],
  Code: ['code'],
};
export function canonicalSeed(value: string | number | bigint): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new RangeError('Seed number must be a safe integer.');
  const text = String(value).trim();
  if (!/^[+-]?\d+$/.test(text))
    throw new RangeError('Seed requires complete signed64 integer digits.');
  const seed = BigInt(text);
  if (seed < -9223372036854775808n || seed > 9223372036854775807n)
    throw new RangeError('Seed is outside signed64 range.');
  return seed.toString();
}
export function readSeed(node: Element, context: XmlLoadContext): string {
  const text = readText(node, context);
  try {
    return canonicalSeed(text);
  } catch (error) {
    throw context.at(node).error({
      code: 'value',
      value: text,
      message: String(error),
      recovery: 'Supply a signed64 decimal integer.',
    });
  }
}
export function validateMapping(text: string, context: XmlLoadContext, tempo = false): void {
  const tokens = text.trim().split(/\s+/);
  if (!text.trim() || tokens.length % 2)
    throw context.error({
      code: 'value',
      value: text,
      message: 'Mapping requires complete time/value pairs.',
      recovery: 'Supply ordered finite pairs.',
    });
  let previous = -1;
  for (let i = 0; i < tokens.length; i += 2) {
    const time = parseXmlNumber(tokens[i], context);
    const value = parseXmlNumber(tokens[i + 1], context);
    if (time < 0 || time < previous || (tempo && value <= 0))
      throw context.error({
        code: 'value',
        value: text,
        message: 'Mapping requires ordered nonnegative times and valid values.',
        recovery: 'Correct the complete mapping.',
      });
    previous = time;
  }
}
export function validateProcessorXml(data: Element, type: string, context: XmlLoadContext): void {
  const at = context.at(data);
  const actual = data.getAttribute('type');
  if (
    data.getName() !== 'noteProcessor' ||
    (actual !== type && actual !== `blue.noteProcessor.${type}`)
  )
    throw at.error({
      code: 'type',
      member: '@type',
      value: actual ?? '',
      message: 'Unexpected processor root or type.',
      recovery: 'Use the declared processor type.',
    });
  checkShape(data, ['type'], fields[type], context);
  for (const node of data.getElements()) {
    const name = node.getName();
    if (name === 'scale') continue;
    const text = readText(node, context);
    const child = context.at(node);
    if (name.startsWith('pfield') || name === 'pFieldIndex')
      parseXmlInteger(text, child, type === 'TuningProcessor' ? 4 : 1, 2147483647);
    else if (name === 'noteIndex' || name === 'start' || name === 'end')
      parseXmlInteger(text, child, name === 'end' ? 1 : -2147483648, 2147483647);
    else if (name === 'seedUsed') parseXmlBoolean(text, child);
    else if (name === 'seed') readSeed(node, context);
    else if (name.endsWith('String')) validateMapping(text, child, name === 'timeWarpString');
    else if (name !== 'code' && !(name === 'value' && type === 'EqualsProcessor')) {
      if (type === 'PchAddProcessor' && name === 'value')
        parseXmlInteger(text, child, -2147483648, 2147483647);
      else parseXmlNumber(text, child);
    }
  }
  const canonical = data.getElement('pfield');
  const alias = data.getElement('pFieldIndex');
  if (canonical && alias && Number(canonical.getTextString()) !== Number(alias.getTextString()))
    throw at.error({
      code: 'conflict',
      message: 'Conflicting pfield aliases.',
      recovery: 'Keep one consistent pfield.',
    });
  const min = data.getElement('min');
  const max = data.getElement('max');
  if (
    type.startsWith('Random') &&
    Number(min?.getTextString() ?? 0) > Number(max?.getTextString() ?? 1)
  )
    throw at.error({
      code: 'value',
      message: 'Random processor minimum exceeds maximum.',
      recovery: 'Correct the bounds.',
    });
}
