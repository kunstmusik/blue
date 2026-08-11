import { create } from 'zustand';
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from 'dockview';
import {
  applyAuxiliaryLayout,
  type AuxiliaryDockedSizeSnapshot,
  buildDefaultWorkbenchLayout,
  cloneAuxiliaryLayoutState,
  createDefaultAuxiliaryLayoutState,
  createStoredWorkbenchLayout,
  captureAuxiliaryDockedSizesFromApi,
  dockAuxiliaryPanel as dockAuxiliaryPanelLayout,
  getAuxiliarySeedGroupIdForPanel,
  getGroupInstanceForPanel,
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
  restoreClosedAuxiliaryPanel,
  revealAuxiliaryPanel,
  syncAuxiliaryLayoutFromApi,
  toggleMinimizedAuxiliaryPanel,
  type AuxiliaryEdge,
  type AuxiliaryLayoutState,
} from '../components/workbench/auxiliary-layout';
import {
  captureDockingOrigin,
  clampPopoutBounds,
  recordFloatingOrigin as recordFloatingOriginMap,
  removeFloatingOrigin as removeFloatingOriginMap,
  resolveDockTarget,
} from '../components/workbench/floating-origin';
import type {
  DockingOrigin,
  WorkbenchRestoreDirection,
} from '../../shared/workbench-window-contract';
import type { DisplayWorkArea } from '../../shared/window-layout-settings';
import {
  getDefaultEditorPanels,
  getPanel,
  PANEL_REGISTRY,
} from '../components/workbench/panel-registry';
import { buildPlayheadDisplayState } from '../components/menu-bar/toolbar-formatters';
import type { NativeMenuCommand } from '../../shared/workbench-menu';
import { useLibraryStore } from './library-store';
import { useUIStore } from './ui-store';
import type { LibraryEditorSessionSnapshot } from '../../shared/unified-library';
import {
  libraryEditorPanelId,
  libraryEditorSessionIdFromPanel,
} from './library-editor-store';
import { usePlaybackStore } from './playback-store';
import { useProjectStore } from './project-store';
import { hasAuditionEligibleSelection, useScoreSelectionStore } from './score-selection-store';

interface WorkbenchState {
  api: DockviewApi | null;
  auxiliary: AuxiliaryLayoutState;
  /**
   * Dock-back origin metadata keyed by Dockview popout group id (SPEC 055 US1).
   */
  floatingOrigins: Record<string, DockingOrigin>;
  /**
   * Placement captured before Close, keyed by panel id. This remains separate
   * from active layout state so closed panels stay closed at startup.
   */
  closedPanelOrigins: Record<string, DockingOrigin>;
}

interface WorkbenchActions {
  setApi: (api: DockviewApi | null) => void;
  openPanel: (panelId: string) => void;
  openLibraryEditorPanel: (session: LibraryEditorSessionSnapshot) => void;
  focusPanel: (panelId: string) => void;
  toggleAuxiliaryPanel: (panelId: string) => void;
  minimizeAuxiliaryPanel: (panelId: string) => void;
  closeAuxiliaryPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  closeGroup: (panelId: string) => void;
  isPanelOpen: (panelId: string) => boolean;
  saveLayout: () => string | null;
  loadLayout: (json: string | null, workAreas?: DisplayWorkArea[]) => void;
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
  /** Floats only `panelId` into a separate OS window, matching NetBeans Float. */
  floatPanel: (panelId: string) => void;
  /** Floats the tab group containing `panelId` into a separate OS window (NetBeans Float Group). */
  floatGroup: (panelId: string) => void;
  /** Returns only `panelId` from a floating group when possible. */
  dockPanel: (panelId: string) => void;
  /** Returns a floating group to its prior workbench location (NetBeans Dock Group). */
  dockGroup: (panelId: string) => void;
  /** Moves the selected editor tab into a new document tab group. */
  newDocumentTabGroup: (panelId: string) => void;
  /** Collapses the selected editor tab group into another document tab group. */
  collapseDocumentTabGroup: (panelId: string) => void;
  /** Records/updates the dock-back origin for a popout group id. */
  recordFloatingOrigin: (popoutGroupId: string, origin: DockingOrigin) => void;
  /** Removes the dock-back origin for a popout group id. */
  removeFloatingOrigin: (popoutGroupId: string) => void;
  handleNativeMenuCommand: (command: NativeMenuCommand) => void;
}

type DockviewApiWithInternals = {
  component?: {
    removeGroup: (
      group: DockviewGroupPanel,
      options?: {
        skipActive?: boolean;
        skipDispose?: boolean;
        skipPopoutAssociated?: boolean;
        skipPopoutReturn?: boolean;
      },
    ) => void;
    removePanel?: (
      panel: IDockviewPanel,
      options?: {
        removeEmptyGroup?: boolean;
        skipDispose?: boolean;
        skipSetActiveGroup?: boolean;
      },
    ) => void;
    moveGroupOrPanel?: (options: {
      from: {
        groupId: string;
        panelId?: string;
      };
      to: {
        group: DockviewGroupPanel;
        position: 'center';
        index?: number;
      };
      keepEmptyGroups?: boolean;
      skipSetActive?: boolean;
    }) => void;
  };
  removeGroup: (
    group: DockviewGroupPanel,
    options?: {
      skipActive?: boolean;
      skipDispose?: boolean;
      skipPopoutAssociated?: boolean;
      skipPopoutReturn?: boolean;
    },
  ) => void;
};

interface PopoutOpenGuard {
  onDidOpen: (event: { window: Window }) => void;
  complete: (opened: boolean) => void;
}

const floatingWindowIds = new WeakMap<Window, string>();

function isPanelClosable(panelId: string): boolean {
  return getPanel(panelId)?.isClosable ?? true;
}

function isPanelFloatable(panelId: string): boolean {
  return getPanel(panelId)?.isFloatable ?? true;
}

function isEditorPanel(panelId: string): boolean {
  return (getPanel(panelId)?.mode ?? 'editor') === 'editor';
}

