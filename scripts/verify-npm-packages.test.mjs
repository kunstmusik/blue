import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  REPO_ROOT,
  buildShimInvocation,
  quoteWindowsCmdArg,
  spawnShimCommand,
} from './verify-npm-packages.mjs';

test('quoteWindowsCmdArg quotes paths with spaces and cmd metacharacters cleanly', () => {
  assert.equal(quoteWindowsCmdArg('install'), 'install');
  assert.equal(quoteWindowsCmdArg('--no-audit'), '--no-audit');
  assert.equal(
    quoteWindowsCmdArg('C:\\Users\\Build Agent\\My Artifacts\\blue-data.tgz'),
    '"C:\\Users\\Build Agent\\My Artifacts\\blue-data.tgz"',
  );
  assert.equal(quoteWindowsCmdArg('C:\\dir with & (parens)^\\'), '"C:\\dir with & (parens)^\\\\"');
  assert.equal(quoteWindowsCmdArg(''), '""');
  assert.equal(quoteWindowsCmdArg('npm.cmd', { alwaysQuote: true }), '"npm.cmd"');
});

test('quoteWindowsCmdArg rejects non-strings and embedded quotes or control characters', () => {
  assert.throws(() => quoteWindowsCmdArg(123), /must be a string/i);
  for (const unsafe of ['bad"quote', 'bad\nline', 'bad\rline', 'bad\0nul']) {
    assert.throws(() => quoteWindowsCmdArg(unsafe), /unsupported control or quote character/i);
  }
});

test('buildShimInvocation constructs verbatim cmd.exe invocations on win32 without shell: true', () => {
  const customComSpec = 'C:\\Windows\\System32\\cmd.exe';
  const npmInstallInvocation = buildShimInvocation(
    'npm.cmd',
    [
      'install',
      '--no-audit',
      '--no-fund',
      'C:\\Users\\Build Agent\\My Artifacts %OS%\\kunstmusik-blue-data-0.1.0.tgz',
      'C:\\Users\\Build Agent\\My Artifacts\\kunstmusik-blue-cli-0.1.0.tgz',
    ],
    {
      platform: 'win32',
      env: { ComSpec: customComSpec },
    },
  );

  assert.equal(npmInstallInvocation.command, customComSpec);
  assert.equal(npmInstallInvocation.spawnOptions.shell, false);
  assert.equal(npmInstallInvocation.spawnOptions.windowsVerbatimArguments, true);
  assert.equal(npmInstallInvocation.spawnOptions.env.BLUE_NPM_SHIM_PERCENT, '%');
  assert.deepEqual(npmInstallInvocation.args.slice(0, 4), ['/d', '/v:off', '/s', '/c']);
  assert.equal(
    npmInstallInvocation.args[4],
    '""npm.cmd" install --no-audit --no-fund "C:\\Users\\Build Agent\\My Artifacts %BLUE_NPM_SHIM_PERCENT%OS%BLUE_NPM_SHIM_PERCENT%\\kunstmusik-blue-data-0.1.0.tgz" "C:\\Users\\Build Agent\\My Artifacts\\kunstmusik-blue-cli-0.1.0.tgz""',
  );

  const shimPath =
    'C:\\Users\\Build Agent\\AppData\\Local\\Temp\\blue cli smoke\\node_modules\\.bin\\blue-cli.cmd';
  const inputPath = 'C:\\work\\project & dir\\host project.blue';
  const outputPath = 'C:\\work\\project (out)^\\host output.csd';
  const cliInvocation = buildShimInvocation(
    shimPath,
    ['compile', '-p', inputPath, '-o', outputPath],
    {
      platform: 'win32',
      env: { COMSPEC: customComSpec },
    },
  );

  assert.equal(cliInvocation.command, customComSpec);
  assert.equal(cliInvocation.spawnOptions.shell, false);
  assert.equal(cliInvocation.spawnOptions.windowsVerbatimArguments, true);
  assert.deepEqual(cliInvocation.args.slice(0, 4), ['/d', '/v:off', '/s', '/c']);
  assert.equal(
    cliInvocation.args[4],
    `""${shimPath}" compile -p "${inputPath}" -o "${outputPath}""`,
  );

  const fallbackComSpec = buildShimInvocation('npm.cmd', ['--version'], {
    platform: 'win32',
    env: {},
  });
  assert.equal(fallbackComSpec.command, 'cmd.exe');
});

test('buildShimInvocation passes arguments directly on POSIX without shell: true', () => {
  for (const platform of ['darwin', 'linux']) {
    const invocation = buildShimInvocation(
      '/tmp/blue cli smoke/node_modules/.bin/blue-cli',
      ['compile', '-p', '/tmp/my project.blue', '-o', '/tmp/my output.csd'],
      { platform },
    );
    assert.equal(invocation.command, '/tmp/blue cli smoke/node_modules/.bin/blue-cli');
    assert.deepEqual(invocation.args, [
      'compile',
      '-p',
      '/tmp/my project.blue',
      '-o',
      '/tmp/my output.csd',
    ]);
    assert.deepEqual(invocation.spawnOptions, { shell: false });
  }
});

test('npm verification scripts avoid shell: true and shell: process.platform === "win32"', () => {
  for (const relPath of [
    'scripts/verify-npm-packages.mjs',
    'scripts/npm-smoke/cli.mjs',
    'scripts/verify-npm-release.mjs',
  ]) {
    const raw = readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    const codeOnly = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
    assert.equal(
      /shell\s*:\s*(?:true|process\.platform\s*===?\s*['"]win32['"])/.test(codeOnly),
      false,
      `${relPath} must not spawn subprocesses with shell: true`,
    );
  }
});

test('spawnShimCommand preserves spaces and literal percent-delimited text through the shim', () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'blue-shim-space-test-'));
  try {
    const shimDir = path.join(tempRoot, 'shim dir with spaces %BLUE_SHIM_TEST_PATH%');
    mkdirSync(shimDir, { recursive: true });
    const echoScript = path.join(tempRoot, 'echo args.mjs');
    writeFileSync(
      echoScript,
      'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n',
      'utf8',
    );

    const shimPath = path.join(shimDir, process.platform === 'win32' ? 'fake-cli.cmd' : 'fake-cli');
    if (process.platform === 'win32') {
      writeFileSync(shimPath, `@echo off\r\n"${process.execPath}" "${echoScript}" %*\r\n`, 'utf8');
    } else {
      writeFileSync(
        shimPath,
        `#!/bin/sh\nexec "${process.execPath}" "${echoScript}" "$@"\n`,
        'utf8',
      );
      chmodSync(shimPath, 0o755);
    }

    const argsWithSpaces = [
      'compile',
      '-p',
      path.join(shimDir, 'project dir & (test) %BLUE_SHIM_TEST_PATH%', 'host project.blue'),
      '-o',
      path.join(shimDir, 'out dir', 'host %BLUE_SHIM_TEST_PATH% output.csd'),
    ];
    const res = spawnShimCommand(shimPath, argsWithSpaces, {
      cwd: tempRoot,
      env: { ...process.env, BLUE_SHIM_TEST_PATH: 'unexpected substitution' },
    });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), argsWithSpaces);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
