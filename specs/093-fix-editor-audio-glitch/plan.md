# Implementation Plan: Glitch-Free Track Instrument Editor Opening

**Branch**: `093-fix-editor-audio-glitch` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/093-fix-editor-audio-glitch/spec.md`

## Summary

Establish frame-correlated evidence for audio interruptions caused by opening a
Track instrument editor during rendering, then implement the smallest measured
startup change that reduces avoidable application work. The selected path removes
duplicate snapshot work, makes detached-editor startup progressive, and keeps a
bounded Track-editor shell pool conditional on evidence. The native control-plane
handoff is also hardened: live channel batches now cross a fixed-capacity,
generation-fenced SPSC mailbox instead of a perform-thread mutex/deque. Diagnostics
remain opt-in and bounded, reuse existing engine-state requests, and do not expand
the public engine protocol or shared-memory ABI. The remaining battery-sensitive
stall is at Csound's external AuHAL output boundary, not in this repository's
channel handoff.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode, React 19.2, Electron 35.7;
C++17 for the native channel mailbox and compile-gated engine diagnostics

**Primary Dependencies**: Electron `BrowserWindow`, Vite, Zustand, Vitest,
`@blue/engine-client`, Blue Engine, Csound, and ZeroMQ; no new runtime dependency

**Storage**: No durable feature storage. Project state remains in canonical
`BlueData`; diagnostic JSONL and audio captures are disposable derived artifacts
written to an explicitly selected native directory or the host temporary directory.

**Testing**: Vitest for Electron main/preload/renderer behavior, native CTest for
the channel mailbox and compile-gated engine instrumentation, the Spec 072
`benchmark_engine` guard, and manual packaged-build audio validation on a
qualifying workload

**Target Platform**: Electron desktop on macOS, Windows, and Linux, with the first
controlled reproduction and packaged acceptance run on macOS

**Project Type**: Desktop application with Electron main/preload/renderer layers
and a native C++ audio engine

**Performance Goals**: Zero audible or captured interruptions across 30 accepted
cold-open attempts (10 each for generic text, Blue Synth Builder, and BlueX7);
first usable editor latency, idle CPU, and retained memory no worse than 10% from
the accepted baseline; BlueX7 effective-value observation remains stable for
60 seconds at the existing 20 Hz cadence after the editor is usable.

**Constraints**: Qualify the playback workload before editor-open trials; collect
at least 10 attempts per controlled condition; diagnostics must be opt-in, bounded,
and must not mutate project data, restart/recompile the engine, or add work on the
audio thread; preserve Track/group/instrument identity and use typed, serializable
preload/IPC contracts; validate and resolve channel batches off the perform thread;
and add no new public engine command, capability, or SHM layout.

**Scale/Scope**: Detached Track editors for generic text instruments, Blue Synth
Builder, and BlueX7; cold open, focus-existing, close/reopen, and different-target
sequences; an Effect Interface comparison as a diagnostic control; one qualifying
project/workload with repeated controlled trials and packaged-build acceptance.

## Constitution Check

### Pre-research gate

- **Portable data core**: PASS — the design does not change `@blue/data`; all
  window, diagnostic, filesystem, and runtime-status work stays in `@blue/app` or
  compile-gated native engine code.
- **Java and project compatibility**: PASS/N/A — this is detached Electron UI
  lifecycle work. It does not change `.blue` XML, CSD generation, rendering
  semantics, or Java-defined editor behavior, so no Java divergence is introduced.
- **Canonical ownership and contracts**: PASS — `BlueData` remains the project
  owner, Blue Engine owns runtime audio state, Electron main owns windows and the
  canonical playback/Blue Live status, and each renderer owns only disposable
  editor-session state. Diagnostic records are derived and non-authoritative.
- **Runtime and engine isolation**: PASS — Electron main owns `BrowserWindow`,
  filesystem output, engine-state sampling, and ZeroMQ-facing bridge calls. The
  Track renderer receives only narrow typed preload messages and never imports host
  APIs; the perform-thread mailbox consumer is bounded and lock-free, while timing
  collection is compile-gated and allocation-free in the measured loop.
- **Host-path portability**: PASS — diagnostics use untouched native paths through
  `path`/`os`; any path embedded in exported text is outside this feature. Tests use
  `path.join()`/`os.tmpdir()` and include synthetic Windows-path contract coverage
  if output-directory handling is introduced.
- **Verification evidence**: PASS — focused main/preload/renderer tests, native
  CTest, schema validation, controlled quickstart trials, packaged audio capture,
  affected-package build/tests, full `pnpm test`/`pnpm lint` where appropriate, and
  `git diff --check` are defined below and in [quickstart.md](./quickstart.md).

### Post-design gate

- **Portable data core**: PASS — the Phase 1 contracts add no data-core dependency.
- **Java and project compatibility**: PASS/N/A — the data model explicitly treats
  editor sessions and traces as disposable; canonical project serialization is
  untouched.
- **Canonical ownership and contracts**: PASS —
  [data-model.md](./data-model.md) names every state owner and
  [track-editor-runtime-status.md](./contracts/track-editor-runtime-status.md)
  defines the only new renderer-facing runtime contract.
- **Runtime and engine isolation**: PASS —
  [editor-open-diagnostics.md](./contracts/editor-open-diagnostics.md) keeps frame
  sampling and artifact output in main/native layers and uses the existing engine
  state request rather than exposing a new engine endpoint. The production channel
  handoff uses a bounded mailbox whose consumer performs no locking, allocation,
  string lookup, or Csound API call.
- **Host-path portability**: PASS — only native diagnostic destinations cross the
  filesystem boundary, and their handling is specified as host-native.
- **Verification evidence**: PASS — the JSON trace schema, lifecycle contracts,
  failure/staleness rules, focused automated checks, controlled trial matrix, and
  packaged acceptance gates are concrete and independently verifiable.

## Project Structure

### Documentation (this feature)

```text
specs/093-fix-editor-audio-glitch/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── editor-open-diagnostic.schema.json
│   ├── editor-open-diagnostics.md
│   └── track-editor-runtime-status.md
└── tasks.md                 # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-app/
├── src/main/
│   ├── editor-open-diagnostics.ts                 # new, opt-in coordinator
│   ├── editor-open-diagnostics.test.ts            # new
│   ├── track-instrument-editor-window-manager.ts  # lifecycle/focus/pool seam
│   ├── track-instrument-editor-window-manager.test.ts
│   ├── engine-bridge.ts                           # existing state sample seam
│   └── main.ts                                    # narrow IPC registration
├── src/preload/
│   ├── preload.ts                                  # typed runtime-status bridge
│   └── blue-x7-effective-values.test.ts
├── src/shared/
│   ├── track-instrument-editor-contract.ts         # narrow serializable contract
│   └── track-instrument-editor-contract.test.ts
├── src/renderer/
│   ├── track-instrument-editor.tsx                 # detached renderer entry
│   ├── components/track-instrument-editor/TrackInstrumentEditorPage.tsx
│   ├── components/workbench/panels/orchestra/InstrumentEditorPanel.tsx
│   └── components/instruments/blue-x7/use-blue-x7-effective-values.ts
└── vite.config.ts                                 # detached entry/chunk behavior

