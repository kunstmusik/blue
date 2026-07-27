# Tasks: Context-Aware UDO Code Completions

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/063-udo-code-completions/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/udo-completion-contract.md`, `quickstart.md`

**Tests**: The constitution and plan require test-first regression coverage. Complete each verification task and confirm its new assertions fail for the expected missing behavior before completing the paired implementation task.

**Organization**: Tasks are grouped by user story so each priority can be implemented and accepted as a distinct increment. Repository-relative paths are rooted at `/Users/stevenyi/work/blue-electron`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same execution wave because it changes different files and has no dependency on their incomplete work.
- **[Story]**: Maps to User Story 1, 2, 3, 4, or 5 from `spec.md`.
- Every checklist item names the exact file or files it changes or validates.

---

## Phase 1: Setup (Baseline Evidence)

**Purpose**: Capture a clean behavioral baseline before changing the shared completion adapter.

- [X] T001 Run the existing `csound-editor-parity`, orchestra, BSB, UDO, effect, library, and Sound editor tests and record the dated baseline commands/results in `specs/063-udo-code-completions/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish portable signature normalization and the signature-bearing editor adapter required by every user story.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T002 [P] Write failing exhaustive tests for classic/modern input and output token normalization, whitespace/grouping equivalence, no-output forms, explicit annotations, inferred rate/type notation, defaults, arrays, optional modifiers, and incomplete declarations in `packages/blue-data/src/opcodes/udo-type-utils.test.ts`
- [X] T003 Implement and statically export the normalized callable-signature result and completeness rules in `packages/blue-data/src/opcodes/udo-type-utils.ts` and `packages/blue-data/src/index.ts`
- [X] T004 [P] Write failing completion-contract tests for signature-bearing context/project definitions, visible signature/source metadata, authored-name insertion, document-source creation, and preservation of existing non-UDO categories in `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts`
- [X] T005 [P] Replace the internal name-only UDO option with readonly context/project UDO definition contracts in `packages/blue-app/src/renderer/components/workbench/panels/editors/editor-adapter-types.ts`
- [X] T006 Implement the basic source-aware UDO candidate-to-CodeMirror row pipeline, consume the portable signature helper, and migrate the old project-name fixture in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts` and `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts`

**Checkpoint**: Full UDO definitions can enter one reusable completion adapter, normalize into visible signatures, and coexist with the established completion categories.

---

## Phase 3: User Story 1 - Use Available UDOs While Writing Orchestra Code (Priority: P1) 🎯 MVP

**Goal**: Project Global Orchestra, instrument, and Sound orchestra fields offer their explicit owner/project UDO scope while score and JavaScript source fields remain unchanged.

**Independent Test**: Open project Generic, JavaScript, BlueSynthBuilder, and Sound editors with one owner UDO and one project-global UDO; verify both appear in every specified orchestra field, project-only UDOs appear in Global Orchestra, and Global Sco/JavaScript source receive no context-aware UDOs.

### Verification for User Story 1

- [X] T007 [P] [US1] Write failing Global Orchestra project-UDO scope tests in `packages/blue-app/src/renderer/tests/project-editor-panels.test.ts`
- [X] T008 [P] [US1] Write failing Generic and JavaScript Instrument owner-plus-project scope and Global Sco/JavaScript source exclusion tests in `packages/blue-app/src/renderer/tests/orchestra-code-instrument-editors.test.tsx`
- [X] T009 [P] [US1] Write failing BlueSynthBuilder Instrument/Always On/Global Orc aggregation, BSB replacement-key preservation, and Global Sco exclusion tests in `packages/blue-app/src/renderer/tests/bsb-editor.test.tsx`
- [X] T010 [P] [US1] Write failing project Sound BlueSynthBuilder owner-plus-project scope tests in `packages/blue-app/src/renderer/tests/score-object-editor-panel.test.tsx`

### Implementation for User Story 1

- [X] T011 [US1] Thread current project UDO snapshots through the project orchestra host and explicit instrument editor props in `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/types.ts`
- [X] T012 [US1] Supply project-only scope to Global Orchestra and owner-plus-project scope only to Generic/JavaScript orchestra fields in `packages/blue-app/src/renderer/components/workbench/panels/GlobalOrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GenericInstrumentEditor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/JavaScriptInstrumentEditor.tsx`
- [X] T013 [US1] Split BlueSynthBuilder orchestra and score completion options while preserving replacement keys in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueSynthBuilderEditor.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBCodeEditor.tsx`
- [X] T014 [US1] Pass explicit project-host UDO scope through the score editor registry into project Sound code fields in `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editor-registry.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx`

