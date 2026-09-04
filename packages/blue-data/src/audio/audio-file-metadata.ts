/**
 * Pure WAV/AIFF metadata parser for freeze artifact inspection.
 *
 * Reads channel count, sample rate, and duration from the binary header
 * of a WAV (RIFF) or AIFF (FORM) file. The main process reads the bytes;
 * this module performs the pure format interpretation.
 *
 * No Node.js built-ins are used — operates on Uint8Array to stay
 * browser-safe and Node-safe per the @blue/data constraint.
 */

export interface AudioFileMetadata {
  format: 'WAV' | 'AIFF' | 'AIFC';
  channels: number;
  sampleRate: number;
  /** Duration in seconds, derived from byte length / (sampleRate * frameSize). */
  durationSeconds: number;
  /** Total audio frames (samples per channel). */
  frameCount: number;
  /** Bits per sample per channel. */
  bitsPerSample: number;
  /** Total source byte length. */
  byteLength: number;
  /** Encoding label: 'PCM', 'IEEE_FLOAT', 'UNKNOWN', etc. */
  encodingType: string;
  /** True for big-endian formats (AIFF), false for little-endian (WAV). */
  isBigEndian: boolean;
  /** Header fields that could not be determined from the inspected bytes. */
  unavailableFields: string[];
}

export class AudioFileMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioFileMetadataError';
  }
}

// ─── Little-endian readers (WAV) ───

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] +
    data[offset + 1] * 0x100 +
    data[offset + 2] * 0x10000 +
    data[offset + 3] * 0x1000000
  );
}

// ─── Big-endian readers (AIFF) ───

function readUint16BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    data[offset] * 0x1000000 +
    data[offset + 1] * 0x10000 +
    data[offset + 2] * 0x100 +
    data[offset + 3]
  );
}

/**
 * Convert an 80-byte IEEE 754 extended float (big-endian) to a JS number.
 * AIFF sample rate is stored in this format.
 */
function readExtendedBE(data: Uint8Array, offset: number): number {
  const exponent = ((data[offset] & 0x7f) << 8) | data[offset + 1];
  const hiMantissa = readUint32BE(data, offset + 2);
  const loMantissa = readUint32BE(data, offset + 6);

  if (exponent === 0 && hiMantissa === 0 && loMantissa === 0) {
    return 0;
  }

  const exp = exponent - 16383 - 63;
  let mantissa = hiMantissa * 0x100000000 + loMantissa;

  if (exp < 0) {
    mantissa /= Math.pow(2, -exp);
  } else {
    mantissa *= Math.pow(2, exp);
  }

  if (data[offset] & 0x80) {
    mantissa = -mantissa;
  }

  return mantissa;
}

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const FORM = 0x464f524d; // "FORM"
const AIFF_TYPE = 0x41494646; // "AIFF"
const AIFC_TYPE = 0x41494643; // "AIFC"

function fourCCBE(data: Uint8Array, offset: number): number {
  return readUint32BE(data, offset);
}

