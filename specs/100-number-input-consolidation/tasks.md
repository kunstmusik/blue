---
description: "Implementation tasks for Number Input Consolidation"
---

# Tasks: Number Input Consolidation

Input: Design documents from /Users/stevenyi/work/blue-electron/specs/100-number-input-consolidation/

Prerequisites: plan.md, spec.md, research.md, data-model.md, contracts/commit-number-input.md, and quickstart.md

Scope: This is a renderer-only consolidation. The current research.md inventory is canonical: all 66 audited native number-input sites migrate, split into 37 ordinary sites in User Story 3 and 29 specialized sites in User Story 4. Numeric text/unit editors and string-typed project-property fields remain out of scope.

Verification: Preserve the existing project/settings/dialog owners and .blue/CSD/XML/IPC contracts. Use Java Blue as the field-specific parity reference, focused Vitest regressions at the lowest practical boundary, browser tests for native event ordering, the static source-boundary check, and the Electron/manual matrix from quickstart.md.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare the existing renderer test/build infrastructure and establish the implementation scope.

- [X] T001 [P] Confirm the renderer-only scope, existing Vitest/jsdom and Playwright harnesses, and no-new-dependency policy in packages/blue-app/package.json, packages/blue-app/vitest.config.ts, packages/blue-app/vitest.browser.config.ts, and specs/100-number-input-consolidation/plan.md.
- [X] T002 [P] Create the focused test entry points packages/blue-app/src/renderer/tests/commit-number-input.test.tsx, packages/blue-app/src/renderer/tests/number-input-inventory.test.ts, and packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx using the repository’s existing test conventions.

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Establish compatibility, ownership, boundary, and browser-hosting fixtures before changing or multiplying the component.

Critical: Complete this phase before implementing any user story.

- [X] T003 [P] Compare the current TypeScript lifecycle with ~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/soundObject/editor/jmask/ConstantEditor.java and retain the intentional deferred-vs-live distinction in specs/100-number-input-consolidation/research.md.
- [X] T004 [P] Encode the transient state-ownership boundary from specs/100-number-input-consolidation/data-model.md and specs/100-number-input-consolidation/contracts/commit-number-input.md in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx, proving that project patches, settings persistence, dialog confirmation, and row validation remain caller-owned.
- [X] T005 [P] Build the AST/source-boundary helper in packages/blue-app/src/renderer/tests/number-input-inventory.test.ts so it counts the 66 audited production sites separately from actual native input type="number" implementations and ignores tests, browser fixtures, wrappers, and the component’s own implementation.
- [X] T006 [P] Add the owner-document and secondary-window fixture in packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx, using the existing browser configuration to verify adopted/floating content without global document, window, or cross-realm instanceof assumptions.
- [X] T007 [P] Add boundary/style assertions in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx and packages/blue-app/src/renderer/tests/caller-classname.test.tsx for cn() caller precedence, semantic typography roles, actual-input class/style targeting, button semantics, and the constraints in docs/typography.md and docs/popout-popup-conventions.md.

---

## Phase 3: User Story 1 - Immediate Stepper Commit (Priority: P1) 🎯 MVP

Goal: Make every accepted mouse or ArrowUp/ArrowDown step notify the current editing owner immediately while preserving deferred typed-text editing, Escape cancellation, and one-shot finish behavior.

Independent Test: In packages/blue-app/src/renderer/tests/commit-number-input.test.tsx and packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx, verify three immediate 1.0→1.1→1.2→1.3 updates, valid-draft and invalid/empty-draft step bases, boundary no-ops, Escape-after-step, focus retention, and no duplicate Enter/blur or Escape/blur notifications.

### Verification for User Story 1

- [X] T008 [US1] Reproduce the current delayed-spinner and duplicate Enter/blur and Escape/blur failures before changing production behavior in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx, asserting callback history and the authoritative value rather than only rendered text.
- [X] T009 [US1] Add jsdom contract cases in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx for deferred typed drafts, immediate explicit steps, valid draft base selection, empty/invalid fallback to the latest accepted value, rapid steps before rerender, bound no-ops, disabled/readOnly controls, external snapshot reconciliation, and Escape returning to the last accepted value.
- [X] T010 [P] [US1] Add browser event-order cases in packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx for real step-button clicks, ArrowUp/ArrowDown, focus retention, nonzero native step bases, off-grid decimals, repeated keyboard input, step="any" fractional stepping, and immediate commit without blur.

