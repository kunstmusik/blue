// Original developer-only SC-002 runner. Run from the repository root, alone:
// pnpm exec node <this-file> BASELINE_CAPTURE CANDIDATE_CAPTURE NEW_OUTPUT_DIR
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [baselineDirectory, candidateDirectory, outputDirectory] = process.argv.slice(2).map((value) => path.resolve(value));
if (!baselineDirectory || !candidateDirectory || !outputDirectory)
  throw new Error('Specify baseline capture, candidate capture, and a fresh output directory');
fs.mkdirSync(outputDirectory); // Refuse to overwrite an earlier run.
const baselineManifest = path.join(baselineDirectory, 'baseline-manifest.json');
const candidateManifest = path.join(candidateDirectory, 'baseline-manifest.json');
const candidate = JSON.parse(fs.readFileSync(candidateManifest, 'utf8'));
const ids = new Set([
  'small-single', 'small-sixteen', 'primary-send-heavy', 'fan-in-32-weighted',
  'barrier-rich', 'panning-matrix', 'metering', 'disabled-mixer', 'representative',
  'routing-direct-chain-1', 'routing-direct-chain-2', 'routing-direct-chain-4',
]);
const fixtures = candidate.fixtures.filter(
  (fixture) => fixture.profile === 'realtime' && fixture.durationSeconds > 10 && ids.has(fixture.id),
);
if (fixtures.length !== ids.size * 6) throw new Error('Incomplete rate/block/workload matrix');
const outcomes = [];
for (const [index, fixture] of fixtures.entries()) {
  const name = `${fixture.id}-${fixture.sampleRate}-${fixture.ksmps}`;
  console.log(`${index + 1}/${fixtures.length} ${name}`);
  const output = path.join(outputDirectory, `${name}.json`);
  const result = spawnSync(process.execPath, [
    path.resolve('native/blue-engine/scripts/benchmark.mjs'),
    '--csd', path.join(candidateDirectory, fixture.csdFile),
    '--baseline-csd', path.join(baselineDirectory, fixture.csdFile),
    '--candidate-manifest', candidateManifest, '--baseline-manifest', baselineManifest,
    '--acceptance', 'representative', '--trials', '7', '--cycles', '65536', '--output', output,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(outputDirectory, `${name}.log`), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const bytes = fs.existsSync(output) ? fs.readFileSync(output) : null;
  const report = bytes ? JSON.parse(bytes) : null;
  outcomes.push({
    name, exitCode: result.status, error: result.error?.message, output,
    sha256: bytes ? createHash('sha256').update(bytes).digest('hex') : null,
    medianDeltaPct: report?.medianDeltaPct, metricsValid: report?.metricsValid,
    gatePassed: report?.gatePassed, representativeRegressionMet: report?.representativeRegressionMet,
    confirmationDeltaPct: report?.confirmation?.medianDeltaPct,
    repeatableRegression: report?.repeatableRegression,
  });
  fs.writeFileSync(path.join(outputDirectory, 'matrix-index.json'), JSON.stringify({
    purpose: 'SC-002 representative regression gate; scoped SC-001 owner acceptance is unchanged',
    baselineManifest, candidateManifest, expectedCases: fixtures.length,
    completedCases: outcomes.length,
    accepted: outcomes.length === fixtures.length && outcomes.every((entry) => entry.exitCode === 0 && entry.gatePassed),
    outcomes,
  }, null, 2));
  console.log(`  delta=${report?.medianDeltaPct}% metrics=${report?.metricsValid} gate=${report?.gatePassed}`);
}
process.exitCode = outcomes.every((entry) => entry.exitCode === 0 && entry.gatePassed) ? 0 : 1;
