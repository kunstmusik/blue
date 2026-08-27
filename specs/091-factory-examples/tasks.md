---

description: "Task list for Factory Example Content implementation"
---

# Tasks: Factory Example Content

**Input**: Design documents from `/specs/091-factory-examples/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md,
data-model.md, contracts/example-library-lifecycle.md, contracts/example-library-state.md,
contracts/example-update-merge.md, quickstart.md

**Verification**: Constitution-driven regression, transaction/recovery, contract, host-path
portability, and quickstart tasks are included below. No behavior lands without its focused Vitest
evidence; nothing changes `.blue` XML, so serialization tasks reduce to provenance-state
round-trip/rejection coverage and factory-immutability assertions.

**Organization**: Tasks are grouped by user story. All production code stays inside Electron main
(`packages/blue-app/src/main/`); no renderer, preload, IPC, engine, or `@blue/data` files are
created or modified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- New durable domain: `packages/blue-app/src/main/example-library/`
- New flow coordinator: `packages/blue-app/src/main/open-example-project-flow.ts`
- Existing anchors touched only where named: `main.ts`, `example-project-path.test.ts`
- Host-path portability: native `fs`/`path` forms unchanged; portable `/`-separated text exists
  only inside `example-library/`; synthetic Windows fixtures and injected `EACCES`/`EPERM` errors;
  no POSIX `chmod` permission modeling

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish verifiable starting conditions before any code is written.

- [x] T001 Record the factory packaging baseline: confirm `packages/blue-app/electron-builder.yml`
      still ships the complete `packages/blue-app/assets/examples` tree via `extraResources`
      unchanged, and capture (locally, not committed unless useful) the recursive
      file-listing-plus-hash snapshot procedure defined in quickstart.md §4 step 1 for later
      packaged comparisons.
- [x] T002 [P] Review the integration seams this feature composes with and note their exact
      exported names for later tasks: `resolveExampleProjectPath` in
      `packages/blue-app/src/main/example-project-path.ts`, the accepted-target replacement API in
      `packages/blue-app/src/main/project-replacement-flow.ts`, the durable temp-file-plus-rename
      JSON pattern in `packages/blue-app/src/main/program-settings-store.ts`, and the fail-closed
      decision contract in `packages/blue-app/src/main/native-confirmation.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The portable path boundary, deterministic factory manifest, and durable
state/journal store — prerequisites for inspection, copying, updating, and recovery in every
user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement the path boundary in
      `packages/blue-app/src/main/example-library/path-boundary.ts`: validated portable relative
      path type and predicates (non-empty, `/` separators, normalized, no `.`/`..`/empty segments,
      no backslashes or NUL), native-to-portable conversion performed only below a known native
      root, portable-to-native reconstruction by segment join below that root, Windows
      case/slash-equivalence folding used exclusively for host identity and collision checks
      (serialized spelling preserved), and a realpath-based containment predicate that rejects
      symlink escapes beyond lexical prefix matching.
- [x] T004 Cover the path boundary in
      `packages/blue-app/src/main/example-library/path-boundary.test.ts`: traversal and escape
      rejection (`..`, backslash, NUL, empty segments, absolute inputs), round-trip
      native↔portable conversions built with `path.join`/`os.tmpdir` plus synthetic Windows
      fixtures such as `C:\\Users\\...`, case-insensitive collision identity on Windows-form paths
      while POSIX form stays case-sensitive, and realpath containment accepting an inner project
      but rejecting an outside target reached through a symlink created in a temporary directory.
- [x] T005 [P] Implement the deterministic factory manifest in
      `packages/blue-app/src/main/example-library/manifest.ts`: sequential traversal of regular
      files only below the native factory root, sorted portable `relativePath` records with exact
      byte `size` and streamed SHA-256 `sha256` (binary-safe, bounded memory), derived
      `sha256:<64-hex>` `revision` over the canonical sorted payload, rejection of symlinks,
      directories-that-collide-with-files, device/socket entries, and platform-equivalent path
      collisions, plus an injectable per-session cache hook so repeated inspections reuse the
      manifest (plan Performance Goals).
