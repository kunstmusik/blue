import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertNoFuse2, findBundledEngine } from './verify-appimage.mjs';

test('rejects a legacy FUSE 2 dependency', () => {
  assert.throws(
    () => assertNoFuse2('libfuse.so.2 => not found'),
    /BLUE_APPIMAGE_LEGACY_FUSE2_DEPENDENCY/,
  );
  assert.equal(assertNoFuse2('linux-vdso.so.1'), true);
});

test('locates the bundled engine in extracted AppImage resources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blue-appimage-layout-'));
  const engine = join(root, 'resources', 'assets', 'engine', 'blue-engine');
  await mkdir(join(root, 'resources', 'assets', 'engine'), { recursive: true });
  await writeFile(engine, 'engine');
  assert.equal(findBundledEngine(root), engine);
});
