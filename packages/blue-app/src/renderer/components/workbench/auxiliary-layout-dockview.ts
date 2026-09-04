import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from 'dockview';
import { PANEL_REGISTRY, getDefaultEditorPanels, getPanel } from './panel-registry';
import { hasActiveTreeDrag } from '../tree/tree-dnd-domain';
import type { DockingOrigin } from '../../../shared/workbench-window-contract';
import {
  AUXILIARY_EDGE_ORDER,
  AUXILIARY_SEED_DEFINITIONS,
  captureAuxiliaryDockedSizes,
  clampAuxiliaryDockedSize,
  cloneAuxiliaryLayoutState,
  createDefaultAuxiliaryLayoutState,
  getAuxiliarySeedGroupIdForPanel,
  getDefaultDockedSizeForEdge,
  getGroupInstanceForPanel,
  getInstancesOnEdge,
  isAuxiliaryPanelId,
  normalizeAuxiliaryLayoutState,
  sortPanelIdsBySeedOrder,
  unique,
  type AuxiliaryDockedSizeSnapshot,
  type AuxiliaryEdge,
  type AuxiliaryGroupInstance,
  type AuxiliaryGroupSizeAction,
  type AuxiliaryLayoutState,
} from './auxiliary-layout-model';

export function isAuxiliaryInteractionTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest?.('[data-auxiliary-slideout="true"]') ||
    element?.closest?.('[data-auxiliary-rail="true"]') ||
    element?.closest?.('[data-auxiliary-portal="true"]') ||
    element?.closest?.('[role="menu"]') ||
    element?.closest?.('[role="listbox"]') ||
    element?.closest?.('[role="dialog"]'),
  );
}

