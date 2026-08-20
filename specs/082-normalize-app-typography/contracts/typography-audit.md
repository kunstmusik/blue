# Contract: Renderer Typography Audit

## Command and Integration

The repository MUST provide:

```text
scripts/audit-renderer-typography.mjs
scripts/audit-renderer-typography.test.mjs
```

Root `package.json` MUST expose `pnpm audit:renderer-typography`. Root `lint`
MUST execute the production audit, and `test:scripts` MUST execute the scanner's
fixture tests. Existing pull-request/develop workflows already run `pnpm test`
and `pnpm lint` on macOS, Windows, and Linux, so no workflow-specific command is
required.

## Scan Scope

Include production files matching `.css`, `.html`, `.js`, `.jsx`, `.mjs`, `.ts`,
`.tsx`, and `.svg` under:

- `packages/blue-app/src/renderer/`
- typography-rendering helpers under `packages/blue-app/src/shared/`, including
  BSB layout and Swing HTML handling

Exclude:

- `tests`, `browser`, and `__mocks__` directories;
- `*.test.*`, `*.spec.*`, and `*.d.ts` files;
- dependencies and generated/build/package output; and
- the scanner's own fixtures.

Main/preload code is outside the initial scan because it contains no visible font
assignment. If it later generates styled visible application text, it MUST enter
scope in the same change.

The scanner MUST inspect `styles/index.css` token definitions and Body baseline
as catalog declarations, not ordinary assignment findings.

## Required Catalog Checks

The audit MUST fail if any of these conditions is false:

- `@theme static` emits the exact seven `--text-role-*` size variables and exact
  seven line-height companions from the system contract;
- `--text-*: initial` clears the inherited Tailwind namespace before role
  definitions;
- no other primary `--text-*` font-size token is defined;
- no role is below 11 px;
- Body and Headline both resolve to 13/16;
- the global Body rule establishes `--text-role-body` and its line height; and
- all five production renderer entry points continue to import the shared style
  bundle directly or through their stable import chain.

## Required Assignment Detection

The scanner MUST inventory accepted semantic assignments and reject unapproved
occurrences in every syntax category below.

### Retired custom vocabulary

- `text-nano`, `text-micro`, `text-tiny`, `text-ui`, `text-body`, `text-content`
- matching variables and companions such as `--text-micro` and
  `--text-content--line-height`

The scanner MUST distinguish the retired `text-body` token from the approved
`text-role-body` token.

### Tailwind default size vocabulary

- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, and `text-2xl` through
  `text-9xl`
- variants/modifiers such as `sm:text-xs`, `hover:text-sm`, and `text-xs/4`

Text color utilities such as `text-primary`, `text-red-500`, and
`dark:text-foreground` MUST NOT be misclassified as font size.

### Tailwind arbitrary font sizing

- `text-[<length>]`, including role-equivalent numbers and line-height modifiers;
- `text-(length:<custom-property>)`;
- `[font-size:<value>]` and `[font:<value>]`; and
- variant-prefixed forms of the above.

Arbitrary values remain invalid even when they reference an approved variable;
the semantic utility or direct CSS-variable delivery path is clearer.

### CSS and style objects

- raw `font-size`, `font`, and `line-height` declarations;
- unapproved typography custom properties;
- React/DOM `fontSize`, `font-size`, `lineHeight`, `style.fontSize`, `style.font`,
  and `setProperty("font-size", ...)` assignments; and
- CodeMirror or third-party theme objects containing the same properties.

Approved assignments MUST resolve directly to an approved role variable or an
exact exception. Raw numeric values remain invalid even when compliant by size.

### SVG and drawn text

- SVG `fontSize`, `font-size`, style, and font shorthand assignments;
- raw Canvas `ctx.font` or equivalent context font strings;
- Canvas `fillText`/`strokeText` call paths that do not use the approved
  semantic-role resolver; and
- any drawn-text size below the floor.

### Line-height replacement and implicit sub-floor elements

- `leading-*`, raw `line-height`, and inline `lineHeight` that replace a role's
  companion value; and
- visible `small`, `sub`, or `sup` elements without an explicit approved role
  restoring a compliant metric.

