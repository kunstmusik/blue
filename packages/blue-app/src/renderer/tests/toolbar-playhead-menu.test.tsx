// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyProjectEditorSnapshot,
  createEmptyScoreDocumentSnapshot,
} from '../../shared/project-editor';
import ToolbarDisplays from '../components/menu-bar/ToolbarDisplays';
import { usePlaybackStore } from '../stores/playback-store';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';

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
      ...createEmptyScoreDocumentSnapshot(),
      ...snapshot.score,
      timeState: {
        ...createEmptyScoreDocumentSnapshot().timeState,
        ...snapshot.score?.timeState,
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
  it.each([
    {
      display: 'Primary',
      label: '29.97 fps (DF)',
      rate: 29.97,
      dropFrame: true,
      text: '00:01:00;02',
    },
    {
      display: 'Secondary',
      label: '29.97 fps (DF)',
      rate: 29.97,
      dropFrame: true,
      text: '00:01:00;02',
    },
    { display: 'Primary', label: '24 fps', rate: 24, dropFrame: false, text: '00:01:00:01' },
  ])(
    'selects $label from the $display SMPTE submenu',
    async ({ display, label, rate, dropFrame, text }) => {
      seedProjectWithRulers('BBF', 'TIME');
      const originalAPI = window.blueAPI;
      const commit = vi.fn().mockResolvedValue({
        revision: 1,
        sessionId: useProjectStore.getState().sessionId,
        changed: true,
      });
      Object.defineProperty(window, 'blueAPI', {
        value: { ...originalAPI, commitProjectDocumentPatches: commit },
        writable: true,
        configurable: true,
      });
      useProjectStore.setState((state) => ({
        transport: { ...state.transport, renderStartTime: 60.06 },
      }));
      const { container, unmount } = renderRoot(<ToolbarDisplays />);
      try {
        const [card] = getDisplayCards(container);
        openContextMenu(card);
        for (const label of [display, 'SMPTE']) {
          const trigger = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
            (item) => item.textContent?.trim() === label,
          )!;
          expect(trigger).toBeTruthy();
          await act(async () => {
            trigger.focus();
            trigger.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
        }
        const option = [
          ...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
        ].find((item) => item.textContent?.trim() === label)!;
        expect(option).toBeTruthy();
        expect(option.getAttribute('data-state')).toBe('unchecked');
        act(() => option.click());
        expect(card.textContent).toContain(text);
        expect(useProjectStore.getState().score.timeState).toMatchObject({
          smpteFrameRate: rate,
          smpteDropFrame: dropFrame,
        });
        openContextMenu(card);
        for (const submenu of [display, 'SMPTE']) {
          const trigger = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
            (item) => item.textContent?.trim() === submenu,
          )!;
          await act(async () => {
            trigger.focus();
            trigger.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
        }
        const activeOption = [
          ...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
        ].find((item) => item.textContent?.trim() === label)!;
        expect(activeOption.getAttribute('data-state')).toBe('checked');
        await useProjectStore.getState().flushPendingPatches();
        expect(commit).toHaveBeenCalledWith(
          [
            {
              score: {
                type: 'updateTimeState',
                patch: { smpteFrameRate: rate, smpteDropFrame: dropFrame },
              },
            },
          ],
          expect.objectContaining({ label: 'Change SMPTE Format' }),
        );
      } finally {
        unmount();
        __testClearPendingPatches();
        Object.defineProperty(window, 'blueAPI', {
          value: originalAPI,
          writable: true,
          configurable: true,
        });
      }
    },
  );

  it('changes live SMPTE labels without replacing the playback clock or timing anchor', () => {
    seedProjectWithRulers('SMPTE', 'SMPTE');
    useProjectStore.setState((state) => ({
      transport: { ...state.transport, renderStartTime: 60.06, smpteFrameRate: 29.97 },
    }));
    const anchor = useProjectStore.getState().transport;
    const clock = {
      sessionId: 1,
      sampleFrames: 0,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
      receivedAtMs: Date.now(),
    };
    usePlaybackStore.setState({
      status: 'playing',
      isPlaying: true,
      clock,
      transportAnchor: anchor,
      display: { sampleFrames: 0, elapsedSeconds: 0, source: 'engine-authority' },
    });
    const { container, unmount } = renderRoot(<ToolbarDisplays />);
    const [playheadCard] = getDisplayCards(container);
    expect(playheadCard.textContent).toContain('00:01:00:00');
    for (const smpteDropFrame of [true, false, true]) {
      act(() => {
        useProjectStore.setState((state) => ({
          transport: { ...state.transport, smpteDropFrame },
        }));
      });
      expect(playheadCard.textContent).toContain(smpteDropFrame ? '00:01:00;02' : '00:01:00:00');
      expect(usePlaybackStore.getState().clock).toBe(clock);
      expect(usePlaybackStore.getState().transportAnchor).toBe(anchor);
      expect(usePlaybackStore.getState().display.elapsedSeconds).toBe(0);
    }
    unmount();
  });

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
