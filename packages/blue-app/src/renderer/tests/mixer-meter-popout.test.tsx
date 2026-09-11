// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { MeterCanvas } from '../components/workbench/panels/mixer/MeterCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';
import { meterStore } from '../stores/meter-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MeterCanvas in popout and re-dock lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;

  let mainRafId = 0;
  let popoutRafId = 0;
  const mainRaf = vi.fn((cb: (time: number) => void) => ++mainRafId);
  const mainCaf = vi.fn((id: number) => {});
  const popoutRaf = vi.fn((cb: (time: number) => void) => ++popoutRafId);
  const popoutCaf = vi.fn((id: number) => {});

  const popout = new JSDOM('<!doctype html><html><body></body></html>');
  const popoutDoc = popout.window.document;

  beforeEach(() => {
    mainRaf.mockClear();
    mainCaf.mockClear();
    popoutRaf.mockClear();
    popoutCaf.mockClear();

    window.requestAnimationFrame = mainRaf as unknown as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = mainCaf as unknown as typeof window.cancelAnimationFrame;

    popout.window.requestAnimationFrame =
      popoutRaf as unknown as typeof window.requestAnimationFrame;
    popout.window.cancelAnimationFrame = popoutCaf as unknown as typeof window.cancelAnimationFrame;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    meterStore.reset();
  });

  it('transitions cleanly from main window to popout window and back on re-dock', () => {
    // 1. Initial docked state in main window
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <MeterCanvas stripId="master" width={14} height={80} />
        </HostDocumentContext.Provider>,
      );
    });

    expect(mainRaf).toHaveBeenCalled();
    expect(popoutRaf).not.toHaveBeenCalled();

    // 2. Detach panel into popout window
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <MeterCanvas stripId="master" width={14} height={80} />
        </HostDocumentContext.Provider>,
      );
    });

    // Main window rAF must be cancelled
    expect(mainCaf).toHaveBeenCalled();
    // Popout window rAF must be scheduled
    expect(popoutRaf).toHaveBeenCalled();

    // 3. Re-dock back to main window
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <MeterCanvas stripId="master" width={14} height={80} />
        </HostDocumentContext.Provider>,
      );
    });

    // Popout window rAF must be cancelled
    expect(popoutCaf).toHaveBeenCalled();
    // Main window rAF must resume
    expect(mainRaf.mock.calls.length).toBeGreaterThan(1);
  });
});
