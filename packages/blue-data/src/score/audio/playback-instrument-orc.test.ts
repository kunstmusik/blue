import { describe, expect, it } from 'vitest';
import {
  PLAYBACK_INSTRUMENT_ORC,
  PLAYBACK_INSTRUMENT_ORC_PANNING,
  PLAYBACK_INSTRUMENT_ORC_MONO,
  getPlaybackInstrumentOrc,
} from './playback-instrument-orc';

describe('playback-instrument-orc (T013)', () => {
  it('returns legacy template when panningEnabled is false', () => {
    const template = getPlaybackInstrumentOrc(false, 2);
    expect(template).toBe(PLAYBACK_INSTRUMENT_ORC);
    // Legacy does not contain sqrt(2) upmixing
    expect(template).not.toContain('sqrt(2)');
    // Legacy routes mono only to {0}
    expect(template).toContain('{0} = a0');
    expect(template).not.toContain('{1} = a0');
  });

  it('returns panning template when panningEnabled is true and nchnls = 2', () => {
    const template = getPlaybackInstrumentOrc(true, 2);
    expect(template).toBe(PLAYBACK_INSTRUMENT_ORC_PANNING);
    // Panning contains equal power sqrt(2) mono upmixing to both {0} and {1}
    expect(template).toContain('a_upmix = a0 / sqrt(2)');
    // Contributions accumulate so overlapping clips on one track sum
    // (US1: no clip is silently omitted); BlueMixer clears the buses.
    expect(template).toContain('{0} = {0} + a_upmix');
    expect(template).toContain('{1} = {1} + a_upmix');
    // Stereo passes through L/R
    expect(template).toContain('{0} = {0} + a0');
    expect(template).toContain('{1} = {1} + a1');
  });

  it('returns mono template when panningEnabled is true and nchnls = 1', () => {
    const template = getPlaybackInstrumentOrc(true, 1);
    expect(template).toBe(PLAYBACK_INSTRUMENT_ORC_MONO);
    // Mono output has no {1}
    expect(template).not.toContain('{1}');
    expect(template).toContain('a_mono = (a0 + a1) * 0.5');
  });
});
