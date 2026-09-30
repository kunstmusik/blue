# Validation guide: Blue 3 manual

## Final acceptance (2026-09-30)

The spec is complete for the user's accepted scope. Final speckit-converge
checked 36 FRs, 27 SCs, 61 acceptance scenarios, the plan and five constitution
principles, with no new implementation tasks. 134 tasks are complete;
T122/T123/T132 remain deferred and unchecked.

- Final `pnpm test` passed: app 5,294 tests (two skipped), data 2,063 tests
  (one skipped), engine client 47, CLI five, native 14 CTest cases and the
  Java/root script checks. The existing skipped cases remain skipped.
- Final `pnpm lint`, app main compilation and `git diff --check` passed.
- The generated manual scan passed: 35 chapters, 2,461 local references,
  eight screenshots with matching source bytes and no broken targets.
- The P2 review regression failed before the session repair and passed
  afterward; measurement/fence/history suites passed 160 tests. A cold
  process measured a JavaScript child without a supplied session successfully.
- The previously recorded macOS package/manual and runtime evidence below
  remains the package validation record; no new platform pass is claimed.

Accepted follow-ups are Windows/Linux and remaining hardware/runtime coverage,
the broader M16 range contract, more screenshots/diagrams, a tutorial rewrite
and online publication. The original 96 distinct linked images across 56
topics are represented by eight current screenshots; this reduction is
accepted and recorded in `manual-changes.md`.

**Current source policy (2026-09-30)**: Original-topic comparisons refer to the
pinned upstream Blue 2 edition. Earlier migration phases below describe work
completed before consolidation; only the current 35 chapters and Blue 3 assets
are shipped. See `manual-changes.md` and the current navigation contract.


Run from the repository root in the feature worktree.

1. Render the book: quarto render docs/manual --to html. Expect 35 chapter pages and docs/manual/_build/html/index.html.
2. Open the generated index in a browser without a network connection. Follow First project → Score, SoundObjects, Orchestra, Rendering, and the six second-batch chapters. Confirm links and styles load.
3. Run pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/application-menu.test.ts. Confirm the menu action is routed on macOS and Windows/Linux.
4. Build required workspace dependencies, then run pnpm --filter @blue/app build:main.
5. Build a local directory package with pnpm --filter @blue/app package:dir. Quarto must be on PATH. Run pnpm --filter @blue/app verify:packaged-app -- --no-playwright and confirm the installed manual index exists.
6. Run pnpm test, pnpm lint, and git diff --check before handoff when feasible.

Manual inspection should distinguish reviewed Blue 3 pages from labeled Java Blue drafts, and confirm Blue Manual opens from the packaged app while offline.

## First migration batch validation

1. Follow First project from a new project with Csound 7. Confirm the Generic
   Instrument and GenericScore steps produce a CSD, the project saves, and
   Render to Disk produces audio.
2. Render the book and check that Getting started, Working in Blue, Concepts,
   and Reference contain reviewed pages. How-to guides and all legacy chapters
   must be absent from the visible contents.
3. Follow links among First project, Score, SoundObjects, Orchestra, and
   Rendering in the local book with network access disabled. Check every local
   page and asset link and verify the packaged book has the same pages.

## Validation evidence (2026-09-24, macOS arm64)

- Quarto 1.10.18 rendered six current HTML pages. A local-link and asset scan found zero broken references. No legacy pages appeared in the output.
- Headless Chrome opened the generated index with its network context set offline and navigated to Installation through a local file link.
- The focused application-menu suite passed: 28 tests. The app main and full app builds passed after building workspace dependencies.
- The native Blue Engine was built from this worktree revision. The directory package passed the package-input gate and placed the manual in installed resources/assets/manual. Packaged-app smoke passed.
- pnpm test passed, including 493 app test files and 200 data test files. pnpm lint and git diff --check passed.
- Windows and Linux package checks remain covered by the repository's CI package matrix when this branch is submitted; they were not run locally on macOS.
- Convergence task T017 added an unaltered local GNU FDL copy to the rendered and installed book, with Steven Yi credited as the original manual author. A second macOS directory package contained six pages, the license, and zero broken local links or assets.

## First migration batch evidence (2026-09-24, macOS arm64)

- Checked the Blue 2 First project, Score timeline, SoundObjects, Orchestra Manager, and Rendering material against Blue 3 source controls and menu labels. Rewrote the current guidance without copying unreviewed screenshots; the original remains available upstream.
- Quarto 1.10.18 rendered nine current HTML pages. A local HTML link and asset scan found zero broken references, including anchors. The navigation has four populated sections; How-to guides and the legacy pages are absent.
- Generated a CSD from `@blue/data` using the tutorial's Generic Instrument and GenericScore text. Its `instr 1` and `i1 0.0 4 0.15 440` matched, and Csound 7 completed a four-second stereo disk render (705,644-byte WAV).
- `pnpm --filter @blue/app package:dir` completed on macOS arm64. The installed `resources/assets/manual` contains all nine HTML pages, the license, and zero broken local links or assets. Headless Chrome opened the installed book through `file://` with network access disabled and followed a link to Orchestra.
- The CSD and audio check used Blue's data model and Csound directly; the tutorial has not been clicked through manually in the application UI. Windows and Linux packages remain for CI validation.
- Prettier accepted the manual contributor guide, Quarto config, and feature artifacts. `git diff --check` passed. A constitution and Spec Kit convergence review found no remaining implementation task in this feature's scope.

## Second migration batch validation

1. Check Time against the Score toolbar and Ruler Configuration dialog. In
   particular, distinguish changing a display or snap value from selecting
   the dialog's Update ScoreObjects or Update Markers conversion options.
2. In a project with instrument ID `1`, follow the GenericScore, PianoRoll,
   and PatternObject pages and inspect generated CSD or each editor's Test
   result. For PolyObjects and Note Processors, check the nested Score path,
   object properties, chain order, and generated-score effect.
3. Render the book. Expect fifteen current HTML pages and no legacy output.
   Follow links and assets through the local book while offline, then inspect
   the installed resources in a directory package.

## Second migration batch evidence (2026-09-24, macOS arm64)

- Compared the six upstream topics with current Score, PianoRoll, PatternObject,
  PolyObject, Ruler, Score Object Properties, and Note Processor controls. The
  current pages omit old screenshots and the obsolete warning that converting
  objects to a PolyObject cannot be undone.
- A direct `@blue/data` model check confirmed GenericScore scaling and parent
  offset, the PianoRoll template's `p4=0.15` and `p5≈440`, four PatternObject
  triggers at beats 0–3, PolyObject child offset, and AddProcessor changing
  `p5` from 440 to 550. Six focused data test files passed (44 tests).
- Quarto 1.10.18 rendered fifteen HTML pages. A local chapter, anchor, and
  asset scan found zero broken references; no legacy HTML appeared and all
  four visible sections contain reviewed pages.
- `pnpm --filter @blue/app package:dir` passed on macOS arm64. The installed
  manual contains fifteen pages and `COPYING.GFDL`, with zero broken local
  links or assets. Headless Chrome with networking disabled opened the
  packaged `file://` book and followed links to all six new chapters.
- The examples were checked against Blue's UI source and data model; a manual
  click-through of every chapter in the running application was not performed.
  Windows and Linux package checks remain for the repository CI matrix.
- Prettier accepted the manual configuration and feature artifacts;
  `git diff --check` passed. A Spec Kit and constitution convergence review
  found no remaining implementation task for this batch.

## SoundObjects navigation refinement (2026-09-24, macOS arm64)

- Quarto 1.10.18 rendered the fifteen-page book with SoundObjects as a book
  part. The overview, GenericScore, PianoRoll, PatternObject, and PolyObjects
  appear together as separate chapters in the generated sidebar. Their URLs
  remain unchanged.
- A local scan found zero broken links, anchors, or assets and no legacy HTML.
  Application packaging logic was not changed in that batch.

## Third migration batch validation

1. Add one SoundObject to Project SoundObjects. Confirm the Score entry becomes
   an Instance and that Copy Instance and Copy Independent differ when placing
   the library source again.
2. Add an AudioFile SoundObject, select a readable file, inspect its metadata
   and Csound tab, and compare its workflow with an audio-layer clip.
