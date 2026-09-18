# Quickstart: Validate Mono Clip Panning

## Prerequisites

From repository root, install dependencies with `pnpm install`. Have a working Blue Engine/Csound runtime for audible render checks. Use small deterministic mono, stereo with distinct L/R, and three-channel WAV fixtures. See [audio-routing.md](contracts/audio-routing.md) and [data-model.md](data-model.md) for expected values.

## Model and compiler checks

1. Run `pnpm --filter @blue/data test` and `pnpm --filter @blue/data build`.
2. Inspect focused tests for new-score true, legacy/missing/invalid score false, channel pan/Parameter XML round trip, deep copy, and Java fixture preservation.
3. Generate CSD for a legacy score with no property before/after save and compare its routing. Generate enabled stereo CSD for mono, stereo, and mixed clips; verify the emitted routing and gain equations.
4. Render the numeric fixtures at left, center, and right. Mono center should measure about 0.707 per side for unit source, endpoints 1/0 and 0/1. Stereo center should preserve independent sides. Mixed track should retain both.
5. Repeat with mixer disabled and `nchnls=1`; inspect valid output. For `nchnls>2`, three-channel input, and unreadable audio, confirm a clear diagnostic before launch and unchanged project XML. Change cached clip metadata and confirm actual file layout still wins.

## App, history, and runtime checks

1. Run `pnpm --filter @blue/app test` and `pnpm --filter @blue/app build:main`.
2. Open a new score: Score Settings shows enabled; mixer shows Pan for verified all-mono source and Balance for stereo/mixed/unknown. Toggle off: control becomes inactive and legacy render returns.
3. Open a pre-feature Java/TS score: setting shows disabled; save/reopen without toggling and compare audio/CSD. Enable explicitly, save/reopen, and confirm the new route.
4. With playback running, commit a setting toggle and a channel position edit; undo and redo each. Confirm canonical value, dirty state, stable references, audible reconciliation, and no stale panner. Exercise automation during playback.
5. Confirm sends use their prior feed point and output meters reflect the audible post-pan channel.
6. Exercise disk-profile Generate CSD to Screen with enabled audio, plus timeline, realtime, and Blue Live failures. Confirm preflight diagnostics stay typed and recoverable, and that the generated CSD path receives the detached audio-layout manifest.

## Final gates

Run `pnpm test`, `pnpm lint`, and `git diff --check` from repository root. For changed host-path behavior, run the Windows CI target or equivalent native Windows validation. Record any scoped environment-only failure in the implementation handoff.

## Verification Record (2026-09-18, T026/T038/T053/T062/T067/T076/T078-T086)

Environment: macOS (darwin 23.2.0, arm64), Csound 7.0 at `/usr/local/bin/csound`,
Blue Engine binary under `native/blue-engine/build-darwin-arm64-debug/`. Numerical
and engine integration suites probe `csound --version` and skip (not fail) when a
Csound runtime is absent, matching the CI pattern in
`global-history-engine.integration.test.ts`.

### Commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter @blue/data test` | 2003 passed, 1 skipped (201 files) |
| `pnpm --filter @blue/data build` | OK (tsc cjs + esm) |
| `pnpm --filter @blue/app test` | 5234 passed, 2 skipped (493 files) |
| `pnpm --filter @blue/app build:main` | OK (tsc main) |
| `pnpm --filter @blue/app build:preload` | OK (tsc preload) |
| `pnpm --filter @blue/app build:renderer` | OK (Vite renderer/main/preload bundles; large-chunk warnings only) |
| `pnpm --filter @blue/app test -- src/renderer/browser/mono-clip-panning.browser.test.tsx` (vitest.browser.config.ts) | Could not launch local Chromium: Playwright exited before tests with SIGABRT/`Target page, context or browser has been closed`; no browser tests executed |
| `pnpm lint` | OK (`eslint`, typography audit, package lint, and Prettier check) |
| `pnpm test` | OK — all workspace packages pass (exit 0; includes native engine suites) |
| `git diff --check` | clean |

### Cross-platform CI validation (T078/T085/T086)

