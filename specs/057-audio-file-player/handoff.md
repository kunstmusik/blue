# 057 — Audio File Player Panel (Handoff Report)

> Retrospective handoff for the Audio File Player panel work. Written for the
> next agent picking this feature up. All work is **implemented and verified
> and ready for the Spec Kit closeout commit** on branch `057-audio-file-player`.

## 1. Summary

Added an in-app **Audio File Player** workbench panel that docks in the right
auxiliary area. It plays audio files (WAV/AIFF/MP3/OGG/FLAC/…) via an HTML5
`<audio>` element, shows a click-to-seek waveform with a moving playhead,
exposes Play/Pause + Loop controls and basic metadata, has an **Open** button
for file selection, and takes over the **"Render to Disk and Play"** action so
the in-app player attempts render playback instead of the OS default player.

Java Blue reference: `blue-ui-core/.../soundFile/AudioFilePlayer*.java`. Note
the Java original has **no loop** and **no waveform** (just a `JProgressBar`);
both are new here. Java's GEN01 f-table metadata generator was **deferred**.

## 2. Status

| Item | State |
|---|---|
| Implementation | Done |
| Feature-focused Vitest suite | 48 passing across 8 files |
| `tsconfig.main.json` typecheck | Clean |
| `tsconfig.preload.json` typecheck | Clean |
| Production renderer build | Clean |
| `pnpm -r run lint` | Passes (Java `mvn validate`; TS packages have no lint script) |
| Electron media/CSP smoke | `loadedmetadata`, finite duration, and `audio.play()` resolved |
| Diff hygiene | Formatting-only churn removed; main-process diff is feature-scoped |
| Commit | Included in the final Spec Kit closeout commit |

Pre-existing, unrelated failures: 3 tests in
`src/renderer/tests/score-panel-session-reset.test.tsx` fail with
`ResizeObserver is not defined`. Confirmed pre-existing via `git stash` (fail
identically on clean tree). **Do not try to fix these as part of this feature.**

## 3. Key design decisions (and why)

### 3.1 `blue-audio://` privileged streaming protocol (chosen over Blob URL / main-thread playback)

The renderer needs a `src` for `<audio>`. The main window runs with
`contextIsolation: true`, `nodeIntegration: false`, and no privileged file
scheme, so raw `file://` URLs are blocked by webSecurity.

Options considered:
- **Blob URL** from `readAudioFileBytes`: simplest, but loads the whole file
  into renderer memory.
- **Main-thread playback** (Node audio lib): rejected — Chromium's native
  media pipeline (CoreAudio/AudioToolbox on macOS) is faster than any JS
  decoder, and main-thread playback would need ~60 IPC msgs/sec for a smooth
  playhead and would contend with main's existing duties.
- **`blue-audio://` privileged scheme** (chosen): `protocol.handle` streams
  authorized local bytes with HTTP-style byte-range support, so `<audio>` can
  seek natively without a Blob copy. Waveform and metadata analysis still make
  intentional one-time byte reads (currently one read each).

URLs are `blue-audio://file/<base64url(absolutePath)>`. The encoded path is
stored in the URL pathname, not the hostname, because Chromium canonicalizes
hostnames to lowercase and would corrupt the case-sensitive base64url value.
`registerBlueAudioScheme()`
**must** be called synchronously before `app.whenReady()` (it calls
`protocol.registerSchemesAsPrivileged`); `registerBlueAudioProtocolHandler()`
is called inside `app.whenReady()`.

The main process authorizes the canonical path only after the file picker
selects it or a Play render completes. The handler returns `403` for every
unregistered path. The scheme intentionally has streaming privileges only;
renderer CSP explicitly permits it as `media-src` rather than bypassing CSP or
enabling Fetch access.

### 3.2 "Render to Disk and Play" now routes to the internal player

Per explicit user decision: **play** always uses the in-app player; **open**
is unchanged (`shell.showItemInFolder` / external open command).

Concretely in `main.ts` `handleRenderToDisk`:
- The `action === 'play'` branch is now an intentional no-op — no more
  `shell.openPath` or `launchExternalOutputCommand('Play')`.
