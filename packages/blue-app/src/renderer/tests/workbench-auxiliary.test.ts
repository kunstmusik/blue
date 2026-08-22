// @vitest-environment jsdom

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
  maximizeAuxiliaryGroupLayout,
  mergeBackToSeededGroup,
  minimizeAuxiliaryGroupLayout,
  minimizeAuxiliaryPanelLayout,
  moveAuxiliaryEdge,
  moveGroupToEdge,
  movePanelToEdge,
  parseStoredWorkbenchLayout,
  revealAuxiliaryPanel,
  resetAuxiliaryLayout,
  restoreAuxiliaryGroupLayout,
  restoreClosedAuxiliaryPanel,
  resizeAuxiliaryGroupLayout,
  resizeAuxiliarySlideout,
  syncAuxiliaryLayoutFromApi,
  shouldPreventAuxiliaryPanelDrop,
  toggleMinimizedAuxiliaryPanel,
  transitionAuxiliaryLayout,
  type AuxiliaryGroupInstance,
  type AuxiliaryLayoutState,
} from '../components/workbench/auxiliary-layout';
import { acquireTreeDndManager } from '../components/tree/tree-dnd-domain';

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
        isMaximized: () => Boolean((group as any).maximized),
        maximize: () => {
          (group as any).maximized = true;
        },
        exitMaximized: () => {
          (group as any).maximized = false;
        },
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
    addGroup: ({
      id,
      initialWidth,
      initialHeight,
    }: {
      id?: string;
      initialWidth?: number;
      initialHeight?: number;
    }) => {
      const group = getOrCreateGroup(id || `g-${Date.now()}`);
      if (Number.isFinite(initialWidth)) {
        group.size = initialWidth as number;
        group.bounds.width = initialWidth as number;
      }
      if (Number.isFinite(initialHeight)) {
        group.size = initialHeight as number;
        group.bounds.height = initialHeight as number;
      }
      return group;
    },
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
            panel.group.activePanel = panel;
          },
          setTitle: (title: string) => {
            panel.title = title;
          },
          isMaximized: () => Boolean((panel.group as any).maximized),
          maximize: () => {
            (panel.group as any).maximized = true;
          },
          close: () => {
            livePanels.delete(id);
            panel.group.panels = panel.group.panels.filter((entry: any) => entry.id !== id);
            if (panel.group.activePanel?.id === id) {
              panel.group.activePanel = panel.group.panels[0];
            }
          },
          moveTo: ({ group: targetGroup, index }: { group: any; index?: number }) => {
            const previous = panel.group;
            previous.panels = previous.panels.filter((entry: any) => entry.id !== id);
            if (previous.activePanel?.id === id) {
              previous.activePanel = previous.panels[0];
            }
            panel.group = targetGroup;
            insertPanel(panel, { index }, targetGroup);
            livePanels.set(id, panel);
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
    removeGroup: (group: any) => {
      groups.delete(group.id);
    },
    toJSON: () => legacyDockview,
  } as any;
}

function findSeeded(
  state: AuxiliaryLayoutState,
  seedId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find((g) => g.kind === 'seeded' && g.seedGroupId === seedId);
}

const ALL_PROPERTY_PANEL_IDS = [
  'SoundObjectPropertiesTopComponent',
  'LibrariesTopComponent',
  'AudioFilePlayerTopComponent',
  'MarkersTopComponent',
  'MidiInputPanelTopComponent',
];

const ALL_OUTPUT_PANEL_IDS = [
  'ScoreObjectEditorTopComponent',
  'MixerTopComponent',
  'BlueFileManagerTopComponent',
  'VirtualKeyboardTopComponent',
  'OutputTopComponent',
  'JavaScriptConsoleTopComponent',
  'JythonConsoleTopComponent',
  'ClojureConsoleTopComponent',
];

function seedGroupPanels(
  state: AuxiliaryLayoutState,
  seedId: string,
  panelIds: string[],
  dockedPanelIds = panelIds,
) {
  const group = findSeeded(state, seedId)!;
  group.panelIds = [...panelIds];
  group.dockedPanelIds = [...dockedPanelIds];
  group.activePanelId = dockedPanelIds[0] ?? panelIds[0] ?? group.activePanelId;
  return group;
}

function findDerived(
  state: AuxiliaryLayoutState,
  panelId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find((g) => g.kind === 'derived-singleton' && g.panelIds.includes(panelId));
}

function findDerivedGroup(
  state: AuxiliaryLayoutState,
  seedId: string,
): AuxiliaryGroupInstance | undefined {
  return state.groups.find((g) => g.kind === 'derived-group' && g.seedGroupId === seedId);
}

