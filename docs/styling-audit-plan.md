# Styling consistency audit and cleanup

Date: 2026-10-27; completed 2026-10-28

## Scope and baseline

Reviewed repository-owned renderer CSS, TS/TSX utility classes and inline styles,
HTML entry points, SVG assets, canvas/editor styling, shared controls, dialogs,
and manual SCSS. Generated output, dependencies, and project-authored example
content are not cleanup inputs. The original renderer inventory contained 425
production TS/TSX/HTML files and one 1,750-line stylesheet. A later text search
found 263 `style={` occurrences in 91 non-test renderer files and 206 lines with
standard gray/slate/zinc/neutral/stone utilities; these are inventory counts, not
automatic defect counts. The manual has one small offline-font SCSS file.

Authorities are `packages/blue-app/AGENTS.md`, `docs/typography.md`,
`docs/color-accessibility.md`, and the theme exception registry. The audit keeps
project-authored BSB fonts/colors, popup ownership, and signal/syntax palettes.

## Findings and changes

1. The baseline theme audit reported three undefined `app-accent-contrast` uses,
   five raw CSS colors, and 22 inline meter color occurrences. BlueShare now uses
   the existing accent foreground role; CSS uses equivalent existing tokens. Four
   named meter color fragments retain the original values and stop positions, with
   narrowly scoped `signal-palette` exceptions for canvas signal levels. A profile
   test verifies every original stop and fraction.
2. An expanded contrast search found 30 direct opaque accent/light foreground
   combinations, including eight JMask hover states. Welcome actions, BlueShare,
   BlueX7 active controls, error recovery, library and editor actions, mixer/score
   dialogs, and BSB property-sheet chrome now use the existing accent foreground.
   White on the accent was 2.73:1; the intended foreground is 6.96:1. Six proven
   low-contrast gray-500 cases—four empty-workbench messages, a BlueX7 placeholder,
   and a Poly Object layer label—now use the muted text token. On the app background,
   the browser measured 3.53:1 before and 7.11:1 after. A narrow audit check and test
   now catch directly paired unsafe accent/text utilities in static class strings.
3. Toolbar and editor menus now share equivalent geometry, highlight, disabled,
   open, and separator declarations within their existing CSS layer. Their background,
   width, scrolling, and cursor differences remain. Equivalent toolbar display and
   output hover declarations were grouped without changing selector specificity.
   Confirmed unused toolbar shortcut, mixer select, and empty-chain CSS was removed;
   the browser focus fixture now exercises the real mixer output select. Dynamic
   workbench and flashing classes remain; both flash animations are needed to restart
   successive pulses.
4. The typography audit originally passed despite ten undefined
   `text-role-caption` uses. Explanatory text now uses Callout and the dense mixer
   annotation uses Subheadline. The audit now rejects unknown role utilities, with
   a focused regression test. The three mixer Headline declarations now use the
   documented bold weight. Settings imports bundled Roboto weights, and `--font-app`
   shares the proportional font stack with Dockview and the inline BlueX7 diagram.
5. The 22 identical input class strings belong to three BlueX7 panels, not Settings;
   they now share a small local constant and existing input/select primitives.
   Settings already owns shared field classes. Dialog backdrop differences (50%
   versus 60% black) remain visual choices rather than assumed equivalents.
6. The eight legacy `blue-*` color aliases resolve to canonical tokens. Their 1,007
   baseline utility occurrences are compatibility debt, not 1,007 visual defects;
   a repository-wide spelling migration would add noise without changing appearance.

## Boundaries and remaining decisions

- HTML background literals prevent an unstyled early flash; the Dockview popout also
  has an independent no-bootstrap fallback. The manual uses system fonts and avoids
  remote font loading. These have separate ownership from app styling.
- Runtime coordinates, widths, animation timing, canvas rendering, CodeMirror syntax,
  BSB project-authored data, and signal-level colors are not generic app chrome.
  The 32 standalone BlueX7 SVGs do not inherit app CSS and retain their own font and
  palette fallbacks; the inline diagram uses the app font token.
- Existing Subheadline 700-weight uses in workbench rails, score-bar labels, the mixer
  send glyph, and BlueX7 diagram digits conflict with the typography guide's allowed
  Regular/Semibold emphasis. Decide their intended visual hierarchy and SVG geometry
  together before changing them; the present typography audit does not check every
  CSS or SVG weight. A passing audit is not a claim of exhaustive compliance.
- The theme audit's direct accent-pair check works on a single static class string;
  it cannot infer every dynamically composed class, inherited foreground, canvas/SVG
  color, or translucent background. Remaining default-color utilities and the 50%/60%
  backdrop treatments require context-specific review, not blanket substitution.

## Execution and verification

- [x] Review styling inventory and record ownership boundaries and remaining issues.
- [x] Fix known theme aliases, equivalent literals, meter duplication, and confirmed
      foreground contrast failures.
- [x] Consolidate equivalent CSS without moving selectors across layers; remove only
      confirmed unused rules; correct identified typography and shared form styling.
- [x] Run renderer theme and typography audits: both pass with zero unapproved
      findings. The theme report records 35 approved occurrences, including the four
      meter palette values. Audit engine tests pass: 34 tests.
- [x] Run `pnpm --filter @blue/app test`: 532 files, 5,801 tests passed, 3 skipped
      after the contrast edits. `pnpm --filter @blue/app build:renderer` typechecked
      and built the renderer.
- [x] Run `pnpm test` and `pnpm lint`: both passed before the final bounded contrast
      changes. The initial sandboxed `pnpm test` could not create POSIX shared memory;
      the full run passed outside the sandbox. The app suite and audits were rerun
      afterward; final renderer build and lint were rerun for the completed diff.
- [x] Run focused Chrome browser tests: 15 passed. A comparison of fully compiled
      before/after CSS matched 35 fixture elements across 30 computed properties and
      four default/hover snapshots, including utility-layer overrides. Representative
      accent hover ratios were 5.57:1, 4.99:1 for an 80% fill over the app background,
      and 5.87:1 for 90% control opacity. The JMask hover pair measured 6.96:1.
- [x] Review the final diff and run `git diff --check`.

## Constitution and provenance check

This is presentation cleanup within the existing GPL-3.0-or-later application and
repository documentation scope. `LICENSING.md`, `LICENSE`, package metadata, and
application notices were reviewed before edits. Changes use original code or
reorganization of existing same-scope code; there are no new dependencies, assets,
or third-party source. Portable data, serialization, project history, host runtime,
and path contracts are unchanged. No Java behavior or serialization parity change
is intended. Verification is proportional to shared CSS cascade risk. This cleanup
introduces no material feature or new persisted state.

## Add Instrument popup follow-up (2026-10-28)

The Add Instrument host surface used automatic width with full-width inline
buttons, which expanded its intrinsic width beyond the longest label. The menu
now uses `w-max` and a vertical flex layout so it fits the longest item while
retaining the 180px minimum. Java Blue's `ArrangementEditPanel.AddInstrumentPopup`
also packs its menu to the items; no Java source was copied.

A real-component Chrome regression reproduced the original width at 628px and
passes with the fix at 180px. It verifies all five items and instrument selection.
The browser harness now compiles Tailwind and prebundles the table dependency
with React, so layout checks exercise actual utilities without duplicate hooks.
All 16 focused menu, focus and contrast browser tests, three popout lifecycle
follow-up tests, renderer typecheck, and whitespace checks pass.
