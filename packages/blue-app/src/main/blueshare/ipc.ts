import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  BLUESHARE_CHANNELS,
  isBlueShareError,
  isResetPublishResult,
  isOpenDialogResult,
  isSignOutResult,
  isCategoryList,
  isResourcePage,
  isLatestResult,
  isResourceSummary,
  isLibraryMutationReceipt,
  isPublishSourceSeed,
  isRemoveResourceResult,
  isOpenWebsiteResult,
  validateBlueShareResult,
  isResourceKind,
  isResourceKey,
  isUserLibraryItemKey,
  isAccountSessionSnapshot,
  isContextId,
  isRequestId,
  MAX_RESOURCE_ID,
  type BlueShareResult,
  type BlueShareError,
  type ResourceKind,
  type ResourceKey,
  type PublishResourceRequest,
} from '../../shared/blueshare';
import { registerIpcTransaction } from '../ipc/ipc-registration';
import { BlueShareService } from './service';
import { sanitizeErrorMessage } from './transport';

export const BLUESHARE_IPC_CHANNELS = [
  BLUESHARE_CHANNELS.OPEN,
  BLUESHARE_CHANNELS.GET_ACCOUNT,
  BLUESHARE_CHANNELS.SIGN_IN,
  BLUESHARE_CHANNELS.SIGN_OUT,
  BLUESHARE_CHANNELS.GET_CATEGORIES,
  BLUESHARE_CHANNELS.LIST_RESOURCES,
  BLUESHARE_CHANNELS.GET_LATEST,
  BLUESHARE_CHANNELS.GET_RESOURCE,
  BLUESHARE_CHANNELS.IMPORT_RESOURCE,
  BLUESHARE_CHANNELS.PREPARE_PUBLISH,
  BLUESHARE_CHANNELS.RESET_PUBLISH,
  BLUESHARE_CHANNELS.PUBLISH_RESOURCE,
  BLUESHARE_CHANNELS.LIST_MINE,
  BLUESHARE_CHANNELS.REMOVE_RESOURCE,
  BLUESHARE_CHANNELS.OPEN_WEBSITE,
  BLUESHARE_CHANNELS.CLOSE,
] as const;

export interface BlueShareIpcOptions {
  readonly ipcMain: IpcMain;
  readonly service: BlueShareService;
  readonly getWindows?: () => readonly BrowserWindow[];
}

function invalidRequest(message: string): BlueShareResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_request',
      message: sanitizeErrorMessage(message),
      outcome: 'rejected',
    },
  };
}

function fromError(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred',
): BlueShareResult<never> {
  // Exceptions are not a trusted service failure contract. In particular, never
  // reflect arbitrary exception messages, codes, fields, bodies or diagnostics.
  return {
    ok: false,
    error: { code: 'unexpected_error', message: fallbackMessage, outcome: 'rejected' },
  };
}

