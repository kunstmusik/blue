import { describe, expect, it } from 'vite-plus/test';
import { CompileData } from '../compile-data';
import { BlueData } from '../blue-data';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { PolyObject } from './poly-object';
import { SoundLayer } from './sound-layer';
import { LineObject } from './line-object';
import { ZakLineObject } from './zak-line-object';
import { Element } from '../serialization/xml-reader';

describe('LineObject CSD parity', () => {
  it('generates tables, orchestra code, and score notes for LineObject', () => {
    const lineObject = new LineObject();
    lineObject.setStartTime(TimePosition.beats(2));
    lineObject.setSubjectiveDuration(TimeDuration.beats(10));
    lineObject.addLine({
      varName: 'env',
      min: 0,
      max: 1,
      resolution: '-1',
      color: -8355712,
      rightBound: true,
      endPointsLinked: false,
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0.5 },
      ],
    });

    const compileData = new CompileData();
    const notes = lineObject.generateForCSD(new TimeContext(), compileData, 1, 8);

    expect(notes.length).toBe(1);
    const note = notes.getNote(0);
    expect(note.getPField(1)).toBe('1');
    expect(note.getStartTime()).toBeCloseTo(3, 6);
    expect(note.getSubjectiveDuration()).toBeCloseTo(7, 6);
    expect(note.getPField(4)).toBe('0.1');
    expect(note.getPField(5)).toBe('0.8');
    expect(note.getPField(6)).toBe('1');

    const tables = compileData.getTables().getTables();
    expect(tables).toContain('f1 0 16384 -7 0 8192 1 8192 0.5');

    const orc = compileData.getArrangement().generateOrchestra(compileData);
    expect(orc).toContain('kphase line p4, p3, p5');
    expect(orc).toContain('gkenv\ttablei kphase, p6, 1');
  });

  it('loads and saves Java-style LineObject line XML attributes', () => {
    const xml = Element.parse(`<soundObject type="blue.soundObject.LineObject">
      <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
      <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
      <name>LineObject</name>
      <line name="env" version="2" max="1.0" min="-1.0" bdresolution="-1" color="-65536" rightBound="true" endPointsLinked="false">
        <linePoint x="0.0" y="0.25"/>
        <linePoint x="1.0" y="0.75"/>
      </line>
    </soundObject>`);

    const lineObject = LineObject.loadFromXML(xml);
    const line = lineObject.getLines()[0]!;
    expect(line.varName).toBe('env');
    expect(line.min).toBe(-1);
    expect(line.max).toBe(1);
    expect(line.color).toBe(-65536);
    expect(line.rightBound).toBe(true);
    expect(line.points).toEqual([
      { x: 0, y: 0.25 },
      { x: 1, y: 0.75 },
    ]);

    const saved = lineObject.saveAsXML().toXml();
    expect(saved).toContain('<line name="env"');
    expect(saved).toContain('max="1"');
    expect(saved).toContain('min="-1"');
    expect(saved).toContain('color="-65536"');
    expect(saved).toContain('<linePoint x="0" y="0.25"/>');
  });

  it('includes LineObject score and orchestra output in project CSD', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const poly = new PolyObject(true);
    const layer = new SoundLayer();
    const lineObject = new LineObject();
    lineObject.setStartTime(TimePosition.beats(0.5));
    lineObject.setSubjectiveDuration(TimeDuration.beats(4));
    lineObject.addLine({
      varName: 'env',
      min: 0,
      max: 1,
      resolution: '-1',
      color: -65536,
      rightBound: true,
      endPointsLinked: false,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    layer.push(lineObject);
    poly.push(layer);
    data.getScore().push(poly);

    const csd = data.toCSD();
    expect(csd).toContain('kphase line p4, p3, p5');
    expect(csd).toContain('gkenv\ttablei kphase, p6, 1');
    expect(csd).toContain('i1\t0.5\t4\t0\t1\t1');
  });
});

describe('ZakLineObject CSD parity', () => {
  it('generates zak line orchestra code and notes', () => {
    const zak = new ZakLineObject();
    zak.setStartTime(TimePosition.beats(1));
    zak.setSubjectiveDuration(TimeDuration.beats(8));
    zak.addLine({
      channel: 3,
      min: 0,
      max: 1,
      resolution: '-1',
      color: -8355712,
      rightBound: true,
      endPointsLinked: false,
      points: [
        { x: 0, y: 0.2 },
        { x: 1, y: 0.8 },
      ],
    });

    const compileData = new CompileData();
    const notes = zak.generateForCSD(new TimeContext(), compileData, 0, -1);
    expect(notes.length).toBe(1);
    expect(notes.getNote(0).getPField(1)).toBe('1');
    expect(notes.getNote(0).getPField(4)).toBe('0');
    expect(notes.getNote(0).getPField(5)).toBe('1');

    const orc = compileData.getArrangement().generateOrchestra(compileData);
    expect(orc).toContain('kphase line p4, p3, p5');
    expect(orc).toContain('zkw kline, 3');
  });
});
