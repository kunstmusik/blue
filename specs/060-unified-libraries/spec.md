# Feature Specification: Unified Libraries

**Feature Branch**: `060-unified-libraries`
**Created**: 2026-07-15
**Status**: Complete (reviewed 2026-07-21)
**Input**: User description: "Create a centralized Unified Libraries experience from the supplied design report, covering Instruments, UDOs, Effects, SoundObjects, project and user scopes, contextual insertion, full item editing, durable user-library storage, safe Java Blue migration, lossless unsupported-object preservation, and Java Blue-compatible XML import and export."
**Design Constraints**: [design-constraints.md](design-constraints.md)
**UX Correction (2026-07-15)**: The Libraries auxiliary panel is a compact navigator, not an action form. Selection drives a reusable full type-specific editor in the main area titled `Library Item`, retaining the existing address/breadcrumb header; organization uses inline rename and context menus; project placement uses typed drag-and-drop or keyboard-equivalent copy/paste; persistent CRUD, Browse, and Insert buttons are prohibited.
**UX Correction (2026-07-18)**: Libraries contains application-owned user libraries only. Project Instruments stay in Orchestra, project UDOs stay in the reusable UDO list/editor, and Project Shared SoundObjects move to a separate `SoundObject Library` auxiliary panel. Healthy startup migration is silent; migration notices, migration reports, and Import History are not user-facing Library actions. All top-level user-library nodes start collapsed. A normal one-mode drop/Paste applies without a modal and reports completion by toast; only an actual shared-copy choice or blocking disclosure may open a dialog.
**UX Correction (2026-07-18, insertion clarity)**: Library rows show the item or folder name without persistent right-side type/scope metadata; an item tooltip exposes its complete library address, while a folder tooltip exposes its folder name. Orchestra exposes only insertion boundaries where an unused integer assignment ID can preserve numeric order. Empty mixer Effect chains remain valid destinations, and rolling over a mixer channel does not recolor the whole strip.
**UX Correction (2026-07-19, embedded UDO parity)**: Instrument-local UDO tables participate in the same typed Copy/Cut/Paste and drag contract as the project UDO workspace and user UDO Library. Empty folders remain visibly folders through a large high-contrast disclosure arrow even when they have no children.

**UX Correction (2026-08-05, Track clipboard parity)**: Track-owned embedded UDO lists are exact UDO sources and destinations alongside project-global, Arrangement-instrument, and user-library UDOs. The active typed Library clipboard is application-wide across main and child editor windows; child windows do not create a second renderer-local buffer. The type-isolated BSB widget buffer is carried in a separate main-owned slot so widgets can also copy between Arrangement and detached Track instrument editors without becoming Library items.
**UX Correction (2026-07-19, drop geometry and mixer sizing)**: Folder chevrons retain their high contrast at a slightly smaller size. In UDO tables and mixer Effect bins, all unused list space below the final row is the exact end-insertion target and shows a full-area highlight during a compatible drag. Mixer strips keep a readable vertical minimum and scroll when the panel is shorter rather than allowing labels, values, and routing controls to overlap.
**UX Correction (2026-07-19, single Library Item tab)**: The main workspace shows at most one `Library Item` tab. Selecting another item switches that tab to the requested session even when an earlier draft is dirty or pinned; protected drafts remain retained by stable item identity and become visible again when their item is reselected. Session-bound Library Item tabs are transient and are not restored from a saved workbench layout.
**UX Correction (2026-07-19, immediate detached Cut)**: Every Cut first captures a complete detached typed snapshot, then removes the source immediately after required validation and consequence confirmation. Paste always creates an independent destination copy from that reusable buffer; it never performs deferred source cleanup or consumes the buffer. Failed capture, declined confirmation, or failed removal leaves the source and prior clipboard unchanged. User-library folders and items may also be moved directly by drag-and-drop into compatible folders, with roots, cross-type destinations, self-drops, and descendant cycles rejected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find And Preview Reusable Objects (Priority: P1)

As a composer, I want one dockable Libraries panel for Blue's reusable user-library object types, while project-owned definitions stay in their native project surfaces, so that ownership and editing consequences remain clear.

**Why this priority**: A unified, discoverable browsing experience is the central user value of this feature and is useful before any editing or migration workflow is added.

**Independent Test**: Populate all four user-library roots plus the native project Orchestra, UDO, and Project Shared SoundObject surfaces; open Libraries from the Window menu; then verify complete user hierarchy browsing, compact filtering, search disambiguation, context commands, and reusable native full editors in the main area without duplicating project collections or showing persistent CRUD, Browse, or Insert buttons.

**Acceptance Scenarios**:

1. **Given** user libraries contain several supported object types, **When** the user opens Libraries, **Then** one compact dockable panel offers `All`, `Instruments`, `UDOs`, `SoundObjects`, and `Effects` filters, a search field, the four application-owned user roots, a folder-and-item hierarchy, and one vertically oriented ellipsis menu for panel-level commands.
2. **Given** the user selects a supported Instrument, UDO, Effect, or SoundObject once, **When** the selection changes, **Then** a reusable main-workspace panel titled `Library Item` hosts the type's full existing editor under the existing address/breadcrumb header while keyboard focus remains in the tree; the Libraries panel does not embed an editor, and supported types do not fall back to a raw XML textarea.
3. **Given** the user selects a type filter, **When** the panel displays the hierarchy, **Then** it shows only application-owned user-library roots. Project Instruments remain in Orchestra, project UDOs remain in the UDO workspace, Project Shared SoundObjects remain in the separate SoundObject Library panel, and Effect chains remain transient insertion targets.
4. **Given** import and export commands are available, **When** Libraries is healthy, **Then** those commands appear in the ellipsis menu rather than in a persistent banner or full-width button row; migration notices, migration reports, and Import History are absent from normal operation.
5. **Given** items with the same name exist in different types or scopes, **When** they appear in browse or search results, **Then** each result remains distinguishable by type, scope, and folder context.
6. **Given** no project is open, **When** the user opens Libraries, **Then** its user-library browse, search, edit, import, export, and recovery behavior is unchanged; no redundant no-project or source-scope chrome is shown.
7. **Given** an existing action or saved layout refers to a legacy library surface, **When** it is invoked or restored, **Then** Blue opens or maps it to the one logical Libraries panel without creating a duplicate panel or discarding unrelated layout state.
8. **Given** the user browses the tree, **When** no context menu or inline rename is active, **Then** rows show only navigation and identity information; they do not show persistent Rename, Duplicate, Delete, or Insert controls.

---

### User Story 2 - Insert The Right Kind Of Project Copy (Priority: P1)

As a composer building a project, I want library objects inserted into the correct project context with clear copy or shared-reference behavior so that later library edits do not unexpectedly change my music.