describe('workbench auxiliary layout helpers', () => {
  it('uses Java Blue startup visibility for auxiliary defaults', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(state, 'properties-main')!;
    const output = findSeeded(state, 'output-main')!;

    expect(properties.panelIds).toEqual([]);
    expect(properties.dockedPanelIds).toEqual([]);
    expect(properties.dockedSize).toBe(200);
    expect(output.panelIds).toEqual(['OutputTopComponent']);
    expect(output.dockedPanelIds).toEqual(['OutputTopComponent']);
    expect(output.activePanelId).toBe('OutputTopComponent');
    expect(output.dockedSize).toBe(200);
    expect(getMinimizedTabsForEdge(state, 'right')).toEqual([]);
    expect(getMinimizedTabsForEdge(state, 'bottom')).toEqual([]);
  });

  it('adds non-startup tools only after an explicit reveal', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const api = createDockviewApiStub();

    const revealed = revealAuxiliaryPanel(api, state, 'JavaScriptConsoleTopComponent');
    const output = findSeeded(revealed, 'output-main')!;

    expect(output.panelIds).toEqual(['OutputTopComponent', 'JavaScriptConsoleTopComponent']);
    expect(output.dockedPanelIds).toEqual(['OutputTopComponent', 'JavaScriptConsoleTopComponent']);
    expect(getMinimizedTabsForEdge(revealed, 'bottom')).toEqual([]);
  });

  it('normalizes dockview panel titles to registry labels', () => {
    const api = createDockviewApiStub();

    buildDefaultWorkbenchLayout(api);

    expect(api.getPanel('ScoreTopComponent')?.title).toBe('Score');
    expect(api.getPanel('OrchestraTopComponent')?.title).toBe('Orchestra');
    expect(api.getPanel('GlobalOrchestraTopComponent')?.title).toBe('Global Orchestra');
    expect(api.getPanel('GlobalScoreTopComponent')?.title).toBe('Global Score');
    expect(api.getPanel('ProjectPropertiesTopComponent')?.title).toBe('Project Properties');
  });

  it('parses the version 5 workbench envelope and preserves per-tool metadata', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const propsGroup = seedGroupPanels(
      auxiliary,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );
    propsGroup.activePanelId = 'SoundObjectPropertiesTopComponent';
    auxiliary.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary);
    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));

    expect(parsed.dockview).toEqual(legacyDockview);
    const parsedProps = findSeeded(parsed.auxiliary, 'properties-main')!;
    expect(parsedProps.dockedPanelIds).toEqual(['MidiInputPanelTopComponent']);
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe('SoundObjectPropertiesTopComponent');
  });

  it('upgrades the legacy version 3 group model into v5 seeded instances', () => {
    const legacy = {
      version: 3,
      dockview: legacyDockview,
      auxiliary: {
        version: 3,
        groups: {
          'properties-main': {
            panelIds: ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
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
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe('MidiInputPanelTopComponent');
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
            panelIds: ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
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
            panelIds: [
              'ScoreObjectEditorTopComponent',
              'MixerTopComponent',
              'VirtualKeyboardTopComponent',
            ],
            dockedPanelIds: [
              'ScoreObjectEditorTopComponent',
              'MixerTopComponent',
              'VirtualKeyboardTopComponent',
            ],
            activePanelId: 'ScoreObjectEditorTopComponent',
            dockedSize: 228,
            slideoutSize: 228,
            isMaximized: false,
          },
        },
        slideouts: {
          left: { edge: 'left' },
          right: {
            edge: 'right',
            openPanelId: 'SoundObjectPropertiesTopComponent',
          },
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
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe('SoundObjectPropertiesTopComponent');

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
    expect(getAuxiliaryGroupIdForPanel('ScoreObjectEditorTopComponent')).toBe('output-main');
    expect(getAuxiliaryGroupIdForPanel('MarkersTopComponent')).toBe('properties-main');
    expect(isAuxiliaryPanelId('VirtualKeyboardTopComponent')).toBe(true);
  });

  it('keeps the File Manager a single stable output auxiliary identity for layout restore (SPEC 076)', () => {
    expect(isAuxiliaryPanelId('BlueFileManagerTopComponent')).toBe(true);
    expect(getAuxiliaryGroupIdForPanel('BlueFileManagerTopComponent')).toBe('output-main');
    // Restoring a saved layout must reuse one seed group instance rather than
    // creating a duplicate File Manager registration.
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'output-main', ['BlueFileManagerTopComponent'], []);
    const hosting = state.groups.filter((group) =>
      group.panelIds.includes('BlueFileManagerTopComponent'));
    expect(hosting).toHaveLength(1);
    expect(getGroupInstanceForPanel(state, 'BlueFileManagerTopComponent')).toBe(hosting[0]);
  });

  it('derives minimized edge tabs and the active slideout panel from per-tool state', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS, [
      'MidiInputPanelTopComponent',
    ]);
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const tabs = getMinimizedTabsForEdge(state, 'right');
    const slideout = getAuxiliarySlideoutForEdge(state, 'right');

    expect(tabs.map((tab) => tab.panelId)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
    ]);
    expect(tabs[0]?.isActivePanel).toBe(true);
    expect(slideout?.panelId).toBe('SoundObjectPropertiesTopComponent');
    expect(getAuxiliaryPanelPresentation(state, 'MidiInputPanelTopComponent')).toBe('docked');
    expect(getAuxiliaryPanelPresentation(state, 'SoundObjectPropertiesTopComponent')).toBe(
      'slideout',
    );
  });

  it('toggles minimized tabs open and closed without mutating docked tools', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );

    const opened = toggleMinimizedAuxiliaryPanel(state, 'SoundObjectPropertiesTopComponent');
    const closed = toggleMinimizedAuxiliaryPanel(opened, 'SoundObjectPropertiesTopComponent');

    expect(opened.slideouts.right.openPanelId).toBe('SoundObjectPropertiesTopComponent');
    const openedProps = findSeeded(opened, 'properties-main')!;
    expect(openedProps.dockedPanelIds).toEqual(['MidiInputPanelTopComponent']);
    expect(closed.slideouts.right.openPanelId).toBeUndefined();
  });

  it('docks a single slid-out tool without restoring the whole group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const api = createDockviewApiStub();

    const next = dockAuxiliaryPanel(api, state, 'SoundObjectPropertiesTopComponent');

    const nextProps = findSeeded(next, 'properties-main')!;
    expect(nextProps.dockedPanelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'MidiInputPanelTopComponent',
    ]);
    expect(next.slideouts.right.openPanelId).toBeUndefined();
  });

  it('minimizes a single docked tool without collapsing the whole edge', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const initialProps = findSeeded(state, 'properties-main')!;
    initialProps.panelIds = [
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ];
    initialProps.dockedPanelIds = [...initialProps.panelIds];
    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    const next = minimizeAuxiliaryPanelLayout(api, applied, 'SoundObjectPropertiesTopComponent');

    const propsGroup = findSeeded(next, 'properties-main')!;
    expect(propsGroup.dockedPanelIds).toEqual([
      'LibrariesTopComponent',
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
    seedGroupPanels(state, 'properties-main', ['SoundObjectPropertiesTopComponent']);
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
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';

    const resized = resizeAuxiliarySlideout(state, 'SoundObjectPropertiesTopComponent', 512);
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
    expect(seeded.map((g) => g.seedGroupId).sort()).toEqual(['output-main', 'properties-main']);
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
            panelIds: ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
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
            panelIds: [
              'ScoreObjectEditorTopComponent',
              'MixerTopComponent',
              'VirtualKeyboardTopComponent',
            ],
            dockedPanelIds: [
              'ScoreObjectEditorTopComponent',
              'MixerTopComponent',
              'VirtualKeyboardTopComponent',
            ],
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
    expect(parsed.auxiliary.slideouts.right.openPanelId).toBe('MidiInputPanelTopComponent');

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
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const api = createDockviewApiStub();

    const moved = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');

    const allPanelIds = moved.groups.flatMap((g) => g.panelIds);
    const uniquePanelIds = new Set(allPanelIds);
    expect(allPanelIds.length).toBe(uniquePanelIds.size);
  });

  it('preserves panel uniqueness after merge-back', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const split = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');
    const derived = findDerived(split, 'SoundObjectPropertiesTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    const allPanelIds = merged.groups.flatMap((g) => g.panelIds);
    const uniquePanelIds = new Set(allPanelIds);
    expect(allPanelIds.length).toBe(uniquePanelIds.size);
    expect(merged.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(0);
  });
});

