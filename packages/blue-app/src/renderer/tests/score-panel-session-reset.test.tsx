// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

const { mockResetSession, mockScorePathState } = vi.hoisted(() => {
  const mockResetSession = vi.fn();

  return {
    mockResetSession,
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
      resetSession: mockResetSession,
    },
  };
});

vi.mock('../components/workbench/panels/score/useScorePathState', () => ({
  useScorePathState: () => mockScorePathState,
}));

function seedLoadedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();

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

function seedProjectWithAudioAndPolyHeaders(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.score.layerGroups = [
    {
      groupId: 'audio-group',
      groupType: 'track',
      name: 'Audio Layer Group',
      layerCount: 1,
      isOpenableContainer: false,
      layers: [
        {
          layerId: 'audio-layer-0',
          name: 'Audio 1',
          height: 88,
          muted: false,
          solo: false,
          items: [],
          automation: {
            layerId: 'audio-layer-0',
            layerKind: 'track',
            parameterIds: [],
            parameters: [],
            targetGroups: [],
            missingParameterIds: [],
          },
        },
      ],
    },
    {
      groupId: 'poly-group',
      groupType: 'polyObject',
      name: 'SoundObject Layer Group',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'poly-layer-0',
          name: 'Sound 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
          automation: {
            layerId: 'poly-layer-0',
            layerKind: 'soundObject',
            parameterIds: [],
            parameters: [],
            targetGroups: [],
            missingParameterIds: [],
          },
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

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ScorePanel />);
  });

  return { container, root };
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  mockResetSession.mockClear();
  mockScorePathState.session = {
    activeGroupId: null,
    segments: [{ groupId: null, label: 'Root' }],
    scrollByGroupId: {},
  } as any;
  (window as any).blueAPI = {
    commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 1 }),
    getNestedPolyObjectSnapshot: vi.fn().mockResolvedValue(null),
  };
});

afterEach(() => {
  __testClearPendingPatches();
  useProjectStore.getState().clearProject();
  usePlaybackStore.getState().reset();
  delete (window as any).blueAPI;
});