**Checkpoint**: User Story 1 is independently usable across all specified project orchestra-code fields and constitutes the MVP.

---

## Phase 4: User Story 2 - Use UDOs While Authoring UDOs and Effects (Priority: P1)

**Goal**: Project and library UDO bodies and effect editors receive the correct owner/project scope, including separate project effect windows and strict library isolation.

**Independent Test**: Request completion in global and embedded UDO bodies, inline and separate project effect Code/UDO tabs, and standalone library instrument/Sound/effect/UDO editors; verify project contexts include globals and library contexts never do.

### Verification for User Story 2

- [X] T015 [P] [US2] Write failing project-global, embedded instrument/BSB, recursive self, and standalone library UDO-body scope tests in `packages/blue-app/src/renderer/tests/user-defined-opcode-panel.test.tsx`, `packages/blue-app/src/renderer/tests/udo-workspace-empty.test.tsx`, and `packages/blue-app/src/renderer/tests/bsb-udo-panel.test.tsx`
- [X] T016 [P] [US2] Write failing project/library effect snapshot, inline Code/UDO tab, and initial separate-window scope tests in `packages/blue-app/src/renderer/tests/mixer-effect-editor-contract.test.ts` and `packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx`

### Implementation for User Story 2

- [X] T017 [US2] Add explicit context/project completion props to UDO editors and pass global, embedded, and self scopes through `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoWorkspacePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/UserDefinedOpcodePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/EmbeddedUdoPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBUDOPanel.tsx`
- [X] T018 [US2] Extend the typed effect editor snapshot with a derived project UDO projection, populate it only for project effects, and keep effect patches unable to mutate it in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/main/main.ts`
- [X] T019 [US2] Supply effect-owned and ownership-gated project scope to effect Code/UDO editors in inline and separate-window renderers in `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [X] T020 [US2] Force empty project scope for standalone library instrument, Sound, effect, and UDO hosts while retaining each asset’s owner/self UDOs in `packages/blue-app/src/renderer/components/libraries/editors/InstrumentLibraryEditor.tsx`, `packages/blue-app/src/renderer/components/libraries/editors/SoundObjectLibraryEditor.tsx`, `packages/blue-app/src/renderer/components/libraries/editors/EffectLibraryEditor.tsx`, and `packages/blue-app/src/renderer/components/libraries/editors/UdoLibraryEditor.tsx`

**Checkpoint**: Every UDO/effect authoring surface has a correct initial completion scope, and library assets remain isolated from the open project.

---

## Phase 5: User Story 3 - Choose the Correct Polymorphic UDO (Priority: P1)

**Goal**: Preserve every distinct same-name overload, show normalized signatures and source, shadow only exact identities, and retain same-name native opcode rows.

**Independent Test**: Supply classic/modern same-name UDOs with input-only, output-only, and cross-source signature differences plus an exact duplicate and native collision; verify the expected rows, order, display, and authored-name insertion.

### Verification for User Story 3

- [X] T021 [US3] Extend failing completion tests for input/output polymorphism, classic/modern equivalence, exact context/project/document precedence, incomplete identities, duplicate-within-source removal, native-name coexistence, visible signatures/source, and authored-name application in `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts`

### Implementation for User Story 3