- The renderer's `useRenderAndPlayInterceptor` hook (mounted in
  `WorkbenchShell`) listens for `diskRender`+`completed`+`action:'play'` and
  loads the file and attempts playback. A platform autoplay denial is caught
  and rendered as a player error.
- To make this possible, `RenderOperationStatus` gained an optional `action`
  field, threaded in at the broadcast boundary in `main.ts`
  (`activeRenderAction` module var + `broadcastRenderStatus` injects it).

**Side effect to clean up later:** `DiskRenderSettings.externalPlayCommand`
/`externalPlayCommandEnabled` are now inert for the play path (dead config).
The settings UI in `renderer/components/settings/DiskRenderSettings.tsx` still
shows them. Removing the UI + settings keys is a follow-up (NOT done).

### 3.3 Decoupled components + a tiny pub/sub bus

The render-and-play hook and the panel are decoupled via a module-level pub/sub
(`audio-player-bus.ts`) rather than a Zustand store. There is exactly one
producer (the hook) and one consumer (the mounted panel), so a 25-line bus is
simpler than a store. The hook opens the panel via `useWorkbenchStore` then
emits the path; the panel subscribes and loads it.

### 3.4 No new Zustand store

All player state (filePath, isPlaying, isLooping, currentTime, duration,
metadata) is local React state in `AudioPlayerPanel`. Nothing else in the app
needs to read it.

### 3.5 Compact player presentation

The waveform uses a black viewport for contrast. Open remains above it; Lucide
Play/Pause and Repeat controls plus the `MM:SS.SSS` current/total readout sit
below it. The empty viewport renders one `No File Selected` message and no
canvas or baseline. Metadata Duration uses the same millisecond formatter.

## 4. File manifest

### New files

| Path | Purpose |
|---|---|
| `packages/blue-app/src/main/audio-stream-protocol.ts` | Authorized `blue-audio://` scheme registration, base64url path encode/decode, and range-aware streaming handler |
| `packages/blue-app/src/main/audio-stream-protocol.test.ts` | 14 tests: encoding, narrow privileges, authorization rejection, authorized byte reads, real file streaming, ranges, and content types |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerPanel.tsx` | Main panel: `<audio>` element, Open action, icon transport row, millisecond time readout, waveform + metadata |
| `.../audio-player/AudioPlayerPanel.test.tsx` | Empty-state, icon-control accessibility, ordering, black viewport, and time-readout render regression |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerWaveform.tsx` | Canvas waveform with `requestAnimationFrame` playhead + pointer click/drag seek |
| `.../audio-player/AudioPlayerWaveform.test.ts` | 3 tests: connected envelope geometry, full-scale clamping, and single-path drawing regression |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/AudioPlayerMetadata.tsx` | Label/value table: file path, duration, sample rate, channels, size |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-url.ts` | Renderer-side base64url encode/decode (browser `btoa`/`TextEncoder`) |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-time.ts` | Shared `MM:SS.SSS` formatter for transport and metadata time fields |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/audio-player-bus.ts` | Module-level pub/sub connecting render-and-play hook to the panel |
| `packages/blue-app/src/renderer/components/workbench/panels/audio-player/use-render-and-play.ts` | Hook: subscribes to render status, opens panel + emits file on completed play render |
| `.../audio-player/audio-url.test.ts` | 3 tests: encode/decode round-trips |
| `.../audio-player/audio-time.test.ts` | 8 cases covering milliseconds, carry, long durations, and invalid values |
| `.../audio-player/audio-player-bus.test.ts` | 3 tests: pub/sub delivery, multi-subscriber, and delivery after a late panel subscription |
| `.../audio-player/use-render-and-play.test.tsx` | 5 tests: completed+play fires; negatives for render/open action, freeze, non-completed, missing outputPath |

### Modified files

