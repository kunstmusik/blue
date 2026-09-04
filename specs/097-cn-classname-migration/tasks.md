---
description: "Task list for feature 097-cn-classname-migration"
---

# Tasks: cn() Class-Composition Migration and Styling Boundary

**Input**: Design documents from `/specs/097-cn-classname-migration/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/classname-composition.md, quickstart.md

**Verification**: Verification tasks below are constitution-driven (Principle V): helper-semantics
unit tests, caller-precedence component regressions (reproduced failing before implementation),
tracker conflict regression, lint negative validation, exhaustive search gates, full package
test/lint, and a deterministic manual smoke pass (quickstart Gate 5).

**Organization**: Tasks grouped by user story; each story is independently implementable and
testable. Component paths are relative to `packages/blue-app/src/renderer/` unless written in full.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

- All migration work: `packages/blue-app/src/renderer/components/**` (inventory in research.md §R0)
- Helper and tests: `packages/blue-app/src/renderer/lib/cn.test.ts`, `packages/blue-app/src/renderer/tests/**`
- Lint guard: `eslint.config.mjs` (repository root)
- Boundary guidance: `AGENTS.md` (repository root)
- Excluded files (MUST remain unchanged): `components/workbench/panels/score/automation/AutomationLineView.tsx` (SVG joins), `components/workbench/panels/orchestra/bsb/widgets/utils.ts` (SVG join), `stores/library-store.ts` (error joins), `components/workbench/panels/virtual-keyboard/keyboard-mapping.ts` (key list), and all `style={{ … }}` value interpolation.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline capture so post-migration gates have a recorded "before" state.

- [x] T001 Capture the pre-migration baseline: run the two inventory searches from quickstart.md Gate 1 (expect 98 template-literal matches in 54 files; 66 raw join matches in 37 files) and `pnpm --filter @blue/app test`; append the confirmed counts and any pre-existing test failures to research.md §R0 in specs/097-cn-classname-migration/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the composition semantics every story relies on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create the helper semantics test lock in packages/blue-app/src/renderer/lib/cn.test.ts covering (per data-model.md): last-wins conflict resolution (`cn('py-1','py-1.5')` → `py-1.5`), falsy-part handling (no stray/duplicated whitespace for `undefined`/`''`/`false` inputs), opaque passthrough (`mixer-chain-entry--disabled`, `scrollbar-thin` preserved verbatim, never conflict-resolved), and the seven `text-role-*` tokens as one conflict group (later role replaces earlier; unrelated utilities never strip a role). `cn.ts` itself must not change; if a registration gap is found, fix it here first. Verify green: `pnpm --filter @blue/app test -- cn.test.ts`

**Checkpoint**: Foundation ready — user story implementation can begin in parallel.

---

## Phase 3: User Story 1 - Safe Caller Style Overrides in Shared Components (Priority: P1) 🎯 MVP

**Goal**: The five caller-`className` components compose via `cn(base, …, className)` so caller utilities deterministically win conflicts (FR-002, SC-002).

**Independent Test**: quickstart Gate 3 (caller-precedence test file) passes; render each component with and without a caller `className` and assert precedence and clean spacing.

### Verification for User Story 1

> Reproduce the failure first: the precedence assertions must FAIL against the current concatenating implementations.

- [x] T003 [US1] Create the caller-precedence regression test in packages/blue-app/src/renderer/tests/caller-classname.test.tsx using the jsdom house pattern (`// @vitest-environment jsdom`, `createRoot` + `act`, per render-freeze-actions.test.tsx): for `ColorPicker`, `ScoreObjectBar`, `CommitNumberInput`, `ToolbarDisplays`, and blue-x7 `tab-list`, assert (a) a caller utility that conflicts with a base utility appears in `element.className` AND the base conflicting utility does not, and (b) with no caller `className`, the class list has no leading/trailing/double spaces. Confirm it fails before implementation
### Implementation for User Story 1

- [x] T004 [P] [US1] Migrate the caller-className site in components/ColorPicker.tsx:208 from `` `cursor-pointer ${className}` `` to `cn('cursor-pointer', className)` (leave the line-59 conditional site for the US3 sweep)
- [x] T005 [P] [US1] Migrate components/menu-bar/ToolbarDisplays.tsx:40 from `` `toolbar-display-card ${className}`.trim() `` to `cn('toolbar-display-card', className)`
- [x] T006 [P] [US1] Migrate components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx:57 from the manual `${INPUT_CLASS}${className ? …}` form to `cn(INPUT_CLASS, className)`
- [x] T007 [P] [US1] Migrate components/workbench/panels/score/bar-renderers/ScoreObjectBar.tsx:58 from `` `absolute overflow-hidden ${className ?? ''}` `` to `cn('absolute overflow-hidden', className)`
- [x] T008 [P] [US1] Migrate components/instruments/blue-x7/tab-list.tsx:101 from the concatenated base+caller form to `cn(<base utilities>, className)`
- [x] T009 [US1] Run `pnpm --filter @blue/app test -- caller-classname` and confirm green; quick mini-smoke of the color picker surface

**Checkpoint**: US1 independently complete — the five components honor caller overrides deterministically.

---

## Phase 4: User Story 2 - Deterministic Utility Resolution in Score-Object Editors (Priority: P2)

**Goal**: Tracker editor fields stop emitting `py-1` and `py-1.5` together; the intended `py-1.5` is the only effective padding (FR-003, SC-003).

**Independent Test**: quickstart Gate 3 (tracker test) passes; rendered field class lists contain no same-group duplicates.

### Verification for User Story 2

- [x] T010 [US2] Create the tracker conflict regression in packages/blue-app/src/renderer/tests/tracker-field-classes.test.tsx (jsdom house pattern): render the tracker editor fields (or, if full render wiring is disproportionate, export the `TRACKER_*` constants from components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx and assert their composition through `cn`) and assert the resulting class lists contain `py-1.5` and NOT both `py-1` and `py-1.5`. Confirm it fails before the fix
### Implementation for User Story 2

- [x] T011 [US2] Fix the audited conflict sites in components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx: line 70 `TRACKER_MONO_FIELD_CLASS` (compose without template literal, e.g. `cn(TRACKER_FIELD_CLASS, 'font-mono')`), and lines ~690/:700/:710 → `cn('w-full', TRACKER_FIELD_CLASS, 'py-1.5')` etc., so no element carries two same-group utilities. Scope note: only these conflict sites in this story; the file's remaining ~15 template-literal sites belong to the US3 sweep (batch B)
- [x] T012 [US2] Run `pnpm --filter @blue/app test -- tracker-field-classes` and confirm green; manual check of the tracker editor surface per quickstart Gate 5 row 1 (intended padding, no double padding)

**Checkpoint**: US1 and US2 both independently complete.

---

## Phase 5: User Story 3 - One Class-Composition Convention Across the Renderer (Priority: P3)

**Goal**: All remaining template-literal and array-join class composition migrated to `cn()` (FR-001, SC-001) and the lint guard active (FR-006).

**Independent Test**: quickstart Gates 1 and 2 — exhaustive searches return only the four excluded files' non-class lines, and lint passes including negative validation.

### Implementation for User Story 3

Area batches are mutually parallel ([P], disjoint file sets). Each batch: convert `{`a ${b}`}` → `cn('a', b)` and `[...].filter(Boolean).join(' ')` → `cn(...)`, keep class constants as strings (research D4), preserve opaque BEM tokens verbatim, and spot-check 2–3 rendered class lists per quickstart's equivalence method before moving on.

- [x] T013 [P] [US3] Sweep batch A — score panels (13 files under components/workbench/panels/): score/ScoreToolbar.tsx (6 sites), ScorePanel.tsx (4+1), score/layer-groups/ScoreTimeCanvas.tsx (2+1), score/TrackInstrumentControl.tsx (2), score/TempoRegionBar.tsx (2), score/ScoreManagerDialog.tsx (2), score/automation/AutomationLayerOverlay.tsx (1), score/TempoMapEditorDialog.tsx (1), score/TempoLineView.tsx (1), score/ScorePathBar.tsx (1), score/PatternLayerHeader.tsx (1+1), score/MeterMapEditorDialog.tsx (1), score/ColumnHeader.tsx (1)
- [x] T014 [P] [US3] Sweep batch B — score-object editors (14 files): score-object/editors/TrackerScoreObjectEditor.tsx (remaining ~15 sites after T011), TrackerObjectEditor.tsx (1), PianoRollEditor.tsx (2), pianoroll/PianoRollSnapButton.tsx (3), pianoroll/TimeBar.tsx (1), pianoroll/PianoRollPropertiesEditor.tsx (1), pianoroll/PianoRollCanvas.tsx (1), PatternObjectEditor.tsx (2), FileBackedScoreObjectEditor.tsx (2+2), SoundEditor.tsx (1+1), ExternalScoreObjectEditor.tsx (1), ObjectBuilderScoreObjectEditor.tsx (1 join), note-processors/NoteProcessorChainEditor.tsx (2), jmask/generator-editors.tsx (1)
- [x] T015 [P] [US3] Sweep batch C — orchestra/BSB (12 files): orchestra/bsb/BSBInterfaceCanvas.tsx (1), bsb/BSBInterfaceEditor.tsx (2 joins), bsb/BSBCodeEditor.tsx (1 join), bsb/PresetsManagerDialog.tsx (2 joins), orchestra/BlueSynthBuilderEditor.tsx (3 joins), orchestra/GenericInstrumentEditor.tsx (1), orchestra/JavaScriptInstrumentEditor.tsx (1), orchestra/PythonInstrumentEditor.tsx (1), orchestra/InstrumentEditorPanel.tsx (2 joins), orchestra/ArrangementPanel.tsx (1 join), orchestra/SplitPane.tsx (6 joins including the pane/handle helper builders), bsb/widgets/WidgetWrapper.tsx (1 join). Do NOT touch bsb/widgets/utils.ts (excluded SVG path join)
- [x] T016 [P] [US3] Sweep batch D — workbench shell/aux + misc panels (15 files): workbench/WorkbenchShell.tsx (3 joins), workbench/AuxiliaryRail.tsx (1+2), workbench/AuxiliarySlideout.tsx (2 joins), ProjectPropertiesPanel.tsx (1 join), VirtualKeyboardPanel.tsx (1 join), FreezeOperationDialog.tsx (1), ScratchPadPanel.tsx (1), audio-player/AudioPlayerPanel.tsx (2), midi-input/MidiInputProcessorForm.tsx (1), mixer/ChannelStrip.tsx (3+1), output/OutputPanel.tsx (1), project-properties/ClojureProjectTab.tsx (3), project-properties/ProjectInformationTab.tsx (1), project-properties/ProjectPropertyFields.tsx (1+2), effect-editor/EffectEditorPanel.tsx (3 joins)
- [x] T017 [P] [US3] Sweep batch E — trees/libraries/UDO/tools (9 files): tools/file-manager/FileManagerTree.tsx (2 joins), effects-library/EffectLibraryTree.tsx (2 joins), code-repository/CodeRepositoryTree.tsx (2 joins), libraries/LibraryTree.tsx (1), libraries/LibraryDropMarker.tsx (1+1), libraries/LibraryContextMenu.tsx (1), udo/UdoEditor.tsx (2 joins), udo/UdoTable.tsx (2 joins), tools/SoundFontViewerPanel.tsx (2)
- [x] T018 [P] [US3] Sweep batch F — settings/about/blue-x7/shared (9 files): settings/MidiSettings.tsx (2), settings/OscSettings.tsx (1), settings/RealtimeRenderSettings.tsx (1), about/AboutApp.tsx (1), instruments/blue-x7/common-panel.tsx (1), instruments/blue-x7/algorithm-dialog.tsx (1), shared/line-editor/LineDefinitionTable.tsx (1), shared/line-editor/EditableLineCanvas.tsx (1+1), panels/editors/CsoundEditorContextMenu.tsx (2 joins including the `getMenuItemClassName` helper)
- [x] T019 [US3] Add the lint guard to eslint.config.mjs: a new flat-config block scoped to `packages/blue-app/src/renderer/**/*.{ts,tsx}` with `no-restricted-syntax` selectors `JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral` and `JSXAttribute[name.name='className'] JSXExpressionContainer CallExpression[callee.property.name='join']`, message directing to `cn()` from `src/renderer/lib/cn.ts` (research D1; the existing test-exception block later in the file already exempts tests). Requires T013–T018 complete. Run `pnpm lint` (must pass), then quickstart Gate 2 negative validation (deliberate violations error; a test-file violation does not) and revert
- [x] T020 [US3] Run quickstart Gate 1 exhaustive searches: template-literal search returns nothing; join search returns only AutomationLineView.tsx, bsb/widgets/utils.ts, library-store.ts, keyboard-mapping.ts lines; confirm the excluded files are byte-identical (`git diff --stat` shows no changes to them)

**Checkpoint**: Zero hand-rolled class composition remains; the convention is lint-enforced.

---

## Phase 6: User Story 4 - Documented Styling Boundary (Priority: P4)

**Goal**: The boundary rules live in agent/developer guidance (FR-007, SC-004).

**Independent Test**: quickstart SC-004 walkthrough — the guidance alone answers where new styling goes for a new panel, a dockview override, and an animation.

- [x] T021 [P] [US4] Add the "class styling composition" subsection to the "UI and typography guidance" section of AGENTS.md stating (per contracts/classname-composition.md §6): composition rule (all composed classes via `cn()`), source rule (new styling uses Tailwind utilities; no new BEM blocks in `packages/blue-app/src/renderer/styles/index.css`), plain-CSS exception whitelist (`@theme` tokens, `.dv-*`/`.cm-*` third-party overrides, keyframes, scrollbars, pseudo-elements), retain list (shared context menu skins, `workbench-shell`, auxiliary slideout, edge rail), and strangler policy (port simple BEM blocks only when already touching the component; never batch). Do not modify docs/typography.md (roles/metrics unchanged)

**Checkpoint**: Boundary documented and discoverable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full verification across everything the stories delivered.

- [x] T022 Run full verification from the repository root: `pnpm --filter @blue/app test`, `pnpm lint`, `git diff --check` (quickstart Gate 4) — no new failures versus the T001 baseline
- [x] T023 Run the quickstart Gate 5 manual smoke pass over the named surfaces (tracker editor, score toolbar, color picker, mixer, workbench shell/aux, context menus, jmask, blue-x7 tabs, trees, output/settings) and record observations (e.g., in the final implementation commit message); only the audited conflict fixes may differ from pre-migration behavior — user-confirmed complete on 2026-09-03 with no visual regressions observed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup; BLOCKS all user stories (T002 defines the semantics every migration relies on).
- **User Stories (Phases 3–6)**: All depend on Phase 2. Recommended sequential in priority order (US1 → US2 → US3 → US4); US4 (T021) is independent of US1/US2 and could run early in parallel if desired.
- **Polish (Phase 7)**: Depends on all stories complete.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only. MVP.
- **US2 (P2)**: After Phase 2 only; independent of US1 (different files).
- **US3 (P3)**: Batches T013–T018 are mutually parallel; T014 must follow T011 (same file, remaining sites); T019/T020 require all batches complete.
- **US4 (P4)**: After Phase 2 only; independent of US1–US3.

### Within Each User Story

- Regressions are written first and confirmed failing before the fix (T003 before T004–T008; T010 before T011).
- Story complete (tests green + smoke) before moving to the next priority.

### Parallel Opportunities

- T002 is self-contained; T021 can run any time after Phase 2.
- US1: T004–T008 are five disjoint files — fully parallel after T003.
- US3: T013–T018 are six disjoint file batches — fully parallel (mind T014 after T011).

---

## Parallel Example: User Story 3

```bash
# After Phase 2 (and T011 for batch B), launch the six area batches together:
Task: "Sweep batch A — score panels (13 files under packages/blue-app/src/renderer/components/workbench/panels/)"
Task: "Sweep batch C — orchestra/BSB (12 files, exclude bsb/widgets/utils.ts)"
Task: "Sweep batch D — workbench shell/aux + misc panels (15 files)"
Task: "Sweep batch E — trees/libraries/UDO/tools (9 files)"
Task: "Sweep batch F — settings/about/blue-x7/shared (9 files)"
# Batch B joins after T011 (TrackerScoreObjectEditor.tsx shared with US2).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (baseline) and Phase 2 (semantics lock).
2. Complete Phase 3 (US1): five components honor caller overrides — deliverable value on its own.
3. **STOP and VALIDATE**: caller-classname tests green, mini-smoke clean.

### Incremental Delivery

1. Setup + Foundational → semantics locked.
2. US1 → test independently (MVP).
3. US2 → tracker conflicts fixed, test independently.
4. US3 → six area batches, then lint guard, then Gate 1 zero-site proof.
5. US4 → boundary documented.
6. Polish → full test/lint + Gate 5 smoke pass.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps tasks to spec user stories for traceability.
- Every migrated site is semantics-preserving except the audited conflict fixes (FR-004) — keep diffs surgical; do not restyle, reorder, or "improve" classes in passing.
- Opaque BEM tokens pass through `cn()` verbatim — never renamed, never dropped (FR-008).
- Excluded files (Path Conventions) must remain byte-identical; T020 verifies this.
- Commit after each task or logical batch; run `git diff --check` before handoff.
