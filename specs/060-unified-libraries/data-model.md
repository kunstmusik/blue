# Phase 1 Data Model: Unified Libraries

## Overview

Unified Libraries composes two ownership systems without merging them:

```text
App-owned user content                     Project-owned content
blue_libraries.sqlite                      canonical BlueData / .blue XML
        │                                           │
        └────────── UnifiedLibraryService ──────────┘
                           │
                  typed preload snapshots
                           │
       User Libraries panel + Project SoundObject Library + Library Item editor tabs
```

The SQLite repository owns only the four user libraries. Project Orchestra, project UDOs, Project Shared SoundObjects, mixer chains, and Score remain canonical in the current `BlueData`. `blue-libraries-state.json` is a third, deliberately small lifetime boundary: it records migration/recovery state even if the database is missing or unusable.

## Shared Enumerations

### `LibraryType`

```text
instrument | udo | soundObject | effect
```

### `LibraryScopeKind`

```text
user | projectOwned | projectShared
```

- `user`: application-owned SQLite item.
- `projectOwned`: Project Orchestra Instrument or project UDO.
- `projectShared`: SoundObject definition whose project instances may share it.
- Effects have only the `user` scope. A selected chain is a target, never a scope.

### `LibrarySupportStatus`

```text
supported | unsupported
```

An item is `supported` only when its complete recursive payload can be loaded, edited, validated, and saved without dropping unknown content. An unknown top-level type and a known object with unknown nested/plugin content are both `unsupported`.

### `LibraryServicePhase`

```text
initializing | migrating | ready | readOnlyFailure | recovering | stopped
```

Only `ready` accepts mutations. Browse/history may remain available in a safe read-only mode when repository health allows it. Project work remains usable in every phase.

### `LegacyMigrationState`

```text
never | completed | skipped | failed
```

This state is persisted outside SQLite and interpreted with current database health/content exactly as specified in the migration-state matrix.

## Durable SQLite Entities

### Entity: `LibraryNode`

One stable node in a user-library tree. Roots and folders have no payload; item nodes have one `LibraryItemPayload` row.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID text | Primary key; immutable; new UUID for duplicate/copy |
| `libraryType` | `LibraryType` | Immutable; child and parent types must match |
| `nodeKind` | `root \| folder \| item` | Immutable after creation |
| `parentId` | UUID text or null | Null only for roots; foreign key to a root/folder |
| `displayName` | text | Trimmed, non-empty, no control characters; Unicode and duplicates allowed |
| `searchName` | text | Derived NFKC-normalized lowercase name; never user-authored |
| `sortIndex` | nonnegative integer | Ordering according to the type policy below |
| `revision` | positive integer | Incremented by every persisted mutation affecting this node |
| `createdAt` | ISO-8601 text | Set once |
| `updatedAt` | ISO-8601 text | Updated in the same transaction as content/metadata |
| `createdByImportBatchId` | UUID text or null | Provenance for conditional import undo |

#### Root invariants

- Exactly one `root` exists for each `LibraryType`.
- Roots are created when schema version 1 is initialized and retain their UUIDs across restart/upgrade.
- Roots cannot be renamed, moved, duplicated, or deleted through public commands.
- A root has `parentId = null`; all non-roots have a parent of the same type.

#### Tree invariants

- A folder cannot move into itself or any descendant.
- Item nodes cannot have children.
- Cross-type moves are invalid.
- Project nodes are never inserted into this table; project-to-user Copy/drag creates an independent user item through the shared transfer service, while Cut captures a detached snapshot and removes the project source before any later user-library Paste.
- Duplicate sibling names are legal, so no `(parentId, displayName)` uniqueness rule exists.
- Compound move/delete/duplicate operations validate the complete affected subtree before `BEGIN IMMEDIATE` commit.

#### Ordering policy

- For `instrument`, `udo`, and `effect`, repository queries/export sort folders by `sortIndex`, then items by `sortIndex`; each block retains relative source/user order.
- For `soundObject`, `sortIndex` is a single mixed child order across folders and items.
- Reordering normalizes the affected sibling set within the same transaction; roots are excluded.

