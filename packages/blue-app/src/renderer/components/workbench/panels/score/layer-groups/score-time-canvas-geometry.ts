import type { ScoreObjectEditorTargetSnapshot } from '../../../../../../shared/project-editor';
import {
  DEFAULT_ROW_HEIGHT,
  GROUP_SPACER,
  type PolyObjectLayerGroupSnapshot,
  type ScoreLayerGroupSnapshot,
  type ScoreLayerSnapshot,
  type ScoreRowObjectSnapshot,
} from '../types';

export function argbToRGB(argb: number): number {
  return argb & 0x00ffffff;
}

export function rgbToCSS(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

export function colorToCSS(argb: number): string {
  return rgbToCSS(argbToRGB(argb));
}

export function brighten(rgb: number, factor: number): number {
  const r = Math.min(255, Math.round(((rgb >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((rgb >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((rgb & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export function darken(rgb: number, factor: number): number {
  const r = Math.max(0, Math.round(((rgb >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.round(((rgb >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.round((rgb & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export function textColorForBackground(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return r + g + b > 128 * 3 ? '#000000' : '#ffffff';
}

export function findItemOnLayer(
  layer: ScoreLayerSnapshot,
  xBeats: number,
): ScoreRowObjectSnapshot | null {
  for (let i = layer.items.length - 1; i >= 0; i--) {
    const item = layer.items[i];
    if (xBeats >= item.startBeats && xBeats <= item.startBeats + item.durationBeats) {
      return item;
    }
  }
  return null;
}

export function findLayerAtY(
  layers: ScoreLayerSnapshot[],
  localY: number,
): { layer: ScoreLayerSnapshot; index: number; yOffset: number } | null {
  let yOff = 0;
  for (let i = 0; i < layers.length; i++) {
    const h = layers[i].height || DEFAULT_ROW_HEIGHT;
    if (localY >= yOff && localY < yOff + h) {
      return { layer: layers[i], index: i, yOffset: yOff };
    }
    yOff += h;
  }
  return null;
}

export function buildGlobalLayerData(layerGroups: ScoreLayerGroupSnapshot[]): {
  layerMap: Array<{ groupId: string; localIndex: number; acceptsScoreObject: boolean }>;
  groupStartIndexById: Map<string, number>;
  groupYOffsetById: Map<string, number>;
} {
  const layerMap: Array<{ groupId: string; localIndex: number; acceptsScoreObject: boolean }> = [];
  const groupStartIndexById = new Map<string, number>();
  const groupYOffsetById = new Map<string, number>();

  let yOff = 0;
  for (const group of layerGroups) {
    groupStartIndexById.set(group.groupId, layerMap.length);
    groupYOffsetById.set(group.groupId, yOff);

    const acceptsScoreObject = group.groupType === 'polyObject';
    for (let li = 0; li < group.layers.length; li++) {
      const h = group.layers[li].height || DEFAULT_ROW_HEIGHT;
      layerMap.push({ groupId: group.groupId, localIndex: li, acceptsScoreObject });
      yOff += h;
    }

    yOff += GROUP_SPACER;
  }

  return { layerMap, groupStartIndexById, groupYOffsetById };
}

export function getGlobalLayerIndexForY(layerGroups: ScoreLayerGroupSnapshot[], y: number): number {
  let runningY = 0;
  let runningIndex = 0;
  const totalLayers = layerGroups.reduce((sum, group) => sum + group.layers.length, 0);

  for (const group of layerGroups) {
    for (const layer of group.layers) {
      const h = layer.height || DEFAULT_ROW_HEIGHT;
      if (y <= runningY + h) {
        return runningIndex;
      }
      runningY += h;
      runningIndex += 1;
    }

    if (runningIndex < totalLayers && y <= runningY + GROUP_SPACER) {
      return runningIndex;
    }

    runningY += GROUP_SPACER;
  }

  return Math.max(totalLayers - 1, 0);
}

export function getLayerAdjustBounds(
  layerMap: Array<{ acceptsScoreObject: boolean }>,
  startLayerIndex: number,
): { min: number; max: number } {
  let min = -startLayerIndex;
  for (let i = startLayerIndex - 1; i >= 0; i--) {
    if (layerMap[i].acceptsScoreObject) {
      continue;
    }
    min = i + 1 - startLayerIndex;
    break;
  }

  let max = layerMap.length - 1 - startLayerIndex;
  for (let i = startLayerIndex + 1; i < layerMap.length; i++) {
    if (layerMap[i].acceptsScoreObject) {
      continue;
    }
    max = i - 1 - startLayerIndex;
    break;
  }

  return { min, max };
}

export function collectAllItemSelectionEntries(
  group: PolyObjectLayerGroupSnapshot,
): Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> {
  const entries: Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> = [];
  for (const layer of group.layers) {
    for (const item of layer.items) {
      entries.push({ objectId: item.objectId, editorTarget: item.editorTarget });
    }
  }
  return entries;
}

export function sameLocation(
  a: ScoreObjectEditorTargetSnapshot['location'] | undefined,
  b: ScoreObjectEditorTargetSnapshot['location'] | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.rootGroupIndex !== b.rootGroupIndex) return false;
  if (a.layerIndex !== b.layerIndex || a.objectIndex !== b.objectIndex) return false;
  if (a.containerPath.length !== b.containerPath.length) return false;
  for (let i = 0; i < a.containerPath.length; i++) {
    const segmentA = a.containerPath[i];
    const segmentB = b.containerPath[i];
    if (
      segmentA.layerIndex !== segmentB.layerIndex ||
      segmentA.objectIndex !== segmentB.objectIndex
    ) {
      return false;
    }
  }
  return true;
}

export function sameTarget(
  a: ScoreObjectEditorTargetSnapshot | null | undefined,
  b: ScoreObjectEditorTargetSnapshot | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.selectedObjectType !== b.selectedObjectType || a.editorObjectType !== b.editorObjectType)
    return false;
  if (a.ownerKind !== b.ownerKind) return false;
  if (a.displayContext !== b.displayContext) return false;
  if (sameLocation(a.location, b.location)) return true;
  if (sameLocation(a.sourceInstanceLocation, b.sourceInstanceLocation)) return true;
  if (a.library && b.library) {
    return (
      a.library.libraryId === b.library.libraryId &&
      a.library.libraryIndex === b.library.libraryIndex
    );
  }
  return false;
}
