import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';
import {
  ProjectHistory,
  DEFAULT_RETAINED_ENTRY_LIMIT,
  DEFAULT_RETAINED_BYTES_LIMIT,
} from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';

describe('ProjectHistory coordinator', () => {
  function setupHistory(options: { entryLimit?: number; bytesLimit?: number } = {}) {
    const session = new ProjectSession();
    const data = new BlueData();
    data.getProjectProperties().title = 'Initial Title';
    data.getGlobalOrcSco().setGlobalOrc('sr = 44100');
    session.replace(data, '/tmp/project.blue');

    const recorder = new FakePublicationRecorder();
    const history = new ProjectHistory({
      session,
      publishUpdated: (evt) => recorder.record(evt),
      retainedEntryLimit: options.entryLimit,
      retainedBytesLimit: options.bytesLimit,
    });

    const context = new MockHistoryContext('ctx-1');
    return { session, data, history, recorder, context };
  }

  describe('commit, undo, redo, and read', () => {
    it('commits scalar edits and enables undo and redo with monotonic revision', async () => {
      const { session, history, recorder, context } = setupHistory();
      const docId = session.read().documentId!;
      expect(session.read().revision).toBe(0);

      // 1. Commit first edit
      const req1 = context.nextCommitRequest(docId, 0, 'Change Title', [
        { projectProperties: { title: 'First Edit' } },
      ]);
      const res1 = await history.commit(req1);
      expect(res1.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('First Edit');
      expect(session.read().revision).toBe(1);
      expect(history.read().canUndo).toBe(true);
      expect(history.read().canRedo).toBe(false);
      expect(history.read().undoLabel).toBe('Change Title');

      // 2. Commit second edit
      const req2 = context.nextCommitRequest(docId, 1, 'Change Title Again', [
        { projectProperties: { title: 'Second Edit' } },
      ]);
      const res2 = await history.commit(req2);
      expect(res2.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Second Edit');
      expect(session.read().revision).toBe(2);
      expect(history.read().cursor).toBe(2);

      // 3. Undo second edit (revision rises monotonically to 3!)
      const undoReq1 = {
        documentId: docId,
        operationId: 'undo-op-1',
        expectedRevision: 2,
        contextSequence: 3,
      };
      const undoRes1 = await history.undo(undoReq1);
      expect(undoRes1.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('First Edit');
      expect(session.read().revision).toBe(3);
      expect(history.read().cursor).toBe(1);
      expect(history.read().canUndo).toBe(true);
      expect(history.read().canRedo).toBe(true);
      expect(history.read().redoLabel).toBe('Change Title Again');

      // 4. Undo first edit (revision rises to 4!)
      const undoReq2 = {
        documentId: docId,
        operationId: 'undo-op-2',
        expectedRevision: 3,
        contextSequence: 4,
      };
      const undoRes2 = await history.undo(undoReq2);
      expect(undoRes2.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(session.read().revision).toBe(4);
      expect(history.read().cursor).toBe(0);
      expect(history.read().canUndo).toBe(false);
      expect(history.read().canRedo).toBe(true);

      // 5. Redo first edit (revision rises to 5!)
      const redoReq1 = {
        documentId: docId,
        operationId: 'redo-op-1',
        expectedRevision: 4,
        contextSequence: 5,
      };
      const redoRes1 = await history.redo(redoReq1);
      expect(redoRes1.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('First Edit');
      expect(session.read().revision).toBe(5);
      expect(history.read().cursor).toBe(1);

      // Check publication events
      expect(recorder.events.length).toBe(5);
    });

    it('truncates redo stack on new commit (chronological branch semantics)', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      // Commit 1
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      // Commit 2
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );

      // Undo to Edit 1
      await history.undo({
        documentId: docId,
        operationId: 'undo-1',
        expectedRevision: 2,
        contextSequence: 3,
      });
      expect(history.read().cursor).toBe(1);
      expect(history.read().length).toBe(2);
      expect(history.read().canRedo).toBe(true);

      // New commit 3 while redo stack is non-empty
      await history.commit(
        context.nextCommitRequest(docId, 3, 'Edit 3 (New Branch)', [
          { projectProperties: { title: 'T3 Branch' } },
        ]),
      );

      // Redo stack must be truncated: length is 2, cursor is 2, canRedo is false
      expect(history.read().length).toBe(2);
      expect(history.read().cursor).toBe(2);
      expect(history.read().canRedo).toBe(false);
      expect(session.read().data?.getProjectProperties().title).toBe('T3 Branch');
    });
  });

  describe('deduplication and unchanged/stale handling', () => {
    it('returns cached response for duplicate operationId without applying twice', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      const req = context.nextCommitRequest(docId, 0, 'Dedup Action', [
        { projectProperties: { title: 'Dedup Title' } },
      ]);

      const res1 = await history.commit(req);
      expect(res1.status).toBe('committed');
      expect(session.read().revision).toBe(1);

      // Same request with same operationId
      const res2 = await history.commit(req);
      expect(res2).toBe(res1);
      expect(session.read().revision).toBe(1);
    });

    it('rejects a conflicting reuse of a known operationId as invalid', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      const req = context.nextCommitRequest(docId, 0, 'Original Action', [
        { projectProperties: { title: 'Title A' } },
      ]);
      const res1 = await history.commit(req);
      expect(res1.status).toBe('committed');

      // Same operationId, different payload: a conflicting reuse, not a retry.
      const conflicting = { ...req, patches: [{ projectProperties: { title: 'Title B' } }] };
      const res2 = await history.commit(conflicting);
      expect(res2.status).toBe('invalid');
      if (res2.status !== 'invalid') return;
      expect(res2.reason).toMatch(/operationId/i);
      expect(session.read().data?.getProjectProperties().title).toBe('Title A');
    });

    it('applies batches all-or-nothing: one invalid member rejects the whole batch', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      const res = await history.commit(
        context.nextCommitRequest(docId, 0, 'Mixed Batch', [
          { projectProperties: { title: 'Would Apply' } },
          { unknownMember: true } as never,
        ]),
      );
      expect(res.status).toBe('invalid');
      expect(session.read().revision).toBe(0);
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(history.read().length).toBe(0);
    });

    it('returns unchanged replies that preserve revision, redo availability, and checkpoint', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      history.markClean();
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.undo({
        documentId: docId,
        operationId: 'undo-1',
        expectedRevision: 1,
        contextSequence: 2,
      });
      expect(history.read().canRedo).toBe(true);
      const revisionBefore = session.read().revision;

      const unchangedRes = await history.commit(
        context.nextCommitRequest(docId, revisionBefore, 'No-op Edit', [
          { projectProperties: { title: 'Initial Title' } },
        ]),
      );
      expect(unchangedRes.status).toBe('unchanged');
      if (unchangedRes.status !== 'unchanged') return;
      expect(unchangedRes.revision).toBe(revisionBefore);
      expect(unchangedRes.isDirty).toBe(history.isDirty());
      expect(history.read().canRedo).toBe(true);
    });

    it('publishes committed metadata with document, revision, state, history, and accepted operation ids', async () => {
      const { session, history, recorder, context } = setupHistory();
      const docId = session.read().documentId!;

      await history.commit(
        context.nextCommitRequest(docId, 0, 'Publishing Edit', [
          { projectProperties: { title: 'Published' } },
        ]),
      );

      expect(recorder.events).toHaveLength(1);
      const event = recorder.latest()!;
      expect(event.documentId).toBe(docId);
      expect(event.revision).toBe(1);
      expect(event.stateId).toBeTruthy();
      expect(event.isDirty).toBe(true);
      expect(event.history.canUndo).toBe(true);
      expect(event.history.undoLabel).toBe('Publishing Edit');
      expect(event.acceptedOperationIds).toHaveLength(1);

      const committed = await history.commit(
        context.nextCommitRequest(docId, 1, 'Second Edit', [
          { projectProperties: { title: 'Published 2' } },
        ]),
      );
      expect(committed.status).toBe('committed');
      if (committed.status !== 'committed') return;
      expect(committed.documentId).toBe(docId);
      expect(committed.revision).toBe(2);
      expect(committed.stateId).toBe(session.read().stateId);
      expect(committed.history.cursor).toBe(2);
      expect(committed.history.length).toBe(2);
      expect(committed.isDirty).toBe(true);
    });

    it('rejects stale commits when expectedRevision does not match current revision', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      const staleReq = context.nextCommitRequest(docId, 999, 'Stale Action', [
        { projectProperties: { title: 'Stale' } },
      ]);

      const res = await history.commit(staleReq);
      expect(res.status).toBe('stale');
      expect((res as { reason: string }).reason).toContain('Revision mismatch');
      expect(session.read().revision).toBe(0);
    });

    it('returns unchanged without truncating redo when patch is a no-op', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      // Commit 1
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      // Undo
      await history.undo({
        documentId: docId,
        operationId: 'undo-1',
        expectedRevision: 1,
        contextSequence: 2,
      });
      expect(history.read().canRedo).toBe(true);

      // No-op commit (setting same title)
      const noOpReq = context.nextCommitRequest(docId, 2, 'No-op', [
        { projectProperties: { title: 'Initial Title' } },
      ]);
      const noOpRes = await history.commit(noOpReq);
      expect(noOpRes.status).toBe('unchanged');

      // Checkpoint and redo preserved
      expect(history.read().canRedo).toBe(true);
    });
  });

  describe('adjacent gesture grouping and cancellation', () => {
    it('groups begin and update gestures on the same field into a single compound history entry', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      // 1. Begin gesture
      await history.commit(
        context.nextCommitRequest(
          docId,
          0,
          'Slider Drag',
          [{ projectProperties: { title: 'Val 1' } }],
          { gestureId: 'g-slider-1', phase: 'begin' },
        ),
      );
      expect(history.read().length).toBe(1);

      // 2. Update gesture (same gestureId)
      await history.commit(
        context.nextCommitRequest(
          docId,
          1,
          'Slider Drag',
          [{ projectProperties: { title: 'Val 2' } }],
          { gestureId: 'g-slider-1', phase: 'update' },
        ),
      );
      // Still 1 entry in history!
      expect(history.read().length).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('Val 2');

      // 3. End gesture
      await history.commit(
        context.nextCommitRequest(
          docId,
          2,
          'Slider Drag',
          [{ projectProperties: { title: 'Val 3' } }],
          { gestureId: 'g-slider-1', phase: 'end' },
        ),
      );
      expect(history.read().length).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('Val 3');

      // 4. Undoing this single compound action restores the initial pre-drag state!
      await history.undo({
        documentId: docId,
        operationId: 'undo-drag',
        expectedRevision: 3,
        contextSequence: 4,
      });
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
    });

    it('cancels an active gesture and rolls back to pre-drag state', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      // Begin
      await history.commit(
        context.nextCommitRequest(
          docId,
          0,
          'Drag',
          [{ projectProperties: { title: 'Mid Drag' } }],
          { gestureId: 'g-1', phase: 'begin' },
        ),
      );
      expect(session.read().data?.getProjectProperties().title).toBe('Mid Drag');

      // Cancel
      const cancelRes = await history.commit(
        context.nextCommitRequest(docId, 1, 'Drag', [], { gestureId: 'g-1', phase: 'cancel' }),
      );
      expect(cancelRes.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(history.read().length).toBe(0);
    });
  });

  describe('retention limits and oversize proposal tokens', () => {
    it('evicts oldest whole entries when entry count exceeds limit', async () => {
      const { session, history, context } = setupHistory({ entryLimit: 3 });
      const docId = session.read().documentId!;

      for (let i = 0; i < 5; i++) {
        await history.commit(
          context.nextCommitRequest(docId, i, `Action ${i}`, [
            { projectProperties: { title: `Title ${i}` } },
          ]),
        );
      }

      expect(history.read().length).toBe(3);
      expect(history.read().cursor).toBe(3);
      // Oldest remaining entry should be Action 2
      expect(history.getEntries()[0].label).toBe('Action 2');
    });

    it('tracks isDirty and respects savedStateId checkpoint', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      // Initial clean state
      history.markClean();
      expect(history.isDirty()).toBe(false);

      // Edit makes it dirty
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      expect(history.isDirty()).toBe(true);

      // Save checkpoints state
      history.checkpointSave();
      expect(history.isDirty()).toBe(false);

      // Another edit
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );
      expect(history.isDirty()).toBe(true);

      // Undo back to saved state makes it clean again!
      await history.undo({
        documentId: docId,
        operationId: 'undo-to-saved',
        expectedRevision: 2,
        contextSequence: 3,
      });
      expect(history.isDirty()).toBe(false);
    });

    it('generates oversize proposal token when action exceeds byte limit and confirms with cleared history', async () => {
      // Set small byte limit of 500 bytes
      const { session, history, context } = setupHistory({ bytesLimit: 500 });
      const docId = session.read().documentId!;

      // Structural action produces large mementos (> 1KB)
      const bigReq = context.nextCommitRequest(docId, 0, 'Big Structural Edit', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]);

      const res = await history.commit(bigReq);
      expect(res.status).toBe('oversize');
      if (res.status !== 'oversize') return;

      expect(res.proposalToken).toBeDefined();
      expect(history.read().length).toBe(0);

      // Re-submitting with proposal token succeeds and commits
      const confirmedReq = context.nextCommitRequest(
        docId,
        0,
        'Big Structural Edit Confirmed',
        [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
        { proposalToken: res.proposalToken },
      );

      const confirmedRes = await history.commit(confirmedReq);
      expect(confirmedRes.status).toBe('committed');
      expect(session.read().revision).toBe(1);
    });

    it('enforces one-use oversize proposal token so it cannot be reused', async () => {
      const { session, history, context } = setupHistory({ bytesLimit: 500 });
      const docId = session.read().documentId!;

      const bigReq = context.nextCommitRequest(docId, 0, 'Big Structural Edit', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]);
      const res = await history.commit(bigReq);
      expect(res.status).toBe('oversize');
      if (res.status !== 'oversize') return;

      const confirmedReq = context.nextCommitRequest(
        docId,
        0,
        'Big Structural Edit Confirmed',
        [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
        { proposalToken: res.proposalToken },
      );

      const firstConfirmation = await history.commit(confirmedReq);
      expect(firstConfirmation.status).toBe('committed');

      // Attempting to reuse the same token
      const secondAttempt = context.nextCommitRequest(
        docId,
        1,
        'Reused Token Edit',
        [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
        { proposalToken: res.proposalToken },
      );
      const secondConfirmation = await history.commit(secondAttempt);
      expect(secondConfirmation.status).toBe('invalid');
      expect((secondConfirmation as { reason: string }).reason).toContain('already consumed');
    });

    it('cancels oversize proposal token via cancelOversizeProposal', async () => {
      const { session, history, context } = setupHistory({ bytesLimit: 500 });
      const docId = session.read().documentId!;

      const bigReq = context.nextCommitRequest(docId, 0, 'Big Structural Edit', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]);
      const res = await history.commit(bigReq);
      expect(res.status).toBe('oversize');
      if (res.status !== 'oversize') return;

      // Cancel proposal
      history.cancelOversizeProposal({ proposalToken: res.proposalToken });

      // Submitting with cancelled token fails
      const cancelledAttempt = context.nextCommitRequest(
        docId,
        0,
        'Cancelled Proposal Edit',
        [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
        { proposalToken: res.proposalToken },
      );
      const cancelledRes = await history.commit(cancelledAttempt);
      expect(cancelledRes.status).toBe('invalid');
    });

    it('rejects stale confirmation when revision or payload changes before confirmation', async () => {
      const { session, history, context } = setupHistory({ bytesLimit: 500 });
      const docId = session.read().documentId!;

      const bigReq = context.nextCommitRequest(docId, 0, 'Big Structural Edit', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]);
      const res = await history.commit(bigReq);
      expect(res.status).toBe('oversize');
      if (res.status !== 'oversize') return;

      // Interleaved edit advances revision
      session.recordMutation({ changed: true });

      // Confirmation submitted with now-stale revision
      const staleConfirmReq = context.nextCommitRequest(
        docId,
        0,
        'Stale Confirmation',
        [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
        { proposalToken: res.proposalToken },
      );
      const staleRes = await history.commit(staleConfirmReq);
      expect(staleRes.status).toBe('stale');
    });

    it('preserves saved checkpoint token across entry eviction without fabricating clean state', async () => {
      const { session, history, context } = setupHistory({ entryLimit: 3 });
      const docId = session.read().documentId!;

      // Initial clean state
      history.markClean();
      const initialSavedStateId = history.getSavedStateId();
      expect(history.isDirty()).toBe(false);

      // Perform 5 edits with limit 3 (evicts first 2 edits)
      for (let i = 0; i < 5; i++) {
        await history.commit(
          context.nextCommitRequest(docId, i, `Action ${i}`, [
            { projectProperties: { title: `Title ${i}` } },
          ]),
        );
      }

      // 5 edits were performed; history length is bounded to 3
      expect(history.read().length).toBe(3);
      // Even though the initial state is no longer in undo history, savedStateId is preserved
      expect(history.getSavedStateId()).toBe(initialSavedStateId);
      // Project is dirty because current stateId !== savedStateId
      expect(history.isDirty()).toBe(true);

      // Can undo up to 3 times (the retained entries)
      for (let i = 0; i < 3; i++) {
        await history.undo({
          documentId: docId,
          operationId: `undo-${i}`,
          expectedRevision: 5 + i,
          contextSequence: 10 + i,
        });
      }
      expect(history.read().canUndo).toBe(false);
      // Still dirty, because oldest entries were evicted; does NOT falsely report clean!
      expect(history.isDirty()).toBe(true);
    });

    it('verifies DEFAULT_RETAINED_ENTRY_LIMIT is 200 and DEFAULT_RETAINED_BYTES_LIMIT is 64 MiB', () => {
      expect(DEFAULT_RETAINED_ENTRY_LIMIT).toBe(200);
      expect(DEFAULT_RETAINED_BYTES_LIMIT).toBe(64 * 1024 * 1024);
    });
  });
});
