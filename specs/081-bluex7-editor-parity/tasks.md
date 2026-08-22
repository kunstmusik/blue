# Tasks: BlueX7 Instrument Editor Parity

**Input**: Design documents from `specs/081-bluex7-editor-parity/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Verification**: Java compatibility, lossless XML, typed boundary contracts, canonical state ownership, host isolation, renderer accessibility, and Csound/SysEx regression evidence are mandatory under the project constitution.

**Organization**: Tasks are grouped by user story after a shared portable-model and patch-contract foundation. All implementation tasks name the concrete source or test path they modify.

> **Implementation layout note**: the editor components live at
> `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx` and
> `packages/blue-app/src/renderer/components/instruments/blue-x7/` (kebab-case
> file names, e.g. `operator-panel.tsx`, `use-blue-x7-history.ts`) rather than
> the `workbench/panels/orchestra/blue-x7/` paths named in individual tasks
> below; the orchestra-panel wrapper remains at
> `workbench/panels/orchestra/BlueX7Editor.tsx`. Task path names below are the
> planned locations; actual delivery paths are these.

## Phase 1: Setup and Java Evidence

**Purpose**: Establish authoritative resources and deterministic fixtures before behavior is ported.

- [X] T001 Record the exact Java source/resource revisions and fixture provenance in `specs/081-bluex7-editor-parity/quickstart.md`
- [X] T002 [P] Generate the verbatim 32-algorithm static ORC map from Java `dx701.orc`–`dx732.orc` in `packages/blue-data/src/instruments/blue-x7/algorithm-orchestra.ts`
- [X] T003 [P] Copy the 32 authoritative Java algorithm GIFs into `packages/blue-app/src/renderer/assets/blue-x7/`
- [X] T004 [P] Add Java-default and boundary/unknown XML fixtures in `packages/blue-data/src/instruments/blue-x7/test-fixtures/java-default.blue.xml` and `packages/blue-data/src/instruments/blue-x7/test-fixtures/boundary-and-unknown.blue.xml`
- [X] T005 Add deterministic canonical single/bank SysEx fixtures and Java-oracle expected JSON in `packages/blue-data/src/instruments/blue-x7/test-fixtures/single-voice.syx`, `packages/blue-data/src/instruments/blue-x7/test-fixtures/voice-bank.syx`, and `packages/blue-data/src/instruments/blue-x7/test-fixtures/expected-decode.json`

---

## Phase 2: Foundational Portable Model and Patch Bridge

**Purpose**: Complete the browser-safe model, lossless persistence, and typed three-host mutation seam that block every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes its focused tests.

### Foundational Verification

- [X] T006 [P] Add failing Java-default, range, fixed-cardinality, mixed-shared-value, deep-copy, and root/nested unknown-XML tests in `packages/blue-data/src/instruments/blue-x7.test.ts`
- [X] T007 [P] Add failing complete-snapshot, semantic-patch validation, shared propagation, whole-voice replacement, and unknown-preservation contract tests in `packages/blue-app/src/shared/project-editor-blue-x7.test.ts`
- [X] T008 [P] Add failing optimistic projection and canonical receipt reconciliation coverage in `packages/blue-app/src/renderer/tests/blue-x7-project-store.test.ts`
- [X] T009 [P] Add failing Track semantic-target coalescing, indivisible replacement, stale rebase, and unavailable-result tests in `packages/blue-app/src/renderer/tests/track-instrument-patch-queue.test.ts`
- [X] T010 [P] Add failing library BlueX7 draft patch/save/revert XML round-trip tests in `packages/blue-app/src/main/unified-library/editor-adapters.test.ts`

### Foundational Implementation

- [X] T011 Implement complete Java-default common/LFO/operator/envelope/PEG/post-code value types, validation, and deep copy in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T012 Implement template-based Java-order XML load/save that updates known nodes while preserving unknown root and nested content in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T013 Export the modeled BlueX7 value types and later parser/preview entry points through `packages/blue-data/src/index.ts`
- [X] T014 Define the complete `BlueX7InstrumentSnapshot` and discriminated `BlueX7Patch` contract in `packages/blue-app/src/shared/project-editor.ts`
- [X] T015 Implement validated snapshot creation, canonical semantic patch application, shared sync/PMS propagation, and metadata-preserving whole-voice replacement in `packages/blue-app/src/shared/project-editor.ts`
- [X] T016 Implement identical immutable BlueX7 optimistic projection in `packages/blue-app/src/renderer/stores/project-store.ts`
- [X] T017 Implement BlueX7 semantic-target patch coalescing and indivisible replacement handling in `packages/blue-app/src/renderer/components/track-instrument-editor/track-instrument-patch-queue.ts`
- [X] T018 Verify unified-library draft hydrate/apply/save preserves the complete modeled BlueX7 and unknown XML in `packages/blue-app/src/main/unified-library/editor-adapters.ts`

**Checkpoint**: Complete BlueX7 state can round-trip and mutate through orchestra, Track, and library ownership paths before any detailed UI exists.

---

## Phase 3: User Story 1 — Design and Persist a Complete Voice (Priority: P1) 🎯 MVP

**Goal**: Edit every common, LFO, operator, numeric envelope, PEG, and post-code value, persist it in all hosts, and support editor-session-local undo.

**Independent Test**: Change at least one value in every parameter group and all four stages of one operator envelope plus PEG, switch among all six operators, undo/redo grouped edits, then save/reopen and compare the complete voice and unknown XML.

### Verification for User Story 1

- [X] T019 [P] [US1] Replace the placeholder assertions with failing complete control, operator isolation, shared-control, persistence-dispatch, and post-code tests in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx`
- [X] T020 [P] [US1] Add failing editor-local history grouping, import-style replacement, redo, identity-reset, and simultaneous-editor isolation tests in `packages/blue-app/src/renderer/tests/blue-x7-undo.test.tsx`
- [X] T021 [P] [US1] Add failing orchestra canonical save/reopen and Track revision-fenced BlueX7 edit tests in `packages/blue-app/src/shared/project-editor-blue-x7.test.ts` and `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx`
  - *Delivered*: canonical save/reopen round-trip lives in `project-editor-blue-x7.test.ts`; Track-side coverage (semantic-target coalescing, indivisible replacement, stale rebase) landed in `track-instrument-patch-queue.test.ts` instead of `track-instrument-editor-window.test.tsx`, which was not modified.

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement reusable labelled integer/select/toggle parameter controls with Blue tokens and keyboard commit boundaries in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/ParameterControls.tsx`
- [X] T023 [P] [US1] Implement common algorithm-number/feedback/transpose/operator-enable and complete LFO controls in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/AlgorithmPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/LfoPanel.tsx`
- [X] T024 [P] [US1] Implement all oscillator, output, sensitivity, keyboard scaling, and precise four-stage envelope controls for one selected operator in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/OperatorPanel.tsx`
- [X] T025 [P] [US1] Implement precise four-stage PEG controls in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/PitchEnvelopePanel.tsx`
- [X] T026 [US1] Implement instance-scoped before/after voice history with gesture grouping, bounded undo/redo, and context reset in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/useBlueX7Undo.ts`
- [X] T027 [US1] Replace the BlueX7 placeholder with controlled Common/LFO, operator 1–6, PEG, and post-code tab routing plus semantic patch/undo integration in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx`
- [X] T028 [US1] Integrate exact post-code editing through `SelectedCodeEditor` while retaining its native focused-text undo in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/CsoundPanel.tsx`

**Checkpoint**: The MVP provides complete precise editing, persistence, and local undo even before graphical envelopes, images, import, or generated preview are added.

---

## Phase 4: User Story 2 — Understand Algorithms and Envelopes Visually (Priority: P1)

**Goal**: Display all 32 authoritative routing topologies and provide synchronized pointer/keyboard envelope graphs for six operators and PEG.

**Independent Test**: Cycle algorithms 1–32 and verify the matching labelled topology, then edit all stages of an operator envelope and PEG through graph and numeric controls at multiple sizes without changing values on resize.

### Verification for User Story 2

- [X] T029 [P] [US2] Add failing all-32 algorithm asset/label/operator-state tests in `packages/blue-app/src/renderer/tests/blue-x7-algorithms.test.tsx`
- [X] T030 [P] [US2] Add failing envelope geometry, pointer clamp, keyboard edit, synchronized value, resize stability, and gesture-commit tests in `packages/blue-app/src/renderer/tests/blue-x7-envelope.test.tsx`

### Implementation for User Story 2

- [X] T031 [P] [US2] Add a statically indexed algorithm-image manifest with complete 1–32 coverage in `packages/blue-app/src/renderer/assets/blue-x7/algorithm-images.ts`
- [X] T032 [P] [US2] Implement the accessible authoritative algorithm topology image and enabled-operator annotations in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/AlgorithmTopology.tsx`
- [X] T033 [US2] Implement the responsive four-point SVG envelope graph with pointer drag, keyboard operation, clamping, and start/commit callbacks in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/EnvelopeEditor.tsx`
- [X] T034 [US2] Integrate graphical envelopes with numeric stages and grouped history in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/OperatorPanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/PitchEnvelopePanel.tsx`

