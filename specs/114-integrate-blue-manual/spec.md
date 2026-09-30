# Feature Specification: Integrate the Blue 3 manual

**Feature Branch**: `codex/integrate-manual`\
**Created**: 2026-09-24\
**Status**: Complete for the accepted scope (2026-09-30)\
**Input**: Bring the separately maintained Quarto manual into the Blue repository, align the first useful chapters with Blue 3, and make it available from the app. Online publication is useful but optional.

## Completion and accepted deferrals

The final speckit-converge assessment checked all 36 functional requirements,
27 success criteria, 61 acceptance scenarios, the implementation plan and the
five constitution principles. No new implementation gaps remain. The code
review's P2 JavaScript-session finding is repaired and regression-tested.

Delivery includes 35 current chapters, all 94 upstream-topic dispositions,
eight reviewed screenshots, offline bundled navigation and the documented
application repairs. Repository tests and lint pass; macOS packaging and
offline navigation evidence is recorded in `quickstart.md` and `manual-issues.md`.

Completion uses the user's accepted scope. T122/T123/T132 remain unchecked as
deferred validation: Windows/Linux packages and developer setup, remaining
hardware/runtime, audio-encoding and specialized legacy-project coverage.
These are not validation passes. Broader M16 linked-source range semantics,
expanded screenshots/diagrams, the tutorial rewrite and online publication
remain accepted follow-up work. The reduced image coverage is documented in
`manual-changes.md`; the review and repair evidence is in `code-review.md`.

## User Scenarios & Testing

### User Story 1 - Read accurate Blue 3 guidance (Priority: P1)

A Blue 3 user can find installation, first project, settings, and score guidance that matches the current application. Java Blue source remains available in its upstream repository while current chapters identify unsupported historical behavior.

**Independent Test**: Build the manual and follow its first project instructions in Blue 3.

**Acceptance Scenarios**:

1. **Given** a fresh Blue 3 installation, **when** the user follows the installation and first project chapters, **then** no Java runtime or Java launcher steps are required.
2. **Given** the published Blue 3 manual, **when** the user navigates its table of contents, **then** no unreviewed Java Blue chapter is presented as current Blue 3 guidance.

### User Story 2 - Open the manual from Blue (Priority: P2)

A user can open the matching manual from the application's native menu, including without a network connection.

**Independent Test**: Open the menu item in a packaged app while offline and navigate between manual pages.

**Acceptance Scenarios**:

1. **Given** a packaged Blue 3 app, **when** the user selects Blue Manual, **then** the installed manual opens in the default browser.
2. **Given** a developer checkout with a rendered manual, **when** the user selects Blue Manual, **then** the local manual opens.

### User Story 3 - Maintain and publish one source (Priority: P3)

Contributors edit the manual beside the application code and can build an HTML book from the same revision. Online publication may be added without creating a second content source.

**Independent Test**: Change a chapter, render the book, and inspect the generated page.

**Acceptance Scenarios**:

1. **Given** the repository, **when** a contributor runs the documented manual build command, **then** it generates a navigable HTML book without checking generated files into Git.

### User Story 4 - Learn a complete Blue 3 workflow (Priority: P1)

A new user can complete a small project from an instrument and score event through
rendering, then find deeper explanations of the score, SoundObjects, orchestra,
and render choices in a manual organized by reader need.

**Independent Test**: Follow the first-project tutorial in Blue 3, render the
book, and navigate its reviewed chapters while offline.

**Acceptance Scenarios**:

1. **Given** a new project and Csound 7, **when** the user follows First project, **then** they can add an instrument and a SoundObject, save the project, inspect its generated CSD, and render it.
2. **Given** the current manual, **when** the user browses its contents, **then** SoundObject Library appears under Working in Blue, historical-only features are identified, and empty sections are absent.
3. **Given** the Score, SoundObjects, Orchestra, and Rendering chapters, **when** the user follows their controls and menu names, **then** they match the current Blue 3 application.

