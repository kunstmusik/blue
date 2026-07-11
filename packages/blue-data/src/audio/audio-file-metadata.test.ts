import { describe, expect, it } from 'vitest';

import {
  parseAudioFileMetadata,
  AudioFileMetadataError,
  buildWavBytes,
  buildAiffBytes,
} from './audio-file-metadata';

describe('parseAudioFileMetadata', () => {
  describe('WAV', () => {
    it('parses stereo 44100Hz 16-bit WAV', () => {
      const bytes = buildWavBytes(2, 44100, 16, 44100);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.format).toBe('WAV');
      expect(meta.channels).toBe(2);
      expect(meta.sampleRate).toBe(44100);
      expect(meta.bitsPerSample).toBe(16);
      expect(meta.frameCount).toBe(44100);
      expect(meta.durationSeconds).toBeCloseTo(1.0, 5);
    });

    it('parses mono 48000Hz 24-bit WAV', () => {
      const bytes = buildWavBytes(1, 48000, 24, 96000);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.channels).toBe(1);
      expect(meta.sampleRate).toBe(48000);
      expect(meta.bitsPerSample).toBe(24);
      expect(meta.frameCount).toBe(96000);
      expect(meta.durationSeconds).toBeCloseTo(2.0, 5);
    });

    it('parses 6-channel 96000Hz WAV', () => {
      const bytes = buildWavBytes(6, 96000, 16, 96000);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.channels).toBe(6);
      expect(meta.sampleRate).toBe(96000);
      expect(meta.durationSeconds).toBeCloseTo(1.0, 5);
    });

    it('handles zero-length data chunk', () => {
      const bytes = buildWavBytes(2, 44100, 16, 0);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.format).toBe('WAV');
      expect(meta.channels).toBe(2);
      expect(meta.sampleRate).toBe(44100);
      expect(meta.frameCount).toBe(0);
      expect(meta.durationSeconds).toBe(0);
    });
  });

  describe('AIFF', () => {
    it('parses stereo 44100Hz 16-bit AIFF', () => {
      const bytes = buildAiffBytes(2, 44100, 16, 44100);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.format).toBe('AIFF');
      expect(meta.channels).toBe(2);
      expect(meta.sampleRate).toBe(44100);
      expect(meta.bitsPerSample).toBe(16);
      expect(meta.frameCount).toBe(44100);
      expect(meta.durationSeconds).toBeCloseTo(1.0, 5);
    });

    it('parses the normalized 80-bit 44100Hz value written by Csound AIFF files', () => {
      const bytes = buildAiffBytes(2, 44100, 16, 5_194_048);
      // Standard extended-float representation observed in Csound output:
      // 0x400e ac440000 00000000.
      bytes.set([0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0], 28);

      const meta = parseAudioFileMetadata(bytes);

      expect(meta.sampleRate).toBe(44100);
      expect(meta.durationSeconds).toBeCloseTo(117.778866, 5);
    });

    it('parses mono 48000Hz AIFF', () => {
      const bytes = buildAiffBytes(1, 48000, 16, 48000);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.channels).toBe(1);
      expect(meta.sampleRate).toBe(48000);
      expect(meta.durationSeconds).toBeCloseTo(1.0, 5);
    });

    it('parses 8000Hz AIFF', () => {
      const bytes = buildAiffBytes(1, 8000, 8, 8000);
      const meta = parseAudioFileMetadata(bytes);

      expect(meta.channels).toBe(1);
      expect(meta.sampleRate).toBe(8000);
      expect(meta.durationSeconds).toBeCloseTo(1.0, 5);
    });
  });

  describe('error handling', () => {
    it('rejects empty data', () => {
      expect(() => parseAudioFileMetadata(new Uint8Array(0))).toThrow(
        AudioFileMetadataError,
      );
    });

    it('rejects unknown format', () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(() => parseAudioFileMetadata(bytes)).toThrow(
        AudioFileMetadataError,
      );
    });

    it('rejects truncated WAV', () => {
      const bytes = buildWavBytes(2, 44100, 16, 100).slice(0, 20);
      expect(() => parseAudioFileMetadata(bytes)).toThrow(
        AudioFileMetadataError,
      );
    });

    it('rejects RIFF without WAVE', () => {
      const buf = new Array(44).fill(0);
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46; // RIFF
      buf[8] = 0x58; buf[9] = 0x58; buf[10] = 0x58; buf[11] = 0x58; // XXXX
      expect(() => parseAudioFileMetadata(new Uint8Array(buf))).toThrow(
        /WAVE/,
      );
    });

    it('rejects FORM without AIFF/AIFC', () => {
      const buf = new Array(44).fill(0);
      buf[0] = 0x46; buf[1] = 0x4f; buf[2] = 0x52; buf[3] = 0x4d; // FORM
      buf[8] = 0x58; buf[9] = 0x58; buf[10] = 0x58; buf[11] = 0x58; // XXXX
      expect(() => parseAudioFileMetadata(new Uint8Array(buf))).toThrow(
        /AIFF/,
      );
    });
  });
});
