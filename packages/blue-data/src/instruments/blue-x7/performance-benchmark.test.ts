import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../../blue-data';
import { createDefaultBlueX7Voice } from '../blue-x7';
import { BLUE_X7_PARAMETER_DESCRIPTORS, readBlueX7VoiceValue } from './parameter-catalog';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';
import { generateBlueX7Target } from './csound-target-generator';
import { buildBlueX7VoiceTransport } from './voice-transport';

/**
 * This suite is intentionally opt-in: the dense case performs tens of
 * millions of Csound samples and is a development/profiling gate, not a
 * normal unit-test dependency. Run it with BLUE_X7_PERF=1.
 */
const benchmarkEnabled = process.env.BLUE_X7_PERF === '1';

const SAMPLE_RATE = 44_100;
const KSMPS = 64;
const NOTE_COUNT = 59;
const NOTE_DURATION = 0.8;

interface Timing {
  realSeconds: number;
  userSeconds: number;
  sysSeconds: number;
}

interface RunResult extends Timing {
  stdout: string;
  stderr: string;
  status: number | null;
}

interface VariantResult extends Timing {
  name: string;
  csdBytes: number;
  compileSeconds: number;
  renderedSeconds: number;
  realtimeRatio: number;
  samples: Float64Array;
}

interface FixtureSummary {
  csdBytes: number;
  compileSeconds: number;
  sampleRate: number;
  ksmps: number;
  zeroDbfs: string | null;
  denseRuns: number;
  denseRenderedSeconds: number;
  denseCpuSeconds: number;
  denseRealtimeRatio: number;
  engineMirrorOnSeconds: number | null;
  engineMirrorOffSeconds: number | null;
}