### Implementation for User Story 1

- [X] T011 [US1] Implement the discriminated deferred/live/draft props, finite parsing and pure resolver hooks, latest accepted/draft refs, controlled snapshot reconciliation, and transient ownership in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx according to specs/100-number-input-consolidation/contracts/commit-number-input.md.
- [X] T012 [US1] Consolidate blur, Enter, and Escape into one settled finish/cancel path in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx, marking the session settled before blur or owner notification so no callback is duplicated or based on stale text.
- [X] T013 [US1] Implement the shared step operation in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx: choose a valid complete draft or the latest accepted base, use detached native step arithmetic from the input’s ownerDocument, preserve min/max/step/base, anchor visible step="any" by one, validate the candidate, and treat impossible or boundary steps as no-ops.
- [X] T014 [US1] Add explicit non-submitting Increase/Decrease controls and ArrowUp/ArrowDown routing in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx, preventing focus transfer and duplicate native/wheel stepping while preserving caller key/click handler ordering.
- [X] T015 [US1] Complete the native/ref/accessibility/style contract in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx: forward the required native attributes, keep type="number" and input ids, preserve disabled/readOnly behavior, use cn() with caller precedence, support containerClassName, add semantic step-button names, and preserve CommitNumberField label association.

Checkpoint: The existing jmask component is behaviorally fixed and independently verifiable before relocation or broad migration.

---

## Phase 4: User Story 2 - One Shared Component in a Central Location (Priority: P2)

Goal: Move the finished primitive to the top-level renderer components location and make every jmask consumer use that single module without changing its established behavior.

Independent Test: packages/blue-app/src/renderer/tests/caller-classname.test.tsx, packages/blue-app/src/renderer/tests/jmask-editor-contract.test.tsx, and the jmask editor suites pass with imports from packages/blue-app/src/renderer/components/CommitNumberInput.tsx; no old jmask module or import remains.

### Implementation and Verification for User Story 2

- [X] T016 [US2] Move packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx to packages/blue-app/src/renderer/components/CommitNumberInput.tsx, update its cn import for the new depth, and preserve the default CommitNumberInput and named CommitNumberField exports.
- [X] T017 [US2] Update the jmask imports in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JMaskEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/TableEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/generator-editors.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/modifier-editors.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/probability-editors.tsx to the central module.
- [X] T018 [P] [US2] Update packages/blue-app/src/renderer/tests/caller-classname.test.tsx and packages/blue-app/src/renderer/tests/jmask-editor-contract.test.tsx to exercise the central import, caller class override, default step behavior, input structure, and CommitNumberField label association.
- [X] T019 [US2] Remove the obsolete jmask module and stale imports, then verify the relocation with packages/blue-app/src/renderer/tests/number-input-inventory.test.ts, packages/blue-app/src/renderer/tests/caller-classname.test.tsx, and the existing jmask editor tests without changing CommitTextInput in packages/blue-app/src/renderer/components/workbench/panels/score-object/ScoreObjectPropertiesForm.tsx.

Checkpoint: A developer can import the single central numeric primitive, and all existing jmask consumers remain behaviorally compatible.

---

## Phase 5: User Story 3 - Migrate Eligible Number Inputs (Priority: P3)

Goal: Migrate the 37 ordinary audited sites while preserving each field’s parser, fallback, bound, disabled, finite-value, unit-transform, and cross-field rules.

Independent Test: The ordinary-field suites and number-input-inventory.test.ts prove that the settings, effect, workbench, BSB, line-editor, tracker, pattern, and pianoroll sites use the shared component and never persist non-finite or out-of-policy values.

### Verification for User Story 3

