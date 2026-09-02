# Tasks: Codebase Simplification & Overengineering Reduction

**Input**: Design documents from `specs/095-codebase-simplification/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/pruned-interfaces-and-surfaces.md](./contracts/pruned-interfaces-and-surfaces.md), [quickstart.md](./quickstart.md)

**Organization**: Grouped into discrete, commit-sized tasks by user story to support single-task implementation, review, and commit cycles.

## Path Conventions
- `@blue/data`: `packages/blue-data/src/`
- `@blue/app`: `packages/blue-app/src/`
- `blue-engine-client`: `packages/blue-engine-client/src/`
- `blue-cli`: `packages/blue-cli/`

---

## Phase 1: Setup & Baseline Verification

**Purpose**: Validate repository baseline before introducing simplification changes.

- [X] T001 Run baseline repository test suite (`pnpm test`) and record baseline status

---

## Phase 2: Foundational Verification

**Purpose**: Establish regression safety fixtures before pruning data model classes.

- [X] T002 Verify `.blue` XML roundtrip fixtures and score test coverage in `packages/blue-data/tests/integration/pattern-layer-roundtrip.test.ts` and `packages/blue-data/src/score/score.test.ts`

---

## Phase 3: User Story 1 - Elimination of Dead Java Parity Infrastructure (Priority: P1) 🎯 MVP

**Goal**: Prune dead Java Swing mirror artifacts, provider registries, and static clipboards from `@blue/data` without affecting XML roundtrip or CSD compilation.  
**Independent Test**: `pnpm --filter @blue/data test` and `pnpm --filter @blue/data build` succeed with zero remaining references to deleted classes.

### Implementation Tasks (Commit-Sized Units)

- [X] T003 [P] [US1] Remove dead `CopyBuffer` static clipboard and tests in `packages/blue-data/src/copy-buffer.ts`, `packages/blue-data/src/copy-buffer.test.ts`, and prune re-exports from `packages/blue-data/src/index.ts`
- [X] T004 [P] [US1] Remove dead `LayerGroupProviderManager` and 4 concrete provider classes in `packages/blue-data/src/score/layers/layer-group-provider-manager.ts`, `packages/blue-data/src/score/layers/layer-group-provider.ts`, `packages/blue-data/src/score/patterns/patterns-layer-group-provider.ts`, `packages/blue-data/src/score/track/track-layer-group-provider.ts`, `packages/blue-data/src/sound-objects/poly-object-layer-group-provider.ts`, and remove obsolete references in `packages/blue-data/src/index.ts` and `packages/blue-data/tests/integration/pattern-layer-roundtrip.test.ts`
- [X] T005 [US1] Remove dead Swing listener and event classes in `packages/blue-data/src/score/layers/layer-group-listener.ts`, `packages/blue-data/src/score/layers/layer-group-data-event.ts`, and `packages/blue-data/src/automation/automatable-collection-listener.ts`, pruning internal listener arrays from `packages/blue-data/src/score/track/track-layer-group.ts`, `packages/blue-data/src/score/patterns/patterns-layer-group.ts`, and `packages/blue-data/src/sound-objects/poly-object.ts`
- [X] T006 [P] [US1] Remove empty marker interfaces `ScoreObjectLayerGroup`, `ScoreObjectLayer`, `AutomatableLayerGroup`, and Java-generic collision interface `DeepCopyableLG` in `packages/blue-data/src/score/layers/`, standardizing layer groups to `DeepCopyable<T>`
- [X] T007 [P] [US1] Delete uncalled helper stubs and scripts: `automationDiagnosticPrefix` in `packages/blue-engine-client/src/automation-errors.ts`, `clearIpcRegistrationLeasesForTesting` in `packages/blue-app/src/main/ipc/ipc-registration.ts`, `escapeHtmlAttribute` in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts`, and `scripts/round-trip-test.mjs`

### Verification Task

- [X] T008 [US1] Run User Story 1 verification: `pnpm --filter @blue/data build`, `pnpm --filter @blue/data test`, and `pnpm --filter @blue/engine-client test`

**Checkpoint**: Dead Java Swing-era infrastructure completely eliminated from `@blue/data` with 100% test pass.

---

## Phase 4: User Story 2 - Platform & Standard Library Modernization (Priority: P2)

**Goal**: Replace custom byte masking, manual popup geometry, and error chaining with native Web and Node.js platform standards.  
**Independent Test**: Conformance tests for UUID generation pass; `RuntimeDeviceField` renders and positions accurately via `@floating-ui/dom`.

### Implementation Tasks (Commit-Sized Units)

- [X] T009 [P] [US2] Modernize UUID generator to delegate directly to `crypto.randomUUID()` in `packages/blue-data/src/utilities/uuid.ts` and update tests in `packages/blue-data/src/utilities/uuid.test.ts`
- [X] T010 [P] [US2] Update `SoundObjectException` to extend standard `Error` with `{ cause }` options in `packages/blue-data/src/sound-objects/sound-object-exception.ts`
- [X] T011 [P] [US2] Consolidate duplicated `clamp()` implementations into `packages/blue-data/src/utilities/math-utils.ts` and update callers across packages
- [X] T012 [US2] Migrate `RuntimeDeviceField.tsx` in `packages/blue-app/src/renderer/components/settings/RuntimeDeviceField.tsx` to `useHostSurface`, remove uncalled `computeColorPickerPosition` in `packages/blue-app/src/renderer/components/color-picker-utils.ts`, and delete `packages/blue-app/src/renderer/components/floating-position-utils.ts`
- [X] T013 [US2] Inline single-caller `createMainExternalExecutor` into `packages/blue-app/src/main/external-executor.ts` and delete `packages/blue-app/src/main/external-command-executor.ts`

