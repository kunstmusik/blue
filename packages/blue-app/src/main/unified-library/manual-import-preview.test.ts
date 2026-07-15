import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryImportExportService } from './import-export-service';

describe('manual import preview', () => {
  it('reports hashes, recognized type, unsupported payloads, and stale source tokens', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-preview-'));
    const sourcePath = path.join(directory, 'soundObjectLibrary.xml');
    fs.writeFileSync(sourcePath, '<soundObjectLibrary><category categoryName="SoundObject Library"><soundObject type="future.Unknown"><name>Keep Raw</name><plugin>data</plugin></soundObject></category></soundObjectLibrary>', 'utf8');
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const service = new UnifiedLibraryImportExportService(client);
      const preview = await service.previewManualImport([sourcePath]);
      expect(preview.sources[0]).toMatchObject({ libraryType: 'soundObject', itemCount: 1, unsupportedCount: 1 });
      expect(preview.sources[0]?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      fs.appendFileSync(sourcePath, ' ');
      await expect(service.executeManualImport(preview.previewToken)).rejects.toThrow(/changed/i);
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