describe('left-edge whole-group moves', () => {
  it('moves seeded panels into a derived group without moving the seed', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);

    const moved = moveGroupToEdge(state, 'properties-main', 'left');

    const propsGroup = findSeeded(moved, 'properties-main')!;
    expect(propsGroup.edge).toBe('right');
    expect(propsGroup.panelIds).toEqual([]);

    expect(findDerivedGroup(moved, 'properties-main')).toMatchObject({
      edge: 'left',
      panelIds: [
        'SoundObjectPropertiesTopComponent',
        'LibrariesTopComponent',
        'AudioFilePlayerTopComponent',
        'MarkersTopComponent',
        'MidiInputPanelTopComponent',
      ],
      dockedPanelIds: ALL_PROPERTY_PANEL_IDS,
    });
  });

  it('clears slideout for source edge when moving a group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    state.slideouts.right.openPanelId = 'SoundObjectPropertiesTopComponent';
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );

    const moved = moveGroupToEdge(state, 'properties-main', 'left');

    expect(moved.slideouts.right.openPanelId).toBeUndefined();
    expect(moved.slideouts.left.openPanelId).toBeUndefined();
  });

  it('keeps later Properties reveals in the seeded right-side mode', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);

    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const opened = revealAuxiliaryPanel(
      createDockviewApiStub(),
      moved,
      'SoundFontViewerTopComponent',
    );

    expect(findDerivedGroup(opened, 'properties-main')?.edge).toBe('left');
    expect(findSeeded(opened, 'properties-main')).toMatchObject({
      edge: 'right',
      panelIds: ['SoundFontViewerTopComponent'],
    });
  });

  it('keeps the Output seed stable when moving its group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'output-main', ALL_OUTPUT_PANEL_IDS);

    const moved = moveGroupToEdge(state, 'output-main', 'left');

    expect(findSeeded(moved, 'output-main')).toMatchObject({
      edge: 'bottom',
      panelIds: [],
    });
    expect(findDerivedGroup(moved, 'output-main')).toMatchObject({
      edge: 'left',
      panelIds: ALL_OUTPUT_PANEL_IDS,
      dockedPanelIds: ALL_OUTPUT_PANEL_IDS,
    });
  });
});

describe('left-edge single-tool split', () => {
  it('creates a derived singleton when one tool splits from a multi-tool group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);

    const moved = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');

    const derived = findDerived(moved, 'SoundObjectPropertiesTopComponent');
    expect(derived).toBeDefined();
    expect(derived!.kind).toBe('derived-singleton');
    expect(derived!.edge).toBe('left');
    expect(derived!.panelIds).toEqual(['SoundObjectPropertiesTopComponent']);
    expect(derived!.groupInstanceId).toBe('derived:SoundObjectPropertiesTopComponent');

    const remaining = findSeeded(moved, 'properties-main')!;
    expect(remaining.panelIds).toEqual([
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
    expect(remaining.edge).toBe('right');
  });

  it('moves a sole seeded panel without moving its mode seed', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const propsGroup = findSeeded(state, 'properties-main')!;
    propsGroup.panelIds = ['SoundObjectPropertiesTopComponent'];
    propsGroup.dockedPanelIds = ['SoundObjectPropertiesTopComponent'];

    const moved = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');

    const propsAfter = findSeeded(moved, 'properties-main')!;
    expect(propsAfter.edge).toBe('right');
    expect(propsAfter.panelIds).toEqual([]);
    expect(findDerived(moved, 'SoundObjectPropertiesTopComponent')).toMatchObject({
      edge: 'left',
      panelIds: ['SoundObjectPropertiesTopComponent'],
      dockedPanelIds: ['SoundObjectPropertiesTopComponent'],
    });
  });

  it('keeps later Properties reveals on the right after Libraries moves left', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(state, 'properties-main')!;
    properties.panelIds = ['LibrariesTopComponent'];
    properties.dockedPanelIds = ['LibrariesTopComponent'];

    const moved = movePanelToEdge(state, 'LibrariesTopComponent', 'left');
    const opened = revealAuxiliaryPanel(
      createDockviewApiStub(),
      moved,
      'SoundObjectPropertiesTopComponent',
    );

    expect(findDerived(opened, 'LibrariesTopComponent')?.edge).toBe('left');
    expect(findSeeded(opened, 'properties-main')).toMatchObject({
      edge: 'right',
      panelIds: ['SoundObjectPropertiesTopComponent'],
      dockedPanelIds: ['SoundObjectPropertiesTopComponent'],
    });
  });

  it('preserves minimized derived singletons after normalization', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'output-main', ALL_OUTPUT_PANEL_IDS);
    const moved = movePanelToEdge(state, 'ScoreObjectEditorTopComponent', 'left');
    const derived = findDerived(moved, 'ScoreObjectEditorTopComponent')!;
    derived.dockedPanelIds = [];

    const normalized = moveAuxiliaryEdge(moved, 'left', 'left');
    const tabs = getMinimizedTabsForEdge(normalized, 'left');

    expect(tabs.map((tab) => tab.panelId)).toContain('ScoreObjectEditorTopComponent');
    expect(
      getGroupInstanceForPanel(normalized, 'ScoreObjectEditorTopComponent')?.dockedPanelIds,
    ).toEqual([]);
  });
});

