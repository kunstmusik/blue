# Quickstart: Large Module Refactoring Foundations

Phase 1 output — runnable validation scenarios proving each extraction preserves
behavior. Run from the repository root with `pnpm`. Boundary definitions live in
[contracts/](contracts/) and [data-model.md](data-model.md); per-seam invariants are
quoted there and not repeated here.

## Prerequisites

- `pnpm install` at the repo root.
- Baseline first (spec edge case — record any pre-existing failure before extracting):
  ```bash
  pnpm --filter @blue/data test
  pnpm --filter @blue/app test
  pnpm --filter @blue/app build:main
  ```
- Optional, on a machine with the Java-generated fixtures (`~/work/blue/demo2026/01.blue`,
  `~/work/blue/rhythmic/01.blue`): the parity suites below include them automatically and
  skip when absent; note in the boundary map when they were actually executed.

## Per-seam validation (run after each staged extraction step)

### Seam 4 — score-object document reducer

```bash
pnpm --filter @blue/app test score-object-editor-panel
pnpm --filter @blue/app test jmask-editor-contract
pnpm --filter @blue/app test audioclip-score-object-editor
pnpm --filter @blue/app test object-builder-editor-parity
```

Expected: all pass with zero snapshot/fixture changes. The five repointed test imports
are themselves part of the verification (a wrong extraction surface fails to compile).

### Seam 3 — BlueData XML/CSD/runtime policy

```bash
pnpm --filter @blue/data test blue-data
pnpm --filter @blue/data test track-layer-migration
pnpm --filter @blue/app test          # downstream consumers incl. blue-cli-parity paths
pnpm --filter @blue/data build        # ESM + CJS strict compile
```

Expected: `blue-data-frozen-roundtrip` (unknown-data round trip), CSD
determinism/copy-safety/scheduling/automation, BlueLive CSD, and runtime traversal suites
pass unchanged; no `.blue` fixture diff. If the Java parity fixtures exist locally,
`blue-data-csd-parity` and `blue-data-csd-disk` must produce byte-identical output.

### Seam 2 — auxiliary layout split

```bash
pnpm --filter @blue/app test workbench-auxiliary
pnpm --filter @blue/app test workbench-layout-persistence
pnpm --filter @blue/app test workbench-store
pnpm --filter @blue/app test auxiliary-slideout
```

Expected: every migration version (v2–v7 envelope, v5 model), transition/rollback
contract, ownership invariants, and the 200px Java Blue parity case pass unchanged
against the barrel import.

### Seam 1 — project-editor split (per staged module, repeat)

```bash
pnpm --filter @blue/app test project-editor
pnpm --filter @blue/app test score-timeline-automation
pnpm --filter @blue/app test project-store
pnpm --filter @blue/app build:main      # main-process runtime imports compile
pnpm --filter @blue/app build:preload   # type-only imports compile
```

Expected: all shared contract suites pass; the 284 consumer files compile without
modification (the compiler is the check that the barrel surface is complete). After the
`identity.ts` step specifically, the duplicate/stale-ID rejection tests must still pass —
they prove the WeakMap registries remained a single instance.

## Whole-feature gate (after all seams)

```bash
pnpm test
pnpm lint
pnpm --filter @blue/app build:main
git diff --check
```

Expected: repository-wide suites, ESLint, typography/confirmation-dialog audits, and
whitespace checks pass, or every exception is documented with residual risk (FR-015).

## Focused manual regression follow-up

2026-08-23: The refactor follow-up was manually checked for the TrackerObject and score-object
editor regressions reported during review. The keyboard-notes toolbar state survives an editor
refresh; Arrow Up/Down changes the focused tracker row without scrolling the tracks page; Space
toggles ties from the status cell or grid background; and dragging a selected soundObject between
layers leaves its editor populated. These checks supplement the automated whole-feature gate.

## Manual end-to-end scenario (once, after all seams)

Deterministic manual validation for surfaces where UI behavior is the contract:

1. `pnpm --filter @blue/app dev`, open an existing project with known and unknown data;
   edit a tracker score object (cell edits, tie/note-off actions, add/remove track), a
   Sound/BSB object (widget edit, preset apply), and an audioClip (loop off → duration
   clamp); save, reopen — content identical.
2. Generate CSD to disk for the same project before and after the refactor and diff the
   two files — byte-identical (or fixture-identical).
3. Rearrange the auxiliary workbench (dock, minimize, slideout, move panel/group between
   edges, close + restore a panel), restart the app — same panels, positions, minimized
   and slideout state.
4. If a pre-087 layout save exists (any legacy version), confirm it still restores.

Expected outcomes map to spec acceptance scenarios US2-1…US2-4.
