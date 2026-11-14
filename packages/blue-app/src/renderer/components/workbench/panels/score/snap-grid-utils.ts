import {
  secondsToSmpteFrame,
  smpteFrameToSeconds,
  resolveSmpteRate,
  type SnapValueName,
} from '@blue/data';
import { beatsToSeconds, secondsToBeats } from '../../../../time/time-unit-logic';
import type { TimeConversionContext, TempoMapSnapshot } from '../../../../../shared/project-editor';
import type { MeterMapSnapshot, MeterSnapshot } from '../../../../../shared/project-editor';

export function createFrameSnapContext(
  tempoMap: TempoMapSnapshot | undefined,
  smpteFrameRate: number,
  tempo = 60,
): TimeConversionContext {
  return {
    meterEntries: [],
    tempoEnabled: tempoMap?.enabled ?? true,
    initialTempo: tempo,
    tempoPoints: tempoMap?.points,
    sampleRate: 44100,
    smpteFrameRate,
    smpteDropFrame: false,
  };
}

const EPSILON = 1e-9;
const MIN_GRID_LINE_SPACING_PX = 8;

function measureBeatForEntry(entry: MeterSnapshot, measure: number): number {
  return entry.startBeat + (measure - entry.measure) * getBeatsPerMeasure(entry);
}

function resolveGridStepStride(stepBeats: number, pixelsPerBeat: number): number {
  if (!Number.isFinite(stepBeats) || stepBeats <= 0) {
    return 1;
  }
  const effectivePixelsPerBeat =
    Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0 ? pixelsPerBeat : 100;
  const spacingPx = stepBeats * effectivePixelsPerBeat;
  return Math.max(1, Math.ceil(MIN_GRID_LINE_SPACING_PX / spacingPx));
}

function normalizeMeterEntries(meterMap: MeterMapSnapshot | null | undefined): MeterSnapshot[] {
  const entries = meterMap?.entries.length
    ? meterMap.entries
    : [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }];

  return [...entries].sort((a, b) => a.measure - b.measure);
}

function getBeatsPerMeasure(entry: MeterSnapshot): number {
  return entry.numBeats * (4.0 / entry.beatLength);
}

function usesMeterBoundarySnap(snapValue: SnapValueName, snapBeats: number): boolean {
  if (snapValue === 'BAR') return true;
  return snapValue === 'AUTO' && snapBeats >= 4 - EPSILON;
}

function usesMeterAnchoredAutoSnap(snapValue: SnapValueName, snapBeats: number): boolean {
  return snapValue === 'AUTO' && snapBeats > EPSILON;
}

function pushUnique(lines: number[], beat: number): void {
  const previous = lines[lines.length - 1];
  if (previous === undefined || Math.abs(previous - beat) > EPSILON) {
    lines.push(beat);
  }
}

interface MeterPosition {
  entryIndex: number;
  measure: number;
  beat: number;
}