describe('reset layout', () => {
  it('discards derived singletons and re-seeds defaults', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const split = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');
    expect(split.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(1);

    const reset = resetAuxiliaryLayout();
    expect(reset.groups.filter((g) => g.kind === 'derived-singleton')).toHaveLength(0);
    expect(reset.groups.filter((g) => g.edge === 'left')).toHaveLength(0);

    const propsGroup = findSeeded(reset, 'properties-main')!;
    expect(propsGroup.edge).toBe('right');
    expect(propsGroup.panelIds).toEqual([]);
  });
});

describe('merge-back to seeded group', () => {
  it('merges a derived singleton back into its seeded sibling group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const split = movePanelToEdge(state, 'SoundObjectPropertiesTopComponent', 'left');
    const derived = findDerived(split, 'SoundObjectPropertiesTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    expect(
      merged.groups.find((g) => g.groupInstanceId === derived.groupInstanceId),
    ).toBeUndefined();

    const propsGroup = findSeeded(merged, 'properties-main')!;
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });

  it('preserves seeded panel ordering after merge-back', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const split = movePanelToEdge(state, 'MidiInputPanelTopComponent', 'left');
    const derived = findDerived(split, 'MidiInputPanelTopComponent')!;

    const merged = mergeBackToSeededGroup(split, derived.groupInstanceId);

    const propsGroup = findSeeded(merged, 'properties-main')!;
    expect(propsGroup.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });
});

describe('left-edge minimized tabs and slideout', () => {
  it('produces minimized tabs for a left-edge group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const propsGroup = findDerivedGroup(moved, 'properties-main')!;
    propsGroup.dockedPanelIds = [];

    const tabs = getMinimizedTabsForEdge(moved, 'left');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((t) => t.panelId)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
      'AudioFilePlayerTopComponent',
      'MarkersTopComponent',
      'MidiInputPanelTopComponent',
    ]);
  });

  it('opens a left-edge slideout for a minimized tab', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    const propsGroup = findDerivedGroup(moved, 'properties-main')!;
    propsGroup.dockedPanelIds = [];

    const toggled = toggleMinimizedAuxiliaryPanel(moved, 'SoundObjectPropertiesTopComponent');

    expect(toggled.slideouts.left.openPanelId).toBe('SoundObjectPropertiesTopComponent');

    const slideout = getAuxiliarySlideoutForEdge(toggled, 'left');
    expect(slideout).toBeDefined();
    expect(slideout!.panelId).toBe('SoundObjectPropertiesTopComponent');
    expect(slideout!.edge).toBe('left');
  });

  it('derives correct presentation for left-edge panels', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'],
      ['MidiInputPanelTopComponent'],
    );
    const moved = moveGroupToEdge(state, 'properties-main', 'left');
    moved.slideouts.left.openPanelId = 'SoundObjectPropertiesTopComponent';

    expect(getAuxiliaryPanelPresentation(moved, 'MidiInputPanelTopComponent')).toBe('docked');
    expect(getAuxiliaryPanelPresentation(moved, 'SoundObjectPropertiesTopComponent')).toBe(
      'slideout',
    );
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
    expect(outputGroup.panelIds).toEqual(['OutputTopComponent']);
  });

  it('moves all instances on a docked edge together', () => {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ALL_PROPERTY_PANEL_IDS);
    seedGroupPanels(state, 'output-main', ALL_OUTPUT_PANEL_IDS);
    const movedProps = moveGroupToEdge(state, 'properties-main', 'left');
    const movedOutputTool = movePanelToEdge(movedProps, 'ScoreObjectEditorTopComponent', 'left');

    const moved = moveAuxiliaryEdge(movedOutputTool, 'left', 'right');

    expect(findSeeded(moved, 'properties-main')!.edge).toBe('right');
    expect(findDerived(moved, 'ScoreObjectEditorTopComponent')!.edge).toBe('right');
  });

  it('preserves docked widths and bottom height when reorganizing to the bottom edge', () => {
    const api = createDockviewApiStub();
    const leftState = movePanelToEdge(
      (() => {
        const initial = createDefaultAuxiliaryLayoutState();
        const initialProps = findSeeded(initial, 'properties-main')!;
        initialProps.panelIds = ['SoundObjectPropertiesTopComponent'];
        initialProps.dockedPanelIds = ['SoundObjectPropertiesTopComponent'];
        const initialOutput = findSeeded(initial, 'output-main')!;
        initialOutput.panelIds = ['OutputTopComponent', 'MixerTopComponent'];
        initialOutput.dockedPanelIds = ['OutputTopComponent', 'MixerTopComponent'];
        return initial;
      })(),
      'OutputTopComponent',
      'left',
    );
    applyAuxiliaryLayout(api, leftState);

    const propsGroup = findSeeded(leftState, 'properties-main')!;
    const outputGroup = findSeeded(leftState, 'output-main')!;
    propsGroup.dockedSize = 420;
    outputGroup.dockedSize = 260;

    const liveRightGroup = api.groups.find((group) => group.id === 'blue-aux-edge-right')!;
    const liveBottomGroup = api.groups.find((group) => group.id === 'blue-aux-edge-bottom')!;
    liveRightGroup.size = 512;
    liveRightGroup.bounds.width = 512;
    liveBottomGroup.size = 300;
    liveBottomGroup.bounds.height = 300;

    const preservedDockedSizes = captureAuxiliaryDockedSizesFromApi(api, leftState);

    const moved = applyAuxiliaryLayout(
      api,
      movePanelToEdge(leftState, 'OutputTopComponent', 'bottom'),
      {
        preserveDockedSizes: preservedDockedSizes,
      },
    );

    expect(findSeeded(moved, 'properties-main')!.dockedSize).toBe(512);
    expect(findSeeded(moved, 'output-main')!.dockedSize).toBe(300);
    expect(findSeeded(moved, 'output-main')!.edge).toBe('bottom');
  });

  it('captures and syncs rendered edge bounds instead of Dockview axis size', () => {
    const api = createDockviewApiStub();
    const initialState = createDefaultAuxiliaryLayoutState();
    findSeeded(initialState, 'properties-main')!.panelIds = ['SoundObjectPropertiesTopComponent'];
    findSeeded(initialState, 'properties-main')!.dockedPanelIds = [
      'SoundObjectPropertiesTopComponent',
    ];
    findSeeded(initialState, 'output-main')!.panelIds = ['OutputTopComponent'];
    findSeeded(initialState, 'output-main')!.dockedPanelIds = ['OutputTopComponent'];
    const state = applyAuxiliaryLayout(api, initialState);

    const rightGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-right')!;
    const bottomGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom')!;

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
    expect(shouldPreventAuxiliaryPanelDrop('OutputTopComponent', undefined, 'edge')).toBe(false);
  });

  it('allows drops into auxiliary dockview groups', () => {
    expect(shouldPreventAuxiliaryPanelDrop('OutputTopComponent', 'blue-aux-edge-left', 'tab')).toBe(
      false,
    );
  });

  it('blocks drops into non-auxiliary center groups', () => {
    expect(shouldPreventAuxiliaryPanelDrop('OutputTopComponent', 'group-1', 'content')).toBe(true);
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
    findSeeded(state, 'properties-main')!.panelIds = ['SoundObjectPropertiesTopComponent'];
    findSeeded(state, 'properties-main')!.dockedPanelIds = ['SoundObjectPropertiesTopComponent'];
    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);

    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeDefined();

    const next = closeAuxiliaryPanelLayout(api, applied, 'SoundObjectPropertiesTopComponent');

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

    const next = closeAuxiliaryPanelLayout(api, applied, 'SoundObjectPropertiesTopComponent');

    expect(next.slideouts.right.openPanelId).toBeUndefined();
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeUndefined();
  });
});

