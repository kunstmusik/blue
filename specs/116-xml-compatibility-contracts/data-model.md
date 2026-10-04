# Data model

**Date**: 2026-10-02

## Serialization contract

Owned by the interpreting class/root: exact root/discriminant; allowed attributes and children;
scalar/container/repeated cardinality; delegated nested owner; value domains/defaults; significant
text/map rules; historical conversion/version/conflicts; canonical output; safe warning outcomes;
independent retained-payload ownership. Local rules and evidence records do not create a persistent
entity or generic schema DSL. Shared base/primitive rules contribute to each concrete owner.

## Historical compatibility record

Documented fixture-manifest fields: stable case ID, original form/root, source URL/full revision,
release/development/source-only provenance, explicit support decision, migration owner/context,
preconditions/order/conflicts, expected canonical state/output, warning/error cases, fixture
author/origin, and standalone/embedded applicability. Records connect family evidence to cases;
they are not loaded from user XML or discovered at runtime.

## Source context and load context

Ephemeral source context: `kind` (project, instrument, effect, soundObject, udo, preset, library,
or existing independent primitive), display label, optional native path/library item ID. Host
supplied and serializable; data treats paths as labels and performs no I/O.

One operation context owns diagnostics and input-node source anchors. Child contexts derive
unambiguous indexed paths. Generated migration nodes point to legacy origins. Context never lives
in canonical XML/history. Existing reference maps remain explicit loader arguments; context is
not a service locator or global loading flag.

## Load diagnostic

Readonly serializable fields:

| Field | Meaning |
| --- | --- |
| `code` | Stable syntax/root/member/type/value/cardinality/conflict/reference category or named normalization/archive warning |
| `severity` | warning or error; errors reject |
| `source` | Host context or explicit in-memory fallback |
| `path` | Indexed owning path, including offending child/attribute |
| `member` | Offending element/attribute/discriminant when available |
| `value` | Offending value or concise contextual representation; no required full code dump |
| `message` | User-facing explanation |
| `recovery` | Action/consequence; warnings explain safe canonical save behavior |

Optional offsets/line/column enrich diagnostics. Source/path remain required for in-memory Elements.
Traversal orders reports deterministically. Known lossless migration is ordinary acceptance;
it does not require a warning for every historical field.

## Accepted candidate / rejected result

`XmlLoadResult<T>` is a discriminated result:

- Accepted: `ok=true`, `value=T`, readonly diagnostics containing warnings only.
- Rejected: `ok=false`, readonly diagnostics including an error; no partial model/value.

Candidates are independently owned, complete, inert models without runtime sessions. Destination
reference/revision/history preparation still applies at insertion. XmlLoadError carries reports
for strict throwing APIs; host adapters send plain diagnostic data across IPC, never Error/Element.

## Retained contract payload

Existing known deferred/extension data has a named root/type, recursively accepted members,
canonical owner, clone/immutable boundary, save/copy/history behavior, and execution/editor limits.
Examples are known Clojure dependencies and host-backed object/processor state. Runtime absence
does not widen accepted names. Arbitrary unknown bags are not candidates. A validated source cache
may optimize output only with authoritative typed state and correct invalidation after edits.

## Archived unsupported resource

Uses existing library kind/type, raw XML/hash, support status/reason, source/breadcrumb and item
identity fields. Existing reports gain serializable diagnostics as needed. Original raw source,
not a canonical hash or model reserialization, determines exact payload export.

```text
source -> envelope validation -> resource acceptance -> supported record -> editor/insertion
                                                    -> unsupported archive -> exact export
invalid envelope -> rejected source, no publication
archive raw edit -> revalidate -> supported only after complete acceptance
stored supported row -> revalidate at use -> accepted or diagnosed unsupported
```

Existing revisions/hashes fence promotion; no database-wide payload rewrite. Raw editing cannot
publish an unsupported typed project resource. Library rejection/transaction scope follows the
contract, not a guessed outer type.

## Canonical ownership and restoration

### Exact seed and legacy/dependency fields

JMask/random processor seed is a canonical signed64 decimal string in model/snapshots/patches,
validated through BigInt and passed exactly to the existing random generator. One authoritative
value, no numeric/raw shadows. Existing safe numeric setter inputs normalize to that value.

PianoRoll's optional typed legacy ruler interval retains historical timeUnit. Its named editor
contract diagnoses unsupported current display semantics and emits timeUnit as an explicit output
exception, preserving it through unrelated edits/copies/history rather than tying it to snap.

Tuning scale is either complete shared Scale data or a typed external path dependency with
unresolved/resolved host capability state. The persisted path and embedded scale are independent
of transient resolver state. No data-layer filesystem access, silent default substitution, or
execution/insertion requiring an unresolved dependency. Host resolution does not rewrite native
path text; snapshots remain serializable and code-generated artifacts stay separate.

### Existing project owner

BlueData/class fields remain the domain model. Main owns lifecycle/ProjectHistory; libraries own
stored records/drafts. Load migration changes an independent candidate and establishes baseline.
Durable insertion/editing validates a prepared candidate and commits through existing labeled
history/runtime adapters. Input/output/copy/history trees never share mutable ownership.

Concrete fields/defaults reside in family evidence; this document does not duplicate the catalog.
Typed markers, shared Line/time primitives, declared maps and known metadata replace raw stores
only after coverage establishes their contracts.
