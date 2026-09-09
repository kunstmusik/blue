# Research: Global Project Undo and Redo

All planning unknowns are resolved below. Findings are from the current repository and Java reference source; implementation tests and benchmarks have not yet been run.

## 1. Ownership and mutation coverage

**Decision**: Main owns history, with `ProjectSession` retaining graph ownership. Introduce a document-lifetime ID independent of the numeric session fence and a publication transition preserving path and incrementing revision. Serialize edit/undo/redo/save-boundary publication through one coordinator.

**Rationale**: `main/main.ts` directly records mutations for track instrument edits, freeze, missing-audio relink, legacy document update, and the unified-library adapter, in addition to `commitProjectDocumentPatchBatch`. `project-session.ts` changes `sessionId` on runtime dependency invalidation; its `replace` resets revision. Neither current renderer history nor `replace` is suitable for ordinary undo.

**Alternatives considered**: Renderer history with revision-conflict warnings misses existing writers; recording only the batch misses canonical changes; wrapping `recordMutation` records too late to capture preimages. Move all writers to preparation before mutation. Async freeze/render/library preparation may happen outside the coordinator, but publication must validate the captured document/revision and reject stale results. Generated files may remain on disk after rejection, as specified.

## 2. Exact restoration and atomicity

**Decision**: Two explicit record kinds. Frequent value edits use typed before/after assignments against stable targets. Structural operations use `cloneForHistory` with an original→copy context preserving graph references and IDs. Retain isolated before/after model mementos and transfer app-owned WeakMap IDs through the mapping. XML serves as compatibility evidence, not a restoration fallback.

**Rationale**: `blue-data.ts:345` already traverses the project and remaps library Instances, but `Parameter.deepCopy()` generates a new ID, `BSBWidget` clone regenerates widget/dropdown IDs, and `BlueSynthBuilder` copy rewrites presets for duplication. `shared/project-editor/identity.ts` holds additional non-XML identities in WeakMaps. XML load can normalize/migrate; neither default deepCopy nor XML reload proves exact in-session state restoration.

**Implementation decision**: Add explicit history-copy context support through the existing model copy traversal, preserving duplication defaults. It must preserve retained XML, nested/shared Instance targets, live objects, parameter IDs, BSB presets/dropdown links, freeze state and all model fields. Main captures/transfers snapshot IDs after copying. Compiled variable names and runtime associations are derived and must be resolved from per-performance registries after publication. Copy aliases may exist within the candidate where the original aliases existed, never between mutable candidate and canonical/history states.

A scalar batch is fully resolved and validated before a synchronous apply block; restoration of captured fields is non-throwing and used on unexpected failure. Only explicitly proven scalar operations qualify; any operation with allocation, references, implicit secondary writes, or uncertain setter behavior takes the detached structural path. Compound mixed batches use the structural path. Candidate publication cannot invoke external work. Successful commit then releases editor invalidations, snapshot updates and runtime work. Cancellation of a multi-update gesture is a compensating restoration with no retained history entry, followed by runtime reconciliation; previous live previews cannot be made physically unplayed.

**Alternatives considered**: Generic renderer diff loses hidden state; hand-authored inverse UI commands spread correctness across callers; raw JSON cloning loses prototypes; full project copies for every value change waste work; generic reflective graph cloning is an unaudited serialization system. No Immer/CRDT/event-sourcing dependency is introduced.

## 3. History retention and saved state

**Decision**: Retain typed values and immutable model mementos, 200 entries and a 64 MiB conservative retained-size budget. Count unique retained graph nodes once, strings at two bytes per UTF-16 code unit, buffers at byte length, plus fixed per-node/collection overhead documented by the estimator. Include before/after values, identity maps and view metadata. This bounds accounted payload, not total process RSS; measure actual heap alongside it. Adjacent references may share immutable mementos, but never mutable canonical state.

**Rationale**: XML byte length alone undercounts graph memory. A history state token, independent of revision, identifies the saved checkpoint and undo cursor. Save closes grouping and captures serialized bytes plus that exact token; successful writing marks that token saved even if newer edits arrived meanwhile. Save failure does not move the checkpoint.

