import type { BrowserWindow } from 'electron';
import {
  APP_ZOOM_DEFAULT_PERCENT,
  normalizeAppZoomPercent,
  resolveAppZoomCommand,
  toAppZoomFactor,
  type AppZoomCommand,
} from '../shared/app-zoom';
import type { ProgramSettingsSnapshot, ProgramSettingsSaveResult } from '../shared/program-settings';

export interface AppZoomCommandResult {
  previousPercent: number;
  zoomPercent: number;
  changed: boolean;
  persistence: 'saved' | 'failed' | 'not-needed';
}

export interface AppZoomControllerAdapters {
  loadSnapshot: () => ProgramSettingsSnapshot;
  saveSnapshot: (snapshot: ProgramSettingsSnapshot) => ProgramSettingsSaveResult;
  getAllWindows: () => BrowserWindow[];
}

export interface AppZoomController {
  initialize(): number;
  isInitialized(): boolean;
  getCurrentPercent(): number;
  getCurrentFactor(): number;
  applyToWindow(window: BrowserWindow): boolean;
  applyToAllWindows(): void;
  execute(command: AppZoomCommand): AppZoomCommandResult;
  preserveCurrentZoom(snapshot: ProgramSettingsSnapshot): ProgramSettingsSnapshot;
}

export function createAppZoomController(adapters: AppZoomControllerAdapters): AppZoomController {
  let zoomPercent: number = APP_ZOOM_DEFAULT_PERCENT;
  let initialized = false;

  function ensureInitialized(): void {
    if (initialized) return;
    const snapshot = adapters.loadSnapshot();
    zoomPercent = normalizeAppZoomPercent(snapshot?.appSpecific?.appZoomPercent);
    initialized = true;
  }

  function getCurrentPercent(): number {
    ensureInitialized();
    return zoomPercent;
  }

  function getCurrentFactor(): number {
    ensureInitialized();
    return toAppZoomFactor(zoomPercent);
  }

  function applyToWindow(window: BrowserWindow): boolean {
    ensureInitialized();
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return false;
    }
    try {
      window.webContents.setZoomFactor(toAppZoomFactor(zoomPercent));
      return true;
    } catch {
      return false;
    }
  }

  function applyToAllWindows(): void {
    ensureInitialized();
    for (const window of adapters.getAllWindows()) {
      applyToWindow(window);
    }
  }

  function execute(command: AppZoomCommand): AppZoomCommandResult {
    ensureInitialized();
    const previousPercent = zoomPercent;
    const nextPercent = resolveAppZoomCommand(previousPercent, command);
    if (nextPercent === previousPercent) {
      return {
        previousPercent,
        zoomPercent: previousPercent,
        changed: false,
        persistence: 'not-needed',
      };
    }

    zoomPercent = nextPercent;
    applyToAllWindows();

    let persistence: AppZoomCommandResult['persistence'] = 'saved';
    try {
      const result = adapters.saveSnapshot(
        preserveCurrentZoom(adapters.loadSnapshot()),
      );
      if (!result?.ok) {
        persistence = 'failed';
      }
    } catch {
      persistence = 'failed';
    }

    return {
      previousPercent,
      zoomPercent: nextPercent,
      changed: true,
      persistence,
    };
  }

  function preserveCurrentZoom(snapshot: ProgramSettingsSnapshot): ProgramSettingsSnapshot {
    ensureInitialized();
    return {
      ...snapshot,
      appSpecific: {
        ...snapshot.appSpecific,
        appZoomPercent: zoomPercent,
      },
    };
  }

  return {
    initialize: () => {
      ensureInitialized();
      return zoomPercent;
    },
    isInitialized: () => {
      return initialized;
    },
    getCurrentPercent,
    getCurrentFactor,
    applyToWindow,
    applyToAllWindows,
    execute,
    preserveCurrentZoom,
  };
}
