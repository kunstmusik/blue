# Research: Normalize Application Typography

## Sources and Method

This research treats the two supplied reports as advisory inputs rather than
instructions:

- [`FONT_SIZING_REPORT_GLM.md`](/Users/stevenyi/work/FONT_SIZING_REPORT_GLM.md)
- [`gemini_font_sizing_research_report.md`](/Users/stevenyi/Downloads/gemini_font_sizing_research_report.md)

Their claims were checked against the current branch, Apple and Chromium
documentation, Tailwind v4 behavior, existing Java Blue density, renderer entry
points, project-authored BSB paths, CI workflows, and focused tests. The codebase
audit scanned production renderer CSS/HTML/JavaScript/TypeScript and shared BSB
rendering helpers, excluding tests, browser fixtures, mocks, generated output,
and dependencies.

### Report reconciliation

| Report claim/recommendation | Result |
|---|---|
| Blue has multiple overlapping custom, Tailwind-default, arbitrary, CSS, SVG, and Canvas scales | Accepted and confirmed; the current inventory is materially larger than either report's smallest grep set |
| Existing 8–10 px application chrome is difficult to read and concentrated in dense editors | Accepted; the audit identifies mixer, piano roll, score/timeline, BlueX7, line/JMask, BSB chrome, tracker, SoundFont, and workbench rails as geometry-coupled hotspots |
| macOS HIG should drive the role hierarchy | Accepted, with a smaller seven-role subset and a deliberate 11 px floor |
| A 13 pt macOS Body role must become roughly 17.3 CSS px | Rejected; Electron uses unzoomed CSS logical pixels/DIPs at Actual Size, so the plan uses a one-to-one logical mapping |
| Existing tokens can be fixed by globally retargeting their numeric values | Rejected; current names are size-relative and call sites require semantic classification |
| A short four-pattern regression grep is sufficient | Rejected; it misses default Tailwind variants, CSS variables, style objects, line-height, SVG, Canvas, and stale authored-data exceptions |
| Persisted BSB font values should remain unchanged | Accepted and elevated to an explicit canonical-data boundary with exact round-trip coverage |
| Validation should combine automation and visual review | Accepted; the clarified design uses a CI-blocking source inventory plus a recorded two-density macOS visual matrix |

## Decision 1: Use a Seven-Role macOS-Guided Catalog with an 11 px Floor

**Decision**: Use Large Title 26/32, Title 2 17/22, Title 3 15/20,
Headline 13/16 bold, Body 13/16 regular, Callout 12/15, and Subheadline
11/14. Omit Title 1, Footnote, Caption 1, and Caption 2. Treat 11 logical pixels
as Blue's application-owned floor at 100% Actual Size.

**Rationale**: Apple's [typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography)
supplies the macOS role metrics and identifies 13 pt as the default macOS text
size. Apple's general [UI design tips](https://developer.apple.com/design/tips/)
recommend at least 11 pt for typical viewing. Blue adopts the smaller sufficient
subset that matches its actual hierarchy while choosing the more conservative
11 px floor for cross-platform readability. Headline and Body intentionally
share metrics and differ by emphasis.

**Alternatives considered**:

- Keep Apple's complete catalog, including 10 pt Footnote/Caption roles: rejected
  because it preserves the micro tier responsible for current legibility issues.
- Use the five-tier catalog proposed by one report: rejected because it conflates
  titles and compact headings and does not map cleanly to the approved HIG roles.
- Preserve Java Blue's common 10 pt dense labels: rejected as an intentional,
  documented divergence; Java remains evidence for geometry and project parity,
  not the final readability threshold.

## Decision 2: Map HIG Logical Metrics One-to-One to Electron CSS Pixels

**Decision**: Express the catalog as exact CSS `px` values equal to the approved
HIG logical values at 100% application zoom. Do not multiply point sizes by 4/3.

