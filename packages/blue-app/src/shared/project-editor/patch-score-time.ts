import {
  BlueData,
  isValidSmpteFormat,
  TempoMap,
  TempoPoint,
  CurveType,
  PolyObject,
  TimeBase,
  isValidSnapValueName,
  AbstractSoundObject,
  TimeDuration,
  TimeContext,
  convertTimePosition,
  beatsToTimePosition,
  beatsToDuration,
  MeterMap,
  MeasureMeterPair,
  Meter,
} from '@blue/data';
import type { ScoreObject as BlueDataScoreObject } from '@blue/data';
import type { SnapValueName } from '@blue/data';

import type {
  ScoreTimeStateSnapshot,
  ScorePatch,
  TempoPointSnapshot,
  TempoMapSnapshot,
  TempoMapPatch,
  MeterEntryInput,
  MeterMapPatch,
} from './contract';
import { getTempoPointSnapshotId } from './identity';

function applyTimebaseUpdate(
  data: BlueData,
  oldTimeBase: TimeBase,
  newTimeBase: TimeBase,
  scoreObjectMode: 'UPDATE_ALL' | 'UPDATE_MATCHING' | null,
  markerMode: 'UPDATE_ALL' | 'UPDATE_MATCHING' | null,
): void {
  const score = data.getScore();
  const context = score.getTimeContext();

  if (scoreObjectMode != null) {
    for (const layerGroup of score) {
      for (const layer of layerGroup) {
        if (!Array.isArray(layer)) continue;
        for (const sObj of layer as unknown as BlueDataScoreObject[]) {
          if (!('getStartTime' in sObj)) continue;
          const updateStart =
            scoreObjectMode === 'UPDATE_ALL' || sObj.getStartTime().getTimeBase() === oldTimeBase;
          if (updateStart) {
            sObj.setStartTime(convertTimePosition(sObj.getStartTime(), newTimeBase, context));
          }
          const updateDuration =
            scoreObjectMode === 'UPDATE_ALL' ||
            sObj.getSubjectiveDuration().getTimeBase() === oldTimeBase;
          if (updateDuration) {
            const durBeats = sObj.getSubjectiveDuration().toBeats(context);
            sObj.setSubjectiveDuration(beatsToDuration(durBeats, newTimeBase, context));
          }
          if ('getRepeatPoint' in sObj && 'setRepeatPoint' in sObj) {
            const so = sObj as AbstractSoundObject;
            const rp = so.getRepeatPoint();
            if (rp) {
              const shouldUpdate =
                scoreObjectMode === 'UPDATE_ALL' || rp.getTimeBase() === oldTimeBase;
              if (shouldUpdate) {
                const rpBeats = rp.toBeats(context);
                so.setRepeatPoint(beatsToDuration(rpBeats, newTimeBase, context));
              }
            }
          }
        }
      }
    }
  }

  if (markerMode != null) {
    const markers = data.getMarkersList();
    for (let i = 0; i < markers.size(); i++) {
      const markerTime = markers.getMarkerTimePosition(i);
      const shouldUpdate = markerMode === 'UPDATE_ALL' || markerTime.getTimeBase() === oldTimeBase;
      if (shouldUpdate) {
        markers.setMarkerTimePosition(i, convertTimePosition(markerTime, newTimeBase, context));
      }
    }
  }
}

