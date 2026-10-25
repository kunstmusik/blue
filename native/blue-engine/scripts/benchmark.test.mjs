import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CSD_BENCHMARK_KIND,
  CSD_DEFAULT_SEED,
  CSD_MINIMUM_TRIALS,
  CSD_SCHEMA_VERSION,
  buildCsdComparisonReport,
  csdCaptureIdentity,
  medianOf,
  mulberry32,
  pairedTrialOrder,
  parseBenchmarkArgs,
} from './benchmark.mjs';
import { packageRoot } from './artifact.mjs';
import { resolveTarget } from './target.mjs';

// ---------------------------------------------------------------------------
// T009 contract tests for the supplied-CSD benchmark mode (SPEC 118).
// Pure arg-parsing/report-shaping tests always run; native CLI spawn tests run
// only when a prebuilt Release benchmark_engine exists and skip otherwise.
// ---------------------------------------------------------------------------

const syntheticWindowsPath = 'C:\\Users\\Mixed Case\\dir with space\\x.csd';

async function makeCsdFixture(directory, name) {
  const path = join(directory, name);
  const csd = [
    '<CsoundSynthesizer>',
    '<CsInstruments>',
    'sr = 44100',
    'ksmps = 32',
    'nchnls = 2',
    '0dbfs = 1',
    '',
    'instr 1',
    '  aOut oscili 0.2, 440, 1',
    '  outs aOut, aOut',
    'endin',
    '</CsInstruments>',
    '<CsScore>',
    'f 1 0 4096 10 1',
    'i1 0 60',
    '</CsScore>',
    '</CsoundSynthesizer>',
    '',
  ].join('\n');
  await writeFile(path, csd, 'utf-8');
  return { path, csd };
}

// -- Wrapper arg parsing ----------------------------------------------------

test('wrapper accepts --csd with --baseline-csd and keeps historical args', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'blue-bench-args-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidate = join(directory, 'candidate.csd');
  const baseline = join(directory, 'baseline.csd');
  await writeFile(candidate, 'x', 'utf-8');
  await writeFile(baseline, 'x', 'utf-8');

  const csdOptions = parseBenchmarkArgs(['--csd', candidate, '--baseline-csd', baseline]);
  assert.equal(csdOptions.mode, 'csd');
  assert.equal(csdOptions.csdPath, candidate);
  assert.equal(csdOptions.baselineCsdPath, baseline);
  assert.equal(csdOptions.numTrials, 7);
  assert.equal(csdOptions.numCycles, 65536);

  const tuned = parseBenchmarkArgs([
    '--csd',
    candidate,
    '--baseline-csd',
    baseline,
    '--trials',
    '9',
    '--cycles',
    '65536',
    '--output',
    join(directory, 'report.json'),
  ]);
  assert.equal(tuned.numTrials, 9);
  assert.equal(tuned.numCycles, 65536);

  // Historical fixed-scenario parsing is unchanged, including silently
  // ignored unknown arguments.
  const fixedOptions = parseBenchmarkArgs([
    '--baseline',
    'old.json',
    '--trials',
    '3',
    '--cycles',
    '8192',
    '--output',
    'out.json',
  ]);
  assert.equal(fixedOptions.mode, 'fixed');
  assert.equal(fixedOptions.baselinePath, 'old.json');
  assert.equal(fixedOptions.numTrials, 3);
  assert.equal(fixedOptions.numCycles, 8192);

  const defaults = parseBenchmarkArgs([]);
  assert.equal(defaults.mode, 'fixed');
  assert.equal(defaults.numTrials, 5);
  assert.equal(defaults.numCycles, 4096);
  assert.equal(defaults.baselinePath, null);
  assert.doesNotThrow(() => parseBenchmarkArgs(['--unrecognized']));
});

