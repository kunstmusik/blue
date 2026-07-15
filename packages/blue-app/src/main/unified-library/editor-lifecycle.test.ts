import { describe, expect, it } from 'vitest';
import { UnifiedLibraryEditorSessionService } from './editor-session-service';
import { UnifiedLibraryRepositoryClient } from './repository-client';

describe('library editor lifecycle guard', () => {
  it('gates quit for dirty sessions and permits it after explicit discard', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const node = await client.runForTesting((repository) => {
        const root = repository.getRoot('udo');
        return repository.createItem({
          libraryType: 'udo', parentId: root.id, displayName: 'Udo',
          payload: {
            embeddedName: 'Udo', objectType: 'udo', supportStatus: 'supported',
            supportReasonCode: null, supportMessage: null, payloadXml: '<udo/>', rawHash: 'r',
            canonicalContentHash: 'c', serializerRevision: '1', preview: {}, dependencies: {}, metadataRevision: 1,
          },
        });
      });
      const sessions = new UnifiedLibraryEditorSessionService(client);
      const opened = await sessions.open({ scope: 'user', libraryType: 'udo', nodeId: node.id });
      sessions.patch(opened.sessionId, { payloadXml: '<udo><opcodeName>dirty</opcodeName></udo>' });
      expect(sessions.prepareShutdown('quit').mayContinue).toBe(false);
      expect((await sessions.resolveShutdown('discard')).mayContinue).toBe(true);
      expect(sessions.prepareShutdown('quit').mayContinue).toBe(true);
    } finally { await client.close(); }
  });
});
