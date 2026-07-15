# Feature Specification: Unified Libraries

**Feature Branch**: `060-unified-libraries`  
**Created**: 2026-07-15  
**Status**: Draft  
**Input**: User description: "Create a centralized Unified Libraries experience from the supplied design report, covering Instruments, UDOs, Effects, SoundObjects, project and user scopes, contextual insertion, full item editing, durable user-library storage, safe Java Blue migration, lossless unsupported-object preservation, and Java Blue-compatible XML import and export."
**Design Constraints**: [design-constraints.md](design-constraints.md)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find And Preview Reusable Objects (Priority: P1)

As a composer, I want one dockable Libraries panel for Blue's reusable object types so that I can find project-owned and user-owned material without learning a different library window for each part of Blue.

**Why this priority**: A unified, discoverable browsing experience is the central user value of this feature and is useful before any editing or migration workflow is added.

**Independent Test**: Populate project and user sources with Instruments, UDOs, SoundObjects, and Effects; open Libraries directly and from each contextual Browse action; then verify filtering, meaningful scopes, folder browsing, search, preview, source labels, and insertion-target display without opening a full editor.

**Acceptance Scenarios**:

1. **Given** a project and user libraries contain several supported object types, **When** the user opens Libraries, **Then** one dockable panel offers `All`, `Instruments`, `UDOs`, `SoundObjects`, and `Effects` filters, a search field, meaningful scope sections, and a folder-and-item hierarchy.
2. **Given** the user selects an Instrument, UDO, Effect, or SoundObject once, **When** the selection changes, **Then** the panel shows a lightweight type-appropriate summary without replacing the panel with a full editor.
3. **Given** the user selects a type filter, **When** the panel displays its scopes, **Then** it shows only the project and user sources that actually exist for that type; Effects show a user-library source while a selected project chain appears only as an insertion target, never as a Project Effects Library.
4. **Given** the user invokes a domain-specific Browse action, **When** Libraries opens, **Then** it selects the requested type and clearly identifies any current insertion target, such as a channel and effect-chain position.
5. **Given** items with the same name exist in different types or scopes, **When** they appear in browse or search results, **Then** each result remains distinguishable by type, scope, and folder context.
6. **Given** no project is open, **When** the user opens Libraries, **Then** user-library browse, search, edit, import, export, and recovery remain available while project scopes and insertion are unavailable.
7. **Given** an existing action or saved layout refers to a legacy library surface, **When** it is invoked or restored, **Then** Blue opens or maps it to the one logical Libraries panel without creating a duplicate panel or discarding unrelated layout state.

---

### User Story 2 - Insert The Right Kind Of Project Copy (Priority: P1)

As a composer building a project, I want library objects inserted into the correct project context with clear copy or shared-reference behavior so that later library edits do not unexpectedly change my music.

**Why this priority**: Reuse is the purpose of a library, and incorrect copy semantics could silently alter existing projects or break project portability.

**Independent Test**: Open Libraries from Orchestra, the project UDO editor, a mixer chain, and Score; insert one item of each type; save and reopen the project; edit the source library items; and verify the destination, identity, independence, and shared SoundObject choices for every insertion.

**Acceptance Scenarios**:

1. **Given** a user-library Instrument and an active project, **When** the user inserts it into Orchestra, **Then** the project receives an independent Instrument copy.
2. **Given** a user-library UDO and an active project, **When** the user inserts it into the project UDO list, **Then** the project receives an independent UDO copy.
3. **Given** a user-library Effect and a valid selected mixer-chain target, **When** the user inserts it, **Then** the target chain receives an independent Effect copy at the indicated position.
4. **Given** a user-library SoundObject and a valid Score destination, **When** the user inserts it, **Then** the project receives an independent SoundObject copy by default.
5. **Given** a project-shared SoundObject, **When** the user chooses a copy action, **Then** the user can explicitly choose between another shared instance and an independent copy.
6. **Given** a user-library item has already been inserted, **When** its user-library definition is edited later, **Then** the existing project copy remains unchanged while future insertions use the saved definition.
7. **Given** a contextual target is missing, ambiguous, or no longer exists, **When** the user attempts insertion, **Then** Blue prevents insertion into an unintended location and explains how to select a valid target.
8. **Given** an item owns local data and also declares external project-level dependencies, **When** insertion is requested, **Then** Blue includes the item-owned data, identifies unresolved external dependencies before changing the project, and requires an explicit resolution rather than silently mutating other project collections.

