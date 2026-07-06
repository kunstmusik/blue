import { describe, expect, it } from 'vitest';
import {
  applyAuxiliaryLayout,
  buildDefaultWorkbenchLayout,
  cloneAuxiliaryLayoutState,
  captureAuxiliaryDockedSizesFromApi,
  closeAuxiliaryPanelLayout,
  createDefaultAuxiliaryLayoutState,
  createStoredWorkbenchLayout,
  dockAuxiliaryPanel,
  getAuxiliaryGroupIdForPanel,
  getAuxiliaryPanelPresentation,
  getAuxiliarySlideoutForEdge,
  getGroupInstanceForPanel,
  getMinimizedTabsForEdge,
  hideAuxiliarySlideout,
  isAuxiliaryPanelId,
  mergeBackToSeededGroup,
  minimizeAuxiliaryPanelLayout,
  moveAuxiliaryEdge,
  moveGroupToEdge,
  movePanelToEdge,
  parseStoredWorkbenchLayout,
  resetAuxiliaryLayout,
  resizeAuxiliarySlideout,
  syncAuxiliaryLayoutFromApi,
  shouldPreventAuxiliaryPanelDrop,
  toggleMinimizedAuxiliaryPanel,
  type AuxiliaryGroupInstance,
  type AuxiliaryLayoutState,
} from '../components/workbench/auxiliary-layout';

const legacyDockview = {
  grid: {
    root: { type: 'branch' },
    height: 900,
    width: 1400,
    orientation: 'horizontal',
  },
  panels: {},
  activeGroup: 'group-1',
} as any;

function createDockviewApiStub() {
  const livePanels = new Map<string, any>();
  const groups = new Map<string, any>();

  function getOrCreateGroup(id: string) {
    if (groups.has(id)) return groups.get(id);
    const group = {
      id,
      size: 360,
      bounds: { width: 360, height: 228 },
      panels: [] as any[],
      activePanel: undefined as any,
      focus: () => undefined,
      api: {
        setSize: ({ width, height }: { width?: number; height?: number }) => {
          if (Number.isFinite(width)) {
            group.size = width as number;
            group.bounds.width = width as number;
          }
          if (Number.isFinite(height)) {
            group.size = height as number;
            group.bounds.height = height as number;
          }
        },
        isMaximized: () => false,
        setHeaderPosition: () => undefined,
        location: { type: 'grid' as const },
      },
      element: {
        dataset: {},
        getBoundingClientRect: () => ({
          width: group.bounds.width,
          height: group.bounds.height,
        }),
      },
      location: { type: 'grid' as const },
      locked: true,
    };
    groups.set(id, group);
    return group;
  }

  function insertPanel(panel: any, position: any, group: any) {
    const panels = [...group.panels];
    const index = position?.index ?? panels.length;
    panels.splice(index, 0, panel);
    group.panels = panels;
  }

  return {
    panels: [{ id: 'ScoreTopComponent' }],
    get groups() {
      return Array.from(groups.values());
    },
    addGroup: ({ id }: { id?: string }) => getOrCreateGroup(id || `g-${Date.now()}`),
    addPanel: ({
      id,
      inactive,
      position,
    }: {
      id: string;
      inactive?: boolean;
      position?: { referenceGroup?: any; index?: number };
    }) => {
      const refGroup = position?.referenceGroup || getOrCreateGroup(`g-${id}`);
    const panel = {
      id,
      title: id,
      api: {
        setActive: () => {
          refGroup.activePanel = panel;
        },
        setTitle: (title: string) => {
          panel.title = title;
        },
        isMaximized: () => false,
        close: () => {
          livePanels.delete(id);
            refGroup.panels = refGroup.panels.filter((entry: any) => entry.id !== id);
            if (refGroup.activePanel?.id === id) {
              refGroup.activePanel = refGroup.panels[0];
            }
          },
        },
        group: refGroup,
      };

      livePanels.set(id, panel);
      insertPanel(panel, position, refGroup);

      if (!inactive || !refGroup.activePanel) {
        refGroup.activePanel = panel;
      }

      return panel;
    },
    getPanel: (id: string) => livePanels.get(id),
    toJSON: () => legacyDockview,
  } as any;
}

