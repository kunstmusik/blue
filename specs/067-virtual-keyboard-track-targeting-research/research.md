# Research: Virtual Keyboard / MIDI → Track Targeting

**Status:** Phase 0 complete (planning input — no implementation here)
**Date:** 2026-08-06
**Author:** Seeded ZCode research with independent Codex planning validation
**Related specs:** 033 (MIDI Input / Virtual Keyboard Parity), 058 (MIDI Device Input and Blue Live Routing), 065 (Blue Live Trigger Parity), 066 (Track Layer Foundation)

## 0. Independent planning validation and resolved scope

The Spec 067 planning pass re-read the TypeScript and Java paths cited below and,
on 2026-08-06, independently validated the DAW direction against current primary
manuals:

- Apple documents Musical Typing as playing the selected software-instrument Track:
  <https://support.apple.com/guide/logicpro/lgcpb19cbd34/mac>
- Ableton documents monitoring on armed Tracks, `All Channels` as the merged default,
  individual per-Track input-channel selection, and computer-keyboard MIDI generation:
  <https://www.ableton.com/en/manual/routing-and-i-o/>
- Steinberg documents the On-Screen Keyboard as MIDI input and Track record/monitor
  controls as the route for incoming MIDI:
  <https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/virtual_keyboard/virtual_keyboard_about_c.html>
  and
  <https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/tracks_about/tracks_about_track_controls_r.html>
- REAPER's official user guide documents selecting the Virtual MIDI Keyboard as a
  Track input and choosing a channel or All Channels:
  <https://www.reaper.fm/userguide.php>

**Decision**: Spec 067 uses one transient shared routing mode for hardware MIDI and
the Virtual Keyboard. `Focused Target` is the app-session default and targets the
last explicitly focused Track or Orchestra assignment. `Direct Channel` preserves
the existing multi-timbral path.

**Rationale**: Hardware and virtual sources already converge in one renderer router.
A shared target policy keeps equivalent input equivalent, makes Track focus useful to
physical controllers as well as the on-screen keyboard, and matches the Track-first
workflow supported by the primary DAW manuals. Including explicit Orchestra focus
also removes list-position ambiguity for named or non-consecutive assignments.

**Alternatives considered**:

- Virtual Keyboard-only focus: rejected because it would make equivalent hardware
  input behave differently at the shared routing boundary and would not satisfy the
  requested general MIDI-routing workflow.
- Persisted per-Track input source/channel filters: deferred because it introduces a
  new project routing model, arming semantics, XML, and migration beyond this slice.
- Replace channel routing entirely: rejected because existing Blue Live and
  multi-timbral workflows require a compatibility path.

**Decision**: Treat invalid or unavailable routing as a silent user-facing rejection
over an explicit typed internal failure contract.

**Rationale**: The clarified feature requires the note simply to produce no sound.
The renderer therefore does not publish a routing diagnostic, but the router/main
boundary still returns a structured failure so tests can prove that no fallback score
event or held-note debt was created. This preserves the constitution's explicit
failure-contract requirement without contradicting the interaction requirement.

**Alternatives considered**:

- Shared visible routing diagnostic: rejected by the clarified specification.
- Swallow failures at IPC and always return success: rejected because it would hide
  engine and validation failures from deterministic tests and break held-note safety.

**Decision**: Give renderer focus, router held notes, and the compiled target catalog
independent lifetimes. Blue Live stop/restart clears held notes and the old catalog,
but does not clear the current project's focused identity. Project replacement clears
all three authorities before new notes can route.

**Rationale**: Focus describes the user's current project editing intent, while held
notes and runtime instrument identifiers belong to one engine generation. Keeping the
focus through stop/restart makes auditioning stable; reconciling it against the current
project snapshot and newly installed catalog prevents stale identities from routing.

**Alternatives considered**:

- Clear focus whenever Blue Live stops: rejected by the clarified restart behavior.
- Preserve held notes across restart: rejected because late note-off events could
  cross engine generations and create stuck or misrouted notes.
- Persist focus in project XML or settings: rejected because focus is session-only.

### Additional code findings

**Decision**: Export an immutable compiled MIDI-target catalog from the same
`BlueData.toBlueLiveCSD()` pass that creates the active CSD, then install that catalog
atomically in `BlueLiveEngineSession`.