An exact `single-line-line-height` exception may approve an override only under
the system contract.

## Exception Registry

The audit MUST read one JSON document between stable markers in the canonical
`docs/typography.md` guide:

````md
<!-- renderer-typography-exceptions:start -->
```json
{
  "schemaVersion": 1,
  "exceptions": []
}
```
<!-- renderer-typography-exceptions:end -->
````

Each exception MUST contain:

```json
{
  "id": "stable-id",
  "path": "packages/blue-app/src/.../file.tsx",
  "category": "project-authored-font",
  "expression": "exact stable source context",
  "expectedOccurrences": 1,
  "ownerSurface": "BSB authored label",
  "reason": "Value is read from canonical project font.size",
  "verification": "named round-trip test",
  "reviewPolicy": "Remove if this data path is replaced"
}
```

Allowed exception categories are:

- `project-authored-font`
- `non-text-glyph`
- `single-line-line-height`

Rules:

- `path` is one exact repository-relative POSIX path.
- `expression` identifies exact source context; directory globs and blanket
  suppression comments are invalid.
- The observed match count MUST equal `expectedOccurrences`.
- A missing, unmatched, overmatched, duplicate, or malformed exception fails.
- Project-authored records MUST name a preservation test.
- Application-owned readable text below 11 px cannot be excepted.
- A non-text interactive glyph MUST name its accessible-label verification.

The initial migration SHOULD replace font glyph icons with existing Lucide/SVG
icons so zero non-text glyph exceptions remain wherever practical.

## Result Contract

The command MUST print deterministic JSON to standard output. Repository paths
are normalized to forward-slash form only in the report/exception comparison.
Arrays are sorted by path, line, column, category, then value.

```json
{
  "schemaVersion": 1,
  "root": ".",
  "catalog": [
    {
      "id": "body",
      "utility": "text-role-body",
      "variable": "--text-role-body",
      "sizePx": 13,
      "lineHeightPx": 16
    }
  ],
  "counts": {
    "approvedRoleAssignments": 0,
    "approvedProjectAuthoredExceptions": 0,
    "approvedNonTextExceptions": 0,
    "approvedLineHeightExceptions": 0,
    "unapprovedLegacyRoles": 0,
    "unapprovedDefaultScaleUtilities": 0,
    "unapprovedArbitrarySizes": 0,
    "applicationTextBelowFloor": 0,
    "unapprovedCssSizes": 0,
    "unapprovedInlineSizes": 0,
    "unapprovedSvgSizes": 0,
    "unapprovedCanvasFonts": 0,
    "unapprovedLineHeightOverrides": 0,
    "catalogErrors": 0,
    "staleExceptions": 0
  },
  "inventory": [],
  "approvedExceptions": [],
  "staleExceptions": [],
  "findings": [],
  "passed": true
}
```

Each inventory/finding entry MUST contain:

- `path`
- `line`
- `column`
- `category`
- `value`
- `suggestedRole` or `null`
- `classification`
- `exceptionId` or `null`

## Exit Contract

- Exit `0`: catalog/baseline valid, every assignment is an approved role or exact
  exception, and no exception is stale.
- Exit `1`: one or more policy findings, catalog errors, or stale exceptions.
- Exit `2`: scanner/configuration failure such as unreadable source, malformed
  exception JSON, or invalid invocation.

Diagnostics MUST identify the rule and source context without dumping source
outside the matched expression.

## Fixture-Test Contract

`audit-renderer-typography.test.mjs` MUST create isolated temporary fixture trees
and prove at least one pass and one failure for:

- every semantic role and exact catalog metric;
- each retired, default, variant/modifier, and arbitrary utility category;
- raw CSS declarations and custom properties;
- React/DOM/CodeMirror-style objects;
- SVG attributes/styles;
- Canvas compliant resolver and prohibited font literal;
- line-height overrides;
- implicit `small`/`sub`/`sup` sizing;
- valid project-authored and non-text exceptions;
- stale, duplicate, malformed, count-mismatched, and broad exceptions; and
- Windows-style input paths versus normalized deterministic output.

Tests MUST use `os.tmpdir()`/`path.join()` and synthetic Windows paths rather
than assuming POSIX separators or permissions.
