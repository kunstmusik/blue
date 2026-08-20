# Data Model: Normalize Application Typography

This feature adds no persisted application model. The entities below describe
the presentation catalog, source assignments, compatibility boundary, audit
evidence, and manual acceptance records used to implement and verify the design.
They do not enter `.blue` XML, program settings, IPC, preload contracts, or
runtime engine protocols.

## TypographyRole

A semantic application-text role owned by the CSS theme.

| Field | Type | Rules |
|---|---|---|
| `id` | enum | `large-title`, `title-2`, `title-3`, `headline`, `body`, `callout`, `subheadline` |
| `tailwindUtility` | string | Exactly `text-role-<id>` |
| `cssVariable` | string | Exactly `--text-role-<id>` |
| `lineHeightVariable` | string | Exactly `--text-role-<id>--line-height` |
| `sizePx` | integer | Exact approved logical size at 100% zoom |
| `lineHeightPx` | integer | Exact approved logical line box |
| `defaultWeight` | enum | `regular` or `bold` |
| `allowedEmphasis` | set | Role-specific regular/semibold/bold choices from the spec |
| `intendedUses` | string list | Information purposes, never component dimensions |
| `familyPolicy` | enum | `proportional-default`, with `monospace-permitted` where content requires it |

### Catalog

| ID | Utility / variable | Size / line height | Default weight |
|---|---|---:|---|
| `large-title` | `text-role-large-title` / `--text-role-large-title` | 26/32 | regular |
| `title-2` | `text-role-title-2` / `--text-role-title-2` | 17/22 | regular |
| `title-3` | `text-role-title-3` / `--text-role-title-3` | 15/20 | regular |
| `headline` | `text-role-headline` / `--text-role-headline` | 13/16 | bold |
| `body` | `text-role-body` / `--text-role-body` | 13/16 | regular |
| `callout` | `text-role-callout` / `--text-role-callout` | 12/15 | regular |
| `subheadline` | `text-role-subheadline` / `--text-role-subheadline` | 11/14 | regular |

### Validation

- The catalog has exactly seven roles and six distinct metric pairs.
- No role has `sizePx < 11`.
- Headline and Body have identical size/line-height metrics.
- Headline call sites apply bold; weight does not create a new size role.
- The Tailwind `--text-*` namespace is cleared before these definitions.
- No default Tailwind, legacy, or alternate application size token remains.

## ApplicationOwnedTypographyAssignment

A visible text assignment supplied by Blue's interface rather than project data.

| Field | Type | Rules |
|---|---|---|
| `sourceLocator` | path + symbol/expression | Stable repository source location |
| `surface` | string | Window, panel, editor, dialog, or drawn surface |
| `purpose` | enum | `identity`, `major-title`, `section-title`, `compact-heading`, `body`, `secondary`, `dense-annotation` |
| `roleId` | `TypographyRole.id` | Derived from purpose, not available space |
| `deliveryPath` | enum | `body-inheritance`, `tailwind-utility`, `css-variable`, `drawn-text-resolver` |
| `family` | enum | `proportional` or `monospace` |
| `weight` | enum | Permitted by the role |
| `lineHeightMode` | enum | `role-default` or `approved-single-line-exception` |
| `geometryRisk` | enum | `none`, `fixed-height`, `fixed-width`, `positioned`, `drawn` |
| `stateVariants` | string list | Enabled, disabled, selected, hover, warning, error, or other states |

### Validation

- An assignment with no deliberate local role inherits Body.
- Every explicit size resolves through exactly one approved role.
- A raw number is invalid even when it equals an approved size because it loses
  semantic purpose.
- Explicit line-height replacement requires an exact exception and must remain
  vertically centered and unclipped.
- Monospaced content retains its family but not a separate size scale.
- Dense geometry adapts before the selected role is reduced.
- Enabled information-bearing states meet 4.5:1 contrast; disabled/inactive
  meaning is not conveyed by low contrast alone.

## ProjectAuthoredTextStyle

A font value stored in or imported into a Blue project and rendered by a BSB
surface.

| Field | Type | Rules |
|---|---|---|
| `canonicalOwner` | constant | Active main-process `BlueData` project document |
| `projectProperty` | string | Examples: `font.size`, `labelFont.size`, `fontSize`, imported Swing HTML size |
| `supportedValue` | existing project value | Preserved without clamping to the application catalog |
| `renderBinding` | exact source expression | Traces the value from canonical data to visible authored content |
| `roundTripFixture` | fixture/test ID | Covers load, render, save, and reopen |
| `preservationStatus` | enum | `unverified`, `verified`, `regressed` |

