import { describe, it, expect } from 'vitest';
import {
  encodeCreateAutomation,
  encodeUpdateAutomation,
  encodeNameCommand,
  encodeNoPayloadCommand,
  decodeAutomationList,
  decodeEngineStatePayload,
  AutomationCurveCode,
  CMD_CREATE_AUTOMATION,
  CMD_UPDATE_AUTOMATION,
  CMD_DELETE_AUTOMATION,
  CMD_ENABLE_AUTOMATION,
  CMD_DISABLE_AUTOMATION,
  CMD_LIST_AUTOMATION,
  CMD_CLEAR_AUTOMATION,
  CMD_GET_ENGINE_STATE,
  CMD_GET_CAPABILITIES,
  CMD_BATCH_SET_CHANNELS,
  CMD_BATCH_GET_CHANNELS,
  CMD_SET_CHANNEL,
  CMD_GET_CHANNEL,
  encodeSetChannels,
  encodeGetChannels,
  decodeBatchChannelValues,
  encodeSetChannel,
  encodeGetChannel,
} from '../src/protocol';

describe('Automation Protocol Encoding', () => {
  it('encodes createAutomation with correct binary layout', () => {
    const buf = encodeCreateAutomation(
      'gk_blue_auto0', // name
      AutomationCurveCode.LINEAR, // curve
      true, // enabled
      '1E-31', // canonical exact resolution text
      [
        // points
        { time: 0.0, value: 0.5 },
        { time: 4.0, value: 1.0 },
      ],
    );

    // Command byte
    expect(buf.readUInt8(0)).toBe(CMD_CREATE_AUTOMATION);

    // Read payload length
    const payloadLen = buf.readUInt32LE(1);
    expect(payloadLen).toBeGreaterThan(0);

    // Payload starts at offset 5
    const payload = buf.subarray(5);

    // Channel name: "gk_blue_auto0\0"
    const nameEnd = payload.indexOf(0);
    expect(nameEnd).toBe('gk_blue_auto0'.length);
    expect(payload.toString('utf-8', 0, nameEnd)).toBe('gk_blue_auto0');

    let offset = nameEnd + 1; // past null terminator

    // curve (u8)
    expect(payload.readUInt8(offset)).toBe(AutomationCurveCode.LINEAR);
    offset += 1;

    // enabled (u8)
    expect(payload.readUInt8(offset)).toBe(1);
    offset += 1;

    // resolution length and canonical ASCII text
    const resolutionLength = payload.readUInt32LE(offset);
    offset += 4;
    expect(payload.toString('ascii', offset, offset + resolutionLength)).toBe('1E-31');
    offset += resolutionLength;

    // n_points (u32)
    expect(payload.readUInt32LE(offset)).toBe(2);
    offset += 4;

    // Point 0: time=0.0, value=0.5
    expect(payload.readDoubleLE(offset)).toBeCloseTo(0.0, 6);
    offset += 8;
    expect(payload.readDoubleLE(offset)).toBeCloseTo(0.5, 6);
    offset += 8;

    // Point 1: time=4.0, value=1.0
    expect(payload.readDoubleLE(offset)).toBeCloseTo(4.0, 6);
    offset += 8;
    expect(payload.readDoubleLE(offset)).toBeCloseTo(1.0, 6);
  });

  it('encodes updateAutomation with UPDATE command byte', () => {
    const buf = encodeUpdateAutomation('test', AutomationCurveCode.STEP, true, '0.1', [
      { time: 0, value: 1 },
    ]);

    expect(buf.readUInt8(0)).toBe(CMD_UPDATE_AUTOMATION);
  });

  it('encodes all curve types correctly', () => {
    for (const [name, code] of [
      ['STEP', AutomationCurveCode.STEP],
      ['LINEAR', AutomationCurveCode.LINEAR],
      ['EXPONENTIAL', AutomationCurveCode.EXPONENTIAL],
    ] as const) {
      const buf = encodeCreateAutomation('ch', code, true, '0', []);
      const payload = buf.subarray(5);
      const nameEnd = payload.indexOf(0);
      expect(payload.readUInt8(nameEnd + 1)).toBe(code);
    }
  });

  it('encodes enabled=false as 0', () => {
    const buf = encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, false, '0', []);
    const payload = buf.subarray(5);
    const nameEnd = payload.indexOf(0);
    // enabled byte is right after curve byte
    expect(payload.readUInt8(nameEnd + 1 + 1)).toBe(0);
  });

  it('preserves exact decimal resolution text without numeric conversion', () => {
    const resolution = '123456789012345678901234567890.0000000000000000000000000000001';
    const buf = encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, true, resolution, []);
    const payload = buf.subarray(5);
    const nameEnd = payload.indexOf(0);
    const resolutionLengthOffset = nameEnd + 1 + 1 + 1;
    const resolutionLength = payload.readUInt32LE(resolutionLengthOffset);
    expect(
      payload.toString(
        'ascii',
        resolutionLengthOffset + 4,
        resolutionLengthOffset + 4 + resolutionLength,
      ),
    ).toBe(resolution);
  });

  it('encodes with no points', () => {
    const buf = encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, true, '0', []);
    const payload = buf.subarray(5);
    const nameEnd = payload.indexOf(0);
    const resolutionLengthOffset = nameEnd + 1 + 1 + 1;
    const resolutionLength = payload.readUInt32LE(resolutionLengthOffset);
    const nPointsOffset = resolutionLengthOffset + 4 + resolutionLength;
    expect(payload.readUInt32LE(nPointsOffset)).toBe(0);
  });

  it('rejects lossy or malformed automation inputs before sending', () => {
    expect(() =>
      encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, true, '1,0', []),
    ).toThrow();
    expect(() =>
      encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, true, '1e-7', []),
    ).toThrow();
    expect(() =>
      encodeCreateAutomation('ch', AutomationCurveCode.LINEAR, true, '1', [
        { time: Number.NaN, value: 0 },
      ]),
    ).toThrow();
    expect(() =>
      encodeCreateAutomation('ch\0bad', AutomationCurveCode.LINEAR, true, '1', []),
    ).toThrow();
  });

  it('encodes name-only commands (delete, enable, disable)', () => {
    const deleteBuf = encodeNameCommand(CMD_DELETE_AUTOMATION, 'gk_blue_auto0');
    expect(deleteBuf.readUInt8(0)).toBe(CMD_DELETE_AUTOMATION);
    expect(deleteBuf.toString('utf-8', 5, 5 + 'gk_blue_auto0'.length)).toBe('gk_blue_auto0');

    const enableBuf = encodeNameCommand(CMD_ENABLE_AUTOMATION, 'test');
    expect(enableBuf.readUInt8(0)).toBe(CMD_ENABLE_AUTOMATION);

    const disableBuf = encodeNameCommand(CMD_DISABLE_AUTOMATION, 'test');
    expect(disableBuf.readUInt8(0)).toBe(CMD_DISABLE_AUTOMATION);
  });

  it('encodes no-payload commands (list, clear)', () => {
    const listBuf = encodeNoPayloadCommand(CMD_LIST_AUTOMATION);
    expect(listBuf.readUInt8(0)).toBe(CMD_LIST_AUTOMATION);
    expect(listBuf.readUInt32LE(1)).toBe(0); // zero payload length

    const clearBuf = encodeNoPayloadCommand(CMD_CLEAR_AUTOMATION);
    expect(clearBuf.readUInt8(0)).toBe(CMD_CLEAR_AUTOMATION);
    expect(clearBuf.length).toBe(5);
  });

  it('encodes getEngineState as a no-payload command', () => {
    const buf = encodeNoPayloadCommand(CMD_GET_ENGINE_STATE);

    expect(buf.readUInt8(0)).toBe(CMD_GET_ENGINE_STATE);
    expect(buf.readUInt32LE(1)).toBe(0);
    expect(buf.length).toBe(5);
  });

  it('reserves command 0x09 for engine capabilities', () => {
    expect(CMD_GET_CAPABILITIES).toBe(0x09);
    const buf = encodeNoPayloadCommand(CMD_GET_CAPABILITIES);
    expect(buf.readUInt8(0)).toBe(0x09);
  });
});