**Why this priority**: Reuse is the purpose of a library, and incorrect copy semantics could silently alter existing projects or break project portability.

**Independent Test**: Open Libraries and drag one item of each type onto Orchestra, the project UDO table, an exact mixer-chain insertion gap, and an explicit Score layer/time; repeat the flow with keyboard copy/paste; save and reopen the project; then verify destination, identity, independence, and shared SoundObject choices.

**Acceptance Scenarios**:

1. **Given** a user-library Instrument and an active project, **When** the user drags or pastes it into Orchestra, **Then** only numerically valid insertion boundaries are available and the project receives an independent Instrument copy using the unused integer assignment ID appropriate to the indicated position.
2. **Given** a user-library UDO and an active project, **When** the user drops or pastes it at a top-level project UDO, Arrangement-instrument UDO, or Track-instrument UDO table insertion position, **Then** that exact UDO list receives an independent copy at the indicated position.
3. **Given** a user-library Effect, **When** the user drags it across a populated or empty mixer chain, **Then** only compatible chains expose exact insertion markers, and dropping at a marker creates an independent Effect copy at that position without recoloring the whole channel strip.
4. **Given** a user-library SoundObject, **When** the user drops it on a valid Score layer and time, **Then** the project receives an independent SoundObject copy at the indicated musical position by default.
5. **Given** a project-shared SoundObject, **When** the user drops or pastes it into Score, **Then** Blue requires an explicit `Copy Instance` or `Copy Independent` choice with consequences visible before applying the change.
6. **Given** a user-library item has already been inserted, **When** its user-library definition is edited later, **Then** the existing project copy remains unchanged while future insertions use the saved definition.
7. **Given** a destination is missing, ambiguous, stale, or incompatible, **When** the user drags or pastes an item, **Then** Blue shows invalid-target feedback, performs no mutation, and never falls back to a neighboring row, chain, layer, or time.
8. **Given** an item owns local data and also declares external project-level dependencies, **When** a drop or paste is requested, **Then** Blue includes the item-owned data, identifies unresolved external dependencies before changing the project, and requires an explicit resolution rather than silently mutating other project collections.
9. **Given** Libraries and a compatible project surface are visible, **When** the user wants to place an item, **Then** direct drag-and-drop is available without first invoking a destination-side Browse command or a Libraries-side Insert button.
10. **Given** a user cannot or does not use drag-and-drop, **When** the user copies a library item and invokes Paste at a compatible destination selection or context menu, **Then** Blue performs the same validation and copy semantics as a drop.
11. **Given** a user-library Instrument, UDO, Effect, or SoundObject has one valid insertion mode and no blocking disclosure, **When** the drop or Paste succeeds, **Then** Blue applies it directly without opening a modal and uses the result toast as sufficient feedback.

---

### User Story 3 - Edit And Organize Library Items Safely (Priority: P1)

As a library maintainer, I want full type-specific editing in the main workspace, with common save, organization, identity, and consequence controls, so that complex objects are comfortable to edit and accidental data loss is prevented.

**Why this priority**: Centralized browsing is incomplete unless users can maintain reusable content without returning to fragmented or modal editing workflows.

**Independent Test**: Select supported user and project items of every type, edit them through the reusable native `Library Item` editor and existing address header, rename inline, and perform Duplicate/Cut/Copy/Paste/Delete from mouse and keyboard context menus; restart Blue and verify dirty-state safety, scope consequences, ordering, and stable identity.

**Acceptance Scenarios**:

1. **Given** a supported item is selected, **When** its `Library Item` panel appears, **Then** the main workspace shows the existing address/breadcrumb header and the full native type-specific editor with dirty state, Save, Revert, applicable current-project usage, dependency information, and scope consequences.
2. **Given** a Library Item editor is visible, **When** another supported item is selected, **Then** the same single `Library Item` tab switches to that item's existing or new session and no second Library Item tab appears; any dirty or pinned draft for the prior item remains retained and reappears when that item is selected again.
3. **Given** an item has unsaved changes, **When** the user changes library selection, closes the panel, or opens another item, **Then** the unsaved editor remains available and its changes are not silently discarded.
4. **Given** a user-library, project-owned, or project-shared item is open, **When** the editor renders, **Then** it explains the scope and the consequence of saving, including the shared-instance count when applicable.
5. **Given** a user-library folder or supported item, **When** the user creates a folder, renames by double-clicking the visible name, or invokes Duplicate/Cut/Copy/Paste/Delete from a context menu, **Then** the hierarchy and ordering persist across restart and any independent project copy remains unchanged.
6. **Given** a supported project Instrument, UDO, Effect, or SoundObject is shown in its project panel, **When** the user copies or cuts it and pastes into the matching user library, or drags it there, **Then** Blue uses the same typed application clipboard/drag contract used in the opposite direction and exposes no separate `Copy to User Library` command.
7. **Given** a complex type-specific editor needs more room, **When** the user collapses the Libraries panel, **Then** the workspace editor remains open and usable.
8. **Given** a dirty editor is closed, the application quits, or its owning project closes or changes, **When** the draft cannot remain safely attached to the same item, **Then** Blue requires a Save, Discard, or Cancel decision and never applies the draft to another project or item.
9. **Given** a Project Shared SoundObject has linked instances, **When** the user deletes its definition, **Then** Blue shows the affected count, requires confirmation, and applies the native linked-instance deletion rule without leaving broken references.
10. **Given** another surface changes an item while its Library Item editor has a draft, **When** that draft is saved, **Then** Blue identifies the conflict and does not silently overwrite the newer value.
11. **Given** a tree row has focus, **When** the user presses the Context Menu key or `Shift+F10`, **Then** the same applicable commands and disabled states available by right-click are keyboard accessible with visible focus.
12. **Given** two or more timeline or nested Instances reference one Project Shared SoundObject, **When** its definition is edited from either the Library Item editor or an Instance's type editor, **Then** every Instance generates score from the same updated canonical definition; the Properties panel continues to edit only the selected Instance wrapper, a clean parallel Library Item editor refreshes, and a dirty parallel draft is preserved as a conflict.

---

### User Story 4 - Preserve Existing Java Blue Libraries On First Run (Priority: P1)

As an existing Java Blue user, I want my libraries brought into Blue Electron automatically and safely on first use, without changing the Java files, dropping unsupported objects, or interrupting normal startup with migration status UI.

**Why this priority**: Existing users may have years of reusable content. A lossy or invisible migration would undermine trust in the entire library system.

**Independent Test**: Start with a new user-library store and representative Java Blue configuration folders containing all four recognized files, nested categories, ordering, duplicates, unsupported objects, a corrupt file, and a backup; then verify source immutability, independent-file progress, preservation, internal audit records, silent healthy startup, retry behavior, and recovery-state handling.