### Validation

- Minimum, typical, and maximum supported values round-trip exactly with
  unrelated and unknown project data.
- The value never becomes an application `TypographyRole` assignment.
- BSB application chrome adjacent to authored content remains application-owned.
- Existing dropdown sizes such as 8/12/36 and font-object sizes such as
  1/12/200 are covered without defining new normalization behavior.

## TypographyException

A narrowly approved source occurrence that is project-authored, a non-text
graphic, or a necessary single-line line-height override.

| Field | Type | Rules |
|---|---|---|
| `id` | stable string | Unique and descriptive |
| `path` | repository-relative POSIX path | Exact file; no directory wildcard |
| `category` | enum | `project-authored-font`, `non-text-glyph`, `single-line-line-height` |
| `expression` | exact string/pattern | Narrow source context recognized by the audit |
| `expectedOccurrences` | positive integer | Exact cardinality |
| `ownerSurface` | string | Identifies the affected project or control surface |
| `reason` | string | Explains why an approved role cannot replace it |
| `verification` | string | Test or manual evidence that protects the boundary |
| `reviewPolicy` | string | Condition requiring removal or reapproval |

### Validation

- Exceptions match by exact path, category, expression, and count—not line number
  or a whole directory.
- A missing, stale, or overmatching exception fails the audit.
- A project-authored exception traces to canonical project data.
- A non-text glyph has no textual reading role; an interactive glyph has an
  accessible name. Replacing it with an icon is preferred.
- Application-owned sub-floor text cannot be allowlisted.
- The canonical machine-readable registry lives in `docs/typography.md`.

## TypographyAuditFinding

A source assignment that must be accepted as a role, matched to an exception, or
rejected.

| Field | Type | Rules |
|---|---|---|
| `path` | repository-relative POSIX path | Stable cross-platform identifier |
| `line` / `column` | positive integer | Diagnostic location only; not exception identity |
| `category` | rule enum | Legacy, default scale, arbitrary, raw CSS/inline/SVG/canvas, line-height, catalog, or baseline |
| `value` | string | Matched source value |
| `suggestedRole` | role ID or `null` | Guidance when purpose can be inferred |
| `classification` | enum | `approved-role`, `approved-exception`, `rejected` |
| `exceptionId` | string or `null` | Required only for an approved exception |

### State Transition

```text
discovered
    └── classified
        ├── approved-role
        ├── approved-exception
        └── rejected
```

Rejected findings are terminal for the current audit run and cause failure.

## TypographyAuditResult

A disposable, deterministic report from one source scan.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Versioned output contract |
| `catalog` | `TypographyRole[]` | Exact theme snapshot |
| `inventory` | `TypographyAuditFinding[]` | Sorted accepted and rejected assignments |
| `approvedExceptions` | `TypographyException[]` | Only records matched exactly this run |
| `staleExceptions` | `TypographyException[]` | Must be empty to pass |
| `counts` | category map | Includes accepted roles, exception categories, and every unapproved category |
| `passed` | boolean | True only when catalog/baseline are valid and every unapproved/stale count is zero |

The result owns no state and is safe to discard after CI or local validation.

## VisualAcceptanceCase

A recorded manual observation for rendered behavior that static analysis cannot
prove.

| Field | Type | Rules |
|---|---|---|
| `id` | stable string | Maps to one row in the acceptance matrix |
| `densityProfile` | enum | `retina` or `standard-dpr1` |
| `devicePixelRatio` | number | Recorded; standard profile is invalid unless it equals 1 |
| `applicationZoom` | enum | `50`, `100`, `200`, or `300` percent |
| `windowSurface` | string | Exact window/panel/editor |
| `contentFixture` | string | Reproducible project or synthetic state |
| `windowDimensions` | width/height | Logical window dimensions |
| `sampledElements` | sample list | Expected role and computed size/line height |
| `contrastSamples` | sample list | Foreground, background, ratio, state |
| `essentialAction` | string or `null` | Required for zoom acceptance cases |
| `geometryExpectation` | string list | No clipping, overlap, baseline collision, or lost essential label |
| `evidence` | string list | Screenshot/log references |
| `status` | enum | `pending`, `pass`, `fail`, `corrected`, `rerun-pass` |

### State Transition

```text
pending → pass
       └→ fail → corrected → rerun-pass
```

No acceptance case is complete while its density, zoom, fixture, dimensions, or
required evidence is missing.
