# Feature Specification: Jython Runtime Support

**Feature Branch**: `050-jython-support`  
**Created**: 2026-05-28  
**Status**: Closed
**Input**: User description: "SPEC 049 introduced a separate Java process for handling Clojure code. Use spec-kit to create a new spec for adding Jython support. Review Java Blue to see where Jython processing is used (e.g., ObjectBuilder, Python Instrument, PythonObject). Also check how Java blue has custom python library code (orchestra, pmask, etc.). We'll need to package that code with the app. (see blue-ext-jython, src/release/pythonLib). Do a deep analysis and create a branch and plan, then plan out the tasks. When complete, update status.md for handoff. Be sure to have unit tests for processing via Jython as part of exit criteria."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bundle Jython and Blue Python Libraries (Priority: P1)

As a Blue Electron user with Java installed, I need the application to include the Jython runtime and Java Blue's bundled Python libraries so existing Python-based projects can render without installing Java Blue separately.

**Why this priority**: PythonObject, Python ObjectBuilder, PythonInstrument, and PythonProcessor execution all fail unless the Java helper can load Jython and the same library path Java Blue exposes.

**Independent Test**: Build the app helper, verify the runtime artifact contains Jython and the bundled `pythonLib` tree, start the helper, and run a Jython import smoke test for `orchestra` and `pmask`.

**Acceptance Scenarios**:

1. **Given** the repository helper package is built, **When** the artifact is inspected, **Then** it contains Jython runtime classes and the packaged Blue Python library files from Java Blue.
2. **Given** the helper starts for a project, **When** a Jython import check runs, **Then** `from orchestra import *` and `from pmask import *` resolve without user setup.
3. **Given** a user has a personal Blue Python library directory, **When** the Jython session initializes, **Then** the user library directory is added after the packaged library path so user modules remain available.

---

### User Story 2 - Generate Scores from PythonObject and Python ObjectBuilder (Priority: P1)

As a composer opening Java Blue projects that use PythonObject or Python-language ObjectBuilder score objects, I need score generation, object testing, on-load scripts, BSB value replacement, time behavior, and note-processor chaining to match Java Blue.

**Why this priority**: Python score objects are the main Jython-backed project content. Existing examples rely on a persistent interpreter where setup objects define functions used by later objects.

**Independent Test**: Load or construct a project with an on-load PythonObject that defines a function, a later PythonObject that calls it, and an ObjectBuilder that uses replaced BSB values; generate/test each path and verify the produced notes.

**Acceptance Scenarios**:

1. **Given** a PythonObject sets `score = "i1 0 2 3 4 5"`, **When** the object is tested or rendered, **Then** the generated note fields match the same score text parsed by Java Blue.
2. **Given** an on-load PythonObject defines a function, **When** a later PythonObject calls that function during the same project session, **Then** the later object can access the earlier definition.
3. **Given** a PythonObject uses `blueDuration` and `blueProjectDir`, **When** it runs in a saved project, **Then** `blueDuration` reflects the object's subjective duration and `blueProjectDir` resolves to the saved project folder path with Java Blue-compatible semantics.
4. **Given** a Python-language ObjectBuilder contains BSB replacement tokens and Python code, **When** it renders, **Then** BSB values are substituted before Jython execution and the returned score follows the object's time behavior and note-processor chain.

---

### User Story 3 - Generate PythonInstrument Orchestra Text (Priority: P1)

As a composer using PythonInstrument entries in the orchestra, I need Jython instrument code to produce Csound orchestra text while preserving PythonInstrument global orchestra, global score, and UDO behavior.

**Why this priority**: PythonInstrument is a first-class Java Blue instrument type already parsed by the TypeScript data layer but currently returns empty generated instrument text.

**Independent Test**: Create a PythonInstrument whose script assigns `instrument`, render CSD text, and verify the generated orchestra contains the returned body plus existing global orchestra/global score and opcode-name replacement behavior.

**Acceptance Scenarios**:

1. **Given** a PythonInstrument script assigns `instrument = "aout oscili 32000, 440, 1"`, **When** the project generates orchestra text, **Then** that instrument body is emitted for its arrangement assignment.
2. **Given** the PythonInstrument has global orchestra and global score text, **When** CSD generation runs, **Then** those global sections remain included exactly as they are for non-Python instruments.
3. **Given** the PythonInstrument owns UDO definitions, **When** UDO name replacement is applied, **Then** the Jython-generated body uses the replaced opcode names consistently with Java Blue.

---

### User Story 4 - Execute PythonProcessor in Note Chains (Priority: P2)

As a composer using PythonProcessor in note-processor chains, I need note lists to be exposed to Jython so legacy Python processors can mutate notes during score generation instead of being preserved but skipped.

