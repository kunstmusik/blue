import { describe, expect, it } from 'vitest';
import {
  correctOffscreenBounds,
  DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE,
  isOnScreenBounds,
  isValidDockingOrigin,
  normalizeFloatingOriginMap,
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL,
  WORKBENCH_WINDOW_REGISTER_CHANNEL,
  WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL,
  WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL,
  WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL,
  type DockingOrigin,
} from './workbench-window-contract';

function validOrigin(overrides: Partial<DockingOrigin> = {}): DockingOrigin {
  return {
    originMode: 'editor',
    presentation: 'docked',
    originPanelOrder: ['ScoreTopComponent', 'OrchestraTopComponent'],
    ...overrides,
  };
}

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1080 };

describe('workbench-window-contract channel constants', () => {
  it('exposes stable, distinct channel names', () => {
    expect(WORKBENCH_WINDOW_REGISTER_CHANNEL).toBe('workbench-window:register');
    expect(WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL).toBe(
      'workbench-window:update-ownership',
    );
    expect(WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL).toBe(
      'workbench-window:reveal-panel',
    );
    expect(WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL).toBe(
      'workbench-window:request-close',
    );
    expect(WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL).toBe(
      'workbench-window:dock-group',
    );
    expect(PROJECT_DOCUMENT_UPDATED_CHANNEL).toBe('project-document-updated');
  });
});

