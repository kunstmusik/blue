import { describe, it, expect } from 'vite-plus/test';
import { Meter } from '../../src/time/meter';

describe('Meter', () => {
  it('testGetMeasureBeatDuration', () => {
    expect(new Meter(4, 4).getMeasureBeatDuration()).toBeCloseTo(4.0);
    expect(new Meter(4, 16).getMeasureBeatDuration()).toBeCloseTo(1.0);
    expect(new Meter(2, 2).getMeasureBeatDuration()).toBeCloseTo(4.0);
    expect(new Meter(4, 1).getMeasureBeatDuration()).toBeCloseTo(16.0);
    expect(new Meter(7, 8).getMeasureBeatDuration()).toBeCloseTo(3.5);
  });

  it('testEquals', () => {
    const m1 = new Meter(4, 4);
    const m2 = new Meter(4, 4);
    const m3 = new Meter(3, 4);
    const m4 = new Meter(4, 8);

    // reflexive
    expect(m1.equals(m1)).toBe(true);

    // symmetric — same values
    expect(m1.equals(m2)).toBe(true);
    expect(m2.equals(m1)).toBe(true);

    // different numBeats
    expect(m1.equals(m3)).toBe(false);

    // different beatLength
    expect(m1.equals(m4)).toBe(false);

    // null — accessing .numBeats on null throws, so wrap in try/catch
    expect(() => m1.equals(null as any)).toThrow();

    // different type — accessing .numBeats on string is undefined, not equal
    expect(m1.equals('4/4' as any)).toBe(false);
  });

  it('testHashCode', () => {
    const m1 = new Meter(4, 4);
    const m2 = new Meter(4, 4);
    const m3 = new Meter(3, 4);

    // equal objects have equal hashCodes
    expect(m1.hashCode()).toBe(m2.hashCode());

    // unequal objects usually have different hashCodes
    expect(m1.hashCode()).not.toBe(m3.hashCode());
  });

  it('testToString', () => {
    expect(new Meter(4, 4).toString()).toBe('4/4');
    expect(new Meter(3, 4).toString()).toBe('3/4');
    expect(new Meter(6, 8).toString()).toBe('6/8');
    expect(new Meter(7, 8).toString()).toBe('7/8');
    expect(new Meter(5, 4).toString()).toBe('5/4');
  });
});