---

### User Story 3 - Edit And Organize Library Items Safely (Priority: P1)

As a library maintainer, I want full type-specific editing in the main workspace, with common save, organization, identity, and consequence controls, so that complex objects are comfortable to edit and accidental data loss is prevented.

**Why this priority**: Centralized browsing is incomplete unless users can maintain reusable content without returning to fragmented or modal editing workflows.

**Independent Test**: Open supported user and project items of every type, edit them through the shared Library Item shell, exercise preview-tab reuse and pinning, perform folder and item operations, restart Blue, and verify dirty-state safety, type-specific editors, scope consequences, and stable identity.

**Acceptance Scenarios**:

1. **Given** a supported item is selected, **When** the user double-clicks it or chooses Edit, **Then** a Library Item editor opens in the main workspace with common identity, scope, folder, dirty-state, save, revert, organization, applicable current-project usage, and dependency information around the native editor for that type.
2. **Given** a temporary Library Item tab is unmodified, **When** the user opens another item in preview mode, **Then** Blue may reuse that tab; once the tab is edited or explicitly pinned, selection changes cannot replace it.
3. **Given** an item has unsaved changes, **When** the user changes library selection, closes the panel, or opens another item, **Then** the unsaved editor remains available and its changes are not silently discarded.
4. **Given** a user-library, project-owned, or project-shared item is open, **When** the editor renders, **Then** it explains the scope and the consequence of saving, including the shared-instance count when applicable.
5. **Given** a user-library folder or supported item, **When** the user creates a folder, saves a supported project object as a user-library copy, or renames, duplicates, moves, reorders, or deletes library content, **Then** the hierarchy and ordering persist across restart without changing the originating project object or any already-inserted project copy.
6. **Given** a project item is shown through Libraries, **When** an organization or lifecycle command is not meaningful for that project model, **Then** the command is unavailable rather than simulating a user-library folder operation.
7. **Given** a complex type-specific editor needs more room, **When** the user collapses the Libraries panel, **Then** the workspace editor remains open and usable.
8. **Given** a dirty editor is closed, the application quits, or its owning project closes or changes, **When** the draft cannot remain safely attached to the same item, **Then** Blue requires a Save, Discard, or Cancel decision and never applies the draft to another project or item.
9. **Given** a Project Shared SoundObject has linked instances, **When** the user deletes its definition, **Then** Blue shows the affected count, requires confirmation, and applies the native linked-instance deletion rule without leaving broken references.
10. **Given** another surface changes an item while its Library Item editor has a draft, **When** that draft is saved, **Then** Blue identifies the conflict and does not silently overwrite the newer value.

---

### User Story 4 - Preserve Existing Java Blue Libraries On First Run (Priority: P1)

As an existing Java Blue user, I want my libraries brought into Blue Electron automatically and visibly on first use, without changing the Java files or dropping unsupported objects, so that upgrading is safe and requires little setup.

**Why this priority**: Existing users may have years of reusable content. A lossy or invisible migration would undermine trust in the entire library system.

**Independent Test**: Start with a new user-library store and representative Java Blue configuration folders containing all four recognized files, nested categories, ordering, duplicates, unsupported objects, a corrupt file, and a backup; then verify source immutability, independent-file progress, preservation, history, summary, retry behavior, and recovery-state handling.

**Acceptance Scenarios**:

1. **Given** the user-library store is new and empty, migration state is `never`, and recognized Java Blue files exist in the default configuration folder, **When** Blue initializes Libraries, **Then** it imports the valid files automatically and shows a non-blocking count summary with access to a detailed report.
2. **Given** a first-run import succeeds, **When** folder trees and items are compared with the Java source, **Then** hierarchy, ordering, supported content, and original unsupported XML are preserved without an extra Imported wrapper folder.
3. **Given** one recognized source file is corrupt, **When** automatic migration runs, **Then** Blue reports that file, continues with the other valid libraries, remains usable, and does not silently retry the failed source on every startup.
4. **Given** an unsupported or plugin-defined object appears in a valid source file, **When** it is imported, **Then** the object remains in its original folder with its original XML, appears with a warning, and remains organizable and exportable.
5. **Given** a corrupt primary file has a `~` backup, **When** migration reports the failure, **Then** Blue offers the backup as an explicit choice and does not substitute it automatically.
6. **Given** no recognized Java Blue files exist, **When** first-run initialization completes, **Then** Blue creates an empty usable library, records the scan as skipped so it is not repeated silently, and does not block application startup.
7. **Given** migration previously completed but the user-library store later disappears, **When** Blue starts, **Then** it presents a recovery choice instead of silently importing the Java files again.
8. **Given** migration reads any primary or backup Java Blue file, **When** the migration finishes or fails, **Then** every source file remains byte-for-byte unchanged and in its original location.

---

### User Story 5 - Import, Export, And Review Compatibility (Priority: P2)

As a user moving content between installations or between Java Blue and Blue Electron, I want explicit previewed import and compatible export workflows so that conflicts, unsupported content, and overwrites never surprise me.

**Why this priority**: Manual interchange is essential for compatibility and recovery, but users can receive initial value from browsing, editing, and first-run migration before using it.

**Independent Test**: Import a Java Blue configuration directory and separately selected XML files into a non-empty library with duplicate and conflicting content; inspect history and undo availability; then export one library and all libraries into empty and occupied destinations and verify previews, conflict defaults, filenames, compatibility reporting, ordering, unsupported content, and all-or-nothing failure behavior.

**Acceptance Scenarios**:

1. **Given** the user chooses Import from Java Blue, **When** a configuration folder is selected, **Then** Blue recognizes any of the four traditional library files and uses the same validation and reporting rules as first-run migration.
2. **Given** the user chooses Import XML Library Files, **When** one or more recognized files are selected, **Then** Blue identifies their library types from their content and previews the proposed operation before changing any destination.
3. **Given** a manual import is previewed, **When** Blue evaluates the selected sources, **Then** it accurately reports recognized types, folder and item counts, unsupported items, validation errors, exact duplicates, name conflicts, and the proposed conflict decisions.
4. **Given** incoming object content exactly matches an item in the same library type and resolved destination folder, **When** the default conflict policy is accepted, **Then** Blue keeps the existing item and identity; if that folder contains the same name with different content, Blue keeps both and assigns the incoming display name a deterministic unique suffix without corrupting preserved raw XML.
5. **Given** import would replace an item or an entire library, **When** the user has not explicitly selected that destructive policy, **Then** Blue preserves the existing content.
6. **Given** an import completes, **When** the user opens Import History, **Then** the complete batch, source, status, counts, warnings, and whether the exact undo conditions are met can be reviewed together, including the reason when Undo is unavailable.
7. **Given** the user exports the current type or all types, **When** compatible output is confirmed, **Then** Blue writes the traditional Java Blue filename or filenames while preserving representable hierarchy, ordering, supported objects, and preserved unsupported objects.
8. **Given** an item cannot be represented by Java Blue or a destination file already exists, **When** export is requested, **Then** Blue reports the incompatibility or overwrite before changing the destination and requires an explicit decision to cancel, overwrite, or export only the compatible subset.
9. **Given** imported XML contains embedded object code, plugin content, or external-entity declarations, **When** Blue previews or imports it, **Then** the content is treated as data and is not executed or externally resolved.
10. **Given** Export All targets four destinations and any compatibility, overwrite, validation, or before-write check fails or is canceled, **When** the operation ends, **Then** none of the existing destination files has been changed.
11. **Given** an additive import batch created only new, still-unchanged nodes and no batch-created folder contains later content, **When** the user confirms Undo from Import History, **Then** Blue removes only that batch's items and then its now-empty batch-created folders; otherwise Undo is unavailable with the disqualifying change explained.

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
- A library type has an empty user scope, an empty project scope, or no meaningful project scope at all.
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
- An import batch has subsequently imported items that were edited, moved, duplicated, or deleted before the user requests undo.
- Export contains preserved unsupported objects or new Blue Electron objects that Java Blue cannot represent.
- An export destination is read-only, out of space, interrupted, or already contains one or more traditional filenames.
- The user requests Export All and one library cannot be prepared or written.
- Stable internal identifiers collide because of damaged data or an attempted duplicate operation.
- The user library is locked, corrupted, uses an unknown newer storage format, or fails during an application upgrade.

