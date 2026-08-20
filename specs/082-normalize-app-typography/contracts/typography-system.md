# Contract: Application Typography System

## Purpose

Define the one semantic typography layer used by every Blue-owned renderer
surface while preserving project-authored typography as canonical project data.

## Catalog Contract

`packages/blue-app/src/renderer/styles/index.css` is the sole machine source of
application role metrics. Its Tailwind theme MUST be equivalent to:

```css
@theme static {
  --text-*: initial;

  --text-role-large-title: 26px;
  --text-role-large-title--line-height: 32px;
  --text-role-title-2: 17px;
  --text-role-title-2--line-height: 22px;
  --text-role-title-3: 15px;
  --text-role-title-3--line-height: 20px;
  --text-role-headline: 13px;
  --text-role-headline--line-height: 16px;
  --text-role-body: 13px;
  --text-role-body--line-height: 16px;
  --text-role-callout: 12px;
  --text-role-callout--line-height: 15px;
  --text-role-subheadline: 11px;
  --text-role-subheadline--line-height: 14px;
}
```

The exact source may include comments and other theme namespaces, but it MUST:

- clear Tailwind's complete default text-size namespace before role definitions;
- emit all role variables even when a role has no detected utility call site;
- expose exactly seven application font-size utilities;
- expose no retired or generic Tailwind text-size utility;
- keep Headline and Body at identical 13/16 metrics; and
- keep every application role at or above 11 logical pixels.

## Role Selection Contract

Select the smallest role that matches information purpose, not the dimensions of
the current container.

| Question | Role |
|---|---|
| Is this the application identity on Welcome/About? | Large Title |
| Is this a major window, dialog, or top-level panel title? | Title 2 |
| Is this a section title or prominent inspector group? | Title 3 |
| Is this a compact heading or column/group heading? | Headline + bold |
| Is this a control, input, menu, list/table value, code, output, or ordinary content? | Body |
| Is this secondary/helper/shortcut/badge/compact-control text? | Callout |
| Is this a genuinely dense canvas, ruler, timeline, mixer, or graph annotation? | Subheadline |

Subheadline MUST NOT be used merely to force a label into an undersized box.
Grow, reflow, wrap, scroll, intentionally truncate, or selectively omit
nonessential annotation before choosing a smaller role.

## Inheritance Contract

Every production renderer entry point imports `styles/index.css`. The global
`body` style MUST establish `--text-role-body` size and its 16 px line height in
addition to the existing family/color baseline. Text without a more specific
assignment therefore inherits Body.

The implementation MUST confirm inherited Body behavior for:

- main workbench;
- Settings;
- About;
- effect editor/interface windows;
- track instrument editor windows;
- form controls after Tailwind Preflight;
- empty/loading/error/recovery states; and
- third-party-rendered application chrome such as Dockview and CodeMirror.

The root `html` font size MUST remain unchanged because it also controls rem-based
layout geometry.

## Delivery Path Contract

### Tailwind markup

Use one of the seven `text-role-*` utilities. Add a permitted explicit weight
utility when needed; Headline call sites MUST be bold.

```tsx
<h3 className="text-role-headline font-bold">Operators</h3>
<label className="text-role-body">Frequency</label>
<span className="text-role-callout">Command-R</span>
```

### CSS, Dockview, and CodeMirror

Use the emitted variables directly. Do not add an alias scale.

```css
.dense-annotation {
  font-size: var(--text-role-subheadline);
  line-height: var(--text-role-subheadline--line-height);
}
```

Dockview font variables and CodeMirror theme objects MUST resolve through the
same role variables.

### Inline SVG and React styles

Prefer a role utility or CSS style referencing a role variable. Raw numeric
`fontSize`, `font-size`, and `font` values are invalid even when numerically equal
to an approved role.

### Canvas

Canvas code MUST choose a semantic role and resolve its computed CSS value from a
renderer element before composing the context's CSS font string. Repeated Canvas
call sites MAY share one small renderer-only helper with behavior equivalent to:

```ts
resolveTypographyRoleFont(element, roleId, { family, weight }): string
```

