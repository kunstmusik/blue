# Implementation Plan: Mixer Generation Optimization

**Branch**: `codex/118-mixer-optimization` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: `specs/118-mixer-optimization/spec.md`

**Status**: Complete — implementation accepted 2026-10-25. Native Windows/Linux
release validation is deferred to T038/T053/T056/T059, with no unrun check marked
passed. The owner's scoped SC-001 acceptance and the native utility validation
exception are recorded in [implementation validation](evidence/implementation-validation.md).

## Summary

Reduce generated mixer work first by combining live send amount/gate values at k-rate at the existing send tap and batching the existing final accumulator resets with `clear`. Keep two-term stereo panner expressions unchanged. Evaluate `sum` for large stable unweighted fan-ins, `mac` for stable weighted fan-ins, and `vincr` for local route additions; enable only candidates that preserve observations and pass generated-workload performance gates. Unsafe or slower candidates receive a recorded deferral rather than a larger optimizer.

The supplied agent survey contributed opcode candidates; the earlier Mac measurements provided prioritization only. Host-owned double-audio/live-control comparisons and a narrow generated-CSD mode in the existing native benchmark now provide implementation acceptance evidence. Both baseline and candidate CSD run against the same engine/runtime build. The delivered scope is the two local emitter changes; `sum`, `mac`, and `vincr` remain deferred with evidence.

## Technical Context

**Language/Version**: Existing strict TypeScript 5.8-compatible data/app code, C++17 native benchmark, Node.js workspace scripts; Python 3 only for the archived prior research microbenchmark.

**Primary Dependencies**: Existing `@blue/data`, Vitest 4.1, native Blue Engine/Csound 7 and current build toolchain. No new runtime or development dependency is required.

**Storage**: Canonical `.blue` and app settings unchanged. Internal compilation scratch is ephemeral. Captured baseline CSD, WAV, manifests, and raw trials are developer artifacts under a chosen ignored output directory; archived research inputs live in this feature's `evidence/`.

**Testing**: Focused data generation tests, host-owned managed-engine rendered-audio/live control tests, a generated-CSD Release benchmark, data build/type checks, affected app/native checks, then workspace tests/lint. Ordinary unit runs do not count skipped real-engine tests as acceptance.

**Target Platform**: Browser-safe data library; macOS, Windows, Linux host application and Csound 7. No host detection or CPU-specific selection enters the generator.

**Project Type**: Existing compiler/data library inside an Electron desktop application, with host-native engine validation tools.

**Performance Goals**: SC-001: at least 10% lower median trial-average performance time per block for the fixed primary generated-mixer fixture at ksmps 32/64 on the recorded reference machine. SC-002: no repeatable regression above 5% in the representative matrix across supported platforms. Measure elapsed processing time explicitly, not inferred mixer-only CPU; retain separate arithmetic/whole-project results.

**Constraints**: Preserve authored DSP, observable bus ordering, source/gain lifetimes, binding identities, gate trajectories/commit echo, panning semantics, and unsupported-input diagnostics. Exact unaffected CSD expectations remain. No new XML fields, history writers, settings, IPC, dependencies, native DSP kernels, or production profiling API.

**Scale/Scope**: Initial production scope is two local emitter changes. Candidate evidence spans 1/16/64/128 source strips and fan-ins 2/4/8/16/32, ksmps 1 for correctness plus 32/64/128 for reference performance, mono/stereo and currently supported wider unpanned routing. Developer benchmark input is added narrowly; existing automation benchmark defaults and schema remain unchanged.

## Constitution Check

_The table records the original design gates. Completed implementation checks and their evidence are in [implementation validation](evidence/implementation-validation.md): 197 offline comparisons, 38 panning cases, two managed-live traces, and 72 representative macOS timing cases pass. SC-001 is owner-accepted at 9.14–9.56% for 32 samples and 11.49% for 64 samples. Native Windows/Linux evidence remains deferred release work; the unrelated native utility check has a scoped validation exception._