- [x] T006 [P] Cover the factory manifest in
      `packages/blue-app/src/main/example-library/manifest.test.ts`: identical revision regardless
      of insertion order, mtimes, installation root, or separator form in the input tree; correct
      hashes for text and binary fixtures (including media-sized multi-KB bytes); rejection cases
      for symlinked entries and case/slash collisions on synthetic Windows roots; cache hook hit
      behavior.
- [x] T007 Implement the durable state and journal store in
      `packages/blue-app/src/main/example-library/state-store.ts`: versioned `UserLibraryState`
      (`schemaVersion`, `acceptedFactoryRevision`, `declinedFactoryRevision | null`,
      path-sorted unique `FactoryBaselineRecord[]` with `factoryPresent` tombstones,
      `lastCompletedAt`) and `ExampleLibraryOperationJournal` validation per
      data-model.md; invariant recompute of `acceptedFactoryRevision` from `factoryPresent: true`
      baselines; normalization of `declinedFactoryRevision === acceptedFactoryRevision` to `null`
      on next successful write; atomic write sequence (unique sibling temp file, flush, close,
      rename, best-effort parent-directory fsync) modeled on
      `packages/blue-app/src/main/program-settings-store.ts`; typed errors that leave the previous
      valid document in place; readers treat unsupported schema versions, malformed hashes, bad
      path text, duplicate/unsorted baselines, and mismatched invariants as invalid rather than
      seeding defaults.
- [x] T008 Cover the state and journal store in
      `packages/blue-app/src/main/example-library/state-store.test.ts`: valid v1 documents load
      and round-trip byte-stably; unknown future `schemaVersion` blocks mutation and reports an
      actionable diagnostic; malformed/invalid state beside an existing `content/` directory is
      surfaced as invalid without overwrite; failed fsync/rename injections retain the previous
      document; tombstoned baselines survive reload; declined-normalization fires on rewrite.

**Checkpoint**: Path identity, content-derived revisions, and durable provenance stores are green
under `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/example-library/path-boundary.test.ts src/main/example-library/manifest.test.ts src/main/example-library/state-store.test.ts`

---

## Phase 3: User Story 1 — Open Examples from a Protected Installation (Priority: P1) 🎯 MVP

**Goal**: On Open Example with no user-owned library, explain and perform a complete first-use
copy into `<userData>/examples/`, open the picker from that copy, and let the selected example
open and render through the normal project lifecycle while the packaged factory tree receives
zero writes (spec US1, FR-001…FR-006, FR-015).

**Independent Test**: Fixture whose factory examples are readable but whose installation directory
cannot be written → select Open Example → first-use explanation offers Copy and Open / Cancel →
accepting prepares and commits the copy → picker opens from the user-owned tree → an example with
relative assets opens and renders; cancel or injected failure at any point leaves the active
project and factory content untouched with a recoverable explanation.

### Implementation for User Story 1

- [x] T009 [P] [US1] Extend `packages/blue-app/src/main/example-project-path.test.ts` for the
      degraded factory-source cases inspection must distinguish: missing examples tree,
      unreadable directory (injected `EACCES`/`EPERM`), and incomplete tree, asserting the resolver
      reports usable/unusable outcomes instead of returning partial roots (spec Edge Case 1).
- [x] T010 [US1] Implement library inspection in
      `packages/blue-app/src/main/example-library/service.ts`: derive the library parent layout
      (`current/content`, `current/state.json`, `staging-*`, `backup-*`, `operation.json`)
      natively under a caller-supplied root; run pre-flight recovery discovery (recognized
      journal/generation combos handled in Phase 5; for now detect-and-block ambiguous layouts as
      `invalid-user-library` rather than proceeding); combine a valid `FactoryManifest` (via T005)
      with current-generation validity to return the discriminated
      `ExampleLibraryInspection` statuses `needs-initialization`, `ready`,
      `declined-current`, `update-available`, `factory-unavailable`, `invalid-user-library`,
      `unavailable` per data-model.md; no dialogs, no writes besides none in this step.
      (Depends on T003–T008.)
