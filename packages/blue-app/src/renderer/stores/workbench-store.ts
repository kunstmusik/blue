import { create } from 'zustand';
import type { DockviewApi } from 'dockview';
import {
  applyAuxiliaryLayout,
  type AuxiliaryDockedSizeSnapshot,
  buildDefaultWorkbenchLayout,
  createDefaultAuxiliaryLayoutState,
  createStoredWorkbenchLayout,
  captureAuxiliaryDockedSizesFromApi,
  dockAuxiliaryPanel as dockAuxiliaryPanelLayout,
  getAuxiliarySeedGroupIdForPanel,
  hideAllAuxiliarySlideouts as hideAllAuxiliarySlideoutsLayout,
  hideAuxiliarySlideout as hideAuxiliarySlideoutLayout,
  isAuxiliaryPanelId,
  maximizeAuxiliaryGroupLayout,
  mergeBackToSeededGroup as mergeBackToSeededGroupLayout,
  minimizeAuxiliaryPanelLayout,
  closeAuxiliaryPanelLayout,
  minimizeAuxiliaryGroupLayout,
  moveAuxiliaryEdge as moveAuxiliaryEdgeLayout,
  moveGroupToEdge as moveGroupToEdgeLayout,
  movePanelToEdge as movePanelToEdgeLayout,
  parseStoredWorkbenchLayout,
  resizeAuxiliarySlideout as resizeAuxiliarySlideoutLayout,
  restoreAuxiliaryGroupLayout,
  revealAuxiliaryPanel,
  syncAuxiliaryLayoutFromApi,
  toggleMinimizedAuxiliaryPanel,
  type AuxiliaryEdge,
  type AuxiliaryLayoutState,
} from '../components/workbench/auxiliary-layout';
import { getPanel } from '../components/workbench/panel-registry';
import { buildPlayheadDisplayState } from '../components/menu-bar/toolbar-formatters';
import type { NativeMenuCommand } from '../../shared/workbench-menu';
import { useUIStore } from './ui-store';
import { usePlaybackStore } from './playback-store';
import { useProjectStore } from './project-store';

interface WorkbenchState {
  api: DockviewApi | null;
  auxiliary: AuxiliaryLayoutState;
}

interface WorkbenchActions {
  setApi: (api: DockviewApi | null) => void;
  openPanel: (panelId: string) => void;
  focusPanel: (panelId: string) => void;
  toggleAuxiliaryPanel: (panelId: string) => void;
  minimizeAuxiliaryPanel: (panelId: string) => void;
  closeAuxiliaryPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  isPanelOpen: (panelId: string) => boolean;
  saveLayout: () => string | null;
  loadLayout: (json: string | null) => void;
  syncAuxiliaryLayout: () => void;
  minimizeAuxiliaryGroup: (groupInstanceId: string) => void;
  maximizeAuxiliaryGroup: (groupInstanceId: string) => void;
  restoreAuxiliaryGroup: (groupInstanceId: string) => void;
  dockAuxiliaryPanel: (panelId: string) => void;
  hideAuxiliarySlideout: (edge: AuxiliaryEdge) => void;
  hideAllAuxiliarySlideouts: () => void;
  resizeAuxiliarySlideout: (panelId: string, size: number) => void;
  getAuxiliaryGroupForPanel: (panelId: string) => string | undefined;
  moveAuxiliaryEdge: (
    sourceEdge: AuxiliaryEdge,
    targetEdge: AuxiliaryEdge,
    preservedDockedSizes?: AuxiliaryDockedSizeSnapshot,
  ) => void;
  moveGroupToEdge: (groupInstanceId: string, targetEdge: AuxiliaryEdge) => void;
  movePanelToEdge: (
    panelId: string,
    targetEdge: AuxiliaryEdge,
    preservedDockedSizes?: AuxiliaryDockedSizeSnapshot,
  ) => void;
  mergeBackToSeededGroup: (groupInstanceId: string) => void;
  resetLayout: () => void;
  handleNativeMenuCommand: (command: NativeMenuCommand) => void;
}

