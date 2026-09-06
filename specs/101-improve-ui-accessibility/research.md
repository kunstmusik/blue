# Research: Improve UI Accessibility

## Audit Method

The audit reconciled both reports in `.tmp-research/COLOR_CONTRAST_AND_WCAG.md` against the 2026-09-05 working tree, recalculated contrast with the WCAG relative-luminance formula, searched production renderer code for semantic and interaction patterns, ran the existing renderer-theme audit, inspected representative controls/dialogs, and checked current W3C WCAG 2.2 guidance plus the current Web Interface Guidelines.

Primary standards:

- [WCAG 2.2 Understanding 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [WCAG 2.2 Understanding 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2 Understanding 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WCAG 2.2 Understanding 2.4.7: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [WCAG 2.2 Understanding 2.4.11: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WCAG 2.2 Understanding 2.1.1: Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [WCAG 2.2 Understanding 2.1.4: Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)

## Independent Findings

### Confirmed contrast failures

| Foreground | Background | Ratio | Finding |
|---|---:|---:|---|
| `app-text-muted` `#888888` | `app-surface` `#16213e` | 4.4838:1 | Fails 4.5:1 without rounding; widely used secondary text has no safety margin. |
| `app-text-subtle` `#666666` | `app-surface` `#16213e` | 2.7682:1 | Fails normal-text contrast substantially. |
| `app-accent` `#5a85c3` as text | `app-surface` `#16213e` | 4.2217:1 | Accent cannot be a general text color on the main surface. |
| white text | `app-accent` `#5a85c3` fill | 3.765:1 | Missed by both reports; primary buttons across Welcome, Settings, dialogs, toolbars, and editors fail normal-text contrast. |
| white text | `app-success` `#00b200` fill | 2.8501:1 | Fails active Solo text contrast. |
| white text | `app-warning` `#cc8800` fill | 2.9623:1 | Fails active Mute text contrast. |
| comment `#637777` | editor `#0d1524` | 3.8576:1 | Fails CodeMirror comment text contrast. |
| `app-border` `#0f3460` | `app-surface` `#16213e` | 1.2719:1 | Too weak when the authored border is the only essential control boundary. |

`#546c9b` reaches 3.024:1 against `app-surface`, but that is too close to the threshold for a durable shared boundary token. A somewhat lighter blue border should provide margin across surface variants.

### Confirmed focus and keyboard risks

- `styles/index.css` suppresses outlines for every `[tabindex]` element. The current production tree has 24 files with explicit `tabIndex`, only 8 production TSX files with an explicit `focus-visible:` utility, and roughly 220 `outline-none`/`outline: none` occurrences. Counts are search indicators, not automatic violation counts, but representative workbench, canvas, toolbar, and custom-control paths do lose their only focus indicator.
- The existing `app-focus` color itself is strong (5.7719:1 against `app-surface`); the failure is inconsistent application and global suppression, not the focus hue.
- The existing mixer range input is explicitly `aria-hidden` and removed from tab order, leaving the visible fader pointer-operated.
- Representative BSB knob and slider widgets use pointer tracking without slider role/value semantics or keyboard adjustment.
- The window-level bare `KeyF` shortcut has no discovered disable/remap mechanism and therefore triggers WCAG 2.1.4. A non-printing modifier is the smallest compliant correction.

### Confirmed semantics risks

- `SettingsField` renders a visual `label` without `htmlFor` and an input without a generated `id`; its sibling number-field wrappers already demonstrate the correct local pattern.
- Number-input claims in the second report are overstated: the current tree contains a labeled `CommitNumberField`, labeled settings wrappers, and some explicit IDs/ARIA props. However, the 85 numeric primitive/wrapper call sites still require contextual review because multiple direct `CommitNumberInput`/`LiveNumberInput` uses lack an obvious programmatic name.
- Dialog counts in the second report are stale and conflate filename matches, wrappers, non-modals, and true modals. The current filename inventory finds 33 production candidates; only a subset clearly uses `useDialogFocus` or `ConfirmationDialog`, and multiple confirmed true dialogs lack role/label/focus containment. Each candidate must be classified before editing.
- The undefined `app-error` alias is real and appears in more than the one reported location; the current theme audit also reports it in the REPL console.

### Theme drift evidence

The existing `pnpm audit:renderer-theme` currently fails with 9 unapproved arbitrary utilities, 2 raw CSS colors, 4 static inline colors, 10 undefined theme aliases, and 31 approved exceptions. These are governance findings, not automatically WCAG failures. The broader search finds 433 named Tailwind palette occurrences, not 538 in the current working tree. Many are legitimate syntax, data visualization, status, or project-authored values and must not be mass-replaced without classifying ownership and actual contrast.

## Reconciliation of the Two Reports

### Accepted

- Both reports correctly identify failing muted/subtle text, accent-as-text, weak essential borders, the CodeMirror comment, active status-button foregrounds, the undefined error role, generic focus suppression, the bare printable shortcut, and pointer-only DAW controls.
- The second report correctly broadens the work beyond token math to semantics, dialogs, keyboard operation, and assistive-technology state.

### Corrected or qualified

- Surface elevation direction is a dark-theme design convention, not a WCAG conformance criterion. Panel separation should improve where usability testing shows ambiguity, but it must not be reported as a WCAG failure by itself.
- WCAG 2.4.11 concerns focus not being obscured; it does not itself impose a 3:1 contrast rule. Focus visibility and applicable non-text contrast are evaluated under their proper criteria. Focus Appearance (2.4.13) is Level AAA, not the AA target.
- Equal luminance between success and danger colors is not automatically a 1.4.1 failure. A failure occurs when meaning relies on color alone. A visible alternative such as text, an icon, shape, pattern, position, or sufficient lightness contrast can satisfy WCAG 1.4.1; programmatic state is required where applicable by other criteria, but does not by itself satisfy 1.4.1.
- Raw-color occurrence counts do not establish accessibility failures. Values must be evaluated in their rendered pairing and ownership context.
- Exact dialog and numeric-input failure counts in the second report should not be used as acceptance baselines because current shared components already cover some sites and filename/search heuristics include non-dialog wrappers.
- The reports missed white-on-accent primary button text, a cross-application contrast failure with broader reach than several individually named issues.

## Decisions

### Decision: Target WCAG 2.2 AA for application-owned UI

**Rationale**: WCAG 2.2 is the current W3C recommendation and covers the reported AA concerns while adding focus-obscuring guidance relevant to overlays and popouts.

**Alternatives considered**: WCAG 2.1 AA was rejected as an older baseline; AAA was rejected as the required acceptance target because it would materially broaden the visual redesign, though higher contrast is encouraged where practical.

### Decision: Govern rendered semantic pairs, not isolated colors

**Rationale**: The same accent/status color can pass as text on a dark surface and fail as a fill behind white text. Pair contracts catch both directions and prevent misleading token-only audits.

**Alternatives considered**: Auditing each color in isolation was rejected because WCAG contrast is relational; replacing every palette color was rejected because many values are project-authored or data-semantic.

### Decision: Keep one executable pair contract

**Rationale**: CSS remains the source of actual color values, while one small machine-readable module defines governed role pairings and thresholds for the audit. Documentation explains ownership and use without duplicating a second table of literal values.

**Alternatives considered**: Duplicating pair tables in prose and audit code was rejected because they can drift; generating the full documentation site was rejected as unnecessary infrastructure.

### Decision: Reuse existing shared seams and dependencies

**Rationale**: The repository already has semantic theme roles, a theme audit/exception registry, `useDialogFocus`, labeled field wrappers, Vitest/jsdom, and Playwright browser tests. Extending them is smaller and more consistent than adding an accessibility framework or another modal/slider system.

**Alternatives considered**: Adding an automated accessibility dependency may be revisited after the deterministic baseline is stable, but it is not necessary for the named regressions. A new design-system package was rejected as speculative.

### Decision: Remediate true modals after classification

**Rationale**: Filename-based counts are unreliable. True modals need a consistent contract, while wrappers and non-modal surfaces should not receive incorrect `aria-modal` behavior.

**Alternatives considered**: Bulk-applying dialog roles/hooks by filename was rejected because incorrect ARIA can be worse than missing ARIA.

### Decision: Change the bare shortcut rather than add preferences

**Rationale**: `Command+Shift+F` on macOS and `Control+Shift+F` on Windows/Linux includes a non-printable modifier, has no current application-menu conflict, and requires no new durable setting, migration, UI, or IPC contract.

**Alternatives considered**: A shortcut preference system is useful future work but disproportionate to this remediation.

### Decision: Preserve authored visual data

**Rationale**: BSB widget colors, score-object colors, and imported fonts are canonical project content. Accessibility changes apply to app-owned chrome, semantic operation, and automatic foreground selection without rewriting stored user values.

**Alternatives considered**: Normalizing saved colors was rejected because it would violate project compatibility and user intent.

### Decision: Prefer minimum compliant contrast with restrained hierarchy

**Rationale**: Contrast compliance is a floor, not a requirement to maximize the prominence of every boundary and state. Blue is a dense creative workstation; keeping ordinary inactive chrome quiet makes focus, selection, warnings, and primary actions easier to locate while retaining accessible text and essential controls.

**Alternatives considered**: A uniformly higher-contrast theme was rejected because it makes unrelated controls compete for attention. Broadly reverting the accessibility implementation was rejected because it would discard independent semantic, keyboard, modal, and compatibility improvements.

### Decision: Review representative behavior categories with controlled A/B evidence

**Rationale**: A 101-file diff is not a useful perceptual review unit. Controlled before/candidate screenshots reveal visual hierarchy changes on representative surfaces, while keyboard, accessibility-tree, and automated checks provide better evidence for non-visual behavior.

**Alternatives considered**: Reviewing every file or capturing every changed component was rejected as noisy and expensive. Screenshot-only review was rejected because it cannot verify names, roles, values, focus containment, or keyboard behavior.
