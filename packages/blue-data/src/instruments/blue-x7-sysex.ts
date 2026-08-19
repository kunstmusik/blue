import {
  type BlueX7Voice,
  createDefaultBlueX7Voice,
} from './blue-x7';

export const SINGLE_SYSEX_SIZE = 163;
export const BANK_SYSEX_SIZE = 4104;
export const SYSEX_START_OFFSET = 6;
export const BANK_NAME_OFFSET = 118;

export type BlueX7SysexType = 'single' | 'bank';

export type BlueX7SysexValidationCode =
  | 'invalid-size'
  | 'invalid-framing'
  | 'invalid-header'
  | 'invalid-payload'
  | 'invalid-checksum'
  | 'invalid-data';

export class BlueX7SysexValidationError extends Error {
  readonly code: BlueX7SysexValidationCode;

  constructor(code: BlueX7SysexValidationCode, message: string) {
    super(message);
    this.name = 'BlueX7SysexValidationError';
    this.code = code;
  }
}

/**
 * Identify whether a SysEx payload is a single voice or 32-voice bank.
 */
export function getSysexType(data: Uint8Array): BlueX7SysexType | null {
  if (data.length === BANK_SYSEX_SIZE) {
    return 'bank';
  }
  if (data.length === SINGLE_SYSEX_SIZE) {
    return 'single';
  }
  return null;
}

function assertIntegerRange(label: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BlueX7SysexValidationError(
      'invalid-data',
      `${label} must be an integer in range ${min}..${max}, got ${value}`,
    );
  }
}

function validateDecodedVoice(voice: BlueX7Voice): void {
  assertIntegerRange('Algorithm', voice.common.algorithm, 1, 32);
  assertIntegerRange('Feedback', voice.common.feedback, 0, 7);
  assertIntegerRange('Key transpose', voice.common.keyTranspose, 0, 48);
  if (voice.common.operatorEnabled.length !== 6 || voice.common.operatorEnabled.some((enabled) => typeof enabled !== 'boolean')) {
    throw new BlueX7SysexValidationError('invalid-data', 'Operator enabled flags must contain six booleans');
  }

  assertIntegerRange('LFO speed', voice.lfo.speed, 0, 99);
  assertIntegerRange('LFO delay', voice.lfo.delay, 0, 99);
  assertIntegerRange('LFO pitch modulation depth', voice.lfo.pitchModulationDepth, 0, 99);
  assertIntegerRange('LFO amplitude modulation depth', voice.lfo.amplitudeModulationDepth, 0, 99);
  assertIntegerRange('LFO wave', voice.lfo.wave, 0, 5);
  assertIntegerRange('LFO sync', voice.lfo.sync, 0, 1);

  for (let index = 0; index < voice.operators.length; index += 1) {
    const operator = voice.operators[index];
    assertIntegerRange(`Operator ${index + 1} mode`, operator.mode, 0, 1);
    assertIntegerRange(`Operator ${index + 1} sync`, operator.sync, 0, 1);
    assertIntegerRange(`Operator ${index + 1} coarse frequency`, operator.freqCoarse, 0, 31);
    assertIntegerRange(`Operator ${index + 1} fine frequency`, operator.freqFine, 0, 99);
    assertIntegerRange(`Operator ${index + 1} detune`, operator.detune, -7, 7);
    assertIntegerRange(`Operator ${index + 1} breakpoint`, operator.breakpoint, 0, 99);
    assertIntegerRange(`Operator ${index + 1} left curve`, operator.curveLeft, 0, 3);
    assertIntegerRange(`Operator ${index + 1} right curve`, operator.curveRight, 0, 3);
    assertIntegerRange(`Operator ${index + 1} left depth`, operator.depthLeft, 0, 99);
    assertIntegerRange(`Operator ${index + 1} right depth`, operator.depthRight, 0, 99);
    assertIntegerRange(`Operator ${index + 1} keyboard rate scaling`, operator.keyboardRateScaling, 0, 7);
    assertIntegerRange(`Operator ${index + 1} output level`, operator.outputLevel, 0, 99);
    // Bank decoding preserves Blue's historical packed-bit parity, which can
    // yield values through 14 even though the editor control is 0..7.
    assertIntegerRange(`Operator ${index + 1} velocity sensitivity`, operator.velocitySensitivity, 0, 14);
    assertIntegerRange(`Operator ${index + 1} amplitude modulation sensitivity`, operator.modulationAmplitude, 0, 3);
    assertIntegerRange(`Operator ${index + 1} pitch modulation sensitivity`, operator.modulationPitch, 0, 7);

    if (operator.envelope.length !== 4) {
      throw new BlueX7SysexValidationError('invalid-data', `Operator ${index + 1} envelope must contain four points`);
    }
    for (let pointIndex = 0; pointIndex < operator.envelope.length; pointIndex += 1) {
      const point = operator.envelope[pointIndex];
      assertIntegerRange(`Operator ${index + 1} envelope point ${pointIndex + 1} rate`, point.rate, 0, 99);
      assertIntegerRange(`Operator ${index + 1} envelope point ${pointIndex + 1} level`, point.level, 0, 99);
    }
  }

  if (voice.pitchEnvelope.length !== 4) {
    throw new BlueX7SysexValidationError('invalid-data', 'Pitch envelope must contain four points');
  }
  for (let pointIndex = 0; pointIndex < voice.pitchEnvelope.length; pointIndex += 1) {
    const point = voice.pitchEnvelope[pointIndex];
    assertIntegerRange(`Pitch envelope point ${pointIndex + 1} rate`, point.rate, 0, 99);
    assertIntegerRange(`Pitch envelope point ${pointIndex + 1} level`, point.level, 0, 99);
  }
}

