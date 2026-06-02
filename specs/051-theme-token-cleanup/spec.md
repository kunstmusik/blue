# Feature Specification: Centralized Renderer Theming

**Feature Branch**: `051-theme-token-cleanup`  
**Created**: 2026-05-29  
**Status**: Draft  
**Input**: User description: "Review the three concurrent STYLING reports, perform an independent current-state review, and create a Spec Kit feature for centralizing the app theme so renderer styling goes through named theme values and project-standard utility styling rather than scattered literal colors and ad hoc class names."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change Theme Roles From One Place (Priority: P1)

As a maintainer, I want the renderer's static color palette to be expressed through a canonical set of named theme roles so a future color adjustment can be made in one place and reliably affect settings, workbench chrome, editor chrome, menus, dialogs, mixer/output panels, score surfaces, and app entry points.

**Why this priority**: The current reports and independent review show that the settings cleanup is only a partial fix. Remaining hardcoded colors and undefined token aliases make theme changes risky and difficult to reason about.

**Independent Test**: Change one representative theme role in the canonical theme definition, rebuild the renderer, and verify that at least settings, workbench chrome, context menus, and one editor surface consume the updated role without component-local color edits.

**Acceptance Scenarios**:

1. **Given** the canonical theme roles are defined, **When** a maintainer searches renderer source for static palette literals, **Then** every remaining static literal is either inside the theme definition or listed in an approved exception record.
2. **Given** a component uses a named color utility or alias, **When** the renderer builds, **Then** the generated class resolves to an existing theme role with no undefined theme names.
3. **Given** GPT54's settings cleanup is present, **When** the settings window is inspected, **Then** it remains free of static inline theme colors and continues to use shared settings styling primitives.

---

### User Story 2 - Replace Ad Hoc Component Palette Usage (Priority: P2)

As a developer extending renderer UI, I want commonly repeated backgrounds, borders, text levels, highlights, and status colors to have named roles so new components can reuse established styling instead of inventing arbitrary hex values.

**Why this priority**: The current tree still has repeated arbitrary values such as deep input, field, menu, editor, tab, and highlight colors across score, BSB, editor, Blue Live, effect, arrangement, and modal surfaces.

**Independent Test**: Audit renderer components after the migration and confirm the high-frequency arbitrary color values have been replaced by named roles or approved exceptions, with representative component tests or visual checks covering each migrated surface family.

**Acceptance Scenarios**:

1. **Given** a renderer component needs a static background, border, text, or highlight color, **When** it is implemented or refactored, **Then** it uses a named theme role through the project styling path.
2. **Given** inline styles remain in a component, **When** they are reviewed, **Then** they express dynamic geometry, measured layout, user/project data, or documented integration requirements rather than static theme colors.
3. **Given** entry points configure shared UI surfaces such as toasts, **When** their theme styling is inspected, **Then** duplicated palette objects have been replaced by one shared theme-aware definition.

---

### User Story 3 - Keep Necessary Custom Styling Boundaries Explicit (Priority: P3)

As a maintainer, I want unavoidable custom CSS and editor/library theme APIs to be documented and token-backed so Tailwind-first styling remains the default without breaking third-party integrations, pseudo-element selectors, canvas-like rendering, or Java Blue visual parity.

**Why this priority**: Some existing custom class names are legitimate integration boundaries, but the same files also contain private palette values. The team needs a rule that distinguishes acceptable custom CSS from drift.

**Independent Test**: Review the retained custom styling inventory and verify each retained boundary uses named theme roles where possible and has an explicit reason when literal values remain.

**Acceptance Scenarios**:

1. **Given** Dockview, CodeMirror, context menus, scrollbars, mixer/output CSS, BSB tooltips, or animation rules require CSS selectors or third-party theme APIs, **When** the implementation is reviewed, **Then** those surfaces keep custom wrappers only where needed and consume canonical theme roles for static palette values.
2. **Given** BSB widgets or score rendering use Java Blue-compatible or project-data-driven colors, **When** the audit is reviewed, **Then** those values are either preserved as parity/data exceptions or moved into named roles if they are app chrome.
3. **Given** the implementation is complete, **When** a new styling drift check is run, **Then** it reports no unapproved static palette values or undefined token aliases.

### Edge Cases

