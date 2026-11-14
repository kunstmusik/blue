import { expect, it } from 'vitest';
import { secondsToSmpteFrame } from '@blue/data';
import { beatsToSeconds } from '../time/time-unit-logic';
import {
  snapBeatToGrid,
  createFrameSnapContext,
  deriveSnapLineBeats,
} from '../components/workbench/panels/score/snap-grid-utils';

it.each(['BAR', 'AUTO'] as const)(
  'strides dense %s grid marks while keeping exact edit snapping',
  (mode) => {
    const meterMap = {
      entries: [
        { measure: 1, numBeats: 1, beatLength: 256, startBeat: 0 },
        { measure: 6401, numBeats: 4, beatLength: 4, startBeat: 100 },
      ],
    };
    const snapBeats = mode === 'BAR' ? 4 : 2;
    const full = deriveSnapLineBeats(mode, snapBeats, meterMap, 220, undefined, 4);
    const slice = deriveSnapLineBeats(mode, snapBeats, meterMap, 220, undefined, 4, 21);
    expect(slice).toEqual(full.filter((beat) => beat >= 21));
    expect(slice.length).toBeLessThan(101);
    expect(slice).toContain(100);
    expect(snapBeatToGrid(21.02, 'floor', mode, snapBeats, meterMap)).toBe(21.015625);
  },
);

it.each(['constant', 'linear'] as const)(
  'spaces exact frame grid lines across a %s tempo change',
  (curveType) => {
    const context = createFrameSnapContext(
      {
        enabled: true,
        visible: false,
        points: [
          { beat: 0, tempo: 120, curveType },
          { beat: 16, tempo: 30, curveType: 'constant' },
        ],
      },
      24,
    );
    const full = deriveSnapLineBeats('FRAME', 1, undefined, 24, context, 100);
    const slice = deriveSnapLineBeats('FRAME', 1, undefined, 24, context, 100, 17);
    expect(slice).toEqual(full.filter((beat) => beat >= 17 - 1e-9));
    expect(slice.length).toBeGreaterThan(1);
    for (let i = 1; i < full.length; i += 1) {
      expect((full[i]! - full[i - 1]!) * 100).toBeGreaterThanOrEqual(8 - 1e-9);
    }
    for (const beat of slice) {
      const seconds = beatsToSeconds(beat, context);
      expect(seconds * 24).toBeCloseTo(secondsToSmpteFrame(seconds, 24, 'nearest')!, 8);
    }
  },
);

it('snaps to rational physical frames through a tempo change in either counting mode', () => {
  const tempoMap = {
    enabled: true,
    visible: false,
    points: [
      { beat: 0, tempo: 60, curveType: 'constant' as const },
      { beat: 30, tempo: 120, curveType: 'constant' as const },
    ],
  };
  const context = createFrameSnapContext(tempoMap, 29.97);
  for (const dropFrame of [false, true]) {
    const format = { ...context, smpteDropFrame: dropFrame };
    expect(snapBeatToGrid(90.13, 'floor', 'FRAME', 1, undefined, format)).toBeCloseTo(90.12, 12);
    expect(snapBeatToGrid(90.17, 'nearest', 'FRAME', 1, undefined, format)).toBeCloseTo(
      90.18673333333333,
      12,
    );
    expect(snapBeatToGrid(10.02, 'floor', 'FRAME', 1, undefined, format)).toBeCloseTo(10.01, 12);
  }
  const lines = deriveSnapLineBeats('FRAME', 1, undefined, 91, context, 2400);
  expect(lines).toContain(90.12);
});

