import { open } from 'node:fs/promises';
import path from 'node:path';
import { buildWavBytes, buildAiffBytes, parseAudioFileMetadata } from '@blue/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAudioFileMetadataHeader } from './audio-file-metadata';

vi.mock('node:fs/promises', () => ({ open: vi.fn() }));

function mockFile(bytes: Uint8Array, size = bytes.length) {
  const read = vi.fn(async (buffer: Buffer, start: number, length: number, position: number) => {
    const source = bytes.subarray(position, position + length);
    buffer.set(source, start);
    return { bytesRead: source.length, buffer };
  });
  const file = {
    stat: vi.fn(async () => ({ size, isFile: () => true })),
    read,
    close: vi.fn(async () => undefined),
  };
  vi.mocked(open).mockResolvedValue(file as never);
  return file;
}

afterEach(() => vi.resetAllMocks());

describe('bounded audio metadata reads', () => {
  const aifc = new Uint8Array(42);
  aifc.set(buildAiffBytes(1, 32000, 32, 8));
  aifc.set(Buffer.from('AIFC'), 8);
  new DataView(aifc.buffer).setUint32(4, 34);
  new DataView(aifc.buffer).setUint32(16, 22);
  aifc.set(Buffer.from('fl32'), 38);
  for (const [name, bytes] of [
    ['WAV', buildWavBytes(2, 44100, 16, 8)],
    ['AIFF', buildAiffBytes(2, 48000, 24, 8)],
    ['AIFC', aifc],
  ] as const) {
    it(`matches the existing ${name} metadata interpretation without reading samples`, async () => {
      const file = mockFile(bytes);
      expect(await readAudioFileMetadataHeader('audio')).toEqual(parseAudioFileMetadata(bytes));
      expect(file.close).toHaveBeenCalledOnce();
      expect(file.read.mock.calls.reduce((sum, call) => sum + call[2], 0)).toBeLessThanOrEqual(50);
    });
  }

  it('reads only 44 bytes for a declared 1 GiB WAV and preserves a native Windows path', async () => {
    const bytes = buildWavBytes(2, 48000, 16, 0);
    new DataView(bytes.buffer).setUint32(40, 1024 * 1024 * 1024, true);
    const file = mockFile(bytes, 44 + 1024 * 1024 * 1024);
    const filePath = path.win32.join('C:\\', 'Users', 'Composer', 'large.wav');
    expect(await readAudioFileMetadataHeader(filePath)).toMatchObject({
      frameCount: 268435456,
      byteLength: 44 + 1024 * 1024 * 1024,
    });
    expect(open).toHaveBeenCalledWith(filePath, 'r');
    expect(file.read.mock.calls.map((call) => call[2])).toEqual([12, 8, 16, 8]);
  });

  it('seeks past large unrelated chunks, including word padding', async () => {
    const original = buildWavBytes(1, 8000, 16, 4);
    const junkSize = 1_000_001;
    const fmtOffset = 20 + junkSize + 1;
    const read = vi.fn(async (buffer: Buffer, start: number, length: number, position: number) => {
      const chunk =
        position === 0
          ? original.subarray(0, 12)
          : position === 12
            ? Buffer.concat([Buffer.from('JUNK'), Buffer.from([0x41, 0x42, 0x0f, 0])])
            : original.subarray(position - fmtOffset + 12, position - fmtOffset + 12 + length);
      buffer.set(chunk.subarray(0, length), start);
      return { bytesRead: Math.min(length, chunk.length), buffer };
    });
    const file = {
      stat: async () => ({ size: fmtOffset + original.length - 12, isFile: () => true }),
      read,
      close: vi.fn(),
    };
    vi.mocked(open).mockResolvedValue(file as never);
    expect(await readAudioFileMetadataHeader('padded.wav')).toMatchObject({
      sampleRate: 8000,
      frameCount: 4,
    });
    expect(read.mock.calls.map((call) => call[3])).toEqual([
      0,
      12,
      fmtOffset,
      fmtOffset + 8,
      fmtOffset + 24,
    ]);
    expect(file.close).toHaveBeenCalledOnce();
  });

  it('returns unavailable for other codecs and closes the file after read failures', async () => {
    const file = mockFile(new Uint8Array(20));
    expect(await readAudioFileMetadataHeader('other.mp3')).toBeNull();
    file.read.mockRejectedValueOnce(new Error('read failed'));
    await expect(readAudioFileMetadataHeader('broken.wav')).rejects.toThrow('read failed');
    expect(file.close).toHaveBeenCalledTimes(2);
  });
});
