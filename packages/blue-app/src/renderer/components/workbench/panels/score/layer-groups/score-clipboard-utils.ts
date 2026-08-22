import type { ScoreLayerGroupType, ScoreObjectEditorTargetSnapshot } from '../../../../../../shared/project-editor';
import {
  getTrackPlacementForSoundObjectType,
  PolyObject,
  loadSoundObjectFromXML,
  createSoundObject,
  Element,
  TimePosition,
  TimeBase,
  TimeContext,
  TimeDuration,
  SoundObject,
  beatsToDuration,
} from '@blue/data';
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

export function createPolyObjectPasteObjectFromClipboard(args: {
  clipboard: ScoreObjectClipboardEntry[];
  layerGroups: ScoreLayerGroupSnapshot[];
  targetGroupId: string;
  targetLayerIndex: number;
  targetXBeats: number;
  snapBeatValue: (beats: number) => number;
}): { ok: true; pasteObject: ScorePasteObject } | { ok: false; message: string } {
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

  if (clipboard.some((entry) => entry.objectType === 'AudioClip')) {
    return { ok: false, message: 'Unable to paste AudioClips as a PolyObject.' };
  }

  const flatLayers = flattenLayers(layerGroups);
  const targetGlobalLayerIndex = findGlobalLayerIndex(flatLayers, targetGroupId, targetLayerIndex);
  if (targetGlobalLayerIndex < 0) {
    return { ok: false, message: 'Paste target layer was not found.' };
  }

  const targetGroup = layerGroups.find((group) => group.groupId === targetGroupId);
  if (!targetGroup || targetGroup.groupType !== 'polyObject') {
    return { ok: false, message: 'PolyObject paste requires a SoundObject layer.' };
  }

  const soundObjectEntries = clipboard;
  const sourceGlobalIndices: number[] = [];
  for (const entry of soundObjectEntries) {
    const globalIdx = findSourceGlobalLayerIndex(flatLayers, entry);
    if (globalIdx < 0) {
      return { ok: false, message: 'Unable to paste from this copy buffer in the current score view.' };
    }
    sourceGlobalIndices.push(globalIdx);
  }

  const minLayer = Math.min(...sourceGlobalIndices);
  const maxLayer = Math.max(...sourceGlobalIndices);
  const numLayers = maxLayer - minLayer + 1;

  const pObj = new PolyObject(false);
  pObj.setName('polyObject');
  for (let i = 0; i < numLayers; i += 1) {
    pObj.newLayerAt(-1);
  }

  const context = new TimeContext();
  let envelopeStartBeats = Infinity;
  let envelopeEndBeats = -Infinity;

  for (let i = 0; i < soundObjectEntries.length; i += 1) {
    const entry = soundObjectEntries[i]!;
    const layerIdx = sourceGlobalIndices[i]! - minLayer;
    if (!Number.isFinite(entry.startBeats) || !Number.isFinite(entry.durationBeats)) {
      return { ok: false, message: 'Unable to paste an object with invalid timing.' };
    }
    envelopeStartBeats = Math.min(envelopeStartBeats, entry.startBeats);
    envelopeEndBeats = Math.max(envelopeEndBeats, entry.startBeats + Math.max(0, entry.durationBeats));

    let sObj: SoundObject | null = null;
    let loadedFromXml = false;
    if (entry.serializedXml) {
      try {
        const parsed = Element.parse(entry.serializedXml);
        sObj = loadSoundObjectFromXML(parsed)?.deepCopy() ?? null;
        loadedFromXml = sObj !== null;
      } catch {
        sObj = null;
      }
    }

    if (!sObj) {
      sObj = createSoundObject(entry.objectType);
    }

    if (!sObj) {
      return { ok: false, message: `Unable to load ${entry.objectType} from the copy buffer.` };
    }

    sObj.setName(entry.name);
    sObj.setStartTime(TimePosition.beats(entry.startBeats));
    if (!loadedFromXml) {
      const durationTimeBase = Object.values(TimeBase).includes(entry.durationTimeBase as TimeBase)
        ? entry.durationTimeBase as TimeBase
        : TimeBase.BEATS;
      if (durationTimeBase !== TimeBase.BEATS) {
        return {
          ok: false,
          message: `Unable to preserve ${entry.objectType}'s ${durationTimeBase} duration without serialized data.`,
        };
      }
      sObj.setSubjectiveDuration(beatsToDuration(entry.durationBeats, durationTimeBase, context));
    }
    sObj.setBackgroundColor(entry.backgroundColor);
    pObj[layerIdx].push(sObj);
  }

  pObj.normalizeSoundObjects(context);
  pObj.setSubjectiveDuration(
    TimeDuration.beats(Math.max(0, envelopeEndBeats - envelopeStartBeats)),
  );
  const startBeats = snapBeatValue(targetXBeats);

  return {
    ok: true,
    pasteObject: {
      layerIndex: targetLayerIndex,
      groupId: targetGroupId,
      name: 'polyObject',
      startBeats,
      durationBeats: pObj.getSubjectiveDuration().toBeats(context),
      backgroundColor: pObj.getBackgroundColor(),
      objectType: 'PolyObject',
      isContainer: true,
      serializedXml: pObj.saveAsXML().toXml(),
    },
  };
}
