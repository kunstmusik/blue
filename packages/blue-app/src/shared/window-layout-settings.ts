/**
 * App-wide window layout settings contract shared by main, preload, and renderer.
 *
 * Phase 1: minimal exports so dependent modules and test files can compile.
 * Defaults, validation, merge, and reset behavior land in Phase 2 (T013).
 *
 * Browser-safe: no Node or Electron built-ins.
 */

export const WINDOW_LAYOUT_SETTINGS_VERSION = 1;

/**
 * IPC channel used by Reset Windows to notify every active renderer that
 * layout state has been cleared to defaults. Both main and preload import this
 * constant so the channel name cannot drift between them.
 */
export const WINDOW_LAYOUT_RESET_CHANNEL = 'window-layout:reset';

/** Current Electron display work areas used to keep restored popouts visible. */
export const WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL = 'window-layout:get-display-work-areas';

export interface DisplayWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowId =
  | 'main'
  | 'settings'
  | 'effect-editor'
  | 'effect-interface'
  | 'track-instrument-editor';

export const WINDOW_IDENTITIES: readonly WindowId[] = [
  'main',
  'settings',
  'effect-editor',
  'effect-interface',
  'track-instrument-editor',
];

export type SplitId =
  | 'orchestra.outer'
  | 'score.main'
  | 'udo.workspace.outer'
  | 'bsb.interface.properties'
  | 'piano-roll.field-editor'
  | 'line-object.lines'
  | 'zak-line-object.lines'
  | 'pattern-object.layers'
  | 'pattern-object.score'
  | 'soundfont-viewer.tables';

export const DEFAULT_SPLIT_SIZE_PX = 200;
export const BSB_PROPERTY_SPLIT_SIZE_PX = 250;

export interface WindowBoundsSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowDisplayState = 'normal' | 'maximized' | 'fullscreen';

export interface WindowStateSnapshot {
  normalBounds: WindowBoundsSnapshot;
  displayState: WindowDisplayState;
  updatedAt?: string;
}

export interface WorkbenchLayoutSettings {
  serializedLayout: string;
  updatedAt?: string;
}

export type SplitOrientation = 'horizontal' | 'vertical';
export type SplitControlledPane = 'first' | 'second';

export interface SplitLocationSnapshot {
  orientation: SplitOrientation;
  controlledPane: SplitControlledPane;
  sizePx: number;
  updatedAt?: string;
}

export interface LegacyLayoutMigrationState {
  blueSettingsWindowBoundsMigrated: boolean;
  workbenchLocalStorageMigrated: boolean;
  migratedAt?: string;
}

export interface WindowLayoutSettingsSnapshot {
  version: number;
  windows: Partial<Record<WindowId, WindowStateSnapshot>>;
  workbench?: WorkbenchLayoutSettings;
  splits: Partial<Record<SplitId, SplitLocationSnapshot>>;
  legacyMigration: LegacyLayoutMigrationState;
  lastResetAt?: string;
}

export type WindowLayoutUpdateRequest =
  | { type: 'window-state'; windowId: WindowId; state: WindowStateSnapshot }
  | { type: 'workbench-layout'; serializedLayout: string }
  | { type: 'split-location'; splitId: SplitId; location: SplitLocationSnapshot }
  | { type: 'legacy-migration'; legacy: LegacyLayoutMigrationPayload };

export interface LegacyLayoutMigrationPayload {
  blueSettingsWindowBoundsMigrated?: boolean;
  workbenchLocalStorageMigrated?: boolean;
  windowBounds?: WindowBoundsSnapshot | null;
  workbenchSerializedLayout?: string;
}

export interface WindowStateValidationOptions {
  minimumSize?: number;
  workAreas?: DisplayWorkArea[];
}

export const DEFAULT_WINDOW_MINIMUM_SIZE = 100;

export function createDefaultWindowLayoutSettings(): WindowLayoutSettingsSnapshot {
  return {
    version: WINDOW_LAYOUT_SETTINGS_VERSION,
    windows: {},
    workbench: undefined,
    splits: {},
    legacyMigration: {
      blueSettingsWindowBoundsMigrated: false,
      workbenchLocalStorageMigrated: false,
    },
  };
}

export function createDefaultSplitLocation(
  overrides: Partial<SplitLocationSnapshot> = {},
): SplitLocationSnapshot {
  return {
    orientation: 'horizontal',
    controlledPane: 'first',
    sizePx: DEFAULT_SPLIT_SIZE_PX,
    ...overrides,
  };
}

export function createDefaultLegacyLayoutMigrationState(): LegacyLayoutMigrationState {
  return {
    blueSettingsWindowBoundsMigrated: false,
    workbenchLocalStorageMigrated: false,
  };
}

/**
 * Returns true when the candidate bounds describe a finite, positive rectangle
 * that meets the configured minimum visible size and (optionally) intersects at
 * least one provided work area. Display-state must be one of the persisted
 * enum values; "minimized" is intentionally not persisted.
 */
