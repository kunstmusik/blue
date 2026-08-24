export type IpcMainInvokeHandler = (...args: any[]) => unknown;
export type IpcMainEventListener = (...args: any[]) => void;

export interface IpcMainLike {
  handle(channel: string, listener: IpcMainInvokeHandler): void;
  on(channel: string, listener: IpcMainEventListener): unknown;
  removeHandler(channel: string): void;
  removeListener(channel: string, listener: IpcMainEventListener): unknown;
}

export interface IpcRegistrationScope {
  handle(channel: string, listener: IpcMainInvokeHandler): void;
  on(channel: string, listener: IpcMainEventListener): void;
  dispose(): void;
}

interface RegistrationEntry {
  readonly kind: 'handle' | 'listener';
  readonly channel: string;
  readonly listener?: IpcMainEventListener;
}

interface Lease {
  readonly key: string;
  readonly generation: symbol;
  readonly ipcMain: IpcMainLike;
  readonly entries: RegistrationEntry[];
  disposed: boolean;
}

const leasesByIpc = new WeakMap<IpcMainLike, Map<string, Lease>>();

function getLeaseMap(ipcMain: IpcMainLike): Map<string, Lease> {
  let leases = leasesByIpc.get(ipcMain);
  if (!leases) {
    leases = new Map();
    leasesByIpc.set(ipcMain, leases);
  }
  return leases;
}

function removeEntry(lease: Lease, entry: RegistrationEntry): void {
  if (entry.kind === 'handle') {
    lease.ipcMain.removeHandler(entry.channel);
  } else if (entry.listener) {
    lease.ipcMain.removeListener(entry.channel, entry.listener);
  }
}

function disposeLease(lease: Lease): void {
  if (lease.disposed) return;
  lease.disposed = true;
  let firstError: unknown;
  for (const entry of lease.entries.slice().reverse()) {
    try {
      removeEntry(lease, entry);
    } catch (error) {
      firstError ??= error;
    }
  }
  lease.entries.length = 0;
  const leases = getLeaseMap(lease.ipcMain);
  if (leases.get(lease.key)?.generation === lease.generation) {
    leases.delete(lease.key);
  }
  if (firstError) throw firstError;
}

/**
 * Acquires a registrar lease before the first side effect and owns exact
 * handler/listener teardown for that registrar generation.
 */
export function beginIpcRegistration(
  ipcMain: IpcMainLike,
  registrarKey: string,
): IpcRegistrationScope {
  const leases = getLeaseMap(ipcMain);
  if (leases.has(registrarKey)) {
    throw new Error(`IPC registrar already initialized: ${registrarKey}`);
  }

  const lease: Lease = {
    key: registrarKey,
    generation: Symbol(registrarKey),
    ipcMain,
    entries: [],
    disposed: false,
  };
  leases.set(registrarKey, lease);

  const scope: IpcRegistrationScope = {
    handle(channel, listener) {
      if (lease.disposed) throw new Error(`IPC registrar is disposed: ${registrarKey}`);
      ipcMain.handle(channel, listener);
      lease.entries.push({ kind: 'handle', channel });
    },

    on(channel, listener) {
      if (lease.disposed) throw new Error(`IPC registrar is disposed: ${registrarKey}`);
      ipcMain.on(channel, listener);
      lease.entries.push({ kind: 'listener', channel, listener });
    },

    dispose() {
      try {
        disposeLease(lease);
      } catch (error) {
        // Teardown is once-only even when a host removal operation fails.
        // Surface the first error to explicit callers after all entries were
        // attempted; startup rollback callers may intentionally swallow it.
        throw error;
      }
    },
  };

  // A registrar that fails while acquiring its handlers must remove all work
  // already recorded and release only this generation's lease.
  const transactionalScope = scope as IpcRegistrationScope & { __lease?: Lease };
  transactionalScope.__lease = lease;
  return transactionalScope;
}

/**
 * Runs registration work transactionally. The returned disposer is idempotent;
 * a failed registration rethrows its initiating error after best-effort exact
 * teardown.
 */
export function registerIpcTransaction(
  ipcMain: IpcMainLike,
  registrarKey: string,
  register: (scope: IpcRegistrationScope) => void,
): () => void {
  const scope = beginIpcRegistration(ipcMain, registrarKey);
  try {
    register(scope);
  } catch (error) {
    try {
      scope.dispose();
    } catch {
      // Preserve the initiating registration error.
    }
    throw error;
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    scope.dispose();
  };
}

export function clearIpcRegistrationLeasesForTesting(): void {
  // WeakMap keys are intentionally not enumerable. Tests should dispose the
  // scopes they acquire; this function documents that no global reset exists.
}
