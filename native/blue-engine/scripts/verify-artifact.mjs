import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { packageRoot, protocolVersion, sha256File, sourceRevision, vcpkgBaseline } from './artifact.mjs';
import { parseTargetArgs, resolveTarget } from './target.mjs';

const allowedExternalDependencies = {
  darwin: new Set(['macos-system']),
  win32: new Set(['windows-system', 'msvc-runtime']),
  linux: new Set(['linux-glibc', 'linux-system']),
};

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `: ${detail}` : ''}`);
}

export function validateManifest(manifest, target, options = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('BLUE_ENGINE_MANIFEST_INVALID');
  if (manifest.schemaVersion !== 1) fail('BLUE_ENGINE_MANIFEST_SCHEMA');
  if (manifest.engineVersion !== '0.1.0') fail('BLUE_ENGINE_VERSION_MISMATCH');
  if (manifest.protocolVersion !== protocolVersion) fail('BLUE_ENGINE_PROTOCOL_MISMATCH');
  if (manifest.platform !== target.platform || manifest.arch !== target.arch) fail('BLUE_ENGINE_TARGET_MISMATCH');
  if (manifest.executableName !== target.executableName) fail('BLUE_ENGINE_EXECUTABLE_NAME_MISMATCH');
  if (manifest.buildType !== 'Release') fail('BLUE_ENGINE_BUILD_TYPE_INVALID');
  if (manifest.vcpkgBaseline !== vcpkgBaseline) fail('BLUE_ENGINE_VCPKG_BASELINE_MISMATCH');
  if (manifest.vcpkgTriplet !== target.triplet) fail('BLUE_ENGINE_VCPKG_TRIPLET_MISMATCH');
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256 ?? '')) fail('BLUE_ENGINE_SHA256_INVALID');
  if (typeof manifest.sourceRevision !== 'string' || manifest.sourceRevision.length === 0) {
    fail('BLUE_ENGINE_SOURCE_REVISION_INVALID');
  }
  const allowlist = manifest.allowedExternalDependencies;
  const expected = allowedExternalDependencies[target.platform];
  if (!Array.isArray(allowlist) || allowlist.some((value) => !expected.has(value)) || allowlist.length !== expected.size) {
    fail('BLUE_ENGINE_EXTERNAL_ALLOWLIST_INVALID');
  }
  if (options.ci) {
    if (manifest.sourceRevision.startsWith('dirty:')) fail('BLUE_ENGINE_DIRTY_CI_REVISION');
    if (options.expectedRevision && manifest.sourceRevision !== options.expectedRevision) {
      fail('BLUE_ENGINE_SOURCE_REVISION_MISMATCH');
    }
  }
  return manifest;
}

export function inspectDependencyReport(platform, report) {
  const lower = report.toLowerCase();
  for (const dependency of ['libzmq', 'libsodium', 'csound']) {
    if (lower.includes(dependency)) fail('BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY', dependency);
  }
  if (platform === 'darwin') {
    const dependencies = report
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+\(/)[0])
      .filter(Boolean);
    const invalid = dependencies.find(
      (dependency) =>
        !dependency.startsWith('/System/Library/') &&
        !dependency.startsWith('/usr/lib/'),
    );
    if (invalid) fail('BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY', invalid);
  }
  if (platform === 'linux') {
    if (/=>\s+not found/.test(lower)) {
      fail('BLUE_ENGINE_SHARED_DEPENDENCY_MISSING');
    }
    const allowed = /^(linux-vdso|lib(c|m|pthread|dl|rt|stdc\+\+|gcc_s)\.so|ld-linux|\/lib|\/usr\/lib)/;
    const dependencies = report.includes('(NEEDED)')
      ? [...report.matchAll(/\(NEEDED\).*\[([^\]]+)\]/g)].map((match) => match[1])
      : report
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+=>|\s+\(/)[0].trim());
    const invalid = dependencies.find((dependency) => dependency && !allowed.test(dependency));
    if (invalid) fail('BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY', invalid);
  }
  if (platform === 'win32') {
    const allowed = /^(api-ms-win-|ext-ms-win-|kernel32|user32|advapi32|ws2_32|iphlpapi|shell32|ole32|oleaut32|bcrypt|ntdll|msvcp1\d\d|vcruntime1\d\d|ucrtbase)\.dll$/i;
    const invalid = report
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /\.dll$/i.test(line))
      .find((dependency) => !allowed.test(dependency));
    if (invalid) fail('BLUE_ENGINE_UNEXPECTED_SHARED_DEPENDENCY', invalid);
  }
  return true;
}

export function inspectArchitectureReport(report, target) {
  const expected = target.arch === 'x64' ? /(x86_64|x86-64|amd64|machine \(x64\))/i : /arm64|aarch64/i;
  if (!expected.test(report)) fail('BLUE_ENGINE_ARCHITECTURE_MISMATCH', report.trim());
  return true;
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function inspectGlibcVersionReport(report, maximumVersion = '2.35') {
  const versions = [...report.matchAll(/GLIBC_(\d+(?:\.\d+)+)/g)].map((match) => match[1]);
  const required = versions.sort(compareVersions).at(-1) ?? '0';
  if (compareVersions(required, maximumVersion) > 0) {
    fail('BLUE_ENGINE_GLIBC_FLOOR_EXCEEDED', `requires ${required}, maximum ${maximumVersion}`);
  }
  return required;
}

function inspectArchitecture(executablePath, target) {
  const output = execFileSync('file', [executablePath], { encoding: 'utf8' });
  inspectArchitectureReport(output, target);
}

function inspectDependencies(executablePath, target) {
  if (target.platform === 'darwin') {
    inspectDependencyReport('darwin', execFileSync('otool', ['-L', executablePath], { encoding: 'utf8' }));
    return;
  }
  if (target.platform === 'linux') {
    inspectDependencyReport(
      'linux',
      execFileSync('readelf', ['-d', executablePath], { encoding: 'utf8' }),
    );
    inspectDependencyReport('linux', execFileSync('ldd', [executablePath], { encoding: 'utf8' }));
    const floor = inspectGlibcVersionReport(
      execFileSync('readelf', ['--version-info', executablePath], { encoding: 'utf8' }),
    );
    process.stderr.write(`[blue-engine] required glibc symbol floor: ${floor}\n`);
    return;
  }
  try {
    inspectDependencyReport('win32', execFileSync('dumpbin', ['/dependents', executablePath], { encoding: 'utf8' }));
  } catch (error) {
    if (process.env.CI) throw error;
    process.stderr.write('[blue-engine] dumpbin unavailable; skipped PE dependency inspection\n');
  }
}

export async function verifyArtifact({
  target = resolveTarget(),
  artifactDir = join(packageRoot, 'dist', target.key),
  ci = process.env.CI === 'true',
  inspectBinary = true,
} = {}) {
  const manifestPath = join(artifactDir, 'artifact.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const expectedRevision = ci ? sourceRevision() : undefined;
  validateManifest(manifest, target, { ci, expectedRevision });

  const executablePath = join(artifactDir, manifest.executableName);
  const executableStat = await stat(executablePath);
  if (!executableStat.isFile()) fail('BLUE_ENGINE_EXECUTABLE_INVALID');
  await access(executablePath, target.platform === 'win32' ? constants.R_OK : constants.X_OK);
  if ((await sha256File(executablePath)) !== manifest.sha256) fail('BLUE_ENGINE_HASH_MISMATCH');

  if (inspectBinary) {
    inspectArchitecture(executablePath, target);
    inspectDependencies(executablePath, target);
  }
  return { manifest, executablePath, manifestPath };
}

if (process.argv[1] && process.argv[1].endsWith('verify-artifact.mjs')) {
  const target = parseTargetArgs();
  const result = await verifyArtifact({ target });
  process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
}
