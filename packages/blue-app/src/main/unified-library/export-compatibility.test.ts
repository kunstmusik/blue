import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLegacyLibraryDocument } from '@blue/data';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryImportExportService } from './import-export-service';

describe('legacy export compatibility', () => {
  it('exports all four roots and preserves unsupported payload XML exactly', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-export-compat-'));
    const sourcePath = path.join(directory, 'soundObjectLibrary.xml');
    const raw = '<soundObject type="future.Unknown"><name>Raw</name><!--keep--><plugin><![CDATA[data()]]></plugin></soundObject>';
    fs.writeFileSync(sourcePath, `<soundObjectLibrary><category categoryName="SoundObject Library">${raw}</category></soundObjectLibrary>`, 'utf8');
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const service = new UnifiedLibraryImportExportService(client);
      await service.executeManualImport((await service.previewManualImport([sourcePath])).previewToken);
      const output = path.join(directory, 'out');
      await service.exportAll(output);
      const exported = fs.readFileSync(path.join(output, 'soundObjectLibrary.xml'), 'utf8');
      expect(exported).toContain(raw);
      expect(parseLegacyLibraryDocument(exported).itemCount).toBe(1);
      expect(fs.readdirSync(output).sort()).toEqual(['effectsLibrary.xml', 'soundObjectLibrary.xml', 'udoLibrary.xml', 'userInstrumentLibrary.xml']);
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
