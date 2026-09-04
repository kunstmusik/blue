import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepository } from './repository';

const PAYLOAD = {
  embeddedName: 'Item',
  objectType: 'test.Item',
  supportStatus: 'supported' as const,
  supportReasonCode: null,
  supportMessage: null,
  payloadXml: '<item/>',
  rawHash: 'r',
  canonicalContentHash: 'c',
  serializerRevision: '1',
  preview: {},
  dependencies: {},
  metadataRevision: 1,
};

describe('repository hierarchy mutations', () => {
  it('moves, reorders, duplicates, and deletes nodes atomically with stable identity', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const a = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'A',
      });
      const b = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'B',
      });
      const item = repository.createItem({
        libraryType: 'instrument',
        parentId: a.id,
        displayName: 'Item',
        payload: PAYLOAD,
      });
      const moved = repository.moveNode(item.id, item.revision, b.id, 0);
      expect(moved.id).toBe(item.id);
      expect(moved.parentId).toBe(b.id);
      const duplicate = repository.duplicateNode(moved.id, moved.revision, a.id, 0);
      expect(duplicate.id).not.toBe(item.id);
      repository.reorderNode(b.id, b.revision, 0);
      expect(repository.listChildren(root.id)[0]?.id).toBe(b.id);
      expect(repository.deleteNode(duplicate.id, duplicate.revision)).toEqual([duplicate.id]);
      expect(() => repository.getNode(duplicate.id)).toThrow(/not found/i);
    } finally {
      repository.close();
    }
  });

  it('rejects roots, descendants, cross-type moves, stale revisions, and invalid names', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const effectRoot = repository.getRoot('effect');
      const parent = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Parent',
      });
      const child = repository.createFolder({
        libraryType: 'instrument',
        parentId: parent.id,
        displayName: 'Child',
      });
      expect(() => repository.moveNode(parent.id, parent.revision, child.id, 0)).toThrow(
        /descendant/i,
      );
      expect(() => repository.moveNode(child.id, child.revision, effectRoot.id, 0)).toThrow(
        /type/i,
      );
      expect(() => repository.renameNode(child.id, child.revision, '  ')).toThrow(/invalid/i);
      expect(() => repository.deleteNode(root.id, root.revision)).toThrow(/root/i);
      expect(() => repository.reorderNode(child.id, child.revision + 1, 0)).toThrow(/stale/i);
      expect(repository.getNode(parent.id).parentId).toBe(root.id);
    } finally {
      repository.close();
    }
  });

  it('deep-copies folder identities and rolls back stale destination Paste atomically', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const sourceFolder = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Source',
      });
      const child = repository.createItem({
        libraryType: 'instrument',
        parentId: sourceFolder.id,
        displayName: 'Child',
        payload: PAYLOAD,
      });
      const target = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Target',
      });
      const duplicate = repository.duplicateNode(
        sourceFolder.id,
        sourceFolder.revision,
        target.id,
        0,
        target.revision,
      );
      const duplicateChild = repository.listChildren(duplicate.id)[0]!;
      expect(duplicate.id).not.toBe(sourceFolder.id);
      expect(duplicateChild.id).not.toBe(child.id);
      expect(repository.getItemPayload(duplicateChild.id).payloadXml).toBe(PAYLOAD.payloadXml);

      const renamedTarget = repository.renameNode(target.id, target.revision, 'Renamed Target');
      const before = repository.getSnapshot().contentRevision;
      expect(() =>
        repository.moveNode(child.id, child.revision, renamedTarget.id, 0, target.revision),
      ).toThrow(/stale destination/i);
      expect(repository.getNode(child.id).parentId).toBe(sourceFolder.id);
      expect(repository.getSnapshot().contentRevision).toBe(before);
    } finally {
      repository.close();
    }
  });

  it('captures every confirmed folder child and removes the source in one Cut transaction', () => {
    const repository = UnifiedLibraryRepository.open(':memory:');
    try {
      const root = repository.getRoot('instrument');
      const folder = repository.createFolder({
        libraryType: 'instrument',
        parentId: root.id,
        displayName: 'Source',
      });
      const first = repository.createItem({
        libraryType: 'instrument',
        parentId: folder.id,
        displayName: 'First',
        payload: PAYLOAD,
      });
      const staleContents = repository.listDescendantNodeIds(folder.id);
      const second = repository.createItem({
        libraryType: 'instrument',
        parentId: folder.id,
        displayName: 'Second',
        payload: PAYLOAD,
      });
      expect(() =>
        repository.cutClipboardSubtree(folder.id, folder.revision, staleContents),
      ).toThrow(/stale folder contents/i);
      expect(repository.getNode(first.id).parentId).toBe(folder.id);
      expect(repository.getNode(second.id).parentId).toBe(folder.id);

      const cut = repository.cutClipboardSubtree(
        folder.id,
        folder.revision,
        repository.listDescendantNodeIds(folder.id),
      );
      expect(cut.subtree).toMatchObject({
        nodeKind: 'folder',
        displayName: 'Source',
        children: [{ displayName: 'First' }, { displayName: 'Second' }],
      });
      expect(() => repository.getNode(folder.id)).toThrow(/not found/i);

      const pasted = repository.createClipboardSubtree(root.id, cut.subtree);
      expect(repository.listChildren(pasted.id).map((node) => node.displayName)).toEqual([
        'First',
        'Second',
      ]);
    } finally {
      repository.close();
    }
  });
});
