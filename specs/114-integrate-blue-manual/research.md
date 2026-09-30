# Research: Blue 3 manual integration

## Decision 1: Source ownership

**Decision (updated 2026-09-30)**: Maintain the current book under `docs/manual` and reference the [upstream Blue 2 edition](https://github.com/kunstmusik/blue-manual/tree/7a92066a2aa8f0370026ba9527c158643c2935a1) by commit `7a92066a2aa8f0370026ba9527c158643c2935a1`. Preserve the credits, license, and topic mapping without duplicating the original source or images locally.\
**Rationale**: App and documentation changes can be reviewed and tagged together without presenting Java instructions as current. The original repository remains available for historical Git history and Blue 2 publication.\
**Alternatives considered**: Git submodule (requires a second checkout/revision workflow), Git subtree (merges two histories and complicates edits), publishing all imported chapters (many are stale).

## Decision 2: Offline delivery

**Decision**: Render HTML during packaging and copy the output into installed resources. Open index.html with Electron shell.openPath. Disable Quarto book search in the offline build because its search index is fetched through browser JavaScript and file URL access can vary by browser.\
**Rationale**: Native page links and bundled assets are enough for a small book; no in-app browser or server is required.\
**Alternatives considered**: Remote-only manual (does not match app version offline), embedded BrowserWindow/custom protocol (more app code and security surface), PDF-only manual (loses chapter navigation).

## Decision 3: Online site

**Decision**: Keep the separate repository's existing Pages workflow serving its Blue 2 manual. Do not deploy the new book until a Blue 3 URL and old-version retention policy are selected.\
**Rationale**: Publishing to the main repository's Pages branch could displace other site content. Optional online hosting must not delay versioned source and offline delivery.\
**Alternatives considered**: Repurpose old Pages site immediately (would change established links), auto-publish from the app repository (destination not yet defined).

## Decision 4: Licensing

**Decision**: Preserve the original manual's GNU FDL 1.3 statement, include its license text, and capture current Blue 3 UI images with documented provenance.\
**Rationale**: Manual text is separately licensed from application code.\
**Alternatives considered**: Treating imported content as GPL source without separate notice (incorrect attribution).

## Decision 5: First chapter migration and navigation

**Decision**: Keep the six current filenames, group reviewed pages with Quarto book parts, and add only SoundObjects, Orchestra, and Rendering in this batch. The First project tutorial uses a Generic Instrument and GenericScore, which are present in the current app. Preserve the upstream originals unchanged.
**Rationale**: A reader can move from a complete task to explanations without exposing the other unreviewed Java chapters. Keeping filenames avoids unnecessary link churn. Legacy screenshots show a different UI and need separate review before reuse.
**Alternatives considered**: Recreating all legacy sections and pages at once (would present stale guidance), relocating every current page into new directories (adds link changes without improving the visible book), and publishing placeholder sections (empty navigation).

**Current-app checks**: `application-menu.ts` supplies New Project, Save as,
Generate CSD to Screen, Render/Stop Project, and Render to Disk. The Orchestra
panel's `+ Add` menu offers Generic Instrument, whose editor has an Instrument
code tab and an editable Instr ID. The Score timeline's context menu offers
Add SoundObject → GenericScore, edited in the current code editor. The default
score has a SoundObject layer. The old Score Timeline, SoundObjects, Orchestra
Manager, and Rendering chapters informed the terminology; their screenshots
and Java-era UI directions were not copied into current chapters. The upstream edition
has first-project images but no current first-project tutorial text.

## Decision 6: Second chapter migration — composing on the Score

**Decision**: Migrate the time system, GenericScore, PianoRoll, PatternObject,
PolyObject, and Note Processors as six reviewed pages. Use the original text as
source material, but document the current Blue 3 labels, supported behavior,
and generated-score implications. Use current Blue 3 captures instead of Java screenshots.
**Rationale**: These topics extend the first-project tutorial into practical
composition and fill the largest gaps behind the current Score and
SoundObjects overviews. The app has current editors for all six topics.
**Alternatives considered**: Importing all object and processor reference
pages at once (too many stale controls to verify), or copying legacy prose
unchanged (would misstate current behavior).

**Current-app checks**: The Score toolbar separates Snap from Ruler
Configuration. The ruler dialog offers primary/secondary formats and optional
Update ScoreObjects/Markers modes. The PianoRoll editor has Notes and
Properties tabs, Instrument ID, Note Template, pitch generation, scale, and
additional fields. Its note canvas uses Shift-drag to create notes. The
PatternObject editor has Beats, Sub, a pattern list, score text, and a trigger
grid. Double-clicking a PolyObject enters its nested Score, and the Score
toolbar shows a path back to Root. Object properties expose Time Behavior,
Repeat Point, and Note Processors; the chain editor supports ordered entries
and marks deferred or unsupported processors. The legacy notes about old
popup paths and screenshots are not assumed current. PythonProcessor is
recognized in the current catalog and requires a Java runtime session for
execution; older deferred Python snapshots are reified as supported
processors.

**Model checks**: GenericScore and a new PolyObject start with Scale time
behavior; new PianoRoll and PatternObject objects start with Repeat. PianoRoll's
default template sends frequency as `p4` and AMP as `p5`, unlike the
first-project instrument. A configured template reversing those fields
produces `p4=0.15` and `p5≈440`. PatternObject emits score text at each active
step; a four-beat, four-subdivision grid with steps 1, 5, 9, and 13 emits
starts at beats 0, 1, 2, and 3. A PolyObject offsets child events in its
parent. AddProcessor targeting `p5` changes a 440 Hz event to 550 with value
110. Current conversion to PolyObject is a project-history edit; the legacy
warning that conversion cannot be undone is obsolete. The original texts and
images remain in the upstream edition.

## Decision 7: SoundObjects navigation

**Decision**: Place the SoundObjects overview, GenericScore, PianoRoll,
PatternObject, and PolyObjects in one Quarto book part. Keep each topic on its
own page and retain existing filenames and links.
**Rationale**: The overview and object entries form one reader-facing group.
Quarto book parts render this grouping directly in the table of contents.
Nested book parts fail Quarto 1.10.18 configuration validation; a custom
`book.sidebar.contents` hierarchy rendered the chapter list flat.
**Alternatives considered**: Merge all entries into one long page (less useful
for finding individual objects), or maintain a custom website sidebar beside
the book's chapter list (extra navigation configuration with no observed
nesting in this book).

