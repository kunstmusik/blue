import { describe, expect, it } from 'vitest';
import {
  applyLegacyLayoutMigration,
  applyWindowLayoutUpdate,
  clampSplitSizePx,
  createDefaultLegacyLayoutMigrationState,
  createDefaultSplitLocation,
  createDefaultWindowLayoutSettings,
  DEFAULT_SPLIT_SIZE_PX,
  DEFAULT_WINDOW_MINIMUM_SIZE,
  isValidWindowState,
  mergeWindowLayoutSettings,
  normalizeSplitLocation,
  resetWindowLayoutSettings,
  WINDOW_IDENTITIES,
  WINDOW_LAYOUT_SETTINGS_VERSION,
  type LegacyLayoutMigrationPayload,
  type SplitLocationSnapshot,
  type WindowLayoutSettingsSnapshot,
  type WindowStateSnapshot,
} from './window-layout-settings';

const FIXED_NOW = '2026-07-05T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;

function validWindowState(overrides: Partial<WindowStateSnapshot> = {}): WindowStateSnapshot {
  return {
    normalBounds: { x: 100, y: 100, width: 800, height: 600 },
    displayState: 'normal',
    ...overrides,
  };
}

describe('window-layout-settings defaults', () => {
  it('creates a versioned empty snapshot with no saved windows, workbench, or splits', () => {
    const defaults = createDefaultWindowLayoutSettings();
    expect(defaults.version).toBe(WINDOW_LAYOUT_SETTINGS_VERSION);
    expect(defaults.windows).toEqual({});
    expect(defaults.splits).toEqual({});
    expect(defaults.workbench).toBeUndefined();
    expect(defaults.legacyMigration).toEqual({
      blueSettingsWindowBoundsMigrated: false,
      workbenchLocalStorageMigrated: false,
    });
    expect(defaults.lastResetAt).toBeUndefined();
  });

  it('exposes the in-scope window identities', () => {
    expect(WINDOW_IDENTITIES).toEqual([
      'main',
      'settings',
      'effect-editor',
      'effect-interface',
      'track-instrument-editor',
    ]);
  });

  it('creates a 200px first/horizontal default split location', () => {
    expect(createDefaultSplitLocation()).toEqual({
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: DEFAULT_SPLIT_SIZE_PX,
    });
    expect(DEFAULT_SPLIT_SIZE_PX).toBe(200);
  });

  it('creates a default legacy migration state with both markers cleared', () => {
    expect(createDefaultLegacyLayoutMigrationState()).toEqual({
      blueSettingsWindowBoundsMigrated: false,
      workbenchLocalStorageMigrated: false,
    });
  });
});

