import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BlueData, ClojureLibraryEntry, ClojureProjectData } from '@blue/data';
import { createProjectEditorSnapshot } from '../../shared/project-editor';
import { ProjectHistory } from '../../main/project-history';
import { ProjectSession } from '../../main/project-session';
import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  ProjectEditorSnapshot,
} from '../../shared/project-editor';
import type {
  PrepareHistoryBoundaryAck,
  ProjectHistoryStateProjection,
} from '../../shared/project-history';
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

function makeClojurePatch(
  firstCoordinates: string,
  secondCoordinates: string,
): ProjectDocumentPatch {
  return {
    clojureProject: {
      libraryEntries: [
        { entryId: 'clj-a', dependencyCoordinates: firstCoordinates, version: '1.0.0' },
        { entryId: 'clj-b', dependencyCoordinates: secondCoordinates, version: '2.0.0' },
      ],
    },
  };
}

function makeReceipt(
  overrides: Partial<ProjectDocumentCommitReceipt> = {},
): ProjectDocumentCommitReceipt {
  return { changed: true, revision: 1, sessionId: 1, ...overrides };
}

function makeHistoryProjection(revision: number, dirty: boolean): ProjectHistoryStateProjection {
  const savedStateId = 'state-saved';
  return {
    canUndo: revision > 0,
    canRedo: false,
    undoLabel: revision > 0 ? 'Edit' : null,
    redoLabel: null,
    cursor: revision,
    length: revision,
    retainedBytes: 0,
    savedStateId,
    stateId: dirty ? `state-${revision}` : savedStateId,
    revision,
  };
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

  it('forwards an explicit revision fence for ordinary score transactions', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);
    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setLayerHeights',
        scopeGroupId: null,
        updates: [{ groupId: 'group-1', layerIndex: 0, layerSelectionId: 'layer-1', height: 57 }],
      },
    };

    queue.acceptRevision(1, 7);
    queue.enqueue(patch, false, {
      label: 'Resize Layer',
      phase: 'single',
      expectedRevision: 7,
      operationId: 'height-operation-1',
    });
    await queue.flush();

    expect(dependencies.commit).toHaveBeenCalledWith(
      [patch],
      expect.objectContaining({
        expectedRevision: 7,
        metadata: expect.objectContaining({ operationId: 'height-operation-1' }),
      }),
    );
  });

  it('hands a normal oversize transaction to confirmation with its exact patches', async () => {
    const onOversizeProposal = vi.fn();
    const patch = makePatch(60);
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(
        makeReceipt({
          changed: false,
          oversizeProposal: {
            token: 'oversize-1',
            estimatedBytes: 100,
            limitBytes: 50,
            explanation: 'too large',
          },
        }),
      ),
      onOversizeProposal,
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(patch, false);

    await queue.flush();
    await queue.awaitPending();

    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    expect(onOversizeProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'oversize-1',
        patches: [patch],
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

  it('treats an error-bearing receipt as a failed commit and refreshes canonical state', async () => {
    const snapshot = {} as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      commit: vi
        .fn()
        .mockResolvedValue(makeReceipt({ changed: false, error: 'invalid project patch' })),
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(snapshot),
    });
    const queue = createProjectPatchQueue(dependencies);

    queue.enqueue(makePatch(60), false);

    await expect(queue.flush()).rejects.toThrow('invalid project patch');
    expect(dependencies.fetchCanonicalSnapshot).toHaveBeenCalledTimes(1);
    expect(dependencies.applyCanonicalSnapshot).toHaveBeenCalledWith(snapshot, true);
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
        contextSequence: 1,
      },
    });

    dependencies.commit.mockClear();
    queue.enqueue(makePatch(70), false, { label: 'First' });
    queue.enqueue(makePatch(80), false, { label: 'Second' });
    await queue.flush();
    // The last metadata before the flush wins: it closes the batch.
    expect(dependencies.commit).toHaveBeenCalledWith([makePatch(70), makePatch(80)], {
      metadata: { label: 'Second', operationId: expect.any(String), contextSequence: 2 },
    });

    dependencies.commit.mockClear();
    queue.enqueue(makePatch(90), false);
    await queue.flush();
    // Unlabeled batches still carry a generated operation id for echo
    // suppression, and labels do not leak between batches.
    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(90)],
      expect.objectContaining({
        metadata: expect.objectContaining({
          operationId: expect.any(String),
          contextSequence: 3,
        }),
      }),
    );
  });

  it('keeps different gesture transactions in separate history commits', async () => {
    const dependencies = makeDependencies();
    const queue = createProjectPatchQueue(dependencies);
    const insertGesture = 'insert-gesture';
    const deleteGesture = 'delete-gesture';

    queue.enqueue(makePatch(1), false, { gestureId: insertGesture, phase: 'begin' });
    queue.enqueue(makePatch(2), false, { gestureId: insertGesture, phase: 'update' });
    queue.enqueue(makePatch(1), false, { gestureId: deleteGesture, phase: 'begin' });
    await queue.flush();

    expect(dependencies.commit).toHaveBeenCalledTimes(2);
    expect(dependencies.commit.mock.calls[0]).toEqual([
      [makePatch(1), makePatch(2)],
      expect.objectContaining({
        metadata: expect.objectContaining({
          gestureId: insertGesture,
          phase: 'begin',
        }),
      }),
    ]);
    expect(dependencies.commit.mock.calls[1]).toEqual([
      [makePatch(1)],
      expect.objectContaining({
        metadata: expect.objectContaining({
          gestureId: deleteGesture,
          phase: 'begin',
        }),
      }),
    ]);
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

  it('prepares a queued Clojure field edit from the latest canonical list', async () => {
    const canonical = {
      clojureProject: {
        libraryEntries: [
          { entryId: 'clj-a', dependencyCoordinates: 'aaa', version: '1.0.0' },
          { entryId: 'clj-b', dependencyCoordinates: 'bbby', version: '2.0.0' },
        ],
      },
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
      commit: vi.fn().mockResolvedValue(makeReceipt({ sessionId: 1, revision: 3 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 2);

    queue.enqueue(
      makeClojurePatch('aaax', 'bbb'),
      false,
      {
        fieldId: 'clojure-library:clj-a:coordinates',
        phase: 'single',
      },
      {
        entryId: 'clj-a',
        field: 'dependencyCoordinates',
        baseValue: 'aaa',
        value: 'aaax',
      },
    );

    await queue.flush();

    expect(dependencies.commit).toHaveBeenCalledWith(
      [makeClojurePatch('aaax', 'bbby')],
      expect.objectContaining({
        expectedRevision: 2,
        metadata: expect.objectContaining({ fieldId: 'clojure-library:clj-a:coordinates' }),
      }),
    );
  });

  it.each(['ordinary', 'boundary'] as const)(
    'invalidates %s preparation before sending an old-project payload',
    async (mode) => {
      let release!: (snapshot: ProjectEditorSnapshot) => void;
      const dependencies = makeDependencies({
        fetchCanonicalSnapshot: vi.fn().mockImplementationOnce(
          () =>
            new Promise<ProjectEditorSnapshot>((resolve) => {
              release = resolve;
            }),
        ),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(1, 1);
      queue.enqueue(
        makeClojurePatch('aaax', 'bbb'),
        false,
        { phase: 'single' },
        {
          entryId: 'clj-a',
          field: 'dependencyCoordinates',
          baseValue: 'aaa',
          value: 'aaax',
        },
      );
      const work =
        mode === 'ordinary'
          ? queue.flush()
          : queue.handlePrepareBoundary({ barrierId: 'old', reason: 'undo' });
      await Promise.resolve();
      await Promise.resolve();
      queue.reset(2);
      release({
        clojureProject: makeClojurePatch('aaa', 'bbb').clojureProject,
      } as ProjectEditorSnapshot);
      await work;
      expect(dependencies.commit).not.toHaveBeenCalled();
      expect(dependencies.applyCanonicalSnapshot).not.toHaveBeenCalled();
    },
  );

  it.each(['ordinary', 'boundary'] as const)(
    'preserves remote updates and removals during %s preparation with one history owner',
    async (mode) => {
      const data = new BlueData();
      const clojure = new ClojureProjectData();
      for (const name of ['aaa', 'bbb', 'ccc']) {
        const entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates(name);
        clojure.addLibraryEntry(entry);
      }
      data.setClojureProjectData(clojure);
      const session = new ProjectSession();
      session.replace(data, join(tmpdir(), 'held-clojure.blue'));
      const documentId = session.read().documentId!;
      const snapshot = () =>
        createProjectEditorSnapshot(
          session.read().data!,
          session.read().filePath,
          session.read().sessionId,
          documentId,
        );
      const initial = snapshot();
      const history = new ProjectHistory({ session });
      let release!: (value: ProjectEditorSnapshot) => void;
      const dependencies = makeDependencies({
        fetchCanonicalSnapshot: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<ProjectEditorSnapshot>((resolve) => {
                release = resolve;
              }),
          )
          .mockImplementation(async () => snapshot()),
        commit: vi.fn(async (patches, context) => {
          const response = await history.commit({
            documentId,
            operationId: 'local-held',
            contextSequence: 1,
            origin: { contextId: 'local' },
            expectedRevision: context!.expectedRevision!,
            label: 'Local field',
            patches,
          });
          if (response.status !== 'committed') throw new Error(response.status);
          return response.receipt!;
        }),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(session.read().sessionId, 0);
      const first = initial.clojureProject.libraryEntries[0]!;
      queue.enqueue(
        {
          clojureProject: {
            libraryEntries: initial.clojureProject.libraryEntries.map((entry, index) => ({
              ...entry,
              dependencyCoordinates: index === 0 ? 'aaax' : entry.dependencyCoordinates,
            })),
          },
        },
        false,
        { phase: 'single' },
        {
          entryId: first.entryId,
          field: 'dependencyCoordinates',
          baseValue: 'aaa',
          value: 'aaax',
        },
      );
      const work =
        mode === 'ordinary'
          ? queue.flush().catch(() => undefined)
          : queue.handlePrepareBoundary({ barrierId: 'held', reason: 'undo' });
      await Promise.resolve();
      await Promise.resolve();
      const remoteEntries = initial.clojureProject.libraryEntries
        .slice(0, 2)
        .map((entry, index) => ({
          ...entry,
          dependencyCoordinates: index === 1 ? 'bbby' : entry.dependencyCoordinates,
        }));
      expect(
        (
          await history.commit({
            documentId,
            operationId: 'remote',
            contextSequence: 1,
            origin: { contextId: 'remote' },
            expectedRevision: 0,
            label: 'Remote update and removal',
            patches: [{ clojureProject: { libraryEntries: remoteEntries } }],
          })
        ).status,
      ).toBe('committed');
      queue.acceptRevision(session.read().sessionId, session.read().revision);
      release(initial);
      await work;
      expect(snapshot().clojureProject.libraryEntries).toEqual(remoteEntries);
      expect(queue.getClojureConflicts()).toHaveLength(1);
      expect(dependencies.commit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedRevision: 0 }),
      );
    },
  );

  it.each(['ready', 'aborted'] as const)(
    'retains an unsent prefix when a %s boundary releases during preparation',
    async (status) => {
      const canonical = {
        clojureProject: makeClojurePatch('aaa', 'bbb').clojureProject,
      } as ProjectEditorSnapshot;
      let release!: (snapshot: ProjectEditorSnapshot) => void;
      const dependencies = makeDependencies({
        fetchCanonicalSnapshot: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<ProjectEditorSnapshot>((resolve) => {
                release = resolve;
              }),
          )
          .mockResolvedValue(canonical),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.enqueue(
        makeClojurePatch('local', 'bbb'),
        false,
        { phase: 'single' },
        { entryId: 'clj-a', field: 'dependencyCoordinates', baseValue: 'aaa', value: 'local' },
      );
      const old = queue.handlePrepareBoundary({ barrierId: 'old', reason: 'save' });
      await Promise.resolve();
      await Promise.resolve();
      queue.handleReleaseBoundary({ barrierId: 'old', status });
      const fresh = queue.handlePrepareBoundary({ barrierId: 'fresh', reason: 'save' });
      release(canonical);
      await old;
      await fresh;
      expect(dependencies.commit).toHaveBeenCalledTimes(1);
      expect(dependencies.commit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ barrierId: 'fresh' }),
      );
      expect(dependencies.acknowledgeBoundary).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['ordinary', 'boundary'] as const)(
    'does not revive a cleared %s preparation',
    async (mode) => {
      let release!: (snapshot: ProjectEditorSnapshot) => void;
      const dependencies = makeDependencies({
        fetchCanonicalSnapshot: vi.fn().mockImplementationOnce(
          () =>
            new Promise<ProjectEditorSnapshot>((resolve) => {
              release = resolve;
            }),
        ),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.enqueue(
        makeClojurePatch('local', 'bbb'),
        false,
        { phase: 'single' },
        { entryId: 'clj-a', field: 'dependencyCoordinates', baseValue: 'aaa', value: 'local' },
      );
      const old =
        mode === 'ordinary'
          ? queue.flush()
          : queue.handlePrepareBoundary({ barrierId: 'old', reason: 'save' });
      await Promise.resolve();
      await Promise.resolve();
      queue.clearPending();
      if (mode === 'boundary') queue.handleReleaseBoundary({ barrierId: 'old', status: 'aborted' });
      queue.enqueue(makePatch(99), false, { phase: 'single' });
      release({
        clojureProject: makeClojurePatch('aaa', 'bbb').clojureProject,
      } as ProjectEditorSnapshot);
      await old;
      await queue.flush();
      expect(dependencies.commit).toHaveBeenCalledTimes(1);
      expect(dependencies.commit).toHaveBeenCalledWith([makePatch(99)], expect.anything());
    },
  );

  it('does not label a captured Clojure snapshot with a later revision', async () => {
    let release!: (snapshot: ProjectEditorSnapshot) => void;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockImplementationOnce(
        () =>
          new Promise<ProjectEditorSnapshot>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 1);
    queue.enqueue(
      makeClojurePatch('aaax', 'bbb'),
      false,
      { phase: 'single' },
      {
        entryId: 'clj-a',
        field: 'dependencyCoordinates',
        baseValue: 'aaa',
        value: 'aaax',
      },
    );
    const work = queue.flush();
    queue.acceptRevision(1, 2);
    release({
      clojureProject: makeClojurePatch('aaa', 'bbb').clojureProject,
    } as ProjectEditorSnapshot);
    await work;
    expect(dependencies.commit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedRevision: 1 }),
    );
  });

  it.each([
    ['absent', null, false],
    ['stale', makeHistoryProjection(1, true), true],
    ['rejected', new Error('history unavailable'), false],
  ] as const)(
    'retains conflict discard while history is %s, then retries with authoritative dirty state',
    async (_availability, firstResult, recoveredDirty) => {
      const canonical = {
        sessionId: 1,
        clojureProject: makeClojurePatch('remote', 'bbb').clojureProject,
      } as ProjectEditorSnapshot;
      const getCanonicalDirty = vi.fn().mockReturnValue(false);
      const fetchCanonicalHistoryProjection = vi.fn();
      if (firstResult instanceof Error) {
        fetchCanonicalHistoryProjection.mockRejectedValueOnce(firstResult);
      } else {
        fetchCanonicalHistoryProjection.mockResolvedValueOnce(firstResult);
      }
      fetchCanonicalHistoryProjection.mockResolvedValueOnce(
        makeHistoryProjection(2, recoveredDirty),
      );
      const dependencies = makeDependencies({
        commit: vi.fn().mockRejectedValue(new Error('changed remotely')),
        fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
        fetchCanonicalHistoryProjection,
        getCanonicalDirty,
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(1, 2);
      queue.enqueue(
        makeClojurePatch('local', 'bbb'),
        false,
        { phase: 'single' },
        {
          entryId: 'clj-a',
          field: 'dependencyCoordinates',
          baseValue: 'aaa',
          value: 'local',
        },
      );

      await expect(queue.flush()).rejects.toThrow('changed remotely');
      const review = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
      await expect(queue.resolveClojureConflict(review, null)).rejects.toThrow(
        'dirty state is unavailable',
      );

      expect(queue.getClojureConflicts()).toHaveLength(1);
      expect(queue.getPendingPatches()).toHaveLength(1);
      expect(dependencies.applyCanonicalSnapshot).toHaveBeenCalledWith(
        canonical,
        true,
        expect.anything(),
      );
      expect(dependencies.setDirty).not.toHaveBeenCalled();
      await queue.handlePrepareBoundary({ barrierId: 'indeterminate', reason: 'save' });
      expect(dependencies.acknowledgeBoundary).toHaveBeenLastCalledWith(
        expect.objectContaining({ outstandingPrefixCount: 1 }),
      );
      queue.handleReleaseBoundary({ barrierId: 'indeterminate', status: 'aborted' });

      const retry = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
      await queue.resolveClojureConflict(retry, null);

      expect(dependencies.applyCanonicalSnapshot).toHaveBeenLastCalledWith(canonical, true);
      expect(dependencies.setDirty).toHaveBeenLastCalledWith(recoveredDirty);
      expect(queue.getClojureConflicts()).toEqual([]);
      expect(getCanonicalDirty).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['current-clean', makeHistoryProjection(2, false), false],
    ['current-dirty', makeHistoryProjection(2, true), true],
  ] as const)(
    'uses %s history for conflict-discard dirty state',
    async (_availability, projection, expectedDirty) => {
      const canonical = {
        sessionId: 1,
        clojureProject: makeClojurePatch('remote', 'bbb').clojureProject,
      } as ProjectEditorSnapshot;
      const dependencies = makeDependencies({
        commit: vi.fn().mockRejectedValue(new Error('changed remotely')),
        fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
        fetchCanonicalHistoryProjection: vi.fn().mockResolvedValue(projection),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(1, 2);
      queue.enqueue(
        makeClojurePatch('local', 'bbb'),
        false,
        { phase: 'single' },
        {
          entryId: 'clj-a',
          field: 'dependencyCoordinates',
          baseValue: 'aaa',
          value: 'local',
        },
      );
      await expect(queue.flush()).rejects.toThrow('changed remotely');
      const review = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
      await queue.resolveClojureConflict(review, null);
      expect(dependencies.setDirty).toHaveBeenLastCalledWith(expectedDirty);
    },
  );

  it.each(['ordinary', 'boundary'] as const)(
    'resolves only the selected %s conflict',
    async (mode) => {
      const canonical = {
        clojureProject: makeClojurePatch('remote-a', 'remote-b').clojureProject,
      } as ProjectEditorSnapshot;
      const dependencies = makeDependencies({
        fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
        getCanonicalDirty: vi.fn().mockReturnValue(true),
      });
      const queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(1, 0);
      for (const [entryId, baseValue, value] of [
        ['clj-a', 'aaa', 'local-a'],
        ['clj-b', 'bbb', 'local-b'],
      ]) {
        queue.enqueue(
          makeClojurePatch('local-a', 'local-b'),
          false,
          { phase: 'single' },
          {
            entryId: entryId!,
            field: 'dependencyCoordinates',
            baseValue: baseValue!,
            value: value!,
          },
        );
      }
      if (mode === 'boundary') {
        await queue.handlePrepareBoundary({ barrierId: 'first', reason: 'undo' });
        queue.handleReleaseBoundary({ barrierId: 'first', status: 'aborted' });
      } else {
        await expect(queue.flush()).rejects.toThrow('changed remotely');
      }
      await expect(queue.flush()).rejects.toThrow('changed remotely');
      expect(queue.getClojureConflicts()).toHaveLength(2);
      const first = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
      await queue.resolveClojureConflict(first, null);
      expect(queue.getClojureConflicts()).toEqual([expect.objectContaining({ entryId: 'clj-b' })]);
      expect(queue.getPendingPatches()).toHaveLength(1);
      const second = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
      await queue.resolveClojureConflict(second, 'revised-b');
      expect(dependencies.commit).toHaveBeenCalledWith(
        [makeClojurePatch('remote-a', 'revised-b')],
        expect.anything(),
      );
      expect(queue.getClojureConflicts()).toEqual([]);
      await queue.handlePrepareBoundary({ barrierId: 'resolved', reason: 'save' });
      expect(dependencies.acknowledgeBoundary).toHaveBeenLastCalledWith(
        expect.objectContaining({ outstandingPrefixCount: 0 }),
      );
    },
  );

  it('keeps separately retained same-field drafts independently resolvable', async () => {
    const canonical = {
      sessionId: 1,
      clojureProject: makeClojurePatch('remote-a', 'remote-b').clojureProject,
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(makeReceipt({ sessionId: 1, revision: 2 })),
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
      getCanonicalDirty: vi.fn().mockReturnValue(true),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 0);

    for (const value of ['local-a-1', 'local-a-2']) {
      queue.enqueue(
        makeClojurePatch(value, 'remote-b'),
        false,
        { phase: 'single' },
        {
          entryId: 'clj-a',
          field: 'dependencyCoordinates',
          baseValue: 'aaa',
          value,
        },
      );
      await expect(queue.flush()).rejects.toThrow('changed remotely');
    }
    queue.enqueue(
      makeClojurePatch('remote-a', 'local-b'),
      false,
      { phase: 'single' },
      {
        entryId: 'clj-b',
        field: 'dependencyCoordinates',
        baseValue: 'bbb',
        value: 'local-b',
      },
    );
    await expect(queue.flush()).rejects.toThrow('changed remotely');

    const conflicts = queue.getClojureConflicts();
    expect(conflicts).toHaveLength(3);
    expect(new Set(conflicts.map((conflict) => conflict.id)).size).toBe(3);
    expect(conflicts.map((conflict) => conflict.value)).toEqual([
      'local-a-1',
      'local-a-2',
      'local-b',
    ]);

    const staleReview = await queue.reviewClojureConflict(conflicts[0]!.id);
    queue.acceptRevision(1, 1);
    await expect(queue.resolveClojureConflict(staleReview, null)).rejects.toThrow('changed');

    const first = await queue.reviewClojureConflict(conflicts[0]!.id);
    await queue.resolveClojureConflict(first, null);
    expect(queue.getClojureConflicts().map((conflict) => conflict.value)).toEqual([
      'local-a-2',
      'local-b',
    ]);

    const second = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
    await queue.resolveClojureConflict(second, 'revised-a');
    expect(dependencies.commit).toHaveBeenLastCalledWith(
      [makeClojurePatch('revised-a', 'remote-b')],
      expect.anything(),
    );
    expect(queue.getClojureConflicts().map((conflict) => conflict.value)).toEqual(['local-b']);

    const unrelated = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
    await queue.resolveClojureConflict(unrelated, null);
    expect(queue.getClojureConflicts()).toEqual([]);
    await queue.handlePrepareBoundary({ barrierId: 'resolved', reason: 'save' });
    expect(dependencies.acknowledgeBoundary).toHaveBeenLastCalledWith(
      expect.objectContaining({ outstandingPrefixCount: 0 }),
    );
  });

  it('releases unrelated work retained in the same transaction after resolving its field conflict', async () => {
    const canonical = {
      clojureProject: makeClojurePatch('remote', 'bbb').clojureProject,
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
      getCanonicalDirty: vi.fn().mockReturnValue(true),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(makePatch(99), false);
    queue.enqueue(makeClojurePatch('local', 'bbb'), false, undefined, {
      entryId: 'clj-a',
      field: 'dependencyCoordinates',
      baseValue: 'aaa',
      value: 'local',
    });
    await expect(queue.flush()).rejects.toThrow('changed remotely');
    const review = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
    await queue.resolveClojureConflict(review, null);
    await queue.flush();
    expect(dependencies.commit).toHaveBeenCalledWith([makePatch(99)], expect.anything());
    expect(queue.getPendingPatches()).toEqual([]);
  });

  it('revalidates conflict approval and cannot resurrect a removed entry', async () => {
    const canonical = {
      clojureProject: makeClojurePatch('remote', 'bbb').clojureProject,
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
      getCanonicalDirty: vi.fn().mockReturnValue(false),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 0);
    queue.enqueue(
      makeClojurePatch('local', 'bbb'),
      false,
      { phase: 'single' },
      {
        entryId: 'clj-a',
        field: 'dependencyCoordinates',
        baseValue: 'aaa',
        value: 'local',
      },
    );
    await expect(queue.flush()).rejects.toThrow();
    const review = await queue.reviewClojureConflict(queue.getClojureConflicts()[0]!.id);
    canonical.clojureProject.libraryEntries.shift();
    await expect(queue.resolveClojureConflict(review, 'local')).rejects.toThrow('changed');
    const removed = await queue.reviewClojureConflict(review.conflict.id);
    expect(removed.canonicalValue).toBeNull();
    await expect(queue.resolveClojureConflict(removed, 'local')).rejects.toThrow('removed');
    expect(dependencies.commit).not.toHaveBeenCalled();
    await queue.resolveClojureConflict(removed, null);
    expect(queue.getPendingPatches()).toEqual([]);
    expect(dependencies.setDirty).toHaveBeenLastCalledWith(false);
  });

  it('retains a Clojure field draft and does not submit a same-field conflict', async () => {
    const canonical = {
      clojureProject: {
        libraryEntries: [
          { entryId: 'clj-a', dependencyCoordinates: 'remote-a', version: '1.0.0' },
          { entryId: 'clj-b', dependencyCoordinates: 'bbb', version: '2.0.0' },
        ],
      },
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 2);
    const patch = makeClojurePatch('aaax', 'bbb');
    const intent = {
      entryId: 'clj-a',
      field: 'dependencyCoordinates' as const,
      baseValue: 'aaa',
      value: 'aaax',
    };
    queue.enqueue(
      patch,
      false,
      { fieldId: 'clojure-library:clj-a:coordinates', phase: 'single' },
      intent,
    );

    await expect(queue.flush()).rejects.toThrow(/conflicts/i);
    expect(dependencies.commit).not.toHaveBeenCalled();
    expect(queue.getPendingPatches()).toEqual([
      expect.objectContaining({ patch, clojureFieldIntent: intent }),
    ]);
    expect(dependencies.applyCanonicalSnapshot).toHaveBeenLastCalledWith(
      canonical,
      true,
      expect.arrayContaining([expect.objectContaining({ clojureFieldIntent: intent })]),
    );
  });

  it('retains a Clojure field draft when its canonical entry was removed', async () => {
    const canonical = {
      clojureProject: {
        libraryEntries: [{ entryId: 'clj-b', dependencyCoordinates: 'bbb', version: '2.0.0' }],
      },
    } as ProjectEditorSnapshot;
    const dependencies = makeDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 2);
    const patch = makeClojurePatch('aaax', 'bbb');
    const intent = {
      entryId: 'clj-a',
      field: 'dependencyCoordinates' as const,
      baseValue: 'aaa',
      value: 'aaax',
    };

    queue.enqueue(
      patch,
      false,
      { fieldId: 'clojure-library:clj-a:coordinates', phase: 'single' },
      intent,
    );

    await expect(queue.flush()).rejects.toThrow(/no longer exists/i);
    expect(dependencies.commit).not.toHaveBeenCalled();
    expect(queue.getPendingPatches()).toEqual([
      expect.objectContaining({ patch, clojureFieldIntent: intent }),
    ]);
    expect(dependencies.applyCanonicalSnapshot).toHaveBeenLastCalledWith(
      canonical,
      true,
      expect.arrayContaining([expect.objectContaining({ clojureFieldIntent: intent })]),
    );
  });

  it('fences a queued structural Clojure replacement to its original revision', async () => {
    const dependencies = makeDependencies({
      commit: vi.fn().mockResolvedValue(makeReceipt({ sessionId: 1, revision: 5 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    const patch = makeClojurePatch('aaax', 'bbb');
    queue.enqueue(patch, false, { phase: 'single' });

    await queue.flush();

    expect(dependencies.commit).toHaveBeenCalledWith(
      [patch],
      expect.objectContaining({ expectedRevision: 4 }),
    );
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

  it('settles an ordinary in-flight workbench flush submitted immediately after undo', async () => {
    vi.useRealTimers();
    const session = new ProjectSession();
    session.replace(new BlueData(), join(tmpdir(), 'workbench-history.blue'));
    const documentId = session.read().documentId!;
    const history = new ProjectHistory({
      session,
      barrierTimeoutMs: 100,
      broadcastPrepareBoundary: (event) => queue.handlePrepareBoundary(event),
      broadcastReleaseBoundary: (event) => queue.handleReleaseBoundary(event),
    });
    await history.commit({
      documentId,
      operationId: 'seed',
      expectedRevision: 0,
      contextSequence: 0,
      label: 'Seed',
      patches: [{ projectProperties: { title: 'Seed' } }],
    });
    history.registerParticipant({ contextId: 'ctx-renderer-1', documentId, acceptedRevision: 1 });
    const dependencies = makeParticipantDependencies({
      commit: vi.fn(async (patches, context) => {
        const response = await history.commit({
          documentId,
          operationId: context!.metadata!.operationId!,
          contextSequence: context!.metadata!.contextSequence!,
          expectedRevision: queue.getRevision(),
          origin: { contextId: 'ctx-renderer-1' },
          barrierId: context?.barrierId,
          label: 'Workbench edit',
          patches,
        });
        if (response.status !== 'committed') throw new Error(response.status);
        return makeReceipt({ sessionId: session.read().sessionId, revision: response.revision });
      }),
      acknowledgeBoundary: vi.fn((ack) => {
        expect(history.acknowledgeBoundary(ack).ok).toBe(true);
      }),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(session.read().sessionId, 1);
    const undo = history.undo({
      documentId,
      operationId: 'undo',
      expectedRevision: 1,
      contextSequence: 0,
    });
    queue.enqueue({ projectProperties: { title: 'Workbench edit' } }, false);
    const submitted = queue.flush();

    expect((await undo).status).toBe('committed');
    await submitted;
    expect(queue.isSettlementPaused()).toBe(false);
    expect(dependencies.commit).toHaveBeenCalledTimes(1);
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ lastAcknowledgedRevision: 2, outstandingPrefixCount: 0 }),
    );
    expect(session.read().data?.getProjectProperties().title).toBe('Seed');
    expect(session.read().revision).toBe(3);
  });

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

  it('prepares a Clojure field intent during settlement prefix drain', async () => {
    const canonical = {
      clojureProject: {
        libraryEntries: [
          { entryId: 'clj-a', dependencyCoordinates: 'aaa', version: '1.0.0' },
          { entryId: 'clj-b', dependencyCoordinates: 'bbby', version: '2.0.0' },
        ],
      },
    } as ProjectEditorSnapshot;
    const dependencies = makeParticipantDependencies({
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(canonical),
      commit: vi.fn().mockResolvedValue(makeReceipt({ revision: 5 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    const patch = makeClojurePatch('aaax', 'bbb');
    const intent = {
      entryId: 'clj-a',
      field: 'dependencyCoordinates' as const,
      baseValue: 'aaa',
      value: 'aaax',
    };
    queue.enqueue(
      patch,
      false,
      { fieldId: 'clojure-library:clj-a:coordinates', phase: 'single' },
      intent,
    );

    await queue.handlePrepareBoundary({ barrierId: 'clojure-barrier', reason: 'undo' });

    expect(dependencies.commit).toHaveBeenCalledWith(
      [makeClojurePatch('aaax', 'bbby')],
      expect.objectContaining({
        barrierId: 'clojure-barrier',
        expectedRevision: 4,
      }),
    );
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ outstandingPrefixCount: 0 }),
    );
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

  it('retains an error-bearing prefix and reports unresolved work to the barrier', async () => {
    const snapshot = {} as ProjectEditorSnapshot;
    const dependencies = makeParticipantDependencies({
      commit: vi.fn().mockResolvedValue(
        makeReceipt({
          changed: false,
          revision: 5,
          error: 'prefix rejected by canonical history',
        }),
      ),
      fetchCanonicalSnapshot: vi.fn().mockResolvedValue(snapshot),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    queue.enqueue(makePatch(60), false);

    await queue.handlePrepareBoundary({ barrierId: 'barrier-error', reason: 'undo' });

    expect(dependencies.fetchCanonicalSnapshot).toHaveBeenCalledTimes(1);
    expect(dependencies.applyCanonicalSnapshot).toHaveBeenCalledWith(snapshot, true);
    expect(dependencies.reportBackgroundError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'prefix rejected by canonical history' }),
    );
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        barrierId: 'barrier-error',
        lastAcknowledgedRevision: 5,
        outstandingPrefixCount: 1,
        failedPrefixCount: 1,
        unresolvedPrefixCount: 1,
      }),
    );
    expect(queue.isSettlementPaused()).toBe(true);
  });

  it('retains an oversize boundary suffix for retry after release', async () => {
    const dependencies = makeParticipantDependencies({
      commit: vi
        .fn()
        .mockResolvedValueOnce(
          makeReceipt({
            revision: 4,
            oversizeProposal: {
              token: 'oversize-1',
              estimatedBytes: 100,
              limitBytes: 50,
              explanation: 'too large',
            },
          }),
        )
        .mockResolvedValueOnce(makeReceipt({ revision: 5 }))
        .mockResolvedValueOnce(makeReceipt({ revision: 6 })),
    });
    const queue = createProjectPatchQueue(dependencies);
    queue.acceptRevision(1, 4);
    queue.enqueue(makePatch(60), false, { gestureId: 'gesture-1', phase: 'single' });
    queue.enqueue(makePatch(90), false, { gestureId: 'gesture-2', phase: 'single' });

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' });

    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        outstandingPrefixCount: 2,
        failedPrefixCount: 2,
        unresolvedPrefixCount: 2,
      }),
    );

    queue.handleReleaseBoundary({ barrierId: 'barrier-1', status: 'ready' });
    await vi.advanceTimersByTimeAsync(100);
    await queue.awaitPending();

    expect(dependencies.commit).toHaveBeenNthCalledWith(
      2,
      [makePatch(60)],
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
    expect(dependencies.commit).toHaveBeenNthCalledWith(
      3,
      [makePatch(90)],
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
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

  it('pauses synchronously while editor settlement adds a barrier-owned patch', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);
    queue.enqueue(makePatch(60), false);
    const settlement = new Promise<void>((resolve) => {
      queue.enqueue(makePatch(90), false);
      setTimeout(resolve, 250);
    });

    const boundary = queue.handlePrepareBoundary(
      { barrierId: 'barrier-1', reason: 'undo' },
      () => settlement,
    );

    await vi.advanceTimersByTimeAsync(200);
    expect(dependencies.commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    await boundary;

    expect(dependencies.commit).toHaveBeenCalledWith(
      [makePatch(60), makePatch(90)],
      expect.objectContaining({ barrierId: 'barrier-1' }),
    );
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ outstandingPrefixCount: 0 }),
    );
  });

  it('reports an unresolved editor settlement instead of acknowledging a clean boundary', async () => {
    const dependencies = makeParticipantDependencies();
    const queue = createProjectPatchQueue(dependencies);
    const error = new Error('composition still active');

    await queue.handlePrepareBoundary({ barrierId: 'barrier-1', reason: 'undo' }, () =>
      Promise.reject(error),
    );

    expect(dependencies.commit).not.toHaveBeenCalled();
    expect(dependencies.reportBackgroundError).toHaveBeenCalledWith(error);
    expect(dependencies.acknowledgeBoundary).toHaveBeenCalledWith({
      barrierId: 'barrier-1',
      contextId: 'ctx-renderer-1',
      lastAcknowledgedRevision: 0,
      lastAcknowledgedSequence: 0,
      outstandingPrefixCount: 1,
      failedPrefixCount: 1,
      unresolvedPrefixCount: 1,
    });
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
      failedPrefixCount: 1,
      unresolvedPrefixCount: 1,
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
