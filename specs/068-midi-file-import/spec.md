# Feature Specification: Import MIDI File

**Feature branch:** `068-midi-file-import`
**Status:** Implemented and verified
**Source action:** `NOT_IMPLEMENTED_ACTIONS.md`, File menu action 19

## Scope

Implement the native **File → Import MIDI File** action for Standard MIDI Files (`.mid` and `.midi`). The action opens a binary SMF, lets the user review and map note-bearing MIDI track/channel streams, and installs a new Blue project containing a root layer group selected from the project default: `TrackLayerGroup`/`Track` for Track mode or `PolyObject`/`SoundLayer` for SoundObject mode. Each accepted source stream contributes one `GenericScore`.

The implementation is intentionally separate from Web MIDI live input. Live MIDI receives notes from a device; this feature reads a finite binary file and converts its note events into score text.

## User stories

### US-1: Import a MIDI file

As a Blue user, I can choose a Standard MIDI File from the File menu and receive a project containing its playable notes.

### US-2: Map imported streams

As a Blue user, I can see each note-bearing source stream, its MIDI track/channel information, and edit the instrument ID, note template, and trim-time behavior before committing the import.

### US-3: Preserve the current project safely

As a Blue user, cancelling the file chooser, cancelling the mapping dialog, or importing a malformed/unsupported file leaves the current project unchanged and reports an actionable error.

### US-4: Retain Java Blue behavior where it is observable

As a Blue user, the default template, MIDI placeholder meanings, beat-based timing, project replacement behavior, and resulting score-object structure match Java Blue for ordinary PPQ format-0 and format-1 files, while respecting the configured default layer-group type.

## Functional requirements

- **FR-001:** Add an enabled native File menu handler for `Import MIDI File` when a project is loaded; retain the existing not-implemented marker only until this handler is wired.
- **FR-002:** Accept binary Standard MIDI Files with `.mid` or `.midi` extensions. The parser must handle SMF format 0 and format 1, variable-length delta times, running status, meta events, and `NOTE_ON` velocity zero as note-off.
- **FR-003:** Use ticks-per-quarter-note (PPQ) division for the first implementation. Reject SMPTE-timed files and format 2 with a clear message rather than silently converting their timing to beats.
- **FR-004:** Parse in Electron main, where the selected file can be read safely, and never send `Buffer`, parser-specific objects, or third-party library types over IPC.
- **FR-005:** Build a serializable preview containing the file header, note-bearing source streams, track names when present, channel information, note counts, timing bounds, and pairing warnings.
- **FR-006:** Present a mapping dialog with one row per note-bearing `(MIDI track, channel)` source stream. A track that contains notes on only one channel has the same one-row behavior as Java Blue. Splitting multi-channel tracks by channel prevents cross-channel note pairing and makes channel mapping explicit.
- **FR-007:** Each mapping row must expose read-only source identity and editable instrument ID, note template, and trim-time settings. Blue defaults the instrument ID to `1`, uses template `i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>`, and leaves trim disabled. Numeric zero instrument IDs are rejected.
- **FR-008:** Support the Java Blue placeholders `<INSTR_ID>`, `<START>`, `<DUR>`, `<KEY>`, `<KEY_PCH>`, `<KEY_OCT>`, `<KEY_CPS>`, `<VELOCITY>`, and `<VELOCITY_AMP>` with locale-independent formatting.
- **FR-009:** Pair notes by source channel and MIDI key. Treat `NOTE_ON` with velocity zero as note-off, tolerate unmatched note-offs with warnings, and close dangling note-ons at the source stream's final tick with warnings so malformed files cannot create negative durations.
- **FR-010:** Convert PPQ ticks to quarter-note beats using `absoluteTick / ticksPerBeat`. Preserve fractional beats; do not quantize to Blue's default PPQ.
- **FR-011:** For each accepted source stream, create one `GenericScore` inside one layer of a new root layer group. When the project default layer-group type is `TRACK`, use `TrackLayerGroup` with one `Track` per stream; when it is `SOUND_OBJECT`, use `PolyObject` with one `SoundLayer` per stream. The generated score text contains one Csound note per paired MIDI note.
- **FR-012:** With trim disabled, keep absolute note starts and set the score object start to zero. With trim enabled, set the score object start to the first note's beat and normalize note starts by that offset, matching Java Blue's import behavior.
- **FR-013:** On successful import, replace the current in-memory `BlueData` project, stop the active Blue Live session as required by other import actions, clear the current project file path, and refresh renderer/editor state through the existing project-loaded lifecycle. The imported project is initially unsaved.
- **FR-014:** On cancellation or failure, do not mutate the current project, current file path, dirty state, or active editor session.
- **FR-015:** Cover parser, event pairing, placeholder expansion, timing, project construction, XML round-trip, IPC validation, dialog behavior, and native menu wiring with automated tests.
- **FR-016:** Extract every MIDI `SET_TEMPO` event as a beat-positioned tempo change. Convert microseconds per quarter note to BPM and configure the imported `Score` tempo map with constant-tempo points in event order. If the file has no tempo event, use the Standard MIDI File default of 120 BPM. Enable the imported tempo map.
- **FR-017:** Read the current project default layer-group type from program settings when committing the import. A malformed setting value must resolve through the existing project-setting normalization rules.

## Non-goals for this slice

- Importing MIDI time signatures, markers, program changes, controller automation, sysex, lyrics, or other non-note events into Blue project data. MIDI tempo events are imported into the Score tempo map as defined by FR-016.
- Importing MIDI files into an existing score as an additive operation. This slice follows Java Blue's action behavior and creates a replacement project.
- Supporting SMPTE division or SMF format 2 until a beat/time conversion policy is defined.
- Reusing the live MIDI input routing path as a file parser or note-template implementation.

## Acceptance criteria

1. A valid PPQ format-0 file with running status and velocity-zero note-offs imports into a playable GenericScore.
2. A format-1 file with multiple tracks and channels produces independently configurable mapping rows and separate score layers; the root layer-group shape follows the configured Track/SoundObject project default.
3. The generated note text matches Java Blue's placeholder expansion and beat semantics for equivalent inputs.
4. MIDI tempo events appear as enabled constant tempo points on the imported Score in beat order, with 120 BPM when the file has no tempo event.
5. A cancel, malformed file, unsupported division, or rejected mapping leaves the existing project byte-for-byte/state-equivalent from the user's perspective.
6. `@blue/data` remains browser/Node portable and contains no filesystem, Electron, or dynamic-import dependency.
