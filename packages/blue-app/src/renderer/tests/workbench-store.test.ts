import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultAuxiliaryLayoutState } from '../components/workbench/auxiliary-layout';
import {
  hasRestoredStartupEditorPanel,
  useWorkbenchStore,
} from '../stores/workbench-store';
import { useLibraryStore } from '../stores/library-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';
import { createLibraryEditorSession } from './library-editor-fixtures';

const dockviewSnapshot = {
  grid: {
    root: { type: 'branch' },
    width: 1400,
    height: 900,
    orientation: 'horizontal',
  },
  panels: {},
  activeGroup: 'group-1',
} as any;

const dockviewApiStub = {
  getPanel: (panelId: string) =>
    panelId === 'ScoreTopComponent' ? ({} as never) : undefined,
  toJSON: () => dockviewSnapshot,
} as any;

function createLayoutRecoveryApiStub() {
  const panels = new Map<string, any>();
  const groups: any[] = [];

  function createGroup(id: string) {
    return {
      id,
      size: 200,
      panels: [] as any[],
      activePanel: undefined as any,
      focus: vi.fn(),
      locked: false,
      api: {
        location: { type: 'grid' as const },
        isMaximized: () => false,
        setHeaderPosition: () => undefined,
        setSize: () => undefined,
      },
      element: {
        dataset: {},
        getBoundingClientRect: () => ({ width: 200, height: 200 }),
      },
      location: { type: 'grid' as const },
    };
  }

  function resetGroups() {
    groups.splice(0, groups.length, createGroup('main-editor-group'));
  }

  resetGroups();

  const api = {
    get groups() {
      return groups;
    },
    get panels() {
      return Array.from(panels.values());
    },
    clear: vi.fn(() => {
      panels.clear();
      resetGroups();
    }),
    fromJSON: vi.fn(),
    getPanel: vi.fn((id: string) => panels.get(id)),
    addGroup: vi.fn(({ id }: { id?: string }) => {
      const group = createGroup(id ?? `group-${groups.length}`);
      groups.push(group);
      return group;
    }),
    addPanel: vi.fn(({ id, title, inactive, position }: any) => {
      const group = position?.referenceGroup ?? groups[0];
      const panel = {
        id,
        title,
        group,
        api: {
          close: () => {
            panels.delete(id);
            group.panels = group.panels.filter((entry: any) => entry !== panel);
          },
          setActive: () => {
            group.activePanel = panel;
          },
          setTitle: (nextTitle: string) => {
            panel.title = nextTitle;
          },
          isMaximized: () => false,
        },
      };
      panels.set(id, panel);
      group.panels.push(panel);
      if (!inactive || !group.activePanel) {
        group.activePanel = panel;
      }
      return panel;
    }),
    toJSON: () => dockviewSnapshot,
  };

  return api as any;
}

function createCloseRestoreApiStub() {
  const panels = new Map<string, any>();
  const group = {
    id: 'editor-group',
    panels: [] as any[],
    activePanel: undefined as any,
    focus: vi.fn(),
    api: { location: { type: 'grid' as const } },
    element: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 600,
        height: 500,
      }),
    },
  };

  function addPanel(
    id: string,
    position?: { referenceGroup?: any; index?: number },
  ) {
    const target = position?.referenceGroup ?? group;
    const panel = {
      id,
      group: target,
      api: {
        setActive: vi.fn(() => {
          target.activePanel = panel;
        }),
      },
    };
    const index = Math.max(
      0,
      Math.min(position?.index ?? target.panels.length, target.panels.length),
    );
    target.panels.splice(index, 0, panel);
    target.activePanel = panel;
    panels.set(id, panel);
    return panel;
  }

  addPanel('ScoreTopComponent');
  addPanel('OrchestraTopComponent');

  return {
    api: {
      get panels() {
        return Array.from(panels.values());
      },
      groups: [group],
      getPanel: vi.fn((id: string) => panels.get(id)),
      getGroup: vi.fn((id: string) => (id === group.id ? group : undefined)),
      addPanel: vi.fn(
        ({
          id,
          position,
        }: {
          id: string;
          position?: { referenceGroup?: any; index?: number };
        }) => addPanel(id, position),
      ),
      removePanel: vi.fn((panel: any) => {
        panels.delete(panel.id);
        panel.group.panels = panel.group.panels.filter(
          (entry: any) => entry !== panel,
        );
        panel.group.activePanel = panel.group.panels[0];
      }),
      toJSON: () => dockviewSnapshot,
    } as any,
    group,
  };
}

