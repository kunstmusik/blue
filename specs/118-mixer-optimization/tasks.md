---
description: 'Dependency-ordered implementation tasks for measured BlueMixer optimization'
---

# Tasks: Mixer Generation Optimization

**Input**: Design documents from `specs/118-mixer-optimization/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Branch**: `codex/118-mixer-optimization`

**Status**: Complete — implementation accepted for closure on 2026-10-25. The
owner accepts the recorded SC-001 shortfall. T038/T053/T056/T059 describe the same
outstanding native Windows/Linux release-validation obligation; they remain
unchecked and explicitly deferred, without reopening completed implementation.

**Verification**: Completed generation, rendered-audio, runtime, compatibility,
state-ownership, and macOS performance checks are recorded in
`evidence/implementation-validation.md`. Native Windows/Linux evidence remains a
release follow-up; the unrelated native utility failure has a scoped validation
exception. No skipped or unavailable result is counted as a pass.

**Organization**: Story labels retain the spec's numbering. Execute P1 US1, then P1 US3, then P2 US2. Foundation is shared; US2 adoption is optional, but its evaluation/decision tasks are required. Production emitter changes remain local to the existing CSD policy; new helper paths below are test-only seams, not public APIs.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies file-disjoint work that can run together after its stated prerequisites, not permission to run timing jobs alongside other work.
- `[US1]`, `[US2]`, `[US3]` map to the exact user stories in the spec.
- Paths in task descriptions are repository-relative. Read/edit the corresponding absolute workspace paths when executing tasks; run pnpm commands from the repository root.
- Do not add dependencies, project settings, serialized fields, public runtime capabilities, an optimizer framework, or tap snapshots. No source translation from Java/Csound or copied survey examples.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Revalidate references, ownership, licensing and host prerequisites before building the shared acceptance harness.

- [X] T001 Recheck `LICENSING.md`, `packages/blue-data/LICENSE`, `packages/blue-data/THIRD_PARTY_NOTICES.md`, `packages/blue-data/package.json`, `native/blue-engine/LICENSE.txt`, `native/blue-engine/THIRD_PARTY_NOTICES.md`, affected file headers and the Java/Csound revisions in `specs/118-mixer-optimization/research.md`; update `specs/118-mixer-optimization/evidence/provenance.json` with original-code scope/provenance and any changed reference revision, without incorporating third-party source.
- [X] T002 Audit the planned diff against `specs/118-mixer-optimization/data-model.md` and `docs/modularization.md`; record in `specs/118-mixer-optimization/evidence/implementation-validation.md` that canonical models/XML/history/IPC remain unchanged, scratch obeys “Deterministic allocation, discarded after generation; no serialized or cross-render cache”, and no durable writer or migration is introduced; run the existing focused data generation/copy-safety and app binding regressions listed in `specs/118-mixer-optimization/quickstart.md` and record baseline outcomes separately from future acceptance.
- [X] T003 Build/stage the existing engine with `pnpm --filter @blue/app engine:prepare`, verify the supported double-sample Csound 7 runtime and native build tools, and record discovery paths, runtime/build identity, current platform and unavailable prerequisites in `specs/118-mixer-optimization/evidence/implementation-validation.md`; select caller-owned native artifact directories using the environment convention in `specs/118-mixer-optimization/quickstart.md`, without changing production runtime discovery.

**Checkpoint**: References, baseline unit status, unchanged ownership and local host prerequisites are recorded. Missing native platforms remain pending evidence, not passed gates.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create original fixtures, a trustworthy baseline, audio comparisons and the generated-CSD benchmark before any production emitter edit.

**Critical gate**: Complete T004–T012 before story implementation. Do not capture the baseline after modifying `packages/blue-data/src/blue-data/csd-policy.ts`.

- [X] T004 [P] Create original deterministic project/trace fixtures in `packages/blue-app/src/main/mixer-optimization-test-support.ts` using public `@blue/data` APIs: the exact 128-strip/four-send/eight-subchannel primary fixture, small/fan-in/barrier-rich/panning/disabled/representative cases from `specs/118-mixer-optimization/contracts/benchmark-evidence.md`, all generation profiles and the correctness matrix; keep source inputs fixed and generate score durations covering warmup plus 65,536 measured blocks at each fixture's rate/block size.
- [X] T005 [P] Add focused decoder/comparison contract tests in `packages/blue-app/src/main/mixer-optimization-render-support.test.ts` for float64 and float32 output, equal format/frame/duration checks, malformed/truncated/unsupported output, NaN/Infinity rejection, exact silence/channel isolation, and whole-buffer residual limits of 1e-12 for linear double fixtures and 1e-6 for controlled stateful/live fixtures; prove failures cannot be hidden by Float32 conversion or plateau-only comparison.
- [X] T006 Implement the narrow host-only decoder/comparison helper in `packages/blue-app/src/main/mixer-optimization-render-support.ts` to pass T005, reusing existing host-only support where it meets the contract; keep finiteness assertions independent of residual helpers, preserve native filesystem paths and Csound-only text escaping, and add no production `@blue/data` host import or public helper export (depends on T005).
- [X] T007 Add capture/compare plumbing and its failure-contract tests in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` using T004/T006 and the existing EngineSession/CLI host test conventions: support `BLUE_MIXER_CAPTURE`, `BLUE_MIXER_EVIDENCE_DIR`, `BLUE_MIXER_BASELINE_DIR` and explicit `BLUE_RUN_REAL_ENGINE=1`; enforce manifest matching and candidate fields “Same identity/settings plus candidate revision/working-diff hash and resulting CSD/bindings hash”, fail explicit acceptance for missing runtime/binary/baseline/scenario, and implement “Missing or incompatible data yields an explicit failed/incomplete comparison, never an accepted zero cost or skipped success”; capture mode alone must not claim audio acceptance; render evidence retains “Both manifest identities, runtime build, sample format/count, finite-sample result, peak residual, structural/live checks”.
- [X] T008 Capture immutable complete baseline CSD and binding manifests from production revision `6d884110241e55b779210eb93dee5071c0068c02` using T007 before emitter edits, recording test-exporter/dirty-diff hashes separately; save fixture/input/CSD/binding identities and artifact locations in `specs/118-mixer-optimization/evidence/baseline-manifest.json` and validate “Fixture identity, Blue baseline revision, project/generator mode, CSD hash, original input identity, sample rate, block size, channel count, binding manifest”; use an in-repository `.worktrees/` baseline checkout only if needed, and never derive a baseline by reversing candidate text.
- [X] T009 [P] Add supplied-CSD native-CLI and wrapper/report contract tests in `native/blue-engine/scripts/benchmark.test.mjs`: incompatible `--csd`/`--scenario`/historical `--baseline` combinations, missing/malformed files, metadata/window mismatches, early termination, unavailable runtime, non-finite/zero metrics, paths with spaces/synthetic Windows paths and deterministic paired ordering; preserve historical fixed-scenario defaults/schema/gates and define the separate `benchmarkKind: mixer-generated-csd`, `schemaVersion: 1` expectations before implementation.
- [X] T010 Add the narrow `--csd FILE` developer mode to `native/blue-engine/src/benchmark_main.cpp` to satisfy the native cases in T009: derive rate/block/layout from supplied CSD, measure steady-clock performance-block elapsed time after at least 1,024 warmup cycles, reject an incomplete 65,536-cycle requested window, retain exact runtime/build/thread/options metadata, and leave fixed scenarios and the production engine protocol unchanged (depends on T009).
- [X] T011 Extend `native/blue-engine/scripts/benchmark.mjs` to satisfy T009 with supplied candidate/baseline CSD, matched manifests/settings, the same Release executable/runtime on both sides, at least seven seeded/interleaved paired trials, raw results/median/spread/deltas and explicit gate verdicts; implement “Matched environment, compiler/Release build, runtime identity, exact flags/threading, warmup/window, seeded execution order, raw trials, summary metrics and gates” and label elapsed time distinctly from CPU or host-cycle timing (depends on T008–T010).
- [X] T012 Prove the shared harness against unchanged-baseline/self-comparison cases using `packages/blue-app/src/main/mixer-optimization.integration.test.ts`, `native/blue-engine/scripts/benchmark.test.mjs` and the new Release mode; verify zero structural/audio mismatches, metadata rejection and complete timing windows, retain evidence in `specs/118-mixer-optimization/evidence/foundation-results.json`, and document foundation readiness in `specs/118-mixer-optimization/evidence/implementation-validation.md` without claiming a baseline-vs-itself speedup (depends on T004–T011).

