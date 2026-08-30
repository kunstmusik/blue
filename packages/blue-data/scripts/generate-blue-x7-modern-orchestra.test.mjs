import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { resolveBundlerPaths } from './generate-blue-x7-modern-orchestra.mjs';

test('resolves native POSIX bundler paths without changing host separators', () => {
  const paths = resolveBundlerPaths(
    '/workspace/blue-electron/packages/blue-data/scripts/generate-blue-x7-modern-orchestra.mjs',
    path.posix,
  );
  assert.equal(paths.packageRoot, '/workspace/blue-electron/packages/blue-data');
  assert.equal(
    paths.orcPath,
    '/workspace/blue-electron/packages/blue-data/resources/blue-x7-modern/bluex7.orc',
  );
  assert.equal(
    paths.generatedPath,
    '/workspace/blue-electron/packages/blue-data/src/instruments/blue-x7/modern-orchestra.generated.ts',
  );
});

test('resolves synthetic Windows paths with Windows-native separators', () => {
  const paths = resolveBundlerPaths(
    'C:\\work\\blue-electron\\packages\\blue-data\\scripts\\generate-blue-x7-modern-orchestra.mjs',
    path.win32,
  );
  assert.equal(paths.packageRoot, 'C:\\work\\blue-electron\\packages\\blue-data');
  assert.equal(
    paths.provenancePath,
    'C:\\work\\blue-electron\\packages\\blue-data\\resources\\blue-x7-modern\\provenance.json',
  );
  assert.equal(
    paths.generatedPath,
    'C:\\work\\blue-electron\\packages\\blue-data\\src\\instruments\\blue-x7\\modern-orchestra.generated.ts',
  );
});
