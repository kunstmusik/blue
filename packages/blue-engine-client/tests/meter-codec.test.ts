import { describe, expect, it } from 'vitest';
import { decodeMeterFrame, encodeMeterFrame } from '../src/meter-codec';

describe('meter-codec', () => {
  it('encodes and decodes stereo meter frames round-trip', () => {
    const frame = {
      sequence: 42,
      nchnls: 2,
      channels: [
        {
          csdKey: '0',
          rms: [0.125, 0.25],
          peak: [0.5, 0.75],
        },
        {
          csdKey: 'sub_Reverb',
          rms: [0.05, 0.05],
          peak: [0.1, 0.12],
        },
        {
          csdKey: 'sub_Master',
          rms: [0.3, 0.35],
          peak: [0.8, 0.85],
        },
      ],
    };

    const encoded = encodeMeterFrame(frame);
    // Header (8) + 3 channels * (64 + 2 * 8 * 2 = 96) = 8 + 288 = 296 bytes
    expect(encoded.length).toBe(296);

    const decoded = decodeMeterFrame(encoded);
    expect(decoded.sequence).toBe(42);
    expect(decoded.nchnls).toBe(2);
    expect(decoded.channels.length).toBe(3);

    expect(decoded.channels[0].csdKey).toBe('0');
    expect(decoded.channels[0].rms[0]).toBeCloseTo(0.125);
    expect(decoded.channels[0].rms[1]).toBeCloseTo(0.25);
    expect(decoded.channels[0].peak[0]).toBeCloseTo(0.5);
    expect(decoded.channels[0].peak[1]).toBeCloseTo(0.75);

    expect(decoded.channels[1].csdKey).toBe('sub_Reverb');
    expect(decoded.channels[2].csdKey).toBe('sub_Master');
  });

  it('sanitizes NaN and Infinity to 0.0 on encoding and decoding', () => {
    const frame = {
      sequence: 100,
      nchnls: 1,
      channels: [
        {
          csdKey: 'bad_channel',
          rms: [NaN],
          peak: [Infinity],
        },
      ],
    };

    const encoded = encodeMeterFrame(frame);
    const decoded = decodeMeterFrame(encoded);

    expect(decoded.channels[0].rms[0]).toBe(0.0);
    expect(decoded.channels[0].peak[0]).toBe(0.0);
  });

  it('handles empty channels gracefully', () => {
    const frame = {
      sequence: 1,
      nchnls: 2,
      channels: [],
    };

    const encoded = encodeMeterFrame(frame);
    expect(encoded.length).toBe(8);

    const decoded = decodeMeterFrame(encoded);
    expect(decoded.sequence).toBe(1);
    expect(decoded.nchnls).toBe(2);
    expect(decoded.channels).toEqual([]);
  });

  it('throws on buffer too small or invalid header', () => {
    expect(() => decodeMeterFrame(Buffer.alloc(4))).toThrow();
    expect(() => decodeMeterFrame(Buffer.from([0, 0, 0, 0, 1, 0, 0, 0]))).toThrow(); // nchnls = 0
  });
});
