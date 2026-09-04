import process from 'node:process';

const supportedTargets = new Map([
  [
    'darwin-arm64',
    { platform: 'darwin', arch: 'arm64', triplet: 'blue-arm64-osx', preset: 'macos-arm64' },
  ],
  ['darwin-x64', { platform: 'darwin', arch: 'x64', triplet: 'blue-x64-osx', preset: 'macos-x64' }],
  [
    'win32-x64',
    { platform: 'win32', arch: 'x64', triplet: 'blue-x64-windows', preset: 'windows-x64' },
  ],
  ['linux-x64', { platform: 'linux', arch: 'x64', triplet: 'blue-x64-linux', preset: 'linux-x64' }],
]);

export function resolveTarget(platform = process.platform, arch = process.arch) {
  const target = supportedTargets.get(`${platform}-${arch}`);
  if (!target) {
    throw new Error(`BLUE_ENGINE_UNSUPPORTED_TARGET: ${platform}-${arch}`);
  }
  return {
    ...target,
    key: `${platform}-${arch}`,
    executableName: platform === 'win32' ? 'blue-engine.exe' : 'blue-engine',
  };
}

export function parseTargetArgs(args = process.argv.slice(2)) {
  const targetIndex = args.indexOf('--target');
  if (targetIndex === -1) {
    return resolveTarget();
  }
  const value = args[targetIndex + 1];
  if (!value || !value.includes('-')) {
    throw new Error('BLUE_ENGINE_INVALID_TARGET: expected --target <platform>-<arch>');
  }
  const separator = value.lastIndexOf('-');
  return resolveTarget(value.slice(0, separator), value.slice(separator + 1));
}

export const supportedTargetKeys = Object.freeze([...supportedTargets.keys()]);