test('wrapper rejects ambiguous and incomplete supplied-CSD combinations', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'blue-bench-reject-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidate = join(directory, 'candidate.csd');
  const baseline = join(directory, 'baseline.csd');
  const missing = join(directory, 'missing.csd');
  await writeFile(candidate, 'x', 'utf-8');
  await writeFile(baseline, 'x', 'utf-8');

  assert.throws(
    () =>
      parseBenchmarkArgs([
        '--csd',
        candidate,
        '--baseline-csd',
        baseline,
        '--baseline',
        'old.json',
      ]),
    /ambiguous combination: --csd cannot be combined with .+--baseline/,
  );
  assert.throws(
    () => parseBenchmarkArgs(['--baseline-csd', baseline]),
    /--baseline-csd requires --csd/,
  );
  assert.throws(() => parseBenchmarkArgs(['--csd']), /--csd requires a value/);
  assert.throws(
    () => parseBenchmarkArgs(['--csd', candidate, '--baseline-csd']),
    /--baseline-csd requires a value/,
  );
  assert.throws(
    () => parseBenchmarkArgs(['--csd', missing, '--baseline-csd', baseline]),
    (error) => error.message === `--csd file not found (ENOENT): ${missing}`,
  );
  assert.throws(
    () => parseBenchmarkArgs(['--csd', candidate, '--baseline-csd', missing]),
    /--baseline-csd file not found \(ENOENT\)/,
  );
  assert.throws(
    () =>
      parseBenchmarkArgs([
        '--csd',
        candidate,
        '--baseline-csd',
        baseline,
        '--trials',
        String(CSD_MINIMUM_TRIALS - 1),
      ]),
    new RegExp(`--trials must be an integer >= ${CSD_MINIMUM_TRIALS}`),
  );
  // The new mode rejects unsupported arguments; the historical mode keeps
  // ignoring them so existing invocations behave exactly as before.
  assert.throws(
    () => parseBenchmarkArgs(['--csd', candidate, '--baseline-csd', baseline, '--scenario', 'all']),
    /unsupported argument in --csd mode/,
  );
});

test('wrapper passes paths with spaces and synthetic Windows paths through unchanged', async (t) => {
  const windowsBaseline = 'C:\\Users\\Mixed Case\\dir with space\\baseline y.csd';
  const parsed = parseBenchmarkArgs(
    ['--csd', syntheticWindowsPath, '--baseline-csd', windowsBaseline],
    { exists: () => true },
  );
  assert.equal(parsed.csdPath, syntheticWindowsPath);
  assert.equal(parsed.baselineCsdPath, windowsBaseline);

  // Real fixtures in a directory whose name contains spaces.
  const directory = await mkdtemp(join(tmpdir(), 'blue bench dir '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidate = join(directory, 'candidate with space.csd');
  const baseline = join(directory, 'baseline with space.csd');
  await writeFile(candidate, 'x', 'utf-8');
  await writeFile(baseline, 'x', 'utf-8');
  const fromDisk = parseBenchmarkArgs(['--csd', candidate, '--baseline-csd', baseline]);
  assert.equal(fromDisk.csdPath, candidate);
  assert.equal(fromDisk.baselineCsdPath, baseline);
});

// -- Deterministic paired ordering -------------------------------------------

test('paired trial order is deterministic and balanced for a given seed', () => {
  const order = pairedTrialOrder(CSD_DEFAULT_SEED, CSD_MINIMUM_TRIALS);
  const repeated = pairedTrialOrder(CSD_DEFAULT_SEED, CSD_MINIMUM_TRIALS);
  assert.deepEqual(order, repeated);
  assert.equal(order.length, CSD_MINIMUM_TRIALS);
  for (const pair of order) {
    assert.deepEqual([...pair].sort(), ['baseline', 'candidate']);
  }
  // Other seeds are each deterministic as well and stay valid permutations.
  for (const seed of [1, 2, 1181, 4294967295]) {
    const seeded = pairedTrialOrder(seed, 7);
    assert.deepEqual(seeded, pairedTrialOrder(seed, 7));
    for (const pair of seeded) {
      assert.deepEqual([...pair].sort(), ['baseline', 'candidate']);
    }
  }
});

test('mulberry32 draws are deterministic for a given seed', () => {
  const first = mulberry32(CSD_DEFAULT_SEED);
  const second = mulberry32(CSD_DEFAULT_SEED);
  for (let index = 0; index < 16; index += 1) {
    const value = first();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, second());
  }
});

test('medianOf summarizes odd and even samples', () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(medianOf([])));
});