3. Render the book and inspect all eighteen pages in the local and installed
   copies. Follow the three new chapters from the SoundObjects contents while
   offline; check local links, anchors, and assets.

## Third migration batch evidence (2026-09-24, macOS arm64)

- Compared the Blue 2 SoundObject Library, Instance, and AudioFile chapters
  with the current Blue 3 Score context menu, Project SoundObjects, Libraries,
  editor panels, transfer choices, and model source. The new pages use the
  current command names and do not carry forward the legacy Instance duration
  claim or old screenshots.
- Quarto 1.10.18 rendered eighteen HTML pages. The SoundObjects sidebar part
  contains its overview and seven separate topics, including all three new
  pages. Local chapter, anchor, and asset scans found zero broken references;
  no legacy HTML appeared.
- Three focused `@blue/data` test files passed (13 tests) and five focused
  `@blue/app` test files passed (73 tests), covering library transfers, linked
  references, AudioFile generation and selection, and the current editors.
- `pnpm --filter @blue/app package:dir` passed on macOS arm64. The installed
  manual contains eighteen pages and `COPYING.GFDL`, with zero broken local
  links, anchors, or assets. The packaged-app smoke check passed. Headless
  Chrome with networking disabled followed the three new pages from the
  packaged `file://` sidebar.
- The workflows were checked against UI source and existing behavior tests;
  a manual click-through of every step in the running app was not performed.
  Windows and Linux packages remain for the repository CI matrix.
- Prettier and `git diff --check` passed. The Spec Kit convergence review found
  no remaining task in this batch's scope.

## Full legacy draft import validation (2026-09-24, macOS arm64)

- Inventoried all 94 archived QMD sources. Twenty-two source topics map to
  reviewed chapters; 72 are copied, visibly labeled drafts. The book has 90
  unique chapters, and `manual-issues.md` has 72 draft review rows plus 18
  current-chapter coverage checks. A mapped topic may still have missing detail.
- Moved SoundObject Library into Working in Blue at the same URL. The original
  the pinned upstream Blue 2 edition sources remain intact. Seven malformed or extensionless
  source cross-links and two obsolete heading fragments were corrected in
  draft copies; no referenced archived image was missing.
- Quarto rendered all 90 chapters. Full HTML scans of the local and installed
  books found zero missing chapter links, anchors, or assets. The installed
  issue list matches the source file.
- `pnpm --filter @blue/app package:dir` passed. The packaged-app smoke check
  passed on the first full package. Headless Chrome opened an installed draft
  via `file://` with HTTP requests blocked; its legacy image loaded and its
  issue-list link was present. A second package after the final documentation
  edits passed and matched the local book in the link scan.
- `pnpm format:check` and `git diff --check` passed. Blue 3 review of the 72
  drafts remains open in `manual-issues.md`; Windows and Linux packages remain
  for the repository CI matrix.

## Score and Mixer coverage validation (2026-09-25)

- Compared the old Score Timeline and Mixer chapters with current Score
  Manager, Score toolbar, timeline rows, Track Layer M/S settings, Mixer
  panel, effect/send menus, Libraries routing, and `blueMixerOut` generation.
  Replaced old Audio Layer terminology with the current Track Layer Group.
- Expanded the two reviewed chapters and split their issue entries into
  completed coverage and still-open checks for Navigator, BlueLive controls,
  detailed audio gestures, shortcuts, effect randomization, and mixer code
  optimization. No application or upstream source file changed.
- Quarto rendered all 90 chapters. A complete local HTML scan found zero
  broken chapter links, anchors, or assets. Headless Chrome with HTTP
  requests blocked followed `index.html` → Score → Mixer through `file://`
  links and found the new Effects and sends section.
- Prettier checked the issue list and `git diff --check` passed. Packaging
  behavior was unchanged; the next app package build will render these
  updated chapters through the existing manual build step.

## Settings and PianoRoll coverage validation (2026-09-25)

- Compared Blue 2 Program Options and PianoRoll entries with the current
  Settings window, Realtime Render and Disk Render panels, MIDI input and OSC
  panels, PianoRoll editor, and field normalization code. The Settings chapter
  now describes the managed Blue Engine rather than the legacy executable.
- Expanded both reviewed chapters, marked the verified coverage in
  `manual-issues.md`, and kept platform-specific device tuning, the legacy
  Base Frequency control, note-template override copying, and shortcut checks
  as explicit follow-up work. No application or upstream source file changed.
- Quarto rendered all 90 chapters. A complete local HTML scan found zero
  broken chapter links, anchors, or assets. The rendered Settings and
  PianoRoll pages contain the new sections and current control names.
- `pnpm format:check` and `git diff --check` passed. This documentation-only
  batch did not change packaging or application behavior; the existing package
  build renders the updated chapters on its next run. A manual packaged-app
  click-through and Windows/Linux device checks remain open.
- The Spec Kit convergence review found no remaining implementation task in
  this batch's scope; deferred legacy and platform checks remain in the manual
  issue ledger.

## Rendering coverage validation (2026-09-25)

- Compared the Blue 2 Rendering and Project Properties chapters with the
  current menu, Score ruler selection, Project Properties tabs, disk command
  planner, render dialog, Audio File Player handoff, and CSD generation.
- Expanded `rendering.qmd` with the disk/realtime CSD distinction, render
  range, project versus application settings, destination choice, progress,
  cancellation, and Play/Open results. Corrected `settings.qmd`: the current
  Render to Disk and Play path opens Blue's Audio File Player and does not use
  the visible external-play preference. That unused control and advanced
  packaged-app checks remain in `manual-issues.md`.
- Quarto rendered all 90 chapters. A local HTML scan found zero missing
  chapter links, anchors, or assets. `pnpm format:check` and
  `git diff --check` passed. No application behavior changed in this batch;
  packaged-app interaction and platform-specific output checks remain open.
- The Spec Kit convergence review found no remaining implementation task in
  this batch's scope.

## Orchestra coverage validation (2026-09-25)

- Compared Blue 2 Orchestra Manager and Instruments text with the current
  Arrangement table, Generic Instrument and outer Comments editors, Libraries
  panel, context menus, keyboard rename, and transfer controls. Replaced the
  old combined-window description with the separate Blue 3 panels.
- Expanded `orchestra.qmd` with assignment IDs, Use, row commands, Generic
  tabs, and project/user-library transfers. Updated the coverage entry in
  `manual-issues.md`; legacy beta-project migration and type-specific
  runtime behavior remain open.
- Quarto rendered all 90 chapters. A complete local HTML scan found zero
  broken chapter links, anchors, or assets. `pnpm format:check` and
  `git diff --check` passed. No app or upstream source changed in this batch;
  packaged-app interaction remains an open validation item.
- The Spec Kit convergence review found no remaining implementation task in
  this batch's scope.

## Time coverage validation (2026-09-25)

- Compared the Blue 2 Time System chapter with current Score Object
  Properties, AudioClip fields, Score toolbar, Ruler Configuration dialog,
  `TimeUnitEditor`, and time-state patch logic. Expanded `time.qmd` with entry
  examples, position/duration differences, independent snap, and explicit
  display-only versus conversion choices.
- Updated `manual-issues.md` during review. Marker-only conversion, non-24-fps
  SMPTE text entry, nested PolyObject conversion, and legacy Quick Time
  guidance remain open; the current chapter avoids promising them.
- `quarto render docs/manual --to html` generated all 90 chapters. The complete
  local HTML scan found zero broken chapter links, anchors, or assets.
  `pnpm format:check`, `git diff --check`, and the Spec Kit prerequisite check
  passed. No application behavior or upstream source changed in this batch.
- The Spec Kit convergence review found no remaining implementation task in
  this batch's scope.

## SoundObjects overview validation (2026-09-25)

- Compared both Blue 2 SoundObjects introductions with the current Score
  canvas, Score Object Properties form, time-behavior generation, and render
  start processing. Expanded `soundobjects.qmd` with placement and selection,
  the PolyObject double-click distinction, shared properties, Scale/Repeat/
  Repeat (Classic)/None, processor order, and selected-range implications.
- Updated `manual-issues.md` during review. The archived diagrams,
  type-specific partial rendering, non-note generation claims, and End Time
  format decision remain open.
