# Implementation Plan: Parallel ScoreObject Freezing

**Branch**: `085-parallel-freeze` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/085-parallel-freeze/spec.md`

## Summary

Run freeze render jobs concurrently within a single freeze operation, bounded by a new app-wide `freezeMaxJobs` Utility setting (default 4, validated 1–32). Restructure `executeFreezeUnfreeze` into sequential per-object preparation (temporary project construction, CSD generation through the shared script session, Java-compatible freeze-filename allocation, temp CSD write) followed by a bounded parallel pool of Csound render-and-inspect jobs through the engine runtime seam. Preserve the existing staged all-or-nothing commit, the per-item status channel, cancellation via the operation's shared `AbortController`, and the single-active-operation invariant. Classify failures as systemic (stop all in-flight jobs immediately) versus per-object (stop dispatch, drain in-flight), per the spec's confirmed hybrid strategy. No renderer protocol changes are required — the per-object freeze operation dialog already renders one row per selection.

## Technical Context

**Language/Version**: TypeScript 5.9, Electron 35 main process; React 19.2 renderer (one settings field)

**Primary Dependencies**: `@blue/data` read-only APIs (`buildFreezeRenderData`, `FrozenSoundObject`, tempo conversion); `EngineRuntimeService.executeCsound` (one Blue Engine subprocess per render); existing `FreezeExecutionSeam`; Zustand freeze-operation store (renderer, unchanged)

**Storage**: App-wide program settings JSON gains `utility.freezeMaxJobs: number`; no `.blue` XML, CSD, or layout changes

**Testing**: Vitest unit tests through the injected `FreezeExecutionSeam` stub (`freeze-score-objects.test.ts`), `program-settings.test.ts` validation/merge/reset, `program-settings-usage.test.ts` parity matrix, settings-window renderer tests

**Target Platform**: Electron desktop on macOS, Windows, Linux; freeze artifacts stay `.aif` on darwin / `.wav` elsewhere

**Project Type**: Desktop application — main-process orchestration plus one settings-panel field

**Performance Goals**: N equal-duration renders with cap N complete in ≈ one render duration; aggregate progress monotonic and order-independent; zero freeze-filename collisions under any cap

**Constraints**: All-or-nothing commit preserved; shared `javaScriptSession` never used concurrently; single active render/freeze operation; at most 32 concurrent jobs; existing IPC status events remain shape-compatible

**Scale/Scope**: `freeze-score-objects.ts` executor, `program-settings.ts` + usage matrix, `UtilitySettings.tsx`, and their tests; no `@blue/data` changes, no new packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Portable data core**: PASS — all orchestration lives in `@blue/app` main-process code; `@blue/data` is consumed through its existing read-only APIs (`buildFreezeRenderData`, `generateDiskCsd` inputs, `FrozenSoundObject` construction) and receives no new dependency or behavior.
- **Java and project compatibility**: PASS — Java `FreezeUnfreezeAction` (blue-ui-core) was consulted; it freezes sequentially and offers no concurrency setting. Sequential behavior remains available and equivalent at cap 1. The intentional divergences (parallel execution; `freezeMaxJobs` setting) are named in the spec and recorded in the program-settings parity matrix. Freeze artifact naming (`freezeN` counters), formats, `FrozenSoundObject` XML contract, and unfreeze reference counting are untouched.
- **Canonical ownership and contracts**: PASS — `utility.freezeMaxJobs` is owned by the main-process program-settings store (app-wide JSON, merge-with-defaults plus normalization on load); canonical score mutation remains exclusively in the main-process freeze orchestration. No new IPC channels: the existing `RENDER_OPERATION_STATUS_CHANNEL` and `FREEZE_ITEM_STATUS_CHANNEL` events are reused unchanged. The executor seam's return type gains a typed optional `errorCode` — a main-internal contract documented in `contracts/`.
- **Runtime and engine isolation**: PASS — Csound execution stays behind `EngineRuntimeService.executeCsound` (host-owned Blue Engine subprocesses); parallelism is multiple concurrent engine executions owned by main. Renderer and data code gain no engine, process, or filesystem coupling.
- **Host-path portability**: N/A — no new path reading or transformation; freeze artifacts remain project-relative filenames resolved against the project directory exactly as today; the project directory reaches the executor unchanged from `currentFilePath`.
- **Verification evidence**: PASS — seam-level regressions for overlap, cap enforcement, order independence, filename uniqueness, hybrid failure handling, and cancellation cleanup; settings validation/merge/reset tests; parity-matrix test; quickstart manual validation. Commands: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm lint` (see [quickstart.md](quickstart.md)).

**Post-design re-check**: PASS — the Phase 1 design adds one settings field (normalized, validated, default-filled), one main-internal seam extension (`errorCode`), and renderer-independent orchestration. No new persistence store, IPC channel, data-core surface, runtime boundary, or path handling is introduced. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/085-parallel-freeze/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── freeze-parallel-execution.md   # executor phases, pool, failure classification, progress
│   └── freeze-max-jobs-setting.md     # settings field contract (defaults, validation, normalization, UI)
└── tasks.md             # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── freeze-score-objects.ts        # two-phase executor, bounded pool, failure classification
│   ├── freeze-score-objects.test.ts   # parallelism/cap/failure/cancel/progress regressions (seam-stubbed)
│   ├── main.ts                        # seam errorCode pass-through + systemic-abort hook wiring
│   ├── program-settings-usage.ts      # parity-matrix entry: app extension, no Java counterpart
│   └── program-settings-usage.test.ts
├── shared/
│   ├── program-settings.ts            # freezeMaxJobs field, constants, validation, load normalization
│   └── program-settings.test.ts
└── renderer/
    ├── components/settings/UtilitySettings.tsx   # numeric field, min 1 / max 32, default 4
    ├── stores/freeze-operation-store.ts          # unchanged; concurrent running rows verified
    ├── tests/settings-window.test.tsx            # field presence, reset, and save-path coverage
    └── tests/freeze-operation-dialog.test.tsx    # concurrent-row independence and terminal settle
```

**Structure Decision**: Extend the existing modules that already own each concern — the freeze executor owns sequencing, the shared program-settings module owns the field's schema and validation, and the Utility panel owns its editing UI. No new source files or packages; the only new artifacts are the specification documents above.

## Complexity Tracking

No constitution violations — no exceptions to justify.
