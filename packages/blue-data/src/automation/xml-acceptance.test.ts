import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { XmlLoadError } from '../serialization/xml-load';
import { Parameter } from './parameter';
import { ParameterList } from './parameter-list';
import { ParameterIdList } from './parameter-id-list';
import { LineObject } from '../sound-objects/line-object';
import { ZakLineObject } from '../sound-objects/zak-line-object';

const line =
  '<line min="10" max="20" resolution="0.123456" bdresolution="0.5"><linePoint x="0" y="0.25"/><linePoint x="0" y="0.75"/></line>';
describe('automation local XML acceptance', () => {
  it('converts relative points before parameter resolution and preserves equal-time order', () => {
    const parameter = Parameter.loadFromXML(
      Element.parse(`<parameter min="10" max="20" bdresolution="1">${line}</parameter>`),
    );
    expect(parameter.getPoints()).toEqual([
      { time: 0, value: 13 },
      { time: 0, value: 18 },
    ]);
    expect(Parameter.loadFromXML(parameter.saveAsXML()).getPoints()).toEqual(parameter.getPoints());
  });
  it.each([
    '<parameter min="1junk"/>',
    '<parameter min="2" max="1"/>',
    '<parameter enabled="false" automationEnabled="true"/>',
    '<parameter curve="CUBIC"/>',
    '<parameter resolution="broken" bdresolution="1"/>',
    '<parameter value="Infinity"/>',
    '<parameter><highPrecision>true</highPrecision></parameter>',
    '<parameter><line min="0" max="1"/><points/></parameter>',
    '<parameter><points><point time="1" value="0"/><point time="0" value="1"/></points></parameter>',
    '<parameter><points><point time="0" value="1" extra="x"/></points></parameter>',
    '<parameter><line min="0" max="1" curveType="CONSTANT"/><line min="0" max="1"/></parameter>',
  ])('rejects malformed parameter %s', (xml) =>
    expect(() => Parameter.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it.each([
    '<parameterList extra="x"/>',
    '<parameterList><unknown/></parameterList>',
    '<parameterList><parameter uniqueId="x"/><parameter uniqueId="x"/></parameterList>',
  ])('rejects list grammar/identity conflicts %s', (xml) =>
    expect(() => ParameterList.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it.each([
    '<parameterIdList selectedIndex="1junk"/>',
    '<parameterIdList selectedIndex="2"><parameterId>x</parameterId></parameterIdList>',
    '<parameterIdList><parameterId>x</parameterId><parameterId>x</parameterId></parameterIdList>',
    '<parameterIdList><parameterId/></parameterIdList>',
  ])('rejects invalid reference lists %s', (xml) =>
    expect(() => ParameterIdList.loadFromXML(Element.parse(xml))).toThrow(XmlLoadError),
  );
  it('shares exact resolution precedence with LineObject', () => {
    const object = LineObject.loadFromXML(
      Element.parse(`<soundObject type="blue.soundObject.LineObject">${line}</soundObject>`),
    );
    expect(object.getLines()[0]).toMatchObject({
      resolution: '0.5',
      points: [
        { x: 0, y: 12.5 },
        { x: 0, y: 17.5 },
      ],
    });
  });
  it.each([
    '<line min="0" max="1" version="3"/>',
    '<line min="0" max="1" resolution="broken" bdresolution="1"/>',
    '<line min="0" max="1"><linePoint x="0" y="2"/></line>',
    '<line name="same" min="0" max="1"/><line name="same" min="0" max="1"/>',
  ])('rejects invalid line records %s', (xml) =>
    expect(() =>
      LineObject.loadFromXML(
        Element.parse(`<soundObject type="blue.soundObject.LineObject">${xml}</soundObject>`),
      ),
    ).toThrow(XmlLoadError),
  );
  it.each([
    '<zakline channel="1x" min="0" max="1"/>',
    '<zakSpace>-1</zakSpace>',
    '<zakline channel="1" min="0" max="1"/><zakline channel="1" min="0" max="1"/>',
    '<zakline channel="1" name="bad" min="0" max="1"/>',
  ])('rejects invalid Zak records %s', (xml) =>
    expect(() =>
      ZakLineObject.loadFromXML(
        Element.parse(`<soundObject type="blue.soundObject.ZakLineObject">${xml}</soundObject>`),
      ),
    ).toThrow(XmlLoadError),
  );
});
