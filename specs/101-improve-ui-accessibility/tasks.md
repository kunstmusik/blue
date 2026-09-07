---

description: "Actionable task list for the Improve UI Accessibility feature"
---

# Tasks: Improve UI Accessibility

**Status**: Complete — T001 through T066 are implemented; final convergence found no remaining gaps.

**Input**: Design documents from `/specs/101-improve-ui-accessibility/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Verification**: The plan requires executable theme/contrast audits, focused jsdom and browser regressions, two-document popout coverage, a deterministic manual matrix, package validation, and preservation of project-authored data and existing runtime behavior.

**Organization**: Tasks are grouped by the four user stories in `spec.md`; the three P1 stories are delivered before the P2 status story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the current finite inventory, documentation authority, and test entry points before implementation.

- [X] T001 [P] Regenerate the renderer theme, explicit `tabIndex`, outline-suppression, numeric-input, and modal candidate baselines and record the dated counts and source paths in `specs/101-improve-ui-accessibility/contracts/remediation-inventory.md`
- [X] T002 [P] Create the semantic color ownership, WCAG 2.2 AA thresholds, governed-pair rules, focus rules, exception process, and validation command authority in `docs/color-accessibility.md`
- [X] T003 [P] Synchronize the contrast and ownership references in `docs/typography.md` with `docs/color-accessibility.md` while preserving the seven-role catalog and 11 px floor
- [X] T004 [P] Add the `test:browser` script (`vitest --config vitest.browser.config.ts --run`) to `packages/blue-app/package.json` without adding a new dependency

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared audit, ownership, and classification foundations that every story depends on.

**⚠️ CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T005 Define the single machine-readable governed-pair contract, role metadata, contrast floors, representative surfaces, and exact exception schema in `scripts/renderer-accessibility-contract.mjs`
- [X] T006 Extend `scripts/audit-renderer-theme.mjs` to consume `scripts/renderer-accessibility-contract.mjs`, resolve CSS token values, composite alpha colors, calculate WCAG ratios without rounding failures upward, support fixture roots, and report undefined roles, prohibited focus suppression, stale exceptions, and malformed exceptions
- [X] T007 Add deterministic Node test fixtures for passing and failing contrast pairs, alpha compositing, fill/on-fill directionality, undefined aliases, prohibited global focus suppression, exact exceptions, stale exceptions, and malformed exceptions in `scripts/audit-renderer-theme.test.mjs`
- [X] T008 Add `scripts/audit-renderer-theme.test.mjs` to the root `test:scripts` command in `package.json` and verify the script reports failures with actionable paths and line numbers
- [X] T009 [P] Confirm the renderer-only ownership boundary, no-new-persistence decision, no-new-IPC decision, and preservation of `BlueData`/`.blue` project-authored colors and typography in `specs/101-improve-ui-accessibility/data-model.md` and `specs/101-improve-ui-accessibility/contracts/accessibility-contract.md`
- [X] T010 Classify every production `tabIndex` and outline-suppression occurrence and all 33 dialog/modal filename candidates as operable control, non-operable programmatic-focus shell, true modal, non-modal surface, wrapper/helper, or native host dialog, then record the classification and owner file in `specs/101-improve-ui-accessibility/contracts/remediation-inventory.md`

**Checkpoint**: The audit contract is executable, the finite remediation inventory is classified, and story work can proceed without changing persistence or host/runtime boundaries.

---

## Phase 3: User Story 1 - Read Application Content Reliably (Priority: P1) 🎯 MVP

**Goal**: Make every governed application-owned text, essential boundary, active-state, focus, and syntax pair pass its documented WCAG 2.2 AA floor while preserving project-authored visual data.

**Independent Test**: Run the governed-pair audit and browser contrast spot checks against the default dark theme and representative settings, score, mixer, editor, menu, dialog, and empty-state surfaces; all governed pairs pass without rounding and all remaining exceptions are exact ownership exceptions.

### Verification for User Story 1

- [X] T011 [P] [US1] Add failure-first governed contrast cases for muted/subtle text, accent text, text on accent/success/warning fills, CodeMirror comments, essential borders, focus indicators, hover states, pressed states, selected states, and error states in `scripts/audit-renderer-theme.test.mjs`
- [X] T012 [P] [US1] Add rendered default-theme contrast spot checks for application text, primary controls, Mute/Solo controls, CodeMirror comments, essential boundaries, and focus indicators in `packages/blue-app/src/renderer/browser/accessibility-contrast.browser.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Update semantic CSS tokens and shared app-owned styles for text, surfaces, fills, on-fill foregrounds, borders, focus, warning, success, danger, and error with 4.75:1 normal-text and 3.25:1 applicable non-text headroom in `packages/blue-app/src/renderer/styles/index.css` and document each permitted use in `docs/color-accessibility.md`
- [X] T014 [P] [US1] Replace the current failing arbitrary color utilities in `packages/blue-app/src/renderer/components/CommitNumberInput.tsx` with governed semantic roles while retaining native number-input behavior and existing ranges
- [X] T015 [P] [US1] Resolve the current undefined and ungoverned application color aliases in `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerMetadata.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.tsx`
- [X] T016 [P] [US1] Replace current raw, inline, and arbitrary application-owned colors in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreOverlayLines.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`; add only exact project/data/decorative exceptions to `specs/051-theme-token-cleanup/theme-exceptions.md`
- [X] T017 [P] [US1] Raise the CodeMirror comment foreground to the governed contrast floor in `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx` and keep the remaining syntax palette values as exact syntax-owned exceptions in `specs/051-theme-token-cleanup/theme-exceptions.md`
- [X] T018 [US1] Repair the shared primary-button, input, menu, dialog, score-layer, and active Mute/Solo foreground/background pairings in `packages/blue-app/src/renderer/styles/index.css`, `packages/blue-app/src/renderer/components/settings/SettingsField.tsx`, `packages/blue-app/src/renderer/components/AppSelect.tsx`, `packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`
- [X] T019 [US1] Re-run `pnpm audit:renderer-theme` and close every unapproved finding or document an exact justified ownership exception, then update the machine-readable results and regression assertions in `scripts/renderer-accessibility-contract.mjs`, `scripts/audit-renderer-theme.test.mjs`, and `specs/051-theme-token-cleanup/theme-exceptions.md`

**Checkpoint**: User Story 1 is independently demonstrable when the automated audit and browser contrast checks pass for the full governed application-owned inventory.

---

## Phase 4: User Story 2 - Navigate with a Keyboard and Track Focus (Priority: P1)

**Goal**: Make operable controls keyboard reachable, visibly focused, and equivalent to their pointer interactions across all renderer entry points and panel hosts.

**Independent Test**: From each React renderer entry point, traverse representative menus, panels, editors, dialogs, score controls, mixer controls, and BSB controls using only the keyboard; verify focus is visible and each tested value changes predictably without a pointer.

### Verification for User Story 2

- [X] T020 [P] [US2] Add browser focus traversal tests for the five React entry points, menus, scroll containers, score headers, settings fields, editors, dialogs, and compact controls in `packages/blue-app/src/renderer/browser/accessibility-focus.browser.test.tsx`
- [X] T021 [P] [US2] Add failure-first keyboard value-control tests for arrows, PageUp/PageDown, Home/End, clamping, and focus visibility in `packages/blue-app/src/renderer/browser/accessibility-value-controls.browser.test.tsx`

### Implementation for User Story 2

- [X] T022 [US2] Remove the generic `[tabindex]` and separator outline suppression and replace it with documented, non-operable-shell handling plus component-level `focus-visible` treatment in `packages/blue-app/src/renderer/styles/index.css`
- [X] T023 [P] [US2] Repair focus visibility and `cn()` composition for the primary explicit-focus and programmatic-focus workbench surfaces in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/PianoCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBInterfaceCanvas.tsx`
- [X] T024 [P] [US2] Repair focus-visible styles and composed classes for shared fields, menus, dialogs, editors, and remaining classified controls in `packages/blue-app/src/renderer/components/AppSelect.tsx`, `packages/blue-app/src/renderer/components/CommitNumberInput.tsx`, `packages/blue-app/src/renderer/components/settings/SettingsField.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScoreToolbar.tsx`, and the production paths listed in `specs/101-improve-ui-accessibility/contracts/remediation-inventory.md`
- [X] T025 [P] [US2] Replace the bare printable Follow Playback shortcut with `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux in `packages/blue-app/src/renderer/hooks/use-keyboard-shortcuts.ts`, and expose the platform-specific shortcut text in `packages/blue-app/src/renderer/components/menu-bar/PlaybackControls.tsx`
- [X] T026 [P] [US2] Add a renderer-local keyboard step and clamp helper for authored minimum, maximum, resolution, one-percent fallback, page step, and axis direction in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts`
- [X] T027 [P] [US2] Make the mixer fader's existing range input the named keyboard/assistive-technology control, synchronize pointer dragging through the same value path, show focus on the SVG or wrapper, and bind drag cleanup to the owning window in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [X] T028 [P] [US2] Add keyboard slider semantics, authored-range stepping, pointer synchronization, and visible focus treatment to the knob and horizontal/vertical BSB value widgets in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget.tsx`
- [X] T029 [P] [US2] Add independently operable keyboard slider handles to the horizontal/vertical BSB slider banks and independently operable X and Y axes to the XY controller while preserving pointer behavior, authored ranges, and project-authored appearance in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget.tsx`
- [X] T030 [US2] Extend the focused renderer regressions for mixer and BSB keyboard operation, owner-window drag listeners, and no-new global listeners in `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`, `packages/blue-app/src/renderer/tests/bsb-widget-keys.test.ts`, and `packages/blue-app/src/renderer/browser/accessibility-value-controls.browser.test.tsx`

**Checkpoint**: User Story 2 is independently demonstrable when keyboard-only browser tests show visible focus and complete the representative value-control workflows from every renderer host.

---

## Phase 5: User Story 3 - Understand Controls and Dialogs with Assistive Technology (Priority: P1)

**Goal**: Give application-owned forms, numeric controls, toggles, value widgets, and true modals meaningful names, roles, values, states, focus containment, and safe restoration.

**Independent Test**: Inspect the accessibility tree and keyboard behavior for representative settings, number, score, mixer, BSB, and every classified true-modal family; verify names, roles, values, states, focus containment, safe cancellation, and opener restoration.

### Verification for User Story 3

- [X] T031 [P] [US3] Add jsdom accessibility-tree assertions for field/description associations, number-input names, slider roles and values, pressed states, dialog titles and modal state, deterministic initial focus, Escape cancellation, Tab containment, and opener restoration in `packages/blue-app/src/renderer/tests/accessibility-semantics.test.tsx`
- [X] T032 [P] [US3] Add mutation-sensitive two-document coverage for a panel-hosted dialog/popup, including placement in the popout document, popout-only dismissal input, inside-click retention, React event isolation, focus restoration, and cleanup in `packages/blue-app/src/renderer/tests/accessibility-popout.test.tsx`

### Implementation for User Story 3

- [X] T033 [US3] Associate the generated input id, visible label, and optional description with the text, select, checkbox, number, and draft-number paths in `packages/blue-app/src/renderer/components/settings/SettingsField.tsx`
- [X] T034 [P] [US3] Complete the accessible-name review for numeric controls in settings, effect-editor, track-instrument-editor, mixer, Live Space, BSB property/grid/font, and BlueX7 call sites listed in `specs/101-improve-ui-accessibility/contracts/remediation-inventory.md`, updating `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/settings/SettingsField.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBGridSettingsPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx`
- [X] T035 [P] [US3] Complete the accessible-name review for score, JMask, piano-roll, tracker, line-editor, and BlueX7 numeric call sites in `packages/blue-app/src/renderer/components/workbench/panels/score/MeterEntryDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/TempoPointDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JMaskEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerObjectEditor.tsx`, and `packages/blue-app/src/renderer/components/instruments/blue-x7/`
- [X] T036 [US3] Update `packages/blue-app/src/renderer/components/dialogs/use-dialog-focus.ts` to resolve the active dialog's owner/host document, use realm-safe containment and active-element checks, handle empty or single-control dialogs, keep Escape cancellation fail-closed, and restore focus only to a connected opener
- [X] T037 [US3] Update `packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx` to provide stable title/description semantics, `cn()`-composed classes, safe backdrop/window close behavior, destructive intent, and Cancel-first initial focus without changing the native-host/contextual confirmation ownership split
- [X] T038 [P] [US3] Apply the true-modal contract to the instrument, library, and top-level workbench candidates `packages/blue-app/src/renderer/components/instruments/blue-x7/algorithm-dialog.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/sysex-import-dialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibrarySessionDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTransferDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/FreezeOperationDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/GeneratedCsdModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MidiImportDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MissingAudioAssetsModal.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/RenderToDiskDialog.tsx`; leave classified non-modals, wrappers, and native dialogs without false modal semantics
- [X] T039 [P] [US3] Apply the true-modal contract to the code-repository, operation, generated-instrument, and BSB candidates `packages/blue-app/src/renderer/components/workbench/panels/code-repository/AddToCodeRepositoryDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryEditorModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/operation-dialog-shared.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GeneratedInstrumentModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx`
- [X] T040 [P] [US3] Apply the true-modal contract to the score-object, score, and tools candidates `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/GeneratedScoreModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollRulerConfigDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorCodeModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/LayerRemovalConfirmationDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/MeterEntryDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/RulerConfigDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ShiftObjectsDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/TempoPointDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/CsoundRCEditorModal.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/FTableConverterModal.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog.tsx`
- [X] T041 [US3] Add `aria-pressed` or equivalent selected-state semantics, visible text/icon cues, meaningful names, and keyboard focus treatment to score Mute/Solo controls in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`
- [X] T042 [US3] Complete slider names, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, human-readable `aria-valuetext`, bank-handle names, and independent XY-axis names for the mixer and BSB controls in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget.tsx`
- [X] T043 [US3] Expand the existing dialog and panel regressions for role/title/modal state, focus containment, safe cancellation, opener restoration, foreign-document focus, and the native-host versus contextual confirmation split in `packages/blue-app/src/renderer/tests/confirmation-dialog.test.tsx`, `packages/blue-app/src/renderer/tests/panel-dialog-dismissal.test.tsx`, and `packages/blue-app/src/renderer/tests/accessibility-popout.test.tsx`

**Checkpoint**: User Story 3 is independently demonstrable when the semantic tests and accessibility-tree matrix pass for all classified forms, controls, toggles, and true modals.

---

## Phase 6: User Story 4 - Distinguish Status Without Color Alone (Priority: P2)

**Goal**: Make success, warning, danger, connection, mute, solo, and error states understandable through non-color cues and announced when important asynchronous feedback appears.

**Independent Test**: Review the named settings, Live Space, REPL, toast, and score-state surfaces in grayscale and common red/green color-vision simulations; verify each state has a visible non-color cue and important updates have the appropriate live semantics.

### Verification for User Story 4

- [X] T044 [P] [US4] Add jsdom assertions for status roles/live regions, readable messages, visible text/icon/shape cues, and score Mute/Solo state changes in `packages/blue-app/src/renderer/tests/status-accessibility.test.tsx`

### Implementation for User Story 4

- [X] T045 [US4] Update the shared Sonner styling and rendered toaster behavior to use governed semantic tokens, readable status text, and non-color status cues in `packages/blue-app/src/renderer/lib/toast-styles.ts`, `packages/blue-app/src/renderer/main.tsx`, `packages/blue-app/src/renderer/effect-editor.tsx`, and `packages/blue-app/src/renderer/track-instrument-editor.tsx`
- [X] T046 [P] [US4] Add defined semantic status styling, visible text/icon cues, and appropriate live-region behavior for MIDI connection/error states and realtime-render success/failure states in `packages/blue-app/src/renderer/components/settings/MidiSettings.tsx` and `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`
- [X] T047 [P] [US4] Add readable semantic error/status tokens, visible non-color cues, and important asynchronous announcements to Live Space and REPL status surfaces in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.tsx`
- [X] T048 [US4] Review the score Mute/Solo active, inactive, hover, and focus combinations in grayscale and update the text/icon/state presentation and regression assertions in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, and `packages/blue-app/src/renderer/tests/status-accessibility.test.tsx`

