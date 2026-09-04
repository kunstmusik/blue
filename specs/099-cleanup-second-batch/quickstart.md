# Quickstart: Validate the Cleanup Second Batch

Run commands from the repository root on branch `099-cleanup-second-batch`.

## 1. Verify Deletion and Protection Boundaries

```bash
test ! -e scripts/engine-realtime-automation-benchmark.mjs
test ! -e packages/blue-engine-client/src/automation-errors.ts
test ! -e vitest.workspace.ts
test ! -e packages/blue-app/src/renderer/stores/library-routing.ts

rg -n "engine-realtime-automation-benchmark|automation-errors|vitest\.workspace|library-routing" \
  package.json packages scripts README.md .github

test -e packages/blue-app/src/main/program-settings-usage.ts
test -e scripts/verify-blue-x7-java-resources.mjs
test -e packages/blue-app/src/renderer/components/workbench/panels/effects-library/EffectLibraryTree.tsx
test -e packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx
test -e packages/blue-app/src/renderer/components/instruments/blue-x7/next-note-badge.tsx
rg -n "class GeneratorRegistry" packages/blue-data/src/sound-objects/jmask-support.ts
```

Expected: deleted surfaces and stale current references are absent; every protected path remains.
Historical `specs/` and `research/` references are not deletion failures.

## 2. Verify Renderer-Store Pruning

Search the approved inventory in
[contracts/simplification-compatibility.md](contracts/simplification-compatibility.md) and confirm
the removed members have no definition or caller while retained members remain.

Run the focused app tests covering workbench focus, output, settings, layer selection, automation,
MIDI draft state, and canvas selection behavior:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/workbench-mixer-panel.test.tsx \
  src/renderer/tests/output-store.test.ts \
  src/renderer/tests/settings-store.test.tsx \
  src/renderer/tests/layer-selection-store.test.ts \
  src/renderer/tests/score-layer-operations.test.tsx \
  src/renderer/tests/score-timeline-automation-multi-line.test.tsx \
  src/renderer/tests/midi-settings.test.tsx \
  src/renderer/tests/midi-input-lifecycle.test.tsx
```

Expected: tests are retargeted away from dead members and continue to prove the retained behavior.
If a listed filename changes during task generation, use the matching current focused test rather
than weakening coverage.

## 3. Verify OSC Parsing and Snapshot Copying

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/send-osc-script.test.ts \
  src/renderer/tests/bsb-interface-snapshot.test.ts \
  src/renderer/tests/project-store.test.ts \
  src/renderer/tests/app.test.ts
```

Expected:

- Help, listing, literal `--`, defaults, command/address selection, custom address validation,
  unknown options/commands, missing values, invalid ports, help suffixes, and exit statuses match
  the contract without network sends in validation/error cases.
- Nested note-processor, replacement-instrument, and BSB widget snapshots remain structurally equal
  and independently mutable after copying.
- The shared `cloneBsbSnapshotValue` helper remains unchanged.

## 4. Verify Import Guidance and BlueX7 Protection

```bash
rg -n "import\.meta\.glob" packages --glob '*.{ts,tsx,js,jsx,mjs,cjs}'
rg -n "import\.meta\.glob|explicit static imports" AGENTS.md
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/blue-x7-algorithms.test.tsx \
  src/renderer/tests/blue-x7-effective-values.test.tsx
node --test scripts/verify-blue-x7-java-resources.test.mjs
pnpm --filter @blue/app exec vitest --config vitest.browser.config.ts --run \
  src/renderer/browser/tree-dnd-coexistence.browser.test.tsx
```

Expected: application source has no glob import, guidance records the explicit-import default and
exception gate, all 32 algorithm images resolve, and protected BlueX7/effects-library checks pass.
The first search is expected to return no package hits.

## 5. Verify Engine-Client and Application Builds

```bash
pnpm --filter @blue/engine-client test
pnpm --filter @blue/engine-client build
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:renderer
```

Expected: public engine-client and renderer/application behavior remain intact after internal
deletion and store/runtime simplification.

## 6. Run Full Repository Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify
git diff --check
```

Expected: all repository checks pass with no new failures or whitespace errors. Review the final
diff as four distinct slices: dead maintenance deletion, store pruning, standard-runtime
substitutions, and import guidance/closure.

## Closure Validation — 2026-09-04

- Focused OSC and BlueX7 convergence tests passed: 37 Vitest tests and 2 resource-verifier tests.
- `pnpm --filter @blue/app test`: passed 426 test files with 4,063 tests passed and 2 skipped.
- `pnpm test:scripts`: passed all 38 repository script tests.
- `pnpm --filter @blue/engine-client test` and build passed; application main and renderer builds passed.
- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and `git diff --check` passed during implementation and closure validation.
- The explicit 32-entry BlueX7 SVG manifest, protected resource verifier, and no-glob import audit passed.

The final convergence audit found zero remaining gaps across the feature requirements, acceptance
scenarios, plan decisions, tasks, compatibility contract, and constitution. No additional
implementation pass is required. Supported-platform packaging remains enforced by the existing
macOS arm64, Windows x64, and Linux x64 CI workflows.
