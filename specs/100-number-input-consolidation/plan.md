# Implementation Plan: Number Input Consolidation

**Branch**: `100-number-input-consolidation` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Implementation Status**: Complete as of 2026-09-05; validation and scoped exception evidence are recorded in [quickstart.md](quickstart.md).

**Input**: `specs/100-number-input-consolidation/spec.md`, including both accepted clarifications.

## Summary

Promote the numeric input module into `packages/blue-app/src/renderer/components/` and migrate all 66 native number-input call sites, plus existing jmask consumers. Expose three named interfaces—`CommitNumberInput`, `LiveNumberInput`, and `DraftNumberInput`—over one private input/stepping implementation. Preserve field-specific parsing, validation, undo, confirmation, styling, and storage contracts.

Keep the visible native number input; replace its spinner chrome with explicit arrow buttons sharing one synchronous stepping path with ArrowUp/ArrowDown. Step from a valid draft, otherwise the last accepted value, without committing the intermediate draft. Use native stepping arithmetic in the input's hosting document rather than a custom decimal engine. Domain validation and persistence remain outside the primitive.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible strict configuration; React 19.2; Electron 35.7.5; existing pnpm workspace.

**Primary Dependencies**: Existing React/React DOM, Tailwind 4, `cn()` (clsx/tailwind-merge), browser number-input APIs. No new runtime or test dependency.

**Storage**: Only transient input state changes. Project values continue through the canonical document bridge; settings remain caller-owned drafts until Apply; dialogs keep their existing confirmation boundaries. No schema, XML, CSD, IPC, library database, or filesystem migration.

**Testing**: Vitest 4 with existing jsdom renderer harness; existing Playwright-backed browser config; targeted Electron manual checks for native editing and floating panels.

**Target Platform**: Existing macOS, Windows, and Linux Electron renderer, including secondary windows and Dockview popouts.

**Project Type**: Desktop application; renderer component consolidation.

**Performance Goals**: One synchronous notification per accepted step, zero notifications for no-ops, zero project notifications while typing in `CommitNumberInput`. Constant-size local state; no timer, polling, global subscription, or drag/undo redesign.

**Constraints**: Keep native input type, ids, bounds, accessible names, layout dimensions and caller styling precedence. Use semantic typography roles and realm-safe document access. Do not move domain-specific validators, unit conversions, project patches, or undo into the input. Existing typed bound policies may differ from native step bounds.

**Scale/Scope**: 66 static native number-input call sites, including SettingsField wrapper usages; repeated envelope JSX renders additional runtime instances. Existing CommitNumberInput consumers also relocate. Numeric text/time/unit editors, project-property string fields, and CommitTextInput relocation are excluded from implementation scope.

## Constitution Check

_Pre-research gate: PASS. Post-design gate: PASS. These are design checks, not claims that implementation tests have run._

| Principle / constraint            | Before research                                            | After design / evidence                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable data core                | PASS: renderer-only scope                                  | PASS: no production changes to `@blue/data`; browser helpers stay in renderer                                                                                                    |
| Java and project compatibility    | PASS: Java timing difference explicitly documented in spec | PASS: ConstantEditor reference records live valid text updates; deferred TypeScript editing is intentional. Tests cover commit/live interfaces; `.blue` and CSD contracts unchanged |
| Canonical ownership and contracts | PASS: preserve project/settings/dialog owners              | PASS: discriminated component contract separates numeric notifications from text drafts; no new persistence or IPC                                                               |
| Runtime and engine isolation      | PASS: no host work                                         | PASS: no new filesystem, Java, process, engine, or ZeroMQ access                                                                                                                 |
| Host-path portability             | N/A: no path behavior changes                              | N/A: no normalization boundary changes; UI host access uses the input's ownerDocument                                                                                            |
| Verification evidence             | PASS: existing renderer and browser harnesses available    | PASS: focused lifecycle regression, policy/transaction cases, inventory check, browser and popout validation, type/lint/build commands specified in quickstart                   |

No constitution exceptions are needed. Apply `docs/typography.md`, `docs/popout-popup-conventions.md`, and the class-composition contract during implementation. Existing popup mechanisms remain unchanged. No typography roles or authored-font policy changes are proposed.

## Project Structure

### Documentation (this feature)

```text
specs/100-number-input-consolidation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── commit-number-input.md
└── tasks.md                    # next command; not created by planning
```

### Source Code (repository root)

```text
packages/blue-app/src/renderer/
├── components/
│   ├── CommitNumberInput.tsx   # moved primitive + CommitNumberField
│   ├── settings/SettingsField.tsx
│   ├── settings/              # numeric settings and draft adapters
│   ├── effect-editor/EffectEditorPanel.tsx
│   ├── instruments/blue-x7/   # existing live/undo adapters
│   └── workbench/panels/      # all inventory sites; old jmask module removed
├── tests/
│   ├── commit-number-input.test.tsx       # new lifecycle/policy regression
│   ├── number-input-inventory.test.ts    # new static boundary check
│   └── ...                               # affected existing area tests
└── browser/
    └── commit-number-input.browser.test.tsx  # new actual event-order coverage
```

