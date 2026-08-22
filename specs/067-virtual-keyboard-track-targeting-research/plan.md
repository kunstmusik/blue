# Implementation Plan: Focused MIDI Instrument Routing

**Branch**: `067-midi-focus-routing` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/067-virtual-keyboard-track-targeting-research/spec.md`

## Summary

Route hardware and Virtual Keyboard notes through one transient performance-target policy. Focus mode, the new app-session default, targets the last explicitly focused Track or Orchestra assignment. Direct-channel mode preserves the existing channel-indexed Blue Live workflow. The shared renderer router resolves the target at note-on, stores it with held-note state, and aggregates by target identity and pitch before sending an optional typed target through the existing preload/IPC boundary. `BlueData.toBlueLiveCSD()` returns the Track and Orchestra target identities compiled into the disposable CSD; the main-owned Blue Live session installs that catalog atomically and validates every explicit target before submitting target-specific score events. Rejected requests remain typed and testable internally but create no held state, submit no fallback score event, and produce no user-visible error.

## Technical Context

**Language/Version**: TypeScript 5.8.x strict mode; React 19.x; Electron 35.7.5

**Primary Dependencies**: `@blue/data` `BlueData`/`Score`/`Track`/`Arrangement`/`CompileData`; Zustand 5.x; existing Web MIDI input service; existing Blue Live engine session and `@blue/engine-client` transport; existing Track, Orchestra, and Virtual Keyboard renderer surfaces

**Storage**: No new durable storage. Electron main retains canonical `BlueData`; compiled target catalogs, renderer focus/routing mode, and held-note ledgers are transient. `.blue` XML and `program-settings.json` are unchanged.

**Testing**: Vitest 4.x across `@blue/data` and `@blue/app`, existing jsdom renderer harnesses, focused manual hardware/Blue Engine validation in `quickstart.md`

**Target Platform**: Electron desktop on supported macOS, Windows, and Linux targets; hardware routing depends on the existing Chromium Web MIDI capability and Blue Live requires a working Blue Engine/Csound runtime

**Project Type**: Strict TypeScript monorepo desktop application with portable data library, Electron main/preload boundary, and React renderer

**Performance Goals**: Add no perceptible interaction delay compared with direct-channel routing under normal use; keep target resolution in the existing renderer-router/main-session path with no new transport hop; keep focus changes and target indicators immediate at normal UI rates

**Constraints**: Blue Live must be running for audible note routing; focused requests carry the current Blue Live session ID and main rejects generation mismatches; matching note-off must retain the successful note-on target and generation; failed or stale targets never fall back; no `require()`, dynamic imports, inline import types, Node built-ins, Electron APIs, or DOM-only APIs in `@blue/data`; no project/settings persistence changes; no per-Track arming/filter model

**Scale/Scope**: Multiple enabled MIDI devices and virtual sources; 16 incoming/direct channels; any practical number of Track targets; one active focus target; one compiled target catalog per Blue Live session; note-on/note-off only

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: **PASS** — `@blue/data` only exposes portable render-result target metadata produced from existing `CompileData`; renderer state, IPC, Electron, Web MIDI, and engine access remain in `@blue/app`. All production imports remain static.
- **Java and project compatibility**: **PASS** — Java `VirtualKeyboardPanel`, `VirtualKeyboardTopComponent`, `MidiInputEngine`, and current Specs 033/058 define preserved channel, key/velocity, and cleanup behavior. Focus is an intentional TypeScript divergence for post-Java Track instruments and is named in the spec. `.blue` XML, Orchestra assignments, MIDI processor data, and generated authored project state are unchanged.
- **Canonical ownership and contracts**: **PASS** — Electron main owns `BlueData`, the active Blue Live session ID, and the compiled target catalog; the primary renderer's dedicated MIDI routing store owns transient mode/focus; `MidiNoteRouter` owns held notes and aggregation; the optional serializable request target and session fence are validated in main. Project replacement clears focus and held notes. Blue Live lifecycle changes clear held notes and replace the catalog while preserving renderer focus for current-project reconciliation.
- **Runtime and engine isolation**: **PASS** — only Electron main turns validated targets into score text and submits it through the existing Blue Live engine client. Renderer and `@blue/data` do not access engine-native state, files, or processes.
- **Verification evidence**: **PASS** — the design requires data-generation tests for the compiled catalog, shared contract/fail-closed tests, router target-lifecycle tests, Track/Orchestra focus UI tests, Virtual Keyboard/hardware parity and cleanup tests, focus-preserving Blue Live restart tests, main-session target validation tests, a qualitative direct-channel/focus latency comparison, the deterministic hardware quickstart, affected package tests/builds, and repository lint/build verification.

### Post-design re-check

The Phase 1 data model and contract preserve every gate. The only new portable-data output is disposable compilation metadata; the contract keeps target resolution session-fenced, serializable, fail-closed, and main-owned at the engine boundary. Internal failure results remain explicit for validation while the specification's silent-rejection rule prevents a renderer diagnostic from being published. Focus, held-note state, and the compiled catalog retain separate owners and lifetimes. No complexity exception or constitutional waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/067-virtual-keyboard-track-targeting-research/
├── checklists/requirements.md
├── contracts/midi-focus-routing.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── blue-data.ts
├── blue-live-csd.test.ts
├── compile-data.ts
└── score/track/track-instrument-csd.test.ts

packages/blue-app/src/
├── shared/
│   ├── midi-input.ts
│   └── project-editor.ts
├── main/
│   └── blue-live-engine.ts
├── preload/
│   └── preload.ts
└── renderer/
    ├── components/workbench/panels/
    │   ├── OrchestraPanel.tsx
    │   ├── VirtualKeyboardPanel.tsx
    │   ├── ScorePanel.tsx
    │   ├── orchestra/ArrangementPanel.tsx
    │   └── score/layer-groups/TrackLayerGroupCanvas.tsx
    ├── hooks/use-midi-input-service.ts
    ├── services/midi-note-router.ts
    ├── stores/midi-routing-store.ts
    ├── types/global.d.ts
    └── tests/
        ├── blue-live-engine.test.ts
        ├── blue-live-hardware-parity.test.ts
        ├── midi-input-lifecycle.test.tsx
        ├── midi-note-router.test.ts
        ├── midi-routing-store.test.ts
        ├── orchestra-arrangement.test.tsx
        ├── track-layer-group-canvas.test.tsx
        └── virtual-keyboard-panel.test.tsx
```

