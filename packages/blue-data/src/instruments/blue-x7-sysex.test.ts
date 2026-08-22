import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getSysexType,
  getBankVoiceNames,
  decodeSingleVoice,
  decodeBankVoice,
  sanitizeVoiceName,
  formatBankSlotLabel,
  SINGLE_SYSEX_SIZE,
  BANK_SYSEX_SIZE,
  validateBlueX7Sysex,
} from './blue-x7-sysex';

describe('BlueX7 SysEx Decoder — Java Parity & Binary Fixtures', () => {
  const fixturesDir = path.join(__dirname, 'blue-x7', 'test-fixtures');
  const singleSyxPath = path.join(fixturesDir, 'single-voice.syx');
  const bankSyxPath = path.join(fixturesDir, 'voice-bank.syx');
  const expectedJsonPath = path.join(fixturesDir, 'expected-decode.json');

  const singleBytes = new Uint8Array(fs.readFileSync(singleSyxPath));
  const bankBytes = new Uint8Array(fs.readFileSync(bankSyxPath));
  const expectedData = JSON.parse(fs.readFileSync(expectedJsonPath, 'utf8'));

  function withRecomputedChecksum(bytes: Uint8Array): Uint8Array {
    const copy = new Uint8Array(bytes);
    let sum = 0;
    for (let index = 6; index < copy.length - 2; index += 1) {
      sum += copy[index];
    }
    copy[copy.length - 2] = (128 - (sum & 0x7f)) & 0x7f;
    return copy;
  }

  it('correctly identifies SysEx payload types by length', () => {
    expect(singleBytes.length).toBe(SINGLE_SYSEX_SIZE);
    expect(bankBytes.length).toBe(BANK_SYSEX_SIZE);

    expect(getSysexType(singleBytes)).toBe('single');
    expect(getSysexType(bankBytes)).toBe('bank');

    expect(getSysexType(new Uint8Array(100))).toBeNull();
    expect(getSysexType(new Uint8Array(0))).toBeNull();
  });

  it('sanitizes voice names and formats display slot labels', () => {
    expect(sanitizeVoiceName('BRASS 1')).toBe('BRASS 1');
    expect(sanitizeVoiceName('A\x00B\x1FC')).toBe('A B C');
    expect(formatBankSlotLabel(0, '  BRASS 1  ')).toBe('1: BRASS 1');
    expect(formatBankSlotLabel(2, '   \x00\x00   ')).toBe('3: (Untitled)');
    expect(formatBankSlotLabel(3, '')).toBe('4: (Untitled)');
  });

  it('decodes single voice SysEx with exact Java oracle match', () => {
    const { voice, name } = decodeSingleVoice(singleBytes);

    expect(name).toBe(expectedData.single.name);
    expect(voice.common.algorithm).toBe(expectedData.single.algorithmCommon.algorithm);
    expect(voice.common.feedback).toBe(expectedData.single.algorithmCommon.feedback);
    expect(voice.common.keyTranspose).toBe(expectedData.single.algorithmCommon.keyTranspose);
    expect(voice.common.operatorEnabled).toEqual([true, true, true, true, true, true]);

    expect(voice.lfo.speed).toBe(expectedData.single.lfo.speed);
    expect(voice.lfo.delay).toBe(expectedData.single.lfo.delay);
    expect(voice.lfo.pitchModulationDepth).toBe(expectedData.single.lfo.PMD);
    expect(voice.lfo.amplitudeModulationDepth).toBe(expectedData.single.lfo.AMD);
    expect(voice.lfo.wave).toBe(expectedData.single.lfo.wave);
    expect(voice.lfo.sync).toBe(expectedData.single.lfo.sync);

    // Verify all 6 operators
    for (let i = 0; i < 6; i++) {
      const op = voice.operators[i];
      const expOp = expectedData.single.operators[i];

      expect(op.mode).toBe(expOp.mode);
      expect(op.freqCoarse).toBe(expOp.freqCoarse);
      expect(op.freqFine).toBe(expOp.freqFine);
      expect(op.detune).toBe(expOp.detune);
      expect(op.breakpoint).toBe(expOp.breakpoint);
      expect(op.curveLeft).toBe(expOp.curveLeft);
      expect(op.curveRight).toBe(expOp.curveRight);
      expect(op.depthLeft).toBe(expOp.depthLeft);
      expect(op.depthRight).toBe(expOp.depthRight);
      expect(op.keyboardRateScaling).toBe(expOp.keyboardRateScaling);
      expect(op.outputLevel).toBe(expOp.outputLevel);
      expect(op.velocitySensitivity).toBe(expOp.velocitySensitivity);
      expect(op.modulationAmplitude).toBe(expOp.modulationAmplitude);
      expect(op.modulationPitch).toBe(expOp.modulationPitch);

      for (let s = 0; s < 4; s++) {
        expect(op.envelope[s].rate).toBe(expOp.envelope[s].rate);
        expect(op.envelope[s].level).toBe(expOp.envelope[s].level);
      }
    }
  });

  it('extracts all 32 voice names from bank SysEx', () => {
    const names = getBankVoiceNames(bankBytes);
    expect(names).toHaveLength(32);
    for (let i = 0; i < 32; i++) {
      expect(names[i]).toBe(expectedData.bank[i].name);
    }
  });

  it('decodes all 32 bank voices with exact Java oracle match', () => {
    for (let slot = 0; slot < 32; slot++) {
      const { voice, name } = decodeBankVoice(bankBytes, slot);
      const exp = expectedData.bank[slot];

      expect(name).toBe(exp.name);
      expect(voice.common.algorithm).toBe(exp.algorithmCommon.algorithm);
      expect(voice.common.feedback).toBe(exp.algorithmCommon.feedback);
      expect(voice.common.keyTranspose).toBe(exp.algorithmCommon.keyTranspose);

      expect(voice.lfo.speed).toBe(exp.lfo.speed);
      expect(voice.lfo.delay).toBe(exp.lfo.delay);
      expect(voice.lfo.pitchModulationDepth).toBe(exp.lfo.PMD);
      expect(voice.lfo.amplitudeModulationDepth).toBe(exp.lfo.AMD);
      expect(voice.lfo.wave).toBe(exp.lfo.wave);
      expect(voice.lfo.sync).toBe(exp.lfo.sync);

      for (let i = 0; i < 6; i++) {
        const op = voice.operators[i];
        const expOp = exp.operators[i];

        expect(op.mode).toBe(expOp.mode);
        expect(op.freqCoarse).toBe(expOp.freqCoarse);
        expect(op.freqFine).toBe(expOp.freqFine);
        expect(op.detune).toBe(expOp.detune);
        expect(op.breakpoint).toBe(expOp.breakpoint);
        expect(op.curveLeft).toBe(expOp.curveLeft);
        expect(op.curveRight).toBe(expOp.curveRight);
        expect(op.depthLeft).toBe(expOp.depthLeft);
        expect(op.depthRight).toBe(expOp.depthRight);
        expect(op.keyboardRateScaling).toBe(expOp.keyboardRateScaling);
        expect(op.outputLevel).toBe(expOp.outputLevel);
        expect(op.velocitySensitivity).toBe(expOp.velocitySensitivity);
        expect(op.modulationAmplitude).toBe(expOp.modulationAmplitude);
        expect(op.modulationPitch).toBe(expOp.modulationPitch);

        for (let s = 0; s < 4; s++) {
          expect(op.envelope[s].rate).toBe(expOp.envelope[s].rate);
          expect(op.envelope[s].level).toBe(expOp.envelope[s].level);
        }
      }
    }
  });

  it('throws on invalid payload sizes or out-of-range slot indices', () => {
    expect(() => decodeSingleVoice(new Uint8Array(100))).toThrow(/Expected 163 bytes/);
    expect(() => decodeBankVoice(new Uint8Array(100), 0)).toThrow(/Expected 4104 bytes/);
    expect(() => decodeBankVoice(bankBytes, -1)).toThrow(/Invalid slot index/);
    expect(() => decodeBankVoice(bankBytes, 32)).toThrow(/Invalid slot index/);
    expect(() => getBankVoiceNames(new Uint8Array(50))).toThrow(/Expected 4104 bytes/);
  });

  it('rejects malformed framing, headers, payload bytes, and checksums', () => {
    const cases: Array<[string, (bytes: Uint8Array) => void, RegExp]> = [
      ['start byte', (bytes) => { bytes[0] = 0; }, /framing/i],
      ['manufacturer', (bytes) => { bytes[1] = 0x42; }, /manufacturer/i],
      ['device/channel', (bytes) => { bytes[2] = 0x10; }, /device|header/i],
      ['format', (bytes) => { bytes[3] = 9; }, /format|header/i],
      ['voice count', (bytes) => { bytes[4] = 32; }, /count|header/i],
      ['payload byte range', (bytes) => { bytes[6] = 0x80; }, /7-bit|payload/i],
      ['checksum', (bytes) => { bytes[bytes.length - 2] ^= 1; }, /checksum/i],
      ['terminator', (bytes) => { bytes[bytes.length - 1] = 0; }, /framing/i],
    ];

    for (const [label, mutate, message] of cases) {
      const bytes = new Uint8Array(singleBytes);
      mutate(bytes);
      expect(() => validateBlueX7Sysex(bytes, 'single'), label).toThrow(message);
    }
  });

  it('rejects decoded values outside the Blue X7 domains', () => {
    const bytes = new Uint8Array(singleBytes);
    bytes[6] = 100;
    const corrected = withRecomputedChecksum(bytes);

    expect(() => decodeSingleVoice(corrected)).toThrow(/range|rate|envelope/i);
  });

  it('normalizes bank imports to all operators enabled (documented divergence from Java)', () => {
    // Java Blue's importFromBank leaves the target instrument's enable flags
    // untouched while its single-voice import forces all-true. The TypeScript
    // whole-voice replacement model normalizes both forms to all-enabled,
    // matching the single-voice behavior and DX7 routing semantics; the
    // Java-oracle bank entries carry no operator flags, so this assertion
    // pins the intentional choice.
    const { voice } = decodeBankVoice(bankBytes, 0);
    expect(voice.common.operatorEnabled).toEqual([true, true, true, true, true, true]);
  });
});
