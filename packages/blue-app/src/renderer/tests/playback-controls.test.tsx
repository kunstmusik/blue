// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import PlaybackControls from '../components/menu-bar/PlaybackControls';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

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

  it('keeps Play disabled when no project is loaded', () => {
    const { container, root } = renderControls();
    const play = container.querySelector('button[title="Play"]') as HTMLButtonElement | null;

    expect(play?.disabled).toBe(true);

    act(() => root.unmount());
  });
});
