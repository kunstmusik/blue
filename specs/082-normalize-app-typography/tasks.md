# Tasks: Normalize Application Typography

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/`

**Prerequisites**: [plan.md](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/plan.md), [spec.md](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/spec.md), [research.md](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/research.md), [data-model.md](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/data-model.md), [contracts/](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/contracts/), [quickstart.md](/Users/stevenyi/work/blue-electron/specs/082-normalize-app-typography/quickstart.md)

**Organization**: Tasks are grouped by the four user stories in priority order. The foundational phase establishes the single token source, audit boundary, and renderer-only drawn-text seam before story work begins.

**Checklist format**: Every task is an unchecked checkbox with a sequential ID. `[P]` marks only tasks that can edit different files without waiting on another incomplete task. Story phases use `[US1]` through `[US4]`; setup, foundation, and polish tasks intentionally have no story label.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the human guidance, test seams, and migration scaffolding required by every story.

- [X] T001 [P] Create the canonical typography guide with the seven-role catalog, HIG/logical-pixel rationale, role-selection rules, ownership boundary, examples, anti-patterns, validation instructions, and marked JSON exception registry in `docs/typography.md`.
- [X] T002 [P] Add the repository UI-work instruction linking to `docs/typography.md`, preserving project-authored typography and requiring same-change guide updates, in `AGENTS.md`.
- [X] T003 [P] Create scanner fixture cases covering the exact catalog, retired roles, Tailwind default variants, arbitrary values, raw CSS/style/SVG/Canvas assignments, line-height overrides, exceptions, scope exclusions, and Windows path normalization in `scripts/audit-renderer-typography.test.mjs`.
- [X] T004 [P] Add renderer token and inherited-Body test cases for all seven role utilities, exact size/line-height pairs, namespace reset expectations, and Canvas resolver behavior in `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared token, audit, and drawn-text contracts that block all story implementation until they are stable.

**⚠️ CRITICAL**: No user story migration should be considered complete until this phase passes.

- [X] T005 Add the temporary migration bridge for `text-role-*` variables/utilities, exact line-height companions, and the inherited 13/16 Body baseline in `packages/blue-app/src/renderer/styles/index.css`, retaining legacy/default definitions only until all call sites are migrated.
- [X] T006 [P] Implement the renderer-only semantic Canvas font resolver with proportional/monospace family and weight options in `packages/blue-app/src/renderer/lib/typography.ts`, without introducing a duplicate metric table or any host/data dependency.
- [X] T007 Implement the complete production source scanner, catalog validation, exception-block parser, deterministic inventory JSON, stale/count-mismatch handling, and exit codes from `contracts/typography-audit.md` in `scripts/audit-renderer-typography.mjs`.
- [X] T008 Wire `audit:renderer-typography` into the root lint/test flow and include `scripts/audit-renderer-typography.test.mjs` in `test:scripts` in `package.json`, without changing CI workflow topology.
- [X] T009 Complete the exact seven-token, Body-baseline, entrypoint-import, and compiled-utility assertions in `packages/blue-app/src/renderer/tests/typography-tokens.test.ts` after `packages/blue-app/src/renderer/styles/index.css` and `packages/blue-app/src/renderer/lib/typography.ts` exist.
- [X] T010 Extend `scripts/audit-renderer-typography.test.mjs` to prove the scanner includes only renderer/typography-rendering shared sources, excludes tests/browser/mocks/generated output and `@blue/data`, and emits stable repository-relative POSIX paths for synthetic Windows inputs.
- [X] T011 Add exact exception-registry validation fixtures for project-authored BSB values, non-text glyphs, single-line line-height cases, duplicate/stale records, broad directory suppression, and overmatching counts in `scripts/audit-renderer-typography.test.mjs`.
- [X] T012 Record the audit's initial inventory and semantic migration map by surface in `docs/typography.md`, including the known legacy/default/arbitrary counts and the rule that application-owned BSB chrome is not exempt.
- [X] T013 Add a focused contract assertion that the typography change introduces no project/settings/IPC/engine state and leaves the five renderer entrypoints importing `styles/index.css` in `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`.

