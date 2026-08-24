import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Csound runtime IPC boundary', () => {
  it('registers discovery without exposing a generic execution channel', async () => {
    const sources = await Promise.all([
      readFile(path.join(__dirname, 'main.ts'), 'utf8'),
      readFile(path.join(__dirname, 'ipc', 'playback-runtime-ipc.ts'), 'utf8'),
    ]);
    const source = sources.join('\n');
    expect(source).toContain("'engine-runtime:query-csound-io'");
    expect(source).toContain('engineRuntimeService.queryCsoundIo');
    expect(source).not.toMatch(/(?:ipcMain|ipcRegistration)\.handle\(\s*['"]engine-runtime:(?:run|execute)/u);
  });
});
