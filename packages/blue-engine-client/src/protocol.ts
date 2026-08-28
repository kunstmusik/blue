/**
 * Binary protocol constants for the blue-engine ZMQ communication.
 * Based on the C++ blue-engine protocol specification.
 */

// Engine lifecycle commands
export const CMD_CREATE_ENGINE = 0x01;
export const CMD_COMPILE_ORC = 0x02;
export const CMD_READ_SCORE = 0x03;
export const CMD_SET_OPTION = 0x04;
export const CMD_START = 0x05;
export const CMD_STOP = 0x06;
export const CMD_DESTROY_ENGINE = 0x07;
export const CMD_EXIT = CMD_DESTROY_ENGINE;
export const CMD_GET_ENGINE_STATE = 0x08;
export const CMD_GET_CAPABILITIES = 0x09;

export const ENGINE_STATE_TOPIC = 'engine.state';

// Channel commands
export const CMD_SET_CHANNEL = 0x10;
export const CMD_GET_CHANNEL = 0x11;
export const CMD_CREATE_CHANNEL = 0x12;
export const CMD_GET_SHM_NAME = 0x13;

// Batch channel commands (batch-channels-v1). Allocated from the channel
// range without changing existing values.
export const CMD_BATCH_SET_CHANNELS = 0x14;
export const CMD_BATCH_GET_CHANNELS = 0x15;

/**
 * Client-side batch bound: one BlueX7 owns exactly 151 Parameters, so the
 * BlueX7 caller never needs a larger batch. The engine may accept more.
 */
export const MAX_BATCH_CHANNELS = 151;

/**
 * Channel names must fit the engine's existing shared-memory bridge field
 * (CHANNEL_NAME_SIZE 64, null-terminated), so at most 63 UTF-8 bytes.
 */
export const MAX_BATCH_NAME_BYTES = 63;

export interface BatchChannelEntry {
  name: string;
  value: number;
}

function validateBatchName(name: string): Buffer {
  if (typeof name !== 'string' || name.length === 0) {
    throw new RangeError('Batch channel name must be a non-empty string');
  }
  if (name.includes('\0')) {
    throw new RangeError('Batch channel name must not contain NUL');
  }
  const nameBuf = Buffer.from(name, 'utf-8');
  if (nameBuf.length > MAX_BATCH_NAME_BYTES) {
    throw new RangeError(
      `Batch channel name exceeds the engine channel-name limit (${MAX_BATCH_NAME_BYTES} bytes)`,
    );
  }
  return nameBuf;
}

/**
 * Encode a batch channel set command. The payload is validated in full
 * before allocation: count bounds, non-empty NUL-free names within the
 * engine name limit, finite values, and no duplicate names.
 *
 * Payload format:
 *   count:u16 LE
 *   repeat count times: nameLength:u16 LE + name:utf8[nameLength] + value:f64 LE
 */
export function encodeSetChannels(entries: readonly BatchChannelEntry[]): Buffer {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new RangeError('Batch channel set requires at least one entry');
  }
  if (entries.length > MAX_BATCH_CHANNELS) {
    throw new RangeError(`Batch channel set exceeds ${MAX_BATCH_CHANNELS} entries`);
  }

  const parts: Buffer[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      throw new RangeError('Batch channel values must be finite');
    }
    if (seen.has(entry.name)) {
      throw new RangeError(`Batch channel set contains duplicate name: ${entry.name}`);
    }
    seen.add(entry.name);
    const nameBuf = validateBatchName(entry.name);
    const entryBuf = Buffer.alloc(2 + nameBuf.length + 8);
    entryBuf.writeUInt16LE(nameBuf.length, 0);
    nameBuf.copy(entryBuf, 2);
    entryBuf.writeDoubleLE(entry.value, 2 + nameBuf.length);
    parts.push(entryBuf);
  }

  const header = Buffer.alloc(2);
  header.writeUInt16LE(entries.length, 0);
  const payload = Buffer.concat([header, ...parts]);

  const buf = Buffer.alloc(5 + payload.length);
  buf.writeUInt8(CMD_BATCH_SET_CHANNELS, 0);
  buf.writeUInt32LE(payload.length, 1);
  payload.copy(buf, 5);
  return buf;
}

/**
 * Encode a batch channel get command (name-only entries).
 *
 * Payload format:
 *   count:u16 LE
 *   repeat count times: nameLength:u16 LE + name:utf8[nameLength]
 */
