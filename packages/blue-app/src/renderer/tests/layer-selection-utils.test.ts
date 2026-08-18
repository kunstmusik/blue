import { describe, expect, it } from 'vitest';
import type { ScoreLayerGroupSnapshot } from '../../shared/project-editor';
import {
  buildLayerRemovalPlan,
  buildSelectionKey,
  deriveSelectedLayerRanges,
  flattenVisibleLayers,
  getInclusiveGlobalRange,
  getLayerOperationAvailability,
  getPushDisabledReasonLabel,
  parseSelectionKey,
  reconcileSelectionState,
} from '../components/workbench/panels/score/layer-selection-utils';

function makeMockGroups(): ScoreLayerGroupSnapshot[] {
  return [
    {
      groupId: 'grp-sound',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        { layerId: 's-0', layerSelectionId: 'sel-s-0', name: 'Sound 0', height: 44, items: [] },
        { layerId: 's-1', layerSelectionId: 'sel-s-1', name: 'Sound 1', height: 44, items: [] },
      ],
    },
    {
      groupId: 'grp-track',
      groupType: 'track',
      name: 'Tracks',
      layerCount: 3,
      isOpenableContainer: false,
      layers: [
        { layerId: 't-0', layerSelectionId: 'sel-t-0', name: 'Track 0', height: 44, items: [] },
        { layerId: 't-1', layerSelectionId: 'sel-t-1', name: 'Track 1', height: 44, items: [] },
        { layerId: 't-2', layerSelectionId: 'sel-t-2', name: 'Track 2', height: 44, items: [] },
      ],
    },
    {
      groupId: 'grp-pat',
      groupType: 'patterns',
      name: 'Patterns',
      layerCount: 2,
      isOpenableContainer: false,
      layers: [
        { layerId: 'p-0', layerSelectionId: 'sel-p-0', name: 'Pattern 0', height: 44, items: [] },
        { layerId: 'p-1', layerSelectionId: 'sel-p-1', name: 'Pattern 1', height: 44, items: [] },
      ],
    },
  ];
}

