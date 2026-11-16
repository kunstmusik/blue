import {
  BlueData,
  PolyObject,
  TrackLayerGroup,
  AbstractSoundObject,
  AudioClip,
  TimePosition,
  TimeDuration,
  beatsToTimePosition,
  timePositionToBeats,
  beatsToDuration,
} from '@blue/data';
import type {
  Parameter as BlueDataParameter,
  AutomatableLayer as BlueDataAutomatableLayer,
} from '@blue/data';
import { LineColors } from '@blue/data';
import { getProjectParameterCatalog } from '@blue/data';

import { moveRangeWithAnchors, scaleRangeWithAnchors } from '../automation-range-math';

import type {
  AutomationPointSnapshot,
  ScorePatch,
  ScoreAutomationLayerRef,
  MoveAutomationRangePatch,
  ScaleAutomationRangePatch,
} from './contract';
import { assignLayerGroupId, getScoreObjectId } from './identity';

function getAutomationLayerFromGroup(
  group: unknown,
  ref: ScoreAutomationLayerRef,
): BlueDataAutomatableLayer | null {
  if (
    ref.layerKind === 'soundObject' &&
    group instanceof PolyObject &&
    ref.layerIndex >= 0 &&
    ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as BlueDataAutomatableLayer;
  }

  if (
    ref.layerKind === 'track' &&
    group instanceof TrackLayerGroup &&
    ref.layerIndex >= 0 &&
    ref.layerIndex < group.length
  ) {
    return group[ref.layerIndex] as BlueDataAutomatableLayer;
  }

  return null;
}

function findAutomationLayerByGroupId(
  data: BlueData,
  ref: ScoreAutomationLayerRef,
): BlueDataAutomatableLayer | null {
  function visitGroup(group: unknown): BlueDataAutomatableLayer | null {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return null;
    }

    if (assignLayerGroupId(group) === ref.groupId) {
      return getAutomationLayerFromGroup(group, ref);
    }

    if (group instanceof PolyObject) {
      for (const layer of group) {
        for (const sObj of layer) {
          if (sObj instanceof PolyObject) {
            const nested = visitGroup(sObj);
            if (nested) return nested;
          }
        }
      }
    }

    return null;
  }

  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    const layer = visitGroup(score[gi]);
    if (layer) return layer;
  }

  return null;
}

function resolveAutomationLayerRef(
  data: BlueData,
  ref: ScoreAutomationLayerRef,
): BlueDataAutomatableLayer | null {
  const byGroupId = findAutomationLayerByGroupId(data, ref);
  if (byGroupId) return byGroupId;

  const score = data.getScore();
  const group = score[ref.rootGroupIndex];
  if (!group) return null;
  const directLayer = getAutomationLayerFromGroup(group, ref);
  if (directLayer) return directLayer;
  return null;
}

function findParameterById(data: BlueData, parameterId: string): BlueDataParameter | null {
  return (
    getProjectParameterCatalog(data).find((entry) => entry.parameter.getUniqueId() === parameterId)
      ?.parameter ?? null
  );
}

function buildParameterMapById(data: BlueData): Map<string, BlueDataParameter> {
  const map = new Map<string, BlueDataParameter>();
  for (const entry of getProjectParameterCatalog(data)) {
    const id = entry.parameter.getUniqueId();
    if (!map.has(id)) {
      map.set(id, entry.parameter);
    }
  }
  return map;
}

function removeAutomationParameterFromGroup(group: unknown, parameterId: string): void {
  if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
    return;
  }

  for (const layer of group) {
    const paramList = layer.getAutomationParameters();
    if (paramList.contains(parameterId)) {
      paramList.removeParameterId(parameterId);
    }

    if (group instanceof PolyObject) {
      for (const sObj of layer) {
        if (sObj instanceof PolyObject) {
          removeAutomationParameterFromGroup(sObj, parameterId);
        }
      }
    }
  }
}

function removeAutomationParameterFromAllLayers(data: BlueData, parameterId: string): void {
  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    removeAutomationParameterFromGroup(score[gi], parameterId);
  }
}

function seedDefaultAutomationPoint(param: BlueDataParameter): void {
  if (param.getPointCount() > 0) {
    return;
  }

  param.setPoints([clampAutomationPoint(param, { time: 0, value: param.getFixedValue() })]);
}

function clampAutomationPoint(
  param: BlueDataParameter,
  point: AutomationPointSnapshot,
): AutomationPointSnapshot {
  return {
    time: Math.max(0, Number.isFinite(point.time) ? point.time : 0),
    value: Math.min(
      param.getMaximum(),
      Math.max(
        param.getMinimum(),
        Number.isFinite(point.value) ? point.value : param.getFixedValue(),
      ),
    ),
  };
}

