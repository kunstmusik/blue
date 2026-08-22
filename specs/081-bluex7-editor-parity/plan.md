# Implementation Plan: BlueX7 Instrument Editor Parity

**Branch**: `081-bluex7-editor-parity` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from [spec.md](./spec.md)

## Summary

Replace the preservation-only BlueX7 model and placeholder editor with a complete Java Blue-compatible six-operator FM workflow shared by the orchestra panel, Track instrument window, and library editor. `@blue/data` will own the fully modeled voice, lossless XML, Yamaha DX7 SysEx decoding, and Java-compatible Csound table/body generation. The app will extend its existing typed instrument snapshot/patch bridge, add one narrow main/preload SysEx chooser/read operation, render algorithm/envelope/operator controls with TypeScript Blue styling, and keep per-editor navigation, import selection, preview, and undo history transient.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.7.5 with Node 22 in main
**Primary Dependencies**: `@blue/data`, existing project-editor and unified-library contracts, Zustand 5.x, CodeMirror 6 through `SelectedCodeEditor`, Electron dialog/fs IPC, Vitest 4.x, Vite 7.x
**Storage**: Existing `.blue` XML remains canonical for modeled and unknown BlueX7 data. User-library instrument drafts continue to serialize through the existing library database payload. SysEx bytes, decoded candidates, editor tabs, undo history, preview text, and validation messages are transient.
**Testing**: Co-located `@blue/data` Vitest model/parser/generation tests; `@blue/app` shared contract, main/preload, library adapter, renderer component, host-integration, and browser accessibility/layout tests; Java fixture/oracle comparisons; build/lint/diff checks
**Target Platform**: Electron desktop on macOS, Windows, and Linux; browser-safe data package in ESM and CommonJS builds
**Project Type**: Existing Electron monorepo with a portable data package, Electron main/preload boundary, and React renderer
**Performance Goals**: Final Csound preview state visible within 500 ms after 95% of edit sequences; pointer drags remain responsive and commit coalesced semantic patches; no unbounded undo history or full-project regeneration per pointer event
**Constraints**: No Node/DOM/Electron imports in `@blue/data`; no renderer filesystem access; six operators and fixed array cardinalities; existing unknown root and nested XML must survive modeled edits; library edits retain draft/save semantics; Track edits remain revision-fenced; the editor must remain reachable at a 1000×760 window and in a 360 px orchestra pane via reflow/scrolling
**Scale/Scope**: One modeled instrument family, 32 algorithm orchestra resources and diagrams, six operator views, seven four-stage envelopes, two SysEx file forms, three editor hosts, one file-read IPC operation, and focused cross-package regression coverage

## Constitution Check

*GATE evaluated before research; all checks pass.*

- **Portable data core**: PASS — voice models, XML, SysEx parsing, and Csound generation use only static TypeScript imports and host-neutral values. Electron dialog/fs behavior remains in `@blue/app` main.
- **Java and project compatibility**: PASS — Java `BlueX7`, its four value classes, editor panels, SysEx reader/dialog, 32 algorithm ORCs/GIFs, and the TimewaveCanon project/CSD are named evidence sources. Modeled values patch a cloned XML template so unknown root and nested content survives. Valid SysEx mapping and generated Csound follow Java exactly; stricter malformed-file rejection, cancel safety, accessibility, numeric envelope entry, and preview binding diagnostics are documented divergences.
- **Canonical ownership and contracts**: PASS — the main-process `BlueData` document owns project instruments; unified-library sessions own unsaved library drafts; Track instrument state remains Track-owned and revision-fenced. A serializable BlueX7 snapshot plus discriminated semantic patch operations serve all hosts. Renderer session state and file bytes are disposable.
- **Runtime and engine isolation**: PASS — no Java helper, engine protocol, ZeroMQ, or renderer-to-engine coupling is added. Preview generation is a deterministic disposable data-layer compilation and cannot mutate active engine or project compilation state.
- **Host-path portability**: PASS — the SysEx chooser returns no persistent path and reads native paths only in main. Tests inject chooser/read failures and include Windows-style paths only where dialog defaults are exercised; no separator normalization is needed for SysEx content.
- **Verification evidence**: PASS — planned coverage includes exact defaults/ranges, lossless Java XML, synthetic Java-oracle SysEx fixtures, typed snapshot/patch validation, library/Track/orchestra integration, Java Csound goldens and table allocation, preview latency, keyboard accessibility, 1000×760 layout, package builds/tests, repository lint/test, and `git diff --check`.

## Project Structure

### Documentation (this feature)

