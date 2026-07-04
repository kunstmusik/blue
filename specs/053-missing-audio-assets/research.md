# Missing Audio Asset Check: Java Blue Reference Review

**Created**: 2026-07-02
**Scope**: Java Blue behavior for checking missing audio files during project open and resolving them through the dependency dialog.

## Java Sources Reviewed

- `/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenProjectAction.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/actions/OpenExampleProjectAction.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/AudioFileDependencyDialog.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-projects/src/main/java/blue/projects/BlueProjectManager.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/BlueSystem.java`
- `/Users/stevenyi/work/nbprojects/blue/ChangeLog.md`

## Observed Java Blue Behavior

### Project open sequence

- `OpenProjectAction.open()` and `OpenExampleProjectAction.open()` load the `.blue` XML, create a `BlueProject`, set it as the current project, add the project to recent projects when appropriate, and then call `checkDependencies(tempData)`.
- `BlueProjectManager.setCurrentProject()` sets the current BlueData and current project directory before dependency checking runs.
- Because the project is already current before dependency checking, dismissing the missing-file dialog never aborts the open project.
- If an open-project action selects a project that is already open, Java Blue only switches the current project and does not run the dependency check for that selection.

### Missing file discovery

- Java Blue scans the score's layer groups, only processing groups that are `PolyObject` instances.
- It visits `AudioFile` sound objects from those score contents, including nested score contents, and reads each `AudioFile.getSoundFileName()`.
- A null sound file name is skipped.
- A path is considered found when `BlueSystem.findFile(path)` returns a file.
- `BlueSystem.findFile()` checks the current project directory plus the stored path, then the stored path as an absolute or directly usable path, then `SFDIR` for paths that do not contain a file separator.
- Missing paths are collected as unique original strings. Duplicate references to the same missing string produce one dialog row.

### Dependency dialog

- The dialog title is `Audio File Dependencies`; the banner title is `Locate Missing Audio Files`.
- The modal displays a two-column table: `Original File` and `New File`.
- Double-clicking a row opens a file chooser titled `Choose Replacement File`.
- Choosing a replacement stores the selected file path in that row's `New File` value.

### Successful dismissal

- When `dependencyDialog.ask()` returns success, Java Blue reads `dependencyDialog.getFilesMap()`.
- The map includes only rows whose replacement value is non-empty and different from the original value.
- If the map is null or empty, Java Blue returns without changing any project paths.
- Each mapped replacement value is passed through `BlueSystem.getRelativePath()`.
- `getRelativePath()` returns the original path when no current project directory is available, converts child paths under the current project directory to project-relative paths, and otherwise returns the chosen path unchanged.
- Java Blue then walks the same score contents and updates every `AudioFile` whose current path exactly matches a mapped original path.
- Java Blue accepts partial resolution. Unmapped rows remain unchanged, and there is no second prompt or all-files-resolved validation.

### Cancel or close dismissal

- When `dependencyDialog.ask()` does not return success, Java Blue performs no reconciliation.
- All existing AudioFile paths remain unchanged.
- The project remains open and current because the open operation already completed before the dialog was shown.

### Historical note

- `ChangeLog.md` entry `0.101.00` describes the feature as an AudioFile dependency check on file open, with replacement files selected by double-clicking rows in the dialog.

## Parity Conclusions For The Spec

- The Electron port should match Java Blue's AudioFile-only dependency scope unless a later feature explicitly broadens asset checking.
- Resolution should be a post-load project repair opportunity, not a gate that can cancel project opening.
- Successful dismissal with no mappings and cancel dismissal are both no-op path changes, but they are distinct user outcomes.
- Successful partial resolution should update only mapped original paths and leave unresolved paths untouched.
- Replacement path normalization should mirror Java Blue's project-relative conversion rules.

## Phase 0 Planning Decisions

### Decision: Keep the implementation scope AudioFile-only

**Rationale**: Java Blue's project-open dependency check scans `AudioFile` score objects from `PolyObject` score contents and does not include BSB file selectors, AudioClip media, external score scripts, frozen render files, or generated CSD artifacts. Matching that scope is the highest-value parity target and avoids silently changing unrelated asset workflows.

**Alternatives considered**: A generalized asset registry was rejected for this slice because it would expand behavior beyond Java Blue and require new contracts for unrelated file-owning models.

### Decision: Run the check after load and current-project assignment

**Rationale**: Java Blue sets the loaded project current before showing the dependency dialog. This means success, partial success, cancel, and close all leave the project open. Electron should preserve that behavior by sending the normal project-loaded snapshot first, then presenting the optional missing-assets repair session.

**Alternatives considered**: Blocking project opening until all missing files are resolved was rejected because it contradicts Java Blue and would make cancel semantics destructive.

### Decision: Put filesystem resolution and mutation orchestration in Electron main

**Rationale**: `@blue/data` must stay free of Node built-ins. Electron main already owns file loading, current project path, native file dialogs, and canonical `BlueData`, so it can safely check `fs` existence, normalize paths, mutate AudioFile references, and return refreshed snapshots.

**Alternatives considered**: Implementing file existence checks in `@blue/data` was rejected by the constitution. Doing all work in the renderer was rejected because the renderer should not receive arbitrary filesystem probing responsibilities.

### Decision: Use a renderer modal with typed IPC instead of a native Electron message box

**Rationale**: Java Blue's dialog is a two-column table with per-row replacement selection. Electron's built-in message boxes cannot model that interaction. A React modal can match the workflow while delegating file picking to Electron main through a small IPC contract.

**Alternatives considered**: A custom child `BrowserWindow` was rejected as unnecessary because the existing app already uses in-shell renderer modals for richer interactions.

### Decision: Refresh the renderer snapshot after confirmed mappings

**Rationale**: The canonical project data lives in Electron main. After mappings mutate AudioFile paths, the renderer needs a refreshed snapshot so score bars, object editors, and project state agree with the in-memory project. No-op success and cancel do not need a snapshot refresh.

**Alternatives considered**: Applying many score-object editor patches from the renderer was rejected because the modal operates on original path mappings, not individual editor targets, and Java Blue updates every exact match in one reconciliation pass.
