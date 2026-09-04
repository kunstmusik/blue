import { describe, it, expect, beforeEach } from 'vitest';
import { TimePosition } from '../../src/time/time-position';
import { TimeBase } from '../../src/time/time-base';
import { TimeContext } from '../../src/time/time-context';
import { makeDefaultContext } from './helpers';
import { Element } from '../../src/serialization/xml-reader';

describe('TimePosition', () => {
  let context: TimeContext;
  beforeEach(() => {
    context = makeDefaultContext();
  });

  // ===== BeatTime =====

  it('testBeatTimeGetTimeBase', () => {
    expect(TimePosition.beats(10.0).getTimeBase()).toBe(TimeBase.BEATS);
  });

  it('testBeatTimeImmutability', () => {
    expect(TimePosition.beats(5.5).getCsoundBeats()).toBeCloseTo(5.5, 4);
  });

  it('testBeatTimeConversions', () => {
    const bt = TimePosition.beats(4.0);
    expect(bt.toBeats(context)).toBeCloseTo(4.0, 4);
    expect(bt.toSeconds(context)).toBeCloseTo(4.0, 4);
    expect(bt.toFrames(context)).toBe(176400);
  });

  it('testBeatTimeComparison', () => {
    const bt1 = TimePosition.beats(4.0);
    const bt2 = TimePosition.beats(6.0);
    const bt3 = TimePosition.beats(4.0);
    expect(bt1.lt(context, bt2)).toBe(true);
    expect(bt2.lt(context, bt1)).toBe(false);
    expect(bt1.lt(context, bt3)).toBe(false);
    expect(bt2.gt(context, bt1)).toBe(true);
    expect(bt1.gt(context, bt2)).toBe(false);
    expect(bt1.lte(context, bt2)).toBe(true);
    expect(bt1.lte(context, bt3)).toBe(true);
    expect(bt2.gte(context, bt1)).toBe(true);
    expect(bt1.gte(context, bt3)).toBe(true);
  });

  it('testBeatTimeEqualsAndHashCode', () => {
    const bt1 = TimePosition.beats(4.0);
    const bt2 = TimePosition.beats(4.0);
    const bt3 = TimePosition.beats(5.0);
    expect(bt1.equals(bt2)).toBe(true);
    expect(bt1.equals(bt3)).toBe(false);
    expect(bt1.hashCode()).toBe(bt2.hashCode());
  });

  // ===== BBSTTime =====

  it('testBBSTTimeGetTimeBase', () => {
    expect(TimePosition.bbst(1, 1, 1, 0).getTimeBase()).toBe(TimeBase.BBST);
  });

  it('testBBSTTimeConversions', () => {
    expect(TimePosition.bbst(1, 1, 1, 0).toBeats(context)).toBeCloseTo(0.0, 4);
    expect(TimePosition.bbst(2, 1, 1, 0).toBeats(context)).toBeCloseTo(4.0, 4);
    expect(TimePosition.bbst(1, 3, 1, 0).toBeats(context)).toBeCloseTo(2.0, 4);
  });

  it('testBBSTTimeInvalidBar', () => {
    expect(() => TimePosition.bbst(0, 1, 1, 0)).toThrow();
  });

  it('testBBSTTimeInvalidBeat', () => {
    expect(() => TimePosition.bbst(1, 0, 1, 0)).toThrow();
  });

  it('testBBSTTimeInvalidSixteenth', () => {
    expect(() => TimePosition.bbst(1, 1, 5, 0)).toThrow();
  });

  // ===== BBTTime =====

  it('testBBTTimeGetTimeBase', () => {
    expect(TimePosition.bbt(1, 1, 0).getTimeBase()).toBe(TimeBase.BBT);
  });

  it('testBBTTimeConversions', () => {
    expect(TimePosition.bbt(1, 1, 0).toBeats(context)).toBeCloseTo(0.0, 4);
    expect(TimePosition.bbt(1, 1, 480).toBeats(context)).toBeCloseTo(0.5, 4);
  });

  it('testBBTToBBSTConversion', () => {
    const bbst = TimePosition.bbt(1, 2, 480).toBBST(960);
    expect(bbst.getBar()).toBe(1);
    expect(bbst.getBeat()).toBe(2);
    expect(bbst.getSixteenth()).toBe(3);
    expect(bbst.getTicks()).toBe(0);
  });

  // ===== BBFTime =====

  it('testBBFTimeGetTimeBase', () => {
    expect(TimePosition.bbf(1, 1, 0).getTimeBase()).toBe(TimeBase.BBF);
  });

  it('testBBFTimeConversions', () => {
    expect(TimePosition.bbf(1, 1, 0).toBeats(context)).toBeCloseTo(0.0, 4);
    expect(TimePosition.bbf(1, 1, 50).toBeats(context)).toBeCloseTo(0.5, 4);
  });

  it('testBBFTimeInvalidFraction', () => {
    expect(() => TimePosition.bbf(1, 1, 100)).toThrow();
  });

  // ===== TimeValue =====

  it('testTimeValueGetTimeBase', () => {
    expect(TimePosition.timeValue(1, 30, 45, 500).getTimeBase()).toBe(TimeBase.TIME);
  });

  it('testTimeValueToTotalSeconds', () => {
    expect(TimePosition.timeValue(1, 30, 45, 500).toTotalSeconds()).toBeCloseTo(5445.5, 4);
    expect(TimePosition.timeValue(0, 0, 0, 0).toTotalSeconds()).toBeCloseTo(0.0, 4);
  });

  it('testTimeValueConversions', () => {
    const tv = TimePosition.timeValue(0, 0, 2, 0);
    expect(tv.toBeats(context)).toBeCloseTo(2.0, 4);
    expect(tv.toSeconds(context)).toBeCloseTo(2.0, 4);
    expect(tv.toFrames(context)).toBe(88200);
  });

  it('testTimeValueInvalidHours', () => {
    expect(() => TimePosition.timeValue(-1, 0, 0, 0)).toThrow();
  });

  it('testTimeValueInvalidMinutes', () => {
    expect(() => TimePosition.timeValue(0, 60, 0, 0)).toThrow();
  });

  it('testTimeValueInvalidSeconds', () => {
    expect(() => TimePosition.timeValue(0, 0, 60, 0)).toThrow();
  });

  it('testTimeValueInvalidMilliseconds', () => {
    expect(() => TimePosition.timeValue(0, 0, 0, 1000)).toThrow();
  });

  // ===== SecondsValue =====

  it('testSecondsValueGetTimeBase', () => {
    expect(TimePosition.seconds(1.25).getTimeBase()).toBe(TimeBase.SECONDS);
  });

  it('testSecondsValueConversions', () => {
    const sv = TimePosition.seconds(2.5);
    expect(sv.getTotalSeconds()).toBeCloseTo(2.5, 4);
    expect(sv.toSeconds(context)).toBeCloseTo(2.5, 4);
    expect(sv.toBeats(context)).toBeCloseTo(2.5, 4);
    expect(sv.toFrames(context)).toBe(110250);
  });

  it('testSecondsValueNegativeRejected', () => {
    expect(() => TimePosition.seconds(-0.001)).toThrow();
  });

  it('testSecondsValueNonFiniteRejected', () => {
    expect(() => TimePosition.seconds(NaN)).toThrow();
    expect(() => TimePosition.seconds(Infinity)).toThrow();
  });

  it('testSecondsValueXMLRoundTrip', () => {
    const original = TimePosition.seconds(12.345678);
    const xml = original.saveAsXML();
    const loaded = TimePosition.loadFromXML(xml);
    expect(original.equals(loaded)).toBe(true);
    expect(loaded.getTimeBase()).toBe(TimeBase.SECONDS);
  });

  // ===== FrameValue =====

  it('testFrameValueGetTimeBase', () => {
    expect(TimePosition.frames(44100).getTimeBase()).toBe(TimeBase.FRAME);
  });

  it('testFrameValueToTotalSeconds', () => {
    expect(TimePosition.frames(44100).toTotalSecondsForSampleRate(44100)).toBeCloseTo(1.0, 4);
    expect(TimePosition.frames(88200).toTotalSecondsForSampleRate(44100)).toBeCloseTo(2.0, 4);
  });

  it('testFrameValueConversions', () => {
    const fv = TimePosition.frames(88200);
    expect(fv.toFrames(context)).toBe(88200);
    expect(fv.toSeconds(context)).toBeCloseTo(2.0, 4);
    expect(fv.toBeats(context)).toBeCloseTo(2.0, 4);
  });

  it('testFrameValueInvalidFrameNumber', () => {
    expect(() => TimePosition.frames(-1)).toThrow();
  });

  it('testFrameValueInvalidSampleRate', () => {
    expect(() => TimePosition.frames(44100).toTotalSecondsForSampleRate(0)).toThrow();
  });

  it('testTimePositionXMLUsesJavaTagNames', () => {
    const seconds = TimePosition.seconds(12.5).saveAsXML();
    expect(seconds.getElement('totalSeconds')?.getTextString()).toBe('12.5');
    expect(seconds.getElement('seconds')).toBeNull();

    const frames = TimePosition.frames(44100).saveAsXML();
    expect(frames.getElement('frameCount')?.getTextString()).toBe('44100');
    expect(frames.getElement('frameNumber')).toBeNull();
  });

  it('testTimePositionXMLLoadsJavaAndLegacyTagNames', () => {
    const javaSeconds = Element.parse(
      '<position type="SECONDS"><totalSeconds>2.5</totalSeconds></position>',
    );
    const legacySeconds = Element.parse(
      '<position type="SECONDS"><seconds>2.5</seconds></position>',
    );
    expect(
      TimePosition.loadFromXML(javaSeconds).equals(TimePosition.loadFromXML(legacySeconds)),
    ).toBe(true);

    const javaFrame = Element.parse(
      '<position type="FRAME"><frameCount>44100</frameCount></position>',
    );
    const legacyFrame = Element.parse(
      '<position type="FRAME"><frameNumber>44100</frameNumber></position>',
    );
    expect(TimePosition.loadFromXML(javaFrame).equals(TimePosition.loadFromXML(legacyFrame))).toBe(
      true,
    );
  });
});