function createFloatingDockApiStub() {
  const popoutWindow = {
    closed: false,
    close: vi.fn(() => {
      popoutWindow.closed = true;
    }),
  };

  function createGroup(id: string, location: 'grid' | 'popout') {
    return {
      id,
      panels: [] as any[],
      activePanel: undefined as any,
      focus: vi.fn(),
      api: {
        location:
          location === 'popout'
            ? {
                type: 'popout' as const,
                getWindow: () => popoutWindow as unknown as Window,
              }
            : { type: 'grid' as const },
      },
    };
  }

  const targetGroup = createGroup('group-1', 'grid');
  const sourceGroup = createGroup('ScoreTopComponent-float-1', 'popout');
  let groups = [targetGroup, sourceGroup];

  const panel = {
    id: 'ScoreTopComponent',
    group: sourceGroup,
    api: {
      width: 640,
      height: 420,
      setActive: vi.fn(() => {
        panel.group.activePanel = panel;
      }),
      moveTo: vi.fn(
        ({ group, index }: { group: typeof targetGroup; index: number }) => {
          panel.group.panels = panel.group.panels.filter(
            (entry) => entry.id !== panel.id,
          );
          const nextIndex = Math.max(0, Math.min(index, group.panels.length));
          group.panels.splice(nextIndex, 0, panel);
          panel.group = group;
          group.activePanel = panel;
        },
      ),
    },
  };

  sourceGroup.panels.push(panel);
  sourceGroup.activePanel = panel;

  const component = {
    removeGroup: vi.fn((group: typeof sourceGroup) => {
      groups = groups.filter((entry) => entry.id !== group.id);
    }),
    moveGroupOrPanel: vi.fn(
      ({
        from,
        to,
      }: {
        from: { groupId: string; panelId?: string };
        to: { group: typeof targetGroup; index?: number };
      }) => {
        const source = groups.find((entry) => entry.id === from.groupId)!;
        const moved = source.panels.find((entry) => entry.id === from.panelId)!;
        source.panels = source.panels.filter((entry) => entry !== moved);
        const nextIndex = Math.max(
          0,
          Math.min(to.index ?? 0, to.group.panels.length),
        );
        to.group.panels.splice(nextIndex, 0, moved);
        moved.group = to.group;
        to.group.activePanel = moved;

        // Model Dockview detaching the source group after the last tab move.
        // The store must still close the window it captured before the move.
        source.api.location = { type: 'grid' as const };
      },
    ),
  };

  const api = {
    get groups() {
      return groups;
    },
    getPanel: vi.fn((id: string) => (id === panel.id ? panel : undefined)),
    getGroup: vi.fn((id: string) => groups.find((group) => group.id === id)),
    addGroup: vi.fn(() => {
      const group = createGroup(`group-${groups.length + 1}`, 'grid');
      groups.push(group);
      return group;
    }),
    component,
    removeGroup: vi.fn((group: typeof sourceGroup) => {
      groups = groups.filter((entry) => entry.id !== group.id);
    }),
    toJSON: () => dockviewSnapshot,
  };

  return {
    api: api as any,
    panel,
    popoutWindow,
    sourceGroup,
    targetGroup,
  };
}