## Decision 8: Library, Instance, and AudioFile migration

**Decision**: Migrate the three topics as separate SoundObjects pages. Describe
Blue 3's Project SoundObjects and Libraries panels, the Copy Instance / Copy
Independent choice, and the current AudioFile editor. Keep legacy screenshots
in the upstream edition.
**Rationale**: These pages explain how to reuse the objects already documented
and add a current path for recorded audio. The legacy library chapter refers
to an F4 dialog and a different command name; the current Score context menu
says **Add to Project SoundObjects** and the panels are under **Window →
Properties**. The old Instance chapter promises duration and time-behavior
transforms that the current Instance generator does not apply to generated
notes. It does use the shared source, the Instance start, and the Instance
Note Processor chain. The AudioFile generator creates a `diskin2` instrument
and a score event, while audio-layer clips have their own timeline controls.
**Alternatives considered**: Copy the legacy chapters directly (stale actions
and timing claims), combine library and Instance in one long page (harder to
find either workflow), or present AudioFile as equivalent to an audio-layer
clip (different editors and playback generation).

**Current-app checks**: A single selected timeline SoundObject can be added
to Project SoundObjects; this replaces its Score entry with a linked Instance.
The Project SoundObjects panel browses and edits the project's definitions;
the Libraries panel contains user-wide SoundObjects. Transferring a project
definition to the Score offers **Copy Instance** and **Copy Independent** when
both modes are valid. Deleting a project definition shows the number of linked
score instances that will also be removed. AudioFile offers **Audio File** and
**Csound** tabs, file browsing, metadata, and editable post code. The file
picker validates the selected audio file and obeys **Copy Imported Media**.

