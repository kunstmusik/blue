/**
 * Channel pan and balance math, validation, and constants.
 *
 * Implements equal-power mono panning and stereo balance laws
 * defined in specs/112-mono-clip-panning/contracts/audio-routing.md.
 * Host-neutral and browser-safe.
 */

export const DEFAULT_PAN = 0.5;
export const MIN_PAN = 0.0;
export const MAX_PAN = 1.0;

/** 1 / sqrt(2) ≈ 0.7071067811865475 (-3.01 dB) */
export const EQUAL_POWER_CENTER_GAIN = 1 / Math.SQRT2;

export function isValidPan(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= MIN_PAN && value <= MAX_PAN
  );
}

export function clampPan(value: unknown, fallback = DEFAULT_PAN): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(MIN_PAN, Math.min(MAX_PAN, value));
}

/**
 * Gains for an all-mono source channel whose input is the equal-power mono upmix (x / sqrt(2)).
 * Multiplying the upmixed signal by these gains yields:
 *   left = x * cos(pi * p / 2)
 *   right = x * sin(pi * p / 2)
 * Center (p = 0.5) -> left = 1/sqrt(2), right = 1/sqrt(2) (about -3.01 dB).
 * Hard left (p = 0) -> left = 1.0, right = 0.0.
 * Hard right (p = 1) -> left = 0.0, right = 1.0.
 */
export function getMonoPanGains(p: number): [left: number, right: number] {
  const clamped = clampPan(p);
  const angle = (Math.PI * clamped) / 2;
  return [Math.SQRT2 * Math.cos(angle), Math.SQRT2 * Math.sin(angle)];
}

/**
 * Balance gains for stereo, mixed, or unknown source material:
 *   left = min(1, 2 * (1 - p))
 *   right = min(1, 2 * p)
 * Center (p = 0.5) leaves both sides at unity (1.0).
 * Hard left (p = 0) keeps left at 1.0 and mutes right to 0.0.
 * Hard right (p = 1) mutes left to 0.0 and keeps right at 1.0.
 */
export function getStereoBalanceGains(p: number): [left: number, right: number] {
  const clamped = clampPan(p);
  return [Math.min(1.0, 2 * (1 - clamped)), Math.min(1.0, 2 * clamped)];
}