function createAuxiliaryFloatingDockApiStub() {
  const popoutWindow = {
    closed: false,
    close: vi.fn(() => {
      popoutWindow.closed = true;
    }),
  };

  function createGroup(
    id: string,
    location: 'grid' | 'popout',
    visible = true,
  ) {
    const group = {
      id,
      panels: [] as any[],
      activePanel: undefined as any,
      focus: vi.fn(),
      size: 200,
      element: {
        dataset: {},
        getBoundingClientRect: () => ({
          width: group.size,
          height: group.size,
        }),
      },
      api: {
        location:
          location === 'popout'
            ? {
                type: 'popout' as const,
                getWindow: () => popoutWindow as unknown as Window,
              }
            : { type: 'grid' as const },
        isMaximized: () => false,
        isVisible: visible,
        setHeaderPosition: vi.fn(),
        setSize: vi.fn(
          ({ width, height }: { width?: number; height?: number }) => {
            group.size = width ?? height ?? group.size;
          },
        ),
      },
    };
    return group;
  }

  function createPanel(id: string, group: ReturnType<typeof createGroup>) {
    const panel = {
      id,
      group,
      title: id,
      api: {
        width: 640,
        height: 420,
        title: id,
        close: vi.fn(),
        isMaximized: () => false,
        setActive: vi.fn(() => {
          group.activePanel = panel;
        }),
        setTitle: vi.fn((title: string) => {
          panel.title = title;
          panel.api.title = title;
        }),
      },
    };
    group.panels.push(panel);
    group.activePanel = panel;
    return panel;
  }

  const editorGroup = createGroup('main-editor', 'grid');
  const hiddenReferenceGroup = createGroup(
    'blue-aux-edge-right',
    'grid',
    false,
  );
  const popoutGroup = createGroup('popout-properties', 'popout');
  const scorePanel = createPanel('ScoreTopComponent', editorGroup);
  const propertiesPanel = createPanel(
    'SoundObjectPropertiesTopComponent',
    popoutGroup,
  );
  const panels = new Map([
    [scorePanel.id, scorePanel],
    [propertiesPanel.id, propertiesPanel],
  ]);
  let groups = [editorGroup, hiddenReferenceGroup, popoutGroup];

  const component = {
    removePanel: vi.fn((panel: typeof propertiesPanel) => {
      panels.delete(panel.id);
      panel.group.panels = panel.group.panels.filter(
        (entry) => entry !== panel,
      );
      panel.group.activePanel = panel.group.panels[0];
    }),
    removeGroup: vi.fn(
      (group: typeof popoutGroup, options: Record<string, unknown>) => {
        groups = groups.filter((entry) => entry !== group);
        if (
          group === popoutGroup &&
          options.skipPopoutAssociated !== true &&
          hiddenReferenceGroup.panels.length === 0
        ) {
          groups = groups.filter((entry) => entry !== hiddenReferenceGroup);
        }
      },
    ),
  };

  const api = {
    get groups() {
      return groups;
    },
    get panels() {
      return Array.from(panels.values());
    },
    getPanel: vi.fn((id: string) => panels.get(id)),
    getGroup: vi.fn((id: string) => groups.find((group) => group.id === id)),
    addGroup: vi.fn(({ id }: { id: string }) => {
      const group = createGroup(id, 'grid');
      groups.push(group);
      return group;
    }),
    addPanel: vi.fn(({ id, title, position, inactive }: any) => {
      const group = position.referenceGroup;
      const panel = createPanel(id, group);
      panel.title = title;
      panel.api.title = title;
      const index = Math.max(
        0,
        Math.min(
          position.index ?? group.panels.length - 1,
          group.panels.length - 1,
        ),
      );
      group.panels = group.panels.filter((entry) => entry !== panel);
      group.panels.splice(index, 0, panel);
      if (inactive) {
        group.activePanel = group.panels[0];
      }
      panels.set(id, panel);
      return panel;
    }),
    component,
    removeGroup: vi.fn(),
    toJSON: () => dockviewSnapshot,
  };

  return {
    api: api as any,
    hiddenReferenceGroup,
    popoutGroup,
    propertiesPanel,
  };
}

