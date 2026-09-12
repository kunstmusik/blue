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
import {
  METER_PROFILES,
  getMeterProfile,
  formatPeakDb,
  K_REFERENCE_DISCLAIMER,
  FALLBACK_METER_PROFILE_KEY,
} from '../components/workbench/panels/mixer/meter-profiles';
import { METER_PROFILE_KEYS } from '@blue/data';

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

  it('atomically clears clip indicator, held peaks, and peak-hold markers when canvas is clicked', () => {
    // Put track-1 into clipped and active peak state
    meterStore.processMeterFrame(
      {
        sequence: 1,
        channels: [{ csdKey: '0', rms: [0.9, 0.9], peak: [1.1, 1.1] }],
      },
      1000,
    );
    meterStore.update(1000);

    expect(meterStore.getStripState('track-1')!.clipFlags[0]).toBe(true);
    expect(meterStore.getStripState('track-1')!.numericPeak).not.toBe('-inf');
    expect(meterStore.getStripState('track-1')!.peakHoldLevels[0]).toBeGreaterThan(-60);

    act(() => {
      root.render(<MeterCanvas stripId="track-1" width={14} height={80} />);
    });

    const canvas = host.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const state = meterStore.getStripState('track-1')!;
    expect(state.clipFlags[0]).toBe(false);
    expect(state.heldSamplePeaks).toEqual([-Infinity, -Infinity]);
    expect(state.maxHeldSamplePeak).toBe(-Infinity);
    expect(state.numericPeak).toBe('-inf');
    expect(state.peakHoldLevels).toEqual([-Infinity, -Infinity]);
  });

  it('renders RMS bars, absolute peak markers, ticks, and non-color clip indicator according to profile', () => {
    const profile = getMeterProfile('peak-rms-mixing-plus-6');
    act(() => {
      root.render(
        <MeterCanvas
          stripId="track-1"
          width={14}
          height={80}
          profileKey="peak-rms-mixing-plus-6"
        />,
      );
    });

    const canvas = host.querySelector('canvas')!;
    const ctx = canvas.getContext('2d') as unknown as { fillRect: ReturnType<typeof vi.fn> };

    // Feed audio: 0.1 amp (~ -20 dBFS) RMS, 1.0 amp (0 dBFS) peak (clipped)
    meterStore.processMeterFrame(
      {
        sequence: 1,
        channels: [{ csdKey: '0', rms: [0.1, 0.1], peak: [1.0, 1.0] }],
      },
      1000,
    );

    ctx.fillRect.mockClear();

    const cb = rafCallbacks[rafCallbacks.length - 1]!;
    act(() => {
      cb(1050);
    });

    expect(ctx.fillRect).toHaveBeenCalled();
    const calls = ctx.fillRect.mock.calls as Array<[number, number, number, number]>;

    // Expect ticks drawn (calls with h = 1)
    const tickCalls = calls.filter(([, , , h]) => h === 1);
    expect(tickCalls.length).toBeGreaterThan(0);

    // Expect clip box drawn at y = 3 with h = 4
    const clipCalls = calls.filter(([, y, , h]) => y === 3 && h === 4);
    expect(clipCalls.length).toBe(2); // 2 channels

    // Expect non-color overload pip drawn inside clip box (y = 4, h = 2)
    const pipCalls = calls.filter(([, y, , h]) => y === 4 && h === 2);
    expect(pipCalls.length).toBe(2); // 2 channels
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

  describe('Meter Profiles Registry (T011, T012)', () => {
    it('defines exactly the five supported profile keys with required metadata', () => {
      expect(Object.keys(METER_PROFILES).sort()).toEqual([...METER_PROFILE_KEYS].sort());

      for (const key of METER_PROFILE_KEYS) {
        const profile = METER_PROFILES[key];
        expect(profile.key).toBe(key);
        expect(typeof profile.label).toBe('string');
        expect(profile.label.length).toBeGreaterThan(0);
        expect(typeof profile.description).toBe('string');
        expect(profile.barMeasurement).toBe('rms');
        expect(profile.secondaryMeasurement).toBe('peak');
        expect(profile.minimumDb).toBeLessThan(profile.maximumDb);
        expect(profile.majorTicks.length).toBeGreaterThan(0);
        expect(profile.colorStops.length).toBeGreaterThan(0);
      }
    });

    it('resolves fallback profile safely for unknown, missing, or null keys', () => {
      expect(getMeterProfile(null).key).toBe(FALLBACK_METER_PROFILE_KEY);
      expect(getMeterProfile(undefined).key).toBe(FALLBACK_METER_PROFILE_KEY);
      expect(getMeterProfile('non-existent-key').key).toBe(FALLBACK_METER_PROFILE_KEY);
      expect(getMeterProfile('peak-rms-mixing-plus-6').key).toBe('peak-rms-mixing-plus-6');
    });

    describe('peak-rms-linear-plus-6 landmarks and mapping', () => {
      const profile = METER_PROFILES['peak-rms-linear-plus-6'];

      it('maps documented landmarks with exact linear proportionality', () => {
        expect(profile.dbToFraction(-60)).toBe(0);
        expect(profile.dbToFraction(-12)).toBeCloseTo(48 / 66, 5); // ~0.72727
        expect(profile.dbToFraction(-3)).toBeCloseTo(57 / 66, 5); // ~0.86364
        expect(profile.dbToFraction(0)).toBeCloseTo(60 / 66, 5); // ~0.90909
        expect(profile.dbToFraction(6)).toBe(1);
      });

      it('clamps out-of-range values and sanitizes non-finite inputs', () => {
        expect(profile.dbToFraction(-100)).toBe(0);
        expect(profile.dbToFraction(-Infinity)).toBe(0);
        expect(profile.dbToFraction(NaN)).toBe(0);
        expect(profile.dbToFraction(12)).toBe(1);
        expect(profile.dbToFraction(Infinity)).toBe(1);
      });

      it('is strictly monotonic over its range', () => {
        let prev = -1;
        for (let db = -65; db <= 10; db += 1) {
          const frac = profile.dbToFraction(db);
          expect(frac).toBeGreaterThanOrEqual(prev);
          expect(frac).toBeGreaterThanOrEqual(0);
          expect(frac).toBeLessThanOrEqual(1);
          prev = frac;
        }
      });
    });

    describe('peak-rms-mixing-plus-6 landmarks and mixing resolution', () => {
      const profile = METER_PROFILES['peak-rms-mixing-plus-6'];

      it('maps documented Ardour-style deflection landmarks', () => {
        expect(profile.dbToFraction(-70)).toBe(0);
        expect(profile.dbToFraction(-60)).toBeCloseTo(2.5 / 115, 5); // ~0.02174
        expect(profile.dbToFraction(-50)).toBeCloseTo(7.5 / 115, 5); // ~0.06522
        expect(profile.dbToFraction(-40)).toBeCloseTo(15.0 / 115, 5); // ~0.13043
        expect(profile.dbToFraction(-30)).toBeCloseTo(30.0 / 115, 5); // ~0.26087
        expect(profile.dbToFraction(-20)).toBeCloseTo(50.0 / 115, 5); // ~0.43478
        expect(profile.dbToFraction(-18)).toBeCloseTo(55.0 / 115, 5); // ~0.47826
        expect(profile.dbToFraction(-9)).toBeCloseTo(77.5 / 115, 5); // ~0.67391
        expect(profile.dbToFraction(-3)).toBeCloseTo(92.5 / 115, 5); // ~0.80435
        expect(profile.dbToFraction(0)).toBeCloseTo(100.0 / 115, 5); // ~0.86957
        expect(profile.dbToFraction(6)).toBe(1);
      });

      it('allocates approximately 56.5% of display travel to the -20 to +6 dBFS mixing zone', () => {
        const fracMinus20 = profile.dbToFraction(-20);
        const fracPlus6 = profile.dbToFraction(6);
        const mixingRangeSpan = fracPlus6 - fracMinus20;
        expect(mixingRangeSpan).toBeCloseTo(65 / 115, 4); // ~0.5652 (56.5%)
      });

      it('clamps out-of-range values and sanitizes non-finite inputs', () => {
        expect(profile.dbToFraction(-100)).toBe(0);
        expect(profile.dbToFraction(-Infinity)).toBe(0);
        expect(profile.dbToFraction(NaN)).toBe(0);
        expect(profile.dbToFraction(10)).toBe(1);
        expect(profile.dbToFraction(Infinity)).toBe(1);
      });

      it('is strictly monotonic over its range', () => {
        let prev = -1;
        for (let db = -75; db <= 10; db += 1) {
          const frac = profile.dbToFraction(db);
          expect(frac).toBeGreaterThanOrEqual(prev);
          expect(frac).toBeGreaterThanOrEqual(0);
          expect(frac).toBeLessThanOrEqual(1);
          prev = frac;
        }
      });
    });

    describe('K-System profiles (K20, K14, K12)', () => {
      it('aligns displayed 0 reference to -20, -14, and -12 dBFS RMS respectively', () => {
        const k20 = METER_PROFILES['k20-rms-peak'];
        const k14 = METER_PROFILES['k14-rms-peak'];
        const k12 = METER_PROFILES['k12-rms-peak'];

        expect(k20.zeroReferenceDb).toBe(-20);
        expect(k14.zeroReferenceDb).toBe(-14);
        expect(k12.zeroReferenceDb).toBe(-12);

        // Visual position of 0 mark in [0, 1]
        expect(k20.dbToFraction(-20)).toBeCloseTo(40 / 60, 5); // 2/3
        expect(k14.dbToFraction(-14)).toBeCloseTo(46 / 60, 5);
        expect(k12.dbToFraction(-12)).toBeCloseTo(48 / 60, 5); // 0.8

        // Verify major tick labeled "0" is at the reference dBFS level
        const k20ZeroTick = k20.majorTicks.find((t) => t.label === '0');
        expect(k20ZeroTick?.db).toBe(-20);

        const k14ZeroTick = k14.majorTicks.find((t) => t.label === '0');
        expect(k14ZeroTick?.db).toBe(-14);

        const k12ZeroTick = k12.majorTicks.find((t) => t.label === '0');
        expect(k12ZeroTick?.db).toBe(-12);
      });

      it('includes the acoustic calibration disclaimer in descriptions', () => {
        for (const key of ['k20-rms-peak', 'k14-rms-peak', 'k12-rms-peak'] as const) {
          const profile = METER_PROFILES[key];
          expect(profile.description).toContain(K_REFERENCE_DISCLAIMER);
        }
      });

      it('clamps out-of-range values and non-finite inputs monotonically', () => {
        const k20 = METER_PROFILES['k20-rms-peak'];
        expect(k20.dbToFraction(-70)).toBe(0);
        expect(k20.dbToFraction(-Infinity)).toBe(0);
        expect(k20.dbToFraction(NaN)).toBe(0);
        expect(k20.dbToFraction(5)).toBe(1);
        expect(k20.dbToFraction(Infinity)).toBe(1);
      });
    });

    describe('formatPeakDb', () => {
      it('formats finite numbers to one decimal place and silence/non-finite to -inf', () => {
        expect(formatPeakDb(-Infinity)).toBe('-inf');
        expect(formatPeakDb(NaN)).toBe('-inf');
        expect(formatPeakDb(-120)).toBe('-inf');
        expect(formatPeakDb(0)).toBe('0.0');
        expect(formatPeakDb(-0.01)).toBe('0.0');
        expect(formatPeakDb(-2.44)).toBe('-2.4');
        expect(formatPeakDb(-2.46)).toBe('-2.5');
        expect(formatPeakDb(1.23)).toBe('1.2');
        expect(formatPeakDb(6.0)).toBe('6.0');
      });
    });

    describe('replaceable display labels', () => {
      it('accesses profiles strictly through stable keys independent of visual labels', () => {
        const key = 'peak-rms-mixing-plus-6';
        const profile = getMeterProfile(key);
        expect(profile.key).toBe(key);
        // The key is the lookup identity, the label is presentation
        expect(profile.label).toBe('Peak/RMS (+6 dBFS)');
      });
    });
  });
});