**Checkpoint**: The role catalog compiles, Body inheritance is measurable, audit fixtures define every required syntax category, the audit is wired into local CI-equivalent commands, and no user story can bypass the ownership boundary.

---

## Phase 3: User Story 1 - Read Application Controls at Default Zoom (Priority: P1) 🎯 MVP

**Goal**: At 100% Actual Size, ordinary controls, secondary labels, empty/error states, and all application-owned window entrypoints use the approved catalog with no application text below 11 logical pixels.

**Independent Test**: Run the focused renderer/window tests, `pnpm audit:renderer-typography`, and the V01/V09 100%-zoom cases from `contracts/visual-acceptance.md`; confirm Body fallback and every application-owned sample at or above the floor in main, Settings, About, dialogs, and secondary editors.

### Verification for User Story 1

- [X] T014 [P] [US1] Add Body-fallback and ordinary-control assertions for main, Settings, About, effect-editor, and track-instrument renderer entrypoints in `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`, `packages/blue-app/src/renderer/tests/settings-window.test.tsx`, `packages/blue-app/src/renderer/tests/effect-editor-window.test.tsx`, and `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx`.
- [X] T015 [P] [US1] Update literal class expectations and empty/loading/error-state coverage for the welcome, project-panel, REPL, MIDI-input, and note-processor surfaces in `packages/blue-app/src/renderer/tests/welcome-screen.test.tsx`, `packages/blue-app/src/renderer/tests/project-editor-panels.test.ts`, `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.test.tsx`, `packages/blue-app/src/renderer/tests/midi-input-panel.test.tsx`, and `packages/blue-app/src/renderer/tests/score-object-properties-note-processor-editor.test.tsx`.

### Implementation for User Story 1

- [X] T016 [P] [US1] Migrate the main application shell, toolbar, playback controls, toolbar displays, welcome screen, and root app fallback text to `text-role-body`, `text-role-callout`, `text-role-headline`, or the appropriate title role in `packages/blue-app/src/renderer/App.tsx`, `packages/blue-app/src/renderer/components/menu-bar/MainToolbar.tsx`, `packages/blue-app/src/renderer/components/menu-bar/PlaybackControls.tsx`, `packages/blue-app/src/renderer/components/menu-bar/ToolbarDisplays.tsx`, `packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx`, and `packages/blue-app/src/renderer/components/welcome/WelcomeScreen.tsx`.
- [X] T017 [P] [US1] Migrate Settings controls and secondary-window controls to semantic roles while preserving existing families and behavior in `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`, `packages/blue-app/src/renderer/components/settings/SettingsField.tsx`, `packages/blue-app/src/renderer/components/settings/SettingsSection.tsx`, `packages/blue-app/src/renderer/components/settings/DiskRenderSettings.tsx`, `packages/blue-app/src/renderer/components/settings/MidiSettings.tsx`, `packages/blue-app/src/renderer/components/settings/OscSettings.tsx`, `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`, `packages/blue-app/src/renderer/components/settings/RuntimeDeviceField.tsx`, `packages/blue-app/src/renderer/components/about/AboutApp.tsx`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPage.tsx`, `packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`.
- [X] T018 [P] [US1] Normalize application-owned library, file-manager, notifications, and common dialog text in `packages/blue-app/src/renderer/components/libraries/LibraryBreadcrumbs.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryEditorToolbar.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryImportDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryItemEditorPanel.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryRecoveryPanel.tsx`, `packages/blue-app/src/renderer/components/libraries/LibrarySearchBar.tsx`, `packages/blue-app/src/renderer/components/libraries/LibrarySessionDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTransferDialog.tsx`, `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`, `packages/blue-app/src/renderer/components/libraries/editor-registry.tsx`, `packages/blue-app/src/renderer/components/notifications/ErrorBoundary.tsx`, and `packages/blue-app/src/renderer/components/ColorPicker.tsx`.
- [X] T019 [US1] Normalize workbench shell, Dockview panel labels, output/repl text, and standard panel controls using Body inheritance and explicit secondary roles in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`, `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/WorkbenchPanelContent.tsx`, `packages/blue-app/src/renderer/components/workbench/AuxiliaryRail.tsx`, `packages/blue-app/src/renderer/components/workbench/AuxiliarySlideout.tsx`, `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/output/OutputPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/PlaceholderPanel.tsx`.
- [X] T020 [US1] Migrate CodeMirror/editor and ordinary orchestra/project panel text to semantic variables while preserving monospaced families in `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GenericInstrumentEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ProjectTextEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/project-properties/ProjectInformationTab.tsx`.
- [X] T021 [US1] Run the focused US1 tests and update the V01/V09 100%-zoom execution rows with computed Body/Callout/Subheadline metrics and no-clipping observations in `specs/082-normalize-app-typography/quickstart.md`.