function findSeeded(
  state: AuxiliaryLayoutState,
  seedId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find(
    (g) => g.kind === 'seeded' && g.seedGroupId === seedId,
  );
}

function findDerived(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find(
    (g) => g.kind === 'derived-singleton' && g.panelIds.includes(panelId),
  );
}

describe('workbench auxiliary layout helpers', () => {
  it('normalizes dockview panel titles to registry labels', () => {
    const api = createDockviewApiStub();

    buildDefaultWorkbenchLayout(api);

    expect(api.getPanel('ScoreTopComponent')?.title).toBe('Score');
    expect(api.getPanel('OrchestraTopComponent')?.title).toBe('Orchestra');
    expect(api.getPanel('GlobalOrchestraTopComponent')?.title).toBe(
      'Global Orchestra',
    );
    expect(api.getPanel('GlobalScoreTopComponent')?.title).toBe('Global Score');
    expect(api.getPanel('ProjectPropertiesTopComponent')?.title).toBe(
      'Project Properties',
    );
  });

  it('parses the version 5 workbench envelope and preserves per-tool metadata', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(auxiliary, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    propsGroup.activePanelId = 'SoundObjectPropertiesTopComponent';
    auxiliary.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary);
    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));

    expect(parsed.dockview).toEqual(legacyDockview);
    const parsedProps = findSeeded(parsed.auxiliary, 'properties-main')!;
    expect(parsedProps.dockedPanelIds).toEqual(['MidiInputPanelTopComponent']);
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe(
      'SoundObjectPropertiesTopComponent',
    );
  });

  it('upgrades the legacy version 3 group model into v5 seeded instances', () => {
    const legacy = {
      version: 3,
      dockview: legacyDockview,
      auxiliary: {
        version: 3,
        groups: {
          'properties-main': {
            panelIds: [
              'SoundObjectPropertiesTopComponent',
              'MidiInputPanelTopComponent',
            ],
            activePanelId: 'MidiInputPanelTopComponent',
            presentation: 'floating',
            dockedSize: 380,
            floatingBounds: { width: 420 },
          },
        },
      },
    };

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(legacy));

    const propsGroup = findSeeded(parsed.auxiliary, 'properties-main')!;
    expect(propsGroup.dockedPanelIds).toEqual([]);
    expect(propsGroup.slideoutSize).toBe(420);
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe(
      'MidiInputPanelTopComponent',
    );
    expect(propsGroup.kind).toBe('seeded');
  });

  it('upgrades the legacy version 4 group model into v5 seeded instances', () => {
    const legacy = {
      version: 4,
      dockview: legacyDockview,
      auxiliary: {
        version: 4,
        groups: {
          'properties-main': {
            id: 'properties-main',
            edge: 'right',
            mode: 'properties',
            panelIds: [
              'SoundObjectPropertiesTopComponent',
              'MidiInputPanelTopComponent',
            ],
            dockedPanelIds: ['MidiInputPanelTopComponent'],
            activePanelId: 'SoundObjectPropertiesTopComponent',
            dockedSize: 380,
            slideoutSize: 400,
            isMaximized: false,
          },
          'output-main': {
            id: 'output-main',
            edge: 'bottom',
            mode: 'output',
            panelIds: ['ScoreObjectEditorTopComponent', 'MixerTopComponent', 'VirtualKeyboardTopComponent'],
            dockedPanelIds: ['ScoreObjectEditorTopComponent', 'MixerTopComponent', 'VirtualKeyboardTopComponent'],
            activePanelId: 'ScoreObjectEditorTopComponent',
            dockedSize: 228,
            slideoutSize: 228,
            isMaximized: false,
          },
        },
        slideouts: {
          left: { edge: 'left' },
          right: { edge: 'right', openPanelId: 'SoundObjectPropertiesTopComponent' },
          bottom: { edge: 'bottom' },
        },
      },
    };

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(legacy));

    const propsGroup = findSeeded(parsed.auxiliary, 'properties-main')!;
    expect(propsGroup.kind).toBe('seeded');
    expect(propsGroup.edge).toBe('right');
    expect(propsGroup.dockedPanelIds).toEqual(['MidiInputPanelTopComponent']);
    expect(propsGroup.dockedSize).toBe(380);
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe(
      'SoundObjectPropertiesTopComponent',
    );

    const outputGroup = findSeeded(parsed.auxiliary, 'output-main')!;
    expect(outputGroup.kind).toBe('seeded');
    expect(outputGroup.edge).toBe('bottom');
    expect(outputGroup.panelIds).toEqual([
      'ScoreObjectEditorTopComponent',
      'MixerTopComponent',
      'VirtualKeyboardTopComponent',
    ]);
  });

  it('limits the parity slice to the prototype auxiliary panels', () => {
    expect(getAuxiliaryGroupIdForPanel('SoundObjectPropertiesTopComponent')).toBe(
      'properties-main',
    );
    expect(getAuxiliaryGroupIdForPanel('ScoreObjectEditorTopComponent')).toBe(
      'output-main',
    );
    expect(getAuxiliaryGroupIdForPanel('MarkersTopComponent')).toBe(
      'properties-main',
    );
    expect(isAuxiliaryPanelId('VirtualKeyboardTopComponent')).toBe(true);
  });

  it('derives minimized edge tabs and the active slideout panel from per-tool state', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const tabs = getMinimizedTabsForEdge(state, 'right');
    const slideout = getAuxiliarySlideoutForEdge(state, 'right');

    expect(tabs.map((tab) => tab.panelId)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
    ]);
    expect(tabs[0]?.isActivePanel).toBe(true);
    expect(slideout?.panelId).toBe('SoundObjectPropertiesTopComponent');
    expect(getAuxiliaryPanelPresentation(state, 'MidiInputPanelTopComponent')).toBe(
      'docked',
    );
    expect(
      getAuxiliaryPanelPresentation(state, 'SoundObjectPropertiesTopComponent'),
    ).toBe('slideout');
  });

  it('toggles minimized tabs open and closed without mutating docked tools', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];

    const opened = toggleMinimizedAuxiliaryPanel(
      state,
      'SoundObjectPropertiesTopComponent',
    );
    const closed = toggleMinimizedAuxiliaryPanel(
      opened,
      'SoundObjectPropertiesTopComponent',
    );

    expect(opened.slideouts.right.openPanelId).toBe(
      'SoundObjectPropertiesTopComponent',
    );
    const openedProps = findSeeded(opened, 'properties-main')!;
    expect(openedProps.dockedPanelIds).toEqual(['MidiInputPanelTopComponent']);
    expect(closed.slideouts.right.openPanelId).toBeUndefined();
  });

  it('docks a single slid-out tool without restoring the whole group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const api = createDockviewApiStub();

    const next = dockAuxiliaryPanel(
      api,
      state,
      'SoundObjectPropertiesTopComponent',
    );

    const nextProps = findSeeded(next, 'properties-main')!;
    expect(nextProps.dockedPanelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'MidiInputPanelTopComponent',
    ]);
    expect(next.slideouts.right.openPanelId).toBeUndefined();
  });

  it('minimizes a single docked tool without collapsing the whole edge', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    const next = minimizeAuxiliaryPanelLayout(
      api,
      applied,
      'SoundObjectPropertiesTopComponent',
    );

    const propsGroup = findSeeded(next, 'properties-main')!;
    expect(propsGroup.dockedPanelIds).toEqual([
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
    expect(getMinimizedTabsForEdge(next, 'right').map((tab) => tab.panelId)).toContain(
      'SoundObjectPropertiesTopComponent',
    );
  });

  it('captures live docked size when synchronizing from Dockview', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    const liveGroup = api.getPanel('SoundObjectPropertiesTopComponent')?.group;
    liveGroup.size = 472;
    liveGroup.bounds.width = 472;

    const synced = syncAuxiliaryLayoutFromApi(api, applied);

    expect(findSeeded(synced, 'properties-main')?.dockedSize).toBe(472);
  });

  it('updates slideout sizing and clearing independently of Dockview state', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const resized = resizeAuxiliarySlideout(
      state,
      'SoundObjectPropertiesTopComponent',
      512,
    );
    const hidden = hideAuxiliarySlideout(resized, 'right');

    const resizedProps = findSeeded(resized, 'properties-main')!;
    expect(resizedProps.slideoutSize).toBe(512);
    expect(hidden.slideouts.right.openPanelId).toBeUndefined();
  });

  it('creates default state with zero left-edge groups', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const leftGroups = state.groups.filter((g) => g.edge === 'left');
    expect(leftGroups).toEqual([]);
    expect(state.version).toBe(5);
  });

  it('seeds exactly two seeded group instances', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const seeded = state.groups.filter((g) => g.kind === 'seeded');
    expect(seeded).toHaveLength(2);
    expect(seeded.map((g) => g.seedGroupId).sort()).toEqual([
      'output-main',
      'properties-main',
    ]);
  });
});

