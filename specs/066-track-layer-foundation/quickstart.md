# Quickstart Validation: Track Layer Foundation

## Prerequisites

- Install repository dependencies with the existing pnpm workspace setup.
- Have one short stereo audio file available.
- Have representative historical `.blue` fixtures containing Audio Layer Groups, multiple Audio Layers, AudioClips, automation parameter IDs, and mixer channels with effects/sends.
- Use a build with the Track Layer implementation complete.

## Implementation status

The Track Layer implementation is complete. The canonical runtime is Track/TrackLayerGroup, historical Audio Layer XML is migrated before deserialization, and production TypeScript code no longer loads or saves the removed AudioLayer runtime. On 2026-08-05 the project owner accepted the accumulated manual Electron testing as sufficient to close the feature.

## 1. Focused automated validation

Run the affected package suites first:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/data build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

Expected:

- all registry, migration, XML, p1, processing-order, sync/async CSD, mixer, settings, snapshot/patch, library transfer, renderer, and editor-window tests pass;
- no strict TypeScript or static-import boundary failures;
- no AudioLayer/AudioLayerGroup production imports or canonical saver paths remain.

Then run repository-level verification in proportion to the final diff:

```bash
pnpm test
pnpm lint
pnpm build
```

Recorded automated result on 2026-08-02: the focused corrective set passed 53 tests; `@blue/data` passed 1,376 tests; `@blue/app` passed 2,373 tests with 2 existing skips; `pnpm test`, `pnpm lint`, and `pnpm build` passed for all workspace projects; and `node scripts/verify.mjs` passed all required checks, including the Track runtime cleanup, package-input checks, and 69 release-workflow contracts. The verifier reports missing signing/publication credentials only in its advisory unsigned-release preflight.

Recorded ScoreObject interaction corrective result on 2026-08-05: 20 focused Track/editor/color tests passed; 34 adjacent ScoreObject editor, fallback, cross-group, and Track integration tests passed; the complete `@blue/app` suite passed 2,407 tests with 2 existing skips; and the renderer production build passed. The standalone renderer `tsc` command remains unsuitable as a clean gate because its existing `rootDir` includes renderer tests that import main/shared sources and it reports unrelated pre-existing type errors; the configured production build and Vitest suite are the authoritative affected-package checks for this corrective slice.

Recorded render-start corrective result on 2026-08-05: the focused paired regression passed 7 tests; the complete `@blue/data` suite passed 1,392 tests across 154 files; and both ESM and CJS builds passed. `packages/blue-data/src/score/score-render-start-offset.test.ts` exercises PianoRoll generation through both Track and SoundObject Layer paths in synchronous and asynchronous modes, pre-window exclusion, and an AudioClip double-rebase guard.

Recorded rapid Track-instrument corrective result on 2026-08-05: 13 focused editor/queue/runtime/contract tests passed; the complete `@blue/app` suite passed 2,416 tests across 262 files with 2 existing skips; and main, preload, and production renderer builds passed. Spec Kit analysis found all 69 requirements covered by tasks with no ambiguity, duplication, or constitution conflict. The Karpathy pass removed duplicated runtime parameter lookup, moved the coalescing policy into a small focused module, and left no medium-threshold runtime-sync complexity finding; the remaining renderer warning is limited to the hook/JSX coordinator and has no file-length or failed-gate finding.

Recorded continuous Set Color corrective result on 2026-08-05: 19 focused Track/SoundObject Layer interaction tests passed with two successive native color-input events per picker invocation; the complete `@blue/app` suite passed 2,416 tests across 262 files with 2 existing skips; and the production renderer build passed. Diff and whitespace checks were clean. The Karpathy relaxed scan still identifies the pre-existing large-canvas complexity in `ScoreTimeCanvas.tsx` and `TrackLayerGroupCanvas.tsx`; this correction adds no new nesting or abstraction and intentionally leaves the separately planned large-file improvement pass out of scope.

Recorded persistent color-picker corrective result on 2026-08-05: 85 focused shared-picker, Track, SoundObject Layer, ScoreObject Properties, and BSB tests passed across 5 files; the complete `@blue/app` suite passed 2,418 tests across 263 files with 2 existing skips; and the production renderer/main/preload build passed. Production renderer components contain no native color inputs. Strict Karpathy analysis gives the pure placement/conversion utility 100/100 and reports only JSX nesting in the cohesive 231-line picker component, with no cyclomatic, class, or file-length finding.

