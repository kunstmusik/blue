#!/usr/bin/env node
/**
 * Top-level repository verifier.
 *
 * Runs the contributor/maintainer checks that should pass before pushing a
 * change or cutting a release. Each sub-check is a standalone script; this
 * orchestrator sequences them, reports a per-check summary, and exits non-zero
 * if any required check fails.
 *
 * Checks:
 *   1. package-inputs      - build artifacts and runtime contracts present
 *   2. release-workflows   - .github/workflows/*.yml structural contract
 *   3. release-artifacts   - stable ZIP manifest integrity and completeness
 *   4. release-credentials - sanitized test suite for the credential preflight
 *   5. credential-preflight --advisory
 *                          - reports local future signing credential availability
 *                            without gating contributor verification
 *
 * Usage: node scripts/verify.mjs
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = __dirname;

/** @typedef {{ name: string, script: string, args?: string[], required: boolean }} Check */

const repositoryRoot = resolve(scriptsDir, '..');

function collectTypeScriptFiles(rootDir, files = []) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const path = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'migration' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectTypeScriptFiles(path, files);
      continue;
    }
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) continue;
    files.push(path);
  }
  return files;
}

function verifyTrackRuntimeCleanup() {
  const productionRoots = [
    join(repositoryRoot, 'packages', 'blue-data', 'src'),
    join(repositoryRoot, 'packages', 'blue-app', 'src'),
  ];
  const forbidden = [
    /\bAudioLayerGroup\b/,
    /\bAudioLayer\b/,
    /from\s+['"][^'"]*audio-layer(?:-group)?['"]/,
  ];
  const violations = [];

  for (const root of productionRoots) {
    for (const path of collectTypeScriptFiles(root)) {
      const source = readFileSync(path, 'utf8');
      if (forbidden.some((pattern) => pattern.test(source))) violations.push(path);
    }
  }

  if (violations.length > 0) {
    process.stderr.write('Track runtime cleanup failed; legacy AudioLayer model references remain in production files:\n');
    for (const path of violations) process.stderr.write(`  ${path}\n`);
    return false;
  }
  return true;
}

/** @type {Check[]} */
const checks = [
  { name: 'package-inputs', script: 'verify-package-inputs.mjs', required: true },
  { name: 'release-workflows', script: 'validate-release-workflows.mjs', required: true },
  { name: 'release-artifacts', script: 'release-artifact-manifest.test.mjs', required: true },
  { name: 'release-credentials-tests', script: 'release-credential-preflight.test.mjs', required: true },
  {
    name: 'credential-preflight (advisory)',
    script: 'release-credential-preflight.mjs',
    args: ['--advisory'],
    // Advisory mode always exits 0; it is informational for local checks and
    // future signed-release readiness.
    required: false,
  },
];

/** @type {Array<{ name: string, ok: boolean, required: boolean, code: number }>} */
const results = [];

const trackRuntimeOk = verifyTrackRuntimeCleanup();
results.push({
  name: 'track-runtime-cleanup',
  ok: trackRuntimeOk,
  required: true,
  code: trackRuntimeOk ? 0 : 1,
});

for (const check of checks) {
  process.stderr.write(`\n-- ${check.name} --\n`);
  const result = spawnSync(process.execPath, [join(scriptsDir, check.script), ...(check.args ?? [])], {
    stdio: 'inherit',
  });
  const code = typeof result.status === 'number' ? result.status : 1;
  const ok = code === 0;
  results.push({ name: check.name, ok, required: check.required, code });
}

process.stderr.write('\n-- summary --\n');
for (const r of results) {
  const tag = r.ok ? '[ok]' : r.required ? '[FAIL]' : '[warn]';
  const qualifier = r.required ? '' : ' (advisory)';
  process.stderr.write(`${tag} ${r.name}${qualifier}\n`);
}

const failed = results.filter((r) => r.required && !r.ok);
if (failed.length > 0) {
  process.stderr.write(`\n${failed.length} required check(s) failed.\n`);
  process.exit(1);
}
process.stderr.write('\nAll required checks passed.\n');
process.exit(0);
