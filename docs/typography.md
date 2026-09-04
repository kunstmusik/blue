# Blue Application Typography Guide

This document is the canonical design authority for application typography in Blue.
All user interface work in the Blue repository must align with the rules, catalog,
ownership boundaries, and validation requirements defined here.

## 1. Authority, Scope, and HIG Rationale

Blue's application typography is guided by the **Apple macOS Human Interface Guidelines (HIG)**
text styles.

### Logical Unit Mapping

- In Apple macOS HIG, text styles are specified in typographic points (pt).
- In Blue's Chromium/Electron renderer at 100% application zoom (Actual Size), 1 typographic point
  maps **one-to-one to 1 CSS logical pixel (px)** (device-independent pixel).
- Physical point-to-pixel conversions (e.g. 1 pt = 1.333 px) are **not** applied to interface metrics.
- All sizes and line heights in this guide are logical display units at 100% application zoom.

### Readability Floor

- **11 logical pixels** is the absolute readability floor for visible application-owned text at 100% zoom.
- No application-owned label, annotation, readout, or control text may render below 11 px.

---

## 2. Approved Semantic Typography Catalog

Blue uses a single semantic token layer with **exactly seven roles** and **six distinct metric pairs**.
Headline and Body intentionally share size and line-height metrics, distinguishing hierarchy through weight.

| Role            | Utility                 | CSS Variable              |  Size | Line Height | Default Weight | Allowed Emphasis  | Usage                                                              |
| --------------- | ----------------------- | ------------------------- | ----: | ----------: | -------------- | ----------------- | ------------------------------------------------------------------ |
| **Large Title** | `text-role-large-title` | `--text-role-large-title` | 26 px |       32 px | Regular        | Regular, Bold     | Welcome and About application identity only                        |
| **Title 2**     | `text-role-title-2`     | `--text-role-title-2`     | 17 px |       22 px | Regular        | Regular, Bold     | Major window, dialog, and top-level panel titles                   |
| **Title 3**     | `text-role-title-3`     | `--text-role-title-3`     | 15 px |       20 px | Regular        | Regular, Semibold | Section titles and prominent inspector groups                      |
| **Headline**    | `text-role-headline`    | `--text-role-headline`    | 13 px |       16 px | Bold           | Bold              | Compact headings and column/group headings                         |
| **Body**        | `text-role-body`        | `--text-role-body`        | 13 px |       16 px | Regular        | Regular, Semibold | Default controls, menus, inputs, lists, tables, code, output       |
| **Callout**     | `text-role-callout`     | `--text-role-callout`     | 12 px |       15 px | Regular        | Regular, Semibold | Secondary labels, shortcuts, badges, helper text, compact controls |
| **Subheadline** | `text-role-subheadline` | `--text-role-subheadline` | 11 px |       14 px | Regular        | Regular, Semibold | Dense canvas, ruler, timeline, mixer, and graph annotations only   |

### Companion Line-Height Variables

Every role provides a matching line-height custom property:

- `--text-role-large-title--line-height: 32px`
- `--text-role-title-2--line-height: 22px`
- `--text-role-title-3--line-height: 20px`
- `--text-role-headline--line-height: 16px`
- `--text-role-body--line-height: 16px`
- `--text-role-callout--line-height: 15px`
- `--text-role-subheadline--line-height: 14px`

---

## 3. Role Selection Rules

Assign typography roles based on **semantic purpose**, never container dimensions.

| Information Purpose                                                             | Approved Role   | Emphasis                         |
| ------------------------------------------------------------------------------- | --------------- | -------------------------------- |
| Application identity on Welcome or About screens                                | **Large Title** | Regular / Bold                   |
| Major window, modal dialog, or top-level panel title                            | **Title 2**     | Regular / Bold                   |
| Section title, inspector group heading, modal subhead                           | **Title 3**     | Regular / Semibold               |
| Column heading, group header, compact card header                               | **Headline**    | **Bold** (required at call site) |
| Standard control, input, button, menu item, list/table cell, code, output       | **Body**        | Regular (Semibold for emphasis)  |
| Secondary label, keyboard shortcut, badge, helper/caption text, compact control | **Callout**     | Regular / Semibold               |
| Dense timeline mark, ruler mark, mixer meter/fader readout, graph annotation    | **Subheadline** | Regular / Semibold               |

### Dense Geometry Policy