- `quarto render docs/manual --to html` generated all 90 chapters from the
  latest source. The complete local HTML scan found zero broken chapter
  links, anchors, or assets. `pnpm format:check`, `git diff --check`, and the
  Spec Kit prerequisite check passed. No application behavior or archived
  source changed in this batch.
- The Spec Kit convergence review found no remaining implementation task in
  this batch's scope.

## PolyObjects and score phrase coverage validation (2026-09-25)

- Compared both Blue 2 PolyObject chapters with the current nested Score,
  grouping patch, time behavior, processor order, and Java objective-duration
  action. Expanded `polyobjects.qmd` and fixed the Blue 3 action to measure
  generated notes relative to the container's Score start.
- The new ProjectHistory regression failed against the old action and passed
  with the fix. Three focused suites passed (155 tests); the complete
  `@blue/app` suite passed (493 files, 5,260 tests, 2 skipped), and
  `pnpm --filter @blue/app build:main` passed.
- Compared Blue 2 GenericScore, NoteProcessors, PatternObject, Instance,
  and AudioFile entries with their current parser, editors, generators, and
  library/file paths. Updated the five chapters and `manual-issues.md` as
  claims were verified. Unreviewed processor reference pages, PatternObject
  grid resizing, Instance duration/repeat, and packaged audio checks remain
  open there.
- The final `quarto render docs/manual --to html` generated all 90 pages.
  The local HTML scan found zero broken chapter links, anchors, or assets.
  `pnpm test`, `pnpm lint` (including formatting), `git diff --check`, and
  the Spec Kit prerequisite check passed. The first lint run overlapped a
  Quarto rebuild and saw a transient missing generated file; the rerun after
  rendering passed.
- The Spec Kit convergence check found no additional required tasks for these
  batches. Remaining chapter review items stay in `manual-issues.md`.

## Project-wide Csound editor chapters (2026-09-25)

- Compared the Blue 2 Globals Manager, Tables Manager, and UDO Manager
  chapters with Blue 3 workbench panels, project data, and CSD generation.
  Promoted them to `globals.qmd`, `tables.qmd`, and `udos.qmd`; their Java
  originals remain in the pinned upstream Blue 2 edition.
- Corrected the old Global Score timing advice and documented current UDO
  controls. **Test Opcode** previews generated code; it does not run Csound.
  Packaged-app and advanced behavior checks remain in `manual-issues.md`.
- A clean Quarto build produced 90 HTML pages, including the three new
  routes and none of their removed draft routes. The local link, anchor,
  and asset scan found zero errors. Source accounting is now 25 mapped
  archive topics, 21 reviewed chapters, and 69 labeled drafts.
- `pnpm format:check`, `git diff --check`, and the Spec Kit prerequisite
  check passed. This batch changed only manual and Spec Kit files, so no
  application tests were added. The convergence check found no missing
  implementation task for this batch.

## Complete archived-topic review (2026-09-25)

- Compared the remaining 69 draft topics with Blue 3 menus, editors, models,
  and generation paths. Added 14 current chapters, bringing the root book to
  35 chapters. Kept all 94 original Java `.qmd` sources in the pinned upstream Blue 2 edition and
  removed the duplicate draft copies and routes.
- `manual-issues.md` now maps each upstream source to a current chapter,
  identifies historical-only features, and has a follow-up entry for every
  current chapter. A source-level check found 94 unique source mappings, 35
  render-list entries, 35 chapter coverage entries, zero unresolved
  destinations, and zero duplicate draft pages. A source-link and anchor check
  found no missing local targets after correcting the Tracker anchor.
- `pnpm format:check` and `git diff --check` passed. A clean Quarto render
  reached the first of 35 pages but failed when its Sass cache database could
  not be opened in the sandbox. The required approval review could not run
  because its sign-in token failed to refresh; the requested render action was
  not executed. HTML output and packaged-app behavior remain unverified for
  that attempt. T103 remained open pending a clean render and link scan.
- On continuation, the Quarto cache approval succeeded. A fresh render
  generated all 35 HTML pages. The complete generated-HTML scan found zero
  broken local links, anchors, or assets. `pnpm verify:package-inputs`,
  `pnpm format:check`, and `git diff --check` passed. T103 is complete;
  packaged-app interaction remains in `manual-issues.md`.

## Manual issue repair validation (2026-09-26, macOS arm64)

- Repaired M02–M10, M12–M14 and completed M01's global Repeat controls and
  scheduler. M11's
  saved key/MIDI trigger fields remain explicitly historical in the Blue Live
  chapter; restoring assignment and dispatch is a separate feature. The
  behavior and chapter-specific evidence are in `manual-issues.md`.
- The Track Add SoundObject regression covers revision advancement while a
  pending instrument edit settles. The existing ProjectHistory Track-add
  fixture verifies commit, undo, redo, and identity. Fresh packaged profiles
  retained the edited instrument and GenericScore without a pause. The
  generated CSD contained the edited instrument and `i1` at beat 0.6, matching
  the clicked placement. Render to Disk produced an 811,564-byte WAV.
- `pnpm test` passed: 493 app test files (5,272 tests passed, 2 skipped), 201
  data test files (2,039 passed, 1 skipped), plus engine-client, CLI, Java,
  native-engine, and script suites. `pnpm lint`, including Prettier, passed.
  The app's Vite renderer/main/preload build passed.
- Quarto rendered 35 HTML pages and the local link, anchor, and asset scan
  found zero errors. `pnpm verify:package-inputs`, `git diff --check`, and the
  packaged macOS metadata, resources, project round-trip, and incompatible-
  engine smoke checks passed. Windows and Linux package interaction remains
  for their native CI matrix.

## Manual issue ledger continuation (2026-09-26)

- Completed the source-backed M17 error-delivery check and documented current
  Blue Live MIDI routing. An independent review caught and corrected the
  Focused Target qualification: the target must have an enabled compiled
  instrument. Reviewed the active chapters for screenshot needs; none requires
  a screenshot to explain its current procedures.
- T116–T118 are complete. M19's nested finite-range fix retains child-local
  filtering before parent rebasing and has independent review. The full test
  suite passes after updating the numeric-input inventory for the new PianoRoll
  Base Frequency field: 494 app test files, 5,279 passed, 2 skipped, plus the
  other workspace suites. The focused inventory test passes (5 tests). A meter
  delivery test narrowly missed its threshold during the first concurrent run;
  it passed in isolation and in the final full suite.
- M16 now also covers a source-visible one-level compound PolyObject with
  `TimeBehavior.NONE` and no PolyObject note processors: the
  source lead at beat 2, file leaves at beat 4, and selected range `[3,5]`
  produce a one-beat seek and two-beat file duration in sync and async model
  tests. `pnpm --filter @blue/data exec vitest run
  src/sound-objects/instance.test.ts src/sound-objects/audio-file.test.ts
  src/sound-objects/frozen-sound-object.test.ts
  src/note-processors/python-processor-runtime.test.ts` passed (4 files, 28
  tests). A scaled-source regression confirms seek and p3 finalization are
  skipped. `pnpm --filter @blue/java-runtime exec mvn -q
  -Dtest=JythonNoteMetadataTransportTest test` passed, as did
  `pnpm --filter @blue/data build` and `git diff --check`. M16 remains partial:
  a nested PolyObject can prune its file leaf with an unshifted local window
  before the outer normalization origin is known; packaged audible playback
  also remains unverified.
  After retaining only `beatOrigin` and `normalizationOrigin` for PolyObject
  children, `pnpm --filter @blue/data exec vitest run
  src/score/score-model-compatibility.test.ts src/sound-objects/instance.test.ts
  src/sound-objects/audio-file.test.ts
  src/sound-objects/frozen-sound-object.test.ts
  src/note-processors/python-processor-runtime.test.ts` passed (5 files, 52
  tests), including nested PolyObject local-solo behavior.
- Quarto rendered all 35 pages. A local scan checked 35 HTML pages and 135
  assets with zero broken references; `pnpm verify:package-inputs`, `pnpm
  lint`, `pnpm test`, and `git diff --check` passed. Desktop UI control could
  not initialize because the CUA bridge exited with a sandbox `TIOCSTI`
  error. At this 2026-09-26 checkpoint, 29 ledger checks remained open for
  packaged workflows, devices/audio/runtime, and platform coverage. The
  current ledger has 28 chapter-specific follow-ups plus the overarching
  packaged walkthrough checklist.

