import type { LibraryEditorDocument, LibraryEditorDocumentPatch } from './library-editor-document';
import { isLibraryEditorDocument, isLibraryEditorDocumentPatch } from './library-editor-document';
import type { BsbWidgetNodeSnapshot } from './project-editor';

export const LIBRARY_TYPES = ['instrument', 'udo', 'soundObject', 'effect'] as const;

export type LibraryType = (typeof LIBRARY_TYPES)[number];
export type LibraryScopeKind = 'user' | 'projectOwned' | 'projectShared';
export type LibrarySupportStatus = 'supported' | 'unsupported';
export type LibraryServicePhase =
  | 'initializing'
  | 'migrating'
  | 'ready'
  | 'readOnlyFailure'
  | 'recovering'
  | 'stopped';
export type LegacyMigrationState = 'never' | 'completed' | 'skipped' | 'failed';

export interface InstrumentProjectLocator {
  readonly kind: 'instrument';
  readonly assignmentId: string;
}

export interface ProjectUdoLocator {
  readonly kind: 'udo';
  readonly instrumentAssignmentId?: string;
  readonly track?: { readonly rootGroupId: string; readonly trackId: string };
  readonly sessionObjectId: string;
  readonly persistedFingerprint: {
    readonly canonicalHash: string;
    readonly opcodeName: string;
    readonly style: 'CLASSIC' | 'MODERN';
  };
}

export interface SharedSoundObjectLocator {
  readonly kind: 'soundObject';
  readonly libraryId: string;
  readonly persistedFingerprint: {
    readonly canonicalHash: string;
    readonly displayName: string;
    readonly objectType: string;
  };
}

export interface ProjectEffectLocator {
  readonly kind: 'effect';
  readonly channelId: string;
  readonly chain: 'pre' | 'post';
  readonly entryId: string;
}

export type ProjectItemLocator =
  | InstrumentProjectLocator
  | ProjectUdoLocator
  | SharedSoundObjectLocator
  | ProjectEffectLocator;

export type LibraryItemKey =
  | {
      readonly scope: 'user';
      readonly libraryType: LibraryType;
      readonly nodeId: string;
    }
  | {
      readonly scope: 'projectOwned' | 'projectShared';
      readonly libraryType: LibraryType;
      readonly projectSessionId: number;
      readonly locator: ProjectItemLocator;
    };

export interface LibraryServiceOperationSnapshot {
  readonly kind: 'automaticMigration' | 'manualImport' | 'export' | 'upgrade' | 'recovery';
  readonly phase: string;
  readonly startedAt: string;
}

export interface CompatibilityReportSummary {
  readonly status: 'ready' | 'complete' | 'partial' | 'blocked' | 'failed' | 'cancelled';
  readonly message: string;
}

export interface LibraryFailureSnapshot {
  readonly kind: 'open' | 'integrity' | 'lock' | 'version' | 'upgrade' | 'worker';
  readonly message: string;
  readonly retryable: boolean;
}

export interface BsbCanvasClipboard {
  readonly widgets: BsbWidgetNodeSnapshot[];
  readonly originX: number;
  readonly originY: number;
}

export interface LibraryServiceSnapshot {
  readonly phase: LibraryServicePhase;
  readonly contentRevision: number;
  readonly migrationState: LegacyMigrationState;
  readonly userItemCounts: Record<LibraryType, number>;
  readonly projectSessionId: number | null;
  readonly writable: boolean;
  /** Main-owned active typed clipboard, shared by every renderer window. */
  readonly clipboard?: LibraryInteractionClipboard | null;
  /** Separate main-owned BSB widget buffer for detached instrument editors. */
  readonly bsbClipboard?: BsbCanvasClipboard | null;
  readonly operation?: LibraryServiceOperationSnapshot;
  readonly lastSummary?: CompatibilityReportSummary;
  readonly failure?: LibraryFailureSnapshot;
}

export interface LibraryChangedEvent {
  readonly contentRevision: number;
  readonly cause:
    | 'mutation'
    | 'itemSave'
    | 'import'
    | 'importUndo'
    | 'migration'
    | 'recovery'
    | 'projectChanged';
  readonly affectedKeys?: readonly LibraryItemKey[];
  readonly requiresFullRefresh: boolean;
}

export interface LibraryPreviewField<T = string> {
  readonly state: 'available' | 'unavailable';
  readonly value?: T;
  readonly reason?: string;
}

export interface LibraryBrowseNode {
  readonly key: LibraryItemKey | null;
  readonly nodeId: string;
  readonly parentId: string | null;
  readonly libraryType: LibraryType;
  readonly scope: LibraryScopeKind;
  readonly nodeKind: 'root' | 'folder' | 'item';
  readonly displayName: string;
  readonly breadcrumb: readonly string[];
  readonly supportStatus?: LibrarySupportStatus;
  readonly objectType?: string;
  readonly revision: number | string;
  readonly hasChildren: boolean;
}

export interface UserBrowseParent {
  readonly scope: 'user';
  readonly libraryType: LibraryType;
  readonly nodeId?: string;
}

export interface ProjectBrowseParent {
  readonly scope: 'projectOwned' | 'projectShared';
  readonly libraryType: LibraryType;
  readonly projectSessionId: number;
  readonly parentLocator?: Readonly<Record<string, string | number>>;
}

export interface BrowseLibraryRequest {
  readonly parent: UserBrowseParent | ProjectBrowseParent;
  readonly cursor?: string;
  readonly limit?: number;
  readonly expectedContentRevision?: number;
}

export interface BrowseLibraryResult {
  readonly contentRevision: number;
  readonly parent: LibraryBrowseNode;
  readonly children: readonly LibraryBrowseNode[];
  readonly nextCursor: string | null;
}