**Checkpoint**: An immutable pre-change reference and working correctness/performance harness exist. Only now may the emitter change. Native Windows/Linux release evidence is still required later.

## Phase 3: User Story 1 — Run Send-Heavy Mixes with Less Processing Overhead (Priority: P1) — MVP

**Goal**: Deliver local send-gain combining and batched clearing without changing tap values, live gates or accumulator lifecycle.

**Independent Test**: Compare original send-heavy generated CSD/audio/live traces with the candidate; verify unchanged tap values and resets, then measure the fixed primary workload at 32/64 samples. Required improvement is at least 10% median elapsed processing time per block on the recorded reference machine, with correct audio first.

### Verification for User Story 1

- [X] T013 [P] [US1] Add failing-before-change generation expectations in `packages/blue-data/src/blue-data/mixer-optimization-csd.test.ts` for one tap-local k-rate product shared across nchnls and the exact ordered final source/sub/master clear set after output/applied echo; include unity/no-gate/fixed-muted paths, zero/one/many channels, disk-pruned sources, deterministic scratch symbols and large clear argument lists; quote and assert “An empty collection does not produce an invalid opcode call.”
- [X] T014 [P] [US1] Add baseline/candidate send-tap whole-buffer cases in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` for mono/stereo zero/unity/non-unity/automated send amounts, pre/post-fader taps, interleaved controlled nonlinear/stateful effects and source changes after an early send; use independent expected tap values plus the contract's finite double residual bounds, and retain unchanged-path counterexamples.

### Implementation for User Story 1

- [X] T015 [US1] Update `applyEffectsChain` in `packages/blue-data/src/blue-data/csd-policy.ts` to compute send amount × live gate once at the original send tap and reuse the k-rate scalar across immediate channel accumulations; enforce “expire before later authored execution or scratch overwrite”, retain existing unity/no-gate/fixed paths and accumulation strategy, and keep scratch allocation independent of parameter/gate/panner identities (depends on T013/T014).
- [X] T016 [US1] Replace only the final zero assignments in `packages/blue-data/src/blue-data/csd-policy.ts` with batched `clear` over the exact old traversal/reset set, including disk-pruned sources, after output and live applied-token echo; verify supported-runtime large-list behavior before adding deterministic bounded groups, and do not remove resets based on silence (depends on T013/T015).
- [X] T017 [US1] Update only intentionally changed send/clear statement expectations in `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts` and any directly affected existing exact-text tests; document the narrow Java generated-text differences in `specs/118-mixer-optimization/evidence/implementation-validation.md`, retaining strict unrelated/authored text expectations without broad snapshot normalization (depends on T015/T016).
- [X] T018 [US1] Extend and run lifecycle cases in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` for sound then silence, partial first/final sample-accurate blocks, effect tails, effects producing sound from silence, pruned clears and repeated performances at valid ksmps 1/32/64/128 and 44.1/48 kHz; assert exact contractual silence and unchanged duration/channel count (depends on T014–T017).
- [X] T019 [US1] Extend the managed-engine trace cases in `packages/blue-app/src/main/mixer-mute-solo.integration.test.ts` for initially closed/open sends, ramp-in/out, repeated atomic bank commits and automated send amounts in timeline/BlueLive; assert the existing 5 ms k-rate ramp, commit sampling/applied echo and tap timing with block-synchronized captures and whole-buffer float32 residual ≤ 1e-6, not post-aligned plateaus (depends on T015–T017).
- [X] T020 [US1] Run the focused data suite/build and explicit T014/T018/T019 engine comparisons, capture candidate manifests, and benchmark the original primary fixture at 44.1 kHz/32 and /64 against T008 using the same Release runner; write raw comparison references, residual/structural verdicts and the ≥10% improvement verdict to `specs/118-mixer-optimization/evidence/us1-results.json`; investigate or revert failing transformations rather than weakening gates or claiming arithmetic microbenchmarks as acceptance (depends on T013–T019).

