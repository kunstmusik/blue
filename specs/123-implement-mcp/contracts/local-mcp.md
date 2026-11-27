# Contract — Blue local MCP endpoint

## Transport and access

Connect to `http://127.0.0.1:<activePort>/mcp` using Streamable HTTP. Use the SDK for current sessionless discovery and calls, and for authenticated `subscriptions/listen` streams. Support handshake-era discovery and calls through the SDK stateless compatibility path. Clients send `Authorization: Bearer <token>` with every request. Requests must have an exact loopback Host with the active port, either `127.0.0.1` or `localhost`. Origin may be absent for native clients. When present, it must match the endpoint's exact HTTP origin or its localhost alias with the same port. Blue sends no cross-origin grant.

| Condition | Outcome |
| --- | --- |
| Disallowed Host or Origin | HTTP 403 |
| Missing or invalid credential | HTTP 401 with Bearer challenge |
| Body above 2 MiB, including chunked input | HTTP 413 |
| Session or active-work capacity reached | HTTP 429; the client may retry after capacity frees |
| Subscription stream ends or access is revoked | Reconnect or resubscribe with the current credential |
| Unsupported HTTP method, content type, protocol version, or malformed JSON-RPC | HTTP or protocol error as specified by Streamable HTTP and the SDK |
| Valid tool call rejected by Blue | MCP tool error with `isError: true` and a stable Blue error code and safe explanation |

Clients must rediscover tools after changing access. Blue publishes a tool-list change signal to unaffected sessions when possible and checks permission at execution even for previously listed tools. Disable, rebinding, rotation, and quit close affected streams. The client can reconnect after service recovery or a credential update.

## Resources

| URI | Content |
| --- | --- |
| `blue://project/summary` | JSON with receipt, title, author, notes, nullable project path, dirty state, instrument index, and sound-layer index. |
| `blue://project/csd` | Plain-text disk-profile CSD for the current receipt when observation-only generation is available. |
| `blue://project/instruments` | JSON with receipt and assignment IDs, names, instrument types, and enabled state. |
| `blue://engine/status` | JSON with connection, playback state, current playback document where known, and bounded recent console output. |

Project resources support the current protocol subscription stream. Handshake-era clients can re-read resources and refresh discovery. Send `notifications/resources/updated` for subscribed project URIs on activation, replacement, close, and canonical edit or save state publication as applicable. Read again to obtain data. No-project reads return a resource error with the Blue no-project code. Engine status remains available.

## Tools

Inputs are strict objects. All numeric values are finite. IDs are nonempty and bounded. `expected` is the complete document receipt. The score locator comes from the same receipt supplied by the client. Existing model invariants further restrict valid fields and settings. Missing fields preserve existing values. Empty edits and unsupported fields are rejected. Changed project edits return the new `documentId`, `revision`, and `stateId`, together with `changed` and applicable runtime outcomes.

| Tool | Access | Input and result |
| --- | --- | --- |
| `get_project_summary` | Read | Empty input. Returns the project summary. |
| `get_instrument` | Read | `instrumentId`. Returns the receipt, metadata, and supported code fields. |
| `list_score_objects` | Read | `layer`, optional paired `start` and `end` in score beats, optional `offset` and `limit` (default 100, maximum 500). Returns the receipt, ordered objects with type, locator, name, start and duration, and the next offset if any. Ranges are half-open and select overlapping objects. |
| `generate_csd` | Read | Empty input. Returns receipt, disk-profile CSD, and diagnostics or a structured failure when the safe build cannot run. |
| `update_instrument_code` | Write | `expected`, `instrumentId`, and `changes` containing `text` for GenericInstrument, `instrumentText` or `alwaysOnInstrumentText` for Blue Synth Builder, and `globalOrc` or `globalSco` for either. |
| `upsert_instrument` | Write | `expected`, `instrumentId`, and `changes` containing name and/or enabled state. A missing ID creates a GenericInstrument with the requested ID and a required name. An existing ID updates metadata while retaining type and existing content. |
| `update_score_object` | Write | `expected`, `locator`, and `changes` containing supported `start`, `duration`, `name`, or GenericScore `text`. Start is nonnegative and duration is positive. |
| `set_project_properties` | Write | `expected` and `changes` containing `title`, `author`, `notes`, `sampleRate`, `ksmps`, or `nchnls`. Audio settings are positive integers subject to existing platform-independent validation. |
| `transport_play` | Write | `expected`. Starts playback through the existing controller after approval where required. Already playing the requested project is an idempotent outcome. |
| `transport_stop` | Write | `expected`. Stops only the targeted active project's playback. An already stopped target is an idempotent outcome. |
| `render_to_disk` | Write | `expected` and a single WAV output `filename`, with optional `destination` of `project` (default) or `choose` (local folder picker). Returns the terminal job outcome and native path on success. The client cannot supply an absolute folder or engine arguments. |

Confined render destinations must be on the same filesystem as Blue’s temporary render storage and support native atomic no-replace publication.

Project property settings use the established editor semantics. Settings with separate disk and realtime fields apply the named value to realtime. Any disk render settings remain project-owned and follow existing rules.

Blue returns stable domain codes such as `NO_ACTIVE_PROJECT`, `CONFLICT`, `ACCESS_DENIED`, `NOT_FOUND`, `INVALID_INPUT`, `UNSUPPORTED_CONTENT`, `EXECUTION_REQUIRED`, `ENGINE_UNAVAILABLE`, `OUTPUT_REJECTED`, `CANCELLED` and `BUSY`. The explanation gives the next useful action, such as rereading the current receipt. Error details exclude credentials, request headers, and host stack traces. Protocol framing and invalid parameter errors follow the SDK. MCP tool annotations are discovery hints; actual permissions are enforced in main.

## Program Settings boundary

Existing settings get, save and reset operations carry only preferences. Add typed main/preload operations to read and subscribe to sanitized runtime status, copy the credential or a selected client's config, and rotate the credential. Build and write copy content in main when the user requests it. Keep the raw credential out of renderer settings state and broadcasts. Snippets name the client, use the actual bound port, and use its documented bearer setting. Cursor stores the header in its local configuration. VS Code prompts for a secret input, and local Codex references an environment variable. Disable copying until an endpoint and current credential are available. A credential rotation reports whether it was persisted or is session-only and closes the previous sessions. If protected storage rejects every way to persist revocation, the response reports that rotation did not commit. The current listener closes, and the existing credential may be loaded after restart once storage recovers.

On macOS, one empty, app-managed scratch WAV per profile may persist after completion or cancellation. A crash can leave unpublished audio until startup recovery verifies ownership and obtains exclusive access.
