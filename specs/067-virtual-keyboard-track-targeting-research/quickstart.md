# Quickstart Validation: Focused MIDI Instrument Routing

Use this guide during implementation and acceptance. It validates the compiled-target authority and note lifecycle before broad UI checks, then proves equivalent hardware and Virtual Keyboard behavior.

## Prerequisites

- Install the existing pnpm workspace dependencies.
- Build or locate the bundled Blue Engine and a usable Csound 7 runtime.
- Connect one enabled class-compliant MIDI input device.
- Prepare a project containing:
  - two Tracks with enabled, audibly distinct instruments;
  - one Track with no instrument;
  - at least two enabled Orchestra assignments with distinct sounds;
  - when supported, one named or non-consecutive Orchestra assignment;
  - distinct project MIDI pitch/velocity mapping from the default, so mapping is observable.

## 1. Focused automated validation

Run the narrow data and app suites first:

```bash
pnpm --filter @blue/data exec vitest run src/blue-live-csd.test.ts src/score/track/track-instrument-csd.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/midi-routing-store.test.ts src/renderer/tests/midi-note-router.test.ts src/renderer/tests/blue-live-engine.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/virtual-keyboard-panel.test.tsx src/renderer/tests/orchestra-arrangement.test.tsx src/renderer/tests/track-layer-group-canvas.test.tsx src/renderer/tests/blue-live-hardware-parity.test.ts src/renderer/tests/midi-input-lifecycle.test.tsx
```

Expected:

- the Blue Live render result catalogs exact Track and Orchestra targets without mutating `BlueData`;
- Track/Orchestra focus and direct-channel resolution are session-fenced and fail closed;
- note-off uses its retained note-on target after focus/mode changes;
- stale Blue Live session IDs are rejected before target resolution or score submission;
- equal pitches on different targets do not collide;
- multiple sources on one target still reference-count correctly;
- invalid targets submit no score text;
- project and Blue Live lifecycle cleanup leaves empty ledgers;
- Blue Live restart preserves a still-existing focused target while project replacement clears it.