export interface SearchLibrariesRequest {
  readonly query: string;
  readonly typeFilter: 'all' | LibraryType;
  readonly projectSessionId: number | null;
  readonly cursor?: string;
  readonly limit?: number;
  readonly expectedContentRevision?: number;
}

export interface LibrarySearchResult {
  readonly key: LibraryItemKey;
  readonly parentId: string | null;
  readonly libraryType: LibraryType;
  readonly scope: LibraryScopeKind;
  readonly displayName: string;
  readonly breadcrumb: readonly string[];
  readonly supportStatus: LibrarySupportStatus;
  readonly objectType: string;
  readonly revision: number | string;
}

export interface SearchLibrariesResult {
  readonly contentRevision: number;
  readonly normalizedQuery: string;
  readonly results: readonly LibrarySearchResult[];
  readonly nextCursor: string | null;
}

export interface LibraryItemPreview {
  readonly key: LibraryItemKey;
  readonly displayName: string;
  readonly libraryType: LibraryType;
  readonly scope: LibraryScopeKind;
  readonly objectType: string;
  readonly supportStatus: LibrarySupportStatus;
  readonly supportMessage: string | null;
  readonly fields: Readonly<Record<string, LibraryPreviewField<string | number>>>;
  readonly dependencies: {
    readonly itemOwned: readonly string[];
    readonly unresolvedExternal: readonly string[];
  };
}

export type UserLibraryMutation =
  | {
      readonly type: 'createFolder';
      readonly libraryType: LibraryType;
      readonly parentId: string;
      readonly name: string;
      readonly insertIndex?: number;
    }
  | {
      readonly type: 'renameNode';
      readonly nodeId: string;
      readonly expectedRevision: number;
      readonly name: string;
    }
  | {
      readonly type: 'moveNode';
      readonly nodeId: string;
      readonly expectedRevision: number;
      readonly parentId: string;
      readonly expectedParentRevision?: number;
      readonly targetIndex: number;
    }
  | {
      readonly type: 'reorderNode';
      readonly nodeId: string;
      readonly expectedRevision: number;
      readonly targetIndex: number;
    }
  | {
      readonly type: 'duplicateNode';
      readonly nodeId: string;
      readonly expectedRevision: number;
      readonly parentId?: string;
      readonly expectedParentRevision?: number;
      readonly targetIndex?: number;
    }
  | {
      readonly type: 'deleteNode';
      readonly nodeId: string;
      readonly expectedRevision: number;
      readonly confirmation: string;
    };

export interface LibraryMutationReceipt {
  readonly contentRevision: number;
  readonly affectedNodes: readonly LibraryBrowseNode[];
  readonly closedEditorSessionIds?: readonly string[];
}

export interface PrepareLibraryMutationRequest {
  readonly type: 'deleteNode';
  readonly nodeId: string;
  readonly expectedRevision: number;
}

export interface LibraryMutationPreview {
  readonly confirmationToken: string;
  readonly nodeId: string;
  readonly expectedRevision: number;
  readonly affectedNodeIds: readonly string[];
  readonly affectedCount: number;
  readonly dirtyEditorSessionIds: readonly string[];
  readonly expiresAt: number;
}

export interface ScoreInsertionLocation {
  readonly rootGroupId: string;
  readonly containerPath: readonly { readonly layerId: string; readonly objectIdentity: string }[];
  readonly layerId: string;
  readonly startTime: number;
}

export type LibraryContextRequest =
  | { readonly type: 'browseType'; readonly libraryType: LibraryType }
  | { readonly type: 'instrumentTarget'; readonly projectSessionId: number }
  | {
      readonly type: 'trackInstrumentTarget';
      readonly projectSessionId: number;
      readonly rootGroupId: string;
      readonly trackId: string;
    }
  | { readonly type: 'udoTarget'; readonly projectSessionId: number }
  | {
      readonly type: 'effectTarget';
      readonly projectSessionId: number;
      readonly channelId: string;
      readonly chain: 'pre' | 'post';
      readonly insertIndex: number;
      readonly targetRevision: string;
    }
  | {
      readonly type: 'soundObjectTarget';
      readonly projectSessionId: number;
      readonly location: ScoreInsertionLocation;
      readonly targetRevision: string;
    };

export interface InsertionTargetSnapshot {
  readonly libraryType: LibraryType;
  readonly projectSessionId: number;
  readonly label: string;
  readonly valid: boolean;
  readonly invalidReason?: string;
  readonly targetRevision: string;
  readonly channelId?: string;
  readonly chain?: 'pre' | 'post';
  readonly insertIndex?: number;
  readonly instrumentAssignmentId?: string;
  readonly track?: { readonly rootGroupId: string; readonly trackId: string };
  readonly liveCell?: {
    readonly column: number;
    readonly row: number;
    readonly expectedLiveObjectId: string | null;
  };
  readonly location?: ScoreInsertionLocation;
  readonly destinationKind?:
    | 'score'
    | 'scoreBsbSound'
    | 'projectSoundObjectLibrary'
    | 'trackInstrument'
    | 'blueLive';
}

export interface LibraryContextSnapshot {
  readonly selectedType: LibraryType;
  readonly target: InsertionTargetSnapshot | null;
}

export type LibraryInsertionMode = 'independent' | 'sharedInstance';

export interface LibraryInsertionRequest {
  readonly key: LibraryItemKey;
  readonly mode?: LibraryInsertionMode;
}

export interface LibraryDragDescriptor {
  readonly dragSessionId: string;
  readonly libraryType: LibraryType;
  readonly sourceScope?: LibraryScopeKind;
}

