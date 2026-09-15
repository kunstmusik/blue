// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreLayerGroupSnapshot } from '../../shared/project-editor';
import {
  useLayerHeightResize,
  type UseLayerHeightResizeParams,
} from '../components/workbench/panels/score/useLayerHeightResize';
import {
  LayerHeightResizeHandle,
  type LayerHeightResizeHandleProps,
} from '../components/workbench/panels/score/LayerHeightResizeHandle';
import {
  flattenVisibleLayers,
  resolveLayerHeightTargets,
  getNextPresetHeight,
  getLayerHeightStatus,
  buildSelectionKey,
  type VisibleLayerRef,
} from '../components/workbench/panels/score/layer-selection-utils';
import { useProjectStore } from '../stores/project-store';
import { settleHistoryEditors } from '../lib/history-scope-router';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeTestLayerGroups(): ScoreLayerGroupSnapshot[] {
  return [
    {
      groupId: 'sound-grp',
      groupType: 'polyObject',
      name: 'Sound Layers',
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 's-0',
          layerSelectionId: 'sel-s-0',
          name: 'Sound 1',
          height: 44,
          items: [],
        },
        {
          layerId: 's-1',
          layerSelectionId: 'sel-s-1',
          name: 'Sound 2',
          height: 88,
          items: [],
        },
      ],
    },
    {
      groupId: 'track-grp',
      groupType: 'track',
      name: 'Tracks',
      layerCount: 2,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 't-0',
          layerSelectionId: 'sel-t-0',
          name: 'Track 1',
          height: 44,
          items: [],
        },
        {
          layerId: 't-1',
          layerSelectionId: 'sel-t-1',
          name: 'Track 2',
          height: 66,
          items: [],
        },
      ],
    },
    {
      groupId: 'pat-grp',
      groupType: 'patterns',
      name: 'Patterns',
      layerCount: 1,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'p-0',
          layerSelectionId: 'sel-p-0',
          name: 'Pattern 1',
          height: 44,
          items: [],
        },
      ],
    },
  ];
}

describe('Layer Height Target Resolution (resolveLayerHeightTargets)', () => {
  const groups = makeTestLayerGroups();
  const visibleLayers = flattenVisibleLayers(groups, 'scope-1');

  it('resolves single SoundLayer when not selected', () => {
    const res = resolveLayerHeightTargets({
      clickedGroupId: 'sound-grp',
      clickedLayerIndex: 0,
      clickedLayerSelectionId: 'sel-s-0',
      visibleLayers,
      selectedKeys: new Set(),
    });

    expect(res.ok).toBe(true);
    expect(res.isMulti).toBe(false);
    expect(res.targets).toHaveLength(1);
    expect(res.targets[0]).toMatchObject({
      groupId: 'sound-grp',
      layerIndex: 0,
      layerSelectionId: 'sel-s-0',
      initialHeight: 44,
      layerName: 'Sound 1',
    });
  });

  it('resolves multi-layer selection across Sound and Track groups when clicked layer is in selection', () => {
    const selectedKeys = new Set([
      buildSelectionKey('sound-grp', 'sel-s-0'),
      buildSelectionKey('track-grp', 'sel-t-0'),
    ]);

    const res = resolveLayerHeightTargets({
      clickedGroupId: 'sound-grp',
      clickedLayerIndex: 0,
      clickedLayerSelectionId: 'sel-s-0',
      visibleLayers,
      selectedKeys,
    });

    expect(res.ok).toBe(true);
    expect(res.isMulti).toBe(true);
    expect(res.targets).toHaveLength(2);
    expect(res.targets[0].groupId).toBe('sound-grp');
    expect(res.targets[1].groupId).toBe('track-grp');
  });

  it('resizes only clicked row and preserves selection when clicking outside selection', () => {
    const selectedKeys = new Set([
      buildSelectionKey('sound-grp', 'sel-s-1'),
      buildSelectionKey('track-grp', 'sel-t-0'),
    ]);

    const res = resolveLayerHeightTargets({
      clickedGroupId: 'sound-grp',
      clickedLayerIndex: 0,
      clickedLayerSelectionId: 'sel-s-0',
      visibleLayers,
      selectedKeys,
    });

    expect(res.ok).toBe(true);
    expect(res.isMulti).toBe(false);
    expect(res.targets).toHaveLength(1);
    expect(res.targets[0].layerSelectionId).toBe('sel-s-0');
  });

  it('disables operation with explanation when selection includes fixed-height Pattern rows', () => {
    const selectedKeys = new Set([
      buildSelectionKey('sound-grp', 'sel-s-0'),
      buildSelectionKey('pat-grp', 'sel-p-0'),
    ]);

    const res = resolveLayerHeightTargets({
      clickedGroupId: 'sound-grp',
      clickedLayerIndex: 0,
      clickedLayerSelectionId: 'sel-s-0',
      visibleLayers,
      selectedKeys,
    });

    expect(res.ok).toBe(false);
    expect(res.disabledReason).toContain('Pattern layers cannot be resized');
    expect(res.targets).toHaveLength(0);
  });

  it('disables operation when clicking directly on a Pattern row', () => {
    const res = resolveLayerHeightTargets({
      clickedGroupId: 'pat-grp',
      clickedLayerIndex: 0,
      clickedLayerSelectionId: 'sel-p-0',
      visibleLayers,
      selectedKeys: new Set(),
    });

    expect(res.ok).toBe(false);
    expect(res.disabledReason).toContain('Pattern layers cannot be resized');
  });
});