describe('restoreClosedAuxiliaryPanel', () => {
  it('restores a closed panel to its moved edge, docked size, and seed group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(state, 'properties-main')!;
    properties.edge = 'left';
    properties.panelIds = ['SoundObjectPropertiesTopComponent'];
    properties.dockedPanelIds = ['SoundObjectPropertiesTopComponent'];
    properties.dockedSize = 284;

    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, state);
    const closed = closeAuxiliaryPanelLayout(api, applied, 'SoundObjectPropertiesTopComponent');
    const restored = restoreClosedAuxiliaryPanel(api, closed, 'SoundObjectPropertiesTopComponent', {
      originMode: 'properties',
      presentation: 'docked',
      originPanelOrder: ['SoundObjectPropertiesTopComponent'],
      auxiliarySeedGroupId: 'properties-main',
      auxiliaryGroupInstanceId: 'properties-main',
      edge: 'left',
      dockedSize: 284,
    });

    const instance = getGroupInstanceForPanel(restored, 'SoundObjectPropertiesTopComponent')!;
    expect(instance.edge).toBe('left');
    expect(instance.dockedSize).toBe(284);
    expect(instance.dockedPanelIds).toContain('SoundObjectPropertiesTopComponent');
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeDefined();
  });

  it('restores a closed minimized panel as a minimized rail entry', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(state, 'properties-main')!;
    properties.edge = 'left';
    properties.panelIds = ['SoundObjectPropertiesTopComponent'];
    properties.dockedPanelIds = [];

    const api = createDockviewApiStub();
    const closed = closeAuxiliaryPanelLayout(api, state, 'SoundObjectPropertiesTopComponent');
    const restored = restoreClosedAuxiliaryPanel(api, closed, 'SoundObjectPropertiesTopComponent', {
      originMode: 'properties',
      presentation: 'minimized',
      originPanelOrder: ['SoundObjectPropertiesTopComponent'],
      auxiliarySeedGroupId: 'properties-main',
      auxiliaryGroupInstanceId: 'properties-main',
      edge: 'left',
    });

    const instance = getGroupInstanceForPanel(restored, 'SoundObjectPropertiesTopComponent')!;
    expect(instance.edge).toBe('left');
    expect(instance.dockedPanelIds).not.toContain('SoundObjectPropertiesTopComponent');
    expect(getMinimizedTabsForEdge(restored, 'left')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panelId: 'SoundObjectPropertiesTopComponent',
        }),
      ]),
    );
  });

  it('recreates a closed derived singleton instead of merging it into its seed group', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(state, 'properties-main')!;
    properties.panelIds = ['SoundObjectPropertiesTopComponent', 'MidiInputPanelTopComponent'];
    properties.dockedPanelIds = [...properties.panelIds];
    const moved = movePanelToEdge(state, 'MidiInputPanelTopComponent', 'bottom');

    const api = createDockviewApiStub();
    const applied = applyAuxiliaryLayout(api, moved);
    const closed = closeAuxiliaryPanelLayout(api, applied, 'MidiInputPanelTopComponent');
    const restored = restoreClosedAuxiliaryPanel(api, closed, 'MidiInputPanelTopComponent', {
      originMode: 'properties',
      presentation: 'docked',
      originPanelOrder: ['MidiInputPanelTopComponent'],
      auxiliarySeedGroupId: 'properties-main',
      auxiliaryGroupInstanceId: 'derived:MidiInputPanelTopComponent',
      edge: 'bottom',
    });

    expect(
      restored.groups.find(
        (group) => group.groupInstanceId === 'derived:MidiInputPanelTopComponent',
      ),
    ).toMatchObject({
      edge: 'bottom',
      panelIds: ['MidiInputPanelTopComponent'],
      dockedPanelIds: ['MidiInputPanelTopComponent'],
    });
  });
});