- **Do not shrink text below its approved role** to force fit into an undersized box.
- If a label does not fit:
  1. Allow the container to grow or reflow.
  2. Use intentional wrapping or scrolling.
  3. Use intentional truncation (`truncate`, ellipsis) when full value is accessible via tooltip/selection/focus.
  4. Selectively reduce annotation frequency (e.g. piano roll displaying pitch names only on octave intervals at smallest row heights).

---

## 4. Inheritance and Body Baseline

- The global `body` selector in `packages/blue-app/src/renderer/styles/index.css` sets:
  ```css
  font-size: var(--text-role-body);
  line-height: var(--text-role-body--line-height);
  ```
- All five renderer entry points (`main`, `settings`, `about`, `effect-editor`, `track-instrument-editor`) import `styles/index.css`.
- Application text without a specific role class or style automatically inherits the **13/16 Body** baseline.
- Unclassified empty, loading, error, and recovery states inherit Body.
- The root `html` font size remains untouched to avoid altering rem-based layout calculations.

---

## 5. Font Family, Weight, and Contrast

### Font Families

- **Proportional**: Roboto (`'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`).
- **Monospaced**: Established monospaced font stack for code editors, REPL, output console, tracker, and code annotations.
- Monospaced text uses the same semantic role sizes (e.g. Body 13 px for code editor and REPL, Callout 12 px for compact code hints).

### Weight and Hierarchy

- **Headline** must be styled with `font-bold` at its call sites.
- Other roles use `font-normal` (default) or `font-semibold` for emphasis.
- Weight, letter spacing, or color may express hierarchy, but must never introduce an undeclared font size.

### Contrast and Opacity

- **Contrast ratio**: Enabled, information-bearing text must meet at least **4.5:1** contrast against its rendered background.
- **Opacity**: Secondary text must not use opacity below **50%** to communicate hierarchy.
- **State cues**: Disabled/inactive states must remain distinguishable without using font-size reductions or low contrast as the sole differentiator.

---

## 6. Ownership Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ Application-Owned Typography                                │
│ (Must use 7-role semantic catalog, >= 11 px floor)          │
│ • Toolbars, menus, dialogs, settings, inspectors            │
│ • Workbench panels, tabs, rails, Dockview chrome            │
│ • Score rulers, timeline annotations, mixer strips          │
│ • BSB application chrome, toolbars, property sheets         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Boundary
┌──────────────────────────────┴──────────────────────────────┐
│ Project-Authored Typography (Canonical Project Data)        │
│ (Preserved verbatim; never coerced or clamped)              │
│ • BSB widget font sizes (font.size, labelFont.size, etc.)   │
│ • User-authored Swing HTML text styles in BSB               │
│ • Persisted .blue XML font choices                          │
└─────────────────────────────────────────────────────────────┘
```

### Application-Owned Text

All Blue-supplied UI elements are application-owned and must use the seven semantic roles.
This includes the application chrome surrounding Blue Synth Builder (BSB) widgets (property sheet labels,
toolbar buttons, tab titles, dialogs, and value readout headers).

### Project-Authored Font Data

User-selected or imported font values stored in `.blue` projects (e.g. BSB label font sizes 8, 12, 36, or
custom font sizes 1–200) are **canonical project data**.

- Project loading, saving, serialization, and rendering must **never** clamp, coerce, or normalize these values to the application catalog.
- These data-transport paths are tracked as explicit exceptions in the registry below.

### Non-Text Graphics and Glyphs

- Prefer **Lucide/SVG icons** (`lucide-react`) over textual glyphs (e.g. `×` for close).
- Non-text graphical glyphs that carry no reading role may be registered as non-text exceptions.
- Any interactive glyph control must provide an accessible name (`aria-label` or `title`).

---

## 7. Delivery Paths and Usage Examples

### 1. Tailwind Markup (Preferred for React Components)

```tsx
// Headings
<h2 className="text-role-title-2 font-bold text-app-text-strong">Project Settings</h2>
<h3 className="text-role-title-3 font-semibold text-app-text-bright">Audio Configuration</h3>
<h4 className="text-role-headline font-bold text-app-text">Outputs</h4>

// Standard Controls & Content
<button className="text-role-body text-app-text-strong">Apply</button>
<input className="text-role-body text-app-text" type="text" />
<p className="text-role-body text-app-text">Ordinary descriptive content.</p>

// Secondary / Helper Text
<span className="text-role-callout text-app-text-muted">Command-S to save</span>
<span className="text-role-callout text-app-text-soft">Optional field</span>

