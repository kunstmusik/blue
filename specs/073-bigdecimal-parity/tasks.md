# Tasks: Java BigDecimal Automation Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/073-bigdecimal-parity/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Verification**: Every behavior, XML, editor, runtime, native, fixture, performance, and documentation boundary has an explicit validation task. Normal tests consume committed Java-generated fixtures and do not require a JVM.

**Deferred validation**: T034, T046, T051, T052, T059, T060, T061, T066, and T067 are intentionally deferred for this handoff. They remain unchecked so deferred work is not represented as completed work; the reasons and current evidence are recorded in `quickstart.md`.

**Organization**: Tasks are grouped by the four user stories in priority order. Shared exact-decimal, fixture, and contract infrastructure is completed before story work.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the repository-owned fixture, generator, dependency, and build surfaces without changing runtime behavior.

- [x] T001 [P] Add the canonical fixture directory and schema placeholder at `fixtures/java-blue-automation-parity/v1/SCHEMA.md` with the TSV field rules, raw-binary64 encoding, and section names from `contracts/java-parity-fixtures-v1.md`.
- [x] T002 [P] Scaffold the maintainer-only Java oracle module in `tools/java-blue-automation-fixtures/pom.xml` and `tools/java-blue-automation-fixtures/README.md`, including Java 25 validation and the pinned Java Blue artifact inputs.
- [x] T003 [P] Add deterministic fixture-generation and fixture-check commands to `scripts/generate-java-blue-automation-fixtures.mjs` and the root `package.json`, with no timestamp, absolute checkout path, or JVM-local metadata in output.
- [x] T004 [P] Add the header-only `boost-multiprecision` dependency and feature build options to `native/blue-engine/vcpkg.json` and `native/blue-engine/CMakeLists.txt` without changing the existing ZeroMQ/Csound targets.
- [x] T005 [P] Add native parity test targets, canonical fixture copy rules, and fixture path injection to `native/blue-engine/tests/cpp/CMakeLists.txt` and `native/blue-engine/CMakeLists.txt`.
- [x] T006 [P] Record the Java Blue reference checkout variables, expected source files, source-hash fields, and regeneration command in `tools/java-blue-automation-fixtures/README.md` and `fixtures/java-blue-automation-parity/v1/manifest.json`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the exact decimal, shared fixture, diagnostic, ownership, and protocol foundations required by every user story.

**⚠️ CRITICAL**: No user-story implementation should begin until these foundations are complete and their focused tests are green.

