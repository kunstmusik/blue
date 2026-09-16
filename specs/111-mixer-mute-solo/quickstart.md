# Validation Quickstart

This is an implementation validation guide. The feature is implemented; the commands below are
the standing validation set. Run commands from the repository root with existing dependencies
and native build prerequisites installed.

## Implementation status (updated 2026-09-16)

Final implementation review: the feature code and Score Settings UI are ready for review. Manual interaction was reported satisfactory; the dialog's mode explanation and accessible group label were corrected during final review. This is implementation closure, with the physical latency and native Windows acceptance checks still open in `tasks.md`; it is not a claim that those two checks passed.

Final-review checks: the focused Score Settings and Project Information tests passed (7/7), adjacent header and render-settlement tests passed (42/42), the production renderer build, full `pnpm lint`, and `git diff --check` passed.

Score ownership follow-up: `trackLayerMuteSoloMode` is a single Audio/Event value on `Score`, stored as a `<score>` attribute. Missing or unsupported values load as Event and save the resolved mode. The legacy active-channel notice is determined from the incoming XML during load; Score carries no raw-value or presence shadow fields. The repository `pnpm test` run passed after this simplification (`@blue/data` 1943 passed/1 skipped, `@blue/app` 5180 passed/2 skipped, `@blue/engine-client` 47, native engine/Java/CLI/script checks). Both app main and renderer builds, full `pnpm lint`, and `git diff --check` passed. The focused Chrome browser test for track headers and Score Settings passed outside the sandbox (7/7); Chrome exited before test discovery inside the sandbox.

Implemented and covered by automated suites: route policy (`packages/blue-data/src/mixer/mute-solo-policy(.test).ts`),
CSD two-bank gates for realtime/BlueLive and fixed disk gates (`packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`),
staged gate publication (`packages/blue-app/src/main/mixer-mute-solo-runtime(.test).ts` with
`mixer-mute-solo-test-support.ts` doubles), `mixer-gates` runtime operation and canonical gate
intent resolution, boundary/contract regressions
(`packages/blue-app/src/shared/project-editor/mixer-mute-solo-contract.test.ts`), history
commit→undo→redo incl. master-solo whole-patch rejection
(`packages/blue-app/src/main/project-history-mute-solo.test.ts`), strip and header controls
(`packages/blue-app/src/renderer/browser/mixer-mute-solo.browser.test.tsx`,
`packages/blue-app/src/renderer/tests/track-header-mute-solo.test.tsx`,
`packages/blue-app/src/renderer/tests/score-settings-dialog.test.tsx`,
`packages/blue-app/src/renderer/tests/project-properties-mute-solo.test.tsx`), mode persistence
(`packages/blue-data/src/score/score-mute-solo-mode.test.ts`), score-mode generation matrix
(`packages/blue-data/src/score/track/track-layer-group-mute-solo-mode.test.ts`), and
conservative disk pruning with preserved duration
(`packages/blue-data/src/blue-data/csd-disk-pruning.test.ts`).

Machine-verified on 2026-09-16 (darwin arm64, local release engine): repository `pnpm test`
passed (`@blue/data` 1943 passed/1 skipped, `@blue/app` 5180 passed/2 skipped,
`@blue/engine-client` 47, native engine/Java/CLI/script checks), `pnpm lint`, all app
main/preload/renderer builds, and `git diff --check` passed. The full browser suite passed
outside the sandbox (18 files, 106 tests). Runtime outcome failures remain transient toasts;
the Mixer and Score panels do not render a persistent runtime status bar. The broader renderer
`tsconfig` remains an existing cross-rootDir/test-fixture typecheck boundary, while the production
renderer build is clean.

With `BLUE_RUN_REAL_ENGINE=1`, `mixer-mute-solo.integration.test.ts` passed 6/6 and
`global-history-engine.integration.test.ts` passed 12/12. The real-engine evidence includes a
300-gate two-bank staged publication with applied-echo observation inside the 100 ms budget, a
running-performance mute commit→undo→redo gate reconciliation with engine readback (T054),
finite generated-audio captures for both timeline and BlueLive (T088), and five optimized /
unoptimized disk render pairs (T081): shared-return, soloed-return, master-muted/all-pruned,
nonzero-window/nonconstant-tempo/fade/loop/extra-time, and global-duration fallback. Every
float-WAV pair asserts matching format, sample count/duration, and peak residual no greater than
−120 dBFS; the disk scenarios also assert event retention and sync/async CSD parity. There is
deliberately no fallback to quantized output: if the engine cannot produce float WAV the test
fails instead of comparing masked residuals.

The T093 history matrix passes 9 deterministic project-history tests and one real-engine test:
mode and mixer-enable commit→undo→redo preserve independent mixer/event flags, associations,
stable references, dirty state, and published snapshots; active timeline and BlueLive sessions
report restart-required without receiving live writes, and stopped performances receive no runtime
outcome. The native-engine check starts both performance sessions and confirms their control
readbacks remain unchanged; the canonical stopped-performance replay is intentionally checked
without an active engine.

Still required before release: the hardware-playback UI-to-audio latency measurement
(T096, carrying forward T065/T082/T090/T094 — protocol-level publication latency is not a substitute),
and native Windows validation (T097, carrying forward T084/T092/T095). The `blue-x7-pop-song` fixture CSD contains the realtime gate machinery
by design (regenerate with `BLUE_X7_REGEN_FIXTURE=1`).

Measurement attempt on 2026-09-16 (darwin arm64) was blocked before playback: macOS reported
no audio devices and the staged engine reported `audioOutputs: []`. No latency value was
recorded; protocol timing and null-audio playback do not satisfy T065. Repeat the reference
measurement on a machine with a real output (and preferably a loopback input). Native Windows
tests and native-path real-engine evidence were not available on this host; those tasks remain
explicitly open rather than being inferred from the darwin arm64 runs.

