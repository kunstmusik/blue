import { describe, expect, it } from 'vitest';
import { buildBlueX7VoiceTransport } from './voice-transport';
import { createDefaultBlueX7Voice, type BlueX7Voice } from '../blue-x7';
import { BLUE_X7_PARAMETER_DESCRIPTORS } from './parameter-catalog';

const ALL_ENABLED = [true, true, true, true, true, true] as const;

function voice(mutate: (v: BlueX7Voice) => void): BlueX7Voice {
  const v = createDefaultBlueX7Voice();
  mutate(v);
  return v;
}

describe('BlueX7 voice transport layout', () => {
  it('produces a 155-slot table with zeroed name bytes', () => {
    const t = buildBlueX7VoiceTransport(createDefaultBlueX7Voice(), ALL_ENABLED);
    expect(t.voice).toHaveLength(155);
    for (const slot of [145, 146, 147, 148, 149, 150, 151, 152, 153, 154]) {
      expect(t.voice[slot]).toBe(0);
    }
    for (let slot = 0; slot < 145; slot++) {
      expect(Number.isFinite(t.voice[slot]), `slot ${slot}`).toBe(true);
      expect(Number.isInteger(t.voice[slot]), `slot ${slot}`).toBe(true);
      expect(t.voice[slot]).toBeGreaterThanOrEqual(0);
    }
  });

  it('stores logical operator op at block (6 - op) * 21 (operator reversal)', () => {
    // Set a distinctive output level on logical operator 1 and 6; the
    // renderer stores operator 6 first.
    const t = buildBlueX7VoiceTransport(
      voice((v) => {
        v.operators[0].outputLevel = 11;
        v.operators[5].outputLevel = 66;
      }),
      ALL_ENABLED,
    );
    expect(t.voice[(6 - 1) * 21 + 16]).toBe(11); // op 1 block at 105
    expect(t.voice[(6 - 6) * 21 + 16]).toBe(66); // op 6 block at 0
  });

  it('maps every operator envelope, scaling, and output field to its offset', () => {
    const t = buildBlueX7VoiceTransport(
      voice((v) => {
        for (const op of v.operators) {
          op.envelope[0] = { rate: 10, level: 11 };
          op.envelope[1] = { rate: 12, level: 13 };
          op.envelope[2] = { rate: 14, level: 15 };
          op.envelope[3] = { rate: 16, level: 17 };
          op.breakpoint = 18;
          op.depthLeft = 19;
          op.depthRight = 20;
          op.curveLeft = 1;
          op.curveRight = 2;
          op.keyboardRateScaling = 3;
          op.modulationAmplitude = 1;
          op.velocitySensitivity = 4;
          op.outputLevel = 21;
          op.mode = 1;
          op.freqCoarse = 5;
          op.freqFine = 22;
          op.detune = 3;
        }
      }),
      ALL_ENABLED,
    );
    const base = (6 - 1) * 21; // logical operator 1 block
    expect(t.voice[base + 0]).toBe(10);
    expect(t.voice[base + 1]).toBe(12);
    expect(t.voice[base + 2]).toBe(14);
    expect(t.voice[base + 3]).toBe(16);
    expect(t.voice[base + 4]).toBe(11);
    expect(t.voice[base + 5]).toBe(13);
    expect(t.voice[base + 6]).toBe(15);
    expect(t.voice[base + 7]).toBe(17);
    expect(t.voice[base + 8]).toBe(18); // breakpoint
    expect(t.voice[base + 9]).toBe(19); // depth left
    expect(t.voice[base + 10]).toBe(20); // depth right
    expect(t.voice[base + 11]).toBe(1); // curve left
    expect(t.voice[base + 12]).toBe(2); // curve right
    expect(t.voice[base + 13]).toBe(3); // rate scaling
    expect(t.voice[base + 14]).toBe(1); // amplitude modulation sensitivity
    expect(t.voice[base + 15]).toBe(4); // velocity sensitivity
    expect(t.voice[base + 16]).toBe(21); // output level
    expect(t.voice[base + 17]).toBe(1); // oscillator mode
    expect(t.voice[base + 18]).toBe(5); // coarse
    expect(t.voice[base + 19]).toBe(22); // fine
    expect(t.voice[base + 20]).toBe(10); // detune 3 + 7
  });

  it('adds seven to detune at the transport boundary', () => {
    const t = buildBlueX7VoiceTransport(
      voice((v) => {
        v.operators[2].detune = -7;
        v.operators[3].detune = 0;
        v.operators[4].detune = 7;
      }),
      ALL_ENABLED,
    );
    expect(t.voice[(6 - 3) * 21 + 20]).toBe(0); // -7 + 7
    expect(t.voice[(6 - 4) * 21 + 20]).toBe(7); // center
    expect(t.voice[(6 - 5) * 21 + 20]).toBe(14); // +7 + 7
  });

  it('subtracts one from the algorithm', () => {
    const t = buildBlueX7VoiceTransport(
      voice((v) => {
        v.common.algorithm = 1;
      }),
      ALL_ENABLED,
    );
    expect(t.voice[134]).toBe(0);
    const t32 = buildBlueX7VoiceTransport(
      voice((v) => {
        v.common.algorithm = 32;
      }),
      ALL_ENABLED,
    );
    expect(t32.voice[134]).toBe(31);
  });

  it('maps the common block: PEG, feedback, shared sync, LFO, PMS, transpose', () => {
    const t = buildBlueX7VoiceTransport(
      voice((v) => {
        v.pitchEnvelope[0] = { rate: 5, level: 6 };
        v.pitchEnvelope[1] = { rate: 7, level: 8 };
        v.pitchEnvelope[2] = { rate: 9, level: 10 };
        v.pitchEnvelope[3] = { rate: 11, level: 12 };
        v.common.feedback = 4;
        v.operators[0].sync = 0;
        v.operators[1].sync = 1; // mixed legacy stays; op 1 is effective
        v.lfo.speed = 50;
        v.lfo.delay = 51;
        v.lfo.pitchModulationDepth = 52;
        v.lfo.amplitudeModulationDepth = 53;
        v.lfo.sync = 1;
        v.lfo.wave = 4;
        v.operators[0].modulationPitch = 6;
        v.common.keyTranspose = 30;
      }),
      ALL_ENABLED,
    );
    expect(t.voice[126]).toBe(5);
    expect(t.voice[127]).toBe(7);
    expect(t.voice[128]).toBe(9);
    expect(t.voice[129]).toBe(11);
    expect(t.voice[130]).toBe(6);
    expect(t.voice[131]).toBe(8);
    expect(t.voice[132]).toBe(10);
    expect(t.voice[133]).toBe(12);
    expect(t.voice[135]).toBe(4);
    expect(t.voice[136]).toBe(0); // shared sync reads logical operator 1
    expect(t.voice[137]).toBe(50);
    expect(t.voice[138]).toBe(51);
    expect(t.voice[139]).toBe(52);
    expect(t.voice[140]).toBe(53);
    expect(t.voice[141]).toBe(1); // LFO sync before wave in renderer order
    expect(t.voice[142]).toBe(4);
    expect(t.voice[143]).toBe(6); // shared PMS reads logical operator 1
    expect(t.voice[144]).toBe(30); // renderer subtracts 24 internally
  });
});