**Rationale**: `createRenderSnapshot()` already calls
`Score.prepareTrackInstruments()`, so Track instruments already participate in Blue
Live CSD generation. The earlier seed correctly identified the missing Track map but
did not note that the CSD result currently returns only text, parameters, and string
channels. Returning the exact Track and Orchestra identities compiled into that CSD
prevents later canonical project edits from being mistaken for live-session state.

**Alternatives considered**:

- Re-run Track traversal inside `triggerNote()`: rejected because it could observe a
  different project revision and cannot recover the runtime instrument numbers chosen
  by the live compilation.
- Parse Track identity from generated orchestra text: rejected because generated CSD
  intentionally does not encode stable project Track IDs.
- Retain only `BlueData` and infer availability on every trigger: rejected because the
  active engine session, not the subsequently edited project document, is authority
  for which instruments are compiled.

**Decision**: Add an explicit renderer-owned focused-MIDI-target store rather than
reuse the ScoreObject selection store or `OrchestraPanel`'s component-local selection.

**Rationale**: Score selection currently owns ScoreObject multi-selection and editor
routing, while Orchestra selection is local React state. Neither can express the last
eligible target across both panels. A narrow session store is the single authority for
routing mode and performance focus without changing editor-selection semantics or
project persistence.

**Alternatives considered**:

- Infer Track focus only from `selectedObjectTarget`: rejected because empty Tracks,
  Track headers, and instrument controls have no selected ScoreObject.
- Lift Orchestra state only into `project-store`: rejected because `project-store`
  mirrors canonical document state and performance focus is transient UI state.
- Use whichever workbench panel has DOM focus: rejected because interacting with the
  Virtual Keyboard itself would steal the target.

**Decision**: Resolve a target only when note-on is accepted, store that target on the
held note, and aggregate by `(target identity, MIDI note)` while retaining the existing
source key `(source, channel, note)`.

**Rationale**: A matching note-off must return to the original instrument even if
focus or routing mode changes. Target-aware aggregation allows identical notes on
different Tracks or Orchestra assignments to sound independently while preserving the
existing multi-source reference count for the same target.

**Alternatives considered**:

- Re-resolve focus on note-off: rejected because it can release the newly focused
  instrument and leave the original note stuck.
- Put target identity into the source key: rejected for the first slice because raw
  MIDI supplies no target on note-off and repeated note-ons for one source key remain
  intentionally idempotent.
- Release all notes on every focus change: rejected because it interrupts sustained
  notes and is unnecessary when the original target is retained.

**Decision**: Keep `target` optional on the shared Blue Live note request and interpret
an omitted target as the existing channel route.

**Rationale**: This preserves existing internal callers and tests while allowing the
router to send explicit Track, Orchestra, or channel targets. The incoming channel
remains present for project MIDI mapping and source-ledger semantics even when it does
not select the instrument.

**Alternatives considered**:

- Replace `channel` with the target union: rejected because hardware/Virtual Keyboard
  mapping and compatibility tests still require the original channel.
- Require every caller to migrate atomically: rejected because an optional field gives
  a safer typed compatibility bridge without weakening main-process validation.

**Decision**: Carry the current Blue Live `sessionId` on focused router requests and
retain it with held-note state; main rejects a supplied ID that does not match the
active engine generation.

**Rationale**: Renderer cleanup prevents new work at a lifecycle boundary but cannot
by itself cancel an IPC request already queued for main. `BlueLiveStatusSnapshot`
already exposes a monotonically changing session ID, so reusing it adds a narrow
generation fence without another authority or transport. A note-off uses the same
generation captured by note-on and therefore cannot release an identically named
target in a replacement session.

**Alternatives considered**:

- Depend only on `releaseAll()`: rejected because it does not revoke an in-flight IPC
  request.
- Generate a second renderer-owned token: rejected because Blue Live main already owns
  the lifecycle generation and duplicate tokens could diverge.
- Make the field immediately mandatory for every caller: rejected because optional
  validation preserves existing direct-channel callers while the shared router always
  supplies the fence for the new path.

## 1. Problem statement

