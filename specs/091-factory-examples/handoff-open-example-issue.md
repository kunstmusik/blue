# Handoff: Factory Example Content — Closed

**Feature**: [Factory Example Content](spec.md) — branch `091-factory-examples`

**Date**: 2026-08-26

**Status**: Complete; automated gates and packaged manual acceptance passed.

## Delivered Behavior

- Packaged examples are immutable factory input. Open Example lazily creates a complete writable
  copy under the application's user-data `examples/current/content` directory.
- Deterministic manifests and versioned state track accepted/declined factory revisions and
  per-path baselines without changing project XML or program settings.
- Updates preserve user edits, additions, deletions, and path-type collisions. Conflict reporting
  is deterministic and bounded.
- Initial copies and updates are prepared as complete candidates. Picker selection, parsing, and
  existing project-replacement gates run before a journaled activation.
- Recognized interrupted activations recover on the next Open Example action. Ambiguous or
  unowned generations are preserved and block mutation with an actionable diagnostic.
- Picker containment uses native real paths. During a staged update, an equivalent selection from
  Blue's stable current library maps to the candidate; packaged and external selections remain
  rejected with guidance to use Open Project.

## Manual Acceptance

The user reported the packaged fresh-profile checks in [quickstart.md](quickstart.md) passing on
2026-08-26.

| Criterion | Result | Evidence exercised |
|---|---|---|
| SC-001 | Pass | First-use Copy and Open reached the example picker and opened a user-owned project. |
| SC-002 | Pass | An example using bundled relative assets rendered from the user library. |
| SC-003 | Pass | Packaged factory-tree digests were identical before and after open/edit/save/render. |
| SC-004 | Pass | Repeated same-revision opens produced no copy/update prompt or duplicate library. |
| SC-005 | Pass | Update/conflict checks preserved user modifications, creations, and deletions. |
| SC-006 | Pass | Cancellation/failure/recovery checks preserved the active project, factory source, and last valid generation. |
| SC-007 | Pass | A newly supplied factory example was available through Update and Open without manual copying. |

This closes T032 and its convergence follow-up T042.

## Automated Evidence

Final validation after the macOS picker-path correction:

- `pnpm test`: passed across all workspace packages and scripts; the Blue App suite reported 402
  files passed, 3,873 tests passed, and 2 skipped, and all 13 native Blue Engine tests passed.
- `pnpm --filter @blue/app build:main`: passed.
- `pnpm lint`: passed.
- `git diff --check`: passed.

## Primary Artifacts

| Area | Path |
|---|---|
| Flow coordinator | `packages/blue-app/src/main/open-example-project-flow.ts` |
| Filesystem domain | `packages/blue-app/src/main/example-library/` |
| Path resolution | `packages/blue-app/src/main/example-project-path.ts` |
| Electron wiring | `packages/blue-app/src/main/main.ts` |
| Lifecycle contract | `specs/091-factory-examples/contracts/example-library-lifecycle.md` |
| Acceptance procedure | `specs/091-factory-examples/quickstart.md` |
| Completed task ledger | `specs/091-factory-examples/tasks.md` |

## Scope Confirmation

The feature remains main-process-only. It adds no renderer, preload, IPC, engine, protocol, or
project-serialization changes. Normal Open Project behavior is unchanged.