- [X] T020 [P] [US3] Extend packages/blue-app/src/renderer/tests/settings-window.test.tsx, packages/blue-app/src/renderer/tests/osc-settings.test.tsx, packages/blue-app/src/renderer/tests/virtual-keyboard-panel.test.tsx, packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx, and packages/blue-app/src/renderer/tests/mixer-panel.test.tsx for deferred editing, empty/non-finite handling, integer/default policies, disabled fields, display/storage transforms, and preserved input[type="number"] attributes.
- [X] T021 [P] [US3] Extend packages/blue-app/src/renderer/tests/bsb-property-validation.test.ts, packages/blue-app/src/renderer/tests/bsb-editor.test.tsx, and packages/blue-app/src/renderer/tests/line-object-editor-parity.test.tsx for BSB defaults, step="any", dynamic neighboring bounds, endpoint readOnly behavior, paired-line rejection, and point y rejection versus x clamping.
- [X] T022 [P] [US3] Extend packages/blue-app/src/renderer/tests/tracker-score-object-editor-keyboard.test.tsx, packages/blue-app/src/renderer/tests/pianoroll-parity.test.ts, and packages/blue-app/src/renderer/tests/score-object-editor-fallbacks.test.tsx for integer truncation/revert/ignore rules, conditional step="any", disabled range drafts, and float field defaults.

### Implementation for User Story 3

- [X] T023 [US3] Implement SettingsNumberField in packages/blue-app/src/renderer/components/settings/SettingsField.tsx and migrate the seven numeric settings sites in packages/blue-app/src/renderer/components/settings/OscSettings.tsx, packages/blue-app/src/renderer/components/settings/PlaybackSettings.tsx, packages/blue-app/src/renderer/components/settings/UtilitySettings.tsx, packages/blue-app/src/renderer/components/settings/GeneralSettings.tsx, and packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx, preserving caller-owned drafts, OSC empty-to-zero invalid validation, defaults, disabled buffers, labels, descriptions, and native bounds.
- [X] T024 [P] [US3] Migrate the ordinary effect and BSB fields in packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx, packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBGridSettingsPanel.tsx, and packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx, preserving parseInt/parseFloat fallback behavior, step="any", and each existing patch or paired-field rule.
- [X] T025 [P] [US3] Migrate the three virtual-keyboard fields in packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx, the mixer field in packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx, and both BlueLive fields in packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx, preserving MIDI 1-based display/storage conversion, disabled velocity, inline width/style, integer versus float parsing, empty revert, and finite commits.
- [X] T026 [P] [US3] Migrate the four shared line-editor fields in packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/LineDefinitionTable.tsx and packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx, preserving dynamic neighbor bounds, strict min<max rejection, readOnly endpoints, x clamping, y rejection, point identity, and step="any"/0.001 behavior.
- [X] T027 [P] [US3] Migrate the remaining ordinary score-object and pianoroll fields in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/ZakLineObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/PatternObjectEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/FieldDefinitionsEditor.tsx, preserving per-field parseInt/parseFloat, revert versus ignore behavior, conditional steps, range toggles, and step="any".
- [X] T028 [US3] Update packages/blue-app/src/renderer/tests/number-input-inventory.test.ts with the final ordinary-site expectations and verify that all 37 ordinary audited occurrences route directly or through SettingsNumberField to packages/blue-app/src/renderer/components/CommitNumberInput.tsx, with no independent native number implementation.
- [X] T029 [US3] Run the ordinary-field validation commands from specs/100-number-input-consolidation/quickstart.md and record callback/state results for the settings, workbench, BSB, line-editor, tracker, pattern, and pianoroll policies in the implementation handoff.

Checkpoint: The 37 ordinary sites are migrated, independently tested, and protected from invalid numeric persistence.

---

## Phase 6: User Story 4 - Preserve Specialized Editing Policies (Priority: P4)

Goal: Migrate the 29 blue-x7 and dialog sites while retaining live update timing, undo granularity, mixed values, caller-owned drafts, validation errors, and confirmation/cancellation boundaries.

Independent Test: The blue-x7 and dialog suites show live accepted edits remain live, OK/Apply emits exactly the existing transaction, Cancel emits no project patch, invalid drafts remain available to validators, and Enter/Escape are handled once.

### Verification for User Story 4

