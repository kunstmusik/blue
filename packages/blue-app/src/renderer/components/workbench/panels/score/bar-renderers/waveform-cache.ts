import { parseAudioFileMetadata } from '@blue/data';

export interface WaveformCacheEntry {
  key: string;
  filePath: string;
  pixelSecond: number;
  loading: boolean;
  error?: string;
  channels: Array<{
    min: number[];
    max: number[];
  }>;
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    data[offset] * 0x1000000 +
    data[offset + 1] * 0x10000 +
    data[offset + 2] * 0x100 +
    data[offset + 3]
  );
}

function fourCC(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

/** Summarize uncompressed AIFF PCM without relying on Chromium codec support. */
export function summarizeAiffPcmBytes(
  data: Uint8Array,
  pixelSecond: number,
  maxBuckets = Infinity,
): WaveformCacheEntry['channels'] | null {
  if (data.length < 38 || fourCC(data, 0) !== 'FORM' || fourCC(data, 8) !== 'AIFF') {
    return null;
  }

  const metadata = parseAudioFileMetadata(data);
  const bytesPerSample = metadata.bitsPerSample / 8;
  if (![1, 2, 3, 4].includes(bytesPerSample)) return null;

  let sampleDataOffset = -1;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkSize = readUint32BE(data, offset + 4);
    const chunkStart = offset + 8;
    if (fourCC(data, offset) === 'SSND' && chunkStart + 8 <= data.length) {
      sampleDataOffset = chunkStart + 8 + readUint32BE(data, chunkStart);
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  if (sampleDataOffset < 0 || sampleDataOffset >= data.length) return null;

  const frameSize = metadata.channels * bytesPerSample;
  const frameCount = Math.min(
    metadata.frameCount,
    Math.floor((data.length - sampleDataOffset) / frameSize),
  );
  const samplesPerBucket = Math.max(
    1,
    Math.floor(metadata.sampleRate / normalizePixelSecond(pixelSecond)),
    Math.ceil(frameCount / maxBuckets),
  );
  const bucketCount = Math.max(1, Math.ceil(frameCount / samplesPerBucket));
  const channels = Array.from({ length: metadata.channels }, () => ({
    min: new Array<number>(bucketCount).fill(1),
    max: new Array<number>(bucketCount).fill(-1),
  }));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let frame = 0; frame < frameCount; frame++) {
    const bucket = Math.floor(frame / samplesPerBucket);
    for (let channel = 0; channel < metadata.channels; channel++) {
      const sampleOffset =
        sampleDataOffset + (frame * metadata.channels + channel) * bytesPerSample;
      let sample: number;
      if (bytesPerSample === 1) {
        const value = data[sampleOffset];
        sample = (value >= 0x80 ? value - 0x100 : value) / 0x80;
      } else if (bytesPerSample === 2) {
        sample = view.getInt16(sampleOffset, false) / 0x8000;
      } else if (bytesPerSample === 3) {
        const raw =
          data[sampleOffset] * 0x10000 + data[sampleOffset + 1] * 0x100 + data[sampleOffset + 2];
        sample = (raw >= 0x800000 ? raw - 0x1000000 : raw) / 0x800000;
      } else {
        sample = view.getInt32(sampleOffset, false) / 0x80000000;
      }
      channels[channel].min[bucket] = Math.min(channels[channel].min[bucket], sample);
      channels[channel].max[bucket] = Math.max(channels[channel].max[bucket], sample);
    }
  }

  return channels;
}

const waveformCache = new Map<string, WeakRef<WaveformCacheEntry>>();
const waveformFinalizer = new FinalizationRegistry<{
  key: string;
  reference: WeakRef<WaveformCacheEntry>;
}>(({ key, reference }) => {
  // An older result may be finalized after the same key has been reloaded.
  if (waveformCache.get(key) === reference) waveformCache.delete(key);
});
const waveformListeners = new Map<string, Set<(entry: WaveformCacheEntry) => void>>();
const pendingWaveformLoads = new Map<string, WaveformCacheEntry>();
const cancelledLoads = new WeakSet<WaveformCacheEntry>();
const cacheResetListeners = new Set<() => void>();
export const AUDIO_PLAYER_MAX_BUCKETS = 2048;
let cacheGeneration = 0;
let loadQueue: Promise<void> = Promise.resolve();

function deleteWaveformCacheEntry(key: string): void {
  const reference = waveformCache.get(key);
  if (reference) waveformFinalizer.unregister(reference);
  waveformCache.delete(key);
}

function normalizePixelSecond(pixelSecond: number): number {
  if (!Number.isFinite(pixelSecond) || pixelSecond <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(pixelSecond * 1000) / 1000);
}

function emitWaveformUpdate(entry: WaveformCacheEntry): void {
  const listeners = waveformListeners.get(entry.key);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(entry);
  }
}

