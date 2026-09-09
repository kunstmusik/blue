# Implementation Plan: Global Project Undo and Redo

**Branch**: `codex/103-global-undo-redo` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/103-global-undo-redo/spec.md`

## Summary

Introduce one main-owned project history and transaction coordinator, preserving `ProjectSession` as canonical document owner. Ordinary edits and replay share atomic publication, monotonically increasing revisions, save checkpoints, and runtime reconciliation. All committed project text joins this history; unapplied drafts retain local history. A cross-renderer settlement barrier orders pending edits before undo. Engine outcomes are tracked independently for each performance, with explicit restart-required behavior for compiled changes.

Use typed canonical change records for frequent scalar/text edits and explicit identity-preserving model copies plus identity sidecars for structural mementos. Prepare and validate changes before publication; no editor closures or runtime writes precede successful document commit. Do not restore a renderer snapshot or reuse duplication-oriented `deepCopy()` as history state. See [research.md](research.md) for evidence and alternatives.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible strict source; repository manifest ranges remain unchanged.

**Primary Dependencies**: Existing Electron 35.7.5, React 19, Zustand 5, CodeMirror 6, Dockview, `@blue/data`, and versioned `@blue/engine-client`. No new history framework or dependencies.

**Storage**: Canonical `BlueData` and `.blue` XML; history and save checkpoint in main memory only. Initial retention 200 completed actions and 64 MiB of retained memento payloads. External libraries and generated audio retain existing ownership.

**Testing**: Vitest unit/integration tests, existing Playwright-backed Vitest browser tests, and native Electron/engine smoke scenarios on macOS, Windows, Linux.

**Target Platform**: Existing desktop targets, including detached Dockview panels and dedicated effect/track editor windows.

**Project Type**: Electron desktop application in a pnpm workspace with host-neutral data package and external audio engine.

**Performance Goals**: Spec SC-003/004: p95 ordinary visible restoration ≤200 ms and supported single-value runtime acknowledgement ≤250 ms on the reference workload; runtime outcome visible within one second of determination. Large structural work may remain visibly pending.

**Constraints**: No history in XML; lossless restoration and stable identities; no mutable project references in deferred engine jobs; native paths unchanged; existing typography and popup conventions; no automatic playback interruption; all FR-002 domains covered before feature completion.

**Scale/Scope**: One active project with multiple editor contexts, potentially multiple active performance kinds, committed code/text, structural objects, and 100 mixed-action acceptance runs. Representative workloads and measurement procedure are fixed in [quickstart.md](quickstart.md).

## Constitution Check

*Pre-research gate: PASS. Post-design gate: PASS; no exceptions requested.*

- **Portable data core — PASS**: Canonical history-copy support uses only static ES imports and host-neutral model/XML utilities. History ordering, UI, memory accounting, IPC, and engine ownership stay in app main. No Node/DOM/Electron dependency enters data production source.
- **Java and project compatibility — PASS**: Consulted Java `blue-core/.../undo/BlueUndoManager.java` and `blue-ui-core/.../score/ScoreController.java`. Preserve gesture compounding, labels, XML/CSD semantics, unknown data, and stable references. Spec explicitly permits project-wide committed-text history instead of Java tab histories. XML memento conformance and Java-compatible round trips are prerequisites to structural migration.
- **Canonical ownership and contracts — PASS**: `ProjectSession` owns the active graph and document lifetime. History owns retained changes/checkpoint; renderers own drafts and presentation. New validated serializable contracts are specified in `contracts/`; recovery never rolls back document state because an engine failed. No persistence migration.
- **Runtime and engine isolation — PASS**: Host adapters alone use engine/Java/process APIs. Acknowledged immutable work goes through the existing versioned engine client; per-performance bindings replace dependence on mutable compilation fields during replay.
- **Host-path portability — PASS**: History preserves native filesystem strings and external references verbatim. Existing Csound conversion remains at generation boundaries. Relink/freeze round trips cover synthetic Windows paths and native Windows validation; no new permission/chmod logic.
- **Verification evidence — PASS (planned, not executed)**: Focused queue/replay/identity/dirty-state regressions, XML/CSD oracle, typed IPC failure tests, two-document UI tests, native shortcuts, engine failure and acknowledgement tests, performance runs, data/app tests, main/preload/renderer builds, repository tests/lint, whitespace check. See quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/103-global-undo-redo/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── project-history.md
    ├── runtime-reconciliation.md
    └── editor-history.md
```

