// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { getFollowScrollTarget } from '../components/workbench/panels/score/follow-playback';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useWorkbenchStore } from '../stores/workbench-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { ProgramSettingsSaveResult } from '../../shared/program-settings';

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

// ─── ScorePanel harness (T002) ────────────────────────────────────────────────

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

interface PanelGeometry {
  clientWidth?: number;
  scrollWidth?: number;
}

/**
 * jsdom performs no layout, so clientWidth/scrollWidth stay 0. Override them
 * per element instance to give the follow decision real viewport geometry.
 */
function setScrollGeometry(el: HTMLElement, geometry: PanelGeometry): void {
  const { clientWidth = 1000, scrollWidth = 10000 } = geometry;
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth });
}

interface ScoreSurface {
  body: HTMLDivElement;
  header: HTMLDivElement;
}

function getScoreSurface(container: HTMLElement, geometry?: PanelGeometry): ScoreSurface {
  const body = container.querySelector('.score-timeline-scroll') as HTMLDivElement;
  const header = container.querySelector('[data-score-timeline-header]') as HTMLDivElement;
  expect(body).toBeTruthy();
  expect(header).toBeTruthy();
  if (geometry) {
    setScrollGeometry(body, geometry);
    setScrollGeometry(header, geometry);
  }
  return { body, header };
}

const SAMPLE_RATE = 44100;

function elapsedFrames(elapsedSeconds: number): number {
  return Math.round(elapsedSeconds * SAMPLE_RATE);
}

/**
 * Seed an active playback clock. The empty project transport maps seconds to
 * beats 1:1 (tempo 60) and zoom 0 maps beats to pixels at 100px/beat, so
 * `elapsedSeconds * 100` is the playhead pixel.
 */
function seedPlayingClock(elapsedSeconds: number): void {
  const frames = elapsedFrames(elapsedSeconds);
  usePlaybackStore.setState({
    isPlaying: true,
    status: 'playing',
    followPlayback: true,
    clock: {
      sessionId: 1,
      sampleFrames: frames,
      sequence: 1,
      sampleRate: SAMPLE_RATE,
      ksmps: 10,
      receivedAtMs: Date.now(),
    },
    display: {
      sampleFrames: frames,
      elapsedSeconds,
      source: 'engine-authority',
    },
  });
}

function advancePlayhead(elapsedSeconds: number): void {
  const clock = usePlaybackStore.getState().clock;
  const frames = elapsedFrames(elapsedSeconds);
  usePlaybackStore.setState({
    clock: clock
      ? { ...clock, sampleFrames: frames, receivedAtMs: Date.now() }
      : {
          sessionId: 1,
          sampleFrames: frames,
          sequence: 1,
          sampleRate: SAMPLE_RATE,
          ksmps: 10,
          receivedAtMs: Date.now(),
        },
    display: {
      sampleFrames: frames,
      elapsedSeconds,
      source: 'engine-authority',
    },
  });
}

function seedStoppedClock(): void {
  usePlaybackStore.setState({
    isPlaying: false,
    status: 'stopped',
    clock: null,
  });
  usePlaybackStore.setState({
    display: {
      sampleFrames: 0,
      elapsedSeconds: 0,
      source: 'idle-anchor',
    },
  });
}

let syncFollowPlaybackState: ReturnType<typeof vi.fn>;
let updatePlaybackPreferences: ReturnType<typeof vi.fn>;

function okSettingsResult(): ProgramSettingsSaveResult {
  const snapshot = usePlaybackStore.getState();
  return {
    ok: true,
    snapshot: {
      schemaVersion: 1,
      general: {} as any,
      playback: {
        followPlayback: snapshot.followPlayback,
        followPlaybackOnStart: snapshot.followPlaybackOnStart,
        playbackLatencyCorrection: 0,
      },
    } as any,
  };
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

function cleanupPanel({ container, root }: { container: HTMLDivElement; root: Root }): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  useLayerSelectionStore.getState().clear();
  usePlaybackStore.getState().reset();
  usePlaybackStore.setState({
    followPlayback: true,
    savedFollowPlayback: true,
    followPlaybackOnStart: true,
  });
  mockResetSession.mockClear();
  mockScorePathState.session = {
    activeGroupId: null,
    segments: [{ groupId: null, label: 'Root' }],
    scrollByGroupId: {},
  } as any;
  syncFollowPlaybackState = vi.fn();
  updatePlaybackPreferences = vi.fn().mockImplementation(() => Promise.resolve(okSettingsResult()));
  (window as any).blueAPI = {
    commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 1 }),
    getNestedPolyObjectSnapshot: vi.fn().mockResolvedValue(null),
    syncFollowPlaybackState,
    updatePlaybackPreferences,
    stopPlayback: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  __testClearPendingPatches();
  useProjectStore.getState().clearProject();
  useLayerSelectionStore.getState().clear();
  usePlaybackStore.getState().reset();
  delete (window as any).blueAPI;
});