**Acceptance Scenarios**:

1. **Given** the user-library store is new and empty, migration state is `never`, and recognized Java Blue files exist in the default configuration folder, **When** Blue initializes Libraries, **Then** it imports the valid files automatically without showing healthy-state migration UI.
2. **Given** a first-run import succeeds, **When** folder trees and items are compared with the Java source, **Then** hierarchy, ordering, supported content, and original unsupported XML are preserved without an extra Imported wrapper folder.
3. **Given** one recognized source file is corrupt, **When** automatic migration runs, **Then** Blue records the failure internally, continues with the other valid libraries, remains usable, and does not silently retry the failed source on every startup; actionable storage failure uses the exceptional recovery surface rather than a routine migration notice.
4. **Given** an unsupported or plugin-defined object appears in a valid source file, **When** it is imported, **Then** the object remains in its original folder with its original XML, appears with a warning, and remains organizable and exportable.
5. **Given** a corrupt primary file has a `~` backup, **When** migration reports the failure, **Then** Blue offers the backup as an explicit choice and does not substitute it automatically.
6. **Given** no recognized Java Blue files exist, **When** first-run initialization completes, **Then** Blue creates an empty usable library, records the scan as skipped so it is not repeated silently, shows no migration-skipped notice, and does not block application startup.
7. **Given** migration previously completed but the user-library store later disappears, **When** Blue starts, **Then** it presents a recovery choice instead of silently importing the Java files again.
8. **Given** migration reads any primary or backup Java Blue file, **When** the migration finishes or fails, **Then** every source file remains byte-for-byte unchanged and in its original location.

---

### User Story 5 - Import, Export, And Preserve Compatibility (Priority: P2)

As a user moving content between installations or between Java Blue and Blue Electron, I want explicit previewed import and compatible export workflows so that conflicts, unsupported content, and overwrites never surprise me.

**Why this priority**: Manual interchange is essential for compatibility and recovery, but users can receive initial value from browsing, editing, and first-run migration before using it.

**Independent Test**: Import a Java Blue configuration directory and separately selected XML files into a non-empty library with duplicate and conflicting content; inspect the resulting hierarchy and internal provenance; then export one library and all libraries into empty and occupied destinations and verify previews, conflict defaults, filenames, compatibility reporting, ordering, unsupported content, and all-or-nothing failure behavior.

**Acceptance Scenarios**:

1. **Given** the user chooses Import from Java Blue, **When** a configuration folder is selected, **Then** Blue recognizes any of the four traditional library files and uses the same validation and reporting rules as first-run migration.
2. **Given** the user chooses Import XML Library Files, **When** one or more recognized files are selected, **Then** Blue identifies their library types from their content and previews the proposed operation before changing any destination.
3. **Given** a manual import is previewed, **When** Blue evaluates the selected sources, **Then** it accurately reports recognized types, folder and item counts, unsupported items, validation errors, exact duplicates, name conflicts, and the proposed conflict decisions.
4. **Given** incoming object content exactly matches an item in the same library type and resolved destination folder, **When** the default conflict policy is accepted, **Then** Blue keeps the existing item and identity; if that folder contains the same name with different content, Blue keeps both and assigns the incoming display name a deterministic unique suffix without corrupting preserved raw XML.
5. **Given** import would replace an item or an entire library, **When** the user has not explicitly selected that destructive policy, **Then** Blue preserves the existing content.
6. **Given** an import completes, **When** Blue finalizes the batch, **Then** it retains the audit/provenance data needed for safety internally without adding an Import History command or persistent history UI to Libraries.
7. **Given** the user exports the current type or all types, **When** compatible output is confirmed, **Then** Blue writes the traditional Java Blue filename or filenames while preserving representable hierarchy, ordering, supported objects, and preserved unsupported objects.
8. **Given** an item cannot be represented by Java Blue or a destination file already exists, **When** export is requested, **Then** Blue reports the incompatibility or overwrite before changing the destination and requires an explicit decision to cancel, overwrite, or export only the compatible subset.
9. **Given** imported XML contains embedded object code, plugin content, or external-entity declarations, **When** Blue previews or imports it, **Then** the content is treated as data and is not executed or externally resolved.
10. **Given** Export All targets four destinations and any compatibility, overwrite, validation, or before-write check fails or is canceled, **When** the operation ends, **Then** none of the existing destination files has been changed.
---

### User Story 6 - Recover From Storage And Operation Failures (Priority: P2)

As a composer relying on libraries during project work, I want compound changes and store upgrades to be recoverable so that a failed import, export, edit, or application upgrade cannot leave the library half-changed or prevent the rest of Blue from opening.

**Why this priority**: The user library is long-lived application data. Reliability failures can affect many projects and must be contained even though the normal workflows deliver the initial user value.

**Independent Test**: Inject failures while saving an item, moving a folder tree, importing each source, exporting multiple files, opening damaged user-library storage, and applying a destructive application upgrade; then verify all-or-nothing changes, backups, the specified recovery choices, source and destination safety, and continued application availability.

**Acceptance Scenarios**:

1. **Given** one library change or one source-library import fails before completion, **When** Blue reports the error, **Then** that operation leaves the user library in its prior complete state; a multi-source import may retain independently completed sources only when the partial result is reported source by source.
2. **Given** a store-format upgrade could destroy or rewrite existing data, **When** the upgrade begins, **Then** Blue creates a recoverable backup before applying it.
3. **Given** the user-library store cannot be opened or upgraded, **When** Blue starts, **Then** the rest of the application remains usable and Libraries presents a clear recovery path.
4. **Given** edited object content is invalid for its supported type, **When** the user tries to save it, **Then** Blue rejects the invalid change while retaining both the last valid saved value and the unsaved editor state for correction.
5. **Given** an export fails while staging output, **When** the operation ends, **Then** existing destination files remain unchanged and temporary output is not presented as a successful export.
6. **Given** the library contains a large collection, **When** the user browses or searches, **Then** Blue returns hierarchy and summary results within the stated responsiveness targets.

### Edge Cases