export interface BeginLibraryDragRequest {
  readonly dragSessionId: string;
  readonly key: LibraryItemKey;
  readonly revision: number | string;
}

export type LibraryTransferSourceReference =
  | { readonly kind: 'drag'; readonly dragSessionId: string }
  | { readonly kind: 'clipboard'; readonly source: LibraryTransferSource };

export type CapturableLibraryTransferSource =
  | {
      readonly kind: 'library';
      readonly key: LibraryItemKey;
      readonly revision: number | string;
    }
  | {
      readonly kind: 'userNode';
      readonly libraryType: LibraryType;
      readonly nodeId: string;
      readonly revision: number;
    };

export type LibraryTransferSource =
  | CapturableLibraryTransferSource
  | {
      readonly kind: 'buffer';
      readonly clipboardId: string;
      readonly libraryType: LibraryType;
    };

export function getLibraryTransferSourceType(source: LibraryTransferSource): LibraryType {
  return source.kind === 'library' ? source.key.libraryType : source.libraryType;
}

export interface LibraryInteractionClipboard {
  readonly operation: 'copy' | 'cut';
  readonly source: LibraryTransferSource;
  readonly capturedAt: number;
  readonly objectType?: string;
}

export interface CutLibraryToClipboardRequest {
  readonly source: CapturableLibraryTransferSource;
  readonly confirmationToken: string;
}

export interface CutLibraryToClipboardResult {
  readonly clipboard: LibraryInteractionClipboard;
  readonly closedEditorSessionIds: readonly string[];
}

export interface ScoreTimelineSoundObjectRequest {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly location: {
    readonly rootGroupIndex: number;
    readonly containerPath: readonly {
      readonly layerIndex: number;
      readonly objectIndex: number;
    }[];
    readonly layerIndex: number;
    readonly objectIndex: number;
  };
}

export interface TrackInstrumentClipboardRequest {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly rootGroupId: string;
  readonly trackId: string;
}

export interface BlueLiveSoundObjectClipboardRequest {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly liveObjectId: string;
}

interface ExactProjectTargetBase {
  readonly projectSessionId: number;
  readonly projectRevision: number;
}

export type LibraryExactTransferTarget =
  | (ExactProjectTargetBase & {
      readonly kind: 'orchestra';
      readonly insertIndex: number;
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'trackInstrument';
      readonly track: { readonly rootGroupId: string; readonly trackId: string };
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'blueLive';
      readonly liveCell: {
        readonly column: number;
        readonly row: number;
        readonly expectedLiveObjectId: string | null;
      };
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'projectUdo';
      readonly insertIndex: number;
      readonly instrumentAssignmentId?: string;
      readonly track?: { readonly rootGroupId: string; readonly trackId: string };
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'effectChain';
      readonly channelId: string;
      readonly chain: 'pre' | 'post';
      readonly insertIndex: number;
      readonly chainRevision: string;
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'score';
      readonly location: ScoreInsertionLocation;
      readonly timeContextRevision: string;
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'scoreBsbSound';
      readonly location: ScoreInsertionLocation;
      readonly timeContextRevision: string;
    })
  | (ExactProjectTargetBase & {
      readonly kind: 'projectSoundObjectLibrary';
    });

