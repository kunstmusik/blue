import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  ProjectEditorSnapshot,
} from '../../shared/project-editor';
import type { PrepareHistoryBoundaryAck } from '../../shared/project-history';
import {
  createProjectPatchQueue,
  type ProjectPatchQueueDependencies,
} from '../stores/project-store/project-patch-queue';

function makePatch(tempo: number): ProjectDocumentPatch {
  return { blueLive: { type: 'updateTempoRepeat', patch: { tempo } } };
}

function makeLayerColorPatch(): ProjectDocumentPatch {
  return {
    score: {
      type: 'updateLayerState',
      groupId: 'group-1',
      layerIndex: 0,
      patch: { backgroundColor: -65536 },
    },
  };
}

function makeItemColorPatch(): ProjectDocumentPatch {
  return {
    score: {
      type: 'updateSharedProperties',
      target: {
        selectionId: 'item-1',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: {
          rootGroupIndex: 0,
          containerPath: [],
          layerIndex: 0,
          objectIndex: 0,
        },
      },
      patch: { backgroundColor: -65536 },
    },
  };
}

function makeReceipt(
  overrides: Partial<ProjectDocumentCommitReceipt> = {},
): ProjectDocumentCommitReceipt {
  return { changed: true, revision: 1, sessionId: 1, ...overrides };
}

function makeDependencies(
  overrides: Partial<ProjectPatchQueueDependencies> = {},
): ProjectPatchQueueDependencies & {
  commit: ReturnType<typeof vi.fn>;
  fetchCanonicalSnapshot: ReturnType<typeof vi.fn>;
  applyCanonicalSnapshot: ReturnType<typeof vi.fn>;
  setDirty: ReturnType<typeof vi.fn>;
  reportBackgroundError: ReturnType<typeof vi.fn>;
  logRefreshError: ReturnType<typeof vi.fn>;
  acknowledgeBoundary: ReturnType<typeof vi.fn>;
} {
  return {
    commit: vi.fn().mockResolvedValue(makeReceipt()),
    fetchCanonicalSnapshot: vi.fn().mockResolvedValue(null),
    applyCanonicalSnapshot: vi.fn(),
    setDirty: vi.fn(),
    reportBackgroundError: vi.fn(),
    logRefreshError: vi.fn(),
    acknowledgeBoundary: vi.fn(),
    ...overrides,
  };
}

