# Research: Project Save State

## Canonical query

**Decision**: Derive save state in ProjectHistory from session data/filePath and existing isDirty().

**Rationale**: project-history.ts owns savedStateId, checkpointSave and state ID comparison. Undo/redo restore state IDs. project-lifecycle.ts checkpoints every replacement, including pathless new projects, so initial history cleanliness alone does not imply an on-disk save.

**Alternatives considered**: XML comparison adds work per edit; revision equality fails across undo; globally changing isDirty semantics risks existing renderer consumers.

## Publication and successful save

**Decision**: Preserve success-only checkpointing and update titles through history/checkpoint publication.

**Rationale**: main.ts publishUpdated (around line 490) broadcasts history changes without a title refresh. publishHistoryCheckpoint already handles same-revision save events. doSave and saveFileAsInternal checkpoint only after writes. Lifecycle asynchronous saves capture the written state and document identity; preserve that fencing.

**Alternatives considered**: New event bus/IPC channel is unnecessary. Optimistically marking saved before writing misrepresents failures.

## Close and quit

**Decision**: Settle editor drafts before checking save state; use one boundary per close/quit transition and settled internal save functions. Quit orchestration owns shutdown.

**Rationale**: confirmSaveBeforeReplace currently prompts for every document. requestQuit relies on callees to quit, so a clean early return alone would leave the app running. writeProjectToDisk explicitly quits on a pending-quit write error, violating failure protection. runSettlementBarrier queues barriers; nesting saveCurrentProject/saveFileAs inside another barrier deadlocks. Keep state evaluation, confirmation and terminal action under the same boundary and audit existing replacement callers.

**Alternatives considered**: Checking state before settlement misses buffered edits. Releasing a boundary before asynchronous consent without revalidation permits stale consent. Broad replacement-framework changes are unnecessary.

## Java parity

**Decision**: Intentionally adopt requested conditional prompts and title strings.

**Evidence**: Java blue-projects/src/main/java/blue/projects/BlueProjectManager.java saveCheck() around line 456 prompts unconditionally. blue-ui-core/src/main/java/blue/ui/core/Installer.java setWindowTitle() around line 226 uses lowercase blue, version, and New Project for pathless documents.

**Alternatives considered**: Exact Java behavior conflicts with the requested UX. Preserve serialization and dialog choices.

## Scope and naming

**Decision**: File basename including extension remains the project name. Use New Project for a pathless document and Blue when none is loaded. Specialized floating editor titles keep their purpose.

**Rationale**: shared/window-title.ts already extracts basename from both slash forms. Main owns one ProjectSession; multiple windows are not independent projects.

**Alternatives considered**: Persisting hasEverSaved duplicates the file-path fact. Adding multi-project ownership expands scope.

## Validation

**Decision**: Extend Vitest history/lifecycle/replacement coverage, add state/title matrices and injected confirmation/quit tests; smoke-test native chrome and quit gestures.

**Rationale**: Source-text checks cannot prove shutdown ordering, error handling or barrier behavior. Existing renderer/tests/app.test.ts includes title assertions that must be updated.

**Alternatives considered**: Full UI automation alone is slower and less precise for failures. Installed source and Java references resolve all research questions; no new technology is selected.
