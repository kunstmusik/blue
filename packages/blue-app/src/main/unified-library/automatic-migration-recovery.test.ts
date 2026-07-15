import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { LibraryMigrationStateStore } from './migration-state-store';
import { UnifiedLibraryImportExportService } from './import-export-service';

const directories: string[] = [];
function directory(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-auto-recovery-'));
  directories.push(value);
  return value;
}
afterEach(() => {
  for (const value of directories.splice(0)) fs.rmSync(value, { recursive: true, force: true });
});

describe('automatic migration recovery policy', () => {
  it('reports a corrupt primary and adjacent backup without silently substituting it', async () => {
    const config = directory();
    const primary = path.join(config, 'udoLibrary.xml');
    const backup = `${primary}~`;
    fs.writeFileSync(primary, '<udoLibrary><broken>', 'utf8');
    fs.writeFileSync(backup, '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"/></udoLibrary>', 'utf8');
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      const source = report.sources.find((entry) => entry.libraryType === 'udo');
      expect(source).toMatchObject({ status: 'failed', backupAvailable: true });
      expect((await client.getSnapshot()).itemCounts.udo).toBe(0);
      expect(state.load().legacyMigrationState).toBe('failed');
      const second = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(second.message).toMatch(/already attempted/i);
    } finally { await client.close(); }
  });
});
