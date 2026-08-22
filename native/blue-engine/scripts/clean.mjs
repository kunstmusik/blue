import { readdir, rm } from 'node:fs/promises';
import { packageRoot } from './artifact.mjs';

for (const name of await readdir(packageRoot)) {
  if (name === 'dist' || name === 'vcpkg_installed' || name === 'downloads' || name.startsWith('build-')) {
    await rm(new URL(`../${name}`, import.meta.url), { recursive: true, force: true });
  }
}
