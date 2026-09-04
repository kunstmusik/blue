/**
 * Browser-safe app-zoom value contract (SPEC 061).
 *
 * Pure TypeScript only. No Electron, renderer, Node built-in, filesystem, or
 * project-model imports. Static top-level imports only.
 */

export const APP_ZOOM_DEFAULT_PERCENT = 100;
export const APP_ZOOM_MIN_PERCENT = 50;
export const APP_ZOOM_MAX_PERCENT = 300;
export const APP_ZOOM_STEP_PERCENT = 10;

export type AppZoomCommand = 'zoom-in' | 'zoom-out' | 'actual-size';

/**
 * Accepts only finite integer multiples of {@link APP_ZOOM_STEP_PERCENT} in the
 * inclusive {@link APP_ZOOM_MIN_PERCENT}-to-{@link APP_ZOOM_MAX_PERCENT} range.
 */
export function isSupportedAppZoomPercent(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  if (!Number.isInteger(value)) {
    return false;
  }
  if (value < APP_ZOOM_MIN_PERCENT || value > APP_ZOOM_MAX_PERCENT) {
    return false;
  }
  return value % APP_ZOOM_STEP_PERCENT === 0;
}

/**
 * Returns the value when supported and {@link APP_ZOOM_DEFAULT_PERCENT}
 * otherwise. Never throws.
 */
export function normalizeAppZoomPercent(value: unknown): number {
  return isSupportedAppZoomPercent(value) ? value : APP_ZOOM_DEFAULT_PERCENT;
}

/**
 * Resolves a zoom command against a current valid percentage. Always returns a
 * supported value and clamps at the documented bounds. A command at its
 * effective target (e.g. zoom-in at 300, actual-size at 100) is a no-op.
 */
export function resolveAppZoomCommand(current: number, command: AppZoomCommand): number {
  const base = isSupportedAppZoomPercent(current) ? current : APP_ZOOM_DEFAULT_PERCENT;

  switch (command) {
    case 'zoom-in': {
      const next = base + APP_ZOOM_STEP_PERCENT;
      return next > APP_ZOOM_MAX_PERCENT ? APP_ZOOM_MAX_PERCENT : next;
    }
    case 'zoom-out': {
      const next = base - APP_ZOOM_STEP_PERCENT;
      return next < APP_ZOOM_MIN_PERCENT ? APP_ZOOM_MIN_PERCENT : next;
    }
    case 'actual-size':
      return APP_ZOOM_DEFAULT_PERCENT;
  }
}

/**
 * Converts a percentage to a Chromium/Electron zoom factor
 * (`percent / 100`). Pure arithmetic; does not read window state.
 */
export function toAppZoomFactor(percent: number): number {
  return percent / 100;
}
