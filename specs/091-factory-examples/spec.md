# Feature Specification: Factory Example Content

**Feature Branch**: `091-factory-examples`

**Created**: 2026-08-26

**Status**: Complete (2026-08-26)

**Input**: User description: "Treat Blue's packaged example projects as pristine factory content. When a user selects Open Example, prepare a user-owned copy when needed, prefer that copy on future opens, and safely make newly shipped or updated examples available without overwriting user edits."

## Clarifications

### Session 2026-08-26

- Q: How should the factory revision identity and per-file provenance be tracked (drives FR-008 update detection and FR-011 user-modified detection)? → A: Content hash manifest; record each factory file's relative path plus content hash at copy/update time, and derive the factory revision from that manifest.
- Q: When the user has manually deleted some (but not all) example files from their user-owned library, what should Open Example do (defines "valid" in FR-007)? → A: The library stays valid whenever its root and provenance record exist; it is used as-is, and absent files are treated as user-modified and never silently restored by updates.
- Q: When the installed factory revision differs from the library's recorded revision but is not provably newer (e.g., app downgrade), what should Open Example do? → A: Treat any different revision the same as a newer one: offer Update and Open, Keep Current and Open, or Cancel. An accepted update syncs untouched files to the installed factory content and never deletes user files.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Examples from a Protected Installation (Priority: P1)

As a Blue user on a managed, read-only, or otherwise protected installation, I want Open Example to prepare a writable user-owned example library so that I can open and render examples without manually locating or copying files.

**Why this priority**: Opening and rendering the examples is the primary user value, and it currently fails when the installed example directory cannot receive the temporary CSD and related render artifacts.

**Independent Test**: Use an installation fixture whose packaged examples can be read but whose installation directory cannot be written. Select Open Example, accept the first-use copy, open an example with relative assets, and render it successfully.

**Acceptance Scenarios**:

1. **Given** the packaged factory examples are available and no user-owned example library exists, **When** the user selects Open Example, **Then** Blue explains that it will create a user-owned copy and offers Copy and Open or Cancel.
2. **Given** the user accepts Copy and Open, **When** preparation completes, **Then** the complete example tree is available in the user-owned location with its relative layout preserved, the example picker opens from that location, and the packaged factory content has not been changed.
3. **Given** an example has a relative asset, script, or auxiliary-file reference, **When** the copied example is opened and rendered, **Then** the reference resolves from the copied project location without the user having to relocate files.
4. **Given** the user cancels the first-use copy or preparation fails, **When** the Open Example flow ends, **Then** the active project is not replaced, the packaged factory content is unchanged, and Blue presents a clear recoverable explanation when a failure occurred.

---

### User Story 2 - Work from a Persistent User Copy (Priority: P2)

As a user who has opened an example before, I want Blue to reopen my user-owned copy so that my edits are preserved while the installed factory examples remain pristine.

**Why this priority**: Examples are learning material and starting points. Users need to modify and save them without corrupting the source that future users or future sessions depend on.

**Independent Test**: Create the user-owned example library through Open Example, modify and save one example, close it, and use Open Example again. Verify that the saved edit is present and the packaged source is unchanged.

**Acceptance Scenarios**:

1. **Given** a valid user-owned example library exists, **When** the user selects Open Example, **Then** Blue uses the user-owned library as the source for the picker and does not create a second copy or repeat the first-use prompt for the same factory revision.
2. **Given** the user edits and saves an example, **When** the user later opens that example again, **Then** the saved changes are present in the user-owned library.
3. **Given** the user-owned copy exists, **When** the user opens, edits, renders, or saves an example, **Then** Blue does not write project or temporary render files into the packaged factory example tree.

---

### User Story 3 - Receive New Factory Examples Safely (Priority: P2)

As a user with an existing example library, I want Blue to tell me when the installed factory examples have changed and offer a safe update so that I can receive new examples without losing my work.

**Why this priority**: Blue releases may add examples, fix broken references, or improve existing examples. Those improvements must be available without turning an update into an overwrite of user-authored work.

**Independent Test**: Seed a user-owned library from factory revision A, replace the packaged source with revision B containing a new example, an unchanged example, a changed unmodified file, and a changed user-edited file, then select Open Example.

**Acceptance Scenarios**:

1. **Given** the packaged factory revision is newer than the user-owned library, **When** the user selects Open Example, **Then** Blue offers Update and Open, Keep Current and Open, or Cancel before opening the picker.
2. **Given** the user chooses Update and Open, **When** the update completes, **Then** new factory files are added, changed factory files that the user has not modified are refreshed, user-created files are retained, and user-modified factory files are retained rather than overwritten.
3. **Given** the update encounters a user-modified file that also changed in the factory, **When** the user-owned library is opened, **Then** Blue reports the conflict and identifies the affected example/file without silently replacing the user’s version.
4. **Given** the user chooses Keep Current and Open, **When** the current factory revision is checked again, **Then** Blue does not repeatedly prompt for that same revision, but it offers the check again when a still newer factory revision is available.
5. **Given** a factory file was removed in a later revision, **When** the user updates, **Then** Blue does not automatically delete the corresponding user-owned file.

