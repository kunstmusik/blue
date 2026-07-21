import type {
  DockviewApi,
  DockviewGroupPanel,
  IDockviewPanel,
  SerializedDockview,
} from 'dockview';
import {
  PANEL_REGISTRY,
  getDefaultEditorPanels,
  getPanel,
  type PanelMode,
} from './panel-registry';
import {
  normalizeFloatingOriginMap,
  type DockingOrigin,
} from '../../../shared/workbench-window-contract';

export type AuxiliaryEdge = 'left' | 'right' | 'bottom';
type AuxiliaryPanelMode = Extract<PanelMode, 'properties' | 'output'>;
export type AuxiliarySeedGroupId = 'properties-main' | 'output-main';
export type AuxiliaryGroupKind = 'seeded' | 'derived-singleton';
export type AuxiliaryPanelPresentation =
  | 'docked'
  | 'minimized'
  | 'slideout'
  | 'maximized';

export interface AuxiliarySeedDefinition {
  seedGroupId: AuxiliarySeedGroupId;
  modeId: AuxiliaryPanelMode;
  defaultEdge: AuxiliaryEdge;
  panelIds: string[];
  defaultActivePanelId: string;
  defaultDockedSize: number;
  defaultSlideoutSize: number;
}

export interface AuxiliaryGroupInstance {
  groupInstanceId: string;
  seedGroupId: AuxiliarySeedGroupId;
  kind: AuxiliaryGroupKind;
  edge: AuxiliaryEdge;
  panelIds: string[];
  dockedPanelIds: string[];
  activePanelId: string;
  dockedSize: number;
  slideoutSize: number;
  isMaximized: boolean;
  displayOrder: number;
}

export interface AuxiliaryEdgeSlideoutState {
  edge: AuxiliaryEdge;
  openPanelId?: string;
}

export interface MinimizedTabState {
  groupInstanceId: string;
  panelId: string;
  edge: AuxiliaryEdge;
  order: number;
  isActivePanel: boolean;
}

export interface AuxiliarySlideoutView {
  edge: AuxiliaryEdge;
  groupInstanceId: string;
  panelId: string;
  size: number;
}

export type AuxiliaryDockedSizeSnapshot = Record<AuxiliaryEdge, number>;

interface ApplyAuxiliaryLayoutOptions {
  preserveDockedSizes?: AuxiliaryDockedSizeSnapshot;
  debugLabel?: string;
  debugMeta?: Record<string, unknown>;
  debugState?: AuxiliaryLayoutState;
}

export interface AuxiliaryLayoutState {
  version: 5;
  groups: AuxiliaryGroupInstance[];
  slideouts: Record<AuxiliaryEdge, AuxiliaryEdgeSlideoutState>;
}

export interface StoredWorkbenchLayout {
  version: 7;
  dockview: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
  /**
   * Supplemental Blue-specific dock-back metadata keyed by Dockview popout
   * group id. Added in envelope version 6 (SPEC 055). Absent on layouts
   * migrated from version <= 5.
   */
  floatingOrigins?: Record<string, DockingOrigin>;
  /**
   * Panel-level placement captured by Close. This lets the Window menu reopen
   * a TopComponent in its prior auxiliary mode/edge rather than its default.
   */
  closedPanelOrigins?: Record<string, DockingOrigin>;
  updatedAt?: string;
}

/**
 * Legacy version-6 envelope shape (no closed-panel restore metadata). Kept so
 * older saved layouts can be detected and migrated to version 7.
 */
interface LegacyStoredWorkbenchLayoutV6 {
  version: 6;
  dockview: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
  floatingOrigins?: Record<string, DockingOrigin>;
}

/** Legacy version-5 envelope shape (no origin metadata). */
interface LegacyStoredWorkbenchLayoutV5 {
  version: 5;
  dockview: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
}

interface LegacyAuxiliaryEdgeStateV2 {
  panelIds: string[];
  activePanelId: string;
  size?: number;
}

interface LegacyAuxiliaryLayoutStateV2 {
  byEdge?: Partial<Record<'right' | 'bottom', LegacyAuxiliaryEdgeStateV2>>;
}

interface LegacyStoredWorkbenchLayoutV2 {
  version: 2;
  dockview: SerializedDockview;
  auxiliary: LegacyAuxiliaryLayoutStateV2;
}

interface LegacyFloatingBounds {
  width?: number;
  height?: number;
}

interface LegacyAuxiliaryGroupSessionV3 {
  panelIds?: string[];
  activePanelId?: string;
  presentation?: 'docked' | 'minimized' | 'floating' | 'maximized';
  dockedSize?: number;
  floatingBounds?: LegacyFloatingBounds;
}

interface LegacyAuxiliaryLayoutStateV3 {
  version: 3;
  groups: Partial<Record<AuxiliarySeedGroupId, LegacyAuxiliaryGroupSessionV3>>;
}

interface LegacyStoredWorkbenchLayoutV3 {
  version: 3;
  dockview: SerializedDockview;
  auxiliary: LegacyAuxiliaryLayoutStateV3;
}

interface LegacyAuxiliaryGroupSessionV4 {
  id: AuxiliarySeedGroupId;
  edge: AuxiliaryEdge;
  mode: AuxiliaryPanelMode;
  panelIds: string[];
  dockedPanelIds: string[];
  activePanelId: string;
  dockedSize: number;
  slideoutSize: number;
  isMaximized: boolean;
}

interface LegacyAuxiliaryLayoutStateV4 {
  version: 4;
  groups: Record<AuxiliarySeedGroupId, LegacyAuxiliaryGroupSessionV4>;
  slideouts: Record<AuxiliaryEdge, AuxiliaryEdgeSlideoutState>;
}

interface LegacyStoredWorkbenchLayoutV4 {
  version: 4;
  dockview: SerializedDockview;
  auxiliary: LegacyAuxiliaryLayoutStateV4;
}

const AUXILIARY_SEED_ORDER: AuxiliarySeedGroupId[] = [
  'properties-main',
  'output-main',
];

const AUXILIARY_EDGE_ORDER: AuxiliaryEdge[] = ['left', 'right', 'bottom'];

const AUXILIARY_SEED_DEFINITIONS: Record<
  AuxiliarySeedGroupId,
  AuxiliarySeedDefinition
> = {
  'properties-main': {
    seedGroupId: 'properties-main',
    modeId: 'properties',
    defaultEdge: 'right',
    panelIds: [
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ],
    defaultActivePanelId: 'SoundObjectPropertiesTopComponent',
    // 200px controlled-pane default mirrors Java Blue's
    // `setDividerLocation(200)` split-pane defaults (see SPEC 054 research.md).
    defaultDockedSize: 200,
    defaultSlideoutSize: 200,
  },
  'output-main': {
    seedGroupId: 'output-main',
    modeId: 'output',
    defaultEdge: 'bottom',
    panelIds: [
      'ScoreObjectEditorTopComponent',
      'MixerTopComponent',
      'BlueFileManagerTopComponent',
      'VirtualKeyboardTopComponent',
      'OutputTopComponent',
      'JavaScriptConsoleTopComponent',
      'JythonConsoleTopComponent',
      'ClojureConsoleTopComponent',
    ],
    defaultActivePanelId: 'OutputTopComponent',
    // 200px controlled-pane default mirrors Java Blue's
    // `setDividerLocation(200)` split-pane defaults (see SPEC 054 research.md).
    defaultDockedSize: 200,
    defaultSlideoutSize: 200,
  },
};

export function getAuxiliarySeedDefinition(
  seedGroupId: AuxiliarySeedGroupId,
): AuxiliarySeedDefinition {
  return AUXILIARY_SEED_DEFINITIONS[seedGroupId];
}

export function getAuxiliaryRailLabel(panelId: string): string {
  const descriptor = getPanel(panelId);
  return descriptor?.auxiliaryRailLabel ?? descriptor?.title ?? panelId;
}

