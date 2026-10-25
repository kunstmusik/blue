/**
 * Spec 118 host-only render decode/comparison support. Decodes IEEE-float WAV
 * output (float64 offline renders, float32 engine captures) without a Float32
 * intermediate, validates format equality, and compares whole interleaved
 * buffers against the render-equivalence contract's absolute residual limits.
 *
 * Finiteness is asserted independently of the residual helpers: a NaN delta
 * never wins the `delta > peak` comparison, so a residual check alone would
 * silently accept non-finite candidate samples.
 */

export type RenderSampleFormat = 'float64' | 'float32';

export interface DecodedRenderAudio {
  readonly sampleRate: number;
  readonly channels: number;
  readonly format: RenderSampleFormat;
  readonly frames: number;
  /** Interleaved frames × channels samples as doubles. */
  readonly samples: Float64Array;
}

export function decodeFloatWavBuffer(buffer: Uint8Array): DecodedRenderAudio {
  const view = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.length < 12 || view.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Not a RIFF WAVE file');
  }
  if (view.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF WAVE file (missing WAVE tag)');
  }
  const riffEnd = view.readUInt32LE(4) + 8;
  if (riffEnd > view.length) throw new Error('Truncated RIFF container');
  if (riffEnd < 12 || riffEnd !== view.length) throw new Error('Malformed RIFF container boundary');
  let offset = 12;
  let channels = 0,
    sampleRate = 0,
    bitsPerSample = 0,
    audioFormat = 0;
  let blockAlign = 0,
    byteRate = 0;
  let fmtSeen = false,
    dataStart = -1,
    dataLength = 0;
  while (offset < riffEnd) {
    if (offset + 8 > riffEnd) throw new Error('Truncated WAV chunk header');
    const chunkId = view.toString('ascii', offset, offset + 4);
    const chunkSize = view.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + chunkSize;
    if (chunkEnd > riffEnd) throw new Error(`Truncated WAV ${chunkId} chunk`);
    if (chunkId === 'fmt ') {
      if (fmtSeen || chunkSize < 16) throw new Error('Malformed WAV fmt chunk');
      fmtSeen = true;
      audioFormat = view.readUInt16LE(offset + 8);
      channels = view.readUInt16LE(offset + 10);
      sampleRate = view.readUInt32LE(offset + 12);
      byteRate = view.readUInt32LE(offset + 16);
      blockAlign = view.readUInt16LE(offset + 20);
      bitsPerSample = view.readUInt16LE(offset + 22);
      if (chunkSize > 16 && (chunkSize < 18 || view.readUInt16LE(offset + 24) > chunkSize - 18)) {
        throw new Error('Malformed WAV fmt extension boundary');
      }
    } else if (chunkId === 'data') {
      if (!fmtSeen || dataStart >= 0)
        throw new Error('Malformed WAV fmt/data ordering or duplicate data chunk');
      dataStart = offset + 8;
      dataLength = chunkSize;
    }
    offset = chunkEnd + (chunkSize % 2);
    if (offset > riffEnd) throw new Error('Truncated WAV chunk padding');
  }
  if (dataStart < 0) {
    throw new Error('WAV file has no data chunk');
  }
  if (audioFormat !== 3 || (bitsPerSample !== 32 && bitsPerSample !== 64)) {
    throw new Error(
      `Unsupported WAV sample format: ${bitsPerSample}-bit fmt=${audioFormat}; ` +
        'expected IEEE float 64-bit (offline double render) or 32-bit (engine capture)',
    );
  }
  if (channels <= 0 || sampleRate <= 0) {
    throw new Error(`Invalid WAV stream layout: ${channels} channels at ${sampleRate} Hz`);
  }
  const format: RenderSampleFormat = bitsPerSample === 64 ? 'float64' : 'float32';
  const bytesPerSample = bitsPerSample / 8;
  if (dataLength % bytesPerSample !== 0) throw new Error('WAV data must contain whole samples');
  if ((dataLength / bytesPerSample) % channels !== 0)
    throw new Error('WAV data must contain whole channel frames');
  if (blockAlign !== channels * bytesPerSample || byteRate !== sampleRate * blockAlign) {
    throw new Error('Invalid WAV block alignment or stream layout');
  }
  const count = dataLength / bytesPerSample;
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] =
      bitsPerSample === 64
        ? view.readDoubleLE(dataStart + i * 8)
        : view.readFloatLE(dataStart + i * 4);
  }
  return {
    sampleRate,
    channels,
    format,
    frames: count / channels,
    samples,
  };
}

