# Research: Undo History Panel

Date: 2026-09-11 | Branch: `106-implement-undo-panel`

Sources: code exploration of `packages/blue-app` at `bf1903f8` (panel/auxiliary layout system,
native menu, project-history engine and IPC, renderer hooks and listeners, preload bridge,
existing test suites), `specs/103-global-undo-redo/*`, and the pre-draft `plan.md` produced
before this spec-kit run (its findings are consolidated here; it is superseded by the final
`plan.md`).

## 1. Panel registration, Properties mode, and the Window menu

**Findings**: The workbench is dockview plus an auxiliary layout layer emulating Java Blue's
NetBeans-style tool windows. The single source of truth for panels is
`src/shared/workbench-menu.ts`: `PanelDescriptor { id, title, mode, openAtStartup,
auxiliaryGroupId?, auxiliaryRailLabel?, ... }` and `WORKBENCH_PANEL_REGISTRY`.
`PanelMode = 'editor' | 'properties' | 'output' | 'repl'`. The native menu is built in the
main process (`src/main/application-menu.ts`); `buildWindowMenuTemplate` renders submenus
`Editors | Properties | Output | REPL` by iterating `getPanelsByMode(mode)`, each item a
`focus-panel` command. Menu label = descriptor `title`.

Consequences for this feature: one descriptor with `mode: 'properties'`,
`openAtStartup: false`, `auxiliaryGroupId: 'properties-main'` yields — with zero menu code —
a default-closed panel, an automatic **Window → Properties → Undo History** entry, docking
into the right-edge properties group on first reveal, a rail button when minimized,
float/dock support, and reopen-at-prior-placement via `closedPanelOrigins`
(`workbench-layout-envelope.ts`; documented there as serving exactly this reopen behavior).
Default seeding (`createDefaultSeededInstance`, `auxiliary-layout-model.ts`) only includes
`openAtStartup === true` panels. Every other properties panel also lists its id in
`AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds` for deterministic ordering
(`sortPanelIdsBySeedOrder`), so the new id should be appended there too.

Menu trigger chain (verified end-to-end): menu click → `routeFocusPanel`
(`src/main/workbench-window-host.ts`) → `native-menu-command` IPC → preload
`onNativeMenuCommand` → `use-ipc-listeners.ts` → `workbench-store.handleNativeMenuCommand`
case `focus-panel` → `openPanel(panelId)`.

**Decision**: Register via descriptor only; no new `NativeMenuCommand`, no menu-template
changes, no layout-envelope changes.
**Alternatives rejected**: adding a dedicated menu item or command (duplicates the
registry-driven path); `openAtStartup: true` with programmatic close (fights the seeding
model and violates FR-001).

## 2. History engine facts that bound the design

**Findings** (`src/main/project-history.ts`, from spec 103):

- Single-array model: `entries: HistoryEntry[]` + `cursor`. Undoable = `entries[0..cursor)`,
  redoable = `entries[cursor..length)`; a new commit truncates the redo tail. This maps
  directly onto the panel's applied/undone split and position indicator (FR-003).
- `HistoryEntry` carries `entryId`, `label`, `timestamp`, `beforeStateId`/`afterStateId`,
  and a `record` that may hold full `BlueData` mementos (structural entries) — large.
- Retention: 200 entries / 64 MiB defaults; eviction drops oldest entries and shifts the
  cursor; `retentionStatus` surfaces `at-entry-limit` / `at-byte-limit` (FR-010).
- Gestures merge within 500 ms into one entry (matches FR/Story 4 typing scenario).
- `savedStateId` in the projection identifies the last save checkpoint; comparing an
  entry's `afterStateId` to it yields the saved marker (FR-009).
- `getEntries()` is main-process only. The renderer-visible
  `ProjectHistoryStateProjection` exposes only `cursor`, `length`, `canUndo/canRedo`,
  `undoLabel/redoLabel`, `savedStateId`, `revision`, `retentionStatus` — **no entry list**.
  This is the one genuine gap the feature must close.
- Undo/redo run behind a settlement barrier draining in-flight participant edits, are
  idempotent per `operationId`, and revision-fenced — all existing behavior the panel must
  reuse, not reimplement (FR-004).

## 3. Exposing the entry list: dedicated read channel vs. projection payload

**Decision**: add a read-only `project-history:entries` invoke channel returning
`{ documentId, revision, cursor, entries: [{ entryId, label, timestamp, afterStateId }] }`
(oldest-first, mirroring `getEntries()`), plus a fingerprint-keyed refetch in the renderer.
The panel refetches when the projection's `${revision}:${cursor}:${length}` changes.

**Rationale**: every canonical publication already reaches renderers via
`ProjectDocumentUpdatedEvent.history` (`use-ipc-listeners.ts` sets the projection on each
event, incl. edits from other windows and popouts), so projection changes are a complete
refresh signal — the panel needs no new subscription, and the summary payload (≤200 small
rows) is fetched only when the history shape actually changed. Keeps the per-publication
event payload unchanged.

**Alternatives rejected**:
- *Extend `ProjectHistoryStateProjection` with the entry list*: rides every publication
  (including each keystroke-gesture commit), inflating the hottest event in the app for a
  panel that is usually closed; also changes a shared contract other consumers assert on.
- *Push channel for entries*: new subscription machinery + replay/last-write semantics for
  no benefit over refetch-on-signal.
- *Send full `HistoryEntry`*: violates FR-008 — `record` mementos hold whole `BlueData`.

## 4. Renderer state and dispatch paths