export function getAuxiliarySeedGroupIdForPanel(
  panelId: string,
): AuxiliarySeedGroupId | undefined {
  const descriptor = getPanel(panelId);
  if (descriptor?.auxiliaryGroupId) {
    return descriptor.auxiliaryGroupId;
  }

  return AUXILIARY_SEED_ORDER.find((seedId) =>
    AUXILIARY_SEED_DEFINITIONS[seedId].panelIds.includes(panelId),
  );
}

export function getAuxiliaryGroupIdForPanel(
  panelId: string,
): AuxiliarySeedGroupId | undefined {
  return getAuxiliarySeedGroupIdForPanel(panelId);
}

export function getGroupInstanceForPanel(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find((inst) => inst.panelIds.includes(panelId));
}

export function isAuxiliaryPanelId(panelId: string): boolean {
  return getAuxiliarySeedGroupIdForPanel(panelId) !== undefined;
}

function getDefaultDockedSizeForEdge(edge: AuxiliaryEdge): number {
  return edge === 'bottom'
    ? AUXILIARY_SEED_DEFINITIONS['output-main'].defaultDockedSize
    : AUXILIARY_SEED_DEFINITIONS['properties-main'].defaultDockedSize;
}

function getDockedSizeForEdge(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): number {
  const representative = getInstancesOnEdge(state, edge).find(
    (instance) => instance.dockedPanelIds.length > 0,
  );

  return representative && Number.isFinite(representative.dockedSize)
    ? representative.dockedSize
    : getDefaultDockedSizeForEdge(edge);
}

export function captureAuxiliaryDockedSizes(
  state: AuxiliaryLayoutState,
): AuxiliaryDockedSizeSnapshot {
  return {
    left: getDockedSizeForEdge(state, 'left'),
    right: getDockedSizeForEdge(state, 'right'),
    bottom: getDockedSizeForEdge(state, 'bottom'),
  };
}

export function captureAuxiliaryDockedSizesFromApi(
  api: DockviewApi,
  fallbackState?: AuxiliaryLayoutState,
): AuxiliaryDockedSizeSnapshot {
  const fallbackSizes = fallbackState
    ? captureAuxiliaryDockedSizes(fallbackState)
    : {
        left: getDefaultDockedSizeForEdge('left'),
        right: getDefaultDockedSizeForEdge('right'),
        bottom: getDefaultDockedSizeForEdge('bottom'),
      };

  return {
    left: getLiveDockedSizeForEdge(api, 'left', fallbackSizes.left),
    right: getLiveDockedSizeForEdge(api, 'right', fallbackSizes.right),
    bottom: getLiveDockedSizeForEdge(api, 'bottom', fallbackSizes.bottom),
  };
}

function shouldLogAuxiliaryDockedSizeDebug(): boolean {
  return !(typeof process !== 'undefined' && Boolean(process.env?.VITEST));
}

function getAuxiliaryDockedSizeDebugLiveState(api: DockviewApi) {
  return {
    left: getLiveAuxiliaryEdgeDebugEntry(api, 'left'),
    right: getLiveAuxiliaryEdgeDebugEntry(api, 'right'),
    bottom: getLiveAuxiliaryEdgeDebugEntry(api, 'bottom'),
  };
}

function getLiveAuxiliaryEdgeDebugEntry(api: DockviewApi, edge: AuxiliaryEdge) {
  const group = getLiveAuxiliaryEdgeGroup(api, edge);
  const element = getLiveAuxiliaryGroupElement(group);
  const rect = element?.getBoundingClientRect();
  return {
    exists: Boolean(group),
    size: group?.size,
    renderedSize: getRenderedDockedSizeForGroup(group, edge),
    boundsWidth: rect?.width,
    boundsHeight: rect?.height,
    panels: group?.panels.map((panel) => panel.id) ?? [],
    activePanelId: group?.activePanel?.id,
    isMaximized: group?.api.isMaximized() ?? false,
  };
}

export function logAuxiliaryDockedSizeDebug(
  context: string,
  api: DockviewApi,
  options?: {
    snapshot?: AuxiliaryDockedSizeSnapshot;
    state?: AuxiliaryLayoutState;
    meta?: Record<string, unknown>;
  },
) {
  if (!shouldLogAuxiliaryDockedSizeDebug()) {
    return;
  }

  console.info('[AuxLayoutDebug]', context, {
    snapshot: options?.snapshot,
    stateSizes: options?.state
      ? captureAuxiliaryDockedSizes(options.state)
      : undefined,
    live: getAuxiliaryDockedSizeDebugLiveState(api),
    ...(options?.meta ?? {}),
  });
}

function getLiveAuxiliaryEdgeGroup(
  api: DockviewApi,
  edge: AuxiliaryEdge,
): DockviewGroupPanel | undefined {
  return api.groups.find(
    (group) => group.id === getDockviewGroupIdForEdge(edge),
  );
}

function getLiveAuxiliaryGroupElement(
  group: DockviewGroupPanel | undefined,
): HTMLElement | undefined {
  return (group as (DockviewGroupPanel & { element?: HTMLElement }) | undefined)
    ?.element;
}

function getRenderedDockedSizeForGroup(
  group: DockviewGroupPanel | undefined,
  edge: AuxiliaryEdge,
): number | undefined {
  const rect = getLiveAuxiliaryGroupElement(group)?.getBoundingClientRect();
  if (!rect) {
    return undefined;
  }

  const size = edge === 'bottom' ? rect.height : rect.width;
  return Number.isFinite(size) && size > 0 ? size : undefined;
}

function getLiveDockedSizeForEdge(
  api: DockviewApi,
  edge: AuxiliaryEdge,
  fallbackSize: number,
): number {
  const group = getLiveAuxiliaryEdgeGroup(api, edge);
  if (!group || group.api.isMaximized()) {
    return fallbackSize;
  }

  const renderedSize = getRenderedDockedSizeForGroup(group, edge);
  if (renderedSize !== undefined && Number.isFinite(renderedSize)) {
    return renderedSize;
  }

  return Number.isFinite(group.size) ? group.size : fallbackSize;
}

function restoreAuxiliaryDockedSizes(
  api: DockviewApi,
  sizes: AuxiliaryDockedSizeSnapshot,
) {
  for (const edge of AUXILIARY_EDGE_ORDER) {
    const size = sizes[edge];
    if (!Number.isFinite(size)) {
      continue;
    }

    const group = getLiveAuxiliaryEdgeGroup(api, edge);
    if (!group || group.api.isMaximized()) {
      continue;
    }

    if (edge === 'bottom') {
      group.api.setSize({ height: size });
    } else {
      group.api.setSize({ width: size });
    }
  }
}

function scheduleAuxiliaryDockedSizeRestore(
  api: DockviewApi,
  sizes: AuxiliaryDockedSizeSnapshot,
  debugLabel?: string,
  debugState?: AuxiliaryLayoutState,
  debugMeta?: Record<string, unknown>,
) {
  const requestFrame = globalThis.requestAnimationFrame;
  if (typeof requestFrame !== 'function') {
    return;
  }

  requestFrame(() => {
    if (debugLabel) {
      logAuxiliaryDockedSizeDebug(
        `${debugLabel}: before deferred restore`,
        api,
        {
          snapshot: sizes,
          state: debugState,
          meta: debugMeta,
        },
      );
    }
    restoreAuxiliaryDockedSizes(api, sizes);
    if (debugLabel) {
      logAuxiliaryDockedSizeDebug(
        `${debugLabel}: after deferred restore`,
        api,
        {
          snapshot: sizes,
          state: debugState,
          meta: debugMeta,
        },
      );
    }
  });
}

function isAuxiliaryDockviewGroupId(groupId: string | undefined): boolean {
  return typeof groupId === 'string' && groupId.startsWith('blue-aux-edge-');
}

export function shouldPreventAuxiliaryPanelDrop(
  panelId: string | null | undefined,
  targetGroupId: string | undefined,
  dropKind: 'tab' | 'header_space' | 'content' | 'edge',
): boolean {
  if (!panelId || !isAuxiliaryPanelId(panelId)) {
    return false;
  }

  if (dropKind === 'edge') {
    return false;
  }

  return !isAuxiliaryDockviewGroupId(targetGroupId);
}

