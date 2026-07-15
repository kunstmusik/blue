import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepository } from './repository';

const PAYLOAD = {
  embeddedName: 'Item', objectType: 'test.Item', supportStatus: 'supported' as const,
  supportReasonCode: null, supportMessage: null, payloadXml: '<item/>', rawHash: 'r',
  canonicalContentHash: 'c', serializerRevision: '1', preview: {}, dependencies: {},
  metadataRevision: 1,
};

describe('repository hierarchy mutations', () => {
  it('moves, reorders, duplicates, and deletes nodes atomically with stable identity', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const a = repository.createFolder({ libraryType: 'instrument', parentId: root.id, displayName: 'A' });
      const b = repository.createFolder({ libraryType: 'instrument', parentId: root.id, displayName: 'B' });
      const item = repository.createItem({ libraryType: 'instrument', parentId: a.id, displayName: 'Item', payload: PAYLOAD });
      const moved = repository.moveNode(item.id, item.revision, b.id, 0);
      expect(moved.id).toBe(item.id);
      expect(moved.parentId).toBe(b.id);
      const duplicate = repository.duplicateNode(moved.id, moved.revision, a.id, 0);
      expect(duplicate.id).not.toBe(item.id);
      repository.reorderNode(b.id, b.revision, 0);
      expect(repository.listChildren(root.id)[0]?.id).toBe(b.id);
      expect(repository.deleteNode(duplicate.id, duplicate.revision)).toEqual([duplicate.id]);
      expect(() => repository.getNode(duplicate.id)).toThrow(/not found/i);
    } finally { repository.close(); }
  });

  it('rejects roots, descendants, cross-type moves, stale revisions, and invalid names', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const effectRoot = repository.getRoot('effect');
      const parent = repository.createFolder({ libraryType: 'instrument', parentId: root.id, displayName: 'Parent' });
      const child = repository.createFolder({ libraryType: 'instrument', parentId: parent.id, displayName: 'Child' });
      expect(() => repository.moveNode(parent.id, parent.revision, child.id, 0)).toThrow(/descendant/i);
      expect(() => repository.moveNode(child.id, child.revision, effectRoot.id, 0)).toThrow(/type/i);
      expect(() => repository.renameNode(child.id, child.revision, '  ')).toThrow(/invalid/i);
      expect(() => repository.deleteNode(root.id, root.revision)).toThrow(/root/i);
      expect(() => repository.reorderNode(child.id, child.revision + 1, 0)).toThrow(/stale/i);
      expect(repository.getNode(parent.id).parentId).toBe(root.id);
    } finally { repository.close(); }
  });
});
