import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import {
  checkShape,
  parseXmlBoolean,
  parseXmlInteger,
  parseXmlNumber,
  readText,
} from '../utilities/xml';
import { normalizeLegacyResolution, parseJavaDecimal } from './java-decimal';
import type { LineData } from '../sound-objects/line-object';

/** Shared local Line acceptance, including project tempo's historical Line. */
export function readLineXml(
  data: Element,
  context = new XmlLoadContext(data),
  extraAttributes: readonly string[] = [],
): LineData {
  checkShape(
    data,
    [
      'name',
      'varName',
      'version',
      'min',
      'max',
      'resolution',
      'bdresolution',
      'color',
      'rightBound',
      'endPointsLinked',
      ...extraAttributes,
    ],
    ['linePoint', 'points'],
    context,
    ['linePoint'],
  );
  const at = context.at(data);
  const numeric = (name: string): number => {
    const text = data.getAttribute(name);
    if (text === null)
      throw at.error({
        code: 'cardinality',
        member: `@${name}`,
        message: `Line requires ${name}.`,
        recovery: 'Supply complete Line bounds.',
      });
    return parseXmlNumber(text, at, `@${name}`);
  };
  const min = numeric('min');
  const max = numeric('max');
  if (min > max)
    throw at.error({
      code: 'value',
      message: 'Line min exceeds max.',
      recovery: 'Correct the Line bounds.',
    });
  const version = parseXmlInteger(data.getAttribute('version') ?? '1', at, 1, 2, '@version');
  const name = data.getAttribute('name');
  const alias = data.getAttribute('varName');
  if (name !== null && alias !== null && name !== alias)
    throw at.error({
      code: 'conflict',
      member: '@varName',
      value: alias,
      message: 'Conflicting Line name aliases.',
      recovery: 'Keep one consistent name.',
    });
  const resolution = readResolutionXml(data, context);
  const points = data
    .getElements('linePoint')
    .toArray()
    .map((point) => {
      checkShape(point, ['x', 'y'], [], context);
      const coordinates = ['x', 'y'].map((field) => {
        const text = point.getAttribute(field);
        if (text === null)
          throw context.at(point).error({
            code: 'cardinality',
            member: `@${field}`,
            message: `Line point requires ${field}.`,
            recovery: 'Supply both point coordinates.',
          });
        return parseXmlNumber(text, context.at(point), `@${field}`);
      });
      return { x: coordinates[0], y: coordinates[1] };
    });
  const oldPoints = data.getElement('points');
  if (oldPoints) {
    if (points.length)
      throw context.at(oldPoints).error({
        code: 'conflict',
        message: 'Legacy and current Line points coexist.',
        recovery: 'Keep one point representation.',
      });
    const text = readText(oldPoints, context).trim();
    if (text)
      for (const token of text.split(/\s+/)) {
        const pair = token.split(',');
        if (pair.length !== 2)
          throw context.at(oldPoints).error({
            code: 'value',
            value: token,
            message: 'Invalid historical Line coordinate pair.',
            recovery: 'Use complete x,y pairs.',
          });
        points.push({
          x: parseXmlNumber(pair[0], context.at(oldPoints)),
          y: parseXmlNumber(pair[1], context.at(oldPoints)),
        });
      }
  }
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && points[i].x < points[i - 1].x)
      throw at.error({
        code: 'conflict',
        message: 'Line points are not ordered by x.',
        recovery: 'Correct the point order; equal x discontinuities are supported.',
      });
    if (version === 1) {
      if (points[i].y < 0 || points[i].y > 1)
        throw at.error({
          code: 'value',
          value: String(points[i].y),
          message: 'Historical relative Line y is outside 0–1.',
          recovery: 'Correct the normalized coordinate.',
        });
      points[i].y = min + points[i].y * (max - min);
      if (!Number.isFinite(points[i].y))
        throw at.error({
          code: 'value',
          message: 'Line range conversion is not finite.',
          recovery: 'Use finite convertible bounds.',
        });
    }
  }
  return {
    varName: name ?? alias ?? 'line0',
    min,
    max,
    resolution,
    color: parseXmlInteger(
      data.getAttribute('color') ?? '-8355712',
      at,
      -2147483648,
      2147483647,
      '@color',
    ),
    rightBound: parseXmlBoolean(data.getAttribute('rightBound') ?? 'false', at, '@rightBound'),
    endPointsLinked: parseXmlBoolean(
      data.getAttribute('endPointsLinked') ?? 'false',
      at,
      '@endPointsLinked',
    ),
    points,
  };
}

/** Validate both forms before exact-decimal precedence. */
export function readResolutionXml(data: Element, context = new XmlLoadContext(data)): string {
  const at = context.at(data);
  let resolution = '-1';
  const legacy = data.getAttribute('resolution');
  const exact = data.getAttribute('bdresolution');
  if (legacy !== null) {
    const result = normalizeLegacyResolution(parseXmlNumber(legacy, at, '@resolution'));
    if (!result.ok)
      throw at.error({
        code: 'value',
        member: '@resolution',
        value: legacy,
        message: result.message,
        recovery: 'Supply a supported legacy resolution.',
      });
    resolution = result.value.canonicalText;
  }
  if (exact !== null) {
    const result = parseJavaDecimal(exact);
    if (!result.ok)
      throw at.error({
        code: 'value',
        member: '@bdresolution',
        value: exact,
        message: result.message,
        recovery: 'Supply a valid exact decimal resolution.',
      });
    resolution = result.value.canonicalText;
  }
  return resolution;
}