### User Story 5 - Develop score material beyond the first project (Priority: P1)

A composer can use the manual to choose a time display and snap value, write
GenericScore events, draw PianoRoll notes, trigger PatternObject cells, arrange
PolyObjects, and apply Note Processors. Each explanation connects the visible
editor to the generated Csound score.

**Independent Test**: Follow the new chapters in Blue 3, inspect generated CSD
for representative objects, and navigate the rendered book offline.

**Acceptance Scenarios**:

1. **Given** a Score with objects, **when** the user changes ruler and snap settings, **then** the manual explains display, snapping, stored time bases, and the optional conversion of existing objects and markers.
2. **Given** an instrument, **when** the user follows the GenericScore, PianoRoll, and PatternObject chapters, **then** they can create notes that target that instrument and understand how each object generates events.
3. **Given** several SoundObjects, **when** the user groups them in a PolyObject or adds a Note Processor, **then** the manual explains the available controls, nested timing, processing scope, and generated result.
4. **Given** the installed book, **when** the user follows links among current pages, **then** their links work offline and external provenance links identify the upstream Java Blue source.
5. **Given** the book contents, **when** the user opens SoundObjects, **then** the overview, GenericScore, PianoRoll, PatternObject, and PolyObjects appear together as separate pages.

### User Story 6 - Reuse SoundObjects and place recorded audio (Priority: P1)

A composer can move a SoundObject into the project library, place linked or
independent copies, and use an audio file as a SoundObject. The manual explains
how these choices affect later edits and generated output.

**Independent Test**: Follow the new pages in Blue 3, inspect a linked
Instance and an AudioFile on the Score, then navigate the rendered book offline.

**Acceptance Scenarios**:

1. **Given** a SoundObject on the Score, **when** the user adds it to Project SoundObjects, **then** the manual explains that the timeline object becomes an Instance of the project-library definition.
2. **Given** a project-library SoundObject, **when** the user places another copy on the Score, **then** the manual distinguishes Copy Instance from Copy Independent and explains which later edits are shared.
3. **Given** an AudioFile SoundObject, **when** the user selects a readable audio file, **then** the manual explains its editor, duration, generated Csound playback, and how it differs from an audio-layer clip.
4. **Given** the installed book, **when** the user opens the three new pages, **then** their links and assets work offline and historical behavior is identified.

### User Story 7 - Browse the full manual and track revision work (Priority: P1)

A reader can reach a current disposition for every legacy manual topic from
the Blue 3 book. A maintainer has one issue list for remaining accuracy and
packaged-app checks.

**Independent Test**: Render and package the book, inspect every chapter in
the contents, and compare the issue list with the upstream source mapping.

**Acceptance Scenarios**:

1. **Given** the old Quarto manual, **when** its remaining chapters are reviewed, **then** each topic appears in a current Blue 3 page or has an explicit historical-only disposition.
2. **Given** a feature unavailable in Blue 3, **when** the reader finds its current topic, **then** the page identifies the limitation instead of repeating Java controls as instructions.
3. **Given** the manual source, **when** a maintainer opens `manual-issues.md`, **then** all 94 upstream topics have a destination and remaining cross-cutting checks are listed.
4. **Given** the installed book, **when** a reader follows local chapter and image links offline, **then** all targets resolve without requiring the older manual site.

### User Story 8 - Use the Score and Mixer chapters for daily work (Priority: P1)

A composer can manage layers and timeline rows, understand the track-header
Mute/Solo mode, route channels, and work with effects and sends using current
Blue 3 controls. Material from the old chapters that still needs verification
stays in the issue list.

**Independent Test**: Compare each described action with the current Score
and Mixer UI source, render the manual, and follow its chapter links offline.

**Acceptance Scenarios**:

1. **Given** a Score with several layer groups, **when** the reader follows the chapter, **then** they can find current controls for managing layers, timeline rows, and nested score navigation.
2. **Given** a Score track and Mixer channel, **when** the reader opens the two chapters, **then** they can distinguish Event from Audio header Mute/Solo behavior and understand channel routing.
3. **Given** a mixer channel, **when** the reader wants an effect or send, **then** the manual identifies current controls and explains pre- and post-fader placement without relying on the old Mixer dialog.
4. **Given** an old feature that has not been verified, **when** the chapters are updated, **then** its remaining review work is still listed in `manual-issues.md`.

### User Story 9 - Configure Blue and edit PianoRoll notes (Priority: P1)

A composer can use current Settings controls for the managed engine, devices,
disk output, MIDI input, and OSC, then edit PianoRoll notes, fields, templates,
time display, and pitch using current Blue 3 controls. Legacy details that do
not match or have not been verified remain in the issue list.

**Independent Test**: Compare the chapters with the current Settings and
PianoRoll UI source, render the book, and follow its links offline.

**Acceptance Scenarios**:

1. **Given** Settings, **when** the reader configures the engine and an audio or MIDI device, **then** the manual identifies the current probe, module, rescan, and buffer controls without directing them to the legacy executable setting.
2. **Given** disk output, MIDI input, or OSC, **when** the reader opens Settings, **then** the manual distinguishes the related panels and describes their current save and status controls.
3. **Given** a PianoRoll, **when** the reader edits a note, **then** the manual explains its template override, copy/paste placement, field values, ruler, snap, scale, and editor shortcuts.
4. **Given** an old claim not supported by the current editor, **when** these chapters are updated, **then** the open review work remains in `manual-issues.md`.

### User Story 10 - Render and inspect the current project (Priority: P1)

A composer can select a render range, inspect the disk or realtime CSD,
choose project and application render settings, write an audio file, and use
the current Play or Open action. The manual identifies the result and error
controls in Blue 3 rather than relying on the older render workflow.

**Independent Test**: Compare the chapter with current menus, project
properties, render handlers, and output panels; render the book and check
offline links.

**Acceptance Scenarios**:

1. **Given** a Score selection, **when** the reader prepares a render, **then** the manual explains the current ruler gesture, range display, loop control, and Render Entire Project choice.
2. **Given** a need to inspect generated CSD, **when** the reader chooses a CSD command, **then** the manual distinguishes disk and realtime profiles.
3. **Given** a disk render, **when** the reader chooses a destination, **then** the manual explains File Name, Ask on Render, status, cancellation, and the separate Play and Open outcomes.
4. **Given** advanced behavior not yet verified in a packaged app, **when** the chapter is revised, **then** the issue ledger retains that work.

### User Story 11 - Organize and reuse instruments (Priority: P1)

A composer can manage the current project's Arrangement, edit an instrument,
and copy an instrument between the project and personal Libraries using Blue
3 controls. Historical library migration claims remain unverified until the
current import behavior is checked.

**Independent Test**: Compare the chapter with the current Arrangement,
instrument editors, Libraries panel, and transfer actions; render the book
and check its local links.

**Acceptance Scenarios**:

1. **Given** a project, **when** the reader adds or selects an instrument, **then** the manual identifies the current Arrangement columns, editor tabs, and row commands.
2. **Given** a reusable instrument, **when** the reader moves it between Arrangement and Libraries, **then** the manual explains the current panel locations, copy/paste and drag actions, and the project assignment's ID.
3. **Given** unsupported or old project-library material, **when** the chapter is updated, **then** its remaining review work stays in `manual-issues.md`.

### User Story 12 - Enter and display Score time (Priority: P1)

A composer can distinguish a position from a duration, enter each in the
Score Object Properties editor, choose ruler and snap formats, and decide
whether a primary-ruler change converts existing values. The manual records
current exceptions to the dialog's advertised behavior.

**Independent Test**: Compare the Blue 2 Time System chapter with current
Score toolbar, field editors, time parsing, and time-state patch logic; render
the book and check its local links.

**Acceptance Scenarios**:

1. **Given** a SoundObject, **when** the reader edits time fields, **then** the manual distinguishes positions from durations and gives valid entries for the available formats.
2. **Given** a mixed-time-base Score, **when** the reader changes its ruler, **then** the manual explains display-only, Update All, and per-field Update Matching choices using the current dialog labels.
3. **Given** a marker-only conversion or non-24-fps SMPTE entry, **when** the reader consults the manual, **then** the chapter explains the verified behavior and `manual-issues.md` records the repaired gaps.

### User Story 13 - Arrange and understand SoundObjects (Priority: P1)

A composer can place and select SoundObjects, open the appropriate editor,
adjust shared properties, and understand how visible width and selected render
ranges relate to generated notes.

**Independent Test**: Compare the two Blue 2 SoundObjects introductions
with the current Score canvas, properties panel, time-behavior implementation,
and render-start processing; render the book and check its local links.

**Acceptance Scenarios**:

1. **Given** an empty SoundObject layer, **when** the reader follows the overview, **then** they can add, select, move, resize, edit, and find shared properties using current Blue 3 controls.
2. **Given** an object whose generated notes differ in length from its Score width, **when** the reader consults the overview, **then** Scale, Repeat, Repeat (Classic), and None explain the result and identify the Note Processor order.
3. **Given** a render starting within existing material, **when** the reader consults the overview, **then** it explains the normal note-start cutoff without promising unverified type-specific partial-render behavior.

### User Story 14 - Organize a phrase with PolyObjects (Priority: P1)

A composer can create or group a PolyObject, navigate into its nested Score,
and control how child notes appear in the parent. The chapter distinguishes
current Blue 3 behavior from older per-container ruler, duration, and repeat
instructions that no longer match the app.

**Independent Test**: Compare both Blue 2 PolyObject chapters with the
current Score path, conversion patch, PolyObject generation, time-state
ownership, and objective-duration action; render the book and check links.

**Acceptance Scenarios**:

1. **Given** SoundObjects on the parent Score, **when** the reader groups them or creates a new PolyObject, **then** the manual explains the nested path, relative positions, and return to Root.
2. **Given** a nested phrase, **when** the reader selects Scale, Repeat, Repeat (Classic), or None, **then** the manual explains the effect on generated timing and repeat boundaries.
3. **Given** a shared processor or the objective-duration command, **when** the reader follows the chapter, **then** processor order and the PolyObject's local generated duration are accurate, including Java-runtime-backed children and processors; runtime failures or stale measurements leave the project unchanged.

### User Story 15 - Write and transform score phrases (Priority: P1)

A composer can enter a GenericScore phrase, apply Note Processors at the
intended scope, and build a PatternObject grid without relying on older
generation and timing advice that differs from Blue 3.

**Independent Test**: Compare the three original chapters with the current
parser, generator, processor chain editor, and PatternObject grid; render the
complete book and scan local links and assets.

**Acceptance Scenarios**:

1. **Given** GenericScore text, **when** the reader writes `i` events or supported shorthand, **then** the chapter explains relative timing, instrument fields, and the limits of accepted score syntax.
2. **Given** an object, layer, group, or Score processor chain, **when** the reader edits it, **then** the chapter explains current controls, order, scope, and legacy runtime limitations.
3. **Given** a PatternObject with quiet steps at the end, **when** the reader changes time behavior or resizes the grid, **then** the chapter explains the configured grid length and verified resize behavior.

### User Story 16 - Reuse a linked phrase and place audio (Priority: P1)

A composer can understand how a linked Instance generates and processes
notes, and how an AudioFile SoundObject generates playback from a selected
file, without relying on archived controls or unsupported transformations.

**Independent Test**: Compare the Blue 2 Instance and AudioFile entries
with current generators, project-library actions, file selection, and Score
Object editor; render the book and scan local links and assets.

**Acceptance Scenarios**:

1. **Given** a shared definition and an Instance, **when** the reader edits or places them, **then** the chapter explains source processing, Instance processing and offset, independent copies, and the verified duration and Time Behavior rules.
2. **Given** an AudioFile SoundObject, **when** the reader chooses a file and edits playback, **then** the chapter explains metadata, project media copying, Csound post code, generated duration, and the difference from an audio-layer clip.
3. **Given** an archived instruction for conversion or timing, **when** the reader consults these chapters, **then** unsupported or unverified behavior remains explicit in `manual-issues.md`.

### User Story 17 - Edit project-wide Csound sections (Priority: P1)

A composer can find Global Orchestra, Global Score, Tables, and UDO editors
in Blue 3 and understand where their content appears in a generated CSD.
The manual no longer presents the Java-era manager windows as current UI.

**Independent Test**: Compare the three original chapters with current
workbench panels and CSD generation, then render and inspect the complete
book and its local links.

**Acceptance Scenarios**:

1. **Given** project-wide orchestra or score text, **when** the reader opens its panel, **then** the chapter explains current access, generated section order, and the difference from timeline SoundObjects.
2. **Given** a function table or UDO, **when** the reader edits it, **then** the chapters identify current controls, project ownership, generated order, and CSD inspection.
3. **Given** the old manager screenshots and external UDO links, **when** the reader opens these chapters, **then** unverified material remains upstream or recorded in `manual-issues.md`.

### User Story 18 - Finish the legacy chapter review (Priority: P1)

A reader can navigate a current Blue 3 chapter for every original topic,
including editor types, processor references, tools, imports, and developer
guidance. Historical-only features are identified and the upstream original
remains intact.

**Independent Test**: Account for all 94 original `.qmd` sources, render the
complete current book from a clean output directory, and scan local links,
anchors, and assets.

**Acceptance Scenarios**:

1. **Given** any original chapter, **when** a maintainer checks the source map, **then** it has one current chapter destination and a historical limitation is marked where applicable.
2. **Given** the current book, **when** a reader opens its navigation, **then** no unreviewed draft route appears and unsupported Java controls are not given as Blue 3 steps.
3. **Given** a current chapter, **when** a behavior still needs packaged-app validation, **then** its issue remains open in `manual-issues.md`.

### User Story 19 - Repair behavior found during manual validation (Priority: P1)

A composer can follow the current manual without losing a rapid edit or using
a control that silently ignores its displayed value. The manual describes
the verified behavior after each repair.

**Independent Test**: Exercise each repaired behavior at its owning boundary,
repeat the first-project sequence in a packaged app, and inspect the generated
CSD where timing or sound generation changes.

**Acceptance Scenarios**:

1. **Given** a new project, **when** a user edits an instrument and immediately adds a GenericScore, **then** both changes persist and each history action can be undone and redone.
2. **Given** a visible timing, copy, or grid control, **when** a user changes it, **then** the generated or displayed result follows that control and survives project-history round trips.
3. **Given** a visible render or Blue Live control, **when** the user uses it, **then** it performs the documented action or the unsupported control is removed with its project data preserved for compatibility.
4. **Given** a fixed behavior, **when** the reader opens its manual chapter, **then** the chapter explains the new result and the corresponding issue is marked resolved with validation evidence.

### Edge Cases

- If the local manual is absent in development, the app must not open an unrelated or outdated online manual.
- Local pages and links must work from an installed package without network access.
- A documentation build failure must stop packaging rather than silently omit the manual.

## Requirements

### Functional Requirements