**Alternatives considered**: Revision equality cannot identify undo back to saved state; clearing dirty on every broadcast loses changes; per-entry count alone permits giant retained graphs. Over-budget actions are prepared without publication; a fail-closed contextual confirmation authorizes one unchanged prepared action to reset history. Changed document/revision invalidates that approval. No global skip-history flag.

## 4. Pending work and multi-window ordering

**Decision**: A main-owned pause/drain/release barrier across independent renderer contexts precedes undo/redo, save and project replacement. Dockview popouts share one JS context and are not separate queue participants. Dedicated editor windows are participants. Each queue drains its captured prefix sequentially; new input stays a draft until release. A 5-second timeout aborts the history request, releases participants, and reports pending work; it never discards edits.

**Rationale**: `project-patch-queue.ts` flushes in-flight/pending work but cannot prevent enqueue. `TrackInstrumentEditorPage.tsx` retries stale writes automatically; this must not resubmit pre-undo values against a new revision. Explicit expected revision plus exact target preconditions makes conflicts visible. During drainage main orders arrivals; disjoint values may be retried only after verifying unchanged preconditions, while conflicting values preserve drafts and abort settlement.

**Alternatives considered**: Flushing only the initiating window misses other queues; resetting queues loses work; unlimited stale retries undo the undo. A renderer crash is not acknowledgement. A context already clean can be removed; otherwise abort and preserve canonical state. In-progress IME delays settlement until composition completes; timeout leaves the draft intact.

## 5. Engine capability and acknowledgement

**Decision**: Per-performance ordered immutable operation plans with structured acknowledgement and generation fencing. See [runtime contract](contracts/runtime-reconciliation.md) for the capability matrix.

**Rationale**: `main.ts` launches `syncEngineWithProjectPatch` without awaiting it. `EngineBridge.setChannel` logs rejection and resolves; automation synchronization returns before throttled mutable work completes and its helpers swallow failures. Awaiting these helpers does not prove an engine update. `setChannels` already exposes structured acknowledgement. Existing BSB/mixer/effect realtime routes can write after a durable reversal unless previews are fenced. `runtime-parameter-sync.ts` copies compilation names by array index, and BlueX7 active bindings are singleton state shared by performance startup; history needs stable ID bindings scoped to each performance.

**Alternatives considered**: Replaying patch variants misses consequences of subtree restoration; copying compilation fields into history reauthorizes obsolete bindings; engine rollback of the document couples durable correctness to external failure. Keep document commit successful and track each runtime outcome. Direct numeric effect updates join acknowledged reconciliation; topology and code require restart. Unsupported automation create/delete targets require restart, not fake success.

## 6. Editor routing and visual consistency

**Decision**: Project/draft history scope is explicit on shared editors. Project CodeMirror configuration omits its independent history while retaining editing/composition behavior; draft configuration keeps local history. Canonical replay carries non-user/non-history annotation and mapped/clamped selection. Context-menu, keyboard and native-menu commands converge on the same scope router.

**Rationale**: `SelectedCodeEditor.tsx` uses `basicSetup`; its prop update suppresses `onChange` but has no non-history annotation. `use-ipc-listeners.ts` applies same-session updates without checking older revisions and calls the load setter that clears dirty. `EffectEditorPage.tsx` refreshes UDO context only, not the edited effect. New refresh semantics must reconcile actual canonical editor content and explicit dirty state.

**Alternatives considered**: Focus-priority independent histories on committed content violate chronological global undo. Using global `document.activeElement` fails in Dockview popouts. Native Electron undo roles cannot execute document history. Pick native menu accelerators as the physical shortcut owner; remove competing project editor bindings and provide menu-dispatched draft commands. Any platform-specific renderer fallback must be mutually exclusive with the accelerator and validated natively, not enabled in parallel.

## 7. UI conventions and verification

