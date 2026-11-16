// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioPlayerPanel from '../components/workbench/panels/audio-player/AudioPlayerPanel';
import { emitPendingAudioFile } from '../components/workbench/panels/audio-player/audio-player-bus';
import WaveformBody from '../components/workbench/panels/score/bar-renderers/WaveformBody';
import * as waveformCache from '../components/workbench/panels/score/bar-renderers/waveform-cache';

import {
  createScoreViewportScrollStore,
  ScoreViewportScrollProvider,
} from '../components/workbench/panels/score/score-viewport-scroll';

const { clearWaveformCache } = waveformCache;

let root: Root;
let container: HTMLDivElement;
let resize: () => void;
let width = 400;
const decode = vi.fn(async () => ({
  numberOfChannels: 2,
  sampleRate: 48000,
  getChannelData: () => new Float32Array(4800),
}));
const readBytes = vi.fn(async () => new ArrayBuffer(16));

beforeEach(() => {
  decode.mockClear();
  readBytes.mockClear();
  width = 400;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'AudioContext',
    class {
      decodeAudioData = decode;
      close = async () => undefined;
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  window.blueAPI = {
    getAudioFileMetadata: vi.fn(async () => null),
    getAudioFileStat: vi.fn(async () => ({ size: 16, mtime: 1 })),
    readAuthorizedAudioFileBytes: readBytes,
    readAudioFileBytes: readBytes,
  } as unknown as typeof window.blueAPI;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearWaveformCache();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mounted score waveform reset', () => {
  it('rebuilds waveform segments for geometry changes and reuses them when repainting', async () => {
    const buildSegments = vi.spyOn(waveformCache, 'buildWaveformSegments');
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
    };
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const props = {
      waveformKey: 'clip',
      filePath: 'clip.wav',
      pixelSecond: 4,
      pixelsPerBeat: 4,
      width: 100,
      height: 40,
      color: '#fff',
    };
    await act(async () => root.render(<WaveformBody {...props} />));
    expect(buildSegments).toHaveBeenCalledOnce();

    await act(async () => root.render(<WaveformBody {...props} color="#000" />));
    expect(buildSegments).toHaveBeenCalledOnce();
    expect(context.strokeStyle).toBe('#000');
    expect(context.stroke).toHaveBeenCalledTimes(2);

    await act(async () => root.render(<WaveformBody {...props} height={60} />));
    expect(buildSegments).toHaveBeenCalledTimes(2);
  });

  it('bounds looping waveform segments to the score viewport while retaining their clip coordinates', async () => {
    const store = createScoreViewportScrollStore(0, 0);
    store.setContainerWidth(100);
    store.setScrollLeft(1001);
    const canvas = () => container.querySelector<HTMLCanvasElement>('canvas[data-waveform-key]');
    await act(async () =>
      root.render(
        <ScoreViewportScrollProvider store={store}>
          <WaveformBody
            waveformKey="loop"
            filePath="clip.wav"
            pixelSecond={4}
            pixelsPerBeat={4}
            timelineLeftPx={100}
            width={4000}
            height={40}
            color="#fff"
            looping
          />
        </ScoreViewportScrollProvider>,
      ),
    );
    expect(canvas()?.style.left).toBe('901px');
    expect(canvas()?.width).toBe(100);

    await act(async () => store.setScrollLeft(2001));
    expect(canvas()?.style.left).toBe('1901px');
    expect(canvas()?.width).toBe(100);
    expect(decode).toHaveBeenCalledOnce();
  });

  it('reloads after a project reset even when the next file and zoom are identical', async () => {
    const props = {
      waveformKey: 'same',
      filePath: 'same.wav',
      pixelSecond: 4,
      pixelsPerBeat: 4,
      width: 100,
      height: 40,
      color: '#fff',
    };
    await act(async () => root.render(<WaveformBody {...props} />));
    expect(container.querySelectorAll('canvas[data-waveform-key]')).toHaveLength(1);
    await act(async () => clearWaveformCache());
    expect(readBytes).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('canvas[data-waveform-key]')).toHaveLength(1);
  });
});

describe('audio player loading', () => {
  it('reads and decodes once for metadata and peaks, then only redraws on resize', async () => {
    await act(async () => root.render(<AudioPlayerPanel />));
    await act(async () => emitPendingAudioFile('test.wav'));
    await act(async () => {
      width = 800;
      resize();
    });
    await act(async () => {
      width = 250;
      resize();
    });
    expect(readBytes).toHaveBeenCalledOnce();
    expect(decode).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('48');
  });

  it('reloads an explicitly reselected file so overwritten renders get fresh peaks', async () => {
    await act(async () => root.render(<AudioPlayerPanel />));
    await act(async () => emitPendingAudioFile('same.wav'));
    await act(async () => emitPendingAudioFile('same.wav'));
    expect(readBytes).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale decode after switching files and continues the serialized queue', async () => {
    let finish!: (value: Awaited<ReturnType<typeof decode>>) => void;
    decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => root.render(<AudioPlayerPanel />));
    await act(async () => emitPendingAudioFile('old.wav'));
    await act(async () => emitPendingAudioFile('new.wav'));
    expect(readBytes).toHaveBeenCalledOnce();
    await act(async () =>
      finish({ sampleRate: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(8) }),
    );
    expect(readBytes.mock.calls).toHaveLength(2);
    expect(container.textContent).toContain('new.wav');
    expect(container.textContent).toContain('48,000');
    expect(Array.from(container.querySelectorAll('dd'), (node) => node.textContent)).not.toContain(
      '8,000 Hz',
    );
  });

  it('shows header metadata even when waveform decoding fails', async () => {
    vi.mocked(window.blueAPI.getAudioFileMetadata).mockResolvedValueOnce({
      sampleRate: 44100,
      channels: 2,
    } as never);
    decode.mockRejectedValueOnce(new Error('Unsupported codec'));
    await act(async () => root.render(<AudioPlayerPanel />));
    await act(async () => emitPendingAudioFile('unsupported.wav'));
    expect(container.textContent).toContain('44,100');
    expect(container.textContent).toContain('Unsupported codec');
  });
});
