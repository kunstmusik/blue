# Unified Libraries Design Constraints

**Status**: Required planning input  
**Source**: User-supplied Unified Libraries design report, refined by current Blue Electron and Java Blue review  
**Feature Specification**: [spec.md](spec.md)

## Purpose

This artifact preserves the supplied technical and architectural decisions without mixing them into the stakeholder-facing feature specification. Planning and implementation MUST honor the required constraints below. Items explicitly labeled for evaluation remain planning choices.

## Storage Ownership

- The user-library database MUST use SQLite.
- Its filename MUST be `blue_libraries.sqlite`.
- It MUST live under Electron's `app.getPath('userData')` location.
- It MUST NOT live under `~/.blue`; that directory remains owned by Java Blue configuration and legacy XML files.
- The database is the source of truth for user-library content only.
- Project Orchestra, project UDOs, Project Shared SoundObjects, and mixer Effect instances remain canonical in the current `.blue` project.
- Java Blue XML becomes an explicit import/export interchange format after migration, not a synchronization source.

## Process Boundary

- SQLite and import/export filesystem access MUST exist exclusively in the Electron main process.
- Renderer code MUST NOT open the database, know its physical path, execute SQL, or read/write library interchange files.
- Renderer access MUST use static, typed preload and IPC contracts.
- The backend library service MUST be testable without launching React or the full workbench.
- Concurrent automatic and manual imports MUST be serialized at this boundary.

## Repository Model

- Each library type has one root folder row.
- The common repository and editor-shell contracts SHOULD isolate type-specific preview, editing, scope, and insertion behavior so a future registered reusable type does not require a new persistence architecture or a second library workflow; implementing another type is outside this feature.
- Every database folder and item uses a stable UUID.
- Moving, renaming, editing, or restarting retains a node's UUID; duplication creates new UUIDs recursively.
- Database UUIDs are Blue Electron identities and MUST NOT be injected into Java Blue XML unless an existing Java format requires its own reference identifier.
- Hierarchy, sibling ordering, and common searchable projections are normalized.
- Complete object data is stored as XML in `payload_xml` rather than fully relational type-specific columns.
- Imported XML remains authoritative until a compatible editor successfully validates and serializes an edit.
- Unknown top-level or nested/plugin-defined content that cannot be safely round-tripped remains raw and read-only.
- Searchable projections and `payload_xml` MUST update in the same transaction.

The initial model SHOULD represent at least:

- Folder: UUID, library type, parent UUID, name, sort order, created timestamp, updated timestamp.
- Item: UUID, library type, folder UUID, name, object type, payload format, payload version, XML payload, payload hash, support status, optional metadata, import batch UUID, sort order, created timestamp, updated timestamp.
- Import batch: UUID, source kind, source path, source hash, start/completion timestamps, status, and structured result data.

Recommended initial indexes:

- Library type, parent folder, and sort order for folder browsing.
- Library type, folder, and sort order for item browsing.
- Library type and name for initial search.
- Payload hash for scoped duplicate detection.
- Import batch UUID for history and eligible undo.

Full-text search may be added later without changing XML payload ownership.

## Repository Operations

The main-process service needs typed operations equivalent to:

- List folder children and items by library type and parent.
- Search by query and filters.
- Read one complete item.
- Create, update, duplicate, move, reorder, and delete nodes.
- Import from a Java configuration folder or selected XML files.
- Export one or all user-library types.
- Read import history and evaluate batch undo eligibility.
- Report repository health, upgrade status, and recovery choices.

Concrete method names and request/response shapes are planning decisions.

## Reliability

- Foreign-key enforcement is required.
- Every compound repository mutation and every individual source-library import uses a transaction.
- Multi-source import intentionally permits reported per-source partial success; each source transaction remains atomic.
- Schema versioning MUST use `PRAGMA user_version` or an equivalent explicit mechanism.
- Required schema migrations run before Libraries becomes editable.
- A recoverable database backup is created before a destructive schema migration.
- Payloads are validated before supported edits commit.
- Browse and search queries MUST avoid decoding every complete payload.
- Export All preflights and stages all requested files before replacement and restores earlier destinations if a later replacement fails.
- Temporary export output followed by atomic per-file replacement is required.
- Imported XML MUST disable external-entity resolution and MUST treat embedded Csound, Jython, Clojure, and plugin content as data.

The following remain planning evaluations:

- SQLite driver choice, including Electron 35/Node 22 packaging, rebuilding, supported platforms, and testability.
- Whether write-ahead logging is appropriate for the selected driver and access pattern.
- Exact backup naming, retention, and user recovery presentation, provided the specification's recovery outcomes hold.