The convergence-focused data pruning suite passed 21/21, the scheduling/determinism suites
passed 25/25, and the two focused browser suites passed 14/14 with trusted keyboard and pointer
interaction. The finite live capture uses the null realtime backend only to pace a real generated
engine session without a physical device; it is audio/history evidence, not hardware-latency
evidence. Its nine observed gate transitions alternate banks atomically, cover source/return
solos, mute-wins, master restoration, a stateful tail, transport continuity, and the >256-entry
batch boundary for both performance kinds.

Follow-up regression closure on 2026-09-16: the generation-settlement, native-menu, track-header,
and mixer-strip changes pass the focused and full app suites. A browser-suite rerun in this
environment failed while launching Chrome (`Target page, context or browser has been closed`)
before test discovery; no browser assertions were executed by that attempt.

## Score settings UI

Open the Score panel's gear button at the far right of the toolbar, immediately beside Ruler, to
open Score Settings. The modal contains the Audio/Event track-header M/S behavior selector,
saved-versus-effective explanation, mixer-disabled override, and legacy compatibility notice when
applicable. Project Information contains only project metadata and notes; it does not contain the
track-header behavior selector.

## Package validation

```sh
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/engine-client test
pnpm --filter @blue/data build
pnpm --filter @blue/engine-client build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm --filter @blue/app test:browser
pnpm test
pnpm lint
git diff --check
```

Start with focused new tests before full suites. Planned locations: data mixer/mute-solo-policy.test.ts and existing CSD/XML suites; main mixer-mute-solo-runtime.test.ts, project-runtime-reconciliation.test.ts and global-history-engine.integration.test.ts; browser tests alongside mixer-metering.browser.test.tsx. These commands execute acceptance tests after implementation, not before those tests exist.

## Engine and UI setup

```sh
pnpm --filter @blue/app engine:prepare
pnpm --filter @blue/app dev
```

Use built engine discovery or set BLUE_ENGINE_PATH to its actual executable. Missing engine is skipped validation, never a passing audio check. Host fixtures use path.join/os.tmpdir and existing embedded Csound path conversion. Include native Windows validation before cross-platform delivery.

Latency reference: 44.1 kHz, ksmps 64, 256-frame device buffer, local engine, 32 sources/four subchannels/64 sends, generated tones and no external scripts. Record machine, device and versions. Capture output and command timestamps on a common monotonic timeline; measure 100 transitions after warmup, each settling within 100 ms without transport jumps or retriggered events. Include UI-to-audio timing, not merely engine acknowledgment. Repeat above 256 route controls for staged publication; report timing and confirm no intermediate route combination becomes audible.

## Audio scenarios

1. A=440 Hz, B=660 Hz, both direct to master and through return R; exercise pre/post sends. Solo A keeps its dry/wet contributions; Solo R preserves wet feeds and removes dry bypasses. Multiple solos produce the permitted union. The real-engine route matrix records shared-return, soloed-return, and all-pruned float equivalence; the route-policy suite covers multiple solos and mute-wins.
2. Mute soloed A: A silent, B still excluded. Mute/unmute master: silence then same selection. Load legacy master solo=true: inert, preserved in XML, no Solo control. Reject master-solo patch without a history entry.
3. Stateful delay on A/R: mute A cuts its output/sends after ramp; R's prior tail decays. Mute R cuts its local output. Unmute a sustained note without retriggering.
4. Shared upstream X demonstrates summed-signal limits; no promise of source reconstruction after mixing.
5. Repeat on timeline and BlueLive, including simultaneous sessions. Inject missing capability, queue-full, failed staging, uncertain commit acknowledgment, delayed applied token and stale generation. Verify no partial publication/false applied status and latest canonical recovery.

## Compatibility and history

New project uses Audio; legacy Java audio-layer fixture uses Event. A missing score or missing/unsupported `trackLayerMuteSoloMode` attribute loads Event, and the next save writes Event. Mode persists only as a score attribute, not a child or ProjectProperties field. No migration or fallback supports the prerelease locations. Java ignores the attribute on load and drops it on save. Verify unrelated unknown-data preservation and copy behavior. Audio header and strip share channel state; Event header retains independent event state. Bypass forces Event and disables strips; re-enable restores saved mode/state. Mode switching never copies flags.

An ordinary score-layer solo must not event-filter Audio-mode Tracks; Event mode restores original score-wide behavior. Rename/reorder preserves association. Race header action with mode switch and reject stale domain selection.

Commit→undo→redo every affected action through ProjectHistory: compare flags, mode, identities/references, associations, dirty state, published snapshots and both runtime outcomes. Failed runtime update must not silently roll back canonical edits.

## Disk comparisons

Generate optimized/unoptimized pairs for certified AudioClip-only fixtures: muted longest clip, muted master/all-pruned, nonzero render window, nonconstant tempo mapping, pre/post sends, soloed returns, surviving fades/loops, and extra render time. Render float audio under identical settings. Sample counts must match exactly; peak residual must be at most −120 dBFS. Eligible inaudible playback events are absent; soloed-return feeders remain. Pruning the longest clip must not shorten export. Sync/async CSD paths retain exact surviving event payloads and scheduling markers.

Mixed objects, custom global code, opaque FX, processors, unresolved routes and cycles are fallback fixtures: no unsafe pruning. Verify sync/async parity and absence of disk pruning in realtime. Before/after successful and failed export, project serialization, dirty state and history stay unchanged.

Offline sample tests prove isolation/equivalence; hardware playback proves end-to-end latency. Neither replaces the other. Detailed contracts are in [contracts/mixer-mute-solo.md](contracts/mixer-mute-solo.md).