- The current project is absent, closes, or changes while a project-scoped item editor or contextual insertion target is open.
- A contextual mixer channel, effect-chain position, Orchestra destination, UDO destination, or Score destination is deleted before insertion.
- The same item name appears in multiple folders, types, or scopes, including names that differ only by case.
- A user attempts to move a folder into itself or one of its descendants, move an item across incompatible library types, or delete a non-empty folder.
- A user enters a name that is empty after trimming or contains control characters, attempts to move or delete a type root, or tries to move a project object into user ownership instead of explicitly copying it.
- An item or folder is moved, renamed, or deleted while its editor tab is open and either clean or dirty.
- A search query is empty, contains only whitespace, contains punctuation or non-ASCII text, or matches an unsupported item whose safely extracted metadata is incomplete.
- A library type has an empty user root, or its corresponding native project surface has no entries or no meaningful project representation.
- A user-library item references local dependencies or resources that are missing when previewed, edited, inserted, or exported.
- An imported XML file is empty, truncated, malformed, uses the wrong root element, has a recognized filename but a different library type, or is extremely large.
- Imported XML contains external entities, embedded Csound, Jython, Clojure, or plugin content that must be treated as data during preview and import rather than executed.
- A Java Blue configuration folder contains only some recognized primary files, only `~` backups, or both a corrupt primary and a valid backup.
- One file in a multi-file import fails validation after other files have already staged successfully.
- Automatic migration is interrupted after the store is created but before every source file finishes.
- Migration state is `never`, `completed`, `skipped`, or `failed` while the store is respectively missing, empty, non-empty, or damaged.
- An imported object has an unknown class, plugin-defined nested content, missing display metadata, or XML that current editors can parse only partially.
- An unsupported item becomes supported after an application upgrade while its original XML has never been edited.
- A manual import contains exact object-content duplicates, same-name different-content conflicts, repeated folder names, or content previously imported in another batch.
- Imported items are later edited, moved, duplicated, or deleted while their original import provenance remains available internally for diagnosis and recovery.
- Export contains preserved unsupported objects or new Blue Electron objects that Java Blue cannot represent.
- An export destination is read-only, out of space, interrupted, or already contains one or more traditional filenames.
- The user requests Export All and one library cannot be prepared or written.
- Stable internal identifiers collide because of damaged data or an attempted duplicate operation.
- The user library is locked, corrupted, uses an unknown newer storage format, or fails during an application upgrade.

## Requirements *(mandatory)*

### Required Scope Model

| Object type | Project surface or context | Libraries panel source |
|-------------|----------------------------|------------------------|
| Instrument | Orchestra editor | User Instrument Library only |
| UDO | Reusable project UDO list/editor | User UDO Library only |
| SoundObject | Separate `SoundObject Library` panel for Project Shared SoundObjects | User SoundObject Library only |
| Effect | Mixer/effect-chain gaps are transient drop/Paste targets only | User Effect Library only |

Effects MUST show a user-library section only. Mixer/effect-chain insertion gaps appear only as destination feedback during drag or Paste and MUST NOT become a browsable or persisted Project Effects Library. Future factory content may use a separate read-only scope, but factory content is outside this feature.

### Java Blue Interchange Baseline

| Library type | Traditional filename | Required XML hierarchy |
|--------------|----------------------|------------------------|
| Instruments | `userInstrumentLibrary.xml` | `instrumentLibrary` / `instrumentCategory` |
| UDOs | `udoLibrary.xml` | `udoLibrary` / `udoCategory` |
| Effects | `effectsLibrary.xml` | `effectsLibrary` / `effectCategory` |
| SoundObjects | `soundObjectLibrary.xml` | `soundObjectLibrary` / `category` |

### Functional Requirements

#### Centralized Discovery And Preview

- **FR-001**: Blue MUST provide one dockable Libraries panel, normally available at the right side of the workbench, for Instruments, UDOs, SoundObjects, and Effects.
- **FR-002**: The panel MUST provide one global, case-insensitive item-name search and the filters `All`, `Instruments`, `UDOs`, `SoundObjects`, and `Effects`; search MUST cover application-owned user libraries only, include safely extracted unsupported-item names, and identify no-result state clearly.
- **FR-003**: The panel MUST show only application-owned user-library roots and their complete folder hierarchies. Expanding a node MUST eventually show every immediate child exactly once in stable repository order even when the service returns multiple pages; no page boundary may silently truncate a folder. The panel MUST NOT show a Current Project section or a source filter. Project Orchestra, project UDOs, Project Shared SoundObjects, and transient destination targets remain in their dedicated project surfaces.
- **FR-004**: Library tree and search rows MUST show the item or folder name without persistent inline type, scope, or breadcrumb metadata. An item row MUST expose its complete library breadcrumb as a tooltip, and a folder row MUST expose its folder name. Every folder and root MUST retain a clearly legible, high-contrast disclosure arrow even when empty, so it is never rendered like an item; the affordance MUST remain proportionate to the compact row height. Object type, scope, and full location remain available in the Library Item editor header.
- **FR-005**: Selecting a supported item once MUST open or update the single reusable full editor panel in the main workspace titled exactly `Library Item`; at most one such tab may be visible at any time. The selection MUST NOT embed the editor in the Libraries auxiliary panel or steal keyboard focus from the tree. The panel MUST retain the existing address/breadcrumb header so item name, type, scope, and location remain visible even though the Dockview title is generic.
- **FR-006**: The `Library Item` panel MUST host the available full native type-specific editor rather than a raw XML textarea: Instrument interface/code/local UDOs/properties; UDO signature/code/style/documentation/validation; Effect interface/code/input-output configuration and existing testing support; and the existing SoundObject editor with its native properties and score/object controls. Unsupported items remain read-only and show preserved-status metadata and compatibility information without presenting raw XML as the default interface.
- **FR-007**: Orchestra, project UDO, mixer, and Score surfaces MUST NOT expose persistent `Browse …`, `Add from Library …`, or equivalent destination-side library buttons. Legacy commands MAY reveal the centralized Libraries panel for compatibility, but MUST NOT fabricate or retain an insertion mode.
- **FR-008**: Compatible project surfaces MUST accept typed library drag payloads and keyboard-equivalent paste commands, expose the exact destination only during interaction, and reject absent, ambiguous, stale, or incompatible targets without mutation. The Libraries panel MUST NOT expose a persistent Insert button or confirmation mode.
- **FR-009**: Existing library actions, panel identifiers, and saved workbench layouts MUST converge on one logical Libraries panel, without restoring a duplicate legacy library panel or losing the user's otherwise valid workbench layout.
- **FR-010**: User-library browsing, search, editing, import, export, and recovery MUST remain available when no project is open without showing a redundant no-project message or disabled project-source filter.
- **FR-010a**: The four top-level user-library roots MUST be collapsed on first presentation. User expansion state MAY remain local for the mounted panel session, but no root is expanded merely because it is visible.

#### Item Editing And Organization

