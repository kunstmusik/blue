/**
 * Channel pan, balance, and stereo mode math, validation, and constants.
 *
 * Implements configurable pan laws (0 dB, -3 dB, -4.5 dB, -6 dB), off-center boost,
 * stereo balance, and true-stereo modes (Stereo Pan with Width, Dual Pan)
 * defined in specs/113-pan-laws-configuration/contracts/audio-panning.md.
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

export function parseFiniteNumber(str: string | null | undefined): number | undefined {
  if (typeof str !== 'string') return undefined;
  const trimmed = str.trim();
  if (trimmed.length === 0) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

// ─── Pan Law Constants and Validation ───

export type PanLawDb = 0 | -3 | -4.5 | -6;
export const PAN_LAW_VALUES: readonly PanLawDb[] = [0, -3, -4.5, -6];
export const DEFAULT_PAN_LAW_DB: PanLawDb = -3;
export const DEFAULT_PAN_OFF_CENTER_BOOST = false;

export function isValidPanLawDb(value: unknown): value is PanLawDb {
  return (
    typeof value === 'number' && (value === 0 || value === -3 || value === -4.5 || value === -6)
  );
}

export function clampPanLawDb(value: unknown, fallback: PanLawDb = DEFAULT_PAN_LAW_DB): PanLawDb {
  return isValidPanLawDb(value) ? value : fallback;
}

// ─── Stereo Pan Mode Constants and Validation ───

export type StereoPanMode = 'balance' | 'stereoPan' | 'dualPan';
export const STEREO_PAN_MODES: readonly StereoPanMode[] = ['balance', 'stereoPan', 'dualPan'];
export const DEFAULT_STEREO_PAN_MODE: StereoPanMode = 'balance';

export function isValidStereoPanMode(value: unknown): value is StereoPanMode {
  return value === 'balance' || value === 'stereoPan' || value === 'dualPan';
}

export function clampStereoPanMode(
  value: unknown,
  fallback: StereoPanMode = DEFAULT_STEREO_PAN_MODE,
): StereoPanMode {
  return isValidStereoPanMode(value) ? value : fallback;
}

export function stereoPanModeToNumber(mode: StereoPanMode): number {
  switch (mode) {
    case 'balance':
      return 0;
    case 'stereoPan':
      return 1;
    case 'dualPan':
      return 2;
  }
}

export function numberToStereoPanMode(value: number): StereoPanMode {
  if (value === 1) return 'stereoPan';
  if (value === 2) return 'dualPan';
  return 'balance';
}

// ─── Width and Dual Pan Constants and Validation ───

export const DEFAULT_PAN_WIDTH = 1.0;
export const MIN_PAN_WIDTH = 0.0;
export const MAX_PAN_WIDTH = 1.0;

export function isValidPanWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_PAN_WIDTH &&
    value <= MAX_PAN_WIDTH
  );
}

export function clampPanWidth(value: unknown, fallback = DEFAULT_PAN_WIDTH): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(MIN_PAN_WIDTH, Math.min(MAX_PAN_WIDTH, value));
}

export const DEFAULT_DUAL_PAN_LEFT = 0.0;
export const DEFAULT_DUAL_PAN_RIGHT = 1.0;

export function isValidDualPan(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= MIN_PAN && value <= MAX_PAN
  );
}

export function clampDualPan(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(MIN_PAN, Math.min(MAX_PAN, value));
}

// ─── Stable Parameter Names for Automation ───

export const PARAM_PAN = 'Pan';
export const PARAM_WIDTH = 'Width';
export const PARAM_DUAL_LEFT = 'Dual Left';
export const PARAM_DUAL_RIGHT = 'Dual Right';

// ─── Continuous Pan Law Gain Functions ───

/** Interpolation weight t for -4.5 dB law: (1/√2 - 10^(-4.5/20)) / (1/√2 - 0.5) */
const PAN_LAW_45_T = (1 / Math.SQRT2 - Math.pow(10, -4.5 / 20)) / (1 / Math.SQRT2 - 0.5);

function panLawCurve(q: number, lawDb: PanLawDb): number {
  const clampedQ = Math.max(0, Math.min(1, q));
  switch (lawDb) {
    case 0:
      return Math.min(1.0, 2.0 * clampedQ);
    case -3:
      return Math.sin((Math.PI * clampedQ) / 2.0);
    case -4.5: {
      const e = Math.sin((Math.PI * clampedQ) / 2.0);
      const g = clampedQ;
      return (1.0 - PAN_LAW_45_T) * e + PAN_LAW_45_T * g;
    }
    case -6:
      return clampedQ;
  }
}

/**
 * Returns raw source-leg gains [left, right] for a signal positioned at p in [0, 1].
 * left = f(1 - p), right = f(p), with optional off-center boost applied.
 */