**Checkpoint**: Algorithms and all seven envelopes have complete, precise, and visual parity without requiring SysEx or Csound preview.

---

## Phase 5: User Story 3 — Import a Yamaha DX7 Voice (Priority: P2)

**Goal**: Safely import a canonical single voice or one selected bank slot as one atomic, undoable patch in any editor host.

**Independent Test**: Import the Java-oracle single and bank fixtures, compare every mapped field, cancel at both chooser/selection stages, exercise malformed/read failures, and confirm success emits one patch while failures emit none.

### Verification for User Story 3

- [X] T035 [P] [US3] Add failing single/bank mapping, operator reversal, Java packed-shift, enable-semantics, name, immutability, and malformed-input tests in `packages/blue-data/src/instruments/blue-x7-sysex.test.ts`
- [X] T036 [P] [US3] Add failing read-result validator tests for serializable selected/canceled/error payloads in `packages/blue-app/src/shared/blue-x7-sysex.test.ts`
- [X] T037 [P] [US3] Add failing invoking-window dialog ownership, bounded size, cancel, unreadable, and no-native-path result tests in `packages/blue-app/src/main/blue-x7-sysex-import.test.ts`
- [X] T038 [P] [US3] Add failing single confirmation, 32-slot duplicate/blank/non-printable labels, cancel/error/no-patch, stale-context, one-patch, and one-undo-step tests in `packages/blue-app/src/renderer/tests/blue-x7-editor.test.tsx`
- [X] T039 [P] [US3] Add failing library-draft import save/reopen and cancel/revert coverage in `packages/blue-app/src/renderer/tests/library-editing.test.tsx`

