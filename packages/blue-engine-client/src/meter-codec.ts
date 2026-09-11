export interface DecodedChannelMeterReading {
  readonly csdKey: string;
  readonly rms: readonly number[];
  readonly peak: readonly number[];
}

export interface DecodedMeterFrame {
  readonly sequence: number;
  readonly nchnls: number;
  readonly channels: readonly DecodedChannelMeterReading[];
}

export interface EncodeMeterChannelInput {
  readonly csdKey: string;
  readonly rms: readonly number[];
  readonly peak: readonly number[];
}

export interface EncodeMeterFrameInput {
  readonly sequence: number;
  readonly nchnls: number;
  readonly channels: readonly EncodeMeterChannelInput[];
}

const HEADER_SIZE = 8;
const CSD_KEY_SIZE = 64;

function sanitizeFloat(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value) || value < 0) {
    return 0.0;
  }
  return value;
}

/**
 * Encode a meter frame into a binary buffer adhering to engine-meter-protocol.md
 */
export function encodeMeterFrame(input: EncodeMeterFrameInput): Buffer {
  const { sequence, nchnls, channels } = input;
  const channelCount = channels.length;
  const entrySize = CSD_KEY_SIZE + nchnls * 8 * 2;
  const totalSize = HEADER_SIZE + channelCount * entrySize;

  const buf = Buffer.alloc(totalSize);
  buf.writeUInt32LE(sequence >>> 0, 0);
  buf.writeUInt16LE(channelCount, 4);
  buf.writeUInt16LE(nchnls, 6);

  let offset = HEADER_SIZE;
  for (let i = 0; i < channelCount; i++) {
    const ch = channels[i];
    // Write csdKey (up to 63 chars null-terminated)
    const keyBuf = Buffer.from(ch.csdKey, 'utf-8');
    const copyLen = Math.min(keyBuf.length, CSD_KEY_SIZE - 1);
    keyBuf.copy(buf, offset, 0, copyLen);
    buf.fill(0, offset + copyLen, offset + CSD_KEY_SIZE);

    let valOffset = offset + CSD_KEY_SIZE;
    // Write RMS values
    for (let c = 0; c < nchnls; c++) {
      const v = sanitizeFloat(ch.rms[c] ?? 0.0);
      buf.writeDoubleLE(v, valOffset);
      valOffset += 8;
    }
    // Write Peak values
    for (let c = 0; c < nchnls; c++) {
      const v = sanitizeFloat(ch.peak[c] ?? 0.0);
      buf.writeDoubleLE(v, valOffset);
      valOffset += 8;
    }

    offset += entrySize;
  }

  return buf;
}

/**
 * Decode a binary meter frame from engine-meter-protocol.md
 */
export function decodeMeterFrame(buf: Buffer): DecodedMeterFrame {
  if (!buf || buf.length < HEADER_SIZE) {
    throw new Error(`Buffer too small for meter frame header (got ${buf?.length ?? 0} bytes)`);
  }

  const sequence = buf.readUInt32LE(0);
  const channelCount = buf.readUInt16LE(4);
  const nchnls = buf.readUInt16LE(6);

  if (nchnls === 0) {
    throw new Error('Invalid meter frame: nchnls cannot be 0');
  }

  const entrySize = CSD_KEY_SIZE + nchnls * 8 * 2;
  const expectedTotalSize = HEADER_SIZE + channelCount * entrySize;
  if (buf.length < expectedTotalSize) {
    throw new Error(
      `Buffer size mismatch for meter frame: expected ${expectedTotalSize}, got ${buf.length}`,
    );
  }

  const channels: DecodedChannelMeterReading[] = new Array(channelCount);
  let offset = HEADER_SIZE;

  for (let i = 0; i < channelCount; i++) {
    // Read null-terminated csdKey
    let keyEnd = offset;
    const maxKeyEnd = offset + CSD_KEY_SIZE;
    while (keyEnd < maxKeyEnd && buf[keyEnd] !== 0) {
      keyEnd++;
    }
    const csdKey = buf.toString('utf-8', offset, keyEnd);

    let valOffset = offset + CSD_KEY_SIZE;
    const rms = new Float64Array(nchnls);
    for (let c = 0; c < nchnls; c++) {
      rms[c] = sanitizeFloat(buf.readDoubleLE(valOffset));
      valOffset += 8;
    }

    const peak = new Float64Array(nchnls);
    for (let c = 0; c < nchnls; c++) {
      peak[c] = sanitizeFloat(buf.readDoubleLE(valOffset));
      valOffset += 8;
    }

    channels[i] = {
      csdKey,
      rms: Array.from(rms),
      peak: Array.from(peak),
    };

    offset += entrySize;
  }

  return {
    sequence,
    nchnls,
    channels,
  };
}
