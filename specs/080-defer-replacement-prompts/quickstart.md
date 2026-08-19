# Quickstart: Deferred Project-Replacement Save Prompts

## Prerequisites

- Work from branch 080-defer-replacement-prompts.
- Install workspace dependencies with pnpm.
- Have a valid .blue project with an unsaved edit, a second .blue project, a CSD
  fixture, an ORC/SCO pair, and a MIDI file available to the desktop app.

## Automated validation

Run the focused flow and path tests first:

~~~
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/project-path.test.ts \
  src/main/project-replacement-flow.test.ts \
  src/main/midi-import-service.test.ts \
  src/renderer/tests/app.test.ts \
  src/renderer/tests/welcome-screen.test.tsx
~~~

Then run the affected package checks:

~~~
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm lint
git diff --check
~~~

Expected result: all focused and package tests pass, the main build succeeds, and
there are no whitespace errors.

### Validation record (2026-08-18, branch 080-defer-replacement-prompts)

- Focused set: 5 files, 133 passed (project-path 10, project-replacement-flow 69,
  midi-import-service 8, app.test 41+2 skipped, welcome-screen 5).
- `pnpm --filter @blue/app test`: 342 files, 3358 passed, 2 skipped.
- `pnpm --filter @blue/app build:main`: clean.
- `pnpm test` (full repository, includes @blue/data 1626 tests and native
  blue-engine ctest): exit 0.
- `pnpm lint`: exit 0.
- `git diff --check`: clean.
- `@blue/data` compatibility fixtures (`blue-data-csd-parity.test.ts`,
  `blue-data-root-compatibility.test.ts`): 26 passed, unchanged.

The manual native-dialog matrix below still requires a desktop run; the automated
matrix in `src/main/project-replacement-flow.test.ts` covers the equivalent
entry-path x decision-branch outcomes with injected choosers and dialogs.

## Manual native-dialog validation

With a project open and an unsaved edit, exercise each row. Record the order of
dialogs, whether the current project changed, and whether a project-loaded event was
emitted.

| Scenario | Action | Expected result |
| --- | --- | --- |
| Open cancel | Native Open Project, cancel chooser | No save/library prompt; current project unchanged |
| Open accepted | Select a different .blue | Save/library decisions occur after selection and before replacement |
| Same file | Select the current .blue through a different path spelling | No save/library prompt, reload, dependency scan, or project-loaded event |
| Recent/example | Select a recent or example project | Same accepted-target behavior as Open Project |
| CSD cancel | Cancel CSD chooser or import mode | No replacement prompt; current project unchanged |
| ORC/SCO cancel | Cancel ORC chooser, SCO chooser, or mode | No replacement prompt; current project unchanged |
| MIDI cancel | Cancel MIDI chooser or mapping | No replacement prompt; current project unchanged |
| Replacement cancel | Accept a source, choose Cancel in replacement dialog | Current project unchanged; MIDI mapping remains available |
| Save As cancel | Choose Save with an unsaved current project, cancel Save As | Replacement blocked; current path and project remain recoverable |
| Save failure | Inject or simulate a write failure | Replacement blocked; no project-loaded transition |
| Render active | Start a render, invoke each chooser-based action | Render warning appears before chooser; no chooser or replacement |

Finally verify New Project, Close Project, Revert, and Quit still use their existing
immediate confirmation behavior and that a successful imported project remains unsaved
where it did before.

## References

- Data and state definitions: specs/080-defer-replacement-prompts/data-model.md
- Sequencing and entry contracts: specs/080-defer-replacement-prompts/contracts/replacement-flow.md
- User-facing requirements: specs/080-defer-replacement-prompts/spec.md
