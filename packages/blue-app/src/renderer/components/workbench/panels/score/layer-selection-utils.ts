import type {
  ScoreLayerGroupSnapshot,
  ScoreLayerGroupType,
  ScoreLayerSnapshot,
  ScorePatch,
} from '../../../../../shared/project-editor';

export interface VisibleLayerRef {
  scopeKey: string;
  groupId: string;
  groupType: ScoreLayerGroupType;
  layerSelectionId: string;
  layerId: string;
  localIndex: number;
  globalIndex: number;
  layer: ScoreLayerSnapshot;
}

export interface SelectedLayerRange {
  groupId: string;
  groupType: ScoreLayerGroupType;
  startIndex: number;
  endIndex: number;
  layerSelectionIds: string[];
  count: number;
}

export type PushDisabledReason =
  | 'no-selection'
  | 'selection-spans-groups'
  | 'selection-is-not-contiguous'
  | 'at-group-start'
  | 'at-group-end';

export interface LayerOperationAvailability {
  canAdd: boolean;
  canPushUp: boolean;
  pushUpDisabledReason?: PushDisabledReason;
  canPushDown: boolean;
  pushDownDisabledReason?: PushDisabledReason;
  canRemove: boolean;
  removeDisabledReason?: 'no-selection';
}

export interface LayerRemovalPlan {
  ranges: SelectedLayerRange[];
  totalLayerCount: number;
  emptyGroupIds: string[];
  deleteEmptyLayerGroups: boolean;
}

export interface LayerSelectionSnapshotState {
  scopeKey: string | null;
  selectedKeys: Set<string>;
  anchorKey: string | null;
  focusKey: string | null;
}

export function getLayerSelectionId(layer: ScoreLayerSnapshot): string {
  return layer.layerSelectionId ?? layer.layerId;
}

export function buildSelectionKey(groupId: string, layerSelectionId: string): string {
  return `${groupId}:${layerSelectionId}`;
}

export function parseSelectionKey(key: string): { groupId: string; layerSelectionId: string } | null {
  const index = key.indexOf(':');
  if (index === -1) return null;
  return {
    groupId: key.slice(0, index),
    layerSelectionId: key.slice(index + 1),
  };
}

export function flattenVisibleLayers(
  layerGroups: ScoreLayerGroupSnapshot[],
  scopeKey: string,
): VisibleLayerRef[] {
  const result: VisibleLayerRef[] = [];
  let globalIndex = 0;

  for (const group of layerGroups) {
    if (!group || !Array.isArray(group.layers)) continue;
    for (let localIndex = 0; localIndex < group.layers.length; localIndex++) {
      const layer = group.layers[localIndex];
      if (!layer) continue;
      const layerSelectionId = getLayerSelectionId(layer);
      result.push({
        scopeKey,
        groupId: group.groupId,
        groupType: group.groupType,
        layerSelectionId,
        layerId: layer.layerId,
        localIndex,
        globalIndex: globalIndex++,
        layer,
      });
    }
  }

  return result;
}

export function getInclusiveGlobalRange(
  visibleLayers: VisibleLayerRef[],
  anchorKey: string,
  targetKey: string,
): VisibleLayerRef[] {
  const anchorIdx = visibleLayers.findIndex(
    (l) => buildSelectionKey(l.groupId, l.layerSelectionId) === anchorKey,
  );
  const targetIdx = visibleLayers.findIndex(
    (l) => buildSelectionKey(l.groupId, l.layerSelectionId) === targetKey,
  );

  if (targetIdx === -1) {
    return [];
  }
  if (anchorIdx === -1) {
    return [visibleLayers[targetIdx]];
  }

  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  return visibleLayers.slice(start, end + 1);
}

export function deriveSelectedLayerRanges(
  visibleLayers: VisibleLayerRef[],
  selectedKeys: Set<string>,
): SelectedLayerRange[] {
  if (!visibleLayers || visibleLayers.length === 0 || !selectedKeys || selectedKeys.size === 0) {
    return [];
  }

  const selectedRefs = visibleLayers.filter((l) =>
    selectedKeys.has(buildSelectionKey(l.groupId, l.layerSelectionId)),
  );

  if (selectedRefs.length === 0) {
    return [];
  }

  const ranges: SelectedLayerRange[] = [];
  let current: SelectedLayerRange | null = null;

  const flush = () => {
    if (current) ranges.push(current);
    current = null;
  };

  for (const ref of selectedRefs) {
    const startsNewRange = !current
      || current.groupId !== ref.groupId
      || ref.localIndex !== current.endIndex + 1;
    if (startsNewRange) {
      flush();
      current = {
        groupId: ref.groupId,
        groupType: ref.groupType,
        startIndex: ref.localIndex,
        endIndex: ref.localIndex,
        layerSelectionIds: [ref.layerSelectionId],
        count: 1,
      };
      continue;
    }

    current.endIndex = ref.localIndex;
    current.layerSelectionIds.push(ref.layerSelectionId);
    current.count += 1;
  }

  flush();
  return ranges;
}