interface ApplyAuxiliaryLayoutOptions {
  preserveDockedSizes?: AuxiliaryDockedSizeSnapshot;
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

function getLiveAuxiliaryEdgeGroup(
  api: DockviewApi,
  edge: AuxiliaryEdge,
): DockviewGroupPanel | undefined {
  return api.groups.find((group) => group.id === getDockviewGroupIdForEdge(edge));
}

function getLiveAuxiliaryGroupElement(
  group: DockviewGroupPanel | undefined,
): HTMLElement | undefined {
  return (group as (DockviewGroupPanel & { element?: HTMLElement }) | undefined)?.element;
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

function restoreAuxiliaryDockedSizes(api: DockviewApi, sizes: AuxiliaryDockedSizeSnapshot) {
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

function scheduleAuxiliaryDockedSizeRestore(api: DockviewApi, sizes: AuxiliaryDockedSizeSnapshot) {
  const requestFrame = globalThis.requestAnimationFrame;
  if (typeof requestFrame !== 'function') {
    return;
  }

  requestFrame(() => {
    restoreAuxiliaryDockedSizes(api, sizes);
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

export function buildDefaultWorkbenchLayout(api: DockviewApi): AuxiliaryLayoutState {
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
  const dockedSizesToRestore = options?.preserveDockedSizes ?? captureAuxiliaryDockedSizes(next);

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

  // Dockview 5.2 can ignore initialWidth/initialHeight when inserting an
  // auxiliary group beside a nested grid, falling back to an equal split.
  // Reapply the canonical pixel sizes after every rebuild, including startup.
  restoreAuxiliaryDockedSizes(api, dockedSizesToRestore);

  scheduleAuxiliaryDockedSizeRestore(api, dockedSizesToRestore);

  syncDockviewPanelTitles(api);

  return syncAuxiliaryLayoutFromApi(api, next);
}

/**
 * Result of one runtime auxiliary layout transition (SPEC 084). Only an
 * `applied` result may replace canonical workbench state; `deferred` and
 * `failed` results always carry the last valid layout back to the caller.
 */
export type AuxiliaryLayoutTransitionResult =
  | { status: 'applied'; state: AuxiliaryLayoutState }
  | { status: 'deferred'; state: AuxiliaryLayoutState; reason: 'drag-active' }
  | { status: 'failed'; state: AuxiliaryLayoutState; reason: string };

interface TransitionAuxiliaryLayoutOptions {
  preserveDockedSizes?: AuxiliaryDockedSizeSnapshot;
}

/**
 * Applies a runtime auxiliary layout change through targeted Dockview
 * operations (SPEC 084). Unlike `applyAuxiliaryLayout`, live panel objects
 * are reused, only affected edge groups are created/removed, and unaffected
 * panel sessions keep their object identity. A participating tree drag
 * defers the transition; preflight or runtime failures return the last
 * valid layout after a best-effort rollback.
 */
export function transitionAuxiliaryLayout(
  api: DockviewApi,
  current: AuxiliaryLayoutState,
  desired: AuxiliaryLayoutState,
  options?: TransitionAuxiliaryLayoutOptions,
): AuxiliaryLayoutTransitionResult {
  const doc = getWorkbenchDocument(api);
  if (doc && hasActiveTreeDrag(doc)) {
    return { status: 'deferred', state: cloneAuxiliaryLayoutState(current), reason: 'drag-active' };
  }

  const preflight = preflightAuxiliaryLayout(desired);
  if (!preflight.ok) {
    return {
      status: 'failed',
      state: cloneAuxiliaryLayoutState(current),
      reason: preflight.reason,
    };
  }

  const target = normalizeAuxiliaryLayoutState(desired);
  const dockedSizesToRestore = options?.preserveDockedSizes ?? captureAuxiliaryDockedSizes(target);

  try {
    closeAuxiliaryPanelsRemovedFromTarget(api, current, target);
    const affectedEdges = reconcileDockedEdges(api, target);
    applyTransitionPresentation(api, target, affectedEdges);
  } catch (error) {
    try {
      reconcileDockedEdges(api, normalizeAuxiliaryLayoutState(current));
    } catch {
      // Best-effort rollback only; keep whatever remains of the last layout.
    }
    return {
      status: 'failed',
      state: cloneAuxiliaryLayoutState(current),
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  restoreAuxiliaryDockedSizes(api, dockedSizesToRestore);
  scheduleAuxiliaryDockedSizeRestore(api, dockedSizesToRestore);
  syncDockviewPanelTitles(api);

  return { status: 'applied', state: syncAuxiliaryLayoutFromApi(api, target) };
}

function closeAuxiliaryPanelsRemovedFromTarget(
  api: DockviewApi,
  current: AuxiliaryLayoutState,
  target: AuxiliaryLayoutState,
): void {
  const targetPanelIds = new Set(target.groups.flatMap((instance) => instance.panelIds));
  const closedPanelIds = new Set<string>();

  for (const instance of current.groups) {
    for (const panelId of instance.panelIds) {
      if (targetPanelIds.has(panelId) || closedPanelIds.has(panelId)) {
        continue;
      }
      closedPanelIds.add(panelId);

      const live = api.getPanel(panelId);
      if (!live || isLiveFloatingPanel(live)) {
        continue;
      }
      live.api.close();
    }
  }
}

function getWorkbenchDocument(api: DockviewApi): Document | undefined {
  const element = (api as DockviewApi & { element?: HTMLElement }).element;
  if (element?.ownerDocument) {
    return element.ownerDocument;
  }
  return typeof document === 'undefined' ? undefined : document;
}

function preflightAuxiliaryLayout(
  desired: AuxiliaryLayoutState,
): { ok: true } | { ok: false; reason: string } {
  if (!desired || !Array.isArray(desired.groups)) {
    return { ok: false, reason: 'Desired auxiliary layout is malformed' };
  }

  const dockedOwners = new Map<string, string>();
  for (const group of desired.groups) {
    if (!Array.isArray(group?.dockedPanelIds)) {
      continue;
    }
    for (const panelId of group.dockedPanelIds) {
      if (!getPanel(panelId)) {
        return {
          ok: false,
          reason: `Desired docked panel "${panelId}" is not in the panel registry`,
        };
      }
      const owner = dockedOwners.get(panelId);
      if (owner !== undefined && owner !== group.groupInstanceId) {
        return {
          ok: false,
          reason: `Desired layout docks "${panelId}" in more than one group`,
        };
      }
      dockedOwners.set(panelId, group.groupInstanceId);
    }
  }

  return { ok: true };
}

function getDockedEntriesForEdge(
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): Array<{ instance: AuxiliaryGroupInstance; panelId: string }> {
  return getInstancesOnEdge(state, edge).flatMap((instance) =>
    instance.dockedPanelIds.map((panelId) => ({ instance, panelId })),
  );
}

function getLiveGridAuxiliaryEdgeGroup(
  api: DockviewApi,
  edge: AuxiliaryEdge,
): DockviewGroupPanel | undefined {
  const group = getLiveAuxiliaryEdgeGroup(api, edge);
  if (!group) {
    return undefined;
  }
  return group.api.location.type === 'grid' ? group : undefined;
}

function isLiveFloatingPanel(panel: IDockviewPanel): boolean {
  const location = (panel.group as DockviewGroupPanel | undefined)?.api?.location?.type;
  return location === 'popout' || location === 'floating';
}

function ensureDockedEdgeGroup(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  edge: AuxiliaryEdge,
): DockviewGroupPanel | undefined {
  const existing = getLiveGridAuxiliaryEdgeGroup(api, edge);
  if (existing) {
    return existing;
  }

  const entries = getDockedEntriesForEdge(state, edge);
  const representative = entries[0]?.instance;
  if (!representative) {
    return undefined;
  }

  const anchorPanel = getAnchorPanel(api);
  if (!anchorPanel) {
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

  group.api.setHeaderPosition('top');
  markAuxiliaryGroupElement(group, edge, entries.length);
  return group;
}

/**
 * Reconciles the live Dockview grid so docked panels, their groups, and
 * their tab order match `target`, using only targeted operations: existing
 * live panels are moved (never closed and recreated), panels that left the
 * docked presentation are closed, and empty edge groups are removed. Panels
 * currently floating in popout windows are left untouched.
 *
 * Returns the edges whose docked presentation actually changed; only those
 * edges may receive focus during presentation restore.
 */
function reconcileDockedEdges(api: DockviewApi, target: AuxiliaryLayoutState): Set<AuxiliaryEdge> {
  const dockedEntries: Record<
    AuxiliaryEdge,
    Array<{ instance: AuxiliaryGroupInstance; panelId: string }>
  > = {
    left: getDockedEntriesForEdge(target, 'left'),
    right: getDockedEntriesForEdge(target, 'right'),
    bottom: getDockedEntriesForEdge(target, 'bottom'),
  };

  const affectedEdges = new Set<AuxiliaryEdge>();
  const desiredPanelIds = (edge: AuxiliaryEdge) =>
    dockedEntries[edge].map((entry) => entry.panelId);

  for (const edge of AUXILIARY_EDGE_ORDER) {
    const existing = getLiveGridAuxiliaryEdgeGroup(api, edge);
    const desiredIds = desiredPanelIds(edge);
    const liveIds = existing ? existing.panels.map((panel) => panel.id) : [];
    const changed =
      desiredIds.length !== liveIds.length ||
      desiredIds.some((panelId, index) => panelId !== liveIds[index]);
    if (changed) {
      affectedEdges.add(edge);
    }
  }

  // Create missing target edge groups first so a creation failure happens
  // before any live panel is moved.
  const edgeGroups = new Map<AuxiliaryEdge, DockviewGroupPanel>();
  for (const edge of AUXILIARY_EDGE_ORDER) {
    if (dockedEntries[edge].length === 0) {
      continue;
    }
    const group = ensureDockedEdgeGroup(api, target, edge);
    if (!group) {
      throw new Error(`Unable to create the ${edge} auxiliary edge group`);
    }
    edgeGroups.set(edge, group);
  }

  // Membership: move live grid panels into their target group and add
  // panels that are not live yet.
  for (const edge of AUXILIARY_EDGE_ORDER) {
    const group = edgeGroups.get(edge);
    if (!group) {
      continue;
    }

    for (const { panelId } of dockedEntries[edge]) {
      const live = api.getPanel(panelId);
      if (!live) {
        const descriptor = getPanel(panelId);
        if (!descriptor) {
          continue;
        }
        api.addPanel({
          id: panelId,
          component: 'default',
          title: descriptor.title,
          position: { referenceGroup: group, direction: 'within' },
          inactive: true,
        });
        continue;
      }
      if (isLiveFloatingPanel(live)) {
        continue;
      }
      if (live.group.id !== group.id) {
        live.api.moveTo({ group });
      }
    }
  }

  // Close live grid panels that are no longer docked in the target layout.
  const dockedPanelIds = new Set(
    AUXILIARY_EDGE_ORDER.flatMap((edge) => dockedEntries[edge].map((entry) => entry.panelId)),
  );
  for (const instance of target.groups) {
    for (const panelId of instance.panelIds) {
      if (dockedPanelIds.has(panelId)) {
        continue;
      }
      const live = api.getPanel(panelId);
      if (!live || isLiveFloatingPanel(live)) {
        continue;
      }
      live.api.close();
    }
  }

  // Remove edge groups that no longer host any docked panels.
  for (const edge of AUXILIARY_EDGE_ORDER) {
    if (dockedEntries[edge].length > 0) {
      continue;
    }
    const group = getLiveGridAuxiliaryEdgeGroup(api, edge);
    if (group && group.panels.length === 0) {
      api.removeGroup(group);
    }
  }

  // Order: place each docked panel at its desired tab index.
  for (const edge of AUXILIARY_EDGE_ORDER) {
    const group = edgeGroups.get(edge);
    if (!group) {
      continue;
    }

    dockedEntries[edge].forEach(({ panelId }, desiredIndex) => {
      const live = api.getPanel(panelId);
      if (!live || live.group.id !== group.id) {
        return;
      }
      const currentIndex = group.panels.findIndex((panel) => panel.id === panelId);
      if (currentIndex !== desiredIndex) {
        live.api.moveTo({ group, index: desiredIndex });
      }
    });
  }

  return affectedEdges;
}

function applyTransitionPresentation(
  api: DockviewApi,
  target: AuxiliaryLayoutState,
  affectedEdges: Set<AuxiliaryEdge>,
): void {
  for (const edge of AUXILIARY_EDGE_ORDER) {
    const instancesOnEdge = getInstancesOnEdge(target, edge);
    const activeDockedPanelId = getActiveDockedPanelIdForEdge(instancesOnEdge);
    if (!activeDockedPanelId) {
      continue;
    }

    const group = getLiveGridAuxiliaryEdgeGroup(api, edge);
    if (!group) {
      continue;
    }

    markAuxiliaryGroupElement(
      group,
      edge,
      instancesOnEdge.reduce((count, instance) => count + instance.dockedPanelIds.length, 0),
    );
    if (affectedEdges.has(edge)) {
      focusDockviewPanel(api, activeDockedPanelId);
    }
    const targetIsMaximized = instancesOnEdge.some(
      (instance) => instance.isMaximized && instance.dockedPanelIds.length > 0,
    );
    if (!targetIsMaximized && group.api.isMaximized()) {
      group.api.exitMaximized();
    }
  }

  for (const instance of target.groups) {
    if (!instance.isMaximized || instance.dockedPanelIds.length === 0) {
      continue;
    }
    const activeDockedPanelId = getActiveDockedPanelId(instance);
    if (!activeDockedPanelId) {
      continue;
    }
    api.getPanel(activeDockedPanelId)?.api.maximize();
  }
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
    const target = next.groups.find((g) => g.kind === 'seeded' && g.seedGroupId === seedId);
    if (!target) {
      return next;
    }

    target.panelIds = [...target.panelIds, panelId];
    if (!target.dockedPanelIds.includes(panelId)) {
      target.dockedPanelIds = [...target.dockedPanelIds, panelId];
    }
    target.activePanelId = panelId;

    const result = transitionAuxiliaryLayout(api, state, normalizeAuxiliaryLayoutState(next), {
      preserveDockedSizes: preservedDockedSizes,
    });
    if (result.status === 'applied') {
      focusDockviewPanel(api, panelId);
    }
    return result.state;
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;
  target.activePanelId = panelId;

  if (target.dockedPanelIds.includes(panelId)) {
    next.slideouts[target.edge].openPanelId = undefined;

    if (!api.getPanel(panelId)) {
      const result = transitionAuxiliaryLayout(api, state, next, {
        preserveDockedSizes: preservedDockedSizes,
      });
      if (result.status === 'applied') {
        focusDockviewPanel(api, panelId);
      }
      return result.state;
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
  const seedGroupId = origin.auxiliarySeedGroupId ?? getAuxiliarySeedGroupIdForPanel(panelId);
  if (!seedGroupId) {
    return revealAuxiliaryPanel(api, state, panelId);
  }

  const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, state);
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const requestedInstanceId = origin.auxiliaryGroupInstanceId;
  let target = requestedInstanceId
    ? next.groups.find((group) => group.groupInstanceId === requestedInstanceId)
    : undefined;

  if (
    !target &&
    (requestedInstanceId?.startsWith('derived:') ||
      requestedInstanceId?.startsWith('derived-group:'))
  ) {
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedGroupId];
    const maxOrder = next.groups.reduce((max, group) => Math.max(max, group.displayOrder), -1);
    target = {
      groupInstanceId: requestedInstanceId,
      seedGroupId,
      kind: requestedInstanceId.startsWith('derived-group:')
        ? 'derived-group'
        : 'derived-singleton',
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

  target.panelIds = sortPanelIdsBySeedOrder(target.seedGroupId, [...target.panelIds, panelId]);
  target.dockedPanelIds = target.dockedPanelIds.filter((id) => id !== panelId);
  target.activePanelId = panelId;
  target.isMaximized = false;

  for (const edge of AUXILIARY_EDGE_ORDER) {
    if (next.slideouts[edge].openPanelId === panelId) {
      next.slideouts[edge].openPanelId = undefined;
    }
  }

  if (origin.presentation === 'docked' || origin.presentation === 'maximized') {
    target.dockedPanelIds = sortPanelIdsBySeedOrder(target.seedGroupId, [
      ...target.dockedPanelIds,
      panelId,
    ]);
    target.isMaximized = origin.presentation === 'maximized';
  } else if (origin.presentation === 'slideout') {
    next.slideouts[target.edge].openPanelId = panelId;
  }

  // The restoring edge may have lost its live group while the panel was
  // closed, so a live capture falls back to the default size. The origin's
  // captured size must win over that fallback.
  if (origin.dockedSize !== undefined) {
    preservedDockedSizes[target.edge] = origin.dockedSize;
  }

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  if (
    result.status === 'applied' &&
    (origin.presentation === 'docked' || origin.presentation === 'maximized')
  ) {
    focusDockviewPanel(api, panelId);
  }
  return result.state;
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
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;
  target.activePanelId = panelId;
  target.isMaximized = false;
  target.dockedPanelIds = sortPanelIdsBySeedOrder(target.seedGroupId, [
    ...target.dockedPanelIds,
    panelId,
  ]);
  next.slideouts[target.edge].openPanelId = undefined;

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  if (result.status === 'applied') {
    focusDockviewPanel(api, panelId);
  }
  return result.state;
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
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;

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

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(getInstancesOnEdge(next, target.edge));
  if (result.status === 'applied' && activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return result.state;
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
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;

  const seedDef = AUXILIARY_SEED_DEFINITIONS[target.seedGroupId];
  target.panelIds = target.panelIds.filter((id) => id !== panelId);
  target.dockedPanelIds = target.dockedPanelIds.filter((id) => id !== panelId);
  target.isMaximized = false;
  target.activePanelId = target.panelIds[0] ?? seedDef.defaultActivePanelId;

  if (next.slideouts[target.edge].openPanelId === panelId) {
    next.slideouts[target.edge].openPanelId = undefined;
  }

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(getInstancesOnEdge(next, target.edge));
  if (result.status === 'applied' && activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return result.state;
}

export function resizeAuxiliaryGroupLayout(
  api: DockviewApi,
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
  action: AuxiliaryGroupSizeAction,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!target) return next;

  const currentSize = getLiveDockedSizeForEdge(api, target.edge, target.dockedSize);
  const requestedSize =
    action === 'reset'
      ? getDefaultDockedSizeForEdge(target.edge)
      : currentSize + (action === 'increase' ? 40 : -40);
  const nextSize = clampAuxiliaryDockedSize(target.edge, requestedSize);

  for (const instance of next.groups) {
    if (instance.edge === target.edge) {
      instance.dockedSize = nextSize;
    }
  }

  const liveGroup = getLiveAuxiliaryEdgeGroup(api, target.edge);
  if (!liveGroup || liveGroup.api.isMaximized()) {
    return next;
  }

  if (target.edge === 'bottom') {
    liveGroup.api.setSize({ height: nextSize });
  } else {
    liveGroup.api.setSize({ width: nextSize });
  }

  return syncAuxiliaryLayoutFromApi(api, next);
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

  return transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  }).state;
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

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  const activeDockedPanelId = getActiveDockedPanelId(target);
  if (result.status === 'applied' && activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return result.state;
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

  const result = transitionAuxiliaryLayout(api, state, next, {
    preserveDockedSizes: preservedDockedSizes,
  });
  const activeDockedPanelId = getActiveDockedPanelIdForEdge(getInstancesOnEdge(next, target.edge));
  if (result.status === 'applied' && activeDockedPanelId) {
    focusDockviewPanel(api, activeDockedPanelId);
  }
  return result.state;
}

export function syncAuxiliaryLayoutFromApi(
  api: DockviewApi,
  fallback: AuxiliaryLayoutState,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(fallback));

  for (const instance of next.groups) {
    const livePanels = instance.panelIds
      .map((panelId) => api.getPanel(panelId))
      .filter((panel): panel is IDockviewPanel => panel !== undefined);

    if (livePanels.some((panel) => panel.group.api.location.type === 'popout')) {
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
      getGroupInstanceForPanel(next, slideoutPanelId)?.groupInstanceId !== instance.groupInstanceId
    ) {
      const liveActivePanelId = liveGroup.activePanel?.id;
      instance.activePanelId =
        liveActivePanelId && livePanelIds.includes(liveActivePanelId)
          ? liveActivePanelId
          : (livePanelIds[0] ?? instance.activePanelId);
    }

    instance.dockedSize = getLiveDockedSizeForEdge(api, instance.edge, instance.dockedSize);

    const activeDockedPanelId = getActiveDockedPanelId(instance);
    const activeDockedPanel = activeDockedPanelId ? api.getPanel(activeDockedPanelId) : undefined;
    instance.isMaximized = Boolean(activeDockedPanel?.api.isMaximized());
  }

  return normalizeAuxiliaryLayoutState(next);
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

  const representative = instancesOnEdge.find((instance) => instance.dockedPanelIds.length > 0);
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
      inactive: activeDockedPanelId !== undefined && panelId !== activeDockedPanelId,
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
    if (panel?.group.api.location.type === 'grid') return panel;
  }
  return api.panels.find((panel) => panel.group.api.location.type === 'grid');
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

function getActiveDockedPanelId(instance: AuxiliaryGroupInstance): string | undefined {
  return instance.dockedPanelIds.includes(instance.activePanelId)
    ? instance.activePanelId
    : instance.dockedPanelIds[0];
}

function getActiveDockedPanelIdForEdge(instances: AuxiliaryGroupInstance[]): string | undefined {
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