function createFloatPanelApiStub() {
  const popoutWindow = {
    closed: false,
    innerWidth: 640,
    innerHeight: 420,
    Event: class {
      constructor(_type: string) {}
    },
    dispatchEvent: vi.fn(),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
  };

  function createGroup(id: string, location: 'grid' | 'popout') {
    return {
      id,
      panels: [] as any[],
      activePanel: undefined as any,
      focus: vi.fn(),
      layout: vi.fn(),
      api: {
        location:
          location === 'popout'
            ? {
                type: 'popout' as const,
                getWindow: () => popoutWindow as unknown as Window,
              }
            : { type: 'grid' as const },
      },
    };
  }

  function createPanel(id: string, group: ReturnType<typeof createGroup>) {
    const panel = {
      id,
      group,
      api: {
        width: 640,
        height: 420,
        setActive: vi.fn(() => {
          panel.group.activePanel = panel;
        }),
        moveTo: vi.fn(
          ({
            group: targetGroup,
            index,
          }: {
            group: ReturnType<typeof createGroup>;
            index: number;
          }) => {
            panel.group.panels = panel.group.panels.filter(
              (entry) => entry.id !== panel.id,
            );
            const nextIndex = Math.max(
              0,
              Math.min(index, targetGroup.panels.length),
            );
            targetGroup.panels.splice(nextIndex, 0, panel);
            panel.group = targetGroup;
            targetGroup.activePanel = panel;
          },
        ),
      },
    };
    return panel;
  }

  const sourceGroup = createGroup('group-1', 'grid');
  const popoutGroup = createGroup('generated-popout-1', 'popout');
  const scorePanel = createPanel('ScoreTopComponent', sourceGroup);
  const orchestraPanel = createPanel('OrchestraTopComponent', sourceGroup);
  sourceGroup.panels.push(scorePanel, orchestraPanel);
  sourceGroup.activePanel = scorePanel;

  let groups = [sourceGroup];
  const panels = new Map([
    [scorePanel.id, scorePanel],
    [orchestraPanel.id, orchestraPanel],
  ]);

  const api = {
    get groups() {
      return groups;
    },
    getPanel: vi.fn((id: string) => panels.get(id)),
    getGroup: vi.fn((id: string) => groups.find((group) => group.id === id)),
    addGroup: vi.fn(() => {
      const group = createGroup(`group-${groups.length + 1}`, 'grid');
      groups.push(group);
      return group;
    }),
    addPopoutGroup: vi.fn((item: typeof scorePanel | typeof sourceGroup) => {
      const source = 'panels' in item ? item : item.group;
      const panelsToMove = 'panels' in item ? [...item.panels] : [item];
      source.panels = source.panels.filter(
        (entry) => !panelsToMove.includes(entry),
      );
      for (const moved of panelsToMove) {
        popoutGroup.panels.push(moved);
        moved.group = popoutGroup;
      }
      popoutGroup.activePanel = panelsToMove[0];
      groups = [...groups, popoutGroup];
      return Promise.resolve(true);
    }),
    removeGroup: vi.fn(),
    toJSON: () => dockviewSnapshot,
  };

  return {
    api: api as any,
    orchestraPanel,
    popoutGroup,
    popoutWindow,
    scorePanel,
    sourceGroup,
  };
}

function createFailedFloatPanelApiStub() {
  const stub = createFloatPanelApiStub();
  const popoutWindow = {
    closed: false,
    close: vi.fn(() => {
      popoutWindow.closed = true;
    }),
    document: {
      readyState: 'complete',
      getElementById: vi.fn(() => null),
    },
    location: {
      reload: vi.fn(),
    },
  };

  stub.api.addPopoutGroup.mockImplementation(
    (
      _item: unknown,
      options?: { onDidOpen?: (event: { window: Window }) => void },
    ) => {
      options?.onDidOpen?.({ window: popoutWindow as unknown as Window });
      return Promise.resolve(false);
    },
  );

  return {
    ...stub,
    popoutWindow,
  };
}

const originalAddMarkerAtTime = useProjectStore.getState().addMarkerAtTime;

const markerMenuTransport = {
  renderStartTime: 8,
  renderEndTime: -1,
  loopRendering: false,
  tempoMap: {
    enabled: false,
    points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
  },
  meterMap: {
    entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
  },
  sampleRate: 44100,
  smpteFrameRate: 24,
};

