---

description: "Implementation tasks for the BlueX7 tabbed user interface"
---

# Tasks: BlueX7 Tabbed User Interface

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/094-bluex7-tabbed-ui/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Organization**: Tasks are grouped by user story. The feature is renderer-only; existing data,
preload, main-process, engine, XML, CSD, and SysEx boundaries are preserved and verified.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the implementation surface and repository constraints before editing source.

- [X] T001 [P] Confirm the renderer-only implementation surface, Java parity references, and no-change boundaries in `specs/094-bluex7-tabbed-ui/plan.md`, `specs/094-bluex7-tabbed-ui/research.md`, and `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`
- [X] T002 [P] Audit the approved typography roles and existing keep-mounted/hidden-panel layout patterns in `docs/typography.md`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/GenericInstrumentEditor.tsx`

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared tab semantics and protect the existing runtime boundary before user-story work.

**⚠️ CRITICAL**: Complete this phase before implementing user stories.

- [X] T003 [P] Implement the renderer-local `BlueX7TabList` primitive with generated per-instance IDs, manual activation, roving tab index, Left/Right wraparound focus movement, Enter/Space activation, selected-tab scrolling, and one-row horizontal overflow in `packages/blue-app/src/renderer/components/instruments/blue-x7/tab-list.tsx`
- [X] T004 [P] Extend the effective-value boundary regression coverage to preserve valid target/session validation, non-empty request enforcement, and the 151-parameter upper bound in `packages/blue-app/src/shared/blue-x7-runtime-contract.test.ts`
- [X] T005 Add focused reusable tab-list contract assertions for `role`, `aria-selected`, `aria-controls`, `aria-labelledby`, roving `tabIndex`, manual keyboard activation, and inactive-panel exclusion in `packages/blue-app/src/renderer/tests/blue-x7-a11y-layout.test.tsx`

**Checkpoint**: Shared tab behavior and the existing typed readback boundary are protected; story implementation can proceed.

## Phase 3: User Story 1 - Tabbed Navigation for Major Instrument Sections (Priority: P1) 🎯 MVP

**Goal**: Replace the long BlueX7 vertical stack with four keep-mounted top-level views while keeping the header and history controls visible.

**Independent Test**: In a fresh 600px-high editor, Voice & Global is selected, each top-level tab reveals only its active panel, the header remains visible, tab changes emit no patch, and a 360px host keeps the tab row horizontal and scrollable.

### Verification for User Story 1

- [X] T006 [P] [US1] Extend editor integration tests for the default Voice & Global view, header persistence, top-level panel visibility, client-only tab changes, fresh-mount reset, and zero patch dispatch in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx`
- [X] T007 [US1] Extend accessibility and jsdom layout tests for top-level tab/panel relationships, arrow-versus-activation behavior, hidden-panel pointer/accessibility exclusion, and 360px one-row scrolling in `packages/blue-app/src/renderer/tests/blue-x7-a11y-layout.test.tsx`

### Implementation for User Story 1

- [X] T008 [US1] Recompose `BlueX7Editor` as a full-height non-scrolling shell with persistent metadata/effective-value header, top-level `BlueX7TabList`, generated tabpanel IDs, and keep-mounted visibility wrappers for Global, Operators, Pitch, and Csound in `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`
- [X] T009 [P] [US1] Adjust Voice & Global content sizing and inner overflow while preserving existing patch handlers and effective-value badges in `packages/blue-app/src/renderer/components/instruments/blue-x7/common-panel.tsx` and `packages/blue-app/src/renderer/components/instruments/blue-x7/lfo-panel.tsx`
- [X] T010 [US1] Replace the old all-panels-in-one-column browser assertions with active-tab geometry, pinned-header, no-outer-scroll, and narrow-host tab-row checks in `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx`

**Checkpoint**: User Story 1 is independently usable and demonstrates the primary scroll-reduction goal without changing the model or history.

## Phase 4: User Story 2 - Focused Operator Workstation with Sub-Tabs (Priority: P2)

**Goal**: Provide accessible Op 1–Op 6 navigation, muted indicators, spacious operator controls, and fail-closed atomic envelope gestures.

**Independent Test**: In Operators, Op 1 is selected on mount, Op 2/Op 6 selection updates the displayed fields and muted state without a patch, a visible drag commits exactly one patch, and switching operator/top-level tabs or receiving `pointercancel` leaves no partial patch or captured pointer.

### Verification for User Story 2

