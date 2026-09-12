import { describe, expect, it } from 'vitest';
import {
  gainDbToFraction,
  fractionToGainDb,
  MIN_GAIN_DB,
  MAX_GAIN_DB,
  UNITY_GAIN_DB,
  UNITY_TRAVEL_FRACTION,
} from '../components/workbench/panels/mixer/fader-taper';

describe('fader-taper mathematical properties', () => {
  it('returns exact endpoints for boundary gains and fractions', () => {
    expect(gainDbToFraction(-96)).toBe(0);
    expect(gainDbToFraction(12)).toBe(1);
    expect(fractionToGainDb(0)).toBe(-96);
    expect(fractionToGainDb(1)).toBe(12);
  });

  it('clamps and provides safe fallbacks for out-of-range or non-finite inputs', () => {
    // gainDbToFraction clamping
    expect(gainDbToFraction(-150)).toBe(0);
    expect(gainDbToFraction(50)).toBe(1);
    expect(gainDbToFraction(NaN)).toBe(0);
    expect(gainDbToFraction(-Infinity)).toBe(0);
    expect(gainDbToFraction(Infinity)).toBe(0);

    // fractionToGainDb clamping and fallback
    expect(fractionToGainDb(-0.5)).toBe(-96);
    expect(fractionToGainDb(1.5)).toBe(12);
    expect(fractionToGainDb(NaN)).toBe(-96);
    expect(fractionToGainDb(-Infinity)).toBe(-96);
    expect(fractionToGainDb(Infinity)).toBe(-96);
  });

  it('matches all contract anchor points with tolerance 1e-6', () => {
    const anchors: Array<[number, number]> = [
      [-96, 0],
      [-60, 0.037037037],
      [-24, 0.2962962963],
      [-20, 0.3484733018],
      [-6, 0.5787037037],
      [0, 0.7023319616],
      [6, 0.8424211248],
      [12, 1],
    ];

    for (const [db, expectedFrac] of anchors) {
      const frac = gainDbToFraction(db);
      expect(frac).toBeCloseTo(expectedFrac, 6);

      const recoveredDb = fractionToGainDb(frac);
      expect(recoveredDb).toBeCloseTo(db, 6);
    }
  });

  it('allocates 49.3948% usable travel to the working band -20..+6 dB', () => {
    const fracMinus20 = gainDbToFraction(-20);
    const fracPlus6 = gainDbToFraction(6);
    const travel = fracPlus6 - fracMinus20;
    expect(travel).toBeCloseTo(0.4939478, 6);
    expect(travel * 100).toBeCloseTo(49.3948, 4);
  });

  it('places unity at approximately 0.702332', () => {
    expect(UNITY_TRAVEL_FRACTION).toBeCloseTo(0.70233196, 6);
    expect(gainDbToFraction(UNITY_GAIN_DB)).toBeCloseTo(0.70233196, 6);
  });

  it('is strictly monotonic over 0.01 dB samples from -96 to +12 dB (10,801 points)', () => {
    let prevFrac = -1;
    for (let i = 0; i <= 10800; i++) {
      const db = Number((-96 + i * 0.01).toFixed(2));
      const frac = gainDbToFraction(db);
      expect(frac).toBeGreaterThan(prevFrac);
      prevFrac = frac;
    }
  });

  it('has unrounded inverse error <= 1e-6 dB across 0.01 dB samples', () => {
    let maxError = 0;
    for (let i = 0; i <= 10800; i++) {
      const db = -96 + i * 0.01;
      const frac = gainDbToFraction(db);
      const recoveredDb = fractionToGainDb(frac);
      const error = Math.abs(recoveredDb - db);
      if (error > maxError) maxError = error;
    }
    expect(maxError).toBeLessThanOrEqual(1e-6);
  });

  it('demonstrates continuous sensitivity around unity with no derivative jump', () => {
    // Compare numerical derivatives slightly below and above unity
    const delta = 0.001;
    const slopeBelow = (gainDbToFraction(0) - gainDbToFraction(-delta)) / delta;
    const slopeAbove = (gainDbToFraction(delta) - gainDbToFraction(0)) / delta;

    // dp/dg at unity is continuous
    expect(Math.abs(slopeAbove - slopeBelow)).toBeLessThan(1e-4);

    // Inverse sensitivity dg/dp around unity is approx 45.56 dB per full travel
    const deltaP = 0.0001;
    const unityFrac = gainDbToFraction(0);
    const dbSlope =
      (fractionToGainDb(unityFrac + deltaP) - fractionToGainDb(unityFrac - deltaP)) / (2 * deltaP);
    expect(dbSlope).toBeCloseTo(45.5625, 1);
  });
});
