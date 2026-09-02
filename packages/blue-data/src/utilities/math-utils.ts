/**
 * Math utilities for numerical clamping and domain constraints.
 */

/**
 * Clamps a number to the range [min, max] (inclusive).
 *
 * @param value The value to clamp
 * @param min The lower bound
 * @param max The upper bound
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
