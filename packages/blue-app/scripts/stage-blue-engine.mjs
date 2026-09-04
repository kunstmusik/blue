#!/usr/bin/env node
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyArtifact } from '../../../native/blue-engine/scripts/verify-artifact.mjs';
import { parseTargetArgs } from '../../../native/blue-engine/scripts/target.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stageRoot = join(appRoot, '.engine-stage');

export async function stageBlueEngine({
  target = parseTargetArgs([]),
  destination = stageRoot,
  verify = verifyArtifact,
} = {}) {
  const verified = await verify({ target });
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(verified.executablePath, join(destination, verified.manifest.executableName));
  await cp(verified.manifestPath, join(destination, 'artifact.json'));

  const entries = (await readdir(destination)).sort();
  const expected = ['artifact.json', verified.manifest.executableName].sort();
  if (
    entries.length !== expected.length ||
    entries.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error(
      `BLUE_ENGINE_STAGE_INVALID: expected ${expected.join(', ')}, found ${entries.join(', ')}`,
    );
  }
  return {
    destination,
    executablePath: join(destination, verified.manifest.executableName),
    manifestPath: join(destination, 'artifact.json'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const staged = await stageBlueEngine({ target: parseTargetArgs() });
  process.stdout.write(`${staged.executablePath}\n`);
}
