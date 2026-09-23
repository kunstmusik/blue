/**
 * FadeType — types of fade envelopes for audio clips.
 * Uses Java Blue's audio fade names where they remain supported.
 *
 * - LINEAR: Straight linear fade
 * - CONSTANT_POWER: Equal-power fade (used for crossfades)
 * - S_CURVE: Raised-cosine fade
 * - FAST: Fast attack/release curve
 * - SLOW: Slow attack/release curve
 */
export enum FadeType {
  LINEAR = 'Linear',
  CONSTANT_POWER = 'Constant Power',
  S_CURVE = 'S-Curve',
  FAST = 'Fast',
  SLOW = 'Slow',
}

export const FADE_TYPE_MAP: Map<string, FadeType> = new Map([
  ['Linear', FadeType.LINEAR],
  ['Constant Power', FadeType.CONSTANT_POWER],
  ['S-Curve', FadeType.S_CURVE],
  ['Symmetric', FadeType.S_CURVE], // Migrate legacy Java Blue projects on load.
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
 * Reuses slot 2 in generated Csound scores for the replacement S-Curve.
 */
export function fadeTypeToCsound(ft: FadeType): number {
  switch (ft) {
    case FadeType.LINEAR:
      return 0;
    case FadeType.CONSTANT_POWER:
      return 1;
    case FadeType.S_CURVE:
      return 2;
    case FadeType.FAST:
      return 3;
    case FadeType.SLOW:
      return 4;
  }
}
