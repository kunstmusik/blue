import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  reportOwnership,
  restoreWelcomeAfterLayoutHydration,
  selectWorkbenchLayout,
} from './WorkbenchShell';

function createMockGroup(
  id: string,
  panelIds: string[],
  activePanelId?: string,
  locationType: 'grid' | 'popout' = 'grid',
) {
  return {
    id,
    panels: panelIds.map((pid) => ({ id: pid })),
    activePanel: activePanelId ? { id: activePanelId } : undefined,
    api: { location: { type: locationType } },
  };
}

function createMockApi(groups: ReturnType<typeof createMockGroup>[]) {
  return { groups } as unknown as Parameters<typeof reportOwnership>[0];
}

describe('reportOwnership', () => {
  let updateWorkbenchOwnership: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateWorkbenchOwnership = vi.fn();
    vi.stubGlobal('window', { blueAPI: { updateWorkbenchOwnership } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends grid ownership and popout ownership separately', () => {
    const api = createMockApi([
      createMockGroup('g1', ['panel-a', 'panel-b'], 'panel-a'),
      createMockGroup('popout-1', ['panel-c'], 'panel-c', 'popout'),
    ]);

    reportOwnership(api);

    expect(updateWorkbenchOwnership).toHaveBeenCalledTimes(2);
    // Grid ownership
    expect(updateWorkbenchOwnership).toHaveBeenCalledWith({
      windowId: 'main',
      role: 'main',
      panelIds: ['panel-a', 'panel-b'],
      activePanelId: 'panel-a',
    });
    // Popout ownership
    expect(updateWorkbenchOwnership).toHaveBeenCalledWith({
      windowId: 'main',
      role: 'floating',
      popoutGroupId: 'popout-1',
      panelIds: ['panel-c'],
      activePanelId: 'panel-c',
    });
  });

  it('uses the stored windowId when provided', () => {
    const api = createMockApi([
      createMockGroup('g1', ['panel-a'], 'panel-a'),
    ]);

    reportOwnership(api, 'wbw-1');

    expect(updateWorkbenchOwnership).toHaveBeenCalledWith({
      windowId: 'wbw-1',
      role: 'main',
      panelIds: ['panel-a'],
      activePanelId: 'panel-a',
    });
  });

  it('reports popout groups with popoutGroupId', () => {
    const api = createMockApi([
      createMockGroup('g1', ['p1'], 'p1'),
      createMockGroup('popout-1', ['p2'], 'p2', 'popout'),
    ]);

    reportOwnership(api);

    expect(updateWorkbenchOwnership).toHaveBeenCalledTimes(2);
    const popoutCall = updateWorkbenchOwnership.mock.calls[1][0];
    expect(popoutCall.role).toBe('floating');
    expect(popoutCall.popoutGroupId).toBe('popout-1');
    expect(popoutCall.panelIds).toEqual(['p2']);
  });

  it('reports empty grid panelIds when all groups are popout', () => {
    const api = createMockApi([
      createMockGroup('popout-1', ['p1'], 'p1', 'popout'),
      createMockGroup('popout-2', ['p2'], undefined, 'popout'),
    ]);

    reportOwnership(api);

    // 1 grid ownership (empty) + 2 popout ownerships
    expect(updateWorkbenchOwnership).toHaveBeenCalledTimes(3);
    expect(updateWorkbenchOwnership).toHaveBeenCalledWith({
      windowId: 'main',
      role: 'main',
      panelIds: [],
      activePanelId: undefined,
    });
  });

  it('picks first active panel across grid groups', () => {
    const api = createMockApi([
      createMockGroup('g1', ['p1', 'p2'], 'p2'),
      createMockGroup('g2', ['p3', 'p4'], 'p4'),
    ]);

    reportOwnership(api);

    const call = updateWorkbenchOwnership.mock.calls[0][0];
    expect(call.activePanelId).toBe('p2');
  });

  it('is silent when blueAPI is absent', () => {
    vi.stubGlobal('window', {});
    const api = createMockApi([
      createMockGroup('g1', ['p1'], 'p1'),
    ]);

    expect(() => reportOwnership(api)).not.toThrow();
    expect(updateWorkbenchOwnership).not.toHaveBeenCalled();
  });

  it('is silent when updateWorkbenchOwnership throws', () => {
    updateWorkbenchOwnership.mockImplementation(() => {
      throw new Error('IPC failure');
    });
    const api = createMockApi([
      createMockGroup('g1', ['p1'], 'p1'),
    ]);

    expect(() => reportOwnership(api)).not.toThrow();
  });
});

describe('selectWorkbenchLayout', () => {
  it('prefers the canonical app-wide layout', () => {
    expect(
      selectWorkbenchLayout(
        { workbench: { serializedLayout: 'canonical' } },
        'legacy',
      ),
    ).toBe('canonical');
  });

  it('does not restore legacy layout after Reset Windows', () => {
    expect(selectWorkbenchLayout({ lastResetAt: '2026-07-09T00:00:00Z' }, 'legacy')).toBeNull();
  });

  it('rebuilds defaults when a stale canonical layout survived Reset Windows', () => {
    expect(
      selectWorkbenchLayout(
        {
          lastResetAt: '2026-07-09T00:00:00Z',
          workbench: { serializedLayout: 'stale-canonical' },
        },
        'stale-legacy',
      ),
    ).toBeNull();
  });

  it('uses legacy layout only before the canonical reset marker exists', () => {
    expect(selectWorkbenchLayout(null, 'legacy')).toBe('legacy');
  });
});

describe('restoreWelcomeAfterLayoutHydration', () => {
  it('reopens Welcome after a saved layout replaces the initial panels', () => {
    const openPanel = vi.fn();

    restoreWelcomeAfterLayoutHydration('welcome', openPanel);

    expect(openPanel).toHaveBeenCalledWith('WelcomeTopComponent');
  });

  it('preserves the saved active editor when a project is loaded', () => {
    const openPanel = vi.fn();

    restoreWelcomeAfterLayoutHydration('project', openPanel);

    expect(openPanel).not.toHaveBeenCalled();
  });
});
