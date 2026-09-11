// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { MeterCanvas } from '../components/workbench/panels/mixer/MeterCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';
import { meterStore } from '../stores/meter-store';
import type { MeterBindingMapPayload, MeterFramePayload } from '../../shared/meter-types';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MeterCanvas', () => {
  let host: HTMLDivElement;
  let root: Root;
  let rafCallbacks: Array<(time: number) => void> = [];
  let rafIdCounter = 0;

  const mockRaf = (cb: (time: number) => void) => {
    rafCallbacks.push(cb);
    return ++rafIdCounter;
  };

  const mockCaf = vi.fn((id: number) => {
    // no-op or clear
  });

  const sampleBindingMap: MeterBindingMapPayload = {
    nchnls: 2,
    entries: [
      { kind: 'source', csdKey: '0', stripId: 'track-1', displayName: 'Track 1' },
      { kind: 'master', csdKey: 'sub_Master', stripId: 'master', displayName: 'Master' },
    ],
  };

  beforeEach(() => {
    rafCallbacks = [];
    rafIdCounter = 0;
    mockCaf.mockClear();

    window.requestAnimationFrame = mockRaf as unknown as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = mockCaf as unknown as typeof window.cancelAnimationFrame;

    meterStore.setBindingMap(sampleBindingMap);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    // Mock HTMLCanvasElement.getContext("2d")
    const mockCtx = {
      canvas: null,
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(function (
      this: HTMLCanvasElement,
      contextId: string,
    ) {
      if (contextId === '2d') {
        mockCtx.canvas = this as unknown as null;
        return mockCtx as unknown as CanvasRenderingContext2D;
      }
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    meterStore.reset();
  });

  it('renders canvas element with specified dimensions and schedules animation frame', () => {
    act(() => {
      root.render(<MeterCanvas stripId="track-1" width={14} height={80} />);
    });

    const canvas = host.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.width).toBe('14px');
    expect(canvas?.style.height).toBe('80px');
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('cancels animation frame on unmount', () => {
    act(() => {
      root.render(<MeterCanvas stripId="track-1" width={14} height={80} />);
    });

    expect(rafCallbacks.length).toBeGreaterThan(0);

    act(() => {
      root.unmount();
    });

    expect(mockCaf).toHaveBeenCalled();
  });

  it('binds to popout window context when hosted in popout document', () => {
    const popout = new JSDOM('<!doctype html><html><body></body></html>');
    const popoutDoc = popout.window.document;
    const popoutRaf = vi.fn((cb: (time: number) => void) => ++rafIdCounter);
    const popoutCaf = vi.fn();
    popout.window.requestAnimationFrame =
      popoutRaf as unknown as typeof window.requestAnimationFrame;
    popout.window.cancelAnimationFrame = popoutCaf as unknown as typeof window.cancelAnimationFrame;

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <MeterCanvas stripId="track-1" width={14} height={80} />
        </HostDocumentContext.Provider>,
      );
    });

    expect(popoutRaf).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });

    expect(popoutCaf).toHaveBeenCalled();
  });

  it('clears clip indicator when canvas is clicked', () => {
    // Put track-1 into clipped state
    meterStore.processMeterFrame(
      {
        sequence: 1,
        channels: [{ csdKey: '0', rms: [0.9, 0.9], peak: [1.1, 1.1] }],
      },
      1000,
    );
    meterStore.update(1000);

    expect(meterStore.getStripState('track-1')!.clipFlags[0]).toBe(true);

    act(() => {
      root.render(<MeterCanvas stripId="track-1" width={14} height={80} />);
    });

    const canvas = host.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(meterStore.getStripState('track-1')!.clipFlags[0]).toBe(false);
  });

  it('draws meter bars when audio frame arrives and rAF triggers', () => {
    act(() => {
      root.render(<MeterCanvas stripId="track-1" width={14} height={80} />);
    });

    const canvas = host.querySelector('canvas')!;
    const ctx = canvas.getContext('2d') as unknown as { fillRect: ReturnType<typeof vi.fn> };

    // Advance frame with active audio
    meterStore.processMeterFrame(
      {
        sequence: 1,
        channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.8, 0.8] }],
      },
      1000,
    );

    ctx.fillRect.mockClear();

    // Trigger rAF callback
    expect(rafCallbacks.length).toBeGreaterThan(0);
    const cb = rafCallbacks[rafCallbacks.length - 1]!;
    act(() => {
      cb(1050);
    });

    // Should have drawn background, bars, and peak markers
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('renders mono, stereo, and 6-channel surround without clipping', () => {
    const testCases = [
      { nchnls: 1, expectedDerivedWidth: 10 },
      { nchnls: 2, expectedDerivedWidth: 12 },
      { nchnls: 6, expectedDerivedWidth: 25 },
    ];

    for (const { nchnls, expectedDerivedWidth } of testCases) {
      // Configure binding map for target channel count
      meterStore.setBindingMap({
        nchnls,
        entries: [
          {
            kind: 'source',
            csdKey: '0',
            stripId: `track-${nchnls}`,
            displayName: `Track ${nchnls}`,
          },
        ],
      });

      act(() => {
        root.render(<MeterCanvas stripId={`track-${nchnls}`} height={80} />);
      });

      const canvas = host.querySelector('canvas')!;
      expect(canvas.style.width).toBe(`${expectedDerivedWidth}px`);

      const ctx = canvas.getContext('2d') as unknown as {
        fillRect: ReturnType<typeof vi.fn>;
      };

      // Feed active levels across all channels
      const rms = new Array(nchnls).fill(0.5);
      const peak = new Array(nchnls).fill(0.8);
      meterStore.processMeterFrame(
        {
          sequence: nchnls,
          channels: [{ csdKey: '0', rms, peak }],
        },
        2000 + nchnls * 100,
      );

      ctx.fillRect.mockClear();

      const cb = rafCallbacks[rafCallbacks.length - 1]!;
      act(() => {
        cb(2050 + nchnls * 100);
      });

      // Capture all fillRect calls: (x, y, w, h)
      const calls = ctx.fillRect.mock.calls as Array<[number, number, number, number]>;
      expect(calls.length).toBeGreaterThanOrEqual(nchnls * 3); // clip box, track background, active bar, peak marker

      // Assert that every drawn rectangle fits strictly within [0, expectedDerivedWidth]
      for (const [x, , w] of calls) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(expectedDerivedWidth + 0.001);
      }

      // Cleanup for next case
      act(() => {
        root.unmount();
      });
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
    }
  });

  it('renders subpixel bars without clipping when nchnls=6 is constrained to narrow width', () => {
    meterStore.setBindingMap({
      nchnls: 6,
      entries: [
        { kind: 'source', csdKey: '0', stripId: 'track-surround', displayName: 'Surround' },
      ],
    });

    const forcedWidth = 12;
    act(() => {
      root.render(<MeterCanvas stripId="track-surround" width={forcedWidth} height={80} />);
    });

    const canvas = host.querySelector('canvas')!;
    expect(canvas.style.width).toBe(`${forcedWidth}px`);

    const ctx = canvas.getContext('2d') as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
    };

    meterStore.processMeterFrame(
      {
        sequence: 10,
        channels: [
          {
            csdKey: '0',
            rms: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
            peak: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
          },
        ],
      },
      3000,
    );

    ctx.fillRect.mockClear();

    const cb = rafCallbacks[rafCallbacks.length - 1]!;
    act(() => {
      cb(3050);
    });

    const calls = ctx.fillRect.mock.calls as Array<[number, number, number, number]>;
    expect(calls.length).toBeGreaterThanOrEqual(18); // 6 * (clip + track + bar)

    for (const [x, , w] of calls) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(forcedWidth + 0.001);
    }
  });
});