**Checkpoint**: The local optimization increment is independently demonstrable on the reference host. Complete US3 compatibility and the final platform/release gates before claiming feature acceptance.

## Phase 4: User Story 3 — Reopen Existing Projects and Trust Playback and Exports (Priority: P1)

**Goal**: Prove the optimized generator preserves all existing generation modes, authored/persistent content, bindings, panning and edit/history behavior. No new UI or durable mutation is implemented.

**Independent Test**: Load the existing compatibility corpus and original fixtures, generate sync/async timeline/realtime/disk/BlueLive, compare authored/project content and binding manifests, and render the full panning/lifecycle matrix against baseline.

### Verification and Integration for User Story 3

- [X] T021 [P] [US3] Extend mode/repeated-generation parity cases in `packages/blue-data/src/blue-data-csd-determinism.test.ts` and `packages/blue-data/src/blue-live-csd.test.ts` for eligible optimized paths and unchanged mixer-disabled/fixed routes; compare sync/async CSD, scheduling and stable generated symbols without consuming parameter/gate/panner ordinals.
- [X] T022 [P] [US3] Extend `packages/blue-data/src/blue-data-csd-copy-safety.test.ts` and `packages/blue-data/src/blue-data-csd-parity.test.ts` to assert unchanged canonical project/resource content, significant authored instrument/effect/code whitespace, stable identities and no added source/document mutation on successful/failed generation; preserve unrelated existing generator behavior and exact unaffected Java fixtures.
- [X] T023 [P] [US3] Extend `packages/blue-app/src/main/runtime-parameter-sync.test.ts` to compare the complete pre-change/candidate parameter, gate, panner, exported-channel and meter binding manifests for timeline/BlueLive and repeated compilation, enforcing “Runtime identities are copied/reused by the current pipeline; do not allocate replacement channel/send/parameter identities” and unchanged generation-fenced live reconciliation.
- [X] T024 [US3] Extend `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` to use whole-buffer finite double comparisons where needed for every supported law/boost pair and Balance/Stereo Pan/Dual Pan, verified mono upmix, width 0/1, center/endpoints/crossed positions and left/right/correlated/antiphase input; verify unchanged original stereo inputs, equations and live control switches without modifying clip fade templates or two-term panner expressions.
- [X] T025 [US3] Extend the compatibility cases in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` and `packages/blue-data/src/blue-data/csd-disk-pruning.test.ts` for existing Java/TypeScript projects, no/one/many sources, mono/stereo/supported wider unpanned routing, direct sub/master `blueMixerOut` input, `blueMixerIn` replacement, chained buses and existing self-route/cycle/unsupported-layout diagnostics; no XML acceptance or migration rule changes are permitted.
- [X] T026 [US3] Run existing `packages/blue-app/src/main/project-history-mute-solo.test.ts`, `packages/blue-app/src/main/project-history-roundtrip.test.ts`, `packages/blue-app/src/main/mixer-gain-preview.test.ts` and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`; record commit→undo→redo canonical state/identity/dirty/runtime restoration and preview-cancel outcomes in `specs/118-mixer-optimization/evidence/compatibility-results.json`, explicitly retaining the no-new-writer rationale rather than adding a history mechanism.
- [X] T027 [US3] Run T021–T026 plus the full generation/layout/rate/block compatibility matrix through `packages/blue-app/src/main/mixer-optimization.integration.test.ts`; record binding/text/state verdicts, finite whole-buffer residuals, independent silence/isolation assertions and any existing unrelated defects in `specs/118-mixer-optimization/evidence/compatibility-results.json`; keep failed compatibility cases visible and resolve feature-caused regressions within the authorized emitter scope before this checkpoint.

**Checkpoint**: US1 remains correct across existing projects/modes and controls. US3 verification is independently runnable against any candidate; rerun affected cases after US2 changes.

## Phase 5: User Story 2 — Scale Bus-Heavy Mixes Safely (Priority: P2)

**Goal**: Evaluate unweighted `sum`, large weighted `mac` and immediate inside-BlueMixer `vincr`; adopt only proven safe/useful regions. A measured or concrete applicability-based deferral is a valid result, not an incomplete optimization implementation.

**Independent Test**: Compare direct/pre-existing bus input plus multiple contributors, chained receivers, mutated early-send sources/gains and opaque/nested global observers; measure eligible fan-ins with small/large crossover cases. The old immediate strategy must remain for unsafe/slower cases.

### Verification for User Story 2

