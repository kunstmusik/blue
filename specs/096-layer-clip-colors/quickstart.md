# Quickstart: Validate Layer and Clip Colors

## Preconditions

- Work on branch `096-layer-clip-colors`.
- Run commands from the repository root with the checked-in pnpm workspace configuration.
- Use a legacy `.blue` fixture without layer colors and a current fixture containing ordinary, Track, and Pattern layers.

## Focused automated validation

Run the data-model and XML suites covering all three layer types:

```bash
pnpm --filter @blue/data test
```

Run the app contract, optimistic reducer, color-history, picker, and score UI suites:

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
```

Before handoff for this cross-package feature:

```bash
pnpm test
pnpm lint
git diff --check
```

## Required automated scenarios

1. Round-trip one custom layer color for each of `SoundLayer`, `Track`, and `PatternLayer`; assert one signed `<backgroundColor>` child and exact restored display color.
2. Load missing, malformed, RGB-form, unsigned-ARGB, and signed-ARGB layer values; assert safe opaque normalization and neutral fallback where invalid.
3. Save a legacy project; assert neutral layer colors materialize and all pre-existing item colors remain equivalent in meaning.
4. Create a new item with omitted color on each destination type; assert it receives the destination layer's latest color.
5. Reify serialized/imported/copied/duplicated content with its own color; assert destination layer color does not replace it.
6. Move an item between differently colored layers; assert item color is unchanged.
7. Submit a 1,000-target recolor patch; assert all targets change in one operation and unrelated items do not.
8. Include one invalid target in a multi-target patch; assert none of the valid targets change.
9. Undo and redo a layer picker gesture and each apply command; assert one history step restores/reapplies all affected colors.
10. Open the layer color control in both docked and floated score panels; assert keyboard operation, accessible label, correct host portal, and dismissal behavior.

## Manual acceptance walk-through

1. Open a project containing ordinary, Track, and Pattern layers.
2. Change each layer header to a distinct color; confirm existing items do not change.
3. Create a new item on each layer; confirm it matches its destination layer.
4. Recolor one item directly, then copy, duplicate, and move it; confirm its concrete color persists.
5. Select items across differently colored layers and choose **Set to Layer Color**; confirm each item matches its own layer.
6. Invoke **Apply Layer Color to All Clips** on one layer; confirm only that layer changes.
7. Undo once and redo once after each action; confirm the whole action reverses/reapplies as one step.
8. Save, reopen, and inspect the project XML; confirm layer and item colors restore and layer values are signed decimal integers.
9. Open a legacy project with no layer colors; confirm neutral headers, unchanged item colors, and materialized layer colors after save.
10. Open the saved project in current Java Blue; confirm it remains readable and concrete clip colors display, acknowledging that a Java resave may drop layer colors.

## Success evidence

Capture the focused test names/results for creation, preservation, atomicity, history, accessibility, and XML compatibility. If Java Blue behavior differs from the compatibility expectation, record the exact fixture and output before changing the TypeScript design.

## Recorded Validation Evidence

### Automated Scenarios Verification

1. **Round-trip custom layer color for SoundLayer, Track, PatternLayer**:
   - `packages/blue-data/src/score/layer-color-serialization.test.ts` (12 tests passed)
   - `packages/blue-app/src/shared/project-editor-layer-color-roundtrip.test.ts` (1 test passed)
   - Emits exactly one signed decimal `<backgroundColor>` child per layer; restores exact integer on reload; preserves unknown XML attributes and children without duplication. Unsupported ordinary and Pattern `soundObject` XML remains opaque and round-trips without synthetic replacement (T050, T055).
2. **Missing, malformed, RGB-form, unsigned-ARGB, signed-ARGB layer values**:
   - `packages/blue-data/src/score/layer-color-model.test.ts` (12 tests passed)
   - `packages/blue-data/src/score/layer-color-serialization.test.ts` (12 tests passed)
   - Normalizes valid inputs to opaque ARGB signed 32-bit integer; strictly rejects partially numeric strings like `"-12566464px"`, falling back safely to `-12566464` (`#404040`) across SoundLayer, Track, and PatternLayer (T053).
3. **Legacy project load-save compatibility**:
   - `packages/blue-data/src/score/layer-color-compatibility.test.ts` (1 test passed)
   - `packages/blue-data/src/score/score-model-compatibility.test.ts` (17 tests passed)
   - Preserves pre-existing clip colors without drift; saves neutral layer color as concrete child; compatible with Java Blue parser.
