import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkStagedBlueEngine,
  resolvePackageTarget,
} from './verify-package-inputs.mjs';

async function fixture({
  platform = 'darwin',
  arch = 'arm64',
  revision = 'abc123',
  protocolVersion = 1,
  executableName = platform === 'win32' ? 'blue-engine.exe' : 'blue-engine',
} = {}) {
  const stageRoot = await mkdtemp(join(tmpdir(), 'blue-package-engine-'));
  const bytes = Buffer.from('engine fixture');
  const executablePath = join(stageRoot, executableName);
  await writeFile(executablePath, bytes);
  await chmod(executablePath, 0o755);
  await writeFile(join(stageRoot, 'artifact.json'), JSON.stringify({
    schemaVersion: 1,
    protocolVersion,
    sourceRevision: revision,
    platform,
    arch,
    executableName,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }));
  return stageRoot;
}

test('accepts exactly one revision-matched staged engine', async () => {
  const stageRoot = await fixture();
  assert.equal(checkStagedBlueEngine({
    stageRoot,
    target: resolvePackageTarget(['--target', 'darwin-arm64']),
    expectedRevision: 'abc123',
  }).ok, true);
});

test('rejects protocol, target, revision, hash, and extra-file mismatches', async (t) => {
  await t.test('protocol', async () => {
    const stageRoot = await fixture({ protocolVersion: 99 });
    assert.equal(checkStagedBlueEngine({
      stageRoot,
      target: resolvePackageTarget(['--target', 'darwin-arm64']),
      expectedRevision: 'abc123',
    }).code, 'BLUE_ENGINE_MANIFEST_MISMATCH');
  });
  await t.test('target', async () => {
    const stageRoot = await fixture();
    assert.equal(checkStagedBlueEngine({
      stageRoot,
      target: resolvePackageTarget(['--target', 'darwin-x64']),
      expectedRevision: 'abc123',
    }).code, 'BLUE_ENGINE_MANIFEST_MISMATCH');
  });
  await t.test('revision', async () => {
    const stageRoot = await fixture({ revision: 'old' });
    assert.equal(checkStagedBlueEngine({
      stageRoot,
      target: resolvePackageTarget(['--target', 'darwin-arm64']),
      expectedRevision: 'abc123',
    }).code, 'BLUE_ENGINE_SOURCE_REVISION_MISMATCH');
  });
  await t.test('hash', async () => {
    const stageRoot = await fixture();
    await writeFile(join(stageRoot, 'blue-engine'), 'changed');
    assert.equal(checkStagedBlueEngine({
      stageRoot,
      target: resolvePackageTarget(['--target', 'darwin-arm64']),
      expectedRevision: 'abc123',
    }).code, 'BLUE_ENGINE_HASH_MISMATCH');
  });
  await t.test('extra file', async () => {
    const stageRoot = await fixture();
    await writeFile(join(stageRoot, 'stale-engine'), 'stale');
    assert.equal(checkStagedBlueEngine({
      stageRoot,
      target: resolvePackageTarget(['--target', 'darwin-arm64']),
      expectedRevision: 'abc123',
    }).code, 'BLUE_ENGINE_STAGE_CONTENTS');
  });
});