- **FR-011**: Double-clicking the visible name of a permitted folder or item MUST enter inline rename in place; `F2` MUST provide the keyboard equivalent, `Enter` commits, and `Escape` cancels. Opening or focusing the editor happens through item selection rather than overloading double-click.
- **FR-012**: The full Library Item editor shell MUST show the item name, object type, scope, folder or project breadcrumb, dirty state, Save and Revert, dependency information, and usage discoverable in the current project; unlinked historical project copies MUST be identified as untracked. Organization and transfer commands MUST live in the tree context menu or an explicitly scoped overflow menu rather than as persistent editor or row button strips.
- **FR-013**: The editor shell MUST host the available native type-specific capabilities: Instrument interface/code/local UDOs/properties; UDO signature/code/style/documentation/validation; Effect interface/code/input-output configuration and existing testing support; or the existing SoundObject editor with copy/reference controls.
- **FR-014**: One logical full editor session MUST represent a stable item identity at a time, while exactly one visible `Library Item` tab acts as the reusable presentation slot. Selecting another item MUST switch that slot rather than add a tab. Dirty or pinned sessions MUST remain retained by identity while hidden and MUST reappear when their item is selected; selecting an item that already has a session MUST reuse it rather than create an unaware competitor. Session-bound Library Item tabs MUST NOT be restored from a saved workbench layout. Reordering a project collection MUST NOT rebind an editor session to a different item. If another surface changes a clean item, its Library Item editor MUST refresh to the canonical value. If another surface changes an item with a dirty draft, that draft MUST be retained as a conflict and Save MUST offer Reload Latest and discard the draft, Cancel and retain the draft, or an explicit reviewed overwrite; no choice may happen silently.
- **FR-015**: Save MUST persist the complete edited item and its displayed searchable metadata as one change. When the editor is dirty, Revert MUST ask for confirmation: Cancel retains the draft, while Confirm discards it and restores the last saved version. Closing a dirty editor, quitting, or closing or switching its project MUST require Save, Discard, or Cancel when the draft cannot remain safely open.
- **FR-016**: The editor header MUST explain the consequence of saving for user-library, project-owned, and project-shared items, including the number of affected shared instances when known. Saving a project item MUST mark the project dirty and persist through the normal project-save lifecycle; saving a user-library item MUST persist independently of any open project.
- **FR-017**: User-library item editing MUST affect future insertions only and MUST NOT retroactively update project copies.
- **FR-018**: Editing a project-shared SoundObject MUST update all timeline and nested Instances that reference that shared definition, including Instances nested in another project-library object, so score generation always uses the same updated canonical definition. Selecting an Instance's type editor MUST edit that shared definition, while the Score Object Properties panel MUST edit only the selected Instance wrapper. The editor MUST disclose the shared consequence before save. Deleting that shared definition MUST show the linked-instance count, require confirmation, and remove the linked project instances according to the native project rule rather than leaving broken references.
- **FR-019**: Users MUST be able to create user-library folders, duplicate supported user-library items, and explicitly save a supported project object as a new user-library copy. This feature does not add generic blank-item creation; any pre-existing type-specific New command remains unchanged and outside this feature's acceptance scope.
- **FR-020**: Folder and supported-item names MUST be non-empty after trimming and contain no control characters; duplicate names and Unicode text remain valid. Invalid inline edits MUST leave the prior name unchanged, keep the edit active, and identify the invalid field. Users MUST be able to rename valid nodes and to move, reorder, drag into compatible folders, and delete permitted user-library nodes, but roots MUST be immovable and undeletable, folders MUST NOT move into themselves or descendants, cross-type transfers MUST be prohibited, and deleting a non-empty folder MUST show affected counts and require confirmation. Project-scope commands MUST follow the native project model and be unavailable when no meaningful equivalent exists.
- **FR-020a**: Right-click and keyboard context menus MUST expose only commands valid for the focused node and scope, including applicable Duplicate, Cut, Copy, Paste, and Delete commands. Paste MUST target the focused folder or the focused item's parent; unavailable operations remain disabled with an accessible explanation. No tree row may display persistent Rename, Duplicate, Delete, or Insert buttons.
- **FR-020b**: One application clipboard MUST support every permitted user and project Instrument, UDO, Effect, SoundObject, and user-folder Cut/Copy operation without exposing raw XML to the renderer. The active typed reference MUST be shared across the main window and child editor windows. Copy stores a typed revision-bound source reference. Cut MUST validate and capture a complete detached deep snapshot before removing the source immediately; any required shared-project consequence confirmation occurs before removal. If capture, confirmation, or removal fails, the source and prior clipboard MUST remain unchanged. Paste MUST create an independent destination copy with a new destination-appropriate identity, MUST NOT perform source cleanup, and MUST leave the detached Cut buffer available for repeated Paste operations.
- **FR-020c**: Project and user panels MUST share the same Copy, Cut, Paste, and drag vocabulary for cross-owner transfer. Project items, including Arrangement-instrument and Track-owned embedded UDOs, MUST be draggable to matching user-library folders; user items MUST be draggable to compatible project targets, including each exact embedded UDO table; project Effects MUST be movable between mixer chains/channels by native drag; and no type-specific `Copy to User Library` command or second clipboard may appear. Copy and Cut MUST be enabled for a selected embedded UDO and use the same typed buffer as the top-level project UDO workspace and user UDO Library. Native internal drag may move an existing project item, but Cut/Paste MUST always use detached copy-then-remove-at-Cut semantics.
- **FR-021**: Collapsing or closing the Libraries panel MUST NOT close an open Library Item editor or discard its unsaved state. Moving or renaming an open item MUST update its breadcrumb by identity. Deleting a dirty item MUST first require Save, Discard, or Cancel; confirmed deletion MUST close its editor, while deletion by another surface MUST leave an explicit read-only missing-item state and MUST NOT rebind the editor to a neighboring item.

#### Project Insertion And Portability

