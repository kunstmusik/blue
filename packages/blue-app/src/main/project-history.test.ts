import { describe, expect, it } from 'vitest';
import {
  BSBKnob,
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  Effect,
  Parameter,
  ScoreTrack,
  TrackLayerGroup,
  cloneBlueX7Voice,
} from '@blue/data';
import { ProjectSession } from './project-session';
import {
  ProjectHistory,
  DEFAULT_RETAINED_ENTRY_LIMIT,
  DEFAULT_RETAINED_BYTES_LIMIT,
  computeStructuralInversePatches,
} from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import type { BlueX7Patch } from '../shared/project-editor/contract';
import { getMixerEntrySnapshotId } from '../shared/project-editor/identity';

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

    it('preserves semantic renderer action labels in canonical history', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;

      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Enable Loop Rendering', [
          { transport: { loopRendering: true } },
        ]),
      );
      expect(commit.status).toBe('committed');
      expect(history.read().undoLabel).toBe('Enable Loop Rendering');

      const undo = await history.undo({
        documentId: docId,
        operationId: 'undo-semantic-label',
        expectedRevision: 1,
        contextSequence: 2,
      });
      expect(undo.status).toBe('committed');
      expect(history.read().redoLabel).toBe('Enable Loop Rendering');
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

  describe('readEntries', () => {
    it('returns oldest-first lightweight summaries matching commit order', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit One', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit Two', [{ projectProperties: { title: 'T2' } }]),
      );

      const snapshot = history.readEntries({ documentId: docId });
      expect(snapshot.documentId).toBe(docId);
      expect(snapshot.revision).toBe(session.read().revision);
      expect(snapshot.cursor).toBe(2);
      expect(snapshot.entries.map((entry) => entry.label)).toEqual(['Edit One', 'Edit Two']);
      for (const entry of snapshot.entries) {
        expect(Object.keys(entry).sort()).toEqual([
          'afterStateId',
          'entryId',
          'label',
          'timestamp',
        ]);
        expect(entry.entryId.length).toBeGreaterThan(0);
        expect(entry.timestamp).toBeGreaterThan(0);
        expect(entry.afterStateId.length).toBeGreaterThan(0);
      }
      // Summaries must never carry mementos, patches, or origin metadata.
      const serialized = JSON.stringify(snapshot);
      expect(serialized).not.toContain('record');
      expect(serialized).not.toContain('forwardPatches');
      expect(serialized).not.toContain('inversePatches');
      expect(serialized).not.toContain('origin');
    });

    it('keeps every entry listed while the cursor moves through undo and redo', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit One', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit Two', [{ projectProperties: { title: 'T2' } }]),
      );

      await history.undo(context.nextUndoRequest(docId, 2));
      let snapshot = history.readEntries();
      expect(snapshot.cursor).toBe(1);
      expect(snapshot.entries).toHaveLength(2);

      await history.redo(context.nextRedoRequest(docId, 3));
      snapshot = history.readEntries();
      expect(snapshot.cursor).toBe(2);
      expect(snapshot.entries).toHaveLength(2);
    });

    it('reflects branch discard by dropping the discarded redo entries', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit One', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit Two', [{ projectProperties: { title: 'T2' } }]),
      );
      await history.undo(context.nextUndoRequest(docId, 2));

      await history.commit(
        context.nextCommitRequest(docId, 3, 'Edit Three', [{ projectProperties: { title: 'T3' } }]),
      );

      const snapshot = history.readEntries();
      expect(snapshot.entries.map((entry) => entry.label)).toEqual(['Edit One', 'Edit Three']);
      expect(snapshot.cursor).toBe(2);
    });

    it('reflects retention eviction of the oldest entries', async () => {
      const { session, history, context } = setupHistory({ entryLimit: 2 });
      const docId = session.read().documentId!;
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit One', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit Two', [{ projectProperties: { title: 'T2' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 2, 'Edit Three', [{ projectProperties: { title: 'T3' } }]),
      );

      const snapshot = history.readEntries();
      expect(snapshot.entries.map((entry) => entry.label)).toEqual(['Edit Two', 'Edit Three']);
      expect(snapshot.cursor).toBe(2);
    });

    it('lists a merged gesture as a single entry', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      const gestureId = 'gesture-type-title';
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Type Title', [{ projectProperties: { title: 'A' } }], {
          gestureId,
          phase: 'begin',
        }),
      );
      await history.commit(
        context.nextCommitRequest(
          docId,
          1,
          'Type Title',
          [{ projectProperties: { title: 'Ab' } }],
          {
            gestureId,
            phase: 'update',
          },
        ),
      );
      await history.commit(
        context.nextCommitRequest(
          docId,
          2,
          'Type Title',
          [{ projectProperties: { title: 'Abc' } }],
          {
            gestureId,
            phase: 'end',
          },
        ),
      );

      const snapshot = history.readEntries();
      expect(snapshot.entries).toHaveLength(1);
      expect(snapshot.entries[0]?.label).toBe('Type Title');
      expect(snapshot.cursor).toBe(1);
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

    it('groups a scalar edit followed by a structural edit with exact XML replay', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      const initialXml = session.read().data!.saveToString();

      await history.commit(
        context.nextCommitRequest(
          docId,
          0,
          'Mixed Gesture',
          [{ projectProperties: { title: 'During Gesture' } }],
          { gestureId: 'g-mixed-scalar-structure', phase: 'begin' },
        ),
      );
      await history.commit(
        context.nextCommitRequest(
          docId,
          1,
          'Mixed Gesture',
          [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
          { gestureId: 'g-mixed-scalar-structure', phase: 'update' },
        ),
      );

      const finalXml = session.read().data!.saveToString();
      expect(history.read().length).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('During Gesture');
      expect(session.read().data?.getArrangement().size()).toBe(1);

      const undo = await history.undo({
        documentId: docId,
        operationId: 'undo-mixed-scalar-structure',
        expectedRevision: 2,
        contextSequence: 3,
      });
      expect(undo.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(session.read().data?.getArrangement().size()).toBe(0);
      expect(session.read().data!.saveToString()).toBe(initialXml);

      const redo = await history.redo({
        documentId: docId,
        operationId: 'redo-mixed-scalar-structure',
        expectedRevision: 3,
        contextSequence: 4,
      });
      expect(redo.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('During Gesture');
      expect(session.read().data?.getArrangement().size()).toBe(1);
      expect(session.read().data!.saveToString()).toBe(finalXml);
    });

    it('groups a structural edit followed by a scalar edit with exact XML replay', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      const initialXml = session.read().data!.saveToString();

      await history.commit(
        context.nextCommitRequest(
          docId,
          0,
          'Mixed Gesture',
          [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
          { gestureId: 'g-mixed-structure-scalar', phase: 'begin' },
        ),
      );
      await history.commit(
        context.nextCommitRequest(
          docId,
          1,
          'Mixed Gesture',
          [{ projectProperties: { title: 'After Structure' } }],
          { gestureId: 'g-mixed-structure-scalar', phase: 'update' },
        ),
      );

      const finalXml = session.read().data!.saveToString();
      expect(history.read().length).toBe(1);
      expect(session.read().data?.getProjectProperties().title).toBe('After Structure');
      expect(session.read().data?.getArrangement().size()).toBe(1);

      const undo = await history.undo({
        documentId: docId,
        operationId: 'undo-mixed-structure-scalar',
        expectedRevision: 2,
        contextSequence: 3,
      });
      expect(undo.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('Initial Title');
      expect(session.read().data?.getArrangement().size()).toBe(0);
      expect(session.read().data!.saveToString()).toBe(initialXml);

      const redo = await history.redo({
        documentId: docId,
        operationId: 'redo-mixed-structure-scalar',
        expectedRevision: 3,
        contextSequence: 4,
      });
      expect(redo.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().title).toBe('After Structure');
      expect(session.read().data?.getArrangement().size()).toBe(1);
      expect(session.read().data!.saveToString()).toBe(finalXml);
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

  describe('save state matrix (spec 109)', () => {
    it('derives none, unsaved, saved, and modified through the lifecycle transitions', async () => {
      // No document at all -> none.
      const emptySession = new ProjectSession();
      const emptyHistory = new ProjectHistory({ session: emptySession });
      expect(emptyHistory.getSaveState()).toBe('none');
      expect(emptyHistory.isDirty()).toBe(false);

      // Created project without a file path -> unsaved even with clean history.
      const { session, data, history, context } = setupHistory();
      session.replace(data, null);
      history.clear();
      history.checkpointSave();
      expect(history.getSaveState()).toBe('unsaved');
      expect(history.isDirty()).toBe(false);

      const docId = session.read().documentId!;
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      expect(history.getSaveState()).toBe('unsaved');

      // Opened (or saved-to-disk) project: path plus matching checkpoint -> saved.
      session.replace(data, '/tmp/project.blue', { preserveDocumentId: true });
      history.clear();
      history.checkpointSave();
      expect(history.getSaveState()).toBe('saved');

      // Durable commit moves away from the checkpoint -> modified.
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );
      expect(history.getSaveState()).toBe('modified');

      // Undo restores the checkpointed stateId -> saved again.
      const undoRes = await history.undo({
        documentId: docId,
        operationId: 'save-state-undo-1',
        expectedRevision: 1,
        contextSequence: 3,
      });
      expect(undoRes.status).toBe('committed');
      expect(history.getSaveState()).toBe('saved');

      // Redo reapplies the post-save change -> modified again.
      const redoRes = await history.redo({
        documentId: docId,
        operationId: 'save-state-redo-1',
        expectedRevision: 2,
        contextSequence: 4,
      });
      expect(redoRes.status).toBe('committed');
      expect(history.getSaveState()).toBe('modified');

      // A successful save checkpoints the current state -> saved.
      history.checkpointSave();
      expect(history.getSaveState()).toBe('saved');

      // Close -> none.
      session.close();
      expect(history.getSaveState()).toBe('none');
    });

    it('keeps a never-saved project unsaved across edits, undo, and redo', async () => {
      const { session, data, history, context } = setupHistory();
      session.replace(data, null);
      history.clear();
      history.checkpointSave();
      const docId = session.read().documentId!;

      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      expect(history.getSaveState()).toBe('unsaved');

      await history.undo({
        documentId: docId,
        operationId: 'unsaved-undo-1',
        expectedRevision: 1,
        contextSequence: 2,
      });
      expect(history.getSaveState()).toBe('unsaved');
      expect(history.isDirty()).toBe(false);
    });

    it('derives modified from state identity rather than cursor position on branch/prune', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      history.checkpointSave();
      expect(history.getSaveState()).toBe('saved');

      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );
      expect(history.getSaveState()).toBe('modified');

      // Undo twice returns exactly to the saved baseline stateId.
      await history.undo({
        documentId: docId,
        operationId: 'branch-undo-1',
        expectedRevision: 2,
        contextSequence: 3,
      });
      await history.undo({
        documentId: docId,
        operationId: 'branch-undo-2',
        expectedRevision: 3,
        contextSequence: 4,
      });
      expect(history.getSaveState()).toBe('saved');

      // A new commit prunes the redo stack and creates a modified branch.
      const branchRes = await history.commit(
        context.nextCommitRequest(docId, 4, 'Branched Edit', [
          { projectProperties: { title: 'B1' } },
        ]),
      );
      expect(branchRes.status).toBe('committed');
      expect(history.read().canRedo).toBe(false);
      expect(history.getSaveState()).toBe('modified');
    });

    it('tracks a save before the redo tip so only the saved revision is clean', async () => {
      const { session, history, context } = setupHistory();
      const docId = session.read().documentId!;
      history.checkpointSave();

      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );
      await history.commit(
        context.nextCommitRequest(docId, 1, 'Edit 2', [{ projectProperties: { title: 'T2' } }]),
      );
      await history.undo({
        documentId: docId,
        operationId: 'tip-undo-1',
        expectedRevision: 2,
        contextSequence: 3,
      });
      expect(history.read().canRedo).toBe(true);

      // Saving here checkpoints the state at the cursor, before the redo tip.
      const savedAtCursor = session.read().stateId;
      history.checkpointSave(savedAtCursor ?? undefined);
      expect(history.getSaveState()).toBe('saved');

      // Redo past the new save point -> modified.
      await history.redo({
        documentId: docId,
        operationId: 'tip-redo-1',
        expectedRevision: 3,
        contextSequence: 4,
      });
      expect(history.getSaveState()).toBe('modified');

      // Undo back to the save point -> saved again.
      await history.undo({
        documentId: docId,
        operationId: 'tip-undo-2',
        expectedRevision: 4,
        contextSequence: 5,
      });
      expect(history.getSaveState()).toBe('saved');
    });

    it('is read-only: querying never mutates the session, history, cursor, or publications', async () => {
      const { session, history, recorder, context } = setupHistory();
      const docId = session.read().documentId!;
      history.checkpointSave();
      await history.commit(
        context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
      );

      const sessionBefore = { ...session.read() };
      const projectionBefore = history.read();
      const eventsBefore = recorder.events.length;

      expect(history.getSaveState()).toBe('modified');
      expect(history.getSaveState()).toBe('modified');

      const sessionAfter = session.read();
      expect(sessionAfter.data).toBe(sessionBefore.data);
      expect(sessionAfter.filePath).toBe(sessionBefore.filePath);
      expect(sessionAfter.revision).toBe(sessionBefore.revision);
      expect(sessionAfter.sessionId).toBe(sessionBefore.sessionId);
      expect(sessionAfter.documentId).toBe(sessionBefore.documentId);
      expect(sessionAfter.stateId).toBe(sessionBefore.stateId);
      expect(history.read()).toEqual(projectionBefore);
      expect(history.read().cursor).toBe(projectionBefore.cursor);
      expect(recorder.events.length).toBe(eventsBefore);
    });
  });

  describe('computeStructuralInversePatches', () => {
    it('inverts Track updateTrackInstrument with BlueX7 replaceVoice', () => {
      const data = new BlueData();
      const group = new TrackLayerGroup();
      const track = new ScoreTrack();
      const blueX7 = new BlueX7();
      const initialVoice = cloneBlueX7Voice(blueX7.getVoice());
      initialVoice.common.algorithm = 7;
      blueX7.setVoice(cloneBlueX7Voice(initialVoice));
      track.setInstrument(blueX7);
      group.push(track);
      data.getScore().push(group);

      const newVoice = cloneBlueX7Voice(initialVoice);
      newVoice.common.algorithm = 21;

      const inverse = computeStructuralInversePatches(data, [
        {
          score: {
            type: 'updateTrackInstrument',
            track: {
              rootGroupId: group.getUniqueId(),
              trackId: track.getUniqueId(),
              projectSessionId: 1,
              projectRevision: 0,
            },
            patch: {
              blueX7: {
                type: 'replaceVoice',
                voice: newVoice,
              },
            },
          },
        },
      ]);

      expect(inverse).not.toBeNull();
      expect(inverse).toHaveLength(1);
      const invScore = inverse![0]?.score;
      expect(invScore?.type).toBe('updateTrackInstrument');
      if (invScore?.type === 'updateTrackInstrument') {
        const bx7 = invScore.patch.blueX7;
        expect(bx7?.type).toBe('replaceVoice');
        if (bx7?.type === 'replaceVoice') {
          expect(bx7.voice.common.algorithm).toBe(7);
        }
      }
    });

    it('inverts Arrangement updateInstrument with BlueX7 replaceVoice', () => {
      const data = new BlueData();
      const blueX7 = new BlueX7();
      const initialVoice = cloneBlueX7Voice(blueX7.getVoice());
      initialVoice.common.algorithm = 11;
      blueX7.setVoice(cloneBlueX7Voice(initialVoice));
      data.getArrangement().addInstrument(blueX7, 'instr-1');

      const newVoice = cloneBlueX7Voice(initialVoice);
      newVoice.common.algorithm = 32;

      const inverse = computeStructuralInversePatches(data, [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'instr-1',
            patch: {
              blueX7: {
                type: 'replaceVoice',
                voice: newVoice,
              },
            },
          },
        },
      ]);

      expect(inverse).not.toBeNull();
      expect(inverse).toHaveLength(1);
      const invOrc = inverse![0]?.orchestra;
      expect(invOrc?.type).toBe('updateInstrument');
      if (invOrc?.type === 'updateInstrument') {
        const bx7 = invOrc.patch.blueX7;
        expect(bx7?.type).toBe('replaceVoice');
        if (bx7?.type === 'replaceVoice') {
          expect(bx7.voice.common.algorithm).toBe(11);
        }
      }
    });

    it('inverts every voice-affecting BlueX7 patch from the pre-mutation voice', () => {
      const data = new BlueData();
      const blueX7 = new BlueX7();
      const initialVoice = cloneBlueX7Voice(blueX7.getVoice());
      initialVoice.common.feedback = 3;
      blueX7.setVoice(cloneBlueX7Voice(initialVoice));
      data.getArrangement().addInstrument(blueX7, 'instr-voice');

      const voicePatches: BlueX7Patch[] = [
        { type: 'setCommonField', field: 'feedback', value: 6 },
        { type: 'setOperatorEnabled', operatorIndex: 0, enabled: false },
        { type: 'setLfoField', field: 'speed', value: 4 },
        { type: 'setOperatorField', operatorIndex: 0, field: 'outputLevel', value: 80 },
        { type: 'setSharedOscillatorSync', value: 1 },
        { type: 'setSharedPitchModulationSensitivity', value: 2 },
        {
          type: 'setOperatorEnvelopePoint',
          operatorIndex: 0,
          stageIndex: 0,
          point: { rate: 4, level: 5 },
        },
        { type: 'setPitchEnvelopePoint', stageIndex: 0, point: { rate: 4, level: 5 } },
        {
          type: 'replaceVoice',
          voice: {
            ...cloneBlueX7Voice(initialVoice),
            common: { ...initialVoice.common, feedback: 7 },
          },
        },
      ];

      for (const blueX7Patch of voicePatches) {
        const inverse = computeStructuralInversePatches(data, [
          {
            orchestra: {
              type: 'updateInstrument',
              assignmentId: 'instr-voice',
              patch: { blueX7: blueX7Patch },
            },
          },
        ]);

        expect(inverse).not.toBeNull();
        const inversePatch = inverse?.[0]?.orchestra;
        expect(inversePatch?.type).toBe('updateInstrument');
        if (inversePatch?.type !== 'updateInstrument') continue;
        expect(inversePatch.patch.blueX7).toEqual({
          type: 'replaceVoice',
          voice: initialVoice,
        });
      }
    });

    it('inverts BlueX7 post-code without replacing the voice snapshot', () => {
      const data = new BlueData();
      const blueX7 = new BlueX7();
      blueX7.setCsoundPostCode('; previous post code');
      data.getArrangement().addInstrument(blueX7, 'instr-code');

      const inverse = computeStructuralInversePatches(data, [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'instr-code',
            patch: { blueX7: { type: 'setCsoundPostCode', text: '; next post code' } },
          },
        },
      ]);

      expect(inverse?.[0]?.orchestra).toEqual({
        type: 'updateInstrument',
        assignmentId: 'instr-code',
        patch: { blueX7: { type: 'setCsoundPostCode', text: '; previous post code' } },
      });
    });

    it('inverts every Track BlueX7 field patch from the pre-mutation state', () => {
      const data = new BlueData();
      const group = new TrackLayerGroup();
      const track = new ScoreTrack();
      const blueX7 = new BlueX7();
      blueX7.setCsoundPostCode('; previous post code');
      const initialVoice = cloneBlueX7Voice(blueX7.getVoice());
      initialVoice.common.feedback = 3;
      blueX7.setVoice(cloneBlueX7Voice(initialVoice));
      track.setInstrument(blueX7);
      group.push(track);
      data.getScore().push(group);

      const trackTarget = {
        rootGroupId: group.getUniqueId(),
        trackId: track.getUniqueId(),
        projectSessionId: 1,
        projectRevision: 0,
      };
      const voicePatches: BlueX7Patch[] = [
        { type: 'setCommonField', field: 'feedback', value: 6 },
        { type: 'setOperatorEnabled', operatorIndex: 0, enabled: false },
        { type: 'setLfoField', field: 'speed', value: 4 },
        { type: 'setOperatorField', operatorIndex: 0, field: 'outputLevel', value: 80 },
        { type: 'setSharedOscillatorSync', value: 1 },
        { type: 'setSharedPitchModulationSensitivity', value: 2 },
        {
          type: 'setOperatorEnvelopePoint',
          operatorIndex: 0,
          stageIndex: 0,
          point: { rate: 4, level: 5 },
        },
        { type: 'setPitchEnvelopePoint', stageIndex: 0, point: { rate: 4, level: 5 } },
        {
          type: 'replaceVoice',
          voice: {
            ...cloneBlueX7Voice(initialVoice),
            common: { ...initialVoice.common, feedback: 7 },
          },
        },
      ];

      for (const blueX7Patch of voicePatches) {
        const inverse = computeStructuralInversePatches(data, [
          {
            score: {
              type: 'updateTrackInstrument',
              track: trackTarget,
              patch: { blueX7: blueX7Patch },
            },
          },
        ]);

        expect(inverse).not.toBeNull();
        expect(inverse?.[0]?.score).toMatchObject({
          type: 'updateTrackInstrument',
          track: trackTarget,
        });
        const inversePatch = inverse?.[0]?.score;
        if (inversePatch?.type !== 'updateTrackInstrument') continue;
        expect(inversePatch.patch.blueX7).toEqual({
          type: 'replaceVoice',
          voice: initialVoice,
        });
      }

      const postCodeInverse = computeStructuralInversePatches(data, [
        {
          score: {
            type: 'updateTrackInstrument',
            track: trackTarget,
            patch: { blueX7: { type: 'setCsoundPostCode', text: '; next post code' } },
          },
        },
      ]);
      expect(postCodeInverse?.[0]?.score).toEqual({
        type: 'updateTrackInstrument',
        track: trackTarget,
        patch: { blueX7: { type: 'setCsoundPostCode', text: '; previous post code' } },
      });
    });

    it('keeps Track name, comment, and voice inverses separate and ordered', () => {
      const data = new BlueData();
      const group = new TrackLayerGroup();
      const track = new ScoreTrack();
      const blueX7 = new BlueX7();
      blueX7.setName('Before');
      blueX7.setComment('Before comment');
      track.setInstrument(blueX7);
      group.push(track);
      data.getScore().push(group);

      const trackTarget = {
        rootGroupId: group.getUniqueId(),
        trackId: track.getUniqueId(),
        projectSessionId: 1,
        projectRevision: 0,
      };
      const inverse = computeStructuralInversePatches(data, [
        {
          score: {
            type: 'updateTrackInstrument',
            track: trackTarget,
            patch: { name: 'After' },
          },
        },
        {
          score: {
            type: 'updateTrackInstrument',
            track: trackTarget,
            patch: { comment: 'After comment' },
          },
        },
        {
          score: {
            type: 'updateTrackInstrument',
            track: trackTarget,
            patch: { blueX7: { type: 'setCommonField', field: 'feedback', value: 6 } },
          },
        },
      ]);

      expect(inverse?.map((patch) => patch.score)).toEqual([
        { type: 'updateTrackInstrument', track: trackTarget, patch: { name: 'Before' } },
        {
          type: 'updateTrackInstrument',
          track: trackTarget,
          patch: { comment: 'Before comment' },
        },
        {
          type: 'updateTrackInstrument',
          track: trackTarget,
          patch: {
            blueX7: { type: 'replaceVoice', voice: cloneBlueX7Voice(blueX7.getVoice()) },
          },
        },
      ]);
    });

    it('inverts BSB control and preset edits from the pre-mutation interface', () => {
      const data = new BlueData();
      const instrument = new BlueSynthBuilder();
      const knob = new BSBKnob();
      knob.id = 'gain-widget';
      knob.objectName = 'gain';
      knob.value = 0.25;
      instrument.setInstrumentText('aout oscili <gain>, 440\nout aout');
      instrument.getGraphicInterface().getRootGroup().addChild(knob);
      data.getArrangement().addInstrument(instrument, 'instr-bsb');

      const valueInverse = computeStructuralInversePatches(data, [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'instr-bsb',
            patch: {
              bsbInterface: {
                type: 'updateWidgetProperties',
                widgetId: 'gain-widget',
                properties: { value: 0.8 },
              },
            },
          },
        },
      ]);

      expect(valueInverse?.[0]?.orchestra).toEqual({
        type: 'updateInstrument',
        assignmentId: 'instr-bsb',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'gain-widget',
            properties: { value: 0.25 },
          },
        },
      });

      const presetInverse = computeStructuralInversePatches(data, [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'instr-bsb',
            patch: { bsbInterface: { type: 'applyPreset', presetUniqueId: 'preset-2' } },
          },
        },
      ]);

      expect(presetInverse?.[0]?.orchestra).toEqual({
        type: 'updateInstrument',
        assignmentId: 'instr-bsb',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'gain-widget',
            properties: { value: 0.25 },
          },
        },
      });
    });

    it('inverts editable mixer effect BSB parameters from the pre-mutation effect', () => {
      const data = new BlueData();
      const effect = new Effect();
      const parameter = new Parameter();
      parameter.setName('mix');
      parameter.setFixedValue(0.2);
      effect.addParameter(parameter);
      const knob = new BSBKnob();
      knob.id = 'effect-mix-widget';
      knob.objectName = 'mix';
      knob.value = 0.2;
      effect.getGraphicInterface().getRootGroup().addChild(knob);
      data.getMixer().getMaster().getPreEffects().push(effect);
      const entryId = getMixerEntrySnapshotId(effect, 'fx-1');

      const inverse = computeStructuralInversePatches(data, [
        {
          mixer: {
            type: 'updateEffect',
            channelId: 'Master',
            chain: 'pre',
            entryId,
            patch: {
              bsbInterface: {
                type: 'updateWidgetProperties',
                widgetId: 'effect-mix-widget',
                properties: { value: 0.9 },
              },
            },
          },
        },
      ]);

      expect(inverse?.[0]?.mixer).toEqual({
        type: 'updateEffect',
        channelId: 'Master',
        chain: 'pre',
        entryId: 'fx-1',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'effect-mix-widget',
            properties: { value: 0.2 },
          },
        },
      });
    });
  });
});
