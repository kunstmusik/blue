import {
  AudioClip,
  DEFAULT_LAYER_COLOR,
  Element,
  isValidLayerColorInput,
  loadSoundObjectFromXML,
  normalizeLayerColor,
  resolveGroupDefaultHeight,
} from '@blue/data';
import {
  areLayerRangesValid,
  isValidLayerRange,
  isValidLayerRangeTarget,
  type MarkerSnapshot,
  type NoteProcessorChainSnapshot,
  type PatternLayerSnapshot,
  type PatternScorePatch,
  type PatternSourceObjectSnapshot,
  type ScoreDocumentSnapshot,
  type ScoreLayerGroupSnapshot,
  type ScoreLayerGroupType,
  type ScoreLayerSnapshot,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLocationRef,
  type ScorePatch,
  type ScoreRowObjectSnapshot,
  type MeterMapPatch,
  type MeterMapSnapshot,
  type MeterSnapshot,
  type TempoMapPatch,
  type TempoMapSnapshot,
} from '../../../shared/project-editor';
import { updateScoreGroupLayers } from '../../lib/score-layer-snapshots';

let nextLocalScoreObjectId = 1;

export function createLocalScoreObjectId(objectType: string): string {
  const prefix = objectType === 'AudioClip' ? 'aclp' : 'sobj';
  return `local-${prefix}-${nextLocalScoreObjectId++}`;
}

function createDefaultPatternLayerSnapshot(
  groupId: string,
  layerIndex: number,
): PatternLayerSnapshot {
  const layerId = `pl-local-${groupId}-${layerIndex}`;
  const objectId = `local-sobj-pattern-${groupId}-${layerIndex}`;
  const sourceObject: PatternSourceObjectSnapshot = {
    objectId,
    objectType: 'GenericScore',
    name: '',
    backgroundColor: 0x404040,
    editorTarget: {
      selectionId: objectId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      patternSource: { groupId, layerId, sourceObjectId: objectId },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
    barRenderer: {
      kind: 'generic',
      labelLines: [''],
      timeBehavior: 'NONE',
      repeatPointBeats: null,
    },
  };
  return {
    layerId,
    name: '',
    height: 44,
    backgroundColor: DEFAULT_LAYER_COLOR,
    muted: false,
    solo: false,
    items: [],
    sourceObject,
    activeCellIndices: [],
  };
}

function createDefaultScoreLayerSnapshot(groupId: string, layerIndex: number): ScoreLayerSnapshot {
  return {
    layerId: `${groupId}-layer-${layerIndex}`,
    name: '',
    height: 44,
    backgroundColor: DEFAULT_LAYER_COLOR,
    muted: false,
    solo: false,
    items: [],
  };
}

function createAddedLayerGroupSnapshot(
  groupType: ScoreLayerGroupType | undefined,
  options?: { now?: () => number },
): ScoreLayerGroupSnapshot {
  const timestamp = (options?.now ?? (() => Date.now()))();
  const groupId = `lg-${timestamp}`;
  const layers = [createDefaultScoreLayerSnapshot(groupId, 0)];

  switch (groupType ?? 'track') {
    case 'track': {
      const trackId = `${groupId}-track-0`;
      return {
        groupId,
        groupType: 'track',
        name: 'Track Layer Group',
        defaultHeightIndex: 0,
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          {
            ...layers[0]!,
            layerId: trackId,
            layerKind: 'track',
            instrument: null,
          },
        ],
      };
    }
    case 'patterns':
      return {
        groupId,
        groupType: 'patterns',
        name: 'Patterns Layer Group',
        layerCount: 1,
        isOpenableContainer: false,
        patternBeatsLength: 4,
        effectivePatternBeatsLength: 4,
        layers: [createDefaultPatternLayerSnapshot(groupId, 0)],
      };
    case 'polyObject':
    default:
      return {
        groupId,
        groupType: 'polyObject',
        name: 'SoundObject Layer Group',
        defaultHeightIndex: 0,
        layerCount: layers.length,
        isOpenableContainer: true,
        layers,
      };
  }
}

function splitBarLabelLines(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [''];
}

function applySharedPropertiesToBarRenderer(
  barRenderer: ScoreRowObjectSnapshot['barRenderer'],
  patch: {
    name?: string;
    subjectiveDuration?: { value: number; timeBase: string };
  },
): ScoreRowObjectSnapshot['barRenderer'] {
  let nextBarRenderer = barRenderer;

  if (patch.name !== undefined) {
    nextBarRenderer = {
      ...nextBarRenderer,
      labelLines: splitBarLabelLines(patch.name),
    };
  }

  if (patch.subjectiveDuration !== undefined && nextBarRenderer.kind === 'frozenSoundObject') {
    nextBarRenderer = {
      ...nextBarRenderer,
      currentDurationBeats: patch.subjectiveDuration.value,
    };
  }

  return nextBarRenderer;
}

function applySoundObjectBehaviorToBarRenderer(
  barRenderer: ScoreRowObjectSnapshot['barRenderer'],
  patch: {
    timeBehavior?: string;
    repeatPoint?: { value: number; timeBase: string } | null;
  },
): ScoreRowObjectSnapshot['barRenderer'] {
  switch (barRenderer.kind) {
    case 'generic':
    case 'letter':
    case 'pianoRoll':
      return {
        ...barRenderer,
        ...(patch.timeBehavior !== undefined ? { timeBehavior: patch.timeBehavior } : {}),
        ...(patch.repeatPoint !== undefined
          ? { repeatPointBeats: patch.repeatPoint?.value ?? null }
          : {}),
      };
    default:
      return barRenderer;
  }
}

export function createOptimisticBarRendererSnapshot(object: {
  name: string;
  objectType: string;
  serializedXml?: string;
  barRenderer?: ScoreRowObjectSnapshot['barRenderer'];
}): ScoreRowObjectSnapshot['barRenderer'] {
  if (object.barRenderer) {
    return object.barRenderer;
  }

  if (object.objectType === 'AudioClip') {
    return {
      kind: 'audioClip',
      labelLines: splitBarLabelLines(object.name),
      audioFilePath: '',
      waveformKey: null,
      fileStartTimeBeats: 0,
      audioDurationBeats: 0,
      looping: true,
      fadeInBeats: 0,
      fadeInType: 'LINEAR',
      fadeOutBeats: 0,
      fadeOutType: 'LINEAR',
    };
  }

  return {
    kind: 'fallback',
    labelLines: splitBarLabelLines(object.name),
    reason: 'unknown-type',
  };
}

