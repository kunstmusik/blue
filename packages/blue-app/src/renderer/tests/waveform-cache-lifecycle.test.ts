import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildWaveformCacheKey,
  clearWaveformCache,
  getWaveformCacheEntry,
  requestWaveform,
  setWaveformCacheEntry,
  subscribeWaveformCacheEntry,
  loadAudioPlayerWaveform,
  type WaveformCacheEntry,
} from '../components/workbench/panels/score/bar-renderers/waveform-cache';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mockAudio(read: (path: string) => Promise<ArrayBuffer | null>) {
  const decode = vi.fn(async () => ({
    numberOfChannels: 1,
    sampleRate: 4,
    getChannelData: () => Float32Array.from([-1, 0, 0.5, 1]),
  }));
  const close = vi.fn(async () => undefined);
  vi.stubGlobal('window', { blueAPI: { readAudioFileBytes: vi.fn(read) } });
  vi.stubGlobal(
    'AudioContext',
    class {
      decodeAudioData = decode;
      close = close;
    },
  );
  return { decode, close };
}

afterEach(() => {
  clearWaveformCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('waveform cache lifecycle', () => {
  it('reuses 200 strongly owned timeline waveforms without rereading them', async () => {
    const readBytes = vi.fn(async () => new ArrayBuffer(16));
    const { decode } = mockAudio(readBytes);
    const files = Array.from({ length: 200 }, (_, index) => `file-${index}.wav`);
    const activeEntries = new Map<string, WaveformCacheEntry>();
    const unsubscribers = files.map((file) => {
      const unsubscribe = subscribeWaveformCacheEntry(buildWaveformCacheKey(file, 4), (entry) =>
        activeEntries.set(file, entry),
      );
      requestWaveform(file, file, 4);
      return unsubscribe;
    });
    await flush();
    expect(
      files.every(
        (file) =>
          getWaveformCacheEntry(file, 4) === activeEntries.get(file) &&
          !activeEntries.get(file)?.loading,
      ),
    ).toBe(true);
    for (const file of files) requestWaveform(file, file, 4);
    await flush();
    expect(readBytes).toHaveBeenCalledTimes(files.length);
    expect(decode).toHaveBeenCalledTimes(files.length);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  it('keeps large actively owned results reusable without a byte budget', () => {
    const channels = [
      { min: new Array<number>(1_100_000).fill(-1), max: new Array<number>(1_100_000).fill(1) },
    ];
    const listener = vi.fn();
    const unsubscribe = subscribeWaveformCacheEntry('oversize', listener);
    const entry = {
      key: 'oversize',
      filePath: 'audio.wav',
      pixelSecond: 100,
      loading: false,
      channels,
    };
    setWaveformCacheEntry(entry);
    expect(getWaveformCacheEntry('oversize') === entry).toBe(true);
    expect(listener).toHaveBeenCalledWith(entry);
    unsubscribe();
  });

  it('does not decode or repopulate the cache after a pending read is cleared', async () => {
    const read = deferred<ArrayBuffer>();
    const { decode } = mockAudio(() => read.promise);
    requestWaveform('old', 'old.wav', 4);
    await flush();
    clearWaveformCache();
    read.resolve(new ArrayBuffer(16));
    await flush();
    expect(decode).not.toHaveBeenCalled();
    expect(getWaveformCacheEntry('old', 4)).toBeUndefined();
  });

  it('ignores an already running decode after reset, including when the key is reused', async () => {
    const decoded = deferred<{
      numberOfChannels: number;
      sampleRate: number;
      getChannelData: () => Float32Array;
    }>();
    const { decode } = mockAudio(async () => new ArrayBuffer(16));
    decode.mockImplementationOnce(() => decoded.promise);
    requestWaveform('same', 'same.wav', 4);
    await flush();
    clearWaveformCache();
    const received = vi.fn();
    const unsubscribe = subscribeWaveformCacheEntry(buildWaveformCacheKey('same', 4), received);
    requestWaveform('same', 'same.wav', 4);
    decoded.resolve({
      sampleRate: 4,
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([-0.25]),
    });
    await flush();
    expect(getWaveformCacheEntry('same', 4)?.channels[0].min).toEqual([-1, 0, 0.5, 1]);
    expect(decode).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('treats a collected weak value as a cache miss and reloads it', async () => {
    const readBytes = vi.fn(async () => new ArrayBuffer(16));
    mockAudio(readBytes);
    let current: WaveformCacheEntry | undefined;
    const unsubscribe = subscribeWaveformCacheEntry(
      buildWaveformCacheKey('collected', 4),
      (entry) => {
        current = entry;
      },
    );
    requestWaveform('collected', 'audio.wav', 4);
    await flush();
    const deref = vi.spyOn(WeakRef.prototype, 'deref').mockReturnValueOnce(undefined);
    expect(getWaveformCacheEntry('collected', 4)).toBeUndefined();
    expect(deref).toHaveBeenCalledOnce();
    requestWaveform('collected', 'audio.wav', 4);
    await flush();
    expect(readBytes).toHaveBeenCalledTimes(2);
    expect(getWaveformCacheEntry('collected', 4)).toBe(current);
    expect(current?.loading).toBe(false);
    unsubscribe();
  });

  it('cleans collected keys without letting delayed cleanup delete replacements', async () => {
    const NativeRegistry = globalThis.FinalizationRegistry;
    let finalize!: (held: unknown) => void;
    vi.stubGlobal(
      'FinalizationRegistry',
      class extends NativeRegistry<unknown> {
        constructor(cleanup: (held: unknown) => void) {
          super(cleanup);
          finalize = cleanup;
        }
      },
    );
    vi.resetModules();
    const isolated =
      await import('../components/workbench/panels/score/bar-renderers/waveform-cache');
    const register = vi.spyOn(FinalizationRegistry.prototype, 'register');
    const unregister = vi.spyOn(FinalizationRegistry.prototype, 'unregister');
    const entry = {
      key: 'same',
      filePath: 'same.wav',
      pixelSecond: 4,
      loading: false,
      channels: [],
    };
    try {
      isolated.setWaveformCacheEntry(entry);
      const firstCleanup = register.mock.calls.at(-1)![1];
      const replacement = { ...entry };
      isolated.setWaveformCacheEntry(replacement);
      const replacementCleanup = register.mock.calls.at(-1)![1];
      finalize(firstCleanup);
      expect(isolated.getWaveformCacheEntry('same')).toBe(replacement);
      isolated.clearWaveformCache();
      const current = { ...entry };
      isolated.setWaveformCacheEntry(current);
      const currentCleanup = register.mock.calls.at(-1)![1];
      finalize(replacementCleanup);
      expect(isolated.getWaveformCacheEntry('same')).toBe(current);
      finalize(currentCleanup);
      expect(isolated.getWaveformCacheEntry('same')).toBeUndefined();
      expect(unregister).toHaveBeenCalledTimes(2);
    } finally {
      isolated.clearWaveformCache();
      vi.resetModules();
    }
  });

  it('cancels unsubscribed queued zoom loads and safely reuses their key', async () => {
    const read = deferred<ArrayBuffer>();
    const readBytes = vi.fn((path: string) =>
      path === 'first.wav' ? read.promise : Promise.resolve(new ArrayBuffer(16)),
    );
    mockAudio(readBytes);
    requestWaveform('first', 'first.wav', 4);
    const key = buildWaveformCacheKey('zoom', 4);
    requestWaveform('zoom', 'zoom.wav', 4);
    const unsubscribe = subscribeWaveformCacheEntry(key, vi.fn());
    await flush();
    unsubscribe();
    expect(getWaveformCacheEntry(key)).toBeUndefined();
    const received = vi.fn();
    const stop = subscribeWaveformCacheEntry(key, received);
    requestWaveform('zoom', 'zoom.wav', 4);
    read.resolve(new ArrayBuffer(16));
    await flush();
    expect(readBytes.mock.calls.map(([path]) => path)).toEqual(['first.wav', 'zoom.wav']);
    expect(getWaveformCacheEntry(key)?.loading).toBe(false);
    stop();
  });

  it('bounds the player overview independently of recording duration', async () => {
    mockAudio(async () => new ArrayBuffer(16));
    window.blueAPI.readAuthorizedAudioFileBytes = vi.fn(async () => new ArrayBuffer(16));
    vi.stubGlobal(
      'AudioContext',
      class {
        async decodeAudioData() {
          return {
            sampleRate: 48000,
            numberOfChannels: 2,
            getChannelData: () => new Float32Array(50_000),
          };
        }
        async close() {}
      },
    );
    const result = await loadAudioPlayerWaveform('long.wav', () => false);
    expect(result?.channels).toHaveLength(2);
    expect(result!.channels[0].min.length).toBeLessThanOrEqual(2048);
    expect(result!.channels[1].max.length).toBeLessThanOrEqual(2048);
  });

  it('serializes reads/decodes and drops queued work from a cleared project', async () => {
    const read = deferred<ArrayBuffer>();
    const readBytes = vi.fn((path: string) =>
      path === 'first.wav' ? read.promise : Promise.resolve(new ArrayBuffer(16)),
    );
    const { decode, close } = mockAudio(readBytes);
    requestWaveform('first', 'first.wav', 4);
    requestWaveform('queued', 'queued.wav', 4);
    await flush();
    const callsBeforeClear = readBytes.mock.calls.length;
    clearWaveformCache();
    const newKey = buildWaveformCacheKey('current', 4);
    const listener = vi.fn();
    subscribeWaveformCacheEntry(newKey, listener);
    requestWaveform('current', 'current.wav', 4);
    read.resolve(new ArrayBuffer(16));
    await flush();
    expect(callsBeforeClear).toBe(1);
    expect(readBytes.mock.calls.map(([path]) => path)).toEqual(['first.wav', 'current.wav']);
    expect(decode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalled();
    expect(getWaveformCacheEntry('current', 4)?.loading).toBe(false);
  });
});
