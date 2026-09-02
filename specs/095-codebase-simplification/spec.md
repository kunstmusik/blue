# Feature Specification: Codebase Simplification & Overengineering Reduction

**Feature Branch**: `095-codebase-simplification`

**Created**: 2026-09-02

**Status**: Complete — implementation and convergence closed; pre-existing BlueX7 render-hash mismatch retained

**Completed**: 2026-09-02

**Input**: User description: "Codebase simplification and overengineering reduction across @blue/data, @blue/app, and blue-engine-client based on ponytail-audit findings"

## Clarifications

### Session 2026-09-02

- Q: Which scope should the plan treat as authoritative? → A: Named inventory only: limit work to artifacts explicitly listed in the spec.
- Q: Should the explicitly named dead artifacts remain available through package exports? → A: Remove definitions, exports, and internal references completely.
- Q: How should test completion account for pre-existing failures? → A: Capture the existing test baseline; targeted and new tests must pass with no new failures elsewhere.
- Q: Should Spec 093 diagnostic tracing retain an opt-in debug path? → A: Remove all tracing infrastructure and opt-in paths.
- Q: What error behavior must native cause preserve? → A: Preserve messages, types, and causal context.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elimination of Dead Java Parity Infrastructure (Priority: P1)

Developers and maintainers working on the `@blue/data` core package encounter legacy mirror classes and interfaces that were ported from Java Swing architectures (`LayerGroupProviderManager`, Swing event listeners, and static clipboards) but are never invoked by the application. Removing these unused classes and dead code paths cleans up the data core without altering `.blue` project file serialization, audio rendering, or Java compatibility.

**Why this priority**: Eliminates the most pervasive dead code across the project core with zero risk to existing project files or runtime features.

**Independent Test**: Can be tested independently by running `@blue/data` test suites and verifying that `.blue` XML roundtrip, project loading/saving, and CSD compilation produce identical results.

**Acceptance Scenarios**:

1. **Given** an existing `.blue` project file containing track layers, pattern layers, or poly objects, **When** the project is loaded via `BlueData.loadFromString()`, **Then** all score elements load losslessly through direct element deserializers without encountering provider registry errors.
2. **Given** score layer groups in memory, **When** mutations occur in the score, **Then** state transitions remain deterministic without dispatching unused Swing-era event objects.
3. **Given** a duplicate or copy operation within the application, **Then** clipboard operations use app-owned domains without relying on `@blue/data`'s static `CopyBuffer`.

---

### User Story 2 - Platform & Standard Library Modernization (Priority: P2)

The application code replaces hand-rolled utility algorithms (such as fallback UUID byte manipulation, manual collision math in dropdowns, and custom error chaining) with standard Web and Node.js platform features (`crypto.randomUUID()`, `@floating-ui/dom`, native `Error` cause).

**Why this priority**: Aligns the codebase with standard runtime primitives supported by Electron 35 and Node 20+, eliminating fragile home-grown algorithms and reducing maintenance overhead.

**Independent Test**: Can be tested independently by verifying that generated UUIDs conform to RFC 4122 v4, and dropdown menus in settings position correctly within all viewports.

**Acceptance Scenarios**:

1. **Given** any component requiring a unique identifier, **When** `generateUuid()` is invoked, **Then** it produces a standard RFC 4122 v4 UUID string using `crypto.randomUUID()`.
2. **Given** the device selection dropdown in application settings, **When** opened near the edge of the viewport, **Then** it positions and constrains itself using `@floating-ui/dom` via `useHostSurface` without clipping or overflowing.

---

### User Story 3 - Main Process Architectural Pruning (Priority: P3)

The Electron main process contains transient diagnostic tracing machinery created during prior troubleshooting (Spec 093 editor-open audio glitch diagnosis) and an over-engineered IPC channel slice-ordering coordinator. Pruning the disabled-by-default diagnostic coordinator and flattening IPC handler registration to direct `ipcMain.handle()` registrations simplifies main process lifecycle management.

**Why this priority**: Cleans up substantial code bloat (~900 lines) in the main process and makes IPC channel ownership easier to inspect and maintain.

**Independent Test**: Can be tested independently by running Electron main process integration tests and verifying that all IPC channels respond correctly and editor windows open smoothly.

**Acceptance Scenarios**:

1. **Given** the application running in production, **When** editor windows are opened, reopened, or closed, **Then** window management proceeds directly without allocating attempt/run diagnostic tracing objects.
2. **Given** renderer requests dispatched over IPC, **When** invoked by renderer stores or preload bridges, **Then** handlers respond cleanly with identical contracts and error behaviors.

---

### Edge Cases