describe('v4 to v5 migration', () => {
  it('preserves edge assignment and presentation state during migration', () => {
    const v4Stored = {
      version: 4,
      dockview: legacyDockview,
      auxiliary: {
        version: 4,
        groups: {
          'properties-main': {
            id: 'properties-main',
            edge: 'right',
            mode: 'properties',
            panelIds: [
              'SoundObjectPropertiesTopComponent',
              'MidiInputPanelTopComponent',
            ],
            dockedPanelIds: [],
            activePanelId: 'MidiInputPanelTopComponent',
            dockedSize: 340,
            slideoutSize: 400,
            isMaximized: false,
          },
          'output-main': {
            id: 'output-main',
            edge: 'bottom',
            mode: 'output',
            panelIds: ['ScoreObjectEditorTopComponent', 'MixerTopComponent', 'VirtualKeyboardTopComponent'],
            dockedPanelIds: ['ScoreObjectEditorTopComponent', 'MixerTopComponent', 'VirtualKeyboardTopComponent'],
            activePanelId: 'MixerTopComponent',
            dockedSize: 260,
            slideoutSize: 228,
            isMaximized: true,
          },
        },
        slideouts: {
          left: { edge: 'left' },
          right: { edge: 'right', openPanelId: 'MidiInputPanelTopComponent' },
          bottom: { edge: 'bottom' },
        },
      },
    };

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(v4Stored));

    expect(parsed.auxiliary.version).toBe(5);

    const propsGroup = findSeeded(parsed.auxiliary, 'properties-main')!;
    expect(propsGroup.kind).toBe('seeded');
    expect(propsGroup.edge).toBe('right');
    expect(propsGroup.dockedPanelIds).toEqual([]);
    expect(propsGroup.dockedSize).toBe(340);
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe(
      'MidiInputPanelTopComponent',
    );

    const outputGroup = findSeeded(parsed.auxiliary, 'output-main')!;
    expect(outputGroup.kind).toBe('seeded');
    expect(outputGroup.edge).toBe('bottom');
    expect(outputGroup.isMaximized).toBe(true);
    expect(outputGroup.activePanelId).toBe('MixerTopComponent');
  });
});