**Structure Decision**: Extend the existing portable CSD render result, shared app contracts, renderer MIDI ingress, and main Blue Live session in place. One narrow renderer store owns mode/focus; no new package, service process, database, persistence adapter, or duplicated MIDI path is introduced.

## Complexity Tracking

No Constitution Check violations or justified complexity exceptions.

## Post-implementation review (T041)

Reviewed the implementation against `spec.md`, `contracts/midi-focus-routing.md`, the
Java channel behavior recorded in `research.md` §9, Specs 033/058/066, and the
constitution. No unapproved divergences; all FRs are covered by the implemented paths
and the focused + full test suites.

Confirmed coverage of the functional requirements:

- FR-001/FR-002: one shared routing mode (`MidiRoutingMode`) with `focus` default,
  applied to both hardware and the Virtual Keyboard through the single
  `MidiNoteRouter` ingress and `resolveTarget` bound in `use-midi-input-service.ts`.
- FR-003 through FR-010: explicit Track focus (`ScorePanel` row header,
  `TrackLayerGroupCanvas` timeline, `TrackInstrumentControl`) and Orchestra focus
  (`ArrangementPanel` explicit row click) update `MidiRoutingStore`; main resolves by
  stable identity through the compiled catalog, not row position or channel.
- FR-011: `BlueData.toBlueLiveCSD()` returns the catalog from the same disposable
  snapshot; nothing is written into the project document.
- FR-012: unresolved/disabled/stale targets fail closed with typed internal results
  and no user-visible diagnostic, no fallback score event, no held-note state.
- FR-013 through FR-016: held notes retain their resolved target and session id;
  aggregates are keyed by `(targetKey, midiNote)`; source idempotence and multi-source
  reference counting are preserved.
- FR-017: source/device/project/shutdown cleanup releases held notes; Blue Live
  stop/restart clears held notes and the catalog but preserves focus.
- FR-018 through FR-020: Direct Channel mode retains the one-based selector, native
  hardware channel, and existing assignment behavior; unmapped channels fail closed.
- FR-021: project MIDI pitch/velocity mapping is applied identically after target
  resolution in `triggerNote`.
- FR-022 through FR-025: routing state is transient; project replacement clears focus
  and held notes; recompile replaces the catalog atomically; failed/stale/malformed
  targets submit no wrong-instrument score event.
- FR-026: existing non-note deferrals, device preferences, octave/velocity behavior,
  project MIDI mapping, and Blue Live start/stop are unchanged except where target
  selection is explicitly defined.
- FR-028/FR-029: automated verification and the deterministic manual quickstart cover
  Track focus, Orchestra focus, direct-channel compatibility, target-specific
  aggregation, note-off stability, catalog lifecycle, invalid-target failures, and
  project/session cleanup.

No complexity exception or constitutional waiver is required.

## Completion audit (T042–T044)

The final cross-artifact and code audit found one implementation gap: a named Orchestra
runtime target reached score generation as its string ID instead of the numeric
instrument number assigned by the running engine. The main Blue Live boundary now
normalizes that ID through the active compiled catalog before score submission. Focused
regressions also close the previously implicit coverage for shared Orchestra input,
cross-kind retained note release, target-independent project MIDI mapping, and the exact
Track focus/non-focus surfaces.

All 44 tasks are complete. The focused Spec 067 suites, complete `@blue/data` and
`@blue/app` suites, affected package builds, repository lint, and repository build pass.
The project owner's manual hardware/listening report closes the remaining qualitative
T039 observations. No approved divergence, complexity exception, persistence change, or
constitutional waiver remains.
