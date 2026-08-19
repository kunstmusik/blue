# Research: BlueX7 Instrument Editor Parity

## Decision 1: Fully model known values while preserving a loaded XML template

**Decision**: Add complete common, LFO, operator, envelope, PEG, and post-code state to the portable BlueX7 model. Keep a deep-cloned source XML template and update modeled nodes in place when serializing; preserve unknown attributes, root children, nested children, and excess repeated nodes.

**Rationale**: Java Blue defines stable structured values, but the current TypeScript class only retains root children. Reconstructing known nodes from scratch would drop future nested content as soon as editing is enabled. Template patching preserves compatibility while permitting typed editing and deep copy.

**Alternatives considered**:

- Keep raw XML and let the renderer edit XML directly: rejected because it has no typed validation, generation, or reusable import seam.
- Rebuild the entire known XML subtree on save: rejected because unknown nested values would be silently lost.
- Store a second JSON voice beside XML: rejected because `.blue` XML is canonical and duplicate durable state would split ownership.

## Decision 2: Use Java final defaults, ranges, ordering, and shared UI semantics

**Decision**: Port constructor defaults from `BlueX7.setDefaults()`, not the preliminary value-class defaults. Preserve six ordered operators, four ordered points per envelope, Java enums/ranges, all-true operator enables, default algorithm 19/transpose 24/feedback 6/LFO speed 35/PEG 50s, and exact six operator presets. Treat sync and PMS as shared editor controls that atomically propagate to six stored operator values. Do not silently normalize mixed legacy values until the user edits the shared control.

**Rationale**: These are observable Java creation/edit behavior and define the initial sound. The Java data schema stores sync/PMS per operator while the UI and SysEx import treat them as instrument-wide.

**Alternatives considered**:

- Use zero/base-class defaults: rejected because new TypeScript voices would differ from Java Blue immediately.
- Collapse shared fields into one persisted scalar: rejected because it changes XML and could discard mixed legacy values.

## Decision 3: Port exact ORC resources as static TypeScript data

**Decision**: Generate a statically imported `algorithm-orchestra.ts` map from Java's `dx701.orc`…`dx732.orc`; optionally retain a maintenance generator outside production source. Copy the 32 authoritative 116×94 algorithm GIFs to renderer assets and import them through Vite.

**Rationale**: The ORCs total roughly 512 KB and encode the proven Java sound implementation. `@blue/data` publishes only compiled output and cannot use filesystem/resource loading, so a static module works identically in browser, ESM, and CommonJS. The GIFs are authoritative, compact, and avoid manually drifting routing diagrams.

**Alternatives considered**:

- Load loose `.orc` files at runtime: rejected by portable data boundaries and package publishing.
- Generate all algorithms from diagram topology: rejected as a high-risk synthesis rewrite unrelated to parity.
- Hand-code 32 JSX diagrams: rejected because visual routing could drift from Java resources.

## Decision 4: Port Java Csound generation exactly and isolate preview compilation

**Decision**: Implement Java's eleven once-per-`Tables` static tables, six per-instrument operator tables, ORC extraction/replacements, last-output rewrite, and post-code append. Keep allocation values per compilation/instrument rather than module globals. Preview a deep copy using a fresh `Tables` and show generated tables/body plus a separate binding/status view.

**Rationale**: Existing `Tables` compilation variables and `BlueData` ordering already match Java's lifecycle. Disposable preview avoids mutating canonical project state or racing normal rendering.

**Alternatives considered**:

- Generate preview through main/engine IPC on each edit: rejected due to latency, stale ordering, host inconsistency, and unnecessary engine coupling.
- Call `generateInstrument()` without table allocation: rejected because p10–p24 substitutions would be uninitialized.
- Use Java-style module-global table numbers: rejected because concurrent preview and project compilation could corrupt one another.

## Decision 5: Expose Java generator limitations instead of inventing synthesis behavior

**Decision**: Preserve Java sound semantics: the emitted code uses algorithm, feedback, output, velocity sensitivity, operator EG, AMS, mode, detune, and keyboard rate scaling. It does not consume transpose, operator enables, LFO, PEG, sync, coarse/fine, keyboard breakpoint/curves/depths, or PMS. Every edit refreshes the preview and binding/status view; Java-unused fields are visibly identified as stored but not emitted. Generated Csound remains exact parity.

**Rationale**: The feature asks for Java Blue parity and Csound visibility. Silently making dormant Java values affect synthesis would change existing project sound without an audio oracle or approved divergence.

