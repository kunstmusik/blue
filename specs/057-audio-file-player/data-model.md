# Data Model: Audio File Player

## Renderer-local Player Session

| Field | Description | Lifetime |
|---|---|---|
| `filePath` | Absolute path of the selected or rendered source | Current panel session |
| `isPlaying` | Whether the media element is actively playing | Current panel session |
| `isLooping` | Whether playback repeats at the end | Current panel session |
| `currentTime` | Current playback position in seconds | Current panel session |
| `duration` | Media duration in seconds | Current loaded source |
| `metadata.sampleRate` | Decoded sample rate, when available | Current loaded source |
| `metadata.channels` | Decoded channel count, when available | Current loaded source |
| `metadata.fileSize` | Source size in bytes, when available | Current loaded source |
| `error` | User-facing loading or playback failure | Until next load attempt |

The session is React-local. It is intentionally not serialized to the project
document or program settings.

## Pending Render Playback

| Field | Description | Lifetime |
|---|---|---|
| `pendingFilePath` | One completed render path awaiting a mounted player | Cleared when a subscriber receives it |

## State Transitions

```text
empty → loading → ready → playing ↔ paused
                 └──────→ error

disk render complete with Play → pending playback → loading → ready
  → attempt playback → playing | error
```
