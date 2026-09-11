# Data Model: Undo History Panel

Date: 2026-09-11 | Branch: `106-implement-undo-panel`

All new types live in `packages/blue-app`. The main-process `HistoryEntry` (spec 103) is
unchanged; this feature adds serializable projections of it and derived renderer state.

## History entry (main only — unchanged, for reference)

`HistoryEntry` in `src/main/project-history.ts`: `entryId`, `documentId`,
`beforeStateId`/`afterStateId`, `label`, `timestamp`, `record` (scalar records or full
`BlueData` mementos), patches, gesture/origin metadata. Owned by the main-process
`ProjectHistory`. This feature never serializes `record`, patches, or hints across IPC.

## History entry summary (new, shared, serializable)

Defined in `src/shared/project-history.ts`:

| Field | Type | Notes |
|-------|------|-------|
| `entryId` | `string` | Stable identity of the committed action (display key). |
| `label` | `string` | Semantic action label; same string the Edit menu shows. |
| `timestamp` | `number` | Commit time (epoch ms) for row display. |
| `afterStateId` | `string` | State produced by the action; compared to `savedStateId`. |

Invariant: contains no document content, patches, mementos, or selection hints (FR-008).

## History entries snapshot (new, shared, serializable)

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | `string` | Document the entries belong to. |
| `revision` | `number` | Canonical revision the snapshot was taken at. |
| `cursor` | `number` | Applied-entry count; entries `[0..cursor)` applied, `[cursor..)` undone. |
| `entries` | `readonly ProjectHistoryEntrySummary[]` | Oldest-first, mirroring `getEntries()`. |

Invariants: `0 <= cursor <= entries.length`; oldest-first storage order with display order
(most recent first) computed only at render; snapshot is consistent at a single revision.

## Renderer entries display state (new, derived, disposable)

Module-singleton in `src/renderer/hooks/use-project-history.ts` beside the existing
projection store: `ProjectHistoryEntriesSnapshot | null`, updated via
`setProjectHistoryEntries`, consumed via `useProjectHistoryEntries()`. Lifecycle mirrors
the projection: seeded when the project loads, replaced on refetch, cleared to `null` on
project close/replace. Never persisted; never enters `.blue` XML. Refetch is keyed on the
projection fingerprint `${revision}:${cursor}:${length}` with an in-flight guard.

Derived display model (computed in the panel, not stored): reversed entries; per-row
`applied = index < cursor`; saved marker iff `afterStateId === savedStateId` (from the
projection); retention footnote iff `retentionStatus` is `at-entry-limit` or
`at-byte-limit`.

## Panel registration (new descriptor, existing shape)

One `PanelDescriptor` row in `src/shared/workbench-menu.ts`:

| Field | Value |
|-------|-------|
| `id` | `'UndoHistoryTopComponent'` |
| `title` | `'Undo History'` |
| `mode` | `'properties'` |
| `openAtStartup` | `false` |
| `auxiliaryGroupId` | `'properties-main'` |
| `auxiliaryRailLabel` | `'Undo History'` |

Plus the id appended to `AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds`
(`src/renderer/components/workbench/auxiliary-layout-model.ts`) for deterministic seed
ordering. All placement, rail, float/dock, and reopen-at-prior-placement behavior is
derived by existing systems from these two registrations; no other layout state exists.

## Validation invariants

- Summary payload MUST exclude `record`, `forwardPatches`, `inversePatches`, selection
  hints, and origin metadata (FR-008; asserted in contract tests).
- Entries channel MUST reject a `documentId` that does not match the active project
  session, returning `ProjectHistoryInvalidResponse` (same rule as the read channel).
- Snapshot ordering MUST equal `getEntries()` order at the sampled revision; display
  reversal happens only in the renderer.
- Renderer display state MUST clear on project close/replace; no entry from a prior
  document may remain (FR-011).
- Panel usage MUST NOT mutate history: the entries read is side-effect-free and button
  dispatch reuses existing undo/redo commands (FR-007).
- Eviction: main-process eviction removes oldest entries and shifts `cursor` before any
  snapshot is taken; the renderer never computes post-eviction positions itself.