export function applyScoreTimeStatePatch(
  data: BlueData,
  patch: Partial<ScoreTimeStateSnapshot>,
): boolean {
  const ts = data.getScore().getTimeState();
  const rate = patch.smpteFrameRate !== undefined ? patch.smpteFrameRate : ts.getSmpteFrameRate();
  const dropFrame =
    patch.smpteDropFrame !== undefined ? patch.smpteDropFrame : ts.isSmpteDropFrame();
  if (!isValidSmpteFormat(rate, dropFrame)) throw new Error('Unsupported SMPTE rate/mode pair');
  let changed = false;

  if (patch.snapEnabled !== undefined && ts.isSnapEnabled() !== patch.snapEnabled) {
    ts.setSnapEnabled(patch.snapEnabled);
    changed = true;
  }
  if (
    patch.snapValue !== undefined &&
    isValidSnapValueName(patch.snapValue) &&
    ts.getSnapValue() !== patch.snapValue
  ) {
    ts.setSnapValue(patch.snapValue as SnapValueName);
    changed = true;
  }
  let oldTimeDisplay: TimeBase | undefined;
  if (patch.primaryTimeDisplay !== undefined) {
    const td = patch.primaryTimeDisplay as TimeBase;
    if (Object.values(TimeBase).includes(td) && ts.getTimeDisplay() !== td) {
      oldTimeDisplay = ts.getTimeDisplay();
      ts.setTimeDisplay(td);
      changed = true;
    }
  }
  if (patch.secondaryTimeDisplay !== undefined) {
    const std = patch.secondaryTimeDisplay as TimeBase;
    if (Object.values(TimeBase).includes(std) && ts.getSecondaryTimeDisplay() !== std) {
      ts.setSecondaryTimeDisplay(std);
      changed = true;
    }
  }
  if (
    patch.secondaryRulerEnabled !== undefined &&
    ts.isSecondaryRulerEnabled() !== patch.secondaryRulerEnabled
  ) {
    ts.setSecondaryRulerEnabled(patch.secondaryRulerEnabled);
    changed = true;
  }
  if (patch.tempoRowVisible !== undefined && ts.isTempoRowVisible() !== patch.tempoRowVisible) {
    ts.setTempoRowVisible(patch.tempoRowVisible);
    changed = true;
  }
  if (patch.meterRowVisible !== undefined && ts.isMeterRowVisible() !== patch.meterRowVisible) {
    ts.setMeterRowVisible(patch.meterRowVisible);
    changed = true;
  }
  if (
    patch.markersRowVisible !== undefined &&
    ts.isMarkersRowVisible() !== patch.markersRowVisible
  ) {
    ts.setMarkersRowVisible(patch.markersRowVisible);
    changed = true;
  }
  if (
    patch.smpteFrameRate !== undefined &&
    patch.smpteFrameRate > 0 &&
    ts.getSmpteFrameRate() !== patch.smpteFrameRate
  ) {
    ts.setSmpteFrameRate(patch.smpteFrameRate);
    changed = true;
  }
  if (patch.smpteDropFrame !== undefined && ts.isSmpteDropFrame() !== patch.smpteDropFrame) {
    ts.setSmpteDropFrame(patch.smpteDropFrame);
    changed = true;
  }
  if (patch.zoomIterations !== undefined && ts.getZoomIterations() !== patch.zoomIterations) {
    ts.setZoomIterations(patch.zoomIterations);
    changed = true;
  }

  if (
    oldTimeDisplay !== undefined &&
    (patch.scoreObjectUpdateMode != null || patch.markerUpdateMode != null)
  ) {
    const newBase = patch.primaryTimeDisplay as TimeBase;
    applyTimebaseUpdate(
      data,
      oldTimeDisplay,
      newBase,
      patch.scoreObjectUpdateMode ?? null,
      patch.markerUpdateMode ?? null,
    );
  }

  return changed;
}

export function isValidTimeBase(value: unknown): value is TimeBase {
  return typeof value === 'string' && Object.values(TimeBase).includes(value as TimeBase);
}

export function isNonEmptyScorePatch(patch: ScorePatch): boolean {
  if (patch.type === 'updateTimeState') {
    return Object.keys(patch.patch).length > 0;
  }
  if (patch.type === 'updateLayerState') {
    return Object.keys(patch.patch).length > 0;
  }
  if (
    patch.type === 'updateSharedProperties' ||
    patch.type === 'updateSoundObjectBehavior' ||
    patch.type === 'replaceNoteProcessorChain' ||
    patch.type === 'updateTypeSpecificEditor' ||
    patch.type === 'replaceScopedNoteProcessorChain' ||
    patch.type === 'saveNamedNoteProcessorChain' ||
    patch.type === 'deleteNamedNoteProcessorChain'
  ) {
    return true;
  }
  if (
    patch.type === 'addScoreObjects' ||
    patch.type === 'moveScoreObjects' ||
    patch.type === 'addLayer' ||
    patch.type === 'removeLayer'
  ) {
    return true;
  }
  if (patch.type === 'removeScoreObjects') {
    return patch.targets.length > 0;
  }
  if (patch.type === 'updatePatternCells') {
    return patch.changes.length > 0;
  }
  if (patch.type === 'setLayerHeights') {
    return patch.updates.length > 0;
  }
  return true;
}

