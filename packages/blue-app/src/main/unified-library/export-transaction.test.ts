import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitAtomicExport } from './import-export-service';

describe('atomic export transaction', () => {
  it('restores every prior target after an injected later promotion failure', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-export-transaction-'));
    const first = path.join(directory, 'a.xml');
    const second = path.join(directory, 'b.xml');
    fs.writeFileSync(first, 'old-a', 'utf8');
    fs.writeFileSync(second, 'old-b', 'utf8');
    try {
      expect(() => commitAtomicExport([
        { targetPath: first, contents: 'new-a' },
        { targetPath: second, contents: 'new-b' },
      ], { failAfterPromotions: 1 })).toThrow(/injected/i);
      expect(fs.readFileSync(first, 'utf8')).toBe('old-a');
      expect(fs.readFileSync(second, 'utf8')).toBe('old-b');
      expect(fs.readdirSync(directory).sort()).toEqual(['a.xml', 'b.xml']);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