describe('ProjectPatchQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a trailing 100 ms timer and commits FIFO batches', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);
    queue.enqueue(makePatch(90), false);
    await vi.advanceTimersByTimeAsync(99);
    expect(dependencies.commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await queue.awaitPending();

    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(60), makePatch(90)],
      expect.objectContaining({
        metadata: expect.objectContaining({ operationId: expect.any(String) }),
      }),
    );
  });

  it('does not overlap commits and drains edits added during the active commit', async () => {
    let resolveFirst!: (receipt: ProjectDocumentCommitReceipt) => void;
    const firstCommit = new Promise<ProjectDocumentCommitReceipt>((resolve) => {
      resolveFirst = resolve;
    });
    const dependencies = makeDependencies({
      commit: vi
        .fn()
        .mockReturnValueOnce(firstCommit)
        .mockResolvedValueOnce(makeReceipt({ revision: 2 })),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);
    const firstFlush = queue.flush();
    await Promise.resolve();
    queue.enqueue(makePatch(90), false);
    const secondFlush = queue.flush();

    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    resolveFirst(makeReceipt({ revision: 1 }));
    await firstFlush;
    await secondFlush;

    expect(dependencies.commit).toHaveBeenCalledTimes(2);
    expect(dependencies.commit.mock.calls[1]?.[0]).toEqual([makePatch(90)]);
  });

  it('restores an unchanged dirty baseline but leaves changed sequences dirty', async () => {
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValueOnce(makeReceipt({ changed: false })),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), true);
    await queue.flush();
    expect(dependencies.setDirty).toHaveBeenCalledWith(true);

    dependencies.setDirty.mockClear();
    dependencies.commit.mockResolvedValueOnce(makeReceipt({ changed: true, revision: 2 }));
    queue.enqueue(makePatch(90), false);
    await queue.flush();
    expect(dependencies.setDirty).not.toHaveBeenCalled();
  });

  it('refreshes canonical state for structural patches and logs refresh failures', async () => {
    const snapshot = {} as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(snapshot),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(
      {
        score: { type: 'renameLayerGroup', groupId: 'g1', name: 'Renamed' },
      } as ProjectDocumentPatch,
      false,
    );
    await queue.flush();
    expect(dependencies.fetchCanonicalSnapshot).toHaveBeenCalledTimes(1);
    expect(dependencies.applyCanonicalSnapshot).toHaveBeenCalledWith(snapshot, true);

    dependencies.fetchCanonicalSnapshot.mockRejectedValueOnce(new Error('refresh failed'));
    queue.enqueue(
      { clojureProject: { type: 'updateText', text: '(+ 1 2)' } } as ProjectDocumentPatch,
      false,
    );
    await queue.flush();
    expect(dependencies.logRefreshError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects explicit flushes, reports background failures, and never retries', async () => {
    const error = new Error('commit failed');
    const dependencies = makeDependencies({
      commit: vi.fn().mockRejectedValue(error),
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(null),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);
    await expect(queue.flush()).rejects.toThrow('commit failed');
    expect(dependencies.commit).toHaveBeenCalledTimes(1);

    queue.enqueue(makePatch(90), false);
    await vi.advanceTimersByTimeAsync(100);
    await queue.awaitPending();
    expect(dependencies.commit).toHaveBeenCalledTimes(2);
    expect(dependencies.reportBackgroundError).toHaveBeenCalledWith(error);
  });

  it('rejects stale layer and item color patches even when unrelated patches changed', async () => {
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(
        makeReceipt({
          changed: true,
          patchChanged: [true, false, false],
          patchAccepted: [true, false, false],
        }),
      ),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);
    queue.enqueue(makeLayerColorPatch(), false);
    queue.enqueue(makeItemColorPatch(), false);

    await expect(queue.flush()).rejects.toThrow('color change was not applied');
    expect(dependencies.fetchCanonicalSnapshot).toHaveBeenCalled();
  });

  it('accepts valid no-op color patches when acceptance is true despite no mutation', async () => {
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(
        makeReceipt({
          changed: true,
          patchChanged: [true, false, false],
          patchAccepted: [true, true, true],
        }),
      ),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);
    queue.enqueue(makeLayerColorPatch(), false);
    queue.enqueue(makeItemColorPatch(), false);

    await expect(queue.flush()).resolves.toBeUndefined();
    expect(dependencies.fetchCanonicalSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a genuinely rejected color patch even when the batch reports no mutation', async () => {
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(
        makeReceipt({
          changed: false,
          patchChanged: [false],
          patchAccepted: [false],
        }),
      ),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makeLayerColorPatch(), false);

    await expect(queue.flush()).rejects.toThrow('color change was not applied');
    expect(dependencies.fetchCanonicalSnapshot).toHaveBeenCalledTimes(1);
  });

  it('fences revisions and clears queued work on session changes', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);

    queue.acceptRevision(4, 8);
    queue.acceptRevision(4, 3);
    expect(queue.getSessionId()).toBe(4);
    expect(queue.getRevision()).toBe(8);

    queue.enqueue(makePatch(60), false);
    queue.acceptRevision(5, 2);
    expect(queue.getRevision()).toBe(2);
    expect(queue.getSessionId()).toBe(5);
    await queue.flush();
    expect(dependencies.commit).not.toHaveBeenCalled();

    queue.acceptRevision(-1, 99);
    queue.acceptRevision(5, -1);
    expect(queue.getRevision()).toBe(2);
  });

  it('forwards the latest commit metadata with the flushed batch', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false, { label: 'Move Score Object', phase: 'end' });
    await queue.flush();
    expect(dependencies.commit).toHaveBeenCalledWith([makePatch(60)], {
      metadata: {
        label: 'Move Score Object',
        phase: 'end',
        operationId: expect.any(String),
      },
    });

    dependencies.commit.mockClear();
    queue.enqueue(makePatch(70), false, { label: 'First' });
    queue.enqueue(makePatch(80), false, { label: 'Second' });
    await queue.flush();
    // The last metadata before the flush wins: it closes the batch.
    expect(dependencies.commit).toHaveBeenCalledWith([makePatch(70), makePatch(80)], {
      metadata: { label: 'Second', operationId: expect.any(String) },
    });

    dependencies.commit.mockClear();
    queue.enqueue(makePatch(90), false);
    await queue.flush();
    // Unlabeled batches still carry a generated operation id for echo
    // suppression, and labels do not leak between batches.
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(90)],
      expect.objectContaining({
        metadata: { operationId: expect.any(String) },
      }),
    );
  });

  it('tracks submitted operation ids for echo suppression and clears them on session change', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);

    let sentOperationId = '';
    dependencies.commit.mockImplementation(async (_patches, context) => {
      sentOperationId = context?.metadata?.operationId ?? '';
      return makeReceipt();
    });

    queue.enqueue(makePatch(60), false);
    await queue.flush();
    expect(sentOperationId).toMatch(/^op-/);
    expect(queue.ownsOperationIds([sentOperationId])).toBe(true);
    expect(queue.ownsOperationIds(['op-other-context'])).toBe(false);

    queue.acceptRevision(9, 0);
    expect(queue.ownsOperationIds([sentOperationId])).toBe(false);
  });

  it('ignores stale receipts and resets timers, queues, and revisions', async () => {
    let resolveCommit!: (receipt: ProjectDocumentCommitReceipt) => void;
    const dependencies = makeDependencies({
      commit: vi.fn().mockReturnValue(
        new Promise<ProjectDocumentCommitReceipt>((resolve) => {
          resolveCommit = resolve;
        }),
      ),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(7, 4);
    queue.enqueue(makePatch(60), false);
    const pending = queue.flush();
    await Promise.resolve();
    queue.reset(8);
    resolveCommit(makeReceipt({ sessionId: 7, revision: 99 }));
    await pending;

    expect(queue.getSessionId()).toBe(8);
    expect(queue.getRevision()).toBe(0);
    queue.clearPending();
    expect(dependencies.setDirty).not.toHaveBeenCalled();
  });
});