export function scorePatchTouchesMixerAudioChannels(patch: ScorePatch): boolean {
  switch (patch.type) {
    case 'addLayer':
    case 'removeLayer':
    case 'removeLayerRanges':
    case 'renameLayer':
    case 'renameLayerGroup':
    case 'moveLayerGroup':
    case 'removeLayerGroup':
      return true;
    case 'addLayerGroup':
      return patch.groupType === 'track' || patch.groupType === undefined;
    default:
      return false;
  }
}

function validateTempoMapSnapshot(map: TempoMapSnapshot): boolean {
  if (!map.points || map.points.length === 0) return false;
  if (map.points[0].beat !== 0) return false;
  for (const p of map.points) {
    if (!isFinite(p.beat) || p.beat < 0) return false;
    if (!isFinite(p.tempo) || p.tempo <= 0) return false;
    if (p.curveType !== 'constant' && p.curveType !== 'linear') return false;
    if (p.timeBase !== undefined && !isValidTimeBase(p.timeBase)) return false;
  }
  for (let i = 1; i < map.points.length; i++) {
    if (map.points[i].beat <= map.points[i - 1].beat) return false;
  }
  return true;
}

function tempoPointTimeBase(point: Pick<TempoPointSnapshot, 'timeBase'>): TimeBase {
  return isValidTimeBase(point.timeBase) ? point.timeBase : TimeBase.BEATS;
}

