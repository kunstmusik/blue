# Feature Specification: Blue File Manager Panel

**Feature Branch**: `codex/076-file-manager-panel`

**Created**: 2026-08-16

**Status**: Complete

**Input**: User description: "Create a branch and spec for the Blue File Manager panel row from MISSING_FEATURE_GPT.md. Research Java Blue's FileManager, including context menu actions and drag-and-drop sources and targets."

## Clarifications

### Session 2026-08-16

- Q: Where should File Manager favorite root paths be persisted? → A: In the main-process `program-settings.json` store under `appSpecific.fileManagerFavorites`; renderer edits flow through the existing typed program-settings IPC (consistent with specs 044/054/058/059).
- Q: Should this feature also implement external OS file drops (`.wav`/`.aif`/`.aiff`) onto the audio-layer timeline, or only File Manager node drags? → A: Implement both paths in this feature, mirroring Java's combined `AudioLayersDropTargetListener` (File Manager node drags plus external single-file `.wav`/`.aif`/`.aiff` drops).
- Q: Should non-audio regular files dropped from File Manager onto an audio layer be accepted or rejected? → A: Add the valid Csound-readable source formats to the filter and apply one shared audio-extension allowlist to both kinds of drops (File Manager node drops and external OS drops); non-matching files are rejected.

### Session 2026-08-17

- Q: Should double-clicking a supported audio file in File Manager open it in the Audio File Player? → A: Yes. Double-clicking a regular file whose extension is in the Audio File Player's browser-decodable list authorizes the path in main through the existing audio stream protocol policy, opens the Audio File Player panel on demand, and routes the file through the existing pending-file bus (load + autoplay). Player-unsupported files and directories do nothing.
- Q: Should expanded/open tree state survive moving the panel between docked and slideout modes? → A: Yes. Loaded listings, diagnostics, and open-node ids live in a session-lifetime renderer cache that survives component remounts caused by docked/slideout moves; the state is still disposable and never persisted. Tree node ids are branch-unique (`root-id#name` chains) so the same directory reached through different roots keeps independent open state.
- Q: Should double-clicking an `.sf2` file in File Manager open the SoundFont Viewer? → A: Yes. Double-clicking an `.sf2` file opens the SoundFont Viewer panel on demand and routes the path through a pending-file bus so the viewer loads its metadata; this reuses the viewer's existing inspection flow and requires no audio-stream authorization.
- Q: Should the tree's scroll position survive panel remounts, like open state does? → A: Yes. Scroll offset joins the session-lifetime renderer cache (observed reset: opening the SoundFont Viewer from a File Manager double-click remounted the File Manager and reset scroll). Cleared on restart; never persisted.
- Q: Should roots have editable labels? → A: Yes. Roots display `Label - /path` with defaults `Root` (platform roots) and `Home`; an unlabeled root displays `Unnamed Root - /path`. The path and separator are muted. Root labels are edited from a `Rename Root` context-menu action that opens a modal with Name, path, OK, and Cancel controls; labels persist per-root as application preferences (`appSpecific.fileManagerRootLabels`), independent of favorites.
- Q: Should a single click expand before a possible double-click? → A: No. A directory's single-click expansion/collapse is committed only after the double-click window expires, so double-clicking a directory focuses it without first changing its open state; regular-file double-click tool routing remains unchanged.
- Q: Should double-clicking a folder focus it as the top-level tree node with breadcrumb navigation? → A: Yes. Double-clicking a folder (root or nested) focuses it as the top-level node; a breadcrumb bar shows `Roots` plus the chain from the focused root down to the focused folder (hidden when unfocused). Each navigation level keeps its own open/closed and scroll state on a push/pop stack restored exactly when returning; all of this is session-lifetime renderer state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse project media and system files (Priority: P1)

As a Blue user, I want an on-demand file browser inside the workbench so that I can locate media and other source files without leaving Blue.

**Why this priority**: Java Blue has a registered, on-demand `BlueFileManagerTopComponent`; the current Electron panel is only a placeholder. Browsing is the smallest useful implementation and establishes the surface needed by the file-drag workflow.

