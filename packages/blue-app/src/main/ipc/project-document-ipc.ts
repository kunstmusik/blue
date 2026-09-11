import {
  registerIpcTransaction,
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';
import { PROJECT_HISTORY_AVAILABILITY_CHANNEL } from '../../shared/project-history';
import {
  PROJECT_HISTORY_COMMIT_CHANNEL,
  PROJECT_HISTORY_UNDO_CHANNEL,
  PROJECT_HISTORY_REDO_CHANNEL,
  PROJECT_HISTORY_READ_CHANNEL,
  PROJECT_HISTORY_ENTRIES_CHANNEL,
  PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL,
  PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL,
} from '../../shared/project-history';

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
  'track-instrument-editor:runtime-status:get',
  'track-instrument-editor:runtime-status:subscribe',
  'track-instrument-editor:runtime-status:unsubscribe',
  PROJECT_HISTORY_COMMIT_CHANNEL,
  PROJECT_HISTORY_UNDO_CHANNEL,
  PROJECT_HISTORY_REDO_CHANNEL,
  PROJECT_HISTORY_READ_CHANNEL,
  PROJECT_HISTORY_ENTRIES_CHANNEL,
  PROJECT_HISTORY_REGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_UNREGISTER_PARTICIPANT_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL,
  PROJECT_HISTORY_CANCEL_OVERSIZE_CHANNEL,
] as const;

export const PROJECT_DOCUMENT_LISTENER_CHANNELS = [PROJECT_HISTORY_AVAILABILITY_CHANNEL] as const;

export type ProjectDocumentIpcChannel = (typeof PROJECT_DOCUMENT_IPC_CHANNELS)[number];
export type ProjectDocumentListenerChannel = (typeof PROJECT_DOCUMENT_LISTENER_CHANNELS)[number];

export interface ProjectDocumentIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: Readonly<Record<ProjectDocumentIpcChannel, IpcMainInvokeHandler>>;
  readonly listeners?: Readonly<Record<ProjectDocumentListenerChannel, IpcMainEventListener>>;
}

export function registerProjectDocumentIpc(options: ProjectDocumentIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'project-document', (scope) => {
    for (const channel of PROJECT_DOCUMENT_IPC_CHANNELS) {
      scope.handle(channel, options.handlers[channel]);
    }
    for (const channel of PROJECT_DOCUMENT_LISTENER_CHANNELS) {
      const listener = options.listeners?.[channel];
      if (listener) scope.on(channel, listener);
    }
  });
}
