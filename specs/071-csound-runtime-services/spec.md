# Feature Specification: Csound Runtime Services

**Feature Branch**: `071-csound-runtime-services`

**Created**: 2026-08-13

**Status**: Complete — automated validation and installed-Csound integration validation passed on macOS arm64; physical-device acceptance remains host-dependent and is covered by the quickstart.

**Input**: User description: "Replace static Java-compatible audio and MIDI device choices with runtime discovery, add engine-owned Csound utility execution, and route existing offline Csound workloads through Blue Engine instead of launching Csound directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and Select Runtime Devices (Priority: P1)

A musician can inspect the audio and MIDI modules actually available in the active Csound installation, automatically refresh the input and output devices for the selected modules, manually rescan after hardware changes, and save the exact device identifier needed for playback or rendering.

**Why this priority**: Static compatibility lists do not describe the hardware or backends that are usable on the current computer. A reliable discovery flow removes guesswork from initial audio setup while retaining an escape hatch for advanced configurations.

**Independent Test**: Open program settings with a supported Csound installation, confirm the selected audio and MIDI modules load their devices, change one module and confirm only that device list refreshes, manually rescan after a simulated hardware change, choose a reported device, save the settings, reopen the panel, and confirm the same identifiers are retained without starting playback.

**Acceptance Scenarios**:

1. **Given** Csound reports one or more audio or MIDI modules, **When** the user opens the corresponding settings, **Then** the available module choices reflect the runtime installation rather than only a built-in compatibility list.
2. **Given** a selected module reports input or output devices, **When** settings open, that module selection changes, or the user presses its rescan action, **Then** each device is shown with a user-readable name and the exact identifier that will be saved.
3. **Given** a previously saved device is temporarily unavailable, **When** the user reopens settings, **Then** the saved identifier remains visible and editable and is not silently replaced.
4. **Given** a backend legitimately reports no devices, **When** the scan completes, **Then** the panel presents an empty result rather than treating it as a crash or inventing a device.

---

### User Story 2 - Run Offline Csound Work Through Blue Engine (Priority: P1)

A musician can render to disk, freeze score objects, and inspect SoundFonts without those workflows launching a separately configured Csound executable. These operations use the same managed Csound runtime as the rest of Blue and preserve their current output, progress, cancellation, and error behavior.

**Why this priority**: The existing split execution paths can select different Csound installations and behave inconsistently. Consolidating them makes the bundled engine boundary truthful and reduces configuration failures.

**Independent Test**: Remove any direct Csound executable from the application configuration while retaining a supported Csound library, then complete a disk render, a score-object freeze, and a SoundFont inspection through the managed engine.

**Acceptance Scenarios**:

1. **Given** the managed engine can load a supported Csound runtime, **When** the user starts a disk render, freeze, or SoundFont inspection, **Then** the operation completes without requiring a direct Csound executable setting.
2. **Given** a long-running offline operation, **When** the user cancels it, **Then** the operation stops promptly, no success artifact is reported, and the application remains ready for another operation.
3. **Given** Csound reports warnings, progress, or errors, **When** an offline operation runs, **Then** the relevant messages remain available through the feature's existing output surface.
4. **Given** realtime playback or Blue Live is active in another isolated engine session, **When** an offline operation starts or stops, **Then** neither session blocks, redirects, or terminates the other.

---

### User Story 3 - Execute Supported Csound Utilities Consistently (Priority: P2)

An application workflow can invoke a named utility supplied by the active Csound installation, pass its arguments and working context without shell interpretation, receive its messages and completion status, and cancel the operation when necessary.

**Why this priority**: A defined utility service prevents new utility-backed features from reintroducing direct executable calls and provides one place for capability and error handling.

**Independent Test**: Run a known informational utility against a fixture audio file, verify its expected report and successful status, then request an unavailable utility and verify a structured, recoverable failure.

**Acceptance Scenarios**:

