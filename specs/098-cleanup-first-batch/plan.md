# Implementation Plan: Validated Cleanup First Batch

**Branch**: `098-cleanup-first-batch` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Status**: Complete | **Closed**: 2026-09-04

**Input**: Feature specification from `specs/098-cleanup-first-batch/spec.md`

## Summary

Remove the first reviewed set of production-unconsumed files, the unused score-object observer contract, four unused `@blue/data` models, a completed migration guard, and a no-op lint plugin. Move Tailwind CSS v4 from the current PostCSS path to its installed Vite integration, remove superseded direct dependencies, and turn the already-installed Prettier into an explicit repository workflow. Keep changes in four reviewable slices: behavioral cleanup, styling/dependencies, formatter setup and baseline, then enforcement and final validation.

## Technical Context

**Language/Version**: TypeScript 5.8+, JavaScript ES modules, Node.js 20+ runtime used by the repository and Electron 35

**Primary Dependencies**: React 19, Vite 7, Tailwind CSS 4, `@tailwindcss/vite`, Electron 35, Prettier 3, Vitest 4, ESLint 10

**Storage**: Canonical `.blue` XML project files; no new storage or migrations

**Testing**: Vitest package suites, Node script tests, repository lint/audit scripts, production builds, packaging-input verification, and manual Electron window smoke checks

**Target Platform**: macOS arm64, Windows x64, and Linux x64 Electron application; browser-safe `@blue/data` package

**Project Type**: pnpm TypeScript monorepo containing a desktop application, portable data package, engine client, Java helper integration, and native engine

**Performance Goals**: No measurable regression in renderer startup, project load/save, playback, or rendering; no new runtime work

**Constraints**: Preserve `.blue` XML and CSD behavior; retain protected artifacts; remove only confirmed zero-consumer surfaces; keep formatting-only changes isolated; retain transitive AJV versions owned by other tools

**Scale/Scope**: Seven obsolete renderer components, one manual script, one observer contract across four data files, four unused model classes, two repository checks/config fragments, one build-pipeline migration, four direct dependency removals, and one repository formatting baseline

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: **PASS** — `@blue/data` only loses unused models and observer code. No Electron, Node.js, DOM, dynamic import, or host implementation enters the package.
- **Java and project compatibility**: **PASS WITH DOCUMENTED DIVERGENCE** — Java Blue retains Swing `ScoreObjectListener` behavior, while the TypeScript application uses canonical snapshots and patches and has no listener subscribers. Removing that unused public surface is intentional; setters, XML, CSD, playback, mixer, automation, and unknown-data preservation remain unchanged and are covered by maintained tests and fixtures.
- **Canonical ownership and contracts**: **PASS** — `BlueData`, `.blue` XML, Electron main ownership, renderer patch contracts, settings, and library ownership do not change. The only contract deletion is the explicitly scoped, unused score-object observer API and four unused package exports.
- **Runtime and engine isolation**: **PASS** — no Java, filesystem, process, engine-client, ZeroMQ, IPC, preload, or worker boundary changes are planned.
- **Host-path portability**: **PASS** — the machine-specific `test-csd.js` is removed. No production path conversion or comparison changes are introduced.
- **Verification evidence**: **PASS** — focused `@blue/data` and `@blue/app` tests/builds, maintained round-trip and CSD fixtures, renderer output checks, cross-platform packaging CI, formatting probes, repository tests/lint/build/verify, and `git diff --check` are specified in [quickstart.md](./quickstart.md).

### Post-Design Re-check

The research, configuration model, compatibility contract, and quickstart introduce no new state owner, public runtime layer, or constitution exception. Historical specifications remain historical records; current documentation is corrected where it claims a deleted artifact is an active workflow. No Complexity Tracking entry is required.

## Project Structure

### Documentation (this feature)

```text
specs/098-cleanup-first-batch/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cleanup-compatibility.md
└── tasks.md                         # Created by /speckit-tasks
```

### Source Code (repository root)

```text
package.json                         # Formatting commands and final lint gate
.prettierrc.json                     # Stable repository formatting policy
.prettierignore                      # Generated/vendor/fixture/output exclusions
eslint.config.mjs                    # Remove no-op react-hooks plugin stub
scripts/
└── verify.mjs                       # Remove completed track-runtime guard only

packages/blue-data/
├── README.md                        # Remove stale current-surface claims
└── src/
    ├── index.ts                     # Remove scoped dead exports
    ├── automation/                  # Delete two unused manager classes
    ├── mixer/                       # Delete two unused manager/node classes
    ├── score/                       # Delete observer definition and contract members
    └── sound-objects/               # Remove observer state and firing only

packages/blue-app/
├── package.json                     # Remove superseded direct dependencies
├── vite.config.ts                   # Activate Tailwind Vite integration
├── postcss.config.mjs               # Delete former integration
├── tailwind.config.mjs              # Delete inert v4 content-only config
└── src/renderer/
    ├── components/                  # Delete seven scoped legacy components
    ├── styles/index.css             # Retain Tailwind import and all application CSS
    └── tests/typography-tokens.test.ts

pnpm-lock.yaml                       # Regenerate importer graph; keep required transitives
test-csd.js                          # Delete machine-specific unwired harness
README.md                            # Document repository formatting commands
```

**Structure Decision**: Keep the existing monorepo layout. This feature adds no production module, shared abstraction, or new package; it deletes unused surfaces and adjusts existing repository/build configuration in place.

## Implementation Strategy

1. **Behavioral cleanup**: Reconfirm references, delete the exact approved files, remove the observer contract atomically, preserve setters and serialization behavior, and update only current documentation/tests that depend on deleted artifacts.
2. **Styling and dependencies**: Activate the installed Vite Tailwind plugin, retain the CSS entry import, delete the discoverable PostCSS configuration and inert content-only Tailwind configuration, remove four direct dependencies, regenerate the lockfile, and validate every renderer output.
3. **Formatter setup and baseline**: Add explicit stable options, exclusions, write/check commands, and documentation. Produce the initial formatting result as its own change with no semantic edits.
4. **Enforcement and closure**: Add `format:check` to the existing root lint path only after the baseline passes, then run the full validation matrix and inspect commit boundaries.

## Complexity Tracking

No constitution violations or new abstractions are required.
