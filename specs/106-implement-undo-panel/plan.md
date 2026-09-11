# Implementation Plan: Undo History Panel

**Branch**: `106-implement-undo-panel` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/106-implement-undo-panel/spec.md`

## Summary

Add an "Undo History" workbench panel exposing the spec-103 project history engine: closed
by default, registered in the existing `properties` mode (so it appears automatically under
the native Window → Properties menu and docks in the right-edge properties group), listing
committed edits most-recent-first with a position divider between applied and undone edits,
with Undo/Redo buttons at the top wired to the existing settlement-safe dispatch paths.
The only new infrastructure is a read-only `project-history:entries` IPC channel exposing
lightweight per-entry summaries; everything else (menu, docking, rails, float, placement
persistence) is derived by existing systems from two registry entries. Research findings
and decisions: [research.md](research.md); boundary shapes: [data-model.md](data-model.md),
[contracts/](contracts/).

## Technical Context

**Language/Version**: TypeScript (strict) in `packages/blue-app`; Electron main + preload
bridge + React renderer.

**Primary Dependencies**: dockview workbench + auxiliary layout layer; native Electron
application menu; `ProjectHistory` engine (`src/main/project-history.ts`, spec 103);
module-singleton `useSyncExternalStore` history stores; zustand workbench store;
Vitest test suites.

**Storage**: none new. Panel placement rides `StoredWorkbenchLayout` v7 (including
`closedPanelOrigins`); history remains main-process in-memory session state.

**Testing**: focused Vitest suites per layer (see [quickstart.md](quickstart.md)):
`project-history.test.ts`, main integration, `project-history-api.test.ts` (preload),
`application-menu.test.ts`, auxiliary-layout-model tests, new panel component and store
tests.

**Target Platform**: macOS / Windows / Linux desktop (Electron).

**Performance Goals**: entries payload bounded by retention limits (≤200 summary rows);
refetch deduped by projection fingerprint so gesture typing adds no per-keystroke IPC.

**Constraints**: `@blue/data` untouched; renderer derives display state only; typed
serializable IPC contracts; `blue-app/AGENTS.md` UI rules (`text-role-*` roles, `cn()`,
Tailwind utilities).

**Scale/Scope**: 1 new component, 1 new IPC channel + preload method, ~7 small extensions
of existing files, ~8 test extensions/additions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — all changes in `packages/blue-app`; `@blue/data` is not
  modified and gains no dependency.
- **Java and project compatibility**: PASS — no `.blue` XML, CSD, or serialization change.
  Java Blue has no undo-history panel (see research §7); this is an additive UI over the
  already-parity-reviewed history engine, named per the ported `*TopComponent` convention.
  Documented as an intentional addition, not a divergence from Java behavior.
- **Canonical ownership and contracts**: PASS — main process remains sole owner of
  `BlueData` and history. One new typed read-only channel follows the existing
  channel/validation/response conventions (`contracts/history-entries-ipc.md`). Renderer
  holds only derived disposable display state. No new persistence; panel visibility is
  existing workbench layout state.
- **Project history and undo/redo**: PASS — no new or modified durable project writer.
  The panel reads history and dispatches the existing canonical commands
  (`executeProjectUndo`/`executeProjectRedo`), inheriting spec-103's
  commit→undo→redo guarantees; panel usage creates no history entries (FR-007).
- **Runtime and engine isolation**: N/A — no engine, Java-runtime, or subprocess surface.
- **Host-path portability**: N/A — no filesystem paths cross a boundary.
- **Verification evidence**: PASS — per-layer focused tests and manual quickstart
  scenarios with FR/SC traceability ([quickstart.md](quickstart.md)); gates:
  `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm test`,
  `pnpm lint`, `git diff --check`.

*Post-design re-check (2026-09-11)*: no changes — the design added no new state domain,
writer, or boundary beyond the entries channel evaluated above.

## Project Structure

### Documentation (this feature)

```text
specs/106-implement-undo-panel/
├── plan.md                        # This file
├── research.md                    # Phase 0: infrastructure findings + decisions
├── data-model.md                  # Phase 1: entities and invariants
├── contracts/
│   ├── history-entries-ipc.md     # Phase 1: new read-only IPC channel contract
│   └── undo-panel-registry.md     # Phase 1: panel registration + derived behavior
├── quickstart.md                  # Phase 1: validation guide
├── checklists/requirements.md     # Specify-phase quality checklist
└── tasks.md                       # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── shared/
│   ├── project-history.ts         # EXTEND: entries channel constant + summary/snapshot/response types
│   └── workbench-menu.ts          # EXTEND: UndoHistoryTopComponent descriptor
├── main/
│   ├── project-history.ts         # EXTEND: readEntries() summary projection (~line 879)
│   ├── main.ts                    # EXTEND: entries IPC handler beside READ handler (~line 5941)
│   ├── application-menu.test.ts   # EXTEND: Properties submenu lists Undo History
│   └── global-project-history.integration.test.ts  # EXTEND: entries channel fencing/side-effect-free
├── preload/
│   ├── preload.ts                 # EXTEND: readProjectHistoryEntries() (~line 784–825 block)
│   └── project-history-api.test.ts  # EXTEND: new preload contract
└── renderer/
    ├── types/global.d.ts          # EXTEND: blueAPI.readProjectHistoryEntries typing
    ├── hooks/
    │   ├── use-project-history.ts # EXTEND: entries snapshot store + useProjectHistoryEntries()
    │   └── use-ipc-listeners.ts   # EXTEND: seed/clear entries with projection lifecycle (~203/220–227)
    └── components/workbench/
        ├── WorkbenchPanelContent.tsx  # EXTEND: case 'UndoHistoryTopComponent'
        ├── auxiliary-layout-model.ts  # EXTEND: seed panelIds ordering list
        └── panels/
            ├── UndoHistoryPanel.tsx      # NEW
            └── UndoHistoryPanel.test.tsx # NEW
