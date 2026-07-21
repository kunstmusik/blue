import { describe, expect, it } from 'vitest';
import {
  APP_ZOOM_DEFAULT_PERCENT,
  APP_ZOOM_MAX_PERCENT,
  APP_ZOOM_MIN_PERCENT,
  APP_ZOOM_STEP_PERCENT,
  isSupportedAppZoomPercent,
  normalizeAppZoomPercent,
  resolveAppZoomCommand,
  toAppZoomFactor,
  type AppZoomCommand,
} from './app-zoom';

describe('app-zoom constants', () => {
  it('exposes the documented default, min, max, and step', () => {
    expect(APP_ZOOM_DEFAULT_PERCENT).toBe(100);
    expect(APP_ZOOM_MIN_PERCENT).toBe(50);
    expect(APP_ZOOM_MAX_PERCENT).toBe(300);
    expect(APP_ZOOM_STEP_PERCENT).toBe(10);
  });
});

describe('app-zoom legal values', () => {
  const legal: number[] = [];
  for (let v = APP_ZOOM_MIN_PERCENT; v <= APP_ZOOM_MAX_PERCENT; v += APP_ZOOM_STEP_PERCENT) {
    legal.push(v);
  }

  it('exposes exactly 26 legal integer multiples of 10 from 50 to 300 inclusive', () => {
    expect(legal).toHaveLength(26);
    expect(legal[0]).toBe(50);
    expect(legal[legal.length - 1]).toBe(300);
    for (const value of legal) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value % APP_ZOOM_STEP_PERCENT).toBe(0);
    }
  });

  it('isSupportedAppZoomPercent accepts every legal value', () => {
    for (const value of legal) {
      expect(isSupportedAppZoomPercent(value)).toBe(true);
    }
  });

  it('isSupportedAppZoomPercent rejects out-of-range multiples of 10', () => {
    expect(isSupportedAppZoomPercent(40)).toBe(false);
    expect(isSupportedAppZoomPercent(49)).toBe(false);
    expect(isSupportedAppZoomPercent(310)).toBe(false);
    expect(isSupportedAppZoomPercent(301)).toBe(false);
  });

  it('isSupportedAppZoomPercent rejects off-step values inside the range', () => {
    expect(isSupportedAppZoomPercent(55)).toBe(false);
    expect(isSupportedAppZoomPercent(101)).toBe(false);
    expect(isSupportedAppZoomPercent(299)).toBe(false);
    expect(isSupportedAppZoomPercent(105)).toBe(false);
  });

  it('isSupportedAppZoomPercent rejects malformed input classes', () => {
    expect(isSupportedAppZoomPercent(undefined)).toBe(false);
    expect(isSupportedAppZoomPercent(null)).toBe(false);
    expect(isSupportedAppZoomPercent(true)).toBe(false);
    expect(isSupportedAppZoomPercent('100')).toBe(false);
    expect(isSupportedAppZoomPercent(Number.NaN)).toBe(false);
    expect(isSupportedAppZoomPercent(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isSupportedAppZoomPercent(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isSupportedAppZoomPercent(100.5)).toBe(false);
    expect(isSupportedAppZoomPercent({})).toBe(false);
    expect(isSupportedAppZoomPercent([100])).toBe(false);
  });
});

describe('normalizeAppZoomPercent', () => {
  it('returns supported values untouched', () => {
    expect(normalizeAppZoomPercent(50)).toBe(50);
    expect(normalizeAppZoomPercent(100)).toBe(100);
    expect(normalizeAppZoomPercent(300)).toBe(300);
    expect(normalizeAppZoomPercent(170)).toBe(170);
  });

  it('falls back to the default for any unsupported input', () => {
    expect(normalizeAppZoomPercent(undefined)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(null)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent('100')).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(Number.NaN)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(Number.POSITIVE_INFINITY)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(40)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(310)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(105)).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(normalizeAppZoomPercent(100.5)).toBe(APP_ZOOM_DEFAULT_PERCENT);
  });
});

describe('resolveAppZoomCommand', () => {
  it('adds exactly one step on zoom-in and clamps at the upper bound', () => {
    expect(resolveAppZoomCommand(100, 'zoom-in')).toBe(110);
    expect(resolveAppZoomCommand(110, 'zoom-in')).toBe(120);
    expect(resolveAppZoomCommand(290, 'zoom-in')).toBe(300);
    expect(resolveAppZoomCommand(300, 'zoom-in')).toBe(300);
  });

  it('subtracts exactly one step on zoom-out and clamps at the lower bound', () => {
    expect(resolveAppZoomCommand(100, 'zoom-out')).toBe(90);
    expect(resolveAppZoomCommand(90, 'zoom-out')).toBe(80);
    expect(resolveAppZoomCommand(60, 'zoom-out')).toBe(50);
    expect(resolveAppZoomCommand(50, 'zoom-out')).toBe(50);
  });

  it('resolves actual-size to the default regardless of current value', () => {
    expect(resolveAppZoomCommand(50, 'actual-size')).toBe(100);
    expect(resolveAppZoomCommand(170, 'actual-size')).toBe(100);
    expect(resolveAppZoomCommand(300, 'actual-size')).toBe(100);
    expect(resolveAppZoomCommand(100, 'actual-size')).toBe(100);
  });

  it('always returns a supported value for any valid current input', () => {
    const commands: AppZoomCommand[] = ['zoom-in', 'zoom-out', 'actual-size'];
    for (let v = APP_ZOOM_MIN_PERCENT; v <= APP_ZOOM_MAX_PERCENT; v += APP_ZOOM_STEP_PERCENT) {
      for (const command of commands) {
        const result = resolveAppZoomCommand(v, command);
        expect(result).toBeGreaterThanOrEqual(APP_ZOOM_MIN_PERCENT);
        expect(result).toBeLessThanOrEqual(APP_ZOOM_MAX_PERCENT);
        expect(result % APP_ZOOM_STEP_PERCENT).toBe(0);
      }
    }
  });
});

describe('toAppZoomFactor', () => {
  it('converts percent to factor as percent / 100', () => {
    expect(toAppZoomFactor(50)).toBeCloseTo(0.5, 10);
    expect(toAppZoomFactor(100)).toBeCloseTo(1.0, 10);
    expect(toAppZoomFactor(130)).toBeCloseTo(1.3, 10);
    expect(toAppZoomFactor(300)).toBeCloseTo(3.0, 10);
  });

  it('does not read window state and is pure arithmetic', () => {
    expect(toAppZoomFactor(170)).toBeCloseTo(1.7, 10);
    expect(toAppZoomFactor(170)).toBeCloseTo(1.7, 10);
  });
});
