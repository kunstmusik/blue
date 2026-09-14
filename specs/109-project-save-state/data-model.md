# Data Model: Project Save State

## Ownership

| Fact | Owner | Lifetime |
| --- | --- | --- |
| data, documentId, stateId, filePath | ProjectSession | Active document |
| savedStateId | ProjectHistory | Load/save checkpoint |
| save state | ProjectHistory derived query | Read-only current result |
| needsSaving | Derived from save state | Never independently stored |

No XML fields, persistence store or migration.

## State query

Proposed ProjectHistory.getSaveState() returns a shared serializable union:

| State | Condition | Needs saving |
| --- | --- | --- |
| none | No document | false |
| unsaved | Document without filePath | true |
| saved | Document with path; stateId equals savedStateId | false |
| modified | Document with path; stateId differs from savedStateId | true |

Existing isDirty() retains its history-baseline semantics.

## Transitions and validation

- Create → unsaved, even with clean initial history.
- Open successfully → saved with new document identity and baseline.
- Durable commit: saved → modified; unsaved remains unsaved.
- Undo/redo: saved exactly at savedStateId; otherwise modified for on-disk documents.
- Save/Save As succeeds: checkpoint the state actually written; publish new path only after successful write.
- Cancel/failure: preserve path and checkpoint.
- Close → none after consent.
- Branch/prune: never substitute cursor or revision for state identity.
- Transient UI/runtime activity: no state change.

Queries are constant-time and cannot mutate history. Async save completion must match the captured document identity; edits after the saved snapshot remain modified. Replacement never inherits another document's checkpoint.
