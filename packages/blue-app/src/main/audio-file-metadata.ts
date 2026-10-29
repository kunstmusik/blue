import { open } from 'node:fs/promises';
import { parseAudioFileMetadata, type AudioFileMetadata } from '@blue/data';

/** Read WAV/AIFF metadata by seeking over sample data and unrelated chunks. */
export async function readAudioFileMetadataHeader(
  filePath: string,
): Promise<AudioFileMetadata | null> {
  const file = await open(filePath, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 12) return null;
    const header = Buffer.alloc(12);
    if ((await file.read(header, 0, 12, 0)).bytesRead !== 12) return null;
    const wav =
      header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE';
    const aiff =
      header.toString('ascii', 0, 4) === 'FORM' &&
      ['AIFF', 'AIFC'].includes(header.toString('ascii', 8, 12));
    if (!wav && !aiff) return null;
    let format: Buffer | null = null;
    let data: Buffer | null = null;
    let offset = 12;
    let chunks = 0;
    // Bound malformed files with arbitrarily many tiny chunks as well as read size.
    while (offset + 8 <= stat.size) {
      if (++chunks > 1024) return null;
      const chunk = Buffer.alloc(8);
      if ((await file.read(chunk, 0, 8, offset)).bytesRead !== 8) return null;
      const id = chunk.toString('ascii', 0, 4);
      const size = wav ? chunk.readUInt32LE(4) : chunk.readUInt32BE(4);
      if ((wav && id === 'fmt ') || (aiff && id === 'COMM')) {
        const length = wav
          ? 16
          : header.toString('ascii', 8, 12) === 'AIFC' && size >= 22
            ? 22
            : 18;
        if (size < length) return null;
        const body = Buffer.alloc(length);
        if ((await file.read(body, 0, length, offset + 8)).bytesRead !== length) return null;
        if (wav) chunk.writeUInt32LE(length, 4);
        else chunk.writeUInt32BE(length, 4);
        format = Buffer.concat([chunk, body]);
      } else if (wav && id === 'data') {
        data = chunk;
      }
      offset += 8 + size + (size % 2);
    }
    if (!format) return null;
    const metadata = parseAudioFileMetadata(
      Buffer.concat([header, format, ...(wav ? [data ?? Buffer.alloc(8)] : [])]),
    );
    return { ...metadata, byteLength: stat.size };
  } finally {
    await file.close();
  }
}