## Decision 9: Include all remaining topics as labeled drafts (superseded by Decisions 20 and 22)

**Decision**: Keep the 18 reviewed Blue 3 pages at their existing routes, map
22 overlapping legacy sources to them, and copy the other 72 source chapters
into `docs/manual/drafts/`. List all 90 unique chapters explicitly in Quarto
navigation. Move SoundObject Library to Working in Blue without changing its
route. Keep the pinned upstream Blue 2 edition unchanged and track every draft in
`manual-issues.md`. A topic mapping is not a claim that every archived detail
has been migrated: the issue list separately tracks coverage gaps for all 18
current chapters.

**Rationale**: The user wants the full source material accessible while
updating it piece by piece. A title and body warning prevents an unverified
Java Blue workflow from appearing to be current guidance. Separate pages
preserve topic-level navigation. Relative links and bundled archived images
let the installed manual work offline. The source had seven incorrect or
extensionless cross-page links; the draft copies point to the resolved pages.

**Alternatives considered**: Merging object entries into one page would make
individual topics harder to find. Leaving remaining chapters outside the book
would delay the requested source coverage. Treating imported content as
reviewed would misstate its applicability to Blue 3.

## Decision 10: Score and Mixer chapter coverage

**Decision**: Expand the reviewed Score and Mixer chapters from current Blue 3
controls, while keeping unverified legacy details in the issue list. The
Score Manager offers SoundObject, Track, and Patterns Layer Groups; Track
layers can contain SoundObjects and AudioClips. The Score toolbar has Score,
Single Line, and Multi Line views, a nested-score path, snap, ruler, and Score
Settings. Score Settings chooses whether Track Layer M/S buttons control the
associated mixer audio channel or filter generated events. Timeline row
visibility is in the row-header context menu.

**Mixer checks**: The toolbar exposes Enabled, Extra render time, Add
Subchannel, and Mixer Settings. Mixer Settings holds meter and pan controls.
Orchestra and track-associated channels appear in separate groups; the
project has Subchannels and a Master strip. Every non-master strip has an
output selector. Pre and Post chains allow New Effect, Send, paste from the
Libraries clipboard, editing, reordering, enable/disable, and removal. A
Send editor chooses a target and amount. Blue's arrangement conversion
recognizes `blueMixerOut` with or without a named subchannel and uses `outc`
when the mixer is disabled.

**Deferred**: Do not copy the old Mixer dialog, BlueShare import, widget
randomization, or code-generation optimization text as current directions.
The old Score Navigator, BlueLive toolbar, detailed audio gestures, and
shortcut table need separate current-app review. These remain in
`manual-issues.md`.

## Decision 11: Settings and PianoRoll chapter coverage

**Decision**: Expand the reviewed Settings and PianoRoll chapters from the
current renderer controls and model behavior. In Settings, the managed Blue
Engine is the normal realtime and offline path; the legacy executable
preference is retained for downgrade compatibility. Realtime Render probes
the engine and Csound library, discovers audio and MIDI modules and devices,
and exposes buffer and message options. Disk Render has separate output
format, message, advanced, and external play/open controls. The MIDI panel
manages live input devices independently of Csound's MIDI module choices.
The OSC panel shows the actual listener port and supported address prefixes.

**PianoRoll checks**: The Notes tab has a per-note template override,
copy/cut/paste commands, field selector and value handles, independent snap
and ruler controls, and editor-local shortcuts. The Properties tab loads
Scala `.scl` files and exposes Pitch Generation, Transposition, and field
definitions. Field realignment retains values on rename, clamps to new
bounds, rounds discrete values, and initializes added fields with defaults.
The current editor does not expose the legacy Base Frequency control. The
copy buffer omits per-note template overrides, which needs a behavior review
before the manual promises that copying preserves them.

