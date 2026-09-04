# Feature Specification: Validated Cleanup Second Batch

**Feature Branch**: `099-cleanup-second-batch`

**Created**: 2026-09-04

**Status**: Complete — implementation and final convergence closed; supported-platform packaging remains CI-gated

**Completed**: 2026-09-04

**Input**: User description: "Set up the next bounded code-simplification batch, exclude the proposed BlueX7 `import.meta.glob` conversion, and add repository guidance against `import.meta.glob` in general."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Remove Confirmed Dead Maintenance Surface (Priority: P1)

As a maintainer, I encounter fewer unused scripts, configuration files, internal exports, and
store actions while supported development and application workflows continue to behave exactly
as before.

**Why this priority**: Deleting verified zero-consumer code provides the clearest simplification
benefit with the smallest behavioral risk.

**Independent Test**: Inventory every named candidate and its consumers, remove only candidates
with no supported use, and run the affected package and repository checks to confirm that all
documented workflows still operate.

**Acceptance Scenarios**:

1. **Given** a named deletion candidate with no production, test, script, configuration, or current-documentation consumer, **When** the cleanup is applied, **Then** the candidate and stale references are absent.
2. **Given** a candidate that proves to have an active or intentionally manual consumer, **When** the deletion gate is performed, **Then** that candidate is retained and recorded as outside this batch rather than having its consumer removed.
3. **Given** the engine client, renderer stores, and repository test configuration after cleanup, **When** their supported workflows run, **Then** no behavior depends on a removed surface.

---

### User Story 2 - Prefer Existing Platform Facilities (Priority: P2)

As a contributor, I can understand command-line option handling and snapshot copying without
maintaining duplicate general-purpose implementations already supplied by the supported runtime.

**Why this priority**: Removing small hand-written utilities reduces edge-case ownership while
preserving established behavior.

**Independent Test**: Exercise every supported OSC command-line option and representative
snapshot values before and after simplification, including invalid inputs and independent-copy
behavior.

**Acceptance Scenarios**:

1. **Given** any currently supported OSC sender invocation, **When** its arguments are processed after simplification, **Then** help, listing, command selection, custom addresses, host selection, port validation, error messages, and exit behavior remain equivalent.
2. **Given** a supported serializable project-editor snapshot, **When** a copy is made and the copy is mutated, **Then** the original remains unchanged and the copied value retains the same structure and values.
3. **Given** an unsupported or malformed command-line input, **When** it is processed, **Then** it fails clearly without sending a message.

---

### User Story 3 - Keep Asset Membership Explicit (Priority: P3)

As a maintainer, I can see fixed application asset membership directly in source review instead
of having files enter the application merely because their names match a filesystem pattern.

**Why this priority**: Explicit manifests make fixed, compatibility-sensitive asset sets easier
to audit and cause additions or removals to require an intentional source change.

**Independent Test**: Review the stable repository guidance, search application-owned source for
implicit glob imports, and confirm that the fixed BlueX7 algorithm image manifest remains
explicit and complete.

**Acceptance Scenarios**:

1. **Given** a contributor adds or changes a fixed asset set, **When** they consult repository guidance, **Then** they are directed to use explicit static imports rather than `import.meta.glob`.
2. **Given** a future feature genuinely requires automatic file discovery, **When** that exception is proposed, **Then** it must be explicitly specified and must validate the discovered membership and naming contract.
3. **Given** the 32 BlueX7 algorithm diagrams, **When** this cleanup is completed, **Then** their explicit number-to-image manifest and completeness coverage remain unchanged.

### Edge Cases

