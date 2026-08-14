import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(packageRoot, '../..');
export const protocolVersion = 2;
export const vcpkgBaseline = '9d7f79f56ae1a9b4704d6a7fb8237e347a974133';

const externalDependencies = {
  darwin: ['macos-system'],
  win32: ['windows-system', 'msvc-runtime'],
  linux: ['linux-glibc', 'linux-system'],
};

export async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

export function sourceRevision() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const dirty = execFileSync(
    'git',
    ['status', '--porcelain', '--', 'native/blue-engine', 'packages/blue-engine-client'],
    {
    cwd: repoRoot,
    encoding: 'utf8',
    },
  ).trim();
  return dirty ? `dirty:${revision}` : revision;
}

export async function stageArtifact({ target, builtExecutable, buildType = 'Release' }) {
  const outputDir = join(packageRoot, 'dist', target.key);
  const executablePath = join(outputDir, target.executableName);
  await mkdir(outputDir, { recursive: true });
  await copyFile(builtExecutable, executablePath);
  if (target.platform !== 'win32') {
    await chmod(executablePath, 0o755);
  }

  const manifest = {
    schemaVersion: 1,
    engineVersion: '0.1.0',
    protocolVersion,
    sourceRevision: sourceRevision(),
    platform: target.platform,
    arch: target.arch,
    executableName: target.executableName,
    sha256: await sha256File(executablePath),
    buildType,
    vcpkgBaseline,
    vcpkgTriplet: target.triplet,
    allowedExternalDependencies: externalDependencies[target.platform],
  };
  await writeFile(join(outputDir, 'artifact.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputDir, executablePath, manifest };
}
