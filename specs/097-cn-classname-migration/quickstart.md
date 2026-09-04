# Quickstart: Validate the cn() Class-Composition Migration

**Feature**: 097-cn-classname-migration | **Run from repository root**
**References**: inventory & waves in [research.md](research.md); convention in
[contracts/classname-composition.md](contracts/classname-composition.md); semantics in
[data-model.md](data-model.md)

## Prerequisites

```bash
pnpm install
```

## Gate 1 — Zero remaining hand-rolled class composition (SC-001)

```bash
# Template-literal className in renderer production source — expect NO output
rg -n 'className=\{`' -g '*.tsx' packages/blue-app/src/renderer

# Class-building joins — expect output ONLY from the four excluded files
rg -n "join\(' '\)|filter\(Boolean\)\.join" -g '*.tsx' -g '*.ts' packages/blue-app/src/renderer
```

For the second command, the only acceptable remaining lines are inside:
`score/automation/AutomationLineView.tsx` (SVG path), `orchestra/bsb/widgets/utils.ts` (SVG
path), `stores/library-store.ts` (error text), `panels/virtual-keyboard/keyboard-mapping.ts`
(key list). Anything else is a missed site.

Baseline for scale: before migration the first command returns 98 matches in 54 files, the
second 66 matches in 37 files.

## Gate 2 — Lint guard active and correct (FR-006)

```bash
pnpm lint                       # expect: pass, zero errors
```

Negative validation (proves the rule exists and points the right way):

1. Temporarily add to any production renderer component:
   `` <div className={`a ${'b'}`} /> `` and, in another spot,
   `` <div className={['a', 'b'].join(' ')} /> ``.
2. Run `pnpm lint` — expect errors on both, each message naming `cn()`.
3. Run `pnpm lint` again after a deliberate template literal inside a `*.test.tsx` file —
   expect NO error (tests are exempt).
4. Revert the deliberate violations; `pnpm lint` passes.

## Gate 3 — Targeted tests (SC-002, SC-003)

```bash
pnpm --filter @blue/app test -- cn.test.ts          # helper semantics: conflict resolution,
                                                    # text-role group, opaque passthrough, falsy parts
pnpm --filter @blue/app test -- ColorPicker         # caller-precedence component tests
pnpm --filter @blue/app test -- ScoreObjectBar
pnpm --filter @blue/app test -- CommitNumberInput
pnpm --filter @blue/app test -- Tracker             # py-1.5 effective, no py-1+py-1.5 duplication
```

Expected: all pass; the tracker assertions demonstrate the only intended behavior changes
(audited conflict fixes — everything else must render identical class lists).

## Gate 4 — Full package and repository checks

```bash
pnpm --filter @blue/app test
pnpm lint
git diff --check
```

Expected: no new failures relative to the pre-branch baseline (record the baseline first if any
pre-existing failures are known).

## Gate 5 — Manual smoke pass (SC-005; no visual-regression suite exists)

```bash
pnpm --filter @blue/app dev
```

Walk the named surfaces; expected observations:

| Surface | What to verify |
|---------|----------------|
| Tracker score-object editor | Open on a score object: field rows use the tighter/larger intended padding consistently (the `py-1.5` sites); no fields render double padding or jump between rows |
| Score toolbar / tempo & meter region bars | Buttons, toggle groups, and highlighted menu items look and behave as before |
| Color picker | Open (e.g., from a layer/color affordance): swatch cursor and layout unchanged; if invoked with custom classes from a caller, caller styling wins |
| Mixer | Channel strip chain entries: disabled/selected states, ring highlight unchanged |
| Workbench shell + auxiliary rail/slideout | Pane classes, slideout left/right variants, resize handles unchanged |
| Context menus (library, editor, toolbar) | Items, separators, shortcuts, disabled styling unchanged (retained BEM classes must still style) |
| jmask editor | Commit number inputs align; caller-className overrides win where used |
| blue-x7 tabs | Tab list scrolls, layout unchanged |
| File-manager / library / effects / code-repo trees | Twisties, selection, drop markers unchanged |
| Output panel, project properties, settings pages | Tabs, fields, dialogs unchanged |

Rule of thumb for any difference spotted: only the audited conflict fixes (tracker padding,
caller-override cases) may differ from the pre-migration app; anything else is a regression.

## Equivalence spot-check method (supports FR-004)

For each Wave 3 sub-batch, before deleting the branch-diff, pick 2–3 converted sites per area and
confirm in DevTools that the rendered class list equals the pre-migration list (compare against
`git show main:<file>` or the research inventory's expected tokens). Opaque BEM tokens must be
present verbatim.