function normalizeAutomationPoints(
  param: BlueDataParameter,
  points: AutomationPointSnapshot[],
): AutomationPointSnapshot[] {
  return points.map((point) => clampAutomationPoint(param, point)).sort((a, b) => a.time - b.time);
}

function findAutomationLayerBySnapshotId(
  data: BlueData,
  layerId: string,
): BlueDataAutomatableLayer | null {
  function visitGroup(group: unknown): BlueDataAutomatableLayer | null {
    if (!(group instanceof PolyObject) && !(group instanceof TrackLayerGroup)) {
      return null;
    }

    const groupId = assignLayerGroupId(group);
    for (let li = 0; li < group.length; li++) {
      const candidateLayerId =
        group instanceof TrackLayerGroup ? group[li]?.getUniqueId() : `${groupId}-layer-${li}`;
      if (candidateLayerId === layerId) {
        return group[li] as BlueDataAutomatableLayer;
      }

      if (group instanceof PolyObject) {
        for (const sObj of group[li]!) {
          if (sObj instanceof PolyObject) {
            const nested = visitGroup(sObj);
            if (nested) return nested;
          }
        }
      }
    }

    return null;
  }

  const score = data.getScore();
  for (let gi = 0; gi < score.length; gi++) {
    const layer = visitGroup(score[gi]);
    if (layer) return layer;
  }

  return null;
}

function applyAutomationRangePatch(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
): boolean {
  const startBeat = Math.min(patch.range.startBeat, patch.range.endBeat);
  const endBeat = Math.max(patch.range.startBeat, patch.range.endBeat);
  let changed = false;

  if (shouldAbortAutomationRangeScaleForPartialObjects(data, patch, startBeat, endBeat)) {
    return false;
  }

  let parameterById: Map<string, BlueDataParameter> | undefined;
  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) {
      continue;
    }

    const assignedIds = new Set(layer.getAutomationParameters().getIds());
    const parameterIds = patch.range.parameterIdsByLayer[layerId] ?? [];

    for (const parameterId of parameterIds) {
      if (!assignedIds.has(parameterId)) {
        continue;
      }

      parameterById ??= buildParameterMapById(data);
      const param = parameterById.get(parameterId) ?? null;
      if (!param) {
        continue;
      }

      const before = param.getPoints();
      // Use anchored transforms that insert boundary anchor points at the
      // selection edges, preserving line shape outside the selection (Java
      // Line.processLineForSelectionDrag/Scale parity).
      const after =
        patch.type === 'moveAutomationRange'
          ? moveRangeWithAnchors(before, startBeat, endBeat, patch.beatDelta)
          : scaleRangeWithAnchors(before, startBeat, endBeat, patch.anchorBeat, patch.scaleFactor);

      const normalized = normalizeAutomationPoints(param, after);
      const same =
        before.length === normalized.length &&
        before.every((point, index) => {
          const next = normalized[index];
          return next && point.time === next.time && point.value === next.value;
        });
      if (!same) {
        param.setPoints(normalized);
        changed = true;
      }
    }
  }

  // FR-014: keep selected score objects / audio clips aligned with the moved or
  // scaled automation range by applying the same time transform to objects.
  // Triggered by explicit objectIds (Java shift-gated model) or by the legacy
  // includeScoreObjects/includeAudioClips booleans.
  if (patch.objectIds || patch.includeScoreObjects || patch.includeAudioClips) {
    if (applyAutomationRangeObjectAlignment(data, patch, startBeat, endBeat)) {
      changed = true;
    }
  }

  return changed;
}

