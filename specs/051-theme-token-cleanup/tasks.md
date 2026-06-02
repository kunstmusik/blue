# Tasks: Centralized Renderer Theming

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/theme-audit-contract.md](./contracts/theme-audit-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Include focused audit/build/test tasks because this feature is a broad renderer refactor with visual regression risk.

**Organization**: Tasks are grouped by user story to enable independently testable migration slices.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the current baseline and make drift measurable before broad refactoring.

- [x] T001 Record the current post-GPT54 styling baseline in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/status.md`
- [x] T002 [P] Create the initial approved exception inventory in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/theme-exceptions.md`
- [x] T003 [P] Add a renderer theme audit script in `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`
- [x] T004 Wire the theme audit command into `/Users/stevenyi/work/blue-electron/package.json`
- [x] T005 Run the new audit command and capture the initial failing summary in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/status.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expand the shared theme vocabulary and compatibility bridge before component migrations.

**CRITICAL**: No broad component color migration should begin until the theme roles and audit command exist.

- [x] T006 Expand canonical `app-*` theme roles in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T007 Add required legacy aliases such as `blue-text` and `blue-hover` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T008 Replace retained `blue-*` usages inside shared component-layer CSS with canonical `app-*` roles in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T009 Document the theme-role mapping table in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/theme-exceptions.md`
- [x] T010 Verify GPT54 settings primitives still compile without static inline colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`

**Checkpoint**: Theme roles, aliases, and audit infrastructure are ready for independent surface migrations.

---

## Phase 3: User Story 1 - Change Theme Roles From One Place (Priority: P1) MVP

**Goal**: Make core app chrome and shared entry surfaces consume canonical theme roles from the central theme source.

**Independent Test**: Change one representative role in `index.css`, rebuild, and verify settings, workbench chrome, context menus, and editor shell consume it without component-local color edits.

### Tests for User Story 1

- [x] T011 [P] [US1] Add theme alias coverage to `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`
- [x] T012 [P] [US1] Add a package command validation expectation in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/quickstart.md`

### Implementation for User Story 1

- [x] T013 [US1] Convert Dockview CSS variable overrides to canonical token references in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T014 [US1] Convert toolbar and context-menu static palette values to canonical token references in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T015 [US1] Convert workbench shell, edge rail, auxiliary slideout, and panel shell static palette values to canonical token references in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T016 [US1] Convert output and mixer custom CSS static palette values to canonical token references in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T017 [P] [US1] Create shared toast styling in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/lib/toast-styles.ts`
- [x] T018 [US1] Replace duplicated toast palette objects in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/main.tsx`
- [x] T019 [US1] Replace duplicated toast palette objects in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/effect-editor.tsx`
- [x] T020 [US1] Run the single-role change probe from `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/quickstart.md`

**Checkpoint**: Core chrome can be themed centrally and legacy aliases resolve.

---

## Phase 4: User Story 2 - Replace Ad Hoc Component Palette Usage (Priority: P2)

**Goal**: Move high-frequency renderer component colors and static inline palette styles to named theme roles.

**Independent Test**: Run the theme audit and verify no unapproved arbitrary color utilities or static inline theme colors remain in migrated component families.

### Tests for User Story 2

- [x] T021 [P] [US2] Add arbitrary utility detection to `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`
- [x] T022 [P] [US2] Add static inline color detection to `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`

### Implementation for User Story 2

- [x] T023 [P] [US2] Migrate Blue Live shell static inline colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/BlueLivePanel.tsx`
- [x] T024 [P] [US2] Migrate Blue Live space grid static inline colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
- [x] T025 [P] [US2] Migrate Blue Live options static inline colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/blue-live/OptionsTab.tsx`
- [x] T026 [P] [US2] Migrate Blue Live code static inline colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveCodeTab.tsx`
- [x] T027 [P] [US2] Migrate effect editor arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx`
- [x] T028 [P] [US2] Migrate effect library arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/EffectLibraryModal.tsx`
- [x] T029 [P] [US2] Migrate score panel arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T030 [P] [US2] Migrate score dialog arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx`
- [x] T031 [P] [US2] Migrate meter dialog arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/MeterMapEditorDialog.tsx`
- [x] T032 [P] [US2] Migrate ruler dialog arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/RulerConfigDialog.tsx`
- [x] T033 [P] [US2] Migrate piano roll shell arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/PianoRollEditor.tsx`
- [x] T034 [P] [US2] Migrate piano roll ruler dialog arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PianoRollRulerConfigDialog.tsx`
- [x] T035 [P] [US2] Migrate pitch header app chrome colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/PitchHeader.tsx`
- [x] T036 [P] [US2] Migrate shared line editor arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx`
- [x] T037 [P] [US2] Migrate shared line table arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/LineDefinitionTable.tsx`
- [x] T038 [P] [US2] Migrate sound editor arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx`
- [x] T039 [P] [US2] Migrate tracker editor arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx`
- [x] T040 [P] [US2] Migrate JMask parameter row arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/ParameterRow.tsx`
- [x] T041 [P] [US2] Migrate orchestra arrangement arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/ArrangementPanel.tsx`
- [x] T042 [P] [US2] Migrate BSB property sheet arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx`
- [x] T043 [P] [US2] Migrate BSB editor chrome arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBWidgetEditor.tsx`
- [x] T044 [P] [US2] Migrate BSB preset bar arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPresetBar.tsx`
- [x] T045 [P] [US2] Migrate UDO editor arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/udo/UdoEditor.tsx`
- [x] T046 [P] [US2] Migrate UDO table arbitrary colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/udo/UdoTable.tsx`
- [x] T047 [US2] Re-run the theme audit and update `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/status.md`

**Checkpoint**: High-frequency component palette drift is removed or documented.

---

## Phase 5: User Story 3 - Keep Necessary Custom Styling Boundaries Explicit (Priority: P3)

**Goal**: Make retained custom CSS and editor/library palettes explicit, token-backed, and auditable.

**Independent Test**: Review the exception inventory and verify every retained literal value has a reason, owner surface, and permanent/temporary status.

### Tests for User Story 3

- [x] T048 [P] [US3] Add exception allowlist loading to `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`
- [x] T049 [P] [US3] Add raw CSS color detection outside the `@theme` block to `/Users/stevenyi/work/blue-electron/scripts/audit-renderer-theme.mjs`

### Implementation for User Story 3

- [x] T050 [US3] Tokenize CodeMirror app chrome colors and document syntax palette exceptions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`
- [x] T051 [US3] Document BSB Java Blue parity color exceptions in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/theme-exceptions.md`
- [x] T052 [US3] Document score and piano-roll data-driven color exceptions in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/theme-exceptions.md`
- [x] T053 [US3] Document retained third-party/custom-selector boundaries in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/theme-exceptions.md`
- [x] T054 [US3] Remove or justify remaining raw CSS color literals in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`
- [x] T055 [US3] Re-run the theme audit and verify all remaining findings are approved exceptions in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/status.md`

**Checkpoint**: Retained custom styling is intentional and documented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole renderer and prepare handoff.

- [x] T056 [P] Run `pnpm --filter @blue/app build` using `/Users/stevenyi/work/blue-electron/package.json`
- [x] T057 [P] Run targeted renderer tests for touched surfaces from `/Users/stevenyi/work/blue-electron/packages/blue-app`
- [x] T058 Run `pnpm --filter @blue/app test` using `/Users/stevenyi/work/blue-electron/package.json`
- [x] T059 Complete the visual smoke checklist in `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/quickstart.md`
- [x] T060 Update `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/status.md` with final audit, validation, and exception results
- [x] T061 Update `/Users/stevenyi/work/blue-electron/STATUS.md` for Spec 051 handoff
- [x] T062 Run `git diff --check` from workspace `/Users/stevenyi/work/blue-electron/STATUS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user story migrations.
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 2; can proceed after the shared roles are available, but should use audit improvements from US1 when possible.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and should finish after most US2 migrations so the exception list reflects final state.
- **Polish (Phase 6)**: Depends on selected user stories.

### User Story Dependencies

- **User Story 1 (P1)**: MVP. Establishes centralized role consumption for core chrome.
- **User Story 2 (P2)**: Can run by surface family after foundational roles exist.
- **User Story 3 (P3)**: Can start exception documentation early, but final approval depends on US1/US2 audit results.

### Parallel Opportunities

- Setup documentation and audit script scaffolding can run in parallel.
- Component migrations in US2 are mostly parallel because they touch separate files.
- Audit detector improvements in US1/US2/US3 can be implemented independently if the output contract stays stable.
- Visual smoke checks can be split by surface after the build passes.

## Parallel Example: User Story 2

```text
Task: "Migrate Blue Live shell static inline colors in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/BlueLivePanel.tsx"
Task: "Migrate effect editor arbitrary colors in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/effect-editor/EffectEditorPanel.tsx"
Task: "Migrate BSB property sheet arbitrary colors in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx"
Task: "Migrate UDO editor arbitrary colors in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/udo/UdoEditor.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 token foundation.
2. Complete US1 to make core chrome token-backed.
3. Run the audit, role-change probe, and renderer build.
4. Stop and review before sweeping the broader component surface.

### Incremental Delivery

1. Foundation and audit command.
2. Core chrome and shared entry surfaces.
3. Component-family migrations by highest hardcoded color density.
4. Editor/third-party/BSB exception documentation.
5. Full validation and handoff.

### Notes

- Do not refactor settings components again unless validation finds a regression from the GPT54 baseline.
- Do not remove custom CSS hooks that exist for third-party selectors, pseudo-elements, or complex workbench/mixer layout; token-back them instead.
- Do not theme Java Blue parity or project-data colors unless they are clearly app chrome.
