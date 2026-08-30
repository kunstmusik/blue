# Implementation Plan: Modern BlueX7 Engine and Automation

**Branch**: `092-integrate-bluex7-engine` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/092-integrate-bluex7-engine/spec.md`

## Summary

Replace BlueX7's legacy partial Csound renderer with a maintainable, attributed derivative of the reviewed modern `bluex7.orc`, while preserving Blue's project, score, routing, and post-processing contracts. Each BlueX7 owns one stable 151-Parameter catalog. A single catalog drives XML migration, UI labels and domains, voice-to-Csound mapping, automation discovery, live updates, and validation.

The generated CSD includes immutable modern lookup data once per `CompileData` render context, while a TypeScript target generator emits an instance-specialized BlueX7 note instrument. That generated instrument references its resolved `chnexport` globals (`gk_blue_autoN`) directly; the live inline form does not copy values through a 155-slot k-array or ftable. All 136 next-note fields are captured with `i(gk_...)` at note initialization. The 15-control active set (feedback, LFO depths, operator output levels, and operator enables) is read directly only inside an epoch-gated scalar update; eight PEG index/rate values and six output-level baselines are the only current k-rate snapshots. UDOs are an optional generator implementation, not an architectural requirement: benchmark shared-UDO and generated-inline targets, and inline operator topology, envelopes, or other DSP when UDO argument/array transfer measurably harms realtime throughput. Whole-voice batches are queued and applied by Blue Engine between `csoundPerformKsmps` calls so any Csound instrument observes either the old or new complete global set. Electron main resolves durable owner identities and mediates direct live edits, atomic whole-voice batches, and batched effective-value readback through typed preload and versioned Blue Engine contracts. A project-wide, owner-aware Parameter catalog closes the existing Track discovery/runtime-sync gap.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode; React 19.2 and Electron 35.7; Csound orchestra targeting the repository's Csound 7 runtime; C++17 for the Blue Engine protocol extension

**Primary Dependencies**: `@blue/data`, `@blue/app`, `@blue/engine-client`, native `blue-engine`, Csound 7, `@rgrove/parse-xml`, Zustand, ZeroMQ

**Storage**: Canonical `.blue` XML for BlueX7 voice and Parameter metadata; generated CSD, compilation bindings, engine channel values, and renderer readback are disposable derived state

**Testing**: Vitest unit/contract/browser suites, native CTest, deterministic Csound render/reference scripts, and Electron integration/manual stress validation

**Target Platform**: Blue Electron desktop on macOS arm64/x64, Windows x64, and Linux x64 with a local Blue Engine process

**Project Type**: Multi-package Electron desktop application with a portable data/CSD compiler and an external native audio engine

**Performance Goals**: At least 95% of active-note edits effective and visible within 100 ms; open-editor effective values sampled at 20 Hz or faster; automation within one engine control interval plus 50 ms; immutable lookup definitions emitted once per CSD while DSP code layout follows the measured UDO/inlining choice; unchanged live-capable voices no more than 20% slower than the static renderer; the checked dense fixture sustains at least 1.25x realtime compute throughput on the supported development machine; unchanged control derivation does not scale with all 151 Parameters on every active note

**Constraints**: Exactly 151 Parameters per instance; no display-name routing; no fixed instance cap; `chnexport` globals remain the live value source; no live 155-slot transport/table copy or per-cycle Parameter transfer (compact dirty-domain state is permitted for dynamic indexing); atomic whole-voice observation at an engine control boundary; no recompile for live edits; no non-finite or out-of-domain Csound values; automation remains authoritative while enabled

**Scale/Scope**: 151 Parameters per BlueX7, four-instance validated floor spanning two arrangement and two Track owners, the `blue-x7-pop-song.blue` dense case peaking near 59 simultaneous release-inclusive voices, 600 targeted changes over 60 seconds, and all 32 algorithms

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core — PASS**: The catalog, voice projection, XML migration, and TypeScript Csound target generator live in `@blue/data` and use static ES imports only. They contain no Node.js, Electron, DOM, dynamic-import, filesystem, process, or ZeroMQ dependency. Provenance/check scripts stay outside production source.
- **Java and project compatibility — PASS with intentional sonic divergence**: Java BlueX7 sources and existing Java-generated XML fixtures remain the reference for voice ranges, defaults, ordering, CSD score conventions, post code, and unknown-data preservation. The modern renderer intentionally diverges sonically from Pinkston-derived output and is covered as a named migration. Existing voice XML is not normalized on load; a new child `parameterList` is additive and TypeScript round-trips it losslessly. Legacy files without it reconcile from voice values on load.
- **Canonical ownership and contracts — PASS**: `BlueData` in Electron main remains the only durable project owner. A BlueX7 owns its voice and ParameterList in `.blue`; Track/arrangement owner references identify project location. Compilation bindings, generated global/domain symbols, queued engine batches, and effective readback are engine-session state. Renderer display samples are disposable. All mutations use typed project patches; live acceleration and readback use validated typed contracts and never mutate canonical state independently.
- **Runtime and engine isolation — PASS**: Renderer code uses preload only. Electron main owns owner resolution, playback state, atomic update sequencing, and Blue Engine access. `@blue/engine-client` owns the versioned batch-channel protocol; native `blue-engine` owns Csound/shared-memory access. `@blue/data` only emits CSD text and metadata.
- **Host-path portability — PASS/N/A for runtime**: The production feature carries no host paths. The maintenance generator accepts native paths and uses Node `path`/`fs` only under `packages/blue-data/scripts`; embedded provenance records repository-relative POSIX text separately. Tests build temporary paths with `path.join`/`os.tmpdir` and include a synthetic Windows input-path case if the generator exposes a path argument.
- **Verification evidence — PASS**: Focused tests cover the 151-entry catalog, legacy/additive XML round trips, unknown data, identities, generated direct-global bindings, compile-once resources, all algorithms, active/next-note behavior, control-boundary batch atomicity, protocol success/failure, Track discovery, live automation authority/readback, four-instance isolation, release/output safety, accepted reference renders, and relative/static plus Blue Engine throughput gates. Quickstart includes affected package tests/builds, native CTest, repository test/lint, and `git diff --check`.

### Post-design re-check

Phase 1 preserves every gate. The contracts in `contracts/` make durable, session, and engine ownership explicit; `data-model.md` defines migration, copy identity, direct-global compilation, and atomic batch transitions; and `quickstart.md` makes the compatibility, protocol, runtime, browser, stress, and performance evidence runnable. The Csound target generator remains portable code owned by `@blue/data`; the perform-thread batch queue remains inside native Blue Engine. Neither introduces a host dependency into the data core or a second durable owner. Generated-source, atomic-boundary, and dense-fixture tests cover the new seams. No constitution exception is required. The project owner has authorized importing the original precursor work; implementation must still carry the applicable third-party license notices and attribution recorded in Phase 0.

## Phase 0: Research and Decisions

Research is consolidated in [research.md](research.md). Implementation follows these decisions:

1. Import only the reviewed `bluex7.orc` at its pinned digest from the transient `dx7-emulation` precursor, then retain it as the auditable behavioral baseline. Refactor the production renderer into compile-once Csound support plus a browser-safe TypeScript target generator that emits instance-specialized note code. Record precursor revision/digest, subsequent Blue modifications, and relevant third-party attribution/notices; do not depend on or import the precursor ROM, demos, renders, or unrelated tooling.
2. Keep `BlueX7` as the public facade and canonical voice/XML owner. Put the catalog, pure voice projection, shared Csound support, and target generator behind small deep modules under `packages/blue-data/src/instruments/blue-x7/`. The generator interface accepts catalog-resolved symbols/literals and returns complete deterministic Csound text; callers do not assemble DSP fragments.
3. Use one immutable 151-descriptor catalog. Reconcile persisted Parameters by deterministic semantic name, retaining IDs/automation metadata while refreshing domain metadata and fixed values from the canonical voice.
4. Introduce an owner-aware project Parameter catalog that includes arrangement instruments, Track-owned instruments, and mixer Parameters in deterministic order. Reuse it for automation menus, snapshot/patch lookup, compilation-name reconciliation, and live sync.
5. Pass `CompileData` to `Instrument.generateGlobalOrc()` and use a render-scoped compilation-variable key to emit immutable lookup tables once. Generate each instance's note instrument after Parameter compilation names are assigned so the target code contains exact `gk_blue_autoN` references and numeric literals for non-live preview paths. Treat every synthesis UDO as provisional: retain a shared helper only when its measured runtime cost is equivalent to inlining; otherwise generate its body directly into the instance note instrument.
6. Remove both live transport ftables, the generated live target's 155-slot `kLiveVoice[]` projection, the per-note table-write loop, and `chnget`-based value reads. `chnexport` globals are the only live value interface. Capture the 136 next-note fields with `i(gk_...)` into the note's i-rate voice snapshot. Generate direct k-rate global references only for the 15 active controls: feedback, LFO pitch/amplitude depth, six output levels, and six enables. Keep a compact operator projection only as a compatibility fallback for a future active descriptor that needs dynamic indexing.
7. Generate one per-instance coordinator that scans only the 15 active globals and publishes a scalar epoch. An unchanged note then performs no live-state work. On a dirty epoch, the generated inline target updates scalar feedback/LFO/enables directly and applies output-level deltas against six note-local baselines; PEG index/rate arrays remain eight-value snapshots because the maintained body advances them with k-rate indexing. Benchmark shared-UDO versus generated-inline DSP for this strategy. Retain the direct-global inline form when it avoids the 155-slot UDO projection without exceeding the measured CPU budget; otherwise apply the 5% CPU rule (faster passing target first, then smaller/auditable CSD within 5%). Envelope/topology edits are next-note snapshots, while live output/enables preserve note continuity and release safety.
8. Add batch channel get/set to the versioned engine protocol. Main requests only visible controls for open BlueX7 editors and returns one owner- and session-tagged effective-value snapshot at 20 Hz. Stale requests return a safe diagnostic and never fall through to another instance.
9. Establish one documented output calibration factor against a representative corpus. Do not use voice-specific hidden gain. Reject/non-propagate non-finite values and retain existing Blue post-code and mixer/direct-output placement.
10. Generate the Csound preview and binding diagnostics through the same catalog/target-generator seam, listing every modern sound-relevant field and its active-note or next-note class. Publish a migration note that names the intentional sonic change and accepted renderer limitations.
11. Change Blue Engine batch set from validation-only atomicity to musical atomicity: validate and enqueue one immutable batch on the IPC thread, then apply the complete batch on the performance thread between `csoundPerformKsmps` calls. Direct-global readers and newly initialized notes therefore see the old or new complete set without a Csound transport table or hold/republication protocol.
12. Add an inaudible-release fast path after direct-global generation and dirty-domain guards meet their relative gate: continue the k-rate envelope/liveness state machine, but skip the six-operator audio topology while all enabled carrier outputs have a conservative sub-audible upper bound. Resume synthesis if a live edit makes the voice potentially audible before it freezes or reaches the existing cap.
13. Treat Blue Engine channel mirroring as a secondary optimization only. The measured 305-channel mirror cost was about 1.6%; retain it unless the repeatable benchmark exceeds a 5% budget after the Csound hot path is corrected.

## Phase 1: Design and Contracts

- [data-model.md](data-model.md) defines catalog descriptors, persisted Parameters, owner bindings, generated Csound targets, atomic batches, effective-value snapshots, and lifecycle transitions.
- [contracts/blue-x7-parameter-catalog.md](contracts/blue-x7-parameter-catalog.md) defines the 151-entry semantic catalog, reconciliation rules, and 155-slot mapping.
- [contracts/blue-x7-runtime.md](contracts/blue-x7-runtime.md) defines owner-targeted renderer/preload/main messages, authority rules, atomic updates, stale-target behavior, and effective readback.
- [contracts/blue-engine-batch-channels.md](contracts/blue-engine-batch-channels.md) defines the versioned binary batch get/set extension and failure behavior.
- [quickstart.md](quickstart.md) defines the required implementation validation sequence and manual four-instance scenario.

## Project Structure

### Documentation (this feature)

```text
specs/092-integrate-bluex7-engine/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── blue-x7-parameter-catalog.md
│   ├── blue-x7-runtime.md
│   └── blue-engine-batch-channels.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/blue-data/
├── scripts/
│   └── generate-blue-x7-modern-orchestra.mjs
├── resources/blue-x7-modern/
│   ├── bluex7.orc                  # imported baseline, then Blue-maintained live source
│   ├── ATTRIBUTION.md
│   ├── provenance.json
│   └── LICENSES/                    # applicable third-party license texts
└── src/
    ├── automation/
    │   ├── parameter-helper.ts      # compatibility facade
    │   └── project-parameter-catalog.ts
    ├── instruments/
    │   ├── instrument.ts
    │   ├── blue-x7.ts               # stable facade/XML owner
    │   ├── blue-x7.test.ts
    │   └── blue-x7/
    │       ├── parameter-catalog.ts
    │       ├── parameter-catalog.test.ts
    │       ├── voice-transport.ts
    │       ├── voice-transport.test.ts
    │       ├── csound-target-generator.ts
    │       ├── csound-target-generator.test.ts
    │       ├── modern-support.generated.ts
    │       └── modern-support.test.ts
    ├── arrangement.ts
    ├── arrangement.test.ts
    └── blue-data-csd-automation.test.ts