### Entity: `LibraryItemPayload`

The complete content and browse/editor metadata for an item node.

| Field | Type | Rules |
|-------|------|-------|
| `nodeId` | UUID text | Primary/foreign key to an `item` node; cascade delete |
| `embeddedName` | text or null | Name safely observed in payload; may differ from display alias |
| `objectType` | text | Original outer class/type discriminator or stable fallback label |
| `supportStatus` | `LibrarySupportStatus` | Conservative whole-payload classification |
| `supportReasonCode` | text or null | Stable reason such as `unknown-type`, `unknown-nested-content`, `roundtrip-mismatch` |
| `supportMessage` | text or null | Sanitized user-facing explanation |
| `payloadXml` | text | Complete authoritative leaf XML; exact imported slice until supported Save |
| `rawHash` | lowercase hex | Hash of exact `payloadXml` bytes for provenance/change detection |
| `canonicalContentHash` | lowercase hex | Hash of deterministic canonical XML content for exact-duplicate policy |
| `serializerRevision` | text or null | Adapter revision that last produced a supported payload |
| `previewJson` | JSON text | Small validated preview fields; explicit unavailable markers |
| `dependencyJson` | JSON text | Item-owned and unresolved external dependency summary |
| `metadataRevision` | positive integer | Adapter schema version for cached derived fields |

#### Payload invariants

- `payloadXml` is never reconstructed merely to browse, move, duplicate, or export an unchanged item.
- Unsupported items may change only node organization/display alias; their payload stays byte-identical.
- A supported Save validates the complete draft, serializes it, recomputes both hashes and all cached metadata, increments node revision, and writes everything in one transaction.
- Failed validation changes neither the saved row nor its metadata. The editor draft remains available.
- Internal UUIDs never enter `payloadXml` unless a Java object format independently requires its own reference identifier.
- A display alias created by import conflict does not claim the embedded name changed. Export reports the discrepancy.

### Entity: `LibraryStoreState`

A single-row repository counter used for snapshot ordering and optimistic refresh.

| Field | Type | Rules |
|-------|------|-------|
| `singletonId` | integer | Always `1` |
| `contentRevision` | nonnegative integer | Incremented once per committed public mutation/source import/undo |
| `createdAt` | ISO-8601 text | Database creation time |
| `updatedAt` | ISO-8601 text | Last committed content change |

`PRAGMA user_version`, not this row, is the storage schema version.

### Entity: `ImportBatch`

One automatic or manual import attempt, including a multi-source partial result.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID text | Stable history identity |
| `mode` | `automatic \| manualJavaFolder \| manualXmlFiles` | Entry path |
| `status` | `previewed \| running \| completed \| partial \| failed \| undone` | Terminal state is explicit |
| `startedAt` | ISO-8601 text | Required |
| `completedAt` | ISO-8601 text or null | Set on terminal status |
| `sourceCount` | integer | Number of attempted source files |
| `countsJson` | JSON text | Folders/items/duplicates/conflicts/unsupported/errors by type |
| `reportJson` | JSON text | Complete compatibility/result report |
| `undoEligible` | boolean | Derived and revalidated before undo |
| `undoBlockedReason` | text or null | Explains replacement/later edits/later children/etc. |

An automatic first-run migration and a manual multi-file import each create one batch. A corrupt source does not roll back independently committed valid sources; terminal status and report identify that partial result.

### Entity: `ImportSource`

One file considered within an import batch.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID text | Primary key |
| `batchId` | UUID text | Foreign key to `ImportBatch` |
| `libraryType` | `LibraryType` or null | Null only when recognition failed |
| `sourceKind` | `primary \| backupCandidate \| selectedFile` | Backup candidates are never silently applied |
| `sourcePath` | text | Absolute path held in main/history, never used by renderer for direct access |
| `sourceRawHash` | text or null | Preview/apply immutability check |
| `status` | `recognized \| imported \| skipped \| failed \| backupOffered` | Per-source result |
| `countsJson` | JSON text | Preview/final source counts |
| `diagnosticsJson` | JSON text | Sanitized validation/conflict/error details |

