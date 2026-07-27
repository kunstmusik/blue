# Implementation Plan: Context-Aware UDO Code Completions

**Branch**: `063-udo-code-completions` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/063-udo-code-completions/spec.md`

## Summary

Extend the reusable CodeMirror Csound completion adapter from name-only project UDO suggestions to full, source-aware UDO overloads. A portable `@blue/data` helper will normalize classic and modern callable signatures; the renderer will aggregate context-owned, project-global, and document-local definitions with exact-signature precedence; and each eligible project/library editor host will pass an explicit scope. Project effect snapshots will carry a transient project UDO projection so separate effect windows receive the same initial and live completion context without changing `.blue` XML or CSD generation.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.7.5

**Primary Dependencies**: `@blue/data` UDO models/type utilities/parser, CodeMirror 6 (`@codemirror/autocomplete`, `@codemirror/state`, `@codemirror/view`, `codemirror`), `@kunstmusik/codemirror-lang-csound`, Zustand 5.x project store, existing shared project/effect snapshot contracts

**Storage**: No new storage. Main-process `BlueData` remains canonical for project UDOs and `.blue` XML remains persistence; library documents retain their existing database/XML ownership; completion candidates and the effect snapshot’s project UDO projection are transient derived state.

**Testing**: Vitest 4.x data and renderer tests, existing main/preload/shared contract tests, `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm lint`, `git diff --check`

**Target Platform**: Electron desktop renderer, macOS first with existing cross-platform CodeMirror behavior preserved

**Project Type**: Desktop application renderer feature with one portable data helper and an existing main/preload/renderer snapshot-contract extension

**Performance Goals**: Completion construction p95 below 100 ms for 500 project-global plus 100 context-owned definitions on a supported development machine; no asynchronous work on the completion request path

**Constraints**: Preserve Java-compatible UDO XML and CSD generation; use static imports only; keep `@blue/data` free of React/Electron/Node/DOM dependencies; do not create a second UDO registry; keep library editors isolated from an unrelated open project; preserve existing completion categories and score/non-Csound exclusions

**Scale/Scope**: Three UDO sources, polymorphic overloads, and approximately fifteen eligible editor surfaces spanning project Global Orchestra, instruments, Sound objects, effects, UDO bodies, library editors, and a separate effect window

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: PASS. Callable-signature normalization belongs in existing browser-safe `@blue/data` UDO utilities and uses top-level static exports. Completion UI/source metadata remains in `@blue/app`; no Electron, Node.js built-in, DOM, React, dynamic import, or host behavior enters `@blue/data`.
- **Java and project compatibility**: PASS. Research inspected Java `UserDefinedOpcode`, `UDOUtilities`, `OpcodeList`, `UDOEditor`, `EffectEditor`, and BSB completion sources. The plan preserves stored fields, `.blue` XML, generation equivalence, collision renaming, and generated CSD. Context-aware completion is the spec’s documented intentional authoring divergence.
- **Canonical ownership and contracts**: PASS. Main-process `BlueData` remains the project owner; library documents remain library owners; renderer candidates are disposable. `EffectEditorSnapshot.projectUdos` is a typed serializable projection on an existing get/update effect-document boundary and cannot be patched or persisted.
- **Runtime and engine isolation**: PASS/N/A. No Java helper, filesystem, process, engine, ZeroMQ, playback, or runtime contract changes. The renderer consumes snapshots only.
- **Verification evidence**: PASS. Planned evidence includes portable normalization tests; completion identity, display, precedence, exclusion, and performance tests; editor-scope wiring tests; effect snapshot/update contract tests; library isolation tests; existing UDO snapshot/CSD regressions; quickstart manual scenarios; affected package tests/builds; lint and diff checks.

## Project Structure

### Documentation (this feature)

```text
specs/063-udo-code-completions/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── udo-completion-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── index.ts
└── opcodes/
    ├── udo-type-utils.ts
    ├── udo-type-utils.test.ts
    └── udo-utilities.ts

