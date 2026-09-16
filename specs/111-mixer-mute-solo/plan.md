# Implementation Plan: Mixer Audio Mute and Solo

**Branch**: `codex/mixer-mute-solo` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/111-mixer-mute-solo/spec.md`

## Summary

Add audio mute/solo to instrument, track, and subchannels; master gets Mute only. A pure mixer route policy drives CSD gates, editor indicators, live updates, and conservative disk pruning. Track headers select independent event state or associated channel audio state using a persisted project preference; mixer bypass forces event behavior. Preserve legacy XML, including inactive master solo, and use ProjectHistory for every durable edit.

No product clarification blocks planning. Send-mute conventions vary among DAWs; the selected all-send mute is explicit. Solo works on existing routes and cannot separate signals already summed into a bus. Industry evidence and limits are in [precedents.md](precedents.md).

## Technical Context

**Language/Version**: TypeScript 5.8+ in the strict workspace; generated Csound orchestra. Existing native C++ engine protocol is reused.

**Primary Dependencies**: Existing React 19, Zustand, Electron 35, @rgrove/parse-xml, @blue/engine-client, native Csound engine. No new dependencies.

**Storage**: Canonical .blue XML; one project property, existing channel/track flags. Compiled bindings and runtime acknowledgments are disposable per-performance state.

**Testing**: Vitest data/main tests, browser Playwright-backed Vitest, actual engine integration and deterministic float-audio comparison.

**Target Platform**: Existing macOS, Windows, Linux desktop targets; @blue/data remains host-neutral.

**Project Type**: Desktop application with portable model/CSD library and external engine.

**Performance Goals**: Audio response within 100 ms on the quickstart reference setup; no restart/recompile for M/S; atomic audible publication for both small and large gate sets.

**Constraints**: Existing batch-channel capability, 256 entries per engine batch, generation-scoped bindings; preserve effects order/event compatibility; no project mutation during export.

**Scale/Scope**: All instrument/track/subchannel strips, master mute, timeline and BlueLive performances, synchronous/asynchronous realtime/disk generation. Gate count follows actual output/send routes without a new 256-route project limit.

## Constitution Check

Pre-research and post-design checks both PASS. No exceptions required.

| Gate | Pre-research | Post-design evidence |
| --- | --- | --- |
| Portable data core | PASS: pure policies possible | Detached topology/flags, static imports; host owns transport and file I/O. |
| Java/project compatibility | PASS: intentional audio extension specified | Legacy AudioLayer event filtering retained in Event; missing property loads Event; raw unknown mode and inactive master solo round-trip. |
| Canonical ownership/contracts | PASS: existing document bridge | BlueData owns durable values; typed patches and compiled bindings; renderer never selects runtime symbols. |
| History/undo/redo | PASS: existing patches | Channel M/S, event M/S, mode, mixer enable use semantic ProjectHistory actions with identity/dirty/runtime coverage. No non-undoable exception. |
| Runtime isolation | PASS: batch controls available | Main owns revision/generation queue; existing EngineBridge batch API and capability guards. |
| Host-path portability | PASS: no new path policy | Host fixture path.join/os.tmpdir; existing embedded-text escaping; native Windows integration required before delivery. |
| Verification evidence | PASS: existing harnesses | Route/XML/CSD/history tests, browser controls, real-engine latency and audio equivalence; commands in quickstart. |

Post-design review verifies ignored master solo cannot enter derived solo state; mode edits never overwrite independent flags; failed/stale updates cannot be reported as applied; pruning retains duration and audio gates.

## Project Structure

### Documentation (this feature)

```text
specs/111-mixer-mute-solo/
  spec.md
  precedents.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/mixer-mute-solo.md
  checklists/requirements.md
```

tasks.md belongs to the next phase and is not generated here.

### Source Code (repository root)

```text
packages/blue-data/src/
  mixer/mute-solo-policy.ts                  # new pure route policy
  project-properties.ts                     # mode/raw XML metadata
  blue-data.ts                              # stable render façade/types
  blue-data/{xml-policy,csd-policy}.ts        # compatibility/all render profiles
  score/{score,score-generation-options}.ts
  score/track/track-layer-group.ts
packages/blue-app/src/
  shared/project-editor/{contract,identity,snapshot-mixer-orchestra,
    snapshot-score,patch-mixer-bluelive}.ts
  main/{project-runtime-reconciliation,engine-bridge,blue-live-engine,main}.ts
  main/mixer-mute-solo-runtime.ts            # new gate publication coordinator
  renderer/stores/project-store.ts
  renderer/components/workbench/panels/{ScorePanel,ProjectPropertiesPanel}.tsx
  renderer/components/workbench/panels/mixer/ChannelStrip.tsx
packages/blue-engine-client/src/engine-client.ts   # existing batch contract
native/blue-engine/src/engine/RealtimeChannelMailbox.h # existing batch bounds
```

**Structure Decision**: Two small responsibilities: data route policy and host gate coordinator. Following docs/modularization.md, neither owns durable project state. Data consumes detached topology; host consumes committed intent and compiled bindings. Existing façades remain intact; direct policy/coordinator tests are the lowest test seams. Rollback removes feature wiring and these helpers. No broad extraction of csd-policy.ts, main.ts, or project-store.ts.

## Phase 0 — Research

See [research.md](research.md). Repository and Java inspection covered routing/CSD, history/runtime, and XML/modes; external precedents were researched earlier. All technical unknowns are resolved into explicit decisions, including the batch-size limit, generation identity, summed-bus limits and unpruned duration.

## Phase 1 — Design sequence

1. **Mode/compatibility (FR-007–010, 014–015)**: Add trackLayerMuteSoloMode with missing/invalid XML preservation. Fresh projects use Audio; missing property or properties block loads Event. Expose diagnostics. Preserve but ignore master solo and reject new edits.
2. **Pure routing (FR-001–006)**: Enumerate ordered output/send edges; derive permitted routes from non-master solos/mute. Keep output exclusion separate from send inclusion. Capture canonical editor identity before render cloning.
3. **CSD gates (FR-002–005, 011–012)**: Gate sends at their current taps and final outputs after local effects, before meters. Keep effects/events running. Emit all realtime gate controls, including initially silent routes, across sync/async and BlueLive generation; disk uses the same policy with constant targets.
4. **Live/history (FR-011, 013, 016)**: Add one typed mixer-gates reconciliation operation holding detached desired values. Use existing batch transport, inactive-bank staging above its limit, and applied-token verification. Scope updates to document/revision/performance generation; handle timeline and BlueLive separately. Topology, mode, and mixer-enable remain restart-required.
5. **UI (FR-001, 006–009)**: Non-master M/S, master M; existing patch/history callback. Audio headers address associated channel; Event headers retain layer patches. Explain mode independence and bypass override. Expose saved versus unapplied runtime status.
6. **Disk optimization (FR-012)**: Certify only a small AudioClip-only subset without opaque executable effects/code/processors. Prune tracks with no surviving output path. Preserve duration from shared unpruned scheduling calculations; retain effects/gates. Ambiguous cases remain unpruned.
7. **Validation**: Direct policy/XML tests, commit→undo→redo, UI, both real performance types, deterministic optimized/unoptimized render comparison and failure injection. Commands/scenarios in quickstart.

## Complexity Tracking

No constitution violations. Two-bank publication is justified by the 256-entry engine limit and the need to avoid partial audible solo changes. Independent writes were rejected; a new engine command is unnecessary. No native changes are planned unless verification uncovers an existing batch-contract defect.
