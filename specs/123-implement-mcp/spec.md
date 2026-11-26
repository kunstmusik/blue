# Feature Specification — Local MCP access for Blue

**Feature Branch** — `codex/implement-mcp`
**Created** — 2026-11-26
**Status** — Draft
**Input** — Let the owner of a running Blue desktop session use a local Model Context Protocol (MCP) client to inspect, edit, play, and render the live project.

## User Scenarios & Testing

### User Story 1 — Connect and inspect (P1)

A composer enables MCP in Program Settings, connects a local client, and inspects their unsaved project and Csound diagnostics without opening a second Blue instance.

**Why this priority** — Read-only access provides useful project context with the smallest permission grant.

**Independent test** — Open an unsaved project, enable MCP with default permissions, and list and read the available project and engine information.

1. **Given** default settings, **when** Blue starts, **then** there is no MCP listener.
2. **Given** enabled MCP, **when** a local client presents the current credential, **then** it can inspect project metadata, instruments, score objects, generated Csound data, and engine status. An unauthorized request reveals none of that data.
3. **Given** a compatible subscribed client, **when** Blue opens, replaces, closes, or commits a change to the project, **then** the relevant project resources signal a change, and a new read reflects the current session.

### User Story 2 — Apply and undo an edit (P2)

A composer grants read-write access and asks a client to edit supported parts of the live project. Blue shows each edit alongside ordinary edits in Undo and Redo.

**Why this priority** — Composers can delegate edits while retaining control over the result.

**Independent test** — Exercise all four edit operations in a disposable project, checking the open editor and Undo and Redo after each.

1. **Given** read-write access and a current project version, **when** the client applies a supported edit, **then** Blue shows the edit, updates the modified indicator, and returns the resulting project version for the next edit.
2. **Given** a successful edit, **when** the user chooses Undo and then Redo, **then** Blue restores the previous and resulting content, stable references, saved or modified status, and applicable running engine state.
3. **Given** a stale version, **when** the client attempts a write, **then** it receives a conflict and the attempted write creates no history entry.
4. **Given** read-only access, **when** a client attempts an edit, **then** Blue denies it even if the client cached the tool.

### User Story 3 — Play, stop, and render (P3)

A composer with read-write access can ask the client to start or stop the current project and request an audio render in a Blue-approved destination.

**Why this priority** — Composers can audition and export their work from the same client while Blue retains control of execution and output.

**Independent test** — Start and stop a small project through an authenticated client, then render to an approved destination and try a destination outside it.

1. **Given** a current project and an available engine, **when** the client starts or stops playback, **then** Blue and the client report the same transport state.
2. **Given** a render request, **when** Blue approves the destination and execution, **then** the client receives the render outcome. Outside destinations and existing output files are refused without an output write.
3. **Given** project content that can execute host code or access arbitrary files, **when** an MCP request would activate it, **then** Blue requires a local user decision or refuses the request where it cannot honor the operation's guarantees.

### User Story 4 — Manage access (P4)

A composer can manage the service in Program Settings, see the actual endpoint, and copy connection details for compatible clients.

**Why this priority** — The owner can diagnose a bind failure and revoke credentials without restarting Blue.

**Independent test** — Occupy the preferred port, enable the service, connect with the copied settings, rotate the credential, then disable the service.

1. **Given** an occupied preferred port, **when** a fallback succeeds, **then** Settings shows the actual endpoint and uses it in copied configuration.
2. **Given** a connected client, **when** the user rotates the credential, **then** it loses access and reconnects only with the replacement.
3. **Given** an enabled service, **when** the user disables it or quits Blue, **then** active streams close and the endpoint stops serving requests.

### Edge Cases

- With no project open, project operations explain how to recover and engine status remains available.
- A project replaced or edited during an operation cannot receive that operation's stale changes. A stale diagnostic or generated artifact cannot be presented as belonging to a newer version.
- Unsupported fields, missing or ambiguous targets, malformed input, and oversized requests fail without changing the project. An effective no-op creates no undo entry.
- Failed binds show an actionable unavailable state. Rapid enable, port change, disable, and quit cannot leave an obsolete endpoint listening.
- An unavailable engine, rejected execution, or unusable render destination produces a recoverable outcome. Cancelling an operation before it takes effect leaves no durable edit or output.
- Changing access mode or revoking credentials applies to pending operations at their effect boundary. Completed operations retain their true outcomes.

## Requirements

### Functional Requirements

