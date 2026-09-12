# Implementation Plan: Mixer Channel Strip Layout and Fader Taper

**Branch**: `codex/107-channel-strip-layout` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Status**: Complete — implementation and validation finished

**Input**: Feature specification from `specs/107-channel-strip-layout/spec.md`, including the project owner's approved taper change.

## Summary

Make each 88-pixel strip independently readable, with local meter labels, more horizontal space for meter plus labels, a rectangular fader cap, and one compact output row. Use one fixed cubic-in-dB fader mapping: `p=((gainDb+96)/108)^3`, inverse `gainDb=108*cbrt(p)-96`. Unity is at 70.2332% of upward travel; -20..+6 dB occupies 49.3948%. Meter profiles remain independent.

Keep gain, automation interpolation, .blue serialization, and CSD semantics unchanged. Pointer movement previews locally and through existing main-owned runtime reconciliation; release commits one typed mixer patch. Explicit preview completion/cancellation closes the gesture before restoring or committing runtime values. No taper settings, migrations, dependencies, or native engine protocol changes.

## Technical Context

**Language/Version**: TypeScript 5.8-compatible strict project configuration; React 19.2; existing Electron 35.7 runtime.

**Primary Dependencies**: Existing React, Radix AppSelect/context menus, Lucide React, Zustand, canvas, and host-document utilities. Use standard Math operations for taper; no new dependency.

**Storage**: Existing main-owned BlueData/.blue gain, automation, routing, and meter preferences. New geometry, normalized positions, and gesture previews are disposable. No persistent schema changes.

**Testing**: Vitest 4 package tests; existing Playwright-backed Vitest browser configuration with installed Chrome; existing project-history/runtime tests and Java-compatible data fixtures.

**Target Platform**: Electron desktop on macOS, Windows, Linux; docked and detached mixer documents, 100%/200% display scale.

**Project Type**: Desktop application with a host-neutral data package, typed preload/IPC, and isolated native audio engine.

**Performance Goals**: Labels do not subscribe to telemetry or rerender per meter frame. Retain existing canvas animation/visibility throttling and the existing 64-strip metering performance gate (at most 20% regression relative to its non-metering baseline). One durable commit per completed drag.

**Constraints**: 88-pixel strip; 60-pixel minimum level-control height; 24-by-24 minimum pointer target; finite -96..+12 dB; unrounded mapping inverse error <=1e-6 dB; label alignment within one logical pixel. Existing meter widths, effect-chain heights, gain numerics, and profile meanings retained.

**Scale/Scope**: Ordinary, grouped, subchannel, and master strips; five meter profiles; mono/stereo/multichannel up to existing supported limits. Production work primarily in @blue/app renderer with a narrow typed preview-lifecycle extension in main/shared/preload. @blue/data receives compatibility tests only.

## Constitution Check

_Initial gate evaluated before selecting the design; re-evaluated after Phase 1. Both pass._

| Gate                              | Before research                                                               | After design and evidence                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portable data core                | PASS: taper and UI geometry belong to renderer                                | PASS: no host imports or production changes in @blue/data; compatibility tests exercise existing models                                                                                                |
| Java and project compatibility    | PASS: Java ChannelPanel inspected; taper divergence authorized by owner       | PASS: spec explicitly authorizes the fixed taper/keyboard divergence; finite dB storage, automation, .blue and CSD remain unchanged; deterministic curve and parity tests required                     |
| Canonical ownership and contracts | PASS: BlueData remains project owner; preview is disposable                   | PASS: contracts define dB-only patches and document/gesture-fenced preview IPC; no new persistence or migration                                                                                        |
| Project history and undo/redo     | PASS: all durable gain/routing/profile/visibility edits retain ProjectHistory | PASS: final gain uses existing updateChannel patch and “Set Channel Level”; preview cancellation restores current canonical runtime state; no-op/commit/undo/redo/identity/dirty-state tests specified |
| Runtime and engine isolation      | PASS: main continues to own playback and native access                        | PASS: reuse ProjectRuntimeReconciliation and existing engine channel bindings; renderer sends serializable dB/lifecycle messages only                                                                  |
| Host-path portability             | N/A: no runtime path handling changes                                         | N/A: no path normalization or filesystem behavior introduced; ordinary Windows UI validation remains in scope                                                                                          |
| Verification evidence             | PASS: focused renderer, history, browser, and data fixtures identified        | PASS: quickstart gives package, type, build, lint, browser, compatibility, and manual validation with expected outcomes                                                                                |

