import {
  BlueData,
  CompileData,
  Element,
  Score,
  type Layer,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  TimeBase,
  isTrackLayerMuteSoloMode,
  SoundObject,
  collectInstanceSoundObjects,
  Instance,
  AbstractSoundObject,
  NoteProcessorChain,
  AudioClip,
  ObjRefLoadMap,
  GenericScore,
  PythonObject,
  External,
  createSoundObject,
  loadSoundObjectFromXML,
  beatsToTimePosition,
  beatsToDuration,
  ObjectBuilder,
  getNotes as parseScoreNotes,
  getTotalDuration,
  reifyChainFromSnapshot,
  isValidLayerColorInput,
  normalizeLayerColor,
  LAYER_HEIGHT_MIN,
  LAYER_HEIGHT_MAX,
  SOUND_LAYER_MAX_HEIGHT_INDEX,
  TRACK_MAX_HEIGHT_INDEX,
  resolveGroupDefaultHeight,
} from '@blue/data';
import type { NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot } from '@blue/data';

import type {
  ScoreLayerGroupType,
  ScoreObjectLocationRef,
  ScoreObjectEditorTargetSnapshot,
  ScorePatch,
  ProjectDocumentPatchContext,
} from './contract';
import {
  isValidLayerRange,
  isValidLayerRangeTarget,
  areLayerRangesValid,
  SetLayerHeightsPatch,
  SetLayerGroupDefaultHeightPatch,
} from './contract';
import {
  assignExplicitScoreObjectId,
  assignLayerGroupId,
  assignLayerSelectionId,
  assignPatternLayerId,
  assignScoreObjectId,
  recordScoreObjectIdForData,
  getLayerSelectionId,
  getScoreObjectId,
  appendMarkerSnapshotId,
  removeMarkerSnapshotId,
} from './identity';
import {
  recordExistingScoreObjectIds,
  resolveEditorTarget,
  resolveTimelineTargetWithSelectionId,
  type ScoreLookupCache,
} from './snapshot-score';

import {
  applyScoreTimeStatePatch,
  isNonEmptyScorePatch,
  scorePatchTouchesMixerAudioChannels,
  applyTempoMapPatch,
  applyMeterMapPatch,
} from './patch-score-time';
import { applyScoreAutomationPatch } from './patch-score-automation';
import {
  type ManagedLayerGroup,
  getManagedLayerGroupId,
  isManagedLayerGroup,
  findLayerGroupByGroupId,
  isLayerStateManagedLayer,
  isColorManaged,
  isTrackScorePatch,
  applyTrackScorePatch,
  applyConvertToPolyObjectPatch,
  applyUpdatePatternCellsPatch,
  applyUpdatePatternBeatsLengthPatch,
  isScoreColorPatchAccepted,
  applySetScoreObjectBackgroundColorsPatch,
  type ScoreObjectLeafPatch,
  isScoreObjectLeafPatch,
  applyScoreObjectLeafPatch,
} from './patch-score-objects';

export {
  applyScoreTimeStatePatch,
  isNonEmptyScorePatch,
  scorePatchTouchesMixerAudioChannels,
  applyTempoMapPatch,
  applyMeterMapPatch,
  isScoreColorPatchAccepted,
  type ScoreObjectLeafPatch,
  isScoreObjectLeafPatch,
  applyScoreObjectLeafPatch,
};

function findPolyObjectByGroupId(score: Score, groupId: string): PolyObject | null {
  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (lg instanceof PolyObject) {
      if (assignLayerGroupId(lg) === groupId) return lg;
      const found = findPolyObjectByGroupIdRecursive(lg, groupId);
      if (found) return found;
    }
  }
  return null;
}

function findPolyObjectByGroupIdRecursive(pObj: PolyObject, groupId: string): PolyObject | null {
  for (const layer of pObj) {
    for (const sObj of layer) {
      if (sObj instanceof PolyObject) {
        if (assignLayerGroupId(sObj) === groupId) return sObj;
        const found = findPolyObjectByGroupIdRecursive(sObj, groupId);
        if (found) return found;
      }
    }
  }
  return null;
}

function createManagedLayerGroup(
  groupType: ScoreLayerGroupType | undefined,
  defaultLayerGroupType: 'TRACK' | 'SOUND_OBJECT' = 'TRACK',
): ManagedLayerGroup {
  const effectiveGroupType =
    groupType ?? (defaultLayerGroupType === 'SOUND_OBJECT' ? 'polyObject' : 'track');
  switch (effectiveGroupType) {
    case 'track': {
      const group = new TrackLayerGroup();
      group.newLayerAt(0);
      return group;
    }
    case 'patterns': {
      const group = new PatternsLayerGroup();
      group.newLayerAt(0);
      return group;
    }
    case 'polyObject':
    default: {
      const group = new PolyObject(true);
      group.newLayerAt(0);
      return group;
    }
  }
}

interface ManagedLayerGroupLocation {
  group: ManagedLayerGroup;
  parent: unknown[];
  index: number;
  depth: number;
}

function collectManagedLayerGroupLocations(score: Score): ManagedLayerGroupLocation[] {
  const locations: ManagedLayerGroupLocation[] = [];
  const visited = new Set<ManagedLayerGroup>();

  const visit = (
    group: ManagedLayerGroup,
    parent: unknown[],
    index: number,
    depth: number,
  ): void => {
    if (visited.has(group)) return;
    visited.add(group);
    locations.push({ group, parent, index, depth });

    if (!(group instanceof PolyObject)) return;
    for (const layer of group) {
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex++) {
        const soundObject = layer[objectIndex];
        if (soundObject instanceof PolyObject) {
          visit(soundObject, layer, objectIndex, depth + 1);
        }
      }
    }
  };

  for (let index = 0; index < score.length; index++) {
    const group = score[index];
    if (isManagedLayerGroup(group)) {
      visit(group, score, index, 0);
    }
  }

  return locations;
}

