import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveTarget } from './target.mjs';
import {
  inspectArchitectureReport,
  inspectDependencyReport,
  inspectGlibcVersionReport,
  validateManifest,
  verifyArtifact,
} from './verify-artifact.mjs';

const target = resolveTarget('darwin', 'arm64');
const baseManifest = {
  schemaVersion: 1,
  engineVersion: '0.1.0',
  protocolVersion: 2,
  sourceRevision: '0123456789012345678901234567890123456789',
  platform: 'darwin',
  arch: 'arm64',
  executableName: 'blue-engine',
  sha256: 'a'.repeat(64),
  buildType: 'Release',
  vcpkgBaseline: '9d7f79f56ae1a9b4704d6a7fb8237e347a974133',
  vcpkgTriplet: 'blue-arm64-osx',
  allowedExternalDependencies: ['macos-system'],
};

test('validates manifest schema and target', () => {
  assert.equal(validateManifest(baseManifest, target), baseManifest);
  assert.throws(
    () => validateManifest({ ...baseManifest, platform: 'linux' }, target),
    /BLUE_ENGINE_TARGET_MISMATCH/,
  );
  assert.throws(
    () => validateManifest({ ...baseManifest, allowedExternalDependencies: ['homebrew'] }, target),
    /BLUE_ENGINE_EXTERNAL_ALLOWLIST_INVALID/,
  );
});

test('rejects dirty revisions in CI', () => {
  assert.throws(
    () => validateManifest({ ...baseManifest, sourceRevision: 'dirty:abc' }, target, { ci: true }),
    /BLUE_ENGINE_DIRTY_CI_REVISION/,
  );
});

test('validates executable hash and permission', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'blue-engine-artifact-'));
  const bytes = Buffer.from('fake executable');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, 'blue-engine'), bytes);
  await chmod(join(artifactDir, 'blue-engine'), 0o755);
  await writeFile(join(artifactDir, 'artifact.json'), JSON.stringify({ ...baseManifest, sha256 }));
  const result = await verifyArtifact({ target, artifactDir, ci: false, inspectBinary: false });
  assert.equal(result.manifest.sha256, sha256);
  await writeFile(join(artifactDir, 'blue-engine'), 'changed');
  await assert.rejects(
    verifyArtifact({ target, artifactDir, ci: false, inspectBinary: false }),
    /BLUE_ENGINE_HASH_MISMATCH/,
  );
});

test('rejects shared ZeroMQ, sodium, and Csound dependencies', () => {
  assert.throws(
    () => inspectDependencyReport('darwin', '/tmp/blue-engine:\\n/opt/homebrew/lib/libzmq.dylib'),
    /BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY/,
  );
  assert.throws(
    () => inspectDependencyReport('linux', 'libsodium.so => /usr/lib/libsodium.so'),
    /BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY/,
  );
});

test('enforces platform runtime allowlists from dependency fixtures', async () => {
  const fixtureRoot = join(import.meta.dirname, '..', 'tests', 'fixtures', 'dependency-reports');
  assert.equal(
    inspectDependencyReport('darwin', await readFile(join(fixtureRoot, 'macos-allowed.txt'), 'utf8')),
    true,
  );
  assert.equal(
    inspectDependencyReport('win32', await readFile(join(fixtureRoot, 'windows-allowed.txt'), 'utf8')),
    true,
  );
  assert.equal(
    inspectDependencyReport('linux', await readFile(join(fixtureRoot, 'linux-allowed.txt'), 'utf8')),
    true,
  );
  assert.throws(
    () => inspectDependencyReport(
      'darwin',
      '/tmp/blue-engine:\n/opt/homebrew/lib/libcustom.dylib (compatibility version 1.0.0)',
    ),
    /BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY/,
  );
  assert.throws(
    () => inspectDependencyReport('win32', 'KERNEL32.dll\ncustom-runtime.dll'),
    /BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY/,
  );
});

test('validates executable architecture reports and glibc symbol floors', () => {
  assert.equal(inspectArchitectureReport('Mach-O 64-bit executable arm64', target), true);
  assert.equal(
    inspectArchitectureReport('PE32+ executable (console) x86-64', resolveTarget('win32', 'x64')),
    true,
  );
  assert.throws(
    () => inspectArchitectureReport('ELF 64-bit LSB pie executable, ARM aarch64', resolveTarget('linux', 'x64')),
    /BLUE_ENGINE_ARCHITECTURE_MISMATCH/,
  );
  assert.equal(inspectGlibcVersionReport('Name: GLIBC_2.17\nName: GLIBC_2.34'), '2.34');
  assert.throws(
    () => inspectGlibcVersionReport('Name: GLIBC_2.36'),
    /BLUE_ENGINE_GLIBC_FLOOR_EXCEEDED/,
  );
});