function parsePositiveArrangementId(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/u.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function getAvailableNumericArrangementId(
  assignmentIds: readonly string[],
  insertIndex: number,
): string | null {
  if (!Number.isInteger(insertIndex) || insertIndex < 0 || insertIndex > assignmentIds.length) {
    return null;
  }

  const numericIds = assignmentIds
    .map(parsePositiveArrangementId)
    .filter((value): value is number => value !== null);
  const used = new Set(numericIds);

  if (insertIndex === assignmentIds.length) {
    const max = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    return max < Number.MAX_SAFE_INTEGER ? String(max + 1) : null;
  }

  const next = parsePositiveArrangementId(assignmentIds[insertIndex]!);
  if (next === null) return null;
  const previous =
    insertIndex === 0 ? 0 : parsePositiveArrangementId(assignmentIds[insertIndex - 1]!);
  if (previous === null) return null;

  let candidate = previous + 1;
  while (candidate < next && used.has(candidate)) candidate += 1;
  return candidate < next ? String(candidate) : null;
}

export interface LibraryTransferPreviewRequest {
  readonly source: LibraryTransferSourceReference;
  readonly target: LibraryExactTransferTarget;
  readonly mode?: LibraryInsertionMode;
}

export interface LibraryTransferPreview {
  readonly previewToken: string;
  readonly item: LibraryItemPreview;
  readonly target: LibraryExactTransferTarget;
  readonly requestedMode: LibraryInsertionMode;
  readonly allowedModes: readonly LibraryInsertionMode[];
  readonly canApply: boolean;
  readonly blockingReasons: readonly string[];
}

export interface LibraryInsertionPreview {
  readonly previewToken: string;
  readonly item: LibraryItemPreview;
  readonly target: InsertionTargetSnapshot;
  readonly requestedMode: LibraryInsertionMode;
  readonly allowedModes: readonly LibraryInsertionMode[];
  readonly canApply: boolean;
  readonly blockingReasons: readonly string[];
}

export interface ConfirmedLibraryInsertionRequest {
  readonly previewToken: string;
}

export interface ProjectMutationReceipt {
  readonly projectSessionId: number;
  readonly projectRevision: number;
  readonly libraryType: LibraryType;
  readonly insertedIdentity: string;
  readonly message: string;
  /** Editor sessions closed because their project-library definition was removed. */
  readonly closedEditorSessionIds?: readonly string[];
}

export type LibraryEditorSessionStatus = 'ready' | 'conflict' | 'missing';

export interface LibraryEditorSessionSnapshot {
  readonly sessionId: string;
  readonly key: LibraryItemKey;
  readonly displayName: string;
  readonly objectType: string;
  readonly breadcrumb: readonly string[];
  readonly baseRevision: number | string;
  readonly document: LibraryEditorDocument;
  readonly dirty: boolean;
  readonly pinned: boolean;
  readonly status: LibraryEditorSessionStatus;
}

export interface OpenLibraryEditorRequest {
  readonly key: LibraryItemKey;
  readonly pinned?: boolean;
}

export interface LibraryEditorPatchRequest {
  readonly sessionId: string;
  readonly documentPatch?: LibraryEditorDocumentPatch;
  readonly displayName?: string;
  readonly pinned?: boolean;
}

export type LibraryEditorConflictDecision = 'reloadLatest' | 'overwrite' | 'cancel';

export interface LibraryEditorConflictRequest {
  readonly sessionId: string;
  readonly decision: LibraryEditorConflictDecision;
}

export type LibraryEditorSaveResult =
  | { readonly status: 'saved'; readonly session: LibraryEditorSessionSnapshot }
  | { readonly status: 'conflict'; readonly session: LibraryEditorSessionSnapshot }
  | { readonly status: 'missing'; readonly session: LibraryEditorSessionSnapshot };

export interface LibraryDraftShutdownPreview {
  readonly reason: 'quit' | 'closeProject' | 'switchProject';
  readonly dirtySessionIds: readonly string[];
  readonly mayContinue: boolean;
}

export interface ProjectLibraryUsage {
  readonly linkedInstanceCount: number;
  readonly locations: readonly string[];
}

export interface ProjectLibraryDeletePreview extends ProjectLibraryUsage {
  readonly confirmationToken: string;
  readonly requiresConfirmation: boolean;
}

export interface ManualImportSourcePreview {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly libraryType: LibraryType | null;
  readonly folderCount: number;
  readonly itemCount: number;
  readonly unsupportedCount: number;
  readonly exactDuplicateCount: number;
  readonly aliasConflictCount: number;
  readonly ambiguousFolderCount: number;
  readonly folderConflicts: readonly ManualImportFolderConflict[];
  readonly error?: string;
}

export interface ManualImportFolderConflict {
  readonly conflictId: string;
  readonly sourceBreadcrumb: readonly string[];
  readonly candidates: readonly {
    readonly nodeId: string;
    readonly breadcrumb: readonly string[];
  }[];
}

export interface ManualLibraryImportPreview {
  readonly previewToken: string;
  readonly expiresAt: number;
  readonly sources: readonly ManualImportSourcePreview[];
}

export interface ManualLibraryImportExecutionRequest {
  readonly previewToken: string;
  readonly folderSelections: Readonly<Record<string, string>>;
}

export interface ManualLibraryImportResult {
  readonly batchId: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly createdNodeCount: number;
  readonly exactDuplicateCount: number;
  readonly aliasCount: number;
}

export interface CopyProjectLibraryItemRequest {
  readonly key: LibraryItemKey;
  readonly parentId: string;
}

export interface CopyLibraryTransferToUserRequest {
  readonly source: LibraryTransferSourceReference;
  readonly parentId: string;
}

export interface LibraryCursorPayload {
  readonly kind: 'browse' | 'search' | 'history';
  readonly contentRevision: number;
  readonly offset: number;
  readonly signature: string;
}

export type LibraryServiceErrorCode =
  | 'invalid-request'
  | 'service-not-ready'
  | 'read-only'
  | 'not-found'
  | 'unsupported'
  | 'invalid-name'
  | 'invalid-move'
  | 'stale-revision'
  | 'stale-cursor'
  | 'stale-project-session'
  | 'stale-target'
  | 'dependency-conflict'
  | 'validation-failed'
  | 'editor-conflict'
  | 'operation-in-progress'
  | 'preview-expired'
  | 'source-changed'
  | 'undo-unavailable'
  | 'compatibility-blocked'
  | 'cancelled'
  | 'storage-failure'
  | 'recovery-required';

export interface LibraryServiceError {
  readonly code: LibraryServiceErrorCode;
  readonly message: string;
  readonly field?: string;
  readonly retryable: boolean;
  readonly detail?: Readonly<Record<string, string | number | boolean | null>>;
}

export type LibraryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LibraryServiceError };

export const UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL = 'unified-library:get-snapshot';
export const UNIFIED_LIBRARY_BROWSE_CHANNEL = 'unified-library:browse';
export const UNIFIED_LIBRARY_SEARCH_CHANNEL = 'unified-library:search';
export const UNIFIED_LIBRARY_PREVIEW_CHANNEL = 'unified-library:preview';
export const UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL = 'unified-library:begin-drag';
export const UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL = 'unified-library:cancel-drag';
export const UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL = 'unified-library:preview-transfer';
export const UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL = 'unified-library:apply-transfer';
export const UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL = 'unified-library:set-context';
export const UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL = 'unified-library:clear-target';
export const UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL = 'unified-library:preview-insertion';
export const UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL = 'unified-library:apply-insertion';
export const UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL = 'unified-library:context-changed';
export const UNIFIED_LIBRARY_MUTATE_CHANNEL = 'unified-library:mutate';
export const UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL = 'unified-library:prepare-mutation';
export const UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL = 'unified-library:cut-to-clipboard';
export const UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL = 'unified-library:set-clipboard';
export const UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL = 'unified-library:set-bsb-clipboard';
export const UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL =
  'unified-library:capture-score-sound-object';
export const UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL =
  'unified-library:capture-track-instrument';