**Independent Test**: Open File Manager from the Window menu, expand a filesystem root and several nested directories, and verify that the visible tree is navigable, ordered, and free of dot-prefixed entries.

**Acceptance Scenarios**:

1. **Given** the workbench is open and File Manager is closed, **when** the user chooses File Manager from the Window menu, **then** a dedicated File Manager panel opens on demand and the placeholder content is not shown.
2. **Given** File Manager is open, **when** the user views its top-level entries, **then** the panel shows the platform filesystem roots and the user's home directory, plus any valid saved favorite directories.
3. **Given** a visible directory contains files and subdirectories, **when** the user expands it, **then** the panel shows direct visible children in stable alphabetical order and excludes entries whose names begin with `.`.
4. **Given** a directory cannot be read or has disappeared, **when** the user expands or refreshes it, **then** the panel remains usable and presents a recoverable error or empty-state indication instead of crashing or corrupting the tree.

### User Story 2 - Manage favorite folders from context menus (Priority: P1)

As a Blue user, I want to pin frequently used folders and refresh stale listings so that the file browser remains useful across projects and sessions.

**Why this priority**: Favorites and refresh are the only File Manager-specific actions exposed by Java Blue. They are also the reason to keep a standalone browser rather than relying only on one-off file choosers.

**Independent Test**: Right-click an ordinary folder, add it to Favorites, close and reopen the panel, refresh it, then remove the favorite and verify that the filesystem itself was never changed.

**Acceptance Scenarios**:

1. **Given** an ordinary directory is selected, **when** the user opens its context menu, **then** the menu offers Refresh Folder and Add to Favorites.
2. **Given** a saved favorite directory is selected, **when** the user opens its context menu, **then** the menu offers Refresh Folder and Remove from Favorites.
3. **Given** a platform filesystem root or the user's home directory is selected, **when** the user opens its context menu, **then** the panel does not offer Remove from Favorites for that static root.
4. **Given** a directory is already a static or favorite root, **when** the user attempts to add it to Favorites, **then** no duplicate favorite is created.
5. **Given** a favorite directory is removed, **when** the user chooses Remove from Favorites, **then** only the favorite entry is removed; the directory and its contents remain untouched on disk.
6. **Given** a folder listing is stale, **when** the user chooses Refresh Folder, **then** the direct children are rescanned and the current visible contents are reflected without changing the selected root or navigating unexpectedly.

### User Story 3 - Drag files into audio layers (Priority: P1)

As a Blue user, I want to drag a file from File Manager into an audio layer timeline so that I can create an audio clip at the intended time and layer without reselecting the file through another dialog.

**Why this priority**: Java Blue intentionally exposes File Manager file nodes as drag sources. The target is the audio-layer surface, not the File Manager itself, and the source contract is part of the feature's practical value.

**Independent Test**: Drag a regular file node to several coordinates in an audio-layer timeline and verify that one audio clip is created in the layer under the pointer at the corresponding time; drag a directory and verify that no project mutation occurs.

**Acceptance Scenarios**:

1. **Given** a regular file is visible in File Manager, **when** the user drags it over an audio-layer timeline, **then** the target advertises a copy-compatible drop and the file is treated as the drag payload.
2. **Given** a regular file is dropped on an audio-layer timeline, **when** the drop completes, **then** exactly one audio clip is created in the layer under the pointer and its start position corresponds to the horizontal drop position.
3. **Given** project media-copy-on-import is enabled, **when** a File Manager file is dropped into an audio layer, **then** the file is copied into the configured project media folder before the new clip references it.
4. **Given** a directory, missing file, drag payload whose file extension is outside the shared audio-extension allowlist, unsupported drag payload, or invalid drop coordinate is dragged toward an audio-layer timeline, **when** the user drops it, **then** the target rejects the drop and the project remains unchanged.
5. **Given** a File Manager file is dragged toward the main score timeline, another File Manager node, or the embedded SoundFont file list, **when** the pointer enters or leaves the target, **then** no File Manager-specific drop operation is implied; those surfaces reject or retain their existing, separately defined behavior.
6. **Given** a single external OS file whose name matches the shared audio-extension allowlist is dropped on an audio-layer timeline, **when** the drop completes, **then** exactly one audio clip is created in the layer under the pointer at the corresponding time using the same media-copy and project-mutation flow as File Manager drops; multi-file lists, extensions outside the allowlist, missing files, and non-file payloads are rejected without project change.