// ─── Pure follow decision tests (T011 / US1) ────────────────────────────────

describe('getFollowScrollTarget pure decision', () => {
  const base = {
    isPlaybackActive: true,
    isFollowEnabled: true,
    scrollLeft: 0,
    clientWidth: 1000,
    scrollWidth: 10000,
  };

  it('returns no target while the playhead is inside the visible interval', () => {
    expect(getFollowScrollTarget({ ...base, pointerPixel: 0 })).toBeNull();
    expect(getFollowScrollTarget({ ...base, pointerPixel: 500 })).toBeNull();
    expect(getFollowScrollTarget({ ...base, pointerPixel: 999 })).toBeNull();
    expect(getFollowScrollTarget({ ...base, scrollLeft: 2000, pointerPixel: 2000 })).toBeNull();
  });

  it('jumps to the playhead x-coordinate at or beyond the right edge', () => {
    expect(getFollowScrollTarget({ ...base, pointerPixel: 1000 })).toBe(1000);
    expect(getFollowScrollTarget({ ...base, pointerPixel: 1234 })).toBe(1234);
    expect(getFollowScrollTarget({ ...base, scrollLeft: 2000, pointerPixel: 3500 })).toBe(3500);
  });

  it('catches up backward when the playhead is behind the left edge', () => {
    expect(getFollowScrollTarget({ ...base, scrollLeft: 5000, pointerPixel: 200 })).toBe(200);
  });

  it('clamps the target to the available scroll range', () => {
    expect(getFollowScrollTarget({ ...base, pointerPixel: 20000 })).toBe(9000);
    expect(
      getFollowScrollTarget({
        ...base,
        clientWidth: 1000,
        scrollWidth: 800,
        pointerPixel: 1200,
      }),
    ).toBe(0);
  });

  it('returns no target for invalid geometry', () => {
    expect(getFollowScrollTarget({ ...base, clientWidth: 0, pointerPixel: 500 })).toBeNull();
    expect(getFollowScrollTarget({ ...base, scrollWidth: 0, pointerPixel: 500 })).toBeNull();
    expect(
      getFollowScrollTarget({ ...base, scrollLeft: Number.NaN, pointerPixel: 500 }),
    ).toBeNull();
    expect(
      getFollowScrollTarget({ ...base, scrollLeft: Number.POSITIVE_INFINITY, pointerPixel: 500 }),
    ).toBeNull();
    expect(
      getFollowScrollTarget({ ...base, clientWidth: Number.NaN, pointerPixel: 500 }),
    ).toBeNull();
    expect(
      getFollowScrollTarget({ ...base, clientWidth: -10, scrollWidth: -1, pointerPixel: 500 }),
    ).toBeNull();
  });

  it('returns no target for an invalid pointer', () => {
    expect(getFollowScrollTarget({ ...base, pointerPixel: null })).toBeNull();
    expect(getFollowScrollTarget({ ...base, pointerPixel: Number.NaN })).toBeNull();
    expect(getFollowScrollTarget({ ...base, pointerPixel: Number.POSITIVE_INFINITY })).toBeNull();
    expect(getFollowScrollTarget({ ...base, pointerPixel: -5 })).toBeNull();
  });

  it('returns no target while playback is inactive or follow is disabled', () => {
    expect(
      getFollowScrollTarget({ ...base, isPlaybackActive: false, pointerPixel: 5000 }),
    ).toBeNull();
    expect(
      getFollowScrollTarget({ ...base, isFollowEnabled: false, pointerPixel: 5000 }),
    ).toBeNull();
  });
});

