# Feature Specification: Large Module Refactoring Foundations

**Feature Branch**: `087-refactor-large-files`

**Created**: 2026-08-22

**Status**: In progress — first-wave implementation, automated validation, and seam commits complete; interactive manual validation remains pending (2026-08-22)

**Input**: User description: "Review the codebase for large files that can be modularized like main.ts and project-store.ts, then establish a carefully designed refactoring effort with best practices for the codebase."

The codebase contains several large modules that combine contracts, pure transformations, persistence, UI coordination, and host adapters. This makes behavior harder to locate, increases the cost of safe changes, and makes ownership boundaries implicit. This feature establishes a repeatable modularization approach and applies it to the highest-confidence seams while preserving observable behavior.

## Scope and Non-Goals

The first delivery covers four high-confidence refactoring seams:

- The shared project-editor contract, snapshot, and document-patch responsibilities.
- The auxiliary workbench layout model, persistence/migration behavior, and Dockview integration.
- The BlueData aggregate's XML and CSD policy responsibilities.
- The pure optimistic score-object document reducer currently colocated with its React editor panel.

The large main-process IPC module and project store remain explicit follow-up work. The score timeline canvases, unified-library service, and workbench store also remain in the follow-up inventory unless planning discovers a small, independently verifiable seam. This feature does not require splitting every large file or achieving a particular line count.

This is a structural refactor. It does not add user-facing product behavior, change the project format, alter IPC semantics, or replace canonical state owners.

## Clarifications

### Session 2026-08-22

- Q: Where should the extracted pure score-object document reducer live after it is removed from ScoreObjectEditorPanel.tsx? → A: A renderer-local pure module (no React dependency, not moved into `@blue/data` or app `src/shared/`), keeping optimistic renderer semantics out of the canonical data package.
- Q: Should newly extracted modules become public exports of their package, or stay internal behind the compatibility façade? → A: Internal-first — extracted modules stay internal to their package; the façade re-exports only what was previously public, and new public exports require a demonstrated external consumer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make Domain Responsibilities Easy to Locate (Priority: P1)

As a maintainer, I need the identified large modules to have focused responsibilities so that I can change one domain without tracing unrelated UI, persistence, or runtime behavior.

**Why this priority**: Improving change locality is the primary value of the refactor and the foundation for safely addressing the remaining large modules later.

**Independent Test**: Review each first-wave boundary map and locate the owner for contracts, pure transformations, persistence, and host/UI integration without following unrelated implementation paths.

**Acceptance Scenarios**:

1. **Given** the shared project-editor behavior, **When** a maintainer needs to change a contract, snapshot builder, or canonical patch, **Then** each responsibility has one clearly identified module and the existing public entry point remains usable.
2. **Given** the auxiliary layout behavior, **When** a maintainer needs to change a migration, state transition, or Dockview operation, **Then** the change is localized to the corresponding responsibility rather than the entire layout implementation.
3. **Given** the BlueData behavior, **When** a maintainer needs to change XML persistence or CSD rendering, **Then** the aggregate façade remains stable while the relevant policy is independently testable.

---

### User Story 2 - Preserve Existing Projects and Workflows (Priority: P1)

As a composer, I need the refactoring to be invisible in normal use so that opening, editing, saving, rendering, and arranging projects remain as reliable as before.

**Why this priority**: These modules sit on project persistence, score editing, and workbench state. A structural improvement is not acceptable if it changes project data or editor behavior.

**Independent Test**: Run the affected package tests and compatibility fixtures before and after each extraction, then exercise representative project load/save, CSD generation, score-object editing, and layout restore flows.

**Acceptance Scenarios**:

1. **Given** a project containing known and unknown project data, **When** it is loaded and saved after the refactor, **Then** modeled values, unknown values, and structural XML compatibility are preserved.
2. **Given** a project whose CSD output is covered by an existing parity fixture, **When** CSD is generated after the refactor, **Then** the output remains compatible with the established fixture unless an intentional divergence is explicitly approved.
3. **Given** a saved workbench layout from every supported legacy layout version, **When** it is restored after the refactor, **Then** the same panels, positions, minimized state, and presentation behavior are recovered.
4. **Given** a score-object editor patch, **When** it is applied through the extracted pure reducer, **Then** the resulting document is identical to the result produced before extraction.

---

### User Story 3 - Review Incremental Refactors With Confidence (Priority: P1)

As a reviewer, I need each modularization step to expose its assumptions, ownership, compatibility façade, and verification evidence so that a refactor can be accepted or reverted independently.

**Why this priority**: The main risk is accidental behavior change hidden inside a large mechanical move. Explicit seams and focused verification make the work auditable.

