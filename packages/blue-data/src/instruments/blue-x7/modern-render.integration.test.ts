import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';
import { BlueX7, createDefaultBlueX7Voice } from '../blue-x7';
import { buildBlueX7VoiceTransport } from './voice-transport';
import { generateBlueX7Target } from './csound-target-generator';
import { BLUE_X7_PARAMETER_DESCRIPTORS, readBlueX7VoiceValue } from './parameter-catalog';
import { BlueData } from '../../blue-data';
import { Arrangement } from '../../arrangement';

/**
 * Deterministic Csound render tests for the modern BlueX7 module (Spec 092,
 * US1). Renders require the csound binary; when it is absent the suite skips
 * so portable data tests stay host-neutral.
 */
const hasCsound = (() => {
  try {
    execFileSync('csound', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const SR = 44100;
const KSMPS = 64;
const KR = SR / KSMPS;

interface RenderResult {
  samples: Float64Array;
  dataBytes: Buffer;
}

function buildTransportText(
  voice = createDefaultBlueX7Voice(),
  operatorMask?: number,
): { text: string; mask: number; voice: readonly number[] } {
  const mask =
    operatorMask ??
    buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled).operatorMask;
  const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
  // Retain the helper name for the score fixtures, but the modern target is
  // direct-global/array based and publishes no ftable.
  return { text: '', mask, voice: transport.voice };
}

function renderCsound(
  orcText: string,
  scoText: string,
  dir: string,
  durationSeconds: number,
): RenderResult {
  const orcPath = path.join(dir, 'render.orc');
  const scoPath = path.join(dir, 'render.sco');
  const wavPath = path.join(dir, 'render.wav');
  fs.writeFileSync(orcPath, `sr = ${SR}\nksmps = ${KSMPS}\nnchnls = 1\n${orcText}`);
  fs.writeFileSync(scoPath, scoText);
  execFileSync(
    'csound',
    [
      '-nd',
      '-W',
      '-r',
      String(SR),
      '-k',
      String(KR),
      '--0dbfs=1',
      '--format=double',
      '-o',
      wavPath,
      orcPath,
      scoPath,
    ],
    { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] },
  );
  const buf = fs.readFileSync(wavPath);
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') {
      pos += 8;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  const dataBytes = buf.subarray(pos);
  const sampleCount = Math.floor(dataBytes.length / 8);
  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = dataBytes.readDoubleLE(i * 8);
  }
  void durationSeconds;
  return { samples, dataBytes };
}

function hostWrapperOrc(voice: readonly number[], mask: number): string {
  const target = generateBlueX7Target({ voice, operatorMask: mask });
  return `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${target}  outc aout
endin`;
}

function peakOf(samples: Float64Array): number {
  let peak = 0;
  let finite = true;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) {
      finite = false;
      continue;
    }
    peak = Math.max(peak, Math.abs(sample));
  }
  if (!finite) {
    return Number.NaN;
  }
  return peak;
}

function maxControlBoundaryDiscontinuityRatio(
  samples: Float64Array,
  startSample: number,
  endSample: number,
): number {
  let maximum = 0;
  const firstBoundary = Math.ceil(startSample / KSMPS) * KSMPS;
  for (let boundary = firstBoundary; boundary < endSample; boundary += KSMPS) {
    const boundaryJump = Math.abs(samples[boundary] - samples[boundary - 1]);
    let neighboringJump = 0;
    for (let sample = Math.max(1, boundary - 8); sample <= Math.min(samples.length - 1, boundary + 8); sample++) {
      if (sample === boundary) continue;
      neighboringJump = Math.max(
        neighboringJump,
        Math.abs(samples[sample] - samples[sample - 1]),
      );
    }
    maximum = Math.max(maximum, boundaryJump / Math.max(neighboringJump, 1e-15));
  }
  return maximum;
}

