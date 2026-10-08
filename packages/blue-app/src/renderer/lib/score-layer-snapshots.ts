import type { ScoreLayerGroupSnapshot, ScoreLayerSnapshot } from '../../shared/project-editor';

/** Preserve each group's concrete layer type when projecting renderer snapshots. */
export function updateScoreGroupLayers(
  group: ScoreLayerGroupSnapshot,
  update: <T extends ScoreLayerSnapshot>(layers: T[]) => T[],
): ScoreLayerGroupSnapshot {
  switch (group.groupType) {
    case 'track':
      return { ...group, layers: update(group.layers) };
    case 'patterns':
      return { ...group, layers: update(group.layers) };
    case 'polyObject':
      return { ...group, layers: update(group.layers) };
  }
}