export const UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL =
  'unified-library:capture-blue-live-sound-object';
export const UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL =
  'unified-library:add-score-sound-object';
export const UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL = 'unified-library:editor-open';
export const UNIFIED_LIBRARY_EDITOR_GET_CHANNEL = 'unified-library:editor-get';
export const UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL = 'unified-library:editor-patch';
export const UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL = 'unified-library:editor-save';
export const UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL = 'unified-library:editor-revert';
export const UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL =
  'unified-library:editor-resolve-conflict';
export const UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL = 'unified-library:editor-close';
export const UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL = 'unified-library:editor-changed';
export const UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL = 'unified-library:draft-shutdown';
export const UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL = 'unified-library:draft-resolve';
export const UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL = 'unified-library:project-usage';
export const UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL =
  'unified-library:project-delete-preview';
export const UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL = 'unified-library:project-delete';
export const UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL = 'unified-library:transfer-to-user';
export const UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL = 'unified-library:import-select';
export const UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL = 'unified-library:import-directory';
export const UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL = 'unified-library:import-execute';
export const UNIFIED_LIBRARY_IMPORT_INSTRUMENT_CHANNEL = 'unified-library:import-instrument';
export const UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL = 'unified-library:export-current';
export const UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL = 'unified-library:export-all';
export const UNIFIED_LIBRARY_EXPORT_INSTRUMENT_CHANNEL = 'unified-library:export-instrument';
export const UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL = 'unified-library:recovery-retry';
export const UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL = 'unified-library:recovery-restore';
export const UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL = 'unified-library:recovery-fresh';
export const UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL = 'unified-library:snapshot-changed';
export const UNIFIED_LIBRARY_CHANGED_CHANNEL = 'unified-library:changed';

const SERVICE_PHASES: readonly LibraryServicePhase[] = [
  'initializing',
  'migrating',
  'ready',
  'readOnlyFailure',
  'recovering',
  'stopped',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function hasOptionalBoundedLimit(value: unknown): boolean {
  return value === undefined || (isNonNegativeInteger(value) && value > 0 && value <= 500);
}

export function isLibraryType(value: unknown): value is LibraryType {
  return typeof value === 'string' && (LIBRARY_TYPES as readonly string[]).includes(value);
}

export function isLibraryDragDescriptor(value: unknown): value is LibraryDragDescriptor {
  if (!isRecord(value)) return false;
  return (
    Object.keys(value).every(
      (key) => key === 'dragSessionId' || key === 'libraryType' || key === 'sourceScope',
    ) &&
    isNonEmptyString(value.dragSessionId) &&
    isLibraryType(value.libraryType) &&
    (value.sourceScope === undefined ||
      value.sourceScope === 'user' ||
      value.sourceScope === 'projectOwned' ||
      value.sourceScope === 'projectShared')
  );
}

export function isBeginLibraryDragRequest(value: unknown): value is BeginLibraryDragRequest {
  return (
    isRecord(value) &&
    isNonEmptyString(value.dragSessionId) &&
    isLibraryItemKey(value.key) &&
    (isNonNegativeInteger(value.revision) || isNonEmptyString(value.revision))
  );
}

export function isLibraryTransferSource(value: unknown): value is LibraryTransferSource {
  if (!isRecord(value)) return false;
  if (value.kind === 'library') {
    return (
      isLibraryItemKey(value.key) &&
      (isNonNegativeInteger(value.revision) || isNonEmptyString(value.revision))
    );
  }
  if (value.kind === 'buffer') {
    return isNonEmptyString(value.clipboardId) && isLibraryType(value.libraryType);
  }
  return (
    value.kind === 'userNode' &&
    isLibraryType(value.libraryType) &&
    isNonEmptyString(value.nodeId) &&
    isNonNegativeInteger(value.revision)
  );
}

export function isCutLibraryToClipboardRequest(
  value: unknown,
): value is CutLibraryToClipboardRequest {
  if (!isRecord(value) || !isNonEmptyString(value.confirmationToken)) return false;
  return isLibraryTransferSource(value.source) && value.source.kind !== 'buffer';
}

export function isScoreTimelineSoundObjectRequest(
  value: unknown,
): value is ScoreTimelineSoundObjectRequest {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.projectSessionId) ||
    !isNonNegativeInteger(value.projectRevision) ||
    !isRecord(value.location) ||
    !isNonNegativeInteger(value.location.rootGroupIndex) ||
    !isNonNegativeInteger(value.location.layerIndex) ||
    !isNonNegativeInteger(value.location.objectIndex) ||
    !Array.isArray(value.location.containerPath)
  )
    return false;
  return value.location.containerPath.every(
    (segment) =>
      isRecord(segment) &&
      isNonNegativeInteger(segment.layerIndex) &&
      isNonNegativeInteger(segment.objectIndex),
  );
}

export function isTrackInstrumentClipboardRequest(
  value: unknown,
): value is TrackInstrumentClipboardRequest {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.projectSessionId) &&
    isNonNegativeInteger(value.projectRevision) &&
    isNonEmptyString(value.rootGroupId) &&
    isNonEmptyString(value.trackId)
  );
}

export function isBlueLiveSoundObjectClipboardRequest(
  value: unknown,
): value is BlueLiveSoundObjectClipboardRequest {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.projectSessionId) &&
    isNonNegativeInteger(value.projectRevision) &&
    isNonEmptyString(value.liveObjectId)
  );
}

export function isLibraryInteractionClipboard(
  value: unknown,
): value is LibraryInteractionClipboard {
  return (
    isRecord(value) &&
    (value.operation === 'copy' || value.operation === 'cut') &&
    isLibraryTransferSource(value.source) &&
    typeof value.capturedAt === 'number' &&
    Number.isFinite(value.capturedAt) &&
    value.capturedAt >= 0 &&
    (value.objectType === undefined || typeof value.objectType === 'string')
  );
}

