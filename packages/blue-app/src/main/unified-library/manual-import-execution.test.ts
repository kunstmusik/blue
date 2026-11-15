import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryImportExportService } from './import-export-service';

const XML =
  '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"><udo><opcodeName>tone</opcodeName><outTypes>a</outTypes><inTypes>ak</inTypes><codeBody>aout tone ain,k</codeBody><comments/></udo></udoCategory></udoLibrary>';

describe('manual import execution', () => {
  it('rejects a source changed after preview before writing any library items', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-execute-'));
    const sourcePath = path.join(directory, 'udoLibrary.xml');
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    const service = new UnifiedLibraryImportExportService(client);
    try {
      fs.writeFileSync(sourcePath, XML, 'utf8');
      const { previewToken } = await service.previewManualImport([sourcePath]);
      fs.writeFileSync(sourcePath, XML.replace('>tone<', '>ring<'), 'utf8');

      await expect(service.executeManualImport(previewToken)).rejects.toThrow(
        'Import source changed after preview',
      );
      expect((await client.getSnapshot()).itemCounts.udo).toBe(0);
    } finally {
      service.dispose();
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('skips exact duplicates, records lineage, and conditionally undoes additive batches', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-execute-'));
    const sourcePath = path.join(directory, 'udoLibrary.xml');
    fs.writeFileSync(sourcePath, XML, 'utf8');
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const service = new UnifiedLibraryImportExportService(client);
      const first = await service.executeManualImport(
        (await service.previewManualImport([sourcePath])).previewToken,
      );
      expect(first.status).toBe('completed');
      const second = await service.executeManualImport(
        (await service.previewManualImport([sourcePath])).previewToken,
      );
      expect(second.exactDuplicateCount).toBe(1);
      expect((await client.getSnapshot()).itemCounts.udo).toBe(1);
      await service.undoManualImport(first.batchId);
      expect((await client.getSnapshot()).itemCounts.udo).toBe(0);
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
