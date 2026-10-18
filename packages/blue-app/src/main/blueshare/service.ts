import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import { shell } from 'electron';
import { RememberedSessionStore, STORAGE_FAILURE, CLEANUP_FAILURE } from './remembered-session';
import type {
  AccountIdentity,
  AccountSessionSnapshot,
  AccountState,
  BlueShareError,
  BlueShareResult,
  ResourceKind,
  ResourceKey,
  Category,
  ResourcePage,
  LatestResult,
  ResourceSummary,
  ResourceDetail,
  PublishSourceSeed,
} from '../../shared/blueshare';
import {
  isCategory,
  isSessionResponse,
  isResourcePage,
  isLatestResult,
  isResourceDetail,
  validatePublishRequest,
  validateLoginRequest,
  validateCategoryHierarchy,
} from '../../shared/blueshare';
import {
  BlueShareTransport,
  BlueShareNotDispatchedError,
  DEFAULT_TIMEOUT_MS as REQUEST_BUDGET_MS,
} from './transport';
import type {
  LibraryMutationReceipt,
  LibraryItemKey,
  LibraryPublishSourceSnapshot,
  LibraryResult,
  LibraryType,
} from '../../shared/unified-library';

export interface UnifiedLibraryServiceDelegate {
  capturePublishSource?(request: {
    key: LibraryItemKey;
    expectedRevision: number;
  }): Promise<LibraryResult<LibraryPublishSourceSnapshot>>;
  importStandaloneResource?(
    kind: LibraryType,
    xml: string,
    remoteId: number,
    remoteName: string,
  ): Promise<LibraryResult<LibraryMutationReceipt>>;
}

class LocalDeadline extends Error {}
function remainingBudget(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new LocalDeadline();
  return remaining;
}
async function withinDeadline<T>(work: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new LocalDeadline()), Math.max(0, deadline - Date.now()));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function localTimeout(outcome: 'rejected' | 'unknown' = 'rejected'): BlueShareResult<never> {
  return {
    ok: false,
    error: {
      code: 'timeout',
      outcome,
      message:
        outcome === 'unknown'
          ? 'Library import timed out and may still finish. Check the library before another import.'
          : 'BlueShare request timed out before a write was sent. Try again.',
    },
  };
}

function projectCategory(cat: Category): Category {
  return {
    id: cat.id,
    kind: cat.kind,
    parentId: cat.parentId,
    name: cat.name,
    description: cat.description,
  };
}

function projectSummary(item: ResourceSummary): ResourceSummary {
  return {
    kind: item.kind,
    id: item.id,
    name: item.name,
    description: item.description,
    blueType: item.blueType,
    createdAt: item.createdAt,
    category: {
      id: item.category.id,
      name: item.category.name,
    },
    author: {
      id: item.author.id,
      name: item.author.name,
      username: item.author.username,
    },
  };
}

function projectResourceDetail(detail: ResourceDetail): ResourceDetail {
  return {
    ...projectSummary(detail),
    xml: detail.xml,
  };
}

export interface MinimalWebContents {
  readonly id: number;
  readonly isDestroyed: () => boolean;
  readonly once?: (event: 'destroyed', listener: () => void) => void;
}

export interface PublishSourceSnapshot {
  readonly token: string;
  readonly contextId: string;
  readonly accountEpoch: number;
  readonly generation: number;
  readonly itemKey: LibraryItemKey;
  readonly expectedRevision: number;
  readonly name: string;
  readonly blueType: string | null;
  readonly descriptionSeed: string;
  readonly xml: string;
}

export type OperationState = 'pending' | 'success' | 'failure' | 'cancelled' | 'uncertain';

export interface OperationContext {
  readonly operationId: string;
  readonly contextId: string;
  readonly operationType: 'import' | 'publish' | 'remove';
  readonly abortController: AbortController;
  readonly accountEpoch: number;
  state: OperationState;
}

export interface DialogContext {
  readonly contextId: string;
  readonly senderId: number;
  readonly sender: MinimalWebContents;
  readonly createdAt: number;
  publishSource: PublishSourceSnapshot | null;
  publishSourceGeneration: number;
  activeOperation: OperationContext | null;
  protectedWriteGeneration?: number;
  reconciliationTraversal?: { generation: number; kind: ResourceKind; nextBeforeId: number | null };
  uncertainPublishKind?: ResourceKind;
  uncertainPublishToken?: string | null;
  uncertainPublishReconciled?: boolean;
  uncertainRemoveKey?: ResourceKey | null;
  uncertainRemoveReconciled?: boolean;
}

export interface BlueShareServiceOptions {
  readonly transport?: BlueShareTransport;
  readonly rememberedSession?: RememberedSessionStore;
  readonly libraryService?: UnifiedLibraryServiceDelegate;
  readonly externalUrlOpener?: (url: string) => Promise<boolean>;
}

export class BlueShareService {
  private readonly events = new EventEmitter();
  private readonly transport: BlueShareTransport;
  private readonly libraryService?: UnifiedLibraryServiceDelegate;
  private readonly externalUrlOpener?: (url: string) => Promise<boolean>;
  private readonly dialogs = new Map<string, DialogContext>();
  private readonly pendingLibraryImports = new Set<string>();

  // Global account state for the application
  private accountState: AccountState = 'signedOut';
  private currentUser: AccountIdentity | null = null;
  private sessionExpiresAt: string | null = null;
  private accountEpoch = 1;
  private signingInContextId: string | null = null;
  private readonly rememberedSession?: RememberedSessionStore;
  private persistenceWarning: string | undefined;
  private restoreAttempted = false;
  private restoreWork: Promise<void> | null = null;
  private restoreContextId: string | null = null;

  constructor(options: BlueShareServiceOptions = {}) {
    this.transport = options.transport ?? new BlueShareTransport();
    this.rememberedSession = options.rememberedSession;
    this.libraryService = options.libraryService;
    this.externalUrlOpener = options.externalUrlOpener;
  }

  getTransport(): BlueShareTransport {
    return this.transport;
  }

  getAccountEpoch(): number {
    return this.accountEpoch;
  }

  getAccountSnapshot(): AccountSessionSnapshot {
    return {
      state: this.accountState,
      user: this.currentUser,
      expiresAt: this.sessionExpiresAt,
      accountEpoch: this.accountEpoch,
      ...(this.persistenceWarning ? { persistenceWarning: this.persistenceWarning } : {}),
    };
  }

  onAccountChanged(listener: (snapshot: AccountSessionSnapshot) => void): () => void {
    this.events.on('account-changed', listener);
    return () => {
      this.events.off('account-changed', listener);
    };
  }

  private emitAccountChanged(): void {
    if (this.accountState !== 'signedIn')
      for (const dialog of this.dialogs.values()) {
        dialog.publishSourceGeneration++;
        dialog.publishSource = null;
      }
    this.events.emit('account-changed', this.getAccountSnapshot());
  }

  openDialog(
    sender: MinimalWebContents,
  ): BlueShareResult<{ contextId: string; serviceScope: string; account: AccountSessionSnapshot }> {
    if (sender.isDestroyed && sender.isDestroyed()) {
      return {
        ok: false,
        error: {
          code: 'sender_destroyed',
          message: 'Cannot open BlueShare for a destroyed webContents',
          outcome: 'rejected',
        },
      };
    }

    const contextId = randomUUID();
    const dialog: DialogContext = {
      contextId,
      senderId: sender.id,
      sender,
      createdAt: Date.now(),
      publishSource: null,
      publishSourceGeneration: 0,
      activeOperation: null,
      uncertainPublishToken: null,
      uncertainPublishReconciled: false,
      uncertainRemoveKey: null,
      uncertainRemoveReconciled: false,
    };

    if (sender.once) {
      sender.once('destroyed', () => {
        this.closeDialog(contextId);
      });
    }

    this.dialogs.set(contextId, dialog);

    return {
      ok: true,
      value: {
        contextId,
        serviceScope: this.transport.getOrigin(),
        account: this.getAccountSnapshot(),
      },
    };
  }

