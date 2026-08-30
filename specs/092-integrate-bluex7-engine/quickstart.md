# Quickstart: Validate Modern BlueX7 Engine and Automation

Run commands from `/Users/stevenyi/work/blue-electron` on branch `092-integrate-bluex7-engine`.

## 1. Provenance and generated-source check

Confirm that `packages/blue-data/resources/blue-x7-modern/provenance.json` records the transient precursor commit, reviewed report digest, exact imported `bluex7.orc` baseline digest, current maintained-source digest, and Blue modifications. Verify that `ATTRIBUTION.md` distinguishes incorporated sources from behavioral references and that `LICENSES/` contains applicable third-party license texts. Then run the Blue-owned bundler in verification mode:

```bash
pnpm --filter @blue/data generate:blue-x7 --check
```

Expected: generated `modern-orchestra.generated.ts` is byte-identical and all recorded current-source hashes match. The original baseline digest remains recorded even after integration edits. The check must not access `dx7-emulation`, and no ROM, demo, render, or unrelated precursor file appears in the Blue package.

## 2. Portable data and CSD contracts

```bash
pnpm --filter @blue/data test -- \
  src/instruments/blue-x7/parameter-catalog.test.ts \
  src/instruments/blue-x7/voice-transport.test.ts \
  src/instruments/blue-x7/csound-target-generator.test.ts \
  src/instruments/blue-x7/modern-support.test.ts \
  src/instruments/blue-x7.test.ts \
  src/blue-data-csd-automation.test.ts
```

Required assertions:

- exactly 151 unique Parameters and 145 voice slots plus six mask bits;
- every voice field maps to the documented transport slot/domain;
- legacy/additive XML, unknown data, stable same-owner IDs, and disjoint copy IDs;
- SysEx/whole-voice replacement retains IDs and automation content while fixed values change;
- immutable support appears once while each arrangement and Track instrument receives a direct-global specialized target;
- Parameter compilation variables are independent per owner;
- generated live inline targets contain exact `gk_blue_autoN` references, capture next-note fields with `i(gk_...)`, and have no 155-slot `kLiveVoice[]`, live ftable, `tabw`, or Parameter `chnget` path; the current target keeps only eight PEG indices/rates and six output-level baselines for dirty scalar adaptation;
- all 32 algorithms, corrected 6/20 topology, mask silence, release completion, finite output, and one calibrated gain;
- Blue p4/p5/p3, saved post code, mixer routing, and direct-output fallback stay intact.

## 3. Engine protocol

```bash
pnpm --filter @blue/engine-client test
cmake --build native/blue-engine/build-darwin-arm64-release -j4
ctest --test-dir native/blue-engine/build-darwin-arm64-release --output-on-failure
```

Use the appropriate existing native build directory on non-macOS hosts. Required assertions include batch golden buffers, capability negotiation, validation bounds, all-or-error batch behavior, ordered readback, and unchanged single-channel behavior.

## 4. Main/preload/project contracts

```bash
pnpm --filter @blue/app test -- \
  src/shared/project-editor-blue-x7.test.ts \
  src/shared/blue-x7-runtime-contract.test.ts \
  src/main/blue-x7-runtime-sync.test.ts \
  src/main/score-automation-runtime-sync.test.ts
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
```

Required assertions:

- arrangement and Track targets resolve by stable owner identity with duplicate names;
- stale session/revision, missing owner, ID/key mismatch, or channel error writes nowhere;
- fixed edits update the correct channel only when automation is not authoritative;
- Track Parameters appear in project lookup and score automation runtime sync;
- whole-voice runtime writes are submitted as one complete batch and become visible between engine control cycles;
- four owners receive disjoint channels and late readback cannot cross editors;
- readback is visible-only, bounded, and never mutates project snapshots or undo state.

## 5. Renderer/browser behavior

```bash
pnpm --filter @blue/app test -- \
  src/renderer/tests/blue-x7-editor.test.tsx \
  src/renderer/tests/blue-x7-project-store.test.ts \
  src/renderer/tests/blue-x7-csound-preview.test.tsx \
  src/renderer/browser/blue-x7-editor.browser.test.tsx
```

Verify that the editor:

- labels the 15 live controls (feedback, LFO depths, operator output levels,
  and operator enables) as active-note and the remaining 136 controls as
  next-note;
- displays fixed values while stopped and effective automated values while playing;
- does not show a manual drag as authoritative when automation remains enabled;
- updates effective values at 20 Hz or faster without dispatching project patches from readback;
- disambiguates same-named arrangement and Track automation targets within three chooser interactions;
- reports every modern sound-relevant binding and its active-note/next-note class without legacy "dormant" claims;
- preserves host-window popup behavior in main and popout editors.

## 6. Deterministic four-instance scenario

Create or use a checked-in fixture containing:

- two arrangement-owned BlueX7 instruments;
- two Track-owned BlueX7 instruments;
- identical display names but distinct owner identities;
- different algorithms, voices, masks, fixed values, and automation curves.