describe('Automation List Decoding', () => {
  it('decodes empty list', () => {
    const payload = Buffer.alloc(4);
    payload.writeUInt32LE(0, 0);
    const entries = decodeAutomationList(payload);
    expect(entries).toEqual([]);
  });

  it('decodes list with one entry', () => {
    // count(4) + id(4) + enabled(1) + channel(64) + n_points(4) = 77
    const payload = Buffer.alloc(4 + 73);
    let offset = 0;
    payload.writeUInt32LE(1, offset);
    offset += 4; // count = 1
    payload.writeUInt32LE(42, offset);
    offset += 4; // id = 42
    payload.writeUInt8(1, offset);
    offset += 1; // enabled = true
    // channel name (64 bytes, null-padded)
    const name = 'gk_blue_auto0';
    payload.write(name, offset, 'utf-8');
    offset += 64;
    payload.writeUInt32LE(3, offset);
    offset += 4; // n_points = 3

    const entries = decodeAutomationList(payload);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe(42);
    expect(entries[0].enabled).toBe(true);
    expect(entries[0].channel).toBe('gk_blue_auto0');
    expect(entries[0].nPoints).toBe(3);
  });

  it('decodes list with multiple entries', () => {
    const entrySize = 4 + 1 + 64 + 4; // 73
    const payload = Buffer.alloc(4 + entrySize * 2);
    let offset = 0;
    payload.writeUInt32LE(2, offset);
    offset += 4;
    // Entry 0
    payload.writeUInt32LE(0, offset);
    offset += 4;
    payload.writeUInt8(1, offset);
    offset += 1;
    Buffer.from('ch0\0').copy(payload, offset);
    offset += 64;
    payload.writeUInt32LE(2, offset);
    offset += 4;
    // Entry 1
    payload.writeUInt32LE(1, offset);
    offset += 4;
    payload.writeUInt8(0, offset);
    offset += 1;
    Buffer.from('ch1\0').copy(payload, offset);
    offset += 64;
    payload.writeUInt32LE(0, offset);
    offset += 4;

    const entries = decodeAutomationList(payload);
    expect(entries.length).toBe(2);
    expect(entries[0].channel).toBe('ch0');
    expect(entries[0].enabled).toBe(true);
    expect(entries[1].channel).toBe('ch1');
    expect(entries[1].enabled).toBe(false);
  });

  it('decodes engine state snapshots from JSON payloads', () => {
    const snapshot = decodeEngineStatePayload(
      Buffer.from(
        JSON.stringify({
          state: 'stopped',
          stopReason: 'completed',
          engineCreated: true,
          running: false,
          sampleFrames: 88200,
          sampleRate: 44100,
          ksmps: 64,
          sequence: 7,
          lastError: '',
        }),
        'utf-8',
      ),
    );

    expect(snapshot).toEqual({
      state: 'stopped',
      stopReason: 'completed',
      engineCreated: true,
      running: false,
      sampleFrames: 88200,
      sampleRate: 44100,
      ksmps: 64,
      sequence: 7,
      lastError: '',
    });
  });
});

