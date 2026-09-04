import type { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import {
  APP_ZOOM_DEFAULT_PERCENT,
  APP_ZOOM_MAX_PERCENT,
  APP_ZOOM_MIN_PERCENT,
} from '../shared/app-zoom';
import { createAppZoomController, type AppZoomControllerAdapters } from './app-zoom-controller';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import { createDefaultProgramSettings } from '../shared/program-settings';

interface MockWindow {
  isDestroyed: () => boolean;
  webContents: {
    isDestroyed: () => boolean;
    setZoomFactor: ReturnType<typeof vi.fn>;
    getZoomFactor: () => number;
  };
}

function createMockWindow(
  options: Partial<{
    destroyed: boolean;
    webContentsDestroyed: boolean;
    currentFactor: number;
    setZoomFactorThrows: boolean;
  }> = {},
): MockWindow {
  const destroyed = options.destroyed ?? false;
  const webContentsDestroyed = options.webContentsDestroyed ?? false;
  const currentFactor = options.currentFactor ?? 1;
  const setZoomFactor = vi.fn((factor: number) => {
    if (options.setZoomFactorThrows) {
      throw new Error('mock window failure');
    }
    mockCurrentFactor = factor;
  });
  let mockCurrentFactor = currentFactor;
  return {
    isDestroyed: () => destroyed,
    webContents: {
      isDestroyed: () => webContentsDestroyed,
      setZoomFactor,
      getZoomFactor: () => mockCurrentFactor,
    },
  };
}

function createDefaultSnapshot(
  appZoomPercent: number = APP_ZOOM_DEFAULT_PERCENT,
): ProgramSettingsSnapshot {
  const snapshot = createDefaultProgramSettings('darwin');
  snapshot.appSpecific.appZoomPercent = appZoomPercent;
  return snapshot;
}

function createAdapters(
  options: {
    initialSnapshot?: ProgramSettingsSnapshot;
    windows?: MockWindow[];
    saveResult?: { ok: boolean } | Error;
  } = {},
): AppZoomControllerAdapters & {
  windows: MockWindow[];
  loadSnapshot: ReturnType<typeof vi.fn>;
  saveSnapshot: ReturnType<typeof vi.fn>;
} {
  const initialSnapshot = options.initialSnapshot ?? createDefaultSnapshot();
  const windows: MockWindow[] = options.windows ? [...options.windows] : [];
  const saveSnapshot = vi.fn((snapshot: ProgramSettingsSnapshot) => {
    if (options.saveResult instanceof Error) {
      throw options.saveResult;
    }
    return options.saveResult ?? { ok: true, snapshot };
  });
  const loadSnapshot = vi.fn(() => initialSnapshot);
  return {
    loadSnapshot,
    saveSnapshot,
    getAllWindows: () => windows as unknown as BrowserWindow[],
    windows,
  };
}

describe('app-zoom-controller initialization', () => {
  it('initializes from a normalized settings snapshot and reports the loaded percent/factor', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(170),
    });
    const controller = createAppZoomController(adapters);

    expect(controller.initialize()).toBe(170);
    expect(controller.getCurrentPercent()).toBe(170);
    expect(controller.getCurrentFactor()).toBeCloseTo(1.7, 10);
    expect(controller.isInitialized()).toBe(true);
  });

  it('normalizes a malformed saved value to 100 during initialization', () => {
    const malformed = createDefaultSnapshot();
    malformed.appSpecific.appZoomPercent = 105;
    const adapters = createAdapters({ initialSnapshot: malformed });
    const controller = createAppZoomController(adapters);

    expect(controller.initialize()).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(controller.getCurrentPercent()).toBe(APP_ZOOM_DEFAULT_PERCENT);
  });

  it('is idempotent and only loads settings once', () => {
    const adapters = createAdapters({ initialSnapshot: createDefaultSnapshot(130) });
    const controller = createAppZoomController(adapters);

    controller.initialize();
    controller.initialize();

    expect(adapters.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(controller.getCurrentPercent()).toBe(130);
  });
});