export function findLibraryEditorTargetGroup(
  api: Pick<DockviewApi, 'groups'>,
): DockviewGroupPanel | undefined {
  return api.groups.find(
    (group) =>
      group.api.location.type !== 'popout' &&
      group.panels.every((panel) => !isAuxiliaryPanelId(panel.id)) &&
      group.panels.some(
        (panel) => isEditorPanel(panel.id),
      ),
  );
}

export function findLibraryEditorPanelsToClose(
  api: Pick<DockviewApi, 'panels'>,
  keepPanelId: string | null,
): IDockviewPanel[] {
  return api.panels.filter((panel) => (
    panel.id !== keepPanelId
    && libraryEditorSessionIdFromPanel(panel.id) !== null
  ));
}

export function hasRestoredStartupEditorPanel(
  api: Pick<DockviewApi, 'getPanel'>,
): boolean {
  return getDefaultEditorPanels().some(
    (descriptor) => api.getPanel(descriptor.id) !== undefined,
  );
}

function getAuxiliaryPresentation(
  auxiliary: AuxiliaryLayoutState,
  panelId: string,
): 'docked' | 'minimized' | 'slideout' | 'maximized' {
  const instance = isAuxiliaryPanelId(panelId)
    ? getGroupInstanceForPanel(auxiliary, panelId)
    : undefined;

  if (!instance) {
    return 'docked';
  }

  if (instance.dockedPanelIds.includes(panelId)) {
    return instance.isMaximized ? 'maximized' : 'docked';
  }

  return auxiliary.slideouts[instance.edge].openPanelId === panelId
    ? 'slideout'
    : 'minimized';
}

function captureOriginForPanels({
  auxiliary,
  group,
  panelIds,
  activePanelId,
  originIndex,
}: {
  auxiliary: AuxiliaryLayoutState;
  group: DockviewGroupPanel;
  panelIds: string[];
  activePanelId: string;
  originIndex?: number;
}): DockingOrigin {
  const firstPanelId = panelIds[0] ?? activePanelId;
  const descriptor = getPanel(activePanelId) ?? getPanel(firstPanelId);
  const instance = isAuxiliaryPanelId(firstPanelId)
    ? getGroupInstanceForPanel(auxiliary, firstPanelId)
    : undefined;
  const presentation = getAuxiliaryPresentation(auxiliary, firstPanelId);

  return captureDockingOrigin({
    groupId: group.id,
    panelIds,
    activePanelId,
    mode: descriptor?.mode ?? 'editor',
    presentation,
    ...(originIndex !== undefined ? { originIndex } : {}),
    ...(instance
      ? {
          auxiliarySeedGroupId: instance.seedGroupId,
          edge: instance.edge,
          dockedSize: instance.dockedSize,
          slideoutSize: instance.slideoutSize,
        }
      : {}),
  });
}

function getGroupBounds(
  group: DockviewGroupPanel,
): { left: number; top: number; width: number; height: number } | undefined {
  const element = group.element;
  if (!element) return undefined;

  const bounds = element.getBoundingClientRect();
  if (
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }

  return bounds;
}

function captureEditorSplitRestorePlacement(
  api: DockviewApi,
  sourceGroup: DockviewGroupPanel,
): Pick<DockingOrigin, 'restoreReferenceGroupId' | 'restoreDirection'> {
  if (sourceGroup.panels.length > 1) {
    return {};
  }

  const sourceBounds = getGroupBounds(sourceGroup);
  if (!sourceBounds) {
    return {};
  }

  const sourceCenter = {
    x: sourceBounds.left + sourceBounds.width / 2,
    y: sourceBounds.top + sourceBounds.height / 2,
  };
  const candidates = api.groups
    .filter(
      (group) =>
        group.id !== sourceGroup.id &&
        group.api.location.type !== 'popout' &&
        group.panels.some((panel) => isEditorPanel(panel.id)),
    )
    .flatMap((group) => {
      const bounds = getGroupBounds(group);
      if (!bounds) return [];

      const center = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
      const dx = sourceCenter.x - center.x;
      const dy = sourceCenter.y - center.y;
      const direction: WorkbenchRestoreDirection =
        Math.abs(dx) >= Math.abs(dy)
          ? dx < 0
            ? 'left'
            : 'right'
          : dy < 0
            ? 'above'
            : 'below';
      return [{ group, distance: Math.hypot(dx, dy), direction }];
    })
    .sort((left, right) => left.distance - right.distance);

  const target = candidates[0];
  return target
    ? {
        restoreReferenceGroupId: target.group.id,
        restoreDirection: target.direction,
      }
    : {};
}

function captureClosedPanelOrigin({
  api,
  auxiliary,
  floatingOrigins,
  panelId,
}: {
  api: DockviewApi;
  auxiliary: AuxiliaryLayoutState;
  floatingOrigins: Record<string, DockingOrigin>;
  panelId: string;
}): DockingOrigin | undefined {
  const descriptor = getPanel(panelId);
  if (!descriptor) return undefined;

  const livePanel = api.getPanel(panelId);
  if (isAuxiliaryPanelId(panelId)) {
    const instance = getGroupInstanceForPanel(auxiliary, panelId);
    if (!instance) return undefined;

    return captureDockingOrigin({
      groupId: livePanel?.group.id,
      panelIds: [panelId],
      activePanelId: panelId,
      mode: descriptor.mode,
      originIndex: livePanel
        ? livePanel.group.panels.findIndex((panel) => panel.id === panelId)
        : instance.panelIds.indexOf(panelId),
      auxiliarySeedGroupId: instance.seedGroupId,
      auxiliaryGroupInstanceId: instance.groupInstanceId,
      edge: instance.edge,
      presentation: getAuxiliaryPresentation(auxiliary, panelId),
      dockedSize: instance.dockedSize,
      slideoutSize: instance.slideoutSize,
    });
  }

  if (!livePanel) return undefined;

  const sourceGroup = livePanel.group as DockviewGroupPanel;
  const floatingOrigin = floatingOrigins[sourceGroup.id];
  if (sourceGroup.api.location.type === 'popout' && floatingOrigin) {
    const originIndex = floatingOrigin.originPanelOrder.indexOf(panelId);
    return {
      ...floatingOrigin,
      originPanelOrder: [panelId],
      originActivePanelId: panelId,
      ...(originIndex >= 0 ? { originIndex } : {}),
    };
  }

  const originIndex = sourceGroup.panels.findIndex(
    (panel) => panel.id === panelId,
  );
  return captureDockingOrigin({
    groupId: sourceGroup.id,
    panelIds: [panelId],
    activePanelId: panelId,
    mode: descriptor.mode,
    originIndex: originIndex >= 0 ? originIndex : undefined,
    presentation: 'docked',
    ...captureEditorSplitRestorePlacement(api, sourceGroup),
  });
}

