# Research: AudioFile and FrozenSoundObject Editor Detail Parity

## Decision 1: Treat the Java editors as two distinct user workflows

**Decision**: Model `AudioFile` as an editable source-file workflow and `FrozenSoundObject` as a read-only artifact-inspection workflow. Do not keep the current generic editable path control as their shared behavioral model.

**Rationale**: Java Blue's `AudioFileEditor` (`~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/soundObject/editor/AudioFileEditor.java`) uses a non-editable path field plus a chooser, an Audio File tab, a Csound tab, metadata rows, channel-variable feedback, and explicit missing/unsupported states. `FrozenSoundObjectEditor` in the same Java package shows source name/type, frozen filename, source duration, and a `Save Copy` action; it never exposes the frozen filename as an editable field. The current `FileBackedScoreObjectEditor.tsx` renders one editable text field for both types, so the missing parity is behavioral, not just visual.

**Alternatives considered**:

- Keep one generic file editor and add conditional labels: rejected because it preserves the unsafe FrozenSoundObject mutation affordance and cannot express the different persistence semantics.
- Route both types through the Audio File Player: rejected because player selection is a transient preview workflow, not a score-object source-selection or freeze-artifact export workflow.

## Decision 2: Keep filesystem and dialog work in a dedicated main-process operation seam

**Decision**: Add a focused main-process score-object file-operation module and expose narrow typed preload operations for AudioFile selection and FrozenSoundObject Save Copy. The renderer receives results and submits canonical AudioFile edits through the existing project-document bridge.

**Rationale**: The constitution makes the Electron main process the owner of filesystem access and the active `BlueData` document. Existing `main.ts` already contains Java-compatible path helpers and BSB file-selector handlers, while the renderer currently has no score-object chooser or Save Copy capability. A dedicated seam makes native dialogs, copy failures, overwrite confirmation, and injected filesystem behavior independently testable without coupling the renderer to Node APIs.

**Alternatives considered**:

- Read and copy files directly from the renderer: rejected by the context-isolation and data-core boundaries.
- Mutate `BlueData` inside a chooser IPC handler: rejected because the existing architecture expects renderer intent to cross the typed project-document patch bridge, and Save Copy must not mutate project data at all.
- Reuse the BSB IPC methods verbatim: rejected because BSB selectors return a path-only result and do not provide AudioFile metadata, Java media-copy collision behavior, or FrozenSoundObject destination safeguards.

## Decision 3: Reuse and generalize the existing Java-compatible path-resolution rules

**Decision**: Resolve stored audio paths in the same order already implemented by `missing-audio-assets.ts`: project directory, path as supplied, then `SFDIR` for separator-less names. Normalize selected paths relative to the project when they are children of the project directory. Honor `ProjectProperties.mediaFolder` and `copyToMediaFileOnImport` for AudioFile replacement.

**Rationale**: Java `BlueSystem.findFile` searches the project directory, the supplied path, and `SFDIR` for separator-less names. Java `BlueSystem.getRelativePath` stores a child of the project directory as a relative path. Java `AudioFileEditor` copies imports into the configured media folder before assigning the resulting relative path. The TypeScript port already has unit-tested equivalents in `packages/blue-app/src/main/missing-audio-assets.ts`, plus related path helpers in `main.ts`.

**Additional parity rule**: Java `FileUtilities.copyToMediaFolder` reuses an identical existing file and allocates a suffixed filename when a different file has the same basename. The new AudioFile import flow must preserve that collision behavior instead of overwriting an unrelated media file.

**Alternatives considered**:

- Always store an absolute selected path: rejected because it breaks Java-compatible project portability.
- Always copy to `media/` with overwrite: rejected because it ignores project settings and can destroy an existing asset.
- Resolve only relative to the current project: rejected because Java Blue and the existing missing-audio parity already support absolute paths and `SFDIR`.

## Decision 4: Extend the existing pure WAV/AIFF metadata parser rather than add a decoder dependency

**Decision**: Keep binary interpretation in `@blue/data` and extend the existing `AudioFileMetadata` result to provide the editor fields that can be determined from the supported headers: format type, byte length, encoding type, sample rate, sample size, channels, byte order, frame count, and duration. Represent unsupported or unreadable metadata with a typed error/status; do not add a third-party audio decoder in this slice.

