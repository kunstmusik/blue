# Feature Specification: Large File Refactor — Project Store and Main Process

**Feature Branch**: `088-large-file-refactor`

**Created**: 2026-08-23

**Status**: Complete — implementation and local validation closed; native Windows and packaged verification follow-ups are recorded

**Completed**: 2026-08-23

**Input**: User description: "Create a new branch and spec for large-file-refactor for project-store.ts and main.ts."

Spec 087 established the repository's modularization review rule and completed the first-wave extractions for the score-object reducer, BlueData policy modules, auxiliary layout, and shared project-editor. This second wave applies that rule to the two highest-risk remaining modules: the renderer project store and the Electron main-process orchestrator. The objective is to improve responsibility locality and testability without changing project behavior, IPC contracts, state ownership, or lifecycle guarantees.

## Clarifications

### Session 2026-08-23

- Q: What must happen if the same IPC domain registrar is initialized twice without teardown? → A: Fail deterministically before duplicate handlers or listeners become observable; teardown remains idempotent.
- Q: If a domain registrar fails during startup, what cleanup scope is required? → A: Abort startup and unwind the failing registrar plus every registrar or service initialized by that startup sequence, in reverse order.

## Scope and Non-Goals

### In scope: project store

- Establish a store-independent seam for optimistic snapshot patching, beginning with `applyBsbInterfacePatchToSnapshot` and `shouldPreserveWidgetMetadataForBsbPatch`.
- Separate additional domain-specific snapshot reducers only when each has a coherent owner, narrow interface, and focused behavioral test.
- Isolate patch batching, revision acknowledgement, dirty-state tracking, and flush scheduling behind an explicit internal interface while preserving their ordering and failure behavior.
- Retain a stable `useProjectStore` façade for existing renderer consumers.

### In scope: main process

- Inventory every IPC handler and classify its state ownership, side effects, failure behavior, and lifecycle dependencies before moving it.
- Establish one project-session owner for the active project document, project path, revision/session identity, and related project-session state currently held in module-level variables.
- Extract domain-specific IPC registration and host-operation modules behind stable registration interfaces, with `main.ts` remaining the application composition root.
- Keep window lifecycle, startup ordering, shutdown ordering, and host adapters explicit and testable.

### Non-goals

- No new user-facing product behavior, IPC channel, renderer contract, project XML field, or persistence store.
- No change to canonical state ownership: the main process remains the owner of `BlueData`; the renderer store remains a projection and optimistic editing session.
- No unrelated security, subprocess, lint, or UI redesign work discovered during the refactor. Such changes require their own specification unless they are necessary to preserve the existing contract.
- No requirement to reduce either file below a particular line count. A cohesive implementation may remain large when the review rule finds no safe seam.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change One Renderer Domain Without Understanding the Whole Store (Priority: P1)

As a renderer maintainer, I need project snapshot transformations and store orchestration to have clear interfaces so that a change to one editing domain can be reviewed and tested without tracing the entire project store.

**Why this priority**: `project-store.ts` currently combines state construction, optimistic reducers, revision fencing, dirty-state flushing, and many domain actions. Improving locality here reduces the risk of renderer regressions across all project editors.

**Independent Test**: Apply representative BSB, score, mixer, orchestra, MIDI, and project-document patches through the extracted reducer interfaces and verify the resulting snapshots, revision decisions, and flush behavior against the existing store tests.

**Acceptance Scenarios**:

1. **Given** a BSB patch with nested widget metadata, **When** it is applied through the extracted optimistic patch seam, **Then** the snapshot and shared-reference behavior match the established reducer contract, including metadata preservation and aliasing semantics.
2. **Given** a patch that requires canonical project refresh, **When** it is submitted through the project store, **Then** the existing acknowledgement, revision, dirty-state, and refresh behavior remains unchanged.
3. **Given** a patch that does not require canonical refresh, **When** it is applied optimistically, **Then** the renderer receives the same immediate snapshot result and no new canonical refresh is introduced.
4. **Given** an existing renderer consumer importing from `project-store.ts`, **When** the implementation is modularized, **Then** the consumer continues to use the stable store façade without a broad import migration.