function findRootLayerGroupIndexByGroupId(score: Score, groupId: string): number {
  for (let i = 0; i < score.length; i++) {
    const lg = score[i];
    if (isManagedLayerGroup(lg) && getManagedLayerGroupId(lg) === groupId) {
      return i;
    }
  }
  return -1;
}

function moveLayerRangeInTypedGroup<T>(
  group: T[],
  startIndex: number,
  endIndex: number,
  targetIndex: number,
): boolean {
  if (startIndex === targetIndex) return false;

  const count = endIndex - startIndex + 1;
  const layers = group.splice(startIndex, count);
  group.splice(targetIndex, 0, ...layers);
  return true;
}

function moveLayerInManagedGroup(
  group: ManagedLayerGroup,
  layerIndex: number,
  targetIndex: number,
): boolean {
  return moveLayerRangeInManagedGroup(group, layerIndex, layerIndex, targetIndex);
}

function moveLayerRangeInManagedGroup(
  group: ManagedLayerGroup,
  startIndex: number,
  endIndex: number,
  targetIndex: number,
): boolean {
  if (
    !isValidLayerRange(startIndex, endIndex, group.length) ||
    !isValidLayerRangeTarget(startIndex, endIndex, targetIndex, group.length)
  ) {
    return false;
  }
  return moveLayerRangeInTypedGroup<Layer>(group, startIndex, endIndex, targetIndex);
}

function applyRemoveLayerRangesPatch(
  data: BlueData,
  patch: Extract<ScorePatch, { type: 'removeLayerRanges' }>,
): boolean {
  const score = data.getScore();
  const ranges = patch.ranges;
  const locations = collectManagedLayerGroupLocations(score);
  const locationByGroupId = new Map<string, ManagedLayerGroupLocation>();
  for (const location of locations) {
    const groupId = getManagedLayerGroupId(location.group);
    if (!locationByGroupId.has(groupId)) {
      locationByGroupId.set(groupId, location);
    }
  }
  if (!areLayerRangesValid(ranges, (groupId) => locationByGroupId.get(groupId)?.group.length)) {
    return false;
  }

  const byGroup = new Map<string, Array<{ startIndex: number; endIndex: number }>>();
  for (const r of ranges) {
    let list = byGroup.get(r.groupId);
    if (!list) {
      list = [];
      byGroup.set(r.groupId, list);
    }
    list.push({ startIndex: r.startIndex, endIndex: r.endIndex });
  }

  for (const [groupId, groupRanges] of byGroup.entries()) {
    const group = locationByGroupId.get(groupId)?.group;
    if (!group) continue;
    groupRanges.sort((a, b) => b.startIndex - a.startIndex);
    for (const r of groupRanges) {
      group.removeLayers(r.startIndex, r.endIndex);
    }
  }

  if (patch.deleteEmptyLayerGroups) {
    const affectedGroupIds = new Set(byGroup.keys());
    const emptyGroups = locations
      .filter(
        (location) =>
          affectedGroupIds.has(getManagedLayerGroupId(location.group)) &&
          location.group.length === 0,
      )
      .sort((left, right) => right.depth - left.depth || right.index - left.index);
    for (const location of emptyGroups) {
      if (location.parent[location.index] === location.group) {
        location.parent.splice(location.index, 1);
      }
    }
  }

  return true;
}

type LayerHeightManagedLayer = {
  getHeightIndex(): number;
  setHeightIndex(heightIndex: number): void;
};

function isLayerHeightManagedLayer(value: unknown): value is LayerHeightManagedLayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getHeightIndex' in value &&
    typeof value.getHeightIndex === 'function' &&
    'setHeightIndex' in value &&
    typeof value.setHeightIndex === 'function'
  );
}

function applyUpdateLayerStatePatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updateLayerState' },
): boolean {
  const score = data.getScore();
  const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
  if (!targetGroup) return false;
  if (patch.layerIndex < 0 || patch.layerIndex >= targetGroup.length) return false;

  const layer = targetGroup[patch.layerIndex];
  if (!isLayerStateManagedLayer(layer)) return false;

  if (patch.patch.backgroundColor !== undefined) {
    if (!isValidLayerColorInput(patch.patch.backgroundColor)) {
      return false;
    }
  }

  let changed = false;

  if (patch.patch.backgroundColor !== undefined && isColorManaged(layer)) {
    const normalized = normalizeLayerColor(patch.patch.backgroundColor);
    if (layer.getBackgroundColor() !== normalized) {
      layer.setBackgroundColor(normalized);
      changed = true;
    }
  }

  if (patch.patch.muted !== undefined && layer.isMuted() !== patch.patch.muted) {
    layer.setMuted(patch.patch.muted);
    changed = true;
  }

  if (patch.patch.solo !== undefined && layer.isSolo() !== patch.patch.solo) {
    layer.setSolo(patch.patch.solo);
    changed = true;
  }

  if (patch.patch.heightIndex !== undefined && isLayerHeightManagedLayer(layer)) {
    const nextHeightIndex = Math.max(0, patch.patch.heightIndex);
    const oldEffective =
      'getLayerHeight' in layer && typeof layer.getLayerHeight === 'function'
        ? layer.getLayerHeight()
        : (layer.getHeightIndex() + 1) * 22;
    const newEffective = (nextHeightIndex + 1) * 22;
    if (oldEffective !== newEffective) {
      layer.setHeightIndex(nextHeightIndex);
      changed = true;
    }
  }

  return changed;
}

