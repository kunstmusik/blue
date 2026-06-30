import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { AutomationCurve, Parameter } from './parameter';

describe('Parameter compatibility', () => {
  it('round-trips XML state and automation points', () => {
    const parameter = new Parameter();
    parameter.setUniqueId('p1');
    parameter.setName('gain');
    parameter.setLabel('Gain');
    parameter.setMinimum(0);
    parameter.setMaximum(1);
    parameter.setCurve(AutomationCurve.LINEAR);
    parameter.setAutomationEnabled(true);
    parameter.setFixedValue(0.5);
    parameter.addPoint(0, 0.25);
    parameter.addPoint(4, 0.75);

    const reloaded = Parameter.loadFromXML(Element.parse(parameter.saveAsXML().toXml()));

    expect(reloaded.getUniqueId()).toBe('p1');
    expect(reloaded.getName()).toBe('gain');
    expect(reloaded.getLabel()).toBe('Gain');
    expect(reloaded.getMinimum()).toBeCloseTo(0, 6);
    expect(reloaded.getMaximum()).toBeCloseTo(1, 6);
    expect(reloaded.isAutomationEnabled()).toBe(true);
    expect(reloaded.getPoints()).toHaveLength(2);
  });

  it('returns the fixed value when automation is disabled', () => {
    const parameter = new Parameter();
    parameter.setFixedValue(0.75);
    parameter.setAutomationEnabled(false);

    expect(parameter.getValue(10)).toBeCloseTo(0.75, 6);
  });

  it('duplicates automation data with a fresh unique id', () => {
    const parameter = new Parameter();
    parameter.setUniqueId('p1');
    parameter.setName('gain');
    parameter.setLabel('Gain');
    parameter.setMinimum(0);
    parameter.setMaximum(1);
    parameter.setAutomationEnabled(true);
    parameter.setFixedValue(0.5);
    parameter.addPoint(0, 0.25);
    parameter.addPoint(4, 0.75);

    const duplicate = parameter.deepCopy() as Parameter;

    expect(duplicate.getUniqueId()).not.toBe('p1');
    expect(duplicate.getName()).toBe('gain');
    expect(duplicate.getPoints()).toEqual(parameter.getPoints());
  });
});

describe('Parameter line color', () => {
  it('defaults to grey line color', () => {
    const param = new Parameter();
    expect(param.getLineColor()).toBe(-8355712);
  });

  it('setLineColor changes the color', () => {
    const param = new Parameter();
    param.setLineColor(0xff0000);
    expect(param.getLineColor()).toBe(0xff0000);
  });

  it('round-trips line color through XML', () => {
    const param = new Parameter();
    param.setUniqueId('p1');
    param.setName('test');
    param.setLineColor(0x00ff00);
    param.setAutomationEnabled(true);
    param.addPoint(0, 0.5);

    const reloaded = Parameter.loadFromXML(Element.parse(param.saveAsXML().toXml()));

    expect(reloaded.getLineColor()).toBe(0x00ff00);
  });

  it('deep copies line color', () => {
    const param = new Parameter();
    param.setLineColor(0x123456);
    const copy = param.deepCopy() as Parameter;
    expect(copy.getLineColor()).toBe(0x123456);
    copy.setLineColor(0xffffff);
    expect(param.getLineColor()).toBe(0x123456);
  });

  it('reads legacy default color when attribute missing', () => {
    const xml = `<parameter uniqueId="p1" name="test" min="0.0" max="1.0" bdresolution="0" automationEnabled="false" value="0.0">
      <line version="2" max="1.0" min="0.0" bdresolution="0" rightBound="false" endPointsLinked="false">
        <linePoint x="0.0" y="0.5"/>
      </line>
    </parameter>`;
    const param = Parameter.loadFromXML(Element.parse(xml));
    expect(param.getLineColor()).toBe(-8355712);
  });
});

describe('Parameter point sorting', () => {
  it('sorts points by time after addPoint', () => {
    const param = new Parameter();
    param.addPoint(4, 0.8);
    param.addPoint(1, 0.2);
    param.addPoint(2, 0.5);
    const pts = param.getPoints();
    expect(pts[0].time).toBe(1);
    expect(pts[1].time).toBe(2);
    expect(pts[2].time).toBe(4);
  });

  it('loads points sorted by time from XML', () => {
    const param = new Parameter();
    param.setUniqueId('p1');
    param.setAutomationEnabled(true);
    param.addPoint(5, 0.5);
    param.addPoint(1, 0.1);
    param.addPoint(3, 0.3);

    const reloaded = Parameter.loadFromXML(Element.parse(param.saveAsXML().toXml()));
    const pts = reloaded.getPoints();
    expect(pts.map(p => p.time)).toEqual([1, 3, 5]);
    expect(pts.map(p => p.value)).toEqual([0.1, 0.3, 0.5]);
  });
});