// Dense Annotations
<span className="text-role-subheadline text-app-text-muted">00:01:24</span>
```

### 2. Custom CSS, Dockview, and CodeMirror

Use the emitted `--text-role-*` custom properties directly:

```css
.dense-ruler-mark {
  font-size: var(--text-role-subheadline);
  line-height: var(--text-role-subheadline--line-height);
}

.dockview-tab-title {
  font-size: var(--text-role-body);
  line-height: var(--text-role-body--line-height);
}
```

### 3. Inline SVG

```tsx
<text
  x={x}
  y={y}
  className="text-role-subheadline fill-app-text-muted"
  style={{ fontSize: 'var(--text-role-subheadline)' }}
>
  {label}
</text>
```

### 4. HTML Canvas 2D

Use the renderer-only helper `resolveTypographyRoleFont` to resolve computed CSS variables:

```ts
import { resolveTypographyRoleFont } from '@/renderer/lib/typography';

const font = resolveTypographyRoleFont(canvasElement, 'subheadline', {
  family: 'monospace',
  weight: 'normal',
});
ctx.font = font; // e.g. "400 11px monospace"
ctx.fillText(label, x, y);
```

---

## 8. Prohibited Anti-Patterns

| Anti-Pattern                                                                   | Why Prohibited                                         | Approved Replacement                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `text-nano`, `text-micro`, `text-tiny`, `text-ui`, `text-body`, `text-content` | Retired custom tokens from legacy scale                | Use `text-role-*` (`text-role-body`, `text-role-callout`, `text-role-subheadline`) |
| `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`                        | Tailwind default numeric scale; uncoordinated with HIG | Use `text-role-*`                                                                  |
| `text-[9px]`, `text-[10px]`, `text-[13px]`                                     | Arbitrary size utilities bypass semantic intent        | Use `text-role-*`                                                                  |
| `font-size: 10px;`, `style={{ fontSize: 10 }}`                                 | Sub-floor raw sizes                                    | Use `--text-role-subheadline` (11 px) or higher                                    |
| `ctx.font = "10px sans-serif"`                                                 | Hardcoded canvas fonts drift from CSS variables        | Use `resolveTypographyRoleFont(el, 'subheadline')`                                 |
| `leading-none`, `leading-[12px]`                                               | Overriding line height causes vertical clipping        | Use role's companion line height                                                   |
| Shrinking text to fit container                                                | Breaks hierarchy and readability floor                 | Grow container, wrap, scroll, or truncate                                          |

---

## 9. Validation and Quality Gates

### Automated Checks

1. **Static Typography Audit**:

   ```bash
   pnpm audit:renderer-typography
   ```

   Scans all renderer source files and validates:
   - Zero unapproved arbitrary sizes (`text-[...]`, `font-size: ...`).
   - Zero retired legacy tokens (`text-nano`, `text-micro`, `text-tiny`, `text-ui`, `text-content`, `--text-*`).
   - Zero default Tailwind scale tokens (`text-xs`, `text-sm`, `text-base`, etc.).
   - Zero application text below 11 px.
   - All exceptions in the registry match exact occurrences.

2. **Scanner Fixture Tests**:

   ```bash
   node --test scripts/audit-renderer-typography.test.mjs
   ```

3. **Renderer Token & Component Tests**:
   ```bash
   pnpm --filter @blue/app test
   ```

### Visual Acceptance Matrix

Execute the 10 visual acceptance cases (V01–V10) documented in `contracts/visual-acceptance.md`
under both **macOS Retina (D1, DPR >= 2)** and **Standard Density (D2, DPR = 1)** at 100% zoom,
and verify 50%, 100%, 200%, 300% zoom matrices.

---

## 10. Same-Change Maintenance Rule

Whenever application typography roles, metrics, ownership boundaries, or exception policies are
changed in the codebase:

- `docs/typography.md` **must** be updated in the same change.
- The exception registry below **must** reflect exact source paths, expressions, and counts.
- `AGENTS.md` must continue pointing to this guide.

---

## 11. Initial Audit Inventory and Migration Map

### Initial Baseline Counts

At the start of normalization (Phase 2), the static audit detected the following unmigrated assignments across approximately 187 renderer files:

| Category                                                                                                             | Initial Count | Migration Target                                    |
| -------------------------------------------------------------------------------------------------------------------- | ------------: | --------------------------------------------------- |
| **Legacy custom roles** (`text-nano`, `text-micro`, `text-tiny`, `text-ui`, `text-body`, `text-content`, `--text-*`) |           740 | Replace with `text-role-*` / `--text-role-*`        |
| **Tailwind default scale** (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.)                           |           297 | Replace with `text-role-*`                          |
| **Arbitrary font sizes** (`text-[Npx]`, `[font-size:Npx]`)                                                           |            26 | Replace with `text-role-*`                          |
| **Raw CSS font sizes** (`font-size: Npx`)                                                                            |            38 | Use `var(--text-role-*)`                            |
| **Inline/React font sizes** (`style={{ fontSize: ... }}`)                                                            |            27 | Use `text-role-*` or `var(--text-role-*)`           |
| **Raw SVG font sizes** (`fontSize={...}`)                                                                            |             2 | Use `text-role-*` or `var(--text-role-*)`           |
| **Raw Canvas font literals** (`ctx.font = '...'`)                                                                    |             1 | Use `resolveTypographyRoleFont(el, role)`           |
| **Unapproved line-height overrides** (`leading-*`)                                                                   |            34 | Remove or use companion line height                 |
| **Application text below 11 px floor**                                                                               |           160 | Eliminate; elevate to Subheadline (11 px) or higher |

### Migration Map by Surface

| Surface Group                       | Key Components / Files                                                                                                                 | Semantic Role Target                                                                           | Notes                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Main Shell & Toolbar**            | `App.tsx`, `MainToolbar.tsx`, `PlaybackControls.tsx`, `ToolbarDisplays.tsx`, `ToolbarBlueLive.tsx`                                     | Body (13/16), Callout (12/15), Headline (13/16 bold)                                           | Keep monospaced playhead/selection readouts at Body/Callout                                 |
| **Settings & Secondary Windows**    | `SettingsApp.tsx`, `SettingsSection.tsx`, `SettingsField.tsx`, `AboutApp.tsx`, `EffectEditorPage.tsx`, `TrackInstrumentEditorPage.tsx` | Title 2 (17/22), Title 3 (15/20), Body (13/16), Callout (12/15)                                | Form controls inherit Body baseline                                                         |
| **Libraries & Dialogs**             | `LibraryBreadcrumbs.tsx`, `LibraryTree.tsx`, `LibrarySearchBar.tsx`, `ErrorBoundary.tsx`, `ColorPicker.tsx`                            | Body (13/16), Callout (12/15), Title 3 (15/20)                                                 | Breadcrumbs and search bar use Body                                                         |
| **Workbench & Panels**              | `WorkbenchShell.tsx`, `DockviewPanel.tsx`, `AuxiliaryRail.tsx`, `AuxiliarySlideout.tsx`, `ReplConsolePanel.tsx`, `OutputPanel.tsx`     | Title 3 (15/20), Headline (13/16 bold), Body (13/16)                                           | Dockview tabs use Body (13/16); output/repl use Body monospaced                             |
| **Mixer**                           | `MixerPanel.tsx`, `ChannelStrip.tsx`, `EffectsChainContextMenu.tsx`                                                                    | Subheadline (11/14) for meters/faders/bus labels; Callout/Body for channel names and selectors | Adjust channel strip row heights for 11–13 px text                                          |
| **Piano Roll & Score**              | `PitchHeader.tsx`, `TimeBar.tsx`, `FieldEditor.tsx`, `ColumnHeader.tsx`, `PatternLayerHeader.tsx`, `ScoreTimeCanvas.tsx`               | Subheadline (11/14) for pitch names, ruler marks, time marks; Callout/Body for headers         | Selective pitch label display on smallest rows                                              |
| **Line Editors & Automation**       | `EditableLineCanvas.tsx`, `AutomationLineView.tsx`, `LineDefinitionTable.tsx`, `TableEditor.tsx`                                       | Subheadline (11/14) via `resolveTypographyRoleFont`                                            | Canvas/SVG text resolves `--text-role-subheadline`                                          |
| **BlueX7 & Specialized Tools**      | `blue-x7-editor.tsx`, `operator-panel.tsx`, `envelope-editor.tsx`, `SoundFontViewerPanel.tsx`, `TrackerScoreObjectEditor.tsx`          | Title 3, Headline, Callout, Subheadline                                                        | Preserve monospaced tracker cells; operator grid uses Callout                               |
| **Blue Synth Builder (BSB) Chrome** | `BSBPropertySheet.tsx`, `FontChooserDialog.tsx`, `ValuePanel.tsx`, `BSBXYControllerWidget.tsx`, `WidgetWrapper.tsx`                    | Title 3, Headline, Body, Callout                                                               | **BSB application chrome is not exempt.** Only user-authored widget font data is preserved. |

---

## 12. Exception Registry

<!-- renderer-typography-exceptions:start -->

```json
{
  "schemaVersion": 1,
  "exceptions": [
    {
      "id": "bsb-dropdown-widget-authored-font-size",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBDropdownWidget.tsx",
      "category": "project-authored-font",
      "expression": "const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB Dropdown Widget rendering",
      "reason": "Reads project-authored widget fontSize property with fallback to 12",
      "verification": "packages/blue-app/src/renderer/tests/bsb-widget-layout.test.ts",
      "reviewPolicy": "Preserve canonical project-authored font size without coercion"
    },
    {
      "id": "bsb-utils-authored-dropdown-font-size",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts",
      "category": "project-authored-font",
      "expression": "const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;",
      "expectedOccurrences": 2,
      "ownerSurface": "BSB Widget layout utilities",
      "reason": "Measures dropdown text width and widget height based on project-authored fontSize property with fallback to 12",
      "verification": "packages/blue-app/src/renderer/tests/bsb-widget-layout.test.ts",
      "reviewPolicy": "Preserve canonical project-authored font size without coercion"
    },
    {
      "id": "bsb-widget-layout-authored-dropdown-font-size",
      "path": "packages/blue-app/src/shared/bsb-widget-layout.ts",
      "category": "project-authored-font",
      "expression": "const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB Widget shared layout calculations",
      "reason": "Calculates dropdown display bounds based on project-authored fontSize property with fallback to 12",
      "verification": "packages/blue-app/src/renderer/tests/bsb-widget-layout.test.ts",
      "reviewPolicy": "Preserve canonical project-authored font size without coercion"
    },
    {
      "id": "bsb-swing-html-measurement-font",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts",
      "category": "project-authored-font",
      "expression": "style.font = font;",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB imported Swing HTML measurement",
      "reason": "Measures imported project-authored HTML using its preserved font shorthand",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Preserve imported HTML typography until the authored-data boundary changes"
    },
    {
      "id": "bsb-swing-html-measurement-line-height",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/utils.ts",
      "category": "single-line-line-height",
      "expression": "style.lineHeight = 'normal';",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB imported Swing HTML measurement",
      "reason": "Uses browser-normal line height while measuring imported authored HTML",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Remove if imported HTML measurement no longer needs an authored-text boundary"
    },
    {
      "id": "bsb-label-authored-line-height",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBLabelWidget.tsx",
      "category": "single-line-line-height",
      "expression": "lineHeight: 'normal'",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB authored label rendering",
      "reason": "Restores a browser-normal line box for a persisted project-authored font size instead of inheriting the application Body line height",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Keep local to authored BSB label text; do not use this exception for application chrome"
    },
    {
      "id": "bsb-group-authored-line-height",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBGroupWidget.tsx",
      "category": "single-line-line-height",
      "expression": "lineHeight: 'normal'",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB authored group-title rendering",
      "reason": "Restores a browser-normal line box for a persisted project-authored group-title font size instead of inheriting the application Body line height",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Keep local to authored BSB group titles; do not use this exception for application chrome"
    },
    {
      "id": "bsb-knob-authored-line-height",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget.tsx",
      "category": "single-line-line-height",
      "expression": "lineHeight: 'normal'",
      "expectedOccurrences": 1,
      "ownerSurface": "BSB authored knob-label rendering",
      "reason": "Restores a browser-normal line box for a persisted project-authored knob-label font size instead of inheriting the application Body line height",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Keep local to authored BSB knob labels; do not use this exception for application chrome"
    },
    {
      "id": "bsb-dropdown-authored-line-height",
      "path": "packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/widgets/BSBDropdownWidget.tsx",
      "category": "single-line-line-height",
      "expression": "lineHeight: 'normal'",
      "expectedOccurrences": 2,
      "ownerSurface": "BSB authored dropdown rendering",
      "reason": "Restores a browser-normal line box for persisted project-authored dropdown font sizes in the selected value and menu entries",
      "verification": "packages/blue-app/src/renderer/tests/bsb-swing-html.test.tsx",
      "reviewPolicy": "Keep local to authored BSB dropdown text; do not use this exception for application chrome"
    }
  ]
}
```

<!-- renderer-typography-exceptions:end -->
