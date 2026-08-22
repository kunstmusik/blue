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