function fourCCStringBE(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

/**
 * Parse WAV (RIFF/WAVE) metadata.
 * Finds the `fmt ` chunk for channels/sampleRate/bitsPerSample/formatTag,
 * then the `data` chunk for byte length.
 */
function parseWav(data: Uint8Array): AudioFileMetadata {
  if (data.length < 44) {
    throw new AudioFileMetadataError('WAV file too short for header parsing');
  }

  if (fourCCBE(data, 0) !== RIFF) {
    throw new AudioFileMetadataError('Not a RIFF file');
  }
  if (fourCCBE(data, 8) !== WAVE) {
    throw new AudioFileMetadataError('Not a WAVE file');
  }

  let formatTag = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataByteLength = 0;
  let hasDataChunk = false;

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkId = fourCCBE(data, offset);
    const chunkSize = readUint32LE(data, offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 0x666d7420) {
      // "fmt "
      if (chunkSize < 16 || chunkStart + 16 > data.length) {
        throw new AudioFileMetadataError('WAV fmt chunk too small');
      }
      formatTag = readUint16LE(data, chunkStart);
      channels = readUint16LE(data, chunkStart + 2);
      sampleRate = readUint32LE(data, chunkStart + 4);
      bitsPerSample = readUint16LE(data, chunkStart + 14);
    } else if (chunkId === 0x64617461) {
      // "data"
      dataByteLength = chunkSize;
      hasDataChunk = true;
    }

    // Chunks are word-aligned (even offsets)
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (channels === 0 || sampleRate === 0 || bitsPerSample === 0) {
    throw new AudioFileMetadataError('WAV fmt chunk not found or incomplete');
  }

  const frameSize = (bitsPerSample / 8) * channels;
  const frameCount =
    dataByteLength > 0 && frameSize > 0 ? Math.floor(dataByteLength / frameSize) : 0;
  const durationSeconds = frameCount > 0 && sampleRate > 0 ? frameCount / sampleRate : 0;
  const unavailableFields = hasDataChunk ? [] : ['frameCount', 'durationSeconds'];

  let encodingType = 'UNKNOWN';
  if (formatTag === 1) {
    encodingType = 'PCM';
  } else if (formatTag === 3) {
    encodingType = 'IEEE_FLOAT';
  } else if (formatTag === 6) {
    encodingType = 'ALAW';
  } else if (formatTag === 7) {
    encodingType = 'MULAW';
  }

  return {
    format: 'WAV',
    channels,
    sampleRate,
    bitsPerSample,
    frameCount,
    durationSeconds,
    byteLength: data.length,
    encodingType,
    isBigEndian: false,
    unavailableFields,
  };
}

/**
 * Parse AIFF / AIFC (FORM) metadata.
 * Finds the `COMM` chunk for channels/sampleRate/bitsPerSample/frameCount,
 * then the `SSND` chunk for byte length.
 */
function parseAiff(data: Uint8Array): AudioFileMetadata {
  if (data.length < 38) {
    throw new AudioFileMetadataError('AIFF file too short for header parsing');
  }

  if (fourCCBE(data, 0) !== FORM) {
    throw new AudioFileMetadataError('Not a FORM file');
  }

  const formType = fourCCBE(data, 8);
  if (formType !== AIFF_TYPE && formType !== AIFC_TYPE) {
    throw new AudioFileMetadataError(`Not an AIFF/AIFC file (formType=${formType.toString(16)})`);
  }

  const isAifc = formType === AIFC_TYPE;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let frameCount = 0;
  let compressionType = 'NONE';

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunkId = fourCCBE(data, offset);
    const chunkSize = readUint32BE(data, offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 0x434f4d4d) {
      // "COMM"
      if (chunkStart + 18 > data.length) {
        throw new AudioFileMetadataError('AIFF COMM chunk too small');
      }
      channels = readUint16BE(data, chunkStart);
      frameCount = readUint32BE(data, chunkStart + 2);
      bitsPerSample = readUint16BE(data, chunkStart + 6);
      sampleRate = readExtendedBE(data, chunkStart + 8);
      if (isAifc && chunkSize >= 22 && chunkStart + 22 <= data.length) {
        compressionType = fourCCStringBE(data, chunkStart + 18);
      }
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (channels === 0 || sampleRate === 0) {
    throw new AudioFileMetadataError('AIFF COMM chunk not found or incomplete');
  }

  const durationSeconds = frameCount > 0 && sampleRate > 0 ? frameCount / sampleRate : 0;

  let encodingType = 'PCM';
  let isBigEndian = true;

  if (isAifc) {
    if (compressionType === 'NONE') {
      encodingType = 'PCM';
      isBigEndian = true;
    } else if (compressionType === 'sowt') {
      encodingType = 'PCM';
      isBigEndian = false;
    } else if (
      compressionType === 'fl32' ||
      compressionType === 'FL32' ||
      compressionType === 'fl64' ||
      compressionType === 'FL64'
    ) {
      encodingType = 'IEEE_FLOAT';
      isBigEndian = true;
    } else {
      encodingType = 'UNKNOWN';
      isBigEndian = true;
    }
  }

  return {
    format: isAifc ? 'AIFC' : 'AIFF',
    channels,
    sampleRate,
    bitsPerSample,
    frameCount,
    durationSeconds,
    byteLength: data.length,
    encodingType,
    isBigEndian,
    unavailableFields: [],
  };
}

/**
 * Parse audio file metadata from raw bytes.
 *
 * Detects WAV vs AIFF/AIFC by the form/magic bytes and dispatches to the
 * appropriate parser. Throws AudioFileMetadataError on malformed data.
 */
export function parseAudioFileMetadata(data: Uint8Array): AudioFileMetadata {
  if (data.length < 12) {
    throw new AudioFileMetadataError('File too short for format detection');
  }

  const magic = fourCCBE(data, 0);

  if (magic === RIFF) {
    return parseWav(data);
  }

  if (magic === FORM) {
    return parseAiff(data);
  }

  throw new AudioFileMetadataError(`Unsupported audio format (magic=0x${magic.toString(16)})`);
}

// ─── Deterministic byte fixture builders (for tests) ───

function writeUint16LE(buf: number[], offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

function writeUint32LE(buf: number[], offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

function writeFourCCBE(buf: number[], offset: number, str: string): void {
  for (let i = 0; i < 4; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function writeUint16BE(buf: number[], offset: number, value: number): void {
  buf[offset] = (value >> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

function writeUint32BE(buf: number[], offset: number, value: number): void {
  buf[offset] = (value >> 24) & 0xff;
  buf[offset + 1] = (value >> 16) & 0xff;
  buf[offset + 2] = (value >> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/**
 * Write an 80-byte IEEE 754 extended float sample rate for AIFF.
 * Supports common rates (8000–192000). Falls back to 44100.
 */
function writeExtendedBE(buf: number[], offset: number, value: number): void {
  if (value <= 0) {
    for (let i = 0; i < 10; i++) buf[offset + i] = 0;
    return;
  }

  // IEEE 754 80-bit extended uses an explicit integer bit in its 64-bit
  // mantissa. Normalize common audio sample rates just like real AIFF writers.
  const exponent = Math.floor(Math.log2(value));
  const biasedExp = 16383 + exponent;
  const mantissa = (value / Math.pow(2, exponent)) * Math.pow(2, 63);
  const hiMant = Math.floor(mantissa / 0x100000000);
  const loMant = Math.floor(mantissa - hiMant * 0x100000000);

  buf[offset] = (biasedExp >> 8) & 0x7f;
  buf[offset + 1] = biasedExp & 0xff;
  writeUint32BE(buf, offset + 2, hiMant);
  writeUint32BE(buf, offset + 6, loMant);
}

/**
 * Build a minimal deterministic WAV byte array for testing.
 * The `data` chunk is filled with zeros.
 */
export function buildWavBytes(
  channels: number,
  sampleRate: number,
  bitsPerSample: number,
  frameCount: number,
): Uint8Array {
  const dataByteLength = (bitsPerSample / 8) * channels * frameCount;
  const fmtChunkSize = 16;
  const fileSize = 4 + (8 + fmtChunkSize) + (8 + dataByteLength);

  const buf = new Array(44 + dataByteLength).fill(0);
  writeFourCCBE(buf, 0, 'RIFF');
  writeUint32LE(buf, 4, fileSize);
  writeFourCCBE(buf, 8, 'WAVE');

  // fmt chunk
  writeFourCCBE(buf, 12, 'fmt ');
  writeUint32LE(buf, 16, fmtChunkSize);
  writeUint16LE(buf, 20, 1); // PCM
  writeUint16LE(buf, 22, channels);
  writeUint32LE(buf, 24, sampleRate);
  const byteRate = sampleRate * (bitsPerSample / 8) * channels;
  writeUint32LE(buf, 28, byteRate);
  const blockAlign = (bitsPerSample / 8) * channels;
  writeUint16LE(buf, 32, blockAlign);
  writeUint16LE(buf, 34, bitsPerSample);

  // data chunk
  writeFourCCBE(buf, 36, 'data');
  writeUint32LE(buf, 40, dataByteLength);

  return new Uint8Array(buf);
}

/**
 * Build a minimal deterministic AIFF byte array for testing.
 * The `SSND` chunk is omitted (not needed for COMM-based parsing).
 */
export function buildAiffBytes(
  channels: number,
  sampleRate: number,
  bitsPerSample: number,
  frameCount: number,
): Uint8Array {
  const commChunkSize = 18;
  const formSize = 4 + (8 + commChunkSize);

  const buf = new Array(12 + 8 + commChunkSize).fill(0);
  writeFourCCBE(buf, 0, 'FORM');
  writeUint32BE(buf, 4, formSize);
  writeFourCCBE(buf, 8, 'AIFF');

  // COMM chunk
  const commStart = 12;
  writeFourCCBE(buf, commStart, 'COMM');
  writeUint32BE(buf, commStart + 4, commChunkSize);
  writeUint16BE(buf, commStart + 8, channels);
  writeUint32BE(buf, commStart + 10, frameCount);
  writeUint16BE(buf, commStart + 14, bitsPerSample);
  writeExtendedBE(buf, commStart + 16, sampleRate);

  return new Uint8Array(buf);
}

/**
 * Build a minimal deterministic AIFC byte array for testing.
 */
export function buildAifcBytes(
  channels: number,
  sampleRate: number,
  bitsPerSample: number,
  frameCount: number,
  compressionType: string = 'NONE',
): Uint8Array {
  const commChunkSize = 22;
  const formSize = 4 + (8 + commChunkSize);

  const buf = new Array(12 + 8 + commChunkSize).fill(0);
  writeFourCCBE(buf, 0, 'FORM');
  writeUint32BE(buf, 4, formSize);
  writeFourCCBE(buf, 8, 'AIFC');

  // COMM chunk
  const commStart = 12;
  writeFourCCBE(buf, commStart, 'COMM');
  writeUint32BE(buf, commStart + 4, commChunkSize);
  writeUint16BE(buf, commStart + 8, channels);
  writeUint32BE(buf, commStart + 10, frameCount);
  writeUint16BE(buf, commStart + 14, bitsPerSample);
  writeExtendedBE(buf, commStart + 16, sampleRate);
  writeFourCCBE(buf, commStart + 26, compressionType.padEnd(4, ' '));

  return new Uint8Array(buf);
}