**Findings**: `src/renderer/hooks/use-project-history.ts` is a module-singleton +
`useSyncExternalStore` store updated by `use-ipc-listeners.ts` (seeded on project load via
`readProjectHistory`, cleared on close/replace, refreshed on every
`project-document-updated`). It already exposes `canUndo/canRedo/labels/undo()/redo()`
routing through `executeProjectUndo/Redo` (`src/renderer/lib/history-scope-router.ts`),
which handle participant origin, revision fencing, settlement, and reconciliation toast on
failure. It currently has **no UI consumer** — this panel is its first.

**Decision**: extend `use-project-history.ts` with a parallel entries snapshot store
(same singleton/`useSyncExternalStore` pattern: `setProjectHistoryEntries`,
`getProjectHistoryEntries`, `useProjectHistoryEntries()`), seeded/cleared at the same
lifecycle points in `use-ipc-listeners.ts` (lines ~203/220–227). Panel buttons call the
existing `undo()`/`redo()`; the panel never calls `window.blueAPI.undoProjectHistory`
directly (FR-004, FR-007).
**Alternatives rejected**: a new zustand store (splits history renderer state across two
homes); dispatching the existing `NativeMenuCommand { type: 'undo' }` (routes through
focus-scope resolution designed for menu/keyboard dispatch; the hook path is the direct,
settlement-safe equivalent already used by tests).

*Implementation accounting (T011, 2026-09-11)*: confirmed during implementation — the
feature adds **no durable project writer**. `readEntries()` is a pure projection with no
history, document, revision, or dirty-state side effects, and the panel's Undo/Redo buttons
call `executeProjectUndo`/`executeProjectRedo` unchanged. The constitution's
commit→undo→redo obligation for new writers therefore does not attach; the read-only
guarantee is covered by the side-effect-free integration test (T010) instead.

## 5. IPC, preload, and contract conventions

**Findings**: Handlers registered on `ipcRegistration` in `src/main/main.ts` (~lines
5917–5953). `PROJECT_HISTORY_READ_CHANNEL` is the closest template: validate request →
reject `documentId` mismatch against the active session → return projection; notably it
does **not** require `validateHistoryRequestSender` participant ownership because it is
read-only. The new entries channel is read-only in exactly the same way.
Preload bridge methods live in `src/preload/preload.ts` (~784–825) with typings in
`src/renderer/types/global.d.ts`; channel constants and response unions live in
`src/shared/project-history.ts` next to `ProjectHistoryReadResponse =
ProjectHistoryStateProjection | ProjectHistoryInvalidResponse`.

**Decision**: mirror the read-channel shape exactly —
`PROJECT_HISTORY_ENTRIES_CHANNEL = 'project-history:entries'`, request type reusing
`ProjectHistoryReadRequest`, response `ProjectHistoryEntriesSnapshot |
ProjectHistoryInvalidResponse`. Full contract in `contracts/history-entries-ipc.md`.

## 6. UI conventions

**Findings**: `MarkersPanel.tsx` is the canonical closed-by-default properties panel
(zustand `useProjectStore`, empty-state pattern `text-blue-muted text-role-body`, Tailwind
utilities, no custom CSS). `blue-app/AGENTS.md` requires the seven `text-role-*` roles,
`cn()` for composed classNames, and portal conventions for popups (this panel has none).
Panels render via the id→component switch in `WorkbenchPanelContent.tsx` (only wiring
point; unknown ids fall through to `PlaceholderPanel`). The auxiliary system already
presents panels docked/minimized/slideout/maximized/floated, so the component must be
layout-agnostic (fills its container; no viewport assumptions).

**Decision**: new `UndoHistoryPanel.tsx` modeled on `MarkersPanel`; header row with
Undo/Redo buttons (labels mirror the native Edit menu's `` Undo ${label} `` wording);
list rendered most-recent-first with a position divider row; muted styling for redoable
entries; "Saved" marker via `afterStateId === savedStateId`; retention footnote when
`retentionStatus` indicates eviction; empty states for no-project and no-entries.

## 7. Java parity analysis

**Findings**: Java Blue (`blue-ui-core`) has no undo-history panel; its
`BlueUndoManager` supplies per-tab named histories, which spec 103 already superseded with
one project-wide history. The panel naming follows the port's established
`*TopComponent` NetBeans convention and lands in the already-ported Window → Properties
grouping.

**Decision**: additive UI, no Java reference to satisfy; document as intentional addition
(no behavioral divergence to justify). `.blue` XML, CSD generation, and project data are
untouched.

## 8. Verification landscape

**Findings** (suites to extend, patterns to follow):

- `src/main/project-history.test.ts` — canonical commit→undo→redo, gesture, retention
  coverage; extend with `readEntries` cases (summaries, memento exclusion, cursor moves,
  eviction).
- `src/main/global-project-history.integration.test.ts` — main-level integration; extend
  for the new channel's documentId fencing and snapshot response.
- `src/preload/project-history-api.test.ts` — preload contract tests; extend for
  `readProjectHistoryEntries`.
- `src/main/application-menu.test.ts` — asserts the Window menu's first five labels and
  that Editors items fire `onFocusPanel` (lines ~388–411); extend to assert the
  Properties submenu lists "Undo History".
- Renderer component/hook tests colocated with sources (e.g.
  `src/renderer/tests/use-dedicated-project-history.test.tsx`,
  `native-menu-undo-redo.test.tsx`); add `UndoHistoryPanel` tests (ordering, divider,
  disabled states, dispatch, empty states) and entries-store tests.
- `auxiliary-layout-model` tests cover seeded layout; extend if they enumerate panel sets
  (panel must be absent from default seeds, present in `properties-main` ordering).

Commands: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`,
repo-wide `pnpm test`, `pnpm lint`, `git diff --check`.
