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
  /** Audio container format identified from the file header. */
  format: 'WAV' | 'AIFF' | 'AIFC';
  /** Number of audio channels declared in the header. */
  channels: number;
  /** Audio samples per second in each channel. */
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

/** Reports an audio header or format error that prevents metadata extraction. */
export class AudioFileMetadataError extends Error {
  /** Creates a metadata error describing the file header or format problem. */
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