- [x] T011 [US1] Implement candidate preparation for the first-use copy in
      `packages/blue-app/src/main/example-library/service.ts`: `prepareInitialCopy(inspection)`
      stages a complete `CandidateGeneration` under `staging-<operationId>/` — byte-for-byte copy
      of the entire factory tree with relative layout preserved (projects, media, scripts,
      score resources, auxiliary files, FR-005), symlinks/non-regular entries rejected rather than
      followed (per manifest policy), bounded-memory streaming copy, and `kind: 'initialize'`
      lifecycle field transitions `preparing → prepared`; any failure removes only the owned
      staging directory and leaves `current/` untouched so a partial copy is never visible.
- [x] T012 [US1] Implement activation primitives in
      `packages/blue-app/src/main/example-library/service.ts`: `commit(candidate)` executing the
      durable phase order from contracts/example-library-lifecycle.md — validate staged content
      and state, write+fsync `operation.json` (phase `prepared`), rename `current`→`backup-<id>`
      only when `current` already exists (not applicable on true first use), rename
      `staging-<id>`→`current` (phase `activated`), validate, remove the owned backup and journal;
      plus idempotent `abort(candidate)` staging cleanup usable from `finally`.
- [x] T013 [US1] Prove first-use transactions in
      `packages/blue-app/src/main/example-library/service.test.ts` on fresh temporary trees
      (`.blue` + relative media fixture): successful initialize reaches exactly one valid
      `current/{content,state.json}` with the full tree and a recomputable accepted revision;
      injected mid-copy `EACCES`/EPERM/disk-style failures remove staging only; interruption
      during each activation phase (journal written, post-backup rename, post-staging rename) is
      resolved by the recovery hook without duplicating or losing generations (quickstart §3A/E
      initialize portions); asserts zero modifications beneath the factory fixture root
      (SC-003 seed, FR-015).
- [x] T014 [US1] Implement the dependency-injected Open Example coordinator for the first-use
      branch in `packages/blue-app/src/main/open-example-project-flow.ts` (no Electron imports):
      sequencing per contracts/example-library-lifecycle.md — freeze/render preflight hook,
      recovery hook, `inspect`, first-use native decision (Copy and Open default; any close/
      Escape/dialog failure resolves Cancel), candidate preparation, injected `.blue` picker
      rooted at the candidate `content/`, realpath containment validation rejecting outside-root
      selections with "use Open Project" guidance, parse-before-gates read of the selected project,
      existing library-draft and save/discard/cancel gates, `abort` in `finally` on every early
      exit, then `commit` and installation of the parsed project under the portability-mapped
      final `current/content` path (same-file selection from a candidate is NOT a no-op).
- [x] T015 [US1] Prove the first-use flow ordering in
      `packages/blue-app/src/main/open-example-project-flow.test.ts`: accept-happy path ends with
      committed current generation and installed project; canceling at each decision boundary
      (native prompt, picker, library-draft, save) aborts the candidate leaving the active project,
      `current/`, and factory fixture unchanged with idempotent cleanup (quickstart §3B first-use
      portion); unexpected installation failure after activation keeps the valid library and
      surfaces a project-load error rather than clearing the workspace (FR-015, SC-006).
- [x] T016 [US1] Rewire the menu action in `packages/blue-app/src/main/main.ts`: replace the
      direct packaged-path picker wiring with the coordinator's dependencies — factory root from
      the existing resolver (T002), library root under `app.getPath('userData')/examples`,
      `showNativeConfirmation` decisions, existing dialog picker, and the existing accepted-target
      project replacement callbacks (T002) — keeping the Open Example menu item, title, and
      `.blue` filter unchanged and adding no preload/renderer/IPC surface (FR-002, FR-018).

**Checkpoint**: User Story 1 delivers standalone — from a protected fixture, Copy and Open reaches
a rendered user-owned example with factory content provably untouched; focused suite:
`pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/example-project-path.test.ts src/main/example-library/service.test.ts src/main/open-example-project-flow.test.ts`

---

## Phase 4: User Story 2 — Work from a Persistent User Copy (Priority: P2)

**Goal**: After first use, Open Example silently prefers the valid user library, saved edits
persist across sessions, and no prompt, duplicate copy, or stray write ever touches the packaged
factory tree (spec US2, FR-003, FR-007, SC-003, SC-004).

