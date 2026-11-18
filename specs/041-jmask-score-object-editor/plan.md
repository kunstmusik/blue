# Implementation Plan: JMask Score Object Editor Parity

**Branch**: `041-jmask-score-object-editor` | **Date**: 2026-05-11 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/spec.md](/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/spec.md`

## Summary

Replace the current seed-only `JMask` auxiliary editor with a Java Blue-style top bar plus scrollable parameter-editor stack that covers generator selection, optional mask or quantizer or accumulator workflows, probability routing, and any table or preview surfaces this slice can support honestly. Because the current TypeScript port only preserves top-level seed fields, the implementation must start by porting the nested `JMask` field subsystem into `@blue/data` before the renderer can claim parity safely.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages  
**Primary Dependencies**: Spec 037 score-object editor infrastructure, Spec 040 interaction and contract patterns, new `@blue/data` `JMask` field subsystem port, reusable renderer form and canvas primitives, Dockview 5.2.0, Zustand 5.x, Vitest 4.x  
**Storage**: canonical `JMask` state remains in main-process `BlueData`; scroll position, open menus, selected table points, and other editor-shell state remain renderer-local  
**Testing**: `@blue/data` unit coverage, Vitest renderer, shared-contract, and main-process coverage plus `pnpm --filter @blue/data test`, `pnpm --filter @blue/app exec vitest run --config vitest.config.ts --browser.enabled=false`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:renderer`, and `git diff --check`  
**Target Platform**: Electron desktop on macOS first  
**Project Type**: app-layer parity feature extending the existing score-object auxiliary editor infrastructure  
**Performance Goals**: large parameter stacks must remain scrollable and responsive; nested editor changes should commit at deliberate boundaries rather than thrashing the patch pipeline; table editing should not re-render unrelated rows
**Constraints**: preserve Java `.blue` compatibility, keep unsupported data explicit and reload-safe, mirror the Java component tree and row-menu behavior closely, and avoid claiming preview parity until the nested model can generate notes honestly
**Scale/Scope**: one heavyweight model-port plus one form and canvas driven score-object editor, its document contract, mutation helpers, and validation coverage

## Constitution Check

- **Data-First, UI-Separated**: PASS. Canonical `JMask` mutations will stay in shared patch helpers while expansion, menu, and scroll state remain renderer-local.
- **Backwards-Compatible Serialization**: PASS. The model-port work remains XML-backed and stays inside `@blue/data`.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java Blue `JMask` editor classes remain the parity source for layout and generator workflows.
- **Engine as External Process**: PASS. This slice is editor interaction and model mutation only.
- **Test-First for Serialization**: PASS. The plan adds `@blue/data` model tests, payload tests, nested-mutation tests, and unsupported-data coverage before parity is claimed.
- **Research Integration**: PASS. The design explicitly breaks out the Java top bar, parameter-row, generator, modifier, probability, and table hierarchies instead of hiding them behind shallow placeholder tasks.

## Project Structure

### Documentation

```text
/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── jmask-score-object-editor-surfaces.md
└── tasks.md
```

### Source Code

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/JMaskEditor.tsx
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/jmask/
/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/j-mask.ts
/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/jmask/
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/
/Users/stevenyi/work/blue-electron/packages/blue-data/tests/
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/
```

**Structure Decision**: Keep the Spec 037 score-object editor shell, replace the current `JMaskEditor.tsx` seed form with a Java-style top bar plus scrollable parameter stack, port the nested `JMask` field subsystem into `@blue/data`, and add explicit nested patch helpers so generator, modifier, probability, visibility, rename, and table edits remain canonical and reload-safe.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/research.md](/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/data-model.md](/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/contracts/jmask-score-object-editor-surfaces.md](/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/contracts/jmask-score-object-editor-surfaces.md)
- [/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/quickstart.md](/Users/stevenyi/work/blue-electron/specs/041-jmask-score-object-editor/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. Canonical `JMask` edits remain patch-driven and renderer-local panel state stays isolated.
- **Backwards-Compatible Serialization**: PASS. No renderer-owned persistence is introduced.
- **JVM Dependencies Preserved, Not Replaced**: PASS. The plan is anchored to Java `JMask` editor classes and generator workflows.
- **Engine as External Process**: PASS. No transport or render-engine behavior changes are required.
- **Test-First for Serialization**: PASS. `@blue/data`, contract, renderer, and nested-mutation tests are required before parity is claimed.
- **Research Integration**: PASS. The plan turns the Java top bar, parameter-row, generator, modifier, probability, and table hierarchies into explicit design and task work instead of a single placeholder implementation step.

## Closeout Validation

Spec 041 is complete as of 2026-05-16.

- `@blue/data` now owns the canonical `JMask` field/generator/modifier/table model and generated-score path.
- `@blue/app` renders and patches a Java-style `JMask` auxiliary editor from a `JMaskEditorPayload` field snapshot.
- The implementation keeps editor-shell state local while sending canonical `seedUsed`, `seed`, and `field` patches through `updateTypeSpecificEditor`.
- Java Blue parity was checked against `JMask`, `Field`, `Parameter`, `GeneratorRegistry`, `JMaskEditor`, `ParameterEditor`, modifier editors, probability editors, and `TableCanvas`.

Validated commands:

- `pnpm --filter @blue/data test` - 88 files, 849 passed
- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/jmask-editor-contract.test.tsx --browser.enabled=false` - 4 passed
- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts --browser.enabled=false` - 81 files, 880 passed, 2 skipped
- `pnpm --filter @blue/app test` - 1 file, 4 passed
- `pnpm --filter @blue/app build:main` - pass
- `pnpm --filter @blue/app build:preload` - pass
- `pnpm --filter @blue/app build:renderer` - pass
- `git diff --check` - pass

## Mode 2 oscillator compatibility

Mode 2 intentionally diverges from Java by scaling frequency-table evaluation
to the JMask's generation duration and integrating the selected interpolation.
Keep the legacy oscillator calculation in Mode 1. Verify the attached #765
and #739 projects, constant-table parity with a fixed frequency, and the saw
and square wave values at exact phase transitions. The implementation uses
original TypeScript within the MIT data package. See the
[oscillator compatibility rationale](research.md#oscillator-frequency-sweeps-in-mode-2).