export function isLibraryExactTransferTarget(value: unknown): value is LibraryExactTransferTarget {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.projectSessionId) ||
    !isNonNegativeInteger(value.projectRevision) ||
    typeof value.kind !== 'string'
  )
    return false;
  if (value.kind === 'orchestra') {
    return isNonNegativeInteger(value.insertIndex);
  }
  if (value.kind === 'trackInstrument') {
    return (
      isRecord(value.track) &&
      isNonEmptyString(value.track.rootGroupId) &&
      isNonEmptyString(value.track.trackId)
    );
  }
  if (value.kind === 'blueLive') {
    return (
      isRecord(value.liveCell) &&
      isNonNegativeInteger(value.liveCell.column) &&
      isNonNegativeInteger(value.liveCell.row) &&
      (value.liveCell.expectedLiveObjectId === null ||
        isNonEmptyString(value.liveCell.expectedLiveObjectId))
    );
  }
  if (value.kind === 'projectUdo') {
    const hasInstrumentOwner = value.instrumentAssignmentId !== undefined;
    const hasTrackOwner = value.track !== undefined;
    return (
      isNonNegativeInteger(value.insertIndex) &&
      (value.instrumentAssignmentId === undefined ||
        isNonEmptyString(value.instrumentAssignmentId)) &&
      (value.track === undefined ||
        (isRecord(value.track) &&
          isNonEmptyString(value.track.rootGroupId) &&
          isNonEmptyString(value.track.trackId))) &&
      !(hasInstrumentOwner && hasTrackOwner)
    );
  }
  if (value.kind === 'effectChain') {
    return (
      isNonEmptyString(value.channelId) &&
      (value.chain === 'pre' || value.chain === 'post') &&
      isNonNegativeInteger(value.insertIndex) &&
      typeof value.chainRevision === 'string'
    );
  }
  if (value.kind === 'score' || value.kind === 'scoreBsbSound') {
    return (
      isRecord(value.location) &&
      isNonEmptyString(value.location.rootGroupId) &&
      Array.isArray(value.location.containerPath) &&
      isNonEmptyString(value.location.layerId) &&
      typeof value.location.startTime === 'number' &&
      Number.isFinite(value.location.startTime) &&
      isNonEmptyString(value.timeContextRevision)
    );
  }
  if (value.kind === 'projectSoundObjectLibrary') return true;
  return false;
}

export function isLibraryTransferSourceReference(
  value: unknown,
): value is LibraryTransferSourceReference {
  if (!isRecord(value)) return false;
  return value.kind === 'drag'
    ? isNonEmptyString(value.dragSessionId)
    : value.kind === 'clipboard' && isLibraryTransferSource(value.source);
}

export function isLibraryTransferPreviewRequest(
  value: unknown,
): value is LibraryTransferPreviewRequest {
  return (
    isRecord(value) &&
    isLibraryTransferSourceReference(value.source) &&
    isLibraryExactTransferTarget(value.target) &&
    (value.mode === undefined || value.mode === 'independent' || value.mode === 'sharedInstance')
  );
}

export function isLibraryServicePhase(value: unknown): value is LibraryServicePhase {
  return typeof value === 'string' && (SERVICE_PHASES as readonly string[]).includes(value);
}

function isBsbClipboardWidget(value: unknown): value is BsbWidgetNodeSnapshot {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    typeof value.type !== 'string' ||
    typeof value.objectName !== 'string' ||
    typeof value.x !== 'number' ||
    !Number.isFinite(value.x) ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.y) ||
    typeof value.width !== 'number' ||
    !Number.isFinite(value.width) ||
    typeof value.height !== 'number' ||
    !Number.isFinite(value.height) ||
    typeof value.value !== 'number' ||
    !Number.isFinite(value.value) ||
    typeof value.minimum !== 'number' ||
    !Number.isFinite(value.minimum) ||
    typeof value.maximum !== 'number' ||
    !Number.isFinite(value.maximum) ||
    typeof value.editable !== 'boolean' ||
    !isRecord(value.properties)
  )
    return false;
  return (
    value.children === undefined ||
    (Array.isArray(value.children) && value.children.every(isBsbClipboardWidget))
  );
}

export function isBsbCanvasClipboard(value: unknown): value is BsbCanvasClipboard {
  return (
    isRecord(value) &&
    typeof value.originX === 'number' &&
    Number.isFinite(value.originX) &&
    typeof value.originY === 'number' &&
    Number.isFinite(value.originY) &&
    Array.isArray(value.widgets) &&
    value.widgets.length > 0 &&
    value.widgets.every(isBsbClipboardWidget)
  );
}

export function isLibraryServiceSnapshot(value: unknown): value is LibraryServiceSnapshot {
  if (!isRecord(value) || !isLibraryServicePhase(value.phase)) return false;
  if (!isNonNegativeInteger(value.contentRevision)) return false;
  if (
    value.migrationState !== 'never' &&
    value.migrationState !== 'completed' &&
    value.migrationState !== 'skipped' &&
    value.migrationState !== 'failed'
  )
    return false;
  const itemCounts = value.userItemCounts;
  if (!isRecord(itemCounts)) return false;
  if (!LIBRARY_TYPES.every((type) => isNonNegativeInteger(itemCounts[type]))) {
    return false;
  }
  return (
    (value.projectSessionId === null || isNonNegativeInteger(value.projectSessionId)) &&
    typeof value.writable === 'boolean' &&
    (value.clipboard === undefined ||
      value.clipboard === null ||
      isLibraryInteractionClipboard(value.clipboard)) &&
    (value.bsbClipboard === undefined ||
      value.bsbClipboard === null ||
      isBsbCanvasClipboard(value.bsbClipboard))
  );
}

