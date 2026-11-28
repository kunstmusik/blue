# Implementation Plan — Local MCP access for Blue

**Branch** — `codex/implement-mcp`
**Date** — 2026-11-26
**Spec** — [Feature specification](spec.md)

## Summary

Add a disabled-by-default, authenticated Streamable HTTP server to Blue's Electron main process. A narrow adapter connects it to the active project, history, and runtime. Deliver inspection and service management first, followed by undoable edits and then playback and render.

## Technical Context

- **Language and platform** — Strict TypeScript, Electron main/preload and existing React settings UI, on Blue's supported macOS, Windows, and Linux targets.
- **Dependencies** — Node HTTP and crypto, Electron credential protection, existing Blue document and engine services, and the MCP TypeScript SDK with Zod in app main.
- **Storage** — Program Settings preferences and a main-owned protected credential. Existing project and audio persistence paths.
- **Testing** — Vite+ and in-memory MCP transport, injected host/runtime dependencies, a real loopback smoke test, and desktop Inspector verification.
- **Performance goals** — No new timed product budget. Bound incoming bytes and concurrent work; keep correctness cases in ordinary CI.
- **Constraints and scale** — One desktop process and one active project, one local listener with bounded sessions and streams, four resources, and eleven tools across both access modes.

## Constitution Check

### Before research

| Gate | Assessment |
| --- | --- |
| Portable data core | Pass. HTTP, credentials, settings, and runtime wiring belong in the app. |
| Java and project compatibility | Pass. Reuse established project behavior and output generation. Verify parity against existing fixtures without changing serialization. |
| Migration scope | Pass. Settings need safe defaults. Project and standalone XML need no migration. |
| Canonical ownership | Pass. Settings, active project, history, and runtime each retain their current owners. IPC carries validated, serializable settings and status. |
| Undo and redo | Pass. Each durable edit requires history settlement, current-version validation, and a labeled canonical commit. |
| Runtime isolation | Pass. The bridge delegates to main-owned execution services. |
| Host paths | Pass. Render destinations require native-path containment, symlink and overwrite checks, and Windows verification. |
| Verification | Pass. Use focused transport, history, runtime and lifecycle checks with end-to-end desktop validation. |
| Correctness and performance | Pass. Validate caps, cancellation, and work counts deterministically in ordinary CI. |
| Licensing and provenance | Pass for design. Repository and app scope are GPL-3.0-or-later. Candidate library licenses and packaging obligations are evaluated below before dependency adoption. |

## Project Structure

### Documentation

```text
specs/123-implement-mcp/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/local-mcp.md
└── quickstart.md
```

### Source code

```text
packages/blue-app/src/
├── main/
│   ├── mcp-server-service.ts        # Listener, HTTP guards, and SDK lifetime
│   ├── mcp-bridge.ts                # Narrow app-side capability adapters
│   ├── mcp-tools.ts                 # Tool schemas and structured results
│   ├── mcp-resources.ts             # Resources and notification registration
│   ├── main.ts                      # Composition, lifecycle, and canonical publication
│   ├── program-settings-store.ts   # Safe defaults and persisted preferences
│   └── project-history.ts          # Trusted queued guard where required
├── shared/
│   ├── mcp-server.ts               # Serializable preferences, status, and copy results
│   └── program-settings.ts         # Settings integration
├── preload/                        # Typed, scoped Settings operations
└── renderer/components/settings/ # MCP panel alongside OSC
```

Use the OSC service and Settings panel as structural references. The TCP binding policy is defined by this feature. Keep transport free of project models, engine access, and windows. Keep the SDK and credential access in main. Reuse typed renderer subscriptions and the existing native confirmation wrapper.

## Phase 0 — Decisions

[Research](research.md) resolves SDK and compatibility choices, credential persistence and client config, the ordered history seam, read-only generation safety, and the runtime and license gates.

## Phase 1 — Design

[Data model](data-model.md) defines owners and receipt semantics. The [MCP contract](contracts/local-mcp.md) defines tools, resources, Settings operations, and failure outcomes. [Quickstart](quickstart.md) specifies implementation acceptance.

### Delivery order

1. **Inspection and settings**. Wire the service into main readiness, startup rollback, and accepted quit. Add operational Settings controls, the credential and client-copy actions, four resources, four read tools, compatible notifications, and observation-only CSD admission.
2. **Undoable editing**. Register restricted write operations behind an explicit permission change. Validate live targets and patch semantics at the canonical history seam. Publish project updates using the existing callbacks. Return the true commit receipt and reconciler outcomes.
3. **Timeline and render**. Add explicit play/stop and one-shot render admission to the existing coordinators. Implement and verify the executable-content and output boundary before exposing render. This phase is limited to the positively verified render profile.

### Lifecycle and effect ownership

Compare decoded fixed-length credentials in constant time. Authenticate every request before SDK dispatch and before parsing any body. Enforce the 2 MiB byte cap for both declared and streamed lengths. Validate Host and Origin before accepting a stream.

