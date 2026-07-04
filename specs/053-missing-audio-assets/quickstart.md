# Quickstart: Missing Audio Asset Check On Project Load

**Feature**: Missing Audio Asset Check On Project Load
**Branch**: `053-missing-audio-assets`
**Created**: 2026-07-02

## Prerequisites

- Work from `/Users/stevenyi/work/blue-electron` on branch `053-missing-audio-assets`.
- Use a `.blue` project containing AudioFile score objects.
- Prepare at least one existing audio file to use as a replacement.

## Automated Validation

Run focused tests during implementation:

```bash
pnpm --filter @blue/app test -- missing-audio-assets
pnpm --filter @blue/app test -- use-ipc-listeners
```

Run package and workspace checks before completion:

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
pnpm -r run test
```

## Close-Out Validation

Completed on 2026-07-04:

- `pnpm --filter @blue/app test -- missing-audio-assets.test.ts missing-audio-assets-modal.test.ts project-store.test.ts use-ipc-listeners.test.ts` passed; Vitest ran the app suite with 142 test files, 1473 passing tests, and 2 skipped tests.
- `pnpm --filter @blue/app build` passed; Vite reported the existing chunk-size warning.
- `pnpm -r run test` passed across `@blue/app`, `@blue/data`, `@blue/engine-client`, `@blue/cli`, and `@blue/java`.

Spec Kit final analysis found no blocking cross-artifact issues: all FR/SC items have task coverage, the requirements checklist is complete, and the plan remains aligned with the project constitution.

## Manual Scenario 1: No Missing AudioFiles

1. Open a project whose AudioFile score-object paths all resolve relative to the project directory, as absolute paths, or through `SFDIR`.
2. Verify the workbench opens normally.
3. Verify no "Locate Missing Audio Files" modal appears.

Expected result: the project opens and no AudioFile path changes.

## Manual Scenario 2: Missing Paths Are Listed Once

1. Open a project with two AudioFile score objects that reference the same missing path.
2. Verify the project becomes active.
3. Verify the missing-file modal appears.
4. Verify the original missing path appears once in the table.

Expected result: duplicate AudioFile references produce one modal row.

## Manual Scenario 3: Successful Partial Resolution

1. Open a project with two different missing AudioFile paths.
2. Browse for a replacement for only one missing row.
3. Confirm the modal.
4. Inspect the affected AudioFile score objects or save and reopen the project.

Expected result: every AudioFile with the mapped original path uses the chosen replacement; the unmapped original path remains unchanged; the project remains open.

## Manual Scenario 4: Project-Relative Normalization

1. Open a project with a missing AudioFile path.
2. Choose a replacement file inside the same project directory.
3. Confirm the modal.
4. Save and reopen the project.

Expected result: the saved AudioFile path is relative to the project directory.

## Manual Scenario 5: Cancel And Close Are No-Ops

1. Open a project with at least one missing AudioFile path.
2. Choose a replacement in the modal.
3. Cancel or close the modal instead of confirming.
4. Inspect the project or reopen the modal by reloading the project.

Expected result: no AudioFile paths changed and the project remains open.

## Manual Scenario 6: OK With No Mappings Is A No-Op

1. Open a project with missing AudioFile paths.
2. Do not choose any replacement files.
3. Confirm the modal.

Expected result: no AudioFile paths changed, no second prompt appears, and the project remains open.
