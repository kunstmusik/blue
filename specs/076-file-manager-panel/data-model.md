# Data Model: Blue File Manager Panel

## Ownership boundaries

| Data | Owner | Durable? | Notes |
|---|---|---:|---|
| Platform roots | Electron main filesystem service | No | Derived from host volumes and home; normalized and de-duplicated for display. |
| Directory children | Electron main filesystem service + renderer cache | No | Direct children only; renderer cache is disposable and refreshable. |
| Favorite root paths | Main program-settings store, exposed through typed settings IPC | Yes | ProgramSettingsSnapshot.appSpecific.fileManagerFavorites; never project XML. |
| Panel open/layout state | Existing workbench/Dockview state | Existing behavior | Uses BlueFileManagerTopComponent; no new identity or persistence key. |
| Expansion/open tree state | Renderer session cache in the File Manager tree module | No | Loaded listings, diagnostics, open-node ids, and scroll offset survive docked/slideout remounts within a session; cleared on restart, never written to settings or project data. |
| Root labels | Main program-settings store (`appSpecific.fileManagerRootLabels`) | Yes | Map from root path identity to custom display label; defaults served by main in `FileManagerRootSnapshot.label`. Never `.blue` project data. |
| Focus/breadcrumb state | Renderer session cache in the File Manager tree module | No | Focused node, breadcrumb chain, and per-level open/closed + scroll stacks survive remounts within a session; cleared on restart. |
| Drag payload | Browser DataTransfer during one gesture | No | Versioned custom MIME payload; copy semantics only. |
| Audio import receipt | Main drop service | No | Reports accepted/rejected outcome and project commit receipt. |
| Audio clip | Main-owned BlueData / existing project snapshot and .blue XML | Yes through project save | Created only after the source and target are revalidated. |

## File Manager roots

~~~ts
type FileManagerRootKind = 'static' | 'favorite';

interface FileManagerRootSnapshot {
  id: string;                 // normalized host path identity
  path: string;               // host-native absolute path
  label: string;              // effective display label (default or renamed)
  kind: FileManagerRootKind;
  available: boolean;
  isDirectory: boolean;
  diagnostic?: string;
}
~~~

Root labels are user-editable display names, cosmetic only. Defaults: `Root`
for platform filesystem roots and `Home` for the home root. When a root has no
explicit display name (including an unlabeled favorite whose effective label is
its path), the renderer uses `Unnamed Root`. The renderer composes every root
row as `Label - /path`, with the separator and path in the muted text treatment.
Custom labels persist per-root in the application settings under
`appSpecific.fileManagerRootLabels` (a map from root path identity to label);
entries survive reloads even while their root is temporarily unavailable and
never affect root identity, deduplication, favorites, or drag payloads.

Static roots are the host's logical filesystem roots plus the home directory.
On POSIX, the root list is derived from the platform root (/) and home; on
Windows, logical drive roots are discovered by checking drive letters and home
is appended if it is not the same normalized identity. The service de-duplicates
case-insensitively on Windows and by normalized/real path where realpath is
available. Favorites are appended only when they are valid directories and do
not duplicate a static or another favorite root.

The stored favorite string is an absolute host path. path, fs, and
realpath/case rules are main-only; shared/renderer code treats the value as an
opaque displayable path.

## File nodes and directory listing

~~~ts
type FileManagerNodeKind = 'file' | 'directory';

interface FileManagerNodeSnapshot {
  id: string;                 // normalized path identity
  path: string;               // host-native absolute path
  name: string;
  kind: FileManagerNodeKind;
  parentPath: string;
  isSymlink: boolean;
  canExpand: boolean;
}

interface FileManagerDirectorySnapshot {
  directoryPath: string;
  children: FileManagerNodeSnapshot[];
  loadedAt: number;
  diagnostic?: string;       // child entries omitted during a partial read
}

type FileManagerDirectoryResult =
  | { status: 'ok'; snapshot: FileManagerDirectorySnapshot }
  | {
      status: 'error';
      directoryPath: string;
      code:
        | 'not-found'
        | 'not-directory'
        | 'permission-denied'
        | 'read-failed'
        | 'symlink-cycle';
      message: string;
    };
~~~

The main service uses direct readdir entries, filters names beginning with .,
and sorts by a deterministic case-insensitive name comparison with a
case-sensitive/path tie-break. It uses stat for the final node kind so a
symlink to a directory remains expandable; the renderer tracks ancestor
identities and refuses to recurse through a symlink cycle. A disappearing or
unreadable child is omitted from that listing with a directory-level diagnostic
rather than throwing through IPC. Refresh replaces only that node's children.

Renderer tree node ids are branch-unique: a root uses its main-provided path
identity and descendants compose `root-id#name/...` chains, so the same
directory reached through different roots (for example home and a favorite
subfolder) keeps independent open/selection state. The filesystem path travels
in a separate `path` field and is the only value used for listings, actions,
drag payloads, and player routing.