**Deferred**: Platform-specific device and buffer advice, the full advanced
flag and OSC command reference, Base Frequency UI decisions, override-copy
behavior, and cross-platform shortcut checks remain in
`manual-issues.md`. No app behavior changes are in this batch.

## Decision 12: Rendering chapter coverage

**Decision**: Describe disk and realtime CSD profiles separately. The plain
Generate CSD to Screen and Generate CSD to File commands use the disk profile;
Generate Realtime CSD to Screen uses the realtime profile. The Score root
ruler sets the render start on click or both bounds on drag. Rewind resets
start to zero and clears the end; the transport toolbar controls looping.
Project Properties stores separate realtime and disk settings, and the disk
Render Entire Project option bypasses the Score range for disk CSD generation.

**Output checks**: In normal disk mode, a nonempty project File Name is used
unless Ask on Render is enabled; relative paths resolve from the project
directory. Otherwise Blue opens a save dialog. Render to Disk shows progress,
errors, cancellation, and Csound output. Render to Disk and Play opens the
finished file in Blue's Audio File Player. Render to Disk and Open uses a
configured external command, or reveals the file in its folder by default.
The current render path does not read the visible external Play command
preference in Settings; correct the chapter and track the control for an app
decision.

**Deferred**: Detailed complete-override flag recipes, custom external-open
commands, and platform-specific output format behavior need packaged-app
checks. Keep these in `manual-issues.md`; no application behavior is changed.

## Decision 13: Orchestra chapter coverage

**Decision**: Describe the current project Arrangement in the Orchestra
panel and the personal Instruments tree in the separate Libraries panel.
The Arrangement table exposes Use, Instr ID, and Instr Name; right-click
offers add, enable/disable, copy/cut/paste, import/export, replacement,
conversion, and removal. Selecting a row opens its type-specific editor;
Generic Instrument has Instrument, UDO, Global Orc, and Global Sco tabs, plus
the outer Comments tab. Libraries supports folders, search, rename,
import/export, and copy or drag transfers in both directions.

**Rationale**: The Blue 2 Orchestra Manager combined the two collections
in one view, so copying its spatial directions would mislead Blue 3 users.
The arrangement ID, rather than the descriptive instrument name, is the
connection to score events. Current renderer code confirms numeric or named
IDs and the project-to-user and user-to-project transfer affordances.

**Deferred**: The old pre-0.94 and 0.94-beta project-library conversion
advice needs current import-path review. Named-ID score syntax,
runtime-dependent instrument types, and transfer results need packaged-app
checks before more detailed guidance. Track these in `manual-issues.md`.

## Decision 14: Time chapter coverage

**Decision**: Explain Blue 3 time entry through Score Object Properties and
the AudioClip editor. Give separate examples for Beats, BBT, BBST, BBF,
Time, Seconds, SMPTE, and Samples. Explain that BBT positions are absolute
locations while BBT durations are lengths. Document the Score toolbar's
Ruler and Snap controls, optional secondary ruler, default Update All choices,
and Update Matching's per-field behavior. Treat a ruler-only change as an
explicit choice to clear both conversion checkboxes.

**Rationale**: The Blue 2 Time System chapter has useful concepts but
describes a Quick Time dialog and secondary readouts that were not found in
the current Score workbench. Current `TimeUnitEditor` formats and commits
individual fields, and `applyTimebaseUpdate` checks start, duration, and
repeat-point time bases separately. New markers use the primary ruler's
time base. Snap is persisted independently in project TimeState.

