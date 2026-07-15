import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { classifyRepositoryFailure } from './recovery';
import { UnifiedLibraryRepository } from './repository';

describe('repository open recovery classification', () => {
  it('classifies newer versions, integrity failures, locks, and worker exits', () => {
    expect(classifyRepositoryFailure(new Error('Unsupported newer Unified Library schema version: 99')).kind).toBe('version');
    expect(classifyRepositoryFailure(new Error('database disk image is malformed')).kind).toBe('integrity');
    expect(classifyRepositoryFailure(new Error('database is locked')).kind).toBe('lock');
    expect(classifyRepositoryFailure(new Error('repository worker exited with 1')).kind).toBe('worker');
  });

  it('rejects a newer user_version without modifying it', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-repository-version-'));
    const databasePath = path.join(directory, 'library.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 99');
    database.close();
    expect(() => UnifiedLibraryRepository.open(databasePath)).toThrow(/newer/i);
    const verify = new DatabaseSync(databasePath);
    expect(Number(Object.values(verify.prepare('PRAGMA user_version').get()!)[0])).toBe(99);
    verify.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
