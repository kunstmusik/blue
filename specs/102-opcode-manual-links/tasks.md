# Tasks: Context-Aware Opcode Completion and Manual Links

**Input**: Design documents from `specs/102-opcode-manual-links/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Scope**: Implementation remains inside `packages/blue-app`. The Csound manual URL is app-wide program state owned by Electron main and persisted in `program-settings.json`; it must never enter `.blue` project data. The renderer sends only a validated-shape manual identifier through the typed bridge, and generated catalog help remains available independently of external navigation.

**Verification**: Every behavior and boundary change has focused automated coverage for insertion results, settings normalization/persistence/reset, URL derivation and encoding, IPC/preload contracts, host probing/opening, fallback behavior, score/UDO gating, popout ownership, cross-platform file URLs, package builds, repository tests, lint, and whitespace.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the dependency and validation surfaces used by the feature.

- [X] T001 [P] Confirm and pin the `@kunstmusik/codemirror-lang-csound` rich-catalog release that exposes manual identifiers, entry kind, and separate modern/classic syntax in `packages/blue-app/package.json` and `pnpm-lock.yaml`
- [X] T002 [P] Confirm the affected `@blue/app` test and build entry points and record the pre-change completion baseline in `packages/blue-app/package.json` and `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts`

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the pure contract and canonical settings ownership required by every story.

**Critical**: No user story implementation can begin until this phase is complete.

- [X] T003 Create the pure serializable manual navigation contract, default URL, root normalization, single-segment manual-id validation, encoded target derivation, and structured result types in `packages/blue-app/src/shared/csound-manual.ts`
- [X] T004 Extend `GeneralSettingsSnapshot`, default merging, validation, reset behavior, and the `general.csoundManualUrl` default in `packages/blue-app/src/shared/program-settings.ts`, reusing the contract from `packages/blue-app/src/shared/csound-manual.ts`
- [X] T005 Add contract tests for accepted/rejected roots, trailing separators, credentials/query/fragment rejection, safe identifier encoding, separator and dot-segment rejection, and synthetic Windows drive/UNC-shaped file URLs in `packages/blue-app/src/shared/csound-manual.test.ts`
- [X] T006 Add settings compatibility tests for legacy snapshots, invalid-save preservation, General reset, atomic persistence, unrelated-setting preservation, and absence from project serialization in `packages/blue-app/src/shared/program-settings.test.ts` and `packages/blue-app/src/main/program-settings-store.test.ts`

## Phase 3: User Story 1 - Insert a Valid Opcode Form (Priority: P1) MVP

**Goal**: Accept an opcode completion or menu item using the document context at application time, producing a conservative editable form without duplicating authored assignments, outputs, or classic syntax.

**Independent Test**: In an orchestra editor, accept representative completions after an assignment, inside a nested call, after an authored classic output, at a blank statement, for void and multiple-output opcodes, and for declaration-like entries; compare the complete resulting document text and confirm UDO and score-only behavior remains unchanged.

### Verification for User Story 1

- [X] T007 [P] [US1] Reproduce the current context-blind insertion failures as application-result tests for assignment, nested expression, classic output, blank statement, void, multiple-output, declaration, optional-argument, malformed/continued syntax, and context-changed-after-popup cases in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts`
- [X] T008 [P] [US1] Add completion-source regressions for mixed-case prefix matching, explicit invocation, score-only orchestra-opcode suppression, UDO de-duplication, source precedence, and name-only UDO insertion in `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts`

### Implementation for User Story 1

- [X] T009 Define normalized opcode metadata and resolver-facing insertion types, including opcode kind, modern/classic syntax, required inputs/outputs, manual identifier, and safe name-only fallback in `packages/blue-app/src/renderer/components/workbench/panels/editors/editor-adapter-types.ts`
- [X] T010 Implement the pure apply-time opcode insertion resolver in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-insertion.ts`, consuming current document text, caret/replacement offsets, and normalized metadata to return expression, classic statement, modern statement, or name-only insertion plans with ordered snippet tab stops
- [X] T011 Replace raw documentation-line insertion in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts` with the catalog metadata adapter and resolver-backed CodeMirror completion application while preserving UDO completion source precedence and name-only insertion
- [X] T012 Route opcode-menu and context-menu insertion through the same resolver, using the live `EditorView` state and preserving the selected range, in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-menu.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx`
- [X] T013 Make opcode prefix filtering case-insensitive without changing boost/order semantics and keep orchestra completion/menu suppression separate from unchanged UDO behavior in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`, `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-language.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.ts`