**Checkpoint**: US1 is independently demonstrable at 100% Actual Size across the main and representative secondary windows, with ordinary controls readable and unclassified states inheriting Body.

---

## Phase 4: User Story 2 - Recognize a Consistent Information Hierarchy (Priority: P1)

**Goal**: Equivalent titles, headings, content, secondary labels, and annotations use identical semantic roles and metrics across all Blue windows, regardless of control or editor implementation.

**Independent Test**: Compare the role coverage ledger across workbench, Settings, About, Welcome, dialogs, inspectors, code/output, and specialized editors; run the token/audit tests and confirm no generic/default/arbitrary size assignment remains on the migrated surfaces.

### Verification for User Story 2

- [x] T022 [P] [US2] Add semantic-role and weight assertions for title, headline, Body, Callout, Subheadline, and monospaced samples in `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`, `packages/blue-app/src/renderer/tests/project-editor-panels.test.ts`, and `packages/blue-app/src/renderer/tests/welcome-screen.test.tsx`.
- [x] T023 [US2] Re-run the production inventory and classify every remaining generic/legacy/arbitrary occurrence by semantic purpose, recording the selected role or exact exception in `docs/typography.md` and the scanner output from `scripts/audit-renderer-typography.mjs`.

### Implementation for User Story 2

- [x] T024 [US2] Assign Title 2, Title 3, Headline, Body, Callout, and Subheadline roles consistently across workbench hierarchy and panel headings in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`, `packages/blue-app/src/renderer/components/workbench/WorkbenchPanelContent.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/GlobalOrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/GlobalScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ProjectPropertiesPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectPropertiesPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx`.
- [x] T025 [US2] Normalize section/column/group headings and permitted emphasis in score, orchestra, library, and tool panels without creating new near-duplicate sizes in `packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreToolbar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueSynthBuilderEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/FileManagerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/SoundFontViewerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/tools/CsoundRCEditorModal.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/tools/FTableConverterModal.tsx`.
- [x] T026 [US2] Normalize Blue Live tab headings, options, output/editor labels, and code/output family assignments through the shared role variables in `packages/blue-app/src/renderer/components/workbench/panels/BlueLivePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveCodeTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/blue-live/OptionsTab.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/output/OutputPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`.
- [x] T027 [US2] Replace remaining generic text utilities and legacy role names in ordinary workbench panels reported by the audit under `packages/blue-app/src/renderer/components/workbench/panels/`, preserving each component's semantic purpose and intentional wrapping/ellipsis.
- [x] T028 [US2] Update affected class-string and hierarchy tests for the final role vocabulary in `packages/blue-app/src/renderer/components/workbench/panels/repl-console/ReplConsolePanel.test.tsx`, `packages/blue-app/src/renderer/tests/midi-input-panel.test.tsx`, `packages/blue-app/src/renderer/tests/project-editor-panels.test.ts`, `packages/blue-app/src/renderer/tests/score-object-properties-note-processor-editor.test.tsx`, `packages/blue-app/src/renderer/tests/welcome-screen.test.tsx`, and `packages/blue-app/src/renderer/tests/selected-code-editor-reconfigure.test.tsx`.
- [x] T029 [US2] Verify that the built renderer exposes exactly seven semantic utilities, no default numeric scale, no arbitrary application text sizes, and correct role line heights through `packages/blue-app/src/renderer/tests/typography-tokens.test.ts`, `packages/blue-app/src/renderer/styles/index.css`, and `scripts/audit-renderer-typography.mjs`.
- [x] T030 [US2] Record the role coverage ledger and cross-window equivalence samples for titles, headings, Body, secondary text, and drawn/monospaced content in `specs/082-normalize-app-typography/quickstart.md`.

**Checkpoint**: US2 is independently demonstrable when equivalent purposes across windows resolve to identical roles/metrics and hierarchy is expressed through permitted emphasis rather than numeric drift.

---

## Phase 5: User Story 3 - Keep Dense Workflows Usable After Normalization (Priority: P2)

**Goal**: Mixer, piano roll, score/timeline, line/automation/JMask, BlueX7, tracker, SoundFont, and BSB surfaces remain aligned, unclipped, and reachable after adopting the role line boxes.

**Independent Test**: Run focused geometry tests and browser fixtures, then execute V02–V08 at representative sizes and both display-density profiles; verify no essential label/action is clipped, overlapped, or lost and that zoom actions remain reachable.

### Verification for User Story 3

- [X] T031 [P] [US3] Extend mixer fixed-row/chain capacity assertions for 11–16 px role line boxes in `packages/blue-app/src/renderer/tests/mixer-layout-css.test.ts`, `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`, and `packages/blue-app/src/renderer/tests/workbench-mixer-panel.test.tsx`.
- [X] T032 [P] [US3] Extend piano-roll and score-ruler geometry assertions for smallest note rows, label thresholds, ruler offsets, and fixed toolbar rows in `packages/blue-app/src/renderer/tests/pianoroll-parity.test.ts`, `packages/blue-app/src/renderer/tests/score-ruler-parity.test.ts`, and `packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.
- [X] T033 [P] [US3] Add direct drawn-text resolver and SVG/font-size regression cases for Canvas, SVG, and score-bar renderers in `packages/blue-app/src/renderer/tests/line-object-editor-parity.test.tsx`, `packages/blue-app/src/renderer/tests/score-object-bar-renderers.test.ts`, and `packages/blue-app/src/renderer/tests/audio-clip-bar-renderer.test.tsx`.