export function getAuxiliaryPanelPresentation(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryPanelPresentation | undefined {
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return undefined;
  }

  if (instance.isMaximized && instance.dockedPanelIds.includes(panelId)) {
    return 'maximized';
  }

  if (instance.dockedPanelIds.includes(panelId)) {
    return 'docked';
  }

  return state.slideouts[instance.edge].openPanelId === panelId
    ? 'slideout'
    : 'minimized';
}

export function getMinimizedTabsForEdge(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): MinimizedTabState[] {
  const tabs: MinimizedTabState[] = [];
  const activePanelId = state.slideouts[edge].openPanelId;

  const instancesOnEdge = state.groups
    .filter((inst) => inst.edge === edge)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const instance of instancesOnEdge) {
    instance.panelIds.forEach((panelId, order) => {
      if (instance.dockedPanelIds.includes(panelId)) {
        return;
      }

      tabs.push({
        groupInstanceId: instance.groupInstanceId,
        panelId,
        edge,
        order,
        isActivePanel: activePanelId === panelId,
      });
    });
  }

  return tabs;
}

function getInstancesOnEdge(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): AuxiliaryGroupInstance[] {
  return state.groups
    .filter((inst) => inst.edge === edge)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getAuxiliarySlideoutForEdge(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): AuxiliarySlideoutView | undefined {
  const openPanelId = state.slideouts[edge].openPanelId;
  if (!openPanelId) {
    return undefined;
  }

  const instance = getGroupInstanceForPanel(state, openPanelId);
  if (
    !instance ||
    instance.edge !== edge ||
    instance.dockedPanelIds.includes(openPanelId)
  ) {
    return undefined;
  }

  return {
    edge,
    groupInstanceId: instance.groupInstanceId,
    panelId: openPanelId,
    size: instance.slideoutSize,
  };
}

export function createDefaultAuxiliaryLayoutState(): AuxiliaryLayoutState {
  const groups = AUXILIARY_SEED_ORDER.map((seedId, index) =>
    createDefaultSeededInstance(seedId, index),
  );

  return {
    version: 5,
    groups,
    slideouts: createDefaultSlideouts(),
  };
}

export function cloneAuxiliaryLayoutState(
  state: AuxiliaryLayoutState,
): AuxiliaryLayoutState {
  return {
    version: 5,
    groups: state.groups.map((g) => ({
      ...g,
      panelIds: [...g.panelIds],
      dockedPanelIds: [...g.dockedPanelIds],
    })),
    slideouts: {
      left: { ...state.slideouts.left },
      right: { ...state.slideouts.right },
      bottom: { ...state.slideouts.bottom },
    },
  };
}

export function createStoredWorkbenchLayout(
  dockview: SerializedDockview,
  auxiliary: AuxiliaryLayoutState,
  options: {
    floatingOrigins?: Record<string, DockingOrigin>;
    closedPanelOrigins?: Record<string, DockingOrigin>;
    updatedAt?: string;
  } = {},
): StoredWorkbenchLayout {
  return {
    version: 7,
    dockview,
    auxiliary: cloneAuxiliaryLayoutState(auxiliary),
    ...(options.floatingOrigins &&
    Object.keys(options.floatingOrigins).length > 0
      ? { floatingOrigins: { ...options.floatingOrigins } }
      : {}),
    ...(options.closedPanelOrigins &&
    Object.keys(options.closedPanelOrigins).length > 0
      ? { closedPanelOrigins: { ...options.closedPanelOrigins } }
      : {}),
    ...(typeof options.updatedAt === 'string'
      ? { updatedAt: options.updatedAt }
      : {}),
  };
}

export function parseStoredWorkbenchLayout(serialized: string | null): {
  dockview?: SerializedDockview;
  auxiliary: AuxiliaryLayoutState;
  floatingOrigins?: Record<string, DockingOrigin>;
  closedPanelOrigins?: Record<string, DockingOrigin>;
} {
  const fallback = createDefaultAuxiliaryLayoutState();

  if (!serialized) {
    return { auxiliary: fallback };
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;

    if (isStoredWorkbenchLayoutV7(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(parsed.auxiliary),
        ...(parsed.floatingOrigins &&
        Object.keys(parsed.floatingOrigins).length > 0
          ? {
              floatingOrigins: normalizeFloatingOriginMap(
                parsed.floatingOrigins,
              ),
            }
          : {}),
        ...(parsed.closedPanelOrigins &&
        Object.keys(parsed.closedPanelOrigins).length > 0
          ? {
              closedPanelOrigins: normalizeFloatingOriginMap(
                parsed.closedPanelOrigins,
              ),
            }
          : {}),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV6(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(parsed.auxiliary),
        ...(parsed.floatingOrigins &&
        Object.keys(parsed.floatingOrigins).length > 0
          ? {
              floatingOrigins: normalizeFloatingOriginMap(
                parsed.floatingOrigins,
              ),
            }
          : {}),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV5(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(parsed.auxiliary),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV4(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(
          upgradeV4ToV5(parsed.auxiliary),
        ),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV3(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(
          upgradeV3ToV5(parsed.auxiliary),
        ),
      };
    }

    if (isLegacyStoredWorkbenchLayoutV2(parsed)) {
      return {
        dockview: parsed.dockview,
        auxiliary: normalizeAuxiliaryLayoutState(
          upgradeV2ToV5(parsed.auxiliary),
        ),
      };
    }

    if (isSerializedDockview(parsed)) {
      return {
        dockview: parsed,
        auxiliary: fallback,
      };
    }
  } catch {
    return { auxiliary: fallback };
  }

  return { auxiliary: fallback };
}

export function buildDefaultWorkbenchLayout(
  api: DockviewApi,
): AuxiliaryLayoutState {
  for (const descriptor of getDefaultEditorPanels()) {
    api.addPanel({
      id: descriptor.id,
      component: 'default',
      title: descriptor.title,
    });
  }

  return applyAuxiliaryLayout(api, createDefaultAuxiliaryLayoutState());
}

export function applyAuxiliaryLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  options?: ApplyAuxiliaryLayoutOptions,
): AuxiliaryLayoutState {
  const next = normalizeAuxiliaryLayoutState(state);
  const maximizeQueue: string[] = [];
  const dockedSizesToRestore =
    options?.preserveDockedSizes ?? captureAuxiliaryDockedSizes(next);

  if (options?.preserveDockedSizes) {
    logAuxiliaryDockedSizeDebug(
      `${options.debugLabel ?? 'applyAuxiliaryLayout'}: before rebuild`,
      api,
      {
        snapshot: options.preserveDockedSizes,
        state: options.debugState ?? state,
        meta: options.debugMeta,
      },
    );
  }

  const allPanelIds = next.groups.flatMap((inst) => inst.panelIds);
  clearLiveAuxiliaryPanels(api, allPanelIds);

  for (const edge of AUXILIARY_EDGE_ORDER) {
    createDockedPresentationForEdge(api, next, edge);
  }

  for (const instance of next.groups) {
    if (instance.isMaximized && instance.dockedPanelIds.length > 0) {
      maximizeQueue.push(instance.groupInstanceId);
    }
  }

  for (const instanceId of maximizeQueue) {
    const instance = next.groups.find((g) => g.groupInstanceId === instanceId);
    if (!instance) continue;

    const activeDockedPanelId = getActiveDockedPanelId(instance);
    if (!activeDockedPanelId) continue;

    focusDockviewPanel(api, activeDockedPanelId);
    api.getPanel(activeDockedPanelId)?.api.maximize();
  }

  if (options?.preserveDockedSizes) {
    logAuxiliaryDockedSizeDebug(
      `${options.debugLabel ?? 'applyAuxiliaryLayout'}: before immediate restore`,
      api,
      {
        snapshot: options.preserveDockedSizes,
        state: options.debugState ?? state,
        meta: options.debugMeta,
      },
    );
  }

  // Dockview 5.2 can ignore initialWidth/initialHeight when inserting an
  // auxiliary group beside a nested grid, falling back to an equal split.
  // Reapply the canonical pixel sizes after every rebuild, including startup.
  restoreAuxiliaryDockedSizes(api, dockedSizesToRestore);

  if (options?.preserveDockedSizes) {
    logAuxiliaryDockedSizeDebug(
      `${options.debugLabel ?? 'applyAuxiliaryLayout'}: after immediate restore`,
      api,
      {
        snapshot: options.preserveDockedSizes,
        state: options.debugState ?? state,
        meta: options.debugMeta,
      },
    );
  }

  scheduleAuxiliaryDockedSizeRestore(
    api,
    dockedSizesToRestore,
    options?.debugLabel,
    options?.debugState ?? state,
    options?.debugMeta,
  );

  syncDockviewPanelTitles(api);

  return syncAuxiliaryLayoutFromApi(api, next);
}

export function revealAuxiliaryPanel(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  let instance = getGroupInstanceForPanel(state, panelId);

  if (!instance) {
    const seedId = getAuxiliarySeedGroupIdForPanel(panelId);
    if (!seedId) {
      return cloneAuxiliaryLayoutState(state);
    }

    const next = cloneAuxiliaryLayoutState(state);
    const target = next.groups.find(
      (g) => g.kind === 'seeded' && g.seedGroupId === seedId,
    );
    if (!target) {
      return next;
    }

    target.panelIds = [...target.panelIds, panelId];
    if (!target.dockedPanelIds.includes(panelId)) {
      target.dockedPanelIds = [...target.dockedPanelIds, panelId];
    }
    target.activePanelId = panelId;

    const applied = applyAuxiliaryLayout(
      api,
      normalizeAuxiliaryLayoutState(next),
      {
        preserveDockedSizes: preservedDockedSizes,
        debugLabel: 'layout.revealAuxiliaryPanel.reseed',
        debugMeta: { panelId },
        debugState: state,
      },
    );
    focusDockviewPanel(api, panelId);
    return syncAuxiliaryLayoutFromApi(api, applied);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;
  target.activePanelId = panelId;

  if (target.dockedPanelIds.includes(panelId)) {
    next.slideouts[target.edge].openPanelId = undefined;

    if (!api.getPanel(panelId)) {
      const applied = applyAuxiliaryLayout(api, next, {
        preserveDockedSizes: preservedDockedSizes,
        debugLabel: 'layout.revealAuxiliaryPanel.remount',
        debugMeta: { panelId },
        debugState: state,
      });
      focusDockviewPanel(api, panelId);
      return syncAuxiliaryLayoutFromApi(api, applied);
    }

    focusDockviewPanel(api, panelId);
    return syncAuxiliaryLayoutFromApi(api, next);
  }

  next.slideouts[target.edge].openPanelId = panelId;
  return normalizeAuxiliaryLayoutState(next);
}

/**
 * Reinstates a panel removed with Close using the auxiliary presentation that
 * existed at close time. This is deliberately separate from `reveal...`,
 * whose job is to place a previously unseen Window-menu item in its default
 * Java Blue seed group.
 */
export function restoreClosedAuxiliaryPanel(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  panelId: string,
  origin: DockingOrigin,
): AuxiliaryLayoutState {
  const seedGroupId =
    origin.auxiliarySeedGroupId ?? getAuxiliarySeedGroupIdForPanel(panelId);
  if (!seedGroupId) {
    return revealAuxiliaryPanel(api, state, panelId);
  }

  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const requestedInstanceId = origin.auxiliaryGroupInstanceId;
  let target = requestedInstanceId
    ? next.groups.find((group) => group.groupInstanceId === requestedInstanceId)
    : undefined;

  if (!target && requestedInstanceId?.startsWith('derived:')) {
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedGroupId];
    const maxOrder = next.groups.reduce(
      (max, group) => Math.max(max, group.displayOrder),
      -1,
    );
    target = {
      groupInstanceId: requestedInstanceId,
      seedGroupId,
      kind: 'derived-singleton',
      edge: origin.edge ?? seedDef.defaultEdge,
      panelIds: [],
      dockedPanelIds: [],
      activePanelId: panelId,
      dockedSize: origin.dockedSize ?? seedDef.defaultDockedSize,
      slideoutSize: origin.slideoutSize ?? seedDef.defaultSlideoutSize,
      isMaximized: false,
      displayOrder: maxOrder + 1,
    };
    next.groups.push(target);
  }

  target ??= next.groups.find(
    (group) => group.kind === 'seeded' && group.seedGroupId === seedGroupId,
  );
  if (!target) {
    return revealAuxiliaryPanel(api, state, panelId);
  }

  if (origin.edge) {
    target.edge = origin.edge;
  }
  if (origin.dockedSize !== undefined) {
    target.dockedSize = origin.dockedSize;
  }
  if (origin.slideoutSize !== undefined) {
    target.slideoutSize = origin.slideoutSize;
  }

  target.panelIds =
    target.kind === 'seeded'
      ? sortPanelIdsBySeedOrder(target.seedGroupId, [
          ...target.panelIds,
          panelId,
        ])
      : [panelId];
  target.dockedPanelIds = target.dockedPanelIds.filter((id) => id !== panelId);
  target.activePanelId = panelId;
  target.isMaximized = false;

  for (const edge of AUXILIARY_EDGE_ORDER) {
    if (next.slideouts[edge].openPanelId === panelId) {
      next.slideouts[edge].openPanelId = undefined;
    }
  }

  if (origin.presentation === 'docked' || origin.presentation === 'maximized') {
    target.dockedPanelIds =
      target.kind === 'seeded'
        ? sortPanelIdsBySeedOrder(target.seedGroupId, [
            ...target.dockedPanelIds,
            panelId,
          ])
        : [panelId];
    target.isMaximized = origin.presentation === 'maximized';
  } else if (origin.presentation === 'slideout') {
    next.slideouts[target.edge].openPanelId = panelId;
  }

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.restoreClosedAuxiliaryPanel',
    debugMeta: { panelId, origin },
    debugState: state,
  });
  if (origin.presentation === 'docked' || origin.presentation === 'maximized') {
    focusDockviewPanel(api, panelId);
  }
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function toggleMinimizedAuxiliaryPanel(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;
  target.activePanelId = panelId;

  if (target.dockedPanelIds.includes(panelId)) {
    return normalizeAuxiliaryLayoutState(next);
  }

  next.slideouts[target.edge].openPanelId =
    next.slideouts[target.edge].openPanelId === panelId ? undefined : panelId;

  return normalizeAuxiliaryLayoutState(next);
}

export function hideAuxiliarySlideout(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  next.slideouts[edge].openPanelId = undefined;
  return normalizeAuxiliaryLayoutState(next);
}

export function hideAllAuxiliarySlideouts(
  state: AuxiliaryLayoutState,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));

  for (const edge of AUXILIARY_EDGE_ORDER) {
    next.slideouts[edge].openPanelId = undefined;
  }

  return normalizeAuxiliaryLayoutState(next);
}

export function dockAuxiliaryPanel(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;
  target.activePanelId = panelId;
  target.isMaximized = false;
  target.dockedPanelIds = sortPanelIdsBySeedOrder(target.seedGroupId, [
    ...target.dockedPanelIds,
    panelId,
  ]);
  next.slideouts[target.edge].openPanelId = undefined;

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.dockAuxiliaryPanel',
    debugMeta: { panelId },
    debugState: state,
  });
  focusDockviewPanel(api, panelId);
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function minimizeAuxiliaryPanelLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;

  if (!target.dockedPanelIds.includes(panelId)) {
    if (next.slideouts[target.edge].openPanelId === panelId) {
      next.slideouts[target.edge].openPanelId = undefined;
    }
    return normalizeAuxiliaryLayoutState(next);
  }

  target.dockedPanelIds = target.dockedPanelIds.filter((id) => id !== panelId);
  target.isMaximized = false;
  target.activePanelId = target.dockedPanelIds[0] ?? panelId;

  if (next.slideouts[target.edge].openPanelId === panelId) {
    next.slideouts[target.edge].openPanelId = undefined;
  }

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.minimizeAuxiliaryPanel',
    debugMeta: { panelId },
    debugState: state,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(
    getInstancesOnEdge(next, target.edge),
  );
  if (activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function closeAuxiliaryPanelLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;

  const seedDef = AUXILIARY_SEED_DEFINITIONS[target.seedGroupId];
  target.panelIds = target.panelIds.filter((id) => id !== panelId);
  target.dockedPanelIds = target.dockedPanelIds.filter((id) => id !== panelId);
  target.isMaximized = false;
  target.activePanelId = target.panelIds[0] ?? seedDef.defaultActivePanelId;

  if (next.slideouts[target.edge].openPanelId === panelId) {
    next.slideouts[target.edge].openPanelId = undefined;
  }

  api.getPanel(panelId)?.api.close();

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.closeAuxiliaryPanel',
    debugMeta: { panelId },
    debugState: state,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(
    getInstancesOnEdge(next, target.edge),
  );
  if (activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function resizeAuxiliarySlideout(
  state: AuxiliaryLayoutState,
  panelId: string,
  size: number,
): AuxiliaryLayoutState {
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find(
    (g) => g.groupInstanceId === instance.groupInstanceId,
  )!;
  target.slideoutSize = clampSlideoutSize(target.edge, size);
  return normalizeAuxiliaryLayoutState(next);
}

export function minimizeAuxiliaryGroupLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!target) return next;

  for (const instance of next.groups.filter((g) => g.edge === target.edge)) {
    instance.dockedPanelIds = [];
    instance.isMaximized = false;
  }

  next.slideouts[target.edge].openPanelId = undefined;

  return applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.minimizeAuxiliaryGroup',
    debugMeta: { groupInstanceId },
    debugState: state,
  });
}

export function maximizeAuxiliaryGroupLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!target) return next;

  target.dockedPanelIds = [...target.panelIds];
  target.isMaximized = true;
  next.slideouts[target.edge].openPanelId = undefined;

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.maximizeAuxiliaryGroup',
    debugMeta: { groupInstanceId },
    debugState: state,
  });
  const activeDockedPanelId = getActiveDockedPanelId(target);
  if (activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function restoreAuxiliaryGroupLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
): AuxiliaryLayoutState {
  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!target) return next;

  for (const instance of next.groups.filter((g) => g.edge === target.edge)) {
    instance.dockedPanelIds = [...instance.panelIds];
    instance.isMaximized = false;
  }

  next.slideouts[target.edge].openPanelId = undefined;

  const applied = applyAuxiliaryLayout(api, next, {
    preserveDockedSizes: preservedDockedSizes,
    debugLabel: 'layout.restoreAuxiliaryGroup',
    debugMeta: { groupInstanceId },
    debugState: state,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(
    getInstancesOnEdge(next, target.edge),
  );
  if (activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return syncAuxiliaryLayoutFromApi(api, applied);
}

export function moveAuxiliaryEdge(
  state: AuxiliaryLayoutState,
  sourceEdge: AuxiliaryEdge,
  targetEdge: AuxiliaryEdge,
): AuxiliaryLayoutState {
  if (sourceEdge === targetEdge) {
    return normalizeAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));

  for (const instance of next.groups) {
    if (instance.edge === sourceEdge) {
      instance.edge = targetEdge;
    }
  }

  next.slideouts[sourceEdge].openPanelId = undefined;
  next.slideouts[targetEdge].openPanelId = undefined;

  return normalizeAuxiliaryLayoutState(next);
}

export function syncAuxiliaryLayoutFromApi(
  api: DockviewApi,
  fallback: AuxiliaryLayoutState,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(
    normalizeAuxiliaryLayoutState(fallback),
  );

  for (const instance of next.groups) {
    const livePanels = instance.panelIds
      .map((panelId) => api.getPanel(panelId))
      .filter((panel): panel is IDockviewPanel => panel !== undefined);

    if (
      livePanels.some((panel) => panel.group.api.location.type === 'popout')
    ) {
      continue;
    }

    const liveGroup = getLiveAuxiliaryGroup(api, instance.panelIds);

    if (!liveGroup) {
      instance.dockedPanelIds = [];
      instance.isMaximized = false;
      continue;
    }

    const livePanelIds = sortPanelIdsBySeedOrder(
      instance.seedGroupId,
      liveGroup.panels
        .map((panel) => panel.id)
        .filter((panelId) => instance.panelIds.includes(panelId)),
    );

    instance.dockedPanelIds = livePanelIds;

    const slideoutPanelId = next.slideouts[instance.edge].openPanelId;
    if (
      !slideoutPanelId ||
      getGroupInstanceForPanel(next, slideoutPanelId)?.groupInstanceId !==
        instance.groupInstanceId
    ) {
      const liveActivePanelId = liveGroup.activePanel?.id;
      instance.activePanelId =
        liveActivePanelId && livePanelIds.includes(liveActivePanelId)
          ? liveActivePanelId
          : (livePanelIds[0] ?? instance.activePanelId);
    }

    instance.dockedSize = getLiveDockedSizeForEdge(
      api,
      instance.edge,
      instance.dockedSize,
    );

    const activeDockedPanelId = getActiveDockedPanelId(instance);
    const activeDockedPanel = activeDockedPanelId
      ? api.getPanel(activeDockedPanelId)
      : undefined;
    instance.isMaximized = Boolean(activeDockedPanel?.api.isMaximized());
  }

  return normalizeAuxiliaryLayoutState(next);
}

export function moveGroupToEdge(
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
  targetEdge: AuxiliaryEdge,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!target) return next;

  if (next.slideouts[target.edge].openPanelId) {
    const openPanel = next.slideouts[target.edge].openPanelId;
    if (openPanel && target.panelIds.includes(openPanel)) {
      next.slideouts[target.edge].openPanelId = undefined;
    }
  }

  target.edge = targetEdge;
  next.slideouts[target.edge].openPanelId = undefined;

  return normalizeAuxiliaryLayoutState(next);
}

