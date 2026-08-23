import type { SerializedDockview } from 'dockview';
import type { DockingOrigin } from '../../../shared/workbench-window-contract';
import {
  AUXILIARY_EDGE_ORDER,
  AUXILIARY_SEED_DEFINITIONS,
  AUXILIARY_SEED_ORDER,
  asStringArray,
  clampSlideoutSize,
  cloneAuxiliaryLayoutState,
  createDefaultSeededInstance,
  normalizeAuxiliaryLayoutState,
  sortPanelIdsBySeedOrder,
  type AuxiliaryEdge,
  type AuxiliaryEdgeSlideoutState,
  type AuxiliaryGroupInstance,
  type AuxiliaryLayoutState,
  type AuxiliaryPanelMode,
  type AuxiliarySeedGroupId,
} from './auxiliary-layout-model';

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

/**
 * Migrate layouts written by the old edge-move implementation. That version
 * changed the seeded mode's edge directly, which made later panels of the
 * same mode reveal beside the moved panel. Seeded groups are now stable
 * default-mode anchors, so preserve the old panels in a derived group and
 * restore the seed to its Java Blue default edge.
 */
export function normalizeStoredAuxiliaryLayoutState(state: AuxiliaryLayoutState): AuxiliaryLayoutState {
  const normalized = normalizeAuxiliaryLayoutState(state);
  const next = cloneAuxiliaryLayoutState(normalized);
  let maxOrder = next.groups.reduce((max, group) => Math.max(max, group.displayOrder), -1);

  for (const seedId of AUXILIARY_SEED_ORDER) {
    const seed = next.groups.find(
      (group) => group.kind === 'seeded' && group.seedGroupId === seedId,
    );
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];
    if (!seed || seed.edge === seedDef.defaultEdge) {
      continue;
    }

    const sourceEdge = seed.edge;
    const panelIds = [...seed.panelIds];
    const dockedPanelIds = seed.dockedPanelIds.filter((panelId) => panelIds.includes(panelId));
    const activePanelId = panelIds.includes(seed.activePanelId)
      ? seed.activePanelId
      : (dockedPanelIds[0] ?? panelIds[0] ?? seedDef.defaultActivePanelId);
    const dockedSize = seed.dockedSize;
    const slideoutSize = seed.slideoutSize;
    const openPanelId = next.slideouts[sourceEdge].openPanelId;

    next.slideouts[sourceEdge].openPanelId = undefined;

    seed.edge = seedDef.defaultEdge;
    seed.panelIds = [];
    seed.dockedPanelIds = [];
    seed.activePanelId = seedDef.defaultActivePanelId;
    seed.dockedSize = seedDef.defaultDockedSize;
    seed.slideoutSize = seedDef.defaultSlideoutSize;
    seed.isMaximized = false;

    if (panelIds.length === 0) {
      continue;
    }

    const kind = panelIds.length > 1 ? 'derived-group' : 'derived-singleton';
    let groupInstanceId =
      kind === 'derived-singleton' ? `derived:${panelIds[0]}` : `derived-group:${seedId}:migrated`;
    let suffix = 1;
    while (next.groups.some((group) => group.groupInstanceId === groupInstanceId)) {
      groupInstanceId = `derived-group:${seedId}:migrated-${suffix}`;
      suffix += 1;
    }

    next.groups.push({
      groupInstanceId,
      seedGroupId: seedId,
      kind,
      edge: sourceEdge,
      panelIds,
      dockedPanelIds,
      activePanelId,
      dockedSize,
      slideoutSize,
      isMaximized: false,
      displayOrder: ++maxOrder,
    });

    if (openPanelId && panelIds.includes(openPanelId) && !dockedPanelIds.includes(openPanelId)) {
      next.slideouts[sourceEdge].openPanelId = openPanelId;
    }
  }

  return normalizeAuxiliaryLayoutState(next);
}

