import { describe, it, expect } from 'vite-plus/test';
import { TimeBase, isBeatBased } from '../../src/time/time-base';

describe('TimeBase', () => {
  it('should identify beat-based time bases', () => {
    expect(isBeatBased(TimeBase.BEATS)).toBe(true);
    expect(isBeatBased(TimeBase.BBT)).toBe(true);
    expect(isBeatBased(TimeBase.BBST)).toBe(true);
    expect(isBeatBased(TimeBase.BBF)).toBe(true);
  });

  it('should identify non-beat-based time bases', () => {
    expect(isBeatBased(TimeBase.TIME)).toBe(false);
    expect(isBeatBased(TimeBase.SECONDS)).toBe(false);
    expect(isBeatBased(TimeBase.SMPTE)).toBe(false);
    expect(isBeatBased(TimeBase.FRAME)).toBe(false);
  });

  it('should keep UI ordering for clock-based time bases', () => {
    const values = Object.values(TimeBase);
    const idx = (t: string) => values.indexOf(t);

    expect(idx(TimeBase.TIME)).toBeLessThan(idx(TimeBase.SMPTE));
    expect(idx(TimeBase.SMPTE)).toBeLessThan(idx(TimeBase.SECONDS));
  });
});
