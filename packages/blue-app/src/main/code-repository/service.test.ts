import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';
import { CodeRepositoryClient } from './repository-client';
import { CodeRepositoryMigrationStateStore } from './migration-state-store';
import { CodeRepositoryService } from './service';
import { createCodeRepositoryTestDirectory } from './test-helpers';

function createService(directory: ReturnType<typeof createCodeRepositoryTestDirectory>) {
  const client = CodeRepositoryClient.openForTesting(directory.databasePath);
  const service = new CodeRepositoryService(directory.databasePath, {
    // Skip automatic migration so each test controls initialization.
    clientFactory: () => client,
  });
  return { service, client };
}

function createMigratingService(
  directory: ReturnType<typeof createCodeRepositoryTestDirectory>,
): CodeRepositoryService {
  return new CodeRepositoryService(directory.databasePath, {
    legacyConfigurationDirectory: directory.directory,
    migrationStatePath: directory.statePath,
    clientFactory: () => CodeRepositoryClient.openForTesting(directory.databasePath),
  });
}

describe('CodeRepositoryService', () => {
  it('loads an empty snapshot on start without migration options', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      await service.start();
      const snapshot = service.getSnapshot();
      expect(snapshot?.root.kind).toBe('root');
      expect(snapshot?.root.children).toEqual([]);
      expect(snapshot?.contentRevision).toBe(0);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('creates a group and snippet, then reports the updated revision', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      await service.start();
      let snapshot = await service.createGroup(CODE_REPOSITORY_ROOT_ID, 'fx', 0);
      expect(snapshot.contentRevision).toBe(1);
      const groupId = snapshot.root.children?.[0].id!;
      snapshot = await service.createSnippet(groupId, 'reverb', 'aout reverb', 1);
      expect(snapshot.root.children?.[0].children?.[0].code).toBe('aout reverb');
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects a stale revision with revision-conflict', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      await service.start();
      await service.createGroup(CODE_REPOSITORY_ROOT_ID, 'first', 0);
      // Stale revision 0 should conflict now that we are at 1.
      await expect(service.createGroup(CODE_REPOSITORY_ROOT_ID, 'second', 0)).rejects.toThrow(
        /modified in another window|revision/i,
      );
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('commitDraft atomically replaces the tree', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      await service.start();
      await service.createGroup(CODE_REPOSITORY_ROOT_ID, 'old', 0);
      const draft = {
        ...service.getSnapshot()!.root,
        children: [
          {
            id: 'grp-1',
            kind: 'group' as const,
            name: 'fresh',
            parentId: CODE_REPOSITORY_ROOT_ID,
            order: 0,
            children: [],
          },
        ],
      };
      const snapshot = await service.commitDraft(1, draft);
      expect(snapshot.root.children?.[0].name).toBe('fresh');
      expect(snapshot.root.children).toHaveLength(1);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('initializes an empty repository when no legacy source exists', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const service = createMigratingService(dir);
      await service.start();
      const snapshot = service.getSnapshot();
      expect(snapshot?.root.children).toEqual([]);
      expect(snapshot?.initialized).toBe(true);
      expect(service.getStatus().migrationStatus).toBe('skipped');
      await service.stop();

      const restarted = createMigratingService(dir);
      await restarted.start();
      expect(restarted.getSnapshot()?.root.children).toEqual([]);
      expect(restarted.getSnapshot()?.initialized).toBe(true);
      expect(restarted.getStatus().migrationStatus).toBe('skipped');
      await restarted.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('imports valid legacy XML and does not import the same hash twice', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const legacyXml = `<customAccelerators>
  <customGroup name='legacy'>
    <customAccelerator><name>migrated</name><signature>sig</signature></customAccelerator>
  </customGroup>
</customAccelerators>`;
      fs.writeFileSync(path.join(dir.directory, 'codeRepository.xml'), legacyXml, 'utf8');
      const service = createMigratingService(dir);
      await service.start();
      let snapshot = service.getSnapshot();
      expect(snapshot?.root.children?.[0].name).toBe('legacy');
      expect(service.getStatus().migrationStatus).toBe('succeeded');
      await service.stop();
      // Discard only the migration sidecar: provenance still makes the
      // source hash idempotent across an interrupted/recovered migration.
      fs.unlinkSync(dir.statePath);
      const restarted = createMigratingService(dir);
      await restarted.start();
      snapshot = restarted.getSnapshot();
      expect(snapshot?.root.children?.[0].name).toBe('legacy');
      // Tree is preserved, no duplicate import.
      expect(snapshot?.root.children).toHaveLength(1);
      expect(restarted.getStatus().migrationStatus).toBe('succeeded');
      await restarted.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('reports a typed status when not initialized', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      // Before start, status reflects not-availableable state.
      const status = service.getStatus();
      expect(status.available).toBe(false);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('exports Java-compatible XML omitting internal ids', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const { service } = createService(dir);
      await service.start();
      await service.createGroup(CODE_REPOSITORY_ROOT_ID, 'export-group', 0);
      const exported = service.exportXml();
      expect(exported.format).toBe('java-blue-code-repository-v1');
      expect(exported.xml).toContain('<customAccelerators>');
      expect(exported.xml).toContain('name="export-group"');
      expect(exported.xml).not.toContain(CODE_REPOSITORY_ROOT_ID);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('returns the latest snapshot with a revision conflict instead of an old local copy', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const first = createService(dir).service;
      const second = new CodeRepositoryService(dir.databasePath, {
        clientFactory: () => CodeRepositoryClient.openForTesting(dir.databasePath),
      });
      await first.start();
      await second.start();
      await first.createGroup(CODE_REPOSITORY_ROOT_ID, 'saved elsewhere', 0);
      await expect(second.createGroup(CODE_REPOSITORY_ROOT_ID, 'stale', 0)).rejects.toMatchObject({
        code: 'revision-conflict',
        currentSnapshot: expect.objectContaining({ contentRevision: 1 }),
      });
      await first.stop();
      await second.stop();
    } finally {
      dir.cleanup();
    }
  });
});

describe('CodeRepositoryService migration robustness', () => {
  it('does not block startup when legacy XML is malformed', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      fs.writeFileSync(path.join(dir.directory, 'codeRepository.xml'), '<customAccelerators><broken', 'utf8');
      const service = createMigratingService(dir);
      await service.start();
      // Startup completed; the service is usable despite the migration failure.
      expect(service.getServiceSnapshot().phase).toBe('ready');
      expect(service.getStatus().migrationStatus).toBe('failed');
      expect(service.getStatus().diagnostic?.code).toBe('invalid-legacy-xml');
      // The malformed source file is preserved untouched.
      const preserved = fs.readFileSync(path.join(dir.directory, 'codeRepository.xml'), 'utf8');
      expect(preserved).toBe('<customAccelerators><broken');
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects an explicit import with unsupported structure without changing the tree', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const service = createMigratingService(dir);
      await service.start();
      const before = service.getSnapshot();
      await expect(service.importXml('<otherRoot/>', 'explicit.xml', before!.contentRevision)).rejects.toThrow(
        /customAccelerators|invalid/i,
      );
      // The tree is unchanged after the rejected import.
      const after = service.getSnapshot();
      expect(after?.contentRevision).toBe(before!.contentRevision);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('records failed explicit imports and atomically records successful provenance', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const service = createMigratingService(dir);
      await service.start();
      const before = service.getSnapshot()!;
      await expect(service.importXml('<otherRoot/>', 'broken.xml', before.contentRevision)).rejects.toMatchObject({
        code: 'invalid-legacy-xml',
      });
      const client = CodeRepositoryClient.openForTesting(dir.databasePath);
      expect((await client.listImports())[0]).toMatchObject({
        sourcePath: 'broken.xml',
        status: 'failed',
      });
      await client.close();

      const xml =
        '<customAccelerators><customAccelerator><name>ok</name><signature>x</signature></customAccelerator></customAccelerators>';
      const result = await service.importXml(xml, 'valid.xml', before.contentRevision);
      const recordClient = CodeRepositoryClient.openForTesting(dir.databasePath);
      expect(await recordClient.hasImportedHash(result.sourceHash)).toBe(true);
      await recordClient.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('distinguishes an unreadable explicit source and can recover from a repaired migration source', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const legacyPath = path.join(dir.directory, 'codeRepository.xml');
      fs.writeFileSync(legacyPath, '<customAccelerators><broken', 'utf8');
      const service = createMigratingService(dir);
      await service.start();
      const before = service.getSnapshot()!;
      await expect(
        service.importFile(path.join(dir.directory, 'missing.xml'), before.contentRevision),
      ).rejects.toMatchObject({
        code: 'source-unreadable',
      });
      expect(service.getSnapshot()).toEqual(before);
      expect(service.getStatus().diagnostic?.code).toBe('source-unreadable');

      fs.writeFileSync(legacyPath, '<customAccelerators><customGroup name="repaired" /></customAccelerators>', 'utf8');
      await service.retry();
      expect(service.getStatus().migrationStatus).toBe('succeeded');
      expect(service.getSnapshot()?.root.children?.[0]?.name).toBe('repaired');
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('makes an interrupted migration explicitly retryable instead of leaving it stuck', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      fs.writeFileSync(
        path.join(dir.directory, 'codeRepository.xml'),
        '<customAccelerators><customGroup name="Recovered"/></customAccelerators>',
        'utf8',
      );
      new CodeRepositoryMigrationStateStore(dir.statePath).beginAttempt();
      const service = createMigratingService(dir);
      await service.start();
      expect(service.getStatus()).toMatchObject({
        available: true,
        migrationStatus: 'failed',
        diagnostic: { code: 'migration-interrupted' },
      });

      await service.retry();
      expect(service.getStatus().migrationStatus).toBe('succeeded');
      expect(service.getSnapshot()?.root.children?.[0]?.name).toBe('Recovered');
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('transitions runtime transport failures to recoverable storage failure and reopens', async () => {
    const dir = createCodeRepositoryTestDirectory();
    const openedClients: CodeRepositoryClient[] = [];
    const service = new CodeRepositoryService(dir.databasePath, {
      clientFactory: (databasePath) => {
        const client = CodeRepositoryClient.openForTesting(databasePath);
        openedClients.push(client);
        return client;
      },
    });
    try {
      await service.start();
      await openedClients[0].close();
      await expect(service.createGroup(CODE_REPOSITORY_ROOT_ID, 'fails', 0)).rejects.toMatchObject({
        code: 'storage-unavailable',
        retryable: true,
      });
      expect(service.getServiceSnapshot().phase).toBe('failed');
      expect(service.getSnapshot()).toBeNull();

      await service.retry();
      expect(service.getServiceSnapshot().phase).toBe('ready');
      expect(service.getStatus().available).toBe(true);
    } finally {
      await service.stop();
      dir.cleanup();
    }
  });

  it('does not expose database paths in public storage diagnostics', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const service = new CodeRepositoryService(dir.databasePath, {
        clientFactory: () => {
          throw new Error(`Unable to open ${dir.databasePath}`);
        },
      });
      await service.start();

      expect(service.getStatus().diagnostic?.message).toBe('Code Repository storage is unavailable.');
      expect(service.getStatus().diagnostic?.message).not.toContain(dir.directory);
    } finally {
      dir.cleanup();
    }
  });

  it('recovers a corrupt database from valid XML while preserving the failed database', async () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const database = new DatabaseSync(dir.databasePath);
      database.exec('PRAGMA user_version = 999');
      database.close();
      const sourcePath = path.join(dir.directory, 'recovery.xml');
      fs.writeFileSync(
        sourcePath,
        '<customAccelerators><customAccelerator><name>Recovered snippet</name><signature>exact code</signature></customAccelerator></customAccelerators>',
        'utf8',
      );
      const service = new CodeRepositoryService(dir.databasePath, {
        clientFactory: (databasePath) => CodeRepositoryClient.openForTesting(databasePath),
        migrationStatePath: dir.statePath,
      });
      await service.start();
      expect(service.getServiceSnapshot().phase).toBe('failed');

      const recovered = await service.importFile(sourcePath, 0);
      expect(recovered.snapshot.root.children?.[0]).toMatchObject({
        name: 'Recovered snippet',
        code: 'exact code',
      });
      expect(service.getServiceSnapshot().phase).toBe('ready');
      expect(
        fs.readdirSync(dir.directory).some((name) => name.startsWith(`${path.basename(dir.databasePath)}.failed-`)),
      ).toBe(true);
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });
});