describe('canonical panel ownership invariants', () => {
  it('ensures each panel belongs to exactly one group instance', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const allPanelIds = state.groups.flatMap((g) => g.panelIds);
    const uniquePanelIds = new Set(allPanelIds);
    expect(allPanelIds.length).toBe(uniquePanelIds.size);
  });

  it('preserves panel uniqueness after move and split operations', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const api = createDockviewApiStub();

    const moved = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );

    const allPanelIds = moved.groups.flatMap((g) => g.panelIds);
    const uniquePanelIds = new Set(allPanelIds);
    expect(allPanelIds.length).toBe(uniquePanelIds.size);
  });

  it('preserves panel uniqueness after merge-back', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const split = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );
    const derived = findDerived(split, 'SoundObjectPropertiesTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    const allPanelIds = merged.groups.flatMap((g) => g.panelIds);
    const uniquePanelIds = new Set(allPanelIds);
    expect(allPanelIds.length).toBe(uniquePanelIds.size);
    expect(merged.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(0);
  });
});

describe('left-edge whole-group moves', () => {
  it('moves a seeded group to the left edge', () => {
    const state = createDefaultAuxiliaryLayoutState();

    const moved = moveGroupToEdge(state, 'properties-main', 'left');

    const propsGroup = findSeeded(moved, 'properties-main')!;
    expect(propsGroup.edge).toBe('left');
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });

  it('clears slideout for source edge when moving a group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];

    const moved = moveGroupToEdge(state, 'properties-main', 'left');

    expect(moved.slideouts.right.openPanelId).toBeUndefined();
    expect(moved.slideouts.left.openPanelId).toBeUndefined();
  });
});