**Rationale**: `packages/blue-data/src/audio/audio-file-metadata.ts` is already pure, browser-safe, Node-safe, and covered by deterministic WAV/AIFF fixtures. Java's editor obtains the same class of values from `AudioSystem.getAudioFileFormat`. Extending the existing parser preserves the data/UI boundary and keeps freeze artifact validation and editor inspection on one metadata implementation.

**Alternatives considered**:

- Use Web Audio API decoding for metadata: rejected because it does not provide Java-style encoding, byte-order, or format fields consistently and would move host/file concerns into presentation code.
- Add a native or npm decoder for every AudioSystem-supported format: rejected as out of scope for a detail-parity slice and unnecessary for the existing WAV/AIFF freeze contract.
- Fabricate missing metadata values: rejected because Java explicitly clears details on open/unsupported errors and the feature requires no stale values.

## Decision 5: Make AudioFile source replacement atomic at the project-patch boundary

**Decision**: Introduce a typed source-replacement patch carrying the selected stored path and basename-derived object name together. Keep Csound post-code edits as a separate AudioFile-specific patch. Reject frozen-artifact path mutation in the canonical patch handler.

**Rationale**: Java updates the AudioFile reference and object name as one selection flow. The current generic `updateTypeSpecificEditor` patch can update `filePath` but cannot atomically express the associated name change, and it currently permits FrozenSoundObject `filePath` mutation. A typed source-replacement intent prevents a partial renderer update and makes the read-only FSO contract enforceable in main.

**Alternatives considered**:

- Send two independent shared-property and type-specific patches: rejected because a project update could be observed between them and leave the name/path pair inconsistent.
- Continue accepting arbitrary `filePath` in the generic patch: rejected because it makes read-only state a renderer convention rather than a canonical invariant.

## Decision 6: Implement Save Copy as a no-project-mutation operation with Java's destination guards

**Decision**: Resolve the current freeze artifact in main, open a native save dialog defaulting to the current project directory, reject directories and existing freeze-prefixed targets, confirm ordinary overwrites, copy exact bytes, and return a discriminated success/cancel/error result. Do not submit a project patch.

**Rationale**: This matches `FrozenSoundObjectEditor.saveCopy()` and the feature's explicit requirement that exporting a copy must not alter freeze state, source data, or `.blue` XML. The existing freeze module already constrains generated artifacts to safe project-local filenames through `resolveFreezeArtifactPath`.

**Alternatives considered**:

- Reuse the renderer's audio-player open flow: rejected because it has no save dialog or overwrite policy.
- Add a `saveCopy` field to the project model: rejected because the destination is user-selected derived disk state.
- Allow overwriting freeze files after confirmation: rejected because Java deliberately protects generated freeze artifacts from accidental replacement.

## Decision 7: Verify at the lowest practical boundaries, then run the app builds

**Decision**: Add pure metadata tests, main-process file-operation tests with injected filesystem/dialog seams, shared document/patch tests, renderer contract tests for tabs/read-only controls/status transitions, and one project save/reopen regression. Run focused `@blue/data` and `@blue/app` Vitest suites plus main/preload/renderer builds.

**Rationale**: The feature crosses data parsing, filesystem/dialog IPC, canonical project mutation, and React presentation. Each boundary has a deterministic seam already used by adjacent features (`missing-audio-assets`, `freeze-score-objects`, and score-object editor tests). A full Electron manual pass remains necessary for native chooser/overwrite behavior because dialogs are not fully represented by jsdom tests.

**Alternatives considered**:

- Rely only on manual testing: rejected because path collisions, stale metadata, and no-op mutation cases are deterministic and regression-prone.
- Add an end-to-end Electron harness before unit seams: rejected as disproportionate; use the existing app test/build tooling and document the native dialog pass in `quickstart.md`.

## Resolved planning unknowns

- **Metadata coverage**: WAV/AIFF/AIFC header fields supported by the existing parser; unsupported formats and unreadable fields return explicit status rather than stale values.
- **Path semantics**: Java-compatible project-relative, absolute, and separator-less `SFDIR` resolution; media import honors project properties and collision-safe copy behavior.
- **State ownership**: main owns project/file operations; renderer owns transient tabs/status; `.blue` remains canonical; Save Copy has no persistence.
- **IPC shape**: typed selection and Save Copy results, plus typed AudioFile source/post-code project intents.
- **No unresolved `NEEDS CLARIFICATION` items remain.**
