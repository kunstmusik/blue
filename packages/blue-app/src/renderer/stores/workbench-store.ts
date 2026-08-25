import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  DockviewApi,
  DockviewGroupPanel,
  IDockviewPanel,
  SerializedDockview,
  SerializedPopoutGroup,
} from 'dockview';
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
  resizeAuxiliaryGroupLayout,
  restoreAuxiliaryGroupLayout,
  restoreClosedAuxiliaryPanel,
  revealAuxiliaryPanel,
  syncAuxiliaryLayoutFromApi,
  toggleMinimizedAuxiliaryPanel,
  transitionAuxiliaryLayout,
  type AuxiliaryEdge,
  type AuxiliaryGroupSizeAction,
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
import { libraryEditorPanelId, libraryEditorSessionIdFromPanel } from './library-editor-store';
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
  loadLayout: (json: string | null, workAreas?: DisplayWorkArea[]) => Promise<void>;
  syncAuxiliaryLayout: () => void;
  minimizeAuxiliaryGroup: (groupInstanceId: string) => void;
  maximizeAuxiliaryGroup: (groupInstanceId: string) => void;
  restoreAuxiliaryGroup: (groupInstanceId: string) => void;
  dockAuxiliaryPanel: (panelId: string) => void;
  hideAuxiliarySlideout: (edge: AuxiliaryEdge) => void;
  hideAllAuxiliarySlideouts: () => void;
  resizeAuxiliarySlideout: (panelId: string, size: number) => void;
  resizeAuxiliaryGroup: (groupInstanceId: string, action: AuxiliaryGroupSizeAction) => void;
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
      group.panels.some((panel) => isEditorPanel(panel.id)),
  );
}

export function findLibraryEditorPanelsToClose(
  api: Pick<DockviewApi, 'panels'>,
  keepPanelId: string | null,
): IDockviewPanel[] {
  return api.panels.filter(
    (panel) => panel.id !== keepPanelId && libraryEditorSessionIdFromPanel(panel.id) !== null,
  );
}

export function hasRestoredStartupEditorPanel(api: Pick<DockviewApi, 'getPanel'>): boolean {
  return getDefaultEditorPanels().some((descriptor) => api.getPanel(descriptor.id) !== undefined);
}

/** Compact "which panels are where" summary for restore diagnostics. */
function describePopoutAssignment(api: Pick<DockviewApi, 'groups'>): {
  popoutPanelIds: string[];
  gridPanelIds: string[];
} {
  const popoutPanelIds: string[] = [];
  const gridPanelIds: string[] = [];
  for (const group of api.groups) {
    const destination =
      group.api.location.type === 'popout' ? popoutPanelIds : gridPanelIds;
    for (const panel of group.panels) destination.push(panel.id);
  }
  return { popoutPanelIds: popoutPanelIds.sort(), gridPanelIds: gridPanelIds.sort() };
}

/**
 * Panel ids that the serialized snapshot placed in popout groups.
 *
 * Tolerant collector: dockview's serialized group shape has shifted across
 * versions (`data.views`, `panels` record, `panels` array), so read all of
 * them rather than trusting one shape.
 */
export function collectExpectedPopoutPanelIds(dockview: unknown): Set<string> {
  const expected = new Set<string>();
  const popoutGroups = (dockview as { popoutGroups?: unknown } | null)?.popoutGroups;
  if (!Array.isArray(popoutGroups)) return expected;
  for (const entry of popoutGroups) {
    for (const id of collectSerializedGroupPanelIds(
      (entry as { data?: unknown } | null)?.data,
    )) expected.add(id);
  }
  return expected;
}

function collectSerializedGroupPanelIds(data: unknown): string[] {
  const group = data as { views?: unknown; panels?: unknown } | null;
  if (Array.isArray(group?.views)) {
    return group.views.filter((id): id is string => typeof id === 'string');
  }
  if (Array.isArray(group?.panels)) {
    return group.panels.filter((id): id is string => typeof id === 'string');
  }
  if (group?.panels && typeof group.panels === 'object') {
    return Object.keys(group.panels as Record<string, unknown>);
  }
  return [];
}

type SerializedGroupData = SerializedPopoutGroup['data'];
type SerializedGridNode = {
  type: 'leaf' | 'branch';
  data: SerializedGroupData | SerializedGridNode[];
  visible?: boolean;
};
type SerializedGridLeaf = SerializedGridNode & {
  type: 'leaf';
  data: SerializedGroupData;
};

