/**
 * FadeType — types of fade envelopes for audio clips.
 * Mirrors the Java FadeType enum.
 *
 * Based on Ardour's fade types (Curve.cpp):
 * - LINEAR: Straight linear fade
 * - CONSTANT_POWER: Equal-power fade (used for crossfades)
 * - SYMMETRIC: Constrained cubic spline (symmetric fade curve)
 * - FAST: Fast attack/release curve
 * - SLOW: Slow attack/release curve
 */
export enum FadeType {
  LINEAR = 'Linear',
  CONSTANT_POWER = 'Constant Power',
  SYMMETRIC = 'Symmetric',
  FAST = 'Fast',
  SLOW = 'Slow',
}

export const FADE_TYPE_MAP: Map<string, FadeType> = new Map([
  ['Linear', FadeType.LINEAR],
  ['Constant Power', FadeType.CONSTANT_POWER],
  ['Symmetric', FadeType.SYMMETRIC],
  ['Fast', FadeType.FAST],
  ['Slow', FadeType.SLOW],
]);

export function fadeTypeFromString(str: string): FadeType | undefined {
  return FADE_TYPE_MAP.get(str);
}

export function fadeTypeToString(ft: FadeType): string {
  return ft;
}

/**
 * Get the Csound fade curve type number for the blue_fade UDO.
 * Matches the enum ordinal values from the Java FadeType.
 */
export function fadeTypeToCsound(ft: FadeType): number {
  switch (ft) {
    case FadeType.LINEAR:
      return 0;
    case FadeType.CONSTANT_POWER:
      return 1;
    case FadeType.SYMMETRIC:
      return 2;
    case FadeType.FAST:
      return 3;
    case FadeType.SLOW:
      return 4;
  }
}
