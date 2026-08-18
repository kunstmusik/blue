# Data Model: Follow Score Playback and Page Scrolling

**Feature**: `079-follow-score-playback`

## Persistence and Ownership

| Entity | Canonical owner | Lifetime | Persistence | Purpose |
|---|---|---|---|---|
| Follow preferences | Main-process program-settings store | Across launches and projects | `program-settings.json` under Electron user data | Stores the user's explicit `followPlayback` and `followPlaybackOnStart` choices |
| Playback follow session | Renderer playback session store | From confirmed playback start until stop/error/reset/project close | None | Tracks the active follow state, including temporary manual-navigation suspension |
| Score viewport | Root score renderer | While the score panel is mounted | None | Tracks the current horizontal/vertical visible region and aligned time header |
| Follow scroll decision | Pure score-following logic | One playback/layout/navigation evaluation | None | Derives whether and where the viewport should move |
| Native menu mirror | Main-process menu state | While the application menu exists | None; derived from preferences/session sync | Provides synchronous checkbox state for the native Project menu |

The follow preferences are application settings and never become `.blue` project data. The
viewport and session suspension are disposable renderer state. The main menu mirror is derived and
must be refreshed from the saved preference at startup and from explicit renderer synchronization
events during playback.

## Follow Preferences

| Field | Type | Default | Rules |
|---|---|---:|---|
| `followPlayback` | boolean | `true` | The user's saved preference. Explicit toolbar, native-menu, and `F` actions update and persist it. Automatic suspension does not. |
| `followPlaybackOnStart` | boolean | `true` | The user's saved preference for new playback sessions. It does not change the active session by itself. |

The existing `ProgramSettingsSnapshot.playback` object remains the durable representation. A
narrow playback-preference update must merge only these fields into the current main-owned
snapshot, preserving unrelated settings and the existing version/timestamp behavior.

## Playback Follow Session

| Field | Type | Description |
|---|---|---|
| `activeFollowPlayback` | boolean | Whether automatic follow is currently allowed for the active playback session and is shown by the toolbar/menu mirror. |
| `savedFollowPlayback` | boolean | Hydrated copy of the durable `followPlayback` preference used to restore state after stop/reset. |
| `followPlaybackOnStart` | boolean | Hydrated copy of the durable on-start preference used when beginning a new session. |
| `playbackStatus` | existing playback status | `idle`, `starting`, `playing`, `stopping`, `stopped`, or `error`; only active playback drives automatic scrolling. |
| `sessionOrigin` | derived lifecycle category | Distinguishes a confirmed new user/session start from an internal loop or recovery restart. It need not be persisted. |

### State transitions

| Trigger | Active follow state | Saved preference | Persist? |
|---|---|---|---|
| Program-settings hydration | `savedFollowPlayback` | hydrated value | No |
| Explicit toolbar/menu/`F` toggle to `next` | `next` | `next` | Yes, immediately |
| Manual horizontal navigation during active follow | `false` | unchanged | No |
| Confirmed new playback session, on-start enabled | `true` | unchanged | No additional preference write |
| Confirmed new playback session, on-start disabled | `savedFollowPlayback` | unchanged | No |
| Internal loop, engine recovery, or position restart within session | unchanged | unchanged | No |
| Playback stop, error, project close, or runtime reset | `savedFollowPlayback` | unchanged | No |

The active state may therefore be `true` while the saved preference is `false` when the
follow-on-start preference temporarily enables follow. An explicit user toggle during that session
updates both values and becomes the new saved preference.

## Score Viewport

| Field | Type | Description |
|---|---|---|
| `scrollLeft` | finite non-negative number | Current horizontal body position in pixels |
| `scrollTop` | finite non-negative number | Current vertical layer position; preserved by automatic horizontal moves |
| `clientWidth` | finite non-negative number | Visible horizontal viewport width |
| `scrollWidth` | finite non-negative number | Total horizontal score content width |
| `pointerPixel` | finite non-negative number or null | Current playhead x-coordinate, derived from the active transport/time map |
| `targetScrollLeft` | finite non-negative number or null | Clamped result of a follow decision; null means no automatic move |

### Viewport decision rules

1. If playback is not active, the root timeline is not active, follow is disabled, the pointer is
   null/invalid, or the viewport has no usable width, return no automatic move.
2. If `pointerPixel` is within the current visible interval, return no move.
3. If the pointer is left of the viewport or has reached/passed its right edge, target the
   pointer's x-coordinate, clamped to `0..max(0, scrollWidth - clientWidth)`.
4. Applying an automatic target changes horizontal position only; `scrollTop` is preserved and
   the body and time header receive the same resolved horizontal position.
5. A scale/layout update may change the visible interval without suspending follow. If the pointer
   is then outside the interval during active playback, the same catch-up decision applies.

## Navigation Provenance

| Origin | Examples | Suspends follow during active playback? |
|---|---|---:|
| `user-navigation` | Body/header wheel or trackpad scroll, scrollbar drag, ruler drag/click, explicit marker/rewind navigation | Yes, when follow was active |
| `follow` | Page advance or catch-up generated by follow logic | No |
| `view-scale` | Horizontal zoom and cursor-anchored scale adjustment | No |
| `layout-sync` | Body/header alignment, group/session layout refresh, resize synchronization | No |
| `vertical-navigation` | Layer-only vertical scroll | No |

The origin is runtime-only. DOM scroll events must consume expected automatic targets before
classifying an unmatched horizontal delta as user navigation.

## Validation Rules

- Preference fields accept only booleans and are validated before persistence.
- Scroll coordinates and pointer positions must be finite; invalid values produce no movement.
- The horizontal target must be clamped to the actual available scroll range.
- Automatic scrolling is limited to the root score timeline and active playback.
- No entity in this model changes score objects, transport values, `.blue` XML, generated CSD, or
  engine audio state.