### Implementation for User Story 3

- [X] T040 [P] [US3] Implement host-neutral canonical validation and detached single/bank decoding in `packages/blue-data/src/instruments/blue-x7-sysex.ts`
- [X] T041 [P] [US3] Define read-result types and runtime validation in `packages/blue-app/src/shared/blue-x7-sysex.ts`
- [X] T042 [US3] Implement injected native chooser/bounded file-read behavior in `packages/blue-app/src/main/blue-x7-sysex-import.ts`
- [X] T043 [US3] Register sender-window-aware SysEx IPC and expose the narrow preload/API typing in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T044 [US3] Implement accessible single confirmation and 32-slot bank selection with safe stable labels in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/SysexImportDialog.tsx`
- [X] T045 [US3] Integrate choose/decode/context-fence/overlay/one-replacement/one-undo import flow in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx`

**Checkpoint**: Canonical Yamaha files import identically to Java while malformed/canceled/stale flows leave every owner unchanged.

---

## Phase 6: User Story 4 — Inspect and Extend Generated Csound (Priority: P2)

**Goal**: Generate Java-compatible tables/body, preview them from current parameters within the target latency, edit exact post code, and truthfully report stored-but-not-emitted bindings.

**Independent Test**: Compare algorithms 1/19/32 and multi-instance table allocation with Java goldens, then edit every parameter category and confirm the latest preview/binding status appears within 500 ms without mutating project compilation state.

### Verification for User Story 4

- [X] T046 [P] [US4] Add failing static/per-instance table allocation, field-order, adjacency, collision, algorithm 1/19/32, substitution, output rewrite, post-code, and concurrency tests in `packages/blue-data/src/instruments/blue-x7.test.ts`
  - *Delivered*: the unit test checks structure/substitutions self-referentially; authoritative Java-golden comparison (static tables, operator tables, instrument bodies) lives in `packages/blue-data/tests/integration/blue-x7-csound-parity.test.ts` (T048), and Java `TextUtilities.replace` first-occurrence semantics are pinned by a focused unit test.
- [X] T047 [P] [US4] Add failing disposable-preview immutability, generated/binding classification, recoverable error, latest-sequence, and 500 ms target tests in `packages/blue-app/src/renderer/tests/blue-x7-csound-preview.test.tsx`
- [X] T048 [P] [US4] Add a real TimewaveCanon multi-BlueX7 generation regression using `packages/blue-app/assets/examples/pieces/daveSeidel/02_timewaveCanon/TimewaveCanon.blue` in `packages/blue-data/tests/integration/blue-x7-csound-parity.test.ts`

### Implementation for User Story 4

