/**
 * Canonical layer color constants and normalization helpers.
 *
 * All layer colors are canonical opaque signed 32-bit ARGB integers.
 * Default is -12566464 (0xFF404040 | 0, displayed as #404040).
 */

export const DEFAULT_LAYER_COLOR = -12566464; // 0xFF404040 | 0

/**
 * Validate that an input is a valid 32-bit integer in signed or unsigned range.
 */
export function isValidLayerColorInput(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= -2147483648 &&
    value <= 4294967295
  );
}

/**
 * Strictly normalize a layer color input to an opaque signed 32-bit ARGB integer.
 * Throws an Error if the input is not a valid 32-bit integer.
 */
export function normalizeLayerColor(value: number): number {
  if (!isValidLayerColorInput(value)) {
    throw new Error(`Invalid layer color: ${value}`);
  }
  return (value & 0x00ffffff) | 0xff000000 | 0;
}

/**
 * Strictly validate and normalize a layer color input, returning null on failure.
 */
export function tryNormalizeLayerColor(value: unknown): number | null {
  if (!isValidLayerColorInput(value)) {
    return null;
  }
  return (value & 0x00ffffff) | 0xff000000 | 0;
}

/**
 * Forgivingly normalize an XML layer color string.
 * Returns DEFAULT_LAYER_COLOR if the string is missing, invalid, or out of range.
 */
export function normalizeXmlLayerColor(value: string | null | undefined): number {
  if (value == null) {
    return DEFAULT_LAYER_COLOR;
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return DEFAULT_LAYER_COLOR;
  }
  const parsed = Number(trimmed);
  if (!isValidLayerColorInput(parsed)) {
    return DEFAULT_LAYER_COLOR;
  }
  return (parsed & 0x00ffffff) | 0xff000000 | 0;
}

/**
 * Format a canonical layer color as a 6-digit hex CSS color string (e.g. #404040).
 */
export function formatLayerColorToHex(color: number): string {
  const rgb = (color & 0x00ffffff) >>> 0;
  return '#' + rgb.toString(16).padStart(6, '0');
}