function getAudioContext(): AudioContext | null {
  const AudioContextCtor =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }
  return new AudioContextCtor();
}

function normalizeAudioBytes(bytes: unknown): ArrayBuffer | null {
  if (!bytes) {
    return null;
  }

  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }

  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice().buffer;
  }

  if (Array.isArray(bytes)) {
    return Uint8Array.from(bytes).buffer;
  }

  return null;
}

export function buildWaveformCacheKey(key: string, pixelSecond: number): string {
  return `${key}@${normalizePixelSecond(pixelSecond)}`;
}

export function getWaveformCacheEntry(
  key: string,
  pixelSecond?: number,
): WaveformCacheEntry | undefined {
  const cacheKey = pixelSecond === undefined ? key : buildWaveformCacheKey(key, pixelSecond);
  const reference = waveformCache.get(cacheKey);
  const entry = reference?.deref();
  if (reference && !entry) deleteWaveformCacheEntry(cacheKey);
  return entry;
}

export function setWaveformCacheEntry(entry: WaveformCacheEntry): void {
  deleteWaveformCacheEntry(entry.key);
  const reference = new WeakRef(entry);
  waveformCache.set(entry.key, reference);
  waveformFinalizer.register(entry, { key: entry.key, reference }, reference);
  // Mounted views strongly own their current result; the reuse cache does not.
  emitWaveformUpdate(entry);
}

export function getWaveformCacheGeneration(): number {
  return cacheGeneration;
}

export function subscribeWaveformCacheReset(listener: () => void): () => void {
  cacheResetListeners.add(listener);
  return () => {
    cacheResetListeners.delete(listener);
  };
}

export function clearWaveformCache(): void {
  cacheGeneration += 1;
  for (const reference of waveformCache.values()) waveformFinalizer.unregister(reference);
  waveformCache.clear();
  waveformListeners.clear();
  pendingWaveformLoads.clear();
  for (const listener of cacheResetListeners) listener();
}

export function subscribeWaveformCacheEntry(
  key: string,
  listener: (entry: WaveformCacheEntry) => void,
): () => void {
  const listeners = waveformListeners.get(key) ?? new Set();
  listeners.add(listener);
  waveformListeners.set(key, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && waveformListeners.get(key) === listeners) {
      waveformListeners.delete(key);
      const pending = pendingWaveformLoads.get(key);
      if (pending) {
        cancelledLoads.add(pending);
        pendingWaveformLoads.delete(key);
        if (getWaveformCacheEntry(key) === pending) deleteWaveformCacheEntry(key);
      }
    }
  };
}

export function summarizeWaveformChannels(
  channelData: Float32Array[],
  sampleRate: number,
  pixelSecond: number,
  maxBuckets = Infinity,
): WaveformCacheEntry['channels'] {
  const normalizedPixelSecond = normalizePixelSecond(pixelSecond);

  return channelData.map((samples) => {
    const samplesPerBucket = Math.max(
      1,
      Math.floor(sampleRate / normalizedPixelSecond),
      Math.ceil(samples.length / maxBuckets),
    );
    const bucketCount = Math.max(1, Math.ceil(samples.length / samplesPerBucket));
    const min = new Array<number>(bucketCount).fill(0);
    const max = new Array<number>(bucketCount).fill(0);

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const start = bucketIndex * samplesPerBucket;
      const end = Math.min(samples.length, start + samplesPerBucket);
      let bucketMin = 1;
      let bucketMax = -1;

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        const sample = samples[sampleIndex] ?? 0;
        if (sample < bucketMin) bucketMin = sample;
        if (sample > bucketMax) bucketMax = sample;
      }

      if (end <= start) {
        bucketMin = 0;
        bucketMax = 0;
      }

      min[bucketIndex] = bucketMin;
      max[bucketIndex] = bucketMax;
    }

    return { min, max };
  });
}

export interface AudioWaveformOverview {
  channels: WaveformCacheEntry['channels'];
  sampleRate: number;
  numberOfChannels: number;
}