## Final ledger validation (2026-09-27)

- M16 now translates a linked Instance's child window only when the Instance
  and its flat PolyObject source use `TimeBehavior.NONE`, have no Note
  Processor chains, source SoundLayers have no processor chains, and each
  active direct child proves a stable origin within its declared span. Dynamic
  JavaScript/Python sources, nested or transformed compositions, processor-
  bearing sources, and out-of-span GenericScore notes stay on the existing
  path. Sync/async regressions cover the supported static origin,
  range-pruned dynamic origins, and legacy file seek/duration when a short
  GenericScore's event falls outside its declared span. This is
  an intentional TypeScript extension to Java Blue's positional behavior.
- An earlier full workspace `pnpm test` run, before the latest M16 edits,
  passed: 495 app files (5,288 passed, 2 skipped), 201 data files (2,057
  passed, 1 skipped), plus engine-client, Java, native engine, CLI, and script
  suites. `pnpm lint`, the main-process build, and `git diff --check` passed.
  The data suite was rerun after adding the SoundLayer TimeWarp regression.
- At an earlier 2026-09-27 checkpoint, Quarto rendered all 35 pages. A
  generated-site scan checked 2,094 local
  links, 315 source references, 102 fragments, and one CSS asset; it found no
  missing files, fragments, or assets. The scan does not check external URLs
  or dynamically constructed JavaScript requests. Quarto required permission
  to write its user Sass cache; the final render succeeded with that permission.
- An earlier `pnpm --filter @blue/app package:dir` and headless packaged-app
  smoke verifier passed on macOS arm64: metadata, resources, project round
  trip, and incompatible-engine handling. The installed 35-page manual had
  the same zero-error local scan. This smoke run does not verify window
  interaction or audible playback.
- A fresh package attempt first failed while Quarto opened its user Sass cache
  (`unable to open database file`). Retrying with an isolated temporary `HOME`
  rendered all 35 pages and built the macOS arm64 package. Playwright could not
  obtain a window, and a direct startup probe exited with `SIGABRT`. Four crash
  reports show the abort during AppKit `NSApplication` registration before
  Blue's JavaScript starts; the sandbox blocked access to the system log, so
  the underlying AppKit reason remains unknown. Strict codesign verification
  also failed because this local package intentionally skips signing
  (`mac.identity: null`); that separate result does not explain the launch
  crash. A headless verifier passed metadata, resources, project round-trip,
  and engine-mismatch checks on an earlier package; it did not verify a visible
  window or audio. A normal desktop launch outside Codex is still needed to
  tell whether the GUI failure is specific to this managed environment.
- Latest checks on 2026-09-27: `pnpm --filter @blue/data build`,
  `pnpm --filter @blue/app build:main`, `pnpm lint`, the focused M16 and score
  tests, app score-object request tests, and `git diff --check` passed. Quarto
  rendered all 35 pages after the final M16 text edits. A generated-site scan
  checked 2,444 local links/assets, 102 HTML fragments, and one CSS reference;
  it found no missing files, fragments, or assets. The scan does not check
  external URLs or dynamically constructed JavaScript requests.
- The latest serialized app suite passed all 495 files (5,288 passed, 2
  skipped). The Track Layer picker test now waits for the host surface's
  placement outside React `act` and restores its temporary viewport property
  overrides; the focused file passes all 22 tests.
- The subsequent full workspace `pnpm test` passed, including the app suite,
  data suite, engine-client, Java, native engine, and script checks. `pnpm
  lint` and `git diff --check` also passed. Earlier `meter-stress` and picker
  failures did not recur on these runs; their cause remains unknown.
- A fresh `pnpm --filter @blue/app package:dir` rebuilt the macOS arm64
  directory package after the stale manual copy was found. Quarto rendered 35
  pages; all 15 package-input checks passed, and `diff -qr` found the packaged
  manual identical to the generated site. The packaged smoke verifier exited
  during `packaged-metadata` before a success marker. The desktop bridge still
  fails with its sandbox `TIOCSTI` error, and LaunchServices `open` reported
  that its server process is unavailable. No UI or audio behavior was
  observed; cross-platform and packaged interaction checks remain open.
- The packaged startup failure has not been reproduced outside Codex's managed
  macOS launch environment. A logged-in desktop launch of the existing `.app`
  with an isolated user-data directory is the next diagnostic; GUI and audio
  workflows remain open meanwhile.
- Packaged interaction, device/audio/runtime behavior, and Windows/Linux
  package checks remain open in `manual-issues.md`.

## User acceptance (2026-09-27)

- The user opened Blue Manual from a built app and confirmed that its pages
  worked offline. The current Blue 3 chapters have no linked images, so image
  display was not part of that observation.
- The user accepted the earlier packaged first-project, Generate CSD to Screen,
  and Render to Disk results for this integration. A later rewrite of the
  tutorial is separate work.
- The Blue Manual item now belongs to the final Help menu after Window on all
  platforms. The menu test covers its position and callback; a rebuilt macOS
  package showed Help after Window and contained the installed manual index.
- The user retested Cmd+Q and reported that quit appears to work. The exact
  earlier failure remains unconfirmed; the quit path now waits for the normal
  Settings close decision and logs unexpected transition failures (M21).
- A late `unified-library:browse` call during quit reached a removed handler.
  The library handler now stays registered until `will-quit`, after windows
  close; the change passed 18 focused startup/IPC/Settings tests and the main
  build. In the rebuilt macOS package, a loaded project could browse Libraries;
  both normal quit and quit while issuing repeated browse requests exited with
  code 0 and no missing-handler error (M22).
- Repeated history availability events accumulated `destroyed` listeners on a
  `WebContents`. Cleanup now uses one listener per sender. Main TypeScript,
  lint, and 64 focused history/IPC tests passed, and the user reported that
  startup and project opening worked without the warning (M23).
- The user confirmed direct AudioFile selected-range playback in the built
  macOS app and heard the file portion change as the project tempo changed.
  The direct AudioFile audible check is complete.
- On 2026-09-28, Playwright launched the macOS package with isolated user data,
  opened a disposable AudioFile project, and invoked the app's freeze, disk
  render, and realtime playback paths. The project used beat 2 placement,
  120 BPM through beat 4 then 60 BPM, and selected range `[6,8]`. Direct and
  frozen renders both lasted 2.000023 seconds and contained the expected
  550 Hz then 660 Hz source segments; their sample correlation was 1.0. The
  frozen realtime run reached `playing via blue-engine` and finished. No
  speaker or loopback recording was made. The user accepted the captured
  frozen render as sufficient evidence, completing T115/T128 for supported direct
  placements. M16's unsupported source compositions remain a separate limit.
- On 2026-09-28, Playwright opened disposable malformed, corrected, and
  shorthand GenericScore projects in the rebuilt macOS package. Generate CSD
  displayed a toast with `NoteParseException`, line 3, and `i1 0`; the corrected
  project generated two `i1` events, and `i1 + 1 .` advanced the second event
  while reusing the prior `p4`. This completes the packaged M17 input check.
- During that run, the package logged two missing Code Repository IPC handlers
  at startup (M24). Moving that startup stage before window creation removed
  both errors in a freshly rebuilt package. The malformed, corrected, and
  shorthand CSD checks still pass. The focused startup/IPC suite passed
  (12 tests), as did `build:main`, the Vite build, and `package:dir`.

## Further packaged macOS checks (2026-09-28)

- Playwright launched the rebuilt arm64 directory package with a fresh user-data
  directory per disposable project. The native menu order ended with Window,
  Help; Help contained Blue Manual, and the manual index existed under
  `Contents/Resources/assets/manual`.
- Ruler Configuration offered `29.97 fps (non-drop)` and saved 29.97 in the
  project snapshot. After selecting SMPTE for an AudioFile's Start Time,
  `00:01:00:01` was accepted and serialized as 60.033 seconds (M18). In a
  separate project with 120 BPM through beat four and 60 BPM afterward,
  entering `0:00:03.000` for Start Time produced beat five; switching the field
  to Csound Beats displayed `5` (M14). In that tempo context, changing the
  primary ruler from Beats to Time with **Update ScoreObjects** checked changed
  an AudioFile start from beat five to three seconds while keeping its
  beat-five placement.
