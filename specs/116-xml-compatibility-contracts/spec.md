# Feature Specification: Explicit XML Compatibility and Migration Contracts

**Feature Branch**: `codex/116-xml-compatibility-contracts`

**Created**: 2026-10-01

**Status**: Completed — implementation converged

**Closed**: 2026-10-03

**Verification**: All 54 tasks are complete; final convergence found no remaining work.
See [closure results and validation limits](quickstart.md#feature-closure-2026-10-03).

**Input**: User direction: load known expected elements/attributes; migrate known historical
forms; warn or error on unexpected data. Update the constitution, research Java Blue history,
and distinguish class-local compatibility from project structural migrators because instruments
and effects also serialize independently to disk, libraries, and BlueShare.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and Save Supported Projects Reliably (Priority: P1)

A composer opens a current or supported historical project, sees its intended content, and can
save/reopen it without unintended changes caused by compatibility handling.

**Why this priority**: Loading and saving determine whether users can trust their projects.

**Independent Test**: Open representative current and historical projects, compare supported
content after migrations, save/reopen, and check that source files were untouched during loading.

**Acceptance Scenarios**:

1. **Given** a current supported project, **When** it opens, **Then** every expected field loads
   into its authoritative representation without an unexpected-input diagnostic.
2. **Given** a supported historical project requiring changes across sections, **When** it opens,
   **Then** the required structural migrations run before canonical interpretation and all
   supported content survives save/reopen.
3. **Given** historical aliases, value encodings, and omitted optional fields, **When** they load,
   **Then** documented class compatibility and defaults produce the intended canonical values.
4. **Given** otherwise supported script/runtime metadata and an unavailable runtime, **When** the
   project opens and saves, **Then** supported content survives; attempting unavailable execution
   reports its runtime limitation separately from serialization acceptance.
5. **Given** supported code or text with significant whitespace, **When** loading, copying, and
   saving it, **Then** the accepted content retains that whitespace.

---

### User Story 2 - Reuse Historical Instruments and Effects Independently (Priority: P1)

A composer imports or exports reusable resources without requiring a project load to obtain the
same class compatibility behavior used when those resources are embedded in projects.

**Why this priority**: Instruments and effects from disk, libraries, or BlueShare may lack a
project envelope/version and must remain useful across supported format changes.

**Independent Test**: Load current and historical instrument/effect payloads directly and inside
projects, compare supported resource state, then export/reimport through available resource paths.

**Acceptance Scenarios**:

1. **Given** a historical instrument or effect with a documented older parameter-list tag,
   **When** loaded directly from disk or a library, **Then** its supported values migrate exactly
   as they do inside a project, without requiring a project version.
2. **Given** an instrument/effect payload in the shape used by BlueShare, **When** loaded by the
   shared resource boundary, **Then** current and historical member/value rules apply without
   invoking project structural migrations.
3. **Given** canonical resource data, **When** local normalization is applied again or the
   resource is exported/reimported, **Then** no supported content is duplicated or changed.
4. **Given** a project needing several structural changes and nested class migrations, **When**
   it loads, **Then** all applicable changes compose without one successful migration suppressing
   another.

---

### User Story 3 - Receive Clear Outcomes for Unexpected Data (Priority: P1)

A composer receives an actionable warning or error when a project or resource contains data
outside its supported contract, while existing work and source content remain protected.

**Why this priority**: Neither silent dropping nor implicit acceptance establishes a safe load.

**Independent Test**: Supply unexpected attributes/elements/types at root and nested boundaries,
invalid known values, and conflicting forms; inspect the diagnostics and destination state.

**Acceptance Scenarios**:

1. **Given** an unexpected member with no documented warning rule, **When** a project opens or
   a resource is inserted, **Then** acceptance fails with its source, owning path, member,
   severity, and recovery guidance; the active project and destination content stay unchanged.
2. **Given** a documented harmless warning case, **When** it loads, **Then** the warning is
   surfaced and the stated save behavior is safe; potentially meaningful discarded content
   cannot enter an ordinarily editable/savable document.
3. **Given** a malformed value in an expected field, **When** it loads, **Then** the defined
   recovery or rejection rule applies and any recovery diagnostic identifies the field/value.
4. **Given** unexpected content nested inside a recognized class, **When** it loads, **Then**
   recognizing the outer type does not bypass member validation.
5. **Given** an unsupported library resource eligible for the existing archive contract, **When**
   it is retained, **Then** its unsupported status is diagnosed, its original payload can export
   intact, and project insertion/model editing remain disabled until full validation succeeds.
6. **Given** input that fails acceptance, **When** loading ends, **Then** no on-load script or
   execution side effect has run from that rejected input.

---

### User Story 4 - Preserve Accepted State Through Editing, Copies, and History (Priority: P1)

A composer edits accepted data, duplicates or exports reusable resources, and uses undo/redo
without serialized trees sharing mutable state with the canonical document or history.

**Why this priority**: Acceptance is only useful if later edits and restoration stay faithful.

**Independent Test**: Load accepted current/historical data, mutate loader input or exported
representations, commit a durable edit, undo/redo, and compare canonical state and save/reopen output.

**Acceptance Scenarios**:

1. **Given** an accepted model and its exported representation, **When** a caller mutates the
   export, **Then** the canonical model, retained payloads, and dirty/history state do not change.
2. **Given** a copied model or history memento, **When** its data changes, **Then** the original
   model and other copies retain independent ownership.
3. **Given** a durable project edit or resource insertion, **When** it commits and is undone and
   redone, **Then** supported content, identities/references, ordering, clean/dirty state, and
   required runtime reconciliation match each canonical state.
4. **Given** accepted historical input, **When** it is saved, **Then** output contains the
   specified current forms and preserves supported semantics without recreating obsolete aliases.

### Edge Cases

- Missing optional fields versus missing required fields; old project versions versus independent
  resources with no version; an unfamiliar version alone versus unfamiliar actual members.
- Current and historical aliases present together, duplicate singleton elements, and conflicting
  values; each has a documented precedence or rejection outcome.
- Unknown attributes on recognized scalar children; unknown members at project, container, class,
  and nested widget/parameter boundaries; namespaced names and reserved serialization attributes.
- Declared maps, script/code text, and extension points whose allowed contents differ from ordinary
  child fields; arbitrary XML is not accepted merely because the outer class is recognized.
- Unsupported types versus supported types whose runtime/editor is unavailable; an archived library
  resource versus a resource accepted into a project.
- Significant whitespace, CDATA representing scalar text, mixed text/child content, comments, and
  formatting whitespace. Contract violations must be visible before parsing loses their evidence.
- Several applicable project migrations, class normalization after structural migration, and a
  second application of normalization to canonical input.
- Historical loader typos or permissive branches without evidence that a writer emitted the form.
- Empty or malformed input, root/resource-kind mismatches, failed replacement of a populated
  project, and failure while inserting a resource into an existing project/library.
- Caller mutation of input XML after load, output XML after serialization, or a copied retained
  payload; marker XML and plugin/resource payloads need explicit ownership checks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Inventory every production project/resource XML load and write boundary in scope and
  the model owners reachable from it. Define current expected members, values, cardinality,
  defaults, historical forms, canonical output, and warning/error behavior for each owner.
- **FR-002**: Supported current data MUST use authoritative model representations. Expected
  attributes/elements, polymorphic types, declared maps, and supported extension/deferred payloads
  MUST have explicit acceptance rules; a recognized outer type MUST NOT whitelist its subtree.
- **FR-003**: Known historical aliases, numeric/enum encodings, and defaults MUST have documented
  conversions supported by Java loader/writer history or an explicit TypeScript compatibility
  decision. Distinguish historically emitted data from accidental permissive reader behavior.
- **FR-004**: Cross-section/project-graph structural migrations MUST operate on project XML before
  canonical model interpretation and validation. Every applicable migration MUST run in the
  documented order, including when an earlier migration succeeds.
- **FR-005**: Class-local/resource compatibility MUST be available at every applicable loading
  boundary without requiring a project load or unavailable project version. Give each migration
  one owner, scope, preconditions, conflict rule, and canonical result; composed/repeated
  normalization MUST NOT duplicate or alter supported content.
- **FR-006**: Define malformed-value handling separately from unexpected-member handling. Missing
  historical optional fields MAY use documented defaults; invalid known values MUST either fail
  or recover under a documented rule with a surfaced diagnostic and defined safe save behavior.
- **FR-007**: Unexpected elements, attributes, types, or value forms MUST produce errors by default.
  A warning exception MUST identify its accepted scope, rationale, retained/ignored data, and
  observable recovery/save behavior. Generic unknown-XML bags MUST NOT provide implicit acceptance.
- **FR-008**: Potentially meaningful discarded content MUST NOT enter an ordinarily editable or
  savable document/resource. A rejected project/resource MUST leave active work, destination
  content, source files, and applicable history unchanged.
- **FR-009**: Known supported metadata for unavailable runtimes/editors MUST retain its specified
  content through load/save and copy/history under a named validated contract. Runtime/editor
  availability MUST NOT redefine serialized-data support.
- **FR-010**: Validation MUST examine input before information needed to diagnose violations is
  discarded. Preserve significant accepted text/code content. Ordinary comments, declarations,
  and formatting whitespace may be treated as lexical material according to the root contract;
  accepted scalar text and unexpected mixed content must not be conflated.
- **FR-011**: Diagnostics MUST identify source/resource context, owning element path, offending
  member/value, severity, and recovery behavior. Application boundaries MUST surface them to the
  user; console logging alone MUST NOT be the acceptance outcome.
- **FR-012**: A complete project/resource candidate MUST pass its acceptance rules before active
  publication, insertion, on-load script execution, or other execution side effects. Existing
  multi-source import transaction boundaries MUST remain explicit; a rejected item cannot be
  silently inserted, skipped without a report, or partially published.
- **FR-013**: Apply the same class contracts to embedded projects, standalone disk resources,
  supported library envelopes/payloads, and BlueShare-shaped payloads at existing shared model
  boundaries. This feature does not require a new BlueShare network client.
- **FR-014**: Existing unsupported library archive records MAY remain stored/exportable under an
  explicit warning contract retaining source payload content intact and blocking model editing
  or project insertion. Promotion to supported status MUST validate every applicable member/value;
  a list of specially named unsupported tags or a known type name is insufficient.
- **FR-015**: Writers MUST produce the specified current forms for accepted models and retained
  contract payloads. Historical aliases are read compatibility unless the output contract says
  otherwise. Serialization MUST NOT mutate canonical content or expose model-owned mutable XML.
- **FR-016**: Loader input, serialization output, copies, and history mementos MUST have independent
  ownership of mutable accepted data, including markers and explicitly retained payloads.
- **FR-017**: Durable project edits/imports MUST follow existing canonical history with semantic
  labels and commit→undo→redo coverage for content, ordering, identities/references, dirty state,
  publication, and required runtime reconciliation. Load-time migration belongs to the new
  document baseline and MUST NOT create unrelated edit history entries.
- **FR-018**: Classify every existing generic/raw preservation path as typed supported data,
  documented historical compatibility, a named validated retention/archive contract, or unexpected
  input. Replace implicit acceptance only with the corresponding validated outcome and coverage.
- **FR-019**: Before implementation, complete an evidence matrix covering supported roots/classes,
  historical changes, Java source revisions, release/development provenance, fixture origin,
  migration owner/order, accepted output, and warning/error cases. Record remaining evidence gaps
  and explicit support decisions; do not invent a universal historical version range.
- **FR-020**: Verify current/historical round trips, root and nested unknown-member diagnostics,
  invalid known values, conflicting forms, composed migrations, standalone resource parity,
  independent copy/export ownership, archive non-insertability, and canonical history restoration
  at the lowest practical boundaries. Preserve established exact-output contracts where applicable.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue loader/writer history, project upgraders, TimeState, BSB and
  Effect compatibility, BlueShare resource loading/export, and direct disk/library resource paths.
  Initial verified sources and historical revisions are recorded in [research.md](research.md).
- **Compatibility Requirements**: Preserve supported current/historical project and resource
  semantics, existing TypeScript extension contracts, and known runtime metadata. Preserve the
  existing diagnosed library archive behavior while tightening validation for editable/insertion
  acceptance. Each accepted historical form and output is recorded in the evidence matrix.
- **Migration Boundaries**: Project structural migrators run before deserialization. Class-local
  aliases/value conversions and reusable resource subtree normalization work at independent
  resource loading boundaries. A normalization has one owner; document ordering and conflicts.
- **Intentional Divergences**: Constitution 4.0.0 replaces blanket unknown-project retention with
  explicit supported/historical contracts and warning/error outcomes. Incidental silent dropping
  in Java loaders is not copied. Existing generic TimeState/other unknown stores must be assessed
  under this policy; their current implementation is not removed by this specification alone.
- **State Ownership**: Main remains the owner of active BlueData and lifecycle/history. Each data
  class owns its accepted fields/payloads; library repositories own supported records and diagnosed
  archived source payloads. Load diagnostics are operation results and do not become project XML.
- **Undo/Redo Impact**: Existing project edits and inserted resources use ProjectHistory with
  semantic labels and restoration coverage. Rejected loads/imports create no project history;
  accepted load-time normalization establishes the replacement document's baseline. Library-only
  operations retain their existing transaction/undo scope and do not enter project history.

### Key Entities *(include if feature involves data)*

- **Serialization Contract**: A root/class's expected members/values, historical accepted forms,
  defaults, cardinality, output forms, and diagnostics.
- **Historical Compatibility Record**: Source revision/artifact evidence, original form, supported
  meaning, conversion, owning scope, ordering/conflicts, and canonical output.
- **Load Diagnostic**: Source/resource context, owning path, member/value, severity, and recovery.
- **Accepted Candidate**: Fully validated project/resource content eligible for publication or
  insertion; independent of the active document until acceptance completes.
- **Retained Contract Payload**: Explicitly supported content with declared validation, ownership,
  copy/save behavior, and execution/editor limits.
- **Archived Unsupported Resource**: Diagnosed library source payload retained intact for storage
  and export, blocked from project insertion/model editing until support validation succeeds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every inventoried supported current/historical project and reusable-resource fixture
  loads and survives save/reopen with its expected content and canonical output.
- **SC-002**: Every unexpected-member/invalid-value case in the acceptance matrix produces its
  declared warning/error with source and path context; zero cases silently enter editable models.
- **SC-003**: Every rejection case leaves existing project/library content, source files, and
  applicable history unchanged and produces zero execution side effects from rejected input.
- **SC-004**: Every applicable standalone instrument/effect compatibility fixture yields the same
  supported resource state as its embedded-project equivalent without a project version/load.
- **SC-005**: All migration composition/reapplication cases preserve expected content without
  duplicate transformations; all copy/export/history ownership cases isolate mutable state.
- **SC-006**: All covered durable project edit/import cases restore canonical before/after state,
  identities/references, ordering, and clean/dirty transitions through commit→undo→redo.
- **SC-007**: Every retained unsupported archive fixture exports intact and remains non-insertable
  until full support validation succeeds; unsupported content is visibly diagnosed.
- **SC-008**: Every inventoried serialization owner has an explicit current/historical acceptance
  decision, canonical output, migration scope, and verified source or documented support decision
  before implementation begins.

## Assumptions

- Errors are the default for unexpected semantic XML; warnings require explicit justified rules.
  This follows the accepted direction without choosing a generic permissive loading mode.
- Scope is existing project/model/resource XML and library interchange using those serializers.
  App settings, dock layouts, engine protocols, new BlueShare transport, and a general XML editing
  platform are outside this feature.
- Existing supported script/runtime data and unsupported library archival behavior remain explicit
  compatibility cases; arbitrary project type names do not acquire support by being archived.
- Current source plus verified historical writer/loader changes establish the initial corpus.
  Release versus development evidence and additional legacy artifacts are investigated during
  planning before accepting undocumented old forms or removing existing compatibility behavior.
- Byte spelling and formatting are only contractual where already required or for archived raw
  payloads. Supported scalar text/code meaning, including significant whitespace, is contractual.
- This specification succeeds the deferred audit in Spec 115 under constitution 4.0.0. Existing
  implementation remains in place until this feature's planned changes are completed and verified.
