import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { packageRoot, vcpkgBaseline } from './artifact.mjs';

const vcpkgRepository = 'https://github.com/microsoft/vcpkg.git';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `BLUE_ENGINE_VCPKG_BOOTSTRAP_FAILED: ${command} exited with ${result.status ?? 'no status'}`,
    );
  }
}

function toolPaths(root) {
  return {
    executable: join(root, process.platform === 'win32' ? 'vcpkg.exe' : 'vcpkg'),
    toolchain: join(root, 'scripts', 'buildsystems', 'vcpkg.cmake'),
  };
}

async function validateCheckout(root) {
  const paths = toolPaths(root);
  await access(paths.toolchain, constants.R_OK);
  await access(paths.executable, constants.F_OK);
}

async function bootstrapPinnedVcpkg(root) {
  const temporaryRoot = `${root}.tmp-${process.pid}`;
  await mkdir(dirname(root), { recursive: true });
  await rm(temporaryRoot, { recursive: true, force: true });

  try {
    run('git', ['clone', '--filter=blob:none', '--no-checkout', vcpkgRepository, temporaryRoot]);
    run('git', ['-C', temporaryRoot, 'checkout', '--detach', vcpkgBaseline]);

    if (process.platform === 'win32') {
      run('cmd.exe', [
        '/d',
        '/s',
        '/c',
        join(temporaryRoot, 'bootstrap-vcpkg.bat'),
        '-disableMetrics',
      ]);
    } else {
      run(join(temporaryRoot, 'bootstrap-vcpkg.sh'), ['-disableMetrics']);
    }

    try {
      await rename(temporaryRoot, root);
    } catch (error) {
      // Another build may have completed the same bootstrap concurrently.
      await validateCheckout(root).catch(() => {
        throw error;
      });
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function resolveVcpkgRoot({
  env = process.env,
  root = packageRoot,
  bootstrap = bootstrapPinnedVcpkg,
} = {}) {
  const explicitRoot = env.VCPKG_ROOT?.trim();
  const resolvedRoot = explicitRoot
    ? resolve(explicitRoot)
    : join(root, '.vcpkg');

  try {
    await validateCheckout(resolvedRoot);
    return resolvedRoot;
  } catch (error) {
    if (explicitRoot) {
      throw new Error(
        `BLUE_ENGINE_VCPKG_ROOT_INVALID: bootstrap the pinned vcpkg checkout at ${resolvedRoot}`,
        { cause: error },
      );
    }
  }

  process.stdout.write(
    `Blue Engine: bootstrapping pinned vcpkg ${vcpkgBaseline} (first build only)\n`,
  );
  await bootstrap(resolvedRoot);
  await validateCheckout(resolvedRoot);
  return resolvedRoot;
}
