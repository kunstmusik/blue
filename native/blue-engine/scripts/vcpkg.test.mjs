import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveVcpkgRoot } from './vcpkg.mjs';

async function createCheckout(root) {
  await mkdir(join(root, 'scripts', 'buildsystems'), { recursive: true });
  await writeFile(join(root, 'scripts', 'buildsystems', 'vcpkg.cmake'), '');
  await writeFile(join(root, process.platform === 'win32' ? 'vcpkg.exe' : 'vcpkg'), '');
}

test('uses an explicit bootstrapped VCPKG_ROOT', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-vcpkg-explicit-'));
  await createCheckout(root);
  assert.equal(await resolveVcpkgRoot({ env: { VCPKG_ROOT: root } }), root);
});

test('bootstraps and reuses the package-local checkout when VCPKG_ROOT is absent', async () => {
  const packageDirectory = await mkdtemp(join(tmpdir(), 'blue-engine-vcpkg-default-'));
  const expectedRoot = join(packageDirectory, '.vcpkg');
  let bootstrapCount = 0;
  const bootstrap = async (root) => {
    bootstrapCount += 1;
    await createCheckout(root);
  };

  assert.equal(
    await resolveVcpkgRoot({ env: {}, root: packageDirectory, bootstrap }),
    expectedRoot,
  );
  assert.equal(
    await resolveVcpkgRoot({ env: {}, root: packageDirectory, bootstrap }),
    expectedRoot,
  );
  assert.equal(bootstrapCount, 1);
});

test('rejects an explicit checkout that has not been bootstrapped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blue-engine-vcpkg-invalid-'));
  await assert.rejects(
    resolveVcpkgRoot({ env: { VCPKG_ROOT: root } }),
    /BLUE_ENGINE_VCPKG_ROOT_INVALID/,
  );
});
