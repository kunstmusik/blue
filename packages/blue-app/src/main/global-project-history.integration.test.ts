import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import {
  MockHistoryContext,
  captureProjectStateXml,
  generate100ActionWorkload,
} from './project-history-test-support';

/**
 * End-to-end User Story 1 scenario: two renderer contexts alternate 100 mixed
 * scalar/structural actions through one main-owned history. The whole span
 * must undo exactly back to the initial state and redo exactly forward, with
 * duplicate deliveries applied once.
 */
describe('global project history integration (T027, US1)', () => {
  function setup() {
    const session = new ProjectSession();
    const data = new BlueData();
    data.getProjectProperties().title = 'Integration Base';
    session.replace(data, '/tmp/integration.blue');

    const history = new ProjectHistory({ session });
    const contextA = new MockHistoryContext('ctx-a');
    const contextB = new MockHistoryContext('ctx-b');
    return { session, history, contextA, contextB };
  }

  it('commits, undoes, and redoes 100 alternating mixed actions exactly', async () => {
    const { session, history, contextA, contextB } = setup();
    const docId = session.read().documentId!;
    const initialXml = captureProjectStateXml(session);

    const requests = generate100ActionWorkload(docId, contextA, contextB, 0);
    expect(requests).toHaveLength(100);

    for (const request of requests) {
      const res = await history.commit(request);
      expect(res.status).toBe('committed');
    }
    expect(session.read().revision).toBe(100);
    expect(history.read().length).toBe(100);
    expect(history.read().cursor).toBe(100);
    expect(history.read().canUndo).toBe(true);
    expect(history.read().canRedo).toBe(false);

    const finalXml = captureProjectStateXml(session);
    expect(finalXml).not.toBe(initialXml);

    // Undo the entire span, alternating undo requests between the two contexts.
    for (let i = 0; i < 100; i += 1) {
      const context = i % 2 === 0 ? contextA : contextB;
      const res = await history.undo(context.nextUndoRequest(docId, session.read().revision));
      expect(res.status).toBe('committed');
    }
    expect(history.read().cursor).toBe(0);
    expect(history.read().canUndo).toBe(false);
    expect(history.read().canRedo).toBe(true);
    expect(captureProjectStateXml(session)).toBe(initialXml);

    // Redo the entire span with the other context leading.
    for (let i = 0; i < 100; i += 1) {
      const context = i % 2 === 0 ? contextB : contextA;
      const res = await history.redo(context.nextRedoRequest(docId, session.read().revision));
      expect(res.status).toBe('committed');
    }
    expect(history.read().cursor).toBe(100);
    expect(history.read().canRedo).toBe(false);
    expect(captureProjectStateXml(session)).toBe(finalXml);
  });

  it('applies each of the 100 actions exactly once under duplicate delivery', async () => {
    const { session, history, contextA, contextB } = setup();
    const docId = session.read().documentId!;
    const initialXml = captureProjectStateXml(session);

    const requests = generate100ActionWorkload(docId, contextA, contextB, 0);
    for (const request of requests) {
      const first = await history.commit(request);
      expect(first.status).toBe('committed');

      // Simulated IPC retry of the identical submission.
      const duplicate = await history.commit(request);
      expect(duplicate).toBe(first);
    }

    expect(session.read().revision).toBe(100);
    expect(history.read().length).toBe(100);

    // A single full undo returns to the initial state: no action was applied
    // twice as a second history entry.
    const undoAll = await history.undo(contextA.nextUndoRequest(docId, 100));
    expect(undoAll.status).toBe('committed');
    for (let i = 1; i < 100; i += 1) {
      await history.undo(contextB.nextUndoRequest(docId, session.read().revision));
    }
    expect(captureProjectStateXml(session)).toBe(initialXml);
  });

  it('keeps labels and branches intact across the 100-action span', async () => {
    const { session, history, contextA, contextB } = setup();
    const docId = session.read().documentId!;

    const requests = generate100ActionWorkload(docId, contextA, contextB, 0);
    for (const request of requests) {
      await history.commit(request);
    }

    const projection = history.read();
    expect(projection.undoLabel).toBe(requests[99]!.label);

    // Branch after undoing one action, then verify the redo branch is gone.
    await history.undo(contextA.nextUndoRequest(docId, 100));
    const branch = await history.commit(
      contextA.nextCommitRequest(docId, 101, 'Branched Final', [
        { projectProperties: { author: 'Branch Author' } },
      ]),
    );
    expect(branch.status).toBe('committed');
    expect(history.read().length).toBe(100);
    expect(history.read().cursor).toBe(100);
    expect(history.read().canRedo).toBe(false);
    expect(session.read().data?.getProjectProperties().author).toBe('Branch Author');
  });

  it('summarizes the workload for the undo panel without side effects (spec 106)', async () => {
    const { session, history, contextA, contextB } = setup();
    const docId = session.read().documentId!;

    const requests = generate100ActionWorkload(docId, contextA, contextB, 0);
    for (const request of requests) {
      await history.commit(request);
    }

    const before = {
      revision: session.read().revision,
      projection: history.read(),
    };
    const snapshot = history.readEntries({ documentId: docId });
    const snapshotAgain = history.readEntries({ documentId: docId });

    // Snapshot correctness over the full workload.
    expect(snapshot.documentId).toBe(docId);
    expect(snapshot.revision).toBe(before.revision);
    expect(snapshot.cursor).toBe(100);
    expect(snapshot.entries).toHaveLength(100);
    expect(snapshot.entries.map((entry) => entry.label)).toEqual(
      requests.map((request) => request.label),
    );

    // Read-only guarantee: repeated reads leave document, history, and dirty
    // state untouched (FR-007).
    expect(snapshotAgain).toEqual(snapshot);
    expect(session.read().revision).toBe(before.revision);
    expect(history.read()).toEqual(before.projection);
    expect(history.getEntries()).toHaveLength(100);
  });
});
