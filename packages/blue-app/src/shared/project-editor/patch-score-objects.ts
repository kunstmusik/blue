import {
  BlueData,
  Element,
  Score,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  TimeBase,
  isValidSnapValueName,
  SoundObject,
  SoundObjectLibrary,
  collectInstanceSoundObjects,
  AbstractSoundObject,
  TimeBehavior,
  NoteProcessorChain,
  AudioClip,
  ObjRefLoadMap,
  TimePosition,
  TimeContext,
  PythonObject,
  ClojureObject,
  JavaScriptObject,
  External,
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  Pattern,
  LineObject,
  ZakLineObject,
  PianoRoll,
  PianoNote,
  TrackerObject,
  Track,
  TrackerNote,
  Column,
  JMask,
  loadFieldFromSnapshot,
  Sound,
  createSoundObject,
  loadSoundObjectFromXML,
  beatsToTimePosition,
  beatsToDuration,
  FadeType,
  ObjectBuilder,
  reifyChainFromSnapshot,
  isValidLayerColorInput,
  normalizeLayerColor,
} from '@blue/data';
import type {
  NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot,
  Parameter as BlueDataParameter,
} from '@blue/data';
import { AutomationCurve as BlueDataAutomationCurve } from '@blue/data';
import type { SnapValueName } from '@blue/data';

import type {
  ScoreObjectEditorTargetSnapshot,
  TrackerColumnSnapshot,
  TrackRef,
  TrackItemRef,
  TrackItemMove,
  TrackItemResize,
  TrackItemTransfer,
  TrackScorePatch,
  ScorePatch,
  MidiScaleSnapshot,
  ProjectDocumentPatchContext,
  EmbeddedOpcodeListPatch,
  BsbInterfacePatch,
} from './contract';
import {
  assignExplicitScoreObjectId,
  assignLayerGroupId,
  assignPatternLayerId,
  assignScoreObjectId,
  recordScoreObjectIdForData,
} from './identity';
import { applyBsbInterfacePatch, applyEmbeddedOpcodeListPatch } from './bsb-widgets';
import {
  findPatternsLayerGroupByGroupId,
  resolveEditorTarget,
  resolveTimelineTargetWithSelectionId,
  type ScoreLookupCache,
  setCodeText,
} from './snapshot-score';
import {
  applyObjectBuilderBsbInterfacePatch,
  applyInstrumentPatch,
  createInstrumentForType,
  createInstrumentFromSnapshot,
  createJMaskEditorPayload,
} from './snapshot-mixer-orchestra';
import {
  applyPianoRollFieldDefinitions,
  createScaleFromSnapshot,
  createTrackerColumnFromSnapshot,
  getPianoRollFieldDefinitionsSnapshot,
  mergeJMaskSnapshotValue,
} from './patch-mixer-bluelive';

import { isValidTimeBase } from './patch-score-time';

function toBlueDataFadeType(value: string | null | undefined): FadeType {
  switch (
    (value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
  ) {
    case 'CONSTANT_POWER':
      return FadeType.CONSTANT_POWER;
    case 'SYMMETRIC':
    case 'S_CURVE':
      return FadeType.S_CURVE;
    case 'FAST':
      return FadeType.FAST;
    case 'SLOW':
      return FadeType.SLOW;
    case 'LINEAR':
    default:
      return FadeType.LINEAR;
  }
}

export type ManagedLayerGroup = PolyObject | TrackLayerGroup | PatternsLayerGroup;

export function getManagedLayerGroupId(group: ManagedLayerGroup): string {
  return group instanceof TrackLayerGroup ? group.getUniqueId() : assignLayerGroupId(group);
}

export function isManagedLayerGroup(value: unknown): value is ManagedLayerGroup {
  return (
    value instanceof PolyObject ||
    value instanceof TrackLayerGroup ||
    value instanceof PatternsLayerGroup
  );
}

export function findLayerGroupByGroupId(score: Score, groupId: string): ManagedLayerGroup | null {
  const visited = new Set<ManagedLayerGroup>();
  const visit = (group: ManagedLayerGroup): ManagedLayerGroup | null => {
    if (visited.has(group)) return null;
    visited.add(group);
    if (getManagedLayerGroupId(group) === groupId) return group;
    if (!(group instanceof PolyObject)) return null;
    for (const layer of group) {
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex++) {
        const soundObject = layer[objectIndex];
        if (soundObject instanceof PolyObject) {
          const match = visit(soundObject);
          if (match) return match;
        }
      }
    }
    return null;
  };
  for (let index = 0; index < score.length; index++) {
    const group = score[index];
    if (isManagedLayerGroup(group)) {
      const match = visit(group);
      if (match) return match;
    }
  }
  return null;
}

type LayerStateManagedLayer = {
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  isSolo(): boolean;
  setSolo(solo: boolean): void;
};

export function isLayerStateManagedLayer(value: unknown): value is LayerStateManagedLayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isMuted' in value &&
    typeof value.isMuted === 'function' &&
    'setMuted' in value &&
    typeof value.setMuted === 'function' &&
    'isSolo' in value &&
    typeof value.isSolo === 'function' &&
    'setSolo' in value &&
    typeof value.setSolo === 'function'
  );
}

export function isColorManaged(
  value: unknown,
): value is { getBackgroundColor(): number; setBackgroundColor(color: number): void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getBackgroundColor' in value &&
    typeof (value as { getBackgroundColor: unknown }).getBackgroundColor === 'function' &&
    'setBackgroundColor' in value &&
    typeof (value as { setBackgroundColor: unknown }).setBackgroundColor === 'function'
  );
}

export function isTrackScorePatch(patch: ScorePatch): patch is TrackScorePatch {
  return (
    patch.type === 'addTrackItem' ||
    patch.type === 'moveTrackItems' ||
    patch.type === 'resizeTrackItems' ||
    patch.type === 'removeTrackItems' ||
    patch.type === 'replaceTrackNoteProcessorChain' ||
    patch.type === 'createTrackInstrument' ||
    patch.type === 'replaceTrackInstrument' ||
    patch.type === 'clearTrackInstrument' ||
    patch.type === 'updateTrackInstrument'
  );
}

interface ResolvedTrackRef {
  group: TrackLayerGroup;
  track: TrackLayer;
  trackIndex: number;
}

function resolveTrackRef(
  score: Score,
  ref: TrackRef,
  context?: ProjectDocumentPatchContext,
): ResolvedTrackRef | null {
  if (!ref || typeof ref.rootGroupId !== 'string' || !ref.rootGroupId.trim()) return null;
  if (typeof ref.trackId !== 'string' || !ref.trackId.trim()) return null;
  if (!Number.isInteger(ref.projectSessionId) || ref.projectSessionId < 0) return null;
  if (!Number.isInteger(ref.projectRevision) || ref.projectRevision < 0) return null;
  if (!context) return null;
  if (ref.projectSessionId !== context.projectSessionId) return null;
  if (ref.projectRevision !== context.projectRevision) return null;

  for (const group of score) {
    if (!(group instanceof TrackLayerGroup) || group.getUniqueId() !== ref.rootGroupId) continue;
    let found: ResolvedTrackRef | null = null;
    for (let index = 0; index < group.length; index++) {
      const track = group[index];
      if (track.getUniqueId() !== ref.trackId) continue;
      if (found) return null;
      found = { group, track, trackIndex: index };
    }
    return found;
  }
  return null;
}

interface ResolvedTrackItem {
  track: TrackLayer;
  item: TrackLayer[number];
  objectIndex: number;
}

function resolveTrackItem(
  score: Score,
  ref: TrackItemRef,
  context?: ProjectDocumentPatchContext,
): ResolvedTrackItem | null {
  const resolved = resolveTrackRef(score, ref.track, context);
  if (!resolved) return null;
  if (ref.objectIndex !== undefined) {
    if (
      !Number.isInteger(ref.objectIndex) ||
      ref.objectIndex < 0 ||
      ref.objectIndex >= resolved.track.length
    )
      return null;
    const item = resolved.track[ref.objectIndex];
    if (
      ref.objectId &&
      assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj') !== ref.objectId
    )
      return null;
    return { track: resolved.track, item, objectIndex: ref.objectIndex };
  }
  if (!ref.objectId || !ref.objectId.trim()) return null;
  for (let index = 0; index < resolved.track.length; index++) {
    const item = resolved.track[index];
    if (assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj') === ref.objectId) {
      return { track: resolved.track, item, objectIndex: index };
    }
  }
  return null;
}