describe('window-layout-settings isValidWindowState', () => {
  it('rejects null, undefined, primitives, and arrays', () => {
    expect(isValidWindowState(null)).toBe(false);
    expect(isValidWindowState(undefined)).toBe(false);
    expect(isValidWindowState('normal')).toBe(false);
    expect(isValidWindowState(42)).toBe(false);
    expect(isValidWindowState([])).toBe(false);
  });

  it('rejects unknown display states', () => {
    expect(
      isValidWindowState({
        ...validWindowState(),
        displayState: 'minimized' as unknown,
      }),
    ).toBe(false);
  });

  it('rejects non-finite bounds coordinates', () => {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      const bad = validWindowState();
      (bad.normalBounds as Record<string, unknown>)[key] = NaN;
      expect(isValidWindowState(bad), key).toBe(false);
    }
  });

  it('rejects bounds below the configured minimum size', () => {
    expect(
      isValidWindowState({
        ...validWindowState(),
        normalBounds: { x: 0, y: 0, width: 50, height: 600 },
      }),
    ).toBe(false);
    expect(
      isValidWindowState(
        {
          ...validWindowState(),
          normalBounds: { x: 0, y: 0, width: 50, height: 600 },
        },
        { minimumSize: 60 },
      ),
    ).toBe(false);
    expect(
      isValidWindowState(
        {
          ...validWindowState(),
          normalBounds: { x: 0, y: 0, width: 60, height: 60 },
        },
        { minimumSize: 60 },
      ),
    ).toBe(true);
  });

  it('uses DEFAULT_WINDOW_MINIMUM_SIZE when no override is provided', () => {
    expect(DEFAULT_WINDOW_MINIMUM_SIZE).toBe(100);
    expect(
      isValidWindowState({
        ...validWindowState(),
        normalBounds: { x: 0, y: 0, width: DEFAULT_WINDOW_MINIMUM_SIZE, height: DEFAULT_WINDOW_MINIMUM_SIZE },
      }),
    ).toBe(true);
  });

  it('rejects bounds outside all provided work areas', () => {
    const workAreas = [{ x: 0, y: 0, width: 1000, height: 1000 }];
    expect(
      isValidWindowState(
        {
          ...validWindowState(),
          normalBounds: { x: 5000, y: 5000, width: 800, height: 600 },
        },
        { workAreas },
      ),
    ).toBe(false);
  });

  it('accepts bounds intersecting any provided work area', () => {
    const workAreas = [
      { x: 0, y: 0, width: 1000, height: 1000 },
      { x: 2000, y: 0, width: 1000, height: 1000 },
    ];
    expect(
      isValidWindowState(
        {
          ...validWindowState(),
          normalBounds: { x: 1900, y: 100, width: 800, height: 600 },
        },
        { workAreas },
      ),
    ).toBe(true);
  });
});

describe('window-layout-settings normalizeSplitLocation', () => {
  it('rejects malformed candidates', () => {
    expect(normalizeSplitLocation(null)).toBeNull();
    expect(normalizeSplitLocation({})).toBeNull();
    expect(
      normalizeSplitLocation({
        orientation: 'sideways',
        controlledPane: 'first',
        sizePx: 200,
      }),
    ).toBeNull();
    expect(
      normalizeSplitLocation({
        orientation: 'horizontal',
        controlledPane: 'middle',
        sizePx: 200,
      }),
    ).toBeNull();
    expect(
      normalizeSplitLocation({
        orientation: 'horizontal',
        controlledPane: 'first',
        sizePx: 0,
      }),
    ).toBeNull();
    expect(
      normalizeSplitLocation({
        orientation: 'horizontal',
        controlledPane: 'first',
        sizePx: NaN,
      }),
    ).toBeNull();
  });

  it('normalizes valid candidates and preserves updatedAt when present', () => {
    const normalized = normalizeSplitLocation({
      orientation: 'vertical',
      controlledPane: 'second',
      sizePx: 240,
      updatedAt: FIXED_NOW,
    }) as SplitLocationSnapshot;
    expect(normalized).toEqual({
      orientation: 'vertical',
      controlledPane: 'second',
      sizePx: 240,
      updatedAt: FIXED_NOW,
    });
  });

  it('drops unknown fields', () => {
    const normalized = normalizeSplitLocation({
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: 200,
      bogus: true,
    });
    expect(normalized).toEqual({
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: 200,
    });
  });
});

describe('window-layout-settings clampSplitSizePx', () => {
  it('clamps within [min, max]', () => {
    expect(clampSplitSizePx(150, 200, 400)).toBe(200);
    expect(clampSplitSizePx(500, 200, 400)).toBe(400);
    expect(clampSplitSizePx(300, 200, 400)).toBe(300);
  });

  it('returns min when input is non-finite', () => {
    expect(clampSplitSizePx(NaN, 200, 400)).toBe(200);
    expect(clampSplitSizePx(Infinity, 200, 400)).toBe(200);
  });

  it('tolerates reversed min/max bounds', () => {
    expect(clampSplitSizePx(300, 400, 200)).toBe(300);
    expect(clampSplitSizePx(50, 400, 200)).toBe(200);
  });
});