function shouldAbortAutomationRangeScaleForPartialObjects(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
  startBeat: number,
  endBeat: number,
): boolean {
  if (patch.type !== 'scaleAutomationRange') return false;
  if (!patch.objectIds && !patch.includeScoreObjects && !patch.includeAudioClips) return false;

  const context = data.getScore().getTimeContext();
  const explicitIds = patch.objectIds ? new Set(patch.objectIds) : null;
  const includeScoreObjects = explicitIds ? true : !!patch.includeScoreObjects;
  const includeAudioClips = explicitIds ? true : !!patch.includeAudioClips;
  if (!includeScoreObjects && !includeAudioClips) return false;

  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) continue;

    const objects = layer as unknown as readonly unknown[];
    for (const obj of objects) {
      const isClip = obj instanceof AudioClip;
      const isScoreObject =
        !isClip && (obj instanceof AbstractSoundObject || obj instanceof PolyObject);
      if (!isClip && !isScoreObject) continue;
      if (isClip ? !includeAudioClips : !includeScoreObjects) continue;

      const timed = obj as {
        getStartTime(): TimePosition;
        getSubjectiveDuration(): TimeDuration;
      };
      const startBeats = timePositionToBeats(timed.getStartTime(), context);

      if (explicitIds) {
        const objId = getScoreObjectId(obj);
        if (!objId || !explicitIds.has(objId)) continue;
      } else if (startBeats < startBeat || startBeats > endBeat) {
        continue;
      }

      const endBeats = startBeats + timed.getSubjectiveDuration().toBeats(context);
      if (
        (startBeats < startBeat && endBeats > startBeat) ||
        (startBeats < endBeat && endBeats > endBeat)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Move or scale score objects / audio clips that participate in a multi-line
 * gesture, applying the same time transform the automation range received.
 * Used by multi-line move/scale to preserve object / clip alignment with the
 * automation lines (US3-4 / FR-014).
 *
 * Two inclusion modes:
 * - Explicit IDs (`objectIds`): Java shift-gated model — only objects the user
 *   explicitly selected via shift-drag move/scale. Object type (score object vs
 *   audio clip) is determined by instanceof, not by the ID.
 * - Legacy booleans (`includeScoreObjects`/`includeAudioClips`): objects whose
 *   start falls within [startBeat, endBeat] on selected layers.
 *
 * For scale, both start time AND subjective duration are scaled (matching Java's
 * MultiLineScaleMouseListener which scales end = start + duration and writes back
 * both values).
 */
function applyAutomationRangeObjectAlignment(
  data: BlueData,
  patch: MoveAutomationRangePatch | ScaleAutomationRangePatch,
  startBeat: number,
  endBeat: number,
): boolean {
  const context = data.getScore().getTimeContext();

  const explicitIds = patch.objectIds ? new Set(patch.objectIds) : null;
  const includeScoreObjects = explicitIds ? true : !!patch.includeScoreObjects;
  const includeAudioClips = explicitIds ? true : !!patch.includeAudioClips;
  if (!includeScoreObjects && !includeAudioClips) return false;

  let changed = false;

  for (const layerId of patch.range.layerIds) {
    const layer = findAutomationLayerBySnapshotId(data, layerId);
    if (!layer) continue;

    const objects = layer as unknown as readonly unknown[];
    for (const obj of objects) {
      const isClip = obj instanceof AudioClip;
      const isScoreObject =
        !isClip && (obj instanceof AbstractSoundObject || obj instanceof PolyObject);
      if (!isClip && !isScoreObject) continue;

      const timed = obj as {
        getStartTime(): TimePosition;
        setStartTime(value: unknown): void;
        getSubjectiveDuration(): TimeDuration;
        setSubjectiveDuration(value: unknown): void;
      };
      const startTime = timed.getStartTime();
      const startBeats = timePositionToBeats(startTime, context);

      if (isClip ? !includeAudioClips : !includeScoreObjects) continue;

      // Inclusion test: explicit ID match (preferred) or time-range fallback.
      if (explicitIds) {
        const objId = getScoreObjectId(obj);
        if (!objId || !explicitIds.has(objId)) continue;
      } else {
        if (startBeats < startBeat || startBeats > endBeat) continue;
      }

      if (patch.type === 'moveAutomationRange') {
        const newBeats = Math.max(0, startBeats + patch.beatDelta);
        if (newBeats === startBeats) continue;
        timed.setStartTime(beatsToTimePosition(newBeats, startTime.getTimeBase(), context));
        changed = true;
      } else {
        // Scale: transform both start and end (= start + duration), then write
        // back the new start and the new (end - start) duration. Matches Java's
        // MultiLineScaleMouseListener.mouseDragged:185-194.
        const dur = timed.getSubjectiveDuration();
        const durBeats = dur.toBeats(context);
        const endBeats = startBeats + durBeats;

        const newStart = Math.max(
          0,
          patch.anchorBeat + (startBeats - patch.anchorBeat) * patch.scaleFactor,
        );
        const newEnd = Math.max(
          0,
          patch.anchorBeat + (endBeats - patch.anchorBeat) * patch.scaleFactor,
        );
        const newDur = Math.max(0, newEnd - newStart);

        if (newStart === startBeats && newDur === durBeats) continue;

        timed.setStartTime(beatsToTimePosition(newStart, startTime.getTimeBase(), context));
        timed.setSubjectiveDuration(beatsToDuration(newDur, dur.getTimeBase(), context));
        changed = true;
      }
    }
  }

  return changed;
}

export function applyScoreAutomationPatch(data: BlueData, patch: ScorePatch): boolean | undefined {
  switch (patch.type) {
    case 'assignAutomationToLayer': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();

      removeAutomationParameterFromAllLayers(data, patch.parameterId);

      const isNewToLayer = !paramList.contains(patch.parameterId);
      const existingCount = paramList.size();

      if (isNewToLayer) {
        paramList.addParameterId(patch.parameterId);
      }
      paramList.setSelectedParameter(patch.parameterId);

      const param = findParameterById(data, patch.parameterId);
      if (param) {
        if (patch.enableAutomation) {
          param.setAutomationEnabled(true);
        }
        seedDefaultAutomationPoint(param);
        if (isNewToLayer) {
          const lineColors = new LineColors();
          param.setLineColor(lineColors.getColor(existingCount));
        }
      }
      return true;
    }

    case 'removeAutomationFromLayer': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();
      paramList.removeParameterId(patch.parameterId);
      const param = findParameterById(data, patch.parameterId);
      if (param) param.setAutomationEnabled(false);
      return true;
    }

    case 'moveAutomationToLayer': {
      const fromLayer = resolveAutomationLayerRef(data, patch.fromLayer);
      const toLayer = resolveAutomationLayerRef(data, patch.toLayer);
      if (!fromLayer || !toLayer) return false;
      fromLayer.getAutomationParameters().removeParameterId(patch.parameterId);
      if (!toLayer.getAutomationParameters().contains(patch.parameterId)) {
        toLayer.getAutomationParameters().addParameterId(patch.parameterId);
      }
      toLayer.getAutomationParameters().setSelectedParameter(patch.parameterId);
      return true;
    }

    case 'clearLayerAutomations': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramIds = layer.getAutomationParameters().getIds();
      if (paramIds.length > 0) {
        const parameterById = buildParameterMapById(data);
        for (const id of paramIds) {
          parameterById.get(id)?.setAutomationEnabled(false);
        }
      }
      layer.getAutomationParameters().clear();
      return true;
    }

    case 'selectLayerAutomation': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      if (patch.parameterId) {
        layer.getAutomationParameters().setSelectedParameter(patch.parameterId);
      }
      return true;
    }

    case 'setAutomationLineColor': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      param.setLineColor(patch.lineColor);
      return true;
    }

    case 'setAutomationResolution': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      try {
        // Parameter parses before mutating, so a malformed edit leaves the
        // canonical project document and its existing point values intact.
        param.setResolutionText(patch.resolutionDecimal);
      } catch {
        return false;
      }
      return true;
    }

    case 'setAutomationPoints': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      param.setPoints(normalizeAutomationPoints(param, patch.points));
      return true;
    }

    case 'insertAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const point = clampAutomationPoint(param, patch.point);
      param.addPoint(point.time, point.value);
      return true;
    }

    case 'deleteAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const pts = param.getPoints();
      if (patch.pointIndex > 0 && patch.pointIndex < pts.length) {
        const newPts = pts.filter((_, idx) => idx !== patch.pointIndex);
        param.setPoints(newPts);
      }
      return true;
    }

    case 'moveAutomationPoint': {
      const param = findParameterById(data, patch.parameterId);
      if (!param) return false;
      const pts = param.getPoints();
      if (patch.pointIndex >= 0 && patch.pointIndex < pts.length) {
        const point = clampAutomationPoint(param, patch.point);
        const newPts = pts.map((p, idx) => (idx === patch.pointIndex ? point : p));
        param.setPoints(normalizeAutomationPoints(param, newPts));
      }
      return true;
    }

    case 'cleanupLayerAutomation': {
      const layer = resolveAutomationLayerRef(data, patch.layer);
      if (!layer) return false;
      const paramList = layer.getAutomationParameters();
      const validIds = new Set(
        getProjectParameterCatalog(data).map((entry) => entry.parameter.getUniqueId()),
      );
      const idsToRemove = patch.parameterIds
        ? patch.parameterIds.filter((id) => !validIds.has(id))
        : paramList.getIds().filter((id) => !validIds.has(id));
      for (const id of idsToRemove) {
        paramList.removeParameterId(id);
      }
      return idsToRemove.length > 0;
    }

    case 'moveAutomationRange':
    case 'scaleAutomationRange':
      return applyAutomationRangePatch(data, patch);

    default:
      return undefined;
  }
}