### Implementation for User Story 3

- [X] T034 [P] [US3] Normalize mixer labels/readouts and adapt chain-list, strip, output, and constrained-width geometry in `packages/blue-app/src/renderer/styles/index.css`, `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/EffectsChainContextMenu.tsx`.
- [X] T035 [P] [US3] Normalize piano-roll pitch labels, field metadata, ruler text, and note-row density behavior in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PitchHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/TimeBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/FieldEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollRulerConfigDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollSnapButton.tsx`.
- [X] T036 [P] [US3] Normalize score/timeline rulers, layer headers, markers, tempo/meter labels, bar renderers, and fixed offsets in `packages/blue-app/src/renderer/components/workbench/panels/score/ColumnHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/MeterRegionBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/TempoRegionBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/MarkersBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/bar-renderers/AudioClipBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/bar-renderers/LetterScoreObjectBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/bar-renderers/ScoreObjectBar.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`.
- [X] T037 [P] [US3] Route line-editor, automation, JMask, and table Canvas/SVG text through semantic variables or the resolver in `packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/LineDefinitionTable.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/TableEditor.tsx`, and `packages/blue-app/src/renderer/lib/typography.ts`.
- [X] T038 [P] [US3] Normalize BlueX7 SVG labels, topology, operator controls, envelopes, Csound preview, and narrow-grid geometry in `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/algorithm-topology.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/csound-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/envelope-editor.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/lfo-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/operator-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/pitch-envelope-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/sysex-import-dialog.tsx`, and `packages/blue-app/src/renderer/components/instruments/blue-x7/common-panel.tsx`.
- [X] T039 [P] [US3] Normalize tracker, SoundFont, virtual-keyboard, and dense table metadata while preserving monospaced content in `packages/blue-app/src/renderer/components/workbench/panels/tools/SoundFontViewerPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/PianoCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerObjectEditor.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/tools/FileManagerPanel.tsx`.
- [X] T040 [US3] Normalize fixed BSB application chrome readouts, selectors, labels, and value panels without touching persisted font values in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/ValuePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBCheckBoxWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/WidgetWrapper.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts`.
- [X] T041 [US3] Replace text glyph controls with Lucide/SVG icons where semantics permit and document any retained non-text glyph exception with accessible-name coverage in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/notifications/ErrorBoundary.tsx`, and `docs/typography.md`.
- [X] T042 [US3] Retune fixed heights, widths, offsets, label thresholds, wrapping, scrolling, and intentional truncation for the normalized line boxes in `packages/blue-app/src/renderer/styles/index.css`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PitchHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/TimeBar.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/ColumnHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.
- [X] T043 [US3] Run focused dense-surface and browser geometry suites, then update V02–V08 density rows with DPR, computed metrics, contrast samples, screenshots, and defect/rerun references in `packages/blue-app/src/renderer/tests/mixer-layout-css.test.ts`, `packages/blue-app/src/renderer/tests/pianoroll-parity.test.ts`, `packages/blue-app/src/renderer/tests/line-object-editor-parity.test.tsx`, `packages/blue-app/src/renderer/tests/soundfont-viewer-panel.test.tsx`, `packages/blue-app/src/renderer/tests/blue-x7-a11y-layout.test.tsx`, `packages/blue-app/src/renderer/browser/bsb-geometry.browser.test.tsx`, `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx`, and `specs/082-normalize-app-typography/quickstart.md`.
- [X] T044 [US3] Execute the 50%, 100%, 200%, and 300% application-zoom matrix for the main workbench, Settings, and one application-owned editor and record essential-action results in `specs/082-normalize-app-typography/quickstart.md`.

**Checkpoint**: US3 is independently demonstrable when dense surfaces preserve legibility, alignment, essential actions, and intentional truncation/wrapping at supported window sizes and zoom levels on both required macOS density profiles.

---

## Phase 6: User Story 4 - Preserve Authored Content and Prevent Regression (Priority: P3)

**Goal**: Persisted/imported project typography remains lossless while application-owned BSB chrome, documentation, repository guidance, and regression enforcement prevent future drift.

**Independent Test**: Round-trip minimum/typical/maximum authored font fixtures, run the scanner against a deliberately invalid application assignment, verify exact exceptions and stale-record failures, and confirm `docs/typography.md` plus `AGENTS.md` provide complete guidance.

### Verification for User Story 4

- [X] T045 [P] [US4] Add round-trip fixtures for dropdown sizes 8/12/36, font-object sizes 1/12/200, imported Swing HTML sizes, unknown XML, and unrelated project data in `packages/blue-data/src/instruments/blue-synth-builder.test.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-graphic-interface.test.ts`, `packages/blue-app/src/renderer/tests/bsb-property-validation.test.ts`, and `packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx`.
- [X] T046 [P] [US4] Add exact project-authored and non-text exception records, ownership/reason/verification metadata, and final approved-role examples to `docs/typography.md` for the audited expressions in `packages/blue-app/src/shared/bsb-swing-html.ts`, `packages/blue-app/src/shared/bsb-widget-layout.ts`, and the BSB widget sources under `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/`.
- [X] T047 [P] [US4] Add regression fixtures proving a new sub-floor application label, retired utility, arbitrary size, raw SVG/Canvas font, stale exception, and overbroad exception fail the CI audit in `scripts/audit-renderer-typography.test.mjs`.

### Implementation for User Story 4

- [X] T048 [US4] Classify and preserve canonical project-authored font transport/rendering without coercion in `packages/blue-app/src/shared/bsb-swing-html.ts`, `packages/blue-app/src/shared/bsb-widget-layout.ts`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBLabelWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBGroupWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBDropdownWidget.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts`.
- [X] T049 [US4] Normalize application-owned BSB editor tabs, property-sheet labels, line selectors, XY readouts, toolbars, dialogs, and fixed value labels around authored content in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/FontChooserDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/ValuePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/WidgetWrapper.tsx`.
- [X] T050 [US4] Complete `docs/typography.md` with final inventory/exception counts, BSB boundary examples, contrast/opacity rules, drawn-text guidance, dense-layout policy, zoom/density instructions, anti-patterns, and same-change maintenance rule, then confirm the path and instruction remain valid in `AGENTS.md`.
- [X] T051 [US4] Run the project-authored preservation tests and V06 BSB visual case, recording exact authored values, unrelated/unknown XML preservation, surrounding application roles, DPR, screenshots, and reruns in `specs/082-normalize-app-typography/quickstart.md`.
- [X] T052 [US4] Compare any authored-rendering divergence with the available Java Blue references at `~/work/nbprojects/blue/blue-core`, `~/work/nbprojects/blue/blue-ui-core`, and `~/work/blue/demo2026/01.csd`, then verify no production changes were made to `packages/blue-data/src/` behavior, `.blue` XML meaning, generated Csound, program settings, preload/IPC, Java runtime, or engine contracts by running `packages/blue-data/src/instruments/blue-synth-builder.test.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-compilation-replacements.test.ts`, `packages/blue-app/src/renderer/tests/bsb-property-validation.test.ts`, `packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx`, and the relevant project-save fixtures.

**Checkpoint**: US4 is independently demonstrable when authored values round-trip exactly, application-owned BSB chrome is semantic, the guide and agent instruction are complete, and invalid future typography assignments fail the audit with actionable locations.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove the migration bridge, prove repository-wide compliance, and complete the documented acceptance handoff.

- [X] T053 Remove the six legacy custom variables, Tailwind default numeric text scale, temporary migration bridge, and all unapproved arbitrary text sizes from `packages/blue-app/src/renderer/styles/index.css`, `packages/blue-app/src/renderer/`, and the audited typography-rendering helpers in `packages/blue-app/src/shared/`.
- [X] T054 Make the production audit pass with zero legacy/default/arbitrary/raw-size/sub-floor/stale-exception findings and verify deterministic JSON counts through `scripts/audit-renderer-typography.mjs`, `scripts/audit-renderer-typography.test.mjs`, and `docs/typography.md`.
- [X] T055 Run the complete affected validation set from `specs/082-normalize-app-typography/quickstart.md`: `pnpm audit:renderer-typography`, focused `@blue/app` and `@blue/data` Vitest suites, browser suites, `pnpm --filter @blue/app build:renderer`, `pnpm test`, `pnpm lint`, and `git diff --check`.
- [X] T056 Execute all V01–V10 visual cases under both macOS Retina and verified standard-density/DPR-1 profiles, complete the role coverage ledger, calculate named contrast samples, and replace every Pending row in `specs/082-normalize-app-typography/quickstart.md` with evidence and pass/rerun status.
- [X] T057 Review the completed implementation against `spec.md`, `plan.md`, `data-model.md`, all three contracts, `docs/typography.md`, `AGENTS.md`, and `.specify/memory/constitution.md`; resolve any requirement, ownership, Java/project-preservation, host-path, or verification gap before handoff.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T004 can begin immediately and may run in parallel because they edit distinct documentation/test files.
- **Foundational (Phase 2)**: T005–T013 depend on the setup contracts; T006, T007, and T010 can proceed in parallel once their fixture/test seams exist. The phase must pass before story work is accepted.
- **User Story 1 (Phase 3)**: T014–T021 depend on T005–T013. US1 is the MVP and establishes ordinary application-role usage.
- **User Story 2 (Phase 4)**: T022–T030 depends on the foundation and the common-control migration from US1; it completes semantic hierarchy across surfaces.
- **User Story 3 (Phase 5)**: T031–T044 depends on the foundation and the role vocabulary from US1/US2. Surface groups T034–T040 can run in parallel because they edit separate geometry domains.
- **User Story 4 (Phase 6)**: T045–T052 depends on the foundation; authored-data verification can begin earlier, but final BSB chrome/documentation validation follows US3 so every surrounding surface is normalized.
- **Polish (Phase 7)**: T053–T057 depend on all desired stories and remove the temporary token bridge only after the production audit inventory is clean.

### User Story Dependencies

- **US1 (P1)**: Depends only on the foundational token/audit/Body contract; independently testable as the MVP.
- **US2 (P1)**: Depends on US1's common role usage because hierarchy comparisons must use the final vocabulary, but its role assertions and surface groups remain independently testable.
- **US3 (P2)**: Depends on US1/US2 role assignments and the Canvas resolver; dense geometry and zoom checks are independently testable after that foundation.
- **US4 (P3)**: Its round-trip fixtures are independent of UI migration, while final BSB chrome/documentation/regression evidence depends on US3 and the final audit.

### Parallel Opportunities

- **Setup**: T001, T002, T003, and T004 can be assigned to separate contributors.
- **Foundation**: T006 (Canvas resolver), T007 (scanner), and T010/T011 (scanner fixtures) can proceed in separate files after setup; T008 follows scanner implementation.
- **US1**: T016, T017, and T018 can run in parallel because they target shell/menu, settings/secondary windows, and libraries/notifications respectively. T014/T015 test updates can run alongside those migrations.
- **US2**: After US1, hierarchy groups in T024–T026 can be divided by workbench, specialized panels, and Blue Live/editor surfaces; T022 test work can proceed separately.
- **US3**: T034 (mixer), T035 (piano roll), T036 (score), T037 (line/drawn), T038 (BlueX7), and T039 (tables/keyboard) are independent surface groups. Their verification tasks T031–T033 can run in parallel with implementation preparation.
- **US4**: T045 (round trips), T046 (exception registry), and T047 (audit regression fixtures) target different files and can proceed in parallel.

## Parallel Example: User Story 1

```text
Task T016: migrate main shell/menu/toolbar files
Task T017: migrate Settings and secondary-window files
Task T018: migrate libraries/notifications/common-dialog files
Task T014: add Body-fallback assertions in renderer/window tests
Task T015: update existing literal class/error-state assertions
```

## Parallel Example: User Story 3

```text
Task T034: mixer geometry and role migration
Task T035: piano-roll labels/rulers and density response
Task T036: score/timeline/ruler/bar-renderer migration
Task T037: line-editor/automation/JMask drawn-text resolver migration
Task T038: BlueX7 SVG and narrow-layout migration
Task T039: tracker/SoundFont/virtual-keyboard migration
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases (T001–T013).
2. Complete US1 (T014–T021) for the Body baseline, common controls, secondary windows, and default-zoom acceptance.
3. Stop and validate with the focused tests, `pnpm audit:renderer-typography`, and V01/V09 at 100% zoom.
4. Demo the readable baseline before starting hierarchy and dense-surface migration.

