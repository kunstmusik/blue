import { describe, it, expect } from 'vite-plus/test';
import { PatternLayer } from '../../src/score/patterns/pattern-layer';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimeContext } from '../../src/time/time-context';

describe('PatternLayer', () => {
  it('testGenerateForCSD', () => {
    const context = new TimeContext();
    const instance = new PatternLayer();

    const score = new GenericScore();
    score.setTimeBehavior(TimeBehavior.NONE);
    score.setScoreText('i1 0 .25 1 2\ni1 1 .25 1 2');
    instance.setSoundObject(score);

    instance.getPatternData().setPattern(0, true);
    instance.getPatternData().setPattern(1, true);
    instance.getPatternData().setPattern(2, true);

    const result = instance.generateForCSD(context, null, 0.0, 0.0, 4);

    // 3 active patterns × 2 notes per pattern = 6 notes
    expect(result.length).toBe(6);

    // Check specific start times
    // Pattern 0: notes at 0, 1 | Pattern 1: notes at 4, 5 | Pattern 2: notes at 8, 9
    const starts: number[] = [];
    for (let i = 0; i < result.length; i++) {
      starts.push(result.getNote(i).getStartTime());
    }
    starts.sort((a, b) => a - b);
    expect(starts[0]).toBeCloseTo(0, 2);
    expect(starts[1]).toBeCloseTo(1, 2);
    expect(starts[2]).toBeCloseTo(4, 2);
    expect(starts[3]).toBeCloseTo(5, 2);
    expect(starts[4]).toBeCloseTo(8, 2);
    expect(starts[5]).toBeCloseTo(9, 2);
  });

  it('testGenerateForCSDWithStartTimeOffset', () => {
    const context = new TimeContext();
    const instance = new PatternLayer();

    const score = new GenericScore();
    score.setTimeBehavior(TimeBehavior.NONE);
    score.setScoreText('i1 0 .25 1 2\ni1 1 .25 1 2');
    instance.setSoundObject(score);

    instance.getPatternData().setPattern(0, true);
    instance.getPatternData().setPattern(1, true);
    instance.getPatternData().setPattern(2, true);

    // startTime = 4.0, so pattern index starts at floor(4/4) = 1
    const result = instance.generateForCSD(context, null, 4.0, 0.0, 4);

    // Patterns 1 and 2 are active → 2 × 2 = 4 notes
    expect(result.length).toBe(4);
  });
});