**Independent Test**: Create the library via Open Example, edit + save one example, close it, run
Open Example again → the picker opens straight from the user library with no first-use/update
prompt, the saved edit is present, and a recursive factory hash matches the baseline captured in
T001.

### Implementation for User Story 2

- [x] T017 [US2] Extend inspection readiness in
      `packages/blue-app/src/main/example-library/service.ts`: for `status === 'ready'` return the
      `ReadyExampleLibrary` payload (current content root + validated state) without rehashing user
      content or rebuilding anything, reusing the cached session factory manifest for comparison so
      repeated Open Example actions perform zero redundant I/O (FR-007, SC-004); completing this
      keeps `factory-unavailable` reachable when the manifest cannot be produced but a valid user
      generation exists.
- [x] T018 [US2] Add the existing-library fast path to
      `packages/blue-app/src/main/open-example-project-flow.ts`: `ready` inspections skip every
      copy/update decision and open the injected picker at `current/content` directly; selected
      paths pass the same realpath containment check scoped to the current root and continue
      through the unchanged parse/library-draft/save gates (US2 scenarios 1–3, FR-006 continuity).
- [x] T019 [US2] Prove persistence and non-proliferation in
      `packages/blue-app/src/main/open-example-project-flow.test.ts`: two consecutive opens show
      no first-use or update prompt and produce no second library copy (assert single
      `current/` generation and stable revision, SC-004); an edit+save round trip through the
      injected save gate writes only inside the user library; flow-level spy assertions confirm
      neither coordinator nor service ever issues a write below the factory fixture root across
      open/edit/save cycles including disk-render's beside-the-project temp-CSD placement
      (SC-003, US2 scenario 3).
- [x] T020 [P] [US2] Guard existing behavior: keep
      `packages/blue-app/src/main/project-replacement-flow.test.ts` and
      `packages/blue-app/src/main/project-replacement-entry-points.test.ts` green and add explicit
      regression cases proving normal Open Project selection and the accepted-target protection
      sequence are byte-for-byte unaffected by the new wiring (FR-016, FR-018).

**Checkpoint**: Stories 1 AND 2 work independently — first use creates, later uses prefer, edits
persist, factory stays pristine; run the Phase 3 checkpoint suite plus
`src/main/project-replacement-flow.test.ts`.

---

## Phase 5: User Story 3 — Receive New Factory Examples Safely (Priority: P2)

**Goal**: When the installed factory revision differs from the accepted-or-declined revision,
offer Update and Open / Keep Current and Open / Cancel, merge non-destructively per the baseline
contract, report preserved conflicts, record declines, and recover interrupted activations on the
next Open Example — never overwriting, deleting, or resurrecting user content (spec US3, FR-008…
FR-014, clarifications on unordered revisions and user-deletion semantics).

**Independent Test**: Seed a library from factory revision A; swap in revision B containing a new
example, an unchanged example, a changed untouched file, a changed user-edited file, a
user-deleted baseline file, a removed factory file, and a new path colliding with a user-created
entry → Open Example offers the update → choosing Update and Open refreshes only new/untouched
paths, retains every user case, reports path-sorted conflicts, advances baselines with tombstones,
and does not reprompt for B; interrupting the swap recovers to exactly one valid generation.

### Implementation for User Story 3

- [x] T021 [P] [US3] Implement the pure merge planner in
      `packages/blue-app/src/main/example-library/merge-plan.ts`: inputs are accepted baselines, a
      non-following user-entry snapshot, and the installed `FactoryManifest`; output is the
      deterministic path-sorted `ExampleUpdatePlan` (actions, `nextState` with advanced baselines
      and tombstones, conflict `summary`) implementing every row of
      contracts/example-update-merge.md — `add-factory`, `replace-untouched`, `keep-unchanged`,
      `preserve-user-modified` (report when factory changed), `preserve-user-deleted` (report
      while factory present), `preserve-collision` for entries occupying new factory paths,
      ancestor path-type collisions blocking factory descendants, `preserve-factory-removed`
      retaining tombstones without deletion, `preserve-user-only`; performs zero filesystem writes
      (FR-010…FR-012).
