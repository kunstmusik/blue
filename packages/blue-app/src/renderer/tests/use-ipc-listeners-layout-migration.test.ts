// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLegacyLayoutMigration,
  createDefaultWindowLayoutSettings,
} from '../../shared/window-layout-settings';

const FIXED_NOW = '2026-07-05T12:00:00.000Z';
const fixedNow = () => FIXED_NOW;

describe('use-ipc-listeners legacy migration contract', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
    vi.clearAllMocks();
  });

  it('uses the shared helper to migrate legacy windowBounds into the canonical layout', () => {
    const next = applyLegacyLayoutMigration(
      createDefaultWindowLayoutSettings(),
      { windowBounds: { x: 50, y: 60, width: 1280, height: 800 } },
      fixedNow,
    );
    expect(next.windows.main?.normalBounds).toEqual({ x: 50, y: 60, width: 1280, height: 800 });
    expect(next.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
  });

  it('does not advance migratedAt when both markers are already set', () => {
    const seeded = applyLegacyLayoutMigration(
      createDefaultWindowLayoutSettings(),
      {
        windowBounds: { x: 50, y: 60, width: 1280, height: 800 },
        workbenchSerializedLayout: '{"version":5}',
      },
      fixedNow,
    );

    const retried = applyLegacyLayoutMigration(seeded, {
      windowBounds: { x: 999, y: 999, width: 800, height: 600 },
      workbenchSerializedLayout: '{"version":5,"stale":true}',
    });

    expect(retried).toEqual(seeded);
  });
});
