# Feature Specification: Missing Audio Asset Check On Project Load

**Feature Branch**: `053-missing-audio-assets`
**Created**: 2026-07-02
**Status**: Closed
**Input**: User description: "Check Java Blue for Missing audio asset check on project load. Use spec-kit to create a new branch and spec to match Java Blue's behavior of doing the asset check and showing a modal to resolve missing files. Ensure behavior has parity with Java blue in terms of what happens when files are resolved or not resolved when the modal is dismissed with success or cancel."

**Reference Review**: Java Blue missing audio file behavior is summarized in [research.md](research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify Missing Audio Files When Opening A Project (Priority: P1)

As a composer opening an existing project, I need blue to detect audio file references that no longer resolve so I can repair broken score objects before playback or rendering.

**Why this priority**: Users cannot make an informed repair unless the project load flow identifies missing audio files at the same point Java Blue does.

**Independent Test**: Open a project containing a mix of resolvable and missing AudioFile score-object references and verify that the project opens and a missing-file modal lists only the unique unresolved references.

**Acceptance Scenarios**:

1. **Given** a project contains only resolvable AudioFile references, **When** the project is opened, **Then** no missing-file modal appears.
2. **Given** a project contains one or more unresolved AudioFile references, **When** the project is opened, **Then** the project becomes the active open project and a modal lists the unresolved original file paths.
3. **Given** multiple AudioFile score objects refer to the same unresolved path, **When** the missing-file modal appears, **Then** that original path appears only once.
4. **Given** an AudioFile reference resolves relative to the project directory, as an absolute path, or through the user's sound-file search directory, **When** the project is opened, **Then** that reference is treated as found and is not listed as missing.

---

### User Story 2 - Resolve Missing Files From The Modal (Priority: P1)

As a composer with missing audio files, I need the modal to let me choose replacement files for listed references so all matching project references can be updated consistently.

**Why this priority**: The Java Blue workflow repairs project data by mapping original missing paths to user-selected replacement files.

**Independent Test**: Open a project with two missing AudioFile references, choose a replacement for one row, dismiss the modal successfully, save and reopen the project, and verify only the mapped reference changed.

**Acceptance Scenarios**:

1. **Given** the missing-file modal is open, **When** the user chooses a replacement file for a listed original path and confirms the modal, **Then** every AudioFile reference with that original path is updated to the chosen replacement path.
2. **Given** a replacement file is inside the current project directory, **When** the user confirms the modal, **Then** the project stores that replacement as a project-relative path.
3. **Given** a replacement file is outside the current project directory, **When** the user confirms the modal, **Then** the project stores that replacement path as chosen.
4. **Given** the current project has no project directory available, **When** the user confirms the modal, **Then** replacement paths are stored as chosen rather than converted to project-relative paths.

---

### User Story 3 - Preserve Java Blue Dismissal Semantics (Priority: P1)

As a composer, I need confirming, partially resolving, canceling, or closing the modal to affect the project exactly as Java Blue does so existing project-repair workflows remain predictable.

**Why this priority**: This feature is parity-sensitive; success and cancel behavior determine whether project data is changed.

**Independent Test**: Open the same missing-file project three times: confirm with no replacements, confirm with a partial replacement set, and cancel. Verify project paths after each dismissal match Java Blue behavior.

**Acceptance Scenarios**:

1. **Given** the modal is confirmed with no replacement rows filled, **When** it closes, **Then** no AudioFile paths are changed and the project remains open.
2. **Given** the modal is confirmed with only some rows mapped, **When** it closes, **Then** mapped original paths are updated and unmapped original paths remain unchanged without a second prompt.
3. **Given** the modal is canceled or closed, **When** it closes, **Then** no AudioFile paths are changed and the project remains open.
4. **Given** some missing references remain after successful dismissal, **When** the modal closes, **Then** the application does not block the open project, force another resolution pass, or require all missing files to be resolved.

### Edge Cases

- A project is already open and the user selects that same project from an open-project action.
- Multiple selected projects are opened in one action and more than one newly loaded project has missing AudioFile references.
- An AudioFile reference has no file path set.
- A missing original path appears in nested score content as well as top-level score content.
- A user maps two or more missing original paths to the same replacement file.
- A user chooses a replacement path that is already relative to the project directory.
- A project is opened from a backup or temporary file and has no normal project directory.
- Missing files remain after successful modal dismissal.
- The modal is dismissed through cancel, window close, or a successful confirmation with no mappings.
- The project file cannot be loaded or parsed; existing project-open error behavior remains responsible for that failure before the missing-file check can run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After a project file successfully loads, the application MUST check the Java Blue parity scope for missing audio files before the user begins normal work in the opened project.
- **FR-002**: The parity scope MUST include AudioFile score-object references found in score layer groups and nested score content.
- **FR-003**: The parity scope MUST NOT expand this feature to unrelated file references, such as BSB file selectors, audio clip media, external score scripts, generated render files, or other project-adjacent assets.
- **FR-004**: The missing-file check MUST treat a reference as found when it resolves relative to the current project directory, as an existing absolute file, or as a filename available from the user's sound-file search directory.
- **FR-005**: The missing-file check MUST ignore AudioFile references with no file path set.
- **FR-006**: The missing-file check MUST collect unresolved AudioFile paths as unique original path strings.
- **FR-007**: If the unresolved list is empty, the application MUST complete project opening without showing a missing-file modal.
- **FR-008**: If the unresolved list is non-empty, the application MUST show a modal that presents each missing original path and an empty replacement value.
- **FR-009**: The modal MUST let the user choose a replacement file independently for each listed original path.
- **FR-010**: When the user confirms the modal, the application MUST build replacement mappings only for rows whose replacement value is non-empty and different from the original path.
- **FR-011**: When confirmed mappings exist, every AudioFile reference whose current path exactly matches a mapped original path MUST be updated to the mapped replacement path.
- **FR-012**: When a confirmed replacement is inside the current project directory, the stored project value MUST be converted to a project-relative path.
- **FR-013**: When a confirmed replacement is outside the current project directory, or when no current project directory is available, the stored project value MUST remain the chosen path.
- **FR-014**: Confirming the modal with no replacement mappings MUST leave all AudioFile paths unchanged.
- **FR-015**: Canceling or closing the modal MUST leave all AudioFile paths unchanged.
- **FR-016**: The project MUST remain open and active after the modal is confirmed, canceled, or closed.
- **FR-017**: The application MUST allow partial resolution; unmapped or still-missing paths MUST remain unchanged without forcing a second modal or blocking the opened project.
- **FR-018**: Selecting an already open project from an open-project action MUST switch to that project without rerunning the newly loaded project missing-file check.
- **FR-019**: Regular project opening and example project opening MUST expose the same missing-audio-file parity behavior.
- **FR-020**: Tests MUST cover no-missing-file opens, unique missing-path listing, duplicate-reference updates, successful full resolution, successful partial resolution, successful confirmation with no mappings, cancel or close dismissal, project-relative replacement conversion, and no-project-directory replacement behavior.

### Key Entities *(include if feature involves data)*

- **AudioFile Reference**: A score-object file path that points to audio used by an AudioFile score object.
- **Missing Audio File**: A unique AudioFile reference that cannot be resolved by the Java Blue parity search rules during project open.
- **Replacement Mapping**: A user-approved association from one original missing path to one replacement file path.
- **Project Directory**: The directory used to resolve relative project paths and to convert replacement paths back to project-relative form.
- **Missing File Resolution Session**: The modal interaction created for one newly loaded project when one or more missing AudioFile references are found.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A project with no missing AudioFile references opens without displaying a missing-file modal in 100% of tested cases.
- **SC-002**: A representative project with one missing AudioFile reference displays a modal listing that missing original path within 2 seconds after the project is loaded.
- **SC-003**: A representative project with the same missing path used by multiple AudioFile score objects lists the path once and updates all matching references after one successful mapping.
- **SC-004**: Confirming the modal with a partial set of mappings updates only mapped original paths, leaves unmapped paths unchanged, and keeps the project open in 100% of tested cases.
- **SC-005**: Canceling or closing the modal changes zero AudioFile paths and keeps the project open in 100% of tested cases.
- **SC-006**: Replacement paths inside the project directory persist as relative paths after save and reopen, while replacements outside the project directory persist as chosen paths.
- **SC-007**: Automated coverage verifies all primary success, partial success, no-op success, and cancel flows for the Java Blue parity scope.

## Assumptions

- Java Blue is the behavioral reference for this slice; the source review is captured in `research.md`.
- "Audio asset" means AudioFile score-object file references for this feature, because that is the scope of Java Blue's project-open dependency dialog.
- Project load and parse failures remain handled by the existing open-project error flow and do not enter the missing-file resolution flow.
- Replacement choices update in-memory project data; saving the project remains a separate user action unless existing application behavior already saves changes.
- Existing file resolution behavior can determine the current project directory and the user's sound-file search directory before the missing-file check runs.