export function isValidWindowState(
  candidate: unknown,
  options: WindowStateValidationOptions = {},
): candidate is WindowStateSnapshot {
  if (!candidate || typeof candidate !== 'object') return false;
  const c = candidate as Partial<WindowStateSnapshot>;
  if (
    c.displayState !== 'normal' &&
    c.displayState !== 'maximized' &&
    c.displayState !== 'fullscreen'
  ) {
    return false;
  }
  const bounds = c.normalBounds;
  if (!bounds || typeof bounds !== 'object') return false;
  const b = bounds as Partial<WindowBoundsSnapshot>;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = b[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  }
  const minimum = options.minimumSize ?? DEFAULT_WINDOW_MINIMUM_SIZE;
  if (b.width! < minimum || b.height! < minimum) return false;

  const workAreas = options.workAreas;
  if (workAreas && workAreas.length > 0) {
    const intersects = workAreas.some((area) =>
      rectanglesIntersect(b as WindowBoundsSnapshot, area),
    );
    if (!intersects) return false;
  }

  return true;
}

function rectanglesIntersect(
  a: WindowBoundsSnapshot,
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Validates a split location snapshot without consulting external state.
 * Returns the normalized snapshot when valid, otherwise null.
 */
export function normalizeSplitLocation(candidate: unknown): SplitLocationSnapshot | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const c = candidate as Partial<SplitLocationSnapshot>;

  if (c.orientation !== 'horizontal' && c.orientation !== 'vertical') return null;
  if (c.controlledPane !== 'first' && c.controlledPane !== 'second') return null;
  if (typeof c.sizePx !== 'number' || !Number.isFinite(c.sizePx) || c.sizePx <= 0) return null;

  return {
    orientation: c.orientation,
    controlledPane: c.controlledPane,
    sizePx: c.sizePx,
    ...(typeof c.updatedAt === 'string' ? { updatedAt: c.updatedAt } : {}),
  };
}

/**
 * Clamps a split size for display purposes only. The caller is responsible for
 * not writing the clamped value back to durable settings unless the user
 * actively resized the divider.
 */
export function clampSplitSizePx(sizePx: number, min: number, max: number): number {
  if (!Number.isFinite(sizePx)) return min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return sizePx;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(Math.max(sizePx, lower), upper);
}

/**
 * Merge a persisted (possibly partial or stale) layout snapshot with defaults.
 * Invalid window/split entries are dropped while valid siblings are preserved.
 */
export function mergeWindowLayoutSettings(
  saved: Partial<WindowLayoutSettingsSnapshot> | null | undefined,
): WindowLayoutSettingsSnapshot {
  const defaults = createDefaultWindowLayoutSettings();
  if (!saved) return defaults;

  const windows: WindowLayoutSettingsSnapshot['windows'] = {};
  if (saved.windows && typeof saved.windows === 'object') {
    for (const id of WINDOW_IDENTITIES) {
      const candidate = (saved.windows as Record<string, unknown>)[id];
      if (isValidWindowState(candidate)) {
        windows[id] = candidate;
      }
    }
  }

  const splits: WindowLayoutSettingsSnapshot['splits'] = {};
  if (saved.splits && typeof saved.splits === 'object') {
    for (const candidateKey of Object.keys(saved.splits)) {
      if (!isSplitId(candidateKey)) continue;
      const normalized = normalizeSplitLocation(
        (saved.splits as Record<string, unknown>)[candidateKey],
      );
      if (normalized) {
        splits[candidateKey] = normalized;
      }
    }
  }

  const workbench: WindowLayoutSettingsSnapshot['workbench'] =
    saved.workbench &&
    typeof saved.workbench === 'object' &&
    typeof (saved.workbench as Partial<WorkbenchLayoutSettings>).serializedLayout === 'string'
      ? {
          serializedLayout: (saved.workbench as WorkbenchLayoutSettings).serializedLayout,
          ...(typeof (saved.workbench as WorkbenchLayoutSettings).updatedAt === 'string'
            ? { updatedAt: (saved.workbench as WorkbenchLayoutSettings).updatedAt }
            : {}),
        }
      : undefined;

  const legacySaved = saved.legacyMigration;
  const legacyMigration: LegacyLayoutMigrationState = legacySaved
    ? {
        blueSettingsWindowBoundsMigrated: Boolean(legacySaved.blueSettingsWindowBoundsMigrated),
        workbenchLocalStorageMigrated: Boolean(legacySaved.workbenchLocalStorageMigrated),
        ...(typeof legacySaved.migratedAt === 'string'
          ? { migratedAt: legacySaved.migratedAt }
          : {}),
      }
    : defaults.legacyMigration;

  return {
    version: WINDOW_LAYOUT_SETTINGS_VERSION,
    windows,
    workbench,
    splits,
    legacyMigration,
    ...(typeof saved.lastResetAt === 'string' ? { lastResetAt: saved.lastResetAt } : {}),
  };
}

