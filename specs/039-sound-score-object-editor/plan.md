# Implementation Plan: Sound Score Object Editor Parity

**Branch**: `039-sound-score-object-editor` | **Date**: 2026-05-11 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/spec.md](/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/spec.md`

## Summary

Replace the current `Sound` comment-only auxiliary surface with a Java Blue-style tabbed editor that covers Interface, Automation, and Comments, and add a scoped test-preview workflow. The implementation should reuse the existing Spec 037 score-object editor shell and earlier BSB interface work instead of introducing a parallel editor stack.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages  
**Primary Dependencies**: Spec 037 score-object editor infrastructure, Spec 038 closeout baseline, Specs 022 and 023 BSB interface work, `@blue/data` `Sound` and automation models, existing Electron-backed test-preview flow from `External`, Dockview 5.2.0, Zustand 5.x, Vitest 4.x  
**Storage**: canonical `Sound` state remains in main-process `BlueData`; editor-local tab state and transient modal state remain renderer-local  
**Testing**: Vitest renderer, shared-contract, and main-process coverage plus `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:renderer`, and `git diff --check`  
**Target Platform**: Electron desktop on macOS first  
**Project Type**: app-layer parity feature extending the existing score-object auxiliary editor infrastructure  
**Performance Goals**: tab switches and test-preview open/close cycles should remain immediate; BSB and automation surfaces should update only for the active selection  
**Constraints**: preserve Java `.blue` compatibility, reuse existing BSB infrastructure, keep canonical writes inside shared score patch plumbing, and leave `PianoRoll` and `JMask` work to Specs 040 and 041  
**Scale/Scope**: one heavyweight score-object editor family plus its supporting payload, tests, and preview flow

## Constitution Check

- **Data-First, UI-Separated**: PASS. Canonical `Sound` state stays in `@blue/data` and shared patch helpers; tabs and modal visibility stay renderer-local.
- **Backwards-Compatible Serialization**: PASS. All edits continue to flow through canonical score patches and XML-backed models.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java Blue `SoundEditor` and its child panels remain the parity source.
- **Engine as External Process**: PASS. The slice reuses the existing editor-side preview/test pattern and does not change engine architecture.
- **Test-First for Serialization**: PASS. The plan adds payload and mutation coverage before parity is claimed.
- **Research Integration**: PASS. The design explicitly reuses the existing BSB and score-object editor infrastructure.

## Project Structure

### Documentation

```text
/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sound-score-object-editor-surfaces.md
└── tasks.md
```

### Source Code

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/SoundEditor.tsx
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueSynthBuilderEditor.tsx
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/
/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts
/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/
```

**Structure Decision**: Keep the Spec 037 score-object editor shell, replace the current `SoundEditor.tsx` placeholder with a tabbed editor, and reuse BSB plus preview infrastructure instead of inventing new UI primitives.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/research.md](/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/data-model.md](/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/contracts/sound-score-object-editor-surfaces.md](/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/contracts/sound-score-object-editor-surfaces.md)
- [/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/quickstart.md](/Users/stevenyi/work/blue-electron/specs/039-sound-score-object-editor/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. Canonical `Sound` edits remain patch-driven and renderer-local tab state stays isolated.
- **Backwards-Compatible Serialization**: PASS. No renderer-owned persistence is introduced.
- **JVM Dependencies Preserved, Not Replaced**: PASS. The plan is anchored to Java `SoundEditor` behavior and layout.
- **Engine as External Process**: PASS. The preview flow remains an editor-side action, not a transport change.
- **Test-First for Serialization**: PASS. Contract, renderer, and mutation tests are required before parity is claimed.
- **Research Integration**: PASS. The plan reuses earlier BSB work and the Spec 037 editor shell instead of diverging from established seams.

### Instance render timing correction

Carry the Sound's instrument and normalized envelope through score generation until the final note positions are known. Allocate private instruments and parameter variables for the surviving occurrences and preserve their Track mixer associations. Verify separate overlapping Instances, both repeat behaviors, scaling, and partial playback in synchronous and asynchronous renders. This intentionally corrects the Java timing bug documented in [research](research.md#legacy-instance-automation-timing-characterization-2026-10-31). All state used for this correction belongs to the render.