function getAddMarkerTargetBeat(): number {
  const project = useProjectStore.getState();
  const playback = usePlaybackStore.getState();
  if (
    (playback.status === 'playing' || playback.status === 'stopping') &&
    playback.clock !== null
  ) {
    const transport = playback.transportAnchor ?? project.transport;
    return buildPlayheadDisplayState(
      transport,
      {
        status: playback.status,
        hasClock: true,
        elapsedSeconds: playback.display.elapsedSeconds,
        source: playback.display.source,
      },
    ).displayBeat;
  }
  return project.transport.renderStartTime;
}

export const useWorkbenchStore = create<WorkbenchState & WorkbenchActions>()(
  (set, get) => ({
    api: null,
    auxiliary: createDefaultAuxiliaryLayoutState(),

    setApi: (api) => set({ api }),

    openPanel: (panelId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const descriptor = getPanel(panelId);
      if (!descriptor) return;

      if (isAuxiliaryPanelId(panelId)) {
        set({
          auxiliary: revealAuxiliaryPanel(api, auxiliary, panelId),
        });
        return;
      }

      const existing = api.getPanel(panelId);
      if (existing) {
        existing.api.setActive();
        existing.group.focus();
        return;
      }

      api.addPanel({
        id: panelId,
        component: 'default',
        title: descriptor.title,
      });
    },

    focusPanel: (panelId) => {
      const { api } = get();
      if (!api) return;

      if (isAuxiliaryPanelId(panelId)) {
        set({
          auxiliary: revealAuxiliaryPanel(
            api,
            get().auxiliary,
            panelId,
          ),
        });
        return;
      }

      const panel = api.getPanel(panelId);
      if (panel) {
        panel.api.setActive();
        panel.group.focus();
      }
    },

    toggleAuxiliaryPanel: (panelId) => {
      if (!isAuxiliaryPanelId(panelId)) {
        get().openPanel(panelId);
        return;
      }

      set((state) => ({
        auxiliary: toggleMinimizedAuxiliaryPanel(state.auxiliary, panelId),
      }));
    },

    minimizeAuxiliaryPanel: (panelId) => {
      const { api, auxiliary } = get();
      if (!api || !isAuxiliaryPanelId(panelId)) return;

      set({
        auxiliary: minimizeAuxiliaryPanelLayout(api, auxiliary, panelId),
      });
    },

    closeAuxiliaryPanel: (panelId) => {
      const { api, auxiliary } = get();
      if (!api || !isAuxiliaryPanelId(panelId)) return;

      set({
        auxiliary: closeAuxiliaryPanelLayout(api, auxiliary, panelId),
      });
    },

    closePanel: (panelId) => {
      const { api } = get();
      if (!api) return;

      if (isAuxiliaryPanelId(panelId)) {
        return;
      }

      const panel = api.getPanel(panelId);
      if (panel) {
        api.removePanel(panel);
      }
    },

    isPanelOpen: (panelId) => {
      const { api } = get();
      if (!api) return false;
      return api.getPanel(panelId) != null;
    },

    saveLayout: () => {
      const { api, auxiliary } = get();
      if (!api) return null;

      const nextAuxiliary = syncAuxiliaryLayoutFromApi(api, auxiliary);

      return JSON.stringify(
        createStoredWorkbenchLayout(api.toJSON(), nextAuxiliary),
      );
    },

    loadLayout: (json) => {
      const { api } = get();
      if (!api) return;

      api.clear();
      const parsed = parseStoredWorkbenchLayout(json);

      if (parsed.dockview) {
        try {
          api.fromJSON(parsed.dockview);
          set({
            auxiliary: applyAuxiliaryLayout(api, parsed.auxiliary),
          });
          return;
        } catch {
          api.clear();
        }
      }

      set({ auxiliary: buildDefaultWorkbenchLayout(api) });
    },

    syncAuxiliaryLayout: () => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: syncAuxiliaryLayoutFromApi(api, auxiliary),
      });
    },

    minimizeAuxiliaryGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: minimizeAuxiliaryGroupLayout(api, auxiliary, groupInstanceId),
      });
    },

    maximizeAuxiliaryGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: maximizeAuxiliaryGroupLayout(api, auxiliary, groupInstanceId),
      });
    },

    restoreAuxiliaryGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: restoreAuxiliaryGroupLayout(api, auxiliary, groupInstanceId),
      });
    },

    dockAuxiliaryPanel: (panelId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: dockAuxiliaryPanelLayout(api, auxiliary, panelId),
      });
    },

    hideAuxiliarySlideout: (edge) => {
      set((state) => ({
        auxiliary: hideAuxiliarySlideoutLayout(state.auxiliary, edge),
      }));
    },

    hideAllAuxiliarySlideouts: () => {
      set((state) => ({
        auxiliary: hideAllAuxiliarySlideoutsLayout(state.auxiliary),
      }));
    },

    resizeAuxiliarySlideout: (panelId, size) => {
      set((state) => ({
        auxiliary: resizeAuxiliarySlideoutLayout(state.auxiliary, panelId, size),
      }));
    },

    moveAuxiliaryEdge: (sourceEdge, targetEdge, preservedDockedSizes) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = moveAuxiliaryEdgeLayout(auxiliary, sourceEdge, targetEdge);
      const nextPreservedDockedSizes =
        preservedDockedSizes ?? captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: nextPreservedDockedSizes,
          debugLabel: 'store.moveAuxiliaryEdge',
          debugMeta: { sourceEdge, targetEdge },
          debugState: auxiliary,
        }),
      });
    },

    getAuxiliaryGroupForPanel: (panelId) => {
      const state = get();
      const instance = state.auxiliary.groups.find((g) =>
        g.panelIds.includes(panelId),
      );
      return instance?.groupInstanceId;
    },

    moveGroupToEdge: (groupInstanceId, targetEdge) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = moveGroupToEdgeLayout(auxiliary, groupInstanceId, targetEdge);
      const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: preservedDockedSizes,
          debugLabel: 'store.moveGroupToEdge',
          debugMeta: { groupInstanceId, targetEdge },
          debugState: auxiliary,
        }),
      });
    },

    movePanelToEdge: (panelId, targetEdge, preservedDockedSizes) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = movePanelToEdgeLayout(auxiliary, panelId, targetEdge);
      const nextPreservedDockedSizes =
        preservedDockedSizes ?? captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: nextPreservedDockedSizes,
          debugLabel: 'store.movePanelToEdge',
          debugMeta: { panelId, targetEdge },
          debugState: auxiliary,
        }),
      });
    },

    mergeBackToSeededGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = mergeBackToSeededGroupLayout(auxiliary, groupInstanceId);
      const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: preservedDockedSizes,
          debugLabel: 'store.mergeBackToSeededGroup',
          debugMeta: { groupInstanceId },
          debugState: auxiliary,
        }),
      });
    },

    resetLayout: () => {
      // Clear the dockview grid (main editor panels AND auxiliary panels)
      // and rebuild from defaults so the current session immediately
      // reflects the default workbench layout after Reset Windows.
      get().loadLayout(null);
    },

    handleNativeMenuCommand: (command) => {
      switch (command.type) {
        case 'focus-panel':
          get().openPanel(command.panelId);
          return;
        case 'reset-windows':
          get().resetLayout();
          return;
        case 'open-effects-library':
          useUIStore.getState().openEffectsLibrary();
          return;
        case 'toggle-follow-playback':
          usePlaybackStore.getState().toggleFollowPlayback();
          return;
        case 'toggle-follow-playback-on-render-start':
          usePlaybackStore.getState().toggleFollowPlaybackOnStart();
          return;
        case 'toggle-loop-rendering':
          useProjectStore.getState().setLoopRendering(
            !useProjectStore.getState().transport.loopRendering,
          );
          return;
        case 'add-marker':
          useProjectStore.getState().addMarkerAtTime(getAddMarkerTargetBeat());
          return;
        case 'navigate-next-marker':
          useProjectStore.getState().navigateToNextMarker();
          return;
        case 'navigate-previous-marker':
          useProjectStore.getState().navigateToPreviousMarker();
          return;
        case 'rewind-to-start':
          useProjectStore.getState().rewindToStart();
          return;
        case 'show-not-yet-implemented':
          window.alert('not yet implemented');
          return;
        case 'edit-tempo-map':
          window.dispatchEvent(new CustomEvent('blue-edit-tempo-map'));
          return;
        case 'edit-meter-map':
          window.dispatchEvent(new CustomEvent('blue-edit-meter-map'));
          return;
      }
    },
  }),
);