function removeClosedPanelOrigin(
  origins: Record<string, DockingOrigin>,
  panelId: string,
): Record<string, DockingOrigin> {
  if (!(panelId in origins)) return origins;
  const next = { ...origins };
  delete next[panelId];
  return next;
}

function findEditorDockTargetGroup(
  api: DockviewApi,
  sourceGroup: DockviewGroupPanel,
  origin: DockingOrigin | undefined,
): DockviewGroupPanel {
  const originGroup = origin?.originGroupId
    ? api.getGroup(origin.originGroupId)
    : undefined;
  if (
    originGroup &&
    originGroup.id !== sourceGroup.id &&
    originGroup.api.location.type !== 'popout'
  ) {
    return originGroup as DockviewGroupPanel;
  }

  const existingEditorGroups = api.groups.filter(
    (g) =>
      g.id !== sourceGroup.id &&
      g.api.location.type !== 'popout' &&
      g.panels.some((p) => !isAuxiliaryPanelId(p.id)),
  );
  return existingEditorGroups.length > 0
    ? existingEditorGroups[0]!
    : api.addGroup();
}

function getPopoutWindow(group: DockviewGroupPanel): Window | undefined {
  try {
    const location = group.api.location;
    return location.type === 'popout'
      ? (location.getWindow() ?? undefined)
      : undefined;
  } catch {
    // A group can be disposed by Dockview while an OS window is closing.
    return undefined;
  }
}

function registerFloatingRendererWindow(group: DockviewGroupPanel): void {
  const popoutWindow = getPopoutWindow(group) as
    | (Window & {
        blueAPI?: {
          registerWorkbenchWindow?: (request: {
            role: 'floating';
            popoutGroupId: string;
          }) => Promise<{ windowId: string }>;
          updateWorkbenchOwnership?: (update: {
            windowId: string;
            role: 'floating';
            popoutGroupId: string;
            panelIds: string[];
            activePanelId?: string;
          }) => void;
          requestWorkbenchWindowClose?: (request: {
            windowId: string;
            panelIds: string[];
            source: 'dock';
          }) => Promise<{ allowed: boolean }>;
        };
      })
    | undefined;
  const register = popoutWindow?.blueAPI?.registerWorkbenchWindow;
  if (!register) return;

  // The main process first sees the BrowserWindow by URL. Re-registering from
  // the popout supplies the Dockview group id and lets main bind that exact OS
  // window instead of guessing among multiple unassigned popouts.
  const panelIds = group.panels.map((panel) => panel.id);
  const activePanelId = group.activePanel?.id;
  void register({ role: 'floating', popoutGroupId: group.id })
    .then(({ windowId }) => {
      floatingWindowIds.set(popoutWindow, windowId);
      popoutWindow?.blueAPI?.updateWorkbenchOwnership?.({
        windowId,
        role: 'floating',
        popoutGroupId: group.id,
        panelIds,
        activePanelId,
      });
    })
    .catch(() => {
      // The popout may be closing before its preload bridge is reachable.
    });
}

function closePopoutWindow(popoutWindow: Window | undefined): void {
  if (!popoutWindow || popoutWindow.closed) {
    return;
  }

  const windowId = floatingWindowIds.get(popoutWindow);
  const requestClose = (
    popoutWindow as Window & {
      blueAPI?: {
        requestWorkbenchWindowClose?: (request: {
          windowId: string;
          panelIds: string[];
          source: 'dock';
        }) => Promise<{ allowed: boolean }>;
      };
    }
  ).blueAPI?.requestWorkbenchWindowClose;
  if (windowId && requestClose) {
    void requestClose({ windowId, panelIds: [], source: 'dock' })
      .then((result) => {
        if (result.allowed && !popoutWindow.closed) {
          popoutWindow.close();
        }
      })
      .catch(() => {
        if (!popoutWindow.closed) {
          popoutWindow.close();
        }
      });
    return;
  }

  try {
    popoutWindow.close();
  } catch {
    // Ignore stale cross-window handles during teardown.
  }
}

function cleanupEmptyFloatingGroup(
  api: DockviewApi,
  group: DockviewGroupPanel,
  capturedPopoutWindow?: Window,
  options: { removeAssociatedReference?: boolean } = {},
): void {
  if (group.panels.length > 0) {
    return;
  }

  // A panel move can make Dockview detach the group before cleanup runs. Keep
  // the original native window handle so that stale, empty popouts are still
  // closed in that case.
  const popoutWindow = capturedPopoutWindow ?? getPopoutWindow(group);

  try {
    const apiWithOptions = api as unknown as DockviewApiWithInternals;
    const removeGroup =
      apiWithOptions.component?.removeGroup.bind(apiWithOptions.component) ??
      apiWithOptions.removeGroup.bind(apiWithOptions);
    removeGroup(group, {
      skipActive: true,
      skipPopoutReturn: true,
      // Dockview retains an empty, hidden grid reference while a group lives
      // in a popout. Once an auxiliary group has been rebuilt at its edge,
      // that reference must go too or it is rendered as a blank splitter.
      ...(options.removeAssociatedReference
        ? {}
        : { skipPopoutAssociated: true }),
    });
  } catch {
    // Dockview may already remove the group as part of a popout close.
  }

  closePopoutWindow(popoutWindow);
}

function cleanupEmptyPopoutGroups(api: DockviewApi): void {
  for (const group of [...api.groups]) {
    // A newly-created Dockview popout deliberately leaves its source group
    // empty and hidden in the grid as the dock-back reference. Only remove
    // empty groups that are themselves popouts.
    if (group.panels.length === 0 && group.api.location.type === 'popout') {
      cleanupEmptyFloatingGroup(api, group);
    }
  }
}