function findMeterEntryIndex(entries: MeterSnapshot[], targetBeat: number): number {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (entries[mid]!.startBeat <= targetBeat) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function advanceMeasure(
  entries: MeterSnapshot[],
  entryIndex: number,
  currentMeasure: number,
  stride = 1,
): MeterPosition {
  const nextMeasure = currentMeasure + stride;
  const nextEntry = entries[entryIndex + 1];
  if (nextEntry && nextMeasure >= nextEntry.measure) {
    return {
      entryIndex: entryIndex + 1,
      measure: nextEntry.measure,
      beat: nextEntry.startBeat,
    };
  }
  return {
    entryIndex,
    measure: nextMeasure,
    beat: measureBeatForEntry(entries[entryIndex]!, nextMeasure),
  };
}

function locateMeterStartPosition(
  entries: MeterSnapshot[],
  targetBeat: number,
  extraPrecedingMeasures = 0,
): MeterPosition {
  const first = entries[0]!;
  if (targetBeat <= first.startBeat) {
    return { entryIndex: 0, measure: first.measure, beat: first.startBeat };
  }

  const entryIndex = findMeterEntryIndex(entries, targetBeat);
  const entry = entries[entryIndex]!;
  const nextEntry = entries[entryIndex + 1];
  const beatsPerMeasure = getBeatsPerMeasure(entry);
  const maxOffset =
    nextEntry !== undefined
      ? Math.max(0, nextEntry.measure - entry.measure - 1)
      : Number.POSITIVE_INFINITY;
  const rawOffset =
    beatsPerMeasure > 0 ? Math.floor((targetBeat - entry.startBeat) / beatsPerMeasure) : 0;
  const clampedOffset = Math.min(maxOffset, Math.max(0, rawOffset));
  const adjustedOffset = Math.max(0, clampedOffset - extraPrecedingMeasures);
  const targetMeasure = entry.measure + adjustedOffset;

  return {
    entryIndex,
    measure: targetMeasure,
    beat: measureBeatForEntry(entry, targetMeasure),
  };
}

function deriveMeterSnapLineBeats(
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
  maxBeat: number,
  minBeat: number,
  pixelsPerBeat: number,
): number[] {
  const entries = normalizeMeterEntries(meterMap);
  const start = locateMeterStartPosition(entries, minBeat - EPSILON, 1);
  const subStride = resolveGridStepStride(snapBeats, pixelsPerBeat);
  const lines: number[] = [];
  let { entryIndex } = start;
  let entry = entries[entryIndex]!;
  let measureStride = resolveGridStepStride(getBeatsPerMeasure(entry), pixelsPerBeat);
  // Anchor each stride to the meter entry so scrolling cannot shift the grid.
  let currentMeasure =
    entry.measure + Math.floor((start.measure - entry.measure) / measureStride) * measureStride;
  let currentBeat = measureBeatForEntry(entry, currentMeasure);

  while (currentBeat <= maxBeat + EPSILON) {
    const next = advanceMeasure(entries, entryIndex, currentMeasure, measureStride);
    const nextBeat = next.beat;

    if (currentBeat >= minBeat - EPSILON) {
      pushUnique(lines, currentBeat);
    }

    if (snapBeats > 0 && measureStride === 1) {
      const subStep = snapBeats * subStride;
      const firstSubIndex = Math.max(1, Math.floor((minBeat - EPSILON - currentBeat) / subStep));
      for (let subIndex = firstSubIndex; Number.isSafeInteger(subIndex); subIndex += 1) {
        const beat = currentBeat + subIndex * subStep;
        if (beat > maxBeat + EPSILON || beat >= nextBeat - EPSILON) {
          break;
        }
        if (beat >= minBeat - EPSILON) {
          pushUnique(lines, beat);
        }
      }
    }

    if (next.entryIndex === entryIndex && next.beat <= currentBeat) {
      break;
    }
    if (entryIndex !== next.entryIndex) {
      entryIndex = next.entryIndex;
      entry = entries[entryIndex]!;
      measureStride = resolveGridStepStride(getBeatsPerMeasure(entry), pixelsPerBeat);
    }
    currentMeasure = next.measure;
    currentBeat = nextBeat;
  }

  return lines;
}

export function deriveSnapLineBeats(
  snapValue: SnapValueName,
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
  maxBeat: number,
  context?: TimeConversionContext,
  pixelsPerBeat = 100,
  minBeat = 0,
): number[] {
  if (!Number.isFinite(maxBeat) || !Number.isFinite(minBeat) || maxBeat < minBeat - EPSILON) {
    return [];
  }

  if (snapValue === 'FRAME' && context) {
    const rate = context.smpteFrameRate ?? 24;
    const last = secondsToSmpteFrame(beatsToSeconds(maxBeat, context), rate);
    const descriptor = resolveSmpteRate(rate);
    if (last === null || !descriptor) return [];
    // The slowest tempo gives a lower bound on beat spacing across every frame,
    // including ramps. A score-wide stride keeps frame marks stable while scrolling.
    const tempoPoints = context.tempoPoints;
    const minTempo = !context.tempoEnabled
      ? 60
      : tempoPoints?.length
        ? tempoPoints.reduce((min, point) => Math.min(min, point.tempo), Infinity)
        : context.initialTempo;
    const frameBeats = (minTempo / 60) * (descriptor.denominator / descriptor.numerator);
    if (!Number.isFinite(frameBeats) || frameBeats <= 0) return [];
    const stride = resolveGridStepStride(frameBeats, pixelsPerBeat);
    if (!Number.isSafeInteger(stride)) return [];
    const firstFrameRaw =
      minBeat > 0 ? (secondsToSmpteFrame(beatsToSeconds(minBeat, context), rate, 'floor') ?? 0) : 0;
    const startFrame = Math.max(0, Math.floor(firstFrameRaw / stride) * stride);
    const lines: number[] = [];
    for (let frame = startFrame; frame <= last; frame += stride) {
      const frameBeat = secondsToBeats(smpteFrameToSeconds(frame, rate)!, context);
      if (frameBeat >= minBeat - EPSILON) {
        lines.push(frameBeat);
      }
    }
    return lines;
  }
  if (usesMeterBoundarySnap(snapValue, snapBeats)) {
    return deriveMeterSnapLineBeats(0, meterMap, maxBeat, minBeat, pixelsPerBeat);
  }

  if (Number.isFinite(snapBeats) && usesMeterAnchoredAutoSnap(snapValue, snapBeats)) {
    return deriveMeterSnapLineBeats(snapBeats, meterMap, maxBeat, minBeat, pixelsPerBeat);
  }

  if (!Number.isFinite(snapBeats) || snapBeats <= 0) {
    return [];
  }

  const stride = resolveGridStepStride(snapBeats, pixelsPerBeat);
  const strideBeats = snapBeats * stride;
  const startStep =
    minBeat > 0 ? Math.max(0, Math.floor((minBeat - EPSILON) / strideBeats)) * stride : 0;
  const lines: number[] = [];
  for (let step = startStep; Number.isSafeInteger(step); step += stride) {
    const beat = step * snapBeats;
    if (beat > maxBeat + EPSILON) {
      break;
    }
    if (beat >= minBeat - EPSILON) {
      lines.push(beat);
    }
  }
  return lines;
}

export function snapBeatToGrid(
  beat: number,
  mode: 'floor' | 'nearest',
  snapValue: SnapValueName,
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
  context?: TimeConversionContext,
): number {
  if (snapValue === 'FRAME' && context) {
    const rate = context.smpteFrameRate ?? 24;
    const frame = secondsToSmpteFrame(beatsToSeconds(beat, context), rate, mode);
    return frame === null ? beat : secondsToBeats(smpteFrameToSeconds(frame, rate)!, context);
  }
  if (
    !usesMeterBoundarySnap(snapValue, snapBeats) &&
    !usesMeterAnchoredAutoSnap(snapValue, snapBeats)
  ) {
    if (!Number.isFinite(snapBeats) || snapBeats <= 0) return beat;
    return mode === 'floor'
      ? Math.floor(beat / snapBeats) * snapBeats
      : Math.round(beat / snapBeats) * snapBeats;
  }

  const entries = normalizeMeterEntries(meterMap);
  const start = locateMeterStartPosition(entries, beat - EPSILON, 1);
  const meterBoundaryOnly = usesMeterBoundarySnap(snapValue, snapBeats);
  let { entryIndex, measure: currentMeasure, beat: currentBeat } = start;
  let previous = currentBeat;
  let next = previous;
  let foundNext = false;

  const inspectCandidate = (candidate: number): boolean => {
    if (candidate <= beat + EPSILON) {
      previous = candidate;
    }
    if (candidate >= beat - EPSILON) {
      next = candidate;
      foundNext = true;
      return true;
    }
    return false;
  };

  while (!foundNext) {
    const nextPos = advanceMeasure(entries, entryIndex, currentMeasure);
    if (inspectCandidate(currentBeat)) {
      break;
    }

    if (!meterBoundaryOnly) {
      const startSubIndex =
        beat > currentBeat
          ? Math.max(1, Math.floor((beat - EPSILON - currentBeat) / snapBeats) - 1)
          : 1;
      for (let subIndex = startSubIndex; ; subIndex += 1) {
        const subBeat = currentBeat + subIndex * snapBeats;
        if (subBeat >= nextPos.beat - EPSILON) {
          break;
        }
        if (inspectCandidate(subBeat)) {
          break;
        }
      }
      if (foundNext) {
        break;
      }
    }

    if (nextPos.entryIndex === entryIndex && nextPos.beat <= currentBeat) {
      break;
    }
    entryIndex = nextPos.entryIndex;
    currentMeasure = nextPos.measure;
    currentBeat = nextPos.beat;
  }

  if (mode === 'floor') {
    return previous;
  }

  return Math.abs(beat - previous) <= Math.abs(next - beat) ? previous : next;
}