**Checkpoint**: User Story 1 is independently usable when the application-result matrix passes and existing UDO/score-only completion tests remain green.

## Phase 4: User Story 2 - Open the Matching Csound Manual Entry (Priority: P1)

**Goal**: Open a validated Csound 7 manual entry derived from the catalog manual identifier, from both completion help and the opcode-at-caret/context action, without trusting renderer-provided roots or URLs.

**Independent Test**: With the default setting, request `oscili` from completion help and from the caret/context action and verify the host receives `https://csound.com/manual/opcodes/oscili/`; verify a display-name/manual-id mismatch uses the manual identifier and an unrecognized opcode performs no external navigation.

### Verification for User Story 2

- [X] T014 [P] [US2] Add deterministic main-service tests for default-root derivation, display-name/manual-id differences, successful HTTPS responses and redirects, confirmed `404`/`410` absence, bounded preflight classification, and validated external opening in `packages/blue-app/src/main/csound-manual-service.test.ts`
- [X] T015 [P] [US2] Add application IPC registration and response-contract tests for the manual channel, including invalid payloads and structured failure results, in `packages/blue-app/src/main/ipc/application-ipc.test.ts` and `packages/blue-app/src/main/main-process-ipc-inventory.test.ts`
- [X] T016 [P] [US2] Add completion-help and opcode-at-caret/context action tests for the shared target and no-op behavior in `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.test.tsx` and `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts`

### Implementation for User Story 2

- [X] T017 Build the compact generated-help model and renderer in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts`, showing available title, summary, category, status/deprecation, modern/classic syntax, examples, manual identifier, and Open Manual action without empty headings
- [X] T018 Implement the dependency-injected main-process manual service in `packages/blue-app/src/main/csound-manual-service.ts`, reloading current settings per request, validating the root and identifier, deriving a contained target, classifying HTTPS availability, opening only validated available/indeterminate HTTPS targets, and returning non-throwing structured fallback results
- [X] T019 Register the typed manual IPC channel and handler in `packages/blue-app/src/main/ipc/application-ipc.ts` and `packages/blue-app/src/main/main.ts`, ensuring renderer-supplied complete URLs, raw host errors, and unsupported targets never cross the boundary
- [X] T020 Expose the typed manual request/result through `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T021 Wire the shared generated help and Open Manual action into completion info and the opcode-at-caret/context command in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`, `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts`, `packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx`, creating interactive nodes in the hosting document

**Checkpoint**: User Story 2 is independently usable when both entry points resolve the same default URL, invalid/unrecognized requests do not open anything, and generated help remains visible during the host request.

## Phase 5: User Story 3 - Use a Downloaded Manual (Priority: P2)

**Goal**: Let users configure a built Csound 7 manual as a normalized `file://` root, use it offline, persist it across restart, and restore the default through General Settings reset.

**Independent Test**: Save a local root containing `opcodes/oscili/index.html`, disconnect networking, open `oscili`, restart Blue, open it again, then reset General Settings and verify later requests use `https://csound.com/manual`.

### Verification for User Story 3

- [X] T022 [P] [US3] Add renderer settings tests for displaying, editing, saving, rejecting, and resetting the manual URL through the existing General Settings flow in `packages/blue-app/src/renderer/tests/settings-window.test.tsx`
- [X] T023 [P] [US3] Add local manual service tests for encoded spaces, trailing separators, readable `opcodes/<id>/index.html`, missing entries, native path conversion, root containment, and synthetic Windows file-URL forms in `packages/blue-app/src/main/csound-manual-service.test.ts`

### Implementation for User Story 3

- [X] T024 [US3] Add the Csound Manual URL field, default description, and validation-friendly input to the existing General Settings section in `packages/blue-app/src/renderer/components/settings/GeneralSettings.tsx`
- [X] T025 [US3] Thread `general.csoundManualUrl` through the existing settings draft, save, and reset flow without introducing a second store in `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx` and `packages/blue-app/src/renderer/components/settings/GeneralSettings.tsx`
- [X] T026 [US3] Extend `packages/blue-app/src/main/csound-manual-service.ts` to convert `file:` targets only at the host boundary, require a readable built-manual entry, enforce resolved-path containment, and avoid calling an OS opener for confirmed-missing local entries
- [X] T027 [US3] Verify restart persistence and current-setting reload for local manuals, including reset-to-default behavior, in `packages/blue-app/src/main/program-settings-store.test.ts` and `packages/blue-app/src/main/csound-manual-service.test.ts`

**Checkpoint**: User Story 3 is independently usable when a valid local manual works without network access, survives restart in program settings only, and reset returns to the hosted default.