export function movePanelToEdge(
  state: AuxiliaryLayoutState,
  panelId: string,
  targetEdge: AuxiliaryEdge,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const source = next.groups.find((g) => g.panelIds.includes(panelId));
  if (!source) return next;

  if (source.panelIds.length === 1) {
    return moveGroupToEdge(state, source.groupInstanceId, targetEdge);
  }

  const seedDef = AUXILIARY_SEED_DEFINITIONS[source.seedGroupId];
  source.panelIds = source.panelIds.filter((id) => id !== panelId);
  source.dockedPanelIds = source.dockedPanelIds.filter((id) => id !== panelId);
  if (source.activePanelId === panelId) {
    source.activePanelId = source.panelIds[0] ?? seedDef.defaultActivePanelId;
  }

  if (next.slideouts[source.edge].openPanelId === panelId) {
    next.slideouts[source.edge].openPanelId = undefined;
  }

  const derivedId = `derived:${panelId}`;
  const maxOrder = next.groups.reduce(
    (max, g) => Math.max(max, g.displayOrder),
    -1,
  );

  next.groups.push({
    groupInstanceId: derivedId,
    seedGroupId: source.seedGroupId,
    kind: 'derived-singleton',
    edge: targetEdge,
    panelIds: [panelId],
    dockedPanelIds: [panelId],
    activePanelId: panelId,
    dockedSize: seedDef.defaultDockedSize,
    slideoutSize: seedDef.defaultSlideoutSize,
    isMaximized: false,
    displayOrder: maxOrder + 1,
  });

  next.slideouts[targetEdge].openPanelId = undefined;

  return normalizeAuxiliaryLayoutState(next);
}

