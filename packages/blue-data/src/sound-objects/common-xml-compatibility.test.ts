import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { GenericScore } from './generic-score';
import { readResourceXml } from '../resource-xml-policy';

describe('SL-H05 local SoundObject time normalization', () => {
  it.each([
    ['BeatTime', '<csoundBeats>2.5</csoundBeats>', 'BEATS', 'csoundBeats', '2.5'],
    [
      'TimeValue',
      '<hours>1</hours><minutes>2</minutes><seconds>3</seconds><milliseconds>4</milliseconds>',
      'TIME',
      'hours',
      '1',
    ],
    ['FrameValue', '<frameNumber>123</frameNumber>', 'FRAME', 'frameNumber', '123'],
  ])(
    'normalizes direct %s position and duration without converting units',
    (type, fields, base, member, value) => {
      const xml = `<soundObject type="blue.soundObject.GenericScore"><startTimeUnit type="${type}">${fields}</startTimeUnit><durationUnit type="${type}">${fields}</durationUnit><score>  i1 0 2\n</score></soundObject>`;
      const direct = GenericScore.loadFromXML(Element.parse(xml));
      const result = readResourceXml('soundObject', xml, {
        kind: 'soundObject',
        label: 'time.xml',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.saveAsXML().toXml()).toBe(direct.saveAsXML().toXml());
      const canonical = direct.saveAsXML();
      expect(canonical.getElement('startTime')!.getAttribute('type')).toBe(base);
      expect(canonical.getElement('startTime')!.getElement(member)!.getTextString()).toBe(value);
      expect(canonical.getElement('subjectiveDuration')!.getAttribute('type')).toBe(base);
      expect(
        canonical
          .getElement('subjectiveDuration')!
          .getElement(base === 'FRAME' ? 'frameCount' : member)!
          .getTextString(),
      ).toBe(value);
      expect(canonical.hasElement('durationUnit')).toBe(false);
    },
  );

  it.each([
    '<startTimeUnit type="MeasureBeatsTime"><measureNumber>1</measureNumber><beatNumber>1.5</beatNumber></startTimeUnit>',
    '<durationUnit type="SMPTEValue"><hours>0</hours><minutes>0</minutes><seconds>1</seconds><frames>12</frames></durationUnit>',
    '<startTimeUnit><timeUnit type="BeatTime"><csoundBeats>2</csoundBeats></timeUnit></startTimeUnit>',
    '<startTime>1junk</startTime>',
    '<subjectiveDuration>-1</subjectiveDuration>',
    '<repeatPoint>-2</repeatPoint>',
    '<timeBehavior>9</timeBehavior>',
    '<timeBehavior>0junk</timeBehavior>',
    '<startTime>1</startTime><startTimePosition type="BEATS"><csoundBeats>2</csoundBeats></startTimePosition>',
    '<startTime>1</startTime><startTime>1</startTime>',
  ])('rejects unsupported, invalid or conflicting common timing %s', (fields) => {
    const result = readResourceXml(
      'soundObject',
      `<soundObject type="blue.soundObject.GenericScore">${fields}</soundObject>`,
      { kind: 'soundObject', label: 'time.xml' },
    );
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0].source.label).toBe('time.xml');
  });

  it('coalesces equal time aliases and preserves code whitespace and explicit empty names', () => {
    const object = GenericScore.loadFromXML(
      Element.parse(
        '<soundObject type="GenericScore"><name></name><startTime>2</startTime><startTimePosition type="BEATS"><csoundBeats>2</csoundBeats></startTimePosition><score>  \ni1 0 2\n </score></soundObject>',
      ),
    );
    expect(object.getName()).toBe('');
    expect(object.getStartTime().getCsoundBeats()).toBe(2);
    expect(object.getScoreText()).toBe('  \ni1 0 2\n ');
  });
});

it('normalizes existing unsigned TypeScript ARGB output to the same signed bit pattern', () => {
  const object = GenericScore.loadFromXML(
    Element.parse(
      '<soundObject type="blue.soundObject.GenericScore"><backgroundColor>4281558681</backgroundColor></soundObject>',
    ),
  );
  expect(object.getBackgroundColor()).toBe(-13408615);
  expect(object.saveAsXML().getTextString('backgroundColor')).toBe('-13408615');
  expect(() =>
    GenericScore.loadFromXML(
      Element.parse(
        '<soundObject type="blue.soundObject.GenericScore"><backgroundColor>4294967296</backgroundColor></soundObject>',
      ),
    ),
  ).toThrow();
});
