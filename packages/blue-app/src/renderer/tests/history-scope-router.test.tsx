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

import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';
import { useProjectStore } from '../stores/project-store';

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
