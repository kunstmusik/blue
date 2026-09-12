---

description: "Implementation tasks for mixer channel strip layout and fader taper"
---

# Tasks: Mixer Channel Strip Layout and Fader Taper

**Status**: Complete — all tasks implemented and validated

**Input**: Design documents from `specs/107-channel-strip-layout/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Verification**: Constitution-required renderer, browser, IPC/runtime, project-history, compatibility, and quickstart evidence is included below.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an incomplete task
- **[Story]**: Maps the task to a user story from `spec.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the implementation baseline and reusable test surfaces without adding dependencies or persistent schema.

- [X] T001 Record the Java `ChannelPanel` gain mapping baseline and the approved TypeScript taper divergence in `specs/107-channel-strip-layout/research.md`, verifying `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/ChannelPanel.java` remains the cited compatibility reference
- [X] T002 [P] Inventory the existing strip, meter, routing, history-settlement, patch-flush, and runtime-reconciliation seams and record any source-path corrections in `specs/107-channel-strip-layout/plan.md`
- [X] T003 [P] Prepare reusable channel/profile/telemetry/long-route test fixtures for ordinary, subchannel, master, mono, stereo, and maximum-width multichannel cases in `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx` and `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared typed boundaries and geometry used by both P1 stories.

**Critical**: Complete this phase before user-story implementation.

- [X] T004 Define the serializable `preview | finish | cancel` mixer lifecycle union and typed applied/rejected result, including nonempty `documentId`, `channelId`, `gestureId`, sender-monotonic nonnegative integer `gestureSequence`, nonnegative `baseRevision`, and preview-only finite `level` in `[-96,12]`, in `packages/blue-app/src/shared/project-editor/contract.ts`
- [X] T005 [P] Expose the exact shared mixer preview request/result contract through `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T006 [P] Implement shared meter track geometry (`trackTop=10`, `trackBottom=H-10`, `trackHeight=H-20`) and deterministic major-label selection that prioritizes profile zero, floor, ceiling, then remaining values high-to-low with at least 2 logical pixels between text boxes in `packages/blue-app/src/renderer/components/workbench/panels/mixer/meter-layout.ts`
- [X] T007 [P] Add pure meter geometry/label tests for all five profiles and 60/120/240-pixel heights, including fixed reference positions, zero/floor retention, collision removal, sorting, and ceiling/clip independence, in `packages/blue-app/src/renderer/tests/meter-layout.test.ts`
- [X] T008 Route the existing `send-mixer-realtime-level-update` handler through a thin mixer-specific delegate without adding an engine protocol or renderer engine access in `packages/blue-app/src/main/main.ts`

**Checkpoint**: Typed lifecycle and shared meter geometry are ready for story work.

---

## Phase 3: User Story 1 — Read Each Channel's Signal Level Locally (Priority: P1) 🎯 MVP Part 1

**Goal**: Give every enabled strip a local, profile-correct numeric ruler beside unchanged meter bars and remove the panel-global ruler.

**Independent Test**: Render at least 20 ordinary/subchannel/master strips, scroll to the far end, and verify each enabled mono/stereo/multichannel meter is readable locally across all five profiles; at 60/120/240 pixels and 100%/200% scale labels remain within one logical pixel of the actual track and never overlap, while disabling meters removes all meter-only content.

### Verification for User Story 1

