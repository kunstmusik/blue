import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultBlueX7Voice } from '../blue-x7';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';
import { buildBlueX7VoiceTransport } from './voice-transport';
import { generateBlueX7Target } from './csound-target-generator';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  readBlueX7VoiceValue,
} from './parameter-catalog';

const hasCsound = (() => {
  try {
    execFileSync('csound', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const SR = 44_100;
const KR = SR / 64;

interface RenderResult {
  samples: Float64Array;
  bytes: Buffer;
}

function render(orc: string, score: string): RenderResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bluex7-live-'));
  const orcPath = path.join(dir, 'live.orc');
  const scoPath = path.join(dir, 'live.sco');
  const wavPath = path.join(dir, 'live.wav');
  fs.writeFileSync(orcPath, `sr = ${SR}\nksmps = 64\nnchnls = 1\n${orc}`);
  fs.writeFileSync(scoPath, score);
  execFileSync('csound', [
    '-nd', '-W', '-r', String(SR), '-k', String(KR), '--0dbfs=1',
    '--format=double', '-o', wavPath, orcPath, scoPath,
  ], { cwd: dir, stdio: 'ignore' });
  const wav = fs.readFileSync(wavPath);
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    offset += 8;
    if (id === 'data') break;
    offset += size + (size % 2);
  }
  const bytes = wav.subarray(offset);
  const samples = new Float64Array(Math.floor(bytes.length / 8));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = bytes.readDoubleLE(index * 8);
  }
  return { samples, bytes };
}

function peak(samples: Float64Array, fromSeconds: number, toSeconds: number): number {
  let result = 0;
  const start = Math.max(0, Math.floor(fromSeconds * SR));
  const end = Math.min(samples.length, Math.ceil(toSeconds * SR));
  for (let index = start; index < end; index += 1) {
    expect(Number.isFinite(samples[index]), `non-finite sample at ${index / SR}s`).toBe(true);
    result = Math.max(result, Math.abs(samples[index]));
  }
  return result;
}

function targetParts(
  values = buildBlueX7VoiceTransport(
    createDefaultBlueX7Voice(),
    createDefaultBlueX7Voice().common.operatorEnabled,
  ).voice,
  mask = 63,
): { setup: string; call: string } {
  // These tests intentionally exercise the maintained shared-UDO fallback;
  // the production live target uses generated inline scalar adaptation.
  const target = generateBlueX7Target({ voice: values, operatorMask: mask });
  const call = 'aout = bluex7_voice(iBlueX7MidiNote, i(p5), iBlueX7Voice, iBlueX7OperatorMask, iBlueX7GateSeconds, kBlueX7LiveVoice, kBlueX7LiveMask, kBlueX7Dirty)';
  return { setup: target.replace(`${call}\n`, ''), call };
}

function staticWrapper(values: readonly number[], mask: number): string {
  const { setup, call } = targetParts(values, mask);
  return `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${setup}  ${call}
  outc aout
endin`;
}

describe.skipIf(!hasCsound)('modern BlueX7 live control semantics', () => {
  it('keeps shared-UDO compatibility edits audible for an active note', () => {
    const transport = buildBlueX7VoiceTransport(
      createDefaultBlueX7Voice(),
      [true, true, true, true, true, true],
    );
    const { setup, call } = targetParts(transport.voice, transport.operatorMask);
    const orc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${setup}
  kEdit = 0
  if timeinsts() > 0.35 && timeinsts() < 0.7 then
    kEdit = 1
    kOp = 0
    while kOp < 6 do
      kBlueX7LiveVoice[105 - kOp * 21 + 16] = 0
      kOp += 1
    od
  elseif timeinsts() >= 0.7 then
    kEdit = 1
    kBlueX7LiveMask = 0
  endif
  kBlueX7Dirty = kEdit
  ${call}
  outc aout
endin`;
    const result = render(orc, 'i1 0 1.2 60 127');
    const before = peak(result.samples, 0.15, 0.3);
    const continuous = peak(result.samples, 0.5, 0.65);
    const disabled = peak(result.samples, 0.9, 1.05);
    expect(before).toBeGreaterThan(0.001);
    expect(continuous).toBeLessThan(before * 0.25);
    expect(disabled).toBeLessThan(1e-6);
  }, 60_000);

  it('captures algorithm, oscillator sync, and LFO sync only for the next note', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const changedValues = [...transport.voice];
    changedValues[134] = changedValues[134] === 31 ? 0 : 31;
    changedValues[136] = changedValues[136] === 1 ? 0 : 1;
    changedValues[141] = changedValues[141] === 1 ? 0 : 1;

    const baseline = render(
      staticWrapper(transport.voice, transport.operatorMask),
      'i1 0 1.2 60 127',
    );
    const dynamic = targetParts(transport.voice, transport.operatorMask);
    const changedDuringNote = render(
      `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${dynamic.setup}
  if timeinsts() > 0.35 then
    kBlueX7LiveVoice[134] = ${changedValues[134]}
    kBlueX7LiveVoice[136] = ${changedValues[136]}
    kBlueX7LiveVoice[141] = ${changedValues[141]}
    kBlueX7Dirty = 1
  else
    kBlueX7Dirty = 0
  endif
  ${dynamic.call}
  outc aout
endin`,
      'i1 0 1.2 60 127',
    );
    expect(createHash('sha256').update(changedDuringNote.bytes).digest('hex'))
      .toBe(createHash('sha256').update(baseline.bytes).digest('hex'));

    const nextNote = render(
      staticWrapper(changedValues, transport.operatorMask),
      'i1 0 1.2 60 127',
    );
    expect(createHash('sha256').update(nextNote.bytes).digest('hex'))
      .not.toBe(createHash('sha256').update(baseline.bytes).digest('hex'));
  }, 60_000);

  it('applies a runtime algorithm channel edit to the next note on the live inline target', () => {
    const voice = createDefaultBlueX7Voice();
    // Fast release keeps the first note's tail out of the compared window.
    for (const operator of voice.operators) {
      operator.envelope[3] = { rate: 99, level: 0 };
    }
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const globals = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
      const value = readBlueX7VoiceValue(voice, descriptor.key);
      return `gk_blue_auto${index} init ${value}\ngk_blue_auto${index} chnexport "gk_blue_auto${index}", 3`;
    }).join('\n');
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      parameters,
      layout: 'inline',
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch_0',
      variablePrefix: 'InlineEpoch',
    });
    const orc = (algorithmInit: number, editInstrument: string): string => `
${globals.replace(
  `gk_blue_auto0 init ${readBlueX7VoiceValue(voice, 'common.algorithm')}`,
  `gk_blue_auto0 init ${algorithmInit}`,
)}
gk_blue_x7_epoch_0 init 0
${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${target}  outc aout
endin
${editInstrument}`;

    // Two notes; the edit instrument switches the algorithm channel between
    // them. The second note must match a render that started on algorithm 31
    // (dispatcher fallback) and differ from the generation-time algorithm 19.
    const switched = render(orc(19, 'instr 2\n  gk_blue_auto0 = 31\nendin'),
      'i1 0 0.25 60 127\ni2 0.3 0.05\ni1 0.45 0.25 60 127');
    const alwaysNew = render(orc(31, ''), 'i1 0 0.25 60 127\ni1 0.45 0.25 60 127');
    const alwaysOld = render(orc(19, ''), 'i1 0 0.25 60 127\ni1 0.45 0.25 60 127');

    const from = Math.floor(0.46 * SR);
    const to = Math.ceil(0.69 * SR);
    const maxDiff = (left: RenderResult, right: RenderResult): number => {
      let worst = 0;
      for (let index = from; index < to; index += 1) {
        worst = Math.max(worst, Math.abs(left.samples[index] - right.samples[index]));
      }
      return worst;
    };
    expect(maxDiff(switched, alwaysNew)).toBe(0);
    expect(maxDiff(alwaysOld, alwaysNew)).toBeGreaterThan(1e-6);
    expect(maxDiff(switched, alwaysOld)).toBeGreaterThan(1e-6);
  }, 60_000);

  it('keeps shared-UDO envelope compatibility edits safe during release', () => {
    const voice = createDefaultBlueX7Voice();
    for (const op of voice.operators) op.envelope[3] = { rate: 0, level: 0 };
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const { setup, call } = targetParts(transport.voice, transport.operatorMask);
    const orc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${setup}
  if timeinsts() > 0.2 then
    kOp = 0
    while kOp < 6 do
      kBase = 105 - kOp * 21
      kBlueX7LiveVoice[kBase + 1] = 90
      kBlueX7LiveVoice[kBase + 5] = 55
      kBlueX7LiveVoice[kBase + 3] = 99
      kOp += 1
    od
    kBlueX7Dirty = 1
  else
    kBlueX7Dirty = 0
  endif
  ${call}
  outc aout
endin`;
    const result = render(orc, 'i1 0 0.5 60 127');
    expect(peak(result.samples, 0.1, 0.3)).toBeGreaterThan(0.001);
    expect(result.samples.length / SR).toBeLessThan(16);
    expect(peak(result.samples, 2.5, 4)).toBeLessThan(1e-4);
  }, 60_000);

  it('keeps repeated shared-UDO carrier restoration finite during release', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 16; // operator 1 is the only carrier
    voice.common.feedback = 0;
    for (const [index, operator] of voice.operators.entries()) {
      operator.outputLevel = index === 0 ? 0 : 99;
      operator.envelope[3] = { rate: index === 0 ? 99 : 0, level: 10 };
    }
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const { setup, call } = targetParts(transport.voice, transport.operatorMask);
    const udoOrc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${setup}
  kCarrierLevel = (int(timeinsts() * 10) % 2 == 0 ? 0 : 99)
  kBlueX7LiveVoice[121] = kCarrierLevel
  kBlueX7Dirty changed kCarrierLevel
  ${call}
  outc aout
endin`;
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const globals = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => (
      `gk_blue_auto${index} init ${readBlueX7VoiceValue(voice, descriptor.key)}`
    )).join('\n');
    const outputIndex = BLUE_X7_PARAMETER_DESCRIPTORS.findIndex(
      (descriptor) => descriptor.key === 'operator.1.outputLevel',
    );
    const inlineTarget = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      parameters,
      layout: 'inline',
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch_0',
      variablePrefix: 'RepeatedRestore',
    });
    const inlineOrc = `${globals}
gk_blue_x7_epoch_0 init 0
${BLUE_X7_MODERN_ORCHESTRA}
instr 1
  kCarrierLevel = (int(timeinsts() * 10) % 2 == 0 ? 0 : 99)
  kCarrierChanged changed kCarrierLevel
  gk_blue_auto${outputIndex} = kCarrierLevel
  gk_blue_x7_epoch_0 += kCarrierChanged
${inlineTarget}
  outc aout
endin`;
    const score = 'i1 0 0.2 60 127';
    const udo = render(udoOrc, score);
    const inline = render(inlineOrc, score);
    const duration = udo.samples.length / SR;
    expect(peak(udo.samples, 0, duration)).toBeGreaterThan(1e-4);
    expect(peak(inline.samples, 0, duration)).toBeGreaterThan(1e-4);
    expect(udo.samples).toEqual(inline.samples);
  }, 60_000);

  it('resumes parked release audio on a live carrier output-level edit', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 16; // operator 1 is the only carrier
    voice.common.feedback = 0;
    for (const [index, operator] of voice.operators.entries()) {
      operator.outputLevel = index === 0 ? 0 : 99;
      operator.envelope[3] = { rate: index === 0 ? 99 : 0, level: 10 };
    }
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const globals = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
      const value = readBlueX7VoiceValue(voice, descriptor.key);
      return `gk_blue_auto${index} init ${value}\ngk_blue_auto${index} chnexport "gk_blue_auto${index}", 3`;
    }).join('\n');
    const outputIndex = BLUE_X7_PARAMETER_DESCRIPTORS.findIndex(
      (descriptor) => descriptor.key === 'operator.1.outputLevel',
    );
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      parameters,
      layout: 'inline',
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch_0',
      variablePrefix: 'ReleaseResume',
    });
    const orc = `${globals}
gk_blue_x7_epoch_0 init 0
${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${target}
  outc aout
endin
instr 2
  gk_blue_auto${outputIndex} = 99
  gk_blue_x7_epoch_0 += 1
endin`;
    const result = render(orc, 'i1 0 0.2 60 127\ni2 0.5 0.01');
    expect(peak(result.samples, 0.35, 0.45)).toBeLessThan(1e-4);
    expect(peak(result.samples, 0.55, 0.62)).toBeGreaterThan(1e-4);
  }, 60_000);

  it('publishes a complete mask edit at the next control block', () => {
    const transport = buildBlueX7VoiceTransport(
      createDefaultBlueX7Voice(),
      [true, true, true, true, true, true],
    );
    const { setup, call } = targetParts(transport.voice, transport.operatorMask);
    const orc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${setup}
  if timeinsts() > 0.7 then
    kBlueX7LiveMask = 0
    kBlueX7Dirty = 1
  else
    kBlueX7Dirty = 0
  endif
  ${call}
  outc aout
endin`;
    const result = render(orc, 'i1 0 1.3 60 127');
    expect(peak(result.samples, 0.45, 0.65)).toBeGreaterThan(0.001);
    expect(peak(result.samples, 0.95, 1.15)).toBeLessThan(0.001);
  }, 60_000);
});
