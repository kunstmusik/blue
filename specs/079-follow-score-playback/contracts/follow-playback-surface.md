# Follow Playback Surface Contract

**Feature**: `079-follow-score-playback`

This contract describes the observable toolbar, native-menu, keyboard, and score-viewport
behavior. The implementation must preserve these behaviors across renderer remounts and playback
status updates.

## Control State

| Context | Toolbar `F` | Native Project checkbox | Active follow state |
|---|---|---|---|
| No project | Disabled/unavailable | Disabled/unavailable | No follow work is performed |
| Project loaded, no active session | Shows saved preference | Shows saved preference | Saved preference |
| Active playback | Shows current session state | Mirrors current session state | Session state |
| Playback stopped/error/reset | Shows saved preference | Shows saved preference | Saved preference |

The toolbar and native checkbox must change together for explicit toggles and automatic manual
navigation suspension. The native menu must be able to render its checkbox synchronously from its
main-process mirror without querying the score DOM.

## Explicit Actions

Each explicit action has the same semantics:

1. Compute the next active state.
2. Update the active session state and the saved follow preference.
3. Persist the saved preference through the main-owned playback-settings update contract.
4. Synchronize the active state to the native menu.
5. If playback is active and the new state is enabled, catch the viewport to the current playhead
   when it is outside the visible interval.

Automatic suspension is not an explicit action: it changes only the active session state and sends
the non-persistent state mirror.

## Keyboard Scope

- The shortcut is unmodified `F`; Command, Control, Alt, and Shift combinations are ignored.
- Auto-repeat is ignored so holding the key cannot toggle repeatedly.
- The shortcut is active only when a project is loaded.
- Focus in an input, textarea, select, content-editable surface, CodeMirror/code editor surface,
  selected code editor, or workbench context menu suppresses the shortcut.
- The intended text/control interaction must remain available when the shortcut is suppressed.

## Follow Viewport

- Automatic movement runs only for active playback on the root score timeline.
- While the playhead is inside the current horizontal viewport, the viewport does not move.
- When the playhead reaches/passes the right edge or is behind the left edge, the viewport jumps to
  the playhead x-coordinate, clamped to the content range; vertical position is unchanged.
- If follow is enabled while active playback has a valid playhead outside the viewport, the same
  catch-up occurs immediately.
- When playback is stopped or paused, manual playhead changes do not trigger automatic scrolling.
- Horizontal user navigation suspends active follow; vertical-only navigation, zoom, resize, and
  automatic follow movement do not.
- Body and time-header horizontal positions remain equal after all synchronized movement.

## Session Lifecycle

- A confirmed new session applies `followPlaybackOnStart`: enabled starts active; disabled starts
  from the saved follow preference.
- A loop boundary, engine recovery, or internal position restart does not apply the on-start rule
  again or clear a manual suspension.
- Stop/error/project-close/reset ends the session and restores the active state to the saved
  preference.
