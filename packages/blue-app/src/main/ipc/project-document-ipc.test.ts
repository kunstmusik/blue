import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_DOCUMENT_IPC_CHANNELS,
  registerProjectDocumentIpc,
} from './project-document-ipc';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

describe('project document IPC registrar', () => {
  it('registers and disposes the exact 32-channel invoke sequence', () => {
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
    handlers['update-track-instrument-editor-document'] = vi.fn(() => ({ status: 'stale', snapshot: null }));
    handlers['read-authorized-audio-file-bytes'] = vi.fn((_event, filePath) => ({
      filePath,
      bytes: new Uint8Array([1, 2]),
    }));
    handlers['test-score-object'] = vi.fn((_event, request) => ({ ok: true, request }));
    handlers['get-effect-editor-document'] = vi.fn(() => null);
    registerProjectDocumentIpc({ ipcMain, handlers });

    await expect(ipcMain.handlers.get('commit-project-document-patches')?.({}, [{ globalOrc: 'instr 1' }]))
      .resolves.toMatchObject({ changed: true, revision: 4, sessionId: 9 });
    expect(ipcMain.handlers.get('update-track-instrument-editor-document')?.({}, {}))
      .toEqual({ status: 'stale', snapshot: null });
    expect(ipcMain.handlers.get('read-authorized-audio-file-bytes')?.({}, 'C:\\audio\\tone.wav'))
      .toEqual({ filePath: 'C:\\audio\\tone.wav', bytes: new Uint8Array([1, 2]) });
    expect(ipcMain.handlers.get('test-score-object')?.({}, { selectionId: 'score-1' }))
      .toEqual({ ok: true, request: { selectionId: 'score-1' } });
    expect(ipcMain.handlers.get('get-effect-editor-document')?.({}, {})).toBeNull();
  });

  it('preserves validation errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_DOCUMENT_IPC_CHANNELS);
    handlers['commit-project-document-patches'] = vi.fn(() => { throw new Error('stale session'); });
    registerProjectDocumentIpc({ ipcMain, handlers });
    expect(() => ipcMain.handlers.get('commit-project-document-patches')?.({}, []))
      .toThrow('stale session');
  });
});
