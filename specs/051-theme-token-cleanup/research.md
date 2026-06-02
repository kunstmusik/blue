# Research: Centralized Renderer Theming

## Current Report Review

### STYLING_GPT54.md

- **Decision**: Treat this report as the current partial implementation baseline, not just an audit.
- **Rationale**: The worktree already contains GPT54 changes: settings components were moved away from inline palette styles, `packages/blue-app/src/renderer/lib/cn.ts` exists, `tailwind.config.mjs` no longer owns color values, and generic button CSS was removed from `index.css`.
- **Alternatives considered**: Re-running the earlier recommendations unchanged would duplicate or undo current work.

### STYLING_REPORT_GLM.md

- **Decision**: Use GLM's broad inventory as a migration backlog, but mark settings-specific and generic-button findings as stale where GPT54 already fixed them.
- **Rationale**: GLM correctly identifies remaining arbitrary color utilities, custom CSS, Blue Live inline colors, toast duplication, and undefined token aliases.
- **Alternatives considered**: Accepting all counts literally would overstate settings debt because the current tree has no `style={{...}}` blocks under the settings components.

### STYLING_REPORT_MIMO.md

- **Decision**: Use MIMO's token-expansion and phased migration strategy as the closest match for implementation sequencing.
- **Rationale**: It distinguishes utility migration from legitimate custom CSS boundaries and calls out Dockview, CodeMirror, BSB widget parity colors, and high-frequency hardcoded values.
- **Alternatives considered**: A pure "delete all custom classes" approach would damage third-party integration selectors and complex workbench/mixer CSS.

## Independent Current-State Findings

- **Decision**: Scope the feature to current verified worktree state after GPT54 changes.
- **Rationale**: `git status` shows GPT54 changes are uncommitted but active on the new branch. Independent audit commands found:
  - 208 arbitrary color utility uses in renderer components.
  - 131 raw color literals in `packages/blue-app/src/renderer/styles/index.css`.
  - 213 inline style attributes in renderer components, with 46 containing static color-like values.
  - Blue Live has the densest static inline style color usage: `LiveSpaceTab.tsx`, `OptionsTab.tsx`, `LiveCodeTab.tsx`, and `BlueLivePanel.tsx`.
  - `text-blue-text` is used broadly, but the theme currently defines no `--color-blue-text` alias.
  - Settings components are already clean of static inline style usage and should not be reworked unnecessarily.
- **Alternatives considered**: Starting from pre-GPT54 counts would create stale tasks and risk conflicting with active changes.

## Theme Source

- **Decision**: Keep `packages/blue-app/src/renderer/styles/index.css` and Tailwind v4 `@theme` as the canonical app theme source.
- **Rationale**: The current app already imports Tailwind in `index.css`; GPT54 moved semantic app tokens there and reduced `tailwind.config.mjs` to content configuration. Tailwind v4 exposes `@theme` tokens directly to utility classes and CSS variable references.
- **Alternatives considered**:
  - Put colors back into `tailwind.config.mjs`: rejected because it reintroduces duplicate theme sources.
  - Move tokens to a TypeScript object: rejected because CSS integrations like Dockview and custom selectors need CSS variables directly.

## Token Expansion

- **Decision**: Add missing semantic app roles for repeated renderer values before performing broad replacements.
- **Rationale**: Current repeated values map to roles that do not yet exist, such as deep input, field, menu, editor, tab, elevated/popup, divider, highlight, and bright/dim text. Replacing arbitrary values with poorly named nearest matches would hide useful UI distinctions.
- **Alternatives considered**: Only use current `app-*` roles. Rejected because it would overload `app-surface-strong` and `app-canvas` with too many meanings.

## Compatibility Aliases

- **Decision**: Keep legacy `blue-*` aliases during migration and add missing aliases required by current classes.
- **Rationale**: Many renderer files still use `text-blue-text`, `bg-blue-hover`, and related legacy names. A bridge keeps migration incremental and avoids accidental visual breakage.
- **Alternatives considered**: Replace every legacy alias in one pass. Rejected because the broader renderer already has enough color drift to justify smaller independently testable slices.

## Custom CSS Policy

- **Decision**: Retain custom class names only for integration boundaries and complex selectors; replace their static palette literals with theme variables.
- **Rationale**: Workbench rails, Dockview variables, context menus, scrollbars, mixer/output CSS, BSB tooltips, animations, and selected editor shell styles use selectors or pseudo-elements that Tailwind utilities cannot express cleanly.
- **Alternatives considered**: Flatten all custom classes into component utilities. Rejected because it would make third-party and pseudo-selector styling harder to maintain.

## Inline Style Policy

- **Decision**: Keep inline styles for dynamic layout, measured geometry, user/project data, canvas positioning, and parity/data colors; remove static app palette colors from inline styles.
- **Rationale**: Many inline styles encode widths, transforms, cursor geometry, and data colors. Those are not theme drift. Blue Live and some editor/score surfaces, however, still use inline static palette colors that should be migrated.
- **Alternatives considered**: Ban all inline styles. Rejected because score, piano roll, BSB, waveform, and virtualized surfaces require dynamic geometry.

## Editor and Third-Party Palettes

- **Decision**: Tokenize editor chrome and app shell colors; keep syntax-specific colors in a named syntax palette or exception list.
- **Rationale**: CodeMirror chrome should follow app theme roles, while syntax colors may intentionally follow a separate language palette. Dockview and Radix context menu bridges should use CSS variables from app tokens.
- **Alternatives considered**: Force syntax highlighting into app text/accent roles. Rejected because it would reduce code readability.

## BSB and Java Blue Parity Colors

- **Decision**: Preserve Java Blue-compatible BSB widget colors unless they are app chrome wrappers.
- **Rationale**: Some widget colors are part of parity/saved interface behavior rather than app theme. The exception record must distinguish those from ordinary panel, field, and border colors.
- **Alternatives considered**: Theme all BSB SVG/widget colors. Rejected for this slice because it risks Java Blue parity regressions.

## Validation Strategy

- **Decision**: Add a repeatable audit that reports unapproved arbitrary utilities, raw CSS palette literals, static inline colors, and undefined token aliases.
- **Rationale**: Manual search findings are already divergent across reports. A single audit contract keeps future handoffs factual.
- **Alternatives considered**: Rely on ad hoc `rg` commands in handoff notes. Rejected because it does not scale and cannot distinguish approved exceptions.
