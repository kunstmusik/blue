import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
});

async function lintText(code, relativeFilePath) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relativeFilePath),
  });
  return result;
}

function ruleErrors(result) {
  return result.messages.filter((message) => message.severity === 2);
}

test('production renderer code rejects bare, window, and globalThis browser dialogs', async () => {
  const result = await lintText(
    [
      "confirm('continue?');",
      "prompt('name');",
      "alert('failure');",
      "window.confirm('continue?');",
      "window.prompt('name');",
      "window.alert('failure');",
      "globalThis.confirm('continue?');",
      "globalThis.prompt('name');",
      "globalThis.alert('failure');",
    ].join('\n'),
    'packages/blue-app/src/renderer/confirmation-dialog-lint-fixture.ts',
  );

  const errors = ruleErrors(result);
  assert.equal(errors.length, 9);
  assert.ok(errors.every((message) => message.ruleId === 'no-restricted-globals' || message.ruleId === 'no-restricted-properties'));
});

test('main-process code rejects both synchronous and asynchronous message boxes', async () => {
  const result = await lintText(
    "dialog.showMessageBox({ message: 'confirm' });\ndialog.showMessageBoxSync({ message: 'confirm' });",
    'packages/blue-app/src/main/confirmation-dialog-lint-fixture.ts',
  );

  const errors = ruleErrors(result);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((message) => message.ruleId === 'no-restricted-properties' || message.ruleId === 'no-restricted-syntax'));
});

test('tests and the native confirmation adapter are explicit lint boundaries', async () => {
  const testResult = await lintText(
    "window.confirm('test');\ndialog.showMessageBoxSync({ message: 'test' });",
    'packages/blue-app/src/main/confirmation-dialog.test.ts',
  );
  assert.deepEqual(ruleErrors(testResult), []);

  const adapterResult = await lintText(
    "dialog.showMessageBox({ message: 'adapter' });",
    'packages/blue-app/src/main/native-confirmation.ts',
  );
  assert.deepEqual(ruleErrors(adapterResult), []);
});

test('fixture directories remain outside the production audit scope', async () => {
  const result = await lintText(
    "window.confirm('fixture');\ndialog.showMessageBoxSync({ message: 'fixture' });",
    'packages/blue-app/src/fixtures/confirmation-dialog.ts',
  );

  assert.deepEqual(ruleErrors(result), []);
});
