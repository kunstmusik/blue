# Feature Specification: Blue Java Runtime Bridge

**Feature Branch**: `049-blue-java-runtime`  
**Created**: 2026-05-26  
**Status**: Implemented  
**Input**: User description: "For parity, Java processing should be optionally available for Clojure first and later Jython. Create a Maven Java library under packages/blue-java that builds a fat JAR including Clojure and JeroMQ, copies it into blue-app for packaging, runs with user-installed Java, starts a per-project runtime process with the project folder as CWD, and exposes persistent Clojure evaluation to TS Blue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bundle an Optional Java Runtime (Priority: P1)

As a Blue Electron user with Java installed, I need the application to include a small Java runtime helper so Java-dependent project features can be enabled without requiring Java Blue itself.

**Why this priority**: No Clojure or future Jython parity is possible until the app can build, package, locate, and launch a standalone Java helper reliably.

**Independent Test**: Build the repository, verify the Java helper artifact is produced and copied into the app assets, then launch the app with Java available and confirm the helper can start, respond to a health check, and stop cleanly.

**Acceptance Scenarios**:

1. **Given** the repository is built, **When** the Java helper package build completes, **Then** a runnable helper JAR is created and copied to the app asset location expected by the Electron main process.
2. **Given** Java is installed, **When** the Electron main process requests Java runtime availability, **Then** it locates the bundled helper and verifies that a helper process can be launched.
3. **Given** Java is not installed or the helper cannot start, **When** the application loads a project, **Then** the project still opens and the Java-dependent features report a clear unavailable status.

---

### User Story 2 - Evaluate Clojure Objects with Project-Scoped State (Priority: P1)

As a composer opening a Java Blue project that uses Clojure sound objects, I need Clojure code to run in a persistent project-scoped session so functions and dependencies established earlier in the project remain available to later Clojure objects.

**Why this priority**: Java Blue's Clojure behavior depends on persistent project namespace state. Running each object in a fresh Java process or fresh namespace would break existing projects.

**Independent Test**: Load a project where one Clojure object defines functions on load and later Clojure objects call those functions, then generate/test score output and verify the expected notes are produced.

**Acceptance Scenarios**:

1. **Given** a project contains Clojure sound objects, **When** the project is opened with Java processing enabled, **Then** the application creates a project-scoped Java runtime session.
2. **Given** one Clojure object defines a function or value and later objects refer to it, **When** score generation evaluates the objects in project order, **Then** later objects can access the earlier definitions.
3. **Given** a Clojure object is evaluated, **When** it uses Java Blue runtime values, **Then** it receives the object duration, score return binding, and current project directory with Java-compatible semantics.
4. **Given** the user reinitializes the Clojure runtime, **When** Clojure code is evaluated again, **Then** previous namespace state is cleared and a new project namespace is used.

---

### User Story 3 - Preserve Project Directory Behavior (Priority: P1)

As a composer using project-relative script or file paths from Clojure code, I need the helper process to execute with the saved project folder as its working directory so relative path behavior matches Java Blue.

**Why this priority**: Many existing projects rely on project-relative files. A helper launched from the app directory or user home would silently change behavior.

**Independent Test**: Load a saved project containing Clojure code that reads a relative file from the project folder, generate notes, and verify the file is resolved from the project directory.

**Acceptance Scenarios**:

1. **Given** a saved project is opened from disk, **When** the Java helper starts for that project, **Then** the helper process working directory is the folder containing the `.blue` file.
2. **Given** the project is unsaved, **When** Java processing is requested, **Then** the application uses an explicit fallback working directory and reports that no saved project folder is available.
3. **Given** a project is saved under a new path, reverted, closed, or replaced, **When** Java processing is next requested, **Then** the helper session uses the current project location rather than a stale folder.

---

### User Story 4 - Surface Runtime Status and Errors (Priority: P2)

As a user editing or rendering a project with Java-dependent code, I need clear status and diagnostics when Java is missing, dependencies fail to load, Clojure code throws, or the helper process exits.

**Why this priority**: Java-dependent execution is optional and user code can fail. Users need actionable feedback instead of silent empty scores or generic render failures.

**Independent Test**: Trigger representative startup, dependency, evaluation, timeout, and process-exit failures and verify the UI/main-process result contains the relevant message, output, and status.

**Acceptance Scenarios**:

1. **Given** Java is unavailable, **When** a Clojure object is tested or rendered, **Then** the user sees that Java processing is unavailable and the project data remains intact.
2. **Given** Clojure code throws an exception, **When** evaluation fails, **Then** the error message includes the Clojure exception details and any available line or column information.
3. **Given** the helper prints output or errors, **When** evaluation completes or fails, **Then** captured output is available to the app without corrupting the request protocol.
4. **Given** the helper process becomes unresponsive or exits unexpectedly, **When** another Java-dependent action is requested, **Then** the app reports the failure and can start a fresh helper session.

---

### User Story 5 - Prepare for Future Jython Support (Priority: P3)

As a maintainer, I need the Java helper and app bridge to be organized around a shared runtime protocol so Jython execution can be added later without rewriting Clojure integration.

**Why this priority**: Clojure is the first Java-dependent runtime, but the same process and protocol should become the basis for PythonObject, PythonInstrument, and PythonProcessor parity.

**Independent Test**: Review the package layout, protocol, and runtime abstractions and verify Clojure-specific code is isolated from shared session, transport, lifecycle, and packaging code.

**Acceptance Scenarios**:

1. **Given** the Java helper package is inspected, **When** shared lifecycle and transport code is reviewed, **Then** it is not hard-coded only to Clojure.
2. **Given** a future runtime engine is added, **When** it needs request handling, session state, output capture, and project CWD behavior, **Then** it can reuse the shared helper infrastructure.

