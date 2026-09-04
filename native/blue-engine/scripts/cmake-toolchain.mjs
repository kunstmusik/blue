import { access, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function cachedToolchain(cache) {
  return cache.match(/^CMAKE_TOOLCHAIN_FILE(?::[^=]*)?=(.+)$/m)?.[1]?.trim() ?? null;
}

function includedToolchain(system) {
  return (
    system
      .match(/include\(["']?([^"')\r\n]*scripts[\\/]buildsystems[\\/]vcpkg\.cmake)/)?.[1]
      ?.trim() ?? null
  );
}

export async function resetBuildDirectoryForToolchainChange(buildDir, desiredToolchain) {
  const cache = await readText(join(buildDir, 'CMakeCache.txt'));
  if (cache === null) return false;

  const configuredToolchains = [];
  const cached = cachedToolchain(cache);
  if (cached) configuredToolchains.push(cached);

  const cmakeFilesDir = join(buildDir, 'CMakeFiles');
  let versionDirectories = [];
  try {
    versionDirectories = (await readdir(cmakeFilesDir, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory(),
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  for (const directory of versionDirectories) {
    const system = await readText(join(cmakeFilesDir, directory.name, 'CMakeSystem.cmake'));
    const included = system ? includedToolchain(system) : null;
    if (included) configuredToolchains.push(included);
  }

  const desired = resolve(desiredToolchain);
  let stale = configuredToolchains.length === 0;
  for (const configured of configuredToolchains) {
    if (resolve(configured) !== desired) {
      stale = true;
      break;
    }
    try {
      await access(configured);
    } catch {
      stale = true;
      break;
    }
  }

  if (!stale) return false;
  await rm(buildDir, { recursive: true, force: true });
  return true;
}
