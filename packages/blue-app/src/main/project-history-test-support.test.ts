import { describe, it, expect } from 'vitest';
import {
  MockHistoryContext,
  FakePublicationRecorder,
  FakePerformanceManager,
  generate100ActionWorkload,
} from './project-history-test-support';
import { MockRendererHistoryBridge } from '../renderer/tests/global-history-test-support';

describe('project-history-test-support', () => {
  it('generates 100 alternating mixed actions across two contexts', () => {
    const ctxA = new MockHistoryContext('ctx-a');
    const ctxB = new MockHistoryContext('ctx-b');

    const workload = generate100ActionWorkload('doc-100', ctxA, ctxB, 1);
    expect(workload.length).toBe(100);
    expect(workload[0].origin?.contextId).toBe('ctx-a');
    expect(workload[1].origin?.contextId).toBe('ctx-b');
    expect(workload[0].expectedRevision).toBe(1);
    expect(workload[99].expectedRevision).toBe(100);
  });

  it('records publication events and reconciles fake performances', async () => {
    const recorder = new FakePublicationRecorder();
    expect(recorder.events.length).toBe(0);

    const perfManager = new FakePerformanceManager();
    perfManager.startPerformance('timeline', 'success');
    const outcome = await perfManager.reconcileWork('timeline', 5);
    expect(outcome.status).toBe('applied');
    expect(outcome.desiredRevision).toBe(5);

    perfManager.startPerformance('blueLive', 'negative-ack');
    const failOutcome = await perfManager.reconcileWork('blueLive', 6);
    expect(failOutcome.status).toBe('failed');
  });

  it('exercises MockRendererHistoryBridge commit, undo, and redo', async () => {
    const bridge = new MockRendererHistoryBridge({ documentId: 'doc-test' });
    expect(bridge.canUndo).toBe(false);

    const commitRes = await bridge.commit({
      documentId: 'doc-test',
      operationId: 'op-1',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Edit Level',
    });
    expect(commitRes.status).toBe('committed');
    expect(bridge.canUndo).toBe(true);
    expect(bridge.isDirty).toBe(true);

    const undoRes = await bridge.undo({
      documentId: 'doc-test',
      operationId: 'op-2',
      expectedRevision: 1,
      contextSequence: 2,
    });
    expect(undoRes.status).toBe('committed');
    expect(bridge.canRedo).toBe(true);
    expect(bridge.isDirty).toBe(false);

    const redoRes = await bridge.redo({
      documentId: 'doc-test',
      operationId: 'op-3',
      expectedRevision: 2,
      contextSequence: 3,
    });
    expect(redoRes.status).toBe('committed');
    expect(bridge.canUndo).toBe(true);
  });
});