export function mergeBackToSeededGroup(
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const derived = next.groups.find(
    (g) => g.groupInstanceId === groupInstanceId,
  );
  if (!derived || derived.kind !== 'derived-singleton') return next;

  const panelId = derived.panelIds[0];

  const seeded = next.groups.find(
    (g) => g.kind === 'seeded' && g.seedGroupId === derived.seedGroupId,
  );
  if (!seeded) return next;

  if (next.slideouts[derived.edge].openPanelId === panelId) {
    next.slideouts[derived.edge].openPanelId = undefined;
  }

  seeded.panelIds = sortPanelIdsBySeedOrder(seeded.seedGroupId, [
    ...seeded.panelIds,
    panelId,
  ]);
  seeded.dockedPanelIds = sortPanelIdsBySeedOrder(seeded.seedGroupId, [
    ...seeded.dockedPanelIds,
    panelId,
  ]);
  if (!seeded.activePanelId) {
    seeded.activePanelId = panelId;
  }

  next.groups = next.groups.filter(
    (g) => g.groupInstanceId !== groupInstanceId,
  );

  return normalizeAuxiliaryLayoutState(next);
}

export function resetAuxiliaryLayout(): AuxiliaryLayoutState {
  return createDefaultAuxiliaryLayoutState();
}

function createDefaultSeededInstance(
  seedGroupId: AuxiliarySeedGroupId,
  displayOrder: number,
): AuxiliaryGroupInstance {
  const def = AUXILIARY_SEED_DEFINITIONS[seedGroupId];
  // Fresh layouts contain only Java Blue's startup components. Non-startup
  // tools are added to this seeded group when explicitly revealed.
  const startupPanelIds = def.panelIds.filter(
    (panelId) => getPanel(panelId)?.openAtStartup === true,
  );

  return {
    groupInstanceId: seedGroupId,
    seedGroupId,
    kind: 'seeded',
    edge: def.defaultEdge,
    panelIds: [...startupPanelIds],
    dockedPanelIds: [...startupPanelIds],
    activePanelId: startupPanelIds[0] ?? def.defaultActivePanelId,
    dockedSize: def.defaultDockedSize,
    slideoutSize: def.defaultSlideoutSize,
    isMaximized: false,
    displayOrder,
  };
}

function createDefaultSlideouts(): Record<
  AuxiliaryEdge,
  AuxiliaryEdgeSlideoutState
> {
  return {
    left: { edge: 'left' },
    right: { edge: 'right' },
    bottom: { edge: 'bottom' },
  };
}

function normalizeAuxiliaryLayoutState(
  state: AuxiliaryLayoutState,
): AuxiliaryLayoutState {
  const result: AuxiliaryGroupInstance[] = [];
  const usedPanelIds = new Set<string>();

  for (let i = 0; i < AUXILIARY_SEED_ORDER.length; i++) {
    const seedId = AUXILIARY_SEED_ORDER[i];
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];

    const candidate = state.groups?.find(
      (g) => g.kind === 'seeded' && g.seedGroupId === seedId,
    );

    if (candidate) {
      const normalized = normalizeSeededInstance(candidate, seedDef, i);
      for (const pid of normalized.panelIds) usedPanelIds.add(pid);
      result.push(normalized);
    } else {
      const defaults = createDefaultSeededInstance(seedId, i);
      for (const pid of defaults.panelIds) usedPanelIds.add(pid);
      result.push(defaults);
    }
  }

  if (Array.isArray(state.groups)) {
    for (const candidate of state.groups) {
      if (candidate.kind !== 'derived-singleton') continue;

      const panelIds = asStringArray(candidate.panelIds);
      if (panelIds.length !== 1) continue;
      if (usedPanelIds.has(panelIds[0])) continue;

      const seedId = getAuxiliarySeedGroupIdForPanel(panelIds[0]);
      if (!seedId) continue;

      const normalized: AuxiliaryGroupInstance = {
        groupInstanceId: candidate.groupInstanceId || `derived:${panelIds[0]}`,
        seedGroupId: seedId,
        kind: 'derived-singleton',
        edge: AUXILIARY_EDGE_ORDER.includes(candidate.edge)
          ? candidate.edge
          : 'left',
        panelIds: [panelIds[0]],
        dockedPanelIds:
          Array.isArray(candidate.dockedPanelIds) &&
          candidate.dockedPanelIds.includes(panelIds[0])
            ? [panelIds[0]]
            : [],
        activePanelId:
          candidate.activePanelId === panelIds[0] ? panelIds[0] : panelIds[0],
        dockedSize: Number.isFinite(candidate.dockedSize)
          ? candidate.dockedSize
          : AUXILIARY_SEED_DEFINITIONS[seedId].defaultDockedSize,
        slideoutSize:
          Number.isFinite(candidate.slideoutSize) && candidate.slideoutSize
            ? clampSlideoutSize(candidate.edge, candidate.slideoutSize)
            : AUXILIARY_SEED_DEFINITIONS[seedId].defaultSlideoutSize,
        isMaximized: Boolean(candidate.isMaximized),
        displayOrder: Number.isFinite(candidate.displayOrder)
          ? candidate.displayOrder
          : result.length,
      };

      usedPanelIds.add(panelIds[0]);
      result.push(normalized);
    }
  }

  result.sort((a, b) => a.displayOrder - b.displayOrder);
  result.forEach((inst, i) => {
    inst.displayOrder = i;
  });

  const slideouts = createDefaultSlideouts();

  for (const edge of AUXILIARY_EDGE_ORDER) {
    const openPanelId =
      typeof state.slideouts?.[edge]?.openPanelId === 'string'
        ? state.slideouts[edge].openPanelId
        : undefined;

    if (!openPanelId) continue;

    const owner = result.find(
      (inst) => inst.panelIds.includes(openPanelId) && inst.edge === edge,
    );
    if (!owner) continue;
    if (owner.dockedPanelIds.includes(openPanelId)) continue;

    slideouts[edge].openPanelId = openPanelId;
    owner.activePanelId = openPanelId;
  }

  return { version: 5, groups: result, slideouts };
}

function normalizeSeededInstance(
  candidate: AuxiliaryGroupInstance,
  seedDef: AuxiliarySeedDefinition,
  displayOrder: number,
): AuxiliaryGroupInstance {
  const hasPanelIds = Array.isArray(candidate.panelIds);
  const declaredPanelIds = hasPanelIds
    ? asStringArray(candidate.panelIds)
    : [...seedDef.panelIds];
  const declaredDockedPanelIds = Array.isArray(candidate.dockedPanelIds)
    ? asStringArray(candidate.dockedPanelIds)
    : [];
  const effectivePanelIds = sortPanelIdsBySeedOrder(seedDef.seedGroupId, [
    ...declaredPanelIds,
    ...declaredDockedPanelIds,
  ]);

  const dockedPanelIds = Array.isArray(candidate.dockedPanelIds)
    ? sortPanelIdsBySeedOrder(
        seedDef.seedGroupId,
        asStringArray(candidate.dockedPanelIds),
      ).filter((pid) => effectivePanelIds.includes(pid))
    : [...effectivePanelIds];

  const activePanelId = effectivePanelIds.includes(candidate.activePanelId)
    ? candidate.activePanelId
    : (dockedPanelIds[0] ??
      effectivePanelIds[0] ??
      seedDef.defaultActivePanelId);

  const edge = AUXILIARY_EDGE_ORDER.includes(candidate.edge)
    ? candidate.edge
    : seedDef.defaultEdge;

  return {
    groupInstanceId: seedDef.seedGroupId,
    seedGroupId: seedDef.seedGroupId,
    kind: 'seeded',
    edge,
    panelIds: effectivePanelIds,
    dockedPanelIds,
    activePanelId,
    dockedSize: Number.isFinite(candidate.dockedSize)
      ? candidate.dockedSize
      : seedDef.defaultDockedSize,
    slideoutSize: Number.isFinite(candidate.slideoutSize)
      ? clampSlideoutSize(edge, candidate.slideoutSize)
      : seedDef.defaultSlideoutSize,
    isMaximized: Boolean(candidate.isMaximized),
    displayOrder,
  };
}