export interface PreparedPopoutRestoreIntent {
  serializedGroupId: string;
  gridReferenceGroupId?: string;
  panelIds: string[];
  position: SerializedPopoutGroup['position'];
  url?: string;
}

function collectSerializedGridLeaves(
  node: SerializedGridNode,
  leaves: SerializedGridLeaf[] = [],
): SerializedGridLeaf[] {
  if (node.type === 'branch' && Array.isArray(node.data)) {
    for (const child of node.data) collectSerializedGridLeaves(child, leaves);
  } else if (node.type === 'leaf' && !Array.isArray(node.data)) {
    leaves.push(node as SerializedGridLeaf);
  }
  return leaves;
}

/**
 * Converts Dockview's asynchronous popout snapshot into a fully docked layout
 * plus explicit popout intents. Dockview 5.2 incorrectly resolves the saved
 * `gridReferenceGroup` through `getPanel()`, so using its fromJSON popout path
 * can move the complete editor group into a Score-only popout.
 */
export function prepareDockviewForExplicitPopoutRestore(
  dockview: SerializedDockview,
  floatingOrigins: Record<string, DockingOrigin>,
): { layout: SerializedDockview; intents: PreparedPopoutRestoreIntent[] } {
  const layout = JSON.parse(JSON.stringify(dockview)) as SerializedDockview;
  const serializedPopouts = layout.popoutGroups ?? [];
  delete layout.popoutGroups;

  const gridLeaves = collectSerializedGridLeaves(
    layout.grid.root as unknown as SerializedGridNode,
  );
  const gridGroups = gridLeaves.map((leaf) => leaf.data);
  const gridPanelIds = new Set(gridGroups.flatMap((group) => group.views));
  const intents = serializedPopouts.map((popout) => ({
    serializedGroupId: popout.data.id,
    ...(popout.gridReferenceGroup
      ? { gridReferenceGroupId: popout.gridReferenceGroup }
      : {}),
    panelIds: collectSerializedGroupPanelIds(popout.data),
    position: popout.position,
    ...(popout.url ? { url: popout.url } : {}),
  }));

  for (const intent of intents) {
    const origin = floatingOrigins[intent.serializedGroupId];
    const targetGroupId = origin?.originGroupId ?? intent.gridReferenceGroupId;
    const targetLeaf =
      gridLeaves.find((leaf) => leaf.data.id === targetGroupId) ??
      gridLeaves.find((leaf) =>
        leaf.data.views.some((id) => !isAuxiliaryPanelId(id)),
      ) ??
      gridLeaves[0];
    if (!targetLeaf) {
      throw new Error('Saved popout has no docked group to restore into');
    }
    const target = targetLeaf.data;

    const missingPanelIds = intent.panelIds.filter((id) => !gridPanelIds.has(id));
    const originIndex = origin?.originIndex;
    const insertAt = Number.isFinite(originIndex)
      ? Math.max(0, Math.min(originIndex!, target.views.length))
      : target.views.length;
    target.views.splice(insertAt, 0, ...missingPanelIds);
    for (const panelId of missingPanelIds) gridPanelIds.add(panelId);
    targetLeaf.visible = true;
    if (!target.activeView && target.views.length > 0) {
      target.activeView = target.views[0];
    }
  }

  return { layout, intents };
}

/** Recreates each prepared popout through Dockview's public, awaited API. */
export async function restorePreparedPopoutGroups(
  api: DockviewApi,
  intents: PreparedPopoutRestoreIntent[],
): Promise<Record<string, string>> {
  const restoredGroupIds: Record<string, string> = {};

  for (const intent of intents) {
    const panels = intent.panelIds.map((id) => api.getPanel(id));
    if (panels.some((panel) => !panel)) {
      throw new Error('Saved popout panel was not restored into the docked layout');
    }

    const restoredPanels = panels as IDockviewPanel[];
    const sourceGroup = restoredPanels[0]!.group as DockviewGroupPanel;
    if (restoredPanels.some((panel) => panel.group !== sourceGroup)) {
      throw new Error('Saved popout panels did not restore into one source group');
    }
    if (
      restoredPanels.length > 1 &&
      sourceGroup.panels.some((panel) => !intent.panelIds.includes(panel.id))
    ) {
      throw new Error('Saved float group contains panels outside its serialized intent');
    }

    const itemToPopout = restoredPanels.length === 1 ? restoredPanels[0]! : sourceGroup;
    const popoutGuard = createPopoutOpenGuard(api);
    let opened = false;
    try {
      opened = await api.addPopoutGroup(itemToPopout, {
        popoutUrl: intent.url ?? 'popout.html',
        position: intent.position ?? undefined,
        onDidOpen: popoutGuard.onDidOpen,
      });
    } finally {
      popoutGuard.complete(opened);
    }
    if (!opened) throw new Error('Saved popout window failed to open');

    const popoutGroup = api.getPanel(intent.panelIds[0]!)?.group as
      | DockviewGroupPanel
      | undefined;
    const actualPanelIds = popoutGroup?.panels.map((panel) => panel.id).sort() ?? [];
    if (
      popoutGroup?.api.location.type !== 'popout' ||
      actualPanelIds.join('\0') !== [...intent.panelIds].sort().join('\0')
    ) {
      throw new Error('Restored popout contents do not match the serialized intent');
    }
    restoredGroupIds[intent.serializedGroupId] = popoutGroup.id;
  }

  return restoredGroupIds;
}