- [X] T009 [P] [US1] Add component regressions for per-strip ruler presence, global-ruler removal, five-profile changes, enabled/disabled meters, held-peak visibility, and master/subchannel coverage in `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx` and `packages/blue-app/src/renderer/tests/mixer-meter-popout.test.tsx`
- [X] T010 [P] [US1] Add real-browser geometry coverage for 20-strip scrolling, 60/120/240-pixel controls, 100%/200% scale, docked/detached views, actual font rectangles, <=1 logical-pixel reference alignment, mono/stereo/up-to-36-pixel meter widths, and overflow reachability in `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx`
- [X] T011 [P] [US1] Extend canvas regressions to prove shared 10-pixel track insets preserve bar widths, clip boxes, reference mapping, absent telemetry, silence/below-floor/over-range behavior, and held-peak dBFS semantics in `packages/blue-app/src/renderer/tests/meter-canvas.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Make `MeterCanvas` consume the shared track geometry without changing measurement, colors, hold/clip behavior, channel widths, animation, or visibility throttling in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterCanvas.tsx`
- [X] T013 [US1] Repurpose `MeterScaleRuler` as a local meter-only ruler driven by `profileKey`, exact meter height, and measured subheadline line height; keep labels static semantic content with monospaced numerals and accessible dBFS/K-reference context in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MeterScaleRuler.tsx`
- [X] T014 [US1] Place the ruler beside each enabled strip meter under the existing meter context-menu trigger, hide ruler/bars/held peak together when meters are disabled, and preserve separate bars for every supported channel count in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [X] T015 [US1] Remove the panel-global ruler and its header/chain/output spacers while preserving ordinary, grouped, subchannel, master, docked, and detached strip layout in `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`
- [X] T016 [US1] Apply the 88-pixel budget—1-pixel border, 2 pixels combined padding, 24-pixel fader, 2-pixel gap, and 59-pixel meter/label region containing 22-pixel labels, 1-pixel gap, and 36-pixel bar allocation—without shrinking current meter widths in `packages/blue-app/src/renderer/styles/index.css`
- [X] T017 [US1] Verify local labels do not subscribe to telemetry and retain the existing 64-strip metering threshold of at most 20% regression relative to its non-metering baseline in `packages/blue-app/src/renderer/browser/mixer-metering.browser.test.tsx`

**Checkpoint**: User Story 1 is independently usable and testable with no gain or routing redesign required.

---

## Phase 4: User Story 2 — Adjust Gain With a Clear and Stable Fader (Priority: P1) 🎯 MVP Part 2

**Goal**: Provide a rectangular, accessible fader using the fixed cubic-in-dB taper, transient runtime previews, and exactly one canonical history commit per changed drag.

**Independent Test**: Verify taper anchors and inverse accuracy, then edit a precise gain by pointer, keyboard, numeric entry, and reset during playback; profile changes do not move the fader, release creates one `Set Channel Level` entry, undo/redo restores identities/dirty/runtime state, and cancellation/no-change/failed settlement creates none.

### Verification for User Story 2

- [X] T018 [P] [US2] Add pure taper tests for exact endpoints, contract anchor fractions, clamping/fallback, strict monotonicity over 0.01 dB samples, unrounded inverse error <=1e-6 dB, 49.3948% travel for `-20..+6 dB`, unity at approximately 0.702332, and continuous unity sensitivity in `packages/blue-app/src/renderer/tests/fader-taper.test.ts`
- [X] T019 [P] [US2] Add slider interaction tests for dB-valued accessibility, 0.1 dB arrows, 1 dB Shift/Page keys, Home/End, exact 0 dB reset, finite numeric validation/clamping, Enter/blur de-duplication, Escape, relative primary-pointer dragging, owner-document capture, resizing/unmount/blur/lost-capture cancellation, exact return-to-start, and temporary settlement disablement in `packages/blue-app/src/renderer/tests/mixer-level-slider.test.tsx`
- [X] T020 [P] [US2] Add main adapter contract tests for shape/range/document/channel/revision validation, sender ownership, competing gestures, sender sequence high-water marks, terminal idempotence, delayed preview rejection, queue draining, newer-canonical restoration, destroyed senders, document replacement, and performance-generation replacement in `packages/blue-app/src/main/mixer-gain-preview.test.ts`
- [X] T021 [P] [US2] Extend runtime tests for preview success/failure/restart-required outcomes, no-engine success, ordered finish/cancel reconciliation, automated-gain resumption, and prevention of writes into replaced projects or performances in `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`
- [X] T022 [P] [US2] Add focused writer/history coverage proving many previews leave canonical gain/history/dirty state unchanged; one release yields one `Set Channel Level` patch; no movement, no net change, cancellation, and commit rejection yield none; and commit→undo→redo preserves channel/parameter identities, automation points/interpolation, snapshots, canonical publication, dirty baseline, and runtime gain in `packages/blue-app/src/main/project-history-writer-audit.test.ts`
- [X] T023 [P] [US2] Add browser checks for a 22-by-10-pixel cap, 24-by-24 target, endpoint centers at 12 and `H-12`, visible unity tick, focus at 100%/200%, fixed cap position across profiles, and docked/detached pointer behavior in `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx`
- [X] T024 [P] [US2] Extend compatibility fixtures to prove rendering the new UI does not change `.blue` gain, unknown data, parameter identities/points, or generated CSD, and that intermediate automation evaluations retain existing interpolation, in `packages/blue-data/src/blue-data-csd-parity.test.ts` and `packages/blue-data/src/blue-data-csd-automation.test.ts`

### Implementation for User Story 2

- [X] T025 [P] [US2] Implement `gainDbToFraction(g)=((g+96)/108)^3` and `fractionToGainDb(p)=108*cbrt(p)-96` as dependency-free pure display conversions with finite `[-96,12]` and `[0,1]` boundaries in `packages/blue-app/src/renderer/components/workbench/panels/mixer/fader-taper.ts`
- [X] T026 [US2] Implement the narrow main-owned gesture adapter with injected document/channel lookup, active sender/channel ownership, bounded sender sequence high-water state, existing reconciliation queues, revision/generation fences, and canonical restoration in `packages/blue-app/src/main/mixer-gain-preview.ts`
- [X] T027 [US2] Implement `MixerLevelSlider` with canonical `levelDb`, local disposable draft, rectangular cap/unity geometry, direct-dB keyboard/numeric/reset edits, relative pointer candidates rounded only to 0.01 dB, and complete owner-document cleanup in `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerLevelSlider.tsx`
- [X] T028 [US2] Integrate slider previews and terminal acknowledgements so finish closes/drains before one typed gain patch, `flushPendingPatches` and canonical settlement are awaited, and a final cancel/reconcile runs in `finally` without fabricating restoration edits in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` and `packages/blue-app/src/renderer/stores/project-store.ts`
- [X] T029 [US2] Register each active slider against its actual host document so history settlement cancels and awaits preview restoration before undo/redo, without manufacturing a completed gain edit, in `packages/blue-app/src/renderer/lib/history-scope-router.ts` and `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`
- [X] T030 [US2] Style the 24-pixel fader column, 22-by-10-pixel cap and center line, visible unity tick, focus treatment, gain readout, 60-pixel minimum height, and centered meters-disabled layout using existing semantic tokens in `packages/blue-app/src/renderer/styles/index.css`

