# Waveform data handling

This change addresses findings 1 and 2 of the October 28, 2026 Electron memory
audit: unbounded score waveform retention and repeated whole-file audio work.
It changes disposable display data only; project models, XML, history, audio
playback, fades, offsets, and looping remain owned by their existing paths.

The renderer waveform cache is a string-keyed Map of WeakRef values, with no
entry-count or byte budget. Mounted views strongly own their current waveform
summary; otherwise the cache does not keep the data alive. A live weak value is
reused, and a collected value is a normal cache miss that regenerates the summary.
FinalizationRegistry removes dead map keys on a best-effort basis, with an identity
check so late cleanup cannot delete a replacement under the same key. Replaced,
cancelled, and explicitly cleared entries unregister their old cleanup tokens.
Finalization does not own audio resources or any correctness-critical cleanup.

JavaScript weak references are not Java SoftReference values: collection can occur
without memory pressure, and its timing is not guaranteed. This policy permits
all actively owned summaries to remain renderable and makes reuse of inactive
summaries opportunistic. There is no hard application memory cap.
Project replacement/closure explicitly clears cached references, advances a
generation, and invalidates old reads and decode results. Mounted waveform
consumers resubscribe on reset. Unsubscribing the last consumer cancels queued
work for that entry.

The player and score share one serialized waveform loading queue per renderer.
Only the running job holds file bytes or decoded PCM. Jobs check cancellation
before reading, after reading, and after decoding; an already running browser
decode cannot be interrupted, but its obsolete result is discarded. Contexts
close before the next job starts. Fresh IPC-owned ArrayBuffers go directly to
the decoder, which may detach them; cached models and shared caller buffers
are not passed in.

The player reads and decodes a selected file once to build an overview with at
most 2,048 min/max buckets per channel. Resizing redraws that summary without
reading or decoding again. Explicitly selecting the same pathname again reloads
it, including an overwritten render. The overview deliberately has fixed bucket
resolution; score waveforms retain their existing resolution-dependent sample
summaries and channel geometry. The player displays the first channel as before.
Uncompressed AIFF uses the existing PCM summarizer when browser codecs cannot
decode it.

Main exposes typed, read-only `get-audio-file-metadata` IPC through the existing
project-document registrar and preload bridge. It uses the existing host path
resolver, seeks through WAV/AIFF/AIFC chunk headers, and delegates interpretation
to the existing `@blue/data` parser. It reads at most 1,024 chunk headers and
small format bodies, skipping audio samples and unrelated chunk bodies. Unknown,
malformed, unavailable, or unreadable metadata produces null at IPC. Native
filesystem paths are passed unchanged. The player gets metadata independently
of waveform success; the score duration cache uses header metadata instead of
requesting all audio bytes and retains at most 256 durations.

Java behavior was consulted at revision
`3ca3f40579c48a023299a68130d8ab6b9e950974`, in
`blue-ui-utilities/.../audio/AudioWaveformCache.java`,
`AudioWaveformCacheGenerator.java`, `AudioWaveformUI.java`, and
`blue-ui-core/.../soundFile/AudioFilePlayer.java`. Java uses soft references,
queued analysis, resolution-dependent score summaries, and header-based metadata.
The TypeScript weak-value cache and fixed player overview are intentional
host/UI implementation choices. No Java source was copied or translated.

All additions are original within the application's existing GPL-3.0-or-later
scope. Existing MIT data APIs are reused through imports. No new dependency,
third-party source, asset, or generated table is incorporated.

Correctness tests use read/decode counts, strongly owned summaries, simulated
collected values and delayed finalization, synthetic large files, exact
metadata/envelope values, resize events, and controlled asynchronous completion.
They do not force GC or make assertions about when real collection occurs. They cover stale projects, reused keys, cancellation,
read/decode failures, context closure, and native Windows path forwarding.
These checks do not establish elapsed-time or whole-app memory acceptance.

For a desktop smoke check, open a long recording, resize the player repeatedly,
select another file, and select the original pathname again after overwriting
it. Inspect metadata, playback/seeking, and the overview. Zoom audio score clips,
then replace and close the project with waveform work pending. Verify that
multichannel lanes, fades, source offsets, and looping still render correctly.
Repeat on Windows CI/native Windows; synthetic-path checks do not replace that
platform run. Any before/after speed or resident-memory measurements must follow
`docs/performance-testing.md` on a controlled reference machine.

## Verification on October 29, 2026

- Workspace correctness validation passed for data/Java/client/CLI, native unit
  tests, and script checks. The final weak-value cache change passed the full app
  suite: 539 test files, 5,834 passed tests, and 15 skipped. Engine-dependent tests
  used the existing verified native engine through `BLUE_ENGINE_PATH`.
- `pnpm lint`, renderer type checking, main/preload builds, the production
  renderer build, and `git diff --check` passed.
- An Electron 44.5.1 smoke check on macOS loaded a one-second stereo 44.1 kHz WAV,
  verified header metadata through IPC, and counted exactly one browser decode
  after opening the file and resizing the native window three times.
- Native Windows validation and controlled whole-app memory/speed measurements
  were not run on this macOS host. The deterministic checks establish ownership, cache-miss recovery, and reduced
  read/decode work, not a measured process-RAM reduction.
- The final cache policy uses weak values without entry-count or byte limits.
  A 200-file workload verifies reuse of all actively owned summaries; collected
  values reload normally and delayed finalizers cannot purge newer results.