Each recognized source applies in one transaction. The source file and its `~` backup are never modified.

### Entity: `ImportChange`

Audit/provenance row for a source's proposed or committed node effect.

| Field | Type | Rules |
|-------|------|-------|
| `id` | integer | Primary key |
| `sourceId` | UUID text | Foreign key |
| `nodeId` | UUID text or null | Existing/created node when applicable |
| `action` | `created \| exactDuplicateSkipped \| aliasedConflictCreated \| replaced \| validationSkipped` | Explicit behavior |
| `recordedRevision` | integer or null | Revision at creation/commit for undo checks |
| `detailJson` | JSON text | Original name, display alias, folder identity, compatibility detail |

Undo is available only when every committed action is additive (`created` or `aliasedConflictCreated`), every created node still exists at `recordedRevision`, and every created folder contains no later content. Undo deletes created items first, then created folders only when empty, in one transaction.

## Suggested SQLite Layout

```text
library_nodes
  id TEXT PRIMARY KEY
  library_type TEXT NOT NULL CHECK (...)
  node_kind TEXT NOT NULL CHECK (...)
  parent_id TEXT REFERENCES library_nodes(id) ON DELETE RESTRICT
  display_name TEXT NOT NULL
  search_name TEXT NOT NULL
  sort_index INTEGER NOT NULL CHECK (sort_index >= 0)
  revision INTEGER NOT NULL CHECK (revision > 0)
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  created_by_import_batch_id TEXT REFERENCES import_batches(id)

library_item_payloads
  node_id TEXT PRIMARY KEY REFERENCES library_nodes(id) ON DELETE CASCADE
  embedded_name TEXT
  object_type TEXT NOT NULL
  support_status TEXT NOT NULL CHECK (...)
  support_reason_code TEXT
  support_message TEXT
  payload_xml TEXT NOT NULL
  raw_hash TEXT NOT NULL
  canonical_content_hash TEXT NOT NULL
  serializer_revision TEXT
  preview_json TEXT NOT NULL
  dependency_json TEXT NOT NULL
  metadata_revision INTEGER NOT NULL

library_store_state
import_batches
import_sources
import_changes
```

Required indexes:

- parent/type/kind/order for lazy tree expansion;
- type/search-name/id for bounded name search;
- payload type/folder/canonical hash for exact duplicate resolution;
- batch/source/change foreign keys and history chronology;
- one partial unique root index per library type (`node_kind = 'root'`).

Repository code additionally checks parent kind/type, root restrictions, and cycles because SQLite `CHECK` constraints cannot safely express the complete recursive invariant.

## Outside-Database Entities

### Entity: `LibraryMigrationStateDocument`

Atomically stored in `blue-libraries-state.json`.

| Field | Type | Meaning |
|-------|------|---------|
| `version` | positive integer | State-file schema version |
| `legacyMigrationState` | `LegacyMigrationState` | Durable automatic-import guard |
| `lastAttemptAt` | ISO-8601 text or null | Most recent automatic/manual retry transition |
| `lastImportBatchId` | UUID text or null | History link if the database is usable |
| `lastResultKind` | `none \| complete \| partial \| noSources \| pipelineFailure` | Summary independent of DB health |
| `lastError` | sanitized diagnostic or null | Safe failure summary |
| `knownBackups` | `LibraryBackupDescriptor[]` | Verified application backup metadata |

Writes use a sibling temporary file, flush/close, and rename. A malformed file never authorizes automatic import over a non-empty database.

### Entity: `LibraryBackupDescriptor`

| Field | Type | Meaning |
|-------|------|---------|
| `id` | UUID text | Stable recovery choice identity |
| `fileName` | text | Main-resolved basename only |
| `createdAt` | ISO-8601 text | Backup time |
| `reason` | `schemaUpgrade` | Initial feature reason |
| `sourceUserVersion` | integer | Original database schema |
| `integrityVerified` | boolean | True only after read-only `integrity_check` succeeds |