- A zero-reference script may still be a documented manual maintenance tool; current documentation and package scripts must be checked before deletion.
- A renderer store action may be called through direct state access rather than a component selector; all static call forms and tests must be included in its consumer audit.
- A snapshot may contain `undefined`, arrays, nested records, or another supported serializable value; simplification must preserve its copy behavior and must not broaden support to non-serializable runtime objects.
- OSC arguments may include the package-manager `--` separator, missing option values, unknown flags, invalid ports, or mutually exclusive command and address options.
- An automatic-discovery exception could match unintended files; any approved exception must reject missing, duplicate, malformed, and unexpected members deterministically.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The repository MUST remove `scripts/engine-realtime-automation-benchmark.mjs` only after confirming it has no supported package, documentation, test, or manual maintenance workflow.
- **FR-002**: The engine client MUST remove the unexported, zero-consumer automation diagnostic module while preserving every active protocol message, capability, client method, and public export.
- **FR-003**: The repository MUST remove `vitest.workspace.ts` and correct current documentation that presents it as active when package-level test configuration remains the supported workflow.
- **FR-004**: The cleanup MUST inventory the named renderer-store candidates from the original audit and remove only actions, state fields, slices, and routing helpers proven to have zero consumers across production code and tests.
- **FR-005**: Discovery of an active consumer MUST defer that store candidate; this feature MUST NOT broaden into redesigning or migrating an active workflow merely to enable deletion.
- **FR-006**: The OSC sender MUST use the supported runtime's standard argument-processing facility while preserving its current command-line contract and network-send behavior.
- **FR-007**: Duplicate general-purpose snapshot-copy implementations MUST be replaced by the supported runtime's native copy facility only where the values are already required to be serializable and behavior is equivalent.
- **FR-008**: Focused regression coverage MUST preserve OSC option behavior, copy independence, store behavior, and engine-client contracts affected by this batch.
- **FR-009**: Stable repository guidance MUST prohibit `import.meta.glob` as the default for application-owned source and require explicit static imports for fixed asset or module sets.
- **FR-010**: Any future `import.meta.glob` exception MUST be explicitly required by a feature specification, justified by intentional automatic discovery, and protected by deterministic membership and naming validation.
- **FR-011**: This feature MUST NOT replace the explicit 32-entry BlueX7 algorithm image manifest with automatic discovery.
- **FR-012**: The cleanup MUST retain `program-settings-usage.ts`, `verify-blue-x7-java-resources.mjs`, `EffectLibraryTree`, the workbench BlueX7 wrapper, `NextNoteBadge`, and `GeneratorRegistry`.
- **FR-013**: This batch MUST NOT consolidate dialogs, tabs, tree shells, sliders, pointer-drag behavior, clipboard stores, sound-object registries, migration infrastructure, OSC routing services, SQLite workers, IPC registration, typography enforcement, or release-workflow validation.
- **FR-014**: Supported project serialization, generated CSD, playback, rendering, settings, libraries, engine communication, and renderer behavior MUST remain unchanged.
- **FR-015**: Validation MUST begin with affected package checks and finish with repository tests, lint, builds, verification, and whitespace checks.

### Existing Behavior & Data Compatibility _(mandatory when applicable)_

- **Reference Behavior**: The current supported command-line, renderer-store, engine-client, project-editor snapshot, test, and build behavior is the baseline. Java Blue remains the reference for project XML and generated CSD behavior, although no intentional parity change is included.
- **Compatibility Requirements**: Existing projects must load, save, play, and render without change; OSC commands and diagnostics must retain their observable contracts; snapshot copies must remain independent; active store and engine-client consumers must remain intact.
- **Intentional Divergences**: Only confirmed zero-consumer maintenance surfaces and redundant internal implementations are removed. Repository guidance newly rejects implicit glob discovery by default. No user-visible application behavior is intended to diverge.
- **State Ownership**: `BlueData` and `.blue` XML remain the canonical project owners. Electron main retains host and engine ownership, renderer stores retain their existing session-state roles, and repository guidance owns no runtime state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every deleted artifact has zero remaining active references, and every named protected artifact remains present and covered by its existing consumers or tests.
- **SC-002**: All supported OSC sender scenarios produce equivalent success, help, listing, validation, and failure outcomes before and after simplification.
- **SC-003**: Representative supported snapshot values retain 100% structural equality immediately after copying and remain independent under nested mutation.
- **SC-004**: No application-owned source uses implicit glob imports after completion, and the repository guidance states the approval and validation conditions for any future exception.
- **SC-005**: All 32 BlueX7 algorithm image mappings remain explicit, resolvable, and covered by completeness checks.
- **SC-006**: Affected package checks and the full repository validation suite complete with zero new failures and zero whitespace errors.
- **SC-007**: Reviewers can distinguish dead-code deletion, store pruning, standard-facility substitutions, and guidance changes as separate reviewable slices.

## Assumptions

- Static and dynamic reference searches can identify the supported consumers of the named internal store and tooling candidates; ambiguous candidates are retained.
- `automation-errors.ts` remains unexported and unused when implementation begins; broader engine-client API pruning is outside this batch.
- The supported runtime's argument and copy facilities cover the existing inputs without compatibility wrappers.
- The BlueX7 algorithm set is fixed at 32 and benefits from an explicit manifest rather than automatic discovery.
- Repository-wide enforcement of the glob-import policy does not require a new permanent custom linter in this batch; stable guidance plus a final source audit is sufficient.

## Closure

All implementation and convergence tasks T001-T029 are complete. The final convergence audit found no remaining gaps against the functional requirements, acceptance scenarios, plan decisions, compatibility contract, or constitution.

The approved dead maintenance and store surfaces were removed, OSC parsing and renderer snapshot copying now use standard runtime facilities, and explicit-import guidance plus current BlueX7 resource verification are in place. Validation evidence is recorded in [quickstart.md](quickstart.md). Supported-platform packaging remains enforced by the existing CI workflows.
