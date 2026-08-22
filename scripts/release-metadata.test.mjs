import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '..');
const scriptPath = join(repoRoot, 'scripts', 'release-metadata.mjs');

async function generateMetadata(extraArgs, env = {}) {
  const outputDir = await mkdtemp(join(tmpdir(), 'blue-release-metadata-'));
  const outputPath = join(outputDir, 'release-metadata.json');
  try {
    await execFileAsync(process.execPath, [
      scriptPath,
      '--out',
      outputPath,
      '--app-version',
      '2.3.4',
      '--source-revision',
      'a'.repeat(40),
      '--prerelease-timestamp',
      '1777896000',
      ...extraArgs,
    ], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    return JSON.parse(await readFile(outputPath, 'utf8'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

test('defaults to the development channel', async () => {
  const metadata = await generateMetadata([], { BLUE_RELEASE_CHANNEL: '' });

  assert.equal(metadata.channel, 'development');
  assert.equal(metadata.appVersion, '2.3.4');
  assert.equal(metadata.sourceRevision, 'a'.repeat(40));
  assert.equal(metadata.releaseVersion, '2.3.4-dev.20260504-1200.aaaaaaa');
  assert.match(metadata.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('uses BLUE_RELEASE_CHANNEL when no channel flag is supplied', async () => {
  const metadata = await generateMetadata([], { BLUE_RELEASE_CHANNEL: 'stable' });

  assert.equal(metadata.channel, 'stable');
  assert.equal(metadata.releaseVersion, '2.3.4');
  assert.equal(metadata.releaseName, 'Blue 2.3.4');
});