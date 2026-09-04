// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
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

function seedProjectWithAllLayerTypes(): void {
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

describe('Score layer selection visual and accessible state (US1)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
    useMidiRoutingStore.getState().clearFocusForProjectSession();
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
    useMidiRoutingStore.getState().clearFocusForProjectSession();
  });

  it('applies common selected styling and aria-selected to SoundObject, Track, and Pattern headers', () => {
    seedProjectWithAllLayerTypes();
    act(() => {
      root.render(<ScorePanel />);
    });

    const headers = container.querySelectorAll<HTMLElement>('[data-score-layer-header]');
    expect(headers.length).toBeGreaterThanOrEqual(5);

    const soundHeader0 = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    expect(soundHeader0).toBeTruthy();
    expect(soundHeader0.getAttribute('aria-selected')).toBe('false');
    expect(soundHeader0.className).not.toContain('bg-app-selection');

    // Click Sound 1 header to select it
    act(() => {
      soundHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(soundHeader0.getAttribute('aria-selected')).toBe('true');
    expect(soundHeader0.className).toContain('border-l-app-accent');
    expect(soundHeader0.className).toContain('bg-app-selection');
    const label = soundHeader0.querySelector('span');
    expect(label?.className).toContain('text-app-text-strong');
    expect(label?.className).not.toContain('font-semibold');

    // Click Track 1 header to select it (replaces single selection)
    const trackHeader0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;
    expect(trackHeader0).toBeTruthy();
    act(() => {
      trackHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(soundHeader0.getAttribute('aria-selected')).toBe('false');
    expect(soundHeader0.className).not.toContain('bg-app-selection');
    expect(trackHeader0.getAttribute('aria-selected')).toBe('true');
    expect(trackHeader0.className).toContain('border-l-app-accent');
    expect(trackHeader0.className).toContain('bg-app-selection');
  });

  it('keeps Track MIDI-focus visual state separate from layer selection', () => {
    seedProjectWithAllLayerTypes();
    act(() => {
      root.render(<ScorePanel />);
    });

    const trackHeader0 = container.querySelector<HTMLElement>('[data-layer-id="track-layer-0"]')!;
    expect(trackHeader0).toBeTruthy();

    // Focus Track for MIDI routing without layer selecting it
    act(() => {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId: 1,
        rootGroupId: 'track-group',
        trackId: 'track-layer-0',
        displayName: 'Track 1',
      });
    });

    expect(trackHeader0.getAttribute('data-midi-focused')).toBe('true');
    expect(trackHeader0.getAttribute('aria-selected')).toBe('false');
    expect(trackHeader0.className).not.toContain('bg-app-selection');
  });
});