native/blue-engine/
├── src/engine/CsoundEngine.cpp                    # mailbox handoff and gap observations
└── tests/                                         # instrumentation regression
```

**Structure Decision**: Keep the change inside the existing Electron application
and native engine seams. Electron main coordinates lifecycle, evidence, and
runtime activity; preload exposes the minimum serializable contract; the Track
renderer progressively activates editor-specific work. Native production code
owns the bounded channel mailbox, while compile-gated diagnostics remain opt-in.
No new package or public engine-client surface is planned.

## Design and Delivery Sequence

1. Add bounded opt-in attempt tracing and budget-relative native scheduling-gap
   evidence, using bracketed existing engine-state samples for correlation.
2. Qualify the playback workload and record no-open, focus-existing, cold shell,
   snapshot, mount, library, BlueX7 readback, and Effect Interface controls.
3. Change Track editor open handling to focus an existing stable identity before
   building a snapshot and let a cold renderer pull the full snapshot exactly once.
4. Make cold startup progressive: mount a lightweight shell, accept the document,
   lazy-load only the requested editor, declare it usable, then initialize optional
   library and BlueX7 observation work.
5. Remove the perform-thread channel mutex/deque handoff. Resolve and validate
   channel pointers on the control side, publish whole batches through the bounded
   generation-fenced SPSC mailbox, and consume at most one batch per k-cycle.
6. If a minimal cold shell remains correlated with interruptions, add one bounded
   Track-only standby shell with generation-safe binding and teardown. Otherwise,
   omit the pool.
7. Retain the smallest candidate that passes the zero-interruption and 10% resource/
   latency gates; remove rejected diagnostic candidates from the shipping path.
8. Run focused tests, native guards, controlled development trials, and packaged
   acceptance; record the final evidence and known platform coverage.

## Requirement Traceability

| Requirement area | Design artifact | Verification |
|---|---|---|
| Causal, frame-correlated evidence | Diagnostics contract and JSON schema | Controlled attempt traces plus captured/audible observation |
| Existing-window focus behavior | Session lifecycle and manager seam | Focus-existing test and controlled condition |
| Single snapshot construction | Session lifecycle and cold-open sequence | Manager/renderer snapshot-count tests |
| Progressive editor readiness | Milestone model and startup sequence | Editor-kind tests and latency trials |
| BlueX7 runtime synchronization | Runtime-status contract | Status, stale-event, and 60-second 20 Hz tests |
| Real-time channel handoff | `RealtimeChannelMailbox` and generation-fenced bindings | Native mailbox, channel-bridge, and automation protocol tests |
| Optional prewarmed shell safety | Conditional session state machine | Binding-generation, failure, teardown, and resource tests |
| No project/audio mutation | Ownership model | Snapshot comparison and uninterrupted engine state checks |
| Performance and audio acceptance | Quickstart matrix | 30 packaged attempts, five resource trials, benchmark guard |

## Complexity Tracking

No constitution violation requires an exception. The deliberately complex
real-time seam is justified by the measured `channelMutex_` violation and is
bounded to a fixed-capacity, generation-fenced SPSC mailbox. The reusable
Track-editor shell remains conditional on evidence that progressive startup alone
cannot meet the audio gate, and is not implemented. Csound AuHAL changes are an
external follow-up because the output module is owned by the Csound dependency.
