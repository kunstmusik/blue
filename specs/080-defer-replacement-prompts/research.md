# Research: Deferred Project-Replacement Save Prompts

## Scope

This research compares the audited Electron flows with the Java Blue actions named by
the feature specification and identifies the smallest design that can enforce one
replacement boundary across project opening and imports.

## Decision: Keep prompts above the low-level disk loader

Rationale: In the Electron app, loadProjectFromDisk is shared by Open Project,
Open Example, recent/open-file-path, Revert, and packaged-project verification. A
save prompt inside that function would make internal verification and other non-user
loads interactive. The interactive wrappers must prepare and confirm; the low-level
loader must continue to read/install without project-save UI.

Alternatives considered:

- Put confirmSaveBeforeReplace inside loadProjectFromDisk. Rejected because it would
  violate FR-014 for revert/verification and would prompt after a source has already
  been handed to the loader.
- Add separate copies of the prompt to every caller. Rejected because native, keyboard,
  recent, example, and preload routes would drift again.

## Decision: Prepare before prompting

Rationale: A selected source is not yet a committed replacement until it can be
validated. Reading/parsing a .blue file, converting CSD or ORC/SCO, and building the
MIDI project can fail without changing the current project. Preparation first ensures
invalid recent paths and cancelled import modes do not show replacement prompts.

Alternatives considered:

- Prompt immediately after the first file selection. Rejected because ORC/SCO still has
  a second chooser and import mode, and it violates the requested cancellation timing.
- Prompt before parsing to avoid holding a prepared BlueData object. Rejected because
  it produces a save decision for files that cannot be opened or imported.

## Decision: Use a dependency-injected replacement-flow coordinator

Rationale: The ordering is a cross-cutting behavioral contract, while Electron dialog
and BlueData installation are host concerns. A small generic main-process module can
test preflight, preparation cancellation, no-op handling, commit re-check, prompt
ordering, and commit gating with stubbed callbacks. main.ts supplies the callbacks.

Alternatives considered:

- Test only through an Electron application boot. Rejected as slow and fragile for the
  full chooser x decision matrix.
- Introduce a renderer-owned replacement store. Rejected because main owns BlueData,
  filesystem, dialogs, and the authoritative replacement lifecycle.
- Duplicate orchestration in each main.ts action. Rejected because it recreates the
  original inconsistency.

## Decision: Add a platform-aware project path identity helper

Rationale: Current same-file checks compare raw strings. The feature requires resolve
and normalize behavior with platform case rules so recent paths and chooser paths
stored in different forms can identify the current file. The helper should not require
realpath: a recent path may be missing, and the later read should produce the existing
load error without prompting.

Alternatives considered:

- Raw string equality. Rejected by FR-004.
- Global slash replacement. Rejected because host filesystem paths must remain native.
- fs.realpathSync for every comparison. Rejected because missing paths still need a
  non-interactive load error and because identity normalization is sufficient here.

## Decision: Make save success explicit at the replacement boundary

Rationale: doSave currently catches write errors without returning failure, and
saveFileAs changes currentFilePath before the write completes. The replacement flow
must distinguish successful Save/Save As from cancellation and failure. Save As should
publish its new path only after a successful write.

Alternatives considered:

- Treat the absence of a thrown exception from the existing void doSave as success.
  Rejected because doSave catches errors internally.
- Change only the dialog return value and leave Save As path mutation in place.
  Rejected because FR-015 requires the current recovery path to remain stable.

## Decision: Preserve the MIDI pending-session boundary

Rationale: MidiImportService already returns cancellation before read/parse, retains a
tokenized preview, rejects stale project sessions, and lets the renderer keep its
mapping dialog after a cancelled commit. The timing feature should reuse that boundary
and apply the shared replacement gate only after valid mapping settings and project
construction.

Alternatives considered:

- Add a save prompt to MidiImportService.start. Rejected because the service has no
  project replacement authority and it would prompt before mapping.
- Clear the pending MIDI session whenever replacement confirmation is cancelled.
  Rejected because the existing UI contract intentionally lets the user try again.

## Java parity references

The relevant Java actions all collect their source choices before constructing and
installing the replacement project:

- /Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenProjectAction.java
- /Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenExampleProjectAction.java
- /Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportCsdAction.java
- /Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportOrcScoAction.java
- /Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/ImportMidiAction.java

The implementation intentionally does not port Java's project-manager internals. It
preserves the existing TypeScript lifecycle and changes only Electron replacement
decision timing and save-failure safety.