// ─── ScorePanel page-follow tests (T014 / US1) ───────────────────────────────

describe('ScorePanel follow playback page scrolling', () => {
  it('keeps the viewport stationary while the playhead stays visible', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    expect(body.scrollLeft).toBe(0);

    act(() => advancePlayhead(5));
    act(() => advancePlayhead(9.5));
    expect(body.scrollLeft).toBe(0);

    cleanupPanel(rendered);
  });

  it('advances exactly one instant page jump per boundary crossing', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body, header } = getScoreSurface(rendered.container, {
      clientWidth: 1000,
      scrollWidth: 10000,
    });

    act(() => seedPlayingClock(2));
    expect(body.scrollLeft).toBe(0);

    act(() => advancePlayhead(12));
    expect(body.scrollLeft).toBe(1200);
    expect(header.scrollLeft).toBe(1200);

    // Continuing inside the new page must not scroll again.
    act(() => advancePlayhead(12.5));
    act(() => advancePlayhead(15));
    expect(body.scrollLeft).toBe(1200);

    act(() => advancePlayhead(23));
    expect(body.scrollLeft).toBe(2300);
    expect(header.scrollLeft).toBe(2300);

    cleanupPanel(rendered);
  });

  it('catches up immediately when the playhead lands behind the viewport', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => advancePlayhead(60));
    expect(body.scrollLeft).toBe(6000);

    // A seek or loop wrap backward lands the playhead before the left edge.
    act(() => advancePlayhead(3));
    expect(body.scrollLeft).toBe(300);

    cleanupPanel(rendered);
  });

  it('clamps the page target to the available scroll range', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => advancePlayhead(200));
    expect(body.scrollLeft).toBe(9000);

    cleanupPanel(rendered);
  });

  it('preserves the vertical scroll position on automatic advances', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => {
      body.scrollTop = 137;
    });
    act(() => advancePlayhead(12));

    expect(body.scrollLeft).toBe(1200);
    expect(body.scrollTop).toBe(137);

    cleanupPanel(rendered);
  });

  it('does not follow while playback is stopped', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => advancePlayhead(12));
    expect(body.scrollLeft).toBe(1200);

    act(() => {
      body.scrollLeft = 0;
      body.dispatchEvent(new Event('scroll'));
    });
    act(() => seedStoppedClock());
    act(() => {
      usePlaybackStore.setState({
        display: { sampleFrames: 2000000, elapsedSeconds: 20, source: 'engine-authority' },
      });
    });

    expect(usePlaybackStore.getState().isPlaying).toBe(false);
    expect(body.scrollLeft).toBe(0);

    cleanupPanel(rendered);
  });

  it('does not follow outside the root timeline', () => {
    seedLoadedProject();
    mockScorePathState.session = {
      activeGroupId: 'nested-group',
      segments: [
        { groupId: null, label: 'Root' },
        {
          groupId: 'nested-group',
          label: 'Nested',
          location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
        },
      ],
      scrollByGroupId: {},
    } as any;

    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => advancePlayhead(20));
    expect(body.scrollLeft).toBe(0);

    cleanupPanel(rendered);
  });
});

// ─── ScorePanel navigation provenance tests (T015/T020 / US2) ───────────────

