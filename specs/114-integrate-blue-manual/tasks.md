# Tasks: Integrate the Blue 3 manual

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [manual-navigation.md](contracts/manual-navigation.md)

**Verification**: Run the focused menu and repair tests, Quarto render and link check, package input and installed resource checks, main build, repository tests, lint, and whitespace check. Application repairs affect generation and existing project-history actions while preserving the XML schema.

**Completion (2026-09-30)**: 134 of 137 tasks are complete. T122/T123/T132 remain
unchecked and explicitly deferred by the user. Final speckit-converge found no
new implementation gaps for the accepted scope and appended no tasks. The
review's P2 issue is repaired under T137. Repository tests/lint, main build and
the 35-chapter/2,461-reference/eight-image scan pass; package evidence and
accepted limitations remain in `quickstart.md` and `manual-issues.md`.

## Phase 1: Setup

- [x] T001 Establish the Blue 2 comparison baseline at upstream blue-manual commit 7a92066 and record its provenance in docs/manual/README.md. The original source is maintained upstream.
- [x] T002 Add GNU FDL attribution and license text in docs/manual/README.md and docs/manual/COPYING.GFDL; ignore generated docs/manual/_build and worktrees in .gitignore.

## Phase 2: Foundational

- [x] T003 Configure docs/manual/_quarto.yml to render only the reviewed Blue 3 chapters, including only current assets.
- [x] T004 Record documentation ownership, offline navigation, package path, and absence of project-history impact in specs/114-integrate-blue-manual/research.md, data-model.md, and contracts/manual-navigation.md.

## Phase 3: User Story 1 - Accurate Blue 3 guidance (P1)

**Goal**: Give users a small current book without presenting Java instructions as Blue 3 guidance.

**Independent Test**: Render and navigate the current book while offline.

- [x] T005 [US1] Write current installation and first-project instructions in docs/manual/installation.qmd and docs/manual/first-project.qmd using Blue 3 release formats and menu labels.
- [x] T006 [US1] Write reviewed settings, score, and mixer introductions in docs/manual/settings.qmd, docs/manual/score.qmd, and docs/manual/mixer.qmd.
- [x] T007 [US1] Render docs/manual/_quarto.yml and verify all current local links and assets resolve under docs/manual/_build/html without legacy chapters in navigation.

## Phase 4: User Story 2 - Open matching manual offline (P2)

**Goal**: Open the installed manual from Blue on all supported desktop platforms.

**Independent Test**: Use Blue Manual in a packaged app while offline.

- [x] T008 [US2] Extend packages/blue-app/src/main/application-menu.test.ts to guard the Blue Manual callback on macOS and Windows/Linux.
- [x] T009 [US2] Wire the native command in packages/blue-app/src/main/application-menu.ts and packages/blue-app/src/main/main.ts using native paths and a clear missing-manual failure.
- [x] T010 [US2] Render the manual in packages/blue-app/package.json package scripts and include docs/manual/_build/html in packages/blue-app/electron-builder.yml.
- [x] T011 [US2] Install pinned Quarto in .github/actions/setup-blue-build/action.yml and check manual presence in scripts/verify-package-inputs.mjs and packages/blue-app/scripts/verify-packaged-app.mjs.
- [x] T012 [US2] Build a directory package and run the packaged-app smoke check to verify the manual exists at resources/assets/manual/index.html on the local host.

## Phase 5: User Story 3 - Maintain one source (P3)

**Goal**: Contributors can edit and render the versioned manual without committing output.

**Independent Test**: Change a chapter in docs/manual and render the book locally.

- [x] T013 [US3] Document the build command, upstream source boundary, license, and online publication decision in docs/manual/README.md.
- [x] T014 [US3] Verify a fresh Quarto render produces only current pages and generated output remains ignored by Git via docs/manual/_quarto.yml and .gitignore.

## Phase 6: Polish and validation

- [x] T015 Run the menu test and pnpm --filter @blue/app build:main after workspace dependency builds; record evidence in specs/114-integrate-blue-manual/quickstart.md.
- [x] T016 Run pnpm test, pnpm lint, and git diff --check; address failures caused by this feature and record any unrelated gate limitations in specs/114-integrate-blue-manual/quickstart.md.

## Dependencies

T001–T004 establish the source and contracts. T005–T007 complete the content baseline. T008–T012 then deliver the installed entry point. T013–T014 are contributor-facing documentation. T015–T016 validate the integrated result.

