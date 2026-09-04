# Research: cn() Class-Composition Migration and Styling Boundary

**Feature**: 097-cn-classname-migration | **Date**: 2026-09-03
**Status**: All Phase 0 unknowns resolved; no NEEDS CLARIFICATION remains.

## R0 — Durable migration inventory (regenerated 2026-09-03)

The spec's Assumptions name the conversation inventory as authoritative; this section makes it
durable inside the spec tree. Counts: **98 template-literal `className` occurrences in 54 files**
plus **58 class-building `.join(' ')` occurrences in 33 files** = **156 sites in 77 distinct
files** (10 files appear in both lists). Re-run the commands in `quickstart.md` at implementation
time; drift since 2026-09-03 is expected to be zero (no feature work on this branch).

**Confirmed Baseline (T001 - 2026-09-03)**:
- Template-literal search (`rg -n 'className=\{`'`): 98 occurrences in 54 files confirmed.
- Raw join search (`rg -n "join\(' '\)|filter\(Boolean\)\.join"`): 66 occurrences in 37 files (8 occurrences across 4 excluded files; exactly 58 class-building occurrences in 33 files) confirmed.
- `@blue/app` test suite: 422 test files passed, 4034 tests passed, 2 skipped, 0 failures. Baseline is fully green.


### Wave 1 — caller-`className` components (5 sites, 5 files)

| File | Site |
|------|------|
| `components/ColorPicker.tsx` | :208 `` `cursor-pointer ${className}` `` |
| `components/menu-bar/ToolbarDisplays.tsx` | :40 `` `toolbar-display-card ${className}`.trim() `` |
| `components/workbench/panels/score-object/editors/jmask/CommitNumberInput.tsx` | :57 manual conditional spacing |
| `components/workbench/panels/score/bar-renderers/ScoreObjectBar.tsx` | :58 `` `absolute overflow-hidden ${className ?? ''}` `` |
| `components/instruments/blue-x7/tab-list.tsx` | :101 base string + caller className |

### Wave 2 — audited conflict sites

- `TrackerScoreObjectEditor.tsx` :690, :700 (`w-full ${TRACKER_FIELD_CLASS} py-1.5` → both `py-1`
  and `py-1.5` emitted) and :710 (`TRACKER_MONO_FIELD_CLASS` + `py-1.5`, same conflict).
  `TRACKER_FIELD_CLASS` (:69) carries `py-1`; constants defined :61–:73; `TRACKER_MONO_FIELD_CLASS`
  itself built by template literal at :70.

### Wave 3a — template-literal files (54, 98 occurrences)

Heaviest first: `score-object/editors/TrackerScoreObjectEditor.tsx` (18),
`score/ScoreToolbar.tsx` (6), `ScorePanel.tsx` (4), `pianoroll/PianoRollSnapButton.tsx` (3),
`project-properties/ClojureProjectTab.tsx` (3), `mixer/ChannelStrip.tsx` (3), then 2-site and
1-site files: `tools/SoundFontViewerPanel.tsx`, `score/layer-groups/ScoreTimeCanvas.tsx`,
`score/TrackInstrumentControl.tsx`, `score/TempoRegionBar.tsx`, `score/ScoreManagerDialog.tsx`,
`score-object/note-processors/NoteProcessorChainEditor.tsx`, `score-object/editors/PianoRollEditor.tsx`,
`score-object/editors/PatternObjectEditor.tsx`, `score-object/editors/FileBackedScoreObjectEditor.tsx`,
`audio-player/AudioPlayerPanel.tsx`, `settings/MidiSettings.tsx`, `instruments/blue-x7/tab-list.tsx`,
`ColorPicker.tsx`, `shared/line-editor/LineDefinitionTable.tsx`,
`shared/line-editor/EditableLineCanvas.tsx`, `score/bar-renderers/ScoreObjectBar.tsx`,
`score/automation/AutomationLayerOverlay.tsx`, `score/TempoMapEditorDialog.tsx`,
`score/TempoLineView.tsx`, `score/ScorePathBar.tsx`, `score/PatternLayerHeader.tsx`,
`score/MeterMapEditorDialog.tsx`, `score/ColumnHeader.tsx`, `pianoroll/TimeBar.tsx`,
`pianoroll/PianoRollPropertiesEditor.tsx`, `pianoroll/PianoRollCanvas.tsx`,
`jmask/generator-editors.tsx`, `jmask/CommitNumberInput.tsx`, `score-object/editors/TrackerObjectEditor.tsx`,
`score-object/editors/SoundEditor.tsx`, `score-object/editors/ExternalScoreObjectEditor.tsx`,
`project-properties/ProjectPropertyFields.tsx`, `project-properties/ProjectInformationTab.tsx`,
`output/OutputPanel.tsx`, `orchestra/bsb/BSBInterfaceCanvas.tsx`, `midi-input/MidiInputProcessorForm.tsx`,
`ScratchPadPanel.tsx`, `FreezeOperationDialog.tsx`, `AuxiliaryRail.tsx`,
`settings/RealtimeRenderSettings.tsx`, `settings/OscSettings.tsx`, `menu-bar/ToolbarDisplays.tsx`,
`libraries/LibraryTree.tsx`, `libraries/LibraryDropMarker.tsx`,
`libraries/LibraryContextMenu.tsx`, `instruments/blue-x7/common-panel.tsx`,
`instruments/blue-x7/algorithm-dialog.tsx`, `about/AboutApp.tsx`.
(All paths relative to `packages/blue-app/src/renderer/components/`.)

### Wave 3b — class-building join files (33, 58 occurrences)

`workbench/WorkbenchShell.tsx` (3), `orchestra/SplitPane.tsx` (6, includes helper functions),
`panels/editors/CsoundEditorContextMenu.tsx` (2, includes `getMenuItemClassName` helper),
`udo/UdoEditor.tsx` (2), `udo/UdoTable.tsx` (2), `tools/file-manager/FileManagerTree.tsx` (2),
`project-properties/ProjectPropertyFields.tsx` (2), `bsb/PresetsManagerDialog.tsx` (2),
`bsb/BSBInterfaceEditor.tsx` (2), `InstrumentEditorPanel.tsx` (2), `effects-library/EffectLibraryTree.tsx` (2),
`code-repository/CodeRepositoryTree.tsx` (2), `AuxiliaryRail.tsx` (2), `AuxiliarySlideout.tsx` (2),
`effect-editor/EffectEditorPanel.tsx` (3), `orchestra/BlueSynthBuilderEditor.tsx` (3), and 1-site
files: `bsb/widgets/WidgetWrapper.tsx`, `bsb/BSBCodeEditor.tsx`, `orchestra/PythonInstrumentEditor.tsx`,
`orchestra/JavaScriptInstrumentEditor.tsx`, `orchestra/GenericInstrumentEditor.tsx`,
`orchestra/ArrangementPanel.tsx`, `score-object/editors/ObjectBuilderScoreObjectEditor.tsx`,
`score-object/editors/SoundEditor.tsx`, `score-object/editors/FileBackedScoreObjectEditor.tsx`,
`mixer/ChannelStrip.tsx`, `VirtualKeyboardPanel.tsx`, `ScorePanel.tsx`,
`ProjectPropertiesPanel.tsx`, `libraries/LibraryDropMarker.tsx`, `PatternLayerHeader.tsx`,
`ScoreTimeCanvas.tsx`, `EditableLineCanvas.tsx`.

### Excluded from migration (false positives — MUST remain unchanged)

- `panels/score/automation/AutomationLineView.tsx` (:196, :269 — SVG path data)
- `orchestra/bsb/widgets/utils.ts` (:154 — SVG path data)
- `stores/library-store.ts` (:285, :316, :736, :737 — error-message text)
- `panels/virtual-keyboard/keyboard-mapping.ts` (:40 — key enumeration)
- All `style={{ ... }}` dynamic value interpolation (piano roll transforms, library tree indent,
  REPL prompt width, font chooser families) — legitimate inline styling.

## D1 — Lint enforcement mechanism

**Decision**: Add `no-restricted-syntax` entries to the existing flat config
(`eslint.config.mjs`) in a new block scoped to `packages/blue-app/src/renderer/**/*.{ts,tsx}`,
with two selectors:

1. `JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral`
2. `JSXAttribute[name.name='className'] JSXExpressionContainer CallExpression[callee.property.name='join']`

Message: use `cn()` from `@/lib/cn` (renderer alias) / `src/renderer/lib/cn.ts`.

**Rationale**: The config already uses exactly this shape — scoped file blocks with
`no-restricted-syntax` and directional messages (the `dialog.showMessageBox` ban at
`eslint.config.mjs:96-106` is the direct precedent). The existing test-file exception block
(`eslint.config.mjs:140-153`, later in the config so it wins) already disables
`no-restricted-syntax` for `*.test.{ts,tsx}` and `tests/**`, matching the spec's
production-only scope.

**Limitation (documented deliberately)**: helper functions returning joined class strings
(`getMenuItemClassName`, `SplitPane` pane/handle builders, `WidgetWrapper`) are not caught by
JSX-position selectors, and a blanket `.join(' ')` ban would false-positive on the excluded
SVG/error/key sites. Helpers are converted in the Wave 3 sweep and covered by the exhaustive
`rg` gate in `quickstart.md`; the lint rule guards the common reintroduction path (inline JSX).

**Alternatives considered**: custom ESLint plugin rule (rejected: over-engineering for this
repo's flat-config precedent); blanket `ArrayExpression ... join` ban (rejected: false positives
on excluded sites); no lint (rejected: convention erodes — the audit itself found three years of
drift after `cn()` was introduced).

## D2 — Test strategy

**Decision**: Three tiers, all in existing harnesses (no new dependencies):

1. **Helper unit tests** (new `src/renderer/lib/cn.test.ts`, plain vitest): last-wins conflict
   resolution (`py-1` vs `py-1.5`), falsy part handling (undefined/''/false), opaque passthrough
   of BEM and unknown classes (`mixer-chain-entry--disabled`, `scrollbar-thin`), and the seven
   `text-role-*` roles as one conflict group (later role replaces earlier; unrelated utilities
   don't strip roles). This locks FR-009 semantics.
2. **Component tests** for Wave 1 (jsdom, house pattern from
   `src/renderer/tests/render-freeze-actions.test.tsx`: `// @vitest-environment jsdom`,
   `createRoot` + `act`, assert `element.className`): render each caller-`className` component
   with a conflicting utility and assert caller precedence; render without `className` and assert
   no stray whitespace/empty fragments. Feasible for at minimum `ColorPicker`, `ScoreObjectBar`,
   `CommitNumberInput`; `ToolbarDisplays` and `tab-list` if their store dependencies stay
   mockable at reasonable cost — otherwise their precedence is covered by tier 1 semantics plus
   the mechanical single-line change (`cn(base, className)`).
3. **Wave 2 regression**: assert the tracker field class list contains `py-1.5` and not `py-1`
   (jsdom render if the editor mounts cheaply, else a focused assertion composing the exported
   constants through `cn`).

**Rationale**: Matches the constitution's "lowest practical boundary" rule; the repo already
renders React in jsdom without @testing-library.

**Alternatives considered**: `@testing-library/react` (rejected: new dependency, no house
precedent); browser-mode vitest for all tiers (rejected: slower, reserved for interaction-heavy
suites like tree DnD).

## D3 — Class-list equivalence verification

**Decision**: No DOM-snapshot harness. Equivalence is verified by (a) the mechanical nature of
the conversion (`{`a ${b}`}` → `cn('a', b)` is semantics-preserving except documented conflict
fixes), (b) targeted tests from D2, (c) the exhaustive `rg` zero-site gates in `quickstart.md`,
and (d) the manual smoke pass over named surfaces (SC-005).

**Rationale**: A before/after rendered-DOM snapshot harness would require driving ~80 components
in a harness with store fixtures — disproportionate to a styling refactor with no visual-regression
infrastructure. The constitution accepts manual validation when automation is impractical, provided
it is deterministic (quickstart names surfaces and expected observations).

**Alternatives considered**: per-site Playwright screenshots (rejected: infra doesn't exist,
flake-prone); string-level codemod with AST diff (rejected: 156 sites across 81 files converts
faster by hand-with-review than by writing and validating a codemod).

## D4 — Constants strategy

**Decision**: Keep named class-string constants (`TRACKER_FIELD_CLASS`, `INPUT_CLASS`,
`TRIGGER_CLASS`, `FIELD_INPUT_CLASS`, …) as plain strings; change only composition at use sites to
`cn(CONSTANT, ...overrides)`. Follows the existing precedent `AppSelect.tsx:77`
(`cn(TRIGGER_CLASS, className)`) and `SettingsField.tsx:55` (`cn(FIELD_INPUT_CLASS, inputClassName)`).

**Rationale**: Constants remain greppable and diffable; the migration stays surgical (constitution:
simplest design preserving contracts). Exception: `TrackerScoreObjectEditor.tsx:70`
`TRACKER_MONO_FIELD_CLASS = `${TRACKER_FIELD_CLASS} font-mono`` becomes a plain concatenation-free
composition — either `cn(TRACKER_FIELD_CLASS, 'font-mono')` at definition or inline at its use
sites; plan leaves the mechanical choice to implementation with a single rule: no template literal
in the final source.

**Alternatives considered**: dissolving constants into per-site cn() calls (rejected: loses naming
and bloats diffs); converting constants to arrays (rejected: churn without benefit).

## D5 — Boundary documentation location

**Decision**: Extend the **AGENTS.md "UI and typography guidance" section** with a concise
"class styling composition" subsection stating: composition rule (all composed classes via `cn()`
from `src/renderer/lib/cn.ts`), source rule (new styling uses Tailwind utilities; no new BEM
blocks in `renderer/styles/index.css`), exception whitelist (`@theme` tokens, third-party
`.dv-*`/`.cm-*` overrides, keyframes, scrollbars, pseudo-elements), retain list (shared context
menu skins, `workbench-shell`, auxiliary slideout, edge rail), and strangler policy (port simple
BEM blocks opportunistically when already touching a component; never batch). `docs/typography.md`
is NOT modified — typography roles, metrics, and ownership are unchanged by this feature.

**Rationale**: AGENTS.md is the canonical cross-cutting guidance file by its own header comment
("stable, cross-cutting rules; feature-specific requirements belong in specs/"); FR-007 allows
exactly this. A separate `docs/styling.md` would split guidance across two places agents must read.

**Alternatives considered**: new `docs/styling.md` (rejected: guidance fragmentation);
constitution amendment (rejected: no principle changes — this is convention, not governance).

## D6 — Migration wave structure

**Decision**: Waves in spec-story order, each independently verifiable and committable:

- **Wave 0** — `cn.test.ts` helper semantics lock (D2 tier 1).
- **Wave 1** — five caller-`className` components + component tests (FR-002, SC-002).
- **Wave 2** — tracker conflict sites + regression test (FR-003, SC-003).
- **Wave 3** — mechanical sweep, sub-batched by area for reviewable PR-sized diffs:
  score panels → score-object editors → orchestra/BSB → workbench shell/aux → trees/libraries →
  settings/about/misc → shared line-editor. Lint rule lands at the end of Wave 3 (it can only be
  enabled when the tree is clean).
- **Wave 4** — AGENTS.md boundary subsection (FR-007) + final full verification.

**Rationale**: Correctness fixes before mechanics; lint activation must trail the sweep or the
build is red mid-feature; area batching keeps each diff reviewable against the D3 equivalence
argument.

**Alternatives considered**: single big-bang sweep (rejected: unreviewable 81-file diff);
lint-first with inline disables (rejected: noise and churn).
