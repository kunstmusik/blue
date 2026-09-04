# State and Configuration Model: Validated Cleanup Second Batch

This feature introduces no project entity, persistence format, database table, or durable runtime
state. Its model consists of cleanup evidence, existing renderer state boundaries, CLI input, and
repository import policy.

## Cleanup Candidate

- **Identity**: Exact file, exported symbol, store member, documentation entry, or stale comment.
- **Consumer evidence**: Production imports/calls, test calls, package scripts, CI references,
  dynamic access, and current documentation.
- **Disposition**: Remove, retain as active/protected, or defer as ambiguous.
- **Compatibility owner**: Existing package, store, command, or maintenance workflow that would be
  affected by removal.

### Validation rules

- Removal requires zero supported consumers at implementation time.
- A test that exists only to exercise a dead surface is removed or retargeted with that surface.
- A current production, maintenance, or compatibility consumer changes the disposition to retain
  or defer; its consumer is not migrated merely to enable deletion.
- Public engine-client entrypoints and named protected artifacts remain unchanged.

### State transitions

`candidate` → `verified unused` → `removed` → `validated`

`candidate` → `active or ambiguous consumer` → `retained/deferred`

## Renderer Store Member

- **Owner**: Existing Zustand store.
- **State field or action**: A member named in the current cleanup inventory.
- **Consumer class**: Production, test-only, internal-only helper, or none.
- **Retention boundary**: Adjacent active state and actions remain owned by the same store.

### Validation rules

- Direct `getState()` calls, selectors, hooks, imports, and tests count as consumers.
- Test-only behavioral teardown may be rewritten to reset active fields directly; production
  behavior must not be redesigned.
- MIDI draft/dirty state, score automation previews/selections, selected ranges, output color
  overrides, legacy settings synchronization, and active-panel state are retained.

## OSC Invocation

- **Selection**: Registered command identifier or custom OSC address, but not both.
- **Destination**: Host name and integer UDP port from 1 through 65,535.
- **Control modes**: Help and command listing, both of which exit without network output.
- **Transport boundary**: One resolved OSC address sent to the selected host/port.

### Validation rules

- Host defaults to `127.0.0.1`; port defaults to the shared preferred OSC port.
- Literal package-manager `--` separators do not change parsing.
- Missing values, unknown options, missing selection, conflicting selection, invalid address, port,
  or command fail before a network send and include usage guidance.
- `--help`, `-h`, and `--list` complete successfully without opening a client connection.

## Serializable Snapshot Copy

- **Input corpus**: Renderer project-editor snapshots made of primitives, arrays, plain records,
  and optional values.
- **Output**: Structurally equivalent independent value.
- **Mutation guarantee**: Nested mutation of the result does not alter the input.
- **Invalid corpus**: Functions, symbols, DOM nodes, and other non-serializable runtime objects.

### Validation rules

- The replacement applies only to the two renderer-local helpers whose callers already require
  serializable snapshots.
- Unsupported values may fail using the native clone error; no compatibility fallback is added.
- The shared project-editor clone helper remains unchanged until its live-model value shapes are
  specified separately.

## Import Discovery Policy

- **Default**: Explicit static imports for fixed application-owned asset and module membership.
- **Exception trigger**: A feature specification intentionally requires automatic discovery.
- **Exception evidence**: Deterministic checks for missing, duplicate, malformed, and unexpected
  members and their naming contract.
- **Protected fixed set**: The 32 BlueX7 algorithm diagrams and number-to-image mapping.

### State transitions

`fixed set` → `explicit imports retained`

`discovery proposed` → `specification justification` → `membership contract` → `approved use`