export function findAddScoreObjectsTargetGroupIndex(
  score: ScoreDocumentSnapshot,
  objects: Array<{ groupId: string; objectType: string }>,
): number {
  if (objects.length === 0) {
    return -1;
  }

  const groupId = objects[0].groupId;
  const allAudio = objects.every((object) => object.objectType === 'AudioClip');
  const allSoundObjects = objects.every((object) => object.objectType !== 'AudioClip');

  return score.layerGroups.findIndex(
    (group) =>
      group.groupId === groupId &&
      ((group.groupType === 'track' && (allAudio || allSoundObjects)) ||
        (group.groupType === 'polyObject' && allSoundObjects)),
  );
}

export function applyTempoMapPatchToSnapshot(
  snap: TempoMapSnapshot,
  patch: TempoMapPatch,
): TempoMapSnapshot {
  switch (patch.type) {
    case 'setTempoEnabled':
      return { ...snap, enabled: patch.enabled };
    case 'setTempoVisible':
      return { ...snap, visible: patch.visible };
    case 'addTempoPoint': {
      if (!isFinite(patch.point.beat) || patch.point.beat < 0) return snap;
      if (!isFinite(patch.point.tempo) || patch.point.tempo <= 0) return snap;
      for (const ep of snap.points) {
        if (Math.abs(ep.beat - patch.point.beat) < 0.001) return snap;
      }
      return {
        ...snap,
        points: [...snap.points, { ...patch.point }].sort((a, b) => a.beat - b.beat),
      };
    }
    case 'updateTempoPoint': {
      const idx = patch.index;
      if (idx < 0 || idx >= snap.points.length) return snap;
      const current = snap.points[idx];
      const newBeat = patch.patch.beat ?? current.beat;
      const newTempo = patch.patch.tempo ?? current.tempo;
      const newCurve = patch.patch.curveType ?? current.curveType;
      if (idx === 0 && newBeat !== 0) return snap;
      if (!isFinite(newTempo) || newTempo <= 0) return snap;
      if (idx > 0 && newBeat <= snap.points[idx - 1].beat) return snap;
      if (idx < snap.points.length - 1 && newBeat >= snap.points[idx + 1].beat) return snap;
      const newPoints = [...snap.points];
      newPoints[idx] = { ...current, beat: newBeat, tempo: newTempo, curveType: newCurve };
      return { ...snap, points: newPoints };
    }
    case 'setTempoCurveType': {
      const idx = patch.index;
      if (idx < 0 || idx >= snap.points.length) return snap;
      if (snap.points[idx].curveType === patch.curveType) return snap;
      const newPoints = [...snap.points];
      newPoints[idx] = { ...newPoints[idx], curveType: patch.curveType };
      return { ...snap, points: newPoints };
    }
    case 'removeTempoPoint': {
      if (patch.index <= 0 || patch.index >= snap.points.length || snap.points.length <= 1)
        return snap;
      return { ...snap, points: snap.points.filter((_, i) => i !== patch.index) };
    }
    case 'replaceTempoMap': {
      return { ...patch.map };
    }
    default:
      return snap;
  }
}

function recomputeMeterStartBeats(entries: MeterSnapshot[]): MeterSnapshot[] {
  const result: MeterSnapshot[] = [];
  let accumulated = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    result.push({ ...e, startBeat: accumulated });
    if (i < entries.length - 1) {
      const beatsPerMeasure = e.numBeats * (4.0 / e.beatLength);
      accumulated += (entries[i + 1].measure - e.measure) * beatsPerMeasure;
    }
  }
  return result;
}

export function applyMeterMapPatchToSnapshot(
  snap: MeterMapSnapshot,
  patch: MeterMapPatch,
): MeterMapSnapshot {
  switch (patch.type) {
    case 'meter-map-set-entry': {
      const existing = snap.entries.findIndex((e) => e.measure === patch.measure);
      if (existing >= 0) {
        const newEntries = [...snap.entries];
        newEntries[existing] = {
          ...newEntries[existing],
          numBeats: patch.numBeats,
          beatLength: patch.beatLength,
        };
        return { entries: recomputeMeterStartBeats(newEntries) };
      }
      const newEntries = [
        ...snap.entries,
        {
          measure: patch.measure,
          numBeats: patch.numBeats,
          beatLength: patch.beatLength,
          startBeat: 0,
        },
      ];
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-update-entry': {
      const idx = snap.entries.findIndex((e) => e.measure === patch.previousMeasure);
      if (idx < 0) return snap;
      if (idx === 0 && patch.measure !== 1) return snap;
      if (idx > 0 && patch.measure <= snap.entries[idx - 1].measure) return snap;
      if (idx < snap.entries.length - 1 && patch.measure >= snap.entries[idx + 1].measure)
        return snap;
      const newEntries = [...snap.entries];
      newEntries[idx] = {
        measure: patch.measure,
        numBeats: patch.numBeats,
        beatLength: patch.beatLength,
        startBeat: 0,
      };
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-remove-entry': {
      if (patch.measure <= 1) return snap;
      const idx = snap.entries.findIndex((e) => e.measure === patch.measure);
      if (idx <= 0 || snap.entries.length <= 1) return snap;
      const newEntries = snap.entries.filter((_, i) => i !== idx);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    case 'meter-map-replace': {
      const newEntries = patch.entries.map((e) => ({
        measure: e.measure,
        numBeats: e.numBeats,
        beatLength: e.beatLength,
        startBeat: 0,
      }));
      newEntries.sort((a, b) => a.measure - b.measure);
      return { entries: recomputeMeterStartBeats(newEntries) };
    }
    default:
      return snap;
  }
}

export function computeEndOfScore(score: ScoreDocumentSnapshot): number {
  let maxBeat = 0;
  for (const lg of score.layerGroups) {
    for (const layer of lg.layers) {
      for (const item of layer.items) {
        maxBeat = Math.max(maxBeat, item.startBeats + item.durationBeats);
      }
    }
  }
  return maxBeat;
}

function sameScoreObjectLocation(
  a: ScoreObjectLocationRef | undefined,
  b: ScoreObjectLocationRef | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.rootGroupIndex !== b.rootGroupIndex) return false;
  if (a.layerIndex !== b.layerIndex || a.objectIndex !== b.objectIndex) return false;
  if (a.containerPath.length !== b.containerPath.length) return false;
  for (let i = 0; i < a.containerPath.length; i++) {
    const segA = a.containerPath[i];
    const segB = b.containerPath[i];
    if (segA.layerIndex !== segB.layerIndex || segA.objectIndex !== segB.objectIndex) return false;
  }
  return true;
}

