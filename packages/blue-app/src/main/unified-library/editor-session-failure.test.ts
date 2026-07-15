import { describe, expect, it } from 'vitest';
import { UnifiedLibraryEditorSessionService } from './editor-session-service';
import { UnifiedLibraryRepositoryClient } from './repository-client';

describe('editor save failure safety', () => {
  it('preserves the last valid payload and invalid current draft', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const root = await client.getRoot('instrument');
      const node = await client.createItem({
        libraryType: 'instrument', parentId: root.id, displayName: 'Safe',
        payload: { embeddedName: 'Safe', objectType: 'GenericInstrument', supportStatus: 'supported', supportReasonCode: null, supportMessage: null, payloadXml: '<instrument/>', rawHash: 'r', canonicalContentHash: 'c', serializerRevision: '1', preview: {}, dependencies: {}, metadataRevision: 1 },
      });
      const sessions = new UnifiedLibraryEditorSessionService(client);
      const opened = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: node.id });
      sessions.patch(opened.sessionId, { payloadXml: '<instrument>' });
      await expect(sessions.save(opened.sessionId)).rejects.toThrow();
      expect((await client.getItemPayload(node.id)).payloadXml).toBe('<instrument/>');
      expect(sessions.get(opened.sessionId)?.draftXml).toBe('<instrument>');
    } finally { await client.close(); }
  });
});
