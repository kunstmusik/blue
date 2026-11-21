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
  /** Gain changes linearly across the fade. */
  LINEAR = 'Linear',
  /** Amplitude follows a constant-power curve. */
  CONSTANT_POWER = 'Constant Power',
  /** Gain eases in and out over the fade. */
  S_CURVE = 'S-Curve',
  /** Fade curve that changes gain more quickly near one end of the interval. */
  FAST = 'Fast',
  /** Fade curve that changes gain more slowly near one end of the interval. */
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

/** Reads the fade-curve setting from its persisted name. */
export function fadeTypeFromString(str: string): FadeType | undefined {
  return FADE_TYPE_MAP.get(str);
}

/** Returns the persisted name of the selected fade curve. */
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
