import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vpBin = fileURLToPath(import.meta.resolve('vite-plus/bin'));

function lintFixture(files) {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'blue-vp-lint-'));
  try {
    writeFileSync(path.join(tmpRoot, 'package.json'), '{"name":"tmp-lint","private":true}\n');
    copyFileSync(path.join(repoRoot, 'vite.config.mts'), path.join(tmpRoot, 'vite.config.mts'));
    mkdirSync(path.join(tmpRoot, 'scripts'), { recursive: true });
    copyFileSync(
      path.join(repoRoot, 'scripts', 'blue-lint-plugin.mjs'),
      path.join(tmpRoot, 'scripts', 'blue-lint-plugin.mjs'),
    );
    symlinkSync(
      path.join(repoRoot, 'node_modules'),
      path.join(tmpRoot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const targets = [];
    for (const [relativeFilePath, code] of Object.entries(files)) {
      const fullPath = path.join(tmpRoot, relativeFilePath);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, code, 'utf8');
      targets.push(relativeFilePath);
    }

    try {
      const stdout = execFileSync(
        process.execPath,
        [vpBin, 'lint', '--format', 'json', ...targets],
        {
          cwd: tmpRoot,
          encoding: 'utf8',
        },
      );
      return JSON.parse(stdout).diagnostics ?? [];
    } catch (error) {
      const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
      const jsonStart = stdout.indexOf('{');
      if (jsonStart !== -1) {
        return JSON.parse(stdout.slice(jsonStart)).diagnostics ?? [];
      }
      throw error;
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function ruleErrors(diagnostics) {
  return diagnostics.filter((d) => d.severity === 'error');
}

test('production renderer code rejects bare, window, and globalThis browser dialogs', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/renderer/confirmation-dialog-lint-fixture.ts': [
      "confirm('continue?');",
      "prompt('name');",
      "alert('failure');",
      "window.confirm('continue?');",
      "window.prompt('name');",
      "window.alert('failure');",
      "globalThis.confirm('continue?');",
      "globalThis.prompt('name');",
      "globalThis.alert('failure');",
      "window['confirm']('continue?');",
      "globalThis['alert']('failure');",
      'window[`prompt`]("name");',
      'export const { confirm: confirmDialog } = window;',
    ].join('\n'),
  });

  const errors = ruleErrors(diagnostics);
  assert.equal(errors.length, 13);
  assert.ok(
    errors.every(
      (d) => d.code === 'eslint(no-restricted-globals)' || d.code === 'blue(no-browser-dialogs)',
    ),
  );
});

test('main-process code rejects direct calls and references to Electron message boxes', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/main/confirmation-dialog-lint-fixture.ts': [
      "dialog.showMessageBox({ message: 'confirm' });",
      "dialog.showMessageBoxSync({ message: 'confirm' });",
      'export const openBox = dialog.showMessageBox;',
      "export const openBoxSync = dialog['showMessageBoxSync'];",
      "other[showMessageBox]({ message: 'confirm' });",
      'export const { showMessageBox: detachedBox } = dialog;',
    ].join('\n'),
  });

  const errors = ruleErrors(diagnostics);
  assert.equal(errors.length, 6);
  assert.ok(errors.every((d) => d.code === 'blue(no-direct-show-message-box)'));
});

test('renderer className rejects templates and regular or computed joins', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/renderer/classname-lint-fixture.tsx': [
      'export const A = <div className={`a ${foo}`} />;',
      "export const B = <div className={foo.join(' ')} />;",
      "export const C = <div className={foo[join](' ')} />;",
      "export const D = <div className={foo['join'](' ')} />;",
      "export const E = <div className={cn('a', foo)} />;",
    ].join('\n'),
  });

  const errors = ruleErrors(diagnostics);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((d) => d.code === 'blue(no-classname-string-concat)'));
});

test('unused Oxlint and ESLint suppressions fail lint', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/renderer/unused-suppressions.ts': [
      '// oxlint-disable-next-line no-restricted-globals',
      'export const a = 1;',
      '// eslint-disable-next-line no-restricted-globals',
      'export const b = 2;',
    ].join('\n'),
  });
  const errors = ruleErrors(diagnostics);
  assert.equal(errors.length, 2);
  assert.ok(errors.every((d) => /unused.*directive/i.test(d.message)));
});

test('tests and the native confirmation adapter are explicit lint boundaries', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/main/confirmation-dialog.test.ts':
      "window.confirm('test');\ndialog.showMessageBoxSync({ message: 'test' });",
    'packages/blue-app/src/main/native-confirmation.ts':
      "dialog.showMessageBox({ message: 'adapter' });",
  });

  assert.deepEqual(ruleErrors(diagnostics), []);
});

test('fixture directories remain outside the production audit scope', () => {
  const diagnostics = lintFixture({
    'packages/blue-app/src/fixtures/confirmation-dialog.ts':
      "window.confirm('fixture');\ndialog.showMessageBoxSync({ message: 'fixture' });",
  });

  assert.deepEqual(ruleErrors(diagnostics), []);
});
