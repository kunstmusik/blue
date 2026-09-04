import { describe, it, expect } from 'vitest';
import { TempoMap } from '../../src/time/tempo-map';
import { CurveType } from '../../src/time/curve-type';
import { TempoPoint } from '../../src/time/tempo-point';
import { TimePosition } from '../../src/time/time-position';
import { TimeContext } from '../../src/time/time-context';
import { Element } from '../../src/serialization/xml-reader';

const EPSILON = 0.0001;

describe('TempoMap', () => {
  // ===== Basic Construction =====

  it('testDefaultConstruction', () => {
    const tm = new TempoMap();
    expect(tm.size()).toBe(1);
    expect(tm.getBeat(0)).toBeCloseTo(0.0, 4);
    expect(tm.getTempo(0)).toBeCloseTo(60.0, 4);
    expect(tm.getCurveType(0)).toBe(CurveType.CONSTANT);
    expect(tm.isEnabled()).toBe(false);
    expect(tm.isVisible()).toBe(false);
  });

  it('testCopyConstruction', () => {
    const original = new TempoMap();
    original.setEnabled(true);
    original.setVisible(true);
    original.addTempoPoint(new TempoPoint(undefined, 120.0, CurveType.CONSTANT));

    const copy = new TempoMap(original);
    expect(copy.size()).toBe(2);
    expect(copy.isEnabled()).toBe(true);
    expect(copy.isVisible()).toBe(true);
    expect(copy.getCurveType(1)).toBe(CurveType.CONSTANT);
  });

  // ===== Enabled/Disabled =====

  it('testDisabledUsesConstantTempo', () => {
    const tm = new TempoMap();
    tm.addTempoPoint(new TempoPoint(undefined, 120.0));
    tm.setEnabled(false);
    expect(tm.beatsToSeconds(4.0)).toBeCloseTo(4.0, 4);
    expect(tm.beatsToSeconds(8.0)).toBeCloseTo(8.0, 4);
  });

  it('testEnabledUsesTempoMap', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 120.0);
    tm.setEnabled(true);
    expect(tm.beatsToSeconds(1.0)).toBeCloseTo(0.5, 4);
    expect(tm.beatsToSeconds(4.0)).toBeCloseTo(2.0, 4);
  });

  // ===== LINEAR =====

  it('testLinearInterpolation', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 60.0, CurveType.LINEAR);
    tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.LINEAR));
    tm.setEnabled(true);

    expect(tm.getTempoAt(0.0)).toBeCloseTo(60.0, 4);
    expect(tm.getTempoAt(2.0)).toBeCloseTo(90.0, 4);
    expect(tm.getTempoAt(4.0)).toBeCloseTo(120.0, 4);
  });

  it('testLinearBeatsToSeconds', () => {
    const tm = TempoMap.createTempoMap('0 60 4 120');
    expect(tm).not.toBeNull();
    tm!.setEnabled(true);
    expect(tm!.beatsToSeconds(0.0)).toBeCloseTo(0.0, 4);
    const time4 = tm!.beatsToSeconds(4.0);
    expect(time4).toBeGreaterThan(0);
    expect(time4).toBeLessThan(4.0);
  });

  it('testLinearSecondsToBeats', () => {
    const tm = TempoMap.createTempoMap('0 60 4 120');
    tm!.setEnabled(true);
    const beat = 2.5;
    const seconds = tm!.beatsToSeconds(beat);
    const beatBack = tm!.secondsToBeats(seconds);
    expect(beatBack).toBeCloseTo(beat, 4);
  });

  // ===== CONSTANT =====

  it('testConstantCurve', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
    tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
    tm.setEnabled(true);

    expect(tm.getTempoAt(0.0)).toBeCloseTo(60.0, 4);
    expect(tm.getTempoAt(2.0)).toBeCloseTo(60.0, 4);
    expect(tm.getTempoAt(4.0)).toBeCloseTo(120.0, 4);
  });

  it('testConstantBeatsToSeconds', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
    tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
    tm.setEnabled(true);

    expect(tm.beatsToSeconds(4.0)).toBeCloseTo(4.0, 4);
    expect(tm.beatsToSeconds(8.0)).toBeCloseTo(6.0, 4);
  });

  it('testConstantSecondsToBeats', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
    tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
    tm.setEnabled(true);

    expect(tm.secondsToBeats(2.0)).toBeCloseTo(2.0, 4);
    expect(tm.secondsToBeats(5.0)).toBeCloseTo(6.0, 4);
  });

  // ===== createTempoMap =====

  it('testCreateTempoMapSimple', () => {
    const tm = TempoMap.createTempoMap('0 60');
    expect(tm).not.toBeNull();
    expect(tm!.size()).toBe(1);
    expect(tm!.getBeat(0)).toBeCloseTo(0.0, 4);
    expect(tm!.getTempo(0)).toBeCloseTo(60.0, 4);
    expect(tm!.isEnabled()).toBe(true);
  });

  it('testCreateTempoMapMultiplePoints', () => {
    const tm = TempoMap.createTempoMap('0 60 4 120 8 90');
    expect(tm).not.toBeNull();
    expect(tm!.size()).toBe(3);
    expect(tm!.getBeat(1)).toBeCloseTo(4.0, 4);
    expect(tm!.getTempo(1)).toBeCloseTo(120.0, 4);
  });

  it('testCreateTempoMapInvalidOddTokens', () => {
    expect(TempoMap.createTempoMap('0 60 4')).toBeNull();
  });

  it('testCreateTempoMapInvalidNegativeBeat', () => {
    expect(TempoMap.createTempoMap('-1 60')).toBeNull();
  });

  it('testCreateTempoMapInvalidZeroTempo', () => {
    expect(TempoMap.createTempoMap('0 0')).toBeNull();
  });

  // ===== XML =====

  it('testSaveAndLoadXML', () => {
    const original = new TempoMap();
    original.setEnabled(true);
    original.setVisible(true);
    original.setTempoPoint(0, 0.0, 80.0, CurveType.CONSTANT);
    original.addTempoPoint(new TempoPoint(8.0, 160.0, CurveType.LINEAR));

    const xml = original.saveAsXML();
    const loaded = TempoMap.loadFromXML(xml);

    expect(loaded.size()).toBe(original.size());
    expect(loaded.isEnabled()).toBe(original.isEnabled());
    expect(loaded.isVisible()).toBe(original.isVisible());
    expect(loaded.getTempo(0)).toBeCloseTo(original.getTempo(0), 4);
    expect(loaded.getCurveType(0)).toBe(original.getCurveType(0));
  });

  it('testLoadLegacyXML', () => {
    const root = new Element('tempoMap');
    const pair1 = root.addElement('beatTempoPair');
    pair1.setAttribute('beat', '0.0');
    pair1.setAttribute('tempo', '60.0');
    const pair2 = root.addElement('beatTempoPair');
    pair2.setAttribute('beat', '4.0');
    pair2.setAttribute('tempo', '120.0');

    const loaded = TempoMap.loadFromXML(root);
    expect(loaded.size()).toBe(2);
    expect(loaded.getBeat(0)).toBeCloseTo(0.0, 4);
    expect(loaded.getTempo(0)).toBeCloseTo(60.0, 4);
    expect(loaded.getBeat(1)).toBeCloseTo(4.0, 4);
    expect(loaded.getTempo(1)).toBeCloseTo(120.0, 4);
  });

  // ===== Listeners =====

  it('testTempoMapListener', () => {
    const tm = new TempoMap();
    let callCount = 0;
    tm.addListener(() => callCount++);

    tm.addTempoPoint(new TempoPoint(undefined, 120.0));
    expect(callCount).toBe(1);

    tm.setTempoPoint(0, 0.0, 80.0);
    expect(callCount).toBe(2);

    tm.removeTempoPoint(1);
    expect(callCount).toBe(3);
  });

  // ===== BBST Position =====

  it('testTempoPointWithBBSTTime', () => {
    const point = new TempoPoint(TimePosition.bbst(2, 1, 1, 0), 120.0, CurveType.LINEAR);
    expect(point.tempo).toBeCloseTo(120.0, 4);
    expect(point.curveType).toBe(CurveType.LINEAR);
    expect(point.position.getTimeBase()).toBe('BBST');
  });

  it('testRecalculateBeatPositions', () => {
    const tm = new TempoMap();
    const context = new TimeContext();
    tm.addTempoPoint(
      new TempoPoint(TimePosition.bbst(2, 1, 1, 0), 120.0, CurveType.LINEAR),
      context,
    );

    expect(tm.size()).toBe(2);
    expect(tm.getBeat(0)).toBeCloseTo(0.0, 4);
    expect(tm.getBeat(1)).toBeCloseTo(4.0, 4);
  });

  // ===== Edge Cases =====

  it('testBeyondLastPoint', () => {
    const tm = new TempoMap();
    tm.setTempoPoint(0, 0.0, 120.0, CurveType.LINEAR);
    tm.setEnabled(true);
    expect(tm.getTempoAt(100.0)).toBeCloseTo(120.0, 4);
    expect(tm.beatsToSeconds(100.0)).toBeCloseTo(50.0, 4);
  });

  it('testCannotRemoveLastPoint', () => {
    const tm = new TempoMap();
    expect(() => tm.removeTempoPoint(0)).toThrow();
  });

  // ===== reset =====

  it('testReset', () => {
    const tm = new TempoMap();
    tm.setEnabled(true);
    tm.addTempoPoint(new TempoPoint(undefined, 120.0));
    tm.addTempoPoint(new TempoPoint(undefined, 90.0));
    tm.reset();
    expect(tm.size()).toBe(1);
    expect(tm.getBeat(0)).toBeCloseTo(0.0, 4);
    expect(tm.getTempo(0)).toBeCloseTo(60.0, 4);
  });

  // ===== replaceAll =====

  it('testReplaceAllCopiesData', () => {
    const original = new TempoMap();
    const source = new TempoMap();
    source.setEnabled(true);
    source.setVisible(true);
    source.addTempoPoint(new TempoPoint(undefined, 120.0, CurveType.CONSTANT));
    source.addTempoPoint(new TempoPoint(undefined, 90.0, CurveType.LINEAR));

    original.replaceAll(source);
    expect(original.size()).toBe(3);
    expect(original.isEnabled()).toBe(true);
    expect(original.isVisible()).toBe(true);
    expect(original.getTempo(1)).toBeCloseTo(120.0, 4);
    expect(original.getCurveType(1)).toBe(CurveType.CONSTANT);
  });

  it('testReplaceAllFiresListeners', () => {
    const tm = new TempoMap();
    let tempoListenerCount = 0;
    tm.addListener(() => tempoListenerCount++);

    const source = new TempoMap();
    source.setEnabled(true);
    source.addTempoPoint(new TempoPoint(undefined, 120.0));
    tm.replaceAll(source);
    expect(tempoListenerCount).toBe(1);
  });

  it('testReplaceAllPreservesListeners', () => {
    const tm = new TempoMap();
    let callCount = 0;
    tm.addListener(() => callCount++);

    const source1 = new TempoMap();
    source1.addTempoPoint(new TempoPoint(undefined, 120.0));
    tm.replaceAll(source1);

    const source2 = new TempoMap();
    source2.addTempoPoint(new TempoPoint(undefined, 90.0));
    tm.replaceAll(source2);

    expect(callCount).toBe(2);
  });
});