| Path | Change |
|---|---|
| `packages/blue-app/src/main/main.ts` | Import + register `blue-audio` scheme/handler; add `activeRenderAction` tracking; `broadcastRenderStatus` injects action; remove `shell.openPath`/external play branch; add `open-audio-file`, `get-audio-file-stat`, and authorization-gated byte-read IPC handlers |
| `packages/blue-app/src/preload/preload.ts` | Expose `openAudioFile()`, `getAudioFileStat()`, and `readAuthorizedAudioFileBytes()` |
| `packages/blue-app/src/renderer/types/global.d.ts` | Type the three new `blueAPI` methods |
| `packages/blue-app/src/shared/render-freeze-contract.ts` | Add optional `action?: DiskRenderAction \| null` to `RenderOperationStatus`; update guard + `createStatus` |
| `packages/blue-app/src/shared/render-freeze-contract.test.ts` | +3 tests for the action field |
| `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx` | Branch `AudioFilePlayerTopComponent` → `<AudioPlayerPanel />` |
| `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` | Call `useRenderAndPlayInterceptor()` once (2 lines) |
| `packages/blue-app/src/renderer/index.html` | Allow `blue-audio:` only in `media-src` CSP |
| `packages/blue-app/src/renderer/popout.html` | Allow `blue-audio:` only in `media-src` CSP |

### Pre-existing registration (already there, no change needed)
The `AudioFilePlayerTopComponent` descriptor in
`shared/workbench-menu.ts:46` (mode `properties`, `auxiliaryGroupId
properties-main` → right edge) and its entry in
`auxiliary-layout.ts` `AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds`
were **already present** before this work — it just rendered as
`PlaceholderPanel`. This feature supplies the real component.

## 5. Data flow

### 5.1 Open a file manually
```
[Open button] → window.blueAPI.openAudioFile()
  → ipc 'open-audio-file' → dialog.showOpenDialog (audio filters) → path
  → main authorizes canonical path for `blue-audio://` streaming
