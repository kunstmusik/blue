// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

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

function seedProjectWithMultipleGroups(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.score.layerGroups = [
    {
      groupId: 'sound-group',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 2,
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
    {
      groupId: 'pattern-group',
      groupType: 'patterns',
      name: 'Patterns',
      layerCount: 1,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'pattern-layer-0',
          layerSelectionId: 'lsel-pat-0',
          name: 'Pattern 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
          sourceObject: {
            objectId: 'source-1',
            objectType: 'NoteObject',
            name: 'Pattern Source',
            backgroundColor: 0,
            editorTarget: {
              selectionId: 'source-1',
              selectedObjectType: 'NoteObject',
              editorObjectType: 'NoteObject',
              ownerKind: 'timeline',
              displayContext: 'timeline',
            },
            barRenderer: {
              kind: 'generic',
              labelLines: ['Pattern Source'],
              timeBehavior: 'NONE',
              repeatPointBeats: null,
            },
          },
          activeCellIndices: [0],
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

describe('Score layer range selection (US2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
  });

  it('selects a contiguous range within a single layer group on Shift-click', () => {
    seedProjectWithMultipleGroups();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;

    // Click Sound 0
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(sound0.getAttribute('aria-selected')).toBe('true');
    expect(sound1.getAttribute('aria-selected')).toBe('false');

    // Shift-click Sound 1
    act(() => {
      sound1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
    });

    expect(sound0.getAttribute('aria-selected')).toBe('true');
    expect(sound1.getAttribute('aria-selected')).toBe('true');
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(2);
  });

  it('selects a contiguous range across multiple layer groups on Shift-click', () => {
    seedProjectWithMultipleGroups();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const track1 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-1"]')!;

    // Click Sound 0
    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    // Shift-click Track 1 (span Sound 0, Sound 1, Track 0, Track 1)
    act(() => {
      track1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
    });

    const sound1 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-1"]')!;
    const track0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;
    const pat0 = container.querySelector<HTMLElement>('[data-layer-id="pattern-layer-0"]')!;

    expect(sound0.getAttribute('aria-selected')).toBe('true');
    expect(sound1.getAttribute('aria-selected')).toBe('true');
    expect(track0.getAttribute('aria-selected')).toBe('true');
    expect(track1.getAttribute('aria-selected')).toBe('true');
    expect(pat0.getAttribute('aria-selected')).toBe('false');
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(4);
  });

  it('clears range selection and selects single item on unshifted click', () => {
    seedProjectWithMultipleGroups();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const track1 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-1"]')!;
    const pat0 = container.querySelector<HTMLElement>('[data-layer-id="pattern-layer-0"]')!;

    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    act(() => {
      track1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
    });
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(4);

    // Unshifted click on Pattern 0
    act(() => {
      pat0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(1);
    expect(sound0.getAttribute('aria-selected')).toBe('false');
    expect(pat0.getAttribute('aria-selected')).toBe('true');
    expect(useLayerSelectionStore.getState().anchorKey).toBe('pattern-group:lsel-pat-0');
  });

  it('sets clicked layer as anchor when Shift-clicking without prior anchor', () => {
    seedProjectWithMultipleGroups();
    act(() => {
      root.render(<ScorePanel />);
    });

    const track0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;
    expect(useLayerSelectionStore.getState().anchorKey).toBeNull();

    act(() => {
      track0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
    });

    expect(useLayerSelectionStore.getState().anchorKey).toBe('track-group:lsel-track-0');
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(1);
    expect(track0.getAttribute('aria-selected')).toBe('true');
  });

  it('clears layer selection when the score timeline background is clicked', () => {
    seedProjectWithMultipleGroups();
    act(() => {
      root.render(<ScorePanel />);
    });

    const sound0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const timeline = container.querySelector<HTMLElement>('.score-timeline-scroll')!;

    act(() => {
      sound0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(1);

    act(() => {
      timeline.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(useLayerSelectionStore.getState().selectedKeys.size).toBe(0);
  });
});