### Verification Task

- [X] T014 [US2] Run User Story 2 verification: `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, and `pnpm --filter @blue/app build:main`

**Checkpoint**: Core utilities aligned with modern platform standards and dead floating math removed.

---

## Phase 5: User Story 3 - Main Process Architectural Pruning (Priority: P3)

**Goal**: Prune transient diagnostic tracking and flatten domain IPC slice-ordering coordination in the Electron main process.  
**Independent Test**: Main process builds cleanly; all IPC channels register and dispatch properly in main process tests.

### Implementation Tasks (Commit-Sized Units)

- [X] T015 [US3] Retire Spec 093 editor-open diagnostic tracking harness: delete `packages/blue-app/src/main/editor-open-diagnostics.ts` and `packages/blue-app/src/main/track-editor-diagnostic-attempts.ts`, removing diagnostic hooks from `packages/blue-app/src/main/main.ts` and editor window managers
- [X] T016 [US3] Flatten domain IPC registration in `packages/blue-app/src/main/ipc/main-process-domain-ipc.ts` to register handlers directly via `ipcMain.handle()` in their domain modules, eliminating `MAIN_PROCESS_DOMAIN_IPC_ORDER` slicing

### Verification Task

- [X] T017 [US3] Run User Story 3 verification: `pnpm --filter @blue/app build:main` and `pnpm --filter @blue/app test`

**Checkpoint**: Main process codebase simplified with zero diagnostic baggage and direct IPC registration.

---

## Phase 6: Polish & Final Verification

**Purpose**: End-to-end repository validation and whitespace checks before handoff.

- [X] T018 Run full repository verification suite: `pnpm test`, `pnpm lint`, and `git diff --check`
- [X] T019 Complete quickstart validation scenarios defined in `specs/095-codebase-simplification/quickstart.md`

---

## Dependencies & Execution Order

```text
T001 (Baseline) ─> T002 (Fixtures)
                       │
                       ▼
    [Phase 3: User Story 1 - Dead Code Removal]
    T003 (CopyBuffer)
    T004 (Providers)
    T005 (Swing Listeners)
    T006 (Marker Interfaces)
    T007 (Helper Stubs)
           │
           ▼
    T008 (US1 Verification & Checkpoint)
           │
           ▼
    [Phase 4: User Story 2 - Platform Modernization]
    T009 (UUID)
    T010 (Exception)
    T011 (Clamp)
    T012 (HostSurface Settings)
    T013 (External Executor)
           │
           ▼
    T014 (US2 Verification & Checkpoint)
           │
           ▼
    [Phase 5: User Story 3 - Main Process Pruning]
    T015 (Diagnostics Pruning)
    T016 (Flatten Domain IPC)
           │
           ▼
    T017 (US3 Verification & Checkpoint)
           │
           ▼
    [Phase 6: Final Verification]
    T018 (pnpm test + lint + git diff --check)
    T019 (Quickstart Validation)
```

## Parallel Execution Opportunities

- In **Phase 3 (US1)**: `T003` (`CopyBuffer`), `T004` (`Providers`), `T006` (`Marker Interfaces`), and `T007` (`Helper Stubs`) touch completely distinct files and can be executed in parallel or as independent single commits.
- In **Phase 4 (US2)**: `T009` (`uuid.ts`), `T010` (`sound-object-exception.ts`), and `T011` (`math-utils.ts`) are completely independent utility edits.

---

## Phase 7: Convergence

- [X] T020 Remove the hand-rolled UUID fallback from `packages/blue-data/src/utilities/uuid.ts`, delegate directly to `crypto.randomUUID()`, and update `packages/blue-data/src/utilities/uuid.test.ts` per FR-003 / SC-002 (partial)
- [ ] T021 Remove the backward-compatible `deepCopyLG()` alias from `packages/blue-data/src/score/layers/layer-group.ts`, `packages/blue-data/src/score/track/track-layer-group.ts`, `packages/blue-data/src/score/patterns/patterns-layer-group.ts`, and `packages/blue-data/src/sound-objects/poly-object.ts`, migrating affected tests and callers to `deepCopy()` per plan: `DeepCopyable<T>` standardization (partial)
- [ ] T022 Remove the remaining Spec 093 editor-open diagnostic path from renderer pages, preload and shared contracts, main-process registrations, and associated tests per US3/AC1 / SC-003 (partial)
- [ ] T023 Eliminate `MAIN_PROCESS_DOMAIN_IPC_ORDER` and the centralized ordering loop, registering each domain's handlers and listeners directly while preserving IPC contracts and rollback behavior per FR-005 / SC-003 (contradicts)
