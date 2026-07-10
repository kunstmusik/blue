import { describe, expect, it } from 'vitest';
import {
  captureDockingOrigin,
  clampPopoutBounds,
  recordFloatingOrigin,
  removeFloatingOrigin,
  resolveDockTarget,
} from './floating-origin';

describe('captureDockingOrigin', () => {
  it('snapshots required fields and copies the panel order', () => {
    const origin = captureDockingOrigin({
      groupId: 'group-1',
      panelIds: ['ScoreTopComponent', 'OrchestraTopComponent'],
      activePanelId: 'ScoreTopComponent',
      mode: 'editor',
      presentation: 'docked',
    });
    expect(origin.originMode).toBe('editor');
    expect(origin.presentation).toBe('docked');
    expect(origin.originPanelOrder).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(origin.originGroupId).toBe('group-1');
    expect(origin.originActivePanelId).toBe('ScoreTopComponent');
  });

  it('copies the panel-order array so later mutation does not bleed in', () => {
    const panelIds = ['MixerTopComponent'];
    const origin = captureDockingOrigin({
      panelIds,
      mode: 'output',
      presentation: 'docked',
    });
    panelIds.push('OutputTopComponent');
    expect(origin.originPanelOrder).toEqual(['MixerTopComponent']);
  });

  it('records auxiliary edge/seed/sizing metadata', () => {
    const origin = captureDockingOrigin({
      panelIds: ['MixerTopComponent'],
      mode: 'output',
      presentation: 'minimized',
      auxiliarySeedGroupId: 'output-main',
      edge: 'bottom',
      dockedSize: 240,
      slideoutSize: 320,
      originIndex: 1,
      restoreReferenceGroupId: 'group-2',
      restoreDirection: 'above',
      auxiliaryGroupInstanceId: 'output-main',
      capturedAt: '2026-07-08T00:00:00.000Z',
    });
    expect(origin.auxiliarySeedGroupId).toBe('output-main');
    expect(origin.edge).toBe('bottom');
    expect(origin.dockedSize).toBe(240);
    expect(origin.slideoutSize).toBe(320);
    expect(origin.originIndex).toBe(1);
    expect(origin.restoreReferenceGroupId).toBe('group-2');
    expect(origin.restoreDirection).toBe('above');
    expect(origin.auxiliaryGroupInstanceId).toBe('output-main');
    expect(origin.capturedAt).toBe('2026-07-08T00:00:00.000Z');
  });
});

describe('recordFloatingOrigin / removeFloatingOrigin', () => {
  it('adds and removes origins immutably', () => {
    const origin = captureDockingOrigin({
      panelIds: ['ScoreTopComponent'],
      mode: 'editor',
      presentation: 'docked',
    });
    const recorded = recordFloatingOrigin({}, 'popout-1', origin);
    expect(recorded['popout-1']).toBe(origin);

    const removed = removeFloatingOrigin(recorded, 'popout-1');
    expect(removed).toEqual({});
  });

  it('removeFloatingOrigin is a no-op for unknown ids', () => {
    const origin = captureDockingOrigin({
      panelIds: ['ScoreTopComponent'],
      mode: 'editor',
      presentation: 'docked',
    });
    const origins = recordFloatingOrigin({}, 'popout-1', origin);
    expect(removeFloatingOrigin(origins, 'nope')).toBe(origins);
  });
});

