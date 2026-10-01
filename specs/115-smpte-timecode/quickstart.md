# Validation Quickstart: Standards-Based SMPTE Timecode

**Spec**: [spec.md](spec.md) | **Expected values**: [public-calculation-basis.md](public-calculation-basis.md)

Implementation is complete and final convergence passed on 2026-10-01. This guide records the validation commands, evidence, and remaining validation exceptions. Run commands from the repository root with the existing pnpm workspace installed; no external timecode library is required.

## Focused automated validation

Start at the conversion owner and integration boundaries:

```sh
pnpm --filter @blue/data test smpte-timecode
pnpm --filter @blue/data test tempo-map
pnpm --filter @blue/data test time-context blue-data-root-compatibility blue-data-history-copy
pnpm --filter @blue/app test time-unit-logic toolbar-formatters score-ruler-parity score-object-editor-contract
pnpm --filter @blue/app test program-settings program-settings-application ruler-config-update panel-dialog-dismissal
pnpm --filter @blue/app test project-history-roundtrip
```

Include `pnpm --filter @blue/data test time-state` for the dedicated TimeState persistence owner. Keep fixed counting vectors primarily in the converter suite. Boundary integration tests should detect lost mode, inconsistent owners, or full-tempo-map errors rather than replay all converter cases at each component.

Check exact starts and meaningful before/after offsets outside the documented numerical-equivalence band. Include a 120→120.000001 BPM ramp over 1000 beats to protect the existing inverse's algebraic stabilization, as well as the usual constant/ramped tempo cases. Check all eight rates and ten combinations, final valid labels, tenth-minute skips, long durations, supported numeric-domain bounds, and malformed input.

## Project and UI validation

1. Open a project with 60 BPM and numeric 29.97, no explicit mode. Verify NDF across ruler, transport, markers, and score-object editors. At 60 elapsed seconds expect `00:00:59:28`; entering `00:01:00:00` locates 60.060 seconds.
2. Select 29.97 DF. Verify the boundary examples from Public Calculation Basis, rejection of `00:01:00;00`/`;01`, and acceptance of `00:10:00;00`. Repeat 59.94 DF with its four omitted labels.
3. Record existing object/marker positions and durations, switch modes, undo, and redo. Values/identities remain unchanged; format and dirty state follow history. Cancel/no-op creates no history entry.
4. Save/reopen a DF project. Inspect TimeState mode persistence and unknown child/attribute retention. Legacy numeric projects remain NDF; `30df` recovery remains 30/NDF without inferring 29.97.
5. Repeat with a tempo change before the edited position. Confirm entry and frame snap locate actual elapsed frame starts, including marker, automation, ruler selection, and score canvases. Confirm the visible grid aligns with snapped positions.
6. Verify project format propagation to the piano-roll SMPTE ruler while preserving local-zero behavior. Audio sample-frame units continue using sample rate.
7. During playback, switch/undo format. Display follows the same current playback time; engine speed/sample rate and canonical timing stay unchanged.
8. Save app-wide DF defaults, create a project, and verify the selected valid pair. Open an older project and verify it keeps its saved/defaulted format rather than receiving app defaults. Selecting an NDF-only format such as `24 fps` sets NDF in the same change.
9. Check 24-hour-plus labels do not wrap, mode-mismatched punctuation is rejected, and validation does not leave optimistic snapshots inconsistent.

## Required implementation handoff checks

```sh
pnpm --filter @blue/data build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm exec tsc -p packages/blue-app/tsconfig.renderer.json --noEmit
pnpm test
pnpm lint
git diff --check
```

Use the repository's normal desktop/browser smoke workflow on affected UI surfaces and supported platforms. No path-sensitive OS behavior is added by this feature.

## Provenance and documentation review

Confirm source comments/review cite public rule versions/sections and this derivation. Check no GPL/LGPL conversion source was translated into MIT data code, no new dependency is present, and copied third-party material (if separately approved) carries its license/notice/source record. Verify manual/release notes describe the corrected NDF/DF contract and M18's historical label-only repair accurately.

## Implementation verification record — 2026-09-30

The implementation uses original arithmetic and existing workspace dependencies. All 47 implementation/verification tasks are accounted for below. Desktop checks used Playwright against an isolated Electron instance, a disposable `.blue` project and temporary preferences; the existing user project/profile were not edited.