Service composition updates desired preferences only after Settings validates and persists them. Compare changed enablement, port, mode, and credential independently. Accept only one listener generation. Start on the configured port, with one OS-assigned fallback (port 0) on `EADDRINUSE`, and publish the actual bound port. One queue owns server replacements. Revocation advances authority synchronously before a queued close starts. The app quit lifecycle triggers shutdown after the user accepts quit, before disposing project or runtime dependencies.

| Owner and current phase | Event | Next phase and effect |
| --- | --- | --- |
| MCP service, stopped/error | Enable or retry | Starting or restarting. Provision credential, then bind only to `127.0.0.1`. |
| MCP service, starting/restarting | Current bind completes | Listening with actual port, or error with sanitized diagnostic. A late bind releases its own resources only. |
| MCP service, listening | Port change | Revoke admission, close old streams/server, then bind the latest port. |
| MCP service, listening | Access mode change | Update authorization immediately. Retain the listener, notify current clients of discovery changes, and fence queued work. |
| MCP service, listening | Rotate | Revoke old credential and close associated streams. Provision the replacement or enter error. If both revocation markers and credential invalidation fail, report that rotation was not committed and keep the current process closed until a successful rotation. A later launch can still read the existing credential after storage recovers. |
| MCP service, any phase | Disable or accepted quit | Revoke and cancel pending work, close SDK handlers, streams and owned sockets, await listener close. Quit is terminal and idempotent. |
| Bridge, read/approval pending | Project version changes, access is revoked, or request cancelled | Cancel where supported; drop stale reads and approval completions. |
| History/runtime owner, effect pending | Reaches ordered effect seam | Revalidate action grant and receipt with no intervening await before effect. Report earlier committed effects accurately if a later step fails. |
| Render coordinator, idle | An approved request passes the launch check | Electron's engine runtime allocates an owned WAV descriptor before Csound runs (Linux `O_TMPFILE`, macOS locked per-profile scratch file, Windows handle-pinned staging directory). The child reads the CSD in memory from stdin and writes WAV audio directly to the inherited descriptor. The coordinator rejects competing jobs until settlement. |
| Render coordinator, rendering | Child exits, access is revoked, or the request is cancelled | The engine runtime collects the child exit, calls the coordinator's publication check only for a verified completed descriptor, and releases owned staging via descriptor close (and Windows handle-bound `FileDispositionInfo` cleanup) on every outcome. Service disable aborts the request. Accepted quit also waits for cleanup. |
| Render coordinator, ready to publish | Current receipt, grant, cancellation and directory pass the publication check | Run the native metadata-only commit (`--publish-confined-render`) synchronously within the same main-process turn with the owned WAV descriptor on stdin. Publish the verified descriptor with atomic no-replace semantics and preserve the committed result through subsequent cancellation. |
| Render coordinator, ready to publish | Stale authority, changed directory or an existing target | Decline publication and release only the owned staging descriptor/handle without touching unrelated entries. |

Keep request deadlines for incomplete headers/bodies and bound live requests, stream count, diagnostic buffer, and queued long-running work independently. Limits are containment controls, with HTTP 429 or domain BUSY at capacity. Stop admitting work before closing. Cancel external work without blocking listener shutdown on a pending native dialog or stale client connection. Release stale callbacks through cancellation fences.

### History, runtime, and path integration