---

### User Story 2 - Change One Main-Process Domain Without Editing a God Module (Priority: P1)

As a main-process maintainer, I need project-session state and IPC domain registration to have explicit seams so that changes to file operations, editor updates, rendering, runtime services, or library operations remain localized.

**Why this priority**: `main.ts` combines application lifecycle, project replacement, window management, more than one hundred IPC handlers, runtime services, rendering, and shutdown. It is the highest-risk remaining locality problem.

**Independent Test**: Use the IPC inventory and project-session contract to exercise representative handler groups with injected host adapters, then verify that registration, state access, response/error behavior, and shutdown remain equivalent to the existing implementation.

**Acceptance Scenarios**:

1. **Given** an IPC handler that reads or mutates the active project, **When** it is moved behind a domain registrar, **Then** it obtains project state through the single project-session owner and preserves its existing request, response, error, and broadcast behavior.
2. **Given** two windows or renderer clients observing the same project, **When** a project mutation is accepted, **Then** revision ordering, snapshot broadcasts, stale-session rejection, and window targeting remain unchanged.
3. **Given** application startup and shutdown, **When** the new composition root initializes or tears down domain registrars, **Then** each service is initialized and disposed exactly once in the existing dependency order.
4. **Given** a domain registrar failure during startup, **When** the lifecycle operation handles the failure, **Then** startup aborts, the failing registrar's partial work and every registrar or service initialized earlier in that startup sequence are unwound in reverse order, and the existing top-level error and process-exit behavior remains intact.

---

### User Story 3 - Continue Working Without Noticing the Refactor (Priority: P1)

As a composer, I need opening, editing, saving, rendering, playback, runtime services, and closing projects to behave exactly as before so that an internal modularization does not change my workflow or project data.

**Why this priority**: Both target modules sit on critical project and host boundaries. Structural improvements are valuable only if observable behavior remains stable.

**Independent Test**: Run the affected package tests and representative end-to-end project workflows before and after each staged extraction, including project replacement, renderer edits, save/revert, render operations, runtime initialization, and application shutdown.

**Acceptance Scenarios**:

1. **Given** a project containing modeled and unknown XML data, **When** it is opened, edited, saved, and reopened after the refactor, **Then** project data is preserved with the same canonical ownership and serialization behavior.
2. **Given** an active renderer session with queued patches, **When** patches flush or a newer revision arrives, **Then** no stale patch is committed and the existing dirty-state behavior is preserved.
3. **Given** a render, freeze, playback, or runtime operation in progress, **When** the user cancels, replaces the project, or quits, **Then** the existing mutual exclusion, cancellation, cleanup, and shutdown guarantees remain intact.
4. **Given** a renderer invokes every existing IPC channel, **When** the refactored main process handles the request, **Then** channel names, serializable payloads, success values, error behavior, and relevant events remain compatible.

---

### User Story 4 - Review and Revert the Refactor Safely (Priority: P1)

As a reviewer, I need each extraction to show its responsibility, interface, state owner, test seam, and rollback boundary so that high-risk host changes can be accepted incrementally or reverted without reconstructing the original architecture.

**Why this priority**: The risk is concentrated at shared state and lifecycle boundaries. Reviewable, independently revertible steps are a functional requirement of this work.

**Independent Test**: Inspect the boundary maps and staged changes, run the focused checkpoint for each seam, and verify that reverting one seam does not require reverting unrelated seams.

**Acceptance Scenarios**:

1. **Given** a proposed project-store extraction, **When** a reviewer examines it, **Then** the reducer or orchestration interface is smaller than the implementation it hides, its canonical owner is named, and its lowest practical test seam is identified.
2. **Given** a proposed main-process registrar, **When** a reviewer examines it, **Then** every moved handler has a documented owner, registration order, lifecycle dependency, and compatibility test.
3. **Given** an extraction with no coherent responsibility or test seam, **When** it is reviewed, **Then** it is deferred with a concrete revisit condition rather than split into speculative helpers.

### Edge Cases

- What happens when a BSB patch relies on shared nested references? The established aliasing and metadata behavior is treated as a contract; the refactor must not silently deep-copy or purify it.
- What happens when a renderer patch is acknowledged out of order? Revision fences and stale-session rejection must remain authoritative, with no second state owner introduced.
- What happens when a patch queue is flushed while a project is replaced or closed? The existing cancellation, invalidation, and dirty-state guarantees must remain intact.
- What happens when an IPC registrar is initialized twice? Registration must fail deterministically before duplicate handlers or listeners are observable; teardown remains idempotent.
- What happens when IPC registration order affects a handler or listener? The order must be recorded as an interface invariant and preserved until an intentional change is separately approved.
- What happens when a handler depends on startup-created services? The dependency must be explicit in the registrar interface; hidden reads of module-level initialization state are not an acceptable seam.
- What happens when startup partially fails? The failing registrar must undo its partial work, then the composition root must unwind every registrar or service initialized earlier in that startup sequence in reverse order before following the existing top-level error and process-exit behavior.
- What happens when shutdown partially fails? Cleanup must remain ordered, idempotent, and fail-safe, including renderer windows, engine/runtime services, temporary sessions, and project state.
- What happens when a project contains unknown XML or unavailable host-backed runtime data? The refactor must preserve it without silent loss or accidental ownership transfer.
- What happens when a proposed split creates a dependency cycle between a pure reducer, store, registrar, and adapter? The split is redesigned or deferred according to `docs/modularization.md`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Before implementation moves behavior, the project MUST record a boundary inventory for `project-store.ts` and `main.ts` covering responsibility, callers, state reads/writes, side effects, error behavior, lifecycle dependencies, test coverage, and rollback unit.
- **FR-002**: The first implementation seam in `project-store.ts` MUST isolate store-independent optimistic snapshot patching, beginning with `applyBsbInterfacePatchToSnapshot` and `shouldPreserveWidgetMetadataForBsbPatch`, behind a deliberately small interface.
- **FR-003**: The BSB snapshot seam MUST preserve the established shallow-copy, nested-reference aliasing, widget metadata, preset, and structured-patch behavior. Replacing it with deep copying or a semantically cleaner reducer is out of scope.
- **FR-004**: Additional project-store reducers MUST be grouped by demonstrated responsibility and dependency direction, not by arbitrary line ranges. Pure transformations MUST NOT import Zustand, React, IPC, or host adapters.
- **FR-005**: Patch batching, revision acknowledgement, dirty-state tracking, refresh classification, and flush scheduling MUST have one explicit owner and MUST preserve existing ordering, coalescing, invalidation, error, and retry behavior.
- **FR-006**: `useProjectStore` and existing renderer-facing imports MUST remain compatible through a stable façade, re-export, or thin delegate. No broad consumer migration is required for the structural refactor.
- **FR-007**: The renderer project store MUST remain a projection and optimistic editing session. It MUST NOT become the canonical owner of `BlueData`, project XML, or durable project persistence.
- **FR-008**: Before extracting main-process handlers, the implementation MUST classify every existing IPC handler by domain owner, state owner, registration order, side effects, async behavior, response/error contract, and verification target. No handler may be left without an owner.
- **FR-009**: The active project document, project path, project revision/session identity, and related project-session state currently held in main-process module-level variables MUST have one explicit project-session owner. Direct duplicate writes from registrars are prohibited.
- **FR-010**: Main-process IPC domain registrars MUST expose a narrow registration interface and MUST keep host-specific filesystem, process, Electron, Java-runtime, engine, and window operations in main-process adapters or orchestration modules.
- **FR-011**: `main.ts` MUST remain the application composition root for startup, window lifecycle, registrar wiring, and ordered shutdown. Extracted modules MUST NOT create a second application lifecycle owner.
- **FR-012**: Existing IPC channel names, serializable request and response shapes, success values, error behavior, event ordering, broadcast targeting, and renderer-facing failure semantics MUST remain compatible.
- **FR-013**: IPC registrar initialization MUST fail deterministically when invoked twice without teardown, before duplicate handlers or listeners are observable. A registrar that fails after partial initialization MUST undo its partial work, and the composition root MUST then unwind every registrar or service initialized earlier in that startup sequence in reverse order before following the existing top-level error and process-exit behavior. Teardown MUST be deterministic and idempotent. The refactor MUST preserve current startup ordering, listener ownership, single-active-operation rules, and ordered shutdown behavior.
- **FR-014**: Project loading, replacement, save, revert, render, freeze, playback, runtime initialization, and close/quit flows MUST preserve their existing state transitions, cancellation behavior, cleanup, and failure recovery.
- **FR-015**: `.blue` XML remains the canonical project format. The refactor MUST preserve modeled and unknown data, raw XML migration behavior, Java-compatible serialization, and CSD/render output whenever those paths are touched.
- **FR-016**: Every accepted extraction MUST retain or add focused automated verification at the lowest practical seam, while existing store, main-process, IPC, project replacement, runtime, rendering, and lifecycle tests continue to exercise the stable façades.
- **FR-017**: Mechanical movement MUST be separated from semantic changes. Any dead-code removal, behavior correction, contract change, or security fix discovered during implementation MUST be separately recorded and approved rather than hidden inside the refactor.
- **FR-018**: Each seam MUST have an independently reviewable and revertible change boundary, with a documented compatibility strategy, canonical state owner, dependency direction, test checkpoint, and rollback procedure.
- **FR-019**: `docs/modularization.md` MUST be updated with accepted boundary maps and any retained or deferred seams for both target files, including explicit reasons when a portion remains cohesive.
- **FR-020**: Validation MUST run affected package tests first, including renderer store and main-process/IPC checkpoints, then relevant builds and repository-wide `pnpm test` and `pnpm lint` when the extracted boundaries span packages. Any exception MUST document residual risk and follow-up ownership.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: This is a structural refactor. Existing TypeScript tests, IPC contract tests, project replacement tests, runtime/lifecycle tests, and saved-project fixtures are the primary behavior oracles. Java Blue remains the reference for any affected `.blue` XML, CSD, rendering, migration, or formatting behavior.
- **Compatibility Requirements**: Existing renderer imports and store behavior remain usable; every existing IPC channel and event remains compatible; project loading, saving, replacement, revision fencing, optimistic updates, rendering, runtime services, and ordered shutdown preserve their observable behavior; `.blue` data and generated outputs remain lossless and Java-compatible where already required.
- **Intentional Divergences**: None. This feature changes module placement and ownership clarity only. Any intended behavior change must be split into a separately specified feature or explicitly approved before implementation.
- **State Ownership**: The main process and its project-session owner remain canonical for the active `BlueData` document, project path, revision, and host lifecycle state. The renderer project store remains transient snapshot/optimistic state. IPC contracts remain typed, serializable, and preload-mediated; no renderer or extracted pure module may gain host ownership.

