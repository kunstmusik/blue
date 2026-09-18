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