4. **New item receives destination layer's color when omitted**:
   - `packages/blue-app/src/shared/project-editor-layer-color-preservation.test.ts` (4 tests passed)
   - `packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx` (4 tests passed; omitted source-target, serialized, and Pattern-source transfer colors stay concrete in the optimistic snapshot, T059 and T061)
5. **Reify / duplicate / copy / paste preserves item's explicit color**:
   - `packages/blue-app/src/shared/project-editor-layer-color-preservation.test.ts` (4 tests passed)
   - Clips with explicit colors retain their identity and color when duplicated, copied, or pasted.
6. **Move item between differently colored layers**:
   - `packages/blue-app/src/shared/project-editor-layer-color-preservation.test.ts` (4 tests passed)
   - Item color is completely unchanged when moved across layer boundaries.
7. **1,000-target atomic batch recolor patch & optimistic all-or-nothing**:
   - `packages/blue-app/src/shared/project-editor-score-color-application.test.ts` (7 tests passed)
   - `packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts` (6 tests passed; optimistic updates resolve to unique snapshot objects, T060)
   - Pre-validates all targets in both canonical backend and optimistic store: all-or-nothing atomicity ensures no partial state if any target or color is invalid (T051). Reconciles via canonical snapshot refresh if rejected or if `changed: false`.
8. **Invalid target in multi-target patch fails atomically**:
   - `packages/blue-app/src/shared/project-editor-score-color-application.test.ts` (6 tests passed)
   - `packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts` (6 tests passed, including selection/location and Pattern-source alias rejection, T060)
   - Pre-validates all targets; rejects invalid target, duplicate target, invalid color input, or read-only scope before applying mutations.
9. **Undo and redo layer picker gestures and recolor actions**:
   - `packages/blue-app/src/renderer/tests/score-color-history-store.test.ts` (10 tests passed)
   - `packages/blue-app/src/renderer/tests/project-patch-queue.test.ts` (10 tests passed)
   - `packages/blue-app/src/renderer/tests/color-picker.test.tsx` (7 tests passed)
   - `packages/blue-app/src/renderer/tests/score-layer-color-actions.test.tsx` (2 tests passed)
   - Changes and applications are recorded only after canonical acceptance; valid no-op layer/item patches report acceptance separately from mutation, stale or invalid targets fail closed even in mixed batches, picker previews that round back to the initial color do not create history, and undo/redo advances cursor only upon acknowledged forward/inverse commits (T054, T056, T057, T058).
10. **Layer color picker popout in docked and floated panels**:
    - `packages/blue-app/src/renderer/tests/score-layer-color-popout.test.tsx` (2 tests passed)
    - Portals into `HostDocumentContext` for floated windows; handles keyboard interaction (Escape, Enter) and accessible labels.

### Package and Workspace Validation Commands

- `pnpm --filter @blue/data test`: **PASSED** (180 test files passed, 1,769 tests passed, 1 skipped, 0 failed). `modern-render.integration.test.ts` accepts both verified Csound 7 reference hashes (`82012869f2451e4968a0646b5a9d4329cc0c89cbcac277f7c2fe8238453882c6` and `0a385a4cbc4ff7da579f534429d25426738e0243859827e1ff91d767467e7854`) (T052).
- `pnpm --filter @blue/app build:main`: **PASSED** (`tsc -p tsconfig.main.json` compiled main process with zero errors).
- `pnpm --filter @blue/app test`: **PASSED** (422 test files passed, 4,034 tests passed, 2 skipped, 0 failed).
- `pnpm test`: **PASSED** (all six workspace projects and 38 script tests passed; 422 app test files/4,034 tests and 180 data test files/1,769 tests included).
- `pnpm lint`: **PASSED** (6 workspace projects validated, zero lint or typography violations).
- `git diff --check`: **PASSED** (zero whitespace or formatting errors).

## Closure Record

- Manual acceptance: completed by the requester on 2026-09-03; the layer and clip color workflows were reported as working as intended.
- Implementation: tasks T001–T061 are complete, including all convergence fixes.
- Final convergence: zero remaining gaps across the requirements, acceptance scenarios, plan decisions, tasks, and constitution.
- Automated validation: the full workspace test suite, main-process build, lint, and whitespace checks passed with the results recorded above.
