import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_ARTIFACTS_IPC_CHANNELS,
  registerProjectArtifactsIpc,
} from './project-artifacts-ipc';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

describe('project artifacts IPC registrar', () => {
  it('registers and disposes the exact 15-channel invoke sequence', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const dispose = registerProjectArtifactsIpc({
      ipcMain,
      handlers: createHandlerRecord(PROJECT_ARTIFACTS_IPC_CHANNELS),
    });
    expect(ipcMain.registrations).toEqual(
      PROJECT_ARTIFACTS_IPC_CHANNELS.map((channel) => `handle:${channel}`),
    );
    expectIdempotentReverseDisposal(ipcMain, dispose);
  });

  it('preserves cancellation, native paths, owner events, and artifact results', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_ARTIFACTS_IPC_CHANNELS);
    handlers['select-soundfont-file'] = vi.fn(async () => null);
    handlers['inspect-soundfont'] = vi.fn((_event, filePath) => ({ filePath, presets: [] }));
    handlers['read-csoundrc'] = vi.fn((_event, filePath) => ({ filePath, text: '-odac' }));
    handlers['export-score-object'] = vi.fn((_event, request) => ({
      ok: true,
      ownerId: request.ownerId,
    }));
    registerProjectArtifactsIpc({ ipcMain, handlers });

    await expect(
      ipcMain.handlers.get('select-soundfont-file')?.({ sender: 'owner' }),
    ).resolves.toBeNull();
    expect(ipcMain.handlers.get('inspect-soundfont')?.({}, '\\\\server\\share\\bank.sf2')).toEqual({
      filePath: '\\\\server\\share\\bank.sf2',
      presets: [],
    });
    expect(ipcMain.handlers.get('read-csoundrc')?.({}, 'C:\\Blue\\.csoundrc')).toEqual({
      filePath: 'C:\\Blue\\.csoundrc',
      text: '-odac',
    });
    expect(ipcMain.handlers.get('export-score-object')?.({}, { ownerId: 7 })).toEqual({
      ok: true,
      ownerId: 7,
    });
  });

  it('preserves validation errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_ARTIFACTS_IPC_CHANNELS);
    handlers['write-csoundrc'] = vi.fn(() => {
      throw new Error('invalid csoundrc');
    });
    registerProjectArtifactsIpc({ ipcMain, handlers });
    expect(() => ipcMain.handlers.get('write-csoundrc')?.({}, null)).toThrow('invalid csoundrc');
  });
});