- [X] T030 [P] [US4] Extend packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx, packages/blue-app/src/renderer/tests/blue-x7-undo.test.tsx, packages/blue-app/src/renderer/tests/blue-x7-envelope.test.tsx, and packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx for per-keystroke live patches, undo granularity, mixed placeholders, envelope gesture refs, domain rejection, and transpose display/storage conversion.
- [X] T031 [P] [US4] Extend packages/blue-app/src/renderer/tests/tempo-map-modal.test.tsx, packages/blue-app/src/renderer/tests/meter-map-modal.test.tsx, packages/blue-app/src/renderer/tests/meter-row-parity.test.tsx, and the relevant BSB/dialog tests for latest draft on OK, single patch per confirmation, Cancel with no project mutation, error/revert behavior, disabled first rows, selection, rounding, and native input structure.
- [X] T032 [P] [US4] Add named draft-interface cases in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx and packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx for callback-free caller-owned Enter/Escape, row `onFinish` receiving the latest text exactly once, Escape invoking `onCancel` without blur-finishing, invalid-draft retention, rejected step candidates, and step-then-Cancel transaction isolation.

### Implementation for User Story 4

- [X] T033 [P] [US4] Migrate all 22 blue-x7 numeric sites in packages/blue-app/src/renderer/components/instruments/blue-x7/lfo-panel.tsx, packages/blue-app/src/renderer/components/instruments/blue-x7/common-panel.tsx, packages/blue-app/src/renderer/components/instruments/blue-x7/operator-panel.tsx, and packages/blue-app/src/renderer/components/instruments/blue-x7/pitch-envelope-panel.tsx using `LiveNumberInput` and existing integer/domain resolvers, preserving mixed placeholders, ids/aria-labels, undo descriptions, transpose offsets, envelope drafts, and gesture ownership.
- [X] T034 [P] [US4] Migrate the five OK-commit/dialog-owned numeric sites in packages/blue-app/src/renderer/components/workbench/panels/score/TempoPointDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/ShiftObjectsDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/MeterEntryDialog.tsx, and packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx using `DraftNumberInput` without field finish/cancel callbacks, preserving dynamic bounds, empty defaults, select-on-focus, inline errors, confirm-time rounding, disabled states, and dialog Enter/Escape.
- [X] T035 [P] [US4] Migrate the two row-editor numeric sites in packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx and packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx using field-owned row keys and domain finish/cancel callbacks, preserving uniqueness/positivity validation, error visibility, revert/rounding rules, disabled first rows, and the existing input[type="number"] selectors while leaving unit-aware text inputs unchanged.
- [X] T036 [US4] Remove only duplicated generic Enter/blur/Escape handling made obsolete by the shared primitive in packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/TempoPointDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/ShiftObjectsDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/MeterEntryDialog.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx, retaining domain validation and dialog transaction owners.
- [X] T037 [US4] Update packages/blue-app/src/renderer/tests/number-input-inventory.test.ts and the specialized suites to verify that all 29 specialized occurrences use the shared component, that no old jmask path remains, and that all research.md rules are still represented by a test.

Checkpoint: All specialized workflows use the shared primitive without changing live, draft, validation, undo, or confirmation semantics.

---

## Phase 7: Polish & Cross-Cutting Concerns

Purpose: Close the inventory, validate the real runtime, and complete proportional repository checks.

- [X] T038 [P] Reconcile specs/100-number-input-consolidation/research.md with the final source inventory, preserving every migrated/kept disposition, exact field rule, out-of-scope numeric-text list, and any intentional TypeScript/Java divergence.
- [X] T039 [P] Run the Electron/manual matrix in specs/100-number-input-consolidation/quickstart.md on available macOS, Windows, and Linux runtimes, including jmask steps, empty/invalid bases, specialized dialogs, popout/secondary-window focus, narrow layout, keyboard tabbing, and assistive names; record runtime versions and unavailable checks.
- [X] T040 [P] Inspect final renderer sources under packages/blue-app/src/renderer/ for stale jmask/CommitNumberInput imports, independent native number implementations, prohibited class composition, raw typography sizes, global popup/document access, or accidental changes to @blue/data, XML/CSD, IPC, settings persistence, and project ownership.
- [X] T041 Run the complete validation from specs/100-number-input-consolidation/quickstart.md: focused app tests, browser test, pnpm --filter @blue/app test, renderer typecheck, renderer build, pnpm test, pnpm lint, and git diff --check; run build:main only if implementation changes unexpectedly touch packages/blue-app/src/main/.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): T001 and T002 have no implementation dependencies and can run in parallel.
- Foundational (Phase 2): T003–T007 depend on Setup and can run in parallel; they block all user stories.
- User Story 1 (Phase 3): T008–T015 depend on the Foundation. T008 must reproduce the baseline before T011–T015 change the lifecycle.
- User Story 2 (Phase 4): T016–T019 depend on the completed US1 component so relocation is behavior-preserving.
- User Story 3 (Phase 5): T020–T029 depend on the central component from US2; the verification tasks can begin before the corresponding migrations.
- User Story 4 (Phase 6): T030–T037 depend on the central component from US2 and can proceed in parallel with US3 after the shared contract is stable.
- Polish (Phase 7): T038–T041 depend on the desired user stories being complete.