- [x] T007 Implement the repository-owned Java fixture generator in `tools/java-blue-automation-fixtures/src/main/java/`, calling actual Java Blue `Line.getValue`, `Parameter`/`Line` XML, editor snapping, and `CSDRender` methods rather than copied formulas.
- [x] T008 Generate the canonical `fixtures/java-blue-automation-parity/v1/manifest.json`, `realtime.tsv`, `resolution.tsv`, and `offline.tsv` corpus with exactly 2,048 deterministic seeded realtime cases plus curated boundary and diagnostic cases.
- [x] T009 [P] Add the test-only TypeScript fixture reader and raw-binary64 decoder in `packages/blue-data/src/test-support/java-parity-fixtures.ts`, validating manifest schema, counts, categories, and canonical corpus paths without adding Node imports to production `@blue/data`.
- [x] T010 [P] Add the C++ TSV fixture reader and manifest/category assertions in `native/blue-engine/tests/cpp/java_parity_fixtures.h` and `native/blue-engine/tests/cpp/java_parity_fixtures.cpp`, consuming the CMake-copied canonical files without adding a native JSON dependency.
- [x] T011 Add red-first exact-decimal unit cases for Java string parsing, canonical text, coefficient/scale, binary64 construction/conversion, `FLOOR`, signed remainder, `HALF_UP`, legacy normalization, and underflow/overflow in `packages/blue-data/src/automation/java-decimal.test.ts`.
- [x] T012 Implement the portable immutable `JavaDecimal` value type and exact operations in `packages/blue-data/src/automation/java-decimal.ts`, using static imports and `BigInt` internally while preserving the coefficient/scale pair as the authority.
- [x] T013 Add red-first native arithmetic and allocation-contract tests in `native/blue-engine/tests/cpp/test_java_bigdecimal.cpp`, including the hard-fail upstream allocator, signed floor/remainder cases, binary64 edge cases, and zero system allocations after preparation.
- [x] T014 Implement private native exact-decimal arithmetic and prepared workspace types in `native/blue-engine/src/automation/JavaBigDecimal.h`, `native/blue-engine/src/automation/JavaBigDecimal.cpp`, `native/blue-engine/src/automation/ExactDecimalQuantizer.h`, and `native/blue-engine/src/automation/ExactDecimalQuantizer.cpp` using Boost.Multiprecision and a control-thread-sized arena.
- [x] T015 [P] Define stable recoverable diagnostic categories and translation helpers in `packages/blue-engine-client/src/automation-errors.ts` and `native/blue-engine/src/automation/AutomationErrors.h`, covering malformed decimals, scale overflow, non-finite input, invalid payloads, unavailable workspace, and invalid evaluation.
- [x] T016 [P] Add the canonical exact-resolution fields and ownership comments to `packages/blue-app/src/shared/project-editor.ts` and `native/blue-engine/src/automation/AutomationTypes.h`, keeping parameter values, bounds, and points as binary64 and removing modeled `resolutionScale`/`highPrecision` state from the new contracts.
- [x] T017 [P] Add protocol-v2 constants, capability names, and typed exact-resolution request shapes to `packages/blue-engine-client/src/capabilities.ts`, `packages/blue-engine-client/src/protocol.ts`, and `native/blue-engine/src/protocol/Protocol.h` while retaining command IDs `0x20` and `0x21`.
- [x] T018 [P] Document the control-thread ownership, prepared-resource retirement, single audio-thread workspace consumer, and canonical project/runtime ownership in `specs/073-bigdecimal-parity/data-model.md` and `native/blue-engine/docs/automation_system.md` before moving runtime preparation.

**Checkpoint**: Fixture readers, exact decimal primitives, diagnostics, shared state shapes, and protocol-v2 declarations are ready; user stories can now proceed with focused tests.

## Phase 3: User Story 1 - Hear the Same Legacy Automation as Java Blue (Priority: P1) 🎯 MVP

**Goal**: Make realtime linear automation and offline parameter automation produce Java Blue's exact bits/text, including decimal quantization and Java's special point-selection behavior.

**Independent Test**: Run the Java realtime fixture suite through the production TypeScript/native evaluators and run independent offline `CSDRender` fixtures; then exercise create/update and channel output through the app/engine boundary.

### Verification for User Story 1

- [x] T019 [P] [US1] Add exact raw-bit Java `Line.getValue` cases for linear interpolation, descending bias, direct points, duplicate times, time zero, empty/single lines, endpoints, and unquantized resolutions in `packages/blue-data/src/automation/parameter-java-parity.test.ts`.
- [x] T020 [P] [US1] Add native production evaluator fixture coverage in `native/blue-engine/tests/cpp/test_java_bigdecimal_parity.cpp`, including exact output bits, diagnostic categories, and manager-level sample-time cases.
- [x] T021 [P] [US1] Add independent Java `CSDRender` initialization and score-fragment fixture assertions to `packages/blue-data/src/blue-data-csd-automation.test.ts`, comparing exact output bytes and not only parsed numeric values.
- [x] T022 [P] [US1] Add end-to-end exact-resolution runtime assertions to `packages/blue-app/src/main/score-automation-runtime-sync.test.ts` and `packages/blue-app/src/main/engine-bridge.test.ts`, proving the channel receives the evaluated value and offline path remains separate.

### Implementation for User Story 1

