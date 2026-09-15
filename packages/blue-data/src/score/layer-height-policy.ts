import { LAYER_HEIGHT } from './layers/layer';

export const LAYER_HEIGHT_MIN = 22;
export const LAYER_HEIGHT_MAX = 660;

export const SOUND_LAYER_MAX_HEIGHT_INDEX = 8;
export const TRACK_MAX_HEIGHT_INDEX = 9;

export const SOUND_LAYER_PRESET_HEIGHTS = [22, 44, 66, 88, 110, 132, 154, 176, 198] as const;
export const TRACK_PRESET_HEIGHTS = [22, 44, 66, 88, 110, 132, 154, 176, 198, 220] as const;
export const COMMON_PRESET_HEIGHTS = [22, 44, 66, 88, 110, 132, 154, 176, 198] as const;

export type LayerHeightType = 'soundLayer' | 'track';

/**
 * Strict custom height parser.
 * Accepts a complete base-10 integer string (optional surrounding whitespace)
 * or an integer number. Rejects fractions, suffixes, exponent notation,
 * NaN/Infinity, negative, and out-of-range (< 22 or > 660) values.
 */
export function parseCustomHeight(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    if (value < LAYER_HEIGHT_MIN || value > LAYER_HEIGHT_MAX) return null;
    return value;
  }

  if (typeof value === 'string') {
    if (!/^\s*[0-9]+\s*$/.test(value)) return null;
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isInteger(parsed)) return null;
    if (parsed < LAYER_HEIGHT_MIN || parsed > LAYER_HEIGHT_MAX) return null;
    return parsed;
  }

  return null;
}

/** Check whether a numeric height is a valid custom height in [22, 660]. */
export function isValidCustomHeight(height: number): boolean {
  return Number.isInteger(height) && height >= LAYER_HEIGHT_MIN && height <= LAYER_HEIGHT_MAX;
}

/** Check whether a height corresponds to a standard fixed preset for the layer type. */
export function isPresetHeight(height: number, layerType: LayerHeightType): boolean {
  if (!Number.isInteger(height) || height < LAYER_HEIGHT_MIN || height % LAYER_HEIGHT !== 0) {
    return false;
  }
  const maxIndex = layerType === 'track' ? TRACK_MAX_HEIGHT_INDEX : SOUND_LAYER_MAX_HEIGHT_INDEX;
  return height <= (maxIndex + 1) * LAYER_HEIGHT;
}

/**
 * Calculate the nearest legacy height index for a given logical-pixel height.
 * Formula: round(h / 22) - 1, clamped to [0, maxIndex].
 * Positive midpoint ties (e.g. 55 / 22 = 2.5) round upward.
 */
export function calculateNearestHeightIndex(height: number, layerType: LayerHeightType): number {
  const maxIndex = layerType === 'track' ? TRACK_MAX_HEIGHT_INDEX : SOUND_LAYER_MAX_HEIGHT_INDEX;
  const rawIndex = Math.round(height / LAYER_HEIGHT) - 1;
  return Math.max(0, Math.min(maxIndex, rawIndex));
}

/**
 * Resolve an explicit height into legacy heightIndex and optional customHeight.
 * If the height matches a preset for the given layer type, customHeight is omitted (undefined).
 */
export function resolveExplicitHeight(
  height: number,
  layerType: LayerHeightType,
): { heightIndex: number; customHeight: number | undefined } {
  const clamped = Math.max(LAYER_HEIGHT_MIN, Math.min(LAYER_HEIGHT_MAX, Math.round(height)));
  const heightIndex = calculateNearestHeightIndex(clamped, layerType);
  const customHeight = isPresetHeight(clamped, layerType) ? undefined : clamped;
  return { heightIndex, customHeight };
}

/**
 * Resolve the effective display height.
 * Prefers valid customHeight if present; otherwise derives from heightIndex.
 * If heightIndex is non-finite or negative, falls back to 22.
 */
export function resolveEffectiveHeight(heightIndex: number, customHeight?: number | null): number {
  if (customHeight !== undefined && customHeight !== null) {
    const validCustom = parseCustomHeight(customHeight);
    if (validCustom !== null) {
      return validCustom;
    }
  }

  if (Number.isFinite(heightIndex) && heightIndex >= 0) {
    return Math.round((heightIndex + 1) * LAYER_HEIGHT);
  }

  return LAYER_HEIGHT;
}

/**
 * Resolve the effective height for a group's default height index.
 * Falls back to 22 if the index is invalid.
 */
export function resolveGroupDefaultHeight(
  defaultHeightIndex: number,
  layerType: LayerHeightType,
): number {
  const maxIndex = layerType === 'track' ? TRACK_MAX_HEIGHT_INDEX : SOUND_LAYER_MAX_HEIGHT_INDEX;
  if (
    Number.isInteger(defaultHeightIndex) &&
    defaultHeightIndex >= 0 &&
    defaultHeightIndex <= maxIndex
  ) {
    return (defaultHeightIndex + 1) * LAYER_HEIGHT;
  }
  return LAYER_HEIGHT;
}