- **FR-022**: Drag/drop and destination paste MUST be type- and target-sensitive and MUST identify the exact destination before applying a change. Instruments use explicit Orchestra insertion positions; UDOs use explicit insertion positions in the top-level project list, an identified Arrangement-instrument list, or an identified Track-owned instrument list; Effects require an exact effect-chain boundary; SoundObjects require an explicit valid Score path, layer, and time rather than an inferred fallback.
- **FR-023**: Project Orchestra MUST expose Instrument drop/Paste targets only at boundaries where an unused positive integer assignment identity can preserve numeric row order. Applying the transfer MUST use that identity, add an independent copy at the indicated boundary, and MUST NOT overwrite an existing Instrument.
- **FR-024**: The project UDO workspace MUST always show its table and splitter even when the list is empty. Dropping or pasting a user-library UDO into an empty or populated top-level project, Arrangement-instrument, or Track-instrument UDO table MUST add an independent entry to that exact addressed list and preserve every same-name UDO rather than replacing or reusing one implicitly. All unused table space below the final row MUST act as the exact end-insertion target and show full-area compatible-drag feedback. UDOs dragged, copied, or cut from any project UDO surface MUST resolve through the same stable project transfer path when pasted into the user UDO Library.
- **FR-025**: Dropping or pasting a user-library Effect at a mixer insertion marker MUST add an independent copy to that exact selected chain position, including position zero in an empty pre- or post-Effects chain. All unused Effect-bin space below the final entry MUST act as the exact end-insertion target and show full-area compatible-drag feedback. The mixer MUST keep at most one Effect selected across all channels and MUST move a dragged project Effect to an exact same- or cross-channel pre/post boundary without duplicating it. Drag rollover MUST highlight the exact insertion destination without changing the whole channel-strip background. A short Mixer panel MUST preserve non-overlapping label, slider, value, chain, and routing regions and provide vertical scrolling below that readable minimum instead of compressing those regions into each other.
- **FR-026**: Dropping or pasting a user-library SoundObject at a Score destination MUST add an independent project copy by default and MUST preserve its intended musical duration and time behavior when adapting it to the destination project's time base.
- **FR-027**: Dropping or pasting a Project Shared SoundObject MUST offer explicit `Copy Instance` and `Copy Independent` choices with their consequences visible; Copy Instance MUST remain linked to the project-shared definition, while Copy Independent MUST create a deep, unlinked project copy.
- **FR-028**: Independent copies MUST receive project-appropriate identity, include all item-owned/local data, mark the project dirty, and remain valid after the project is saved or opened without access to the originating user library. External files continue to follow the project's existing portability rules and MUST be disclosed before insertion.
- **FR-029**: Deleting or editing a user-library source MUST NOT delete, invalidate, or change any independent project copy previously created from it.
- **FR-030**: Before committing a drop or destination paste, Blue MUST disclose unresolved external project-level dependencies or conflicts. The deterministic default is to block the operation without changing the project; the user resolves the reported problem outside the transfer flow and retries. Transfer MUST otherwise be all-or-nothing and MUST NOT silently mutate unrelated project collections.
- **FR-030a**: A valid transfer with exactly one allowed insertion mode and no blocking disclosure MUST apply without publishing modal state. A choice dialog is permitted only for Project Shared SoundObject instance-versus-independent selection or another explicit blocking decision.

#### User-Library Ownership And Identity

- **FR-031**: User-library content MUST live in durable application-owned storage that is separate from Java Blue configuration files and from every `.blue` project.
- **FR-032**: The application-owned user library MUST be the source of truth for user-library content only; Project Orchestra, project UDOs, Project Shared SoundObjects, and project Effect instances MUST remain owned by and embedded in the `.blue` project.
- **FR-033**: Libraries MUST remain the application-owned user-library navigator. Project definitions MUST remain in Orchestra, the reusable UDO workspace, and the separate Project SoundObject Library panel without automatically changing ownership.
- **FR-034**: Every user-library folder and item MUST have a stable identity that remains unchanged across application restarts, browsing, editing, moves, internal provenance review, and non-duplicating application upgrades.
- **FR-035**: Duplicating an item or folder MUST create new stable identities for the copies; moving or renaming an existing node MUST retain its identity.
- **FR-036**: Internal user-library identities MUST NOT alter Java Blue interchange content unless the Java-compatible object format already requires its own reference identifier.
- **FR-037**: The user library MUST preserve hierarchy, folder and item sibling ordering, name, object type, support status, complete object content, created and updated timestamps, and which import created an imported item.
- **FR-038**: Imported object content MUST remain lossless and authoritative until a compatible editor successfully saves it; saving MUST leave users with either the complete prior item or the complete updated item, never mismatched content and browse metadata.
- **FR-039**: User-library changes initiated from different application surfaces MUST follow the same validation, ownership, conflict, and failure rules.
- **FR-040**: Browse, search, item management, import, export, and recovery MUST remain behaviorally consistent whether invoked from Libraries, a legacy compatibility command, or startup migration. Import history and migration reports remain internal audit data rather than normal Libraries UI.
- **FR-041**: Browsing folders, listing items, and searching item names MUST meet the large-library responsiveness target in SC-006.

#### Unsupported Object Preservation

- **FR-042**: Import MUST preserve the original XML and folder position of every unsupported or plugin-defined object, including otherwise supported objects whose unknown nested content cannot be preserved safely by a current editor, instead of dropping or partially altering that content.
- **FR-043**: Blue MUST safely extract a display name and object type when possible, mark the item unsupported, and otherwise retain the raw object content without inventing missing content.
- **FR-044**: Unsupported items MUST appear with a warning badge, open a read-only explanation of their status, and remain unavailable for project insertion until both the object and its nested content are supported safely.
- **FR-045**: Unsupported items MUST remain movable, duplicable, deletable, and exportable without altering their original XML.
- **FR-046**: When a later Blue version supports the preserved object type, the item MUST become editable from its original XML without requiring reimport; original XML remains authoritative until a supported editor successfully saves it.

#### First-Run Initialization And Migration

- **FR-047**: Blue MUST retain legacy migration state independently of whether the user library is present or usable, using the states `never`, `completed`, `skipped`, and `failed`; library existence alone MUST NOT determine whether migration has run.
- **FR-048**: Automatic Java Blue discovery MUST run only for a new or empty user library whose migration state is `never`, and MUST check Java Blue's default `~/.blue` configuration folder for the four files in the Java Blue Interchange Baseline. Automatic import MUST never run against non-empty user content.
- **FR-049**: Automatic migration MUST validate and apply each available source library independently so one corrupt file does not prevent valid files from importing; automatic and manual import operations MUST not overlap.
- **FR-050**: First-run migration into an empty library MUST preserve original hierarchy, duplicate sibling names, and type-appropriate sibling ordering without merging by name or adding an artificial Imported folder.
- **FR-051**: Migration MUST never write, rename, move, or delete a Java Blue primary file or its `~` backup.
- **FR-052**: Every migration attempt MUST record internally its source kind and location, start and completion times, status, result counts, errors, duplicates, unsupported items, and import-batch identity without requiring a user-facing history or report surface.
- **FR-053**: Automatic migration MUST be silent when Libraries remains usable. Partial per-file success MUST be recorded internally as a completed migration with a partial result, while `failed` is reserved for a pipeline or store failure that imports no source; only an actionable repository failure may replace the tree with recovery UI.
- **FR-054**: If no recognized files are found, Blue MUST create an empty usable store, set migration state to `skipped`, and finish startup normally while retaining manual import access.
- **FR-055**: If a primary file is corrupt or absent and a `~` backup exists, Blue MUST offer or report the backup as an explicit import choice and MUST NOT substitute or import it silently.
- **FR-056**: A failed or skipped automatic migration MUST NOT retry silently on every startup; a user-visible manual retry or import path MUST remain available.
- **FR-057**: If migration state is `completed` but the user library is missing or unusable, Blue MUST preserve any recoverable existing data and offer Retry, restore an available application backup, explicit Java Blue re-import, or confirmed fresh-library creation as applicable; no recovery choice may run silently.