Run affected builds and full package suites after focused tests:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/data build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm lint
pnpm build
```

## 2. Validate the compiled target catalog first

1. Generate a Blue Live CSD for the prepared project without starting the engine.
2. Inspect the returned target catalog in the focused test/debug harness.
3. Confirm each enabled Track instrument has one stable Track entry and each enabled Orchestra assignment has one assignment entry.
4. Confirm the unassigned Track and disabled assignments are absent.
5. Confirm generating the CSD does not add Track instruments to the canonical project Arrangement and does not write runtime IDs to saved XML.
6. Replace or disable a Track instrument, generate again, and confirm the new catalog is rebuilt without stale entries.
7. Submit a request carrying the previous Blue Live session ID after restart and confirm main rejects it with no score submission.

Pass gate: the catalog and CSD are one compilation snapshot; target identity never comes from later row position or canonical project mutation.

## 3. Focus and target indicator

1. Start the app and load the prepared project.
2. Open the Virtual Keyboard and confirm `Focused Target` is the default routing mode.
3. Before selecting an eligible target, confirm the control says `No focused instrument` and is accessible without color alone.
4. Click a Track header, empty Track timeline position, Track-contained object, and Track instrument control in turn.
5. Confirm every explicit interaction focuses that Track and the Virtual Keyboard shows `Track: <name>`.
6. Use Mute/Solo/automation/note-processor controls and confirm they do not unexpectedly redirect performance focus.
7. Open Orchestra and confirm its automatic editor selection does not steal focus.
8. Explicitly click an Orchestra row and confirm the target changes to its assignment ID/name.
9. Rename the focused target and confirm display metadata refreshes while identity remains stable.
10. Remove the focused target or switch projects and confirm focus clears before new notes route.

Pass gate: one visible renderer-owned performance focus spans both panels without changing project data or ordinary ScoreObject/editor selection.

## 4. Focused Track performance

1. Start Blue Live and focus the first instrument-bearing Track.
2. Play and release a note from the Virtual Keyboard.
3. Repeat the same note/velocity from hardware.
4. Confirm both sources use the Track instrument and current project MIDI mapping.
5. Hold a note on Track A, focus Track B, play a second note, then release both.
6. Confirm Track A's release returns to Track A and Track B's lifecycle remains independent.
7. Focus the Track with no instrument and play a note.

Pass gate: no channel assignment is needed for Track focus, both input sources are equivalent, and an unavailable Track produces no sound, no routing error, and no fallback to an Orchestra instrument.

## 5. Focused Orchestra performance

1. With Blue Live running, explicitly focus the first Orchestra assignment and play/release from both sources.
2. Focus the second assignment and repeat.
3. Focus a named or non-consecutive assignment and confirm identity, not row position or MIDI channel, determines the sound.
4. Stop and restart Blue Live without changing the focused assignment; confirm held notes are cleared and the focused assignment remains selected after the new catalog is installed.
5. Disable or remove the focused assignment, restart, and confirm the unavailable target produces no sound or fallback; a removed project identity clears during snapshot reconciliation.

Pass gate: the exact focused assignment plays and wrong-instrument score submission remains zero.

## 6. Direct-channel compatibility

1. Switch the Virtual Keyboard routing control to `Direct Channel`.
2. Confirm the existing one-based Channel input appears and the focused-target label no longer determines routing.
3. Select Virtual Keyboard channel 1, play/release, then select channel 2 and repeat.
4. Send hardware notes on native channels 1 and 2.
5. Confirm each source follows the same project assignment behavior used before Spec 067 and retains the project's MIDI mapping.
6. Send on an unmapped channel and confirm silent rejection with no fallback or held-note state.
7. Switch routing mode while holding a note, release it, and confirm the release reaches the original target.

Pass gate: existing Specs 033/058 channel behavior remains usable and mode changes affect only future note-ons.

## 7. Collision and cleanup stress

1. Focus Track A and hold middle C from hardware.
2. Focus Track B and hold middle C from the Virtual Keyboard on the same channel.
3. Release only one source and confirm only its target stops.
4. Route the same target/pitch from two sources, release one, and confirm the aggregate note continues until the second source releases.
5. Repeat while disconnecting hardware, disabling the device, pressing All Notes Off, stopping Blue Live, restarting/recompiling, switching projects, and closing the app. Confirm restart retains focus but switching projects clears it.
6. Run at least 100 automated focus/mode switch and cleanup cycles.

Pass gate: no event releases a newly focused target by mistake, no equal-pitch target collision occurs, and no cycle leaves a sounding or tracked stuck note.

## 8. Qualitative routing-delay comparison

1. Choose one assignment reachable in direct-channel mode and play a repeated, rhythmically even figure from the Virtual Keyboard and hardware controller.
2. Focus the equivalent Track or Orchestra target, switch to `Focused Target`, and repeat the same figure under the same Blue Live session and audio settings.
3. Alternate modes several times and listen/feel for additional interaction delay attributable to focused routing.

Pass gate: focused routing adds no perceptible delay compared with the existing direct-channel path. There is no synthetic millisecond threshold; regressions are primarily prevented by keeping both modes on the same router and IPC path.

## 9. Final regression boundary

Confirm all of the following remain unchanged:

- Virtual Keyboard octave, computer-key mapping, velocity override, focus styling, drag behavior, and All Notes Off;
- MIDI device discovery, default enablement, preferences, permissions, hot plug, timing metadata, and source cleanup;
- project MIDI Input pitch/scale/velocity editing and `.blue` round trip;
- Blue Live lifecycle, BSB realtime control fan-out, and non-note message deferrals;
- Track/Orchestra editing, instrument replacement, and editor selection.

Record the focused and full command results in this guide when implementation is complete.

## 10. Pre-change compatibility baseline (T001)

Captured before any Spec 067 source change, on branch `067-midi-focus-routing`, to preserve the direct-channel, Virtual Keyboard, hardware MIDI, and Blue Live cleanup behavior this feature must not regress.

### Portable data

```bash
pnpm --filter @blue/data exec vitest run src/blue-live-csd.test.ts src/score/track/track-instrument-csd.test.ts
```

- `src/blue-live-csd.test.ts` — 11 passed (11)
- `src/score/track/track-instrument-csd.test.ts` — 4 passed (4)

### App MIDI / Blue Live / Virtual Keyboard

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/midi-note-router.test.ts \
  src/renderer/tests/blue-live-engine.test.ts \
  src/renderer/tests/blue-live-hardware-parity.test.ts \
  src/renderer/tests/virtual-keyboard-panel.test.tsx \
  src/renderer/tests/midi-input-lifecycle.test.tsx
```

- `midi-note-router.test.ts` — 9 passed (9) — direct-channel `(channel, midiNote)` aggregate and source-scoped cleanup authority.
- `blue-live-engine.test.ts` — 15 passed (15) — `triggerNote` channel-indexed resolution, all-notes-off, and lifecycle.
- `blue-live-hardware-parity.test.ts` — 5 passed (5) — hardware/Virtual Keyboard source parity on the shared channel path.
- `virtual-keyboard-panel.test.tsx` — 5 passed (5) — piano/octave/velocity/channel-selector behavior.
- `midi-input-lifecycle.test.tsx` — 9 passed (9) — release-at-session-boundary and shutdown cleanup.

Pass gate: all 43 app tests and all 15 portable-data tests pass before any Spec 067 change, establishing the regression boundary.

## 11. Implementation evidence (automated portions of T039/T040)

Recorded after Spec 067 implementation on branch `067-midi-focus-routing`.

### Focused Spec 067 suites

```bash
pnpm --filter @blue/data exec vitest run src/blue-live-csd.test.ts src/score/track/track-instrument-csd.test.ts
```