### User Story 4 - Preserve distinct embedded file browsing tools (Priority: P2)

As a Blue user, I want SoundFont Viewer to keep its specialized file-selection workflow so that adding a general File Manager does not change how SoundFont metadata is inspected.

**Why this priority**: Java Blue contains both a standalone File Manager and a separate legacy `FileTree` embedded in SoundFont Viewer. Treating them as one surface would change filtering, context actions, and selection behavior.

**Independent Test**: Open SoundFont Viewer, navigate to an `.sf2` file through its existing embedded browser, use Copy Path, and verify that the new File Manager does not replace or alter that workflow.

**Acceptance Scenarios**:

1. **Given** SoundFont Viewer is open, **when** the user uses its embedded file browser, **then** it continues to filter file entries to `.sf2`, navigate directories, and load metadata on file selection.
2. **Given** an item is selected in SoundFont Viewer's embedded browser, **when** the user opens its context menu, **then** the existing Copy Path action remains scoped to that browser and is not replaced by File Manager favorite actions.
3. **Given** a saved workbench layout contains `BlueFileManagerTopComponent`, **when** the layout is restored, **then** the panel resolves to the real File Manager surface without opening a duplicate or falling back to a placeholder.

### User Story 5 - Labeled roots, focus navigation, and stable browsing state (Priority: P2)

As a Blue user, I want readable root labels, double-click focus navigation with a breadcrumb bar, and browsing state (open folders and scroll position) that survives panel remounts, so that navigating large trees and switching panels never loses my place.

**Why this priority**: These are quality-of-life refinements over the delivered P1 browsing surface; none block the core workflows, but the scroll reset observed when opening another panel makes the panel feel unstable.

**Independent Test**: Rename the Home root, focus into a deep folder via double-click, scroll and open folders inside it, navigate back with the breadcrumb bar, open another panel (remounting File Manager), and verify every label, focus level, expansion, and scroll offset is exactly as left.

**Acceptance Scenarios**:

1. **Given** the File Manager shows its roots, **when** no folder is focused, **then** roots render with their labels in `Label - /path` form (defaults `Root` for platform roots and `Home`; unlabeled roots show `Unnamed Root`), with the separator and path muted, and no breadcrumb bar is visible.
2. **Given** a root row, **when** the user opens its context menu and chooses `Rename Root`, **then** a modal shows a Name field and the root path in smaller muted text; OK persists a non-empty label as an application preference and redisplays it, Cancel leaves the label unchanged, and an emptied name reverts to the unnamed/default label.
3. **Given** the user double-clicks a folder (root or nested), **when** the double-click completes, **then** the tree focuses that folder as the top-level node and a breadcrumb bar appears showing `Roots` followed by the chain from the focused root down to the focused folder, using root labels where known.
4. **Given** a focused view, **when** the user clicks the `Roots` breadcrumb segment or any ancestor segment, **then** the view returns to that level and that level's open/closed and scroll state are restored exactly as they were left.
5. **Given** any view state (roots or focused), **when** the File Manager is unmounted and remounted by a workbench change (for example opening another auxiliary panel or moving docked/slideout), **then** the focused level, open/closed state, and scroll offset are restored from session memory; a full app restart starts fresh at the roots view.
6. **Given** focus navigation, **when** the user drags files or uses context actions inside a focused view, **then** all existing drag-source, drop-rejection, favorite, refresh, and double-click tool routing behavior is unchanged.

### Edge Cases

