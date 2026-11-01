import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  external: ['quickjs-emscripten', 'zeromq'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  sourcemap: true,
  tsconfig: path.join(rootDir, 'tsconfig.json'),
});

fs.chmodSync(outFile, 0o755);

const javaRoot = path.resolve(rootDir, '../blue-java');
execFileSync(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', ['-q', '-DskipTests', 'package'], {
  cwd: javaRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const runtimeRoot = path.join(rootDir, 'dist/java');
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.copyFileSync(
  path.join(javaRoot, 'target/blue-java.jar'),
  path.join(runtimeRoot, 'blue-java.jar'),
);
fs.cpSync(
  path.join(javaRoot, 'src/main/resources/jython/pythonLib'),
  path.join(runtimeRoot, 'pythonLib'),
  { recursive: true },
);
fs.cpSync(path.resolve(rootDir, '../../LICENSES'), path.join(runtimeRoot, 'licenses'), {
  recursive: true,
});
fs.cpSync(path.join(javaRoot, 'src/main/java'), path.join(runtimeRoot, 'source/java'), {
  recursive: true,
});
fs.copyFileSync(path.join(javaRoot, 'pom.xml'), path.join(runtimeRoot, 'source/pom.xml'));
const notices = fs
  .readFileSync(path.resolve(rootDir, '../blue-app/assets/java/THIRD_PARTY_NOTICES.md'), 'utf8')
  .replaceAll('../../licenses/', 'licenses/')
  .replace(
    "Full Java dependency license texts are in the installed application's `Resources/licenses/` directory.",
    'Full Java dependency license texts are in the adjacent licenses directory. Blue helper Java source and Maven dependency coordinates are in source/.',
  );
fs.writeFileSync(path.join(runtimeRoot, 'THIRD_PARTY_NOTICES.md'), notices);

const attributionRoot = path.join(rootDir, 'dist/attribution');
fs.mkdirSync(attributionRoot, { recursive: true });
fs.copyFileSync(
  path.resolve(rootDir, '../blue-data/THIRD_PARTY_NOTICES.md'),
  path.join(attributionRoot, 'blue-data.md'),
);
fs.copyFileSync(
  path.resolve(rootDir, '../blue-data/resources/blue-x7-modern/ATTRIBUTION.md'),
  path.join(attributionRoot, 'blue-x7-msfa.md'),
);
