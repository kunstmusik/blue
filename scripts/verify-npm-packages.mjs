#!/usr/bin/env node
/**
 * Shared archive verification entry point for @kunstmusik/blue-data and @kunstmusik/blue-cli.
 *
 * Usage:
 *   node scripts/verify-npm-packages.mjs <data.tgz> <cli.tgz> [--json <report.json>] [--expected-version <ver>]
 *   node scripts/verify-npm-packages.mjs --data <data.tgz> [--cli <cli.tgz>] [--json <report.json>]
 *
 * Inspects exact tarball bytes, validates public names/versions/dependencies/notices,
 * installs into disposable consumer directories outside the checkout using npm,
 * and invokes package-specific verification suites when selected.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');

export const STRICT_SEMVER_NO_BUILD =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;

const EXPECTED_PACKAGE_SPECS = {
  data: {
    name: '@kunstmusik/blue-data',
    requiredDependencies: ['@rgrove/parse-xml', 'quickjs-emscripten'],
    requiredNotices: ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'],
  },
  cli: {
    name: '@kunstmusik/blue-cli',
    requiredDependencies: ['quickjs-emscripten', 'zeromq'],
    requiredNotices: ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'],
  },
};

/**
 * Parse positional or flagged CLI arguments for verify-npm-packages.
 *
 * @param {string[]} argv
 * @returns {{
 *   dataPath: string | null,
 *   cliPath: string | null,
 *   jsonPath: string | null,
 *   expectedVersion: string | null,
 * }}
 */
export function parseVerifyArgs(argv) {
  let dataPath = null;
  let cliPath = null;
  let jsonPath = null;
  let expectedVersion = null;
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--data') {
      dataPath = argv[++i] ?? null;
    } else if (arg === '--cli') {
      cliPath = argv[++i] ?? null;
    } else if (arg === '--json') {
      jsonPath = argv[++i] ?? null;
    } else if (arg === '--expected-version') {
      expectedVersion = argv[++i] ?? null;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    if (dataPath || cliPath) {
      throw new Error('Pass either positional <data.tgz> <cli.tgz> or --data / --cli flags.');
    }
    if (positional.length !== 2) {
      throw new Error(
        `Expected 2 positional archive paths (<data.tgz> <cli.tgz>), got ${positional.length}.`,
      );
    }
    [dataPath, cliPath] = positional;
  }

  if (!dataPath && !cliPath) {
    throw new Error(
      'At least one archive path (<data.tgz> <cli.tgz>, --data, or --cli) is required.',
    );
  }

  return {
    dataPath: dataPath ? path.resolve(dataPath) : null,
    cliPath: cliPath ? path.resolve(cliPath) : null,
    jsonPath: jsonPath ? path.resolve(jsonPath) : null,
    expectedVersion,
  };
}

function printUsage() {
  process.stdout.write(
    [
      'Usage:',
      '  node scripts/verify-npm-packages.mjs <data.tgz> <cli.tgz> [--json <report.json>] [--expected-version <ver>]',
      '  node scripts/verify-npm-packages.mjs --data <data.tgz> [--cli <cli.tgz>] [--json <report.json>]',
      '',
    ].join('\n'),
  );
}

/**
 * Decode a NUL-trimmed UTF-8 string from a tar header field.
 *
 * @param {Buffer} buffer
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function readTarString(buffer, start, end) {
  const slice = buffer.subarray(start, end);
  const nul = slice.indexOf(0);
  return (nul === -1 ? slice : slice.subarray(0, nul)).toString('utf8');
}

/**
 * Parse a tar octal/base-256 numeric header field.
 *
 * @param {Buffer} buffer
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
function readTarNumber(buffer, start, end) {
  const first = buffer[start];
  if (first !== undefined && (first & 0x80) !== 0) {
    let value = 0;
    for (let i = start + 1; i < end; i += 1) {
      value = value * 256 + buffer[i];
    }
    return value;
  }
  const text = readTarString(buffer, start, end).trim();
  if (!text) return 0;
  const parsed = Number.parseInt(text, 8);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid tar numeric header field: ${JSON.stringify(text)}`);
  }
  return parsed;
}

/**
 * Parse PAX extended header key/value records (`<len> <key>=<value>\n`).
 *
 * @param {Buffer} data
 * @returns {Record<string, string>}
 */