function remapRestoredFloatingOrigins(
  origins: Record<string, DockingOrigin>,
  restoredGroupIds: Record<string, string>,
): Record<string, DockingOrigin> {
  const remapped = { ...origins };
  for (const [serializedGroupId, restoredGroupId] of Object.entries(
    restoredGroupIds,
  )) {
    const origin = remapped[serializedGroupId];
    if (!origin || serializedGroupId === restoredGroupId) continue;
    remapped[restoredGroupId] = origin;
    delete remapped[serializedGroupId];
  }
  return remapped;
}

/**
 * Restore-intent enforcement: after dockview's async popout restoration, a
 * popout group must contain only panels the snapshot serialized as popped
 * out. Anything else (mis-assigned by a stale or partially corrupted
 * snapshot) is moved back to the first non-popout group so the main window
 * regains its docked editors. Idempotent; safe to run multiple times.
 */
export function enforcePopoutPanelIntent(
  api: Pick<DockviewApi, 'groups'>,
  expectedPopoutPanelIds: ReadonlySet<string>,
): void {
  const target = api.groups.find((group) => group.api.location.type !== 'popout');
  for (const group of [...api.groups]) {
    if (group.api.location.type !== 'popout') continue;
    for (const panel of [...group.panels]) {
      if (expectedPopoutPanelIds.has(panel.id)) continue;
      if (!target || target === group) continue;
      try {
        panel.api.moveTo({ group: target });
      } catch {
        // Dockview may refuse a move if the group is already tearing down.
      }
    }
  }
}

/**
 * Clears the dockview grid without choking on popout groups.
 *
 * A popout group's grid element lives in the popout window's document, so a
 * plain `api.clear()` can throw "Invalid grid element" for it (e.g., a
 * restored-but-unhydrated popout). Closing the popout group through its own
 * group api first routes removal through dockview's window-close path, which
 * disposes the window and detaches the grid element correctly. Any group that
 * still refuses removal is skipped rather than blocking layout recovery.
 */
export function clearDockviewSafely(api: Pick<DockviewApi, 'groups' | 'clear' | 'removeGroup'>): void {
  for (const group of [...api.groups]) {
    if (group.api.location.type === 'popout') {
      try {
        group.api.close();
      } catch {
        // Best effort: the window-close path may already be tearing down.
      }
    }
  }
  try {
    api.clear();
  } catch {
    for (const group of [...api.groups]) {
      try {
        api.removeGroup(group);
      } catch {
        // Unrecoverable grid element; leave it for dockview's own cleanup.
      }
    }
  }
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

  return auxiliary.slideouts[instance.edge].openPanelId === panelId ? 'slideout' : 'minimized';
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
        Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'above' : 'below';
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

  const originIndex = sourceGroup.panels.findIndex((panel) => panel.id === panelId);
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
  const originGroup = origin?.originGroupId ? api.getGroup(origin.originGroupId) : undefined;
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
  return existingEditorGroups.length > 0 ? existingEditorGroups[0]! : api.addGroup();
}

