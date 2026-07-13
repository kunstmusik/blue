# Audio Player IPC and Media Contract

## Privileged media URL

`blue-audio://file/<base64url-encoded-absolute-path>`

The main-process handler resolves the decoded path to its canonical location,
serves only paths explicitly authorized by the file picker or a successful Play
render, returns a media content type inferred from the extension, and supports
full and single byte-range responses. Unauthorized paths return `403`; invalid
or unsatisfiable ranges return an appropriate range error.

## Renderer capabilities

| Capability | Request | Response |
|---|---|---|
| Choose audio file | `openAudioFile()` | Selected absolute path or `null` |
| Read source stat | `getAudioFileStat(filePath)` | `{ size, mtime }` or `null` |
| Read authorized bytes for waveform/metadata | `readAuthorizedAudioFileBytes(filePath)` | File bytes or `null`; rejects paths not authorized by main |

## Render completion extension

`RenderOperationStatus` may include `action`, preserving the user-selected
disk-render action. A completed `diskRender` with `action: "play"` and an
`outputPath` is consumed by the player handoff. No change is made to the
existing Open action contract.

## Security boundary

The renderer has no Node integration. File dialog, stat, authorized player byte
reads, and media streaming remain main-process responsibilities exposed through
typed preload capabilities. The media scheme has only the privileges needed for
streaming; the renderer CSP explicitly allows it only as a media source.