Recorded final closeout result on 2026-08-05: the Track-only automation regression moved from `score/audio/audio-layer-automation.test.ts` to `score/track/track-automation.test.ts` and its 4 focused cases passed. `AudioClip` remains in the separate `score/audio` content domain with its fade and playback assets; only its Track-specific generation orchestration lives under `score/track`. Repository-wide `pnpm test` passed, including 1,392 `@blue/data` tests, 2,418 `@blue/app` tests with 2 existing skips, and all CLI, engine-client, Java, and native suites. `pnpm lint`, `pnpm build`, and `pnpm verify` passed; the verifier completed every required check, including Track runtime cleanup and all 69 release-workflow contracts. Missing signing/publication credentials remain advisory because current releases are unsigned by default.

## 2. New-project default

1. Open Program Options → Project Defaults.
2. Confirm `Default Layer Group Type` initially displays `Track Layer`.
3. Create a new project.
4. Confirm the Score contains one Track Layer Group with one Track and one associated mixer source channel.
5. Change the option to `SoundObject Layer`, create another new project, and confirm it starts with one SoundObject Layer Group/layer.
6. Reopen an older settings file or test with the new key removed and confirm fallback is Track Layer.

Expected: the choice affects only future new projects, never the already open project.

## 3. Mixed-content Track editing

1. On one Track, add a PianoRoll from the Track timeline context menu.
2. Add the chosen audio file as an AudioClip on the same Track.
3. Single-click the PianoRoll and note its editor scroll position, then double-click it; confirm the same notes remain in view and no Loading card flashes.
4. Move both items, resize both, and edit AudioClip fades/file offset.
5. Copy a compatible SoundObject, then Command-click or Control-click an empty Track position and confirm the copy appears at the snapped click time.
6. Right-click an unselected SoundObject in both a Track and a SoundObject Layer, choose Set Color, and confirm the picker appears fully on screen above or below the complete object row so the object remains visible. Edit through presets, HSL sliders, and hexadecimal values and confirm every selected object keeps previewing the current color; repeat with a multi-selection and with an object near the bottom viewport edge.
7. Open color controls in ScoreObject Properties, automation, line definitions, and BSB properties. Confirm they use the same picker, remain open through repeated edits and another click on the current trigger, and close only after an outside click or Escape.
8. Copy/paste each item through the context menu and marquee-select a mixed set.
9. Save, close, and reopen the project.

Expected: both object types remain directly on one ordered Track; timing, fades, content, identities, selection behavior, type-specific editor viewport, modifier-click paste, and color editing remain correct without a Loading flash. AudioFile SoundObject is not offered as a Track SoundObject.

## 4. Instrument assignment interactions

1. Right-click the Track instrument control and select `Use New Instrument → Generic Instrument`.
2. Confirm the control displays the new instrument.
3. Double-click it and confirm one non-modal child editor opens, remains always on top, and still allows input to the main score/mixer window; edit its name/orchestra text, close it, and reopen it to verify canonical persistence.
4. Assign a BlueSynthBuilder with a slider/knob and start regular playback. Drag the control rapidly through at least three values before releasing; confirm the sound follows continuously, the editor remains visible, and no changed-elsewhere message appears. Repeat while Blue Live is running.
5. While either engine is active, apply several presets and confirm every addressed parameter changes without restart; leave the final control/preset value selected, close and reopen the editor, and confirm that final value persisted.
6. Change an unrelated project property during a Track instrument edit and confirm the edit rebases to the new project revision without losing the change or closing the editor.
7. Copy the instrument, create/select another Track, and Paste. Edit the second copy and verify the first Track is unchanged.
8. Cut the second instrument and verify capture succeeds before the Track clears.
9. Drag a Unified Instrument Library item onto the first Track's control and verify valid replacement feedback and an independent copy; if its old editor is open, confirm that editor closes before the replacement becomes editable.
10. Drag a SoundObject/effect item onto the control and verify invalid feedback and no project mutation.

Expected: all assignment paths create independent Track-owned instruments, menu enablement is correct, rapid runtime controls are immediate while durable values remain ordered and persistent, revision recovery is invisible, and stale/removal/replacement/project-switch cases do not leave an editor attached to invalid state.

Confirm the right-click menu is exactly `Use New Instrument`, separator, `Cut`, `Copy`, `Paste`; there are no extra Edit/Clear items. Also verify PolyObject is unavailable for Track creation and that PolyObject paste, drag, and cross-group move attempts leave both source and destination unchanged.

## 5. CSD p1 and processing order

1. Assign an instrument whose authored Orchestra text is easy to identify.
2. Add a PianoRoll with notes authored for p1 `1`, `1.25`, and `-1.25` where supported by the editor/fixture.
3. Add an object-level processor that changes another p-field, a Track processor that intentionally changes p1, and a root Score processor that changes a later p-field.
4. Compile both synchronous and asynchronous CSD paths using the fixture harness.
5. Inspect generated instrument definitions and score events.

