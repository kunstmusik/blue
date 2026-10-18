import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepository, type RepositoryItemPayloadInput } from './repository';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';
import { createUnifiedLibraryTestDirectory } from './test-helpers';
import {
  createSyntheticInstrumentXml,
  createHistoricalInstrumentXml,
  createHistoricalSoundObjectXml,
  createPythonInstrumentXml,
  createClojureSoundObjectXml,
} from '../blueshare/test-helpers';

function samplePayload(
  name: string,
  type: string = 'blue.orchestra.GenericInstrument',
): RepositoryItemPayloadInput {
  return {
    embeddedName: name,
    objectType: type,
    supportStatus: 'supported',
    supportReasonCode: null,
    supportMessage: null,
    payloadXml: `<instrument type="${type}"><name>${name}</name></instrument>`,
    rawHash: `raw-${name}`,
    canonicalContentHash: `canonical-${name}`,
    serializerRevision: '1',
    preview: {},
    dependencies: {},
    metadataRevision: 1,
  };
}

describe('BlueShare Library Atomic Import (T012)', () => {
  it('creates Imported folder on first import and reuses it on subsequent imports across kinds', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const initialRevision = repository.getSnapshot().contentRevision;

      // 1. First instrument import: creates 'Imported Instruments' folder
      const res1 = repository.importResource({
        libraryType: 'instrument',
        displayName: 'Lead Synth',
        payload: samplePayload('Lead Synth'),
      });

      expect(res1.folder.displayName).toBe('Imported Instruments');
      expect(res1.folder.nodeKind).toBe('folder');
      expect(res1.item.displayName).toBe('Lead Synth');
      expect(res1.item.parentId).toBe(res1.folder.id);
      expect(repository.getSnapshot().contentRevision).toBe(initialRevision + 1);

      // 2. Second instrument import: reuses existing folder
      const res2 = repository.importResource({
        libraryType: 'instrument',
        displayName: 'Bass Synth',
        payload: samplePayload('Bass Synth'),
      });

      expect(res2.folder.id).toBe(res1.folder.id);
      expect(res2.item.parentId).toBe(res1.folder.id);
      expect(res2.item.id).not.toBe(res1.item.id);
      expect(repository.getSnapshot().contentRevision).toBe(initialRevision + 2);

      // 3. Effect import: creates 'Imported Effects' under effect root
      const res3 = repository.importResource({
        libraryType: 'effect',
        displayName: 'Reverb',
        payload: samplePayload('Reverb', 'blue.mixer.effects.Reverb'),
      });
      expect(res3.folder.displayName).toBe('Imported Effects');
      expect(res3.folder.libraryType).toBe('effect');
      expect(res3.item.parentId).toBe(res3.folder.id);

      // 4. SoundObject import: creates 'Imported SoundObjects' under soundObject root
      const res4 = repository.importResource({
        libraryType: 'soundObject',
        displayName: 'Pattern',
        payload: samplePayload('Pattern', 'blue.soundObject.Pattern'),
      });
      expect(res4.folder.displayName).toBe('Imported SoundObjects');
      expect(res4.folder.libraryType).toBe('soundObject');
      expect(res4.item.parentId).toBe(res4.folder.id);
    } finally {
      repository.close();
    }
  });

  it('ignores same-name items in root and creates a proper folder', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      // Create an item named 'Imported Instruments' directly under root
      const collisionItem = repository.createItem({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Imported Instruments',
        payload: samplePayload('Collision'),
      });
      expect(collisionItem.nodeKind).toBe('item');

      // Now importResource - must ignore the item and create a real folder
      const result = repository.importResource({
        libraryType: 'instrument',
        displayName: 'New Lead',
        payload: samplePayload('New Lead'),
      });

      expect(result.folder.nodeKind).toBe('folder');
      expect(result.folder.id).not.toBe(collisionItem.id);
      expect(result.item.parentId).toBe(result.folder.id);
    } finally {
      repository.close();
    }
  });

  it('selects the first duplicate folder ordered by (sortIndex, id)', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      // Manually create two folders with the exact name 'Imported Instruments'
      const folderHigh = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Imported Instruments',
        sortIndex: 10,
      });
      const folderLow = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Imported Instruments',
        sortIndex: 2,
      });

      const result = repository.importResource({
        libraryType: 'instrument',
        displayName: 'Item in First',
        payload: samplePayload('Item in First'),
      });

      // Must pick folderLow because sortIndex 2 < 10
      expect(result.folder.id).toBe(folderLow.id);
      expect(result.item.parentId).toBe(folderLow.id);
    } finally {
      repository.close();
    }
  });

  it('creates independent copies on duplicate imports without overwriting', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const res1 = repository.importResource({
        libraryType: 'instrument',
        displayName: 'Lead',
        payload: samplePayload('Lead'),
      });

      const res2 = repository.importResource({
        libraryType: 'instrument',
        displayName: 'Lead',
        payload: samplePayload('Lead'),
      });

      expect(res1.item.id).not.toBe(res2.item.id);
      expect(res1.item.displayName).toBe(res2.item.displayName);

      const payload1 = repository.getItemPayload(res1.item.id);
      const payload2 = repository.getItemPayload(res2.item.id);
      expect(payload1.payloadXml).toBe(payload2.payloadXml);
      expect(payload1.rawHash).toBe(payload2.rawHash);
    } finally {
      repository.close();
    }
  });

  it('rolls back folder, item, payload, and content revision on transaction failure', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const initialRevision = repository.getSnapshot().contentRevision;
      const root = repository.getRoot('instrument');
      const childrenBefore = repository.listChildren(root.id);

      // Injected failure: invalid payloadXml or constraint error
      // In SQLite schema, support_status has a check constraint ('supported' | 'unsupported')
      expect(() => {
        repository.importResource({
          libraryType: 'instrument',
          displayName: 'Faulty Item',
          payload: {
            ...samplePayload('Faulty Item'),
            supportStatus: 'invalid_status' as any,
          },
        });
      }).toThrow();

      // Verify complete rollback
      const childrenAfter = repository.listChildren(root.id);
      expect(childrenAfter.length).toBe(childrenBefore.length);
      expect(repository.getSnapshot().contentRevision).toBe(initialRevision);
    } finally {
      repository.close();
    }
  });

  it('persists imported resources across repository restart', () => {
    const dir = createUnifiedLibraryTestDirectory('blueshare-restart-');
    let folderId = '';
    let itemId = '';
    let revision = 0;

    try {
      const repo = UnifiedLibraryRepository.open(dir.databasePath);
      const res = repo.importResource({
        libraryType: 'instrument',
        displayName: 'Persistent Organ',
        payload: samplePayload('Persistent Organ'),
      });
      folderId = res.folder.id;
      itemId = res.item.id;
      revision = repo.getSnapshot().contentRevision;
      repo.close();

      // Reopen repository from disk
      const reopened = UnifiedLibraryRepository.open(dir.databasePath);
      try {
        const folder = reopened.getNode(folderId);
        expect(folder.displayName).toBe('Imported Instruments');
        const item = reopened.getNode(itemId);
        expect(item.displayName).toBe('Persistent Organ');
        const payload = reopened.getItemPayload(itemId);
        expect(payload.embeddedName).toBe('Persistent Organ');
        expect(reopened.getSnapshot().contentRevision).toBe(revision);
      } finally {
        reopened.close();
      }
    } finally {
      dir.cleanup();
    }
  });

  it('serializes concurrent imports cleanly via client', async () => {
    const dir = createUnifiedLibraryTestDirectory('blueshare-concurrent-');
    try {
      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const initialSnapshot = await client.getSnapshot();

      // Launch 5 concurrent imports
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.importResource({
          libraryType: 'instrument',
          displayName: `Concurrent Synth ${i}`,
          payload: samplePayload(`Concurrent Synth ${i}`),
        }),
      );

      const results = await Promise.all(promises);
      const finalSnapshot = await client.getSnapshot();

      // All 5 should have succeeded
      expect(results.length).toBe(5);
      // All 5 items must share the single created folder
      const folderId = results[0].folder.id;
      for (const res of results) {
        expect(res.folder.id).toBe(folderId);
      }
      // Content revision must have advanced by exactly 5
      expect(finalSnapshot.contentRevision).toBe(initialSnapshot.contentRevision + 5);
      expect(finalSnapshot.itemCounts.instrument).toBe(5);

      await client.close();
    } finally {
      dir.cleanup();
    }
  });

  it.each(['EACCES', 'EPERM'])(
    'rolls back atomically on injected %s filesystem/permission failure',
    (errorCode) => {
      const repository = UnifiedLibraryRepository.open(':memory:');
      try {
        const initialRevision = repository.getSnapshot().contentRevision;
        const root = repository.getRoot('instrument');
        const childrenBefore = repository.listChildren(root.id);

        // Inject EACCES/EPERM error during import transaction
        const err = Object.assign(new Error(`${errorCode}: permission denied`), {
          code: errorCode,
        });
        const db = (repository as any).database;
        const originalPrepare = db.prepare.bind(db);

        // Fail statement preparation for payload creation with EACCES/EPERM
        db.prepare = (sql: string) => {
          if (sql.includes('INSERT INTO library_item_payloads')) {
            throw err;
          }
          return originalPrepare(sql);
        };

        expect(() => {
          repository.importResource({
            libraryType: 'instrument',
            displayName: 'Permission Denied Synth',
            payload: samplePayload('Permission Denied Synth'),
          });
        }).toThrow(err);

        // Restore prepare
        db.prepare = originalPrepare;

        // Verify complete atomic rollback: no folder, no item, content revision untouched
        const childrenAfter = repository.listChildren(root.id);
        expect(childrenAfter.length).toBe(childrenBefore.length);
        expect(repository.getSnapshot().contentRevision).toBe(initialRevision);

        // Verify subsequent import succeeds cleanly without residue
        const retryResult = repository.importResource({
          libraryType: 'instrument',
          displayName: 'Retry Synth',
          payload: samplePayload('Retry Synth'),
        });
        expect(retryResult.item.displayName).toBe('Retry Synth');
        expect(repository.getSnapshot().contentRevision).toBe(initialRevision + 1);
      } finally {
        repository.close();
      }
    },
  );

  it('proves durable success, one revision/event, immediate visibility and no duplicate retry on post-commit snapshot refresh failure', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-import-post-commit-refresh-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();
      const initialRevision = service.getSnapshot().contentRevision;

      const events: any[] = [];
      service.onChanged((evt) => {
        events.push(evt);
      });

      // Spy on client.getSnapshot to fail on post-commit refresh
      const client = (service as any).client as UnifiedLibraryRepositoryClient;
      const originalGetSnapshot = client.getSnapshot.bind(client);
      client.getSnapshot = async () => {
        // Fail post-commit refresh
        throw Object.assign(new Error('EIO: simulated post-commit snapshot refresh failure'), {
          code: 'EIO',
        });
      };

      const instrXml = createSyntheticInstrumentXml('Durable Post Commit Lead');
      const result = await service.importStandaloneResource(
        'instrument',
        instrXml,
        999,
        'Durable Post Commit Lead',
      );

      // Restore client.getSnapshot
      client.getSnapshot = originalGetSnapshot;

      // 1. Durable success: importStandaloneResource returned ok: true
      expect(result.ok).toBe(true);
      if (!result.ok)
        throw new Error('Expected import to succeed despite post-commit refresh failure');

      // 2. Immediate visibility: affected node is returned with valid browse node
      expect(result.value.affectedNodes.length).toBe(1);
      expect(result.value.affectedNodes[0].displayName).toBe('Durable Post Commit Lead');
      expect(result.value.affectedNodes[0].supportStatus).toBe('supported');

      // 3. Exactly one revision increment and one change event published
      expect(result.value.contentRevision).toBe(initialRevision + 1);
      expect(events.length).toBe(1);
      expect(events[0].contentRevision).toBe(initialRevision + 1);
      expect(events[0].cause).toBe('import');
      expect(events[0].requiresFullRefresh).toBe(true);

      // 4. No duplicate retry and durable persistence in database
      const verifyClient = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const snapshotAfter = await verifyClient.getSnapshot();
      expect(snapshotAfter.contentRevision).toBe(initialRevision + 1);
      expect(snapshotAfter.itemCounts.instrument).toBe(1);

      const root = await verifyClient.getRoot('instrument');
      const folders = await verifyClient.listChildren(root.id);
      expect(folders.length).toBe(1);
      const items = await verifyClient.listChildren(folders[0].id);
      expect(items.length).toBe(1);
      expect(items[0].displayName).toBe('Durable Post Commit Lead');

      await verifyClient.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('persists documented historical and runtime-backed resources across restart', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-import-evidence-restart-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // Import historical BSB
      const bsbXml = createHistoricalInstrumentXml('Historical Organ');
      const r1 = await service.importStandaloneResource(
        'instrument',
        bsbXml,
        801,
        'Historical Organ',
      );
      expect(r1.ok).toBe(true);

      // Import historical PianoRoll
      const pianoXml = createHistoricalSoundObjectXml('Historical Score');
      const r2 = await service.importStandaloneResource(
        'soundObject',
        pianoXml,
        802,
        'Historical Score',
      );
      expect(r2.ok).toBe(true);

      // Import PythonInstrument
      const pyXml = createPythonInstrumentXml('Py Synth');
      const r3 = await service.importStandaloneResource('instrument', pyXml, 803, 'Py Synth');
      expect(r3.ok).toBe(true);

      // Import ClojureObject
      const cljXml = createClojureSoundObjectXml('Clj Score');
      const r4 = await service.importStandaloneResource('soundObject', cljXml, 804, 'Clj Score');
      expect(r4.ok).toBe(true);

      const finalRev = service.getSnapshot().contentRevision;
      await service.stop();

      // Reopen repository and verify persistence
      const repo = UnifiedLibraryRepository.open(dir.databasePath);
      try {
        expect(repo.getSnapshot().contentRevision).toBe(finalRev);
        if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) throw new Error('Imports failed');
        const p1 = repo.getItemPayload(r1.value.affectedNodes[0].nodeId);
        expect(p1.payloadXml).toBe(bsbXml);
        const p2 = repo.getItemPayload(r2.value.affectedNodes[0].nodeId);
        expect(p2.payloadXml).toBe(pianoXml);
        const p3 = repo.getItemPayload(r3.value.affectedNodes[0].nodeId);
        expect(p3.payloadXml).toBe(pyXml);
        const p4 = repo.getItemPayload(r4.value.affectedNodes[0].nodeId);
        expect(p4.payloadXml).toBe(cljXml);
      } finally {
        repo.close();
      }
    } finally {
      dir.cleanup();
    }
  });
});