- The operating system has no discoverable filesystem root, or a root is duplicated by the home-directory entry.
- A favorite path is missing, no longer a directory, inaccessible, or duplicated by a static root when preferences are loaded.
- A folder contains no visible entries, only dot-prefixed entries, a very large number of entries, or entries that disappear while the listing is being read.
- A path contains spaces, non-ASCII characters, symlinks, or platform-specific separators.
- A file is deleted or replaced between rendering the node and beginning the drag.
- A user drags a folder, multiple files, an external URI, a file whose extension is outside the shared audio-extension allowlist, or a file from an unavailable volume into an audio-layer timeline.
- The audio-layer target has no valid layer at the drop position, the project has no current directory, or copying into the configured media folder fails.
- The user invokes a folder-only action on a file or invokes an action after the selected node has disappeared.
- The user closes, minimizes, or reopens File Manager while a drag is in progress.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a discoverable, on-demand File Manager panel under the existing Window-menu entry and MUST route the registered `BlueFileManagerTopComponent` identity to the real panel instead of placeholder content.
- **FR-002**: The File Manager MUST show the platform's filesystem roots and the user's home directory as static roots, and MUST show valid user-added favorite directories as additional roots.
- **FR-003**: The File Manager MUST expand and collapse directories, display both files and directories, exclude dot-prefixed entries from each directory listing, and order visible children consistently by name.
- **FR-004**: The File Manager MUST keep filesystem paths distinct from project-relative media paths while displaying enough path information to identify each root and selected file unambiguously.
- **FR-005**: The File Manager MUST provide the Java Blue context actions Refresh Folder, Add to Favorites, and Remove from Favorites with directory-appropriate enablement and root-specific availability.
- **FR-006**: Add to Favorites MUST accept directories only, MUST avoid duplicates, MUST update the root list immediately, and MUST persist favorite paths as application-level preferences in the main-process `program-settings.json` store under `appSpecific.fileManagerFavorites` rather than project data; renderer edits flow through the existing typed program-settings IPC.
- **FR-007**: Remove from Favorites MUST remove only the selected custom root from the File Manager's root list and application preferences; it MUST NOT delete, move, rename, or otherwise mutate files on disk.
- **FR-008**: Refresh Folder MUST rescan the selected directory's direct children, preserve the surrounding tree and root selection, and provide a recoverable diagnostic when the directory cannot be read.
- **FR-009**: Static filesystem roots MUST NOT be removable favorites. Ordinary folders that are not already roots MUST be eligible for Add to Favorites; custom roots MUST be eligible for Remove from Favorites.
- **FR-010**: File Manager regular-file nodes MUST act as copy-compatible drag sources whose payload identifies the source filesystem path. Directory nodes MUST NOT be accepted as audio-file payloads.
- **FR-011**: The audio-layer timeline MUST accept a File Manager regular-file drag whose file name matches the shared audio-extension allowlist (FR-020), map the drop location to a target layer and start position, and create exactly one audio clip using the existing project mutation and save flow; files outside the allowlist MUST be rejected without project change.
- **FR-012**: Audio-layer file drops MUST honor the existing copy-to-media-file-on-import setting. When enabled and a project directory is available, the resulting clip MUST reference the successfully copied project-media file; when disabled, it MUST retain the selected source path according to existing project path rules.
- **FR-013**: The File Manager MUST reject or no-op invalid file operations without changing project data, including directory drops, missing sources, unsupported transfer payloads, invalid target locations, failed media copies, and unavailable volumes.
- **FR-014**: The File Manager MUST NOT present itself as a file-operation target. File-to-file copy, move, rename, delete, and import-by-dropping-onto-the-tree are outside this panel's action contract.
- **FR-015**: The feature MUST preserve the existing SoundFont Viewer's embedded `FileTree` behavior: `.sf2` filtering, directory navigation, file-selection metadata loading, drive selection where supported, and its scoped Copy Path context action.
- **FR-016**: File Manager browsing and favorite state MUST remain separate from `.blue` project XML. A file dropped into an audio layer is the exception: the resulting audio clip MUST flow through the canonical project document and existing save behavior.
- **FR-017**: Reopening or restoring a saved workbench layout MUST reuse the stable File Manager panel identity, preserve the panel's on-demand/open state according to existing workbench rules, and MUST NOT create duplicate File Manager instances.
- **FR-018**: The File Manager MUST handle missing, unreadable, rapidly changing, and malformed filesystem entries with a user-visible recoverable state and MUST NOT crash the workbench or silently remove unrelated favorites.
- **FR-019**: The audio-layer timeline MUST accept an external OS file-list or `file://` text drop of exactly one file whose name matches the shared audio-extension allowlist (FR-020), and MUST create exactly one audio clip through the same layer/time mapping, copy-to-media, and project-mutation flow as File Manager node drops; multi-file lists, extensions outside the allowlist, missing files, and non-file payloads MUST be rejected without project change.
- **FR-020**: Both audio-layer drop paths (File Manager node drops and external OS drops) MUST share one audio-extension allowlist covering the file formats readable as Csound audio sources: at minimum `.wav`, `.aif`, and `.aiff`, extended with the additional supported formats (for example `.flac`, `.ogg`, `.mp3`) enumerated from Csound/libsndfile capabilities during planning. The check MUST be a case-insensitive file-name suffix comparison, and non-matching files MUST be rejected without project change.
- **FR-021**: Double-clicking a File Manager regular file whose extension is in the Audio File Player's supported browser-decodable format list MUST authorize the path through the main-process audio stream protocol policy before playback, MUST open the Audio File Player panel on demand, and MUST route the file through the existing pending-file bus so the player loads (and autoplays) it. Unsupported extensions, directories, and main-refused authorizations MUST NOT open or mutate the player; a refused or missing file MUST show a recoverable diagnostic.
- **FR-022**: Double-clicking a File Manager `.sf2` file MUST open the SoundFont Viewer panel on demand and MUST route the path through a pending-file bus that reuses the viewer's existing inspection flow (same behavior as choosing or dropping the file there). Non-`.sf2` files MUST NOT open the viewer, and the viewer's own `.sf2` filtering, metadata display, and scoped Copy Path action MUST remain unchanged.
- **FR-023**: The File Manager tree MUST keep its scroll offset in the session-lifetime renderer cache and restore it on remount alongside open state, expansion data, and diagnostics; scroll state is never persisted and resets on application restart.
- **FR-024**: Roots MUST display as `Label - /path`, with default labels `Root` for platform filesystem roots and `Home` for the home root. A root with no explicit display name (including a favorite whose effective label is only its path) MUST display `Unnamed Root - /path`; the separator and path MUST use the muted text treatment. The root context menu MUST offer `Rename Root`, which opens a modal containing a Name field, the root path, and OK/Cancel controls. OK with a non-empty name MUST persist per-root in `appSpecific.fileManagerRootLabels` (application preference, keyed by root path identity, surviving reloads even when the root is temporarily unavailable); Cancel MUST make no change; an emptied name MUST remove the custom label and return to the unnamed/default display. Labels are cosmetic: they MUST NOT affect root identity, deduplication, favorites, or drag payloads.
- **FR-025**: Double-clicking any directory, including a root, MUST focus it as the top-level tree node and MUST show a breadcrumb bar with `Roots` as the topmost segment followed by the chain from the focused root down to the focused folder (using root labels where defined); the breadcrumb bar MUST NOT render when no folder is focused. Navigating to any breadcrumb segment (including `Roots`) MUST return to that level and restore that level's exact open/closed and scroll state from the per-level state stack (pushed when focusing deeper, popped-and-restored when navigating back). Focus level, breadcrumb chain, and per-level states MUST live in the session-lifetime renderer cache and survive remounts; existing single-click expansion, context actions, drag sources, drop-rejection behavior, and double-click tool routing (audio player / SoundFont Viewer) MUST remain unchanged in focused views.
- **FR-026**: A directory single-click MUST expand or collapse only after the application has determined that the gesture is not the first half of a double-click. A directory double-click MUST NOT first commit the single-click expansion/collapse; it MUST focus the directory. Regular-file double-click tool routing MUST retain the same precedence and behavior.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue source confirms a standalone on-demand panel at `/Users/stevenyi/work/nbprojects/blue/blue-ui-filemanager/src/main/java/blue/ui/filemanager/BlueFileManagerTopComponent.java`, registered in output mode with `openAtStartup = false` and a Window-menu action. Its tree is built from `FileManagerRootNode`, `FileManagerRoots`, and `FileNode`. The older embedded browser at `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/gui/FileTree.java` is used independently by `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/tools/soundFont/SoundFontViewer.java`.
- **Context Menu Findings**: `FileNode.getActions()` selects root actions for custom roots, folder actions for ordinary folders, and no custom actions for static roots. The root action path provides Refresh Folder and Remove from Favorites; the folder action path provides Refresh Folder and Add to Favorites. `FileManagerRoots` adds filesystem roots and home, stores custom root paths in application preferences, ignores missing favorite directories on load, rejects non-directories and duplicates, and refreshes the root tree after changes.
- **Drag-and-Drop Findings**: `FileNode` places the `File` in its lookup for both file and directory nodes, which lets the platform tree act as a generic node drag source. Java's `AudioLayersDropTargetListener` is the corresponding File Manager target: it reads the node's `File`, accepts only regular files, uses copy semantics, maps pointer coordinates to an audio layer and time, and honors copy-to-media import settings. The same target separately accepts external file-list and file-URI drops for `.wav`, `.aif`, and `.aiff`. Java's `ScoreTimelineDropTargetListener` accepts external audio file drops and score-object transfers but does not define the File Manager node-transfer path. File Manager itself defines no custom drop target or file-to-file move/copy operation; folder nodes may be dragged generically but are rejected by the audio target.
- **Compatibility Requirements**: The registered panel ID, Window-menu discoverability, static/favorite root distinction, hidden-entry filtering, context-action semantics, regular-file drag payload, audio-layer target mapping, and copy-to-media behavior MUST remain observable and compatible with the reference behavior. Existing SoundFont Viewer `FileTree` behavior MUST remain a separate compatibility surface.
- **Intentional Divergences**: Java's current `FileNode` routes an ordinary file through the folder-action path, which can expose folder-only actions that are disabled or ineffective. The new panel will expose favorite and refresh actions only for directories so that it does not present misleading file actions; this is an intentional user-facing cleanup of a source quirk. Java's audio-layer drop target also accepts any regular file on the node-transfer path and filters only `.wav`/`.aif`/`.aiff` on the external path; the Electron panel instead applies one shared audio-extension allowlist, extended to all valid Csound-readable source formats, to both drop paths so that clips Csound cannot render are never created. The allowlist contents MUST be validated against Csound/libsndfile capabilities during planning. No other Java File Manager action is inferred or added.
- **State Ownership**: Static roots and live directory listings are derived from the host filesystem. Favorite root paths are durable application preferences stored in the main-process `program-settings.json` under `appSpecific.fileManagerFavorites`, not `.blue` project data. File Manager open/layout state remains workbench session/layout state; expanded-node state and loaded listings live in a session-lifetime renderer cache that survives docked/slideout remounts and is cleared on restart, never persisted. Audio clips created by a valid file drop are canonical project document state and persist only through the existing project save flow. Double-clicked files routed to the Audio File Player are authorized main-side through the existing audio stream protocol policy. The embedded SoundFont browser keeps its existing transient selection and inspection state.

