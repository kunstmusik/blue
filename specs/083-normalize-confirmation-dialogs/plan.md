# Implementation Plan: Normalize Application Confirmation Dialogs

**Branch**: `083-normalize-confirmation-dialogs` | **Date**: 2026-08-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/083-normalize-confirmation-dialogs/spec.md`

## Summary

Replace all production synchronous browser modal APIs identified by the audit and normalize confirmation behavior behind two deep modules. Host-owned decisions use a typed, serializable request/result contract and one asynchronous Electron main-process adapter that owns window parenting and semantic response mapping. Renderer-local decisions use one accessible confirmation component that owns focus, dismissal, safe destructive defaults, and single-decision delivery. Existing direct native message boxes and existing in-app confirmation surfaces migrate through those seams; durable policy and inventory live in `docs/confirmation-dialogs.md`, with an ESLint audit preventing regression.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode; React 19.2; Electron 35.7

**Primary Dependencies**: Electron `dialog`, `BrowserWindow`, `ipcMain`, `contextBridge`, and `ipcRenderer`; React; existing renderer modal styling; ESLint 10 with `typescript-eslint`

**Storage**: N/A. Requests, decisions, pending targets, and modal state are transient. No `.blue`, CSD, settings, or library-format changes.

**Testing**: Vitest 4 with jsdom and Electron mocks; TypeScript package builds; scoped ESLint static audit; manual Electron smoke testing

**Target Platform**: Electron desktop on macOS, Windows, and Linux

**Project Type**: Monorepo desktop application; this feature is confined to `packages/blue-app` plus repository lint configuration and documentation

**Performance Goals**: Confirmation waits remain asynchronous and do not block renderer/main event processing; one user decision produces at most one guarded mutation

**Constraints**: Context isolation remains enabled; renderer code cannot import Electron; native dialogs require a valid initiating owner and fail closed when it is lost; destructive in-app confirmations initially focus Cancel; existing per-flow response semantics must remain intact

**Scale/Scope**: Seven browser confirmations, two adjacent browser-modal paths, approximately twelve logical direct native message-box flows, and three existing renderer confirmation surfaces

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: PASS — all implementation stays in `@blue/app`; `@blue/data` gains no Electron, Node, DOM, dynamic-import, or host dependencies.
- **Java and project compatibility**: PASS — Java references are `ConvertToObjectBuilderAction.java`, `ScoreManagerDialog.java`, and `SoundObjectLibraryTopComponent.java`. Their warning consequences, affirmative-only mutation, and safe cancellation behavior are preserved. No XML or generated-CSD behavior changes.
- **Canonical ownership and contracts**: PASS — Electron main owns native dialog execution; renderer owns local modal visibility/focus; shared TypeScript request/result types cross a validated preload IPC boundary; project and library mutations remain in their existing document/service owners. Confirmation state is not persisted and requires no migration.
- **Runtime and engine isolation**: PASS — only main/preload code touches Electron. Renderer and data layers remain host-isolated, and engine/Java/ZeroMQ behavior is unaffected.
- **Host-path portability**: PASS/N/A — no path normalization or identity behavior changes. Existing resource basenames may appear in copy, but native paths remain untouched.
- **Verification evidence**: PASS — focused native contract/adapter tests, renderer accessibility/focus/idempotence tests, call-site accept/cancel and stale-target regressions, application-menu tests, the production-source ESLint audit, `@blue/app` tests/builds, repository tests/lint, manual quickstart scenarios, and `git diff --check` are specified.

### Post-design re-check

The Phase 1 contracts preserve the same ownership boundary: the shared contract is serializable data, the native adapter is main-only, and the renderer component has no host authority. Runtime validation and semantic action IDs remove response-index coupling without moving canonical state. No constitution exception or new persistence seam was introduced.

## Design

### Native confirmation module

Create a shared serializable contract in `packages/blue-app/src/shared/confirmation-dialog.ts` and a main-only implementation in `packages/blue-app/src/main/native-confirmation.ts`. The module exposes one high-leverage `show(owner, request)` interface. Callers declare semantic action IDs, labels, roles, default/cancel IDs, copy, tone, and an optional checkbox; the module validates the request, maps Electron response indexes back to semantic IDs, normalizes dismissal/errors/owner loss to cancellation, and hides Electron-specific ordering details.

Renderer-originated host decisions use one IPC/preload method. Its handler derives the exact owner with `BrowserWindow.fromWebContents(event.sender)` and rejects invalid or destroyed owners rather than guessing the first workbench window. Main-owned callers pass their known `BrowserWindow`. A small Electron-dialog adapter is the test seam; tests substitute a fake adapter rather than mocking every caller.

All production `dialog.showMessageBox` calls migrate through this module, including multi-action and informational decision surfaces where semantic responses are expected. `showErrorBox` remains a separately documented non-confirmation error surface. The frozen-file overwrite path loses its unsafe `undefined as BrowserWindow` cast.

### Renderer confirmation module

Create `packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx` around action descriptors with semantic IDs and intents (`cancel`, `secondary`, `primary`, `destructive`). It owns accessible naming/description, modal focus entry and trapping, Escape, opener focus restoration, topmost dismissal, safe initial focus for destructive actions, and a resolved guard that emits at most one decision.

Move the reusable focus behavior from the Blue X7-local hook to `renderer/components/dialogs/use-dialog-focus.ts` and update existing imports. `LayerRemovalConfirmationDialog`, `LibrarySessionDialog`, and the Libraries deletion preview become thin adopters/wrappers so their rich content and existing response semantics remain local while their interaction behavior is shared. C3-C7 use the same component. C1-C2 use the native contract and revalidate their preview/target immediately before mutation.

The two BSB prompts move to the existing in-app name-entry pattern with local draft/validation state. The `show-not-yet-implemented` command, handler, and placeholder builder are removed; Tools > Blue Share remains a visible disabled menu item.

### Static and durable policy

Add a narrowly scoped root `eslint.config.mjs` and `typescript-eslint` dependency. The production `@blue/app` TS/TSX scope rejects bare and `window`/`globalThis` `confirm`, `prompt`, and `alert` calls, excludes tests/fixtures/generated/user content, reports unused disables, and permits only inline disables carrying a rationale. A second restricted-syntax guard prevents new direct `showMessageBox`/`showMessageBoxSync` calls outside the native adapter. Wire the audit into root `pnpm lint` without enabling unrelated broad lint rules.

Create `docs/confirmation-dialogs.md` as the durable source for classification, ownership, action semantics, accessibility/focus, stale-state rules, inventory, exceptions, and verification. Add a concise pointer in root `AGENTS.md`; feature details remain in the docs/spec rather than agent guidance.

## Project Structure

### Documentation (this feature)

```text
specs/083-normalize-confirmation-dialogs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── native-confirmation.md
│   └── in-app-confirmation.md
└── tasks.md                    # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
AGENTS.md
docs/confirmation-dialogs.md
eslint.config.mjs
package.json
pnpm-lock.yaml