it('snaps near high beat counts in mixed meters identically to generating from beat zero', () => {
  const meterMap = {
    entries: [
      { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
      { measure: 5, numBeats: 5, beatLength: 4, startBeat: 16 },
      { measure: 12, numBeats: 7, beatLength: 8, startBeat: 51 },
    ],
  };
  const referenceSnap = (
    beat: number,
    mode: 'floor' | 'nearest',
    snapValue: 'BAR' | 'AUTO',
    snapBeats: number,
  ) => {
    const lines = deriveSnapLineBeats(snapValue, snapBeats, meterMap, Math.max(0, beat) + 8);
    let previous = lines[0] ?? 0;
    let next = previous;
    for (const line of lines) {
      if (line <= beat + 1e-9) previous = line;
      if (line >= beat - 1e-9) {
        next = line;
        break;
      }
    }
    if (mode === 'floor') return previous;
    return Math.abs(beat - previous) <= Math.abs(next - beat) ? previous : next;
  };

  for (const beat of [0, 3.9, 4, 15.9, 16, 20.9, 50.9, 51, 54.4, 54.5, 5000.3, 50000.7]) {
    for (const mode of ['floor', 'nearest'] as const) {
      expect(snapBeatToGrid(beat, mode, 'BAR', 4, meterMap)).toBeCloseTo(
        referenceSnap(beat, mode, 'BAR', 4),
        10,
      );
      expect(snapBeatToGrid(beat, mode, 'AUTO', 2, meterMap)).toBeCloseTo(
        referenceSnap(beat, mode, 'AUTO', 2),
        10,
      );
      expect(snapBeatToGrid(beat, mode, 'AUTO', 0.25, meterMap)).toBeCloseTo(
        referenceSnap(beat, mode, 'AUTO', 0.25),
        10,
      );
    }
  }
});

it('derives range-bounded snap lines matching a slice of the full timeline', () => {
  const meterMap = {
    entries: [
      { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
      { measure: 3, numBeats: 5, beatLength: 4, startBeat: 8 },
      { measure: 6, numBeats: 3, beatLength: 4, startBeat: 23 },
    ],
  };

  const fullBar = deriveSnapLineBeats('BAR', 4, meterMap, 60);
  const slicedBar = deriveSnapLineBeats('BAR', 4, meterMap, 45, undefined, 100, 12);
  expect(slicedBar).toEqual(fullBar.filter((b) => b >= 12 - 1e-9 && b <= 45 + 1e-9));

  const fullAuto = deriveSnapLineBeats('AUTO', 2, meterMap, 60);
  const slicedAuto = deriveSnapLineBeats('AUTO', 2, meterMap, 34, undefined, 100, 11);
  expect(slicedAuto).toEqual(fullAuto.filter((b) => b >= 11 - 1e-9 && b <= 34 + 1e-9));

  const fullBeat = deriveSnapLineBeats('BEAT', 0.5, meterMap, 40);
  const slicedBeat = deriveSnapLineBeats('BEAT', 0.5, meterMap, 25, undefined, 100, 14);
  expect(slicedBeat).toEqual(fullBeat.filter((b) => b >= 14 - 1e-9 && b <= 25 + 1e-9));

  const tempoMap = {
    enabled: true,
    visible: false,
    points: [{ beat: 0, tempo: 60, curveType: 'constant' as const }],
  };
  const frameCtx = createFrameSnapContext(tempoMap, 24);
  const fullFrames = deriveSnapLineBeats('FRAME', 1, undefined, 10, frameCtx, 100);
  const slicedFrames = deriveSnapLineBeats('FRAME', 1, undefined, 8, frameCtx, 100, 3);
  expect(slicedFrames).toEqual(fullFrames.filter((b) => b >= 3 - 1e-9 && b <= 8 + 1e-9));
});

it('strides dense sample snap grid lines to >= 8px while keeping sample-accurate edit snapping', () => {
  const sampleBeat = 1 / 44100;
  const pixelsPerBeat = 20;
  const lines = deriveSnapLineBeats(
    'SAMPLE',
    sampleBeat,
    undefined,
    200,
    undefined,
    pixelsPerBeat,
    0,
  );

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.length).toBeLessThan(1000);
  for (let i = 1; i < lines.length; i += 1) {
    expect((lines[i] - lines[i - 1]) * pixelsPerBeat).toBeGreaterThanOrEqual(8 - 1e-9);
  }

  const probeBeat = 123.456789;
  const snapped = snapBeatToGrid(probeBeat, 'nearest', 'SAMPLE', sampleBeat, undefined);
  expect(Math.abs(snapped - probeBeat)).toBeLessThanOrEqual(sampleBeat * 0.5 + 1e-12);
});

it('handles non-finite bounds, NaN snapBeats, and non-positive pixelsPerBeat safely', () => {
  expect(deriveSnapLineBeats('SAMPLE', Number.NaN, undefined, 100)).toEqual([]);
  expect(deriveSnapLineBeats('BAR', 1, undefined, Number.POSITIVE_INFINITY)).toEqual([]);
  expect(deriveSnapLineBeats('AUTO', 0.25, undefined, Number.POSITIVE_INFINITY)).toEqual([]);
  expect(deriveSnapLineBeats('BEAT', 1, undefined, Number.POSITIVE_INFINITY)).toEqual([]);
  expect(
    deriveSnapLineBeats('SAMPLE', 1 / 44100, undefined, 16, undefined, 0, 0).length,
  ).toBeLessThan(250);

  const tempoMap = {
    enabled: true,
    visible: false,
    points: [{ beat: 0, tempo: 60, curveType: 'constant' as const }],
  };
  const frameCtx = createFrameSnapContext(tempoMap, 24);
  expect(deriveSnapLineBeats('FRAME', 1, undefined, 16, frameCtx, 0, 0).length).toBeLessThan(250);
  expect(snapBeatToGrid(12.34, 'nearest', 'SAMPLE', Number.NaN, undefined)).toBe(12.34);
});

it('keeps 1/5 meter bar lines identical between full and viewport-sliced derivation around beat 6816', () => {
  const meterMap = {
    entries: [{ measure: 1, numBeats: 1, beatLength: 5, startBeat: 0 }],
  };
  const fullBars = deriveSnapLineBeats('BAR', 1, meterMap, 6820, undefined, 100, 0);
  const slicedBars = deriveSnapLineBeats('BAR', 1, meterMap, 6820, undefined, 100, 6800);

  expect(fullBars.some((beat) => Math.abs(beat - 6816) < 1e-9)).toBe(true);
  expect(slicedBars.some((beat) => Math.abs(beat - 6816) < 1e-9)).toBe(true);
  expect(slicedBars).toEqual(fullBars.filter((beat) => beat >= 6800 - 1e-9 && beat <= 6820 + 1e-9));
});
