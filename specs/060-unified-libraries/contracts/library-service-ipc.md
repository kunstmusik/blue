# Contract: Unified Library Service IPC

## Purpose

Define the only renderer boundary for user-library persistence, project-source composition, editor sessions, import/export, migration, and recovery. Shared declarations live in `packages/blue-app/src/shared/unified-library.ts` and contain no Electron, Node, SQL, or filesystem imports. Preload exposes named methods through `window.blueAPI`; renderers never invoke arbitrary channels or receive database handles/paths they can operate on directly.

All calls return Promises. Main validates every unknown IPC payload with shared runtime guards before consulting service state.

## Service Status

```ts
type LibraryServicePhase =
  | 'initializing'
  | 'migrating'
  | 'ready'
  | 'readOnlyFailure'
  | 'recovering'
  | 'stopped';

interface LibraryServiceSnapshot {
  phase: LibraryServicePhase;
  contentRevision: number;
  migrationState: 'never' | 'completed' | 'skipped' | 'failed';
  userItemCounts: Record<LibraryType, number>;
  projectSessionId: number | null;
  writable: boolean;
  operation?: {
    kind: 'automaticMigration' | 'manualImport' | 'export' | 'upgrade' | 'recovery';
    phase: string;
    startedAt: string;
  };
  lastSummary?: CompatibilityReportSummary;
  failure?: LibraryFailureSnapshot;
}
```

Methods:

```ts
getLibraryServiceSnapshot(): Promise<LibraryServiceSnapshot>
onLibraryServiceSnapshot(callback): () => void
onLibraryChanged(callback): () => void
```

`onLibraryChanged` publishes monotonically ordered events:

```ts
interface LibraryChangedEvent {
  contentRevision: number;
  cause:
    | 'mutation'
    | 'itemSave'
    | 'import'
    | 'importUndo'
    | 'migration'
    | 'recovery'
    | 'projectChanged';
  affectedKeys?: LibraryItemKey[];
  requiresFullRefresh: boolean;
}
```

The renderer ignores an event older than the revision it has already applied. `projectChanged` may leave the user-library revision unchanged but invalidates project scopes and targets.

## Browse And Search

### Item keys

```ts
type LibraryItemKey =
  | { scope: 'user'; libraryType: LibraryType; nodeId: string }
  | {
      scope: 'projectOwned' | 'projectShared';
      libraryType: 'instrument' | 'udo' | 'soundObject';
      projectSessionId: number;
      locator: ProjectItemLocator;
    };
```

### Browse request

```ts
interface BrowseLibraryRequest {
  parent:
    | { scope: 'user'; libraryType: LibraryType; nodeId?: string }
    | {
        scope: 'projectOwned' | 'projectShared';
        libraryType: 'instrument' | 'udo' | 'soundObject';
        projectSessionId: number;
        parentLocator?: ProjectBrowseLocator;
      };
  cursor?: string;
  limit?: number;
  expectedContentRevision?: number;
}

interface BrowseLibraryResult {
  contentRevision: number;
  parent: LibraryBrowseNode;
  children: LibraryBrowseNode[];
  nextCursor: string | null;
}
```

### Search request

```ts
interface SearchLibrariesRequest {
  query: string;
  typeFilter: 'all' | LibraryType;
  projectSessionId: number | null;
  cursor?: string;
  limit?: number;
  expectedContentRevision?: number;
}

interface SearchLibrariesResult {
  contentRevision: number;
  normalizedQuery: string;
  results: LibrarySearchResult[];
  nextCursor: string | null;
}
```

Methods:

```ts
browseLibraries(request: BrowseLibraryRequest): Promise<LibraryResult<BrowseLibraryResult>>
searchLibraries(request: SearchLibrariesRequest): Promise<LibraryResult<SearchLibrariesResult>>
getLibraryItemPreview(key: LibraryItemKey): Promise<LibraryResult<LibraryItemPreview>>
```

Rules:

- Empty search displays hierarchy; non-empty search performs case-insensitive substring matching on names.
- A response identifies type, scope, support status, and enough breadcrumb/project context to distinguish duplicate names.
- Preview fields use an explicit `{ state: 'available', value } | { state: 'unavailable', reason }` shape. Missing fields do not disappear and are never invented.
- Browse/search responses never include full `payloadXml`.
- Cursor tokens bind query/filter/parent and observed revision. A repository change returns `stale-cursor`, prompting a restart rather than mixing revisions.
- Default and maximum limits are main-controlled; renderers cannot request unbounded payloads.

## User Hierarchy Mutations

```ts
type UserLibraryMutation =
  | { type: 'createFolder'; libraryType: LibraryType; parentId: string; name: string; insertIndex?: number }
  | { type: 'renameNode'; nodeId: string; expectedRevision: number; name: string }
  | { type: 'moveNode'; nodeId: string; expectedRevision: number; parentId: string; targetIndex: number }
  | { type: 'reorderNode'; nodeId: string; expectedRevision: number; targetIndex: number }
  | { type: 'duplicateNode'; nodeId: string; expectedRevision: number; parentId?: string; targetIndex?: number }
  | {
      type: 'deleteNode';
      nodeId: string;
      expectedRevision: number;
      confirmation: DestructiveConfirmationToken;
    };

interface LibraryMutationReceipt {
  contentRevision: number;
  affectedNodes: LibraryBrowseNode[];
  closedEditorSessionIds?: string[];
}
```

