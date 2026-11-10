// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

import {
  executeProjectCommand,
  executeProjectRedo,
  executeProjectUndo,
  finishProjectGesture,
  registerHistoryEditorSettlement,
  settleHistoryEditors,
} from '../lib/history-scope-router';
import { getProjectDocumentRevision, useProjectStore } from '../stores/project-store';

describe('project undo/redo failure reporting (T118)', () => {
  let undoProjectHistoryMock: ReturnType<typeof vi.fn>;
  let redoProjectHistoryMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();

    undoProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'undo-1',
      documentId: 'doc-1',
      revision: 2,
    }));
    redoProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'redo-1',
      documentId: 'doc-1',
      revision: 3,
    }));

    window.blueAPI = {
      ...window.blueAPI,
      undoProjectHistory: undoProjectHistoryMock,
      redoProjectHistory: redoProjectHistoryMock,
    } as unknown as typeof window.blueAPI;

    useProjectStore.setState({
      loaded: true,
      documentId: 'doc-1',
      projectInfo: { title: 'Test Project', documentId: 'doc-1' },
      sessionId: 1,
    });
  });

  afterEach(() => {
    delete (window as { blueAPI?: unknown }).blueAPI;
    useProjectStore.setState({ loaded: false, documentId: null, projectInfo: null });
  });

  it('surfaces a failed undo as visible error feedback', async () => {
    undoProjectHistoryMock.mockResolvedValue({
      status: 'failed',
      operationId: 'undo-1',
      documentId: 'doc-1',
      error: 'Settlement barrier timed out after 5000ms',
    });

    await executeProjectUndo();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      'Undo failed: Settlement barrier timed out after 5000ms',
    );
  });

  it('surfaces an invalid undo as visible error feedback', async () => {
    undoProjectHistoryMock.mockResolvedValue({
      status: 'invalid',
      operationId: 'undo-1',
      documentId: 'doc-1',
      reason: 'No active project document',
    });

    await executeProjectUndo();

    expect(toast.error).toHaveBeenCalledWith('Undo failed: No active project document');
  });

  it('surfaces failed and invalid redo responses as visible error feedback', async () => {
    redoProjectHistoryMock.mockResolvedValue({
      status: 'failed',
      operationId: 'redo-1',
      documentId: 'doc-1',
      error: 'engine exploded',
    });
    await executeProjectRedo();
    expect(toast.error).toHaveBeenLastCalledWith('Redo failed: engine exploded');

    redoProjectHistoryMock.mockResolvedValue({
      status: 'invalid',
      operationId: 'redo-2',
      documentId: 'doc-1',
      reason: 'No history entry to redo',
    });
    await executeProjectRedo();
    expect(toast.error).toHaveBeenLastCalledWith('Redo failed: No history entry to redo');
  });

  it('does not report committed, stale, or unchanged responses as failures', async () => {
    undoProjectHistoryMock.mockResolvedValue({
      status: 'stale',
      operationId: 'undo-1',
      documentId: 'doc-1',
      currentRevision: 4,
      currentStateId: 'state-1',
      reason: 'Revision mismatch',
    });
    await executeProjectUndo();
    expect(toast.error).not.toHaveBeenCalled();

    undoProjectHistoryMock.mockResolvedValue({
      status: 'unchanged',
      operationId: 'undo-2',
      documentId: 'doc-1',
      revision: 4,
      stateId: 'state-1',
      isDirty: false,
      history: {
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null,
        cursor: 0,
        length: 0,
        retainedBytes: 0,
        savedStateId: null,
        stateId: 'state-1',
        revision: 4,
        limitBytes: 67108864,
        maxEntries: 200,
        retentionStatus: 'empty',
      },
    });
    await executeProjectUndo();

    redoProjectHistoryMock.mockResolvedValue({
      status: 'committed',
      operationId: 'redo-1',
      documentId: 'doc-1',
      revision: 5,
    });
    await executeProjectRedo();

    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('finishProjectGesture (T011)', () => {
  let commitProjectHistoryMock: ReturnType<typeof vi.fn>;
  let flushPendingPatchesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commitProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'end-1',
      documentId: 'doc-1',
      revision: 10,
    }));

    window.blueAPI = {
      ...window.blueAPI,
      commitProjectHistory: commitProjectHistoryMock,
    } as unknown as typeof window.blueAPI;

    flushPendingPatchesMock = vi.fn(async () => {});
    useProjectStore.setState({
      loaded: true,
      documentId: 'doc-1',
      projectInfo: { title: 'Test Project', documentId: 'doc-1' },
      sessionId: 1,
      flushPendingPatches: flushPendingPatchesMock,
    });
  });

  afterEach(() => {
    delete (window as { blueAPI?: unknown }).blueAPI;
    useProjectStore.setState({ loaded: false, documentId: null, projectInfo: null });
  });

  it('flushes pending patches and submits an empty-patch commit envelope', async () => {
    const res = await finishProjectGesture({
      documentId: 'doc-1',
      sessionId: 1,
      gestureId: 'g-move',
      phase: 'end',
      label: 'Move Score Object',
    });

    expect(flushPendingPatchesMock).toHaveBeenCalledTimes(1);
    expect(commitProjectHistoryMock).toHaveBeenCalledTimes(1);
    expect(commitProjectHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        gestureId: 'g-move',
        phase: 'end',
        label: 'Move Score Object',
        patches: [],
        expectedRevision: expect.any(Number),
        contextSequence: expect.any(Number),
      }),
    );
    expect(res.status).toBe('committed');
  });

  it('rejects when documentId does not match current project authority', async () => {
    const res = await finishProjectGesture({
      documentId: 'doc-different',
      sessionId: 1,
      gestureId: 'g-move',
      phase: 'end',
    });

    expect(flushPendingPatchesMock).toHaveBeenCalledTimes(1);
    expect(commitProjectHistoryMock).not.toHaveBeenCalled();
    expect(res.status).toBe('invalid');
  });

  it('rejects when sessionId does not match current project authority', async () => {
    const res = await finishProjectGesture({
      documentId: 'doc-1',
      sessionId: 999,
      gestureId: 'g-move',
      phase: 'end',
    });

    expect(flushPendingPatchesMock).toHaveBeenCalledTimes(1);
    expect(commitProjectHistoryMock).not.toHaveBeenCalled();
    expect(res.status).toBe('invalid');
  });

  it('accepts returned revision on committed or unchanged', async () => {
    commitProjectHistoryMock.mockResolvedValueOnce({
      status: 'unchanged',
      operationId: 'end-2',
      documentId: 'doc-1',
      revision: 42,
    });

    const res = await finishProjectGesture({
      documentId: 'doc-1',
      sessionId: 1,
      gestureId: 'g-move',
      phase: 'end',
    });

    expect(res.status).toBe('unchanged');
  });

  it('handles cancel phase correctly with empty patches envelope', async () => {
    commitProjectHistoryMock.mockResolvedValueOnce({
      status: 'committed',
      operationId: 'cancel-1',
      documentId: 'doc-1',
      revision: 11,
    });

    const res = await finishProjectGesture({
      documentId: 'doc-1',
      sessionId: 1,
      gestureId: 'g-move',
      phase: 'cancel',
    });

    expect(commitProjectHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        gestureId: 'g-move',
        phase: 'cancel',
        patches: [],
      }),
    );
    expect(res.status).toBe('committed');
  });

  it('handles net-zero finalization with unchanged terminal envelope and canonical publication receipt (T033)', async () => {
    commitProjectHistoryMock.mockResolvedValueOnce({
      status: 'unchanged',
      operationId: 'end-netzero',
      documentId: 'doc-1',
      revision: 42,
      stateId: 'state-baseline',
      isDirty: false,
      history: {
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null,
        cursor: 0,
        length: 0,
        retainedBytes: 0,
        savedStateId: null,
        stateId: 'state-baseline',
        revision: 42,
        limitBytes: 67108864,
        maxEntries: 200,
        retentionStatus: 'empty',
      },
    });

    const res = await finishProjectGesture({
      documentId: 'doc-1',
      sessionId: 1,
      gestureId: 'g-netzero',
      phase: 'end',
      label: 'Move Score Object',
    });

    expect(res.status).toBe('unchanged');
    expect(toast.error).not.toHaveBeenCalled();
    expect(getProjectDocumentRevision()).toBe(42);
  });
});

