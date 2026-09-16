# Validation Quickstart

This is an implementation validation guide. The feature is implemented; the commands below are
the standing validation set. Run commands from the repository root with existing dependencies
and native build prerequisites installed.

## Implementation status (updated 2026-09-15)

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
`packages/blue-app/src/renderer/tests/project-properties-mute-solo.test.tsx`), mode persistence
(`packages/blue-data/src/project-properties.test.ts`), score-mode generation matrix
(`packages/blue-data/src/score/track/track-layer-group-mute-solo-mode.test.ts`), and
conservative disk pruning with preserved duration
(`packages/blue-data/src/blue-data/csd-disk-pruning.test.ts`).

Machine-verified on 2026-09-15 (darwin arm64, local release engine): all package suites
(`@blue/data` 1927, `@blue/app` 5134, `@blue/engine-client` 47), the full browser suite, and
`global-history-engine.integration.test.ts` with `BLUE_RUN_REAL_ENGINE=1` — including a
300-gate two-bank staged publication (2 batches at the 256-entry bound) with applied-echo
observation completing inside the 100 ms budget. Still required before release: the
hardware-playback UI-to-audio latency measurement (the protocol-level publication latency is
not a substitute), and the deterministic optimized/unoptimized float-render comparisons
(T045) plus the manual stopped/running history matrices (T037/T054). The `blue-x7-pop-song`
fixture CSD now contains the realtime gate machinery by design (regenerate with
`BLUE_X7_REGEN_FIXTURE=1`).

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

1. A=440 Hz, B=660 Hz, both direct to master and through return R; exercise pre/post sends. Solo A keeps its dry/wet contributions; Solo R preserves wet feeds and removes dry bypasses. Multiple solos produce the permitted union.
2. Mute soloed A: A silent, B still excluded. Mute/unmute master: silence then same selection. Load legacy master solo=true: inert, preserved in XML, no Solo control. Reject master-solo patch without a history entry.
3. Stateful delay on A/R: mute A cuts its output/sends after ramp; R's prior tail decays. Mute R cuts its local output. Unmute a sustained note without retriggering.
4. Shared upstream X demonstrates summed-signal limits; no promise of source reconstruction after mixing.
5. Repeat on timeline and BlueLive, including simultaneous sessions. Inject missing capability, queue-full, failed staging, uncertain commit acknowledgment, delayed applied token and stale generation. Verify no partial publication/false applied status and latest canonical recovery.

## Compatibility and history

New project uses Audio; legacy Java audio-layer fixture uses Event. Missing projectProperties and unsupported raw mode load Event. Verify diagnostics, raw/unknown-data preservation and copy behavior. Audio header and strip share channel state; Event header retains independent event state. Bypass forces Event and disables strips; re-enable restores saved mode/state. Mode switching never copies flags.

An ordinary score-layer solo must not event-filter Audio-mode Tracks; Event mode restores original score-wide behavior. Rename/reorder preserves association. Race header action with mode switch and reject stale domain selection.

Commit→undo→redo every affected action through ProjectHistory: compare flags, mode, identities/references, associations, dirty state, published snapshots and both runtime outcomes. Failed runtime update must not silently roll back canonical edits.

## Disk comparisons

Generate optimized/unoptimized pairs for certified AudioClip-only fixtures: muted longest clip, muted master/all-pruned, nonzero render window, tempo mapping, pre/post sends and extra render time. Render float audio under identical settings. Sample counts must match exactly; peak residual must be at most −120 dBFS. Eligible inaudible playback events are absent; soloed-return feeders remain. Pruning the longest clip must not shorten export.

Mixed objects, custom global code, opaque FX, processors, unresolved routes and cycles are fallback fixtures: no unsafe pruning. Verify sync/async parity and absence of disk pruning in realtime. Before/after successful and failed export, project serialization, dirty state and history stay unchanged.

Offline sample tests prove isolation/equivalence; hardware playback proves end-to-end latency. Neither replaces the other. Detailed contracts are in [contracts/mixer-mute-solo.md](contracts/mixer-mute-solo.md).
