import { describe, expect, it, vi } from 'vitest';
import {
  clearDockviewSafely,
  collectExpectedPopoutPanelIds,
  createPopoutOpenGuard,
  enforcePopoutPanelIntent,
  prepareDockviewForExplicitPopoutRestore,
  restorePreparedPopoutGroups,
  useWorkbenchStore,
  waitForCurrentWorkbenchApi,
} from '../stores/workbench-store';

function makeGroup(location: 'grid' | 'popout') {
  return {
    api: {
      location: { type: location },
      close: vi.fn(),
    },
    panels: [] as unknown[],
  };
}

type Stub = Parameters<typeof clearDockviewSafely>[0];

function makeApi(groups: ReturnType<typeof makeGroup>[], clearImpl?: () => void): Stub {
  return {
    groups,
    clear: vi.fn(clearImpl ?? (() => undefined)),
    removeGroup: vi.fn(),
  } as unknown as Stub;
}

describe('clearDockviewSafely', () => {
  it('closes popout groups through their own api before clearing', () => {
    const popout = makeGroup('popout');
    const grid = makeGroup('grid');
    const api = makeApi([popout, grid]);

    clearDockviewSafely(api);

    expect(popout.api.close).toHaveBeenCalledTimes(1);
    expect(grid.api.close).not.toHaveBeenCalled();
    expect(api.clear).toHaveBeenCalledTimes(1);
    expect(api.removeGroup).not.toHaveBeenCalled();
  });

  it('recovers when clear() throws on a foreign popout grid element', () => {
    const popout = makeGroup('popout');
    const grid = makeGroup('grid');
    const api = makeApi([popout, grid], () => {
      throw new Error('Invalid grid element');
    });

    expect(() => clearDockviewSafely(api)).not.toThrow();
    expect(popout.api.close).toHaveBeenCalledTimes(1);
    expect(api.removeGroup).toHaveBeenCalledTimes(2);
  });

  it('swallows per-group removal failures in the fallback path', () => {
    const popout = makeGroup('popout');
    const removeGroup = vi.fn(() => {
      throw new Error('Invalid grid element');
    });
    const api = {
      groups: [popout],
      clear: vi.fn(() => {
        throw new Error('Invalid grid element');
      }),
      removeGroup,
    } as unknown as Stub;

    expect(() => clearDockviewSafely(api)).not.toThrow();
    expect(popout.api.close).toHaveBeenCalledTimes(1);
  });

  it('clears a plain docked grid without touching group apis', () => {
    const grid = makeGroup('grid');
    const api = makeApi([grid]);

    clearDockviewSafely(api);

    expect(api.clear).toHaveBeenCalledTimes(1);
    expect(api.removeGroup).not.toHaveBeenCalled();
  });
});

describe('waitForCurrentWorkbenchApi', () => {
  it('rejects the stale API from React StrictMode before restore starts', async () => {
    const firstApi = {} as never;
    const secondApi = {} as never;
    useWorkbenchStore.setState({ api: firstApi });

    const firstReady = waitForCurrentWorkbenchApi(firstApi);
    useWorkbenchStore.setState({ api: secondApi });

    await expect(firstReady).resolves.toBe(false);
    await expect(waitForCurrentWorkbenchApi(secondApi)).resolves.toBe(true);
    useWorkbenchStore.setState({ api: null });
  });
});

describe('createPopoutOpenGuard', () => {
  it('does not reload Electron\'s about:blank proxy before popout navigation', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const location = { pathname: 'blank', reload };
    const openedWindow = {
      closed: false,
      close: vi.fn(),
      document: {
        readyState: 'complete',
        getElementById: vi.fn(() => null),
      },
      location,
    } as unknown as Window;
    const guard = createPopoutOpenGuard({ groups: [] } as never);

    guard.onDidOpen({ window: openedWindow });
    vi.advanceTimersByTime(0);
    expect(reload).not.toHaveBeenCalled();

    location.pathname = '/popout.html';
    vi.advanceTimersByTime(100);
    expect(reload).toHaveBeenCalledTimes(1);

    guard.complete(true);
    vi.useRealTimers();
  });
});

function makePanel(id: string) {
  return {
    id,
    api: {
      moveTo: vi.fn(),
    },
  };
}

function makePopoutWithPanels(ids: string[]) {
  const group = makeGroup('popout');
  (group as unknown as { panels: unknown[] }).panels = ids.map(makePanel);
  return group;
}

function makeGridWithPanels(ids: string[]) {
  const group = makeGroup('grid');
  (group as unknown as { panels: unknown[] }).panels = ids.map(makePanel);
  return group;
}

