import {
  registerIpcTransaction,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

export const PROJECT_DOCUMENT_IPC_CHANNELS = [
  'get-project-document',
  'commit-project-document-patches',
  'blue-x7-effective-values',
  'update-project-document',
  'read-audio-file-bytes',
  'read-authorized-audio-file-bytes',
  'open-audio-file',
  'authorize-audio-file',
  'get-audio-file-stat',
  'get-score-object-editor-document',
  'select-score-object-audio-file',
  'save-frozen-sound-object-copy',
  'get-named-chain-names',
  'get-named-chain',
  'get-nested-poly-object-snapshot',
  'test-score-object',
  'test-external-sound-object',
  'test-javascript-sound-object',
  'test-python-instrument',
  'open-effect-editor',
  'open-effect-interface',
  'get-effect-editor-document',
  'update-effect-editor-document',
  'focus-effect-editor',
  'open-track-instrument-editor',
  'focus-track-instrument-editor',
  'get-track-instrument-editor-document',
  'update-track-instrument-editor-document',
  'effect-editor:diagnostic-milestone',
  'track-instrument-editor:diagnostic-milestone',
  'track-instrument-editor:runtime-status:get',
  'track-instrument-editor:runtime-status:subscribe',
  'track-instrument-editor:runtime-status:unsubscribe',
] as const;

export type ProjectDocumentIpcChannel = typeof PROJECT_DOCUMENT_IPC_CHANNELS[number];

export interface ProjectDocumentIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<Record<ProjectDocumentIpcChannel, IpcMainInvokeHandler>>;
}

export function registerProjectDocumentIpc(options: ProjectDocumentIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'project-document', (scope) => {
    for (const channel of PROJECT_DOCUMENT_IPC_CHANNELS) {
      scope.handle(channel, options.handlers[channel]);
    }
  });
}
