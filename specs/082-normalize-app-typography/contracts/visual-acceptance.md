# Contract: Typography Visual Acceptance

## Purpose

Verify computed typography, contrast, geometry, display-density behavior, and
zoom usability that the static audit cannot prove. This is a deterministic
manual contract, not a requirement to automate every application window.

## Test Build and Baseline

- Use one implementation-candidate build for all cases in a run.
- Set application zoom to Actual Size (100%) before each density matrix.
- Reset or record any program setting that changes the visible fixture.
- Record commit, build identifier, macOS version, machine/display, Electron
  version, theme, and tester.
- Use stable repository example projects where named. Use a synthetic renderer
  fixture for populated SoundFont coverage rather than committing an unlicensed
  SoundFont binary.
- Native application/context menus MUST use standard Electron/system rendering;
  record that no custom sub-floor menu HTML is involved. CSS metric sampling does
  not apply to system-owned native menu rendering.

## Density Profiles

Execute every V01–V10 case at 100% zoom under both profiles:

| ID | Required environment | Validity check |
|---|---|---|
| D1 Retina | Native macOS Retina/high-density display | Record `window.devicePixelRatio >= 2` |
| D2 Standard | Physical standard-density display or verified DPR-1 Electron emulation | Record `window.devicePixelRatio === 1` |

An emulated D2 run is invalid if the application still reports DPR above 1. In
that case, repeat on a physical standard-density display. The CSS role metrics
remain identical between profiles; rasterization and geometry are the variables
under observation.

## Required Sample Record

Each visual case records:

| Field | Required evidence |
|---|---|
| Environment | Density ID, reported DPR, application zoom, theme, window dimensions |
| Fixture/state | Exact project, panel state, selected item, and long/empty/error content used |
| Typography | Expected role plus computed `font-size`, `line-height`, family, and weight for each named sample |
| Contrast | Foreground, rendered background, calculated ratio, and UI state for every named enabled sample |
| Geometry | No clipping, overlap, baseline collision, or lost essential label; record intended wrap/scroll/ellipsis/omission |
| Interaction | Accessible name for icon/glyph controls and required essential action when specified |
| Evidence | Screenshot reference and concise observation |
| Result | Pass/fail, defect reference, correction, and rerun result |

At minimum, every row samples its ordinary Body text, smallest Subheadline or
Callout text, highest heading role, and monospaced text when present. A sample
passes only when computed size and line height exactly equal the selected role.

Enabled information-bearing text must be at least 4.5:1 against its rendered
background. Disabled/inactive states must remain distinguishable without using
size reduction or color/opacity as the sole state cue. Small secondary text must
not rely on opacity below 50%.

## 100% Visual Matrix

| ID | Fixture/state | Window size(s) | Required checks |
|---|---|---:|---|
| V01 | Welcome, main toolbar, native/context menus, loading and error states | 1200×800 | Application identity/title/body hierarchy, Body fallback, menu/shortcut hierarchy, warning glyph accessibility |
| V02 | Core workbench using `examples/features/mixer.blue` | 1200×800 and 900×700; Dockview popout 640×480 | Dockview tabs/rails, score ruler, toolbar, inspector, code/output, popout Body baseline, long names |
| V03 | `examples/soundObjects/pianoRoll.blue` and `examples/soundObjects/tracker.blue` | 900×700 | Smallest supported piano row, pitch-label frequency/centering, time ruler, field ranges, tracker cells; omit nonessential labels rather than shrink |
| V04 | `examples/features/automation1.blue` and `objectBuilder2.blue` | 900×700 | Automation/line SVG axes and values, JMask/table drawn text, pattern/timeline density and baselines |
| V05 | Mixer channel strips in populated and constrained layouts | 1200×800 and constrained width | Channel names, chain entries, sends, meter/value labels, output selectors, vertical capacity, intentional truncation |
| V06 | BSB using `objectBuilder.blue` and `objectBuilder2.blue` | Main and narrow inspector | Application toolbar/property/dialog roles; authored fonts remain exact even below 11; boundary is visually distinguishable without coercion |
| V07 | BlueX7 using `examples/pieces/daveSeidel/02_timewaveCanon/TimewaveCanon.blue` | Track editor 1000×760 and orchestra pane 360 px wide | Envelope/stage labels, rate/level grid, operator/algorithm controls, SysEx dialog, Csound preview; reflow/scroll without overlap |
| V08 | Blue Live, SoundFont viewer, Libraries, File Manager, Audio Player, Virtual Keyboard | 1200×800 | Empty/populated tables and lists, metadata, helper text, dense annotations, long values, keyboard labels |
| V09 | Settings, About, Effect Editor, Effect Interface, Track Instrument Editor | 800×600, 520×460, 1100×820, 460×560, 1000×760 | Every renderer window's Body baseline and title hierarchy; long path/value behavior; focus and keyboard use unchanged |
| V10 | Dialogs, tooltips, toasts, warnings/recovery, disabled/selected/hover states | Owning-window size | Exact role metrics, 4.5:1 enabled contrast, state not conveyed by low contrast alone, accessible icon/glyph controls |

