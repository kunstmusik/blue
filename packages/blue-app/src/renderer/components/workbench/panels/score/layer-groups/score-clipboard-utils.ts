import type { ScoreLayerGroupType, ScoreObjectEditorTargetSnapshot } from '../../../../../../shared/project-editor';
import { getTrackPlacementForSoundObjectType } from '@blue/data';
import type { ScoreObjectClipboardEntry } from '../../../../../stores/score-selection-store';
import type {
  ScoreLayerGroupSnapshot,
  ScoreRowObjectSnapshot,
} from '../types';

export interface ScorePasteObject {
  layerIndex: number;
  groupId: string;
  name: string;
  startBeats: number;
  durationBeats: number;
  startTimeBase?: string;
  durationTimeBase?: string;
  backgroundColor: number;
  objectType: string;
  isContainer: boolean;
  editorTarget?: ScoreObjectEditorTargetSnapshot;
  serializedXml?: string;
  barRenderer?: ScoreRowObjectSnapshot['barRenderer'];
}

export interface TranslatedScorePasteEntry {
  source: ScoreObjectClipboardEntry;
  object: ScorePasteObject;
}

interface FlatLayerRef {
  groupId: string;
  groupType: ScoreLayerGroupType;
  localIndex: number;
}

export function collectClipboardEntriesForSelection(
  groups: ScoreLayerGroupSnapshot[],
  selectedObjectIds: ReadonlySet<string>,
): ScoreObjectClipboardEntry[] {
  const entries: ScoreObjectClipboardEntry[] = [];

  for (const group of groups) {
    group.layers.forEach((layer, layerIndex) => {
      layer.items.forEach((item) => {
        if (!selectedObjectIds.has(item.objectId)) {
          return;
        }

        entries.push({
          objectId: item.objectId,
          objectType: item.objectType,
          name: item.name,
          startBeats: item.startBeats,
          durationBeats: item.durationBeats,
          startTimeBase: item.startTimeBase,
          durationTimeBase: item.durationTimeBase,
          backgroundColor: item.backgroundColor,
          isContainer: item.isContainer,
          layerIndex,
          groupId: group.groupId,
          trackId: group.groupType === 'track' ? layer.layerId : undefined,
          itemId: item.objectId,
          editorTarget: item.editorTarget,
          serializedXml: item.serializedXml,
          barRenderer: item.barRenderer,
        });
      });
    });
  }

  return entries;
}

export function layerGroupAcceptsObjectType(
  groupType: ScoreLayerGroupType,
  objectType: string,
): boolean {
  if (groupType === 'track') {
    return objectType === 'AudioClip' || getTrackPlacementForSoundObjectType(objectType).compatible;
  }
  if (groupType === 'polyObject') {
    return objectType !== 'AudioClip';
  }
  return false;
}

function flattenLayers(groups: ScoreLayerGroupSnapshot[]): FlatLayerRef[] {
  const layers: FlatLayerRef[] = [];
  for (const group of groups) {
    for (let localIndex = 0; localIndex < group.layers.length; localIndex += 1) {
      layers.push({
        groupId: group.groupId,
        groupType: group.groupType,
        localIndex,
      });
    }
  }
  return layers;
}

function findGlobalLayerIndex(
  layers: FlatLayerRef[],
  groupId: string,
  localIndex: number,
): number {
  return layers.findIndex((layer) => layer.groupId === groupId && layer.localIndex === localIndex);
}

function findSourceGlobalLayerIndex(
  layers: FlatLayerRef[],
  entry: ScoreObjectClipboardEntry,
): number {
  const byGroup = findGlobalLayerIndex(layers, entry.groupId, entry.layerIndex);
  if (byGroup >= 0) {
    return byGroup;
  }
  return entry.layerIndex >= 0 && entry.layerIndex < layers.length ? entry.layerIndex : -1;
}

export function translateClipboardEntriesForPaste(args: {
  clipboard: ScoreObjectClipboardEntry[];
  layerGroups: ScoreLayerGroupSnapshot[];
  targetGroupId: string;
  targetLayerIndex: number;
  targetXBeats: number;
  snapBeatValue: (beats: number) => number;
}): { ok: true; entries: TranslatedScorePasteEntry[] } | { ok: false; message: string } {
  const {
    clipboard,
    layerGroups,
    targetGroupId,
    targetLayerIndex,
    targetXBeats,
    snapBeatValue,
  } = args;

  if (clipboard.length === 0) {
    return { ok: false, message: 'Nothing to paste.' };
  }

  const flatLayers = flattenLayers(layerGroups);
  const targetGlobalLayerIndex = findGlobalLayerIndex(flatLayers, targetGroupId, targetLayerIndex);
  if (targetGlobalLayerIndex < 0) {
    return { ok: false, message: 'Paste target layer was not found.' };
  }

  const sourceGlobalLayerIndices: number[] = [];
  for (const entry of clipboard) {
    const globalIndex = findSourceGlobalLayerIndex(flatLayers, entry);
    if (globalIndex < 0) {
      return { ok: false, message: 'Unable to paste from this copy buffer in the current score view.' };
    }
    sourceGlobalLayerIndices.push(globalIndex);
  }

  const minSourceLayerIndex = Math.min(...sourceGlobalLayerIndices);
  const maxSourceLayerIndex = Math.max(...sourceGlobalLayerIndices);
  const layerTranslation = targetGlobalLayerIndex - minSourceLayerIndex;
  if (maxSourceLayerIndex + layerTranslation >= flatLayers.length) {
    return { ok: false, message: 'Not enough layers to paste.' };
  }
  if (minSourceLayerIndex + layerTranslation < 0) {
    return { ok: false, message: 'Not enough layers to paste.' };
  }

  const minStartBeats = Math.min(...clipboard.map((entry) => entry.startBeats));
  const startOffsetBeats = snapBeatValue(targetXBeats) - minStartBeats;
  const entries: TranslatedScorePasteEntry[] = [];

  for (let index = 0; index < clipboard.length; index += 1) {
    const source = clipboard[index]!;
    const targetLayer = flatLayers[sourceGlobalLayerIndices[index]! + layerTranslation];
    if (!targetLayer) {
      return { ok: false, message: 'Not enough layers to paste.' };
    }
    if (!layerGroupAcceptsObjectType(targetLayer.groupType, source.objectType)) {
      return {
        ok: false,
        message: 'Unable to paste because one or more target layers do not accept the copied object types.',
      };
    }

    entries.push({
      source,
      object: {
        layerIndex: targetLayer.localIndex,
        groupId: targetLayer.groupId,
        name: source.name,
        startBeats: source.startBeats + startOffsetBeats,
        durationBeats: source.durationBeats,
        startTimeBase: source.startTimeBase,
        durationTimeBase: source.durationTimeBase,
        backgroundColor: source.backgroundColor,
        objectType: source.objectType,
        isContainer: source.isContainer,
        editorTarget: source.editorTarget,
        serializedXml: source.serializedXml,
        barRenderer: source.barRenderer,
      },
    });
  }

  return { ok: true, entries };
}

export function groupPasteObjectsByTargetGroup(objects: ScorePasteObject[]): ScorePasteObject[][] {
  const grouped = new Map<string, ScorePasteObject[]>();
  for (const object of objects) {
    const group = grouped.get(object.groupId);
    if (group) {
      group.push(object);
    } else {
      grouped.set(object.groupId, [object]);
    }
  }
  return [...grouped.values()];
}