packages/blue-engine-client/
├── src/{protocol.ts,engine-client.ts,capabilities.ts}
└── tests/{protocol.test.ts,engine-client.test.ts,capabilities.test.ts}

native/blue-engine/
├── src/{protocol/Protocol.h,protocol/Capabilities.cpp,ipc/ZmqHandler.cpp,engine/CsoundEngine.*}
└── tests/cpp/test_automation_protocol.cpp

packages/blue-app/src/
├── shared/project-editor/
│   ├── contract.ts
│   ├── snapshot-mixer-orchestra.ts
│   ├── snapshot-score.ts
│   ├── patch-mixer-bluelive.ts
│   └── patch-score.ts
├── shared/
│   ├── project-editor-blue-x7.test.ts
│   └── blue-x7-runtime-contract.test.ts
├── main/
│   ├── blue-x7-runtime-sync.ts
│   ├── blue-x7-runtime-sync.test.ts
│   ├── score-automation-runtime-sync.ts
│   ├── score-automation-runtime-sync.test.ts
│   ├── engine-bridge.ts
│   └── main.ts
├── preload/preload.ts
└── renderer/
    ├── components/instruments/blue-x7-editor.tsx
    ├── components/instruments/blue-x7/use-blue-x7-effective-values.ts
    ├── components/instruments/blue-x7/csound-panel.tsx
    ├── browser/blue-x7-editor.browser.test.tsx
    └── tests/{blue-x7-editor.test.tsx,blue-x7-project-store.test.ts,blue-x7-csound-preview.test.tsx}

