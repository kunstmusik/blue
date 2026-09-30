# Implementation Plan: Integrate the Blue 3 manual

**Completion (2026-09-30)**: The accepted implementation is complete, including
manual delivery and the app/data/Java/native repairs uncovered by validation.
The final converge assessment added no tasks. The initial documentation-only
checks and earlier batch descriptions below are historical; later repair
sections define the expanded scope. All project writers retain the canonical
history path, the XML schema remains compatible and runtime metadata is
disposable. T122/T123/T132 remain deferred validation, not passes. See
`spec.md`, `quickstart.md`, `manual-issues.md` and `code-review.md` for current
acceptance and evidence.

**Current source policy (2026-09-30)**: Original-topic comparisons refer to the
pinned upstream Blue 2 edition. Earlier migration phases below describe work
completed before consolidation; only the current 35 chapters and Blue 3 assets
are shipped. See `manual-changes.md` and the current navigation contract.


**Branch**: codex/integrate-manual | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

## Summary

Reference the upstream Blue 2 Quarto source by pinned commit, review its topics into a current Blue 3 book, render the book at package time, include it in application resources, and open it through the native menu. Keep online publication deferred until a Blue 3 destination and version policy are chosen.

## Technical Context

**Language/Version**: Quarto 1.10.18, TypeScript 5.9, Electron 39\
**Primary Dependencies**: Existing Quarto book format, electron-builder extraResources, Electron shell API\
**Storage**: Versioned manual source under docs/manual; ignored generated HTML under docs/manual/_build/html; installed HTML under resources/assets/manual\
**Testing**: Quarto render, generated-link check, menu test, package-input gate, packaged-app smoke, app main build, lint\
**Target Platform**: macOS arm64, Windows x64, Linux x64\
**Project Type**: Desktop app plus static documentation\
**Performance Goals**: Manual opens with one menu action; no network request needed for navigation\
**Constraints**: No Java Blue guidance presented as current Blue 3 instructions; Quarto need only be installed on build hosts; no change to .blue project data\
**Scale/Scope**: 94 upstream sources mapped to 35 current Blue 3 chapters; no draft routes

## Constitution Check

### Before research

- **Portable data core**: PASS — no @blue/data changes.
- **Java and project compatibility**: PASS — Java manual provenance is recorded upstream; XML and CSD behavior do not change.
- **Canonical ownership and contracts**: PASS — repository source is canonical; generated HTML is disposable; native menu command has no project state.
- **Project history and undo/redo**: N/A — no project content changes.
- **Runtime and engine isolation**: PASS — Electron main resolves the installed path and opens it through the OS.
- **Host-path portability**: PASS — native path.join/resolve values reach filesystem and Electron shell unchanged; package smoke runs on all three targets.
- **Verification evidence**: PASS — Quarto render, app menu test, package input and installed resource checks, build and lint are planned.

## Research and design

See [research.md](research.md) for source ownership, offline navigation, packaging, and publishing decisions. See [data-model.md](data-model.md) for the documentation artifacts and [contracts/manual-navigation.md](contracts/manual-navigation.md) for the user-visible and package contracts.

## Project Structure

```text
docs/manual/
  _quarto.yml
  *.qmd
  COPYING.GFDL
  images/                 current Blue 3 screenshots
  _build/html/             ignored generated output
packages/blue-app/
  src/main/application-menu.ts
  src/main/main.ts
  electron-builder.yml
scripts/verify-package-inputs.mjs
specs/114-integrate-blue-manual/
  manual-issues.md
```

The contributor review ledger is maintained at
`specs/114-integrate-blue-manual/manual-issues.md`.

**Structure Decision**: Keep editable documentation beside the application. Package a rendered copy as an extra resource so a system browser can display it offline.

## First migration batch

**Before research Constitution Check**: All five principles remain satisfied:
this batch changes only documentation source and Quarto navigation. It does
not change project data, runtime code, host paths, or persistence. Reviewed
instructions will be checked against the current app and legacy reference.

Use Quarto book parts for Getting started, Working in Blue, Concepts, and
Reference. Omit How-to guides until a reviewed guide exists. Keep the current
chapter filenames and relative links stable; add only soundobjects.qmd,
orchestra.qmd, and rendering.qmd. The six existing pages remain in the book.
Do not present copied legacy screenshots as current Blue 3 UI until reviewed.