**Checkpoint**: User Story 2 is independently usable and all durable gain changes remain canonical and undoable.

---

## Phase 5: User Story 3 — Route Outputs in One Compact Row (Priority: P2)

**Goal**: Replace the separate Output heading with one accessible arrow-plus-selector row and give the released height to the level control.

**Independent Test**: On ordinary and subchannel strips, operate short, long, and invalid destinations by pointer and keyboard, verify the full name/warning remains discoverable and commit→undo→redo behavior is unchanged; confirm master has no selector and routable strips gain at least one former heading line without shrinking either 50-pixel effect list.

### Verification for User Story 3

- [X] T031 [P] [US3] Add component tests for the decorative non-focusable 12-pixel arrow, `Output for <channel name>` selector name, full selected destination, invalid-route warning, keyboard operation, master omission, and unchanged `Set Channel Output` mutation semantics in `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`
- [X] T032 [P] [US3] Add browser geometry tests proving one output row stays within 88 pixels for long names/warnings, level controls gain at least the removed heading line, pre/post lists remain 50 pixels, and menus/focus do not obscure gain or meter labels in `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx`
- [X] T033 [P] [US3] Extend project-history regressions for output commit→undo→redo, routing validation, stable identities/references, dirty-state restoration, canonical publication, and runtime reconciliation in `packages/blue-app/src/main/project-history-writer-audit.test.ts`

### Implementation for User Story 3

