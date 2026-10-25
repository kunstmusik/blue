import { existsSync, realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { cpus, release } from 'node:os';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { packageRoot, sha256File } from './artifact.mjs';
import { resolveTarget } from './target.mjs';

// ============================================================================
// Supplied-CSD benchmark mode (SPEC 118 mixer-optimization evidence).
//
// The exports below are pure arg-parsing/report-shaping helpers covered by
// scripts/benchmark.test.mjs; the historical fixed-scenario flow at the bottom
// of this file is unchanged for invocations without --csd.
// ============================================================================

export const CSD_BENCHMARK_KIND = 'mixer-generated-csd';
export const CSD_SCHEMA_VERSION = 1;
export const CSD_DEFAULT_SEED = 1180;
export const CSD_MINIMUM_TRIALS = 7;
export const CSD_MINIMUM_CYCLES = 65536;

// Metadata that must be identical between the paired baseline and candidate
// native reports: both sides always run against the same Release executable
// and Csound runtime in one wrapper invocation.
const MATCHED_METADATA_FIELDS = [
  'buildType',
  'compiler',
  'targetArch',
  'operatingSystem',
  'csoundVersion',
  'engineSourceRevision',
  'csoundLibraryPath',
  'csoundLibrarySha256',
  'sampleBytes',
  'csoundOptions',
  'threading',
  'sampleRate',
  'ksmps',
  'nchnls',
  'zeroDbFs',
  'warmupCycles',
  'measuredCycles',
];

// Deterministic PRNG following the mulberry32 construction (public-domain
// mathematical construction by Tommy Ettinger; implemented here from the
// published rule). Used only to record a reproducible baseline/candidate
// interleaving order.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// For each paired trial, decide which side runs first. Same seed -> same
// order, recorded verbatim in the comparison report.
export function pairedTrialOrder(seed, trials) {
  const random = mulberry32(seed);
  const order = [];
  for (let trial = 0; trial < trials; trial += 1) {
    order.push(random() < 0.5 ? ['candidate', 'baseline'] : ['baseline', 'candidate']);
  }
  return order;
}

export function medianOf(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return Number.NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function parseBenchmarkArgs(argv, { exists = existsSync } = {}) {
  let baselinePath = null;
  let outputPath = null;
  let numTrials = 5;
  let numCycles = 4096;
  let csdPath = null;
  let baselineCsdPath = null;
  let trialsExplicit = false;
  let trialsText = '5';
  let cyclesExplicit = false;
  let research = false;
  let acceptance = 'primary';
  let candidateManifestPath = null;
  let baselineManifestPath = null;
  const unknownArgs = [];

  for (let i = 0; i < argv.length; ++i) {
    const arg = argv[i];
    if (arg === '--baseline' && i + 1 < argv.length) {
      baselinePath = argv[++i];
    } else if (arg === '--output' && i + 1 < argv.length) {
      outputPath = argv[++i];
    } else if (arg === '--trials' && i + 1 < argv.length) {
      trialsText = argv[++i];
      numTrials = Number.parseInt(trialsText, 10);
      trialsExplicit = true;
    } else if (arg === '--cycles' && i + 1 < argv.length) {
      numCycles = Number(argv[++i]);
      cyclesExplicit = true;
    } else if (arg === '--candidate-manifest' && i + 1 < argv.length) {
      candidateManifestPath = argv[++i];
    } else if (arg === '--baseline-manifest' && i + 1 < argv.length) {
      baselineManifestPath = argv[++i];
    } else if (arg === '--research') {
      research = true;
    } else if (arg === '--acceptance' && i + 1 < argv.length) {
      acceptance = argv[++i];
    } else if (arg === '--csd') {
      if (i + 1 >= argv.length) {
        throw new Error('--csd requires a value');
      }
      csdPath = argv[++i];
    } else if (arg === '--baseline-csd') {
      if (i + 1 >= argv.length) {
        throw new Error('--baseline-csd requires a value');
      }
      baselineCsdPath = argv[++i];
    } else {
      unknownArgs.push(arg);
    }
  }

  if (csdPath !== null) {
    if (baselinePath !== null) {
      throw new Error(
        'ambiguous combination: --csd cannot be combined with the historical ' +
          'fixed-scenario --baseline comparison; use --baseline-csd for a supplied-CSD baseline',
      );
    }
    if (baselineCsdPath === null) {
      throw new Error('--baseline-csd is required when --csd is used');
    }
    if (unknownArgs.length > 0) {
      throw new Error(`unsupported argument in --csd mode: ${unknownArgs.join(' ')}`);
    }
    // The supplied-CSD mode defaults to seven paired trials (contract
    // minimum); the historical fixed-scenario default stays at five.
    numTrials = trialsExplicit ? Number(trialsText) : CSD_MINIMUM_TRIALS;
    if (!Number.isInteger(numTrials) || numTrials < CSD_MINIMUM_TRIALS) {
      throw new Error(
        `--trials must be an integer >= ${CSD_MINIMUM_TRIALS} in --csd mode ` +
          '(the supplied-CSD contract requires at least seven paired trials)',
      );
    }
    if (!cyclesExplicit) numCycles = CSD_MINIMUM_CYCLES;
    if (
      !Number.isInteger(numCycles) ||
      numCycles <= 0 ||
      (!research && numCycles < CSD_MINIMUM_CYCLES)
    ) {
      throw new Error(
        '--cycles must be an integer >= 65536 in --csd acceptance mode; shorter research runs require --research',
      );
    }
    if (!['primary', 'representative'].includes(acceptance)) {
      throw new Error('--acceptance must be primary or representative');
    }
    if (!exists(csdPath)) {
      throw new Error(`--csd file not found (ENOENT): ${csdPath}`);
    }
    if (!exists(baselineCsdPath)) {
      throw new Error(`--baseline-csd file not found (ENOENT): ${baselineCsdPath}`);
    }
    return {
      mode: 'csd',
      research,
      acceptance,
      candidateManifestPath:
        candidateManifestPath ?? join(dirname(csdPath), 'baseline-manifest.json'),
      baselineManifestPath:
        baselineManifestPath ?? join(dirname(baselineCsdPath), 'baseline-manifest.json'),
      csdPath,
      baselineCsdPath,
      baselinePath: null,
      outputPath,
      numTrials,
      numCycles,
    };
  }

  if (baselineCsdPath !== null) {
    throw new Error('--baseline-csd requires --csd');
  }
  return {
    mode: 'fixed',
    csdPath: null,
    baselineCsdPath: null,
    baselinePath,
    outputPath,
    numTrials,
    numCycles,
  };
}

/** Bind a supplied file to its immutable exporter capture, never an engine revision. */
export function csdCaptureIdentity(manifest, manifestSha256, csdPath, csdSha256) {
  const hash = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  if (
    manifest?.schemaVersion !== 2 ||
    !/^[0-9a-f]{40}$/.test(manifest.blueRevision ?? '') ||
    !hash(manifest.dirtyDiffHash) ||
    !hash(manifest.exporterHash) ||
    !hash(manifestSha256)
  ) {
    throw new Error('missing or malformed Blue capture revision/diff/exporter/manifest identity');
  }
  const fixture = manifest.fixtures?.find((entry) => entry.csdFile === basename(csdPath));
  if (
    !fixture ||
    !fixture.bindings ||
    createHash('sha256').update(JSON.stringify(fixture.bindings)).digest('hex') !==
      fixture.bindingsSha256 ||
    fixture.csdSha256 !== csdSha256 ||
    !hash(fixture.identity) ||
    !hash(fixture.bindingsSha256) ||
    !fixture.id ||
    !['realtime', 'disk', 'blueLive'].includes(fixture.profile)
  ) {
    throw new Error('missing or mismatched fixture/input/CSD/binding capture identity');
  }
  for (const field of ['sampleRate', 'ksmps', 'channels', 'durationSeconds']) {
    if (!Number.isFinite(fixture[field]) || fixture[field] <= 0)
      throw new Error(`invalid capture identity ${field}`);
  }
  return {
    ...fixture,
    manifestSha256,
    blueRevision: manifest.blueRevision,
    dirtyDiffHash: manifest.dirtyDiffHash,
    exporterHash: manifest.exporterHash,
  };
}

// Structural validation of one native supplied-CSD report. Value-level gate
// failures (non-finite/zero metrics, incomplete windows) are handled by
// buildCsdComparisonReport so they fail the gate instead of parsing.
export function validateCsdNativeReport(report, label) {
  if (!report || typeof report !== 'object') {
    throw new Error(`${label}: native CSD benchmark report is not an object`);
  }
  if (report.benchmarkKind !== CSD_BENCHMARK_KIND) {
    throw new Error(`${label}: unexpected benchmarkKind ${JSON.stringify(report.benchmarkKind)}`);
  }
  if (report.schemaVersion !== CSD_SCHEMA_VERSION) {
    throw new Error(`${label}: unexpected schemaVersion ${JSON.stringify(report.schemaVersion)}`);
  }
  if (typeof report.csdSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(report.csdSha256)) {
    throw new Error(`${label}: missing or malformed csdSha256`);
  }
  const metadata = report.metadata;
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`${label}: missing report metadata`);
  }
  for (const field of MATCHED_METADATA_FIELDS) {
    if (metadata[field] === undefined) {
      throw new Error(`${label}: report metadata is missing ${field}`);
    }
  }
  for (const field of [
    'buildType',
    'compiler',
    'targetArch',
    'operatingSystem',
    'engineSourceRevision',
    'csoundLibraryPath',
    'threading',
  ]) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) {
      throw new Error(`${label}: empty or invalid ${field}`);
    }
  }
  if (
    !/^[0-9a-f]{64}$/.test(metadata.csoundLibrarySha256) ||
    metadata.sampleBytes !== 8 ||
    metadata.buildType !== 'Release' ||
    !(metadata.csoundVersion >= 7000) ||
    JSON.stringify(metadata.csoundOptions) !== JSON.stringify(['-n', '-d', '-m0'])
  ) {
    throw new Error(`${label}: invalid runtime/library/precision/options/Release identity`);
  }
  if (
    typeof metadata.sampleRate !== 'number' ||
    !Number.isFinite(metadata.sampleRate) ||
    metadata.sampleRate <= 0 ||
    !Number.isFinite(metadata.zeroDbFs) ||
    metadata.zeroDbFs <= 0 ||
    !Number.isInteger(metadata.ksmps) ||
    metadata.ksmps <= 0 ||
    !Number.isInteger(metadata.nchnls) ||
    metadata.nchnls <= 0
  ) {
    throw new Error(`${label}: report metadata has invalid sr/ksmps/nchnls values`);
  }
  if (!Number.isInteger(metadata.measuredCycles) || metadata.measuredCycles <= 0) {
    throw new Error(`${label}: report metadata has an invalid measuredCycles`);
  }
  if (!Array.isArray(report.trials) || report.trials.length === 0) {
    throw new Error(`${label}: native report has no trials`);
  }
  report.trials.forEach((trial, index) => {
    if (!trial || typeof trial !== 'object') {
      throw new Error(`${label}: trial ${index} is not an object`);
    }
    if (typeof trial.performKsmpsAvgUs !== 'number') {
      throw new Error(`${label}: trial ${index} is missing a numeric performKsmpsAvgUs`);
    }
    if (!Number.isInteger(trial.measuredCycles)) {
      throw new Error(`${label}: trial ${index} is missing an integer measuredCycles`);
    }
  });
  return report;
}

