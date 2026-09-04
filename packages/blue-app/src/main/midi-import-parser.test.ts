import { describe, expect, it } from 'vitest';
import { parseMidiImportBytes } from './midi-import-parser';

function writeUInt32(value: number): number[] {
  return [value >>> 24, value >>> 16, value >>> 8, value & 0xff];
}

function writeUInt16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function buildFile(format: number, division: number, tracks: number[][]): Uint8Array {
  const bytes = [
    ...Array.from('MThd').map((char) => char.charCodeAt(0)),
    ...writeUInt32(6),
    ...writeUInt16(format),
    ...writeUInt16(tracks.length),
    ...writeUInt16(division),
  ];
  for (const track of tracks) {
    bytes.push(
      ...Array.from('MTrk').map((char) => char.charCodeAt(0)),
      ...writeUInt32(track.length),
      ...track,
    );
  }
  return new Uint8Array(bytes);
}

const trackWithRunningStatus = [
  0x00, 0xff, 0x03, 0x05, 0x50, 0x69, 0x61, 0x6e, 0x6f, 0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
  0x00, 0x90, 0x3c, 0x64, 0x81, 0x70, 0x3c, 0x00, 0x00, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40, 0x00,
  0xff, 0x2f, 0x00,
];

describe('MIDI import parser', () => {
  it('normalizes format-0 tracks, running status, and velocity-zero note-offs', () => {
    const result = parseMidiImportBytes(
      buildFile(0, 480, [trackWithRunningStatus]),
      'running-status.mid',
    );
    const stream = result.document.tracks[0].streams[0];

    expect(result.preview).toMatchObject({
      fileName: 'running-status.mid',
      format: 0,
      ticksPerBeat: 480,
    });
    expect(result.preview.streams[0]).toMatchObject({
      trackName: 'Piano',
      channel: 0,
      noteCount: 1,
      firstBeat: 0,
      lastBeat: 0.5,
    });
    expect(result.preview.streams[0].defaults.instrumentId).toBe('1');
    expect(stream.events).toEqual([
      { absoluteTick: 0, type: 'noteOn', noteNumber: 60, velocity: 100 },
      { absoluteTick: 240, type: 'noteOff', noteNumber: 60, velocity: 0 },
    ]);
    expect(result.document.tempoChanges).toEqual([
      { absoluteTick: 0, bpm: 120, trackIndex: 0 },
      { absoluteTick: 240, bpm: 60, trackIndex: 0 },
    ]);
  });

  it('supports format 1 and splits note-bearing channels into streams', () => {
    const track = [
      0x00, 0x90, 0x3c, 0x64, 0x00, 0x91, 0x40, 0x64, 0x81, 0x70, 0x3c, 0x00, 0x00, 0x81, 0x40,
      0x00, 0x00, 0xff, 0x2f, 0x00,
    ];
    const result = parseMidiImportBytes(
      buildFile(1, 960, [track, [0x00, 0xff, 0x2f, 0x00]]),
      'multi.mid',
    );

    expect(result.document.format).toBe(1);
    expect(result.document.tracks[0].streams.map((stream) => stream.streamKey)).toEqual([
      '0:0',
      '0:1',
    ]);
  });

  it('includes unmatched and dangling note diagnostics in the preview', () => {
    const track = [0x00, 0x80, 0x30, 0x00, 0x00, 0x90, 0x3c, 0x64, 0x81, 0x70, 0xff, 0x2f, 0x00];
    const result = parseMidiImportBytes(buildFile(0, 480, [track]), 'warnings.mid');

    expect(result.preview.streams[0].warnings.map((warning) => warning.code)).toEqual([
      'unmatched-note-off',
      'dangling-note-on',
    ]);
  });

  it('rejects SMPTE and format-2 files', () => {
    expect(() =>
      parseMidiImportBytes(buildFile(0, 0xe728, [[0x00, 0xff, 0x2f, 0x00]]), 'smpte.mid'),
    ).toThrow(/positive PPQ/);
    expect(() =>
      parseMidiImportBytes(buildFile(2, 480, [[0x00, 0xff, 0x2f, 0x00]]), 'format-2.mid'),
    ).toThrow(/formats 0 and 1/);
  });

  it('rejects malformed files without leaking parser errors', () => {
    expect(() => parseMidiImportBytes(new Uint8Array([0x00, 0x01, 0x02]), 'broken.mid')).toThrow(
      /MIDI|Bad/,
    );
  });
});