**Deferred**: Marker-only conversion is offered by the dialog but
`applyScoreTimeStatePatch` invokes conversion only when the ScoreObjects
mode is non-null. `time-unit-logic.ts` parses and formats SMPTE field values
at 24 fps even when the ruler dialog selects another rate. The renderer
field conversion also uses the initial tempo, so a project with tempo changes
needs a focused review before frame-accurate or tempo-map examples are added.
Confirm legacy Quick Time and default time bases for new objects and imported
clips, then run packaged-app checks. Track these in `manual-issues.md`.

## Decision 15: SoundObjects overview coverage

**Decision**: Preserve the archived definition of a SoundObject as a musical
idea, then teach Blue 3's Score workflow: right-click empty layer space to
add, click or Shift-click or marquee to select, drag to move or resize,
double-click a non-container to open its editor, and double-click a PolyObject
to enter its nested timeline. Explain common properties, objective versus
subjective duration, all four available time behaviors, and processing order.
Add a short selected-render-range note rather than importing the old
type-specific partial-render table.

**Rationale**: The Score canvas and properties form confirm the current
gestures and labels. `applyTimeBehavior` distinguishes Repeat's clipping at
cycle boundaries from Repeat (Classic)'s final cycle, which includes only
notes that fit. GenericScore applies its Note Processor chain before Time
Behavior and the Score start offset; SoundLayer and root Score chains can
process the resulting notes later. `rebaseScoreToRenderStart` removes normal
notes starting before the range, while AudioFile has a specialized render
offset path.

**Deferred**: Verify each legacy partial-render claim for Sound, AudioFile,
LineObject, ZakLineObject, and FrozenObject in a packaged build. Review the
archived `Objects.png` and `ScoreProcessTime.png` before reuse. Confirm
legacy claims about SoundObjects producing ftables, instruments, UDOs, and
audio files type by type. The archived property description says End Time
follows Start Time's format, while Blue 3's snapshot currently displays a
four-decimal beat value; track the desired behavior in `manual-issues.md`.

## Decision 16: PolyObject chapter coverage

**Decision**: Retain the archived nested-container concept but document Blue
3's Score path and current conversion behavior. Explain that grouping moves
selected objects into a new PolyObject at their earliest start, normalizes
child positions relative to it, and goes through project history. Describe
Scale, Repeat, Repeat (Classic), and None on the container, plus the order in
which its processor chain and Time Behavior run. Use a corrected repeat-point
example and describe wrapping a repeating PolyObject in an outer one when a
processor must act on the completed repetitions.

**Rationale**: `useScorePathState` supplies Root and nested breadcrumb
navigation. `applyConvertToPolyObjectPatch` creates internal layers, moves
selected objects, normalizes their starts, and is called through the
project-document history path. `PolyObject.processGeneratedNotes` applies
its Note Processor chain before time behavior. Current `applyTimeBehavior`
clips notes at Repeat cycle boundaries; the archived 2.5-beat example leaves
crossing notes untrimmed. The Score panel reads one project `score.timeState`
in both root and nested views, so the old per-PolyObject ruler/snap claim is
not current behavior.

**Bug fix**: `setSubjectiveDurationToObjective` previously reused a
PolyObject's existing subjective duration. Java Blue calculates objective
duration from generated notes, and Blue 3 now does the same while subtracting
the container's Score start offset so the result remains a duration. For
Time Behavior None, the command fits the parent bar to its generated child
phrase; Scale and Repeat may already make the generated length equal to the
bar. A real ProjectHistory regression test covers commit, undo, redo, dirty
state, canonical XML, and stable object identity.

**Deferred**: Verify conversion with multi-layer, cross-group, Instance,
and automated material in a packaged app before stronger preservation
claims. Check objective-duration calculation with runtime-generated children
and processors that require a Java session. Review the original screenshots
and advanced LineAddProcessor examples before copying them.

## Decision 17: GenericScore, Note Processors, and PatternObject coverage