## Parallel opportunities

T005 and T006 affect different current chapters after T003. T008 can be prepared alongside the packaging tasks T010–T011, then T009 connects them. No subagent delegation is required for this worktree.

## Implementation strategy

Complete the P1 book first, then the offline menu and package path, then contributor documentation and full validation. The old online manual remains available until Blue 3 online hosting is intentionally configured.

## Phase 7: Convergence

- [x] T017 Include docs/manual/COPYING.GFDL and original-manual attribution in the rendered and installed HTML book, then verify the packaged copy per FR-001 and research: licensing decision (partial).

## Phase 8: User Story 4 - Complete Blue 3 workflow (P1)

**Goal**: Turn the seed book into a navigable manual with one complete project
workflow and reviewed explanations of its main concepts and editors.

**Independent Test**: Follow First project with Csound 7, then navigate the
rendered book offline without reaching an unreviewed legacy page.

- [x] T018 [US4] Check legacy First project, Score, SoundObjects, Orchestra, and Rendering material against the current Blue 3 controls and record migration decisions in specs/114-integrate-blue-manual/research.md (FR-009).
- [x] T019 [US4] Group reviewed pages under nonempty Getting started, Working in Blue, Concepts, and Reference parts in docs/manual/_quarto.yml; omit How-to guides and legacy chapters (FR-007).
- [x] T020 [US4] Expand docs/manual/first-project.qmd into a reproducible new-project, instrument, score event, CSD, save, and render tutorial (FR-008, SC-005).
- [x] T021 [US4] Expand docs/manual/score.qmd and add docs/manual/soundobjects.qmd using current timeline and SoundObject behavior (FR-008, FR-009).
- [x] T022 [US4] Add docs/manual/orchestra.qmd and docs/manual/rendering.qmd using current instrument editor and render commands (FR-008, FR-009).
- [x] T023 [US4] Update docs/manual/index.qmd and cross-links among current chapters; keep settings and mixer details in their existing pages (FR-007, FR-008).

## Phase 9: First migration batch validation

- [x] T024 Render docs/manual and verify exactly nine current HTML pages, all local links and assets, and no legacy pages or empty section in navigation (SC-003, SC-006).
- [x] T025 Verify the tutorial's Csound example and a local package's installed manual, then record the evidence and any host limits in specs/114-integrate-blue-manual/quickstart.md (SC-004, SC-005).
- [x] T026 Run formatting and git diff --check; review the feature against the constitution and update tasks if convergence finds a gap (FR-009).

## First migration batch dependencies

T018 informs the new text. T019 establishes navigation before T020–T023.
T024–T026 validate the complete book. T021 and T022 touch different chapters
after T018. No application or project-model code changes are planned.

## Phase 10: User Story 5 - Compose and transform score material (P1)

**Goal**: Give composers current, usable explanations of timing, score-object
editing, nested arrangement, and note processing.

**Independent Test**: Follow each new page in Blue 3, inspect representative
generated score output, and navigate the rendered book offline.

- [x] T027 [US5] Compare the six upstream topics with current Blue 3 controls and data-model behavior; record supported, renamed, or deferred details in specs/114-integrate-blue-manual/research.md (FR-009, FR-010–FR-012).
- [x] T028 [US5] Add docs/manual/time.qmd for ruler formats, stored positions and durations, snap, tempo, meter, and explicit conversion controls (FR-010, US5/AC1).
- [x] T029 [US5] Add docs/manual/generic-score.qmd for relative Csound events, instrument IDs, time behavior, and generated-score inspection (FR-011, US5/AC2).
- [x] T030 [US5] Add docs/manual/piano-roll.qmd for note creation, templates, pitch modes, fields, scale, and generated score (FR-011, US5/AC2).
- [x] T031 [US5] Add docs/manual/pattern-object.qmd for beat/subdivision setup, pattern score text, trigger grid, mute, and time behavior (FR-011, US5/AC2).
- [x] T032 [US5] Add docs/manual/polyobjects.qmd for nested Score navigation, grouping, relative time, and parent behavior (FR-011, US5/AC3).
- [x] T033 [US5] Add docs/manual/note-processors.qmd for scope, chain order, examples, and deferred/unsupported processor handling (FR-012, US5/AC3).
- [x] T034 [US5] Add the six pages to docs/manual/_quarto.yml, then update docs/manual/index.qmd, score.qmd, and soundobjects.qmd with routes and cross-links (SC-007, SC-008).

