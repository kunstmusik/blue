import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  PROJECT_HISTORY_COMMIT_CHANNEL,
  PROJECT_HISTORY_UNDO_CHANNEL,
  PROJECT_HISTORY_REDO_CHANNEL,
  PROJECT_HISTORY_READ_CHANNEL,
  PROJECT_HISTORY_ENTRIES_CHANNEL,
  PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL,
  PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL,
  PROJECT_RUNTIME_OUTCOME_CHANNEL,
  type ProjectHistoryCommitRequest,
  type ProjectHistoryUndoRequest,
  type ProjectHistoryRedoRequest,
  type ProjectHistoryReadRequest,
  type RegisterHistoryParticipantRequest,
  type PrepareHistoryBoundaryAck,
  type CancelOversizeProposalRequest,
  type PrepareHistoryBoundaryEvent,
  type ReleaseHistoryBoundaryEvent,
  type ProjectRuntimeOutcomeEvent,
} from '../shared/project-history';

const invokeMock = vi.hoisted(() => vi.fn());
const onMock = vi.hoisted(() => vi.fn());
const removeListenerMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock,
  },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

type PreloadBridge = {
  commitProjectHistory: (request: ProjectHistoryCommitRequest) => Promise<unknown>;
  undoProjectHistory: (request: ProjectHistoryUndoRequest) => Promise<unknown>;
  redoProjectHistory: (request: ProjectHistoryRedoRequest) => Promise<unknown>;
  readProjectHistory: (request?: ProjectHistoryReadRequest) => Promise<unknown>;
  readProjectHistoryEntries: (request?: ProjectHistoryReadRequest) => Promise<unknown>;
  registerHistoryParticipant: (request: RegisterHistoryParticipantRequest) => Promise<unknown>;
  unregisterHistoryParticipant: (request: { contextId: string }) => Promise<void>;
  acknowledgeHistoryBoundary: (ack: PrepareHistoryBoundaryAck) => Promise<void>;
  cancelOversizeProposal: (request: CancelOversizeProposalRequest) => Promise<void>;
  onPrepareHistoryBoundary: (callback: (event: PrepareHistoryBoundaryEvent) => void) => () => void;
  onReleaseHistoryBoundary: (callback: (event: ReleaseHistoryBoundaryEvent) => void) => () => void;
  onProjectRuntimeOutcome: (callback: (event: ProjectRuntimeOutcomeEvent) => void) => () => void;
};

async function loadBridge(): Promise<PreloadBridge> {
  vi.resetModules();
  await import('./preload');
  const { contextBridge } = await import('electron');
  const calls = (
    contextBridge as unknown as {
      exposeInMainWorld: ReturnType<typeof vi.fn>;
    }
  ).exposeInMainWorld.mock.calls;
  const bridge = calls.find(([name]) => name === 'blueAPI')?.[1] as PreloadBridge;
  if (!bridge) throw new Error('blueAPI bridge was not exposed');
  return bridge;
}