function applySetLayerHeightsPatch(data: BlueData, patch: SetLayerHeightsPatch): boolean {
  if (patch.updates.length === 0) {
    return false;
  }

  const score = data.getScore();

  const scopeGroupId = patch.scopeGroupId ?? null;
  let openedScopePoly: PolyObject | null = null;
  if (scopeGroupId !== null) {
    openedScopePoly = findPolyObjectByGroupId(score, scopeGroupId);
    if (!openedScopePoly) {
      throw new Error(`Scope group ${scopeGroupId} is not a reachable PolyObject`);
    }
  }

  const getDirectRootGroup = (groupId: string): ManagedLayerGroup | null => {
    for (let i = 0; i < score.length; i++) {
      const g = score[i];
      if (isManagedLayerGroup(g) && getManagedLayerGroupId(g) === groupId) {
        return g;
      }
    }
    return null;
  };

  // Phase 1: Full validation of all targets before any mutation
  const seenTargets = new Set<string>();
  const validated: Array<{
    targetGroup: PolyObject | TrackLayerGroup;
    layer: SoundLayer | TrackLayer;
    height: number | 'default';
  }> = [];

  for (const update of patch.updates) {
    const targetKey = `${update.groupId}:${update.layerIndex}`;
    if (seenTargets.has(targetKey)) {
      throw new Error(`Duplicate layer height target: ${targetKey}`);
    }
    seenTargets.add(targetKey);

    let targetGroup: ManagedLayerGroup | null = null;
    if (scopeGroupId === null) {
      targetGroup = getDirectRootGroup(update.groupId);
      if (!targetGroup) {
        throw new Error(`Target group ${update.groupId} is not a direct root group`);
      }
    } else {
      if (update.groupId !== scopeGroupId) {
        throw new Error(
          `Target group ${update.groupId} does not match scope group ${scopeGroupId}`,
        );
      }
      targetGroup = openedScopePoly;
    }

    if (targetGroup instanceof PatternsLayerGroup) {
      throw new Error(`Layer heights are not supported for Pattern groups: ${update.groupId}`);
    }
    if (!(targetGroup instanceof PolyObject || targetGroup instanceof TrackLayerGroup)) {
      throw new Error(`Unsupported layer group type for layer heights: ${update.groupId}`);
    }

    if (
      !Number.isInteger(update.layerIndex) ||
      update.layerIndex < 0 ||
      update.layerIndex >= targetGroup.length
    ) {
      throw new Error(
        `Layer index ${update.layerIndex} out of bounds for group ${update.groupId} (length: ${targetGroup.length})`,
      );
    }

    const layer = targetGroup[update.layerIndex];
    if (!layer || !(layer instanceof SoundLayer || layer instanceof TrackLayer)) {
      throw new Error(`Layer at index ${update.layerIndex} in group ${update.groupId} is invalid`);
    }

    const actualSelectionId = getLayerSelectionId(layer) ?? assignLayerSelectionId(layer);
    if (actualSelectionId !== update.layerSelectionId) {
      throw new Error(
        `Layer selection ID mismatch for group ${update.groupId}, index ${update.layerIndex}: expected ${update.layerSelectionId}, found ${actualSelectionId}`,
      );
    }

    if (update.height === 'default') {
      // Valid default reset
    } else if (
      typeof update.height === 'number' &&
      Number.isInteger(update.height) &&
      update.height >= LAYER_HEIGHT_MIN &&
      update.height <= LAYER_HEIGHT_MAX
    ) {
      // Valid numeric height
    } else {
      throw new Error(`Invalid layer height: ${String(update.height)}`);
    }

    validated.push({
      targetGroup,
      layer,
      height: update.height,
    });
  }

  // Phase 2: Mutation
  let changed = false;
  for (const { targetGroup, layer, height } of validated) {
    if (height === 'default') {
      const defaultIndex = targetGroup.getDefaultHeightIndex();
      const layerType = targetGroup instanceof TrackLayerGroup ? 'track' : 'soundLayer';
      const targetEffective = resolveGroupDefaultHeight(defaultIndex, layerType);
      const validDefaultIndex = Math.round(targetEffective / 22) - 1;
      if (layer.getLayerHeight() !== targetEffective) {
        layer.setHeightIndex(validDefaultIndex);
        changed = true;
      }
    } else {
      const applied = layer.setExplicitHeight(height);
      if (applied) {
        changed = true;
      }
    }
  }

  return changed;
}