describe('left-edge single-tool split', () => {
  it('creates a derived singleton when one tool splits from a multi-tool group', () => {
    const state = createDefaultAuxiliaryLayoutState();

    const moved = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );

    const derived = findDerived(moved, 'SoundObjectPropertiesTopComponent');
    expect(derived).toBeDefined();
    expect(derived!.kind).toBe('derived-singleton');
    expect(derived!.edge).toBe('left');
    expect(derived!.panelIds).toEqual(['SoundObjectPropertiesTopComponent']);
    expect(derived!.groupInstanceId).toBe('derived:SoundObjectPropertiesTopComponent');

    const remaining = findSeeded(moved, 'properties-main')!;
    expect(remaining.panelIds).toEqual([
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
    expect(remaining.edge).toBe('right');
  });

  it('moves whole group when singleton source has only one panel', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.panelIds = ['SoundObjectPropertiesTopComponent'];
    propsGroup.dockedPanelIds = ['SoundObjectPropertiesTopComponent'];

    const moved = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );

    const propsAfter = findSeeded(moved, 'properties-main')!;
    expect(propsAfter.edge).toBe('left');
    expect(moved.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(0);
  });

  it('preserves minimized derived singletons after normalization', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const moved = movePanelToEdge(
      state,
      'ScoreObjectEditorTopComponent',
      'left',
    );
    const derived = findDerived(moved, 'ScoreObjectEditorTopComponent')!;
    derived.dockedPanelIds = [];

    const normalized = moveAuxiliaryEdge(moved, 'left', 'left');
    const tabs = getMinimizedTabsForEdge(normalized, 'left');

    expect(tabs.map((tab) => tab.panelId)).toContain(
      'ScoreObjectEditorTopComponent',
    );
    expect(
      getGroupInstanceForPanel(normalized, 'ScoreObjectEditorTopComponent')
        ?.dockedPanelIds,
    ).toEqual([]);
  });
});

describe('reset layout', () => {
  it('discards derived singletons and re-seeds defaults', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const split = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );
    expect(split.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(1);

    const reset = resetAuxiliaryLayout();
    expect(reset.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(0);
    expect(reset.groups.filter((g) => g.edge === 'left')).toHaveLength(0);

    const propsGroup = findSeeded(reset, 'properties-main')!;
    expect(propsGroup.edge).toBe('right');
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });
});

describe('merge-back to seeded group', () => {
  it('merges a derived singleton back into its seeded sibling group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const split = movePanelToEdge(
      state,
      'SoundObjectPropertiesTopComponent',
      'left',
    );
    const derived = findDerived(split, 'SoundObjectPropertiesTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    expect(merged.groups.find((g) => g.groupInstanceId === derived.groupInstanceId)).toBeUndefined();

    const propsGroup = findSeeded(merged, 'properties-main')!;
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });

  it('preserves seeded panel ordering after merge-back', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const split = movePanelToEdge(
      state,
      'MidiInputPanelTopComponent',
      'left',
    );
    const derived = findDerived(split, 'MidiInputPanelTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    const propsGroup = findSeeded(merged, 'properties-main')!;
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });
});

