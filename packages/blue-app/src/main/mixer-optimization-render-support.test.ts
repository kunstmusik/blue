import { describe, expect, it } from 'vitest';
import {
  CONTROLLED_STATEFUL_RESIDUAL_LIMIT,
  LINEAR_DOUBLE_RESIDUAL_LIMIT,
  assertAllFinite,
  assertExpectedRender,
  assertMatchingRenderFormat,
  assertWholeBufferResidual,
  decodeFloatWavBuffer,
  peakAbsoluteResidual,
} from './mixer-optimization-render-support';

/** Builds an IEEE-float RIFF WAVE buffer with interleaved samples. */
function floatWavBuffer(
  bits: 32 | 64,
  sampleRate: number,
  channels: number,
  samples: number[],
): Buffer {
  const bytesPerSample = bits / 8;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(3, 20); // IEEE float
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE((sampleRate * channels * bytesPerSample) | 0, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    if (bits === 64) {
      buffer.writeDoubleLE(samples[i], 44 + i * 8);
    } else {
      buffer.writeFloatLE(samples[i], 44 + i * 4);
    }
  }
  return buffer;
}

describe('float WAV decoding contract (Spec 118 T005)', () => {
  it('decodes float64 output exactly, preserving values a Float32 cast would collapse', () => {
    const decoded = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, [0.5, -0.5, 1e-15, 0.25]));
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toBe(2);
    expect(decoded.format).toBe('float64');
    expect(decoded.frames).toBe(2);
    expect(Array.from(decoded.samples)).toEqual([0.5, -0.5, 1e-15, 0.25]);
    // A Float32 conversion cannot represent the 1e-15 sample: the decoder must
    // not round through Float32 on the way to Float64.
    expect(Math.fround(1e-15)).not.toBe(1e-15);
  });

  it('decodes float32 output', () => {
    const decoded = decodeFloatWavBuffer(floatWavBuffer(32, 48000, 1, [0.25, -0.75]));
    expect(decoded.format).toBe('float32');
    expect(decoded.channels).toBe(1);
    expect(decoded.frames).toBe(2);
    expect(decoded.samples[0]).toBeCloseTo(0.25, 7);
    expect(decoded.samples[1]).toBeCloseTo(-0.75, 7);
  });

  it('rejects malformed, truncated, and unsupported output explicitly', () => {
    expect(() => decodeFloatWavBuffer(Buffer.from('not a wav at all.....'))).toThrow(/RIFF/i);
    const noData = floatWavBuffer(64, 44100, 1, [0]);
    noData.write('junk', 36); // overwrite the data chunk id
    expect(() => decodeFloatWavBuffer(noData)).toThrow(/data chunk/i);

    const truncated = floatWavBuffer(64, 44100, 2, [0.1, 0.2, 0.3, 0.4]);
    const cut = truncated.subarray(0, 44 + 12); // header claims 32 bytes, 12 present
    expect(() => decodeFloatWavBuffer(cut)).toThrow(/truncated/i);

    expect(() => decodeFloatWavBuffer(floatWavBuffer(64, 44100, 1, [0]).subarray(0, 30))).toThrow(
      /truncated/i,
    );

    // PCM16 and 24-bit float are not the double/float offline render formats.
    const pcm16 = floatWavBuffer(64, 44100, 1, [0]);
    pcm16.writeUInt16LE(1, 20); // PCM
    pcm16.writeUInt16LE(16, 34);
    expect(() => decodeFloatWavBuffer(pcm16)).toThrow(/unsupported.*16-bit.*fmt=1/i);
    const float24 = floatWavBuffer(64, 44100, 1, [0]);
    float24.writeUInt16LE(24, 34);
    expect(() => decodeFloatWavBuffer(float24)).toThrow(/unsupported.*24-bit/i);
  });
});