function readWaveformData(
  filePath: string,
  pixelSecond: number,
  isCancelled: () => boolean,
  authorized = false,
  maxBuckets = Infinity,
): Promise<AudioWaveformOverview | null> {
  // Only the running job owns file bytes/decoded PCM. Queued jobs hold paths and callbacks.
  const result = loadQueue.then(async () => {
    if (isCancelled()) return null;
    const bytes = normalizeAudioBytes(
      await (authorized
        ? window.blueAPI.readAuthorizedAudioFileBytes(filePath)
        : window.blueAPI.readAudioFileBytes(filePath)),
    );
    if (isCancelled()) return null;
    if (!bytes) throw new Error('Unable to read audio file.');

    let metadata = null;
    try {
      metadata = parseAudioFileMetadata(new Uint8Array(bytes));
    } catch {
      /* Chromium handles other codecs. */
    }
    const aiffChannels = summarizeAiffPcmBytes(new Uint8Array(bytes), pixelSecond, maxBuckets);
    if (aiffChannels && metadata) {
      return {
        channels: aiffChannels,
        sampleRate: metadata.sampleRate,
        numberOfChannels: metadata.channels,
      };
    }

    const context = getAudioContext();
    if (!context) throw new Error('AudioContext is unavailable.');
    try {
      // The IPC result belongs to this job; decodeAudioData may detach it without a copy.
      const decoded = await context.decodeAudioData(bytes);
      if (isCancelled()) return null;
      return {
        channels: summarizeWaveformChannels(
          Array.from({ length: decoded.numberOfChannels }, (_, index) =>
            decoded.getChannelData(index),
          ),
          decoded.sampleRate,
          pixelSecond,
          maxBuckets,
        ),
        sampleRate: metadata?.sampleRate ?? decoded.sampleRate,
        numberOfChannels: decoded.numberOfChannels,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  });
  loadQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function loadAudioPlayerWaveform(
  filePath: string,
  isCancelled: () => boolean,
): Promise<AudioWaveformOverview | null> {
  return readWaveformData(
    filePath,
    Number.MAX_SAFE_INTEGER,
    isCancelled,
    true,
    AUDIO_PLAYER_MAX_BUCKETS,
  );
}

export function requestWaveform(
  key: string,
  filePath: string,
  pixelSecond: number,
): WaveformCacheEntry {
  const cacheKey = buildWaveformCacheKey(key, pixelSecond);
  const existing = getWaveformCacheEntry(cacheKey) ?? pendingWaveformLoads.get(cacheKey);
  if (existing) return existing;

  const entry: WaveformCacheEntry = {
    key: cacheKey,
    filePath,
    pixelSecond: normalizePixelSecond(pixelSecond),
    loading: true,
    channels: [],
  };
  const generation = cacheGeneration;
  const isCancelled = () => generation !== cacheGeneration || cancelledLoads.has(entry);
  pendingWaveformLoads.set(cacheKey, entry);
  setWaveformCacheEntry(entry);
  void readWaveformData(filePath, pixelSecond, isCancelled)
    .then((result) => {
      if (result && !isCancelled())
        setWaveformCacheEntry({ ...entry, loading: false, channels: result.channels });
    })
    .catch((error: unknown) => {
      if (!isCancelled())
        setWaveformCacheEntry({
          ...entry,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
    })
    .finally(() => {
      if (pendingWaveformLoads.get(cacheKey) === entry) pendingWaveformLoads.delete(cacheKey);
    });
  return entry;
}

export function buildWaveformPathData(
  entry: WaveformCacheEntry,
  options: {
    width: number;
    height: number;
    pixelsPerBeat: number;
    startOffsetBeats?: number;
    looping?: boolean;
  },
): string[] {
  const width = Math.max(0, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const pixelsPerBeat = Math.max(1, options.pixelsPerBeat);
  const startOffsetBeats = Math.max(0, options.startOffsetBeats ?? 0);
  const looping = options.looping === true;

  if (width <= 0 || entry.channels.length === 0) {
    return [];
  }

  // Java Blue gives each channel its own equal-height band. Keep the integer
  // geometry used by AudioWaveformUI so mono and multichannel files render at
  // the same vertical scale as the desktop implementation.
  const channelHeight = Math.floor(height / entry.channels.length);
  const channelMiddle = Math.floor(channelHeight / 2);
  const startOffsetPixels = Math.max(0, startOffsetBeats * pixelsPerBeat);

  return entry.channels
    .map((channel, channelIndex) => {
      const sampleCount = Math.min(channel.min.length, channel.max.length);
      if (sampleCount === 0) {
        return '';
      }

      const center = channelMiddle + channelIndex * channelHeight;
      let path = '';
      for (let x = 0; x < width; x += 1) {
        let sampleIndex = Math.floor(startOffsetPixels + x);

        if (looping) {
          sampleIndex = ((sampleIndex % sampleCount) + sampleCount) % sampleCount;
        } else if (sampleIndex < 0 || sampleIndex >= sampleCount) {
          continue;
        }

        const min = channel.min[sampleIndex] ?? 0;
        const max = channel.max[sampleIndex] ?? 0;
        const yTop = center - max * channelMiddle;
        const yBottom = center - min * channelMiddle;
        path += `M${x + 0.5} ${yTop} L${x + 0.5} ${yBottom} `;
      }

      return path.trim();
    })
    .filter((path) => path.length > 0);
}