**Checkpoint**: User Story 4 is independently demonstrable when all named status families remain identifiable without hue and important asynchronous updates are announced without duplicate routine feedback.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Produce deterministic evidence, validate cross-window behavior, and confirm that accessibility changes did not cross the project/runtime boundaries.

- [X] T049 [P] Update `specs/101-improve-ui-accessibility/quickstart.md` with the final audit/test commands, browser script name, expected failure behavior, and evidence-recording instructions for the completed implementation
- [X] T050 [P] Execute the deterministic manual matrix and record results at 100%, 200%, and 300% zoom and device scale factors 1 and 2 for `specs/101-improve-ui-accessibility/checklists/manual-accessibility-results.md`, covering `main.tsx`, `settings-main.tsx`, `about-main.tsx`, `effect-editor.tsx`, `track-instrument-editor.tsx`, and `popout.html`
- [X] T051 Add or update compatibility assertions that exercise existing project/score color preservation and `.blue`/CSD behavior without normalization in `packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx`, `packages/blue-app/src/renderer/tests/score-object-color-roundtrip.test.ts`, `packages/blue-data/src/blue-data-root-compatibility.test.ts`, `packages/blue-data/src/blue-data-csd-parity.test.ts`, `packages/blue-data/src/blue-data-csd-determinism.test.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/bsb-graphic-interface.test.ts`
- [X] T052 Run the focused validation commands from `specs/101-improve-ui-accessibility/quickstart.md`, including `pnpm audit:renderer-theme`, `node --test scripts/audit-renderer-theme.test.mjs`, `pnpm audit:renderer-typography`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app test:browser`, `pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json`, and `pnpm --filter @blue/app build:renderer`
- [X] T053 Run repository-wide `pnpm test`, `pnpm lint`, and `git diff --check` from the repository root, recording pre-existing unrelated failures separately in `specs/101-improve-ui-accessibility/checklists/manual-accessibility-results.md`
- [X] T054 Verify every corrected panel-hosted popup/modal in the scriptless host against `docs/popout-popup-conventions.md`, including host portal placement, host-window positioning and dismissal, realm-safe target checks, capture/bubble event isolation, cleanup, and the mutation-sensitive two-document tests in `packages/blue-app/src/renderer/tests/accessibility-popout.test.tsx`
- [X] T055 Review the final diff against `specs/101-improve-ui-accessibility/spec.md`, `plan.md`, `contracts/`, and `data-model.md`; confirm no changes to `@blue/data` production behavior, `.blue` XML, CSD generation, engine/audio behavior, persisted settings, or project-authored colors/fonts in the repository paths covered by `packages/blue-app` and `packages/blue-data`

---

## Phase 8: Controlled Revision Review

**Purpose**: Reassess the completed implementation checkpoint against the clarified restrained-hierarchy requirement without discarding independent accessibility improvements.

- [X] T056 Preserve the completed candidate as commit `d2a1ea4` before revision and record baseline `74cd10f7` plus candidate `d2a1ea4` in `specs/101-improve-ui-accessibility/quickstart.md`
- [X] T057 Create the seven-category evidence and disposition matrix in `specs/101-improve-ui-accessibility/checklists/revision-review.md`, separating visual screenshot evidence from keyboard, accessibility-tree, modal, and automated evidence
- [X] T058 Capture controlled baseline/candidate images for the representative workbench, score, mixer, settings, modal, status/toast, and Blue Synth Builder sets under `specs/101-improve-ui-accessibility/review-images/`
- [X] T059 Record an explicit `keep`, `soften`, `revert`, or `redesign` decision for every category with the project owner in `specs/101-improve-ui-accessibility/checklists/revision-review.md`
- [X] T060 [US1] Apply approved theme-hierarchy dispositions through the smallest shared token/style seams in `packages/blue-app/src/renderer/styles/index.css` and synchronize governed pairs in `scripts/renderer-accessibility-contract.mjs` and `docs/color-accessibility.md`
- [X] T061 [P] [US2] Apply approved visible-focus dispositions while retaining keyboard discoverability in `packages/blue-app/src/renderer/styles/index.css` and only the representative component paths named in `specs/101-improve-ui-accessibility/checklists/revision-review.md`
- [X] T062 [P] [US4] Apply approved status-cue dispositions while retaining non-color meaning in `packages/blue-app/src/renderer/lib/toast-styles.ts`, `packages/blue-app/src/renderer/components/settings/`, `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.tsx`, and score Mute/Solo controls
- [X] T063 [P] Verify the `keep` disposition for accessible semantics, keyboard value controls, modal behavior, and validation infrastructure using the focused commands in `specs/101-improve-ui-accessibility/quickstart.md`; reopen implementation only for an evidenced regression
- [X] T064 Re-run governed contrast, focused renderer, browser, type-check, build, repository test, lint, and whitespace validation from `specs/101-improve-ui-accessibility/quickstart.md`
- [X] T065 Complete the pending human keyboard, VoiceOver, and color-vision review and replace qualified automated-only results in `specs/101-improve-ui-accessibility/checklists/manual-accessibility-results.md`
- [X] T066 Confirm every category disposition is resolved and the revised candidate satisfies `SC-009` in `specs/101-improve-ui-accessibility/checklists/revision-review.md`

**Checkpoint**: The revision is ready for final validation only when the seven categories have explicit dispositions and all approved visual changes retain the applicable WCAG floors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001–T004 can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup; T005–T010 establish the audit, ownership, and classification gates and block story implementation.
- **User Story 1 (Phase 3)**: Depends on Foundational; it is the MVP and establishes the semantic contrast tokens used by later focus and status work.
- **User Story 2 (Phase 4)**: Depends on Foundational and the semantic color baseline from User Story 1; keyboard-value work also depends on T026.
- **User Story 3 (Phase 5)**: Depends on Foundational and User Story 1; its mixer/BSB accessibility-tree completion depends on the controls delivered in User Story 2, while field/modal work can proceed independently after T031.
- **User Story 4 (Phase 6)**: Depends on the semantic color baseline from User Story 1 and the Mute/Solo semantics from User Story 3; settings, Live Space, REPL, and toaster work can proceed in parallel.
- **Polish (Phase 7)**: Depends on all desired stories and their checkpoints.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2; no other story dependency.
- **User Story 2 (P1)**: Can start after Phase 2 and should consume User Story 1's governed focus/color roles.
- **User Story 3 (P1)**: Form and modal tasks can start after Phase 2; mixer/BSB semantic completion follows User Story 2's keyboard controls.
- **User Story 4 (P2)**: Can start after User Story 1's status tokens; score-state verification follows User Story 3's pressed-state semantics.

### Parallel Opportunities

- T001–T004 are independent setup work.
- After T005–T010, US1 verification T011–T012 can run in parallel; after T013, T014–T017 can be split by file family.
- In US2, T023–T027 can be split across focus styles, shortcut behavior, BSB step math, and mixer behavior; T028 and T029 can then run in parallel after T026.
- In US3, T034–T035 can be split by numeric-input family; T038–T040 can be split by modal family after T036–T037; T041 can run alongside the modal migrations.
- In US4, T046 and T047 can run in parallel after T045; T044 can be prepared before implementation as the failure-first status contract.
- T049–T051 are independent evidence/compatibility work once implementation is stable; T052–T055 are final validation gates.

## Parallel Example: User Story 1

```text
After Phase 2:
Task T011: Add failure-first governed contrast cases in scripts/audit-renderer-theme.test.mjs
Task T012: Add browser contrast spot checks in packages/blue-app/src/renderer/browser/accessibility-contrast.browser.test.tsx

