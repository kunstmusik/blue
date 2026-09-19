import { describe, expect, it } from 'vitest';
import {
  clampDualPan,
  clampPan,
  clampPanLawDb,
  clampPanWidth,
  clampStereoPanMode,
  calculateStereoPanEffectiveSpread,
  DEFAULT_DUAL_PAN_LEFT,
  DEFAULT_DUAL_PAN_RIGHT,
  DEFAULT_PAN,
  DEFAULT_PAN_LAW_DB,
  DEFAULT_PAN_WIDTH,
  DEFAULT_STEREO_PAN_MODE,
  EQUAL_POWER_CENTER_GAIN,
  getDualPanGains,
  getMonoPanGains,
  getSourceLegGains,
  getStereoBalanceGains,
  getStereoPanGains,
  isValidDualPan,
  isValidPan,
  isValidPanLawDb,
  isValidPanWidth,
  isValidStereoPanMode,
  MAX_PAN,
  MIN_PAN,
  numberToStereoPanMode,
  PAN_LAW_VALUES,
  stereoPanModeToNumber,
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

describe('pan law validations and conversions (T004, T008)', () => {
  it('validates panLawDb', () => {
    expect(isValidPanLawDb(0)).toBe(true);
    expect(isValidPanLawDb(-3)).toBe(true);
    expect(isValidPanLawDb(-4.5)).toBe(true);
    expect(isValidPanLawDb(-6)).toBe(true);

    expect(isValidPanLawDb(-1)).toBe(false);
    expect(isValidPanLawDb(-5)).toBe(false);
    expect(isValidPanLawDb(3)).toBe(false);
    expect(isValidPanLawDb(NaN)).toBe(false);
    expect(isValidPanLawDb(Infinity)).toBe(false);
    expect(isValidPanLawDb('-3')).toBe(false);
    expect(isValidPanLawDb(null)).toBe(false);
    expect(isValidPanLawDb(undefined)).toBe(false);

    expect(clampPanLawDb(-4.5)).toBe(-4.5);
    expect(clampPanLawDb(999)).toBe(DEFAULT_PAN_LAW_DB);
  });

  it('validates stereoPanMode and conversions', () => {
    expect(isValidStereoPanMode('balance')).toBe(true);
    expect(isValidStereoPanMode('stereoPan')).toBe(true);
    expect(isValidStereoPanMode('dualPan')).toBe(true);

    expect(isValidStereoPanMode('surround')).toBe(false);
    expect(isValidStereoPanMode('')).toBe(false);
    expect(isValidStereoPanMode(0)).toBe(false);
    expect(isValidStereoPanMode(null)).toBe(false);

    expect(clampStereoPanMode('stereoPan')).toBe('stereoPan');
    expect(clampStereoPanMode('unknown')).toBe(DEFAULT_STEREO_PAN_MODE);

    expect(stereoPanModeToNumber('balance')).toBe(0);
    expect(stereoPanModeToNumber('stereoPan')).toBe(1);
    expect(stereoPanModeToNumber('dualPan')).toBe(2);

    expect(numberToStereoPanMode(0)).toBe('balance');
    expect(numberToStereoPanMode(1)).toBe('stereoPan');
    expect(numberToStereoPanMode(2)).toBe('dualPan');
    expect(numberToStereoPanMode(99)).toBe('balance');
  });

  it('validates panWidth and clampPanWidth', () => {
    expect(isValidPanWidth(0)).toBe(true);
    expect(isValidPanWidth(0.5)).toBe(true);
    expect(isValidPanWidth(1)).toBe(true);
    expect(isValidPanWidth(-0.01)).toBe(false);
    expect(isValidPanWidth(1.01)).toBe(false);
    expect(isValidPanWidth(NaN)).toBe(false);
    expect(isValidPanWidth(Infinity)).toBe(false);

    expect(clampPanWidth(0.75)).toBe(0.75);
    expect(clampPanWidth(-0.5)).toBe(0);
    expect(clampPanWidth(1.5)).toBe(1);
    expect(clampPanWidth(NaN)).toBe(DEFAULT_PAN_WIDTH);
  });

  it('validates dualPan and clampDualPan', () => {
    expect(isValidDualPan(0)).toBe(true);
    expect(isValidDualPan(1)).toBe(true);
    expect(isValidDualPan(-0.1)).toBe(false);
    expect(isValidDualPan(1.1)).toBe(false);
    expect(isValidDualPan(NaN)).toBe(false);

    expect(clampDualPan(0.3, 0)).toBe(0.3);
    expect(clampDualPan(-1, 0)).toBe(0);
    expect(clampDualPan(2, 1)).toBe(1);
    expect(clampDualPan(NaN, 0.4)).toBe(0.4);
  });
});

describe('pan law gain functions (T009, T014)', () => {
  it('calibrates center gains correctly across all 4 laws with boost off', () => {
    // 0 dB: center gain is 1.0 (0 dB attenuation)
    const [c0L, c0R] = getSourceLegGains(0.5, 0, false);
    expect(c0L).toBeCloseTo(1.0, 6);
    expect(c0R).toBeCloseTo(1.0, 6);

    // -3 dB: center gain is 1/sqrt(2) ≈ 0.707107 (-3.01 dB)
    const [c3L, c3R] = getSourceLegGains(0.5, -3, false);
    expect(c3L).toBeCloseTo(1 / Math.SQRT2, 6);
    expect(c3R).toBeCloseTo(1 / Math.SQRT2, 6);

    // -4.5 dB: center gain is 10^(-4.5/20) ≈ 0.595662
    const expected45 = Math.pow(10, -4.5 / 20);
    const [c45L, c45R] = getSourceLegGains(0.5, -4.5, false);
    expect(c45L).toBeCloseTo(expected45, 6);
    expect(c45R).toBeCloseTo(expected45, 6);

    // -6 dB: center gain is 0.5 (-6.02 dB)
    const [c6L, c6R] = getSourceLegGains(0.5, -6, false);
    expect(c6L).toBeCloseTo(0.5, 6);
    expect(c6R).toBeCloseTo(0.5, 6);
  });

  it('calibrates endpoint gains with boost off', () => {
    for (const law of PAN_LAW_VALUES) {
      // Hard Left (p = 0): left=1.0, right=0.0
      const [leftL, leftR] = getSourceLegGains(0, law, false);
      expect(leftL).toBeCloseTo(1.0, 6);
      expect(leftR).toBeCloseTo(0.0, 6);

      // Hard Right (p = 1): left=0.0, right=1.0
      const [rightL, rightR] = getSourceLegGains(1, law, false);
      expect(rightL).toBeCloseTo(0.0, 6);
      expect(rightR).toBeCloseTo(1.0, 6);
    }
  });

  it('maintains exact symmetry across all laws and boost settings', () => {
    for (const law of PAN_LAW_VALUES) {
      for (const boost of [false, true]) {
        for (const p of [0.1, 0.25, 0.35, 0.7, 0.85]) {
          const [leftL, leftR] = getSourceLegGains(p, law, boost);
          const [mirroredL, mirroredR] = getSourceLegGains(1 - p, law, boost);
          expect(leftL).toBeCloseTo(mirroredR, 6);
          expect(leftR).toBeCloseTo(mirroredL, 6);
        }
      }
    }
  });

  it('maintains monotonic continuity as pan sweeps from left to right', () => {
    for (const law of PAN_LAW_VALUES) {
      for (const boost of [false, true]) {
        let prevLeft = 2.0;
        let prevRight = -1.0;
        for (let i = 0; i <= 20; i++) {
          const p = i / 20;
          const [l, r] = getSourceLegGains(p, law, boost);
          expect(Number.isFinite(l)).toBe(true);
          expect(Number.isFinite(r)).toBe(true);
          expect(l).toBeLessThanOrEqual(prevLeft + 1e-9);
          expect(r).toBeGreaterThanOrEqual(prevRight - 1e-9);
          prevLeft = l;
          prevRight = r;
        }
      }
    }
  });

  it('applies off-center boost correctly', () => {
    // At center (p=0.5), boost has no effect for all laws
    for (const law of PAN_LAW_VALUES) {
      const [unboostedL, unboostedR] = getSourceLegGains(0.5, law, false);
      const [boostedL, boostedR] = getSourceLegGains(0.5, law, true);
      expect(boostedL).toBeCloseTo(unboostedL, 6);
      expect(boostedR).toBeCloseTo(unboostedR, 6);
    }

    // For 0 dB law, boost is a no-op everywhere
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const [unboostedL, unboostedR] = getSourceLegGains(p, 0, false);
      const [boostedL, boostedR] = getSourceLegGains(p, 0, true);
      expect(boostedL).toBeCloseTo(unboostedL, 6);
      expect(boostedR).toBeCloseTo(unboostedR, 6);
    }

    // At hard endpoints, boost factor is 10^(|lawDb|/20)
    // -3 dB endpoint: 10^(3/20) ≈ 1.412538
    const boostFactor3 = Math.pow(10, 3 / 20);
    const [b3L, b3R] = getSourceLegGains(0, -3, true);
    expect(b3L).toBeCloseTo(boostFactor3, 6);
    expect(b3R).toBeCloseTo(0.0, 6);

    // -4.5 dB endpoint: 10^(4.5/20) ≈ 1.678804
    const boostFactor45 = Math.pow(10, 4.5 / 20);
    const [b45L, b45R] = getSourceLegGains(0, -4.5, true);
    expect(b45L).toBeCloseTo(boostFactor45, 6);
    expect(b45R).toBeCloseTo(0.0, 6);

    // -6 dB endpoint: 10^(6/20) ≈ 1.995262
    const boostFactor6 = Math.pow(10, 6 / 20);
    const [b6L, b6R] = getSourceLegGains(0, -6, true);
    expect(b6L).toBeCloseTo(boostFactor6, 6);
    expect(b6R).toBeCloseTo(0.0, 6);
  });

  it('retains exact Spec 112 parity for default -3 dB unboosted Mono Pan', () => {
    for (let i = 0; i <= 10; i++) {
      const p = i / 10;
      const [actualL, actualR] = getMonoPanGains(p, -3, false);
      const expectedL = Math.SQRT2 * Math.cos((Math.PI * p) / 2);
      const expectedR = Math.SQRT2 * Math.sin((Math.PI * p) / 2);
      expect(actualL).toBe(expectedL);
      expect(actualR).toBe(expectedR);
    }
  });
});