#### Migration-State Behavior

| Migration state | User-library state | Required behavior |
|-----------------|--------------------|-------------------|
| `never` | Missing or empty | Create or open the empty library, perform the one-time default Java Blue scan, and transition according to its result. |
| `never` | Non-empty | Preserve all content, do not run automatic import, record `skipped`, and retain manual import access. |
| `never` | Unusable | Preserve it, present the FR-073 recovery choices, and do not scan until the user has explicitly recovered or created an empty library. |
| `completed` | Usable | Open normally without scanning Java Blue. |
| `completed` | Missing or unusable | Preserve any recoverable data and present the explicit FR-057 recovery choices without automatic recreation or reimport. |
| `skipped` | Usable | Open normally without scanning Java Blue and retain manual import access. |
| `skipped` | Missing or unusable | Preserve the migration history and present the FR-073 recovery choices without scanning Java Blue or silently creating fresh storage. |
| `failed` | Usable | Open existing content, show the last failure, and offer explicit Retry or manual import without automatic retry. |
| `failed` | Empty | Open the empty library, show the last failure, and offer explicit Retry or manual import without automatic retry. |
| `failed` | Missing or unusable | Preserve the migration history, show the last failure, and present the FR-073 recovery choices without automatic retry or silent fresh creation. |
| Any state | Non-empty | Never run an automatic Java Blue import over existing user content. |

#### Manual Import, Export, And Internal Audit

- **FR-058**: The Libraries actions menu MUST offer the supported manual Import and Export Current/All commands, MUST NOT offer Import History or Migration Report, and its control MUST have the accessible name `Library actions`.
- **FR-059**: An empty user library MAY additionally show a prominent Import from Java Blue action, but the permanent actions menu MUST remain available.
- **FR-060**: Import from Java Blue MUST accept an auto-detected or user-selected Java Blue configuration folder; Import XML Library Files MUST accept one or more individual recognized library XML files. Both manual entry points MUST share recognition, validation, preservation, failure, and reporting behavior with automatic migration while using the manual preview and conflict rules in FR-061 through FR-064. Preview and import MUST treat embedded code and plugin content as data and MUST NOT execute it or resolve external entities.
- **FR-061**: Every manual import, including import into an empty user library, MUST preview recognized types, folder count, item count, unsupported count, validation errors, exact duplicates, same-name conflicts, and proposed conflict behavior before applying changes; automatic first-run migration is the only no-preview path.
- **FR-062**: The default manual conflict policy MUST skip an exact object-content duplicate only within the same library type and explicitly resolved destination folder, retain the existing stable identity on reimport, keep and distinguish a same-name/same-folder item with different content using a deterministic unique display suffix, create missing destination folders, and preserve all existing content. When duplicate folder names make a path ambiguous, preview MUST distinguish the candidate folder identities and require the user to select the destination rather than guessing, merging by name, or creating an unrequested branch. If preserved raw content cannot be safely renamed, the display alias MUST NOT imply that the embedded name changed, and export reporting MUST disclose the original name.
- **FR-063**: Replacing an existing item MUST require an explicit choice, and replacing an entire library MUST never be the default.
- **FR-064**: Every import MUST be grouped under one internal import-batch identity with source hashes, outcome, counts, diagnostics, conflicts, and created-node provenance retained for safety and recovery. Libraries MUST NOT expose Import History, Migration Report, or import-undo presentation paths during healthy operation.
- **FR-065**: Export Current Library MUST apply only to one selected user-library type and propose its traditional filename; it MUST be unavailable for `All` or a project scope. Export All MUST write all four traditional filenames, including valid empty roots, to a user-selected directory.
- **FR-066**: Export MUST preserve Java-compatible root elements, category hierarchy, ordering, supported objects, and unchanged unsupported content, and MUST produce a compatibility report.
- **FR-067**: Before writing, export MUST identify any Blue Electron content that Java Blue cannot represent and let the user cancel or explicitly export only the compatible subset; unrepresentable data MUST never be silently omitted.
- **FR-068**: Export MUST check compatibility and every overwrite before changing any destination. The final result MUST contain either all requested new files or all prior destination files: if a later replacement fails after an earlier one changed, Blue MUST restore the earlier destination before reporting failure.
- **FR-069**: Import and export MUST remain explicit interchange operations; Blue MUST NOT continuously synchronize its user library with Java Blue XML files after migration.

#### Store Reliability And Verification

- **FR-070**: Every compound create, update, move, delete, and individual source-library import MUST either complete fully or leave the user library at its previous complete state. A multi-source import MAY retain successful independent sources only when its batch status and report identify every success and failure explicitly.
- **FR-071**: A required application upgrade to user-library storage MUST finish before Libraries becomes editable and MUST preserve a recoverable copy before any destructive conversion.
- **FR-072**: Blue MUST validate supported object content before saving and MUST retain the last valid saved value plus the user's unsaved editor state when validation fails.
- **FR-073**: A user-library open, integrity, lock, version, or upgrade failure MUST leave the rest of Blue usable, preserve the original library or its recoverable copy, and offer Retry, restore an available application backup, or confirmed fresh-library creation as applicable; explicit Java Blue re-import MUST remain available and no destructive choice may be the default.

### Key Entities

- **Library Type**: A reusable-object family such as Instrument, UDO, SoundObject, or Effect, with its own preview, editor, insertion semantics, project representation, and Java interchange form.
- **Library Scope**: The ownership and consequence context of an item: user library, project-owned, project-shared, or a future read-only factory source. A selected Effect chain is an Insertion Target, not a Library Scope.
- **Library Folder**: A stably identified ordered node that organizes user-library items of one type and can contain child folders.
- **Library Item**: A stably identified reusable definition with a type, folder, name, ordering, complete preserved content, support status, common descriptive information, created/updated timestamps, and an optional link to the import that created it.
- **Unsupported Library Item**: A Library Item whose original XML is preserved but whose object type cannot currently be edited; it retains organization and interchange capabilities.
- **Project Source**: A project-owned collection or context exposed through Libraries while remaining embedded in the current `.blue` document.
- **Insertion Target**: A transient exact project destination exposed during drag hover, drop, or destination paste, such as an Orchestra/UDO table insertion boundary, mixer-chain gap, or Score layer/time, together with the type it accepts.
- **Library Interaction Clipboard**: A transient main-owned typed cut/copy reference to a stable node and expected revision, broadcast to every application window and used by tree and destination Paste commands without placing XML in the operating-system clipboard.
- **Library Item Editor Session**: A full editable item's stable identity and scope, saved and unsaved versions, preview/pinned state, validation state, consequences, dependencies, and usage information, rendered in a main-workspace panel titled `Library Item` with the existing address/breadcrumb header.
- **Import Batch**: One automatic or manual import attempt with a stable identity, sources, timing, status, counts, warnings, conflicts, created nodes, and whether the exact undo conditions remain satisfied.
- **Legacy Migration State**: The application-level `never`, `completed`, `skipped`, or `failed` marker that prevents user-library loss or reset from silently repeating Java Blue import.
- **Compatibility Report**: A before-and-after record describing what can be imported or exported, what was skipped or preserved, conflicts, unsupported items, validation failures, and any explicit compatible-subset decision.
- **Library Backup**: A recoverable copy of the last usable user library created before a destructive application upgrade.