## Phase 11: Second migration batch validation

- [x] T035 Render docs/manual and verify fifteen current HTML pages, local links/assets/anchors, populated navigation, and no legacy output (SC-007, SC-008).
- [x] T036 Check representative score generation with focused model tests or a CSD example, build a local directory package, inspect the installed book, and record host limits in specs/114-integrate-blue-manual/quickstart.md (US5/AC2–AC4, SC-008).
- [x] T037 Run formatting and git diff --check, then review the batch against the constitution and Spec Kit artifacts; append convergence work only if a gap remains (FR-009).

## Second migration batch dependencies

T027 informs the text. T028–T033 can be written independently after that
review. T034 connects the pages, and T035–T037 validate the resulting book.
The upstream source, app behavior, project XML, and project history stay unchanged.

## Phase 12: SoundObjects navigation refinement

- [x] T038 [US5] Group the SoundObjects overview and reviewed object-type pages in one Quarto book part while keeping separate pages and stable URLs (FR-007, FR-011).
- [x] T039 Render the book and verify the SoundObjects navigation group and local links; update the manual navigation contract and contributor guidance (SC-003, SC-008).

## Phase 13: User Story 6 - Reuse SoundObjects and place recorded audio (P1)

**Goal**: Give composers current project-library, Instance, and AudioFile
workflows in the SoundObjects part.

**Independent Test**: Follow the three chapters in Blue 3, compare the named
controls with source, inspect generated score behavior, and browse offline.

- [x] T040 [US6] Compare archived library, Instance, and AudioFile chapters with current Blue 3 panels, transfers, and score generation; record migration decisions in specs/114-integrate-blue-manual/research.md (FR-009, FR-013–FR-015).
- [x] T041 [US6] Add docs/manual/soundobject-library.qmd for project and user library workflows, shared and independent placement, and deletion limits (FR-013, US6/AC1–AC2).
- [x] T042 [US6] Add docs/manual/instance.qmd for source sharing, editing, placement, Note Processors, and current timing limitations (FR-014, US6/AC1–AC2).
- [x] T043 [US6] Add docs/manual/audio-file.qmd for file selection, metadata, generated playback, post code, and comparison with audio-layer clips (FR-015, US6/AC3).
- [x] T044 [US6] Add the three pages to docs/manual/_quarto.yml and connect docs/manual/index.qmd, score.qmd, and soundobjects.qmd with local links (SC-009, SC-010).

## Phase 14: Third migration batch validation

- [x] T045 Render docs/manual and verify eighteen current HTML pages, SoundObjects navigation, local links/assets/anchors, and no legacy output (SC-010).
- [x] T046 Run focused library, Instance, and AudioFile behavior checks, build a directory package, inspect the installed book, and record results in specs/114-integrate-blue-manual/quickstart.md (US6/AC1–AC4).
- [x] T047 Run formatting and git diff --check, then review this batch against the constitution and Spec Kit artifacts; append convergence tasks only if a gap remains (FR-009).

## Third migration batch dependencies

T040 informs the three new pages. T041–T043 are independent after that review.
T044 connects the pages, and T045–T047 validate the resulting book. The
upstream source, application, and project model stay unchanged.

## Phase 15: Full legacy draft import

- [x] T048 [US7] Inventory all legacy source pages and map existing reviewed Blue 3 chapters to their source topics.
- [x] T049 [US7] Move SoundObject Library navigation to Working in Blue without changing its chapter URL.
- [x] T050 [US7] Copy remaining legacy chapters into the manual as visibly labeled drafts; retain upstream provenance.
- [x] T051 [US7] Add drafts to book navigation and convert local chapter and image links for offline output.
- [x] T052 [US7] Create `manual-issues.md` with cross-cutting and per-page review work.

## Phase 16: Full book validation

- [x] T053 Render the complete book and verify source accounting, navigation, local links, anchors, and assets.
- [x] T054 Build a directory package and check representative draft pages and assets offline.
- [x] T055 Run formatting and `git diff --check`, record evidence in quickstart, and converge spec, plan, and tasks.

## Phase 17: Score and Mixer coverage