export function encodeGetChannels(names: readonly string[]): Buffer {
  if (!Array.isArray(names) || names.length === 0) {
    throw new RangeError('Batch channel get requires at least one name');
  }
  if (names.length > MAX_BATCH_CHANNELS) {
    throw new RangeError(`Batch channel get exceeds ${MAX_BATCH_CHANNELS} entries`);
  }

  const parts: Buffer[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      throw new RangeError(`Batch channel get contains duplicate name: ${name}`);
    }
    seen.add(name);
    const nameBuf = validateBatchName(name);
    const entryBuf = Buffer.alloc(2 + nameBuf.length);
    entryBuf.writeUInt16LE(nameBuf.length, 0);
    nameBuf.copy(entryBuf, 2);
    parts.push(entryBuf);
  }

  const header = Buffer.alloc(2);
  header.writeUInt16LE(names.length, 0);
  const payload = Buffer.concat([header, ...parts]);

  const buf = Buffer.alloc(5 + payload.length);
  buf.writeUInt8(CMD_BATCH_GET_CHANNELS, 0);
  buf.writeUInt32LE(payload.length, 1);
  payload.copy(buf, 5);
  return buf;
}

/**
 * Decode a successful batch get response payload.
 *
 * Payload format: count:u16 LE + count times value:f64 LE
 * Values correspond exactly to request order. Truncated payloads, count
 * mismatches, or trailing bytes throw RangeError (no partial value list).
 */
export function decodeBatchChannelValues(payload: Buffer): number[] {
  if (!Buffer.isBuffer(payload) || payload.length < 2) {
    throw new RangeError('Batch channel values payload is truncated');
  }
  const count = payload.readUInt16LE(0);
  if (payload.length !== 2 + count * 8) {
    throw new RangeError('Batch channel values payload length does not match count');
  }
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(payload.readDoubleLE(2 + i * 8));
  }
  return values;
}

// Automation commands
export const CMD_CREATE_AUTOMATION = 0x20;
export const CMD_UPDATE_AUTOMATION = 0x21;
export const CMD_DELETE_AUTOMATION = 0x22;
export const CMD_ENABLE_AUTOMATION = 0x23;
export const CMD_DISABLE_AUTOMATION = 0x24;
export const CMD_LIST_AUTOMATION = 0x25;
export const CMD_CLEAR_AUTOMATION = 0x26;

/**
 * Automation curve types — must match C++ AutomationCurve enum values.
 */
export enum AutomationCurveCode {
  STEP = 0x00,
  LINEAR = 0x01,
  EXPONENTIAL = 0x02,
}

/**
 * An automation point (time/value pair).
 */
export interface AutomationPoint {
  time: number;
  value: number;
}

export type EngineLifecycleState = 'empty' | 'ready' | 'running' | 'stopped';

export type EngineStopReason = 'none' | 'completed' | 'stop-requested' | 'destroyed' | 'error';

export interface EngineStateSnapshot {
  state: EngineLifecycleState;
  stopReason: EngineStopReason;
  engineCreated: boolean;
  running: boolean;
  sampleFrames: number;
  sampleRate: number;
  ksmps: number;
  sequence: number;
  lastError: string;
}

/**
 * Encode a command with optional string payload into a binary buffer.
 * Format: [command: uint8][payload_length: uint32 LE][payload: bytes]
 */
export function encodeCommand(cmd: number, payload?: string): Buffer {
  if (!payload) {
    return Buffer.from([cmd]);
  }
  const payloadBuf = Buffer.from(payload, 'utf-8');
  const buf = Buffer.alloc(5 + payloadBuf.length);
  buf.writeUInt8(cmd, 0);
  buf.writeUInt32LE(payloadBuf.length, 1);
  payloadBuf.copy(buf, 5);
  return buf;
}

/**
 * Decode a response buffer.
 * Returns the payload string, or empty string for no-payload responses.
 */
export function decodeResponse(buf: Buffer): string {
  if (buf.length === 0) return '';
  if (buf.length === 1) return '';
  if (buf.length < 5) return buf.toString('utf-8', 1);

  const payloadLen = buf.readUInt32LE(1);
  if (payloadLen === 0) return '';
  return buf.toString('utf-8', 5, 5 + payloadLen);
}

/**
 * Encode a channel set command.
 * Format: [CMD_SET_CHANNEL][payload: name\0 + value_f64]
 * Note: name must be null-terminated (matching engine protocol)
 */
export function encodeSetChannel(name: string, value: number): Buffer {
  const nameBuf = Buffer.from(name + '\0', 'utf-8');
  const valueBuf = Buffer.alloc(8);
  valueBuf.writeDoubleLE(value, 0);
  const payload = Buffer.concat([nameBuf, valueBuf]);

  const buf = Buffer.alloc(5 + payload.length);
  buf.writeUInt8(CMD_SET_CHANNEL, 0);
  buf.writeUInt32LE(payload.length, 1);
  payload.copy(buf, 5);
  return buf;
}

/**
 * Encode a channel get command.
 * Format: [CMD_GET_CHANNEL][payload: name\0]
 * Note: name must be null-terminated (matching engine protocol)
 */
