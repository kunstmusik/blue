// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import ToolbarDisplays from '../components/menu-bar/ToolbarDisplays';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix menus rely on pointer-capture APIs that jsdom does not implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

function seedProjectWithRulers(primaryTimeDisplay: string, secondaryTimeDisplay: string): void {
  const snapshot = createEmptyProjectEditorSnapshot();

  useProjectStore.getState().setProjectInfo({
    title: 'Playhead Menu Test',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/path/to/test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: {
      ...snapshot.orchestra,
      loaded: true,
    },
    projectProperties: {
      ...snapshot.projectProperties,
      title: 'Playhead Menu Test',
      author: 'Test Author',
    },
    transport: {
      ...snapshot.transport,
      renderStartTime: 2.05,
      renderEndTime: 12,
      tempoMap: {
        enabled: false,
        visible: false,
        points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
      },
    },
    score: {
      ...snapshot.score,
      timeState: {
        ...snapshot.score.timeState,
        primaryTimeDisplay,
        secondaryTimeDisplay,
      },
    },
  });
}

function renderRoot(element: React.ReactElement): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getDisplayCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('section.toolbar-display-card')) as HTMLElement[];
}

function openContextMenu(card: HTMLElement): void {
  act(() => {
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
  usePlaybackStore.getState().reset();
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('Toolbar playhead display', () => {
  it('syncs the playhead readout to the project ruler time bases', () => {
    seedProjectWithRulers('BBF', 'TIME');

    const { container, unmount } = renderRoot(<ToolbarDisplays />);

    const [playheadCard] = getDisplayCards(container);
    expect(playheadCard.textContent).toContain('1.3.05');

    unmount();
  });

  it('updates the synced playhead readout when the ruler time bases change', () => {
    seedProjectWithRulers('BBF', 'TIME');

    const { container, unmount } = renderRoot(<ToolbarDisplays />);

    const [playheadCard] = getDisplayCards(container);
    expect(playheadCard.textContent).toContain('1.3.05');

    act(() => {
      useProjectStore.setState((state) => ({
        score: {
          ...state.score,
          timeState: {
            ...state.score.timeState,
            primaryTimeDisplay: 'TIME',
          },
        },
      }));
    });

    // With the tempo map disabled, beat 2.05 formats as 0:02.050.
    expect(playheadCard.textContent).toContain('0:02.050');

    unmount();
  });

  it('opens the playhead context menu from a right click', () => {
    seedProjectWithRulers('BBF', 'TIME');

    const { container, unmount } = renderRoot(<ToolbarDisplays />);

    const [playheadCard] = getDisplayCards(container);
    openContextMenu(playheadCard);

    // Radix renders submenu contents lazily; the menu root lists the
    // Primary/Secondary subtriggers that lead to the format choices.
    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Primary');
    expect(menu?.textContent).toContain('Secondary');

    unmount();
  });

  it('opens the selection context menu from a right click', () => {
    seedProjectWithRulers('BBF', 'TIME');

    const { container, unmount } = renderRoot(<ToolbarDisplays />);

    const [, selectionCard] = getDisplayCards(container);
    openContextMenu(selectionCard);

    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Sync to Ruler');

    unmount();
  });

  it('keeps the built-in beat/time defaults before a project is loaded', () => {
    const { container, unmount } = renderRoot(<ToolbarDisplays />);

    const [playheadCard] = getDisplayCards(container);
    // clearProject resets transport; the idle anchor formats as 0.00 / 0:00.000.
    expect(playheadCard.textContent).toContain('0.00');
    expect(playheadCard.textContent).toContain('0:00.000');

    unmount();
  });
});
