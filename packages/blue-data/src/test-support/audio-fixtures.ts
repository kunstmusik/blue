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

  const buf = Array.from({ length: 44 + dataByteLength }, () => 0);
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

  const buf = Array.from({ length: 12 + 8 + commChunkSize }, () => 0);
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

  const buf = Array.from({ length: 12 + 8 + commChunkSize }, () => 0);
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