1. **Given** a utility is reported by the active Csound installation, **When** a workflow invokes it with valid arguments, **Then** its messages and completion status are returned without invoking a command shell.
2. **Given** a requested utility is unavailable, **When** it is invoked, **Then** the caller receives a specific failure and Blue remains usable.
3. **Given** paths contain spaces, quotation marks, or platform-native separators, **When** they are passed as utility arguments, **Then** they reach the utility as distinct arguments without shell expansion or path corruption.

---

### User Story 4 - Diagnose and Recover Runtime Failures (Priority: P3)

A musician or support engineer receives a clear diagnosis when runtime discovery or execution cannot proceed and can retry after changing the Csound installation, module, or device without restarting Blue or losing project work.

**Why this priority**: Native runtime failures are otherwise difficult to distinguish from invalid project data or missing hardware, and recovery must not put unsaved work at risk.

**Independent Test**: Exercise missing-library, missing-capability, invalid-module, unavailable-device, and failed-operation cases; correct each environment problem and retry successfully without reopening the project.

**Acceptance Scenarios**:

1. **Given** Csound is absent, unloadable, or lacks a required capability, **When** discovery or execution is requested, **Then** Blue identifies the runtime problem without closing the project or disabling editing.
2. **Given** a saved module or device is no longer available, **When** settings open or its module selection changes, **Then** Blue identifies the unavailable selection and keeps it as an editable replacement.
3. **Given** the environment is corrected after a failure, **When** the user retries discovery or execution, **Then** Blue re-evaluates the runtime rather than requiring an application restart.

### Edge Cases

