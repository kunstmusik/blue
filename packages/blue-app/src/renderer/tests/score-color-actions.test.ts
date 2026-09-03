import { describe, expect, it } from 'vitest';
import {
  buildSetSelectionToLayerColorPatch,
  buildApplyLayerColorToAllClipsPatch,
} from '../components/workbench/panels/score/score-color-actions';
import {
  createMockScoreLayerSnapshot,
  createMockScoreRowObjectSnapshot,
  createMockScoreObjectTarget,
} from '../../shared/project-editor-layer-color-test-utils';
import type { ScoreLayerGroupSnapshot } from '../../shared/project-editor';

describe('Score Color Action Builders (US3)', () => {
  const target1 = createMockScoreObjectTarget({
    selectionId: 'item-1',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
  });
  const target2 = createMockScoreObjectTarget({
    selectionId: 'item-2',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 1, objectIndex: 0 },
  });
  const target3 = createMockScoreObjectTarget({
    selectionId: 'item-3',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 1 },
  });

  const item1 = createMockScoreRowObjectSnapshot({
    objectId: 'item-1',
    editorTarget: target1,
    backgroundColor: -16711936, // Green
  });
  const item2 = createMockScoreRowObjectSnapshot({
    objectId: 'item-2',
    editorTarget: target2,
    backgroundColor: -16711936, // Green
  });
  const item3 = createMockScoreRowObjectSnapshot({
    objectId: 'item-3',
    editorTarget: target3,
    backgroundColor: -65536, // Red (already matches layer 0 color)
  });

  const layerGroups: ScoreLayerGroupSnapshot[] = [
    {
      groupId: 'group-1',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        createMockScoreLayerSnapshot({
          layerId: 'layer-0',
          backgroundColor: -65536, // Red
          items: [item1, item3],
        }),
        createMockScoreLayerSnapshot({
          layerId: 'layer-1',
          backgroundColor: -16776961, // Blue
          items: [item2],
        }),
      ],
    },
  ];

  it('buildSetSelectionToLayerColorPatch captures forward layer colors and inverse item colors', () => {
    const patchPair = buildSetSelectionToLayerColorPatch({
      selection: [item1, item2],
      layerGroups,
    });

    expect(patchPair).not.toBeNull();
    expect(patchPair?.forward.score?.type).toBe('setScoreObjectBackgroundColors');
    expect(patchPair?.inverse.score?.type).toBe('setScoreObjectBackgroundColors');

    const fUpdates = (patchPair?.forward.score as any).updates;
    const iUpdates = (patchPair?.inverse.score as any).updates;

    expect(fUpdates).toHaveLength(2);
    expect(fUpdates[0]).toEqual({ target: target1, backgroundColor: -65536 }); // Layer 0 is Red
    expect(fUpdates[1]).toEqual({ target: target2, backgroundColor: -16776961 }); // Layer 1 is Blue

    expect(iUpdates).toHaveLength(2);
    expect(iUpdates[0]).toEqual({ target: target1, backgroundColor: -16711936 }); // Original Green
    expect(iUpdates[1]).toEqual({ target: target2, backgroundColor: -16711936 }); // Original Green
  });

  it('buildSetSelectionToLayerColorPatch returns null if all selected items already match layer color', () => {
    const patchPair = buildSetSelectionToLayerColorPatch({
      selection: [item3], // Item 3 is already Red matching Layer 0
      layerGroups,
    });

    expect(patchPair).toBeNull();
  });

  it('buildApplyLayerColorToAllClipsPatch enumerates only items on the specified layer', () => {
    const patchPair = buildApplyLayerColorToAllClipsPatch({
      groupId: 'group-1',
      layerIndex: 0,
      layerGroups,
    });

    expect(patchPair).not.toBeNull();
    const fUpdates = (patchPair?.forward.score as any).updates;
    const iUpdates = (patchPair?.inverse.score as any).updates;

    // Item 1 changes from Green to Red; Item 3 is already Red so it may be included or excluded, but item 2 from layer 1 MUST be excluded
    const updatedTargetIds = fUpdates.map((u: any) => u.target.selectionId);
    expect(updatedTargetIds).toContain('item-1');
    expect(updatedTargetIds).not.toContain('item-2');

    expect(iUpdates[0]).toEqual({ target: target1, backgroundColor: -16711936 });
  });
});