- [X] T011 [P] [US2] Extend operator integration tests for nested tab selection, muted indicators, selected-operator patch indices, and operator state preservation in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx`
- [X] T012 [P] [US2] Extend accessibility tests for the nested operator tablist, panel relationships, roving focus, and inactive operator content traversal in `packages/blue-app/src/renderer/tests/blue-x7-a11y-layout.test.tsx`
- [X] T013 [P] [US2] Add gesture regression cases for pointer-up coalescing, `pointercancel`, active-panel deactivation, operator switching, pointer-capture release, unmount cleanup, and idempotent commit in `packages/blue-app/src/renderer/tests/blue-x7-envelope.test.tsx`

### Implementation for User Story 2

- [X] T014 [US2] Refactor the operator selector to use `BlueX7TabList`, expose generated nested tabpanel relationships, retain Op 1 mount defaults, show muted state from canonical operator enables, and pass active-state gesture cleanup through `packages/blue-app/src/renderer/components/instruments/blue-x7/operator-panel.tsx`
- [X] T015 [P] [US2] Add active-state layout and fail-closed staged-gesture cancellation to the PEG panel while retaining its four-stage numeric controls and existing patch variants in `packages/blue-app/src/renderer/components/instruments/blue-x7/pitch-envelope-panel.tsx`
- [X] T016 [US2] Harden envelope pointer lifecycle handling so only an active matching gesture can update/commit, `pointercancel` and unmount clear staged state, and every successful capture is released in `packages/blue-app/src/renderer/components/instruments/blue-x7/envelope-editor.tsx`
- [X] T017 [US2] Extend undo/redo integration coverage to prove top-level and nested tab transitions preserve history while completed envelope edits remain one atomic step in `packages/blue-app/src/renderer/tests/blue-x7-undo.test.tsx`

**Checkpoint**: User Stories 1 and 2 both work, with operator editing and gesture safety independently verifiable.

## Phase 5: User Story 3 - Full-Height Csound Post-Processing Workspace (Priority: P3)

**Goal**: Give Post Code, Generated Preview, and Bindings & Diagnostics a full-height Csound workspace with persistent nested state.

**Independent Test**: The Csound & Code tab exposes its three nested tabs, Post Code fills the active panel height, Preview and Bindings retain their existing generation/diagnostic behavior, and Csound edits continue through the current patch/history path.

### Verification for User Story 3

- [X] T018 [P] [US3] Extend Csound panel tests for nested manual tab semantics, Post Code/Preview/Bindings state preservation, generated preview updates, diagnostics content, and existing Csound mutation behavior in `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`
- [X] T019 [P] [US3] Add browser assertions for CodeMirror height, visible nested Csound panel geometry, keyboard focus, and local preview scrolling in `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx`

### Implementation for User Story 3

- [X] T020 [US3] Refactor the Csound panel to use `BlueX7TabList`, expose nested tabpanel relationships, pass active state to `SelectedCodeEditor`, and replace fixed-height Post Code/preview sizing with a full-height flex layout in `packages/blue-app/src/renderer/components/instruments/blue-x7/csound-panel.tsx`

**Checkpoint**: User Stories 1–3 are independently usable; Csound authoring has the full active panel height without changing CSD generation.

## Phase 6: User Story 4 - Seamless Realtime & Effective-Value Synchronization across Tabs (Priority: P4)

**Goal**: Poll only the active view’s catalog-derived parameters, refresh immediately on activation, and reject stale responses without affecting durable state.

**Independent Test**: Mocked readback requests contain exactly the active scope (17 Global IDs, 24 selected-operator IDs, 8 Pitch IDs, and no Csound request), a same-length Op 1→Op 2 switch rejects the old response, activation starts a fresh sample within the 20 Hz interval, and tab changes do not affect patches or history.

### Verification for User Story 4

- [X] T021 [P] [US4] Add exact active-scope, allowlist-intersection, empty-Csound, immediate-refresh, same-length-operator-staleness, unavailable-result, and one-request-generation regression cases in `packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx`
- [X] T022 [US4] Extend editor integration coverage to prove effective badges update only for active controls, hidden IDs are not requested, Csound clears disposable values, and tab changes emit no project patch in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx`

### Implementation for User Story 4

