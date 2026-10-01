import { describe, it, expect } from 'vitest';
import type { TimeConversionContext } from '../time/time-unit-logic';
import {
  DEFAULT_PPQ,
  beatsToSeconds,
  secondsToBeats,
  beatsToBBTInternal,
  bbtToBeats,
  formatForBase,
  parseForBase,
  formatBeatsValue,
  formatBBT,
  formatBBST,
  formatBBF,
  formatTime,
  formatSeconds,
  formatSMPTE,
  totalSecondsToTime,
  measureStartBeats,
} from '../time/time-unit-logic';

const SIMPLE_4_4: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: true,
  initialTempo: 60,
  sampleRate: 44100,
};

const SIMPLE_4_4_NO_TEMPO: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: false,
  initialTempo: 60,
  sampleRate: 44100,
};

const BPM120: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: true,
  initialTempo: 120,
  sampleRate: 44100,
};

const SMPTE_29_97: TimeConversionContext = {
  ...SIMPLE_4_4,
  smpteFrameRate: 29.97,
};

const METER_CHANGE: TimeConversionContext = {
  meterEntries: [
    { measure: 1, numBeats: 4, beatLength: 4 },
    { measure: 3, numBeats: 3, beatLength: 4 },
  ],
  tempoEnabled: true,
  initialTempo: 60,
  sampleRate: 44100,
};

const FIVE_FOUR_AT_MEASURE_2: TimeConversionContext = {
  meterEntries: [
    { measure: 1, numBeats: 4, beatLength: 4 },
    { measure: 2, numBeats: 5, beatLength: 4 },
  ],
  tempoEnabled: true,
  initialTempo: 60,
  sampleRate: 44100,
};

const EPSILON = 1e-6;

describe('beatsToSeconds / secondsToBeats', () => {
  it('returns identity when tempo is disabled', () => {
    expect(beatsToSeconds(5, SIMPLE_4_4_NO_TEMPO)).toBe(5);
    expect(secondsToBeats(5, SIMPLE_4_4_NO_TEMPO)).toBe(5);
  });

  it('converts at 60 BPM (1 beat = 1 second)', () => {
    expect(beatsToSeconds(4, SIMPLE_4_4)).toBe(4);
    expect(secondsToBeats(4, SIMPLE_4_4)).toBe(4);
  });

  it('converts at 120 BPM (1 beat = 0.5 seconds)', () => {
    expect(beatsToSeconds(4, BPM120)).toBe(2);
    expect(secondsToBeats(2, BPM120)).toBe(4);
  });

  it('round-trips through seconds', () => {
    const beats = 3.75;
    expect(secondsToBeats(beatsToSeconds(beats, BPM120), BPM120)).toBeCloseTo(beats, 10);
  });

  it('uses later tempo points for clock-based fields and parses them back', () => {
    const context: TimeConversionContext = {
      ...SIMPLE_4_4,
      tempoPoints: [
        { beat: 0, tempo: 60, curveType: 'constant' },
        { beat: 4, tempo: 120, curveType: 'constant' },
      ],
    };
    expect(formatForBase(8, 'SECONDS', context, false)).toBe('6');
    expect(parseForBase('6', 'SECONDS', context, false)).toBe(8);
    expect(formatForBase(8, 'FRAME', context, false)).toBe(String(6 * context.sampleRate));
  });
});

describe('beatsToBBTInternal', () => {
  it('returns 1.1.0 for beat 0', () => {
    const r = beatsToBBTInternal(0, SIMPLE_4_4);
    expect(r).toEqual({ bar: 1, beat: 1, ticks: 0 });
  });

  it('returns 1.2.0 for beat 1', () => {
    const r = beatsToBBTInternal(1, SIMPLE_4_4);
    expect(r).toEqual({ bar: 1, beat: 2, ticks: 0 });
  });

  it('returns 2.1.0 for beat 4 (start of bar 2)', () => {
    const r = beatsToBBTInternal(4, SIMPLE_4_4);
    expect(r).toEqual({ bar: 2, beat: 1, ticks: 0 });
  });

  it('returns 1.1.480 for half a beat at PPQ 960', () => {
    const r = beatsToBBTInternal(0.5, SIMPLE_4_4);
    expect(r.bar).toBe(1);
    expect(r.beat).toBe(1);
    expect(r.ticks).toBe(480);
  });

  it('returns 1.1.1 for near-zero beats', () => {
    const r = beatsToBBTInternal(0, SIMPLE_4_4);
    expect(r).toEqual({ bar: 1, beat: 1, ticks: 0 });
  });

  it('handles meter change correctly', () => {
    const r = beatsToBBTInternal(8, METER_CHANGE);
    expect(r.bar).toBe(3);
    expect(r.beat).toBe(1);
    expect(r.ticks).toBe(0);
  });

  it('returns 1.1.0 for negative beats', () => {
    const r = beatsToBBTInternal(-1, SIMPLE_4_4);
    expect(r).toEqual({ bar: 1, beat: 1, ticks: 0 });
  });

  it('returns 1.1.0 for empty meter entries', () => {
    const empty: TimeConversionContext = {
      meterEntries: [],
      tempoEnabled: false,
      initialTempo: 60,
      sampleRate: 44100,
    };
    const r = beatsToBBTInternal(5, empty);
    expect(r).toEqual({ bar: 1, beat: 1, ticks: 0 });
  });
});