- **FR-001**: The Blue 3 repository MUST own the editable manual source and its attribution.
- **FR-002**: The Blue 3 manual MUST distinguish current guidance from original Java Blue material and explicitly identify historical-only features.
- **FR-003**: The initial current chapters MUST cover installation, first project, settings, and score navigation.
- **FR-004**: The app MUST offer a native Blue Manual command that opens the matching installed manual without network access.
- **FR-005**: Each application package MUST contain the manual generated from the same source revision.
- **FR-006**: Contributors MUST be able to render and inspect the manual locally with a documented command.
- **FR-007**: The current book MUST group chapters by reader need, keep SoundObject types together, place the SoundObject Library workflow under Working in Blue, and omit empty sections.
- **FR-008**: The first migration batch MUST provide a complete first-project tutorial and current Score, SoundObjects, Orchestra, and Rendering guidance.
- **FR-009**: Migrated material MUST identify the upstream original by repository and immutable commit, preserve attribution and the license, and MUST NOT bundle a duplicate of the original manual. Current instructions MUST be checked against Blue 3 behavior and terminology; unverified screenshots and Java-only procedures MUST not be presented as current.
- **FR-010**: The next migration batch MUST explain the current time system and Score ruler, snap, tempo, and meter controls without implying that display changes always rewrite stored values.
- **FR-011**: The next batch MUST document GenericScore, PianoRoll, PatternObject, and PolyObject creation and editing with their generated-score and time-behavior implications.
- **FR-012**: The next batch MUST document current Note Processor scope and chain editing, distinguish supported processors from deferred legacy behavior, and cross-link the related score chapters.
- **FR-013**: The third migration batch MUST document project and user SoundObject library workflows with current Blue 3 panel and action names.
- **FR-014**: The third batch MUST document linked Instance behavior, distinguish shared definitions from independent copies, and explain verified duration transformations.
- **FR-015**: The third batch MUST document the AudioFile SoundObject and distinguish it from an audio-layer clip, including file selection and generated playback.
- **FR-016**: Every legacy manual topic MUST have an explicit mapping to a current Blue 3 page or a historical-only disposition.
- **FR-017**: The source accounting in `manual-issues.md` MUST include all 94 upstream topics and track remaining validation issues.
- **FR-018**: The current book MUST preserve offline local navigation and asset loading without relying on draft routes.
- **FR-019**: The issue list MUST track possible missing detail in reviewed Blue 3 chapters whose legacy source topics are mapped rather than copied.
- **FR-020**: The current Score and Mixer chapters MUST cover verified layer and routing workflows using Blue 3 terminology, and their issue entries MUST identify details still unverified.
- **FR-021**: The current Settings and PianoRoll chapters MUST cover verified Blue 3 controls and editing behavior; outdated or unverified legacy details MUST remain in the issue list.
- **FR-022**: The current Rendering chapter MUST explain verified render-range, CSD-profile, project-option, output-path, and result workflows using Blue 3 controls; unverified advanced recipes MUST remain in the issue list.
- **FR-023**: The current Orchestra chapter MUST explain verified Arrangement, instrument-editor, and personal-library workflows using Blue 3 controls; historical migration and unverified runtime claims MUST remain in the issue list.
- **FR-024**: The current Time chapter MUST explain verified position/duration entry, ruler formats, snap, and existing-data conversion using Blue 3 controls; marker-only and SMPTE entry limitations MUST remain in the issue list until repaired and verified.
- **FR-025**: The current SoundObjects overview MUST explain verified Blue 3 placement, selection, editing, shared properties, time behavior, note-processing order, and selected-range behavior; unverified type-specific generation and legacy diagrams MUST remain in the issue list.
- **FR-026**: The current PolyObjects chapter MUST explain verified nested navigation, grouping, relative timing, repeat and processor order; Blue 3 MUST measure a PolyObject's local objective duration from its generated notes, including Java-runtime-backed children and processors. The main process MUST reject failed or stale measurements without changing the project, then commit the concrete beat duration through ProjectHistory so undo and redo do not rerun generation.
- **FR-027**: The current GenericScore, Note Processors, and PatternObject chapters MUST explain verified Blue 3 syntax, scope, chain editing, grid timing, and generated-note behavior; unreviewed processor details and grid-resizing behavior MUST stay in the issue list until repaired or verified.
- **FR-028**: The current Instance and AudioFile chapters MUST explain verified Blue 3 linked-source timing and file-playback behavior; any remaining unverified archived conversion controls MUST stay in the issue list.
- **FR-029**: The legacy Globals Manager, Tables Manager, and UDO Manager drafts MUST be replaced with reviewed Blue 3 chapters that explain current panels and generated-CSD behavior; upstream provenance and remaining validation issues MUST be retained.
- **FR-030**: The remaining editor, concept, SoundObject, instrument, processor, tool, task, reference, and developer sources MUST be reviewed into current guidance or identified as historical-only. The active book MUST omit duplicate draft copies while retaining upstream provenance.
- **FR-031**: A rapid instrument edit followed by a Score add MUST retain both changes through ProjectHistory and the first-project tutorial.
- **FR-032**: Confirmed timing, copy, grid, and history defects M03–M08, M12, and M14 in `manual-issues.md` MUST be repaired according to their desired behavior, with focused regression evidence and updated chapter text.
- **FR-033**: Visible but ineffective controls M01, M02, M09, and M10 MUST either work as their labels promise or be removed from the current UI while compatible project data remains readable.
- **FR-034**: Historical trigger metadata M11 MUST be accurately documented; restoring key or MIDI assignment is a separate feature unless a current UI advertises it.
- **FR-035**: Every issue repaired under this feature MUST update its manual chapter and ledger status after verification.