describe('window-layout-settings mergeWindowLayoutSettings', () => {
  it('returns defaults for null/undefined/empty input', () => {
    const expected = createDefaultWindowLayoutSettings();
    expect(mergeWindowLayoutSettings(null)).toEqual(expected);
    expect(mergeWindowLayoutSettings(undefined)).toEqual(expected);
    expect(mergeWindowLayoutSettings({})).toEqual(expected);
  });

  it('preserves valid windows and drops invalid siblings', () => {
    const merged = mergeWindowLayoutSettings({
      windows: {
        main: validWindowState(),
        settings: {
          normalBounds: { x: 0, y: 0, width: 10, height: 10 },
          displayState: 'normal',
        },
      },
    });
    expect(merged.windows.main).toBeDefined();
    expect(merged.windows.main!.normalBounds.width).toBe(800);
    expect(merged.windows.settings).toBeUndefined();
  });

  it('preserves valid splits and drops invalid siblings', () => {
    const merged = mergeWindowLayoutSettings({
      splits: {
        'orchestra.outer': {
          orientation: 'horizontal',
          controlledPane: 'first',
          sizePx: 240,
        },
        'score.main': {
          orientation: 'horizontal',
          controlledPane: 'first',
          sizePx: -10,
        },
      },
    });
    expect(merged.splits['orchestra.outer']).toBeDefined();
    expect(merged.splits['score.main']).toBeUndefined();
  });

  it('ignores unknown split identity keys', () => {
    const merged = mergeWindowLayoutSettings({
      splits: {
        'unknown.split': {
          orientation: 'horizontal',
          controlledPane: 'first',
          sizePx: 240,
        } as SplitLocationSnapshot,
      },
    });
    expect(merged.splits).toEqual({});
  });

  it('normalizes the workbench envelope and drops malformed values', () => {
    const merged = mergeWindowLayoutSettings({
      workbench: { serializedLayout: '{"dockview":{}}', updatedAt: FIXED_NOW },
    });
    expect(merged.workbench).toEqual({
      serializedLayout: '{"dockview":{}}',
      updatedAt: FIXED_NOW,
    });

    const malformed = mergeWindowLayoutSettings({
      workbench: { serializedLayout: 123 as unknown as string },
    });
    expect(malformed.workbench).toBeUndefined();
  });

  it('preserves migration markers and lastResetAt', () => {
    const merged = mergeWindowLayoutSettings({
      legacyMigration: {
        blueSettingsWindowBoundsMigrated: true,
        workbenchLocalStorageMigrated: false,
        migratedAt: FIXED_NOW,
      },
      lastResetAt: FIXED_NOW,
    });
    expect(merged.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(merged.legacyMigration.workbenchLocalStorageMigrated).toBe(false);
    expect(merged.legacyMigration.migratedAt).toBe(FIXED_NOW);
    expect(merged.lastResetAt).toBe(FIXED_NOW);
  });
});

describe('window-layout-settings applyWindowLayoutUpdate', () => {
  it('applies a valid window-state update with an updatedAt stamp', () => {
    const base = createDefaultWindowLayoutSettings();
    const next = applyWindowLayoutUpdate(base, {
      type: 'window-state',
      windowId: 'main',
      state: validWindowState(),
    }, fixedNow);
    expect(next.windows.main).toEqual({
      ...validWindowState(),
      updatedAt: FIXED_NOW,
    });
  });

  it('ignores invalid window-state payloads but keeps prior entries', () => {
    const base = applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), {
      type: 'window-state',
      windowId: 'main',
      state: validWindowState(),
    }, fixedNow);
    const next = applyWindowLayoutUpdate(base, {
      type: 'window-state',
      windowId: 'settings',
      state: {
        normalBounds: { x: 0, y: 0, width: 0, height: 0 },
        displayState: 'normal',
      },
    }, fixedNow);
    expect(next.windows.main).toBeDefined();
    expect(next.windows.settings).toBeUndefined();
  });

  it('applies a workbench-layout update', () => {
    const next = applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), {
      type: 'workbench-layout',
      serializedLayout: '{"version":5}',
    }, fixedNow);
    expect(next.workbench).toEqual({ serializedLayout: '{"version":5}', updatedAt: FIXED_NOW });
  });

  it('clears the reset marker after the rebuilt workbench is saved', () => {
    const reset = resetWindowLayoutSettings(fixedNow);
    const next = applyWindowLayoutUpdate(reset, {
      type: 'workbench-layout',
      serializedLayout: '{"version":6}',
    }, fixedNow);

    expect(next.lastResetAt).toBeUndefined();
    expect(next.workbench?.serializedLayout).toBe('{"version":6}');
  });

  it('applies a split-location update', () => {
    const next = applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), {
      type: 'split-location',
      splitId: 'orchestra.outer',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 240 },
    }, fixedNow);
    expect(next.splits['orchestra.outer']).toEqual({
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: 240,
      updatedAt: FIXED_NOW,
    });
  });

  it('applies a legacy-migration marker update', () => {
    const next = applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), {
      type: 'legacy-migration',
      legacy: { blueSettingsWindowBoundsMigrated: true },
    }, fixedNow);
    expect(next.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(next.legacyMigration.workbenchLocalStorageMigrated).toBe(true);
    expect(next.legacyMigration.migratedAt).toBe(FIXED_NOW);
  });

  it('applies legacy-migration payload values through the update API', () => {
    const next = applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), {
      type: 'legacy-migration',
      legacy: {
        windowBounds: { x: 20, y: 30, width: 900, height: 700 },
        workbenchSerializedLayout: '{"version":5}',
      },
    }, fixedNow);

    expect(next.windows.main?.normalBounds).toEqual({ x: 20, y: 30, width: 900, height: 700 });
    expect(next.workbench?.serializedLayout).toBe('{"version":5}');
    expect(next.legacyMigration).toEqual({
      blueSettingsWindowBoundsMigrated: true,
      workbenchLocalStorageMigrated: true,
      migratedAt: FIXED_NOW,
    });
  });
});