function isScoreItemMatchingTarget(
  item: ScoreLayerSnapshot['items'][number],
  target: ScoreObjectEditorTargetSnapshot,
): boolean {
  if (target.ownerKind === 'blueLive') return false;
  const selectionId = target.selectionId.trim();
  if (selectionId) return item.objectId === selectionId;
  const itemTarget = item.editorTarget;
  if (!itemTarget) return false;

  if (target.location && sameScoreObjectLocation(itemTarget.location, target.location)) {
    return true;
  }
  if (
    target.sourceInstanceLocation &&
    sameScoreObjectLocation(itemTarget.sourceInstanceLocation, target.sourceInstanceLocation)
  ) {
    return true;
  }

  return false;
}

type ScoreColorSnapshotTarget = ScoreRowObjectSnapshot | PatternSourceObjectSnapshot;

function isPatternSourceMatchingTarget(
  sourceObject: PatternSourceObjectSnapshot,
  target: ScoreObjectEditorTargetSnapshot,
): boolean {
  if (target.patternSource) {
    const sourceRef = sourceObject.editorTarget.patternSource;
    const targetRef = target.patternSource;
    return (
      sourceRef?.groupId === targetRef.groupId &&
      sourceRef.layerId === targetRef.layerId &&
      sourceRef.sourceObjectId === targetRef.sourceObjectId
    );
  }

  return (
    sourceObject.objectId === target.selectionId ||
    sourceObject.editorTarget.selectionId === target.selectionId
  );
}

function findScoreColorSnapshotTarget(
  score: ScoreDocumentSnapshot,
  target: ScoreObjectEditorTargetSnapshot,
): ScoreColorSnapshotTarget | null {
  if (target.ownerKind === 'blueLive' || target.ownerKind === 'library') return null;

  const canMatchPatternSource =
    Boolean(target.patternSource) || (!target.location && !target.sourceInstanceLocation);
  for (const group of score.layerGroups) {
    if (group.groupType === 'patterns') {
      if (canMatchPatternSource) {
        for (const layer of group.layers) {
          if (isPatternSourceMatchingTarget(layer.sourceObject, target)) {
            return layer.sourceObject;
          }
        }
      }
      continue;
    }

    if (!target.location && !target.sourceInstanceLocation) continue;
    for (const layer of group.layers) {
      const item = layer.items.find((candidate) => isScoreItemMatchingTarget(candidate, target));
      if (item) return item;
    }
  }

  return null;
}

function getSerializedScoreObjectBackgroundColor(serializedXml: string | undefined): number | null {
  if (!serializedXml) return null;

  try {
    const serialized = Element.parse(serializedXml);
    const scoreObject =
      serialized.getName() === 'audioClip'
        ? AudioClip.loadFromXML(serialized)
        : loadSoundObjectFromXML(serialized);
    return scoreObject?.getBackgroundColor() ?? null;
  } catch {
    return null;
  }
}

export function resolveOptimisticScoreObjectColor(
  score: ScoreDocumentSnapshot,
  layer: ScoreLayerSnapshot,
  object: {
    backgroundColor?: number;
    serializedXml?: string;
    editorTarget?: ScoreObjectEditorTargetSnapshot;
  },
): number {
  if (object.backgroundColor !== undefined) return object.backgroundColor;

  const serializedColor = getSerializedScoreObjectBackgroundColor(object.serializedXml);
  if (serializedColor !== null) return serializedColor;

  if (object.editorTarget) {
    const source = findScoreColorSnapshotTarget(score, object.editorTarget);
    if (source) return source.backgroundColor;
  }

  return layer.backgroundColor ?? DEFAULT_LAYER_COLOR;
}

export function updateScoreItemLocation(
  item: ScoreLayerSnapshot['items'][number],
  rootGroupIndex: number,
  layerIndex: number,
  objectIndex: number,
  extra?: Partial<Pick<ScoreObjectLocationRef, 'rootGroupId' | 'layerId' | 'trackId'>>,
): ScoreLayerSnapshot['items'][number] {
  if (!item.editorTarget?.location && !item.editorTarget?.sourceInstanceLocation) {
    return item;
  }

  const updateLocationRef = (loc: ScoreObjectLocationRef): ScoreObjectLocationRef => ({
    ...loc,
    rootGroupIndex,
    layerIndex,
    objectIndex,
    ...(extra?.rootGroupId !== undefined ? { rootGroupId: extra.rootGroupId } : {}),
    ...(extra?.layerId !== undefined ? { layerId: extra.layerId } : {}),
    ...(extra?.trackId !== undefined ? { trackId: extra.trackId } : {}),
  });

  return {
    ...item,
    editorTarget: {
      ...item.editorTarget,
      ...(item.editorTarget.location
        ? { location: updateLocationRef(item.editorTarget.location) }
        : {}),
      ...(item.editorTarget.sourceInstanceLocation
        ? { sourceInstanceLocation: updateLocationRef(item.editorTarget.sourceInstanceLocation) }
        : {}),
    },
  };
}

export function applyMoveScoreObjectsToSnapshot(
  score: ScoreDocumentSnapshot,
  moves: Array<{
    objectId: string;
    targetStartBeats: number;
    targetLayerIndex?: number;
    targetGroupId?: string;
  }>,
): ScoreDocumentSnapshot {
  const moveMap = new Map(moves.map((move) => [move.objectId, move]));
  const movedIds = new Set(moves.map((move) => move.objectId));

  const additionsByGroupAndLayer = new Map<
    string,
    Map<number, Array<ScoreLayerSnapshot['items'][number]>>
  >();

  for (const lg of score.layerGroups) {
    for (let li = 0; li < lg.layers.length; li++) {
      for (const item of lg.layers[li].items) {
        const move = moveMap.get(item.objectId);
        if (!move) continue;

        const targetGroupId = move.targetGroupId ?? lg.groupId;
        const targetLi = move.targetLayerIndex ?? li;
        let groupMap = additionsByGroupAndLayer.get(targetGroupId);
        if (!groupMap) {
          groupMap = new Map();
          additionsByGroupAndLayer.set(targetGroupId, groupMap);
        }

        let list = groupMap.get(targetLi);
        if (!list) {
          list = [];
          groupMap.set(targetLi, list);
        }

        list.push({
          ...item,
          startBeats: Math.max(0, move.targetStartBeats),
        });
      }
    }
  }

  const newGroups = score.layerGroups.map((lg, groupIndex) => {
    const groupAdditions = additionsByGroupAndLayer.get(lg.groupId);
    const newLayers = updateScoreGroupLayers(lg, (sourceLayers) =>
      sourceLayers.map((layer, li) => {
        const kept = layer.items.filter((item) => !movedIds.has(item.objectId));
        const additions = groupAdditions?.get(li) ?? [];
        const combined = [...kept, ...additions];
        return {
          ...layer,
          items: combined.map((item, idx) => updateScoreItemLocation(item, groupIndex, li, idx)),
        };
      }),
    );
    return newLayers;
  });

  return { ...score, layerGroups: newGroups };
}