/**
 * Validate the Yamaha DX7 SysEx envelope and return its payload type.
 * The decoder intentionally validates both the transport bytes and the
 * mapped Blue X7 domain values so malformed files never produce a partial voice.
 */
export function validateBlueX7Sysex(
  data: Uint8Array,
  expectedType?: BlueX7SysexType,
): BlueX7SysexType {
  const type = getSysexType(data);
  if (type == null) {
    if (expectedType != null) {
      const expectedSize = expectedType === 'single' ? SINGLE_SYSEX_SIZE : BANK_SYSEX_SIZE;
      throw new BlueX7SysexValidationError(
        'invalid-size',
        `Expected ${expectedSize} bytes for ${expectedType} SysEx, got ${data.length}`,
      );
    }
    throw new BlueX7SysexValidationError(
      'invalid-size',
      `Expected ${SINGLE_SYSEX_SIZE} bytes for single or ${BANK_SYSEX_SIZE} bytes for bank SysEx, got ${data.length}`,
    );
  }
  if (expectedType != null && type !== expectedType) {
    const expectedSize = expectedType === 'single' ? SINGLE_SYSEX_SIZE : BANK_SYSEX_SIZE;
    throw new BlueX7SysexValidationError(
      'invalid-size',
      `Expected ${expectedSize} bytes for ${expectedType} SysEx, got ${data.length}`,
    );
  }

  if (data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) {
    throw new BlueX7SysexValidationError('invalid-framing', 'Invalid SysEx framing: payload must start with F0 and end with F7');
  }
  if (data[1] !== 0x43) {
    throw new BlueX7SysexValidationError('invalid-framing', `Expected Yamaha manufacturer byte 0x43, got 0x${data[1].toString(16)}`);
  }
  if ((data[2] & 0xf0) !== 0) {
    throw new BlueX7SysexValidationError('invalid-header', `Invalid device/channel byte 0x${data[2].toString(16)}`);
  }

  const expectedFormat = type === 'single' ? 0 : 9;
  const expectedCount = type === 'single' ? 1 : 32;
  if (data[3] !== expectedFormat || data[4] !== expectedCount || data[5] !== 0) {
    throw new BlueX7SysexValidationError(
      'invalid-header',
      `Invalid ${type} SysEx header: expected format ${expectedFormat}, count ${expectedCount}, reserved byte 0`,
    );
  }

  for (let index = SYSEX_START_OFFSET; index < data.length - 2; index += 1) {
    if (data[index] > 0x7f) {
      throw new BlueX7SysexValidationError('invalid-payload', `SysEx payload byte ${index} is not 7-bit: ${data[index]}`);
    }
  }

  let sum = 0;
  for (let index = SYSEX_START_OFFSET; index < data.length - 2; index += 1) {
    sum += data[index];
  }
  const expectedChecksum = (128 - (sum & 0x7f)) & 0x7f;
  if (data[data.length - 2] !== expectedChecksum) {
    throw new BlueX7SysexValidationError(
      'invalid-checksum',
      `Invalid SysEx checksum: expected ${expectedChecksum}, got ${data[data.length - 2]}`,
    );
  }

  return type;
}

/**
 * Sanitize a 10-character DX7 name string by replacing non-printable ASCII characters with spaces.
 */
export function sanitizeVoiceName(raw: string): string {
  return raw.replace(/[^\x20-\x7E]/g, ' ');
}

/**
 * Format a human-readable display label for a bank slot (e.g. "3: BRASS 1" or "3: (Untitled)").
 */