## Migration State

- `legacyLibraryMigration` MUST be stored outside `blue_libraries.sqlite` so a missing database cannot erase migration history.
- Allowed values are `never`, `completed`, `skipped`, and `failed`.
- The state belongs to main-process-managed application settings and MUST be merged safely so an unrelated Settings save or reset cannot overwrite it with a stale snapshot.
- Source path and content hashes belong in import history.
- Java primary files and `~` backups are read-only migration inputs and MUST never be renamed, moved, deleted, or rewritten.

## Java Interchange

The required files and roots are:

| Library | Filename | Root / category element |
|---------|----------|-------------------------|
| Instruments | `userInstrumentLibrary.xml` | `instrumentLibrary` / `instrumentCategory` |
| UDOs | `udoLibrary.xml` | `udoLibrary` / `udoCategory` |
| Effects | `effectsLibrary.xml` | `effectsLibrary` / `effectCategory` |
| SoundObjects | `soundObjectLibrary.xml` | `soundObjectLibrary` / `category` |

- Automatic first-run migration checks Java Blue's default `~/.blue` folder only under the eligibility rules in the specification.
- Manual Import from Java Blue accepts another configuration folder.
- Manual XML import accepts one or more individual recognized files.
- Automatic first-run import preserves duplicate names and exact type-specific ordering without an Imported wrapper.
- Instrument, UDO, and Effect libraries serialize category children before items; SoundObject libraries may require preserving mixed folder/item sibling order.
- Unsupported legacy payload XML remains unchanged through organization and export.
- Exact duplicate detection is scoped by library type and resolved destination folder; it MUST NOT globally collapse identical content intentionally stored in different folders.

## Existing Blue Electron Integration

- `packages/blue-app/src/main/mixer-effects-library.ts` currently reads `~/.blue/effectsLibrary.xml`, creates runtime-only UUIDs, and loses mutations on restart. Unified Libraries replaces that file as the active user Effect source after migration.
- The existing `@blue/data` `SoundObjectLibrary` is Project Shared SoundObjects stored in `.blue`; it MUST NOT be reused as the user SoundObject persistence model.
- The deferred program-wide Instrument and UDO library placeholders from Specs 021 and 026 converge on this feature.
- The Window menu and legacy library command IDs route to one logical Libraries panel. Destination-side Browse/Add-from-Library controls are removed rather than creating a persistent insertion mode.
- Saved workbench layouts containing a legacy library panel require a non-destructive mapping to the unified panel.
- Project collections that currently use mutable indexes or serialization references need project-session-safe editor identity so reorder, save/reload, or deletion cannot retarget an editor silently.
- Current type editors remain authoritative inside the common Library Item shell; this feature does not replace them with a generic property editor.

## Required Interaction Model

- The Libraries auxiliary panel is a compact navigator. Healthy state contains compact search/type/scope controls, the hierarchy, and one accessible vertical-ellipsis popup for import/export/history/migration-report commands.
- Successful migration MUST NOT occupy a persistent full-width header. Repository recovery may replace normal content only while the repository is unusable.
- Tree rows MUST NOT contain persistent Rename, Duplicate, Delete, or Insert buttons. Double-clicking the visible name and `F2` perform inline rename; scoped right-click and keyboard context menus provide Duplicate, Cut, Copy, Paste, Delete, and folder operations.
- Selecting a supported item opens or updates a main-workspace panel titled `Library Item`. It retains the existing address/breadcrumb header and hosts the full existing type-specific editor. Supported types MUST NOT use a generic raw XML textarea.
- One clean unpinned editor may be reused as a selection preview. First edit pins automatically; dirty or pinned sessions MUST NOT be replaced by later selection.
- Project placement uses a typed opaque drag token and keyboard-equivalent destination Paste. Orchestra/UDO tables, mixer-chain gaps, and Score layer/time positions expose exact transient targets and revalidate through main before atomic mutation.
- No destination surface retains a Browse/Insert mode, and Libraries has no persistent Insert button. User-library-to-project drag is always a copy; shared SoundObjects retain the explicit instance-versus-independent choice.

## Deferred Design Inputs

- Factory libraries, tags, favorites, ratings, usage history, cloud or multi-user synchronization, and payload-wide full-text search.
- Additional reusable object types beyond Instruments, UDOs, SoundObjects, and Effects.
- Generic blank-item creation and new Effect testing capabilities.
- A fully relational schema for type-specific object internals.