Rewrite First project as a complete, reproducible path: create a project, add a
Generic Instrument and GenericScore SoundObject, inspect generated CSD, save,
and render with Csound 7. Expand Score from the current app controls; explain
SoundObjects as the underlying model; explain the current Orchestra editor and
render choices without Java-only steps. Keep detailed settings and mixer
material in their existing pages and cross-link instead of duplicating it.

**Post-design Constitution Check**: Portable data core, Java compatibility,
canonical state ownership, runtime isolation, and project history are
unchanged. Verification is proportional to documentation risk: compare
instructions with current UI code, render and scan every local link, follow the
tutorial with a valid Csound example, and inspect the installed book. No
constitution exception is needed.

## Second migration batch

**Before research Constitution Check**: All five principles remain satisfied.
This batch edits only manual source and navigation; it changes no project data,
host path, runtime, or persistence code. Verify claims against the archived
manual and current Blue 3 editors, especially where legacy features are
deferred or renamed.

Add six focused pages: Time, GenericScore, PianoRoll, PatternObject,
PolyObjects, and Note Processors. Keep the SoundObjects overview and the four
object-type pages as separate chapters in a dedicated Quarto book part. Keep
Time and Note Processors in Concepts and Settings in Reference. Expand Score
and SoundObjects with short paths to those pages, and add cross-links without
duplicating full explanations. Use current screenshots only after a current
image is available and reviewed. Book parts preserve the existing chapter URLs.

Check the current UI source for control labels and gestures, and the data
model or focused tests for generated-score consequences. Render the book,
scan local links and assets, inspect offline navigation, and build a local
directory package with the expanded book. Reuse the existing Quarto and
packaging pipeline; no application code changes are planned.

**Post-design Constitution Check**: Portable data core, Java compatibility,
canonical state ownership, runtime isolation, and project history are
unchanged. The original edition remains available upstream. Verification is proportional to a
documentation-only change: UI and model review, Quarto render and link scan,
focused score behavior checks, and installed-resource inspection. No
constitution exception is needed.

## Third migration batch

**Before research Constitution Check**: This batch changes documentation and
navigation only. Project data, history, host paths, and runtime code remain
unchanged.

Add SoundObject Library, Instance, and AudioFile as separate chapters in the
SoundObjects part. Preserve existing chapter URLs. Explain project and user
libraries using the current panels and transfer choices. Explain Instance
source sharing and generated-score behavior, including the duration and Time
Behavior rules verified in the later repair phase. Explain AudioFile selection,
metadata, Csound post code, and the separate audio-layer clip workflow.

Check labels against the current renderer, model behavior against source and
focused model tests, and the rendered book for navigation and offline links.
Build a directory package to inspect the installed eighteen-page manual.
Do not migrate old screenshots until their provenance and UI match are reviewed.

**Post-design Constitution Check**: Existing boundaries remain satisfied. The
upstream original is unchanged and the batch adds no application behavior. Render,
link, focused model, and package checks provide evidence for the new text.

## Post-design Constitution Check

- **Portable data core**: PASS — unchanged.
- **Java and project compatibility**: PASS — upstream edition remains available; imported copies are labeled as legacy drafts.
- **Canonical ownership and contracts**: PASS — source, generated output, and installed resources have separate owners and lifetimes.
- **Project history and undo/redo**: N/A — no project writer.
- **Runtime and engine isolation**: PASS — only Electron main uses native filesystem and shell APIs.
- **Host-path portability**: PASS — no separator conversion or serialized host paths; three-platform package verification required.
- **Verification evidence**: PASS — [quickstart.md](quickstart.md) names executable checks and offline manual inspection.

## Complexity Tracking

No constitution exception is needed.

## Full legacy draft import

Inventory every source page in the archived Quarto manual. Map overlapping
topics to reviewed Blue 3 chapters, and copy each remaining source page into
`docs/manual/drafts/` with a visible legacy draft label. Retain upstream provenance. Convert local chapter and image references for an installed,
offline book. Put SoundObject Library under Working in Blue, while preserving
its URL.