- Resolve MCP inputs from the inspected document. Use ordinary document patches with a server-owned operation ID, single-operation phase, and no stale-rebase preconditions. Settle renderer drafts before queuing when required. Run the trusted full-receipt and access check inside the history queue after barriers. The guard must precede preparation or mutation and cannot be called with client-controlled policy. Never retry by silently rebasing or bypassing undo capacity.
- The workbench patch queue owns its history sequence for the current project session. A replacement session starts at zero, and the existing submission generation discards completions from the earlier session. Repeated publications and resets within a session preserve its sequence.
- Instrument code maps to `orchestra.updateInstrument` after type-specific validation. Instrument metadata combines `updateInstrument` and `updateAssignment` in one commit. Creating a GenericInstrument uses the approved prepared structural path for the arrangement, with ID collision validation at the atomic seam and stable IDs through undo/redo.
- Score updates resolve the server-owned editor target from the version-bound locator. Use `score.updateSharedProperties` with the established beat/time-base conversion and `score.updateTypeSpecificEditor` for verified GenericScore text. Project properties use the ordinary typed property patch, including existing validation and conversion of audio settings. Equal values preserve history and the receipt.
- Use labels such as “MCP: Update Instrument 1”, “MCP: Add Instrument 1”, “MCP: Update Score Object”, and “MCP: Set Project Properties”. Use accepted history publications for renderer and subscriber refresh, including save/Save As checkpoints and activation/close lifecycle events. Reuse established runtime reconciliation, including restart-required outcomes for code changes. Require approval if a runtime path would actually activate new executable content.
- Inspection captures one canonical revision, builds bounded DTOs, and uses detached input for async CSD generation. Preflight modeled types and dependencies before any on-load hook, interpreter, or host-backed preparation. Expose the disk-profile generator on proven observation-only inputs and report unsupported content otherwise. Tee a bounded Csound-only log tail from the established engine output callback.
- Drive ordinary timeline playback only. Do not route through toggles. Recheck existing identity and grant after generation, engine setup, retry, and any confirmation. Scope automatic loops and recoveries to the still-approved source and capability. Validated stop targets the current project's playback. Existing authorized playback may continue after access revocation, but external continuations that would start execution again need current authority.
- For render, obtain a saved project directory or invoke a local folder picker. Validate an audio leaf filename (initially WAV), including Windows drive/UNC, device-name, separator, and alternate-stream rules. Keep native paths for host calls. Resolve the canonical root and use the existing host identity abstraction where applicable. Reject escaping or replaced paths, overwrites, and unavailable atomic no-replace semantics. Test synthetic Windows inputs and native Windows filesystem behavior.
- Admit the initial render profile by verified input and generated executable content, including allowable options. The initial representative project is dependency-free and contains a simple sine instrument with literal score events. Deny arbitrary includes, interpreter-backed generation, unvetted advanced/override flags, plugins or output-capable constructs outside the profile. An explicit approval allows the operation but cannot substitute for containment. If the implementation cannot prove eligibility before engine dispatch, leave this case unavailable.
- Use the existing one-shot render coordinator with vetted options and an Electron-owned temporary directory. Stage beside the approved output when it is on a different filesystem from the OS temp area. Linux allocates through the verified directory descriptor. macOS and Windows create the scratch entry relative to a verified native directory handle. The native publisher opens the authorized directory and verifies the staged WAV by handle, then commits without replacement with an APFS file clone, a Linux descriptor-based link, or a Windows handle-relative rename. Windows directory handles omit delete sharing during publication. Reject if the operation cannot establish the required guarantees. Clean owned artifacts after the render process exits, including when the process is terminated. Changes use original code in the existing license scopes. [Apple filesystem APIs](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/APFS_Guide/ToolsandAPIs/ToolsandAPIs.html) · [Linux linkat](https://man7.org/linux/man-pages/man2/linkat.2.html) · [Windows handle-relative rename](https://learn.microsoft.com/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information)

### Constitution check after design

| Gate | Assessment |
| --- | --- |
| Portable data core | Pass. No host dependencies or feature code in `@blue/data`. |
| Java and project compatibility | Pass. Use Blue's existing serializers and disk-profile CSD path. Java revision and reference behavior are recorded in research. `MCP` adds entry-point policy, with no XML or generation semantic changes. |
| Migration scope | Pass. Settings gain safe defaults and protected credential recovery. Disk, library, and BlueShare resource behavior follow existing contracts. |
| Canonical ownership | Pass. Main owns listener, credentials, and IPC validation. The project, history, and runtime retain authoritative state. The bridge exposes versioned snapshots and effects. |
| Undo and redo | Pass. Each durable operation has a typed or approved structural history path and labeled commit, undo, redo, dirty-state, renderer, and applicable runtime verification. Transport and render are runtime-only. |
| Runtime isolation | Pass. Host work stays in app main through existing engine/runtime services. Effects remain subject to version, access, approval, and proven content boundaries. |
| Host paths | Pass with phase 3 implementation acceptance. Native containment, anchored no-replace output, and Windows validation are release gates. |
| Verification | Pass for design. The quickstart covers socket and in-memory contracts, real desktop inspection, UI state, guarded history, runtime and package checks. |
| Correctness and performance | Pass. Existing correctness workloads remain in normal CI. No new speed threshold or mixed timing assertion is proposed. |
| License compatibility and provenance | Pass for design. App code is original within GPL-3.0-or-later. Candidate SDK notices, transitive audit, inventory and package obligations are recorded in research. |

### T073 staging ownership and cleanup

Confined rendering requires `csound-confined-render-v5`. Csound reads the CSD in memory and writes audio to the inherited WAV descriptor. Linux uses an anonymous temporary file. Windows uses verified handles for publication and cleanup.

On macOS each profile can leave one empty scratch WAV in the OS temporary directory and one per approved directory used on another filesystem. Startup recovery also checks registered destination directories that are available and still match their recorded identity. A dedicated SQLite record in Electron user data tracks its device, inode, ownership token and dirty state. Exclusive creation, owner-only permissions and a nonblocking exclusive file lock protect acquisition. The writer inherits the lock. Blue records ownership before starting the child, clones the open file into the approved destination on commit, and truncates and syncs the original descriptor after the child exits. Startup and the next render recover a dirty record only after acquiring the lock and verifying the descriptor's identity and ownership attribute. An active writer keeps its audio. A missing file clears the record. A replacement or unverified entry is preserved and acquisition fails closed. An interrupted render may leave partial audio until recovery. No pathname-based WAV or directory deletion is required on macOS.