describe('ProjectPatchQueue settlement boundary participant (T016)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeParticipantDependencies(
    overrides: Partial<ProjectPatchQueueDependencies> = {},
  ): ProjectPatchQueueDependencies & {
    commit: ReturnType<typeof vi.fn>;
    acknowledgeBoundary: ReturnType<typeof vi.fn>;
  } {
    return makeDependencies({
      participantContextId: 'ctx-renderer-1',
      ...overrides,
    }) as ProjectPatchQueueDependencies & {
      commit: ReturnType<typeof vi.fn>;
      acknowledgeBoundary: ReturnType<typeof vi.fn>;
    };
  }

  it('drains the captured prefix with the barrier id instead of waiting for the flush timer', async () => {
    const dependencies = makeParticipantDependencies({
      commit: vi.fn().mockResolvedValue(makeReceipt({ revision: 5 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    queue.enqueue(makePatch(60), false);
    queue.enqueue(makePatch(90), false);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(60), makePatch(90)],
      expect.objectContaining({
        barrierId: 'barrier-1',
        metadata: expect.objectContaining({ operationId: expect.any(String) }),
      }),
    );
    expect(queue.isSettlementPaused()).toBe(true);
  });

  it('acknowledges zero outstanding prefix work after the prefix drains', async () => {
    const dependencies = makeParticipantDependencies({
      commit: vi.fn().mockResolvedValue(makeReceipt({ revision: 5 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    queue.enqueue(makePatch(60), false);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-renderer-1',
      lastAcknowledgedRevision: 5,
      lastAcknowledgedSequence: 1,
      outstandingPrefixCount: 0,
    } satisfies PrepareHistoryBoundaryAck);
  });

  it('acknowledges an empty prefix immediately without committing', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'save' });

    expect(dependencies.commit).not.toHaveBeenCalled();
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-renderer-1',
      lastAcknowledgedRevision: 0,
      lastAcknowledgedSequence: 0,
      outstandingPrefixCount: 0,
    } satisfies PrepareHistoryBoundaryAck);
  });

  it('holds patches enqueued during the pause as drafts and never submits them while paused', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    queue.enqueue(makePatch(90), false);

    await vi.advanceTimersByTimeAsync(500);
    expect(dependencies.commit).not.toHaveBeenCalled();
    expect(queue.isSettlementPaused()).toBe(true);
  });

  it('rejects explicit flushes while a settlement boundary is active', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(makePatch(60), false);

    const prepare = queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    await expect(queue.flush()).rejects.toThrow(/settlement boundary/i);
    await prepare;

    expect(dependencies.commit).toHaveBeenCalledTimes(1);
  });

  it('submits preserved drafts after a ready release with a fresh normal commit', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    queue.enqueue(makePatch(90), false);

    queue.handleReleaseBoundary({ barrierId: 'barrier-1', status: 'ready' });
    expect(queue.isSettlementPaused()).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    await queue.awaitPending();
    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(90)],
      expect.objectContaining({
        metadata: expect.objectContaining({ operationId: expect.any(String) }),
      }),
    );
  });

  it('submits preserved drafts after an aborted release so queued edits are not dropped', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    queue.enqueue(makePatch(90), false);

    queue.handleReleaseBoundary({ barrierId: 'barrier-1', status: 'aborted', reason: 'timed out' });
    await vi.advanceTimersByTimeAsync(100);
    await queue.awaitPending();
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(90)],
      expect.objectContaining({
        metadata: expect.objectContaining({ operationId: expect.any(String) }),
      }),
    );
  });

  it('retains conflicting prefix work as drafts and reports nonzero outstanding count', async () => {
    const dependencies = makeParticipantDependencies({
      commit: vi.fn().mockRejectedValue(new Error('conflicting prefix edit')),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(makePatch(60), false);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(dependencies.reportBackgroundError).toHaveBeenCalledWith(expect.any(Error));
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-renderer-1',
      lastAcknowledgedRevision: 0,
      lastAcknowledgedSequence: 1,
      outstandingPrefixCount: 1,
    } satisfies PrepareHistoryBoundaryAck);

    dependencies.commit.mockResolvedValue(makeReceipt({ revision: 2 }));
    queue.handleReleaseBoundary({ barrierId: 'barrier-1', status: 'ready' });
    await vi.advanceTimersByTimeAsync(100);
    await queue.awaitPending();
    expect(dependencies.commit).toHaveBeenLastCalledWith(
      [makePatch(60)],
      expect.objectContaining({
        metadata: expect.objectContaining({ operationId: expect.any(String) }),
      }),
    );
  });

  it('clears the active boundary when the project session changes', async () => {
    const dependencies = makeParticipantDependencies({
      commit: vi.fn().mockReturnValue(new Promise<ProjectDocumentCommitReceipt>(() => undefined)),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(makePatch(60), false);

    void queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    await vi.advanceTimersByTimeAsync(0);
    expect(dependencies.commit).toHaveBeenCalledTimes(1);

    queue.reset(9);
    expect(queue.isSettlementPaused()).toBe(false);
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(dependencies.commit).toHaveBeenCalledTimes(1);
  });

  it('ignores release events for stale barrier ids', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });
    queue.handleReleaseBoundary({ barrierId: 'barrier-stale', status: 'ready' });
    expect(queue.isSettlementPaused()).toBe(true);

    queue.enqueue(makePatch(90), false);
    await vi.advanceTimersByTimeAsync(500);
    expect(dependencies.commit).not.toHaveBeenCalled();
  });
});
