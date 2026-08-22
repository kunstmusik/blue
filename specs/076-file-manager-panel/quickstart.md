# Quickstart: Blue File Manager Panel

## Prerequisites

- Checkout branch codex/076-file-manager-panel.
- Install workspace dependencies with pnpm install if the workspace is not
  already prepared.
- Have one saved .blue project with a Track audio layer, one readable WAV or
  AIFF fixture, and optional FLAC/OGG/MP3 fixtures for the capability-derived
  allowlist checks.
- Have a temporary directory containing visible files, dot-prefixed files,
  nested directories, and (for the performance check) at least 1,000 mixed
  entries. Do not use a broad user directory as a destructive test target.

## Automated verification

Run from /Users/stevenyi/work/blue-electron:

~~~bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
git diff --check
~~~

Focused suites should cover:

- packages/blue-app/src/shared/file-manager.test.ts
  - settings default/merge behavior;
  - root identity de-duplication and action eligibility;
  - case-insensitive suffix allowlist;
  - Windows/POSIX file:// URI parsing and multi-file rejection.
- packages/blue-app/src/main/file-manager-service.test.ts
  - static/home/favorite root composition;
  - missing/unreadable directories;
  - hidden-entry filtering and stable ordering;
  - favorite validation without disk mutation;
  - media-copy and stale-target rejection paths.
- packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx
  - panel route, lazy expansion, refresh, context-menu matrix, drag payload,
    save failure recovery, and 1,000-row rendering behavior.
- packages/blue-app/src/renderer/tests/track-layer-audio-drop.test.tsx
  - File Manager node and external single-file drops create one typed request;
  - pointer-to-track/layer/start-beat mapping;
  - directory, multi-file, unsupported, URI, and invalid-target rejection.
- Existing soundfont-viewer-panel.test.tsx and workbench auxiliary tests
  - no .sf2 filtering, Copy Path, or stable panel-identity regression.

## Manual parity smoke test

1. Launch the development app using the repository's normal Electron workflow.
2. Choose Window > File Manager. Confirm the registered panel opens in the
   output auxiliary group and no placeholder appears.
3. Confirm static roots and home are visible. Expand one root and several
   nested directories. Verify direct children are sorted, dot-prefixed entries
   are absent, and a large directory remains responsive.
4. Right-click an ordinary directory. Verify Refresh Folder and Add to
   Favorites. Add it, close/reopen the panel, and confirm it appears as a
   favorite root. Verify the persisted field is under
   appSpecific.fileManagerFavorites in the main-process settings file.
5. Right-click the favorite root. Verify Refresh Folder and Remove from
   Favorites. Remove it and confirm the directory and contents on disk are
   unchanged. Verify static roots do not offer Remove from Favorites.
6. Refresh a directory after creating/removing one visible child outside Blue.
   Confirm only that subtree changes and a missing/unreadable directory shows a
   recoverable diagnostic.
7. Open a project with a Track audio layer. Drag a supported regular file from
   File Manager to multiple layer/time coordinates. Confirm the copy cursor,
   one new AudioClip, the expected snapped start beat/layer, and the
   copy-to-media behavior when enabled.
8. Drag a directory, a non-audio file, or an unavailable/missing source. Drag
   multiple external files. Confirm each is rejected and the project revision
   and dirty data do not change.
9. Drag one external .wav, .aiff, .flac, .ogg, or .mp3 from Finder, Explorer,
   or the desktop to the Track audio-layer surface. Confirm the same
   single-clip/media-copy flow. Drop a non-file URI and confirm rejection.
10. Open SoundFont Viewer. Confirm its embedded .sf2 browser, directory
    navigation, metadata inspection, and Copy Path action are unchanged. Drop a
    File Manager node there and confirm no File Manager operation is implied.
11. Save, close, and reopen the project. Confirm the clip is present through
    the normal .blue save/reload path, while favorites remain app-wide and are
    not written into project XML.
12. Double-click a supported audio file (e.g. `.wav`, `.mp3`, `.m4a`) in File
    Manager. Confirm the Audio File Player opens on demand, populates with the
    file, and autoplays without a 403 from the audio stream protocol.
    Double-click an unsupported file (e.g. `.txt`) and a directory; confirm
    nothing opens. Double-click a file that was deleted after listing (or
    verify the toast path) and confirm a recoverable error appears.
13. Double-click an `.sf2` file in File Manager with the SoundFont Viewer
    closed. Confirm the viewer opens on demand and inspects the file (same
    tables as choosing it there). Double-click other file types and confirm
    the viewer does not open.