export function getSourceLegGains(
  p: number,
  lawDb: PanLawDb = DEFAULT_PAN_LAW_DB,
  boost = DEFAULT_PAN_OFF_CENTER_BOOST,
): [left: number, right: number] {
  const clamped = clampPan(p);
  const validatedLaw = clampPanLawDb(lawDb);

  // Exact Spec 112 branch when law is -3 dB and boost is false
  let rawLeft: number;
  let rawRight: number;
  if (validatedLaw === -3 && !boost) {
    const angle = (Math.PI * clamped) / 2;
    rawLeft = Math.cos(angle);
    rawRight = Math.sin(angle);
  } else {
    rawLeft = panLawCurve(1 - clamped, validatedLaw);
    rawRight = panLawCurve(clamped, validatedLaw);
  }

  if (boost && validatedLaw !== 0) {
    const boostFactor =
      1.0 + (Math.pow(10, Math.abs(validatedLaw) / 20) - 1.0) * 2.0 * Math.abs(clamped - 0.5);
    rawLeft *= boostFactor;
    rawRight *= boostFactor;
  }

  return [rawLeft, rawRight];
}

/**
 * Gains for an all-mono source channel whose input is the equal-power mono upmix (x / sqrt(2)).
 * Multiplying the upmixed signal by these gains yields:
 *   left = x * f(1 - p) * sqrt(2)
 *   right = x * f(p) * sqrt(2)
 * For default -3 dB unboosted, exactly preserves Spec 112's:
 *   left = Math.SQRT2 * cos(pi * p / 2)
 *   right = Math.SQRT2 * sin(pi * p / 2)
 */
export function getMonoPanGains(
  p: number,
  lawDb: PanLawDb = DEFAULT_PAN_LAW_DB,
  boost = DEFAULT_PAN_OFF_CENTER_BOOST,
): [left: number, right: number] {
  const [legL, legR] = getSourceLegGains(p, lawDb, boost);
  return [Math.SQRT2 * legL, Math.SQRT2 * legR];
}

/**
 * Balance gains for stereo, mixed, or unknown source material:
 *   left = min(1, 2 * (1 - p))
 *   right = min(1, 2 * p)
 * Center (p = 0.5) leaves both sides at unity (1.0).
 * Hard left (p = 0) keeps left at 1.0 and mutes right to 0.0.
 * Hard right (p = 1) mutes left to 0.0 and keeps right at 1.0.
 * Law and boost have no effect on Balance.
 */
export function getStereoBalanceGains(p: number): [left: number, right: number] {
  const clamped = clampPan(p);
  return [Math.min(1.0, 2 * (1 - clamped)), Math.min(1.0, 2 * clamped)];
}

/**
 * Effective spread d = width * min(position, 1 - position).
 */
export function calculateStereoPanEffectiveSpread(position: number, width: number): number {
  const c = clampPan(position);
  const w = clampPanWidth(width);
  return w * Math.min(c, 1.0 - c);
}

/**
 * 2x2 gain matrix [aL, bL, aR, bR] for Stereo Pan:
 *   leftOut  = aL * leftIn + aR * rightIn
 *   rightOut = bL * leftIn + bR * rightIn
 */
export function getStereoPanGains(
  position: number,
  width: number,
  lawDb: PanLawDb = DEFAULT_PAN_LAW_DB,
  boost = DEFAULT_PAN_OFF_CENTER_BOOST,
): [aL: number, bL: number, aR: number, bR: number] {
  const c = clampPan(position);
  const d = calculateStereoPanEffectiveSpread(c, width);
  const pL = c - d;
  const pR = c + d;
  const [aL, bL] = getSourceLegGains(pL, lawDb, boost);
  const [aR, bR] = getSourceLegGains(pR, lawDb, boost);
  return [aL, bL, aR, bR];
}

/**
 * 2x2 gain matrix [aL, bL, aR, bR] for Dual Pan:
 *   leftOut  = aL * leftIn + aR * rightIn
 *   rightOut = bL * leftIn + bR * rightIn
 */
export function getDualPanGains(
  dualPanLeft: number,
  dualPanRight: number,
  lawDb: PanLawDb = DEFAULT_PAN_LAW_DB,
  boost = DEFAULT_PAN_OFF_CENTER_BOOST,
): [aL: number, bL: number, aR: number, bR: number] {
  const [aL, bL] = getSourceLegGains(
    clampDualPan(dualPanLeft, DEFAULT_DUAL_PAN_LEFT),
    lawDb,
    boost,
  );
  const [aR, bR] = getSourceLegGains(
    clampDualPan(dualPanRight, DEFAULT_DUAL_PAN_RIGHT),
    lawDb,
    boost,
  );
  return [aL, bL, aR, bR];
}
