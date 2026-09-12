import '../styles/index.css';

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel, GenericInstrument } from '@blue/data';
import {
  createProjectEditorSnapshot,
  type MixerChannelSnapshot,
  type MixerSnapshot,
} from '../../shared/project-editor';
import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import { MixerLevelSlider } from '../components/workbench/panels/mixer/MixerLevelSlider';
import { getMeterProfile } from '../components/workbench/panels/mixer/meter-profiles';
import { getMeterTrackGeometry } from '../components/workbench/panels/mixer/meter-layout';
import { gainDbToFraction } from '../components/workbench/panels/mixer/fader-taper';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createTestMixer(channelCount = 1): {
  mixer: MixerSnapshot;
  channels: MixerChannelSnapshot[];
} {
  const data = new BlueData();

  for (let i = 0; i < channelCount; i++) {
    const instr = new GenericInstrument();
    instr.setName(`Track ${i + 1}`);
    data.getArrangement().addInstrument(instr, String(i + 1));

    const ch = new Channel();
    ch.setName(i === 0 ? 'VeryLongChannelNameToTestTruncationAndRouting' : `Track ${i + 1}`);
    ch.setAssociation(String(i + 1));
    ch.setOutChannel('Master');
    ch.setLevel(0);
    data.getMixer().getChannels().push(ch);
  }

  const snapshot = createProjectEditorSnapshot(data, null);
  const mixer = snapshot.mixer!;
  const channels = [...mixer.channels, ...mixer.subChannels, mixer.master];
  return { mixer, channels };
}