describe('bbtToBeats', () => {
  it('round-trips 1.1.0 to 0 beats', () => {
    expect(bbtToBeats(1, 1, 0, SIMPLE_4_4)).toBeCloseTo(0, EPSILON);
  });

  it('round-trips 2.1.0 to 4 beats', () => {
    expect(bbtToBeats(2, 1, 0, SIMPLE_4_4)).toBeCloseTo(4, EPSILON);
  });

  it('round-trips 1.2.0 to 1 beat', () => {
    expect(bbtToBeats(1, 2, 0, SIMPLE_4_4)).toBeCloseTo(1, EPSILON);
  });

  it('round-trips 1.1.480 to 0.5 beats', () => {
    expect(bbtToBeats(1, 1, 480, SIMPLE_4_4)).toBeCloseTo(0.5, EPSILON);
  });

  it('returns 0 for empty meter entries', () => {
    const empty: TimeConversionContext = {
      meterEntries: [],
      tempoEnabled: false,
      initialTempo: 60,
      sampleRate: 44100,
    };
    expect(bbtToBeats(1, 1, 0, empty)).toBe(0);
  });
});

describe('measureStartBeats', () => {
  it('computes starts for single 4/4 meter', () => {
    expect(measureStartBeats(SIMPLE_4_4)).toEqual([0]);
  });

  it('computes starts for meter change', () => {
    const starts = measureStartBeats(METER_CHANGE);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(8, EPSILON);
  });
});

describe('formatBeatsValue', () => {
  it('formats integer beats without trailing zeros', () => {
    expect(formatBeatsValue(4)).toBe('4');
  });

  it('formats fractional beats', () => {
    expect(formatBeatsValue(1.5)).toBe('1.5');
  });

  it('formats zero as "0"', () => {
    expect(formatBeatsValue(0)).toBe('0');
  });
});

describe('formatSMPTE', () => {
  it('formats 1.5 seconds at 30fps as 00:00:01:15', () => {
    expect(formatSMPTE(1.5, 30)).toBe('00:00:01:15');
  });

  it('formats 0 seconds as 00:00:00:00', () => {
    expect(formatSMPTE(0, 30)).toBe('00:00:00:00');
  });
});

