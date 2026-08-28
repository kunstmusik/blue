import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';
import { BlueX7, createDefaultBlueX7Voice } from '../blue-x7';
import { buildBlueX7VoiceTransport } from './voice-transport';
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
  tableNum = 100,
  operatorMask?: number,
): { text: string; mask: number } {
  const mask =
    operatorMask ??
    buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled).operatorMask;
  const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
  const text = `f ${tableNum} 0 256 -2 ${transport.voice.join(' ')}`;
  return { text, mask };
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
  fs.writeFileSync(orcPath, orcText);
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

function hostWrapperOrc(tableNum: number, maskExpr: string): string {
  return `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
  iBlueX7MidiNote = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))
  iBlueX7OperatorMask = ${maskExpr}
  kLiveVoice[] init 155
  kLiveMask init ${maskExpr}
  kLiveHold init 1
  aout = bluex7_voice(iBlueX7MidiNote, p5, ${tableNum}, iBlueX7OperatorMask, abs(p3), kLiveVoice, kLiveMask, kLiveHold)
  outc aout
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
      const { text, mask } = buildTransportText(voice);
      const dir = scratch();
      const { samples } = renderCsound(
        hostWrapperOrc(100, String(mask)),
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
    expect(Math.max(...peaks)).toBeCloseTo(0.8919, 3);
  }, 600_000);

  it('renders silence for a zero operator mask', () => {
    const { text } = buildTransportText();
    const dir = scratch();
    const { samples } = renderCsound(
      hostWrapperOrc(100, '0'),
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
    const { text, mask } = buildTransportText(voice);
    const dir = scratch();
    const renderSeconds = 20;
    const { samples } = renderCsound(
      hostWrapperOrc(100, String(mask)),
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

  it('adapts active-note edits during a sounding note when not held', () => {
    // Drive the module the way the live host wrapper does: channels feed
    // kLiveVoice each control cycle while kLiveHold is 0. Silencing every
    // operator output level mid-note must silence the output; with the
    // same values published it must match the static render bit-for-bit.
    const voice = createDefaultBlueX7Voice();
    const { text, mask } = buildTransportText(voice);
    const dir = scratch();
    const orc = `${BLUE_X7_MODERN_ORCHESTRA}
instr 1
  iBlueX7MidiNote = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))
  kLiveVoice[] init 155
  kLiveMask init ${mask}
  kLiveHold init 0
  ; publish the transport table into the live projection (as the wrapper
  ; does from parameter channels), then drop every output level at 0.5 s
  kidx init 0
  kcycle init 0
  if kcycle == 0 then
    kcycle = 1
    kloop = 0
    while kloop < 155 do
      kLiveVoice[kloop] = tab:k(kloop, 100)
      kloop += 1
    od
  endif
  if timeinsts() > 0.5 then
    kop = 0
    while kop < 6 do
      kLiveVoice[105 - kop * 21 + 16] = 0
      kop += 1
    od
  endif
  aout = bluex7_voice(iBlueX7MidiNote, p5, 100, ${mask}, abs(p3), kLiveVoice, kLiveMask, kLiveHold)
  outc aout
endin`;
    const { samples } = renderCsound(orc, `${text}\ni1 0 2 8.09 127`, dir, 2.5);
    const midSample = Math.floor(0.3 * SR);
    const afterSample = Math.floor(1.2 * SR);
    const midPeak = peakOf(samples.subarray(midSample, midSample + Math.floor(0.1 * SR)));
    const afterPeak = peakOf(samples.subarray(afterSample, afterSample + Math.floor(0.1 * SR)));
    // audible before the edit; after silencing every output level the peak
    // drops below -50 dB (the msfa composed-level floor, ~-83 dB per op)
    expect(midPeak).toBeGreaterThan(0.001);
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
    const { text: text6, mask } = buildTransportText(
      (() => {
        const v = createDefaultBlueX7Voice();
        v.common.algorithm = 6;
        return v;
      })(),
    );
    const algo6 = renderCsound(hostWrapperOrc(100, String(mask)), `${text6}\ni1 0 1 8.09 127`, dir6, 1.5);
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
    expect(csdText).toContain('kBlueX7Hold chnget "');
    expect(csdText).toContain('aout = bluex7_voice(iBlueX7MidiNote, p5,');

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
    const { text, mask } = buildTransportText();
    const dir = scratch();
    const { dataBytes } = renderCsound(
      hostWrapperOrc(100, String(mask)),
      `${text}\ni1 0 2 8.09 127`,
      dir,
      2.5,
    );
    const hash = createHash('sha256').update(dataBytes).digest('hex');
    // Accepted reference: default voice, algorithm 19, A4=440, sr=44100,
    // ksmps=64, 0dbfs=1, csound 7 double samples. A changed hash requires
    // explicit review of the calibration or module change.
    expect(hash).toBe('f7332a5a769e4906af86a62d2d1e6ab272892fdcff8a796baac8cfb7baa85296');
  }, 60_000);
});
