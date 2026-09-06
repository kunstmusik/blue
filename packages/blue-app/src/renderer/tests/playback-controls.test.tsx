// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import PlaybackControls from '../components/menu-bar/PlaybackControls';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderControls(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<PlaybackControls />));
  return { container, root };
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  usePlaybackStore.getState().reset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PlaybackControls project availability', () => {
  it('enables Play for a loaded project that has not been saved yet', () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: null,
      loaded: true,
    });

    const { container, root } = renderControls();
    const play = container.querySelector('button[title="Play"]') as HTMLButtonElement | null;

    expect(useProjectStore.getState().loaded).toBe(true);
    expect(useProjectStore.getState().filePath).toBeNull();
    expect(play?.disabled).toBe(false);

    act(() => root.unmount());
  });

  it('exposes platform-specific shortcut in Follow Playback title and reflects aria-pressed state', () => {
    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const expectedShortcut = isMac ? 'Command+Shift+F' : 'Control+Shift+F';

    usePlaybackStore.setState({ followPlayback: false });
    const { container, root } = renderControls();

    const button = container.querySelector(
      'button[title*="Follow playback"]',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.getAttribute('title')).toBe(`Follow playback off (${expectedShortcut})`);
    expect(button?.getAttribute('aria-label')).toBe(`Follow playback off (${expectedShortcut})`);
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      usePlaybackStore.setState({ followPlayback: true });
    });

    expect(button?.getAttribute('title')).toBe(`Follow playback on (${expectedShortcut})`);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    act(() => root.unmount());
  });
});