function createDockedPresentationForEdge(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): DockviewGroupPanel | undefined {
  const instancesOnEdge = getInstancesOnEdge(state, edge);
  const dockedEntries = instancesOnEdge.flatMap((instance) =>
    instance.dockedPanelIds.map((panelId) => ({
      instance,
      panelId,
    })),
  );

  if (dockedEntries.length === 0) {
    return undefined;
  }

  const anchorPanel = getAnchorPanel(api);
  if (!anchorPanel) return undefined;

  const representative = instancesOnEdge.find(
    (instance) => instance.dockedPanelIds.length > 0,
  );
  if (!representative) {
    return undefined;
  }

  const group = api.addGroup({
    id: getDockviewGroupIdForEdge(edge),
    referencePanel: anchorPanel,
    direction: getDockDirection(edge),
    locked: false,
    ...(edge === 'bottom'
      ? { initialHeight: representative.dockedSize }
      : { initialWidth: representative.dockedSize }),
  }) as DockviewGroupPanel;

  const activeDockedPanelId = getActiveDockedPanelIdForEdge(instancesOnEdge);

  group.api.setHeaderPosition('top');
  markAuxiliaryGroupElement(group, edge, dockedEntries.length);
  mountDockedPanelsIntoGroup(api, group, dockedEntries, activeDockedPanelId);

  if (activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }

  return group;
}

function mountDockedPanelsIntoGroup(
  api: DockviewApi,
  group: DockviewGroupPanel,
  dockedEntries: Array<{
    instance: AuxiliaryGroupInstance;
    panelId: string;
  }>,
  activeDockedPanelId: string | undefined,
) {
  dockedEntries.forEach(({ panelId }, index) => {
    const descriptor = getPanel(panelId);
    if (!descriptor) return;

    api.addPanel({
      id: panelId,
      component: 'default',
      title: descriptor.title,
      position: {
        referenceGroup: group,
        direction: 'within',
        index,
      },
      inactive:
        activeDockedPanelId !== undefined && panelId !== activeDockedPanelId,
    });
  });
}

function clearLiveAuxiliaryPanels(api: DockviewApi, panelIds: string[]) {
  for (const panelId of unique(panelIds)) {
    api.getPanel(panelId)?.api.close();
  }
}

function getLiveAuxiliaryGroup(
  api: DockviewApi,
  panelIds: string[],
): DockviewGroupPanel | undefined {
  for (const panelId of panelIds) {
    const panel = api.getPanel(panelId);
    if (panel) {
      return panel.group as DockviewGroupPanel;
    }
  }
  return undefined;
}

function getAnchorPanel(api: DockviewApi): IDockviewPanel | undefined {
  for (const descriptor of getDefaultEditorPanels()) {
    const panel = api.getPanel(descriptor.id);
    if (panel) return panel;
  }
  return api.panels[0];
}

function focusDockviewPanel(api: DockviewApi, panelId: string) {
  const panel = api.getPanel(panelId);
  if (!panel) return;
  panel.api.setActive();
  panel.group.focus();
}

function syncDockviewPanelTitles(api: DockviewApi) {
  for (const descriptor of PANEL_REGISTRY) {
    const panel = api.getPanel(descriptor.id);
    if (!panel) {
      continue;
    }

    if (panel.api.title !== descriptor.title) {
      panel.api.setTitle(descriptor.title);
    }
  }
}

function markAuxiliaryGroupElement(
  group: DockviewGroupPanel,
  edge: AuxiliaryEdge,
  tabCount: number,
) {
  const element = (
    group as DockviewGroupPanel & {
      element?: HTMLElement;
    }
  ).element;

  if (!element) {
    return;
  }

  element.dataset.auxEdge = edge;
  element.dataset.auxGroupTabCount = String(tabCount);
}

function getActiveDockedPanelId(
  instance: AuxiliaryGroupInstance,
): string | undefined {
  return instance.dockedPanelIds.includes(instance.activePanelId)
    ? instance.activePanelId
    : instance.dockedPanelIds[0];
}

function getActiveDockedPanelIdForEdge(
  instances: AuxiliaryGroupInstance[],
): string | undefined {
  for (const instance of instances) {
    const activePanelId = getActiveDockedPanelId(instance);
    if (activePanelId) {
      return activePanelId;
    }
  }

  return undefined;
}

function getDockDirection(edge: AuxiliaryEdge): 'left' | 'right' | 'below' {
  if (edge === 'bottom') return 'below';
  return edge;
}

function getDockviewGroupIdForEdge(edge: AuxiliaryEdge): string {
  return `blue-aux-edge-${edge}`;
}

function upgradeV4ToV5(
  legacy: LegacyAuxiliaryLayoutStateV4,
): AuxiliaryLayoutState {
  const groups: AuxiliaryGroupInstance[] = [];

  for (let i = 0; i < AUXILIARY_SEED_ORDER.length; i++) {
    const seedId = AUXILIARY_SEED_ORDER[i];
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];
    const candidate = legacy.groups?.[seedId];

    if (!candidate) {
      groups.push(createDefaultSeededInstance(seedId, i));
      continue;
    }

    const panelIds = sortPanelIdsBySeedOrder(
      seedId,
      asStringArray(candidate.panelIds),
    );

    const effectivePanelIds =
      panelIds.length > 0 ? panelIds : [...seedDef.panelIds];

    const dockedPanelIds = Array.isArray(candidate.dockedPanelIds)
      ? sortPanelIdsBySeedOrder(
          seedId,
          asStringArray(candidate.dockedPanelIds),
        ).filter((pid) => effectivePanelIds.includes(pid))
      : [...effectivePanelIds];

    const activePanelId = effectivePanelIds.includes(
      candidate.activePanelId ?? '',
    )
      ? candidate.activePanelId
      : (dockedPanelIds[0] ?? effectivePanelIds[0]);

    const edge = AUXILIARY_EDGE_ORDER.includes(candidate.edge)
      ? candidate.edge
      : seedDef.defaultEdge;

    groups.push({
      groupInstanceId: seedId,
      seedGroupId: seedId,
      kind: 'seeded',
      edge,
      panelIds: effectivePanelIds,
      dockedPanelIds,
      activePanelId,
      dockedSize: Number.isFinite(candidate.dockedSize)
        ? candidate.dockedSize
        : seedDef.defaultDockedSize,
      slideoutSize: Number.isFinite(candidate.slideoutSize)
        ? clampSlideoutSize(edge, candidate.slideoutSize)
        : seedDef.defaultSlideoutSize,
      isMaximized: Boolean(candidate.isMaximized),
      displayOrder: i,
    });
  }

  const slideouts: Record<AuxiliaryEdge, AuxiliaryEdgeSlideoutState> = {
    left: { edge: 'left' },
    right: { edge: 'right' },
    bottom: { edge: 'bottom' },
  };

  if (legacy.slideouts) {
    for (const edge of AUXILIARY_EDGE_ORDER) {
      const openPanelId = legacy.slideouts[edge]?.openPanelId;
      if (typeof openPanelId !== 'string') continue;

      const owner = groups.find(
        (g) => g.panelIds.includes(openPanelId) && g.edge === edge,
      );
      if (!owner) continue;
      if (owner.dockedPanelIds.includes(openPanelId)) continue;

      slideouts[edge].openPanelId = openPanelId;
      owner.activePanelId = openPanelId;
    }
  }

  return { version: 5, groups, slideouts };
}

