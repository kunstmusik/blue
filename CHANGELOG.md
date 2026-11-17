# Changelog

This file records notable changes in Blue 3. It follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) for release versions.
Stable entries cover the changes since the previous stable release. Prerelease
entries summarize changes for testers since the preceding preview.

See the [Blue 2 changelog](https://github.com/kunstmusik/blue/blob/2.10.3/ChangeLog.md)
and the [GitHub release archive](https://github.com/kunstmusik/blue/releases) for
earlier versions.

## [Unreleased]

Draft for Blue 3.0.0, covering the upgrade from Java Blue 2.10.x.

**Upgrading from Blue 2?** Open a copy of your `.blue` project and keep the
original and its media if you still work in Blue 2. Blue 3 migrates supported
projects on open and saves them in the current `.blue` format. Blue 2 may be
unable to open or preserve Blue 3 project data. Before replacing your working
copy, check playback, automation, and a disk render in Blue 3.

### Added

- Project-wide undo and redo with a history panel for reviewing edits.
- Real-time mixer meters, channel mute and solo, and configurable mono pan laws and stereo Balance, Stereo Pan, and Dual Pan modes. In Score settings, Track header mute and solo can control mixer audio or filter score events. These modes keep separate states.
- A File Manager panel for browsing and dragging media into the project. Drag an audio file onto a Track or use **Add AudioClip**. Trim it in place or Alt-drag to slip the source audio without moving the clip. See the [Score manual](docs/manual/score.qmd).
- Parallel freezing for multiple SoundObjects, with a configurable limit on concurrent renders. Keep the generated freeze audio alongside the project when moving it.
- Drop-frame SMPTE timecode at 29.97 and 59.94 fps, with consistent formatting across rulers, transport, markers, and score object fields. See the [timecode guide](docs/manual/time.qmd).
- Context-aware Csound opcode completion and links to the Csound manual in code editors.
- The standalone `blue-cli` command-line compiler replaces the old desktop `blue --compile` workflow. Use `blue-cli compile -p project.blue -o project.csd` for disk-render CSD output. Realtime and Blue Live CSD output are also available. See the [CLI guide](packages/blue-cli/README.md).
- A bundled Blue 3 user manual and an **Open Example Project** command that opens an editable copy of a factory example.

### Changed

- **Audio Layers become Tracks.** Blue converts legacy Audio Layer Groups and their Audio Layers to Track Layer Groups and Tracks on open. It keeps the clips, layer order, automation assignments, mute/solo state, and associated mixer settings. Migrated Tracks start without an assigned instrument. Saving writes the new Track format.
- **Tracks can contain audio clips and compatible SoundObjects together.** Each Track has a mixer channel and can have its own instrument and Note Processor Chain. Assigning an instrument retargets eligible generated notes to that instrument while audio clips keep their own playback. New projects start with a Track Layer Group by default. Set **Default Layer Group Type** to **SoundObject Layer** in Program Options to start with the older workflow. Existing SoundObject and Patterns layers remain available. `AudioFile` SoundObjects still belong on SoundObject layers.
- Blue 3 moves the desktop app from Java/NetBeans to Electron. Install the package for your platform from GitHub Releases. Initial packages support macOS arm64, Windows x64, and Linux x64.
- The new workbench has dockable panels and floating editor windows, and remembers your layout across restarts. Windows and Linux also have a menu bar visibility option.
- Blue bundles Blue Engine and loads a separately installed Csound 7 shared library for playback, disk rendering, and freeze. An old Csound executable preference does not select the runtime. Use **Check Engine and Csound** in Realtime Render settings to verify discovery, then check your audio and MIDI device selections. Basic editing works without Csound. Java 17 or later is required for Java-backed features such as Clojure and Jython. See [runtime settings](docs/manual/settings.qmd).
- The **Libraries** panel brings reusable instruments, UDOs, effects, and SoundObjects together. A first-run scan imports recognized user libraries from the default Java Blue configuration folder into an empty Blue 3 library and leaves the Java files intact. Use **Import XML…** for libraries kept elsewhere. Project instruments and UDOs remain in their project panels, and project-shared SoundObjects are in **SoundObject Library**.
- Blue Share imports now go into the User Library as independent resources for later use in a project. You can browse and import without signing in. Sign in to publish or manage your submissions. See the [Blue Share guide](docs/manual/tools.qmd#blue-share).
- BlueX7 uses a new six-operator renderer and tabbed voice editor with parameter automation. Supported Blue 2 voices load, but the new synthesis can sound different. Audition existing voices before replacing a reference render. Saving back through Java Blue does not preserve Blue 3's BlueX7 automation metadata. See the [BlueX7 compatibility notes](docs/blue-x7-modern-renderer.md).
- Legacy **Symmetric** clip fades load as **S-Curve**. Mixer panning is opt-in for legacy projects, preserving their existing routing until enabled.
- Legacy SMPTE projects open in non-drop-frame mode unless a mode is saved. Stored event times stay intact, but corrected fractional-rate arithmetic can change displayed labels and the time represented by newly entered labels.
- Project and library loading reports unsupported or invalid serialized data. Blue rejects unexpected content that would otherwise be lost on save. If a project or import is rejected, keep the original and use the diagnostic to identify the unsupported field or type.
- Reduced work during score editing, waveform display, mixer updates, and undo to improve responsiveness in larger projects.

### Removed

- The old Script Library and its Java application scripting API are unavailable in Blue 3. Supported Jython project code still runs through the Java helper. Review scripts that call Java Blue application APIs before relying on them in a render.
- The Java-era automatic project backup and recovery workflow is unavailable. Save explicitly and keep versioned copies of important projects.
- The old **Scanned Synthesis Matrix Editor** and **Manage Tools** menu are absent. Blue Live's old **SCO Pad** and toolbar MIDI Input toggle are absent as well. Configure MIDI input devices in settings.

## [3.0.0-beta.6] - 2026-11-16

Highlights since `3.0.0-beta.5`.

### Added

- A menu bar visibility option on Windows and Linux.

### Changed

- Improved responsiveness in the score, Piano Roll, Tracker, mixer, and output logs, and reduced memory use for undo history.

### Fixed

- Fixed blank editor popouts and improved cleanup when editing gestures or playback are interrupted.
- Fixed a case where rendering to disk could lose audio clip routing, and preserved frozen audio still needed by saved projects, other clips, or undo.
- Fixed Csound 7 library detection on Windows and stopped playback from creating an unnecessary media folder.
- Fixed several command-line compilation issues for projects that use Java, external score generators, Scala tuning files, or audio file layout information.

[3.0.0-beta.6]: https://github.com/kunstmusik/blue/compare/v3.0.0-beta.5...v3.0.0-beta.6