**Independent Test**: Inspect the refactor plan and resulting changes for each first-wave seam, verify that the change has a bounded responsibility, and run the listed focused tests without requiring unrelated feature work.

**Acceptance Scenarios**:

1. **Given** a proposed extraction, **When** a reviewer examines it, **Then** the old public entry point, new internal interface, canonical owner, and rollback boundary are documented.
2. **Given** a module that has no safe seam, **When** it is reviewed, **Then** it is explicitly deferred with a reason rather than split into arbitrary helper files.
3. **Given** a refactor that affects more than one package boundary, **When** verification is planned, **Then** package-level tests run first and broader validation is added in proportion to the boundary risk.

---

### User Story 4 - Have a Repeatable Rule for Future Large Modules (Priority: P2)

As a maintainer, I need a documented decision rule for modularization so that future work does not optimize for line count at the expense of cohesion, locality, or stable interfaces.

**Why this priority**: The codebase will continue to grow. A durable rule prevents the same architectural problem from reappearing after this refactor.

**Independent Test**: Apply the decision rule to the deferred modules and confirm that it identifies a responsibility boundary, a compatibility strategy, and a lowest-level verification target before implementation begins.

**Acceptance Scenarios**:

1. **Given** a large but cohesive domain module, **When** the rule is applied, **Then** it may be retained with a documented rationale.
2. **Given** a module containing independent state, persistence, and adapter responsibilities, **When** the rule is applied, **Then** it identifies focused seams and orders them by risk and value.
3. **Given** an extraction proposal that adds abstractions without a demonstrated consumer or test seam, **When** it is reviewed, **Then** the proposal is rejected or deferred until a concrete need exists.

### Edge Cases

- What happens when existing callers import many symbols from a module being split? A compatibility façade or staged migration must preserve those callers until an intentional API migration is approved.
- What happens when a proposed extraction would create a circular dependency? The seam must be redesigned or deferred; circular dependencies are not an acceptable consequence of modularization.
- What happens when pure logic unexpectedly needs Electron, Node.js, DOM, or Dockview behavior? The host-specific behavior remains behind an adapter and the pure module is kept host-neutral.
- What happens when the canonical project document and an optimistic renderer snapshot have similar patch operations? They remain separate responsibilities unless their semantics are proven identical; the refactor must not merge them merely to reduce file count.
- What happens when XML or CSD output changes during a move? The change is treated as a regression and investigated against Java Blue and existing fixtures before the refactor proceeds.
- What happens when a legacy auxiliary-layout migration is moved? Every supported version remains covered by migration and round-trip tests.
- What happens when a large module has no clean boundary? The module is recorded in the follow-up inventory with the rejected seam and rationale.
- What happens when the baseline already has a failing test? The failure is recorded before extraction and is not silently attributed to the refactor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The first delivery MUST establish and apply a modularization pattern to the four first-wave seams identified in Scope and Non-Goals: shared project-editor responsibilities, auxiliary layout responsibilities, BlueData persistence/rendering responsibilities, and the score-object document reducer.
- **FR-002**: Each first-wave seam MUST have one documented responsibility map identifying its public façade, extracted responsibilities, canonical state owner, dependency direction, and lowest practical test boundary.
- **FR-003**: Extracted modules MUST have one primary domain responsibility and a deliberately small interface. A split MUST NOT be justified by line count alone, and the refactor MUST NOT introduce speculative abstractions without a demonstrated consumer or test seam.
- **FR-004**: Existing public imports, renderer behavior, IPC channels, and host-facing entry points MUST remain compatible during the first delivery, using a façade, re-export, or explicitly approved staged migration where necessary. Newly extracted modules MUST stay internal to their package (the façade re-exports only what was previously public); a new public export requires a demonstrated external consumer.
- **FR-005**: The refactor MUST NOT introduce circular dependencies, increase coupling across package boundaries, or move host-specific behavior into the portable data package.
- **FR-006**: Canonical state ownership MUST remain unchanged: the main process owns the active `BlueData` project document; renderers consume serializable snapshots and send typed patch intents; app settings, library state, layout state, and generated artifacts remain in their existing stores.
- **FR-007**: Project XML loading and saving MUST preserve modeled and unknown data, legacy migration behavior, and established Java-compatible structure. No new persistence location or serialization format may be introduced by this refactor.
- **FR-008**: CSD generation and rendering behavior MUST remain compatible with existing Java-parity fixtures and deterministic output tests. Any intentional divergence MUST be named, justified, and approved before implementation.
- **FR-009**: Auxiliary layout behavior MUST preserve supported legacy migrations, validation, panel placement, minimized and slideout state, Dockview synchronization, and restore behavior.
- **FR-010**: The extracted score-object document reducer MUST live in a renderer-local pure module with no React dependency and MUST NOT be moved into `@blue/data` or app `src/shared/` modules. It MUST preserve all existing patch semantics, including tracker, audio, JMask, BSB, automation, and shared-property updates, while remaining independently testable without mounting the React editor panel.
- **FR-011**: Every moved behavior MUST retain or gain focused automated verification at the lowest practical boundary. Existing integration, parity, and UI tests MUST continue to cover the façade and end-to-end behavior.
- **FR-012**: Refactoring work MUST be staged so that each first-wave seam can be reviewed, tested, and reverted independently from the others. Mechanical moves and semantic changes MUST NOT be mixed without explicit justification.
- **FR-013**: The implementation plan MUST record the deferred modularization inventory for `main.ts`, `project-store.ts`, the score timeline canvases, `unified-library/service.ts`, and `workbench-store.ts`, including the next candidate seam, risk, and reason for deferral.
- **FR-014**: The implementation MUST include a reusable review rule covering responsibility cohesion, interface size, dependency direction, state ownership, compatibility strategy, test seam, and rollback boundary for future large-module proposals.
- **FR-015**: Validation MUST run affected package tests first, followed by type checking, linting, and repository-wide tests when the changed boundaries span packages. Any scoped validation exception MUST be documented with its reason and residual risk.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: This feature is a structural refactor rather than a new user behavior. Java Blue remains the reference for any affected XML, CSD, rendering, formatting, migration, or editor-parity behavior. Existing TypeScript tests and fixtures are the baseline for non-Java UI and runtime behavior.
- **Compatibility Requirements**: `.blue` remains the canonical project format; modeled and unknown data must round-trip; CSD and rendering output covered by parity fixtures must remain compatible; existing IPC and renderer contracts must remain usable; auxiliary layout versions must continue to migrate; score edits and optimistic snapshots must produce the same results; no user-facing workflow may change.
- **Intentional Divergences**: None. The feature changes module boundaries only. Any behavior change discovered during implementation must be split into a separately specified change or explicitly approved as a necessary correction.
- **State Ownership**: The active project document remains owned by the Electron main process through `BlueData`. Renderer snapshot and optimistic-edit state remains renderer session state and must not become project XML. Auxiliary layout and workbench session state remain outside `.blue`; generated CSD/audio artifacts remain derived outputs with their existing owners.