**Alternatives considered**:

- Extend the ORCs to implement true DX7 behavior: rejected as a separate synthesis feature requiring audio acceptance fixtures.
- Hide dormant values from preview: rejected because users need truthful parameter binding feedback.

## Decision 6: Extend the existing nested snapshot/patch bridge

**Decision**: Expand `BlueX7InstrumentSnapshot` and add a nested discriminated `BlueX7Patch` with semantic operations for common/LFO/operator/stage/post-code/shared fields and whole-voice replacement. Apply and validate centrally; mirror optimistically in the project store. Reuse `InstrumentEditorPanel` for orchestra, Track, and library hosts.

**Rationale**: The three hosts already share the same renderer and `OrchestraPatch` shape, but have different canonical owners. Semantic operations make indexed changes and atomic import explicit without introducing new ownership workflows.

**Alternatives considered**:

- Add dozens of flat optional `InstrumentPatch` keys: rejected as ambiguous for indexes, grouping, and atomic replacement.
- Hold a full renderer draft and save on close: rejected because it bypasses project dirty/revision updates and conflicts with concurrent host changes.
- Create host-specific editors: rejected because it would duplicate UI and parity behavior.

## Decision 7: Use instance-scoped editor undo

**Decision**: Adapt the piano-roll command/snapshot concept into a hook or reducer mounted within each `BlueX7Editor`. Store before/after voice snapshots, group gestures at explicit start/commit boundaries, make import one replacement, clear on unmount/context replacement, and allow CodeMirror to retain native text undo.

**Rationale**: The clarified requirement is editor-session-local undo. The existing piano-roll Zustand store is module-global and could leak history among concurrently mounted orchestra, Track, and library editors.

**Alternatives considered**:

- Reuse the global piano-roll store: rejected due to cross-editor history leakage.
- Add project-wide undo infrastructure: rejected as out of scope.
- Record every pointer move/keystroke: rejected because it produces unusable history and patch traffic.

## Decision 8: Keep SysEx semantics portable and file access host-owned

**Decision**: Main opens an invoking-window-owned dialog and reads only a bounded 163- or 4,104-byte file, returning file name/bytes or typed cancel/error. `@blue/data` performs all validation and detached decoding. Renderer selects/accepts a voice and dispatches exactly one replacement patch.

**Rationale**: This keeps filesystem authority in main, semantic behavior testable/browser-safe, library imports draft-aware, and cancellation/decoding atomic.

**Alternatives considered**:

- Parse and mutate the current project in main: rejected because it cannot honor library-draft ownership and would bypass editor-local undo.
- Use renderer File APIs: rejected because Electron file operations follow main/preload boundaries.
- Mutate the target incrementally while decoding: rejected because failures could leave a partial voice.

## Decision 9: Match valid Java mapping and intentionally strengthen validation/cancel UX

**Decision**: For valid canonical data, reproduce Java offsets, reverse operator ordering, single/bank differences, and packed shifts exactly, including suspicious bank detune/velocity shifts until oracle evidence authorizes a divergence. Additionally validate length, F0/F7 framing, Yamaha manufacturer/header, 7-bit data, checksum, bounds, and decoded domains. Bank cancel is a no-op; slot labels use stable indices and safe names; imported voice names do not rename the instrument.

**Rationale**: Java accepts files solely by length and its bank-cancel path imports slot zero. The specification explicitly requires malformed-file rejection and cancel safety while valid import parity remains mandatory.

**Alternatives considered**:

- Reproduce Java's length-only validation and cancel bug: rejected by acceptance criteria and atomicity.
- Correct suspicious packed shifts from DX7 documentation without an oracle: rejected because FR-016 requires Java transforms.

## Decision 10: Use synthetic fixtures plus real project/Csound evidence

**Decision**: Commit deterministic canonical single/bank binaries with edge-case names and boundary patterns, plus expected decoded JSON verified through a Java oracle. Add Java default/boundary/unknown XML and Csound goldens for algorithms 1/19/32, multi-instance static table reuse, and a preoccupied table range. Use the repository TimewaveCanon project for real-world evidence.

**Rationale**: Neither checkout contains reusable SysEx fixtures or Java tests. Synthetic fixtures avoid licensing ambiguity and make every byte intentional; real project/golden output proves integration.

**Alternatives considered**:

- Generate expected values with the TypeScript decoder under test: rejected as circular.
- Require Java during every TypeScript test run: rejected because Java is an evidence/oracle step, not a production test dependency.
