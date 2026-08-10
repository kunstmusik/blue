// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CODE_REPOSITORY_ROOT_ID, createEmptyCodeRepositoryDocument } from '@blue/data';
import { useCodeRepositoryStore } from '../stores/code-repository-store';

function makeSnapshot(revision: number, names: string[] = []) {
  const doc = createEmptyCodeRepositoryDocument();
  return {
    root: {
      ...doc.root,
      children: names.map((name, i) => ({
        id: `snip-${i}`,
        kind: 'snippet' as const,
        name,
        parentId: CODE_REPOSITORY_ROOT_ID,
        order: i,
        code: `code-${name}`,
      })),
    },
    contentRevision: revision,
    initialized: true,
  };
}

describe('useCodeRepositoryStore', () => {
  beforeEach(() => {
    (globalThis as unknown as { blueAPI?: Record<string, unknown> }).blueAPI = {
      getCodeRepositorySnapshot: vi.fn(async () => ({
        ok: true,
        value: makeSnapshot(3, ['a', 'b']),
      })),
      onCodeRepositoryChanged: vi.fn(() => () => undefined),
      commitCodeRepositoryDraft: vi.fn(),
    };
    useCodeRepositoryStore.setState({
      snapshot: null,
      expectedRevision: 0,
      loading: false,
      initialized: false,
      loadError: null,
      conflict: null,
      status: null,
    });
  });

  afterEach(() => {
    delete (globalThis as { blueAPI?: Record<string, unknown> }).blueAPI;
  });

  it('refresh loads the canonical snapshot from the bridge', async () => {
    await useCodeRepositoryStore.getState().refresh();
    const snapshot = useCodeRepositoryStore.getState().snapshot;
    expect(snapshot?.contentRevision).toBe(3);
    expect(snapshot?.root.children).toHaveLength(2);
  });

  it('openEditor captures the expected revision for atomic commit', async () => {
    await useCodeRepositoryStore.getState().openEditor();
    expect(useCodeRepositoryStore.getState().expectedRevision).toBe(3);
    expect(useCodeRepositoryStore.getState().conflict).toBeNull();
  });

  it('retains a typed snapshot error for recoverable user feedback', async () => {
    const error = {
      code: 'storage-unavailable' as const,
      message: 'Repository database could not be opened',
      retryable: true,
    };
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI.getCodeRepositorySnapshot = vi.fn(
      async () => ({
        ok: false as const,
        error,
      }),
    );

    await useCodeRepositoryStore.getState().refresh();

    expect(useCodeRepositoryStore.getState().snapshot).toBeNull();
    expect(useCodeRepositoryStore.getState().loadError).toEqual(error);
  });

  it('save commits the provided draft and updates the snapshot', async () => {
    const commit = vi.fn(async () => ({
      ok: true as const,
      value: makeSnapshot(4, ['x']),
    }));
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI.commitCodeRepositoryDraft = commit;
    await useCodeRepositoryStore.getState().openEditor();
    const draft = useCodeRepositoryStore.getState().snapshot!.root;
    const result = await useCodeRepositoryStore.getState().save(draft);
    expect(result.ok).toBe(true);
    expect(commit).toHaveBeenCalledWith({ expectedRevision: 3, root: draft });
    expect(useCodeRepositoryStore.getState().snapshot?.contentRevision).toBe(4);
  });

  it('save surfaces a revision-conflict and keeps the snapshot available', async () => {
    const commit = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'revision-conflict' as const,
        message: 'modified elsewhere',
        retryable: true,
        currentSnapshot: makeSnapshot(4, ['saved elsewhere']),
      },
    }));
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI.commitCodeRepositoryDraft = commit;
    await useCodeRepositoryStore.getState().openEditor();
    const draft = useCodeRepositoryStore.getState().snapshot!.root;
    const result = await useCodeRepositoryStore.getState().save(draft);
    expect(result.ok).toBe(false);
    expect(useCodeRepositoryStore.getState().conflict?.code).toBe('revision-conflict');
    expect(useCodeRepositoryStore.getState().snapshot?.contentRevision).toBe(4);
    expect(useCodeRepositoryStore.getState().expectedRevision).toBe(3);

    await useCodeRepositoryStore.getState().save(draft);
    expect(commit).toHaveBeenLastCalledWith({
      expectedRevision: 3,
      root: draft,
    });

    useCodeRepositoryStore.getState().reloadConflict();
    expect(useCodeRepositoryStore.getState().expectedRevision).toBe(4);
    expect(useCodeRepositoryStore.getState().conflict).toBeNull();
  });

  it('allows valid-source recovery when no database snapshot is available', async () => {
    const recovered = makeSnapshot(1, ['recovered']);
    const importFile = vi.fn(async () => ({
      ok: true as const,
      value: { snapshot: recovered, importedNodeCount: 1, sourceHash: 'hash' },
    }));
    (globalThis as unknown as { blueAPI: Record<string, unknown> }).blueAPI.importCodeRepositoryFile = importFile;

    const result = await useCodeRepositoryStore.getState().importFile();

    expect(result).toEqual({ ok: true });
    expect(importFile).toHaveBeenCalledWith({ expectedRevision: 0 });
    expect(useCodeRepositoryStore.getState().snapshot).toEqual(recovered);
  });
});