  closeDialog(contextId: string): void {
    const dialog = this.dialogs.get(contextId);
    if (!dialog) return;

    if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
      dialog.activeOperation.state = 'cancelled';
      dialog.activeOperation.abortController.abort();
    }

    dialog.publishSource = null;
    dialog.activeOperation = null;
    this.dialogs.delete(contextId);

    const closingRestore =
      this.restoreContextId === contextId && this.accountState === 'unavailable';
    if (closingRestore) {
      this.restoreWork = null;
      this.restoreContextId = null;
      this.restoreAttempted = false;
      this.transport.rotateSession();
    }
    // Closing an authentication owner retires its authority before another OPEN.
    if (
      closingRestore ||
      this.signingInContextId === contextId ||
      (this.dialogs.size === 0 &&
        (this.accountState === 'signingIn' || this.accountState === 'signingOut'))
    ) {
      this.accountEpoch++;
      this.accountState = 'signedOut';
      this.currentUser = null;
      this.sessionExpiresAt = null;
      this.signingInContextId = null;
      this.emitAccountChanged();
    }
  }

  shutdown(): void {
    this.rememberedSession?.invalidate();
    this.restoreAttempted = true;
    this.accountEpoch++;
    this.accountState = 'signedOut';
    this.currentUser = null;
    this.sessionExpiresAt = null;
    this.signingInContextId = null;
    for (const dialog of this.dialogs.values()) {
      if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
        dialog.activeOperation.state = 'cancelled';
        dialog.activeOperation.abortController.abort();
      }
      dialog.publishSource = null;
      dialog.activeOperation = null;
    }
    this.dialogs.clear();
    this.transport.shutdown();
    this.emitAccountChanged();
  }

  validateDialog(contextId: string, senderId?: number): DialogContext | BlueShareError {
    const dialog = this.dialogs.get(contextId);
    if (!dialog) {
      return {
        code: 'invalid_context',
        message: 'BlueShare dialog context not found or already closed',
        outcome: 'rejected',
      };
    }

    if (senderId !== undefined && dialog.senderId !== senderId) {
      return {
        code: 'forbidden_sender',
        message: 'Request sender does not match dialog owner',
        outcome: 'rejected',
      };
    }

    if (dialog.sender.isDestroyed && dialog.sender.isDestroyed()) {
      this.closeDialog(contextId);
      return {
        code: 'sender_destroyed',
        message: 'Dialog sender webContents was destroyed',
        outcome: 'rejected',
      };
    }

    return dialog;
  }

  acquireOperationSlot(
    contextId: string,
    operationType: 'import' | 'publish' | 'remove',
    senderId?: number,
  ): OperationContext | BlueShareError {
    const dialogOrError = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrError) return dialogOrError;

    if (dialogOrError.activeOperation && dialogOrError.activeOperation.state === 'pending') {
      return {
        code: 'busy',
        message: `Another ${dialogOrError.activeOperation.operationType} operation is already in progress`,
        outcome: 'rejected',
      };
    }

    const op: OperationContext = {
      operationId: randomUUID(),
      contextId,
      operationType,
      abortController: new AbortController(),
      accountEpoch: this.accountEpoch,
      state: 'pending',
    };

    dialogOrError.activeOperation = op;
    return op;
  }

  releaseOperationSlot(contextId: string, operationId?: string): void {
    const dialog = this.dialogs.get(contextId);
    if (!dialog || !dialog.activeOperation) return;

    if (!operationId || dialog.activeOperation.operationId === operationId) {
      dialog.activeOperation = null;
    }
  }

  setAccountState(
    state: AccountState,
    user: AccountIdentity | null,
    expiresAt: string | null = null,
  ): void {
    this.accountEpoch++;
    this.accountState = state;
    this.currentUser = user;
    this.sessionExpiresAt = expiresAt;

    // Fencing: abort any protected operations tied to old epoch
    for (const dialog of this.dialogs.values()) {
      dialog.publishSource = null;
      if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
        if (dialog.activeOperation.operationType !== 'import') {
          dialog.activeOperation.state = 'cancelled';
          dialog.activeOperation.abortController.abort();
          dialog.activeOperation = null;
        }
      }
    }

    this.emitAccountChanged();
  }

  async getCategories(
    contextId: string,
    _requestId: string,
    kind: ResourceKind,
    senderId?: number,
  ): Promise<BlueShareResult<readonly Category[]>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const response = await this.transport.sendRequest({
      routePath: `/${kind}/categories`,
      method: 'GET',
    });

    const parsed = this.transport.parseResponse<{ items: unknown[] }>(response, undefined, 200);
    if (!parsed.ok) return parsed;

    if (!Array.isArray(parsed.value?.items)) {
      return {
        ok: false,
        error: {
          code: 'invalid_categories_payload',
          message: 'Expected items array in categories response',
          outcome: 'rejected',
        },
      };
    }

    const categories: Category[] = [];
    for (const item of parsed.value.items) {
      if (!isCategory(item, kind)) {
        return {
          ok: false,
          error: {
            code: 'invalid_category_item',
            message: 'Server returned a malformed category item',
            outcome: 'rejected',
          },
        };
      }
      categories.push(projectCategory(item));
    }

    const validation = validateCategoryHierarchy(categories, kind);
    if (!validation.ok) {
      return {
        ok: false,
        error: {
          code: validation.error.code,
          message: validation.error.message,
          outcome: 'rejected',
        },
      };
    }

    return { ok: true, value: validation.flattened.map(({ level: _, ...c }) => c) };
  }

  async listResources(
    contextId: string,
    _requestId: string,
    kind: ResourceKind,
    categoryId: number | null = null,
    beforeId: number | null = null,
    senderId?: number,
  ): Promise<BlueShareResult<ResourcePage>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const queryParams: Record<string, string | number> = { limit: 25 };
    if (categoryId !== null) queryParams.categoryId = categoryId;
    if (beforeId !== null) queryParams.beforeId = beforeId;

    const response = await this.transport.sendRequest({
      routePath: `/${kind}/resources`,
      method: 'GET',
      queryParams,
    });

    const parsed = this.transport.parseResponse<ResourcePage>(
      response,
      (data): data is ResourcePage => isResourcePage(data, kind, categoryId, beforeId),
      200,
    );
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      value: {
        items: parsed.value.items.map(projectSummary),
        nextBeforeId: parsed.value.nextBeforeId,
      },
    };
  }

  async getLatest(
    contextId: string,
    _requestId: string,
    kind: ResourceKind,
    senderId?: number,
  ): Promise<BlueShareResult<LatestResult>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const response = await this.transport.sendRequest({
      routePath: `/${kind}/latest`,
      method: 'GET',
    });

    const parsed = this.transport.parseResponse<LatestResult>(
      response,
      (data): data is LatestResult => isLatestResult(data, kind),
      200,
    );
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      value: {
        items: parsed.value.items.map(projectSummary),
      },
    };
  }

  async getResource(
    contextId: string,
    _requestId: string,
    key: ResourceKey,
    senderId?: number,
  ): Promise<BlueShareResult<ResourceSummary>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const detailRes = await this.fetchResourceDetail(key);
    if (!detailRes.ok) return detailRes;

    const { xml: _xml, ...displayDto } = detailRes.value;
    return { ok: true, value: projectSummary(displayDto as ResourceSummary) };
  }

  async fetchResourceDetail(
    key: ResourceKey,
    timeoutMs = REQUEST_BUDGET_MS,
  ): Promise<BlueShareResult<ResourceDetail>> {
    const response = await this.transport.sendRequest({
      routePath: `/${key.kind}/resources/${key.id}`,
      method: 'GET',
      timeoutMs,
    });

    const parsed = this.transport.parseResponse<ResourceDetail>(
      response,
      (data): data is ResourceDetail => isResourceDetail(data, key.kind, key.id),
      200,
    );
    if (!parsed.ok) return parsed;
    if (parsed.value.id !== key.id || parsed.value.kind !== key.kind) {
      return {
        ok: false,
        error: {
          code: 'mismatched_resource_detail',
          message: `Server returned resource ${parsed.value.kind}:${parsed.value.id} for requested ${key.kind}:${key.id}`,
          outcome: 'rejected',
        },
      };
    }
    return {
      ok: true,
      value: projectResourceDetail(parsed.value),
    };
  }

  async importResource(
    contextId: string,
    requestId: string,
    key: ResourceKey,
    senderId?: number,
  ): Promise<BlueShareResult<LibraryMutationReceipt>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const dialog = dialogOrErr;
    const importIdentity = `${key.kind}:${key.id}`;
    if (dialog.activeOperation !== null || this.pendingLibraryImports.has(importIdentity)) {
      return {
        ok: false,
        error: {
          code: 'busy',
          message: 'Another operation is already in progress for this dialog.',
          outcome: 'rejected',
        },
      };
    }

    const operation: OperationContext = {
      operationId: requestId,
      contextId,
      operationType: 'import',
      abortController: new AbortController(),
      accountEpoch: this.accountEpoch,
      state: 'pending',
    };
    dialog.activeOperation = operation;

    const deadline = Date.now() + REQUEST_BUDGET_MS;
    let localCommitPending = false;
    let localDeadlineExpired = false;
    try {
      const detailRes = await withinDeadline(this.fetchResourceDetail(key), deadline);
      if (!detailRes.ok) {
        operation.state = 'failure';
        return detailRes;
      }

      // Recheck fences after async fetch
      if (
        dialog.activeOperation !== operation ||
        operation.state === 'cancelled' ||
        !this.dialogs.has(contextId)
      ) {
        return {
          ok: false,
          error: {
            code: 'cancelled',
            message: 'Operation was cancelled or dialog was closed.',
            outcome: 'rejected',
          },
        };
      }

      if (
        !this.libraryService ||
        typeof this.libraryService.importStandaloneResource !== 'function'
      ) {
        operation.state = 'failure';
        return {
          ok: false,
          error: {
            code: 'service_unavailable',
            message: 'Library service is not available for import.',
            outcome: 'rejected',
          },
        };
      }

      if (this.pendingLibraryImports.has(importIdentity))
        return {
          ok: false,
          error: {
            code: 'busy',
            message:
              'This resource is still being imported. Check the library before another import.',
            outcome: 'rejected',
          },
        };
      localCommitPending = true;
      this.pendingLibraryImports.add(importIdentity);
      const committing = Promise.resolve()
        .then(() =>
          this.libraryService!.importStandaloneResource!(
            key.kind,
            detailRes.value.xml,
            key.id,
            detailRes.value.name,
          ),
        )
        .finally(() => {
          this.pendingLibraryImports.delete(importIdentity);
          localCommitPending = false;
          // The timeout cannot roll back SQLite. Hold admission until the delegate settles.
          if (localDeadlineExpired && dialog.activeOperation === operation)
            dialog.activeOperation = null;
        });
      const libraryImportResult = await withinDeadline(committing, deadline);

      if (!libraryImportResult.ok) {
        operation.state = 'failure';
        return {
          ok: false,
          error: {
            code: 'validation_failed',
            message: libraryImportResult.error.message,
            outcome: 'rejected',
            diagnostics: libraryImportResult.error.diagnostics,
          },
        };
      }

      operation.state = 'success';
      return {
        ok: true,
        value: libraryImportResult.value,
      };
    } catch (error) {
      if (error instanceof LocalDeadline) {
        localDeadlineExpired = true;
        if (!localCommitPending) operation.state = 'failure';
        return localTimeout(localCommitPending ? 'unknown' : 'rejected');
      }
      operation.state = 'failure';
      if (error instanceof BlueShareNotDispatchedError) return { ok: false, error: error.failure };
      return {
        ok: false,
        error: {
          code: 'library_error',
          message: 'BlueShare import failed. Check the library before trying again.',
          outcome: 'unknown',
        },
      };
    } finally {
      if (!localCommitPending && dialog.activeOperation === operation) {
        dialog.activeOperation = null;
      }
    }
  }

  // The observer deadline also retires authority. Native/disk completion may still
  // arrive, so existing epoch and serialized-store fences remain necessary.
  private async accountOperation<T>(
    mode: 'restore' | 'signIn' | 'signOut',
    work: (deadline: number) => Promise<BlueShareResult<T>>,
    recover?: () => T | undefined,
  ): Promise<BlueShareResult<T>> {
    const deadline = Date.now() + REQUEST_BUDGET_MS;
    const pending = work(deadline);
    const epoch = this.accountEpoch;
    try {
      const result = await withinDeadline(pending, deadline);
      remainingBudget(deadline);
      return result;
    } catch (error) {
      if (!(error instanceof LocalDeadline)) throw error;
      if (this.accountEpoch === epoch) {
        this.accountEpoch++;
        this.rememberedSession?.invalidate();
        this.signingInContextId = null;
        this.currentUser = null;
        this.sessionExpiresAt = null;
        this.restoreAttempted = mode !== 'restore';
        this.accountState = mode === 'restore' ? 'unavailable' : 'signedOut';
        this.persistenceWarning =
          mode === 'restore'
            ? 'Saved sign-in could not be verified. Retry verification or forget the saved sign-in.'
            : CLEANUP_FAILURE;
        const recovered = recover?.();
        if (!this.currentUser) this.transport.rotateSession();
        if (mode === 'signIn') {
          // A timed-out save can finish physically; queue deletion after it.
          void this.clearRememberedProof().then(() => {
            if (this.accountEpoch === epoch + 1) this.emitAccountChanged();
          });
        }
        this.emitAccountChanged();
        if (recovered !== undefined) return { ok: true, value: recovered };
      }
      return {
        ok: false,
        error: {
          code: 'timeout',
          outcome: 'unknown',
          message:
            'Account operation timed out. Saved sign-in cleanup or remote revocation may be unconfirmed.',
        },
      };
    }
  }

  private async clearRememberedProof(): Promise<boolean> {
    const epoch = this.accountEpoch;
    try {
      await this.rememberedSession?.clear();
      return true;
    } catch {
      if (epoch === this.accountEpoch) this.persistenceWarning = CLEANUP_FAILURE;
      return false;
    }
  }

  private async expireAccount(deadline = Date.now() + REQUEST_BUDGET_MS): Promise<void> {
    this.accountEpoch++;
    this.accountState = 'signedOut';
    this.currentUser = null;
    this.sessionExpiresAt = null;
    const epoch = this.accountEpoch;
    const cleanup = this.clearRememberedProof();
    this.transport.rotateSession();
    this.emitAccountChanged();
    try {
      await withinDeadline(cleanup, deadline);
    } catch {
      if (this.accountEpoch === epoch) this.persistenceWarning = CLEANUP_FAILURE;
    }
    if (this.accountEpoch === epoch) this.emitAccountChanged();
  }

  async getAccount(
    contextId: string,
    senderId?: number,
  ): Promise<BlueShareResult<AccountSessionSnapshot>> {
    const dialog = this.validateDialog(contextId, senderId);
    if ('code' in dialog) return { ok: false, error: dialog };
    if (this.restoreWork && this.accountState === 'unavailable') {
      await this.restoreWork;
      return { ok: true, value: this.getAccountSnapshot() };
    }
    if (
      this.rememberedSession &&
      !this.restoreAttempted &&
      (this.accountState === 'signedOut' || this.accountState === 'unavailable')
    ) {
      this.restoreContextId = contextId;
      const work = this.accountOperation('restore', async (deadline) => {
        await this.restoreRememberedSession(contextId, deadline);
        return { ok: true as const, value: undefined };
      }).then(() => {});
      this.restoreWork = work;
      try {
        await work;
      } finally {
        if (this.restoreWork === work) {
          this.restoreWork = null;
          this.restoreContextId = null;
        }
      }
    }
    return { ok: true, value: this.getAccountSnapshot() };
  }

  private async restoreRememberedSession(contextId: string, deadline: number): Promise<void> {
    this.restoreAttempted = true;
    const epoch = ++this.accountEpoch;
    const current = () =>
      this.accountEpoch === epoch && this.dialogs.has(contextId) && Date.now() < deadline;
    this.accountState = 'unavailable';
    this.currentUser = null;
    this.persistenceWarning = undefined;
    this.emitAccountChanged();
    try {
      const record = await this.rememberedSession!.load();
      if (!current()) return;
      if (!record) {
        this.accountState = 'signedOut';
        return;
      }
      this.transport.rotateSession();
      await this.transport.restoreCookies(record.cookies, record.expiresAt, current);
      if (!current()) return;
      const response = await this.transport.sendRequest({
        routePath: '/session',
        method: 'GET',
        timeoutMs: remainingBudget(deadline),
      });
      if (!current()) return;
      const parsed = this.transport.parseResponse<{ user: AccountIdentity; expiresAt: string }>(
        response,
        (v): v is { user: AccountIdentity; expiresAt: string } => isSessionResponse(v, true),
        200,
      );
      if (!parsed.ok) {
        if (response.status === 401) {
          await this.clearRememberedProof();
          if (current()) {
            this.transport.rotateSession();
            this.accountState = 'signedOut';
          }
          return;
        }
        throw new Error('validation unavailable');
      }
      if (
        Math.min(Date.parse(parsed.value.expiresAt), Date.parse(record.expiresAt)) <= Date.now()
      ) {
        await this.clearRememberedProof();
        if (current()) {
          this.transport.rotateSession();
          this.accountState = 'signedOut';
        }
        return;
      }
      this.currentUser = {
        id: parsed.value.user.id,
        name: parsed.value.user.name,
        username: parsed.value.user.username,
      };
      this.sessionExpiresAt = new Date(
        Math.min(Date.parse(parsed.value.expiresAt), Date.parse(record.expiresAt)),
      ).toISOString();
      this.accountState = 'signedIn';
    } catch {
      if (current()) {
        this.accountState = 'unavailable';
        this.persistenceWarning =
          'Saved sign-in could not be verified. Retry verification or sign in again.';
        this.restoreAttempted = false;
        this.transport.rotateSession();
      }
    } finally {
      if (this.accountEpoch === epoch) {
        if (!this.dialogs.has(contextId)) {
          this.accountState = 'signedOut';
          this.restoreAttempted = false;
          this.transport.rotateSession();
        }
        this.emitAccountChanged();
      }
    }
  }

  async signIn(
    contextId: string,
    requestId: string,
    email: string,
    password: string,
    senderId?: number,
    rememberMe = false,
  ): Promise<BlueShareResult<AccountSessionSnapshot>> {
    let verified: { user: AccountIdentity; expiresAt: string } | null = null;
    return this.accountOperation(
      'signIn',
      (deadline) =>
        this.performSignIn(
          contextId,
          requestId,
          email,
          password,
          senderId,
          rememberMe,
          deadline,
          (value) => {
            verified = value;
          },
        ),
      () => {
        if (!verified || Date.parse(verified.expiresAt) <= Date.now()) return undefined;
        this.currentUser = verified.user;
        this.sessionExpiresAt = verified.expiresAt;
        this.accountState = 'signedIn';
        this.persistenceWarning = STORAGE_FAILURE;
        return this.getAccountSnapshot();
      },
    );
  }

  private async performSignIn(
    contextId: string,
    _requestId: string,
    email: string,
    password: string,
    senderId: number | undefined,
    rememberMe: boolean,
    deadline: number,
    onVerified: (value: { user: AccountIdentity; expiresAt: string }) => void,
  ): Promise<BlueShareResult<AccountSessionSnapshot>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    // Validate login request before protected dispatch (T065)
    const validation = validateLoginRequest({ email, password, rememberMe });
    if (!validation.valid) {
      return {
        ok: false,
        error: {
          code: 'validation_error',
          message: 'Login request failed validation',
          outcome: 'rejected',
          fields: validation.errors,
        },
      };
    }

    // Advance epoch at dispatch, fence protected work, and expose signingIn state
    this.accountEpoch++;
    const dispatchEpoch = this.accountEpoch;
    this.restoreAttempted = true;
    this.restoreContextId = null;
    this.restoreWork = null;
    this.persistenceWarning = undefined;
    this.accountState = 'signingIn';
    this.currentUser = null;
    this.sessionExpiresAt = null;
    this.signingInContextId = contextId;

    for (const dialog of this.dialogs.values()) {
      dialog.publishSource = null;
      dialog.uncertainPublishToken = null;
      dialog.uncertainPublishReconciled = false;
      dialog.uncertainRemoveKey = null;
      dialog.uncertainRemoveReconciled = false;
      if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
        if (dialog.activeOperation.operationType !== 'import') {
          dialog.activeOperation.state = 'cancelled';
          dialog.activeOperation.abortController.abort();
          dialog.activeOperation = null;
        }
      }
    }
    this.emitAccountChanged();

    // Every new account attempt gets a fresh nonpersistent context (T025)
    this.transport.rotateSession();
    const cleaned = await this.clearRememberedProof();
    if (this.accountEpoch !== dispatchEpoch || !this.dialogs.has(contextId))
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Sign in was superseded or cancelled',
          outcome: 'rejected',
        },
      };
    if (!cleaned) {
      this.accountState = 'signedOut';
      this.signingInContextId = null;
      this.emitAccountChanged();
      return {
        ok: false,
        error: {
          code: 'local_session_cleanup_failed',
          message: CLEANUP_FAILURE,
          outcome: 'rejected',
        },
      };
    }
    const loginStarted = Date.now();
    let response;
    try {
      response = await this.transport.sendRequest({
        routePath: '/session',
        method: 'POST',
        timeoutMs: remainingBudget(deadline),
        body: {
          email: validation.request.email,
          password: validation.request.password,
          ...(rememberMe ? { rememberMe: true } : {}),
        },
      });
    } catch (err: unknown) {
      if (this.signingInContextId === contextId) {
        this.signingInContextId = null;
      }
      if (this.accountEpoch === dispatchEpoch) {
        this.accountState = 'signedOut';
        this.currentUser = null;
        this.sessionExpiresAt = null;
        this.emitAccountChanged();
      }
      return {
        ok: false,
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'rejected',
        },
      };
    }

    // Fencing: verify dialog is still open and epoch was not superseded during async call
    if (!this.dialogs.has(contextId) || this.accountEpoch !== dispatchEpoch) {
      if (this.signingInContextId === contextId) {
        this.signingInContextId = null;
      }
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Sign in was superseded or cancelled',
          outcome: 'rejected',
        },
      };
    }

    const parsed = this.transport.parseResponse<{
      user: { id: string; name: string; username: string };
      expiresAt?: string;
    }>(response, isSessionResponse, 200);

    if (!parsed.ok) {
      if (this.signingInContextId === contextId) {
        this.signingInContextId = null;
      }
      if (this.accountEpoch === dispatchEpoch) {
        this.accountState = 'signedOut';
        this.currentUser = null;
        this.sessionExpiresAt = null;
        this.emitAccountChanged();
      }
      if (rememberMe && response.status === 400)
        return {
          ok: false,
          error: {
            ...parsed.error,
            message:
              'The service rejected remembered sign-in. Update the service or uncheck Stay signed in and try again.',
          },
        };
      return parsed;
    }

    const sanitizedUser: AccountIdentity = {
      id: parsed.value.user.id,
      name: parsed.value.user.name,
      username: parsed.value.user.username,
    };

    let verifiedExpiry = parsed.value.expiresAt ?? null;
    if (rememberMe) {
      try {
        if (!this.rememberedSession) throw new Error(STORAGE_FAILURE);
        const checked = this.transport.parseResponse<{ user: AccountIdentity; expiresAt: string }>(
          await this.transport.sendRequest({
            routePath: '/session',
            method: 'GET',
            timeoutMs: remainingBudget(deadline),
          }),
          (v): v is { user: AccountIdentity; expiresAt: string } => isSessionResponse(v, true),
          200,
        );
        if (this.accountEpoch !== dispatchEpoch || !this.dialogs.has(contextId))
          return {
            ok: false,
            error: {
              code: 'fenced',
              message: 'Sign in was superseded or cancelled',
              outcome: 'rejected',
            },
          };
        if (
          checked.ok &&
          (checked.value.user.id !== sanitizedUser.id ||
            Date.parse(checked.value.expiresAt) <= Date.now())
        ) {
          await this.expireAccount(deadline);
          return {
            ok: false,
            error: {
              code: 'invalid_session',
              message: 'The sign-in session could not be verified. Sign in again.',
              outcome: 'rejected',
            },
          };
        }
        if (!checked.ok && checked.error.status === 401) {
          if (this.accountEpoch === dispatchEpoch) await this.expireAccount(deadline);
          return checked;
        }
        if (!checked.ok || checked.value.user.id !== sanitizedUser.id)
          throw new Error(STORAGE_FAILURE);
        verifiedExpiry = new Date(
          Math.min(Date.parse(checked.value.expiresAt), loginStarted + 7 * 86400_000),
        ).toISOString();
        onVerified({ user: sanitizedUser, expiresAt: verifiedExpiry });
        const cookies = await this.transport.snapshotCookies();
        await this.rememberedSession.save(
          { version: 1, origin: this.transport.getOrigin(), expiresAt: verifiedExpiry, cookies },
          () =>
            this.accountEpoch === dispatchEpoch &&
            this.dialogs.has(contextId) &&
            Date.now() < deadline,
        );
      } catch (error) {
        if (this.accountEpoch === dispatchEpoch)
          this.persistenceWarning =
            error instanceof Error && error.message.startsWith('OS-protected storage')
              ? error.message
              : STORAGE_FAILURE;
      }
    }
    if (this.accountEpoch !== dispatchEpoch || !this.dialogs.has(contextId))
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Sign in was superseded or cancelled',
          outcome: 'rejected',
        },
      };
    if (this.signingInContextId === contextId) this.signingInContextId = null;
    this.accountState = 'signedIn';
    this.currentUser = sanitizedUser;
    this.sessionExpiresAt = verifiedExpiry;
    this.emitAccountChanged();

    return { ok: true, value: this.getAccountSnapshot() };
  }

  async signOut(
    contextId: string,
    requestId: string,
    senderId?: number,
  ): Promise<BlueShareResult<{ signedOut: boolean; remoteRevocationConfirmed: boolean }>> {
    let localCleared = false;
    return this.accountOperation(
      'signOut',
      (deadline) =>
        this.performSignOut(contextId, requestId, senderId, deadline, () => {
          localCleared = true;
        }),
      () => {
        if (!localCleared) return undefined;
        this.persistenceWarning = undefined;
        return { signedOut: true, remoteRevocationConfirmed: false };
      },
    );
  }

  private async performSignOut(
    contextId: string,
    _requestId: string,
    senderId: number | undefined,
    deadline: number,
    onLocalCleared: () => void,
  ): Promise<BlueShareResult<{ signedOut: boolean; remoteRevocationConfirmed: boolean }>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    const hadVerifiedSession = this.accountState === 'signedIn';
    this.restoreContextId = null;
    this.restoreWork = null;
    this.accountEpoch++;
    const dispatchEpoch = this.accountEpoch;
    this.restoreAttempted = true;
    this.persistenceWarning = undefined;
    this.accountState = 'signingOut';
    this.currentUser = null;
    this.sessionExpiresAt = null;

    // Fencing: abort any protected operations tied to old epoch
    for (const dialog of this.dialogs.values()) {
      dialog.publishSource = null;
      dialog.uncertainPublishToken = null;
      dialog.uncertainPublishReconciled = false;
      dialog.uncertainRemoveKey = null;
      dialog.uncertainRemoveReconciled = false;
      if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
        if (dialog.activeOperation.operationType !== 'import') {
          dialog.activeOperation.state = 'cancelled';
          dialog.activeOperation.abortController.abort();
          dialog.activeOperation = null;
        }
      }
    }

    this.emitAccountChanged();

    // Detach current session proof immediately before awaiting remote revocation
    const detached = this.transport.detachSession();
    const localCleared = await this.clearRememberedProof();
    if (localCleared) onLocalCleared();

    let remoteRevocationConfirmed = false;
    try {
      if (this.accountEpoch !== dispatchEpoch) throw new LocalDeadline();
      const response = await this.transport.sendRequest({
        routePath: '/session',
        method: 'DELETE',
        timeoutMs: remainingBudget(deadline),
        session: detached.nativeSession,
        partitionName: detached.partitionName,
      });
      if (response.status === 200) {
        const parsed = this.transport.parseResponse<{ signedOut?: unknown }>(response);
        if (parsed.ok && parsed.value?.signedOut === true) {
          remoteRevocationConfirmed = hadVerifiedSession;
        }
      }
    } catch {
      remoteRevocationConfirmed = false;
    } finally {
      if (detached.nativeSession && typeof detached.nativeSession.clearStorageData === 'function') {
        detached.nativeSession.clearStorageData().catch(() => {});
      }
    }

    if (this.accountEpoch === dispatchEpoch) {
      this.accountState = 'signedOut';
      this.emitAccountChanged();
    }

    if (!localCleared)
      return {
        ok: false,
        error: {
          code: 'local_session_cleanup_failed',
          message: CLEANUP_FAILURE,
          outcome: 'rejected',
        },
      };
    return {
      ok: true,
      value: {
        signedOut: true,
        remoteRevocationConfirmed,
      },
    };
  }

  async verifySession(
    contextId?: string,
    senderId?: number,
  ): Promise<BlueShareResult<AccountSessionSnapshot>> {
    if (contextId) {
      const dialogOrErr = this.validateDialog(contextId, senderId);
      if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
    }

    if (this.accountState === 'signedOut') {
      return { ok: true, value: this.getAccountSnapshot() };
    }

    const dispatchEpoch = this.accountEpoch;

    let response;
    try {
      response = await this.transport.sendRequest({
        routePath: '/session',
        method: 'GET',
      });
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'rejected',
        },
      };
    }

    if (this.accountEpoch !== dispatchEpoch || (contextId && !this.dialogs.has(contextId))) {
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Session check was superseded',
          outcome: 'rejected',
        },
      };
    }

    if (response.status === 401) {
      // Session expired
      await this.expireAccount();
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Session expired or invalid',
          status: 401,
          outcome: 'rejected',
        },
      };
    }

    const parsed = this.transport.parseResponse<{
      user: { id: string; name: string; username: string };
      expiresAt?: string;
    }>(
      response,
      (v): v is { user: AccountIdentity; expiresAt: string } => isSessionResponse(v, true),
      200,
    );

    if (!parsed.ok) {
      // Network outage or server error: preserve state
      return parsed;
    }

    this.currentUser = {
      id: parsed.value.user.id,
      name: parsed.value.user.name,
      username: parsed.value.user.username,
    };
    this.sessionExpiresAt = parsed.value.expiresAt ?? null;
    this.accountState = 'signedIn';
    this.emitAccountChanged();

    return { ok: true, value: this.getAccountSnapshot() };
  }

  async listMine(
    contextId: string,
    _requestId: string,
    kind: ResourceKind,
    beforeId?: number | null,
    senderId?: number,
  ): Promise<BlueShareResult<ResourcePage>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    if (this.accountState !== 'signedIn') {
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'You must be signed in to view your submissions',
          status: 401,
          outcome: 'rejected',
        },
      };
    }

    const dispatchEpoch = this.accountEpoch;
    const dialogAtDispatch = dialogOrErr;
    const writeGeneration = dialogAtDispatch.protectedWriteGeneration ?? 0;
    const publishToken = dialogAtDispatch.uncertainPublishToken;
    const removeKey = dialogAtDispatch.uncertainRemoveKey;
    const mayReconcile = !dialogAtDispatch.activeOperation;
    if (mayReconcile && beforeId == null)
      dialogAtDispatch.reconciliationTraversal = {
        generation: writeGeneration,
        kind,
        nextBeforeId: null,
      };

    const queryParams: Record<string, string | number> = { limit: 25 };
    if (beforeId !== null && beforeId !== undefined) queryParams.beforeId = beforeId;

    let response;
    try {
      response = await this.transport.sendRequest({
        routePath: `/${kind}/mine`,
        method: 'GET',
        queryParams,
      });
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'rejected',
        },
      };
    }

    if (this.accountEpoch !== dispatchEpoch || !this.dialogs.has(contextId)) {
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Request was superseded or cancelled',
          outcome: 'rejected',
        },
      };
    }

    if (response.status === 401) {
      await this.expireAccount();
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Session expired while fetching submissions',
          status: 401,
          outcome: 'rejected',
        },
      };
    }

    const parsed = this.transport.parseResponse<ResourcePage>(
      response,
      (data): data is ResourcePage => isResourcePage(data, kind, null, beforeId),
      200,
    );
    if (!parsed.ok) return parsed;

    const dialog = this.dialogs.get(contextId);
    if (
      dialog &&
      mayReconcile &&
      !dialog.activeOperation &&
      (dialog.protectedWriteGeneration ?? 0) === writeGeneration
    ) {
      const traversal = dialog.reconciliationTraversal;
      const inOrder =
        traversal?.generation === writeGeneration &&
        traversal.kind === kind &&
        traversal.nextBeforeId === (beforeId ?? null);
      const complete = inOrder && parsed.value.nextBeforeId === null;
      if (inOrder) traversal.nextBeforeId = parsed.value.nextBeforeId;
      if (
        publishToken &&
        dialog.uncertainPublishToken === publishToken &&
        dialog.uncertainPublishKind === kind &&
        complete
      )
        dialog.uncertainPublishReconciled = true;
      if (
        removeKey &&
        dialog.uncertainRemoveKey === removeKey &&
        removeKey.kind === kind &&
        (complete ||
          parsed.value.items.some((item) => item.kind === kind && item.id === removeKey.id))
      )
        dialog.uncertainRemoveReconciled = true;
    }

    return {
      ok: true,
      value: {
        items: parsed.value.items.map(projectSummary),
        nextBeforeId: parsed.value.nextBeforeId,
      },
    };
  }

  async openWebsite(
    contextId: string,
    purpose: 'register' | 'recover',
    senderId?: number,
  ): Promise<BlueShareResult<{ opened: boolean }>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

    if (purpose !== 'register' && purpose !== 'recover') {
      return {
        ok: false,
        error: {
          code: 'invalid_purpose',
          message: 'Invalid website purpose; only register and recover are permitted',
          outcome: 'rejected',
        },
      };
    }

    const path = purpose === 'register' ? '/register' : '/forgot-password';
    const url = `${this.transport.getOrigin()}${path}`;

    try {
      if (this.externalUrlOpener) {
        await this.externalUrlOpener(url);
      } else {
        await shell.openExternal(url);
      }
      return { ok: true, value: { opened: true } };
    } catch (err: unknown) {
      return {
        ok: false,
        error: {
          code: 'failed_to_open_url',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'rejected',
        },
      };
    }
  }

  async preparePublishSource(
    contextId: string,
    _requestId: string,
    key: LibraryItemKey,
    expectedRevision: number,
    senderId?: number,
  ): Promise<BlueShareResult<PublishSourceSeed>> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
    const dialog = dialogOrErr;

    if (this.accountState !== 'signedIn' || !this.currentUser) {
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Sign-in required to publish a resource',
          outcome: 'rejected',
          status: 401,
        },
      };
    }

    if (!this.libraryService || typeof this.libraryService.capturePublishSource !== 'function') {
      return {
        ok: false,
        error: {
          code: 'library_unavailable',
          message: 'Unified Library service is not available',
          outcome: 'rejected',
        },
      };
    }

    if (dialog.uncertainPublishToken && !dialog.uncertainPublishReconciled) {
      return {
        ok: false,
        error: {
          code: 'reconciliation_required',
          message:
            'Publication outcome is uncertain. Please check My Submissions before re-selecting a library item.',
          outcome: 'unknown',
        },
      };
    }
    dialog.uncertainPublishToken = null;
    dialog.uncertainPublishReconciled = false;

    // Invalidate the prior source before asynchronous selection (T060)
    dialog.publishSource = null;
    dialog.publishSourceGeneration = (dialog.publishSourceGeneration ?? 0) + 1;
    const preparationGeneration = dialog.publishSourceGeneration;
    const dispatchEpoch = this.accountEpoch;

    let captureResult: LibraryResult<LibraryPublishSourceSnapshot>;
    try {
      captureResult = await withinDeadline(
        this.libraryService.capturePublishSource({ key, expectedRevision }),
        Date.now() + REQUEST_BUDGET_MS,
      );
    } catch (error) {
      if (error instanceof LocalDeadline) {
        if (dialog.publishSourceGeneration === preparationGeneration)
          dialog.publishSourceGeneration++;
        return localTimeout();
      }
      throw error;
    }

    // Discard late preparations after selection/account/close changes (T060)
    if (
      !this.dialogs.has(contextId) ||
      this.accountEpoch !== dispatchEpoch ||
      dialog.publishSourceGeneration !== preparationGeneration ||
      this.accountState !== 'signedIn' ||
      !this.currentUser
    ) {
      return {
        ok: false,
        error: {
          code: 'fenced',
          message:
            'Source preparation was superseded by another selection, account change, or dialog close',
          outcome: 'rejected',
        },
      };
    }

    if (!captureResult.ok) {
      return {
        ok: false,
        error: {
          code: captureResult.error.code,
          message: captureResult.error.message,
          outcome: 'rejected',
          diagnostics: captureResult.error.diagnostics,
        },
      };
    }

    const token = randomUUID();
    const xmlByteLength = new TextEncoder().encode(captureResult.value.xml).length;

    const snapshot: PublishSourceSnapshot = {
      token,
      contextId,
      accountEpoch: dispatchEpoch,
      generation: preparationGeneration,
      itemKey: captureResult.value.key,
      expectedRevision: captureResult.value.revision,
      name: captureResult.value.displayName,
      blueType: captureResult.value.blueType,
      descriptionSeed: captureResult.value.description,
      xml: captureResult.value.xml,
    };

    // Keep at most one source snapshot per dialog, bounded by 2 MiB XML (T037)
    dialog.publishSource = snapshot;

    return {
      ok: true,
      value: {
        sourceToken: token,
        kind: key.libraryType as ResourceKind,
        name: snapshot.name,
        blueType: snapshot.blueType,
        descriptionSeed: snapshot.descriptionSeed,
        byteLength: xmlByteLength,
      },
    };
  }

  clearPublishSource(contextId: string, senderId?: number): BlueShareResult<{ cleared: boolean }> {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
    dialogOrErr.publishSourceGeneration++;
    dialogOrErr.publishSource = null;
    return { ok: true, value: { cleared: true } };
  }

  async publishResource(
    contextId: string,
    requestId: string,
    sourceToken: string,
    categoryId: number,
    nameOrDescription: string | null,
    descriptionOrSenderId?: string | null | number,
    maybeSenderId?: number,
  ): Promise<BlueShareResult<ResourceDetail>> {
    const senderId =
      typeof descriptionOrSenderId === 'number' ? descriptionOrSenderId : maybeSenderId;
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
    const dialog = dialogOrErr;

    if (this.accountState !== 'signedIn' || !this.currentUser) {
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Sign-in required to publish a resource',
          outcome: 'rejected',
          status: 401,
        },
      };
    }

    // Repeated pending clicks protection: one pending activation admits only one write (FR-013)
    if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
      return {
        ok: false,
        error: {
          code: 'busy',
          message: 'Another operation is already in progress',
          outcome: 'rejected',
        },
      };
    }

    // Verify source snapshot matches token and belongs to this dialog
    if (!dialog.publishSource || dialog.publishSource.token !== sourceToken) {
      return {
        ok: false,
        error: {
          code: 'invalid_source_token',
          message:
            'Publish source snapshot is invalid or expired. Please re-select the library item.',
          outcome: 'rejected',
        },
      };
    }

    if (dialog.uncertainPublishToken === sourceToken && !dialog.uncertainPublishReconciled) {
      return {
        ok: false,
        error: {
          code: 'reconciliation_required',
          message:
            'Publication outcome is uncertain. Please check My Submissions before retrying to verify whether the resource committed.',
          outcome: 'unknown',
        },
      };
    }

    if (
      dialog.publishSource.contextId !== contextId ||
      dialog.publishSource.accountEpoch !== this.accountEpoch
    ) {
      dialog.publishSource = null;
      return {
        ok: false,
        error: {
          code: 'fenced',
          message: 'Publish source belongs to a different dialog context or account session.',
          outcome: 'rejected',
        },
      };
    }

    const snapshot = dialog.publishSource;
    const kind = snapshot.itemKey.libraryType as ResourceKind;

    const abortController = new AbortController();
    const opContext: OperationContext = {
      operationId: requestId,
      contextId,
      operationType: 'publish',
      abortController,
      accountEpoch: this.accountEpoch,
      state: 'pending',
    };
    dialog.activeOperation = opContext;
    dialog.protectedWriteGeneration = (dialog.protectedWriteGeneration ?? 0) + 1;
    dialog.reconciliationTraversal = undefined;

    const deadline = Date.now() + REQUEST_BUDGET_MS;
    let dispatched = false;
    try {
      // Recheck source existence and revision before sending immutable XML (T037)
      if (this.libraryService && typeof this.libraryService.capturePublishSource === 'function') {
        const recheck = await withinDeadline(
          this.libraryService.capturePublishSource({
            key: snapshot.itemKey,
            expectedRevision: snapshot.expectedRevision,
          }),
          deadline,
        );

        // Recheck operation, context, epoch, and source immediately after awaited revision capture and before POST (T060)
        if (
          !this.dialogs.has(contextId) ||
          dialog.activeOperation !== opContext ||
          opContext.state === 'cancelled' ||
          opContext.accountEpoch !== this.accountEpoch ||
          this.accountState !== 'signedIn' ||
          !this.currentUser ||
          dialog.publishSource !== snapshot
        ) {
          opContext.state = 'cancelled';
          return {
            ok: false,
            error: {
              code: 'fenced',
              message: 'Operation superseded by dialog close, account change, or source reset',
              outcome: 'rejected',
            },
          };
        }

        if (!recheck.ok) {
          // Source was edited or deleted concurrently
          dialog.publishSource = null;
          opContext.state = 'failure';
          return {
            ok: false,
            error: {
              code: 'stale_source',
              message:
                'Source library item was modified or deleted since review. Please review and export again.',
              outcome: 'rejected',
            },
          };
        }
      } else {
        if (
          !this.dialogs.has(contextId) ||
          dialog.activeOperation !== opContext ||
          opContext.state === 'cancelled' ||
          opContext.accountEpoch !== this.accountEpoch ||
          this.accountState !== 'signedIn' ||
          !this.currentUser ||
          dialog.publishSource !== snapshot
        ) {
          opContext.state = 'cancelled';
          return {
            ok: false,
            error: {
              code: 'fenced',
              message: 'Operation superseded by dialog close, account change, or source reset',
              outcome: 'rejected',
            },
          };
        }
      }

      const name =
        typeof descriptionOrSenderId === 'string' || descriptionOrSenderId === null
          ? (nameOrDescription ?? snapshot.name)
          : snapshot.name;
      const description =
        typeof descriptionOrSenderId === 'string' || descriptionOrSenderId === null
          ? descriptionOrSenderId
          : nameOrDescription;

      // Validate publish fields with exact constraints (T036)
      const validation = validatePublishRequest(kind, {
        categoryId,
        name,
        description,
        blueType: snapshot.blueType,
        xml: snapshot.xml,
      });

      if (!validation.valid) {
        opContext.state = 'failure';
        return {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Publish request failed validation',
            outcome: 'rejected',
            fields: validation.errors,
          },
        };
      }
      if (Date.now() >= deadline) throw new LocalDeadline();
      dispatched = true;
      const response = await this.transport.sendRequest({
        routePath: `/${kind}/resources`,
        method: 'POST',
        body: {
          categoryId: validation.request.categoryId,
          name: validation.request.name,
          description: validation.request.description,
          blueType: validation.request.blueType,
          xml: validation.request.xml,
        },
        signal: abortController.signal,
        timeoutMs: Math.max(1, deadline - Date.now()),
      });

      // Fencing: verify dialog is still open and account epoch unchanged
      if (!this.dialogs.has(contextId) || opContext.accountEpoch !== this.accountEpoch) {
        opContext.state = 'cancelled';
        return {
          ok: false,
          error: {
            code: 'fenced',
            message: 'Operation superseded by dialog close or sign out',
            outcome: 'unknown',
          },
        };
      }

      if (response.status !== 201) {
        const isAmbiguous =
          (response.status >= 200 && response.status < 300) ||
          response.status >= 500 ||
          response.status === 408;
        const parsed = this.transport.parseResponse<ResourceDetail>(response);
        opContext.state = isAmbiguous ? 'uncertain' : 'failure';
        if (isAmbiguous) {
          dialog.uncertainPublishToken = sourceToken;
          dialog.uncertainPublishKind = kind;
          dialog.uncertainPublishReconciled = false;
        }
        if (response.status === 401) {
          // Expiry during write
          await this.expireAccount();
        }
        return {
          ok: false,
          error: {
            code:
              response.status >= 200 && response.status < 300
                ? 'unexpected_status'
                : !parsed.ok
                  ? parsed.error.code
                  : `http_${response.status}`,
            message:
              response.status >= 200 && response.status < 300
                ? `Expected HTTP 201 Created for publish, but received HTTP ${response.status}`
                : !parsed.ok
                  ? parsed.error.message
                  : `Server error (status ${response.status})`,
            status: response.status,
            outcome: isAmbiguous ? 'unknown' : 'rejected',
            fields: !parsed.ok ? parsed.error.fields : undefined,
          },
        };
      }

      const parsed = this.transport.parseResponse<ResourceDetail>(response);

      if (!parsed.ok) {
        opContext.state = 'uncertain';
        dialog.uncertainPublishToken = sourceToken;
        dialog.uncertainPublishKind = kind;
        dialog.uncertainPublishReconciled = false;
        return {
          ok: false,
          error: {
            ...parsed.error,
            outcome: 'unknown',
          },
        };
      }

      const detail = parsed.value;
      const isValidDetail = isResourceDetail(detail, kind);
      const matchesCategory = detail?.category?.id === categoryId;
      const matchesOwner = Boolean(
        detail?.author &&
        this.currentUser &&
        detail.author.id === this.currentUser.id &&
        detail.author.username === this.currentUser.username,
      );

      if (!isValidDetail || !matchesCategory || !matchesOwner) {
        opContext.state = 'uncertain';
        dialog.uncertainPublishToken = sourceToken;
        dialog.uncertainPublishKind = kind;
        dialog.uncertainPublishReconciled = false;
        return {
          ok: false,
          error: {
            code: 'invalid_response',
            message:
              'Server returned 201 Created but payload failed validation or did not match expected kind, category, or owner',
            status: 201,
            outcome: 'unknown',
          },
        };
      }

      opContext.state = 'success';
      dialog.uncertainPublishToken = null;
      dialog.uncertainPublishReconciled = false;
      // Release only this operation's source; newer preparation may already own the slot.
      if (dialog.publishSource === snapshot) dialog.publishSource = null;
      dialog.activeOperation = null;
      return { ok: true, value: projectResourceDetail(detail) };
    } catch (err: unknown) {
      if (err instanceof BlueShareNotDispatchedError) {
        opContext.state = 'failure';
        return { ok: false, error: err.failure };
      }
      if (!dispatched) {
        opContext.state = 'failure';
        if (err instanceof LocalDeadline) return localTimeout();
        return {
          ok: false,
          error: {
            code: 'library_error',
            message: 'Source review failed before a write was sent. Try again.',
            outcome: 'rejected',
          },
        };
      }
      if (abortController.signal.aborted) {
        opContext.state = 'cancelled';
        return {
          ok: false,
          error: {
            code: 'aborted',
            message: 'Publish operation was aborted',
            outcome: 'unknown',
          },
        };
      }
      opContext.state = 'uncertain';
      dialog.uncertainPublishToken = sourceToken;
      dialog.uncertainPublishKind = kind;
      dialog.uncertainPublishReconciled = false;
      // Uncertain outcome: write may have reached server!
      return {
        ok: false,
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'unknown',
        },
      };
    } finally {
      if (dialog.activeOperation === opContext && opContext.state !== 'pending') {
        dialog.activeOperation = null;
      }
    }
  }

  async removeResource(
    contextId: string,
    requestId: string,
    key: ResourceKey,
    senderId?: number,
  ): Promise<
    BlueShareResult<{
      kind: ResourceKind;
      id: number;
      removed: boolean;
      alreadyRemoved: boolean;
    }>
  > {
    const dialogOrErr = this.validateDialog(contextId, senderId);
    if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
    const dialog = dialogOrErr;

    if (this.accountState !== 'signedIn' || !this.currentUser) {
      return {
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Sign-in required to remove a resource',
          outcome: 'rejected',
          status: 401,
        },
      };
    }

    if (dialog.activeOperation && dialog.activeOperation.state === 'pending') {
      return {
        ok: false,
        error: {
          code: 'busy',
          message: 'Another operation is already in progress',
          outcome: 'rejected',
        },
      };
    }

    if (dialog.uncertainRemoveKey && !dialog.uncertainRemoveReconciled) {
      return {
        ok: false,
        error: {
          code: 'reconciliation_required',
          message:
            'Removal outcome is uncertain. Please refresh My Submissions to verify whether the resource was removed before retrying.',
          outcome: 'unknown',
        },
      };
    }

    const abortController = new AbortController();
    const opContext: OperationContext = {
      operationId: requestId,
      contextId,
      operationType: 'remove',
      abortController,
      accountEpoch: this.accountEpoch,
      state: 'pending',
    };
    dialog.activeOperation = opContext;
    dialog.protectedWriteGeneration = (dialog.protectedWriteGeneration ?? 0) + 1;
    dialog.reconciliationTraversal = undefined;

    try {
      const response = await this.transport.sendRequest({
        routePath: `/${key.kind}/resources/${key.id}`,
        method: 'DELETE',
        signal: abortController.signal,
      });

      // Fencing: verify dialog is still open and account epoch unchanged
      if (!this.dialogs.has(contextId) || opContext.accountEpoch !== this.accountEpoch) {
        opContext.state = 'cancelled';
        return {
          ok: false,
          error: {
            code: 'fenced',
            message: 'Operation superseded by dialog close or sign out',
            outcome: 'unknown',
          },
        };
      }

      if (response.status >= 500 || response.status === 408) {
        opContext.state = 'uncertain';
        dialog.uncertainRemoveKey = key;
        dialog.uncertainRemoveReconciled = false;
        const parsed = this.transport.parseResponse(response);
        return {
          ok: false,
          error: {
            code:
              !parsed.ok && parsed.error.code
                ? parsed.error.code
                : response.status === 504
                  ? 'gateway_timeout'
                  : 'service_unavailable',
            message:
              !parsed.ok && parsed.error.message
                ? parsed.error.message
                : 'Removal outcome uncertain due to network timeout or server error',
            outcome: 'unknown',
            status: response.status,
          },
        };
      }

      if (response.status === 410) {
        // Already removed - confirmed absence!
        opContext.state = 'success';
        dialog.uncertainRemoveKey = null;
        dialog.uncertainRemoveReconciled = false;
        return {
          ok: true,
          value: {
            kind: key.kind,
            id: key.id,
            removed: true,
            alreadyRemoved: true,
          },
        };
      }

      if (response.status === 200) {
        const parsed = this.transport.parseResponse<Record<string, unknown>>(response);

        if (!parsed.ok) {
          opContext.state = 'uncertain';
          dialog.uncertainRemoveKey = key;
          dialog.uncertainRemoveReconciled = false;
          return {
            ok: false,
            error: {
              ...parsed.error,
              outcome: 'unknown',
            },
          };
        }

        const val = parsed.value;
        const isMatchingKey = val?.kind === key.kind && val?.id === key.id;
        const isLiteralRemoved = val?.removed === true;
        const isValidAlreadyRemoved =
          val?.alreadyRemoved === undefined || typeof val?.alreadyRemoved === 'boolean';

        if (!isMatchingKey || !isLiteralRemoved || !isValidAlreadyRemoved) {
          opContext.state = 'uncertain';
          dialog.uncertainRemoveKey = key;
          dialog.uncertainRemoveReconciled = false;
          return {
            ok: false,
            error: {
              code: 'invalid_response',
              message:
                'Server returned HTTP 200 for removal but receipt failed validation (wrong key, removed !== true, or invalid alreadyRemoved)',
              status: response.status,
              outcome: 'unknown',
            },
          };
        }

        opContext.state = 'success';
        dialog.uncertainRemoveKey = null;
        dialog.uncertainRemoveReconciled = false;
        dialog.activeOperation = null;
        return {
          ok: true,
          value: {
            kind: key.kind,
            id: key.id,
            removed: true,
            alreadyRemoved: val.alreadyRemoved === true,
          },
        };
      }

      if (response.status >= 200 && response.status < 300) {
        opContext.state = 'uncertain';
        dialog.uncertainRemoveKey = key;
        dialog.uncertainRemoveReconciled = false;
        return {
          ok: false,
          error: {
            code: 'unexpected_status',
            message: `Expected HTTP 200 for removal, but received HTTP ${response.status}`,
            status: response.status,
            outcome: 'unknown',
          },
        };
      }

      const parsed = this.transport.parseResponse(response);
      opContext.state = 'failure';
      if (response.status === 401) {
        await this.expireAccount();
      }
      return parsed as BlueShareResult<any>;
    } catch (err: unknown) {
      if (err instanceof BlueShareNotDispatchedError) {
        opContext.state = 'failure';
        return { ok: false, error: err.failure };
      }
      if (abortController.signal.aborted) {
        opContext.state = 'cancelled';
        return {
          ok: false,
          error: {
            code: 'aborted',
            message: 'Remove operation was aborted',
            outcome: 'unknown',
          },
        };
      }
      opContext.state = 'uncertain';
      dialog.uncertainRemoveKey = key;
      dialog.uncertainRemoveReconciled = false;
      return {
        ok: false,
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : String(err),
          outcome: 'unknown',
        },
      };
    } finally {
      if (dialog.activeOperation === opContext && opContext.state !== 'pending') {
        dialog.activeOperation = null;
      }
    }
  }

  destroy(): void {
    for (const contextId of Array.from(this.dialogs.keys())) {
      this.closeDialog(contextId);
    }
    this.events.removeAllListeners();
  }
}