function applySetLayerGroupDefaultHeightPatch(
  data: BlueData,
  patch: SetLayerGroupDefaultHeightPatch,
): boolean {
  const score = data.getScore();
  const scopeGroupId = patch.scopeGroupId ?? null;
  let targetGroup: ManagedLayerGroup | null = null;
  if (scopeGroupId === null) {
    for (let i = 0; i < score.length; i++) {
      const g = score[i];
      if (isManagedLayerGroup(g) && getManagedLayerGroupId(g) === patch.groupId) {
        targetGroup = g;
        break;
      }
    }
    if (!targetGroup) {
      throw new Error(`Group ${patch.groupId} is not a direct root group`);
    }
  } else {
    if (patch.groupId !== scopeGroupId) {
      throw new Error(`Group ${patch.groupId} does not match scope group ${scopeGroupId}`);
    }
    targetGroup = findPolyObjectByGroupId(score, scopeGroupId);
    if (!targetGroup) {
      throw new Error(`Scope group ${scopeGroupId} is not a reachable PolyObject`);
    }
  }

  if (targetGroup instanceof PatternsLayerGroup) {
    throw new Error(`Default layer height is not supported for Pattern groups: ${patch.groupId}`);
  }

  if (targetGroup instanceof PolyObject) {
    if (
      !Number.isInteger(patch.defaultHeightIndex) ||
      patch.defaultHeightIndex < 0 ||
      patch.defaultHeightIndex > SOUND_LAYER_MAX_HEIGHT_INDEX
    ) {
      throw new Error(
        `Invalid defaultHeightIndex for PolyObject: ${patch.defaultHeightIndex}. Must be 0..${SOUND_LAYER_MAX_HEIGHT_INDEX}`,
      );
    }
  } else if (targetGroup instanceof TrackLayerGroup) {
    if (
      !Number.isInteger(patch.defaultHeightIndex) ||
      patch.defaultHeightIndex < 0 ||
      patch.defaultHeightIndex > TRACK_MAX_HEIGHT_INDEX
    ) {
      throw new Error(
        `Invalid defaultHeightIndex for TrackLayerGroup: ${patch.defaultHeightIndex}. Must be 0..${TRACK_MAX_HEIGHT_INDEX}`,
      );
    }
  } else {
    throw new Error(`Unsupported layer group type for default height: ${patch.groupId}`);
  }

  if (targetGroup.getDefaultHeightIndex() !== patch.defaultHeightIndex) {
    targetGroup.setDefaultHeightIndex(patch.defaultHeightIndex);
    return true;
  }

  return false;
}

function applyAddScoreObjectsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'addScoreObjects' },
): boolean {
  const score = data.getScore();

  const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
  if (!targetGroup || targetGroup instanceof PatternsLayerGroup) return false;

  const context = score.getTimeContext();
  const soundObjectRefMap = new ObjRefLoadMap();
  for (const entry of data.getSoundObjectLibrary().getEntries()) {
    soundObjectRefMap.register(entry.libraryId, entry.object);
  }
  // Validate every serialized candidate before the first timeline mutation.
  const loaded = new Map<number, SoundObject | AudioClip>();
  const linkedSources = new Map<number, Instance>();
  const lookupCache: ScoreLookupCache = {};
  try {
    for (const [index, object] of patch.objects.entries()) {
      if (
        object.serializedXml === undefined &&
        object.sourceTarget?.displayContext === 'instance'
      ) {
        const source = object.sourceTarget;
        const location = source.location ?? source.sourceInstanceLocation;
        const resolved = location
          ? resolveTimelineTargetWithSelectionId(data, location, source.selectionId, lookupCache)
          : null;
        if (!(resolved?.sObj instanceof Instance) || !resolved.sObj.getSoundObject()) return false;
        linkedSources.set(index, resolved.sObj);
      }
      if (object.serializedXml === undefined) continue;
      const root = Element.parse(object.serializedXml);
      const candidate =
        root.getName() === 'audioClip'
          ? AudioClip.loadFromXML(root)
          : loadSoundObjectFromXML(root, soundObjectRefMap);
      if (!candidate) return false;
      loaded.set(index, candidate);
    }
  } catch {
    return false;
  }
  let changed = false;

  for (const [index, obj] of patch.objects.entries()) {
    const candidate = loaded.get(index) ?? linkedSources.get(index);
    let sObj: SoundObject | null =
      candidate && !(candidate instanceof AudioClip) ? candidate.deepCopy() : null;
    let clip: AudioClip | null = candidate instanceof AudioClip ? candidate : null;

    const sourceLocation = obj.sourceTarget?.location ?? obj.sourceTarget?.sourceInstanceLocation;
    if (!sObj && !clip && sourceLocation) {
      const source = resolveTimelineTargetWithSelectionId(
        data,
        sourceLocation,
        obj.sourceTarget?.selectionId,
      );
      if (source) {
        if (source.sObj instanceof AudioClip) {
          clip = AudioClip.copyFrom(source.sObj);
        } else {
          sObj = source.sObj.deepCopy();
        }
      }
    }

    if (!sObj && !clip && obj.objectType === 'AudioClip') {
      clip = new AudioClip();
    }

    if (!sObj && !clip) {
      sObj = createSoundObject(obj.objectType);
    }

    const targetObject = clip ?? sObj;
    if (!targetObject) continue;

    if (obj.selectionId?.trim()) {
      const trimmedId = obj.selectionId.trim();
      assignExplicitScoreObjectId(targetObject, trimmedId);
      recordScoreObjectIdForData(data, trimmedId);
    }

    targetObject.setName(obj.name);
    targetObject.setStartTime(
      beatsToTimePosition(
        obj.startBeats,
        (obj.startTimeBase ?? TimeBase.BEATS) as TimeBase,
        context,
      ),
    );
    if (sObj instanceof PolyObject && obj.serializedXml) {
      // A serialized PolyObject may contain TIME/BBT/etc. child durations.
      // Recompute its envelope in the canonical project context so the outer
      // duration is not tied to the renderer's fallback conversion context.
      sObj.normalizeSoundObjects(context);
    } else {
      targetObject.setSubjectiveDuration(
        beatsToDuration(
          obj.durationBeats,
          (obj.durationTimeBase ?? TimeBase.BEATS) as TimeBase,
          context,
        ),
      );
    }
    if (obj.backgroundColor !== undefined) {
      targetObject.setBackgroundColor(obj.backgroundColor);
    } else if (!obj.serializedXml && !obj.sourceTarget?.location) {
      const destLayer = targetGroup[obj.layerIndex];
      if (destLayer && isColorManaged(destLayer)) {
        targetObject.setBackgroundColor(destLayer.getBackgroundColor());
      }
    }

    if (obj.layerIndex < 0 || obj.layerIndex >= targetGroup.length) {
      continue;
    }

    let inserted = false;
    if (targetGroup instanceof TrackLayerGroup) {
      const trackLayer = targetGroup[obj.layerIndex];
      if (!trackLayer) continue;
      if (clip && trackLayer.accepts(clip)) {
        trackLayer.push(clip);
        changed = true;
        inserted = true;
      } else if (sObj && trackLayer.accepts(sObj)) {
        trackLayer.push(sObj);
        changed = true;
        inserted = true;
      }
    } else if (targetGroup instanceof PolyObject && sObj) {
      targetGroup[obj.layerIndex].push(sObj);
      changed = true;
      inserted = true;
    }

    if (inserted && sObj) {
      const instances = collectInstanceSoundObjects([sObj]);
      if (instances.length > 0) {
        data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects(instances);
      }
    }
  }

  return changed;
}