Add every draft to the Quarto book navigation and maintain
`manual-issues.md` as the per-page review queue. Do not present
unverified Java Blue controls or screenshots as current Blue 3 instructions.
Render the complete book, scan local links and assets, and inspect a directory
package offline. This is a documentation-only extension of the same feature;
application behavior and the constitution boundaries do not change.

## Score and Mixer coverage batch

Compare the archived Score Timeline and Mixer chapters with the current
renderer panels, project model, and generated CSD behavior. Expand the two
reviewed chapters with verified workflows: layer management and timeline
rows; Score Settings track-header Mute/Solo modes; channel groups, routing,
effects, sends, and project mixer settings. Keep historical details whose
behavior is not verified in `manual-issues.md` rather than copying them as
current instructions. No application or project data changes are planned.

Render the full book and scan local chapter links and assets. A documentation
only change needs no new behavioral test; current UI source and existing
focused behavior tests provide the control and generation evidence.

**Constitution Check**: The portable data core, Java compatibility, project
state ownership, runtime isolation, host path boundaries, and history rules
are unchanged. The upstream source remains intact; the reviewed chapters and
issue ledger are the only edited manual files.

## Settings and PianoRoll coverage batch

Compare the Blue 2 Program Options and PianoRoll entries with the current
Settings panels, PianoRoll editor, and score-data behavior. Expand the two
reviewed chapters with current engine, device, render-output, MIDI-input,
and OSC controls, plus note templates, editing, fields, pitch, ruler, snap,
and shortcuts. The legacy executable workflow and old Base Frequency control
description are not current instructions. Keep device tuning, note-override
copying, and platform-specific interactions in `manual-issues.md` for focused
follow-up.

Render the full book, scan local chapter links and assets, and run formatting
and whitespace checks. This batch changes documentation and Spec Kit
artifacts only; no application behavior or project data is changed.

**Constitution Check**: The portable data core, Java compatibility, project
state ownership, runtime isolation, host path boundaries, and history rules
are unchanged. The upstream source remains intact.

## Rendering coverage batch

Compare the Blue 2 Rendering entry and Project Properties draft with the
current menu, Score ruler, Project Properties panel, CSD generation, disk
render handler, and output UI. Update `docs/manual/rendering.qmd` with
verified disk/realtime CSD differences, selection and loop controls, saved
project settings, destination choice, progress/cancellation, and Play/Open
results. Correct `docs/manual/settings.qmd` where the current in-app Play
action differs from the visible legacy external-play preference. Track the
unused preference and remaining advanced recipes in `manual-issues.md`.

Render the full book, scan local links and assets, and run formatting and
whitespace checks. This documentation-only batch leaves application behavior
and project data unchanged.

**Constitution Check**: Portable data boundaries, Java compatibility,
canonical project ownership, engine isolation, path handling, and history
remain unchanged. The upstream source stays intact.

## Orchestra coverage batch

Compare the Blue 2 Orchestra Manager and Instruments overview with the
current Arrangement table, instrument editors, Libraries panel, and transfer
actions. Expand `docs/manual/orchestra.qmd` with current panel locations,
assignment fields and row commands, Generic Instrument editing, and user
library reuse. Update `manual-issues.md` as the review progresses; leave
legacy beta-project migration and runtime-specific instrument behavior as
explicit follow-up work.

Render the complete book and scan local chapter links and assets. Run
formatting and whitespace checks. No application or project-model changes
are planned.

**Constitution Check**: Portable data boundaries, Java compatibility,
canonical project ownership, engine isolation, path handling, and history
remain unchanged. The upstream source stays intact.

## Time coverage batch

Compare the Blue 2 Time System concepts with Blue 3 Score Object Properties,
AudioClip fields, Score toolbar, Ruler Configuration dialog, time-unit parsing,
and time-state patch behavior. Expand `docs/manual/time.qmd` with practical
entry examples and explicit display, snap, and conversion choices. Update
`manual-issues.md` as behavior is checked, including marker-only conversion,
non-24-fps SMPTE entry, and unverified legacy Quick Time guidance.

Render the full book and scan local chapter links and assets. Run formatting
and whitespace checks. No application or project-model change is planned.