Blue Live today is driven by the Virtual Keyboard and hardware MIDI input, both of
which target an instrument by **MIDI channel (0–15)**. Spec 066 introduced canonical
**Tracks**, each owning zero or one embedded instrument. Tracks are *not* addressable
by the Virtual Keyboard or by hardware MIDI — there is no live-trigger path that
reaches a Track instrument.

This research answers two questions for Spec 067 planning:

1. How do modern DAWs (Logic Pro, Ableton Live, REAPER, Cubase, Ardour) route
   Virtual Keyboard / MIDI input to instruments — by channel, by focus, or both?
2. What are the precise engineering seams in blue-electron that a Track-targeting
   feature must touch, given the Spec 066 Track model?

A separate Gemini report proposed a dual-mode "Track Focus + Direct Channel" model.
This document validates that direction against the DAW evidence and the actual
codebase, and corrects the engineering details where the report was imprecise.

## 2. DAW survey (how targeting actually works)

### 2.1 The universal pattern

Across Logic, Ableton, REAPER, Cubase, and Ardour, MIDI routing has **two orthogonal
axes**, not one:

| Concern | Where it lives | Default |
|---|---|---|
| "Which instrument plays?" | Track **focus** (selected / record-armed) | **Selected or armed track** |
| "Which MIDI channel?" | Track **input filter** | Omni / All Channels |
| Multi-timbral split | Opt-in project setting or per-track input channel | Off |

**The on-screen / computer keyboard is routed through a selected, armed, monitored,
or explicitly patched Track rather than using a global channel as the sole instrument
selector.** MIDI channel is a *secondary, track-level input filter* used for
multi-timbral setups. REAPER makes the virtual keyboard an explicit Track input;
Logic and Cubase use selected-track behavior; Ableton combines Track arming/monitoring
with per-Track input routing.

Blue's current model is the opposite: the Virtual Keyboard's 1–16 channel selector is
the *only* targeting mechanism. That places Blue in the multi-timbral corner of the
design space, presented as the sole option.

### 2.2 Per-DAW detail

#### Logic Pro
- **Musical Typing (⌥⌘K) and all incoming MIDI go to the *selected* track**,
  regardless of which track is record-armed. Long-documented and frequently
  complained-about: *"By default, Logic channels ALL incoming MIDI, no matter the
  source, to the selected track, which then sends it to the instrument on that
  track."*
- **Channels only matter when you opt in.** `File → Project Settings → Recording →
  "Auto Demix by Channel if multitrack recording"` distributes incoming MIDI to armed
  tracks by channel — the multi-timbral case.
- **Logic 10.7+ added per-track MIDI Input Port + Channel filtering** in the Track
  Inspector, so a specific controller can be pinned to a specific track.

#### Ableton Live
- **The Computer MIDI Keyboard (typing A–K) plays the currently armed/selected MIDI
  track.** Arming the track routes the input in.
- **Track input defaults to "All Ins / All Channels"** (merged signal of all
  channels). The Input Channel chooser lets you restrict to a specific channel.
- **Multiple tracks can be armed simultaneously**, each with its own input/channel
  setting — the multi-timbral case.

#### REAPER
- **The Virtual MIDI Keyboard (Alt+B) is itself a MIDI *input source*.** You set the
  target track's input to `Input: MIDI → Virtual MIDI Keyboard → All Channels` (or a
  specific channel), then **record-arm the track**.
- Channel selection is per-track and per-input-source, not a global property of the
  keyboard.

#### Cubase
- **The On-Screen Keyboard (Alt/Opt+K) plays the selected MIDI/Instrument track.**
- The **Track Inspector's Routing section** configures the MIDI input device and
  channel for that track.

#### Ardour
- Ardour has **no first-class built-in virtual keyboard**; users run one (e.g. VMPK)
  which appears as a virtual ALSA/CoreMIDI/JACK port.
- Routing is **explicit via the connection matrix**: track input → virtual keyboard
  port, track output → instrument. There is also an editor preference
  "Sound MIDI notes as they are selected."

### 2.3 Sources