- [x] T022 [P] [US3] Cover the full merge matrix in
      `packages/blue-app/src/main/example-library/merge-plan.test.ts`: each contract row asserted
      end-to-end including tombstone-baseline rows and reintroduction of a previously removed
      factory path, ancestor file-vs-directory collision cascades, deterministic sorting, exact
      `nextState` baseline advancement (tombstones retained, declined cleared), and summary counts
      matching reported conflicts; planner rejects inconsistent inputs without throwing raw
      errors into callers.
- [x] T023 [US3] Implement update candidate preparation in
      `packages/blue-app/src/main/example-library/service.ts`: `prepareUpdate(inspection)` snapshots
      current entries with `lstat` kinds (never following symlinks), computes
      `sourceUserRevision`, stages by copying the complete user tree symlink-preserving (not
      dereferenced; unsupported entries fail safe), applies only `add-factory` and
      `replace-untouched` candidate effects from T021, writes `nextState` into the candidate,
      verifies expected candidate bytes equal the installed manifest (sizes + hashes), and refuses
      to proceed if the live source snapshot changed mid-preparation; failures remove only the
      owned staging generation while `current/` remains canonical (merge-contract "Candidate
      Construction").
- [x] T024 [US3] Implement update activation and recovery in
      `packages/blue-app/src/main/example-library/service.ts`: pre-activation resnapshot requiring
      unchanged `sourceUserRevision` (mismatch aborts cleanly, asks user to retry); full journal
      commit using the backup path (`current`→`backup-<id>`→`staging`→`current` with phase
      advancements); `recover(libraryRoot)` executing the complete lifecycle table — finish a valid
      staged activation when `current` is missing, restore the verified backup when staging is
      invalid/missing, keep a valid `current` and clean only journal-matched Blue-owned leftovers,
      and block mutation preserving ambiguity on malformed journals or unowned directories
      (contract "Transaction Activation and Recovery"); plus `recordDeclinedRevision` writing
      `declinedFactoryRevision` atomically without touching content.
- [x] T025 [US3] Prove update transactions and crash recovery in
      `packages/blue-app/src/main/example-library/service.test.ts` against a revision-A/B fixture
      shaped like quickstart §3C: accepted update lands exactly the contract-specified tree
      (new + untouched replaced; edited/deleted/collided/removed/user-only preserved) with
      baselines and tombstones advanced and `declined` cleared; injected copy-time
      `EACCES`/EPERM/full-disk-style failures keep the previous generation canonical;
      `sourceUserRevision` drift between staging and activation aborts with no swap; termination
      injected after journal-write, after `current→backup`, and after `staging→current` each
      converges via `recover` to exactly one valid generation removing only recognized owned
      directories; malformed/unowned leftovers are preserved and reported as
      `invalid-user-library` (quickstart §3E, FR-015).
- [x] T026 [US3] Add the remaining decision branches to
      `packages/blue-app/src/main/open-example-project-flow.ts`: differing-revision native prompt
      (Update and Open default, Keep Current and Open, Cancel — offered identically for newer,
      older, and repackaged content per the clarified unordered-revision rule), Keep Current
      persisting the decline then opening `current/content` without merge, factory-unavailable-
      with-valid-library prompt opening current with the update-check-unavailable notice, and the
      pre-picker informational conflict decision (Continue proceeds showing a bounded path list +
      total; Cancel aborts the candidate) — all via `showNativeConfirmation`, all fail closed.
- [x] T027 [US3] Prove update/decline/suppression flow behavior in
      `packages/blue-app/src/main/open-example-project-flow.test.ts`: accepting an update makes
      newly added examples selectable in the same picker session (SC-007) and commits the swapped
      generation; cancellation at each boundary aborts cleanly (quickstart §3B update portion);
      Keep Current then reopen neither reprompts nor mutates content; the full quickstart §3D
      reprompt matrix (accepted A, declined B, returned A, unrelated C) shows offers driven by
      equality not ordering, including downgrade-style presentations; an
      `invalid-user-library` inspection surfaces the blocked-mutation diagnostic and offers no
      destructive action; recovery executes at flow start only — never at import/startup time
      (FR-002, FR-009, FR-013, FR-014).

**Checkpoint**: All user stories function independently; the merge matrix, decline suppression,
and interruption recovery hold under the full temporary-tree suite:
`pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/example-library/merge-plan.test.ts src/main/example-library/service.test.ts src/main/open-example-project-flow.test.ts`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide gates, packaging evidence, and the manual acceptance pass.

- [x] T028 Audit `packages/blue-app/src/main/example-library/` and
      `packages/blue-app/src/main/open-example-project-flow.ts` against the host-path and
      embedded-text rules: `fs`/`path` receive native forms everywhere; `/`-separated text exists
      only inside manifest/state payloads; no `chmod`-based permission assumptions; no raw
      `confirm`/`prompt`/`alert`; native decision failures resolve Cancel; remove dead scaffolding
      left from earlier phases.
- [x] T029 Run the complete focused evidence suite from quickstart.md §1 verbatim and reconcile
      every listed expectation (deterministic revisions, byte-exact copies, merge matrix,
      equality-driven suppression, state/journal durability, cancellation cleanliness, injected
      failure recovery, picker containment, untouched Open Project).
- [x] T030 Exercise the packaging gate: `pnpm --filter @blue/app package:dir`, then verify the
      unpacked output contains the complete `resources/assets/examples` tree equivalent to the
      T001 baseline (recursive listing + hashes), proving the feature introduced no packaging
      regression or factory mutation.
- [x] T031 Run the repository gates from the root: `pnpm --filter @blue/app build:main`,
      `pnpm --filter @blue/app test`, `pnpm lint`, `git diff --check`; expand to `pnpm test`
      repository-wide since this feature ships cross-session filesystem behavior.
- [x] T032 Execute quickstart.md §4 packaged manual acceptance on a fresh OS test profile
      (first-use copy + relative-asset render, update/conflict preservation with a differing
      factory fixture, Keep Current + third-fixture reprompt), recording SC-001…SC-007 evidence
      including identical before/after factory digests; capture results in the handoff notes or
      PR description.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001/T002 start immediately; T002 informs every later
  signature touchpoint.
- **Foundational (Phase 2)**: Depends on Setup; BLOCKS all user stories because every story reads
  the path boundary, manifest, or state store.
- **US1 (Phase 3)**: Depends on Phase 2; delivers the standalone MVP.
- **US2 (Phase 4)**: Builds on US1's service/flow skeletons (same files); independently testable
  once complete.
- **US3 (Phase 5)**: `merge-plan` (T021/T022) has no dependency on US1/US2 work and may proceed in
  parallel at any time after Phase 2; `prepareUpdate`/activation/recovery (T023–T027) build on the
  US1 transaction primitives in the same files.
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### Within Each Phase

- T003 → (T005, T007 in parallel) → (T006, T008 in parallel)
- Inspection (T010) precedes copy/commit primitives (T011, T012), which precede their transaction
  proof (T013); the flow coordinator (T014) consumes finished service primitives before its own
  proof (T015); wiring (T016) lands last in the story.
- Verification tasks accompany each behavior change per the constitution; none are deferred to a
  single trailing phase except cross-cutting audits (T028+).

### Parallel Opportunities

- T001 ∥ T002; T005/T007 and then T006/T008 within Phase 2; T009 anytime after T002.
- T021 ∥ T022 ∥ any US1/US2 task (pure module, distinct files).
- T020 guards unrelated behavior and can run alongside US2 implementation.
- Story-wise, a second contributor could take US3's merge-planner strand while the primary
  finishes US1/US2 on the service/flow strand.

---

## Parallel Example: User Story 3 (merge strand)

```bash
# Independent pure-policy strand — safe to start during Phase 2/3:
Task: "T021 Implement the pure merge planner in packages/blue-app/src/main/example-library/merge-plan.ts"
Task: "T022 Cover the full merge matrix in packages/blue-app/src/main/example-library/merge-plan.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (baseline + seam review) and Phase 2 (boundary/manifest/state).
2. Complete Phase 3: inspection → initial copy → journaled activation → first-use coordinator →
   `main.ts` wiring.
3. **STOP and VALIDATE**: from a protected fixture, Copy and Open reaches a rendered user-owned
   example and the factory tree hashes unchanged (quickstart §3A + §4A core).
4. Ship-ready MVP even if update machinery (US3) follows later — existing libraries simply keep
   working at their recorded revision.

### Incremental Delivery

1. Foundation → evidence-green pure layers.
2. +US1 → users on protected installations can open and render examples (MVP).
3. +US2 → repeat opens become silent and edit persistence is provable.
4. +US3 → release-to-release example delivery with conflict safety and crash recovery.
5. Polish gates + packaged manual acceptance close SC-001…SC-007.

---

## Notes

- Quickstart automated scenarios map to stories: §3A/§3B(initialize) → US1, §3B(update)/§3C/§3D/§3E
  → US3; §4 is the packaged manual pass tracked by T030–T032.
- FR-002 laziness is enforced structurally: only `main.ts` invokes the flow, which alone triggers
  recovery/inspection/hashing; no startup hooks exist anywhere in the plan.
- All durable JSON is versioned and lives outside `.blue` XML and `program-settings.json`
  (FR-017); state ownership tracing lives in data-model.md.
- Commit after each task or logical group; stop at any checkpoint to validate the story
  independently.

---

## Phase 7: Convergence

- [x] T033 CRITICAL restore `packages/blue-app/src/main/open-example-project-flow.ts` and its
      focused tests to prepare the candidate, open and validate the picker within candidate
      `content/`, parse the selection, pass the existing replacement gates, and only then commit
      and install the portability-mapped `current/content` path; every earlier cancellation or
      failure must abort the candidate and leave `current/` unchanged per Constitution V, plan:
      Key Design Decision 4, and T014–T015 (contradicts)
- [x] T034 Complete `packages/blue-app/src/main/example-library/service.ts` crash recovery and
      `service.test.ts` coverage for every update journal/rename window, including valid current
      plus valid staging at `prepared`, a `backup-created` journal before the backup rename,
      post-backup rename, and `activated` with a recorded backup, converging each case to exactly
      one valid generation with matched leftovers removed per FR-015 and T024–T025 (partial)
- [x] T035 Preserve journal-less or otherwise unproven `staging-*` directories and block mutation
      with an actionable `invalid-user-library` diagnostic unless Blue-owned provenance proves
      cleanup authority; cover ambiguous staging and mixed leftover layouts in
      `packages/blue-app/src/main/example-library/service.test.ts` per FR-015 and T024–T025
      (contradicts)
- [x] T036 Reject empty, unreadable, non-directory, and detectably incomplete factory example
      roots before initialization, then verify the complete initial candidate tree byte-for-byte
      against its manifest before activation; cover source drift and partial-copy claims across
      `example-project-path.test.ts` and `example-library/service.test.ts` per spec Edge Case 1,
      FR-005, and T009/T011/T012 (partial)
- [x] T037 Render the deterministic conflict total and bounded path-sorted affected-file samples
      supplied to `chooseContinueDespiteUpdateConflicts` in the native decision detail, with
      coordinator and main-wiring coverage, per FR-013 and T026 (partial)
- [x] T038 Propagate `recordDeclinedRevision` failures through the coordinator, fail closed without
      opening as though Keep Current was persisted, and offer an actionable retry/recovery outcome
      with focused atomic-write failure coverage per FR-014 and T026 (partial)
- [x] T039 Remove silent mapping of packaged or other out-of-root picker selections into the user
      library; reject them with the specified guidance to use Open Project while retaining
      realpath containment and realm-native path handling per plan: Key Design Decision 9 and T014
      (contradicts)
- [x] T040 Reuse one app-session `FactoryManifestProvider` across repeated Open Example actions so
      the installed factory tree is hashed once per resolved root while all copy/update work stays
      lazy, and prove the behavior at the main wiring boundary per plan: Performance Goals and
      T005/T017 (partial)
- [x] T041 Make the retryable copy/update failure action actually rerun the bounded
      recovery→inspection→preparation flow, or replace it with truthful actionable guidance that
      does not claim an immediate retry, and cover both retry success and repeated failure per
      FR-015 and T015/T026 (partial)
- [x] T042 Execute quickstart.md §4 packaged manual acceptance on a fresh OS profile and record
      SC-001…SC-007 results, including first-use relative-asset render, safe update/conflict and
      decline/reprompt behavior, recovery cases, and identical before/after factory-tree digests,
      in the handoff notes or PR description per SC-001…SC-007 and T032.
