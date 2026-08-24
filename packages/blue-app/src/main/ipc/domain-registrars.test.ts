import { describe, expect, it, vi } from 'vitest';
import { registerApplicationIpc, APPLICATION_IPC_CHANNELS } from './application-ipc';
import { registerPlaybackRuntimeIpc, PLAYBACK_RUNTIME_IPC_CHANNELS } from './playback-runtime-ipc';
import { registerProjectArtifactsIpc, PROJECT_ARTIFACTS_IPC_CHANNELS } from './project-artifacts-ipc';
import { registerProjectDocumentIpc, PROJECT_DOCUMENT_IPC_CHANNELS } from './project-document-ipc';
import { registerProjectLifecycleIpc, PROJECT_LIFECYCLE_IPC_CHANNELS } from './project-lifecycle-ipc';
import type { IpcMainEventListener, IpcMainInvokeHandler, IpcMainLike } from './ipc-registration';

class CaptureIpcMain implements IpcMainLike {
  readonly registrations: Array<{ mode: 'handle' | 'on'; channel: string; listener: IpcMainInvokeHandler | IpcMainEventListener }> = [];
  readonly removals: string[] = [];

  handle(channel: string, listener: IpcMainInvokeHandler): void {
    this.registrations.push({ mode: 'handle', channel, listener });
  }

  on(channel: string, listener: IpcMainEventListener): void {
    this.registrations.push({ mode: 'on', channel, listener });
  }

  removeHandler(channel: string): void {
    this.removals.push(`handle:${channel}`);
  }

  removeListener(channel: string, listener: IpcMainEventListener): void {
    this.removals.push(`listener:${channel}`);
  }
}

function handlersFor(channels: readonly string[]): Record<string, IpcMainInvokeHandler> {
  return Object.fromEntries(channels.map((channel) => [channel, vi.fn()])) as Record<string, IpcMainInvokeHandler>;
}

describe('domain IPC registrars', () => {
  it('registers the project lifecycle and artifact channel sets in order', () => {
    const ipcMain = new CaptureIpcMain();
    const disposeLifecycle = registerProjectLifecycleIpc({ ipcMain, handlers: handlersFor(PROJECT_LIFECYCLE_IPC_CHANNELS) as never });
    disposeLifecycle();
    const lifecycleRemovals = ipcMain.removals.slice().reverse().map((value) => value.replace(/^handle:/, ''));
    expect(lifecycleRemovals).toEqual(PROJECT_LIFECYCLE_IPC_CHANNELS);

    const artifactIpc = new CaptureIpcMain();
    const disposeArtifacts = registerProjectArtifactsIpc({ ipcMain: artifactIpc, handlers: handlersFor(PROJECT_ARTIFACTS_IPC_CHANNELS) as never });
    expect(artifactIpc.registrations.map((entry) => entry.channel)).toEqual(PROJECT_ARTIFACTS_IPC_CHANNELS);
    disposeArtifacts();
  });

  it('registers playback listeners with listener mode and exact order', () => {
    const ipcMain = new CaptureIpcMain();
    const listeners = {
      'sync-audition-score-object-availability': vi.fn(),
      'sync-follow-playback-state': vi.fn(),
    };
    const dispose = registerPlaybackRuntimeIpc({
      ipcMain,
      handlers: handlersFor(PLAYBACK_RUNTIME_IPC_CHANNELS) as never,
      listeners,
    });

    expect(ipcMain.registrations.map((entry) => entry.channel)).toEqual(PLAYBACK_RUNTIME_IPC_CHANNELS);
    expect(ipcMain.registrations.filter((entry) => entry.mode === 'on').map((entry) => entry.channel)).toEqual([
      'sync-audition-score-object-availability',
      'sync-follow-playback-state',
    ]);
    dispose();
  });

  it('registers document and application surfaces with exact disposer ownership', () => {
    const documentIpc = new CaptureIpcMain();
    const disposeDocument = registerProjectDocumentIpc({ ipcMain: documentIpc, handlers: handlersFor(PROJECT_DOCUMENT_IPC_CHANNELS) as never });
    expect(documentIpc.registrations.map((entry) => entry.channel)).toEqual(PROJECT_DOCUMENT_IPC_CHANNELS);
    disposeDocument();

    const applicationIpc = new CaptureIpcMain();
    const disposeApplication = registerApplicationIpc({
      ipcMain: applicationIpc,
      handlers: handlersFor(APPLICATION_IPC_CHANNELS) as never,
      listeners: { 'settings:close-response': vi.fn() },
    });
    expect(applicationIpc.registrations.map((entry) => entry.channel)).toEqual(APPLICATION_IPC_CHANNELS);
    expect(applicationIpc.registrations.find((entry) => entry.channel === 'settings:close-response')?.mode).toBe('on');
    disposeApplication();
    disposeApplication();
    expect(applicationIpc.removals).toHaveLength(APPLICATION_IPC_CHANNELS.length);
  });
});
