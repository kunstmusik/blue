# Research: Blue File Manager Panel

## Scope and conclusion

The audit row should be implemented, not retired. The Java source tree contains
an actual standalone BlueFileManagerTopComponent registered in the output mode
with openAtStartup = false, a Window-menu action, and the stable preferred ID
BlueFileManagerTopComponent.

The current Electron registry already contains the same panel identity and
Window-menu descriptor. The missing piece is the renderer route in
packages/blue-app/src/renderer/components/workbench/WorkbenchPanelContent.tsx,
where an unhandled registered panel falls through to PlaceholderPanel.

## Java Blue findings

### Standalone panel and roots

Evidence:

- /Users/stevenyi/work/nbprojects/blue/blue-ui-filemanager/src/main/java/blue/ui/filemanager/BlueFileManagerTopComponent.java:44-67 declares the output registration, preferred ID, and BeanTreeView.
- FileManagerRoots adds File.listRoots() and the user home directory as
  static roots, then loads custom roots from application preferences.
- Custom roots are accepted only when they are directories and are not already
  static or custom roots. Missing/non-directory favorites are ignored when
  loaded. Removing a favorite only removes its preference entry and fires a
  root-list refresh.
- FileNode.FileChildFactory enumerates only direct children, filters names
  beginning with ., and sorts the resulting File values. Files and directories
  are both represented by a node carrying the File in its lookup; directories
  get lazy children.

The Electron design keeps those observable behaviors but improves two edge
cases: static/home/favorite roots are de-duplicated using normalized host-path
identity, and unreadable/disappearing directories return a visible recoverable
state instead of allowing a null listing to escape.

### Context-menu action matrix

Evidence:

- FileNode.java:61-74 selects root actions for custom roots, folder actions
  for non-static nodes, and no custom actions for static roots.
- RefreshAction.java is registered in both root and folder action paths and is
  enabled only when the selected node is a directory.
- AddToFavoritesAction.java is in the folder action path and calls
  FileManagerRoots.addRoot only when enabled.
- RemoveFromFavoritesAction.java is in the root action path and is enabled
  only for a custom root.

Required matrix:

| Selected node | Refresh Folder | Add to Favorites | Remove from Favorites |
|---|---:|---:|---:|
| Static filesystem root | enabled for directory | absent | absent |
| Home root when static | enabled for directory | absent | absent |
| Ordinary directory | enabled | enabled unless already a root | absent |
| Favorite directory root | enabled | absent/disabled | enabled |
| Regular file | absent in the Electron cleanup | absent | absent |

Java's FileNode can route a regular file through the ordinary folder-action
path, which exposes ineffective folder actions. The Electron panel will show
folder actions only for directories. This is the intentional cleanup already
recorded in the feature specification; it prevents a misleading action rather
than changing any filesystem behavior.

### Drag and drop sources and targets

FileNode has a generic File lookup for both files and directories. The
platform tree therefore acts as a drag source even though File Manager itself
does not register a custom drop target or implement file-to-file copy/move.

The corresponding Java target is
/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-ui/src/main/java/blue/score/layers/audio/ui/AudioLayersDropTargetListener.java:

- dragEnter accepts a Java node transfer only when its lookup resolves to a
  regular file and requests copy semantics.
- The node-transfer drop maps the pointer to an audio layer and time, optionally
  copies the source into the project media folder, creates one AudioClip, and
  adds it to that layer.
- A separate external file-list branch accepts exactly one file. The
  stringFlavor branch accepts only a file:// URI, decodes it, and also
  requires exactly one supported path. Java's external branches filter .wav,
  .aif, and .aiff.
- Java's current node-transfer branch does not apply the extension filter and
  contains a null-check ordering bug during drag-enter. The Electron design
  fixes the bug and applies one shared allowlist to both internal and external
  sources.

The Java main score target at
/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/layers/soundObject/ScoreTimelineDropTargetListener.java
accepts external audio file transfers and score-object copies, but has no
File Manager node-transfer branch. The Electron plan therefore adds the
File-Manager-specific drop only to the Track audio-layer surface, not to the
main score timeline, File Manager tree, or SoundFont Viewer.

### Embedded SoundFont browser is a separate surface

/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/gui/FileTree.java
is a list-style browser used by
/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/tools/soundFont/SoundFontViewer.java.
It starts at home, keeps directory navigation and drive selection, filters
file entries through .sf2, and injects a SoundFont-specific Copy Path popup.
It does not provide the standalone File Manager favorite actions or a custom
drag source. Existing Electron SoundFontViewerPanel.tsx already preserves the
specialized .sf2 selection and OS-drop flow, so it remains untouched except
for regression tests.

## Current Electron seams

### Workbench

packages/blue-app/src/shared/workbench-menu.ts already registers:

~~~text
BlueFileManagerTopComponent -> File Manager -> output auxiliary group -> on demand
~~~

packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts already
includes the panel identity in the output group. Routing the identity in
WorkbenchPanelContent.tsx is therefore sufficient to remove the placeholder
without creating another panel ID or altering layout migration.

### Settings

packages/blue-app/src/shared/program-settings.ts defines the app-specific
settings snapshot, and packages/blue-app/src/main/program-settings-store.ts
owns the atomic JSON file under Electron's user-data directory. Existing typed
preload methods getProgramSettings and saveProgramSettings are the established
settings bridge used by the Settings window and layout/MIDI features.

The design adds fileManagerFavorites: string[] to
CurrentAppSettingsSnapshot, defaulting to []. mergeWithDefaults makes old
settings files safe without a format migration; the next successful settings
save writes the field. File Manager add/remove actions read a fresh snapshot
immediately before changing the list and call the existing typed
saveProgramSettings method. No renderer or panel writes program-settings.json
directly, and no favorite is placed in .blue data.

