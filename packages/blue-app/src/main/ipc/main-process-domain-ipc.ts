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
 * Domain-owned channel sets registered in domain groups without historical interleaving slices.
 */
export const MAIN_PROCESS_DOMAIN_IPC_ORDER = [
  ...PROJECT_LIFECYCLE_IPC_CHANNELS,
  ...PLAYBACK_RUNTIME_IPC_CHANNELS,
  ...PROJECT_ARTIFACTS_IPC_CHANNELS,
  ...APPLICATION_IPC_CHANNELS,
  ...PROJECT_DOCUMENT_IPC_CHANNELS,
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