- Dynamic score, piano roll, BSB, waveform, and canvas positioning styles may continue to use inline styles when values are computed from project data, measured geometry, or interaction state.
- Java Blue-compatible BSB widget colors should not be made themeable unless the migration proves they are app chrome rather than saved/project semantics.
- CodeMirror syntax highlighting may need a separate syntax palette from app chrome, but the palette still needs a named source or an approved exception.
- Third-party CSS variable bridges may require custom class hooks even when their values are token-backed.
- Generated Tailwind classes that use legacy aliases must remain valid until aliases are intentionally removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The renderer MUST have one canonical theme role inventory for static app colors, including backgrounds, surfaces, fields, inputs, menus, editor surfaces, borders, dividers, text hierarchy, highlights, accents, warnings, and danger states.
- **FR-002**: The canonical theme inventory MUST include compatibility aliases for legacy renderer color names that are still used during migration, including a valid text alias for existing `text-blue-text` usage.
- **FR-003**: Renderer components MUST use named theme roles through project-standard utility styling for static background, border, text, accent, and highlight colors.
- **FR-004**: Renderer inline styles MUST be limited to dynamic geometry, measured layout, user/project data, data-driven colors, or documented integration requirements.
- **FR-005**: Retained custom CSS classes MUST be limited to integration or selector cases that utility classes cannot express cleanly, and their static palette values MUST reference canonical theme roles whenever possible.
- **FR-006**: Third-party and editor theme bridges MUST consume canonical theme roles for app chrome and document any syntax, parity, or data colors that remain outside those roles.
- **FR-007**: Shared entry-point styling for repeated surfaces such as toast notifications MUST be centralized rather than duplicated as separate palette objects.
- **FR-008**: The settings subsystem MUST remain on the shared utility-first primitives introduced by the current GPT54 changes and MUST not regress to static inline palette styles.
- **FR-009**: The implementation MUST provide an auditable exception record for any remaining literal palette value, including file, value, reason, and whether it is temporary or intentionally preserved.
- **FR-010**: The implementation MUST provide repeatable validation steps that detect unapproved arbitrary color utilities, undefined theme aliases, unapproved static inline colors, and raw CSS palette literals outside the canonical theme or exception record.
- **FR-011**: The implementation MUST preserve the current dark visual identity and must not introduce a light/dark theme switch in this slice.
- **FR-012**: The implementation MUST preserve existing renderer behavior for workbench layout, score editing, mixer/output panels, editor interactions, BSB editing, Blue Live surfaces, and settings workflows.

### Key Entities *(include if feature involves data)*

- **Theme Role**: A named semantic color role used by renderer UI, with a stable name, value, purpose, and optional legacy alias.
- **Styling Surface**: A renderer UI area or integration boundary that consumes theme roles, such as settings, workbench shell, Dockview, CodeMirror, score, BSB, mixer, output, dialogs, Blue Live, or app entry points.
- **Exception Record**: A documented literal palette value that remains after migration because it is data-driven, parity-bound, syntax-specific, or otherwise not app chrome.
- **Validation Check**: A repeatable audit step that verifies theme usage and identifies unapproved drift.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A static palette audit reports zero unapproved arbitrary color utilities in renderer component files after approved exceptions are excluded.
- **SC-002**: A CSS palette audit reports zero unapproved raw color literals outside the canonical theme definition and approved exception records.
- **SC-003**: A static inline-style audit reports zero unapproved static theme colors in renderer inline style objects after dynamic layout/data exceptions are excluded.
- **SC-004**: All legacy color aliases still referenced by renderer classes resolve to canonical theme roles during a renderer build.
- **SC-005**: At least eight representative surfaces are visually checked after migration: settings, workbench shell, context menus, score editor, selected code editor, mixer/output panel, BSB interface, Blue Live, and effect editor.
- **SC-006**: Existing automated validation for the renderer package passes after the migration.
- **SC-007**: A maintainer can update a representative app background/surface role and observe the change in at least four previously independent styling surfaces without editing component-local color values.

## Assumptions

- The current GPT54 changes are the base state: settings and generic buttons are already partially migrated and should be preserved.
- The scope is renderer theming only; `@blue/data` and project XML serialization are out of scope.
- The app remains dark-only for this slice.
- Some custom CSS class hooks are acceptable for Dockview, CodeMirror, Radix-style attribute selectors, scrollbars, pseudo-elements, animation hooks, and complex workbench/mixer layout.
- BSB widget colors that represent Java Blue parity or saved project behavior are preserved unless the implementation identifies them as app chrome.
- Dynamic layout inline styles are allowed when they encode measured dimensions, virtualized geometry, canvas positions, or user/project data.
