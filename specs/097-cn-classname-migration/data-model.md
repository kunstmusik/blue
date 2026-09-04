# Data Model: cn() Class-Composition Migration and Styling Boundary

**Feature**: 097-cn-classname-migration | **Date**: 2026-09-03

This feature changes no persisted or runtime state domains (spec: Existing Behavior & Data
Compatibility — "No state domains affected; styling is derived, disposable render detail"). The
model below documents the **styling composition model** that the migration standardizes: the
token taxonomy every renderer `className` is built from, and the resolution semantics the shared
helper applies. It is the reference for the helper unit tests (research D2, tier 1) and the
review checklist for Wave 3 equivalence.

## Entities

### ClassToken

A single whitespace-delimited token in a rendered class list. Taxonomy (mutually exclusive):

| Kind | Examples | Merge behavior | Owner |
|------|----------|----------------|-------|
| Tailwind utility | `px-2`, `py-1.5`, `rounded`, `flex` | Conflict-resolved within its group; last occurrence wins | Tailwind v4 via `@theme static` tokens in `renderer/styles/index.css` |
| Typography role token | `text-role-body`, `text-role-title-2`, … (exactly seven) | One conflict group (registered in `cn()` via `extendTailwindMerge`); later role replaces earlier role; never treated as unknown | `docs/typography.md` semantics, `cn()` registration |
| Custom / BEM class | `mixer-chain-entry--disabled`, `editor-context-menu__item`, `workbench-aux-slideout--left` | Opaque: passed through verbatim, never dropped, never conflict-resolved | `renderer/styles/index.css` app-owned blocks (retain list, spec FR-008) |
| Third-party override class | `.dv-*` (dockview), `.cm-*` (CodeMirror) | Opaque (as above); utilities cannot express them | `renderer/styles/index.css` third-party blocks |
| Unknown lookalike | `scrollbar-thin` | Opaque passthrough; do NOT expect conflict resolution | N/A (documented caveat) |

Validation rules (map to FR-004, FR-009):

- A resolved class list MUST NOT contain two tokens of the same Tailwind conflict group
  (except: opaque tokens, which never conflict-resolve).
- Role tokens MUST survive any merge that does not explicitly supply a later role token.
- Falsy composition parts (`undefined`, `null`, `''`, `false`) MUST contribute nothing — no
  leading/trailing/duplicated whitespace in the output.

### ClassComposition

The developer-facing operation replacing template literals and array joins.

- **Inputs**: ordered parts — each a `ClassToken` string, a falsy value, or a nested
  composition (clsx input grammar).
- **Resolution**: clsx flattening and falsy filtering first; then tailwind-merge conflict
  resolution where **later parts win** within a conflict group; opaque tokens pass through
  position-preserved at first occurrence.
- **Precedence invariant (FR-002)**: when a component accepts a caller `className`, the
  composition MUST be `cn(base, …, className)` — base classes first, caller classes last — so
  caller utilities deterministically win conflicts.
- **State transitions**: none; composition is pure. No caching, no globals.

### StylingBoundary (documentation entity, not runtime)

The rule set written into AGENTS.md (FR-007): composition rule, utilities-first source rule,
plain-CSS exception whitelist, retain list, strangler policy. Fields are the five rule
statements; lifecycle is ordinary documentation with the AGENTS.md header rules (stable,
cross-cutting; feature specifics stay in `specs/`).

## Relationships

- `ClassComposition` consumes ordered `ClassToken`s and yields a resolved whitespace-joined
  string bound to one `className` attribute of one element.
- Components own their base-token constants; callers own override tokens; the helper owns
  resolution semantics. No token ever mutates.
- `StylingBoundary` governs which token kinds new code may introduce and where their CSS lives;
  it references (does not duplicate) `docs/typography.md` for role semantics.

## Out of scope

`style={{ … }}` dynamic values (pixel offsets, transforms, font names) are CSS *values*, not
tokens; they are outside this model and unchanged by the feature (FR-005).