describe('left-edge minimized tabs and slideout', () => {
  it('produces minimized tabs for a left-edge group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const propsGroup = findSeeded(moved, 'properties-main')!;
    propsGroup.dockedPanelIds = [];

    const tabs = getMinimizedTabsForEdge(moved, 'left');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((t) => t.panelId)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'SoundObjectLibraryTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });

  it('opens a left-edge slideout for a minimized tab', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const propsGroup = findSeeded(moved, 'properties-main')!;
    propsGroup.dockedPanelIds = [];

    const toggled = toggleMinimizedAuxiliaryPanel(
      moved,
      'SoundObjectPropertiesTopComponent',
    );

    expect(toggled.slideouts.left.openPanelId).toBe(
      'SoundObjectPropertiesTopComponent',
    );

    const slideout = getAuxiliarySlideoutForEdge(toggled, 'left');
    expect(slideout).toBeDefined();
    expect(slideout!.panelId).toBe('SoundObjectPropertiesTopComponent');
    expect(slideout!.edge).toBe('left');
  });

  it('derives correct presentation for left-edge panels', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const propsGroup = findSeeded(moved, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    moved.slideouts.left.openPanelId = 'SoundObjectPropertiesTopComponent';

    expect(getAuxiliaryPanelPresentation(moved, 'MidiInputPanelTopComponent')).toBe('docked');
    expect(getAuxiliaryPanelPresentation(moved, 'SoundObjectPropertiesTopComponent')).toBe('slideout');
  });
});

describe('edge independence', () => {
  it('left-edge actions do not corrupt right-edge or bottom-edge state', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const moved = moveGroupToEdge(state, 'properties-main', 'left');

    const rightTabs = getMinimizedTabsForEdge(moved, 'right');
    const bottomTabs = getMinimizedTabsForEdge(moved, 'bottom');
    expect(rightTabs).toHaveLength(0);
    expect(bottomTabs).toHaveLength(0);

    const outputGroup = findSeeded(moved, 'output-main')!;
    expect(outputGroup.edge).toBe('bottom');
    expect(outputGroup.panelIds).toEqual([
      'ScoreObjectEditorTopComponent',
      'MixerTopComponent',
      'BlueFileManagerTopComponent',
      'VirtualKeyboardTopComponent',
      'OutputTopComponent',
      'JavaScriptConsoleTopComponent',
      'JythonConsoleTopComponent',
      'ClojureConsoleTopComponent',
    ]);
  });

  it('moves all instances on a docked edge together', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const movedProps = moveGroupToEdge(state, 'properties-main', 'left');
    const movedOutputTool = movePanelToEdge(
      movedProps,
      'ScoreObjectEditorTopComponent',
      'left',
    );

    const moved = moveAuxiliaryEdge(movedOutputTool, 'left', 'right');

    expect(findSeeded(moved, 'properties-main')!.edge).toBe('right');
    expect(findDerived(moved, 'ScoreObjectEditorTopComponent')!.edge).toBe(
      'right',
    );
  });

  it('preserves docked widths and bottom height when reorganizing to the bottom edge', () => {
    const api = createDockviewApiStub();
    const leftState = movePanelToEdge(
      createDefaultAuxiliaryLayoutState(),
      'OutputTopComponent',
      'left',
    );
    applyAuxiliaryLayout(api, leftState);

    const propsGroup = findSeeded(leftState, 'properties-main')!;
    const outputGroup = findSeeded(leftState, 'output-main')!;
    propsGroup.dockedSize = 420;
    outputGroup.dockedSize = 260;

    const liveRightGroup = api.groups.find(
      (group) => group.id === 'blue-aux-edge-right',
    )!;
    const liveBottomGroup = api.groups.find(
      (group) => group.id === 'blue-aux-edge-bottom',
    )!;
    liveRightGroup.size = 512;
    liveRightGroup.bounds.width = 512;
    liveBottomGroup.size = 300;
    liveBottomGroup.bounds.height = 300;

    const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(
      api,
      leftState,
    );

    const moved = applyAuxiliaryLayout(
      api,
      movePanelToEdge(leftState, 'OutputTopComponent', 'bottom'),
      { preserveDockedSizes: preservedDockedSizes },
    );

    expect(findSeeded(moved, 'properties-main')!.dockedSize).toBe(512);
    expect(findSeeded(moved, 'output-main')!.dockedSize).toBe(300);
    expect(findSeeded(moved, 'output-main')!.edge).toBe('bottom');
  });

  it('captures and syncs rendered edge bounds instead of Dockview axis size', () => {
    const api = createDockviewApiStub();
    const state = applyAuxiliaryLayout(api, createDefaultAuxiliaryLayoutState());

    const rightGroup = api.groups.find(
      (group: any) => group.id === 'blue-aux-edge-right',
    )!;
    const bottomGroup = api.groups.find(
      (group: any) => group.id === 'blue-aux-edge-bottom',
    )!;

    rightGroup.size = 120;
    rightGroup.bounds.width = 444;
    bottomGroup.size = 900;
    bottomGroup.bounds.height = 252;

    const captured = captureAuxiliaryDockedSizesFromApi(api, state);
    expect(captured.right).toBe(444);
    expect(captured.bottom).toBe(252);

    const synced = syncAuxiliaryLayoutFromApi(api, state);
    expect(findSeeded(synced, 'properties-main')!.dockedSize).toBe(444);
    expect(findSeeded(synced, 'output-main')!.dockedSize).toBe(252);
  });
});

