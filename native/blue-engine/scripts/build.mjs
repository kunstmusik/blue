import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { packageRoot, sourceRevision, stageArtifact } from './artifact.mjs';
import { resetBuildDirectoryForToolchainChange } from './cmake-toolchain.mjs';
import { parseTargetArgs } from './target.mjs';
import { resolveVcpkgRoot } from './vcpkg.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `BLUE_ENGINE_BUILD_FAILED: ${command} exited with ${result.status ?? 'no status'}`,
    );
  }
}

const target = parseTargetArgs();
const buildTypeIndex = process.argv.indexOf('--build-type');
const buildType = buildTypeIndex === -1 ? 'Release' : process.argv[buildTypeIndex + 1];
const tracking = process.argv.includes('--performance-tracking');
const noStage = process.argv.includes('--no-stage');
const vcpkgRoot = await resolveVcpkgRoot();

const suffix = tracking ? '-profiling' : '';
const buildDir = join(packageRoot, `build-${target.key}-${buildType.toLowerCase()}${suffix}`);
const toolchainFile = join(vcpkgRoot, 'scripts', 'buildsystems', 'vcpkg.cmake');
if (await resetBuildDirectoryForToolchainChange(buildDir, toolchainFile)) {
  process.stdout.write(
    'Blue Engine: removed stale CMake build cache after vcpkg toolchain changed\n',
  );
}
const configureArgs = [
  '-S',
  packageRoot,
  '-B',
  buildDir,
  `-DCMAKE_BUILD_TYPE=${buildType}`,
  `-DCMAKE_TOOLCHAIN_FILE=${toolchainFile}`,
  `-DVCPKG_TARGET_TRIPLET=${target.triplet}`,
  `-DVCPKG_OVERLAY_TRIPLETS=${join(packageRoot, 'triplets')}`,
  '-DBUILD_EXAMPLES=OFF',
  `-DUSE_PERFORMANCE_TRACKING=${tracking ? 'ON' : 'OFF'}`,
  `-DBLUE_ENGINE_SOURCE_REVISION=${sourceRevision()}`,
];
if (target.platform === 'darwin') {
  configureArgs.push(`-DCMAKE_OSX_ARCHITECTURES=${target.arch === 'arm64' ? 'arm64' : 'x86_64'}`);
}

run('cmake', configureArgs);
run('cmake', ['--build', buildDir, '--target', 'blue-engine', '--config', buildType, '--parallel']);

const executable = join(
  buildDir,
  target.platform === 'win32' ? buildType : '',
  target.executableName,
);
await access(executable, constants.X_OK);
if (!noStage && buildType === 'Release' && !tracking) {
  const artifact = await stageArtifact({ target, builtExecutable: executable, buildType });
  process.stdout.write(`${artifact.executablePath}\n`);
}