function removePanelKeepingSourceGroup(
  api: DockviewApi,
  panel: IDockviewPanel,
): void {
  const component = (api as unknown as DockviewApiWithInternals).component;
  if (component?.removePanel) {
    component.removePanel(panel, { removeEmptyGroup: false });
    return;
  }

  api.removePanel(panel);
}

function movePanelKeepingSourceGroup(
  api: DockviewApi,
  sourceGroup: DockviewGroupPanel,
  panel: IDockviewPanel,
  targetGroup: DockviewGroupPanel,
  index: number,
): void {
  const component = (api as unknown as DockviewApiWithInternals).component;
  if (component?.moveGroupOrPanel) {
    component.moveGroupOrPanel({
      from: { groupId: sourceGroup.id, panelId: panel.id },
      to: { group: targetGroup, position: 'center', index },
      keepEmptyGroups: true,
    });
    return;
  }

  panel.api.moveTo({ group: targetGroup, index });
}

function refreshPopoutGroupLayout(group: DockviewGroupPanel): void {
  const popoutWindow = getPopoutWindow(group);
  if (!popoutWindow || popoutWindow.closed) {
    return;
  }

  const relayout = () => {
    if (popoutWindow.closed) {
      return;
    }

    try {
      group.layout(popoutWindow.innerWidth, popoutWindow.innerHeight);
      group.activePanel?.api.setActive();
    } catch {
      // The group may be torn down before the deferred layout executes.
      return;
    }

    try {
      // Events must originate in the popout's realm. A main-window Event is
      // rejected by Electron/Chromium here and silently leaves canvas panels
      // unmeasured until the user switches tabs.
      const PopoutEvent = (popoutWindow as Window & { Event: typeof Event })
        .Event;
      popoutWindow.dispatchEvent(new PopoutEvent('resize'));
    } catch {
      // A direct group layout above is sufficient when the event is unavailable.
    }
  };

  relayout();
  try {
    popoutWindow.requestAnimationFrame(relayout);
  } catch {
    globalThis.setTimeout(relayout, 0);
  }
}

function createPopoutOpenGuard(api: DockviewApi): PopoutOpenGuard {
  let popoutWindow: Window | undefined;
  let completed = false;
  let closeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const hasDockviewContainer = () => {
    try {
      return Boolean(popoutWindow?.document.getElementById('dv-popout-window'));
    } catch {
      return false;
    }
  };

  return {
    onDidOpen: ({ window: openedWindow }) => {
      popoutWindow = openedWindow;

      globalThis.setTimeout(() => {
        if (completed || openedWindow.closed || hasDockviewContainer()) {
          return;
        }

        try {
          if (openedWindow.document.readyState !== 'loading') {
            openedWindow.location.reload();
          }
        } catch {
          // If the window handle is no longer usable, the timeout below will
          // close it or no-op.
        }
      }, 0);

      closeTimer = globalThis.setTimeout(() => {
        if (!completed && !hasDockviewContainer()) {
          closePopoutWindow(popoutWindow);
          cleanupEmptyPopoutGroups(api);
        }
      }, 2500);
    },
    complete: (opened) => {
      completed = true;
      if (closeTimer !== undefined) {
        globalThis.clearTimeout(closeTimer);
      }
      if (!opened) {
        closePopoutWindow(popoutWindow);
        cleanupEmptyPopoutGroups(api);
      }
    },
  };
}

function getAddMarkerTargetBeat(): number {
  const project = useProjectStore.getState();
  const playback = usePlaybackStore.getState();
  if (
    (playback.status === 'playing' || playback.status === 'stopping') &&
    playback.clock !== null
  ) {
    const transport = playback.transportAnchor ?? project.transport;
    return buildPlayheadDisplayState(transport, {
      status: playback.status,
      hasClock: true,
      elapsedSeconds: playback.display.elapsedSeconds,
      source: playback.display.source,
    }).displayBeat;
  }
  return project.transport.renderStartTime;
}

