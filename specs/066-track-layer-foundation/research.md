# Research: Track Layer Foundation

## 1. Track concept and MVP scope

**Decision**: Model one Blue Track as a generic timeline row with one stable mixer source, zero or one embedded Blue instrument, and a direct ordered mixture of AudioClips and compatible SoundObjects. Do not add InstrumentClip, MIDI-clip, Track compatibility, or AudioLayer shadow models.

**Rationale**: REAPER's core track model allows audio and MIDI media on any track, while instruments are FX inserts rather than a separate track class. REAPER's API identifies the first virtual instrument in the FX chain as the track instrument, and modern REAPER supports additional FX/container complexity. Blue's MVP adopts the useful generic-track and stable-routing ideas but deliberately caps assignment at one Blue instrument. This provides the one-to-one arrangement/launcher foundation without importing REAPER's entire FX graph.

Sources:

- [REAPER About](https://www.reaper.fm/about.php) — tracks can contain and mix audio and MIDI, and instruments/effects are applied on tracks.
- [REAPER ReaScript API: `TrackFX_GetInstrument`](https://www.reaper.fm/sdk/reascript/reascripthelp.html) — the instrument is discovered as the first FX insert that is a virtual instrument.

**Alternatives considered**:

- Separate audio and instrument Track types: rejected because it recreates the current split and weakens launcher column identity.
- InstrumentClip wrapper: rejected because SoundObjects already provide editable note/event containers and the user explicitly wants to avoid duplicate models.
- Multiple Track instruments or an FX container: deferred because routing, ordering, bypass, and UI semantics exceed the MVP.

## 2. Java Blue reference and intentional divergence

**Decision**: Preserve the useful Java Audio Layer invariants—stable layer identity, per-layer mixer association, group-associated channel lists, audio playback instruments, mute/solo, height, automation, and ordered clips—while replacing the Java AudioLayer/AudioLayerGroup type boundary in TypeScript Blue. Keep NotationObject removed: it was never released as a supported Java Blue feature, and the TypeScript class was incomplete rather than a compatibility surface.

**Rationale**: The Java sources show that each `AudioLayer` owns the mixer association used by its generated playback instrument and each `AudioLayerGroup` owns the associated mixer ChannelList. These stable IDs can become Track and Track Layer Group IDs without rewriting mixer state. The new mixed Track/instrument behavior has no Java equivalent and newly saved Track XML is intentionally TypeScript-only, as approved by the project owner. Retaining or completing an unreleased NotationObject would introduce a new obligation rather than preserve Java compatibility.

Java references consulted:

- `blue-score-layers-audio-core/.../AudioLayer.java`
- `blue-score-layers-audio-core/.../AudioLayerGroup.java`
- `blue-score-layers-audio-core/.../AudioLayerGroupProvider.java`
- `blue-score-layers-audio-ui/.../AudioLayersPanel.java` and related UI bindings

**Alternatives considered**:

- Retain Java-compatible AudioLayer classes beside Track: rejected due to duplicate models and ongoing maintenance burden.
- Save Track data back as Audio Layers plus supplemental metadata: rejected because it creates two authorities and cannot represent mixed SoundObjects cleanly.
- Restore the incomplete TypeScript NotationObject: rejected because it was never a released Java Blue feature and has no supported persistence/authoring contract to preserve.

## 3. Historical project migration

**Decision**: Add an idempotent, structure-discriminated raw-XML migration that runs before model deserialization. It rewrites every `audioLayerGroup` to `trackLayerGroup` and every contained `audioLayer` to `track`, preserving existing group/layer attributes, IDs, clips, parameter IDs, order, and unrelated/unknown XML. New Track data is never converted back.

**Rationale**: Historical projects may carry Java Blue versions newer than the current TypeScript upgrader list, so a migration gated only by a legacy version threshold can miss valid `audioLayerGroup` data. The element names are the authoritative signal. Running once on structure is deterministic and naturally idempotent because canonical Track elements no longer match the legacy names.

**Alternatives considered**:

- Add a version-only `ProjectUpgrader_3_0_0`: rejected for this migration because it unnecessarily couples conversion to a Blue version bump and can mishandle files whose version metadata does not reflect their structure.
- Deserialize legacy classes and convert afterward: rejected because it retains the very compatibility runtime model the user wants removed and makes unknown XML preservation harder.

## 4. Canonical Track XML

**Decision**: Persist mixed contents directly and in order under each `<track>`, with `<audioClip>` and `<soundObject>` children alongside Track-owned `<noteProcessorChain>`, optional `<instrument>`, and existing `<parameterId>` references. Persist groups as `<trackLayerGroup>` with a `<tracks>` container.

**Rationale**: Direct heterogeneous children avoid a redundant clip abstraction and preserve exact display/compile ordering. The embedded instrument expresses independent ownership. Stable IDs remain on the same conceptual group/row that owned them before migration.

**Alternatives considered**:

- Separate `<audioClips>` and `<soundObjects>` lists: rejected because it loses one canonical item order and complicates equal-time hit testing and selection.
- Store an Orchestra assignment ID: rejected because Track instruments must be independent embedded copies, not shared references.

## 5. SoundObject placement capability

**Decision**: Make Track placement a required registration descriptor. Unknown or unclassified types are denied. AudioFile is explicitly denied because AudioClip is the canonical file-audio representation. PolyObject is explicitly denied because a Track is a leaf timeline row, not a host for another layer-group container. Existing built-ins receive the following initial classifications:

| Registered type | Track placement | Instrument-target behavior |
|---|---|---|
| GenericScore | Compatible | Marks its generated musical notes assignable |
| PolyObject | **Incompatible** | Use a SoundObject Layer Group; no create, paste, drag, or move into a Track |
| PythonObject | Compatible | Marks returned musical notes assignable |
| ClojureObject | Compatible | Marks returned musical notes assignable |
| JavaScriptObject | Compatible | Marks returned musical notes assignable |
| CSDSoundObject | Compatible | Preserves embedded/special CSD event identities; no override until it can declare safe events |
| Comment | Compatible | Generates no notes |
| AudioFile | **Incompatible** | Use AudioClip instead |
| Sound | Compatible | Preserves its generated BSB instrument event and routes it to the Track channel |
| External | Compatible | Marks parsed musical notes assignable |
| Instance | Compatible | Propagates referenced-object eligibility and applies Instance processing before the Track override |
| LineObject | Compatible | Marks its generated musical notes assignable |
| ZakLineObject | Compatible | Marks its generated musical notes assignable |
| PatternObject | Compatible | Marks its generated musical notes assignable |
| PianoRoll | Compatible | Marks all PianoRoll note events assignable |
| JMask | Compatible | Marks generated musical notes assignable |
| TrackerObject | Compatible | Marks generated musical notes assignable |
| FrozenSoundObject | Compatible | Preserves its audio-player instrument event and routes it to the Track channel |
| ObjectBuilder | Compatible | Marks generated musical notes assignable |

**Rationale**: Placement and p1 behavior are separate capabilities. This lets special or currently non-generating objects remain usable on a Track without blindly retargeting their support events. Instance remains compatible and propagates the referenced object's target behavior, so runtime-backed composition does not require nesting a PolyObject in a Track. A registry exhaustiveness test makes every future registration choose intentionally.

**Alternatives considered**:

- `instanceof AudioFile` checks in menus: rejected because paste, drag, move, and future types would drift.
- Allow all types by default: rejected because a newly registered special object could be silently compiled with unsafe semantics.

## 6. Instrument override and processor ordering

**Decision**: Replace the boolean fifth generation parameter with an optional `ScoreGenerationOptions` object shared by SoundObject and LayerGroup generation. It carries `processWithSolo`, Track mixer association, and optional runtime instrument override. Note-producing implementations mark only owned, safe notes as Track-assignable using nonserialized generation metadata. A Track generates one top-level object through all of that object's processors, replaces p1 only on marked notes, then applies the Track Note Processor Chain. The Track Layer Group aggregates Tracks, and the root Score chain runs last.

```text
top-level SoundObject generation
  -> nested/object Note Processor Chains and time behavior
  -> eligible p1 replacement at Track boundary
  -> Track Note Processor Chain
  -> Track Layer Group aggregation
  -> root Score Note Processor Chain
```

**Rationale**: This matches the chosen order while allowing leaf objects to distinguish normal musical notes from self-generated support instruments. Nonserialized note eligibility survives Instance/reference processing and never alters saved SoundObject data. A shared options object also removes the overloaded fifth-argument ambiguity between LayerGroup solo processing and SoundObject generation context.

**Alternatives considered**:

- Blindly rewrite every returned note: rejected because Sound, FrozenSoundObject, AudioClip, and future support events own special p1 values.
- Apply overrides inside each leaf immediately: rejected because outer Instance processing would then run after assignment, contrary to the selected top-level object-before-Track order.
- Add a separate Track-only generation method to every object: rejected because it duplicates the normal sync/async generation contract.

## 7. p1 replacement semantics

**Decision**: For eligible numeric p1 values, replace the integer instrument portion with the assigned runtime ID while preserving a negative sign and any fractional suffix. For eligible quoted/named p1 values, replace the whole authored identity with the numeric runtime ID. Malformed/empty p1 values are preserved and reported as a deterministic compilation diagnostic. The override affects generated Notes only, not saved SoundObject fields.

Examples for runtime instrument `12`:

| Authored p1 | Generated p1 |
|---|---|
| `1` | `12` |
| `1.25` | `12.25` |
| `-1.25` | `-12.25` |
| `"lead"` | `12` |

**Rationale**: Fractional and negative p1 forms may carry Csound instance/tie meaning beyond the base instrument number. Preserving those portions avoids erasing object-authored semantics while still changing the target instrument.

**Alternatives considered**:

- Replace the complete p1 string in all cases: rejected because it discards meaningful sign and fractional identity.
- Modify authored PianoRoll/GenericScore data: rejected because assignment is a render context, not an edit to the SoundObject.

## 8. Compilation registration order

**Decision**: Before Arrangement UDO, parameter, string-channel, ftable, global-score, and orchestra generation, traverse Track Layer Groups and Tracks in score order. Deep-copy each enabled assigned Track instrument into the already cloned render Arrangement, use the Track ID as its source/mixer association, and store `trackId -> runtimeInstrumentId` in `CompileData`. Use the same pre-registration helper in standard sync, standard async, disk, and any applicable long-lived render preparation paths.

**Rationale**: Track instruments must participate in every Arrangement compilation phase exactly once. Registering them only during score-event generation is too late for UDOs, parameters, strings, and ftables. Registering into the render clone keeps the project Orchestra and Track-owned instrument independent and prevents generated runtime IDs from entering project XML.

Track traversal must also participate in `BlueData` host-runtime dependency detection. A Track-contained Python/Clojure/ObjectBuilder/processor dependency or Python Track instrument must select the existing asynchronous host path exactly as the same object/instrument does in SoundObject Layers or Arrangement.

**Alternatives considered**:

- Compile Track instruments separately from Arrangement: rejected because it duplicates mature instrument generation, automation, UDO, ftable, and mixer processing.
- Add them during each Track's note generation: rejected because upstream compilation phases have already run.

## 9. Audio playback and mixer routing

**Decision**: Move AudioLayer's diskin/fade event and playback-instrument logic into Track-oriented compiler code. Generate at most one audio playback instrument per Track per render, and route both that instrument and the assigned Blue instrument through the channel whose association equals the stable Track ID. Reconcile exactly one source channel per Track under the group ChannelList associated with the Track Layer Group ID.

**Rationale**: Preserving group/layer IDs during migration lets existing channel effects, sends, levels, automation, and output routes remain attached. Association-first lookup is stable across renames; name fallback is recovery-only.

**Alternatives considered**:

- One mixer channel per object: rejected because it breaks the one-to-one Track premise.
- Route by Track name: rejected because renames and duplicate names are common and must not orphan mixer state.

## 10. Instrument control and editor window

**Decision**: Put the compact instrument control in each Track's left row header. Double-click an assigned control to open one non-modal child BrowserWindow per `{projectSessionId, rootGroupId, trackId}` using the existing effect editor's window-state/lifecycle and reusable `InstrumentEditorPanel` surfaces. The window has a parent and `alwaysOnTop: true`, but `modal: false`, so it stays visible while input can still go to the main window. Right-click provides `Use New Instrument` with Arrangement's five instrument factories, then Cut, Copy, and Paste. Unified Instrument Library drag/drop previews and applies a replacement onto the control. Every source is deep-copied into Track ownership.

**Rationale**: This is the interaction selected for the MVP and reuses established Blue behavior without blocking score or mixer input. Stable Track IDs plus required project session/revision fences let the floating editor refresh canonical state and close on removal/project switch instead of editing stale renderer state.

**Alternatives considered**:

- Modal child window: rejected because users need to continue interacting with the score and mixer while editing the Track instrument.
- Inline inspector/editor: deferred until the user evaluates the floating-window workflow.
- Single-click edit: rejected because it conflicts with selection and makes accidental editor opening likely.
- Instrument chooser dialog as the only assignment path: rejected because Arrangement-style creation, clipboard, and library drag/drop are already familiar and composable.

## 11. Program default

**Decision**: Add `projectDefaults.defaultLayerGroupType: 'TRACK' | 'SOUND_OBJECT'`, defaulting and normalizing to `TRACK`. `applyProgramSettingsToNewProject` replaces the constructor's seed group with a one-Track Track Layer Group or one-layer PolyObject as configured, and seeds the default height. Existing open projects are never rewritten by a settings change.

**Rationale**: Program settings already own new-project defaults. Applying the choice only during new-project construction avoids placing app settings in `.blue` XML or changing existing projects.

**Alternatives considered**:

- Change `Score`'s library constructor to always create Track: rejected because `@blue/data` should not own app-wide user preferences and tests/utilities may rely on a minimal PolyObject seed.

## 12. Timeline implementation strategy

**Decision**: Replace `AudioLayerGroupCanvas` with `TrackLayerGroupCanvas` that shares/extracts the existing SoundObject selection/context/library behavior and AudioClip move/resize/fade/slip behavior. Continue using the type-specific bar renderer and ScoreObject Editor/Properties selection routing. Track placement validation is centralized and used by add, paste, drag, and cross-group move.

**Rationale**: Two independent full canvases would duplicate hit testing, marquee, snapping, cross-group movement, clipboard, and automation logic. A mixed Track needs one gesture coordinator so overlapping AudioClips and SoundObjects have deterministic selection and ordering.

**Alternatives considered**:

- Render both existing canvases on top of one another: rejected because gesture ownership, marquee selection, z-order, and drops would conflict.
- Rewrite all bar renderers/editors: rejected because type-specific ScoreObject behavior already exists and should remain intact.

## 13. ScoreObject interaction parity

**Decision**: Track background Command/Control-click delegates to the same validated ScoreObject-buffer paste operation as Track context-menu paste. Track double-click opens the editor selected by the preceding pointer-down instead of selecting the object a second time. The ScoreObject Editor retains its current document while the next canonical document loads so React can reuse the same editor component and its transient viewport. Track and SoundObject timelines share one color chooser; right-click first selects the object under the pointer when necessary, matching Java's context-aware Set Color action. Section 17 defines the later persistent in-app picker used by every renderer color surface.

**Rationale**: Java Blue caches editors by ScoreObject class and updates the existing editor instance, while its Set Color action opens a chooser seeded from the first selected object and applies the result to the selection. Replacing the editor with a Loading card, redundantly selecting on Track double-click, using Electron's unsupported `window.prompt`, or hard-coding a color all break those interaction semantics. Reusing the existing paste and project-patch boundaries keeps these corrections renderer-local and avoids another state owner.

Java references consulted:

- `blue-ui-core/.../ScoreObjectEditorTopComponent.java`
- `blue-ui-core/.../SetColorAction.java`

**Alternatives considered**:

- Add a Track-only clipboard gesture implementation: rejected because context-menu paste already owns snapping and compatibility validation.
- Persist editor scroll in project state: rejected because scroll is transient UI state and same-type component reuse already preserves it.
- Use `window.prompt` for hexadecimal colors: rejected because Electron does not implement it and Java presents an actual color chooser.

## 14. Render-window origin parity

**Decision**: Preserve the existing two-stage SoundObject Layer behavior for Tracks: pass each SoundObject a local crop window, then apply one shared post-generation rebase from absolute score time to performance time. A Track applies the rebase only to its SoundObject NoteList and merges AudioClip playback notes afterward because the dedicated AudioClip generator already returns render-relative events.

**Rationale**: Java `SoundLayer` supplies child-local crop bounds and its root `PolyObject` subsequently subtracts the absolute render start. The Track implementation had ported only the crop stage, leaving PianoRoll and GenericScore events at absolute times such as 16 during a render beginning at 16. Sharing the rebase helper gives Track and SoundObject Layer sync/async paths one time-origin rule without double-translating AudioClip events.

Java references consulted:

- `blue-core/src/main/java/blue/SoundLayer.java`
- `blue-core/src/main/java/blue/soundObject/PolyObject.java`
- `blue-core/src/main/java/blue/score/Score.java`

**Alternatives considered**:

- Require every SoundObject to emit render-relative times: rejected because existing generators produce score-positioned events and the established container contract owns final translation.
- Rebase the complete Track result after AudioClip merge: rejected because Track AudioClip generation already subtracts the render start and would produce negative or early events.

## 15. Rapid Track instrument controls

**Decision**: Separate continuous Track BSB control feedback from durable editor persistence. Each gesture emits a validated transient runtime message addressed by project session plus stable Track Layer Group/Track IDs. Durable `InstrumentPatch` requests use one in-flight queue; consecutive pending last-value controls for the same target are coalesced, while non-coalescible edits retain order. A stale durable response includes the latest canonical Track instrument snapshot so the editor rebases and retries the same patch. Only a missing session, Track, or instrument makes the editor unavailable.

**Rationale**: The original detached editor launched every mouse-move patch independently with the same global project revision and awaited active-engine channel synchronization in each main-process handler. The first accepted patch advanced the revision, causing later in-flight patches from the same drag to be rejected as if another editor had changed the instrument. The established Arrangement editor already separates immediate runtime control messages from deferred canonical project patches. Applying that same split to Track instruments preserves one canonical `BlueData` owner while making slider/knob/XY/slider-bank feedback independent of disk-state acknowledgement latency. The engine client serializes channel requests, and the canonical editor queue prevents unbounded superseded durable writes.

The transient runtime target deliberately omits the project revision: it cannot mutate project state, and rejecting a gesture because an unrelated project edit advanced the global revision would make continuous controls unreliable. It still requires the exact project session and stable Track identities, and main resolves the currently owned BlueSynthBuilder before reading compiled channel metadata. Durable edits retain the full session/revision fence.

**Alternatives considered**:

- Remove revision validation from durable editor patches: rejected because an old or closing editor could then modify a replaced Track instrument.
- Debounce all Track changes before both playback and persistence: rejected because audible control feedback would inherit disk-state latency and fast gestures could sound stepped or stale.
- Launch all durable patches concurrently and suppress the error UI: rejected because it would hide dropped canonical values and leave queue growth/order unresolved.
- Add a second mutable Track-instrument model in the detached renderer: rejected because it would violate the main-owned canonical project boundary.

## 16. Continuous ScoreObject color picker updates

**Decision**: Treat one color-picker invocation as a continuous interaction. Capture the selected ScoreObject targets when Set Color opens, retain those targets for every edit emitted while the user changes the color, and submit each color to all captured targets together. Opening the picker again replaces the captured target set.

**Rationale**: Browser-native color inputs may emit many `input` events during one drag, while some platform implementations appear to emit only a final value. The previous handlers cleared their captured targets after the first event, so later drag values were silently ignored and the bug appeared intermittent across picker behavior. Retaining the invocation-scoped targets makes Track and SoundObject Layers deterministic, and dispatching all target patches together prevents one selected object from lagging behind another within the same color event.

**Alternatives considered**:

- Apply only the final committed color: rejected because it removes live color preview while editing.
- Re-read the current score selection for every input event: rejected because selection changes while the chooser is open would unexpectedly change which objects the original action edits.
- Clear captured targets after the first input event: rejected because native color controls explicitly support successive drag input and this was the source of the intermittent failure.

## 17. Shared persistent renderer color picker

**Decision**: Use one portal-rendered in-app color picker for timeline Set Color, ScoreObject Properties, automation, line definitions, and BSB properties. It offers preset, HSL-slider, and hexadecimal editing; remains open through repeated edits and another click on its current trigger; closes on an outside click or Escape; and chooses a viewport-clamped position above or below its anchor. Timeline Set Color anchors to the complete object row instead of the pointer so the picker cannot cover the edited object.

**Rationale**: A platform-native color input owns its own placement and dismissal behavior, which cannot guarantee either persistent multi-step editing or a visible timeline target. A shared portal gives every color surface the same deterministic interaction, allows live updates without losing the picker, and can measure the target and viewport before placement without introducing persistent state.

**Alternatives considered**:

- Reposition the platform-native chooser: rejected because the browser and operating system own that window and do not expose a placement contract.
- Keep native inputs outside timeline Set Color: rejected because the user requested the same persistent behavior for all color-picker uses.
- Add another picker dependency: rejected because preset, HSL, hexadecimal, dismissal, and placement behavior are small enough to implement with existing React/browser primitives.