describe('Batch Channel Protocol Encoding (batch-channels-v1)', () => {
  const utf8Name = 'gk_blue_auto151·調';

  it('encodes a batch set payload with count, length-prefixed UTF-8 names, and little-endian f64 values', () => {
    const buf = encodeSetChannels([
      { name: 'gk_blue_auto0', value: 42.5 },
      { name: utf8Name, value: -0.25 },
    ]);

    expect(buf.readUInt8(0)).toBe(CMD_BATCH_SET_CHANNELS);
    const payloadLen = buf.readUInt32LE(1);
    expect(payloadLen).toBe(buf.length - 5);

    expect(buf.readUInt16LE(5)).toBe(2);
    // first entry: nameLength(2) + name + f64
    expect(buf.readUInt16LE(7)).toBe('gk_blue_auto0'.length);
    expect(buf.toString('utf-8', 9, 9 + 'gk_blue_auto0'.length)).toBe('gk_blue_auto0');
    expect(buf.readDoubleLE(9 + 'gk_blue_auto0'.length)).toBe(42.5);

    // second entry follows immediately
    const secondStart = 9 + 'gk_blue_auto0'.length + 8;
    expect(buf.readUInt16LE(secondStart)).toBe(Buffer.byteLength(utf8Name, 'utf-8'));
    expect(
      buf.toString(
        'utf-8',
        secondStart + 2,
        secondStart + 2 + Buffer.byteLength(utf8Name, 'utf-8'),
      ),
    ).toBe(utf8Name);
    expect(buf.readDoubleLE(secondStart + 2 + Buffer.byteLength(utf8Name, 'utf-8'))).toBe(-0.25);
  });

  it('encodes a batch get payload without values', () => {
    const buf = encodeGetChannels(['a', 'b']);
    expect(buf.readUInt8(0)).toBe(CMD_BATCH_GET_CHANNELS);
    expect(buf.readUInt16LE(5)).toBe(2);
    expect(buf.readUInt16LE(7)).toBe(1);
    expect(buf.toString('utf-8', 9, 10)).toBe('a');
    expect(buf.readUInt16LE(10)).toBe(1);
    expect(buf.toString('utf-8', 12, 13)).toBe('b');
    expect(buf.length).toBe(5 + 2 + 2 + 1 + 2 + 1);
  });

  it('round-trips values through the documented get response payload', () => {
    const payload = Buffer.alloc(2 + 3 * 8);
    payload.writeUInt16LE(3, 0);
    payload.writeDoubleLE(1.5, 2);
    payload.writeDoubleLE(-7.25, 10);
    payload.writeDoubleLE(0.1, 18);
    expect(decodeBatchChannelValues(payload)).toEqual([1.5, -7.25, 0.1]);
  });

  it('rejects empty batches, oversized batches, duplicates, NULs, long names, and non-finite values', () => {
    expect(() => encodeSetChannels([])).toThrow(RangeError);
    expect(() => encodeGetChannels([])).toThrow(RangeError);
    expect(() =>
      encodeSetChannels(Array.from({ length: 152 }, (_, i) => ({ name: `c${i}`, value: 0 }))),
    ).toThrow(RangeError);
    expect(() => encodeGetChannels(Array.from({ length: 152 }, (_, i) => `c${i}`))).toThrow(
      RangeError,
    );
    expect(() =>
      encodeSetChannels([
        { name: 'a', value: 1 },
        { name: 'a', value: 2 },
      ]),
    ).toThrow(/duplicate/i);
    expect(() => encodeGetChannels(['a', 'a'])).toThrow(/duplicate/i);
    expect(() => encodeSetChannels([{ name: 'a\0b', value: 1 }])).toThrow(/NUL/i);
    expect(() => encodeSetChannels([{ name: '', value: 1 }])).toThrow(RangeError);
    expect(() => encodeGetChannels(['x'.repeat(64)])).toThrow(/limit/i);
    expect(() => encodeSetChannels([{ name: 'a', value: Number.NaN }])).toThrow(/finite/i);
    expect(() => encodeSetChannels([{ name: 'a', value: Number.POSITIVE_INFINITY }])).toThrow(
      /finite/i,
    );
  });

  it('rejects malformed get response payloads without partial results', () => {
    expect(() => decodeBatchChannelValues(Buffer.alloc(1))).toThrow(RangeError);
    expect(() => decodeBatchChannelValues(Buffer.alloc(0))).toThrow(RangeError);
    // count says 2 but only one value present
    const truncated = Buffer.alloc(2 + 8);
    truncated.writeUInt16LE(2, 0);
    expect(() => decodeBatchChannelValues(truncated)).toThrow(/length does not match count/i);
    // trailing bytes after the declared values
    const trailing = Buffer.alloc(2 + 8 + 1);
    trailing.writeUInt16LE(1, 0);
    expect(() => decodeBatchChannelValues(trailing)).toThrow(RangeError);
  });

  it('keeps single-channel commands unchanged', () => {
    const setBuf = encodeSetChannel('gk_blue_auto0', 5);
    expect(setBuf.readUInt8(0)).toBe(CMD_SET_CHANNEL);
    const getBuf = encodeGetChannel('gk_blue_auto0');
    expect(getBuf.readUInt8(0)).toBe(CMD_GET_CHANNEL);
    expect(getBuf.toString('utf-8', 5, 5 + 'gk_blue_auto0'.length + 1)).toBe('gk_blue_auto0\0');
  });
});
