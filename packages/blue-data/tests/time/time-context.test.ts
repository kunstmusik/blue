import { describe, it, expect } from 'vitest';
import { TimeContext } from '../../src/time/time-context';
import { MeterMap } from '../../src/time/meter-map';
import { TempoMap } from '../../src/time/tempo-map';
import { Meter } from '../../src/time/meter';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';
import { TempoPoint } from '../../src/time/tempo-point';
import { TimePosition } from '../../src/time/time-position';
import { CurveType } from '../../src/time/curve-type';

describe('TimeContext Equality', () => {
  it('shouldConsiderDefaultMeterMapsEqual', () => {
    const a = new MeterMap();
    const b = new MeterMap();
    expect(a.equals(b)).toBe(true);
    expect(a.hashCode()).toBe(b.hashCode());
  });

  it('shouldConsiderMeterMapsWithSameEntriesEqual', () => {
    const a = new MeterMap();
    a.add(new MeasureMeterPair(5, new Meter(3, 4)));
    const b = new MeterMap();
    b.add(new MeasureMeterPair(5, new Meter(3, 4)));
    expect(a.equals(b)).toBe(true);
  });

  it('shouldConsiderMeterMapsWithDifferentEntriesNotEqual', () => {
    const a = new MeterMap();
    const b = new MeterMap();
    b.add(new MeasureMeterPair(5, new Meter(6, 8)));
    expect(a.equals(b)).toBe(false);
  });

  it('shouldConsiderDefaultTempoMapsEqual', () => {
    const a = new TempoMap();
    const b = new TempoMap();
    expect(a.equals(b)).toBe(true);
  });

  it('shouldConsiderTempoMapsWithDifferentEnabledNotEqual', () => {
    const a = new TempoMap();
    a.setEnabled(true);
    const b = new TempoMap();
    expect(a.equals(b)).toBe(false);
  });

  it('shouldConsiderCopiedTempoMapEqual', () => {
    const a = new TempoMap();
    a.setEnabled(true);
    a.addTempoPoint(new TempoPoint(undefined, 100.0));
    const b = new TempoMap(a);
    expect(a.equals(b)).toBe(true);
  });

  it('shouldDetectSameMusicalContext', () => {
    const a = new TimeContext();
    const b = new TimeContext();
    expect(a.hasSameMusicalContext(b)).toBe(true);
  });

  it('shouldDetectDifferentMusicalContextWhenTempoMapDiffers', () => {
    const a = new TimeContext();
    const b = new TimeContext();
    b.getTempoMap().setEnabled(true);
    expect(a.hasSameMusicalContext(b)).toBe(false);
  });

  it('shouldDetectDifferentMusicalContextWhenMeterMapDiffers', () => {
    const a = new TimeContext();
    const b = new TimeContext();
    b.getMeterMap().add(new MeasureMeterPair(5, new Meter(7, 8)));
    expect(a.hasSameMusicalContext(b)).toBe(false);
  });

  it('shouldReturnFalseForNullContext', () => {
    expect(new TimeContext().hasSameMusicalContext(null)).toBe(false);
  });

  it('shouldReturnTrueForSelf', () => {
    const a = new TimeContext();
    expect(a.hasSameMusicalContext(a)).toBe(true);
  });
});

describe('TimeContext Serialization', () => {
  it('testMeterSerialization', () => {
    const original = new Meter(3, 4);
    const xml = original.saveAsXML();
    const loaded = Meter.loadFromXML(xml);
    expect(original.numBeats).toBe(loaded.numBeats);
    expect(original.beatLength).toBe(loaded.beatLength);
    expect(original.equals(loaded)).toBe(true);
  });

  it('testMeterMapSerialization', () => {
    const original = new MeterMap();
    original.clear();
    original.add(new MeasureMeterPair(1, new Meter(4, 4)));
    original.add(new MeasureMeterPair(5, new Meter(3, 4)));
    original.add(new MeasureMeterPair(9, new Meter(6, 8)));

    const xml = original.saveAsXML();
    const loaded = MeterMap.loadFromXML(xml);

    expect(loaded.size()).toBe(original.size());
    for (let i = 0; i < original.size(); i++) {
      expect(loaded.get(i).getMeasureNumber()).toBe(original.get(i).getMeasureNumber());
      expect(loaded.get(i).getMeter().equals(original.get(i).getMeter())).toBe(true);
    }
  });

  it('testTempoMapSerialization', () => {
    const original = TempoMap.createTempoMap('0 60 4 120 8 90');
    expect(original).not.toBeNull();
    original!.setEnabled(true);

    const xml = original!.saveAsXML();
    const loaded = TempoMap.loadFromXML(xml);

    for (const testBeat of [0.0, 2.0, 4.0, 6.0, 8.0]) {
      expect(loaded.beatsToSeconds(testBeat)).toBeCloseTo(original!.beatsToSeconds(testBeat), 4);
    }
  });

  it('testTimeContextSerialization', () => {
    const original = new TimeContext();
    const mm = new MeterMap();
    mm.clear();
    mm.add(new MeasureMeterPair(1, new Meter(4, 4)));
    mm.add(new MeasureMeterPair(5, new Meter(3, 4)));
    original.setMeterMap(mm);

    const tm = TempoMap.createTempoMap('0 120 4 90');
    original.setTempoMap(tm!);

    const xml = original.saveAsXML();
    const loaded = TimeContext.loadFromXML(xml);

    expect(loaded.getMeterMap().size()).toBe(original.getMeterMap().size());
    const testBeat = 3.0;
    expect(loaded.getTempoMap().beatsToSeconds(testBeat)).toBeCloseTo(
      original.getTempoMap().beatsToSeconds(testBeat),
      4,
    );
  });

  it('testLegacyXmlWithSampleRateIsIgnored', () => {
    const original = new TimeContext();
    const xml = original.saveAsXML();
    xml.addElement('sampleRate').setText('48000');
    const loaded = TimeContext.loadFromXML(xml);
    expect(loaded.getSampleRate()).toBe(44100);
  });

  it('testTimeContextDefaultSerialization', () => {
    const original = new TimeContext();
    const loaded = TimeContext.loadFromXML(original.saveAsXML());
    expect(loaded.getTempoMap().beatsToSeconds(4.0)).toBeCloseTo(
      original.getTempoMap().beatsToSeconds(4.0),
      4,
    );
    expect(
      loaded.getMeterMap().get(0).getMeter().equals(original.getMeterMap().get(0).getMeter()),
    ).toBe(true);
  });

  it('testDefaultContextSampleRateIs44100', () => {
    expect(new TimeContext().getSampleRate()).toBe(44100);
  });

  it('testMeterMapChangesRecalculateTempoBeatPositions', () => {
    const context = new TimeContext();
    const tempoMap = new TempoMap();
    tempoMap.addTempoPoint(
      new TempoPoint(TimePosition.bbt(3, 1, 0), 90.0, CurveType.CONSTANT),
      context,
    );
    context.setTempoMap(tempoMap);
    expect(context.getTempoMap().getBeat(1)).toBeCloseTo(8.0, 4);

    context.getMeterMap().set(0, new MeasureMeterPair(1, new Meter(3, 4)));
    context.getTempoMap().recalculateBeatPositions(context);
    expect(context.getTempoMap().getBeat(1)).toBeCloseTo(6.0, 4);
  });
});