```text
specs/081-bluex7-editor-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── blue-x7-editor.md
│   └── blue-x7-sysex-import.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── index.ts
└── instruments/
    ├── blue-x7.ts
    ├── blue-x7.test.ts
    ├── blue-x7-sysex.ts
    ├── blue-x7-sysex.test.ts
    └── blue-x7/
        ├── algorithm-orchestra.ts
        └── test-fixtures/
            ├── java-default.blue.xml
            ├── boundary-and-unknown.blue.xml
            ├── single-voice.syx
            ├── voice-bank.syx
            └── expected-decode.json

packages/blue-app/src/
├── shared/
│   ├── blue-x7-sysex.ts
│   ├── blue-x7-sysex.test.ts
│   ├── project-editor.ts
│   └── project-editor-blue-x7.test.ts
├── main/
│   ├── blue-x7-sysex-import.ts
│   ├── blue-x7-sysex-import.test.ts
│   └── main.ts
├── preload/
│   └── preload.ts
└── renderer/
    ├── assets/blue-x7/
    │   └── algo01.gif ... algo32.gif
    ├── types/global.d.ts
    ├── components/workbench/panels/orchestra/
    │   ├── BlueX7Editor.tsx
    │   └── blue-x7/
    │       ├── AlgorithmPanel.tsx
    │       ├── EnvelopeEditor.tsx
    │       ├── OperatorPanel.tsx
    │       ├── LfoPanel.tsx
    │       ├── CsoundPanel.tsx
    │       ├── SysexImportDialog.tsx
    │       └── useBlueX7Undo.ts
    ├── components/track-instrument-editor/track-instrument-patch-queue.ts
    ├── stores/project-store.ts
    └── tests/
        ├── blue-x7-editor.test.tsx
        ├── blue-x7-hosts.test.tsx
        └── track-instrument-patch-queue.test.ts
```

**Structure Decision**: Extend the existing portable model and shared `InstrumentEditorPanel` route instead of creating a feature package or host-specific editors. Small BlueX7 renderer subcomponents isolate visual concerns while one controlled `BlueX7Editor` retains identical capabilities in all three hosts. A narrow main module handles only native selection/read; semantic decoding stays in `@blue/data`.

## Implementation Design

### 1. Model BlueX7 without losing unknown project data

- Replace `_rawChildren`-only preservation with explicit common, LFO, six-operator, PEG, and post-code values using Java final defaults, ranges, ordering, enums, and deep-copy behavior.
- Retain a cloned loaded XML template. Saving updates known attributes/elements at their original semantic positions while retaining unknown root attributes, unknown siblings, extra repeated nodes, and unknown content inside known common/LFO/operator elements.
- Validate programmatic patches and imported values at the data boundary. Existing malformed/out-of-domain XML is preserved and diagnosed rather than crashing; shared sync/PMS values are not silently normalized until the user edits that shared control.
- Port the 32 Java ORC resources as a generated static TypeScript map so both package builds and browser hosts use identical text without filesystem access.

### 2. Reproduce Java Csound compilation with disposable preview context

- Port Java's once-per-`Tables` static table allocation and six per-instrument operator tables, storing allocation results per compilation/instrument rather than Java-style module globals so overlapping preview/project compilations cannot race.
- Port algorithm selection, p-field replacements, output rewrite, and post-code placement exactly. Verify static table adjacency and multi-BlueX7 allocation against Java artifacts.
- Build preview from a deep-copied voice and disposable `Tables`; show generated tables and instrument body read-only beside editable post code. A separate binding/status view lists all current editor parameters.
- Java does not consume transpose, operator enables, LFO, PEG, sync, coarse/fine, keyboard level-scaling breakpoint/curves/depth, or PMS in emitted Csound. The preview still refreshes and shows those bindings, but labels them Java-persisted/not emitted; the generated artifact remains Java-compatible. Inventing extended DX7 synthesis semantics is deferred.

### 3. Extend one semantic instrument contract across three hosts

- Expand `BlueX7InstrumentSnapshot` with the complete serializable voice. Add nested discriminated operations for common/LFO fields, one operator field, one operator envelope stage, one PEG stage, post code, shared sync/PMS propagation, and whole-voice replacement.
- Centralize patch validation/application and snapshot creation in `project-editor.ts`; mirror each operation in the optimistic renderer projection so controls never roll back while main commits.
- Preserve current ownership flows: orchestra patches the canonical project, Track uses its revision-fenced patch queue, and library edits a draft XML payload until Save. Track queue merging keys coalescible BlueX7 operations by semantic target and treats whole-voice replacement as indivisible.
- Use a per-mounted-editor history keyed by host/assignment identity. Record before/after voice snapshots, group drag gestures at commit boundaries, clear on context exit/reopen/external replacement, and record a SysEx import as one step. Keep CodeMirror's native focused-text undo and do not reuse the global piano-roll store.