```

**Structure Decision**: extend existing layers in place; one new component, one new read
channel. No new packages, stores, menu commands, or layout schema versions.

## Implementation Sequence

1. **Shared contract** — `PROJECT_HISTORY_ENTRIES_CHANNEL`, `ProjectHistoryEntrySummary`,
   `ProjectHistoryEntriesSnapshot`, `ProjectHistoryEntriesResponse` in
   `shared/project-history.ts` (request reuses `ProjectHistoryReadRequest`).
2. **Main projection + handler** — `readEntries()` in `main/project-history.ts`; IPC
   handler in `main/main.ts` mirroring the read channel (validate → documentId fence →
   snapshot). Side-effect-free by construction.
3. **Preload + typings** — `readProjectHistoryEntries()` and `global.d.ts` typing.
4. **Renderer store** — entries snapshot store in `use-project-history.ts`
   (set/get/`useProjectHistoryEntries`), fingerprint-keyed refresh; seed/clear in
   `use-ipc-listeners.ts` at the projection lifecycle points.
5. **Panel registration** — descriptor in `workbench-menu.ts`, seed ordering id in
   `auxiliary-layout-model.ts`, component case in `WorkbenchPanelContent.tsx`.
6. **Panel UI** — `UndoHistoryPanel.tsx`: Undo/Redo header buttons (labels mirror Edit
   menu wording, disabled per availability, dispatch via `useProjectHistory()`),
   most-recent-first list, position divider, muted redoable rows, saved marker,
   retention footnote, empty states; `blue-app/AGENTS.md` styling rules.
7. **Tests + evidence** — suites per [quickstart.md](quickstart.md); record results.

Out of scope: click-to-jump multi-step undo/redo (engine has no jump API; natural
follow-up), entry grouping/filtering, label editing, any Window-menu restructuring.

## Boundary Review and Risks

- **Boundary map**: shared contract consumed by main + preload + renderer (single
  definition in `shared/project-history.ts`); renderer UI isolated to one component and
  one store module; no `@blue/data` or engine-client changes. Consistent with
  `docs/modularization.md` layering.
- **IPC chatter**: projections update on every publication; the fingerprint guard limits
  entries fetches to actual history-shape changes, payload ≤ retention bound. Add a
  debounce only if profiling ever demands it.
- **Stale snapshot race**: fetch at revision N landing after N+1 is superseded by the
  fingerprint-triggered refetch; summaries are idempotent.
- **Shared-contract churn**: the entries list deliberately does **not** ride
  `ProjectHistoryStateProjection`/`ProjectDocumentUpdatedEvent` — the hottest contract in
  the app stays byte-identical (research §3).
- **Menu naming**: user request said "Windows → Properties"; the shipped menu is "Window"
  with an existing "Properties" submenu — the registry entry lands in exactly that place
  (spec Assumptions).
- **Test brittleness**: menu/seed tests that enumerate panel lists must be extended, not
  bypassed; unknown-id fallback (`PlaceholderPanel`) must never render for this panel.

## Complexity Tracking

No constitution violations; none to justify.
