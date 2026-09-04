import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('library service recovery', () => {
  it('creates a fresh database only after preserving an unusable original', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-service-recovery-'));
    const databasePath = path.join(directory, 'blue_libraries.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 99');
    database.close();
    const service = new UnifiedLibraryService(
      databasePath,
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    try {
      expect((await service.start()).phase).toBe('readOnlyFailure');
      const recovered = await service.createFreshRecoveryDatabase();
      expect(recovered).toMatchObject({ ok: true, value: { phase: 'ready', writable: true } });
      expect(
        fs.readdirSync(directory).some((name) => name.startsWith('blue_libraries.sqlite.failed-')),
      ).toBe(true);
    } finally {
      await service.stop();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