- [x] T023 [US1] Implement Java-compatible point selection, exact-point/endpoint bypasses, duplicate-time handling, and linear operation order in `native/blue-engine/src/automation/AutomationManager.cpp` and `native/blue-engine/src/automation/AutomationManager.h`.
- [x] T024 [US1] Replace native inverse-duration linear math with prepared Java-order slopes and add compiler controls for no contraction/reassociation in `native/blue-engine/CMakeLists.txt` and the parity translation unit.
- [x] T025 [US1] Integrate `ExactDecimalQuantizer` into native linear, step, and exponential evaluation in `native/blue-engine/src/automation/AutomationManager.cpp`, preserving extension-curve formulas while quantizing their computed doubles exactly when active.
- [x] T026 [US1] Move segment/resolution/workspace preparation off the perform thread and add control-thread retirement/reclamation for old prepared definitions in `native/blue-engine/src/automation/AutomationStore.h`, `native/blue-engine/src/automation/AutomationStore.cpp`, and `native/blue-engine/src/automation/AutomationManager.cpp`.
- [x] T027 [US1] Implement the Java-compatible TypeScript line evaluator and positive-resolution quantization in `packages/blue-data/src/automation/parameter.ts`, delegating exact arithmetic to `java-decimal.ts` and preserving Java's unquantized early returns.
- [x] T028 [US1] Isolate Java-compatible offline initialization and score stepping in `packages/blue-data/src/automation/csd-parameter-automation.ts` and route `packages/blue-data/src/blue-data.ts` through it, including Java `NumberUtilities.formatDouble`-equivalent output and render clipping rules.
- [x] T029 [US1] Wire native prepared-definition failures and audio-time invalid-evaluation counters through `native/blue-engine/src/automation/AutomationStore.cpp`, `native/blue-engine/src/automation/AutomationManager.cpp`, and `native/blue-engine/src/ipc/ZmqHandler.cpp` without logging or allocating on the perform thread.
- [x] T030 [US1] Run the focused US1 suites from `packages/blue-data`, `packages/blue-app`, and `native/blue-engine/tests/cpp`, fix every fixture mismatch, and record exact realtime/offline pass counts in `specs/073-bigdecimal-parity/quickstart.md`.

**Checkpoint**: User Story 1 is independently demonstrable: positive-resolution linear playback matches Java bits, extension quantization is explicit, and offline CSD output matches its separate Java oracle.

## Phase 4: User Story 2 - Preserve Exact Decimal Resolution (Priority: P1)

**Goal**: Preserve Java decimal value and scale from XML through model copies, BSB/editor edits, snapshots/patches, runtime publication, and protocol-v2 decoding.

**Independent Test**: Load representative XML, edit and copy resolutions such as `0.1`, `0.10`, `1e-7`, negative-scale, and scale-greater-than-18 values, save/reload, and assert the canonical string reaches the engine unchanged.

### Verification for User Story 2