describe('render format equality contract (Spec 118 T005)', () => {
  const base = () => decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, [0.1, 0.2, 0.3, 0.4]));

  it('passes for equal rate, channel count, format, and frame count', () => {
    expect(() => assertMatchingRenderFormat(base(), base())).not.toThrow();
  });

  it('fails for mismatched sample rate, channels, frames, or sample format', () => {
    const otherRate = decodeFloatWavBuffer(floatWavBuffer(64, 48000, 2, [0.1, 0.2, 0.3, 0.4]));
    expect(() => assertMatchingRenderFormat(base(), otherRate)).toThrow(/sample rate/i);

    const otherChannels = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 1, [0.1, 0.2, 0.3, 0.4]));
    expect(() => assertMatchingRenderFormat(base(), otherChannels)).toThrow(/channel/i);

    const otherFrames = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, [0.1, 0.2]));
    expect(() => assertMatchingRenderFormat(base(), otherFrames)).toThrow(/frame/i);

    const float32 = decodeFloatWavBuffer(floatWavBuffer(32, 44100, 2, [0.1, 0.2, 0.3, 0.4]));
    expect(() => assertMatchingRenderFormat(base(), float32)).toThrow(/format/i);
  });
});

describe('whole-buffer residual contract (Spec 118 T005)', () => {
  it('accepts exact silence and signed zero equivalence', () => {
    const silence = new Float64Array([0, -0, 0, -0]);
    expect(peakAbsoluteResidual(silence, new Float64Array([0, 0, -0, 0]))).toBe(0);
    expect(
      assertWholeBufferResidual(
        silence,
        new Float64Array(4),
        LINEAR_DOUBLE_RESIDUAL_LIMIT,
        'silence',
      ),
    ).toBe(0);
  });

  it('catches a mid-render difference that a plateau-only comparison would miss', () => {
    const a = new Float64Array(1000).fill(0.5);
    const b = Float64Array.from(a);
    b[10] = 1.5; // spike inside the first 1% of the buffer
    const plateauWindow = a.subarray(500); // a typical plateau window misses it
    let plateauPeak = 0;
    for (let i = 0; i < plateauWindow.length; i++) {
      plateauPeak = Math.max(plateauPeak, Math.abs(plateauWindow[i] - b[500 + i]));
    }
    expect(plateauPeak).toBe(0);
    expect(() =>
      assertWholeBufferResidual(a, b, LINEAR_DOUBLE_RESIDUAL_LIMIT, 'plateau case'),
    ).toThrow(/peak residual 1\.000e\+0 exceeds/i);
  });

  it('catches differences that a Float32 conversion hides', () => {
    const a = new Float64Array([0.5, 0.5, 0.5, 0.5]);
    const b = new Float64Array([0.5, 0.5, 0.50000002, 0.5]);
    // The differing sample rounds to the same float32 value...
    let float32Identical = true;
    for (let i = 0; i < a.length; i++) {
      if (Math.fround(a[i]) !== Math.fround(b[i])) float32Identical = false;
    }
    expect(float32Identical).toBe(true);
    // ...so a float32-cast comparison would accept it; the double residual must not.
    expect(() =>
      assertWholeBufferResidual(a, b, LINEAR_DOUBLE_RESIDUAL_LIMIT, 'float32-hidden case'),
    ).toThrow(/exceeds/i);
    // The same tiny difference is inside the controlled-stateful bound.
    expect(
      assertWholeBufferResidual(a, b, CONTROLLED_STATEFUL_RESIDUAL_LIMIT, 'stateful case'),
    ).toBeLessThanOrEqual(CONTROLLED_STATEFUL_RESIDUAL_LIMIT);
  });

  it('fails on length mismatch instead of comparing a prefix', () => {
    const a = new Float64Array([0.1, 0.2]);
    const b = new Float64Array([0.1, 0.2, 0.3]);
    expect(() => assertWholeBufferResidual(a, b, 1, 'length case')).toThrow(/length/i);
  });

  it('keeps finiteness checks independent of the residual helper', () => {
    // NaN deltas never win the `delta > peak` comparison, so the residual
    // helper silently reports zero for non-finite input; finiteness is a
    // separate assertion the caller must run first.
    const a = new Float64Array([0.5]);
    const b = new Float64Array([Number.NaN]);
    expect(peakAbsoluteResidual(a, b)).toBe(0);
    expect(peakAbsoluteResidual(a, new Float64Array([Number.POSITIVE_INFINITY]))).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(() =>
      assertWholeBufferResidual(a, b, LINEAR_DOUBLE_RESIDUAL_LIMIT, 'nan case'),
    ).not.toThrow();
    expect(() => assertAllFinite(new Float64Array([0.5, Number.NaN]), 'candidate')).toThrow(
      /non-finite.*index 1/i,
    );
    expect(() => assertAllFinite(new Float64Array([Number.POSITIVE_INFINITY]), 'baseline')).toThrow(
      /non-finite.*index 0/i,
    );
    expect(() => assertAllFinite(new Float64Array([0.5, -0.5]), 'ok')).not.toThrow();
  });

  it('documents the contractual limits verbatim', () => {
    expect(LINEAR_DOUBLE_RESIDUAL_LIMIT).toBe(1e-12);
    expect(CONTROLLED_STATEFUL_RESIDUAL_LIMIT).toBe(1e-6);
  });
});

