# Feature Specification: Java-Compatible Code Repository Library

**Feature Branch**: `069-code-repository`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Implement the Code Repository Editor from NOT_IMPLEMENTED_ACTIONS.md. Research the Java Blue implementation. Treat it as a project-facing library outside the unified library, store it in the application database, and migrate legacy XML into the database."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage reusable Csound code (Priority: P1)

As a Blue user, I want to maintain an organized repository of reusable Csound snippets so that I can edit, reuse, and curate my own code without modifying each project manually.

**Why this priority**: The repository editor is the primary value of the feature and provides a viable standalone MVP even before editor-menu integration is complete.

**Independent Test**: Open the Code Repository Editor, create a nested group and snippet, edit the snippet, reorder it, save, restart the application, and verify that the complete tree and code are preserved.

**Acceptance Scenarios**:

1. **Given** the repository has been initialized, **when** the user opens Code Repository Editor from the Tools menu, **then** the user sees an ordered tree of groups and snippets with the selected snippet's code available for editing.
2. **Given** a group is selected, **when** the user creates a child group or snippet, **then** the new node appears under that group and can be renamed without requiring unique names among siblings.
3. **Given** a snippet is selected, **when** the user edits its name or code and saves, **then** the change is durable and is present after reopening the editor or restarting the application.
4. **Given** a group or snippet is selected, **when** the user moves it within the tree, **then** its parent and sibling order are updated while the remaining tree stays intact.
5. **Given** the editor contains unsaved changes, **when** the user cancels, **then** the repository remains exactly as it was before the editor session began.

### User Story 2 - Migrate and preserve an existing repository (Priority: P1)

As a Blue user upgrading from Java Blue, I want my existing Code Repository XML to be imported automatically or explicitly so that I do not lose my saved snippets.

**Why this priority**: Existing user content is the principal compatibility risk and must be protected before new editing behavior is introduced.

**Independent Test**: Place valid Java-compatible repository XML at the legacy location, launch the application, and verify that the imported tree, names, ordering, and snippet text match the source while the source file remains unchanged.

**Acceptance Scenarios**:

1. **Given** a valid `~/.blue/codeRepository.xml` exists and the application repository has not been initialized, **when** the application starts, **then** the XML is imported once with all groups, snippets, ordering, and code text preserved.
2. **Given** no legacy repository exists, **when** the application initializes the repository for the first time, **then** the repository contains only its protected root and no snippets or groups.
3. **Given** a historical or user-selected XML file has the supported repository structure, **when** the user chooses Import, **then** the contents are validated and imported without changing the source file.
4. **Given** a legacy source is malformed or contains unsupported structure, **when** migration or import runs, **then** the user receives an actionable diagnostic, no partial replacement occurs, and the original source remains available.
5. **Given** migration has already succeeded, **when** the application starts again, **then** the same source is not imported a second time or duplicated.

### User Story 3 - Insert repository snippets from a Csound editor (Priority: P2)

As a Csound author, I want to browse my repository from the editor context menu so that I can insert reusable code at the current cursor or selection.

**Why this priority**: Context-menu insertion is the main day-to-day workflow enabled by the repository and is valuable once repository content can be managed.

**Independent Test**: Open a Csound editor, select text, choose a nested repository snippet from the Custom menu, and verify that the snippet replaces the selection and the editor remains usable.

**Acceptance Scenarios**:

1. **Given** the Csound editor has repository snippets, **when** the user opens its context menu, **then** the Custom menu reflects the current group hierarchy and contains the available snippets.
2. **Given** a snippet is selected from the Custom menu, **when** the user activates it, **then** its code is inserted at the cursor or replaces the current selection.
3. **Given** the repository changes in the editor or another application window, **when** the context menu is opened again, **then** it reflects the latest saved repository state.
4. **Given** the repository is empty or unavailable, **when** the user opens the editor context menu, **then** the repository action is disabled or presents a recoverable error without affecting ordinary editing commands.

### User Story 4 - Add selected editor code to the repository (Priority: P2)