describe.skipIf(!hasCsound)('modern BlueX7 Csound renders', () => {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bluex7-render-'));
  let scratchIndex = 0;

  function scratch(): string {
    const dir = path.join(scratchRoot, `case-${scratchIndex++}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  it('renders finite, calibrated output through all 32 algorithms', () => {
    const peaks: number[] = [];
    for (let algorithm = 1; algorithm <= 32; algorithm++) {
      const voice = createDefaultBlueX7Voice();
      voice.common.algorithm = algorithm;
      const { text, mask, voice: transportVoice } = buildTransportText(voice);
      const dir = scratch();
      const { samples } = renderCsound(
        hostWrapperOrc(transportVoice, mask),
        `${text}\ni1 0 2 8.09 127`,
        dir,
        2.5,
      );
      const peak = peakOf(samples);
      expect(Number.isFinite(peak), `algorithm ${algorithm} non-finite output`).toBe(true);
      expect(peak, `algorithm ${algorithm} silent`).toBeGreaterThan(0.001);
      expect(peak, `algorithm ${algorithm} over calibration ceiling`).toBeLessThanOrEqual(0.9);
      peaks.push(peak);
    }
    // one corpus-wide calibration: no voice-specific gain adjustments
    expect(Math.max(...peaks)).toBeCloseTo(0.8901, 3);
  }, 600_000);

  it('renders silence for a zero operator mask', () => {
    const { text, voice: transportVoice } = buildTransportText();
    const dir = scratch();
    const { samples } = renderCsound(
      hostWrapperOrc(transportVoice, 0),
      `${text}\ni1 0 1 8.09 127`,
      dir,
      1.5,
    );
    expect(peakOf(samples)).toBeLessThan(1e-12);
  }, 60_000);

  it('completes release without truncation or stuck notes', () => {
    // R4 = 0 is the slowest release: the module's capped tail (15 s) bounds
    // the note lifetime, so the render must end near gate + cap (no stuck
    // note) and fall silent afterwards (completed release, no truncation of
    // the audible portion).
    const voice = createDefaultBlueX7Voice();
    for (const op of voice.operators) {
      op.envelope[3] = { rate: 0, level: 0 };
    }
    const { text, mask, voice: transportVoice } = buildTransportText(voice);
    const dir = scratch();
    const renderSeconds = 20;
    const { samples } = renderCsound(
      hostWrapperOrc(transportVoice, mask),
      `${text}\ni1 0 1 8.09 127`,
      dir,
      renderSeconds,
    );
    // The safety cap turned the instrument off: the render stopped shortly
    // after gate (1 s) + tail cap (15 s) rather than running the full window.
    const endedAt = samples.length / SR;
    expect(endedAt).toBeGreaterThan(15.5); // tail not truncated early
    expect(endedAt).toBeLessThan(18); // no stuck note
    const tailStart = Math.floor(16.5 * SR);
    expect(peakOf(samples.subarray(tailStart))).toBeLessThan(1e-6);
    // the note itself was audible
    const midStart = Math.floor(0.2 * SR);
    expect(peakOf(samples.subarray(midStart, midStart + SR))).toBeGreaterThan(0.001);
  }, 60_000);

  it('interpolates fast release gains across control blocks like msfa', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 32; // six carriers expose every operator gain edge
    const releaseRates = [90, 90, 82, 90, 90, 90];
    for (const [index, operator] of voice.operators.entries()) {
      operator.outputLevel = 94;
      operator.envelope = [
        { rate: 99, level: 99 },
        { rate: 80, level: 99 },
        { rate: 22, level: 99 },
        { rate: releaseRates[index], level: 0 },
      ];
    }
    const { text, mask, voice: transportVoice } = buildTransportText(voice);
    const uninterruptedOrc = hostWrapperOrc(transportVoice, mask).replace(
      'kAudioActive = kCarrierAudible',
      'kAudioActive = 1',
    );
    const { samples } = renderCsound(
      uninterruptedOrc,
      `${text}\ni1 0 1 8.00 104`,
      scratch(),
      1.2,
    );

    // Ignore the key-off block itself and the later inaudible parking edge.
    // Within the audible release, a k-boundary must look like the surrounding
    // waveform rather than a held-gain step.
    const ratio = maxControlBoundaryDiscontinuityRatio(
      samples,
      SR + KSMPS * 2,
      Math.floor(1.035 * SR),
    );
    expect(ratio).toBeLessThan(1.2);

    const { samples: parkedSamples } = renderCsound(
      hostWrapperOrc(transportVoice, mask),
      `${text}\ni1 0 1 8.00 104`,
      scratch(),
      1.2,
    );
    let finalAudibleSample = parkedSamples.length - 1;
    while (finalAudibleSample >= 0 && parkedSamples[finalAudibleSample] === 0) {
      finalAudibleSample--;
    }
    expect(finalAudibleSample).toBeGreaterThan(SR);
    expect(Math.abs(parkedSamples[finalAudibleSample])).toBeLessThan(5e-5);
    expect(parkedSamples[finalAudibleSample + 1]).toBe(0);
    expect(BLUE_X7_MODERN_ORCHESTRA).toContain('aG1 interp kGain[0]');
    expect(BLUE_X7_MODERN_ORCHESTRA).toContain(
      'kPreviousGain[kCarrierOp] > 0.0001',
    );
  }, 60_000);

  it('keeps a nonzero-L4 carrier audible while its modulators release', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 16; // operator 1 is the only carrier
    voice.common.feedback = 0;
    for (const [index, operator] of voice.operators.entries()) {
      operator.outputLevel = 99;
      operator.envelope = [
        { rate: 99, level: 99 },
        { rate: 99, level: 99 },
        { rate: 99, level: 99 },
        { rate: index === 0 ? 99 : 0, level: index === 0 ? 99 : 0 },
      ];
    }
    const { text, mask, voice: transportVoice } = buildTransportText(voice);
    const dir = scratch();
    const { samples } = renderCsound(
      hostWrapperOrc(transportVoice, mask),
      `${text}\ni1 0 0.2 8.09 127`,
      dir,
      1,
    );
    expect(peakOf(samples.subarray(Math.floor(0.5 * SR), Math.floor(0.7 * SR))))
      .toBeGreaterThan(0.001);
  }, 60_000);

  it('adapts active-note edits during a sounding note with direct globals', () => {
    // The live target owns the i-rate next-note snapshot and updates its
    // k-rate active projection only when a direct-global change is observed.
    const voice = createDefaultBlueX7Voice();
    const { text, mask, voice: transportVoice } = buildTransportText(voice);
    const dir = scratch();
    const target = generateBlueX7Target({ voice: transportVoice, operatorMask: mask });
    const call = 'aout = bluex7_voice(iBlueX7MidiNote, i(p5), iBlueX7Voice, iBlueX7OperatorMask, iBlueX7GateSeconds, kBlueX7LiveVoice, kBlueX7LiveMask, kBlueX7Dirty)';
    const targetWithoutCall = target.replace(`${call}\n`, '');
    const orc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${targetWithoutCall}
  if timeinsts() > 0.5 then
    kop = 0
    while kop < 6 do
      kBlueX7LiveVoice[105 - kop * 21 + 16] = 0
      kop += 1
    od
    kBlueX7Dirty = 1
  else
    kBlueX7Dirty = 0
  endif
  ${call}
  outc aout
endin`;
    const { samples } = renderCsound(orc, `${text}\ni1 0 2 8.09 127`, dir, 2.5);
    const midSample = Math.floor(0.3 * SR);
    const afterSample = Math.floor(1.2 * SR);
    const midPeak = peakOf(samples.subarray(midSample, midSample + Math.floor(0.1 * SR)));
    const afterPeak = peakOf(samples.subarray(afterSample, afterSample + Math.floor(0.1 * SR)));
    // audible before the edit; after silencing every output level the peak
    // drops below -50 dB once the composed levels are moved to zero
    expect(midPeak).toBeGreaterThan(0.001);
    expect(afterPeak).toBeLessThan(0.001);
  }, 60_000);

  it('adapts the generated scalar live target without a packed operator array', () => {
    const voice = createDefaultBlueX7Voice();
    const { voice: transportVoice, mask } = buildTransportText(voice);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const declarations = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
      const value = readBlueX7VoiceValue(voice, descriptor.key);
      if (value === undefined) throw new Error(`missing ${descriptor.key}`);
      return `gk_blue_auto${index} init ${value}`;
    }).join('\n');
    const target = generateBlueX7Target({
      voice: transportVoice,
      operatorMask: mask,
      parameters,
      layout: 'inline',
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch',
    });
    expect(target).not.toContain('kBlueX7LiveOperatorState');
    const orc = `sr = ${SR}
ksmps = ${KSMPS}
nchnls = 1
0dbfs = 1
${declarations}
gk_blue_x7_epoch init 0
${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${target}
  if timeinsts() > 0.5 then
    gk_blue_auto35 = 0
    gk_blue_auto57 = 0
    gk_blue_auto79 = 0
    gk_blue_auto101 = 0
    gk_blue_auto123 = 0
    gk_blue_auto145 = 0
    gk_blue_x7_epoch = 1
  endif
  outc aout
endin`;
    const dir = scratch();
    const { samples } = renderCsound(orc, 'i1 0 2 8.09 127', dir, 2.5);
    const beforePeak = peakOf(samples.subarray(Math.floor(0.3 * SR), Math.floor(0.4 * SR)));
    const afterPeak = peakOf(samples.subarray(Math.floor(1.2 * SR), Math.floor(1.3 * SR)));
    expect(beforePeak).toBeGreaterThan(0.001);
    expect(afterPeak).toBeLessThan(0.001);
  }, 60_000);

  it('keeps the corrected 3-carrier routing metadata for algorithms 6 and 20', () => {
    // The modern renderer follows the corrected msfa/Dexed routing for these
    // topologies (intentional divergence from the legacy Pinkston bodies).
    const rows = BLUE_X7_MODERN_ORCHESTRA.match(/giDx7Carriers\[\] fillarray ([^;]*);/);
    expect(rows).not.toBeNull();
    const values = rows![1]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map(Number);
    expect(values).toHaveLength(32 * 7);
    const carrierCount = (algorithm: number) => values[(algorithm - 1) * 7];
    expect(carrierCount(6)).toBe(3);
    expect(carrierCount(20)).toBe(3);
    // and the routing renders distinctly for the corrected topologies
    const dir6 = scratch();
    const { text: text6, mask, voice: transportVoice6 } = buildTransportText(
      (() => {
        const v = createDefaultBlueX7Voice();
        v.common.algorithm = 6;
        return v;
      })(),
    );
    const algo6 = renderCsound(hostWrapperOrc(transportVoice6, mask), `${text6}\ni1 0 1 8.09 127`, dir6, 1.5);
    expect(peakOf(algo6.samples)).toBeGreaterThan(0.001);
  }, 60_000);

  it('renders a generated live-capable CSD end-to-end', () => {
    // Full host path: a BlueData project whose BlueX7 emits the live wrapper
    // (parameters assigned during compilation) renders through Csound.
    const data = new BlueData();
    const arrangement = new Arrangement();
    const instr = new BlueX7();
    instr.setName('EndToEnd');
    arrangement.addInstrumentAtEnd(instr);
    data.setArrangement(arrangement);
    data.getGlobalOrcSco().setGlobalSco('i1 0 2 8.09 127');

    const csdText = data.toCSD();
    expect(csdText).toContain('opcode bluex7_voice(');
    // the live wrapper was emitted: parameters were assigned during compile
    expect(csdText).toContain('kBlueX7EpochSeen init -1');
    expect(csdText).not.toContain('kBlueX7Hold');
    expect(csdText).not.toContain('kBlueX7LiveVoice');
    expect(csdText).not.toContain('kBlueX7LiveOperatorState');
    expect(csdText).toContain('kBlueX7LiveOutputLevelSeen[] init 6');
    expect(csdText).not.toContain('tabw');
    expect(csdText).not.toContain('chnget');
    expect(csdText).toContain('aout = aOut');

    const dir = scratch();
    const csdPath = path.join(dir, 'live.csd');
    fs.writeFileSync(csdPath, csdText);
    const wavPath = path.join(dir, 'live.wav');
    execFileSync(
      'csound',
      [
        '-nd',
        '-W',
        '--0dbfs=1',
        '--format=double',
        '-o',
        wavPath,
        csdPath,
      ],
      { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] },
    );
    const buf = fs.readFileSync(wavPath);
    let pos = 12;
    while (pos + 8 <= buf.length) {
      const id = buf.toString('ascii', pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      if (id === 'data') {
        pos += 8;
        break;
      }
      pos += 8 + size + (size % 2);
    }
    let peak = 0;
    let finite = true;
    for (let i = pos; i + 8 <= buf.length; i += 8) {
      const sample = buf.readDoubleLE(i);
      if (!Number.isFinite(sample)) {
        finite = false;
      } else {
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    expect(finite).toBe(true);
    expect(peak).toBeGreaterThan(0.001);
    expect(peak).toBeLessThanOrEqual(0.9);
  }, 120_000);

  it('locks the accepted modern reference render hash', () => {
    const { text, mask, voice: transportVoice } = buildTransportText();
    const dir = scratch();
    const { dataBytes } = renderCsound(
      hostWrapperOrc(transportVoice, mask),
      `${text}\ni1 0 2 8.09 127`,
      dir,
      2.5,
    );
    const hash = createHash('sha256').update(dataBytes).digest('hex');
    // Accepted reference: default voice, algorithm 19, A4=440, sr=44100,
    // ksmps=64, 0dbfs=1, csound 7 double samples. A changed hash requires
    // explicit review of the calibration or module change.
    // Re-locked 2026-08-29 after matching msfa's gain[0]/gain[1] behavior:
    // every operator gain now ramps across its 64-sample block, and carrier
    // parking retains the final transition block before reaching zero.
    expect(hash).toBe('82012869f2451e4968a0646b5a9d4329cc0c89cbcac277f7c2fe8238453882c6');
  }, 60_000);
});
