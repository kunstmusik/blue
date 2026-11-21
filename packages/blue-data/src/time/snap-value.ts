import { resolveSmpteRate } from './smpte-timecode';
/**
 * SnapValue — predefined snap values for timeline editing.
 * Mirrors the Java SnapValue enum.
 */

export type SnapValueName =
  | 'BAR'
  | 'HALF'
  | 'BEAT'
  | 'EIGHTH'
  | 'SIXTEENTH'
  | 'THIRTY_SECOND'
  | 'SIXTY_FOURTH'
  | 'QUARTER_TRIPLET'
  | 'EIGHTH_TRIPLET'
  | 'SIXTEENTH_TRIPLET'
  | 'ONE_SECOND'
  | 'HUNDRED_MS'
  | 'TEN_MS'
  | 'ONE_MS'
  | 'FRAME'
  | 'SAMPLE'
  | 'AUTO';

/** Unit family for a named timeline snapping interval. */
export type SnapCategory = 'MUSICAL' | 'TRIPLET' | 'TIME' | 'SMPTE' | 'SAMPLE' | 'AUTO';

/** Named snapping interval with its display label, numeric value, and unit category. */
export interface SnapValueDefinition {
  /** Name associated with the snap value definition. */
  readonly name: SnapValueName;
  /** Human-readable display label. */
  readonly displayName: string;
  /** Numeric interval in the units given by its category. */
  readonly baseValue: number;
  /** Unit family used to interpret the numeric snap interval. */
  readonly category: SnapCategory;
}

const SNAP_VALUES: ReadonlyMap<SnapValueName, SnapValueDefinition> = new Map([
  ['BAR', { name: 'BAR', displayName: 'Bar', baseValue: 4.0, category: 'MUSICAL' }],
  ['HALF', { name: 'HALF', displayName: '1/2', baseValue: 2.0, category: 'MUSICAL' }],
  ['BEAT', { name: 'BEAT', displayName: 'Beat', baseValue: 1.0, category: 'MUSICAL' }],
  ['EIGHTH', { name: 'EIGHTH', displayName: '1/8', baseValue: 0.5, category: 'MUSICAL' }],
  ['SIXTEENTH', { name: 'SIXTEENTH', displayName: '1/16', baseValue: 0.25, category: 'MUSICAL' }],
  [
    'THIRTY_SECOND',
    { name: 'THIRTY_SECOND', displayName: '1/32', baseValue: 0.125, category: 'MUSICAL' },
  ],
  [
    'SIXTY_FOURTH',
    { name: 'SIXTY_FOURTH', displayName: '1/64', baseValue: 0.0625, category: 'MUSICAL' },
  ],
  [
    'QUARTER_TRIPLET',
    { name: 'QUARTER_TRIPLET', displayName: '1/4T', baseValue: 1.0 / 3.0, category: 'TRIPLET' },
  ],
  [
    'EIGHTH_TRIPLET',
    { name: 'EIGHTH_TRIPLET', displayName: '1/8T', baseValue: 1.0 / 6.0, category: 'TRIPLET' },
  ],
  [
    'SIXTEENTH_TRIPLET',
    { name: 'SIXTEENTH_TRIPLET', displayName: '1/16T', baseValue: 1.0 / 12.0, category: 'TRIPLET' },
  ],
  ['ONE_SECOND', { name: 'ONE_SECOND', displayName: '1 sec', baseValue: 1.0, category: 'TIME' }],
  ['HUNDRED_MS', { name: 'HUNDRED_MS', displayName: '100 ms', baseValue: 0.1, category: 'TIME' }],
  ['TEN_MS', { name: 'TEN_MS', displayName: '10 ms', baseValue: 0.01, category: 'TIME' }],
  ['ONE_MS', { name: 'ONE_MS', displayName: '1 ms', baseValue: 0.001, category: 'TIME' }],
  ['FRAME', { name: 'FRAME', displayName: 'Frame', baseValue: 1.0, category: 'SMPTE' }],
  ['SAMPLE', { name: 'SAMPLE', displayName: 'Sample', baseValue: 1.0, category: 'SAMPLE' }],
  ['AUTO', { name: 'AUTO', displayName: 'Auto', baseValue: 0.0, category: 'AUTO' }],
]);

/** Available named snapping intervals in catalog order. */
export const ALL_SNAP_VALUES: ReadonlyArray<SnapValueDefinition> = [...SNAP_VALUES.values()];

/** Looks up the snapping interval with the supplied catalog name. */
export function getSnapValue(name: SnapValueName): SnapValueDefinition {
  return SNAP_VALUES.get(name) ?? SNAP_VALUES.get('BEAT')!;
}

/** Checks whether the supplied value is a supported valid snap value name. */
export function isValidSnapValueName(name: string): name is SnapValueName {
  return SNAP_VALUES.has(name as SnapValueName);
}

/** Converts the snapping interval to beats in the supplied timing context. */
export function snapValueToBeats(
  snapValue: SnapValueName,
  tempo: number,
  smpteFrameRate: number,
  sampleRate: number,
  pixelSecond: number,
): number {
  const def = getSnapValue(snapValue);
  switch (def.category) {
    case 'MUSICAL':
    case 'TRIPLET':
      return def.baseValue;
    case 'TIME':
      return def.baseValue * (tempo / 60.0);
    case 'SMPTE': {
      const rate = resolveSmpteRate(smpteFrameRate);
      return rate ? def.baseValue * (rate.denominator / rate.numerator) * (tempo / 60.0) : 0;
    }
    case 'SAMPLE':
      return def.baseValue * (1.0 / sampleRate) * (tempo / 60.0);
    case 'AUTO': {
      const targetPixelSpacing = 60.0;
      const beatsPerPixel = 1.0 / pixelSecond;
      const rawSnapValue = targetPixelSpacing * beatsPerPixel;
      return roundToNearestSnapValue(rawSnapValue);
    }
  }
}

function roundToNearestSnapValue(rawValue: number): number {
  const musicalValues = [4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625];
  for (const val of musicalValues) {
    if (rawValue >= val) return val;
  }
  return 0.0625;
}

/** Finds the catalog interval nearest the supplied value. */
export function closestSnapValueMatch(legacyValue: number): SnapValueName {
  let best: SnapValueName = 'BEAT';
  let bestDiff = Number.MAX_VALUE;
  for (const sv of ALL_SNAP_VALUES) {
    if (sv.category === 'MUSICAL' || sv.category === 'TRIPLET') {
      const diff = Math.abs(sv.baseValue - legacyValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = sv.name;
      }
    }
  }
  return best;
}