describe('restored workbench validation', () => {
  it('rejects a restored layout that contains only auxiliary panels', () => {
    expect(
      hasRestoredStartupEditorPanel({
        getPanel: (panelId: string) =>
          panelId === 'OutputTopComponent' ? ({} as never) : undefined,
      }),
    ).toBe(false);
  });

  it('accepts a restored layout with a primary editor panel', () => {
    expect(
      hasRestoredStartupEditorPanel({
        getPanel: (panelId: string) =>
          panelId === 'ScoreTopComponent' ? ({} as never) : undefined,
      }),
    ).toBe(true);
  });
});

afterEach(() => {
  useWorkbenchStore.setState({
    ...useWorkbenchStore.getInitialState(),
    api: null,
    auxiliary: createDefaultAuxiliaryLayoutState(),
  });
  useLibraryStore.getState().reset();
  usePlaybackStore.getState().reset();
  useProjectStore.setState({
    addMarkerAtTime: originalAddMarkerAtTime,
  });
});

describe('workbench store layout persistence', () => {
  it('serializes layout without mutating auxiliary state', () => {
    const auxiliary = createDefaultAuxiliaryLayoutState();

    useWorkbenchStore.setState({
      api: dockviewApiStub,
      auxiliary,
    });

    const serialized = useWorkbenchStore.getState().saveLayout();

    expect(serialized).not.toBeNull();
    expect(useWorkbenchStore.getState().auxiliary).toBe(auxiliary);
  });

  it('serializes with version 7 envelope (SPEC 055 placement origins)', () => {
    useWorkbenchStore.setState({
      api: dockviewApiStub,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    const serialized = useWorkbenchStore.getState().saveLayout();
    const parsed = JSON.parse(serialized!);

    expect(parsed.version).toBe(7);
    expect(Array.isArray(parsed.auxiliary.groups)).toBe(true);
    expect(parsed.auxiliary.version).toBe(5);
  });

  it('does not serialize an unhydrated workbench with no editor panels', () => {
    useWorkbenchStore.setState({
      api: {
        getPanel: () => undefined,
        toJSON: () => dockviewSnapshot,
      } as never,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    expect(useWorkbenchStore.getState().saveLayout()).toBeNull();
  });

  it('rebuilds defaults when the saved Dockview payload has no editor panels', () => {
    const api = createLayoutRecoveryApiStub();
    const corruptLayout = JSON.stringify({
      version: 6,
      dockview: dockviewSnapshot,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });
    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    useWorkbenchStore.getState().loadLayout(corruptLayout);

    expect(api.fromJSON).toHaveBeenCalledWith(dockviewSnapshot);
    expect(api.getPanel('ScoreTopComponent')).toBeDefined();
    expect(api.getPanel('BlueLiveTopComponent')).toBeDefined();
    expect(api.getPanel('OutputTopComponent')).toBeDefined();
  });
});

describe('workbench panel close/reopen restoration', () => {
  it('returns a closed editor tab to its prior group and tab index', () => {
    const { api, group } = createCloseRestoreApiStub();
    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
      closedPanelOrigins: {},
    });

    useWorkbenchStore.getState().closePanel('ScoreTopComponent');

    expect(
      useWorkbenchStore.getState().closedPanelOrigins.ScoreTopComponent,
    ).toMatchObject({
      originGroupId: group.id,
      originIndex: 0,
      originPanelOrder: ['ScoreTopComponent'],
    });
    expect(group.panels.map((panel: { id: string }) => panel.id)).toEqual([
      'OrchestraTopComponent',
    ]);

    useWorkbenchStore.getState().openPanel('ScoreTopComponent');

    expect(group.panels.map((panel: { id: string }) => panel.id)).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(api.addPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'ScoreTopComponent',
        position: expect.objectContaining({
          referenceGroup: group,
          direction: 'within',
          index: 0,
        }),
      }),
    );
    expect(
      useWorkbenchStore.getState().closedPanelOrigins.ScoreTopComponent,
    ).toBeUndefined();
  });

  it('replaces the visible Library Item tab when another session opens', () => {
    const { api, group } = createCloseRestoreApiStub();
    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
      closedPanelOrigins: {},
    });

    useWorkbenchStore.getState().openLibraryEditorPanel(
      createLibraryEditorSession(undefined, { sessionId: 'session-1' }),
    );
    useWorkbenchStore.getState().openLibraryEditorPanel(
      createLibraryEditorSession(undefined, { sessionId: 'session-2' }),
    );

    expect(group.panels.map((panel: { id: string }) => panel.id)).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
      'library-item:session-2',
    ]);
    expect(api.removePanel).toHaveBeenCalledTimes(1);
  });
});