// -- Comparison report shaping ------------------------------------------------

function makeNativeReport(overrides = {}) {
  return {
    benchmarkKind: CSD_BENCHMARK_KIND,
    schemaVersion: CSD_SCHEMA_VERSION,
    timestamp: '2026-01-01T00:00:00Z',
    csdPath: '/tmp/fixture.csd',
    csdSha256: overrides.csdSha256 ?? 'a'.repeat(64),
    metric: {
      name: 'performKsmpsAvgUs',
      clock: 'steady_clock',
      units: 'microseconds per ksmps block',
    },
    metadata: {
      buildType: 'Release',
      compiler: 'clang 15.0.0',
      targetArch: 'arm64',
      operatingSystem: 'macos',
      csoundVersion: 7010,
      engineSourceRevision: 'deadbeef',
      csoundLibraryPath: '/library/csound',
      csoundLibrarySha256: 'd'.repeat(64),
      sampleBytes: 8,
      threading: 'single perform thread',
      sampleRate: 44100,
      ksmps: 32,
      nchnls: 2,
      zeroDbFs: 1,
      headerDerivation: 'sr/ksmps/nchnls/0dbfs parsed from CsInstruments header assignments',
      csoundOptions: ['-n', '-d', '-m0'],
      csdCsOptionsIgnored: true,
      warmupCycles: 1024,
      measuredCycles: 65536,
      trials: 1,
      ...overrides.metadata,
    },
    trials: overrides.trials ?? [{ performKsmpsAvgUs: 10, measuredCycles: 65536 }],
    medianPerformKsmpsAvgUs: overrides.medianPerformKsmpsAvgUs ?? 10,
  };
}

function trialsOf(values) {
  return values.map((performKsmpsAvgUs) => ({ performKsmpsAvgUs, measuredCycles: 65536 }));
}

function captureIdentity(hash) {
  return {
    manifestSha256: 'd'.repeat(64),
    blueRevision: 'e'.repeat(40),
    dirtyDiffHash: 'f'.repeat(64),
    exporterHash: 'a'.repeat(64),
    id: 'fixture',
    profile: 'realtime',
    identity: 'a'.repeat(64),
    sampleRate: 44100,
    ksmps: 32,
    channels: 2,
    durationSeconds: 60,
    csdSha256: hash,
    bindingsSha256: 'a'.repeat(64),
  };
}

function makeComparison({
  candidateValues,
  baselineValues,
  candidateOverrides,
  baselineOverrides,
}) {
  candidateValues = Array.from(
    { length: 7 },
    (_, i) => candidateValues[i % candidateValues.length],
  );
  baselineValues = Array.from({ length: 7 }, (_, i) => baselineValues[i % baselineValues.length]);
  const order = pairedTrialOrder(CSD_DEFAULT_SEED, candidateValues.length);
  return buildCsdComparisonReport({
    seed: CSD_DEFAULT_SEED,
    order,
    candidate: {
      identity: captureIdentity('b'.repeat(64)),
      csdPath: '/tmp/candidate.csd',
      csdSha256: 'b'.repeat(64),
      reports: candidateValues.map((value) =>
        makeNativeReport({
          csdSha256: 'b'.repeat(64),
          ...(candidateOverrides ?? {}),
          trials: [{ performKsmpsAvgUs: value, measuredCycles: 65536 }],
        }),
      ),
    },
    baseline: {
      identity: captureIdentity('c'.repeat(64)),
      csdPath: '/tmp/baseline.csd',
      csdSha256: 'c'.repeat(64),
      reports: baselineValues.map((value) =>
        makeNativeReport({
          csdSha256: 'c'.repeat(64),
          ...(baselineOverrides ?? {}),
          trials: [{ performKsmpsAvgUs: value, measuredCycles: 65536 }],
        }),
      ),
    },
  });
}

