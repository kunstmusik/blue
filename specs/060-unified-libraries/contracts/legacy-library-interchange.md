# Contract: Java Blue Library Interchange

## Purpose

Define pure parsing, preservation, support classification, import conflict, migration, and export rules for the four Java Blue user-library XML formats. The codec consumes/produces strings and serializable plans in `@blue/data`; Electron main alone reads/writes paths.

## Format Descriptors

| Library type | Traditional filename | Root | Category | Leaf | Sibling order |
|--------------|----------------------|------|----------|------|---------------|
| Instrument | `userInstrumentLibrary.xml` | `instrumentLibrary` | `instrumentCategory` | `instrument` | all subcategories, then instruments |
| UDO | `udoLibrary.xml` | `udoLibrary` | `udoCategory` | `udo` | all subcategories, then UDOs |
| Effect | `effectsLibrary.xml` | `effectsLibrary` | `effectCategory` | `effect` | all subcategories, then effects |
| SoundObject | `soundObjectLibrary.xml` | `soundObjectLibrary` | `category` | polymorphic `soundObject` | one exact mixed child sequence |

Every document contains one root category. Category names use `categoryName`; the first three legacy category types also carry Java's `isRoot` where applicable. Export emits one valid empty root even when a user-library type has no child nodes.

## Pure Codec Interface

```ts
interface LegacyLibraryCodec {
  readonly descriptor: LegacyLibraryFormatDescriptor;

  parseDocument(xml: string): LegacyLibraryDocumentPlan;

  classifyPayload(rawXml: string): ClassifiedLibraryPayload;

  serializeSupportedPayload(
    type: LibraryType,
    draft: SupportedLibraryDraft,
  ): ValidatedPayloadResult;

  exportDocument(tree: ExportLibraryTree): LegacyLibraryExportResult;
}
```

No codec method accepts a path, Node buffer, Electron object, SQL handle, runtime evaluator, or plugin loader.

## Raw-First Parse Algorithm

1. Parse the complete string with `@rgrove/parse-xml`, requesting node offsets and preservation of CDATA/comments where needed for inspection.
2. Reject malformed XML and unexpected roots with source diagnostics.
3. Do not resolve an external entity, access a URL/path, or execute embedded code. Disallowed/unsafe document types are reported as validation errors.
4. Walk only the recognized category envelope for the chosen format.
5. For each leaf, pass its source offsets through one version-pinned offset adapter that produces verified JavaScript UTF-16 code-unit boundaries, then slice exact XML from the original input. Do not pass documented byte offsets directly to `String.slice()` and do not obtain preservation payload from `Element.toXml()`.
6. Record category path/order, embedded name if safely extractable, outer type, exact raw hash, deterministic canonical-content hash, and recursive support classification.
7. Preserve every leaf plan even when its outer type, nested content, or metadata is unsupported. A malformed individual leaf that can still be bounded remains a raw unsupported leaf; a malformed document that cannot be safely segmented fails that source as a whole.

The input string remains in memory only as long as required to build the plan. The plan carries exact leaf slices, not an executable object graph.

The offset adapter is a compatibility boundary around the pinned parser version. Tests place BMP and non-BMP Unicode before a leaf, in attributes, and in nested text; assert exact start/end tags and raw hashes; and fail if a parser upgrade changes offset semantics. Electron main compares the UTF-8 bytes of the returned raw slice with the corresponding source span before persistence/export.

## Support Classification

### Supported requirements

An item is `supported` only when all conditions hold:

- its outer type is registered for that library type;
- legacy aliases resolve to a tested current type without losing content;
- every recursively polymorphic child is recognized;
- every nested BSB widget, SoundObject, processor, plugin field, and type-specific child is understood by the serializer;
- the loader reports a valid complete object;
- serializer output passes type validation;
- canonical comparison against the source, accounting only for explicit tested Java-compatible normalization, proves that the load/save path did not silently omit content.

### Unsupported requirements

Mark the whole item `unsupported` when any outer or nested condition is unknown or lossy. Examples include:

- unknown Instrument/SoundObject Java class;
- known BlueSynthBuilder, Effect, Sound, or ObjectBuilder containing an unknown BSB widget;
- PolyObject/FrozenSoundObject/other container with an unknown nested SoundObject;
- future fields dropped by the current serializer;
- a recognized loader that returns `null`, throws, or produces a round-trip mismatch.

Unsupported items:

- retain exact `payloadXml`, embedded name/type when safe, folder position, and stable repository identity;
- remain browsable/searchable by safe display name with a warning;
- are read-only and cannot be inserted;
- remain movable, duplicable, deletable, and exportable without payload mutation;
- may be reclassified in a later adapter revision directly from stored raw XML.

## Name And Hash Rules

### Embedded name

Extract only through known safe fields:

- Instrument/SoundObject/Effect: their documented name field/attribute for the outer type;
- UDO: `opcodeName`;
- unknown type: known generic name location only when it can be read without interpreting the object.

If extraction is unsafe or absent, use a stable generic display label and show the value as unavailable. Do not invent an embedded name.

### Display alias

The repository display name is separate from the embedded payload name. Manual import may suffix a same-name/different-content display alias deterministically. That alias does not rewrite the preserved payload. Export reports an alias/original-name difference. A later supported explicit rename and Save may update both atomically.

### Duplicate hashes

- `rawHash` hashes the exact payload slice and detects source/editor changes.
- `canonicalContentHash` hashes a deterministic XML representation for exact object-content duplicate policy.
- Duplicate skipping applies only when library type, explicitly resolved destination folder identity, and canonical content hash all match.
- Same content in another folder/type is not an automatic duplicate.
- A hash match is verified against canonical content before declaring an exact duplicate.

## Import Plan And Conflict Contract

### Preview contents

Every manual import preview reports:

- recognized library types and source labels;
- folder/item/unsupported counts;
- validation errors;
- exact duplicates and existing retained identities;
- same-name/different-content conflicts and deterministic proposed aliases;
- duplicate-name folder ambiguities with candidate stable folder IDs;
- explicit replacements, if the user chooses any;
- proposed created folders/items and per-source transaction boundaries.

### Default conflict behavior

1. Resolve destination by stable folder ID, never by name alone when a path is ambiguous.
2. Reuse existing folder identity only when the preview has an explicit unambiguous resolution.
3. Skip exact content only in that resolved destination/type; retain the existing node identity.
4. Keep same-name/different-content as a new node with a deterministic display suffix.
5. Create missing folders while preserving duplicate source folder names and ordering.
6. Never replace by default. Replacement requires an explicit item-level choice.
7. Never replace a whole library by default.

Automatic first-run migration uses the same recognition, preservation, support, and per-source transaction behavior but no preview and no name merging. It runs only for `never` plus a missing/empty usable database, preserves source hierarchy/order exactly according to the format, and adds no artificial Imported folder.

### Apply preconditions

- The import operation lease is held.
- Preview token has not expired.
- Every selected source's exact hash still matches preview.
- Destination nodes/revisions referenced by conflict resolutions still match.
- The database is writable and has not changed in a way that invalidates the plan.

Failure of one recognized source rolls back that source completely. A later source can still run, and the batch records `partial`. A repository/pipeline failure before any source commits records migration `failed`; partial source success is a completed migration with a partial result.

## Automatic Java Blue Discovery

Default folder: `~/.blue`, resolved only by Electron main during the explicit one-time discovery path.

For each traditional filename:

- primary present: validate/attempt primary;
- primary absent/corrupt and `filename~` present: report/offer backup candidate but do not silently substitute it;
- neither present: record absent;
- never write, rename, delete, or touch timestamps on primary or backup.

If no recognized primary files exist, initialize an empty usable store, record `skipped`, and retain manual import. `skipped` or `failed` never silently retries at later startup.

## Internal Import Audit

Every automatic/manual apply has one stable batch identity and one source record per file. Internal audit data records counts, diagnostics, aliases, duplicate skips, unsupported preservation, replacements, created node IDs, timestamps, source hashes, and final status. These records are repository/recovery data and are not exposed as Import History or Migration Report commands in the healthy Libraries panel.

The repository may retain conditional-undo validation data only while:

- no source made a replacement;
- every committed change was additive;
- every batch-created node still exists at its recorded revision;
- no batch-created folder contains later content;
- no later move has made deletion ambiguous or unsafe.