### Scope Boundaries

- Creating a synchronized ownership link between project and user items is out of scope. Independent cross-owner Copy and immediate detached Cut through the shared typed buffer are in scope; each pasted item remains owned solely by its destination.
- Creating identical project scopes for every type, including a Project Effects Library, is out of scope.
- Replacing type-specific editors with one generic property editor is out of scope.
- Making every type-specific object field a common searchable property is out of scope.
- Continuous synchronization with Java Blue XML is out of scope.
- Editing unsupported objects before their type is supported is out of scope.
- Factory libraries, cloud synchronization, multi-user sharing, permissions, tags, favorites, ratings, usage history, and full-object-content search are out of scope for this feature.
- Implementing reusable types beyond Instruments, UDOs, SoundObjects, and Effects, generic blank-item creation, new Effect test tooling, and cross-project usage tracking are out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability test, at least 90% of users can open Libraries, select a type, find a named user item, and reach its full main-area `Library Item` editor in under 30 seconds without assistance.
- **SC-002**: With Libraries and a compatible project surface visible, users can place an Instrument, UDO, Effect, or SoundObject with one drag-and-drop gesture; only a shared-copy choice or disclosed dependency/conflict may add a confirmation step. No persistent Browse or Insert button is used.
- **SC-003**: In 100% of the defined four-type insertion matrix, the result has the specified independent-copy or shared-instance behavior, and every saved project remains usable after the originating user library is unavailable.
- **SC-004**: Across 100 selection changes, clean preview-tab reuses, panel closes, and editor opens involving dirty or pinned sessions, no protected editor is replaced and no unsaved change is lost.
- **SC-005**: Scope and save-consequence text correctly identifies user, project, and project-shared items in 100% of type/scope test cases, including the affected instance count for shared objects.
- **SC-006**: With 10,000 user-library items on a system meeting Blue's published minimum requirements, Libraries shows its initial hierarchy within two seconds of being opened and 95% of folder expansions and case-insensitive item-name searches show useful results within one second.
- **SC-007**: User-library folder and item identities remain unchanged across 50 application restart, rename, move, edit, and non-duplicating application-upgrade cycles; duplicated nodes always receive distinct identities.
- **SC-008**: Automatic migration fixtures containing all four Java Blue library types preserve 100% of folders, item ordering, supported items, and unsupported XML content while leaving every source and backup file byte-for-byte unchanged.
- **SC-009**: In partial-migration tests, 100% of valid independent source files import despite another file being corrupt, every skipped or unsupported item appears in the report, and the application remains usable.
- **SC-010**: Import previews and final reports match actual folder, item, duplicate, conflict, unsupported, and error counts in 100% of conflict-policy fixtures; reimporting unchanged content creates zero duplicate items and retains existing identities, with zero unrequested replacements.
- **SC-011**: Export-and-reimport fixtures preserve 100% of representable hierarchy, ordering, supported content, and original unsupported content; every unrepresentable item is disclosed before output is written.
- **SC-012**: Across injected save, import, export, lock, corruption, and application-upgrade failures, 100% of tests leave source data and previously complete destination data unchanged or recoverable, expose the specified recovery choices and report, and keep non-library project work available.
- **SC-013**: In the compatibility corpus, 100% of unsupported or effectively unsupported items remain visible with their status, retain their stable identity and original XML, stay organizationally manageable and exportable, and are never silently omitted or made insertable.

## Assumptions

- Initial search is a case-insensitive substring match on item names, including safely extracted unsupported-item names, across the scopes allowed by the active type filter; descriptive metadata, code, full-object-content search, tags, and favorites can be added later without changing the ownership model.
- Project-owned objects continue to use their existing project editors and mutation rules inside the shared Library Item shell; this feature does not redefine the `.blue` project format.
- User-library insertions are value copies unless a project-shared SoundObject action explicitly creates another shared instance.
- Dragging between user and project ownership is an independent copy unless the destination is an internal project move target such as another mixer chain. Cut captures detached content and removes its source immediately; subsequent Paste operations independently copy that reusable buffer.
- Context menus and destination Paste provide the keyboard-equivalent path for every drag-only project placement result.
- User-library folder organization applies only to Libraries. Project Orchestra and UDO definitions remain in their existing editors; Project Shared SoundObjects use the separate SoundObject Library panel; selected mixer chains are targets rather than scopes.
- A first-run scan that finds no recognized Java Blue files records `skipped` so startup does not scan repeatedly; users can still run manual import later.
- Import-batch and source provenance remain internal durability/recovery data; this feature exposes no routine Import History, Migration Report, or import-undo command in Libraries.
- The Java Blue default configuration location and the four filenames/root hierarchies in this specification are the compatibility baseline; manual Import from Java Blue permits choosing a different configuration folder.
- Preserved unsupported XML remains authoritative until a supported editor performs a successful save, at which point normal supported serialization becomes authoritative.
- First-time user-library population is available through Java import, duplication, or ordinary project-to-user drag/Copy/Cut and Paste. This feature adds no generic blank-item workflow; any existing type-specific New command remains unchanged and outside this feature's acceptance scope.
- Item-owned and local dependencies travel with an independent project copy. External project-level dependencies and conflicts are disclosed before insertion, and unresolved cases block insertion rather than causing hidden project changes.
- User-library item usage is shown only when it is discoverable in the current project; independent historical copies are intentionally unlinked and are not tracked as usage.
- Export Current means the selected user-library type only. Import and export parsing never executes embedded object code or resolves external entities.
- Each library change and each individual source-library import is all-or-nothing; a multi-source batch can be partially successful because preserving valid sibling libraries is intentional, but the batch report must make that partial result explicit.
- The linked design-constraints artifact preserves the supplied storage and process decisions for planning while this specification defines observable behavior and compatibility outcomes.
- Existing domain-specific Browse/Add-from-Library controls are removed. The Window menu remains the primary explicit way to reveal Libraries, while legacy command identifiers may map to that one panel for saved-menu/layout compatibility.
- Libraries follows the persisted workbench layout on normal startup. A reset/default layout places the panel on the right, but Blue does not force it open again after a user intentionally closes it.
