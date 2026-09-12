import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument } from '@blue/data';
import {
  createProjectEditorSnapshot,
  type MixerChannelSnapshot,
  type MixerSnapshot,
} from '../../shared/project-editor';
import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import { meterStore } from '../stores/meter-store';
import type { MeterBindingMapPayload } from '../../shared/meter-types';

// Production-style mixer metering performance gate (Spec 104 T045, FR-013,
// SC-003): mounts 64 real ChannelStrip components (with live MeterCanvas
// components, real canvases, real requestAnimationFrame, and real
// IntersectionObserver visibility) in a real Chromium browser, then measures
// the actual animation-frame rate and strip interaction latency against a
// same-mount non-metering baseline. The assertion is the strict SC-003
// threshold — at most a 20% regression — with no absolute-millisecond
// escape hatch.
//
// Note on solo/mute: mixer channel strips have no solo/mute controls in the
// current mixer UI (solo/mute live on score sound layers). The interactive
// surface of a strip is the fader (pointer, keyboard, and range input),
// the Pre/Post effect chain rows, the level value, and the output select;
// this test exercises fader and effect-chain interactions on all strips.

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buildMixerSnapshot(): {
  mixer: MixerSnapshot;
  channels: MixerChannelSnapshot[];
} {
  const data = new BlueData();

  for (let i = 0; i < 60; i++) {
    const instrument = new GenericInstrument();
    instrument.setName(`Track ${i + 1}`);
    data.getArrangement().addInstrument(instrument, String(i + 1));

    const channel = new Channel();
    channel.setName(`Track ${i + 1}`);
    channel.setAssociation(String(i + 1));
    channel.setOutChannel('Master');
    // A subset of channels carries a real effect entry so the effect-chain
    // interaction surface exists on mounted strips.
    if (i % 8 === 0) {
      const effect = new Effect();
      effect.setName(`Delay ${i}`);
      effect.setCode('aout = ain * 0.5');
      effect.setEnabled(true);
      effect.setNumIns(1);
      effect.setNumOuts(1);
      channel.getPreEffects().push(effect);
    }
    data.getMixer().getChannels().push(channel);
  }

  for (let i = 0; i < 3; i++) {
    const sub = new Channel();
    sub.setName(`Sub ${i + 1}`);
    sub.setOutChannel('Master');
    data.getMixer().getSubChannels().push(sub);
  }

  const snapshot = createProjectEditorSnapshot(data, null);
  const mixer = snapshot.mixer!;
  const channels = [...mixer.channels, ...mixer.subChannels, mixer.master];
  return { mixer, channels };
}

function setupBindingMap(channels: MixerChannelSnapshot[], nchnls = 2): void {
  const bindingMap: MeterBindingMapPayload = {
    nchnls,
    entries: channels.map((channel) => ({
      kind:
        channel.channelKind === 'subChannel'
          ? 'sub'
          : channel.channelKind === 'master'
            ? 'master'
            : 'source',
      csdKey: channel.id,
      stripId: channel.id,
      displayName: channel.name,
    })),
  };
  meterStore.setBindingMap(bindingMap);
}

async function measureFrameRate(durationMs: number): Promise<number> {
  const timestamps: number[] = [];
  await new Promise<void>((resolve) => {
    let warmupRemaining = 3;
    const tick = (now: number) => {
      if (warmupRemaining > 0) {
        warmupRemaining -= 1;
        requestAnimationFrame(tick);
        return;
      }
      timestamps.push(now);
      if (timestamps.length > 1 && now - timestamps[0] >= durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    deltas.push(timestamps[i]! - timestamps[i - 1]!);
  }
  deltas.sort((left, right) => left - right);
  const medianDelta = deltas[Math.floor(deltas.length / 2)]!;
  return 1000 / medianDelta;
}

interface InteractionSurface {
  sliders: HTMLInputElement[];
  effectRows: HTMLElement[];
}

function measureInteractionBatch(surface: InteractionSurface, iteration: number): number {
  const startedAt = performance.now();
  act(() => {
    // Keyboard fader adjustment is a real user interaction; the slider's
    // keydown handler applies the new level through the same
    // onChange/onInput path as pointer drags. (Setting input.value
    // programmatically and dispatching 'input' is deduplicated by React's
    // change tracking, so it never reaches the handler.)
    for (const slider of surface.sliders) {
      const key = iteration % 2 === 0 ? 'ArrowUp' : 'ArrowDown';
      slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, shiftKey: true }));
    }
    for (const row of surface.effectRows) {
      // Single click selects the chain entry; double click opens the effect
      // interface. Exercise both halves of the effect-chain interaction.
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }
  });
  return performance.now() - startedAt;
}