export function encodeGetChannel(name: string): Buffer {
  const nameBuf = Buffer.from(name + '\0', 'utf-8');

  const buf = Buffer.alloc(5 + nameBuf.length);
  buf.writeUInt8(CMD_GET_CHANNEL, 0);
  buf.writeUInt32LE(nameBuf.length, 1);
  nameBuf.copy(buf, 5);
  return buf;
}

/**
 * Decode a channel value response.
 * Returns the float64 value.
 */
export function decodeChannelValue(buf: Buffer): number {
  if (buf.length < 9) return 0;
  return buf.readDoubleLE(1);
}

export function decodeEngineStatePayload(payload: Buffer | string): EngineStateSnapshot {
  const raw = typeof payload === 'string' ? payload : payload.toString('utf-8');
  const parsed = JSON.parse(raw) as Partial<EngineStateSnapshot>;

  return {
    state: (parsed.state ?? 'empty') as EngineLifecycleState,
    stopReason: (parsed.stopReason ?? 'none') as EngineStopReason,
    engineCreated: Boolean(parsed.engineCreated),
    running: Boolean(parsed.running),
    sampleFrames: Number(parsed.sampleFrames ?? 0),
    sampleRate: Number(parsed.sampleRate ?? 0),
    ksmps: Number(parsed.ksmps ?? 0),
    sequence: Number(parsed.sequence ?? 0),
    lastError: typeof parsed.lastError === 'string' ? parsed.lastError : '',
  };
}

// ─── Automation Encoding ───

/**
 * Reproduce the small, allocation-bounded part of BigDecimal.toString needed
 * at the wire boundary. The engine remains authoritative, but rejecting a
 * non-canonical spelling here prevents a request that the native parser must
 * inevitably reject (for example `1e-7` instead of `1E-7`).
 */
function canonicalJavaDecimalText(text: string): string | null {
  const match = /^(-?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;

  const integerDigits = match[2] ?? '';
  const fractionalDigits = match[3] ?? match[4] ?? '';
  const rawDigits = integerDigits + fractionalDigits;
  if (rawDigits.length === 0) return null;

  const digits = rawDigits.replace(/^0+(?=\d)/, '');
  const exponent = BigInt(match[5] ?? '0');
  const scaleBig = BigInt(fractionalDigits.length) - exponent;
  if (scaleBig < -2147483648n || scaleBig > 2147483647n) return null;
  const scale = Number(scaleBig);
  const negative = match[1] === '-' && digits !== '0';
  const sign = negative ? '-' : '';
  const precision = digits.length;
  const adjusted = precision - 1 - scale;

  if (scale === 0) return sign + digits;
  if (scale > 0 && adjusted >= -6) {
    if (scale >= precision) {
      return sign + '0.' + '0'.repeat(scale - precision) + digits;
    }
    return sign + digits.slice(0, precision - scale) + '.' + digits.slice(precision - scale);
  }

  const mantissa = precision > 1 ? digits[0] + '.' + digits.slice(1) : digits;
  const exponentText = adjusted >= 0 ? `+${adjusted}` : String(adjusted);
  return sign + mantissa + 'E' + exponentText;
}

/**
 * Encode a CREATE_AUTOMATION or UPDATE_AUTOMATION command.
 *
 * Resolution is deliberately transported as canonical Java BigDecimal text.
 * It must not be converted through a JavaScript number on this boundary.
 *
 * Payload format (matching C++ ZmqHandler):
 *   channel_name\0 + curve(u8) + enabled(u8) + resolutionLength(u32)
 *   + resolution ASCII bytes + n_points(u32)
 *   + points[] (each: time(f64) + value(f64) = 16 bytes)
 */
function encodeAutomation(
  command: number,
  name: string,
  curve: AutomationCurveCode,
  enabled: boolean,
  resolutionDecimal: string,
  points: AutomationPoint[],
): Buffer {
  if (name.length === 0 || name.includes('\0')) {
    throw new RangeError('Automation channel name must be non-empty and must not contain NUL');
  }
  if (!Number.isInteger(curve) || curve < AutomationCurveCode.STEP || curve > AutomationCurveCode.EXPONENTIAL) {
    throw new RangeError(`Unsupported automation curve code: ${curve}`);
  }
  if (typeof resolutionDecimal !== 'string' || resolutionDecimal.length === 0) {
    throw new RangeError('Automation resolution must be non-empty canonical decimal text');
  }
  const canonicalResolution = canonicalJavaDecimalText(resolutionDecimal);
  if (canonicalResolution === null) {
    throw new RangeError(`Invalid automation resolution text: ${resolutionDecimal}`);
  }
  if (canonicalResolution !== resolutionDecimal) {
    throw new RangeError(`Automation resolution must use canonical Java decimal text: ${resolutionDecimal}`);
  }
  const resolutionBuf = Buffer.from(resolutionDecimal, 'ascii');
  if (resolutionBuf.toString('ascii') !== resolutionDecimal ||
      [...resolutionBuf].some((byte) => byte < 0x20 || byte > 0x7e)) {
    throw new RangeError('Automation resolution must contain printable ASCII only');
  }
  if (points.length > 0xffff_ffff) {
    throw new RangeError('Too many automation points');
  }
  for (const point of points) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) {
      throw new RangeError('Automation points must contain finite numbers');
    }
  }

  const nameBuf = Buffer.from(`${name}\0`, 'utf8');
  const headerSize = nameBuf.length + 1 + 1 + 4 + resolutionBuf.length + 4;
  const payloadSize = headerSize + points.length * 16;
  if (payloadSize > 0xffff_ffff) {
    throw new RangeError('Automation payload is too large');
  }

  const payload = Buffer.alloc(payloadSize);
  let offset = 0;
  nameBuf.copy(payload, offset);
  offset += nameBuf.length;
  payload.writeUInt8(curve, offset);
  offset += 1;
  payload.writeUInt8(enabled ? 1 : 0, offset);
  offset += 1;
  payload.writeUInt32LE(resolutionBuf.length, offset);
  offset += 4;
  resolutionBuf.copy(payload, offset);
  offset += resolutionBuf.length;
  payload.writeUInt32LE(points.length, offset);
  offset += 4;
  for (const point of points) {
    payload.writeDoubleLE(point.time, offset);
    offset += 8;
    payload.writeDoubleLE(point.value, offset);
    offset += 8;
  }

  const commandBuffer = Buffer.alloc(5 + payloadSize);
  commandBuffer.writeUInt8(command, 0);
  commandBuffer.writeUInt32LE(payloadSize, 1);
  payload.copy(commandBuffer, 5);
  return commandBuffer;
}

