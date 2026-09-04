import { describe, it, expect } from 'vitest';
import { PatternObject } from '../../src/sound-objects/pattern-object';
import { Pattern } from '../../src/sound-objects/pattern/pattern';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeContext } from '../../src/time/time-context';
import { Element } from '../../src/serialization/xml-reader';

describe('PatternObject', () => {
  // ===== Clone Test (matches Java PatternObjectTest) =====

  it('testClone', () => {
    const p = new PatternObject();
    p.addPattern(new Pattern(16));
    p.addPattern(new Pattern(16));
    p.addPattern(new Pattern(16));

    // Randomize values
    for (let i = 0; i < p.size(); i++) {
      const pat = p.getPattern(i);
      for (let j = 0; j < pat.values.length; j++) {
        pat.values[j] = Math.random() > 0.5;
      }
    }

    const clone = p.deepCopy() as PatternObject;
    expect(clone.saveAsXML().toString()).toBe(p.saveAsXML().toString());
  });

  // ===== XML Load Test =====

  it('testLoadFromXML', () => {
    const root = new Element('soundObject');
    root.setAttribute('type', 'PatternObject');
    const st = root.addElement('startTime');
    st.setAttribute('type', 'BEATS');
    st.addElement('csoundBeats').setText('32.0');
    const sd = root.addElement('subjectiveDuration');
    sd.setAttribute('type', 'BEATS');
    sd.addElement('csoundBeats').setText('8.0');
    root.addElement('name').setText('Pattern');
    root.addElement('backgroundColor').setText('-13421569');
    root.addElement('timeBehavior').setText('1');
    const rp = root.addElement('repeatPoint');
    rp.setAttribute('type', 'BEATS');
    rp.addElement('csoundBeats').setText('4.0');
    root.addElement('noteProcessorChain');
    root.addElement('beats').setText('4');
    root.addElement('subDivisions').setText('4');

    const patternsNode = root.addElement('patterns');

    const p1 = patternsNode.addElement('pattern');
    p1.addElement('patternName').setText('BD');
    p1.addElement('patternScore').setText('i3 0 1 0');
    p1.addElement('muted').setText('false');
    p1.addElement('solo').setText('false');
    p1.addElement('values').setText('1010001010010010');

    const p2 = patternsNode.addElement('pattern');
    p2.addElement('patternName').setText('Clap');
    p2.addElement('patternScore').setText('i3 0 1 1');
    p2.addElement('muted').setText('false');
    p2.addElement('solo').setText('false');
    p2.addElement('values').setText('0000100000001000');

    const obj = PatternObject.loadFromXML(root);
    expect(obj.size()).toBe(2);
    expect(obj.getBeats()).toBe(4);
    expect(obj.getSubDivisions()).toBe(4);
    expect(obj.getPattern(0).patternName).toBe('BD');
    expect(obj.getPattern(0).patternScore).toBe('i3 0 1 0');
    expect(obj.getPattern(1).patternName).toBe('Clap');
  });

  // ===== Generate For CSD Tests =====

  it('testGenerateForCSD', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));
    obj.setTimeBehavior(TimeBehavior.NONE);
    obj.setBeats(4);
    obj.setSubDivisions(4);

    // BD pattern: steps 0, 2, 5, 8, 10, 13
    const pat = new Pattern(16);
    pat.patternScore = 'i3 0 1 0';
    pat.values[0] = true;
    pat.values[2] = true;
    pat.values[5] = true;
    pat.values[8] = true;
    pat.values[10] = true;
    pat.values[13] = true;
    obj.addPattern(pat);

    const nl = obj.generateForCSD(context, null, 0, -1);
    // 6 active steps × 1 note each = 6 notes
    expect(nl.length).toBe(6);

    // Check start times: step * timeIncrement = step * 0.25
    const starts: number[] = [];
    for (let i = 0; i < nl.length; i++) {
      starts.push(nl.getNote(i).getStartTime());
    }
    starts.sort((a, b) => a - b);
    expect(starts[0]).toBeCloseTo(0.0, 4); // step 0
    expect(starts[1]).toBeCloseTo(0.5, 4); // step 2
    expect(starts[2]).toBeCloseTo(1.25, 4); // step 5
    expect(starts[3]).toBeCloseTo(2.0, 4); // step 8
    expect(starts[4]).toBeCloseTo(2.5, 4); // step 10
    expect(starts[5]).toBeCloseTo(3.25, 4); // step 13
  });

  it('testGenerateForCSDDualPattern', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));
    obj.setTimeBehavior(TimeBehavior.NONE);

    const bd = new Pattern(16);
    bd.patternScore = 'i3 0 1 0';
    bd.values[0] = true;
    obj.addPattern(bd);

    const hh = new Pattern(16);
    hh.patternScore = 'i3 0 1 3';
    hh.values[0] = true;
    hh.values[4] = true;
    hh.values[8] = true;
    hh.values[12] = true;
    obj.addPattern(hh);

    const nl = obj.generateForCSD(context, null, 0, -1);
    // BD: 1 note, HH: 4 notes = 5 total
    expect(nl.length).toBe(5);
  });

  it('testMutedPattern', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));
    obj.setTimeBehavior(TimeBehavior.NONE);

    const muted = new Pattern(16);
    muted.patternScore = 'i3 0 1 0';
    muted.muted = true;
    muted.values[0] = true;
    obj.addPattern(muted);

    const active = new Pattern(16);
    active.patternScore = 'i3 0 1 1';
    active.values[0] = true;
    obj.addPattern(active);

    const nl = obj.generateForCSD(context, null, 0, -1);
    // Only active (non-muted) pattern generates notes
    expect(nl.length).toBe(1);
  });

  it('testSoloPattern', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));
    obj.setTimeBehavior(TimeBehavior.NONE);

    const normal = new Pattern(16);
    normal.patternScore = 'i3 0 1 0';
    normal.values[0] = true;
    normal.values[4] = true;
    obj.addPattern(normal);

    const solo = new Pattern(16);
    solo.patternScore = 'i3 0 1 3';
    solo.solo = true;
    solo.values[0] = true;
    obj.addPattern(solo);

    const nl = obj.generateForCSD(context, null, 0, -1);
    // Only solo pattern generates notes (1 note), normal is ignored
    expect(nl.length).toBe(1);
  });

  it('testStartTimeOffset', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(8.0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));
    obj.setTimeBehavior(TimeBehavior.NONE);

    const pat = new Pattern(16);
    pat.patternScore = 'i3 0 1 0';
    pat.values[0] = true;
    obj.addPattern(pat);

    const nl = obj.generateForCSD(context, null, 0, -1);
    expect(nl.length).toBe(1);
    // Note should be offset by startTime (8.0)
    expect(nl.getNote(0).getStartTime()).toBeCloseTo(8.0, 4);
  });

  it('testRepeatClassicTimeBehavior', () => {
    const context = new TimeContext();
    const obj = new PatternObject();
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(8.0));
    obj.setRepeatPoint(TimeDuration.beats(4.0));
    obj.setTimeBehavior(TimeBehavior.REPEAT_CLASSIC);
    obj.setBeats(4);
    obj.setSubDivisions(4);

    // Single note at step 0
    const pat = new Pattern(16);
    pat.patternScore = 'i3 0 1 0';
    pat.values[0] = true;
    obj.addPattern(pat);

    const nl = obj.generateForCSD(context, null, 0, -1);
    // 2 repeats: note at 0 and note at 4.0
    expect(nl.length).toBe(2);

    const starts: number[] = [];
    for (let i = 0; i < nl.length; i++) {
      starts.push(nl.getNote(i).getStartTime());
    }
    starts.sort((a, b) => a - b);
    expect(starts[0]).toBeCloseTo(0.0, 4);
    expect(starts[1]).toBeCloseTo(4.0, 4);
  });
});