- [x] T031 [P] [US2] Add parameter XML load/save/copy and legacy-normalization fixture assertions to `packages/blue-data/src/automation/parameter.test.ts`, including conflicting parameter/nested-line resolutions and unchanged binary64 point/value fields.
- [x] T032 [P] [US2] Add exact-resolution BSB slider/bank load, copy, widget-to-parameter, and parameter-to-widget tests to `packages/blue-data/src/instruments/blue-synth-builder/bsb-group-automation-parity.test.ts` and the four BSB widget model test files.
- [x] T033 [P] [US2] Add snapshot/patch round-trip tests for authoritative `resolutionDecimal` and derived display `resolution` in `packages/blue-app/src/shared/project-editor.test.ts`, `packages/blue-app/src/shared/score-timeline-automation-contract.test.ts`, and `packages/blue-app/src/shared/bsb-group-automation-patches.test.ts`.
- [ ] T034 [P] [US2] [DEFERRED] Add decimal editor and committed-value snapping tests in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.test.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.test.ts`.
- [x] T035 [P] [US2] Add protocol-v2 exact-text, malformed-payload, truncation, count-overflow, and mixed-metadata tests to `packages/blue-engine-client/tests/protocol.test.ts`, `packages/blue-engine-client/tests/capabilities.test.ts`, and `native/blue-engine/tests/cpp/test_automation_protocol.cpp`.

### Implementation for User Story 2

- [x] T036 [US2] Replace numeric resolution fields with `JavaDecimal`, implement Java parameter ownership/load precedence/save text/copy behavior, and ignore legacy behavioral children in `packages/blue-data/src/automation/parameter.ts`.
- [x] T037 [US2] Update BSB horizontal/vertical slider and bank models plus synchronization code in `packages/blue-data/src/instruments/blue-synth-builder/bsb-hslider.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-vslider.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-hslider-bank.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-vslider-bank.ts`, `packages/blue-data/src/instruments/blue-synth-builder/bsb-group.ts`, and `packages/blue-data/src/instruments/blue-synth-builder/blue-synth-builder.ts` to retain exact text/scale.
- [x] T038 [US2] Update serialized snapshot types, patch reducers, optimistic reconstruction, and project mutation handling in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/renderer/stores/project-store.ts` to make `resolutionDecimal` authoritative.
- [x] T039 [US2] Implement the decimal-specific renderer editor/validator and exact committed-value snapping while retaining derived-number previews in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/BSBPropertySheet.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx`.
- [x] T040 [US2] Replace the client automation encoder/API with protocol-v2 canonical text and remove `resolution`, `resolutionScale`, and `highPrecision` arguments in `packages/blue-engine-client/src/protocol.ts` and `packages/blue-engine-client/src/engine-client.ts`.
- [x] T041 [US2] Implement native protocol-v2 payload parsing, exact-resolution validation, atomic store mutation, capability reporting, and version metadata in `native/blue-engine/src/protocol/Protocol.h`, `native/blue-engine/src/protocol/Capabilities.cpp`, and `native/blue-engine/src/ipc/ZmqHandler.cpp`.
- [x] T042 [US2] Update Electron engine publication, runtime capability checks, packaged manifest expectations, and score automation synchronization in `packages/blue-app/src/main/engine-bridge.ts`, `engine-runtime.ts`, `packaged-runtime-verification.ts`, and `score-automation-runtime-sync.ts`.
- [x] T043 [US2] Run the focused US2 XML, BSB, renderer, client, native protocol, and app bridge suites and resolve every loss-of-scale, malformed-input, and metadata mismatch before the story checkpoint.

**Checkpoint**: User Story 2 is independently demonstrable: exact resolution identity survives project/editor/runtime boundaries and protocol-v2 rejects invalid or accidentally mixed payloads deterministically.

## Phase 5: User Story 3 - Detect Parity Regressions Quickly (Priority: P2)

**Goal**: Make one reproducible Java-derived corpus authoritative across TypeScript and native tests, with fast exact-bit/text failure diagnostics and no JVM requirement for normal tests.

**Independent Test**: Run all fixture consumers with Java unavailable, mutate one expected output bit in a temporary copy, and verify the relevant case ID/input is reported as a failure; then run the opt-in Java regeneration check.

### Verification for User Story 3

- [x] T044 [P] [US3] Add manifest schema/count/category assertions and no-JVM fixture-consumer tests to `packages/blue-data/src/test-support/java-parity-fixtures.test.ts` and `native/blue-engine/tests/cpp/test_java_bigdecimal_parity.cpp`.
- [x] T045 [P] [US3] Add a deliberate one-bit/one-byte mutation regression harness to `packages/blue-data/src/test-support/java-parity-fixtures.test.ts` and `native/blue-engine/tests/cpp/java_parity_fixtures.cpp`, asserting case ID and input diagnostics.
- [ ] T046 [P] [US3] [DEFERRED] Add generator determinism and provenance validation tests to `tools/java-blue-automation-fixtures/src/test/` and `scripts/generate-java-blue-automation-fixtures.test.mjs`.

### Implementation for User Story 3

- [x] T047 [US3] Complete generator provenance validation, pinned Java source hashes, deterministic SplitMix64 seeding, stable sorting, and temporary-directory byte comparison in `tools/java-blue-automation-fixtures/` and `scripts/generate-java-blue-automation-fixtures.mjs`.
- [x] T048 [US3] Replace the old approximate/native-duplicated expectations in `native/blue-engine/tests/fixtures/quantization-fixtures.json`, `native/blue-engine/tests/cpp/test_automation_fixedpoint.cpp`, `native/blue-engine/tests/cpp/test_automation_fixedpoint_simple.cpp`, and `native/blue-engine/tests/cpp/CMakeLists.txt` with canonical corpus consumers.
- [x] T049 [US3] Add canonical corpus adapters for resolution, realtime, offline, protocol, XML, and runtime-boundary sections in `packages/blue-data/src/test-support/`, `packages/blue-engine-client/tests/`, `packages/blue-app/src/main/`, and `native/blue-engine/tests/cpp/` without copying expected results into consumer-specific files.
- [x] T050 [US3] Add failure-category mapping and case-context output across `packages/blue-data/src/test-support/java-parity-fixtures.ts`, `packages/blue-engine-client/src/`, and `native/blue-engine/src/automation/AutomationErrors.h` so Java exceptions become stable product diagnostics.
- [ ] T051 [US3] [DEFERRED] Run the standard no-JVM fixture suite with Java/Maven unavailable, measure completion under the ten-second target after build, and record the result in `specs/073-bigdecimal-parity/quickstart.md`.
- [ ] T052 [US3] [DEFERRED] Run `pnpm fixtures:java-automation:check -- --java-blue-root "$JAVA_BLUE_ROOT"` against the pinned Java Blue checkout and record the exact commit/source hashes and byte-identical result in `fixtures/java-blue-automation-parity/v1/manifest.json`.

**Checkpoint**: User Story 3 is independently demonstrable: the committed corpus catches one-bit regressions quickly, is consumed by both runtimes, and can be reproduced only when a maintainer intentionally provides Java Blue.

## Phase 6: User Story 4 - Retain the Unquantized Common Path (Priority: P2)

**Goal**: Keep zero/negative-resolution automation fast and behaviorally stable while measuring positive exact-decimal overhead separately.

**Independent Test**: Compare the Spec 072 zero/negative-resolution correctness and five-trial Release benchmark with the new build, then run the exact positive-resolution and allocation stress scenarios separately.

### Verification for User Story 4

- [x] T053 [P] [US4] Add zero/negative-resolution Java-bit and extension-curve regression cases to `native/blue-engine/tests/cpp/test_automation_manager.cpp` and `packages/blue-data/src/automation/parameter-java-parity.test.ts`.
- [x] T054 [P] [US4] Add system-allocation, arena-overflow, and update-adoption instrumentation for at least 10,000 evaluations in `native/blue-engine/tests/cpp/test_java_bigdecimal.cpp` and `native/blue-engine/tests/cpp/test_csound_stress.cpp`.
- [x] T055 [P] [US4] Add separate `linear_32`, ordinary-scale `quantized_exact_32`, and large-scale `quantized_exact_32` benchmark scenarios to `native/blue-engine/src/benchmark_main.cpp` and `native/blue-engine/scripts/benchmark.mjs`.

### Implementation for User Story 4

- [x] T056 [US4] Remove `highPrecision`, `resolutionScale`, bounded fixed-point quantization, and obsolete positive-mode APIs from `native/blue-engine/src/automation/AutomationTypes.h`, `AutomationStore.*`, `AutomationManager.*`, `FixedPoint.h`, `packages/blue-engine-client/src/`, `packages/blue-app/src/main/`, and `packages/blue-data/src/automation/`.
- [x] T057 [US4] Preserve the common path's early branch before exact arithmetic, prepared linear slope caches, binding-generation behavior, write deduplication, and completed-envelope fast path in `native/blue-engine/src/automation/AutomationManager.cpp` and `AutomationTypes.h`.
- [x] T058 [US4] Add exact-path counters and separate benchmark result labels for common/unquantized versus positive-resolution decimal processing in `native/blue-engine/src/benchmark_main.cpp`, `native/blue-engine/docs/automation_system.md`, and `specs/073-bigdecimal-parity/quickstart.md`.
- [ ] T059 [US4] [DEFERRED] Run the five-trial Release comparison against the Spec 072 baseline and enforce the no-greater-than-5% common-path median regression gate in `native/blue-engine/scripts/benchmark.mjs` and `native/blue-engine/benchmarks/`.
- [ ] T060 [US4] [DEFERRED] Run the 10-minute positive-resolution Csound stress test under ThreadSanitizer and ASan/UBSan, confirming zero deadline misses, stalls, upstream allocations, races, and arena overflows in `native/blue-engine/tests/cpp/test_csound_stress.cpp`.
- [ ] T061 [US4] [DEFERRED] Run focused common-path, exact-path, allocation, sanitizer, stress, and benchmark checks and record separate performance evidence in `specs/073-bigdecimal-parity/quickstart.md`.

**Checkpoint**: User Story 4 is independently demonstrable: common projects retain their optimized path and exact positive-resolution cost is visible without weakening correctness.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, examples, packaging metadata, cross-platform verification, and the final constitution/spec audit.

- [x] T062 [P] Update protocol tables, exact-resolution semantics, removed-mode notes, realtime ownership, and build/dependency guidance in `native/blue-engine/README.md`, `native/blue-engine/docs/automation_system.md`, and `native/blue-engine/tests/README.md`.
- [x] T063 [P] Update all shipped protocol-v2 automation examples and their README payload descriptions in `native/blue-engine/examples/c/`, `native/blue-engine/examples/cpp/`, `native/blue-engine/examples/java/`, `native/blue-engine/examples/javascript/`, `native/blue-engine/examples/python/`, and `native/blue-engine/examples/rust/`.
- [x] T064 [P] Update package/app/native artifact metadata and tests for protocol version 2 and `automation-decimal-v1` in `native/blue-engine/scripts/artifact.mjs`, `verify-artifact.test.mjs`, `packages/blue-app/src/main/packaged-runtime-verification.test.ts`, and related runtime tests.
- [x] T065 [P] Update user-facing data/runtime notes to state that only resolution is BigDecimal, values/points remain doubles, positive resolution always selects exact Java quantization, and zero/negative resolution is unquantized in `packages/blue-data/README.md` and relevant app/native docs.
- [ ] T066 [DEFERRED] Run the complete `specs/073-bigdecimal-parity/quickstart.md` validation sequence, including focused package tests, native integration, build, lint, benchmark, sanitizer, stress, and optional fixture-check evidence.
- [ ] T067 [DEFERRED] Run `pnpm build`, `pnpm test`, and `pnpm lint` from `/Users/stevenyi/work/blue-electron`, then run the supported macOS, Linux, and Windows CMake/CTest matrices and document any platform-scoped follow-up in `specs/073-bigdecimal-parity/quickstart.md`.
- [x] T068 Audit `specs/073-bigdecimal-parity/spec.md`, `plan.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `tasks.md` against the constitution and every FR/SC, confirm no stale behavioral `highPrecision` path remains, record current evidence and pending validation gates, and leave unrelated `MISSING_FEATURE_GPT.md` uncommitted.
- [x] T069 [US1] Reclaim retired automation snapshots after DELETE, ENABLE, DISABLE, and CLEAR mutations and add a regression test that exercises repeated revisions without a follow-up CREATE/UPDATE, preserving the control-thread-only destruction contract in `native/blue-engine/src/automation/AutomationStore.*` and `native/blue-engine/src/ipc/ZmqHandler.cpp`.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; T001–T006 can proceed in parallel when they touch different files.
- **Phase 2 (Foundational)**: Depends on Phase 1; T007–T018 establish the shared corpus, decimal semantics, diagnostics, state ownership, and protocol declarations.
- **Phase 3 (US1)** and **Phase 4 (US2)**: Depend on Phase 2. They can proceed in parallel after the shared exact-decimal and fixture foundation, although US1's native receiver is needed before US2's app-to-engine integration test can pass.
- **Phase 5 (US3)**: Fixture-consumer tests can start after Phase 2, but the complete boundary regression suite and generator check require the US1/US2 production paths.
- **Phase 6 (US4)**: Depends on the native evaluator work in US1; benchmark and allocation gates must run after US1/US2 remove the old mode and publish prepared definitions.
- **Phase 7 (Polish)**: Depends on all desired user stories and their focused checkpoints.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; MVP playback/offline path.
- **US2 (P1)**: Starts after Phase 2; exact model and boundary work can run alongside US1, with app/engine integration validated after native protocol handling exists.
- **US3 (P2)**: Starts with fixture infrastructure from Phase 2; full regression evidence depends on US1 and US2 paths.
- **US4 (P2)**: Depends on US1's native manager and US2's removal of the old runtime arguments; it measures and protects the common path rather than adding a user-facing mode.

