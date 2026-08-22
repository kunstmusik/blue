# Code Repository Quickstart Validation

This guide validates the feature after implementation. It intentionally checks both the portable
codec boundary and the Electron main/preload/renderer workflow.

## Prerequisites

- Node and pnpm versions used by the repository.
- A clean or intentionally preserved worktree on branch `069-code-repository`.
- The repository's existing test dependencies installed.
- A disposable Electron user-data directory for migration and failure tests.

## Automated validation

Run the focused data tests:

```bash
pnpm --filter @blue/data test
```

Run the focused application tests:

```bash
pnpm --filter @blue/app test
```

Run the repository-wide checks required by the project:

```bash
pnpm test
pnpm lint
```

Build the affected application packages when main/preload/renderer contracts change:

```bash
pnpm --filter @blue/data build
pnpm --filter @blue/app build
```

Focused automated coverage must include:

1. Java XML parse/serialize fixtures, including exact snippet whitespace and nested mixed-order
   children.
2. Database schema initialization, CRUD, ordering, cycle rejection, rollback, restart, and
   optimistic revision conflicts.
3. Migration idempotency, empty first-run initialization, malformed-source preservation, explicit import, and
   Java-compatible export.
4. Typed IPC success/failure responses and change events.
5. Tools-menu dialog, Save/Cancel, nested tree editing, and dirty-conflict behavior.
6. Csound context-menu insertion, selection replacement, empty-selection disabling, and repository
   refresh.
7. Java-style Code Repository tree context actions for the root, groups, and snippets, plus an
   explicit migration-retry action from the open editor dialog.

## Manual migration scenario

1. Create a disposable user-data directory and place a valid Java-compatible
   `~/.blue/codeRepository.xml` containing nested groups, duplicate names, tabs, newlines, and
   Unicode text.
2. Launch Blue with that user-data directory.
3. Open Tools → Code Repository Editor.
4. Verify every supported XML node, order, name, and snippet text.
5. Verify the source XML has not been modified.
6. Restart Blue and verify no duplicate nodes appear.
7. Edit, move, delete, and add a snippet; save; restart; verify persistence.

For a disposable profile with no legacy `codeRepository.xml`, verify that first launch creates an
empty protected root and does not require a packaged repository XML resource.

Right-click the repository root and a group to verify Add Group/Add Code Snippet (and Remove Group
only for non-root groups). Right-click a snippet to verify Remove Code Snippet. These actions replace
the old always-visible tree buttons.

## Manual editor scenario

1. Open a project with a Csound editor.
2. Select a region of code and open the context menu.
3. Choose Add to Code Repository, create a nested destination if needed, and save.
4. Reopen the context menu and choose the new Custom submenu item.
5. Verify the stored code replaces the selected editor text exactly.
6. Open the repository editor in another window, save a change, and verify the next context menu
   reflects it.

## Failure and recovery scenario

1. Point migration at malformed XML or make the repository database unavailable in a disposable
   profile.
2. Launch Blue and open the repository editor.
3. Verify a diagnostic is shown and no project or unified-library operation is blocked.
4. Use Retry Migration in the open editor dialog; if the source still cannot be read, use Recover
   from XML… or Import… with a valid XML source.
5. Verify the repository becomes available without deleting the original failed source.

## Expected result

All repository tests, builds, lint, and package-input checks pass; the manual scenarios preserve
the source and project boundaries. The packaged-app launch smoke exception recorded below is
environment-scoped and does not affect the directory package or repository behavior.

## Recorded convergence validation (2026-08-10)

Focused automation covers Java-compatible XML import/export, malformed and unreadable source
diagnostics, atomic migration/import provenance, explicit retry/recovery, optimistic-conflict
reload behavior, runtime preload response guards, rendered inline rename and live Csound menu
enablement, and standalone editor repository initialization.

The deterministic 500-node editor and Custom-menu fixtures both passed their one-second
responsiveness thresholds. The final command log is recorded in the task checklist: the data suite
passed with 1,491 tests, the application suite passed with 2,722 tests and 2 skips, the full
workspace test/lint/build checks passed, and package-input verification passed. A directory
package was built and its resources contain no Code Repository seed XML. The optional packaged-app
launch smoke driver could not obtain its success marker on this macOS session because the packaged
binary exited with code 134 before verification; metadata/resource/package-directory validation
completed successfully.
