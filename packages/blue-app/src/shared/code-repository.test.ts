import { describe, expect, it } from 'vitest';
import {
  isCodeRepositoryChangedEvent,
  isCodeRepositoryError,
  isCodeRepositoryExportFileResult,
  isCodeRepositoryNode,
  isCodeRepositoryResult,
  isCodeRepositorySnapshot,
  isCodeRepositoryStatus,
} from './code-repository';

describe('Code Repository IPC contract guards', () => {
  const validNode = {
    id: 'grp-1',
    kind: 'group',
    name: 'envelopes',
    parentId: '00000000-0000-4000-8000-000000000001',
    order: 0,
    children: [],
  };

  describe('isCodeRepositoryNode', () => {
    it('accepts a valid node', () => {
      expect(isCodeRepositoryNode(validNode)).toBe(true);
    });
    it('accepts a snippet with code', () => {
      expect(
        isCodeRepositoryNode({
          id: 'snip-1',
          kind: 'snippet',
          name: 's',
          parentId: 'grp-1',
          order: 0,
          code: 'a out',
        }),
      ).toBe(true);
    });
    it('rejects an empty id', () => {
      expect(isCodeRepositoryNode({ ...validNode, id: '' })).toBe(false);
    });
    it('rejects an unknown kind', () => {
      expect(isCodeRepositoryNode({ ...validNode, kind: 'bogus' })).toBe(false);
    });
    it('rejects a negative order', () => {
      expect(isCodeRepositoryNode({ ...validNode, order: -1 })).toBe(false);
    });
    it('rejects non-array children', () => {
      expect(isCodeRepositoryNode({ ...validNode, children: 'nope' })).toBe(false);
    });
  });

  describe('isCodeRepositorySnapshot', () => {
    const validSnapshot = {
      root: {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'root',
        name: 'Code Repository',
        parentId: null,
        order: 0,
        children: [],
      },
      contentRevision: 3,
      initialized: true,
    };
    it('accepts a valid snapshot', () => {
      expect(isCodeRepositorySnapshot(validSnapshot)).toBe(true);
    });
    it('rejects a negative revision', () => {
      expect(isCodeRepositorySnapshot({ ...validSnapshot, contentRevision: -1 })).toBe(false);
    });
    it('rejects a missing initialized flag', () => {
      const { initialized: _drop, ...rest } = validSnapshot;
      void _drop;
      expect(isCodeRepositorySnapshot(rest)).toBe(false);
    });
    it('rejects a snapshot with an untrusted root identity', () => {
      expect(
        isCodeRepositorySnapshot({
          ...validSnapshot,
          root: { ...validSnapshot.root, id: 'other-root' },
        }),
      ).toBe(false);
    });
    it('rejects a snapshot whose nested tree violates canonical invariants', () => {
      expect(
        isCodeRepositorySnapshot({
          ...validSnapshot,
          root: {
            ...validSnapshot.root,
            children: [
              {
                id: 'snippet',
                kind: 'snippet',
                name: 'Snippet',
                parentId: validSnapshot.root.id,
                order: 2,
              },
            ],
          },
        }),
      ).toBe(false);
    });
  });

  describe('isCodeRepositoryStatus', () => {
    it('accepts a valid status without a diagnostic', () => {
      expect(
        isCodeRepositoryStatus({
          available: true,
          migrationStatus: 'succeeded',
        }),
      ).toBe(true);
    });
    it('accepts a status with a diagnostic', () => {
      expect(
        isCodeRepositoryStatus({
          available: false,
          migrationStatus: 'failed',
          diagnostic: { code: 'storage-unavailable', message: 'db locked' },
        }),
      ).toBe(true);
    });
    it('rejects an unknown migration status', () => {
      expect(isCodeRepositoryStatus({ available: true, migrationStatus: 'wat' })).toBe(false);
    });
    it('rejects a malformed diagnostic source label', () => {
      expect(
        isCodeRepositoryStatus({
          available: true,
          migrationStatus: 'failed',
          diagnostic: {
            code: 'source-unreadable',
            message: 'missing',
            sourceLabel: 1,
          },
        }),
      ).toBe(false);
      expect(
        isCodeRepositoryStatus({
          available: false,
          migrationStatus: 'failed',
          diagnostic: {
            code: 'source-unreadable',
            message: 'missing',
            sourceLabel: '/private/user/codeRepository.xml',
          },
        }),
      ).toBe(false);
    });
  });

  describe('isCodeRepositoryChangedEvent', () => {
    it('accepts a valid event', () => {
      expect(isCodeRepositoryChangedEvent({ contentRevision: 5, reason: 'commit' })).toBe(true);
    });
    it('rejects an unknown reason', () => {
      expect(isCodeRepositoryChangedEvent({ contentRevision: 5, reason: 'bogus' })).toBe(false);
    });
    it('rejects a non-integer revision', () => {
      expect(
        isCodeRepositoryChangedEvent({
          contentRevision: 1.5,
          reason: 'import',
        }),
      ).toBe(false);
      expect(isCodeRepositoryChangedEvent({ contentRevision: -1, reason: 'import' })).toBe(false);
    });
  });

  describe('result envelopes', () => {
    const validSnapshot = {
      root: {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'root',
        name: 'Code Repository',
        parentId: null,
        order: 0,
        children: [],
      },
      contentRevision: 0,
      initialized: true,
    };

    it('accepts only stable success and failure payload shapes', () => {
      expect(
        isCodeRepositoryResult({ ok: true, value: validSnapshot }, isCodeRepositorySnapshot),
      ).toBe(true);
      expect(
        isCodeRepositoryResult(
          {
            ok: false,
            error: {
              code: 'storage-unavailable',
              message: 'locked',
              retryable: true,
            },
          },
          isCodeRepositorySnapshot,
        ),
      ).toBe(true);
      expect(
        isCodeRepositoryResult({ ok: true, value: { malformed: true } }, isCodeRepositorySnapshot),
      ).toBe(false);
      expect(
        isCodeRepositoryResult({ ok: false, error: { code: 'unknown' } }, isCodeRepositorySnapshot),
      ).toBe(false);
    });

    it('rejects malformed errors before they reach the renderer', () => {
      expect(
        isCodeRepositoryError({
          code: 'revision-conflict',
          message: 'stale',
          retryable: true,
          currentSnapshot: validSnapshot,
        }),
      ).toBe(true);
      expect(
        isCodeRepositoryError({
          code: 'revision-conflict',
          message: 1,
          retryable: true,
        }),
      ).toBe(false);
      expect(
        isCodeRepositoryError({
          code: 'revision-conflict',
          message: 'stale',
          retryable: 'yes',
        }),
      ).toBe(false);
    });
  });

  it('keeps export filesystem paths behind main', () => {
    expect(isCodeRepositoryExportFileResult({ basename: 'codeRepository.xml' })).toBe(true);
    expect(isCodeRepositoryExportFileResult({ basename: '/private/user/codeRepository.xml' })).toBe(
      false,
    );
    expect(
      isCodeRepositoryExportFileResult({ basename: 'C:\\Users\\name\\codeRepository.xml' }),
    ).toBe(false);
    expect(
      isCodeRepositoryExportFileResult({
        path: '/private/user/codeRepository.xml',
        basename: 'codeRepository.xml',
      }),
    ).toBe(false);
    expect(
      isCodeRepositoryExportFileResult({
        path: '/private/user/codeRepository.xml',
      }),
    ).toBe(false);
  });
});
