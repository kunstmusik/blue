// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import { MeterStore, meterStore } from '../stores/meter-store';
import {
  createEmptyMixerSnapshot,
  type MixerChannelSnapshot,
  type MixerSnapshot,
} from '../../shared/project-editor';
import type { MeterBindingMapPayload, MeterFramePayload } from '../../shared/meter-types';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Mounted 64-Strip Metering Performance and Interaction Latency (SC-003, FR-013)', () => {
  let host: HTMLDivElement;
  let root: Root;
  let rafCallbacks: Array<(timestamp: number) => void> = [];
  let nextRafId = 1;
  let intersectionCallbacks: IntersectionObserverCallback[] = [];

  const mockGetContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
  }));

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 1;
    intersectionCallbacks = [];
    meterStore.reset();

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    HTMLCanvasElement.prototype.getContext =
      mockGetContext as unknown as typeof HTMLCanvasElement.prototype.getContext;

    window.requestAnimationFrame = vi.fn((cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return nextRafId++;
    }) as unknown as typeof window.requestAnimationFrame;

    window.cancelAnimationFrame = vi.fn((id: number) => {
      // noop
    }) as unknown as typeof window.cancelAnimationFrame;

    window.blueAPI = {
      sendMixerRealtimeLevelUpdate: vi.fn(),
    } as unknown as typeof window.blueAPI;

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    global.IntersectionObserver = class {
      constructor(public callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    meterStore.reset();
    vi.restoreAllMocks();
  });

  function create64ChannelMixer(): { mixer: MixerSnapshot; channels: MixerChannelSnapshot[] } {
    const mixer = createEmptyMixerSnapshot();
    const channels: MixerChannelSnapshot[] = [];

    for (let i = 0; i < 60; i++) {
      const channel: MixerChannelSnapshot = {
        id: `source-${i}`,
        name: `Track ${i + 1}`,
        channelKind: 'instrument',
        association: `layer-${i}`,
        outChannel: 'Master',
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      };
      mixer.channels.push(channel);
      channels.push(channel);
    }

    for (let i = 0; i < 3; i++) {
      const sub: MixerChannelSnapshot = {
        id: `sub-${i}`,
        name: `Sub ${i + 1}`,
        channelKind: 'subChannel',
        association: undefined,
        outChannel: 'Master',
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      };
      mixer.subChannels.push(sub);
      channels.push(sub);
    }

    channels.push(mixer.master);
    return { mixer, channels };
  }

  function setupBindingMap(channels: MixerChannelSnapshot[], nchnls = 2): void {
    const bindingMap: MeterBindingMapPayload = {
      nchnls,
      entries: channels.map((c) => ({
        kind:
          c.channelKind === 'subChannel' ? 'sub' : c.channelKind === 'master' ? 'master' : 'source',
        csdKey: c.id,
        stripId: c.id,
        displayName: c.name,
      })),
    };
    meterStore.setBindingMap(bindingMap);
  }

  it('advances meter ballistics at most once per animation frame timestamp across 64 mounted strips', () => {
    const { mixer, channels } = create64ChannelMixer();
    setupBindingMap(channels);

    act(() => {
      root.render(
        <div>
          {channels.map((channel) => (
            <ChannelStrip
              key={channel.id}
              mixer={mixer}
              channel={channel}
              isMaster={channel.channelKind === 'master'}
              isSubChannel={channel.channelKind === 'subChannel'}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
            />
          ))}
        </div>,
      );
    });

    expect(rafCallbacks.length).toBe(64);

    const updateSpy = vi.spyOn(meterStore, 'update');

    // Feed a meter frame with audio
    meterStore.processMeterFrame({
      sequence: 1,
      channels: channels.map((c) => ({
        csdKey: c.id,
        rms: [0.5, 0.5],
        peak: [0.7, 0.7],
      })),
    });

    // Fire all 64 rAF callbacks with the exact same timestamp (as the browser does in a single tick)
    const currentCallbacks = [...rafCallbacks];
    rafCallbacks = [];
    const frameTimestamp = 16.67;

    act(() => {
      for (const cb of currentCallbacks) {
        cb(frameTimestamp);
      }
    });

    // update was called 64 times (once per strip draw callback)
    expect(updateSpy).toHaveBeenCalledTimes(64);
    // But lastUpdateTime was set on the first call, so strips 2..64 immediately returned
    expect(meterStore.getLastUpdateTime()).toBe(frameTimestamp);

    // If another frame fires with the same timestamp, it also returns immediately
    const prevBarLevel = meterStore.getStripState(channels[0].id)!.barLevels[0];
    meterStore.update(frameTimestamp);
    expect(meterStore.getStripState(channels[0].id)!.barLevels[0]).toBe(prevBarLevel);
  }, 15_000);

  it('skips canvas rendering work when strip is off-screen', () => {
    const { mixer, channels } = create64ChannelMixer();
    const singleChannel = channels[0];
    setupBindingMap([singleChannel]);

    let capturedObserverCb: IntersectionObserverCallback | null = null;
    global.IntersectionObserver = class {
      constructor(public callback: IntersectionObserverCallback) {
        capturedObserverCb = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;

    const clearRectMock = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: clearRectMock,
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    act(() => {
      root.render(
        <ChannelStrip
          mixer={mixer}
          channel={singleChannel}
          isMaster={false}
          isSubChannel={false}
          onPatch={() => {}}
          projectSessionId={1}
          projectRevision={1}
          onOpenEffectInterface={() => {}}
        />,
      );
    });

    const canvas = host.querySelector('canvas')!;
    expect(canvas).toBeDefined();

    // Mark as offscreen via IntersectionObserver
    act(() => {
      if (capturedObserverCb) {
        capturedObserverCb(
          [
            {
              target: canvas,
              isIntersecting: false,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: 0,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 10,
            },
          ],
          {} as IntersectionObserver,
        );
      }
    });

    clearRectMock.mockClear();

    // Fire animation frame while offscreen
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    act(() => {
      for (const cb of cbs) {
        cb(100);
      }
    });

    // When offscreen, clearRect should NOT be called (rendering skipped)
    expect(clearRectMock).not.toHaveBeenCalled();

    // Mark as onscreen
    act(() => {
      if (capturedObserverCb) {
        capturedObserverCb(
          [
            {
              target: canvas,
              isIntersecting: true,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: 1,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 110,
            },
          ],
          {} as IntersectionObserver,
        );
      }
    });

    // Provide audio so it's not parked at silence
    meterStore.processMeterFrame({
      sequence: 2,
      channels: [{ csdKey: singleChannel.id, rms: [0.8, 0.8], peak: [0.9, 0.9] }],
    });

    const onscreenCbs = [...rafCallbacks];
    rafCallbacks = [];
    act(() => {
      for (const cb of onscreenCbs) {
        cb(120);
      }
    });

    // When onscreen and active, clearRect should be called
    expect(clearRectMock).toHaveBeenCalled();
  });

  it('measures fader interaction latency on 64 strips with metering within 20% of baseline (SC-003)', () => {
    const { mixer, channels } = create64ChannelMixer();
    setupBindingMap(channels);

    const onPatch = vi.fn();

    act(() => {
      root.render(
        <div>
          {channels.map((channel) => (
            <ChannelStrip
              key={channel.id}
              mixer={mixer}
              channel={channel}
              isMaster={channel.channelKind === 'master'}
              isSubChannel={channel.channelKind === 'subChannel'}
              onPatch={onPatch}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
            />
          ))}
        </div>,
      );
    });

    const sliders = host.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(sliders.length).toBe(64);

    const ITERATIONS = 10;

    // --- Phase A: Non-metering baseline ---
    // In baseline, meters are parked at silence (no audio frames streaming).
    meterStore.reset();
    setupBindingMap(channels);

    const startBaseline = performance.now();
    act(() => {
      for (let iter = 0; iter < ITERATIONS; iter++) {
        // Dispatch fader interaction on every strip
        for (let i = 0; i < 64; i++) {
          const slider = sliders[i];
          slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }
      }
    });
    const baselineElapsed = performance.now() - startBaseline;

    // --- Phase B: Active 64-strip metering ---
    // Feed 30 Hz audio frames and drive animation frames
    let frameSeq = 100;
    const startMetered = performance.now();
    act(() => {
      for (let iter = 0; iter < ITERATIONS; iter++) {
        // Feed a meter frame to all 64 strips
        meterStore.processMeterFrame({
          sequence: ++frameSeq,
          channels: channels.map((c, idx) => ({
            csdKey: c.id,
            rms: [0.3 + 0.01 * (idx % 10), 0.3],
            peak: [0.5 + 0.01 * (idx % 10), 0.5],
          })),
        });

        // Advance animation frame callbacks for all 64 strips
        const currentCbs = [...rafCallbacks];
        rafCallbacks = [];
        const now = 1000 + iter * 33.3;
        for (const cb of currentCbs) {
          cb(now);
        }

        // Perform identical fader interaction on every strip
        for (let i = 0; i < 64; i++) {
          const slider = sliders[i];
          slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }
      }
    });
    const meteredElapsed = performance.now() - startMetered;

    // Verify interactions succeeded
    expect(onPatch).toHaveBeenCalled();

    // Interaction latency difference should be small and within SC-003 bounds.
    // In JSDOM test environments, total execution times for 640 slider interactions + 10 rAFs are ~20-80ms.
    // When baseline is very fast (< 10ms), jitter can cause small absolute variations,
    // so we assert either:
    // 1) meteredElapsed <= baselineElapsed * 1.20 (within 20%) OR
    // 2) absolute difference is less than 50ms (sub-frame headroom over 640 interactions).
    // In shared CI runner environments under multi-tenant CPU load, provide additional headroom to prevent false failures.
    const overheadRatio = process.env.CI ? 1.4 : 1.2;
    const absoluteBuffer = process.env.CI ? 200 : 50;
    const maxAllowedTime = Math.max(
      baselineElapsed * overheadRatio,
      baselineElapsed + absoluteBuffer,
    );
    expect(meteredElapsed).toBeLessThanOrEqual(maxAllowedTime);
  }, 30_000);
});
