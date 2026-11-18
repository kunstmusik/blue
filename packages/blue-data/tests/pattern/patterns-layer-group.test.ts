import { describe, it, expect } from 'vite-plus/test';
import { PatternsLayerGroup } from '../../src/score/patterns/patterns-layer-group';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimeContext } from '../../src/time/time-context';

describe('PatternsLayerGroup', () => {
  it('testGenerateForCSD', () => {
    const context = new TimeContext();
    const instance = new PatternsLayerGroup();

    instance.newLayerAt(-1);
    const patternLayer = instance[0];

    const score = new GenericScore();
    score.setTimeBehavior(TimeBehavior.NONE);
    score.setScoreText('i1 0 .25 1 2\ni1 1 .25 1 2');
    patternLayer.setSoundObject(score);
    patternLayer.getPatternData().setPattern(0, true);
    patternLayer.getPatternData().setPattern(1, true);
    patternLayer.getPatternData().setPattern(2, true);

    // startTime = 4.0, endTime = 0.0 (no end constraint)
    const result = instance.generateForCSD(context, null, 4.0, 0.0, false);

    // With startTime=4.0, pattern index starts at floor(4/4) = 1
    // Patterns 1 and 2 are active → 2 × 2 = 4 notes
    expect(result.length).toBe(4);

    // Check start times: pattern 1 at beat 4, pattern 2 at beat 8
    // Notes within each pattern: 0 and 1 relative, so absolute: 4,5 and 8,9
    const starts: number[] = [];
    for (let i = 0; i < result.length; i++) {
      starts.push(result.getNote(i).getStartTime());
    }
    starts.sort((a, b) => a - b);
    expect(starts[0]).toBeCloseTo(4, 2);
    expect(starts[1]).toBeCloseTo(5, 2);
    expect(starts[2]).toBeCloseTo(8, 2);
    expect(starts[3]).toBeCloseTo(9, 2);
  });
});