describe('collectExpectedPopoutPanelIds', () => {
  it('reads ids from views arrays, panels arrays, and panels records', () => {
    const expected = collectExpectedPopoutPanelIds({
      popoutGroups: [
        { data: { views: ['a', 'b'] } },
        { data: { panels: ['c', 'd'] } },
        { data: { panels: { e: {}, f: {} } } },
      ],
    });
    expect([...expected].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('returns an empty set for absent or malformed snapshots', () => {
    expect(collectExpectedPopoutPanelIds(null).size).toBe(0);
    expect(collectExpectedPopoutPanelIds({}).size).toBe(0);
    expect(collectExpectedPopoutPanelIds({ popoutGroups: 'nope' }).size).toBe(0);
  });
});

describe('explicit popout restoration', () => {
  const serialized = {
    grid: {
      root: {
        type: 'branch',
        data: [
          {
            type: 'leaf',
            data: {
              views: ['OrchestraTopComponent'],
              activeView: 'OrchestraTopComponent',
              id: '2',
            },
            size: 700,
          },
        ],
        size: 700,
      },
      width: 1200,
      height: 700,
      orientation: 'HORIZONTAL',
    },
    panels: {
      ScoreTopComponent: { id: 'ScoreTopComponent' },
      OrchestraTopComponent: { id: 'OrchestraTopComponent' },
    },
    activeGroup: '1',
    popoutGroups: [
      {
        data: {
          views: ['ScoreTopComponent'],
          activeView: 'ScoreTopComponent',
          id: '1',
        },
        gridReferenceGroup: '2',
        position: { top: 200, left: 250, width: 760, height: 480 },
        url: 'popout.html',
      },
    ],
  };

  it('puts serialized popout panels back into their source group before fromJSON', () => {
    const prepared = prepareDockviewForExplicitPopoutRestore(serialized as never, {
      '1': {
        originMode: 'editor',
        presentation: 'docked',
        originPanelOrder: ['ScoreTopComponent'],
        originGroupId: '2',
        originActivePanelId: 'ScoreTopComponent',
        originIndex: 0,
      },
    });

    expect(prepared.layout.popoutGroups).toBeUndefined();
    expect((prepared.layout.grid.root.data as any[])[0].data.views).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(prepared.intents).toEqual([
      expect.objectContaining({
        serializedGroupId: '1',
        gridReferenceGroupId: '2',
        panelIds: ['ScoreTopComponent'],
      }),
    ]);
  });

  it('restores a single floated panel without moving the rest of its editor group', async () => {
    const prepared = prepareDockviewForExplicitPopoutRestore(serialized as never, {});
    const sourceGroup = {
      id: '2',
      panels: [] as any[],
      api: { location: { type: 'grid' as const } },
    };
    const popoutGroup = {
      id: 'generated-popout',
      panels: [] as any[],
      api: { location: { type: 'popout' as const } },
    };
    const score = { id: 'ScoreTopComponent', group: sourceGroup };
    const orchestra = { id: 'OrchestraTopComponent', group: sourceGroup };
    sourceGroup.panels.push(score, orchestra);
    const panels = new Map([
      [score.id, score],
      [orchestra.id, orchestra],
    ]);
    const api = {
      groups: [sourceGroup, popoutGroup],
      getPanel: vi.fn((id: string) => panels.get(id)),
      addPopoutGroup: vi.fn(async (item: typeof score | typeof sourceGroup) => {
        const movedPanels = 'panels' in item ? [...item.panels] : [item];
        sourceGroup.panels = sourceGroup.panels.filter(
          (panel) => !movedPanels.includes(panel),
        );
        for (const panel of movedPanels) {
          panel.group = popoutGroup;
          popoutGroup.panels.push(panel);
        }
        return true;
      }),
    };

    const groupIds = await restorePreparedPopoutGroups(
      api as never,
      prepared.intents,
    );

    expect(api.addPopoutGroup).toHaveBeenCalledWith(
      score,
      expect.objectContaining({ popoutUrl: 'popout.html' }),
    );
    expect(popoutGroup.panels.map((panel) => panel.id)).toEqual(['ScoreTopComponent']);
    expect(sourceGroup.panels.map((panel) => panel.id)).toEqual(['OrchestraTopComponent']);
    expect(groupIds).toEqual({ '1': 'generated-popout' });
  });
});

describe('enforcePopoutPanelIntent', () => {
  it('moves mis-assigned panels from the popout back to the main grid', () => {
    const score = makePanel('ScoreTopComponent');
    const mixer = makePanel('MixerTopComponent');
    const popout = makePopoutWithPanels([]);
    popout.panels = [score, mixer];
    const mainGrid = makeGridWithPanels(['LibrariesTopComponent']);
    const api = makeApi([mainGrid, popout]);

    enforcePopoutPanelIntent(api, new Set(['ScoreTopComponent']));

    // Score belongs in the popout; mixer was docked in the snapshot and must
    // be moved back to the first non-popout group.
    expect(score.api.moveTo).not.toHaveBeenCalled();
    expect(mixer.api.moveTo).toHaveBeenCalledWith({ group: mainGrid });
  });

  it('leaves everything alone when popout contents match the snapshot', () => {
    const score = makePanel('ScoreTopComponent');
    const popout = makePopoutWithPanels([]);
    popout.panels = [score];
    const mainGrid = makeGridWithPanels(['MixerTopComponent']);
    const api = makeApi([mainGrid, popout]);

    enforcePopoutPanelIntent(api, new Set(['ScoreTopComponent']));

    const dockedPanel = mainGrid.panels[0] as { api: { moveTo: ReturnType<typeof vi.fn> } };
    expect(score.api.moveTo).not.toHaveBeenCalled();
    expect(dockedPanel.api.moveTo).not.toHaveBeenCalled();
  });

  it('moves all popout panels back when the snapshot had no popouts', () => {
    const stray = makePanel('ScoreTopComponent');
    const popout = makePopoutWithPanels([]);
    popout.panels = [stray];
    const mainGrid = makeGridWithPanels([]);
    const api = makeApi([mainGrid, popout]);

    enforcePopoutPanelIntent(api, new Set());

    expect(stray.api.moveTo).toHaveBeenCalledWith({ group: mainGrid });
  });

  it('is a no-op when there is no non-popout group to receive panels', () => {
    const stray = makePanel('ScoreTopComponent');
    const popout = makePopoutWithPanels([]);
    popout.panels = [stray];
    const api = makeApi([popout]);

    expect(() => enforcePopoutPanelIntent(api, new Set())).not.toThrow();
    expect(stray.api.moveTo).not.toHaveBeenCalled();
  });
});