function parsePaxRecords(data) {
  /** @type {Record<string, string>} */
  const records = {};
  const text = data.toString('utf8');
  let offset = 0;
  while (offset < text.length) {
    const spaceIndex = text.indexOf(' ', offset);
    if (spaceIndex === -1) break;
    const len = Number.parseInt(text.slice(offset, spaceIndex), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(spaceIndex + 1, offset + len - 1);
    const eqIndex = record.indexOf('=');
    if (eqIndex !== -1) {
      records[record.slice(0, eqIndex)] = record.slice(eqIndex + 1);
    }
    offset += len;
  }
  return records;
}

/**
 * Normalize an archive entry path relative to the npm `package/` root.
 *
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeArchiveEntryPath(rawPath) {
  let normalized = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.startsWith('package/')) {
    normalized = normalized.slice('package/'.length);
  }
  normalized = normalized.replace(/\/+$/, '');
  return normalized === 'package' ? '' : normalized;
}

/**
 * Inspect an npm `.tgz` tarball completely in Node without OS `tar` differences.
 *
 * @param {string} archivePath
 * @returns {{
 *   archivePath: string,
 *   filename: string,
 *   bytes: number,
 *   integrity: string,
 *   sha256: string,
 *   entries: Map<string, Buffer>,
 *   directories: Set<string>,
 * }}
 */
export function readTarballEntries(archivePath) {
  const absPath = path.resolve(archivePath);
  if (!existsSync(absPath)) {
    throw new Error(`Archive not found: ${absPath}`);
  }
  const compressed = readFileSync(absPath);
  const integrity = `sha512-${createHash('sha512').update(compressed).digest('base64')}`;
  const sha256 = createHash('sha256').update(compressed).digest('hex');
  const tarBuffer = gunzipSync(compressed);

  /** @type {Map<string, Buffer>} */
  const entries = new Map();
  /** @type {Set<string>} */
  const directories = new Set();

  /** @type {Record<string, string>} */
  let globalPax = {};
  /** @type {Record<string, string>} */
  let nextPax = {};
  let gnuLongName = null;

  let offset = 0;
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const namePart = readTarString(header, 0, 100);
    const prefixPart = readTarString(header, 345, 500);
    const typeFlag = String.fromCharCode(header[156] || 48);
    const rawSize = readTarNumber(header, 124, 136);

    const paxSize = nextPax.size ?? globalPax.size;
    const size = paxSize !== undefined ? Number.parseInt(paxSize, 10) : rawSize;
    const blocks = Math.ceil(size / 512);
    const payload = tarBuffer.subarray(offset, offset + size);
    offset += blocks * 512;

    if (typeFlag === 'x') {
      nextPax = { ...nextPax, ...parsePaxRecords(payload) };
      continue;
    }
    if (typeFlag === 'g') {
      globalPax = { ...globalPax, ...parsePaxRecords(payload) };
      continue;
    }
    if (typeFlag === 'L') {
      gnuLongName = payload.toString('utf8').replace(/\0+$/, '');
      continue;
    }

    const headerPath = prefixPart ? `${prefixPart}/${namePart}` : namePart;
    const rawEntryName = nextPax.path ?? gnuLongName ?? globalPax.path ?? headerPath;
    nextPax = {};
    gnuLongName = null;

    const entryPath = normalizeArchiveEntryPath(rawEntryName);
    if (!entryPath) continue;

    if (typeFlag === '5') {
      directories.add(entryPath);
    } else if (typeFlag === '0' || typeFlag === '\0') {
      entries.set(entryPath, Buffer.from(payload));
      let parent = path.posix.dirname(entryPath);
      while (parent && parent !== '.') {
        directories.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
  }

  return {
    archivePath: absPath,
    filename: path.basename(absPath),
    bytes: compressed.length,
    integrity,
    sha256,
    entries,
    directories,
  };
}

/**
 * Parse the minimum major Node version from an `engines.node` constraint.
 *
 * @param {string | undefined} range
 * @returns {number}
 */
function parseMinNodeMajor(range) {
  if (!range || typeof range !== 'string') return 0;
  const match = range.match(/>=\s*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Validate manifest identity, runtime floor, resolvable dependencies, and base notices.
 *
 * @param {ReturnType<typeof readTarballEntries>} archiveInfo
 * @param {'data' | 'cli'} kind
 * @param {string | null} [expectedVersion]
 * @returns {{ name: string, version: string, dependencies: Record<string, string>, manifest: Record<string, unknown> }}
 */
export function validateArchiveManifest(archiveInfo, kind, expectedVersion = null) {
  const spec = EXPECTED_PACKAGE_SPECS[kind];
  if (!spec) {
    throw new Error(`Unsupported package kind: ${kind}`);
  }

  const pkgBuffer = archiveInfo.entries.get('package.json');
  if (!pkgBuffer) {
    throw new Error(`${archiveInfo.filename}: missing package.json inside archive.`);
  }

  /** @type {Record<string, unknown>} */
  const manifest = JSON.parse(pkgBuffer.toString('utf8'));
  if (manifest.name !== spec.name) {
    throw new Error(
      `${archiveInfo.filename}: expected package name "${spec.name}", found ${JSON.stringify(manifest.name)}.`,
    );
  }

  if (typeof manifest.version !== 'string' || !STRICT_SEMVER_NO_BUILD.test(manifest.version)) {
    throw new Error(
      `${archiveInfo.filename}: invalid package version ${JSON.stringify(manifest.version)}.`,
    );
  }

  if (expectedVersion && manifest.version !== expectedVersion) {
    throw new Error(
      `${archiveInfo.filename}: expected version "${expectedVersion}", found "${manifest.version}".`,
    );
  }

  const engines = /** @type {Record<string, unknown> | undefined} */ (manifest.engines);
  const minNodeMajor = parseMinNodeMajor(
    engines && typeof engines.node === 'string' ? engines.node : undefined,
  );
  if (minNodeMajor < 22) {
    throw new Error(
      `${archiveInfo.filename}: expected engines.node >= 22, found ${JSON.stringify(engines?.node)}.`,
    );
  }

  const dependencies = /** @type {Record<string, string>} */ (
    manifest.dependencies && typeof manifest.dependencies === 'object' ? manifest.dependencies : {}
  );
  for (const [depName, depSpec] of Object.entries(dependencies)) {
    if (depName.startsWith('@blue/')) {
      throw new Error(
        `${archiveInfo.filename}: private workspace package "${depName}" must not appear in published dependencies.`,
      );
    }
    if (
      typeof depSpec !== 'string' ||
      /^(?:workspace:|file:|link:|portal:)/i.test(depSpec.trim())
    ) {
      throw new Error(
        `${archiveInfo.filename}: unresolvable dependency "${depName}": ${JSON.stringify(depSpec)}.`,
      );
    }
  }

  for (const requiredDep of spec.requiredDependencies) {
    if (!dependencies[requiredDep]) {
      throw new Error(
        `${archiveInfo.filename}: missing required runtime dependency "${requiredDep}".`,
      );
    }
  }

  for (const requiredNotice of spec.requiredNotices) {
    if (!archiveInfo.entries.has(requiredNotice)) {
      throw new Error(`${archiveInfo.filename}: missing required file "${requiredNotice}".`);
    }
  }

  return {
    name: manifest.name,
    version: manifest.version,
    dependencies,
    manifest,
  };
}

/**
 * Verify every local relative markdown link in an archived markdown document resolves inside the archive.
 *
 * @param {ReturnType<typeof readTarballEntries>} archiveInfo
 * @param {string} markdownPath
 */
export function assertArchiveMarkdownLinksResolve(archiveInfo, markdownPath) {
  const buf = archiveInfo.entries.get(markdownPath);
  if (!buf) {
    throw new Error(`${archiveInfo.filename}: missing markdown notice "${markdownPath}".`);
  }

  const content = buf.toString('utf8');
  const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  const baseDir = path.posix.dirname(markdownPath);
  const missing = [];

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '');
    if (!rawTarget || rawTarget.startsWith('#') || /^(?:https?:|mailto:|data:)/i.test(rawTarget)) {
      continue;
    }
    const targetWithoutHash = rawTarget.split('#')[0].split('?')[0];
    if (!targetWithoutHash) continue;

    const resolved = path.posix.normalize(
      baseDir === '.' ? targetWithoutHash : path.posix.join(baseDir, targetWithoutHash),
    );
    if (resolved.startsWith('..') || path.posix.isAbsolute(resolved)) {
      missing.push(`${rawTarget} -> escapes package root (${resolved})`);
      continue;
    }

    const exists =
      archiveInfo.entries.has(resolved) ||
      archiveInfo.directories.has(resolved) ||
      [...archiveInfo.entries.keys()].some((entry) => entry.startsWith(`${resolved}/`));
    if (!exists) {
      missing.push(`${rawTarget} -> ${resolved}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${archiveInfo.filename}: unresolved relative link(s) in ${markdownPath}:\n  - ${missing.join('\n  - ')}`,
    );
  }
}

/**
 * Execute a subprocess synchronously and throw with captured diagnostics on non-zero exit.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding & { label?: string }} [options]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function runCommand(command, args, options = {}) {
  const { label, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...spawnOptions,
  });

  if (result.error) {
    throw new Error(`${label ?? command}: failed to launch: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
    throw new Error(
      `${label ?? command} exited with status ${result.status}${detail ? `:\n${detail}` : ''}`,
    );
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Quote one command or argument token for a `cmd.exe /d /v:off /s /c` invocation.
 *
 * Rejects control characters (`\0`, `\r`, `\n`) and embedded `"` because `.cmd`
 * shims cannot safely transport them without corrupting downstream argument boundaries.
 *
 * @param {string} value
 * @param {{ alwaysQuote?: boolean }} [options]
 * @returns {string}
 */
export function quoteWindowsCmdArg(value, { alwaysQuote = false } = {}) {
  if (typeof value !== 'string') {
    throw new Error(`Windows shim argument must be a string, got ${typeof value}.`);
  }
  if (/[\0\r\n"]/.test(value)) {
    throw new Error(
      `Windows shim argument contains unsupported control or quote character: ${JSON.stringify(value)}`,
    );
  }
  if (!alwaysQuote && value.length > 0 && /^[A-Za-z0-9_./:@\\-]+$/.test(value)) {
    return value;
  }
  const escapedTrailing = value.replace(/(\\+)$/, '$1$1');
  return `"${escapedTrailing}"`;
}

/**
 * Build a platform-safe command invocation for shims (`.cmd`/`.bat` on Windows, direct exec on POSIX).
 *
 * Never uses `shell: true`; on Windows routes through `%ComSpec% /d /v:off /s /c "..."` with
 * `windowsVerbatimArguments: true` so paths containing spaces or cmd metacharacters stay intact.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv }} [options]
 * @returns {{ command: string, args: string[], spawnOptions: { shell: false, windowsVerbatimArguments?: boolean, env?: NodeJS.ProcessEnv } }}
 */
export function buildShimInvocation(
  command,
  args,
  { platform = process.platform, env = process.env } = {},
) {
  if (platform !== 'win32') {
    return {
      command,
      args: [...args],
      spawnOptions: { shell: false },
    };
  }
  const comspec = env?.ComSpec || env?.COMSPEC || env?.comspec || 'cmd.exe';
  // cmd expands percent variables inside double quotes, but does not rescan their values.
  const percentVariable = 'BLUE_NPM_SHIM_PERCENT';
  const commandLine = [
    quoteWindowsCmdArg(command, { alwaysQuote: true }),
    ...args.map((arg) => quoteWindowsCmdArg(arg)),
  ]
    .join(' ')
    .replaceAll('%', `%${percentVariable}%`);
  return {
    command: comspec,
    args: ['/d', '/v:off', '/s', '/c', `"${commandLine}"`],
    spawnOptions: {
      shell: false,
      windowsVerbatimArguments: true,
      env: { ...env, [percentVariable]: '%' },
    },
  };
}

/**
 * Execute a shim command cleanly without `shell: true` and return its exit status and output.
 *
 * Throws only on launch failure (`result.error`), allowing callers to inspect non-zero exits.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding & { label?: string }} [options]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function spawnShimCommand(command, args, options = {}) {
  const { label, ...spawnOptions } = options;
  const invocation = buildShimInvocation(command, args, { env: spawnOptions.env ?? process.env });
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...spawnOptions,
    ...invocation.spawnOptions,
  });

  if (result.error) {
    throw new Error(`${label ?? command}: failed to launch: ${result.error.message}`);
  }
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Execute npm cleanly across POSIX (`npm`) and Windows (`npm.cmd`) without `shell: true`.
 *
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding & { label?: string }} [options]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function spawnNpm(args, options = {}) {
  if (process.platform !== 'win32') {
    return spawnShimCommand('npm', args, options);
  }
  // npm.cmd uses its own directory to locate npm-cli.js.
  const { stdout } = runCommand('where.exe', ['$PATH:npm.cmd'], { env: options.env });
  const [npmBin] = stdout.trim().split(/\r?\n/);
  return spawnShimCommand(npmBin, args, options);
}

/**
 * Execute npm in a cross-platform way without `shell: true` and throw on non-zero exit.
 *
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding & { label?: string }} [options]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function runNpm(args, options = {}) {
  const result = spawnNpm(args, options);
  if (result.status !== 0) {
    const detail = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
    throw new Error(
      `${options.label ?? 'npm'} exited with status ${result.status}${detail ? `:\n${detail}` : ''}`,
    );
  }
  return result;
}

/**
 * Create an isolated disposable consumer project outside the checkout and install archives with npm.
 *
 * @param {string} prefix
 * @param {string[]} archivePaths
 * @returns {{ dir: string, cleanup: () => void }}
 */
export function createDisposableConsumer(prefix, archivePaths) {
  const rawTmpDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  const dir = realpathSync(rawTmpDir);
  const realRepo = realpathSync(REPO_ROOT);
  const relToRepo = path.relative(realRepo, dir);
  if (!relToRepo.startsWith('..') && !path.isAbsolute(relToRepo)) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`Disposable consumer must reside outside the checkout: ${dir}`);
  }

  const cleanup = () => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  try {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'blue-npm-smoke-consumer',
          version: '0.0.0',
          private: true,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    mkdirSync(path.join(dir, 'work'), { recursive: true });
    const resolvedArchives = archivePaths.map((p) => path.resolve(p));
    runNpm(['install', '--no-audit', '--no-fund', ...resolvedArchives], {
      cwd: dir,
      label: `npm install (${resolvedArchives.map((p) => path.basename(p)).join(', ')})`,
    });
    return { dir, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Assert that a smoke module file exists and load its expected export.
 *
 * @param {string} modulePath
 * @param {string} exportName
 */
async function loadSmokeHandler(modulePath, exportName) {
  if (!existsSync(modulePath)) {
    throw new Error(`Required smoke suite module is missing: ${modulePath}`);
  }
  const mod = await import(pathToFileURL(modulePath).href);
  if (typeof mod[exportName] !== 'function') {
    throw new Error(`Smoke suite ${modulePath} must export function "${exportName}".`);
  }
  return mod[exportName];
}

/**
 * Run archive verification across the supplied data and/or CLI tarballs.
 *
 * @param {{
 *   dataPath?: string | null,
 *   cliPath?: string | null,
 *   expectedVersion?: string | null,
 * }} options
 */
export async function verifyArchives({ dataPath = null, cliPath = null, expectedVersion = null }) {
  /** @type {Record<string, unknown>} */
  const report = {
    verifiedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    archives: {},
    checks: {},
  };

  let dataInfo = null;
  let dataMeta = null;
  if (dataPath) {
    dataInfo = readTarballEntries(dataPath);
    dataMeta = validateArchiveManifest(dataInfo, 'data', expectedVersion);
    report.archives.data = {
      filename: dataInfo.filename,
      name: dataMeta.name,
      version: dataMeta.version,
      bytes: dataInfo.bytes,
      integrity: dataInfo.integrity,
      sha256: dataInfo.sha256,
      entryCount: dataInfo.entries.size,
    };
  }

  let cliInfo = null;
  let cliMeta = null;
  if (cliPath) {
    cliInfo = readTarballEntries(cliPath);
    cliMeta = validateArchiveManifest(cliInfo, 'cli', expectedVersion);
    report.archives.cli = {
      filename: cliInfo.filename,
      name: cliMeta.name,
      version: cliMeta.version,
      bytes: cliInfo.bytes,
      integrity: cliInfo.integrity,
      sha256: cliInfo.sha256,
      entryCount: cliInfo.entries.size,
    };
  }

  if (dataMeta && cliMeta && dataMeta.version !== cliMeta.version) {
    throw new Error(
      `Archive version mismatch: ${dataMeta.name}@${dataMeta.version} vs ${cliMeta.name}@${cliMeta.version}.`,
    );
  }

  if (dataInfo) {
    const verifyDataArchive = await loadSmokeHandler(
      path.join(__dirname, 'npm-smoke', 'data.mjs'),
      'verifyDataArchive',
    );
    report.checks.data = await verifyDataArchive({
      archivePath: dataInfo.archivePath,
      archiveInfo: dataInfo,
      manifest: dataMeta,
      repoRoot: REPO_ROOT,
    });
  }

  if (cliInfo) {
    const verifyCliArchive = await loadSmokeHandler(
      path.join(__dirname, 'npm-smoke', 'cli.mjs'),
      'verifyCliArchive',
    );
    report.checks.cli = await verifyCliArchive({
      archivePath: cliInfo.archivePath,
      archiveInfo: cliInfo,
      manifest: cliMeta,
      repoRoot: REPO_ROOT,
    });
  }

  return report;
}

async function main() {
  const options = parseVerifyArgs(process.argv.slice(2));
  const report = await verifyArchives(options);
  if (options.jsonPath) {
    mkdirSync(path.dirname(options.jsonPath), { recursive: true });
    writeFileSync(options.jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

const isEntryPoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