- [x] T056 [US8] Compare the archived Score Timeline and Mixer chapters with current Blue 3 controls and generation behavior; record supported and deferred details in research.md (FR-020).
- [x] T057 [US8] Expand `docs/manual/score.qmd` for layer management, timeline rows, navigation, and track-header Mute/Solo modes (US8/AC1–AC2).
- [x] T058 [US8] Expand `docs/manual/mixer.qmd` for channels, routing, effects, sends, and project settings (US8/AC2–AC3).
- [x] T059 [US8] Update Score and Mixer entries in `manual-issues.md` with completed and remaining review work (US8/AC4).
- [x] T060 Render the full book, check local links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge this batch (SC-014).

## Phase 18: Settings and PianoRoll coverage

- [x] T061 [US9] Compare the Blue 2 Program Options and PianoRoll chapters with current Blue 3 Settings panels, PianoRoll editor, and score-data behavior; record supported and deferred details in research.md (FR-021).
- [x] T062 [US9] Expand `docs/manual/settings.qmd` for current project defaults, engine/device controls, disk output, MIDI input, OSC, and save actions (US9/AC1–AC2).
- [x] T063 [US9] Expand `docs/manual/piano-roll.qmd` for templates, note and field editing, time controls, pitch, and editor shortcuts (US9/AC3).
- [x] T064 [US9] Update both chapter entries in `manual-issues.md` with completed and remaining review work (US9/AC4).
- [x] T065 Render the full book, check local links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge this batch (SC-015).

## Phase 19: Rendering coverage

- [x] T066 [US10] Compare the Blue 2 Rendering and Project Properties material with current menus, Score ruler, CSD generation, render service, and output UI; record findings in research.md (FR-022).
- [x] T067 [US10] Expand `docs/manual/rendering.qmd` for current CSD profiles, selection, project options, disk destination, progress, and Play/Open outcomes (US10/AC1–AC3).
- [x] T068 [US10] Correct the `docs/manual/settings.qmd` external-play description and update `manual-issues.md` with completed and remaining work (US10/AC4).
- [x] T069 Render the full book, scan local links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge the batch (SC-016).

## Phase 20: Orchestra coverage

- [x] T070 [US11] Compare Blue 2 Orchestra Manager and Instruments text with the current Arrangement, instrument editors, Libraries panel, and transfer controls; record findings in research.md (FR-023).
- [x] T071 [US11] Expand `docs/manual/orchestra.qmd` with current organization, editing, library reuse, and score connection (US11/AC1–AC2).
- [x] T072 [US11] Update `manual-issues.md` with verified coverage and remaining migration, runtime, and packaged-app checks (US11/AC3).
- [x] T073 Render the complete book, scan links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge the batch (SC-017).

## Phase 21: Time coverage

- [x] T074 [US12] Compare Blue 2 Time System guidance with current Score Object Properties, AudioClip editor, Score toolbar, time-unit logic, and time-state patch behavior; record findings in research.md (FR-024).
- [x] T075 [US12] Expand `docs/manual/time.qmd` with valid entry examples, position/duration distinction, ruler and snap controls, and conversion choices (US12/AC1–AC2).
- [x] T076 [US12] Update `manual-issues.md` during review with verified coverage and remaining marker-only, SMPTE, and legacy Quick Time gaps (US12/AC3).
- [x] T077 Render the complete book, scan links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge the batch (SC-018).

## Phase 22: SoundObjects overview coverage

- [x] T078 [US13] Compare the two Blue 2 SoundObjects introductions with current Score canvas, properties form, time behavior, and render-start processing; record findings in research.md (FR-025).
- [x] T079 [US13] Expand `docs/manual/soundobjects.qmd` with placement, selection, editor distinction, shared properties, generated timing, and selected-range guidance (US13/AC1–AC3).
- [x] T080 [US13] Update `manual-issues.md` during review with verified coverage and remaining type-specific and image checks (FR-025).
- [x] T081 Render the complete book, scan links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge the batch (SC-019).

## Phase 23: PolyObjects coverage and objective duration

- [x] T082 [US14] Compare both Blue 2 PolyObject chapters with Blue 3 navigation, conversion, generation, ruler and snap state, and Java objective duration; record findings in research.md (FR-026).
- [x] T083 [US14] Expand `docs/manual/polyobjects.qmd` with verified grouping, relative timing, repeat, processor order, and corrected current controls (US14/AC1–AC3).
- [x] T084 [US14] Update `manual-issues.md` during review with the objective-duration bug and other remaining gaps (FR-026).
- [x] T085 [US14] Fix PolyObject objective-duration calculation in the existing project-document patch path and add a failing-then-passing ProjectHistory regression for commit, undo, redo, identity, and dirty state (US14/AC3).
- [x] T086 Run affected tests, main build, full book render and link scan, formatting and `git diff --check`; record evidence in quickstart and converge (SC-020).