### Edge Cases

- The packaged factory examples are missing, unreadable, or incomplete. Blue must not open a partial factory tree; if a valid user-owned library exists, Blue may offer it with an explicit notice that factory updates are unavailable. If neither source is usable, the flow ends with a recoverable error.
- The user-owned destination cannot be created or written because of profile restrictions, a full disk, or another filesystem failure. Blue must leave both the active project and packaged factory content unchanged and explain what the user can do next.
- Copying or updating is interrupted. Blue must not present a partially prepared library as complete; a later Open Example action must be able to retry or recover without duplicating or corrupting files.
- A user-created file has the same relative path as a new factory file. The user-created file is retained and the collision is reported as part of the update result.
- The active project is an example with unsaved changes when an update is available. Blue must not modify that active file underneath the user; the existing save/discard/cancel protection must be applied before a replacement could affect the active project, or the update must be deferred until it is safe.
- The user-owned library is removed or moved between sessions. Blue may offer to create a fresh copy, but it must not claim that the user’s previous edits still exist.
- The user manually deletes some example files from the user-owned library. The library remains valid and is used as-is; a baseline file that is absent from the library is treated as user-modified, and updates MUST NOT silently restore it.
- The packaged examples directory is writable. Blue must still treat it as factory content and must not use writeability as permission to edit or render temporary files there.
- The installed factory revision differs from the recorded one because the application was downgraded or repackaged. Blue treats any different revision the same as a newer one: it offers Update and Open, Keep Current and Open, or Cancel, and an accepted update syncs untouched files to the installed factory content without deleting or overwriting user-modified or user-created files.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Blue MUST treat all examples shipped inside the application installation as immutable factory content.
- **FR-002**: The Open Example action MUST prepare and resolve the user-owned example library only when the user invokes Open Example; Blue MUST NOT perform the copy or update check at application startup, installation time, or as a background task.
- **FR-003**: Blue MUST NOT use the packaged factory directory as the active editable or rendering source, even when that directory is writable.
- **FR-004**: On first use, Blue MUST offer the user a clear choice to copy the factory examples into a dedicated, user-owned Blue data location and open from that copy, or to cancel the action.
- **FR-005**: A first-use copy MUST include the complete factory example tree and preserve each file’s relative path, including project files, media, scripts, score resources, and other auxiliary files required by examples.
- **FR-006**: After a successful first-use copy, Blue MUST open the example picker from the user-owned library and pass the selected user-owned project through the normal project-opening lifecycle.
- **FR-007**: On every later Open Example action, Blue MUST prefer a valid user-owned example library over the packaged factory source. A library is valid when its root directory and provenance record are present; manually deleted files do not invalidate it.
- **FR-008**: Blue MUST associate the user-owned library with the factory revision from which it was created or last updated, and MUST use that association to determine whether a newer factory revision is available. File timestamps alone MUST NOT be the only basis for deciding that an update is available. The factory revision MUST be derived from a content manifest that records each factory file's relative path and content hash, captured when the library is created or updated. Because this content-derived revision is unordered, an update is considered available whenever the installed factory revision differs from the revision the user has accepted or declined; direction (newer or older installation) does not change the offer.
- **FR-009**: When a newer factory revision is available, Blue MUST offer Update and Open, Keep Current and Open, or Cancel as part of the Open Example flow before opening a project.
- **FR-010**: An update MUST apply to the complete example library so that projects and their relative dependencies remain coherent.
- **FR-011**: An update MUST add new factory files and refresh changed factory files only when the corresponding user-owned file still matches the previously accepted factory content. It MUST retain user-modified files and user-created files.
- **FR-012**: An update MUST NOT automatically delete files from the user-owned library solely because they are absent from a newer factory revision.
- **FR-013**: Blue MUST report update conflicts and incomplete results in terms that identify the affected example or file, while leaving the user’s content available.
- **FR-014**: Choosing Keep Current MUST open the existing user-owned library and record that the user has declined the currently available factory revision; Blue MUST offer an update again when a newer revision becomes available.
- **FR-015**: Copy and update operations MUST be recoverable. If they cannot complete, Blue MUST leave the packaged factory content unchanged, avoid replacing the active project, and provide a retry or otherwise actionable recovery path.
- **FR-016**: The feature MUST preserve existing `.blue` project compatibility, relative resource references, unknown project data, and the normal unsaved-project and active-render protection used when replacing the current project.
- **FR-017**: Factory revision, file provenance, update decisions, and copy status MUST be persisted outside `.blue` project XML and outside the packaged factory tree.
- **FR-018**: Normal project opening outside the Open Example menu action MUST retain its existing path-selection behavior; this feature is limited to the packaged-example lifecycle.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue’s example action opens projects from the installed examples tree, and its render preparation uses the current project directory for temporary CSD work. The current TypeScript implementation similarly resolves packaged examples and hands the selected packaged path to the normal project-opening lifecycle; disk rendering first attempts to place a temporary CSD beside the project before trying the operating-system temporary directory.
- **Compatibility Requirements**: `.blue` XML remains the canonical project format. The user-owned library MUST preserve the packaged examples’ directory layout and all files needed by existing relative references. Opening an example from the user-owned library MUST continue through the existing project replacement, parsing, save, render, and engine contracts. No project XML fields are required for factory-copy state.
- **Intentional Divergences**: The Open Example menu action will no longer make a packaged path the active editable/rendering source. Instead, it will lazily create or use a user-owned copy so that factory content remains pristine and writable project-relative render work has a stable location. This is an intentional divergence from the current TypeScript and Java-installed-tree behavior, limited to the Open Example workflow.
- **State Ownership**: Packaged factory files are owned by the application installation and are read-only by policy. The user-owned example library, its factory revision/provenance records, and update decisions are owned by Blue’s per-user application data and are separate from program settings and `.blue` project XML. The active project remains owned by the main project document lifecycle. Temporary CSD and render artifacts remain disposable derived files.

