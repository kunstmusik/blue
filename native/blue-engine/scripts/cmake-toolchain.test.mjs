import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resetBuildDirectoryForToolchainChange } from './cmake-toolchain.mjs';

async function createConfiguredBuild(buildDir, cacheToolchain, generatedToolchain) {
  await mkdir(join(buildDir, 'CMakeFiles', '4.4.0'), { recursive: true });
  await writeFile(
    join(buildDir, 'CMakeCache.txt'),
    `CMAKE_TOOLCHAIN_FILE:UNINITIALIZED=${cacheToolchain}\n`,
  );
  await writeFile(
    join(buildDir, 'CMakeFiles', '4.4.0', 'CMakeSystem.cmake'),
    `include("${generatedToolchain}")\n`,
  );
}

test('keeps an incremental build configured with the current toolchain', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-cmake-current-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const buildDir = join(root, 'build');
  const toolchain = join(root, 'vcpkg', 'scripts', 'buildsystems', 'vcpkg.cmake');
  await mkdir(join(root, 'vcpkg', 'scripts', 'buildsystems'), { recursive: true });
  await writeFile(toolchain, '');
  await createConfiguredBuild(buildDir, toolchain, toolchain);

  assert.equal(await resetBuildDirectoryForToolchainChange(buildDir, toolchain), false);
  await access(join(buildDir, 'CMakeCache.txt'));
});

test('removes a build whose generated CMake system references a stale toolchain', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-cmake-stale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const buildDir = join(root, 'build');
  const toolchain = join(root, 'vcpkg', 'scripts', 'buildsystems', 'vcpkg.cmake');
  const staleToolchain = join(root, 'deleted-vcpkg', 'scripts', 'buildsystems', 'vcpkg.cmake');
  await mkdir(join(root, 'vcpkg', 'scripts', 'buildsystems'), { recursive: true });
  await writeFile(toolchain, '');
  await createConfiguredBuild(buildDir, toolchain, staleToolchain);

  assert.equal(await resetBuildDirectoryForToolchainChange(buildDir, toolchain), true);
  await assert.rejects(access(buildDir), { code: 'ENOENT' });
});
