# Tasks: Score Object Editor Tier 1 Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/038-score-object-editor-tier1-parity/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/  

**Tests**: Tests are required by FR-008. Add contract and renderer coverage before or alongside the implementation it protects.

## Phase 1: Setup

- [X] T001 Review the Java Blue `External`, `PolyObject`, and `TrackerObject` editor anchors documented in `research.md`
- [X] T002 [P] Inventory the current Tier 1 editor routing in `packages/blue-app/src/renderer/components/workbench/panels/score-object/`
- [X] T003 [P] Inventory the relevant `@blue/data` models in `packages/blue-data/src/sound-objects/`

## Phase 2: Foundational Contract Work

- [X] T004 [P] Add shared contract tests for the Tier 1 editor-document payloads
- [X] T005 [P] Extend the score-object editor document union in `packages/blue-app/src/shared/project-editor.ts`
- [X] T006 [ ] Extend main-process editor-document creation helpers for `External`, `PolyObject`, and `TrackerObject`
- [X] T007 [ ] Extend type-specific patch validation for Tier 1 editor payloads

## Phase 3: User Story 1 - External Editor (P1)

- [X] T008 [P] [US1] Add renderer tests for `External` routing and field rendering
- [X] T009 [P] [US1] Add mutation tests for `External` command-line and syntax-type updates
- [X] T010 [US1] Implement `ExternalScoreObjectEditor.tsx`
- [X] T011 [US1] Wire `External` editor patches through canonical update helpers

## Phase 4: User Story 2 - PolyObject Inspector (P1)

- [X] T012 [P] [US2] Add renderer tests for `PolyObject` child rows and generated-score preview
- [X] T013 [P] [US2] Add fallback tests for empty or removed `PolyObject` targets
- [X] T014 [US2] Implement `PolyObjectScoreObjectEditor.tsx`
- [X] T015 [US2] Build `PolyObject` child-row and preview payload helpers in shared or main code
- [X] T016 [US2] Wire supported open/test actions to existing score-path or preview seams

## Phase 5: User Story 3 - TrackerObject Editor (P2)

- [X] T017 [P] [US3] Add renderer tests for tracker toolbar and styled grid behavior
- [X] T018 [P] [US3] Add mutation tests for tracker toolbar and cell edits
- [X] T019 [US3] Implement `TrackerScoreObjectEditor.tsx`
- [X] T020 [US3] Extend tracker editor payload builders and canonical patch handling

## Phase 6: Polish & Validation

- [X] T021 [P] Update `quickstart.md` with any implementation-specific notes
- [X] T022 [P] Update `/Users/stevenyi/work/blue-electron/STATUS.md` with the planning or implementation handoff state for Spec 038
- [X] T023 Run `pnpm --filter @blue/app test`
- [X] T024 Run `pnpm --filter @blue/app build:renderer`
- [X] T025 Run `git diff --check`
- [X] T026 Perform the manual Tier 1 validation scenarios from `quickstart.md`

## Handoff Notes

- Manual Tier 1 quickstart validation was signed off on 2026-05-10.
- Focused TrackerObject keyboard/toolbar and cross-layer soundObject editor continuity were
  rechecked and passed on 2026-08-23; see `quickstart.md` for the regression record.
- Keep `Sound`, `PianoRoll`, and `JMask` out of this slice; they belong to the Tier 2 follow-up spec.
- Reuse the Spec 037 registry and auxiliary panel shell instead of introducing parallel editor infrastructure.
- Reuse Spec 036 nested score navigation for `PolyObject` open-in-score flows wherever possible.
