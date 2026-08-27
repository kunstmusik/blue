# Research Record: Factory Example Content

**Feature**: [Factory Example Content](spec.md)

**Date**: 2026-08-26

**Branch**: `091-factory-examples`

## Repository Findings

- [`example-project-path.ts`](../../packages/blue-app/src/main/example-project-path.ts) resolves the
  development tree and the packaged `resources/assets/examples` candidates, but has no per-user
  overlay.
- [`main.ts`](../../packages/blue-app/src/main/main.ts) opens the selected packaged `.blue` path
  through the accepted-target project replacement flow. The flow reads and parses the selected
  project before the library/save decisions and commits only after those decisions succeed.
- [`render-command.ts`](../../packages/blue-app/src/main/render-command.ts) first writes the
  generated temporary CSD beside the project, then falls back to the operating-system temporary
  directory. The fallback changes the CSD's directory and therefore breaks relative asset lookup
  for examples in a protected installation.
- [`program-settings-store.ts`](../../packages/blue-app/src/main/program-settings-store.ts) already
  establishes `app.getPath('userData')` as Blue's app-owned per-user storage root and demonstrates
  temporary-file-plus-rename JSON persistence.
- [`project-replacement-flow.ts`](../../packages/blue-app/src/main/project-replacement-flow.ts)
  provides the correct preflight, parse, no-op, library-draft, save, and commit ordering. Example
  library preparation must compose with that flow instead of mutating the active project early.
- [`electron-builder.yml`](../../packages/blue-app/electron-builder.yml) copies the complete
  `assets/examples` tree into packaged resources. The current tree contains 107 files and is about
  18 MB, including `.blue`, CSD, media, scale, image, script, and analysis files; the whole tree is
  the copy/update unit.

The Java references confirm the same installed-tree assumption:

- [`OpenExampleProjectAction.java`](/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenExampleProjectAction.java)
  opens examples from the installation tree.
- [`TempFileManager.java`](/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/utility/TempFileManager.java)
  creates a supplied-directory temporary file and reports failure when it cannot do so.

## Decision 1: Immutable Factory Source and User-Owned Working Copy

**Decision**: Treat the packaged tree as immutable factory content on every platform and in every
installation, regardless of its actual write permissions. `Open Example` always resolves an
editable/renderable project from Blue's user-owned example library; it never opens a packaged
factory path as the active project.