describe('Preset & Wheel Zoom Helpers', () => {
  it('steps strictly to higher preset from custom height', () => {
    expect(getNextPresetHeight(57, 1, 'polyObject')).toBe(66);
    expect(getNextPresetHeight(44, 1, 'polyObject')).toBe(66);
    expect(getNextPresetHeight(198, 1, 'polyObject')).toBeNull(); // At top: no-op
  });

  it('steps strictly to lower preset from custom height', () => {
    expect(getNextPresetHeight(57, -1, 'polyObject')).toBe(44);
    expect(getNextPresetHeight(44, -1, 'polyObject')).toBe(22);
    expect(getNextPresetHeight(22, -1, 'polyObject')).toBeNull(); // At bottom: no-op
  });

  it('supports Track preset 220', () => {
    expect(getNextPresetHeight(198, 1, 'track')).toBe(220);
    expect(getNextPresetHeight(210, 1, 'track')).toBe(220);
    expect(getNextPresetHeight(220, -1, 'track')).toBe(198);
  });

  it('detects preset, custom, and mixed status accurately', () => {
    expect(getLayerHeightStatus([44, 44], 'polyObject')).toEqual({
      status: 'preset',
      value: 44,
      presetIndex: 1,
    });
    expect(getLayerHeightStatus([57, 57], 'polyObject')).toEqual({
      status: 'custom',
      value: 57,
    });
    expect(getLayerHeightStatus([44, 57], 'polyObject')).toEqual({
      status: 'mixed',
    });
  });
});

