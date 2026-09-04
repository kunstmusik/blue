# Implementation Plan: Validated Cleanup Second Batch

**Branch**: `099-cleanup-second-batch` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Status**: Complete | **Closed**: 2026-09-04

**Input**: Feature specification from `specs/099-cleanup-second-batch/spec.md`

## Summary

Remove three confirmed-dead maintenance artifacts and only the renderer-store members whose
current consumer inventory is empty. Replace the OSC sender's hand-written option scanner with
the Node runtime parser while retaining domain validation, and replace two renderer-only recursive
snapshot clone helpers directly with `structuredClone`. Add stable import guidance to `AGENTS.md`
that keeps fixed asset and module sets explicit and permits `import.meta.glob` only when a future
specification intentionally requires and validates automatic discovery.

Keep the work in four reviewable slices: dead maintenance surface, renderer-store pruning,
standard-runtime substitutions, then import guidance and final validation.

## Technical Context

**Language/Version**: TypeScript 5.8+, JavaScript ES modules, Node.js 22+, Electron 35.7.5

**Primary Dependencies**: Node `util.parseArgs`, global `structuredClone`, Zustand 5, React 19,
Vitest 4, Vite 7

**Storage**: No new storage or migration; canonical `.blue` XML and renderer session state remain
unchanged

**Testing**: Vitest package suites, focused subprocess coverage for the OSC script, static
reference audits, TypeScript builds, repository verification, and whitespace checks

**Target Platform**: macOS arm64/x64, Windows x64, and Linux x64 Electron application; Node 22
development and CI hosts

**Project Type**: pnpm TypeScript monorepo containing a desktop application, portable data
package, engine client, Java helper integration, and native engine

**Performance Goals**: No new runtime work and no measurable regression in renderer state updates,
project editing, OSC command dispatch, or engine communication

**Constraints**: Preserve active store state and consumers; preserve all supported OSC behavior;
clone only declared serializable snapshots; do not alter project XML, generated CSD, IPC, engine
protocol, BlueX7 asset mapping, or protected surfaces

**Scale/Scope**: Three file deletions plus one stale comment and one README entry; dead members in
seven renderer-store areas; one CLI parser substitution; two renderer snapshot-helper removals;
one stable repository-guidance addition

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

- **Portable data core**: **PASS** — `@blue/data` is untouched. The two native clone substitutions
  stay in Electron renderer code, and no host dependency enters the portable package.
- **Java and project compatibility**: **PASS** — no model, XML, CSD, playback, render, migration, or
  Java-parity behavior changes. Existing fixtures and full package tests remain final regression
  evidence.
- **Canonical ownership and contracts**: **PASS** — `BlueData`, `.blue` XML, Electron main, and the
  existing renderer stores retain their ownership. Only zero-consumer store members are removed;
  active MIDI draft, score automation, selection, output color, and settings synchronization state
  remain.
- **Runtime and engine isolation**: **PASS** — active engine-client protocol/capability exports,
  ZeroMQ transport, IPC/preload boundaries, Java lifecycle, and native diagnostics remain unchanged.
- **Host-path portability**: **PASS** — deletion of an unwired benchmark removes machine-path input
  handling; the supported OSC script continues to treat host and port as protocol values and adds no
  filesystem boundary.
- **Verification evidence**: **PASS** — focused store, snapshot, CLI, engine-client, BlueX7, and
  protection checks precede full `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and
  `git diff --check` validation as documented in [quickstart.md](./quickstart.md).

### Post-Design Re-check

The research decisions, state model, compatibility contract, and validation guide introduce no
new state owner, public runtime layer, persistence format, or constitution exception. No Complexity
Tracking entry is required.

## Project Structure

### Documentation (this feature)

```text
specs/099-cleanup-second-batch/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── simplification-compatibility.md
└── tasks.md                         # Created by /speckit-tasks
```

### Source Code (repository root)

```text
AGENTS.md                            # Add fixed-set explicit-import guidance
README.md                            # Remove stale root Vitest workspace entry
vitest.workspace.ts                 # Delete unused/incomplete workspace config
scripts/
└── engine-realtime-automation-benchmark.mjs  # Delete unwired benchmark

native/blue-engine/src/automation/
└── AutomationErrors.h              # Remove stale TypeScript-mirror comment only

packages/blue-engine-client/src/
└── automation-errors.ts            # Delete unexported zero-consumer module

packages/blue-app/
├── scripts/
│   └── send-osc.mjs                # Use runtime parsing; retain OSC behavior
└── src/
    ├── shared/
    │   └── send-osc-script.test.ts # Focused subprocess contract coverage
    └── renderer/
        ├── stores/
        │   ├── workbench-store.ts
        │   ├── output-store.ts
        │   ├── settings-store.ts
        │   ├── layer-selection-store.ts
        │   ├── score-automation-store.ts
        │   ├── ui-store.ts
        │   ├── midi-input-store.ts
        │   ├── library-routing.ts  # Delete zero-consumer routing helper
        │   ├── project-store.ts
        │   └── project-store/bsb-interface-snapshot.ts
        └── tests/                   # Retarget focused store/snapshot tests
```

**Structure Decision**: Keep the existing monorepo layout and change only named source,
configuration, guidance, and focused-test files. Add no shared parser, clone wrapper, lint rule,
package, or abstraction.

## Implementation Strategy

1. **Dead maintenance surface**: Re-run the deletion gate, delete the benchmark, engine-client
   diagnostic module, and root Vitest workspace, then remove only their stale comment/documentation
   references. Preserve native diagnostic codes and every public engine-client entrypoint.
2. **Renderer-store pruning**: Remove the exact dead members listed in the compatibility contract
   and retarget tests that exist solely for them. Preserve active state even when an adjacent method
   looks vestigial; do not consolidate stores.
3. **Standard-runtime substitutions**: Use `parseArgs` only for token scanning, retaining OSC
   defaults and domain validation. Replace the two renderer `cloneSnapshotValue` implementations
   directly with `structuredClone`; defer the shared model helper.
4. **Guidance and closure**: Add the import rule under `AGENTS.md` import discipline, confirm zero
   application `import.meta.glob` use and the explicit 32-image BlueX7 mapping, then run focused and
   repository-wide validation.

## Reviewable Slice Order

1. Dead scripts/configuration and engine-client internal surface.
2. Renderer-store zero-consumer members.
3. OSC parsing and renderer snapshot cloning.
4. Import guidance, protection audits, and final validation.

## Complexity Tracking

No constitution violations or new abstractions are required.
