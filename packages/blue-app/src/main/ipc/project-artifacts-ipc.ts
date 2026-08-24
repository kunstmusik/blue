import {
  registerIpcTransaction,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

export const PROJECT_ARTIFACTS_IPC_CHANNELS = [
  'select-soundfont-file',
  'inspect-soundfont',
  'import-blue-udo',
  'import-arrangement-instrument',
  'import-csound-udo',
  'import-preset-file',
  'blue-x7:import-sysex',
  'import-score-object',
  'read-csoundrc',
  'write-csoundrc',
  'export-blue-udo',
  'export-arrangement-instrument',
  'export-csound-udo',
  'export-preset-file',
  'export-score-object',
] as const;

export type ProjectArtifactsIpcChannel = typeof PROJECT_ARTIFACTS_IPC_CHANNELS[number];

export interface ProjectArtifactsIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<Record<ProjectArtifactsIpcChannel, IpcMainInvokeHandler>>;
}

export function registerProjectArtifactsIpc(options: ProjectArtifactsIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'project-artifacts', (scope) => {
    for (const channel of PROJECT_ARTIFACTS_IPC_CHANNELS) {
      scope.handle(channel, options.handlers[channel]);
    }
  });
}