No constitutional exception is needed: Principle II permits documented, tested intentional divergence. The user's explicit preference supplies the product decision; preserving Java's visual taper is not required.

## Project Structure

### Documentation (this feature)

```text
specs/107-channel-strip-layout/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── channel-strip-ui.md
    └── mixer-gain-preview.md
```

`tasks.md` is the next workflow output and is not generated by this plan.

### Source Code (repository root)

```text
packages/blue-app/src/
├── renderer/components/workbench/panels/
│   ├── MixerPanel.tsx
│   └── mixer/
│       ├── ChannelStrip.tsx
│       ├── MixerLevelSlider.tsx                 # new: bounded gain interaction control
│       ├── fader-taper.ts                       # new: pure conversion pair
│       ├── meter-layout.ts                      # new: shared track/label geometry
│       ├── MeterScaleRuler.tsx                  # repurpose as local ruler
│       ├── MeterCanvas.tsx
│       └── meter-profiles.ts                    # existing profiles unchanged
├── renderer/styles/index.css
├── renderer/lib/history-scope-router.ts         # reuse settlement registration
├── renderer/stores/project-store.ts             # reuse canonical patch queue/flush
├── renderer/types/global.d.ts
├── renderer/tests/
│   ├── fader-taper.test.ts                      # new
│   ├── mixer-level-slider.test.tsx              # new
│   ├── meter-layout.test.ts                     # new
│   ├── mixer-panel.test.tsx
│   └── mixer-meter-popout.test.tsx
├── renderer/browser/
│   ├── channel-strip-layout.browser.test.tsx    # new real geometry/interaction tests
│   └── mixer-metering.browser.test.tsx          # retain existing performance gate
├── shared/project-editor/contract.ts            # typed preview union/result
├── preload/preload.ts
├── main/main.ts                                # thin existing IPC registration/lifecycle wiring
├── main/mixer-gain-preview.ts                   # new narrow adapter for existing endpoint
├── main/mixer-gain-preview.test.ts              # new
├── main/project-runtime-reconciliation.ts       # reuse preview/drain/reconcile facilities
├── main/project-runtime-reconciliation.test.ts
└── main/project-history-writer-audit.test.ts
packages/blue-data/src/
├── mixer/channel.ts                            # reference only
├── blue-data-csd-parity.test.ts
└── blue-data-csd-automation.test.ts
```

**Structure Decision**: Extract only the slider being changed from the large ChannelStrip file. Keep pure taper and shared meter geometry as small local modules; reuse the existing ruler file and existing AppSelect. The new main adapter is specific to mixer preview lifecycle and keeps validation/ordering tests out of main.ts. Do not create a generic fader framework, configurable curve registry, or general preview subsystem.

## Phase 0: Research Results

All questions are resolved in [research.md](research.md). Selected decisions:

1. Cubic mapping meets the measurable working-band allocation and smooth-unity goals without tables or interpolation dependencies.
2. Keep -96 dB finite; direct numeric values and existing automation never pass through the curve on save or playback.
3. Use direct dB keyboard input and local pointer previews. Final edits retain canonical typed patches and semantic history.
4. Existing preview IPC needs an explicit typed lifecycle: current handler already supports main-owned preview and an untyped gesture ID, but cannot safely finish a preview-only drag through history cancellation.
5. Reuse meter profiles and share their actual track geometry with local labels. Use existing typography rather than shrinking text to force all marks into a short strip.
6. Use a 24-pixel fader column and 59-pixel meter/label allocation; use the Output heading's former height for the flexible level area.

## Phase 1: Design

### Gain mapping and interaction

The exact math, anchor positions, rounding boundaries, keyboard behavior, and pointer cap geometry are in [channel-strip-ui.md](contracts/channel-strip-ui.md).

The extracted MixerLevelSlider receives canonical `levelDb` and numeric callbacks for preview, commit, and cancel; it does not synthesize DOM events or know meter profiles. Its accessible range is -96..+12 dB, with `aria-valuenow` in dB and a “gain” accessible name. Use owner-document pointer capture and cleanup for drag, Escape, pointercancel, lost capture, blur, and unmount. A press without movement preserves the exact initial value.