| Gate                                 | Before Phase 0                                                                                                        | After Phase 1                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable data core                   | PASS — restrict production arithmetic/emission to the existing static-import data policy.                             | PASS — no filesystem/process/DOM/host imports in production `@blue/data`; host/test helpers and native benchmark own execution.                                                                                                                                                                                         |
| Java and project compatibility       | PASS — inspected Java mixer behavior and baseline CSD policy; deliberate generation syntax changes are named in spec. | PASS — Java revision is pinned in research; eligibility/render contracts preserve behavior and limit exact-text fixture changes. XML/standalone formats and authored code are unchanged.                                                                                                                                |
| Migration scope and ordering         | PASS — no persistence or acceptance-rule change.                                                                      | PASS — no project/resource migration or loader-history change is required; disk/library/BlueShare roots are unaffected.                                                                                                                                                                                                 |
| Canonical ownership and contracts    | PASS — `BlueData` remains canonical; compilation/benchmark results are disposable.                                    | PASS — internal scratch lifecycle is in data-model; generated audio, eligibility, and developer benchmark contracts are explicit. No application IPC change.                                                                                                                                                            |
| Project history and undo/redo        | PASS — no new durable writer.                                                                                         | PASS — existing edit/preview/history/reconciliation contracts remain; regression coverage compares bindings, render copy safety, and existing live edit behavior. No non-undoable exception.                                                                                                                            |
| Runtime and engine isolation         | PASS — runtime execution stays host-owned.                                                                            | PASS — managed app tests and native developer benchmark own Csound; renderer/data do not launch processes or connect to the engine. Production engine protocol unchanged.                                                                                                                                               |
| Host-path portability                | PASS — production path code unchanged.                                                                                | PASS — harness uses native `path`/filesystem forms; conversion only at embedded Csound text boundary, Windows path-with-space cases, and native Windows evidence. No chmod permission simulation.                                                                                                                       |
| Verification evidence                | PASS for design — research identified existing data/app/native seams and missing acceptance evidence.                 | PASS for design — quickstart and contracts define focused regressions, finite whole-buffer double comparisons, live captures, Release timing, platform gates, builds/tests/lint. Implementation results are recorded in the validation evidence; native Windows/Linux results remain deferred release work.                                                                              |
| License compatibility and provenance | PASS — read license scope map and affected component metadata/notices/headers; original implementations only.         | PASS — MIT generator/native changes stay in those scopes; GPL app harness/documents stay in theirs. Java GPL and Csound LGPL code are inspected for behavior, not translated/copied. Original archived microbenchmark and report hash are recorded; no new third-party material or dependency inventory change planned. |

## Project Structure

### Documentation (this feature)

```text
specs/118-mixer-optimization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── optimization-eligibility.md
│   ├── render-equivalence.md
│   └── benchmark-evidence.md
└── evidence/
    ├── provenance.json
    ├── microbenchmark.py
    └── microbenchmark-results.json
```

`tasks.md` records the completed implementation and convergence work, with the native Windows/Linux release follow-ups explicitly deferred.

### Source Code (repository root)

```text
packages/blue-data/src/
├── blue-data/csd-policy.ts                    # production emitter changes
├── blue-data/mixer-gate-csd.test.ts           # focused existing expectations
├── blue-data/mixer-optimization-csd.test.ts   # proposed focused test seam
├── blue-data-csd-{determinism,copy-safety,parity,disk}.test.ts
├── blue-live-csd.test.ts
└── test-support/csd-render-fixtures.ts        # host-only test support if reused
packages/blue-app/src/main/
├── mixer-optimization.integration.test.ts    # proposed audio/export fixture seam
├── mixer-mute-solo.integration.test.ts        # reuse managed-engine live coverage
├── mono-clip-panning.integration.test.ts      # reuse double render conventions
└── runtime-parameter-sync.test.ts
native/blue-engine/
├── src/benchmark_main.cpp                    # narrow developer CSD-input mode
├── scripts/benchmark.mjs                     # preserve existing wrapper behavior
└── scripts/*.test.mjs                        # developer argument/report checks
```

**Structure Decision**: Retain the existing policy façade. `docs/modularization.md` review: local send/clear helpers have one existing owner and no demonstrated separate public interface; extracting a generic expression/graph optimizer is deferred. Candidate pending-contribution bookkeeping, if justified, stays internal to the current mixer emission responsibility, with no persistent graph or new public data API. Test-support changes remain host-only. The native benchmark mode is development tooling, not a new `blue-engine` production command or protocol surface.

## Phase 0 — Research decisions

[research.md](research.md) resolves rate applicability, aliasing and authored-code barriers, Java parity, numerical proof, benchmark ownership/metric, candidate scope, module boundaries, and provenance. Two read-only research agents examined safety/test seams and measurement/report limitations. No design clarification remains open. New benchmark results are future acceptance evidence, not unresolved architecture questions.