describe('auxiliary 200px controlled-pane defaults (Java Blue parity)', () => {
  it('uses 200px for the side (properties) auxiliary default docked size', () => {
    const state = createDefaultAuxiliaryLayoutState();
    const properties = state.groups.find((g) => g.seedGroupId === 'properties-main')!;
    expect(properties.dockedSize).toBe(200);
    expect(properties.slideoutSize).toBe(200);
  });

  it('resizes a docked group and persists the updated edge size', () => {
    const api = createDockviewApiStub();
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(state, 'properties-main', ['LibrariesTopComponent']);

    const applied = applyAuxiliaryLayout(api, state);
    const enlarged = resizeAuxiliaryGroupLayout(api, applied, 'properties-main', 'increase');

    expect(findSeeded(enlarged, 'properties-main')?.dockedSize).toBe(240);
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-right')?.size).toBe(240);

    const reset = resizeAuxiliaryGroupLayout(api, enlarged, 'properties-main', 'reset');
    expect(findSeeded(reset, 'properties-main')?.dockedSize).toBe(200);
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
      const sizes = captureAuxiliaryDockedSizesFromApi(createDockviewApiStub(), state);
      expect(sizes[edge]).toBe(200);
    }
  });
});

describe('workbench layout envelope version 7 (SPEC 055 placement origins)', () => {
  it('produces a version 7 envelope from createStoredWorkbenchLayout', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary);
    expect(stored.version).toBe(7);
    expect(stored.auxiliary.version).toBe(5);
  });

  it('migrates a persisted moved seed into a derived group', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const properties = findSeeded(auxiliary, 'properties-main')!;
    properties.edge = 'left';
    properties.panelIds = ['LibrariesTopComponent'];
    properties.dockedPanelIds = ['LibrariesTopComponent'];
    properties.activePanelId = 'LibrariesTopComponent';
    properties.dockedSize = 360;

    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary);
    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));
    const restoredSeed = findSeeded(parsed.auxiliary, 'properties-main')!;
    const restoredPanel = findDerived(parsed.auxiliary, 'LibrariesTopComponent')!;

    expect(restoredSeed).toMatchObject({
      edge: 'right',
      panelIds: [],
      dockedPanelIds: [],
    });
    expect(restoredPanel).toMatchObject({
      edge: 'left',
      dockedSize: 360,
      panelIds: ['LibrariesTopComponent'],
      dockedPanelIds: ['LibrariesTopComponent'],
    });
  });

  it('round-trips floatingOrigins through serialize/parse', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const floatingOrigins = {
      'popout-1': {
        originMode: 'editor' as const,
        presentation: 'docked' as const,
        originPanelOrder: ['ScoreTopComponent', 'OrchestraTopComponent'],
        originGroupId: 'group-1',
        originActivePanelId: 'ScoreTopComponent',
      },
      'popout-2': {
        originMode: 'output' as const,
        presentation: 'minimized' as const,
        originPanelOrder: ['MixerTopComponent'],
        edge: 'bottom' as const,
        auxiliarySeedGroupId: 'output-main' as const,
      },
    };

    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary, {
      floatingOrigins,
    });
    expect(stored.floatingOrigins).toEqual(floatingOrigins);
    expect(stored.version).toBe(7);

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));
    expect(parsed.floatingOrigins).toEqual(floatingOrigins);
  });

  it('omits floatingOrigins from parse when none are stored', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary);
    expect(stored.floatingOrigins).toBeUndefined();

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));
    expect(parsed.floatingOrigins).toBeUndefined();
  });

  it('round-trips closed-panel origins through serialize/parse', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const closedPanelOrigins = {
      MixerTopComponent: {
        originMode: 'output' as const,
        presentation: 'minimized' as const,
        originPanelOrder: ['MixerTopComponent'],
        auxiliarySeedGroupId: 'output-main' as const,
        auxiliaryGroupInstanceId: 'output-main',
        edge: 'bottom' as const,
        dockedSize: 260,
      },
    };
    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary, {
      closedPanelOrigins,
    });

    expect(parseStoredWorkbenchLayout(JSON.stringify(stored)).closedPanelOrigins).toEqual(
      closedPanelOrigins,
    );
  });

  it('migrates a legacy version 6 envelope to version 7 with no closed-panel origins', () => {
    const legacy = {
      version: 6,
      dockview: legacyDockview,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    };

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(legacy));
    expect(parsed.auxiliary.version).toBe(5);
    expect(parsed.floatingOrigins).toBeUndefined();
    // Re-serializing through create produces version 7 going forward.
    const restored = createStoredWorkbenchLayout(
      parsed.dockview ?? legacyDockview,
      parsed.auxiliary,
    );
    expect(restored.version).toBe(7);
  });

  it('drops invalid floating-origin entries during parse', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const stored = createStoredWorkbenchLayout(legacyDockview, auxiliary, {
      floatingOrigins: {
        'popout-good': {
          originMode: 'editor',
          presentation: 'docked',
          originPanelOrder: ['ScoreTopComponent'],
        },
        'popout-bad': { originMode: 'editor' },
      },
    });

    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));
    expect(Object.keys(parsed.floatingOrigins ?? {})).toEqual(['popout-good']);
  });

  it('falls back safely when version metadata is absent', () => {
    const parsed = parseStoredWorkbenchLayout(JSON.stringify({ unrelated: true }));
    expect(parsed.auxiliary.version).toBe(5);
    expect(parsed.floatingOrigins).toBeUndefined();
  });
});

