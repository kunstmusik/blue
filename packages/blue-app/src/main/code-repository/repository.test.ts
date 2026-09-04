import { describe, expect, it } from 'vitest';
import { CODE_REPOSITORY_ROOT_ID, createEmptyCodeRepositoryDocument } from '@blue/data';
import { CodeRepositoryRepository } from './repository';
import { createCodeRepositoryTestDirectory } from './test-helpers';

describe('CodeRepositoryRepository', () => {
  it('seeds the protected root on open and reports an empty uninitialized snapshot', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      const snapshot = repo.getSnapshot();
      expect(snapshot.root.id).toBe(CODE_REPOSITORY_ROOT_ID);
      expect(snapshot.root.kind).toBe('root');
      expect(snapshot.root.children).toEqual([]);
      expect(snapshot.contentRevision).toBe(0);
      expect(snapshot.initialized).toBe(false);
    } finally {
      repo.close();
    }
  });

  it('creates a group and snippet atomically and increments the revision', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'envelopes', 0);
      expect(snapshot.contentRevision).toBe(1);
      const group = snapshot.root.children?.[0];
      expect(group?.kind).toBe('group');
      expect(group?.name).toBe('envelopes');
      expect(group?.parentId).toBe(CODE_REPOSITORY_ROOT_ID);

      snapshot = repo.createSnippet(group!.id, 'pan', 'aout pan2 a', 1);
      expect(snapshot.contentRevision).toBe(2);
      expect(snapshot.initialized).toBe(true);
      const snippet = snapshot.root.children?.[0].children?.[0];
      expect(snippet?.kind).toBe('snippet');
      expect(snippet?.code).toBe('aout pan2 a');
    } finally {
      repo.close();
    }
  });

  it('protects the root from move, update, and delete', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      expect(() => repo.moveNode(CODE_REPOSITORY_ROOT_ID, 'x', 0, 0)).toThrow(/root-protected/);
      expect(() => repo.updateNode(CODE_REPOSITORY_ROOT_ID, { name: 'renamed' }, 0)).toThrow(
        /root-protected/,
      );
      expect(() => repo.deleteNode(CODE_REPOSITORY_ROOT_ID, 0)).toThrow(/root-protected/);
    } finally {
      repo.close();
    }
  });

  it('rejects blank mutation names and a draft with another root id', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      expect(() => repo.createGroup(CODE_REPOSITORY_ROOT_ID, '   ', 0)).toThrow(/empty-name/);
      const snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'valid', 0);
      const groupId = snapshot.root.children?.[0].id!;
      expect(() => repo.updateNode(groupId, { name: '' }, 1)).toThrow(/empty-name/);
      expect(() => repo.commitDraft(1, { ...snapshot.root, id: 'another-root' })).toThrow(
        /root-id/,
      );
    } finally {
      repo.close();
    }
  });

  it('rejects creating a node under a snippet parent', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      const snapshot = repo.createSnippet(CODE_REPOSITORY_ROOT_ID, 'solo', 'code', 0);
      const snippetId = snapshot.root.children?.[0].id!;
      expect(() => repo.createGroup(snippetId, 'bad', 1)).toThrow(/invalid-parent-kind/);
    } finally {
      repo.close();
    }
  });

  it('rejects moving a node into its own descendant (cycle)', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'outer', 0);
      const outerId = snapshot.root.children?.[0].id!;
      snapshot = repo.createGroup(outerId, 'inner', 1);
      const innerId = snapshot.root.children?.[0].children?.[0].id!;
      // Moving outer into inner should be rejected as a cycle.
      expect(() => repo.moveNode(outerId, innerId, 0, 2)).toThrow(/cycle/);
    } finally {
      repo.close();
    }
  });

  it('rolls back a failed draft commit without mutating the tree', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      const good = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'group', 0);
      // A draft with a snippet that has children is invalid.
      const badRoot = {
        ...good.root,
        children: [
          {
            id: 'snip-bad',
            kind: 'snippet' as const,
            name: 'bad',
            parentId: CODE_REPOSITORY_ROOT_ID,
            order: 0,
            code: 'x',
            children: [
              {
                id: 'child',
                kind: 'snippet' as const,
                name: 'c',
                parentId: 'snip-bad',
                order: 0,
                code: 'y',
              },
            ],
          },
        ],
      };
      expect(() => repo.commitDraft(1, badRoot)).toThrow(/invalid-tree/);
      // Tree is unchanged.
      const snapshot = repo.getSnapshot();
      expect(snapshot.root.children?.[0].name).toBe('group');
      expect(snapshot.root.children).toHaveLength(1);
    } finally {
      repo.close();
    }
  });

  it('persists across reopen (restart) and rejects stale revisions', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      let repo = CodeRepositoryRepository.open(dir.databasePath);
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'envelopes', 0);
      snapshot = repo.createSnippet(snapshot.root.children?.[0].id!, 'pan', 'aout pan2 a', 1);
      const beforeRestart = snapshot.contentRevision;
      repo.close();

      repo = CodeRepositoryRepository.open(dir.databasePath);
      const afterRestart = repo.getSnapshot();
      expect(afterRestart.contentRevision).toBe(beforeRestart);
      expect(afterRestart.root.children?.[0].name).toBe('envelopes');
      expect(afterRestart.root.children?.[0].children?.[0].code).toBe('aout pan2 a');

      // A stale expected revision is rejected with revision-conflict.
      expect(() => repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'stale', 0)).toThrow(
        /revision-conflict/,
      );
      repo.close();
    } finally {
      dir.cleanup();
    }
  });

  it('atomically replaces the whole tree on commitDraft', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      // Seed an initial tree, then commit a completely different draft.
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'old', 0);
      const initialRevision = snapshot.contentRevision;
      const draft = {
        ...createEmptyCodeRepositoryDocument().root,
        children: [
          {
            id: 'grp-new',
            kind: 'group' as const,
            name: 'new group',
            parentId: CODE_REPOSITORY_ROOT_ID,
            order: 0,
            children: [
              {
                id: 'snip-new',
                kind: 'snippet' as const,
                name: 'fresh',
                parentId: 'grp-new',
                order: 0,
                code: 'fresh code',
              },
            ],
          },
        ],
      };
      snapshot = repo.commitDraft(initialRevision, draft);
      expect(snapshot.root.children?.[0].name).toBe('new group');
      expect(snapshot.root.children?.[0].children?.[0].code).toBe('fresh code');
      // The old group is gone.
      expect(snapshot.root.children).toHaveLength(1);
    } finally {
      repo.close();
    }
  });

  it('reorders siblings on move and keeps order contiguous', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'a', 0);
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'b', 1);
      const bId = snapshot.root.children?.find((c) => c.name === 'b')?.id!;
      // Move b to position 0.
      snapshot = repo.moveNode(bId, CODE_REPOSITORY_ROOT_ID, 0, 2);
      const children = snapshot.root.children ?? [];
      expect(children[0].name).toBe('b');
      expect(children[1].name).toBe('a');
      expect(children.map((c) => c.order)).toEqual([0, 1]);
    } finally {
      repo.close();
    }
  });

  it('cascades delete to descendants', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      let snapshot = repo.createGroup(CODE_REPOSITORY_ROOT_ID, 'parent', 0);
      const parentId = snapshot.root.children?.[0].id!;
      snapshot = repo.createGroup(parentId, 'child', 1);
      const revision = snapshot.contentRevision;
      snapshot = repo.deleteNode(parentId, revision);
      expect(snapshot.root.children).toEqual([]);
    } finally {
      repo.close();
    }
  });

  it('normalizes remaining sibling order after delete and rolls back import/provenance failures', () => {
    const repo = CodeRepositoryRepository.open(':memory:');
    try {
      repo.createSnippet(CODE_REPOSITORY_ROOT_ID, 'first', '', 0);
      let snapshot = repo.createSnippet(CODE_REPOSITORY_ROOT_ID, 'second', '', 1);
      const firstId = snapshot.root.children?.[0].id!;
      snapshot = repo.deleteNode(firstId, 2);
      expect(snapshot.root.children?.map((node) => node.order)).toEqual([0]);

      const before = snapshot.root.children?.map((node) => node.name);
      expect(() =>
        repo.importTree(snapshot.contentRevision, snapshot.root, {
          id: 'bad-provenance',
          sourcePath: 'fixture.xml',
          sourceHash: 'hash',
          sourceKind: 'unsupported' as never,
          status: 'succeeded',
          nodeCount: 1,
          diagnostics: null,
        }),
      ).toThrow();
      expect(repo.getSnapshot().root.children?.map((node) => node.name)).toEqual(before);
    } finally {
      repo.close();
    }
  });
});
