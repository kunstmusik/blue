import type {
  MeterMapSnapshot,
  TempoMapSnapshot,
  TempoPointSnapshot,
  TempoCurveTypeSnapshot,
  TempoMapPatch,
} from '../../../../../shared/project-editor';
import type { SnapValueName } from '@blue/data';
import { snapValueToBeats } from '@blue/data';
import { snapBeatToGrid } from './snap-grid-utils';

export const TEMPO_REGION_BAR_HEIGHT = 20;
export const TEMPO_LINE_VIEW_HEIGHT = 80;
export const TEMPO_MIN_BPM = 30;
export const TEMPO_MAX_BPM = 240;

export interface TempoRegion {
  pointIndex: number;
  startBeat: number;
  endBeat: number;
  tempo: number;
  curveType: TempoCurveTypeSnapshot;
}

export function deriveTempoRegions(tempoMap: TempoMapSnapshot, totalBeats: number): TempoRegion[] {
  const regions: TempoRegion[] = [];
  const points = tempoMap.points;

  for (let i = 0; i < points.length; i++) {
    const startBeat = points[i].beat;
    const endBeat = i < points.length - 1 ? points[i + 1].beat : totalBeats;
    regions.push({
      pointIndex: i,
      startBeat,
      endBeat,
      tempo: points[i].tempo,
      curveType: points[i].curveType,
    });
  }

  return regions;
}

export function findRegionAtBeat(regions: TempoRegion[], beat: number): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (beat >= regions[i].startBeat) {
      return i;
    }
  }
  return 0;
}

export function snapBeat(
  beat: number,
  snapEnabled: boolean,
  snapValue: SnapValueName,
  pixelsPerBeat: number,
  tempo: number = 60,
  smpteFrameRate: number = 30,
  sampleRate: number = 44100,
  meterMap?: MeterMapSnapshot,
): number {
  if (!snapEnabled) return beat;
  const snapBeats = snapValueToBeats(snapValue, tempo, smpteFrameRate, sampleRate, pixelsPerBeat);
  if (snapBeats <= 0) return beat;
  return snapBeatToGrid(beat, 'nearest', snapValue, snapBeats, meterMap);
}

export function getTempoAtBeat(points: TempoPointSnapshot[], beat: number): number {
  if (points.length === 0) return 60;
  for (let i = points.length - 1; i >= 0; i--) {
    if (beat >= points[i].beat) {
      if (i >= points.length - 1) return points[i].tempo;
      if (points[i].curveType === 'constant') return points[i].tempo;
      const next = points[i + 1];
      const segmentLen = next.beat - points[i].beat;
      if (segmentLen <= 0) return points[i].tempo;
      const frac = (beat - points[i].beat) / segmentLen;
      return points[i].tempo + frac * (next.tempo - points[i].tempo);
    }
  }
  return points[0].tempo;
}

export function secondsToBeats(seconds: number, tempoMap: TempoMapSnapshot): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  if (!tempoMap.enabled || tempoMap.points.length === 0) return seconds;

  const points = [...tempoMap.points].sort((a, b) => a.beat - b.beat);
  const cumulativeSeconds: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const deltaBeats = current.beat - previous.beat;
    const previousSeconds = cumulativeSeconds[i - 1]!;
    if (deltaBeats <= 0) {
      cumulativeSeconds.push(previousSeconds);
      continue;
    }

    if (previous.curveType === 'constant') {
      cumulativeSeconds.push(previousSeconds + deltaBeats * (60 / previous.tempo));
      continue;
    }

    const factor1 = 60 / previous.tempo;
    const acceleration = (60 / current.tempo - factor1) / deltaBeats;
    cumulativeSeconds.push(
      previousSeconds + factor1 * deltaBeats + 0.5 * acceleration * deltaBeats * deltaBeats,
    );
  }

  let index = 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (seconds >= cumulativeSeconds[i]!) {
      index = i;
      break;
    }
  }

  const current = points[index]!;
  const elapsed = seconds - cumulativeSeconds[index]!;
  if (index >= points.length - 1 || current.curveType === 'constant') {
    return current.beat + elapsed * (current.tempo / 60);
  }

  const next = points[index + 1]!;
  const segmentBeats = next.beat - current.beat;
  if (segmentBeats <= 0 || current.tempo === next.tempo) {
    return current.beat + elapsed * (current.tempo / 60);
  }

  const factor1 = 60 / current.tempo;
  const acceleration = (60 / next.tempo - factor1) / segmentBeats;
  if (acceleration === 0) {
    return current.beat + elapsed / factor1;
  }

  const discriminant = factor1 * factor1 + 2 * acceleration * elapsed;
  return current.beat + (Math.sqrt(Math.max(0, discriminant)) - factor1) / acceleration;
}

export function beatToScreenX(beat: number, pixelsPerBeat: number): number {
  return beat * pixelsPerBeat;
}

export function screenXToBeat(x: number, pixelsPerBeat: number): number {
  return x / pixelsPerBeat;
}

export function tempoToScreenY(tempo: number, height: number): number {
  const padding = 5;
  const range = TEMPO_MAX_BPM - TEMPO_MIN_BPM;
  return Math.round((height - padding) * (1 - (tempo - TEMPO_MIN_BPM) / range) + padding / 2);
}

export function screenYToTempo(y: number, height: number): number {
  const padding = 5;
  const range = TEMPO_MAX_BPM - TEMPO_MIN_BPM;
  const raw = (1 - (y - padding / 2) / (height - padding)) * range + TEMPO_MIN_BPM;
  return Math.max(TEMPO_MIN_BPM, Math.min(TEMPO_MAX_BPM, raw));
}

export function findExistingPointNearBeat(
  points: TempoPointSnapshot[],
  beat: number,
  tolerance: number = 0.001,
): number {
  for (let i = 0; i < points.length; i++) {
    if (Math.abs(points[i].beat - beat) < tolerance) return i;
  }
  return -1;
}