export function encodeCreateAutomation(
  name: string,
  curve: AutomationCurveCode,
  enabled: boolean,
  resolutionDecimal: string,
  points: AutomationPoint[],
): Buffer {
  return encodeAutomation(CMD_CREATE_AUTOMATION, name, curve, enabled, resolutionDecimal, points);
}

/**
 * Encode an UPDATE_AUTOMATION command (same payload as CREATE).
 */
export function encodeUpdateAutomation(
  name: string,
  curve: AutomationCurveCode,
  enabled: boolean,
  resolutionDecimal: string,
  points: AutomationPoint[],
): Buffer {
  return encodeAutomation(CMD_UPDATE_AUTOMATION, name, curve, enabled, resolutionDecimal, points);
}

/**
 * Encode a name-only command (DELETE, ENABLE, DISABLE).
 * Payload: channel_name\0
 */
export function encodeNameCommand(cmd: number, name: string): Buffer {
  const nameBuf = Buffer.from(name + '\0', 'utf-8');

  const buf = Buffer.alloc(5 + nameBuf.length);
  buf.writeUInt8(cmd, 0);
  buf.writeUInt32LE(nameBuf.length, 1);
  nameBuf.copy(buf, 5);
  return buf;
}

/**
 * Encode a no-payload command (LIST, CLEAR).
 */
export function encodeNoPayloadCommand(cmd: number): Buffer {
  const buf = Buffer.alloc(5);
  buf.writeUInt8(cmd, 0);
  buf.writeUInt32LE(0, 1);
  return buf;
}

/**
 * Automation entry returned by LIST_AUTOMATIONS.
 */
export interface AutomationListEntry {
  id: number;
  enabled: boolean;
  channel: string;
  nPoints: number;
}

/**
 * Decode a LIST_AUTOMATIONS response payload.
 * Response format: count(u32) + per-entry: id(u32) + enabled(u8) + channel(64B) + n_points(u32)
 */
export function decodeAutomationList(payload: Buffer): AutomationListEntry[] {
  const entries: AutomationListEntry[] = [];
  if (payload.length < 4) return entries;

  const count = payload.readUInt32LE(0);
  let offset = 4;

  // Per entry: id(4) + enabled(1) + channel(64) + n_points(4) = 73 bytes
  const entrySize = 4 + 1 + 64 + 4;

  for (let i = 0; i < count && offset + entrySize <= payload.length; i++) {
    const id = payload.readUInt32LE(offset);
    offset += 4;

    const enabled = payload.readUInt8(offset) !== 0;
    offset += 1;

    // Channel name is 64 bytes, null-terminated
    const channelRaw = payload.toString('utf-8', offset, offset + 64);
    const channel = channelRaw.split('\0')[0];
    offset += 64;

    const nPoints = payload.readUInt32LE(offset);
    offset += 4;

    entries.push({ id, enabled, channel, nPoints });
  }

  return entries;
}