**Structure Decision**: One component module beside AppSelect; add a colocated SettingsNumberField export reusing SettingsField's label/description scaffold. Keep small stepping/normalization functions module-local unless a concrete test boundary requires exporting one. No generic form engine, state machine library, shared data-layer numeric service, or separate variants package.

## Phase 0: Research Decisions

Resolved the unknowns about spinner event provenance, `step="any"`, draft ownership, API surface, latest-value handling, and validation infrastructure. See [research.md](research.md), which retains the canonical input inventory and adds decision/rationale/alternatives. Read-only research agents checked stepping and specialized consumers. A temporary headless Chrome probe confirmed ArrowUp on `step="any"`, value 1.25, yields 2.25 while script `stepUp()` throws InvalidStateError; Electron verification remains an implementation check.

## Phase 1: Design and Migration Order

1. **Relocate and characterize** (FR-004/005): move both number exports, update jmask and test imports, preserve input styling assertions. Add reproductions for delayed step commits and duplicate Enter/blur or Escape/blur notifications before changing lifecycle behavior.
2. **Implement the shared contract** (FR-001/002/003/006/012): one private input/stepping implementation behind named commit/live/draft interfaces, explicit step controls, native attributes/ref forwarding, settled-draft and latest-accepted bookkeeping. Cover real mouse and keyboard event ordering before broad migration.
3. **Migrate ordinary fields** (FR-007/008/010): settings numeric policies, effect editor, virtual keyboard, Mixer/BlueLive, BSB, tracker/pattern/pianoroll and line editors. Preserve each field's documented parsing and range behavior; custom normalization replaces default clamping when needed. Existing native min attributes alone do not authorize new typed clamping. Use default revert for invalid/empty numeric edits unless the inventory specifies a fallback.
4. **Migrate specialized fields** (FR-007/009): blue-x7 uses `LiveNumberInput`; OK/Apply dialogs and validator settings use `DraftNumberInput`; row editors opt into field-owned finish/cancel keys through their callbacks. FontChooser and tracker range dialogs omit those callbacks so confirmation receives current text and dialog keys bubble. Preserve mixed placeholders and envelope gesture ownership.
5. **Verify complete migration** (FR-011, SC-001–005): maintain inventory dispositions, check no independent native number JSX remains, run focused and aggregate checks. Remove only generic lifecycle code replaced by the primitive. Do not delete domain validation or rename unrelated UI classes.

This sequence defines dependencies for `/speckit-tasks`; no application implementation is performed in this planning phase.

## Validation Strategy

- Reproduce immediate-step, duplicate-finish, and Escape cancellation failures in the shared component harness; assert callback counts and values rather than internal state.
- Numeric contract tests cover accepted and rejected drafts, finite checks, integer policies, dynamic bounds, delayed owner echoes, no-op bounds, external updates, and repeated steps before rerender.
- Integration tests cover selected representative fields and every distinct inventory policy, including dialog OK/Cancel, settings Apply errors, blue-x7 undo/mixed values, line-pair rejection and unit transforms.
- Browser tests exercise native input editing, explicit step clicks, focus preservation, decimal stepping, `step="any"`, keyboard repeat, and the secondary-document case. Preserve existing area test behavior assertions except the explicitly changed deferred timing.
- Run affected package tests first; repository tests/lint before handoff because this shared behavior spans renderer areas. Renderer typecheck and build are required. Main/preload builds are only additionally required if implementation unexpectedly changes those layers.
- [quickstart.md](quickstart.md) supplies exact commands and manual fallback for Electron-specific verification. Browser evidence does not substitute for the actual supported Electron runtime.

## Complexity Tracking

Explicit steppers and three editing modes are supported by demonstrated requirements. Avoid function-valued bounds, format/parse transformation frameworks, suffix/error slots, speculative size variants, wheel stepping, press-and-hold timers, and unrelated CommitTextInput movement.

The repository renderer typecheck has one scoped verification exception approved by the owner's explicit 2026-09-05 request to implement the converged tasks. `pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.renderer.json` reports 686 diagnostics in pre-existing, unrelated renderer/test and cross-root code, while a path-filtered run reports zero diagnostics in the Spec 100 production files. Fixing the entire renderer baseline was rejected because it would expand this renderer-only consolidation into unrelated feature and test repairs. The exact reproducible baseline is recorded in [quickstart.md](quickstart.md); the two diagnostics found in the Spec 100 scope were fixed rather than excepted.
