import { describe, expect, it } from 'vitest';
import {
  clampPan,
  DEFAULT_PAN,
  EQUAL_POWER_CENTER_GAIN,
  getMonoPanGains,
  getStereoBalanceGains,
  isValidPan,
  MAX_PAN,
  MIN_PAN,
} from './channel-pan';

describe('channel-pan math and validation (T006)', () => {
  it('validates pan in range [0, 1] with finite numbers', () => {
    expect(isValidPan(0)).toBe(true);
    expect(isValidPan(0.5)).toBe(true);
    expect(isValidPan(1)).toBe(true);
    expect(isValidPan(0.25)).toBe(true);

    expect(isValidPan(-0.01)).toBe(false);
    expect(isValidPan(1.01)).toBe(false);
    expect(isValidPan(NaN)).toBe(false);
    expect(isValidPan(Infinity)).toBe(false);
    expect(isValidPan(-Infinity)).toBe(false);
    expect(isValidPan('0.5')).toBe(false);
    expect(isValidPan(null)).toBe(false);
    expect(isValidPan(undefined)).toBe(false);
  });

  it('clamps pan to [0, 1] with fallback for non-finite values', () => {
    expect(clampPan(0.5)).toBe(0.5);
    expect(clampPan(-1)).toBe(MIN_PAN);
    expect(clampPan(2)).toBe(MAX_PAN);
    expect(clampPan(NaN)).toBe(DEFAULT_PAN);
    expect(clampPan(undefined, 0.25)).toBe(0.25);
  });

  it('calculates equal-power mono pan gains correctly', () => {
    // Center (p = 0.5):
    // Multipliers against upmix (x / sqrt(2)):
    // left multiplier = sqrt(2) * cos(pi/4) = 1.0
    // right multiplier = sqrt(2) * sin(pi/4) = 1.0
    // Total effective contribution from x is x / sqrt(2) per side
    const [centerL, centerR] = getMonoPanGains(0.5);
    expect(centerL).toBeCloseTo(1.0, 6);
    expect(centerR).toBeCloseTo(1.0, 6);
    // Effective level from unit source x=1:
    expect((1.0 / Math.SQRT2) * centerL).toBeCloseTo(EQUAL_POWER_CENTER_GAIN, 6);
    expect((1.0 / Math.SQRT2) * centerR).toBeCloseTo(EQUAL_POWER_CENTER_GAIN, 6);

    // Hard Left (p = 0):
    // left multiplier = sqrt(2) * cos(0) = sqrt(2)
    // right multiplier = sqrt(2) * sin(0) = 0
    // Effective level: (1 / sqrt(2)) * sqrt(2) = 1.0 (unity at endpoint)
    const [leftL, leftR] = getMonoPanGains(0);
    expect(leftL).toBeCloseTo(Math.SQRT2, 6);
    expect(leftR).toBeCloseTo(0.0, 6);
    expect((1.0 / Math.SQRT2) * leftL).toBeCloseTo(1.0, 6);
    expect((1.0 / Math.SQRT2) * leftR).toBeCloseTo(0.0, 6);

    // Hard Right (p = 1):
    // left multiplier = 0
    // right multiplier = sqrt(2)
    const [rightL, rightR] = getMonoPanGains(1);
    expect(rightL).toBeCloseTo(0.0, 6);
    expect(rightR).toBeCloseTo(Math.SQRT2, 6);
    expect((1.0 / Math.SQRT2) * rightL).toBeCloseTo(0.0, 6);
    expect((1.0 / Math.SQRT2) * rightR).toBeCloseTo(1.0, 6);
  });

  it('calculates stereo balance gains correctly', () => {
    // Center (p = 0.5): both unity
    const [centerL, centerR] = getStereoBalanceGains(0.5);
    expect(centerL).toBe(1.0);
    expect(centerR).toBe(1.0);

    // Hard Left (p = 0): left unity, right muted
    const [leftL, leftR] = getStereoBalanceGains(0);
    expect(leftL).toBe(1.0);
    expect(leftR).toBe(0.0);

    // Hard Right (p = 1): left muted, right unity
    const [rightL, rightR] = getStereoBalanceGains(1);
    expect(rightL).toBe(0.0);
    expect(rightR).toBe(1.0);

    // Halfway Left (p = 0.25):
    // left = min(1, 2 * 0.75) = 1.0
    // right = min(1, 2 * 0.25) = 0.5
    const [halfL, halfR] = getStereoBalanceGains(0.25);
    expect(halfL).toBe(1.0);
    expect(halfR).toBe(0.5);

    // Halfway Right (p = 0.75):
    // left = min(1, 2 * 0.25) = 0.5
    // right = min(1, 2 * 0.75) = 1.0
    const [halfRightL, halfRightR] = getStereoBalanceGains(0.75);
    expect(halfRightL).toBe(0.5);
    expect(halfRightR).toBe(1.0);
  });
});