export function formatBankSlotLabel(slotIndex: number, rawName: string): string {
  const trimmed = sanitizeVoiceName(rawName).trim();
  return trimmed.length > 0 ? `${slotIndex + 1}: ${trimmed}` : `${slotIndex + 1}: (Untitled)`;
}

/**
 * Extract the 32 voice names from a bank SysEx byte array.
 */
export function getBankVoiceNames(data: Uint8Array): string[] {
  validateBlueX7Sysex(data, 'bank');

  const names: string[] = [];
  for (let i = 0; i < 32; i++) {
    let nameStr = '';
    const offset = i * 128 + BANK_NAME_OFFSET + SYSEX_START_OFFSET;
    for (let j = 0; j < 10; j++) {
      nameStr += String.fromCharCode(data[offset + j]);
    }
    names.push(sanitizeVoiceName(nameStr));
  }
  return names;
}

/**
 * Decode a single-voice DX7 SysEx binary into a BlueX7Voice and name.
 */
export function decodeSingleVoice(data: Uint8Array): { voice: BlueX7Voice; name: string } {
  validateBlueX7Sysex(data, 'single');

  const voice = createDefaultBlueX7Voice();

  // Operators: DX7 stores Op 6 first down to Op 1 (mapped to Blue Op index 0..5)
  for (let opIndex = 0; opIndex < 6; opIndex++) {
    const op = voice.operators[opIndex];
    let offset = SYSEX_START_OFFSET + (5 - opIndex) * 21;

    op.envelope[0].rate = data[offset++];
    op.envelope[1].rate = data[offset++];
    op.envelope[2].rate = data[offset++];
    op.envelope[3].rate = data[offset++];

    op.envelope[0].level = data[offset++];
    op.envelope[1].level = data[offset++];
    op.envelope[2].level = data[offset++];
    op.envelope[3].level = data[offset++];

    op.breakpoint = data[offset++];
    op.depthLeft = data[offset++];
    op.depthRight = data[offset++];

    op.curveLeft = data[offset++];
    op.curveRight = data[offset++];

    op.keyboardRateScaling = data[offset++];
    op.modulationAmplitude = data[offset++];
    op.velocitySensitivity = data[offset++];

    op.outputLevel = data[offset++];

    op.mode = data[offset++];
    op.freqCoarse = data[offset++];
    op.freqFine = data[offset++];
    op.detune = data[offset++] - 7;
  }

  let offset = SYSEX_START_OFFSET + 126;

  // Pitch Envelope Generator (PEG)
  voice.pitchEnvelope[0].rate = data[offset++];
  voice.pitchEnvelope[1].rate = data[offset++];
  voice.pitchEnvelope[2].rate = data[offset++];
  voice.pitchEnvelope[3].rate = data[offset++];

  voice.pitchEnvelope[0].level = data[offset++];
  voice.pitchEnvelope[1].level = data[offset++];
  voice.pitchEnvelope[2].level = data[offset++];
  voice.pitchEnvelope[3].level = data[offset++];

  // Algorithm (1-based in Blue, 0-based in DX7)
  voice.common.algorithm = data[offset++] + 1;

  // Feedback & Oscillator Sync
  voice.common.feedback = data[offset++];
  const syncVal = data[offset++];
  for (let i = 0; i < 6; i++) {
    voice.operators[i].sync = syncVal;
  }

  // LFO
  voice.lfo.speed = data[offset++];
  voice.lfo.delay = data[offset++];
  voice.lfo.pitchModulationDepth = data[offset++];
  voice.lfo.amplitudeModulationDepth = data[offset++];
  voice.lfo.sync = data[offset++];
  voice.lfo.wave = data[offset++];

  // PMS for all operators
  const pmsVal = data[offset++];
  for (let i = 0; i < 6; i++) {
    voice.operators[i].modulationPitch = pmsVal;
  }

  // Key Transpose
  voice.common.keyTranspose = data[offset++];

  // Operator Enables: all enabled by default in DX7 voice import
  voice.common.operatorEnabled = [true, true, true, true, true, true];

  validateDecodedVoice(voice);

  // Voice Name: 10 bytes at offset 151 (or offset + 6 in sequence)
  let rawName = '';
  for (let j = 0; j < 10; j++) {
    rawName += String.fromCharCode(data[offset + j]);
  }
  const name = sanitizeVoiceName(rawName);

  return { voice, name };
}

/**
 * Decode a specific voice from a 32-voice bank DX7 SysEx binary.
 */