function setTrackItemTiming(
  item: TrackLayer[number],
  context: TimeContext,
  startBeats: number,
  durationBeats?: number,
  startTimeBase?: string,
  durationTimeBase?: string,
): void {
  const start = beatsToTimePosition(
    Math.max(0, Number.isFinite(startBeats) ? startBeats : 0),
    (startTimeBase ?? TimeBase.BEATS) as TimeBase,
    context,
  );
  const duration =
    durationBeats === undefined
      ? undefined
      : beatsToDuration(
          Math.max(0, Number.isFinite(durationBeats) ? durationBeats : 0),
          (durationTimeBase ?? TimeBase.BEATS) as TimeBase,
          context,
        );
  if (item instanceof AudioClip) {
    item.setStartTime(start);
    if (duration) item.setSubjectiveDuration(duration);
  } else if (item instanceof AbstractSoundObject) {
    item.setStartTime(start);
    if (duration) item.setSubjectiveDuration(duration);
  }
}

function reifyTrackItemTransfer(
  transfer: TrackItemTransfer,
  context: TimeContext,
  soundObjectLibrary?: SoundObjectLibrary,
): TrackLayer[number] | null {
  const typeName = transfer.objectType ?? transfer.type ?? '';
  let item: TrackLayer[number] | null = null;
  if (transfer.serializedXml) {
    try {
      const serialized = Element.parse(transfer.serializedXml);
      if (serialized.getName() === 'audioClip') {
        item = AudioClip.loadFromXML(serialized);
      } else {
        const soundObjectRefMap = new ObjRefLoadMap();
        if (soundObjectLibrary) {
          for (const entry of soundObjectLibrary.getEntries()) {
            soundObjectRefMap.register(entry.libraryId, entry.object);
          }
        }
        item = loadSoundObjectFromXML(serialized, soundObjectRefMap)?.deepCopy() ?? null;
      }
    } catch {
      return null;
    }
  } else if (typeName === 'AudioClip') {
    item = new AudioClip();
  } else if (typeName) {
    item = createSoundObject(typeName);
  }

  if (!item) return null;
  if (transfer.name !== undefined) item.setName(transfer.name);
  if (transfer.backgroundColor !== undefined) item.setBackgroundColor(transfer.backgroundColor);
  if (transfer.startBeats !== undefined) {
    setTrackItemTiming(
      item,
      context,
      transfer.startBeats,
      transfer.durationBeats,
      transfer.startTimeBase,
      transfer.durationTimeBase,
    );
  }
  return item;
}

export function applyTrackScorePatch(
  data: BlueData,
  patch: TrackScorePatch,
  patchContext?: ProjectDocumentPatchContext,
): boolean {
  const score = data.getScore();
  const context = score.getTimeContext();

  if (patch.type === 'addTrackItem') {
    const target = resolveTrackRef(score, patch.track, patchContext);
    if (!target) return false;
    const item = reifyTrackItemTransfer(patch.item, context, data.getSoundObjectLibrary());
    if (!item || !target.track.accepts(item)) return false;
    if (!patch.item.serializedXml && patch.item.backgroundColor === undefined) {
      item.setBackgroundColor(target.track.getBackgroundColor());
    }
    setTrackItemTiming(
      item,
      context,
      patch.startBeats,
      patch.item.durationBeats,
      patch.item.startTimeBase,
      patch.item.durationTimeBase,
    );
    if (patch.item.selectionId && patch.item.selectionId.trim().length > 0) {
      const trimmedId = patch.item.selectionId.trim();
      assignExplicitScoreObjectId(item, trimmedId);
      recordScoreObjectIdForData(data, trimmedId);
    }
    target.track.push(item);
    if (item instanceof AbstractSoundObject) {
      const instances = collectInstanceSoundObjects([item]);
      if (instances.length > 0) {
        data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects(instances);
      }
    }
    return true;
  }

  if (patch.type === 'removeTrackItems') {
    const resolved = patch.targets.map((target) => resolveTrackItem(score, target, patchContext));
    if (resolved.some((entry) => !entry)) return false;
    const entries = resolved as ResolvedTrackItem[];
    if (new Set(entries.map((entry) => entry.item)).size !== entries.length) return false;
    for (const entry of entries) {
      const index = entry.track.indexOf(entry.item);
      if (index < 0) return false;
    }
    for (const entry of entries) {
      entry.track.splice(entry.track.indexOf(entry.item), 1);
    }
    return entries.length > 0;
  }

  if (patch.type === 'moveTrackItems') {
    const resolved = patch.moves.map((move) => ({
      move,
      source: resolveTrackItem(score, move.source, patchContext),
      destination: resolveTrackRef(score, move.destination, patchContext),
    }));
    if (resolved.some((entry) => !entry.source || !entry.destination)) return false;
    const entries = resolved as Array<{
      move: TrackItemMove;
      source: ResolvedTrackItem;
      destination: ResolvedTrackRef;
    }>;
    if (new Set(entries.map((entry) => entry.source.item)).size !== entries.length) return false;
    for (const entry of entries) {
      if (!entry.destination.track.accepts(entry.source.item)) return false;
      if (!Number.isFinite(entry.move.targetStartBeats)) return false;
      if (entry.source.track.indexOf(entry.source.item) < 0) return false;
    }
    for (const entry of entries) {
      const sourceIndex = entry.source.track.indexOf(entry.source.item);
      entry.source.track.splice(sourceIndex, 1);
      setTrackItemTiming(entry.source.item, context, entry.move.targetStartBeats);
      entry.destination.track.push(entry.source.item);
    }
    return entries.length > 0;
  }

  if (patch.type === 'resizeTrackItems') {
    const resolved = patch.resizes.map((resize) => ({
      resize,
      target: resolveTrackItem(score, resize.target, patchContext),
    }));
    if (resolved.some((entry) => !entry.target)) return false;
    const entries = resolved as Array<{ resize: TrackItemResize; target: ResolvedTrackItem }>;
    if (new Set(entries.map((entry) => entry.target.item)).size !== entries.length) return false;
    for (const entry of entries) {
      if (
        !Number.isFinite(entry.resize.targetStartBeats) ||
        !Number.isFinite(entry.resize.targetDurationBeats) ||
        entry.resize.targetDurationBeats <= 0 ||
        entry.target.track.indexOf(entry.target.item) < 0
      ) {
        return false;
      }
    }
    for (const entry of entries) {
      setTrackItemTiming(
        entry.target.item,
        context,
        entry.resize.targetStartBeats,
        entry.resize.targetDurationBeats,
      );
    }
    return entries.length > 0;
  }

  const target = resolveTrackRef(score, patch.track, patchContext);
  if (!target) return false;

  if (patch.type === 'replaceTrackNoteProcessorChain') {
    target.track.setNoteProcessorChain(
      patch.chain
        ? reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot)
        : new NoteProcessorChain(),
    );
    return true;
  }

  if (patch.type === 'createTrackInstrument') {
    target.track.setInstrument(createInstrumentForType(patch.instrumentType));
    return true;
  }

  if (patch.type === 'replaceTrackInstrument') {
    if (patch.instrument.type === 'unknown') return false;
    target.track.setInstrument(createInstrumentFromSnapshot(patch.instrument));
    return true;
  }

  if (patch.type === 'clearTrackInstrument') {
    if (!target.track.getInstrument()) return false;
    target.track.clearInstrument();
    return true;
  }

  if (patch.type === 'updateTrackInstrument') {
    const instrument = target.track.getInstrument();
    if (!instrument) return false;
    return applyInstrumentPatch(instrument, patch.patch);
  }

  return false;
}

export function applyConvertToPolyObjectPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'convertToPolyObject' },
): boolean {
  const score = data.getScore();
  const context = score.getTimeContext();

  const targetGroup = findLayerGroupByGroupId(score, patch.targetGroupId);
  if (!(targetGroup instanceof PolyObject)) return false;
  if (patch.targetLayerIndex < 0 || patch.targetLayerIndex >= targetGroup.length) return false;

  const destLayer = targetGroup[patch.targetLayerIndex];
  if (!(destLayer instanceof SoundLayer)) return false;

  const resolvedTargets: Array<{
    sObj: SoundObject;
  }> = [];
  const seenObjects = new Set<SoundObject>();
  const lookupCache: ScoreLookupCache = {};

  for (const target of patch.targets) {
    const location =
      target.ownerKind === 'library' && target.displayContext === 'instance'
        ? target.sourceInstanceLocation
        : target.location;
    if (!location) return false;

    const resolved = resolveTimelineTargetWithSelectionId(
      data,
      location,
      target.selectionId,
      lookupCache,
    );
    if (!resolved || resolved.sObj instanceof AudioClip || seenObjects.has(resolved.sObj))
      return false;

    seenObjects.add(resolved.sObj);
    resolvedTargets.push({ sObj: resolved.sObj });
  }

  if (resolvedTargets.length === 0 || resolvedTargets.length !== patch.targets.length) return false;

  const allLayers: Array<SoundLayer | TrackLayer> = [];
  const collectLayers = (container: ManagedLayerGroup): void => {
    if (container instanceof PatternsLayerGroup) return;
    for (let i = 0; i < container.length; i += 1) {
      const layer = container[i];
      if (layer) {
        allLayers.push(layer as SoundLayer | TrackLayer);
        for (const child of layer) {
          if (child instanceof PolyObject) {
            collectLayers(child);
          }
        }
      }
    }
  };

  for (const group of score) {
    if (isManagedLayerGroup(group)) {
      collectLayers(group);
    }
  }

  let layerMin = Infinity;
  let layerMax = -Infinity;
  let startBeatsMin = Infinity;

  const targetItems: Array<{
    sObj: SoundObject;
    layer: SoundLayer | TrackLayer;
    globalLayerIndex: number;
  }> = [];

  const layerIndexByObject = new Map<SoundObject, number>();
  for (let gIdx = 0; gIdx < allLayers.length; gIdx += 1) {
    const l = allLayers[gIdx]!;
    for (const child of l) {
      if (seenObjects.has(child as SoundObject) && !layerIndexByObject.has(child as SoundObject)) {
        layerIndexByObject.set(child as SoundObject, gIdx);
      }
    }
  }

  for (const item of resolvedTargets) {
    const sObj = item.sObj;
    let gIdx = layerIndexByObject.get(sObj) ?? -1;
    if (gIdx === -1) {
      gIdx = allLayers.findIndex((l) => l.includes(sObj) || ('contains' in l && l.contains(sObj)));
    }
    if (gIdx === -1) return false;
    const layer = allLayers[gIdx]!;

    const startBeats = sObj.getStartTime().toBeats(context);
    if (startBeats < startBeatsMin) {
      startBeatsMin = startBeats;
    }
    if (gIdx < layerMin) {
      layerMin = gIdx;
    }
    if (gIdx > layerMax) {
      layerMax = gIdx;
    }

    targetItems.push({
      sObj,
      layer,
      globalLayerIndex: gIdx,
    });
  }

  if (
    targetItems.length === 0 ||
    targetItems.length !== resolvedTargets.length ||
    !Number.isFinite(layerMin) ||
    !Number.isFinite(layerMax)
  ) {
    return false;
  }

  const pObj = new PolyObject(false);
  pObj.setName('polyObject');
  const numLayers = layerMax - layerMin + 1;
  for (let i = 0; i < numLayers; i += 1) {
    pObj.newLayerAt(-1);
  }

  if (!destLayer.accepts(pObj)) return false;

  for (const item of targetItems) {
    item.layer.remove(item.sObj);
    const destLayerIndex = item.globalLayerIndex - layerMin;
    pObj[destLayerIndex].push(item.sObj);
  }

  pObj.normalizeSoundObjects(context);
  pObj.setStartTime(TimePosition.beats(startBeatsMin));

  if (patch.selectionId?.trim()) {
    const trimmedId = patch.selectionId.trim();
    assignExplicitScoreObjectId(pObj, trimmedId);
    recordScoreObjectIdForData(data, trimmedId);
  }

  destLayer.push(pObj);

  const instances = collectInstanceSoundObjects([pObj]);
  if (instances.length > 0) {
    data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects(instances);
  }

  return true;
}

/**
 * Atomic boolean-cell mutation for one PatternsLayerGroup. All layer IDs and
 * cell indices are validated before any PatternData is touched; duplicate
 * (layerId, cellIndex) writes reduce to the last change in patch order. A
 * valid patch that only repeats existing values is a no-op (changed: false).
 */
export function applyUpdatePatternCellsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updatePatternCells' },
): boolean {
  if (patch.changes.length === 0) return false;
  const group = findPatternsLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!group) return false;

  const layerById = new Map<string, PatternLayer>();
  for (const layer of group) {
    layerById.set(assignPatternLayerId(layer), layer);
  }

  const writes: Array<{ layerId: string; cellIndex: number; active: boolean }> = [];
  const writeIndexByKey = new Map<string, number>();
  for (const change of patch.changes) {
    if (!Number.isInteger(change.cellIndex) || change.cellIndex < 0) return false;
    if (!layerById.has(change.layerId)) return false;
    const key = `${change.layerId}:${change.cellIndex}`;
    const existingIndex = writeIndexByKey.get(key);
    if (existingIndex === undefined) {
      writeIndexByKey.set(key, writes.length);
      writes.push({ layerId: change.layerId, cellIndex: change.cellIndex, active: change.active });
    } else {
      writes[existingIndex] = {
        layerId: change.layerId,
        cellIndex: change.cellIndex,
        active: change.active,
      };
    }
  }

  let changed = false;
  for (const write of writes) {
    const layer = layerById.get(write.layerId)!;
    const patternData = layer.getPatternData();
    if (patternData.isPatternSet(write.cellIndex) === write.active) continue;
    patternData.setPattern(write.cellIndex, write.active);
    changed = true;
  }
  return changed;
}

/**
 * Validated group-wide step-length update. Only finite positive integers are
 * accepted (preserving the Java int model); malformed raw values stay in place
 * until an explicit valid resize. An unchanged value is a no-op.
 */
export function applyUpdatePatternBeatsLengthPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'updatePatternBeatsLength' },
): boolean {
  const group = findPatternsLayerGroupByGroupId(data.getScore(), patch.groupId);
  if (!group) return false;
  const length = patch.patternBeatsLength;
  if (!Number.isInteger(length) || length <= 0) return false;
  if (group.getPatternBeatsLength() === length) return false;
  group.setPatternBeatsLength(length);
  return true;
}

function getScoreObjectColorTargetKey(
  target: ScoreObjectEditorTargetSnapshot | null | undefined,
): string | null {
  if (!target) return null;
  if (target.patternSource) {
    const ps = target.patternSource;
    return `pat:${ps.groupId}:${ps.layerId}:${ps.sourceObjectId}`;
  }
  if (target.location) {
    const loc = target.location;
    return `loc:${loc.rootGroupIndex}:${(loc.containerPath ?? []).join('/')}:${loc.layerIndex}:${loc.objectIndex}`;
  }
  if (target.selectionId) return `sel:${target.selectionId}`;
  return null;
}

