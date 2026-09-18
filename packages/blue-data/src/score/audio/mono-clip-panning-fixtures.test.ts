import { describe, expect, it } from 'vitest';
import {
  buildWavBytes,
  parseAudioFileMetadata,
  EQUAL_POWER_CENTER_GAIN,
  getMonoPanGains,
  getStereoBalanceGains,
} from '../../index';

/**
 * Builds a 16-bit PCM WAV file with specified channels, sample rate, and constant sample values per channel.
 * Values are in [-1.0, 1.0].
 */
export function buildPcmWavWithSamples(
  channels: number,
  sampleRate: number,
  frameCount: number,
  channelValues: number[],
): Uint8Array {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataByteLength = frameCount * blockAlign;
  const fmtChunkSize = 16;
  const fileSize = 4 + (8 + fmtChunkSize) + (8 + dataByteLength);

  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, fileSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  // fmt chunk
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, fmtChunkSize, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataByteLength, true);

  // Write samples
  let offset = 44;
  for (let f = 0; f < frameCount; f++) {
    for (let c = 0; c < channels; c++) {
      const val = channelValues[c] ?? 0;
      const clamped = Math.max(-1, Math.min(1, val));
      const intVal = clamped < 0 ? clamped * 32768 : clamped * 32767;
      view.setInt16(offset, Math.round(intVal), true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

describe('deterministic audio fixtures for mono clip panning (T002)', () => {
  it('builds and parses a deterministic 1-channel mono fixture', () => {
    const monoBytes = buildPcmWavWithSamples(1, 44100, 100, [1.0]);
    const meta = parseAudioFileMetadata(monoBytes);
    expect(meta.channels).toBe(1);
    expect(meta.sampleRate).toBe(44100);
    expect(meta.frameCount).toBe(100);
  });

  it('builds and parses a deterministic 2-channel stereo fixture with distinct L/R', () => {
    const stereoBytes = buildPcmWavWithSamples(2, 44100, 100, [0.8, -0.4]);
    const meta = parseAudioFileMetadata(stereoBytes);
    expect(meta.channels).toBe(2);
    expect(meta.sampleRate).toBe(44100);
    expect(meta.frameCount).toBe(100);
  });

  it('builds and parses a deterministic 3-channel fixture (unsupported layout)', () => {
    const multiBytes = buildPcmWavWithSamples(3, 44100, 100, [0.5, 0.5, 0.5]);
    const meta = parseAudioFileMetadata(multiBytes);
    expect(meta.channels).toBe(3);
    expect(meta.sampleRate).toBe(44100);
    expect(meta.frameCount).toBe(100);
  });

  it('provides verified gain constants for center (-3.01 dB) and endpoints', () => {
    expect(EQUAL_POWER_CENTER_GAIN).toBeCloseTo(0.70710678, 6);

    // Mono Pan Center: level is 1/√2 per side (-3.01 dB), power is 0.5 per side (1.0 total)
    const [mCenterL, mCenterR] = getMonoPanGains(0.5);
    expect(mCenterL * EQUAL_POWER_CENTER_GAIN).toBeCloseTo(1 / Math.SQRT2, 6);
    expect(mCenterR * EQUAL_POWER_CENTER_GAIN).toBeCloseTo(1 / Math.SQRT2, 6);
    expect((mCenterL * EQUAL_POWER_CENTER_GAIN) ** 2).toBeCloseTo(0.5, 6);
    expect((mCenterR * EQUAL_POWER_CENTER_GAIN) ** 2).toBeCloseTo(0.5, 6);

    // Stereo Balance Center
    const [sCenterL, sCenterR] = getStereoBalanceGains(0.5);
    expect(sCenterL).toBe(1.0);
    expect(sCenterR).toBe(1.0);

    // Endpoints
    const [mLeftL, mLeftR] = getMonoPanGains(0);
    expect(mLeftL * EQUAL_POWER_CENTER_GAIN).toBeCloseTo(1.0, 6);
    expect(mLeftR).toBeCloseTo(0.0, 6);

    const [mRightL, mRightR] = getMonoPanGains(1);
    expect(mRightL).toBeCloseTo(0.0, 6);
    expect(mRightR * EQUAL_POWER_CENTER_GAIN).toBeCloseTo(1.0, 6);
  });
});
