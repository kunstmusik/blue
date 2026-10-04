import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { TimePosition } from './time-position';
import { TimeContext } from './time-context';
import { TimeState } from './time-state';
import { TempoMap } from './tempo-map';
import { TempoPoint } from './tempo-point';
import { CurveType } from './curve-type';
import { MeterMap } from './meter-map';
import { Meter } from './meter';
import { MeasureMeterPair } from './measure-meter-pair';

describe('TimeContext compatibility', () => {
  it.each([
    '<timeContext><tempo>120</tempo><tempoMap/></timeContext>',
    '<timeContext><tempo>1junk</tempo></timeContext>',
    '<timeContext><sampleRate>48000</sampleRate></timeContext>',
    '<timeContext><ppq>480</ppq></timeContext>',
    '<timeContext><meterMap><future/></meterMap></timeContext>',
    '<timeContext><tempoMap><beatTempoPair><beat>0</beat><tempo>0</tempo></beatTempoPair></tempoMap></timeContext>',
  ])('rejects conflicting, unsafe, or malformed context: %s', (xml) => {
    expect(() => TimeContext.loadFromXML(Element.parse(xml))).toThrow();
  });

  it('retains writer-proven child beat/tempo values and historical enabled semantics', () => {
    const ctx = TimeContext.loadFromXML(
      Element.parse(
        '<timeContext><tempoMap><beatTempoPair><beat>0</beat><tempo>120</tempo></beatTempoPair><beatTempoPair><beat>4</beat><tempo>90</tempo></beatTempoPair></tempoMap></timeContext>',
      ),
    );
    expect(ctx.getTempoMap().isEnabled()).toBe(true);
    expect(ctx.getTempoMap().getTempo(0)).toBe(120);
    expect(ctx.getTempoMap().getBeat(1)).toBe(4);
    expect(ctx.getTempoMap().getTempo(1)).toBe(90);
    expect(ctx.getTempoMap().getCurveType(0)).toBe('LINEAR');
  });
  it('deep copies the meter map in the copy constructor', () => {
    const context = new TimeContext();
    const meterMap = new MeterMap();
    meterMap.clear();
    meterMap.add(new MeasureMeterPair(1, new Meter(3, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(4, 4)));
    context.setMeterMap(meterMap);

    const copy = new TimeContext(context);
    copy.getMeterMap().add(new MeasureMeterPair(9, new Meter(6, 8)));

    expect(context.getMeterMap().size()).toBe(2);
    expect(copy.getMeterMap().size()).toBe(3);
  });

  it('round-trips tempo, meter, and SMPTE state', () => {
    const context = new TimeContext();
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempoPoint(0, 0, 100, CurveType.CONSTANT);
    tempoMap.addTempoPoint(new TempoPoint(8, 120, CurveType.LINEAR));
    context.setTempoMap(tempoMap);

    const meterMap = new MeterMap();
    meterMap.clear();
    meterMap.add(new MeasureMeterPair(1, new Meter(3, 4)));
    context.setMeterMap(meterMap);
    context.setSmpteFrameRate(29.97);

    const savedXml = context.saveAsXML().toXml();
    const reloaded = TimeContext.loadFromXML(Element.parse(savedXml));

    expect(reloaded.hasSameMusicalContext(context)).toBe(true);
    expect(reloaded.getSmpteFrameRate()).toBe(29.97);
  });

  it('keeps TimeState copy data isolated', () => {
    const original = new TimeState();
    original.setSmpteFrameRate(30);

    const copy = new TimeState(original);
    copy.setSmpteFrameRate(24);

    expect(original.getSmpteFrameRate()).toBe(30);
    expect(copy.getSmpteFrameRate()).toBe(24);
  });
});

describe('resolved tempo sequence acceptance', () => {
  it.each([
    [TimePosition.bbt(2, 1, 0), TimePosition.beats(3)],
    [TimePosition.bbt(2, 1, 0), TimePosition.beats(4)],
  ])('rejects nonascending or duplicate resolved positions', (first, second) => {
    const root = new Element('timeContext');
    const map = root.addElement('tempoMap');
    for (const position of [first, second]) {
      const point = map.addElement('tempoPoint');
      point.setAttribute('tempo', '60');
      point.addElement(position.saveAsXML().setName('timePosition'));
    }
    expect(() => TimeContext.loadFromXML(root)).toThrow('ascending');
  });
});