describe('formatForBase', () => {
  it('formats BEATS as decimal', () => {
    expect(formatForBase(4, 'BEATS', SIMPLE_4_4, false)).toBe('4');
  });

  it('formats BBT position mode', () => {
    expect(formatForBase(4, 'BBT', SIMPLE_4_4, false)).toBe('2.1.0');
  });

  it('formats BBT duration mode (0-based)', () => {
    expect(formatForBase(4, 'BBT', SIMPLE_4_4, true)).toBe('1.0.0');
  });

  it('formats BBST position mode', () => {
    expect(formatForBase(0.5, 'BBST', SIMPLE_4_4, false)).toBe('1.1.3.0');
  });

  it('formats BBF position mode', () => {
    expect(formatForBase(0.5, 'BBF', SIMPLE_4_4, false)).toBe('1.1.50');
  });

  it('formats BBF position mode with a single-digit fraction using two digits', () => {
    expect(formatForBase(0.05, 'BBF', SIMPLE_4_4, false)).toBe('1.1.05');
  });

  it('formats BBF position mode relative to the current meter region start', () => {
    expect(formatForBase(16, 'BBF', FIVE_FOUR_AT_MEASURE_2, false)).toBe('4.3.00');
  });

  it('formats BBF duration mode with a single-digit fraction using two digits', () => {
    expect(formatForBase(0.05, 'BBF', SIMPLE_4_4, true)).toBe('0.0.05');
  });

  it('formats BBT duration mode for the user-reported BBF example', () => {
    expect(formatForBase(2.5, 'BBT', SIMPLE_4_4, true)).toBe('0.2.480');
  });

  it('formats BBST duration mode for the user-reported BBF example', () => {
    expect(formatForBase(2.5, 'BBST', SIMPLE_4_4, true)).toBe('0.2.2.0');
  });

  it('formats BBF duration mode for the user-reported BBF example', () => {
    expect(formatForBase(2.5, 'BBF', SIMPLE_4_4, true)).toBe('0.2.50');
  });

  it('formats TIME from beats at 60 BPM', () => {
    expect(formatForBase(90, 'TIME', SIMPLE_4_4, false)).toBe('0:01:30.000');
  });

  it('formats SECONDS from beats at 60 BPM', () => {
    expect(formatForBase(2, 'SECONDS', SIMPLE_4_4, false)).toBe('2');
  });

  it('formats SECONDS from beats at 120 BPM', () => {
    expect(formatForBase(2, 'SECONDS', BPM120, false)).toBe('1');
  });

  it('formats SMPTE from beats at 60 BPM', () => {
    expect(formatForBase(1.5, 'SMPTE', SIMPLE_4_4, false)).toBe('00:00:01:12');
  });

  it('formats elapsed seconds at fractional NDF rate', () => {
    expect(formatForBase(60, 'SMPTE', SMPTE_29_97, false)).toBe('00:00:59:28');
  });

  it('formats FRAME from beats at 60 BPM, 44100 sr', () => {
    expect(formatForBase(1, 'FRAME', SIMPLE_4_4, false)).toBe('44100');
  });

  it('falls back to beats for unknown base', () => {
    expect(formatForBase(3.5, 'UNKNOWN', SIMPLE_4_4, false)).toBe('3.5');
  });
});

describe('parseForBase', () => {
  it('parses BEATS decimal', () => {
    expect(parseForBase('4.5', 'BEATS', SIMPLE_4_4, false)).toBeCloseTo(4.5, EPSILON);
  });

  it('rejects NaN for BEATS', () => {
    expect(parseForBase('NaN', 'BEATS', SIMPLE_4_4, false)).toBeNull();
  });

  it('rejects negative for BEATS', () => {
    expect(parseForBase('-1', 'BEATS', SIMPLE_4_4, false)).toBeNull();
  });

  it('parses BBT position mode', () => {
    expect(parseForBase('2.1.0', 'BBT', SIMPLE_4_4, false)).toBeCloseTo(4, EPSILON);
  });

  it('parses BBT duration mode', () => {
    expect(parseForBase('1.0.0', 'BBT', SIMPLE_4_4, true)).toBeCloseTo(4, EPSILON);
  });

  it('parses BBT with missing ticks defaults to 0', () => {
    expect(parseForBase('1.2', 'BBT', SIMPLE_4_4, false)).toBeCloseTo(1, EPSILON);
  });

  it('parses BBST position mode', () => {
    expect(parseForBase('1.1.2.0', 'BBST', SIMPLE_4_4, false)).toBeCloseTo(0.25, EPSILON);
  });

  it('parses BBST duration mode', () => {
    expect(parseForBase('0.0.3.0', 'BBST', SIMPLE_4_4, true)).toBeCloseTo(0.75, EPSILON);
  });

  it('parses BBF position mode', () => {
    expect(parseForBase('1.1.50', 'BBF', SIMPLE_4_4, false)).toBeCloseTo(0.5, EPSILON);
  });

  it('parses BBF position mode with a single-digit fraction as canonical hundredths', () => {
    expect(parseForBase('1.1.5', 'BBF', SIMPLE_4_4, false)).toBeCloseTo(0.5, EPSILON);
  });

  it('parses BBF position mode relative to the current meter region start', () => {
    expect(parseForBase('4.3.00', 'BBF', FIVE_FOUR_AT_MEASURE_2, false)).toBeCloseTo(16, EPSILON);
  });

  it('parses BBF duration mode', () => {
    expect(parseForBase('0.0.50', 'BBF', SIMPLE_4_4, true)).toBeCloseTo(0.5, EPSILON);
  });

  it('parses BBF duration mode with a single-digit fraction as canonical hundredths', () => {
    expect(parseForBase('0.0.5', 'BBF', SIMPLE_4_4, true)).toBeCloseTo(0.5, EPSILON);
  });

  it('parses BBF duration mode from the user-reported single-digit example', () => {
    expect(parseForBase('0.2.5', 'BBF', SIMPLE_4_4, true)).toBeCloseTo(2.5, EPSILON);
  });

  it('parses TIME HH:MM:SS.mmm', () => {
    expect(parseForBase('0:01:30.000', 'TIME', SIMPLE_4_4, false)).toBeCloseTo(90, EPSILON);
  });

  it('parses TIME MM:SS.mmm', () => {
    expect(parseForBase('1:30.000', 'TIME', SIMPLE_4_4, false)).toBeCloseTo(90, EPSILON);
  });

  it('parses TIME at 120 BPM', () => {
    expect(parseForBase('0:01:00.000', 'TIME', BPM120, false)).toBeCloseTo(120, EPSILON);
  });

  it('parses SECONDS at 60 BPM', () => {
    expect(parseForBase('2', 'SECONDS', SIMPLE_4_4, false)).toBeCloseTo(2, EPSILON);
  });

  it('parses SECONDS at 120 BPM', () => {
    expect(parseForBase('1', 'SECONDS', BPM120, false)).toBeCloseTo(2, EPSILON);
  });

  it('rejects NaN for SECONDS', () => {
    expect(parseForBase('NaN', 'SECONDS', SIMPLE_4_4, false)).toBeNull();
  });

  it('parses SMPTE at 24fps', () => {
    expect(parseForBase('00:00:01:12', 'SMPTE', SIMPLE_4_4, false)).toBeCloseTo(1.5, EPSILON);
  });

  it('parses 29.97 fps minute-boundary labels with ordinary frame arithmetic', () => {
    expect(parseForBase('00:01:00:00', 'SMPTE', SMPTE_29_97, false)).toBeCloseTo(60, EPSILON);
    expect(parseForBase('00:01:00:01', 'SMPTE', SMPTE_29_97, false)).toBeCloseTo(
      60 + 1 / 29.97,
      EPSILON,
    );
  });

  it('rejects wrong SMPTE part count', () => {
    expect(parseForBase('00:00:01', 'SMPTE', SIMPLE_4_4, false)).toBeNull();
  });

  it('parses FRAME', () => {
    expect(parseForBase('44100', 'FRAME', SIMPLE_4_4, false)).toBeCloseTo(1, EPSILON);
  });

  it('rejects negative FRAME', () => {
    expect(parseForBase('-1', 'FRAME', SIMPLE_4_4, false)).toBeNull();
  });

  it('returns null for invalid TIME format', () => {
    expect(parseForBase('invalid', 'TIME', SIMPLE_4_4, false)).toBeNull();
  });

  it('falls back to parseFloat for unknown base', () => {
    expect(parseForBase('3.5', 'UNKNOWN', SIMPLE_4_4, false)).toBeCloseTo(3.5, EPSILON);
  });
});

