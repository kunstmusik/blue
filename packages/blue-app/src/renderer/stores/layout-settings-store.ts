/**
 * Renderer layout settings store.
 *
 * Bridges the canonical app-wide layout snapshot in the main process with
 * renderer consumers (workbench, SplitPane, score-object editors). The store
 * always mirrors the latest main-process state so multiple components can read
 * the same split/window/workbench values without each opening their own IPC
 * channel.
 */

import { create } from 'zustand';
import type {
  SplitId,
  SplitLocationSnapshot,
  WindowId,
  WindowLayoutSettingsSnapshot,
  WindowLayoutUpdateRequest,
  WindowStateSnapshot,
} from '../../shared/window-layout-settings';
import {
  createDefaultWindowLayoutSettings,
  resetWindowLayoutSettings,
} from '../../shared/window-layout-settings';

interface LayoutSettingsState {
  layout: WindowLayoutSettingsSnapshot | null;
}

interface LayoutSettingsActions {
  setLayout: (layout: WindowLayoutSettingsSnapshot | null) => void;
  load: () => Promise<void>;
  updateWindowState: (windowId: WindowId, state: WindowStateSnapshot) => Promise<void>;
  updateWorkbenchLayout: (serializedLayout: string) => Promise<void>;
  updateSplitLocation: (splitId: SplitId, location: SplitLocationSnapshot) => Promise<void>;
  reset: () => Promise<void>;
  applyReset: () => void;
}

function readBlueAPI(): Window['blueAPI'] | null {
  return typeof window !== 'undefined' && window.blueAPI ? window.blueAPI : null;
}

export const useLayoutSettingsStore = create<LayoutSettingsState & LayoutSettingsActions>()(
  (set) => ({
    layout: null,

    setLayout: (layout) => set({ layout }),

    load: async () => {
      const api = readBlueAPI();
      if (!api?.getProgramSettings) return;
      try {
        const settings = await api.getProgramSettings();
        set({ layout: settings.appSpecific.windowLayout ?? createDefaultWindowLayoutSettings() });
      } catch {
        // Leave existing snapshot intact; main process logs the error.
      }
    },

    updateWindowState: async (windowId, state) => {
      const api = readBlueAPI();
      if (!api?.updateWindowLayout) return;
      const request: WindowLayoutUpdateRequest = {
        type: 'window-state',
        windowId,
        state,
      };
      const next = await api.updateWindowLayout(request);
      set({ layout: next });
    },

    updateWorkbenchLayout: async (serializedLayout) => {
      const api = readBlueAPI();
      if (!api?.updateWindowLayout) return;
      const request: WindowLayoutUpdateRequest = {
        type: 'workbench-layout',
        serializedLayout,
      };
      const next = await api.updateWindowLayout(request);
      set({ layout: next });
    },

    updateSplitLocation: async (splitId, location) => {
      const api = readBlueAPI();
      if (!api?.updateWindowLayout) return;
      const request: WindowLayoutUpdateRequest = {
        type: 'split-location',
        splitId,
        location,
      };
      const next = await api.updateWindowLayout(request);
      set({ layout: next });
    },

    reset: async () => {
      const api = readBlueAPI();
      if (!api?.resetWindows) return;
      const next = await api.resetWindows();
      set({ layout: next });
    },

    applyReset: () => {
      // Optimistic local reset for `window-layout:reset` broadcasts. The
      // main-process reset call resolves separately and replaces this value.
      set({ layout: resetWindowLayoutSettings() });
    },
  }),
);