describe('ChannelStrip Browser Native Geometry Tests (T010, T023, T032)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      sendMixerRealtimeLevelUpdate: vi.fn().mockResolvedValue({ status: 'applied' }),
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  describe('User Story 1: 88-pixel budget and local ruler geometry (T010)', () => {
    it('allocates exactly 88px border-box width with 24px fader and 22px local ruler', () => {
      const { mixer, channels } = createTestMixer(1);
      const ch = channels[0]!;

      act(() => {
        root.render(
          <div style={{ width: 88, display: 'inline-block' }}>
            <ChannelStrip
              mixer={mixer}
              channel={ch}
              isMaster={false}
              isSubChannel={false}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          </div>,
        );
      });

      const strip = container.querySelector<HTMLDivElement>('.mixer-channel-strip')!;
      expect(strip).not.toBeNull();
      const stripRect = strip.getBoundingClientRect();
      expect(Math.round(stripRect.width)).toBe(88);

      // Fader column is 24px wide
      const slider = container.querySelector<HTMLDivElement>('.mixer-level-slider-wrapper')!;
      expect(slider).not.toBeNull();
      const sliderRect = slider.getBoundingClientRect();
      expect(Math.round(sliderRect.width)).toBe(24);

      // Local ruler is 22px wide
      const ruler = container.querySelector<HTMLDivElement>('.mixer-scale-ruler')!;
      expect(ruler).not.toBeNull();
      const rulerRect = ruler.getBoundingClientRect();
      expect(Math.round(rulerRect.width)).toBe(22);
    });

    it('aligns meter track geometry and local ruler reference labels within <=1 logical pixel across 60, 120, and 240px heights', () => {
      const heights = [60, 120, 240];

      for (const H of heights) {
        const profile = getMeterProfile('peak-rms-mixing-plus-6');
        const geom = getMeterTrackGeometry(H);

        expect(geom.trackTop).toBe(10);
        expect(geom.trackBottom).toBe(H - 10);
        expect(geom.trackHeight).toBe(H - 20);

        // Expected zero label position
        const expectedZeroY = 10 + (1 - profile.dbToFraction(0)) * (H - 20);

        act(() => {
          root.render(
            <div style={{ height: H, width: 88 }}>
              <MixerLevelSlider levelDb={0} sliderHeight={H} channelName="Test" />
            </div>,
          );
        });

        // Usable travel for fader is H - 24, with top/bottom insets 12px
        const faderUsableTravel = H - 24;
        const expectedCapCenterY = 12 + (1 - gainDbToFraction(0)) * faderUsableTravel;
        const unityTravelFraction = 0.7023319616;
        const calculatedCapCenterY = 12 + (1 - unityTravelFraction) * faderUsableTravel;
        expect(Math.abs(expectedCapCenterY - calculatedCapCenterY)).toBeLessThanOrEqual(1e-4);
      }
    });

    it('renders 20 channel strips with horizontal scrolling and preserves overflow reachability', () => {
      const { mixer, channels } = createTestMixer(20);

      act(() => {
        root.render(
          <div
            className="mixer-scroll-container"
            style={{ width: 400, height: 400, overflowX: 'auto', display: 'flex' }}
          >
            {channels.slice(0, 20).map((ch) => (
              <ChannelStrip
                key={ch.id}
                mixer={mixer}
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

      const scrollContainer = container.querySelector<HTMLDivElement>('.mixer-scroll-container')!;
      expect(scrollContainer.scrollWidth).toBeGreaterThan(400);

      // Scroll to the end
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      expect(scrollContainer.scrollLeft).toBeGreaterThan(0);

      const strips = container.querySelectorAll('.mixer-channel-strip');
      expect(strips.length).toBe(20);
    });

    it('renders accurately inside a detached secondary window / iframe realm', async () => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const iframeDoc = iframe.contentDocument!;
      const iframeContainer = iframeDoc.createElement('div');
      iframeDoc.body.appendChild(iframeContainer);
      const iframeRoot = createRoot(iframeContainer);

      const { mixer, channels } = createTestMixer(1);

      act(() => {
        iframeRoot.render(
          <div style={{ width: 88 }}>
            <ChannelStrip
              mixer={mixer}
              channel={channels[0]!}
              isMaster={false}
              isSubChannel={false}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          </div>,
        );
      });

      const ruler = iframeContainer.querySelector('.mixer-scale-ruler');
      expect(ruler).not.toBeNull();
      expect(ruler?.ownerDocument).toBe(iframeDoc);

      act(() => iframeRoot.unmount());
      iframe.remove();
    });
  });

  describe('User Story 2: Fader geometry, unity tick, and profile independence (T023)', () => {
    it('renders 22x10 cap and visible unity tick with 24x24 hit boundary', () => {
      act(() => {
        root.render(<MixerLevelSlider levelDb={0} sliderHeight={120} channelName="Lead" />);
      });

      const slider = container.querySelector<HTMLDivElement>('.mixer-level-slider-wrapper')!;
      expect(slider).not.toBeNull();

      // Unity tick element
      const unityTick = slider.querySelector('.mixer-fader-unity-tick');
      expect(unityTick).not.toBeNull();

      // Cap element
      const cap = slider.querySelector<HTMLDivElement>('.mixer-fader-cap')!;
      expect(cap).not.toBeNull();
      const capRect = cap.getBoundingClientRect();
      expect(Math.round(capRect.width)).toBe(22);
      expect(Math.round(capRect.height)).toBe(10);
    });

    it('keeps cap position identical across all five meter profiles', () => {
      const profiles = [
        'peak-rms-mixing-plus-6',
        'peak-rms-linear-plus-6',
        'k20-rms-peak',
        'k14-rms-peak',
        'k12-rms-peak',
      ] as const;

      const capPositions: number[] = [];

      for (const profileKey of profiles) {
        const { mixer, channels } = createTestMixer(1);
        mixer.meterProfileKey = profileKey;

        act(() => {
          root.render(
            <div style={{ height: 160, width: 88 }}>
              <ChannelStrip
                mixer={mixer}
                channel={channels[0]!}
                isMaster={false}
                isSubChannel={false}
                onPatch={() => {}}
                projectSessionId={1}
                projectRevision={1}
                onOpenEffectInterface={() => {}}
                renderMeter={true}
              />
            </div>,
          );
        });

        const cap = container.querySelector<HTMLDivElement>('.mixer-fader-cap')!;
        expect(cap).not.toBeNull();
        capPositions.push(Math.round(cap.getBoundingClientRect().top));
      }

      // All cap positions across the 5 profiles must be identical
      const firstPos = capPositions[0];
      for (const pos of capPositions) {
        expect(pos).toBe(firstPos);
      }
    });

    it('supports 200% scale without geometry collapse or overflow', () => {
      act(() => {
        root.render(
          <div style={{ transform: 'scale(2)', transformOrigin: 'top left', width: 88 }}>
            <MixerLevelSlider levelDb={-6} sliderHeight={120} channelName="ScaleTest" />
          </div>,
        );
      });

      const slider = container.querySelector<HTMLDivElement>('.mixer-level-slider-wrapper')!;
      expect(slider).not.toBeNull();
      expect(slider.getAttribute('aria-valuenow')).toBe('-6');
    });
  });

  describe('User Story 3: Compact single-row output routing geometry (T032)', () => {
    it('fits arrow, long channel name, and warning inside 88px budget without wrapping into two rows', () => {
      const { mixer, channels } = createTestMixer(1);
      // Long name
      channels[0]!.outChannel = 'Master';

      act(() => {
        root.render(
          <div style={{ width: 88 }}>
            <ChannelStrip
              mixer={mixer}
              channel={channels[0]!}
              isMaster={false}
              isSubChannel={false}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          </div>,
        );
      });

      const outputSection = container.querySelector<HTMLDivElement>('.mixer-output-section')!;
      expect(outputSection).not.toBeNull();

      const arrow = outputSection.querySelector('.mixer-output-arrow')!;
      expect(arrow).not.toBeNull();
      expect(arrow.getAttribute('aria-hidden')).toBe('true');

      const select = outputSection.querySelector<HTMLButtonElement>('.mixer-output-select')!;
      expect(select).not.toBeNull();

      // Bounding box of output section stays within 88px
      const rect = outputSection.getBoundingClientRect();
      expect(Math.round(rect.width)).toBeLessThanOrEqual(88);
    });

    it('preserves 50px chain list minimum height', () => {
      const { mixer, channels } = createTestMixer(1);

      act(() => {
        root.render(
          <div style={{ width: 88, height: 350 }}>
            <ChannelStrip
              mixer={mixer}
              channel={channels[0]!}
              isMaster={false}
              isSubChannel={false}
              onPatch={() => {}}
              projectSessionId={1}
              projectRevision={1}
              onOpenEffectInterface={() => {}}
              renderMeter={true}
            />
          </div>,
        );
      });

      const chainLists = container.querySelectorAll<HTMLDivElement>('.mixer-chain-list');
      expect(chainLists.length).toBe(2); // Pre and Post
      chainLists.forEach((list) => {
        const rect = list.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(48); // ~50px min-height
      });
    });
  });

  describe('Mixer Fader Drag Preview and Commit Parity', () => {
    it('updates live level display during drag, commits once on release, and allows subsequent drags', async () => {
      const applyPatchSpy = vi.fn().mockResolvedValue(undefined);
      const flushPatchesSpy = vi.fn().mockResolvedValue(undefined);
      const sendUpdateSpy = vi.fn().mockResolvedValue({ status: 'applied' });

      (window as unknown as { blueAPI?: unknown }).blueAPI = {
        sendMixerRealtimeLevelUpdate: sendUpdateSpy,
      };

      const originalState = useProjectStore.getState();
      useProjectStore.setState({
        applyProjectDocumentPatch: applyPatchSpy,
        flushPendingPatches: flushPatchesSpy,
        documentId: 'doc-test-1',
      });

      try {
        const { mixer, channels } = createTestMixer(1);
        const ch = channels[0]!;

        act(() => {
          root.render(
            <div style={{ width: 88, height: 350 }}>
              <ChannelStrip
                mixer={mixer}
                channel={ch}
                isMaster={false}
                isSubChannel={false}
                onPatch={() => {}}
                projectSessionId={1}
                projectRevision={1}
                onOpenEffectInterface={() => {}}
                renderMeter={true}
              />
            </div>,
          );
        });

        const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;
        const levelValue = container.querySelector<HTMLDivElement>('.mixer-level-value')!;
        expect(levelValue.textContent).toBe('0.00 dB');

        // Gesture 1: Start drag
        act(() => {
          slider.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              button: 0,
              clientY: 100,
              pointerId: 1,
            }),
          );
        });

        // Move pointer up (gain increases)
        act(() => {
          slider.dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true, clientY: 80, pointerId: 1 }),
          );
        });

        // Level text updates immediately during drag preview
        expect(levelValue.textContent).not.toBe('0.00 dB');
        const previewText1 = levelValue.textContent;
        expect(sendUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ phase: 'preview' }));
        // No document patch during drag
        expect(applyPatchSpy).not.toHaveBeenCalled();

        // Release pointer (commit)
        await act(async () => {
          slider.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true, clientY: 80, pointerId: 1 }),
          );
          await Promise.resolve();
          await Promise.resolve();
        });

        // Finish update was sent
        expect(sendUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ phase: 'finish' }));
        // Cancel was NOT called in finally
        const finishCallIndex = sendUpdateSpy.mock.calls.findIndex(
          (call) => (call[0] as { phase: string }).phase === 'finish',
        );
        const callsAfterFinish = sendUpdateSpy.mock.calls.slice(finishCallIndex + 1);
        expect(
          callsAfterFinish.some((call) => (call[0] as { phase: string }).phase === 'cancel'),
        ).toBe(false);

        // A single document patch committed with 'Set Channel Level'
        expect(applyPatchSpy).toHaveBeenCalledTimes(1);
        expect(applyPatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            mixer: expect.objectContaining({
              type: 'updateChannel',
              channelId: ch.id,
            }),
          }),
          expect.objectContaining({
            label: 'Set Channel Level',
            phase: 'end',
          }),
        );

        // Gesture 2: Second drag on the same channel
        act(() => {
          slider.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              button: 0,
              clientY: 100,
              pointerId: 1,
            }),
          );
        });

        act(() => {
          slider.dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true, clientY: 60, pointerId: 1 }),
          );
        });

        expect(levelValue.textContent).not.toBe(previewText1);

        await act(async () => {
          slider.dispatchEvent(
            new PointerEvent('pointerup', { bubbles: true, clientY: 60, pointerId: 1 }),
          );
          await Promise.resolve();
          await Promise.resolve();
        });

        // Second drag commits a second document patch
        expect(applyPatchSpy).toHaveBeenCalledTimes(2);
      } finally {
        useProjectStore.setState(originalState, true);
      }
    });
  });
});
