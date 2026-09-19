# Validation Quickstart: Complete Stereo Mixer Panning

Run from repository root. Automated implementation evidence and remaining manual acceptance checks are recorded below.

## Prerequisites

- Existing pnpm dependencies, native Csound/Blue Engine setup, and a stereo output or deterministic float-render path.
- The Spec 112 mono/stereo/mixed clip fixtures and one Java-authored pre-panning project.
- Distinct left-only and right-only stereo signals; a correlated stereo signal; a mixed track with a mono clip and stereo clip; a mono-only track; a send/return and subchannel.
- For physical response measurement, an actual output and loopback-capable device. For native Windows acceptance, a Windows host. Spec 111 still tracks its separate unchecked results.

## Automated checks

```sh
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

Focus model and CSD work in/near `packages/blue-data/src/mixer/channel-pan.test.ts`, `score/score-panning.test.ts`, and `blue-data/mono-clip-panning.test.ts`. Extend the existing app project-contract, history, runtime, and mixer browser suites before widening checks. For package-spanning behavior, the full test/lint commands are required by repository guidance. Browser controls can use `pnpm --filter @blue/app test:browser` with the feature test path once added.

## Scenario A: defaults and project compatibility

1. Open a new score: panning enabled, law −3 dB, boost off. New stereo strips show Balance. Mono-only strips show Mono Pan.
2. Open an enabled Spec 112 score with no new settings: compare original render/automation fixtures at center, intermediate positions, and endpoints. Expect unchanged output within the [audio contract](contracts/audio-panning.md) tolerances.
3. Open a Java/legacy score without `panningEnabled`: expect legacy-disabled routing, unchanged before/after save and reopen. Unsupported law/mode/scalar XML values resolve safely; unrelated content survives.

## Scenario B: pan-law matrix

For each 0/−3/−4.5/−6 dB law, boost off/on, and positions 0/0.25/0.5/0.75/1, render a mono-only source. Measure per-speaker gains against [audio-panning.md](contracts/audio-panning.md) within 0.1 dB for nonzero expected values; verify exact silence at the opposite endpoint. Compare static and automated positions. With boost off, hard endpoints are unity; with boost on, they follow the named gain boost. Confirm the selected law has no effect on default stereo Balance.

## Scenario C: complete stereo modes

1. Render distinct left/right source impulses in Balance at center and endpoints; expect Spec 112 behavior and no crossfeed.
2. Switch to Stereo Pan at Position 0.5, Width 1, boost off: expect original L/R signals unchanged. Set Width 0: both inputs follow Position. Move Position to 0 and 1: both sources reach the chosen side; return to center and confirm saved Width is restored.
3. Switch to Dual Pan: default Left 0/Right 1 passes through. Move only Left, then only Right; verify independence. Cross positions and co-locate both sides; verify actual summed output without automatic normalization.
4. Repeat true-stereo cases with every law/boost choice. On the mixed track, verify the expected rise of the upmixed mono component when folded and no loss of the stereo clip's independent content.
5. Exercise instrument, track, subchannel, and master routes plus pre/post sends and mute/solo. Only the existing post-send pan stage and downstream output should change.

## Scenario D: editing, automation, and recovery

1. Change each Mixer and channel setting. For every action, confirm one semantic history entry, dirty state, undo, redo, save/reopen, stable channel/Parameter IDs and track associations, and matching playback/export results.
2. Drag Position, Width, and both Dual controls during timeline and BlueLive playback. Confirm previews are audible without durable state until commit; cancel restores canonical audio and creates no history entry. Automate the three new scalars and compare live/disk results.
3. Change law/boost/mode during playback. Confirm no score-event retrigger or transport movement on the stable graph. Inject engine rejection and generation replacement: the UI reports saved versus applied state; reconciliation restores the canonical mix. Re-test after toggling `panningEnabled`.
4. In browser tests, operate every control by keyboard and confirm accessible names, selected mode, inactive-state reason, effective-width feedback, and the Mixer Settings gain warning; channel strips have no dedicated true-stereo peak/summing disclosure.

## Evidence to record

Record platform, engine version, output/loopback device (or offline render path), fixture IDs, law/mode values, expected versus measured gains, any render residual, and test/build results. Do not count engine acknowledgments as physical latency measurements. Record unrun native Windows or physical-device checks as outstanding with their missing prerequisites.

### Recorded Evidence (2026-09-18)

- **Platform**: macOS (Darwin arm64)
- **Engine / Offline Render**: Csound / Blue Engine native bindings with deterministic PCM / WAV plateau measurement (`mono-clip-panning.integration.test.ts`).
- **Fixtures Verified**:
  - `packages/blue-data/src/mixer/channel-pan.test.ts`: mathematical parity for 0 dB, -3 dB, -4.5 dB, -6 dB laws, boost flag, Balance, Stereo Pan, Dual Pan.
  - `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`: offline Csound audio renders of synthetic stereo files verifying Stereo Pan and Dual Pan gain matrices across all laws, boost states, endpoints, intermediate positions, independent/crossed/coincident Dual Pan positions, and zero-width Stereo Pan.
  - `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`: CSD generation for all stereo pan modes, automation bindings, subchannels, sends, master.
  - `packages/blue-data/src/blue-data-csd-parity.test.ts`: static, realtime, BlueLive, and disk CSD graph parity for both true-stereo modes and all law/boost choices.
  - `packages/blue-app/src/main/project-history-roundtrip.test.ts`: ProjectHistory commit→undo→redo round-trips for `updateMixerPanLaw`, `updateMixerPanBoost`, and channel `stereoPanMode`/`panWidth`/`dualPanLeft`/`dualPanRight`.
  - `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`: browser component coverage for MixerSettingsDialog and MixerPanSlider with accessible labels, keyboard navigation, effective-width disclosures, and no dedicated true-stereo peak/summing disclosure. The current host could not launch Chrome for this run; Vitest/Playwright exited with SIGABRT before executing tests.
- **Verification Gates**:
  - `pnpm --filter @blue/data test`: 201/201 test files passed, 1 skipped (2,056 passed, 1 skipped)
  - `pnpm --filter @blue/app test`: 493/493 test files passed (5,254 passed, 2 skipped)
  - `pnpm --filter @blue/app test:browser -- src/renderer/browser/mono-clip-panning.browser.test.tsx`: blocked before test execution because the installed Chrome process exited with SIGABRT.
  - `pnpm --filter @blue/app build:main`: Passed (0 errors)
  - `pnpm --filter @blue/app build:renderer`: Passed (0 errors)
  - `pnpm audit:renderer-typography`: Passed (0 findings)
  - `pnpm test`: Passed, including native engine, Java, CLI, data, app, and repository script tests.
  - `pnpm lint`: Passed (renderer typography audit, ESLint, workspace package lint, native/Java lint, and Prettier).
  - `git diff --check`: Passed (0 errors)
- **Unrun Checks**: Physical DAC/loopback measurement (verified via offline PCM plateau analysis); native Windows execution (verified with synthetic path handling and boundary tests; requires Windows CI runner).


### Review correction evidence (2026-09-19)

- Reproduced the channel-name collision and bypass-binding defects before changing implementation: four failing timeline/BlueLive cases. Added asynchronous timeline coverage too; all six regression cases now pass in `runtime-parameter-sync.test.ts`.
- Mode bindings now match the existing Channel runtime identity preserved by render copies and register under the canonical editor owner ID. A subchannel named `1` cannot redirect instrument `1`'s mode edits (or vice versa); master binding remains independent.
- Bypassed mixers now return no panner bindings in synchronous timeline, asynchronous timeline, or BlueLive generation. Law/boost settings remain future intent rather than targeting absent Csound controls.
- Focused runtime registry, reconciliation, and rendered-audio suites: 74 tests passed. Data suite: 2,056 passed, 1 skipped. Data build and app main/renderer builds passed.
- Browser panning suite: 14 tests passed using the same Chrome configuration outside the filesystem sandbox. Chrome still aborts with SIGABRT inside the sandbox. The browser run exposed a missing disabled-input guard; the existing non-interaction regression passes after adding it.
- Off-center boost help now states that center attenuation remains unchanged.
- The project owner accepts discontinuities from discrete pan-law selection changes. The measured centered mono −3 dB → 0 dB transition has a roughly 0.293 sample jump at unit source amplitude; no law-selection ramp is added. This acceptance does not change the gain curves or extend to other rapid control transitions.
- An initial full workspace run passed 492 app files but failed the existing meter timing threshold while other validation jobs were active. The final `pnpm test` run passed without those competing validation jobs: 493 app files, 5,260 app tests passed (2 skipped), plus all other workspace and repository-script tests. The timing test was not weakened. `pnpm lint` passed; the subsequent disabled-input guard also passed targeted ESLint and Prettier checks. `git diff --check` passed.
- Remaining acceptance: moderated composer usability check (SC-006), native Windows execution, and physical DAC/loopback measurements. Offline PCM checks do not substitute for physical measurements. These checks are not marked complete by this review.
