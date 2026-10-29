import {
  evaluateMeterComparisons,
  meterPolicy,
} from '../packages/blue-app/scripts/meter-performance-verdict.mjs';
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const suites = {
  node: { directory: 'blue-app', config: 'vitest.performance.config.ts', cases: 8 },
  browser: { directory: 'blue-app', config: 'vitest.performance.browser.config.ts', cases: 4 },
  engine: { directory: 'blue-app', config: 'vitest.performance.engine.config.ts', cases: 5 },
  data: { directory: 'blue-data', config: 'vitest.performance.config.ts', cases: 4 },
};

export function readPerformanceResult(report, output, suite) {
  const tests = report.testResults
    .flatMap((file) => file.assertionResults)
    .filter(
      (test) =>
        test.tags.includes('performance') &&
        (suite === 'engine'
          ? test.tags.includes('real-engine')
          : !test.tags.includes('real-engine')),
    )
    .map((test) => ({ name: test.fullName, status: test.status, durationMs: test.duration }));
  if (!tests.length) throw new Error('No performance cases were selected');
  if (tests.some((test) => !['passed', 'failed'].includes(test.status))) {
    throw new Error(
      'Selected performance cases were skipped; check runtime prerequisites and selection',
    );
  }
  const metrics = [...output.matchAll(/BLUE_PERFORMANCE (\{[^\n]*\})/g)].map((match) =>
    JSON.parse(match[1]),
  );
  if (!metrics.length) throw new Error('No performance measurements were recorded');
  if (suite === 'data' && tests.every((test) => test.status === 'passed') && metrics.length !== 7) {
    throw new Error(`Expected seven data measurements; recorded ${metrics.length}`);
  }
  const comparisons = [...output.matchAll(/BLUE_PERFORMANCE_COMPARISON (\{[^\n]*\})/g)].map(
    (match) => JSON.parse(match[1]),
  );
  return { tests, metrics, comparisons };
}

async function run() {
  const suite = process.argv[2];
  if (!Object.hasOwn(suites, suite)) throw new Error('Choose node, browser, engine, or data');
  const selected = suites[suite];
  const packageRoot = path.join(repositoryRoot, 'packages', selected.directory);
  const rounds = Number(process.env.BLUE_PERFORMANCE_ROUNDS ?? 3);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10)
    throw new Error('BLUE_PERFORMANCE_ROUNDS must be an integer from 1 to 10');
  const directory = path.join(packageRoot, 'performance-results', suite);
  mkdirSync(directory, { recursive: true });
  const environment = {
    package: JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).name,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: packageRoot,
      encoding: 'utf8',
    }).trim(),
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    cpu: os.cpus()[0]?.model,
    node: process.version,
    vitest: JSON.parse(readFileSync(path.join(packageRoot, 'node_modules/vitest/package.json')))
      .version,
    rounds,
    workingTreeDirty: Boolean(
      execFileSync('git', ['status', '--porcelain'], { cwd: packageRoot, encoding: 'utf8' }).trim(),
    ),
  };
  const summary = { suite, environment, rounds: [] };
  // Persist setup information even if browser launch or test collection fails.
  const summaryPath = path.join(directory, 'measurements.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  try {
    if (suite === 'engine') {
      const enginePath =
        process.env.BLUE_ENGINE_PATH ??
        path.join(
          packageRoot,
          '../../native/blue-engine/dist',
          `${process.platform}-${process.arch}`,
          process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine',
        );
      const probe = execFileSync(enginePath, ['--probe-csound', '--json'], {
        encoding: 'utf8',
        timeout: 10000,
      });
      environment.engine = JSON.parse(probe);
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      if (!environment.engine.ready)
        throw new Error('Performance setup failure: Blue Engine cannot load Csound 7');
    }
    if (suite === 'browser') {
      const { chromium } = createRequire(path.join(packageRoot, 'package.json'))('playwright');
      const browser = await chromium.launch({ headless: true });
      environment.browser = browser.version();
      await browser.close();
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }
  } catch (error) {
    summary.verdict = { status: 'error', reason: error.message };
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    throw error;
  }
  let failed = false;
  for (let round = 1; round <= rounds; round += 1) {
    const resultPath = path.join(directory, `round-${round}.json`);
    rmSync(resultPath, { force: true });
    const result = spawnSync(
      process.execPath,
      [
        path.join(packageRoot, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--config',
        selected.config,
        '--reporter=default',
        '--reporter=json',
        `--outputFile=${resultPath}`,
      ],
      { cwd: packageRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    writeFileSync(path.join(directory, `round-${round}.log`), output);
    const entry = { round, exitCode: result.status, error: result.error?.message };
    try {
      const parsed = readPerformanceResult(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        output,
        suite,
      );
      Object.assign(entry, parsed);
      const expectedCases = selected.cases;
      if (parsed.tests.length !== expectedCases)
        throw new Error(
          `Expected ${expectedCases} ${suite} performance cases; selected ${parsed.tests.length}`,
        );
      if (suite === 'browser' && parsed.comparisons.length !== meterPolicy.pairsPerRound) {
        throw new Error('Incomplete meter comparison collection');
      }
      if (parsed.tests.some((test) => test.status === 'failed')) failed = true;
    } catch (error) {
      entry.error = error.message;
      failed = true;
    }
    if (result.status !== 0) failed = true;
    summary.rounds.push(entry);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(
      `${suite} performance round ${round}/${rounds}: ${entry.error ?? `${entry.tests?.length ?? 0} cases; exit ${result.status}`}`,
    );
  }
  if (suite === 'browser') {
    try {
      summary.meterComparison = evaluateMeterComparisons(summary.rounds);
    } catch (error) {
      failed = true;
      summary.comparisonError = error.message;
    }
  }
  summary.verdict = failed
    ? {
        status: 'error',
        reason: 'A test, setup, or collection check failed; inspect round reports',
      }
    : (summary.meterComparison ?? { status: 'passed' });
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`${suite} performance verdict: ${summary.verdict.status.toUpperCase()}`);
  if (summary.verdict.status === 'inconclusive') {
    console.log(
      `::warning title=Performance measurement inconclusive::${summary.verdict.reasons.join('; ')}. Collection succeeded; performance acceptance was not established.`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const comparison = summary.meterComparison;
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### ${suite} performance (${environment.platform}/${environment.architecture})\n\n` +
        `**Verdict: ${summary.verdict.status.toUpperCase()}**\n\n` +
        (summary.verdict.reason ? `${summary.verdict.reason}\n\n` : '') +
        (comparison
          ? `Meter comparison: ${comparison.pairs.length} fixed pairs; median FPS ratio ${comparison.aggregate.fpsRatio.toFixed(3)}; median interaction ratio ${comparison.aggregate.interactionRatio.toFixed(3)}.\n\n` +
            comparison.reasons.map((reason) => `- ${reason}`).join('\n') +
            '\n\n'
          : '') +
        summary.rounds
          .map(
            (round) =>
              `- Round ${round.round}: ${round.error ?? `${round.tests?.filter((test) => test.status === 'passed').length} test cases passed, ${round.tests?.filter((test) => test.status === 'failed').length} failed`}`,
          )
          .join('\n') +
        '\n\nA successful collection job with an INCONCLUSIVE verdict is not a performance acceptance pass. Raw samples, environment, logs, and test reports are attached.\n',
    );
  }

  if (['error', 'failed'].includes(summary.verdict.status)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