describe('resolveDockTarget', () => {
  it('returns the stored origin and keeps only panels still in the registry', () => {
    const origins = recordFloatingOrigin(
      {},
      'popout-1',
      captureDockingOrigin({
        groupId: 'group-1',
        panelIds: [
          'ScoreTopComponent',
          'OrchestraTopComponent',
          'GoneTopComponent',
        ],
        activePanelId: 'ScoreTopComponent',
        mode: 'editor',
        presentation: 'docked',
      }),
    );

    const resolution = resolveDockTarget(
      origins,
      'popout-1',
      new Set(['ScoreTopComponent', 'OrchestraTopComponent']),
    );

    expect(resolution.origin?.originGroupId).toBe('group-1');
    expect(resolution.validPanelIds).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(resolution.fallbackMode).toBe('editor');
  });

  it('falls back to editor mode and empty panels when the origin is missing', () => {
    const resolution = resolveDockTarget(
      {},
      'popout-missing',
      new Set(['ScoreTopComponent']),
    );
    expect(resolution.origin).toBeUndefined();
    expect(resolution.fallbackMode).toBe('editor');
    expect(resolution.validPanelIds).toEqual([]);
  });

  it('falls back when the stored origin is structurally invalid', () => {
    const origins = { 'popout-bad': { originMode: 'editor' } } as never;
    const resolution = resolveDockTarget(
      origins,
      'popout-bad',
      new Set(['ScoreTopComponent']),
    );
    expect(resolution.origin).toBeUndefined();
    expect(resolution.fallbackMode).toBe('editor');
  });

  it('uses the auxiliary origin mode as the fallback', () => {
    const origins = recordFloatingOrigin(
      {},
      'popout-1',
      captureDockingOrigin({
        panelIds: ['MixerTopComponent'],
        mode: 'output',
        presentation: 'minimized',
        edge: 'bottom',
      }),
    );
    const resolution = resolveDockTarget(
      origins,
      'popout-1',
      new Set(['MixerTopComponent']),
    );
    expect(resolution.fallbackMode).toBe('output');
  });
});

describe('clampPopoutBounds', () => {
  const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1080 };

  it('snaps offscreen popout positions onto the first available work area', () => {
    const dockview = {
      grid: { root: { type: 'branch' } },
      panels: {},
      popoutGroups: [
        {
          data: { id: 'group-1' },
          position: { left: -5000, top: -5000, width: 400, height: 300 },
        },
      ],
    };

    const clamped = clampPopoutBounds(dockview, [WORK_AREA]);
    const position = clamped.popoutGroups[0].position;
    expect(position).toEqual({ left: 0, top: 0, width: 400, height: 300 });
  });

  it('keeps on-screen positions unchanged', () => {
    const dockview = {
      grid: { root: { type: 'branch' } },
      panels: {},
      popoutGroups: [
        {
          data: { id: 'group-1' },
          position: { left: 200, top: 200, width: 500, height: 400 },
        },
      ],
    };

    const clamped = clampPopoutBounds(dockview, [WORK_AREA]);
    expect(clamped.popoutGroups[0].position).toEqual({
      left: 200,
      top: 200,
      width: 500,
      height: 400,
    });
  });

  it('enforces the minimum size floor on restore', () => {
    const dockview = {
      grid: { root: { type: 'branch' } },
      panels: {},
      popoutGroups: [
        {
          data: { id: 'group-1' },
          position: { left: 100, top: 100, width: 10, height: 10 },
        },
      ],
    };

    const clamped = clampPopoutBounds(dockview, [WORK_AREA]);
    expect(clamped.popoutGroups[0].position.width).toBeGreaterThanOrEqual(160);
    expect(clamped.popoutGroups[0].position.height).toBeGreaterThanOrEqual(160);
  });

  it('returns the input unchanged when there are no popout groups', () => {
    const dockview = { grid: { root: { type: 'branch' } }, panels: {} };
    expect(clampPopoutBounds(dockview, [WORK_AREA])).toBe(dockview);
  });

  it('does not mutate the original input', () => {
    const dockview = {
      grid: { root: { type: 'branch' } },
      panels: {},
      popoutGroups: [
        {
          data: { id: 'group-1' },
          position: { left: -5000, top: -5000, width: 400, height: 300 },
        },
      ],
    };

    clampPopoutBounds(dockview, [WORK_AREA]);
    expect(dockview.popoutGroups[0].position.left).toBe(-5000);
  });
});