/**
 * Apply an update request to a snapshot, returning a new snapshot. Invalid
 * payloads leave the existing entry untouched.
 */
export function applyWindowLayoutUpdate(
  current: WindowLayoutSettingsSnapshot,
  request: WindowLayoutUpdateRequest,
  now: () => string = () => new Date().toISOString(),
): WindowLayoutSettingsSnapshot {
  switch (request.type) {
    case 'window-state': {
      if (!isValidWindowState(request.state)) return current;
      return {
        ...current,
        windows: {
          ...current.windows,
          [request.windowId]: { ...request.state, updatedAt: now() },
        },
      };
    }
    case 'workbench-layout': {
      if (typeof request.serializedLayout !== 'string') return current;
      return {
        ...current,
        workbench: { serializedLayout: request.serializedLayout, updatedAt: now() },
        // The first complete workbench save after Reset Windows acknowledges
        // the rebuilt baseline and allows normal layout restoration again.
        lastResetAt: undefined,
      };
    }
    case 'split-location': {
      const normalized = normalizeSplitLocation(request.location);
      if (!normalized) return current;
      return {
        ...current,
        splits: {
          ...current.splits,
          [request.splitId]: { ...normalized, updatedAt: now() },
        },
      };
    }
    case 'legacy-migration': {
      return applyLegacyLayoutMigration(current, request.legacy, now);
    }
  }
}

/**
 * Returns a fresh default snapshot annotated with `lastResetAt`. Used by Reset
 * Windows to clear all window/workbench/split state while preserving the rest
 * of the program settings document.
 */
export function resetWindowLayoutSettings(
  now: () => string = () => new Date().toISOString(),
): WindowLayoutSettingsSnapshot {
  const timestamp = now();
  return {
    ...createDefaultWindowLayoutSettings(),
    legacyMigration: {
      blueSettingsWindowBoundsMigrated: true,
      workbenchLocalStorageMigrated: true,
      migratedAt: timestamp,
    },
    lastResetAt: timestamp,
  };
}

/**
 * Apply legacy renderer-only values to a snapshot only when the matching
 * migration marker has not yet been set AND no newer app-wide value exists.
 * The marker is always advanced so subsequent launches do not re-import stale
 * localStorage values.
 */
export function applyLegacyLayoutMigration(
  current: WindowLayoutSettingsSnapshot,
  payload: LegacyLayoutMigrationPayload,
  now: () => string = () => new Date().toISOString(),
): WindowLayoutSettingsSnapshot {
  // When both markers are already set there is nothing to migrate; return the
  // snapshot unchanged so retry runs never advance migratedAt or overwrite
  // newer app-wide values.
  if (
    current.legacyMigration.blueSettingsWindowBoundsMigrated &&
    current.legacyMigration.workbenchLocalStorageMigrated
  ) {
    return current;
  }

  let next: WindowLayoutSettingsSnapshot = current;
  const timestamp = now();

  if (
    !current.legacyMigration.blueSettingsWindowBoundsMigrated &&
    payload.windowBounds &&
    !current.windows.main &&
    isValidWindowState({ normalBounds: payload.windowBounds, displayState: 'normal' })
  ) {
    next = {
      ...next,
      windows: {
        ...next.windows,
        main: {
          normalBounds: payload.windowBounds,
          displayState: 'normal',
          updatedAt: timestamp,
        },
      },
    };
  }

  if (
    !current.legacyMigration.workbenchLocalStorageMigrated &&
    typeof payload.workbenchSerializedLayout === 'string' &&
    payload.workbenchSerializedLayout.length > 0 &&
    !current.workbench
  ) {
    next = {
      ...next,
      workbench: {
        serializedLayout: payload.workbenchSerializedLayout,
        updatedAt: timestamp,
      },
    };
  }

  return {
    ...next,
    legacyMigration: {
      ...next.legacyMigration,
      // Always advance both markers. If a source was absent from the payload
      // there is nothing to migrate from it, so it is effectively done. This
      // prevents repeated IPC round-trips on every launch for users who only
      // have one of the two legacy localStorage keys.
      blueSettingsWindowBoundsMigrated: true,
      workbenchLocalStorageMigrated: true,
      migratedAt: timestamp,
    },
  };
}

function isSplitId(value: string): value is SplitId {
  return (
    value === 'orchestra.outer' ||
    value === 'score.main' ||
    value === 'udo.workspace.outer' ||
    value === 'bsb.interface.properties' ||
    value === 'piano-roll.field-editor' ||
    value === 'line-object.lines' ||
    value === 'zak-line-object.lines' ||
    value === 'pattern-object.layers' ||
    value === 'pattern-object.score' ||
    value === 'soundfont-viewer.tables'
  );
}
