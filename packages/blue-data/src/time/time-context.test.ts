import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from './time-context';
import { TimeState } from './time-state';
import { TempoMap } from './tempo-map';
import { TempoPoint } from './tempo-point';
import { CurveType } from './curve-type';
import { MeterMap } from './meter-map';
import { Meter } from './meter';
import { MeasureMeterPair } from './measure-meter-pair';

describe('TimeContext compatibility', () => {
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
