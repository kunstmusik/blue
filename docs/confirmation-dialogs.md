# Confirmation Dialogs Guide and Policy

This document is the canonical design and architecture authority for confirmation dialogs, modal decisions, and decision prompts in Blue.

## 1. Core Principles & Ownership Boundaries

Blue distinguishes between two primary confirmation surfaces based on workflow ownership:

1. **Host-Owned Confirmations (Native Adapter)**
   - **Owner**: Electron Main process (`packages/blue-app/src/main/native-confirmation.ts`).
   - **Scope**: Lifecycle events (window close, application quit, project replacement), filesystem/storage operations (CSD export, library export, database creation/reset, file overwrite), and process recovery (engine crash/restart).
   - **Execution**: Asynchronous native message boxes via Electron `dialog.showMessageBox`, bound to the initiating `BrowserWindow`. Never synchronous (`showMessageBoxSync`).
   - **Renderer Access**: Reached exclusively through typed, serializable IPC (`NATIVE_CONFIRMATION_CHANNEL` in `packages/blue-app/src/shared/confirmation-dialog.ts`). The main process derives window ownership from `event.sender` (never renderer-supplied window IDs).

2. **Renderer-Local Confirmations (In-App Modal)**
   - **Owner**: Renderer React component (`packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx`).
   - **Scope**: Document-local operations (discarding dirty code repository changes, deleting sound objects or presets from project library, deleting score layers or layer groups, converting score objects to Object Builder).
   - **Execution**: Accessible in-app modal overlay with keyboard focus trapping, safe initial focus, and focus restoration.
   - **Content**: Composable children for rich previews (e.g. affected instance count, checkbox options).

### Canonical Mutation Ownership & Transient State

- **Transient Only**: Confirmation requests, decisions, pending target tokens, and modal open states are strictly transient in-memory state. They are **never** serialized into `.blue` project XML, generated CSD text, user settings, or SQLite library databases.
- **Affirmative Mutation**: The confirmation surface only returns a semantic decision action ID. The invoking store, component, or main-process controller owns the mutation and performs the actual update only upon verified acceptance.
- **Stale Target Protection**: For asynchronous decisions where underlying data may change while the dialog is open, the caller captures the target/token before opening the dialog and revalidates it immediately after acceptance before executing the mutation.

---

## 2. Classification Decision Table

| Decision Scenario                        | Surface | Initiating Owner            | Safe Cancellation Default        |
| ---------------------------------------- | ------- | --------------------------- | -------------------------------- |
| Project replacement (unsaved project)    | Native  | Main / Workbench Window     | Cancel (do not replace project)  |
| Revert project to last saved version     | Native  | Main / Workbench Window     | Cancel (do not revert)           |
| Settings close with dirty settings       | Native  | Settings Window             | Cancel (keep Settings open)      |
| Unsaved library editors on close         | Native  | Main / Workbench Window     | Cancel (keep editors open)       |
| CSD / ORC-SCO import mode selection      | Native  | Main / Workbench Window     | Cancel (abort import)            |
| Frozen audio file overwrite              | Native  | Main / Workbench Window     | Cancel (do not overwrite)        |
| Library export review / overwrite        | Native  | Workbench / Floating Window | Cancel (abort export)            |
| Engine recovery & diagnostics            | Native  | Main / Workbench Window     | Cancel (remain in current state) |
| Linked SoundObject cut from library (C1) | Native  | Workbench / Floating Window | Cancel (do not cut)              |
| Create fresh Libraries database (C2)     | Native  | Workbench / Floating Window | Cancel (do not reset database)   |
| Code Repository dirty close (C3)         | In-App  | Code Repository Dialog      | Cancel (keep editing)            |
| BSB Preset / Folder deletion (C4)        | In-App  | Presets Manager Dialog      | Cancel (do not delete)           |
| Project SoundObject deletion (C5)        | In-App  | Sound Object Library Panel  | Cancel (do not delete)           |
| Layer Group deletion (C6)                | In-App  | Score Manager Dialog        | Cancel (do not delete)           |
| Convert to Object Builder (C7)           | In-App  | Score Time Canvas           | Cancel (do not convert)          |