describe('layer-selection-utils', () => {
  it('flattens visible layer groups in sequential global order', () => {
    const groups = makeMockGroups();
    const visible = flattenVisibleLayers(groups, 'scope-1');

    expect(visible).toHaveLength(7);
    expect(visible.map((v) => ({ gid: v.groupId, lidx: v.localIndex, gidx: v.globalIndex }))).toEqual([
      { gid: 'grp-sound', lidx: 0, gidx: 0 },
      { gid: 'grp-sound', lidx: 1, gidx: 1 },
      { gid: 'grp-track', lidx: 0, gidx: 2 },
      { gid: 'grp-track', lidx: 1, gidx: 3 },
      { gid: 'grp-track', lidx: 2, gidx: 4 },
      { gid: 'grp-pat', lidx: 0, gidx: 5 },
      { gid: 'grp-pat', lidx: 1, gidx: 6 },
    ]);
  });

  it('builds and parses selection keys', () => {
    const key = buildSelectionKey('grp-1', 'sel-2');
    expect(key).toBe('grp-1:sel-2');
    expect(parseSelectionKey(key)).toEqual({ groupId: 'grp-1', layerSelectionId: 'sel-2' });
    expect(parseSelectionKey('invalid')).toBeNull();
  });

  describe('getInclusiveGlobalRange', () => {
    it('returns inclusive same-group range', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const range = getInclusiveGlobalRange(visible, 'grp-track:sel-t-0', 'grp-track:sel-t-2');
      expect(range.map((r) => r.layerSelectionId)).toEqual(['sel-t-0', 'sel-t-1', 'sel-t-2']);
    });

    it('returns inclusive cross-group range spanning partial endpoints and complete middle groups', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      // From Sound 1 (global 1) to Track 1 (global 3)
      const range1 = getInclusiveGlobalRange(visible, 'grp-sound:sel-s-1', 'grp-track:sel-t-1');
      expect(range1.map((r) => r.layerSelectionId)).toEqual(['sel-s-1', 'sel-t-0', 'sel-t-1']);

      // From Sound 0 (global 0) to Pattern 0 (global 5), spanning all of Track group
      const range2 = getInclusiveGlobalRange(visible, 'grp-sound:sel-s-0', 'grp-pat:sel-p-0');
      expect(range2.map((r) => r.layerSelectionId)).toEqual([
        'sel-s-0',
        'sel-s-1',
        'sel-t-0',
        'sel-t-1',
        'sel-t-2',
        'sel-p-0',
      ]);
    });

    it('handles reversed range selection', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const range = getInclusiveGlobalRange(visible, 'grp-track:sel-t-2', 'grp-sound:sel-s-0');
      expect(range.map((r) => r.layerSelectionId)).toEqual([
        'sel-s-0',
        'sel-s-1',
        'sel-t-0',
        'sel-t-1',
        'sel-t-2',
      ]);
    });

    it('falls back to single target when anchor is not found', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const range = getInclusiveGlobalRange(visible, 'unknown-anchor', 'grp-track:sel-t-1');
      expect(range.map((r) => r.layerSelectionId)).toEqual(['sel-t-1']);
    });

    it('returns empty array when target is not found', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const range = getInclusiveGlobalRange(visible, 'grp-track:sel-t-1', 'unknown-target');
      expect(range).toEqual([]);
    });
  });

  describe('deriveSelectedLayerRanges', () => {
    it('groups selected layers by group in visible order', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const selectedKeys = new Set(['grp-sound:sel-s-1', 'grp-track:sel-t-0', 'grp-track:sel-t-1']);
      const ranges = deriveSelectedLayerRanges(visible, selectedKeys);

      expect(ranges).toEqual([
        {
          groupId: 'grp-sound',
          groupType: 'polyObject',
          startIndex: 1,
          endIndex: 1,
          layerSelectionIds: ['sel-s-1'],
          count: 1,
        },
        {
          groupId: 'grp-track',
          groupType: 'track',
          startIndex: 0,
          endIndex: 1,
          layerSelectionIds: ['sel-t-0', 'sel-t-1'],
          count: 2,
        },
      ]);
    });

    it('returns empty array for empty selection', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      expect(deriveSelectedLayerRanges(visible, new Set())).toEqual([]);
    });

    it('keeps non-adjacent selected identities as separate ranges', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 's1');
      const ranges = deriveSelectedLayerRanges(
        visible,
        new Set(['grp-track:sel-t-0', 'grp-track:sel-t-2']),
      );

      expect(ranges.map(({ startIndex, endIndex, count }) => ({ startIndex, endIndex, count }))).toEqual([
        { startIndex: 0, endIndex: 0, count: 1 },
        { startIndex: 2, endIndex: 2, count: 1 },
      ]);
    });
  });

  describe('getLayerOperationAvailability', () => {
    const groups = makeMockGroups();

    it('reports disabled reasons when selection is empty', () => {
      const availability = getLayerOperationAvailability(groups, []);
      expect(availability).toEqual({
        canAdd: false,
        canPushUp: false,
        pushUpDisabledReason: 'no-selection',
        canPushDown: false,
        pushDownDisabledReason: 'no-selection',
        canRemove: false,
        removeDisabledReason: 'no-selection',
      });
    });

    it('handles single layer at top boundary', () => {
      const ranges = [{
        groupId: 'grp-track',
        groupType: 'track' as const,
        startIndex: 0,
        endIndex: 0,
        layerSelectionIds: ['sel-t-0'],
        count: 1,
      }];
      const availability = getLayerOperationAvailability(groups, ranges);
      expect(availability).toEqual({
        canAdd: true,
        canPushUp: false,
        pushUpDisabledReason: 'at-group-start',
        canPushDown: true,
        pushDownDisabledReason: undefined,
        canRemove: true,
      });
    });

    it('handles single layer in middle', () => {
      const ranges = [{
        groupId: 'grp-track',
        groupType: 'track' as const,
        startIndex: 1,
        endIndex: 1,
        layerSelectionIds: ['sel-t-1'],
        count: 1,
      }];
      const availability = getLayerOperationAvailability(groups, ranges);
      expect(availability).toEqual({
        canAdd: true,
        canPushUp: true,
        pushUpDisabledReason: undefined,
        canPushDown: true,
        pushDownDisabledReason: undefined,
        canRemove: true,
      });
    });

    it('handles single layer at bottom boundary', () => {
      const ranges = [{
        groupId: 'grp-track',
        groupType: 'track' as const,
        startIndex: 2,
        endIndex: 2,
        layerSelectionIds: ['sel-t-2'],
        count: 1,
      }];
      const availability = getLayerOperationAvailability(groups, ranges);
      expect(availability).toEqual({
        canAdd: true,
        canPushUp: true,
        pushUpDisabledReason: undefined,
        canPushDown: false,
        pushDownDisabledReason: 'at-group-end',
        canRemove: true,
      });
    });

    it('disables Add and enables range Push for multi-selection within one group', () => {
      const ranges = [{
        groupId: 'grp-track',
        groupType: 'track' as const,
        startIndex: 0,
        endIndex: 1,
        layerSelectionIds: ['sel-t-0', 'sel-t-1'],
        count: 2,
      }];
      const availability = getLayerOperationAvailability(groups, ranges);
      expect(availability.canAdd).toBe(false);
      expect(availability.canPushUp).toBe(false);
      expect(availability.pushUpDisabledReason).toBe('at-group-start');
      expect(availability.canPushDown).toBe(true);
      expect(availability.canRemove).toBe(true);
    });

    it('disables Push with selection-spans-groups for multi-group selections', () => {
      const ranges = [
        {
          groupId: 'grp-sound',
          groupType: 'polyObject' as const,
          startIndex: 1,
          endIndex: 1,
          layerSelectionIds: ['sel-s-1'],
          count: 1,
        },
        {
          groupId: 'grp-track',
          groupType: 'track' as const,
          startIndex: 0,
          endIndex: 0,
          layerSelectionIds: ['sel-t-0'],
          count: 1,
        },
      ];
      const availability = getLayerOperationAvailability(groups, ranges);
      expect(availability).toEqual({
        canAdd: false,
        canPushUp: false,
        pushUpDisabledReason: 'selection-spans-groups',
        canPushDown: false,
        pushDownDisabledReason: 'selection-spans-groups',
        canRemove: true,
      });
    });

    it('disables Push for a non-contiguous same-group selection with an explanation', () => {
      const ranges = [
        {
          groupId: 'grp-track',
          groupType: 'track' as const,
          startIndex: 0,
          endIndex: 0,
          layerSelectionIds: ['sel-t-0'],
          count: 1,
        },
        {
          groupId: 'grp-track',
          groupType: 'track' as const,
          startIndex: 2,
          endIndex: 2,
          layerSelectionIds: ['sel-t-2'],
          count: 1,
        },
      ];
      const availability = getLayerOperationAvailability(groups, ranges);

      expect(availability.canPushUp).toBe(false);
      expect(availability.pushUpDisabledReason).toBe('selection-is-not-contiguous');
      expect(getPushDisabledReasonLabel(availability.pushUpDisabledReason)).toBe('Push requires one contiguous block');
    });
  });

  describe('buildLayerRemovalPlan', () => {
    const groups = makeMockGroups();

    it('computes removal count and flags empty groups', () => {
      // Removing all 2 layers of Sound group and 1 of Track group
      const ranges = [
        {
          groupId: 'grp-sound',
          groupType: 'polyObject' as const,
          startIndex: 0,
          endIndex: 1,
          layerSelectionIds: ['sel-s-0', 'sel-s-1'],
          count: 2,
        },
        {
          groupId: 'grp-track',
          groupType: 'track' as const,
          startIndex: 0,
          endIndex: 0,
          layerSelectionIds: ['sel-t-0'],
          count: 1,
        },
      ];
      const plan = buildLayerRemovalPlan(groups, ranges);
      expect(plan.totalLayerCount).toBe(3);
      expect(plan.emptyGroupIds).toEqual(['grp-sound']);
      expect(plan.deleteEmptyLayerGroups).toBe(true);
    });

    it('does not flag empty groups when removing partial layers', () => {
      const ranges = [
        {
          groupId: 'grp-track',
          groupType: 'track' as const,
          startIndex: 1,
          endIndex: 1,
          layerSelectionIds: ['sel-t-1'],
          count: 1,
        },
      ];
      const plan = buildLayerRemovalPlan(groups, ranges);
      expect(plan.totalLayerCount).toBe(1);
      expect(plan.emptyGroupIds).toEqual([]);
      expect(plan.deleteEmptyLayerGroups).toBe(false);
    });

    it('flags a group emptied by multiple disjoint ranges', () => {
      const groupsWithThreeLayers = makeMockGroups().map((group) => (
        group.groupId === 'grp-sound'
          ? { ...group, layerCount: 3, layers: [
            ...group.layers,
            { layerId: 's-2', layerSelectionId: 'sel-s-2', name: 'Sound 2', height: 44, items: [] },
          ] }
          : group
      ));
      const plan = buildLayerRemovalPlan(groupsWithThreeLayers, [
        {
          groupId: 'grp-sound',
          groupType: 'polyObject',
          startIndex: 0,
          endIndex: 0,
          layerSelectionIds: ['sel-s-0'],
          count: 1,
        },
        {
          groupId: 'grp-sound',
          groupType: 'polyObject',
          startIndex: 1,
          endIndex: 2,
          layerSelectionIds: ['sel-s-1', 'sel-s-2'],
          count: 2,
        },
      ]);

      expect(plan.emptyGroupIds).toEqual(['grp-sound']);
    });
  });

  describe('reconcileSelectionState', () => {
    it('clears selection when scopeKey changes', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 'scope-new');
      const state = {
        scopeKey: 'scope-old',
        selectedKeys: new Set(['grp-sound:sel-s-0']),
        anchorKey: 'grp-sound:sel-s-0',
        focusKey: 'grp-sound:sel-s-0',
      };
      const reconciled = reconcileSelectionState(state, 'scope-new', visible);
      expect(reconciled.selectedKeys.size).toBe(0);
      expect(reconciled.anchorKey).toBeNull();
      expect(reconciled.focusKey).toBeNull();
      expect(reconciled.scopeKey).toBe('scope-new');
    });

    it('prunes removed layer keys and heals invalid anchor/focus', () => {
      const visible = flattenVisibleLayers(makeMockGroups(), 'scope-1');
      const state = {
        scopeKey: 'scope-1',
        selectedKeys: new Set(['grp-sound:sel-deleted', 'grp-track:sel-t-1']),
        anchorKey: 'grp-sound:sel-deleted',
        focusKey: 'grp-sound:sel-deleted',
      };
      const reconciled = reconcileSelectionState(state, 'scope-1', visible);
      expect([...reconciled.selectedKeys]).toEqual(['grp-track:sel-t-1']);
      expect(reconciled.anchorKey).toBe('grp-track:sel-t-1');
      expect(reconciled.focusKey).toBe('grp-track:sel-t-1');
    });
  });
});
