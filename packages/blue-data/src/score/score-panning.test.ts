import { describe, expect, it } from 'vitest';
import { Score } from './score';
import { Element } from '../serialization/xml-reader';
import { BlueData } from '../blue-data';

describe('Score panningEnabled configuration and serialization (T027, T028)', () => {
  it('defaults to true on newly created Score', () => {
    const score = new Score();
    expect(score.panningEnabled).toBe(true);
  });

  it('preserves panningEnabled across deepCopy', () => {
    const score = new Score();
    score.panningEnabled = false;
    const copy = score.deepCopy();
    expect(copy.panningEnabled).toBe(false);

    score.panningEnabled = true;
    const copy2 = score.deepCopy();
    expect(copy2.panningEnabled).toBe(true);
  });

  it('serializes panningEnabled as attribute on score element', () => {
    const score = new Score();
    score.panningEnabled = true;
    const xml = score.saveAsXML();
    expect(xml.getAttribute('panningEnabled')).toBe('true');

    score.panningEnabled = false;
    const xmlFalse = score.saveAsXML();
    expect(xmlFalse.getAttribute('panningEnabled')).toBe('false');
  });

  it('loads absent panningEnabled as false (legacy behavior)', () => {
    const elem = new Element('score');
    const loaded = Score.loadFromXML(elem);
    expect(loaded.panningEnabled).toBe(false);
  });

  it('loads invalid panningEnabled values as false', () => {
    for (const invalid of ['1', 'yes', 'enabled', '', 'null', 'TRUE_EXTRA']) {
      const elem = new Element('score');
      elem.setAttribute('panningEnabled', invalid);
      const loaded = Score.loadFromXML(elem);
      expect(loaded.panningEnabled).toBe(false);
    }
  });

  it('loads explicit true and false correctly', () => {
    const elemTrue = new Element('score');
    elemTrue.setAttribute('panningEnabled', 'true');
    expect(Score.loadFromXML(elemTrue).panningEnabled).toBe(true);

    const elemFalse = new Element('score');
    elemFalse.setAttribute('panningEnabled', 'false');
    expect(Score.loadFromXML(elemFalse).panningEnabled).toBe(false);
  });

  it('loads project XML without <score> as false', () => {
    const xml = [
      '<blueData version="2.8.0">',
      '  <projectProperties>',
      '    <title>No Score</title>',
      '  </projectProperties>',
      '</blueData>',
    ].join('\n');
    const data = BlueData.loadFromString(xml);
    expect(data.getScore().panningEnabled).toBe(false);
  });
});

describe('Score panLawDb and panOffCenterBoost configuration and serialization (T010, T013)', () => {
  it('defaults to -3 dB and boost false on newly created Score', () => {
    const score = new Score();
    expect(score.panLawDb).toBe(-3);
    expect(score.panOffCenterBoost).toBe(false);
  });

  it('preserves panLawDb and panOffCenterBoost across deepCopy', () => {
    const score = new Score();
    score.panLawDb = -6;
    score.panOffCenterBoost = true;
    score.panningEnabled = false;

    const copy = score.deepCopy();
    expect(copy.panLawDb).toBe(-6);
    expect(copy.panOffCenterBoost).toBe(true);
    expect(copy.panningEnabled).toBe(false);

    score.panLawDb = -4.5;
    score.panOffCenterBoost = false;
    const copy2 = score.deepCopy();
    expect(copy2.panLawDb).toBe(-4.5);
    expect(copy2.panOffCenterBoost).toBe(false);
  });

  it('serializes panLawDb and panOffCenterBoost as attributes on score element', () => {
    const score = new Score();
    score.panLawDb = -6;
    score.panOffCenterBoost = true;
    const xml = score.saveAsXML();
    expect(xml.getAttribute('panLawDb')).toBe('-6');
    expect(xml.getAttribute('panOffCenterBoost')).toBe('true');

    score.panLawDb = 0;
    score.panOffCenterBoost = false;
    const xml2 = score.saveAsXML();
    expect(xml2.getAttribute('panLawDb')).toBe('0');
    expect(xml2.getAttribute('panOffCenterBoost')).toBe('false');
  });

  it('loads absent panLawDb and panOffCenterBoost with defaults', () => {
    const elem = new Element('score');
    const loaded = Score.loadFromXML(elem);
    expect(loaded.panLawDb).toBe(-3);
    expect(loaded.panOffCenterBoost).toBe(false);
  });

  it('loads invalid panLawDb values with default fallback', () => {
    for (const invalid of ['-1', '-5', 'foo', '', 'null', '3']) {
      const elem = new Element('score');
      elem.setAttribute('panLawDb', invalid);
      const loaded = Score.loadFromXML(elem);
      expect(loaded.panLawDb).toBe(-3);
    }
  });

  it('loads invalid panOffCenterBoost values as false', () => {
    for (const invalid of ['1', 'yes', 'enabled', '', 'null']) {
      const elem = new Element('score');
      elem.setAttribute('panOffCenterBoost', invalid);
      const loaded = Score.loadFromXML(elem);
      expect(loaded.panOffCenterBoost).toBe(false);
    }
  });

  it('loads explicit valid panLawDb and panOffCenterBoost values', () => {
    for (const law of ['0', '-3', '-4.5', '-6']) {
      const elem = new Element('score');
      elem.setAttribute('panLawDb', law);
      elem.setAttribute('panOffCenterBoost', 'true');
      const loaded = Score.loadFromXML(elem);
      expect(loaded.panLawDb).toBe(Number(law));
      expect(loaded.panOffCenterBoost).toBe(true);
    }
  });

  it('preserves pan law and boost settings even when panningEnabled is false', () => {
    const score = new Score();
    score.panningEnabled = false;
    score.panLawDb = -4.5;
    score.panOffCenterBoost = true;

    const xml = score.saveAsXML();
    const loaded = Score.loadFromXML(xml);
    expect(loaded.panningEnabled).toBe(false);
    expect(loaded.panLawDb).toBe(-4.5);
    expect(loaded.panOffCenterBoost).toBe(true);
  });
});
