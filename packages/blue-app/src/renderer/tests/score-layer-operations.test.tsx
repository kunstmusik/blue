// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { getLayerOperationAvailability } from '../components/workbench/panels/score/layer-selection-utils';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

const { mockScorePathState } = vi.hoisted(() => ({
  mockScorePathState: {
    session: {
      activeGroupId: null,
      segments: [{ groupId: null, label: 'Root' }],
      scrollByGroupId: {},
    } as any,
    scrollContainerRef: { current: null },
    navigateToGroup: vi.fn(),
    navigateToRoot: vi.fn(),
    navigateToSegment: vi.fn(),
    resetSession: vi.fn(),
  },
}));

vi.mock('../components/workbench/panels/score/useScorePathState', () => ({
  useScorePathState: () => mockScorePathState,
}));

function seedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.score.layerGroups = [
    {
      groupId: 'sound-group',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 3,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'sound-layer-0',
          layerSelectionId: 'lsel-sound-0',
          name: 'Sound 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
        {
          layerId: 'sound-layer-1',
          layerSelectionId: 'lsel-sound-1',
          name: 'Sound 2',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
        {
          layerId: 'sound-layer-2',
          layerSelectionId: 'lsel-sound-2',
          name: 'Sound 3',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
      ],
    },
    {
      groupId: 'track-group',
      groupType: 'track',
      name: 'Tracks',
      layerCount: 2,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'track-layer-0',
          layerSelectionId: 'lsel-track-0',
          name: 'Track 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
        {
          layerId: 'track-layer-1',
          layerSelectionId: 'lsel-track-1',
          name: 'Track 2',
          height: 44,
          muted: false,
          solo: false,
          items: [],
        },
      ],
    },
  ];

  useProjectStore.getState().setProjectInfo({
    title: 'Test Project',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/path/to/test.blue',
    sessionId: 1,
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: { ...snapshot.orchestra, loaded: true },
    projectProperties: snapshot.projectProperties,
    transport: snapshot.transport,
    score: snapshot.score,
  });
}

