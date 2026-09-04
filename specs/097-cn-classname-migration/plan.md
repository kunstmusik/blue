# Implementation Plan: cn() Class-Composition Migration and Styling Boundary

**Branch**: `097-cn-classname-migration` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/097-cn-classname-migration/spec.md`

## Summary

Eliminate all hand-rolled renderer `className` composition (156 sites in 77 files: 98
template-literal sites in 54 files plus 58 class-building join sites in 33 files) by migrating to
the existing, purpose-built `cn()` helper (`clsx` + `tailwind-merge` with the seven `text-role-*`
roles registered), fixing the five caller-override defects and the tracker-editor `py-1`/`py-1.5`
conflicts first, locking the convention with an ESLint guard and helper/component tests, and
documenting the styling boundary (utilities-first for new code, plain-CSS exception whitelist,
retained BEM classes, strangler policy) in AGENTS.md. Technical approach, inventory, and wave
structure: [research.md](research.md); convention: [contracts/classname-composition.md](contracts/classname-composition.md).

## Technical Context

**Language/Version**: TypeScript (strict), React renderer in Electron (`packages/blue-app`); no
version changes.

**Primary Dependencies**: `clsx@^2.1.1`, `tailwind-merge@^3.4.0` (both already installed and used
by `src/renderer/lib/cn.ts`); `tailwindcss@^4.1.18`; ESLint flat config via `typescript-eslint`
(`eslint.config.mjs`). No new dependencies.

**Storage**: N/A — no persisted state; styling is derived render detail.

**Testing**: Vitest — plain unit tests plus jsdom component tests using the house pattern
(`// @vitest-environment jsdom`, `createRoot` + `act`, as in
`src/renderer/tests/render-freeze-actions.test.tsx`); ESLint negative validation for the new rule.

**Target Platform**: Electron renderer (`packages/blue-app/src/renderer`); lint config at repo
root; guidance in `AGENTS.md`.

**Project Type**: Desktop app (internal code-quality refactor; no user-facing feature).

**Performance Goals**: None beyond no regressions; `cn()` adds per-render string merging cost
comparable to the template literals it replaces.

**Constraints**: Class-list equivalence everywhere except the audited conflict fixes (FR-004);
retained BEM class names unchanged (FR-008); `@blue/data`, main, preload untouched; typography
roles untouched (FR-009); no new dependencies.

**Scale/Scope**: 156 sites / 77 files (inventory in [research.md](research.md) §R0); 1 new test
file; 1 lint block; 1 AGENTS.md subsection; 0 CSS changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: N/A — `@blue/data` untouched. All code changes stay in
  `packages/blue-app/src/renderer/**`; non-renderer edits are `eslint.config.mjs` (repo tooling)
  and `AGENTS.md` (guidance), neither of which enters any package's production imports.
- **Java and project compatibility**: N/A — no `.blue` XML, CSD generation, rendering pipeline,
  settings, or Java-parity surface. Java Blue's Swing UI is not a reference for TypeScript
  renderer utility composition; no divergence to document.
- **Canonical ownership and contracts**: PASS — no state domains touched (spec: styling is
  disposable derived detail). `cn()` remains the single class-composition owner; the convention
  it defines is codified as a renderer-internal contract
  ([contracts/classname-composition.md](contracts/classname-composition.md)) with caller
  precedence `cn(base, …, className)` as its one interface rule (FR-002).
- **Runtime and engine isolation**: N/A — main process, preload, Java runtime, and engine
  untouched; renderer-only styling changes.
- **Host-path portability**: N/A — no path handling anywhere in scope.
- **Verification evidence**: PASS — tiered per research D2/D3 and [quickstart.md](quickstart.md):
  helper unit tests (`cn.test.ts`: conflict resolution, `text-role-*` group, opaque passthrough,
  falsy parts), jsdom component tests for the five Wave-1 components and the tracker regression,
  ESLint negative validation (rule fires on violations, exempts tests), exhaustive `rg` zero-site
  gates with the four excluded files enumerated, full `pnpm --filter @blue/app test` + `pnpm lint`
  + `git diff --check`, and a deterministic manual smoke pass over named surfaces (Gate 5).

**Post-design re-check (after Phase 1)**: No change to any verdict — the designed artifacts
(data model, contract, quickstart) introduce no state, no persistence, no IPC, no paths, and no
data-package surface. The only design decisions with governance flavor (lint guard scope, AGENTS.md
as boundary home, strangler-not-batch for BEM) are conventions, not constitution amendments, and
are recorded with rejected alternatives in [research.md](research.md) D1/D5/D6.

## Project Structure

### Documentation (this feature)

```text
specs/097-cn-classname-migration/
├── spec.md              # Feature specification (/speckit-specify output)
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: inventory + decisions D1–D6
├── data-model.md        # Phase 1: ClassToken / ClassComposition / StylingBoundary model
├── quickstart.md        # Phase 1: Gates 1–5 runnable validation
├── contracts/
│   └── classname-composition.md  # Renderer composition convention (lint-enforced in part)
└── tasks.md             # Phase 2 output (/speckit-tasks - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/blue-app/src/renderer/
├── lib/
│   ├── cn.ts                    # existing helper — unchanged (or trivially so)
│   └── cn.test.ts               # NEW Wave 0: semantics lock
├── components/                  # 77 files migrated in Waves 1–3 (inventory: research.md §R0)
│   ├── ColorPicker.tsx                  # Wave 1 caller-className
│   ├── menu-bar/ToolbarDisplays.tsx     # Wave 1
│   ├── workbench/panels/score/bar-renderers/ScoreObjectBar.tsx        # Wave 1
│   ├── workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx  # Wave 1
│   ├── instruments/blue-x7/tab-list.tsx # Wave 1
│   ├── workbench/panels/score-object/editors/TrackerScoreObjectEditor.tsx # Wave 2 conflicts
│   └── …                                # Wave 3a template-literal sweep (54 files)
│                                          Wave 3b join sweep (33 files)
│                                          EXCLUDED: AutomationLineView.tsx (SVG paths only),
│                                          bsb/widgets/utils.ts, stores/library-store.ts,
│                                          virtual-keyboard/keyboard-mapping.ts
└── tests/                       # Wave 1 component tests (jsdom house pattern)

eslint.config.mjs                        # NEW renderer-scoped no-restricted-syntax block (end of Wave 3)
AGENTS.md                                # "UI and typography guidance" += class composition subsection (Wave 4)
docs/typography.md                       # UNCHANGED (roles/metrics untouched)
packages/blue-app/src/renderer/styles/index.css  # UNCHANGED (no BEM replacement)
```

**Structure Decision**: All migration work lands in the existing renderer component tree with no
new modules, packages, or abstractions — the feature's structure is the existing one plus one test
file, one lint block, and one guidance subsection. Waves from research D6: **Wave 0** helper tests
→ **Wave 1** five caller-className components (+tests) → **Wave 2** tracker conflict fix (+test) →
**Wave 3** mechanical sweep sub-batched by area (score panels → score-object editors →
orchestra/BSB → workbench shell/aux → trees/libraries → settings/about/misc → shared
line-editor), lint block enabled at the end → **Wave 4** AGENTS.md boundary + full verification
gates.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations; no exceptions requiring owner approval. (Deliberate scope
choices with rejected alternatives are documented in research.md D1–D6.)
