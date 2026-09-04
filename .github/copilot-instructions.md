# blue-electron Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-04

## Active Technologies

- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and sound-object classes (`Score`, `PolyObject`, `AudioClip`, `SoundObjectLibrary`, `NoteProcessorChain`, `TimePosition`, `TimeDuration`, `TimeBehavior`), shared `ProjectEditorSnapshot` and `ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 auxiliary workbench layout, existing CodeMirror `SelectedCodeEditor`, Vitest 4.x (037-score-object-editor-parity)
- main-process in-memory `BlueData` remains canonical; renderer reads score object editor documents on demand for the active selection and writes canonical mutations through shared score patches (037-score-object-editor-parity)

- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + Existing `@blue/data` BlueSynthBuilder model and BSB widget classes, existing `@blue/app` Orchestra/BSB editor shell from Spec 021, Zustand 5.x project store, CodeMirror 6 BSB code editors, current renderer styling/utilities, and Java Blue BSB reference sources under `/Users/stevenyi/work/nbprojects/blue` (021-orchestra-editor)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data`: Follow standard conventions

## Recent Changes

- 037-score-object-editor-parity: Added TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and sound-object classes (`Score`, `PolyObject`, `AudioClip`, `SoundObjectLibrary`, `NoteProcessorChain`, `TimePosition`, `TimeDuration`, `TimeBehavior`), shared `ProjectEditorSnapshot` and `ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 auxiliary workbench layout, existing CodeMirror `SelectedCodeEditor`, Vitest 4.x

- 021-orchestra-editor: Added TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + Existing `@blue/data` BlueSynthBuilder model and BSB widget classes, existing `@blue/app` Orchestra/BSB editor shell from Spec 021, Zustand 5.x project store, CodeMirror 6 BSB code editors, current renderer styling/utilities, and Java Blue BSB reference sources under `/Users/stevenyi/work/nbprojects/blue`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
