import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { join, resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const scriptPath = join(repoRoot, 'packages', 'blue-app', 'scripts', 'verify-release-version.mjs');

async function runValidator(tag, appVersion = tag.slice(1)) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        scriptPath,
        '--tag',
        tag,
        '--app-version',
        appVersion,
        '--repository',
        'owner/repo',
        '--allow-no-gh-token',
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          GH_TOKEN: '',
          GITHUB_TOKEN: '',
        },
      },
    );
    return { status: 0, stderr: result.stderr };
  } catch (error) {
    return {
      status: error.code,
      stderr: String(error.stderr ?? ''),
    };
  }
}

test('accepts beta and release-candidate tags with SemVer prerelease identifiers', async () => {
  for (const version of ['3.0.0-beta.1', '3.0.0-beta.10', '3.0.0-rc.1']) {
    const result = await runValidator('v' + version);
    assert.equal(result.status, 0, version + ' should pass:\n' + result.stderr);
    assert.match(result.stderr, /prerelease/);
  }
});

test('rejects invalid prerelease identifiers and build metadata in release tags', async (t) => {
  for (const tag of ['v3.0.0-beta.01', 'v3.0.0-beta_1', 'v3.0.0-beta+build']) {
    await t.test(tag, async () => {
      const result = await runValidator(tag);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /required SemVer release shape/);
    });
  }
});

test('requires the package version to include the same prerelease suffix', async () => {
  const result = await runValidator('v3.0.0', '3.0.0-beta.1');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not match packages\/blue-app\/package\.json version/);
});
