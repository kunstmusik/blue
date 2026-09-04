import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('UnifiedLibraryService foundation', () => {
  it('moves from initializing to ready and publishes snapshots', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    const phases: string[] = [];
    const unsubscribe = service.onSnapshot((snapshot) => phases.push(snapshot.phase));

    await expect(service.start()).resolves.toMatchObject({
      phase: 'ready',
      writable: true,
      contentRevision: 0,
    });
    expect(phases).toEqual(['initializing', 'ready']);

    unsubscribe();
    await service.stop();
    expect(service.getSnapshot().phase).toBe('stopped');
  });

  it('serializes long-running operation leases and releases idempotently', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();
    const release = service.acquireOperation('manualImport', 'previewing');

    expect(service.getSnapshot().operation?.kind).toBe('manualImport');
    expect(() => service.acquireOperation('export', 'preflight')).toThrow(/already in progress/i);
    release();
    release();
    expect(service.getSnapshot().operation).toBeUndefined();

    await service.stop();
  });

  it('publishes one typed clipboard to every snapshot subscriber', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();
    const snapshots: unknown[] = [];
    const unsubscribe = service.onSnapshot((next) => snapshots.push(next.clipboard));
    const clipboard = {
      operation: 'copy' as const,
      source: {
        kind: 'userNode' as const,
        libraryType: 'udo' as const,
        nodeId: 'udo-1',
        revision: 3,
      },
      capturedAt: 10,
    };

    expect(service.setClipboard(clipboard)).toBe(true);
    expect(service.getSnapshot().clipboard).toEqual(clipboard);
    expect(snapshots).toEqual([clipboard]);

    expect(service.setClipboard(null)).toBe(true);
    expect(service.getSnapshot().clipboard).toBeNull();
    unsubscribe();
    await service.stop();
  });

  it('publishes a detached BSB buffer without exposing mutable service state', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();
    const clipboard = {
      originX: 10,
      originY: 20,
      widgets: [
        {
          id: 'slider-1',
          type: 'BSBHSlider',
          objectName: 'amp',
          x: 10,
          y: 20,
          width: 120,
          height: 24,
          value: 0.5,
          minimum: 0,
          maximum: 1,
          editable: true,
          properties: {},
        },
      ],
    };

    expect(service.setBsbClipboard(clipboard)).toBe(true);
    const exposed = service.getSnapshot().bsbClipboard!;
    exposed.widgets[0]!.objectName = 'mutated';
    expect(service.getSnapshot().bsbClipboard?.widgets[0]?.objectName).toBe('amp');

    expect(service.setBsbClipboard(null)).toBe(true);
    expect(service.getSnapshot().bsbClipboard).toBeNull();
    await service.stop();
  });

  it('imports and exports a standalone .binstr payload in a user folder', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    const directory = await mkdtemp(path.join(tmpdir(), 'blue-binstr-'));
    const inputPath = path.join(directory, 'input.binstr');
    const outputPath = path.join(directory, 'output.binstr');
    const xml =
      '<instrument type="blue.orchestra.GenericInstrument"><name>Imported Pad</name></instrument>';
    await writeFile(inputPath, xml, 'utf8');

    try {
      await service.start();
      const rootResult = await service.browseLibraries({
        parent: { scope: 'user', libraryType: 'instrument' },
        limit: 1,
      });
      expect(rootResult.ok).toBe(true);
      if (!rootResult.ok) return;

      const folderResult = await service.applyLibraryMutation({
        type: 'createFolder',
        libraryType: 'instrument',
        parentId: rootResult.value.parent.nodeId,
        name: 'Imported',
      });
      expect(folderResult.ok).toBe(true);
      if (!folderResult.ok) return;
      const folderId = folderResult.value.affectedNodes[0]?.nodeId;
      expect(folderId).toBeTruthy();
      if (!folderId) return;

      const imported = await service.importInstrumentFile(folderId, inputPath);
      expect(imported).toMatchObject({
        ok: true,
        value: { affectedNodes: [{ displayName: 'Imported Pad', nodeKind: 'item' }] },
      });
      if (!imported.ok) return;
      const key = imported.value.affectedNodes[0]?.key;
      expect(key).toMatchObject({ scope: 'user', libraryType: 'instrument' });
      if (!key) return;

      await expect(service.exportInstrumentFile(key, outputPath)).resolves.toMatchObject({
        ok: true,
        value: true,
      });
      await expect(readFile(outputPath, 'utf8')).resolves.toBe(xml);
    } finally {
      await service.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
