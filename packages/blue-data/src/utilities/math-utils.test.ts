import { describe, expect, it } from 'vitest';
import { clamp } from './math-utils';

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('clamps to min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-0.1, 0, 1)).toBe(0);
  });

  it('clamps to max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(1.5, 0, 1)).toBe(1);
  });

  it('handles boundary edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