`tasks.md` is produced by the next `/speckit-tasks` phase, not this plan.

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── project-history.ts                 # new transaction/history owner
│   ├── project-history-memento.ts         # new canonical capture/restore
│   ├── project-runtime-reconciliation.ts  # new ordered performance outcomes
│   ├── project-session.ts                # publish committed graph without replacement
│   ├── project-lifecycle.ts               # load/save/close integration
│   ├── main.ts                           # composition and existing handler migration
│   └── [existing runtime and library adapters]
├── shared/
│   ├── project-history.ts                # new serializable contract types
│   └── project-editor/                   # patch preparation/identity support
├── preload/                              # existing bridge exports and subscriptions
└── renderer/
    ├── stores/project-store.ts           # canonical refresh and dirty projection
    ├── stores/project-store/project-patch-queue.ts
    ├── hooks/use-ipc-listeners.ts
    ├── hooks/use-project-history.ts      # new focus/command client
    ├── components/                       # existing editors/menus/status integration
    ├── tests/
    └── browser/
packages/blue-data/src/                    # explicit history-copy mode; duplication unchanged
packages/blue-data/tests/                  # memento/XML/reference/CSD oracle
```

**Structure Decision**: Accept a deep history module because batching, inverse state, checkpointing, and ordering currently reappear across real callers. Keep `main.ts` as composition and existing stores as façades. Dependency direction: model/XML and leaf contracts → canonical preparation/history → main adapters; renderers consume shared contracts only. Follow `docs/modularization.md`; update its boundary record when implementing these seams.

## Implementation Sequence

1. **Prove restoration and isolate publication** (FR-003–005, 011–013): Add identity/XML conformance fixtures and failure oracles; extract transaction preparation from host side effects. Add document lifetime independent of runtime session fencing. Implement `ProjectSession.publishCommittedDocument`, exact no-op detection, operation deduplication, checkpoint capture at successful save, and retained-byte accounting. Frequent value changes use verified typed records; structural operations use detached memento restoration. No features migrate until their capture/restore oracle passes.
2. **Establish the multi-context command protocol** (FR-001, 005–010): Register independent renderer contexts; implement pause/drain/release barrier and stale request handling. Extend typed preload and both declarations; migrate main batch, legacy update, effect/track editors, missing-audio relink, library project changes, and asynchronous freeze result publication. Reject unregistered durable patch variants at the common preparation boundary during migration; do not ship until coverage is complete.
3. **Deliver an end-to-end slice** (US1–3): Score move/delete, mixer level, and instrument replacement exercise small and structural records, visual refresh, save state, live acknowledgement, and restart-required status. Eliminate runtime and editor side effects before commit. Add per-performance binding ownership and cancel/fence preview jobs before reversal.
4. **Migrate every project domain and text** (FR-002, 008–010, 018): Tag real gestures; add action labels at semantic callers; group typing using transaction metadata. Replace color/BlueX7/PianoRoll stacks and committed CodeMirror history ownership. Update effect editor canonical refresh and remove unbounded stale resubmission. Finish library/freeze/relink coverage and enforce explicit external-resource scope.
5. **Complete integration validation** (SC-001–008): Capability matrix, native shortcuts, composition, two-window settlement/failure, retention oversize and save races, XML/CSD preservation, engine protocol errors, late previews, multiple performance generations, representative performance measurements. No partial-domain implementation counts as feature complete.

## Boundary Review and Risks

| Accepted responsibility | Interface and owner | Test seam | Rollback boundary |
| --- | --- | --- | --- |
| Transaction/history | Main `commit`, `undo`, `redo`, `read`; ProjectSession remains graph owner | Injected publication and prepared-change harness | Coordinator plus migrated entry points |
| Canonical restoration | Capture/prepare/restore with exact identity; main-only payloads | XML/identity/no-alias oracle | Memento support and domain preparation |
| Runtime reconciliation | Immutable committed transition → per-performance outcomes | Fake acknowledged client and real-engine smoke | Runtime queue and its direct-write migrations |
| Editor routing | Actual host focus → draft/project history command | Two-document and native shortcut tests | Menu/client/editor integration |

Retain unrelated reducers, window lifecycle, runtime startup orchestration, and layout logic in their existing modules. No generic event bus, collaborative transform engine, or wholesale immutable model rewrite. Document semantic changes separately from any mechanical extraction.

Primary risks are incomplete canonical copying, incomplete identity sidecars, writes bypassing preparation, stale drafts, swallowed engine acknowledgements, and compilation bindings stored on canonical objects. Each has a named gate and regression in research/contracts/quickstart. Structural mementos cost graph-copy time; frequent scalar/text edits avoid full-project copies. A domain failing the losslessness gate receives a focused history-copy fix before migration, never a lossy fallback. XML round trips are a compatibility oracle, not the universal restoration mechanism.

## Complexity Tracking

No constitution violations or exceptions. The coordination and memento modules address existing multi-window writers, mutable class models, and independent runtime lifetimes; they are not general-purpose infrastructure.
