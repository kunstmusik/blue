import { describe, expect, it, beforeEach } from 'vitest';
import { MeterStore } from '../stores/meter-store';
import type { MeterBindingMapPayload, MeterFramePayload } from '../../shared/meter-types';

describe('MeterStore', () => {
  let store: MeterStore;

  const sampleBindingMap: MeterBindingMapPayload = {
    nchnls: 2,
    entries: [
      { kind: 'source', csdKey: '0', stripId: 'track-1', displayName: 'Track 1' },
      { kind: 'sub', csdKey: 'sub_Reverb', stripId: 'sub-reverb', displayName: 'Reverb' },
      { kind: 'master', csdKey: 'sub_Master', stripId: 'master', displayName: 'Master' },
    ],
  };

  beforeEach(() => {
    store = new MeterStore();
    store.setBindingMap(sampleBindingMap);
  });

  it('initializes strips to silence floor based on binding map', () => {
    const state = store.getStripState('track-1');
    expect(state).toBeDefined();
    expect(state!.barLevels).toEqual([-Infinity, -Infinity]);
    expect(state!.peakHoldLevels).toEqual([-Infinity, -Infinity]);
    expect(state!.clipFlags).toEqual([false, false]);
  });

  it('drops stale frames where sequence is less than or equal to last seen', () => {
    const frame1: MeterFramePayload = {
      sequence: 5,
      channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.8, 0.8] }],
    };
    store.processMeterFrame(frame1, 1000);

    const stateAfter1 = store.getStripState('track-1');
    expect(stateAfter1!.barLevels[0]).toBeGreaterThan(-60);

    // Frame with lower or equal sequence
    const frameOld: MeterFramePayload = {
      sequence: 4,
      channels: [{ csdKey: '0', rms: [0.0, 0.0], peak: [0.0, 0.0] }],
    };
    store.processMeterFrame(frameOld, 1050);

    // Should NOT have changed to 0
    const stateAfterOld = store.getStripState('track-1');
    expect(stateAfterOld!.barLevels[0]).toBe(stateAfter1!.barLevels[0]);
  });

  it('performs instantaneous attack when signal rises', () => {
    const frame: MeterFramePayload = {
      sequence: 1,
      channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.7, 0.7] }],
    };
    store.processMeterFrame(frame, 1000);
    store.update(1000);

    const state = store.getStripState('track-1');
    const expectedDb = 20 * Math.log10(0.5);
    expect(state!.barLevels[0]).toBeCloseTo(expectedDb, 1);
    expect(state!.peakHoldLevels[0]).toBeCloseTo(20 * Math.log10(0.7), 1);
  });

  it('decays bar levels over time when signal drops', () => {
    // Attack to -6 dBFS (approx amp 0.5)
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.5, 0.5] }] },
      1000,
    );
    store.update(1000);

    const initialDb = store.getStripState('track-1')!.barLevels[0];

    // Silence frame
    store.processMeterFrame(
      { sequence: 2, channels: [{ csdKey: '0', rms: [0.0, 0.0], peak: [0.0, 0.0] }] },
      1000,
    );

    // Advance 0.5s -> at 20 dB/s decay, level should drop by ~10 dB
    store.update(1500);

    const decayedDb = store.getStripState('track-1')!.barLevels[0];
    expect(decayedDb).toBeCloseTo(initialDb - 10, 0);
  });

  it('holds peak for 1.0 second before decaying', () => {
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.9, 0.9] }] },
      1000,
    );
    store.update(1000);

    const peakDb = store.getStripState('track-1')!.peakHoldLevels[0];

    // Frame with lower level
    store.processMeterFrame(
      { sequence: 2, channels: [{ csdKey: '0', rms: [0.1, 0.1], peak: [0.2, 0.2] }] },
      1000,
    );

    // Advance 500ms (timer is 1000ms) - peak hold should still equal original peak
    store.update(1500);
    expect(store.getStripState('track-1')!.peakHoldLevels[0]).toBe(peakDb);

    // Advance to 2500ms (1.5s after peak) - peak hold should have decayed by ~10 dB (0.5s * 20 dB/s)
    store.update(2500);
    expect(store.getStripState('track-1')!.peakHoldLevels[0]).toBeLessThan(peakDb);
  });

  it('latches clip indicator for ~2.0s when peak exceeds 1.0 and then clears', () => {
    // Peak >= 1.0 (>= 0 dBFS)
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [0.9, 0.9], peak: [1.05, 1.05] }] },
      1000,
    );
    store.update(1000);

    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(true);

    // Sub-clip audio continues
    store.processMeterFrame(
      { sequence: 2, channels: [{ csdKey: '0', rms: [0.1, 0.1], peak: [0.2, 0.2] }] },
      1500,
    );
    store.update(1500);
    // Still latched at 500ms
    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(true);

    // At 3100ms (2.1s elapsed), clip should auto-clear
    store.update(3100);
    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(false);
  });

  it('clears clip indicator immediately on manual clearClip call', () => {
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [0.9, 0.9], peak: [1.2, 1.2] }] },
      1000,
    );
    store.update(1000);
    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(true);

    store.clearClip('track-1');
    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(false);
  });

  it('sanitizes NaN and Infinity to 0.0 without errors', () => {
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [NaN, Infinity], peak: [-Infinity, NaN] }] },
      1000,
    );
    store.update(1000);

    const state = store.getStripState('track-1');
    expect(state).toBeDefined();
    expect(Number.isFinite(state!.barLevels[0]) || state!.barLevels[0] === -Infinity).toBe(true);
    expect(state!.clipFlags[0]).toBe(false);
  });

  it('resets all meters immediately on reset()', () => {
    store.processMeterFrame(
      { sequence: 1, channels: [{ csdKey: '0', rms: [0.8, 0.8], peak: [1.5, 1.5] }] },
      1000,
    );
    store.update(1000);

    expect(store.getStripState('track-1')!.clipFlags[0]).toBe(true);

    store.reset();

    const state = store.getStripState('track-1');
    expect(state!.barLevels).toEqual([-Infinity, -Infinity]);
    expect(state!.peakHoldLevels).toEqual([-Infinity, -Infinity]);
    expect(state!.heldSamplePeaks).toEqual([-Infinity, -Infinity]);
    expect(state!.maxHeldSamplePeak).toBe(-Infinity);
    expect(state!.numericPeak).toBe('-inf');
    expect(state!.clipFlags).toEqual([false, false]);
  });

  describe('Held sample peak and numeric readout (T013, T016)', () => {
    it('initializes held sample peaks to -Infinity and numericPeak to -inf', () => {
      const state = store.getStripState('track-1');
      expect(state!.heldSamplePeaks).toEqual([-Infinity, -Infinity]);
      expect(state!.maxHeldSamplePeak).toBe(-Infinity);
      expect(state!.numericPeak).toBe('-inf');
      expect(store.getMaxHeldPeak('track-1')).toBe(-Infinity);
      expect(store.getNumericPeak('track-1')).toBe('-inf');
    });

    it('tracks maximum held sample peak across multiple outputs indefinitely until cleared', () => {
      // Channel 0: 0.5 (-6.02 dBFS), Channel 1: 0.8 (-1.94 dBFS)
      store.processMeterFrame(
        {
          sequence: 1,
          channels: [{ csdKey: '0', rms: [0.3, 0.4], peak: [0.5, 0.8] }],
        },
        1000,
      );

      const state1 = store.getStripState('track-1')!;
      expect(state1.heldSamplePeaks[0]).toBeCloseTo(20 * Math.log10(0.5), 1);
      expect(state1.heldSamplePeaks[1]).toBeCloseTo(20 * Math.log10(0.8), 1);
      expect(state1.maxHeldSamplePeak).toBeCloseTo(20 * Math.log10(0.8), 1);
      expect(state1.numericPeak).toBe('-1.9');
      expect(store.getNumericPeak('track-1')).toBe('-1.9');

      // Subsequent frame with quieter signal should NOT lower the held peak
      store.processMeterFrame(
        {
          sequence: 2,
          channels: [{ csdKey: '0', rms: [0.05, 0.05], peak: [0.1, 0.1] }],
        },
        1500,
      );
      store.update(2500); // 1.0s later; decaying markers decay, but heldSamplePeaks stay

      const state2 = store.getStripState('track-1')!;
      expect(state2.maxHeldSamplePeak).toBeCloseTo(20 * Math.log10(0.8), 1);
      expect(state2.numericPeak).toBe('-1.9');

      // Higher peak on channel 0 (1.0 = 0 dBFS) raises the held peak
      store.processMeterFrame(
        {
          sequence: 3,
          channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [1.0, 0.5] }],
        },
        3000,
      );
      const state3 = store.getStripState('track-1')!;
      expect(state3.heldSamplePeaks[0]).toBeCloseTo(0.0, 1);
      expect(state3.maxHeldSamplePeak).toBeCloseTo(0.0, 1);
      expect(state3.numericPeak).toBe('0.0');
    });

    it('atomically clears all held peaks, markers, and clips for ONLY the targeted strip', () => {
      // Put both track-1 and master into active and clipped states
      store.processMeterFrame(
        {
          sequence: 1,
          channels: [
            { csdKey: '0', rms: [0.5, 0.5], peak: [1.2, 1.2] },
            { csdKey: 'sub_Master', rms: [0.6, 0.6], peak: [1.5, 1.5] },
          ],
        },
        1000,
      );

      expect(store.getStripState('track-1')!.clipFlags[0]).toBe(true);
      expect(store.getStripState('master')!.clipFlags[0]).toBe(true);
      expect(store.getStripState('track-1')!.numericPeak).not.toBe('-inf');
      expect(store.getStripState('master')!.numericPeak).not.toBe('-inf');

      // Clear ONLY track-1
      store.clearStrip('track-1');

      const trackState = store.getStripState('track-1')!;
      expect(trackState.heldSamplePeaks).toEqual([-Infinity, -Infinity]);
      expect(trackState.maxHeldSamplePeak).toBe(-Infinity);
      expect(trackState.numericPeak).toBe('-inf');
      expect(trackState.peakHoldLevels).toEqual([-Infinity, -Infinity]);
      expect(trackState.clipFlags).toEqual([false, false]);

      // master must remain UNCHANGED
      const masterState = store.getStripState('master')!;
      expect(masterState.clipFlags[0]).toBe(true);
      expect(masterState.numericPeak).not.toBe('-inf');
      expect(masterState.maxHeldSamplePeak).toBeGreaterThan(0);
    });

    it('sanitizes non-finite telemetry (NaN, Infinity, negative) and keeps numericPeak at -inf', () => {
      store.processMeterFrame(
        {
          sequence: 1,
          channels: [{ csdKey: '0', rms: [NaN, -1], peak: [Infinity, NaN] }],
        },
        1000,
      );

      const state = store.getStripState('track-1')!;
      expect(state.heldSamplePeaks).toEqual([-Infinity, -Infinity]);
      expect(state.maxHeldSamplePeak).toBe(-Infinity);
      expect(state.numericPeak).toBe('-inf');
    });

    it('clears all strips on clearAll without reviving stale peaks', () => {
      store.processMeterFrame(
        {
          sequence: 1,
          channels: [
            { csdKey: '0', rms: [0.5, 0.5], peak: [1.1, 1.1] },
            { csdKey: 'sub_Master', rms: [0.6, 0.6], peak: [1.2, 1.2] },
          ],
        },
        1000,
      );

      store.clearAll();

      expect(store.getStripState('track-1')!.numericPeak).toBe('-inf');
      expect(store.getStripState('master')!.numericPeak).toBe('-inf');
      expect(store.getStripState('track-1')!.clipFlags).toEqual([false, false]);
      expect(store.getStripState('master')!.clipFlags).toEqual([false, false]);
    });
  });
});