- [X] T028 [P] [US2] Add eligibility/barrier tests in `packages/blue-data/src/blue-data/mixer-optimization-csd.test.ts` for direct destination content counted once, original contribution/traversal order, flush-before-source/gain overwrite, all-destination flush before every enabled UDO, receiver/meter/output/clear barriers, self-route handling and alias ambiguity; enforce pending constraints verbatim: “Existing bus accumulator; may already hold direct instrument/effect content”, “Stable audio signal at the original tap; never a reused scratch reference”, “Unity or a stable current k-rate value; an expression name is not a value snapshot”, “Original emission order, independent of runtime parameter/gate/panner ordinals”, and “Source/gain/destination aliases needed to detect overwrite or observation barriers”; keep these tests conditional on actual adoption where an opcode is deferred, without asserting a required batching syntax.
- [X] T029 [P] [US2] Add original whole-buffer and independent observation cases in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` for direct bus input, interleaved global bus readers/writers, nested UDO/macro observers, later fader/pan/gate/effect changes to early-send sources, reused gain scratch, chained subchannels and same-variable/partial-block accumulation; verify observable contribution sets and tap values as well as numerical residuals.

### Evidence-Gated Implementation for User Story 2

- [X] T030 [US2] Analyse generator-owned safe regions and evaluate original test-only candidate fixtures via `packages/blue-app/src/main/mixer-optimization-test-support.ts` and the Release CSD mode; record applicability, preliminary matched fan-in 2/4/8/16/32 results, barrier/alias/concurrency evidence and proposed common thresholds in `specs/118-mixer-optimization/evidence/candidate-decisions.md`; quote “If aliases/lifetimes cannot be established from generator-owned operations, emit the original accumulation immediately”, and reject text-based UDO purity inference, snapshots, rate promotion and per-host selection (depends on T028/T029).
- [X] T031 [US2] For unweighted `sum`, implement only a preliminarily justified conservative region in `packages/blue-data/src/blue-data/csd-policy.ts`, preserving prior accumulator content once, order and every barrier; if T030 provides no worthwhile safe region, leave production unchanged and record that deferral in `specs/118-mixer-optimization/evidence/candidate-decisions.md`; keep pending bookkeeping compilation-local with “no pending contribution survives receiver processing, meter/output observation, opaque UDO execution, or final clearing” and satisfy T028/T029 before any final acceptance (depends on T030).
- [X] T032 [US2] For large weighted `mac`, implement only a preliminarily justified region in `packages/blue-data/src/blue-data/csd-policy.ts` with stable tap/gain values, even alternating k/audio arguments and prior destination content counted once; otherwise retain immediate expressions and document deferral in `specs/118-mixer-optimization/evidence/candidate-decisions.md`; preserve all two-term panner and single-send expressions, introduce no tap snapshots and satisfy T028/T029 (depends on T030/T031; serialize shared emitter edits).
- [X] T033 [US2] For immediate route `vincr`, implement only a preliminarily justified inside-BlueMixer substitution in `packages/blue-data/src/blue-data/csd-policy.ts` after the alias/partial-block/supported-concurrency evidence in T030, or leave the route unchanged and document deferral in `specs/118-mixer-optimization/evidence/candidate-decisions.md`; keep `packages/blue-data/src/arrangement.ts` instrument-to-bus behavior untouched (depends on T030–T032; serialize shared emitter edits).
- [X] T034 [US2] Run T028/T029 and all affected US1/US3 audio/binding/text tests against complete generated candidates, then run matched Release fan-in/small/observer-rich/panning/metering/representative workloads at 44.1/48 kHz and 32/64/128 blocks; save raw trials and regression/crossover decisions in `specs/118-mixer-optimization/evidence/us2-results.json`, retain only candidates passing correctness and performance gates, and revert/defer those requiring unsupported thresholds, snapshots or changed observation order (depends on T031–T033).
- [X] T035 [US2] Finalize every accept/defer/reject entry in `specs/118-mixer-optimization/evidence/candidate-decisions.md` with “Candidate name, eligible shape, barrier cases, correctness result, performance evidence per environment, accept/defer/reject and rationale”, correctness/performance links, concrete deferral/applicability reasons and any intentional generated-text differences; include `mac`, `maca`, `sum`, `vincr`, `product`/`dot`, polynomial/Chebyshev, scale/scale2, ntrpol, divz/limit and pan2/modmatrix without expanding implementation scope; cross-link evidence from `specs/118-mixer-optimization/research.md` (depends on T034).

**Checkpoint**: Every required candidate has a defensible disposition. An adoption is not final until native platform gates pass; a deferral never masquerades as implemented/accepted code.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, provenance and supported-platform evidence, then run the required final checks without competing measurement jobs.

- [X] T036 [P] Update `specs/118-mixer-optimization/quickstart.md` to the actual implemented capture/compare flags, emitted filenames and benchmark behavior, with runnable POSIX/PowerShell instructions and explicit runtime/baseline availability failures; preserve the historical fixed-scenario 4,096-cycle command and reserve the longer window for supplied CSD with adequate duration.
- [X] T037 [P] Recheck the final original-code/dependency/asset/provenance boundaries against `LICENSING.md` and component notices; update `specs/118-mixer-optimization/evidence/provenance.json` with final source/fixture/build references, record that no inventory update is needed when no external material changed, or resolve required applicable notices/inventories before incorporating any new material.
- [ ] T038 [DEFERRED RELEASE VALIDATION] Execute the explicit generated-audio/live and dedicated Release performance matrix from `specs/118-mixer-optimization/quickstart.md` natively on macOS, Windows and Linux, including paths with spaces and native Windows artifact handling; retain per-platform raw manifests/trials and the ≥10% primary-reference improvement and no repeatable regression above 5% verdicts in `specs/118-mixer-optimization/evidence/platform-acceptance.json`; do not run competing validation jobs during measurements, accept unit-test skips as evidence, or mark this task complete while any required platform/runtime result is unavailable (depends on T020/T027/T035/T036).
- [X] T039 Run the changed native benchmark argument/report tests and Release build plus `pnpm --filter @blue/data test`, `pnpm --filter @blue/data build`, explicit app engine tests, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/engine-native test`, `pnpm --filter @blue/engine-native test:integration`, then `pnpm test`, `pnpm lint` and `git diff --check`; record all scoped results/failures in `specs/118-mixer-optimization/evidence/implementation-validation.md` after dedicated performance jobs have finished (depends on T038).
- [X] T040 Reconcile the final candidate ledger and platform/audio/performance evidence with FR-001–FR-013 and SC-001–SC-005 in `specs/118-mixer-optimization/spec.md` and the post-design Constitution Check in `specs/118-mixer-optimization/plan.md`; update `specs/118-mixer-optimization/evidence/implementation-validation.md` with exact accepted scope, Java text divergences and honest remaining gaps, and report completion only when required gates pass (depends on T035–T039).

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: T001–T003
        |
Phase 2: T004–T012 — immutable baseline + validated shared harness
        |
Phase 3: US1 / T013–T020 — local gains + clears, reference-host MVP
        |
Phase 4: US3 / T021–T027 — P1 compatibility and existing controls
        |
Phase 5: US2 / T028–T035 — P2 candidate evaluation/adoption or deferral
        |
Phase 6: T036–T040 — documentation, native platform evidence, final checks
```

Within Phase 2, the actual prerequisite graph is:

```text
T004 fixtures -----------------> T007 capture/compare -> T008 baseline ---+
T005 decoder checks -> T006 ----/                                        |
T009 native/wrapper checks -> T010 native mode ---------------------> T011 wrapper
                                                                         |
                                                                      T012 proof
