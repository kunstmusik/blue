import { describe, it, expect } from 'vite-plus/test';
import { Pattern } from '../../src/sound-objects/pattern/pattern';
import { Element } from '../../src/serialization/xml-reader';

describe('Pattern', () => {
  it('testDefaultConstruction', () => {
    const p = new Pattern(16);
    expect(p.values.length).toBe(16);
    expect(p.patternName).toBe('pattern');
    expect(p.patternScore).toBe('');
    expect(p.muted).toBe(false);
    expect(p.solo).toBe(false);
    for (const v of p.values) {
      expect(v).toBe(false);
    }
  });

  it('testCopyConstructor', () => {
    const p = new Pattern(16);
    p.patternName = 'BD';
    p.patternScore = 'i3 0 1 0';
    p.muted = true;
    p.values[0] = true;
    p.values[4] = true;

    const copy = Pattern.copyFrom(p);
    expect(copy.values.length).toBe(16);
    expect(copy.patternName).toBe('BD');
    expect(copy.patternScore).toBe('i3 0 1 0');
    expect(copy.muted).toBe(true);
    expect(copy.values[0]).toBe(true);
    expect(copy.values[4]).toBe(true);

    // Verify independence
    copy.values[0] = false;
    expect(p.values[0]).toBe(true);
  });

  it('testValuesParsing', () => {
    const elem = new Element('pattern');
    elem.addElement('patternName').setText('BD');
    elem.addElement('patternScore').setText('i3 0 1 0');
    elem.addElement('muted').setText('false');
    elem.addElement('solo').setText('false');
    elem.addElement('values').setText('1010001010010010');

    const p = Pattern.loadFromXML(elem);
    expect(p.values.length).toBe(16);
    expect(p.values[0]).toBe(true);
    expect(p.values[1]).toBe(false);
    expect(p.values[2]).toBe(true);
    expect(p.values[3]).toBe(false);
    expect(p.values[4]).toBe(false);
    expect(p.values[5]).toBe(false);
    expect(p.values[6]).toBe(true);
    expect(p.values[7]).toBe(false);
    expect(p.patternName).toBe('BD');
    expect(p.patternScore).toBe('i3 0 1 0');
    expect(p.muted).toBe(false);
    expect(p.solo).toBe(false);
  });

  it('testSaveAndLoadXML', () => {
    const p = new Pattern(16);
    p.patternName = 'HiHat';
    p.patternScore = 'i3 0 1 3';
    p.muted = true;
    p.solo = true;
    p.values[0] = true;
    p.values[4] = true;
    p.values[15] = true;

    const xml = p.saveAsXML();
    const loaded = Pattern.loadFromXML(xml);

    expect(loaded.patternName).toBe('HiHat');
    expect(loaded.patternScore).toBe('i3 0 1 3');
    expect(loaded.muted).toBe(true);
    expect(loaded.solo).toBe(true);
    expect(loaded.values.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      expect(loaded.values[i]).toBe(p.values[i]);
    }
  });
});