- What happens if a legacy `.blue` XML file created with Java Blue contains unrecognized layer group elements? Deserialization continues to preserve unmodeled XML nodes per Principle II.
- What happens if `blue-cli` is executed in a standalone Node environment? `quickjs-emscripten` remains declared in `blue-cli/package.json` so the bundled CLI resolves QuickJS runtime dependencies without error.
- What happens if `crypto.randomUUID` is evaluated in Node or browser test environments? Modern Node (20+) and modern Chromium engines provide `crypto.randomUUID()` globally on `globalThis.crypto`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST preserve lossless `.blue` XML loading, saving, and roundtrip serialization for all supported project models.
- **FR-002**: System MUST preserve full CSD generation and playback fidelity across disk render, realtime playback, and Blue Live modes.
- **FR-003**: System MUST generate RFC 4122 v4 UUIDs using standard `crypto.randomUUID()`.
- **FR-004**: System MUST position floating settings surfaces using `@floating-ui/dom` via `useHostSurface`.
- **FR-005**: System MUST register all required IPC handlers and listeners on Electron main process startup without relying on interleaved registration sequencing arrays.
- **FR-006**: System MUST retain `quickjs-emscripten` in `blue-cli` dependencies to support standalone execution.
- **FR-007**: System MUST maintain full Java parity for numeric formatting, CSD orchestra/score generation, and project properties.
- **FR-008**: Simplification work MUST be limited to the cleanup targets explicitly named in this specification; other `ponytail-audit` findings are out of scope.
- **FR-009**: Explicitly named dead artifacts MUST be removed from package exports and in-repository references; deprecated compatibility shims are out of scope.
- **FR-010**: Replacing manual error chaining with native `Error.cause` MUST preserve existing externally observable error messages, error types, and causal context across application and IPC flows.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue data models in `blue-core` and NetBeans UI in `blue-ui-core`.
- **Compatibility Requirements**: `.blue` XML structure, generated CSD text, audio playback fidelity, and project document mutations MUST remain strictly compatible with existing baseline fixtures.
- **Intentional Divergences**:
  - Removal of Java Swing-specific `LayerGroupListener`, `LayerGroupDataEvent`, and `AutomatableCollectionListener` interfaces (reactivity is handled by Zustand and immutable snapshots).
  - Removal of Java ArrayList collision workaround `deepCopyLG()` in favor of standard `deepCopy()`.
  - Removal of unused data-layer static `CopyBuffer` (UI components own their respective clipboard state).
- **State Ownership**: Electron main remains the canonical owner of the active `BlueData` project document; renderers consume serializable snapshots and submit patch intents.

### Key Entities

- **BlueData**: Root project document owner managing global settings, tables, instruments, mixer, and score.
- **Score & LayerGroups**: Hierarchical containers for tracks, pattern layers, and polyphonic score objects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All explicitly named dead Java Swing mirror artifacts (`LayerGroupProviderManager`, Swing listener interfaces, static `CopyBuffer`, and empty marker interfaces) are eliminated from `@blue/data` with zero remaining references in production source.
- **SC-002**: Identified hand-rolled utility algorithms (`uuid.ts` fallback byte masking, `floating-position-utils.ts` collision math, manual error cause wrapping) are replaced with standard Web/Node platform primitives (`crypto.randomUUID()`, `@floating-ui/dom` via `useHostSurface`, native `Error`) while preserving existing observable error messages, types, and causal context, and passing all conformance tests.
- **SC-003**: Transient diagnostic tracing classes and coordinator wiring from Spec 093, including any opt-in debug path, plus interleaved channel ordering arrays are removed without altering any IPC contract or window lifecycle behavior.
- **SC-004**: All targeted and newly added automated unit and integration tests across `@blue/data`, `@blue/app`, `blue-cli`, and `@blue/engine-client` pass; comparison with the recorded pre-change baseline shows no newly introduced failures, including in `.blue` XML serialization fixtures, Java baseline parity, or CSD generation output.

## Assumptions

- Runtime environment is Node >= 20 and Electron 35+, where `crypto.randomUUID()` and `structuredClone` are globally available.
- Spec 093 editor-open audio glitch diagnostics are no longer actively required for routine development or runtime operation.
- Retain `clsx` and `tailwind-merge`; broader UI component normalization to standardize on `cn()` is deferred to a dedicated follow-up specification.

## Closure

All implementation and convergence tasks T001–T024 are complete. A final convergence audit found
no remaining gaps against the functional requirements, acceptance scenarios, plan decisions, or
constitution. The named dead artifacts, compatibility aliases, diagnostic paths, and IPC ordering
array are removed; the retained platform and package contracts remain covered by their package
tests and builds.

Final validation passed for `@blue/app` (3,974 tests passed, 2 skipped), `@blue/engine-client`
(42 passed), `blue-cli` (5 passed), the `@blue/data` and Electron main-process builds, lint, and
whitespace checks. The full `@blue/data` and repository suites reproduce only the pre-existing
BlueX7 modern-render locked-hash mismatch recorded by specs 093 and 094; its expected reference
was not changed. Exact closure evidence is recorded in [quickstart.md](quickstart.md).