## Requirements *(mandatory)*

### Required Scope Model

| Object type | Project source or context | User source |
|-------------|---------------------------|-------------|
| Instrument | Project Orchestra | Instrument Library |
| UDO | Project UDO list | UDO Library |
| SoundObject | Project Shared SoundObjects | SoundObject Library |
| Effect | None; a selected mixer/effect-chain is an insertion target only | Effect Library |

Effects MUST show a user-library section only. A selected mixer/effect-chain appears as a target banner and MUST NOT become a browsable or persisted Project Effects Library. Future factory content may use a separate read-only scope, but factory content is outside this feature.

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
- **FR-002**: The panel MUST provide one global, case-insensitive item-name search and the filters `All`, `Instruments`, `UDOs`, `SoundObjects`, and `Effects`; search MUST cover the scopes visible to the active type filter, include safely extracted unsupported-item names, and identify no-result state clearly.
- **FR-003**: Within a selected type, the panel MUST organize content by the meaningful project and user scopes defined in the Required Scope Model, followed by that scope's folder or native hierarchy; an Effect insertion target MUST remain a target banner rather than a scope.
- **FR-004**: Every visible item and search result MUST identify its object type, scope, and enough folder or project context to distinguish same-name results.
- **FR-005**: Selecting an item once MUST show a lightweight preview in the panel without opening or embedding the full editor.
- **FR-006**: Instrument previews MUST show type and labeled fields for interface summary, dependencies, and description; UDO previews signature, style, and comments; Effect previews input/output count, interface summary, and description; and SoundObject previews type, duration, and a miniature score summary. When a type-specific value cannot be safely extracted, its labeled field MUST show `Unavailable` and any support warning rather than disappearing or inventing a value.
- **FR-007**: Existing contextual Browse entry points from Orchestra, project UDOs, mixer chains, and Score MUST route to the centralized panel with the appropriate type selected.
- **FR-008**: A contextual opening MUST show the active insertion target and keep insertion disabled whenever that target is absent, ambiguous, stale, or incompatible.
- **FR-009**: Existing library actions, panel identifiers, and saved workbench layouts MUST converge on one logical Libraries panel, without restoring a duplicate legacy library panel or losing the user's otherwise valid workbench layout.
- **FR-010**: User-library browsing, search, editing, import, export, and recovery MUST remain available when no project is open; project scopes and insertion actions MUST then be absent or disabled.

#### Item Editing And Organization

