import { APPLICATION_IPC_CHANNELS } from './application-ipc';
import {
  registerIpcTransaction,
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';
import { PLAYBACK_RUNTIME_IPC_CHANNELS } from './playback-runtime-ipc';
import { PROJECT_ARTIFACTS_IPC_CHANNELS } from './project-artifacts-ipc';
import { PROJECT_DOCUMENT_IPC_CHANNELS } from './project-document-ipc';
import { PROJECT_LIFECYCLE_IPC_CHANNELS } from './project-lifecycle-ipc';

const PLAYBACK_LISTENERS = new Set<string>([
  'sync-audition-score-object-availability',
  'sync-follow-playback-state',
]);
const APPLICATION_LISTENERS = new Set<string>(['settings:close-response']);

/**
 * The baseline registration sequence frozen before the handler move. Slices
 * intentionally interleave domain owners where the original source did.
 */
export const MAIN_PROCESS_DOMAIN_IPC_ORDER = [
  ...PROJECT_LIFECYCLE_IPC_CHANNELS.slice(0, 14),
  ...PLAYBACK_RUNTIME_IPC_CHANNELS.slice(0, 9),
  PROJECT_LIFECYCLE_IPC_CHANNELS[14],
  ...PROJECT_ARTIFACTS_IPC_CHANNELS.slice(0, 2),
  ...PROJECT_LIFECYCLE_IPC_CHANNELS.slice(15),
  ...PROJECT_ARTIFACTS_IPC_CHANNELS.slice(2),
  ...PLAYBACK_RUNTIME_IPC_CHANNELS.slice(9, 16),
  ...APPLICATION_IPC_CHANNELS,
  ...PROJECT_DOCUMENT_IPC_CHANNELS.slice(18),
  PLAYBACK_RUNTIME_IPC_CHANNELS[16],
  ...PROJECT_DOCUMENT_IPC_CHANNELS.slice(0, 2),
  ...PROJECT_DOCUMENT_IPC_CHANNELS.slice(3, 18),
  ...PLAYBACK_RUNTIME_IPC_CHANNELS.slice(17, 24),
  ...PLAYBACK_RUNTIME_IPC_CHANNELS.slice(24, 27),
  PROJECT_DOCUMENT_IPC_CHANNELS[2],
  ...PLAYBACK_RUNTIME_IPC_CHANNELS.slice(27),
] as const;

export interface MainProcessDomainIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly handlers: ReadonlyMap<string, IpcMainInvokeHandler>;
  readonly listeners: ReadonlyMap<string, IpcMainEventListener>;
}

function isListenerChannel(channel: string): boolean {
  return PLAYBACK_LISTENERS.has(channel) || APPLICATION_LISTENERS.has(channel);
}

/**
 * Registers all five domain-owned channel sets through one transaction while
 * preserving their original process-wide order.
 */
export function registerMainProcessDomainIpc(options: MainProcessDomainIpcOptions): () => void {
  return registerIpcTransaction(options.ipcMain, 'main-process-domains', (scope) => {
    for (const channel of MAIN_PROCESS_DOMAIN_IPC_ORDER) {
      if (isListenerChannel(channel)) {
        const listener = options.listeners.get(channel);
        if (!listener) throw new Error(`Missing collected IPC listener: ${channel}`);
        scope.on(channel, listener);
      } else {
        const handler = options.handlers.get(channel);
        if (!handler) throw new Error(`Missing collected IPC handler: ${channel}`);
        scope.handle(channel, handler);
      }
    }
  });
}