Backups are produced with SQLite's online backup API while the repository queue is paused. The service verifies the resulting file before recording it. Recovery never overwrites the failed original without preserving it.

## Transient Project Composition Entities

### Entity: `ProjectLibraryEntry`

A browse/editor summary generated from the current canonical `BlueData`; never persisted in SQLite. Project Instruments and UDOs remain in their dedicated editors. The separate Project SoundObject Library consumes the `soundObject`/`projectShared` projection; other project projections remain service/editor compatibility values rather than Libraries-panel scopes.

| Field | Type | Rules |
|-------|------|-------|
| `scope` | `projectOwned \| projectShared` | Effect is never represented here |
| `libraryType` | `instrument \| udo \| soundObject` | Matches Required Scope Model |
| `projectSessionId` | integer | Reject request after project close/switch |
| `locator` | `ProjectItemLocator` | Type-specific identity described below |
| `displayName` | text | Current project name |
| `revisionToken` | text | Optimistic editor/target check |
| `preview` | structured preview | Safely derived from current model |
| `usage` | structured usage | Current-project discoverable usage only |

### Value: `ProjectItemLocator`

```text
InstrumentLocator
  kind = instrument
  assignmentId

ProjectUdoLocator
  kind = udo
  instrumentAssignmentId?     # absent for the top-level list; present for an Instrument-local list
  sessionObjectId             # stable while project is loaded
  persistedFingerprint        # canonical content hash + name/type hints

SharedSoundObjectLocator
  kind = soundObject
  libraryId                   # stable existing Java objRef identity
  persistedFingerprint        # canonical hash + name/type hints
```

Project UDO restore never resolves by index alone. The main adapter first resolves the owning list from `instrumentAssignmentId`, when present, and then uses the live session object ID. Embedded UDO session IDs include their owning Instrument assignment identity so equal definitions in different lists cannot alias. After restart it binds only when the fingerprint resolver yields exactly one candidate inside the addressed list; zero or multiple candidates produce a safe missing/ambiguous editor state.

Project Shared SoundObject identity requires a tested `@blue/data` change: retain a loaded `objRefId`, allocate one stable Java-compatible ID for a new shared definition, and seed that ID into `ObjRefSaveMap` so save/reorder does not renumber it. Restore verifies both ID and fingerprint. If an older project lacks/presents a changed ID, exactly one fingerprint match may recover it; zero or multiple matches produce missing/ambiguous. An array index is never a restore identity.

### Entity: `InsertionTarget`

A transient main-validated destination resolved from current drop geometry or destination Paste context. It is not a persistent Libraries-panel mode or banner. Every target includes `projectSessionId`, target revision, display description, accepted type, and validity/invalid reason.

```text
InstrumentTarget
  destination = projectOrchestra

UdoTarget
  destination = projectUdoList
  instrumentAssignmentId?     # absent for top-level; present for the exact Instrument-local list

EffectTarget
  channelId
  chain = pre | post
  insertIndex

SoundObjectTarget
  rootGroupId
  containerPath[]
  layerId or stable layer locator
  startTime
  destinationTimeContext revision
```

The service never infers a stale table position, Effect chain, or Score layer/time. No project means no compatible drop or destination Paste target.

### Entity: `LibraryInteractionClipboard`

Transient renderer/main interaction state; it is not persisted and does not place library XML on the operating-system clipboard.

| Field | Type | Meaning |
|-------|------|---------|
| `operation` | `copy` \| `cut` | Command that populated the clipboard |
| `source` | revision-bound typed reference \| opaque buffer identity | Copy resolves a live source; Cut resolves detached main-owned content |
| `libraryType` | `LibraryType` | Capability matching, carried by either source form |
| `capturedAt` | timestamp | Session diagnostics and cancellation |
| `detachedSubtree` | main-owned folder/item snapshot, Cut only | Complete ordered descendants and payload metadata; never sent to the renderer |
| `expiresAt` | main-owned timestamp, Cut only | Bounds detached in-memory buffer lifetime |