Methods:

```ts
prepareLibraryMutation(command: UserLibraryMutationWithoutConfirmation):
  Promise<LibraryResult<LibraryMutationPreview>>

applyLibraryMutation(command: UserLibraryMutation):
  Promise<LibraryResult<LibraryMutationReceipt>>
```

`prepareLibraryMutation` is required for non-empty folder deletion, dirty-item deletion, or any action needing affected counts. Its confirmation token binds the exact node revision and expires. Invalid names, roots, cycles, cross-type moves, stale revisions, or unsupported project-scope equivalents fail without mutation.

## Context And Insertion Targets

```ts
type LibraryContextRequest =
  | { type: 'browseType'; libraryType: LibraryType }
  | { type: 'instrumentTarget'; projectSessionId: number }
  | { type: 'udoTarget'; projectSessionId: number }
  | {
      type: 'effectTarget';
      projectSessionId: number;
      channelId: string;
      chain: 'pre' | 'post';
      insertIndex: number;
      targetRevision: string;
    }
  | {
      type: 'soundObjectTarget';
      projectSessionId: number;
      location: ScoreInsertionLocation;
      targetRevision: string;
    };

interface LibraryContextSnapshot {
  selectedType: LibraryType;
  target: InsertionTargetSnapshot | null;
}
```

Methods:

```ts
setLibraryContext(request: LibraryContextRequest): Promise<LibraryResult<LibraryContextSnapshot>>
clearLibraryInsertionTarget(): Promise<LibraryContextSnapshot>
onLibraryContextChanged(callback): () => void

previewLibraryInsertion(request: LibraryInsertionRequest):
  Promise<LibraryResult<LibraryInsertionPreview>>

applyLibraryInsertion(request: ConfirmedLibraryInsertionRequest):
  Promise<LibraryResult<ProjectMutationReceipt>>
```

The context event lets Orchestra, UDO, Mixer, Score, menus, and Libraries converge on one target banner. Main revalidates the project session, locator, target revision, dependencies, and destination immediately before apply. A stale, missing, incompatible, or ambiguous target disables insertion and returns no project change.

## Editor Sessions

Methods:

```ts
openLibraryItemEditor(request: OpenLibraryEditorRequest):
  Promise<LibraryResult<LibraryEditorOpenResult>>

getLibraryEditorSession(sessionId: string):
  Promise<LibraryResult<LibraryItemEditorSessionSnapshot>>

patchLibraryEditorSession(request: LibraryEditorPatchRequest):
  Promise<LibraryResult<LibraryItemEditorSessionSnapshot>>

validateLibraryEditorSession(sessionId: string):
  Promise<LibraryResult<LibraryEditorValidationSnapshot>>

saveLibraryEditorSession(request: SaveLibraryEditorRequest):
  Promise<LibraryResult<LibraryEditorSaveResult>>

prepareRevertLibraryEditorSession(sessionId: string):
  Promise<LibraryResult<EditorDiscardPreview>>

revertLibraryEditorSession(request: ConfirmedEditorDiscardRequest):
  Promise<LibraryResult<LibraryItemEditorSessionSnapshot>>

prepareCloseLibraryEditorSession(sessionId: string):
  Promise<LibraryResult<EditorClosePreview>>

closeLibraryEditorSession(request: EditorCloseDecisionRequest):
  Promise<LibraryResult<EditorCloseResult>>

setLibraryEditorPinned(sessionId: string, pinned: boolean): Promise<LibraryResult<void>>
onLibraryEditorSessionChanged(callback): () => void
```

`openLibraryItemEditor` returns an existing session for the same logical item instead of creating a competitor. The renderer focuses the returned Dockview panel. Patch requests are type-specific guarded commands, never arbitrary SQL or unserialized object instances.

Save conflict results are explicit:

```ts
type LibraryEditorSaveResult =
  | { status: 'saved'; session: LibraryItemEditorSessionSnapshot; projectReceipt?: ProjectMutationReceipt }
  | { status: 'validationFailed'; session: LibraryItemEditorSessionSnapshot }
  | {
      status: 'conflict';
      session: LibraryItemEditorSessionSnapshot;
      latest: LibraryItemVersionSummary;
      allowedChoices: Array<'reloadLatest' | 'cancel' | 'reviewedOverwrite'>;
    }
  | { status: 'missing'; session: LibraryItemEditorSessionSnapshot };
```

A follow-up Save may carry `conflictChoice`, but `reviewedOverwrite` is accepted only with the current conflict token. No default branch silently overwrites or discards.

Main also exposes a lifecycle guard used by existing project/app close flows:

