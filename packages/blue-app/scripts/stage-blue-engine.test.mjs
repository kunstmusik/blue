import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { stageBlueEngine } from './stage-blue-engine.mjs';

test('stages exactly one verified engine and its manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-stage-'));
  const source = join(root, 'source-engine');
  const manifestPath = join(root, 'artifact.json');
  const destination = join(root, 'stage');
  await writeFile(source, 'engine');
  await writeFile(manifestPath, '{"schemaVersion":1}\n');
  await writeFile(join(root, 'stale'), 'stale');

  await stageBlueEngine({
    target: {
      platform: 'darwin',
      arch: 'arm64',
      key: 'darwin-arm64',
      executableName: 'blue-engine',
      triplet: 'blue-arm64-osx',
    },
    destination,
    verify: async () => ({
      executablePath: source,
      manifestPath,
      manifest: { executableName: 'blue-engine' },
    }),
  });

  assert.deepEqual((await readdir(destination)).sort(), ['artifact.json', 'blue-engine']);
  assert.equal(await readFile(join(destination, 'blue-engine'), 'utf8'), 'engine');
});

test('does not stage an artifact that fails verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-stage-reject-'));
  await assert.rejects(
    stageBlueEngine({
      destination: join(root, 'stage'),
      verify: async () => {
        throw new Error('BLUE_ENGINE_HASH_MISMATCH');
      },
    }),
    /BLUE_ENGINE_HASH_MISMATCH/,
  );
});
