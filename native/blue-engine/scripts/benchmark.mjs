import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { packageRoot } from './artifact.mjs';
import { resolveTarget } from './target.mjs';

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

const target = resolveTarget();
const buildType = 'Release';
const buildDir = join(packageRoot, `build-${target.key}-${buildType.toLowerCase()}`);

// Parse CLI options
let baselinePath = null;
let outputPath = null;
let numTrials = 5;
let numCycles = 4096;

for (let i = 2; i < process.argv.length; ++i) {
  const arg = process.argv[i];
  if (arg === '--baseline' && i + 1 < process.argv.length) {
    baselinePath = process.argv[++i];
  } else if (arg === '--output' && i + 1 < process.argv.length) {
    outputPath = process.argv[++i];
  } else if (arg === '--trials' && i + 1 < process.argv.length) {
    numTrials = Number.parseInt(process.argv[++i], 10);
  } else if (arg === '--cycles' && i + 1 < process.argv.length) {
    numCycles = Number.parseInt(process.argv[++i], 10);
  }
}

// 1. Configure and build benchmark_engine in Release mode
process.stdout.write(`Configuring and building benchmark_engine in ${buildType} mode...\n`);
run(process.execPath, ['scripts/build.mjs', '--build-type', buildType, '--no-stage']);
run('cmake', ['--build', buildDir, '--target', 'benchmark_engine', '--config', buildType, '--parallel']);

const benchmarkExecutable = join(
  buildDir,
  target.platform === 'win32' ? buildType : '',
  target.platform === 'win32' ? 'benchmark_engine.exe' : 'benchmark_engine'
);

// 2. Execute benchmark_engine --json. The native CLI owns the actual engine
// path, warmup window, metadata, and optional baseline comparison contract.
process.stdout.write(`Executing benchmark harness (${numTrials} trials, ${numCycles} cycles)...\n`);
const result = run(benchmarkExecutable, [
  '--json',
  '--trials', String(numTrials),
  '--warmup-cycles', '1024',
  '--measure-cycles', String(numCycles),
  '--scenario', 'all',
  ...(baselinePath ? ['--compare', baselinePath] : []),
  ...(outputPath ? ['--output', outputPath] : []),
], { capture: true });

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

    const baselineScenarios = new Map(baselineData.scenarios.map(s => [s.name, s]));

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

      const hostCycleAvgDeltaPct = baseMed.hostCycleAvgUs > 0
        ? ((curMed.hostCycleAvgUs - baseMed.hostCycleAvgUs) / baseMed.hostCycleAvgUs) * 100
        : 0;

      const hostCycleP95DeltaPct = baseMed.hostCycleP95Us > 0
        ? ((curMed.hostCycleP95Us - baseMed.hostCycleP95Us) / baseMed.hostCycleP95Us) * 100
        : 0;

      const autoAvgDeltaPct = baseMed.autoAvgUs > 0
        ? ((curMed.autoAvgUs - baseMed.autoAvgUs) / baseMed.autoAvgUs) * 100
        : 0;

      const shmAvgDeltaPct = baseMed.shmAvgUs > 0
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
      } else if (!scenario.name.startsWith('quantized_exact') &&
                 hostCycleP95DeltaPct > 5.0) {
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