test('comparison report has the mixer-generated-csd shape with verdicts', () => {
  const report = makeComparison({
    candidateValues: [10, 11, 12],
    baselineValues: [10, 10, 10],
  });
  assert.equal(report.benchmarkKind, 'mixer-generated-csd');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.seed, CSD_DEFAULT_SEED);
  assert.deepEqual(report.order, pairedTrialOrder(CSD_DEFAULT_SEED, 7));
  assert.match(report.fixtureId, /^[0-9a-f]{64}$/);
  assert.equal(report.candidate.csdSha256, 'b'.repeat(64));
  assert.equal(report.baseline.csdSha256, 'c'.repeat(64));
  assert.equal(report.candidate.metadata.sampleRate, 44100);
  assert.equal(report.candidate.metadata.ksmps, 32);
  assert.equal(report.candidate.metadata.nchnls, 2);
  assert.equal(report.candidate.medianPerformKsmpsAvgUs, 11);
  assert.equal(report.baseline.medianPerformKsmpsAvgUs, 10);
  assert.equal(report.medianDeltaPct, 10);
  assert.equal(report.gatePassed, false);
  assert.equal(report.candidateFasterPct10, false);
  assert.equal(report.pairedTrials.length, 7);
  assert.equal(report.pairedTrials[0].candidate.performKsmpsAvgUs, 10);
  assert.equal(report.pairedTrials[0].baseline.performKsmpsAvgUs, 10);
  assert.deepEqual([...report.pairedTrials[1].order].sort(), ['baseline', 'candidate']);
  assert.ok(report.candidate.spread.maxUs >= report.candidate.spread.minUs);
  assert.equal(report.metric.units, 'microseconds per ksmps block');
  assert.equal(report.metric.clock, 'steady_clock');
});

test('candidateFasterPct10 reports the 10 percent improvement verdict', () => {
  const faster = makeComparison({
    candidateValues: [8, 9, 8],
    baselineValues: [10, 10, 10],
  });
  assert.equal(faster.candidate.medianPerformKsmpsAvgUs, 8);
  assert.equal(faster.medianDeltaPct, -20);
  assert.equal(faster.candidateFasterPct10, true);
  assert.equal(faster.gatePassed, true);

  const boundary = makeComparison({
    candidateValues: [9, 9, 9],
    baselineValues: [10, 10, 10],
  });
  assert.equal(boundary.medianDeltaPct, -10);
  assert.equal(boundary.candidateFasterPct10, true);
});

test('baseline and candidate metadata must match with explicit field errors', () => {
  assert.throws(
    () =>
      makeComparison({
        candidateValues: [10, 10],
        baselineValues: [10, 10],
        baselineOverrides: { metadata: { sampleRate: 48000 } },
      }),
    /metadata mismatch for sampleRate/,
  );
  assert.throws(
    () =>
      makeComparison({
        candidateValues: [10, 10],
        baselineValues: [10, 10],
        baselineOverrides: { metadata: { ksmps: 64 } },
      }),
    /metadata mismatch for ksmps/,
  );
  assert.throws(
    () =>
      makeComparison({
        candidateValues: [10, 10],
        baselineValues: [10, 10],
        baselineOverrides: { metadata: { compiler: 'gcc 13.0.0' } },
      }),
    /metadata mismatch for compiler/,
  );
  assert.throws(
    () =>
      makeComparison({
        candidateValues: [10, 10],
        baselineValues: [10, 10],
        baselineOverrides: { metadata: { nchnls: 1 } },
      }),
    /metadata mismatch for nchnls/,
  );
  // The paired trial count must match the recorded interleaving order.
  assert.throws(
    () =>
      buildCsdComparisonReport({
        seed: CSD_DEFAULT_SEED,
        order: pairedTrialOrder(CSD_DEFAULT_SEED, 3),
        candidate: {
          csdPath: '/tmp/candidate.csd',
          csdSha256: 'b'.repeat(64),
          reports: [makeNativeReport(), makeNativeReport()],
        },
        baseline: {
          csdPath: '/tmp/baseline.csd',
          csdSha256: 'c'.repeat(64),
          reports: [makeNativeReport(), makeNativeReport(), makeNativeReport()],
        },
      }),
    /candidate native report count 2 does not match paired trial count 3/,
  );
});

