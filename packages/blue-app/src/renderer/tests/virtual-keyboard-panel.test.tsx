// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VirtualKeyboardPanel from '../components/workbench/panels/VirtualKeyboardPanel';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  _installVirtualKeyboardRouter,
} from '../hooks/use-midi-input-service';
import { MidiNoteRouter } from '../services/midi-note-router';

declare global {
  interface Window {
    blueAPI?: {
      triggerBlueLiveNote?: (request: unknown) => Promise<unknown> | unknown;
      sendBlueLiveAllNotesOff?: () => Promise<unknown> | unknown;
    };
  }
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

function seedLoadedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  useProjectStore.getState().setProjectInfo({
    title: 'Virtual Keyboard Test',
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

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<VirtualKeyboardPanel />);
  });

  return { container, root };
}

let router: MidiNoteRouter | null = null;

beforeEach(() => {
  useProjectStore.getState().clearProject();
  useBlueLiveStore.getState().reset();
  window.blueAPI = {
    triggerBlueLiveNote: vi.fn().mockResolvedValue({ ok: true }),
    sendBlueLiveAllNotesOff: vi.fn().mockResolvedValue({ ok: true }),
  };
  // Install a real router for parity tests; the host hook does this in prod.
  router = new MidiNoteRouter({
    trigger: async (req) => {
      // The router triggers main via the blueAPI in production. For tests we
      // route through the mock so assertions can observe the call.
      if (req.type === 'noteOn') {
        await window.blueAPI?.triggerBlueLiveNote?.(req);
      } else if (req.type === 'noteOff') {
        await window.blueAPI?.triggerBlueLiveNote?.(req);
      }
      return { ok: true };
    },
    allNotesOff: async () => {
      await window.blueAPI?.sendBlueLiveAllNotesOff?.();
      return { ok: true };
    },
    isLiveActive: () =>
      useProjectStore.getState().loaded && useBlueLiveStore.getState().running,
  });
  _installVirtualKeyboardRouter(router);
});

afterEach(() => {
  _installVirtualKeyboardRouter(null);
  delete window.blueAPI;
});

describe('VirtualKeyboardPanel', () => {
  it('routes mouse note presses through the shared note router', async () => {
    seedLoadedProject();
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });

    const { container, root } = renderPanel();
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;

    expect(canvas).toBeTruthy();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 150, right: 800, bottom: 150 }),
    });
    Object.defineProperty(canvas, 'clientWidth', { value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { value: 150 });

    await act(async () => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 5, clientY: 140, button: 0 }));
      await Promise.resolve();
    });

    expect(window.blueAPI?.triggerBlueLiveNote).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'noteOn',
        source: 'mouse',
      }),
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('uses the shared all-notes-off route', async () => {
    seedLoadedProject();
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });

    const { container, root } = renderPanel();
    const allNotesOffButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'All Notes Off') as HTMLButtonElement | undefined;

    expect(allNotesOffButton).toBeTruthy();

    await act(async () => {
      allNotesOffButton?.click();
      await Promise.resolve();
    });

    expect(window.blueAPI?.sendBlueLiveAllNotesOff).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not send duplicate all-notes-off when the router has held notes', async () => {
    seedLoadedProject();
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });
    await router?.routeNote({
      type: 'noteOn',
      sourceKind: 'mouse',
      sourceId: 'virtual-keyboard:mouse:mouse',
      deviceId: null,
      channel: 0,
      midiNote: 60,
      velocity: 100,
      timestamp: 0,
    });

    const { container, root } = renderPanel();
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'All Notes Off',
    );
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });

    expect(window.blueAPI?.sendBlueLiveAllNotesOff).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it('displays channel as 1-16 (1-indexed)', () => {
    seedLoadedProject();
    useBlueLiveStore.getState().setStatusFromSnapshot({
      status: 'running',
      running: true,
      sessionId: 1,
    });

    const { container, root } = renderPanel();
    const channelInput = container.querySelector('input[type="number"][min="1"]') as HTMLInputElement | null;

    expect(channelInput).toBeTruthy();
    expect(channelInput?.value).toBe('1');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders a canvas element for the piano keyboard', () => {
    const { container, root } = renderPanel();
    const canvas = container.querySelector('canvas');

    expect(canvas).toBeTruthy();
    expect(canvas?.tabIndex).toBe(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