## Phase 24: Score phrases and processor coverage

- [x] T087 [US15] Compare Blue 2 GenericScore, NoteProcessors, and PatternObject material with Blue 3 parsing, generation, chain scope and editor, and grid behavior; record findings in research.md (FR-027).
- [x] T088 [US15] Expand `docs/manual/generic-score.qmd`, `docs/manual/note-processors.qmd`, and `docs/manual/pattern-object.qmd` with verified current behavior (US15/AC1–AC3).
- [x] T089 [US15] Update `manual-issues.md` with completed review and remaining processor-reference, parser, and grid-resizing work (FR-027).
- [x] T090 Render the complete book, scan local links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge (SC-021).

## Phase 25: Linked phrases and AudioFile coverage

- [x] T091 [US16] Compare Blue 2 Instance and AudioFile entries with current library and file editor controls and generation paths; record findings in research.md (FR-028).
- [x] T092 [US16] Expand `docs/manual/instance.qmd` and `docs/manual/audio-file.qmd` with verified source/placement processing and file-playback details (US16/AC1–AC2).
- [x] T093 [US16] Update `manual-issues.md` with remaining runtime, timing, conversion, and packaged-app checks (US16/AC3).
- [x] T094 Render the complete book, scan local links and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge (SC-022).

## Phase 26: Project-wide Csound editors

- [x] T095 [US17] Compare the Blue 2 Globals Manager, Tables Manager, and UDO Manager chapters with Blue 3 workbench panels and CSD generation; record findings in research.md (FR-029).
- [x] T096 [US17] Replace three draft routes with reviewed `globals.qmd`, `tables.qmd`, and `udos.qmd` pages and update book navigation and related links (US17/AC1–AC3).
- [x] T097 [US17] Update `manual-issues.md` source accounting and record verified coverage and remaining checks (FR-029).
- [x] T098 Clean-render all 90 pages, scan local links, anchors, and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge (SC-023).

## Phase 27: Complete archived-topic review

- [x] T099 [US18] Compare the remaining archived draft topics with Blue 3 controls, models, and generation paths; record grouping and historical limitations in research.md (FR-030).
- [x] T100 [US18] Create current chapters for the remaining editor, task, concept, SoundObject, instrument, processor, tool, reference, and developer topics (US18/AC1–AC2).
- [x] T101 [US18] Map all 94 upstream sources to current chapters and record chapter-specific gaps in `manual-issues.md` (SC-011/SC-013).
- [x] T102 [US18] Remove duplicate draft copies and routes while preserving the upstream source reference (US18/AC3).
- [x] T103 Clean-render the 35-page book, scan local links, anchors, and assets, run formatting and `git diff --check`, record evidence in quickstart, and converge (SC-024).

## Phase 28: Repair manual-verified behavior

- [x] T104 [US19] Reproduce M13's stale Track revision at the renderer command boundary after instrument-edit settlement; retain ProjectHistory's Track add commit→undo→redo and identity fixture (FR-031).
- [x] T105 [US19] Repair M13 patch settlement so both edits persist in the packaged first-project sequence (FR-031, SC-025).
- [x] T106 [US19] Complete M03, M04, M07, and M14 ruler marker conversion, selected SMPTE frame rate, End Time display, and tempo-map-aware clock fields; cover the affected time contract with focused regressions (FR-032).
- [x] T107 [US19] Repair M05 and M06 PatternObject grid resizing and PianoRoll note-template copy/paste through the existing project-history path (FR-032).
- [x] T108 [US19] Compare Java Instance timing and implement M08 placement duration and Time Behavior for supported sources, with generated-score and history evidence (FR-032).
- [x] T109 [US19] Complete the Blue Live global Repeat control M01: restore the interval field and toggle, schedule enabled-cell triggers at the tempo-derived interval, synchronize edits through runtime reconciliation, stop on session shutdown, and update the chapter and issue ledger (FR-033).
- [x] T110 [US19] Implement or retire the visible JavaScript Instrument generation path M02, preserving legacy project text (FR-033).
- [x] T111 [US19] Resolve M09 inapplicable AudioFile Note Processor controls and M10 unused Render and Play settings in their owning UI and settings registry (FR-033).
- [x] T112 [US19] Verify Project SoundObjects deletion undo/redo and correct the M12 confirmation and manual promise (FR-032).
- [x] T113 [US19] Update every repaired manual chapter and `manual-issues.md` with desired behavior, remaining limitations, and validation evidence (FR-035, SC-026).
- [x] T114 [US19] Run affected package tests, main build, full manual render and link scan, packaged first-project walkthrough, formatting and whitespace checks; record results in quickstart (SC-025, SC-026).