The main root service revalidates the saved paths on every root snapshot. A
missing favorite is omitted from the visible roots and remains harmless in the
stored list until the next successful favorite write; an inaccessible path is
reported as unavailable rather than silently deleting unrelated preferences.

### Tree and UI primitives

The app already depends on react-arborist for the Effects Library and on Radix
Context Menu for renderer menus. The implementation should use the same
virtualized tree dependency with children: [] placeholders and an
onToggle-driven main listing request. This gives stable row rendering for a
1,000-entry directory without recursively loading the filesystem. The File
Manager-specific node renderer owns selection, lazy loading, context-menu
actions, and drag-start behavior; it does not reuse the SoundFont list browser.

### Project mutation and media import

TrackLayerGroupCanvas.tsx already owns the exact layer geometry, snap
conversion, TrackRef construction, project session/revision, and the
useProjectStore patch boundary. The shared project contract already supports
ScorePatch addTrackItem with a serialized AudioClip transfer.

The safer drop flow is a typed main commit-audio-file-drop request rather than
renderer-side copying followed by a separate patch:

1. Renderer decodes the internal or external source and maps pointer
   coordinates to a Track ref, layer, and start beat.
2. Main rechecks the current project/session/revision, regular-file status,
   extension allowlist, and project properties.
3. Main reuses the existing media-copy/path-normalization behavior from
   score-object-file-operations.ts when copy-on-import is enabled.
4. Main creates a serialized AudioClip transfer and runs the same canonical
   project mutation, revision, broadcast, and save-dirty behavior used by
   project patches.
5. If target validation fails after a new media copy, only that newly-created
   collision-safe file is removed on a best-effort basis; a pre-existing or
   identical media file is never removed.

This keeps filesystem side effects and canonical BlueData mutation in one
main-owned operation while reusing the existing addTrackItem semantics. The
renderer does not fabricate authoritative project XML or assume that a path
still exists merely because it was visible at drag start.

## Csound/libSndFile format research

The local installed runtime reports:

- /usr/local/bin/csound --help identifies Csound 7.0 and lists sound-file
  containers including WAV, AIFF, AU, PAF, SVX, NIST, VOC, IRCAM, W64, MAT4,
  MAT5, PVF, XI, HTK, SDS, AVR, WAVEX, SD2, FLAC, CAF, WVE, OGG, MPC2K, RF64,
  and MPEG.
- The local Csound manual includes diskin2, soundin, and mp3in; the installed
  Csound library contains diskin2 and MP3 decoder symbols and strings for
  FLAC/OGG/MPEG paths.
- /opt/homebrew/include/sndfile.h from libsndfile 1.2.2 enumerates the same
  major containers plus OGG/Vorbis, Opus, and MPEG subtypes. Its local FAQ
  records MP3 read support beginning in libsndfile 1.1.0.

The File Manager drop allowlist will be capability-derived and deliberately
separate from the browser player's broader list. The initial implementation
should cover these headered/common Csound source extensions:

~~~text
.wav .wave .aif .aiff .aifc
.au .paf .svx .nist .voc .ircam
.w64 .wavex .sd2 .flac .caf .wve
.ogg .oga .mpc2k .rf64
.mp3 .mp2 .mpeg
~~~

The check is a case-insensitive suffix check in shared code and is repeated in
main before commit. Headerless .raw, browser-only .m4a/.mp4/.webm, and
unverified codec/container aliases are not accepted by this first contract.
This avoids promising that Electron's media decoder is equivalent to the
Csound diskin2 path. The list and the exclusion rationale must be covered by
shared tests so later packaged-runtime probes can extend it intentionally.

Audio duration metadata is best effort. Where the existing main audio parser
can read the source, the created clip carries its channel/duration values;
otherwise the drop still succeeds with the current Track insertion default
duration and the user can edit the clip. An allowlisted file is not rejected
solely because the UI metadata parser cannot decode its compressed header.

## Alternatives rejected

- Retire the registry entry: rejected because Java Blue contains a real
  standalone panel and the current Electron workbench already models its
  identity and location.
- Reuse SoundFont Viewer's FileTree: rejected because that browser is a
  filtered .sf2 list with a scoped Copy Path popup, not a hierarchical,
  favorite-capable File Manager.
- Renderer-only filesystem access: rejected by context isolation and the
  app's main-owned file boundary.
- Recursive root preload: rejected because it blocks startup and cannot handle
  large or changing trees safely.
- Renderer copy followed by generic project patch: rejected because a stale
  target could leave an orphaned media copy; the typed main drop commit keeps
  validation, side effects, and canonical mutation together.
- Use the Audio File Player extension list: rejected because browser media
  support includes formats not established as Csound diskin2/libsndfile
  sources.

## Research evidence paths

- Java panel: /Users/stevenyi/work/nbprojects/blue/blue-ui-filemanager/src/main/java/blue/ui/filemanager/
- Java embedded browser: /Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/gui/FileTree.java
- Java SoundFont Viewer: /Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/tools/soundFont/SoundFontViewer.java
- Java audio drop target: /Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-ui/src/main/java/blue/score/layers/audio/ui/AudioLayersDropTargetListener.java
- Java score drop target: /Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/layers/soundObject/ScoreTimelineDropTargetListener.java
- Electron settings: /Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.ts
- Electron project patch contract: /Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts
- Electron Track target: /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx
- Csound manual/runtime: /Users/stevenyi/work/nbprojects/blue/csound-manual/, /usr/local/bin/csound, /opt/homebrew/include/sndfile.h