describe('round-trip formatForBase → parseForBase', () => {
  const bases = ['BEATS', 'BBT', 'BBST', 'BBF', 'SECONDS'] as const;
  const testBeats = [0, 0.5, 1, 4, 4.25, 8, 13.75];

  for (const base of bases) {
    describe(base, () => {
      for (const beats of testBeats) {
        const label = `position ${beats} beats`;
        it(`${label}: format → parse round-trip`, () => {
          const formatted = formatForBase(beats, base, SIMPLE_4_4, false);
          const parsed = parseForBase(formatted, base, SIMPLE_4_4, false);
          expect(parsed).not.toBeNull();
          expect(parsed!).toBeCloseTo(beats, 1);
        });

        const durLabel = `duration ${beats} beats`;
        it(`${durLabel}: format → parse round-trip`, () => {
          const formatted = formatForBase(beats, base, SIMPLE_4_4, true);
          const parsed = parseForBase(formatted, base, SIMPLE_4_4, true);
          expect(parsed).not.toBeNull();
          expect(parsed!).toBeCloseTo(beats, 1);
        });
      }
    });
  }

  it('TIME round-trip: 90 beats at 60 BPM', () => {
    const formatted = formatForBase(90, 'TIME', SIMPLE_4_4, false);
    const parsed = parseForBase(formatted, 'TIME', SIMPLE_4_4, false);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeCloseTo(90, 0);
  });

  it('SMPTE round-trip: 1.5 beats at 60 BPM', () => {
    const formatted = formatForBase(1.5, 'SMPTE', SIMPLE_4_4, false);
    const parsed = parseForBase(formatted, 'SMPTE', SIMPLE_4_4, false);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeCloseTo(1.5, 1);
  });

  it('FRAME round-trip: 1 beat at 60 BPM, 44100 sr', () => {
    const formatted = formatForBase(1, 'FRAME', SIMPLE_4_4, false);
    const parsed = parseForBase(formatted, 'FRAME', SIMPLE_4_4, false);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeCloseTo(1, 1);
  });
});

