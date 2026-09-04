#!/usr/bin/env node
/**
 * Sanitized coverage for the credential preflight.
 *
 * Runs the preflight script in child processes with sanitized fixture
 * values, then asserts that:
 *   1. Missing values produce a non-zero exit and identify the variables by NAME.
 *   2. Sanitized positive values produce a zero exit.
 *   3. Output NEVER contains any of the supplied secret values - only the
 *      variable names.
 *
 * Usage: node scripts/release-credential-preflight.test.mjs
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, 'release-credential-preflight.mjs');

/** @returns {Promise<{ code: number, stdout: string, stderr: string }>} */
function runScript(args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    /** @type {Buffer[]} */
    let stdout = [];
    /** @type {Buffer[]} */
    let stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      resolvePromise({
        code: typeof code === 'number' ? code : 1,
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
      });
    });
  });
}

/**
 * @returns {{ env: Record<string, string>, secretValues: string[] }}
 */
function sanitizedPositiveEnv() {
  // These values are intentionally fake but well-formed so the preflight
  // cannot distinguish them from real credentials. They MUST NOT appear in
  // any captured output.
  const secretValues = [
    'SECRET_CSC_LINK_PLACEHOLDER',
    'SECRET_CSC_KEY_PASSWORD_PLACEHOLDER',
    'SECRET_APPLE_ID_PLACEHOLDER@example.com',
    'SECRET_APPLE_APP_SPECIFIC_PASSWORD_PLACEHOLDER',
    'ABCD1234EF', // 10-char Apple team id shape
    '11111111-2222-3333-4444-555555555555', // UUID
    'https://fake.trusted-signing.example/',
    'fake-account',
    'fake-profile',
    'SECRET_GH_TOKEN_PLACEHOLDER',
  ];
  return {
    env: {
      ...process.env,
      CSC_LINK: 'SECRET_CSC_LINK_PLACEHOLDER',
      CSC_KEY_PASSWORD: 'SECRET_CSC_KEY_PASSWORD_PLACEHOLDER',
      APPLE_ID: 'SECRET_APPLE_ID_PLACEHOLDER@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'SECRET_APPLE_APP_SPECIFIC_PASSWORD_PLACEHOLDER',
      APPLE_TEAM_ID: 'ABCD1234EF',
      AZURE_CLIENT_ID: '11111111-2222-3333-4444-555555555555',
      AZURE_TENANT_ID: '11111111-2222-3333-4444-555555555556',
      AZURE_SUBSCRIPTION_ID: '11111111-2222-3333-4444-555555555557',
      AZURE_TRUSTED_SIGNING_ENDPOINT: 'https://fake.trusted-signing.example/',
      AZURE_TRUSTED_SIGNING_ACCOUNT: 'fake-account',
      AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE: 'fake-profile',
      GH_TOKEN: 'SECRET_GH_TOKEN_PLACEHOLDER',
    },
    secretValues,
  };
}

/**
 * @param {Record<string, string>} env
 * @returns {Record<string, string>}
 */
function sanitizedMissingEnv(env) {
  // Strip every credential variable the preflight knows about so the
  // resulting env reports MISSING for every check.
  const stripped = { ...env };
  for (const key of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
    'AZURE_CLIENT_ID',
    'AZURE_TENANT_ID',
    'AZURE_SUBSCRIPTION_ID',
    'AZURE_TRUSTED_SIGNING_ENDPOINT',
    'AZURE_TRUSTED_SIGNING_ACCOUNT',
    'AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE',
    'GH_TOKEN',
  ]) {
    delete stripped[key];
  }
  return stripped;
}

/**
 * @param {{ code: number, stdout: string, stderr: string }} result
 * @param {string[]} secretValues
 * @returns {void}
 */
function assertNoSecretValues(result, secretValues) {
  const output = `${result.stdout}\n${result.stderr}`;
  for (const value of secretValues) {
    assert(
      !output.includes(value),
      `Secret value "${value}" leaked into preflight output:\n${output}`,
    );
  }
}

async function main() {
  let failures = 0;

  // 1. Positive case: every value is well-formed.
  try {
    const { env, secretValues } = sanitizedPositiveEnv();
    const result = await runScript([], env);
    assert.equal(
      result.code,
      0,
      `Positive case should exit 0, got ${result.code}\n${result.stderr}`,
    );
    assertNoSecretValues(result, secretValues);
    assert(/Credential preflight passed/.test(result.stderr), 'Positive case should report pass');
    console.log('PASS positive case');
  } catch (error) {
    failures += 1;
    console.error('FAIL positive case:', error instanceof Error ? error.message : String(error));
  }

  // 2. Negative case: every variable missing.
  try {
    const baseEnv = sanitizedMissingEnv({ ...process.env });
    const result = await runScript([], baseEnv);
    assert.notEqual(result.code, 0, 'Negative case should exit non-zero');
    for (const variableName of [
      'CSC_LINK',
      'CSC_KEY_PASSWORD',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'APPLE_TEAM_ID',
      'AZURE_CLIENT_ID',
      'AZURE_TENANT_ID',
      'AZURE_SUBSCRIPTION_ID',
      'AZURE_TRUSTED_SIGNING_ENDPOINT',
      'AZURE_TRUSTED_SIGNING_ACCOUNT',
      'AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE',
      'GH_TOKEN',
    ]) {
      assert(
        result.stderr.includes(variableName),
        `Output should identify missing variable ${variableName} by name. Got:\n${result.stderr}`,
      );
    }
    console.log('PASS negative case (missing values named)');
  } catch (error) {
    failures += 1;
    console.error('FAIL negative case:', error instanceof Error ? error.message : String(error));
  }

  // 3. Scope subset does not check unrelated variables.
  try {
    const baseEnv = sanitizedMissingEnv({ ...process.env });
    const result = await runScript(['--scope', 'windows'], baseEnv);
    assert.notEqual(result.code, 0, 'Windows-only negative case should exit non-zero');
    assert(!result.stderr.includes('CSC_LINK'), 'Windows scope should not check macOS CSC_LINK');
    assert(result.stderr.includes('AZURE_CLIENT_ID'), 'Windows scope should check AZURE_CLIENT_ID');
    console.log('PASS scope filtering');
  } catch (error) {
    failures += 1;
    console.error('FAIL scope filtering:', error instanceof Error ? error.message : String(error));
  }

  // 4. Malformed values produce MALFORMED diagnostic and never echo the value.
  try {
    const env = sanitizedMissingEnv({ ...process.env });
    // Apple team id must be 10 chars uppercase alphanumeric. Set a malformed
    // value that is clearly a secret - verify the value never appears in
    // output, but the variable name does.
    const malformed = 'NOT_A_REAL_TEAM_ID_VALUE';
    env.APPLE_TEAM_ID = malformed;
    const result = await runScript(['--scope', 'macos'], env);
    assert.notEqual(result.code, 0, 'Malformed APPLE_TEAM_ID should fail');
    assert(result.stderr.includes('APPLE_TEAM_ID'), 'Output should name APPLE_TEAM_ID');
    assert(
      !result.stderr.includes(malformed),
      `Malformed value leaked into output: ${result.stderr}`,
    );
    assert(/MALFORMED/.test(result.stderr), 'Output should mention MALFORMED code');
    console.log('PASS malformed diagnostic does not echo secret value');
  } catch (error) {
    failures += 1;
    console.error(
      'FAIL malformed diagnostic:',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} preflight test case(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll credential-preflight test cases passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error(
    'Preflight test harness crashed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
