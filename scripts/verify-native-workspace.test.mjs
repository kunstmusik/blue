import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

async function json(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), 'utf8'));
}

async function sourceFiles(root) {
  const found = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        found.push(full);
      }
    }
  }
  await walk(root);
  return found;
}

test('registers the private native package and topological app dependency', async () => {
  const workspace = await readFile(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const rootPackage = await json('package.json');
  const appPackage = await json('packages/blue-app/package.json');
  const nativePackage = await json('native/blue-engine/package.json');
  const lockfile = await readFile(join(repoRoot, 'pnpm-lock.yaml'), 'utf8');

  assert.match(workspace, /native\/\*/);
  assert.equal(nativePackage.name, '@blue/engine-native');
  assert.equal(nativePackage.private, true);
  assert.equal(appPackage.devDependencies['@blue/engine-native'], 'workspace:*');
  assert.match(lockfile, /native\/blue-engine:/);
  assert.match(rootPackage.scripts.build, /pnpm -r run build/);
  assert.match(rootPackage.scripts.test, /pnpm -r run test/);
  assert.match(rootPackage.scripts.lint, /pnpm -r run lint/);
});

test('development builds the workspace engine and does not search a system install', async () => {
  const appPackage = await json('packages/blue-app/package.json');
  const runtime = await readFile(
    join(repoRoot, 'packages/blue-app/src/main/engine-runtime.ts'),
    'utf8',
  );

  assert.match(appPackage.scripts.dev, /engine:prepare/);
  assert.match(appPackage.scripts['engine:prepare'], /engine:build.*engine:stage/);
  assert.match(appPackage.scripts['engine:build'], /@blue\/engine-native build/);
  assert.match(runtime, /native[\s\S]*blue-engine[\s\S]*dist/);
  assert.doesNotMatch(runtime, /\/usr\/local\/bin\/blue-engine/);
  assert.doesNotMatch(runtime, /process\.env\.PATH/);
});

test('the app has a build edge but no runtime JavaScript import of the native package', async () => {
  const files = await sourceFiles(join(repoRoot, 'packages/blue-app/src'));
  const offenders = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (
      /from\s+['"]@blue\/engine-native|import\s*\(\s*['"]@blue\/engine-native|require\s*\(\s*['"]@blue\/engine-native/.test(
        text,
      )
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});