- A PatternObject with 16 steps changed to eight after Beats was set to two,
  retaining row `10000000`; generated CSD had the beat-zero trigger and its
  Repeat at beat two. Setting Sub to two left four steps and row `0000`. The
  rendered canvas shrank from 320 to 160 to 80 pixels (M05).
- A PolyObject child GenericScore with a PythonProcessor generated a six-beat
  note. **Set Subjective Time to Objective Time** changed the parent's duration
  from four to six beats; native-menu undo restored four and redo restored six
  (M20). This exercised the packaged Java-backed processing path.
- Generate CSD to Screen included an instrument body produced by a JavaScript
  Instrument script, including its oscillator and output statements (M02).
- Score Object Properties for an AudioFile showed its shared timing fields and
  omitted Time Behavior and Note Processors (M09). A separate stereo PCM WAV
  appeared as two channels; the Csound tab listed `aChannel1` and `aChannel2`,
  and generated CSD included `diskin2` and `outs aChannel1, aChannel2`.
- PythonObject and ClojureObject each generated `i1 0 2 440` into packaged CSD
  through their Java-backed runtimes. An invalid PythonObject script reported
  a syntax error at line 1, column 7. External ran `/usr/bin/python3` and
  emitted `i1 0 1 440`. Seeded JMask emitted four half-beat notes; Tracker
  emitted its configured pitch and dynamic fields; LineObject and ZakLineObject
  emitted control events.
- Three existing Java Blue files opened in the package without being saved:
  a 2013 BlueX7 project, a 2006 UDO/GenericScore project, and a recent
  BlueSynthBuilder project. Generate CSD to Screen succeeded for each. The UDO
  CSD contained the `yi_add_table` definition and calls. Legacy projects for
  specialized SoundObject generators remain for T122/T132.

## Additional packaged macOS checks (2026-09-28)

- A one-second stereo PCM AIFF source appeared in the AudioFile editor with
  AIFF format and two channels. Render to Disk succeeded; its 44.1 kHz stereo
  WAV output had nonzero first-second RMS. A FLAC source displayed
  **Unsupported Audio Format**. The AudioFile chapter now distinguishes
  supported source formats from disk-render output choices.
- Disk Complete Override using `-o "override output.wav" -W -s -d` rendered to
  the named file in the project directory, ignoring the different File Name
  value. The output was a 176,444-byte WAV.
- Two instruments' Global Orchestra command blocks generated two `pre` blocks
  before ordinary global code, one copy of identical `once` text, and no
  unsupported-command block. The same held for a nested PolyObject in selected
  range `[1,2]`. Its two notes were missing before M25; after a failing-then-
  passing sync/async Score regression and a rebuilt directory package, Generate
  CSD to Screen contained those notes at beats 0 and 0.5. This intentionally
  corrects Java Blue's repeated nested render-start subtraction.
- The focused Score offset suite passed (15 tests), the full `@blue/data` suite
  passed (2,062 tests, one skipped), the data and main builds passed, and
  `package:dir` passed. A second packaged selected-range check placed the
  nested PolyObject at beat eight and rendered range `[9,10]`; its two notes
  appeared at 0 and 0.5. The first full `pnpm test` run had one wall-clock
  threshold failure in the unrelated 64-strip meter performance test while
  lint was running concurrently; its isolated rerun passed (3 tests). A second
  `pnpm test` run without concurrent lint passed, including all 5,289 app
  tests (two skipped), all 2,062 data tests (one skipped), and script tests.
  `pnpm lint` passed when run alone.
- The final `package:dir` rebuild succeeded after the chapter edits. The
  installed macOS book contains all 35 HTML pages, including the updated
  AudioFile source-format and nested PolyObject selected-range text.

## Rendering and media path checks (2026-09-28, macOS arm64)

- In the packaged app, a disposable project left Disk Complete Override off
  and set Disk Advanced Settings to `--format=wav:float`. Render to Disk
  succeeded at its File Name destination. `ffprobe` identified a 44.1 kHz,
  two-channel 32-bit float WAV, confirming that project advanced flags joined
  the normal disk-render settings.
- The same project's application-wide Render and Open Command was set to a
  local Python script with `$outfile`. **Render to Disk and Open** succeeded,
  and the script wrote the exact rendered output path to a marker file.
- A second disposable project enabled **Copy Imported Media** and set **Media
  Folder** to `custom-media`. The packaged Track audio-drop IPC copied a
  176,444-byte stereo WAV into that folder. Its committed AudioClip stored the
  relative path `custom-media/stereo-source.wav`. This covers a Track audio
  import; AudioFile selection and other media-copy paths remain open.

## Project SoundObjects transfer check (2026-09-29, macOS arm64)

- In a disposable project, packaged library transfers inserted the same
  GenericScore definition as an independent GenericScore at beat four and a
  linked Instance at beat eight, beside an existing linked Instance at beat
  zero. Both transfer previews allowed the requested mode and both commits
  succeeded.
- The packaged Project SoundObjects editor saved a source pitch change from
  440 to 660. Generate CSD to Screen then emitted the two linked notes with
  pitch 660 and the independent note with pitch 440. The linked beat-eight
  Instance retained its default four-beat Scale duration.

## Orchestra transfer and Python Instrument checks (2026-09-29, macOS arm64)

- A packaged project with named Instr ID `Lead` generated both `instr Lead`
  and the matching named score event. Copying that Generic Instrument into
  the user Instruments library, then inserting it back into the project's
  Arrangement, created a second enabled row with its own numeric Instr ID
  `1` and the same instrument body.
- A valid Python Instrument generated its oscillator body and score event.
  Invalid Python syntax reported line 1, column 12 through Generate CSD to
  Screen. Unknown or unavailable instrument runtimes remain for separate
  checks.

## PolyObject conversion check (2026-09-29, macOS arm64)

- In a disposable packaged project, the Score context menu converted four
  selected SoundObjects from two layers and two root groups into one
  PolyObject. The selection included an Instance and a PythonObject. Native
  Undo restored every original placement; Redo restored the container with
  all four children and the Instance reference.
- Generate CSD to Screen succeeded after Redo, including the Python-generated
  note. The new PolyObject's default **Scale** behavior changed the generated
  note starts and durations. The chapter now flags this beside the conversion
  steps and tells readers to select **None** when preserving child timing.

## AIFF and FLAC disk output (2026-09-29, macOS arm64)

- In normal disk-render mode, packaged Settings output choices created
  one-second stereo 16-bit AIFF and FLAC files at 44.1 kHz. Both decoded to
  88,200 nonzero samples with RMS near 11,314. This confirms the output
  format choices independently of the AudioFile source parser, which reports
  FLAC input as unsupported.

## Shortcut and workflow checks (2026-09-29, macOS arm64)

- The installed macOS native menu reports the documented accelerators for
  New/Open/Save/Close, Undo/Redo, Generate CSD to Screen, Render to Disk,
  Audition, and Add Marker. Playwright's synthetic Cmd keys reached the
  focused renderer but did not invoke the native menu actions; this run does
  not establish physical shortcut behavior.
- Auditioning one valid GenericScore beside an unselected malformed object
  reached `playing via blue-engine`, stopped without error, and left the
  project objects unchanged. Freezing both objects reported the malformed
  line, made no replacement, and left no generated media file in the saved
  project directory. Successful freeze output and selected-range playback
  were checked earlier; mixer-tail timing and subprocess-failure recovery
  remain open.

## Packaged Tools checks (2026-09-29, macOS arm64)

- The packaged Code Repository initially failed because the client selected
  the Vite worker filename while the package used the TypeScript output
  layout. After correcting the path, a fresh isolated profile automatically
  imported the existing Java Blue `codeRepository.xml`. A second profile
  created a snippet and exported Java-compatible XML; a third imported it
  and retained the name and code. A focused service test covers clearing a
  stale migration diagnostic on Retry.
- The first window could load Libraries before their service started, leaving
  the Effects Library panel on “Libraries are not ready.” Starting the service
  before the application shell fixed the race in the rebuilt package. Tools →
  Effects Library opened the Effects tree and editor. Editing an imported
  effect's embedded name persisted across a relaunch in the isolated library
  database; the tree label is managed separately.