function cloneVisibleNoteProcessorChain(
  chain: NoteProcessorChainSnapshot | null,
): NoteProcessorChainSnapshot | undefined {
  if (!chain || chain.processors.length === 0) {
    return undefined;
  }
  return structuredClone(chain);
}

function applyPatternCellsToLayer(
  layer: PatternLayerSnapshot,
  cellIndex: number,
  active: boolean,
): PatternLayerSnapshot {
  const has = layer.activeCellIndices.includes(cellIndex);
  if (active === has) return layer;
  if (active) {
    const next = [...layer.activeCellIndices, cellIndex];
    next.sort((a, b) => a - b);
    return { ...layer, activeCellIndices: next };
  }
  return {
    ...layer,
    activeCellIndices: layer.activeCellIndices.filter((index) => index !== cellIndex),
  };
}

/**
 * Optimistic projection for the canonical pattern patch family. Cell writes
 * apply immutably per row (unknown rows are skipped; the canonical snapshot
 * corrects them), and step-length writes update both raw and effective values.
 */
export function applyPatternPatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: PatternScorePatch,
): ScoreDocumentSnapshot {
  if (patch.type === 'updatePatternBeatsLength') {
    const length = patch.patternBeatsLength;
    if (!Number.isInteger(length) || length <= 0) return score;
    const nextLayerGroups = score.layerGroups.map((lg) =>
      lg.groupType === 'patterns' &&
      lg.groupId === patch.groupId &&
      lg.patternBeatsLength !== length
        ? { ...lg, patternBeatsLength: length, effectivePatternBeatsLength: length }
        : lg,
    );
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.changes.length === 0) return score;
  let changed = false;
  const nextLayerGroups = score.layerGroups.map((lg) => {
    if (lg.groupType !== 'patterns' || lg.groupId !== patch.groupId) return lg;
    let layers = lg.layers;
    let groupChanged = false;
    for (const change of patch.changes) {
      if (!Number.isInteger(change.cellIndex) || change.cellIndex < 0) continue;
      const layerIndex = layers.findIndex((layer) => layer.layerId === change.layerId);
      if (layerIndex < 0) continue;
      const nextLayer = applyPatternCellsToLayer(
        layers[layerIndex]!,
        change.cellIndex,
        change.active,
      );
      if (nextLayer === layers[layerIndex]) continue;
      layers = [...layers];
      layers[layerIndex] = nextLayer;
      groupChanged = true;
    }
    if (!groupChanged) return lg;
    changed = true;
    return { ...lg, layers };
  });
  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}

function applyPatternSourceSharedProperties(
  score: ScoreDocumentSnapshot,
  target: ScoreObjectEditorTargetSnapshot,
  patch: { name?: string; backgroundColor?: number },
): ScoreDocumentSnapshot {
  const ref = target.patternSource!;
  let changed = false;
  const nextLayerGroups = score.layerGroups.map((lg) => {
    if (lg.groupType !== 'patterns' || lg.groupId !== ref.groupId) return lg;
    const layers = lg.layers.map((layer) => {
      if (layer.layerId !== ref.layerId || layer.sourceObject.objectId !== ref.sourceObjectId)
        return layer;
      let sourceObject = layer.sourceObject;
      if (patch.name !== undefined && sourceObject.name !== patch.name) {
        sourceObject = {
          ...sourceObject,
          name: patch.name,
          barRenderer: { ...sourceObject.barRenderer, labelLines: splitBarLabelLines(patch.name) },
        };
      }
      if (
        patch.backgroundColor !== undefined &&
        sourceObject.backgroundColor !== patch.backgroundColor
      ) {
        sourceObject = { ...sourceObject, backgroundColor: patch.backgroundColor };
      }
      if (sourceObject === layer.sourceObject) return layer;
      changed = true;
      return { ...layer, sourceObject };
    });
    return { ...lg, layers };
  });
  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}