function compareScoreObjectLocations(
  a: ScoreObjectLocationRef,
  aObjectIndex: number,
  b: ScoreObjectLocationRef,
  bObjectIndex: number,
): number {
  if (a.rootGroupIndex !== b.rootGroupIndex) {
    return a.rootGroupIndex - b.rootGroupIndex;
  }
  const minPathLength = Math.min(a.containerPath.length, b.containerPath.length);
  for (let i = 0; i < minPathLength; i += 1) {
    const segA = a.containerPath[i]!;
    const segB = b.containerPath[i]!;
    if (segA.layerIndex !== segB.layerIndex) return segA.layerIndex - segB.layerIndex;
    if (segA.objectIndex !== segB.objectIndex) return segA.objectIndex - segB.objectIndex;
  }
  if (a.containerPath.length !== b.containerPath.length) {
    return a.containerPath.length - b.containerPath.length;
  }
  if (a.layerIndex !== b.layerIndex) {
    return a.layerIndex - b.layerIndex;
  }
  return aObjectIndex - bObjectIndex;
}

function applyMoveScoreObjectsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'moveScoreObjects' },
): boolean {
  const score = data.getScore();
  const lookupCache: ScoreLookupCache = {};
  const targetGroupCache = new Map<string, ManagedLayerGroup | null>();
  const resolvedMoves: Array<{
    move: (typeof patch.moves)[number];
    moveIndex: number;
    sourceLocation: ScoreObjectLocationRef;
    sourceResolved: NonNullable<ReturnType<typeof resolveTimelineTargetWithSelectionId>>;
    targetLayer: Array<SoundObject | AudioClip>;
  }> = [];

  for (let moveIndex = 0; moveIndex < patch.moves.length; moveIndex += 1) {
    const move = patch.moves[moveIndex]!;
    const sourceLocation = move.target.location ?? move.target.sourceInstanceLocation;
    if (!sourceLocation) continue;

    const sourceResolved = resolveTimelineTargetWithSelectionId(
      data,
      sourceLocation,
      move.target.selectionId,
      lookupCache,
    );
    if (!sourceResolved) continue;

    let targetGroup = targetGroupCache.get(move.targetGroupId);
    if (targetGroup === undefined) {
      targetGroup = findLayerGroupByGroupId(score, move.targetGroupId);
      targetGroupCache.set(move.targetGroupId, targetGroup);
    }
    if (!targetGroup || targetGroup instanceof PatternsLayerGroup) continue;

    if (targetGroup instanceof TrackLayerGroup) {
      const trackLayer = targetGroup[move.targetLayerIndex];
      if (!trackLayer || !trackLayer.accepts(sourceResolved.sObj)) continue;
      resolvedMoves.push({
        move,
        moveIndex,
        sourceLocation,
        sourceResolved,
        targetLayer: trackLayer,
      });
      continue;
    }

    if (!(targetGroup instanceof PolyObject) || sourceResolved.sObj instanceof AudioClip) {
      continue;
    }

    const targetLayer = targetGroup[move.targetLayerIndex];
    if (!targetLayer) continue;

    resolvedMoves.push({ move, moveIndex, sourceLocation, sourceResolved, targetLayer });
  }

  resolvedMoves.sort(
    (a, b) =>
      b.sourceResolved.objectIndex - a.sourceResolved.objectIndex || a.moveIndex - b.moveIndex,
  );

  const splicedMoves: Array<{
    sObj: SoundObject | AudioClip;
    targetLayer: Array<SoundObject | AudioClip>;
    sourceLocation: ScoreObjectLocationRef;
    sourceObjectIndex: number;
    moveIndex: number;
  }> = [];

  for (const entry of resolvedMoves) {
    // Re-validate the resolved object is still at its index before splicing.
    // A prior splice in this same patch (or a duplicate/stale location) can
    // shift indices; never splice out an object that is not the one we resolved,
    // as that would silently move or delete the wrong score object.
    if (
      entry.sourceResolved.layer[entry.sourceResolved.objectIndex] !== entry.sourceResolved.sObj
    ) {
      continue;
    }
    const [sObj] = entry.sourceResolved.layer.splice(entry.sourceResolved.objectIndex, 1);
    if (!sObj) continue;

    const targetStartBeats = Math.max(0, entry.move.targetStartBeats);
    if (sObj instanceof AudioClip) {
      const base = sObj.getStartTime().getTimeBase();
      sObj.setStartTime(beatsToTimePosition(targetStartBeats, base, score.getTimeContext()));
    } else if (sObj instanceof AbstractSoundObject) {
      const base = sObj.getStartTime().getTimeBase();
      sObj.setStartTime(beatsToTimePosition(targetStartBeats, base, score.getTimeContext()));
    }

    splicedMoves.push({
      sObj,
      targetLayer: entry.targetLayer,
      sourceLocation: entry.sourceLocation,
      sourceObjectIndex: entry.sourceResolved.objectIndex,
      moveIndex: entry.moveIndex,
    });
  }

  splicedMoves.sort(
    (a, b) =>
      compareScoreObjectLocations(
        a.sourceLocation,
        a.sourceObjectIndex,
        b.sourceLocation,
        b.sourceObjectIndex,
      ) || a.moveIndex - b.moveIndex,
  );

  for (const entry of splicedMoves) {
    entry.targetLayer.push(entry.sObj);
  }

  return splicedMoves.length > 0;
}