function consistentMetadata(reports, label) {
  const reference = reports[0].metadata;
  for (const report of reports.slice(1)) {
    for (const field of MATCHED_METADATA_FIELDS) {
      if (String(report.metadata[field]) !== String(reference[field])) {
        throw new Error(
          `${label} native reports disagree on ${field} ` +
            `(${reference[field]} vs ${report.metadata[field]})`,
        );
      }
    }
  }
  return reference;
}

function trialSpread(trials) {
  const values = trials.map((trial) => trial.performKsmpsAvgUs);
  const median = medianOf(values);
  return {
    minUs: Math.min(...values),
    maxUs: Math.max(...values),
    medianAbsoluteDeviationUs: medianOf(values.map((value) => Math.abs(value - median))),
  };
}

// Merge the paired native reports into the wrapper-level comparison report.
// Throws on structural malformation or metadata mismatch (the caller exits 2);
// non-finite/zero/incomplete-window metrics set gatePassed=false (exit 1).
export function buildCsdComparisonReport({
  seed,
  order,
  candidate,
  baseline,
  numCycles = CSD_MINIMUM_CYCLES,
  warmupCycles = 1024,
  research = false,
  acceptance = 'primary',
}) {
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('paired trial order must be a non-empty array');
  }
  if (!Array.isArray(candidate.reports) || candidate.reports.length !== order.length) {
    throw new Error(
      `candidate native report count ${candidate.reports?.length ?? 0} does not match paired trial count ${order.length}`,
    );
  }
  if (!Array.isArray(baseline.reports) || baseline.reports.length !== order.length) {
    throw new Error(
      `baseline native report count ${baseline.reports?.length ?? 0} does not match paired trial count ${order.length}`,
    );
  }

  const candidateReports = candidate.reports.map((report) =>
    validateCsdNativeReport(report, 'candidate'),
  );
  const baselineReports = baseline.reports.map((report) =>
    validateCsdNativeReport(report, 'baseline'),
  );
  for (const [side, reports] of [
    [candidate, candidateReports],
    [baseline, baselineReports],
  ]) {
    for (const report of reports) {
      if (report.csdSha256 !== side.csdSha256)
        throw new Error('native report CSD hash differs from supplied file');
    }
  }
  if (!research) {
    if (!candidate.identity || !baseline.identity)
      throw new Error('acceptance requires both capture identities');
    for (const field of [
      'identity',
      'id',
      'profile',
      'sampleRate',
      'ksmps',
      'channels',
      'durationSeconds',
      'exporterHash',
      'bindingsSha256',
    ]) {
      if (
        candidate.identity[field] === undefined ||
        candidate.identity[field] !== baseline.identity[field]
      ) {
        throw new Error(`capture identity mismatch for ${field}`);
      }
    }
    for (const side of [candidate, baseline]) {
      for (const [field, nativeField] of [
        ['sampleRate', 'sampleRate'],
        ['ksmps', 'ksmps'],
        ['channels', 'nchnls'],
      ]) {
        if (side.identity[field] !== side.reports[0].metadata[nativeField])
          throw new Error(`capture/native metadata mismatch for ${nativeField}`);
      }
      if (side.identity.csdSha256 !== side.csdSha256)
        throw new Error('capture CSD hash differs from supplied file');
    }
  }
  const candidateMetadata = consistentMetadata(candidateReports, 'candidate');
  const baselineMetadata = consistentMetadata(baselineReports, 'baseline');

  for (const field of MATCHED_METADATA_FIELDS) {
    if (String(candidateMetadata[field]) !== String(baselineMetadata[field])) {
      throw new Error(
        `baseline CSD metadata mismatch for ${field} ` +
          `(candidate ${candidateMetadata[field]}, baseline ${baselineMetadata[field]})`,
      );
    }
  }

  const candidateTrials = candidateReports.flatMap((report) => report.trials);
  const baselineTrials = baselineReports.flatMap((report) => report.trials);
  const requestedMeasuredCycles = numCycles;
  const metricsValid = (trials) =>
    trials.every(
      (trial) =>
        Number.isFinite(trial.performKsmpsAvgUs) &&
        trial.performKsmpsAvgUs > 0 &&
        trial.measuredCycles === requestedMeasuredCycles,
    );

  const candidateMedian = medianOf(candidateTrials.map((trial) => trial.performKsmpsAvgUs));
  const baselineMedian = medianOf(baselineTrials.map((trial) => trial.performKsmpsAvgUs));
  const medianDeltaPct =
    baselineMedian > 0 ? ((candidateMedian - baselineMedian) / baselineMedian) * 100 : Number.NaN;

  const validMetrics =
    order.length >= CSD_MINIMUM_TRIALS &&
    candidateReports.every((report) => report.trials.length === 1) &&
    baselineReports.every((report) => report.trials.length === 1) &&
    candidateMetadata.warmupCycles === warmupCycles &&
    candidateMetadata.measuredCycles === numCycles &&
    metricsValid(candidateTrials) &&
    metricsValid(baselineTrials) &&
    Number.isFinite(candidateMedian) &&
    candidateMedian > 0 &&
    Number.isFinite(medianDeltaPct);

  const acceptanceWindowMet = !research && numCycles >= CSD_MINIMUM_CYCLES && warmupCycles >= 1024;
  const primaryImprovementMet = Number.isFinite(medianDeltaPct) && medianDeltaPct <= -10;
  const representativeRegressionMet = Number.isFinite(medianDeltaPct) && medianDeltaPct <= 5;
  const gatePassed =
    validMetrics &&
    acceptanceWindowMet &&
    (acceptance === 'primary' ? primaryImprovementMet : representativeRegressionMet);
  return {
    benchmarkKind: CSD_BENCHMARK_KIND,
    research,
    acceptance,
    acceptanceWindowMet,
    metricsValid: validMetrics,
    primaryImprovementMet,
    representativeRegressionMet,
    schemaVersion: CSD_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    fixtureId: candidate.identity?.identity ?? null,
    fixtureIdDerivation:
      'complete original input hash in exporter manifest; research may omit capture identity',
    metric: {
      name: 'performKsmpsAvgUs',
      clock: 'steady_clock',
      units: 'microseconds per ksmps block',
      summary: 'median across paired trials; elapsed time, not CPU time',
    },
    seed,
    order: order.map((pair) => [...pair]),
    candidate: {
      identity: candidate.identity ?? null,
      csdPath: candidate.csdPath,
      csdSha256: candidate.csdSha256,
      metadata: candidateMetadata,
      trials: candidateTrials,
      medianPerformKsmpsAvgUs: candidateMedian,
      spread: trialSpread(candidateTrials),
    },
    baseline: {
      identity: baseline.identity ?? null,
      csdPath: baseline.csdPath,
      csdSha256: baseline.csdSha256,
      metadata: baselineMetadata,
      trials: baselineTrials,
      medianPerformKsmpsAvgUs: baselineMedian,
      spread: trialSpread(baselineTrials),
    },
    pairedTrials: order.map((pair, index) => ({
      trial: index + 1,
      order: [...pair],
      candidate: {
        performKsmpsAvgUs: candidateTrials[index].performKsmpsAvgUs,
        measuredCycles: candidateTrials[index].measuredCycles,
      },
      baseline: {
        performKsmpsAvgUs: baselineTrials[index].performKsmpsAvgUs,
        measuredCycles: baselineTrials[index].measuredCycles,
      },
    })),
    medianDeltaPct,
    candidateFasterPct10: Number.isFinite(medianDeltaPct) && medianDeltaPct <= -10,
    gatePassed,
  };
}

