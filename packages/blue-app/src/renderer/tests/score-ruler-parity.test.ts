import { describe, expect, it } from 'vitest';
import { TimeBase } from '@blue/data';
import type { MeterSnapshot, TempoMapSnapshot } from '../../shared/project-editor';
import { __testOnly } from '../components/workbench/panels/score/ColumnHeader';

const TEMPO_60: TempoMapSnapshot = {
  enabled: true,
  visible: false,
  points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
};

const METERS_4_4: MeterSnapshot[] = [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }];

function majorLabels(marks: ReturnType<typeof __testOnly.computeMarks>): string[] {
  return marks
    .filter((mark) => mark.type === 'major' && typeof mark.label === 'string')
    .map((mark) => mark.label as string);
}

describe('Score ruler parity with Java TimeBar', () => {
  it('formats TIME labels with integer minutes/hours (no decimal minute bug)', () => {
    const marks = __testOnly.computeMarks(TimeBase.TIME, 12, 100, TEMPO_60, METERS_4_4, 24, 44100);

    const labels = majorLabels(marks);
    expect(labels).toContain('0:02');
    expect(labels.some((label) => label.includes('0.033333333333'))).toBe(false);
    expect(labels.every((label) => /^\d+:\d{2}(?::\d{2})?(?:\.\d+)?$/.test(label))).toBe(true);
  });

  it('uses major ticks only for BEATS/TIME/SECONDS/SMPTE/SAMPLES like Java TimeBar', () => {
    const bases = [TimeBase.BEATS, TimeBase.TIME, TimeBase.SECONDS, TimeBase.SMPTE, TimeBase.FRAME];

    for (const base of bases) {
      const marks = __testOnly.computeMarks(base, 16, 80, TEMPO_60, METERS_4_4, 24, 44100);
      expect(marks.some((mark) => mark.type === 'minor')).toBe(false);
    }
  });

  it('uses provided sample rate for FRAME ruler conversion', () => {
    const marks44k = __testOnly.computeMarks(
      TimeBase.FRAME,
      8,
      120,
      TEMPO_60,
      METERS_4_4,
      24,
      44100,
    );
    const marks48k = __testOnly.computeMarks(
      TimeBase.FRAME,
      8,
      120,
      TEMPO_60,
      METERS_4_4,
      24,
      48000,
    );

    const tick44k = marks44k.find((mark) => mark.type === 'major' && mark.label === '50k');
    const tick48k = marks48k.find((mark) => mark.type === 'major' && mark.label === '50k');

    expect(tick44k).toBeDefined();
    expect(tick48k).toBeDefined();
    expect(tick48k!.x).not.toBeCloseTo(tick44k!.x, 6);

    const labels44k = majorLabels(
      __testOnly.computeMarks(TimeBase.FRAME, 8, 120, TEMPO_60, METERS_4_4, 24, 44100),
    );
    const labels48k = majorLabels(
      __testOnly.computeMarks(TimeBase.FRAME, 8, 120, TEMPO_60, METERS_4_4, 24, 48000),
    );

    expect(labels48k).toEqual(labels44k);
  });

  it('handles meter changes when computing measure starts', () => {
    const meters: MeterSnapshot[] = [
      { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
      { measure: 3, numBeats: 3, beatLength: 4, startBeat: 8 },
    ];

    const marks = __testOnly.computeMarks(TimeBase.BBT, 16, 80, TEMPO_60, meters, 24, 44100);
    const measure4 = marks.find((mark) => mark.type === 'major' && mark.label === '4');

    expect(measure4).toBeDefined();
    expect(measure4!.x).toBeCloseTo(11 * 80, 6);
  });
});