describe('ScorePanel session resets', () => {
  it('stops an active audition on a score-timeline press', () => {
    seedLoadedProject();
    const stopAuditioning = vi.fn().mockResolvedValue(undefined);
    usePlaybackStore.setState({
      isAuditioning: true,
      stopAuditioning,
    } as Partial<ReturnType<typeof usePlaybackStore.getState>>);

    const { container, root } = renderPanel();
    const timeline = container.querySelector('.score-timeline-scroll') as HTMLDivElement;

    act(() => {
      timeline.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 20,
        clientY: 20,
      }));
    });

    expect(stopAuditioning).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps header, timeline, and overlay horizontal offsets synchronized', () => {
    seedLoadedProject();

    const { container, root } = renderPanel();
    const header = container.querySelector('[data-score-timeline-header]') as HTMLDivElement;
    const timeline = container.querySelector('.score-timeline-scroll') as HTMLDivElement;
    const overlay = container.querySelector('[data-score-overlay-content]') as HTMLDivElement;

    act(() => {
      header.scrollLeft = 320;
      header.dispatchEvent(new Event('scroll'));
    });

    expect(timeline.scrollLeft).toBe(320);
    expect(overlay.style.transform).toBe('translateX(-320px)');

    act(() => {
      timeline.scrollLeft = 120;
      timeline.dispatchEvent(new Event('scroll'));
    });

    expect(header.scrollLeft).toBe(120);
    expect(overlay.style.transform).toBe('translateX(-120px)');

    act(() => {
      useProjectStore.getState().setScrollToBeatTarget(10);
    });

    expect(timeline.scrollLeft).toBeGreaterThan(0);
    expect(header.scrollLeft).toBe(timeline.scrollLeft);
    expect(overlay.style.transform).toBe(`translateX(-${timeline.scrollLeft}px)`);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the navigation session when the score time state changes', async () => {
    seedLoadedProject();

    const { container, root } = renderPanel();

    expect(mockResetSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await useProjectStore.getState().applyProjectDocumentPatch({
        score: {
          type: 'updateTimeState',
          patch: { snapEnabled: false },
        },
      });
    });

    expect(mockResetSession).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('refreshes nested snapshot after score patches while viewing a nested PolyObject', async () => {
    seedLoadedProject();

    const nestedLocation = {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    };
    mockScorePathState.session = {
      activeGroupId: 'nested-group',
      segments: [
        { groupId: null, label: 'Root' },
        { groupId: 'nested-group', label: 'Nested', location: nestedLocation },
      ],
      scrollByGroupId: {},
    } as any;

    const nestedSnapshot = {
      groupId: 'nested-group',
      groupType: 'polyObject',
      name: 'Nested',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'nested-layer-0',
          name: 'Layer 1',
          height: 44,
          items: [],
        },
      ],
    };

    const getNestedPolyObjectSnapshot = vi.fn()
      .mockResolvedValueOnce(nestedSnapshot)
      .mockResolvedValueOnce(nestedSnapshot);

    (window as any).blueAPI = {
      commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 1 }),
      getNestedPolyObjectSnapshot,
    };

    const { container, root } = renderPanel();

    await act(async () => {
      await Promise.resolve();
    });

    expect(getNestedPolyObjectSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      await useProjectStore.getState().applyProjectDocumentPatch({
        score: {
          type: 'addScoreObjects',
          groupId: 'nested-group',
          objects: [
            {
              layerIndex: 0,
              objectType: 'GenericScore',
              name: 'GenericScore',
              startBeats: 0,
              durationBeats: 4,
              backgroundColor: 0xff404040,
            },
          ],
        },
      });
      await Promise.resolve();
    });

    expect(getNestedPolyObjectSnapshot).toHaveBeenCalledTimes(2);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the Track and SoundObject note processor buttons', () => {
    seedProjectWithAudioAndPolyHeaders();

    const { container, root } = renderPanel();

    const noteProcessorButtons = container.querySelectorAll('button[title="Note Processors"]');
    const automationButtons = container.querySelectorAll('button[title="Automation"]');
    const trackInstrumentControl = container.querySelector('[data-track-instrument-control="audio-layer-0"]');

    expect(noteProcessorButtons).toHaveLength(2);
    expect(automationButtons).toHaveLength(2);
    expect(trackInstrumentControl?.parentElement?.firstElementChild).toBe(trackInstrumentControl);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('marks the focused Track header independently from editor state', () => {
    seedProjectWithAudioAndPolyHeaders();
    useMidiRoutingStore.getState().focusTrack({
      projectSessionId: 1,
      rootGroupId: 'audio-group',
      trackId: 'audio-layer-0',
      displayName: 'Audio 1',
    });

    const { container, root } = renderPanel();
    const focusedHeader = container.querySelector('[data-midi-focused="true"]');

    expect(focusedHeader).toBeTruthy();
    expect(focusedHeader?.textContent).toContain('Audio 1');
    expect(focusedHeader?.className).toContain('border-l-app-accent');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('focuses a Track from its header without letting row controls steal focus', () => {
    seedProjectWithAudioAndPolyHeaders();
    const { container, root } = renderPanel();
    const instrumentControl = container.querySelector(
      '[data-track-instrument-control="audio-layer-0"]',
    ) as HTMLElement;
    const trackHeader = instrumentControl.parentElement as HTMLElement;

    act(() => {
      trackHeader.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
      }));
    });
    expect(useMidiRoutingStore.getState().focusedTarget).toMatchObject({
      kind: 'track',
      projectSessionId: 1,
      rootGroupId: 'audio-group',
      trackId: 'audio-layer-0',
      displayName: 'Audio 1',
    });

    act(() => {
      useMidiRoutingStore.getState().clearFocusForProjectSession();
      const muteButton = trackHeader.querySelector('button[title="Mute"]') as HTMLButtonElement;
      muteButton.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
      }));
    });
    expect(useMidiRoutingStore.getState().focusedTarget).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
