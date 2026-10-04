import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readText,
  parseXmlInteger,
  parseXmlNumber,
  parseXmlBoolean,
} from '../../utilities/xml';
import { parseJavaDecimal, normalizeLegacyResolution } from '../../automation/java-decimal';
import { isValidBsbColor } from './bsb-color';

const common = ['objectName', 'x', 'y', 'comment', 'id', 'parameterName'];
const numericRange = ['minimum', 'maximum', 'value'];
const slider = [
  ...numericRange,
  'bdresolution',
  'resolution',
  'randomizable',
  'valueDisplayEnabled',
];
const bank = [
  'minimum',
  'maximum',
  'bdresolution',
  'resolution',
  'gap',
  'randomizable',
  'valueDisplayEnabled',
  'bsbObject',
];
const owners: Record<string, readonly string[]> = {
  BSBGroup: [
    'groupName',
    'backgroundColor',
    'borderColor',
    'labelTextColor',
    'titleEnabled',
    'width',
    'height',
    'font',
    'bsbObject',
  ],
  BSBKnob: [
    ...numericRange,
    'knobWidth',
    'randomizable',
    'valueDisplayEnabled',
    'label',
    'labelEnabled',
    'font',
  ],
  BSBHSlider: [...slider, 'sliderWidth'],
  BSBVSlider: [...slider, 'sliderHeight'],
  BSBHSliderBank: [...bank, 'sliderWidth'],
  BSBVSliderBank: [...bank, 'sliderHeight'],
  BSBValue: ['minimum', 'maximum', 'defaultValue'],
  BSBCheckBox: ['label', 'selected', 'randomizable'],
  BSBDropdown: ['selectedIndex', 'fontSize', 'randomizable', 'bsbDropdownItemList'],
  BSBXYController: [
    'xValue',
    'yValue',
    'xMin',
    'xMax',
    'yMin',
    'yMax',
    'width',
    'height',
    'valueDisplayEnabled',
    'randomizable',
  ],
  BSBLabel: ['label', 'font'],
  BSBTextField: ['value', 'textFieldWidth'],
  BSBFileSelector: ['fileName', 'textFieldWidth', 'stringChannelEnabled'],
  BSBSubChannelDropdown: ['channelOutput'],
  BSBLineObject: [
    'canvasWidth',
    'canvasHeight',
    'xMax',
    'relativeXValues',
    'separatorType',
    'commaSeparated',
    'leadingZero',
    'locked',
    'lines',
  ],
};
const versioned = [
  'BSBKnob',
  'BSBHSlider',
  'BSBVSlider',
  'BSBDropdown',
  'BSBXYController',
  'BSBLabel',
];
const automatable = [
  'BSBKnob',
  'BSBHSlider',
  'BSBVSlider',
  'BSBHSliderBank',
  'BSBVSliderBank',
  'BSBValue',
  'BSBCheckBox',
  'BSBDropdown',
  'BSBXYController',
];
const bools = [
  'automationAllowed',
  'randomizable',
  'valueDisplayEnabled',
  'labelEnabled',
  'selected',
  'titleEnabled',
  'stringChannelEnabled',
  'relativeXValues',
  'commaSeparated',
  'leadingZero',
  'locked',
];
const dimensions = [
  'width',
  'height',
  'canvasWidth',
  'canvasHeight',
  'knobWidth',
  'sliderWidth',
  'sliderHeight',
  'textFieldWidth',
];
const numbers = [
  'minimum',
  'maximum',
  'value',
  'defaultValue',
  'xValue',
  'yValue',
  'xMin',
  'xMax',
  'yMin',
  'yMax',
  'xMax',
];