## Phase 6: User Story 4 - Retain Help When the External Entry Is Unavailable (Priority: P2)

**Goal**: Keep compact catalog help usable when a local or remote manual entry is missing, unreachable, indeterminate, or refused by the operating system, while leaving editor and project state untouched.

**Independent Test**: Exercise a missing local entry, HTTPS `404`/`410`, timeout or rejected preflight, and injected open failure; confirm no known-missing target launches, generated help includes all available catalog fields, a non-blocking notice appears, and caret/selection/document remain unchanged.

### Verification for User Story 4

- [X] T028 [P] [US4] Add service regressions for confirmed missing, indeterminate probe, invalid setting/request, and open-failure outcomes, including no opener call for invalid or missing targets, in `packages/blue-app/src/main/csound-manual-service.test.ts`
- [X] T029 [P] [US4] Add renderer regressions for pending help retention, fallback help field coverage, non-blocking failure notices, no recognized-opcode navigation, and no editor transaction in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.test.tsx`

### Implementation for User Story 4

- [X] T030 [US4] Keep generated help mounted while manual navigation is pending or failed and show safe recoverable notices for missing, invalid, probe-failed, and open-failed results in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx`
- [X] T031 [US4] Disable or omit Open Manual when no catalog manual identifier is available, make unrecognized-caret requests no-ops, and preserve offline catalog summary/category/status/syntax/example fields in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts`
- [X] T032 [US4] Assert that all manual success and failure paths preserve the editor document, caret, selection, UDO completion behavior, score-only gating, and project state in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts` and `packages/blue-app/src/renderer/tests/udo-code-completions.test.ts`

**Checkpoint**: User Story 4 is independently usable when every unavailable-target path keeps complete generated help and leaves editing/project state unchanged.

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Close compatibility, documentation, cross-platform, and repository validation obligations.

- [X] T033 [P] Reconcile the deterministic manual, popout, fallback, and offline procedures with the implemented behavior in `specs/102-opcode-manual-links/quickstart.md`
- [X] T034 [P] Add compatibility assertions that manual actions do not alter `.blue` project snapshots or generated CSD output in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts` and `packages/blue-app/src/main/csd-generation.test.ts`
- [X] T035 Run the focused opcode, manual, settings, context-menu, and UDO test subset from the repository root using the scripts in `packages/blue-app/package.json`
- [X] T036 Run the complete `@blue/app` test suite and `build:main`, `build:preload`, and `build:renderer` commands defined in `packages/blue-app/package.json`
- [X] T037 Run repository-wide `pnpm test`, `pnpm lint`, and `git diff --check` from the root `package.json` workflow and repository working tree
- [X] T038 Perform the real online `oscili` check and built-local-manual check on macOS, run path-sensitive cases on supported Windows CI, and record any environment-specific result in `specs/102-opcode-manual-links/quickstart.md`

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 have no dependencies and can run in parallel.
- **Foundational (Phase 2)**: T003 and T004 follow setup; T005 depends on T003; T006 depends on T004. This phase blocks all user stories.
- **User Stories**: US1 and US2 can start in parallel after Phase 2. US3 requires the shared settings contract and the manual service/bridge from US2, but does not require all US2 UI work. US4 requires the US2 help/navigation surface and the US3 local-manual behavior.
- **Polish (Phase 7)**: T033-T038 follow the desired story checkpoints.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2. It is independent of US2, US3, and US4.
- **User Story 2 (P1)**: Starts after Phase 2 and T001. Its service depends on T003; its IPC handler depends on T018; its UI wiring depends on T017-T020.
- **User Story 3 (P2)**: Starts after T004 and T018-T020. Its renderer tests and General Settings work can proceed independently from local service implementation.
- **User Story 4 (P2)**: Starts after T017-T021 and T026. Its fallback tests can be written before the fallback UI implementation.

### Within Each User Story

- Write the focused regression or contract tests first where the harness supports reproducing the current failure.
- Complete shared metadata/models before the resolver or host service that consumes them.
- Complete the pure resolver before autocomplete/menu integration.
- Complete host service validation before IPC registration and renderer actions.
- Complete core behavior before popout and end-to-end integration checks.
- Do not alter UDO completion precedence, project persistence, `.blue` XML, CSD generation, or score-only behavior as an incidental part of this feature.

## Parallel Opportunities

- T001 and T002 can run in parallel during setup.
- After Phase 2, US1 and US2 can be assigned to separate workers because US1 is renderer insertion and US2 is manual navigation.
- T007 and T008 can be authored in parallel because they cover separate renderer test files.
- T014, T015, and T016 can be authored in parallel because they cover main service, IPC inventory, and renderer behavior respectively.
- T022 and T023 can be authored in parallel because they cover settings UI and local host probing.
- T028 and T029 can be authored in parallel because they cover main failure classification and renderer fallback behavior.

## Parallel Example: User Story 1

```text
Task T007: Reproduce the insertion-result matrix in packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts
Task T008: Add filtering, score gating, and UDO regressions in packages/blue-app/src/renderer/tests/udo-code-completions.test.ts