- **FR-036**: UI-oriented chapters MUST include reviewed screenshots of the current Blue 3 application where they clarify navigation or controls. Screenshots MUST use disposable, non-personal project data, include descriptive alternative text and captions, and load from bundled local assets offline.

### Existing Behavior & Data Compatibility

- **Reference Behavior**: Java Blue previously shipped a manual. The separate `blue-manual` Quarto repository contains the later Java Blue manual and is the migration source.
- **Compatibility Requirements**: The original source and images remain available in the pinned upstream edition for comparison; the current book bundles only current chapter sources and reviewed screenshot assets. Repair work must preserve supported `.blue` XML and settings data. Generated CSD and engine behavior may change where a visible control was ineffective; record intentional differences from Java Blue.
- **Intentional Divergences**: Current Blue 3 pages consolidate related upstream topics. Unsupported Java features are named as historical limitations; the original source remains in its upstream repository.
- **State Ownership**: Manual source lives in this repository; rendered HTML is disposable build output. The packaged copy belongs to the installed application resources.
- **Undo/Redo Impact**: The PolyObject objective-duration action now changes project content through the existing ProjectHistory path; its commit, undo, redo, identity, and dirty-state behavior is covered by a focused regression.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can reach the manual from the app in one menu action while offline.
- **SC-002**: The installation and first project instructions contain zero Java launcher steps.
- **SC-003**: All current manual chapter links and assets resolve in the generated book.
- **SC-004**: Every supported application package includes the manual index and its linked pages.
- **SC-005**: A new user with Csound 7 can follow the first-project tutorial from a new project to a rendered result.
- **SC-006**: The current book has no empty sections or unreviewed imported chapters in its navigation.
- **SC-007**: A reader can find an actionable Blue 3 page for each of the six next-batch topics: time, GenericScore, PianoRoll, PatternObject, PolyObject, and Note Processors.
- **SC-008**: The expanded local and packaged book has no broken chapter, anchor, or asset links.
- **SC-009**: A reader can follow current Blue 3 instructions to create a project-library definition, place a linked Instance, and understand the result of editing the shared source.
- **SC-010**: The current book has separate, linked pages for the SoundObject Library, Instance, and AudioFile, with no broken local links or assets.
- **SC-011**: All 94 legacy `.qmd` sources are mapped to current Blue 3 pages, with historical-only limitations identified.
- **SC-012**: The issue list retains outstanding current-behavior and packaged-app checks after draft removal.
- **SC-013**: The issue list has a coverage review entry for each current Blue 3 chapter; a source-topic mapping does not imply complete content migration.
- **SC-014**: The Score and Mixer chapters explain layer management, timeline rows, track-header Mute/Solo modes, subchannels, effects, and sends with current controls; both render and link correctly offline.
- **SC-015**: The Settings and PianoRoll chapters explain the current controls in User Story 9, render in the complete book, and have no broken local links or assets.
- **SC-016**: The Rendering chapter explains the current controls in User Story 10, renders in the complete book, and has no broken local links or assets.
- **SC-017**: The Orchestra chapter explains the current controls in User Story 11, renders in the complete book, and has no broken local links or assets.
- **SC-018**: The Time chapter explains the current controls in User Story 12, renders in the complete book, and has no broken local links or assets.
- **SC-019**: The SoundObjects overview explains the current controls in User Story 13, renders in the complete book, and has no broken local links or assets.
- **SC-020**: The PolyObjects chapter explains the current controls in User Story 14, renders in the complete book, and has no broken local links or assets.
- **SC-021**: The GenericScore, Note Processors, and PatternObject chapters explain the current behavior in User Story 15, render in the complete book, and have no broken local links or assets.
- **SC-022**: The Instance and AudioFile chapters explain the current behavior in User Story 16, render in the complete book, and have no broken local links or assets.
- **SC-023**: The Globals, Tables, and UDO chapters explain current behavior in User Story 17 and have no broken local links, anchors, or assets in the current book.
- **SC-024**: The 35-chapter current book covers all 94 upstream topics, has no draft routes, and a clean render has no broken local links, anchors, or assets.
- **SC-025**: The packaged first-project sequence retains the instrument and GenericScore when performed without an artificial pause, then generates the expected CSD.
- **SC-026**: Every repaired M issue has a failing-before/passing-after owner-boundary regression or equivalent packaged reproduction, a documented current result, and no stale warning in its chapter.