**Why this priority**: Current TypeScript behavior deliberately preserves PythonProcessor as deferred XML. Full Jython parity requires it to participate in the same processor order as Java Blue.

**Independent Test**: Run a note-processor chain containing PythonProcessor code that mutates note start time, duration, or p-fields, then verify the rendered notes reflect those mutations and still preserve XML round trips.

**Acceptance Scenarios**:

1. **Given** a note chain contains a PythonProcessor, **When** a sound object generates notes, **Then** the processor receives a mutable note list binding and can change the generated notes.
2. **Given** a PythonProcessor throws a Jython error, **When** score generation reaches it, **Then** the error identifies the PythonProcessor context and does not silently drop notes.
3. **Given** a project contains unsupported or future processor XML, **When** PythonProcessor is enabled, **Then** unrelated unsupported processor XML continues to be preserved.

---

### User Story 5 - Surface Jython Runtime Status and Reinitialize Behavior (Priority: P2)

As a user editing or rendering Python-backed projects, I need clear Jython availability, error, output, and reinitialize behavior so stateful interpreter issues can be diagnosed without corrupting project data.

**Why this priority**: Java Blue exposes a Jython reinitialize action and Python code can fail or leave stale interpreter state. Users need a visible recovery path and structured diagnostics.

**Independent Test**: Trigger Java-missing, helper-missing, import, syntax, evaluation, timeout, and reinitialize scenarios and verify structured status/errors are returned while the project still loads and saves.

**Acceptance Scenarios**:

1. **Given** Java or the helper artifact is unavailable, **When** a Jython-backed feature runs, **Then** the user receives a clear unavailable result and the `.blue` project data remains intact.
2. **Given** Jython code throws a syntax or runtime exception, **When** execution fails, **Then** the result includes a stable error code, message, captured output, and any available location details.
3. **Given** the user reinitializes Jython for the active project, **When** Jython code runs again, **Then** prior interpreter state is cleared and packaged/user library paths are restored.
4. **Given** Jython code writes to output streams, **When** a request completes or fails, **Then** output is captured separately and never corrupts the runtime protocol.

### Edge Cases

- What happens when Jython starts but a packaged Python library file is missing or unreadable?
- What happens when user Python modules shadow packaged `orchestra` or `pmask` modules?
- What happens when legacy Python code depends on Python 2 modules such as `UserList`, `types.StringType`, or `apply()`?
- What happens when a PythonObject used as setup code produces no score but intentionally leaves functions or globals in the interpreter?
- What happens when one render/test path mutates interpreter state and the user later renders the full project?
- What happens when a saved project is moved or saved-as while a Jython session is already active?
- What happens when PythonProcessor mutates a note list into invalid score values?
- What happens when PythonInstrument execution fails while other instruments are valid?
- What happens when browser-only or Java-missing environments load Python-backed objects?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app helper artifact MUST include the Jython runtime required to execute Java Blue-compatible Python 2.7/Jython code.
- **FR-002**: The app packaging flow MUST include Java Blue's bundled Python library tree, including `orchestra`, `pmask`, `jythonconsole`, and `ScriptingUtils`, without requiring Java Blue to be installed.
- **FR-003**: Jython session initialization MUST place the packaged library path and user Python library path on the interpreter search path with Java Blue-compatible module names such as `orchestra` and `pmask`.
- **FR-004**: Jython execution MUST be project-scoped and persistent until explicit reinitialize, project close, project replacement, helper restart, or session disposal.
- **FR-005**: The Java runtime protocol MUST expose Jython methods for health/import checks, score-object evaluation, generic script evaluation, instrument evaluation, note-processor evaluation, and Jython reinitialization.
- **FR-006**: PythonObject XML MUST continue to load, save, deep-copy, edit, and preserve `onLoadProcessable` while adding executable async generation when a Jython runtime client is available.
- **FR-007**: PythonObject evaluation MUST provide `score`, `blueDuration`, and `blueProjectDir` bindings with Java Blue-compatible value shapes.
- **FR-008**: PythonObject on-load processing MUST run only when `onLoadProcessable` is true and MUST preserve interpreter definitions for later Jython evaluations in the same project session.
- **FR-009**: PythonObject generated score text MUST be parsed, processed by the object's note-processor chain, adjusted by time behavior/repeat point, and shifted to object start time.
- **FR-010**: ObjectBuilder Python evaluation MUST replace BSB values before execution and provide `score`, `blueDuration`, `commandline`, and `blueProjectDir` bindings.
- **FR-011**: ObjectBuilder Python output MUST follow the same score parsing, note-processor, time behavior, repeat point, and start-time handling as Java Blue.
- **FR-012**: PythonInstrument evaluation MUST execute instrument scripts in the persistent Jython project session and return the `instrument` binding as generated orchestra text.
- **FR-013**: PythonInstrument generation MUST preserve existing global orchestra/global score behavior and UDO replacement behavior.
- **FR-014**: PythonProcessor MUST be represented as an executable processor type while retaining XML round-trip compatibility with existing deferred/unsupported processor preservation.
- **FR-015**: PythonProcessor execution MUST expose a mutable note-list binding with enough Java-compatible shape for legacy processor scripts to inspect and mutate notes.
- **FR-016**: Browser-only or Java-unavailable environments MUST continue to load, display, edit, and save Python-backed project data without destructive conversion.
- **FR-017**: Jython runtime status, import failures, syntax/runtime errors, timeouts, helper exits, missing Java, missing helper artifacts, and captured output MUST be returned as structured results.
- **FR-018**: User code output MUST NOT corrupt the helper request/response protocol.
- **FR-019**: The user MUST be able to reinitialize the Jython runtime for the active project independently of Clojure reinitialization.
- **FR-020**: Unit tests MUST cover successful Jython processing for PythonObject, ObjectBuilder, PythonInstrument, PythonProcessor, packaged library imports, reinitialize behavior, and representative failure paths before the feature exits.
- **FR-021**: Existing Clojure runtime behavior from SPEC 049 MUST remain compatible while Jython support is added to the shared Java helper.
- **FR-022**: ObjectBuilder XML MUST load, save, deep-copy, and preserve non-Python language settings even when only Python-language ObjectBuilder execution is enabled in this feature.