export function applyScorePatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: ScorePatch,
  options?: { now?: () => number },
): ScoreDocumentSnapshot {
  const now = options?.now ?? (() => Date.now());
  if (patch.type === 'updateTrackLayerMuteSoloMode') {
    return {
      ...score,
      trackLayerMuteSoloMode: patch.mode,
    };
  }
  if (
    patch.type === 'addTrackItem' ||
    patch.type === 'moveTrackItems' ||
    patch.type === 'resizeTrackItems' ||
    patch.type === 'removeTrackItems' ||
    patch.type === 'replaceTrackNoteProcessorChain' ||
    patch.type === 'createTrackInstrument' ||
    patch.type === 'replaceTrackInstrument' ||
    patch.type === 'clearTrackInstrument' ||
    patch.type === 'updateTrackInstrument'
  ) {
    return applyTrackPatchToSnapshot(score, patch);
  }

  if (patch.type === 'updatePatternCells' || patch.type === 'updatePatternBeatsLength') {
    return applyPatternPatchToSnapshot(score, patch);
  }

  if (patch.type === 'updateSharedProperties' && patch.target.patternSource) {
    return applyPatternSourceSharedProperties(score, patch.target, patch.patch);
  }

  if (patch.type === 'removeScoreObjects') {
    if (patch.targets.length === 0) return score;
    const nextLayerGroups = score.layerGroups.map((lg, groupIndex) =>
      updateScoreGroupLayers(lg, (layers) =>
        layers.map((layer, layerIndex) => ({
          ...layer,
          items: layer.items
            .filter(
              (item) => !patch.targets.some((target) => isScoreItemMatchingTarget(item, target)),
            )
            .map((item, itemIdx) => updateScoreItemLocation(item, groupIndex, layerIndex, itemIdx)),
        })),
      ),
    );
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveScoreObjects') {
    return applyMoveScoreObjectsToSnapshot(
      score,
      patch.moves.map((move) => ({
        ...move,
        objectId: move.target.selectionId,
      })),
    );
  }

  if (patch.type === 'addLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const insertIndex = patch.layerIndex + 1;
      if (lg.groupType === 'patterns') {
        const layers = [...lg.layers];
        layers.splice(insertIndex, 0, createDefaultPatternLayerSnapshot(lg.groupId, insertIndex));
        return { ...lg, layers, layerCount: layers.length };
      }
      const newLayer = createDefaultScoreLayerSnapshot(lg.groupId, insertIndex);
      newLayer.layerId = `layer-${now()}`;
      if (lg.groupType === 'track') {
        const layers = [...lg.layers];
        layers.splice(insertIndex, 0, { ...newLayer, layerKind: 'track', instrument: null });
        return { ...lg, layers, layerCount: layers.length };
      }
      const layers = [...lg.layers];
      layers.splice(insertIndex, 0, newLayer);
      return { ...lg, layers, layerCount: layers.length };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'removeLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const layers = updateScoreGroupLayers(lg, (sourceLayers) =>
        sourceLayers.filter((_l, i) => i !== patch.layerIndex),
      );
      return { ...layers, layerCount: layers.layers.length };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const { layerIndex, targetIndex } = patch;
      if (layerIndex < 0 || layerIndex >= lg.layers.length) return lg;
      const clampedTarget = Math.max(0, Math.min(targetIndex, lg.layers.length - 1));
      if (layerIndex === clampedTarget) return lg;
      return updateScoreGroupLayers(lg, (sourceLayers) => {
        const layers = [...sourceLayers];
        const [moved] = layers.splice(layerIndex, 1);
        layers.splice(clampedTarget, 0, moved!);
        return layers;
      });
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'moveLayerRange') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      const { startIndex, endIndex, targetIndex } = patch;
      if (
        !isValidLayerRange(startIndex, endIndex, lg.layers.length) ||
        !isValidLayerRangeTarget(startIndex, endIndex, targetIndex, lg.layers.length)
      )
        return lg;
      const count = endIndex - startIndex + 1;
      if (startIndex === targetIndex) return lg;
      return updateScoreGroupLayers(lg, (sourceLayers) => {
        const layers = [...sourceLayers];
        const moved = layers.splice(startIndex, count);
        layers.splice(targetIndex, 0, ...moved);
        return layers;
      });
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'removeLayerRanges') {
    const ranges = patch.ranges;
    if (
      !areLayerRangesValid(
        ranges,
        (groupId) => score.layerGroups.find((group) => group.groupId === groupId)?.layers.length,
      )
    )
      return score;

    const byGroup = new Map<string, Array<{ startIndex: number; endIndex: number }>>();
    for (const r of ranges) {
      let list = byGroup.get(r.groupId);
      if (!list) {
        list = [];
        byGroup.set(r.groupId, list);
      }
      list.push({ startIndex: r.startIndex, endIndex: r.endIndex });
    }

    let nextLayerGroups = score.layerGroups.map((lg) => {
      const groupRanges = byGroup.get(lg.groupId);
      if (!groupRanges || groupRanges.length === 0) return lg;
      const sorted = [...groupRanges].sort((a, b) => b.startIndex - a.startIndex);
      const nextGroup = updateScoreGroupLayers(lg, (sourceLayers) => {
        const layers = [...sourceLayers];
        for (const r of sorted) {
          layers.splice(r.startIndex, r.endIndex - r.startIndex + 1);
        }
        return layers;
      });
      return { ...nextGroup, layerCount: nextGroup.layers.length };
    });

    if (patch.deleteEmptyLayerGroups) {
      const affectedGroupIds = new Set(ranges.map((range) => range.groupId));
      nextLayerGroups = nextLayerGroups.filter(
        (lg) => !affectedGroupIds.has(lg.groupId) || lg.layers.length > 0,
      );
    }

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateLayerState') {
    const layerUnit = 22;
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      if (patch.layerIndex < 0 || patch.layerIndex >= lg.layers.length) return lg;

      const layers = updateScoreGroupLayers(lg, (sourceLayers) =>
        sourceLayers.map((layer, index) => {
          if (index !== patch.layerIndex) return layer;

          return {
            ...layer,
            ...(patch.patch.backgroundColor !== undefined &&
            isValidLayerColorInput(patch.patch.backgroundColor)
              ? { backgroundColor: normalizeLayerColor(patch.patch.backgroundColor) }
              : {}),
            ...(patch.patch.muted !== undefined ? { muted: patch.patch.muted } : {}),
            ...(patch.patch.solo !== undefined ? { solo: patch.patch.solo } : {}),
            ...(patch.patch.heightIndex !== undefined
              ? { height: (Math.max(0, patch.patch.heightIndex) + 1) * layerUnit }
              : {}),
          };
        }),
      );

      return layers;
    });

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'setLayerHeights') {
    const updateMap = new Map<string, number | 'default'>();
    for (const u of patch.updates) {
      updateMap.set(`${u.groupId}:${u.layerIndex}`, u.height);
    }
    const layerUnit = 22;
    const nextLayerGroups = score.layerGroups.map((lg) => {
      const hasGroupUpdate = patch.updates.some((u) => u.groupId === lg.groupId);
      if (!hasGroupUpdate) return lg;

      const layers = updateScoreGroupLayers(lg, (sourceLayers) =>
        sourceLayers.map((layer, index) => {
          const heightVal = updateMap.get(`${lg.groupId}:${index}`);
          if (heightVal === undefined) return layer;
          if (heightVal === 'default') {
            const defaultIndex = 'defaultHeightIndex' in lg ? lg.defaultHeightIndex : 0;
            const defaultHeight =
              lg.groupType === 'track' || lg.groupType === 'polyObject'
                ? resolveGroupDefaultHeight(
                    defaultIndex,
                    lg.groupType === 'track' ? 'track' : 'soundLayer',
                  )
                : layerUnit;
            return { ...layer, height: defaultHeight };
          }
          return { ...layer, height: heightVal };
        }),
      );
      return layers;
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'setLayerGroupDefaultHeight') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      return { ...lg, defaultHeightIndex: patch.defaultHeightIndex };
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'renameLayer') {
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupId !== patch.groupId) return lg;
      if (patch.layerIndex < 0 || patch.layerIndex >= lg.layers.length) return lg;
      const layers = updateScoreGroupLayers(lg, (sourceLayers) =>
        sourceLayers.map((layer, index) =>
          index === patch.layerIndex ? { ...layer, name: patch.name } : layer,
        ),
      );
      return layers;
    });
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'renameLayerGroup') {
    const nextLayerGroups = score.layerGroups.map((lg) =>
      lg.groupId === patch.groupId ? { ...lg, name: patch.name } : lg,
    );
    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateTimeState') {
    const { patch: tsPatch } = patch;
    return {
      ...score,
      timeState: { ...score.timeState, ...tsPatch },
    };
  }

  if (patch.type === 'updateTypeSpecificEditor') {
    const { target, patch: typePatch } = patch;

    const nextLayerGroups = score.layerGroups.map((lg) =>
      updateScoreGroupLayers(lg, (layers) =>
        layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            if (!isScoreItemMatchingTarget(item, target)) return item;
            if (item.barRenderer.kind === 'audioClip') {
              return {
                ...item,
                barRenderer: {
                  ...item.barRenderer,
                  ...(typePatch.fadeInType !== undefined
                    ? { fadeInType: typePatch.fadeInType as typeof item.barRenderer.fadeInType }
                    : {}),
                  ...(typePatch.fadeOutType !== undefined
                    ? { fadeOutType: typePatch.fadeOutType as typeof item.barRenderer.fadeOutType }
                    : {}),
                },
              };
            }

            return item;
          }),
        })),
      ),
    );

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'addMarker') {
    const name = patch.name ?? `Marker ${score.markers.length + 1}`;
    const newMarker: MarkerSnapshot = {
      markerId: patch.markerId,
      name,
      time: patch.timeBeats,
      timeBase: score.timeState.primaryTimeDisplay,
      sourceIndex: score.markers.length,
    };
    return { ...score, markers: [...score.markers, newMarker] };
  }

  if (patch.type === 'updateMarker') {
    const markers = score.markers.map((m, i) => {
      if (i !== patch.sourceIndex) return m;
      return {
        ...m,
        ...(patch.patch.name !== undefined ? { name: patch.patch.name } : {}),
        ...(patch.patch.timeBeats !== undefined ? { time: patch.patch.timeBeats } : {}),
        ...(patch.patch.timeBase !== undefined ? { timeBase: patch.patch.timeBase } : {}),
      };
    });
    return { ...score, markers };
  }

  if (patch.type === 'removeMarker') {
    const markers = score.markers
      .filter((_m, i) => i !== patch.sourceIndex)
      .map((m, i) => ({ ...m, sourceIndex: i }));
    return { ...score, markers };
  }

  if (patch.type === 'moveLayerGroup') {
    const groups = [...score.layerGroups];
    const sourceIdx = groups.findIndex((g) => g.groupId === patch.groupId);
    if (sourceIdx === -1) return score;
    const clampedTarget = Math.max(0, Math.min(patch.targetIndex, groups.length - 1));
    if (sourceIdx === clampedTarget) return score;
    const [removed] = groups.splice(sourceIdx, 1);
    groups.splice(clampedTarget, 0, removed!);
    return { ...score, layerGroups: groups };
  }

  if (patch.type === 'removeLayerGroup') {
    const layerGroups = score.layerGroups.filter((g) => g.groupId !== patch.groupId);
    return { ...score, layerGroups };
  }

  if (patch.type === 'addLayerGroup') {
    const insertAt = patch.insertAtIndex ?? score.layerGroups.length;
    const layerGroups = [...score.layerGroups];
    layerGroups.splice(insertAt, 0, createAddedLayerGroupSnapshot(patch.groupType, { now }));
    return { ...score, layerGroups };
  }

  if (patch.type === 'replaceScopedNoteProcessorChain') {
    const noteProcessorChain = cloneVisibleNoteProcessorChain(patch.chain);

    if (patch.scope === 'rootScore') {
      return { ...score, rootNoteProcessorChain: noteProcessorChain };
    }

    const nextLayerGroups = score.layerGroups.map((group) => {
      if (group.groupId !== patch.groupId) return group;

      if (patch.scope === 'layerGroup') {
        return { ...group, noteProcessorChain };
      }

      if (patch.layerIndex < 0 || patch.layerIndex >= group.layers.length) {
        return group;
      }

      const layers = updateScoreGroupLayers(group, (sourceLayers) =>
        sourceLayers.map((layer, index) =>
          index === patch.layerIndex ? { ...layer, noteProcessorChain } : layer,
        ),
      );
      return layers;
    });

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (patch.type === 'updateSoundObjectBehavior') {
    const nextLayerGroups = score.layerGroups.map((lg) =>
      updateScoreGroupLayers(lg, (layers) =>
        layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            if (!isScoreItemMatchingTarget(item, patch.target)) return item;

            return {
              ...item,
              barRenderer: applySoundObjectBehaviorToBarRenderer(item.barRenderer, patch.patch),
            };
          }),
        })),
      ),
    );

    return { ...score, layerGroups: nextLayerGroups };
  }

  if (
    patch.type === 'assignAutomationToLayer' ||
    patch.type === 'removeAutomationFromLayer' ||
    patch.type === 'moveAutomationToLayer' ||
    patch.type === 'clearLayerAutomations' ||
    patch.type === 'cleanupLayerAutomation' ||
    patch.type === 'selectLayerAutomation' ||
    patch.type === 'setAutomationLineColor' ||
    patch.type === 'setAutomationPoints' ||
    patch.type === 'insertAutomationPoint' ||
    patch.type === 'deleteAutomationPoint' ||
    patch.type === 'moveAutomationPoint' ||
    patch.type === 'setAutomationResolution'
  ) {
    return score;
  }

  if (patch.type === 'setScoreObjectBackgroundColors') {
    if (!Array.isArray(patch.updates) || patch.updates.length === 0) {
      return score;
    }

    const seenKeys = new Set<string>();
    const seenObjects = new Set<object>();
    const updateByObject = new Map<object, number>();
    for (const u of patch.updates) {
      if (!u || !u.target || !isValidLayerColorInput(u.backgroundColor)) {
        return score;
      }
      if (u.target.ownerKind === 'blueLive' || u.target.ownerKind === 'library') {
        return score;
      }

      let key = '';
      if (u.target.patternSource) {
        const ps = u.target.patternSource;
        key = `pat:${ps.groupId}:${ps.layerId}:${ps.sourceObjectId}`;
      } else if (u.target.location) {
        const loc = u.target.location;
        key = `loc:${loc.rootGroupIndex}:${(loc.containerPath ?? []).join('/')}:${loc.layerIndex}:${loc.objectIndex}`;
      } else if (u.target.selectionId) {
        key = `sel:${u.target.selectionId}`;
      } else {
        return score;
      }

      if (seenKeys.has(key)) {
        return score;
      }
      seenKeys.add(key);

      const resolvedObject = findScoreColorSnapshotTarget(score, u.target);
      if (!resolvedObject || seenObjects.has(resolvedObject)) return score;
      seenObjects.add(resolvedObject);
      updateByObject.set(resolvedObject, normalizeLayerColor(u.backgroundColor));
    }

    let changed = false;
    const nextLayerGroups = score.layerGroups.map((lg) => {
      if (lg.groupType === 'patterns') {
        const layers = lg.layers.map((layer) => {
          const color = updateByObject.get(layer.sourceObject);
          if (color !== undefined && layer.sourceObject.backgroundColor !== color) {
            changed = true;
            return {
              ...layer,
              sourceObject: { ...layer.sourceObject, backgroundColor: color },
            };
          }
          return layer;
        });
        return { ...lg, layers };
      }

      return updateScoreGroupLayers(lg, (layers) =>
        layers.map((layer) => ({
          ...layer,
          items: layer.items.map((item) => {
            const color = updateByObject.get(item);
            if (color !== undefined && item.backgroundColor !== color) {
              changed = true;
              return {
                ...item,
                backgroundColor: color,
              };
            }
            return item;
          }),
        })),
      );
    });

    return changed ? { ...score, layerGroups: nextLayerGroups } : score;
  }

  if (patch.type !== 'updateSharedProperties') return score;

  const { name, startTime, subjectiveDuration, backgroundColor } = patch.patch;

  const nextLayerGroups = score.layerGroups.map((lg) =>
    updateScoreGroupLayers(lg, (layers) =>
      layers.map((layer) => ({
        ...layer,
        items: layer.items.map((item) => {
          if (!isScoreItemMatchingTarget(item, patch.target)) return item;
          const next = { ...item };
          if (name !== undefined) next.name = name;
          if (backgroundColor !== undefined) next.backgroundColor = backgroundColor;
          if (startTime !== undefined) {
            next.startBeats = startTime.value;
            next.startTimeBase = startTime.timeBase;
          }
          if (subjectiveDuration !== undefined) {
            next.durationBeats = subjectiveDuration.value;
            next.durationTimeBase = subjectiveDuration.timeBase;
          }
          next.barRenderer = applySharedPropertiesToBarRenderer(next.barRenderer, patch.patch);
          return next;
        }),
      })),
    ),
  );

  return { ...score, layerGroups: nextLayerGroups };
}