function resolveScoreObjectColorUpdates(
  data: BlueData,
  updates: unknown,
): Array<{ sObj: SoundObject | AudioClip; color: number }> | null {
  if (!Array.isArray(updates)) return null;

  const seenKeys = new Set<string>();
  const seenObjects = new Set<SoundObject | AudioClip>();
  const resolvedList: Array<{ sObj: SoundObject | AudioClip; color: number }> = [];
  const lookupCache: ScoreLookupCache = {};

  for (const update of updates) {
    if (!update || typeof update !== 'object') return null;
    const candidate = update as {
      target?: ScoreObjectEditorTargetSnapshot;
      backgroundColor?: unknown;
    };
    const target = candidate.target;
    if (!target || !isValidLayerColorInput(candidate.backgroundColor)) return null;
    if (target.ownerKind === 'blueLive' || target.ownerKind === 'library') return null;

    const key = getScoreObjectColorTargetKey(target);
    if (!key || seenKeys.has(key)) return null;
    seenKeys.add(key);

    let resolved: { sObj: SoundObject | AudioClip; isLibraryOwned: boolean } | null;
    try {
      resolved = resolveEditorTarget(data, target, lookupCache);
    } catch {
      return null;
    }
    if (!resolved || resolved.isLibraryOwned || !isColorManaged(resolved.sObj)) {
      return null;
    }

    if (seenObjects.has(resolved.sObj)) return null;
    seenObjects.add(resolved.sObj);
    resolvedList.push({
      sObj: resolved.sObj,
      color: normalizeLayerColor(candidate.backgroundColor),
    });
  }

  return resolvedList;
}

function areEquivalentScoreColors(left: number, right: number): boolean {
  if (left === right) return true;
  if (!isValidLayerColorInput(left) || !isValidLayerColorInput(right)) return false;
  return normalizeLayerColor(left) === normalizeLayerColor(right);
}

/**
 * Reports whether a score color patch is valid and resolves to project-owned
 * color state. This deliberately differs from the boolean mutation result:
 * valid no-op layer and item edits are accepted even when no setter runs.
 */
export function isScoreColorPatchAccepted(data: BlueData, patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'updateLayerState': {
      const color = patch.patch?.backgroundColor;
      if (!isValidLayerColorInput(color) || !Number.isInteger(patch.layerIndex)) return false;
      const group = findLayerGroupByGroupId(data.getScore(), patch.groupId);
      const layer = group?.[patch.layerIndex];
      return !!group && !!layer && isLayerStateManagedLayer(layer) && isColorManaged(layer);
    }
    case 'updateSharedProperties': {
      if (!isValidLayerColorInput(patch.patch?.backgroundColor)) return false;
      if (patch.target?.ownerKind === 'blueLive' || patch.target?.ownerKind === 'library')
        return false;
      let resolved: { sObj: SoundObject | AudioClip; isLibraryOwned: boolean } | null;
      try {
        resolved = resolveEditorTarget(data, patch.target);
      } catch {
        return false;
      }
      return !!resolved && !resolved.isLibraryOwned && isColorManaged(resolved.sObj);
    }
    case 'setScoreObjectBackgroundColors':
      return (
        Array.isArray(patch.updates) &&
        (patch.updates.length === 0 || resolveScoreObjectColorUpdates(data, patch.updates) !== null)
      );
    default:
      return false;
  }
}

export function applySetScoreObjectBackgroundColorsPatch(
  data: BlueData,
  patch: ScorePatch & { type: 'setScoreObjectBackgroundColors' },
): boolean {
  const resolvedList = resolveScoreObjectColorUpdates(data, patch.updates);
  if (!resolvedList || resolvedList.length === 0) return false;

  let changed = false;
  for (const { sObj, color } of resolvedList) {
    if (!areEquivalentScoreColors(sObj.getBackgroundColor(), color)) {
      sObj.setBackgroundColor(color);
      changed = true;
    }
  }

  return changed;
}

export type ScoreObjectLeafPatch = Extract<
  ScorePatch,
  {
    type:
      | 'updateSharedProperties'
      | 'updateSoundObjectBehavior'
      | 'replaceNoteProcessorChain'
      | 'replaceAudioFileSource'
      | 'updateAudioFilePostCode'
      | 'updateTypeSpecificEditor';
  }
>;

export function isScoreObjectLeafPatch(patch: ScorePatch): patch is ScoreObjectLeafPatch {
  return (
    patch.type === 'updateSharedProperties' ||
    patch.type === 'updateSoundObjectBehavior' ||
    patch.type === 'replaceNoteProcessorChain' ||
    patch.type === 'replaceAudioFileSource' ||
    patch.type === 'updateAudioFilePostCode' ||
    patch.type === 'updateTypeSpecificEditor'
  );
}

/**
 * Applies a single-target ScoreObject/AudioClip leaf edit directly to `sObj`
 * using the read-only project `TimeContext` without requiring a full `BlueData` clone.
 */