## Phase 29: Converge remaining manual-verified behavior gaps

- [x] T115 [US19] Verify packaged selected-range playback for direct AudioFile and FrozenSoundObject placements after the tempo-map-aware object-relative offset conversion; record the result in the SoundObjects and AudioFile chapters and M16 ledger row. The user confirmed direct AudioFile playback with a tempo change and accepted the captured frozen render after automated packaged freeze, matching selected-range renders, and frozen realtime playback startup (FR-025, FR-035).
- [x] T116 [US15] Surface a parser error for too-short GenericScore `i` events, matching Java Blue's `NoteParseException`; cover malformed input and supported shorthand in focused tests, then update the GenericScore chapter and M17 ledger row (FR-027, FR-035). A packaged macOS run showed the line-3 error in the Generate CSD toast; corrected and shorthand input generated the expected CSD events.
- [x] T117 [US19] Relabel the 29.97 fps ruler option as non-drop to match its arithmetic formatter; add minute-boundary parse/format regression coverage and update the Time chapter and M18 ledger row (FR-024, FR-035). Packaged-app entry remains a ledger follow-up.

## Phase 30: Convergence

- [x] T118 Repair finite-range note filtering for nested PolyObjects so events inside the outer render range survive child-range rebasing; add synchronous and asynchronous regressions, document the parity correction, and update the PolyObjects chapter and issue ledger (FR-025, FR-026, FR-035). Independent review confirmed local-coordinate filtering and the inclusive boundary behavior.

## Phase 31: M16 compound-source selected-range origin

- [x] T119 Reproduce the M16 seek loss for an Instance linked to a compound PolyObject in synchronous and asynchronous generation; record the observed source-range and normalization ordering in `manual-issues.md`.
- [x] T120 Preserve file-seek provenance through PythonProcessor reordering/copying with opaque runtime identity, and keep M16 finalization limited to cases with a known source origin. Unsupported sources remain on the existing generation path; packaged playback is tracked by T115 (FR-025, FR-035).

## Phase 32: Packaged manual validation

