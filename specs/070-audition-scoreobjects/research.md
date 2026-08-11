# Research: Audition Selected ScoreObjects

## Decision: Preserve the Java shortcut with Electron’s cross-platform accelerator

- **Decision**: Register the native Project-menu item with `CmdOrCtrl+Shift+A`.
- **Rationale**: Java Blue registers the action at `Shortcuts/DS-A`; NetBeans `D` is the platform-default primary modifier and `S` is Shift. Electron’s `CmdOrCtrl` maps this to Cmd+Shift+A on macOS and Ctrl+Shift+A on Windows/Linux.
- **Alternatives considered**:
  - Add a renderer-only keydown handler: rejected because it can conflict with focused editors and does not provide the native-menu accelerator parity.
  - Register separate platform-specific menu items: rejected because `CmdOrCtrl+Shift+A` precisely expresses the required behavior once.

## Decision: Route native menu activation through the renderer, then invoke a validated main-process action

- **Decision**: The native item dispatches a typed workbench command. The renderer flushes pending document patches and sends its current selected object IDs through preload IPC. Electron main resolves every ID against canonical `BlueData` before auditioning.
- **Rationale**: This follows the existing Render/Stop Project menu flow, avoids rendering before queued renderer edits reach the canonical document, and makes stale selections recoverable. Main still owns all project and engine mutation.
- **Alternatives considered**:
  - Start from a selection cached solely in Electron main: rejected because it may lag the renderer and cannot guarantee pending score changes are included.
  - Let the renderer create/render a project copy: rejected by canonical ownership and engine-isolation boundaries.

## Decision: Use structural source/copy traversal rather than Java clone-source hashes

- **Decision**: Resolve original selected score-object references before copying, then filter the copied score by traversing source and copy in lockstep. Retain selected items and remove empty layers, tracks, and layer groups.
- **Rationale**: Java uses selected objects’ `hashCode()` and copied objects’ clone-source hash. In the TypeScript port, the generic sound-object hierarchy does not consistently assign an original identity hash during deep copy, so hash matching could silently retain nothing. Whole-project deep copy preserves score structure, allowing deterministic structural pairing without extending persistence or object identity semantics.
- **Alternatives considered**:
  - Port Java clone-source hashes first: rejected as unnecessary new identity infrastructure and a larger parity change than the audition feature requires.
  - Match objects by display name/time: rejected because duplicate objects are valid and names/times are not identity.
  - Filter the canonical score before copying: rejected because it would risk mutating the opened project.

## Decision: Treat Track LayerGroups as selected-score containers

- **Decision**: For Track LayerGroups, keep only Tracks containing selected sound objects or audio clips; clear retained Tracks’ mute/solo state; preserve their deep-copied instruments, automation, mixer association, and selected items.
- **Rationale**: Track LayerGroups are the TypeScript canonical score model and use the same score-generation contract. Their mixed item support is required for an audible and isolated selection.
- **Alternatives considered**:
  - Remove Track LayerGroups like Java’s non-`ScoreObjectLayerGroup` path: rejected because it drops canonical TypeScript project content.
  - Keep whole selected Tracks: rejected because it violates selected-only audition.

## Decision: Reuse the existing realtime playback lifecycle with a supplied temporary project

- **Decision**: Refactor the existing main-process playback startup just enough to accept a render source distinct from canonical `currentData`, while preserving its status broadcasts, output routing, Java-script/on-load processing, and `EngineBridge` invocation.
- **Rationale**: An audition must replace active realtime playback and expose the same user-visible lifecycle without creating a second engine path.
- **Alternatives considered**:
  - Change `currentData` to the audition copy temporarily: rejected because it risks split ownership and visible project changes.
  - Build a separate audition engine session: rejected because it duplicates lifecycle, status, and failure logic.

## Decision: Match Java's explicit audition-stop and render-arbitration points

- **Decision**: Stop an active audition on any score-timeline mouse press, while
  leaving ordinary project playback alone. Starting a normal realtime render or
  a new audition replaces the existing realtime session. Starting Render to Disk
  stops realtime playback before opening its dialog or launching Csound.
- **Java evidence**: `ScoreMouseListener.mousePressed()` calls
  `RealtimeRenderManager.stopAuditioning()` before dispatching score gestures;
  `RealtimeRenderManager.renderProject(...)` stops an existing realtime render
  before starting either a normal or audition render; and
  `RenderToDiskUtility.renderToDisk(...)` calls `stopRendering()` before disk
  render setup. No Java focus-loss handler was found that stops audition solely
  because the score window or selected object loses focus.
- **TypeScript mapping**: The score timeline uses a capture-phase mouse-down
  handler and a transient renderer `isAuditioning` flag, so selection/move/
  marquee gestures stop only auditions. Main-process startup carries the
  audition kind and cancellation fence, and Render to Disk awaits the existing
  realtime stop path before beginning its exclusive operation.
- **Alternatives considered**:
  - Stop all playback on every timeline click: rejected because Java's
    `stopAuditioning()` is conditional and normal project playback continues.
  - Stop on generic panel focus loss: rejected because the Java sources do not
    implement that behavior and it would stop playback for unrelated editor
    focus changes.
