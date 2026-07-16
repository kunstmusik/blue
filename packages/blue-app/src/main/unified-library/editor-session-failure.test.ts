import { describe, expect, it } from 'vitest';
import { UnifiedLibraryEditorSessionService } from './editor-session-service';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { GenericInstrument } from '@blue/data';

describe('editor save failure safety', () => {
  it('preserves the last valid payload when a typed patch cannot apply', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const root = await client.getRoot('instrument');
      const instrument = new GenericInstrument();
      instrument.setName('Safe');
      const originalXml = instrument.saveAsXML().toXml();
      const node = await client.createItem({
        libraryType: 'instrument', parentId: root.id, displayName: 'Safe',
        payload: { embeddedName: 'Safe', objectType: 'GenericInstrument', supportStatus: 'supported', supportReasonCode: null, supportMessage: null, payloadXml: originalXml, rawHash: 'r', canonicalContentHash: 'c', serializerRevision: '1', preview: {}, dependencies: {}, metadataRevision: 1 },
      });
      const sessions = new UnifiedLibraryEditorSessionService(client);
      const opened = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: node.id });
      expect(() => sessions.patch(opened.sessionId, {
        documentPatch: { kind: 'effect', patch: { name: 'Wrong type' } },
      })).toThrow(/type mismatch/i);
      expect((await client.getItemPayload(node.id)).payloadXml).toBe(originalXml);
      expect(sessions.get(opened.sessionId)).toMatchObject({ dirty: false, document: { kind: 'instrument' } });
    } finally { await client.close(); }
  });
});