- [x] T121 Walk the remaining non-device manual procedures in a macOS packaged app, covering the open UI and project workflows in `manual-issues.md`; correct claims and record each result there. Playwright drives packaged renderer controls and preload APIs with isolated user data. The ledger now includes Help placement, time entry and conversion, PatternObject resizing, PolyObject duration, nested selected-range generation, multi-group conversion with Undo/Redo, Instance independent/shared copying and source editing, named instrument IDs and library transfers, AudioFile WAV/AIFF source behavior, JavaScript/Python Instrument CSD, command blocks, Disk Complete Override, normal Advanced Settings, a custom Render and Open command, Track audio media copy, Library-browse quit behavior, Code Repository XML round-trip, Effects Library editing/import/mixer placement and randomization with Undo/Redo, SoundFont metadata, FTable and custom/default-path CsoundRC tools, CSD/MIDI import, and UDO CSD import/style conversion, library copy/paste and drag-transfer contracts with Undo/Redo, generated-code ordering, and embedded opcode collision rewriting. Additional packaged checks cover all documented Note Processors and errors, seven historical generator projects, Global Score tokens/tempo maps, Blue Live sets/triggers/Repeat/Live Code, realtime override and evaluation, freeze recovery/tails/Undo/Redo, automation gestures/assignment, BlueX7 SysEx, BSB UDO portability, and native Finder reveal of a rendered path with spaces. The user confirmed audible Blue Live Repeat cadence, immediate tempo/interval changes, and both stop actions on 2026-09-30. M28 repairs live compile terminal-state publication. Further checks cover AudioFile media-folder selection and persistence, Virtual Keyboard Orchestra focus/channel routing, PianoRoll note/field gestures and local shortcuts, and Clojure dependency editing with actual generation and Undo/Redo. M29 repairs stale Java-helper dependency caching. Further checks cover focused Track keyboard routing, actual macOS module/device discovery and buffer options, unavailable Java, and unknown-instrument save/generation/history behavior. M30 repairs unknown-instrument XML loss and silent generation omission. M31 excludes generated Quarto output from lint to prevent rebuild races. Packaged renderer Cmd+T/Cmd+Shift+T triggered Live cells and Cmd+Enter evaluated selected Live Code; final root tests and lint passed. M32 repairs the false instrument draft-conflict dialog after Backspace followed by typing, with failing-then-passing acknowledgement regressions and packaged save/Undo/Redo proof. After the user enabled Accessibility on 2026-09-30, System Events verified the documented native macOS shortcuts, including file/CSD/render actions, Undo/Redo, marker/loop commands, Audition, and Close. The Tracker package check passed all 14 local help bindings, keyboard-note entry/advance and octave changes, native Cmd tie/cut/copy/paste, project Undo/Redo/Save, and saved XML reload. M33 repairs Escape committing cancelled cell text on blur, with a failing-then-passing regression and packaged cancellation proof. Fresh-clone macOS developer setup passed locked dependency installation with empty caches, pinned vcpkg bootstrap, full build/tests/lint, manual generation, unsigned packaging/verification, and source-app open/CSD/save. M34 excludes generated native/vcpkg trees from ESLint after a reproduced fresh-clone lint failure. Host prerequisite installation was not exercised. The desktop UI bridge still fails with `TIOCSTI`, but System Events now works.
- [ ] T122 **Deferred by user, 2026-09-30.** Verify packaged audio, MIDI devices, Python/Java-backed generators, and representative legacy projects; close applicable ledger items only after the runtime behavior is observed. Direct AudioFile and frozen selected-range output, stereo WAV routing, and AIFF input rendering ran in the macOS package; FLAC input displayed its unsupported-format message. A PolyObject child PythonProcessor and PythonObject/ClojureObject generation passed, including PythonObject generation after multi-group conversion. Valid Python Instrument code generated CSD and invalid syntax returned a source-location error. External, JMask, Tracker, LineObject, and ZakLineObject generated representative CSD; invalid PythonObject code also returned a source-location error. Three existing Java Blue projects loaded and generated CSD, including BlueX7, UDO, and BlueSynthBuilder material. The user completed macOS audio device/buffer listening checks on 2026-09-30 and reported that all changes worked (256/1024 and 512/2048). The user also confirmed macOS MIDI input discovery/enabling, Focused Target/Direct Channel routing, note release, and disabling through an external virtual MIDI controller/OS port on 2026-09-30. Physical USB/DIN transport was not exercised. Other source encodings and legacy projects for specialized generators remain open.
- [ ] T123 **Deferred by user, 2026-09-29 — no Windows/Linux machines available.** Run remaining platform-specific packaged checks on Windows and Linux, including settings/device buffers, rendering, project path and override behavior, interactions, and native shortcuts; verify developer setup and build instructions on every supported platform. Record platform differences and correct the manual and ledger (SC-026). Resume when suitable machines are available; no Windows/Linux pass is claimed.

## Phase 33: Runtime-backed PolyObject objective duration

- [x] T124 [US14] Measure PolyObject objective duration with asynchronous generation in main so Java-backed children and processors are included; reject missing-runtime and stale session/revision results without project mutation, and commit concrete beat values through the resolved ProjectHistory patch (FR-026, FR-035).
- [x] T125 [US14] Add focused child and PythonProcessor regressions for runtime success/failure, verify resolved commit/undo/redo and stale request handling, update `polyobjects.qmd` and the objective-duration ledger evidence, then run the affected app tests, main build, full tests, lint, manual render/link scan, and whitespace check (FR-026, FR-035).

## Phase 34: Origin-aware linked-source range contract

