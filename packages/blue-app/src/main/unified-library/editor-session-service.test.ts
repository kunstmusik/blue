import { describe, expect, it } from 'vitest';
import { UnifiedLibraryEditorSessionService } from './editor-session-service';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { GenericInstrument } from '@blue/data';

function instrumentXml(name: string): string {
  const instrument = new GenericInstrument();
  instrument.setName(name);
  return instrument.saveAsXML().toXml();
}

const PAYLOAD = {
  embeddedName: 'Pad', objectType: 'GenericInstrument', supportStatus: 'supported' as const,
  supportReasonCode: null, supportMessage: null, payloadXml: instrumentXml('Pad'),
  rawHash: 'raw', canonicalContentHash: 'canonical', serializerRevision: '1', preview: {},
  dependencies: {}, metadataRevision: 1,
};

async function fixture() {
  const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
  const nodes = await client.runForTesting((repository) => {
    const root = repository.getRoot('instrument');
    return ['A', 'B', 'C', 'D'].map((name) => repository.createItem({
      libraryType: 'instrument', parentId: root.id, displayName: name,
      payload: { ...PAYLOAD, embeddedName: name, payloadXml: instrumentXml(name) },
    }));
  });
  return { client, nodes, sessions: new UnifiedLibraryEditorSessionService(client) };
}

describe('main-owned library editor sessions', () => {
  it('pins an existing clean preview when it is explicitly reopened', async () => {
    const { client, nodes, sessions } = await fixture();
    try {
      const preview = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[0]!.id });
      const pinned = await sessions.open(preview.key, true);
      expect(pinned).toMatchObject({ sessionId: preview.sessionId, pinned: true, dirty: false });
    } finally { await client.close(); }
  });

  it('serializes concurrent preview opens into one reusable slot', async () => {
    const { client, nodes, sessions } = await fixture();
    try {
      await Promise.all(Array.from({ length: 100 }, (_, index) => sessions.open({
        scope: 'user',
        libraryType: 'instrument',
        nodeId: nodes[index % nodes.length]!.id,
      })));
      expect(sessions.list()).toHaveLength(1);
      expect(sessions.list()[0]).toMatchObject({ dirty: false, pinned: false });
    } finally { await client.close(); }
  });

  it('reuses logical items and only replaces the clean unpinned preview slot', async () => {
    const { client, nodes, sessions } = await fixture();
    try {
      const first = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[0]!.id });
      expect((await sessions.open(first.key)).sessionId).toBe(first.sessionId);
      const second = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[1]!.id });
      expect(sessions.get(first.sessionId)).toBeNull();
      const dirty = sessions.patch(second.sessionId, {
        documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'Edited' } } },
      });
      expect(dirty).toMatchObject({ dirty: true, pinned: true });
      await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[0]!.id });
      expect(sessions.get(second.sessionId)?.dirty).toBe(true);

      const pinned = await sessions.open(
        { scope: 'user', libraryType: 'instrument', nodeId: nodes[2]!.id },
        true,
      );
      const preview = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[3]!.id });
      for (let index = 0; index < 100; index += 1) {
        const node = nodes[index % 3 === 0 ? 1 : index % 3 === 1 ? 2 : 3]!;
        await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: node.id });
      }
      expect(sessions.get(second.sessionId)).toMatchObject({ dirty: true, pinned: true });
      expect(sessions.get(pinned.sessionId)).toMatchObject({ pinned: true });
      expect(sessions.get(preview.sessionId)).toMatchObject({ dirty: false, pinned: false });
    } finally { await client.close(); }
  });

  it('saves, reverts, and reports external revision conflicts without losing drafts', async () => {
    const { client, nodes, sessions } = await fixture();
    try {
      const opened = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[0]!.id });
      sessions.patch(opened.sessionId, { documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'Saved' } } } });
      expect(await sessions.save(opened.sessionId)).toMatchObject({ status: 'saved' });
      sessions.patch(opened.sessionId, { documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'Draft' } } } });
      const reverted = await sessions.revert(opened.sessionId);
      expect(reverted.document).toMatchObject({ kind: 'instrument', snapshot: { name: 'Saved' } });

      sessions.patch(opened.sessionId, { documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'My Draft' } } } });
      await client.runForTesting((repository) => {
        const node = repository.getNode(nodes[0]!.id);
        repository.renameNode(node.id, node.revision, 'Externally Renamed');
      });
      expect(await sessions.save(opened.sessionId)).toMatchObject({ status: 'conflict' });
      expect(sessions.get(opened.sessionId)?.document).toMatchObject({ kind: 'instrument', snapshot: { name: 'My Draft' } });

      const cancelled = await sessions.resolveConflict(opened.sessionId, 'cancel');
      expect(cancelled).toMatchObject({ status: 'conflict', dirty: true });
      expect(cancelled.document).toMatchObject({ kind: 'instrument', snapshot: { name: 'My Draft' } });

      const overwritten = await sessions.resolveConflict(opened.sessionId, 'overwrite');
      expect(overwritten).toMatchObject({ status: 'ready', dirty: false, displayName: 'A' });
      expect((await client.getNode(nodes[0]!.id)).displayName).toBe('A');
      expect((await client.getItemPayload(nodes[0]!.id)).payloadXml).toContain('My Draft');

      sessions.patch(opened.sessionId, { documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'Second Draft' } } } });
      await client.runForTesting((repository) => {
        const node = repository.getNode(nodes[0]!.id);
        repository.renameNode(node.id, node.revision, 'Latest Name');
      });
      expect(await sessions.save(opened.sessionId)).toMatchObject({ status: 'conflict' });
      const reloaded = await sessions.resolveConflict(opened.sessionId, 'reloadLatest');
      expect(reloaded).toMatchObject({ status: 'ready', dirty: false, displayName: 'Latest Name' });
      expect(reloaded.document).toMatchObject({ kind: 'instrument', snapshot: { name: 'My Draft' } });
    } finally { await client.close(); }
  });

  it('refreshes clean organization metadata and refuses to close dirty deleted-node drafts', async () => {
    const { client, nodes, sessions } = await fixture();
    try {
      const opened = await sessions.open({ scope: 'user', libraryType: 'instrument', nodeId: nodes[0]!.id });
      const renamed = await client.renameNode(nodes[0]!.id, nodes[0]!.revision, 'Renamed in Tree');
      await sessions.reconcileUserNode(renamed.id);
      expect(sessions.get(opened.sessionId)).toMatchObject({
        displayName: 'Renamed in Tree',
        baseRevision: renamed.revision,
        dirty: false,
      });

      sessions.patch(opened.sessionId, {
        documentPatch: { kind: 'instrument', patch: { type: 'updateInstrument', assignmentId: 'library-item', patch: { name: 'Protected Draft' } } },
      });
      expect(sessions.getUserSessionsForNodeIds([renamed.id])).toHaveLength(1);
      expect(() => sessions.closeDeletedUserNodes([renamed.id])).toThrow(/dirty/i);
      expect(sessions.get(opened.sessionId)?.document).toMatchObject({ kind: 'instrument', snapshot: { name: 'Protected Draft' } });

      await sessions.revert(opened.sessionId);
      expect(sessions.closeDeletedUserNodes([renamed.id])).toEqual([opened.sessionId]);
      expect(sessions.get(opened.sessionId)).toBeNull();
    } finally { await client.close(); }
  });
});
