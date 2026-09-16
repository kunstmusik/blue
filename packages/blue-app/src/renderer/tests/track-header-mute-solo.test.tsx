// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot, createMixerSnapshot } from '../../shared/project-editor';
import { BlueData, Channel } from '@blue/data';
import { createMockTrackSnapshot } from '../../shared/project-editor-layer-color-test-utils';

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

/**
 * Spec 111 US2: track header M/S buttons address the associated mixer
 * channel under Audio authority, keep independent event-layer state under
 * Event authority, and revert to event semantics when the mixer is bypassed.
 */
describe('Track header mute/solo authority (Spec 111)', () => {
  let host: HTMLDivElement;
  let root: Root;

  function setup(options: {
    mode: 'audio' | 'event';
    mixerEnabled?: boolean;
    withAssociation?: boolean;
  }): ReturnType<typeof vi.fn> {
    useProjectStore.getState().clearProject();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch');
    applyPatchSpy.mockClear();
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'track-group',
        groupType: 'track',
        name: 'Tracks',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          createMockTrackSnapshot({
            layerId: 'track-0',
            name: 'Bass Track',
          }),
        ],
      },
    ];

    const data = new BlueData();
    data.getMixer().setEnabled(options.mixerEnabled ?? true);
    const channel = new Channel();
    channel.setName('Bass Channel');
    if (options.withAssociation ?? true) {
      channel.setAssociation('track-0');
    }
    data.getMixer().getChannels().push(channel);
    const mixer = createMixerSnapshot(data.getMixer());
    if (!(options.mixerEnabled ?? true)) {
      mixer.enabled = false;
    }

    useProjectStore.getState().setProjectInfo({
      title: 'Test Project',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      mixer,
      projectProperties: {
        ...snapshot.projectProperties,
        trackLayerMuteSoloMode: options.mode,
      },
      transport: snapshot.transport,
    } as any);

    act(() => {
      root.render(<ScorePanel />);
    });
    return applyPatchSpy;
  }

  beforeEach(() => {
    host = document.createElement('div');
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
    useProjectStore.getState().clearProject();
  });

  function headerButton(label: string): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>(`button[aria-label*="${label}"]`);
  }

  it('Event mode dispatches the legacy layer-state patch', () => {
    const applyPatchSpy = setup({ mode: 'event' });
    const mute = headerButton('Mute layer Bass Track');
    expect(mute).toBeTruthy();
    act(() => {
      mute!.click();
    });
    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'updateLayerState',
          groupId: 'track-group',
          layerIndex: 0,
          patch: { muted: true },
        }),
      }),
      { label: 'Mute Layer' },
    );
  });

  it('Audio mode dispatches the associated channel patch with a header intent', () => {
    const applyPatchSpy = setup({ mode: 'audio' });
    const mute = headerButton('Mute mixer channel for Bass Track');
    expect(mute).toBeTruthy();
    act(() => {
      mute!.click();
    });
    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mixer: expect.objectContaining({
          type: 'updateChannel',
          patch: { muted: true },
          headerIntent: { expectedMode: 'audio', association: 'track-0' },
        }),
      }),
      { label: 'Mute Channel' },
    );
  });

  it('Mixer bypass forces Event authority even with a saved Audio preference', () => {
    const applyPatchSpy = setup({ mode: 'audio', mixerEnabled: false });
    const mute = headerButton('Mute layer Bass Track');
    expect(mute).toBeTruthy();
    act(() => {
      mute!.click();
    });
    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({ type: 'updateLayerState' }),
      }),
      { label: 'Mute Layer' },
    );
  });

  it('Audio mode without an associated channel reports and dispatches no patch', () => {
    const applyPatchSpy = setup({ mode: 'audio', withAssociation: false });
    const mute = headerButton('Mute (unlinked: no mixer channel for Bass Track)');
    expect(mute).toBeTruthy();
    expect(mute!.hasAttribute('data-audio-unlinked')).toBe(true);
    act(() => {
      mute!.click();
    });
    // No legacy event-layer patch and no mixer patch: the edit is refused.
    const scorePatches = applyPatchSpy.mock.calls.filter(
      (call) => 'score' in (call[0] as object) || 'mixer' in (call[0] as object),
    );
    expect(scorePatches).toEqual([]);
  });
});
