# Audio File Drop Contract

## Source classes

The Track audio-layer target accepts exactly two source classes:

1. A File Manager regular-file node using the custom MIME payload.
2. One external operating-system file represented by DataTransfer.files or a
   single file:// URI in text/uri-list/text/plain.

The File Manager tree is not a file-operation target. It does not accept its
own node drags or advertise copy/move/rename/delete behavior.

## Internal File Manager payload

~~~ts
const BLUE_FILE_MANAGER_DRAG_MIME = 'application/x-blue-file-manager-file';

interface FileManagerDragPayload {
  version: 1;
  kind: 'file';
  path: string;
  name: string;
}
~~~

On dragstart, a regular-file row sets this JSON payload and
effectAllowed = copy. The row may also set a human-readable text/plain value
for platform feedback, but the Track target uses the custom MIME first.
Directory rows do not write this payload. Main re-stat/revalidates the path, so
a file removed or replaced after the drag starts cannot be imported by
accident.

## External OS payload parsing

The renderer uses Electron's existing getPathForFile(File) preload method for
DataTransfer.files[0]. It falls back to one non-comment line from text/uri-list
and then text/plain only when that value is a file:// URI.

Rules:

- files.length > 1 rejects the drop even if one file happens to be supported.
- More than one non-comment URI line rejects the drop.
- Non-file schemes reject the drop; no network or provider URL is fetched.
- Percent decoding occurs once. Windows drive paths (file:///C:/...) lose only
  the URI-leading slash; UNC paths retain their host/share form.
- The resulting path must be absolute and is still validated in main.

## Shared suffix allowlist

Both source classes call the same pure case-insensitive suffix helper before
showing a copy drop effect:

~~~text
.wav .wave .aif .aiff .aifc
.au .paf .svx .nist .voc .ircam
.w64 .wavex .sd2 .flac .caf .wve
.ogg .oga .mpc2k .rf64
.mp3 .mp2 .mpeg
~~~

The list is based on the local Csound 7.0 --help sound-file formats,
diskin2/MP3 support in the installed Csound library, and libsndfile 1.2.2
major/subtype declarations. It deliberately does not inherit .m4a, .mp4,
.webm, or .opus from the browser Audio File Player until the packaged Csound
source route is confirmed. .raw is excluded because the default AudioClip
diskin2 invocation has no per-file raw sample-format metadata.

The extension test is only an early UX filter. Main repeats it and checks that
the source is a readable regular file before any project/media mutation.

## Target mapping

The target is TrackLayerGroupCanvas, not the generic PolyObject ScoreTimeCanvas.
The existing canvas geometry supplies:

~~~ts
const local = toLocalXY(event.clientX, event.clientY);
const layer = findTimelineLayerAtY(group.layers, local.y, DEFAULT_ROW_HEIGHT);
const startBeats = clampBeat(
  snapBeat(local.x / pixelsPerBeat, 'floor'),
  totalBeats,
);
~~~

The request uses the selected TrackRef with the current project session and
revision as a stale-write fence. Invalid layer hits, negative/non-finite
coordinates, or a missing project cause a rejected drop and leave the project
unchanged. The target sets dropEffect = copy only when the source shape,
extension, and target geometry are acceptable.

## Main commit flow

~~~text
drag source
  -> renderer parses source + maps Track/layer/time
  -> commit-audio-file-drop IPC
  -> main revalidates project fence, regular file, suffix, and readability
  -> optional collision-safe copy to configured project media folder
  -> normalize stored path using existing project rules
  -> create serialized AudioClip transfer
  -> existing canonical addTrackItem/project revision/broadcast path
  -> renderer observes project update and shows success/error
~~~

The main operation must not mutate canonical project data until source and
media preparation succeed. If canonical target validation rejects a request
after a new media file was created, clean up only that request's newly-created
copy; never remove an existing identical or collision-resolved file.

## Result contract

~~~ts
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

One accepted request creates one AudioClip. A multi-file, directory,
unsupported, missing, unreadable, stale, invalid-coordinate, or copy-failed
request creates none. Metadata duration/channel values are populated when the
existing main parser can read them; otherwise the clip uses the current Track
insertion default duration without rejecting an allowlisted Csound source.

## Target matrix

| Source | Target | Result |
|---|---|---|
| File Manager regular file | Track audio-layer timeline | Accept if shared suffix and main validation pass; create one clip. |
| File Manager directory | Track audio-layer timeline | Reject; no project mutation. |
| External single supported audio file | Track audio-layer timeline | Accept through the same commit path. |
| External multiple files | Track audio-layer timeline | Reject all; no partial import. |
| External unsupported file or non-file URI | Track audio-layer timeline | Reject; no project mutation. |
| File Manager node | Main score/PolyObject timeline | No File Manager-specific handling; preserve existing target behavior. |
| File Manager node | File Manager tree | Reject/no-op; no file operation contract. |
| File Manager node | SoundFont Viewer | Reject/no-op; preserve .sf2 browser behavior. |

## Security and compatibility invariants

- Renderer paths are hints, not authority; main performs the final stat, suffix,
  project-fence, and media-copy checks.
- URI decoding never turns a remote or malformed URI into a filesystem request.
- The custom MIME contains no move/delete operation and cannot request a target
  directory.
- The shared drop helper is independent of @blue/data; only the main import
  boundary creates an AudioClip from the existing data class.
- Audio File Player and SoundFont Viewer may keep their own supported-format
  policies; this contract is only for Track audio-layer import.