- FTable Converter changed `f 1 0 1024 10 1` to an `ftgen` assignment. The
  `.csound7rc` editor displayed a temporary `CSOUNDRC` path; Cancel left the
  file unchanged and Save wrote the edited flags. Without `CSOUNDRC`, the
  editor displayed `/Users/stevenyi/.csound7rc`; Cancel closed it without writing.
- SoundFont Viewer opened a local guitar `.sf2` through **Choose file** and
  displayed one instrument and one preset named `SpanishClassicalGuit`, at
  bank 0 and preset 0.
- Effects Library XML import reviewed one supported item and added it to the
  tree. Copy/Paste inserted it into the mixer pre-chain; Undo removed it and
  Redo restored the same entry identity. Opening its interface and choosing
  **Randomize** changed a randomizable knob from 0 to 0.4603189097146487
  within its 0–1 range. Undo restored 0 and Redo restored the same random value.

## CSD import check (2026-09-29, macOS arm64)

- With a disposable project open, **File → Import CSD File** replaced it with
  a real 70 KB CSD in all three import modes. Single Sound Object created one
  item; Sound Object per Instrument created a nine-layer group. Generate CSD
  to Screen succeeded in all modes and retained instrument 1, its first note,
  and the `t 0 108` tempo statement. The import menu is disabled with no
  project open; the chapter now states this prerequisite.
- A 480 PPQ MIDI fixture placed two notes at beats 1 and 3. The packaged
  MIDI Import Settings dialog accepted Instrument ID `3` and a custom
  template ending in `77`. Without Trim, the imported GenericScore began at
  beat 0 with local notes at 1 and 3. With Trim, it began at beat 1 with local
  notes at 0 and 2; both notes retained their pitch, velocity, and final
  template field.
- The final 35-page manual rendered and was installed in the rebuilt macOS
  package. The installed Tools and Importing HTML contains the corrected text.
  Packaged metadata, runtime resources, project round-trip, and incompatible
  engine smoke modes passed. `pnpm test`, `pnpm lint`, targeted Code Repository
  and startup tests, Prettier, and `git diff --check` passed.

## Packaged UDO checks (2026-09-29, macOS arm64)

- Importing a disposable full `.csd` through **Import → Csound UDO** added
  `ManualDouble` and `ManualQuad` in declaration order. The second definition
  retained its call to the first.
- Converting `ManualDouble` from Classic to Modern moved `kValue` from its
  `xin` line into named input arguments. Undo restored the Classic fields and
  body; Redo restored Modern. Generate CSD to Screen succeeded and emitted
  `opcode ManualDouble(kValue):k` before the dependent `ManualQuad` definition.
- A project UDO copied into the isolated user library through the preload
  contract. In the UI, Libraries **Copy** followed by project UDO **Paste**
  inserted an independent definition with the same name. The packaged
  drag-session preview/apply contract also inserted it; Undo removed the
  insertion and Redo restored it. These drag checks exercised the preload
  contract, rather than a native mouse drag gesture.
- A separate fixture contained project and embedded `ManualGain` definitions
  with different bodies. Generated CSD retained the project definition,
  renamed the embedded one to `uniqueUDO0`, and updated its dependent
  `ManualWrapper` call. Canonical project/instrument names and bodies stayed
  unchanged. Source comparison with Java Blue's `UDOUtilities` confirmed the
  collision algorithm; the UDO chapter now explains this behavior and the
  separate project-list insertion rule. Archived screenshots and links remain
  historical-only.
- The revised 35-page manual rendered successfully and was installed in the
  refreshed macOS package. The installed UDO HTML contains both name-handling
  rules. Packaged metadata, runtime resources, project round-trip, and engine
  mismatch checks passed; formatting and `git diff --check` passed.

## Extended packaged ledger checks (2026-09-29, macOS arm64)

- Exercised all 17 documented Note Processors with three-note projects; verified
  seeded random repeatability, Python mutation and syntax/runtime failures,
  line interpolation/hold and malformed/out-of-range input, and TimeWarp
  duration conversion. Switch rejects the final field, matching Java Blue;
  its valid six-field swap passed and the chapter now records the restriction.
- Seven historical example copies generated CSD: LineObject, Tracker, PianoRoll,
  PatternObject/Instance, Python ObjectBuilder, PythonObject/PythonProcessor,
  and ClojureObject, with Java project versions from 0.106 to 2.4 beta.
- Global Score variable substitution and selected-range tempo conversion passed.
  At render start 4 under 120 BPM, RENDER_START_ABSOLUTE was 2 seconds.
  The long Global Score event did not increase TOTAL_DUR.
- Blue Live set capture/recall, manual triggering, saved sets, and Repeat passed.
  Tempo 120/Repeat 1 produced event intervals 500, 495, and 505 ms. Live Code
  initially exposed M28: a temporary native compile pause published STOPPED.
  The native integration regression failed before the fix and passed afterward.
  The rebuilt package evaluated orchestra and score code while retaining its
  Blue Live session; the same check passed during ordinary realtime playback.
- A Csound compile failure during freeze preserved the source and left no media.
  A successful retry in the same app session wrote `freeze0.aif` beside a project
  whose path contained spaces. Undo/Redo and unfreeze restored the correct
  canonical source; unfreeze removed the file. A 0.4-second mixer tail extended
  the four-beat freeze to 4.40002 seconds and audition played about 4.59 seconds
  including engine buffering.
- Automation insertion, drag, deletion, Undo, reassignment between SoundObject
  layers, and Track channel assignment passed. Generated CSD used control-rate
  `gk_blue_auto` variables, `line` updates, and mixer `ampdb`.
- BlueX7 SysEx single-voice Cancel/Import/Undo/Redo passed. The bank dialog
  listed 32 voices and importing its second voice matched the encoded data.
  Encoded algorithm/transpose values matched the canonical import. BSB instrument
  library round-trip retained two embedded UDOs and their code, and generated
  collision rewriting remained correct.

- Default Render and Open revealed the rendered WAV in Finder. Reading Finder's
  selected file confirmed `/private/tmp/blue-macos-manual-checks-DG6GGL/override output.wav`,
  matching the successful render result after native temporary-path resolution.
- Refreshed the manual and macOS package; packaged metadata, runtime resources,
  project round-trip, and incompatible-engine checks passed. Root lint passed.
- Root tests reported 5,288 passing app tests and two app failures: the
  64-strip meter latency threshold and Clojure final-entry acknowledgement.
  The Clojure test file passed on a focused rerun; meter timing failed again
  while packaging was active. These results do not constitute a clean full-suite run.
- The initial extended native run exposed an intermittent bus error when the
  new lifecycle regression also submitted a concurrent score event. Kept the
  regression focused on live compilation and stop notifications; score submission
  remains covered by the packaged Blue Live and realtime checks. The focused
  native regression then passed 20 consecutive executions.
- With packaging finished, the isolated meter file passed all three tests. The
  complete five-test Csound integration label passed, including lifecycle stress
  and metering checks. The final root `pnpm test` rerun passed after packaging
  completed, including both earlier failures. Root `pnpm lint`, packaged smoke
  verification, documentation formatting, and `git diff --check` passed.

## Packaged media, keyboard, and dependency checks (2026-09-29, macOS arm64)

- AudioFile Browse used controlled native-picker results for Cancel and selecting
  a stereo WAV. Cancel retained the empty source. Relative `custom assets`,
  blank/default `media`, and absolute media folders received the copied file;
  canonical and saved paths matched each folder's documented policy. Disabling
  Copy Imported Media retained the external source path. The editor displayed
  its 44.1 kHz metadata. These checks exercised Browse/IPC/file copying; the
  native file chooser itself was not driven by desktop mouse events.
- Virtual Keyboard computer keys reached Orchestra assignment 2 in Focused
  Target mode and assignments 1/2 in Direct Channel mode using channels 1/2.
  With no focused target, no diagnostic note reached an instrument.
- PianoRoll Shift-drag created a beat-1.25 note of duration 1.5. Dragging its AMP
  pin changed 1 to 0; native Undo/Redo restored the field without changing
  pitch or timing. Command-A/Delete removed the note and Undo restored it.
  Alt-S toggled snap, Command-plus changed zoom 64 to 72, and Command-Down
  changed note height 15 to 16. Native Undo/Redo key input remains unverified.