- [x] T126 [US19] Define and implement an opt-in range-independent origin contract for linked Instances of flat PolyObjects. Translate the child window before SoundLayer pruning only when both the Instance and source PolyObject use `TimeBehavior.NONE` and have no note processors, source SoundLayers have no note processors, and every active direct child proves a stable origin within its declared span. Keep dynamic, nested, transformed, and processor-bearing compositions on the existing path; preserve ordinary positional generation, order, and sync/async parity. Add regressions for pruned dynamic origins, duration-boundary origins, out-of-span GenericScore legacy behavior, and linked file leaves; document the bounded behavior and intentional Java Blue divergence in the SoundObjects and AudioFile chapters and M16 ledger row (FR-025, FR-035).
- [x] T127 [US19] Define a separate range-aware generation contract for dynamic JavaScript/Python sources, statically parsed events outside their declared object span, and other sources without a safe static origin. Specify how one-pass origin discovery interacts with generators and processors that consume selected ranges; preserve deterministic ordering and sync/async behavior, then add coverage and update M16 documentation only if the contract provides correct selected-range semantics without replaying side effects (FR-025, FR-035). Research Decision 21 concludes the current contracts cannot prove these guarantees; retain the tested bounded M16 behavior and defer expansion to a separate feature.

## Phase 35: Convergence

- [x] T128 Observe selected-range playback for direct AudioFile and FrozenSoundObject placements in a normally launched macOS package, and record audible results, failures, and corrected chapter/ledger claims; complete alongside T115 per FR-025 and FR-035. The user heard direct AudioFile playback with a tempo change and accepted the packaged frozen render; automated frozen realtime playback reached the engine's playing and finished states. Realtime speaker output was not recorded.
- [x] T129 Launch the current package from a logged-in macOS desktop with isolated user data, open Blue Manual from the native menu while offline, follow its local links, and complete the first-project instrument, GenericScore, CSD, and disk-render sequence; record the observed result and correct any mismatch alongside T121 per SC-001, SC-005, and SC-025 (partial). The user confirmed offline opening and navigation from a built app and accepted prior packaged first-project, CSD, and disk-render evidence for this integration. The rebuilt macOS package has Help after Window with Blue Manual inside; its installed manual index is present.
- [x] T130 Walk the remaining non-device procedures listed in manual-issues.md in the running macOS package, recording each observed result and correcting chapter claims and ledger entries alongside T121 per US19/AC4 and SC-026 (partial). The completed packaged checks are detailed under T121 and in `manual-issues.md`. The final Tracker local shortcut and fresh-clone macOS developer checks passed on 2026-09-30; Windows/Linux remain separately deferred under T123/T132.
- [x] T131 Define and validate selected-range origin semantics for dynamic, nested, transformed, processor-bearing, and out-of-span sources without replaying generator or processor side effects; preserve sync/async ordering and update M16 documentation only for proven cases alongside T127 per FR-025 and FR-035 (partial). Research Decision 21 records why no safe broader contract is available; existing sync/async fallback regressions and narrow M16 documentation remain the accepted result.
- [ ] T132 **Deferred by user, 2026-09-30.** Complete the packaged hardware/runtime and Windows/Linux checks (Windows/Linux portion deferred by user, 2026-09-29) on suitable hosts, including audio, MIDI, Java/Python generators, representative legacy projects, manual navigation, paths, rendering, shortcuts, and developer setup; record platform-specific evidence and correct the chapters and ledger alongside T122 and T123 per SC-004 and SC-026 (partial).

## Phase 36: Upstream provenance and current screenshots

- [x] T133 Remove the duplicated Blue 2 source and images, replace local-copy links/references with an immutable upstream edition reference, retain local credits/license and all 94 source-topic mappings, and update spec/plan/research/contracts to reflect the user's 2026-09-30 decision (FR-009).
- [x] T134 Summarize textual changes for all 35 current chapter files in `manual-changes.md`, identifying original upstream topics and new or deliberately omitted material.
- [x] T135 Capture reviewed screenshots of current Blue 3 Score, Orchestra, Mixer, PianoRoll, PatternObject, Project SoundObjects, Blue Live and Settings controls using disposable projects; add captions, alternative text and provenance, and validate local and installed offline image loading (FR-018, FR-036).
- [x] T136 Disable the Quarto themes’ remote font imports with a shared system-font override; verify clean-rendered and installed manual pages with HTTP requests blocked and no background network requests.

## Phase 37: Review repair

- [x] T137 Fix the reviewed P2 PolyObject objective-duration JavaScript-session gap: bind the project session during container generation and initialize JavaScript for descendants. A real on-load variable regression failed before the repair and passed after it; the measurement/fence/history suites passed 160 tests, main compilation and targeted lint/format checks passed, and a cold-process check verified generation without a supplied session. See `code-review.md` for evidence.