### Parallel Execution Examples

#### Setup/foundation

```text
Task: "T001 Create fixtures/java-blue-automation-parity/v1/SCHEMA.md"
Task: "T002 Scaffold tools/java-blue-automation-fixtures/pom.xml and README.md"
Task: "T004 Add boost-multiprecision to native/blue-engine/vcpkg.json and CMakeLists.txt"
Task: "T009 Add packages/blue-data/src/test-support/java-parity-fixtures.ts"
Task: "T010 Add native/blue-engine/tests/cpp/java_parity_fixtures.*"
```

#### User Story 1 after foundation

```text
Task: "T019 Add packages/blue-data/src/automation/parameter-java-parity.test.ts"
Task: "T020 Add native/blue-engine/tests/cpp/test_java_bigdecimal_parity.cpp"
Task: "T021 Extend packages/blue-data/src/blue-data-csd-automation.test.ts"
Task: "T022 Extend packages/blue-app/src/main/score-automation-runtime-sync.test.ts"
```

#### User Story 2 after foundation

```text
Task: "T031 Extend packages/blue-data/src/automation/parameter.test.ts"
Task: "T032 Extend packages/blue-data/src/instruments/blue-synth-builder/bsb-group-automation-parity.test.ts"
Task: "T033 Extend packages/blue-app/src/shared/project-editor.test.ts"
Task: "T035 Extend packages/blue-engine-client/tests/protocol.test.ts and native protocol tests"
```

#### User Story 3/4 after production paths

```text
Task: "T044 Add canonical fixture guard tests in TypeScript and CTest"
Task: "T045 Add one-bit mutation diagnostics"
Task: "T053 Add common-path regression fixtures"
Task: "T054 Add native allocation instrumentation"
Task: "T055 Add separated benchmark scenarios"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundational phases, including a small validated canonical fixture corpus.
2. Complete US1's exact native/TypeScript realtime evaluator and independent offline CSD path.
3. Run T030 and stop for an MVP parity review before broad editor/packaging work.

### Incremental Delivery

1. Add US2 exact persistence and atomic protocol-v2 boundary; validate XML → snapshot → engine.
2. Add US3 canonical fixture regeneration/consumer guards and no-JVM regression evidence.
3. Add US4 common-path/performance/allocation protection.
4. Complete documentation, examples, cross-platform checks, and final audit.

### Notes

- Every task uses the required `- [ ] T###` checklist form; `[P]` appears only where the files and dependencies permit parallel work.
- User-story tasks carry exactly one `[US#]` label. Setup, foundational, and polish tasks intentionally have no story label.
- The implementation remains uncommitted until the user explicitly requests a commit.