---

## 3. Semantic Action Contracts & Fallback Behavior

Callers declare semantic action IDs (e.g., `proceed`, `discard`, `save`, `cancel`, `restart`, `export`) rather than integer button indexes.

- **Unique IDs**: Every declared action within a request must have a unique `id`.
- **Explicit Default & Cancel**: Every request must explicitly define `defaultActionId` and `cancelActionId` referencing declared action IDs.
- **Fail-Closed Safety**: Any dismissal (Escape key, window close button, backdrop click), owner loss (initiating window closed), or system error resolves deterministically to `cancelActionId` with the corresponding outcome (`dismissed`, `owner-unavailable`, or `failed`).

---

## 4. Accessibility and Focus Rules for In-App Modals

1. **Role & Modality**: Rendered with `role="dialog"` or `role="alertdialog"` and `aria-modal="true"`.
2. **Accessible Name & Description**: Linked via `aria-labelledby` and `aria-describedby` to the dialog title and description.
3. **Safe Destructive Initial Focus**: When any action is marked with `intent: 'destructive'`, focus defaults to the `cancel` action so accidental `Enter` key presses do not trigger destructive operations.
4. **Focus Trap & Traversal**: Tab and Shift+Tab cycle within the modal.
5. **Focus Restoration**: Upon closing, focus is restored to the opener element that triggered the dialog.
6. **Single Decision Delivery**: An internal resolved guard ensures `onDecision` is fired at most once per opening lifecycle.

---

## 5. Browser Modal Policy