After those tests are in place:
Task T009: Define resolver metadata in packages/blue-app/src/renderer/components/workbench/panels/editors/editor-adapter-types.ts
Task T010: Implement the pure resolver in packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-insertion.ts
```

## Parallel Example: User Story 2

```text
Task T014: Add host service tests in packages/blue-app/src/main/csound-manual-service.test.ts
Task T015: Add IPC contract tests in packages/blue-app/src/main/ipc/application-ipc.test.ts and packages/blue-app/src/main/main-process-ipc-inventory.test.ts
Task T016: Add renderer action tests in packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.test.tsx
```

## Parallel Example: User Story 3

```text
Task T022: Add General Settings tests in packages/blue-app/src/renderer/tests/settings-window.test.tsx
Task T023: Add local file URL service tests in packages/blue-app/src/main/csound-manual-service.test.ts
```

## Parallel Example: User Story 4

```text
Task T028: Add missing, indeterminate, and open-failure service tests in packages/blue-app/src/main/csound-manual-service.test.ts
Task T029: Add help-retention and editor-state tests in packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3, User Story 1.
3. Stop and validate the complete application-result matrix, mixed-case filtering, score gating, and unchanged UDO behavior.
4. Deliver the context-aware insertion increment before external manual navigation if staged delivery is required.

### Incremental Delivery

1. Complete setup and foundational contracts/settings.
2. Deliver US1 as the insertion MVP.
3. Deliver US2 with default online manual navigation and compact generated help.
4. Deliver US3 with persisted local `file://` manuals and General reset.
5. Deliver US4 with explicit fallback/help retention and failure notices.
6. Complete polish, cross-platform checks, and repository-wide validation.

## Completion Report

- **Total tasks**: 38
- **Setup tasks**: 2
- **Foundational tasks**: 4
- **US1 tasks**: 7
- **US2 tasks**: 8
- **US3 tasks**: 6
- **US4 tasks**: 5
- **Polish tasks**: 6
- **Parallel opportunities**: T001-T002; T007-T008; T014-T016; T022-T023; T028-T029; US1 and US2 after Phase 2.
- **Independent test criteria**: Each user story has an independent-test section and a focused verification task set covering its acceptance scenarios.
- **Suggested MVP scope**: Phase 1, Phase 2, and User Story 1 only.
- **Format validation**: All 38 task lines use the required `- [ ] T###` checklist prefix, include `[P]` only on parallelizable work, include `[US#]` only in user-story phases, and name concrete repository file paths.


## Phase 8: Convergence