- [X] T022 [US3] Parse complete document-local UDO definitions through the portable parser and retain valid in-progress declarations as incomplete document candidates in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`
- [X] T023 [US3] Implement exact signature identity, source-precedence deduplication, overload-preserving general deduplication, signature/source display, native coexistence, and context/project/document ranking in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`
- [X] T024 [US3] Add the 500-project/100-context repeated-request p95 benchmark and optimize normalization/candidate reuse if required to remain below 100 ms in `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`

**Checkpoint**: Polymorphic UDO completion is independently correct and performant at the specified scale.

---

## Phase 6: User Story 4 - Keep Completion Scope Current and Predictable (Priority: P2)

**Goal**: The next request reflects UDO edits and owner/project switches, including project-global changes made while a separate project effect window remains open.

**Independent Test**: Add, rename, remove, reorder, and convert UDOs; switch owners/projects; and update project globals with a separate effect window open. Verify no reload is required and stale candidates disappear.

### Verification for User Story 4

- [X] T025 [P] [US4] Write failing completion-refresh tests for add/rename/remove/reorder/style conversion, exact-shadow fallback, incomplete-to-complete transition, owner switch, and unloaded project behavior in `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts`
- [X] T026 [P] [US4] Write failing project-document broadcast and separate effect-window UDO projection refresh tests in `packages/blue-app/src/main/effect-editor-window-manager.test.ts` and `packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx`

### Implementation for User Story 4

- [X] T027 [US4] Broadcast the existing typed project-document update event to open project effect windows and keep library effect windows excluded in `packages/blue-app/src/main/effect-editor-window-manager.ts` and `packages/blue-app/src/main/main.ts`
- [X] T028 [US4] Subscribe the separate project effect page to current project UDO projections and memoize/clear completion options from current owner/project arrays in `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/GlobalOrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GenericInstrumentEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/JavaScriptInstrumentEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBCodeEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoEditor.tsx`

**Checkpoint**: Completion scope is live and stale-safe in the main renderer, reusable library editors, and separate project effect windows.

---

## Phase 7: User Story 5 - Preserve Existing Editor and Project Behavior (Priority: P3)

**Goal**: Existing completion categories, excluded languages/surfaces, persistence, and generated CSD remain unchanged.

**Independent Test**: Run existing completion tests, exercise every named excluded editor, save/reopen a representative project, and compare generated CSD before and after completion use.

### Verification for User Story 5

- [X] T029 [P] [US5] Add regression assertions for built-in/Blue opcode, variable, replacement-key, dynamic, and document-local categories plus explicit Generic/JavaScript/BSB Global Sco and JavaScript source exclusions in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts`, `packages/blue-app/src/renderer/tests/orchestra-code-instrument-editors.test.tsx`, and `packages/blue-app/src/renderer/tests/bsb-editor.test.tsx`
- [X] T030 [P] [US5] Add standalone library instrument/Sound/effect/UDO isolation regressions while an unrelated project is loaded in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`
- [X] T031 [P] [US5] Add compatibility assertions that completion construction/application does not dispatch project mutations and that existing UDO snapshot/XML/CSD expectations remain unchanged in `packages/blue-app/src/renderer/tests/tables-udo-contract.test.ts` and `packages/blue-data/src/blue-data-csd-parity.test.ts`

### Implementation for User Story 5

- [X] T032 [US5] Audit and correct option gating so only editable orchestra/UDO contexts receive UDO collections while excluded modes preserve existing behavior in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-language.ts`, `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GenericInstrumentEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/JavaScriptInstrumentEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBCodeEditor.tsx`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx`

**Checkpoint**: All five user stories are complete without persistence, generation, language-mode, or existing-completion regressions.

---

## Phase 8: Polish & Cross-Cutting Validation

**Purpose**: Produce final acceptance evidence and run the constitution-required package gates.