**Constitution Check**: Portable data boundaries, Java compatibility,
canonical project ownership, engine isolation, path handling, and history
remain unchanged. The upstream source stays intact.

## SoundObjects overview coverage batch

Compare both Blue 2 SoundObjects introductions with Blue 3's Score canvas,
properties form, time-behavior implementation, and selected-range generation.
Expand `docs/manual/soundobjects.qmd` with current placement and selection
gestures, shared properties, the PolyObject editor distinction, generated
note timing, and render-range implications. Update `manual-issues.md` during
review with deferred type-specific and image checks.

Render the full book, scan local chapter links and assets, and run formatting
and whitespace checks. No application or project-model change is planned.

**Constitution Check**: Portable data boundaries, Java compatibility,
canonical project ownership, engine isolation, path handling, and history
remain unchanged. The upstream source stays intact.

## PolyObjects coverage and objective-duration fix

Compare both Blue 2 PolyObject chapters with Blue 3's Score path, grouping
patch, shared ruler and snap state, generation order, repeat behavior, and
objective-duration command. Expand `docs/manual/polyobjects.qmd` and update
`manual-issues.md` as each claim is checked. Fix the objective-duration
command in the existing project-document patch path by measuring generated
notes, and cover its canonical state, identity, dirty state, and undo/redo in
one focused ProjectHistory regression test.

Render the full book and scan local links and assets. Run affected app tests,
main build, formatting, and whitespace checks. No project-format or core data
model change is planned; the action's generated-duration behavior changes.

**Constitution Check**: Java Blue remains the generation-parity reference. For
this command, Blue 3 intentionally stores local duration—the generated
note-list end minus the PolyObject's Score start—rather than Java's absolute
generated end. The fix stays in the canonical project-history path and
preserves XML format, host boundaries, and engine isolation. The archived
source stays intact.

## Runtime-backed objective-duration completion

Measure selected PolyObjects in the main process with the existing asynchronous
generation path so Python/Clojure children and Java-backed processors are
included. Capture the current project session and revision before evaluation;
reject the result if either changes. Commit the measured local beat duration as
a resolved ProjectHistory patch value so replay, undo, and redo do not execute
runtime code. On missing runtime, generation failure, or empty output, report an
actionable error without changing the project. Update the PolyObjects chapter
and issue ledger, then run focused app tests, main build, full tests, lint,
manual render/link checks, and whitespace validation.

**Constitution Check**: Runtime execution stays in Electron main and the patch
contains only serializable duration values. Project mutations still use the
canonical history path; Java-runtime output never runs during history replay.
The measured value is the PolyObject's local duration, calculated by
subtracting its Score start from the generated note-list end; Java Blue's
command uses the absolute generated end, and Blue 3 intentionally does not
adopt that behavior.

## Score phrase and processor coverage batch

Compare the Blue 2 GenericScore, NoteProcessors, and PatternObject chapters
with Blue 3's score parser, Note Processor chain editor and scoped generation,
and PatternObject grid and timing paths. Expand the three current chapters
with verified syntax, controls, scope, and timing. Record remaining
processor-reference and grid-resizing issues in `manual-issues.md`.

Render the complete book and scan local links and assets; run formatting and
whitespace checks. No further app or project-model change is planned in this
batch.

**Constitution Check**: This batch preserves the canonical project model,
host boundaries, history behavior, and upstream manual source. The verified
PatternObject timing follows current Blue 3 generation, and the potentially
unsafe grid-resizing path remains open for a focused app change.

## Linked phrase and AudioFile coverage batch

Compare the Blue 2 Instance and AudioFile entries with current
project-library controls, source and placement generation, AudioFile
selection and metadata, and Csound playback generation. Add verified
processing-order and applicability details to the current chapters, and
record runtime and packaged-app checks in `manual-issues.md`.

Render the complete book, scan local links and assets, and run formatting
and whitespace checks. This documentation batch does not change app behavior.

**Constitution Check**: The source remains available upstream and project data, history,
host boundaries, and engine behavior remain unchanged by the chapter edits.

## Global text, Tables, and UDO chapter migration