Copy Paste deep-copies the resolved revision-bound source and allocates a destination-appropriate identity. Cut first materializes a complete detached typed subtree/item snapshot in main-owned memory, then removes the source immediately after dirty-editor, revision, and shared-project consequence checks. The renderer receives only an opaque typed buffer identity. Paste deep-copies that buffer into any compatible destination, never deletes a source, and leaves the buffer reusable. Failed capture, declined confirmation, or failed removal does not replace the previous clipboard and leaves the source intact.

### Entity: `LibraryDragSession`

An opaque transient token used instead of serializing an item payload into `DataTransfer`.

| Field | Type | Meaning |
|-------|------|---------|
| `dragSessionId` | random opaque text | Renderer-visible token |
| `sourceKey` | stable scope/type/node key | Main-owned source lookup |
| `sourceRevision` | integer/text | Revalidated at drop |
| `libraryType` | `LibraryType` | Fast target compatibility check |
| `sourceScope` | `LibraryScopeKind` | Selects copy/shared rules |
| `supportStatus` | supported/unsupported | Unsupported content cannot enter project drops |
| `expiresAt` | timestamp | Prevents replay after the gesture |

The browser transfer payload contains only the opaque token plus non-authoritative type information for hover feedback. Main resolves and consumes the session at drop, then validates the current item revision, project session, exact target revision, dependencies, and requested shared-copy mode.

### Entity: `LibraryDropTargetView`

Renderer-only hover state derived from destination geometry.

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | orchestra/udo/effect/score | Destination resolver |
| `acceptedType` | `LibraryType` | Compatibility feedback |
| `locator` | target-specific stable locator | Exact row/gap/layer/time proposal |
| `validity` | valid/invalid/stale | Marker/cursor state |
| `reason` | text or null | Accessible invalid explanation |
| `markerGeometry` | renderer geometry | Visual insertion marker only |

`markerGeometry` is never trusted by main. It is converted to a stable locator by the destination surface, then re-resolved against current canonical project state before mutation.

## Transient Editor Entities

### Entity: `LibraryItemEditorSession`

Main-owned state for one logical open definition.

| Field | Type | Meaning |
|-------|------|---------|
| `sessionId` | UUID text | Dockview/main communication identity; the panel title is `Library Item` |
| `itemKey` | scope + stable locator | Deduplicates entry points |
| `libraryType` | `LibraryType` | Selects controlled editor body |
| `scope` | `LibraryScopeKind` | Determines Save consequence |
| `projectSessionId` | integer or null | Required for project scopes |
| `baseRevision` | integer/text | Revision loaded into the draft |
| `basePayloadHash` | text | Conflict comparison |
| `draft` | validated type-specific snapshot/XML | Main's unsaved working copy |
| `dirty` | boolean | First false→true edit auto-pins presentation |
| `explicitlyPinned` | boolean | Set by user; clean pinned tab is not reused |
| `validation` | valid/errors | Whole-object status |
| `conflict` | none/latest revision summary | Set when source changes externally |
| `availability` | present/missing/ambiguous | Missing/ambiguous is read-only |
| `consequence` | structured text data | Future copies, project dirty, shared instance count |
| `dependencies` | structured report | Item-owned/external/unresolved details |
| `usage` | current-project summary | Independent historical copies are untracked |

#### State transitions

```text
clean native editor preview ──edit──▶ dirty pinned ──valid save──▶ clean pinned
      │                     │                            │
      │                     ├──revert confirm───────────┘
      │                     ├──external change──▶ conflict
      │                     └──external delete──▶ missing + draft retained
      └──new clean preview selection──▶ reusable replacement
```

Save behavior:

1. Verify item/project session still exists.
2. Compare current source revision/hash with the session base.
3. If changed, require Reload Latest, Cancel, or reviewed overwrite.
4. Validate the complete draft and dependencies.
5. Commit user payload/metadata or canonical project mutation atomically.
6. Update base revision/hash and clear dirty only after success.

Revert on a dirty session requires explicit confirmation. Close, quit, or project close/switch requires Save/Discard/Cancel whenever the draft cannot safely remain open.