test('missing or malformed native metrics fail structurally', () => {
  const order = pairedTrialOrder(CSD_DEFAULT_SEED, 1);
  const sides = (candidateReport, baselineReport) => ({
    seed: CSD_DEFAULT_SEED,
    order,
    candidate: { csdPath: 'c', csdSha256: 'b'.repeat(64), reports: [candidateReport] },
    baseline: { csdPath: 'b', csdSha256: 'c'.repeat(64), reports: [baselineReport] },
  });
  assert.throws(
    () =>
      buildCsdComparisonReport(
        sides({ ...makeNativeReport(), benchmarkKind: 'fixed-scenario' }, makeNativeReport()),
      ),
    /unexpected benchmarkKind/,
  );
  assert.throws(
    () =>
      buildCsdComparisonReport(
        sides({ ...makeNativeReport(), schemaVersion: 2 }, makeNativeReport()),
      ),
    /unexpected schemaVersion/,
  );
  assert.throws(
    () =>
      buildCsdComparisonReport(
        sides({ ...makeNativeReport(), csdSha256: 'nothex' }, makeNativeReport()),
      ),
    /malformed csdSha256/,
  );
  assert.throws(
    () =>
      buildCsdComparisonReport(sides({ ...makeNativeReport(), trials: [] }, makeNativeReport())),
    /no trials/,
  );
  assert.throws(
    () =>
      buildCsdComparisonReport(
        sides({ ...makeNativeReport(), trials: [{ measuredCycles: 65536 }] }, makeNativeReport()),
      ),
    /trial 0 .*performKsmpsAvgUs/,
  );
});

test('non-finite, zero, or incomplete-window metrics fail the gate', () => {
  const zero = makeComparison({ candidateValues: [0, 10, 10], baselineValues: [10, 10, 10] });
  assert.equal(zero.gatePassed, false);

  const notFinite = makeComparison({
    candidateValues: [Number.NaN, 10, 10],
    baselineValues: [10, 10, 10],
  });
  assert.equal(notFinite.gatePassed, false);

  const baselineZero = makeComparison({
    candidateValues: [10, 10, 10],
    baselineValues: [0, 10, 10],
  });
  assert.equal(baselineZero.gatePassed, false);

  // An incomplete measurement window must fail the gate, not pass it.
  const order = pairedTrialOrder(CSD_DEFAULT_SEED, 1);
  const shortWindow = buildCsdComparisonReport({
    seed: CSD_DEFAULT_SEED,
    order,
    candidate: {
      identity: captureIdentity('b'.repeat(64)),
      csdPath: 'c',
      csdSha256: 'b'.repeat(64),
      reports: [
        makeNativeReport({
          csdSha256: 'b'.repeat(64),
          trials: [{ performKsmpsAvgUs: 10, measuredCycles: 512 }],
        }),
      ],
    },
    baseline: {
      identity: captureIdentity('c'.repeat(64)),
      csdPath: 'b',
      csdSha256: 'c'.repeat(64),
      reports: [makeNativeReport({ csdSha256: 'c'.repeat(64) })],
    },
  });
  assert.equal(shortWindow.gatePassed, false);
});

// -- Native CLI argument contract (spawn tests, guarded on prebuilt binary) ---

const target = resolveTarget();
const benchmarkExecutable = join(
  packageRoot,
  `build-${target.key}-release`,
  target.platform === 'win32' ? join('Release', 'benchmark_engine.exe') : 'benchmark_engine',
);
const nativeAvailable = existsSync(benchmarkExecutable);
const nativeSkip = nativeAvailable ? false : 'prebuilt Release benchmark_engine not present';

function runNative(args) {
  return spawnSync(benchmarkExecutable, args, { encoding: 'utf-8' });
}