export function upgradeV4ToV5(legacy: LegacyAuxiliaryLayoutStateV4): AuxiliaryLayoutState {
  const groups: AuxiliaryGroupInstance[] = [];

  for (let i = 0; i < AUXILIARY_SEED_ORDER.length; i++) {
    const seedId = AUXILIARY_SEED_ORDER[i];
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];
    const candidate = legacy.groups?.[seedId];

    if (!candidate) {
      groups.push(createDefaultSeededInstance(seedId, i));
      continue;
    }

    const panelIds = sortPanelIdsBySeedOrder(seedId, asStringArray(candidate.panelIds));

    const effectivePanelIds = panelIds.length > 0 ? panelIds : [...seedDef.panelIds];

    const dockedPanelIds = Array.isArray(candidate.dockedPanelIds)
      ? sortPanelIdsBySeedOrder(seedId, asStringArray(candidate.dockedPanelIds)).filter((pid) =>
          effectivePanelIds.includes(pid),
        )
      : [...effectivePanelIds];

    const activePanelId = effectivePanelIds.includes(candidate.activePanelId ?? '')
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

      const owner = groups.find((g) => g.panelIds.includes(openPanelId) && g.edge === edge);
      if (!owner) continue;
      if (owner.dockedPanelIds.includes(openPanelId)) continue;

      slideouts[edge].openPanelId = openPanelId;
      owner.activePanelId = openPanelId;
    }
  }

  return { version: 5, groups, slideouts };
}

export function upgradeV3ToV5(legacy: LegacyAuxiliaryLayoutStateV3): AuxiliaryLayoutState {
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
    const effectivePanelIds = panelIds.length > 0 ? panelIds : [...seedDef.panelIds];

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
    groups: v4StyleGroups as Record<AuxiliarySeedGroupId, LegacyAuxiliaryGroupSessionV4>,
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
        v4State.slideouts[seedDef_edge(seedId)].openPanelId = candidate.activePanelId;
      }
    }
  }

  return upgradeV4ToV5(v4State);
}

function seedDef_edge(seedId: AuxiliarySeedGroupId): AuxiliaryEdge {
  return AUXILIARY_SEED_DEFINITIONS[seedId].defaultEdge;
}

export function upgradeV2ToV5(legacy: LegacyAuxiliaryLayoutStateV2): AuxiliaryLayoutState {
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
    const panelIds = sortPanelIdsBySeedOrder('properties-main', right.panelIds ?? []);
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
    const panelIds = sortPanelIdsBySeedOrder('output-main', bottom.panelIds ?? []);
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
    groups: v4StyleGroups as Record<AuxiliarySeedGroupId, LegacyAuxiliaryGroupSessionV4>,
    slideouts: {
      left: { edge: 'left' },
      right: { edge: 'right' },
      bottom: { edge: 'bottom' },
    },
  });
}

export function isLegacyStoredWorkbenchLayoutV6(value: unknown): value is LegacyStoredWorkbenchLayoutV6 {
  return (
    isRecord(value) &&
    value.version === 6 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

export function isLegacyStoredWorkbenchLayoutV5(value: unknown): value is LegacyStoredWorkbenchLayoutV5 {
  return (
    isRecord(value) &&
    value.version === 5 &&
    isSerializedDockview(value.dockview) &&
    isAuxiliaryLayoutStateV5(value.auxiliary)
  );
}

export function isLegacyStoredWorkbenchLayoutV4(value: unknown): value is LegacyStoredWorkbenchLayoutV4 {
  return (
    isRecord(value) &&
    value.version === 4 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary) &&
    isRecord(value.auxiliary.groups) &&
    isRecord(value.auxiliary.slideouts)
  );
}

export function isLegacyStoredWorkbenchLayoutV3(value: unknown): value is LegacyStoredWorkbenchLayoutV3 {
  return (
    isRecord(value) &&
    value.version === 3 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary)
  );
}

export function isLegacyStoredWorkbenchLayoutV2(value: unknown): value is LegacyStoredWorkbenchLayoutV2 {
  return (
    isRecord(value) &&
    value.version === 2 &&
    isSerializedDockview(value.dockview) &&
    isRecord(value.auxiliary)
  );
}

export function isAuxiliaryLayoutStateV5(value: unknown): value is AuxiliaryLayoutState {
  return (
    isRecord(value) &&
    value.version === 5 &&
    Array.isArray(value.groups) &&
    isRecord(value.slideouts)
  );
}

export function isSerializedDockview(value: unknown): value is SerializedDockview {
  return isRecord(value) && isRecord(value.grid) && isRecord(value.panels);
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