**Decision**: Existing status/toast surfaces expose runtime outcomes; no new history browser. Use approved semantic typography roles, `cn()` composition, `ConfirmationDialog` for history reset/draft conflict, and host-aware portals/realm-safe checks per `docs/typography.md` and `docs/popout-popup-conventions.md`.

**Rationale**: No new typography system is needed. Existing Vitest/browser harnesses cover stores and two-document panels; native Electron keyboard/IME and real engine outcomes still need smoke validation. Java compounding is retained; per-tab history ownership intentionally differs as recorded in the spec.

**Alternatives considered**: Broad UI redesign and standalone undo libraries do not resolve canonical writers, runtime acknowledgements or identity preservation. Use the current adapters and test their real interfaces.

## 8. Java parity, XML, CSD, and data integrity analysis

### 8.1 Java Blue reference comparison
- **Architecture**: Java Blue (`blue-core` and `blue-ui-core`) historically provided per-tab or component-scoped `UndoManager` instances. In Blue Electron, global project history unifies all editors, panels, and dedicated windows into one authoritative timeline per open project (`FR-001`), while preserving local undo strictly for unapplied text drafts and search inputs.
- **Compounding / Grouping**: Rapid typing and slider gestures compound adjacent edits into single logical steps. Blue Electron matches Java's 500 ms typing gap and gesture-end grouping semantics.
- **Transaction Preparation**: Both platforms prepare mutations before committing. In TypeScript, `prepareTransaction` classifies patches into `scalar` or `structural`, preventing unverified writes from polluting document state.

### 8.2 .blue XML serialization
- **XML Equivalence**: Project snapshots and saved checkpoints produce XML compatible with Java Blue. The `toXml()` and `saveToString()` implementations preserve element nesting, attribute naming, and numerical formatting.
- **Test Evidence**: Verified by `packages/blue-data/src/blue-data-history-copy.test.ts` and `packages/blue-data/tests/integration/performance-benchmark.test.ts`, confirming round-trip serialization and deserialization without data drift.

### 8.3 Generated CSD parity
- **Orchestra & Score Generation**: History copy and undo/redo operations preserve instrument numbering, UDO definitions, ftgen allocation, and score event scheduling bit-for-bit.
- **Test Evidence**: `packages/blue-data/src/blue-data-csd-parity.test.ts` proves that `retainedBefore.toCSD()` matches `source.toCSD()` before and after mutations, and matches the canonical Java `Demo2026` fixture instrument ordering and event timing.

### 8.4 Unknown-data preservation
- **Unmodeled Elements**: Third-party or newer Java Blue XML nodes and attributes are captured into unknown-data sidecars during loading.
- **Integrity Guarantee**: `blue-data-history-copy.test.ts` explicitly tests `createRepresentativeUnknownDataProject()` to ensure unknown data is preserved across `historyCopy()`, commits, and undo/redo cycles without loss or corruption.

### 8.5 Identity sidecars
- **WeakMap Isolation**: Non-XML identities (score object selection IDs, mixer snapshot IDs, parameter snapshot IDs) are maintained in WeakMaps in `packages/blue-app/src/shared/project-editor/identity.ts`.
- **Sidecar Transfer**: When structural mementos are restored, `transferIdentitySidecars` maps old object references to new object references, ensuring selection stability and editor target tracking without polluting canonical XML.

### 8.6 Project-authored typography
- **Preservation Policy**: Per `AGENTS.md` and `docs/typography.md`, Blue Synth Builder font definitions and custom project styling are treated as canonical project data and never coerced to Tailwind typography roles.
- **Integrity**: Font names, sizes, and font-style attributes round-trip through history mementos without coercion or alteration.

### 8.7 External path text
- **Csound Path Syntax**: External paths embedded in Csound orchestra/score text use forward slashes (`/`), escaped quotes, and Csound-safe string syntax.
- **Host Native Paths**: Filesystem paths for audio assets, freeze files, and SQLite libraries retain their native OS representations (including Windows drive letters `C:\` and UNC paths `\\server\share`). Undo and redo never alter external files on disk or mutate path separators outside explicit boundary conversions.