export function applyTempoMapPatch(data: BlueData, tempoPatch: TempoMapPatch): boolean {
  const context = data.getScore().getTimeContext();
  const tempoMap = context.getTempoMap();

  switch (tempoPatch.type) {
    case 'setTempoEnabled': {
      if (tempoMap.isEnabled() !== tempoPatch.enabled) {
        tempoMap.setEnabled(tempoPatch.enabled);
        return true;
      }
      return false;
    }
    case 'setTempoVisible': {
      if (tempoMap.isVisible() !== tempoPatch.visible) {
        tempoMap.setVisible(tempoPatch.visible);
        return true;
      }
      return false;
    }
    case 'addTempoPoint': {
      const p = tempoPatch.point;
      if (!isFinite(p.beat) || p.beat < 0 || !isFinite(p.tempo) || p.tempo <= 0) return false;
      const existing = tempoMap.getTempoPoints();
      for (const ep of existing) {
        if (Math.abs(ep.beat - p.beat) < 0.001) return false;
        if (p.pointId && getTempoPointSnapshotId(ep) === p.pointId)
          throw new Error('Tempo point identity must be unique.');
      }
      if (p.pointId !== undefined && (typeof p.pointId !== 'string' || !p.pointId.trim()))
        throw new Error('Tempo point identity must be nonempty.');
      const ct = p.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR;
      const point = new TempoPoint(
        beatsToTimePosition(p.beat, tempoPointTimeBase(p), context),
        p.tempo,
        ct,
      );
      getTempoPointSnapshotId(point, p.pointId);
      tempoMap.addTempoPoint(point, context);
      return true;
    }
    case 'updateTempoPoint': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      const pt = tempoPatch.patch;
      const current = tempoMap.getTempoPoint(idx);
      const pointId = getTempoPointSnapshotId(current);
      const newBeat = pt.beat ?? current.beat;
      const newTempo = pt.tempo ?? current.tempo;
      const newCurve = pt.curveType
        ? pt.curveType === 'constant'
          ? CurveType.CONSTANT
          : CurveType.LINEAR
        : current.curveType;
      const newTimeBase = isValidTimeBase(pt.timeBase)
        ? pt.timeBase
        : current.position.getTimeBase();

      if (Math.abs(current.beat) < 0.001 && Math.abs(newBeat) >= 0.001) return false;
      if (!isFinite(newTempo) || newTempo <= 0) return false;

      if (idx > 0) {
        const prev = tempoMap.getTempoPoint(idx - 1);
        if (newBeat <= prev.beat) return false;
      }
      if (idx < tempoMap.size() - 1) {
        const next = tempoMap.getTempoPoint(idx + 1);
        if (newBeat >= next.beat) return false;
      }

      tempoMap.setTempoPoint(
        idx,
        beatsToTimePosition(newBeat, newTimeBase, context),
        newTempo,
        newCurve,
        context,
      );
      getTempoPointSnapshotId(tempoMap.getTempoPoint(idx), pointId);
      return true;
    }
    case 'setTempoCurveType': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      const newCurve = tempoPatch.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR;
      if (tempoMap.getCurveType(idx) === newCurve) return false;
      const pt = tempoMap.getTempoPoint(idx);
      const pointId = getTempoPointSnapshotId(pt);
      tempoMap.setTempoPoint(idx, pt.position, pt.tempo, newCurve, context);
      getTempoPointSnapshotId(tempoMap.getTempoPoint(idx), pointId);
      return true;
    }
    case 'removeTempoPoint': {
      const idx = tempoPatch.index;
      if (idx < 0 || idx >= tempoMap.size()) return false;
      if (tempoMap.size() <= 1) return false;
      if (Math.abs(tempoMap.getBeat(idx)) < 0.001) return false;
      tempoMap.removeTempoPoint(idx);
      return true;
    }
    case 'replaceTempoMap': {
      if (!validateTempoMapSnapshot(tempoPatch.map)) return false;
      const source = new TempoMap();
      source.setEnabled(tempoPatch.map.enabled);
      source.setVisible(tempoPatch.map.visible);
      source.reset();
      const pointIds = new Set<string>();
      const points = tempoPatch.map.points.map((p) => {
        if (
          p.pointId !== undefined &&
          (typeof p.pointId !== 'string' || !p.pointId.trim() || pointIds.has(p.pointId))
        )
          throw new Error('Tempo point identity must be unique and nonempty.');
        const point = new TempoPoint(
          beatsToTimePosition(p.beat, tempoPointTimeBase(p), context),
          p.tempo,
          p.curveType === 'constant' ? CurveType.CONSTANT : CurveType.LINEAR,
        );
        pointIds.add(getTempoPointSnapshotId(point, p.pointId));
        return point;
      });
      source.setTempoPoint(0, points[0]);
      for (let i = 1; i < points.length; i++) {
        source.addTempoPoint(points[i], context);
      }
      tempoMap.replaceAll(source);
      for (let i = 0; i < source.size(); i++) {
        getTempoPointSnapshotId(
          tempoMap.getTempoPoint(i),
          getTempoPointSnapshotId(source.getTempoPoint(i)),
        );
      }
      tempoMap.recalculateBeatPositions(context);
      return true;
    }
    default:
      return false;
  }
}

function validateMeterEntryInput(entry: MeterEntryInput): boolean {
  if (!Number.isInteger(entry.measure) || entry.measure < 1) return false;
  if (!Number.isInteger(entry.numBeats) || entry.numBeats < 1) return false;
  if (!Number.isInteger(entry.beatLength) || entry.beatLength < 1) return false;
  return true;
}

function validateMeterMapEntries(entries: MeterEntryInput[]): boolean {
  if (entries.length === 0) return false;
  if (entries[0].measure !== 1) return false;
  for (const entry of entries) {
    if (!validateMeterEntryInput(entry)) return false;
  }
  const measures = entries.map((e) => e.measure);
  const unique = new Set(measures);
  if (unique.size !== measures.length) return false;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].measure <= entries[i - 1].measure) return false;
  }
  return true;
}