test('native CLI rejects --csd combined with --scenario', { skip: nativeSkip }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'blue-bench-native-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { path } = await makeCsdFixture(directory, 'fixture.csd');

  const combined = runNative(['--csd', path, '--scenario', 'static_0']);
  assert.notEqual(combined.status, 0);
  assert.equal(combined.status, 2);
  assert.match(combined.stderr, /--csd cannot be combined with --scenario/);
});

test('native CLI rejects a missing or unreadable CSD file', { skip: nativeSkip }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'blue-bench-native-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const missing = join(directory, 'does-not-exist.csd');

  const result = runNative(['--csd', missing]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot open CSD file/);
});

test('native CLI still rejects unknown arguments', { skip: nativeSkip }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'blue-bench-native-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { path } = await makeCsdFixture(directory, 'fixture.csd');

  const result = runNative(['--csd', path, '--definitely-not-an-argument']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument/);
});

test(
  'native --csd mode reports a sha256-verified mixer-generated-csd report',
  { skip: nativeSkip },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'blue bench native '));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const { path, csd } = await makeCsdFixture(directory, 'candidate with space.csd');
    const expectedSha = createHash('sha256').update(csd, 'utf-8').digest('hex');

    const result = runNative([
      '--json',
      '--csd',
      path,
      '--trials',
      '1',
      '--warmup-cycles',
      '1024',
      '--measure-cycles',
      '65536',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.benchmarkKind, 'mixer-generated-csd');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.csdPath, path);
    assert.equal(report.csdSha256, expectedSha);
    assert.equal(report.metadata.sampleRate, 44100);
    assert.equal(report.metadata.ksmps, 32);
    assert.equal(report.metadata.nchnls, 2);
    assert.equal(report.metadata.zeroDbFs, 1);
    assert.equal(report.metadata.buildType, 'Release');
    assert.equal(report.metadata.sampleBytes, 8);
    assert.ok(report.metadata.csoundLibraryPath.length > 0);
    assert.match(report.metadata.csoundLibrarySha256, /^[0-9a-f]{64}$/);
    assert.equal(report.metadata.warmupCycles, 1024);
    assert.equal(report.metadata.measuredCycles, 65536);
    assert.equal(report.metadata.csoundOptions.join(' '), '-n -d -m0');
    assert.equal(report.trials.length, 1);
    assert.ok(Number.isFinite(report.trials[0].performKsmpsAvgUs));
    assert.ok(report.trials[0].performKsmpsAvgUs > 0);
    assert.ok(report.trials[0].measuredCycles >= 4096);
    assert.ok(Number.isFinite(report.medianPerformKsmpsAvgUs));
  },
);

test(
  'native --csd mode fails when the requested window cannot complete',
  { skip: nativeSkip },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'blue-bench-native-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const shortScore = join(directory, 'short-score.csd');
    await writeFile(
      shortScore,
      [
        '<CsoundSynthesizer>',
        '<CsInstruments>',
        'sr = 44100',
        'ksmps = 32',
        'nchnls = 2',
        '0dbfs = 1',
        'instr 1',
        '  aOut oscili 0.2, 440, 1',
        '  outs aOut, aOut',
        'endin',
        '</CsInstruments>',
        '<CsScore>',
        'f 1 0 4096 10 1',
        'i1 0 2',
        '</CsScore>',
        '</CsoundSynthesizer>',
        '',
      ].join('\n'),
      'utf-8',
    );

    const result = runNative([
      '--csd',
      shortScore,
      '--trials',
      '1',
      '--warmup-cycles',
      '1024',
      '--measure-cycles',
      '65536',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /measurement window/);
  },
);