function upgradeV3ToV5(
  legacy: LegacyAuxiliaryLayoutStateV3,
): AuxiliaryLayoutState {
  const v4StyleGroups: Record<string, LegacyAuxiliaryGroupSessionV4> = {};

  for (const seedId of AUXILIARY_SEED_ORDER) {
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];
    const candidate = legacy.groups?.[seedId];
    if (!candidate) {
      v4StyleGroups[seedId] = {
        id: seedId,
        edge: seedDef.defaultEdge,
        mode: seedDef.modeId,
        panelIds: [...seedDef.panelIds],
        dockedPanelIds: [...seedDef.panelIds],
        activePanelId: seedDef.defaultActivePanelId,
        dockedSize: seedDef.defaultDockedSize,
        slideoutSize: seedDef.defaultSlideoutSize,
        isMaximized: false,
      };
      continue;
    }

    const panelIds = sortPanelIdsBySeedOrder(seedId, candidate.panelIds ?? []);
    const effectivePanelIds =
      panelIds.length > 0 ? panelIds : [...seedDef.panelIds];

    let dockedPanelIds = [...effectivePanelIds];
    let isMaximized = false;

    switch (candidate.presentation) {
      case 'minimized':
        dockedPanelIds = [];
        break;
      case 'floating':
        dockedPanelIds = [];
        break;
      case 'maximized':
        isMaximized = true;
        break;
    }

    const activePanelId = effectivePanelIds.includes(candidate.activePanelId)
      ? candidate.activePanelId!
      : effectivePanelIds[0];

    const slideoutSize =
      seedDef.defaultEdge === 'bottom'
        ? candidate.floatingBounds?.height
        : candidate.floatingBounds?.width;

    v4StyleGroups[seedId] = {
      id: seedId,
      edge: seedDef.defaultEdge,
      mode: seedDef.modeId,
      panelIds: effectivePanelIds,
      dockedPanelIds,
      activePanelId,
      dockedSize: Number.isFinite(candidate.dockedSize)
        ? candidate.dockedSize!
        : seedDef.defaultDockedSize,
      slideoutSize: Number.isFinite(slideoutSize)
        ? clampSlideoutSize(seedDef.defaultEdge, slideoutSize!)
        : seedDef.defaultSlideoutSize,
      isMaximized,
    };
  }

  const v4State: LegacyAuxiliaryLayoutStateV4 = {
    version: 4,
    groups: v4StyleGroups as Record<
      AuxiliarySeedGroupId,
      LegacyAuxiliaryGroupSessionV4
    >,
    slideouts: {
      left: { edge: 'left' },
      right: { edge: 'right' },
      bottom: { edge: 'bottom' },
    },
  };

  if (legacy.groups) {
    for (const seedId of AUXILIARY_SEED_ORDER) {
      const candidate = legacy.groups[seedId];
      if (candidate?.presentation === 'floating' && candidate.activePanelId) {
        v4State.slideouts[seedDef_edge(seedId)].openPanelId =
          candidate.activePanelId;
      }
    }
  }

  return upgradeV4ToV5(v4State);
}

function seedDef_edge(seedId: AuxiliarySeedGroupId): AuxiliaryEdge {
  return AUXILIARY_SEED_DEFINITIONS[seedId].defaultEdge;
}

function upgradeV2ToV5(
  legacy: LegacyAuxiliaryLayoutStateV2,
): AuxiliaryLayoutState {
  const v4StyleGroups: Record<string, LegacyAuxiliaryGroupSessionV4> = {};

  for (const seedId of AUXILIARY_SEED_ORDER) {
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];
    v4StyleGroups[seedId] = {
      id: seedId,
      edge: seedDef.defaultEdge,
      mode: seedDef.modeId,
      panelIds: [...seedDef.panelIds],
      dockedPanelIds: [...seedDef.panelIds],
      activePanelId: seedDef.defaultActivePanelId,
      dockedSize: seedDef.defaultDockedSize,
      slideoutSize: seedDef.defaultSlideoutSize,
      isMaximized: false,
    };
  }

  const right = legacy.byEdge?.right;
  if (right) {
    const session = v4StyleGroups['properties-main'];
    const panelIds = sortPanelIdsBySeedOrder(
      'properties-main',
      right.panelIds ?? [],
    );
    if (panelIds.length > 0) {
      session.panelIds = panelIds;
      session.dockedPanelIds = [...panelIds];
    }
    session.activePanelId = session.panelIds.includes(right.activePanelId)
      ? right.activePanelId
      : (session.dockedPanelIds[0] ?? session.panelIds[0]);
    if (Number.isFinite(right.size)) {
      session.dockedSize = right.size!;
      session.slideoutSize = clampSlideoutSize(session.edge, right.size!);
    }
  }

  const bottom = legacy.byEdge?.bottom;
  if (bottom) {
    const session = v4StyleGroups['output-main'];
    const panelIds = sortPanelIdsBySeedOrder(
      'output-main',
      bottom.panelIds ?? [],
    );
    if (panelIds.length > 0) {
      session.panelIds = panelIds;
      session.dockedPanelIds = [...panelIds];
    }
    session.activePanelId = session.panelIds.includes(bottom.activePanelId)
      ? bottom.activePanelId
      : (session.dockedPanelIds[0] ?? session.panelIds[0]);
    if (Number.isFinite(bottom.size)) {
      session.dockedSize = bottom.size!;
      session.slideoutSize = clampSlideoutSize(session.edge, bottom.size!);
    }
  }

  return upgradeV4ToV5({
    version: 4,
    groups: v4StyleGroups as Record<
      AuxiliarySeedGroupId,
      LegacyAuxiliaryGroupSessionV4
    >,
    slideouts: {
      left: { edge: 'left' },
      right: { edge: 'right' },
      bottom: { edge: 'bottom' },
    },
  });
}

function clampSlideoutSize(edge: AuxiliaryEdge, value: number): number {
  const viewportWidth =
    typeof window === 'undefined' ? 1440 : Math.max(window.innerWidth, 480);
  const viewportHeight =
    typeof window === 'undefined' ? 900 : Math.max(window.innerHeight, 320);

  if (edge === 'bottom') {
    return clampNumber(value, {
      minimum: 180,
      maximum: Math.max(180, viewportHeight - 96),
    });
  }

  return clampNumber(value, {
    minimum: 240,
    maximum: Math.max(240, viewportWidth - 120),
  });
}

function clampNumber(
  value: number,
  options: { minimum: number; maximum: number },
): number {
  if (!Number.isFinite(value)) return options.minimum;
  return Math.min(Math.max(value, options.minimum), options.maximum);
}

function sortPanelIdsBySeedOrder(
  seedGroupId: AuxiliarySeedGroupId,
  panelIds: string[],
): string[] {
  const order = AUXILIARY_SEED_DEFINITIONS[seedGroupId].panelIds;
  return unique(panelIds)
    .filter((panelId) => order.includes(panelId))
    .sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isStoredWorkbenchLayoutV7(
  value: unknown,
): value is StoredWorkbenchLayout {
  return (
    isRecord(value) &&
    value.version === 7 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

function isLegacyStoredWorkbenchLayoutV6(
  value: unknown,
): value is LegacyStoredWorkbenchLayoutV6 {
  return (
    isRecord(value) &&
    value.version === 6 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

function isLegacyStoredWorkbenchLayoutV5(
  value: unknown,
): value is LegacyStoredWorkbenchLayoutV5 {
  return (
    isRecord(value) &&
    value.version === 5 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

function isLegacyStoredWorkbenchLayoutV4(
  value: unknown,
): value is LegacyStoredWorkbenchLayoutV4 {
  return (
    isRecord(value) &&
    value.version === 4 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary) &&
    isRecord(value.auxiliary.groups) &&
    isRecord(value.auxiliary.slideouts)
  );
}

function isLegacyStoredWorkbenchLayoutV3(
  value: unknown,
): value is LegacyStoredWorkbenchLayoutV3 {
  return (
    isRecord(value) &&
    value.version === 3 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary)
  );
}

function isLegacyStoredWorkbenchLayoutV2(
  value: unknown,
): value is LegacyStoredWorkbenchLayoutV2 {
  return (
    isRecord(value) &&
    value.version === 2 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary)
  );
}

function isAuxiliaryLayoutStateV5(
  value: unknown,
): value is AuxiliaryLayoutState {
  return (
    isRecord(value) &&
    value.version === 5 &&
    Array.isArray(value.groups) &&
    isRecord(value.slideouts)
  );
}

function isSerializedDockview(value: unknown): value is SerializedDockview {
  return isRecord(value) && isRecord(value.grid) && isRecord(value.panels);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
