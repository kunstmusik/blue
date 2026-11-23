import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_PREFIX } from './docs-site-catalog.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(join(repositoryRoot, 'packages/blue-app/package.json'));

export const DOCS_SITE_ROOT = resolve(
  process.env.BLUE_DOCS_SITE_ROOT ?? join(repositoryRoot, 'build/docs-site'),
);
export const { chromium } = require('playwright');
export { SITE_PREFIX };

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

/** Serve a built Pages artifact beneath its real `/blue/` public prefix. */
export async function startSiteServer(root = DOCS_SITE_ROOT) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      if (pathname !== '/blue' && !pathname.startsWith(SITE_PREFIX)) {
        response.writeHead(404).end();
        return;
      }
      const segments = pathname
        .slice(SITE_PREFIX.length)
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
      if (
        segments.some((segment) => segment === '.' || segment === '..' || /[\\/\0]/.test(segment))
      ) {
        response.writeHead(400).end();
        return;
      }

      let filePath = resolve(root, ...segments);
      const relativePath = relative(root, filePath);
      if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
        response.writeHead(400).end();
        return;
      }
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': fileInfo.size,
        'Content-Type':
          contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 400).end();
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      ),
  };
}