- [X] T023 [US4] Derive the active effective-value scope from `BLUE_X7_PARAMETER_DESCRIPTORS`, include Global Common/LFO plus six operator-enable IDs, include the selected operator group plus shared keys, intersect the host allowlist, and suppress empty Csound requests in `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`
- [X] T024 [P] [US4] Key effective-value polling by stable ordered parameter-set signatures and request generations, clear obsolete display state on scope changes, preserve the one-current-request rule, and validate target/session/owner/result freshness in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-effective-values.ts`

**Checkpoint**: All four user stories work together; live values remain disposable display state and the existing IPC contract is unchanged.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete constitution-required parity, boundary, visual, typography, and repository validation.

- [X] T025 [P] Audit every new or changed BlueX7 UI label/class against the seven semantic typography roles and update only the affected renderer files and `docs/typography.md` if a documented role/exception changes in `packages/blue-app/src/renderer/components/instruments/blue-x7/`
- [X] T026 [P] Run the BlueX7 catalog, XML/unknown-data, voice transport, SysEx, and modern-render compatibility suite under `packages/blue-data/src/instruments/blue-x7/` and record any pre-existing locked-hash mismatch without changing its accepted reference
- [X] T027 [P] Run the existing preload and main runtime contract/readback regression suites in `packages/blue-app/src/preload/blue-x7-effective-values.test.ts`, `packages/blue-app/src/main/blue-x7-runtime-sync.test.ts`, and `packages/blue-app/src/shared/blue-x7-runtime-contract.test.ts`
- [X] T028 [P] Execute the V01–V10 visual acceptance matrix at desktop, narrow, DPR, and typography zoom conditions and record results or scoped environment limitations in `specs/094-bluex7-tabbed-ui/contracts/visual-acceptance.md` and `specs/094-bluex7-tabbed-ui/quickstart.md`
- [X] T029 Run the focused renderer suites, browser layout command, and renderer build from the repository root using the commands in `specs/094-bluex7-tabbed-ui/quickstart.md` and `packages/blue-app/package.json`
- [X] T030 Run the affected-package test gate, repository lint, full test suite, and `git diff --check` from `/Users/stevenyi/work/blue-electron` using `packages/blue-app/package.json` and `/Users/stevenyi/work/blue-electron/package.json`
- [X] T031 Update the validation evidence and any scoped exception notes in `specs/094-bluex7-tabbed-ui/quickstart.md`, retaining the documented pre-existing modern-render hash and Chromium startup baselines unless implementation changes prove them resolved

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T002 have no implementation dependencies and can run in parallel.
- **Foundational (Phase 2)**: T003–T005 depend on the setup review; T003 and T004 can run in parallel, and T005 follows the tab primitive contract.
- **User Story 1 (Phase 3)**: Depends on Phase 2. T006 and T007 are parallel test work; T008–T009 implement the shell/content; T010 validates the integrated browser layout.
- **User Story 2 (Phase 4)**: Depends on User Story 1 so the Operators panel is mounted inside the new shell. T011–T013 are parallel test work; T014 and T015 can then be implemented in parallel; T016–T017 complete gesture/history integration.
- **User Story 3 (Phase 5)**: Depends on User Story 1 so the Csound panel is mounted in the tabpanel stack. T018 and T019 can be authored in parallel; T020 completes the Csound implementation.
- **User Story 4 (Phase 6)**: Depends on User Stories 1 and 2 because scope derivation consumes top-level and selected-operator state. T021–T022 establish regression coverage; T023 and T024 can be implemented in parallel once those tests are defined.
- **Polish (Phase 7)**: T025–T028 can run in parallel after the desired stories; T029–T031 run after implementation and focused verification.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational; this is the MVP increment.
- **US2 (P2)**: Depends on US1’s top-level panel composition; it preserves US1 behavior.
- **US3 (P3)**: Depends on US1’s top-level panel composition; it is otherwise independent of US2.
- **US4 (P4)**: Depends on US1 and US2 state wiring; it is independent of Csound implementation after the active scope is defined.

### Parallel Execution Examples

#### User Story 1

```text
Task T006: Add editor-level navigation and patch-isolation tests in blue-x7-editor.test.tsx
Task T007: Add ARIA and narrow-layout tests in blue-x7-a11y-layout.test.tsx
```

#### User Story 2

```text
Task T011: Add operator integration tests in blue-x7-editor.test.tsx
Task T012: Add nested operator accessibility tests in blue-x7-a11y-layout.test.tsx
Task T013: Add envelope lifecycle tests in blue-x7-envelope.test.tsx
```

#### User Story 3

```text
Task T018: Add CsoundPanel unit/preview tests in blue-x7-csound-preview.test.tsx
Task T019: Add browser Csound geometry/focus tests in blue-x7-editor.browser.test.tsx
```

#### User Story 4

```text
Task T023: Implement editor-side catalog scope derivation in blue-x7-editor.tsx
Task T024: Implement hook signature/generation invalidation in use-blue-x7-effective-values.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1, including its jsdom and browser checks.
3. Stop and validate the four-tab shell, pinned header, no-patch navigation, and narrow layout independently.
4. Demo the scroll-reduction MVP before adding operator gesture, Csound sizing, or live-scope changes.

### Incremental Delivery

