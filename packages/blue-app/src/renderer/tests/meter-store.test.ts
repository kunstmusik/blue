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
    expect(state!.clipFlags).toEqual([false, false]);
  });
});
