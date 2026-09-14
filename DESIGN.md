---
version: alpha
name: Blue
description: >-
  Dark, professional design system for Blue, a visual composition environment
  for Csound. Ported from the Java Blue (NetBeans RCP) UI; control colors are
  sampled from Java Blue's active toolbar and tab controls for cross-platform
  parity. Dense, keyboard-first desktop tooling at pro-audio information density.
colors:
  primary: '{colors.app-accent}'
  app-bg: '#1a1a2e'
  app-surface: '#16213e'
  app-surface-strong: '#10192a'
  app-surface-raised: '#111a2d'
  app-surface-subtle: '#141d33'
  app-canvas: '#0d0d1a'
  app-overlay: '#0d1524'
  app-input: '#0a0f1a'
  app-menu: '#1e1e3a'
  app-field: '#12122a'
  app-hover: '#1d2c45'
  app-border: '#0f3460'
  app-border-muted: 'rgba(84, 108, 155, 0.28)'
  app-border-strong: '#6fa6e6'
  app-border-subtle: 'rgba(94, 119, 168, 0.24)'
  app-tab-active-edge: '#6fa6e6'
  app-accent: '#6b9ee8'
  app-accent-hover: '#598cd6'
  app-accent-foreground: '#08101e'
  app-focus: '#60a5fa'
  app-highlight: 'rgba(86, 119, 182, 0.46)'
  app-selection: 'rgba(93, 135, 210, 0.38)'
  app-text: '#dbe2ef'
  app-text-strong: '#ffffff'
  app-text-bright: '#eef4ff'
  app-text-soft: '#cbd5e1'
  app-text-muted: '#9aa8c2'
  app-text-subtle: '#8a99b5'
  app-text-disabled: 'rgba(154, 167, 193, 0.54)'
  app-success: '#22c55e'
  app-warning: '#f59e0b'
  app-danger: '#f87171'
  app-success-foreground: '#02260f'
  app-warning-foreground: '#261600'
  app-danger-foreground: '#1c0505'
typography:
  large-title:
    fontFamily: Roboto
    fontSize: 26px
    fontWeight: 400
    lineHeight: 32px
  title-2:
    fontFamily: Roboto
    fontSize: 17px
    fontWeight: 400
    lineHeight: 22px
  title-3:
    fontFamily: Roboto
    fontSize: 15px
    fontWeight: 400
    lineHeight: 20px
  headline:
    fontFamily: Roboto
    fontSize: 13px
    fontWeight: 700
    lineHeight: 16px
  body:
    fontFamily: Roboto
    fontSize: 13px
    fontWeight: 400
    lineHeight: 16px
  callout:
    fontFamily: Roboto
    fontSize: 12px
    fontWeight: 400
    lineHeight: 15px
  subheadline:
    fontFamily: Roboto
    fontSize: 11px
    fontWeight: 400
    lineHeight: 14px
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 10px
  2xl: 12px
spacing:
  base: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  window:
    backgroundColor: '{colors.app-bg}'
    textColor: '{colors.app-text}'
  button-primary:
    backgroundColor: '{colors.app-accent}'
    textColor: '{colors.app-accent-foreground}'
    rounded: '{rounded.lg}'
  button-primary-hover:
    backgroundColor: '{colors.app-accent-hover}'
  button-secondary:
    backgroundColor: '{colors.app-border}'
    textColor: '{colors.app-text-strong}'
    rounded: '{rounded.lg}'
  button-hover:
    backgroundColor: '{colors.app-hover}'
  toolbar:
    backgroundColor: '{colors.app-surface}'
    textColor: '{colors.app-text}'
  panel:
    backgroundColor: '{colors.app-surface}'
    textColor: '{colors.app-text}'
  panel-raised:
    backgroundColor: '{colors.app-surface-raised}'
  panel-subtle:
    backgroundColor: '{colors.app-surface-subtle}'
  canvas:
    backgroundColor: '{colors.app-canvas}'
  input:
    backgroundColor: '{colors.app-input}'
    textColor: '{colors.app-text-soft}'
    rounded: '{rounded.sm}'
  field:
    backgroundColor: '{colors.app-field}'
  menu:
    backgroundColor: '{colors.app-menu}'
    textColor: '{colors.app-text-bright}'
  menu-item-highlighted:
    backgroundColor: '{colors.app-highlight}'
  menu-item-disabled:
    textColor: '{colors.app-text-disabled}'
  selection:
    backgroundColor: '{colors.app-selection}'
  overlay:
    backgroundColor: '{colors.app-overlay}'
  divider:
    backgroundColor: '{colors.app-border-muted}'
  text-secondary:
    textColor: '{colors.app-text-muted}'
  text-faint:
    textColor: '{colors.app-text-subtle}'
  status-success:
    textColor: '{colors.app-success}'
  status-warning:
    textColor: '{colors.app-warning}'
  status-danger:
    textColor: '{colors.app-danger}'
  tab-active-edge:
    backgroundColor: '{colors.app-tab-active-edge}'
    height: 3px