// ============================================================================
// Script body
// ============================================================================

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')} (exit code ${result.status})`);
  }
  return result;
}

function buildBenchmarkExecutable() {
  const target = resolveTarget();
  const buildType = 'Release';
  const buildDir = join(packageRoot, `build-${target.key}-${buildType.toLowerCase()}`);

  // 1. Configure and build benchmark_engine in Release mode
  process.stdout.write(`Configuring and building benchmark_engine in ${buildType} mode...\n`);
  run(process.execPath, ['scripts/build.mjs', '--build-type', buildType, '--no-stage']);
  run('cmake', [
    '--build',
    buildDir,
    '--target',
    'benchmark_engine',
    '--config',
    buildType,
    '--parallel',
  ]);

  return join(
    buildDir,
    target.platform === 'win32' ? buildType : '',
    target.platform === 'win32' ? 'benchmark_engine.exe' : 'benchmark_engine',
  );
}

async function runFixedScenarioBenchmark({ baselinePath, outputPath, numTrials, numCycles }) {
  const benchmarkExecutable = buildBenchmarkExecutable();

  // 2. Execute benchmark_engine --json. The native CLI owns the actual engine
  // path, warmup window, metadata, and optional baseline comparison contract.
  process.stdout.write(
    `Executing benchmark harness (${numTrials} trials, ${numCycles} cycles)...\n`,
  );
  const result = run(
    benchmarkExecutable,
    [
      '--json',
      '--trials',
      String(numTrials),
      '--warmup-cycles',
      '1024',
      '--measure-cycles',
      String(numCycles),
      '--scenario',
      'all',
      ...(baselinePath ? ['--compare', baselinePath] : []),
      ...(outputPath ? ['--output', outputPath] : []),
    ],
    { capture: true },
  );

  const rawOutput = result.stdout.toString('utf-8');
  const benchmarkData = JSON.parse(rawOutput);
  benchmarkData.timestamp = new Date().toISOString();

  // 3. Compare with baseline if provided. Keep this wrapper's artifact shape
  // stable for callers, but compute every gate from the retained trial data.
  let gatePassed = true;
  // Keep the historical field name for consumers of the benchmark artifact, but
  // its contract is now the common-path regression budget from SPEC 073.
  let primaryImprovementMet = !baselinePath;
  let unaffectedRegressionMet = true;
  let spikeCountDischarged = true;

  if (baselinePath) {
    try {
      const baselineRaw = await readFile(baselinePath, 'utf-8');
      const baselineData = JSON.parse(baselineRaw);

      const baselineScenarios = new Map(baselineData.scenarios.map((s) => [s.name, s]));

      let foundCommonPath = false;
      for (const scenario of benchmarkData.scenarios) {
        const baseScenario = baselineScenarios.get(scenario.name);
        if (!baseScenario) {
          // The exact-decimal scenarios were added by SPEC 073 and may be
          // absent from an older SPEC 072 baseline. They are reported when
          // present, but are not silently treated as the common-path gate.
          if (scenario.name.startsWith('quantized_exact')) {
            scenario.comparisonToBaseline = { baselineMissing: true };
            continue;
          }
          throw new Error(`Baseline is missing scenario ${scenario.name}`);
        }

        const curMed = scenario.medianSummary;
        const baseMed = baseScenario.medianSummary;

        const hostCycleAvgDeltaPct =
          baseMed.hostCycleAvgUs > 0
            ? ((curMed.hostCycleAvgUs - baseMed.hostCycleAvgUs) / baseMed.hostCycleAvgUs) * 100
            : 0;

        const hostCycleP95DeltaPct =
          baseMed.hostCycleP95Us > 0
            ? ((curMed.hostCycleP95Us - baseMed.hostCycleP95Us) / baseMed.hostCycleP95Us) * 100
            : 0;

        const autoAvgDeltaPct =
          baseMed.autoAvgUs > 0
            ? ((curMed.autoAvgUs - baseMed.autoAvgUs) / baseMed.autoAvgUs) * 100
            : 0;

        const shmAvgDeltaPct =
          baseMed.shmAvgUs > 0
            ? ((curMed.shmAvgUs - baseMed.shmAvgUs) / baseMed.shmAvgUs) * 100
            : 0;

        scenario.comparisonToBaseline = {
          hostCycleAvgDeltaPct,
          hostCycleP95DeltaPct,
          autoAvgDeltaPct,
          shmAvgDeltaPct,
        };

        if (scenario.name === 'linear_32') {
          foundCommonPath = true;
          if (hostCycleAvgDeltaPct > 5.0) {
            primaryImprovementMet = false;
          }
        } else if (!scenario.name.startsWith('quantized_exact') && hostCycleP95DeltaPct > 5.0) {
          // Regression on p95 must be <= 5% for unaffected scenarios.
          unaffectedRegressionMet = false;
        }
        if (curMed.hostCycleSpikeCount > baseMed.hostCycleSpikeCount) {
          spikeCountDischarged = false;
        }
      }
      primaryImprovementMet = foundCommonPath && primaryImprovementMet;
    } catch (err) {
      process.stderr.write(`Failed to compare baseline ${baselinePath}: ${err.message}\n`);
      process.exit(2);
    }
  }

  gatePassed = primaryImprovementMet && unaffectedRegressionMet && spikeCountDischarged;
  benchmarkData.gateStatus = {
    baselineCompared: Boolean(baselinePath),
    passed: gatePassed,
    primaryImprovementMet,
    unaffectedRegressionMet,
    spikeCountDischarged,
  };

  // 4. Save and output
  const outputJson = JSON.stringify(benchmarkData, null, 2);
  if (outputPath) {
    await writeFile(outputPath, outputJson, 'utf-8');
    process.stdout.write(`Benchmark results written to ${outputPath}\n`);
  }

  process.stdout.write(outputJson + '\n');

  if (!gatePassed) {
    process.stderr.write('BENCHMARK_REGRESSION_GATE_FAILED\n');
    process.exit(1);
  }
}