After T013 updates the semantic tokens:
Task T014: Repair CommitNumberInput.tsx palette utilities
Task T015: Repair audio-player, FileBackedScoreObjectEditor, FileManagerRootRenameDialog, and REPL aliases
Task T016: Repair Live Space, score overlay, automation, and track-layer colors
Task T017: Repair the CodeMirror comment token
```

## Parallel Example: User Story 2

```text
After the shared focus rule in T022:
Task T023: Repair workbench focus surfaces
Task T024: Repair shared fields, menus, dialogs, and editor focus styles
Task T025: Remediate the Follow Playback shortcut and discoverable label
Task T026: Add BSB keyboard step/clamp math
Task T027: Repair the mixer fader

After T026:
Task T028: Add keyboard semantics to knob and H/V sliders
Task T029: Add keyboard semantics to slider banks and XY axes
```

## Parallel Example: User Story 3

```text
After the shared dialog hook and ConfirmationDialog contract:
Task T034: Complete settings/effect/mixer/Live Space/BSB/BlueX7 numeric names
Task T035: Complete score/JMask/piano-roll/tracker/line-editor numeric names
Task T038: Migrate instrument, library, and top-level workbench true modals
Task T039: Migrate code-repository, operation, generated-instrument, and BSB true modals
Task T040: Migrate score-object, score, and tools true modals
Task T041: Add Mute/Solo pressed-state and visible-cue semantics
```

## Parallel Example: User Story 4

```text
After the shared toaster styling in T045:
Task T046: Remediate MIDI and realtime-render statuses
Task T047: Remediate Live Space and REPL statuses
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete the contrast contract, token repairs, exception cleanup, and verification in Phase 3.
3. Stop and validate `pnpm audit:renderer-theme`, the script tests, browser contrast checks, and the default-theme spot-check matrix.
4. Deliver the readable default dark-theme baseline before expanding into keyboard, semantic, dialog, and status behavior.

### Incremental Delivery

1. Setup + Foundational → measurable baseline and classified finite inventory.
2. User Story 1 → readable governed application chrome and contrast MVP.
3. User Story 2 → visible focus and keyboard-equivalent mixer/BSB controls.
4. User Story 3 → assistive-technology names, states, values, and modal behavior.
5. User Story 4 → non-color status recognition and important asynchronous announcements.
6. Polish → manual evidence, compatibility proof, and repository validation.

### Notes

- Every task includes an exact repository path; directory paths identify the complete call-site family when the inventory is intentionally exhaustive.
- `[P]` means the task can run in parallel with its neighboring tasks after its stated prerequisites because it owns different files or an independent verification artifact.
- User Story tasks carry `[US1]`–`[US4]`; Setup, Foundational, and Polish tasks intentionally do not carry a story label.
- No task introduces a new dependency, persistence store, IPC contract, `@blue/data` production import, project-color normalization, WCAG AAA gate, or general shortcut-preference system.