describe('Score layer operations (US3)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    confirmSpy.mockRestore();
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
  });

  async function openContextMenu(header: HTMLElement): Promise<void> {
    await act(async () => {
      header.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
      await Promise.resolve();
    });
  }

  function findMenuItem(label: string): HTMLElement | undefined {
    return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (item) => item.textContent?.trim() === label,
    );
  }

  it('pushes selected layer range up and down with Alt+ArrowUp and Alt+ArrowDown', async () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const sound2 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-2"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;

    // Select Sound 1 and extend to Sound 2 (range [1, 2])
    act(() => {
      sound1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      sound2.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(2);

    // Push Up with Alt+ArrowUp -> move [1, 2] to 0 -> layers become Sound 2, Sound 3, Sound 1
    act(() => {
      headersList.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
      );
    });

    const group = useProjectStore.getState().score.layerGroups[0]!;
    expect(group.layers.map((l) => l.name)).toEqual(['Sound 2', 'Sound 3', 'Sound 1']);

    // Push Down with Alt+ArrowDown -> move [0, 1] to 1 -> layers become Sound 1, Sound 2, Sound 3
    act(() => {
      headersList.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
    });

    const groupAfterDown = useProjectStore.getState().score.layerGroups[0]!;
    expect(groupAfterDown.layers.map((l) => l.name)).toEqual(['Sound 1', 'Sound 2', 'Sound 3']);
  });

  it('removes selected layers on Delete key after confirmation', async () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;

    // Select Sound 0 and Sound 1
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      sound1.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });

    // Press Delete key
    act(() => {
      headersList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-layer-removal-dialog]')).toBeTruthy();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-confirm]')!.click();
    });

    const group = useProjectStore.getState().score.layerGroups[0]!;
    expect(group.layers.map((l) => l.name)).toEqual(['Sound 3']);
  });

  it('cancels layer removal if confirmation is rejected', async () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;

    // Select Sound 0 and Sound 1
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      sound1.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });

    // Press Delete key
    act(() => {
      headersList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-layer-removal-dialog]')).toBeTruthy();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-cancel]')!.click();
    });

    const group = useProjectStore.getState().score.layerGroups[0]!;
    expect(group.layers.map((l) => l.name)).toEqual(['Sound 1', 'Sound 2', 'Sound 3']);
  });

  it('keeps the full selection for an inside context action and targets one outside row', async () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const track0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;

    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      sound1.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(2);

    await openContextMenu(sound1);
    expect(findMenuItem('Remove 2 Layers')).toBeTruthy();
    act(() => {
      findMenuItem('Remove 2 Layers')?.click();
    });
    expect(container.querySelector('[data-layer-removal-dialog]')?.textContent).toContain(
      'Delete 2 layers?',
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-cancel]')?.click();
    });

    await openContextMenu(track0);
    expect(useLayerSelectionStore.getState().selectedKeys).toEqual(
      new Set(['track-group:lsel-track-0']),
    );
    expect(findMenuItem('Remove Layer')).toBeTruthy();
    act(() => {
      findMenuItem('Remove Layer')?.click();
    });
    expect(container.querySelector('[data-layer-removal-dialog]')?.textContent).toContain(
      'Delete 1 layer?',
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-cancel]')?.click();
    });
  });

  it('confirms removal even when one layer is selected', () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      headersList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-layer-removal-dialog]')).toBeTruthy();
    expect(container.querySelector('[data-delete-empty-layer-groups]')).toBeNull();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-confirm]')!.click();
    });

    expect(
      useProjectStore.getState().score.layerGroups[0]!.layers.map((layer) => layer.name),
    ).toEqual(['Sound 2', 'Sound 3']);
  });

  it('does not open removal when Delete or Backspace is pressed in a layer-name field', () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      sound0.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, button: 0 }));
    });

    const input = sound0.querySelector<HTMLInputElement>('input');
    expect(input).toBeTruthy();

    for (const key of ['Delete', 'Backspace']) {
      act(() => {
        input?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
      expect(container.querySelector('[data-layer-removal-dialog]')).toBeNull();
    }
  });

  it('allows the empty layer group cleanup choice to be turned off', () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const sound2 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-2"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      sound2.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
      headersList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    const cleanupCheckbox = container.querySelector<HTMLInputElement>(
      '[data-delete-empty-layer-groups]',
    )!;
    expect(cleanupCheckbox.checked).toBe(true);
    act(() => {
      cleanupCheckbox.click();
    });
    expect(cleanupCheckbox.checked).toBe(false);
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-layer-removal-confirm]')!.click();
    });

    const remainingGroup = useProjectStore.getState().score.layerGroups[0]!;
    expect(remainingGroup.layers).toHaveLength(0);
    expect(useProjectStore.getState().score.layerGroups).toHaveLength(2);
  });

  it('disables Push Up at top boundary and Push Down at bottom boundary for layer groups', () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    const currentVisibleLayers = [
      {
        scopeKey: 'test',
        groupId: 'sound-group',
        groupType: 'polyObject' as const,
        layerSelectionId: 'lsel-sound-0',
        layerId: 'sound-layer-0',
        localIndex: 0,
        globalIndex: 0,
        layer: useProjectStore.getState().score.layerGroups[0]!.layers[0]!,
      },
    ];

    const ranges = useLayerSelectionStore.getState().getSelectedRanges(currentVisibleLayers);
    const availability = getLayerOperationAvailability(
      useProjectStore.getState().score.layerGroups,
      ranges,
    );

    expect(availability.canPushUp).toBe(false);
    expect(availability.pushUpDisabledReason).toBe('at-group-start');
    expect(availability.canPushDown).toBe(true);
    expect(availability.canAdd).toBe(true);
  });

  it('disables Push Up and Push Down when selection spans mixed layer groups', () => {
    seedProject();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound2 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-2"]')!;
    const track0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;

    act(() => {
      sound2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      track0.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });

    const currentVisibleLayers = [
      {
        scopeKey: 'test',
        groupId: 'sound-group',
        groupType: 'polyObject' as const,
        layerSelectionId: 'lsel-sound-2',
        layerId: 'sound-layer-2',
        localIndex: 2,
        globalIndex: 2,
        layer: useProjectStore.getState().score.layerGroups[0]!.layers[2]!,
      },
      {
        scopeKey: 'test',
        groupId: 'track-group',
        groupType: 'track' as const,
        layerSelectionId: 'lsel-track-0',
        layerId: 'track-layer-0',
        localIndex: 0,
        globalIndex: 3,
        layer: useProjectStore.getState().score.layerGroups[1]!.layers[0]!,
      },
    ];

    const ranges = useLayerSelectionStore.getState().getSelectedRanges(currentVisibleLayers);
    const availability = getLayerOperationAvailability(
      useProjectStore.getState().score.layerGroups,
      ranges,
    );

    expect(availability.canPushUp).toBe(false);
    expect(availability.pushUpDisabledReason).toBe('selection-spans-groups');
    expect(availability.canPushDown).toBe(false);
    expect(availability.pushDownDisabledReason).toBe('selection-spans-groups');
    expect(availability.canAdd).toBe(false);
  });

  it('pushes up multiple selected layers 2, 3, 4 (indices 1..3) in a 4-layer group so they become 1, 2, 3 and former 1 becomes 4', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 4,
        isOpenableContainer: true,
        layers: [
          {
            layerId: 'sound-layer-0',
            layerSelectionId: 'lsel-sound-0',
            name: 'Sound 1',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
          {
            layerId: 'sound-layer-1',
            layerSelectionId: 'lsel-sound-1',
            name: 'Sound 2',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
          {
            layerId: 'sound-layer-2',
            layerSelectionId: 'lsel-sound-2',
            name: 'Sound 3',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
          {
            layerId: 'sound-layer-3',
            layerSelectionId: 'lsel-sound-3',
            name: 'Sound 4',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
        ],
      },
    ];
    useProjectStore.getState().setProjectInfo({
      title: 'Test Project',
      author: 'Test Author',
      sampleRate: '44100',
      version: '2.10.0',
      filePath: '/path/to/test.blue',
      sessionId: 1,
      loaded: true,
      globalOrc: snapshot.globalOrc,
      globalSco: snapshot.globalSco,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
      score: snapshot.score,
    });

    act(() => {
      root.render(<ScorePanel />);
    });

    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const sound3 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-3"]')!;
    const headersList = container.querySelector<HTMLElement>('[data-layer-headers-list]')!;

    // Select Sound 2 (index 1) and Shift-click Sound 4 (index 3) to select layers 2, 3, 4
    act(() => {
      sound1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      sound3.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });

    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(3);
    const visibleRefs = [0, 1, 2, 3].map((i) => ({
      scopeKey: 'test',
      groupId: 'sound-group',
      groupType: 'polyObject' as const,
      layerSelectionId: `lsel-sound-${i}`,
      layerId: `sound-layer-${i}`,
      localIndex: i,
      globalIndex: i,
      layer: useProjectStore.getState().score.layerGroups[0]!.layers[i]!,
    }));
    const ranges = useLayerSelectionStore.getState().getSelectedRanges(visibleRefs);
    expect(ranges).toEqual([
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        startIndex: 1,
        endIndex: 3,
        layerSelectionIds: ['lsel-sound-1', 'lsel-sound-2', 'lsel-sound-3'],
        count: 3,
      },
    ]);

    // Push Up with Alt+ArrowUp
    act(() => {
      headersList.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
      );
    });

    const group = useProjectStore.getState().score.layerGroups[0]!;
    // All 3 selected layers move up to 0, 1, 2; Layer 1 moves to index 3
    expect(group.layers.map((l) => l.name)).toEqual(['Sound 2', 'Sound 3', 'Sound 4', 'Sound 1']);

    // Selection follows the moved layers
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(3);
    expect(useLayerSelectionStore.getState().selectedKeys).toEqual(
      new Set(['sound-group:lsel-sound-1', 'sound-group:lsel-sound-2', 'sound-group:lsel-sound-3']),
    );

    // Now push down with Alt+ArrowDown
    act(() => {
      headersList.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
    });

    const groupAfterDown = useProjectStore.getState().score.layerGroups[0]!;
    expect(groupAfterDown.layers.map((l) => l.name)).toEqual([
      'Sound 1',
      'Sound 2',
      'Sound 3',
      'Sound 4',
    ]);
  });
});