- A packaged JSON-dependent ClojureObject failed with a missing namespace before
  Add Library. Adding cached `org.clojure/data.json` 0.2.0 exposed M29: an already
  initialized helper reused its old dependencies. The lifecycle regression failed
  before the cache repair and passed afterward. The rebuilt package generated
  `i1 0.0 1` from JSON after Add Library. Move Up reordered the library rows;
  removal and Redo made generation fail with the missing namespace, Undo restored
  generation, and saving retained the dependency. One run under the full-suite
  CPU load hit a Java transport timeout; the subsequent idle run completed all
  dependency and history steps successfully.
- Validation: the dependency lifecycle regression failed before the fix and all
  six Java-runtime session tests passed afterward. `build:main`, root `pnpm lint`,
  refreshed macOS packaging, packaged smoke verification, formatting, and
  `git diff --check` passed. Root `pnpm test` passed 5,289 app tests and failed
  only the existing 64-strip meter latency threshold; its isolated rerun passed
  all three tests. This run is recorded as a full-suite failure with a successful
  focused rerun, rather than a clean full-suite pass. Six ledger checks remain open.

## Packaged runtime failures and devices (2026-09-29, macOS arm64)

- Focused Track MIDI routing passed: clicking the Track timeline selected its
  owned instrument, and a Virtual Keyboard computer key emitted that instrument's
  diagnostic with the expected mapped pitch/amplitude. Hardware MIDI and audible
  confirmation remain open.
- Unknown instrument testing exposed M30: the old package lost its type/vendor
  payload on save and generated CSD without reporting the missing instrument.
  The new preservation regression failed before repair and passed afterward.
  The rebuilt package showed the actual unsupported type, retained type/vendor
  XML on save, and rejected generation while enabled. Disable allowed generation;
  canonical history IPC Undo/Redo returned committed receipts, restored error/
  success and saved/dirty states, and kept the opaque XML. The history driver
  registered a participant and acknowledged its own empty pending-edit boundary.
- A controlled `java` shim exited unsuccessfully only in the isolated app's PATH.
  The Python instrument remained in the project and CSD generation reported the
  unavailable-runtime error. System Java and the user's application were unchanged.
- Runtime module discovery returned audio modules `jack`, `pa_bl`, `pa_cb`, and
  `auhal`, plus MIDI modules `portmidi` and `coremidi`. AUHAL/CoreMIDI discovery
  returned seven audio input/output devices and no MIDI devices. With software
  buffer 256 and hardware buffer 1024 enabled in an isolated settings profile,
  silent playback reached Playing and engine options contained `-b256 -B1024`.
  These are discovery/launch-option checks, not audible latency tuning.
- A System Events native Generate CSD shortcut targeted the disposable app by
  Unix PID; the automation command timed out. Native key activation remains
  unverified. The desktop UI bridge remains unavailable because of `TIOCSTI`.
- The documented root `pnpm build` completed on this existing macOS checkout.
  The developer chapter now lists the repository prerequisites. The final manual
  render/package and packaged metadata/resources/project/mismatch checks passed;
  installed HTML contains the new unsupported-instrument and prerequisite text.
- Lint initially raced a Quarto rebuild replacing generated JavaScript. Added
  `docs/manual/_build/**` to the existing generated-output ignore list (M31).
  The actual ESLint CLI confirmed that file is ignored.

### Final regression and local shortcut checks — 2026-09-29, macOS

- The first full test run exposed an older InstrumentCategory assertion that
  expected unknown library instruments to be discarded. Updated that existing
  test to require retained name/type and an explicit unsupported-generation
  error, preserving its safeguard against GenericInstrument coercion.
- The final root `pnpm test` passed: data 2,063 tests, app 5,290 tests, CLI
  5 tests, engine client 47 tests, Java/native checks, and root Node checks.
  Existing skipped tests remain skipped. Root `pnpm lint`, formatting of the
  changed category test, and `git diff --check` passed.
- In a fresh isolated packaged profile with silent output, renderer Cmd+T and
  Cmd+Shift+T each emitted exactly one expected Live cell diagnostic. Focus was
  explicitly restored inside Live Space after its busy trigger button rerender;
  a first attempt with focus in Score Object Editor did not trigger Live Space.
- In Live Code, Cmd+Enter evaluated a selected instrument block. After allowing
  live compilation to finish, its score event emitted the expected diagnostic;
  Blue Live remained running and stopped cleanly. This verifies renderer key
  handling, not delivery of physical keys through the native macOS menu.
- Five ledger rows remain open: cross-platform packaged checks, audible/device
  tuning, audible/hardware MIDI Live checks, native/remaining local shortcuts,
  and fresh-install/platform developer setup.

### Instrument Backspace/typing conflict — 2026-09-30, macOS

- The user reported “Document changed elsewhere” while editing the listening
  fixture’s instrument, specifically after Backspace followed by typing.
- The original macOS package reproduced the dialog with Blue Live running:
  append `; draft check abc`, wait for settlement, Backspace, type `d`.
  The editor retained `; draft check abd` but incorrectly opened a conflict.
- The shared SelectedCodeEditor now recognizes acknowledgements of its own
  outstanding submitted text before testing for external draft conflicts (M32).
  Immediate and delayed acknowledgement cases both failed on the original
  source; the repaired cases and existing conflict/history/reconfiguration
  checks passed (26 focused tests). All 5,292 app tests passed, with two existing
  skips. Root lint/formatting, whitespace checks, renderer build, and isolated
  package smoke checks passed.
- A separate package at
  `/tmp/blue-macos-manual-checks-DG6GGL/draft-fix-release/mac-arm64/Blue.app`
  passed the exact typing reproduction with no dialog. Save retained the final
  XML text; Undo restored the preceding deletion and Redo restored the new
  typing without a dialog. Blue Live remained active and stopped cleanly.
  The user’s running package and project were not replaced.

### User confirmation — 2026-09-30, macOS

- The user confirmed text editing works after the M32 repair.
- The user completed the audio-settings walkthrough and reported that all
  changes worked. This closes the macOS audio selection/listening and
  software/hardware buffer comparison check (256/1024 and 512/2048).
- Next: audible Blue Live Repeat cadence and immediate tempo/interval changes.
  Hardware MIDI, native/remaining local shortcuts, and fresh developer setup
  remain unverified; Windows/Linux checks remain deferred.

### User confirmation: Blue Live Repeat — 2026-09-30, macOS

- The user reported that the Repeat walkthrough was already exercised during
  the preceding audio-settings check and worked. Audible cadence at 120 BPM
  and Repeat 1, changing to 60 BPM, changing Repeat to 2, disabling Repeat,
  and stopping the engine are accepted as complete.
- Remaining macOS checks: physical MIDI discovery/routing/note release,
  native and remaining local shortcuts, and fresh-install developer setup.
  Windows/Linux remain deferred.

### User confirmation: macOS MIDI input — 2026-09-30

- Using an external virtual MIDI controller and OS MIDI port, the user reported
  that all steps worked: device discovery/enabling, Focused Target instrument
  selection, Direct Channel 1/2 mapping, note release, and disabling the input.
  The macOS application MIDI input/routing check is complete. Physical USB/DIN
  transport was not part of this run.
- Next: native keyboard shortcuts, followed by fresh-install developer setup.
  Windows/Linux remain deferred.

### Native shortcut automation retry — 2026-09-30, macOS

- The user requested automation of the native shortcut walkthrough. The desktop
  bridge retried initialization and failed with the existing TIOCSTI sandbox
  error.
- Launched the repaired package with a fresh isolated profile and the disposable
  eight-beat shortcut project. A bounded System Events attempt targeted that
  process by PID and sent Cmd+Shift+G. macOS denied it: “osascript is not allowed
  to send keystrokes” (1002). No native shortcut result is claimed.
- The disposable app exited cleanly. Native shortcut checks remain open pending
  working desktop automation/Accessibility authorization or a human key test.

### Native shortcuts after Accessibility authorization — 2026-09-30, macOS

- After the user enabled Accessibility, native Cmd+Shift+G generated a CSD.
  System Events then exercised the shortcut walkthrough in the repaired package
  using fresh profiles, a disposable eight-beat project, and silent output.