### Edge Cases

- What happens when Java is installed but too old or cannot run the helper JAR?
- What happens when the helper JAR is missing from app assets after a partial build?
- What happens when a project contains Clojure library dependency metadata but the network or local Maven cache cannot resolve dependencies?
- What happens when multiple Clojure objects rely on an on-load object being evaluated before render-time objects?
- What happens when Clojure code mutates namespace state during a score-object test and the user later renders the full project?
- What happens when a render is cancelled or times out while Clojure code is running?
- What happens when user Clojure code writes to stdout or stderr during request handling?
- What happens when the app switches projects while the helper process is still starting or evaluating code?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST include a Java helper package under `packages/blue-java` that can be built independently and as part of the standard repository build.
- **FR-002**: The Java helper build MUST produce a runnable helper artifact that contains the dependencies required for Clojure execution in this feature.
- **FR-003**: The Java helper artifact MUST be copied into the Electron app asset tree during the helper build so app packaging can include it.
- **FR-004**: The Electron main process MUST locate the packaged helper artifact in development and packaged-app layouts.
- **FR-005**: The Electron main process MUST detect whether a usable user-installed Java runtime is available before attempting Java-dependent execution.
- **FR-006**: The application MUST keep Java processing optional: projects load, display, edit, and save even when Java processing is unavailable.
- **FR-007**: The Electron main process MUST launch the helper with the saved project folder as the process working directory when a saved project is active.
- **FR-008**: The Electron main process MUST stop or replace the helper session when the active project is closed, replaced, reverted, or moved to a different saved location.
- **FR-009**: The Java helper MUST expose a local request/response protocol for health checks, project session initialization, Clojure evaluation, Clojure score-object evaluation, Clojure reinitialization, and clean shutdown.
- **FR-010**: The app bridge MUST serialize Java-dependent requests per active project session so project namespace state remains deterministic.
- **FR-011**: The Clojure runtime MUST create and maintain a persistent namespace for the active project until reinitialize, project close, or helper shutdown.
- **FR-012**: Clojure score-object evaluation MUST provide Java-compatible bindings for the score return value, object duration, and current project directory.
- **FR-013**: Clojure score-object evaluation MUST return generated score text to the app for parsing and downstream time behavior and note processor handling.
- **FR-014**: Clojure on-load processing MUST be supported so a project can establish namespace functions or values before later score generation.
- **FR-015**: The application MUST parse and preserve Clojure sound-object XML as a first-class editable score object rather than treating it as an unknown fallback.
- **FR-016**: The application MUST preserve Clojure project dependency metadata and attempt to load those dependencies before Clojure rendering when Java processing is available.
- **FR-017**: The user MUST be able to reinitialize the Clojure runtime for the active project.
- **FR-018**: Runtime status, startup errors, dependency errors, evaluation errors, captured output, timeouts, and unexpected helper exits MUST be surfaced through structured results.
- **FR-019**: User code output MUST NOT corrupt the helper request protocol.
- **FR-020**: The shared helper process and app bridge structure MUST leave clear extension points for future Jython execution.

### Key Entities *(include if feature involves data)*

- **Java Runtime Artifact**: Runnable helper package produced by the Java build and bundled with the Electron app.
- **Java Runtime Process**: Per-active-project helper process started by Electron main and stopped when the project lifecycle ends.
- **Runtime Session**: Project-scoped execution state owned by the helper, including Clojure namespace state and project directory context.
- **Clojure Runtime Namespace**: Persistent namespace used to evaluate Clojure code for one project.
- **Runtime Request**: Structured command sent from Electron main to the helper for health checks, session lifecycle, evaluation, or shutdown.
- **Runtime Response**: Structured result returned by the helper with success data, diagnostics, captured output, timing, and error details.
- **Clojure Object**: Score object containing Clojure code, on-load behavior, time behavior, note processor chain, and XML persistence.
- **Clojure Project Dependencies**: Project-level dependency metadata preserved from Java Blue and loaded into the Clojure runtime when available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clean repository build produces a helper JAR and places it in the Electron app asset tree without manual copy steps.
- **SC-002**: With Java installed, a health-check request to the packaged helper succeeds within 2 seconds on a typical development machine.
- **SC-003**: With Java unavailable, the app can still load and save a project containing Clojure objects without losing Clojure XML data.
- **SC-004**: A Clojure object that returns `i1 0 2 3 4 5` generates the same parsed note fields as the equivalent Java Blue behavior.
- **SC-005**: A project where one Clojure object defines a function and a later Clojure object calls it renders successfully in the same project session.
- **SC-006**: A Clojure object that reads a relative file resolves it from the saved project directory.
- **SC-007**: Reinitializing the Clojure runtime clears previously defined namespace values and allows subsequent evaluation in a fresh namespace.
- **SC-008**: Representative startup, evaluation, dependency, timeout, and unexpected-exit failures return structured diagnostics instead of silent empty output.
- **SC-009**: The design leaves shared lifecycle and transport code reusable for a later Jython feature without duplicating the Clojure runtime bridge.

## Assumptions

- Users who need Java-dependent Clojure behavior are willing to install a compatible Java runtime themselves.
- The app should not bundle a full JRE in this feature.
- Clojure is implemented first; Jython execution, PythonObject generation, PythonInstrument generation, and PythonProcessor execution are deferred.
- The Electron app has a single active project document at a time, so a per-active-project helper process is sufficient for this slice.
- Java Blue remains the parity source for Clojure object XML, on-load behavior, project namespace behavior, and dependency metadata.
- Dependency downloads may require network access or a populated local Maven cache; offline behavior must fail clearly but does not need to vendor arbitrary project dependencies.
