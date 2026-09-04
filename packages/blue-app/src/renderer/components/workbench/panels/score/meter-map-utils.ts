import type {
  MeterMapSnapshot,
  MeterSnapshot,
  MeterMapPatch,
} from '../../../../../shared/project-editor';

export const METER_REGION_BAR_HEIGHT = 20;

export interface MeterRegion {
  index: number;
  startBeat: number;
  endBeat: number;
  entry: MeterSnapshot;
  label: string;
}

export function deriveMeterRegions(meterMap: MeterMapSnapshot, totalBeats: number): MeterRegion[] {
  const regions: MeterRegion[] = [];
  const entries = meterMap.entries;

  for (let i = 0; i < entries.length; i++) {
    const startBeat = entries[i].startBeat;
    const endBeat = i < entries.length - 1 ? entries[i + 1].startBeat : totalBeats;
    regions.push({
      index: i,
      startBeat,
      endBeat,
      entry: entries[i],
      label: `${entries[i].numBeats}/${entries[i].beatLength}`,
    });
  }

  return regions;
}

export function findRegionAtBeat(regions: MeterRegion[], beat: number): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (beat >= regions[i].startBeat) {
      return i;
    }
  }
  return 0;
}

export function beatToScreenX(beat: number, pixelsPerBeat: number): number {
  return beat * pixelsPerBeat;
}

export function screenXToBeat(x: number, pixelsPerBeat: number): number {
  return x / pixelsPerBeat;
}

export function beatToMeasure(beat: number, entries: MeterSnapshot[]): number {
  if (entries.length === 0) return 1;
  let entryIndex = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (beat >= entries[i].startBeat) {
      entryIndex = i;
      break;
    }
  }
  const entry = entries[entryIndex];
  const beatsPerMeasure = entry.numBeats * (4.0 / entry.beatLength);
  const measuresFromEntry = Math.floor((beat - entry.startBeat) / beatsPerMeasure);
  return entry.measure + measuresFromEntry;
}

export function formatMeterTooltip(entry: MeterSnapshot): string {
  return `Measure ${entry.measure} / Time Signature: ${entry.numBeats}/${entry.beatLength}`;
}

export function parseMeterSignature(text: string): { numBeats: number; beatLength: number } | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  if (!match) return null;
  const numBeatsText = match[1];
  const beatLengthText = match[2];
  if (numBeatsText === undefined || beatLengthText === undefined) return null;
  const numBeats = Number(numBeatsText);
  const beatLength = Number(beatLengthText);
  if (!Number.isInteger(numBeats) || numBeats < 1) return null;
  if (!Number.isInteger(beatLength) || beatLength < 1) return null;
  return { numBeats, beatLength };
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function findEntryAtMeasure(entries: MeterSnapshot[], measure: number): number {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].measure === measure) return i;
  }
  return -1;
}

export function getDefaultMeterForBeat(beat: number, entries: MeterSnapshot[]): MeterSnapshot {
  if (entries.length === 0) {
    return { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 };
  }
  const measure = beatToMeasure(beat, entries);
  return { measure, numBeats: 4, beatLength: 4, startBeat: 0 };
}