- Logic Pro — selected-track routing: [GearSpace](https://gearspace.com/board/electronic-music-instruments-and-electronic-music-production/1115355-logic-pro-any-way-stop-usb-instruments-triggering-currently-selected-track.html), [LogicProHelp](https://www.logicprohelp.com/forums/topic/111962-playing-midi-instruments-wo-selecting-the-track/)
- Logic Pro — Auto-Demix by Channel: [ModWiggler](https://www.modwiggler.com/forum/viewtopic.php?t=70488), [Divisimate quickstart](https://divisimate.com/get-started/daw-quickstarts/divisimate/?daw=logic-pro)
- Logic Pro — MIDI Input Port/Channel filtering: [Apple Support](https://support.apple.com/ar-eg/guide/logicpro/lgcp7aa2eb86/mac)
- Ableton Live — Routing and I/O (Input Channel chooser, All Channels): [Ableton manual](https://www.ableton.com/en/manual/routing-and-i-o/), [Seed to Stage](https://seedtostage.com/setting-up-your-midi-controller-for-ableton-live/)
- REAPER — Virtual MIDI Keyboard input routing: [ProMixAcademy](https://promixacademy.com/blog/how-to-use-virtual-keyboard-in-reaper/), [Cockos forum](https://forums.cockos.com/showthread.php?t=108855)
- Cubase — On-Screen Keyboard: [Steinberg Cubase Pro 15 docs](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/virtual_keyboard/virtual_keyboard_about_c.html), [Steinberg forum](https://forums.steinberg.net/t/alt-k-onscreen-keyboard-does-not-work-anymore/987955)
- Ardour — virtual keyboard patching: [Ardour discourse](https://discourse.ardour.org/t/adding-a-virtual-keyboard-to-ardour/87491), [Ardour discourse — patching MIDI](https://discourse.ardour.org/t/how-to-patch-midi-tracks-to-a-hardware-or-virtual-instrument/110550)

## 3. How Blue does it today (codebase evidence)

### 3.1 Channel is an *array index*, not a channel-match

The decisive code is in the Blue Live engine session:

```ts
// packages/blue-app/src/main/blue-live-engine.ts:591-595
const arrangement = projectData.getArrangement().getArrangement();
const assignment = arrangement[request.channel];   // channel used as ARRAY INDEX
if (!assignment) {
  return { ok: false, message: 'No instrument mapped to that channel' };
}
```

`request.channel` (0–15) indexes into the sorted `InstrumentAssignment[]`. It works
today only because arrangements are typically numbered `1, 2, 3…` and kept sorted, so
index order ≈ channel order.

> **Latent fragility worth flagging in any redesign:** `arrangement[0]` is MIDI
> channel 0 and returns the first assignment *regardless of that assignment's
> `arrangementId` string*. The mapping is implicit (depends on sort order and
> numbering), not a configured routing table. A redesign should make the target
> explicit rather than relying on array-index coincidence.

References: [`arrangement.ts:19-161`](../../packages/blue-data/src/arrangement.ts),
[`instrument-assignment.ts`](../../packages/blue-data/src/instruments/instrument-assignment.ts),
trigger path [`blue-live-engine.ts:581-625`](../../packages/blue-app/src/main/blue-live-engine.ts),
pitch/velocity mapping [`midi-trigger-routing.ts:46-123`](../../packages/blue-data/src/midi/midi-trigger-routing.ts).

### 3.2 Virtual Keyboard

- The Virtual Keyboard's **only targeting state is `channel` (0–15)**, set via a 1–16
  number input. ([`useVirtualKeyboardState.ts:43-62`](../../packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/useVirtualKeyboardState.ts),
  [`VirtualKeyboardPanel.tsx:182-196`](../../packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx))
- Notes are emitted through the shared router via `routeVirtualKeyboardNote(...)`
  (gated on Blue Live `loaded && running`); two emit sources: `'mouse'` and
  `'computer'` (QWERTY). ([`use-midi-input-service.ts:198-244`](../../packages/blue-app/src/renderer/hooks/use-midi-input-service.ts))

### 3.3 MIDI Note Router

- `MidiNoteRouter` is the single ingress shared by hardware and the Virtual Keyboard
  (Spec 058). Its **held-note ledger is keyed by `(sourceId, channel, midiNote)`**.
  ([`midi-note-router.ts:52-58`](../../packages/blue-app/src/renderer/services/midi-note-router.ts))
- It is source-ref-counted: a note-on forwards only when the aggregate count for
  `(channel, midiNote)` is 0; a note-off forwards only when the count returns to 0.
- It forwards accepted notes via a `BlueLiveTriggerFn` carrying `channel`, `midiNote`,
  `velocity`, source ids, and timestamp — **no `trackId` or `instrumentId`**.
- `releaseSource` / `releaseAll` provide deterministic held-note cleanup on device
  disconnect, Blue Live stop, project change, or shutdown.

> **Implication for Track targeting:** the aggregate ledger must be re-keyed on a
> *target identity* (track id or resolved instrument id), not raw channel, because
> Tracks can outnumber the 16 MIDI channels. Otherwise two different targets that
> resolve to the same channel would collide in the ref-count logic.

### 3.4 Trigger request type

`BlueLiveNoteTriggerRequest` (`packages/blue-app/src/shared/project-editor.ts:1330-1342`)
carries `type`, `midiNote`, `velocity`, `channel`, `source`, optional
`sourceId`/`deviceId`/`timestamp`. **There is no target field beyond `channel`.** IPC
chain: renderer → `window.blueAPI.triggerBlueLiveNote(request)`
([`preload.ts:481`](../../packages/blue-app/src/preload/preload.ts)) →
`ipcMain.handle('blue-live:trigger-note', ...)` ([`main.ts:2526-2532`](../../packages/blue-app/src/main/main.ts))
→ `blueLiveSession.triggerNote(request)`.

### 3.5 Hardware MIDI input

`MidiInputService` ([`midi-input-service.ts:345-393`](../../packages/blue-app/src/renderer/services/midi-input-service.ts))
decodes raw bytes in the renderer, computes `channel = status & 0x0f`, builds a
`MidiNoteEvent` (`sourceKind: 'hardware'`, `sourceId: 'midi:<port-id>'`), and calls
`routeNote`. Per-device durable preferences live in main-process
`program-settings.json` (Spec 058); raw `MIDIAccess` never crosses IPC.

### 3.6 Tracks (Spec 066) and their relationship to instruments

- **A Track owns zero or one embedded instrument.** Spec 066 Clarification
  2026-08-01: "The Track owns an independent embedded copy of the instrument."
  ([`track.ts:43-110`](../../packages/blue-data/src/score/track/track.ts))
- **There is NO MIDI channel field on Track.** Grep for `channel`/`midiChannel`/
  `midiTrigger` in `track.ts` and `track-layer-group.ts` returns zero matches. Tracks
  are addressed exclusively by a stable `uniqueId` (UUID).
- **Track instruments are not in the project Arrangement.** They are appended to the
  disposable **render** arrangement at compile time via
  `Score.prepareTrackInstruments`, which registers each under the compile-variable key
  `track-instrument:<trackId>` → numeric runtime id.
  ([`score.ts:75-89`](../../packages/blue-data/src/score/score.ts),
  [`compile-data.ts:145-164`](../../packages/blue-data/src/compile-data.ts))
- **There is currently no live-trigger path that reaches a Track instrument.**
  `triggerNote` only consults `projectData.getArrangement()`. Spec 066 *explicitly
  deferred* "a Blue Live track/scene launcher," so this is net-new work on top of a
  deliberately-prepared foundation (stable Track ids, the `track-instrument:<id>` map,
  one-instrument-per-Track).

### 3.7 Not-to-confuse: dormant LiveObject MIDI metadata

`LiveObject._midiTrigger` and `_keyTrigger` ([`live-object.ts:15-16,
40-46`](../../packages/blue-data/src/live/live-object.ts)) are **preserved but
inactive** (Spec 065 FR-021). They are unrelated to Track targeting and must not be
treated as a Track-MIDI feature.

## 4. Assessment of the Gemini report

Gemini's **core thesis is correct and well-aligned with the DAW evidence**: focus /
arming is the standard paradigm; channel-based routing is the multi-timbral exception;
Blue should adopt a dual-mode model. The DAW comparison table is broadly accurate.

Corrections / sharpening based on the actual code:

1. **"Notes are routed … matching instrument assignments in the orchestra" is
   imprecise.** The channel is used as an *array index* into the arrangement list, not
   matched against a channel property of an assignment. The mapping is implicit and
   fragile (depends on sort order and numbering), not a configured routing table. Any
   redesign should make the target explicit.
2. **The Track-instrument resolution problem is under-specified.** Track instruments
   do not live in the project Arrangement — they are registered into the *render*
   arrangement at compile time. To target a Track you must capture the
   `track-instrument:<id> → runtimeId` map at Blue Live start / recompile (analogous
   to how `namedInstrumentNumbers` is already captured in the session). That is the
   real engineering seam; the report's "IPC & Router Update" bullet glosses over it.
3. **The held-note ledger re-keying (channel → target id) is a real concern** when
   tracks can exceed 16; the report does not mention it.
4. Gemini's **recommendation order is right**: Track-focus as default, explicit
   channel as opt-in, per-track MIDI input config as a later expansion. That matches
   Logic 10.7 / Ableton / REAPER / Cubase exactly.

Net: Gemini was a sound directional seed; the corrections and independent decisions
above are the engineering details adopted by this specification and plan.

## 5. Planned architecture

A three-tier product model mirrors the DAW precedent and reuses the Spec 066 groundwork:

### Tier 1 — Focused-target mode (new default)
Hardware MIDI and the Virtual Keyboard share the last explicitly focused eligible
Track or Orchestra assignment. Track focus resolves through the
`track-instrument:<trackId> → runtimeId` mapping captured by Blue Live compilation;
Orchestra focus resolves the exact compiled assignment identity. The Virtual Keyboard
header shows the routing mode and human-readable target. Focus changes affect new
note-ons only; held notes retain the target that accepted their note-on.

### Tier 2 — Explicit channel mode (today's behavior, preserved)
The shared routing mode can switch both sources back to the existing 1–16 channel
behavior for multi-timbral / classic-Csound-orchestra use. This slice preserves the
current compatibility mapping rather than redefining channel semantics. Unmapped
channels fail closed and silently without falling back.

### Tier 3 — Per-track MIDI input configuration (future expansion)
Let each Track declare its input source (focus / channel N / omni) and input channel
filter, mirroring Logic 10.7's Track Inspector, Ableton's Input Channel chooser, and
REAPER's per-track input. This is where hardware-controller multi-timbral routing
naturally lands.

## 6. Engineering seams (dependency-ordered)

For implementation:

1. **Trigger request discriminator.** Extend `BlueLiveNoteTriggerRequest` with an
   optional Track/Orchestra/channel target union and optional Blue Live session ID.
   Omission retains channel-mode compatibility for existing callers; the shared router
   supplies both fields.
2. **Compiled target catalog.** Return Track and base-Orchestra identities with their
   runtime instrument IDs from the same `toBlueLiveCSD()` snapshot, then install the
   validated catalog atomically in the Blue Live session. Track instruments live in
   the render arrangement, not `projectData.getArrangement()`.
3. **Router ledger re-keying.** Re-key `MidiNoteRouter`'s aggregate ledger on the
   *target identity* rather than raw channel, retain the resolved target on each held
   source note together with the Blue Live session ID, and clear only held state at
   Blue Live generation boundaries.
4. **Virtual Keyboard UI.** Add a focus/channel toggle to `VirtualKeyboardPanel`,
   backed by one renderer-session MIDI routing store. Show the focused target name but
   no error message for rejected input.
5. **Selection wiring.** Explicit Track interactions and explicit Orchestra assignment
   selection update the dedicated focus store. DOM focus and automatic editor fallback
   selection do not change performance focus.
6. **Out of scope for the first slice (recommend deferral):** per-track MIDI input
   source config, hardware multi-timbral channel routing to Tracks, CC/pitch-bend/
   aftertouch/program-change (already deferred by Spec 058 FR-026), and any re-use of
   the dormant `LiveObject._midiTrigger` metadata.

## 7. Key file:line index

- Virtual Keyboard channel state: `packages/blue-app/src/renderer/components/workbench/panels/virtual-keyboard/useVirtualKeyboardState.ts:43-62`
- Virtual Keyboard emit + selector: `packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx:59-91, 182-196`
- VK → router bridge: `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts:198-244`
- Router target keys: `packages/blue-app/src/renderer/services/midi-note-router.ts:52-58, 98-160`
- Hardware decode: `packages/blue-app/src/renderer/services/midi-input-service.ts:345-393`
- IPC note trigger: `packages/blue-app/src/preload/preload.ts:481`, `packages/blue-app/src/main/main.ts:2526-2532`
- Legacy channel→instrument lookup (heart of current model): `packages/blue-app/src/main/blue-live-engine.ts:581-625` (esp. 591-607)
- Pitch/velocity mapping: `packages/blue-data/src/midi/midi-trigger-routing.ts:46-123`
- Arrangement / InstrumentAssignment: `packages/blue-data/src/arrangement.ts:19-161`, `packages/blue-data/src/instruments/instrument-assignment.ts:9-58`
- Track model (no channel; owns instrument): `packages/blue-data/src/score/track/track.ts:43-110`
- TrackLayerGroup: `packages/blue-data/src/score/track/track-layer-group.ts:15-93`
- Track instrument compile registration: `packages/blue-data/src/score/score.ts:75-89`
- Compile-variable map for tracks: `packages/blue-data/src/compile-data.ts:145-164`
- Dormant LiveObject midiTrigger (not this feature): `packages/blue-data/src/live/live-object.ts:15-16, 40-46`
- Object/scene trigger controller (Spec 065, separate path): `packages/blue-app/src/main/blue-live-trigger-controller.ts:105-258`

## 8. Spec scope alignment

Spec 066 explicitly deferred "A Blue Live track/scene launcher." Spec 065 explicitly
forbade inferring track/scene semantics from the legacy row/column model. The Track-
targeting feature described here is therefore **net-new work against the post-066
baseline**; the design groundwork needed for it (stable Track `uniqueId`, render-time
`track-instrument:<id>` map, single Track instrument per Track) is already in place.

## 9. Java reference re-check (T002)

Re-read the Java sources under `/Users/stevenyi/work/nbprojects/blue` to capture the
exact channel, note, velocity, and all-notes-off behavior Spec 067 must preserve. The
UI files delegate to a shared broadcast hub; the score-text logic lives in
`blue-core`'s `MidiInputProcessor`, not in the UI panel.

### Channel → instrument routing

`blue-ui-core/.../midi/MidiInputEngine.java` is a singleton `Receiver` registered once
globally (`blue/ui/core/Installer.java`). Its `send(MidiMessage, long)` reads the
0-based MIDI channel from the `ShortMessage` and resolves the instrument purely as an
**arrangement array index**:

```java
int channel = shortMsg.getChannel();                       // line 78
if (processor == null || arrangement == null
        || channel >= arrangement.size()) { return; }      // line 82 — silent drop
String id = arrangement.get(channel).arrangementId;        // line 86
```

There is no channel-match, no per-device filter, and no focus concept; channel N always
targets arrangement slot N. Messages whose channel exceeds the arrangement length are
silently dropped — the same fail-closed behavior the TypeScript port replicates via
`arrangement[request.channel]`.

### Note-on / note-off score text

`MidiInputEngine.send` delegates to `blue-core/.../midi/MidiInputProcessor` (separate
file from the UI), which formats the score events:

- noteOn: `i<id>.<paddedNote> 0 -1 <processedKey> <processedVelocity>`
  (`MidiInputProcessor.NOTE_FORMAT`, lines 36-37, 123-125)
- noteOff: `i-<id>.<paddedNote> 0 0`
  (`MidiInputProcessor.NOTE_OFF_FORMAT`, lines 39-40, 128-129)
- `NOTE_ON` with velocity 0 is reinterpreted as a note-off (lines 92-97).

`getNoteOn(id, noteNum, noteNum, velocity)` passes the same value as both the padded
note id and the key passed to `processKey`; with the default PCH mapping the key becomes
`oct.pch` rather than a raw MIDI number.

### Padded note number

`MidiInputProcessor.getPaddedNoteNum` (lines 109-120) pads to three characters, but the
inner branch appends the literal character `'1'` (not `'0'`). Net effect:

- notes 10-99 → `0` + value (e.g. `060`)
- notes 100-127 → unchanged (e.g. `120`)
- notes 0-9 → `01` + value (e.g. `010` … `019`, **not** `000` … `009`)

The TypeScript `BlueLiveEngineSession.getPaddedNoteNum` already replicates this quirk, so
Spec 067 must keep it unchanged when generating target-specific score events.

### Velocity handling

`MidiInputEngine.send` forwards `shortMsg.getData2()` to `getNoteOn(...)` as velocity;
note-off does not carry velocity. Default mappings are PCH for key and MIDI for
velocity (`MidiInputProcessor` lines 42, 44).

### Virtual Keyboard channel/octave/velocity

`VirtualKeyboardPanel` (`blue-ui-core/.../midi/VirtualKeyboardPanel.java`):

- `channel` field default `0`, range 0-15 (0-based internally). The 1-based display and
  spinner live in `VirtualKeyboardTopComponent` (spinner model `1..16`, converted with
  `-1`/`+1` on lines 56-58 and 71-72).
- `octave` default `5`, range 0-7; computer-key index formula
  `((octave * 12) + index) - 21` (line 572).
- `velocity` default `127`; mouse derives velocity from `127 * y / height` (line 92),
  computer keyboard uses `127` (or the fixed velocity when override is on, line 586),
  and note-offs always use the fixed `velocity` (line 128).

### All Notes Off

`MidiInputEngine` keeps **no** held-note state and provides **no** all-notes-off. The
only all-notes-off is `VirtualKeyboardPanel.allNotesOff` (lines 270-287): it iterates
the 88 `keyStates` flags, and for each held key emits a `NOTE_OFF` on the **current**
channel using the fixed velocity. It does not remember the channel a note started on.

`VirtualKeyboardTopComponent.componentOpened/componentClosed` are empty stubs; closing
the keyboard window does not release held notes. The TypeScript Spec 058 router owns the
stronger source-scoped cleanup that Spec 067 must keep target-aware.

### Preserved divergence

These Java behaviors are the compatibility surface Spec 067 keeps in Direct Channel
mode and does not change: 0-based internal channel with 1-based display, the asymmetric
padded-note formatting, the `i<id>.<paddedNote> 0 -1 …` / `i-<id>.<paddedNote> 0 0`
score shapes, default octave 5 / velocity 127, silent drop for out-of-range channels,
and panel-driven all-notes-off. Focused-target routing is the intentional
TypeScript-only divergence named in the spec; it reuses the same score-event shapes but
selects the runtime instrument by compiled target identity rather than arrangement index.

## 10. Post-implementation audit (T038)

Verified after Spec 067 implementation against the constitution and project constraints.

### Portable-data boundary (`@blue/data`)

- `CompiledMidiInstrumentTarget` and `CompileData.getCompiledMidiInstrumentTargets()`
  use only static ES imports — no `require()`, no dynamic `import()`, no inline
  import types, and no Node/Electron/DOM APIs. Confirmed by grep across
  `compile-data.ts` and `blue-data.ts`.
- The catalog is produced from the same disposable render snapshot as the CSD text
  (`baseArrangementItems` + `compileData.getTrackInstrumentIds()`) and is returned as
  derived output only. `toBlueLiveCSD()` does not mutate the canonical `Arrangement`;
  the no-mutation and no-XML-write assertions are pinned by the portable-data tests.

### Canonical owners and disposable state

- Electron main owns `BlueData`, the active Blue Live session id, and the compiled
  target catalog (`targetCatalog` installed atomically on successful start, cleared on
  cleanup). The renderer's `MidiRoutingState` owns the transient mode/focus; the
  `MidiNoteRouter` owns held notes and target-aware aggregation. No owner crosses its
  boundary.

### No persistence changes

- No XML, `program-settings.json`, library database, or other durable state is written
  by this feature. Focus, held notes, and the compiled catalog are all transient and
  session-fenced. `.blue` XML round-trip is unchanged (asserted by the no-XML-write
  tests).

### No dormant LiveObject trigger coupling

- The focus-routing path does not read or write `LiveObject._midiTrigger` /
  `_keyTrigger`. Target resolution uses only the compiled catalog and the request
  target; the separate Spec 065 object-trigger path is untouched.

### Intentional divergences

- Focus-target routing is the new app-session default (Java Blue exposes channel
  routing only). Direct-channel mode preserves the Java-compatible behavior. Track
  targeting has no Java equivalent because canonical Track instruments are a post-Java
  TypeScript feature. These divergences are named in `spec.md` and require no
  complexity exception.