describe('useLayerHeightResize Lifecycle and Gestures', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockApplyPatch: ReturnType<typeof vi.fn>;
  let mockFlushPatches: ReturnType<typeof vi.fn>;
  let mockRefreshSnapshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockApplyPatch = vi.fn().mockResolvedValue(undefined);
    mockFlushPatches = vi.fn().mockResolvedValue(undefined);
    mockRefreshSnapshot = vi.fn().mockResolvedValue(undefined);

    useProjectStore.setState({
      loaded: true,
      sessionId: 10,
      applyProjectDocumentPatch: mockApplyPatch as any,
      flushPendingPatches: mockFlushPatches as any,
      refreshCanonicalSnapshot: mockRefreshSnapshot as any,
      getProjectDocumentRevision: () => 1,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderHookHarness(params: Partial<UseLayerHeightResizeParams> = {}) {
    let hookResult: ReturnType<typeof useLayerHeightResize> | undefined;

    const Harness: React.FC = () => {
      const groups = params.layerGroups ?? makeTestLayerGroups();
      const visible = params.visibleLayers ?? flattenVisibleLayers(groups, 'scope-1');
      const result = useLayerHeightResize({
        layerGroups: groups,
        scopeGroupId: null,
        projectSessionId: 10,
        projectRevision: 1,
        visibleLayers: visible,
        selectedKeys: params.selectedKeys ?? new Set(),
        scrollContainerRef: params.scrollContainerRef,
        ...params,
      });
      hookResult = result;
      return null;
    };

    act(() => {
      root.render(<Harness />);
    });

    return () => hookResult!;
  }

  it('initializes in idle phase with identical projectedLayerGroups reference', () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    expect(getHook().phase).toBe('idle');
    expect(getHook().projectedLayerGroups).toBe(groups);
    expect(getHook().activeTargets).toEqual([]);
    expect(getHook().activeTarget).toBeNull();
    expect(getHook().currentDelta).toBe(0);
  });

  it('keeps the clicked selected row as the active readout anchor', () => {
    const groups = makeTestLayerGroups();
    const selectedKeys = new Set([
      buildSelectionKey('sound-grp', 'sel-s-0'),
      buildSelectionKey('sound-grp', 'sel-s-1'),
    ]);
    const getHook = renderHookHarness({ layerGroups: groups, selectedKeys });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 1,
        layerSelectionId: 'sel-s-1',
      });
    });

    expect(getHook().activeTarget).toMatchObject({
      groupId: 'sound-grp',
      layerIndex: 1,
      layerSelectionId: 'sel-s-1',
    });
  });

  it('uses one fenced command path for menu and keyboard height edits', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    await act(async () => {
      await getHook().commitHeightCommand({
        kind: 'layers',
        revision: 1,
        label: 'Set Layer Height',
        updates: [
          {
            groupId: 'sound-grp',
            layerIndex: 0,
            layerSelectionId: 'sel-s-0',
            layerId: 's-0',
            height: 57,
          },
        ],
      });
    });

    expect(mockFlushPatches).toHaveBeenCalledTimes(2);
    expect(mockFlushPatches.mock.invocationCallOrder[0]).toBeLessThan(
      mockApplyPatch.mock.invocationCallOrder[0],
    );
    expect(mockApplyPatch).toHaveBeenCalledWith(
      {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [
            {
              groupId: 'sound-grp',
              layerIndex: 0,
              layerSelectionId: 'sel-s-0',
              height: 57,
            },
          ],
        },
      },
      {
        label: 'Set Layer Height',
        phase: 'single',
        expectedRevision: 1,
        operationId: expect.any(String),
      },
    );
  });

  it('refreshes instead of enqueueing a stale fenced command', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });
    useProjectStore.setState({ getProjectDocumentRevision: () => 2 });

    await act(async () => {
      await getHook().commitHeightCommand({
        kind: 'layers',
        revision: 1,
        label: 'Set Layer Height',
        updates: [
          {
            groupId: 'sound-grp',
            layerIndex: 0,
            layerSelectionId: 'sel-s-0',
            height: 57,
          },
        ],
      });
    });

    expect(mockApplyPatch).not.toHaveBeenCalled();
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1);
  });

  it('forwards an absolute command owner document and rejects a host switch', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups, hostDocument: document });
    const popoutDocument = document.implementation.createHTMLDocument('popout');

    await act(async () => {
      await getHook().commitAbsoluteHeight({
        targets: [
          {
            groupId: 'sound-grp',
            layerIndex: 0,
            layerSelectionId: 'sel-s-0',
            layerId: 's-0',
          },
        ],
        height: 57,
        label: 'Resize Layer',
        hostDocument: popoutDocument,
      });
    });

    expect(mockApplyPatch).not.toHaveBeenCalled();
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1);
  });

  it('fences group-default edits through the same command helper', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    await act(async () => {
      await getHook().commitHeightCommand({
        kind: 'group-default',
        groupId: 'sound-grp',
        defaultHeightIndex: 2,
        revision: 1,
        label: 'Change Default Layer Height',
      });
    });

    expect(mockApplyPatch).toHaveBeenCalledWith(
      {
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId: 'sound-grp',
          defaultHeightIndex: 2,
        },
      },
      {
        label: 'Change Default Layer Height',
        phase: 'single',
        expectedRevision: 1,
        operationId: expect.any(String),
      },
    );
  });

  it('handles single-layer drag arithmetic (+13 from 44 to 57)', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    // Start resize at clientY = 100
    act(() => {
      const res = getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
      expect(res.ok).toBe(true);
    });

    expect(getHook().phase).toBe('previewing');

    // Drag down by 13px (clientY = 113)
    act(() => {
      getHook().updateResize(113);
    });

    // Run rAF
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(getHook().currentDelta).toBe(13);
    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(57);
    expect(getHook().projectedLayerGroups[0].layers[0].height).toBe(57);

    // Commit resize at 113
    await act(async () => {
      await getHook().commitResize(113);
    });

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    expect(mockApplyPatch).toHaveBeenCalledWith(
      {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [
            {
              groupId: 'sound-grp',
              layerIndex: 0,
              layerSelectionId: 'sel-s-0',
              height: 57,
            },
          ],
        },
      },
      {
        label: 'Resize Layer',
        phase: 'single',
        expectedRevision: 1,
        operationId: expect.any(String),
      },
    );
    expect(getHook().phase).toBe('idle');
  });

  it('retains the final projected height and scope while commit acknowledgement is pending', async () => {
    let releaseCommit!: () => void;
    mockApplyPatch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseCommit = resolve;
        }),
    );

    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    let commitPromise: Promise<void> | undefined;
    act(() => {
      commitPromise = getHook().commitResize(113);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getHook().phase).toBe('awaitingCommit');
    expect(getHook().activeTargets).toHaveLength(1);
    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(57);
    expect(getHook().projectedLayerGroups[0].layers[0].height).toBe(57);

    releaseCommit();
    await act(async () => {
      await commitPromise;
    });

    expect(getHook().phase).toBe('idle');
  });

  it('clamps to 22-660 range independently without drift on reversal', async () => {
    const groups = makeTestLayerGroups();
    const visible = flattenVisibleLayers(groups, 'scope-1');
    const selectedKeys = new Set([
      buildSelectionKey('sound-grp', 'sel-s-0'), // 44
      buildSelectionKey('sound-grp', 'sel-s-1'), // 88
    ]);

    const getHook = renderHookHarness({
      layerGroups: groups,
      visibleLayers: visible,
      selectedKeys,
    });

    // Start resize on selection
    act(() => {
      getHook().startResize({
        clientY: 200,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    // Drag up by 100px (clientY = 100) -> both would go below 22, so both clamp to 22
    act(() => {
      getHook().updateResize(100);
    });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(22);
    expect(getHook().projectedHeights.get('sound-grp:1')).toBe(22);

    // Now drag down by +20px relative to start (clientY = 220)
    // Because calculation uses original initialHeight (44 and 88):
    // 44 + 20 = 64
    // 88 + 20 = 108
    // No drift!
    act(() => {
      getHook().updateResize(220);
    });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(64);
    expect(getHook().projectedHeights.get('sound-grp:1')).toBe(108);

    // Commit
    await act(async () => {
      await getHook().commitResize(220);
    });

    expect(mockApplyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          updates: [
            expect.objectContaining({ height: 64 }),
            expect.objectContaining({ height: 108 }),
          ],
        }),
      }),
      expect.objectContaining({ label: 'Resize Selected Layers' }),
    );
  });

  it('recognizes zero-motion / no-op release and returns to idle without commit', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    expect(getHook().phase).toBe('previewing');

    // Release at original clientY = 100
    await act(async () => {
      await getHook().commitResize(100);
    });

    expect(mockApplyPatch).not.toHaveBeenCalled();
    expect(getHook().phase).toBe('idle');
  });

  it('restores an out-of-range legacy height at zero delta without committing', async () => {
    const groups = makeTestLayerGroups().map((group, groupIndex) =>
      groupIndex === 0
        ? {
            ...group,
            layers: group.layers.map((layer, layerIndex) =>
              layerIndex === 0 ? { ...layer, height: 902 } : layer,
            ),
          }
        : group,
    );
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    act(() => {
      getHook().updateResize(150);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(660);

    act(() => {
      getHook().updateResize(100);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(902);

    await act(async () => {
      await getHook().commitResize(100);
    });

    expect(mockApplyPatch).not.toHaveBeenCalled();
    expect(getHook().phase).toBe('idle');
    expect(getHook().projectedLayerGroups).toBe(groups);
  });

  it('cancels preview on Escape key press and restores original heights', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    act(() => {
      getHook().updateResize(150);
    });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(getHook().phase).toBe('previewing');
    expect(getHook().projectedHeights.get('sound-grp:0')).toBe(94);

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(getHook().phase).toBe('idle');
    expect(getHook().projectedLayerGroups).toBe(groups);
    expect(mockApplyPatch).not.toHaveBeenCalled();
  });

  it('cancels preview on host window blur', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    expect(getHook().phase).toBe('previewing');

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(getHook().phase).toBe('idle');
    expect(getHook().projectedLayerGroups).toBe(groups);
  });

  it('cancels preview when host geometry changes (including app zoom/window resize)', () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });
    expect(getHook().phase).toBe('previewing');

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(getHook().phase).toBe('idle');
    expect(getHook().projectedLayerGroups).toBe(groups);
  });

  it('cancels preview on scroll container scroll event', async () => {
    const scrollDiv = document.createElement('div');
    const scrollContainerRef = { current: scrollDiv };
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups, scrollContainerRef });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    expect(getHook().phase).toBe('previewing');

    act(() => {
      scrollDiv.dispatchEvent(new Event('scroll'));
    });

    expect(getHook().phase).toBe('idle');
  });

  it('cancels preview when history editors settlement runs (e.g. Save / Undo)', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    expect(getHook().phase).toBe('previewing');

    await act(async () => {
      await settleHistoryEditors(document);
    });

    expect(getHook().phase).toBe('idle');
  });

  it('cancels and refreshes canonical snapshot on stale revision', async () => {
    const groups = makeTestLayerGroups();
    const getHook = renderHookHarness({ layerGroups: groups });

    act(() => {
      getHook().startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });

    // Simulate concurrent revision advance
    useProjectStore.setState({
      getProjectDocumentRevision: () => 999,
    });

    await act(async () => {
      await getHook().commitResize(150);
    });

    expect(mockApplyPatch).not.toHaveBeenCalled();
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1);
    expect(getHook().phase).toBe('idle');
  });

  it('refreshes canonical state when the active drag becomes stale before release', async () => {
    const groups = makeTestLayerGroups();
    let hookResult: ReturnType<typeof useLayerHeightResize> | undefined;
    let revision = 1;

    const Harness: React.FC = () => {
      const visibleLayers = flattenVisibleLayers(groups, 'scope-1');
      hookResult = useLayerHeightResize({
        layerGroups: groups,
        scopeGroupId: null,
        projectSessionId: 10,
        projectRevision: revision,
        visibleLayers,
        selectedKeys: new Set(),
      });
      return null;
    };

    act(() => {
      root.render(<Harness />);
    });

    act(() => {
      hookResult!.startResize({
        clientY: 100,
        groupId: 'sound-grp',
        layerIndex: 0,
        layerSelectionId: 'sel-s-0',
      });
    });
    expect(hookResult!.phase).toBe('previewing');

    useProjectStore.setState({ getProjectDocumentRevision: () => 2 });
    revision = 2;
    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(mockRefreshSnapshot).toHaveBeenCalledOnce();
    expect(hookResult!.phase).toBe('idle');
  });
});

