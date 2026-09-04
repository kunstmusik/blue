// Code Repository IPC registration. Mirrors the unified-library ipc pattern:
// one `ipcMain.handle` per channel, each payload validated by a shared-package
// type guard, errors returned as a uniform `{ ok: false, error }` envelope, and
// change events fanned out to every live BrowserWindow.

import {
  dialog,
  type BrowserWindow,
  type IpcMain,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CODE_REPOSITORY_CHANGED_CHANNEL,
  CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL,
  CODE_REPOSITORY_CREATE_GROUP_CHANNEL,
  CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL,
  CODE_REPOSITORY_DELETE_NODE_CHANNEL,
  CODE_REPOSITORY_EXPORT_XML_CHANNEL,
  CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL,
  CODE_REPOSITORY_GET_STATUS_CHANNEL,
  CODE_REPOSITORY_IMPORT_FILE_CHANNEL,
  CODE_REPOSITORY_MOVE_NODE_CHANNEL,
  CODE_REPOSITORY_UPDATE_NODE_CHANNEL,
  CODE_REPOSITORY_RETRY_CHANNEL,
  createCodeRepositoryError,
  isCodeRepositoryNode,
  isCodeRepositorySnapshot,
  type CodeRepositoryCommitDraftRequest,
  type CodeRepositoryCreateGroupRequest,
  type CodeRepositoryCreateSnippetRequest,
  type CodeRepositoryDeleteNodeRequest,
  type CodeRepositoryDiagnostic,
  type CodeRepositoryError,
  type CodeRepositoryImportFileRequest,
  type CodeRepositoryImportResult,
  type CodeRepositoryMoveNodeRequest,
  type CodeRepositoryResult,
  type CodeRepositorySnapshot,
  type CodeRepositoryStatus,
  type CodeRepositoryUpdateNodeRequest,
} from '../../shared/code-repository';
import { CodeRepositoryService, ServiceError } from './service';
import { resolveWorkDirectoryDefaultPath } from '../work-directory';
import { registerIpcTransaction } from '../ipc/ipc-registration';

export const CODE_REPOSITORY_IPC_CHANNELS = [
  CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL,
  CODE_REPOSITORY_GET_STATUS_CHANNEL,
  CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL,
  CODE_REPOSITORY_CREATE_GROUP_CHANNEL,
  CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL,
  CODE_REPOSITORY_MOVE_NODE_CHANNEL,
  CODE_REPOSITORY_UPDATE_NODE_CHANNEL,
  CODE_REPOSITORY_DELETE_NODE_CHANNEL,
  CODE_REPOSITORY_IMPORT_FILE_CHANNEL,
  CODE_REPOSITORY_RETRY_CHANNEL,
  CODE_REPOSITORY_EXPORT_XML_CHANNEL,
] as const;

export interface CodeRepositoryIpcOptions {
  readonly ipcMain: IpcMain;
  readonly service: CodeRepositoryService;
  readonly getWindows: () => readonly BrowserWindow[];
  readonly getWorkDirectory?: () => string | undefined;
}

function ok<T>(value: T): CodeRepositoryResult<T> {
  return { ok: true as const, value };
}

function fail(error: CodeRepositoryError): CodeRepositoryResult<never> {
  return { ok: false as const, error };
}

