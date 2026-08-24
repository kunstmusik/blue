import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('managed Csound execution boundary', () => {
  it('does not launch a configured Csound executable or shell -U from trusted callers', async () => {
    const sources = await Promise.all([
      readFile(path.join(__dirname, 'main.ts'), 'utf8'),
      readFile(path.join(__dirname, 'ipc', 'project-artifacts-ipc.ts'), 'utf8'),
      readFile(path.join(__dirname, 'ipc', 'playback-runtime-ipc.ts'), 'utf8'),
      readFile(path.join(__dirname, 'render-to-disk.ts'), 'utf8'),
      readFile(path.join(__dirname, 'freeze-score-objects.ts'), 'utf8'),
      readFile(path.join(__dirname, 'soundfont-viewer.ts'), 'utf8'),
    ]);
    const production = sources.join('\n');
    expect(production).not.toMatch(/spawn\(executable,\s*args/u);
    expect(production).not.toMatch(/execFile\(.*csoundExecutable/u);
    expect(production).not.toMatch(/(?:^|['" ])-U(?:['" ]|$)/u);
  });
});