### Key Entities *(include if feature involves data)*

- **Project Store Façade**: The stable renderer-facing interface that exposes project snapshots, optimistic actions, revision handling, and persistence synchronization without exposing internal reducer modules.
- **Snapshot Reducer**: A pure or store-independent transformation that applies a typed patch to a renderer snapshot while preserving the existing optimistic semantics.
- **Patch Queue Coordinator**: The owner of batching, revision fences, dirty-state transitions, canonical refresh classification, and flush scheduling.
- **Project Session**: The main-process owner of the active project document, path, revision/session identity, and project replacement lifecycle state.
- **IPC Domain Registrar**: A focused main-process module that registers a coherent group of existing IPC handlers against injected or explicitly owned host dependencies without changing their external contracts.
- **Boundary Map**: The review record for a seam: responsibility, façade/interface, dependencies, canonical state owner, test seam, compatibility strategy, and rollback boundary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing `project-store.ts` and `main.ts` responsibilities identified in the boundary inventory have an accepted owner, an explicit defer decision, or a documented revisit condition before implementation begins.
- **SC-002**: The BSB snapshot seam is independently testable and preserves 100% of its existing aliasing, metadata, preset, and structured-patch regression cases.
- **SC-003**: 100% of existing IPC handlers have a documented domain owner and compatibility checkpoint; zero handler names, payload contracts, or event contracts change as part of this refactor.
- **SC-004**: All affected project-store, project replacement, IPC, runtime, rendering, and lifecycle tests pass with zero unexplained behavior, XML, CSD, snapshot, or event-output changes.
- **SC-005**: The refactor introduces zero new circular dependencies, duplicate canonical state owners, duplicate IPC registrations, or unowned lifecycle side effects.
- **SC-006**: Every accepted seam can be reverted independently, and a reviewer can identify its interface, state owner, lowest practical test seam, and rollback unit from the boundary map.
- **SC-007**: Existing user workflows for project open, edit, save, revert, render, playback, runtime use, project replacement, and quit complete with the same observable outcomes before and after the refactor.
- **SC-008**: The final implementation leaves a documented follow-up or retain decision for any remaining portions of either file rather than creating speculative helper modules solely to reduce line count.

