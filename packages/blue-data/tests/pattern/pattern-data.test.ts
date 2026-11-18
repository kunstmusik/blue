import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { PatternData } from '../../src/score/patterns/pattern-data';

describe('PatternData', () => {
  let patternData: PatternData;

  beforeEach(() => {
    patternData = new PatternData();
  });

  it('testIsPatternSet', () => {
    expect(patternData.isPatternSet(1)).toBe(false);
    patternData.setPattern(1, true);
    expect(patternData.isPatternSet(1)).toBe(true);
    patternData.setPattern(1, false);
    expect(patternData.isPatternSet(1)).toBe(false);
    expect(patternData.isPatternSet(-1)).toBe(false);
    expect(patternData.isPatternSet(300)).toBe(false);
  });

  it('testSetPattern', () => {
    expect(patternData.isPatternSet(1)).toBe(false);
    patternData.setPattern(1, true);
    expect(patternData.isPatternSet(1)).toBe(true);
    expect(patternData.getSize()).toBe(16);
    patternData.setPattern(33, false);
    expect(patternData.getSize()).toBe(16);
    patternData.setPattern(33, true);
    expect(patternData.isPatternSet(33)).toBe(true);
    expect(patternData.getSize()).toBe(48);
  });

  it('testCalculateMaxSelected', () => {
    expect(patternData.getMaxSelected()).toBe(-1);
    patternData.setPattern(2, true);
    expect(patternData.getMaxSelected()).toBe(2);
    patternData.setPattern(4, true);
    expect(patternData.getMaxSelected()).toBe(4);
    patternData.setPattern(33, true);
    expect(patternData.getMaxSelected()).toBe(33);
    expect(patternData.getSize()).toBe(48);
    patternData.setPattern(33, false);
    expect(patternData.getMaxSelected()).toBe(4);
  });

  it('testResizePatterns', () => {
    expect(patternData.getSize()).toBe(16);
    patternData.resizePatterns(35);
    expect(patternData.getSize()).toBe(48);
    patternData.resizePatterns(7);
    expect(patternData.getSize()).toBe(16);
  });

  it('testSaveAsXML', () => {
    let data = patternData.saveAsXML();
    expect(data.getTextString()).toBe('0000000000000000');

    patternData.setPattern(0, true);
    patternData.setPattern(4, true);
    patternData.setPattern(15, true);
    data = patternData.saveAsXML();
    expect(data.getTextString()).toBe('1000100000000001');

    patternData.setPattern(16, true);
    expect(patternData.getSize()).toBe(32);
    patternData.setPattern(16, false);
    expect(patternData.getSize()).toBe(32);
    data = patternData.saveAsXML();
    expect(data.getTextString()).toBe('1000100000000001');
  });

  it('testLoadFromXML', () => {
    patternData.setPattern(0, true);
    patternData.setPattern(4, true);
    patternData.setPattern(15, true);
    const data = patternData.saveAsXML();
    expect(data.getTextString()).toBe('1000100000000001');

    const patternData2 = PatternData.loadFromXML(data);
    const data2 = patternData2.saveAsXML();
    expect(data2.getTextString()).toBe(data.getTextString());
    expect(patternData2.getPatterns().length).toBe(patternData.getPatterns().length);
    const p1 = patternData.getPatterns();
    const p2 = patternData2.getPatterns();
    for (let i = 0; i < p1.length; i++) {
      expect(p2[i]).toBe(p1[i]);
    }

    patternData.setPattern(33, true);
    const data3 = patternData.saveAsXML();
    const patternData3 = PatternData.loadFromXML(data3);
    expect(patternData3.getSize()).toBe(48);
  });
});