describe('complete WAV/output validation (Spec 118 T054)', () => {
  it('rejects partial samples and incomplete channel frames', () => {
    const partialSample = Buffer.alloc(46);
    floatWavBuffer(64, 44100, 2, [0, 0]).copy(partialSample, 0, 0, 44);
    partialSample.writeUInt32LE(38, 4);
    partialSample.writeUInt32LE(1, 40);
    expect(() => decodeFloatWavBuffer(partialSample)).toThrow(/whole.*sample|frame/i);
    const partialFrame = floatWavBuffer(64, 44100, 2, [0]);
    expect(() => decodeFloatWavBuffer(partialFrame)).toThrow(/whole.*frame/i);
  });

  it('rejects malformed RIFF and fmt/data boundaries even when bytes remain', () => {
    const valid = floatWavBuffer(64, 44100, 2, [0, 0]);
    for (const size of [1, valid.length - 9, valid.length + 8]) {
      const bad = Buffer.from(valid);
      bad.writeUInt32LE(size, 4);
      expect(() => decodeFloatWavBuffer(bad)).toThrow(/RIFF|truncated/i);
    }
    const shortFmt = Buffer.from(valid);
    shortFmt.writeUInt32LE(4, 16);
    expect(() => decodeFloatWavBuffer(shortFmt)).toThrow(/fmt/i);
    const hugeFmt = Buffer.from(valid);
    hugeFmt.writeUInt32LE(10000, 16);
    expect(() => decodeFloatWavBuffer(hugeFmt)).toThrow(/truncated/i);
    const badAlign = Buffer.from(valid);
    badAlign.writeUInt16LE(1, 32);
    expect(() => decodeFloatWavBuffer(badAlign)).toThrow(/align|layout/i);
    const trailing = Buffer.concat([valid, Buffer.from([1])]);
    trailing.writeUInt32LE(trailing.length - 8, 4);
    expect(() => decodeFloatWavBuffer(trailing)).toThrow(/chunk|truncated/i);
  });

  it('rejects equal-but-short/empty output and out-of-range amplitudes independently of residual', () => {
    const expected = {
      sampleRate: 44100,
      channels: 2,
      frames: 2,
      format: 'float64' as const,
      maximumAmplitude: 0.5,
    };
    const good = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, [0.5, -0.5, 0, 0]));
    expect(() => assertExpectedRender(good, expected, 'good')).not.toThrow();
    for (const samples of [[], [0.1, 0.2]]) {
      const short = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, samples));
      expect(() => assertMatchingRenderFormat(short, short)).not.toThrow();
      expect(() => assertExpectedRender(short, expected, 'short')).toThrow(
        /expected.*frame|duration/i,
      );
    }
    const loud = decodeFloatWavBuffer(floatWavBuffer(64, 44100, 2, [0.5, 0, 0.50001, 0]));
    expect(() => assertExpectedRender(loud, expected, 'loud')).toThrow(/amplitude.*range/i);
  });
});
