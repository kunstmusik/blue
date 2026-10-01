# Manual issues

**Integration complete for the accepted scope (2026-09-30).** Final convergence
found no new implementation gaps; the code review's P2 is repaired. The
unchecked validation below remains deferred, with no platform or hardware pass
implied. See `spec.md`, `quickstart.md` and `code-review.md`.

All 94 original Java Blue source topics have a disposition in the current
35-chapter Blue 3 book. This review used the Blue 3 model, generation paths,
menus, and editor source. It did not exercise every control in a packaged app.
The [original edition](https://github.com/kunstmusik/blue-manual/tree/7a92066a2aa8f0370026ba9527c158643c2935a1) is available upstream.
Source paths in the topic map are relative to that pinned commit.
See [chapter textual changes](manual-changes.md).

## Cross-cutting follow-up

The user deferred the remaining validation work on 2026-09-30 (T122/T123/T132).
These checks remain incomplete; this records acceptance to move forward, not a
validation pass. Expanded screenshot/diagram coverage is also deferred; the
current eight-image set is accepted, with the coverage difference recorded in
`manual-changes.md`.

Windows/Linux verification is deferred at the user’s request (2026-09-29):
no suitable machines are currently available. Platform references below remain
unverified; resume those checks when access is available. Remaining macOS checks are recorded below; the fresh-clone developer check is complete.
Installing prerequisites on a blank OS was not exercised.

- [x] Account for every original chapter and remove unreviewed draft routes from the active book source.
- [x] Identify unsupported or changed legacy features in current chapters instead of publishing their old directions as Blue 3 instructions.
- [x] Opened the Blue Manual from a built app with networking offline; the user confirmed local navigation worked. That earlier observation verified pages and navigation; the 2026-09-30 image check now also verifies all eight current screenshots locally and from installed resources. A rebuilt macOS package has Help as the final native menu after Window, containing Blue Manual; its installed manual index is present.
- [ ] Walk complex procedures in packaged macOS, Windows, and Linux builds; correct text where platform behavior differs. The macOS arm64 package contains the current 35-page manual, and package-input validation passes. Playwright launched the packaged app with isolated user data and exercised its renderer controls and preload API for the checks recorded below, including freeze and selected-range rendering. The desktop UI bridge still fails with `TIOCSTI`; Playwright provided the macOS interaction route. Windows/Linux package checks are deferred.
- [x] Added eight reviewed Blue 3 screenshots for Score, Orchestra, Mixer, PianoRoll, PatternObject, Project SoundObjects, Blue Live, and Settings, with captions, alternative text and capture provenance. All eight images loaded under `file://` with HTTP requests blocked in both the clean render and unsigned macOS package. Local navigation passed; system fonts eliminate background network requests.
- [x] Checked current external links against the Blue repository and the official Csound download page. Removed the misleading implication that the current Releases page already has Blue 3 packages; no third-party download is recommended.
- [x] Defer online publication until a Blue 3 destination and versioning policy are chosen. The installed `file://` book remains primary and has search disabled because browser fetch rules can block local `search.json`.

The first-project tutorial is accepted for this integration based on its
earlier packaged run and the user's decision to rewrite it separately.
Generate CSD to Screen and Render to Disk worked in that earlier run; no new
walkthrough is required for this feature.

## Confirmed application gaps and compatibility dispositions

These findings come from the current implementation and Java comparison. A
source finding does not stand in for a packaged-app reproduction on every
platform. The chapters describe the behavior users can rely on today.

| ID  | Current behavior                                                                                                                                                                                                                                                                                                               | Desired behavior                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M11 | Legacy key/MIDI integers are preserved on Live cells; neither Java Blue nor Blue 3 exposes assignments or dispatches cells from those values.                                                                                                                                                                                  | Resolved: document them as compatibility metadata; new trigger assignments require a separate feature decision.                                                                                                                                                                     |
| M15 | PianoRoll **Properties** now edits scale `baseFrequency` through ProjectHistory.                                                                                                                                                                                                                                               | Resolved: Enter/focus loss commits; invalid values revert; negative values clamp to zero, matching Java Blue.                                                                                                                                                                       |
| M16 | Direct AudioFile/FrozenSoundObject placements and direct Instances translate seek offsets through the tempo map. A linked Instance can also translate a selected window when it and its flat PolyObject source use `TimeBehavior.NONE`, neither has a Note Processor chain, its SoundLayers have no processor chains, and every active direct child proves a stable origin within its declared span. This is a TypeScript extension to Java Blue's positional range handling. | Partial: packaged direct AudioFile playback and matching direct/frozen selected-range output are confirmed. Dynamic JavaScript/Python sources, nested or transformed compositions, processor-bearing sources, and out-of-span GenericScore notes retain the existing behavior. |
| M17 | Blue 3 raises `NoteParseException` with the source line and text for malformed recognized `i` events, matching Java Blue; other score statements remain ignored.                                                                                                                                                               | Resolved: packaged Generate CSD displayed the line-3 `i1 0` error; corrected and shorthand input generated the expected events. Parser and sync/async tests cover the underlying behavior.                                                                                     |
| M18 | Historical label-only repair: renamed 29.97 as non-drop while retaining clock-plus-fraction arithmetic. | Superseded by Spec 115: exact rational physical rates and explicit NDF/DF counting. The earlier packaged result (60.033 seconds for `00:01:00:01`) did not verify standard NDF; corrected 29.97 NDF entry is 60.093366666… seconds. |
| M19 | A finite render range can drop notes from a nested PolyObject because its note starts are placed on the parent timeline before comparing them to the child-local end.                                                                                                                                                          | Resolved: filter note starts against the child-local end before adding the PolyObject start and rebasing. Sync/async regressions cover the nested boundary; this intentionally fixes the same ordering bug in Java Blue.                                                            |
| M21 | After running Blue Live, reverting a project, and playing the timeline several times, the user reported that Cmd+Q did not respond. The console repeated Electron's `representedObject is not a WeakPtrToElectronMenuModelAsNSObject` message. | The user reports quit now appears to work. Source review found that an open Settings window could veto `app.quit()`; the quit path now waits for its save/discard/cancel decision, and transition exceptions are logged. The original sequence has not been reproduced under observation, so the cause remains unconfirmed. |
| M22 | During the quit retest, Electron reported `No handler registered for 'unified-library:browse'`. Shutdown removed library IPC handlers while renderer windows were still open and able to refresh. | Resolved in the macOS package retest: a loaded project browsed Libraries successfully, then normal quit and a second quit with repeated browse requests both exited with code 0 and no missing-handler error. The original Blue Live/revert sequence remains unobserved. |
| M23 | After startup and opening a project, Node reported 11 `destroyed` listeners on a `WebContents`. The history availability IPC handler installed a new one for every availability update; history participant registration also installed one per registration. | Resolved: one cleanup listener per `WebContents` now clears its availability and all owned history participants. Main TypeScript, lint, and 64 focused history/IPC tests passed; the user repeated startup and project opening without the warning. |
| M24 | The packaged renderer requested `code-repository:get-snapshot` and `code-repository:get-status` before main registered their IPC handlers, producing console errors at startup. | Resolved: start the Code Repository stage before creating the first window. The rebuilt package opens a project without either handler error; the focused startup and Code Repository IPC tests pass. |
| M25 | A nested PolyObject rebased selected-range notes before its parent applied the same render start, dropping valid events from a finite range. | Resolved: nested containers defer selected-range rebasing to their outer PolyObject. A failing-then-passing sync/async Score regression covers a PolyObject at beat 8 with child notes at local beats 1 and 1.5 in range `[9,10]`. The rebuilt macOS package emits them at 0 and 0.5, including a second check with the container at beat zero. This corrects the same behavior in Java Blue. |
| M26 | The packaged Code Repository client looked for `code-repository-worker.js` beside the compiled client, but the TypeScript build emits `repository-worker.js` there. The service was unavailable on fresh startup. | Resolved: select the worker filename produced by the active build. A rebuilt macOS package migrated the existing Java Blue XML in a fresh profile, then created, exported, and imported a snippet across two isolated profiles. Retry now clears a stale migration diagnostic when an initialized repository is skipped. |
| M27 | The first renderer window could request unified Libraries before their service started, leaving the Effects Library panel showing “Libraries are not ready.” | Resolved: start unified Libraries before creating the first window. A rebuilt macOS package opened the Effects tree and an imported effect editor without the startup error. |
| M28 | Live orchestra compilation paused the perform thread and published a terminal STOPPED event, making Blue Live and realtime consumers tear down the session despite successful compilation. | Resolved: preserved-performance joins do not publish terminal stops; a failed binding rebuild still reports failure. A native integration regression failed before the fix and passed after it. The rebuilt package compiled a new instrument and accepted its score event while Blue Live and realtime playback stayed active. |
| M29 | Adding Clojure dependencies after the Java helper started left evaluation/render using its previous classpath. | Resolved: ready-session caching includes the canonical dependency list; changes recreate the helper, including removal and Undo/Redo. The lifecycle regression failed before the fix and passed afterward. The rebuilt package failed without `org.clojure/data.json`, generated its JSON-derived note after Add Library, failed after removal/Redo, and generated again after Undo. |
| M30 | Unknown instrument types opened as empty assignments, were silently omitted from CSD, and lost their original XML on save. | Resolved: retain unknown instruments as opaque XML with independent copying and metadata edits; enabled unknown instruments fail generation with their actual type. The regression failed before the fix and passed afterward. Packaged save retained vendor data, Disable allowed generation, and canonical Undo/Redo restored error/success and dirty state without losing the XML. Unlike Java Blue's missing-class load failure, Blue 3 deliberately opens and preserves these instruments. |
| M31 | Root lint scanned generated Quarto assets and failed with ENOENT when a simultaneous manual rebuild replaced one of those files. | Resolved: exclude `docs/manual/_build/**` alongside other generated output. The actual ESLint CLI confirmed the generated JavaScript is ignored; root lint passed after the change. |
| M32 | Typing immediately after Backspace opened “Document changed elsewhere” in the instrument editor even with no other view editing the field. The operation boundary submitted the deletion while newer typing was already visible, and the editor classified its own submitted value as an external conflict. | Resolved: recognize outstanding submitted values before checking for external conflicts, retain newer local text, and retire acknowledged values. Immediate/delayed acknowledgement regressions failed before the fix and passed afterward; existing genuine conflict decisions still pass. A separate macOS package reproduced the original dialog, then saved the full edit and completed Undo/Redo without a conflict after the repair while Blue Live ran. The user confirmed text editing works on 2026-09-30. |
| M33 | Escape in a Tracker cell cleared its draft state, then blur read the old DOM value and committed the cancelled text. | Resolved: restore the canonical cell value before blur. The focused regression failed before the fix and passed afterward. The rebuilt macOS package cancelled 99 back to 42 without a history entry, saved 42, and retained it after reopening. Java Tracker uses Swing cell-edit cancellation. |
| M34 | A first native build bootstraps vcpkg inside the repository, but ESLint scanned its generated third-party tree. Concurrent native tests removed a scanned directory, failing root lint with ENOENT. Existing-checkout runs using external vcpkg did not expose this. | Resolved: exclude the local vcpkg checkout, installed native dependencies, and native build directories from ESLint, matching existing formatting exclusions. The fresh-clone root lint failed before the repair and passed afterward. |

Research Decision 21 records the M16 disposition: dynamic, nested,
transformed, processor-bearing, and out-of-span sources keep their current
range behavior because the present generation interfaces cannot provide a
safe pre-pruning origin without repeated execution or changed ordering.
Future expansion needs a separate feature contract.

The user confirmed direct AudioFile selected-range playback in the built macOS
app: it behaved correctly, and changing the tempo changed the portion of the
file heard. This completes the direct AudioFile audible check for M16.
On 2026-09-28, an isolated macOS package run opened a disposable project with
an AudioFile at beat 2, a 120-to-60 BPM change at beat 4, and selected range
`[6,8]`. The app froze the object and rendered the range before and after
freezing. Both stereo files were 2.000023 seconds long and contained the
expected 550 Hz then 660 Hz source segments; their sample correlation was
1.0. The frozen object's realtime command reported `playing via blue-engine`
and then `Playback finished`. This verifies the packaged render and playback
startup paths. The user accepted the captured frozen render as sufficient
evidence. Realtime speaker output was not recorded; T115/T128 use the
accepted render plus realtime engine status as their packaged evidence.

The macOS directory package contains all 35 manual pages. Its metadata,
resource, project round-trip, and incompatible-engine smoke stages pass.
Windows and Linux package interaction remains untested here.

### Resolved application issues

- **M03 — marker-only ruler conversion:** `applyScoreTimeStatePatch` now honors
  **Update Markers** when **Update ScoreObjects** is cleared. The new
  `markers-parity.test.ts` regression failed before the fix and passes with
  the ruler configuration suite (33 tests). The Time chapter now explains
  the independent choice.
- **M04 — SMPTE text frame rate:** Score Object time context now carries the
  project's selected frame rate, and the Markers and Tempo Map editors pass
  it to the text parser and formatter. The new editor-contract regression
  failed at 30 fps before the fix and passes with the time-unit and marker
  suites (174 tests). Subsequent tempo-map changes are covered by M14 below.
- **M05 — hidden PatternObject triggers:** Resizing **Beats** now keeps only
  the still-visible step prefix; changing **Sub** clears steps, matching Java
  Blue's `setTime` rule. Generated notes are bounded by the visible grid even
  for older mismatched row data. Model regressions failed before the fix and
  now pass (2 tests); the owner patch and editor preview agree (16 editor
  contract tests), and the patch round-trips through ProjectHistory with a
  stable SoundObject ID. The PatternObject chapter states the resize rule.
- **M06 — PianoRoll note template copy/paste:** The shared clipboard and
  editor copy/paste now carry each note's template override. The clipboard
  regression failed before the change and passes with the PianoRoll parity
  suite (8 tests). The PianoRoll chapter describes the preserved override.
- **M07 and M14 — End Time and tempo-aware clock entry:** The properties form
  formats End Time in the selected Start Time base. Time, Seconds, SMPTE, and
  sample-frame entry now use the complete project tempo map. Regressions
  failed before the fixes and pass with the time and editor suites (177 tests),
  including a later tempo point and a formatted End Time. The SoundObjects
  and Time chapters describe the corrected behavior.
- **M09 — AudioFile properties:** Score Object Properties now omits Time
  Behavior and Note Processor controls for AudioFile because its playback
  generator does not apply either. The focused form regression failed before
  the change and passes; the AudioFile chapter explains the control scope.
- **M10 — inactive external play preferences:** Disk Render Settings no
  longer shows the unused external play toggle and command. Saved values
  remain readable; the usage registry marks them retained and inactive.
  The usage regression failed before the change and passes. The Settings
  chapter explains the in-app player and external open command.
- **M02 — JavaScript Instrument generation:** Synchronous and async CSD
  generation now evaluate the script and use its `instrument` string as the
  orchestra body. Direct generation and full CSD tests failed before the
  change and pass now (4 instrument tests). The Instruments chapter shows
  the expected script shape and runtime limit.
- **M12 — Project SoundObjects deletion:** The confirmation and manual now say
  the deletion can be undone while the project is open. A real ProjectHistory
  commit, undo, and redo restored and removed both the definition and linked
  Instances, preserved their identities, and tracked dirty state (3 library
  editing tests pass).
- **M08 — Instance placement timing:** The linked source generates first;
  Instance now normalizes its notes, runs its processor chain, applies its own
  Time Behavior within Subjective Duration, and adds its Score start. This
  matches Java Blue's `Instance.processNotes`. The model regression failed
  before the fix and passes for GenericScore sync/async and runtime-generated
  JavaScriptObject notes (8 Instance tests). A ProjectHistory commit→undo→redo
  verifies duration, Repeat, stable identity, generated starts, and dirty state.
- **M01 — Blue Live global Repeat:** Restored the Repeat interval field and
  toggle, and completed the scheduler. While Blue Live runs, enabled cells are
  retriggered every `Repeat × 60 ÷ Tempo` seconds; tempo/count edits update the
  schedule through runtime reconciliation. The schedule stops when Repeat is
  disabled or the session stops. Controller, runtime-reconciliation, and panel
  regressions cover cadence, lifecycle, patch routing, and visible controls.
  A packaged audible cadence check remains in the Blue Live validation item.
- **M11 — historical LiveObject key/MIDI metadata:** Java Blue's `LiveObject`
  declares, copies, and serializes these fields, but the Java UI has no
  assignment controls or runtime consumers. Blue 3 preserves them for XML
  compatibility and likewise does not assign or dispatch them. The Blue Live
  chapter now distinguishes this metadata from Blue 3's separate live MIDI
  input-device preferences. This is not a Java parity gap.
- **M13 — first-project Track add after instrument edit:** The Track context
  menu now settles pending project patches and uses the current revision when
  building its Add SoundObject request. The renderer regression covers the
  revision change during settlement; ProjectHistory's Track add fixture
  already covers commit→undo→redo and stable identity. Two fresh packaged
  macOS profiles retained the instrument edit and GenericScore as separate
  history entries, and the object opened for editing. A packaged CSD contained
  the edited instrument and score event at beat 0.6, matching the clicked
  placement plus the event's relative start. Render to Disk produced an
  811,564-byte WAV from this project.
- **M15 — PianoRoll Base Frequency control:** Properties now edits the nested
  scale value and commits it with the `Set PianoRoll Base Frequency` ProjectHistory
  label. The editor uses Java Blue's Enter/focus-loss commit, invalid-input
  restore, and negative-value clamp behavior. A focused UI regression covers
  those input cases; a real ProjectHistory commit→undo→redo regression checks
  the canonical scale value, retained note and target, and dirty state. The
  PianoRoll chapter documents the control.
- **M20 — PolyObject objective duration with runtime-generated material:** The
  command now generates the selected PolyObject asynchronously in the main
  process, including Java-backed children and processors, measures the emitted
  notes in beats, and commits that concrete value through ProjectHistory.
  Missing Java and stale project revision/session results leave project data
  unchanged. Focused regressions cover a child PythonProcessor, stale revision
  and session changes, and history commit→undo→redo. Packaged-app behavior is
  verified in the macOS package with a child PythonProcessor: the command changed
  the PolyObject from four to six beats, and native-menu undo/redo restored four
  then six beats. The 2026-09-30 code review also found and repaired a missing
  JavaScript session for children: the command now consumes project on-load
  variables, with a failing-then-passing real-runtime regression. The measurement,
  fence and history suites pass 160 tests; cold-process generation without a
  supplied session also passes. See `code-review.md`. Other conversion cases
  remain in the validation item below.
- **M16 — file-backed selected-range offsets (partial):** Direct AudioFile and
  FrozenSoundObject placements and direct Instances use the project tempo map
  for Csound's seconds-based seek. A linked Instance can also use a flat
  PolyObject when it and the Instance have `TimeBehavior.NONE`, neither has a
  note processor chain, the source SoundLayers have no processor chains, and
  every active direct child provides a range-independent origin. For
  GenericScore, each parsed note must stay within the object's subjective
  duration. For a source
  event at beat 2, file leaves at beat 4, and Instance range `[3,5]`, sync and
  async tests verify that the SoundLayer is queried over `[5,7]` and the file
  generators receive object-relative overlap `[1,3]`; the seek is one beat and
  the file duration is two beats. This bounded linked-source behavior
  intentionally extends Java Blue's positional range handling. Dynamic
  JavaScript/Python sources, nested containers, transformed/repeated sources,
  and processor-bearing compositions keep the existing path because their
  origins cannot be established safely before range pruning. Out-of-span
  GenericScore notes also keep the existing path: an event at beat 2 with
  subjective duration 2 is pruned when the selected range starts at beat 3,
  leaving file leaves at their legacy seek and duration. A sync/async regression
  now protects this behavior. Whether a future range-aware contract should
  translate an event outside its declared span remains open. The user heard
  direct AudioFile playback and accepted the captured frozen selected-range
  render from the packaged app; realtime frozen playback reached the engine's
  playing and finished states without a speaker recording.
- **M17 — malformed GenericScore events:** Too-short or malformed recognized
  `i` rows now raise Java-compatible `NoteParseException` with line number and
  source text. Parser tests cover shorthand and sync/async generation. In a
  rebuilt macOS package, Generate CSD displayed a toast with line 3 and the
  `i1 0` text. Changing that line to `i1 1 1` produced both expected events;
  a separate `i1 + 1 .` input reused the prior field and advanced the start.
  Source tracing also confirms disk render shows parser errors in its failure status.
- **M19 — nested PolyObject finite range:** Sync and async generation now checks
  note starts against the child-local end before adding the PolyObject's Score
  start and rebasing. Regression tests retain an event at beat 9 for an outer
  `[0,10]` range and omit one at beat 12. Java Blue has the same old ordering;
  Blue 3 intentionally corrects this local-coordinate bug.

## Source and route accounting

There are 94 upstream Blue 2 `.qmd` pages. All are represented by one of 35 current
Blue 3 chapters; multiple short references converge on shared pages.
A mapping means the topic was reviewed and given a current disposition,
not that every archived detail was carried over. Historical-only entries
are identified below and in their destination chapters. The original
source remains available in the pinned upstream Blue 2 edition.

| Upstream source                                                      | Current chapter                | Disposition           |
| -------------------------------------------------------------------- | ------------------------------ | --------------------- |
| `appendixA.qmd`                                         | `reference.qmd`                | Current guidance      |
| `appendixB.qmd`                                         | `reference.qmd`                | Current guidance      |
| `bestPractices.qmd`                                     | `reference.qmd`                | Current guidance      |
| `concepts/commandBlocks.qmd`                            | `command-blocks.qmd`           | Current guidance      |
| `concepts/noteProcessors.qmd`                           | `note-processors.qmd`          | Current guidance      |
| `concepts/parameterAutomation.qmd`                      | `parameter-automation.qmd`     | Current guidance      |
| `concepts/polyObjects.qmd`                              | `polyobjects.qmd`              | Current guidance      |
| `concepts/rendering.qmd`                                | `rendering.qmd`                | Current guidance      |
| `concepts/soundObjectLibrary.qmd`                       | `soundobject-library.qmd`      | Current guidance      |
| `concepts/soundObjects.qmd`                             | `soundobjects.qmd`             | Current guidance      |
| `concepts/timeSystem.qmd`                               | `time.qmd`                     | Current guidance      |
| `credits.qmd`                                           | `about.qmd`                    | Current guidance      |
| `developers/core/building.qmd`                          | `developer.qmd`                | Current guidance      |
| `developers/core/top.qmd`                               | `developer.qmd`                | Current guidance      |
| `developers/extending.qmd`                              | `developer.qmd`                | Current guidance      |
| `developers/top.qmd`                                    | `developer.qmd`                | Current guidance      |
| `gettingStarted/installation.qmd`                       | `installation.qmd`             | Current guidance      |
| `gettingStarted/otherFeatures/auditionSoundObjects.qmd` | `workflow-features.qmd`        | Current guidance      |
| `gettingStarted/otherFeatures/autoBackup.qmd`           | `workflow-features.qmd`        | Historical limitation |
| `gettingStarted/otherFeatures/blueVariables.qmd`        | `workflow-features.qmd`        | Current guidance      |
| `gettingStarted/otherFeatures/commandLine.qmd`          | `workflow-features.qmd`        | Historical limitation |
| `gettingStarted/otherFeatures/importCSD.qmd`            | `importing.qmd`                | Current guidance      |
| `gettingStarted/otherFeatures/importMIDI.qmd`           | `importing.qmd`                | Current guidance      |
| `gettingStarted/otherFeatures/programScripts.qmd`       | `workflow-features.qmd`        | Historical limitation |
| `gettingStarted/otherFeatures/soundObjectFreezing.qmd`  | `workflow-features.qmd`        | Current guidance      |
| `gettingStarted/primaryEditors/blueLive.qmd`            | `blue-live.qmd`                | Current guidance      |
| `gettingStarted/primaryEditors/globalsManager.qmd`      | `globals.qmd`                  | Current guidance      |
| `gettingStarted/primaryEditors/mixer.qmd`               | `mixer.qmd`                    | Current guidance      |
| `gettingStarted/primaryEditors/orchestraManager.qmd`    | `orchestra.qmd`                | Current guidance      |
| `gettingStarted/primaryEditors/projectProperties.qmd`   | `project-properties.qmd`       | Current guidance      |
| `gettingStarted/primaryEditors/scoreTimeline.qmd`       | `score.qmd`                    | Current guidance      |
| `gettingStarted/primaryEditors/tablesManager.qmd`       | `tables.qmd`                   | Current guidance      |
| `gettingStarted/primaryEditors/udoManager.qmd`          | `udos.qmd`                     | Current guidance      |
| `gettingStarted/programOptions.qmd`                     | `settings.qmd`                 | Current guidance      |
| `gettingStarted/tools/blueShare.qmd`                    | `tools.qmd`                    | Historical limitation |
| `gettingStarted/tools/codeEditor.qmd`                   | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/codeRepository.qmd`               | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/csoundrcEditor.qmd`               | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/effectsLibrary.qmd`               | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/ftableConverter.qmd`              | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/pythonConsole.qmd`                | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/scannedMatrix.qmd`                | `tools.qmd`                    | Historical limitation |
| `gettingStarted/tools/soundFontViewer.qmd`              | `tools.qmd`                    | Current guidance      |
| `gettingStarted/tools/userTools.qmd`                    | `tools.qmd`                    | Historical limitation |
| `gettingStarted/usersIntro.qmd`                         | `index.qmd`                    | Current guidance      |
| `glossary.qmd`                                          | `reference.qmd`                | Current guidance      |
| `index.qmd`                                             | `index.qmd`                    | Current guidance      |
| `preface.qmd`                                           | `about.qmd`                    | Current guidance      |
| `reference/instruments/blueSynthBuilder.qmd`            | `instruments.qmd`              | Current guidance      |
| `reference/instruments/blueX7.qmd`                      | `instruments.qmd`              | Current guidance      |
| `reference/instruments/genericInstrument.qmd`           | `instruments.qmd`              | Current guidance      |
| `reference/instruments/javaScriptInstrument.qmd`        | `instruments.qmd`              | Historical limitation |
| `reference/instruments/pythonInstrument.qmd`            | `instruments.qmd`              | Current guidance      |
| `reference/instruments/top.qmd`                         | `orchestra.qmd`                | Current guidance      |
| `reference/noteProcessors/addProcessor.qmd`             | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/equalsProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/inversionProcessor.qmd`       | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/lineAddProcessor.qmd`         | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/lineMultiplyProcessor.qmd`    | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/multiplyProcessor.qmd`        | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/pchAddProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/pchInversionProcessor.qmd`    | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/pythonProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/randomAddProcessor.qmd`       | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/randomMultiplyProcessor.qmd`  | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/retrogradeProcessor.qmd`      | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/rotateProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/subListProcessor.qmd`         | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/switchProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/timeWarpProcessor.qmd`        | `note-processor-reference.qmd` | Current guidance      |
| `reference/noteProcessors/top.qmd`                      | `note-processors.qmd`          | Current guidance      |
| `reference/noteProcessors/tuningProcessor.qmd`          | `note-processor-reference.qmd` | Current guidance      |
| `reference/shortcuts.qmd`                               | `shortcuts.qmd`                | Current guidance      |
| `reference/soundObjects/audioFileObject.qmd`            | `audio-file.qmd`               | Current guidance      |
| `reference/soundObjects/ceciliaModule.qmd`              | `soundobject-types.qmd`        | Historical limitation |
| `reference/soundObjects/clojureObject.qmd`              | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/comment.qmd`                    | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/external.qmd`                   | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/genericScore.qmd`               | `generic-score.qmd`            | Current guidance      |
| `reference/soundObjects/instance.qmd`                   | `instance.qmd`                 | Current guidance      |
| `reference/soundObjects/javaScriptObject.qmd`           | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/jmask.qmd`                      | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/lineObject.qmd`                 | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/objectBuilder.qmd`              | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/patternObject.qmd`              | `pattern-object.qmd`           | Current guidance      |
| `reference/soundObjects/pianoRoll.qmd`                  | `piano-roll.qmd`               | Current guidance      |
| `reference/soundObjects/polyObject.qmd`                 | `polyobjects.qmd`              | Current guidance      |
| `reference/soundObjects/pythonObject.qmd`               | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/sound.qmd`                      | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/top.qmd`                        | `soundobjects.qmd`             | Current guidance      |
| `reference/soundObjects/tracker.qmd`                    | `soundobject-types.qmd`        | Current guidance      |
| `reference/soundObjects/zakLineObject.qmd`              | `soundobject-types.qmd`        | Current guidance      |
| `tasks/addSoundFiles.qmd`                               | `importing.qmd`                | Current guidance      |
| `tasks/createEncapsulatedInstruments.qmd`               | `instruments.qmd`              | Current guidance      |

## Current chapter coverage gaps

These are accuracy, packaged-app, and behavior follow-ups for the 35 current
chapters. A completed source review does not close these independent checks.

- [x] `index.qmd`: Compared the older introduction and user orientation. The current overview links its still-relevant concepts; Instance placement timing now follows the corrected generator described in `instance.qmd` (M08).
- [x] `installation.qmd`: Added current package and Csound 7 setup directions. The archived Java 25, launcher, and Csound API paths do not apply to the basic Blue 3 workflow.
- [x] `first-project.qmd`: A fresh packaged macOS project retained the edited Generic Instrument and GenericScore without a pause (M13); the Score editor opened, Generate CSD to Screen included both the instrument and event at its Track placement, and Render to Disk produced an 811,564-byte WAV. No screenshot was needed to explain these steps.
- [x] `settings.qmd`: Document current General, Project Defaults, Playback, Utility, Realtime Render, Disk Render, MIDI input, and OSC controls, including managed-engine selection, module/device rescanning, custom Csound device identifiers, `-b`/`-B` buffers, output format, and active OSC port. Source review confirms the legacy executable preference is hidden.
- [x] `settings.qmd`: Verify macOS audio device selection and audible buffer behavior in the running packaged build. Unused external play controls were hidden and the registry corrected (M10). Packaged macOS discovery returned four audio modules and two MIDI modules. AUHAL/CoreMIDI discovery returned seven audio inputs/outputs and no MIDI devices. A silent realtime project launched with `-+rtaudio=auhal -odac -b256 -B1024` from an isolated settings profile and reached Playing. The user completed the audio-settings walkthrough on 2026-09-30 and reported that all changes worked, including the software/hardware buffer pairs 256/1024 and 512/2048. Hardware MIDI verification remains in the Blue Live row; Windows/Linux checks are deferred.
- [x] `settings.qmd`: No separate page is needed for every Csound render flag or OSC command. The Settings chapter identifies the Csound options fields and the OSC panel's supported-message table, where Blue's current command list is shown.
- [x] `score.qmd`: Document current layer-group names, Score Manager and inline layer controls, score path, timeline rows, and Track Layer M/S modes.
- [x] `score.qmd`: Checked the current toolbar and layer canvas against the old Navigator/BlueLive directions. Added AudioClip source-offset and pattern-cell actions; identified the absent split-clip command. Current keybindings live in `shortcuts.qmd`.
- [x] `orchestra.qmd`: Document the current Arrangement table and separate Libraries panel, instrument IDs and editors, copy/paste and drag transfers, user-library folders, and instrument import/export.
- [x] `orchestra.qmd`: Checked the current importer and project upgrader. There is no dedicated pre-0.94 or 0.94-beta instrument-library conversion, so the manual gives no such conversion instructions. The XML loader supports category-based Java library XML and a flat GenericInstrument fallback.
- [x] `orchestra.qmd`: A packaged project with named Instr ID `Lead` generated `instr Lead` and a matching `i"Lead"` event. Copying its Generic Instrument from Project Orchestra to the user Instruments library and back inserted a separate Arrangement row with Instr ID `1`, preserving its name and body. A valid Python Instrument generated CSD; invalid Python code reported line 1, column 12. Unknown types are preserved on save and fail generation while enabled after M30; disabling allows generation and canonical Undo/Redo retains their XML. A controlled missing-Java fixture reported the runtime error without removing its Python instrument. The chapter now documents both cases; other platforms remain under the cross-cutting check. The current type-specific editors are documented in `instruments.qmd`.
- [x] `mixer.qmd`: Document current channel groups, subchannels, output routing, Mute/Solo, pre/post effects, sends, mixer settings, and `blueMixerOut` behavior.
- [x] `mixer.qmd`: The macOS package imported an Effects XML item, opened its editor, and persisted an embedded name change across relaunch in an isolated library database. Copy/Paste placed an imported effect into a mixer pre-chain. Its interface Randomize action changed a randomizable knob from 0 to 0.4603189097146487 within its 0–1 range; Undo restored 0, and Redo restored the exact randomized value. Windows/Linux remain under the cross-cutting packaged check. Source review confirms the Randomize action calls the widget group's randomizer; Java Blue's route-reachability pruning optimization does not apply to Blue 3.
- [x] `rendering.qmd`: Document current realtime and disk CSD profiles, render-range gestures, project-owned render options, disk output path rules, progress/cancellation, and Render and Play/Open behavior. Replace the stale loop-menu reference with the transport control.
- [x] `rendering.qmd`: A packaged macOS Disk Complete Override with `-o "override output.wav" -W -s -d` rendered successfully to that path and ignored the project's different File Name. In normal mode, project Advanced Settings `--format=wav:float` produced a 44.1 kHz stereo 32-bit float WAV. Settings output choices also produced one-second stereo 16-bit AIFF and FLAC files with nonzero decoded audio; FLAC disk output works even though AudioFile FLAC input reports unsupported format. A configured Render and Open command ran and received the rendered path through `$outfile`. The default Render and Open action revealed the rendered WAV in Finder; its selected native path matched the output with spaces. Windows/Linux output formats remain under the cross-cutting check.
- [x] `soundobjects.qmd`: Check placement, selection, shared properties, time behavior, processing order, and selected-range note generation against both Blue 2 SoundObjects introductions and Blue 3's Score canvas, properties editor, and generation code.
- [x] `soundobjects.qmd`: Source-check selected-range generation for Sound, AudioFile, LineObject, ZakLineObject, and FrozenObject against Blue 3 and Java Blue; document clipped event/control spans, file references, and tempo-map-based seconds seeking.
- [x] `soundobjects.qmd`: Fix M16 for direct AudioFile/FrozenObject placements and direct Instances, converting the beat-domain overlap interval to object-relative seconds: `seconds(objectStart + offset) - seconds(objectStart)`. Sync/async regressions cover tempo changes, nested PolyObject placement, and nonzero starts on directly linked file-backed sources under unscaled, unrepeated timing.
- [x] `soundobjects.qmd`: Fixed the source-visible one-level compound M16 case for an Instance linked to a PolyObject with `TimeBehavior.NONE`, no PolyObject or direct SoundLayer note processors, first event at beat 2, and AudioFile/FrozenObject leaves at beat 4. Selecting `[3,5]` now produces a one-beat seek and two-beat file duration in sync/async model tests. Scaled-owner, nested-scaled-source, SoundLayer TimeWarp, and out-of-span GenericScore regressions keep unsupported or legacy notes outside outer finalization. PythonProcessor's opaque note identity retains file-seek provenance through reordering/copying; focused TypeScript and Java transport tests pass.
- [x] `soundobjects.qmd`: Keep M16 partial for dynamic JavaScript/Python origins, nested PolyObject/Instance leaves, transformed or repeated sources, and processor-bearing compositions. A short GenericScore with an event at its subjective-duration boundary retains legacy pruning and file seek/duration in sync/async tests; a future range-aware contract must decide whether to translate events outside their declared span while preserving generator/processor inputs and order. Packaged direct AudioFile playback and the user-accepted frozen selected-range render cover the supported direct cases.
- [x] `soundobjects.qmd`: The original `Objects.png` and `ScoreProcessTime.png` diagrams remain upstream; current chapters use actual Blue 3 UI captures where useful.
- [x] `soundobjects.qmd`: **End Time** now follows the selected Start Time format (M07), as the older manual described.
- [x] `soundobjects.qmd`: Reviewed non-note generation by type and added qualified CSD guidance, with detailed workflows in the type pages.
- [x] `time.qmd`: Reconcile the Blue 2 TimeBase, position/duration entry, ruler, snap, and conversion explanations with the current Score toolbar, Ruler Configuration dialog, TimeUnitEditor, and project patch path.
- [x] `time.qmd`: The independent **Update Markers** option now converts markers when **Update ScoreObjects** is cleared (M03). The chapter explains this behavior.
- [x] `time.qmd`: Packaged Ruler Configuration saved 29.97 fps (non-drop), and Score Object Properties accepted `00:01:00:01` as a start time stored at 60.033 seconds (M04/M18). In a separate packaged project with 120 BPM through beat four and 60 BPM afterward, entering `0:00:03.000` for a Score Object start time produced beat five; switching the field to Csound Beats displayed `5` (M14). Focused tests cover duration and marker clock fields.
- [x] `time.qmd`: Java Blue's `ScoreTopComponent.applyTimebaseUpdate` and Blue 3's `applyTimebaseUpdate` both convert only direct root-Score objects. The chapter now states that a root PolyObject's own fields convert while nested child fields do not; deeper conversion would need a separate behavior change.
- [x] `time.qmd`: The legacy Quick Time control is absent and new SoundObjects/AudioClips default to beat-based fields; both are documented. In a packaged project with 120 BPM through beat four and 60 BPM afterward, changing the primary ruler from Beats to Time with the default **Update ScoreObjects** selection converted an AudioFile start from beat five to three seconds while preserving its beat-five placement. The manual's conversion explanation matches this observed behavior.
- [x] `polyobjects.qmd`: Reconcile nested Score navigation, grouping, relative timing, repeat behavior, and processor order from both Blue 2 PolyObject chapters with Blue 3.
- [x] `polyobjects.qmd`: Fix **Set Subjective Time to Objective Time** for PolyObjects. The action now measures generated notes, excludes the container's Score start offset, preserves its duration base, and round-trips through project history. This intentionally avoids Java Blue's legacy calculation, which includes the parent's absolute placement in the returned duration. The chapter explains why Scale or Repeat can still yield an unchanged width.
- [x] `polyobjects.qmd`: **Set Subjective Time to Objective Time** ran in the macOS package on a PolyObject containing a child GenericScore with a PythonProcessor. It measured six beats from the Java-backed processor, committed the duration from four to six, and native-menu undo/redo restored four then six beats (M20). Focused tests cover missing-runtime and stale-measurement failure paths.
- [x] `polyobjects.qmd`: Documented that nested Scores share the project's ruler and snap state. Independent settings from the archived Java workflow are not a current Blue 3 control.
- [x] `polyobjects.qmd`: In the packaged macOS Score, **Convert to PolyObject** grouped four selected objects from two layers and two root groups, including an Instance and a PythonObject. Native Undo restored all four original placements; Redo restored the container, whose XML retained all four child objects and the Instance reference. Generate CSD to Screen succeeded after Redo, including the Python-generated note. The new container's default **Scale** behavior changed note timing and duration, so the chapter warns about that beside the conversion steps and makes no losslessness claim.
- [x] `polyobjects.qmd`: Compared the archived six-beat example with `applyTimeBehavior` and PolyObject processor order. The current chapter replaces its uncut repeated notes with cycle-boundary clipping and explains that LineAddProcessor runs before Repeat, so each cycle keeps the processed values. The archived diagrams are not used.
- [x] `polyobjects.qmd`: Fix M19 finite-end filtering for nested PolyObjects. Sync/async generation checks child note starts against the child-local end before applying the container's Score start; regression tests cover a nested note inside the outer range and one beyond it. Blue 3 intentionally corrects the same ordering bug in Java Blue.
- [x] `note-processors.qmd`: Confirm object, layer, group, and Score scope; chain order and editing; supported/deferred status; and the numeric-field requirement against current UI and generation.
- [x] `note-processor-reference.qmd`: Review all 17 imported processor types against their Blue 3 classes, parameters, and behavior.
- [x] `note-processor-reference.qmd`: All 17 documented processors were exercised through packaged macOS CSD generation with three-note fixtures. Arithmetic, pch, tuning, retrograde, rotation, sublist normalization, line interpolation/hold, and TimeWarp start/duration output matched their contracts. Both seeded random processors repeated exactly. Python edited p4 through the Java runtime; syntax and runtime failures reached generation errors. Lines starting after the first note, odd line pairs, and odd tempo pairs failed explicitly. Switch exchanged p4/p5 with six fields but rejected p5 when it was the final field; the chapter now documents this Java-compatible restriction. Windows/Linux remain under the cross-cutting check.
- [x] `generic-score.qmd`: Check `i` event syntax, supported shorthand, processing order, time behavior, and instrument references against the old object entry and current generation.
- [x] `generic-score.qmd`: Source review confirms the parser converts supported `i` lines, ignores other score statements, and reports malformed recognized `i` events instead of silently skipping them (M17). The chapter states these limits and keeps its syntax claim narrow.
- [x] `generic-score.qmd`: Source tracing confirms malformed-event messages reach the Generate CSD toast and disk-render failure dialog; parser tests cover line/text, shorthand, and sync/async generation (M17).
- [x] `generic-score.qmd`: A rebuilt macOS package displayed the malformed line-3 `i1 0` error in the Generate CSD toast; corrected `i1 1 1` and shorthand `i1 + 1 .` input generated the expected events (M17).
- [x] `piano-roll.qmd`: Document current per-note template overrides, note copy/paste placement, field editing and defaults, local ruler and snap menus, Scala loading, MIDI pitch mode, and editor shortcuts.
- [x] `piano-roll.qmd` / PianoRoll Properties: Added editable Base Frequency with Java-compatible commit, invalid-input restore, and negative-value clamp behavior through ProjectHistory (M15). New Scala scales use Java and TypeScript's Middle C default of 261.625565 Hz (C4 in scientific pitch notation).
- [x] `piano-roll.qmd`: In the macOS package, Shift-drag created a note at beat 1.25 with duration 1.5. Dragging its AMP pin changed 1 to 0; native Undo/Redo restored 1/0 without changing pitch or timing. Local Command-A/Delete removed the note and Undo restored it. Alt-S toggled snap, Command-plus changed horizontal zoom 64 to 72, and Command-Down changed note height 15 to 16. Native Undo/Redo key accelerators remain in the shortcuts check; other platforms remain in the cross-cutting check. Note-template copy/paste is fixed in M06.
- [x] `pattern-object.qmd`: Check the current grid, row, mute, generation, and time-behavior paths against the archived entry; replace its ghost-note workaround with the verified configured-beat behavior.
- [x] `pattern-object.qmd`: In the macOS package, changing **Beats** from four to two reduced the grid from 16 to eight steps and the saved row to `10000000`; changing **Sub** from four to two reduced it to four steps and `0000`. The canvas width followed each change. Generated CSD after the Beats edit contained the expected trigger at beat zero and its Repeat at beat two, with no old step-15 trigger (M05). ProjectHistory commit→undo→redo also passes in focused tests.
- [x] `soundobject-library.qmd`: Checked organization, independent and linked transfers, source editing, and deletion behavior. The chapter remains under Working in Blue.
- [x] `instance.qmd`: Check linked-source editing and generation order. The source generates first, then the Instance normalizes notes, runs its processor chain, applies Time Behavior, and adds its start offset (M08).
- [x] `instance.qmd`: In the packaged macOS app, a project-library GenericScore was placed with **Copy Independent** at beat four and **Copy Instance** at beat eight beside an existing linked Instance. The inserted objects were respectively GenericScore and Instance. Editing and saving the library source from pitch 440 to 660 changed both linked placements in generated CSD while the independent copy kept 440. Runtime-generated JavaScriptObject placement timing also has model evidence; the archived **Convert to Generic Score** command is absent from Blue 3.
- [x] `audio-file.qmd`: Check file selection, metadata states, project media-copy path, post code, generated playback event, and distinction from audio-layer clips. The generator does not run AudioFile Note Processors or Time Behavior.
- [x] `audio-file.qmd`: The macOS package recognized stereo PCM WAV and AIFF inputs with two channels. The AIFF source rendered to a WAV whose first second had nonzero audio. A FLAC source displayed **Unsupported Audio Format**, and the chapter now distinguishes AudioFile source formats from disk-render output formats. The Csound tab listed `aChannel1` and `aChannel2`; generated CSD included `diskin2` plus `outs aChannel1, aChannel2`. M16's bounded selected-range output is verified, and Score Object Properties omitted the inapplicable Time Behavior and Note Processor controls (M09). Other source encodings and M16's unsupported compositions remain separate behavior limits.
- [x] `globals.qmd`: Replace the Java Globals Manager directions with Blue 3 Global Orchestra and Global Score panels, section order, selected-render timing, and verified `<TOTAL_DUR>` substitution.
- [x] `globals.qmd`: Packaged macOS generation substituted all four Global Score variables plus instrument ID/name tokens. A tempo map at 120 BPM through beat 4, then 60 BPM, converted render start 4 to absolute 2 seconds. A selected range rebased its timeline while retaining a Global Score event at time zero; the 20-beat Global Score event did not increase TOTAL_DUR. Realtime orchestra evaluation compiled a new instrument, and score evaluation emitted its diagnostic while playback remained active after M28. Windows/Linux remain under the cross-cutting check.
- [x] `tables.qmd`: Replace the Java Tables Manager screenshot with current panel access, stored score text, and generated CSD order.
- [x] `tables.qmd`: Confirmed from CSD generation that automatic allocation reserves positive `f` numbers from Tables text and `ftgen` numbers in Global Orchestra, but does not scan Global Score or instrument score text. The chapter now states that collisions remain possible in those locations and directs readers to inspect the generated CSD.
- [x] `tables.qmd`: Source review confirms Blue reserves literal numeric `f` IDs from Tables and numeric `ftgen` IDs in Global Orchestra, but cannot infer variable/macro IDs and does not scan Global Score or instrument score text. The chapter limits its guidance to these rules and directs readers to inspect generated CSD.
- [x] `udos.qmd`: Replace the Java UDO Manager controls with Blue 3 project list, editor styles, ordering, import/export, test, and library placement.
- [x] `udos.qmd`: A 2006 Java Blue project opened in the macOS package and generated CSD containing its `yi_add_table` UDO definition and calls. A disposable `.csd` import added two Classic UDOs in declaration order and preserved the second opcode's call to the first. Changing the first to Modern moved its `xin` variable into the named input arguments and removed the `xin` body line; Undo restored Classic and Redo restored Modern. Generated CSD contained `opcode ManualDouble(kValue):k` before the dependent `ManualQuad` definition. A project UDO copied to the isolated user library through the preload contract, and UI Copy/Paste inserted it back into the project. A packaged drag-session preview and apply also inserted an independent definition; Undo removed the insertion and Redo restored it. Project-list insertion preserved the existing opcode name. A separate collision fixture generated `uniqueUDO0` for an embedded `ManualGain` with different code and rewrote the dependent embedded UDO's call, while canonical project and instrument definitions retained their names and code. This matches Java Blue's append/collision algorithm. Old screenshots and external collections remain historical-only and are not reused in the active chapter. Windows/Linux interaction checks remain under the cross-cutting row.
- [x] `udos.qmd`: **Test Opcode** is a code preview; the chapter tells readers to put the UDO in an instrument and render the project for a Csound check. A separate Csound test action is outside the manual integration scope.

- [x] `blue-live.qmd`: Document Focused Target and Direct Channel routing for hardware MIDI and Virtual Keyboard input, including focus selection and fail-closed behavior. Source and focused tests support the routing paths; legacy Live cell key/MIDI fields remain inert compatibility metadata.
- [x] `blue-live.qmd`: In the macOS package, Trigger Selected and Trigger each submitted one note. At tempo 120 and Repeat 1, four Csound event messages arrived at intervals 500, 495, and 505 ms. Capturing a set, disabling its cell, and recalling it restored the enabled identity; saving retained the set and Repeat settings. Live orchestra and score evaluation succeeded and left Blue Live running after M28. Virtual Keyboard computer keys reached Orchestra assignment 2 in Focused Target mode, and assignments 1/2 through Direct Channel 1/2; an empty focused target submitted no notes. Clicking a Track timeline focused its owned instrument; a Virtual Keyboard computer key reached it and emitted the expected engine diagnostic. The user confirmed audible Repeat cadence, immediate tempo/interval changes, Repeat-off, and engine-stop behavior on 2026-09-30 (M01). Windows/Linux interaction is deferred.
- [x] `blue-live.qmd`: The user completed macOS MIDI input discovery/enabling, Focused Target and Direct Channel 1/2 routing, note release, and input disabling on 2026-09-30 using an external virtual MIDI controller/OS port. This exercises the application MIDI input path in addition to the previously verified built-in Virtual Keyboard. Physical USB/DIN transport was not exercised.
- [x] `project-properties.qmd`: A packaged macOS Disk Complete Override rendered to the `-o` path with spaces and ignored File Name. Normal project Advanced Settings produced a float WAV. With **Copy Imported Media** enabled and **Media Folder** set to `custom-media`, a packaged Track audio drop copied a stereo WAV into that folder and stored `custom-media/stereo-source.wav` in the project clip. Source review distinguishes CSD header settings from realtime launch options and documents Clojure dependencies. A packaged realtime Complete Override using `-odac -d -m0` started managed playback, and live orchestra/score evaluation worked without stopping it after M28. AudioFile Browse was exercised with controlled native-picker selections: Cancel retained the source, relative `custom assets` and blank/default `media` folders copied and stored relative paths, an absolute folder copied and stored its absolute path, and Copy Imported Media off retained the external source. Metadata showed 44.1 kHz and saved XML retained the chosen paths. Adding the cached `org.clojure/data.json` 0.2.0 dependency made JSON-dependent CSD generation succeed after M29. Move Up reordered entries; removal/Redo made the namespace unavailable, Undo restored successful generation, and saving retained the coordinates/version. Other platforms remain in the cross-cutting check.
- [x] `command-blocks.qmd`: In a packaged macOS project with two instruments, identical `once` text appeared once, both `pre` blocks preceded ordinary global code, and an unknown block was omitted. The same result held with a nested PolyObject and selected range `[1,2]`; after M25, its score notes appeared at beats 0 and 0.5. Focused processing tests cover the unclosed-block behavior.
- [x] `tools.qmd`: In the rebuilt macOS package, Code Repository migrated the existing Java Blue XML in a fresh profile; a new snippet exported to XML and imported into a second profile. FTable Converter turned `f 1 0 1024 10 1` into an `ftgen` assignment. With `CSOUNDRC` aimed at a temporary file, Cancel preserved it and Save wrote the edited flags. Tools → Effects Library opened the Effects tree; an imported effect opened for editing, and its changed embedded name persisted in the isolated library database. Corrected the chapter's effect creation instructions to match the Libraries UI. SoundFont Viewer displayed the SpanishClassicalGuit instrument and preset at bank 0, preset 0 from a local `.sf2` file. Effects XML import reviewed and added one item; Copy and Paste placed it in a mixer pre-chain, with Undo removing it and Redo restoring the same entry identity. Without `CSOUNDRC`, the editor displayed `/Users/stevenyi/.csound7rc`; Cancel closed it without writing. Windows/Linux remain under the cross-cutting packaged check. Blue Share and Scanned Synthesis Matrix are historical-only.
- [x] `importing.qmd`: The macOS package imported a real 70 KB CSD through all three **File → Import CSD File** choices. Each replaced the project and regenerated a CSD containing instrument 1, its first note, and the `t 0 108` tempo statement; Single Sound Object made one item, and per-instrument mode made a nine-layer group. A 480 PPQ MIDI fixture with notes at beats 1 and 3 confirmed the custom template's instrument ID and final p-field. Without Trim, the object began at beat 0 and retained note starts 1 and 3; with Trim, it began at beat 1 and its local note starts became 0 and 2. The chapter now states that a project must be open before import. Windows/Linux remain under the cross-cutting packaged check.
- [x] `workflow-features.qmd`: In the packaged macOS app, auditioning a valid GenericScore beside a malformed unselected object reached `playing via blue-engine`, stopped without error, and left both project objects unchanged. Freezing both objects failed on the malformed note, reported its line and text, committed no replacement, and left no generated media file. Previous packaged direct AudioFile freeze succeeded with selected-range output. An invalid Csound opcode made the freeze subprocess exit 255 while preserving the source and leaving no freeze file. In the same app session, a valid project in a path with spaces froze to project-relative `freeze0.aif`; its duration included the 0.4-second mixer tail. Undo restored the exact source XML, Redo restored the frozen object, and unfreeze restored the source and removed the generated file. Audition of the four-beat source with this tail played for about 4.59 seconds including engine buffering. Windows/Linux remain under the cross-cutting check. Source review confirms the chapter's save, target, and failure rules; automatic backup/recovery and `blue --compile` are historical-only, with automatic backup/recovery a separate product decision.
- [x] `parameter-automation.qmd`: In the macOS package, assigning a mixer dB target enabled its automation. Single Line click inserted a point at beat 0.8; dragging moved it to beat 1.04 and changed its value. Right-click deleted it, and Undo restored the exact point. Assigning the same target to a second SoundObject layer removed its first assignment. A Track layer assigned its own channel dB target. Generated CSD contained `gk_blue_auto` variables, control-rate `line` updates, and mixer `ampdb` use. Windows/Linux remain under the cross-cutting check.
- [x] `instruments.qmd`: JavaScript Instrument CSD generation works in the macOS package (M02): Generate CSD to Screen included the script's oscillator and `outs` body. A valid Python Instrument generated its oscillator body and `i1` event; invalid Python syntax returned a line-1, column-12 error. A 2013 Java Blue project with BlueX7 and a recent BlueSynthBuilder project opened and generated CSD. Packaged single-voice SysEx Cancel preserved the voice; Import changed it and matched encoded algorithm/transpose values. Undo restored the previous voice and Redo restored the import. The bank chooser showed all 32 slots, and importing slot 2 matched its encoded algorithm. A BlueSynthBuilder instrument copied through the user library and back retained its code and both embedded UDOs; generation reused equivalent definitions and renamed a differing collision as expected. Windows/Linux remain under the cross-cutting check.
- [x] `soundobject-types.qmd`: In the macOS package, PythonObject and ClojureObject each generated `i1 0 2 440` into CSD through their Java-backed runtimes; an invalid PythonObject script returned a line-1, column-7 syntax error. External executed `/usr/bin/python3` and emitted a note. Seeded JMask emitted four half-beat notes; Tracker emitted its configured pitch and dynamic fields; LineObject and ZakLineObject emitted their control events. These checks used disposable projects.
- [x] `soundobject-types.qmd`: Three existing Java Blue projects (2013 BlueX7, 2006 UDO/GenericScore, and a BlueSynthBuilder project) opened and generated CSD in the macOS package. Seven additional Java Blue example copies (versions 0.106.0_beta3, 0.124.0, and 2.4.0_beta) opened and generated CSD: LineObject, Tracker, PianoRoll, PatternObject/Instance, Python ObjectBuilder, PythonObject with PythonProcessor, and ClojureObject. Output sizes ranged from 3 KB to 25 KB. Synthetic runtime/error checks for specialized generators are recorded in the preceding row; other-platform verification remains cross-cutting.
- [x] `shortcuts.qmd`: After the user enabled macOS Accessibility on 2026-09-30, System Events delivered native keypresses to the isolated repaired package. Verified New/Open, Save, Undo/Redo of marker creation, Generate CSD to Screen/File, F9 playback start/stop, selected-object Audition, disk rendering, Render to Disk and Play, Add Marker, previous/next marker navigation, loop toggling, and Close Project. File-picker results used controlled disposable destinations; actions were invoked by native keys. Rendered WAVs completed at 1,411,244 bytes, and the player loaded the correct eight-second file and advanced its playback clock. PianoRoll local selection/delete, snap, zoom, and note-height keys and Blue Live trigger/selected-code evaluation keys were already verified. The desktop bridge still fails with TIOCSTI, but System Events now supplies a working native keyboard route. Windows/Linux accelerators remain deferred.
- [x] `shortcuts.qmd`: On 2026-09-30, the rebuilt macOS package passed all 14 Tracker Keyboard Shortcuts help bindings: tie Space and Ctrl+T, clear/duplicate, OFF toggle, value increment/decrement, cut/copy/paste, Delete, keyboard-note toggle, octave changes, and help. Playwright sent the documented Ctrl combinations to the focused renderer; System Events also verified native Cmd tie/cut/copy/paste and project Undo/Redo/Save. Keyboard-note entry advanced to the next row and changed from 8.00 to 9.00 with the octave. Extra arrow/Enter/Escape checks exposed M33; after repair, cancelling a draft created no history entry and saving/reopening retained the committed value. OS-reserved Ctrl combinations were not tested through native macOS dispatch. The chapter intentionally omits unverified Java-only gestures.
- [x] `developer.qmd`: On 2026-09-30, an independent macOS clone plus the current uncommitted source snapshot installed locked dependencies into an empty pnpm store (640 packages, zero reuse), bootstrapped pinned vcpkg, and built native/Java/TypeScript artifacts without copying existing outputs. Java used a fresh Maven repository. Root build and tests passed; root lint passed after M34. Quarto built all 35 chapters, an unsigned contributor package passed packaged metadata/runtime/project/mismatched-engine verification, and the clone's Electron runtime opened, generated CSD, and saved a valid minimal project with fresh user data. Added runnable clone/build/test/lint/manual/start/package steps and macOS toolchain guidance. Node 22.23.1, pnpm 12.8.1, Java 17.0.15, Maven 3.9.16, CMake 4.4.3, Apple Clang 15, and Quarto 1.10.18 were already installed; installing prerequisites on a blank OS was not tested. Windows/Linux remain deferred under the cross-cutting check.
- [x] `reference.qmd`: No external learning links were imported. Current external links in the active book point to the Blue repository and official Csound downloads.
- [x] `about.qmd`: Verified the five named contributors against the archived preface and credits; the original author and contributor roles are credited locally, with the upstream edition identified by commit.


## Current source and screenshot delivery (2026-09-30)

- [x] Verified all 94 original topic files against upstream commit `7a92066a2aa8f0370026ba9527c158643c2935a1`, then removed the duplicate source and images. Preserved author/contributor roles, GNU FDL license and the complete upstream topic map; no references to the removed directory remain in repository source or the rendered book.
- [x] Added `manual-changes.md` with textual summaries and original source links for each of the 35 current chapters.
- [x] Captured and visually inspected eight actual Blue 3 UI views using isolated user data and sample projects. Expanded editor panels and positioned the PianoRoll viewport to show its six-note sample.
- [x] Clean render and installed-resource scans each checked 35 chapters, 2,461 local references and eight images with no broken local links/anchors/assets. Installed images match source bytes.
- [x] A browser check with HTTP requests blocked loaded all eight screenshots from both the local render and the installed package, then followed local chapter navigation. No background network request occurred after disabling theme web fonts.
- [x] Package input validation, unsigned directory packaging, packaged metadata/runtime/project/engine-mismatch smoke checks, root lint, targeted formatting and whitespace checks passed. Application behavior was unchanged in this documentation update; the prior fresh-clone full test run remains the runtime evidence.
