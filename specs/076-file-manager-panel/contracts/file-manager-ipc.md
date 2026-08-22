# File Manager IPC Contract

## Boundary

The renderer never receives Node fs handles and never writes the settings file.
The preload exposes typed methods backed by ipcMain.handle in the main process.
All paths are host-native absolute strings at the main boundary; no path is
embedded in a project or Csound string by the File Manager contract.

## Root and listing methods

### file-manager:get-roots

~~~ts
getFileManagerRoots(): Promise<FileManagerRootSnapshot[]>
~~~

Main derives platform roots and home, reads the current program settings, drops
invalid/duplicate favorites from the live result, and returns static roots
before favorite roots. It does not rewrite the favorite list solely because a
volume is temporarily unavailable.

### file-manager:list-directory

~~~ts
listFileManagerDirectory(request: {
  path: string;
}): Promise<FileManagerDirectoryResult>
~~~

Validation and behavior:

- path must be a non-empty absolute path string.
- Main stats the path and requires a directory.
- Main reads only direct children, omits dot-prefixed names, resolves the
  child kind, and returns deterministic sorted snapshots.
- Permission, missing-path, non-directory, symlink-cycle, and transient read
  failures become typed status: error results; they do not throw through the
  panel.
- The renderer may call the method again for Refresh Folder. A new result
  replaces only that directory's child cache.

### file-manager:validate-directory

~~~ts
validateFileManagerDirectory(request: {
  path: string;
}): Promise<{
  ok: boolean;
  normalizedPath?: string;
  message?: string;
}>
~~~

This is used immediately before Add to Favorites and before any action that
assumes a selected directory still exists. It requires a regular directory and
returns the main-normalized path used for the settings write.

## Favorite persistence contract

Favorites use the existing typed settings methods, not a File Manager-specific
JSON file or project patch:

~~~ts
getProgramSettings(): Promise<ProgramSettingsSnapshot>;
saveProgramSettings(
  snapshot: ProgramSettingsSnapshot,
): Promise<ProgramSettingsSaveResult>;
~~~

The only field changed by File Manager is:

~~~ts
snapshot.appSpecific.fileManagerFavorites: string[]
~~~

The panel reads a fresh snapshot immediately before Add or Remove, validates
the selected directory through file-manager:validate-directory, de-duplicates
against the returned root identities, and submits the updated snapshot. If
save fails, the panel retains the prior root state and shows the returned
diagnostic. On success it refreshes file-manager:get-roots so the main service
remains the live authority.

This follows the existing Settings/Layout/MIDI app-settings ownership pattern:
old settings files merge with a default empty list, and successful future saves
write the additive field. The program settings version need not change for this
optional app-specific field; mergeWithDefaults preserves older versions and
saveProgramSettings continues to write the current version.

## Typed errors and recovery

| Condition | Main response | Renderer behavior |
|---|---|---|
| Root disappeared | Root omitted or available: false diagnostic | Keep panel open; retain other roots; offer Refresh. |
| Directory cannot be read | FileManagerDirectoryResult.status = error | Show inline diagnostic and Refresh action. |
| Favorite path is no longer a directory | Exclude from live roots | Do not delete unrelated saved favorites. |
| Add target changed to a file | ok: false | Do not call settings save; show recoverable message. |
| Settings write fails | ProgramSettingsSaveResult.ok = false | Keep previous root list and show failure. |
| Invalid renderer path | Typed ok: false or listing error | No filesystem mutation. |

## Required preload/type updates

The implementation must update both sides of the typed bridge:

- packages/blue-app/src/preload/preload.ts
- packages/blue-app/src/renderer/types/global.d.ts

The shared request/result types live under packages/blue-app/src/shared/ and are
imported statically by main, preload, and renderer. No any-typed escape hatch is
permitted for the new methods.

## Tool panel integration (double-click open)

Double-clicking a File Manager regular file routes it to the matching tool:

### Audio File Player

A file whose extension is in the player's browser-decodable format list
(wav/wave/aif/aiff/mp3/ogg/oga/flac/au/m4a/w64/opus/weba — deliberately broader
than the Csound drop allowlist, since the player decodes with Chromium) routes
to the player:

1. The renderer calls the existing `authorize-audio-file` IPC so the
   main-process audio stream protocol policy (realpath + regular-file check)
   admits the path; the protocol answers unauthorized paths with 403.
2. On success the renderer opens `AudioFilePlayerTopComponent` through the
   workbench store and emits the path on the audio-player pending-file bus,
   which loads and autoplays it — the same path used by render-and-play.
3. A refused or missing file shows a recoverable toast and leaves the player
   untouched; player-unsupported extensions and directories do nothing.

### SoundFont Viewer

An `.sf2` file (case-insensitive) routes to the viewer:

1. The renderer opens `SoundFontViewerTopComponent` through the workbench
   store and emits the path on the SoundFont pending-file bus
   (`soundfont-viewer-bus.ts`, mirroring the audio-player bus: the path is
   held and delivered when the panel mounts).
2. The viewer's existing inspection flow loads the file exactly as if it had
   been chosen or dropped there; no audio-stream authorization applies.
3. Non-`.sf2` files never open the viewer, and the viewer's own `.sf2`
   filtering, metadata display, and scoped Copy Path action are unchanged.

## Root labels (context-menu rename modal)

Roots display as `Label - /path` (renderer-composed), with the separator and
path muted. Defaults served by main in `FileManagerRootSnapshot.label`: `Root`
for platform roots, `Home` for the home root, and the plain path for unlabeled
favorites. The renderer treats an empty label or a label equal to the path as
unnamed and displays `Unnamed Root` before the separator.

Custom labels persist through the existing typed settings methods; the only
field changed is:

~~~ts
snapshot.appSpecific.fileManagerRootLabels: Record<string, string>
~~~

Rename flow: the root context menu offers `Rename Root`. Selecting it opens a
modal with a Name field, the root path in smaller muted text, and OK/Cancel
controls. On OK, the renderer reads a fresh `getProgramSettings` snapshot,
writes the label keyed by the root's path identity (or removes the key when the
submission is empty, reverting to the unnamed/default display), saves via
`saveProgramSettings`, and refreshes `file-manager:get-roots` only after a
successful save. Cancel makes no settings call. A failed save keeps the
previous label and shows the returned diagnostic. Labels are cosmetic and
never alter root identity, deduplication, favorites, or drag payloads.

## Focus navigation and breadcrumb state

Double-clicking a directory focuses it as the top-level tree node; a
breadcrumb bar (`Roots` + chain from focused root to focused folder, using
root labels where defined) appears only while focused. Per-level open/closed
and scroll state live on a push/pop stack in the renderer session cache and
are restored exactly when navigating back to a level. This is pure renderer
session state: no new IPC channels, no settings writes, and no changes to
single-click expansion, context actions, drag sources, drop rejection, or the
double-click tool routing above (file double-click still routes to the Audio
File Player or SoundFont Viewer; only directories focus).