- [X] T033 Execute every manual scope, polymorphism, live-window, library-isolation, performance, and persistence scenario and append dated results or scoped exceptions to `specs/063-udo-code-completions/quickstart.md`
- [X] T034 Run the focused tests, `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm lint`, and `git diff --check`, resolving feature regressions in `packages/blue-data/src/`, `packages/blue-app/src/`, and `specs/063-udo-code-completions/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; captures the baseline.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **User Story 1 (Phase 3)**: Depends only on Foundational and delivers the MVP project orchestra workflow.
- **User Story 2 (Phase 4)**: Depends only on Foundational and may proceed alongside User Story 1 after coordinating shared editor props.
- **User Story 3 (Phase 5)**: Depends only on Foundational and hardens the shared adapter; it may proceed alongside host wiring.
- **User Story 4 (Phase 6)**: Depends on the host surfaces from User Stories 1 and 2 plus the identity behavior from User Story 3.
- **User Story 5 (Phase 7)**: Depends on the selected P1/P2 story implementations so it can prove preservation across the final surface.
- **Polish (Phase 8)**: Depends on all selected stories.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (MVP) ----\
                   \-> US2 ----------+-> US4 -> US5 -> Polish
                   \-> US3 ----------/
```

### Within Each User Story

- Complete the failing verification tasks before their paired production changes.
- Normalize signature semantics in `@blue/data` before constructing renderer identities.
- Establish editor adapter types before wiring component hosts.
- Keep project/library ownership explicit at the host boundary.
- Finish story-specific focused tests before moving past its checkpoint.

### Parallel Opportunities

- **Foundation**: T002, T004, and T005 change separate files and can begin together; T003 follows T002, while T006 follows T003-T005.
- **US1**: T007-T010 are independent test files. After T011 establishes shared props, T012-T014 can be divided by Generic/JavaScript, BSB, and Sound surfaces.
- **US2**: T015 and T016 can run in parallel; after T017/T018 establish UDO and snapshot contracts, T019 and T020 divide project effect and library-host work.
- **Cross-story P1**: US1 host wiring, US2 UDO/effect wiring, and US3 completion hardening can proceed concurrently after Foundation, with coordination limited to the adapter option shape.
- **US4**: T025 and T026 can run in parallel before T027/T028.
- **US5**: T029-T031 are independent regression files before the T032 gating audit.

---

## Parallel Examples

### User Story 1

```text
Task T007: Global Orchestra scope tests in project-editor-panels.test.ts
Task T008: Generic/JavaScript scope tests in orchestra-code-instrument-editors.test.tsx
Task T009: BSB scope tests in bsb-editor.test.tsx
Task T010: Sound scope tests in score-object-editor-panel.test.tsx
```

### User Story 2

```text
Task T015: UDO-body scope tests across UDO/BSB test files
Task T016: Project/library effect scope tests across effect contract/window test files
```

### User Story 4

```text
Task T025: Live candidate refresh tests in udo-code-completions.test.ts
Task T026: Separate effect-window broadcast/refresh tests in main and renderer test files
```

### User Story 5