describe('app-zoom-controller command resolution', () => {
  it('adds exactly 10 percentage points on zoom-in and applies the new factor to windows', () => {
    const window = createMockWindow({ currentFactor: 1 });
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [window],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-in');

    expect(result.previousPercent).toBe(100);
    expect(result.zoomPercent).toBe(110);
    expect(result.changed).toBe(true);
    expect(result.persistence).toBe('saved');
    expect(controller.getCurrentPercent()).toBe(110);
    expect(controller.getCurrentFactor()).toBeCloseTo(1.1, 10);
    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
  });

  it('subtracts exactly 10 percentage points on zoom-out', () => {
    const window = createMockWindow();
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(120),
      windows: [window],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-out');

    expect(result.zoomPercent).toBe(110);
    expect(result.changed).toBe(true);
    expect(controller.getCurrentPercent()).toBe(110);
    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
  });

  it('sets the absolute default percent on actual-size regardless of current value', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(250),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('actual-size');

    expect(result.zoomPercent).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(result.changed).toBe(true);
    expect(controller.getCurrentPercent()).toBe(APP_ZOOM_DEFAULT_PERCENT);
  });

  it('clamps zoom-in at the upper bound without erroring', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(APP_ZOOM_MAX_PERCENT),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-in');

    expect(result.zoomPercent).toBe(APP_ZOOM_MAX_PERCENT);
    expect(result.changed).toBe(false);
    expect(result.persistence).toBe('not-needed');
  });

  it('clamps zoom-out at the lower bound without erroring', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(APP_ZOOM_MIN_PERCENT),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-out');

    expect(result.zoomPercent).toBe(APP_ZOOM_MIN_PERCENT);
    expect(result.changed).toBe(false);
    expect(result.persistence).toBe('not-needed');
  });

  it('returns not-needed persistence for an actual-size command already at 100', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(APP_ZOOM_DEFAULT_PERCENT),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('actual-size');

    expect(result.zoomPercent).toBe(APP_ZOOM_DEFAULT_PERCENT);
    expect(result.changed).toBe(false);
    expect(result.persistence).toBe('not-needed');
  });

  it('reports the resolved percent in absolute terms across all 26 values', () => {
    for (let v = APP_ZOOM_MIN_PERCENT; v <= APP_ZOOM_MAX_PERCENT; v += 10) {
      const adapters = createAdapters({
        initialSnapshot: createDefaultSnapshot(v),
      });
      const controller = createAppZoomController(adapters);
      controller.initialize();

      const expected = v + 10 > APP_ZOOM_MAX_PERCENT ? APP_ZOOM_MAX_PERCENT : v + 10;
      const result = controller.execute('zoom-in');
      expect(result.zoomPercent, `from=${v}`).toBe(expected);
    }
  });
});

describe('app-zoom-controller persistence and stale-draft protection', () => {
  it('writes a cloned snapshot with the new appZoomPercent on a changed command', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    controller.execute('zoom-in');

    expect(adapters.saveSnapshot).toHaveBeenCalledTimes(1);
    const saved = adapters.saveSnapshot.mock.calls[0][0] as ProgramSettingsSnapshot;
    expect(saved.appSpecific.appZoomPercent).toBe(110);
  });

  it('does not write on a boundary no-op', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(APP_ZOOM_MAX_PERCENT),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    controller.execute('zoom-in');

    expect(adapters.saveSnapshot).not.toHaveBeenCalled();
  });

  it('clones the snapshot before persisting so the cached settings object is untouched', () => {
    const initial = createDefaultSnapshot(100);
    const adapters = createAdapters({ initialSnapshot: initial });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    controller.execute('zoom-in');

    expect(initial.appSpecific.appZoomPercent).toBe(100);
  });

  it('keeps the runtime zoom and reports failed persistence when the save throws', () => {
    const window = createMockWindow();
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [window],
      saveResult: new Error('disk failure'),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-in');

    expect(result.zoomPercent).toBe(110);
    expect(result.changed).toBe(true);
    expect(result.persistence).toBe('failed');
    expect(controller.getCurrentPercent()).toBe(110);
    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
  });

  it('keeps the runtime zoom and reports failed persistence when validation rejects the save', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      saveResult: { ok: false },
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-in');

    expect(result.persistence).toBe('failed');
    expect(controller.getCurrentPercent()).toBe(110);
  });

  it('recovers persistence on a later command after a failed write', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      saveResult: new Error('disk failure'),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const failed = controller.execute('zoom-in');
    expect(failed.persistence).toBe('failed');

    adapters.saveSnapshot.mockImplementationOnce(() => ({
      ok: true,
      snapshot: createDefaultSnapshot(120),
    }));
    const recovered = controller.execute('zoom-in');
    expect(recovered.persistence).toBe('saved');
    expect(recovered.zoomPercent).toBe(120);
  });

  it('preserveCurrentZoom replaces appSpecific.appZoomPercent with the runtime value and keeps other panels', () => {
    const initial = createDefaultSnapshot(100);
    const adapters = createAdapters({ initialSnapshot: initial });
    const controller = createAppZoomController(adapters);
    controller.initialize();
    controller.execute('zoom-in');

    const draft = createDefaultSnapshot(100);
    draft.general.workDirectory = '/stale-edit';
    draft.appSpecific.enginePath = '/stale-engine';
    draft.appSpecific.appZoomPercent = 100;

    const preserved = controller.preserveCurrentZoom(draft);

    expect(preserved.appSpecific.appZoomPercent).toBe(110);
    expect(preserved.general.workDirectory).toBe('/stale-edit');
    expect(preserved.appSpecific.enginePath).toBe('/stale-engine');
    // Original draft must not be mutated.
    expect(draft.appSpecific.appZoomPercent).toBe(100);
  });

  it('preserveCurrentZoom returns a cloned snapshot and never writes', () => {
    const adapters = createAdapters({ initialSnapshot: createDefaultSnapshot(150) });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const draft = createDefaultSnapshot(100);
    const preserved = controller.preserveCurrentZoom(draft);

    expect(preserved).not.toBe(draft);
    expect(preserved.appSpecific).not.toBe(draft.appSpecific);
    expect(preserved.appSpecific.appZoomPercent).toBe(150);
    expect(adapters.saveSnapshot).not.toHaveBeenCalled();
  });
});

