import { getPanel } from './panel-registry';
import type { PanelMode } from './panel-registry';

export type AuxiliaryEdge = 'left' | 'right' | 'bottom';
export type AuxiliaryGroupSizeAction = 'increase' | 'decrease' | 'reset';
export type AuxiliaryPanelMode = Extract<PanelMode, 'properties' | 'output'>;
export type AuxiliarySeedGroupId = 'properties-main' | 'output-main';
export type AuxiliaryGroupKind = 'seeded' | 'derived-singleton' | 'derived-group';
export type AuxiliaryPanelPresentation = 'docked' | 'minimized' | 'slideout' | 'maximized';

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

export interface AuxiliaryLayoutState {
  version: 5;
  groups: AuxiliaryGroupInstance[];
  slideouts: Record<AuxiliaryEdge, AuxiliaryEdgeSlideoutState>;
}

export const AUXILIARY_SEED_ORDER: AuxiliarySeedGroupId[] = ['properties-main', 'output-main'];

export const AUXILIARY_EDGE_ORDER: AuxiliaryEdge[] = ['left', 'right', 'bottom'];

export const AUXILIARY_SEED_DEFINITIONS: Record<AuxiliarySeedGroupId, AuxiliarySeedDefinition> = {
  'properties-main': {
    seedGroupId: 'properties-main',
    modeId: 'properties',
    defaultEdge: 'right',
    panelIds: [
      'ScratchPadTopComponent',
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'SoundFontViewerTopComponent',
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

export function getAuxiliarySeedGroupIdForPanel(panelId: string): AuxiliarySeedGroupId | undefined {
  const descriptor = getPanel(panelId);
  if (descriptor?.auxiliaryGroupId) {
    return descriptor.auxiliaryGroupId;
  }

  return AUXILIARY_SEED_ORDER.find((seedId) =>
    AUXILIARY_SEED_DEFINITIONS[seedId].panelIds.includes(panelId),
  );
}

export function getAuxiliaryGroupIdForPanel(panelId: string): AuxiliarySeedGroupId | undefined {
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

export function getDefaultDockedSizeForEdge(edge: AuxiliaryEdge): number {
  return edge === 'bottom'
    ? AUXILIARY_SEED_DEFINITIONS['output-main'].defaultDockedSize
    : AUXILIARY_SEED_DEFINITIONS['properties-main'].defaultDockedSize;
}

function getDockedSizeForEdge(state: AuxiliaryLayoutState, edge: AuxiliaryEdge): number {
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

  return state.slideouts[instance.edge].openPanelId === panelId ? 'slideout' : 'minimized';
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

export function getInstancesOnEdge(
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
  if (!instance || instance.edge !== edge || instance.dockedPanelIds.includes(openPanelId)) {
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

export function cloneAuxiliaryLayoutState(state: AuxiliaryLayoutState): AuxiliaryLayoutState {
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

export function toggleMinimizedAuxiliaryPanel(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryLayoutState {
  const instance = getGroupInstanceForPanel(state, panelId);
  if (!instance) {
    return cloneAuxiliaryLayoutState(state);
  }

  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;
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

export function hideAllAuxiliarySlideouts(state: AuxiliaryLayoutState): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));

  for (const edge of AUXILIARY_EDGE_ORDER) {
    next.slideouts[edge].openPanelId = undefined;
  }

  return normalizeAuxiliaryLayoutState(next);
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
  const target = next.groups.find((g) => g.groupInstanceId === instance.groupInstanceId)!;
  target.slideoutSize = clampSlideoutSize(target.edge, size);
  return normalizeAuxiliaryLayoutState(next);
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
  const sourceGroupIds = next.groups
    .filter((instance) => instance.edge === sourceEdge)
    .map((instance) => instance.groupInstanceId);

  for (const groupInstanceId of sourceGroupIds) {
    const instance = next.groups.find((candidate) => candidate.groupInstanceId === groupInstanceId);
    if (instance) {
      moveGroupInstanceToEdge(next, instance, targetEdge);
    }
  }

  next.slideouts[sourceEdge].openPanelId = undefined;
  next.slideouts[targetEdge].openPanelId = undefined;

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

  moveGroupInstanceToEdge(next, target, targetEdge);

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

  if (source.edge === targetEdge) {
    return next;
  }

  if (source.kind === 'derived-singleton') {
    return moveGroupToEdge(state, source.groupInstanceId, targetEdge);
  }

  movePanelOutOfGroup(next, source, panelId, targetEdge);

  return normalizeAuxiliaryLayoutState(next);
}

function moveGroupInstanceToEdge(
  state: AuxiliaryLayoutState,
  target: AuxiliaryGroupInstance,
  targetEdge: AuxiliaryEdge,
): void {
  if (target.edge === targetEdge) {
    return;
  }

  const openPanel = state.slideouts[target.edge].openPanelId;
  if (openPanel && target.panelIds.includes(openPanel)) {
    state.slideouts[target.edge].openPanelId = undefined;
  }

  if (target.kind !== 'seeded') {
    target.edge = targetEdge;
    state.slideouts[targetEdge].openPanelId = undefined;
    return;
  }

  if (target.panelIds.length === 0) {
    return;
  }

  const seedDef = AUXILIARY_SEED_DEFINITIONS[target.seedGroupId];
  const panelIds = [...target.panelIds];
  const dockedPanelIds = target.dockedPanelIds.filter((id) => panelIds.includes(id));
  const activePanelId = panelIds.includes(target.activePanelId)
    ? target.activePanelId
    : (dockedPanelIds[0] ?? panelIds[0]);
  const maxOrder = state.groups.reduce((max, g) => Math.max(max, g.displayOrder), -1);

  target.panelIds = [];
  target.dockedPanelIds = [];
  target.activePanelId = seedDef.defaultActivePanelId;
  target.isMaximized = false;

  state.groups.push({
    groupInstanceId:
      panelIds.length === 1
        ? `derived:${panelIds[0]}`
        : `derived-group:${target.seedGroupId}:${maxOrder + 1}`,
    seedGroupId: target.seedGroupId,
    kind: panelIds.length === 1 ? 'derived-singleton' : 'derived-group',
    edge: targetEdge,
    panelIds,
    dockedPanelIds,
    activePanelId,
    dockedSize: getDockedSizeForEdge(state, targetEdge),
    slideoutSize: seedDef.defaultSlideoutSize,
    isMaximized: false,
    displayOrder: maxOrder + 1,
  });

  state.slideouts[targetEdge].openPanelId = undefined;
}

function movePanelOutOfGroup(
  state: AuxiliaryLayoutState,
  source: AuxiliaryGroupInstance,
  panelId: string,
  targetEdge: AuxiliaryEdge,
): void {
  const seedDef = AUXILIARY_SEED_DEFINITIONS[source.seedGroupId];
  source.panelIds = source.panelIds.filter((id) => id !== panelId);
  source.dockedPanelIds = source.dockedPanelIds.filter((id) => id !== panelId);
  if (source.activePanelId === panelId) {
    source.activePanelId = source.panelIds[0] ?? seedDef.defaultActivePanelId;
  }

  if (state.slideouts[source.edge].openPanelId === panelId) {
    state.slideouts[source.edge].openPanelId = undefined;
  }

  if (source.kind === 'derived-group') {
    if (source.panelIds.length === 1) {
      source.kind = 'derived-singleton';
    } else if (source.panelIds.length === 0) {
      state.groups = state.groups.filter(
        (candidate) => candidate.groupInstanceId !== source.groupInstanceId,
      );
    }
  }

  const derivedId = `derived:${panelId}`;
  const maxOrder = state.groups.reduce((max, g) => Math.max(max, g.displayOrder), -1);

  state.groups.push({
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

  state.slideouts[targetEdge].openPanelId = undefined;
}

export function mergeBackToSeededGroup(
  state: AuxiliaryLayoutState,
  groupInstanceId: string,
): AuxiliaryLayoutState {
  const next = cloneAuxiliaryLayoutState(normalizeAuxiliaryLayoutState(state));
  const derived = next.groups.find((g) => g.groupInstanceId === groupInstanceId);
  if (!derived || (derived.kind !== 'derived-singleton' && derived.kind !== 'derived-group')) {
    return next;
  }

  const seeded = next.groups.find(
    (g) => g.kind === 'seeded' && g.seedGroupId === derived.seedGroupId,
  );
  if (!seeded) return next;

  const panelIds = [...derived.panelIds];
  const wasSeededEmpty = seeded.panelIds.length === 0;

  if (derived.panelIds.includes(next.slideouts[derived.edge].openPanelId ?? '')) {
    next.slideouts[derived.edge].openPanelId = undefined;
  }

  seeded.panelIds = sortPanelIdsBySeedOrder(seeded.seedGroupId, [...seeded.panelIds, ...panelIds]);
  seeded.dockedPanelIds = sortPanelIdsBySeedOrder(seeded.seedGroupId, [
    ...seeded.dockedPanelIds,
    ...derived.dockedPanelIds,
  ]);
  if (wasSeededEmpty) {
    seeded.activePanelId = derived.activePanelId;
  }

  next.groups = next.groups.filter((g) => g.groupInstanceId !== groupInstanceId);

  return normalizeAuxiliaryLayoutState(next);
}

export function resetAuxiliaryLayout(): AuxiliaryLayoutState {
  return createDefaultAuxiliaryLayoutState();
}

export function createDefaultSeededInstance(
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

export function createDefaultSlideouts(): Record<AuxiliaryEdge, AuxiliaryEdgeSlideoutState> {
  return {
    left: { edge: 'left' },
    right: { edge: 'right' },
    bottom: { edge: 'bottom' },
  };
}

/**
 * Migrate layouts written by the old edge-move implementation. That version
 * changed the seeded mode's edge directly, which made later panels of the
 * same mode reveal beside the moved panel. Seeded groups are now stable
 * default-mode anchors, so preserve the old panels in a derived group and
 * restore the seed to its Java Blue default edge.
 */

export function normalizeAuxiliaryLayoutState(state: AuxiliaryLayoutState): AuxiliaryLayoutState {
  const result: AuxiliaryGroupInstance[] = [];
  const usedPanelIds = new Set<string>();

  for (let i = 0; i < AUXILIARY_SEED_ORDER.length; i++) {
    const seedId = AUXILIARY_SEED_ORDER[i];
    const seedDef = AUXILIARY_SEED_DEFINITIONS[seedId];

    const candidate = state.groups?.find((g) => g.kind === 'seeded' && g.seedGroupId === seedId);

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
      if (candidate.kind !== 'derived-singleton' && candidate.kind !== 'derived-group') {
        continue;
      }

      const candidatePanelIds = asStringArray(candidate.panelIds);
      if (candidatePanelIds.length === 0) continue;

      const seedId = getAuxiliarySeedGroupIdForPanel(candidatePanelIds[0]);
      if (!seedId) continue;

      const panelIds = candidatePanelIds.filter(
        (panelId) =>
          getAuxiliarySeedGroupIdForPanel(panelId) === seedId && !usedPanelIds.has(panelId),
      );
      if (panelIds.length === 0) continue;

      const kind =
        candidate.kind === 'derived-group' || panelIds.length > 1
          ? 'derived-group'
          : 'derived-singleton';
      const edge = AUXILIARY_EDGE_ORDER.includes(candidate.edge) ? candidate.edge : 'left';
      const dockedPanelIds = Array.isArray(candidate.dockedPanelIds)
        ? sortPanelIdsBySeedOrder(seedId, asStringArray(candidate.dockedPanelIds)).filter(
            (panelId) => panelIds.includes(panelId),
          )
        : [];

      const normalized: AuxiliaryGroupInstance = {
        groupInstanceId:
          candidate.groupInstanceId ||
          (kind === 'derived-group'
            ? `derived-group:${seedId}:${result.length}`
            : `derived:${panelIds[0]}`),
        seedGroupId: seedId,
        kind,
        edge,
        panelIds: sortPanelIdsBySeedOrder(seedId, panelIds),
        dockedPanelIds,
        activePanelId: panelIds.includes(candidate.activePanelId)
          ? candidate.activePanelId
          : (dockedPanelIds[0] ?? panelIds[0]),
        dockedSize: Number.isFinite(candidate.dockedSize)
          ? candidate.dockedSize
          : AUXILIARY_SEED_DEFINITIONS[seedId].defaultDockedSize,
        slideoutSize:
          Number.isFinite(candidate.slideoutSize) && candidate.slideoutSize
            ? clampSlideoutSize(edge, candidate.slideoutSize)
            : AUXILIARY_SEED_DEFINITIONS[seedId].defaultSlideoutSize,
        isMaximized: Boolean(candidate.isMaximized),
        displayOrder: Number.isFinite(candidate.displayOrder)
          ? candidate.displayOrder
          : result.length,
      };

      for (const panelId of panelIds) {
        usedPanelIds.add(panelId);
      }
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

    const owner = result.find((inst) => inst.panelIds.includes(openPanelId) && inst.edge === edge);
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
  const declaredPanelIds = hasPanelIds ? asStringArray(candidate.panelIds) : [...seedDef.panelIds];
  const declaredDockedPanelIds = Array.isArray(candidate.dockedPanelIds)
    ? asStringArray(candidate.dockedPanelIds)
    : [];
  const effectivePanelIds = sortPanelIdsBySeedOrder(seedDef.seedGroupId, [
    ...declaredPanelIds,
    ...declaredDockedPanelIds,
  ]);

  const dockedPanelIds = Array.isArray(candidate.dockedPanelIds)
    ? sortPanelIdsBySeedOrder(seedDef.seedGroupId, asStringArray(candidate.dockedPanelIds)).filter(
        (pid) => effectivePanelIds.includes(pid),
      )
    : [...effectivePanelIds];

  const activePanelId = effectivePanelIds.includes(candidate.activePanelId)
    ? candidate.activePanelId
    : (dockedPanelIds[0] ?? effectivePanelIds[0] ?? seedDef.defaultActivePanelId);

  const edge = AUXILIARY_EDGE_ORDER.includes(candidate.edge) ? candidate.edge : seedDef.defaultEdge;

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

export function clampSlideoutSize(edge: AuxiliaryEdge, value: number): number {
  const viewportWidth = typeof window === 'undefined' ? 1440 : Math.max(window.innerWidth, 480);
  const viewportHeight = typeof window === 'undefined' ? 900 : Math.max(window.innerHeight, 320);

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

export function clampAuxiliaryDockedSize(edge: AuxiliaryEdge, value: number): number {
  const viewportWidth = typeof window === 'undefined' ? 1440 : Math.max(window.innerWidth, 480);
  const viewportHeight = typeof window === 'undefined' ? 900 : Math.max(window.innerHeight, 320);

  return clampNumber(value, {
    minimum: 120,
    maximum:
      edge === 'bottom' ? Math.max(120, viewportHeight - 96) : Math.max(120, viewportWidth - 120),
  });
}

function clampNumber(value: number, options: { minimum: number; maximum: number }): number {
  if (!Number.isFinite(value)) return options.minimum;
  return Math.min(Math.max(value, options.minimum), options.maximum);
}

export function sortPanelIdsBySeedOrder(
  seedGroupId: AuxiliarySeedGroupId,
  panelIds: string[],
): string[] {
  const order = AUXILIARY_SEED_DEFINITIONS[seedGroupId].panelIds;
  return unique(panelIds)
    .filter((panelId) => order.includes(panelId))
    .sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}
