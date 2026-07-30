import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTargetArgs, resolveTarget, supportedTargetKeys } from './target.mjs';

test('selects supported target triplets deterministically', () => {
  assert.deepEqual(supportedTargetKeys, ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64']);
  assert.equal(resolveTarget('darwin', 'arm64').triplet, 'blue-arm64-osx');
  assert.equal(resolveTarget('win32', 'x64').executableName, 'blue-engine.exe');
  assert.equal(parseTargetArgs(['--target', 'linux-x64']).preset, 'linux-x64');
});

test('rejects unsupported and malformed targets', () => {
  assert.throws(() => resolveTarget('linux', 'arm64'), /BLUE_ENGINE_UNSUPPORTED_TARGET/);
  assert.throws(() => parseTargetArgs(['--target']), /BLUE_ENGINE_INVALID_TARGET/);
});
