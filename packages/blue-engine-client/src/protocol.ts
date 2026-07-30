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
 * Encode a CREATE_AUTOMATION or UPDATE_AUTOMATION command.
 *
 * Payload format (matching C++ ZmqHandler):
 *   channel_name\0 + curve(u8) + enabled(u8) + resolution(f64)
 *   + resolutionScale(i32) + highPrecision(u8) + n_points(u32)
 *   + points[] (each: time(f64) + value(f64) = 16 bytes)
 */
export function encodeCreateAutomation(
  name: string,
  curve: AutomationCurveCode,
  enabled: boolean,
  resolution: number,
  resolutionScale: number,
  highPrecision: boolean,
  points: AutomationPoint[],
): Buffer {
  const nameBuf = Buffer.from(name + '\0', 'utf-8');
  const nPoints = points.length;
  // header: name\0 + curve(1) + enabled(1) + resolution(8) + resolutionScale(4) + highPrecision(1) + n_points(4)
  const headerSize = nameBuf.length + 1 + 1 + 8 + 4 + 1 + 4;
  const pointsSize = nPoints * 16;
  const payloadSize = headerSize + pointsSize;

  const payload = Buffer.alloc(payloadSize);
  let offset = 0;

  // channel name (null-terminated)
  nameBuf.copy(payload, offset);
  offset += nameBuf.length;

  // curve (u8)
  payload.writeUInt8(curve, offset);
  offset += 1;

  // enabled (u8)
  payload.writeUInt8(enabled ? 1 : 0, offset);
  offset += 1;

  // resolution (f64 LE)
  payload.writeDoubleLE(resolution, offset);
  offset += 8;

  // resolutionScale (i32 LE)
  payload.writeInt32LE(resolutionScale, offset);
  offset += 4;

  // highPrecision (u8)
  payload.writeUInt8(highPrecision ? 1 : 0, offset);
  offset += 1;

  // n_points (u32 LE)
  payload.writeUInt32LE(nPoints, offset);
  offset += 4;

  // points array
  for (const pt of points) {
    payload.writeDoubleLE(pt.time, offset);
    offset += 8;
    payload.writeDoubleLE(pt.value, offset);
    offset += 8;
  }

  // Wrap in 5-byte command header
  const cmd = Buffer.alloc(5 + payloadSize);
  cmd.writeUInt8(CMD_CREATE_AUTOMATION, 0);
  cmd.writeUInt32LE(payloadSize, 1);
  payload.copy(cmd, 5);

  return cmd;
}

/**
 * Encode an UPDATE_AUTOMATION command (same payload as CREATE).
 */
export function encodeUpdateAutomation(
  name: string,
  curve: AutomationCurveCode,
  enabled: boolean,
  resolution: number,
  resolutionScale: number,
  highPrecision: boolean,
  points: AutomationPoint[],
): Buffer {
  const buf = encodeCreateAutomation(name, curve, enabled, resolution, resolutionScale, highPrecision, points);
  // Replace the command byte from CREATE (0x20) to UPDATE (0x21)
  buf.writeUInt8(CMD_UPDATE_AUTOMATION, 0);
  return buf;
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
