# Feature Specification: cn() Class-Composition Migration and Styling Boundary

**Feature Branch**: `097-cn-classname-migration`

**Created**: 2026-09-03

**Status**: Complete — automated validation and user-confirmed manual acceptance passed (2026-09-03)

**Input**: User description: "Migrate renderer className composition to the existing cn() helper (clsx + tailwind-merge) and establish a documented boundary between Tailwind utilities and BEM custom classes"

## User Scenarios & Testing *(mandatory)*

Developers maintain the renderer's ~3,020 `className` attributes across 245 components. A codebase
audit found 156 class-composition sites in 77 files that hand-roll conditional classes with
template literals and array joins (98 template-literal sites in 54 files, 58 class-building join
sites in 33 files, 10 files in both), while a purpose-built shared helper (`cn()`, combining
clsx and tailwind-merge with the seven `text-role-*` typography roles registered) already exists
but is used in only 3 files. Five shared components accept a caller's `className` by string
concatenation, silently dropping or duplicating conflicting utilities, and one score-object editor
already ships conflicting padding utilities whose winner is decided by generated CSS order rather
than component intent.

### User Story 1 - Safe Caller Style Overrides in Shared Components (Priority: P1)

Developers pass a `className` into a shared component (color picker swatch, toolbar display card,
commit number input, score object bar, blue-x7 tab list) expecting their utilities to take effect.
Today the component concatenates the caller's classes onto fixed base classes, so a conflicting
utility (for example a different padding) can be silently overridden or emitted twice with the
outcome decided by stylesheet order. After this story, all five components compose base and caller
classes through the shared helper so conflicts resolve deterministically in favor of the caller.

**Why this priority**: These are the only sites with a live override bug affecting any consumer
today; each is a small, independently verifiable diff.

**Independent Test**: Render each of the five components with a `className` containing a utility
that conflicts with its base classes and assert the caller's utility wins (for example, caller
padding overrides base padding). Deliverable value even if no other story lands.

**Acceptance Scenarios**:

1. **Given** `ColorPicker` with a caller `className`, **When** the swatch renders, **Then** the
   caller's classes are applied with caller precedence over conflicting base utilities.
2. **Given** `ScoreObjectBar` without any caller `className`, **When** it renders, **Then** the
   element carries no stray whitespace or empty class fragments.
3. **Given** `CommitNumberInput` (jmask) with and without a caller `className`, **When** rendered,
   **Then** class spacing is correct in both cases and the caller's conflicting utilities win.
4. **Given** `ToolbarDisplays` and the blue-x7 `tab-list` with caller classes, **When** rendered,
   **Then** base behavior (layout, scrolling) is unchanged and caller utilities resolve conflicts
   in the caller's favor.

---

### User Story 2 - Deterministic Utility Resolution in Score-Object Editors (Priority: P2)

Developers edit tracker score objects whose editor fields currently emit both `py-1` (from the
shared field-class constant) and `py-1.5` (appended at the call site) on the same element; the
rendered padding is whichever utility the generated stylesheet orders last, not what the editor
code expresses. After this story, the tracker editor's class constants and all other
constant-plus-utility composition sites resolve through the shared helper so the component's
intended utility is the only one emitted.

**Why this priority**: Fixes concrete, reproducible styling defects in primary editing surfaces
(score toolbar, tracker editor, piano roll snap, mixer strip) before the mechanical sweep.

**Independent Test**: Inspect the rendered class list of tracker editor fields (source, instrument,
note fields) and assert no element carries two conflicting utilities from the same group (for
example `py-1` and `py-1.5` together); assert the intended `py-1.5` styling displays.

**Acceptance Scenarios**:

1. **Given** the tracker editor open on a score object, **When** its text fields render, **Then**
   no element carries two utilities from the same conflict group, and fields intended to use
   `py-1.5` display that padding.
2. **Given** any component composing a named class constant with extra utilities (tracker panel,
   field, and button constants), **When** rendered, **Then** later utilities deterministically
   override earlier ones from the same group regardless of stylesheet order.
3. **Given** the seven `text-role-*` typography roles used in any composed class list, **When**
   classes merge, **Then** role classes are preserved or overridden as whole tokens and never
   stripped as unknown classes.

---

### User Story 3 - One Class-Composition Convention Across the Renderer (Priority: P3)

Developers reading any renderer component find conditional and composed class lists written the
same way everywhere: through the shared helper. The remaining ~93 interpolated template-literal
sites and 58 `[...].filter(Boolean).join(' ')` array sites (workbench shell, auxiliary
rail/slideout, UDO editor/table, file-manager and library trees, project property fields, editors,
and menu helpers) are converted, and a lint rule keeps new code from reintroducing template-literal
`className` composition. Non-class string building is explicitly out of scope and untouched.

**Why this priority**: Largest volume but lowest risk — mechanical, no behavior change expected;
done after the correctness fixes so the convention lands in its final shape.

