import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Csound runtime preload boundary', () => {
  it('exposes only the narrow discovery method', async () => {
    const source = await readFile(path.join(__dirname, 'preload.ts'), 'utf8');
    expect(source).toContain("ipcRenderer.invoke('engine-runtime:query-csound-io'");
    expect(source).not.toMatch(/runUtility|runCsound|executeCsound/u);
    expect(source).not.toContain('csoundExecutable');
  });
});