describe('Project history preload bridge (T013)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    onMock.mockReset();
    removeListenerMock.mockReset();
  });

  it('invokes project-history:commit with typed payload', async () => {
    const bridge = await loadBridge();
    const request: ProjectHistoryCommitRequest = {
      documentId: 'doc-1',
      operationId: 'op-1',
      expectedRevision: 1,
      contextSequence: 1,
      label: 'Change parameter',
    };
    const response = { status: 'committed', operationId: 'op-1', revision: 2 };
    invokeMock.mockResolvedValueOnce(response);

    const result = await bridge.commitProjectHistory(request);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_COMMIT_CHANNEL, request);
    expect(result).toEqual(response);
  });

  it('invokes project-history:undo with typed payload', async () => {
    const bridge = await loadBridge();
    const request: ProjectHistoryUndoRequest = {
      documentId: 'doc-1',
      operationId: 'op-undo',
      expectedRevision: 2,
      contextSequence: 2,
    };
    const response = { status: 'committed', operationId: 'op-undo', revision: 3 };
    invokeMock.mockResolvedValueOnce(response);

    const result = await bridge.undoProjectHistory(request);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_UNDO_CHANNEL, request);
    expect(result).toEqual(response);
  });

  it('invokes project-history:redo with typed payload', async () => {
    const bridge = await loadBridge();
    const request: ProjectHistoryRedoRequest = {
      documentId: 'doc-1',
      operationId: 'op-redo',
      expectedRevision: 3,
      contextSequence: 3,
    };
    const response = { status: 'committed', operationId: 'op-redo', revision: 4 };
    invokeMock.mockResolvedValueOnce(response);

    const result = await bridge.redoProjectHistory(request);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_REDO_CHANNEL, request);
    expect(result).toEqual(response);
  });

  it('invokes project-history:read with optional document request', async () => {
    const bridge = await loadBridge();
    const request: ProjectHistoryReadRequest = { documentId: 'doc-1' };
    const projection = { canUndo: true, canRedo: false, cursor: 1 };
    invokeMock.mockResolvedValueOnce(projection);

    const result = await bridge.readProjectHistory(request);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_READ_CHANNEL, request);
    expect(result).toEqual(projection);
  });

  it('invokes project-history:entries with typed summary snapshot response', async () => {
    const bridge = await loadBridge();
    const request: ProjectHistoryReadRequest = { documentId: 'doc-1' };
    const snapshot = {
      documentId: 'doc-1',
      revision: 2,
      cursor: 1,
      entries: [{ entryId: 'entry-1', label: 'Edit 1', timestamp: 1, afterStateId: 'state-1' }],
    };
    invokeMock.mockResolvedValueOnce(snapshot);

    const result = await bridge.readProjectHistoryEntries(request);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_ENTRIES_CHANNEL, request);
    expect(result).toEqual(snapshot);
  });

  it('invokes participant registration and unregistration channels', async () => {
    const bridge = await loadBridge();
    const regRequest: RegisterHistoryParticipantRequest = {
      contextId: 'ctx-1',
      documentId: 'doc-1',
      acceptedRevision: 1,
    };
    invokeMock.mockResolvedValueOnce({ ok: true });

    const regResult = await bridge.registerHistoryParticipant(regRequest);
    expect(invokeMock).toHaveBeenCalledWith(
      PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL,
      regRequest,
    );
    expect(regResult).toEqual({ ok: true });

    invokeMock.mockResolvedValueOnce(undefined);
    await bridge.unregisterHistoryParticipant({ contextId: 'ctx-1' });
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL, {
      contextId: 'ctx-1',
    });
  });

  it('invokes boundary ack and cancel oversize proposal channels', async () => {
    const bridge = await loadBridge();
    const ack: PrepareHistoryBoundaryAck = {
      barrierId: 'barrier-1',
      contextId: 'ctx-1',
      lastAcknowledgedRevision: 2,
      lastAcknowledgedSequence: 1,
      outstandingPrefixCount: 0,
    };
    invokeMock.mockResolvedValueOnce(undefined);
    await bridge.acknowledgeHistoryBoundary(ack);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL, ack);

    const cancelReq: CancelOversizeProposalRequest = {
      proposalToken: 'oversize-token-123',
    };
    invokeMock.mockResolvedValueOnce(undefined);
    await bridge.cancelOversizeProposal(cancelReq);
    expect(invokeMock).toHaveBeenCalledWith(PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL, cancelReq);
  });

  it('wires onPrepareHistoryBoundary and unregisters on disposal', async () => {
    const bridge = await loadBridge();
    const callback = vi.fn();
    const unsubscribe = bridge.onPrepareHistoryBoundary(callback);

    expect(onMock).toHaveBeenCalledWith(
      PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL,
      expect.any(Function),
    );

    const handler = onMock.mock.calls.find(
      ([channel]) => channel === PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL,
    )?.[1];
    expect(handler).toBeDefined();

    // Valid event triggers callback
    const validEvent: PrepareHistoryBoundaryEvent = { barrierId: 'b-1', reason: 'undo' };
    handler?.({}, validEvent);
    expect(callback).toHaveBeenCalledWith(validEvent);

    // Invalid event ignored
    callback.mockClear();
    handler?.({}, { barrierId: 123 });
    expect(callback).not.toHaveBeenCalled();

    // Unsubscribe removes listener
    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith(
      PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL,
      handler,
    );
  });

  it('wires onReleaseHistoryBoundary and unregisters on disposal', async () => {
    const bridge = await loadBridge();
    const callback = vi.fn();
    const unsubscribe = bridge.onReleaseHistoryBoundary(callback);

    expect(onMock).toHaveBeenCalledWith(
      PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL,
      expect.any(Function),
    );

    const handler = onMock.mock.calls.find(
      ([channel]) => channel === PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL,
    )?.[1];

    const validEvent: ReleaseHistoryBoundaryEvent = { barrierId: 'b-1', status: 'ready' };
    handler?.({}, validEvent);
    expect(callback).toHaveBeenCalledWith(validEvent);

    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith(
      PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL,
      handler,
    );
  });

  it('wires onProjectRuntimeOutcome and unregisters on disposal', async () => {
    const bridge = await loadBridge();
    const callback = vi.fn();
    const unsubscribe = bridge.onProjectRuntimeOutcome(callback);

    expect(onMock).toHaveBeenCalledWith(PROJECT_RUNTIME_OUTCOME_CHANNEL, expect.any(Function));

    const handler = onMock.mock.calls.find(
      ([channel]) => channel === PROJECT_RUNTIME_OUTCOME_CHANNEL,
    )?.[1];

    const validEvent: ProjectRuntimeOutcomeEvent = {
      documentId: 'doc-1',
      revision: 2,
      outcomes: [
        {
          performanceKind: 'timeline',
          generation: 1,
          desiredRevision: 2,
          status: 'applied',
        },
      ],
    };
    handler?.({}, validEvent);
    expect(callback).toHaveBeenCalledWith(validEvent);

    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith(PROJECT_RUNTIME_OUTCOME_CHANNEL, handler);
  });
});
