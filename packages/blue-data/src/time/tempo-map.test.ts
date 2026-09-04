import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { CurveType } from './curve-type';
import { TempoMap } from './tempo-map';
import { TempoPoint } from './tempo-point';

describe('TempoMap compatibility', () => {
  it('sorts out-of-order tempo points during accumulation', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.addTempoPoint(new TempoPoint(8, 120, CurveType.CONSTANT));
    tempoMap.addTempoPoint(new TempoPoint(0, 60, CurveType.CONSTANT));

    expect(tempoMap.getBeat(0)).toBeCloseTo(0, 6);
    expect(tempoMap.getBeat(2)).toBeCloseTo(8, 6);
    expect(tempoMap.beatsToSeconds(4)).toBeCloseTo(4, 6);
  });

  it('round-trips XML with enabled and visible flags', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setVisible(true);
    tempoMap.setTempoPoint(0, 0, 90, CurveType.CONSTANT);
    tempoMap.addTempoPoint(new TempoPoint(8, 120, CurveType.LINEAR));

    const savedXml = tempoMap.saveAsXML().toXml();
    const reloaded = TempoMap.loadFromXML(Element.parse(savedXml));

    expect(reloaded.isEnabled()).toBe(true);
    expect(reloaded.isVisible()).toBe(true);
    expect(reloaded.size()).toBe(2);
    expect(reloaded.getTempo(0)).toBeCloseTo(90, 6);
  });
});

describe('TempoMap visible listener', () => {
  it('fires listeners when visible changes', () => {
    const tempoMap = new TempoMap();
    let callCount = 0;
    tempoMap.addListener(() => {
      callCount++;
    });

    tempoMap.setVisible(true);
    expect(tempoMap.isVisible()).toBe(true);
    expect(callCount).toBe(1);

    tempoMap.setVisible(false);
    expect(tempoMap.isVisible()).toBe(false);
    expect(callCount).toBe(2);
  });

  it('does not fire listeners when visible is set to the same value', () => {
    const tempoMap = new TempoMap();
    let callCount = 0;
    tempoMap.addListener(() => {
      callCount++;
    });

    tempoMap.setVisible(false);
    expect(callCount).toBe(0);
  });

  it('round-trips visible false through XML', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setVisible(false);

    const savedXml = tempoMap.saveAsXML().toXml();
    const reloaded = TempoMap.loadFromXML(Element.parse(savedXml));

    expect(reloaded.isEnabled()).toBe(true);
    expect(reloaded.isVisible()).toBe(false);
  });
});

describe('TempoMap point mutations', () => {
  it('getTempoAt returns constant tempo within a segment', () => {
    const map = new TempoMap();
    map.setEnabled(true);
    map.setTempoPoint(0, 0, 60, CurveType.CONSTANT);
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    expect(map.getTempoAt(0)).toBe(60);
    expect(map.getTempoAt(2)).toBe(60);
    expect(map.getTempoAt(4)).toBe(120);
    expect(map.getTempoAt(8)).toBe(120);
  });

  it('getTempoAt interpolates linear segments', () => {
    const map = new TempoMap();
    map.setEnabled(true);
    map.setTempoPoint(0, 0, 60, CurveType.LINEAR);
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    expect(map.getTempoAt(0)).toBe(60);
    expect(map.getTempoAt(2)).toBeCloseTo(90, 6);
    expect(map.getTempoAt(4)).toBe(120);
  });

  it('getTempoAt returns 60 when disabled', () => {
    const map = new TempoMap();
    map.setEnabled(false);
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));

    expect(map.getTempoAt(0)).toBe(60);
    expect(map.getTempoAt(4)).toBe(60);
  });

  it('removeTempoPoint throws when removing the last point', () => {
    const map = new TempoMap();
    expect(() => map.removeTempoPoint(0)).toThrow('Cannot remove the last tempo point');
  });

  it('removeTempoPoint removes a point and fires listeners', () => {
    const map = new TempoMap();
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));
    expect(map.size()).toBe(2);

    let callCount = 0;
    map.addListener(() => {
      callCount++;
    });

    map.removeTempoPoint(1);
    expect(map.size()).toBe(1);
    expect(callCount).toBe(1);
  });

  it('setTempoPoint with beat/tempo/curveType updates the point', () => {
    const map = new TempoMap();
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));
    map.setTempoPoint(1, 8, 100, CurveType.LINEAR);

    expect(map.getBeat(1)).toBe(8);
    expect(map.getTempo(1)).toBe(100);
    expect(map.getCurveType(1)).toBe(CurveType.LINEAR);
  });

  it('replaceAll copies enabled, visible, and points', () => {
    const source = new TempoMap();
    source.setEnabled(true);
    source.setVisible(true);
    source.addTempoPoint(new TempoPoint(4, 120, CurveType.LINEAR));

    const target = new TempoMap();
    target.replaceAll(source);

    expect(target.isEnabled()).toBe(true);
    expect(target.isVisible()).toBe(true);
    expect(target.size()).toBe(2);
    expect(target.getTempo(1)).toBe(120);
    expect(target.getCurveType(1)).toBe(CurveType.LINEAR);
  });

  it('reset restores single default point', () => {
    const map = new TempoMap();
    map.setEnabled(true);
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.LINEAR));

    map.reset();
    expect(map.size()).toBe(1);
    expect(map.getTempo(0)).toBe(60);
    expect(map.getBeat(0)).toBe(0);
    expect(map.getCurveType(0)).toBe(CurveType.CONSTANT);
  });
});

describe('TempoMap save/load with constant and linear points', () => {
  it('round-trips a multi-point map with mixed curve types', () => {
    const map = new TempoMap();
    map.setEnabled(true);
    map.setVisible(true);
    map.setTempoPoint(0, 0, 72, CurveType.CONSTANT);
    map.addTempoPoint(new TempoPoint(4, 120, CurveType.LINEAR));
    map.addTempoPoint(new TempoPoint(8, 90, CurveType.CONSTANT));

    const xml = map.saveAsXML().toXml();
    const reloaded = TempoMap.loadFromXML(Element.parse(xml));

    expect(reloaded.isEnabled()).toBe(true);
    expect(reloaded.isVisible()).toBe(true);
    expect(reloaded.size()).toBe(3);
    expect(reloaded.getBeat(0)).toBe(0);
    expect(reloaded.getTempo(0)).toBe(72);
    expect(reloaded.getCurveType(0)).toBe(CurveType.CONSTANT);
    expect(reloaded.getBeat(1)).toBe(4);
    expect(reloaded.getTempo(1)).toBe(120);
    expect(reloaded.getCurveType(1)).toBe(CurveType.LINEAR);
    expect(reloaded.getBeat(2)).toBe(8);
    expect(reloaded.getTempo(2)).toBe(90);
    expect(reloaded.getCurveType(2)).toBe(CurveType.CONSTANT);
  });

  it('loads legacy beatTempoPair format', () => {
    const xml = `<tempoMap><beatTempoPair beat="0" tempo="60"/><beatTempoPair beat="4" tempo="120"/></tempoMap>`;
    const reloaded = TempoMap.loadFromXML(Element.parse(xml));

    expect(reloaded.size()).toBe(2);
    expect(reloaded.getBeat(0)).toBe(0);
    expect(reloaded.getTempo(0)).toBe(60);
    expect(reloaded.getBeat(1)).toBe(4);
    expect(reloaded.getTempo(1)).toBe(120);
  });
});
