# Tasks: Mixer Follow-Up

**Input**: Design documents from `/specs/035-mixer-follow-up/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/  

**Tests**: Tests are required by FR-010. Write validation and library workflow coverage before or alongside the implementation they protect.

**Organization**: Tasks are grouped by user story so routing safety and library workflow polish can be implemented and validated incrementally.

> **Scope disposition (2026-09-13):** The former playback-aware/windowing phase is withdrawn. Tasks T003, T008, T014, and T031-T037 are not implementation targets for Spec 035; later specifications own those concerns.

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm the exact gaps left after Spec 034 and map them to Java and TypeScript seams.

- [x] T001 Review the follow-up parity anchors listed in `/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/research.md`
- [x] T002 [P] Inventory Spec 034 mixer snapshot, library session, and effect-window seams in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/effect-editor-window-manager.ts`
- [x] T004 [P] Inventory current mixer/library renderer components in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/EffectLibraryModal.tsx`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/effect-editor/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish routing validation, chain clipboard payloads, and library import/export plumbing before story-specific UI work begins.

**Critical**: No user story work should begin until this phase is complete.

### Tests

- [x] T005 [P] Add routing-validation tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/mixer-routing-validation.test.ts`
- [x] T006 [P] Add chain clipboard and paste contract tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/mixer-chain-clipboard.test.ts`
- [x] T007 [P] Add effects-library import/export and reload tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.test.ts`

### Implementation

- [x] T009 Add pure routing-validation helpers in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/mixer/routing-validation.ts` or an equivalent pure shared location
- [x] T010 Extend shared mixer patch types with follow-up clipboard and move operations in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T011 Add renderer clipboard helpers for chain entries in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/mixer/`
- [x] T012 Extend the effects-library session service with reload and import/export plumbing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.ts`
- [x] T013 Extend preload and renderer typing for the follow-up library commands in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts`

**Checkpoint**: Routing-validation and library workflow contracts are ready for UI work.

---

## Phase 3: User Story 1 - Refine Routing And Chain Editing (Priority: P1) MVP

**Goal**: Make routing safer and chain editing more capable without breaking the core Mixer workflow.

**Independent Test**: Attempt invalid routings, duplicate or paste entries, and perform drag-based or command-based chain movements while confirming the canonical mixer stays valid.

### Tests for User Story 1

- [x] T015 [P] [US1] Add routing warning and rejection tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/mixer-routing-validation.test.ts`
- [x] T016 [P] [US1] Add advanced chain editing tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/mixer-chain-editing-advanced.test.tsx`
- [x] T017 [P] [US1] Add destination-option synchronization tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/mixer-destination-options.test.tsx`

### Implementation for User Story 1

- [x] T018 [US1] Add inline routing validation messaging to the Mixer UI in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/mixer/`
- [x] T019 [US1] Add duplicate, copy, paste, and cross-chain move actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/mixer/`
- [x] T020 [US1] Implement canonical patch handling for the new chain operations in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T021 [US1] Keep routing destination lists synchronized with current mixer topology in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/mixer/`
- [x] T022 [US1] Add any needed subchannel-management affordances in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`

**Checkpoint**: Routing changes are safer and chain editing is substantially closer to daily-use parity.

---

## Phase 4: User Story 2 - Polish Effects Library Workflow Without Persistence Redesign (Priority: P1)

**Goal**: Improve the session-local effects library workspace with richer organization and explicit file-level import/export.

**Independent Test**: Reorganize the session with drag/drop or copy/paste, import or export an effect file, and reload from disk without any automatic save-back behavior.

### Tests for User Story 2

- [x] T023 [P] [US2] Add effects-library drag/drop and copy/paste tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/effects-library-workspace.test.tsx`
- [x] T024 [P] [US2] Add import/export command tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.test.ts`
- [x] T025 [P] [US2] Add reload-discard UX tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/effects-library-modal.test.tsx`

### Implementation for User Story 2

- [x] T026 [US2] Add drag/drop reorganization support to `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/EffectLibraryModal.tsx`
- [x] T027 [US2] Add copy, paste, and duplicate actions for categories and effects in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/mixer/library/`
- [x] T028 [US2] Implement explicit effect import/export commands in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.ts`
- [x] T029 [US2] Add reload/discard session UX in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/EffectLibraryModal.tsx`
- [x] T030 [US2] Keep all library workflow changes no-save and session-local in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.ts`

**Checkpoint**: The effects-library workspace is meaningfully more usable without committing the app to a persistence strategy.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and handoff preparation.

- [x] T038 [P] Update `/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/quickstart.md` with any implementation-specific validation notes discovered during development
- [x] T039 [P] Update the Spec 035 feature documentation with implementation progress and any further deferrals
- [x] T040 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`
- [x] T041 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`
- [x] T042 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron` if routing validation helpers land in `@blue/data`
- [x] T044 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`
- [x] T045 Perform the manual routing and library-workflow scenarios from `/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational and is the MVP for this follow-up slice.
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from US1 because library-to-mixer workflows share validation and clipboard behavior.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundational.
- **US2 (P1)**: Depends on Foundational and the session-library baseline from Spec 034.

### Parallel Opportunities

- Setup inventory tasks T002-T004 can run in parallel.
- Foundational tests T005-T007 can run in parallel.
- US1 tests T015-T017 can run in parallel.
- US2 tests T023-T025 can run in parallel.
- Polish documentation tasks T038-T039 can run in parallel.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 only.
3. Validate routing safety and advanced chain editing.
4. Stop and review before expanding into library workflow polish.

### Incremental Delivery

1. Land pure routing validation plus chain clipboard operations.
2. Land advanced Mixer chain UI.
3. Land session-library import/export, reload, and reorganization polish.

### Handoff Notes

- Keep persistence redesign out of scope even if the session workflow becomes more capable.
- Preserve the one-window-per-owner model from Spec 034; new window/editor behavior belongs in a later explicit specification.
- Do not reopen the withdrawn playback-aware/windowing scope from this task list.