Use a local draft to paint the cap/readout during a drag, preserving canonical ownership. On release, close/drain previews, submit one updateChannel level patch with gesture/field metadata and “Set Channel Level”, flush the existing patch queue, and reconcile against the resulting canonical state. Keep input disabled during final settlement to avoid starting a second gesture over an unacknowledged commit. Numeric editing remains separate from display conversion and must not double-commit on Enter followed by blur.

The current `applyProjectDocumentPatch` enqueues optimistically and returns Promise<void>; awaiting it alone is not acknowledgement. The parent must await `flushPendingPatches` and canonical settlement before dropping pending state. In success or rejection, the terminal reconciliation reads main's current canonical state, not the optimistic renderer snapshot. Existing failure/recovery UI remains authoritative.

### Narrow runtime lifecycle extension

[mixer-gain-preview.md](contracts/mixer-gain-preview.md) defines the messages and ordering. Extend the existing endpoint and its preload/global types rather than adding an engine protocol. Use a narrow main adapter with injected document/channel lookup and existing reconciliation methods. Validate document/revision/channel/finite range, bind the gesture to its originating renderer, and reject late writes to closed gestures.

Register active slider settlement with the existing history scope router for its actual host document. History commands cancel an unfinished drag before executing; they do not manufacture a completed gain edit. On renderer destruction, document replacement, or invalidated ownership, drain/discard previews and restore only the still-current document's canonical runtime state. Existing generation fences prevent preview work from crossing playback restarts.

### Local scales and space allocation

Repurpose MeterScaleRuler to accept `profileKey` and the exact meter height, with zero/floor-first label selection. Remove its panel-global mount from MixerPanel and its header/chain/output spacer elements. Place the local ruler inside each StripMeterArea beside its canvas, under the same meter context-menu trigger; the ruler inherits clear/profile interactions without another tab stop.

Keep the meter track's current 10-pixel top/bottom insets and clip box outside that track. Extract those geometry values and pure label selection into meter-layout.ts, shared with the canvas. Measure the existing subheadline line height when the font/layout changes; use a 2-pixel separation between text bounds. Profile and height changes update labels; signal frames do not.

Use existing semantic color/typography tokens for cap, track, focus, and scale. The dedicated unity mark is tied to the taper function and never to a meter mark. The nominal budget is explicit in the UI contract and must be confirmed by browser geometry, including the widest meter.

Make the output section a one-row flex layout: non-interactive Lucide ArrowRight, shrinking AppSelect, optional warning. Remove the fixed 80-pixel select width and the separate heading. Retain full names through the selector/title and accessible name. No output selector on master. Keep pre/post list heights at 50 pixels; allocate freed vertical space to the level section. If the view is shorter than the content's minimum, preserve reachability through mixer-main's vertical overflow rather than clipping controls in inner wrappers.

### Compatibility and state

[data-model.md](data-model.md) records existing persisted entities and new disposable values. The only durable writes remain the existing gain/routing/profile/visibility patches. Taper is not serialized, and no migration runs. Old projects sound the same and show the new fader positions. Automated curves continue to interpolate their original values in time; do not apply cubic position interpolation.

Data fixture checks compare load/save preservation, unknown fields, parameter identities and points, intermediate automation evaluations, and generated CSD before/after rendering the new UI without input. Runtime checks separately prove edit, cancel, commit, undo, and redo use the intended dB values.

### Validation design

[quickstart.md](quickstart.md) is the runnable guide. Use pure unit checks for the mathematical and label rules; real-browser checks for text bounds, cap targets, pointer behavior, resizing, font metrics, and detached-document geometry. JSDOM snapshots alone cannot establish pixel alignment or usable hit targets. Retain the existing metering performance gate and avoid changing its threshold.

History tests exercise many pointer previews followed by exactly one canonical commit, one-step undo/redo, dirty-state restoration, stable channel/parameter identities, automation preservation, and runtime reconciliation. Fault cases include late previews, invalid values, stale documents/revisions, another view editing gain, engine restart, commit rejection, pointer cancellation, and host-window teardown.

## Post-Design Gate

All Constitution Check rows remain passing. The implementation and validation are complete, with no unresolved design clarification. Native engine and data-model production changes were unnecessary.

## Complexity Tracking

No constitutional violations or approved exceptions. The intentional Java taper divergence is explicitly supported by the constitution's compatibility rule and covered by the spec, contracts, and deterministic tests.