[PR #6](https://github.com/kunstmusik/blue-electron-poc/pull/6) passed all platform checks. The
`windows-x64` job ran on `windows-2022` and passed native workspace/artifact verification, the
full workspace tests, lint, Windows packaging, packaged-app smoke verification, and installer
staging/upload. The [Windows job](https://github.com/kunstmusik/blue-electron-poc/actions/runs/35372915388/job/105690859338)
provides the required native path-sensitive validation for audio-layout preflight, file identity,
and embedded Csound paths.

### Numerical render matrix (T071, `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`)

Rendered through the real pipeline — `preflightAudioLayout` → `toDiskCSD(manifest)` →
`csound -nd -W --0dbfs=1 --format=double` — with 16-bit WAV fixtures generated in
`os.tmpdir()` via `path.join()` (native host paths preserved until the Csound note
boundary). Levels are max-abs plateaus measured between 0.9 s and 1.1 s of a 2 s
render (60 BPM default, beats equal seconds).

| Scenario | Expected | Tolerance | Result |
| --- | --- | --- | --- |
| Mono clip, all-mono channel, pan 0.5 | L ≈ R ≈ 1/√2 ≈ 0.7071 per side, L−R ≈ 0 | ±0.005; channel equality < 1e-3 | PASS |
| Mono clip, pan 0 | L ≈ 1, R < 1e-4 | ±0.005 / 1e-4 | PASS |
| Mono clip, pan 1 | L < 1e-4, R ≈ 1 | 1e-4 / ±0.005 | PASS |
| Stereo clip (0.8, −0.4), pan 0.5 | L ≈ 0.8, R ≈ 0.4, sides independent | ±0.005; \|L−R\| > 0.1 | PASS |
| Overlapping mono + stereo on one track | L ≈ 0.7071 + 0.8, R ≈ 0.7071 − 0.4 (sum, no collapse) | ±0.005 | PASS |
| `nchnls=1`, mono source | 1-channel WAV, level ≈ 1.0, CSD contains `nchnls=1` | ±0.005 | PASS |

Overlapping clips exposed a real defect during convergence: the enabled playback
template assigned (`=`) the channel bus instead of accumulating, so the later clip
silently replaced the earlier one. Fixed in
`packages/blue-data/src/score/audio/playback-instrument-orc.ts` (enabled template
only accumulates; BlueMixer clears the buses every control cycle). The legacy
disabled template is unchanged.

### Enabled-route CSD snippet (captured, T026)

From a panning-enabled project (source channel pan 0.25, post-fader send to a
Reverb subchannel, `toRealtimePlaybackCSD(undefined, true, manifest)`):

```csound
; send tap — pre-pan bus, send amount + route gate only (no double panning)
ga_bluesub_Reverb_0	+=	(ga_bluemix_0_0 * gk_blue_auto0) * kMixGateState_0
; equal-power Mono Pan (verified all-mono source channel)
k_pan_l = 1.4142135623730951 * cos(1.5707963267948966 * gk_blue_auto2)
k_pan_r = 1.4142135623730951 * sin(1.5707963267948966 * gk_blue_auto2)
ga_bluemix_0_0 *= k_pan_l
ga_bluemix_0_1 *= k_pan_r
; output gate, then meter, then parent routing
ga_bluemix_0_0 = ga_bluemix_0_0 * kMixGateState_1
kMeter_rms_0 rms ga_bluemix_0_0
ga_bluesub_Master_0	+=	ga_bluemix_0_0
; subchannel / Master use conservative Balance
k_bal_l = min(1, 2 * (1 - gk_blue_auto4))
k_bal_r = min(1, 2 * gk_blue_auto4)
```

Stage order assertions: `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`
and the pan/gate interaction block in `mixer-gate-csd.test.ts`. Floating-point
comparisons in CSD text tests match the exact emitted constants
(`1.4142135623730951`, `1.5707963267948966`); audio-level assertions use the
tolerances in the matrix above (16-bit source quantization keeps the measured
plateaus within 0.0001 of ideal).

### Legacy compatibility matrix (T038, US2)

| Scenario | Assertion suite | Result |
| --- | --- | --- |
| New score defaults `panningEnabled=true`, explicit attribute saved | `score-panning.test.ts`, `xml-policy.test.ts` | PASS |
| Absent attribute / invalid value / missing `<score>` loads false, document clean | `xml-policy.test.ts`, `blue-data-frozen-roundtrip.test.ts` | PASS |
| Legacy open→save→reopen idempotence, unknown XML preserved | `xml-policy.test.ts` | PASS |
| Disabled route byte/order-compatible baseline (mixer-disabled and ordinary) | `csd-policy.test.ts`, `csd-generation.test.ts`, `render-to-disk.test.ts` | PASS |
| Explicit toggle commits `Set Score Panning`, structural restart classification | `score-panning-contract.test.ts`, `project-history-patch-classification.test.ts`, `project-runtime-reconciliation.test.ts` | PASS |
| End-to-end legacy open/save/reopen across disk/realtime/BlueLive | `csd-generation.test.ts`, `render-to-disk.test.ts`, `blue-live-engine.test.ts` | PASS |

### Pan/Balance behavior matrix (T053, US3)

| Scenario | Assertion suite | Result |
| --- | --- | --- |
| Pan enumerated once per source/sub/master channel, distinct from Volume, stable history-copy identity, deterministic `gk_blue_autoN` names | `parameter-helper.test.ts`, `project-parameter-catalog.test.ts` | PASS |
| Mono Pan vs no-crossfeed Balance emission and stage order (send tap → pan → gate → meter → routing) | `mono-clip-panning.test.ts`, `mixer-gate-csd.test.ts` | PASS |
| `${channelId}::pan` runtime binding present when enabled, absent when disabled; volumes stay aligned | `runtime-parameter-sync.test.ts` | PASS |
| Keyboard/aria behavior: value-free Pan heading, law-disclosing accessible name/tooltip, center `C`, 0.01/0.05 steps, Home/End, drag mapping, inactive when panning off | `renderer/tests/mono-clip-panning.test.tsx` (jsdom); Chromium browser coverage is launch-blocked in this environment | jsdom PASS; browser not executed |
| Commit→undo→redo for fixed and automated Pan, live and stopped | `project-history-roundtrip.test.ts`, `global-history-engine.integration.test.ts`, `runtime-parameter-sync.test.ts` | PASS |

### Unsupported-layout matrix (T062, US4)

| Scenario | Assertion suite | Result |
| --- | --- | --- |
| Actual header wins over cached `AudioClip.numChannels`; one observation per native file identity across relative/absolute/symlink aliases; injected `EACCES`-style read failures (no POSIX chmod) | `audio-layout-preflight.test.ts`, `audio-file-identity.test.ts` | PASS |
| `nchnls=1` mono output valid, no pan stage; `nchnls>2`, source `>2`, missing observations fail with typed diagnostics | `csd-policy.test.ts`, `mono-clip-panning.test.ts`, `track-audio-playback.test.ts` | PASS |
| Diagnostic guard rejects malformed codes/shapes before crossing IPC; recoverable disk/timeline/BlueLive/realtime/CSD-to-screen status carries `layoutDiagnostic` | `audio-layout.test.ts`, `blue-live-status.test.ts`, `render-freeze-contract.test.ts`, `render-to-disk.test.ts`, `render-to-disk-dialog.test.tsx` | PASS |
| Failed preflight never mutates project XML/dirty/history state; retry allowed later | `blue-data-frozen-roundtrip.test.ts`, `csd-export-immutability.test.ts`, `csd-generation.test.ts`, `render-to-disk.test.ts` | PASS |
| Synthetic Windows paths (`C:\\Users\\...`) at the embedded-text boundary | `audio-layout-preflight.test.ts` | PASS |

### Convergence corrections (T079-T084)

The mixer snapshot classifier now shares the CSD classifier's effective-layout predicate:
only enabled stereo-generating `Effect` entries make a channel Balance-law; disabled
effects and `Send` entries do not. The position strip keeps its centered `Pan` heading and
value-free presentation, while its accessible name and tooltip disclose `Mono Pan` or
`Stereo Balance`.

Disk-profile Generate CSD to Screen now preflights before JavaScript runtime setup and
passes the detached manifest into CSD generation. Typed `AudioLayoutDiagnostic` values are
validated at the preload boundary and preserved through timeline playback, realtime and
disk CSD-to-screen, Blue Live, and renderer error/status presentation. Preflight dedupe
uses a reusable platform-aware native file identity boundary while retaining every original
native path as a manifest alias.

### Convergence-time correction (T077)

Runtime parameter name syncing enumerated mixer Pan unconditionally while the
compiler enumerated it only when score panning was enabled. For every
panning-disabled (legacy) project with more than one mixer channel this
misaligned the positional fallback: live channel N's Volume adopted channel
N+1's compiled variable, and Pan adopted a neighbor's Volume. Fixed by gating
`getMixerOwnerParameters(mixer, { includePan })` to the score setting in
`syncCompiledRuntimeParameterNames`; regression coverage lives in
`runtime-parameter-sync.test.ts`.

### Known limitations

- Subchannels and Master use conservative Balance (permitted by
  [audio-routing.md](contracts/audio-routing.md)) until all-upstream-mono proof exists.
- Mixer-disabled direct output keeps Java-parity per-clip assignment semantics:
  overlapping clips on one track still overwrite (the accumulation guarantee
  applies to the mixer route).
- The loader accepts case-insensitive `panningEnabled="TRUE"` leniently; any
  other non-`true` value loads disabled.
- Numerical renders and engine integration tests require a Csound runtime and
  the Blue Engine binary; they skip automatically where those are absent.
- The local macOS Chromium browser suite could not launch; jsdom coverage passed and manual UI
  acceptance passed. Native Windows path-sensitive validation passed in PR #6.