describe('ScorePanel manual navigation suspends follow', () => {
  it('suspends follow on unmatched body horizontal scroll and never snaps back', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    // Establish a scroll baseline, then navigate horizontally.
    act(() => body.dispatchEvent(new Event('scroll')));
    act(() => {
      body.scrollLeft = 400;
      body.dispatchEvent(new Event('scroll'));
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(syncFollowPlaybackState).toHaveBeenCalledWith(false);

    // Later clock updates must not reclaim the user's position.
    act(() => advancePlayhead(20));
    act(() => advancePlayhead(25));
    expect(body.scrollLeft).toBe(400);
    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    cleanupPanel(rendered);
  });

  it('suspends follow on unmatched header horizontal scroll', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { header } = getScoreSurface(rendered.container, {
      clientWidth: 1000,
      scrollWidth: 10000,
    });

    act(() => seedPlayingClock(2));
    act(() => header.dispatchEvent(new Event('scroll')));
    act(() => {
      header.scrollLeft = 700;
      header.dispatchEvent(new Event('scroll'));
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(syncFollowPlaybackState).toHaveBeenCalledWith(false);

    cleanupPanel(rendered);
  });

  it('does not suspend on vertical-only scrolling', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => body.dispatchEvent(new Event('scroll')));
    act(() => {
      body.scrollTop = 80;
      body.dispatchEvent(new Event('scroll'));
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    cleanupPanel(rendered);
  });

  it('does not self-suspend on an automatic follow page jump', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => advancePlayhead(12));
    expect(body.scrollLeft).toBe(1200);

    // The scroll event induced by the automatic jump must be consumed.
    act(() => body.dispatchEvent(new Event('scroll')));
    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    // Continuing to the next boundary still follows.
    act(() => advancePlayhead(23));
    expect(body.scrollLeft).toBe(2300);
    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    cleanupPanel(rendered);
  });

  it('does not suspend on cursor-anchored zoom (view-scale origin)', async () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    // jsdom reports an empty platform; force the macOS branch so Ctrl+wheel
    // takes the pinch-zoom path instead of the layer-height path.
    const platformDescriptor = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'MacIntel' });

    act(() => seedPlayingClock(2));
    await act(async () => {
      body.dispatchEvent(
        new WheelEvent('wheel', {
          ctrlKey: true,
          deltaY: -15,
          clientX: 300,
          clientY: 10,
          bubbles: true,
          cancelable: true,
        }),
      );
      // The zoom path queues an updateTimeState patch; flush it inside this
      // test so its commit cannot leak into a later one.
      await useProjectStore.getState().flushPendingPatches();
    });

    if (platformDescriptor) {
      Object.defineProperty(navigator, 'platform', platformDescriptor);
    }

    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    cleanupPanel(rendered);
  });

  it('suspends follow on Shift+wheel horizontal navigation', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => {
      body.dispatchEvent(
        new WheelEvent('wheel', { shiftKey: true, deltaY: 200, bubbles: true, cancelable: true }),
      );
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    cleanupPanel(rendered);
  });

  it('suspends follow on time-ruler navigation', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { header } = getScoreSurface(rendered.container, {
      clientWidth: 1000,
      scrollWidth: 10000,
    });
    const ruler = header.querySelector('[data-score-time-ruler="primary"]') as HTMLElement;
    expect(ruler).toBeTruthy();

    act(() => seedPlayingClock(2));
    act(() => {
      ruler.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 300,
          clientY: 10,
        }),
      );
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(syncFollowPlaybackState).toHaveBeenCalledWith(false);

    cleanupPanel(rendered);
  });

  it('suspends follow on marker navigation during playback and keeps alignment', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body, header } = getScoreSurface(rendered.container, {
      clientWidth: 1000,
      scrollWidth: 10000,
    });

    act(() => seedPlayingClock(2));
    act(() => {
      useProjectStore.getState().setScrollToBeatTarget(50);
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(body.scrollLeft).toBe(4875);
    expect(header.scrollLeft).toBe(body.scrollLeft);

    cleanupPanel(rendered);
  });

  it('leaves follow unchanged for navigation while playback is stopped', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedStoppedClock());
    act(() => body.dispatchEvent(new Event('scroll')));
    act(() => {
      body.scrollLeft = 400;
      body.dispatchEvent(new Event('scroll'));
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(syncFollowPlaybackState).not.toHaveBeenCalledWith(false);

    cleanupPanel(rendered);
  });
});

// ─── Explicit re-engagement tests (T028 / US3) ──────────────────────────────

