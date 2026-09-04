import { readFile } from 'node:fs/promises';
import { packageRoot, vcpkgBaseline } from './artifact.mjs';
import { supportedTargetKeys } from './target.mjs';

const manifest = JSON.parse(await readFile(new URL('../vcpkg.json', import.meta.url), 'utf8'));
const configuration = JSON.parse(
  await readFile(new URL('../vcpkg-configuration.json', import.meta.url), 'utf8'),
);
if (
  manifest['builtin-baseline'] !== vcpkgBaseline ||
  configuration['default-registry']?.baseline !== vcpkgBaseline
) {
  throw new Error('BLUE_ENGINE_VCPKG_BASELINE_MISMATCH');
}
if (!manifest.dependencies?.includes('zeromq')) {
  throw new Error('BLUE_ENGINE_ZEROMQ_MANIFEST_MISSING');
}
if (supportedTargetKeys.length !== 4) {
  throw new Error('BLUE_ENGINE_TARGET_MATRIX_INVALID');
}
process.stdout.write(`validated ${packageRoot}\n`);
