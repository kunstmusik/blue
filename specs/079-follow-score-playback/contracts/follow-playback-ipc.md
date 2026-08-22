# Follow Playback IPC and Preference Contract

**Feature**: `079-follow-score-playback`

The contract keeps durable application settings in Electron main while allowing the renderer to
own responsive playback-session behavior. All payloads are serializable and boolean fields are
validated at the boundary.

## Renderer → Main: Active-State Mirror

**Channel**: existing `sync-follow-playback-state` (or an equivalent typed wrapper)

**Payload**:

```text
boolean
```

**Semantics**:

- Updates the main-process native-menu mirror and rebuilds the application menu when the value
  changes.
- Does not write `program-settings.json`.
- Is used for automatic suspension, session restoration after stop, and explicit active-state
  changes.
- Must accept only messages from an application workbench renderer.

## Renderer → Main: Durable Preference Update

**Channel**: new narrow playback-preference update operation

**Request**:

```text
{
  followPlayback?: boolean;
  followPlaybackOnStart?: boolean;
}
```

At least one field must be present. The main process loads the current settings, merges only the
provided playback fields, validates the result, and writes the existing versioned settings file
using the current atomic write path.

**Response**: the existing `ProgramSettingsSaveResult` shape, containing `ok`, the updated
`ProgramSettingsSnapshot` on success, and validation issues when applicable.

**Failure behavior**:

- Invalid payloads are rejected without changing the settings file.
- A failed write does not update the main menu mirror or claim a durable preference change.
- The renderer keeps the last confirmed saved preference separate from the active session state;
  it may keep playback running and must be able to restore the confirmed value after an error.

## Main → Renderer: Explicit Native/Settings Synchronization

**Channel**: existing `native-menu-command` delivery path, extended with explicit state commands

```text
{ type: 'set-follow-playback'; enabled: boolean }
{ type: 'set-follow-playback-on-render-start'; enabled: boolean }
```

The commands carry the resolved value, not a toggle instruction. They are sent after a native-menu
or settings-window preference change has been accepted by main. Renderer handling updates the
hydrated preference/session state without performing a second toggle or a second full-snapshot
write.

## Existing Settings Compatibility

When the existing `program-settings:save` or playback-panel reset path changes either follow
field, main must refresh its menu cache and notify active workbench renderers using the same
explicit state contract. This prevents the Settings window from leaving the main workbench or
native menu stale.

## Non-Contractual Runtime Data

Viewport coordinates, expected-scroll provenance, playhead pixels, and manual-suspension markers
must not cross IPC and must not be persisted in the project document or settings file.
