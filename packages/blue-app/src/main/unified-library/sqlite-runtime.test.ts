import { spawnSync } from 'node:child_process';
import electronPath from 'electron';
import { describe, expect, it } from 'vitest';

const EXPECTED_ELECTRON_VERSION = '35.7.5';
const EXPECTED_NODE_VERSION = '22.16.0';
const EXPECTED_SQLITE_VERSION = '3.49.1';

interface ElectronRuntimeSnapshot {
  electron: string;
  node: string;
  sqlite: string;
  hasDatabaseSync: boolean;
  hasBackup: boolean;
}

function readElectronRuntimeSnapshot(): ElectronRuntimeSnapshot {
  const electronExecutablePath = electronPath as unknown as string;
  const script = [
    "import * as sqlite from 'node:sqlite';",
    'process.stdout.write(JSON.stringify({',
    'electron: process.versions.electron,',
    'node: process.versions.node,',
    'sqlite: process.versions.sqlite,',
    "hasDatabaseSync: typeof sqlite.DatabaseSync === 'function',",
    "hasBackup: typeof sqlite.backup === 'function',",
    '}));',
  ].join('');

  const result = spawnSync(electronExecutablePath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `Electron runtime probe exited with ${result.status}`);
  }

  return JSON.parse(result.stdout) as ElectronRuntimeSnapshot;
}

describe('pinned Electron SQLite runtime', () => {
  it('exposes the exact runtime and SQLite API used by Unified Libraries', () => {
    const snapshot = readElectronRuntimeSnapshot();

    expect(snapshot).toEqual({
      electron: EXPECTED_ELECTRON_VERSION,
      node: EXPECTED_NODE_VERSION,
      sqlite: EXPECTED_SQLITE_VERSION,
      hasDatabaseSync: true,
      hasBackup: true,
    });
  });
});