docs/
└── blue-x7-modern-renderer.md          # migration, calibration, and known limitations
```

**Structure Decision**: Preserve package ownership and the existing `BlueX7` facade. Portable synthesis/catalog work stays in `@blue/data`; versioned transport changes stay in engine client/native engine; canonical routing and lifecycle stay in Electron main; renderer changes are limited to intent submission and disposable display state. Catalog/projection, shared Csound support, and target generation are deep modules with small interfaces rather than a generic 155-value runtime interface spread across every note.

## Delivery Sequence

1. Import the exact pinned `bluex7.orc`, record precursor and relevant-project attribution/license notices, and create the deterministic Blue-owned bundling/checksum path.
2. Implement and lock the 151-entry catalog, Parameter migration/persistence/copy rules, owner-aware project catalog, and pure 155-slot transport tests.
3. Integrate the modern compile-once Csound support and TypeScript target generator; validate direct global/literal substitution, static rendering, all algorithms, post code, release, output calibration, and multi-instance compile isolation.
4. Add batch engine-channel protocol/capability support with native and client contract tests, then queue validated channel batches for performance-thread application between control cycles.
5. Add main/preload runtime routing, atomic whole-voice batches, automation authority, Track lookup, and visible-control readback.
6. Bind the editor and automation chooser to catalog metadata/effective values, then run browser, end-to-end, four-instance stress, and full repository validation.
7. Add a reproducible performance harness for the dense fixture and record static, live, mirror-enabled, and mirror-disabled baselines before changing the hot path.
8. Rewrite the live BlueX7 target as generated, instance-specialized Csound that references `gk_blue_autoN` variables directly and removes the generated live `kLiveVoice[]` projection, live ftables, and table publication. Generate both shared-UDO and fully/partially inlined benchmark targets from the same semantic fragments so their synthesis behavior is identical; the maintained UDO remains available for static and comparison targets.
9. Benchmark per-note direct-global change guards versus a per-instance domain-epoch coordinator and shared-UDO versus generated-inline DSP. Record CPU, realtime ratio, CSD size, compile time, and output equivalence; select by realtime CPU first using the 5% equivalence rule, then add the inaudible-release audio-topology fast path without changing note lifetime, automation authority, or accepted audible renders.
10. Re-run deterministic render equivalence, control-boundary batch atomicity, release mutation, dense realtime, and Blue Engine performance gates; do not pursue engine mirroring or oscillator micro-optimizations unless profiling still shows a failed gate.

## Requirement Traceability

| Requirements | Primary design/evidence |
|---|---|
| FR-001–004, FR-029–033 | Modern source/provenance decision; pure `voice-transport` mapping, compile-once support, and TypeScript Csound target generator; preview/binding diagnostics; migration document; static/all-algorithm/reference/output tests |
| FR-005–009, FR-024–027, FR-034 | Parameter catalog contract; BlueX7-owned `ParameterList`; reconciliation/copy/whole-voice transitions in `data-model.md`; XML/SysEx/identity tests |
| FR-010–014 | Runtime routing contract; active/next-note catalog class; generated direct-global k-rate bindings and dirty-domain guards; effective-value batch readback; browser latency/readback tests |
| FR-015–021 | Owner-aware project Parameter catalog; arrangement/Track target identity; deterministic compilation reconciliation; chooser and duplicate-name tests |
| FR-017–018 | Existing Parameter automation engine path plus owner-aware Track lookup; live edit/delete/disable, seek/loop/nonzero-start and disk-render sequence tests |
| FR-022–023 | Performance-thread application of one validated channel batch and fail-closed target resolution; 100-operation old-or-new observation test and protocol/runtime failure tests |
| FR-028 | Exact precursor digest, Blue modification history, `ATTRIBUTION.md`, applicable third-party license texts/notices, and deterministic generated-artifact check |
| SC-001–009 | `quickstart.md` sections 1–10, including the four-owner/32-note/600-update stress run and three-interaction chooser check |
| Performance follow-up | Generated direct-global target code, measured change-guard and UDO-versus-inline strategies, no live value-copy transport, dirty-domain note updates, inaudible-release fast path, live/static relative benchmark, dense-fixture realtime gate, and Blue Engine mirror-cost budget |

## Complexity Tracking

No constitution violations or approved exceptions are required.
