# Implementation Plan: Project Save State

**Branch**: `109-project-save-state` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/109-project-save-state/spec.md`

## Summary

Derive one project save-state answer from existing ProjectSession and ProjectHistory facts. Reuse savedStateId for undo/redo comparison, treating an active document without a file path as never saved. Use this query for close/quit confirmation and main-window titles. Settle buffered editor changes before checking state, and ensure failed saves cannot complete application exit.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible strict source.
**Primary Dependencies**: Existing Electron 35.7.5, React 19, Zustand 5; no new dependency.
**Storage**: Existing .blue files; save state is session-only derived metadata.
**Testing**: Vitest 4, existing history/lifecycle/replacement tests, native window/dialog mocks, desktop smoke validation.
**Target Platform**: macOS, Windows, Linux.
**Project Type**: Electron desktop app in pnpm workspace.
**Performance Goals**: Constant-time query; title updated during the corresponding publication turn; no per-edit XML comparison.
**Constraints**: Preserve history identity, save checkpoints, settlement ordering, serialization, and failed-save protection.
**Scale/Scope**: One active ProjectSession with multiple editor/workbench windows. No multi-project session feature.

## Constitution Check

Pre-research gate: PASS for proposed scope; lifecycle and history integration required research confirmation. Post-design gate: PASS with evidence below.

- **Portable data core**: PASS — changes stay in @blue/app; no host dependencies enter @blue/data.
- **Java and project compatibility**: PASS — inspected Java BlueProjectManager.saveCheck and Installer.setWindowTitle. Conditional prompts and requested title strings intentionally diverge from unconditional Java prompts and version-bearing title. No XML/CSD change.
- **Canonical ownership and contracts**: PASS — ProjectSession owns document/path; ProjectHistory owns savedStateId. Derived query introduces no mutable dirty flag, persistence or migration. Existing typed history projections remain authoritative.
- **Project history and undo/redo**: PASS — no new durable writer or history entry. Existing commit→undo→redo coverage verifies state, identity and checkpoint behavior; settlement preserves preview cancellation and runtime reconciliation.
- **Runtime and engine isolation**: PASS — filesystem, dialogs, titles and shutdown remain main-owned; existing engine cleanup is preserved.
- **Host-path portability**: PASS — basename handling is display-only; filesystem paths remain native. Test synthetic Windows/POSIX titles and injected write errors. No path identity change.
- **Verification evidence**: PASS — focused state/title/confirmation tests, existing lifecycle/history/replacement suites, app builds, workspace test/lint and desktop smoke validation in quickstart.md.

## Project Structure

### Documentation (this feature)

```text
specs/109-project-save-state/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/save-state.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── project-history.ts
│   ├── project-history.test.ts
│   ├── project-session.ts
│   ├── project-lifecycle.ts
│   ├── project-lifecycle.test.ts
│   ├── project-replacement-flow.ts
│   ├── project-replacement-flow.test.ts
│   ├── project-replacement-entry-points.test.ts
│   └── main.ts
├── shared/
│   ├── project-history.ts
│   ├── window-title.ts
│   └── window-title.test.ts             # new
└── renderer/tests/app.test.ts
```

**Structure Decision**: Extend existing query/formatter seams. Keep main orchestration small; extract a narrowly scoped injected confirmation coordinator if needed for behavioral tests. No broad refactor.

## Phase 0: Research

Completed in [research.md](research.md). Existing saved state IDs, Java reference, publication paths, save failure behavior, and settlement constraints resolve all unknowns.

## Phase 1: Design

1. Add ProjectHistory.getSaveState(), using its existing session dependency. Return none, unsaved, saved or modified. Keep isDirty() as history-baseline comparison; derive needsSaving from save state without storing it.
2. Preserve lifecycle checkpoint initialization. New documents may have clean initial history while save state is unsaved because filePath is null.
3. Extend shared title formatter to accept derived state explicitly. Preserve file basename including extension, use New Project for a pathless active document, and Blue for no document. Refresh at window creation, lifecycle transitions, history publication and checkpoint publication.
4. Settle editor participants before testing save state. Use one settlement boundary around close/quit state evaluation, dialog, settled save and terminal transition. Invoke doSave/saveFileAsInternal inside an existing boundary, not barrier-owning public save wrappers. Audit shared replacement callers to preserve accepted-target ordering and avoid nested barriers.
5. Have confirmation return consent/outcome without quitting from write/save helpers. requestQuit owns shutdown after clean, successful save or explicit discard. Remove pendingQuit-driven shutdown on write failure and duplicate shutdown side effects. Cancel, write failure and settlement failure leave the document open and reset the quit guard.
6. Preserve existing typed history events and renderer dirty projections. No new IPC channel is needed: title and confirmation are main-owned. Renderer editor-draft flags do not decide durable project save state.
7. Add focused tests for all states, clean quit, failed-save quit, Save As cancellation, pending drafts in secondary windows, branching/pruning, and saving before the redo tip. Update existing formatter assertions in renderer/tests/app.test.ts.

**Scope clarification**: FR-011 applies per supported project session. Current windows share one active project; a multi-project registry is outside this feature.

## Complexity Tracking

No constitution violations, new dependencies, or persistence stores.
