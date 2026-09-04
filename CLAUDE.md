# blue-electron Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-04

## Active Technologies

- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + `PresetGroup`/`Preset` BSB preset model, Zustand 5.x project store with BSB interface/opcode-list patch support, Dockview 5.2.0, CodeMirror 6, `BsbInterfacePatch` union type for structured BSB mutations (022-bsb-interface-parity)
- BSB Interface tab now renders an editable widget canvas with selection, property-sheet editing, grid settings, preset application, and Java-style split-view UDO editor (UDOTable + UDOEditor); snapshot contract extended with `widgetTree`, `gridSettings`, `editEnabled`, `presetGroup`, `opcodeListText`; widget-specific rendering (Slider, Knob, Toggle, etc.) deferred to SPEC 023 (022-bsb-interface-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x + Zustand 5.x (output store), dockview 5.2.0 (panel registration), `@tanstack/react-virtual` (virtualized text rendering), existing IPC bridge (preload/main) (025-output-window)
- Ephemeral — no persistence (matches Java Blue behavior) (025-output-window)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and sound-object classes (`Score`, `PolyObject`, `AudioClip`, `SoundObjectLibrary`, `NoteProcessorChain`, `TimePosition`, `TimeDuration`, `TimeBehavior`), shared `ProjectEditorSnapshot` and `ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 auxiliary workbench layout, existing CodeMirror `SelectedCodeEditor`, Vitest 4.x (037-score-object-editor-parity)
- main-process in-memory `BlueData` remains canonical; renderer reads score object editor documents on demand for the active selection and writes canonical mutations through shared score patches (037-score-object-editor-parity)

- TypeScript 5.x, strict mode + `@rgrove/parse-xml` (XML parsing), `vitest` (testing), `esbuild` (bundling for Electron)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x, strict mode: Follow standard conventions

<!-- MANUAL ADDITIONS START -->

## Java-First Debugging Guidance

- For behavior mismatches, render failures, XML-compatibility issues, or formatting/parity bugs in the TypeScript port, consult the Java implementation first before changing TypeScript code.
- Primary reference roots: `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core`.
- When applicable, compare against Java-generated artifacts first, especially `~/work/blue/demo2026/01.csd`, and only keep a TypeScript-side divergence if it is intentional and documented.

## Constraints

- No `require()` or dynamic `import()` calls in `@blue/data` (esbuild bundle constraint).
- No Node.js built-ins in `@blue/data` — browser-safe and Node-safe library code only.
- Static ES `import` statements only — no `require()`, no dynamic `import()`, and no inline `import("...").Type` type annotations; use top-level static imports instead.
<!-- MANUAL ADDITIONS END -->

## Recent Changes

- 037-score-object-editor-parity: Added TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and sound-object classes (`Score`, `PolyObject`, `AudioClip`, `SoundObjectLibrary`, `NoteProcessorChain`, `TimePosition`, `TimeDuration`, `TimeBehavior`), shared `ProjectEditorSnapshot` and `ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 auxiliary workbench layout, existing CodeMirror `SelectedCodeEditor`, Vitest 4.x
- 025-output-window: Added TypeScript 5.8.x, React 19.x, Electron 35.x + Zustand 5.x (output store), dockview 5.2.0 (panel registration), `@tanstack/react-virtual` (virtualized text rendering), existing IPC bridge (preload/main)
- 022-bsb-interface-parity: Added BSB editing infrastructure including editable interface canvas with selection, property-sheet editing, grid settings panel, preset application bar, Java-style split-view UDO editor (UDOTable + UDOEditor), preset model (PresetGroup/Preset), BSB interface/opcode-list patch support, and snapshot contract extensions; widget-specific rendering (Slider, Knob, Toggle, etc.) deferred to SPEC 023
