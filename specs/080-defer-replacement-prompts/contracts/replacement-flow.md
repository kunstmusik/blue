# Replacement Flow Contract

This is an internal main-process contract between interactive entry points and the
canonical project replacement lifecycle. It is not a new renderer or public IPC API.

## Implementation references

- Coordinator and policies: `packages/blue-app/src/main/project-replacement-flow.ts`
  (`runReplacementFlow`, `runProjectFileReplacement`, `resolveReplacementSaveDecision`,
  `runTransactionalSaveAs`).
- Path identity: `packages/blue-app/src/main/project-path.ts`
  (`canonicalProjectPathIdentity`, `isSameProjectPathIdentity`).
- Host wiring: `packages/blue-app/src/main/main.ts` (`openProjectFile` accepted-target
  wrapper, `readProjectFromDisk`/`installProjectData` split, `confirmSaveBeforeReplace`,
  `writeProjectToDisk`/`doSave`, `saveFileAs`, `loadProjectFromDisk` non-interactive path).
- Regression matrix: `packages/blue-app/src/main/project-replacement-flow.test.ts` and
  `packages/blue-app/src/main/project-path.test.ts`.

## Coordinator shape

The planned project-replacement-flow module accepts dependency-injected callbacks with
these responsibilities:

~~~
runReplacementFlow({
  preflight,
  prepare,
  isNoOp,
  confirmSave,
  confirmLibraryDraft,
  commit,
})
~~~

Contract:

1. Call preflight before prepare. A false result returns cancelled and prepare is not
   called.
2. Call prepare to collect every chooser/configuration decision and validate the
   selected source. A null result returns cancelled and no confirmation callback is
   called.
3. Call isNoOp for project-file targets after preparation. A true result returns
   no-op and no confirmation or commit callback is called.
4. Call preflight again after preparation and before confirmation. A false result
   returns cancelled and commit is not called.
5. Call confirmSave and then confirmLibraryDraft for an accepted target. A false
   result from either callback returns blocked/cancelled and commit is not called.
6. Call commit exactly once only after all preceding stages succeed.
7. A thrown preparation error is handled by the caller's existing load/import error
   dialog and does not enter confirmation or commit.

The coordinator does not mutate currentData, currentFilePath, editor windows, runtime
sessions, library state, or MIDI pending state.

## Entry-path mapping

| User action | Preparation boundary | Replacement owner |
| --- | --- | --- |
| Native Open Project | Open chooser, read/parse selected .blue | main.ts openFile → openProjectFile |
| Keyboard/preload Open Project | open-file IPC delegates to the same openFile | main.ts openFile → openProjectFile |
| Recent project | Use supplied path, read/parse before prompts | main.ts openFilePath → openProjectFile |
| Open Example Project | Example chooser, read/parse selected .blue | main.ts openExampleProject → openProjectFile |
| Import CSD | CSD chooser, mode dialog, read/convert | main.ts importCsdFile (runReplacementFlow) |
| Import ORC/SCO | ORC chooser, SCO chooser, mode dialog, read/convert | main.ts importOrcSco (runReplacementFlow) |
| Import MIDI | MIDI chooser, mapping dialog, token validation, project build | main.ts commit-midi-import (runReplacementFlow) |
| New/Close/Revert/Quit | No source chooser; preserve existing immediate policy | existing main.ts handlers (new-file IPC routes through handleNewFile) |

## Cancellation and failure contract

- Chooser cancellation, mode cancellation, invalid source, and import preparation
  failure do not show project-save or library-draft dialogs.
- Save/Save As must return a definite success result for replacement. Cancellation,
  overwrite decline, and write failure block replacement.
- The accepted target remains disposable until commit; it must not replace the current
  document early.
- A cancelled MIDI replacement decision leaves the pending mapping session available
  to the renderer, subject to the existing session-token rules.
- Internal loadProjectFromDisk and packaged verification paths remain non-interactive.

## Path identity contract

project-path.ts exposes a reusable canonical identity helper for same-file comparison:

- input and output are host-path identity values, not embedded Csound or serialized text;
- resolve and normalize use the platform path implementation;
- Windows identity folds case and accepts equivalent slash forms;
- POSIX identity preserves case;
- the helper does not perform file I/O or realpath resolution;
- the native path passed to fs and BlueData loading remains the original host path.