packages/blue-app/src/shared/
└── project-editor.ts

packages/blue-app/src/main/
├── main.ts
└── effect-editor-window-manager.ts

packages/blue-app/src/renderer/components/
├── effect-editor/
│   ├── EffectEditorPage.tsx
│   └── EffectEditorPanel.tsx
├── libraries/editors/
│   ├── EffectLibraryEditor.tsx
│   ├── InstrumentLibraryEditor.tsx
│   ├── SoundObjectLibraryEditor.tsx
│   └── UdoLibraryEditor.tsx
└── workbench/panels/
    ├── GlobalOrchestraPanel.tsx
    ├── OrchestraPanel.tsx
    ├── ScoreObjectEditorPanel.tsx
    ├── UserDefinedOpcodePanel.tsx
    ├── editors/
    │   ├── csound-java-blue-completions.ts
    │   └── editor-adapter-types.ts
    ├── orchestra/
    │   ├── BlueSynthBuilderEditor.tsx
    │   ├── EmbeddedUdoPanel.tsx
    │   ├── GenericInstrumentEditor.tsx
    │   ├── InstrumentEditorPanel.tsx
    │   ├── JavaScriptInstrumentEditor.tsx
    │   └── bsb/
    │       ├── BSBCodeEditor.tsx
    │       └── BSBUDOPanel.tsx
    ├── score-object/
    │   ├── editor-registry.tsx
    │   └── editors/SoundEditor.tsx
    └── udo/
        ├── UdoEditor.tsx
        └── UdoWorkspacePanel.tsx

packages/blue-app/src/renderer/tests/
├── csound-editor-parity.test.ts
├── udo-code-completions.test.ts
├── orchestra-code-instrument-editors.test.tsx
├── bsb-editor.test.tsx
├── user-defined-opcode-panel.test.tsx
├── mixer-effect-editor-contract.test.ts
├── effect-editor-window.test.tsx
├── library-editing.test.tsx
└── score-object-editor-panel.test.tsx
```

**Structure Decision**: Keep Csound completion contracts and aggregation inside the existing reusable editor adapter. Put only semantic signature normalization in `@blue/data`. Pass source collections through existing renderer component boundaries rather than adding a store or service. Extend the existing effect snapshot/update event path only where a separate renderer cannot access project state.

## Phase 0 Research Output

See [research.md](./research.md). All technical unknowns are resolved.

Key decisions:

- full definitions replace name strings;
- completion overload identity is separate from generation/code equivalence;
- normalization is portable domain logic;
- exact UDO deduplication occurs before general completion conversion;
- host components explicitly supply project/library scope;
- separate project effect windows receive initial and live project UDO projections through existing typed snapshot/event paths;
- existing completion categories and persistence remain unchanged.

## Phase 1 Design Output

- [data-model.md](./data-model.md)
- [contracts/udo-completion-contract.md](./contracts/udo-completion-contract.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Portable data core**: PASS. The contract exposes one pure signature helper in `@blue/data`; source precedence, CodeMirror rows, React scope plumbing, and window updates remain outside the data package.
- **Java and project compatibility**: PASS. The design consumes existing UDO fields without changing their values, XML, ordering, or generation semantics. The completion identity intentionally ignores code body/style formatting only for advisory overload display.
- **Canonical ownership and contracts**: PASS. No new persistent owner exists. The explicit editor scope and derived effect snapshot field eliminate implicit store leakage while preserving the main-process project owner.
- **Runtime and engine isolation**: PASS/N/A. No runtime or engine boundary is touched.
- **Verification evidence**: PASS. The data model, contract, quickstart, and forthcoming task list trace normalization, source precedence, editor matrix, live-window updates, exclusions, performance, and compatibility to focused tests and runnable commands.

## Complexity Tracking

No constitution violations or exceptional complexity are required.
