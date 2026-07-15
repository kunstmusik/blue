import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { LibraryMigrationStateStore } from './migration-state-store';
import { UnifiedLibraryImportExportService } from './import-export-service';

const directories: string[] = [];
const EMPTY_SOURCES = {
  'userInstrumentLibrary.xml': '<instrumentLibrary><instrumentCategory categoryName="Instrument Library" isRoot="true"/></instrumentLibrary>',
  'udoLibrary.xml': '<udoLibrary><udoCategory categoryName="UDO Library" isRoot="true"/></udoLibrary>',
  'effectsLibrary.xml': '<effectsLibrary><effectCategory categoryName="Effects Library" isRoot="true"/></effectsLibrary>',
  'soundObjectLibrary.xml': '<soundObjectLibrary><category categoryName="SoundObject Library"/></soundObjectLibrary>',
} as const;
function directory(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-auto-import-'));
  directories.push(value);
  return value;
}
afterEach(() => {
  for (const value of directories.splice(0)) fs.rmSync(value, { recursive: true, force: true });
});

describe('automatic Java Blue migration', () => {
  it('imports all four recognized sources independently without modifying them', async () => {
    const config = directory();
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    const original = new Map<string, Buffer>();
    for (const [name, xml] of Object.entries(EMPTY_SOURCES)) {
      const sourcePath = path.join(config, name);
      fs.writeFileSync(sourcePath, xml, 'utf8');
      original.set(sourcePath, fs.readFileSync(sourcePath));
    }
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(report.status).toBe('complete');
      expect(report.sources.map((source) => source.status)).toEqual(['imported', 'imported', 'imported', 'imported']);
      for (const [sourcePath, bytes] of original) expect(fs.readFileSync(sourcePath)).toEqual(bytes);
    } finally { await client.close(); }
  });

  it('commits three valid sources while reporting one corrupt source', async () => {
    const config = directory();
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    for (const [name, xml] of Object.entries(EMPTY_SOURCES)) {
      fs.writeFileSync(path.join(config, name), name === 'effectsLibrary.xml' ? '<broken' : xml, 'utf8');
    }
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(report.status).toBe('partial');
      expect(report.sources.filter((source) => source.status === 'imported')).toHaveLength(3);
      expect(report.sources.find((source) => source.libraryType === 'effect')).toMatchObject({ status: 'failed' });
      expect(state.load()).toMatchObject({ legacyMigrationState: 'completed', lastResultKind: 'partial' });
    } finally { await client.close(); }
  });

  it('creates a usable empty store and records skipped when no source exists', async () => {
    const config = directory();
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(report.status).toBe('skipped');
      expect(report.sources.every((source) => source.status === 'absent')).toBe(true);
      expect((await client.getSnapshot()).itemCounts).toEqual({ instrument: 0, udo: 0, soundObject: 0, effect: 0 });
      expect(state.load()).toMatchObject({ legacyMigrationState: 'skipped', lastResultKind: 'noSources' });
    } finally { await client.close(); }
  });

  it('discovers standard names, imports each valid source independently, and preserves source bytes', async () => {
    const config = directory();
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    const source = '<instrumentLibrary><instrumentCategory categoryName="Instrument Library" isRoot="true"><instrument type="blue.orchestra.GenericInstrument"><name>Pad</name><globalOrc></globalOrc><globalSco></globalSco><instrumentText>ain 0</instrumentText></instrument></instrumentCategory></instrumentLibrary>';
    const sourcePath = path.join(config, 'userInstrumentLibrary.xml');
    fs.writeFileSync(sourcePath, source, 'utf8');
    const before = fs.readFileSync(sourcePath);
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(report.status).toBe('complete');
      expect(report.sources.find((entry) => entry.libraryType === 'instrument')).toMatchObject({ status: 'imported', itemCount: 1 });
      expect((await client.getSnapshot()).itemCounts.instrument).toBe(1);
      expect((await client.listImportHistory())[0]).toMatchObject({ mode: 'automatic', status: 'completed' });
      expect(fs.readFileSync(sourcePath)).toEqual(before);
      expect(state.load()).toMatchObject({ legacyMigrationState: 'completed', lastResultKind: 'complete' });
    } finally { await client.close(); }
  });

  it('suppresses automatic import for a nonempty store', async () => {
    const config = directory();
    const state = new LibraryMigrationStateStore(path.join(directory(), 'blue-libraries-state.json'));
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const root = await client.getRoot('instrument');
      await client.createFolder({ libraryType: 'instrument', parentId: root.id, displayName: 'Existing' });
      const report = await new UnifiedLibraryImportExportService(client).runAutomaticMigration(config, state);
      expect(report.status).toBe('skipped');
      expect(report.message).toMatch(/nonempty/i);
      expect(state.load().legacyMigrationState).toBe('skipped');
    } finally { await client.close(); }
  });
});