As a Csound author, I want to save selected editor text as a named repository snippet so that useful code can be collected while I work.

**Why this priority**: Capturing code from the editor completes the two-way workflow between project work and the reusable library.

**Independent Test**: Select non-empty Csound text, choose Add to Code Repository, choose a nested group and name, save, and verify that the exact selected text is available from the Custom menu.

**Acceptance Scenarios**:

1. **Given** non-empty text is selected in an editable Csound editor, **when** the user chooses Add to Code Repository, **then** the user can provide a snippet name and choose any existing group.
2. **Given** the user confirms the add operation, **when** the repository is reopened or the editor menu is refreshed, **then** the snippet appears under the chosen group with the selected text preserved exactly.
3. **Given** no text is selected, **when** the user opens the editor context menu, **then** Add to Code Repository is disabled or unavailable.

### User Story 5 - Export and recover repository content (Priority: P3)

As a Blue user, I want to export or recover repository content so that I can move snippets between Blue installations and recover from storage problems.

**Why this priority**: Export and recovery are important for trust and Java interoperability, but are not required to demonstrate the core editor workflow.

**Independent Test**: Export a repository, import the result into an empty repository, and compare the resulting tree and snippet text with the original.

**Acceptance Scenarios**:

1. **Given** a repository contains groups and snippets, **when** the user exports it, **then** the result is a valid Java-compatible repository XML document.
2. **Given** the primary repository database is unavailable or corrupt, **when** the user opens the repository editor, **then** the application reports the failure and provides a recoverable path without changing project data or unified libraries.

### Edge Cases

- A repository may contain duplicate group or snippet names; node identity and ordering must remain unambiguous.
- Groups may contain both child groups and snippets, and nested groups may be arbitrarily deep within supported UI limits.
- Snippet code may be empty and may contain tabs, newlines, Unicode, XML-sensitive characters, or leading/trailing whitespace.
- A legacy file may be missing, empty, unreadable, malformed, or valid but contain unsupported elements.
- A legacy file must never be deleted, overwritten, or moved as a side effect of migration.
- A user may cancel a dirty editor session, close the application during a save, or open the repository in more than one application window.
- A repository database failure must not make the project document or unified libraries unavailable.
- The repository is available without an opened or saved project because it is project-facing but user-global in this release.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a Code Repository Editor from the Tools menu.
- **FR-002**: The editor MUST present a single ordered repository tree containing a protected root, groups, and snippets.
- **FR-003**: Users MUST be able to create, rename, move, reorder, and delete groups and snippets, subject to root protection and valid tree structure.
- **FR-004**: Users MUST be able to edit the name and code of a selected snippet while viewing its containing tree.
- **FR-005**: The repository MUST persist independently from `.blue` project XML and MUST remain available across projects and application restarts.
- **FR-006**: Saving an editor session MUST be atomic; cancelling an editor session MUST discard its unsaved changes.
- **FR-007**: The repository MUST preserve stable node identity, sibling order, group nesting, and exact snippet code text across saves.
- **FR-008**: The application MUST detect and import a valid legacy `~/.blue/codeRepository.xml` once when initializing an empty repository.
- **FR-009**: The application MUST support explicit import of legacy or user-selected repository XML files, including historical `custom.xml` files with the supported structure.
- **FR-010**: Migration and import MUST leave the source file unchanged and MUST reject invalid input without partially replacing the current repository.
- **FR-011**: A newly initialized repository with no legacy source MUST be created programmatically with only the protected root; no default repository XML may be required or packaged.
- **FR-012**: The application MUST provide an explicit export that produces Java-compatible repository XML without exposing internal database identifiers.
- **FR-013**: The Csound editor context menu MUST expose repository groups and snippets through a Custom submenu.
- **FR-014**: Selecting a repository snippet from the Csound editor menu MUST insert its exact code at the cursor or replace the current selection.
- **FR-015**: The Csound editor context menu MUST provide Add to Code Repository for non-empty selections and MUST allow the user to choose a name and nested destination group.
- **FR-016**: Saved repository changes MUST become visible to subsequent editor context menus and other open application windows.
- **FR-017**: The application MUST use the existing new-user-defaults preference when choosing initial text for a newly created snippet.
- **FR-018**: Repository errors, migration failures, and revision conflicts MUST produce recoverable user-facing feedback and MUST NOT corrupt project data or unified-library data.
- **FR-019**: The repository MUST have one documented canonical owner, with editor drafts and menu snapshots treated as transient renderer state.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `CodeRepositoryManager`, `CodeRepositoryDialog`, `CodeRepositoryMenu`, and `AddToCodeRepositoryAction`, plus the Java-compatible `codeRepository.xml` interchange format.
- **Compatibility Requirements**: Preserve the Java XML element meanings (`customAccelerators`, `customGroup`, `customAccelerator`, `name`, and `signature`), tree ordering, nested group behavior, snippet text, Custom-menu insertion, Add-to-Repository behavior, and legacy-source migration. Java-compatible XML remains available for explicit import/export and codec fixtures.
- **Intentional Divergences**: A fresh TS Blue installation starts with an empty programmatically-created repository and does not package or read a default XML seed. After migration, the application database is canonical rather than the legacy XML file; the legacy file is never rewritten automatically. Electron supports arbitrary nested-group selection in the add flow and offers explicit XML export. The repository is stored under application user data rather than continuing to write `~/.blue`.
- **State Ownership**: The application-owned repository database is canonical for durable Code Repository data; the Electron main process owns database access and migration; renderer drafts and menu snapshots are transient; `.blue` project XML remains canonical for project data and is not modified by this feature; the legacy XML remains an immutable migration/import source.

