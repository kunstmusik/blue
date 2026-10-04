import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { XmlLoadError } from '../serialization/xml-load';
import {
  Field,
  Parameter,
  Table,
  Mask,
  Probability,
  Constant,
  Oscillator,
  ItemList,
} from './jmask-support';
import { JMask } from './j-mask';
import { readResourceXml } from '../resource-xml-policy';
describe('JMask nested XML acceptance', () => {
  it.each([
    '<parameter><generator type="foreign.Constant"/></parameter>',
    '<parameter><generator type="Unknown"/></parameter>',
    '<parameter visible="maybe"><generator type="Constant"/></parameter>',
    '<parameter><generator type="Constant"/><mask/></parameter>',
    '<parameter><generator type="Random"/><generator type="Constant"/></parameter>',
    '<parameter><generator type="Oscillator"><oscillatorType>8</oscillatorType></generator></parameter>',
    '<parameter><generator type="Constant"><value>1tail</value></generator></parameter>',
  ])('rejects invalid parameter %s', (xml) =>
    expect(() => Parameter.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it.each([
    '<table><interpolationType>3</interpolationType></table>',
    '<table><min>2</min><max>1</max></table>',
    '<table><points><point time="1" value="0"/><point time="0" value="1"/></points></table>',
    '<table><points><point time="0" value="NaN"/></points></table>',
    '<table><point time="0" value="1"/></table>',
  ])('rejects invalid table %s', (xml) =>
    expect(() => Table.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it.each([
    '<mask><table tableId="unknown"/></mask>',
    '<mask><table tableId="lowTable"/><table tableId="lowTable"/></mask>',
  ])('rejects invalid table maps %s', (xml) =>
    expect(() => Mask.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it('requires complete probability slots', () =>
    expect(() =>
      Probability.loadFromXML(
        Element.parse(
          '<generator type="Probability"><probabilityGenerator type="Uniform"/></generator>',
        ),
      ),
    ).toThrow(XmlLoadError));
  it('requires p1/p2/p3 definitions', () =>
    expect(() => Field.loadFromXML(Element.parse('<field/>'))).toThrow(XmlLoadError));
  it('round trips supported family models', () => {
    for (const generator of [new Constant(), new Oscillator(), new ItemList(), new Probability()]) {
      const parameter = Parameter.create(generator);
      expect(Parameter.loadFromXML(parameter.saveAsXML()).saveAsXML().toXml()).toBe(
        parameter.saveAsXML().toXml(),
      );
    }
  });
  it('preserves JMask seed digits', () => {
    const xml = new JMask().saveAsXML();
    xml.getElement('seed')!.setText('-9223372036854775808');
    const object = JMask.loadFromXML(xml);
    expect(object.saveAsXML().getTextString('seed')).toBe('-9223372036854775808');
    expect(object.deepCopy().saveAsXML().getTextString('seed')).toBe('-9223372036854775808');
  });
  it.each([
    [' TRUE ', true],
    [' fAlSe ', false],
  ] as const)(
    'uses a checked visible attribute for standalone and embedded Parameters: %s',
    (token, expected) => {
      const standalone = Parameter.loadFromXML(
        Element.parse(`<parameter visible="${token}"><generator type="Constant"/></parameter>`),
      );
      const project = new JMask().saveAsXML();
      const first = project.getElement('field')!.getElements('parameter').next();
      first.setAttribute('visible', token);
      const report = readResourceXml('soundObject', project.toXml(), {
        kind: 'soundObject',
        label: 'visible.jmask',
      });

      expect(standalone.isVisible()).toBe(expected);
      expect(standalone.saveAsXML().getAttribute('visible')).toBe(String(expected));
      expect(report.ok).toBe(true);
      if (!report.ok) throw new Error(JSON.stringify(report.diagnostics));
      const embedded = report.value as JMask;
      expect(embedded.getField().getParameter(0).isVisible()).toBe(expected);
      expect(JMask.loadFromXML(embedded.saveAsXML()).getField().getParameter(0).isVisible()).toBe(
        expected,
      );
    },
  );
});