**Decision**: Keep these as separate current chapters. Explain the verified
GenericScore `i`-event subset and parser shorthand, Note Processor scope and
chain controls, and PatternObject's configured-beat duration. Do not import
the Blue 2 PatternObject ghost-note workaround: Blue 3 passes its `Beats`
value as the source length to Scale and Repeat, preserving a quiet grid tail.

**Rationale**: `getNotes` accepts `i` statements, comments, carry and ramp
shorthand, then `GenericScore.generateForCSD` applies its chain, time
behavior, and Score offset. The chain editor provides Add, ordering,
clipboard, named import/save, and parameter controls; model scopes run from
object outward. `PatternObject.generateRawNotes` offsets a row's score at
each active step, skips muted rows, and `applyTimeAndOffset` uses configured
beats for Scale and Repeat rather than the end of the last note.

**Deferred**: The imported processor reference pages need individual
parameter and runtime review. GenericScore's wider Csound syntax and error
reporting need a packaged-app check. Changing PatternObject `Beats` or `Sub`
does not resize existing stored trigger arrays in the current patch path,
while generation still walks each array; hidden triggers may continue to
generate. Track a focused app fix and history verification in
`manual-issues.md`.

## Decision 18: Instance and AudioFile generation

**Decision**: Explain Instance as a placement of a project-library source,
with source generation and processing followed by the Instance's own
processor chain and Score start offset. State the current limitation: its
Subjective Duration and Time Behavior do not transform the generated notes.
Explain AudioFile as a file-backed SoundObject that creates a `diskin2`
instrument and playback event from its Score duration, with editable Csound
post code and a project media-copy option. Distinguish it from an audio-layer
clip and avoid the archived **Convert to Generic Score** instruction.

**Rationale**: `Instance.generateForCSD` delegates to its source, runs its
own chain, and offsets the result, but does not call `applyTimeBehavior`.
Its async path follows the same order. `AudioFile.generateForCSD` adds a
generated instrument and note; the post code determines its audio-channel
output. The AudioFile editor reports metadata and supports native selection
and project media copying. Neither AudioFile's Note Processor chain nor its
stored Time Behavior is applied by that generator.

**Deferred**: Check linked runtime-generated definitions, Instance timing
and independent replacement, selected-range audio offsets, file format
support, and post-code channel mapping in a packaged app. Decide whether
AudioFile's inapplicable processor controls should be hidden. Track these in
`manual-issues.md`.

## Decision 19: Promote project-wide Csound editor chapters

**Decision**: Replace the three Java-era draft routes for Globals Manager,
Tables Manager, and UDO Manager with reviewed Blue 3 pages at the manual root.
Use current workbench names and explain where each section appears in the
generated CSD. Keep the upstream originals; omit stale screenshots and
unverified external UDO collections.

**Rationale**: The panel registry exposes **Global Orchestra**, **Global
Score**, **Tables**, and **UDOs** under Window → Editors. Global Orchestra
text precedes generated UDOs and instruments; Tables text precedes Global
Score and timeline notes. `preprocessSco` substitutes `<TOTAL_DUR>` from the
generated timeline material, while Global Score text itself is not rebased
with the selected timeline range. The project UDO workspace edits Classic
and Modern definitions, supports import/export and reordering, and previews
generated code through **Test Opcode**; `OpcodeList.toString` emits
definitions in list order.

**Deferred**: Check other Blue variables, tempo-map and selected-render
examples, automatic ftable number collisions, UDO import and style
conversion, user-library transfers, and the old external links in a running
packaged app. Decide whether **Test Opcode** should run Csound validation.
Track these in `manual-issues.md`.

## Decision 20: Consolidate the remaining upstream topics

**Decision**: Give each of the 94 upstream source topics a destination in the
35-page current book. Combine related short and type-specific topics where a
single current workflow or reference is easier to navigate. Remove the 69
duplicate draft copies from the active tree while recording the pinned upstream Blue 2 edition.
Label old Java-only behavior as historical instead of presenting it as a Blue 3
instruction.

