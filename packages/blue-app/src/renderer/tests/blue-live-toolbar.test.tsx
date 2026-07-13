// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToolbarBlueLive from '../components/menu-bar/ToolbarBlueLive';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The workbench-store is no longer imported by ToolbarBlueLive (SPEC 058 removed
// the MIDI Input toolbar button). This mock remains so any unrelated consumer
// in this test file continues to provide a stub.
vi.mock('../stores/workbench-store', () => ({
  useWorkbenchStore: (selector: (state: { openPanel: () => void }) => unknown) =>
    selector({ openPanel: vi.fn() }),
}));

declare global {
  interface Window {
    blueAPI?: {
      toggleBlueLive?: () => Promise<unknown> | unknown;
      recompileBlueLive?: () => Promise<unknown> | unknown;
      sendBlueLiveAllNotesOff?: () => Promise<unknown> | unknown;
      triggerBlueLiveNote?: () => Promise<unknown> | unknown;
    };
  }
}

function seedLoadedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  useProjectStore.getState().setProjectInfo({
    title: 'Blue Live Test',
    author: 'Test',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: { ...snapshot.orchestra, loaded: true },
    projectProperties: snapshot.projectProperties,
    transport: snapshot.transport,
  });
}

function renderToolbar(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ToolbarBlueLive />);
  });

  return { container, root };
}

beforeEach(() => {
  useBlueLiveStore.getState().reset();
  useProjectStore.getState().clearProject();
  window.blueAPI = {
    toggleBlueLive: vi.fn(),
    recompileBlueLive: vi.fn(),
    sendBlueLiveAllNotesOff: vi.fn(),
    triggerBlueLiveNote: vi.fn(),
  };
});

afterEach(() => {
  delete window.blueAPI;
});

describe('Blue Live toolbar behavior', () => {
  it('keeps Blue Live toggle disabled when no project is loaded', () => {
    const { container, root } = renderToolbar();

    const buttons = Array.from(container.querySelectorAll('button'));
    const blueLiveButton = buttons.find((button) => button.textContent === 'Blue Live');
    const recompileButton = buttons.find((button) => button.textContent === 'Recompile');
    const allNotesOffButton = buttons.find((button) => button.textContent === 'All Notes Off');
    const midiInputButton = buttons.find((button) => button.textContent === 'MIDI Input');

    expect(blueLiveButton).toBeTruthy();
    expect((blueLiveButton as HTMLButtonElement).disabled).toBe(true);
    expect((recompileButton as HTMLButtonElement).disabled).toBe(true);
    expect((allNotesOffButton as HTMLButtonElement).disabled).toBe(true);

    // SPEC 058 US2: the obsolete `MIDI Input` toolbar button must be removed.
    expect(midiInputButton).toBeUndefined();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('toggles Blue Live without focusing an editor surface', () => {
    seedLoadedProject();
    const { container, root } = renderToolbar();
    const toggle = vi.fn();
    window.blueAPI = {
      ...window.blueAPI,
      toggleBlueLive: toggle,
    };

    const blueLiveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Blue Live');
    expect(blueLiveButton).toBeTruthy();
    expect((blueLiveButton as HTMLButtonElement).disabled).toBe(false);

    act(() => {
      blueLiveButton?.click();
    });

    expect(toggle).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('enables Recompile and All Notes Off according to engine status', () => {
    seedLoadedProject();
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });

    const { container, root } = renderToolbar();
    const recompile = vi.fn();
    const allNotesOff = vi.fn();
    window.blueAPI = {
      ...window.blueAPI,
      recompileBlueLive: recompile,
      sendBlueLiveAllNotesOff: allNotesOff,
    };

    const buttons = Array.from(container.querySelectorAll('button'));
    const blueLiveButton = buttons.find((button) => button.textContent === 'Blue Live');
    const recompileButton = buttons.find((button) => button.textContent === 'Recompile');
    const allNotesOffButton = buttons.find((button) => button.textContent === 'All Notes Off');

    expect(blueLiveButton?.getAttribute('aria-pressed')).toBe('true');
    expect((recompileButton as HTMLButtonElement).disabled).toBe(false);
    expect((allNotesOffButton as HTMLButtonElement).disabled).toBe(false);

    act(() => {
      recompileButton?.click();
      allNotesOffButton?.click();
    });

    expect(recompile).toHaveBeenCalledTimes(1);
    expect(allNotesOff).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
