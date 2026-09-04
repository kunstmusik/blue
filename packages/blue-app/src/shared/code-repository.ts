// Code Repository IPC contract.
//
// Serializable snapshots, mutation requests, import/export results, change
// events, and stable error codes that cross the preload boundary between the
// main-process canonical repository and the renderer. Mirrors the contract in
// specs/069-code-repository/contracts/code-repository-ipc.md.

import type { CodeRepositoryNode, CodeRepositoryNodeKind } from '@blue/data';
import {
  CODE_REPOSITORY_ROOT_ID,
  isCodeRepositoryNode as isPortableCodeRepositoryNode,
  validateCodeRepositoryTree,
} from '@blue/data';

// Channel names ---------------------------------------------------------

export const CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL = 'code-repository:get-snapshot';
export const CODE_REPOSITORY_GET_STATUS_CHANNEL = 'code-repository:get-status';
export const CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL = 'code-repository:commit-draft';
export const CODE_REPOSITORY_CREATE_GROUP_CHANNEL = 'code-repository:create-group';
export const CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL = 'code-repository:create-snippet';
export const CODE_REPOSITORY_MOVE_NODE_CHANNEL = 'code-repository:move-node';
export const CODE_REPOSITORY_UPDATE_NODE_CHANNEL = 'code-repository:update-node';
export const CODE_REPOSITORY_DELETE_NODE_CHANNEL = 'code-repository:delete-node';
export const CODE_REPOSITORY_IMPORT_FILE_CHANNEL = 'code-repository:import-file';
export const CODE_REPOSITORY_EXPORT_XML_CHANNEL = 'code-repository:export-xml';
export const CODE_REPOSITORY_RETRY_CHANNEL = 'code-repository:retry';
export const CODE_REPOSITORY_CHANGED_CHANNEL = 'code-repository:changed';

// Re-exported data types ------------------------------------------------

export type { CodeRepositoryNode, CodeRepositoryNodeKind } from '@blue/data';

// Snapshots & events ----------------------------------------------------

export interface CodeRepositorySnapshot {
  readonly root: CodeRepositoryNode;
  readonly contentRevision: number;
  readonly initialized: boolean;
}

export type CodeRepositoryChangedReason = 'commit' | 'import' | 'recovery';

export interface CodeRepositoryChangedEvent {
  readonly contentRevision: number;
  readonly reason: CodeRepositoryChangedReason;
}

// Status & diagnostics --------------------------------------------------

export type CodeRepositoryMigrationStatus = 'not-started' | 'succeeded' | 'failed' | 'skipped';

export interface CodeRepositoryDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly sourceLabel?: string;
}

export interface CodeRepositoryStatus {
  readonly available: boolean;
  readonly migrationStatus: CodeRepositoryMigrationStatus;
  readonly diagnostic?: CodeRepositoryDiagnostic;
}

// Mutation requests -----------------------------------------------------

export interface CodeRepositoryCommitDraftRequest {
  readonly expectedRevision: number;
  readonly root: CodeRepositoryNode;
}

export interface CodeRepositoryCreateGroupRequest {
  readonly parentId: string;
  readonly name: string;
  readonly expectedRevision: number;
}

export interface CodeRepositoryCreateSnippetRequest {
  readonly parentId: string;
  readonly name: string;
  readonly code: string;
  readonly expectedRevision: number;
}

export interface CodeRepositoryMoveNodeRequest {
  readonly nodeId: string;
  readonly parentId: string;
  readonly order: number;
  readonly expectedRevision: number;
}

export interface CodeRepositoryUpdateNodeRequest {
  readonly nodeId: string;
  readonly name?: string;
  readonly code?: string;
  readonly expectedRevision: number;
}

export interface CodeRepositoryDeleteNodeRequest {
  readonly nodeId: string;
  readonly expectedRevision: number;
}

/**
 * The renderer supplies only its optimistic-lock token. The main process owns
 * the native file chooser and reads the selected XML itself.
 */
export interface CodeRepositoryImportFileRequest {
  readonly expectedRevision: number;
}

export interface CodeRepositoryImportResult {
  readonly snapshot: CodeRepositorySnapshot;
  readonly importedNodeCount: number;
  readonly sourceHash: string;
}

export interface CodeRepositoryExportResult {
  readonly xml: string;
  readonly format: 'java-blue-code-repository-v1';
}

export interface CodeRepositoryExportFileResult {
  /** File name only. Filesystem paths remain main-process owned. */
  readonly basename: string;
}

// Error envelope --------------------------------------------------------

export type CodeRepositoryErrorCode =
  | 'storage-unavailable'
  | 'invalid-tree'
  | 'revision-conflict'
  | 'invalid-legacy-xml'
  | 'source-unreadable'
  | 'export-failed'
  | 'not-initialized';