describe('editor settlement during project commands (T038)', () => {
  let undoProjectHistoryMock: ReturnType<typeof vi.fn>;
  let commitProjectHistoryMock: ReturnType<typeof vi.fn>;
  let flushPendingPatchesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    undoProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'undo-1',
      documentId: 'doc-1',
      revision: 20,
    }));
    commitProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'commit-1',
      documentId: 'doc-1',
      revision: 21,
    }));
    flushPendingPatchesMock = vi.fn(async () => {});

    window.blueAPI = {
      ...window.blueAPI,
      undoProjectHistory: undoProjectHistoryMock,
      commitProjectHistory: commitProjectHistoryMock,
    } as unknown as typeof window.blueAPI;

    useProjectStore.setState({
      loaded: true,
      documentId: 'doc-1',
      projectInfo: { title: 'Test Project', documentId: 'doc-1' },
      sessionId: 1,
      flushPendingPatches: flushPendingPatchesMock,
    });
  });

  afterEach(() => {
    delete (window as { blueAPI?: unknown }).blueAPI;
    useProjectStore.setState({ loaded: false, documentId: null, projectInfo: null });
  });

  it('settles active editor before executeProjectUndo runs', async () => {
    let settled = false;
    const unregister = registerHistoryEditorSettlement(document, async () => {
      settled = true;
      await flushPendingPatchesMock();
    });

    try {
      expect(settled).toBe(false);
      await executeProjectUndo();
      expect(settled).toBe(true);
      expect(flushPendingPatchesMock).toHaveBeenCalled();
      expect(undoProjectHistoryMock).toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('routes project commands through settlement via executeProjectCommand during a local preview', async () => {
    let committedPreview = false;
    let inputRevoked = false;

    // Simulate an active local preview gesture (e.g. LineCanvas or JMask table)
    const unregister = registerHistoryEditorSettlement(document, async () => {
      inputRevoked = true;
      // Dispatches final values once before awaiting flush
      committedPreview = true;
      await flushPendingPatchesMock();
    });

    try {
      const commandMock = vi.fn(async () => {
        expect(inputRevoked).toBe(true);
        expect(committedPreview).toBe(true);
        return 'command-result';
      });

      const result = await executeProjectCommand(commandMock);
      expect(result).toBe('command-result');
      expect(commandMock).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });

  it('settles active live group before competing project edit, awaiting receipt', async () => {
    let groupFinished = false;

    const unregister = registerHistoryEditorSettlement(document, async () => {
      // Settle active live group
      await finishProjectGesture({
        documentId: 'doc-1',
        sessionId: 1,
        gestureId: 'g-live',
        phase: 'end',
        label: 'Live Marker Drag',
      });
      groupFinished = true;
    });

    try {
      const commandRan = vi.fn();
      await executeProjectCommand(async () => {
        expect(groupFinished).toBe(true);
        expect(commitProjectHistoryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            gestureId: 'g-live',
            phase: 'end',
          }),
        );
        commandRan();
      });
      expect(commandRan).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });

  it('handles delayed receipts and unchanged final values without breaking order', async () => {
    const order: string[] = [];

    commitProjectHistoryMock.mockImplementationOnce(async () => {
      // Simulate delayed receipt with unchanged net-zero value
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('receipt-received');
      return {
        status: 'unchanged',
        operationId: 'net-zero-1',
        documentId: 'doc-1',
        revision: 15,
      };
    });

    const unregister = registerHistoryEditorSettlement(document, async () => {
      order.push('settle-start');
      await finishProjectGesture({
        documentId: 'doc-1',
        sessionId: 1,
        gestureId: 'g-net-zero',
        phase: 'end',
      });
      order.push('settle-end');
    });

    try {
      await executeProjectCommand(async () => {
        order.push('command-exec');
      });

      expect(order).toEqual(['settle-start', 'receipt-received', 'settle-end', 'command-exec']);
    } finally {
      unregister();
    }
  });
});