export function getLayerOperationAvailability(
  layerGroups: ScoreLayerGroupSnapshot[],
  ranges: SelectedLayerRange[],
): LayerOperationAvailability {
  const totalSelectedLayers = ranges.reduce((acc, r) => acc + r.count, 0);

  if (totalSelectedLayers === 0 || ranges.length === 0) {
    return {
      canAdd: false,
      canPushUp: false,
      pushUpDisabledReason: 'no-selection',
      canPushDown: false,
      pushDownDisabledReason: 'no-selection',
      canRemove: false,
      removeDisabledReason: 'no-selection',
    };
  }

  const canAdd = totalSelectedLayers === 1;
  const canRemove = totalSelectedLayers > 0;

  const selectedGroupIds = new Set(ranges.map((range) => range.groupId));
  if (selectedGroupIds.size > 1) {
    return {
      canAdd,
      canPushUp: false,
      pushUpDisabledReason: 'selection-spans-groups',
      canPushDown: false,
      pushDownDisabledReason: 'selection-spans-groups',
      canRemove,
    };
  }

  if (ranges.length > 1) {
    return {
      canAdd,
      canPushUp: false,
      pushUpDisabledReason: 'selection-is-not-contiguous',
      canPushDown: false,
      pushDownDisabledReason: 'selection-is-not-contiguous',
      canRemove,
    };
  }

  const singleRange = ranges[0];
  const group = layerGroups.find((g) => g.groupId === singleRange.groupId);
  const layerCount = group?.layers.length ?? group?.layerCount ?? 0;

  const atStart = singleRange.startIndex <= 0;
  const atEnd = singleRange.endIndex >= layerCount - 1;

  return {
    canAdd,
    canPushUp: !atStart,
    pushUpDisabledReason: atStart ? 'at-group-start' : undefined,
    canPushDown: !atEnd,
    pushDownDisabledReason: atEnd ? 'at-group-end' : undefined,
    canRemove,
  };
}

export function buildLayerRemovalPlan(
  layerGroups: ScoreLayerGroupSnapshot[],
  ranges: SelectedLayerRange[],
): LayerRemovalPlan {
  const totalLayerCount = ranges.reduce((acc, r) => acc + r.count, 0);
  const emptyGroupIds: string[] = [];

  const selectedCountByGroup = new Map<string, number>();
  for (const range of ranges) {
    selectedCountByGroup.set(
      range.groupId,
      (selectedCountByGroup.get(range.groupId) ?? 0) + range.count,
    );
  }

  for (const [groupId, selectedCount] of selectedCountByGroup) {
    const group = layerGroups.find((g) => g.groupId === groupId);
    const layerCount = group?.layers.length ?? group?.layerCount ?? 0;
    if (selectedCount >= layerCount && layerCount > 0) {
      emptyGroupIds.push(groupId);
    }
  }

  return {
    ranges,
    totalLayerCount,
    emptyGroupIds,
    deleteEmptyLayerGroups: emptyGroupIds.length > 0,
  };
}

export function createMoveLayerRangePatch(
  range: SelectedLayerRange,
  targetIndex: number,
): Extract<ScorePatch, { type: 'moveLayerRange' }> {
  return {
    type: 'moveLayerRange',
    groupId: range.groupId,
    startIndex: range.startIndex,
    endIndex: range.endIndex,
    targetIndex,
  };
}

export function createRemoveLayerRangesPatch(
  plan: LayerRemovalPlan,
  deleteEmptyLayerGroups: boolean,
): Extract<ScorePatch, { type: 'removeLayerRanges' }> {
  return {
    type: 'removeLayerRanges',
    ranges: plan.ranges.map(({ groupId, startIndex, endIndex }) => ({
      groupId,
      startIndex,
      endIndex,
    })),
    deleteEmptyLayerGroups,
  };
}

export function getPushDisabledReasonLabel(reason: PushDisabledReason | undefined): string | undefined {
  switch (reason) {
    case 'no-selection':
      return 'Select a layer first';
    case 'selection-spans-groups':
      return 'Push is unavailable for selections spanning layer groups';
    case 'selection-is-not-contiguous':
      return 'Push requires one contiguous block';
    case 'at-group-start':
      return 'The selected block is already at the start of its group';
    case 'at-group-end':
      return 'The selected block is already at the end of its group';
    default:
      return undefined;
  }
}

export function reconcileSelectionState(
  currentState: LayerSelectionSnapshotState,
  currentScopeKey: string,
  visibleLayers: VisibleLayerRef[],
): LayerSelectionSnapshotState {
  if (currentState.scopeKey !== currentScopeKey) {
    return {
      scopeKey: currentScopeKey,
      selectedKeys: new Set(),
      anchorKey: null,
      focusKey: null,
    };
  }

  const validKeySet = new Set(
    visibleLayers.map((l) => buildSelectionKey(l.groupId, l.layerSelectionId)),
  );

  const nextSelectedKeys = new Set<string>();
  for (const k of currentState.selectedKeys) {
    if (validKeySet.has(k)) {
      nextSelectedKeys.add(k);
    }
  }

  if (nextSelectedKeys.size === 0) {
    return {
      scopeKey: currentScopeKey,
      selectedKeys: nextSelectedKeys,
      anchorKey: null,
      focusKey: null,
    };
  }

  let anchorKey = currentState.anchorKey;
  if (!anchorKey || !nextSelectedKeys.has(anchorKey)) {
    anchorKey = nextSelectedKeys.values().next().value ?? null;
  }

  let focusKey = currentState.focusKey;
  if (!focusKey || !nextSelectedKeys.has(focusKey)) {
    focusKey = anchorKey;
  }

  return {
    scopeKey: currentScopeKey,
    selectedKeys: nextSelectedKeys,
    anchorKey,
    focusKey,
  };
}
