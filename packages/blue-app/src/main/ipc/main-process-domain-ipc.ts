import {
  APPLICATION_IPC_CHANNELS,
  registerApplicationIpc,
  type ApplicationIpcChannel,
  type ApplicationListenerChannel,
} from './application-ipc';
import {
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';
import {
  PLAYBACK_RUNTIME_IPC_CHANNELS,
  registerPlaybackRuntimeIpc,
  type PlaybackRuntimeIpcChannel,
  type PlaybackRuntimeListenerChannel,
} from './playback-runtime-ipc';
import {
  PROJECT_ARTIFACTS_IPC_CHANNELS,
  registerProjectArtifactsIpc,
} from './project-artifacts-ipc';
import { PROJECT_DOCUMENT_IPC_CHANNELS, registerProjectDocumentIpc } from './project-document-ipc';
import {
  PROJECT_LIFECYCLE_IPC_CHANNELS,
  registerProjectLifecycleIpc,
} from './project-lifecycle-ipc';

const PLAYBACK_LISTENERS: readonly PlaybackRuntimeListenerChannel[] = [
  'sync-audition-score-object-availability',
  'sync-follow-playback-state',
];

const APPLICATION_LISTENERS: readonly ApplicationListenerChannel[] = ['settings:close-response'];

const PLAYBACK_HANDLERS = PLAYBACK_RUNTIME_IPC_CHANNELS.filter(
  (c): c is Exclude<PlaybackRuntimeIpcChannel, PlaybackRuntimeListenerChannel> =>
    !PLAYBACK_LISTENERS.includes(c as never),
);

const APPLICATION_HANDLERS = APPLICATION_IPC_CHANNELS.filter(
  (c): c is Exclude<ApplicationIpcChannel, ApplicationListenerChannel> =>
    !APPLICATION_LISTENERS.includes(c as never),
);

export interface MainProcessDomainIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: ReadonlyMap<string, IpcMainInvokeHandler>;
  readonly listeners: ReadonlyMap<string, IpcMainEventListener>;
}

function extractHandlers<T extends string>(
  channels: readonly T[],
  handlers: ReadonlyMap<string, IpcMainInvokeHandler>,
): Record<T, IpcMainInvokeHandler> {
  const result: Partial<Record<T, IpcMainInvokeHandler>> = {};
  for (const channel of channels) {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing collected IPC handler: ${channel}`);
    result[channel] = handler;
  }
  return result as Record<T, IpcMainInvokeHandler>;
}

function extractListeners<T extends string>(
  channels: readonly T[],
  listeners: ReadonlyMap<string, IpcMainEventListener>,
): Record<T, IpcMainEventListener> {
  const result: Partial<Record<T, IpcMainEventListener>> = {};
  for (const channel of channels) {
    const listener = listeners.get(channel);
    if (!listener) throw new Error(`Missing collected IPC listener: ${channel}`);
    result[channel] = listener;
  }
  return result as Record<T, IpcMainEventListener>;
}

/**
 * Registers all domain-owned channel sets directly by delegating to each domain's
 * transaction registrar while maintaining full process rollback on failure.
 */
export function registerMainProcessDomainIpc(options: MainProcessDomainIpcOptions): () => void {
  const disposers: Array<() => void> = [];
  try {
    disposers.push(
      registerProjectLifecycleIpc({
        ipcMain: options.ipcMain,
        handlers: extractHandlers(PROJECT_LIFECYCLE_IPC_CHANNELS, options.handlers),
      }),
    );

    disposers.push(
      registerPlaybackRuntimeIpc({
        ipcMain: options.ipcMain,
        handlers: extractHandlers(PLAYBACK_HANDLERS, options.handlers),
        listeners: extractListeners(PLAYBACK_LISTENERS, options.listeners),
      }),
    );

    disposers.push(
      registerProjectArtifactsIpc({
        ipcMain: options.ipcMain,
        handlers: extractHandlers(PROJECT_ARTIFACTS_IPC_CHANNELS, options.handlers),
      }),
    );

    disposers.push(
      registerApplicationIpc({
        ipcMain: options.ipcMain,
        handlers: extractHandlers(APPLICATION_HANDLERS, options.handlers),
        listeners: extractListeners(APPLICATION_LISTENERS, options.listeners),
      }),
    );

    disposers.push(
      registerProjectDocumentIpc({
        ipcMain: options.ipcMain,
        handlers: extractHandlers(PROJECT_DOCUMENT_IPC_CHANNELS, options.handlers),
      }),
    );
  } catch (error) {
    for (const dispose of disposers.slice().reverse()) {
      try {
        dispose();
      } catch {
        // Preserve initiating error
      }
    }
    throw error;
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const dispose of disposers.slice().reverse()) {
      dispose();
    }
  };
}