- **FR-011**: Double-clicking an item or choosing Edit MUST open a Library Item editor in the main workspace rather than a modal dialog or a full editor embedded in the Libraries panel.
- **FR-012**: The Library Item editor shell MUST show the item name, object type, scope, folder or project breadcrumb, dirty state, Save and Revert actions, applicable Duplicate/Move/Delete commands, insertion or copy actions, dependency information, and usage that is discoverable in the current project; unlinked historical project copies MUST be identified as untracked rather than reported as known usage.
- **FR-013**: The editor shell MUST host the available native type-specific capabilities: Instrument interface/code/local UDOs/properties; UDO signature/code/style/documentation/validation; Effect interface/code/input-output configuration and existing testing support; or the existing SoundObject editor with copy/reference controls.
- **FR-014**: One logical editor session MUST represent a stable item identity at a time, so another entry point focuses that session rather than creating an unaware competing editor. A newly opened item MAY use a reusable temporary tab only while unmodified and unpinned; editing MUST pin it automatically, explicit pinning MUST be available, and an unsaved or pinned tab MUST never be replaced by later library selection. Reordering a project collection MUST NOT rebind an open editor to a different item. If another surface changes the item, Save MUST offer Reload Latest and discard the draft, Cancel and retain the draft, or an explicit reviewed overwrite; no choice may happen silently. Restoring a saved project-item editor MUST resolve the same logical project definition or a safe missing-item state, never whichever item later occupies a saved index or reference.
- **FR-015**: Save MUST persist the complete edited item and its displayed searchable metadata as one change. When the editor is dirty, Revert MUST ask for confirmation: Cancel retains the draft, while Confirm discards it and restores the last saved version. Closing a dirty editor, quitting, or closing or switching its project MUST require Save, Discard, or Cancel when the draft cannot remain safely open.
- **FR-016**: The editor header MUST explain the consequence of saving for user-library, project-owned, and project-shared items, including the number of affected shared instances when known. Saving a project item MUST mark the project dirty and persist through the normal project-save lifecycle; saving a user-library item MUST persist independently of any open project.
- **FR-017**: User-library item editing MUST affect future insertions only and MUST NOT retroactively update project copies.
- **FR-018**: Editing a project-shared SoundObject MUST update all instances that reference that shared definition, and the editor MUST disclose that consequence before save. Deleting that shared definition MUST show the linked-instance count, require confirmation, and remove the linked project instances according to the native project rule rather than leaving broken references.
- **FR-019**: Users MUST be able to create user-library folders, duplicate supported user-library items, and explicitly save a supported project object as a new user-library copy. This feature does not add generic blank-item creation; any pre-existing type-specific New command remains unchanged and outside this feature's acceptance scope.
- **FR-020**: Folder and supported-item names MUST be non-empty after trimming and contain no control characters; duplicate names and Unicode text remain valid. Invalid edits MUST leave the prior name unchanged, keep the edit active, and identify the invalid field. Users MUST be able to rename valid nodes and to move, reorder, and delete permitted user-library nodes, but roots MUST be immovable and undeletable, folders MUST NOT move into themselves or descendants, cross-type and project-to-user moves MUST be prohibited, and deleting a non-empty folder MUST show affected counts and require confirmation. Project-scope commands MUST follow the native project model and be unavailable when no meaningful equivalent exists.
- **FR-021**: Collapsing or closing the Libraries panel MUST NOT close an open Library Item editor or discard its unsaved state. Moving or renaming an open item MUST update its breadcrumb by identity. Deleting a dirty item MUST first require Save, Discard, or Cancel; confirmed deletion MUST close its editor, while deletion by another surface MUST leave an explicit read-only missing-item state and MUST NOT rebind the editor to a neighboring item.

#### Project Insertion And Portability

- **FR-022**: Insertion actions MUST be type- and target-sensitive and MUST identify the destination before applying a change. Instruments and UDOs use their fixed current-project collections; Effects require a selected effect-chain position; SoundObjects require an explicit valid Score path, layer, and time rather than an inferred fallback.
- **FR-023**: Inserting a user-library Instrument MUST add an independent copy to the Project Orchestra using a non-colliding project assignment identity and MUST NOT overwrite an existing Instrument.
- **FR-024**: Inserting a user-library UDO MUST add an independent entry to the project UDO list and preserve any same-name project UDO rather than replacing or reusing it implicitly.
- **FR-025**: Inserting a user-library Effect MUST add an independent copy to the selected mixer/effect chain at the selected position.
- **FR-026**: Inserting a user-library SoundObject MUST add an independent project copy by default and MUST preserve its intended musical duration and time behavior when adapting it to the destination project's time base.
- **FR-027**: Copying a Project Shared SoundObject MUST offer explicit `Copy Instance` and `Copy Independent` choices with their consequences visible; Copy Instance MUST remain linked to the project-shared definition, while Copy Independent MUST create a deep, unlinked project copy.
- **FR-028**: Independent copies MUST receive project-appropriate identity, include all item-owned/local data, mark the project dirty, and remain valid after the project is saved or opened without access to the originating user library. External files continue to follow the project's existing portability rules and MUST be disclosed before insertion.
- **FR-029**: Deleting or editing a user-library source MUST NOT delete, invalidate, or change any independent project copy previously created from it.
- **FR-030**: Before insertion, Blue MUST disclose unresolved external project-level dependencies or conflicts. The deterministic default is to block insertion without changing the project; the user resolves the reported problem outside the insertion flow and retries. Insertion MUST otherwise be all-or-nothing and MUST NOT silently mutate unrelated project collections.

#### User-Library Ownership And Identity

