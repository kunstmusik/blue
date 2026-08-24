# Contract: IPC Domain Registrar

## Public pattern

Each registrar exposes one narrow composition interface:

```ts
export interface RegisterDomainIpcOptions {
  readonly ipcMain: IpcMainLike;
  // Focused state owners and host operations required by this domain.
}

export function registerDomainIpc(options: RegisterDomainIpcOptions): () => void;
```

The returned function is an idempotent disposer. A registrar may expose a focused test adapter, but it may not create a second lifecycle owner or import `main.ts` globals.

## Shared registration scope

```ts
interface IpcRegistrationScope {
  handle(channel: string, listener: IpcMainInvokeHandler): void;
  on(channel: string, listener: IpcMainEventListener): void;
  dispose(): void;
}

function beginIpcRegistration(
  ipcMain: IpcMainLike,
  registrarKey: string,
): IpcRegistrationScope;
```

The exact adapter type must include only the Electron operations needed by production and fake tests.

## Transactional rules

1. Acquire the `(ipcMain, registrarKey)` lease before registering the first channel.
2. If an active lease exists, throw deterministically before any observable registration.
3. Record each exact handler and listener as it is installed.
4. If registration throws, remove recorded entries in reverse order and release that attempt's lease.
5. `dispose()` removes only entries from its own lease, runs at most once, and releases its lease.
6. A later registration receives a new lease; invoking an old disposer cannot remove it.
7. Listeners are removed by exact function identity with `removeListener`, never `removeAllListeners`.

## Domain dependency rules

- Project reads/writes use `ProjectSession` and explicit lifecycle operations.
- Filesystem, process, Electron dialogs/windows, Java, engine, ZeroMQ, and subprocess behavior stays in main-process operations/adapters.
- Native paths stay native until an explicit existing external-text boundary.
- Shared renderer/preload channel constants and serializable request/response types remain authoritative.
- Registrars do not start global services implicitly. Required service availability is an injected dependency or an explicit unavailable result matching current behavior.

## Compatibility rules

Every moved channel preserves:

- channel string and invoke/listen mode;
- registration position relative to other existing handlers/listeners;
- payload validation and serializable result;
- thrown versus returned error behavior;
- event ordering and exact target windows/webContents;
- async completion timing relevant to callers;
- cancellation, mutual exclusion, and session-fence behavior.

## Startup failure protocol

The failing registrar rolls back its own partial lease. The composition root then unwinds previously completed reversible startup stages in reverse order. It retains the initiating error even if cleanup also fails and then follows the existing top-level reporting/exit path.

## Normal shutdown protocol

Normal shutdown is not defined by registrar registration order. `main.ts` retains the explicit established order and invokes each idempotent disposer/service stop once.

## Verification

- Shared scope tests: duplicate-before-side-effect, partial rollback, reverse removal, idempotent dispose, exact listener identity, stale disposer isolation, and re-registration after teardown.
- Each registrar: exact channel-set assertion plus representative success, validation/error, state mutation, broadcast target, and disposer tests.
- Composition: current global registration order, failed startup rollback, and separate normal-shutdown order.
