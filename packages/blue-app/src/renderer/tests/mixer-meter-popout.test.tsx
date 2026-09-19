// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { MeterCanvas } from '../components/workbench/panels/mixer/MeterCanvas';
import { MixerSettingsDialog } from '../components/workbench/panels/mixer/MixerSettingsDialog';
import { HostDocumentContext } from '../hooks/use-host-document';
import { meterStore } from '../stores/meter-store';
import { createEmptyMixerSnapshot } from '../../shared/project-editor';

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

  it('mounts MixerSettingsDialog in docked vs popout document based on HostDocumentContext (T027)', () => {
    const handleToggle = vi.fn();
    const handleClose = vi.fn();

    // 1. Render dialog in main window document
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <MixerSettingsDialog
            isOpen={true}
            enableMeters={true}
            mixer={createEmptyMixerSnapshot()}
            onToggleEnableMeters={handleToggle}
            onToggleEnablePanning={vi.fn()}
            onPanLawChange={vi.fn()}
            onPanBoostChange={vi.fn()}
            onClose={handleClose}
          />
        </HostDocumentContext.Provider>,
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(popoutDoc.body.querySelector('[role="dialog"]')).toBeNull();

    const mainCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Meters"]',
    )!;
    expect(mainCheckbox.checked).toBe(true);
    expect(document.body.querySelector('[role="dialog"] select')).toBeNull();

    act(() => {
      mainCheckbox.click();
    });
    expect(handleToggle).toHaveBeenCalledWith(false);

    // 2. Render dialog in popout window document
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <MixerSettingsDialog
            isOpen={true}
            enableMeters={false}
            mixer={createEmptyMixerSnapshot()}
            onToggleEnableMeters={handleToggle}
            onToggleEnablePanning={vi.fn()}
            onPanLawChange={vi.fn()}
            onPanBoostChange={vi.fn()}
            onClose={handleClose}
          />
        </HostDocumentContext.Provider>,
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(popoutDoc.body.querySelector('[role="dialog"]')).not.toBeNull();

    const popoutCheckbox = popoutDoc.body.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Meters"]',
    )!;
    expect(popoutCheckbox.checked).toBe(false);
    expect(popoutDoc.body.querySelector('[role="dialog"] select')).toBeNull();

    // Close in popout
    const closeBtn = Array.from(popoutDoc.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Close',
    )!;
    act(() => {
      closeBtn.click();
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('selects correct presentation in detached view via stable key regardless of display labels (T038)', () => {
    // Render MeterCanvas in popout window with stable key
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <MeterCanvas
            stripId="channel-1"
            channelCount={2}
            width={14}
            height={80}
            profileKey="k14-rms-peak"
          />
        </HostDocumentContext.Provider>,
      );
    });

    const canvas = host.querySelector<HTMLCanvasElement>('canvas.meter-canvas')!;
    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('data-profile')).toBe('k14-rms-peak');

    // Register strip and update telemetry in meter store
    act(() => {
      meterStore.setBindingMap({
        nchnls: 2,
        entries: [{ csdKey: 'ch_1', stripId: 'channel-1' }],
      });
      meterStore.processMeterFrame({
        sequence: 1,
        channels: [{ csdKey: 'ch_1', peak: [0.5, 0.5], rms: [0.25, 0.25] }],
      });
    });

    // Verify peak readout / held peak on meterStore (-6.0)
    expect(meterStore.getNumericPeak('channel-1')).toBe('-6.0');

    // Switch profile key in popout view
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <MeterCanvas
            stripId="channel-1"
            channelCount={2}
            width={14}
            height={80}
            profileKey="peak-rms-mixing-plus-6"
          />
        </HostDocumentContext.Provider>,
      );
    });

    const updatedCanvas = host.querySelector<HTMLCanvasElement>('canvas.meter-canvas')!;
    expect(updatedCanvas.getAttribute('data-profile')).toBe('peak-rms-mixing-plus-6');
  });
});
