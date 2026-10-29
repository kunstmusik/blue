import { afterEach, describe, expect, it, vi } from 'vitest';
import { percentile, reportPerformance, sampleSynchronous } from '../test-support/performance';

afterEach(() => vi.restoreAllMocks());

describe('performance observations', () => {
  it('uses nearest rank consistently for 40- and 100-sample tails', () => {
    expect(
      percentile(
        Array.from({ length: 40 }, (_, index) => 40 - index),
        95,
      ),
    ).toBe(38);
    expect(
      percentile(
        Array.from({ length: 100 }, (_, index) => index + 1),
        95,
      ),
    ).toBe(95);
  });

  it('retains raw samples before a caller evaluates a budget', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const samples = [57, 10, 20];
    const result = reportPerformance('menu', samples);
    expect(result.max).toBe(57);
    expect(result.samples).toEqual([57, 10, 20]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"samples":[57,10,20]'));
    expect(() => reportPerformance('empty', [])).toThrow('Invalid performance samples');
    expect(() => reportPerformance('invalid', [NaN])).toThrow('Invalid performance samples');
  });

  it('runs fixed warmups and measured calls without retrying observations', () => {
    const operation = vi.fn();
    expect(sampleSynchronous(operation)).toHaveLength(40);
    expect(operation).toHaveBeenCalledTimes(45);
  });
});
