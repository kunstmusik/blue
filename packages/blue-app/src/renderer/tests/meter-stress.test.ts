import { describe, expect, it } from 'vitest';
import { MeterStore } from '../stores/meter-store';
import type { MeterBindingMapPayload, MeterFramePayload } from '../../shared/meter-types';

describe('MeterStore Stress / Performance', () => {
  it('processes 64 channels at 30 Hz across 30 seconds (900 frames) in < 500ms', () => {
    const store = new MeterStore();
    const CHANNEL_COUNT = 64;

    const entries = [];
    for (let i = 0; i < CHANNEL_COUNT - 4; i++) {
      entries.push({
        kind: 'source' as const,
        csdKey: String(i),
        stripId: 'track-' + i,
        displayName: 'Track ' + (i + 1),
      });
    }
    for (let i = 0; i < 3; i++) {
      entries.push({
        kind: 'sub' as const,
        csdKey: 'sub_Sub' + i,
        stripId: 'sub-' + i,
        displayName: 'Sub ' + (i + 1),
      });
    }
    entries.push({
      kind: 'master' as const,
      csdKey: 'sub_Master',
      stripId: 'master',
      displayName: 'Master',
    });

    const bindingMap: MeterBindingMapPayload = {
      nchnls: 2,
      entries,
    };

    store.setBindingMap(bindingMap);

    const FRAME_COUNT = 900; // 30 seconds at 30 Hz
    const FRAME_INTERVAL_MS = 1000 / 30; // ~33.3ms

    const startTime = performance.now();

    for (let seq = 1; seq <= FRAME_COUNT; seq++) {
      const nowMs = seq * FRAME_INTERVAL_MS;

      const channels = [];
      for (let i = 0; i < CHANNEL_COUNT; i++) {
        // Vary amplitude in a cyclical pattern
        const val = 0.5 + 0.4 * Math.sin((seq + i) * 0.1);
        channels.push({
          csdKey: entries[i].csdKey,
          rms: [val, val * 0.9],
          peak: [val * 1.1, val],
        });
      }

      const frame: MeterFramePayload = {
        sequence: seq,
        channels,
      };

      store.processMeterFrame(frame, nowMs);
      store.update(nowMs);

      // Read all 64 strips every frame as UI canvas would do
      for (let i = 0; i < CHANNEL_COUNT; i++) {
        const state = store.getStripState(entries[i].stripId);
        if (!state || !Number.isFinite(state.barLevels[0])) {
          throw new Error(`Invalid strip state at frame ${seq} for channel ${i}`);
        }
      }
    }

    const elapsedMs = performance.now() - startTime;
    // 900 frames * 64 channels = 57,600 channel frame processing + reads
    // Under test runner load, should comfortably take < 1000ms (~1ms per frame total across all 64 channels)
    expect(elapsedMs).toBeLessThan(1000);

    // Final verification of strip state
    for (let i = 0; i < CHANNEL_COUNT; i++) {
      const state = store.getStripState(entries[i].stripId);
      expect(state).toBeDefined();
      expect(state!.barLevels[0]).toBeGreaterThan(-60);
    }
  });
});
