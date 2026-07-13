# Research: Audio File Player

## Decision: Stream local media through a privileged application protocol

- **Decision**: Serve local audio through a `blue-audio://` protocol with
  byte-range responses to the browser media element.
- **Rationale**: The `<audio>` playback path can natively decode and seek from
  a ranged stream without a Blob copy, while preserving renderer isolation.
  Waveform and metadata decoding remain one-time byte reads for their Web
  Audio analysis work.
- **Alternatives considered**:
  - Renderer Blob URLs: simple but retain full file contents in renderer memory.
  - Main-process audio libraries: require custom decoding/playback and frequent
    progress IPC while competing with other main-process responsibilities.

## Decision: Encode the source path in the URL pathname

- **Decision**: Use `blue-audio://file/<base64url-path>`.
- **Rationale**: Chromium canonicalizes a URL hostname to lowercase. A
  case-sensitive base64 value in the hostname corrupted the path and caused
  media load failure; pathname data remains intact.
- **Alternatives considered**:
  - Payload in hostname: rejected after a real Electron media probe reproduced
    the lowercasing failure.
  - Blob URLs: rejected for the memory reason above.

## Decision: Authorize playback sources in main before serving them

- **Decision**: Maintain a main-process canonical-path allowlist populated by
  the audio file picker and successful Play renders.
- **Rationale**: The encoded URL is renderer-visible and must not itself grant
  arbitrary filesystem access. The handler rejects unregistered paths before
  opening them.
- **Alternatives considered**:
  - Trusting base64 path obscurity: rejected because it is trivially forgeable.
  - Persistent permission storage: rejected because preview authorization is
    transient session state.

## Decision: Retain one pending render-to-play request

- **Decision**: Keep a pending output path when the render completes before
  the player panel mounts.
- **Rationale**: Opening a panel is asynchronous; an immediate broadcast could
  otherwise be dropped.
- **Alternatives considered**:
  - A dedicated global store: unnecessary for one producer and one consumer.
  - Delaying with a timer: timing-dependent and not deterministic.

## Decision: Draw a connected waveform envelope

- **Decision**: Build one filled upper/lower envelope from the existing min/max
  sample summary.
- **Rationale**: Per-bucket rectangles detach when short files have few samples
  per pixel and a bucket does not cross zero. A connected envelope stays
  visually continuous while retaining extrema.
- **Alternatives considered**:
  - Force every bar to touch zero: changes signal meaning.
  - Retain every raw sample: unnecessary memory for typical long files.

## Decision: Use a compact, accessible player presentation

- **Decision**: Use a black waveform viewport, one empty state, Lucide icon
  controls below the waveform, and a shared `MM:SS.SSS` time formatter.
- **Rationale**: This improves contrast and removes duplicate empty-state
  messaging while keeping controls compact in an auxiliary panel.
- **Alternatives considered**:
  - A full panel-wide black theme: rejected to preserve visual consistency for
    metadata and workbench chrome.
