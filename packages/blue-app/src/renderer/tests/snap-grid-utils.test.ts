import { expect, it } from 'vitest';
import {
  snapBeatToGrid,
  createFrameSnapContext,
  deriveSnapLineBeats,
} from '../components/workbench/panels/score/snap-grid-utils';

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