export function isLibraryChangedEvent(value: unknown): value is LibraryChangedEvent {
  if (!isRecord(value) || !isNonNegativeInteger(value.contentRevision)) return false;
  if (typeof value.requiresFullRefresh !== 'boolean') return false;
  return (
    value.cause === 'mutation' ||
    value.cause === 'itemSave' ||
    value.cause === 'import' ||
    value.cause === 'importUndo' ||
    value.cause === 'migration' ||
    value.cause === 'recovery' ||
    value.cause === 'projectChanged'
  );
}

export function isProjectItemLocator(value: unknown): value is ProjectItemLocator {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'instrument') return isNonEmptyString(value.assignmentId);
  if (value.kind === 'udo') {
    const hasInstrumentOwner = value.instrumentAssignmentId !== undefined;
    const hasTrackOwner = value.track !== undefined;
    return (
      isNonEmptyString(value.sessionObjectId) &&
      (value.instrumentAssignmentId === undefined ||
        isNonEmptyString(value.instrumentAssignmentId)) &&
      (value.track === undefined ||
        (isRecord(value.track) &&
          isNonEmptyString(value.track.rootGroupId) &&
          isNonEmptyString(value.track.trackId))) &&
      !(hasInstrumentOwner && hasTrackOwner) &&
      isRecord(value.persistedFingerprint) &&
      isNonEmptyString(value.persistedFingerprint.canonicalHash) &&
      isNonEmptyString(value.persistedFingerprint.opcodeName) &&
      (value.persistedFingerprint.style === 'CLASSIC' ||
        value.persistedFingerprint.style === 'MODERN')
    );
  }
  if (value.kind === 'soundObject') {
    return (
      isNonEmptyString(value.libraryId) &&
      isRecord(value.persistedFingerprint) &&
      isNonEmptyString(value.persistedFingerprint.canonicalHash) &&
      isNonEmptyString(value.persistedFingerprint.displayName) &&
      isNonEmptyString(value.persistedFingerprint.objectType)
    );
  }
  if (value.kind === 'effect') {
    return (
      isNonEmptyString(value.channelId) &&
      (value.chain === 'pre' || value.chain === 'post') &&
      isNonEmptyString(value.entryId)
    );
  }
  return false;
}

export function isLibraryItemKey(value: unknown): value is LibraryItemKey {
  if (!isRecord(value) || !isLibraryType(value.libraryType)) return false;
  if (value.scope === 'user') return isNonEmptyString(value.nodeId);
  if (value.scope !== 'projectOwned' && value.scope !== 'projectShared') return false;
  if (!isNonNegativeInteger(value.projectSessionId) || !isProjectItemLocator(value.locator))
    return false;
  return (
    (value.libraryType === 'instrument' && value.locator.kind === 'instrument') ||
    (value.libraryType === 'udo' && value.locator.kind === 'udo') ||
    (value.libraryType === 'soundObject' && value.locator.kind === 'soundObject') ||
    (value.libraryType === 'effect' && value.locator.kind === 'effect')
  );
}

export function isBrowseLibraryRequest(value: unknown): value is BrowseLibraryRequest {
  if (!isRecord(value) || !isRecord(value.parent) || !hasOptionalBoundedLimit(value.limit)) {
    return false;
  }
  if (value.cursor !== undefined && typeof value.cursor !== 'string') return false;
  if (
    value.expectedContentRevision !== undefined &&
    !isNonNegativeInteger(value.expectedContentRevision)
  )
    return false;

  const parent = value.parent;
  if (!isLibraryType(parent.libraryType)) return false;
  if (parent.scope === 'user') {
    return parent.nodeId === undefined || isNonEmptyString(parent.nodeId);
  }
  return (
    (parent.scope === 'projectOwned' || parent.scope === 'projectShared') &&
    isNonNegativeInteger(parent.projectSessionId)
  );
}

export function isSearchLibrariesRequest(value: unknown): value is SearchLibrariesRequest {
  if (!isRecord(value) || typeof value.query !== 'string') return false;
  if (value.typeFilter !== 'all' && !isLibraryType(value.typeFilter)) return false;
  if (value.projectSessionId !== null && !isNonNegativeInteger(value.projectSessionId))
    return false;
  if (value.cursor !== undefined && typeof value.cursor !== 'string') return false;
  if (!hasOptionalBoundedLimit(value.limit)) return false;
  return (
    value.expectedContentRevision === undefined ||
    isNonNegativeInteger(value.expectedContentRevision)
  );
}

export function isLibraryContextRequest(value: unknown): value is LibraryContextRequest {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'browseType') return isLibraryType(value.libraryType);
  if (value.type === 'instrumentTarget' || value.type === 'udoTarget') {
    return isNonNegativeInteger(value.projectSessionId);
  }
  if (value.type === 'trackInstrumentTarget') {
    return (
      isNonNegativeInteger(value.projectSessionId) &&
      isNonEmptyString(value.rootGroupId) &&
      isNonEmptyString(value.trackId)
    );
  }
  if (value.type === 'effectTarget') {
    return (
      isNonNegativeInteger(value.projectSessionId) &&
      isNonEmptyString(value.channelId) &&
      (value.chain === 'pre' || value.chain === 'post') &&
      isNonNegativeInteger(value.insertIndex) &&
      isNonEmptyString(value.targetRevision)
    );
  }
  if (value.type === 'soundObjectTarget') {
    return (
      isNonNegativeInteger(value.projectSessionId) &&
      isRecord(value.location) &&
      isNonEmptyString(value.location.rootGroupId) &&
      Array.isArray(value.location.containerPath) &&
      isNonEmptyString(value.location.layerId) &&
      typeof value.location.startTime === 'number' &&
      Number.isFinite(value.location.startTime) &&
      isNonEmptyString(value.targetRevision)
    );
  }
  return false;
}