function removeScoreObjectsByTargets(
  data: BlueData,
  targets: readonly ScoreObjectEditorTargetSnapshot[],
): boolean {
  const resolvedEntries: Array<{
    sObj: SoundObject | AudioClip;
    layer: Array<SoundObject | AudioClip>;
    objectIndex: number;
  }> = [];
  const seenObjects = new Set<SoundObject | AudioClip>();
  const lookupCache: ScoreLookupCache = {};

  for (const target of targets) {
    const location = target.location ?? target.sourceInstanceLocation;
    if (!location) continue;
    const timelineResolved = resolveTimelineTargetWithSelectionId(
      data,
      location,
      target.selectionId,
      lookupCache,
    );
    if (!timelineResolved || seenObjects.has(timelineResolved.sObj)) continue;
    seenObjects.add(timelineResolved.sObj);
    resolvedEntries.push(timelineResolved);
  }

  // Splice highest indices first and re-verify layer membership so deleting
  // multiple siblings in the same layer never removes an unintended object.
  resolvedEntries.sort((a, b) => b.objectIndex - a.objectIndex);
  let removedAny = false;
  for (const entry of resolvedEntries) {
    const index =
      entry.layer[entry.objectIndex] === entry.sObj
        ? entry.objectIndex
        : entry.layer.indexOf(entry.sObj);
    if (index < 0 || index >= entry.layer.length) continue;
    entry.layer.splice(index, 1);
    removedAny = true;
  }
  return removedAny;
}

/**
 * Converts a single PythonObject or External into an ObjectBuilder, mirroring
 * Java's remove-then-add behavior. The converted object keeps the source's
 * stable selection id so it remains selected after moving to the layer end.
 */
function applyConvertScoreObjectToObjectBuilder(
  data: BlueData,
  target: ScoreObjectEditorTargetSnapshot,
): boolean {
  const location = target.location;
  if (!location) return false;

  const resolved = resolveTimelineTargetWithSelectionId(data, location, target.selectionId);
  if (!resolved) return false;
  const { sObj, layer, objectIndex } = resolved;
  if (!(sObj instanceof PythonObject) && !(sObj instanceof External)) return false;

  const builder = new ObjectBuilder();

  // Common properties copied from the source (matches Java branches).
  builder.setName(sObj.getName());
  builder.setNoteProcessorChain(new NoteProcessorChain(sObj.getNoteProcessorChain()));
  builder.setTimeBehavior(sObj.getTimeBehavior());
  builder.setStartTime(sObj.getStartTime());
  builder.setSubjectiveDuration(sObj.getSubjectiveDuration());
  builder.setBackgroundColor(sObj.getBackgroundColor());

  if (sObj instanceof PythonObject) {
    builder.setCode(sObj.getPythonCode());
    // languageType defaults to PYTHON from the ObjectBuilder constructor.
  } else {
    builder.setCode(sObj.getText());
    builder.setCommandLine(sObj.getCommandLine());
    builder.setLanguageType('EXTERNAL');
  }

  // Preserve the stable selection id so the converted object stays selected.
  const existingId = getScoreObjectId(sObj);
  if (existingId) {
    assignExplicitScoreObjectId(builder, existingId);
    recordScoreObjectIdForData(data, existingId);
  }

  layer.splice(objectIndex, 1);
  layer.push(builder);
  return true;
}

function applyMoveLayerGroupPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'moveLayerGroup' },
): boolean {
  const score = data.getScore();
  const sourceIdx = findRootLayerGroupIndexByGroupId(score, patch.groupId);
  if (sourceIdx === -1) return false;
  const clampedTarget = Math.max(0, Math.min(patch.targetIndex, score.length - 1));
  if (sourceIdx === clampedTarget) return false;
  const [removed] = score.splice(sourceIdx, 1);
  score.splice(clampedTarget, 0, removed);
  return true;
}

function applyRenameLayerGroupPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'renameLayerGroup' },
): boolean {
  const targetGroup = findLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!targetGroup) return false;
  targetGroup.setName(patch.name);
  return true;
}

function applyRemoveLayerGroupPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'removeLayerGroup' },
): boolean {
  const score = data.getScore();
  const idx = findRootLayerGroupIndexByGroupId(score, patch.groupId);
  if (idx === -1) return false;
  score.splice(idx, 1);
  return true;
}

function applyScopedNoteProcessorChainPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'replaceScopedNoteProcessorChain' },
): boolean {
  const score = data.getScore();

  if (patch.scope === 'rootScore') {
    if (patch.chain === null) {
      score.setNoteProcessorChain(new NoteProcessorChain());
    } else {
      const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
      score.setNoteProcessorChain(reified);
    }
    return true;
  }

  const idx = 'groupId' in patch ? findRootLayerGroupIndexByGroupId(score, patch.groupId) : -1;
  if (idx === -1) return false;
  const lg = score[idx];

  if (patch.scope === 'layerGroup') {
    if (lg instanceof PolyObject) {
      if (patch.chain === null) {
        lg.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        lg.setNoteProcessorChain(reified);
      }
      return true;
    }
    if (lg instanceof PatternsLayerGroup) {
      if (patch.chain === null) {
        lg.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        lg.setNoteProcessorChain(reified);
      }
      return true;
    }
    return false;
  }

  if (patch.scope === 'soundLayer') {
    const layerIdx = patch.layerIndex;
    if (!(lg instanceof PolyObject)) return false;
    if (layerIdx < 0 || layerIdx >= lg.length) return false;
    const layer = lg[layerIdx];
    if (patch.chain === null) {
      layer.setNoteProcessorChain(new NoteProcessorChain());
    } else {
      const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
      layer.setNoteProcessorChain(reified);
    }
    return true;
  }

  return false;
}

