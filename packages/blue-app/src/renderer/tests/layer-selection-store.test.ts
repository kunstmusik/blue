import { beforeEach, describe, expect, it } from 'vitest';
import type { ScoreLayerGroupSnapshot } from '../../shared/project-editor';
import {
  buildSelectionKey,
  flattenVisibleLayers,
} from '../components/workbench/panels/score/layer-selection-utils';
import { useLayerSelectionStore } from '../stores/layer-selection-store';

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
      layerCount: 2,
      isOpenableContainer: false,
      layers: [
        { layerId: 't-0', layerSelectionId: 'sel-t-0', name: 'Track 0', height: 44, items: [] },
        { layerId: 't-1', layerSelectionId: 'sel-t-1', name: 'Track 1', height: 44, items: [] },
      ],
    },
  ];
}

describe('layer-selection-store', () => {
  beforeEach(() => {
    useLayerSelectionStore.getState().clear();
  });

  it('handles single selection and anchor/focus assignment', () => {
    const visible = flattenVisibleLayers(makeMockGroups(), 'scope-1');
    const store = useLayerSelectionStore.getState();

    store.selectSingle('grp-sound:sel-s-1', visible, 'scope-1');
    const state = useLayerSelectionStore.getState();

    expect([...state.selectedKeys]).toEqual(['grp-sound:sel-s-1']);
    expect(state.anchorKey).toBe('grp-sound:sel-s-1');
    expect(state.focusKey).toBe('grp-sound:sel-s-1');
    expect(state.selectedKeys.has('grp-sound:sel-s-1')).toBe(true);
    expect(state.selectedKeys.has('grp-sound:sel-s-0')).toBe(false);
  });

  it('handles extendTo for same-group and cross-group ranges', () => {
    const visible = flattenVisibleLayers(makeMockGroups(), 'scope-1');
    const store = useLayerSelectionStore.getState();

    // Start at Sound 0
    store.selectSingle('grp-sound:sel-s-0', visible, 'scope-1');
    // Extend across into Track 0
    store.extendTo('grp-track:sel-t-0', visible);

    let state = useLayerSelectionStore.getState();
    expect([...state.selectedKeys]).toEqual([
      'grp-sound:sel-s-0',
      'grp-sound:sel-s-1',
      'grp-track:sel-t-0',
    ]);
    expect(state.anchorKey).toBe('grp-sound:sel-s-0');
    expect(state.focusKey).toBe('grp-track:sel-t-0');

    // Extend backwards to Sound 1
    store.extendTo('grp-sound:sel-s-1', visible);
    state = useLayerSelectionStore.getState();
    expect([...state.selectedKeys]).toEqual(['grp-sound:sel-s-0', 'grp-sound:sel-s-1']);
    expect(state.anchorKey).toBe('grp-sound:sel-s-0');
    expect(state.focusKey).toBe('grp-sound:sel-s-1');
  });

  it('navigates with moveFocus with and without extend', () => {
    const visible = flattenVisibleLayers(makeMockGroups(), 'scope-1');
    const store = useLayerSelectionStore.getState();

    // Initial move down with no selection targets index 0 (Sound 0)
    store.moveFocus('down', visible, false);
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-sound:sel-s-0');
    expect([...useLayerSelectionStore.getState().selectedKeys]).toEqual(['grp-sound:sel-s-0']);

    // Move down replaces single selection
    store.moveFocus('down', visible, false);
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-sound:sel-s-1');
    expect([...useLayerSelectionStore.getState().selectedKeys]).toEqual(['grp-sound:sel-s-1']);

    // Move down with extend extends from Sound 1 to Track 0
    store.moveFocus('down', visible, true);
    expect(useLayerSelectionStore.getState().anchorKey).toBe('grp-sound:sel-s-1');
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-track:sel-t-0');
    expect([...useLayerSelectionStore.getState().selectedKeys]).toEqual([
      'grp-sound:sel-s-1',
      'grp-track:sel-t-0',
    ]);

    // Extend further to Track 1
    store.moveFocus('down', visible, true);
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-track:sel-t-1');
    expect([...useLayerSelectionStore.getState().selectedKeys]).toEqual([
      'grp-sound:sel-s-1',
      'grp-track:sel-t-0',
      'grp-track:sel-t-1',
    ]);

    // Clamping at bottom
    store.moveFocus('down', visible, true);
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-track:sel-t-1');

    // Clamping at top
    store.selectSingle('grp-sound:sel-s-0', visible);
    store.moveFocus('up', visible, false);
    expect(useLayerSelectionStore.getState().focusKey).toBe('grp-sound:sel-s-0');
  });

  it('reconciles and clears selection state', () => {
    const visible = flattenVisibleLayers(makeMockGroups(), 'scope-1');
    const store = useLayerSelectionStore.getState();

    store.selectSingle('grp-sound:sel-s-0', visible, 'scope-1');
    store.setKeyboardFocus(true);
    expect(useLayerSelectionStore.getState().keyboardFocus).toBe(true);

    store.clear();
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(0);
    expect(useLayerSelectionStore.getState().anchorKey).toBeNull();
    expect(useLayerSelectionStore.getState().focusKey).toBeNull();
    expect(useLayerSelectionStore.getState().keyboardFocus).toBe(false);
  });
});
