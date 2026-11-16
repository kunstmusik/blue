import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  checkShape,
  readText,
  parseXmlNumber,
  parseXmlInteger,
  parseXmlBoolean,
} from '../../utilities/xml';

const JMASK_FIELDS: Record<string, readonly string[]> = {
  Field: ['parameter'],
  Parameter: ['generator', 'mask', 'quantizer', 'accumulator'],
  Table: ['min', 'max', 'interpolationType', 'interpolation', 'points'],
  TablePoint: [],
  Mask: ['highTableEnabled', 'lowTableEnabled', 'low', 'high', 'mapValue', 'enabled', 'table'],
  Quantizer: [
    'gridSize',
    'strength',
    'offset',
    'gridSizeTableEnabled',
    'strengthTableEnabled',
    'offsetTableEnabled',
    'enabled',
    'table',
  ],
  Accumulator: [
    'highTableEnabled',
    'lowTableEnabled',
    'mode',
    'low',
    'high',
    'initialValue',
    'enabled',
    'table',
  ],
  Constant: ['value'],
  Random: ['min', 'max'],
  Oscillator: ['oscillatorType', 'phaseInit', 'frequency', 'freqTableEnabled', 'table', 'exponent'],
  Segment: ['table'],
  ItemList: ['listType', 'index', 'direction', 'listItems'],
  Probability: ['selectedIndex', 'probabilityGenerator'],
  Uniform: [],
  Triangle: [],
  Linear: ['direction'],
  Exponential: ['direction', 'lambda', 'lambdaTableEnabled', 'table'],
  Gaussian: ['sigma', 'mu', 'sigmaTableEnabled', 'muTableEnabled', 'table'],
  Cauchy: ['alpha', 'mu', 'alphaTableEnabled', 'muTableEnabled', 'table'],
  Beta: ['a', 'b', 'aTableEnabled', 'bTableEnabled', 'table'],
  Weibull: ['s', 't', 'sTableEnabled', 'tTableEnabled', 'table'],
};

const JMASK_TABLE_IDS: Record<string, readonly string[]> = {
  Mask: ['highTable', 'lowTable'],
  Accumulator: ['highTable', 'lowTable'],
  Quantizer: ['gridSizeTable', 'strengthTable', 'offsetTable'],
  Gaussian: ['sigmaTable', 'muTable'],
  Cauchy: ['alphaTable', 'muTable'],
  Beta: ['aTable', 'bTable'],
  Weibull: ['sTable', 'tTable'],
};

const JMASK_GENERATORS = ['Constant', 'Random', 'Oscillator', 'Segment', 'ItemList', 'Probability'];
const JMASK_PROBABILITY = [
  'Uniform',
  'Linear',
  'Triangle',
  'Exponential',
  'Gaussian',
  'Cauchy',
  'Beta',
  'Weibull',
];

export function jmaskType(data: Element, probability: boolean, context: XmlLoadContext): string {
  const type = data.getAttribute('type') ?? '';
  const choices = probability ? JMASK_PROBABILITY : JMASK_GENERATORS;
  const prefix = probability ? 'blue.soundObject.jmask.probability.' : 'blue.soundObject.jmask.';
  const name = choices.find((value) => type === value || type === prefix + value);
  if (!name)
    throw context.at(data).error({
      code: 'type',
      member: '@type',
      value: type,
      message: 'Unsupported JMask serialized type.',
      recovery: 'Use a declared generator type.',
    });
  return name;
}