export const useWorkbenchStore = create<WorkbenchState & WorkbenchActions>()(
  (set, get) => ({
    api: null,
    auxiliary: createDefaultAuxiliaryLayoutState(),
    floatingOrigins: {},
    closedPanelOrigins: {},

    setApi: (api) => set({ api }),

    openPanel: (panelId) => {
      const { api, auxiliary, closedPanelOrigins } = get();
      if (!api) return;

      const descriptor = getPanel(panelId);
      if (!descriptor) return;

      if (isAuxiliaryPanelId(panelId)) {
        const origin = closedPanelOrigins[panelId];
        // Remove the durable close record before Dockview emits its layout
        // event, ensuring the next serialized layout reflects the reopened
        // component rather than a stale closed-panel restore target.
        if (origin) {
          set({
            closedPanelOrigins: removeClosedPanelOrigin(
              closedPanelOrigins,
              panelId,
            ),
          });
        }
        set({
          auxiliary: origin
            ? restoreClosedAuxiliaryPanel(api, auxiliary, panelId, origin)
            : revealAuxiliaryPanel(api, auxiliary, panelId),
        });
        return;
      }

      const existing = api.getPanel(panelId);
      if (existing) {
        existing.api.setActive();
        existing.group.focus();
        return;
      }

      const origin = closedPanelOrigins[panelId];
      if (origin) {
        set({
          closedPanelOrigins: removeClosedPanelOrigin(
            closedPanelOrigins,
            panelId,
          ),
        });

        const originGroup = origin.originGroupId
          ? api.getGroup(origin.originGroupId)
          : undefined;
        if (originGroup && originGroup.api.location.type !== 'popout') {
          api.addPanel({
            id: panelId,
            component: 'default',
            title: descriptor.title,
            position: {
              referenceGroup: originGroup,
              direction: 'within',
              index: Number.isFinite(origin.originIndex)
                ? Math.max(
                    0,
                    Math.min(origin.originIndex!, originGroup.panels.length),
                  )
                : originGroup.panels.length,
            },
          });
          return;
        }

        const referenceGroup = origin.restoreReferenceGroupId
          ? api.getGroup(origin.restoreReferenceGroupId)
          : undefined;
        if (
          referenceGroup &&
          referenceGroup.api.location.type !== 'popout' &&
          origin.restoreDirection
        ) {
          api.addPanel({
            id: panelId,
            component: 'default',
            title: descriptor.title,
            position: {
              referenceGroup,
              direction: origin.restoreDirection,
            },
          });
          return;
        }
      }

      api.addPanel({
        id: panelId,
        component: 'default',
        title: descriptor.title,
      });
    },

    openLibraryEditorPanel: (session) => {
      const { api } = get();
      if (!api) return;
      const panelId = libraryEditorPanelId(session.sessionId);
      for (const candidate of findLibraryEditorPanelsToClose(api, panelId)) {
        api.removePanel(candidate);
      }
      cleanupEmptyPopoutGroups(api);
      const existing = api.getPanel(panelId);
      const targetGroup = findLibraryEditorTargetGroup(api);
      if (existing) {
        if (
          targetGroup
          && existing.group.id !== targetGroup.id
          && existing.group.panels.some((panel) => isAuxiliaryPanelId(panel.id))
        ) {
          existing.api.moveTo({ group: targetGroup, index: targetGroup.panels.length });
        }
        existing.api.setTitle(`Library Item${session.dirty ? ' •' : ''}`);
        existing.api.setActive();
        return;
      }
      api.addPanel({
        id: panelId,
        component: 'default',
        title: `Library Item${session.dirty ? ' •' : ''}`,
        ...(targetGroup
          ? {
              position: {
                referenceGroup: targetGroup,
                direction: 'within' as const,
              },
            }
          : {}),
      });
    },

    focusPanel: (panelId) => {
      const { api } = get();
      if (!api) return;

      if (isAuxiliaryPanelId(panelId)) {
        set({
          auxiliary: revealAuxiliaryPanel(api, get().auxiliary, panelId),
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
      const { api, auxiliary, floatingOrigins, closedPanelOrigins } = get();
      if (!api || !isAuxiliaryPanelId(panelId)) return;

      const origin = captureClosedPanelOrigin({
        api,
        auxiliary,
        floatingOrigins,
        panelId,
      });
      if (origin) {
        set({
          closedPanelOrigins: { ...closedPanelOrigins, [panelId]: origin },
        });
      }

      set({
        auxiliary: closeAuxiliaryPanelLayout(api, auxiliary, panelId),
      });
    },

    closePanel: (panelId) => {
      const { api, auxiliary, floatingOrigins, closedPanelOrigins } = get();
      if (!api) return;

      if (!isPanelClosable(panelId)) {
        return;
      }

      if (isAuxiliaryPanelId(panelId)) {
        return;
      }

      const panel = api.getPanel(panelId);
      if (panel) {
        const origin = captureClosedPanelOrigin({
          api,
          auxiliary,
          floatingOrigins,
          panelId,
        });
        if (origin) {
          set({
            closedPanelOrigins: { ...closedPanelOrigins, [panelId]: origin },
          });
        }

        const group = panel.group;
        const popoutWindow = getPopoutWindow(group);
        if (group.api.location.type === 'popout' && group.panels.length === 1) {
          removePanelKeepingSourceGroup(api, panel);
          cleanupEmptyFloatingGroup(api, group, popoutWindow);
          return;
        }

        api.removePanel(panel);
      }
    },

    closeGroup: (panelId) => {
      const { api, auxiliary, floatingOrigins, closedPanelOrigins } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel) return;

      const group = panel.group;
      const popoutWindow = getPopoutWindow(group);
      const isPopout = group.api.location.type === 'popout';

      const nextClosedPanelOrigins = { ...closedPanelOrigins };
      for (const candidate of group.panels) {
        if (!isPanelClosable(candidate.id)) continue;
        const origin = captureClosedPanelOrigin({
          api,
          auxiliary,
          floatingOrigins,
          panelId: candidate.id,
        });
        if (origin) {
          nextClosedPanelOrigins[candidate.id] = origin;
        }
      }
      set({ closedPanelOrigins: nextClosedPanelOrigins });

      for (const candidate of [...group.panels]) {
        if (!isPanelClosable(candidate.id)) {
          continue;
        }
        if (isAuxiliaryPanelId(candidate.id)) {
          get().closeAuxiliaryPanel(candidate.id);
        } else if (isPopout) {
          removePanelKeepingSourceGroup(api, candidate);
        } else {
          api.removePanel(candidate);
        }
      }

      cleanupEmptyFloatingGroup(api, group, popoutWindow);
    },

    isPanelOpen: (panelId) => {
      const { api } = get();
      if (!api) return false;
      return api.getPanel(panelId) != null;
    },

    saveLayout: () => {
      const { api, auxiliary, floatingOrigins, closedPanelOrigins } = get();
      if (!api) return null;
      // Never let a transient, unhydrated Dockview canvas overwrite the last
      // usable workbench layout in persistent settings.
      if (!hasRestoredStartupEditorPanel(api)) return null;

      const nextAuxiliary = syncAuxiliaryLayoutFromApi(api, auxiliary);

      return JSON.stringify(
        createStoredWorkbenchLayout(api.toJSON(), nextAuxiliary, {
          floatingOrigins,
          closedPanelOrigins,
        }),
      );
    },

    loadLayout: (json, workAreas) => {
      const { api } = get();
      if (!api) return;

      api.clear();
      const parsed = parseStoredWorkbenchLayout(json);

      if (parsed.dockview) {
        try {
          // Clamp restored popout positions onto a currently connected display
          // so a floating window saved on a now-disconnected display does not
          // reopen offscreen (SPEC 055 US4, FR-022). Main supplies all display
          // work areas; the viewport is only a renderer/test fallback.
          const viewportArea = {
            x: 0,
            y: 0,
            width: typeof window === 'undefined' ? 1440 : window.innerWidth,
            height: typeof window === 'undefined' ? 900 : window.innerHeight,
          };
          const validWorkAreas = (workAreas ?? []).filter(
            (area) =>
              Number.isFinite(area.x) &&
              Number.isFinite(area.y) &&
              Number.isFinite(area.width) &&
              Number.isFinite(area.height) &&
              area.width > 0 &&
              area.height > 0,
          );
          const safeDockview = clampPopoutBounds(
            parsed.dockview as unknown as Record<string, unknown>,
            validWorkAreas.length > 0 ? validWorkAreas : [viewportArea],
          ) as unknown as typeof parsed.dockview;
          api.fromJSON(safeDockview);
          for (const candidate of findLibraryEditorPanelsToClose(api, null)) {
            api.removePanel(candidate);
          }
          for (const group of api.groups) {
            if (group.api.location.type === 'popout') {
              registerFloatingRendererWindow(group);
            }
          }
          cleanupEmptyPopoutGroups(api);

          // A persisted workbench without any primary editor is an incomplete
          // snapshot, not a usable user layout. This can occur when a prior
          // startup persisted Dockview before initial hydration completed.
          if (!hasRestoredStartupEditorPanel(api)) {
            api.clear();
            set({
              auxiliary: buildDefaultWorkbenchLayout(api),
              floatingOrigins: {},
              closedPanelOrigins: {},
            });
            return;
          }

          set({
            auxiliary: applyAuxiliaryLayout(api, parsed.auxiliary),
            floatingOrigins: parsed.floatingOrigins ?? {},
            closedPanelOrigins: parsed.closedPanelOrigins ?? {},
          });
          return;
        } catch {
          api.clear();
        }
      }

      set({
        auxiliary: buildDefaultWorkbenchLayout(api),
        floatingOrigins: {},
        closedPanelOrigins: {},
      });
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
        auxiliary: minimizeAuxiliaryGroupLayout(
          api,
          auxiliary,
          groupInstanceId,
        ),
      });
    },

    maximizeAuxiliaryGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      set({
        auxiliary: maximizeAuxiliaryGroupLayout(
          api,
          auxiliary,
          groupInstanceId,
        ),
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
        auxiliary: resizeAuxiliarySlideoutLayout(
          state.auxiliary,
          panelId,
          size,
        ),
      }));
    },

    moveAuxiliaryEdge: (sourceEdge, targetEdge, preservedDockedSizes) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = moveAuxiliaryEdgeLayout(auxiliary, sourceEdge, targetEdge);
      const nextPreservedDockedSizes =
        preservedDockedSizes ??
        captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: nextPreservedDockedSizes,
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

      const next = moveGroupToEdgeLayout(
        auxiliary,
        groupInstanceId,
        targetEdge,
      );
      const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(
        api,
        auxiliary,
      );
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: preservedDockedSizes,
        }),
      });
    },

    movePanelToEdge: (panelId, targetEdge, preservedDockedSizes) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = movePanelToEdgeLayout(auxiliary, panelId, targetEdge);
      const nextPreservedDockedSizes =
        preservedDockedSizes ??
        captureAuxiliaryDockedSizesFromApi(api, auxiliary);
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: nextPreservedDockedSizes,
        }),
      });
    },

    mergeBackToSeededGroup: (groupInstanceId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const next = mergeBackToSeededGroupLayout(auxiliary, groupInstanceId);
      const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(
        api,
        auxiliary,
      );
      set({
        auxiliary: applyAuxiliaryLayout(api, next, {
          preserveDockedSizes: preservedDockedSizes,
        }),
      });
    },

    resetLayout: () => {
      // Clear the dockview grid (main editor panels AND auxiliary panels)
      // and rebuild from defaults so the current session immediately
      // reflects the default workbench layout after Reset Windows. Floating
      // dock-back origins are cleared too (SPEC 055 FR-023).
      get().loadLayout(null);
    },

    floatPanel: (panelId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel) return;
      if (!isPanelFloatable(panelId)) return;

      const sourceGroup = panel.group;
      const sourceIndex = sourceGroup.panels.findIndex((p) => p.id === panelId);
      const originAuxiliary = isAuxiliaryPanelId(panelId)
        ? syncAuxiliaryLayoutFromApi(api, auxiliary)
        : auxiliary;
      const origin = captureOriginForPanels({
        auxiliary: originAuxiliary,
        group: sourceGroup,
        panelIds: [panelId],
        activePanelId: panelId,
        originIndex: sourceIndex >= 0 ? sourceIndex : undefined,
      });

      const width = Math.max(420, Math.min(760, panel.api.width));
      const height = Math.max(280, Math.min(520, panel.api.height));

      const itemToPopout = sourceGroup.panels.length > 1 ? panel : sourceGroup;
      const popoutGuard = createPopoutOpenGuard(api);

      void api
        .addPopoutGroup(itemToPopout, {
          // Let Dockview create a distinct popout group and retain the source
          // group as its hidden reference. Reusing the source group here makes
          // Dockview restore an empty group as a split when the final tab docks.
          popoutUrl: 'popout.html',
          position: { left: 96, top: 96, width, height },
          onDidOpen: popoutGuard.onDidOpen,
        })
        .then((opened) => {
          popoutGuard.complete(opened);
          if (!opened) return;

          const floatedPanel = api.getPanel(panelId);
          const popoutGroup = floatedPanel?.group;
          if (!popoutGroup || popoutGroup.api.location.type !== 'popout') {
            return;
          }

          set((state) => ({
            floatingOrigins: recordFloatingOriginMap(
              state.floatingOrigins,
              popoutGroup.id,
              origin,
            ),
          }));
          registerFloatingRendererWindow(popoutGroup);
          cleanupEmptyPopoutGroups(api);
          refreshPopoutGroupLayout(popoutGroup);
        })
        .catch(() => {
          popoutGuard.complete(false);
        });
    },

    floatGroup: (panelId) => {
      const { api, auxiliary } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel) return;

      const group = panel.group;
      const panelIds = group.panels.map((p) => p.id);
      if (
        panelIds.length === 0 ||
        panelIds.some((id) => !isPanelFloatable(id))
      ) {
        return;
      }

      const originAuxiliary = panelIds.some(isAuxiliaryPanelId)
        ? syncAuxiliaryLayoutFromApi(api, auxiliary)
        : auxiliary;
      const origin = captureOriginForPanels({
        auxiliary: originAuxiliary,
        group,
        panelIds,
        activePanelId: group.activePanel?.id ?? panelId,
      });

      const width = Math.max(420, Math.min(760, panel.api.width));
      const height = Math.max(280, Math.min(520, panel.api.height));
      const popoutGuard = createPopoutOpenGuard(api);

      void api
        .addPopoutGroup(group, {
          // Preserve this grid group as Dockview's reference group. It retains
          // the original place in the main frame and becomes visible again when
          // the popout is closed or docked.
          popoutUrl: 'popout.html',
          position: { left: 96, top: 96, width, height },
          onDidOpen: popoutGuard.onDidOpen,
        })
        .then((opened) => {
          popoutGuard.complete(opened);
          if (!opened) return;

          const floatedPanel = api.getPanel(panelId);
          const popoutGroup = floatedPanel?.group;
          if (!popoutGroup || popoutGroup.api.location.type !== 'popout') {
            return;
          }

          set((state) => ({
            floatingOrigins: recordFloatingOriginMap(
              state.floatingOrigins,
              popoutGroup.id,
              origin,
            ),
          }));
          registerFloatingRendererWindow(popoutGroup);
          cleanupEmptyPopoutGroups(api);
          refreshPopoutGroupLayout(popoutGroup);
        })
        .catch(() => {
          popoutGuard.complete(false);
        });
    },

    dockPanel: (panelId) => {
      const { api, floatingOrigins } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel) return;

      const group = panel.group;
      if (group.panels.length <= 1) {
        get().dockGroup(panelId);
        return;
      }

      const groupId = group.id;
      const knownPanelIds = new Set(
        PANEL_REGISTRY.map((descriptor) => descriptor.id),
      );
      const resolution = resolveDockTarget(
        floatingOrigins,
        groupId,
        knownPanelIds,
      );
      const origin = resolution.origin;
      const targetGroup = findEditorDockTargetGroup(api, group, origin);
      const targetIndex = Number.isFinite(origin?.originIndex)
        ? Math.max(0, Math.min(origin!.originIndex!, targetGroup.panels.length))
        : targetGroup.panels.length;

      panel.api.moveTo({ group: targetGroup, index: targetIndex });
      panel.api.setActive();

      const remainingOrigin = origin
        ? {
            ...origin,
            originPanelOrder: origin.originPanelOrder.filter(
              (id) => id !== panelId,
            ),
            originActivePanelId:
              origin.originActivePanelId === panelId
                ? origin.originPanelOrder.find((id) => id !== panelId)
                : origin.originActivePanelId,
          }
        : undefined;

      set({
        floatingOrigins:
          remainingOrigin && remainingOrigin.originPanelOrder.length > 0
            ? recordFloatingOriginMap(floatingOrigins, groupId, remainingOrigin)
            : removeFloatingOriginMap(floatingOrigins, groupId),
      });
    },

    dockGroup: (panelId) => {
      const { api, auxiliary, floatingOrigins } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel) return;

      const group = panel.group;
      const groupId = group.id;
      // Retain the original handle before moving the final tab. Dockview may
      // detach the empty group during that move, but its BrowserWindow must
      // still be closed.
      const popoutWindow = getPopoutWindow(group);

      const knownPanelIds = new Set(
        PANEL_REGISTRY.map((descriptor) => descriptor.id),
      );
      const resolution = resolveDockTarget(
        floatingOrigins,
        groupId,
        knownPanelIds,
      );

      // Decide which panels to bring back. Prefer the origin's surviving panel
      // order; otherwise bring back every panel currently in the floating group
      // (fallback to default mode, FR-006).
      const floatingPanels = group.panels;
      const orderedPanelIds =
        resolution.validPanelIds.length > 0
          ? resolution.validPanelIds
          : floatingPanels.map((p) => p.id);

      if (orderedPanelIds.length === 0) return;

      const origin = resolution.origin;

      // Determine if this is an auxiliary panel that should restore to its
      // original edge (FR-005, FR-027).
      const firstPanelId = orderedPanelIds[0];
      const isFirstAuxiliary = isAuxiliaryPanelId(firstPanelId);
      if (isFirstAuxiliary && origin?.edge && origin.auxiliarySeedGroupId) {
        const originEdge = origin.edge;
        const originSeedGroupId = origin.auxiliarySeedGroupId;
        // Restore to the auxiliary layout: find the matching group instance
        // by seed group ID and edge, add the panels back, and rebuild.
        const nextAuxiliary = cloneAuxiliaryLayoutState(auxiliary);

        const targetInstance = nextAuxiliary.groups.find(
          (g) => g.seedGroupId === originSeedGroupId && g.edge === originEdge,
        );

        if (targetInstance) {
          // Add panels back to the docked panel list in seed order.
          for (const id of orderedPanelIds) {
            if (!targetInstance.dockedPanelIds.includes(id)) {
              targetInstance.dockedPanelIds.push(id);
            }
          }
          targetInstance.activePanelId =
            origin.originActivePanelId ?? orderedPanelIds[0];
          targetInstance.isMaximized = false;

          // Restore sizes from the origin when available.
          if (origin.dockedSize !== undefined) {
            targetInstance.dockedSize = origin.dockedSize;
          }
          if (origin.slideoutSize !== undefined) {
            targetInstance.slideoutSize = origin.slideoutSize;
          }

          // Clear the slideout for this edge if it was showing one of the
          // docked panels.
          if (
            nextAuxiliary.slideouts[originEdge].openPanelId &&
            orderedPanelIds.includes(
              nextAuxiliary.slideouts[originEdge].openPanelId!,
            )
          ) {
            nextAuxiliary.slideouts[originEdge].openPanelId = undefined;
          }

          // Capture the live sizes before discarding Dockview's hidden popout
          // reference. That reference occupies the normal auxiliary group id
          // until it is removed.
          const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(
            api,
            auxiliary,
          );
          // The hidden popout reference may already have collapsed to its
          // minimum width/height. Its transient measurement must not override
          // the valid size captured when the group was floated.
          if (origin.dockedSize !== undefined) {
            preservedDockedSizes[originEdge] = origin.dockedSize;
          }

          // Keep the source group alive until cleanup so Dockview cannot
          // auto-return an empty group to the grid as a splitter.
          for (const p of [...group.panels]) {
            try {
              removePanelKeepingSourceGroup(api, p);
            } catch {
              // Panel may already be detached.
            }
          }

          // Remove the empty popout and its hidden source reference before
          // recreating the edge. Otherwise Dockview assigns the replacement a
          // generated id and leaves the original edge group as a blank split.
          cleanupEmptyFloatingGroup(api, group, popoutWindow, {
            removeAssociatedReference: true,
          });

          // Rebuild the auxiliary layout. Since we already closed the popout
          // panels above, clearLiveAuxiliaryPanels in applyAuxiliaryLayout will
          // skip them (they no longer exist in api.getPanel).
          const applied = applyAuxiliaryLayout(api, nextAuxiliary, {
            preserveDockedSizes: preservedDockedSizes,
          });

          set({
            auxiliary: syncAuxiliaryLayoutFromApi(api, applied),
            floatingOrigins: removeFloatingOriginMap(floatingOrigins, groupId),
          });
          return;
        }
      }

      // Editor panels or auxiliary panels without a matching origin instance:
      // move back to the grid. Prefer the original live group when a single
      // panel was floated out of a still-docked group; otherwise fall back to an
      // existing editor group or a fresh group.
      const targetGroup = findEditorDockTargetGroup(api, group, origin);
      let targetIndex = Number.isFinite(origin?.originIndex)
        ? Math.max(0, Math.min(origin!.originIndex!, targetGroup.panels.length))
        : targetGroup.panels.length;

      for (const id of orderedPanelIds) {
        const candidate = api.getPanel(id);
        if (!candidate) continue;
        movePanelKeepingSourceGroup(
          api,
          group,
          candidate,
          targetGroup,
          targetIndex,
        );
        targetIndex += 1;
      }

      // Remove the now-empty source group.
      cleanupEmptyFloatingGroup(api, group, popoutWindow);

      const targetActiveId = origin?.originActivePanelId ?? orderedPanelIds[0];
      const activePanel = api.getPanel(targetActiveId);
      if (activePanel) {
        activePanel.api.setActive();
      }

      set({
        floatingOrigins: removeFloatingOriginMap(floatingOrigins, groupId),
      });
    },

    newDocumentTabGroup: (panelId) => {
      const { api } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel || !isEditorPanel(panelId)) return;
      if (
        panel.group.api.location.type === 'popout' ||
        panel.group.panels.length <= 1
      ) {
        return;
      }

      const targetGroup = api.addGroup({
        referenceGroup: panel.group,
        direction: 'right',
      });
      panel.api.moveTo({ group: targetGroup, index: 0 });
      panel.api.setActive();
      targetGroup.focus();
    },

    collapseDocumentTabGroup: (panelId) => {
      const { api } = get();
      if (!api) return;

      const panel = api.getPanel(panelId);
      if (!panel || !isEditorPanel(panelId)) return;

      const sourceGroup = panel.group;
      if (sourceGroup.api.location.type === 'popout') return;

      const targetGroup = api.groups.find(
        (group) =>
          group.id !== sourceGroup.id &&
          group.api.location.type !== 'popout' &&
          group.panels.some((candidate) => isEditorPanel(candidate.id)),
      );
      if (!targetGroup) return;

      let targetIndex = targetGroup.panels.length;
      for (const candidate of [...sourceGroup.panels]) {
        if (!isEditorPanel(candidate.id)) {
          continue;
        }
        candidate.api.moveTo({ group: targetGroup, index: targetIndex });
        targetIndex += 1;
      }

      if (sourceGroup.panels.length === 0) {
        try {
          api.removeGroup(sourceGroup);
        } catch {
          /* already cleaned up */
        }
      }

      const activePanel = api.getPanel(panelId);
      if (activePanel) {
        activePanel.api.setActive();
        activePanel.group.focus();
      }
    },

    recordFloatingOrigin: (popoutGroupId, origin) => {
      set((state) => ({
        floatingOrigins: recordFloatingOriginMap(
          state.floatingOrigins,
          popoutGroupId,
          origin,
        ),
      }));
    },

    removeFloatingOrigin: (popoutGroupId) => {
      set((state) => ({
        floatingOrigins: removeFloatingOriginMap(
          state.floatingOrigins,
          popoutGroupId,
        ),
      }));
    },

    handleNativeMenuCommand: (command) => {
      switch (command.type) {
        case 'focus-panel':
          if (command.panelId === 'LibrariesTopComponent') {
            useUIStore.getState().setActivePanel('workspace');
          }
          get().openPanel(command.panelId);
          return;
        case 'close-floating-group':
          get().closeGroup(command.panelId);
          return;
        case 'reset-windows':
          get().resetLayout();
          return;
        case 'open-effects-library':
          useLibraryStore.getState().setTypeFilter('effect');
          useUIStore.getState().setActivePanel('workspace');
          get().openPanel('LibrariesTopComponent');
          return;
        case 'open-ftable-converter':
          window.dispatchEvent(new CustomEvent('blue-open-ftable-converter'));
          return;
        case 'open-csoundrc-editor':
          window.dispatchEvent(new CustomEvent('blue-open-csoundrc-editor'));
          return;
        case 'open-code-repository-editor':
          window.dispatchEvent(new CustomEvent('blue-open-code-repository-editor'));
          return;
        case 'open-midi-import':
          window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
          return;
        case 'toggle-follow-playback':
          usePlaybackStore.getState().toggleFollowPlayback();
          return;
        case 'toggle-follow-playback-on-render-start':
          usePlaybackStore.getState().toggleFollowPlaybackOnStart();
          return;
        case 'toggle-loop-rendering':
          useProjectStore
            .getState()
            .setLoopRendering(
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
        case 'render-stop-project':
          // Routes through the renderer toggle so pending patches are flushed,
          // the transport anchor is captured, and playback status flows back
          // through the existing playback-status broadcast.
          void usePlaybackStore.getState().togglePlay();
          return;
        case 'audition-score-objects': {
          const selection = useScoreSelectionStore.getState();
          if (!hasAuditionEligibleSelection(selection)) return;
          const objectIds = [...selection.selectedObjectIds];
          void usePlaybackStore.getState().auditionScoreObjects(objectIds);
          return;
        }
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
