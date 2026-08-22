import { describe, expect, it } from 'vitest';
import { computeFloatingPosition } from '../components/floating-position-utils';

describe('computeFloatingPosition', () => {
  it('places a popup below its anchor when there is room', () => {
    expect(computeFloatingPosition(
      { left: 100, right: 300, top: 100, bottom: 140 },
      { width: 240, height: 180 },
      { width: 800, height: 800 },
      { gap: 4, margin: 8, align: 'start' },
    )).toEqual({ left: 100, top: 144, placement: 'bottom' });
  });

  it('flips a popup above its anchor when the lower viewport is too small', () => {
    expect(computeFloatingPosition(
      { left: 100, right: 300, top: 700, bottom: 740 },
      { width: 240, height: 180 },
      { width: 800, height: 800 },
      { gap: 4, margin: 8, align: 'start' },
    )).toEqual({ left: 100, top: 516, placement: 'top' });
  });

  it('clamps a popup horizontally inside the viewport', () => {
    expect(computeFloatingPosition(
      { left: 780, right: 800, top: 100, bottom: 120 },
      { width: 240, height: 120 },
      { width: 800, height: 800 },
      { gap: 8, margin: 8, align: 'start' },
    ).left).toBe(552);
  });

  it('honors a smaller scroll viewport such as a settings panel above a footer', () => {
    expect(computeFloatingPosition(
      { left: 100, right: 300, top: 600, bottom: 640 },
      { width: 240, height: 160 },
      { width: 800, height: 800, left: 0, right: 800, top: 0, bottom: 660 },
      { gap: 4, margin: 8, align: 'start' },
    )).toEqual({ left: 100, top: 436, placement: 'top' });
  });
});