### 4. Import SysEx through a narrow host boundary

- Main owns the invoking-window native chooser and bounded file read, returning canceled, selected bytes/name, or a typed read/size error. No arbitrary path or filesystem method is exposed.
- `@blue/data` validates framing, Yamaha header, 7-bit payload, checksum, size, and decoded domains before returning a detached single voice or 32-slot bank. Valid mapping—including Java's reverse operator order and packed shifts—matches Java exactly.
- Renderer owns temporary bytes, bank-slot selection, confirmation, and errors. Slot labels include stable one-based indices and safely displayed names. It overlays the decoded voice onto the current snapshot according to Java single/bank enable semantics while preserving metadata, post code, and unknown XML, then dispatches exactly one replacement patch.
- Cancel, validation failure, stale editor identity, and read failure dispatch no mutation. Library imports remain draft-only until normal Save.

### 5. Build an accessible TypeScript Blue editor

- Reuse the shared editor shell and Blue design tokens; organize Common/LFO, operator 1–6, PEG, and Csound views with internal scrolling and responsive grids.
- Render Java's 32 authoritative routing GIFs as Vite-managed assets; annotate algorithm number and operator states accessibly rather than recreating routing logic in hand-written JSX.
- Provide range/numeric controls for every scalar, a pointer-and-keyboard four-point envelope editor with synchronized numeric values, visible shared-control/mixed-state semantics, and non-color-only operator enabled state.
- Ensure all controls remain reachable at 1000×760 and in the orchestra pane's 360 px minimum; dialogs trap/restore focus and every graph/control has a useful accessible name/value.

### 6. Prove compatibility and recovery

- Create synthetic canonical single/bank fixtures and expected decoded JSON checked against a Java reader oracle, plus default/boundary/unknown XML fixtures.
- Compare algorithms 1, 19, and 32 and a real TimewaveCanon multi-instrument case against Java-generated tables/body after line-ending/trailing-whitespace normalization only.
- Cover cancellation, malformed inputs, exact one-patch import, unknown nested XML, library draft save/reopen, Track stale-revision retry/merge, optimistic orchestra projection, local undo grouping/reset, Csound generation diagnostics, and post-code fidelity.
- Run focused tests/builds first, then full repository tests/lint because the data model and shared editor contract cross packages.

## Phase 0: Research Output

[research.md](./research.md) records Java behavior, current TypeScript seams, resolved model/XML/resource/generation decisions, SysEx validation and ownership, editor hosting/undo/layout choices, alternatives, and the Java generator limitations.

## Phase 1: Design Output

- [data-model.md](./data-model.md) defines canonical voice entities, transient states, validation, XML preservation, and state transitions.
- [contracts/blue-x7-editor.md](./contracts/blue-x7-editor.md) defines snapshots, semantic patches, three-host ownership, preview, undo, and failure guarantees.
- [contracts/blue-x7-sysex-import.md](./contracts/blue-x7-sysex-import.md) defines chooser/read IPC and decode/import state transitions.
- [quickstart.md](./quickstart.md) defines automated and manual parity validation.

## Post-Design Constitution Check

*Re-evaluated after research, data modeling, and contracts; all checks remain passing.*

- **Portable data core**: PASS — all semantic parsing/generation remains static, deterministic, and host-neutral; main alone uses dialog/fs.
- **Java and project compatibility**: PASS — data-model and contracts preserve Java field meanings, XML and valid SysEx mapping, explicitly retain Java-unused synthesis fields, and identify all intentional UX/validation divergences.
- **Canonical ownership and contracts**: PASS — complete snapshots and semantic patches cover project, Track, and library-draft owners without adding a second durable store; failures and stale identities are no-ops.
- **Runtime and engine isolation**: PASS — preview uses a disposable model/tables context and does not touch engine or project compilation state.
- **Host-path portability**: PASS — native paths never leave main; result contracts contain only file name/bytes/status and cross-platform failure tests use injected dependencies.
- **Verification evidence**: PASS — contracts and quickstart trace every persistence, IPC, renderer, Csound, fixture, accessibility, build, lint, and recovery obligation.

No constitution violations or exceptions require Complexity Tracking.

## Complexity Tracking

No violations. The static 32-resource map is intentionally larger than reconstructing algorithms from topology data because it preserves the Java sound oracle, remains portable in both package formats, and avoids speculative synthesis refactoring.