Compare the three archived primary-editor chapters with Blue 3 workbench
panels and CSD generation. Promote the Globals, Tables, and UDO topics to
reviewed root chapters, keep their source originals in the pinned upstream Blue 2 edition, and
replace the three draft routes in book navigation. Update source accounting
and remaining issues in `manual-issues.md`.

Render a clean 90-page book and scan local links, anchors, and assets. Run
formatting and whitespace checks. No application code or project-model
behavior changes are planned.

**Constitution Check**: Project-owned text and UDOs remain in the canonical
data model; this batch changes only documentation and navigation. Archived
sources and license attribution remain intact.

## Complete archived-topic review and current book

Compare the remaining 69 draft topics with Blue 3 menus, editors, models,
generation paths, and the preserved Java sources. Consolidate related topics
into current chapters for Blue Live, project properties, note processor types,
tools, importing, workflows, command blocks, parameter automation,
instruments, specialized SoundObjects, shortcuts, about, reference, and
developer guidance. Mark unsupported Java features as historical and record
uncertain behavior in `manual-issues.md`.

Remove the duplicate draft copies and routes. Explicitly list the 35 current
chapters in Quarto navigation, map all 94 upstream source topics in the issue
ledger, and retain the upstream provenance. Clean-render the book, scan links,
anchors, and assets, and run formatting and whitespace checks. This phase
does not change application code or project data.

**Constitution Check**: Canonical project ownership, host boundaries, history,
and engine behavior remain unchanged. The upstream Java source and local license
attribution remain available for deeper reviews.

## Manual-verified behavior repair

After the chapter review, use `manual-issues.md` as the evidence
ledger for defects exposed by the current UI and generator. Repair lost
project edits first, then time/grid/editor behavior, then visible controls
that currently do nothing. Keep historical Blue Live key/MIDI trigger fields
readable without promising assignment support in this phase. Each durable
project mutation must use ProjectHistory with a semantic label and focused
commit, undo, and redo proof. Compare timing and generation changes with Java
Blue where applicable. Update the corresponding chapter only after its new
behavior is verified; remove temporary cautions when they no longer apply.

Use the owning package's test suite, `@blue/app` main build for main-process
edits, a packaged macOS first-project walkthrough, full book render and link
scan, formatting, and `git diff --check`. Windows and Linux interaction checks
remain explicit open items until those packages are run on their platforms.

**Constitution Check**: BlueData remains the canonical project owner; all
durable edits enter ProjectHistory. The data core stays host-neutral, the
renderer uses typed preload contracts, and XML import compatibility is
preserved. Generated CSD may change only to honor an existing user control.

## Selected-range origin decision

Assess the remaining M16 source types against the pre-pruning origin,
single-execution, processor-order, and synchronous/asynchronous requirements
in research Decision 21. The current interfaces cannot prove a safe origin
for dynamic, nested, transformed, processor-bearing, or out-of-span sources.
Keep their existing generation behavior and the manual's bounded claim. A
future feature may add an explicit opt-in analysis contract with independent
span and transformation semantics; this manual integration does not change
their generated CSD or project data.

**Constitution Check**: Java Blue's single source-generation call remains the
parity baseline. The bounded Blue 3 divergence is documented and covered by
focused sync/async tests. No new project writer, runtime boundary, persistence
field, or host-path behavior is introduced.

### Unknown instrument preservation (M30 verification finding)

Java Blue's `ObjectUtilities.loadFromXML` reflects the instrument class and
fails when that class is unavailable. Blue 3 intentionally opens such projects
with the unknown instrument retained as opaque XML, following the constitution's
lossless project-data requirement. Save and independent copy preserve the type,
attributes, and nested payload. Generation fails while the assignment is enabled;
disabling it allows generation without discarding the source. Arrangement XML
regression coverage and packaged save/history checks verify this divergence.

## Current source and screenshots (2026-09-30)

Keep only current chapter sources, GNU FDL license, and reviewed Blue 3 images
under `docs/manual`. Preserve the upstream commit and 94-topic map in the
feature documents; add a 35-chapter textual change report. Capture UI views
from a normally launched, isolated macOS package with disposable projects.
Add captions and alternative text, clean-render the book, scan links and image
assets, and verify that package resources contain the images without the
original source tree.
