# Quickstart: Verify Confirmation Dialog Normalization

Run from the repository root.

Prerequisites: install the repository dependencies with the checked-in pnpm version and use a desktop session capable of launching Electron for the manual matrix. The focused unit/build commands do not require launching the application.

## Automated verification

```sh
pnpm lint
pnpm --filter @blue/app test -- src/main/native-confirmation.test.ts src/renderer/tests/confirmation-dialog.test.tsx
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
git diff --check
```

The scoped lint step must report no production `confirm`, `prompt`, or `alert` use and no direct Electron message-box use outside the native adapter. Any intentional inline disable must include its rationale and match an entry in `docs/confirmation-dialogs.md`.

## Manual Electron smoke matrix

1. Trigger a native decision from the main workbench, a floating/secondary window, and Settings. Confirm the dialog belongs to the initiating window and the renderer stays responsive.
2. For C1-C7, exercise explicit Cancel, Escape/close dismissal, and acceptance. Confirm cancellation makes no change and acceptance mutates exactly once.
3. Exercise stale-target handling with a project SoundObject deletion: open Project SoundObjects, choose Delete for a linked item such as `Shared Motif`, and leave `Delete “Shared Motif”?` open. Before choosing Delete, change or remove that item from another project window (or otherwise invalidate the selected revision/preview). Accept the dialog and verify that no deletion or linked-instance mutation occurs. Repeat with `Delete Layer Group?` or `Convert to ObjectBuilder?` after invalidating its selected target.
4. Exercise these concrete native flows and verify their existing action order and outcomes:
   - Edit a project, choose File > Open Project, and test Save, Don’t Save, and Cancel in the project-replacement dialog.
   - Change a setting, close Settings, and test save/discard/cancel in the unsaved-settings dialog.
   - Edit a library item, close its editor, and test save/discard/cancel while retaining the draft on Cancel.
   - Export or save to an existing file and test the overwrite dialog; cancel must leave the existing file unchanged.
   - Import a library with an existing item and exercise the import-mode choices, including Cancel.
   - Trigger an engine recovery path and exercise Restart, Diagnostics, and Cancel.
5. Use `Delete “Shared Motif”?` (or `Delete Folder “…”?` in the BSB preset manager) as the destructive-dialog keyboard check. Confirm Cancel is initially focused; pressing Enter cancels with no mutation; Tab and Shift+Tab remain inside the modal; Escape cancels; and focus returns to the invoking row/menu control. Reopen it and click the destructive action once, then verify exactly one deletion.
6. Exercise these rich-dialog examples:
   - Project SoundObjects: use an item with linked score instances and verify the dialog includes the linked-instance count and distinct Cancel/Delete actions.
   - Score layer removal: select layers that would leave an empty group, invoke Remove Layers, and exercise both states of `Delete empty Layer Groups`; accepting must match the checkbox state.
   - Library session conflict: edit an item, change it elsewhere, and verify `Library item changed` offers Reload latest, Overwrite latest, and Cancel. Also exercise `Library item missing`, where Cancel/Dismiss leaves the draft safe.
7. In a BSB instrument, open the `Presets` menu and choose `Add Preset`. Verify the in-app `Add Preset` dialog has a `Preset Name` field; enter `Bright Pluck`, submit with Add or Enter, and verify one preset is added. Repeat `Add Folder` with `Textures`. Reopen each dialog and test Cancel/Escape plus blank or whitespace-only input (Add must remain unavailable and no patch is emitted). Confirm no browser prompt appears.
8. Open Tools and confirm Blue Share is visible but disabled and no placeholder alert path can be invoked.

## Documentation check

Verify `docs/confirmation-dialogs.md` contains the final inventory, surface/owner decision table, semantic action/default/cancel behavior, focus and stale-state rules, any exception rationale, and links to current verification commands. Confirm root `AGENTS.md` points maintainers to that document.