test('native fixed-scenario invocations without --csd are unchanged', { skip: nativeSkip }, () => {
  const result = runNative([
    '--json',
    '--scenario',
    'static_0',
    '--trials',
    '1',
    '--warmup-cycles',
    '1024',
    '--measure-cycles',
    '4096',
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.metadata.sampleRate, 48000);
  assert.equal(report.metadata.ksmps, 32);
  assert.equal(report.scenarios.length, 1);
  assert.equal(report.scenarios[0].name, 'static_0');
  assert.ok(report.scenarios[0].medianSummary.hostCycleAvgUs >= 0);
});

test('supplied-CSD short windows require explicit research mode', () => {
  const args = ['--csd', 'candidate', '--baseline-csd', 'baseline', '--cycles', '4096'];
  assert.throws(() => parseBenchmarkArgs(args, { exists: () => true }), /65536/);
  const research = parseBenchmarkArgs([...args, '--research'], { exists: () => true });
  assert.equal(research.research, true);
  assert.equal(research.numCycles, 4096);
});

test('performance thresholds are separate from valid metrics and never rounded', () => {
  for (const [value, primary, representative] of [
    [9, true, true],
    [9.002, false, true],
    [10.5, false, true],
    [10.501, false, false],
  ]) {
    const report = makeComparison({ candidateValues: [value], baselineValues: [10] });
    assert.equal(report.metricsValid, true);
    assert.equal(report.primaryImprovementMet, primary);
    assert.equal(report.representativeRegressionMet, representative);
    assert.equal(report.gatePassed, primary);
  }
});

test('requested windows and minimum paired trials cannot be inferred from matching short reports', () => {
  const report = makeComparison({
    candidateValues: [8],
    baselineValues: [10],
    candidateOverrides: { metadata: { measuredCycles: 4096 } },
    baselineOverrides: { metadata: { measuredCycles: 4096 } },
  });
  assert.equal(report.gatePassed, false);
  assert.equal(report.metricsValid, false);
});

test('native short acceptance windows fail before runtime setup', { skip: nativeSkip }, () => {
  const result = runNative(['--csd', 'unused.csd', '--measure-cycles', '4096']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /65536/);
});

test('acceptance capture identities require complete revision, input and binding hashes', () => {
  const entry = {
    ...captureIdentity('b'.repeat(64)),
    csdFile: 'candidate.csd',
    bindings: {},
    bindingsSha256: createHash('sha256').update('{}').digest('hex'),
  };
  const manifest = {
    schemaVersion: 2,
    blueRevision: entry.blueRevision,
    dirtyDiffHash: entry.dirtyDiffHash,
    exporterHash: entry.exporterHash,
    fixtures: [entry],
  };
  const load = (value) =>
    csdCaptureIdentity(value, 'a'.repeat(64), '/with space/candidate.csd', 'b'.repeat(64));
  assert.equal(load(manifest).identity, entry.identity);
  for (const field of ['blueRevision', 'dirtyDiffHash', 'exporterHash']) {
    assert.throws(() => load({ ...manifest, [field]: '' }), /identity/);
  }
  for (const field of ['identity', 'csdSha256', 'bindingsSha256']) {
    assert.throws(() => load({ ...manifest, fixtures: [{ ...entry, [field]: '' }] }), /identity/);
  }
});

test('native CSD hash and runtime identity mismatches reject acceptance', () => {
  assert.throws(
    () =>
      makeComparison({
        candidateValues: [8],
        baselineValues: [10],
        candidateOverrides: { csdSha256: 'f'.repeat(64) },
      }),
    /native report CSD hash/,
  );
  for (const field of ['csoundLibraryPath', 'csoundLibrarySha256', 'sampleBytes', 'compiler']) {
    assert.throws(
      () =>
        makeComparison({
          candidateValues: [8],
          baselineValues: [10],
          candidateOverrides: { metadata: { [field]: '' } },
        }),
      /identity|invalid|empty/,
    );
  }
});

test(
  'native verifies effective layout rather than trusting a parsed header prefix',
  { skip: nativeSkip },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'blue-bench-header-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const { path, csd } = await makeCsdFixture(directory, 'header.csd');
    await writeFile(path, csd.replace('nchnls = 2', 'nchnls = 2+1'));
    const result = runNative(['--csd', path]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /effective compiled/);
  },
);

test('supplied-CSD trials reject fractional and suffixed numbers instead of truncating', () => {
  for (const count of ['7.5', '7junk']) {
    assert.throws(
      () =>
        parseBenchmarkArgs(['--csd', 'c', '--baseline-csd', 'b', '--trials', count], {
          exists: () => true,
        }),
      /integer/,
    );
  }
});