### User Story Dependencies

- User Story 1 (P1): Can start after Phase 2; no other user-story dependency. This is the MVP.
- User Story 2 (P2): Depends on US1 only to relocate the finished behavior without mixing relocation and lifecycle changes.
- User Story 3 (P3): Depends on US2 for the central import and on US1 for the complete discriminated component contract; it is independently testable against existing settings/project owners.
- User Story 4 (P4): Depends on US2 for the central import and on US1 for live/draft/key ownership; it is independently testable against existing blue-x7/dialog owners and can run alongside US3.

### Within Each User Story

- Verification/reproduction tasks precede production implementation where the harness supports a failing regression.
- The shared primitive contract and one finish path precede field migrations.
- Caller-owned parsing, unit conversion, domain validation, undo, settings Apply, project patching, and dialog OK/Cancel remain at the existing call sites.
- The static inventory is checked after each migration family and again after all 66 sites are complete.

## Parallel Opportunities

- Setup tasks T001–T002 are independent.
- Foundation tasks T003–T007 are independent reviews/fixtures once Setup is ready.
- In US1, T009 and T010 can proceed in parallel after T008; T011–T015 are sequential because they edit the same primitive.
- In US3, T020–T022 can proceed in parallel, then T024–T027 can proceed in parallel after T023 establishes SettingsNumberField and the shared contract.
- In US4, T030–T032 can proceed in parallel, then T033–T035 can proceed in parallel because they touch separate feature families.
- US3 and US4 can be staffed in parallel after US2.
- Polish evidence tasks T038–T040 can run in parallel; T041 is the final aggregate check.

## Parallel Example: User Story 1

After T008 reproduces the baseline, run the jsdom contract expansion in packages/blue-app/src/renderer/tests/commit-number-input.test.tsx (T009) alongside the native browser event coverage in packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx (T010). Implement T011–T015 sequentially in the shared component and rerun both suites.

## Parallel Example: User Story 3

After the shared component is stable, run the settings/effect/workbench regression updates (T020), BSB/line regression updates (T021), and score-object regression updates (T022) in parallel. Then split ordinary migration across the settings adapter (T023), effect/BSB files (T024), virtual keyboard/mixer/BlueLive (T025), line editors (T026), and tracker/pattern/pianoroll files (T027), followed by T028–T029.

## Parallel Example: User Story 4

Run blue-x7 regression coverage (T030), dialog/row regression coverage (T031), and shared draft/key tests (T032) in parallel. Once those tests establish the expected policies, migrate blue-x7 (T033), OK-commit dialogs (T034), and row editors (T035) in parallel; complete handler cleanup and inventory verification with T036–T037.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational work.
3. Reproduce and fix immediate step commits in Phase 3.
4. Stop and validate the jmask component with the focused jsdom/browser tests.
5. Demo the corrected step/Escape behavior before broad migration.

### Incremental Delivery

1. Add User Story 2 to centralize the tested primitive and update jmask imports.
2. Add User Story 3 to migrate ordinary fields and validate all 37 policies.
3. Add User Story 4 to migrate blue-x7 and dialog fields while preserving specialized ownership.
4. Finish the static inventory, Electron/manual matrix, and repository-wide checks.

### Simplicity and Boundary Rules

- Keep helpers and types in packages/blue-app/src/renderer/components/CommitNumberInput.tsx unless a demonstrated second consumer requires extraction.
- Do not add a form engine, state-machine dependency, custom decimal engine, timer/press-and-hold behavior, generic suffix/error framework, or new persistence/IPC contract.
- Keep numeric text/unit editors, CommitTextInput, and string-typed project-property fields outside this feature.

---

## Phase 8: Convergence

Purpose: Close implementation and verification gaps found by the post-implementation spec/plan/tasks audit.