| Check | Result and evidence |
| --- | --- |
| Legacy numeric NDF, rate/mode selection, cancellation | Native macOS Electron passed: 29.97 with absent mode opens as NDF; explicit DF changes the displayed punctuation and canonical score/transport pair; choosing 24 visibly disables DF and cancel retains 29.97/DF. |
| Save/reopen and timing | Native Electron passed: DF survives save/reopen and the XML contains the true-only mode child. Marker time and render-start time remain unchanged. Unknown XML and legacy `29.97df`/`30df` recovery additionally pass the data load/copy suites. |
| History and active playback | Native engine playback of a silent temporary instrument remained `playing` through format commit, native-menu undo and redo. Canonical mode follows history. The toolbar component regression also verifies the exact same clock/anchor objects and elapsed time survive DF→NDF→DF publication. Canonical history tests cover stable object/layer/marker identities, durations, dirty state and no-op history. |
| Tempo changes and physical snapping | Focused integration tests verify preceding 60→120 BPM changes in entry, score/marker snapping, automation and tempo utilities; DF/NDF share the grid. A separate shallow-ramp regression protects exact-frame inversion. |
| Piano-roll origin and sample distinction | The rendered piano-roll component starts at local zero with project DF labels and full tempo context; score-object and time-unit boundary tests verify sample frames retain sample-rate arithmetic. |
| App defaults and existing projects | Settings migration, valid-pair selection and new-project application tests pass; opening a saved project retains canonical project settings. Ruler controls are exercised in actual desktop UI and popout-document component tests. |
| Extended hours and invalid input | Converter/time-entry tests cover 25-hour labels, maximum physical frames for all ten supported combinations, strict punctuation and skipped DF labels. Field tests retain invalid drafts without commits; unchanged subframe editor/tempo text retains exact canonical values. |
| Snapshot consistency | Canonical snapshots and optimistic score/transport publication tests pass with one pair; normal canonical refresh handles rollback. |

Native desktop checks cover the workflow above; the other rows use the existing focused component/integration suites rather than claiming every surface was manually exercised in a native window. No platform/path-sensitive behavior was introduced.

**Smoke limitation:** after successful live format undo/redo, explicitly stopping the native engine reported an engine-stop timeout/diagnostic. The format checks and subsequent save/reopen passed; this run does not certify native stop reliability.

**Builds and checks:** `@blue/data` build, main/preload TypeScript builds and renderer production build pass. Focused suites and the final full `pnpm test` (499 app files / 5,313 tests; 203 data files / 2,105 tests, plus the remaining workspace suites), `pnpm lint`, and `git diff --check` pass. Renderer `tsc --noEmit` remains blocked by repository-wide pre-existing diagnostics: an untouched HEAD source checkout and the feature both produce 1,557 diagnostics, with no added file/error-code counts. Its command was run and its limitation is recorded rather than reported as a clean type check.

No new dependency, engine protocol change, test-only production export, or source adaptation was introduced. Existing snapshot/ruler testing seams were reused. `program-settings-defaults.ts` contains only UDO/effect preference helpers and needs no SMPTE logic; score-object properties already receives the canonical conversion context.


## Convergence verification — 2026-10-01

T048 and T049 add two one-line production repairs: ScorePanel forwards canonical DF mode into the tempo-map dialog, and the track canvas refreshes its snap callback when the complete tempo context changes. The rendered caller regressions failed before the respective repairs and pass afterward. The dialog test loads DF mode from a real XML round trip, displays/accepts `00:01:00;02`, and rejects NDF punctuation and skipped labels without submitting a durable patch. Existing canonical history tests retain format on commit/undo/redo. The track test preserves meter identity, initial tempo, rate, zoom and snap settings while changing only the later tempo point; rendered drag nearest-snaps beat 90.13 to 90.12 and insertion floor-snaps beat 94.13 to 94.124. No new dependency or production testing seam was added.

The focused caller/gesture/history run passes 178 tests in three files. This brings the task list to 49 completed tasks. Both repairs are original code within the existing GPL application scope; no third-party material was incorporated.

Convergence handoff checks: full `pnpm test` passes (499 app files / 5,315 tests; 203 data files / 2,105 tests; remaining workspace checks pass). The final caller/gesture rerun passes 32 tests. `pnpm lint`, main/preload builds, renderer production build and `git diff --check` pass. Renderer no-emit checking still reports the same 1,557 baseline diagnostics with no additional file/error-code counts.

## Combined format selector — 2026-10-01

