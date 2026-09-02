import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outFile = path.join(rootDir, 'dist', 'blue-cli.cjs');

fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
fs.mkdirSync(path.dirname(outFile), { recursive: true });

await build({
  entryPoints: [path.join(rootDir, 'src', 'cli.ts')],
  bundle: true,
  platform: 'node',
  target: ['node20'],
  format: 'cjs',
  outfile: outFile,
  nodePaths: [
    path.resolve(rootDir, 'node_modules'),
    path.resolve(rootDir, '../blue-data/node_modules'),
    path.resolve(rootDir, '../../node_modules'),
  ],
  // quickjs-emscripten must be externalized from the bundle and listed in
  // package.json dependencies so standalone CLI installations can resolve it at runtime.
  external: ['quickjs-emscripten'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  sourcemap: true,
  tsconfig: path.join(rootDir, 'tsconfig.json'),
});

fs.chmodSync(outFile, 0o755);