**Independent Test**: A repository search over production renderer source finds zero
template-literal or array-join class composition in `className` positions (excluding the named
false-positive files), and the lint rule fails on a deliberately reintroduced template-literal
`className`.

**Acceptance Scenarios**:

1. **Given** a component with conditional classes previously built by array join (for example the
   workbench shell pane classes or a file-manager tree row), **When** rendered in each condition,
   **Then** the resulting class list is identical to before migration.
2. **Given** a new component written with `className={`...`}`, **When** lint runs, **Then** the
   file is rejected with a message pointing to the shared helper.
3. **Given** the named false-positive sites (SVG path building in `AutomationLineView` and
   `bsb/widgets/utils.ts`, error-message joins in `library-store`, the key list in
   `keyboard-mapping`, and dynamic `style` value interpolation), **When** audited after migration,
   **Then** they remain byte-identical to before.

---

### User Story 4 - Documented Styling Boundary Between Utilities and Custom CSS (Priority: P4)

Developers and agents writing new UI know, from project guidance, the one composition rule (all
composed classes go through the shared helper), the one source rule for new code (Tailwind
utilities; no new BEM blocks in the shared stylesheet), the explicit whitelist of legitimate
plain-CSS exceptions (theme tokens, third-party overrides such as dockview and CodeMirror,
keyframes, scrollbars, pseudo-elements), the deliberately retained custom classes (shared context
menu skins, structural shells), and the opportunistic strangler approach for the remaining ~180
app-owned BEM blocks. The app's styling guidance stays consistent with the typography role rules
already in project guidance.

**Why this priority**: Without the documented boundary the convention erodes; but it is
documentation, deliverable independently, and does not gate the code migrations.

**Independent Test**: The guidance is discoverable from the repository's agent/developer
instructions and states composition rule, source rule, exception whitelist, retain list, and
strangler policy; a developer survey of the doc answers "where do I put new styles?" without
further context.

**Acceptance Scenarios**:

1. **Given** a developer writing a new panel component, **When** they consult project UI guidance,
   **Then** it unambiguously directs conditional classes through the shared helper and new styling
   toward utilities over new custom classes, with the exception whitelist.
2. **Given** the retained custom classes (context menu items and separators, workbench shell,
   auxiliary slideout, edge rail), **When** the boundary is documented, **Then** they are named as
   deliberately retained rather than pending deletion, so future cleanup does not "fix" them
   wholesale.
3. **Given** a future feature touching a component with a simple BEM block (for example the mixer
   chain entries or output panel tabs), **When** following the boundary, **Then** the contributor
   knows porting that block to utilities in the same change and deleting the CSS is the preferred
   path.

### Edge Cases

- Custom, non-utility classes (BEM names such as `mixer-chain-entry--disabled`, and utility-lookalikes
  unknown to the merge layer such as `scrollbar-thin`) pass through composition unchanged — they
  must never be dropped, and conflicting-utility resolution must not be expected for them.
- Optional `className` props (`className ?? ''`, undefined/empty callers) must yield class lists
  without stray whitespace, duplicate spaces, or trailing fragments.
- Non-class template strings and joins must be excluded by the migration and by any lint rule:
  SVG path data (`AutomationLineView`, `bsb/widgets/utils.ts`), error text (`library-store.ts`),
  keyboard key enumeration (`keyboard-mapping.ts`), and dynamic `style` property values (pixel
  offsets, transforms, font names in the piano roll, library tree indent, REPL prompt, font
  chooser).
- Tests that assert on custom class names (`render-freeze-actions.test.tsx` and menu-class
  selectors) must keep passing: retained custom classes keep their names; where a class list
  changes (resolved conflicts), affected assertions are updated deliberately in the same change.
- Static (non-interpolated) template-literal `className` values found by the sweep may be unwrapped
  to plain strings; the audit found the interpolated count equals the total, so this is expected to
  be rare to nonexistent.
- Merge behavior must be validated against the seven `text-role-*` roles: a later role must replace
  an earlier role token, and role classes must survive merges that unrelated utilities initiate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All production renderer components that build a `className` from multiple parts
  (constants, conditionals, caller input) MUST compose them through the shared `cn()` helper
  (`packages/blue-app/src/renderer/lib/cn.ts`); template-literal and
  array-`filter(Boolean).join(' ')` class composition MUST be eliminated from production renderer
  source, except the explicitly excluded non-class join sites named in User Story 3.
- **FR-002**: The five caller-`className` components (`ColorPicker.tsx`,
  `menu-bar/ToolbarDisplays.tsx`, `score-object/editors/jmask/CommitNumberInput.tsx`,
  `score/bar-renderers/ScoreObjectBar.tsx`, `instruments/blue-x7/tab-list.tsx`) MUST accept caller
  classes with deterministic caller precedence over conflicting base utilities, and MUST produce
  clean class lists when no caller `className` is provided.
- **FR-003**: The tracker editor composition sites (`TrackerScoreObjectEditor.tsx` lines ~690, 700,
  710 composing `TRACKER_FIELD_CLASS`/`TRACKER_MONO_FIELD_CLASS` with `py-1.5`) MUST resolve so no
  element carries two utilities of the same conflict group and the intended `py-1.5` is effective.
