import type { SnapValueName } from '@blue/data';
import type { MeterMapSnapshot, MeterSnapshot } from '../../../../../shared/project-editor';

const EPSILON = 1e-9;

function normalizeMeterEntries(meterMap: MeterMapSnapshot | null | undefined): MeterSnapshot[] {
  const entries = meterMap?.entries.length
    ? meterMap.entries
    : [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }];

  return [...entries].sort((a, b) => a.measure - b.measure);
}

function getBeatsPerMeasure(entry: MeterSnapshot): number {
  return entry.numBeats * (4.0 / entry.beatLength);
}

function getMaxBeatsPerMeasure(entries: MeterSnapshot[]): number {
  return entries.reduce((max, entry) => Math.max(max, getBeatsPerMeasure(entry)), 4);
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

export function deriveBarSnapLineBeats(
  meterMap: MeterMapSnapshot | null | undefined,
  maxBeat: number,
): number[] {
  const entries = normalizeMeterEntries(meterMap);
  const lines: number[] = [];
  let entryIndex = 0;
  let currentMeasure = entries[0]!.measure;
  let currentBeat = entries[0]!.startBeat;

  while (currentBeat <= maxBeat + EPSILON) {
    pushUnique(lines, currentBeat);

    const nextMeasure = currentMeasure + 1;
    const nextEntry = entries[entryIndex + 1];
    if (nextEntry && nextMeasure >= nextEntry.measure) {
      entryIndex += 1;
      currentMeasure = nextEntry.measure;
      currentBeat = nextEntry.startBeat;
    } else {
      currentBeat += getBeatsPerMeasure(entries[entryIndex]!);
      currentMeasure = nextMeasure;
    }
  }

  return lines;
}

function deriveMeterAnchoredAutoSnapLineBeats(
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
  maxBeat: number,
): number[] {
  const entries = normalizeMeterEntries(meterMap);
  const lines: number[] = [];
  let entryIndex = 0;
  let currentMeasure = entries[0]!.measure;
  let currentBeat = entries[0]!.startBeat;

  while (currentBeat <= maxBeat + EPSILON) {
    const nextMeasure = currentMeasure + 1;
    const nextEntry = entries[entryIndex + 1];
    const nextBeat =
      nextEntry && nextMeasure >= nextEntry.measure
        ? nextEntry.startBeat
        : currentBeat + getBeatsPerMeasure(entries[entryIndex]!);

    pushUnique(lines, currentBeat);
    for (
      let beat = currentBeat + snapBeats;
      beat <= maxBeat + EPSILON && beat < nextBeat - EPSILON;
      beat += snapBeats
    ) {
      pushUnique(lines, beat);
    }

    if (nextEntry && nextMeasure >= nextEntry.measure) {
      entryIndex += 1;
      currentMeasure = nextEntry.measure;
      currentBeat = nextEntry.startBeat;
    } else {
      currentMeasure = nextMeasure;
      currentBeat = nextBeat;
    }
  }

  return lines;
}

export function deriveSnapLineBeats(
  snapValue: SnapValueName,
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
  maxBeat: number,
): number[] {
  if (usesMeterBoundarySnap(snapValue, snapBeats)) {
    return deriveBarSnapLineBeats(meterMap, maxBeat);
  }

  if (usesMeterAnchoredAutoSnap(snapValue, snapBeats)) {
    return deriveMeterAnchoredAutoSnapLineBeats(snapBeats, meterMap, maxBeat);
  }

  if (snapBeats <= 0) {
    return [];
  }

  const lines: number[] = [];
  for (let beat = 0; beat <= maxBeat + EPSILON; beat += snapBeats) {
    lines.push(beat);
  }
  return lines;
}

export function snapBeatToGrid(
  beat: number,
  mode: 'floor' | 'nearest',
  snapValue: SnapValueName,
  snapBeats: number,
  meterMap: MeterMapSnapshot | null | undefined,
): number {
  if (
    !usesMeterBoundarySnap(snapValue, snapBeats) &&
    !usesMeterAnchoredAutoSnap(snapValue, snapBeats)
  ) {
    if (snapBeats <= 0) return beat;
    return mode === 'floor'
      ? Math.floor(beat / snapBeats) * snapBeats
      : Math.round(beat / snapBeats) * snapBeats;
  }

  const entries = normalizeMeterEntries(meterMap);
  const lookahead = Math.max(getMaxBeatsPerMeasure(entries), snapBeats) + 1;
  const lines = usesMeterBoundarySnap(snapValue, snapBeats)
    ? deriveBarSnapLineBeats(meterMap, Math.max(0, beat) + lookahead)
    : deriveMeterAnchoredAutoSnapLineBeats(snapBeats, meterMap, Math.max(0, beat) + lookahead);
  let previous = lines[0] ?? 0;
  let next = previous;

  for (const line of lines) {
    if (line <= beat + EPSILON) {
      previous = line;
    }
    if (line >= beat - EPSILON) {
      next = line;
      break;
    }
  }

  if (mode === 'floor') {
    return previous;
  }

  return Math.abs(beat - previous) <= Math.abs(next - beat) ? previous : next;
}