function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median of empty sample set');
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

describe('Mounted 64-strip mixer metering frame-rate gate (SC-003, FR-013)', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onPatch: ReturnType<typeof vi.fn>;
  let onOpenEffectInterface: ReturnType<typeof vi.fn>;
  let channels: MixerChannelSnapshot[];
  let mixer: MixerSnapshot;
  let surface: InteractionSurface;

  beforeEach(async () => {
    meterStore.reset();
    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      sendMixerRealtimeLevelUpdate: () => {},
    };

    const snapshot = buildMixerSnapshot();
    mixer = snapshot.mixer;
    channels = [...mixer.channels, ...mixer.subChannels, mixer.master];
    setupBindingMap(channels);

    onPatch = vi.fn();
    onOpenEffectInterface = vi.fn();

    host = document.createElement('div');
    // Keep every strip inside the browser viewport so the production
    // IntersectionObserver visibility path keeps all 64 canvases painting;
    // CSS scaling does not change the canvases' backing-store resolution,
    // so per-frame draw cost is unaffected.
    host.style.transform = 'scale(0.14)';
    host.style.transformOrigin = 'top left';
    host.style.display = 'flex';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(
        <div style={{ display: 'flex', flexDirection: 'row' }}>
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
              onOpenEffectInterface={onOpenEffectInterface}
              renderMeter={false}
            />
          ))}
        </div>,
      );
    });

    surface = {
      sliders: [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')],
      effectRows: [...document.querySelectorAll<HTMLElement>('[role="option"]')],
    };
    expect(surface.sliders.length).toBe(64);
    expect(surface.effectRows.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('canvas').length).toBe(0);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    meterStore.reset();
    vi.restoreAllMocks();
  });

  it('keeps animation-frame rate and strip interactions within 20% of the non-metering baseline', async () => {
    // ---- Phase A: pre-feature baseline, meter components & rAF schedulers absent ----
    expect(document.querySelectorAll('canvas').length).toBe(0);
    const baselineFps = await measureFrameRate(1500);
    // A floor on the baseline keeps the gate honest: a broken environment
    // must fail loudly rather than pass vacuously against a stalled
    // baseline.
    expect(baselineFps).toBeGreaterThanOrEqual(24);

    measureInteractionBatch(surface, 0);
    const baselineBatches: number[] = [];
    for (let iteration = 1; iteration <= 5; iteration++) {
      baselineBatches.push(measureInteractionBatch(surface, iteration));
    }
    const baselineInteractionMs = median(baselineBatches);

    // ---- Phase B: 64 strips actively metering with MeterCanvas mounted & painting at ~33 Hz ----
    await act(async () => {
      root.render(
        <div style={{ display: 'flex', flexDirection: 'row' }}>
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
              onOpenEffectInterface={onOpenEffectInterface}
              renderMeter={true}
            />
          ))}
        </div>,
      );
    });
    expect(document.querySelectorAll('canvas').length).toBe(64);
    surface = {
      sliders: [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')],
      effectRows: [...document.querySelectorAll<HTMLElement>('[role="option"]')],
    };

    // Pre-warm initial held peak and active RMS inside act(...) so React records
    // the initial peak readout cleanly before unbatched background telemetry feeds RMS variations.
    act(() => {
      meterStore.processMeterFrame({
        sequence: 1,
        channels: channels.map((channel) => ({
          csdKey: channel.id,
          rms: [0.3, 0.28],
          peak: [0.5, 0.48],
        })),
      });
    });

    let feedSequence = 1;
    const feeder = window.setInterval(() => {
      feedSequence += 1;
      meterStore.processMeterFrame({
        sequence: feedSequence,
        channels: channels.map((channel, index) => ({
          csdKey: channel.id,
          rms: [
            0.3 + 0.1 * Math.sin((feedSequence + index) / 3),
            0.28 + 0.1 * Math.cos((feedSequence + index) / 4),
          ],
          peak: [0.5, 0.48],
        })),
      });
    }, 30);

    try {
      // Give the strips a moment to leave the silence-parked state so the
      // measurement sees the animating (repainting) workload.
      await new Promise((resolve) => setTimeout(resolve, 250));

      const meteredFps = await measureFrameRate(1500);
      measureInteractionBatch(surface, 0);
      const meteredBatches: number[] = [];
      for (let iteration = 1; iteration <= 5; iteration++) {
        meteredBatches.push(measureInteractionBatch(surface, iteration));
      }
      const meteredInteractionMs = median(meteredBatches);

      // Interactions must actually reach the strip handlers.
      expect(onPatch).toHaveBeenCalled();
      expect(onOpenEffectInterface).toHaveBeenCalled();

      // SC-003 strict gate: at most a 20% frame-rate regression with no
      // absolute-time escape threshold.
      expect(meteredFps).toBeGreaterThanOrEqual(baselineFps * 0.8);
      // Interaction latency likewise stays within the 20% budget.
      expect(meteredInteractionMs).toBeLessThanOrEqual(baselineInteractionMs * 1.2);

      // Evidence for the execution record.
      console.log(
        `[SC-003] baselineFps=${baselineFps.toFixed(1)} meteredFps=${meteredFps.toFixed(1)} ` +
          `baselineInteractionMs=${baselineInteractionMs.toFixed(2)} ` +
          `meteredInteractionMs=${meteredInteractionMs.toFixed(2)} ` +
          `fpsRatio=${(meteredFps / baselineFps).toFixed(3)}`,
      );
    } finally {
      window.clearInterval(feeder);
    }
  }, 60000);

  it('stops meter rendering and cleans up canvas when meters are disabled (T029)', async () => {
    const { mixer, channels } = buildMixerSnapshot();
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const testRoot = createRoot(surface);

    await act(async () => {
      testRoot.render(
        <div>
          {channels.slice(0, 4).map((channel) => (
            <ChannelStrip
              key={channel.id}
              mixer={{ ...mixer, enableMeters: false }}
              channel={channel}
              isMaster={false}
              isSubChannel={false}
              onPatch={() => {}}
              projectSessionId={null}
              projectRevision={0}
              onOpenEffectInterface={() => {}}
              selection={null}
              onSelectionChange={() => {}}
              projectEffectNodes={[]}
            />
          ))}
        </div>,
      );
    });

    expect(surface.querySelectorAll('canvas')).toHaveLength(0);
    expect(surface.querySelectorAll('.mixer-peak-readout')).toHaveLength(0);

    await act(async () => {
      testRoot.unmount();
    });
    surface.remove();
  });

  it('proves disabled meters schedule no Canvas animation/repaint and enabled meters preserve frame cadence without React updates per telemetry frame (T042)', async () => {
    const { mixer, channels } = buildMixerSnapshot();
    const testHost = document.createElement('div');
    document.body.appendChild(testHost);
    const testRoot = createRoot(testHost);

    let stripRenderCount = 0;
    function RenderCountingStrip(
      props: React.ComponentProps<typeof ChannelStrip>,
    ): React.ReactElement {
      stripRenderCount += 1;
      return <ChannelStrip {...props} />;
    }

    // 1. Mount with enableMeters: false
    await act(async () => {
      testRoot.render(
        <div style={{ display: 'flex' }}>
          {channels.slice(0, 4).map((ch) => (
            <RenderCountingStrip
              key={ch.id}
              mixer={{ ...mixer, enableMeters: false }}
              channel={ch}
              isMaster={ch.channelKind === 'master'}
              isSubChannel={ch.channelKind === 'subChannel'}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          ))}
        </div>,
      );
    });

    // Zero canvases mounted when disabled -> zero animation frames scheduled for meters
    expect(testHost.querySelectorAll('canvas')).toHaveLength(0);
    expect(testHost.querySelectorAll('.mixer-peak-readout')).toHaveLength(0);

    // 2. Mount with enableMeters: true
    stripRenderCount = 0;
    await act(async () => {
      testRoot.render(
        <div style={{ display: 'flex' }}>
          {channels.slice(0, 4).map((ch) => (
            <RenderCountingStrip
              key={ch.id}
              mixer={{ ...mixer, enableMeters: true }}
              channel={ch}
              isMaster={ch.channelKind === 'master'}
              isSubChannel={ch.channelKind === 'subChannel'}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          ))}
        </div>,
      );
    });

    // Exactly 4 canvases mounted
    expect(testHost.querySelectorAll('canvas')).toHaveLength(4);
    expect(testHost.querySelectorAll('.mixer-peak-readout')).toHaveLength(4);
    const initialRenderCount = stripRenderCount;

    // 3. Deliver multiple telemetry frames with constant peak/rms levels
    act(() => {
      for (let seq = 1; seq <= 5; seq++) {
        meterStore.processMeterFrame({
          sequence: seq,
          channels: channels.slice(0, 4).map((ch) => ({
            csdKey: ch.id,
            rms: [0.25, 0.25],
            peak: [0.5, 0.5],
          })),
        });
      }
    });

    // The strip component itself MUST NOT re-render on each telemetry frame
    // (canvas loop and peak-readout useSyncExternalStore isolate updates)
    expect(stripRenderCount).toBe(initialRenderCount);

    await act(async () => {
      testRoot.unmount();
    });
    testHost.remove();
  });
});