### Key Entities *(include if feature involves data)*

- **Factory Example Set**: The pristine examples shipped with a particular Blue release, including the complete relative file tree and a stable factory revision identifier derived from a content manifest (each factory file’s relative path plus content hash).
- **User Example Set**: The user-owned working copy used by Open Example, including the user’s saved changes and any user-created files.
- **Factory File Record**: The relative path, accepted factory baseline (content hash of the accepted factory version), and current provenance/status used to distinguish an untouched factory file from a user-modified or user-created file. A file whose content hash differs from its accepted baseline, or that is absent from the library while its baseline exists, is treated as user-modified.
- **Example Update Decision**: The remembered relationship between a user-owned library and a factory revision, including whether the user updated or kept the current library.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a read-only-installation test, 100% of users who choose Copy and Open can reach an example picker and open a project without manually copying files or changing installation permissions.
- **SC-002**: 100% of currently shipped examples that render successfully from a writable source continue to resolve their relative assets and render successfully from the user-owned library.
- **SC-003**: Across first-use copy, open, edit, save, and render tests, zero application-created files or modifications occur in the packaged factory example tree.
- **SC-004**: For a user-owned library at the current factory revision, repeated Open Example actions produce zero additional first-use copy prompts and zero duplicate library copies.
- **SC-005**: During an update, zero user-modified or user-created files are overwritten or automatically deleted.
- **SC-006**: For every simulated copy/update failure in the acceptance test suite, 100% of cases leave the active project unchanged, preserve the packaged factory source, and provide a recoverable user-facing outcome.
- **SC-007**: When a newer factory revision is accepted, 100% of new factory examples included in that revision are available from the next Open Example picker without requiring a reinstall or manual file operation.

## Scope Boundaries

### In Scope

- Lazy preparation of packaged examples when Open Example is invoked.
- A persistent user-owned copy with factory revision/provenance tracking.
- Safe updates for new and changed factory content.
- Preservation and reporting of user edits, user-created files, conflicts, and copy/update failures.
- Relative-asset rendering from the user-owned example location.

### Out of Scope

- Downloading example content from the internet or synchronizing examples between computers.
- A general-purpose project migration or backup tool.
- Automatically replacing or deleting user-owned example files.
- Changing the behavior of projects opened through the normal Open Project action.
- A new user interface for manually selecting, relocating, or resetting the user-owned example-library location.

## Assumptions

- “Latest examples” means the newest factory revision bundled with the installed Blue release; network-delivered example updates are a separate feature.
- Blue’s existing per-user application-data location is available for the user-owned library in supported installations; if it is not writable, the feature reports the failure rather than writing into the installation directory.
- The packaged example tree has stable relative paths within a factory revision, and copying the complete tree is acceptable for the current example-library size.
- A user-owned library is persistent user work and is not automatically cleaned up when a newer application version is installed.
- The first version of this feature can treat an existing user-owned library without provenance records conservatively: preserve it and avoid destructive replacement, while making a fresh factory copy or a later migration an explicit future decision.
