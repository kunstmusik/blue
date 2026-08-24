import {
  registerIpcTransaction,
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

export const PLAYBACK_RUNTIME_IPC_CHANNELS = [
  'toggle-play',
  'restart-playback',
  'stop-playback',
  'audition-score-objects',
  'sync-audition-score-object-availability',
  'sync-follow-playback-state',
  'generate-csd-to-screen',
  'generate-realtime-csd-to-screen',
  'generate-csd-to-disk',
  'blue-live:toggle',
  'blue-live:stop',
  'blue-live:recompile',
  'blue-live:all-notes-off',
  'blue-live:trigger-note',
  'blue-live:trigger-objects',
  'blue-live:get-status',
  'engine:evaluate-code',
  'repl-console:open',
  'repl-console:evaluate',
  'repl-console:reinitialize',
  'repl-console:close',
  'javascript-runtime:reinitialize',
  'java-runtime:reinitialize',
  'java-runtime:reinitialize-jython',
  'send-bsb-realtime-control-update',
  'send-mixer-realtime-level-update',
  'send-effect-realtime-update',
  'render-to-disk',
  'freeze-score-objects',
  'cancel-render-operation',
] as const;

export type PlaybackRuntimeIpcChannel = typeof PLAYBACK_RUNTIME_IPC_CHANNELS[number];
export type PlaybackRuntimeListenerChannel =
  | 'sync-audition-score-object-availability'
  | 'sync-follow-playback-state';

export interface PlaybackRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<Record<Exclude<PlaybackRuntimeIpcChannel, PlaybackRuntimeListenerChannel>, IpcMainInvokeHandler>>;
  readonly listeners: Readonly<Record<PlaybackRuntimeListenerChannel, IpcMainEventListener>>;
}

export function registerPlaybackRuntimeIpc(options: PlaybackRuntimeIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'playback-runtime', (scope) => {
    for (const channel of PLAYBACK_RUNTIME_IPC_CHANNELS) {
      if (channel === 'sync-audition-score-object-availability' || channel === 'sync-follow-playback-state') {
        scope.on(channel, options.listeners[channel]);
      } else {
        scope.handle(channel, options.handlers[channel]);
      }
    }
  });
}