const repoRoot = fs.existsSync(path.join(process.cwd(), 'native/blue-engine'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');
const engineCandidates = [
  path.join(repoRoot, 'native/blue-engine/build-darwin-arm64-release/blue-engine'),
  path.join(repoRoot, 'native/blue-engine/build-darwin-x64-release/blue-engine'),
  path.join(repoRoot, 'native/blue-engine/build-linux-x64-release/blue-engine'),
  path.join(repoRoot, 'native/blue-engine/build-windows-x64-release/blue-engine.exe'),
];

function executableAvailable(command: string): boolean {
  try {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return result.status === 0 || result.status === 1;
  } catch {
    return false;
  }
}

const hasCsound = executableAvailable('csound');
const enginePath = engineCandidates.find((candidate) => fs.existsSync(candidate));

function parseTiming(stderr: string): Timing {
  const read = (label: string): number => {
    const match = stderr.match(new RegExp(`\\n${label} ([0-9.]+)`));
    return match ? Number(match[1]) : Number.NaN;
  };
  return {
    realSeconds: read('real'),
    userSeconds: read('user'),
    sysSeconds: read('sys'),
  };
}

function runTimed(command: string, args: readonly string[], cwd: string): RunResult {
  const result = spawnSync('/usr/bin/time', ['-p', command, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  const timing = parseTiming(result.stderr ?? '');
  return {
    ...timing,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

function directGlobalDeclarations(voice: ReturnType<typeof createDefaultBlueX7Voice>): string {
  return BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
    const value = readBlueX7VoiceValue(voice, descriptor.key);
    if (value === undefined || !Number.isFinite(value)) {
      throw new Error(`missing finite benchmark value for ${descriptor.key}`);
    }
    const symbol = `gk_blue_auto${index}`;
    return `${symbol} init ${value}\n${symbol} chnexport "${symbol}", 3`;
  }).join('\n');
}

function denseScore(): string {
  const lines: string[] = [];
  for (let index = 0; index < NOTE_COUNT; index += 1) {
    // Keep all release rates fast so the benchmark measures the dense active
    // region rather than a long, preset-dependent tail.
    const start = (index * 0.004).toFixed(3);
    const pitch = String(48 + (index % 24));
    lines.push(`i1 ${start} ${NOTE_DURATION} ${pitch} 127`);
  }
  lines.push('e');
  return lines.join('\n');
}

function buildCsd(
  voice: ReturnType<typeof createDefaultBlueX7Voice>,
  target: string,
  epoch: boolean,
): string {
  const epochDeclaration = epoch ? 'gk_blue_x7_epoch init 0\n' : '';
  return `<CsoundSynthesizer>
<CsInstruments>
sr = ${SAMPLE_RATE}
ksmps = ${KSMPS}
nchnls = 1
0dbfs = 1
${directGlobalDeclarations(voice)}
${epochDeclaration}
${BLUE_X7_MODERN_ORCHESTRA}
instr 1
${target}  outc aout
endin
</CsInstruments>
<CsScore>
${denseScore()}
</CsScore>
</CsoundSynthesizer>
`;
}

function truncateFixtureScore(csd: string, endTime: number): string {
  const scoreStart = csd.indexOf('<CsScore>');
  const scoreEnd = csd.indexOf('</CsScore>', scoreStart);
  if (scoreStart < 0 || scoreEnd < 0) throw new Error('fixture CSD has no score section');
  const score = csd
    .slice(scoreStart + '<CsScore>'.length, scoreEnd)
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.trim().match(/^i(?:"[^"]+"|\S*)\s+([-+]?\d+(?:\.\d+)?)/);
      return !match || Number(match[1]) <= endTime;
    })
    .map((line) => {
      const trimmed = line.trim();
      if (!/^i(?:3|4|"BlueMixer")\s/.test(trimmed)) return line;
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 3) tokens[2] = String(endTime);
      return tokens.join(' ');
    })
    .filter((line) => !/^e\s*$/.test(line.trim()));
  return `${csd.slice(0, scoreStart)}<CsScore>\n${score.join('\n')}\ne\n${csd.slice(scoreEnd)}`;
}

function validateCheckedInFixture(directory: string): FixtureSummary | null {
  const bluePath = path.join(repoRoot, 'fixtures/blue-x7-pop-song.blue');
  const csdPath = path.join(repoRoot, 'fixtures/blue-x7-pop-song.csd');
  if (!fs.existsSync(bluePath)) return null;
  const generated = BlueData.loadFromString(fs.readFileSync(bluePath, 'utf8')).toCSD();
  if (fs.existsSync(csdPath)) {
    expect(generated).toBe(fs.readFileSync(csdPath, 'utf8'));
  }
  expect(generated).not.toContain('tabw');
  expect(generated).not.toContain('chnget');
  expect(generated).toContain('ksmps=64');
  expect(generated).toContain('0dbfs=1');

  const copyPath = path.join(directory, 'blue-x7-pop-song.csd');
  fs.writeFileSync(copyPath, generated);
  const compile = runTimed('csound', ['--syntax-check-only', '-m0', copyPath], directory);
  if (compile.status !== 0) {
    throw new Error(`Checked-in BlueX7 fixture failed syntax validation:\n${compile.stderr}`);
  }
  const densePath = path.join(directory, 'blue-x7-pop-song-dense-10s.csd');
  fs.writeFileSync(densePath, truncateFixtureScore(generated, 10));
  const denseWavPath = path.join(directory, 'blue-x7-pop-song-dense-10s.wav');
  const denseRuns = Math.max(1, Number(process.env.BLUE_X7_TAIL_RUNS ?? 1));
  const denseResults = Array.from({ length: denseRuns }, () =>
    runTimed('csound', ['-d', '-W', '--format=double', '-o', denseWavPath, densePath], directory),
  );
  const failedDense = denseResults.find((result) => result.status !== 0);
  if (failedDense) {
    throw new Error(`Dense checked-in BlueX7 fixture failed to render:\n${failedDense.stderr}`);
  }
  const dense = denseResults.reduce((best, result) =>
    result.userSeconds + result.sysSeconds < best.userSeconds + best.sysSeconds ? result : best,
  );
  const denseSamples = readDoubleWave(denseWavPath);
  const denseRenderedSeconds = denseSamples.length / 44_100 / 2;
  const mirrorOn = benchmarkEngine(densePath, true, directory);
  const mirrorOff = benchmarkEngine(densePath, false, directory);
  return {
    csdBytes: Buffer.byteLength(generated),
    compileSeconds: compile.realSeconds,
    sampleRate: Number(generated.match(/\nsr=(\d+)/)?.[1] ?? 0),
    ksmps: Number(generated.match(/\nksmps=(\d+)/)?.[1] ?? 0),
    zeroDbfs: generated.match(/\n0dbfs=([^\s]+)/)?.[1] ?? null,
    denseRuns,
    denseRenderedSeconds,
    denseCpuSeconds: dense.userSeconds + dense.sysSeconds,
    denseRealtimeRatio:
      dense.realSeconds > 0 ? denseRenderedSeconds / dense.realSeconds : Number.POSITIVE_INFINITY,
    engineMirrorOnSeconds: mirrorOn?.realSeconds ?? null,
    engineMirrorOffSeconds: mirrorOff?.realSeconds ?? null,
  };
}

function readDoubleWave(wavPath: string): Float64Array {
  const wav = fs.readFileSync(wavPath);
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    offset += 8;
    if (id === 'data') {
      dataOffset = offset;
      dataSize = size;
      break;
    }
    offset += size + (size % 2);
  }
  if (dataOffset < 0) throw new Error('Csound benchmark output has no data chunk');
  const bytes = Math.min(dataSize, wav.length - dataOffset);
  const samples = new Float64Array(Math.floor(bytes / 8));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = wav.readDoubleLE(dataOffset + index * 8);
  }
  return samples;
}

