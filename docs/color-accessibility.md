# Color and Contrast Accessibility

This document is the authority for semantic color ownership, contrast thresholds, focus styling, non-color visual cues, exception policies, and validation commands across Blue Electron renderer surfaces.

## 1. Color Ownership Boundaries

Blue maintains an intentional, strict boundary between **application-owned chrome** and **canonical project-authored content**:

1. **Application-Owned Chrome**:
   - Navigation bars, toolbars, panel headers, settings, dialogs, status surfaces, standard form inputs, menus, and toasts.
   - All colors and contrast ratios in this domain are governed by application semantic tokens defined in `packages/blue-app/src/renderer/styles/index.css`.
   - Must conform to the WCAG 2.2 AA contrast and focus thresholds defined in this document.

2. **Project-Authored Content**:
   - Blue Synth Builder (BSB) widget custom colors, custom backgrounds, and custom fonts authored by users.
   - Score layer group colors, pattern object colors, and user-assigned sound object colors stored in `.blue` project XML.
   - Canonical project data is owned by `BlueData` and must **never** be normalized, coerced, or mutated for accessibility compliance.
   - Preserving user-authored `.blue` XML and CSD parity takes precedence over synthetic contrast normalization.

3. **Language Syntax and Data Visualizations**:
   - CodeMirror syntax highlighting tokens (keywords, literals, types, strings) remain language syntax rather than application chrome.
   - Syntactic token colors are classified as syntax-palette exceptions in `specs/051-theme-token-cleanup/theme-exceptions.md`.
   - Syntax comments that represent readable author text are governed and must pass the normal-text contrast floor (>= 4.5:1).

---

## 2. WCAG 2.2 AA Contrast Thresholds

All governed application-owned UI must satisfy WCAG 2.2 AA minimum contrast ratios. Calculations use standard relative luminance (WCAG 2.1 / 2.2 formula) and must **never be rounded up** (for example, 4.495:1 fails the 4.5:1 floor).

### Contrast Floors

| Category                               | Minimum WCAG Ratio | Target Design Headroom | Applicable Surfaces                                                                                                                                                                                                            |
| -------------------------------------- | ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Normal Text**                        | **4.5:1**          | **>= 4.75:1**          | All approved typography roles below 26 px: Caption (11 px), Metadata (12 px), Callout (12 px), Body (13 px), Title (16 px), Section Header (20 px). Also includes placeholders, labels, table cells, and code editor comments. |
| **Large Text**                         | **3:1**            | **>= 3.25:1**          | Only the Large Title role (26 px) qualifies under Blue's typography catalog.                                                                                                                                                   |
| **Non-Text Information** (WCAG 1.4.11) | **3:1**            | **>= 3.25:1**          | Essential component boundaries (active/resting borders for inputs, buttons, sliders), graphical objects, active states, and author-supplied focus rings.                                                                       |

### Compositing and Directionality

- **Alpha Compositing**: Any color containing an alpha channel (e.g. `rgba(...)`) must be mathematically composited against its declared background layer before calculating relative luminance.
- **Directional Fill/Foreground Requirement**: Every semantic fill role that contains text or icons must declare a passing on-fill foreground. A color pair passing as a foreground over a dark background does not imply that the reverse pairing passes.
- **State Changes**: Resting, hover, active, pressed, and focus combinations must each be evaluated as distinct contrast pairs whenever their background or foreground changes.

---

## 3. Focus and Keyboard Indicators

1. **Visible Focus**: Every keyboard-operable control (buttons, links, inputs, selects, sliders, interactive table rows, tree nodes) must present a visible `:focus-visible` state satisfying WCAG 1.4.11 (>= 3:1 contrast against adjacent background and control surface).
2. **Prohibited Global Suppression**:
   - Universal or blanket focus suppression (such as `[tabindex] { outline: none; }` or unconditioned reset rules) is strictly prohibited.
   - Component-level `outline-none` or `focus:outline-none` is permitted only when accompanied by an explicit, accessible focus indicator (such as `focus-visible:ring-2` or `focus-visible:border-app-accent`).
3. **Programmatic Focus Shells**:
   - Panel roots and editor shells that carry `tabIndex={-1}` solely to capture keyboard shortcuts after clicks may suppress the default OS outline only if documented as a non-operable programmatic-focus shell and accompanied by an explicit alternative state (such as an active panel border or title bar highlight).
4. **No Obscured Focus** (WCAG 2.2 Criterion 2.4.11): When a control receives keyboard focus, it must not be completely obscured by fixed toolbars, sticky headers, or overlapping overlays.

---

## 4. Distinguishing Status Without Color Alone (WCAG 1.4.1)

Color must not be the sole visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element:

1. **Status States (Success, Warning, Danger, Error)**:
   - Must include an accompanying icon, explicit text label, or distinct border/shape pattern.
   - Toasts, error banners, and form validation states must pair semantic colors with descriptive text and appropriate iconography.
2. **Connection States**:
   - Connected / Disconnected / Error indicators must include text or distinct icon shapes (e.g. checkmark vs. cross or solid vs. hollow icon) in addition to color changes.
3. **Mute and Solo**:
   - Active Mute and Solo states must feature prominent visual contrast and distinct typography/iconography (e.g. filled badge, bold/letterpressed glyph, active border) so the state is immediately distinguishable in grayscale or color-vision deficiency simulations.
   - Must also expose `aria-pressed` or `aria-selected` programmatically.

---

## 5. Exception Management and Review Policy

All exemptions from standard semantic color token enforcement are tracked in `specs/051-theme-token-cleanup/theme-exceptions.md`.

### Exception Schema

Each entry must specify:

- `path`: Exact POSIX relative path to the file.
- `value`: The literal color or style value.
- `kind`: Category of exception (`syntax-palette`, `project-authored`, `decorative`, `inactive`, or `platform-native`).
- `reason`: Technical rationale explaining why the value cannot use an existing semantic token.
- `ownerSurface`: The specific UI surface or component owning this exception.
- `reviewBy`: `permanent` for structural exceptions (e.g. syntax tokens) or a milestone/date for temporary exceptions.

### Enforcement Rules

- **No Application Text Exemptions**: Enabled, information-bearing application text or essential interactive control states may not be exempted from contrast requirements.
- **Stale Exceptions**: Any exception entry matching a value or line that no longer exists in source code will trigger an audit failure.
- **Malformed Exceptions**: Any exception entry lacking required fields will trigger an audit failure.

---

## 6. Machine-Readable Governed Pairs

The definitive list of governed color pairings and their target ratios is defined in executable format in:

`scripts/renderer-accessibility-contract.mjs`

The static audit script `scripts/audit-renderer-theme.mjs` consumes this module to evaluate all CSS variables and semantic classes against these rules automatically.

---

## 7. Validation Commands

Run these commands to validate color and contrast compliance:

```bash
# Static contrast and semantic token audit
pnpm audit:renderer-theme

# Unit tests for the audit engine and governed pairs
node --test scripts/audit-renderer-theme.test.mjs

# Browser-rendered contrast spot checks
pnpm --filter @blue/app test:browser

# Full application test suite
pnpm --filter @blue/app test
```

---

## 8. Permitted Semantic Token Uses Catalog

| Semantic Token                   | Role Purpose       | Permitted Uses & Contexts                                            | Contrast Floor / Requirement        |
| -------------------------------- | ------------------ | -------------------------------------------------------------------- | ----------------------------------- |
| `--color-app-bg`                 | Surface            | Main application window background, settings window root background  | Background anchor                   |
| `--color-app-surface`            | Surface            | Standard workbench panel bodies, dialog containers, card backgrounds | Background anchor                   |
| `--color-app-surface-raised`     | Surface            | Toolbars, popovers, context menus, elevated card containers          | Background anchor                   |
| `--color-app-surface-strong`     | Surface            | Recessed containers, table headers, deeply contrasted shells         | Background anchor                   |
| `--color-app-surface-subtle`     | Surface            | Subtle card sections, inspector secondary panels                     | Background anchor                   |
| `--color-app-canvas`             | Surface            | CodeMirror editor background, piano roll grid, tracker grid          | Background anchor                   |
| `--color-app-input`              | Input surface      | Text inputs, number inputs, dropdown trigger background              | Background anchor                   |
| `--color-app-field`              | Input surface      | Dialog input fields, table cell inputs                               | Background anchor                   |
| `--color-app-menu`               | Menu surface       | Dropdown menus, context menus, sub-menu containers                   | Background anchor                   |
| `--color-app-hover`              | Interactive state  | Row hover, list item hover, menu item hover background               | State background                    |
| `--color-app-text`               | Body text          | Default readable application text, labels, form descriptions         | >= 4.75:1 normal text               |
| `--color-app-text-strong`        | Emphasized text    | Active tab titles, section headlines, prominent dialog titles        | >= 4.75:1 normal text               |
| `--color-app-text-soft`          | Secondary text     | Supporting descriptions, helper hints                                | >= 4.75:1 normal text               |
| `--color-app-text-muted`         | Muted text         | Secondary metadata, placeholders, inactive icons                     | >= 4.75:1 normal text               |
| `--color-app-text-subtle`        | Subtle text        | Micro captions, timestamps, non-critical annotations                 | >= 4.75:1 normal text               |
| `--color-app-accent`             | Accent fill / text | Primary action buttons, active tab indicators, selected item fills   | >= 4.75:1 on background, fill       |
| `--color-app-accent-foreground`  | On-fill text       | Text or icon displayed inside an `--color-app-accent` container      | >= 4.75:1 on accent fill            |
| `--color-app-accent-hover`       | Accent hover       | Hover state of primary action buttons                                | Fill                                |
| `--color-app-border`             | Essential boundary | Input borders, panel separator rules, dialog boundaries              | >= 3.25:1 non-text boundary         |
| `--color-app-border-strong`      | Boundary           | Active container boundary, high-contrast modal borders               | >= 3.25:1 non-text boundary         |
| `--color-app-focus`              | Focus indicator    | Author-supplied `:focus-visible` rings and outlines                  | >= 3.25:1 against surface & control |
| `--color-app-warning`            | Status fill / text | Warning alerts, Solo active button fill, warning icons               | >= 4.75:1 on background, fill       |
| `--color-app-warning-foreground` | On-fill text       | Text/icons inside `--color-app-warning` badges (Solo active text)    | >= 4.75:1 on warning fill           |
| `--color-app-success`            | Status fill / text | Success alerts, Mute active button fill, connected icons             | >= 4.75:1 on background, fill       |
| `--color-app-success-foreground` | On-fill text       | Text/icons inside `--color-app-success` badges (Mute active text)    | >= 4.75:1 on success fill           |
| `--color-app-danger`             | Status fill / text | Danger alerts, destructive button fill/text                          | >= 4.75:1 on background, fill       |
| `--color-app-danger-foreground`  | On-fill text       | Text/icons inside `--color-app-danger` badges/buttons                | >= 4.75:1 on danger fill            |
| `--color-app-error`              | Status text        | REPL error messages, form validation error text                      | >= 4.75:1 on dark surfaces          |
| `--color-app-bsb-control`        | Chrome surface     | Blue Synth Builder component chrome backgrounds                      | Background anchor                   |
