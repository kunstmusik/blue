# MIDI File Import Research

**Research date:** 2026-08-09
**Question:** Which NPM SMF parser is dependable enough for a Node/Electron import path, and what should sit around it?

## Recommendation

Use `midi-file@1.2.4` as the primary parser behind a small Electron-main adapter. It is a low-level parser with TypeScript declarations, accepts an array-like byte input, exposes the SMF header and event tracks, has no runtime dependencies, and preserves the raw information needed for Java-compatible tick/channel/note pairing. Pin the exact version and treat the adapter as the compatibility boundary so the rest of the application does not depend on the package's event type names.

The parser is not selected because it is actively evolving: its NPM page reports the current 1.2.4 release as published three years ago. The mitigation is a narrow adapter, checked-in byte fixtures, malformed-input tests, and an upgrade procedure that runs the same compatibility suite. Use JZZ-midi-SMF as an optional manual/CI validation oracle if parser behavior needs to be cross-checked; do not add it as a second production parser in the first slice.

## Candidate comparison

| Package | Useful evidence | Fit for this feature | Decision |
| --- | --- | --- | --- |
| [`midi-file`](https://www.npmjs.com/package/midi-file) 1.2.4 | MIT, TypeScript declarations, zero dependencies, array-like input, raw header/tracks/events, supports parse and write | Directly exposes delta ticks, channel, note-on/off, track metadata, running-status details, and division information. Small API is easy to wrap and test. | **Primary** |
| [`@tonejs/midi`](https://www.npmjs.com/package/%40tonejs/midi) 2.0.28 | MIT, TypeScript declarations, mature consumer footprint; built on `midi-file` | Convenient high-level note arrays and seconds, but the package is older and hides/normalizes details that the Java-compatible importer needs. Its derived timing model is unnecessary when Blue wants PPQ beats. | Rejected as primary; useful for comparison only |
| [`jzz-midi-smf`](https://www.npmjs.com/package/jzz-midi-smf) 1.9.9 | MIT, actively published, supports Buffer/typed-array input, validates SMF, handles MIDI/ karaoke/RMI variants | Strong validation and broad MIDI support, but it is a JZZ plugin with a larger global/registration surface and less direct fit for a small typed adapter. | Optional fallback/validation oracle |
| [`midi-json-parser`](https://www.npmjs.com/package/midi-json-parser) 8.1.75 | MIT, actively published, TypeScript, broad event union | Current and capable, but its public module is browser/worker-oriented around `Blob`, object URLs, and a broker. That is an awkward fit for the main-process file-dialog boundary. | Rejected for main-process path |
| `midi-parser-js` / `midi-file-parser` | Older parser-first packages with weaker maintenance/type/license signals | Not a dependable default for a new Electron feature. | Rejected |

The package API and types were checked against the [`midi-file` repository](https://github.com/carter-thaxton/midi-file), including its [`index.d.ts`](https://github.com/carter-thaxton/midi-file/blob/master/index.d.ts). The SMF scope follows the [MIDI Association's Standard MIDI Files reference](https://midi.org/standard-midi-files).

## Java Blue behavior to port

The reference implementation is `~/work/nbprojects/blue/blue-projects/src/main/java/blue/utility/midi/MidiImportUtilities.java`, with settings in `MidiImportSettings.java` and `TrackImportSettings.java` and placeholder expansion in `~/work/nbprojects/blue/blue-utilities/src/main/java/blue/utilities/MidiUtilities.java`.

Observed behavior:

- The default note template is `i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>`.
- This implementation defaults every mapping row to instrument ID `1` and rejects numeric zero, even though the historical Java helper seeded the source track index (including track `0`).
- Java presents a settings table for note-bearing tracks with instrument ID, template, and trim-time columns.
- It converts MIDI event ticks to beat-like values, creates a root `PolyObject`, and creates one `SoundLayer`/`GenericScore` per configured MIDI track.
- Trim moves the score object's start to the first note and normalizes the note list.
- MIDI key placeholders include integer key, pitch-class, octave, and cycles-per-second. Velocity amplitude uses Java Blue's historical formula, which is distinct from the live-input velocity mapping in this repository.
- The action imports as a new project rather than merging notes into the currently open score.

The TypeScript plan intentionally hardens two weak edges of the Java implementation: pairing is channel-aware and supports overlapping same-key notes, and unmatched/dangling events produce diagnostics instead of negative-duration notes. These differences are limited to malformed or structurally ambiguous files.

## Decisions and edge cases

### Timing

For PPQ files, use `absoluteTick / ticksPerBeat` and preserve fractional beats. Note positions remain beat values; tempo is configured separately on the imported Score. Convert each MIDI `SET_TEMPO` event's microseconds-per-quarter-note value with `60,000,000 / microsecondsPerBeat`, then add a constant tempo point at the event's beat. The SMF default is 120 BPM when no tempo event is present, so imports always enable a meaningful Score tempo map. If several tracks set tempo at the same tick, the normalized document uses the last event in deterministic track/event order for that beat.

SMPTE division cannot be mapped to Blue beats without a deliberate tempo/timebase policy, so reject it with an actionable message. Reject format 2 for the same reason: its independent sequences do not have the single project timeline assumed by this action.

### Event normalization

The parser adapter converts delta times to absolute ticks and keeps source track/channel identity. The converter then:

1. groups note events by `(track, channel)`;
2. treats `noteOn velocity === 0` as note-off;
3. pairs a note-off with the oldest open note of the same key (FIFO), allowing overlapping notes;
4. ignores unmatched note-offs with a warning; and
5. closes remaining notes at the stream's final tick with a warning.

Only finite, non-negative note durations are emitted. This avoids turning malformed bytes into invalid Csound score text.

### Layer-group default

As an intentional Electron extension to the historical Java importer, the main-process commit reads `projectDefaults.defaultLayerGroupType` from program settings and normalizes it with the same helper used for new projects. `TRACK` creates a `TrackLayerGroup` with one `Track` per imported stream; `SOUND_OBJECT` creates the historical `PolyObject` with one `SoundLayer` per stream. `GenericScore` is registered as a Track-compatible sound object, so the same generated score text works in either mode.

### Multi-channel tracks

Java's table is track-oriented, but a MIDI track can contain more than one channel. The dialog therefore exposes one import row per active `(track, channel)` stream. Single-channel tracks remain Java-compatible. Multi-channel tracks are split so users can assign different instrument IDs/templates and so a note on one channel cannot close a note on another channel.

### Parser safety

The selected path is read in Electron main. Parser exceptions are caught and converted into user-facing errors; no partially built `BlueData` is installed. The renderer receives only a serializable preview and submits only validated settings. Pending import tokens are short-lived and invalidated on cancel, project replacement, or renderer session change.

## Alternatives considered

- **Use `@tonejs/midi` end to end:** less code initially, but its high-level seconds/duration representation makes exact PPQ behavior and malformed-event diagnostics harder to control.
- **Use JZZ as the production parser:** stronger validation and active releases, but plugin registration and broader MIDI abstractions increase Electron packaging and test surface without helping the GenericScore conversion.
- **Put binary parsing in `@blue/data`:** possible because `midi-file` accepts array-like input, but it couples the portable data package to a third-party parser. Keeping the package in `@blue/app` main and passing a project-owned normalized document gives a cleaner host/domain boundary.
- **Write a parser in-house:** unnecessary risk around VLQ decoding, running status, chunk lengths, and meta/sysex skipping when a small MIT parser already supplies those primitives.
