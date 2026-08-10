import type { IpcMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CODE_REPOSITORY_EXPORT_XML_CHANNEL,
  CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL,
  CODE_REPOSITORY_IMPORT_FILE_CHANNEL,
} from '../../shared/code-repository';
import { registerCodeRepositoryIpc } from './ipc';
import { CodeRepositoryClient } from './repository-client';
import { CodeRepositoryService } from './service';
import { createCodeRepositoryTestDirectory } from './test-helpers';

const { showOpenDialog, showSaveDialog } = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showOpenDialog, showSaveDialog },
}));

function createIpcMain(): {
  ipcMain: IpcMain;
  handlers: Map<string, (...args: unknown[]) => unknown>;
} {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel);
      }),
    } as unknown as IpcMain,
  };
}

describe('Code Repository IPC', () => {
  it('wraps an available snapshot in the result success envelope', async () => {
    const service = new CodeRepositoryService(':memory:', {
      clientFactory: () => CodeRepositoryClient.openForTesting(':memory:'),
    });
    await service.start();
    const { ipcMain, handlers } = createIpcMain();
    const unregister = registerCodeRepositoryIpc({
      ipcMain,
      service,
      getWindows: () => [],
    });

    const result = await handlers.get(CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL)!({});

    expect(result).toMatchObject({
      ok: true,
      value: { contentRevision: 0, initialized: false },
    });
    unregister();
    await service.stop();
  });

  it('returns a typed retryable error before the service is initialized', async () => {
    const service = new CodeRepositoryService(':memory:');
    const { ipcMain, handlers } = createIpcMain();
    const unregister = registerCodeRepositoryIpc({
      ipcMain,
      service,
      getWindows: () => [],
    });

    const result = await handlers.get(CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL)!({});

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'not-initialized',
        message: 'Code Repository is not initialized',
        retryable: true,
      },
    });
    unregister();
  });

  it('keeps import selection and source paths in main and preserves cancellation', async () => {
    const service = new CodeRepositoryService(':memory:', {
      clientFactory: () => CodeRepositoryClient.openForTesting(':memory:'),
    });
    await service.start();
    const importFile = vi.spyOn(service, 'importFile').mockResolvedValue({
      snapshot: service.getSnapshot()!,
      importedNodeCount: 0,
      sourceHash: 'hash',
    });
    const { ipcMain, handlers } = createIpcMain();
    const unregister = registerCodeRepositoryIpc({
      ipcMain,
      service,
      getWindows: () => [],
    });
    const handler = handlers.get(CODE_REPOSITORY_IMPORT_FILE_CHANNEL)!;

    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    await expect(handler({}, { expectedRevision: 0 })).resolves.toBeNull();
    expect(importFile).not.toHaveBeenCalled();

    showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/safe/main-owned/codeRepository.xml'],
    });
    await expect(handler({}, { expectedRevision: 0 })).resolves.toMatchObject({
      ok: true,
    });
    expect(importFile).toHaveBeenCalledWith('/safe/main-owned/codeRepository.xml', 0);

    await expect(handler({}, { expectedRevision: -1 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-tree' },
    });
    unregister();
    await service.stop();
  });

  it('writes an exported XML document only after main owns a selected destination', async () => {
    const directory = createCodeRepositoryTestDirectory();
    try {
      const service = new CodeRepositoryService(':memory:', {
        clientFactory: () => CodeRepositoryClient.openForTesting(':memory:'),
      });
      await service.start();
      const { ipcMain, handlers } = createIpcMain();
      const unregister = registerCodeRepositoryIpc({
        ipcMain,
        service,
        getWindows: () => [],
      });
      const destination = path.join(directory.directory, 'codeRepository.xml');
      showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: destination,
      });

      await expect(handlers.get(CODE_REPOSITORY_EXPORT_XML_CHANNEL)!({})).resolves.toMatchObject({
        ok: true,
        value: { basename: 'codeRepository.xml' },
      });
      expect(fs.readFileSync(destination, 'utf8')).toContain('<customAccelerators>');

      showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: directory.directory,
      });
      await expect(handlers.get(CODE_REPOSITORY_EXPORT_XML_CHANNEL)!({})).resolves.toEqual({
        ok: false,
        error: {
          code: 'export-failed',
          message: 'Unable to write the Code Repository export.',
          retryable: false,
        },
      });

      unregister();
      await service.stop();
    } finally {
      directory.cleanup();
    }
  });
});
