import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import WaveformBody from '../components/workbench/panels/score/bar-renderers/WaveformBody';
import {
  buildWaveformCacheKey,
  clearWaveformCache,
  setWaveformCacheEntry,
} from '../components/workbench/panels/score/bar-renderers/waveform-cache';
import {
  createScoreViewportScrollStore,
  ScoreViewportScrollProvider,
} from '../components/workbench/panels/score/score-viewport-scroll';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it('paints the waveform in a viewport-sized canvas and repaints after scrolling', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const viewport = createScoreViewportScrollStore(0, 0);
  viewport.setContainerWidth(100);
  viewport.setScrollLeft(1001);
  setWaveformCacheEntry({
    key: buildWaveformCacheKey('wave', 4),
    filePath: 'wave.wav',
    pixelSecond: 4,
    loading: false,
    channels: [{ min: [-1], max: [1] }],
  });
  try {
    await act(async () =>
      root.render(
        <ScoreViewportScrollProvider store={viewport}>
          <WaveformBody
            waveformKey="wave"
            filePath="wave.wav"
            pixelSecond={4}
            pixelsPerBeat={4}
            timelineLeftPx={100}
            width={4000}
            height={40}
            color="#ff0000"
            looping
          />
        </ScoreViewportScrollProvider>,
      ),
    );
    const canvas = host.querySelector('canvas')!;
    const context = canvas.getContext('2d')!;
    const pixel = () => [...context.getImageData(0, Math.floor(canvas.height / 2), 1, 1).data];
    expect(canvas.style.left).toBe('901px');
    expect(canvas.style.width).toBe('100px');
    expect(pixel()).toEqual([255, 0, 0, 255]);
    await act(async () => viewport.setScrollLeft(2001));
    expect(canvas.style.left).toBe('1901px');
    expect(pixel()).toEqual([255, 0, 0, 255]);
  } finally {
    await act(async () => root.unmount());
    clearWaveformCache();
    host.remove();
  }
});