describe('stereo pan and dual pan matrices (T020, T024)', () => {
  it('stereo pan center with width 1 is identity (boost off)', () => {
    for (const law of PAN_LAW_VALUES) {
      // (c=0.5, w=1): d = 1 * min(0.5, 0.5) = 0.5
      // pL = 0.5 - 0.5 = 0 -> left pan hard left (aL=1, bL=0)
      // pR = 0.5 + 0.5 = 1 -> right pan hard right (aR=0, bR=1)
      const [aL, bL, aR, bR] = getStereoPanGains(0.5, 1.0, law, false);
      expect(aL).toBeCloseTo(1.0, 6);
      expect(bL).toBeCloseTo(0.0, 6);
      expect(aR).toBeCloseTo(0.0, 6);
      expect(bR).toBeCloseTo(1.0, 6);
    }
  });

  it('stereo pan zero width collapses both channels to position c', () => {
    for (const law of PAN_LAW_VALUES) {
      const [aL, bL, aR, bR] = getStereoPanGains(0.5, 0.0, law, false);
      // Both legs at c=0.5:
      const [cLegL, cLegR] = getSourceLegGains(0.5, law, false);
      expect(aL).toBeCloseTo(cLegL, 6);
      expect(bL).toBeCloseTo(cLegR, 6);
      expect(aR).toBeCloseTo(cLegL, 6);
      expect(bR).toBeCloseTo(cLegR, 6);
    }
  });

  it('stereo pan narrows effective spread near endpoints without changing saved width', () => {
    // c=0, w=1: effective spread d = 1 * min(0, 1) = 0. pL = pR = 0 (both hard left).
    const [aL, bL, aR, bR] = getStereoPanGains(0.0, 1.0, -3, false);
    expect(aL).toBeCloseTo(1.0, 6);
    expect(bL).toBeCloseTo(0.0, 6);
    expect(aR).toBeCloseTo(1.0, 6);
    expect(bR).toBeCloseTo(0.0, 6);
  });

  it('dual pan defaults are identity (boost off)', () => {
    for (const law of PAN_LAW_VALUES) {
      const [aL, bL, aR, bR] = getDualPanGains(
        DEFAULT_DUAL_PAN_LEFT,
        DEFAULT_DUAL_PAN_RIGHT,
        law,
        false,
      );
      expect(aL).toBeCloseTo(1.0, 6);
      expect(bL).toBeCloseTo(0.0, 6);
      expect(aR).toBeCloseTo(0.0, 6);
      expect(bR).toBeCloseTo(1.0, 6);
    }
  });

  it('dual pan crossed inverts stereo channels', () => {
    // left panned hard right (1), right panned hard left (0)
    const [aL, bL, aR, bR] = getDualPanGains(1.0, 0.0, -3, false);
    expect(aL).toBeCloseTo(0.0, 6);
    expect(bL).toBeCloseTo(1.0, 6);
    expect(aR).toBeCloseTo(1.0, 6);
    expect(bR).toBeCloseTo(0.0, 6);
  });

  it('covers every true-stereo law, boost state, position, and matrix mode', () => {
    const positions = [0, 0.25, 0.5, 0.75, 1];

    for (const law of PAN_LAW_VALUES) {
      for (const boost of [false, true]) {
        for (const position of positions) {
          const width = position === 0.5 ? 1 : 0.8;
          const stereo = getStereoPanGains(position, width, law, boost);
          const spread = calculateStereoPanEffectiveSpread(position, width);
          const [leftLeg, rightLeg] = getSourceLegGains(position - spread, law, boost);
          const [rightSourceLeft, rightSourceRight] = getSourceLegGains(
            position + spread,
            law,
            boost,
          );

          expect(stereo).toEqual([
            expect.closeTo(leftLeg, 10),
            expect.closeTo(rightLeg, 10),
            expect.closeTo(rightSourceLeft, 10),
            expect.closeTo(rightSourceRight, 10),
          ]);
          expect(stereo.every(Number.isFinite)).toBe(true);

          const dual = getDualPanGains(position, 1 - position, law, boost);
          const [dualLeftL, dualLeftR] = getSourceLegGains(position, law, boost);
          const [dualRightL, dualRightR] = getSourceLegGains(1 - position, law, boost);
          expect(dual).toEqual([
            expect.closeTo(dualLeftL, 10),
            expect.closeTo(dualLeftR, 10),
            expect.closeTo(dualRightL, 10),
            expect.closeTo(dualRightR, 10),
          ]);
          expect(dual.every(Number.isFinite)).toBe(true);
        }
      }
    }
  });
});