No renderer/preload IPC or normal Libraries action exposes batch undo. Existing exact-duplicate nodes are never treated as batch-created content, and retained audit data must not alter browsing or startup presentation.

## Export Contract

### Scope

- Export Current accepts exactly one selected user-library type and proposes its traditional filename.
- Export Current is unavailable for `All` and project scopes.
- Export All writes all four traditional filenames, including empty roots, to one selected directory.
- Export is a snapshot operation; no continuous synchronization or source linkage remains afterward.

### Payload output

- An unchanged imported payload uses the authoritative stored XML.
- An unsupported payload is injected byte-for-byte without decoding/reserializing.
- A safely edited supported item uses the validated serializer output saved in the repository.
- Category wrappers are regenerated with XML-escaped names and the format-specific ordering rule.
- Database UUIDs and import provenance never enter output.
- SoundObject `objRefId` values required by the object format remain object-format data and are handled by the adapter's Java compatibility rules.

### Compatibility preflight

Before any destination write, report:

- preserved supported and unsupported objects;
- display alias versus embedded-name differences;
- content the chosen Java format cannot represent;
- items blocked from the compatible subset;
- all destination files that already exist;
- final requested filenames and hashes.

If any content is unrepresentable, the only choices are Cancel or explicitly export the reported compatible subset. Nothing is silently omitted.

### All-new-or-all-prior filesystem protocol

1. Acquire the operation lease and capture repository revision.
2. Complete compatibility and overwrite confirmation for every output.
3. Generate every requested document in memory.
4. Write staged sibling files in the destination filesystem.
5. Parse/validate each staged file and verify its expected hash.
6. Create a destination-local journal; move any existing targets to rollback names.
7. Promote staged files one by one.
8. On success, fsync/close as supported, mark committed, then remove rollback/journal files.
9. On any failure, remove promoted new files, restore every prior target, verify restoration, and only then return failure.

An interrupted journal is detected and repaired before another export to that destination. The renderer receives a result only after commit or verified rollback.

## Type-Specific Copy/Portability Rules

These rules are shared with project transfer code and tested against Java behavior.

### Instrument

- Parse through the instrument registry, not the current aggregate Generic-only path.
- Independent project insertion uses `deepCopy()`.
- Generate a non-colliding project assignment identity.
- Clear/reset project automation bindings owned by a copied BlueSynthBuilder as required by the native rule.
- Include item-owned interface and local UDO data; unresolved external project dependencies block insertion.

### UDO

- Preserve classic/modern style, field ordering, signature, input representation, code, and comments.
- Independent project insertion creates a new `OpcodeDefinition` and never replaces/reuses a same-name project UDO implicitly.

### Effect

- Preserve legacy missing-style behavior and supported parameter-list aliases.
- Independent chain insertion deep-copies the Effect, clears library/automation binding, enables the inserted copy, and inserts at the validated chain position.
- Existing Effect test support may be reused; this feature adds no new test engine.

### SoundObject

- Preserve the mixed hierarchy and polymorphic outer type.
- A user-library insertion deep-copies and converts beat-based duration/time behavior into the destination project's explicit time context.
- Saving a project object into the user library normalizes BBT/BBST/BBF values to portable beats where the native rule requires it.
- A project-shared `Copy Instance` creates an `Instance` linked to the same project definition; `Copy Independent` deep-copies.
- A general `Instance` is not accepted as portable user-library content when it depends on a project reference map.
- External assets follow existing project portability rules and are disclosed before insertion.

## Compatibility Test Oracle

- Supported fixtures: TypeScript output must load in Java and match Java's load→save canonical structure/semantics, including type-specific order and allowed legacy normalization.
- Unsupported fixtures: leaf `payloadXml` must match the imported byte slice exactly after browse, move, duplicate, restart, and export.
- Export/reimport: representable hierarchy, ordering, supported content, and original unsupported payloads must survive.
- Source immutability: every automatic/manual source and `~` backup hash must be unchanged after preview/apply/failure.
- No-execution: code/script/plugin fields and external entity declarations must never trigger evaluation, subprocess creation, path reads, or network requests during parse/preview/export.
