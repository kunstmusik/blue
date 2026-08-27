# Contract: Open Example Library Lifecycle

**Feature**: [Factory Example Content](../spec.md)

## Main-Process Service Boundary

The example-library module exposes a small typed main-process contract conceptually equivalent to:

```text
inspect(factoryRoot, libraryRoot) -> ExampleLibraryInspection
prepareInitialCopy(inspection) -> CandidateGeneration
prepareUpdate(inspection) -> CandidateGeneration
recordDeclinedRevision(inspection) -> void
commit(candidate) -> ReadyExampleLibrary
abort(candidate) -> void
recover(libraryRoot) -> RecoveryResult
```

The actual TypeScript API may combine inputs in an options object, but callers must not manipulate
state files, staging directories, manifests, or merge actions directly.

All failure results are discriminated and include a stable code, safe user-facing summary, optional
bounded detail, and retryability. Raw absolute paths may be logged or used in native detail text but
must not cross a renderer/preload boundary.

## Open Example Flow

```text
menu: Open Example
  -> render/freeze preflight
  -> recover recognized interrupted example-library operation
  -> inspect factory + current user library
  -> first-use/update/factory-unavailable decision
  -> optionally prepare candidate generation (current remains unchanged)
  -> report preserved conflicts, if any (Continue keeps user entries; Cancel aborts)
  -> show native .blue picker rooted at candidate/content or current/content
  -> resolve an existing regular .blue selection into the offered content root
  -> read + parse selected project from the offered generation
  -> canonical same-file no-op check when no candidate exists
  -> render/freeze preflight re-check
  -> existing library-draft decision
  -> existing project save/discard/cancel decision
  -> update only: active-example safety decision when the open project lives
     inside current/content (existing save/discard/cancel protection; Cancel aborts)
  -> commit candidate generation
  -> install parsed BlueData under the selected current/content path
```

The candidate remains uncommitted while the picker, parsing, and existing replacement gates run.
Every cancellation or failure before commit executes `abort(candidate)` in `finally`; abort is
idempotent and the previous `current` generation remains unchanged. Newly added examples are
selectable from the prepared candidate in the same Update and Open action. After every gate accepts,
the candidate is activated atomically and the already-parsed project is installed using the
equivalent stable `current/content` path.

## Native Decision Contracts

All decisions use `showNativeConfirmation` and fail closed. Closing a dialog, Escape, owner loss,
validation failure, or unexpected dialog failure resolves to Cancel with no library/project commit.

### First use

- **Message intent**: Blue examples are factory content; a user-owned copy is required for editing
  and rendering.
- **Actions**: `copy-and-open` (Copy and Open), `cancel` (Cancel).
- **Default**: Copy and Open.
- **Cancel action**: Cancel.

### Different installed factory revision

Shown only when installed revision matches neither accepted nor declined revision.

- **Actions**: `update-and-open` (Update and Open), `keep-current-and-open` (Keep Current and Open),
  `cancel` (Cancel).
- **Default**: Update and Open.
- **Cancel action**: Cancel.
- Update and Open prepares a candidate; Keep Current atomically records the decline and opens the
  existing current library.

### Factory unavailable with valid user library

- **Actions**: `open-current` (Open Current Examples), `cancel` (Cancel).
- The detail explains that update checking is unavailable; no factory write or state reset occurs.

### Preserved conflicts

- Candidate preparation returns path-sorted conflict counts/details before the picker.
- An informational Continue/Cancel decision identifies the total and a bounded path list.
- Continue keeps all user entries and proceeds to the candidate picker; Cancel aborts the candidate.

### Recoverable failure

- Retry may repeat recovery/inspection from a clean service boundary.
- Cancel leaves the active project and last valid current generation unchanged.
- Invalid/unmanaged user content is never offered an action that overwrites or deletes it.

## Picker Contract

- Title remains `Open Example Project`; filter remains `.blue`.
- The picker roots at the prepared candidate's `content` for first-use/update work and at
  `current/content` when no candidate is needed.
- The accepted target must be an existing regular `.blue` file whose real path remains inside
  the offered content root. A path outside that root is rejected with guidance to use Open
  Project, after which the picker RE-OPENS (bounded retries) instead of ending the flow.
- During a staged update, macOS may return the equivalent path from Blue's stable
  `current/content` tree even though the picker was offered candidate content. That Blue-owned
  path is explicitly resolved to the same relative file in the candidate and parsed there.
  Packaged-factory and genuinely external paths are never remapped.
- An in-library pick spelled through a case-preserving or symlinked ancestor normalizes by real
  filesystem identity before containment is decided.
- Cancel commits neither a candidate nor a project replacement. A previously recorded Keep
  Current decision may remain because it is a completed state-only preference.

## Same-File and Commit Semantics

- With no pending candidate, selecting the already-open stable project path retains the canonical
  same-file no-op.
- With a candidate, picker cancellation, parse failure, or replacement-gate cancellation aborts
  the candidate and preserves the previous library generation and active project.
- The selected project is parsed before the library-draft and save decisions; for updates,
  the active-example safety decision (save/discard/cancel) runs before the swap whenever
  the open project lives inside `current/content`, so its file is never modified
  underneath an unanswered prompt.
- If activation succeeds but project installation unexpectedly fails, the accepted
  example-library update remains valid and recoverable; the existing active project is not
  intentionally cleared, and a project-load error is reported.

## Transaction Activation and Recovery

Activation uses this durable phase order:

1. Validate candidate state/content and unchanged `sourceUserRevision` (updates only).
2. Write+fsync `operation.json` with phase `prepared`.
3. If `current` exists, rename it to the validated backup name and advance phase to
   `backup-created`.
4. Rename staging to `current` and advance phase to `activated`.
5. Validate `current`, remove the owned backup, then remove the journal.

Recovery runs only from `Open Example`:

| Observed state | Recovery |
|---|---|
| Valid current; stale prepared stage | Keep current; remove validated stage/journal |
| Current missing; valid matching stage; journal at `backup-created` | Finish stage activation |
| Current missing; stage invalid/missing; valid matching backup | Restore backup |
| Valid current matching target; backup remains; phase `activated` | Keep current; remove backup/journal |
| Ambiguous names, malformed journal, or multiple unowned candidates | Preserve all; return blocked diagnostic |

No startup/background recovery runs. The next explicit Open Example action owns recovery, matching
the feature lifecycle boundary.