function fromServiceError(error: unknown): CodeRepositoryError {
  if (error instanceof ServiceError) {
    return createCodeRepositoryError(
      error.code,
      error.message,
      error.retryable,
      error.currentSnapshot,
    );
  }
  return createCodeRepositoryError(
    'storage-unavailable',
    'Code Repository storage is unavailable.',
    true,
  );
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCommitDraftRequest(value: unknown): value is CodeRepositoryCommitDraftRequest {
  if (!isStringRecord(value)) return false;
  if (!isRevision(value.expectedRevision)) return false;
  return isCodeRepositoryNode(value.root);
}

function isCreateGroupRequest(value: unknown): value is CodeRepositoryCreateGroupRequest {
  if (!isStringRecord(value)) return false;
  return (
    isNonBlankString(value.parentId) &&
    isNonBlankString(value.name) &&
    isRevision(value.expectedRevision)
  );
}

function isCreateSnippetRequest(value: unknown): value is CodeRepositoryCreateSnippetRequest {
  if (!isStringRecord(value)) return false;
  return (
    isNonBlankString(value.parentId) &&
    isNonBlankString(value.name) &&
    typeof value.code === 'string' &&
    isRevision(value.expectedRevision)
  );
}

function isMoveNodeRequest(value: unknown): value is CodeRepositoryMoveNodeRequest {
  if (!isStringRecord(value)) return false;
  return (
    isNonBlankString(value.nodeId) &&
    isNonBlankString(value.parentId) &&
    typeof value.order === 'number' &&
    Number.isInteger(value.order) &&
    value.order >= 0 &&
    isRevision(value.expectedRevision)
  );
}

function isUpdateNodeRequest(value: unknown): value is CodeRepositoryUpdateNodeRequest {
  if (!isStringRecord(value)) return false;
  return (
    isNonBlankString(value.nodeId) &&
    (value.name === undefined || isNonBlankString(value.name)) &&
    (value.code === undefined || typeof value.code === 'string') &&
    (value.name !== undefined || value.code !== undefined) &&
    isRevision(value.expectedRevision)
  );
}

function isDeleteNodeRequest(value: unknown): value is CodeRepositoryDeleteNodeRequest {
  if (!isStringRecord(value)) return false;
  return isNonBlankString(value.nodeId) && isRevision(value.expectedRevision);
}

function isImportFileRequest(value: unknown): value is CodeRepositoryImportFileRequest {
  if (!isStringRecord(value)) return false;
  return isRevision(value.expectedRevision);
}

export function registerCodeRepositoryIpc(options: CodeRepositoryIpcOptions): () => void {
  const { ipcMain, service, getWindows } = options;
  const getWorkDirectory = options.getWorkDirectory;
  let disposeServiceListeners = (): void => {};
  const disposer = registerIpcTransaction(ipcMain, 'code-repository', (scope) => {
    const invalid = (message: string) =>
      fail(createCodeRepositoryError('invalid-tree', message, false));

    scope.handle(CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL, async () => {
      const snapshot = service.getSnapshot();
      if (snapshot) return ok(snapshot);
      const status = service.getStatus();
      if (status.diagnostic) {
        return fail(
          createCodeRepositoryError('storage-unavailable', status.diagnostic.message, true),
        );
      }
      return fail(
        createCodeRepositoryError('not-initialized', 'Code Repository is not initialized', true),
      );
    });

    scope.handle(CODE_REPOSITORY_GET_STATUS_CHANNEL, async () => service.getStatus());

    scope.handle(CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL, async (_event, request: unknown) => {
      if (!isCommitDraftRequest(request)) return invalid('Invalid commit-draft request.');
      try {
        const snapshot = await service.commitDraft(request.expectedRevision, request.root);
        return ok(snapshot);
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_CREATE_GROUP_CHANNEL, async (_event, request: unknown) => {
      if (!isCreateGroupRequest(request)) return invalid('Invalid create-group request.');
      try {
        return ok(
          await service.createGroup(request.parentId, request.name, request.expectedRevision),
        );
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL, async (_event, request: unknown) => {
      if (!isCreateSnippetRequest(request)) return invalid('Invalid create-snippet request.');
      try {
        return ok(
          await service.createSnippet(
            request.parentId,
            request.name,
            request.code,
            request.expectedRevision,
          ),
        );
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_MOVE_NODE_CHANNEL, async (_event, request: unknown) => {
      if (!isMoveNodeRequest(request)) return invalid('Invalid move-node request.');
      try {
        return ok(
          await service.moveNode(
            request.nodeId,
            request.parentId,
            request.order,
            request.expectedRevision,
          ),
        );
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_UPDATE_NODE_CHANNEL, async (_event, request: unknown) => {
      if (!isUpdateNodeRequest(request)) return invalid('Invalid update-node request.');
      try {
        return ok(await service.updateNode(request.nodeId, request, request.expectedRevision));
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_DELETE_NODE_CHANNEL, async (_event, request: unknown) => {
      if (!isDeleteNodeRequest(request)) return invalid('Invalid delete-node request.');
      try {
        return ok(await service.deleteNode(request.nodeId, request.expectedRevision));
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_IMPORT_FILE_CHANNEL, async (_event, request: unknown) => {
      if (!isImportFileRequest(request)) return invalid('Invalid import-file request.');
      const owner = getWindows().find((window) => !window.isDestroyed());
      const dialogOptions: OpenDialogOptions = {
        title: 'Import Code Repository',
        defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.()),
        properties: ['openFile'],
        filters: [{ name: 'Java Blue Code Repository XML', extensions: ['xml'] }],
      };
      const selected = owner
        ? await dialog.showOpenDialog(owner, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      const sourcePath = selected.filePaths[0];
      if (selected.canceled || !sourcePath) return null;
      try {
        const result = await service.importFile(sourcePath, request.expectedRevision);
        const value: CodeRepositoryImportResult = {
          snapshot: result.snapshot,
          importedNodeCount: result.importedNodeCount,
          sourceHash: result.sourceHash,
        };
        return ok(value);
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_RETRY_CHANNEL, async () => {
      try {
        return ok(await service.retry());
      } catch (error) {
        return fail(fromServiceError(error));
      }
    });

    scope.handle(CODE_REPOSITORY_EXPORT_XML_CHANNEL, async () => {
      const owner = getWindows().find((window) => !window.isDestroyed());
      const dialogOptions: SaveDialogOptions = {
        title: 'Export Code Repository',
        defaultPath: resolveWorkDirectoryDefaultPath(getWorkDirectory?.(), 'codeRepository.xml'),
        filters: [{ name: 'Java Blue Code Repository XML', extensions: ['xml'] }],
      };
      const result = owner
        ? await dialog.showSaveDialog(owner, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) return null;
      try {
        const exported = service.exportXml();
        fs.writeFileSync(result.filePath, exported.xml, 'utf8');
        return ok({ basename: path.basename(result.filePath) });
      } catch {
        return fail(
          createCodeRepositoryError(
            'export-failed',
            'Unable to write the Code Repository export.',
            false,
          ),
        );
      }
    });

    const send = (channel: string, payload: unknown): void => {
      for (const window of getWindows()) {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          window.webContents.send(channel, payload);
        }
      }
    };
    const removeChanged = service.onChanged((event) => {
      send(CODE_REPOSITORY_CHANGED_CHANNEL, event);
    });

    disposeServiceListeners = () => {
      removeChanged();
    };
  });
  return () => {
    disposeServiceListeners();
    disposer();
  };
}

// Re-export the shared types used by the preload bridge for convenience.
export type {
  CodeRepositorySnapshot,
  CodeRepositoryStatus,
  CodeRepositoryDiagnostic,
  CodeRepositoryImportResult,
};