describe('auxiliary layout transition contract', () => {
  interface TransitionFixture {
    api: any;
    current: AuxiliaryLayoutState;
    desired: AuxiliaryLayoutState;
  }

  function buildEdgeMoveFixture(): TransitionFixture {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(
      state,
      'properties-main',
      ['LibrariesTopComponent', 'SoundObjectPropertiesTopComponent'],
    );
    seedGroupPanels(state, 'output-main', ['OutputTopComponent', 'BlueFileManagerTopComponent']);

    const api = createDockviewApiStub();
    const current = applyAuxiliaryLayout(api, state);
    const desired = moveAuxiliaryEdge(current, 'right', 'left');
    return { api, current, desired };
  }

  it('applies an edge move with targeted operations and preserves panel identity', () => {
    const { api, current, desired } = buildEdgeMoveFixture();
    const librariesPanel = api.getPanel('LibrariesTopComponent');
    const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');

    const result = transitionAuxiliaryLayout(api, current, desired, {
      preserveDockedSizes: { left: 260, right: 200, bottom: 210 },
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    expect(api.getPanel('LibrariesTopComponent')).toBe(librariesPanel);
    expect(api.getPanel('BlueFileManagerTopComponent')).toBe(fileManagerPanel);

    const leftGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-left');
    expect(leftGroup).toBeDefined();
    expect(leftGroup.panels.map((panel: any) => panel.id)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-right')).toBeUndefined();

    const bottomGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom');
    expect(bottomGroup.panels.map((panel: any) => panel.id)).toEqual([
      'BlueFileManagerTopComponent',
      'OutputTopComponent',
    ]);

    const moved = result.state.groups.find(
      (group) => group.kind !== 'seeded' && group.panelIds.includes('LibrariesTopComponent'),
    );
    expect(moved?.edge).toBe('left');
    expect(moved?.dockedPanelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
  });

  it('defers without live mutation while a tree drag is active', () => {
    const { api, current, desired } = buildEdgeMoveFixture();

    const manager = acquireTreeDndManager(document)!;
    const sourceId = manager.getRegistry().addSource('blue/test', {
      canDrag: () => true,
      isDragging: () => true,
      beginDrag: () => ({ kind: 'blue/test' }),
      endDrag: () => undefined,
    });
    manager.getActions().beginDrag([sourceId]);

    const result = transitionAuxiliaryLayout(api, current, desired);

    expect(result.status).toBe('deferred');
    if (result.status !== 'deferred') return;
    expect(result.reason).toBe('drag-active');
    expect(result.state).toEqual(current);
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-left')).toBeUndefined();

    manager.getActions().endDrag();
    manager.getRegistry().removeSource(sourceId);
  });

  it('fails preflight before live mutation for unregistered docked panels', () => {
    const { api, current } = buildEdgeMoveFixture();
    const bad = cloneAuxiliaryLayoutState(current);
    const seeded = findSeeded(bad, 'properties-main')!;
    seeded.panelIds = ['NotARealPanel', ...seeded.panelIds];
    seeded.dockedPanelIds = ['NotARealPanel', ...seeded.dockedPanelIds];

    const result = transitionAuxiliaryLayout(api, current, bad);

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toContain('NotARealPanel');
    expect(result.state).toEqual(current);
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-left')).toBeUndefined();
    expect(api.getPanel('LibrariesTopComponent')).toBeDefined();
  });

  it('fails preflight when a panel is docked in multiple desired groups', () => {
    const { api, current } = buildEdgeMoveFixture();
    const bad = cloneAuxiliaryLayoutState(current);
    const seeded = findSeeded(bad, 'properties-main')!;
    bad.groups.push({
      ...cloneAuxiliaryLayoutState(bad).groups.find((g) => g.kind === 'seeded' && g.seedGroupId === 'output-main')!,
      groupInstanceId: 'derived:conflict',
      kind: 'derived-singleton',
      edge: 'left',
      panelIds: ['LibrariesTopComponent'],
      dockedPanelIds: ['LibrariesTopComponent'],
      activePanelId: 'LibrariesTopComponent',
      displayOrder: 99,
    });
    expect(seeded.dockedPanelIds).toContain('LibrariesTopComponent');

    const result = transitionAuxiliaryLayout(api, current, bad);

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.reason).toContain('LibrariesTopComponent');
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-left')).toBeUndefined();
  });

  it('rolls back a failed move and keeps the last valid layout usable', () => {
    const { api, current, desired } = buildEdgeMoveFixture();
    const librariesPanel = api.getPanel('LibrariesTopComponent');

    const originalMoveTo = librariesPanel.api.moveTo.bind(librariesPanel.api);
    librariesPanel.api.moveTo = (options: any) => {
      throw new Error('dockview exploded');
    };
    const restoreMoveTo = () => {
      librariesPanel.api.moveTo = originalMoveTo;
    };

    const result = transitionAuxiliaryLayout(api, current, desired);

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') {
      restoreMoveTo();
      return;
    }
    expect(result.reason).toContain('dockview exploded');
    expect(result.state).toEqual(current);

    restoreMoveTo();

    // The best-effort rollback removed the half-created target group and the
    // previous placement stays live with the same panel object.
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-left')).toBeUndefined();
    const rightGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-right');
    expect(rightGroup.panels.map((panel: any) => panel.id)).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
    expect(api.getPanel('LibrariesTopComponent')).toBe(librariesPanel);
  });

  it('rolls back a failed auxiliary close without losing the live panel', () => {
    const { api, current } = buildEdgeMoveFixture();
    const librariesPanel = api.getPanel('LibrariesTopComponent');
    const originalClose = librariesPanel.api.close;
    librariesPanel.api.close = () => {
      throw new Error('close exploded');
    };

    const next = closeAuxiliaryPanelLayout(api, current, 'LibrariesTopComponent');

    expect(next).toEqual(current);
    expect(api.getPanel('LibrariesTopComponent')).toBe(librariesPanel);

    librariesPanel.api.close = originalClose;
  });
});

describe('auxiliary layout transition presentations', () => {
  function buildPresentationFixture() {
    const state = createDefaultAuxiliaryLayoutState();
    seedGroupPanels(
      state,
      'properties-main',
      ['SoundObjectPropertiesTopComponent', 'LibrariesTopComponent'],
    );
    seedGroupPanels(state, 'output-main', ['OutputTopComponent', 'BlueFileManagerTopComponent']);

    const api = createDockviewApiStub();
    const current = applyAuxiliaryLayout(api, state);
    return { api, current };
  }

  it('minimizes one panel without disturbing unaffected live panels', () => {
    const { api, current } = buildPresentationFixture();
    const soundObjectPanel = api.getPanel('SoundObjectPropertiesTopComponent');
    const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');

    const next = minimizeAuxiliaryPanelLayout(api, current, 'LibrariesTopComponent');

    expect(api.getPanel('LibrariesTopComponent')).toBeUndefined();
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBe(soundObjectPanel);
    expect(api.getPanel('BlueFileManagerTopComponent')).toBe(fileManagerPanel);

    const rightGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-right');
    expect(rightGroup.panels.map((panel: any) => panel.id)).toEqual([
      'SoundObjectPropertiesTopComponent',
    ]);

    const properties = findSeeded(next, 'properties-main')!;
    expect(properties.dockedPanelIds).toEqual(['SoundObjectPropertiesTopComponent']);
  });

  it('docks a previously minimized panel back without recreating neighbors', () => {
    const { api, current } = buildPresentationFixture();
    const minimized = minimizeAuxiliaryPanelLayout(api, current, 'LibrariesTopComponent');
    const soundObjectPanel = api.getPanel('SoundObjectPropertiesTopComponent');
    const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');

    const next = dockAuxiliaryPanel(api, minimized, 'LibrariesTopComponent');

    expect(api.getPanel('LibrariesTopComponent')).toBeDefined();
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBe(soundObjectPanel);
    expect(api.getPanel('BlueFileManagerTopComponent')).toBe(fileManagerPanel);

    const properties = findSeeded(next, 'properties-main')!;
    expect(properties.dockedPanelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
  });

  it('minimizes an entire edge group and removes its docked presentation', () => {
    const { api, current } = buildPresentationFixture();

    const next = minimizeAuxiliaryGroupLayout(api, current, 'properties-main');

    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-right')).toBeUndefined();
    expect(api.getPanel('SoundObjectPropertiesTopComponent')).toBeUndefined();

    const bottomGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom');
    expect(bottomGroup.panels.map((panel: any) => panel.id)).toEqual([
      'BlueFileManagerTopComponent',
      'OutputTopComponent',
    ]);

    const properties = findSeeded(next, 'properties-main')!;
    expect(properties.dockedPanelIds).toEqual([]);
    expect(properties.panelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
  });

  it('restores a maximized group presentation after a targeted transition', () => {
    const { api, current } = buildPresentationFixture();

    const next = maximizeAuxiliaryGroupLayout(api, current, 'properties-main');

    const properties = findSeeded(next, 'properties-main')!;
    expect(properties.dockedPanelIds).toEqual([
      'SoundObjectPropertiesTopComponent',
      'LibrariesTopComponent',
    ]);
    expect(properties.isMaximized).toBe(true);

    const rightGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-right');
    expect(rightGroup.api.isMaximized()).toBe(true);
    expect(api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom')).toBeDefined();
  });

  it('exits a live maximized group when the canonical presentation is restored', () => {
    const { api, current } = buildPresentationFixture();

    const maximized = maximizeAuxiliaryGroupLayout(api, current, 'properties-main');
    const rightGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-right');
    expect(rightGroup.api.isMaximized()).toBe(true);

    const restored = restoreAuxiliaryGroupLayout(api, maximized, 'properties-main');

    expect(findSeeded(restored, 'properties-main')!.isMaximized).toBe(false);
    expect(rightGroup.api.isMaximized()).toBe(false);
  });

  it('moves a derived singleton group between edges with identity reuse', () => {
    const { api, current } = buildPresentationFixture();
    const desiredSplit = movePanelToEdge(current, 'LibrariesTopComponent', 'left');
    const split = transitionAuxiliaryLayout(api, current, desiredSplit).state;

    const librariesPanel = api.getPanel('LibrariesTopComponent');
    const fileManagerPanel = api.getPanel('BlueFileManagerTopComponent');
    expect(librariesPanel).toBeDefined();

    const derived = split.groups.find(
      (group) => group.kind === 'derived-singleton' && group.panelIds.includes('LibrariesTopComponent'),
    );
    expect(derived?.edge).toBe('left');

    const desiredBottom = moveGroupToEdge(split, derived!.groupInstanceId, 'bottom');
    const moved = transitionAuxiliaryLayout(api, split, desiredBottom).state;

    expect(api.getPanel('LibrariesTopComponent')).toBe(librariesPanel);
    expect(api.getPanel('BlueFileManagerTopComponent')).toBe(fileManagerPanel);

    const movedDerived = moved.groups.find(
      (group) => group.groupInstanceId === derived!.groupInstanceId,
    );
    expect(movedDerived?.edge).toBe('bottom');

    const leftGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-left');
    expect(leftGroup).toBeUndefined();

    const bottomGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom');
    expect(bottomGroup.panels.map((panel: any) => panel.id)).toEqual([
      'BlueFileManagerTopComponent',
      'OutputTopComponent',
      'LibrariesTopComponent',
    ]);
  });

  it('restores captured per-edge docked sizes through an applied transition', () => {
    const { api, current } = buildPresentationFixture();
    const desired = moveAuxiliaryEdge(current, 'right', 'left');

    const result = transitionAuxiliaryLayout(api, current, desired, {
      preserveDockedSizes: { left: 260, right: 200, bottom: 300 },
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;

    const leftGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-left');
    expect(leftGroup.bounds.width).toBe(260);
    const bottomGroup = api.groups.find((group: any) => group.id === 'blue-aux-edge-bottom');
    expect(bottomGroup.bounds.height).toBe(300);
  });
});