```

T011 also depends on T009's wrapper checks. T012 requires both the audio and benchmark branches. Shared host fixture changes do not authorize modifying the production emitter before T008/T012.

### User Story Dependencies

- **US1 (P1)**: depends on completed foundation. Its tests, local changes and reference benchmark provide a usable increment without bus batching.
- **US3 (P1)**: compatibility tests can be authored against the foundation; its checkpoint validates the US1 candidate and is a mandatory regression gate for every later adoption. It does not require US2 or a new history/UI implementation.
- **US2 (P2)**: depends on the same foundation and the US1/US3 checkpoints in the recommended sequence. Evaluate/adopt candidates individually; US1 does not depend on an adopted batching opcode.
- **Final acceptance**: requires US1, US3, all required US2 evaluation/decision work, and native platform evidence. Missing Windows/Linux evidence is an incomplete release gate, not a reason to invent a pass or silently weaken scope.

### Within Each Story

Write relevant contract/regression expectations before production edits; verify optimization-specific assertions fail where appropriate, while baseline behavioral checks establish the reference. Serialize mutations of the shared CSD policy. Run correctness before timing, and keep performance jobs isolated. A failed candidate is reverted/deferred with evidence; tests/tolerances are not weakened to force adoption.

### Parallel Opportunities

- After Phase 1: T004, T005 and T009 are file-disjoint. T006 can follow T005 while the native branch progresses; T007/T008 follow their fixture/decoder prerequisites. T010 is independent of host capture work but must follow T009.
- After foundation: T013 and T014 can be authored together. T015/T016 share the emitter and remain sequential.
- At US3 entry: T021, T022 and T023 are file-disjoint. Do not concurrently edit the host integration file in T024/T025 while an earlier phase is still changing its helpers.
- At US2 entry: T028 and T029 can be authored together. T031/T032/T033 share the emitter and remain sequential; only the single candidate under evaluation changes between matched trials.
- After story checkpoints: T036 and T037 are independent documentation/provenance work. T038 timing and T039 broad checks must not overlap on a measurement machine.

## Parallel Examples by User Story

### User Story 1

```text
T013: packages/blue-data/src/blue-data/mixer-optimization-csd.test.ts
T014: packages/blue-app/src/main/mixer-optimization.integration.test.ts
Then T015 -> T016 -> T017; complete T018/T019 before T020 measurement.
```

### User Story 3

```text
T021: packages/blue-data/src/blue-data-csd-determinism.test.ts + blue-live-csd.test.ts
T022: packages/blue-data/src/blue-data-csd-copy-safety.test.ts + blue-data-csd-parity.test.ts
T023: packages/blue-app/src/main/runtime-parameter-sync.test.ts
Then integrate T024–T026 and complete T027 compatibility evidence.
```

### User Story 2

```text
T028: packages/blue-data/src/blue-data/mixer-optimization-csd.test.ts
T029: packages/blue-app/src/main/mixer-optimization.integration.test.ts
Then T030 -> T031 -> T032 -> T033 -> T034 -> T035.
```

## Requirements and Constitution Traceability

| Requirement/obligation                                                    | Tasks                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-001, FR-005: local gain/reset work                                     | T013–T020                                                                 |
| FR-002: sum/mac/vincr evaluation                                          | T028–T035                                                                 |
| FR-003, FR-013: tap/observer/lifetime/conservative fallback               | T013–T019, T028–T035                                                      |
| FR-004: pan/gate/control meaning                                          | T019, T023–T027                                                           |
| FR-006: generation modes/determinism                                      | T004, T007/T008, T021, T025/T027                                          |
| FR-007/FR-008: scope, compatibility and public surfaces                   | T001/T002, T015–T017, T021–T027, T033, T037/T040                          |
| FR-009: focused positive/negative and rendered proof                      | T005–T007, T013/T014, T018/T019, T021–T029, T034                          |
| FR-010: matched timing and retained evidence                              | T008–T012, T020, T030, T034, T038                                         |
| FR-011: measured adoption                                                 | T020, T030–T035, T038                                                     |
| FR-012: narrow Java exact-text divergence                                 | T001, T017, T022, T035/T040                                               |
| SC-001: ≥10% primary reference improvement                                | T020, T038                                                                |
| SC-002: representative regression/platform gates                          | T034, T038/T039                                                           |
| SC-003: numerical + exact behavioral equivalence                          | T005–T007, T014/T018/T019, T024/T025/T027, T029/T034                      |
| SC-004: compatible state/bindings/generation                              | T021–T027                                                                 |
| SC-005: every candidate decision justified                                | T030–T035, T040                                                           |
| Constitution I/III/IV: portable core, canonical ownership, host execution | T002, T006/T007, T010/T011, T015/T016, T022/T023, T040                    |
| Constitution II: Java/current/historical/resource compatibility           | T001, T017, T022/T025/T027; no serialization/migration work is authorized |
| Constitution III: history and preview restoration                         | T002/T022/T026; no new writer, label or undo mechanism is needed          |
| Constitution V: regression/build/lint/quickstart/platform evidence        | T005–T012, story verification, T036/T038/T039                             |
| Constitution VI: original-source provenance/license scopes                | T001, T004, T037                                                          |
| Native paths, Windows coverage and text escaping boundaries               | T003/T006/T009, T036/T038                                                 |

## Implementation Strategy

### MVP First

Complete Setup and Foundation, then US1's two local emitter changes with its required audio/live/reference timing evidence. This is the smallest useful optimization increment. The full feature still requires P1 US3 compatibility, required candidate dispositions and final platform gates; a reference-host MVP is not a release-acceptance claim.

### Incremental Delivery

Keep reference/harness work separate from the first semantic diff. Deliver US1, prove US3, then evaluate each US2 candidate in isolation. Retain only the candidates with safe regions and measured benefit. Deferral is preferred to adding snapshots, purity analysis, a generic optimizer or host-specific tuning. Re-run affected earlier proofs whenever a candidate changes accumulation order or syntax.

### Completion and Evidence Discipline

Capture baseline data before emitter edits and never overwrite it with candidate data. Store bulky CSD/WAV/trial artifacts in caller-selected ignored directories and retain identities/links plus reviewable summaries under feature evidence. Record incomplete host prerequisites explicitly. Check off a conditional candidate task only after an implemented-and-validated outcome or a concrete documented deferral; do not check off platform/final acceptance tasks while required results are missing.

The original task-generation phase performed no implementation or acceptance. Subsequent implementation and convergence phases are recorded below; the current closure status above governs their final disposition.


## Phase 7: Convergence

Assessment of the present implementation against FR-001–FR-013, SC-001–SC-005, all 11 user-story acceptance scenarios, the six Phase 1 implementation decisions, and the constitution found the remaining work below. These tasks supplement T001–T040 without changing their text or completion markers. HIGH findings precede the MEDIUM decoder/output-validation finding. Existing unrelated AudioClip layout-preflight defects remain outside this feature's repair scope.

- [X] T041 [HIGH] Enforce supplied-CSD acceptance windows and performance verdicts in `native/blue-engine/scripts/benchmark.mjs`, `native/blue-engine/src/benchmark_main.cpp`, and `native/blue-engine/scripts/benchmark.test.mjs`: default the new mode to at least 1,024 warmup and 65,536 measured cycles, validate requested versus reported windows and at least seven paired trials, distinguish metric validity from the primary ≥10% improvement and representative ≤5% regression verdicts, and prevent a slower candidate from being reported as accepted; confirm apparent regressions with an independent paired run and retain both reports. Add focused short-window, threshold-boundary, and slowdown checks; keep historical fixed-scenario defaults/schema/gates unchanged and label any shorter research runs explicitly as non-acceptance. Update the corresponding quickstart/evidence descriptions per FR-010, FR-011, SC-001, SC-002, and T009–T011 (partial).
- [X] T042 [HIGH] Make fixture identities cover the complete original inputs in `packages/blue-app/src/main/mixer-optimization-test-support.ts` and the capture/compare tests: include instrument/effect text with significant whitespace, routing/order, sends/gains, pan/gate settings, scheduling/profile/layout, and referenced audio content rather than only score notes/options; normalize only caller-selected artifact locations at a documented identity boundary. Prove that changing one meaningful input changes its fingerprint while equivalent independently built fixtures retain one identity. Regenerate identified baseline fixtures from the pinned pre-change generator with the same exporter, preserve prior captures, and record the new identities without reversing candidate text or changing the designated primary workload per T004, T007, T008, FR-003, FR-010, and SC-004 (partial).
- [X] T043 [HIGH] Complete and validate the evidence identity chain in `packages/blue-app/src/main/mixer-optimization.integration.test.ts`, `native/blue-engine/scripts/benchmark.mjs`, `native/blue-engine/src/benchmark_main.cpp`, and their focused tests: connect each timing/render pair to its fixture/input/profile, baseline and candidate Blue revisions/working-diff/exporter hashes, CSD hashes, and binding-manifest hashes; reject missing or mismatched identities, including a native report whose CSD hash differs from the file supplied. Retain both manifest identities in comparison results and record a nonempty actual Csound build/library identity and precision, executable identity, OS/CPU, compiler/build flags, options/threading, and effective rate/block/layout/0dbfs settings; do not substitute the native engine revision for the Blue generator revision, accept an empty CLI version string, or claim a compiled-header check that was not performed. Preserve the existing production engine protocol and add missing/mismatch failure cases per FR-010, T007/T008, T010/T011, and plan: capture reference and measure complete generated fixtures (partial).
- [X] T044 [HIGH] Make explicit mixer acceptance fail when its baseline, runtime, binary, or required scenario is unavailable in `packages/blue-app/src/main/mixer-optimization.integration.test.ts`: currently `if (baselineDir && BLUE_RUN_REAL_ENGINE === '1')` silently omits the comparison suite when the baseline variable is absent, and CLI-dependent suites can skip. Validate acceptance prerequisites before suite selection, retain ordinary non-acceptance opt-in behavior, and add process-level missing-environment/runtime cases proving a failing/incomplete result rather than a green run with omitted comparisons per T007, FR-009, and plan: prove observable contract (contradicts).
- [X] T045 [HIGH] Create the caller-selected capture directory before `writePruneSourceWav` in `packages/blue-app/src/main/mixer-optimization.integration.test.ts`; the current capture path writes the WAV before `writeCapture` creates that directory. Add a focused capture check using a nonexistent nested output path containing spaces, verify the WAV/CSD/manifest artifacts and `audioAccepted: false`, and make the documented fresh-directory capture command runnable without manual directory preparation; retain native path forms and require native Windows coverage with T053 per T007/T036 and plan: capture reference before semantic edits (partial).
- [X] T046 [HIGH] Replace the Spec 118 T019 plateau-only live proof in `packages/blue-app/src/main/mixer-mute-solo.integration.test.ts` with a block-synchronized baseline/candidate control trace through the managed engine for timeline and actual BlueLive performance. Capture initially open/closed sends, ramp-in and ramp-out, successive/rapid mute-solo bank commits, and changing send amounts; assert complete finite equal-format/equal-length float32 buffers with residual ≤1e-6, the existing 5 ms k-rate trajectory, commit sampling/applied echo, and meter/output/tap ordering without post-alignment. Preserve authored DSP and public bindings, and update live evidence claims to match the checks actually run per FR-003, FR-004, FR-009, SC-003, US1/AC1, and T019 (partial).
- [X] T047 [HIGH] Complete baseline/candidate whole-buffer panning validation in `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` and the shared fixture/capture seams: the new Spec 118 cases currently render the same candidate disk CSD twice. Cover every supported law/boost pair and Balance/Stereo Pan/Dual Pan using named mono-adaptation, width 0/1, center/endpoints/crossed, left/right/correlated/antiphase cases, including eligible live-gated sends and live control switches. Reuse existing panning fixtures/assertions where suitable, add strict finite double residual and independent gain/channel/cancellation proofs against pinned baseline artifacts, and update `evidence/compatibility-results.json` without changing panner equations or clip fade templates per FR-004, FR-009, SC-003, US3/AC2, and T024 (partial).
- [X] T048 [HIGH] Complete accumulator-lifecycle proof in `packages/blue-app/src/main/mixer-optimization-test-support.ts` and `packages/blue-app/src/main/mixer-optimization.integration.test.ts`: add named sample-accurate partial first/final blocks, effect tails, an effect producing sound from silence, and repeated live performances; extend the existing sound-then-silence/pruned-clear cases with independent exact-zero windows, expected impulse/tail positions and duration, and complete ordered source/sub/master resets. Compare pinned baseline and candidate at valid 44.1/48 kHz and ksmps 1/32/64/128 rather than treating the existing four-fixture rate/block repetition as coverage of these missing lifecycle cases; retain reviewable results per FR-005, FR-009, SC-003, US3/AC3, and T018 (partial).
- [X] T049 [HIGH] Complete rendered generation/layout/routing compatibility through `packages/blue-app/src/main/mixer-optimization-test-support.ts` and `packages/blue-app/src/main/mixer-optimization.integration.test.ts`: add pinned baseline capture/comparison for actual BlueLive generation, mono and supported wider unpanned routing, no-source output, direct sub/master contributions and `blueMixerIn` replacement, chained subchannels, nested UDO/macro global-bus readers/writers, and a supported Java/TypeScript project corpus. Compose cases with existing fixtures instead of a Cartesian matrix, verify independent contribution/tap/channel expectations as well as whole-buffer residuals, and retain current invalid-route/cycle/unsupported-layout diagnostics and serialization rules. Keep deferred sum/mac/vincr candidates deferred unless separately justified per FR-003, FR-006, FR-008, FR-009, SC-004, T025/T027/T029, and US2/AC1–AC3 (partial).
- [X] T050 [HIGH] Compare complete pre-change/candidate runtime bindings in `packages/blue-app/src/main/mixer-optimization.integration.test.ts` and `packages/blue-app/src/main/runtime-parameter-sync.test.ts`, rather than only parameter display names, panner counts/mode names, or repeated candidate output. Capture parameter-to-channel mappings/ordinals, exported controls, complete gate catalogs/commit/applied channels, panner controls/initials/associations, and meter identities/order for timeline and BlueLive; assert stable canonical runtime identities on the same project and normalize only documented process-local identity tokens across captures. Add focused mismatches that the existing serializer would miss, exercise existing generation-fenced reconciliation, and retain hashed binding manifests per FR-004, FR-008, SC-004, and T023 (partial).
- [X] T051 [HIGH] Exercise an actual generation failure in `packages/blue-data/src/blue-data-csd-copy-safety.test.ts` and the lowest applicable existing host document tests: the Spec 118 T022 comment currently precedes a successful `not.toThrow()` call. Trigger a deterministic supported failure after compilation preparation and assert unchanged canonical XML, significant instrument/effect/embedded-code text, parameter/channel/send identities and references, compilation state, and applicable dirty/history state after both successful and failed sync/async generation. Add no durable writer or new history mechanism and document the focused result per FR-007, FR-008, US3/AC4, and T022 (partial).
- [X] T052 [HIGH] Resolve the still-incomplete fixed-primary reference performance gate in `specs/118-mixer-optimization/evidence/us1-results.json` and `evidence/platform-acceptance.json` after T041–T051: run isolated matched Release baseline/candidate measurements with at least seven timed trials after warmup at 44.1 kHz/ksmps32 and /64, retain raw trials/environment/identities and the ≥10% verdict at both sizes, and investigate or revert/defer failing transformations rather than rounding −9.98% into a pass, weakening tolerances, altering the fixed primary fixture, or treating metric-validity flags as performance acceptance. Update the candidate ledger and implementation-validation record to reflect the actual result per SC-001, FR-011, US1/AC3, and T020/T038 (partial).
- [ ] T053 [DEFERRED RELEASE VALIDATION] [HIGH] Complete the outstanding representative and supported-platform acceptance work from T034/T038 after the harness corrections: run the generated-audio/live matrix and separate isolated Release timings for small, send-heavy, bus-heavy, effects-heavy, mono, stereo, disabled-mixer, panning/metering, and representative-project workloads at the planned rates/blocks on native macOS, Windows, and Linux. macOS representative timing is currently not separately gated, and Windows/Linux results are absent. Retain per-platform manifests/raw trials, confirm apparent >5% regressions independently, exercise paths with spaces and native Windows artifact handling, and record explicit incomplete verdicts for unavailable environments. Finish the affected native/data/app checks and workspace tests/lint after measurements, update the quickstart and evidence reconciliation, and leave release acceptance incomplete until all required results exist per SC-002, FR-010, FR-011, and T034/T038–T040 (missing).
- [X] T054 [MEDIUM] Strengthen the existing host-only WAV/output validation in `packages/blue-app/src/main/mixer-optimization-render-support.ts`, its focused tests, and `packages/blue-app/src/main/mixer-optimization.integration.test.ts`: reject malformed RIFF/fmt/data boundaries and data lengths that do not contain whole samples and channel frames (a one-byte stereo float64 data chunk is currently accepted as zero frames); assert independent expected complete duration/frame count and the fixture's declared amplitude range in addition to baseline/candidate equality. Add malformed-frame, equal-but-short/empty, and out-of-range negative cases without changing residual limits, normalizing output, altering the fixed benchmark workload, or adding dependencies per FR-009, SC-003, and T005/T006 (partial).


## Phase 8: Convergence

**Owner decision — 2026-10-25**: The project owner accepts the current candidate's measured performance despite the narrowly missed SC-001 10% target. The final isolated primary runs improve processing time by 9.564537037596473% and 9.141414144726173% at ksmps32 and 11.488734903768282% at ksmps64. This scoped acceptance supersedes T052's requirement to pursue more optimization or revert solely for missing 10%; it does not turn the raw numerical check into a pass or establish a new general threshold. Correctness, the SC-002 representative 5% regression bound, and required platform evidence remain applicable. Existing tasks and completion markers are preserved below this decision's authority.

Assessment: 29 FR/SC/user-story acceptance items, six Phase 1 implementation decisions, six constitutional core principles, and 54 existing tasks checked. T041–T051/T054 now have implementation and focused verification. No new production correctness defect or constitutional MUST violation was established. The remaining findings are two HIGH, one MEDIUM, and one LOW; the accepted SC-001 shortfall is documentation reconciliation, not additional optimization work.

- [X] T055 [HIGH] Reconcile current implementation and retained acceptance-evidence identities in `specs/118-mixer-optimization/evidence/convergence-final-{baseline,candidate}-identity.json`, `convergence-binding-results.json`, `convergence-lifecycle-results.json`, `convergence-routing-results.json`, and the existing capture/compare harness. Both final capture manifests retain exporter hash `956e3438318d17eb819aacaf5560554583cbcfec01aabd14f68cd19e44db11e2`, while the current three-source exporter hashes to `e27e958e147e0422a1427d5b086da73fd8a01f6f1502fc00f6e1cf9a5a321a8a`; the three summary documents also point at one overwritten `convergence-candidate/comparison-results.json` whose actual hash is `89fefb7d427f5773057baee388899213b4a6961a6ddb5c2e8eda51796766a8d8`, differing from all three recorded hashes. Preserve historical evidence and its original verdicts, freeze separately identified raw artifacts for each claimed result, and either restore the exact historical exporter source or recapture the pinned pre-change generator and current candidate with the same current exporter and rerun affected comparisons. Update summaries only after validating their complete input/CSD/binding/exporter identities; do not merely replace old hashes to make stale claims appear verified. Reuse existing evidence directories/report seams, retain the current production optimization and deferred bus-candidate decisions, and verify all summary links resolve to bytes matching their recorded hashes per FR-009, FR-010, T043, T048–T050, and plan: capture reference and prove observable contract (partial).
- [ ] T056 [DEFERRED RELEASE VALIDATION] [HIGH] Complete the still-unbuilt representative and supported-platform acceptance work identified in T038/T053 after T055 and the owner-decision reconciliation in T058. Run separate matched Release timings for the planned small, send-heavy, bus-heavy, effects-heavy, mono, stereo, disabled-mixer, panning/metering, and representative-project workloads at the specified rates/blocks, plus the generated-audio/live correctness matrix natively on macOS, Windows, and Linux; retain exact environments/identities/raw trials, confirm apparent >5% regressions in independent paired runs, and exercise native Windows paths with spaces and artifact handling. Update `specs/118-mixer-optimization/evidence/platform-acceptance.json` and the linked results, keeping unavailable platforms explicitly incomplete. Do not stop at or repeat the original SC-001 10% optimization checkpoint: the owner has accepted this candidate's recorded shortfall. Keep correctness and SC-002 regression requirements intact, then run required final checks after measurements without competing validation jobs per SC-002, FR-010, FR-011, T034/T038/T053, and the 2026-10-25 owner decision (missing).
- [X] T057 [MEDIUM] Resolve the remaining native-validation disposition in `specs/118-mixer-optimization/evidence/convergence-final-validation.json`, `evidence/implementation-validation.md`, and `quickstart.md`: the current prebuilt `native/blue-engine/build-darwin-arm64-debug/tests/cpp/test_csound_integration` still reproduces `sndinfo utility did not complete` under Csound double revision `19b39531b26d87347c640f53ef55317aa74967c2`. Establish whether this is independent of the mixer-generator/benchmark changes using a focused unchanged-runtime reproduction. If independent, document a narrowly scoped validation exception with its evidence, affected capability, and deterministic applicable fallback/checks; if feature-caused, repair only that regression and rerun the relevant integration test. Retain the original failing result and do not silently mark native integration green, weaken its assertion, broaden the mixer feature into unrelated runtime repairs, or treat the SC-001 owner acceptance as waiving this failure per plan: implementation sequence and validation, T039/T053, and Constitution V's documented scoped-validation-exception rule (partial).
- [X] T058 [LOW] Record the 2026-10-25 owner acceptance of the current candidate's SC-001 shortfall in `specs/118-mixer-optimization/evidence/convergence-performance-results.json`, `evidence/platform-acceptance.json`, `evidence/convergence-final-validation.json`, `evidence/candidate-decisions.md`, `evidence/implementation-validation.md`, and `quickstart.md`. Preserve the raw 9.56%/9.14% ksmps32 and 11.49% ksmps64 results and computed `primaryImprovementMet: false` for the 32-sample runs; represent acceptance as an explicit scoped owner decision rather than a rounded numerical pass or a new global benchmark threshold. Resolve T052 by that decision in the implementation pass, remove instructions to keep optimizing solely toward 10%, and allow T053/T056 to proceed. Continue reporting incomplete platform/regression and native-validation obligations separately and make no overall release-completion claim until they are resolved per the owner instruction in this chat, SC-001 reconciliation, T040/T052, and this phase's recorded acceptance decision (partial).


## Phase 9: Convergence

Assessment of 29 requirements/acceptance criteria, six implementation decisions, six constitutional core principles, and 58 existing tasks found no additional implementation gap on the validated macOS host. The current exporter matches both final captures; 379 paired input/CSD/binding entries and all 133 active artifact references verify. Recorded acceptance includes 197 offline comparisons, 38 panning cases, two managed-live traces, and 72 macOS representative performance cases (maximum measured regression +3.608284188068369%). The scoped SC-001 owner acceptance and documented native utility validation exception remain in effect. The only remaining finding is the native Windows/Linux evidence already identified by T038/T053/T056; this task narrows their outstanding work rather than reopening completed macOS work.

- [ ] T059 [DEFERRED RELEASE VALIDATION] [HIGH] Complete only the native Windows and Linux acceptance remainder of T038/T053/T056 using the existing capture/compare harness, managed-engine live/panning tests, and `specs/118-mixer-optimization/evidence/run-representative-matrix.mjs`. On each native platform, generate identified pinned-baseline/current-candidate fixtures with the same current exporter, run the planned correctness/generation/layout/routing/live matrix and all 72 representative rate/block/workload timing cases with at least seven paired full-window trials, confirm apparent >5% regressions independently, and retain raw results plus matching input/CSD/binding/exporter/runtime/build identities in fresh evidence directories. Exercise paths with spaces and actual native Windows artifact handling; record platform-specific test failures and scoped dispositions without treating macOS results or unit-test skips as native evidence. Update `specs/118-mixer-optimization/evidence/platform-acceptance.json` and linked final validation summaries, then run applicable final checks after timing. Preserve the accepted SC-001 shortfall, existing macOS evidence, current emitter, and deferred bus-candidate decisions; keep unavailable platform results and T038/T053/T056/T059 explicitly incomplete until genuine native evidence exists per SC-002, FR-009, FR-010, FR-011, plan: supported-platform validation, and T038/T053/T056 (missing).


## Implementation closure — 2026-10-25

The owner requested completion of the spec documents and a feature commit. All
implementation and convergence remediation is complete. The two local emitter
changes are accepted with the previously recorded SC-001 exception; the macOS
correctness/performance evidence verifies, and the unrelated native utility
failure has a scoped validation disposition.

T038/T053/T056/T059 remain unchecked solely as deferred native Windows/Linux
release-validation follow-ups. They describe one outstanding release gate and do
not require another local implementation pass. Cross-platform release acceptance
remains incomplete until genuine native results are recorded; closure does not
turn unavailable checks into passes or waive the 5% regression bound.
