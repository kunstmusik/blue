import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default async function signBlueEngine(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const productName = context.packager.appInfo.productFilename;
  const enginePath = join(
    context.appOutDir,
    `${productName}.app`,
    'Contents',
    'Resources',
    'assets',
    'engine',
    'blue-engine',
  );
  if (!existsSync(enginePath)) {
    throw new Error(`BLUE_ENGINE_SIGNING_INPUT_MISSING: ${enginePath}`);
  }
  chmodSync(enginePath, 0o755);

  const identity = process.env.BLUE_MAC_SIGN_IDENTITY?.trim();
  if (!identity) {
    process.stderr.write('[blue-engine] macOS signing identity not configured; verified nested executable layout only\n');
    return;
  }
  const entitlements = join(appRoot, 'build', 'entitlements.blue-engine.mac.plist');
  execFileSync('/usr/bin/codesign', [
    '--force',
    '--timestamp',
    '--options',
    'runtime',
    '--entitlements',
    entitlements,
    '--sign',
    identity,
    enginePath,
  ], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', enginePath], {
    stdio: 'inherit',
  });
}