export function isLibraryInsertionRequest(value: unknown): value is LibraryInsertionRequest {
  return (
    isRecord(value) &&
    isLibraryItemKey(value.key) &&
    (value.mode === undefined || value.mode === 'independent' || value.mode === 'sharedInstance')
  );
}

export function isConfirmedLibraryInsertionRequest(
  value: unknown,
): value is ConfirmedLibraryInsertionRequest {
  return isRecord(value) && isNonEmptyString(value.previewToken);
}

export function isUserLibraryMutation(value: unknown): value is UserLibraryMutation {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'createFolder') {
    return (
      isLibraryType(value.libraryType) &&
      isNonEmptyString(value.parentId) &&
      typeof value.name === 'string' &&
      (value.insertIndex === undefined || isNonNegativeInteger(value.insertIndex))
    );
  }
  if (!isNonEmptyString(value.nodeId) || !isNonNegativeInteger(value.expectedRevision)) {
    return false;
  }
  if (value.type === 'renameNode') return typeof value.name === 'string';
  if (value.type === 'moveNode') {
    return (
      isNonEmptyString(value.parentId) &&
      (value.expectedParentRevision === undefined ||
        isNonNegativeInteger(value.expectedParentRevision)) &&
      (value.targetIndex === undefined || isNonNegativeInteger(value.targetIndex))
    );
  }
  if (value.type === 'reorderNode') return isNonNegativeInteger(value.targetIndex);
  if (value.type === 'duplicateNode') {
    return (
      (value.parentId === undefined || isNonEmptyString(value.parentId)) &&
      (value.expectedParentRevision === undefined ||
        isNonNegativeInteger(value.expectedParentRevision)) &&
      (value.targetIndex === undefined || isNonNegativeInteger(value.targetIndex))
    );
  }
  return value.type === 'deleteNode' && typeof value.confirmation === 'string';
}

export function isPrepareLibraryMutationRequest(
  value: unknown,
): value is PrepareLibraryMutationRequest {
  return (
    isRecord(value) &&
    value.type === 'deleteNode' &&
    isNonEmptyString(value.nodeId) &&
    isNonNegativeInteger(value.expectedRevision)
  );
}

export function isOpenLibraryEditorRequest(value: unknown): value is OpenLibraryEditorRequest {
  return (
    isRecord(value) &&
    isLibraryItemKey(value.key) &&
    (value.pinned === undefined || typeof value.pinned === 'boolean')
  );
}

export function isLibraryEditorPatchRequest(value: unknown): value is LibraryEditorPatchRequest {
  return (
    isRecord(value) &&
    isNonEmptyString(value.sessionId) &&
    (value.documentPatch === undefined || isLibraryEditorDocumentPatch(value.documentPatch)) &&
    (value.displayName === undefined || typeof value.displayName === 'string') &&
    (value.pinned === undefined || typeof value.pinned === 'boolean')
  );
}

export function isLibraryEditorConflictRequest(
  value: unknown,
): value is LibraryEditorConflictRequest {
  return (
    isRecord(value) &&
    isNonEmptyString(value.sessionId) &&
    (value.decision === 'reloadLatest' ||
      value.decision === 'overwrite' ||
      value.decision === 'cancel')
  );
}

export function isLibraryEditorSessionSnapshot(
  value: unknown,
): value is LibraryEditorSessionSnapshot {
  return (
    isRecord(value) &&
    isNonEmptyString(value.sessionId) &&
    isLibraryItemKey(value.key) &&
    typeof value.displayName === 'string' &&
    typeof value.objectType === 'string' &&
    Array.isArray(value.breadcrumb) &&
    value.breadcrumb.every((part) => typeof part === 'string') &&
    (typeof value.baseRevision === 'number' || typeof value.baseRevision === 'string') &&
    isLibraryEditorDocument(value.document) &&
    typeof value.dirty === 'boolean' &&
    typeof value.pinned === 'boolean' &&
    (value.status === 'ready' || value.status === 'conflict' || value.status === 'missing')
  );
}

export function createLibraryCursor(payload: LibraryCursorPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseLibraryCursor(value: string): LibraryCursorPayload | null {
  if (value.length === 0 || value.length > 4096) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!isRecord(parsed)) return null;
    if (parsed.kind !== 'browse' && parsed.kind !== 'search' && parsed.kind !== 'history') {
      return null;
    }
    if (
      !isNonNegativeInteger(parsed.contentRevision) ||
      !isNonNegativeInteger(parsed.offset) ||
      typeof parsed.signature !== 'string' ||
      parsed.signature.length > 512
    )
      return null;
    return {
      kind: parsed.kind,
      contentRevision: parsed.contentRevision,
      offset: parsed.offset,
      signature: parsed.signature,
    };
  } catch {
    return null;
  }
}

export function createLibraryServiceError(
  code: LibraryServiceErrorCode,
  message: string,
  retryable: boolean,
  options: Pick<LibraryServiceError, 'field' | 'detail'> = {},
): LibraryServiceError {
  const boundedMessage = message.slice(0, 1000);
  return {
    code,
    message: boundedMessage,
    retryable,
    ...(options.field ? { field: options.field } : {}),
    ...(options.detail ? { detail: options.detail } : {}),
  };
}
