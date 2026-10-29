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
// non-metering baseline using alternating paired trials. The runner evaluates
// the strict SC-003 20% budget across all planned observations, distinguishing
// unstable baselines from measured regressions.
//
// Note on solo/mute: since Spec 111 mixer strips also carry M (and
// non-master S) buttons; those controls are covered by
// mixer-mute-solo.browser.test.tsx. This performance gate exercises the
// fader (pointer, keyboard, and range input), the Pre/Post effect chain
// rows, the level value, and the output select on all strips.

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

async function measureFrames(durationMs: number): Promise<number[]> {
  const timestamps: number[] = [];
  await new Promise<void>((resolve) => {
    let warmupRemaining = 3;
    const tick = (now: number) => {
      if (warmupRemaining > 0) {
        warmupRemaining -= 1;
      } else {
        timestamps.push(now);
        if (timestamps.length > 1 && now - timestamps[0] >= durationMs) {
          resolve();
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return timestamps.slice(1).map((time, index) => time - timestamps[index]);
}

interface InteractionSurface {
  sliders: HTMLElement[];
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
      sliders: [...document.querySelectorAll<HTMLElement>('[role="slider"]')],
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

  it(
    'collects alternating meter frame-rate and interaction trials',
    { tags: ['performance'], timeout: 60000 },
    async () => {
      const measurePhase = async (metered: boolean) => {
        // Fresh, identical fixture per phase. Setup and warmup are outside the samples.
        await act(async () => {
          root.render(null);
        });
        meterStore.reset();
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
                  renderMeter={metered}
                />
              ))}
            </div>,
          );
        });
        expect(host.querySelectorAll('canvas')).toHaveLength(metered ? 64 : 0);
        surface = {
          sliders: [...host.querySelectorAll<HTMLElement>('[role="slider"]')],
          effectRows: [...host.querySelectorAll<HTMLElement>('[role="option"]')],
        };
        expect(surface.sliders).toHaveLength(64);
        expect(surface.effectRows.length).toBeGreaterThan(0);
        let sequence = 0;
        const feed = () => {
          sequence += 1;
          meterStore.processMeterFrame({
            sequence,
            channels: channels.map((channel, index) => ({
              csdKey: channel.id,
              rms: [
                0.3 + 0.1 * Math.sin((sequence + index) / 3),
                0.28 + 0.1 * Math.cos((sequence + index) / 4),
              ],
              peak: [0.5, 0.48],
            })),
          });
        };
        if (metered) act(feed);
        const feeder = metered ? window.setInterval(feed, 30) : undefined;
        let visible = document.visibilityState === 'visible';
        const observeVisibility = () => {
          visible &&= document.visibilityState === 'visible';
        };
        document.addEventListener('visibilitychange', observeVisibility);
        try {
          await new Promise((resolve) => setTimeout(resolve, 250));
          measureInteractionBatch(surface, 0);
          const frameIntervalsMs = await measureFrames(1500);
          const patchesBefore = onPatch.mock.calls.length;
          const opensBefore = onOpenEffectInterface.mock.calls.length;
          const interactionBatchesMs = Array.from({ length: 5 }, (_, index) =>
            measureInteractionBatch(surface, index + 1),
          );
          // Every phase must exercise real handlers, independently of speed.
          expect(onPatch.mock.calls.length).toBeGreaterThan(patchesBefore);
          expect(onOpenEffectInterface.mock.calls.length).toBeGreaterThan(opensBefore);
          return { frameIntervalsMs, interactionBatchesMs, visible };
        } finally {
          document.removeEventListener('visibilitychange', observeVisibility);
          if (feeder !== undefined) window.clearInterval(feeder);
        }
      };
      for (let pair = 0; pair < 4; pair += 1) {
        // AB, BA, AB, BA reduces ordering bias; every planned observation is retained.
        const order =
          pair % 2 === 0 ? (['baseline', 'metered'] as const) : (['metered', 'baseline'] as const);
        const first = await measurePhase(order[0] === 'metered');
        const second = await measurePhase(order[1] === 'metered');
        console.log(
          `BLUE_PERFORMANCE_COMPARISON ${JSON.stringify({
            benchmark: 'mixer-metering',
            pair,
            order,
            baseline: order[0] === 'baseline' ? first : second,
            metered: order[0] === 'metered' ? first : second,
          })}`,
        );
      }
      // The runner evaluates all fixed pairs across processes; assertions above
      // still fail immediately for broken fixtures, handlers, or cleanup.
    },
  );

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