export function validateBsbWidget(
  data: Element,
  className: string,
  context = new XmlLoadContext(data),
): void {
  const at = context.at(data);
  const fail = (member: string, message: string): never => {
    throw at.error({
      code: 'value',
      member,
      message,
      recovery: 'Supply supported, unambiguous widget data.',
    });
  };
  const fields = owners[className];
  if (
    data.getName() !== 'bsbObject' ||
    !fields ||
    data.getAttribute('type') !== `blue.orchestra.blueSynthBuilder.${className}`
  )
    fail('@type', 'Expected an exact supported widget type.');
  const attrs = ['type', 'uniqueId', 'id'];
  if (versioned.includes(className)) attrs.push('version');
  if (className === 'BSBGroup') attrs.push('groupName', 'editEnabled');
  checkShape(
    data,
    attrs,
    [...common, ...fields, ...(automatable.includes(className) ? ['automationAllowed'] : [])],
    context,
    ['bsbObject'],
  );
  const versionAttribute = data.getAttribute('version');
  const version =
    versionAttribute === null ? 1 : parseXmlInteger(versionAttribute, at, 1, 2, '@version');
  if (data.getAttribute('editEnabled') !== null)
    parseXmlBoolean(data.getAttribute('editEnabled')!, at, '@editEnabled');
  const identities = [
    data.getAttribute('uniqueId'),
    data.getAttribute('id'),
    data.getTextString('id'),
  ].filter((value): value is string => value !== null);
  if (new Set(identities).size > 1) fail('@uniqueId', 'Conflicting widget identity aliases.');
  const groupAlias = data.getAttribute('groupName');
  if (
    groupAlias !== null &&
    data.getElement('groupName') &&
    groupAlias !== data.getTextString('groupName')
  )
    fail('@groupName', 'Conflicting group name aliases.');
  for (const child of data.getElements()) {
    const name = child.getName();
    if (['font', 'bsbObject', 'bsbDropdownItemList', 'lines'].includes(name)) continue;
    const text = readText(child, context);
    const here = context.at(child);
    if (bools.includes(name)) parseXmlBoolean(text, here);
    else if (['x', 'y'].includes(name)) parseXmlInteger(text, here, -2147483648, 2147483647);
    else if (dimensions.includes(name)) parseXmlInteger(text, here, 1, 2147483647);
    else if (name === 'gap') parseXmlInteger(text, here, 0, 2147483647);
    else if (name === 'selectedIndex') parseXmlInteger(text, here, 0, 2147483647);
    else if (name === 'fontSize') parseXmlInteger(text, here, 8, 36);
    else if (numbers.includes(name) && !(className === 'BSBTextField' && name === 'value'))
      parseXmlNumber(text, here);
    else if (name === 'resolution' || name === 'bdresolution') {
      const result =
        name === 'resolution'
          ? normalizeLegacyResolution(parseXmlNumber(text, here))
          : parseJavaDecimal(text);
      if (!result.ok) fail(name, result.message);
    } else if (name.endsWith('Color') && !isValidBsbColor(text))
      fail(name, 'Invalid supported color encoding.');
    else if (
      name === 'separatorType' &&
      !['NONE', 'COMMA', 'SINGLE_QUOTE', 'None', 'Comma', 'Single Quote'].includes(text)
    )
      fail(name, 'Invalid line separator.');
  }
  for (const [lo, hi] of [
    ['minimum', 'maximum'],
    ['xMin', 'xMax'],
    ['yMin', 'yMax'],
  ]) {
    const low = data.getTextString(lo),
      high = data.getTextString(hi);
    if (low !== null && high !== null && Number(low) > Number(high))
      fail(lo, 'Minimum exceeds maximum.');
  }
  for (const [valueField, minField, maxField] of [
    ['value', 'minimum', 'maximum'],
    ['xValue', 'xMin', 'xMax'],
    ['yValue', 'yMin', 'yMax'],
    ['defaultValue', 'minimum', 'maximum'],
  ]) {
    const value = data.getTextString(valueField),
      minimum = data.getTextString(minField),
      maximum = data.getTextString(maxField);
    if (value === null || minimum === null || maximum === null || className === 'BSBTextField')
      continue;
    const historicalRelative =
      (className === 'BSBKnob' || className === 'BSBXYController') && version !== 2;
    if (
      historicalRelative &&
      !Number.isFinite(Number(minimum) + Number(value) * (Number(maximum) - Number(minimum)))
    )
      fail(valueField, 'Historical value conversion is not finite.');
  }
  if (data.getElement('separatorType') && data.getElement('commaSeparated'))
    fail('separatorType', 'Competing separator representations.');
  const font = data.getElement('font');
  if (font) validateBsbFont(font, context);
  const list = data.getElement('bsbDropdownItemList');
  if (list) {
    checkShape(list, [], ['bsbDropdownItem'], context, ['bsbDropdownItem']);
    const ids = new Set<string>();
    const items = list.getElements('bsbDropdownItem').toArray();
    for (const item of items) {
      checkShape(item, ['uniqueId'], ['name', 'value'], context);
      for (const child of item.getElements()) readText(child, context);
      const id = item.getAttribute('uniqueId');
      if (id && ids.has(id)) fail('uniqueId', 'Duplicate dropdown item identity.');
      if (id) ids.add(id);
    }
    const selected = Number(data.getTextString('selectedIndex') ?? '0');
    if (items.length && selected >= items.length)
      fail('selectedIndex', 'Selected item does not exist.');
  }
  if (className.endsWith('SliderBank')) {
    const expected = className === 'BSBHSliderBank' ? 'BSBHSlider' : 'BSBVSlider';
    for (const child of data.getElements('bsbObject'))
      if (child.getAttribute('type') !== `blue.orchestra.blueSynthBuilder.${expected}`)
        fail('bsbObject', 'Slider bank contains an unsupported child type.');
  }
  const lines = data.getElement('lines');
  if (lines) checkShape(lines, [], ['line'], context, ['line']);
}

export function validateBsbFont(data: Element, context = new XmlLoadContext(data)): void {
  checkRoot(data, 'font', context);
  checkShape(data, [], ['name', 'size', 'style'], context);
  for (const child of data.getElements()) {
    const text = readText(child, context);
    if (child.getName() === 'size' && parseXmlNumber(text, context.at(child)) <= 0)
      throw context.at(child).error({
        code: 'value',
        message: 'Font size must be positive.',
        recovery: 'Supply a positive font size.',
      });
    if (child.getName() === 'style') parseXmlInteger(text, context.at(child), 0, 3);
  }
}

export function getBsbWidgetFields(className: string): readonly string[] {
  return owners[className] ?? [];
}