- Csound loads successfully but exposes no audio modules, no MIDI modules, or no devices for the selected module.
- Enumerating one backend emits warnings or attempts to contact a service that is not running.
- A saved custom module or device identifier is not returned by the current scan.
- The installed Csound version lacks utility, module, or device-discovery capabilities required by the feature.
- A utility or offline performance emits a large volume of messages, returns a nonzero result without crashing, or terminates unexpectedly.
- Cancellation races with normal completion or with creation of an output file.
- Multiple offline operations or a realtime session and an offline operation run concurrently.
- Paths contain spaces, non-ASCII characters, quotation marks, or Windows separators.
- The configured Blue Engine is older than the application and does not advertise the new runtime services.
- Program settings contain legacy render-method or executable values from an earlier Blue Electron version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Blue MUST obtain available audio and MIDI module choices from the active Csound runtime rather than relying solely on static Java-compatible lists.
- **FR-002**: Blue MUST query audio input, audio output, MIDI input, and MIDI output devices for the selected compatible modules when settings open, when the corresponding module selection changes, and when the user requests a rescan.
- **FR-003**: A discovered device MUST include its module, direction, exact runtime identifier, user-readable name, and channel capacity when reported by the runtime.
- **FR-004**: Blue MUST distinguish a successful empty device result from discovery failure.
- **FR-005**: Blue MUST query only the selected module during a page-load, module-change, or manual refresh and MUST NOT automatically activate or probe every installed backend.
- **FR-006**: Program settings MUST retain editable module and device identifiers so a saved custom or temporarily unavailable value is not silently discarded.
- **FR-007**: Saving a discovered selection MUST preserve the exact identifier expected by Csound and MUST make that selection available to the existing playback and rendering configuration.
- **FR-008**: Blue MUST expose a managed service that can invoke a named utility available in the active Csound installation with an ordered argument list and an explicit working directory.
- **FR-009**: Utility requests MUST NOT interpret arguments through a command shell or permit an arbitrary non-Csound executable to be selected.
- **FR-010**: Utility execution MUST report availability, Csound messages, completion status, and a structured failure reason.
- **FR-011**: Blue MUST expose a managed offline-performance service capable of running the existing argument-based Csound workloads needed by disk rendering, score-object freezing, and SoundFont inspection.
- **FR-012**: Disk rendering, score-object freezing, and SoundFont inspection MUST use the application-managed Blue Engine boundary and MUST no longer launch a separately configured Csound executable after migration.
- **FR-013**: Migrated operations MUST preserve existing working-directory behavior, output forwarding, progress reporting, cancellation, exit-status handling, and artifact validation.
- **FR-014**: Utility and offline-performance operations MUST be cancellable without terminating unrelated realtime, Blue Live, or offline sessions.
- **FR-015**: Blue MUST prevent a cancellation/completion race from reporting an incomplete artifact as successful.
- **FR-016**: Runtime discovery and offline execution MUST remain isolated from the realtime request loop so a long operation cannot prevent playback lifecycle commands from being handled.
- **FR-017**: The engine/application compatibility report MUST identify whether device discovery, utility execution, and offline-performance execution are supported before a caller relies on them.
- **FR-018**: An older or incompatible engine MUST be rejected with a recoverable capability diagnostic rather than receiving an unsupported request.
- **FR-019**: Runtime messages MUST be separated from machine-readable discovery results so warnings cannot corrupt a successful device response.
- **FR-020**: Blue MUST allow discovery and execution to be retried after a runtime or configuration correction without restarting the application.
- **FR-021**: Blue MUST remain usable for project creation, editing, and saving when Csound is absent or an engine-owned operation fails.
- **FR-022**: This feature MUST NOT change `.blue` XML, generated CSD semantics, project state ownership, or the contents of existing successful render artifacts.
- **FR-023**: Runtime discovery results, active operations, progress, and messages MUST remain transient and MUST NOT enter project XML.
- **FR-024**: Durable device choices and runtime-path preferences MUST remain application-wide program settings and MUST NOT become project-owned data.
- **FR-025**: Legacy direct-executable and render-method settings MUST be preserved safely during transition, but MUST NOT remain active dependencies after all covered operations migrate.
- **FR-026**: Blue MUST use one supported render service for these workflows: the application-managed Blue Engine backed by the Csound runtime. It MUST NOT present a nonfunctional render-method selector.
- **FR-027**: Automated validation MUST cover successful and empty device discovery, unsupported modules, missing capabilities, message separation, utility success/failure, offline execution, cancellation, concurrent session isolation, and platform-sensitive paths.
- **FR-028**: User-facing settings and diagnostics MUST explain whether a value is discovered, saved-but-unavailable, custom, or invalid.
- **FR-029**: Known Csound module identifiers SHOULD use stable, user-friendly display labels that include the exact runtime identifier; unknown discovered identifiers MUST remain visible using their raw names, and option values MUST remain exact identifiers.
- **FR-030**: Fresh program settings MUST seed the exact Csound platform defaults (`auhal`/`alsa`/`PortAudio` for macOS/Linux/Windows audio and `portmidi` except Linux `alsa` for MIDI), and each selected/default module MUST appear first in its dropdown while discovered alternatives remain available.
- **FR-031**: When the Settings window is closed while program settings contain unapplied changes, Blue MUST show a confirmation mentioning unsaved settings with `Yes`, `No`, and `Cancel` choices. `Yes` MUST apply the pending settings before closing, `No` MUST close without applying them, and `Cancel` MUST keep the Settings window open.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue provides separate Csound API and command-line render-service factories. Its settings query selected drivers through the active render service and retain exact device identifiers in editable fields. Current Blue Electron uses Blue Engine for realtime work but directly launches configured Csound executables for disk rendering, freezing, and SoundFont inspection.
- **Compatibility Requirements**: Existing Java-compatible driver and device identifiers remain accepted as editable saved values. Disk render, freeze, SoundFont inspection, realtime playback, and Blue Live retain their current observable outputs and isolation. Existing program settings remain loadable, and `.blue` XML and generated CSD content remain unchanged.
- **Intentional Divergences**: Blue Electron will use runtime module/device enumeration instead of Java's error-message probing and platform-specific fallback discovery. It will expose Blue Engine/Csound API execution as the single supported render method rather than reproducing Java's API-versus-command-line selector. These divergences eliminate ambiguous runtime selection while preserving editable custom identifiers.
- **State Ownership**: Electron main owns engine resolution, Csound runtime capability detection, discovery requests, offline child-process lifecycle, cancellation, and message routing. Program settings own durable module/device selections and runtime-path preferences. Renderers own only transient panel state and submitted settings edits. The canonical main-process project document and `.blue` XML are unaffected.