---

# Blue — Design System

## Overview

Blue is a dense, keyboard-first desktop composition environment for Csound,
ported from Java Blue's NetBeans UI. The look is a **deep navy instrument
panel**: layered translucent surfaces over a dark canvas, a single sampled-blue
accent, and monospace numeric readouts — closer to a DAW or audio editor than
a consumer web app.

Interface copy is professional and terse. The UI optimizes for long sessions:
low-glare dark palette, 13px working text, and information density (compact
controls, tight lists, monospace time/level values). Depth comes from layered
surface gradients and hairline borders, not heavy drop shadows.

**Canonical sources:** token values live in
`packages/blue-app/src/renderer/styles/index.css` (Tailwind 4 `@theme`);
typography rules are governed by `docs/typography.md`. This file distills
them for agents; when the sources disagree, the sources win. Color, contrast,
focus, and authored-content boundaries are governed by
[docs/color-accessibility.md](docs/color-accessibility.md).

Keep this file as a small orientation guide for UI changes. Its YAML follows
[Google's DESIGN.md format](https://github.com/google-labs-code/design.md)
and records a representative subset of the implemented tokens, not a second
runtime theme. Component entries summarize common fills and foregrounds;
they do not encode gradients, borders, or every state. Spacing and rounding
entries describe common dimensions, not custom CSS tokens or exhaustive scales.
When changing the represented design, update this summary alongside its sources.
This review is based on source inspection, not a rendered visual acceptance run.

## Colors

A navy surface hierarchy with one accent and a fixed text ladder.

- **Surfaces (`app-bg` #1a1a2e → `app-canvas` #0d0d1a):** the app recedes from
  chrome (`app-bg`, `app-surface`) into working canvases (`app-canvas`,
  `app-overlay`) and input wells (`app-input`). These are contextual surface roles, not a strict luminance scale;
  BSB has its own lighter canvas (`app-bsb-canvas` #26334c).
- **Accent (`app-accent` #6b9ee8):** sampled from Java Blue's active toolbar
  and tab controls. Used for active toolbar controls and primary actions;
  active tab edges use the distinct `app-tab-active-edge` token (#6fa6e6). Hover steps to `app-accent-hover`; solid accent fills pair with
  `app-accent-foreground` (near-black). Accent-tinted hover fills on inactive
  toolbar buttons retain `app-text-strong`.
- **Borders (`app-border` #0f3460):** a desaturated blue used structurally;
  `app-border-muted`/`app-border-subtle` (alpha variants) for dividers,
  `app-border-strong` for emphasis edges.
- **Text ladder:** `app-text-strong` (#ffffff) for emphasized/control text →
  `app-text-bright` (#eef4ff) menu/toast emphasis → `app-text` (#dbe2ef) body → `app-text-soft` → `app-text-muted` secondary →
  `app-text-subtle` faint annotations → `app-text-disabled`.
- **Semantic states:** `app-success` #22c55e, `app-warning` #f59e0b,
  `app-danger` #f87171 — used sparingly for playback, transport warnings, and
  errors. Selection (`app-selection`) and highlight (`app-highlight`) are
  translucent blues reserved for list/canvas selection and menu highlight.

The implemented application theme is **dark**; a light theme would require
coordinated token and contrast work. The
full token set (including BSB control, timeline, and pattern colors) lives in
`styles/index.css`. Success, warning, and danger fills have matching
`*-foreground` tokens; verify each rendered fill/foreground pair, including
alpha compositing, against the color accessibility guide.

Project-authored BSB colors/fonts, score-layer colors, and sound-object colors
are preserved project data. Do not force them into the application palette.
Language syntax colors have registered exceptions in
[theme-exceptions.md](specs/051-theme-token-cleanup/theme-exceptions.md);
readable code comments still have contrast requirements.

## Typography

Guided by Apple macOS HIG text styles; 1pt maps 1:1 to 1 CSS px at 100% zoom.
Roboto (bundled via `@fontsource/roboto`) with system fallbacks; monospace
for time, levels, code, and technical readouts. CodeMirror uses
`"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`;
Dockview currently declares a system-first font stack separately.

- **Large title (26/32):** welcome and about identity only.
- **Title 2 (17/22):** major window, dialog, and top-level panel titles.
- **Title 3 (15/20):** section titles and prominent inspector groups.
- **Headline (13/16, Bold):** compact and column/group headings. Shares
  metrics with Body; hierarchy comes from weight alone.
- **Body (13/16):** default for controls, menus, inputs, lists, tables, and
  code output.
- **Callout (12/15):** secondary labels, shortcuts, badges, helper text.
- **Subheadline (11/14):** dense canvas, ruler, timeline, mixer, and graph
  annotations only.

**11px is the absolute readability floor** for application-owned text. In
Tailwind, use the role utilities (`text-role-body`, `text-role-headline`, …)
— never raw `text-[13px]`. Headline requires `font-bold` at the call site;
the role utility supplies metrics, not weight. Preserve the companion line height
and grow, wrap, scroll, or deliberately truncate containers instead of shrinking text. Canvas rendering resolves roles via
`resolveTypographyRoleFont()` in `lib/typography.ts`.

Project-authored BSB font values and imported Swing HTML are exempt from the
application role catalog and must not be clamped to the 11px application floor.

## Layout

A workbench grid, not a scrolling page: a Dockview-managed center, auxiliary rails on the
left/right/bottom edges, and docked or slide-out auxiliary panels. Panels can
also float or pop out into separate windows. Panel tabs are 35px tall. The toolbar (menu bar row) is compact
(`px-3 py-2.5`).

Spacing uses Tailwind's default 4px-base scale directly (`gap-2`, `px-3`,
`py-2.5`); there are no custom spacing tokens. Controls are compact: menu
items 28–32px min-height, toolbar icon buttons 36px, mixer channel strips
88px wide. Density beats whitespace — pad just enough to separate hit
targets, then stop.

Existing CSS examples: auxiliary slideouts use z-index 30, edge drop targets
50, context menus 120, tooltips 130, and the mixer send-editor backdrop 9999.
These are local implementation values, not a global layer-token contract.
Reuse the relevant overlay component and check its stacking context.

## Elevation & Depth

Depth is layered, not lifted. Panels separate through **surface stepping +
hairline borders + inner outlines**, with shadows reserved for floating
layers:

- Menus/popovers: `0 14px 28px rgba(3,7,18,0.3)` plus
  `inset 0 0 0 1px` outline (`app-outline-subtle`).
- Floating Dockview groups: `0 20px 48px` in `app-shadow`; workbench
  menus use `0 24px 48px`. The mixer send dialog uses `0 8px 32px`.
- Panels/chrome: 1px `app-border` (or alpha `app-border-muted`) borders;
  no drop shadow.
- Slides/rails: stacked `color-mix` gradients of `app-surface`,
  `app-overlay`, and `app-hover` to suggest recession.

## Shapes

- `sm` 4px — edge-rail buttons and small controls.
- `md` 6px — small header actions, dialogs in panels.
- `lg` 8px — toolbar buttons, context menus, code editor wells.
- `xl` 10px — toolbar display cards (`rounded-xl`) and workbench context menus.
- `2xl` 12px — available Tailwind rounding; not the toolbar-card radius.
- Smaller 3px radii occur on mixer inputs; menu items can use 7px.
- `rounded-full` is used for status badges, dots, handles, knobs, and some
  circular controls (for example the tracker editor). Reuse the local pattern.

## Components

- **Toolbar buttons** (`.toolbar-icon-button`, `.toolbar-text-button`):
  bordered, `app-border`-toned background, accent-tinted hover, `.is-active`
  fills with `app-accent` + `app-accent-foreground` text.
- **Context menus** (Radix primitives, `.toolbar-context-menu`,
  `.editor-context-menu`, `.workbench-context-menu`): gradient surface
  (`app-surface-raised` → `app-menu`); workbench items have 7px radii,
  toolbar items are square. Highlighted items
  use `app-highlight` with `app-text-strong`; shortcuts right-aligned in
  `app-text-soft` at callout size.
- **Dockview tabs:** active tab shows a 3px top edge in
  `app-tab-active-edge` (right edge for vertical tabs); inactive tabs step down the surface ladder; focus
  keeps a 2px `app-focus` inset ring.
- **Edge rails:** vertical uppercase label buttons (writing-mode vertical,
  108px min-height), letter-spaced 0.16em, subtle gradient fill; active state
  adds an accent-tinted border and inset outline.
- **Mixer strips:** 88px fixed width, centered channel names at headline
  size, uppercase letter-spaced micro-labels (subheadline, 0.15em) for
  chain/level sections, monospace level values.
- **Output panel:** tab strip with 2px `app-focus` bottom underline on the
  active tab; monospace preformatted log lines.
- **Toasts:** sonner, styled via `lib/toast-styles.ts` with theme tokens.
- **Icons:** Lucide/SVG is the preferred application icon vocabulary; transport
  uses 16px icons inside 36px buttons. Icon-only actions need accessible names,
  and toggle controls expose pressed/selected state. Existing toast icons use
  text glyphs.
- **Editors:** score/timeline, mixer, and code surfaces keep their specialized
  geometry and data colors. Use BSB-specific surface tokens for synth-builder
  chrome and preserve authored widget appearance.
- **Motion:** quick and functional — 100–150ms ease transitions on
  color/border, 100ms tooltip fade, 450ms ease-out code-eval flash. Keep motion tied to interaction feedback; existing status dots also pulse.

## Do's and Don'ts

- **Do** style application-owned chrome with `--color-app-*` / `--text-role-*` tokens via
  Tailwind utilities (`bg-app-surface`, `text-app-text-muted`); **don't**
  introduce ad-hoc hex values in components.
- **Do** merge classes with `cn()` (`lib/cn.ts` — tailwind-merge configured
  for `text-role-*`) so role utilities override correctly.
- **Don't** render app-owned text below 11px, and don't use `subheadline`
  outside dense canvas/timeline/mixer contexts.
- **Do** keep keyboard focus visible: 2px `app-focus` outline with
  `focus-visible`; suppress pointer-focus outlines only on `tabindex="-1"`
  shells and separator buttons, per `styles/index.css` base rules.
- **Do** reuse existing semantic tokens for new controls. For parity bugs,
  consult Java Blue first (`~/work/nbprojects/blue/blue-ui-core`) and document
  intentional divergence; this does not require resampling every new control.
- **Do** keep status understandable through text, icons, or shape as well as
  color. Follow the color accessibility guide for contrast and focus.
- **Don't** restyle third-party chrome (dockview, CodeMirror) with raw
  values — bind their CSS variables (`--dv-*`, CodeMirror theme) to
  `--color-app-*` tokens.

For implementation examples, start with
[styles/index.css](packages/blue-app/src/renderer/styles/index.css),
[WorkbenchShell.tsx](packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx),
[PlaybackControls.tsx](packages/blue-app/src/renderer/components/menu-bar/PlaybackControls.tsx),
[SelectedCodeEditor.tsx](packages/blue-app/src/renderer/components/workbench/panels/editors/SelectedCodeEditor.tsx),
and [toast-styles.ts](packages/blue-app/src/renderer/lib/toast-styles.ts).
For UI changes, use `pnpm audit:renderer-theme` and
`pnpm audit:renderer-typography`, plus the affected component tests and visual
checks required by the canonical guides. A token summary alone does not certify
rendered accessibility.