### Key Entities

- **Repository Tree**: The single ordered hierarchy of groups and snippets available to the user.
- **Repository Node**: A stable group or snippet identity, parent relationship, display name, and sibling position.
- **Code Snippet**: A named reusable text value whose code content is preserved exactly.
- **Legacy Import Source**: An XML file, source location, fingerprint, validation result, and migration status.
- **Repository Revision**: A durable version used to prevent an older editing session from silently replacing newer saved changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a valid legacy repository, 100% of supported groups, snippets, names, sibling ordering, and snippet code text are preserved after migration.
- **SC-002**: A user can create, edit, reorder, save, close, and reopen a repository tree without losing any confirmed change.
- **SC-003**: A user can insert a saved snippet into a Csound editor in one context-menu flow, with the inserted text matching the stored snippet exactly.
- **SC-004**: Cancelling a dirty repository editor session results in zero persisted changes from that session.
- **SC-005**: Invalid or unreadable legacy input produces a diagnostic and leaves the original source and existing repository unchanged in every tested failure case.
- **SC-006**: Repository storage failures do not prevent opening, editing, or saving a `.blue` project or using the unified libraries.
- **SC-007**: In a repository containing at least 500 nodes, opening the editor and opening the Custom menu remain responsive enough for normal interactive use, with no operation requiring a full project reload.

## Assumptions

- Version one is a user-global, project-facing repository, matching Java Blue; it is not copied into or owned by individual projects.
- The repository uses a dedicated application database file separate from the unified-library database while reusing the application's established database recovery conventions.
- Duplicate display names are allowed; stable node identity and ordering distinguish nodes.
- Legacy XML migration is automatic only for the known `~/.blue/codeRepository.xml` location; historical locations are handled through explicit import.
- Unknown or malformed legacy content is rejected as a whole with diagnostics rather than silently discarded or partially imported.
- XML export is explicit and user-initiated; normal edits do not rewrite the legacy XML source.
- The initial Csound integration targets the existing Csound editor context menu and does not add repository content to the `.blue` project model.
- The existing program setting for new-user defaults remains the source for new-snippet placeholder text.
- Authentication, synchronization, cloud sharing, project-local repository scopes, and `.binstr` Arrangement import/export are out of scope for this feature.