async function runCsdComparisonBenchmark({
  csdPath,
  baselineCsdPath,
  outputPath,
  numTrials,
  numCycles,
  research,
  acceptance,
  candidateManifestPath,
  baselineManifestPath,
}) {
  const benchmarkExecutable = buildBenchmarkExecutable();
  const seed = CSD_DEFAULT_SEED;

  const candidateSha256 = await sha256File(csdPath);
  const baselineSha256 = await sha256File(baselineCsdPath);
  async function readIdentity(file, csd, hash) {
    const raw = await readFile(file);
    return csdCaptureIdentity(
      JSON.parse(raw.toString('utf8')),
      createHash('sha256').update(raw).digest('hex'),
      csd,
      hash,
    );
  }
  const candidateIdentity = research
    ? null
    : await readIdentity(candidateManifestPath, csdPath, candidateSha256);
  const baselineIdentity = research
    ? null
    : await readIdentity(baselineManifestPath, baselineCsdPath, baselineSha256);
  const executableSha256 = await sha256File(benchmarkExecutable);
  const compileCommandsPath = join(dirname(benchmarkExecutable), 'compile_commands.json');
  const compileCommandsFallback = join(
    dirname(dirname(benchmarkExecutable)),
    'compile_commands.json',
  );
  const compileCommands = await readFile(
    existsSync(compileCommandsPath) ? compileCommandsPath : compileCommandsFallback,
    'utf8',
  );
  const benchmarkCompile = JSON.parse(compileCommands).find((entry) =>
    entry.file.endsWith('benchmark_main.cpp'),
  );
  if (!benchmarkCompile) throw new Error('benchmark compiler command unavailable');

  function measure(seed) {
    const order = pairedTrialOrder(seed, numTrials);
    // Run the same Release executable twice per trial, interleaved by the
    // recorded seed. Baseline and candidate always share one runtime build.
    process.stdout.write(
      `Executing paired CSD benchmark (${numTrials} trials, ${numCycles} measured cycles, seed ${seed})...\n`,
    );
    const reportsBySide = { candidate: [], baseline: [] };
    for (let trial = 0; trial < numTrials; trial += 1) {
      for (const side of order[trial]) {
        const csdArgument = side === 'candidate' ? csdPath : baselineCsdPath;
        const result = run(
          benchmarkExecutable,
          [
            '--json',
            '--csd',
            csdArgument,
            '--trials',
            '1',
            '--warmup-cycles',
            '1024',
            '--measure-cycles',
            String(numCycles),
            ...(research ? ['--research'] : []),
          ],
          { capture: true },
        );
        let nativeReport;
        try {
          nativeReport = JSON.parse(result.stdout.toString('utf-8'));
        } catch (error) {
          throw new Error(`${side} native benchmark produced unparseable JSON: ${error.message}`);
        }
        reportsBySide[side].push(nativeReport);
      }
    }

    return buildCsdComparisonReport({
      numCycles,
      research,
      acceptance,
      seed,
      order,
      candidate: {
        identity: candidateIdentity,
        csdPath,
        csdSha256: candidateSha256,
        reports: reportsBySide.candidate,
      },
      baseline: {
        identity: baselineIdentity,
        csdPath: baselineCsdPath,
        csdSha256: baselineSha256,
        reports: reportsBySide.baseline,
      },
    });
  }
  const report = measure(seed);
  report.environment = {
    executable: benchmarkExecutable,
    executableSha256,
    operatingSystem: process.platform,
    osRelease: release(),
    architecture: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    compilerCommand: benchmarkCompile,
  };
  if (report.metricsValid && report.medianDeltaPct > 5 && !research) {
    report.confirmation = measure(seed + 1);
    report.repeatableRegression =
      report.confirmation.metricsValid && report.confirmation.medianDeltaPct > 5;
    // An inconsistent pair of runs remains unaccepted; retain both for review.
    report.gatePassed = false;
  }

  const outputJson = JSON.stringify(report, null, 2);
  if (outputPath) {
    await writeFile(outputPath, outputJson, 'utf-8');
    process.stdout.write(`Benchmark results written to ${outputPath}\n`);
  }

  process.stdout.write(outputJson + '\n');

  if (!report.gatePassed) {
    process.stderr.write('BENCHMARK_REGRESSION_GATE_FAILED\n');
    process.exit(1);
  }
}

async function main() {
  let options;
  try {
    options = parseBenchmarkArgs(process.argv.slice(2));
  } catch (error) {
    // Only supplied-CSD combinations throw here; historical fixed-scenario
    // arguments parse exactly as before.
    process.stderr.write(`Invalid benchmark arguments: ${error.message}\n`);
    process.exit(2);
  }
  if (options.mode === 'csd') {
    try {
      await runCsdComparisonBenchmark(options);
    } catch (error) {
      process.stderr.write(`CSD benchmark failed: ${error.message}\n`);
      process.exit(2);
    }
  } else {
    await runFixedScenarioBenchmark(options);
  }
}

const invokedScript = process.argv[1];
if (invokedScript) {
  let invokedPath;
  try {
    invokedPath = realpathSync(resolve(invokedScript));
  } catch {
    invokedPath = null;
  }
  if (invokedPath && invokedPath === realpathSync(fileURLToPath(import.meta.url))) {
    await main();
  }
}