- **SC-027**: Current screenshots load offline from both a clean render and installed application resources; the repository and rendered book contain no duplicate original manual tree or local links to it.

## Manual structure and chapter migration

The initial six-page book is the starting point, not a commitment to the Java
manual's table of contents. As reviewed chapters are added, organize them by
reader need:

| Section | Content |
| --- | --- |
| Getting started | Installation, a complete first-project tutorial, and orientation. |
| Working in Blue | Score composition, instruments, mixing, rendering, and the SoundObject Library workflow. |
| Concepts | Time, automation, note processors, and other underlying ideas. |
| SoundObjects | Overview, common type-specific pages, and a grouped reference for specialized types. |
| Other features and tasks | Importing, audition, freeze, and project workflow. |
| Reference | Settings, shortcuts, and further terms. |

Show a section in the current book only when it has content. Link between
tutorials, concepts, and reference pages instead of repeating the same
explanation. The current 35-chapter book has a destination for each of the
94 upstream topics. `manual-issues.md` records validation and app-behavior
follow-up, while the original Java source remains available at the pinned upstream commit.

Score composition has dedicated chapters for time and snap, GenericScore,
PianoRoll, PatternObject, PolyObject, and Note Processors. The SoundObjects
part has separate pages for the libraries, linked Instances, and AudioFile,
plus a grouped reference for specialized types. Automation, MIDI import, and
other task guidance now have current destinations. Remaining depth and runtime
checks are recorded per chapter in `manual-issues.md`.

The earlier full import phase exposed legacy topics as labeled drafts. The
final review phase consolidates them into current chapters, removes draft
routes, keeps the upstream baseline identifiable, and tracks remaining packaged-app
checks in `manual-issues.md`.

## Assumptions

- The separate repository remains available as a Blue 2 manual and historical source.
- Online publication is deferred until its destination and versioning policy are chosen; the current Blue 2 Pages site is not repointed by this change.
- The original Java Blue source remains available in its upstream repository; no unreviewed draft is included in the current book.

## Source and screenshot update (2026-09-30)

At the user’s request, the original manual is referenced by upstream repository
and pinned commit instead of duplicated in this repository. Credits, GNU FDL
license, the 94-topic map, and the textual change report remain local. Current
Blue 3 screenshots replace reliance on old Java UI illustrations; screenshot
assets must be checked in the rendered and installed offline book.