**Rationale**: Chromium documents that unzoomed CSS pixels and device-independent
pixels are equivalent when page/pinch zoom is absent in its
[coordinate-space model](https://chromium.googlesource.com/playground/chromium-org-site/+/refs/heads/main/developers/design-documents/blink-coordinate-spaces/index.md).
Electron's existing 100% Actual Size is the unzoomed logical baseline. Physical
device pixels vary with display density and are not the design unit.

**Alternatives considered**:

- Convert 13 pt to about 17.3 CSS px: rejected because it mixes print/CSS
  physical-unit conversion with native-interface logical sizing and would
  overinflate the desktop UI.
- Use rem values for the token source: rejected because exact px values state the
  approved logical contract directly and avoid coupling typography to a future
  root rem change. Existing rem-based spacing is deliberately not rescaled.

## Decision 3: Use Explicitly Prefixed Semantic Names

**Decision**: Expose exactly these seven utilities and variables:

| Role | Tailwind utility | CSS variable | Metrics |
|---|---|---|---:|
| Large Title | `text-role-large-title` | `--text-role-large-title` | 26/32 |
| Title 2 | `text-role-title-2` | `--text-role-title-2` | 17/22 |
| Title 3 | `text-role-title-3` | `--text-role-title-3` | 15/20 |
| Headline | `text-role-headline` | `--text-role-headline` | 13/16 |
| Body | `text-role-body` | `--text-role-body` | 13/16 |
| Callout | `text-role-callout` | `--text-role-callout` | 12/15 |
| Subheadline | `text-role-subheadline` | `--text-role-subheadline` | 11/14 |

Each variable has the Tailwind line-height companion
`--text-role-<role>--line-height`.

**Rationale**: The `role-` prefix makes semantic intent visible at every call
site and lets the legacy `--text-body` variable be genuinely removed rather than
silently redefined. It also distinguishes the catalog from Tailwind's numeric
default scale.

**Alternatives considered**:

- Reuse `text-body` and introduce plain `text-callout`/`text-subheadline`:
  rejected because `--text-body` is an explicitly retired legacy token and
  reuse would make the migration and audit ambiguous.
- Keep `nano`, `micro`, `tiny`, `ui`, `body`, and `content` with larger values:
  rejected because those names describe relative size rather than purpose.

## Decision 4: Keep One CSS-First Tailwind Token Source

**Decision**: Define the catalog in
`packages/blue-app/src/renderer/styles/index.css` using `@theme static`, clear
the complete namespace with `--text-*: initial`, then define only the seven role
variables and companions. Do not modify `tailwind.config.mjs` for typography.

**Rationale**: Tailwind's [font-size documentation](https://tailwindcss.com/docs/font-size)
maps `--text-*` variables and their line-height companions to utilities. Its
[theme-variable documentation](https://tailwindcss.com/docs/theme) documents
namespace resets and `static` emission of all declared variables. `static`
ensures variables exist for CSS/SVG/CodeMirror consumers even if no matching
utility is detected. A local compiler check confirmed that the namespace reset
removes forced default utilities but arbitrary `text-[...]` values still compile,
so source validation remains necessary.

**Alternatives considered**:

- Keep Tailwind's default scale alongside semantic roles: rejected because it
  preserves a second vocabulary and cannot satisfy full semantic coverage.
- Put the catalog in TypeScript and generate CSS: rejected because it adds a
  build abstraction and a duplicate dependency boundary without demonstrated
  need.
- Configure `corePlugins` in `tailwind.config.mjs`: rejected because this app is
  CSS-first Tailwind v4 and the JavaScript file is not the effective theme source.

## Decision 5: Establish Body Through Inheritance Without Changing rem Geometry

**Decision**: Apply the Body role's size and line height to the global `body`
rule in `index.css`. Keep the existing font family and colors. Do not change the
root `html` font size.

**Rationale**: All five production renderer entry points—main, Settings, About,
effect editor, and track instrument editor—already import `index.css`. CSS
`font-size` and `line-height` inherit, Tailwind Preflight makes headings and form
controls inherit, and explicit component roles can still override the baseline.
This closes the current gap where unclassified text falls back to an unrelated
browser size.

**Alternatives considered**:

- Require every element to declare a class: rejected because it cannot provide a
  safe fallback for empty, loading, diagnostic, or third-party surface text.
- Set `html { font-size: 13px }`: rejected because it would also rescale the
  repository's rem-based spacing and sizing.

## Decision 6: Keep Weight and Family Orthogonal to Role Size

**Decision**: Keep weights as explicit `font-*` choices permitted by the role.
Pair Headline with bold at its call sites. Preserve Roboto for proportional UI
and existing monospaced families for code/output while applying the same role
metrics.

**Rationale**: Several roles permit regular or semibold emphasis. Baking weight
into every size variable would create cascade surprises when emphasis changes,
whereas explicit weight keeps semantic size stable and reviewable. Font-family
replacement is outside feature scope.

**Alternatives considered**:

- Encode every default weight in Tailwind's font-size variable companions:
  rejected because it couples emphasis to size and can override nested content.
- Adopt the macOS system font as part of this migration: rejected because the
  user requested sizing normalization, and a family change would expand visual
  and cross-platform risk materially.

## Decision 7: Route Every Rendering Path Through the Same Variables

**Decision**: Tailwind markup uses `text-role-*`; CSS, Dockview, CodeMirror, and
inline SVG use `var(--text-role-*)`; Canvas code resolves the selected CSS
variable from its renderer element before composing a valid `ctx.font` string.
A small renderer-only resolver may centralize the repeated Canvas operation.

**Rationale**: CSS variables are already available in the compiled theme and
avoid an alias catalog. SVG supports CSS styling, while Canvas `font` accepts a
parsed CSS font string but does not provide a stylesheet cascade for a bare
unresolved `var(...)`; see the [SVG styling model](https://svgwg.org/svg2-draft/styling.html)
and the [Canvas font contract](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-font).

**Alternatives considered**:

- Keep raw numeric SVG/canvas values when they happen to match a role: rejected
  because numeric equality does not convey semantic ownership and will drift.
- Add `--type-*` aliases for non-Tailwind consumers: rejected because it creates
  two names for the same catalog.

## Decision 8: Preserve Project-Authored Typography by Provenance

**Decision**: Preserve BSB `font.size`, `labelFont.size`, `fontSize`, and imported
Swing HTML font sizes exactly. Allowlist only the exact source expressions that
transport or render canonical authored values. Normalize fixed BSB toolbars,
property sheets, dialogs, tabs, XY/value readouts, and other application chrome.

**Rationale**: The active main-process `BlueData` document owns these values as
project data. Coercing them would violate lossless `.blue` compatibility. A
path-wide BSB exclusion would hide genuine application-owned violations in the
same files.

**Alternatives considered**:

- Normalize all visible BSB text: rejected because it changes authored project
  meaning and round-trip behavior.
- Exclude all BSB directories: rejected because application chrome and project
  content are interleaved.

## Decision 9: Add a Dedicated, Complete Typography Audit

**Decision**: Add `scripts/audit-renderer-typography.mjs` with Node fixture tests.
Scan production renderer `.css`, `.html`, `.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`,
and `.svg` files plus shared BSB rendering helpers. Reject retired roles,
Tailwind default utilities, arbitrary font utilities, raw unapproved CSS/inline/
SVG sizes or font shorthands, Canvas font literals, unapproved line-height
overrides, and an invalid token/body-baseline definition. Report all accepted
assignments and exceptions as well as failures.

**Rationale**: The current inventory is much broader than either report's small
grep set:

| Category | Current production occurrences | Files |
|---|---:|---:|
| Legacy custom utilities | 626 | 134 |
| Legacy `var(--text-*)` references | 57 | not separately deduplicated |
| Tailwind default size utilities | 288 | 91 |
| Arbitrary font-size utilities | 26 | 9 |

The sub-floor subset alone includes 130 legacy utilities, 15 legacy variable
references, 14 arbitrary 8/10 px utilities, and four direct 9/10 px SVG/style
assignments. Extending the existing theme-color audit would couple unrelated
policies and inherit its current non-CI failures.

**Alternatives considered**:

- Rely on the Tailwind namespace reset: rejected because arbitrary values and
  direct CSS/SVG/canvas assignments remain possible.
- Extend `audit-renderer-theme.mjs`: rejected because typography requires role
  resolution, line-height, drawn-text, and authored-data rules that do not belong
  to color-token policy.
- Use a short grep check: rejected because it misses most current violations and
  cannot validate exceptions or the exact catalog.

## Decision 10: Store Exact Exceptions in the Canonical Guide

**Decision**: Put a machine-readable JSON block with stable markers in
`docs/typography.md`. Each exception records a stable ID, exact repository path,
category, exact source expression, expected occurrence count, reason, owner
surface, verification, and review policy. The audit fails on missing, stale, or
overmatching records. Broad directory suppressions and inline disable comments
are unsupported.

**Rationale**: The guide is the user-requested canonical human design authority.
Keeping the machine allowlist in the same file follows the existing repository
theme-audit precedent and prevents policy/CI drift. Provenance and exact match
counts distinguish necessary BSB data routes from accidental typography.

**Alternatives considered**:

- Add a separate unstructured markdown exception list: rejected because the
  audit cannot validate it deterministically.
- Add a JSON file under `scripts/`: rejected because maintainers could update
  enforcement without updating the canonical guide.

## Decision 11: Block Regressions Through Existing Cross-Platform CI

**Decision**: Add root `audit:renderer-typography`, invoke the production audit
from root `lint`, and include its fixture test in `test:scripts`. Do not edit CI
workflow files.

**Rationale**: Existing pull-request and develop workflows already run root
`pnpm test` and `pnpm lint` on macOS, Windows, and Linux. The scanner test proves
detection behavior; lint enforces the current production inventory. Report paths
are normalized to repository-relative POSIX form only at the output boundary so
results remain stable across hosts.

**Alternatives considered**:

- Add workflow-specific commands: rejected because it duplicates package-script
  policy and makes local/CI behavior easier to diverge.
- Run only in tests: rejected because syntax/policy inventory is conceptually a
  lint gate, while scanner correctness belongs in tests.

## Decision 12: Use a Recorded Manual Visual Matrix for Rendered Acceptance

**Decision**: Execute every 100%-zoom visual case on macOS at native Retina and
verified standard-density (physical or DPR-1 emulated) profiles. Record device
pixel ratio, window size, fixture/state, computed role metrics, contrast samples,
geometry/accessibility results, screenshot references, and pass/fail. Separately
exercise representative essential actions at 50%, 100%, 200%, and 300% zoom.
Windows/Linux receive static CI coverage and conditional visual spot checks when
geometry regressions are suspected.

**Rationale**: Static analysis can prove vocabulary and source assignments but
cannot prove computed inheritance, native menu behavior, display rasterization,
contrast across states, clipping, or data-dependent Canvas/SVG geometry. Full
automation of all secondary windows would be brittle and is explicitly outside
the clarified requirement. Enabled information-bearing text uses the WCAG 2.2
[4.5:1 contrast criterion](https://www.w3.org/TR/WCAG22/#contrast-minimum).

**Alternatives considered**:

- Automate computed-style measurement for every window: rejected as excessive
  harness expansion for native, data-dependent, and drawn surfaces.
- Perform informal screenshots without structured samples: rejected because it
  cannot support repeatable success criteria.
- Require full visual execution on all operating systems: rejected by the
  clarified macOS-primary acceptance scope.

## Decision 13: Migrate by Semantic Risk, Not Mechanical Size Mapping

**Decision**: Establish the catalog/audit first, then migrate common chrome,
direct CSS/third-party integration, and finally geometry-sensitive drawn/dense
surfaces. Classify every occurrence by purpose rather than using a global
old-size-to-new-size substitution. Adapt containers, wrapping, scrolling,
truncation, or annotation density before reducing typography.

**Rationale**: The audit found fixed 14–22 px rows and tightly positioned labels
in mixer strips, score rulers, piano roll, BlueX7, line/automation editors, JMask,
BSB, tracker, SoundFont, and workbench rails. A mechanical replacement can cause
clipping or change title hierarchy. The piano roll in particular supports rows
as small as 5 px, so nonessential label frequency must adapt instead of shrinking
text below the floor.

**Alternatives considered**:

- Replace every old size with its nearest numeric role: rejected because current
  sizes do not consistently encode semantic purpose.
- Raise only sub-11 px values: rejected because it leaves overlapping vocabularies,
  inconsistent hierarchy, and future regression paths intact.

## Resolved Unknowns

No open planning unknowns remain. During implementation, the only conditional
acceptance setup is display density: a DPR-1 emulation must be verified at runtime;
if it does not actually report DPR 1 on the test Mac, use a physical
standard-density display instead.