## Phase 1 — Design and contracts

1. **Capture the reference before semantic edits.** Generate deterministic baseline CSD/manifests using public entry points at `6d884110241e55b779210eb93dee5071c0068c02`. Keep fixtures original and record hashes/revision/runtime settings. Do not synthesize the baseline by undoing selected strings in candidate output. Reuse the current checkout when capturing before changes; if a later baseline worktree is needed, its path must be inside `.worktrees/` per repository guidance.
2. **Make local send math explicit.** Compute the k-rate amount/gate product immediately at the tap and share it across nchnls. Preserve no-gate/unity/fixed-mode behavior and deterministic symbols. Do not move gain calculation across effects or reuse it after a possible writer. Keep accumulation strategy independent.
3. **Batch only the current resets.** Emit `clear` over the exact current set/order at the current post-output/post-echo point. Verify large argument lists against the supported runtime before choosing one statement versus deterministic bounded groups.
4. **Evaluate candidates without assuming adoption.** Benchmark unweighted `sum`, large weighted `mac`, and inside-BlueMixer `vincr`; apply [eligibility](contracts/optimization-eligibility.md). Keep default panner expressions and authored/clip code unchanged. No tap snapshots, purity scans, general IR, or per-host autotuning. Any static crossover threshold must be justified across supported platforms/block sizes, not copied from one 32-input result.
5. **Prove the observable contract.** Follow [render equivalence](contracts/render-equivalence.md). Add double decoding/whole-buffer finite checks within host-only tests, live gate/binding capture, negative barrier cases, and deterministic/immutability coverage. Existing tests are extended only for the affected transformations; unrelated snapshots remain strict.
6. **Measure complete generated fixtures.** Follow [benchmark evidence](contracts/benchmark-evidence.md). Add supplied-CSD mode to the existing Release benchmark while preserving existing scenario behavior. Use the same executable/runtime for both files, separate correctness WAV rendering from no-I/O timing, reject incomplete/mismatched evidence, and record every platform decision.

### Requirement coverage

| Spec requirements      | Design coverage                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| FR-001, FR-005         | Local tap gain product and exact final-clear set/placement                                        |
| FR-002, FR-011, FR-013 | Candidate matrix, conservative barriers, explicit measurement/adoption gates and deferral         |
| FR-003, FR-004         | Eligibility + render contracts; live bank/gate/panner/binding invariants                          |
| FR-006                 | Sync/async, timeline, BlueLive, disk, repeated-generation fixtures                                |
| FR-007, FR-008         | Generator-only scope, ephemeral data-model, unchanged authored/persistent/public runtime surfaces |
| FR-009                 | Per-transform positive/negative generation tests and whole-buffer/structural/live proof           |
| FR-010                 | Versioned developer evidence, pinned baseline, matched environment and raw timing samples         |
| FR-012                 | Exact unaffected fixtures and narrowly documented Java text divergence                            |
| SC-001–SC-005          | Benchmark gates, platform matrix, audio limits, compatibility checks, decision ledger             |

## Implementation sequence and validation

Completed work followed the sequence in `tasks.md`: reference capture and validation harness; local send/clear transformations; independent candidate evaluations and deferrals; correctness and macOS performance evidence; owner acceptance and documented release follow-ups. Benchmark infrastructure remains developer tooling, without a production profiling surface.

Validation includes focused data/app tests and builds, explicit baseline/candidate audio and managed-live comparisons, native benchmark contract/build checks, and dedicated Release measurements without competing validation jobs. Workspace tests, lint, and whitespace checks are recorded in `evidence/convergence-final-validation.json`; the separate native integration utility failure has the scoped disposition described below. The [quickstart](quickstart.md) documents the implemented commands and evidence. Native Windows/Linux evidence remains a deferred release gate and is not counted as completed validation.

## Complexity Tracking

No architectural constitution exception is required. Candidate batching remains deferred because conservative flush rules and performance evidence do not justify adoption. The source-module extraction and general optimizer alternatives were rejected under the modularization review rule. Constitution V's scoped validation-exception provision covers the independently reproduced native `sndinfo` discovery issue; the evidence and deterministic direct-runtime validation fallback are documented in `evidence/phase8-native-utility-disposition.json` and the quickstart.
