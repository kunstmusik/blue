# Quickstart: Validate Context-Aware UDO Code Completions

## Phase 9 Closeout Evidence (T042)

Recorded **2026-07-27 17:22 EDT** on branch `063-udo-code-completions` after the convergence tasks were implemented. The manual scenarios below are exercised in an automated coding environment without a running Electron GUI, so each scenario maps to focused automated coverage.

### Automated gate results (T034)

```bash
pnpm --filter @blue/data test    # 137 files, 1293 tests passed
pnpm --filter @blue/data build   # tsc esm + cjs — clean
pnpm --filter @blue/app test     # 231 files, 2239 passed | 2 skipped
pnpm --filter @blue/app build    # TypeScript + Vite main/preload/renderer — clean
pnpm lint                        # mvn validate — clean
git diff --check                 # exit 0, no whitespace errors
```

### Manual Scenario 1: Project Instrument Scope

- Owner + project UDOs offered in Generic/JS/BSB/Sound orchestra fields, project-only in Global Orchestra, and absent in Global Sco / JavaScript source.
- Covered by: `project-editor-panels.test.ts` (Global Orchestra `0:1`/`0:0`), `orchestra-code-instrument-editors.test.tsx` (Generic `1:1` orchestra + `0:0` Global Sco; JS Global Orc `1:1` + textarea source), `bsb-editor.test.tsx` (BSB three orchestra `1:1` + one Global Sco `0:0`), `score-object-editor-panel.test.tsx` (Sound BSB `1:1`×3).
- Scoped exception: live GUI click-through of the CodeMirror completion popup is not exercised here; the popup data is verified via `udo-code-completions.test.ts`.

### Manual Scenario 2: Polymorphism and Shadowing

- Same-name input/output overloads stay separate; exact context/project shadow resolves to the context row; classic/modern equivalence collapses to one overload; native same-name coexists; applying inserts only the authored name.
- Covered by: `udo-code-completions.test.ts` "polymorphic overloads and precedence (US3)" — 10 assertions.

### Manual Scenario 3: UDO Body and Effect Scope

- Project-global UDO bodies receive globals only as project scope (`0:2`, with project source metadata); embedded UDO bodies receive owner + project; project effect Code and embedded UDO bodies receive effect + project (`1:1`) in both effect editor contract surfaces.
- Covered by: `user-defined-opcode-panel.test.tsx`, `mixer-effect-editor-contract.test.ts`, and `effect-editor-window.test.tsx`.
- The separate project effect window's live regression invokes the canonical project-document update listener, proves Code replaces `ProjectUDO` with `RenamedProjectUDO`, and proves the embedded UDO workspace receives the same replacement. `effect-editor-window-manager.test.ts` proves the event is routed to project effect windows and excluded from library windows.

### Manual Scenario 4: Library Isolation

- Standalone library instrument, Sound, effect, and UDO editors expose only owner/self UDOs; an unrelated open project's globals never appear.
- Covered by: `library-editing.test.tsx` "library editor UDO isolation (US5, T030)" — non-empty instrument orchestra scopes are `1:0`; Sound Code fields and embedded UDO body are `1:0`; effect Code and embedded UDO body are `1:0`; standalone UDO body is `1:0`.

### Manual Scenario 5: Live Updates and Incomplete Definitions

- Add/rename/remove/reorder/style-convert are reflected on the next request; exact-shadow fallback restores the project overload; incomplete signatures stay distinct and marked.
- Covered by: `udo-code-completions.test.ts` "live completion refresh (US4)" plus document-local regressions for an unfinished declaration and a same-name complete/incomplete pair. `udo-type-utils.test.ts` verifies invalid classic inputs, invalid outputs, and invalid explicit modern annotations retain valid prefix types while remaining incomplete.

### Performance Check

- `udo-code-completions.test.ts` "completion construction performance (US3, T024)" builds 500 project + 100 context UDOs, warms up, measures 40 requests, and asserts p95 < 100 ms. Passes.

### Persistence and CSD Guard

- Completion is renderer-derived; no project mutation, XML field, or CSD change. `tables-udo-contract.test.ts` confirms snapshot fields are preserved and library effect snapshots force required `projectUdos: []`; the full 1,293-test `@blue/data` suite, including CSD parity coverage, remains green.

## Phase 1 Baseline (T001)

Captured on branch `063-udo-code-completions` before changing the shared completion adapter, recorded **2026-07-26 16:35 EDT**.