function runVariant(
  name: string,
  voice: ReturnType<typeof createDefaultBlueX7Voice>,
  target: string,
  epoch: boolean,
  directory: string,
): VariantResult {
  const csdPath = path.join(directory, `${name}.csd`);
  const wavPath = path.join(directory, `${name}.wav`);
  fs.writeFileSync(csdPath, buildCsd(voice, target, epoch));

  const compile = runTimed('csound', ['--syntax-check-only', '-m0', csdPath], directory);
  if (compile.status !== 0) {
    throw new Error(`Csound syntax check failed for ${name}:\n${compile.stderr}`);
  }

  const performance = runTimed(
    'csound',
    ['-d', '-W', '--format=double', '-o', wavPath, csdPath],
    directory,
  );
  if (performance.status !== 0) {
    throw new Error(`Csound render failed for ${name}:\n${performance.stderr}`);
  }
  const samples = readDoubleWave(wavPath);
  const renderedSeconds = samples.length / SAMPLE_RATE;
  return {
    name,
    csdBytes: fs.statSync(csdPath).size,
    compileSeconds: compile.realSeconds,
    realSeconds: performance.realSeconds,
    userSeconds: performance.userSeconds,
    sysSeconds: performance.sysSeconds,
    renderedSeconds,
    realtimeRatio:
      performance.realSeconds > 0
        ? renderedSeconds / performance.realSeconds
        : Number.POSITIVE_INFINITY,
    samples,
  };
}

function maximumDifference(left: Float64Array, right: Float64Array): number {
  const length = Math.min(left.length, right.length);
  let result = Math.abs(left.length - right.length);
  for (let index = 0; index < length; index += 1) {
    result = Math.max(result, Math.abs(left[index] - right[index]));
  }
  return result;
}

function benchmarkEngine(csdPath: string, mirror: boolean, cwd: string): Timing | null {
  if (!enginePath) return null;
  const args = [
    '--disable-thread-priority-elevation',
    ...(mirror ? [] : ['--disable-shared-memory']),
    '--run-csound',
    '--',
    '-n',
    '-d',
    '-m0',
    csdPath,
  ];
  const result = runTimed(enginePath, args, cwd);
  if (result.status !== 0) {
    throw new Error(
      `Blue Engine benchmark failed (${mirror ? 'mirror-on' : 'mirror-off'}):\n${result.stderr}`,
    );
  }
  return result;
}