export function registerBlueShareIpc(options: BlueShareIpcOptions): () => void {
  const { ipcMain, service, getWindows } = options;

  let unsubscribeAccountEvents: (() => void) | null = null;

  const disposer = registerIpcTransaction(ipcMain, 'blueshare', (registration) => {
    const guards: Record<string, (value: unknown) => boolean> = {
      [BLUESHARE_CHANNELS.OPEN]: isOpenDialogResult,
      [BLUESHARE_CHANNELS.GET_ACCOUNT]: isAccountSessionSnapshot,
      [BLUESHARE_CHANNELS.SIGN_IN]: isAccountSessionSnapshot,
      [BLUESHARE_CHANNELS.SIGN_OUT]: isSignOutResult,
      [BLUESHARE_CHANNELS.GET_CATEGORIES]: isCategoryList,
      [BLUESHARE_CHANNELS.LIST_RESOURCES]: isResourcePage,
      [BLUESHARE_CHANNELS.GET_LATEST]: isLatestResult,
      [BLUESHARE_CHANNELS.GET_RESOURCE]: isResourceSummary,
      [BLUESHARE_CHANNELS.IMPORT_RESOURCE]: isLibraryMutationReceipt,
      [BLUESHARE_CHANNELS.RESET_PUBLISH]: isResetPublishResult,
      [BLUESHARE_CHANNELS.PREPARE_PUBLISH]: isPublishSourceSeed,
      [BLUESHARE_CHANNELS.PUBLISH_RESOURCE]: isResourceSummary,
      [BLUESHARE_CHANNELS.LIST_MINE]: isResourcePage,
      [BLUESHARE_CHANNELS.REMOVE_RESOURCE]: isRemoveResourceResult,
      [BLUESHARE_CHANNELS.OPEN_WEBSITE]: isOpenWebsiteResult,
      [BLUESHARE_CHANNELS.CLOSE]: (value) => value === true,
    };
    const scope = {
      handle<Args extends unknown[]>(
        channel: string,
        listener: (event: IpcMainInvokeEvent, ...args: Args) => unknown,
      ) {
        registration.handle(channel, async (event: IpcMainInvokeEvent, ...args: Args) => {
          try {
            let result = await listener(event, ...args);
            if (
              result &&
              typeof result === 'object' &&
              'ok' in result &&
              result.ok === false &&
              'error' in result &&
              isBlueShareError(result.error)
            ) {
              const error = result.error;
              result = {
                ok: false,
                error: {
                  ...error,
                  message: sanitizeErrorMessage(error.message),
                  fields:
                    error.fields &&
                    Object.fromEntries(
                      Object.entries(error.fields)
                        .filter(([key]) =>
                          [
                            'categoryId',
                            'name',
                            'description',
                            'blueType',
                            'xml',
                            'request',
                            'email',
                            'password',
                            'beforeId',
                            'limit',
                          ].includes(key),
                        )
                        .map(([key, value]) => [
                          key,
                          /password|email/.test(key)
                            ? 'Check this field.'
                            : sanitizeErrorMessage(value),
                        ]),
                    ),
                  diagnostics: error.diagnostics?.map((d) => ({
                    ...d,
                    code: sanitizeErrorMessage(d.code),
                    source: {
                      ...d.source,
                      label: sanitizeErrorMessage(d.source.label),
                      nativePath:
                        d.source.nativePath === undefined
                          ? undefined
                          : sanitizeErrorMessage(d.source.nativePath),
                      libraryItemId:
                        d.source.libraryItemId === undefined
                          ? undefined
                          : sanitizeErrorMessage(d.source.libraryItemId),
                    },
                    path: sanitizeErrorMessage(d.path),
                    member: d.member === undefined ? undefined : sanitizeErrorMessage(d.member),
                    value:
                      d.value === undefined
                        ? undefined
                        : /token|cookie|password|secret|proof|authorization/i.test(d.member ?? '')
                          ? '[REDACTED]'
                          : sanitizeErrorMessage(d.value),
                    message: sanitizeErrorMessage(d.message),
                    recovery: sanitizeErrorMessage(d.recovery),
                  })),
                },
              };
            }
            return validateBlueShareResult(result, (value): value is unknown =>
              guards[channel](value),
            );
          } catch (error) {
            return fromError(error);
          }
        });
      },
    };

    // 1. OPEN
    scope.handle(BLUESHARE_CHANNELS.OPEN, async (event: IpcMainInvokeEvent) => {
      try {
        const opened = service.openDialog(event.sender);
        if (!opened.ok) return opened;
        // Restoration publishes checked main-owned snapshots independently of browsing.
        void service.getAccount(opened.value.contextId, event.sender.id).catch(() => {});
        return {
          ok: true as const,
          value: { ...opened.value, account: service.getAccountSnapshot() },
        };
      } catch (err) {
        return fromError(err);
      }
    });

    // 2. GET_ACCOUNT
    scope.handle(
      BLUESHARE_CHANNELS.GET_ACCOUNT,
      async (event: IpcMainInvokeEvent, contextId: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
        return service.getAccount(contextId, event.sender.id);
      },
    );

    // 3. SIGN_IN
    scope.handle(
      BLUESHARE_CHANNELS.SIGN_IN,
      async (
        event: IpcMainInvokeEvent,
        contextId: unknown,
        requestId: unknown,
        email: unknown,
        password: unknown,
        rememberMe: unknown = false,
      ) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (typeof rememberMe !== 'boolean') return invalidRequest('rememberMe must be a boolean');
        if (typeof email !== 'string' || typeof password !== 'string') {
          return invalidRequest('Email and password must be strings');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.signIn(
            contextId,
            requestId,
            email,
            password,
            event.sender.id,
            rememberMe,
          );
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 4. SIGN_OUT
    scope.handle(
      BLUESHARE_CHANNELS.SIGN_OUT,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.signOut(contextId, requestId, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 5. GET_CATEGORIES
    scope.handle(
      BLUESHARE_CHANNELS.GET_CATEGORIES,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown, kind: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKind(kind))
          return invalidRequest('kind must be instrument, effect, or soundObject');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.getCategories(contextId, requestId, kind, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 6. LIST_RESOURCES
    scope.handle(
      BLUESHARE_CHANNELS.LIST_RESOURCES,
      async (
        event: IpcMainInvokeEvent,
        contextId: unknown,
        requestId: unknown,
        kind: unknown,
        categoryId: unknown,
        beforeId: unknown,
      ) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKind(kind))
          return invalidRequest('kind must be instrument, effect, or soundObject');
        if (
          categoryId !== null &&
          categoryId !== undefined &&
          (typeof categoryId !== 'number' ||
            !Number.isInteger(categoryId) ||
            categoryId < 1 ||
            categoryId > MAX_RESOURCE_ID)
        ) {
          return invalidRequest('categoryId must be a positive integer <= 2147483647 or null');
        }
        if (
          beforeId !== null &&
          beforeId !== undefined &&
          (typeof beforeId !== 'number' ||
            !Number.isInteger(beforeId) ||
            beforeId < 1 ||
            beforeId > MAX_RESOURCE_ID)
        ) {
          return invalidRequest('beforeId must be a positive integer <= 2147483647 or null');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.listResources(
            contextId,
            requestId,
            kind,
            categoryId ?? null,
            beforeId ?? null,
            event.sender.id,
          );
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 7. GET_LATEST
    scope.handle(
      BLUESHARE_CHANNELS.GET_LATEST,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown, kind: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKind(kind))
          return invalidRequest('kind must be instrument, effect, or soundObject');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.getLatest(contextId, requestId, kind, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 8. GET_RESOURCE
    scope.handle(
      BLUESHARE_CHANNELS.GET_RESOURCE,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown, key: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKey(key)) return invalidRequest('key must be a valid ResourceKey');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.getResource(contextId, requestId, key, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 9. IMPORT_RESOURCE
    scope.handle(
      BLUESHARE_CHANNELS.IMPORT_RESOURCE,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown, key: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKey(key)) return invalidRequest('key must be a valid ResourceKey');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.importResource(contextId, requestId, key, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 10. PREPARE_PUBLISH
    scope.handle(
      BLUESHARE_CHANNELS.PREPARE_PUBLISH,
      async (
        event: IpcMainInvokeEvent,
        contextId: unknown,
        requestId: unknown,
        itemKey: unknown,
        expectedRevision: unknown,
      ) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!itemKey || typeof itemKey !== 'object') {
          return invalidRequest('itemKey must be an object');
        }
        if (
          typeof expectedRevision !== 'number' ||
          !Number.isInteger(expectedRevision) ||
          expectedRevision < 0
        ) {
          return invalidRequest('expectedRevision must be a non-negative integer');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
        if (!isUserLibraryItemKey(itemKey)) {
          return invalidRequest('itemKey must be a valid user-scope library item key');
        }

        try {
          return await service.preparePublishSource(
            contextId,
            requestId,
            itemKey,
            expectedRevision,
            event.sender.id,
          );
        } catch (err) {
          return fromError(err);
        }
      },
    );

    scope.handle(
      BLUESHARE_CHANNELS.RESET_PUBLISH,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown) => {
        if (!isContextId(contextId) || !isRequestId(requestId))
          return invalidRequest('Invalid reset context or request');
        return service.clearPublishSource(contextId, event.sender.id);
      },
    );

    // 11. PUBLISH_RESOURCE
    scope.handle(
      BLUESHARE_CHANNELS.PUBLISH_RESOURCE,
      async (
        event: IpcMainInvokeEvent,
        contextId: unknown,
        requestId: unknown,
        sourceToken: unknown,
        categoryId: unknown,
        description: unknown,
      ) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (typeof sourceToken !== 'string' || sourceToken.trim().length === 0) {
          return invalidRequest('sourceToken must be a non-empty string');
        }
        if (
          typeof categoryId !== 'number' ||
          !Number.isInteger(categoryId) ||
          categoryId < 1 ||
          categoryId > MAX_RESOURCE_ID
        ) {
          return invalidRequest('categoryId must be a positive integer <= 2147483647');
        }
        if (description !== null && description !== undefined && typeof description !== 'string') {
          return invalidRequest('description must be a string or null');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          const result = await service.publishResource(
            contextId,
            requestId,
            sourceToken,
            categoryId,
            description ?? null,
            event.sender.id,
          );
          if (result.ok && result.value) {
            // Strip raw XML before sending across IPC to renderer
            const { xml: _xml, ...summary } = result.value;
            return { ok: true, value: summary };
          }
          return result;
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 12. LIST_MINE
    scope.handle(
      BLUESHARE_CHANNELS.LIST_MINE,
      async (
        event: IpcMainInvokeEvent,
        contextId: unknown,
        requestId: unknown,
        kind: unknown,
        beforeId: unknown,
      ) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKind(kind))
          return invalidRequest('kind must be instrument, effect, or soundObject');
        if (
          beforeId !== null &&
          beforeId !== undefined &&
          (typeof beforeId !== 'number' ||
            !Number.isInteger(beforeId) ||
            beforeId < 1 ||
            beforeId > MAX_RESOURCE_ID)
        ) {
          return invalidRequest('beforeId must be a positive integer <= 2147483647 or null');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.listMine(
            contextId,
            requestId,
            kind,
            beforeId ?? null,
            event.sender.id,
          );
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 13. REMOVE_RESOURCE
    scope.handle(
      BLUESHARE_CHANNELS.REMOVE_RESOURCE,
      async (event: IpcMainInvokeEvent, contextId: unknown, requestId: unknown, key: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (!isRequestId(requestId)) return invalidRequest('requestId must be a valid string');
        if (!isResourceKey(key)) return invalidRequest('key must be a valid ResourceKey');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.removeResource(contextId, requestId, key, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 14. OPEN_WEBSITE
    scope.handle(
      BLUESHARE_CHANNELS.OPEN_WEBSITE,
      async (event: IpcMainInvokeEvent, contextId: unknown, purpose: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        if (purpose !== 'register' && purpose !== 'recover') {
          return invalidRequest('purpose must be register or recover');
        }
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };

        try {
          return await service.openWebsite(contextId, purpose, event.sender.id);
        } catch (err) {
          return fromError(err);
        }
      },
    );

    // 15. CLOSE
    scope.handle(
      BLUESHARE_CHANNELS.CLOSE,
      async (event: IpcMainInvokeEvent, contextId: unknown) => {
        if (!isContextId(contextId)) return invalidRequest('contextId must be a valid string');
        const dialogOrErr = service.validateDialog(contextId, event.sender.id);
        if ('code' in dialogOrErr) return { ok: false, error: dialogOrErr };
        service.closeDialog(contextId);
        return { ok: true, value: true };
      },
    );

    // Broadcast account-changed events to all open windows
    unsubscribeAccountEvents = service.onAccountChanged((snapshot) => {
      if (!isAccountSessionSnapshot(snapshot)) return;
      const windows = getWindows?.() ?? [];
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(BLUESHARE_CHANNELS.ACCOUNT_CHANGED, snapshot);
        }
      }
    });
  });

  return () => {
    unsubscribeAccountEvents?.();
    unsubscribeAccountEvents = null;
    disposer();
  };
}
