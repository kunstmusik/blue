export const MIN_GAIN_DB = -96;
export const MAX_GAIN_DB = 12;
export const DB_RANGE = 108;
export const UNITY_GAIN_DB = 0;

export const UNITY_TRAVEL_FRACTION = Math.pow(96 / 108, 3); // 512 / 729 ≈ 0.7023319616

/**
 * Pure display conversion from gain in dB [-96, 12] to upward fraction [0, 1].
 * Formula: p = ((g + 96) / 108)^3
 */
export function gainDbToFraction(gainDb: number): number {
  if (!Number.isFinite(gainDb) || Number.isNaN(gainDb) || gainDb <= MIN_GAIN_DB) {
    return 0;
  }
  if (gainDb >= MAX_GAIN_DB) {
    return 1;
  }
  const normalized = (gainDb - MIN_GAIN_DB) / DB_RANGE;
  return Math.pow(normalized, 3);
}

/**
 * Pure display conversion from upward fraction [0, 1] to gain in dB [-96, 12].
 * Formula: g = 108 * cbrt(p) - 96
 */
export function fractionToGainDb(fraction: number): number {
  if (!Number.isFinite(fraction) || Number.isNaN(fraction) || fraction <= 0) {
    return MIN_GAIN_DB;
  }
  if (fraction >= 1) {
    return MAX_GAIN_DB;
  }
  return DB_RANGE * Math.cbrt(fraction) + MIN_GAIN_DB;
}