## Interchange Planning Values

### Entity: `LegacyLibraryDocumentPlan`

Pure output of an envelope codec before any repository mutation.

| Field | Type | Meaning |
|-------|------|---------|
| `libraryType` | `LibraryType` | Recognized root type |
| `root` | folder plan | Exact hierarchy and ordering policy |
| `folderCount` | integer | Preview/report count |
| `itemCount` | integer | Preview/report count |
| `unsupportedCount` | integer | Whole-payload classification count |
| `diagnostics` | array | Malformed/unsupported/compatibility details |
| `sourceRawHash` | text | Preview/apply immutability token |

Every leaf plan includes exact raw XML, raw/canonical hashes, embedded/display names, outer type, support status/reason, and safe preview/dependency metadata.

### Entity: `CompatibilityReport`

Used for preview, import result, export preflight/result, and recovery summaries.

| Field | Type | Meaning |
|-------|------|---------|
| `operationKind` | migration/import/export/recovery | Context |
| `status` | ready/complete/partial/blocked/failed/cancelled | Outcome |
| `byType` | counts/details | Four-type breakdown |
| `duplicates` | details | Existing stable identities retained |
| `conflicts` | details | Aliases, ambiguity, explicit replacements |
| `unsupported` | details | Preserved but not insertable/editable |
| `unrepresentable` | details | Export subset decision required |
| `errors` | diagnostics | Sanitized and source-specific |
| `sourceChanges` | details | Created/replaced/skipped identities |

Reports do not include executable interpretation of code and do not expose raw database handles or unrestricted filesystem capabilities to the renderer.

### Entity: `ExportTransaction`

Main-only state for all-or-old destination replacement.

| Field | Type | Meaning |
|-------|------|---------|
| `id` | UUID text | Journal identity |
| `requestedTypes` | one type or all four | Export scope |
| `destinationDirectory` | text | Main-only chosen directory |
| `preflight` | compatibility/overwrite decisions | Must be accepted before writes |
| `stagedFiles` | paths + hashes | Written/parsed/verified before promotion |
| `priorTargets` | absent or rollback backup paths | Restore source |
| `phase` | staged/promoting/committed/rollingBack/failed | Recovery state |

On any promotion failure, already promoted files are removed/replaced and all prior targets restored before failure is returned. Temporary/journal files are cleaned only after commit or verified rollback.

## Transaction Boundaries

The repository guarantees one `BEGIN IMMEDIATE` transaction for:

- create/rename/move/reorder/delete/duplicate node commands;
- one supported user-item Save including all metadata;
- one project-to-user transfer destination commit;
- one recognized source-file import;
- one eligible import-batch undo;
- schema upgrade after a verified backup.

Multi-source import deliberately spans multiple source transactions but one history batch. Export filesystem atomicity is handled by destination-local staging/rollback rather than SQLite.

## Snapshot And Revision Rules

- `contentRevision` orders repository change events; renderer discards older events.
- Node revisions detect stale editor/hierarchy commands.
- Project requests include `projectSessionId` and project revision/target token.
- Search/list cursors include the query/filter and observed content revision. A changed revision invalidates the cursor and asks the renderer to restart the query.
- Mutation success returns the new content revision and affected node summaries; broad refresh is reserved for import/undo/recovery.
- No renderer caches `payloadXml` as repository truth.

## Data Lifetime Summary

| Data | Owner | Persistence |
|------|-------|-------------|
| User folder/item tree and import history | SQLite worker/repository | `blue_libraries.sqlite` |
| Legacy migration and verified backup metadata | main state store | `blue-libraries-state.json` |
| Project sources and inserted copies | canonical `BlueData` | `.blue` save lifecycle |
| Editor draft/session | main editor service | transient app session |
| Browse/search/filter/selection/pin view | renderer stores/Dockview | layout where applicable; no payload truth |
| Java import sources and backups | user files | read-only unless user separately changes them |
| Java export destinations | user-selected filesystem | explicit staged export only |