- **FR-031**: User-library content MUST live in durable application-owned storage that is separate from Java Blue configuration files and from every `.blue` project.
- **FR-032**: The application-owned user library MUST be the source of truth for user-library content only; Project Orchestra, project UDOs, Project Shared SoundObjects, and project Effect instances MUST remain owned by and embedded in the `.blue` project.
- **FR-033**: The panel MUST compose project and user sources into one experience without automatically changing the ownership of project definitions.
- **FR-034**: Every user-library folder and item MUST have a stable identity that remains unchanged across application restarts, browsing, editing, moves, import-history review, and non-duplicating application upgrades.
- **FR-035**: Duplicating an item or folder MUST create new stable identities for the copies; moving or renaming an existing node MUST retain its identity.
- **FR-036**: Internal user-library identities MUST NOT alter Java Blue interchange content unless the Java-compatible object format already requires its own reference identifier.
- **FR-037**: The user library MUST preserve hierarchy, folder and item sibling ordering, name, object type, support status, complete object content, created and updated timestamps, and which import created an imported item.
- **FR-038**: Imported object content MUST remain lossless and authoritative until a compatible editor successfully saves it; saving MUST leave users with either the complete prior item or the complete updated item, never mismatched content and browse metadata.
- **FR-039**: User-library changes initiated from different application surfaces MUST follow the same validation, ownership, conflict, and failure rules.
- **FR-040**: Browse, search, item management, import, export, history, and recovery MUST remain behaviorally consistent whether invoked from Libraries, a contextual entry point, or startup migration.
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
- **FR-052**: Every migration attempt MUST record its source kind and location, start and completion times, status, result counts, errors, duplicates, unsupported items, and a link to its Import History record.
- **FR-053**: After automatic migration, Blue MUST show a non-blocking summary by library type with access to the full report; partial per-file success MUST be recorded as a completed migration with a partial result, while `failed` is reserved for a pipeline or store failure that imports no source.
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

#### Manual Import, Export, And History

- **FR-058**: The Libraries actions menu MUST offer `Import from Java Blue`, `Import XML Library Files`, `Export Current Library as Java Blue XML`, `Export All as Java Blue XML`, and `View Import History`, and its control MUST have the accessible name `Library Actions`.
- **FR-059**: An empty user library MAY additionally show a prominent Import from Java Blue action, but the permanent actions menu MUST remain available.
- **FR-060**: Import from Java Blue MUST accept an auto-detected or user-selected Java Blue configuration folder; Import XML Library Files MUST accept one or more individual recognized library XML files. Both manual entry points MUST share recognition, validation, preservation, failure, and reporting behavior with automatic migration while using the manual preview and conflict rules in FR-061 through FR-064. Preview and import MUST treat embedded code and plugin content as data and MUST NOT execute it or resolve external entities.
- **FR-061**: Every manual import, including import into an empty user library, MUST preview recognized types, folder count, item count, unsupported count, validation errors, exact duplicates, same-name conflicts, and proposed conflict behavior before applying changes; automatic first-run migration is the only no-preview path.
- **FR-062**: The default manual conflict policy MUST skip an exact object-content duplicate only within the same library type and explicitly resolved destination folder, retain the existing stable identity on reimport, keep and distinguish a same-name/same-folder item with different content using a deterministic unique display suffix, create missing destination folders, and preserve all existing content. When duplicate folder names make a path ambiguous, preview MUST distinguish the candidate folder identities and require the user to select the destination rather than guessing, merging by name, or creating an unrequested branch. If preserved raw content cannot be safely renamed, the display alias MUST NOT imply that the embedded name changed, and export reporting MUST disclose the original name.
- **FR-063**: Replacing an existing item MUST require an explicit choice, and replacing an entire library MUST never be the default.
- **FR-064**: Every import MUST be grouped under one import-batch identity visible in Import History. Undo MUST be available only for an additive batch with no replacements when every batch-created item and folder remains unchanged and no batch-created folder contains later content. Undo MUST remove only batch-created items and then batch-created folders that are empty; otherwise it MUST be unavailable with the disqualifying change explained.
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
- **Insertion Target**: The current project destination, such as Orchestra, project UDOs, a mixer-chain position, or Score, together with the type of insertion it accepts.
- **Library Item Editor Session**: The open item, its stable identity and scope, preview/pinned state, saved and unsaved versions, validation state, consequences, dependencies, and usage information.
- **Import Batch**: One automatic or manual import attempt with a stable identity, sources, timing, status, counts, warnings, conflicts, created nodes, and whether the exact undo conditions remain satisfied.
- **Legacy Migration State**: The application-level `never`, `completed`, `skipped`, or `failed` marker that prevents user-library loss or reset from silently repeating Java Blue import.
- **Compatibility Report**: A before-and-after record describing what can be imported or exported, what was skipped or preserved, conflicts, unsupported items, validation failures, and any explicit compatible-subset decision.
- **Library Backup**: A recoverable copy of the last usable user library created before a destructive application upgrade.