- [X] T034 [US3] Replace the Output heading with an `aria-hidden` Lucide `ArrowRight` and flexible existing `AppSelect`, preserve warning behavior and master omission, and expose full destination text through title/menu/accessibility in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`
- [X] T035 [US3] Style the output row with a 12-pixel arrow, `min-width:0` shrinking selector, truncation, and warning accommodation; remove the fixed 80-pixel selector width and return the heading height to the flexible level area without changing 50-pixel chain heights in `packages/blue-app/src/renderer/styles/index.css`

**Checkpoint**: User Story 3 is independently usable and preserves the existing routing contract.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate touched durable edits, compatibility, performance, accessibility, and the complete supported matrix.

- [X] T036 [P] Add focused regressions that meter profile/visibility edits retain `Set Meter Profile` and `Enable Meters`/`Disable Meters` labels, no-op behavior, commit→undo→redo, canonical values, dirty state, and presentation reconciliation in `packages/blue-app/src/main/project-history-writer-audit.test.ts` and `packages/blue-app/src/renderer/tests/mixer-panel.test.tsx`
- [X] T037 [P] Verify legacy missing-meter-field defaults and explicit saved preferences remain unchanged with no migration or taper persistence in `packages/blue-data/src/blue-data-csd-parity.test.ts`
- [X] T038 Execute and record every focused app/data/browser command and its result under `specs/107-channel-strip-layout/quickstart.md`, including the unchanged 64-strip performance threshold
- [X] T039 Run app tests, renderer typecheck, main/preload/renderer builds, repository tests, lint, and `git diff --check`, recording any scoped exception in `specs/107-channel-strip-layout/quickstart.md`
- [X] T040 Perform the interactive quickstart matrix for local meters, taper feel, playback previews, cancellation, history, automation, compact routing, docked/detached windows, 100%/200% scaling, and old projects, recording evidence or a specific unsupported-environment note in `specs/107-channel-strip-layout/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks both P1 stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; does not depend on User Story 2 or 3.
- **User Story 2 (Phase 4)**: Depends on Foundational; can proceed in parallel with User Story 1 after coordinating shared `ChannelStrip.tsx`, `MixerPanel.tsx`, browser-test, and stylesheet edits.
- **User Story 3 (Phase 5)**: Depends on Foundational; functionally independent, but should follow shared `ChannelStrip.tsx` and stylesheet edits when implemented by one developer.
- **Polish (Phase 6)**: Depends on every story selected for release.

### User Story Completion Order

```text
Setup -> Foundational -> US1 (P1 local meters) ----\
                      -> US2 (P1 stable fader) -----+-> Polish
                      -> US3 (P2 compact routing) --/
```

US1 and US2 together form the recommended P1 MVP. US3 can ship afterward without changing either story's independent acceptance test.

### Within Each User Story

- Add the story's required regression/contract evidence before or alongside implementation.
- Implement pure models/geometry before components, components before integration, and integration before browser validation.
- Keep disposable preview/layout state out of `.blue`; route every durable edit through typed patches and `ProjectHistory`.
- For gain gestures, finish/drain previews before the one final patch, flush and settle canonical state, then reconcile in `finally`.

## Parallel Execution Examples

### User Story 1

```text
Parallel: T009 component regressions | T010 browser geometry | T011 canvas regressions
Then: T012 shared canvas geometry -> T013 local ruler -> T014 strip integration -> T015 global removal -> T016 layout budget
Finally: T017 performance gate
```

### User Story 2

```text
Parallel: T018 taper tests | T019 slider tests | T020 adapter tests | T021 runtime tests | T022 history tests | T023 browser geometry | T024 data compatibility
Parallel after tests define contracts: T025 pure taper | T026 main adapter
Then: T027 slider -> T028 commit integration -> T029 history settlement -> T030 styling
```

### User Story 3

```text
Parallel: T031 component/accessibility tests | T032 browser geometry | T033 history/runtime tests
Then: T034 compact row integration -> T035 layout styling
```

## Implementation Strategy

### MVP First (Both P1 Stories)

1. Complete Setup and Foundational phases.
2. Complete and independently validate US1.
3. Complete and independently validate US2.
4. Run the Phase 6 checks relevant to US1 and US2.
5. Stop and evaluate the local-meter plus stable-fader MVP before adding P2 routing polish.

### Incremental Delivery

1. Deliver local per-strip meter readability without changing gain behavior.
2. Deliver the fixed taper and lifecycle-safe gain interaction without changing stored/automated semantics.
3. Deliver the compact output row while preserving routing behavior.
4. Complete the cross-cutting compatibility, performance, build, and manual matrix.

## Notes

- No new dependency, persistent field, migration, taper setting, Java helper change, or native engine protocol change is in scope.
- Tasks marked `[P]` touch independent files or can begin from a shared contract; coordinate files explicitly named by multiple stories before parallel edits.
- Do not update compatibility fixture expectations to reflect display positions: saved dB, automation interpolation, and generated CSD/audio must remain unchanged.
- Every checklist item contains an execution-order ID and a concrete repository or reference file path.
