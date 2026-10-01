import { expect, it } from 'vitest';
import {
  createFrameSnapContext,
  snapBeatToGrid,
} from '../components/workbench/panels/score/snap-grid-utils';
import { snapBeat as snapAutomationBeat } from '../components/workbench/panels/score/automation/automation-line-utils';
import { snapBeat as snapTempoBeat } from '../components/workbench/panels/score/tempo-map-utils';

it('routes tempo and automation edits through the same physical frame snap as score edits', () => {
  const map = {
    enabled: true,
    visible: false,
    points: [
      { beat: 0, tempo: 60, curveType: 'constant' as const },
      { beat: 30, tempo: 120, curveType: 'constant' as const },
    ],
  };
  const context = createFrameSnapContext(map, 29.97);
  for (const [input, expected] of [
    [10.02, 10.01],
    [90.13, 90.12],
  ]) {
    expect(snapBeatToGrid(input, 'nearest', 'FRAME', 1, undefined, context)).toBeCloseTo(
      expected,
      12,
    );
    expect(snapAutomationBeat(input, true, 1, 'FRAME', context)).toBeCloseTo(expected, 12);
    expect(
      snapTempoBeat(input, true, 'FRAME', 100, 60, 29.97, 44100, undefined, context),
    ).toBeCloseTo(expected, 12);
  }
});