1. Add US2 for accessible operator sub-tabs and safe atomic envelope interaction.
2. Add US3 for full-height Csound authoring and nested preview/binding tabs.
3. Add US4 for active-only effective-value polling and stale-response handling.
4. Run the compatibility and repository-wide validation phase after each desired increment.

### Boundary and Compatibility Strategy

- Keep `BlueX7Voice`, `BlueX7Patch`, `BlueX7InstrumentSnapshot`, `BLUE_X7_PARAMETER_DESCRIPTORS`, project XML, CSD generation, SysEx parsing, preload envelopes, and main-process runtime ownership unchanged.
- Keep tab, focus, selected-operator, Csound sub-tab, effective-value, and gesture state renderer-local and disposable.
- Treat the existing modern-render hash and Chromium startup failures documented in `specs/094-bluex7-tabbed-ui/quickstart.md` as pre-existing until a test proves otherwise; never silently rebaseline them.

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency.
- Every checklist item has a sequential ID, a required story label only inside a user-story phase, and at least one exact repository path.
- The implementation should use the existing `pnpm` commands and preserve unrelated worktree changes.

## Phase 8: Convergence

- [X] T032 [CRITICAL] Make effective-value readback fail closed when the engine returns a short or non-finite channel result instead of substituting `0`, preserving the explicit unavailable envelope and adding a focused regression in `packages/blue-app/src/main/blue-x7-runtime-sync.ts` and `packages/blue-app/src/main/blue-x7-runtime-sync.test.ts` per `.specify/memory/constitution.md` (contradicts)
- [X] T033 [HIGH] Validate successful effective-value responses against the current project session, owner identity, active parameter-ID set, and finite-value invariants before updating disposable display state, with mismatched-response coverage in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-effective-values.ts` and `packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx` per `specs/094-bluex7-tabbed-ui/contracts/blue-x7-tabs.md` (partial)
- [X] T034 [HIGH] Make the effective-value in-flight lock owned by the request generation so a stale request cleanup cannot clear a newer generation's lock, and add a same-length scope-switch regression that keeps both requests pending in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-effective-values.ts` and `packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx` per `specs/094-bluex7-tabbed-ui/plan.md` (partial)
- [X] T035 [HIGH] Thread effective values into the Pitch Envelope panel and apply the same live-display precedence as the other active controls without overwriting local gesture state or canonical voice data, with a resolved-pitch-value/no-patch regression in `packages/blue-app/src/renderer/components/instruments/blue-x7/pitch-envelope-panel.tsx` and `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx` per `specs/094-bluex7-tabbed-ui/spec.md` (partial)
- [X] T036 [HIGH] Propagate deactivation and operator-change cancellation into the keep-mounted `EnvelopeEditor` so child drag state and pointer capture are released before a panel becomes hidden, and assert release plus no late patch for both operator and PEG gestures in `packages/blue-app/src/renderer/components/instruments/blue-x7/envelope-editor.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/operator-panel.tsx`, `packages/blue-app/src/renderer/components/instruments/blue-x7/pitch-envelope-panel.tsx`, and `packages/blue-app/src/renderer/tests/blue-x7-envelope.test.tsx` per `specs/094-bluex7-tabbed-ui/contracts/blue-x7-tabs.md` (partial)
- [X] T037 [MEDIUM] Base tab and panel ARIA IDs on a generated per-mount editor identity even when assignment IDs match, and add a same-assignment multi-instance collision regression in `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx` and `packages/blue-app/src/renderer/tests/blue-x7-hosts.test.tsx` per `specs/094-bluex7-tabbed-ui/data-model.md` (partial)
- [X] T038 [MEDIUM] Add a canonical SysEx `replaceVoice` synchronization regression that applies the imported patch and verifies all keep-mounted Global, Operator, Pitch, and Csound views refresh from the new snapshot while disposable effective state remains non-persistent and no extra patch/history entry is emitted in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx` per `specs/094-bluex7-tabbed-ui/spec.md` (partial)
- [X] T039 [MEDIUM] Exercise the docked Orchestra and track-editor host wiring with a live BlueX7 runtime target/session and assert effective values reach the active controls without entering canonical project patches or persistence in `packages/blue-app/src/renderer/components/workbench/panels/OrchestraPanel.tsx`, `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`, and `packages/blue-app/src/renderer/tests/blue-x7-hosts.test.tsx` per `specs/094-bluex7-tabbed-ui/plan.md` (missing)

## Closure

All implementation and convergence tasks T001–T039 are complete. Manual acceptance was completed
by the requester on 2026-09-01. The final automated evidence and the two pre-existing validation
limitations are recorded in [`quickstart.md`](quickstart.md); no canonical data, IPC contract,
or compatibility reference was rebaselined for closure.