```ts
prepareLibraryDraftShutdown(request: {
  reason: 'quit' | 'closeProject' | 'switchProject';
  projectSessionId?: number;
}): Promise<LibraryDraftShutdownPreview>

resolveLibraryDraftShutdown(request: LibraryDraftShutdownDecision):
  Promise<LibraryResult<{ mayContinue: boolean }>>
```

The current quit/project action continues only after every affected dirty session is saved or explicitly discarded. Cancel stops the outer lifecycle action.

## Import, Migration, And History

File and directory selection happens in Electron main. The renderer receives preview tokens and sanitized path labels, not authority to read arbitrary files.

```ts
beginJavaBlueImport(request: { source: 'autoDetected' | 'chooseFolder' }):
  Promise<LibraryResult<ImportPreview>>

beginXmlLibraryImport(): Promise<LibraryResult<ImportPreview>>

applyLibraryImport(request: {
  previewToken: string;
  destinationResolutions: ImportDestinationResolution[];
  replacements: ExplicitReplacementChoice[];
}): Promise<LibraryResult<ImportBatchResult>>

cancelLibraryImport(previewToken: string): Promise<void>

listLibraryImportHistory(request: PageRequest): Promise<LibraryResult<ImportHistoryPage>>
getLibraryImportReport(batchId: string): Promise<LibraryResult<CompatibilityReport>>
previewUndoLibraryImport(batchId: string): Promise<LibraryResult<ImportUndoPreview>>
undoLibraryImport(request: ConfirmedImportUndoRequest): Promise<LibraryResult<ImportBatchResult>>
```

Rules:

- Manual imports always preview; automatic first-run migration is internal and is the only no-preview path.
- Preview tokens bind source hashes, parsed plans, repository revision, destinations, and expiry. Apply rejects changed files or stale destination assumptions.
- One global operation lease prevents import/import and import/export overlap.
- Ambiguous duplicate folder paths must be resolved by stable destination IDs.
- Exact duplicate skips and same-name aliases are shown before apply.
- Undo eligibility is recomputed at request time; history remains available when undo is blocked.

## Export

```ts
beginCurrentLibraryExport(request: { libraryType: LibraryType }):
  Promise<LibraryResult<ExportPreflight>>

beginAllLibrariesExport(): Promise<LibraryResult<ExportPreflight>>

applyLibraryExport(request: {
  preflightToken: string;
  overwriteDecisions: ExportOverwriteDecision[];
  compatibilityChoice: 'exportAllCompatible' | 'compatibleSubset' | 'cancel';
}): Promise<LibraryResult<ExportResult>>

cancelLibraryExport(preflightToken: string): Promise<void>
```

The main dialog proposes the traditional filename for current-type export and asks for a destination directory for Export All. `all` and project scopes are invalid for current-type export. Preflight identifies every unsupported-but-preservable item, every unrepresentable item, every overwrite, and the proposed compatible subset before any destination change. `exportAllCompatible` is the affirmative choice when the complete requested content is representable; `compatibleSubset` is offered only when the preflight explicitly lists omissions; `cancel` writes nothing. `applyLibraryExport` either commits all requested files or restores all prior targets before returning failure.

## Recovery

```ts
getLibraryRecoveryOptions(): Promise<LibraryRecoverySnapshot>
retryLibraryOpen(): Promise<LibraryResult<LibraryServiceSnapshot>>
previewLibraryBackupRestore(backupId: string): Promise<LibraryResult<RecoveryPreview>>
restoreLibraryBackup(request: ConfirmedRecoveryRequest): Promise<LibraryResult<LibraryServiceSnapshot>>
previewFreshLibraryCreation(): Promise<LibraryResult<RecoveryPreview>>
createFreshLibrary(request: ConfirmedRecoveryRequest): Promise<LibraryResult<LibraryServiceSnapshot>>
```

Recovery options are state-dependent. Fresh creation is never the default and requires a confirmation token after the failed original is preserved. Explicit Java re-import remains a separate action. Recovery never silently changes `completed`, `skipped`, or `failed` into a new automatic scan.

## Result And Error Contract

```ts
type LibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LibraryServiceError };

interface LibraryServiceError {
  code:
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
  message: string;
  field?: string;
  retryable: boolean;
  detail?: Record<string, string | number | boolean | null>;
}
```

Errors are bounded and sanitized. They do not expose SQL text, stack traces, raw XML/code, arbitrary filesystem contents, or Electron objects.

## Security And Ownership Rules

- Main owns SQLite, paths, dialogs, source reads, destination writes, and operation tokens.
- Preload exposes only the named methods above.
- Every project command validates current project session and canonical target immediately before mutation.
- Import treats embedded code, script fields, plugin data, comments, CDATA, and unknown elements as inert data.
- XML parsing does not resolve external entities. A disallowed or unsafe document type produces a validation diagnostic, never a fetch or execution.
- Unsupported payloads are never sent through mutable domain loaders or insertion paths.
- Renderer events are notifications; a renderer cannot forge a repository revision or confirmation token.