#### Java drag/drop source and target matrix

| Source | Target | Java-observed behavior | Required scope |
| --- | --- | --- | --- |
| File Manager regular-file node | Audio-layer timeline | Node-transfer copy; creates one audio clip at pointer time/layer; may copy into project media folder | Implement with shared audio-extension allowlist (intentional divergence; Java node path is unfiltered) |
| File Manager directory node | Audio-layer timeline | Target rejects because the lookup is not a regular file | Implement rejection |
| External OS file list or file URI | Audio-layer timeline | Separate target path accepts `.wav`, `.aif`, and `.aiff` | Implement (single file, shared audio-extension allowlist extended beyond Java's list, same clip/media-copy flow) |
| File Manager node | Main score timeline | No File Manager node-transfer branch in Java's score target | Do not imply support |
| File Manager node | File Manager tree | No custom target or file operation in Java | Out of scope |
| Embedded SoundFont `FileTree` item | File Manager or score target | No custom drag source in `FileTree` | Preserve separation |

### Key Entities *(include if feature involves data)*

- **Filesystem Root**: A platform root, home directory, or user-added favorite directory from which the browser begins traversal.
- **File Node**: A visible file or directory entry with a filesystem path, display name, type, and parent relationship; regular-file nodes can be dragged to the audio-layer target.
- **Favorite Root**: A user-selected directory path retained as an application preference and displayed alongside static roots.
- **File Transfer**: A copy-compatible reference to a regular filesystem file used by a supported drop target; it does not represent a file move or a project object by itself.
- **Audio Clip**: The project-owned result of a valid file drop, with source path, name, target layer, and start position governed by existing project and time rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a normal local filesystem fixture, users can open File Manager from the Window menu and reach a visible root or favorite directory in no more than two user actions and two seconds.
- **SC-002**: A deterministic context-action matrix covering static roots, ordinary folders, custom roots, and files reports 100% correct action availability for Refresh Folder, Add to Favorites, and Remove from Favorites, with zero disk mutations from favorite actions.
- **SC-003**: Across close/reopen and application-restart checks, 100% of valid added favorites reappear in the root list, 100% of removed favorites stay removed, and missing favorites do not block panel startup.
- **SC-004**: In a drag/drop fixture, 100% of valid regular-file drops (File Manager nodes and external single-file drops matching the shared audio-extension allowlist) create exactly one audio clip at the selected layer/time and 100% of directory, multi-file, unsupported-extension, or invalid-payload drops leave project data unchanged.
- **SC-005**: For a directory fixture containing at least 1,000 mixed visible and dot-prefixed entries, the panel displays every eligible entry exactly once, displays no dot-prefixed entry, and maintains stable name ordering after refresh.
- **SC-006**: Existing SoundFont Viewer tests and manual workflow checks continue to pass with no change to `.sf2` filtering, metadata selection, or Copy Path behavior.
- **SC-007**: A restored layout containing the former registered File Manager panel produces one real File Manager surface and zero placeholder-panel renders or duplicate panel instances.
- **SC-008**: During parity review, users can distinguish File Manager browsing, favorite management, audio-layer file dropping, and SoundFont Viewer browsing without encountering an unlabelled or misleading file operation.

## Assumptions

- The audit row's claim that Java Blue lacks a standalone File Manager is stale; this feature treats `/Users/stevenyi/work/nbprojects/blue/blue-ui-filemanager` as the authoritative Java reference and implements the registered panel rather than retiring the registry entry.
- File Manager is an on-demand auxiliary panel and is not opened automatically for new sessions.
- Favorite roots are application-wide preferences and are not copied between projects or written into `.blue` XML.
- Existing project properties for media-folder location and copy-on-import remain the source of truth for valid audio-layer drops.
- The first implementation targets local filesystem paths exposed to the application. Cloud providers, remote mounts with provider-specific APIs, and a cross-platform file-operation manager are out of scope.
- The feature does not add generic open, edit, rename, delete, copy, or move commands; specialized tools and existing operating-system file management remain responsible for those tasks.
- Where Java's source has no File Manager drag/drop target, the Electron application will not claim one by implication; a later feature may add an explicit target contract if product requirements warrant it.

## Out of Scope

- Replacing SoundFont Viewer's embedded `FileTree` with the File Manager tree.
- Implementing a standalone file-operation suite, including rename, delete, copy, move, trash, or preview commands.
- Adding File Manager node-transfer support to the main score timeline, SoundFont Viewer, or the File Manager tree itself.
- Persisting browser expansion state, selected file state, or favorite roots in `.blue` project XML.
- Adding network browsing, archive browsing, or provider-specific cloud integrations.

## Implementation close-out (2026-08-17)

- Manual parity testing was completed by the user and reported passing for the
  File Manager workflows described in `quickstart.md`.
- The implementation review made narrow correctness fixes for absolute-path
  validation, partial-list and IPC diagnostics, native file dragging, shared
  audio-suffix drop gating, and normalized-identity symlink-cycle protection.
- The recorded automated test/build evidence and cross-platform path coverage
  remain in `quickstart.md`; no new persistence or project-format divergence
  was introduced during close-out.