describe('LayerHeightResizeHandle Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders with accessible ARIA attributes and data-marker', () => {
    const onStart = vi.fn();

    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          onStartResize={onStart}
        />,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('role')).toBe('separator');
    expect(handle?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle?.getAttribute('aria-label')).toBe('This Layer: resize height for Audio Layer');
    expect(handle?.getAttribute('aria-valuenow')).toBe('44');
    expect(handle?.getAttribute('aria-valuemin')).toBe('22');
    expect(handle?.getAttribute('aria-valuemax')).toBe('660');
    expect(handle?.getAttribute('aria-valuetext')).toBe(
      '44 pixels; This Layer; allowed 22 to 660 pixels',
    );
  });

  it('only advertises selected scope when the clicked row is selected', () => {
    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          isSelected={false}
          selectedCount={3}
          onStartResize={vi.fn()}
        />,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]')!;
    expect(handle.getAttribute('title')).toContain('Resize height for Audio Layer');
    expect(handle.getAttribute('aria-label')).toContain('This Layer');

    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          isSelected
          selectedCount={3}
          onStartResize={vi.fn()}
        />,
      );
    });

    expect(handle.getAttribute('title')).toBe('Resize 3 selected layers');
    expect(handle.getAttribute('aria-label')).toContain('Selected Layers (3)');
  });

  it('handles keyboard navigation with ArrowDown/ArrowUp/Home/End', () => {
    const onKeyboardResize = vi.fn();

    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          onStartResize={vi.fn()}
          onKeyboardResize={onKeyboardResize}
        />,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]') as HTMLDivElement;

    // ArrowDown -> +1
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onKeyboardResize).toHaveBeenLastCalledWith(45, document);

    // Shift+ArrowDown -> +10
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
      );
    });
    expect(onKeyboardResize).toHaveBeenLastCalledWith(54, document);

    // ArrowUp -> -1
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onKeyboardResize).toHaveBeenLastCalledWith(43, document);

    // Home -> 22 (min)
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(onKeyboardResize).toHaveBeenLastCalledWith(22, document);

    // End -> 660 (max)
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(onKeyboardResize).toHaveBeenLastCalledWith(660, document);
  });

  it('keeps the active readout out of each row handle', () => {
    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          isActive={true}
          activeHeight={57}
          selectedCount={1}
          onStartResize={vi.fn()}
        />,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]');
    expect(handle?.textContent).not.toContain('57px');
    expect(handle?.getAttribute('aria-valuenow')).toBe('57');
  });

  it('dispatches contextmenu event on Enter and Space keydown', () => {
    const onContextMenu = vi.fn();
    act(() => {
      root.render(
        <div onContextMenu={onContextMenu}>
          <LayerHeightResizeHandle
            groupId="sound-grp"
            layerIndex={0}
            layerSelectionId="sel-s-0"
            layerName="Audio Layer"
            currentHeight={44}
            onStartResize={vi.fn()}
            onKeyboardResize={vi.fn()}
          />
        </div>,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]')!;

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onContextMenu).toHaveBeenCalledTimes(1);

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(onContextMenu).toHaveBeenCalledTimes(2);
  });

  it('cancels on unexpected lost pointer capture but ignores deliberate release', () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <LayerHeightResizeHandle
          groupId="sound-grp"
          layerIndex={0}
          layerSelectionId="sel-s-0"
          layerName="Audio Layer"
          currentHeight={44}
          onStartResize={vi.fn()}
          onCommitResize={onCommit}
          onCancelResize={onCancel}
        />,
      );
    });

    const handle = container.querySelector('[data-layer-resize-handle="true"]')!;
    act(() => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100 }),
      );
    });
    act(() => {
      handle.dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    act(() => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100 }),
      );
    });
    act(() => {
      handle.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, clientY: 110, button: 0 }),
      );
      handle.dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
