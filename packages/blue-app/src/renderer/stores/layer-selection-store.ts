import { create } from 'zustand';
import {
  buildSelectionKey,
  deriveSelectedLayerRanges,
  getInclusiveGlobalRange,
  reconcileSelectionState,
  type LayerSelectionSnapshotState,
  type SelectedLayerRange,
  type VisibleLayerRef,
} from '../components/workbench/panels/score/layer-selection-utils';

export interface LayerSelectionState extends LayerSelectionSnapshotState {
  keyboardFocus: boolean;

  selectSingle: (targetKey: string, visibleLayers: VisibleLayerRef[], scopeKey?: string) => void;
  extendTo: (targetKey: string, visibleLayers: VisibleLayerRef[], scopeKey?: string) => void;
  moveFocus: (
    direction: 'up' | 'down',
    visibleLayers: VisibleLayerRef[],
    extend: boolean,
    scopeKey?: string,
  ) => void;
  clear: () => void;
  reconcile: (scopeKey: string, visibleLayers: VisibleLayerRef[]) => void;
  setKeyboardFocus: (keyboardFocus: boolean) => void;
  getSelectedRanges: (visibleLayers: VisibleLayerRef[]) => SelectedLayerRange[];
}

export const useLayerSelectionStore = create<LayerSelectionState>((set, get) => ({
  scopeKey: null,
  selectedKeys: new Set<string>(),
  anchorKey: null,
  focusKey: null,
  keyboardFocus: false,

  selectSingle: (targetKey, visibleLayers, scopeKey) => {
    const activeScope = scopeKey ?? get().scopeKey;
    const targetLayer = visibleLayers.find(
      (l) => buildSelectionKey(l.groupId, l.layerSelectionId) === targetKey,
    );
    if (!targetLayer) {
      return;
    }
    set({
      scopeKey: activeScope,
      selectedKeys: new Set([targetKey]),
      anchorKey: targetKey,
      focusKey: targetKey,
    });
  },

  extendTo: (targetKey, visibleLayers, scopeKey) => {
    const state = get();
    const activeScope = scopeKey ?? state.scopeKey;
    const targetLayer = visibleLayers.find(
      (l) => buildSelectionKey(l.groupId, l.layerSelectionId) === targetKey,
    );
    if (!targetLayer) {
      return;
    }

    if (!state.anchorKey) {
      get().selectSingle(targetKey, visibleLayers, activeScope);
      return;
    }

    const range = getInclusiveGlobalRange(visibleLayers, state.anchorKey, targetKey);
    const selectedKeys = new Set(
      range.map((l) => buildSelectionKey(l.groupId, l.layerSelectionId)),
    );

    set({
      scopeKey: activeScope,
      selectedKeys,
      focusKey: targetKey,
    });
  },

  moveFocus: (direction, visibleLayers, extend, scopeKey) => {
    if (visibleLayers.length === 0) return;

    const state = get();
    const currentKey = state.focusKey ?? state.anchorKey;
    const currentIdx = currentKey
      ? visibleLayers.findIndex(
          (l) => buildSelectionKey(l.groupId, l.layerSelectionId) === currentKey,
        )
      : -1;

    let nextIdx: number;
    if (currentIdx === -1) {
      nextIdx = direction === 'down' ? 0 : visibleLayers.length - 1;
    } else {
      nextIdx =
        direction === 'up'
          ? Math.max(0, currentIdx - 1)
          : Math.min(visibleLayers.length - 1, currentIdx + 1);
    }

    const target = visibleLayers[nextIdx];
    if (!target) return;
    const targetKey = buildSelectionKey(target.groupId, target.layerSelectionId);

    if (extend) {
      get().extendTo(targetKey, visibleLayers, scopeKey);
    } else {
      get().selectSingle(targetKey, visibleLayers, scopeKey);
    }
  },

  clear: () => {
    set({
      selectedKeys: new Set<string>(),
      anchorKey: null,
      focusKey: null,
      keyboardFocus: false,
    });
  },

  reconcile: (scopeKey, visibleLayers) => {
    const current = get();
    const reconciled = reconcileSelectionState(current, scopeKey, visibleLayers);
    set({
      ...reconciled,
    });
  },

  setKeyboardFocus: (keyboardFocus) => {
    set({ keyboardFocus });
  },

  getSelectedRanges: (visibleLayers) => {
    return deriveSelectedLayerRanges(visibleLayers, get().selectedKeys);
  },
}));