AudioPlayerPanel.loadFile(path, autoplay=false)
  → <audio src={encodeAudioPath(path)}> (blue-audio://file/<base64url>)
  → onLoadedMetadata → setDuration, fetch metadata (stat +
    readAuthorizedAudioFileBytes + decodeAudioData)
AudioPlayerWaveform → readAuthorizedAudioFileBytes + decodeAudioData +
  summarizeWaveformChannels → draw
```

### 5.2 Render to Disk and Play
```
[Menu: Render to Disk and Play] → handleRenderToDisk('play')
  → executeRenderToDisk → statusCallback({phase:'completed', outputPath, action:'play'})
  → main authorizes the completed output path, then broadcasts action:'play'
  → broadcastToWorkbenchWindows(RENDER_OPERATION_STATUS_CHANNEL, ...)
[renderer] useRenderAndPlayInterceptor (mounted in WorkbenchShell)
  → on diskRender+completed+action:'play'+outputPath:
    → useWorkbenchStore.getState().openPanel('AudioFilePlayerTopComponent')
    → emitPendingAudioFile(outputPath)
[renderer] AudioPlayerPanel subscribes → loadFile(path, autoplay=true)
  → <audio>.load → onLoadedMetadata → attempts audio.play() (autoplayRef)
  → reports a platform autoplay denial in the panel
```

### 5.3 Waveform playhead (smooth, no IPC)
```
AudioPlayerWaveform rAF loop reads audioRef.current.currentTime directly
  → redraws peaks (cached) + red playhead each frame
click/drag → seekFromClientX → onSeek(ratio*duration) → audio.currentTime = t
```

## 6. How to verify

```bash
# Run just this feature's tests
cd packages/blue-app
npx vitest run --config vitest.config.ts \
  src/main/audio-stream-protocol.test.ts \
  src/shared/render-freeze-contract.test.ts \
  src/renderer/components/workbench/panels/audio-player/

# Typechecks (the strict gates; renderer builds via Vite without full typecheck)
npx tsc --noEmit -p tsconfig.main.json
npx tsc --noEmit -p tsconfig.preload.json

# Full suite (expect 3 pre-existing failures in score-panel-session-reset.test.tsx)
pnpm --filter @blue/app test

# Lint (Java only; no TS lint configured)
pnpm -r run lint
```

Manual smoke test: open the app → Window menu → Audio File Player (right
rail) → Open a WAV → Play; Render to Disk and Play should autoload and attempt
playback in the panel, reporting any platform autoplay denial.

## 7. Known tradeoffs / debt

1. **Double `decodeAudioData` on file load.** `AudioPlayerPanel` decodes for
   metadata (sampleRate/channels) while `AudioPlayerWaveform` decodes again
   for peaks. Kept decoupled for simplicity; renders are typically MB-scale.
   Consolidate by lifting the decoded `AudioBuffer` into the panel and passing
   channel data down if large-file load becomes a concern.
2. **`externalPlayCommand`/`externalPlayCommandEnabled` settings are now inert**
   for the play action. The `DiskRenderSettings.tsx` settings UI still shows
   them. Remove the UI + settings keys in a follow-up, or repurpose.
3. **Waveform renders only channel 0** (`summarizeWaveformChannels` is called
   with all channels but the panel draws `channels[0]` only via the cache
   helper's first entry). A stereo-mirrored view is a future enhancement.
4. **`AudioPlayerWaveform` runs its rAF loop continuously while a file is loaded**
   (even when paused). Cheap (one canvas redraw/frame), but could be
   gated to "playing or seeking" if power use matters.
5. **No output device selector** (deferred). Java has a system-mixer
   dropdown; Chromium's `setSinkId` is inconsistent across platforms.
6. **The legacy score waveform byte-read IPC remains broader.** It predates
   this feature and supports project-relative, absolute, and `file://` score
   asset paths. The player uses the new authorization-gated byte-read route;
   hardening the legacy score channel requires a separate project-audio
   allowlist feature to avoid breaking existing score waveform behavior.

## 7.1 Post-handoff playback diagnosis

The first manual build displayed a waveform and metadata but failed to load
the same WAV in `<audio>`. An Electron media-pipeline probe showed that
Chromium lowercased the original base64url hostname before dispatching the
protocol request, so the handler decoded a corrupted nonexistent path. Moving
the encoded value to the pathname fixed the failure. The exact reported
`Clave.wav` then reached `loadedmetadata`, reported its finite duration, and
completed `play()` without an error through the ranged streaming response.

The render-to-play bus also now retains one pending path when the panel has not
mounted yet, removing the race between `openPanel()` and panel subscription.

Final closeout review found that a forgeable renderer URL could otherwise name
an arbitrary local path. The media protocol now uses a main-owned canonical
path allowlist populated only by the file picker and Play renders, rejects
unregistered paths with `403`, and no longer bypasses CSP or enables Fetch.
The player-specific waveform/metadata byte-read capability is gated by that
same allowlist. An Electron smoke probe verified authorized playback under the
explicit `media-src blue-audio:` policy.

The original waveform renderer also painted every min/max bucket as an
independent rectangle. Very short files can have only one or two samples per
pixel, leaving most rectangles wholly above or below zero and making the
waveform appear as detached dashes. It now draws the same min/max data as one
connected, filled envelope with a subtle zero line. A pixel comparison using
the reported `Clave.wav` confirmed a continuous decaying transient without
changing decoding, seeking, or playhead behavior.

## 8. Explicitly out of scope (deferred)

- GEN01 f-table generator + Copy button (Java `SoundFileInformationPanel`
  has it; "basic metadata" was the chosen slice).
- WAV/AIFF header parsing for encoding type / bit depth / big-endian /
  byteLength parity fields.
- Output device selection via `HTMLAudioElement.setSinkId`.
- Removing the now-dead `externalPlayCommand` settings UI.

## 9. Reference material

- Java player (do not modify, reference only):
  - `~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/soundFile/AudioFilePlayerTopComponent.java`
  - `.../soundFile/AudioFilePlayer.java` (inner `SoundFilePlayerRunnable`)
  - `.../soundFile/SoundFileInformationPanel.java`
- Java render integration:
  - `~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/project/RenderToDiskAndPlayAction.java`
- Reused renderer infra:
  - `packages/blue-app/src/renderer/components/workbench/panels/score/bar-renderers/waveform-cache.ts` (`summarizeWaveformChannels`, `decodeAudioData` pattern)
  - `packages/blue-app/src/main/main.ts` `openBsbFileSelector` (dialog pattern this feature mirrors)

## 10. Commit

The user explicitly requested the Spec Kit closeout. The final closeout commit
contains all implementation, validation, and documentation artifacts.

The change spans main/preload/shared/renderer; it is self-contained and does
not alter project XML, settings persistence, or any other panel.
