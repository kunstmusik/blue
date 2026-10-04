import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { TimeDuration } from './time-duration';
import { TimePosition } from './time-position';

describe('typed time XML contracts', () => {
  it.each([
    '<time type="future">3</time>',
    '<time>3</time>',
    '<time type="BEATS"/>',
    '<time type="BEATS"><csoundBeats>3junk</csoundBeats></time>',
    '<time type="FRAME"><frameCount>9007199254740992</frameCount></time>',
    '<time type="FRAME"><frameCount>1.5</frameCount></time>',
    '<time type="FRAME"><frameCount>1</frameCount><frameNumber>2</frameNumber></time>',
    '<time type="TIME"><hours>0</hours><minutes>60</minutes><seconds>0</seconds><milliseconds>0</milliseconds></time>',
  ])('rejects incomplete, unknown, conflicting, or invalid typed input: %s', (xml) => {
    expect(() => TimeDuration.loadFromXML(Element.parse(xml))).toThrow();
    expect(() => TimePosition.loadFromXML(Element.parse(xml))).toThrow();
  });

  it('uses distinct canonical frame fields and coalesces equal aliases', () => {
    const xml =
      '<time type="FRAME"><frameCount>17</frameCount><frameNumber>17</frameNumber></time>';
    const position = TimePosition.loadFromXML(Element.parse(xml)).saveAsXML();
    expect(position.getTextString('frameNumber')).toBe('17');
    expect(position.hasElement('frameCount')).toBe(false);
    const duration = TimeDuration.loadFromXML(Element.parse(xml)).saveAsXML();
    expect(duration.getTextString('frameCount')).toBe('17');
    expect(duration.hasElement('frameNumber')).toBe(false);
  });

  it('accepts historical class discriminants and preserves interval components', () => {
    const duration = TimeDuration.loadFromXML(
      Element.parse(
        '<time type="DurationTime"><hours>1</hours><minutes>2</minutes><seconds>3</seconds><milliseconds>4</milliseconds></time>',
      ),
    );
    expect(duration.saveAsXML().getAttribute('type')).toBe('TIME');
    expect(duration.saveAsXML().getTextString('hours')).toBe('1');
    expect(duration.saveAsXML().getTextString('milliseconds')).toBe('4');
    const position = TimePosition.loadFromXML(
      Element.parse('<time type="BeatTime"><csoundBeats>-1.25</csoundBeats></time>'),
    );
    expect(position.getValue()).toBe(-1.25);
    expect(position.saveAsXML().getAttribute('type')).toBe('BEATS');
  });
});
