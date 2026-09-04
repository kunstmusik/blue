import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_LIFECYCLE_IPC_CHANNELS,
  registerProjectLifecycleIpc,
} from './project-lifecycle-ipc';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

describe('project lifecycle IPC registrar', () => {
  it('registers the exact 17-channel source-relative invoke sequence', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const dispose = registerProjectLifecycleIpc({
      ipcMain,
      handlers: createHandlerRecord(PROJECT_LIFECYCLE_IPC_CHANNELS),
    });

    expect(ipcMain.registrations).toEqual(
      PROJECT_LIFECYCLE_IPC_CHANNELS.map((channel) => `handle:${channel}`),
    );
    expectIdempotentReverseDisposal(ipcMain, dispose);
  });

  it('preserves representative payloads, native paths, results, broadcasts, and cancellation', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_LIFECYCLE_IPC_CHANNELS);
    handlers['open-file'] = vi.fn(async (_event, request) => ({ ok: true, request }));
    handlers['open-file-path'] = vi.fn((_event, filePath) => filePath);
    handlers['cancel-midi-import'] = vi.fn(() => false);
    handlers['missing-audio-assets:resolve'] = vi.fn((_event, mappings) => ({
      changed: true,
      mappings,
      broadcast: 'project-loaded',
    }));
    handlers['set-recent-files'] = vi.fn((_event, paths) => paths);
    registerProjectLifecycleIpc({ ipcMain, handlers });

    await expect(
      ipcMain.handlers.get('open-file')?.({ sender: 'main' }, { source: 'menu' }),
    ).resolves.toEqual({ ok: true, request: { source: 'menu' } });
    expect(ipcMain.handlers.get('open-file-path')?.({}, 'C:\\Users\\Blue\\work.blue')).toBe(
      'C:\\Users\\Blue\\work.blue',
    );
    expect(ipcMain.handlers.get('cancel-midi-import')?.({})).toBe(false);
    expect(
      ipcMain.handlers.get('missing-audio-assets:resolve')?.({}, [{ from: 'a', to: 'b' }]),
    ).toEqual({ changed: true, mappings: [{ from: 'a', to: 'b' }], broadcast: 'project-loaded' });
    expect(ipcMain.handlers.get('set-recent-files')?.({}, ['/a.blue'])).toEqual(['/a.blue']);
  });

  it('preserves thrown handler errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(PROJECT_LIFECYCLE_IPC_CHANNELS);
    handlers['save-file'] = vi.fn(() => {
      throw new Error('save failed');
    });
    registerProjectLifecycleIpc({ ipcMain, handlers });
    expect(() => ipcMain.handlers.get('save-file')?.({})).toThrow('save failed');
  });
});
