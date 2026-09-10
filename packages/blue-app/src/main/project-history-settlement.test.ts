import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import {
  MockHistoryContext,
  FakePublicationRecorder,
  createDeferred,
} from './project-history-test-support';
import type {
  PrepareHistoryBoundaryEvent,
  ReleaseHistoryBoundaryEvent,
} from '../shared/project-history';
import {
  createProjectPatchQueue,
  type ProjectPatchQueue,
  type ProjectPatchQueueDependencies,
} from '../renderer/stores/project-store/project-patch-queue';

describe('Project history settlement barrier (T015)', () => {
  function setupTest(barrierTimeoutMs = 100) {
    const session = new ProjectSession();
    const data = new BlueData();
    data.getProjectProperties().title = 'Initial Title';
    session.replace(data, '/tmp/project.blue');

    const recorder = new FakePublicationRecorder();
    const prepareEvents: PrepareHistoryBoundaryEvent[] = [];
    const releaseEvents: ReleaseHistoryBoundaryEvent[] = [];

    const history = new ProjectHistory({
      session,
      publishUpdated: (evt) => recorder.record(evt),
      broadcastPrepareBoundary: (evt) => {
        prepareEvents.push(evt);
      },
      broadcastReleaseBoundary: (evt) => {
        releaseEvents.push(evt);
      },
      barrierTimeoutMs,
    });

    const contextA = new MockHistoryContext('ctx-a');
    const contextB = new MockHistoryContext('ctx-b');

    return {
      session,
      data,
      history,
      recorder,
      prepareEvents,
      releaseEvents,
      contextA,
      contextB,
    };
  }

  describe('Participant registration & monotonic watermarks', () => {
    it('registers, tracks, and unregisters participants', () => {
      const { session, history } = setupTest();
      const docId = session.read().documentId!;

      const regRes = history.registerParticipant({
        contextId: 'ctx-1',
        documentId: docId,
        acceptedRevision: 0,
      });
      expect(regRes.ok).toBe(true);
      expect(history.getParticipants()).toHaveLength(1);
      expect(history.getParticipants()[0]?.contextId).toBe('ctx-1');

      history.unregisterParticipant({ contextId: 'ctx-1' });
      expect(history.getParticipants()).toHaveLength(0);
    });

    it('rejects future revisions and preserves a registered sequence watermark', async () => {
      const { session, history, contextA } = setupTest();
      const docId = session.read().documentId!;

      expect(
        history.registerParticipant({
          contextId: contextA.contextId,
          documentId: docId,
          acceptedRevision: 1,
        }),
      ).toEqual({
        ok: false,
        reason: 'History participant revision is ahead of the active document',
      });

      expect(
        history.registerParticipant({
          contextId: contextA.contextId,
          documentId: docId,
          acceptedRevision: 0,
        }).ok,
      ).toBe(true);
      const firstCommit = await history.commit({
        ...contextA.nextCommitRequest(docId, 0, 'First edit', [
          { projectProperties: { title: 'First edit' } },
        ]),
        contextSequence: 2,
      });
      expect(firstCommit.status).toBe('committed');

      expect(
        history.registerParticipant({
          contextId: contextA.contextId,
          documentId: docId,
          acceptedRevision: 1,
        }).ok,
      ).toBe(true);

      const replay = await history.commit({
        ...contextA.nextCommitRequest(docId, 1, 'Replay', [
          { projectProperties: { title: 'Replay' } },
        ]),
        contextSequence: 1,
      });
      expect(replay.status).toBe('unchanged');
      expect(session.read().data?.getProjectProperties().title).toBe('First edit');
    });

    it('returns active barrier in registration response if barrier is already in progress', async () => {
      const { session, history, contextA } = setupTest();
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Commit 1 so there is history to undo
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Edit 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );

      // Start undo asynchronously (will await barrier)
      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((r) => setTimeout(r, 5));

      // A new participant registers while barrier is active
      const regRes = history.registerParticipant({
        contextId: 'ctx-late',
        documentId: docId,
        acceptedRevision: 1,
      });
      expect(regRes.ok).toBe(true);
      expect(regRes.activeBarrier).toBeDefined();
      expect(regRes.activeBarrier?.reason).toBe('undo');

      const barrierId = regRes.activeBarrier!.barrierId;

      // Both acknowledge
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 1, 0));
      history.acknowledgeBoundary({
        barrierId,
        contextId: 'ctx-late',
        lastAcknowledgedRevision: 1,
        lastAcknowledgedSequence: 1,
        outstandingPrefixCount: 0,
      });

      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('committed');
    });

    it('suppresses replaying sequence numbers below participant high-watermark', async () => {
      const { session, history, contextA } = setupTest();
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Commit seq 1
      const req1 = contextA.nextCommitRequest(docId, 0, 'Commit 1', [
        { projectProperties: { title: 'T1' } },
      ]);
      const res1 = await history.commit(req1);
      expect(res1.status).toBe('committed');

      // Commit seq 2
      const req2 = contextA.nextCommitRequest(docId, 1, 'Commit 2', [
        { projectProperties: { title: 'T2' } },
      ]);
      const res2 = await history.commit(req2);
      expect(res2.status).toBe('committed');

      // Re-submit an out-of-order/stale sequence 1 with a new operationId
      const staleSeqReq = {
        ...contextA.nextCommitRequest(docId, 2, 'Stale Seq Commit', [
          { projectProperties: { title: 'T-Stale' } },
        ]),
        contextSequence: 1, // lower than lastSequence (2)
      };

      const resStaleSeq = await history.commit(staleSeqReq);
      expect(resStaleSeq.status).toBe('unchanged');
      expect(session.read().revision).toBe(2);
      expect(session.read().data?.getProjectProperties().title).toBe('T2');
    });
  });

  describe('Pause, drain, execute, and release barrier flow', () => {
    it.each([false, true])(
      'settles an ordinary edit racing prepare delivery (main already prepared: %s)',
      async (alreadyPrepared) => {
        const contextId = 'editor';
        const session = new ProjectSession();
        session.replace(new BlueData(), join(tmpdir(), 'project.blue'));
        const documentId = session.read().documentId!;
        const prepared = createDeferred<PrepareHistoryBoundaryEvent>();
        const releases: ReleaseHistoryBoundaryEvent[] = [];
        const history = new ProjectHistory({
          session,
          barrierTimeoutMs: 100,
          broadcastPrepareBoundary: (event) => prepared.resolve(event),
          broadcastReleaseBoundary: (event) => {
            releases.push(event);
          },
        });
        await history.commit({
          documentId,
          operationId: 'seed',
          expectedRevision: 0,
          contextSequence: 0,
          label: 'Seed',
          patches: [{ projectProperties: { title: 'Seed' } }],
        });
        const context = new MockHistoryContext(contextId);
        history.registerParticipant({ contextId, documentId, acceptedRevision: 1 });

        const undo = history.undo({
          documentId,
          operationId: 'undo',
          expectedRevision: 1,
          contextSequence: 0,
        });
        // Main may have broadcast prepare while the renderer has not received
        // it yet. Both sides of that asynchronous delivery must settle.
        if (alreadyPrepared) await prepared.promise;
        const request = context.nextCommitRequest(documentId, 1, 'In-flight edit', [
          { projectProperties: { title: 'In-flight edit' } },
        ]);
        const submitted = history.commit(request);
        const duplicate = history.commit(request);
        const participant = (async () => {
          const event = await prepared.promise;
          // Both production participant queues await their ordinary in-flight
          // submission before acknowledging prepare. It must not wait for undo.
          const receipt = await submitted;
          return history.acknowledgeBoundary({
            ...context.acknowledgeBarrier(event.barrierId, session.read().revision),
            failedPrefixCount: receipt.status === 'committed' ? 0 : 1,
          });
        })();

        expect((await undo).status).toBe('committed');
        expect(await participant).toEqual({ ok: true });
        expect((await submitted).status).toBe('committed');
        expect(await duplicate).toEqual(await submitted);
        expect(releases).toEqual([expect.objectContaining({ status: 'ready' })]);
        expect(session.read().data?.getProjectProperties().title).toBe('Seed');
        expect(session.read().revision).toBe(3);
        expect(history.getEntries()).toHaveLength(2);
        expect(history.getCursor()).toBe(1);
      },
    );

    it.each(['document', 'revision', 'sequence'] as const)(
      'keeps the %s fence when capturing an already-submitted prefix',
      async (fence) => {
        const { session, history, contextA, prepareEvents } = setupTest();
        const documentId = session.read().documentId!;
        history.registerParticipant({
          contextId: contextA.contextId,
          documentId,
          acceptedRevision: 0,
        });
        await history.commit(
          contextA.nextCommitRequest(
            documentId,
            0,
            'Seed',
            [{ projectProperties: { title: 'Seed' } }],
            { contextSequence: 3 },
          ),
        );
        const undo = history.undo({
          documentId,
          operationId: 'undo',
          expectedRevision: 1,
          contextSequence: 0,
        });
        const submitted = history.commit(
          contextA.nextCommitRequest(
            fence === 'document' ? 'obsolete-document' : documentId,
            fence === 'revision' ? 0 : 1,
            'Invalid prefix',
            [{ projectProperties: { title: 'Must not apply' } }],
            { contextSequence: fence === 'sequence' ? 2 : 4 },
          ),
        );
        const receipt = await submitted;
        expect(receipt.status).toBe(fence === 'sequence' ? 'unchanged' : 'stale');
        expect(session.read().revision).toBe(1);
        expect(session.read().data?.getProjectProperties().title).toBe('Seed');
        history.abortBoundary(prepareEvents[0]!.barrierId, 'Retain unresolved draft');
        expect(await undo).toMatchObject({ status: 'failed', error: 'Retain unresolved draft' });
        expect(session.read().revision).toBe(1);
      },
    );

    it('executes pause/drain/release lifecycle and undoes the settled top action', async () => {
      const { session, history, prepareEvents, releaseEvents, contextA, contextB } = setupTest();
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });
      history.registerParticipant({
        contextId: contextB.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Initial edit from A
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Action 1', [
          { projectProperties: { title: 'Title A1' } },
        ]),
      );

      // User requests undo
      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));

      // Wait a tick for barrier to broadcast prepare
      await new Promise((r) => setTimeout(r, 5));

      expect(prepareEvents).toHaveLength(1);
      const barrierId = prepareEvents[0]!.barrierId;
      expect(prepareEvents[0]!.reason).toBe('undo');

      // While barrier is active:
      // Context B has 1 pending prefix edit to drain before acknowledging
      const prefixCommit = contextB.nextCommitRequest(
        docId,
        1,
        'Drained Prefix Edit',
        [{ projectProperties: { author: 'Author B' } }],
        { barrierId },
      );

      const commitRes = await history.commit(prefixCommit);
      expect(commitRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);

      // Now contexts acknowledge boundary with 0 outstanding prefix work
      history.acknowledgeBoundary(contextB.acknowledgeBarrier(barrierId, 2, 0));
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 2, 0));

      // Undo resolves! It undoes the newly settled top action (Author B)
      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(3);
      expect(session.read().data?.getProjectProperties().author).toBe('');
      expect(session.read().data?.getProjectProperties().title).toBe('Title A1');

      // Release barrier was broadcast
      expect(releaseEvents).toHaveLength(1);
      expect(releaseEvents[0]!.barrierId).toBe(barrierId);
      expect(releaseEvents[0]!.status).toBe('ready');
    });

    it('delays unrelated non-prefix commits until the settlement barrier is released', async () => {
      const { session, history, prepareEvents, contextA, contextB } = setupTest();
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Baseline commit
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Base Edit', [
          { projectProperties: { title: 'Base' } },
        ]),
      );

      // Request undo
      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((r) => setTimeout(r, 5));

      const barrierId = prepareEvents[0]!.barrierId;

      // An unrelated non-prefix commit arrives from contextB (no barrierId)
      let nonPrefixCommitted = false;
      const unrelatedCommitPromise = history
        .commit(
          contextB.nextCommitRequest(docId, 1, 'Unrelated Edit', [
            { projectProperties: { notes: 'New Notes' } },
          ]),
        )
        .then((res) => {
          nonPrefixCommitted = true;
          return res;
        });

      // Must NOT be committed while barrier is active
      await new Promise((r) => setTimeout(r, 10));
      expect(nonPrefixCommitted).toBe(false);

      // Acknowledge barrier
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 1, 0));

      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('committed');

      // Now the unrelated commit completes
      const unrelatedRes = await unrelatedCommitPromise;
      expect(nonPrefixCommitted).toBe(true);
      // Because undo changed the revision to 2, and unrelated commit had expectedRevision 1 without preconditions,
      // it returns stale with canonical revision
      expect(unrelatedRes.status).toBe('stale');
    });

    it('does not capture ordinary input from an already-acknowledged participant', async () => {
      const { session, history, prepareEvents, contextA, contextB } = setupTest();
      const documentId = session.read().documentId!;
      for (const context of [contextA, contextB]) {
        history.registerParticipant({
          contextId: context.contextId,
          documentId,
          acceptedRevision: 0,
        });
      }
      await history.commit(
        contextA.nextCommitRequest(documentId, 0, 'Seed', [
          { projectProperties: { title: 'Seed' } },
        ]),
      );
      const undo = history.undo(contextA.nextUndoRequest(documentId, 1));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const barrierId = prepareEvents[0]!.barrierId;
      expect(history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 1)).ok).toBe(true);
      const submitted = history.commit(
        contextA.nextCommitRequest(documentId, 1, 'Later input', [
          { projectProperties: { title: 'Must not become prefix' } },
        ]),
      );
      expect(session.read().revision).toBe(1);
      expect(history.acknowledgeBoundary(contextB.acknowledgeBarrier(barrierId, 1)).ok).toBe(true);
      expect((await undo).status).toBe('committed');
      expect((await submitted).status).toBe('stale');
      expect(session.read().revision).toBe(2);
      expect(history.getEntries()).toHaveLength(1);
    });

    it('fences a prepared structural candidate that becomes stale behind replay', async () => {
      const { session, history, prepareEvents, contextA } = setupTest(200);
      const documentId = session.read().documentId!;
      const sessionId = session.read().sessionId;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId,
        acceptedRevision: 0,
      });
      await history.commit(
        contextA.nextCommitRequest(documentId, 0, 'Base edit', [
          { projectProperties: { title: 'Base' } },
        ]),
      );

      const candidate = session.read().data!.historyCopy();
      candidate.getProjectProperties().author = 'Prepared candidate';

      const undoPromise = history.undo(contextA.nextUndoRequest(documentId, 1));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const barrierId = prepareEvents[0]!.barrierId;

      const preparedPromise = history.commitPreparedStructuralMutation({
        label: 'Prepared after undo',
        candidate,
        expectedDocumentId: documentId,
        expectedSessionId: sessionId,
        expectedRevision: 1,
      });

      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 1, 0));

      const undo = await undoPromise;
      const prepared = await preparedPromise;
      expect(undo.status).toBe('committed');
      expect(prepared.changed).toBe(false);
      expect(prepared.error).toContain('stale');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(session.read().data?.getProjectProperties().author).toBe('');
      expect(history.read().length).toBe(1);
      expect(history.read().cursor).toBe(0);
    });
  });

  describe('Composition completion during drainage', () => {
    it('lets an active gesture complete as barrier prefix before the undo executes', async () => {
      const { session, history, prepareEvents, contextA, contextB } = setupTest(200);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });
      history.registerParticipant({
        contextId: contextB.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Context B starts a drag gesture before the undo is requested.
      await history.commit(
        contextB.nextCommitRequest(
          docId,
          0,
          'Drag Title',
          [{ projectProperties: { title: 'Drag V1' } }],
          {
            gestureId: 'g-drag',
            phase: 'begin',
          },
        ),
      );

      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((r) => setTimeout(r, 5));
      const barrierId = prepareEvents[0]!.barrierId;

      // Context B finishes its composition: the gesture end-phase commit is a
      // barrier prefix that closes the group into ONE settled entry.
      const endRes = await history.commit(
        contextB.nextCommitRequest(
          docId,
          1,
          'Drag Title',
          [{ projectProperties: { title: 'Drag Final' } }],
          {
            gestureId: 'g-drag',
            phase: 'end',
            barrierId,
          },
        ),
      );
      expect(endRes.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Drag Final');

      history.acknowledgeBoundary(contextB.acknowledgeBarrier(barrierId, 2, 0));
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 2, 0));

      // The undo request closed the forming group, so the completed gesture
      // end settled as its own prefix entry. The first undo reverses the
      // settled top action; nothing is lost or reordered.
      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(3);
      expect(session.read().data?.getProjectProperties().title).toBe('Drag V1');
      expect(history.read().length).toBe(2);

      // The second undo reverses the gesture's begin action at its own
      // settled boundary.
      const undo2Promise = history.undo(contextA.nextUndoRequest(docId, 3));
      await new Promise((r) => setTimeout(r, 5));
      expect(prepareEvents).toHaveLength(2);
      const barrier2Id = prepareEvents[1]!.barrierId;
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrier2Id, 3, 0));
      history.acknowledgeBoundary(contextB.acknowledgeBarrier(barrier2Id, 3, 0));

      const undo2 = await undo2Promise;
      expect(undo2.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
    });
  });

  describe('Bounded stale retry during barrier drainage', () => {
    it('applies disjoint prefix edit with valid preconditions despite advanced revision', async () => {
      const { session, history, contextA, contextB } = setupTest();
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });
      history.registerParticipant({
        contextId: contextB.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Edit by A: sets title at rev 0 -> rev 1
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Edit Title', [
          { projectProperties: { title: 'T1' } },
        ]),
      );

      // Edit by B was prepared when rev was 0, but it touches author with precondition that author is ''
      const disjointReq = contextB.nextCommitRequest(
        docId,
        0, // older expected revision
        'Edit Author',
        [{ projectProperties: { author: 'Author B' } }],
        {
          preconditions: [
            {
              targetType: 'property',
              targetId: 'projectProperties',
              field: 'author',
              expectedValue: '',
            },
          ],
        },
      );

      // Bounded retry succeeds because author is still ''!
      const res = await history.commit(disjointReq);
      expect(res.status).toBe('committed');
      expect(session.read().revision).toBe(2);
      expect(session.read().data?.getProjectProperties().title).toBe('T1');
      expect(session.read().data?.getProjectProperties().author).toBe('Author B');
    });

    it('rejects conflicting prefix edit as stale when preconditions fail', async () => {
      const { session, history, contextA, contextB } = setupTest();
      const docId = session.read().documentId!;

      // Edit by A: sets title to 'T1'
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Edit Title A', [
          { projectProperties: { title: 'T1' } },
        ]),
      );

      // Edit by B: expects title to be 'Initial Title'
      const conflictingReq = contextB.nextCommitRequest(
        docId,
        0,
        'Edit Title B',
        [{ projectProperties: { title: 'T2' } }],
        {
          preconditions: [
            {
              targetType: 'property',
              targetId: 'projectProperties',
              field: 'title',
              expectedValue: 'Initial Title',
            },
          ],
        },
      );

      const res = await history.commit(conflictingReq);
      expect(res.status).toBe('stale');
      expect(session.read().revision).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('T1');
    });
  });

  describe('Timeout and disconnect handling', () => {
    it('aborts barrier and returns failed after timeout without performing undo', async () => {
      // Use 30ms timeout for test speed
      const { session, history, releaseEvents, contextA } = setupTest(30);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Action 1', [
          { projectProperties: { title: 'Original 1' } },
        ]),
      );

      // Request undo, but participant NEVER acknowledges
      const undoRes = await history.undo(contextA.nextUndoRequest(docId, 1));

      expect(undoRes.status).toBe('failed');
      expect((undoRes as { error: string }).error).toContain('timed out');
      expect(session.read().revision).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('Original 1');

      // Aborted release boundary was broadcast
      expect(releaseEvents).toHaveLength(1);
      expect(releaseEvents[0]!.status).toBe('aborted');
      expect(history.getActiveBarrier()).toBeNull();
    });

    it('settles barrier if participant cleanly unregisters while barrier is pending', async () => {
      const { session, history, prepareEvents, contextA, contextB } = setupTest(200);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });
      history.registerParticipant({
        contextId: contextB.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Action 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );

      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((r) => setTimeout(r, 5));

      const barrierId = prepareEvents[0]!.barrierId;

      // Context A acknowledges
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrierId, 1, 0));

      // Context B window closes cleanly (unregisters) instead of acknowledging
      history.unregisterParticipant({ contextId: contextB.contextId });

      // Barrier succeeds and undo commits!
      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);
    });

    it('aborts barrier immediately when abortBoundary is called', async () => {
      const { session, history, prepareEvents, releaseEvents, contextA } = setupTest(500);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Action 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );

      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((r) => setTimeout(r, 5));

      const barrierId = prepareEvents[0]!.barrierId;

      // Abort barrier due to client crash
      history.abortBoundary(barrierId, 'Client crashed');

      const undoRes = await undoPromise;
      expect(undoRes.status).toBe('failed');
      expect((undoRes as { error: string }).error).toContain('Client crashed');
      expect(releaseEvents).toHaveLength(1);
      expect(releaseEvents[0]!.status).toBe('aborted');
    });

    it('aborts immediately when a participant reports unresolved prefix input', async () => {
      const { session, history, prepareEvents, releaseEvents, contextA } = setupTest(500);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Action 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );

      const undoPromise = history.undo(contextA.nextUndoRequest(docId, 1));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const barrierId = prepareEvents[0]!.barrierId;

      const acknowledgement = history.acknowledgeBoundary({
        barrierId,
        contextId: contextA.contextId,
        lastAcknowledgedRevision: 1,
        lastAcknowledgedSequence: 2,
        outstandingPrefixCount: 1,
        failedPrefixCount: 1,
        unresolvedPrefixCount: 1,
      });
      expect(acknowledgement).toEqual({
        ok: false,
        reason: 'History participant still has outstanding prefix edits',
      });

      const undoResult = await undoPromise;
      expect(undoResult.status).toBe('failed');
      expect((undoResult as { error: string }).error).toContain('outstanding prefix edits');
      expect(releaseEvents[0]!.status).toBe('aborted');
      expect(session.read().revision).toBe(1);
    });

    it('aborts the real barrier when the renderer receives an error-bearing prefix receipt', async () => {
      const session = new ProjectSession();
      session.replace(new BlueData(), '/tmp/project-with-receipt-error.blue');
      const releaseEvents: ReleaseHistoryBoundaryEvent[] = [];
      let queue!: ProjectPatchQueue;
      const history = new ProjectHistory({
        session,
        barrierTimeoutMs: 500,
        broadcastPrepareBoundary: (event) => queue.handlePrepareBoundary(event),
        broadcastReleaseBoundary: (event) => {
          releaseEvents.push(event);
          queue.handleReleaseBoundary(event);
        },
      });
      const contextA = new MockHistoryContext('ctx-a');
      const documentId = session.read().documentId!;

      await history.commit(
        contextA.nextCommitRequest(documentId, 0, 'Action 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );
      history.registerParticipant({
        contextId: contextA.contextId,
        documentId,
        acceptedRevision: 1,
      });

      const dependencies: ProjectPatchQueueDependencies = {
        participantContextId: contextA.contextId,
        commit: vi.fn().mockResolvedValue({
          changed: false,
          revision: session.read().revision,
          sessionId: session.read().sessionId,
          error: 'prefix rejected by canonical history',
        }),
        fetchCanonicalSnapshot: vi.fn().mockResolvedValue(null),
        applyCanonicalSnapshot: vi.fn(),
        setDirty: vi.fn(),
        reportBackgroundError: vi.fn(),
        logRefreshError: vi.fn(),
        acknowledgeBoundary: vi.fn((ack) => {
          const result = history.acknowledgeBoundary(ack);
          expect(result.ok).toBe(false);
        }),
      };
      queue = createProjectPatchQueue(dependencies);
      queue.acceptRevision(session.read().sessionId, session.read().revision);
      queue.enqueue({ projectProperties: { title: 'Unresolved prefix' } }, false);
      queue.reserveContextSequence();

      const undoPromise = history.undo(contextA.nextUndoRequest(documentId, 1));
      const undoResult = await undoPromise;
      expect(undoResult.status).toBe('failed');
      expect((undoResult as { error: string }).error).toContain('outstanding prefix edits');
      expect(releaseEvents).toHaveLength(1);
      expect(releaseEvents[0]!.status).toBe('aborted');
      expect(session.read().revision).toBe(1);
      expect(queue.isSettlementPaused()).toBe(false);
      queue.clearPending();
    });
  });

  describe('Queued rapid commands', () => {
    it('serializes rapid consecutive undos so each executes at its own fresh settled boundary without dropping commands', async () => {
      const { session, history, prepareEvents, releaseEvents, contextA } = setupTest(200);
      const docId = session.read().documentId!;

      history.registerParticipant({
        contextId: contextA.contextId,
        documentId: docId,
        acceptedRevision: 0,
      });

      // Commit 3 edits
      await history.commit(
        contextA.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        contextA.nextCommitRequest(docId, 1, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );
      await history.commit(
        contextA.nextCommitRequest(docId, 2, 'Edit 3', [{ projectProperties: { title: 'T3' } }]),
      );

      expect(session.read().revision).toBe(3);
      expect(history.read().cursor).toBe(3);

      // User triggers 2 undos rapidly
      const undo1Promise = history.undo(contextA.nextUndoRequest(docId, 3));
      const undo2Promise = history.undo(contextA.nextUndoRequest(docId, 4));

      // Acknowledge barrier 1
      await new Promise((r) => setTimeout(r, 5));
      expect(prepareEvents).toHaveLength(1);
      const barrier1Id = prepareEvents[0]!.barrierId;
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrier1Id, 3, 0));

      const undo1Res = await undo1Promise;
      expect(undo1Res.status).toBe('committed');
      expect(session.read().revision).toBe(4);
      expect(session.read().data?.getProjectProperties().title).toBe('T2');

      // Now barrier 2 starts automatically
      await new Promise((r) => setTimeout(r, 5));
      expect(prepareEvents).toHaveLength(2);
      const barrier2Id = prepareEvents[1]!.barrierId;
      expect(barrier2Id).not.toBe(barrier1Id);

      // Acknowledge barrier 2
      history.acknowledgeBoundary(contextA.acknowledgeBarrier(barrier2Id, 4, 0));

      const undo2Res = await undo2Promise;
      expect(undo2Res.status).toBe('committed');
      expect(session.read().revision).toBe(5);
      expect(session.read().data?.getProjectProperties().title).toBe('T1');

      // Both barriers completed and released
      expect(releaseEvents).toHaveLength(2);
      expect(releaseEvents.every((e) => e.status === 'ready')).toBe(true);
    });
  });

  describe('In-flight operation deduplication', () => {
    it('shares concurrent duplicate undo execution and rejects conflicting reuse', async () => {
      const session = new ProjectSession();
      const data = new BlueData();
      data.getProjectProperties().title = 'Initial Title';
      session.replace(data, '/tmp/project.blue');

      const publicationGate = createDeferred<void>();
      let blockPublication = false;
      const history = new ProjectHistory({
        session,
        publishUpdated: () => (blockPublication ? publicationGate.promise : undefined),
      });
      const context = new MockHistoryContext('ctx-dedup');
      const documentId = session.read().documentId!;

      await history.commit(
        context.nextCommitRequest(documentId, 0, 'Edit 1', [
          { projectProperties: { title: 'Title 1' } },
        ]),
      );
      blockPublication = true;

      const request = context.nextUndoRequest(documentId, 1);
      const first = history.undo(request);
      const duplicate = history.undo(request);
      const conflicting = history.undo({
        ...request,
        origin: { contextId: context.contextId, viewId: 'other-window' },
      });

      expect(duplicate).toBe(first);
      const conflictingResult = await conflicting;
      expect(conflictingResult.status).toBe('invalid');
      expect(session.read().revision).toBe(2);
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');

      publicationGate.resolve();
      const firstResult = await first;
      expect(firstResult.status).toBe('committed');

      const completedDuplicateResult = await history.undo(request);
      expect(completedDuplicateResult).toBe(firstResult);
      expect(session.read().revision).toBe(2);
    });
  });
});
