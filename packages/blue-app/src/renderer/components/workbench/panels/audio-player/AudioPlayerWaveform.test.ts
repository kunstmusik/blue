// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import AudioPlayerWaveform, {
  buildWaveformEnvelope,
  drawWaveformEnvelope,
} from './AudioPlayerWaveform';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('buildWaveformEnvelope', () => {
  it('builds one ordered envelope spanning the canvas', () => {
    const points = buildWaveformEnvelope(
      {
        min: [-0.8, 0.4, -0.2],
        max: [-0.4, 0.7, 0.3],
      },
      90,
      60,
    );

    expect(points.map((point) => point.x)).toEqual([0, 45, 90]);
    expect(points.every((point) => point.yTop <= point.yBottom)).toBe(true);
    expect(points[0]?.yTop).toBeCloseTo(41.2);
    expect(points[0]?.yBottom).toBeCloseTo(52.4);
  });

  it('keeps full-scale peaks inside the canvas', () => {
    const points = buildWaveformEnvelope({ min: [-2], max: [2] }, 100, 64);

    expect(points).toEqual([{ x: 50, yTop: 2, yBottom: 62 }]);
  });

  it('draws one closed path instead of isolated bucket rectangles', () => {
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const drawn = drawWaveformEnvelope(
      context,
      { min: [-0.8, 0.4, -0.2], max: [-0.4, 0.7, 0.3] },
      90,
      60,
    );

    expect(drawn).toBe(true);
    expect(context.beginPath).toHaveBeenCalledOnce();
    expect(context.closePath).toHaveBeenCalledOnce();
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.lineTo).toHaveBeenCalledTimes(5);
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('paints without scheduling requestAnimationFrame while paused and animates only while playing', () => {
    const rafCallbacks: Array<FrameRequestCallback> = [];
    let nextRafId = 1;
    const origRaf = window.requestAnimationFrame;
    const origCaf = window.cancelAnimationFrame;
    const origResizeObserver = globalThis.ResizeObserver;
    const origGetContext = HTMLCanvasElement.prototype.getContext;

    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return nextRafId++;
    });
    window.cancelAnimationFrame = vi.fn();

    globalThis.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        Object.defineProperty(target, 'clientWidth', { configurable: true, get: () => 200 });
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const clearRect = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      setTransform: vi.fn(),
      clearRect,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineJoin: 'round',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const audio = document.createElement('audio');
    let isPaused = true;
    Object.defineProperty(audio, 'paused', { configurable: true, get: () => isPaused });
    Object.defineProperty(audio, 'ended', { configurable: true, get: () => false });
    const audioRef = { current: audio };

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      act(() => {
        root.render(
          React.createElement(AudioPlayerWaveform, {
            audioRef,
            filePath: '/tmp/test.wav',
            duration: 10,
            peaks: { min: [-0.5, -0.2], max: [0.5, 0.2] },
            status: null,
            onSeek: () => {},
          }),
        );
      });

      // Painted synchronously while paused, with 0 requestAnimationFrame calls scheduled
      expect(clearRect).toHaveBeenCalled();
      expect(rafCallbacks).toHaveLength(0);

      // Seeking while paused repaints once without starting rAF loop
      clearRect.mockClear();
      act(() => {
        audio.dispatchEvent(new Event('seeked'));
      });
      expect(clearRect).toHaveBeenCalledTimes(1);
      expect(rafCallbacks).toHaveLength(0);

      // Starting playback starts the rAF loop
      isPaused = false;
      act(() => {
        audio.dispatchEvent(new Event('play'));
      });
      expect(rafCallbacks).toHaveLength(1);

      const tick = rafCallbacks.pop()!;
      act(() => {
        tick(16.7);
      });
      // Still playing -> reschedules next frame
      expect(rafCallbacks).toHaveLength(1);

      // Pausing cancels the rAF loop and paints final paused frame
      isPaused = true;
      act(() => {
        audio.dispatchEvent(new Event('pause'));
      });
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
    } finally {
      act(() => {
        root.unmount();
      });
      host.remove();
      window.requestAnimationFrame = origRaf;
      window.cancelAnimationFrame = origCaf;
      globalThis.ResizeObserver = origResizeObserver;
      HTMLCanvasElement.prototype.getContext = origGetContext;
    }
  });
});
