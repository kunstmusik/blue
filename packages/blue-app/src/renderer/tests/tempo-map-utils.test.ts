import { describe, expect, it } from 'vitest';
import type { TempoMapSnapshot } from '../../shared/project-editor';
import { secondsToBeats } from '../components/workbench/panels/score/tempo-map-utils';

const disabledTempoMap: TempoMapSnapshot = {
  enabled: false,
  visible: false,
  points: [{ beat: 0, tempo: 120, curveType: 'constant' }],
};

describe('tempo-map-utils', () => {
  it('uses one beat per second when the tempo map is disabled', () => {
    expect(secondsToBeats(3, disabledTempoMap)).toBe(3);
  });

  it('converts across constant tempo-map segments', () => {
    const tempoMap: TempoMapSnapshot = {
      enabled: true,
      visible: false,
      points: [
        { beat: 0, tempo: 120, curveType: 'constant' },
        { beat: 4, tempo: 60, curveType: 'constant' },
      ],
    };

    expect(secondsToBeats(3, tempoMap)).toBe(5);
  });
});