The renderer tree state is intentionally disposable:

~~~text
Root snapshot
  -> node collapsed (no child request)
  -> node expanding (one in-flight request)
  -> loaded children | recoverable diagnostic
  -> refresh invalidates that node and requests direct children again
~~~

No expanded-node, selected-node, or listing cache is written to settings or
project data.

## Favorite state

~~~ts
interface CurrentAppSettingsSnapshot {
  // existing fields...
  fileManagerFavorites: string[];
}
~~~

Normalization rules:

1. Old/missing values become [].
2. Non-string and blank values are discarded before save.
3. Absolute-path validation and directory existence are main-owned.
4. Duplicates are removed using host path identity; static roots win over
   favorite entries.
5. Adding/removing a favorite uses a fresh getProgramSettings snapshot and the
   existing typed saveProgramSettings IPC. The renderer updates its visible
   root list only after a successful save result.
6. A missing favorite is not deleted merely because a root listing failed; it
   is omitted from the live root snapshot and remains recoverable if the volume
   returns.

Root label state uses the same settings snapshot:

~~~ts
interface CurrentAppSettingsSnapshot {
  // existing fields...
  fileManagerFavorites: string[];
  fileManagerRootLabels: Record<string, string>;
}
~~~

Normalization rules: old/missing values become `{}`; non-string keys or
blank/non-string labels are discarded before save; entries are kept even when
their root is missing (like favorites) so labels return with the volume.

## Context action eligibility

~~~ts
type FileManagerAction =
  | 'refresh-folder'
  | 'add-to-favorites'
  | 'remove-from-favorites';

interface FileManagerActionState {
  refreshFolder: boolean;
  addToFavorites: boolean;
  removeFromFavorites: boolean;
}
~~~

The action state is derived from the node kind and root kind, not from whether
the node happens to have a child array loaded. Files have no File Manager
actions. Static roots expose Refresh Folder. Ordinary directories expose
Refresh Folder and Add to Favorites. Favorite roots expose Refresh Folder and
Remove from Favorites. The action handlers revalidate the directory/path in
main before saving or refreshing.

## Drag payloads

~~~ts
const BLUE_FILE_MANAGER_DRAG_MIME = 'application/x-blue-file-manager-file';

interface FileManagerDragPayload {
  version: 1;
  kind: 'file';
  path: string;
  name: string;
}
~~~

Only a regular-file node writes this payload. It sets
dataTransfer.effectAllowed = 'copy' and dropEffect = 'copy'. A directory does
not write an audio-file payload. The target still treats every incoming custom
payload as untrusted and asks main to re-stat/revalidate it.

## Shared audio-source allowlist

The shared helper isCsoundAudioSourcePath(path) extracts the final suffix,
lowercases it, and compares it against this capability-derived list:

~~~text
.wav, .wave, .aif, .aiff, .aifc,
.au, .paf, .svx, .nist, .voc, .ircam,
.w64, .wavex, .sd2, .flac, .caf, .wve,
.ogg, .oga, .mpc2k, .rf64,
.mp3, .mp2, .mpeg
~~~

This is intentionally not the browser player list. .raw is excluded because
the AudioClip diskin2 call has no per-file raw format metadata, and .m4a,
.mp4, .webm, and .opus are excluded until the packaged Csound source path is
explicitly verified for those containers. The main process repeats the same
helper before any clip or media copy is committed.

## Audio-file drop request and result

~~~ts
type AudioDropSourceKind = 'file-manager' | 'external-os';

interface CommitAudioFileDropRequest {
  sourcePath: string;
  sourceKind: AudioDropSourceKind;
  track: TrackRef;            // includes session/revision fence
  startBeats: number;
}

type CommitAudioFileDropResult =
  | {
      status: 'created';
      objectName: string;
      storedPath: string;
      copiedToMedia: boolean;
      receipt: ProjectDocumentCommitReceipt;
    }
  | {
      status: 'rejected';
      code:
        | 'no-project'
        | 'stale-project'
        | 'not-a-file'
        | 'unsupported-extension'
        | 'unreadable'
        | 'invalid-location'
        | 'copy-failed';
      message: string;
    };
~~~

The source path is rechecked in main. If project copy-on-import is enabled and
the current project directory is available, the existing collision-safe media
copy behavior is reused. The stored clip path follows the existing project
relative-path rules. Metadata is populated when the existing parser can read
it; otherwise the new clip uses the existing Track insertion default duration
without rejecting a format that passed the Csound-source allowlist.

## Invariants

- File Manager never mutates, renames, deletes, or copies a file in response to
  a drop onto its own tree.
- One accepted drop creates exactly one AudioClip; a rejected or stale drop
  creates none.
- Directory, multi-file, non-file URI, unsupported suffix, missing source,
  invalid target, and failed-copy paths do not call the canonical project
  mutation.
- Favorites are application state; clips are project state; expanded tree state
  is renderer state. These states cannot be serialized into one another.