describe('workbench store move and reset actions', () => {
  it('finds the group instance ID for a panel', () => {
    useWorkbenchStore.setState({
      api: dockviewApiStub,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });
    useWorkbenchStore
      .getState()
      .auxiliary.groups.find(
        (group) => group.seedGroupId === 'properties-main',
      )!.panelIds = ['SoundObjectPropertiesTopComponent'];

    const groupInstanceId = useWorkbenchStore
      .getState()
      .getAuxiliaryGroupForPanel('SoundObjectPropertiesTopComponent');

    expect(groupInstanceId).toBe('properties-main');
  });

  it('returns undefined for non-auxiliary panels', () => {
    useWorkbenchStore.setState({
      api: dockviewApiStub,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    const groupInstanceId = useWorkbenchStore
      .getState()
      .getAuxiliaryGroupForPanel('ScoreTopComponent');

    expect(groupInstanceId).toBeUndefined();
  });
});

describe('workbench store float/dock actions', () => {
  it('floats one tab from a multi-tab group without creating a temporary split group', async () => {
    const { api, popoutGroup, scorePanel, sourceGroup } =
      createFloatPanelApiStub();

    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    useWorkbenchStore.getState().floatPanel(scorePanel.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(api.addGroup).not.toHaveBeenCalled();
    expect(api.addPopoutGroup).toHaveBeenCalledWith(
      scorePanel,
      expect.objectContaining({
        popoutUrl: 'popout.html',
      }),
    );
    expect(scorePanel.group).toBe(popoutGroup);
    expect(sourceGroup.panels.map((entry) => entry.id)).toEqual([
      'OrchestraTopComponent',
    ]);
    expect(
      useWorkbenchStore.getState().floatingOrigins[popoutGroup.id],
    ).toMatchObject({
      originGroupId: sourceGroup.id,
      originPanelOrder: [scorePanel.id],
      originIndex: 0,
    });
  });

  it('floats a group into a distinct popout while retaining the original group as its dock target', async () => {
    const { api, popoutGroup, popoutWindow, scorePanel, sourceGroup } =
      createFloatPanelApiStub();

    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    useWorkbenchStore.getState().floatGroup(scorePanel.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(api.addPopoutGroup).toHaveBeenCalledWith(
      sourceGroup,
      expect.objectContaining({ popoutUrl: 'popout.html' }),
    );
    expect(api.addPopoutGroup.mock.calls[0][1]).not.toHaveProperty(
      'overridePopoutGroup',
    );
    expect(sourceGroup.panels).toEqual([]);
    expect(api.removeGroup).not.toHaveBeenCalled();
    expect(popoutGroup.panels.map((entry) => entry.id)).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(
      useWorkbenchStore.getState().floatingOrigins[popoutGroup.id],
    ).toMatchObject({
      originGroupId: sourceGroup.id,
      originPanelOrder: ['ScoreTopComponent', 'OrchestraTopComponent'],
    });
    expect(popoutGroup.layout).toHaveBeenCalledWith(640, 420);
    expect(popoutWindow.dispatchEvent).toHaveBeenCalled();
  });

  it('closes a blank popout window when Dockview fails to attach the floated panel', async () => {
    const { api, popoutGroup, popoutWindow, scorePanel } =
      createFailedFloatPanelApiStub();

    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
    });

    useWorkbenchStore.getState().floatPanel(scorePanel.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(popoutWindow.close).toHaveBeenCalledTimes(1);
    expect(popoutWindow.closed).toBe(true);
    expect(
      useWorkbenchStore.getState().floatingOrigins[popoutGroup.id],
    ).toBeUndefined();
  });

  it('docks a single floated editor tab back and closes the empty popout window', () => {
    const { api, panel, popoutWindow, sourceGroup, targetGroup } =
      createFloatingDockApiStub();

    useWorkbenchStore.setState({
      api,
      auxiliary: createDefaultAuxiliaryLayoutState(),
      floatingOrigins: {
        [sourceGroup.id]: {
          originGroupId: targetGroup.id,
          originMode: 'editor',
          presentation: 'docked',
          originPanelOrder: [panel.id],
          originActivePanelId: panel.id,
          originIndex: 0,
          capturedAt: '2026-07-09T00:00:00.000Z',
        },
      },
    });

    useWorkbenchStore.getState().dockGroup(panel.id);

    expect(panel.group).toBe(targetGroup);
    expect(targetGroup.panels.map((entry) => entry.id)).toEqual([panel.id]);
    expect(sourceGroup.panels).toEqual([]);
    expect(api.component.moveGroupOrPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { groupId: sourceGroup.id, panelId: panel.id },
        keepEmptyGroups: true,
      }),
    );
    expect(api.component.removeGroup).toHaveBeenCalledWith(
      sourceGroup,
      expect.objectContaining({
        skipPopoutAssociated: true,
        skipPopoutReturn: true,
      }),
    );
    expect(popoutWindow.close).toHaveBeenCalledTimes(1);
    expect(popoutWindow.closed).toBe(true);
    expect(
      useWorkbenchStore.getState().floatingOrigins[sourceGroup.id],
    ).toBeUndefined();
  });

  it('removes the hidden right-edge reference before rebuilding a docked auxiliary panel', () => {
    const { api, hiddenReferenceGroup, popoutGroup, propertiesPanel } =
      createAuxiliaryFloatingDockApiStub();
    const auxiliary = createDefaultAuxiliaryLayoutState();
    const properties = auxiliary.groups.find(
      (group) => group.seedGroupId === 'properties-main',
    )!;
    properties.panelIds = [propertiesPanel.id];
    properties.dockedPanelIds = [propertiesPanel.id];
    properties.activePanelId = propertiesPanel.id;
    // Dockview can collapse its hidden popout reference to a small minimum
    // size. The original 360px edge width must win when the panel docks.
    hiddenReferenceGroup.size = 84;

    useWorkbenchStore.setState({
      api,
      auxiliary,
      floatingOrigins: {
        [popoutGroup.id]: {
          originGroupId: hiddenReferenceGroup.id,
          originMode: 'properties',
          presentation: 'docked',
          originPanelOrder: [propertiesPanel.id],
          originActivePanelId: propertiesPanel.id,
          auxiliarySeedGroupId: 'properties-main',
          auxiliaryGroupInstanceId: 'properties-main',
          edge: 'right',
          dockedSize: 360,
          slideoutSize: 200,
        },
      },
    });

    useWorkbenchStore.getState().dockGroup(propertiesPanel.id);

    expect(api.component.removeGroup).toHaveBeenCalledWith(
      popoutGroup,
      expect.objectContaining({
        skipActive: true,
        skipPopoutReturn: true,
      }),
    );
    expect(api.component.removeGroup.mock.calls[0][1]).not.toHaveProperty(
      'skipPopoutAssociated',
    );
    expect(api.groups).not.toContain(hiddenReferenceGroup);
    expect(api.getGroup('blue-aux-edge-right')).toMatchObject({
      panels: [expect.objectContaining({ id: propertiesPanel.id })],
    });
    expect(api.getGroup('blue-aux-edge-right').size).toBe(360);
    expect(
      useWorkbenchStore
        .getState()
        .auxiliary.groups.find(
          (group) => group.seedGroupId === 'properties-main',
        )!.dockedSize,
    ).toBe(360);
    expect(
      api.groups.filter(
        (group: { api: { location: { type: string } }; panels: unknown[] }) =>
          group.api.location.type === 'grid' && group.panels.length === 0,
      ),
    ).toEqual([]);
  });
});

describe('workbench store native menu commands', () => {
  it('routes focus-panel commands through openPanel', () => {
    const openPanel = vi.fn();
    useWorkbenchStore.setState({
      openPanel: openPanel as never,
      resetLayout: vi.fn() as never,
    });

    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'focus-panel',
      panelId: 'ScoreTopComponent',
    });

    expect(openPanel).toHaveBeenCalledWith('ScoreTopComponent');
  });

  it('routes floating window close commands through closeGroup', () => {
    const closeGroup = vi.fn();
    useWorkbenchStore.setState({
      closeGroup: closeGroup as never,
    });

    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'close-floating-group',
      panelId: 'ScoreTopComponent',
    });

    expect(closeGroup).toHaveBeenCalledWith('ScoreTopComponent');
  });

  it('routes open-effects-library commands through the unified Libraries panel', () => {
    const openPanel = vi.fn();
    useWorkbenchStore.setState({
      openPanel: openPanel as never,
      resetLayout: vi.fn() as never,
    });

    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'open-effects-library',
    });

    expect(useLibraryStore.getState().typeFilter).toBe('effect');
    expect(openPanel).toHaveBeenCalledWith('LibrariesTopComponent');
  });

  it('adds menu-created markers at render start when idle', () => {
    const addMarkerAtTime = vi.fn();
    useProjectStore.setState({
      transport: markerMenuTransport,
      addMarkerAtTime: addMarkerAtTime as never,
    });

    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'add-marker',
    });

    expect(addMarkerAtTime).toHaveBeenCalledWith(8);
  });

  it('adds menu-created markers at the live playhead while playing', () => {
    const addMarkerAtTime = vi.fn();
    useProjectStore.setState({
      transport: { ...markerMenuTransport, renderStartTime: 99 },
      addMarkerAtTime: addMarkerAtTime as never,
    });
    usePlaybackStore.setState({
      status: 'playing',
      isPlaying: true,
      clock: {
        sessionId: 1,
        sampleFrames: 0,
        sequence: 1,
        sampleRate: 44100,
        ksmps: 64,
        receivedAtMs: 0,
      },
      display: {
        sampleFrames: 88200,
        elapsedSeconds: 2,
        source: 'engine-authority',
      },
      transportAnchor: markerMenuTransport,
    });

    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'add-marker',
    });

    expect(addMarkerAtTime).toHaveBeenCalledWith(10);
  });

  it('routes Render/Stop Project through the playback store', () => {
    const togglePlaySpy = vi
      .spyOn(usePlaybackStore.getState(), 'togglePlay')
      .mockResolvedValue(undefined);

    try {
      useWorkbenchStore.getState().handleNativeMenuCommand({
        type: 'render-stop-project',
      });

      expect(togglePlaySpy).toHaveBeenCalledOnce();
    } finally {
      togglePlaySpy.mockRestore();
    }
  });
});

describe('workbench-store reset-windows command', () => {
  it('routes the reset-windows native menu command to resetLayout', () => {
    const resetLayoutSpy = vi.spyOn(
      useWorkbenchStore.getState(),
      'resetLayout',
    );
    useWorkbenchStore.getState().handleNativeMenuCommand({
      type: 'reset-windows',
    });
    expect(resetLayoutSpy).toHaveBeenCalledTimes(1);
    resetLayoutSpy.mockRestore();
  });

  it('resetLayout delegates to loadLayout(null) to clear and rebuild dockview', () => {
    // Restore the original store functions (previous tests may have replaced
    // resetLayout with a vi.fn() mock via setState).
    useWorkbenchStore.setState({
      ...useWorkbenchStore.getInitialState(),
      api: dockviewApiStub,
    });
    const loadLayoutSpy = vi.spyOn(useWorkbenchStore.getState(), 'loadLayout');

    try {
      useWorkbenchStore.getState().resetLayout();
    } catch {
      // loadLayout calls buildDefaultWorkbenchLayout which needs a full
      // dockview API; we only need to verify the delegation, not the rebuild.
    }

    expect(loadLayoutSpy).toHaveBeenCalledWith(null);
    loadLayoutSpy.mockRestore();
  });
});