- Use inline or modal React text inputs with validation for naming and other input prompts.
- Disable unavailable commands in their owning menu or control. Use the appropriate native or in-app surface for actionable acknowledgements.
- [The Vite+ lint configuration](../vite.config.mts) and
  [Blue's Oxlint rules](../scripts/blue-lint-plugin.mjs) enforce this policy.
  They reject bare browser dialog globals and access to `confirm`, `prompt`,
  or `alert` through `window` or `globalThis` in production app code.
  Use `showNativeConfirmation` for Electron message boxes outside the native
  adapter. Test files and the documented fixture, generated, and user-content
  directories are excluded. Unused Oxlint and ESLint suppression directives
  are errors. Document the reason for any inline exception beside the
  directive and add it to the inventory below.

---

## 6. Java Parity References

- `blue/ui/core/score/object/actions/ConvertToObjectBuilderAction.java`: Warns that conversion cannot be undone and applies changes only upon explicit confirmation.
- `blue/ui/core/score/manager/ScoreManagerDialog.java`: Requires confirmation before deleting layer groups.
- `blue/ui/core/score/layers/soundObject/library/SoundObjectLibraryTopComponent.java`: Warns that deleting a library SoundObject removes its associated usages/instances.

---

## 7. Audited Inventory and Per-Flow Verification

This is the maintained inventory for the current implementation. Each row links to the owning code and its focused automated verification; the [manual Electron smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix) covers owner loss, native window presentation, and visual focus behavior that unit tests cannot fully exercise.

| Flow                                                      | Surface and owner                      | Implementation                                                                                                                                                                                                                                                         | Verification                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Csound error acknowledgement + disable checkbox           | Native / main window                   | [`showCsoundErrorWarning`](../packages/blue-app/src/main/main.ts), [`native-confirmation.ts`](../packages/blue-app/src/main/native-confirmation.ts)                                                                                                                    | [`native-confirmation.test.ts`](../packages/blue-app/src/main/native-confirmation.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                                     |
| Render-in-progress acknowledgement                        | Native / main window                   | [`canReplaceProjectWhileRenderActive`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                          | [`project-replacement-flow.test.ts`](../packages/blue-app/src/main/project-replacement-flow.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                           |
| Unsaved project replacement / quit save decision          | Native / main window                   | [`confirmSaveBeforeReplace`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                                    | [`project-replacement-flow.test.ts`](../packages/blue-app/src/main/project-replacement-flow.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                           |
| Revert project confirmation                               | Native / main window                   | [`confirmRevertProject`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                                        | [`project-replacement-entry-points.test.ts`](../packages/blue-app/src/main/project-replacement-entry-points.test.ts)                                                                                                                                   |
| Unsaved Library editors on close, quit, or project switch | Native / main window                   | [`confirmLibraryDraftTransition`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                               | [`editor-session-service.test.ts`](../packages/blue-app/src/main/unified-library/editor-session-service.test.ts), [`library-editing.test.tsx`](../packages/blue-app/src/renderer/tests/library-editing.test.tsx)                                       |
| CSD import mode                                           | Native / main window                   | [`importCsdFile`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                                               | [`project-replacement-flow.test.ts`](../packages/blue-app/src/main/project-replacement-flow.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                           |
| ORC/SCO import mode                                       | Native / main window                   | [`importOrcSco`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                                                | [`project-replacement-flow.test.ts`](../packages/blue-app/src/main/project-replacement-flow.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                           |
| Settings close with unsaved settings                      | Native / settings window               | [`SETTINGS_CONFIRM_CLOSE_CHANNEL`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                              | [`settings-window.test.tsx`](../packages/blue-app/src/renderer/tests/settings-window.test.tsx), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                                 |
| Frozen audio Save Copy overwrite                          | Native / invoking workbench window     | [`save-frozen-sound-object-copy`](../packages/blue-app/src/main/main.ts)                                                                                                                                                                                               | [`score-object-file-operations.test.ts`](../packages/blue-app/src/main/score-object-file-operations.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                   |
| Current library export review / overwrite                 | Native / invoking workbench window     | [`UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL`](../packages/blue-app/src/main/unified-library/ipc.ts)                                                                                                                                                                       | [`export-compatibility.test.ts`](../packages/blue-app/src/main/unified-library/export-compatibility.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                   |
| Export all libraries review / overwrite                   | Native / invoking workbench window     | [`UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL`](../packages/blue-app/src/main/unified-library/ipc.ts)                                                                                                                                                                           | [`export-compatibility.test.ts`](../packages/blue-app/src/main/unified-library/export-compatibility.test.ts), [smoke matrix](../specs/083-normalize-confirmation-dialogs/quickstart.md#manual-electron-smoke-matrix)                                   |
| Engine recovery and diagnostics                           | Native / main or recovery window       | [`engine-recovery-dialog.ts`](../packages/blue-app/src/main/engine-recovery-dialog.ts)                                                                                                                                                                                 | [`engine-recovery-dialog.test.ts`](../packages/blue-app/src/main/engine-recovery-dialog.test.ts), [`engine-recovery.test.tsx`](../packages/blue-app/src/renderer/tests/engine-recovery.test.tsx)                                                       |
| C1 linked SoundObject cut                                 | Native / renderer request through main | [`library-store.ts`](../packages/blue-app/src/renderer/stores/library-store.ts)                                                                                                                                                                                        | [`library-store.test.ts`](../packages/blue-app/src/renderer/tests/library-store.test.ts)                                                                                                                                                               |
| C2 create fresh Libraries database                        | Native / renderer request through main | [`library-store.ts`](../packages/blue-app/src/renderer/stores/library-store.ts)                                                                                                                                                                                        | [`library-store.test.ts`](../packages/blue-app/src/renderer/tests/library-store.test.ts)                                                                                                                                                               |
| C3 Code Repository dirty close                            | In-App / Code Repository dialog        | [`CodeRepositoryDialog.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.tsx)                                                                                                                                   | [`CodeRepositoryDialog.test.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx), [`confirmation-dialog.test.tsx`](../packages/blue-app/src/renderer/tests/confirmation-dialog.test.tsx) |
| C4 BSB preset and folder deletion                         | In-App / Presets Manager               | [`PresetsManagerDialog.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx)                                                                                                                                     | [`presets-manager-dialog.test.tsx`](../packages/blue-app/src/renderer/tests/presets-manager-dialog.test.tsx)                                                                                                                                           |
| C5 project SoundObject deletion                           | In-App / project SoundObject panel     | [`SoundObjectLibraryPanel.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/SoundObjectLibraryPanel.tsx)                                                                                                                                             | [`project-sound-object-library.test.tsx`](../packages/blue-app/src/renderer/tests/project-sound-object-library.test.tsx)                                                                                                                               |
| C6 Score Manager layer-group deletion                     | In-App / Score Manager                 | [`ScoreManagerDialog.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx)                                                                                                                                                 | [`score-manager-dialog.test.tsx`](../packages/blue-app/src/renderer/tests/score-manager-dialog.test.tsx)                                                                                                                                               |
| Layer-range and empty-group deletion                      | In-App / score panels                  | [`LayerRemovalConfirmationDialog.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/score/LayerRemovalConfirmationDialog.tsx), [`PatternLayerHeader.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx) | [`score-manager-dialog.test.tsx`](../packages/blue-app/src/renderer/tests/score-manager-dialog.test.tsx), [`score-time-canvas-cross-group.test.tsx`](../packages/blue-app/src/renderer/tests/score-time-canvas-cross-group.test.tsx)                   |
| C7 convert score object to Object Builder                 | In-App / Score Time Canvas             | [`ScoreTimeCanvas.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx)                                                                                                                                          | [`score-time-canvas-cross-group.test.tsx`](../packages/blue-app/src/renderer/tests/score-time-canvas-cross-group.test.tsx)                                                                                                                             |
| Library session conflict and missing item                 | In-App / library editor session        | [`LibrarySessionDialog.tsx`](../packages/blue-app/src/renderer/components/libraries/LibrarySessionDialog.tsx), [`LibraryItemEditorPanel.tsx`](../packages/blue-app/src/renderer/components/libraries/LibraryItemEditorPanel.tsx)                                       | [`library-editing.test.tsx`](../packages/blue-app/src/renderer/tests/library-editing.test.tsx)                                                                                                                                                         |
| User-library item/folder deletion                         | In-App / Libraries panel               | [`LibrariesPanel.tsx`](../packages/blue-app/src/renderer/components/workbench/panels/LibrariesPanel.tsx)                                                                                                                                                               | [`libraries-panel.test.tsx`](../packages/blue-app/src/renderer/tests/libraries-panel.test.tsx)                                                                                                                                                         |

The static audit is verified by [`confirmation-dialog-lint.test.mjs`](../scripts/confirmation-dialog-lint.test.mjs). Its production scope is `packages/blue-app/src/**/*.{ts,tsx}`, with `**/fixtures/**`, `**/__fixtures__/**`, `**/generated/**`, and `**/user-content/**` excluded; test globs explicitly allow test assertions/mocks, and `native-confirmation.ts` is the sole direct native message-box adapter exception.

## 8. Verification and Checklist for New Confirmation Flows

When adding or modifying a confirmation dialog:

1. Classify the flow as **Host-Owned** (Native) or **Renderer-Local** (In-App), then add it to the audited inventory above.
2. Choose semantic action IDs with explicit `defaultActionId` and `cancelActionId`.
3. If destructive, ensure the safe/cancel action receives initial focus.
4. If guarding a mutable resource, capture target/token before opening and revalidate immediately before mutation.
5. Add unit tests for acceptance, cancellation, owner loss or IPC failure where applicable, and keyboard/escape dismissal.
6. Ensure no direct bare, `window.*`, or `globalThis.*` browser dialogs or direct `dialog.showMessageBox`/`showMessageBoxSync` calls are added outside the documented adapter boundary.