The helper MUST read the existing CSS variables, return a valid Canvas font
string, have no hardcoded duplicate metric table, and fail clearly if a role is
unknown or unresolved. Raw strings such as `ctx.font = "11px monospace"` are not
compliant.

## Weight and Family Contract

- Existing Roboto remains the proportional application family.
- Existing monospaced families remain appropriate for code, output, tracker, and
  authored content, but use role metrics.
- Headline defaults to bold. Other roles may use the regular/semibold/bold
  emphasis allowed in the feature catalog.
- Weight, capitalization, color, and spacing MAY express hierarchy but MUST NOT
  create an undeclared size role.
- State changes MUST NOT reduce font size.

## Line-Height Contract

The role's line-height companion is the default and is part of the semantic
contract. `leading-*`, raw `line-height`, or inline `lineHeight` that replaces it
is prohibited unless a narrowly documented single-line exception proves that the
text remains unclipped and vertically centered. The audit MUST identify both
unapproved and stale line-height exceptions.

## Ownership Boundary Contract

### Application-owned

All Blue-supplied labels, controls, values, headings, diagnostics, tables,
drawn annotations, editor chrome, BSB property/editor chrome, and window content
use the role catalog.

### Project-authored

Persisted or imported BSB font values—including `font.size`, `labelFont.size`,
`fontSize`, and supported Swing HTML font sizing—remain owned by the active
`BlueData` project and render unchanged. Only exact data-transport/rendering
expressions may be registered as exceptions.

No project load, model, XML, mutation, save, or migration code may coerce these
values. Existing round-trip fixtures MUST prove minimum, typical, maximum, and
legacy imported sizes remain exact with unrelated/unknown data.

### Non-text graphics

Prefer Lucide/SVG icons over font glyphs. A retained non-text glyph MAY be an
exact documented exception only if it carries no textual reading role and any
interactive control has an accessible name. No application-owned readable text
below 11 px can be excepted.

## Geometry Contract

When new metrics do not fit, preserve typography and adapt the layout. Required
review areas include mixer strips, score/timeline rows, piano-roll pitch labels,
line/automation/JMask surfaces, BlueX7, SoundFont/tracker tables, workbench rails,
and BSB application chrome.

Permitted adaptations include:

- larger or content-derived row/control dimensions;
- wrapping or scrolling;
- intentional ellipsis with existing access to the full value;
- retuned vertical offsets and baselines; and
- reduced frequency of nonessential drawn annotations.

Clipping, overlap, lost essential actions, and shrinking below the selected role
are prohibited.

## Zoom and Density Contract

Metrics are logical CSS pixels at 100% Actual Size. Existing application zoom
continues to scale the complete UI from 50% through 300%; it is the only overall
scale control and introduces no new typography preference. The same semantic
catalog applies on macOS, Windows, Linux, high-density, and standard-density
displays.

## Documentation Contract

`docs/typography.md` MUST be delivered with implementation and MUST contain:

- authority/scope and macOS HIG rationale;
- the logical point-to-Electron/CSS mapping;
- exact roles, utilities, variables, metrics, and permitted emphasis;
- role-selection and Body-inheritance guidance;
- font-family and contrast/opacity guidance;
- application-owned/project-authored/non-text boundaries;
- Tailwind, CSS, Dockview, CodeMirror, SVG, and Canvas examples;
- dense-layout, zoom, and density expectations;
- the machine-readable exception registry;
- positive examples and prohibited anti-patterns;
- automated and manual validation instructions; and
- the same-change maintenance rule.

`AGENTS.md` MUST tell agents doing any renderer UI work to consult that guide,
preserve project-authored typography, and update the guide in the same change if
roles, metrics, ownership boundaries, or exception policy change.

## Non-Goals

- Replacing Roboto or established monospaced fonts.
- Adding a user-selectable font-size preference.
- Changing app zoom behavior or persistence.
- Modifying `.blue` XML or authored BSB typography.
- Adding IPC, preload, main-process, Java, engine, or external runtime contracts.