- **FR-004**: The migration MUST NOT alter rendered class semantics except where it resolves the
  audited conflicts (User Stories 1–2); for every other migrated site, the final class list must be
  equivalent to the pre-migration list.
- **FR-005**: Non-class string building (SVG paths, error joins, key enumerations) and dynamic
  `style` value interpolation MUST remain unchanged.
- **FR-006**: A repository lint check MUST reject template-literal `className` composition in
  production renderer code (with the message directing to `cn()`), and MUST NOT flag the excluded
  non-class sites.
- **FR-007**: Project guidance (AGENTS.md UI section and/or the typography/style doc it references)
  MUST be updated in the same change to state: the single composition rule, the utilities-first
  source rule for new styling, the plain-CSS exception whitelist (theme tokens, third-party
  overrides, keyframes, scrollbars, pseudo-elements), the deliberately retained custom classes, and
  the strangler policy for remaining BEM blocks.
- **FR-008**: The feature MUST NOT wholesale replace or rename existing BEM custom classes; shared
  menu skins and structural shell classes remain custom classes with their current names.
- **FR-009**: The `text-role-*` merge registration in `cn()` MUST continue to treat the seven roles
  as a single conflict group; migration MUST introduce no raw font-size or arbitrary pixel text
  classes, per the typography guidance.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: N/A — renderer styling-only refactor. No Java Blue parity, `.blue` XML,
  CSD generation, settings, or external-runtime surface is touched; UI visual output is intended to
  be identical except the audited conflict fixes.
- **Compatibility Requirements**: Rendered UI must remain visually identical (other than resolved
  padding/conflict fixes in User Stories 1–2); retained custom class names must keep their names so
  stylesheet rules and tests referencing them keep working; `@blue/data` and all main-process code
  must be untouched.
- **Intentional Divergences**: None. The conflict resolutions in User Stories 1–2 are bug fixes
  aligning rendered output with component intent, not behavior changes.
- **State Ownership**: No state domains affected; styling is derived, disposable render detail.

### Key Entities

- **cn() class-composition helper**: the single canonical utility for combining class names;
  owns conditional composition, falsy handling, and conflicting-utility resolution including the
  `text-role-*` group.
- **Custom stylesheet (`renderer/styles/index.css`)**: owns theme tokens (`@theme`), third-party
  overrides (dockview `.dv-*`, CodeMirror `.cm-*`), keyframes, and the retained app-owned BEM
  blocks; no new BEM blocks after this feature.
- **Styling boundary guidance**: the documented rules (composition, source, whitelist, retain list,
  strangler policy) that govern where new styling goes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero template-literal or array-join class-composition sites remain in production
  renderer source (baseline: 98 template-literal sites in 54 files plus 58 class-building join
  sites in 33 files — 156 sites in 77 distinct files), verified by repository search using the
  audit's method.
- **SC-002**: 100% of the five audited caller-`className` components resolve caller utility
  conflicts in the caller's favor, verified by component-level assertions.
- **SC-003**: No tracker-editor element carries duplicate same-group utilities; all editor surfaces
  named in User Story 2 render their intended spacing, verified by inspection of rendered class
  lists.
- **SC-004**: A developer or agent, given only the updated guidance, correctly decides where new
  styling goes and how classes are composed (walkthrough of the boundary doc against three
  representative cases: a new panel, a dockview override, an animation).
- **SC-005**: Full `@blue/app` test suite and lint pass with no new failures, and a manual smoke
  pass over the affected surfaces (tracker editor, score toolbar, mixer, workbench shell, menus,
  color picker, blue-x7 tabs, output panel) shows no visual regressions.

## Closeout Evidence

- Full `@blue/app` validation passed: 425 test files, 4,052 tests passed, and 2 tests skipped.
- Repository lint passed, including the renderer typography audit and the `className` composition
  guard.
- Convergence found no remaining gaps against the specification, plan, tasks, or constitution.
- Manual smoke testing was user-confirmed on 2026-09-03 with no visual regressions observed.

## Assumptions

- Scope is limited to `packages/blue-app` renderer production source; `@blue/data`, main process,
  preload, and test infrastructure are out of scope except where tests assert on class names.
- The existing `cn()` helper is accepted as-is (including its `text-role-*` group registration);
  no changes to the helper's conflict configuration are anticipated.
- No wholesale BEM-to-utility conversion in this feature; the ~180 app-owned BEM blocks are
  addressed opportunistically in future feature work per the strangler policy.
- Dynamic `style` value interpolation and inline styles are legitimate and stay as-is.
- The audit inventory (recorded in the conversation and summarized in this spec's stories) is the
  authoritative baseline; the temporary research note at `.tmp-research/CSS_STYLE_CLEANUP.md` is a
  convenience copy, not a dependency.
- A visual regression suite is not available; visual preservation is validated by a named-surface
  manual smoke pass plus class-list equivalence checks.
