# Tasks: Remove repeated runtime work

## Setup and foundation

- [x] T001 Review licenses, constitution, ownership and Java references; record in plan.md/research.md.
- [x] T002 Create spec.md, contracts/runtime-work.md and quickstart.md.
- [x] T003 Collect baseline structural preparation/projection samples in evidence/ before history edits.

## US1 — bounded polling

- [x] T004 [US1] Reproduce overlapping/stale polls with fake clocks in main/engine-bridge.test.ts.
- [x] T005 [US1] Bound and fence polling in main/engine-bridge.ts; verify lifecycle tests.

## US2 — history work

- [x] T006 [US2] Add copy-count/isolation and descriptor-visit/alias regressions in main/project-history-memento.test.ts and project-history-graph.test.ts.
- [x] T007 [US2] Remove beforeMemento from main/project-history-memento.ts and update every caller/test.
- [x] T008 [US2] Remap captured graph IDs/references in main/project-history-graph.ts without recapture.
- [x] T009 [US2] Make direct fingerprint conditional in main/project-history.ts; retain proposal retry coverage.
- [x] T010 [US2] Verify replay, groups, failure, identities, dirty state and runtime reconciliation with history suites.

## US3 — automation

- [x] T011 [US3] Add exact-output/edge and comparison-count regressions in native/blue-engine/tests/cpp/test_automation_manager.cpp.
- [x] T012 [US3] Prepare ordered metadata in AutomationTypes.h/AutomationStore.cpp and optimize AutomationManager.cpp lookup.
- [x] T013 [US3] Run native correctness/parity/integration checks; record the unrelated sndinfo utility limitation in quickstart.md.

## US4 — promoted narrow follow-ups

- [x] T014 Share unchanged immutable definitions and match numeric runtime IDs; verify old snapshot isolation and same-name replacement in test_automation_manager.cpp.
- [x] T015 Remove decoder intermediates in packages/blue-engine-client/src/meter-codec.ts; verify owned arrays in tests/meter-codec.test.ts.
- [x] T016 Coalesce/fence refreshes in renderer/components/libraries/use-project-library-nodes.ts; deferred-response tests in renderer/tests/project-library-nodes.test.tsx.
- [x] T017 Batch search breadcrumbs/cache read statements in main/unified-library/repository.ts; query count and nested-path tests in repository.test.ts.
- [x] T018 Cull horizontal Track bars via ScorePanel/LayerPanel/TrackLayerGroupCanvas; test mount counts, model selection and cancellation.
- [x] T019 Batch piano-roll thumbnails with a memoized SVG path; verify geometry/selection/resize in renderer/browser/piano-roll-thumbnail.browser.test.tsx.
- [x] T020 Batch fixed startup channels in main/engine-bridge.ts, retain bounded chunks, authored ordering and legacy fallback; test command counts.
- [x] T021 Collect candidate structural samples and same-layout native storage pairs in evidence/; retain raw failures/limitations.
- [x] T022 Evaluate remaining audit gates and integrate all findings/progress into spec.md; remove standalone docs audit.

## Cross-cutting validation

- [x] T023 Run final main/renderer/client builds, affected/full package suites, browser tests, lint and whitespace check.
- [x] T024 Record final outcomes and scoped exceptions in quickstart.md and spec.md; audit diff for unrelated work.

Paths abbreviated main/renderer above are under packages/blue-app/src/.
Dependencies: setup/baseline precede history; test tasks precede changes; T023 follows all
source changes. US1/US2/US3 are independent; ordinary checks may overlap when resources
allow, while all timing collection runs alone. No implementation agents were used.

Remaining conditional roadmap work is explicitly listed in the spec progress table,
not falsely marked as implemented by these task checkboxes.