export function applyScoreObjectPatch(
  data: BlueData,
  patch: ScorePatch,
  patchContext?: ProjectDocumentPatchContext,
): boolean {
  recordExistingScoreObjectIds(data);
  if (patch.type === 'updateTrackLayerMuteSoloMode') {
    if (!isTrackLayerMuteSoloMode(patch.mode)) return false;
    const score = data.getScore();
    if (score.trackLayerMuteSoloMode === patch.mode) return false;
    score.trackLayerMuteSoloMode = patch.mode;
    return true;
  }
  if (isTrackScorePatch(patch)) {
    return applyTrackScorePatch(data, patch, patchContext);
  }
  if (patch.type === 'updatePatternCells') {
    return applyUpdatePatternCellsPatch(data, patch);
  }
  if (patch.type === 'updatePatternBeatsLength') {
    return applyUpdatePatternBeatsLengthPatch(data, patch);
  }
  if (patch.type === 'setLayerHeights') {
    return applySetLayerHeightsPatch(data, patch);
  }
  if (patch.type === 'setLayerGroupDefaultHeight') {
    return applySetLayerGroupDefaultHeightPatch(data, patch);
  }
  if (patch.type === 'setScoreObjectBackgroundColors') {
    return applySetScoreObjectBackgroundColorsPatch(data, patch);
  }
  if (patch.type === 'addScoreObjects') {
    return applyAddScoreObjectsPatch(data, patch);
  }

  if (patch.type === 'moveScoreObjects') {
    return applyMoveScoreObjectsPatch(data, patch);
  }

  if (patch.type === 'removeScoreObjects') {
    return removeScoreObjectsByTargets(data, patch.targets);
  }

  if (patch.type === 'convertScoreObjectToObjectBuilder') {
    return applyConvertScoreObjectToObjectBuilder(data, patch.target);
  }

  if (patch.type === 'convertToPolyObject') {
    return applyConvertToPolyObjectPatch(data, patch);
  }

  if (patch.type === 'setSubjectiveDurationToObjective') {
    const context = data.getScore().getTimeContext();
    const lookupCache: ScoreLookupCache = {};
    const resolved = patch.targets.map(
      (target) => resolveEditorTarget(data, target, lookupCache)?.sObj ?? null,
    );
    if (resolved.some((object) => !object || object instanceof AudioClip)) return false;
    const measuredDurations = patch.resolvedObjectiveDurationsBeats;
    if (
      measuredDurations !== undefined &&
      (measuredDurations.length !== resolved.length ||
        measuredDurations.some(
          (duration, index) =>
            duration !== null &&
            (!(resolved[index] instanceof PolyObject) ||
              !Number.isFinite(duration) ||
              duration <= 0),
        ))
    ) {
      return false;
    }
    const updates = (resolved as SoundObject[]).map((object, index) => {
      let durationBeats: number | null = null;
      if (measuredDurations?.[index] != null) {
        durationBeats = measuredDurations[index]!;
      } else if (object instanceof GenericScore) {
        const notes = parseScoreNotes(object.getScoreText());
        durationBeats =
          notes.length === 0
            ? null
            : Math.max(...notes.map((note) => note.getStartTime() + note.getObjectiveDuration()));
      } else if (object instanceof PolyObject) {
        const notes = object.generateForCSD(context, new CompileData(), -1, -1);
        durationBeats = getTotalDuration(notes) - object.getStartTime().toBeats(context);
      } else if (object instanceof Instance && object.getSoundObject()) {
        durationBeats = object.getSoundObject()!.getSubjectiveDuration().toBeats(context);
      } else {
        // Java Blue defines the objective duration of most SoundObject types as
        // their current subjective duration. The types above are exceptions.
        durationBeats = object.getSubjectiveDuration().toBeats(context);
      }
      return durationBeats !== null && Number.isFinite(durationBeats) && durationBeats > 0
        ? { object, durationBeats }
        : null;
    });
    if (updates.some((update) => update === null)) return false;
    let changed = false;
    for (const update of updates as Array<{ object: SoundObject; durationBeats: number }>) {
      if (
        Math.abs(update.object.getSubjectiveDuration().toBeats(context) - update.durationBeats) <
        1e-9
      )
        continue;
      update.object.setSubjectiveDuration(
        beatsToDuration(
          update.durationBeats,
          update.object.getSubjectiveDuration().getTimeBase(),
          context,
        ),
      );
      changed = true;
    }
    return changed;
  }

  if (patch.type === 'addLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    const layer = targetGroup.newLayerAt(patch.layerIndex + 1);
    // Materialize renderer identities before history captures the new layer.
    assignLayerSelectionId(layer);
    if (layer instanceof PatternLayer) {
      assignPatternLayerId(layer);
      assignScoreObjectId(layer.getSoundObject(), 'sobj');
    }
    return true;
  }

  if (patch.type === 'removeLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    if (patch.layerIndex >= 0 && patch.layerIndex < targetGroup.length) {
      targetGroup.removeLayers(patch.layerIndex, patch.layerIndex);
    }
    return true;
  }

  if (patch.type === 'moveLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    const { layerIndex, targetIndex } = patch;
    if (layerIndex < 0 || layerIndex >= targetGroup.length) return false;
    const clampedTarget = Math.max(0, Math.min(targetIndex, targetGroup.length - 1));
    if (layerIndex === clampedTarget) return false;
    return moveLayerInManagedGroup(targetGroup, layerIndex, clampedTarget);
  }

  if (patch.type === 'moveLayerRange') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    const { startIndex, endIndex, targetIndex } = patch;
    return moveLayerRangeInManagedGroup(targetGroup, startIndex, endIndex, targetIndex);
  }

  if (patch.type === 'removeLayerRanges') {
    return applyRemoveLayerRangesPatch(data, patch);
  }

  if (patch.type === 'renameLayer') {
    const score = data.getScore();
    const targetGroup = findLayerGroupByGroupId(score, patch.groupId);
    if (!targetGroup) return false;
    if (patch.layerIndex < 0 || patch.layerIndex >= targetGroup.length) return false;
    targetGroup[patch.layerIndex]!.setName(patch.name);
    return true;
  }

  if (patch.type === 'addLayerGroup') {
    const score = data.getScore();
    const insertAt = patch.insertAtIndex ?? score.length;
    score.splice(
      insertAt,
      0,
      createManagedLayerGroup(patch.groupType, patchContext?.defaultLayerGroupType),
    );
    return true;
  }

  if (patch.type === 'updateTimeState') {
    return applyScoreTimeStatePatch(data, patch.patch);
  }

  if (patch.type === 'addMarker') {
    const markers = data.getMarkersList();
    const name = patch.name ?? `Marker ${markers.size() + 1}`;
    const context = data.getScore().getTimeContext();
    const targetBase = data.getScore().getTimeState().getTimeDisplay();
    const position = beatsToTimePosition(patch.timeBeats, targetBase, context);
    appendMarkerSnapshotId(markers, patch.markerId);
    markers.addMarkerPosition(name, position);
    return true;
  }

  if (patch.type === 'updateMarker') {
    const ml = data.getMarkersList();
    if (patch.patch.name !== undefined) {
      ml.setMarkerName(patch.sourceIndex, patch.patch.name);
    }
    if (patch.patch.timeBeats !== undefined || patch.patch.timeBase !== undefined) {
      const context = data.getScore().getTimeContext();
      const currentPosition = ml.getMarkerTimePosition(patch.sourceIndex);
      const targetBase = (patch.patch.timeBase ?? currentPosition.getTimeBase()) as TimeBase;
      const targetBeats = patch.patch.timeBeats ?? currentPosition.toBeats(context);
      ml.setMarkerTimePosition(
        patch.sourceIndex,
        beatsToTimePosition(targetBeats, targetBase, context),
      );
    }
    return true;
  }

  if (patch.type === 'updateLayerState') {
    return applyUpdateLayerStatePatch(data, patch);
  }

  if (patch.type === 'removeMarker') {
    const markers = data.getMarkersList();
    if (patch.sourceIndex >= 0 && patch.sourceIndex < markers.size()) {
      removeMarkerSnapshotId(markers, patch.sourceIndex);
    }
    markers.removeMarker(patch.sourceIndex);
    return true;
  }

  if (patch.type === 'moveLayerGroup') {
    return applyMoveLayerGroupPatch(data, patch);
  }

  if (patch.type === 'renameLayerGroup') {
    return applyRenameLayerGroupPatch(data, patch);
  }

  if (patch.type === 'removeLayerGroup') {
    return applyRemoveLayerGroupPatch(data, patch);
  }

  if (patch.type === 'replaceScopedNoteProcessorChain') {
    return applyScopedNoteProcessorChainPatch(data, patch);
  }

  if (patch.type === 'saveNamedNoteProcessorChain') {
    const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
    data.getNoteProcessorChainMap().setChain(patch.name, reified);
    return true;
  }

  if (patch.type === 'deleteNamedNoteProcessorChain') {
    data.getNoteProcessorChainMap().removeChain(patch.name);
    return true;
  }

  const automationResult = applyScoreAutomationPatch(data, patch);
  if (automationResult !== undefined) return automationResult;

  if (!isScoreObjectLeafPatch(patch)) return false;

  const resolved = resolveEditorTarget(data, patch.target);
  if (!resolved) return false;

  const colorAccepted =
    patch.type === 'updateSharedProperties' && patch.patch.backgroundColor !== undefined
      ? isScoreColorPatchAccepted(data, patch)
      : true;
  return applyScoreObjectLeafPatch(resolved.sObj, patch, data.getScore().getTimeContext(), {
    colorAccepted,
  });
}