describe('ScorePanel explicit follow re-engagement catches up', () => {
  it('catches up to the current playhead after toolbar/menu/F re-enable', () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    // Suspend by navigating away, then keep playing.
    act(() => {
      body.scrollLeft = 300;
      body.dispatchEvent(new Event('scroll'));
    });
    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    act(() => advancePlayhead(40));
    expect(body.scrollLeft).toBe(300);

    // The toolbar, native menu, and F shortcut all route through the same
    // explicit store action; re-enabling must catch up immediately.
    act(() => {
      usePlaybackStore.getState().setFollowPlaybackEnabled(true);
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(body.scrollLeft).toBe(4000);

    // Page following resumes without another user action.
    act(() => advancePlayhead(41));
    expect(body.scrollLeft).toBe(4000);
    act(() => advancePlayhead(52));
    expect(body.scrollLeft).toBe(5200);

    cleanupPanel(rendered);
  });

  it('re-enables follow from a resolved native-menu command without a second write', async () => {
    seedLoadedProject();
    const rendered = renderPanel();
    const { body } = getScoreSurface(rendered.container, { clientWidth: 1000, scrollWidth: 10000 });

    act(() => seedPlayingClock(2));
    act(() => {
      body.scrollLeft = 300;
      body.dispatchEvent(new Event('scroll'));
    });
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    act(() => advancePlayhead(20));
    updatePlaybackPreferences.mockClear();

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({
        type: 'set-follow-playback',
        enabled: true,
      } as never);
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(updatePlaybackPreferences).not.toHaveBeenCalled();
    expect(body.scrollLeft).toBe(2000);

    cleanupPanel(rendered);
  });
});

// ─── F keyboard shortcut tests (T021 / US3) ─────────────────────────────────

function ShortcutProbe(): React.ReactElement {
  useKeyboardShortcuts();
  return <div>probe</div>;
}

function renderProbe(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ShortcutProbe />);
  });
  return { container, root };
}

function pressKey(init: KeyboardEventInit & { code?: string; key?: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyF',
    key: 'f',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('F shortcut toggles follow playback', () => {
  it('toggles follow on unmodified F while a project is loaded', () => {
    seedLoadedProject();
    usePlaybackStore.setState({ savedFollowPlayback: true, followPlayback: true });
    const rendered = renderProbe();

    const event = pressKey({});
    expect(event.defaultPrevented).toBe(true);
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(updatePlaybackPreferences).toHaveBeenCalledWith({ followPlayback: false });

    cleanupPanel(rendered);
  });

  it('ignores F with modifier keys', () => {
    seedLoadedProject();
    const rendered = renderProbe();

    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
      { shiftKey: true },
    ]) {
      const event = pressKey(init);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(updatePlaybackPreferences).not.toHaveBeenCalled();

    cleanupPanel(rendered);
  });

  it('ignores repeated F keydown events from key auto-repeat', () => {
    seedLoadedProject();
    const rendered = renderProbe();

    pressKey({});
    pressKey({ repeat: true });
    pressKey({ repeat: true });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(updatePlaybackPreferences).toHaveBeenCalledTimes(1);
    expect(updatePlaybackPreferences).toHaveBeenCalledWith({ followPlayback: false });

    cleanupPanel(rendered);
  });

  it('ignores F when no project is loaded', () => {
    const rendered = renderProbe();

    const event = pressKey({});
    expect(event.defaultPrevented).toBe(false);
    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(updatePlaybackPreferences).not.toHaveBeenCalled();

    cleanupPanel(rendered);
  });

  it('does not toggle or intercept F from editing surfaces', () => {
    seedLoadedProject();
    const rendered = renderProbe();

    // Dispatch from real elements so the event reaches the window listener
    // through propagation with the editing surface as its target.
    const dispatchFrom = (el: HTMLElement): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyF',
        key: 'f',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        el.dispatchEvent(event);
      });
      return event;
    };

    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      rendered.container.appendChild(el);
      expect(dispatchFrom(el).defaultPrevented).toBe(false);
      el.remove();
    }

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    rendered.container.appendChild(editable);
    expect(dispatchFrom(editable).defaultPrevented).toBe(false);

    const codeEditor = document.createElement('div');
    codeEditor.className = 'cm-editor';
    rendered.container.appendChild(codeEditor);
    expect(dispatchFrom(codeEditor).defaultPrevented).toBe(false);

    const contextMenu = document.createElement('div');
    contextMenu.className = 'workbench-context-menu';
    rendered.container.appendChild(contextMenu);
    expect(dispatchFrom(contextMenu).defaultPrevented).toBe(false);

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(updatePlaybackPreferences).not.toHaveBeenCalled();

    cleanupPanel(rendered);
  });
});