### Key Entities *(include if feature involves data)*

- **Jython Runtime Session**: Project-scoped interpreter state inside the Java helper, including search path, globals, captured output, and reinitialize lifecycle.
- **Packaged Python Library**: The Java Blue `blue-ext-jython/src/main/release/pythonLib` content bundled with the app helper and exposed to imports as Java Blue expects.
- **User Python Library Directory**: User-specific `pythonLib` location appended to the Jython search path for custom modules.
- **Jython Runtime Request**: Structured helper command for import checks, score-object evaluation, ObjectBuilder evaluation, instrument evaluation, processor evaluation, or reinitialize.
- **Jython Runtime Response**: Structured success or failure payload containing generated text, mutated note data, diagnostics, captured output, and timing.
- **PythonObject**: Score object containing Python code, on-load flag, note-processor chain, time behavior, and XML persistence.
- **ObjectBuilder Python Mode**: ObjectBuilder score object with BSB interface/presets, Python code, command line text, note-processor chain, time behavior, and XML persistence.
- **PythonInstrument**: Orchestra instrument whose Python code returns generated Csound instrument body through the `instrument` binding.
- **PythonProcessor**: Note processor whose Python code mutates a note list during score generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clean helper build produces an app-bundled artifact containing Jython and all 45 Java Blue Python library files.
- **SC-002**: A helper health/import check for `orchestra` and `pmask` succeeds within 2 seconds after the Java runtime session is ready on a typical development machine.
- **SC-003**: A PythonObject returning `i1 0 2 3 4 5` generates the same parsed note fields as the equivalent Java Blue behavior.
- **SC-004**: A project where one PythonObject defines a function and a later PythonObject calls it renders successfully in the same project session.
- **SC-005**: A PythonObject or ObjectBuilder that imports `orchestra` or `pmask` can generate valid score text using the packaged libraries.
- **SC-006**: A Python-language ObjectBuilder with BSB replacement tokens produces score text that reflects substituted widget values before Jython execution.
- **SC-007**: A PythonInstrument assigning `instrument` contributes non-empty orchestra text to generated CSD output.
- **SC-008**: A PythonProcessor test mutates generated notes through Jython and the final rendered notes reflect the mutation.
- **SC-009**: Reinitializing Jython clears prior interpreter globals while preserving packaged/user library imports for subsequent evaluation.
- **SC-010**: Representative startup, import, evaluation, timeout, and helper-exit failures return structured diagnostics instead of silent empty output.
- **SC-011**: Existing Clojure helper tests from SPEC 049 still pass after Jython support is added.

## Assumptions

- Users who need Java-dependent Jython behavior are willing to install a compatible Java runtime themselves; this feature does not bundle a full JRE.
- The feature targets Java Blue-compatible Jython 2.7 behavior, not CPython 3 compatibility.
- Java Blue's `blue-ext-jython/src/main/release/pythonLib` is the source of truth for bundled Blue Python library content.
- The Electron app still owns one active project document at a time, so one project-scoped helper session remains sufficient.
- Python console UI parity is adjacent but not required for MVP execution parity; the required recovery action is Jython reinitialize for the active project.
- Jython user code is trusted project code, consistent with SPEC 049's Java helper trust model; this feature does not provide a sandbox.