function isMeterDependentTimeBase(timeBase: TimeBase): boolean {
  return timeBase === TimeBase.BBT || timeBase === TimeBase.BBST || timeBase === TimeBase.BBF;
}

function isCloseBeatValue(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function beatsToDurationAtReferenceBeat(
  beats: number,
  targetBase: TimeBase,
  context: TimeContext,
  referenceBeat: number,
): TimeDuration {
  const fallback = beatsToDuration(beats, targetBase, context);
  if (!isMeterDependentTimeBase(targetBase)) {
    return fallback;
  }

  const meter = context.getMeterMap().getMeterAtBeat(Math.max(0, referenceBeat));
  const beatsPerMeasure = meter.getBeatsPerMeasure();
  const beatScale = meter.getBeatScale();
  const ppq = 960;
  let bars = Math.floor(beats / beatsPerMeasure);
  let remaining = beats - bars * beatsPerMeasure;
  let beat = Math.floor(remaining / beatScale);
  let fractionalBeat = remaining - beat * beatScale;
  let candidate: TimeDuration;

  switch (targetBase) {
    case TimeBase.BBT: {
      let ticks = Math.round((fractionalBeat * ppq) / beatScale);
      if (ticks >= ppq) {
        ticks = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      candidate = TimeDuration.bbt(bars, beat, ticks);
      break;
    }
    case TimeBase.BBST: {
      let totalTicks = Math.round((fractionalBeat / beatScale) * ppq);
      if (totalTicks >= ppq) {
        totalTicks = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      const ticksPerSixteenth = ppq / 4;
      const sixteenth = Math.floor(totalTicks / ticksPerSixteenth);
      const ticks = totalTicks % ticksPerSixteenth;
      candidate = TimeDuration.bbst(bars, beat, sixteenth, ticks);
      break;
    }
    case TimeBase.BBF: {
      let fraction = Math.round((fractionalBeat * 100) / beatScale);
      if (fraction >= 100) {
        fraction = 0;
        beat += 1;
      }
      if (beat >= meter.numBeats) {
        bars += Math.floor(beat / meter.numBeats);
        beat = beat % meter.numBeats;
      }
      candidate = TimeDuration.bbf(bars, beat, fraction);
      break;
    }
    default:
      return fallback;
  }

  return isCloseBeatValue(candidate.toBeats(context), beats) ? candidate : fallback;
}

function isScoreObjectLike(value: unknown): value is BlueDataScoreObject {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BlueDataScoreObject>;
  return (
    typeof candidate.getStartTime === 'function' &&
    typeof candidate.setStartTime === 'function' &&
    typeof candidate.getSubjectiveDuration === 'function' &&
    typeof candidate.setSubjectiveDuration === 'function'
  );
}

function reencodeScoreObjectForMeterMapChange(
  sObj: BlueDataScoreObject,
  oldContext: TimeContext,
  newContext: TimeContext,
): void {
  const startTime = sObj.getStartTime();
  const startBeats = startTime.toBeats(oldContext);
  const startTimeBase = startTime.getTimeBase();
  if (isMeterDependentTimeBase(startTimeBase)) {
    sObj.setStartTime(beatsToTimePosition(startBeats, startTimeBase, newContext));
  }

  const duration = sObj.getSubjectiveDuration();
  const durationBase = duration.getTimeBase();
  if (isMeterDependentTimeBase(durationBase)) {
    const durationBeats = duration.toBeats(oldContext);
    sObj.setSubjectiveDuration(
      beatsToDurationAtReferenceBeat(durationBeats, durationBase, newContext, startBeats),
    );
  }

  if (sObj instanceof AbstractSoundObject || sObj instanceof PolyObject) {
    const repeatPoint = sObj.getRepeatPoint();
    const repeatPointBase = repeatPoint?.getTimeBase();
    if (repeatPoint && repeatPointBase && isMeterDependentTimeBase(repeatPointBase)) {
      const repeatPointBeats = repeatPoint.toBeats(oldContext);
      sObj.setRepeatPoint(
        beatsToDurationAtReferenceBeat(repeatPointBeats, repeatPointBase, newContext, startBeats),
      );
    }
  }
}

function reencodeLayerGroupScoreObjectsForMeterMapChange(
  layerGroup: unknown,
  oldContext: TimeContext,
  newContext: TimeContext,
): void {
  if (!Array.isArray(layerGroup)) return;

  for (const layer of layerGroup) {
    if (!Array.isArray(layer)) continue;

    for (const candidate of layer) {
      if (!isScoreObjectLike(candidate)) continue;

      reencodeScoreObjectForMeterMapChange(candidate, oldContext, newContext);

      if (candidate instanceof PolyObject) {
        reencodeLayerGroupScoreObjectsForMeterMapChange(candidate, oldContext, newContext);
      }
    }
  }
}

function reencodeScoreObjectsForMeterMapChange(data: BlueData, oldContext: TimeContext): void {
  const score = data.getScore();
  const newContext = score.getTimeContext();

  for (const layerGroup of score) {
    reencodeLayerGroupScoreObjectsForMeterMapChange(layerGroup, oldContext, newContext);
  }
}

export function applyMeterMapPatch(data: BlueData, meterPatch: MeterMapPatch): boolean {
  const context = data.getScore().getTimeContext();
  const oldContext = new TimeContext(context);
  const meterMap = context.getMeterMap();
  let changed = false;

  switch (meterPatch.type) {
    case 'meter-map-set-entry': {
      if (!validateMeterEntryInput(meterPatch)) break;
      const pair = new MeasureMeterPair(
        meterPatch.measure,
        new Meter(meterPatch.numBeats, meterPatch.beatLength),
      );
      meterMap.add(pair);
      changed = true;
      break;
    }
    case 'meter-map-update-entry': {
      if (!validateMeterEntryInput(meterPatch)) break;
      const prevMeasure = meterPatch.previousMeasure;
      let entryIndex = -1;
      for (let i = 0; i < meterMap.size(); i++) {
        if (meterMap.get(i).measure === prevMeasure) {
          entryIndex = i;
          break;
        }
      }
      if (entryIndex < 0) break;
      if (entryIndex === 0 && meterPatch.measure !== 1) break;
      if (entryIndex > 0) {
        const prev = meterMap.get(entryIndex - 1);
        if (meterPatch.measure <= prev.measure) break;
      }
      if (entryIndex < meterMap.size() - 1) {
        const next = meterMap.get(entryIndex + 1);
        if (meterPatch.measure >= next.measure) break;
      }
      const pair = new MeasureMeterPair(
        meterPatch.measure,
        new Meter(meterPatch.numBeats, meterPatch.beatLength),
      );
      meterMap.set(entryIndex, pair);
      changed = true;
      break;
    }
    case 'meter-map-remove-entry': {
      if (meterPatch.measure <= 1) break;
      let entryIndex = -1;
      for (let i = 0; i < meterMap.size(); i++) {
        if (meterMap.get(i).measure === meterPatch.measure) {
          entryIndex = i;
          break;
        }
      }
      if (entryIndex <= 0 || entryIndex >= meterMap.size()) break;
      if (meterMap.size() <= 1) break;
      const source = new MeterMap();
      for (let i = 0; i < meterMap.size(); i++) {
        if (i !== entryIndex) {
          const e = meterMap.get(i);
          source.add(
            new MeasureMeterPair(e.measure, new Meter(e.meter.numBeats, e.meter.beatLength)),
          );
        }
      }
      meterMap.replaceAll(source);
      changed = true;
      break;
    }
    case 'meter-map-replace': {
      if (!validateMeterMapEntries(meterPatch.entries)) break;
      const source = new MeterMap();
      for (const entry of meterPatch.entries) {
        source.add(
          new MeasureMeterPair(entry.measure, new Meter(entry.numBeats, entry.beatLength)),
        );
      }
      meterMap.replaceAll(source);
      changed = true;
      break;
    }
    default:
      break;
  }

  if (!changed) return false;

  context.getTempoMap().recalculateBeatPositions(context);
  reencodeScoreObjectsForMeterMapChange(data, oldContext);
  return true;
}