Run the automated integration/stress target supplied by implementation. It must sustain at least 32 concurrent notes for 60 seconds and issue 600 owner-targeted fixed/automated changes. Acceptance is:

- zero cross-instance effective-value changes;
- zero stuck notes, non-finite samples, or engine errors;
- at least 95% of final gesture values effective and visible within 100 ms;
- automation samples match within one k-period plus 50 ms;
- shared support is emitted once and each instance's generated globals/domain symbols remain distinct;
- stop/rebuild preserves routing for surviving owners and removed owners receive no writes.

Repeat after save/reopen, copy/paste of one arrangement instrument, replacement of one Track instrument, and an engine rebuild.

## 7. Atomic voice operations

While all four instances play, repeat at least 100 times across distinct owners:

1. SysEx import or whole-voice replacement.
2. Undo.
3. Redo.

At every engine control sample, assert the observed snapshot is exactly the old or new complete 151-value set. No hybrid is accepted. Confirm that Parameter IDs, curves, points, colors, enabled state, and layer assignments remain unchanged.

## 8. Live/static equivalence and migration

For representative voices and automation curves:

- play from time zero and a nonzero render start;
- seek, loop, pause/resume, and rebuild the engine;
- compare effective value sequences between real-time playback and disk render;
- save/reopen Java-created and TypeScript projects and structurally compare all known voice fields and preserved unknown XML;
- document modern-renderer differences instead of treating them as Pinkston PCM regressions.

Known accepted limitations remain explicit: note-start sync behavior, per-note LFO rather than one globally shared LFO, approximate amplitude modulation, and modern rather than legacy PCM behavior.

Confirm those limitations, the fixed calibration factor, provenance, and the intentional sonic migration are also recorded in `docs/blue-x7-modern-renderer.md`.

## 9. Realtime performance gates

Use `fixtures/blue-x7-pop-song.blue` and its generated live CSD as the reproducible dense case. The opt-in harness below also uses the fixture's 59-voice density with fast release rates so it is practical to run repeatedly. Record the command, machine, Csound/Blue Engine build, `ksmps`, sample rate, rendered samples, CPU time, wall time, and peak active-note count for every comparison.

```bash
BLUE_X7_PERF=1 pnpm --filter @blue/data exec vitest run \
  src/instruments/blue-x7/performance-benchmark.test.ts
```

Run and retain these paired measurements:

1. Static renderer versus live-capable renderer with unchanged controls.
2. Current baseline versus generated direct-global targets, including the per-note-guard and per-instance-domain-epoch variants.
3. Shared-UDO versus partially/fully inlined generated targets using identical direct globals and score input.
4. Blue Engine with channel mirroring enabled versus disabled.
5. Release-heavy passages before and after the inaudible-release fast path.

Acceptance gates:

- unchanged live-capable rendering uses no more than 1.20x the CPU time of the static renderer;
- the dense fixture sustains at least 1.25x realtime compute throughput, leaving audio-device and scheduling headroom;
- generated live inline targets contain direct `gk_blue_autoN` references and
  no 155-slot `kLiveVoice[]`, live ftable, `tabw`, or Parameter `chnget` path;
  next-note values use i-rate snapshots and only the 15-control scalar active
  fragment runs after an epoch change;
- the selected domain-change strategy keeps unchanged-domain derivation below the live/static CPU budget at increasing polyphony;
- shared-UDO and generated-inline targets pass deterministic output/state equivalence; if CPU differs by more than 5%, the faster passing target is selected, otherwise the smaller/easier-to-audit target is selected;
- a control-boundary sampler sees only the complete old or new values during a 151-channel batch;
- enabling Blue Engine channel mirroring adds no more than 5% to the repeatable engine benchmark;
- audible output before and after optimization is equivalent within the selected deterministic render tolerance;
- active edits, atomic complete-voice changes, and next-note fields retain their contract behavior;
- a release voice parked as inaudible resumes correctly when a live edit makes it potentially audible, and existing lifetime/freeze/cap rules are unchanged.

A failed live/static gate blocks release even if the fixture happens to render in realtime on a faster machine. Do not optimize Blue Engine mirroring or oscillator internals before profiling shows that direct-global generation and dirty-domain guards are no longer the dominant cost.

## 10. Full handoff validation

```bash
pnpm test
pnpm lint
git diff --check
```

Also run the repository's applicable package builds/type checks for any files touched by implementation. Windows CI is required if generator path handling changes; production runtime has no new path boundary.

## Failure triage

- A current-source/generated-output checksum failure blocks distribution; do not regenerate blindly. A changed imported-baseline record requires explicit review because it breaks the documented precursor lineage.
- A stale/missing owner must produce no channel writes.
- An uncertain atomic batch keeps the canonical project and rebuilds/resynchronizes disposable engine state.
- A non-finite sample, stuck note, cross-instance update, duplicated shared module, or lost automation identity is release-blocking.