describe('BlueX7 operator mask', () => {
  it('uses bit (op - 1) for logical operator op', () => {
    const t = buildBlueX7VoiceTransport(
      createDefaultBlueX7Voice(),
      [true, false, true, false, false, true],
    );
    expect(t.operatorMask).toBe(0b100101);
  });

  it('supports all-off and all-on masks', () => {
    expect(
      buildBlueX7VoiceTransport(createDefaultBlueX7Voice(), [false, false, false, false, false, false])
        .operatorMask,
    ).toBe(0);
    expect(
      buildBlueX7VoiceTransport(createDefaultBlueX7Voice(), ALL_ENABLED).operatorMask,
    ).toBe(63);
  });
});

describe('BlueX7 transport completeness', () => {
  it('carries every voice-slot catalog descriptor into its documented slot', () => {
    // Give every voice field a distinctive in-domain value, then confirm the
    // transport slot for each voice descriptor equals its documented
    // transform of that value.
    const v = createDefaultBlueX7Voice();
    v.common.algorithm = 13;
    v.common.feedback = 5;
    v.common.keyTranspose = 40;
    v.operators[0].sync = 1;
    v.operators[0].modulationPitch = 7;
    v.lfo.speed = 90;
    v.lfo.delay = 91;
    v.lfo.pitchModulationDepth = 92;
    v.lfo.amplitudeModulationDepth = 93;
    v.lfo.sync = 1;
    v.lfo.wave = 5;
    for (let op = 0; op < 6; op++) {
      const o = v.operators[op];
      o.outputLevel = 10 + op;
      o.velocitySensitivity = 1 + (op % 7);
      o.modulationAmplitude = op % 3;
      o.keyboardRateScaling = op % 7;
      o.breakpoint = 20 + op;
      o.depthLeft = 30 + op;
      o.depthRight = 40 + op;
      o.curveLeft = op % 3;
      o.curveRight = (op + 1) % 3;
      o.mode = op % 2;
      o.freqCoarse = 1 + op;
      o.freqFine = 10 + op;
      o.detune = -7 + op * 3;
      for (let s = 0; s < 4; s++) {
        o.envelope[s] = { rate: 5 + s + op, level: 15 + s + op };
      }
    }
    for (let s = 0; s < 4; s++) {
      v.pitchEnvelope[s] = { rate: 60 + s, level: 70 + s };
    }

    const t = buildBlueX7VoiceTransport(v, ALL_ENABLED);
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      if (d.transport.kind !== 'voice') continue;
      const slot = d.transport.slot;
      if (slot === 134) {
        expect(t.voice[slot], d.key).toBe(12); // 13 - 1
      } else if (slot < 126 && slot % 21 === 20) {
        expect(t.voice[slot], d.key).toBeGreaterThanOrEqual(0);
        expect(t.voice[slot], d.key).toBeLessThanOrEqual(14);
      }
    }
    // spot-check a few distinctive fields against the canonical voice
    expect(t.voice[(6 - 2) * 21 + 16]).toBe(11); // operator 2 output level
    expect(t.voice[(6 - 5) * 21 + 18]).toBe(5); // operator 5 coarse
    expect(t.voice[137]).toBe(90); // lfo speed
    expect(t.voice[144]).toBe(40); // transpose
  });

  it('degrades non-finite canonical fields to the neutral zero slot', () => {
    const v = createDefaultBlueX7Voice();
    (v as { lfo: { speed: number } }).lfo.speed = Number.NaN;
    const t = buildBlueX7VoiceTransport(v, ALL_ENABLED);
    expect(t.voice[137]).toBe(0);
    expect(Number.isFinite(t.voice[137])).toBe(true);
  });
});