- [X] T039 CRITICAL: Guarantee non-throwing manual request validation and safe structured host failures in `packages/blue-app/src/shared/csound-manual.ts` and `packages/blue-app/src/main/csound-manual-service.ts`; reject lone-surrogate identifiers before `encodeURIComponent`, replace raw settings/filesystem/opener errors with safe messages, and add service/IPC regressions proving malformed payloads return fallback results without launching targets per Constitution III, plan: validated serializable failure contracts, T018, and T019 (partial)
- [X] T040 CRITICAL: Replace hard-coded macOS local-manual fixtures with native `path`/`os`/file-URL builders in `packages/blue-app/src/main/csound-manual-service.test.ts`, retain meaningful synthetic Windows drive/UNC cases, run the path-sensitive coverage on supported Windows CI, and record actual Windows results plus the built-local-manual offline/restart check on macOS in `specs/102-opcode-manual-links/quickstart.md`; the current record establishes only macOS tests and synthetic Windows checks per Constitution: Host-Path Portability and Boundary Forms, T023, and T038 (partial)
- [X] T041 Make signature parsing conservative in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-insertion.ts`: match opcode tokens rather than substrings in variables, reject ambiguous/malformed syntax and unsupported signature hints, preserve required output/input arity, and return name-only when no safe signature exists; add complete-document regressions for catalog `init` (currently five invented outputs), `xin` (currently matched inside `xinarg1`), absent metadata, and malformed/continued signature rows in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts` per FR-003, FR-004, US1/AC5, and T007 (partial)
- [X] T042 Present catalog-generated help from the actual caret/context Open Manual action in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts` and `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx`, retaining it while pending and after missing/rejected/open-failed outcomes; add integration tests that invoke the action without pre-mounting help and assert offline fields plus unchanged document/caret/selection per FR-014, FR-015, US4/AC1, US4/AC2, US4/AC3, and T030 (missing)
- [X] T043 Resolve the hosting document at the real completion-help entry point in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-java-blue-completions.ts` and thread it through the editor integration and `csound-opcode-help.ts`; cover completion and caret fallback help with two-document tests for host placement, interaction, dismissal, and retained editor state instead of relying on the global-document default per FR-018, plan: hosting-document interactive help, and T021 (partial)
- [X] T044 Reject nonconforming or malformed manual roots before normalization/save in `packages/blue-app/src/shared/csound-manual.ts`, including `file:relative/manual`, `https:example.com/manual`, and invalid percent escapes; add shared-contract and settings-store regressions proving failed saves preserve the last valid root while valid encoded spaces and platform file URLs remain supported per FR-010 and SC-005 (contradicts)
- [X] T045 Classify local manual probe failures by filesystem error code in `packages/blue-app/src/main/csound-manual-service.ts`: reserve confirmed missing for absence outcomes and return indeterminate/probe-failed fallback for permission or I/O errors; add injected ENOENT, EACCES/EPERM, and EIO regressions in `packages/blue-app/src/main/csound-manual-service.test.ts` that verify safe notices and no opener call on failed validation per FR-013, FR-014, and T028 (contradicts)


## Phase 9: Convergence

- [ ] T046 CRITICAL: Complete the outstanding native Windows validation from T040: strengthen drive/UNC assertions in `packages/blue-app/src/main/csound-manual-service.test.ts` to compare the full native paths passed to access/openPath (the current assertions only require the substring `oscili`), run the path-sensitive suite on supported Windows CI, and record the actual command, runner, result, and identifiable run reference in `specs/102-opcode-manual-links/quickstart.md`; distinguish macOS/synthetic evidence from native Windows execution per Constitution: Host-Path Portability and Boundary Forms, plan: cross-platform validation, and T040 (partial)
- [X] T047 Correct array-bearing signature handling in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-insertion.ts`: do not treat the first `[]` array marker as the start of optional arguments or discard required arguments after it; preserve necessary output array syntax when generating a safe form, otherwise use name-only fallback. Add complete-document regressions for shipped `cmplxprod` (currently drops `kin2`), `copya2ftab` (currently drops `ktab`), and array outputs in `packages/blue-app/src/renderer/tests/csound-editor-parity.test.ts` per FR-003, FR-004, US1/AC4, and T041 (partial)
- [X] T048 Integrate caret help in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-help.ts` and the owning editor component with the existing host popup infrastructure required by `docs/popout-popup-conventions.md`; replace fixed-offset unmanaged body mounting with host viewport positioning and bounded scrolling, dispose listeners when replacing help, and close/dispose help on editor unmount or host relocation. Add two-document regressions for repeated opening, close, unmount, relocation, and a short viewport without changing editor content/selection per FR-018, plan: reuse existing help and host-window popup infrastructure, T042, and T043 (partial)
- [X] T049 Apply manual-root scheme/prefix checks case-insensitively in `packages/blue-app/src/shared/csound-manual.ts` so `FILE:relative/manual` and `HTTPS:example.com/manual` cannot bypass the absolute URL requirement; preserve valid uppercase schemes with proper delimiters and add contract/settings-save regressions proving rejection preserves the last valid saved root per FR-010, SC-005, and T044 (contradicts)
- [X] T050 Preserve all shipped catalog syntax information for generated help independently of insertion safety filtering in `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-opcode-insertion.ts`, `editor-adapter-types.ts`, and `csound-opcode-help.ts`; the `chnget` entry currently loses ten of eighteen syntax rows, including `chngetks` and array variants. Add offline help regressions against actual catalog entries, retaining related forms and continuation text while still selecting only safe matching signatures for insertion per FR-007, FR-015, and US4/AC3 (partial)
- [X] T051 Replace the remaining raw `error.message` returned by the `fileURLToPath` conversion catch in `packages/blue-app/src/main/csound-manual-service.ts` with a safe application-owned invalid-setting message; cover platform-invalid file URLs such as UNC on POSIX and encoded separators through the service boundary, asserting structured fallback, no opener call, and no raw host diagnostic per plan: safe structured host failures, T019, and T039 (partial)