**Rationale**: Blue 3's editor and menu structure differs from the Java
manual's table of contents. Current implementation checks confirm the
available tools, Live Space, parameter automation, command blocks, imports,
processor types, and registered SoundObject and instrument types. The
JavaScript Instrument editor is present, but its generator currently returns
an empty orchestra body. Blue Live Repeat now schedules enabled-cell triggers
at the tempo-derived beat interval; packaged audible validation remains in the
issue ledger.

**Deferred**: Validate the new guidance in a packaged app, deepen complex
instrument and SoundObject examples, restore useful screenshots, and check
external references before an online publication decision. Source-topic
mapping records a review destination, not complete behavioral parity.

## Decision 21: Bound selected-range origin handling

**Decision**: Keep M16's opt-in, range-independent origin contract limited to
the flat static sources already covered. Dynamic JavaScript/Python sources,
nested or transformed sources, processor-bearing sources, and static events
outside their declared SoundObject span retain the existing generation path.
The manual continues to name these limits; broader behavior requires a
separate feature contract.

**Current fallback semantics**: The linked source receives the existing
Instance-relative selected window without pre-translation. Each SoundLayer
prunes children by their declared span, generates surviving children once in
timeline order, then applies its processor chain. The source PolyObject
applies its processors and Time Behavior, and the Instance normalizes the
surviving notes before its own processors, Time Behavior, and Score placement.
Sync and async generation follow that order. File-backed notes do not receive
the flat-source M16 seek finalization when this contract is unavailable.

**Rationale**: `SoundLayer` prunes objects by declared start and subjective
duration before calling their generators. A linked `Instance` normalizes the
notes returned by its source, so translating the selected window requires a
known origin before that pruning. Dynamic generators reveal their note starts
only when executed; running them to discover an origin and then again to
generate the selected range can repeat side effects or change results.
Processor chains may reorder, copy, or move notes after generation, and time
behavior may transform their positions. An out-of-span GenericScore event can
be parsed early, but its declared duration still causes layer pruning; changing
that rule would alter legacy range behavior. Java Blue's `Instance` delegates
one source generation call and its `PolyObject` applies processors and time
behavior afterward, so it offers no broader pre-generation origin guarantee.

**Future contract needed**: A source would have to opt in with a pure,
range-independent description of its generated origin and full span before
layer pruning, plus defined mappings through each container, processor, and
time transformation. A selected render must execute each generator and
processor once, preserve ordering in synchronous and asynchronous paths, and
state whether off-range sources execute. The current generator and processor
contracts provide none of those guarantees. Existing `Instance` regressions
cover the bounded path and the dynamic, out-of-span, scaled, nested, and
processor fallback cases; no unsupported M16 claim is added to the manual.

## Decision 22: Rebase nested selected ranges once

**Decision**: A nested PolyObject leaves selected-range note rebasing to its
outer PolyObject after child placement. Direct PolyObject generation still
rebases its own output. This keeps notes in a finite range when containers are
nested without changing their authored beat positions.

**Evidence**: In range `[9,10]`, a PolyObject at beat 8 with child GenericScore
notes at local beats 1 and 1.5 produced no notes before the change. A
sync/async Score regression failed with an empty note list; it now yields
starts at 0 and 0.5. The rebuilt macOS package produced the same two score
events, also with a container at beat zero. Java Blue's
`PolyObject.processNotes` subtracts the render start at each container level,
so this is an intentional Blue 3 correction to the same nested behavior.

## Decision 23: Current screenshots and external comparison baseline

The user requested removal of the duplicated original on 2026-09-30. All 94
original topic files were verified byte-for-byte against the upstream checkout
at the pinned commit before removal. The chapter change report summarizes
rewrites and consolidation, rather than treating the migration as a mechanical
line diff. Current screenshots come from an isolated macOS package with sample
projects and no personal settings. Verify local image loads after clean rendering
and packaging. No old Java screenshot is reused as current Blue 3 UI.
