import { access, lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_PREFIX } from './docs-site-catalog.mjs';

const buildRoot = fileURLToPath(new URL('../build/', import.meta.url));
const site = join(buildRoot, 'docs-site');
const preview = join(buildRoot, 'docs-site-preview');
const mount = join(preview, SITE_PREFIX.slice(1, -1));

await access(join(site, 'index.html')).catch((cause) => {
  throw new Error('Run pnpm site:package to build the documentation site first.', { cause });
});
await mkdir(preview, { recursive: true });
try {
  await symlink(site, mount, process.platform === 'win32' ? 'junction' : 'dir');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  if (
    !(await lstat(mount)).isSymbolicLink() ||
    (await realpath(mount)) !== (await realpath(site))
  ) {
    throw new Error(`Preview path already exists and points elsewhere: ${mount}`);
  }
}

console.log(`Preview the documentation at http://127.0.0.1:8000${SITE_PREFIX}`);