**Rationale**: This guarantees that rendering can place the temporary CSD beside the copied
project, protects the source from edits, and avoids permission-dependent behavior. It also matches
established content boundaries: Arduino documents built-in examples inside the application folder
and advises that application files generally not be changed; Godot separates likely-read-only
resource content from guaranteed-writable user data; Ableton describes its Core Library as factory
content users cannot change. See [Arduino application/example locations](https://support.arduino.cc/hc/en-us/articles/4415103213714-Find-sketches-libraries-board-cores-and-other-files-on-your-computer),
[Godot resource and user-data paths](https://docs.godotengine.org/en/4.5/tutorials/io/data_paths.html),
and [Ableton's factory-content boundary](https://help.ableton.com/hc/en-us/articles/209774665-The-Live-Browser).

**Alternatives considered**:

- Copy only when the installation directory is not writable. Rejected because a writable package
  would still be edited in place and future upgrades could replace those edits.
- Change render working-directory or asset-resolution behavior globally. Rejected because it is a
  broader project/rendering change and does not protect factory examples from Save operations.
- Open factory projects read-only. Rejected because examples are intended to be modified and used
  as project starting points.

## Decision 2: Lazy App-Owned Storage

**Decision**: Store the library under a dedicated subdirectory of Electron's app-specific
`userData` path. The planned layout is:

```text
<userData>/examples/
├── current/
│   ├── content/          # Open Example picker root
│   └── state.json        # accepted factory baseline and decisions
├── operation.json        # present only during a staged transaction
├── staging-<id>/         # Blue-owned candidate library
└── backup-<id>/          # Blue-owned rollback generation during commit/recovery
```

No directory or file is created until the user invokes `Open Example` and accepts Copy and Open
or Update and Open. The path is derived each time from the current app `userData` root; absolute
paths are not persisted in project XML or the state document.

**Rationale**: Electron identifies `userData` as the app-specific per-user data location and
recommends placing app-owned files in a subdirectory to avoid conflicts with Chromium-managed
folders. Blue already uses this root for program settings. Keeping content and provenance under one
dedicated parent makes staging, containment checks, and recovery explicit. See the
[Electron `app.getPath()` contract](https://www.electronjs.org/docs/latest/api/app).

**Alternatives considered**:

- Write directly into the user's home directory. Rejected because it adds a top-level visible
  folder and bypasses the application's established per-user storage convention.
- Store content in the operating-system temporary directory. Rejected because examples and user
  edits must survive restarts and upgrades.
- Add the state to `program-settings.json`. Rejected because the per-file baseline is a separate
  durable domain with independent recovery and can grow with the example tree.

## Decision 3: Runtime SHA-256 Factory Manifest

**Decision**: Build a deterministic factory manifest lazily from the actual installed tree the
first time `Open Example` needs it in an app session. Each regular file contributes its normalized
relative path, byte size, and SHA-256 content hash. Records are sorted by serialized relative path;
the SHA-256 of the canonical manifest payload is the unordered factory revision identifier. Cache
the resulting immutable manifest for the remainder of the app session.

Serialized relative paths use `/`. Native paths remain untouched for filesystem calls and are
created from validated path components only. Factory symlinks and path/case collisions that cannot
be represented safely on the host are treated as invalid factory input rather than followed.

**Rationale**: A content-derived revision handles new releases, repackaging, and downgrades without
trusting timestamps or assuming version ordering. Runtime generation describes the files actually
installed and avoids a generated manifest that contributors could forget to refresh. The current
107-file/18-MB tree is small enough to hash sequentially only on this user-triggered path; caching
removes repeated work in the same session.

**Alternatives considered**:

- Use the Blue application version as the revision. Rejected because examples can be repackaged or
  corrected without a reliable monotonic relationship to app version, and downgrades are explicit
  scope.
- Use file modification times. Rejected by FR-008 and because packaging can rewrite timestamps.
- Commit or build a manifest into the package. Rejected for the first implementation because it
  adds a generation/verification build step while runtime hashing is bounded and authoritative.
- Use a non-cryptographic aggregate. Rejected because SHA-256 is available in the existing Node
  runtime and gives one stable content identity without a new dependency.

## Decision 4: Baseline-Aware, Non-Destructive Merge

**Decision**: The user state retains the accepted factory hash for every path ever seen, including
factory-removed paths. On an accepted different revision, classify each path using the accepted
baseline, current user entry, and installed factory entry:

- New factory path + absent user path: add it.
- New factory path + existing user entry: preserve it and report a collision.
- Changed factory path + user file still matching its baseline: replace it.
- Changed factory path + changed, missing, or non-regular user entry: preserve the user state and
  report a conflict.
- Factory-removed path: preserve the user entry or deletion; retain a provenance tombstone.
- User-only paths: preserve them.

After a successful update, the accepted revision and per-path factory baselines advance to the
installed manifest even where a user conflict was preserved. A later update can therefore compare
the user entry against the most recently processed factory content without prompting again for the
same revision.

**Rationale**: This directly implements FR-011/FR-012 and the clarification that user deletions are
intentional modifications. Retaining removed-path tombstones prevents a later reintroduced factory
file from being mistaken for an unrelated new path.

**Alternatives considered**:

- Replace the whole user tree from factory. Rejected because it destroys edits and user files.
- Add only missing files. Rejected because users would never receive fixes to untouched examples.
- Create `.orig` or conflict copies beside every edited file. Rejected because it pollutes relative
  project trees and changes which assets an example may resolve.
- Delete factory-removed files only when untouched. Rejected because the product decision is never
  to automatically delete user-owned content.

## Decision 5: Staged Candidate Before Project Replacement

**Decision**: Initial copy and accepted updates prepare a complete candidate generation under
`staging-<id>/` without changing `current/`. The Open Example picker opens on the candidate
`content/` tree; the selected `.blue` file is required to resolve inside that tree and is read and
parsed there. Only after the existing render, library-draft, and project-save gates succeed does
the flow atomically activate the candidate and install the parsed project under the corresponding
path in `current/content/`.

If the user cancels the copy/update prompt, file picker, library decision, or save decision, the
staging generation is discarded and both the active project and current example library remain
unchanged. A same-file selection is a no-op only when there is no staged library mutation; an
accepted update may legitimately reload the same example path with updated factory content.

**Rationale**: The existing accepted-target replacement flow intentionally defers save prompts
until after a valid file is selected. Staging preserves that behavior and solves the difficult
case where the active project is an unsaved example that the update may otherwise change on disk.
It also lets newly added examples appear in the same picker that follows Update and Open.

**Alternatives considered**:

- Update `current/` before showing the picker. Rejected because a canceled picker or canceled save
  decision could leave the active unsaved example modified underneath the user.
- Prompt/save before updating, then show the picker. Rejected because the existing discard choice
  does not replace the in-memory project until commit, and would create duplicate or premature
  save prompts.
- Show the current picker and apply the update afterward. Rejected because newly added examples
  would require a second Open Example action to become selectable.

## Decision 6: Same-Filesystem Generation Swap and Recovery Journal

**Decision**: Build staging and backup generations below the same `<userData>/examples` parent.
Before commit, verify that the source user-library snapshot used to build the candidate has not
changed; if it changed, abort and ask the user to retry. Commit uses an fsynced operation journal,
renames `current` to the owned backup, renames staging to `current`, then removes the backup and
journal. The next `Open Example` always recovers a recognized interrupted transaction before
inspection:

- Complete activation when `current` is absent and a verified staged generation plus matching
  journal exists.
- Restore the verified backup when the staged generation is missing or invalid.
- Keep a verified `current` generation and clean only recognized Blue-owned leftovers.
- Never delete an unrecognized directory or an invalid user generation automatically.

**Rationale**: Node documents that copy operations are not atomic. Hiding copy work in a staging
generation and using same-filesystem renames prevents partial content from being treated as ready;
the journal covers the two-rename gap and process interruption. The repository's existing migration
state stores provide the durable-write precedent. See the [Node filesystem API](https://nodejs.org/api/fs.html).

**Alternatives considered**:

- Copy directly into `current/content`. Rejected because partial failures are externally visible.
- Apply file replacements in place with no journal. Rejected because a crash can leave content and
  provenance disagreeing, causing later user files to be misclassified.
- Keep every historical generation indefinitely. Rejected because the library is small but user
  media can grow; one rollback generation is sufficient for transaction recovery.

## Decision 7: Main-Process Deep Module, No New IPC

**Decision**: Implement the filesystem domain as a main-process `example-library/` module with a
small orchestration interface. Separate deterministic manifest/merge logic and durable-state
validation from filesystem transaction orchestration. Add a dependency-injected Open Example flow
coordinator so prompt ordering and cleanup can be tested without Electron. `main.ts` supplies the
factory/user paths, native confirmation calls, picker, and existing project install callbacks.

No renderer, preload, `@blue/data`, project XML, engine protocol, or program-settings contract is
added. Decisions use `showNativeConfirmation`; failures are fail-closed and return typed outcomes.

**Rationale**: Electron main already owns files, process paths, native dialogs, and the canonical
project lifecycle. Pure merge/manifest/state seams enable injected `EACCES`/`EPERM`, rename, and
interruption tests without POSIX-only permission tricks.

**Alternatives considered**:

- Put the copy logic directly in `main.ts`. Rejected because hashing, merge classification,
  transaction recovery, and failure injection form a separate durable state domain.
- Expose the manager through preload/IPC. Rejected because the menu action and all required UI are
  main-owned; renderer access would expand the authority surface without user value.
- Put manifest logic in `@blue/data`. Rejected because it requires Node filesystem/crypto and would
  violate the portable data-core boundary.

## Decision 8: Declined and Unordered Revisions

**Decision**: Persist both `acceptedFactoryRevision` and an optional `declinedFactoryRevision`.
Prompt whenever the installed revision matches neither value. Keep Current records the installed
revision as declined; Update advances the accepted revision and clears the declined revision.
Equality, not ordering, controls behavior.

**Rationale**: Content hashes have no newer/older ordering. This implements the clarified downgrade
and repackaging behavior while suppressing repeated prompts for the same declined content.

**Alternatives considered**:

- Prompt whenever installed differs from accepted. Rejected because Keep Current would nag on every
  Open Example action.
- Compare app semantic versions. Rejected because the factory revision is intentionally derived
  from content and must handle repackaging.

## Resolved Unknowns

No unresolved technical questions remain. In the specification, the Clarifications section controls
where older scenario text still says “newer”: operationally, “update available” means an installed
factory revision that matches neither the accepted nor declined revision.