- Passed native New/Open, marker creation, Undo/Redo, Save, marker navigation,
  loop on/off, both CSD outputs, F9 start/stop, selected-object Audition,
  disk render, Render to Disk and Play, and Close Project.
- Open/save picker responses used controlled temporary paths. The successful
  marker setup clicked the real Score ruler; an earlier driver attempted an
  invalid unscoped IPC mutation and is not counted as product evidence.
- CSD-to-file wrote 1,960 bytes. Disk-render WAVs completed at 1,411,244 bytes.
  Audition published its auditioning preparation, reached Playing, and stopped
  with F9. Render-and-play published completed/action=play; the Audio File
  Player loaded the matching blue-audio URL, reported duration eight seconds,
  and advanced playback beyond 0.1 seconds.
- Driver follow-ups corrected object selection through the timeline’s hit
  surface and decoded the player’s base64url path. The player’s render dialog
  prevented a cleanup-button click, so cleanup pauses the disposable audio
  element directly. Those driver issues are not application failures.
- Remaining macOS work: Tracker local shortcuts and fresh-install developer
  setup. Windows/Linux remain deferred.

### Tracker local shortcut automation — 2026-09-30, macOS

- Opened a disposable 16-step Tracker project in the repaired macOS arm64
  package with a fresh isolated profile. Compared the help panel's 14 bindings
  with actual canonical Tracker note data after each key action.
- Passed tie-cell Space, Ctrl+T, Ctrl+Space duplicate/clear, Ctrl+Shift+Space
  OFF toggle, Ctrl+Up/Down value changes, Ctrl+C/X/V whole-note copy/cut/paste,
  Delete and row advance, Ctrl+K keyboard-note mode, Ctrl+Shift+Up/Down octave,
  and `?` help. Keyboard `z` entered 8.00, advanced focus, and entered 9.00
  after raising the octave.
- These Ctrl combinations were delivered to the focused packaged renderer by
  Playwright. System Events also verified native macOS Cmd+T/C/X/V plus
  project Cmd+Z, Cmd+Shift+Z, and Cmd+S. OS-reserved Ctrl combinations were
  not exercised through native macOS dispatch. Project Undo/Redo restored
  the deleted note and preserved its object identity and dirty state.
- An additional Escape check exposed M33: clearing React draft state before
  blur left the DOM holding the cancelled value, which blur committed.
  Java's Tracker uses Swing cell-edit cancellation. Restoring the canonical
  DOM value before blur prevents the unintended project patch. The regression
  failed before the repair and passed afterward; all 5,293 app tests passed
  with two existing skips.
- The rebuilt package passed Enter commit, arrow navigation, and Escape
  cancellation: a draft of 99 returned to the committed 42 without a history
  entry. Native Save wrote a 14,487-byte project; reopening retained the final
  canonical notes, including 42. No renderer page errors occurred, and the
  disposable app exited cleanly. The first driver run focused a text cell
  for project Undo; moving focus to the Score ruler verified project history.
- Evidence: `/tmp/blue-macos-manual-checks-DG6GGL/tracker-shortcuts-fixed.log`,
  `tracker-escape-regression-before.log`, `tracker-escape-regression-after.log`,
  and `tracker-app-tests.log`. The driver is `tracker-shortcuts.js` in that
  directory; the repaired package is under `tracker-fix-release/`.
- Remaining macOS work: fresh-install developer setup. Windows/Linux checks
  remain deferred at the user's request.

### Fresh-clone developer setup — 2026-09-30, macOS arm64

- Created an independent Git clone with `--no-hardlinks` from the local feature
  branch at `7985f4e072aaacc4ff4d7e0450a9b302e6dc4213`, then applied the current
  binary diff and copied 268 non-ignored untracked source files. No source
  commit or push was made. Confirmed the clone initially had no node_modules,
  package dist/target outputs, local vcpkg checkout/installed dependencies, or
  generated manual output.
- Installed with pnpm 12.8.1 and `--frozen-lockfile` into an empty store:
  640 packages, zero reuse. Used fresh Maven, Electron, and vcpkg download
  caches; disabled vcpkg binary-cache reuse and unset the existing VCPKG_ROOT.
  The native build bootstrapped revision
  `9d7f79f56ae1a9b4704d6a7fb8237e347a974133` inside the clone.
- Host tools were already installed: Node 22.23.1, Java 17.0.15 selected for
  this run, Maven 3.9.16, CMake 4.4.3, Apple Clang 15, and Quarto 1.10.18.
  This verifies fresh repository/dependency/build setup on macOS; it does not
  verify prerequisite installation on a blank OS or any Windows/Linux setup.
- `pnpm build` and root `pnpm test` passed. The test run included 14 native
  CTest cases, Java tests, 2,063 data tests, 47 engine-client tests, 5 CLI tests,
  5,293 app tests, and 59 root script tests; existing skips remained.
- Root lint exposed M34: ESLint scanned the freshly bootstrapped vcpkg tree
  while the native test build replaced a directory, causing ENOENT. Added
  ignores for `.vcpkg`, `vcpkg_installed`, and native `build-*` directories,
  matching their existing formatting exclusions. Root lint then passed in
  the clone. No new production runtime behavior was changed.
- Quarto rendered all 35 chapters. The contributor `package:dir` command
  built an unsigned macOS arm64 app, and `verify:packaged-app` passed metadata,
  Java/Python/native module resources, project load/save, recoverable missing
  Csound, and rejection of an incompatible engine while keeping the project
  open. The verifier fell back to its plain-spawn route after Playwright's
  quick-exit verification process could not be attached; both routes reported
  successful verification.
- The clone's downloaded Electron runtime launched the newly built source app
  with isolated user data. A valid minimal GenericInstrument/GenericScore
  project opened, generated CSD, and saved with no renderer or generation
  errors. The app exited cleanly. The default widget smoke fixture loads but
  includes a JavaScriptObject calling unsupported `console.log`; it was not
  used as the successful CSD-generation fixture.
- Driver corrections: created the vcpkg download directory before bootstrap,
  removed the driver's CI flag because CI intentionally rejects the uncommitted
  snapshot, and matched `openFilePath`'s returned path rather than a Boolean.
  These were harness issues, not repository setup failures.
- Clone, cache, package, snapshot metadata, and logs:
  `/var/folders/dx/bsm6vg8x3vx6l4_4tjrs_pcw0000gn/T/blue-fresh-install-uzn9pdt9/`.
  Driver scripts: `/tmp/blue-fresh-install-run.py` and
  `/tmp/blue-fresh-install-start.cjs`. The initial source diff SHA-256 is
  `e5387e34b2de2cb9744b3dfb6860fbf57b9e59f3bb2359665f1578e9eed5c99e`;
  M34 and the final developer documentation were synchronized afterward.
- The macOS manual procedure ledger is complete. Windows/Linux checks remain
  deferred at the user's request; physical USB/DIN MIDI transport and blank-OS
  tool installation were not part of the accepted macOS run.

## External baseline and current screenshots (2026-09-30)

- Replaced the duplicated original with immutable upstream provenance, kept local author credits/license, verified the 94-topic map and wrote `manual-changes.md` for all 35 current files.
- Captured eight actual current UI screenshots in an isolated macOS package. Added captions, descriptive alternative text, explicit Quarto resources and `images/README.md` provenance.
- Added `offline-fonts.scss` for both light/dark themes after the network-blocked browser check exposed remote theme font imports. Both themes now use system fonts.
- Quarto rendered all 35 chapters. Local and installed scans checked 2,461 references and eight images, including anchor existence, alternative text and byte identity. No duplicate original source or image tree remains.
- Built an unsigned macOS arm64 directory package at `/tmp/blue-manual-screenshots-package/mac-arm64`; package inputs and packaged metadata/runtime/project/engine-mismatch checks passed. The smoke verifier used its native spawn fallback when the fast verification process exited before Playwright attached.
- Browser verification loaded all eight image-bearing chapters over `file://` from both source output and installed resources with HTTP requests blocked. Every image had a nonzero natural width; local index-to-Score navigation passed and there were zero background network requests.
- `pnpm lint`, targeted Prettier checks and `git diff --check` passed. No application code changed in this update, so the preceding fresh-clone full test run was reused.