### Scope Boundaries

- Moving project-owned objects into application-owned user-library storage is out of scope; an explicit independent copy from a supported project object into the corresponding user library is in scope.
- Creating identical project scopes for every type, including a Project Effects Library, is out of scope.
- Replacing type-specific editors with one generic property editor is out of scope.
- Making every type-specific object field a common searchable property is out of scope.
- Continuous synchronization with Java Blue XML is out of scope.
- Editing unsupported objects before their type is supported is out of scope.
- Factory libraries, cloud synchronization, multi-user sharing, permissions, tags, favorites, ratings, usage history, and full-object-content search are out of scope for this feature.
- Implementing reusable types beyond Instruments, UDOs, SoundObjects, and Effects, generic blank-item creation, new Effect test tooling, and cross-project usage tracking are out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability test, at least 90% of users can open Libraries, select a type and meaningful scope, find a named item, and view its preview in under 30 seconds without assistance.
- **SC-002**: From each contextual Browse entry point, users can insert a compatible Instrument, UDO, Effect, or SoundObject with a valid preselected target and no unresolved dependency conflict in no more than three deliberate actions after selecting the item.
- **SC-003**: In 100% of the defined four-type insertion matrix, the result has the specified independent-copy or shared-instance behavior, and every saved project remains usable after the originating user library is unavailable.
- **SC-004**: Across 100 selection changes, tab reuses, panel closes, and item opens involving dirty or pinned editors, no unsaved editor is replaced and no unsaved change is lost.
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
- User-library folder organization applies to the user scope. Project scopes expose only the hierarchy and mutations meaningful to Orchestra, the project UDO list, and Project Shared SoundObjects; selected mixer chains are targets rather than scopes.
- A first-run scan that finds no recognized Java Blue files records `skipped` so startup does not scan repeatedly; users can still run manual import later.
- An import batch is undoable only under FR-064's exact additive, unchanged-node, and empty-created-folder conditions; all other batches remain reviewable but cannot be automatically reversed.
- The Java Blue default configuration location and the four filenames/root hierarchies in this specification are the compatibility baseline; manual Import from Java Blue permits choosing a different configuration folder.
- Preserved unsupported XML remains authoritative until a supported editor performs a successful save, at which point normal supported serialization becomes authoritative.
- First-time user-library population is available through Java import, duplication, or an explicit project-to-user copy. This feature adds no generic blank-item workflow; any existing type-specific New command remains unchanged and outside this feature's acceptance scope.
- Item-owned and local dependencies travel with an independent project copy. External project-level dependencies and conflicts are disclosed before insertion, and unresolved cases block insertion rather than causing hidden project changes.
- User-library item usage is shown only when it is discoverable in the current project; independent historical copies are intentionally unlinked and are not tracked as usage.
- Export Current means the selected user-library type only. Import and export parsing never executes embedded object code or resolves external entities.
- Each library change and each individual source-library import is all-or-nothing; a multi-source batch can be partially successful because preserving valid sibling libraries is intentional, but the batch report must make that partial result explicit.
- The linked design-constraints artifact preserves the supplied storage and process decisions for planning while this specification defines observable behavior and compatibility outcomes.
- Existing domain-specific Browse actions remain available as entry points but do not retain separate permanent library interfaces.
- Libraries follows the persisted workbench layout on normal startup. A reset/default layout places the panel on the right, but Blue does not force it open again after a user intentionally closes it.