## Completion Evidence

Implementation and local validation were closed on 2026-08-23. All tasks T001 through T068 are
complete. The renderer façade now delegates BSB snapshot mutation and patch-queue coordination to
focused modules; the main process uses one `ProjectSession`, explicit project lifecycle and startup
rollback owners, transactional registration leases, and five domain registrars while retaining
`main.ts` as the application composition and normal-shutdown owner.

The executable inventory proves all 177 inbound IPC endpoints retain their exact channel, mode,
startup order, failure rollback, and teardown contracts. Project replacement tests prove
open/new/save/save-as/revert/close ordering and modeled-plus-unknown XML preservation. Runtime and
renderer tests cover cancellation, cleanup, session/revision fencing, canonical refresh ordering,
and project-replacement isolation.

Final validation passed:

- `pnpm --filter @blue/app test`: 375 files; 3,643 passed and 2 skipped.
- `pnpm test`: all workspace, native engine, Java, CLI, application, and repository script tests.
- `pnpm lint` and the main/preload/renderer builds.
- `git diff --check` and the focused registrar, lifecycle, replacement, renderer, and runtime suites.

Manual sanity testing was user-confirmed with no observed regressions. Exact evidence, transient
test-environment retries, rollback units, retained responsibilities, and the remaining native
Windows/packaged follow-up ownership are recorded in
[implementation-notes.md](implementation-notes.md) and [docs/modularization.md](../../docs/modularization.md).
No follow-up changes the closed scope or authorizes a behavior or contract divergence.

## Assumptions

- This is an internal maintainability effort; no new product capability is required for acceptance.
- The current behavior and test suite are the baseline. Pre-existing failures will be recorded before attribution to this feature.
- Stable façades and re-exports are preferred over broad import migrations during the first implementation.
- IPC registration order, error behavior, event ordering, and shutdown ordering are treated as observable contracts unless tests and review prove otherwise.
- Project-store reducers may remain grouped when their semantics are tightly coupled; the review rule does not require a separate file for every reducer family.
- `main.ts` may remain a composition root with meaningful wiring code after extraction; success is measured by locality and explicit ownership, not an arbitrary line-count target.
- Any Java parity investigation is limited to persistence, rendering, formatting, or migration behavior affected by the refactor.