### Key Entities

- **Runtime Capability Report**: A transient description of the selected engine and Csound runtime, including support for module discovery, device discovery, utility execution, and offline performance execution.
- **Runtime Module**: An audio or MIDI backend reported by Csound, identified by its exact runtime name, category, and availability.
- **Runtime Device**: An input or output endpoint associated with one runtime module, with an exact identifier, display name, direction, and optional channel capacity.
- **Execution Request**: A transient request for either a named Csound utility or an offline Csound performance, carrying ordered arguments, working context, and a unique operation identity.
- **Execution Result**: The terminal success, failure, or cancellation state of an execution request together with its messages, status, and validated output facts.
- **Saved Runtime Selection**: Application-wide settings for selected modules and device identifiers, including values that are custom or currently unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On every supported desktop platform with a compatible Csound installation, users can list runtime modules and complete a selected-module device refresh within 3 seconds, excluding delays caused by an unresponsive third-party backend.
- **SC-002**: Across the automated discovery matrix, 100% of empty device lists are reported as valid empty results and 100% of negative discovery outcomes produce a specific recoverable diagnostic.
- **SC-003**: Disk render, score-object freeze, and SoundFont inspection each complete successfully with no direct Csound executable configured, while producing the same validated outputs as their pre-migration workflows.
- **SC-004**: A cancelled utility or offline render reaches a terminal cancelled state within 2 seconds of process termination on supported test platforms and never reports an incomplete artifact as successful.
- **SC-005**: Realtime playback or Blue Live and one offline operation can run concurrently in automated isolation tests without either session receiving the other's messages, cancellation, or shutdown.
- **SC-006**: A known informational utility returns its expected report and completion status for paths containing spaces and platform-native separators on every supported platform.
- **SC-007**: Missing Csound, unsupported runtime capabilities, unavailable modules/devices, and incompatible engine versions all produce actionable diagnostics within 3 seconds and leave project editing and saving available.
- **SC-008**: Existing program settings load without data loss, saved unavailable/custom identifiers remain editable, and no runtime discovery or execution state appears in `.blue` XML.
- **SC-009**: After migration, repository validation finds zero production call sites that directly launch the configured Csound executable for disk rendering, freezing, SoundFont inspection, or Csound utilities.

## Assumptions

- Csound 7 is the primary supported runtime and provides the discovery and utility capabilities targeted by this feature.
- Device refresh occurs when settings open or a module selection changes, with an explicit rescan action for hot-plug changes; continuous hardware hot-plug monitoring is outside this feature.
- Runtime module names and device identifiers are opaque Csound values and must not be translated into platform-specific aliases before persistence.
- Advanced users may need to retain custom identifiers that are not discoverable in the current environment.
- The existing bundled-engine resolver and optional external Blue Engine override remain the source of the active engine executable.
- The existing output, progress, cancellation, and artifact-validation surfaces for disk rendering, freezing, and SoundFont inspection will be reused from the user's perspective.
- Legacy executable and render-method values may remain readable for migration or downgrade safety until a later settings-schema cleanup, but they do not select the execution path after cutover.

## Out of Scope

- Bundling, downloading, or installing Csound or third-party Csound plugins.
- Adding a general-purpose shell-command runner or exposing arbitrary executable execution.
- Replacing the realtime or Blue Live transport with the offline execution service.
- Continuous device hot-plug monitoring or automatic rescanning of every backend.
- Managing Web MIDI devices used by Blue Live input; this feature covers Csound runtime MIDI modules and devices.
- Changing render audio semantics, generated CSD text, `.blue` XML, or project persistence.
- Retaining a user-selectable direct-command-line render fallback after engine-owned execution is complete.
