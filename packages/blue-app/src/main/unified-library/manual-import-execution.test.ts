import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { parseLegacyLibraryDocument } from '@blue/data';
import {
  createLegacyLibraryStream,
  UnifiedLibraryImportExportService,
} from './import-export-service';

const XML =
  '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"><udo><opcodeName>tone</opcodeName><outTypes>a</outTypes><inTypes>ak</inTypes><codeBody>aout tone ain,k</codeBody><comments/></udo></udoCategory></udoLibrary>';

describe('streaming legacy import', () => {
  const source = { kind: 'library' as const, label: 'stream fixture' };

  it('matches the full parser across chunk boundaries and retains verbatim resource XML', () => {
    const raw =
      '<soundObject type="future.Sound"><name><![CDATA[Café 🎵]]></name><!-- keep <this> --><future attr=">"/></soundObject>';
    const xml =
      '\uFEFF<?xml version="1.0"?>\r\n<soundObjectLibrary><category categoryName="A &amp; B">\r\n<category categoryName="Inner">' +
      raw +
      '</category><soundObject type="future.Empty"/></category></soundObjectLibrary>\r\n';
    const expected = parseLegacyLibraryDocument(xml, source);
    for (const size of [1, 2, 7, 32, 64, 4096]) {
      const parser = createLegacyLibraryStream(source);
      const chars = Array.from(xml);
      for (let start = 0; start < chars.length; start += size) {
        parser.write(chars.slice(start, start + size).join(''));
      }
      expect(parser.finish()).toEqual(expected);
    }
  });

  it.each([
    '<!DOCTYPE udoLibrary>' + XML,
    XML.replace('<comments/>', '<!-- <!DOCTYPE forbidden> -->'),
    XML.replace('<comments/>', '<comments>&unknown;</comments>'),
    XML.replace('</udo>', '</different>'),
    XML.replace(' categoryName="UDO Library"', ''),
    XML + '<udoLibrary/>',
  ])('rejects malformed XML and invalid envelopes before import', (xml) => {
    const parser = createLegacyLibraryStream(source);
    expect(() => {
      for (const char of xml) parser.write(char);
      parser.finish();
    }).toThrow();
  });
});

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
