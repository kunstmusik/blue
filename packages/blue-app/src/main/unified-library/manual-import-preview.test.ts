import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryImportExportService } from './import-export-service';

describe('manual import preview', () => {
  it('presents typed historical SoundObject warnings in the library preview', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-ruler-'));
    const sourcePath = path.join(directory, 'soundObjectLibrary.xml');
    fs.writeFileSync(
      sourcePath,
      '<soundObjectLibrary><category categoryName="SoundObject Library"><soundObject type="blue.soundObject.PianoRoll"><name>Ruler</name><timeUnit>6</timeUnit></soundObject></category></soundObjectLibrary>',
      'utf8',
    );
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const service = new UnifiedLibraryImportExportService(client);
      const preview = await service.previewManualImport([sourcePath]);
      expect(preview.sources[0]?.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'SL-H06',
            severity: 'warning',
            source: expect.objectContaining({ kind: 'library', nativePath: sourcePath }),
            path: expect.stringContaining('/timeUnit[1]'),
            value: '6',
            recovery: expect.stringContaining('retained and saved as timeUnit'),
          }),
        ]),
      );
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports hashes, recognized type, unsupported payloads, and stale source tokens', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-preview-'));
    const sourcePath = path.join(directory, 'soundObjectLibrary.xml');
    fs.writeFileSync(
      sourcePath,
      '<soundObjectLibrary><category categoryName="SoundObject Library"><soundObject type="future.Unknown"><name>Keep Raw</name><plugin>data</plugin></soundObject></category></soundObjectLibrary>',
      'utf8',
    );
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const service = new UnifiedLibraryImportExportService(client);
      const preview = await service.previewManualImport([sourcePath]);
      expect(preview.sources[0]).toMatchObject({
        libraryType: 'soundObject',
        itemCount: 1,
        unsupportedCount: 1,
      });
      expect(preview.sources[0]?.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
            source: expect.objectContaining({ nativePath: sourcePath, label: sourcePath }),
            path: expect.stringContaining('soundObject'),
          }),
        ]),
      );
      expect(preview.sources[0]?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      fs.appendFileSync(sourcePath, ' ');
      await expect(service.executeManualImport(preview.previewToken)).rejects.toThrow(/changed/i);
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('requires an explicit stable folder identity when duplicate names make a path ambiguous', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-manual-conflict-'));
    const sourcePath = path.join(directory, 'udoLibrary.xml');
    fs.writeFileSync(
      sourcePath,
      '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"><udoCategory categoryName="Shared"><udo><opcodeName>tone</opcodeName><outTypes>a</outTypes><inTypes>ak</inTypes><codeBody>aout tone ain,k</codeBody><comments/></udo></udoCategory></udoCategory></udoLibrary>',
      'utf8',
    );
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const { first, second } = await client.runForTesting((repository) => {
        const root = repository.getRoot('udo');
        return {
          first: repository.createFolder({
            libraryType: 'udo',
            parentId: root.id,
            displayName: 'Shared',
          }),
          second: repository.createFolder({
            libraryType: 'udo',
            parentId: root.id,
            displayName: 'Shared',
          }),
        };
      });
      const service = new UnifiedLibraryImportExportService(client);
      const blockedPreview = await service.previewManualImport([sourcePath]);
      expect(blockedPreview.sources[0]).toMatchObject({
        ambiguousFolderCount: 1,
        folderConflicts: [
          {
            sourceBreadcrumb: ['UDO Library', 'Shared'],
            candidates: expect.arrayContaining([
              expect.objectContaining({ nodeId: first.id }),
              expect.objectContaining({ nodeId: second.id }),
            ]),
          },
        ],
      });
      await expect(service.executeManualImport(blockedPreview.previewToken)).rejects.toThrow(
        /choose a destination/i,
      );

      const preview = await service.previewManualImport([sourcePath]);
      const conflict = preview.sources[0]!.folderConflicts[0]!;
      const result = await service.executeManualImport(preview.previewToken, {
        [conflict.conflictId]: second.id,
      });
      expect(result.status).toBe('completed');
      expect(await client.listChildren(first.id)).toHaveLength(0);
      expect((await client.listChildren(second.id)).map((node) => node.displayName)).toEqual([
        'tone',
      ]);
    } finally {
      await client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
