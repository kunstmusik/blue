# Implementation Plan: Context-Aware Opcode Completion and Manual Links

**Branch**: `102-opcode-manual-links` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/102-opcode-manual-links/spec.md`

## Summary

Replace the two documentation-text insertion paths with one renderer-owned, apply-time opcode insertion resolver, then enrich existing completion help with a host-mediated Open Manual action. Reuse the General program-settings snapshot for a normalized Csound 7 manual root (`https://csound.com/manual` by default); send only a catalog manual identifier over a typed IPC contract; derive, validate, probe, and open the target in Electron main. Keep catalog-generated help visible as the offline and failure fallback. Do not bundle full manual HTML or add a manual browser.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode; Node.js/Electron runtime supplied by Electron 35.7.5

**Primary Dependencies**: Electron `shell`, `net`, and URL/file-URL utilities; CodeMirror 6 autocomplete/state/view; `@kunstmusik/codemirror-lang-csound` 1.0.2 rich catalog; React 19 settings UI; existing Sonner notices

**Storage**: Existing main-owned `program-settings.json`; new `general.csoundManualUrl` string is default-merged, normalized, validated, and saved atomically; no `.blue` persistence

**Testing**: Vitest 4 unit/integration tests and existing jsdom renderer tests; CodeMirror `EditorState` application-result tests; deterministic dependency-injected host service tests; package builds, lint, and `git diff --check`

**Target Platform**: Electron desktop on supported macOS, Windows, and Linux targets; primary and hosted popout renderer realms; online HTTPS and local file manuals

**Project Type**: Multi-package desktop application; implementation is confined to `packages/blue-app`

**Performance Goals**: Completion filtering and insertion remain synchronous and imperceptible; manual actions provide immediate in-app feedback; remote availability probes use a bounded timeout and never block editing

**Constraints**: Offline fallback; no renderer filesystem/network/shell authority; only validated `https:` and `file:` roots; safe single-segment manual identifiers; no external HTML rendered inside Blue; preserve caret, selection, document, UDO behavior, `.blue`, and CSD output

**Scale/Scope**: Approximately 1,300 catalog opcodes, two existing opcode insertion entry points, existing completion help plus caret/context action, one General setting, one typed IPC operation, and one main-process service

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: PASS — all work remains in `packages/blue-app`; `@blue/data` gains no Electron, Node, DOM, or dynamic-import dependency.
- **Java and project compatibility**: PASS — Java Blue's historical app-wide `csoundDocRoot` and current bundled documentation were reviewed. The intentional divergence to a validated Csound 7 URL root plus catalog fallback is documented in the spec/research. `.blue`, CSD, engine, and project-authored data are unchanged.
- **Canonical ownership and contracts**: PASS — main-owned `program-settings.json` owns `general.csoundManualUrl`; shipped catalog metadata owns generated help; editor state remains renderer session state. The manual request/result and preload surface are typed, serializable, and fail closed. Missing legacy values default safely; invalid saves preserve the last valid snapshot.
- **Runtime and engine isolation**: PASS — filesystem probing, Electron networking, and external opening remain in main. The renderer sends only a manual identifier. No Java, engine-client, ZeroMQ, or runtime behavior changes.
- **Host-path portability**: PASS — the persisted setting is an external URL string, converted to a native path only in main via file-URL utilities. Target containment is checked after native resolution. Tests include encoded spaces, Windows drive/UNC-shaped file URLs where supported synthetically, separators, traversal attempts, and injected filesystem outcomes.
- **Verification evidence**: PASS — focused insertion application tests, program-setting normalization/persistence/reset tests, URL contract tests, main service success/failure tests, IPC/preload tests, settings/help UI tests, popout owner-document checks, `pnpm --filter @blue/app test`, `build:main`, `build:preload`, `build:renderer`, root `pnpm test`, `pnpm lint`, and `git diff --check`.

### Post-Design Re-check

All gates remain PASS. The design adds no constitutional exception: it uses existing state ownership, introduces one narrow host contract, keeps native path operations at the host boundary, and specifies deterministic failure recovery and cross-platform validation.

## Project Structure

### Documentation (this feature)

```text
specs/102-opcode-manual-links/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── manual-navigation.md
│   └── opcode-insertion.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── shared/
│   ├── csound-manual.ts
│   ├── csound-manual.test.ts
│   ├── program-settings.ts
│   └── program-settings.test.ts
├── main/
│   ├── csound-manual-service.ts
│   ├── csound-manual-service.test.ts
│   ├── main.ts
│   ├── ipc/application-ipc.ts
│   └── program-settings-store.test.ts
├── preload/preload.ts
└── renderer/
    ├── types/global.d.ts
    ├── components/settings/GeneralSettings.tsx
    ├── components/workbench/panels/editors/
    │   ├── csound-opcode-insertion.ts
    │   ├── csound-opcode-help.ts
    │   ├── csound-java-blue-completions.ts
    │   ├── csound-opcode-menu.ts
    │   ├── csound-editor-language.ts
    │   ├── editor-adapter-types.ts
    │   ├── SelectedCodeEditor.tsx
    │   └── CsoundEditorContextMenu.tsx
    └── tests/
        ├── csound-editor-parity.test.ts
        ├── udo-code-completions.test.ts
        └── settings-window.test.tsx
```

**Structure Decision**: Keep pure serializable manual contracts in `shared`, all filesystem/network/shell authority in `main`, bridge only the narrow request through `preload`, and keep CodeMirror/document presentation in the existing renderer editor area. Reuse current settings and context-menu infrastructure instead of adding a new subsystem or dependency.

## Delivery Sequence

1. Add failing document-result tests and implement the shared apply-time insertion resolver; route completion and opcode-menu insertion through it, then fix case-insensitive filtering and score gating.
2. Extend the upstream rich opcode catalog to expose reliable modern/classic syntax and entry kind, release it, and replace Blue's temporary catalog adapter heuristic. If upstream cannot land in this delivery window, keep the heuristic isolated in one adapter and record the dependency rather than hand-maintaining opcode data.
3. Add the General manual URL setting and pure URL/manual-identifier contracts, including default merge, normalization, validation, reset, and persistence coverage.
4. Add the main manual service and typed IPC/preload method. Probe built local entries, perform a bounded HTTPS preflight, open only validated targets, and return structured fallback outcomes.
5. Enrich compact help and add Open Manual from completion help and caret/context commands using the hosting document for popout-safe DOM. Keep help visible while the external action runs and show non-blocking failure feedback.
6. Run focused tests first, then package builds and repository-wide validation. Exercise a real online entry and a built local Csound 7 manual manually on macOS plus automated/synthetic Windows path coverage and supported Windows CI.

## Complexity Tracking

No constitution violations or exceptional complexity are required.