describe('isValidDockingOrigin', () => {
  it('accepts a minimal valid origin', () => {
    expect(isValidDockingOrigin(validOrigin())).toBe(true);
  });

  it('accepts a fully populated origin', () => {
    expect(
      isValidDockingOrigin(
        validOrigin({
          originGroupId: 'group-1',
          originActivePanelId: 'ScoreTopComponent',
          originIndex: 0,
          restoreReferenceGroupId: 'group-2',
          restoreDirection: 'left',
          auxiliarySeedGroupId: 'output-main',
          auxiliaryGroupInstanceId: 'derived:MixerTopComponent',
          edge: 'right',
          dockedSize: 320,
          slideoutSize: 480,
          capturedAt: '2026-07-08T00:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(isValidDockingOrigin(null)).toBe(false);
    expect(isValidDockingOrigin(undefined)).toBe(false);
    expect(isValidDockingOrigin('nope')).toBe(false);
    expect(isValidDockingOrigin(42)).toBe(false);
  });

  it('rejects missing or invalid originMode', () => {
    const { originMode, ...rest } = validOrigin();
    expect(isValidDockingOrigin(rest)).toBe(false);
    expect(isValidDockingOrigin({ ...rest, originMode: 'garbage' })).toBe(
      false,
    );
  });

  it('rejects missing or invalid presentation', () => {
    const { presentation, ...rest } = validOrigin();
    expect(isValidDockingOrigin(rest)).toBe(false);
    expect(isValidDockingOrigin({ ...rest, presentation: 'hovering' })).toBe(
      false,
    );
  });

  it('rejects non-string-array originPanelOrder', () => {
    expect(
      isValidDockingOrigin({ ...validOrigin(), originPanelOrder: 'a,b' }),
    ).toBe(false);
    expect(
      isValidDockingOrigin({ ...validOrigin(), originPanelOrder: [1, 2] }),
    ).toBe(false);
  });

  it('rejects non-finite optional numeric fields', () => {
    expect(
      isValidDockingOrigin({
        ...validOrigin(),
        originIndex: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false);
    expect(isValidDockingOrigin({ ...validOrigin(), dockedSize: NaN })).toBe(
      false,
    );
    expect(
      isValidDockingOrigin({ ...validOrigin(), slideoutSize: 'big' }),
    ).toBe(false);
  });

  it('rejects an invalid edge value', () => {
    expect(isValidDockingOrigin({ ...validOrigin(), edge: 'top' })).toBe(false);
  });

  it('rejects invalid close-restore placement metadata', () => {
    expect(
      isValidDockingOrigin({ ...validOrigin(), restoreDirection: 'diagonal' }),
    ).toBe(false);
    expect(
      isValidDockingOrigin({ ...validOrigin(), restoreReferenceGroupId: 42 }),
    ).toBe(false);
    expect(
      isValidDockingOrigin({ ...validOrigin(), auxiliaryGroupInstanceId: 42 }),
    ).toBe(false);
  });

  it('rejects an invalid auxiliarySeedGroupId', () => {
    expect(
      isValidDockingOrigin({ ...validOrigin(), auxiliarySeedGroupId: 'nope' }),
    ).toBe(false);
  });

  it('rejects a non-string capturedAt', () => {
    expect(isValidDockingOrigin({ ...validOrigin(), capturedAt: 123 })).toBe(
      false,
    );
  });
});

describe('normalizeFloatingOriginMap', () => {
  it('returns an empty map for non-object input', () => {
    expect(normalizeFloatingOriginMap(null)).toEqual({});
    expect(normalizeFloatingOriginMap(undefined)).toEqual({});
    expect(normalizeFloatingOriginMap('x')).toEqual({});
  });

  it('keeps valid origins and drops invalid ones', () => {
    const normalized = normalizeFloatingOriginMap({
      'popout-1': validOrigin(),
      'popout-2': { originMode: 'editor' },
      'popout-3': validOrigin({ originGroupId: 'g3' }),
    });
    expect(Object.keys(normalized).sort()).toEqual(['popout-1', 'popout-3']);
    expect(normalized['popout-1'].originPanelOrder).toEqual([
      'ScoreTopComponent',
      'OrchestraTopComponent',
    ]);
    expect(normalized['popout-3'].originGroupId).toBe('g3');
  });
});

describe('isOnScreenBounds', () => {
  it('returns true when no work areas are supplied', () => {
    expect(
      isOnScreenBounds({ x: -5000, y: -5000, width: 10, height: 10 }, []),
    ).toBe(true);
  });

  it('returns true when bounds intersect a work area', () => {
    expect(
      isOnScreenBounds({ x: 100, y: 100, width: 400, height: 300 }, [
        WORK_AREA,
      ]),
    ).toBe(true);
  });

  it('returns false when bounds miss every work area', () => {
    expect(
      isOnScreenBounds({ x: -5000, y: -5000, width: 100, height: 100 }, [
        WORK_AREA,
      ]),
    ).toBe(false);
  });

  it('checks against multiple work areas', () => {
    const second = { x: 1920, y: 0, width: 1080, height: 1080 };
    expect(
      isOnScreenBounds({ x: 2000, y: 50, width: 200, height: 200 }, [
        WORK_AREA,
        second,
      ]),
    ).toBe(true);
  });
});

describe('correctOffscreenBounds', () => {
  it('enforces the minimum size floor', () => {
    const corrected = correctOffscreenBounds(
      { x: 100, y: 100, width: 10, height: 10 },
      [WORK_AREA],
    );
    expect(corrected.width).toBe(DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE);
    expect(corrected.height).toBe(DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE);
  });

  it('keeps on-screen position, only flooring size', () => {
    const corrected = correctOffscreenBounds(
      { x: 200, y: 200, width: 500, height: 400 },
      [WORK_AREA],
    );
    expect(corrected).toEqual({ x: 200, y: 200, width: 500, height: 400 });
  });

  it('snaps offscreen bounds onto the first available work area', () => {
    const corrected = correctOffscreenBounds(
      { x: -5000, y: -5000, width: 400, height: 300 },
      [WORK_AREA],
    );
    expect(corrected).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('uses a custom minimum size', () => {
    const corrected = correctOffscreenBounds(
      { x: 100, y: 100, width: 50, height: 50 },
      [WORK_AREA],
      { minimumSize: 300 },
    );
    expect(corrected.width).toBe(300);
    expect(corrected.height).toBe(300);
  });

  it('handles non-finite bounds gracefully when no work areas exist', () => {
    const corrected = correctOffscreenBounds(
      { x: NaN, y: Number.POSITIVE_INFINITY, width: NaN, height: undefined },
      [],
    );
    expect(corrected.x).toBe(0);
    expect(corrected.y).toBe(0);
    expect(corrected.width).toBe(DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE);
    expect(corrected.height).toBe(DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE);
  });
});