export function validateJmaskXml(data: Element, owner: string, context: XmlLoadContext): void {
  const fail = (message: string): never => {
    throw context.at(data).error({
      code: 'value',
      message,
      recovery: 'Supply the complete supported JMask owner shape and values.',
    });
  };
  const generator = JMASK_GENERATORS.includes(owner);
  const probability = JMASK_PROBABILITY.includes(owner);
  const root = generator
    ? 'generator'
    : probability
      ? 'probabilityGenerator'
      : owner === 'TablePoint'
        ? 'point'
        : owner.toLowerCase();
  if (data.getName() !== root) fail('Unexpected JMask owner root.');
  if ((generator || probability) && jmaskType(data, probability, context) !== owner)
    fail('Mismatched JMask generator type.');
  const attrs =
    generator || probability
      ? ['type']
      : owner === 'Parameter'
        ? ['visible', 'name']
        : owner === 'Table'
          ? ['tableId']
          : owner === 'TablePoint'
            ? ['time', 'value']
            : [];
  checkShape(
    data,
    attrs,
    JMASK_FIELDS[owner],
    context,
    owner === 'Field'
      ? ['parameter']
      : owner === 'Probability'
        ? ['probabilityGenerator']
        : JMASK_TABLE_IDS[owner]
          ? ['table']
          : [],
  );
  const numeric = (name: string, fallback: number): number => {
    const node = data.getElement(name);
    return node ? parseXmlNumber(readText(node, context), context.at(node)) : fallback;
  };
  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const node = data.getElement(name);
    return node ? parseXmlInteger(readText(node, context), context.at(node), min, max) : fallback;
  };
  if (owner === 'TablePoint') {
    for (const name of ['time', 'value']) {
      const text = data.getAttribute(name);
      if (text === null) fail('Table point requires both coordinates.');
      else parseXmlNumber(text, context.at(data), '@' + name);
    }
  }
  if (owner === 'Parameter') {
    const visible = data.getAttribute('visible');
    if (visible !== null) parseXmlBoolean(visible, context.at(data), '@visible');
    const node = data.getElement('generator');
    if (!node) fail('JMask parameter requires exactly one generator.');
    const type = jmaskType(node!, false, context);
    if (data.getElement('mask') && !['Oscillator', 'Probability'].includes(type))
      fail('Generator does not support a mask.');
    if (
      data.getElement('quantizer') &&
      !['Random', 'Oscillator', 'Segment', 'Probability'].includes(type)
    )
      fail('Generator does not support a quantizer.');
  }
  if (owner === 'Field' && data.getElements('parameter').toArray().length < 3)
    fail('Executable JMask requires p1, p2 and p3 definitions.');
  if (owner === 'Table') {
    if (numeric('min', 0) > numeric('max', 1)) fail('Table minimum exceeds maximum.');
    integer('interpolationType', 1, 0, 2);
  }
  if (owner === 'Random' && numeric('min', 0) > numeric('max', 1))
    fail('Random minimum exceeds maximum.');
  if (['Mask', 'Accumulator'].includes(owner) && numeric('low', 0) > numeric('high', 1))
    fail('Low bound exceeds high bound.');
  if (owner === 'Accumulator') integer('mode', 0, 0, 3);
  if (owner === 'Oscillator') integer('oscillatorType', 0, 0, 7);
  if (owner === 'Linear') integer('direction', 0, 0, 1);
  if (owner === 'Exponential') integer('direction', 0, 0, 2);
  const positives: Record<string, readonly string[]> = {
    Exponential: ['lambda'],
    Gaussian: ['sigma'],
    Cauchy: ['alpha'],
    Beta: ['a', 'b'],
    Weibull: ['s', 't'],
  };
  for (const member of positives[owner] ?? [])
    if (numeric(member, 1) <= 0) fail(member + ' must be positive.');
  if (
    owner === 'Quantizer' &&
    data.getElement('enabled') &&
    parseXmlBoolean(
      readText(data.getElement('enabled')!, context),
      context.at(data.getElement('enabled')!),
    ) &&
    numeric('gridSize', 1) <= 0
  )
    fail('Quantizer grid must be positive.');
  if (owner === 'Probability') {
    integer('selectedIndex', 0, 0, 7);
    const slots = data.getElements('probabilityGenerator').toArray();
    if (
      slots.length !== 8 ||
      slots.some((slot, index) => jmaskType(slot, true, context) !== JMASK_PROBABILITY[index])
    )
      fail('Probability requires all eight declared slots in order.');
  }
  if (owner === 'ItemList') {
    integer('listType', 0, 0, 3);
    integer('direction', 0, 0, 1);
    const list = data.getElement('listItems');
    const count = list?.getElements('item').toArray().length ?? 0;
    integer('index', 0, 0, Math.max(0, count - 1));
  }
  if (owner === 'Segment' && !data.getElement('table')) fail('Segment requires its table.');
  const seenTables = new Set<string>();
  for (const node of data.getElements()) {
    const name = node.getName();
    if (name === 'generator' || name === 'probabilityGenerator')
      validateJmaskXml(node, jmaskType(node, name === 'probabilityGenerator', context), context);
    else if (name === 'parameter') validateJmaskXml(node, 'Parameter', context);
    else if (['mask', 'quantizer', 'accumulator'].includes(name))
      validateJmaskXml(node, name[0].toUpperCase() + name.slice(1), context);
    else if (name === 'table') {
      const id = node.getAttribute('tableId');
      const ids = JMASK_TABLE_IDS[owner];
      if (ids && (!id || !ids.includes(id) || seenTables.has(id)))
        fail('Unknown or duplicate contextual table selector.');
      if (!ids && id !== null) fail('This owner has no contextual table selectors.');
      if (id) seenTables.add(id);
      validateJmaskXml(node, 'Table', context);
    } else if (name === 'points') {
      checkShape(node, [], ['point'], context, ['point']);
      let previous = -Infinity;
      for (const point of node.getElements('point')) {
        validateJmaskXml(point, 'TablePoint', context);
        const time = Number(point.getAttribute('time'));
        if (time < previous)
          throw context.at(point).error({
            code: 'value',
            member: '@time',
            value: point.getAttribute('time')!,
            message: 'Table points must retain ascending time order.',
            recovery: 'Correct the ordered finite coordinates.',
          });
        previous = time;
      }
    } else if (name === 'listItems') {
      checkShape(node, [], ['item'], context, ['item']);
      for (const item of node.getElements('item'))
        parseXmlNumber(readText(item, context), context.at(item));
    } else if (name.endsWith('Enabled') || name === 'enabled')
      parseXmlBoolean(readText(node, context), context.at(node));
    else parseXmlNumber(readText(node, context), context.at(node));
  }
}
