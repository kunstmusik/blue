# Contract: Renderer Theme Audit

The implementation must provide a repeatable audit result for renderer theme drift. The result may be produced by a script, package command, or documented check, but it must follow this logical contract so handoffs can compare results across runs.

## Audit Result Shape

```json
{
  "generatedAt": "2026-05-29T00:00:00.000Z",
  "scope": "packages/blue-app/src/renderer",
  "summary": {
    "unapprovedArbitraryUtilities": 0,
    "unapprovedRawCssColors": 0,
    "unapprovedStaticInlineColors": 0,
    "undefinedThemeAliases": 0,
    "approvedExceptions": 0
  },
  "findings": [
    {
      "path": "packages/blue-app/src/renderer/components/example.tsx",
      "line": 1,
      "value": "#10192a",
      "category": "arbitrary-utility",
      "suggestedRole": "app-surface-strong",
      "approvedException": false,
      "reason": ""
    }
  ],
  "exceptions": [
    {
      "path": "packages/blue-app/src/renderer/components/example.tsx",
      "value": "rgb(63,102,150)",
      "kind": "java-blue-parity",
      "reason": "Saved BSB widget parity color",
      "ownerSurface": "BSB widgets",
      "reviewBy": "permanent"
    }
  ]
}
```

## Required Categories

- `arbitrary-utility`: Static `bg-[#...]`, `text-[#...]`, `border-[#...]`, and related arbitrary color utilities.
- `raw-css-color`: Raw color literals in renderer CSS outside the canonical theme block.
- `static-inline-color`: Inline style colors that represent app chrome rather than dynamic/project data.
- `undefined-theme-alias`: Referenced theme aliases that do not resolve to canonical roles.

## Pass Criteria

- All unapproved summary counts must be `0`.
- Every approved exception must include `path`, `value`, `kind`, `reason`, and `ownerSurface`.
- The audit must distinguish dynamic geometry inline styles from static app palette inline styles.
- The audit must be documented in `quickstart.md` and runnable by future agents without rediscovering the search logic.
