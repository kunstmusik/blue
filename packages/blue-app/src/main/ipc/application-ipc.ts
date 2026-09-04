import {
  registerIpcTransaction,
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

export const APPLICATION_IPC_CHANNELS = [
  'blue:native-confirmation:show',
  'settings:confirm-close',
  'settings:close-response',
  'settings:open',
  'app-metadata:get',
  'about:close',
  'program-settings:get',
  'program-settings:save',
  'engine-runtime:probe',
  'engine-runtime:query-csound-io',
  'program-settings:reset-panel',
  'osc-control:get-snapshot',
  'program-settings:usage-matrix',
  'program-settings:sync-legacy-renderer-settings',
  'program-settings:update-playback-preferences',
  'file-manager:get-roots',
  'file-manager:list-directory',
  'file-manager:validate-directory',
  'commit-audio-file-drop',
  'window-layout:get',
  'window-layout:get-display-work-areas',
  'window-layout:update',
  'window-layout:reset',
] as const;

export type ApplicationIpcChannel = (typeof APPLICATION_IPC_CHANNELS)[number];
export type ApplicationListenerChannel = 'settings:close-response';

export interface ApplicationIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<
    Record<Exclude<ApplicationIpcChannel, ApplicationListenerChannel>, IpcMainInvokeHandler>
  >;
  readonly listeners: Readonly<Record<ApplicationListenerChannel, IpcMainEventListener>>;
}

export function registerApplicationIpc(options: ApplicationIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'application', (scope) => {
    for (const channel of APPLICATION_IPC_CHANNELS) {
      if (channel === 'settings:close-response') {
        scope.on(channel, options.listeners[channel]);
      } else {
        scope.handle(channel, options.handlers[channel]);
      }
    }
  });
}