describe('app-zoom-controller multi-window broadcast', () => {
  it('applies the new factor to every live application window on a changed command', () => {
    const w1 = createMockWindow({ currentFactor: 1 });
    const w2 = createMockWindow({ currentFactor: 1 });
    const w3 = createMockWindow({ currentFactor: 1 });
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [w1, w2, w3],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    controller.execute('zoom-in');

    for (const w of [w1, w2, w3]) {
      expect(w.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
    }
  });

  it('skips destroyed windows or destroyed web contents without failing the broadcast', () => {
    const okWindow = createMockWindow();
    const destroyedWindow = createMockWindow({ destroyed: true });
    const destroyedContents = createMockWindow({ webContentsDestroyed: true });
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [okWindow, destroyedWindow, destroyedContents],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    expect(() => controller.execute('zoom-in')).not.toThrow();

    expect(okWindow.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
    expect(destroyedWindow.webContents.setZoomFactor).not.toHaveBeenCalled();
    expect(destroyedContents.webContents.setZoomFactor).not.toHaveBeenCalled();
  });

  it('isolates a single failing window so other windows still update', () => {
    const failing = createMockWindow({ setZoomFactorThrows: true });
    const okWindow = createMockWindow();
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [failing, okWindow],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    expect(() => controller.execute('zoom-in')).not.toThrow();
    expect(okWindow.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
  });

  it('still persists the new value even when one window fails', () => {
    const failing = createMockWindow({ setZoomFactorThrows: true });
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      windows: [failing],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const result = controller.execute('zoom-in');
    expect(result.persistence).toBe('saved');
    expect(result.zoomPercent).toBe(110);
  });

  it('applyToWindow applies the current factor to one window and returns success', () => {
    const window = createMockWindow();
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(170),
      windows: [window],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    expect(controller.applyToWindow(window as unknown as BrowserWindow)).toBe(true);
    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.7, 6));
  });

  it('applyToWindow skips a destroyed window and returns false', () => {
    const destroyed = createMockWindow({ destroyed: true });
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(170),
      windows: [destroyed],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    expect(controller.applyToWindow(destroyed as unknown as BrowserWindow)).toBe(false);
    expect(destroyed.webContents.setZoomFactor).not.toHaveBeenCalled();
  });

  it('applyToAllWindows walks the live window inventory without throwing', () => {
    const w1 = createMockWindow();
    const w2 = createMockWindow();
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(120),
      windows: [w1, w2],
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    expect(() => controller.applyToAllWindows()).not.toThrow();
    expect(w1.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.2, 6));
    expect(w2.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.2, 6));
  });

  it('applies the current factor to a newly created window even after a prior failed write', () => {
    const adapters = createAdapters({
      initialSnapshot: createDefaultSnapshot(100),
      saveResult: new Error('disk failure'),
    });
    const controller = createAppZoomController(adapters);
    controller.initialize();

    const failed = controller.execute('zoom-in');
    expect(failed.persistence).toBe('failed');

    const newWindow = createMockWindow();
    adapters.windows.push(newWindow);

    expect(controller.applyToWindow(newWindow as unknown as BrowserWindow)).toBe(true);
    expect(newWindow.webContents.setZoomFactor).toHaveBeenCalledWith(expect.closeTo(1.1, 6));
  });
});