describe('window-layout-settings resetWindowLayoutSettings', () => {
  it('returns defaults with a lastResetAt stamp and cleared entries', () => {
    const reset = resetWindowLayoutSettings(fixedNow);
    expect(reset.version).toBe(WINDOW_LAYOUT_SETTINGS_VERSION);
    expect(reset.windows).toEqual({});
    expect(reset.splits).toEqual({});
    expect(reset.workbench).toBeUndefined();
    expect(reset.legacyMigration).toEqual({
      blueSettingsWindowBoundsMigrated: true,
      workbenchLocalStorageMigrated: true,
      migratedAt: FIXED_NOW,
    });
    expect(reset.lastResetAt).toBe(FIXED_NOW);
  });
});

describe('window-layout-settings applyLegacyLayoutMigration', () => {
  it('copies legacy main window bounds when not yet migrated', () => {
    const payload: LegacyLayoutMigrationPayload = {
      windowBounds: { x: 120, y: 80, width: 1024, height: 768 },
    };
    const next = applyLegacyLayoutMigration(createDefaultWindowLayoutSettings(), payload, fixedNow);
    expect(next.windows.main?.normalBounds).toEqual({ x: 120, y: 80, width: 1024, height: 768 });
    expect(next.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(next.legacyMigration.migratedAt).toBe(FIXED_NOW);
  });

  it('copies legacy workbench layout only when no app-wide layout exists', () => {
    const payload: LegacyLayoutMigrationPayload = {
      workbenchSerializedLayout: '{"version":5}',
    };
    const next = applyLegacyLayoutMigration(createDefaultWindowLayoutSettings(), payload, fixedNow);
    expect(next.workbench?.serializedLayout).toBe('{"version":5}');
    expect(next.legacyMigration.workbenchLocalStorageMigrated).toBe(true);
  });

  it('does not overwrite newer app-wide layout values on retry', () => {
    const seeded: WindowLayoutSettingsSnapshot = {
      ...createDefaultWindowLayoutSettings(),
      windows: {
        main: {
          normalBounds: { x: 10, y: 10, width: 800, height: 600 },
          displayState: 'normal',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      },
      workbench: { serializedLayout: '{"version":5,"newer":true}' },
      legacyMigration: {
        blueSettingsWindowBoundsMigrated: true,
        workbenchLocalStorageMigrated: true,
        migratedAt: '2020-01-01T00:00:00.000Z',
      },
    };

    const next = applyLegacyLayoutMigration(
      seeded,
      {
        windowBounds: { x: 999, y: 999, width: 800, height: 600 },
        workbenchSerializedLayout: '{"version":5,"stale":true}',
      },
      fixedNow,
    );

    expect(next.windows.main?.normalBounds.x).toBe(10);
    expect(next.workbench?.serializedLayout).toBe('{"version":5,"newer":true}');
    expect(next.legacyMigration.migratedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('marks both markers complete even when only one legacy source is present', () => {
    const next = applyLegacyLayoutMigration(
      createDefaultWindowLayoutSettings(),
      { workbenchSerializedLayout: '{"version":5}' },
      fixedNow,
    );

    expect(next.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(next.legacyMigration.workbenchLocalStorageMigrated).toBe(true);
    expect(next.workbench?.serializedLayout).toBe('{"version":5}');

    const retried = applyLegacyLayoutMigration(next, {
      workbenchSerializedLayout: '{"version":5,"stale":true}',
    });
    expect(retried).toEqual(next);
  });

  it('marks both markers complete even when neither legacy source is present', () => {
    const next = applyLegacyLayoutMigration(
      createDefaultWindowLayoutSettings(),
      {},
      fixedNow,
    );

    expect(next.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(next.legacyMigration.workbenchLocalStorageMigrated).toBe(true);
  });
});

describe('window-layout-settings invalid value preservation (T056)', () => {
  it('drops a corrupt window-state entry while preserving all other valid windows', () => {
    const base = createDefaultWindowLayoutSettings();
    const withValid = applyWindowLayoutUpdate(base, {
      type: 'window-state',
      windowId: 'main',
      state: validWindowState(),
    }, fixedNow);

    const withBad = applyWindowLayoutUpdate(withValid, {
      type: 'window-state',
      windowId: 'settings',
      state: {
        normalBounds: { x: 0, y: 0, width: 10, height: 10 },
        displayState: 'normal',
      },
    }, fixedNow);

    expect(withBad.windows.main).toBeDefined();
    expect(withBad.windows.main!.normalBounds.width).toBe(800);
    expect(withBad.windows.settings).toBeUndefined();
  });

  it('drops a corrupt split entry while preserving all other valid splits', () => {
    const base = createDefaultWindowLayoutSettings();
    const withGood = applyWindowLayoutUpdate(base, {
      type: 'split-location',
      splitId: 'orchestra.outer',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 250 },
    }, fixedNow);

    const withBad = applyWindowLayoutUpdate(withGood, {
      type: 'split-location',
      splitId: 'score.main',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: -50 },
    }, fixedNow);

    expect(withBad.splits['orchestra.outer']).toBeDefined();
    expect(withBad.splits['score.main']).toBeUndefined();
  });

  it('drops an unknown split identity key during merge', () => {
    const merged = mergeWindowLayoutSettings({
      splits: {
        'completely.unknown.split': {
          orientation: 'horizontal',
          controlledPane: 'first',
          sizePx: 200,
        } as SplitLocationSnapshot,
      },
    });
    expect(merged.splits).toEqual({});
  });

  it('drops an unknown window identity key during merge', () => {
    const merged = mergeWindowLayoutSettings({
      windows: {
        'unknown-window': {
          normalBounds: { x: 0, y: 0, width: 800, height: 600 },
          displayState: 'normal',
        },
      } as Record<string, WindowStateSnapshot>,
    });
    expect(merged.windows).toEqual({});
  });
});