export function assertAllFinite(samples: Float64Array, label: string): void {
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) {
      throw new Error(`${label} render has a non-finite sample at interleaved index ${i}`);
    }
  }
}

export function assertMatchingRenderFormat(
  expected: DecodedRenderAudio,
  actual: DecodedRenderAudio,
): void {
  if (expected.sampleRate !== actual.sampleRate) {
    throw new Error(
      `Render sample rate differs: baseline ${expected.sampleRate}, candidate ${actual.sampleRate}`,
    );
  }
  if (expected.channels !== actual.channels) {
    throw new Error(
      `Render channel count differs: baseline ${expected.channels}, candidate ${actual.channels}`,
    );
  }
  if (expected.format !== actual.format) {
    throw new Error(
      `Render sample format differs: baseline ${expected.format}, candidate ${actual.format}`,
    );
  }
  if (expected.frames !== actual.frames) {
    throw new Error(
      `Render frame count differs: baseline ${expected.frames}, candidate ${actual.frames}` +
        ' (expected duration including tails must match)',
    );
  }
}

/** Independent fixture contract: equality alone cannot accept two incomplete,
 * empty or overflowing renders. Bounds never normalize or clip the samples. */
export function assertExpectedRender(
  audio: DecodedRenderAudio,
  expected: {
    sampleRate: number;
    channels: number;
    format: RenderSampleFormat;
    frames: number;
    maximumAmplitude: number;
  },
  label: string,
): void {
  if (
    !Number.isInteger(expected.frames) ||
    expected.frames <= 0 ||
    audio.frames !== expected.frames ||
    audio.samples.length !== expected.frames * expected.channels
  ) {
    throw new Error(
      `${label}: expected complete duration of ${expected.frames} frames, got ${audio.frames}`,
    );
  }
  if (
    audio.sampleRate !== expected.sampleRate ||
    audio.channels !== expected.channels ||
    audio.format !== expected.format
  ) {
    throw new Error(`${label}: unexpected fixture sample rate/channel/format`);
  }
  if (!Number.isFinite(expected.maximumAmplitude) || expected.maximumAmplitude < 0)
    throw new Error('Invalid declared amplitude range');
  assertAllFinite(audio.samples, label);
  for (let index = 0; index < audio.samples.length; index++) {
    if (Math.abs(audio.samples[index]!) > expected.maximumAmplitude) {
      throw new Error(
        `${label}: amplitude outside declared range ±${expected.maximumAmplitude} at sample ${index}`,
      );
    }
  }
}

/** Peak |a-b| across two equal-length interleaved buffers. */
export function peakAbsoluteResidual(a: Float64Array, b: Float64Array): number {
  let peak = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = Math.abs(a[i] - b[i]);
    if (delta > peak) peak = delta;
  }
  return peak;
}

/**
 * Contract limits from specs/118-mixer-optimization/contracts/render-equivalence.md:
 * 1e-12 full scale for deterministic linear-routing fixtures, 1e-6 (−120 dBFS)
 * for controlled stateful/nonlinear effect fixtures.
 */
export const LINEAR_DOUBLE_RESIDUAL_LIMIT = 1e-12;
export const CONTROLLED_STATEFUL_RESIDUAL_LIMIT = 1e-6;

/** Returns the peak residual after asserting the whole buffer is within limit. */
export function assertWholeBufferResidual(
  baseline: Float64Array,
  candidate: Float64Array,
  limit: number,
  label: string,
): number {
  if (baseline.length !== candidate.length) {
    throw new Error(
      `${label}: interleaved buffer length differs (baseline ${baseline.length}, ` +
        `candidate ${candidate.length}); a prefix comparison is not an acceptance result`,
    );
  }
  const peak = peakAbsoluteResidual(baseline, candidate);
  if (!(peak <= limit)) {
    throw new Error(
      `${label}: whole-buffer peak residual ${peak.toExponential(3)} exceeds limit ${limit.toExponential(0)}`,
    );
  }
  return peak;
}
