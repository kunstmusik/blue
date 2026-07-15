import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createVerifiedRepositoryBackup, verifyRepositoryBackup } from './recovery';
import { UnifiedLibraryRepository } from './repository';

describe('schema upgrade backup', () => {
  it('creates and verifies an online backup while preserving the original', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-schema-backup-'));
    const databasePath = path.join(directory, 'library.sqlite');
    UnifiedLibraryRepository.open(databasePath).close();
    const before = fs.readFileSync(databasePath);
    const backupPath = path.join(directory, 'library.backup.sqlite');
    await createVerifiedRepositoryBackup(databasePath, backupPath);
    expect(await verifyRepositoryBackup(backupPath)).toBe(true);
    expect(fs.readFileSync(databasePath)).toEqual(before);
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