14. Expand several folders in File Manager, scroll partway down, then move the
    panel between docked and slideout modes or open another auxiliary panel
    (for example via an `.sf2` double-click). Confirm expanded folders, loaded
    listings, and the scroll offset survive the remount without re-listing
    requests, and that a full app restart starts the tree collapsed and
    scrolled to the top.
15. Right-click the Home root, choose `Rename Root`, and confirm the modal
    shows a Name field and the path underneath in muted text. Enter a name and
    choose `OK`; confirm the row shows `NewLabel - /Users/<name>` with the
    separator/path muted. Reopen the modal, clear the name, choose `OK`, and
    confirm it reverts to `Home` (or `Unnamed Root` for an unlabeled root).
    Double-click the Home root separately and confirm it focuses the root and
    shows the breadcrumb instead of opening rename. Restart the app and confirm
    the custom label persisted while the filesystem itself was never changed.
16. Double-click a nested folder to focus it. Confirm the breadcrumb bar shows
    `Roots > … > focused folder`, click `Roots` and intermediate segments, and
    confirm each level's open/closed and scroll state is restored exactly.
    Confirm drag-to-audio-layer, context actions, and tool double-click still
    work inside a focused view.

## Cross-platform path checks

Record at least one test result for each form:

| Input | Expected |
|---|---|
| POSIX path with spaces/unicode | Listed, dragged, and saved without truncation or URI corruption. |
| file:///Users/name/audio.wav | Decodes once to the absolute POSIX path. |
| Windows file:///C:/Users/name/audio.wav | Decodes to the host-native C:\\Users\\name\\audio.wav. |
| Windows/UNC file://server/share/audio.wav | Retains the share path; non-file schemes reject. |
| Case variant TAKE.WAV | Accepted by the shared suffix helper. |
| .WAV.backup | Rejected because the final suffix is not supported. |

## Csound capability evidence

On the development machine, capture the Csound version/format output used to
justify the allowlist:

~~~bash
/usr/local/bin/csound --version
/usr/local/bin/csound --help | rg -n -- "--format|wav|aiff|flac|ogg|mpeg"
/opt/homebrew/bin/sndfile-info --help
~~~

The implementation must keep the allowlist tests synchronized with the
capability decision recorded in research.md; browser-only formats must not be
silently added because the Audio File Player can preview them.

## Verification evidence (2026-08-17 implementation run)

Machine-verified in this session:

- Full `pnpm --filter @blue/app test`: 321/321 test files pass, 3023 tests pass (2 skipped); zero regressions.
- `pnpm --filter @blue/app build`, `tsc -p tsconfig.main.json`,
  `tsc -p tsconfig.preload.json`, repo `npm run lint`, and `git diff --check`
  all pass. `ScoreTimeCanvas.tsx` has a zero-line diff.
- US5 verification:
  - T037 (scroll offset caching): `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx` verifies that scroll position is preserved in the renderer session cache across panel remounts.
  - T038 (root labels normalization & service): `packages/blue-app/src/shared/file-manager.test.ts`, `packages/blue-app/src/shared/program-settings.test.ts`, and `packages/blue-app/src/main/file-manager-service.test.ts` verify normalization and default (`Root`, `Home`, favorite path) vs custom root label computation.
  - T039 (root labels rendering & context-menu rename modal): `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx` verifies `Label - /path` formatting with a muted path, the `Unnamed Root` fallback, context-menu modal opening, settings persistence on OK, reversion to default on empty submit, cancellation, and failure handling.
  - T040 (focus mode, breadcrumb bar, & level stacks): `packages/blue-app/src/renderer/tests/file-manager-panel.test.tsx` verifies double-clicking a folder focuses it as the top-level tree node, renders the breadcrumb bar (`Roots > … > folder`), navigates back to intermediate segments and `Roots` restoring exact state stacks, and verifies audio file drag, context menus, and tool double-click inside focused views.
- Cross-platform path rows are covered by
  `packages/blue-app/src/shared/file-manager.test.ts` (POSIX spaces/unicode,
  single percent-decode, Windows drive `file:///C:/...`, UNC share form,
  `TAKE.WAV`, `.WAV.backup`).
- Capability commands: `csound --version` reports Csound 7.0 (double samples,
  commit fee3593); `csound --help` lists WAV/wave, AIFF, AU, OGG, MPEG, FLAC
  among sound-file formats, matching the 24-entry allowlist basis in
  research.md.

Manual parity close-out (2026-08-17): the user completed the manual workflow
for this feature and reported the expected behavior. The POSIX, Windows-drive,
UNC, suffix, and capability cases are represented by the automated evidence
above and the research record; this macOS session did not independently run a
Windows host. A fresh post-review package rerun was not possible because the
local pnpm store is missing the locked Prettier tarball, so the full validation
results recorded above remain the machine-verified baseline.
