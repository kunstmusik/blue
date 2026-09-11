# Contract: Project History Entries IPC

Channel: `project-history:entries` | Defined in `packages/blue-app/src/shared/project-history.ts`
| Date: 2026-09-11

Read-only main→renderer projection of the project history entry list for the Undo History
panel. Mirrors the existing `project-history:read` contract in shape and validation rules.

## Request (renderer → main, `ipcRenderer.invoke`)

```ts
// reuses ProjectHistoryReadRequest
{ documentId: string }
```

`documentId` MUST identify the active project session. Validation reuses
`validateProjectHistoryReadRequest`.

## Response (main → renderer)

```ts
type ProjectHistoryEntriesResponse =
  | ProjectHistoryEntriesSnapshot      // success
  | ProjectHistoryInvalidResponse;     // status: 'invalid' with reason

interface ProjectHistoryEntriesSnapshot {
  documentId: string;
  revision: number;
  cursor: number;
  entries: readonly ProjectHistoryEntrySummary[]; // oldest-first
}

interface ProjectHistoryEntrySummary {
  entryId: string;
  label: string;
  timestamp: number;
  afterStateId: string;
}
```

## Behavior rules

- **Read-only**: no participant-sender ownership check (same as the read channel); the
  handler MUST NOT mutate history, document state, dirty state, or revisions, and MUST
  NOT create history entries (FR-007).
- **Fencing**: if `documentId` does not match the active session's document, respond
  `invalid` with a reason; never return another document's entries.
- **Payload bounds**: `entries` contains only summary fields — never `record` mementos,
  patches, selection hints, or origin metadata (FR-008); row count bounded by the history
  retention entry limit.
- **Ordering**: oldest-first, identical to `getEntries()` at the sampled `revision`;
  the renderer alone computes the most-recent-first display order.
- **Failure behavior**: malformed request → `invalid` + reason. There is no busy/stale
  state: a snapshot is always available for the active document and is cheap to
  re-request (idempotent).

## Refresh protocol (renderer side)

No push channel. The renderer refetches when the existing
`ProjectHistoryStateProjection` fingerprint (`revision`, `cursor`, `length`) changes,
since every canonical publication (commit, undo, redo, eviction, branch discard, and
edits from other windows/popouts) already updates the projection via
`project-document-updated`. Seed on project load; clear on project close/replace.
Late/overlapping fetches resolve last-write-wins; a fetch landing after a newer revision
is superseded by the fingerprint-triggered refetch.

## Preload surface

`window.blueAPI.readProjectHistoryEntries(request)` → `Promise<ProjectHistoryEntriesResponse>`,
exposed in `src/preload/preload.ts` and typed in `src/renderer/types/global.d.ts`
alongside `readProjectHistory`.

## Test obligations

- Main: summaries exclude `record`/patches; oldest-first order; cursor correctness across
  commit→undo→redo; eviction reflected; gesture merge = one entry.
- IPC: valid snapshot for the active document; `invalid` on `documentId` mismatch.
- Preload: method invokes the channel with the passed request.
- Shared: response union typing guarded like existing responses.