- [X] T042 **[CRITICAL]** Reconcile the renderer typecheck and aggregate validation evidence required by Constitution V and T041 (partial): run `pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json`, fix any diagnostics introduced in the Spec 100 scope, and either make the check pass or record the exact pre-existing diagnostics as a scoped exception with evidence that this feature adds none; then rerun and record every command required by specs/100-number-input-consolidation/quickstart.md, including workspace `pnpm test`.
- [X] T043 **[HIGH]** Strengthen packages/blue-app/src/renderer/tests/number-input-inventory.test.ts to verify FR-007, SC-002, T028, and T037 (partial) against the audited 66 production occurrences: assert the expected per-interface/per-file migrated inventory (37 ordinary and 29 specialized, or an equivalently explicit canonical manifest), while separately asserting zero raw native number inputs and zero old jmask imports; remove or use the currently unused `ORDINARY_MIGRATED_FILES` manifest.
- [X] T044 **[HIGH]** Add direct caller-level regression coverage for the specialized OK/Cancel numeric dialogs required by T031 (partial), including packages/blue-app/src/renderer/components/workbench/panels/score/TempoPointDialog.tsx and packages/blue-app/src/renderer/components/workbench/panels/score/ShiftObjectsDialog.tsx (and FontChooserDialog where its existing suite does not exercise the numeric transaction): prove OK consumes the latest unblurred draft exactly once, Cancel/Escape performs no project mutation, and dialog-owned Enter/Escape continues to bubble through callback-free `DraftNumberInput`.
- [X] T045 **[HIGH]** Execute and record the Electron/manual matrix from specs/100-number-input-consolidation/quickstart.md required by T039 (missing): capture actual runtime/OS versions and results for the available macOS, Windows, and Linux checks, including native step arithmetic, invalid/empty bases, specialized dialogs, secondary-window focus, layout, keyboard navigation, and accessible names; for every unavailable runtime, record the exact unexecuted scenario rather than marking the matrix complete.
- [X] T046 **[MEDIUM]** Complete the Meter Map row-key contract in packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx and packages/blue-app/src/renderer/tests/meter-map-modal.test.tsx for plan step 4 and T035 (partial): give the numeric measure row a domain revert `onCancel`, and prove Escape restores the accepted measure without finishing the field, committing the dialog, or closing it.
- [X] T047 **[MEDIUM]** Remove the global `document` fallback from native stepping in packages/blue-app/src/renderer/components/CommitNumberInput.tsx and extend the focused/browser realm test as needed to enforce the owner-document-only contract in specs/100-number-input-consolidation/contracts/commit-number-input.md and T006 (partial); a missing mounted input must safely no-op rather than crossing realms.

Checkpoint: All audited sites are counted, specialized key/transaction ownership is covered at caller level, host-realm stepping matches the contract, and the runtime/typecheck evidence is complete and reproducible.

---

## Phase 9: Convergence

Purpose: Resolve the remaining strict-type, native step-base, and Electron-verification gaps found after Phase 8.

- [X] T048 **[CRITICAL]** Make the Spec 100 production scope compile under `pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json`, including the tuple mismatch in packages/blue-app/src/renderer/components/instruments/blue-x7/common-panel.tsx and the optional line bounds passed to `CommitNumberInput` in packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx; record the exact unrelated pre-existing diagnostics as a scoped exception and rerun the affected tests, build, lint, and typecheck per Constitution V and T041/T042 (contradicts).
- [X] T049 Preserve the stable native value-content-attribute step base in packages/blue-app/src/renderer/components/CommitNumberInput.tsx instead of leaving `valueAttrBase` unused, and extend packages/blue-app/src/renderer/browser/commit-number-input.browser.test.tsx with the required non-`any` off-grid and repeated-key cases proving the base is not reset as accepted values change per FR-010, plan step 2, T010, and T013 (partial).
- [X] T050 Run the documented native interactions in the actual Electron 35 runtime on macOS and replace test-suite citations in the “AVAILABLE & FULLY EXECUTED” column of specs/100-number-input-consolidation/quickstart.md with observed Electron results; retain exact Windows/Linux unavailability and outstanding scenarios per plan: validation strategy and T039/T045 (partial).

Checkpoint: Feature-scope TypeScript is strict-clean, off-grid native stepping retains its stable base across repeated keys, and the available-platform record distinguishes actual Electron observations from browser/unit evidence.