packages/blue-app/src/
├── shared/
│   ├── confirmation-dialog.ts
│   └── workbench-menu.ts
├── main/
│   ├── native-confirmation.ts
│   ├── native-confirmation.test.ts
│   ├── main.ts
│   ├── application-menu.ts
│   ├── application-menu.test.ts
│   ├── engine-recovery-dialog.ts
│   └── unified-library/ipc.ts
├── preload/
│   └── index.ts
└── renderer/
    ├── components/dialogs/
    │   ├── ConfirmationDialog.tsx
    │   └── use-dialog-focus.ts
    ├── components/instruments/blue-x7/
    │   ├── algorithm-dialog.tsx
    │   └── sysex-import-dialog.tsx
    ├── components/libraries/
    │   └── LibrarySessionDialog.tsx
    ├── components/workbench/panels/
    │   ├── LibrariesPanel.tsx
    │   ├── FreezeOperationDialog.tsx
    │   ├── RenderToDiskDialog.tsx
    │   ├── SoundObjectLibraryPanel.tsx
    │   ├── code-repository/CodeRepositoryDialog.tsx
    │   ├── orchestra/bsb/BSBPresetBar.tsx
    │   ├── orchestra/bsb/PresetsManagerDialog.tsx
    │   └── score/
    │       ├── LayerRemovalConfirmationDialog.tsx
    │       ├── ScoreManagerDialog.tsx
    │       └── layer-groups/ScoreTimeCanvas.tsx
    ├── stores/
    │   ├── library-store.ts
    │   └── workbench-store.ts
    └── tests/
        └── confirmation-dialog.test.tsx
```

**Structure Decision**: Keep both modules inside the existing `@blue/app` process directories. The shared directory contains data-only contract types; privileged execution stays in main; renderer interaction behavior stays in renderer. This creates two explicit, testable seams without introducing a package or a generic dialog framework.

## Implementation Sequence

1. Add the native contract, request validation, Electron adapter, owner policy, IPC/preload exposure, and focused tests.
2. Migrate existing direct native message-box flows and preserve every flow's semantic actions, checkbox result, default/cancel behavior, and exact owner.
3. Extract shared renderer focus behavior and implement/test `ConfirmationDialog` accessibility, cancellation, safe focus, restoration, and idempotence.
4. Adopt the renderer module in existing confirmation surfaces, then migrate C3-C7 and preserve rich preview/checkbox content.
5. Migrate C1-C2 through native IPC with target/token revalidation; migrate BSB name entry; remove Blue Share placeholder wiring and disable the menu item.
6. Add the scoped ESLint guards, durable documentation and AGENTS pointer; update the audited inventory and tests.
7. Run focused, package, repository, build, lint, whitespace, and manual quickstart verification.

## Complexity Tracking

No constitution violations require justification. Two focused modules are warranted because native host decisions and renderer-local modal interactions have different owners and runtime constraints; both replace multiple shallow conventions with a single deep interface in their domain.