describe.skipIf(!benchmarkEnabled || !hasCsound)('BlueX7 dense performance benchmark', () => {
  it('records direct-global guard, UDO/inline, and mirror baselines', () => {
    const voice = createDefaultBlueX7Voice();
    for (const operator of voice.operators) {
      operator.envelope[3] = { rate: 99, level: 0 };
    }
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bluex7-perf-'));
    try {
      const fixture = validateCheckedInFixture(directory);
      const variants = [
        {
          name: 'static-udo',
          target: generateBlueX7Target({
            voice: transport.voice,
            operatorMask: transport.operatorMask,
            layout: 'udo',
            variablePrefix: 'Static',
          }),
          epoch: false,
        },
        {
          name: 'live-udo-per-note',
          target: generateBlueX7Target({
            voice: transport.voice,
            operatorMask: transport.operatorMask,
            parameters,
            layout: 'udo',
            changeStrategy: 'per-note',
            variablePrefix: 'LivePerNote',
          }),
          epoch: false,
        },
        {
          name: 'live-inline-per-note',
          target: generateBlueX7Target({
            voice: transport.voice,
            operatorMask: transport.operatorMask,
            parameters,
            layout: 'inline',
            changeStrategy: 'per-note',
            variablePrefix: 'InlinePerNote',
          }),
          epoch: false,
        },
        {
          name: 'live-udo-epoch',
          target: generateBlueX7Target({
            voice: transport.voice,
            operatorMask: transport.operatorMask,
            parameters,
            layout: 'udo',
            changeStrategy: 'epoch',
            epochSymbol: 'gk_blue_x7_epoch',
            variablePrefix: 'LiveEpoch',
          }),
          epoch: true,
        },
        {
          name: 'live-inline-epoch',
          target: generateBlueX7Target({
            voice: transport.voice,
            operatorMask: transport.operatorMask,
            parameters,
            layout: 'inline',
            changeStrategy: 'epoch',
            epochSymbol: 'gk_blue_x7_epoch',
            variablePrefix: 'InlineEpoch',
          }),
          epoch: true,
        },
      ];
      const results = variants.map((variant) =>
        runVariant(variant.name, voice, variant.target, variant.epoch, directory),
      );
      const byName = new Map(results.map((result) => [result.name, result]));
      const reference = byName.get('static-udo')!;
      for (const result of results) {
        expect(result.samples.length).toBeGreaterThan(0);
        expect(result.samples.every(Number.isFinite)).toBe(true);
      }
      expect(
        maximumDifference(reference.samples, byName.get('live-udo-epoch')!.samples),
      ).toBeLessThan(1e-9);
      expect(
        maximumDifference(reference.samples, byName.get('live-inline-epoch')!.samples),
      ).toBeLessThan(1e-9);

      const carrierSkewVoice = createDefaultBlueX7Voice();
      carrierSkewVoice.common.algorithm = 16;
      for (const [index, operator] of carrierSkewVoice.operators.entries()) {
        operator.envelope = [
          { rate: 99, level: 99 },
          { rate: 99, level: 99 },
          { rate: 99, level: 99 },
          { rate: index === 0 ? 99 : 0, level: 0 },
        ];
      }
      const carrierSkewTransport = buildBlueX7VoiceTransport(
        carrierSkewVoice,
        carrierSkewVoice.common.operatorEnabled,
      );
      const carrierSkew = runVariant(
        'carrier-skew-release',
        carrierSkewVoice,
        generateBlueX7Target({
          voice: carrierSkewTransport.voice,
          operatorMask: carrierSkewTransport.operatorMask,
          layout: 'inline',
        }),
        false,
        directory,
      );

      const mirrorOn = benchmarkEngine(
        path.join(directory, 'live-inline-epoch.csd'),
        true,
        directory,
      );
      const mirrorOff = benchmarkEngine(
        path.join(directory, 'live-inline-epoch.csd'),
        false,
        directory,
      );
      const summary = results.map(({ samples: _samples, ...result }) => result);
      console.info(
        JSON.stringify(
          {
            sampleRate: SAMPLE_RATE,
            ksmps: KSMPS,
            noteCount: NOTE_COUNT,
            noteDuration: NOTE_DURATION,
            engine: enginePath ?? null,
            fixture,
            carrierSkew: (({ samples: _samples, ...result }) => result)(carrierSkew),
            variants: summary,
            mirrorOn,
            mirrorOff,
            outputMaxDifference: {
              staticVsUdoEpoch: maximumDifference(
                reference.samples,
                byName.get('live-udo-epoch')!.samples,
              ),
              staticVsInlineEpoch: maximumDifference(
                reference.samples,
                byName.get('live-inline-epoch')!.samples,
              ),
            },
          },
          null,
          2,
        ),
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 180_000);
});