```text
Task T029: Existing completion and excluded-field regressions
Task T030: Standalone library isolation regressions
Task T031: Project mutation, XML, and CSD compatibility regressions
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete T001-T006 to establish the shared signature-bearing adapter.
2. Complete T007-T014 test-first.
3. Run the User Story 1 focused tests and manual project instrument matrix.
4. Stop and demonstrate owner-plus-project completion in project orchestra editors before expanding to UDO/effect surfaces.

### Incremental Delivery

1. **Foundation**: portable normalization and full-definition adapter.
2. **US1**: Global Orchestra, project instruments, BSB, and Sound.
3. **US2**: UDO bodies, project effects, separate effect window, and library isolation.
4. **US3**: exhaustive polymorphism, precedence, native coexistence, and performance.
5. **US4**: live collection/project/window refresh.
6. **US5**: completion-category, language-mode, XML, and CSD preservation.
7. **Polish**: manual evidence and full affected-package gates.

### Parallel Team Strategy

1. Complete the shared Foundation together.
2. Split project editor wiring (US1), UDO/effect wiring (US2), and completion hardening (US3) across separate owners.
3. Converge on shared adapter option names before merging host work.
4. Complete US4 after the P1 surfaces exist, then run US5 and final validation.

## Notes

- `[P]` tasks never edit the same file in the same execution wave.
- Do not add a persisted completion registry, project XML field, settings key, or CSD-generation behavior.
- Do not infer library/project scope solely from a loaded project store.
- Reuse the existing typed project-document update event for separate project effect windows.
- Keep production imports static and `@blue/data` free of host/UI dependencies.
- Applying a completion inserts only the authored UDO name.

---

## Phase 9: Convergence

- [X] T035 Correct project-global UDO body completion so `UserDefinedOpcodePanel` supplies the global collection only as project-global scope, not simultaneously as context-owned scope, and add an assertion that the resulting rows retain project source/detail in `packages/blue-app/src/renderer/components/workbench/panels/UserDefinedOpcodePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/udo/UdoWorkspacePanel.tsx`, and `packages/blue-app/src/renderer/tests/user-defined-opcode-panel.test.tsx` per FR-008, FR-016, FR-028, FR-029, and FR-031 (partial)
- [X] T036 Extend callable-signature completeness detection and focused tests so unparseable or in-progress classic input types and output types are marked incomplete instead of being treated as complete no-input/no-output signatures in `packages/blue-data/src/opcodes/udo-type-utils.ts` and `packages/blue-data/src/opcodes/udo-type-utils.test.ts` per FR-020 and FR-032 (partial)
- [X] T037 Mark document-local fallback declarations as incomplete and preserve a same-name incomplete document declaration alongside any parsed complete overload, with completion regressions in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts` and `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts` per FR-020, FR-028, and US3/AC8 (partial)
- [X] T038 Strengthen the editor-scope matrix regressions with non-empty owner UDO fixtures for project effect Code and embedded UDO bodies in both in-place and separate-window editors, plus standalone library instrument, Sound, effect Code/UDO, and UDO self-isolation assertions in `packages/blue-app/src/renderer/tests/mixer-effect-editor-contract.test.ts`, `packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx`, and `packages/blue-app/src/renderer/tests/library-editing.test.tsx` per FR-005, FR-006, FR-007, FR-009, FR-011, FR-012, and FR-027 (partial)
- [X] T039 Add renderer-level live-update coverage that invokes the project-document update subscription for an already-open project effect window, proves the next Code and embedded-UDO completion scopes replace the old project UDO projection, and proves library effect windows remain isolated in `packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx` per FR-013, FR-027, US4/AC1, and US4/AC3 (partial)
- [X] T040 Thread the current project UDO collection explicitly from `OrchestraPanel` into `InstrumentEditorPanel` and remove the reusable panel's implicit project-store fallback while retaining explicit empty library scope in `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/libraries/editors/InstrumentLibraryEditor.tsx` per plan: explicit editor-host scope decision and T011 (contradicts)
- [X] T041 Reuse the existing typed project-document update event for project effect windows, consume its `snapshot.projectUdos` projection, make `EffectEditorSnapshot.projectUdos` a required derived field, and remove the added effect-specific channel/API plus new inline import type annotations in `packages/blue-app/src/main/effect-editor-window-manager.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx`, `packages/blue-app/src/renderer/types/global.d.ts`, `packages/blue-app/src/shared/project-editor.ts`, and `packages/blue-app/src/shared/workbench-window-contract.ts` per plan: effect-window update decision, contract: Effect Window Contract, T027, and Constitution III (contradicts)
- [X] T042 Rerun the focused and full affected-package gates after T035-T041, replace unsupported or stale scope/count claims with exact evidence in `specs/063-udo-code-completions/quickstart.md`, and mark `specs/063-udo-code-completions/spec.md` complete only after a follow-up convergence pass reports no findings per FR-027 and SC-001 through SC-006 (partial)