- `blue-live-csd.test.ts` — 15 passed (15) — compiled target catalog: deterministic enabled Orchestra + Track targets, disabled exclusion, no canonical/XML mutation, stale-free rebuild.
- `track-instrument-csd.test.ts` — 9 passed (9) — Track target catalog: enabled Track entry, disabled/missing exclusion, clear rebuild, Orchestra/Track identity separation, no XML write.

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/project-editor-midi-routing.test.ts \
  src/renderer/tests/midi-routing-store.test.ts \
  src/renderer/tests/midi-note-router.test.ts \
  src/renderer/tests/blue-live-engine.test.ts \
  src/renderer/tests/blue-live-hardware-parity.test.ts \
  src/renderer/tests/virtual-keyboard-panel.test.tsx \
  src/renderer/tests/midi-input-lifecycle.test.tsx \
  src/renderer/tests/blue-live-contract-forwarding.test.ts \
  src/renderer/tests/track-instrument-control.test.tsx \
  src/renderer/tests/orchestra-arrangement-ui.test.tsx \
  src/renderer/tests/score-panel-session-reset.test.tsx \
  src/renderer/tests/track-layer-group-canvas.test.tsx \
  src/renderer/tests/project-store.test.ts
```

- `project-editor-midi-routing.test.ts` — 16 passed — shared target contract, omitted-target compatibility, bounded identities, session validation, collision-safe keys.
- `midi-routing-store.test.ts` — 15 passed — focus-default state, Track/Orchestra replacement, mode changes, reconciliation, project clearing, restart retention, fail-closed resolution, no diagnostic state.
- `midi-note-router.test.ts` — 22 passed — target resolution at note-on, retained target/session on note-off, `(targetKey,midiNote)` aggregation, source idempotence, no-target rejection, lifecycle stress (100-cycle, mode-change retarget safety, ledger-clears-before-all-notes-off), and duplicate final-note-off suppression.
- `blue-live-engine.test.ts` — 41 passed — catalog install/validate/clear, stale-session rejection, Track/Orchestra/channel resolution including named Orchestra IDs, disabled/missing rejection, failed-start leaves no catalog, direct-channel compatibility and ordering, target-independent project MIDI mapping, score-text success-only reporting, and invalid-catalog startup rejection.
- `blue-live-hardware-parity.test.ts` — 8 passed — hardware/Virtual Keyboard equivalence for focused Track and Orchestra targets, plus fail-closed unavailable targets.
- `virtual-keyboard-panel.test.tsx` — 12 passed — Focused Target default, accessible empty-target status, no error message, Direct Channel selector, retained-but-ignored focus.
- `midi-input-lifecycle.test.tsx` — 15 passed — fail-closed no-target, shared resolution, project clearing, Blue Live restart retention, shutdown release, no diagnostic state.
- `blue-live-contract-forwarding.test.ts` — 7 passed — preload/global forwarding of optional target/session fields unchanged.
- `track-instrument-control.test.tsx` — 6 passed — instrument-control click focuses Track.
- `orchestra-arrangement-ui.test.tsx` — 4 passed — explicit Orchestra row selection focuses; auto/fallback does not.
- `score-panel-session-reset.test.tsx` — 6 passed — Track header focus and non-focus control behavior alongside session reset coverage.
- `track-layer-group-canvas.test.tsx` — 16 passed — empty-timeline and contained-object focus behavior plus existing canvas interactions.
- `project-store.test.ts` — 7 passed — project replacement clears transient MIDI focus with the rest of project-owned renderer state.
- Combined affected app regression set — 13 files, 175 passed — engine, router, focus reconciliation, lifecycle, hardware/Virtual Keyboard parity, project mapping, and Track/Orchestra focus indicators.

### Full package suites

```bash
pnpm --filter @blue/data test   # 154 files, 1401 tests passed
pnpm --filter @blue/app test    # 266 files, 2519 passed | 2 skipped
```

### Builds and lint

```bash
pnpm --filter @blue/data build        # tsc esm + cjs — success
pnpm --filter @blue/app build:main    # tsc main — success
pnpm --filter @blue/app build:preload # tsc preload — success
pnpm --filter @blue/app build:renderer # vite renderer — success
pnpm lint                             # native + java lint — Done (TS strict via tsc builds)
pnpm build                            # full repository build — Done
```

Pass gate: every deterministic compiled-catalog, focus indicator, Track, Orchestra, direct-channel, collision, cleanup, and automated hardware/Virtual Keyboard scenario passes; affected data/main/preload/renderer builds and the full repository build succeed.

### Closeout validation (T039/T042–T044)

The completion audit added regressions for named Orchestra runtime targets, shared
Orchestra hardware/Virtual Keyboard routing, cross-kind focus replacement with retained
note-off authority, target-independent project MIDI mapping, and the exact Track header,
empty-timeline, contained-object, and non-focus-control surfaces. The audit exposed one
functional gap: a named Orchestra runtime ID was written directly into numeric score
text. The main process now resolves that ID through the engine-assigned instrument map
before submitting the note, and the complete focused and full suites above pass.

The project owner completed the physical-device and live-listening validation on
2026-08-06 and reported that the routing behavior looked good, including no observed
hardware/Virtual Keyboard mismatch or perceptible Focused Target routing delay. Combined
with the deterministic automated scenarios above, this closes T039 and the three
convergence tasks.