function getPopoutWindow(group: DockviewGroupPanel): Window | undefined {
  try {
    const location = group.api.location;
    return location.type === 'popout' ? (location.getWindow() ?? undefined) : undefined;
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
      ...(options.removeAssociatedReference ? {} : { skipPopoutAssociated: true }),
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

function removePanelKeepingSourceGroup(api: DockviewApi, panel: IDockviewPanel): void {
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
      const PopoutEvent = (popoutWindow as Window & { Event: typeof Event }).Event;
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

export function createPopoutOpenGuard(api: DockviewApi): PopoutOpenGuard {
  let popoutWindow: Window | undefined;
  let completed = false;
  let reloadTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
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

      const reloadAfterNavigation = () => {
        if (completed || openedWindow.closed || hasDockviewContainer()) {
          return;
        }

        try {
          // Electron initially exposes an about:blank proxy while navigation
          // to popout.html is still being attached. Reloading that proxy can
          // cancel the real navigation and leave Dockview waiting forever.
          if (!/popout\.html$/.test(openedWindow.location.pathname)) {
            reloadTimer = globalThis.setTimeout(reloadAfterNavigation, 50);
          } else if (openedWindow.document.readyState !== 'loading') {
            openedWindow.location.reload();
          }
        } catch {
          // If the window handle is no longer usable, the timeout below will
          // close it or no-op.
        }
      };
      reloadTimer = globalThis.setTimeout(reloadAfterNavigation, 50);

      closeTimer = globalThis.setTimeout(() => {
        if (!completed && !hasDockviewContainer()) {
          closePopoutWindow(popoutWindow);
          cleanupEmptyPopoutGroups(api);
        }
      }, 10_000);
    },
    complete: (opened) => {
      completed = true;
      if (reloadTimer !== undefined) {
        globalThis.clearTimeout(reloadTimer);
      }
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

// Incremented per loadLayout call so an asynchronous popout restore cannot
// publish state after a newer reset or restore has superseded it.
let workbenchLoadSequence = 0;

/** Lets React StrictMode dispose its first Dockview instance before hydration. */
export async function waitForCurrentWorkbenchApi(api: DockviewApi): Promise<boolean> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  return useWorkbenchStore.getState().api === api;
}

export const useWorkbenchStore = create<WorkbenchState & WorkbenchActions>()((set, get) => ({
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
      const nextAuxiliary = origin
        ? restoreClosedAuxiliaryPanel(api, auxiliary, panelId, origin)
        : revealAuxiliaryPanel(api, auxiliary, panelId);
      set({
        auxiliary: nextAuxiliary,
        ...(origin && getGroupInstanceForPanel(nextAuxiliary, panelId)
          ? {
              closedPanelOrigins: removeClosedPanelOrigin(closedPanelOrigins, panelId),
            }
          : {}),
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
        closedPanelOrigins: removeClosedPanelOrigin(closedPanelOrigins, panelId),
      });

      const originGroup = origin.originGroupId ? api.getGroup(origin.originGroupId) : undefined;
      if (originGroup && originGroup.api.location.type !== 'popout') {
        api.addPanel({
          id: panelId,
          component: 'default',
          title: descriptor.title,
          position: {
            referenceGroup: originGroup,
            direction: 'within',
            index: Number.isFinite(origin.originIndex)
              ? Math.max(0, Math.min(origin.originIndex!, originGroup.panels.length))
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
        targetGroup &&
        existing.group.id !== targetGroup.id &&
        existing.group.panels.some((panel) => isAuxiliaryPanelId(panel.id))
      ) {
        existing.api.moveTo({
          group: targetGroup,
          index: targetGroup.panels.length,
        });
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

    const wasOpen = Boolean(getGroupInstanceForPanel(auxiliary, panelId));

    const origin = captureClosedPanelOrigin({
      api,
      auxiliary,
      floatingOrigins,
      panelId,
    });
    const nextAuxiliary = closeAuxiliaryPanelLayout(api, auxiliary, panelId);
    set({
      auxiliary: nextAuxiliary,
      ...(wasOpen && !getGroupInstanceForPanel(nextAuxiliary, panelId) && origin
        ? {
            closedPanelOrigins: { ...closedPanelOrigins, [panelId]: origin },
          }
        : {}),
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

  loadLayout: async (json, workAreas) => {
    const { api } = get();
    if (!api) return;

    const loadToken = ++workbenchLoadSequence;
    clearDockviewSafely(api);
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
        const prepared = prepareDockviewForExplicitPopoutRestore(
          safeDockview,
          parsed.floatingOrigins ?? {},
        );
        const expectedPopoutPanelIds = new Set(
          prepared.intents.flatMap((intent) => intent.panelIds),
        );
        api.fromJSON(prepared.layout);

        let restoredFloatingOrigins = parsed.floatingOrigins ?? {};
        if (prepared.intents.length > 0) {
          try {
            const restoredGroupIds = await restorePreparedPopoutGroups(
              api,
              prepared.intents,
            );
            if (loadToken !== workbenchLoadSequence) return;
            restoredFloatingOrigins = remapRestoredFloatingOrigins(
              restoredFloatingOrigins,
              restoredGroupIds,
            );
          } catch (error) {
            if (loadToken !== workbenchLoadSequence) return;
            console.error(
              '[workbench-restore] popout failed; keeping panels docked',
              error,
            );
            clearDockviewSafely(api);
            api.fromJSON(prepared.layout);
            expectedPopoutPanelIds.clear();
            restoredFloatingOrigins = {};
          }
        }

        for (const candidate of findLibraryEditorPanelsToClose(api, null)) {
          api.removePanel(candidate);
        }
        for (const group of api.groups) {
          if (group.api.location.type === 'popout') {
            registerFloatingRendererWindow(group);
            refreshPopoutGroupLayout(group);
          }
        }
        cleanupEmptyPopoutGroups(api);

        // Dockview has finished attaching the restored windows. Enforce the
        // serialized assignment once at that real lifecycle boundary.
        const before = describePopoutAssignment(api);
        enforcePopoutPanelIntent(api, expectedPopoutPanelIds);
        cleanupEmptyPopoutGroups(api);
        const after = describePopoutAssignment(api);
        if (before.popoutPanelIds.join('\0') !== after.popoutPanelIds.join('\0')) {
          console.error(
            '[workbench-restore] corrected popout assignment',
            JSON.stringify({
              expectedPopoutPanelIds: [...expectedPopoutPanelIds].sort(),
              before,
              after,
              popoutGroups: (parsed.dockview as { popoutGroups?: unknown }).popoutGroups,
            }),
          );
        }

        // A persisted workbench without any primary editor is an incomplete
        // snapshot, not a usable user layout. This can occur when a prior
        // startup persisted Dockview before initial hydration completed.
        if (!hasRestoredStartupEditorPanel(api)) {
          clearDockviewSafely(api);
          set({
            auxiliary: buildDefaultWorkbenchLayout(api),
            floatingOrigins: {},
            closedPanelOrigins: {},
          });
          return;
        }

        set({
          auxiliary: applyAuxiliaryLayout(api, parsed.auxiliary),
          floatingOrigins: restoredFloatingOrigins,
          closedPanelOrigins: parsed.closedPanelOrigins ?? {},
        });
        return;
      } catch (error) {
        if (loadToken !== workbenchLoadSequence) return;
        console.error(
          '[workbench-restore] layout failed; resetting defaults',
          error instanceof Error ? (error.stack ?? error.message) : error,
        );
        clearDockviewSafely(api);
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

  resizeAuxiliaryGroup: (groupInstanceId, action) => {
    const { api, auxiliary } = get();
    if (!api) return;

    set({
      auxiliary: resizeAuxiliaryGroupLayout(api, auxiliary, groupInstanceId, action),
    });
  },

  moveAuxiliaryEdge: (sourceEdge, targetEdge, preservedDockedSizes) => {
    const { api, auxiliary } = get();
    if (!api) return;

    const desired = moveAuxiliaryEdgeLayout(auxiliary, sourceEdge, targetEdge);
    const nextPreservedDockedSizes =
      preservedDockedSizes ?? captureAuxiliaryDockedSizesFromApi(api, auxiliary);
    const result = transitionAuxiliaryLayout(api, auxiliary, desired, {
      preserveDockedSizes: nextPreservedDockedSizes,
    });
    if (result.status === 'applied') {
      set({ auxiliary: result.state });
      return;
    }
    if (result.status === 'failed') {
      toast.error('Panel move failed; the previous layout was kept.');
    }
  },

  getAuxiliaryGroupForPanel: (panelId) => {
    const state = get();
    const instance = state.auxiliary.groups.find((g) => g.panelIds.includes(panelId));
    return instance?.groupInstanceId;
  },

  moveGroupToEdge: (groupInstanceId, targetEdge) => {
    const { api, auxiliary } = get();
    if (!api) return;

    const desired = moveGroupToEdgeLayout(auxiliary, groupInstanceId, targetEdge);
    const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, auxiliary);
    const result = transitionAuxiliaryLayout(api, auxiliary, desired, {
      preserveDockedSizes: preservedDockedSizes,
    });
    if (result.status === 'applied') {
      set({ auxiliary: result.state });
      return;
    }
    if (result.status === 'failed') {
      toast.error('Panel move failed; the previous layout was kept.');
    }
  },

  movePanelToEdge: (panelId, targetEdge, preservedDockedSizes) => {
    const { api, auxiliary } = get();
    if (!api) return;

    const desired = movePanelToEdgeLayout(auxiliary, panelId, targetEdge);
    const nextPreservedDockedSizes =
      preservedDockedSizes ?? captureAuxiliaryDockedSizesFromApi(api, auxiliary);
    const result = transitionAuxiliaryLayout(api, auxiliary, desired, {
      preserveDockedSizes: nextPreservedDockedSizes,
    });
    if (result.status === 'applied') {
      set({ auxiliary: result.state });
      return;
    }
    if (result.status === 'failed') {
      toast.error('Panel move failed; the previous layout was kept.');
    }
  },

  mergeBackToSeededGroup: (groupInstanceId) => {
    const { api, auxiliary } = get();
    if (!api) return;

    const desired = mergeBackToSeededGroupLayout(auxiliary, groupInstanceId);
    const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, auxiliary);
    const result = transitionAuxiliaryLayout(api, auxiliary, desired, {
      preserveDockedSizes: preservedDockedSizes,
    });
    if (result.status === 'applied') {
      set({ auxiliary: result.state });
      return;
    }
    if (result.status === 'failed') {
      toast.error('Panel move failed; the previous layout was kept.');
    }
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
          floatingOrigins: recordFloatingOriginMap(state.floatingOrigins, popoutGroup.id, origin),
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
    if (panelIds.length === 0 || panelIds.some((id) => !isPanelFloatable(id))) {
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
          floatingOrigins: recordFloatingOriginMap(state.floatingOrigins, popoutGroup.id, origin),
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
    const knownPanelIds = new Set(PANEL_REGISTRY.map((descriptor) => descriptor.id));
    const resolution = resolveDockTarget(floatingOrigins, groupId, knownPanelIds);
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
          originPanelOrder: origin.originPanelOrder.filter((id) => id !== panelId),
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

    const knownPanelIds = new Set(PANEL_REGISTRY.map((descriptor) => descriptor.id));
    const resolution = resolveDockTarget(floatingOrigins, groupId, knownPanelIds);

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
        targetInstance.activePanelId = origin.originActivePanelId ?? orderedPanelIds[0];
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
          orderedPanelIds.includes(nextAuxiliary.slideouts[originEdge].openPanelId!)
        ) {
          nextAuxiliary.slideouts[originEdge].openPanelId = undefined;
        }

        // Capture the live sizes before discarding Dockview's hidden popout
        // reference. That reference occupies the normal auxiliary group id
        // until it is removed.
        const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, auxiliary);
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

        // Re-dock through the targeted transition: the popout panels were
        // removed above, so they are re-added while every unaffected panel
        // keeps its live object. A failure keeps the last valid layout.
        const result = transitionAuxiliaryLayout(api, auxiliary, nextAuxiliary, {
          preserveDockedSizes: preservedDockedSizes,
        });

        set({
          auxiliary:
            result.status === 'applied'
              ? result.state
              : cloneAuxiliaryLayoutState(auxiliary),
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
      movePanelKeepingSourceGroup(api, group, candidate, targetGroup, targetIndex);
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
    if (panel.group.api.location.type === 'popout' || panel.group.panels.length <= 1) {
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
      floatingOrigins: recordFloatingOriginMap(state.floatingOrigins, popoutGroupId, origin),
    }));
  },

  removeFloatingOrigin: (popoutGroupId) => {
    set((state) => ({
      floatingOrigins: removeFloatingOriginMap(state.floatingOrigins, popoutGroupId),
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
      // Main resolved the value and already persisted it; apply without a
      // second toggle or a second settings write.
      case 'set-follow-playback':
        usePlaybackStore.getState().applyResolvedFollowPlayback(command.enabled);
        return;
      case 'set-follow-playback-on-render-start':
        usePlaybackStore.getState().applyResolvedFollowPlaybackOnStart(command.enabled);
        return;
      case 'toggle-loop-rendering':
        useProjectStore
          .getState()
          .setLoopRendering(!useProjectStore.getState().transport.loopRendering);
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
      case 'edit-tempo-map':
        window.dispatchEvent(new CustomEvent('blue-edit-tempo-map'));
        return;
      case 'edit-meter-map':
        window.dispatchEvent(new CustomEvent('blue-edit-meter-map'));
        return;
    }
  },
}));