describe('Java TimeUnitTextFieldTest parity', () => {
  it('testFormatSmpteUsesContextFrameRate: 1.5s → 00:00:01:15 at 30fps', () => {
    const ctx: TimeConversionContext = {
      meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
      tempoEnabled: true,
      initialTempo: 60,
      sampleRate: 44100,
    };
    const beats = 1.5;
    const secs = beatsToSeconds(beats, ctx);
    expect(formatSMPTE(secs, 30)).toBe('00:00:01:15');
  });

  it('testParseSmpteUsesContextFrameRate: 00:00:01:15 at 24fps → 1.625s', () => {
    const parsed = parseForBase('00:00:01:15', 'SMPTE', SIMPLE_4_4, false);
    expect(parsed).not.toBeNull();
    const secs = beatsToSeconds(parsed!, SIMPLE_4_4);
    expect(secs).toBeCloseTo(1 + 15 / 24, 1);
  });

  it('testFormatDurationSmpteUsesContextFrameRate: 1.5s duration → 00:00:01:15 at 30fps', () => {
    const secs = beatsToSeconds(1.5, SIMPLE_4_4);
    expect(formatSMPTE(secs, 30)).toBe('00:00:01:15');
  });

  it('testFormatSeconds: 1.5 beats at 60 BPM → "1.5"', () => {
    expect(formatForBase(1.5, 'SECONDS', SIMPLE_4_4, false)).toBe('1.5');
  });

  it('testParseSeconds: "1.5" → 1.5 beats at 60 BPM', () => {
    const parsed = parseForBase('1.5', 'SECONDS', SIMPLE_4_4, false);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeCloseTo(1.5, EPSILON);
  });

  it('testParseSecondsRejectsNonFiniteValue: "NaN" → null', () => {
    expect(parseForBase('NaN', 'SECONDS', SIMPLE_4_4, false)).toBeNull();
  });

  it('testFormatDurationSeconds: 2.25 beats at 60 BPM → "2.25"', () => {
    expect(formatForBase(2.25, 'SECONDS', SIMPLE_4_4, true)).toBe('2.25');
  });
});

describe('totalSecondsToTime', () => {
  it('converts 0 seconds', () => {
    expect(totalSecondsToTime(0)).toEqual({ hours: 0, minutes: 0, seconds: 0, ms: 0 });
  });

  it('converts 90 seconds', () => {
    expect(totalSecondsToTime(90)).toEqual({ hours: 0, minutes: 1, seconds: 30, ms: 0 });
  });

  it('converts 3661.5 seconds', () => {
    expect(totalSecondsToTime(3661.5)).toEqual({ hours: 1, minutes: 1, seconds: 1, ms: 500 });
  });
});

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0, 0, 0, 0)).toBe('0:00:00.000');
  });

  it('pads minutes, seconds, ms', () => {
    expect(formatTime(1, 2, 3, 4)).toBe('1:02:03.004');
  });
});

describe('project SMPTE mode and complete tempo integration', () => {
  it('converts fractional NDF by physical frame count', () => {
    expect(formatForBase(60, 'SMPTE', SMPTE_29_97, false)).toBe('00:00:59:28');
    expect(parseForBase('00:01:00:00', 'SMPTE', SMPTE_29_97, false)).toBe(60.06);
    expect(parseForBase('00:00:00;00', 'SMPTE', SMPTE_29_97, false)).toBeNull();
  });
  it('uses DF and the preceding tempo change for positions and durations', () => {
    const context: TimeConversionContext = {
      ...SMPTE_29_97,
      smpteDropFrame: true,
      tempoPoints: [
        { beat: 0, tempo: 60, curveType: 'constant' },
        { beat: 30, tempo: 120, curveType: 'constant' },
      ],
    };
    expect(parseForBase('00:01:00;02', 'SMPTE', context, false)).toBeCloseTo(90.12, 12);
    expect(formatForBase(90.12, 'SMPTE', context, false)).toBe('00:01:00;02');
    expect(formatForBase(90.12, 'SMPTE', context, true)).toBe('00:01:00;02');
    for (const text of ['00:01:00;00', '00:01:00;01', '00:01:00:02', '00:00:00;00junk']) {
      expect(parseForBase(text, 'SMPTE', context, false)).toBeNull();
    }
    expect(
      formatForBase(parseForBase('25:00:00;00', 'SMPTE', context, false)!, 'SMPTE', context, false),
    ).toBe('25:00:00;00');
  });
});