### Incremental Delivery

1. Add US2 semantic hierarchy and role equivalence; validate the role ledger.
2. Add US3 dense geometry/drawn-text migrations; validate focused browser and zoom cases.
3. Add US4 project-authored preservation, BSB boundary, guide, and regression evidence.
4. Run Polish only after every source assignment is accepted by the audit, then complete the two-density matrix and repository gates.

### Final Validation

The implementation is complete only when all tasks are checked, every unapproved audit count is zero, authored project values round-trip exactly, all 20 density/case rows and four zoom levels are recorded as passing, and `pnpm test`, `pnpm lint`, renderer build, browser fixtures, and `git diff --check` pass.

## Phase 8: Convergence

- [X] T058 Finalize `packages/blue-app/src/renderer/styles/index.css` as the single static seven-role typography layer with `@theme static`, `--text-*: initial`, and no legacy/default font-size tokens per FR-031 (contradicts).
- [X] T059 Extend `scripts/audit-renderer-typography.mjs` and its fixtures to enforce token-layer invariants and detect multiline SVG attributes, JSX `fontSize={...}`, raw CSS/inline `line-height`/`lineHeight`, and other required assignment forms per FR-025, FR-026, and FR-032 (partial).
- [X] T060 Wire `audit:renderer-typography` into the root `lint` gate and verify that the production audit runs through the repository validation command per FR-032 and the typography-audit contract (partial).
- [X] T061 Replace the app-owned subfloor SVG labels in `envelope-editor.tsx` and `EditableLineCanvas.tsx` with approved Subheadline delivery paths, adapt dense geometry, and add focused regression coverage per FR-003, FR-009, and FR-014 (contradicts).
- [X] T062 Replace raw line-height and font-size assignments in the tooltip CSS, `SelectedCodeEditor.tsx`, and `ScoreObjectBar.tsx` with approved role companions/delivery paths, remove numeric label-size defaults, and add coverage per FR-008, FR-009, and FR-032 (contradicts).
- [X] T063 Audit production heading semantics: use Title 2/Title 3 for major dialog and section titles, make Headline callsites bold, and update the render-to-disk and freeze-operation dialog headings and role assertions per FR-004, FR-007, and US2 acceptance criteria (partial).
- [X] T064 Execute and record the V01–V10 D1/D2 visual matrix, 50/100/200/300 zoom matrix, and authored-font preservation matrix with DPR, metrics, contrast, geometry, screenshot, interaction, and rerun evidence per SC-003 through SC-010 (missing).

