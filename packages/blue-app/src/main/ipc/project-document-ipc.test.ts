import { describe, expect, it, vi } from 'vitest';
import { PROJECT_DOCUMENT_IPC_CHANNELS, registerProjectDocumentIpc } from './project-document-ipc';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

describe('project document IPC registrar', () => {
  it('registers and disposes the exact channel invoke sequence', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const dispose = registerProjectDocumentIpc({
      ipcMain,
      handlers: createHandlerRecord(PROJECT_DOCUMENT_IPC_CHANNELS),
    });
    expect(ipcMain.registrations).toEqual(
      PROJECT_DOCUMENT_IPC_CHANNELS.map((channel) => `handle:${channel}`),
    );
    expectIdempotentReverseDisposal(ipcMain, dispose);
  });

  it('preserves receipts, stale/unavailable results, broadcasts, authorization, and tool payloads', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_DOCUMENT_IPC_CHANNELS);
    handlers['commit-project-document-patches'] = vi.fn(async (_event, patches) => ({
      changed: true,
      revision: 4,
      sessionId: 9,
      patches,
      broadcast: 'project-document-updated',
    }));
    handlers['update-track-instrument-editor-document'] = vi.fn(() => ({
      status: 'stale',
      snapshot: null,
    }));
    handlers['read-authorized-audio-file-bytes'] = vi.fn((_event, filePath) => ({
      filePath,
      bytes: new Uint8Array([1, 2]),
    }));
    handlers['test-score-object'] = vi.fn((_event, request) => ({ ok: true, request }));
    handlers['get-effect-editor-document'] = vi.fn(() => null);
    handlers['project-history:commit'] = vi.fn(async (_event, request) => ({
      status: 'committed',
      operationId: request.operationId,
    }));
    handlers['project-history:undo'] = vi.fn(async (_event, request) => ({
      status: 'committed',
      operationId: request.operationId,
    }));
    handlers['project-history:redo'] = vi.fn(async (_event, request) => ({
      status: 'committed',
      operationId: request.operationId,
    }));
    handlers['project-history:read'] = vi.fn(() => ({
      canUndo: true,
      canRedo: false,
      cursor: 1,
    }));
    registerProjectDocumentIpc({ ipcMain, handlers });

    await expect(
      ipcMain.handlers.get('commit-project-document-patches')?.({}, [{ globalOrc: 'instr 1' }]),
    ).resolves.toMatchObject({ changed: true, revision: 4, sessionId: 9 });
    expect(ipcMain.handlers.get('update-track-instrument-editor-document')?.({}, {})).toEqual({
      status: 'stale',
      snapshot: null,
    });
    expect(
      ipcMain.handlers.get('read-authorized-audio-file-bytes')?.({}, 'C:\\audio\\tone.wav'),
    ).toEqual({ filePath: 'C:\\audio\\tone.wav', bytes: new Uint8Array([1, 2]) });
    expect(ipcMain.handlers.get('test-score-object')?.({}, { selectionId: 'score-1' })).toEqual({
      ok: true,
      request: { selectionId: 'score-1' },
    });
    expect(ipcMain.handlers.get('get-effect-editor-document')?.({}, {})).toBeNull();
    await expect(
      ipcMain.handlers.get('project-history:commit')?.({}, { operationId: 'op-1' }),
    ).resolves.toEqual({ status: 'committed', operationId: 'op-1' });
    await expect(
      ipcMain.handlers.get('project-history:undo')?.({}, { operationId: 'op-2' }),
    ).resolves.toEqual({ status: 'committed', operationId: 'op-2' });
    await expect(
      ipcMain.handlers.get('project-history:redo')?.({}, { operationId: 'op-3' }),
    ).resolves.toEqual({ status: 'committed', operationId: 'op-3' });
    expect(ipcMain.handlers.get('project-history:read')?.({}, {})).toEqual({
      canUndo: true,
      canRedo: false,
      cursor: 1,
    });
  });

  it('preserves validation errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_DOCUMENT_IPC_CHANNELS);
    handlers['commit-project-document-patches'] = vi.fn(() => {
      throw new Error('stale session');
    });
    registerProjectDocumentIpc({ ipcMain, handlers });
    expect(() => ipcMain.handlers.get('commit-project-document-patches')?.({}, [])).toThrow(
      'stale session',
    );
  });

  it('passes each typed ProjectHistoryResponse status through the bridge unchanged', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_DOCUMENT_IPC_CHANNELS);

    const committedResponse = {
      status: 'committed',
      operationId: 'op-commit',
      documentId: 'doc-1',
      revision: 3,
      stateId: 'state-3',
      isDirty: true,
      history: {
        canUndo: true,
        canRedo: false,
        undoLabel: 'Set Master Level',
        redoLabel: null,
        cursor: 3,
        length: 3,
        retainedBytes: 512,
        savedStateId: 'state-0',
        stateId: 'state-3',
      },
      changedTargets: ['Master'],
    };
    const staleResponse = {
      status: 'stale',
      operationId: 'op-stale',
      documentId: 'doc-1',
      currentRevision: 7,
      currentStateId: 'state-7',
      reason: 'Revision mismatch (expected 3, current 7)',
    };
    const invalidResponse = {
      status: 'invalid',
      operationId: 'op-invalid',
      documentId: 'doc-1',
      reason: 'Unexpected patch key(s): unknownMember',
    };
    const unchangedResponse = {
      status: 'unchanged',
      operationId: 'op-unchanged',
      documentId: 'doc-1',
      revision: 7,
      stateId: 'state-7',
      isDirty: false,
      history: {
        canUndo: true,
        canRedo: true,
        undoLabel: 'Edit',
        redoLabel: 'Later Edit',
        cursor: 6,
        length: 7,
        retainedBytes: 128,
        savedStateId: 'state-7',
        stateId: 'state-7',
      },
    };

    const responses = [committedResponse, staleResponse, invalidResponse, unchangedResponse];
    handlers['project-history:commit'] = vi.fn(async (_event, request) =>
      responses.find((response) => response.operationId === request.operationId),
    );
    registerProjectDocumentIpc({ ipcMain, handlers });

    const commit = ipcMain.handlers.get('project-history:commit')!;
    for (const response of responses) {
      await expect(commit({}, { operationId: response.operationId })).resolves.toEqual(response);
    }
  });
});
