import { GenericInstrument } from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

function payload(name: string) {
  const instrument = new GenericInstrument();
  instrument.setName(name);
  const payloadXml = instrument.saveAsXML().toXml();
  return {
    embeddedName: name,
    objectType: 'GenericInstrument',
    supportStatus: 'supported' as const,
    supportReasonCode: null,
    supportMessage: null,
    payloadXml,
    rawHash: 'raw',
    canonicalContentHash: 'canonical',
    serializerRevision: '1',
    preview: {},
    dependencies: {},
    metadataRevision: 1,
  };
}

describe('prepared Library deletion', () => {
  it('binds affected counts and closes clean editors only after confirmed deletion', async () => {
    let client: UnifiedLibraryRepositoryClient;
    const service = new UnifiedLibraryService(':memory:', (path) => {
      client = UnifiedLibraryRepositoryClient.openForTesting(path);
      return client;
    });
    await service.start();
    try {
      const { folder, item } = await client!.runForTesting((repository) => {
        const root = repository.getRoot('instrument');
        const folder = repository.createFolder({
          libraryType: 'instrument',
          parentId: root.id,
          displayName: 'Folder',
        });
        const item = repository.createItem({
          libraryType: 'instrument',
          parentId: folder.id,
          displayName: 'Pad',
          payload: payload('Pad'),
        });
        return { folder, item };
      });
      const editor = await service.openLibraryItemEditor({
        scope: 'user',
        libraryType: 'instrument',
        nodeId: item.id,
      });
      if (!editor.ok) throw new Error(editor.error.message);
      const preview = await service.prepareLibraryMutation({
        type: 'deleteNode',
        nodeId: folder.id,
        expectedRevision: folder.revision,
      });
      expect(preview).toMatchObject({
        ok: true,
        value: { affectedCount: 2, dirtyEditorSessionIds: [] },
      });
      if (!preview.ok) throw new Error(preview.error.message);
      const result = await service.applyLibraryMutation({
        type: 'deleteNode',
        nodeId: folder.id,
        expectedRevision: folder.revision,
        confirmation: preview.value.confirmationToken,
      });
      expect(result).toMatchObject({
        ok: true,
        value: { closedEditorSessionIds: [editor.value.sessionId] },
      });
      await expect(client!.getNode(item.id)).rejects.toThrow(/not found/i);
    } finally {
      await service.stop();
    }
  });

  it('reports dirty editors and rejects deletion until the draft is resolved', async () => {
    let client: UnifiedLibraryRepositoryClient;
    const service = new UnifiedLibraryService(':memory:', (path) => {
      client = UnifiedLibraryRepositoryClient.openForTesting(path);
      return client;
    });
    await service.start();
    try {
      const item = await client!.runForTesting((repository) => {
        const root = repository.getRoot('instrument');
        return repository.createItem({
          libraryType: 'instrument',
          parentId: root.id,
          displayName: 'Pad',
          payload: payload('Pad'),
        });
      });
      const editor = await service.openLibraryItemEditor({
        scope: 'user',
        libraryType: 'instrument',
        nodeId: item.id,
      });
      if (!editor.ok) throw new Error(editor.error.message);
      service.patchLibraryEditorSession({
        sessionId: editor.value.sessionId,
        documentPatch: {
          kind: 'instrument',
          patch: {
            type: 'updateInstrument',
            assignmentId: 'library-item',
            patch: { name: 'Draft' },
          },
        },
      });
      const preview = await service.prepareLibraryMutation({
        type: 'deleteNode',
        nodeId: item.id,
        expectedRevision: item.revision,
      });
      expect(preview).toMatchObject({
        ok: true,
        value: { dirtyEditorSessionIds: [editor.value.sessionId] },
      });
      if (!preview.ok) throw new Error(preview.error.message);
      const result = await service.applyLibraryMutation({
        type: 'deleteNode',
        nodeId: item.id,
        expectedRevision: item.revision,
        confirmation: preview.value.confirmationToken,
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
      await expect(client!.getNode(item.id)).resolves.toMatchObject({ id: item.id });
    } finally {
      await service.stop();
    }
  });
});
