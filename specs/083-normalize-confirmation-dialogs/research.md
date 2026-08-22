# Research: Application Confirmation Dialog Normalization

**Date**: 2026-08-21
**Feature**: [spec.md](spec.md)

## Decision 1: Normalize policy, not only `window.confirm()` calls

**Decision**: Consolidate seven production browser confirmations, all existing direct native message-box decisions, and existing in-app confirmation surfaces behind two shared modules.

**Rationale**: The supplied report correctly prefers Electron's asynchronous dialog API over browser confirmation, but a one-for-one replacement would retain inconsistent response-index mapping, owner selection, focus, dismissal, and copy. The current tree has roughly twelve logical direct native message-box flows and three substantial renderer confirmation surfaces in addition to C1-C7.

**Alternatives considered**:

- Replace only C1-C7 with Electron dialogs: rejected because renderer-local rich decisions do not belong in OS message boxes and existing patterns would remain fragmented.
- Render every decision in React: rejected because lifecycle, filesystem, and host-storage operations need a main-owned surface that survives renderer-local state.
- Use only native dialogs: rejected because previews, checkboxes, editor context, and multi-action local workflows need application-owned content and focus.

Official references: [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog), [process model](https://www.electronjs.org/docs/latest/tutorial/process-model), and [IPC guidance](https://www.electronjs.org/docs/latest/tutorial/ipc).

## Decision 2: Use a semantic native contract with an explicit owner

**Decision**: Introduce one validated, serializable request/result contract and one main-process native adapter. Requests identify actions by semantic IDs and declare default/cancel IDs. Renderer IPC derives the owner from `event.sender`; main callers pass an explicit owner. Invalid/destroyed owners and dialog errors return the declared safe cancellation result.

**Rationale**: Existing calls use different button orders and response indexes. Semantic IDs preserve each flow while hiding Electron index mapping. Exact ownership prevents a dialog initiated by a floating/settings window from appearing under an unrelated workbench. Failing closed prevents guarded work from proceeding when a dialog cannot be safely shown.

**Alternatives considered**:

- Return a boolean: rejected because save/discard/cancel, import-mode, recovery, and checkbox flows have more than two outcomes.
- Reuse response indexes throughout callers: rejected because index meaning changes with per-flow button order.
- Fall back to the first open window or an unparented dialog: rejected for guarded decisions because it can misassociate prompts and permit ambiguous continuation.
- Pass a window ID from renderer: rejected because sender-derived ownership is authoritative and requires less privileged input.

## Decision 3: Use one renderer interaction primitive with composable content

**Decision**: Add a shared `ConfirmationDialog` that accepts semantic actions and optional rich children, and extract the existing focus hook into the shared dialogs directory. It owns dialog semantics, focus trap/entry/restoration, Escape, topmost behavior, safe destructive initial focus, and at-most-once decision delivery.

**Rationale**: `LayerRemovalConfirmationDialog`, `LibrarySessionDialog`, and the Libraries deletion preview already prove the need for checkboxes, affected-item details, and three actions. A composable behavior module keeps those local details while removing duplicated keyboard and focus rules.

**Alternatives considered**:

- Make one universal visual dialog with hard-coded title/body/buttons: rejected because it would flatten real workflow differences.
- Copy the existing Blue X7 hook into each surface: rejected because focus/dismissal behavior would continue to diverge.
- Add a new UI framework: rejected because existing React/CSS patterns are sufficient.

## Decision 4: Safe focus is the destructive default

**Decision**: Destructive in-app confirmations initially focus Cancel, so Enter selects Cancel. Any override must be recorded with its flow-specific rationale in `docs/confirmation-dialogs.md`. Native dialogs retain their existing per-flow default/cancel semantics while making them explicit in the contract.

**Rationale**: The clarified product rule favors accidental-activation safety for irreversible renderer actions, while native platform flows already encode different intentional choices such as Save/Don't Save/Cancel.

**Alternatives considered**:

- Always focus the destructive action: rejected as unsafe for keyboard-triggered dialogs.
- Impose safe-first visual order everywhere: rejected because platform conventions and existing multi-action semantics differ; semantic mapping matters more than one universal order.

## Decision 5: Enforce the production ban with scoped ESLint rules

**Decision**: Add a minimal root flat ESLint configuration, backed by `typescript-eslint`, scoped to production `@blue/app` TypeScript/TSX. Reject bare and `window`/`globalThis` `confirm`, `prompt`, and `alert`; reject direct Electron message-box calls outside the native adapter; report unused disable comments. Tests, fixtures, generated output, and user-authored content are excluded. Inline disables require a rationale.

**Rationale**: Text search is useful for audit but does not prevent regression. ESLint selectors can enforce exact source and API boundaries without enabling unrelated style rules across the repository. This follows the official [ESLint restricted globals](https://eslint.org/docs/latest/rules/no-restricted-globals) and [restricted syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax) mechanisms and the [typescript-eslint flat-config setup](https://typescript-eslint.io/getting-started/).

**Alternatives considered**:

- CI grep only: rejected because aliases/syntax variants and exception rationale are harder to govern.
- Enable a full recommended lint preset: rejected because it broadens this feature into unrelated cleanup.
- Rely only on documentation: rejected because FR-003 explicitly requires automated prevention.

## Decision 6: Resolve adjacent browser modal APIs in this feature

**Decision**: Replace the two BSB `window.prompt()` calls with local in-app name-entry state using the existing name-entry pattern. Remove the `show-not-yet-implemented` command, `buildPlaceholderItem`, and `onNotYetImplemented` wiring; retain Tools > Blue Share as `{ label: "Blue Share", enabled: false }` with no alert handler.

**Rationale**: The two prompts and one alert are the remaining audited production browser modal APIs. Their semantics are text entry and unavailable-function indication, not confirmation, so treating them explicitly avoids hidden exceptions.

**Alternatives considered**:

- Replace the alert with a toast: superseded by clarification; a disabled menu item communicates unavailability before activation.
- Keep the prompts under inline lint exemptions: rejected because an existing in-app entry pattern is available.

## Decision 7: Store durable guidance in docs with an AGENTS pointer

**Decision**: Make `docs/confirmation-dialogs.md` the maintainer source of truth and add only a concise cross-cutting pointer in root `AGENTS.md`.

**Rationale**: The policy, inventory, action semantics, exceptions, and test guidance are too detailed and feature-sensitive for AGENTS.md. The pointer ensures coding agents consult the durable document without duplicating it.

**Alternatives considered**:

- Put the full policy in AGENTS.md: rejected because AGENTS is for stable cross-cutting rules and would duplicate evolving inventory.
- Keep guidance only in this spec: rejected because specs are historical feature artifacts, not the everyday maintainer reference.

## Audited production browser modal inventory

| ID | Current location | Classification | Required resolution |
|---|---|---|---|
| C1 | `renderer/stores/library-store.ts` linked SoundObject cut | Host/shared-library | Native contract; preserve preview/token and revalidate before mutation |
| C2 | `renderer/stores/library-store.ts` fresh Libraries DB | Host storage | Native contract; fail closed on cancel/owner loss |
| C3 | `CodeRepositoryDialog.tsx` dirty close | Renderer-local discard | Shared in-app confirmation; preserve draft on cancel |
| C4 | `PresetsManagerDialog.tsx` preset/folder delete | Renderer-local destructive | Shared in-app confirmation with explicit Delete label |
| C5 | `SoundObjectLibraryPanel.tsx` project library delete | Renderer-local rich preview | Shared in-app confirmation; preserve linked-editor safeguards and target validation |
| C6 | `ScoreManagerDialog.tsx` layer-group removal | Renderer-local destructive | Shared in-app confirmation aligned with sibling layer removal |
| C7 | `ScoreTimeCanvas.tsx` ObjectBuilder conversion | Renderer-local non-undoable | Shared in-app confirmation; preserve document mutation boundary |

Adjacent dispositions: `BSBPresetBar.tsx` prompt calls migrate to in-app name entry. The `workbench-store.ts` alert path and its main/shared menu command wiring are removed; Blue Share remains visible and disabled. Embedded example/script `alert` APIs remain user-content compatibility surfaces and are outside the production application lint scope.

## Existing native inventory to consolidate

| Owner/file | Logical flow | Semantics to preserve |
|---|---|---|
| `main.ts` | Csound error warning with checkbox | Warning acknowledgement and checkbox result |
| `main.ts` | Render already in progress | Informational safe acknowledgement |
| `main.ts` | Save changes / project replacement | Save, don't save, cancel mapping |
| `main.ts` | Unsaved library editors | Existing multi-action close mapping |
| `main.ts` | CSD import mode | Existing mode choice/cancel behavior |
| `main.ts` | ORC/SCO import mode | Existing mode choice/cancel behavior |
| `main.ts` | Settings close | Existing save/discard/cancel mapping |
| `main.ts` | File overwrite | Overwrite/cancel and valid owner |
| `main/unified-library/ipc.ts` | Current/all library export review | Cancel/export order and exact IPC sender owner |
| `main/engine-recovery-dialog.ts` | Engine recovery and diagnostics | Recovery action mapping and diagnostics acknowledgement |

No production `showMessageBoxSync` was found. `showErrorBox` is classified as a non-confirmation error-reporting surface and remains outside the confirmation contract unless implementation reveals decision semantics.

## Existing in-app inventory to consolidate

- `LibrariesPanel.tsx`: contextual library deletion preview with affected counts and Save/Discard/Delete choices.
- `LayerRemovalConfirmationDialog.tsx`: destructive score-layer confirmation with optional checkbox.
- `LibrarySessionDialog.tsx`: multi-action library-session alert dialog.
- `use-dialog-focus.ts`: currently Blue X7-local but already reused by Render/Freeze surfaces; relocate to a shared dialogs seam and update imports.

Other renderer dialogs are classified by semantics. Text-entry, transfer, import, and informational dialogs are not forced into the confirmation module merely because they are modal.

## Java parity evidence

- `blue/ui/core/score/object/actions/ConvertToObjectBuilderAction.java` warns that conversion cannot be undone and mutates only after OK.
- `blue/ui/core/score/manager/ScoreManagerDialog.java` requires confirmation before deleting layer groups.
- `blue/ui/core/score/layers/soundObject/library/SoundObjectLibraryTopComponent.java` warns that removing a library SoundObject removes its instances and mutates only on Yes.

The TypeScript UI may use explicit action labels and safer focus, but must preserve these consequences and affirmative-only mutation semantics.
