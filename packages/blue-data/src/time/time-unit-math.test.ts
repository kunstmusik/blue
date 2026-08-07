import { describe, expect, it } from 'vitest';
import { TimeBase } from './time-base';
import { TimeContext } from './time-context';
import { beatsToDuration } from './time-unit-math';
import { beatsToTimePosition } from './time-utilities';

describe('TimeUnitMath conversions', () => {
  it('uses a zero-based sixteenth for duration semantics', () => {
    const context = new TimeContext();

    const result = beatsToDuration(2.5, TimeBase.BBST, context);

    expect(result.getBars()).toBe(0);
    expect(result.getBeats()).toBe(2);
    expect(result.getSixteenth()).toBe(2);
    expect(result.getTicks()).toBe(0);
  });

  it('keeps the BBST duration shape after a bar boundary', () => {
    const context = new TimeContext();

    const result = beatsToDuration(4.5, TimeBase.BBST, context);

    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(0);
    expect(result.getSixteenth()).toBe(2);
    expect(result.getTicks()).toBe(0);
  });

  it('stores display-only SMPTE values as TIME', () => {
    const context = new TimeContext();
    context.getTempoMap().setTempo(120);
    context.getTempoMap().setEnabled(true);

    const duration = beatsToDuration(4, TimeBase.SMPTE, context);
    const position = beatsToTimePosition(4, TimeBase.SMPTE, context);

    expect(duration.getTimeBase()).toBe(TimeBase.TIME);
    expect(duration.toSeconds(context)).toBe(2);
    expect(position.getTimeBase()).toBe(TimeBase.TIME);
    expect(position.toSeconds(context)).toBe(2);
  });
});