export interface CodeRepositoryError {
  readonly code: CodeRepositoryErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  /** Present for revision-conflict so the UI can recover without a re-fetch. */
  readonly currentSnapshot?: CodeRepositorySnapshot;
}

export type CodeRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CodeRepositoryError };

export function createCodeRepositoryError(
  code: CodeRepositoryErrorCode,
  message: string,
  retryable: boolean,
  currentSnapshot?: CodeRepositorySnapshot,
): CodeRepositoryError {
  return {
    code,
    message,
    retryable,
    ...(currentSnapshot ? { currentSnapshot } : {}),
  };
}

// Type guards (preload boundary validation) -----------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isCodeRepositoryNode(value: unknown): value is CodeRepositoryNode {
  return isPortableCodeRepositoryNode(value);
}

export function isCodeRepositorySnapshot(value: unknown): value is CodeRepositorySnapshot {
  if (!isObject(value)) return false;
  if (!isCodeRepositoryNode(value.root)) return false;
  if (
    value.root.kind !== 'root' ||
    value.root.id !== CODE_REPOSITORY_ROOT_ID ||
    value.root.parentId !== null
  ) {
    return false;
  }
  if (
    typeof value.contentRevision !== 'number' ||
    !Number.isInteger(value.contentRevision) ||
    value.contentRevision < 0
  ) {
    return false;
  }
  if (typeof value.initialized !== 'boolean') return false;
  return validateCodeRepositoryTree(value.root) === null;
}

export function isCodeRepositoryStatus(value: unknown): value is CodeRepositoryStatus {
  if (!isObject(value)) return false;
  if (typeof value.available !== 'boolean') return false;
  if (
    value.migrationStatus !== 'not-started' &&
    value.migrationStatus !== 'succeeded' &&
    value.migrationStatus !== 'failed' &&
    value.migrationStatus !== 'skipped'
  ) {
    return false;
  }
  if (value.diagnostic !== undefined) {
    if (!isObject(value.diagnostic)) return false;
    if (typeof value.diagnostic.code !== 'string' || value.diagnostic.code.length === 0)
      return false;
    if (typeof value.diagnostic.message !== 'string' || value.diagnostic.message.length === 0)
      return false;
    if (
      value.diagnostic.sourceLabel !== undefined &&
      (typeof value.diagnostic.sourceLabel !== 'string' ||
        value.diagnostic.sourceLabel.length === 0 ||
        /[\\/]/.test(value.diagnostic.sourceLabel))
    ) {
      return false;
    }
  }
  return true;
}

export function isCodeRepositoryError(value: unknown): value is CodeRepositoryError {
  if (!isObject(value)) return false;
  if (
    value.code !== 'storage-unavailable' &&
    value.code !== 'invalid-tree' &&
    value.code !== 'revision-conflict' &&
    value.code !== 'invalid-legacy-xml' &&
    value.code !== 'source-unreadable' &&
    value.code !== 'export-failed' &&
    value.code !== 'not-initialized'
  ) {
    return false;
  }
  if (typeof value.message !== 'string' || typeof value.retryable !== 'boolean') return false;
  return value.currentSnapshot === undefined || isCodeRepositorySnapshot(value.currentSnapshot);
}

/** Validate a success/failure envelope received from an untrusted IPC peer. */
export function isCodeRepositoryResult<T>(
  value: unknown,
  isSuccessValue: (candidate: unknown) => candidate is T,
): value is CodeRepositoryResult<T> {
  if (!isObject(value) || typeof value.ok !== 'boolean') return false;
  return value.ok ? isSuccessValue(value.value) : isCodeRepositoryError(value.error);
}

export function isCodeRepositoryImportResult(value: unknown): value is CodeRepositoryImportResult {
  if (!isObject(value)) return false;
  return (
    isCodeRepositorySnapshot(value.snapshot) &&
    typeof value.importedNodeCount === 'number' &&
    Number.isInteger(value.importedNodeCount) &&
    value.importedNodeCount >= 0 &&
    typeof value.sourceHash === 'string' &&
    value.sourceHash.length > 0
  );
}

export function isCodeRepositoryExportFileResult(
  value: unknown,
): value is CodeRepositoryExportFileResult {
  return (
    isObject(value) &&
    !('path' in value) &&
    typeof value.basename === 'string' &&
    value.basename.length > 0 &&
    !/[\\/]/.test(value.basename)
  );
}

export function isCodeRepositoryChangedEvent(value: unknown): value is CodeRepositoryChangedEvent {
  if (!isObject(value)) return false;
  if (
    typeof value.contentRevision !== 'number' ||
    !Number.isInteger(value.contentRevision) ||
    value.contentRevision < 0
  ) {
    return false;
  }
  if (value.reason !== 'commit' && value.reason !== 'import' && value.reason !== 'recovery') {
    return false;
  }
  return true;
}