Expected:

- the Track instrument is compiled exactly once and contributes its UDO/ftable/global/automation/string dependencies;
- eligible events become the Track runtime ID with fractional/sign semantics preserved before the Track processor;
- Track processor effects occur after assignment and root Score processor effects occur last;
- authored PianoRoll p1 remains unchanged after compile;
- sync and async outputs agree for the deterministic fixture.

### Nonzero render-start check

1. Place equivalent PianoRoll notes at score beat 16 in a Track and in a SoundObject Layer.
2. Set the render range to begin at beat 16 and compile through both synchronous and asynchronous paths.
3. Add an AudioClip beginning at beat 16 to the Track fixture.

Expected: both PianoRoll paths emit their first event at performance time 0 with identical relative times, and the AudioClip event also begins at 0 without a second translation.

## 6. Special events and shared routing

1. On the same Track, add an AudioClip, Sound SoundObject, FrozenSoundObject fixture, and PianoRoll.
2. Enable the mixer and put an obvious level/effect/send on the Track source channel.
3. Compile and, where runtime assets are valid, audition playback.

Expected:

- PianoRoll musical notes target the assigned Track instrument;
- AudioClip uses the Track audio playback instrument;
- Sound and FrozenSoundObject retain their self-generated instrument p1 values;
- all mixer-aware sources write to the same Track-associated channel and follow its routing;
- disabling the mixer still yields valid legacy raw/master output behavior.

## 7. Historical Audio Layer migration

For each Java and TypeScript fixture:

1. Record Audio Layer Group/layer names, IDs, order, height, mute/solo, AudioClip fields, parameter IDs, and mixer channel state.
2. Open the historical project.
3. Confirm every Audio Layer Group appears as Track Layer Group and every Audio Layer appears as Track, with no assigned instrument.
4. Compile/audition the project and compare audio behavior and routing.
5. Save to a new file, inspect XML, reopen it, and repeat the property comparison.

Expected:

- covered properties are retained exactly;
- mixer effects, sends, levels, automation, and routing remain associated;
- saved XML contains `trackLayerGroup`/`track` and no `audioLayerGroup`/`audioLayer`;
- reopening does not run a second conversion or create duplicate mixer channels.

## 8. Reconciliation and scale

1. Add, rename, reorder, and remove Tracks repeatedly while retaining effects/sends on several source channels.
2. Trigger at least 100 snapshot/reconciliation cycles in the automated fixture.
3. Run the automated 1,000-item fixture and confirm the asserted item/property visit bounds are linear and generation is invoked exactly once per item.
4. Create equivalent 1,000-item mixed Track and SoundObject-layer workloads. Warm each operation once, then record five selection, move, and compile runs for each workload.

Expected: every live Track has exactly one associated channel; when duplicate associations are repaired, the first canonical channel and its effects/routing state survive; no removed Track channel remains. The Track median for each measured operation is no more than 2× the equivalent SoundObject-layer median, no measured interaction exceeds 100 ms on the validation machine, and automated work counters remain linear.

## 9. Manual Electron smoke test

Run sections 2–8 in a packaged or development Electron window with a real audio file and historical fixtures. Capture the Track menu/header, floating always-on-top editor lifecycle (including main-window interaction), migration XML, and generated CSD evidence before marking T063 complete.

Verify that NotationObject is absent from public/registered authoring choices. This is intentional: it was never released as a supported Java Blue feature and its TypeScript implementation was incomplete.

**Result (2026-08-05)**: The project owner confirmed that the accumulated manual testing was sufficient to accept the desktop workflow and move the feature forward. T063 is complete.

## Evidence to retain

- Focused test output and affected build output.
- Before/after XML excerpt or fixture assertion for migration.
- Generated CSD assertions showing Track instrument definition, eligible p1 values, preserved special p1 values, and channel variables.
- Paired Track/SoundObject-layer sync/async assertions showing nonzero render-start translation and the AudioClip double-rebase guard.
- Renderer test or screenshot for the Track header control/menu and mixed timeline.
- Renderer test or recording for modifier-click Track paste, stable PianoRoll editor scroll, no Loading flash, successive Set Color updates in both timeline types, above/below row-safe placement, and persistent shared color controls.
- Electron test or manual result for the non-modal, always-on-top editor lifecycle and continued main-window input.
- Focused burst-control evidence showing three immediate Track runtime messages, one durable request in flight, a coalesced final durable value, stale-revision retry, and no changed-elsewhere state.
- Five-run warmed Track-versus-SoundObject performance medians and the validation machine description.