describe('auxiliary panel drop policy', () => {
  it('allows edge drops for auxiliary panels', () => {
    expect(
      shouldPreventAuxiliaryPanelDrop(
        'OutputTopComponent',
        undefined,
        'edge',
      ),
    ).toBe(false);
  });

  it('allows drops into auxiliary dockview groups', () => {
    expect(
      shouldPreventAuxiliaryPanelDrop(
        'OutputTopComponent',
        'blue-aux-edge-left',
        'tab',
      ),
    ).toBe(false);
  });

  it('blocks drops into non-auxiliary center groups', () => {
    expect(
      shouldPreventAuxiliaryPanelDrop(
        'OutputTopComponent',
        'group-1',
        'content',
      ),
    ).toBe(true);
  });
});

describe('cloneAuxiliaryLayoutState', () => {
  it('produces a deep clone that does not share arrays with the source', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const clone = cloneAuxiliaryLayoutState(state);

    const origGroup = state.groups[0];
    const cloneGroup = clone.groups[0];
    expect(origGroup.panelIds).not.toBe(cloneGroup.panelIds);
    expect(origGroup.dockedPanelIds).not.toBe(cloneGroup.dockedPanelIds);
    expect(origGroup.panelIds).toEqual(cloneGroup.panelIds);
  });
});

describe('closeAuxiliaryPanelLayout', () => {
  it('removes a docked panel from the auxiliary layout and closes the dockview panel', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeDefined();

    const next = closeAuxiliaryPanelLayout(
      api,
      applied,
      'SoundObjectPropertiesTopComponent',
    );

    const propsGroup = findSeeded(next, 'properties-main')!;
    expect(propsGroup.panelIds).not.toContain('SoundObjectPropertiesTopComponent');
    expect(propsGroup.dockedPanelIds).not.toContain('SoundObjectPropertiesTopComponent');
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeUndefined();
  });

  it('clears the slideout if the closed panel was slideout-open', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.dockedPanelIds = ['MidiInputPanelTopComponent'];
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    const next = closeAuxiliaryPanelLayout(
      api,
      applied,
      'SoundObjectPropertiesTopComponent',
    );

    expect(next.slideouts.right.openPanelId).toBeUndefined();
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeUndefined();
  });
});

describe('auxiliary 200px controlled-pane defaults (Java Blue parity)', () => {
  it('uses 200px for the side (properties) auxiliary default docked size', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = state.groups.find((g) => g.seedGroupId === 'properties-main')!;
    expect(properties.dockedSize).toBe(200);
    expect(properties.slideoutSize).toBe(200);
  });

  it('uses 200px for the bottom (output) auxiliary default docked size', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const output = state.groups.find((g) => g.seedGroupId === 'output-main')!;
    expect(output.dockedSize).toBe(200);
    expect(output.slideoutSize).toBe(200);
  });

  it('returns 200px for every edge through getDefaultDockedSizeForEdge equivalents', () => {
    const state = createDefaultAuxiliaryLayoutState();
    for (const edge of ['left', 'right', 'bottom'] as const) {
      const sizes = captureAuxiliaryDockedSizesFromApi(
        createDockviewApiStub(),
        state,
      );
      expect(sizes[edge]).toBe(200);
    }
  });
});