Ruler Configuration and Project Defaults now use the same ten-option SMPTE Format list. Only 29.97 and 59.94 have explicit (DF)/(NDF) choices. Selecting an ordinary fps option sets NDF; numeric rate/Boolean mode persistence and atomic history patches remain unchanged. Updated popout-dialog tests exercise both modes at both fractional rates and selection of 24 fps, while the SettingsApp test saves 59.94/DF as a valid default pair. The initial rendered regressions failed against the separate controls; the focused run now passes 215 tests in nine files.

Combined-selector handoff checks: full `pnpm test` passes (499 app files / 5,320 tests, plus remaining workspace checks). `pnpm lint`, main/preload compilation, renderer production build and whitespace checks pass. Renderer no-emit checking retains the same 1,557 baseline diagnostics with no additional file/error-code counts.

## Playhead SMPTE submenu — 2026-10-01

Primary and Secondary playhead menus each expose the shared ten-format SMPTE submenu and check the canonical project pair only when the readout is explicitly set to SMPTE. Selection switches only that readout to SMPTE and submits the project pair with the Change SMPTE Format history label. The rendered test navigates the actual nested menus in both channels, verifies DF labels and the submitted atomic pair/label, and verifies that clicking the current project format still switches the readout. The original menu tests failed before the implementation; the focused toolbar/history run passes 155 tests. Existing history and live-clock tests remain the primary proof for canonical undo/redo and clock preservation. Sync to Ruler and Secondary Off remain available.

Playhead submenu handoff checks: the focused toolbar/history run passes 155 tests. Full `pnpm test` passes all functional tests but misses the existing metering latency threshold by about 6 ms; the isolated metering rerun passes all three tests. Lint, whitespace checks, main/preload compilation and renderer production build pass. Renderer no-emit checking retains the same 1,557 baseline diagnostics with no additional file/error-code counts.

## Final convergence and closure — 2026-10-01

**Outcome:** converged. All 51 tasks are complete. The current implementation was assessed against 17 functional requirements, seven success criteria, 24 acceptance scenarios and their edge cases, 13 buildable plan decisions, and six constitution core principles plus applicable boundary/validation constraints. Findings by gap type (missing/partial/contradicts/unrequested) and severity are all zero. No convergence tasks were appended; `tasks.md` remains byte-for-byte unchanged. No before/after convergence hooks are registered.

The plan decisions checked cover portable/static dependencies; original constant-time rational conversion; numerical domain and equivalence band; stable tempo inversion; canonical TimeState/snapshots; XML and legacy recovery; unknown XML cloning; atomic patch/history/publication; shared format selectors and submenus; separate defaults/new-project seeding; display/entry and piano-roll/sample conventions; complete-tempo physical snapping and integer grids; and independent verification/provenance/documentation.

| Closure check | Result |
| --- | --- |
| Focused app boundaries | 554 tests in 18 files pass, covering display/entry, snapshots, persistence/defaults, dialogs, history, and score callers. |
| Focused data owners | 131 tests in six files pass, covering conversion, TimeState, tempo inversion, project XML, and history copies. |
| Public fixed examples | All 39 label examples in the three calculation-basis tables pass against the converter; physical-frame rows also parse back to their independently calculated frame-start seconds. The cited SMPTE ST 12-1:2014 counting sections were rechecked. |
| Full workspace tests | Final `pnpm test` passes: app 499 files / 5,323 tests (two skipped); data 203 files / 2,105 tests (one file/test skipped); remaining workspace and 59 script tests pass. |
| Lint and builds | `pnpm lint`, data build, main/preload compilation, and renderer production build pass. |
| Whitespace | Working-tree and staged `git diff --check` pass. |
| Renderer no-emit | After the data build completes, `tsc --noEmit` reports the documented 1,557 diagnostics. This remains an existing scoped validation exception, not a clean type check. |

The first full test run, concurrent with builds, timed out in the unrelated BlueX7 duplicate-name multi-host test at its 5-second limit. All six BlueX7 host tests pass in isolation, and a second full workspace run without competing builds passes. No source/test change or timeout adjustment was made. An initial renderer check overlapped the data build's deletion/recreation of declarations and reported missing-module errors; the completed-build rerun is the authoritative 1,557-diagnostic result above.

This closure relies on the native desktop evidence already recorded above; it does not claim a new native smoke run or resolution of the earlier engine-stop timeout. The owner-directed save-preservation audit remains a separate next-spec follow-up. No further `$speckit-implement` pass is needed for this feature; proceed to review/PR with these validation limits visible.
