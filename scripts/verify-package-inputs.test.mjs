import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkStagedBlueEngine,
  checkReleaseMetadata,
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

async function metadataFixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'blue-package-metadata-'));
  const packagePath = join(root, 'package.json');
  const metadataPath = join(root, 'release-metadata.json');
  await writeFile(packagePath, JSON.stringify({ version: '2.3.4' }));
  await writeFile(metadataPath, JSON.stringify({
    channel: 'development',
    appVersion: '2.3.4',
    sourceRevision: 'a'.repeat(40),
    generatedAt: '2026-05-04T12:00:00.000Z',
    releaseVersion: '2.3.4-dev.20260504-1200.aaaaaaa',
    releaseName: 'Blue Development Build 2.3.4-dev.20260504-1200.aaaaaaa',
    releaseNotes: 'Development build',
    ...overrides,
  }));
  return { metadataPath, packagePath, root };
}

test('accepts complete release metadata for the requested channel', async () => {
  const fixture = await metadataFixture({ channel: 'stable' });
  assert.equal(checkReleaseMetadata({
    ...fixture,
    expectedChannel: 'stable',
  }).ok, true);
  await rm(fixture.root, { recursive: true, force: true });
});

test('rejects channel and full-revision mismatches in release metadata', async (t) => {
  await t.test('channel mismatch', async () => {
    const fixture = await metadataFixture();
    assert.equal(checkReleaseMetadata({
      ...fixture,
      expectedChannel: 'stable',
    }).code, 'RELEASE_METADATA_CHANNEL_MISMATCH');
    await rm(fixture.root, { recursive: true, force: true });
  });
  await t.test('short revision', async () => {
    const fixture = await metadataFixture({ sourceRevision: 'abc1234' });
    assert.equal(checkReleaseMetadata(fixture).code, 'RELEASE_METADATA_REVISION_INVALID');
    await rm(fixture.root, { recursive: true, force: true });
  });
});