export function decodeBankVoice(
  data: Uint8Array,
  slotIndex: number,
): { voice: BlueX7Voice; name: string } {
  validateBlueX7Sysex(data, 'bank');
  if (slotIndex < 0 || slotIndex >= 32) {
    throw new Error(`Invalid slot index ${slotIndex}, must be 0..31`);
  }

  const voice = createDefaultBlueX7Voice();
  const patchOffset = SYSEX_START_OFFSET + slotIndex * 128;

  // Operators: DX7 stores Op 6 down to Op 1 in 17-byte blocks
  for (let opIndex = 0; opIndex < 6; opIndex++) {
    const op = voice.operators[opIndex];
    let offset = patchOffset + (5 - opIndex) * 17;

    op.envelope[0].rate = data[offset++];
    op.envelope[1].rate = data[offset++];
    op.envelope[2].rate = data[offset++];
    op.envelope[3].rate = data[offset++];

    op.envelope[0].level = data[offset++];
    op.envelope[1].level = data[offset++];
    op.envelope[2].level = data[offset++];
    op.envelope[3].level = data[offset++];

    op.breakpoint = data[offset++];
    op.depthLeft = data[offset++];
    op.depthRight = data[offset++];

    // Byte 11: curveRight = temp & 3, curveLeft = (temp & 12) >>> 2
    const byte11 = data[offset++];
    op.curveRight = byte11 & 3;
    op.curveLeft = (byte11 & 12) >>> 2;

    // Byte 12: KRS = temp & 7, Detune = ((temp & 112) >>> 3) - 7
    const byte12 = data[offset++];
    op.keyboardRateScaling = byte12 & 7;
    op.detune = ((byte12 & 112) >>> 3) - 7;

    // Byte 13: AMS = temp & 3, Velocity Sens = (temp & 56) >>> 2 (matching Java parity)
    const byte13 = data[offset++];
    op.modulationAmplitude = byte13 & 3;
    op.velocitySensitivity = (byte13 & 56) >>> 2;

    // Byte 14: Output Level
    op.outputLevel = data[offset++];

    // Byte 15: Mode = temp & 1, Freq Coarse = (temp & 62) >>> 1
    const byte15 = data[offset++];
    op.mode = byte15 & 1;
    op.freqCoarse = (byte15 & 62) >>> 1;

    // Byte 16: Freq Fine
    op.freqFine = data[offset++];
  }

  let offset = patchOffset + 102;

  // PEG (bytes 102..109)
  voice.pitchEnvelope[0].rate = data[offset++];
  voice.pitchEnvelope[1].rate = data[offset++];
  voice.pitchEnvelope[2].rate = data[offset++];
  voice.pitchEnvelope[3].rate = data[offset++];

  voice.pitchEnvelope[0].level = data[offset++];
  voice.pitchEnvelope[1].level = data[offset++];
  voice.pitchEnvelope[2].level = data[offset++];
  voice.pitchEnvelope[3].level = data[offset++];

  // Byte 110: Algorithm (1-based)
  voice.common.algorithm = data[offset++] + 1;

  // Byte 111: Feedback & Oscillator Sync
  const byte111 = data[offset++];
  voice.common.feedback = byte111 & 7;
  const syncVal = (byte111 & 8) >>> 3;
  for (let i = 0; i < 6; i++) {
    voice.operators[i].sync = syncVal;
  }

  // Bytes 112..115: LFO speed, delay, PMD, AMD
  voice.lfo.speed = data[offset++];
  voice.lfo.delay = data[offset++];
  voice.lfo.pitchModulationDepth = data[offset++];
  voice.lfo.amplitudeModulationDepth = data[offset++];

  // Byte 116: LFO sync, wave, and PMS
  const byte116 = data[offset++];
  voice.lfo.sync = byte116 & 1;
  voice.lfo.wave = (byte116 & 14) >>> 1;
  const pmsVal = (byte116 & 112) >>> 4;
  for (let i = 0; i < 6; i++) {
    voice.operators[i].modulationPitch = pmsVal;
  }

  // Byte 117: Key Transpose
  voice.common.keyTranspose = data[offset++];

  // Operator Enables: all enabled.
  //
  // Intentional divergence from Java Blue: Java's importFromBank never
  // touches the target instrument's enable flags (its importFromSinglePatch
  // sets them all to true). The TypeScript import model replaces the whole
  // voice atomically, so it normalizes enables to all-true for both forms —
  // matching the single-voice behavior and DX7 semantics where a voice
  // always routes all six operators.
  voice.common.operatorEnabled = [true, true, true, true, true, true];

  // Bytes 118..127: Voice Name (10 ASCII chars)
  let rawName = '';
  for (let j = 0; j < 10; j++) {
    rawName += String.fromCharCode(data[offset + j]);
  }
  const name = sanitizeVoiceName(rawName);

  validateDecodedVoice(voice);

  return { voice, name };
}