- **FR-001** — Blue MUST provide an opt-in MCP service inside the running desktop app. It MUST default to disabled and read-only, including when upgrading settings that predate MCP.
- **FR-002** — The service MUST accept connections on IPv4 loopback only, require the current bearer credential on every request, reject unapproved host and browser origins, and enforce a 2 MiB incoming request-body limit. Blue MUST generate credentials with 256 bits of randomness and keep them out of logs and status messages.
- **FR-003** — Program Settings MUST expose enablement, preferred port, access mode, actual endpoint and service status, credential copy and rotation, and copyable configurations for compatible local clients. Preferences survive restart. Credentials survive restart when protected storage is available. Blue shows when the credential is session-only. If the preferred port is occupied, Blue MUST try an available local port and visibly report the result.
- **FR-004** — Blue MUST serve a live project summary with metadata, project path where present, dirty status, project version, instruments, and sound layers. It MUST expose a separate instrument index, generated Csound document, and engine connection and playback status with recent console output.
- **FR-005** — Inspection tools MUST read the project summary, look up an instrument by ID, list supported score objects by layer and optional time range, and generate a Csound document with diagnostics. Project resources MUST support change notifications for authenticated clients that implement the subscription protocol.
- **FR-006** — Read-write mode MUST allow a client to update GenericInstrument and Blue Synth Builder code, create a GenericInstrument or update an instrument's name and enabled state, edit supported score-object start time, duration and name or GenericScore text, and edit title, author, notes, sample rate, ksmps and channel count. Unsupported fields and types MUST produce an explicit error.
- **FR-007** — Each changed project edit MUST apply atomically through ordinary Blue project history with a descriptive MCP undo label. The UI, modified indicator, and applicable running engine MUST reconcile through the ordinary project update flow on commit, undo, and redo.
- **FR-008** — Each edit MUST require a matching project identity and version and return the resulting document identity, revision and history state on success. Competing Blue edits, undo/redo, or project replacement before commit MUST produce a conflict without applying stale input.
- **FR-009** — Read-write clients MUST be able to request play, stop, and render for the current project. Blue MUST limit rendered output to a locally approved directory or the saved project's working directory and reject an existing file or an escape from that boundary. Rendering and transport MUST leave project history unchanged.
- **FR-010** — Read-only clients MUST be limited to observation. Blue MUST refuse read-only requests that would execute project-authored code during inspection. Blue MUST require a local user decision before an external request activates edited or project-authored executable content, including live engine reconciliation where applicable. Render MUST fail closed where project content can bypass the output boundary.
- **FR-011** — Blue MUST return actionable failures for absent projects, stale versions, unsupported content, unavailable runtimes, and invalid inputs. Disable, port changes, credential rotation, and quit MUST revoke affected sessions and clean up obsolete connections. Pending work MUST be rechecked before effects.
- **FR-012** — The initial service supports local desktop MCP clients. Remote or LAN access, generic filesystem and shell tools, browser-provided MCP, and a stdio proxy are outside this release.

### Existing Behavior & Data Compatibility

- **Reference behavior** — Generation and playback follow the existing Blue paths for Java-compatible project and Csound behavior. This feature adds a client entry point for existing operations.
- **Compatibility requirements** — Existing project files, standalone resources, history, and generated Csound semantics retain their current compatibility rules. Existing program settings gain disabled, read-only defaults; invalid preferences produce safe defaults or explicit validation failures.
- **Migration boundaries** — MCP preferences and credentials belong to app settings. The feature adds no project or standalone-resource format migration.
- **Intentional divergences** — The local MCP surface adds access and execution checks to external requests. Blue’s ordinary UI workflow keeps its existing behavior.
- **State ownership** — The active Blue project owns project data, Blue history owns edit identity and restoration, Program Settings owns access preferences, and the engine owns playback and render state.
- **Undo/Redo impact** — Code, instrument upsert, score-object edit, and project-property edit must restore canonical content, supported identities and references, dirty state, and applicable runtime behavior through Undo and Redo.

### Key Entities

- **Local MCP service settings** — Enablement, preferred port, and access mode, with a separately managed credential.
- **Connection status** — Service phase, active endpoint if listening, and a recoverable failure description.
- **Project version** — Active document identity, monotonic revision, and current history state. A client uses it to bind a request to the state it inspected.
- **Project resources and operations** — Live project and engine views and bounded actions on the existing document and runtime.
- **Render request** — Project version and authorized output destination, with an explicit outcome.

## Success Criteria

### Measurable Outcomes

- **SC-001** — A tester can connect a compatible local client using copied settings and successfully read all four resources and invoke all four inspection operations on a representative project without restarting Blue.
- **SC-002** — All four project edit operations pass commit, undo and redo checks for canonical content, reference identity, and saved or modified status. Applicable engine reconciliation and renderer publication are observable.
- **SC-003** — Every read-only write attempt, every stale edit in the acceptance matrix, and every request with missing or invalid access in that matrix leaves project content and engine state unaltered.
- **SC-004** — One play–stop cycle and one audio render succeed for a representative project. Boundary escape, existing-output and unapproved execution cases produce no output write.
- **SC-005** — After each of disable, credential rotation, and quit, zero existing sessions retain access under their original credentials or connection. Blue remains usable when the preferred port is already occupied.

## Assumptions

- The user and the authenticated client run on the same machine. Possession of the credential authorizes access to the permitted project and diagnostic data.
- Only clients with compatible direct Streamable HTTP and bearer-header support receive a ready-to-paste configuration. Initial configuration targets are Cursor, VS Code, and local Codex. MCP Inspector is the protocol validation client. Claude Desktop direct local HTTP configuration remains outside the verified initial client set.
- An unsaved project needs a directory selected in Blue before it can render. MCP clients supply an output filename within the authorized directory.
- Existing file, module, and runtime permissions continue to apply. The user grants execution from Blue, where the project and requested action can be shown before the action occurs.