export function applyTrackPatchToSnapshot(
  score: ScoreDocumentSnapshot,
  patch: Extract<
    ScorePatch,
    {
      type:
        | 'addTrackItem'
        | 'moveTrackItems'
        | 'resizeTrackItems'
        | 'removeTrackItems'
        | 'replaceTrackNoteProcessorChain'
        | 'createTrackInstrument'
        | 'replaceTrackInstrument'
        | 'clearTrackInstrument'
        | 'updateTrackInstrument';
    }
  >,
): ScoreDocumentSnapshot {
  const findTrack = (groupId: string, trackId: string) => {
    const group = score.layerGroups.find(
      (candidate) => candidate.groupId === groupId && candidate.groupType === 'track',
    );
    if (!group || group.groupType !== 'track') return null;
    const layerIndex = group.layers.findIndex((layer) => layer.layerId === trackId);
    if (layerIndex < 0) return null;
    return { group, layerIndex, layer: group.layers[layerIndex]! };
  };

  const findItem = (groupId: string, trackId: string, objectId?: string, objectIndex?: number) => {
    const target = findTrack(groupId, trackId);
    if (!target) return null;
    const index = objectId
      ? target.layer.items.findIndex((item) => item.objectId === objectId)
      : (objectIndex ?? -1);
    if (index < 0 || index >= target.layer.items.length) return null;
    return { ...target, itemIndex: index, item: target.layer.items[index]! };
  };

  if (patch.type === 'addTrackItem') {
    const target = findTrack(patch.track.rootGroupId, patch.track.trackId);
    if (!target) return score;
    const objectType = patch.item.objectType ?? patch.item.type ?? 'Unknown';
    const objectId = patch.item.selectionId?.trim()
      ? patch.item.selectionId.trim()
      : createLocalScoreObjectId(objectType);
    const item: ScoreRowObjectSnapshot = {
      objectId,
      objectType,
      name: patch.item.name ?? objectType,
      startBeats: patch.startBeats,
      durationBeats: patch.item.durationBeats ?? 1,
      startTimeBase: patch.item.startTimeBase ?? 'BEATS',
      durationTimeBase: patch.item.durationTimeBase ?? 'BEATS',
      backgroundColor: patch.item.backgroundColor ?? 0x404040,
      isContainer: false,
      editorTarget: {
        selectionId: objectId,
        selectedObjectType: objectType,
        editorObjectType: objectType,
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: {
          rootGroupIndex: score.layerGroups.indexOf(target.group),
          containerPath: [],
          layerIndex: target.layerIndex,
          objectIndex: target.layer.items.length,
          rootGroupId: target.group.groupId,
          layerId: target.layer.layerId,
          trackId: target.layer.layerId,
          layerKind: 'track',
        },
        supportsTimeBehavior: objectType !== 'AudioClip',
        supportsRepeatPoint: objectType !== 'AudioClip',
        supportsNoteProcessorChain: objectType !== 'AudioClip',
      },
      serializedXml: patch.item.serializedXml,
      barRenderer: {
        kind: objectType === 'AudioClip' ? 'audioClip' : 'fallback',
        labelLines: [patch.item.name ?? objectType],
        ...(objectType === 'AudioClip'
          ? {
              audioFilePath: '',
              waveformKey: null,
              fileStartTimeBeats: 0,
              audioDurationBeats: 0,
              looping: true,
              fadeInBeats: 0,
              fadeInType: 'LINEAR' as const,
              fadeOutBeats: 0,
              fadeOutType: 'LINEAR' as const,
            }
          : { reason: 'missing-data' as const }),
      } as ScoreRowObjectSnapshot['barRenderer'],
    };
    const layers = score.layerGroups.map((group) => {
      if (group.groupId !== target.group.groupId || group.groupType !== 'track') return group;
      return {
        ...group,
        layers: group.layers.map((layer, index) =>
          index === target.layerIndex ? { ...layer, items: [...layer.items, item] } : layer,
        ),
      };
    });
    return { ...score, layerGroups: layers };
  }

  if (patch.type === 'removeTrackItems') {
    const targets = patch.targets.map((target) =>
      findItem(target.track.rootGroupId, target.track.trackId, target.objectId, target.objectIndex),
    );
    if (targets.some((target) => !target)) return score;
    const itemIds = new Set(
      (targets as Array<NonNullable<(typeof targets)[number]>>).map(
        (target) => target.item.objectId,
      ),
    );
    const layerGroups = score.layerGroups.map((group, groupIndex) =>
      group.groupType === 'track'
        ? {
            ...group,
            layers: group.layers.map((layer, layerIndex) => ({
              ...layer,
              items: layer.items
                .filter((item) => !itemIds.has(item.objectId))
                .map((item, itemIndex) =>
                  updateScoreItemLocation(item, groupIndex, layerIndex, itemIndex, {
                    rootGroupId: group.groupId,
                    layerId: layer.layerId,
                    trackId: layer.layerId,
                  }),
                ),
            })),
          }
        : group,
    );
    return { ...score, layerGroups };
  }

  if (patch.type === 'moveTrackItems') {
    const resolved = patch.moves.map((move) => ({
      source: findItem(
        move.source.track.rootGroupId,
        move.source.track.trackId,
        move.source.objectId,
        move.source.objectIndex,
      ),
      destination: findTrack(move.destination.rootGroupId, move.destination.trackId),
      move,
    }));
    if (resolved.some((entry) => !entry.source || !entry.destination)) return score;
    const movedIds = new Set(resolved.map((entry) => entry.source!.item.objectId));
    const destinations = new Map<string, Array<{ item: ScoreRowObjectSnapshot; start: number }>>();
    for (const entry of resolved) {
      const bucket = destinations.get(entry.destination!.layer.layerId) ?? [];
      bucket.push({ item: entry.source!.item, start: entry.move.targetStartBeats });
      destinations.set(entry.destination!.layer.layerId, bucket);
    }
    const layerGroups = score.layerGroups.map((group, groupIndex) =>
      group.groupType === 'track'
        ? {
            ...group,
            layers: group.layers.map((layer, layerIndex) => {
              const additions = destinations.get(layer.layerId) ?? [];
              const items = layer.items
                .filter((item) => !movedIds.has(item.objectId))
                .concat(additions.map(({ item, start }) => ({ ...item, startBeats: start })))
                .map((item, itemIndex) =>
                  updateScoreItemLocation(item, groupIndex, layerIndex, itemIndex, {
                    rootGroupId: group.groupId,
                    layerId: layer.layerId,
                    trackId: layer.layerId,
                  }),
                );
              return { ...layer, items };
            }),
          }
        : group,
    );
    return { ...score, layerGroups };
  }

  if (patch.type === 'resizeTrackItems') {
    const resolved = patch.resizes.map((resize) => ({
      target: findItem(
        resize.target.track.rootGroupId,
        resize.target.track.trackId,
        resize.target.objectId,
        resize.target.objectIndex,
      ),
      resize,
    }));
    if (resolved.some((entry) => !entry.target)) return score;
    const itemIds = new Set(resolved.map((entry) => entry.target!.item.objectId));
    if (itemIds.size !== resolved.length) return score;
    const byId = new Map(resolved.map((entry) => [entry.target!.item.objectId, entry.resize]));
    const layerGroups = score.layerGroups.map((group) =>
      group.groupType === 'track'
        ? {
            ...group,
            layers: group.layers.map((layer) => ({
              ...layer,
              items: layer.items.map((item) => {
                const resize = byId.get(item.objectId);
                if (!resize) return item;
                return {
                  ...item,
                  startBeats: resize.targetStartBeats,
                  durationBeats: resize.targetDurationBeats,
                };
              }),
            })),
          }
        : group,
    );
    return { ...score, layerGroups };
  }

  const target = findTrack(patch.track.rootGroupId, patch.track.trackId);
  if (!target) return score;
  if (patch.type === 'replaceTrackNoteProcessorChain') {
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) =>
        group.groupId === target.group.groupId && group.groupType === 'track'
          ? {
              ...group,
              layers: group.layers.map((layer, index) =>
                index === target.layerIndex
                  ? { ...layer, noteProcessorChain: cloneVisibleNoteProcessorChain(patch.chain) }
                  : layer,
              ),
            }
          : group,
      ),
    };
  }
  if (patch.type === 'clearTrackInstrument') {
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) =>
        group.groupId === target.group.groupId && group.groupType === 'track'
          ? {
              ...group,
              layers: group.layers.map((layer, index) =>
                index === target.layerIndex ? { ...layer, instrument: null } : layer,
              ),
            }
          : group,
      ),
    };
  }
  if (patch.type === 'createTrackInstrument' || patch.type === 'replaceTrackInstrument') {
    const instrument =
      patch.type === 'createTrackInstrument'
        ? {
            type: patch.instrumentType,
            instrumentType: patch.instrumentType,
            name: '',
            comment: '',
            enabled: true,
            supported: true,
            trackId: target.layer.layerId,
          }
        : {
            type: patch.instrument.type,
            instrumentType:
              patch.instrument.type === 'unknown'
                ? patch.instrument.instrumentType
                : {
                    generic: 'GenericInstrument',
                    blueSynthBuilder: 'BlueSynthBuilder',
                    blueX7: 'BlueX7',
                    python: 'PythonInstrument',
                    javascript: 'JavaScriptInstrument',
                  }[patch.instrument.type],
            name: patch.instrument.name,
            comment: patch.instrument.comment,
            enabled: patch.instrument.enabled,
            supported: patch.instrument.type !== 'unknown',
            trackId: target.layer.layerId,
            snapshot: structuredClone(patch.instrument),
          };
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) =>
        group.groupId === target.group.groupId && group.groupType === 'track'
          ? {
              ...group,
              layers: group.layers.map((layer, index) =>
                index === target.layerIndex ? { ...layer, instrument } : layer,
              ),
            }
          : group,
      ),
    };
  }
  if (patch.type === 'updateTrackInstrument') {
    const current = target.layer.instrument;
    if (!current) return score;
    const nextSummary = { ...current };
    const nextSnapshot = current.snapshot ? { ...current.snapshot } : undefined;
    if (patch.patch.name !== undefined) {
      nextSummary.name = patch.patch.name;
      if (nextSnapshot) nextSnapshot.name = patch.patch.name;
    }
    if (patch.patch.comment !== undefined) {
      nextSummary.comment = patch.patch.comment;
      if (nextSnapshot) nextSnapshot.comment = patch.patch.comment;
    }
    if (patch.patch.enabled !== undefined) {
      nextSummary.enabled = patch.patch.enabled;
      if (nextSnapshot) nextSnapshot.enabled = patch.patch.enabled;
    }
    if (nextSnapshot) nextSummary.snapshot = nextSnapshot;
    return {
      ...score,
      layerGroups: score.layerGroups.map((group) =>
        group.groupId === target.group.groupId && group.groupType === 'track'
          ? {
              ...group,
              layers: group.layers.map((layer, index) =>
                index === target.layerIndex ? { ...layer, instrument: nextSummary } : layer,
              ),
            }
          : group,
      ),
    };
  }
  return score;
}
