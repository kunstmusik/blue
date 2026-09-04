import {
  registerIpcTransaction,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

export const PROJECT_LIFECYCLE_IPC_CHANNELS = [
  'open-file',
  'start-midi-import',
  'cancel-midi-import',
  'commit-midi-import',
  'open-file-path',
  'new-file',
  'missing-audio-assets:choose-replacement',
  'missing-audio-assets:resolve',
  'missing-audio-assets:dismiss',
  'open-bsb-file-selector',
  'set-bsb-file-selector-path',
  'copy-bsb-file-selector-to-media-folder',
  'save-file',
  'save-file-as',
  'get-project-info',
  'set-recent-files',
  'get-recent-files',
] as const;

export type ProjectLifecycleIpcChannel = (typeof PROJECT_LIFECYCLE_IPC_CHANNELS)[number];

export interface ProjectLifecycleIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<Record<ProjectLifecycleIpcChannel, IpcMainInvokeHandler>>;
}

/** Registers the project/file-session surface in its source-relative order. */
export function registerProjectLifecycleIpc(options: ProjectLifecycleIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'project-lifecycle', (scope) => {
    for (const channel of PROJECT_LIFECYCLE_IPC_CHANNELS) {
      scope.handle(channel, options.handlers[channel]);
    }
  });
}
