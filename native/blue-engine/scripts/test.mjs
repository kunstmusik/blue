import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { packageRoot } from './artifact.mjs';
import { resolveTarget } from './target.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: packageRoot, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const mode = process.argv[2] ?? 'unit';
const target = resolveTarget();
const tracking = mode === 'profiling';
const buildType = 'Debug';
const buildDir = join(packageRoot, `build-${target.key}-debug${tracking ? '-profiling' : ''}`);
const buildArgs = ['scripts/build.mjs', '--build-type', buildType, '--no-stage'];
if (tracking) {
  buildArgs.push('--performance-tracking');
}
run(process.execPath, buildArgs);
run('cmake', ['--build', buildDir, '--config', buildType, '--parallel']);

const ctestArgs = ['--test-dir', buildDir, '--output-on-failure', '-C', buildType];
if (mode === 'integration') {
  ctestArgs.push('-L', 'requires-csound');
} else {
  ctestArgs.push('-LE', 'requires-csound');
}
run('ctest', ctestArgs);

if (mode === 'profiling') {
  const defaultExecutable = join(packageRoot, `build-${target.key}-debug`, target.platform === 'win32' ? buildType : '', target.executableName);
  run(process.execPath, ['scripts/build.mjs', '--build-type', buildType, '--no-stage']);
  const bytes = await readFile(defaultExecutable);
  const text = bytes.toString('latin1');
  if (text.includes('[Counters') || text.includes('p95_window_samples')) {
    throw new Error('BLUE_ENGINE_PROFILING_NOT_COMPILED_OUT');
  }
}