```bash
pnpm --filter @blue/data test    # 136 files, 1267 tests passed
pnpm --filter @blue/app test     # 229 files, 2192 passed | 2 skipped
```

Result: both affected packages green before any feature change.

## Prerequisites

- Node.js and pnpm versions supported by the workspace.
- Workspace dependencies installed.
- Branch `063-udo-code-completions`.
- A test project containing:
  - project-global UDOs;
  - a Generic Instrument, JavaScript Instrument, and BlueSynthBuilder with embedded UDOs;
  - a Sound score object with an embedded BlueSynthBuilder;
  - a mixer effect with embedded UDOs;
  - same-name overloads with different input and output signatures.

## Focused Automated Validation

Run data-layer signature tests:

```bash
pnpm --filter @blue/data test -- udo-type-utils
```

Run completion and editor-wiring tests:

```bash
pnpm --filter @blue/app test -- csound-editor-parity udo-code-completions orchestra-code-instrument-editors bsb-editor user-defined-opcode-panel mixer-effect-editor-contract effect-editor-window library-editing score-object-editor-panel
```

Run full affected-package checks:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/data build
pnpm --filter @blue/app test
pnpm --filter @blue/app build
pnpm lint
git diff --check
```

Expected outcome: all commands pass without changing `.blue` fixtures or generated CSD expectations.

## Manual Scenario 1: Project Instrument Scope

1. Create project-global UDO `SharedTone` with signature `(k) → a`.
2. Add a Generic Instrument with local `LocalTone` and local overload `SharedTone (a) → a`.
3. Request completion in Instrument and Global Orc.
4. Verify `LocalTone`, project `SharedTone (k) → a`, and local `SharedTone (a) → a` appear.
5. Request completion in Global Sco.
6. Verify context/project UDO rows are absent.
7. Repeat in JavaScript Global Orc and verify the JavaScript source field receives no Csound UDO rows.

## Manual Scenario 2: Polymorphism and Shadowing

1. Define project `Poly (k) → a`, `Poly (a) → a`, and `Poly (k) → k`.
2. Define local `Poly (k) → a`.
3. Request `Poly` completion from the local editor.
4. Verify the local `(k) → a` row replaces only its exact project counterpart.
5. Verify project `(a) → a` and `(k) → k` remain.
6. Verify every row shows input/output signature and source.
7. Apply each row and verify only `Poly` is inserted.
8. Add a same-name native opcode case and verify native and UDO rows remain distinguishable.

## Manual Scenario 3: UDO Body and Effect Scope

1. Edit a project-global UDO body and verify all project-global UDOs, including self, appear.
2. Edit an instrument embedded UDO body and verify owner plus project UDOs appear.
3. Open a project mixer effect inline and in the separate Effect Editor.
4. Verify effect Code and embedded UDO body editors expose effect plus project UDOs in both windows.
5. Rename a project-global UDO while the separate effect window remains open.
6. Verify the next completion request in that window shows the new name and not the old name.

## Manual Scenario 4: Library Isolation

1. Keep a project open with global `ProjectOnly`.
2. Open standalone library instrument, Sound, effect, and UDO editors.
3. Verify each asset’s code and embedded UDO body editors expose only UDOs owned by that asset; a standalone UDO exposes self.
4. Verify `ProjectOnly` is absent from every library editor.

## Manual Scenario 5: Live Updates and Incomplete Definitions

1. Keep an eligible orchestra editor focused.
2. Add, rename, remove, reorder, and style-convert owner/project UDOs.
3. Request completion after each change and verify the current collection appears without reload.
4. Enter a valid UDO name with a temporarily incomplete modern input declaration.
5. Verify it is marked incomplete and remains distinct from complete overloads.
6. Finish the declaration and verify the complete normalized signature replaces the incomplete row.

## Performance Check

Run the focused completion performance test, which constructs 500 project definitions and 100 context definitions, repeats completion requests, and reports the local p95:

```bash
pnpm --filter @blue/app test -- udo-code-completions
```

Expected outcome: p95 completion construction is below 100 ms on the supported development machine.

## Persistence and CSD Guard

1. Save a representative project before and after exercising completion without editing UDO data.
2. Compare the `.blue` UDO XML and generated CSD.
3. Verify definitions, order, names, signatures, collision renaming, and generated behavior are unchanged.

Completion selection and opening completion lists must not dirty the project.