## Phase 9: Convergence

- [X] T065 Normalize ordinary table/list values and column/group headings that still use Callout or Subheadline—including OSC settings, SoundFont, MIDI import, render-to-disk, and freeze-operation surfaces—to Body and bold Headline respectively, with focused role assertions per FR-004, FR-007, FR-009, and FR-014 (contradicts).
- [X] T066 Replace Subheadline/undersized roles on ordinary form labels, validation/helper text, and application-owned Blue Synth Builder controls—including the code-repository dialog, color picker, font chooser, BSB grid/property sheets, and related compact editors—with Body or Callout according to semantic purpose, preserving project-authored font values per FR-004, FR-009, FR-017, and FR-018 (contradicts).
- [X] T067 Correct remaining section/group hierarchy assignments—including About section headings, the Libraries group heading, library breadcrumbs, and equivalent compact headings—to Title 3, Body, or bold Headline according to the documented role ledger, and add regression coverage per FR-004, FR-007, FR-012, and T063 (partial).
- [X] T068 Audit direct React/CSS role-variable delivery outside the corrected Live Space surface and add missing role line-height companions or role utilities where inheritance does not resolve the exact metric, covering Blue Live helper text, secondary-window styles, BSB widgets, and drawn-text callsites per FR-008, FR-020, and FR-032 (partial).

## Phase 10: Convergence

- [X] T069 Execute and record the V01–V10 D1/D2 visual matrix, the 50/100/200/300% zoom matrix, and the authored-font preservation matrix with DPR, rendered metrics, contrast, geometry, screenshots, interaction results, and rerun references in `specs/082-normalize-app-typography/quickstart.md` per T064, FR-024, and SC-003–SC-010 (partial).