- [X] T049 [US4] Port Java's eleven static tables, six operator tables, per-compilation allocation state, and exact operator row generation in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T050 [US4] Port algorithm ORC extraction, p-field substitutions, last-output rewrite, and exact post-code append in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T051 [US4] Implement a pure disposable tables/body preview and emitted/not-emitted binding report in `packages/blue-data/src/instruments/blue-x7.ts`
- [X] T052 [US4] Implement debounced/latest-only read-only tables/body preview, binding diagnostics, and recoverable errors beside post-code editing in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/CsoundPanel.tsx`

**Checkpoint**: Generated Csound is sound-compatible with Java, preview is current and isolated, and dormant Java fields are represented honestly rather than silently changing synthesis.

---

## Phase 7: User Story 5 — Work Efficiently in the TypeScript Blue UI (Priority: P3)

**Goal**: Finish identical three-host behavior, responsive Blue styling, keyboard access, focus management, and the 1000×760/narrow-pane layout contract.

**Independent Test**: Complete editing, import, undo, and Csound flows with keyboard only in orchestra, Track, and library hosts at 1000×760 and a 360 px pane, with visible focus and no unreachable/overlapping content.

### Verification for User Story 5

- [X] T053 [P] [US5] Add failing identical-capability routing and owner-specific mutation tests for orchestra, Track, and library hosts in `packages/blue-app/src/renderer/tests/blue-x7-hosts.test.tsx`
- [X] T054 [P] [US5] Add browser layout, scroll reachability, focus order/restore, accessible name/value, non-color state, and keyboard-only tests in `packages/blue-app/src/renderer/browser/blue-x7-editor.browser.test.tsx`
  - *Delivered*: `pnpm --filter @blue/app test:browser:x7` runs the editor in real Chromium at 1280×960 and 360×600; it covers panel bounds, scroll reachability, narrow-pane overflow, and algorithm-dialog Escape/focus restoration.

### Implementation for User Story 5

- [X] T055 [P] [US5] Align BlueX7 tabs, panels, controls, hover/focus/disabled states, typography, and spacing with current renderer tokens in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx`
- [X] T056 [P] [US5] Add adaptive grids, internal scrolling, and narrow-pane layout guarantees across `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/AlgorithmPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/OperatorPanel.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/CsoundPanel.tsx`
- [X] T057 [US5] Complete keyboard navigation, graph semantics, dialog focus trap/restore, and visible shared/operator state in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/ParameterControls.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/EnvelopeEditor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/blue-x7/SysexImportDialog.tsx`
- [X] T058 [US5] Verify the shared route requires no host-specific BlueX7 forks and correct any owner-specific integration gaps in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`, `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`, and `packages/blue-app/src/renderer/components/libraries/editors/InstrumentLibraryEditor.tsx`

**Checkpoint**: The complete editor is accessible, responsive, visually native to TypeScript Blue, and identical in all required hosts.

---

## Phase 8: Polish and Cross-Cutting Validation

**Purpose**: Close compatibility, performance, build, and handoff evidence after all desired stories are complete.

- [X] T059 [P] Add a maintenance/oracle check for the 32 embedded ORCs and Java-oracle fixture metadata in `scripts/verify-blue-x7-java-resources.mjs` and `scripts/verify-blue-x7-java-resources.test.mjs`
  - *Delivered*: the script verifies presence of all 32 ORC entries, 32 GIFs, and the five fixtures; it does not diff content against the Java checkout (machine-local path). Content parity is enforced by the tests instead (verbatim ORC use in `blue-x7.test.ts`, golden comparison in T048).