### Key Entities *(include if feature involves data)*

- **Module Boundary Decision**: A documented choice describing a responsibility owner, interface, dependency direction, compatibility strategy, test seam, and rollback boundary.
- **Compatibility Façade**: The stable entry point that preserves existing callers while implementation responsibilities move behind narrower modules.
- **Canonical Project Document**: The main-process-owned `BlueData` state whose XML, CSD, and mutation behavior must remain unchanged by structural extraction.
- **Renderer Snapshot or Optimistic Reducer**: Disposable renderer-side state or pure transformation logic that must remain distinct from canonical project mutation.
- **Deferred Refactoring Inventory**: The prioritized record of large modules not included in the first delivery, with candidate seams, risks, and reasons for deferral.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Four first-wave responsibilities have focused module owners and documented boundaries, while their existing public entry points remain usable without a breaking migration.
- **SC-002**: 100% of existing targeted XML, CSD, layout-migration, score-editor, and renderer contract tests pass after each corresponding extraction, with zero unexplained fixture or snapshot changes.
- **SC-003**: The refactor introduces zero new circular dependencies and zero unexplained changes to package dependency direction or canonical state ownership.
- **SC-004**: Each first-wave extraction has at least one focused test target that can run without exercising unrelated responsibilities, and each extraction can be reverted independently.
- **SC-005**: A maintainer can identify the owner and test seam for every first-wave responsibility from the boundary documentation without reading the entire original large file.
- **SC-006**: The deferred inventory contains all five named follow-up modules, each with a proposed next seam, risk classification, and explicit reason it is not part of the first delivery.
- **SC-007**: The affected package validation and repository-wide validation required by the implementation plan complete successfully, or every exception is documented with residual risk and an owner for follow-up.

## Assumptions

- This feature is an internal maintainability effort; no new product capability is required for acceptance.
- Existing public entry points are preserved first; cleanup of compatibility façades is a later, separately reviewed change.
- The first delivery is allowed to leave some files large when they are cohesive or when no safe seam has been established.
- Existing tests and fixtures are treated as behavioral contracts, but a baseline failure must be recorded before attributing it to this work.
- Java source and generated artifacts will be consulted only for affected parity surfaces; a pure UI/store extraction does not require inventing a Java analogue.
- No new persistent data, project XML fields, IPC channels, or runtime dependencies are introduced.
