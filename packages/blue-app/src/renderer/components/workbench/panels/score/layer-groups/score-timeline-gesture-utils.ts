import type {
  ScoreLayerGroupSnapshot,
  ScoreLayerSnapshot,
  ScoreRowObjectSnapshot,
} from '../types';

export interface TimelineGlobalLayer {
  groupId: string;
  groupType: ScoreLayerGroupSnapshot['groupType'];
  localIndex: number;
}

export interface TimelineGlobalLayerData {
  layerMap: TimelineGlobalLayer[];
  groupStartIndexById: Map<string, number>;
  groupYOffsetById: Map<string, number>;
}

export interface TimelineHit {
  item: ScoreRowObjectSnapshot;
  itemIndex: number;
  layer: ScoreLayerSnapshot;
  layerIndex: number;
  layerTop: number;
}

export function findTimelineLayerAtY(
  layers: ScoreLayerSnapshot[],
  localY: number,
  defaultRowHeight: number,
): { layer: ScoreLayerSnapshot; layerIndex: number; layerTop: number } | null {
  let layerTop = 0;
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex]!;
    const height = layer.height || defaultRowHeight;
    if (localY >= layerTop && localY < layerTop + height) {
      return { layer, layerIndex, layerTop };
    }
    layerTop += height;
  }
  return null;
}

export function findTimelineItemAtX(
  layer: ScoreLayerSnapshot,
  xBeats: number,
  pixelsPerBeat: number,
): { item: ScoreRowObjectSnapshot; itemIndex: number } | null {
  const minimumHitBeats = 4 / Math.max(pixelsPerBeat, 1);
  for (let itemIndex = layer.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
    const item = layer.items[itemIndex]!;
    const end = item.startBeats + Math.max(item.durationBeats, minimumHitBeats);
    if (xBeats >= item.startBeats && xBeats <= end) {
      return { item, itemIndex };
    }
  }
  return null;
}

export function findTimelineHit(
  layers: ScoreLayerSnapshot[],
  xBeats: number,
  localY: number,
  pixelsPerBeat: number,
  defaultRowHeight: number,
): TimelineHit | null {
  const layerHit = findTimelineLayerAtY(layers, localY, defaultRowHeight);
  if (!layerHit) return null;
  const itemHit = findTimelineItemAtX(layerHit.layer, xBeats, pixelsPerBeat);
  if (!itemHit) return null;
  return { ...layerHit, ...itemHit };
}

export function selectionIntersectsTimelineItem(
  item: ScoreRowObjectSnapshot,
  itemLayerTop: number,
  itemLayerHeight: number,
  selection: { left: number; right: number; top: number; bottom: number },
): boolean {
  const itemLeft = item.startBeats;
  const itemRight = item.startBeats + Math.max(item.durationBeats, 0);
  return itemRight >= selection.left
    && itemLeft <= selection.right
    && itemLayerTop + itemLayerHeight >= selection.top
    && itemLayerTop <= selection.bottom;
}

export function snapTimelineBeat(
  beats: number,
  snapEnabled: boolean,
  snapBeats: number,
  mode: 'floor' | 'nearest',
): number {
  if (!snapEnabled || snapBeats <= 0) return beats;
  const scaled = beats / snapBeats;
  const snapped = mode === 'floor' ? Math.floor(scaled) : Math.round(scaled);
  return snapped * snapBeats;
}

export function timelinePointerDeltaBeats(
  currentLocalX: number,
  startBeats: number,
  pixelsPerBeat: number,
): number {
  return currentLocalX / pixelsPerBeat - startBeats;
}

export function buildTimelineGlobalLayerData(
  layerGroups: ScoreLayerGroupSnapshot[],
  defaultRowHeight: number,
  groupSpacer: number,
): TimelineGlobalLayerData {
  const layerMap: TimelineGlobalLayer[] = [];
  const groupStartIndexById = new Map<string, number>();
  const groupYOffsetById = new Map<string, number>();
  let yOffset = 0;

  for (const group of layerGroups) {
    groupStartIndexById.set(group.groupId, layerMap.length);
    groupYOffsetById.set(group.groupId, yOffset);
    for (let localIndex = 0; localIndex < group.layers.length; localIndex += 1) {
      layerMap.push({ groupId: group.groupId, groupType: group.groupType, localIndex });
      yOffset += group.layers[localIndex]!.height || defaultRowHeight;
    }
    yOffset += groupSpacer;
  }

  return { layerMap, groupStartIndexById, groupYOffsetById };
}

export function findTimelineGlobalLayerAtY(
  layerGroups: ScoreLayerGroupSnapshot[],
  globalY: number,
  defaultRowHeight: number,
  groupSpacer: number,
): number {
  const totalLayers = layerGroups.reduce((sum, group) => sum + group.layers.length, 0);
  let runningY = 0;
  let globalLayerIndex = 0;

  for (const group of layerGroups) {
    for (const layer of group.layers) {
      const height = layer.height || defaultRowHeight;
      if (globalY <= runningY + height) return globalLayerIndex;
      runningY += height;
      globalLayerIndex += 1;
    }
    if (globalLayerIndex < totalLayers && globalY <= runningY + groupSpacer) {
      return globalLayerIndex;
    }
    runningY += groupSpacer;
  }

  return Math.max(totalLayers - 1, 0);
}

export function getTimelineLayerAdjustBounds(
  layerMap: TimelineGlobalLayer[],
  objectType: string,
  startLayerIndex: number,
  accepts: (groupType: ScoreLayerGroupSnapshot['groupType'], objectType: string) => boolean,
): { min: number; max: number } {
  let min = -startLayerIndex;
  for (let index = startLayerIndex - 1; index >= 0; index -= 1) {
    if (accepts(layerMap[index]!.groupType, objectType)) continue;
    min = index + 1 - startLayerIndex;
    break;
  }

  let max = layerMap.length - 1 - startLayerIndex;
  for (let index = startLayerIndex + 1; index < layerMap.length; index += 1) {
    if (accepts(layerMap[index]!.groupType, objectType)) continue;
    max = index - 1 - startLayerIndex;
    break;
  }

  return { min, max };
}

export function collectTimelineLayerSelection(
  layer: ScoreLayerSnapshot,
): Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> {
  return layer.items.map((item) => ({ objectId: item.objectId, editorTarget: item.editorTarget }));
}

export function collectTimelineBoundarySelection(
  groups: ScoreLayerGroupSnapshot[],
  beats: number,
  mode: 'before' | 'after',
): Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> {
  const entries: Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> = [];
  for (const group of groups) {
    for (const layer of group.layers) {
      for (const item of layer.items) {
        const include = mode === 'before'
          ? item.startBeats + item.durationBeats <= beats
          : item.startBeats >= beats;
        if (include) entries.push({ objectId: item.objectId, editorTarget: item.editorTarget });
      }
    }
  }
  return entries;
}