Every V01–V10 row MUST pass under both D1 and D2. A density-specific failure is a
feature failure even if the other profile passes.

### Role coverage ledger

Across each density run, record at least one exact computed sample for every role:

| Role | Required representative sample |
|---|---|
| Large Title | Welcome or About application identity |
| Title 2 | Settings/dialog/major panel title |
| Title 3 | Section title or prominent inspector/BlueX7 group |
| Headline | Compact group or column heading, including bold weight |
| Body | Ordinary form/control and code/output content, including inherited fallback |
| Callout | Helper, shortcut, badge, or compact secondary control |
| Subheadline | Dense ruler, mixer, graph, piano-roll, or SVG/Canvas annotation |

The ledger supplements per-row sampling; no role can be declared correct solely
because its source token has the expected number.

## Zoom Matrix

Execute once on macOS at 50%, 100%, 200%, and 300% for each surface:

| Surface | Essential action | Required result |
|---|---|---|
| Main workbench | Open/switch a panel and reach the View zoom commands | Controls remain reachable; text follows whole-interface scaling |
| Settings | Edit and cancel or save one setting | Fields/actions remain reachable; no irreversible hidden content |
| Application-owned editor | Edit one value and close safely | Essential labels/actions remain available; scrolling is allowed |

At 300%, scrolling/reflow is acceptable; shrinking below the catalog is not. At
50%, the smaller physical appearance is an intentional result of whole-app zoom
and does not redefine the 100% 11-logical-pixel floor.

## Project-Authored Preservation Matrix

Automated round-trip coverage is primary, with V06 providing rendered boundary
confirmation. Required values include:

- dropdown font sizes 8, 12, and 36;
- font-object sizes 1, 12, and 200;
- imported/legacy Swing HTML font sizing;
- unrelated and unknown XML preservation; and
- semantic-role compliance for surrounding BSB application chrome.

Any changed authored value or unrelated project data is a blocking failure.

## Geometry-Specific Rules

- Fixed-height rows accommodate the role line box and focus/selection treatment.
- Canvas/SVG labels use resolved role metrics and align without clipping.
- Piano-roll rows below label height reduce nonessential label frequency; they do
  not render smaller labels.
- Text glyph controls replaced by icons retain accessible names and target
  behavior.
- Intentional ellipsis retains the existing way to access the full value.
- Long/localized-length labels and paths wrap, scroll, or truncate intentionally;
  they are never made smaller to fit.
- Focus, keyboard, selection, editing, save/reopen, and window behavior remain
  unchanged except for necessary layout adaptation.

## Execution Record and Completion

The implementation MUST update the execution record in `quickstart.md` with one
row per density/case combination plus the zoom and project-preservation results.
Each failure links to its correction and rerun. Screenshot files may live in the
normal task/PR evidence location rather than the repository, but the record MUST
identify them unambiguously.

Visual acceptance is complete only when:

- all 20 D1/D2 visual rows pass;
- every sampled computed metric matches its role;
- all named enabled contrast samples meet 4.5:1;
- all zoom actions pass at four levels;
- all authored-font round trips pass; and
- no unresolved typography-related clipping, overlap, lost label, focus, or
  interaction regression remains.

Windows/Linux visual spot checks are required only when static/focused tests or a
reviewer identify a platform-specific geometry risk; record those conditional
checks with the same evidence fields.
