import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel } from '@blue/data';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot, createMixerSnapshot } from '../../shared/project-editor';
import { createMockTrackSnapshot } from '../../shared/project-editor-layer-color-test-utils';

// Spec 111 US2 browser acceptance evidence (T066): track header M/S buttons
// follow the effective Audio/Event authority, keep the two independent flag
// sets separate, report a missing association instead of editing the wrong
// domain, revert to event semantics under mixer bypass, and remain keyboard
// operable with accessible names and pressed state in a real browser.

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('Track header mute/solo authority in the browser (Spec 111 T066)', () => {
  let host: HTMLDivElement;
  let root: Root;

  function setup(options: {
    mode: 'audio' | 'event';
    mixerEnabled?: boolean;
    withAssociation?: boolean;
    renameChannelTo?: string;
    trackEventFlags?: { muted?: boolean; solo?: boolean };
    channelFlags?: { muted?: boolean; solo?: boolean };
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
            muted: options.trackEventFlags?.muted ?? false,
            solo: options.trackEventFlags?.solo ?? false,
          }),
        ],
      },
    ];

    const data = new BlueData();
    data.getMixer().setEnabled(options.mixerEnabled ?? true);
    const channel = new Channel();
    channel.setName(options.renameChannelTo ?? 'Bass Channel');
    if (options.withAssociation ?? true) {
      channel.setAssociation('track-0');
    }
    if (options.channelFlags?.muted) channel.setMuted(true);
    if (options.channelFlags?.solo) channel.setSolo(true);
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

  it('Audio authority edits the mixer channel and leaves event flags untouched', () => {
    const applyPatchSpy = setup({
      mode: 'audio',
      trackEventFlags: { muted: true },
    });

    const solo = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Solo mixer channel for Bass Track"]',
    );
    expect(solo).toBeTruthy();
    expect(solo!.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      solo!.click();
    });

    const mixerCalls = applyPatchSpy.mock.calls.filter((call) => 'mixer' in (call[0] as object));
    expect(mixerCalls).toHaveLength(1);
    expect(mixerCalls[0]![0]).toMatchObject({
      mixer: {
        type: 'updateChannel',
        patch: { solo: true },
        headerIntent: { expectedMode: 'audio', association: 'track-0' },
      },
    });
    // No event-layer patch: the two flag sets stay independent.
    const scoreCalls = applyPatchSpy.mock.calls.filter((call) => 'score' in (call[0] as object));
    expect(scoreCalls).toEqual([]);
  });

  it('renaming the channel keeps the association working', () => {
    const applyPatchSpy = setup({ mode: 'audio', renameChannelTo: 'Renamed Bass' });

    const mute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Mute mixer channel for Bass Track"]',
    );
    expect(mute).toBeTruthy();
    act(() => {
      mute!.click();
    });

    const mixerCalls = applyPatchSpy.mock.calls.filter((call) => 'mixer' in (call[0] as object));
    expect(mixerCalls).toHaveLength(1);
    // The patch targets the stable association, not the display name.
    expect(
      (mixerCalls[0]![0] as { mixer: { headerIntent: { association: string } } }).mixer.headerIntent
        .association,
    ).toBe('track-0');
  });

  it('a missing association reports and edits nothing', () => {
    const applyPatchSpy = setup({ mode: 'audio', withAssociation: false });

    const mute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Mute (unlinked: no mixer channel for Bass Track)"]',
    );
    expect(mute).toBeTruthy();
    expect(mute!.getAttribute('title')).toContain('No mixer channel is associated');

    act(() => {
      mute!.click();
    });
    const projectPatches = applyPatchSpy.mock.calls.filter(
      (call) => 'mixer' in (call[0] as object) || 'score' in (call[0] as object),
    );
    expect(projectPatches).toEqual([]);
  });

  it('mixer bypass forces event authority while the saved preference stays audio', () => {
    const applyPatchSpy = setup({
      mode: 'audio',
      mixerEnabled: false,
      channelFlags: { muted: true },
    });

    const mute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Mute layer Bass Track"]',
    );
    expect(mute).toBeTruthy();
    // Event flags render, not channel flags (the channel is muted but its
    // state must not leak into event-mode headers).
    expect(mute!.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      mute!.click();
    });
    const scoreCalls = applyPatchSpy.mock.calls.filter((call) => 'score' in (call[0] as object));
    expect(scoreCalls).toHaveLength(1);
  });

  it('bypass re-enable restores the saved Audio authority and channel flags', () => {
    setup({
      mode: 'audio',
      mixerEnabled: false,
      channelFlags: { muted: true },
    });

    expect(document.querySelector('button[aria-label="Mute layer Bass Track"]')).not.toBeNull();

    const current = useProjectStore.getState();
    act(() => {
      useProjectStore.getState().setProjectInfo({
        ...current,
        mixer: { ...current.mixer, enabled: true },
      } as any);
    });

    const restored = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Unmute mixer channel for Bass Track"]',
    );
    expect(restored).not.toBeNull();
    expect(restored!.getAttribute('aria-pressed')).toBe('true');
  });

  it('activates a header M/S button through trusted browser keyboard input', async () => {
    const applyPatchSpy = setup({
      mode: 'audio',
      channelFlags: { muted: true, solo: true },
    });

    const mute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Unmute mixer channel for Bass Track"]',
    );
    const solo = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Unsolo mixer channel for Bass Track"]',
    );
    expect(mute!.getAttribute('aria-pressed')).toBe('true');
    expect(solo!.getAttribute('aria-pressed')).toBe('true');

    mute!.focus();
    expect(document.activeElement).toBe(mute);
    const callsBefore = applyPatchSpy.mock.calls.length;
    await act(async () => {
      await userEvent.keyboard('{Enter}');
    });
    expect(document.activeElement).toBe(mute);
    const mixerCalls = applyPatchSpy.mock.calls.filter((call) => 'mixer' in (call[0] as object));
    expect(mixerCalls).toHaveLength(callsBefore + 1);
    expect(mixerCalls.at(-1)?.[0]).toMatchObject({
      mixer: {
        type: 'updateChannel',
        patch: { muted: false },
        headerIntent: { expectedMode: 'audio', association: 'track-0' },
      },
    });
  });

  it('renders and switches the Audio/Event selector while keeping the two flag domains independent', async () => {
    const applyPatchSpy = setup({
      mode: 'audio',
      trackEventFlags: { muted: true },
      channelFlags: { muted: false },
    });

    const settingsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Score settings"]',
    );
    expect(settingsButton).not.toBeNull();
    act(() => {
      settingsButton!.click();
    });

    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-labelledby="score-settings-dialog-title"]',
    );
    expect(dialog).not.toBeNull();
    const audio = dialog!.querySelector('[role="radio"][aria-checked="true"]');
    const event = Array.from(dialog!.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (radio) => radio.textContent === 'Event',
    );
    expect(audio?.textContent).toBe('Audio');
    expect(event).not.toBeNull();

    await act(async () => {
      await userEvent.click(event!);
    });
    const projectPatches = applyPatchSpy.mock.calls.filter(
      (call) => 'projectProperties' in (call[0] as object),
    );
    expect(projectPatches).toHaveLength(1);
    expect(projectPatches[0]?.[0]).toMatchObject({
      projectProperties: { trackLayerMuteSoloMode: 'event' },
    });
    expect(projectPatches[0]?.[1]).toEqual({ label: 'Set Track Header Mode to Event' });
    // Applying the mode publication switches the header authority. The event
    // flags are already true/false in their own domain; no mixer flag is copied.
    expect(document.querySelector('button[aria-label="Unmute layer Bass Track"]')).not.toBeNull();
    const eventSolo = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Solo layer Bass Track"]',
    );
    expect(eventSolo).not.toBeNull();
    expect(eventSolo!.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      await userEvent.click(eventSolo!);
    });
    expect(eventSolo!.getAttribute('aria-pressed')).toBe('true');
    const eventMute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Unmute layer Bass Track"]',
    );
    expect(eventMute).not.toBeNull();
    expect(eventMute!.getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      await userEvent.click(eventMute!);
    });
    expect(eventMute!.getAttribute('aria-pressed')).toBe('false');
    expect(applyPatchSpy.mock.calls.filter((call) => 'mixer' in (call[0] as object))).toEqual([]);
    expect(
      applyPatchSpy.mock.calls
        .filter((call) => 'score' in (call[0] as object))
        .map((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          score: expect.objectContaining({
            patch: { solo: true },
          }),
        }),
        expect.objectContaining({
          score: expect.objectContaining({
            patch: { muted: false },
          }),
        }),
      ]),
    );
    expect(useProjectStore.getState().mixer.channels[0]?.muted).toBe(false);
    expect(useProjectStore.getState().mixer.channels[0]?.solo).toBe(false);

    const audioAgain = Array.from(dialog!.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (radio) => radio.textContent === 'Audio',
    );
    expect(audioAgain).not.toBeNull();
    await act(async () => {
      await userEvent.click(audioAgain!);
    });
    const updatedProjectPatches = applyPatchSpy.mock.calls.filter(
      (call) => 'projectProperties' in (call[0] as object),
    );
    expect(updatedProjectPatches).toHaveLength(2);
    expect(updatedProjectPatches[1]?.[0]).toMatchObject({
      projectProperties: { trackLayerMuteSoloMode: 'audio' },
    });
    const audioMute = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Mute mixer channel for Bass Track"]',
    );
    const audioSolo = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Solo mixer channel for Bass Track"]',
    );
    expect(audioMute).not.toBeNull();
    expect(audioSolo).not.toBeNull();
    await act(async () => {
      await userEvent.click(audioMute!);
      await userEvent.click(audioSolo!);
    });
    expect(
      applyPatchSpy.mock.calls
        .filter((call) => 'mixer' in (call[0] as object))
        .map((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mixer: expect.objectContaining({ patch: { muted: true } }),
        }),
        expect.objectContaining({
          mixer: expect.objectContaining({ patch: { solo: true } }),
        }),
      ]),
    );
    // Audio authority now updates the mixer domain; the event-domain edits
    // above did not leak into it.
    expect(useProjectStore.getState().mixer.channels[0]?.muted).toBe(true);
    expect(useProjectStore.getState().mixer.channels[0]?.solo).toBe(true);
  });
});