export function applyScoreObjectLeafPatch(
  sObj: SoundObject | AudioClip,
  patch: ScoreObjectLeafPatch,
  context: TimeContext,
  options?: { colorAccepted?: boolean },
): boolean {
  switch (patch.type) {
    case 'updateSharedProperties': {
      const p = patch.patch;
      if (p.backgroundColor !== undefined && !(options?.colorAccepted ?? true)) {
        return false;
      }

      let changed = false;
      if (p.name !== undefined && sObj.getName() !== p.name) {
        sObj.setName(p.name);
        changed = true;
      }
      if (p.backgroundColor !== undefined) {
        if (
          isColorManaged(sObj) &&
          !areEquivalentScoreColors(sObj.getBackgroundColor(), p.backgroundColor)
        ) {
          sObj.setBackgroundColor(p.backgroundColor);
          changed = true;
        }
      }
      if (p.startTime !== undefined) {
        const tb = p.startTime.timeBase as TimeBase;
        const tp = beatsToTimePosition(p.startTime.value, tb, context);
        if (!sObj.getStartTime().equals(tp)) {
          sObj.setStartTime(tp);
          changed = true;
        }
      }
      if (p.subjectiveDuration !== undefined) {
        const tb = p.subjectiveDuration.timeBase as TimeBase;
        const td = beatsToDuration(p.subjectiveDuration.value, tb, context);
        if (!sObj.getSubjectiveDuration().equals(td)) {
          sObj.setSubjectiveDuration(td);
          changed = true;
        }
      }
      return changed;
    }
    case 'updateSoundObjectBehavior': {
      if (!(sObj instanceof AbstractSoundObject)) return false;
      const p = patch.patch;
      if (p.timeBehavior !== undefined) {
        sObj.setTimeBehavior(p.timeBehavior as TimeBehavior);
      }
      if (p.repeatPoint !== undefined) {
        if (p.repeatPoint === null) {
          sObj.setRepeatPoint(null);
        } else {
          const tb = p.repeatPoint.timeBase as TimeBase;
          sObj.setRepeatPoint(beatsToDuration(p.repeatPoint.value, tb, context));
        }
      }
      return true;
    }
    case 'replaceNoteProcessorChain': {
      if (!(sObj instanceof AbstractSoundObject)) return false;
      if (patch.chain === null) {
        sObj.setNoteProcessorChain(new NoteProcessorChain());
      } else {
        const reified = reifyChainFromSnapshot(patch.chain as DataNoteProcessorChainSnapshot);
        sObj.setNoteProcessorChain(reified);
      }
      return true;
    }
    case 'replaceAudioFileSource': {
      if (!(sObj instanceof AudioFile)) return false;
      sObj.setSoundFileName(patch.filePath);
      sObj.setName(patch.name);
      return true;
    }
    case 'updateAudioFilePostCode': {
      if (!(sObj instanceof AudioFile)) return false;
      sObj.setCsoundPostCode(patch.csoundPostCode);
      return true;
    }
    case 'updateTypeSpecificEditor': {
      if (sObj instanceof ObjectBuilder) {
        const p = patch.patch;
        let changed = false;
        if (p.text !== undefined) {
          sObj.setCode(p.text as string);
          changed = true;
        }
        if (p.commandLine !== undefined) {
          sObj.setCommandLine(p.commandLine as string);
          changed = true;
        }
        if (p.languageType !== undefined) {
          sObj.setLanguageType(p.languageType as string);
          changed = true;
        }
        if (p.editEnabled !== undefined) {
          sObj.setEditEnabled(p.editEnabled as boolean);
          changed = true;
        }
        if (p.comment !== undefined) {
          sObj.setComment(p.comment as string);
          changed = true;
        }
        if (p.bsbInterfacePatch !== undefined) {
          changed =
            applyObjectBuilderBsbInterfacePatch(sObj, p.bsbInterfacePatch as BsbInterfacePatch) ||
            changed;
        }
        return changed;
      }
      if (patch.patch.text !== undefined) {
        return setCodeText(sObj as SoundObject, patch.patch.text as string);
      }
      if (sObj instanceof JavaScriptObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof PythonObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof ClojureObject) {
        const p = patch.patch;
        if (p.onLoadProcessable !== undefined) {
          sObj.setOnLoadProcessable(p.onLoadProcessable as boolean);
          return true;
        }
      }
      if (sObj instanceof External) {
        const ext = sObj as External;
        const p = patch.patch;
        if (p.scoreText !== undefined) ext.setText(p.scoreText as string);
        if (p.commandLine !== undefined) ext.setCommandLine(p.commandLine as string);
        if (p.syntaxType !== undefined) ext.setSyntaxType(p.syntaxType as string);
        return true;
      }
      if (sObj instanceof TrackerObject) {
        const to = sObj as TrackerObject;
        const p = patch.patch;
        if (p.showNoteNames !== undefined) {
          to.setKeyboardNotesEnabled(p.showNoteNames === true);
        }
        if (p.octave !== undefined) {
          to.setKeyboardOctave(p.octave as number);
        }
        if (Array.isArray(p.cellChanges)) {
          const trackList = to.getTracks();
          for (const change of p.cellChanges as Array<{
            trackId: string;
            rowIndex: number;
            columnId: string;
            value: string | number | null;
          }>) {
            const trackIdx = parseInt(change.trackId.replace('tracker-track-', ''), 10);
            if (
              trackIdx >= 0 &&
              trackIdx < trackList.size() &&
              change.columnId.startsWith('track-')
            ) {
              const track = trackList.getTrack(trackIdx)!;
              if (change.rowIndex >= 0 && change.rowIndex < track.getNumSteps()) {
                const trNote = track.getTrackerNote(change.rowIndex);
                const val = String(change.value ?? '').trim();
                if (val === '-') {
                  trNote.setTied(true);
                  trNote.setOff(false);
                } else if (val.toUpperCase() === 'OFF') {
                  trNote.setOff(true);
                  trNote.setTied(false);
                } else {
                  trNote.setTied(false);
                  trNote.setOff(false);
                  trNote.setValue(1, val);
                }
              }
            }
          }
        }
        if (p.stepsPerBeat !== undefined) to.setStepsPerBeat(p.stepsPerBeat as number);
        if (p.steps !== undefined) {
          to.getTracks().setSteps(p.steps as number);
        }
        if (p.updateTrackCell !== undefined) {
          const { trackIndex, columnIndex, stepIndex, value } = p.updateTrackCell as {
            trackIndex: number;
            columnIndex: number;
            stepIndex: number;
            value: string;
          };
          const trackList = to.getTracks();
          if (trackIndex >= 0 && trackIndex < trackList.size()) {
            const track = trackList.getTrack(trackIndex)!;
            if (stepIndex >= 0 && stepIndex < track.getNumSteps()) {
              const trNote = track.getTrackerNote(stepIndex);
              const val = String(value ?? '').trim();

              if (columnIndex === -1) {
                // status column
                if (val === '-') {
                  trNote.setTied(true);
                  trNote.setOff(false);
                } else if (val.toUpperCase() === 'OFF') {
                  trNote.setOff(true);
                  trNote.setTied(false);
                } else {
                  trNote.setTied(false);
                  trNote.setOff(false);
                }
              } else {
                if (trNote.isOff()) {
                  return true;
                }
                const col = track.getColumn(columnIndex + 1);
                if (!col) {
                  return true;
                }
                if (!col.isValid(val)) {
                  // Java parity: invalid edits are rejected and prior value is preserved.
                  return true;
                }

                if (!trNote.isActive()) {
                  if (val.length === 0) {
                    return true;
                  }

                  let previousNote: TrackerNote | null = null;
                  for (let i = stepIndex - 1; i >= 0; i--) {
                    const temp = track.getTrackerNote(i);
                    if (temp.isActive()) {
                      previousNote = temp;
                      break;
                    }
                  }

                  if (previousNote) {
                    trNote.copyValues(previousNote);
                  } else {
                    for (let i = 1; i < track.getNumColumns(); i++) {
                      const c = track.getColumn(i);
                      if (c) {
                        trNote.setValue(i, c.getDefaultValue());
                      }
                    }
                  }
                }
                trNote.setValue(columnIndex + 1, val);
              }
            }
          }
        }
        if (p.updateTrackProperties !== undefined) {
          const { trackIndex, name, instrumentId, noteTemplate, columns } =
            p.updateTrackProperties as {
              trackIndex: number;
              name: string;
              instrumentId: string;
              noteTemplate: string;
              columns?: TrackerColumnSnapshot[];
            };
          const track = to.getTracks().getTrack(trackIndex);
          if (track) {
            track.setName(name);
            track.setInstrumentId(instrumentId);
            track.setNoteTemplate(noteTemplate);

            if (columns) {
              const oldCols: Column[] = [];
              for (let i = 1; i < track.getNumColumns(); i++) {
                const c = track.getColumn(i);
                if (c) oldCols.push(c);
              }
              const priorValues: string[][] = [];
              for (let rowIndex = 0; rowIndex < track.getNumSteps(); rowIndex++) {
                const trNote = track.getTrackerNote(rowIndex);
                const rowValues: string[] = [];
                for (let colIndex = 0; colIndex < oldCols.length; colIndex++) {
                  rowValues.push(trNote.getValue(colIndex + 1));
                }
                priorValues.push(rowValues);
              }
              const sourceIndexMap: Array<number | null> = columns.map((columnDef, newIndex) => {
                if (
                  typeof columnDef.sourceIndex === 'number' &&
                  Number.isInteger(columnDef.sourceIndex)
                ) {
                  const sourceIndex = columnDef.sourceIndex;
                  return sourceIndex >= 0 && sourceIndex < oldCols.length ? sourceIndex : null;
                }
                if (columnDef.sourceIndex === undefined) {
                  return newIndex >= 0 && newIndex < oldCols.length ? newIndex : null;
                }
                return null;
              });

              oldCols.forEach((c) => track.removeColumn(c));

              columns.forEach((columnDef) => {
                track.addColumn(createTrackerColumnFromSnapshot(columnDef));
              });

              for (let rowIndex = 0; rowIndex < track.getNumSteps(); rowIndex++) {
                const trNote = track.getTrackerNote(rowIndex);
                if (trNote.isOff()) {
                  continue;
                }
                for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                  const sourceIndex = sourceIndexMap[colIndex];
                  if (sourceIndex === null) {
                    continue;
                  }
                  const priorValue = priorValues[rowIndex]?.[sourceIndex] ?? '';
                  if (priorValue.trim().length > 0) {
                    trNote.setValue(colIndex + 1, priorValue);
                  }
                }
              }
            }
          }
        }
        if (p.addTrack !== undefined) {
          const trackList = to.getTracks();
          const newTrack = new Track();
          trackList.addTrack(newTrack);
        }
        if (p.duplicateTrack !== undefined) {
          const trackIdx = p.duplicateTrack as number;
          const track = to.getTracks().getTrack(trackIdx);
          if (track) {
            to.getTracks().addTrack(Track.fromOther(track), trackIdx + 1);
          }
        }
        if (p.clearTrack !== undefined) {
          const trackIdx = p.clearTrack as number;
          const track = to.getTracks().getTrack(trackIdx);
          if (track) {
            track.clearNotes();
          }
        }
        if (p.removeTrack !== undefined) {
          to.getTracks().removeTrack(p.removeTrack as number);
        }
        if (p.trackerAction !== undefined) {
          const action = p.trackerAction as {
            type: string;
            trackIndex: number;
            stepIndex: number;
            columnIndex: number;
            noteBuffer?: Array<Array<{ tied: boolean; off: boolean; fields: string[] }>>;
          };
          const trackList = to.getTracks();
          const track = trackList.getTrack(action.trackIndex);

          if (track) {
            const note =
              action.stepIndex >= 0 && action.stepIndex < track.getNumSteps()
                ? track.getTrackerNote(action.stepIndex)
                : null;

            switch (action.type) {
              case 'toggleTie':
                if (note && note.isActive() && !note.isOff()) {
                  note.setTied(!note.isTied());
                }
                break;
              case 'clearOrDuplicate':
                if (note) {
                  if (note.isOff() || note.isActive()) {
                    note.clear();
                  } else {
                    for (let i = action.stepIndex - 1; i >= 0; i--) {
                      const prev = track.getTrackerNote(i);
                      if (prev.isActive()) {
                        note.copyValues(prev);
                        break;
                      }
                    }
                  }
                }
                break;
              case 'setNoteOff':
                if (note) {
                  const wasOff = note.isOff();
                  note.clear();
                  note.setOff(!wasOff);
                }
                break;
              case 'incrementValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  const val = note.getValue(action.columnIndex + 1);
                  if (col && val && val !== '' && val !== '-' && val !== 'OFF') {
                    const newVal = col.getIncrementValue(val);
                    if (newVal !== null) note.setValue(action.columnIndex + 1, newVal);
                  }
                }
                break;
              case 'decrementValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  const val = note.getValue(action.columnIndex + 1);
                  if (col && val && val !== '' && val !== '-' && val !== 'OFF') {
                    const newVal = col.getDecrementValue(val);
                    if (newVal !== null) note.setValue(action.columnIndex + 1, newVal);
                  }
                }
                break;
              case 'deleteNote':
                if (note) {
                  note.clear();
                }
                break;
              case 'insertNote':
                if (action.stepIndex < track.getNumSteps() - 1) {
                  track.insertNote(action.stepIndex);
                }
                break;
              case 'removeNote':
                track.removeNote(action.stepIndex);
                break;
              case 'cutNotes': {
                const buffer = action.noteBuffer;
                if (buffer && buffer.length > 0) {
                  for (let i = 0; i < buffer.length; i++) {
                    const rowIndex = action.stepIndex + i;
                    if (rowIndex >= track.getNumSteps()) break;
                    const n = track.getTrackerNote(rowIndex);
                    n.clear();
                  }
                }
                break;
              }
              case 'pasteNotes': {
                const buf = action.noteBuffer;
                if (buf && buf.length > 0) {
                  for (let i = 0; i < buf.length; i++) {
                    const destRow = action.stepIndex + i;
                    if (destRow >= track.getNumSteps()) break;
                    const dest = track.getTrackerNote(destRow);
                    const src = buf[i];
                    const sourceNote = src?.[0];
                    if (!sourceNote) {
                      continue;
                    }
                    dest.clear();
                    if (sourceNote.off) {
                      dest.setOff(true);
                    } else {
                      dest.setTied(sourceNote.tied);
                      for (let f = 0; f < sourceNote.fields.length; f++) {
                        dest.setValue(f + 1, sourceNote.fields[f]);
                      }
                    }
                  }
                }
                break;
              }
              case 'setNoteValue':
                if (note && action.columnIndex >= 0) {
                  const col = track.getColumn(action.columnIndex + 1);
                  if (!col) {
                    break;
                  }
                  const buf2 = action.noteBuffer;
                  if (buf2 && buf2[0] && buf2[0][0]) {
                    const nextValue = String(buf2[0][0].fields[0] ?? '').trim();
                    if (!col.isValid(nextValue)) {
                      break;
                    }
                    if (!note.isActive()) {
                      if (nextValue.length === 0) {
                        break;
                      }

                      let previousNote: TrackerNote | null = null;
                      for (let i = action.stepIndex - 1; i >= 0; i--) {
                        const temp = track.getTrackerNote(i);
                        if (temp.isActive()) {
                          previousNote = temp;
                          break;
                        }
                      }

                      if (previousNote) {
                        note.copyValues(previousNote);
                      } else {
                        for (let i = 1; i < track.getNumColumns(); i++) {
                          const defaultCol = track.getColumn(i);
                          if (defaultCol) {
                            note.setValue(i, defaultCol.getDefaultValue());
                          }
                        }
                      }
                    }
                    note.setValue(action.columnIndex + 1, nextValue);
                  }
                }
                break;
            }
          }
        }
        return true;
      }
      if (sObj instanceof AudioClip) {
        const clip = sObj as AudioClip;
        const p = patch.patch;
        if (p.audioFile !== undefined) clip.setAudioFile(p.audioFile as string);
        if (p.fileStartTime !== undefined) clip.setFileStartTime(p.fileStartTime as number);
        if (p.fadeIn !== undefined) clip.setFadeIn(p.fadeIn as number);
        if (p.fadeInType !== undefined)
          clip.setFadeInType(toBlueDataFadeType(p.fadeInType as string));
        if (p.fadeOut !== undefined) clip.setFadeOut(p.fadeOut as number);
        if (p.fadeOutType !== undefined)
          clip.setFadeOutType(toBlueDataFadeType(p.fadeOutType as string));
        if (p.looping !== undefined) clip.setLooping(context, p.looping as boolean);
        return true;
      }
      if (sObj instanceof AudioFile) {
        const af = sObj as AudioFile;
        const p = patch.patch;
        let changed = false;
        if (p.filePath !== undefined) {
          af.setSoundFileName(p.filePath as string);
          changed = true;
        }
        if (p.csoundPostCode !== undefined) {
          af.setCsoundPostCode(p.csoundPostCode as string);
          changed = true;
        }
        return changed;
      }
      if (sObj instanceof FrozenSoundObject) {
        // FrozenSoundObject file path cannot be mutated through editor patch
        return false;
      }
      if (sObj instanceof PatternObject) {
        const po = sObj as PatternObject;
        const p = patch.patch;
        if (p.beats !== undefined || p.subDivisions !== undefined) {
          po.setTime(
            (p.beats as number | undefined) ?? po.getBeats(),
            (p.subDivisions as number | undefined) ?? po.getSubDivisions(),
          );
        }
        if (Array.isArray(p.patterns)) {
          const newPatterns = p.patterns as Array<{
            patternName: string;
            patternScore: string;
            muted: boolean;
            solo: boolean;
            values: boolean[];
          }>;
          while (po.size() > 0) {
            (po as unknown as { _patterns: Pattern[] })._patterns.pop();
          }
          for (const sp of newPatterns) {
            const np = new Pattern(sp.values.length);
            np.patternName = sp.patternName;
            np.patternScore = sp.patternScore;
            np.muted = sp.muted;
            np.solo = sp.solo;
            np.values = [...sp.values];
            po.addPattern(np);
          }
        }
        if (p.toggleStep !== undefined) {
          const { patternIndex, stepIndex } = p.toggleStep as {
            patternIndex: number;
            stepIndex: number;
          };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            const pat = po.getPattern(patternIndex);
            if (stepIndex >= 0 && stepIndex < pat.values.length) {
              pat.values[stepIndex] = !pat.values[stepIndex];
            }
          }
        }
        if (p.updatePatternScore !== undefined) {
          const { patternIndex, patternScore } = p.updatePatternScore as {
            patternIndex: number;
            patternScore: string;
          };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            po.getPattern(patternIndex).patternScore = patternScore;
          }
        }
        if (p.updatePatternName !== undefined) {
          const { patternIndex, patternName } = p.updatePatternName as {
            patternIndex: number;
            patternName: string;
          };
          if (patternIndex >= 0 && patternIndex < po.size()) {
            po.getPattern(patternIndex).patternName = patternName;
          }
        }
        if (p.toggleMute !== undefined) {
          const idx = p.toggleMute as number;
          if (idx >= 0 && idx < po.size()) {
            po.getPattern(idx).muted = !po.getPattern(idx).muted;
          }
        }
        if (p.toggleSolo !== undefined) {
          const idx = p.toggleSolo as number;
          if (idx >= 0 && idx < po.size()) {
            po.getPattern(idx).solo = !po.getPattern(idx).solo;
          }
        }
        if (p.addPattern !== undefined) {
          const numSteps = po.getBeats() * po.getSubDivisions();
          po.addPattern(new Pattern(numSteps));
        }
        return true;
      }
      if (sObj instanceof ZakLineObject) {
        const zlo = sObj as ZakLineObject;
        const p = patch.patch;
        if (p.zakSpace !== undefined) zlo.setZakSpace(p.zakSpace as number);
        if (Array.isArray(p.lines)) {
          const existingLines = zlo.getLines();
          const newLines = p.lines as Array<{
            channel: number;
            min?: number;
            max?: number;
            resolution?: string;
            color: number;
            rightBound?: boolean;
            endPointsLinked?: boolean;
            points: Array<{ x: number; y: number }>;
          }>;
          (zlo as unknown as { _lines: typeof newLines })._lines = newLines.map((line, index) => ({
            channel: line.channel,
            min: typeof line.min === 'number' ? line.min : existingLines[index]?.min,
            max: typeof line.max === 'number' ? line.max : existingLines[index]?.max,
            resolution:
              typeof line.resolution === 'string'
                ? line.resolution
                : existingLines[index]?.resolution,
            color: line.color,
            rightBound:
              typeof line.rightBound === 'boolean'
                ? line.rightBound
                : existingLines[index]?.rightBound,
            endPointsLinked:
              typeof line.endPointsLinked === 'boolean'
                ? line.endPointsLinked
                : existingLines[index]?.endPointsLinked,
            points: line.points.map((pt) => ({ x: pt.x, y: pt.y })),
          }));
        }
        return true;
      }
      if (sObj instanceof LineObject) {
        const lo = sObj as LineObject;
        const p = patch.patch;
        if (p.lines !== undefined) {
          const existingLines = lo.getLines();
          const inner = lo as unknown as {
            _lines: Array<{
              varName: string;
              min?: number;
              max?: number;
              resolution?: string;
              color: number;
              rightBound?: boolean;
              endPointsLinked?: boolean;
              points: Array<{ x: number; y: number }>;
            }>;
          };
          inner._lines = (
            p.lines as Array<{
              varName: string;
              min?: number;
              max?: number;
              resolution?: string;
              color: number;
              rightBound?: boolean;
              endPointsLinked?: boolean;
              points: Array<{ x: number; y: number }>;
            }>
          ).map((line, index) => ({
            varName: line.varName,
            min: typeof line.min === 'number' ? line.min : existingLines[index]?.min,
            max: typeof line.max === 'number' ? line.max : existingLines[index]?.max,
            resolution:
              typeof line.resolution === 'string'
                ? line.resolution
                : existingLines[index]?.resolution,
            color: line.color,
            rightBound:
              typeof line.rightBound === 'boolean'
                ? line.rightBound
                : existingLines[index]?.rightBound,
            endPointsLinked:
              typeof line.endPointsLinked === 'boolean'
                ? line.endPointsLinked
                : existingLines[index]?.endPointsLinked,
            points: line.points.map((pt) => ({ x: pt.x, y: pt.y })),
          }));
        }
        return true;
      }
      if (sObj instanceof JMask) {
        const jm = sObj as JMask;
        const p = patch.patch;
        if (p.seedUsed !== undefined) jm.setSeedUsed(p.seedUsed as boolean);
        if (p.seed !== undefined) jm.setSeed(p.seed as number | string);
        if (p.field !== undefined) {
          const nextFieldSnapshot = mergeJMaskSnapshotValue(
            createJMaskEditorPayload(jm).field,
            p.field,
          ) as Record<string, unknown>;
          jm.setField(loadFieldFromSnapshot(nextFieldSnapshot));
        }
        return true;
      }
      if (sObj instanceof PianoRoll) {
        const pr = sObj as PianoRoll;
        const p = patch.patch;
        if (p.instrumentId !== undefined) pr.setInstrumentId(p.instrumentId as string);
        if (p.noteTemplate !== undefined) pr.setNoteTemplate(p.noteTemplate as string);
        if (p.pchGenerationMethod !== undefined)
          pr.setPchGenerationMethod(p.pchGenerationMethod as number);
        if (p.transposition !== undefined) pr.setTransposition(p.transposition as number);
        if (p.pixelSecond !== undefined) pr.setPixelSecond(p.pixelSecond as number);
        if (p.noteHeight !== undefined) pr.setNoteHeight(p.noteHeight as number);
        if (p.snapEnabled !== undefined) pr.setSnapEnabled(p.snapEnabled as boolean);
        if (p.snapValue !== undefined && isValidSnapValueName(p.snapValue as string)) {
          pr.setSnapValueEnum(p.snapValue as SnapValueName);
        }
        if (p.scale !== undefined) {
          const scale = createScaleFromSnapshot(p.scale as MidiScaleSnapshot | null);
          if (scale) {
            pr.setScale(scale);
          }
        }
        if (Array.isArray(p.fieldDefinitions)) {
          applyPianoRollFieldDefinitions(
            pr,
            p.fieldDefinitions as Array<{
              fieldName: string;
              fieldType: string;
              minValue: number;
              maxValue: number;
              defaultValue: number;
            }>,
          );
        }
        if (p.addFieldDef !== undefined) {
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr);
          fieldDefinitions.push(
            p.addFieldDef as {
              fieldName: string;
              fieldType: string;
              minValue: number;
              maxValue: number;
              defaultValue: number;
            },
          );
          applyPianoRollFieldDefinitions(pr, fieldDefinitions);
        }
        if (p.updateFieldDef !== undefined) {
          const update = p.updateFieldDef as Partial<{
            fieldName: string;
            fieldType: string;
            minValue: number;
            maxValue: number;
            defaultValue: number;
          }> & { index: number };
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr);
          if (update.index >= 0 && update.index < fieldDefinitions.length) {
            fieldDefinitions[update.index] = {
              ...fieldDefinitions[update.index]!,
              ...update,
            };
            applyPianoRollFieldDefinitions(pr, fieldDefinitions);
          }
        }
        if (typeof p.removeFieldDef === 'number') {
          const fieldDefinitions = getPianoRollFieldDefinitionsSnapshot(pr).filter(
            (_, index) => index !== p.removeFieldDef,
          );
          applyPianoRollFieldDefinitions(pr, fieldDefinitions);
        }
        if (p.useGlobalRuler !== undefined) pr.setUseGlobalRuler(p.useGlobalRuler as boolean);
        if (p.primaryTimeDisplay !== undefined && isValidTimeBase(p.primaryTimeDisplay)) {
          pr.setPrimaryTimeDisplay(p.primaryTimeDisplay);
        }
        if (p.secondaryTimeDisplay !== undefined && isValidTimeBase(p.secondaryTimeDisplay)) {
          pr.setSecondaryTimeDisplay(p.secondaryTimeDisplay);
        }
        if (p.secondaryRulerEnabled !== undefined) {
          pr.setSecondaryRulerEnabled(p.secondaryRulerEnabled as boolean);
        }

        if (p.pianoRollNoteBatch !== undefined) {
          const batch = p.pianoRollNoteBatch as {
            operations: Array<{
              kind: string;
              noteIndex?: number;
              note?: {
                octave: number;
                scaleDegree: number;
                start: number;
                duration: number;
                fieldValues?: number[];
                noteTemplate?: string | null;
              };
              notes?: Array<{
                octave: number;
                scaleDegree: number;
                start: number;
                duration: number;
                fieldValues?: number[];
                noteTemplate?: string | null;
              }>;
              noteIndices?: number[];
              deltaStart?: number;
              deltaDuration?: number;
              deltaOctave?: number;
              deltaScaleDegree?: number;
            }>;
          };
          const fieldDefs = pr.getFieldDefinitions();
          for (const op of batch.operations) {
            switch (op.kind) {
              case 'add': {
                if (op.note) {
                  const pn = new PianoNote();
                  pn.initFields(fieldDefs);
                  pn.setOctave(op.note.octave);
                  pn.setScaleDegree(op.note.scaleDegree);
                  pn.setStart(op.note.start);
                  pn.setDuration(op.note.duration);
                  if (op.note.noteTemplate !== undefined) pn.setNoteTemplate(op.note.noteTemplate);
                  if (op.note.fieldValues) {
                    const fields = pn.getFields();
                    for (let fi = 0; fi < op.note.fieldValues.length && fi < fields.length; fi++) {
                      fields[fi]!.setValue(op.note.fieldValues[fi]!);
                    }
                  }
                  pr.addNote(pn);
                }
                break;
              }
              case 'addMany': {
                if (op.notes) {
                  for (const noteData of op.notes) {
                    const pn = new PianoNote();
                    pn.initFields(fieldDefs);
                    pn.setOctave(noteData.octave);
                    pn.setScaleDegree(noteData.scaleDegree);
                    pn.setStart(noteData.start);
                    pn.setDuration(noteData.duration);
                    if (noteData.noteTemplate !== undefined)
                      pn.setNoteTemplate(noteData.noteTemplate);
                    if (noteData.fieldValues) {
                      const fields = pn.getFields();
                      for (
                        let fi = 0;
                        fi < noteData.fieldValues.length && fi < fieldDefs.length;
                        fi++
                      ) {
                        if (fi < fields.length) {
                          fields[fi]!.setValue(noteData.fieldValues[fi]!);
                        }
                      }
                    }
                    pr.addNote(pn);
                  }
                }
                break;
              }
              case 'remove': {
                if (op.noteIndices) {
                  const sorted = [...op.noteIndices].sort((a, b) => b - a);
                  const notes = pr.getNotes();
                  for (const idx of sorted) {
                    if (idx >= 0 && idx < notes.length) {
                      notes.splice(idx, 1);
                    }
                  }
                  pr.setNotes(notes);
                }
                break;
              }
              case 'move': {
                if (
                  op.noteIndex !== undefined &&
                  (op.deltaStart !== undefined ||
                    op.deltaOctave !== undefined ||
                    op.deltaScaleDegree !== undefined)
                ) {
                  const notes = pr.getNotes();
                  const note = notes[op.noteIndex];
                  if (note) {
                    if (op.deltaStart !== undefined) note.setStart(note.getStart() + op.deltaStart);
                    if (op.deltaOctave !== undefined)
                      note.setOctave(note.getOctave() + op.deltaOctave);
                    if (op.deltaScaleDegree !== undefined)
                      note.setScaleDegree(note.getScaleDegree() + op.deltaScaleDegree);
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'resize': {
                if (op.noteIndex !== undefined && op.deltaDuration !== undefined) {
                  const notes = pr.getNotes();
                  const note = notes[op.noteIndex];
                  if (note) {
                    note.setDuration(Math.max(0.125, note.getDuration() + op.deltaDuration));
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'update': {
                if (op.noteIndex !== undefined && op.note) {
                  const notes = pr.getNotes();
                  const existing = notes[op.noteIndex];
                  if (existing) {
                    if (op.note.octave !== undefined) existing.setOctave(op.note.octave);
                    if (op.note.scaleDegree !== undefined)
                      existing.setScaleDegree(op.note.scaleDegree);
                    if (op.note.start !== undefined) existing.setStart(op.note.start);
                    if (op.note.duration !== undefined) existing.setDuration(op.note.duration);
                    if (op.note.noteTemplate !== undefined)
                      existing.setNoteTemplate(op.note.noteTemplate);
                    if (op.note.fieldValues) {
                      const fields = existing.getFields();
                      for (
                        let fi = 0;
                        fi < op.note.fieldValues.length && fi < fields.length;
                        fi++
                      ) {
                        fields[fi]!.setValue(op.note.fieldValues[fi]!);
                      }
                    }
                    pr.setNotes(notes);
                  }
                }
                break;
              }
              case 'replace': {
                if (op.notes) {
                  const newNotes: PianoNote[] = [];
                  for (const noteData of op.notes) {
                    const pn = new PianoNote();
                    pn.initFields(fieldDefs);
                    pn.setOctave(noteData.octave);
                    pn.setScaleDegree(noteData.scaleDegree);
                    pn.setStart(noteData.start);
                    pn.setDuration(noteData.duration);
                    if (noteData.noteTemplate !== undefined)
                      pn.setNoteTemplate(noteData.noteTemplate);
                    if (noteData.fieldValues) {
                      const fields = pn.getFields();
                      for (
                        let fi = 0;
                        fi < noteData.fieldValues.length && fi < fields.length;
                        fi++
                      ) {
                        fields[fi]!.setValue(noteData.fieldValues[fi]!);
                      }
                    }
                    newNotes.push(pn);
                  }
                  pr.setNotes(newNotes);
                }
                break;
              }
            }
          }
        }
        return true;
      }
      if (sObj instanceof Sound) {
        const snd = sObj as Sound;
        const p = patch.patch;
        if (p.comment !== undefined) snd.setComment(p.comment as string);

        if (p.bsbInterfacePatch !== undefined) {
          const bsb = snd.getBlueSynthBuilder();
          if (bsb) {
            applyBsbInterfacePatch(bsb, p.bsbInterfacePatch as BsbInterfacePatch);
          }
        }

        if (p.bsbCodePatch !== undefined) {
          const codePatch = p.bsbCodePatch as Record<string, string>;
          const bsb = snd.getBlueSynthBuilder();
          if (bsb) {
            if (codePatch.instrumentText !== undefined)
              bsb.setInstrumentText(codePatch.instrumentText);
            if (codePatch.alwaysOnInstrumentText !== undefined)
              bsb.setAlwaysOnInstrumentText(codePatch.alwaysOnInstrumentText);
            if (codePatch.globalOrc !== undefined) bsb.setGlobalOrc(codePatch.globalOrc);
            if (codePatch.globalSco !== undefined) bsb.setGlobalSco(codePatch.globalSco);
          }
        }

        if (p.bsbOpcodeListPatch !== undefined) {
          const bsb = snd.getBlueSynthBuilder();
          if (bsb) {
            applyEmbeddedOpcodeListPatch(
              bsb.getOpcodeList(),
              p.bsbOpcodeListPatch as EmbeddedOpcodeListPatch,
            );
          }
        }

        if (p.automationPatch !== undefined) {
          const autoPatch = p.automationPatch as {
            parameterId: string;
            automationEnabled?: boolean;
            points?: Array<{ x: number; y: number }>;
            curve?: string;
            resolutionDecimal?: string;
          };
          const bsb = snd.getBlueSynthBuilder();
          if (bsb) {
            const params = bsb.getParameters();
            const param = params.find(
              (pr: BlueDataParameter) =>
                pr.getUniqueId() === autoPatch.parameterId ||
                pr.getName() === autoPatch.parameterId,
            );
            if (param) {
              if (autoPatch.resolutionDecimal !== undefined) {
                try {
                  // Parse before applying the rest of the patch so malformed
                  // exact text cannot partially mutate the canonical sound.
                  param.setResolutionText(autoPatch.resolutionDecimal);
                } catch {
                  return false;
                }
              }
              if (autoPatch.automationEnabled !== undefined)
                param.setAutomationEnabled(autoPatch.automationEnabled);
              if (autoPatch.points !== undefined) {
                param.setPoints(
                  autoPatch.points.map((pt: { x: number; y: number }) => ({
                    time: pt.x,
                    value: pt.y,
                  })),
                );
              }
              if (autoPatch.curve !== undefined) {
                const curveKey = autoPatch.curve as keyof typeof BlueDataAutomationCurve;
                if (curveKey in BlueDataAutomationCurve) {
                  param.setCurve(BlueDataAutomationCurve[curveKey]);
                }
              }
            }
          }
        }

        return true;
      }
      return false;
    }
    default:
      return false;
  }
}