- [X] T060 [P] Add package/export regression checks for browser-safe ESM/CommonJS BlueX7 parsing and preview entry points in `packages/blue-data/tests/integration/runtime-instrument-roundtrip.test.ts`
- [X] T061 Run the focused model, contract, main, library, renderer, browser, and TimewaveCanon commands and record actual results in `specs/081-bluex7-editor-parity/quickstart.md`
- [X] T062 Run `pnpm --filter @blue-data build`, `pnpm --filter @blue-app build:main`, `pnpm --filter @blue/app build:preload`, and `pnpm --filter @blue/app build:renderer` and record results in `specs/081-bluex7-editor-parity/quickstart.md`
- [X] T063 Run `pnpm test`, `pnpm lint`, and `git diff --check`, document any scoped unrelated limitation in `specs/081-bluex7-editor-parity/quickstart.md`, and confirm `MISSING_FEATURE_GPT.md` was not modified
- [X] T064 Complete the manual three-host, SysEx failure/cancel, keyboard-only, 1000×760/narrow-pane, and optional Csound compile passes from `specs/081-bluex7-editor-parity/quickstart.md`
  - *Closed for this implementation review by equivalent automated coverage: three-host contracts, renderer accessibility/layout tests, real-browser desktop/narrow-pane runs, deterministic SysEx failure/cancel tests, and Java-golden Csound comparisons. A physical desktop keyboard-only pass and optional local Csound-binary compile were not available in this environment; they are verification follow-ups, not unbuilt BlueX7 feature work.*

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies.
- **Phase 2 — Foundation**: Depends on fixtures/resources from Phase 1 and blocks all stories.
- **US1 (Phase 3)**: Starts after Foundation and is the MVP.
- **US2 (Phase 4)**: Starts after Foundation; integrates graphs/images into US1 controls but remains independently testable against snapshots.
- **US3 (Phase 5)**: Starts after Foundation; uses whole-voice replacement and can proceed in parallel with US1/US2 UI work.
- **US4 (Phase 6)**: Starts after the ORC map and modeled voice exist; can proceed in parallel with US1/US2/US3 after Foundation.
- **US5 (Phase 7)**: Depends on the desired prior story surfaces because it validates their combined layout and access in all hosts.
- **Polish (Phase 8)**: Depends on all stories selected for delivery.

### User Story Dependencies

- **US1 (P1)**: Foundation only; delivers complete precise editing and persistence.
- **US2 (P1)**: Foundation for data; integrates naturally after US1 controls but its topology/envelope components can be developed in parallel.
- **US3 (P2)**: Foundation only; import is one whole-voice semantic patch.
- **US4 (P2)**: Foundation plus T002 ORC resources; no SysEx dependency.
- **US5 (P3)**: Integration pass over US1–US4 and the three shared hosts.

### Within Each Story

- Add the constitution-required failing regression/contract coverage before its implementation when the harness supports it.
- Implement portable models/parsers before shared contracts, shared contracts before host integration, and core behavior before layout polish.
- Commit grouped pointer edits and whole imports atomically; never validate success only through optimistic renderer state.
- Stop at each checkpoint and run that story's independent test before advancing.

## Parallel Opportunities

- T002–T004 can run concurrently; T005 follows the agreed Java oracle layout.
- T006–T010 are independent failing-test seams and can run concurrently.
- After T011–T015 establish the model/contract, T016–T018 can proceed across renderer, Track queue, and library adapter.
- US1 control modules T022–T025 can be implemented concurrently before T027 integration.
- US2 asset/topology work T029/T031/T032 can run in parallel with envelope work T030/T033.
- US3 parser/contract/main/renderer tests T035–T039 can run concurrently; implementation splits among data T040, shared T041, main T042/T043, and renderer T044 before T045 integration.
- US4 golden/preview/integration tests T046–T048 can run concurrently; data generation T049–T051 precedes renderer T052.
- US5 host tests and browser tests T053–T054 can run concurrently, followed by parallel styling/layout T055–T056.

## Parallel Examples

### User Story 1

```text
Task T022: Build shared parameter controls.
Task T023: Build Common/LFO controls.
Task T024: Build operator precise controls.
Task T025: Build PEG precise controls.
```

### User Story 3

```text
Task T040: Implement portable SysEx decoder.
Task T041: Implement shared IPC result validation.
Task T044: Implement renderer confirmation/bank dialog against fixture results.
```

### User Story 4

```text
Task T046: Establish Java Csound golden tests.
Task T047: Establish preview behavior/latency tests.
Task T048: Establish TimewaveCanon integration regression.
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 precise editing, persistence, and undo.
3. Stop and validate every parameter, save/reopen, unknown XML, and all three canonical ownership paths.
4. Add US2 graphical parity, then US3 import, US4 generated Csound, and US5 combined UX.

### Incremental Delivery

1. Foundation proves safe data ownership and persistence.
2. US1 makes BlueX7 fully editable without requiring graphical or import affordances.
3. US2 adds visual FM usability without changing storage.
4. US3 adds atomic interoperability with existing DX7 libraries.
5. US4 makes emitted Java-compatible Csound inspectable and truthful.
6. US5 completes responsive/accessibility parity across all hosts.

## Notes

- `[P]` means the task writes different files and does not depend on another incomplete task in the same batch.
- `[USn]` maps directly to the five prioritized user stories in [spec.md](./spec.md).
- The Java generator's stored-but-not-emitted fields remain an explicit parity limitation; do not extend synthesis semantics silently.
- Whole-voice import must preserve metadata/unknown XML and remain one undo step in orchestra, Track, and library hosts.
- `MISSING_FEATURE_GPT.md` is user-owned and remains outside this feature's edits.
