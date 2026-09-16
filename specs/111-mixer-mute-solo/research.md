# Research: Mixer Mute and Solo

Planning decisions resolved 2026-09-15. External conventions are documented in [precedents.md](precedents.md); these decisions describe Blue rather than claiming uniform DAW behavior.

## 0. T001 implementation reconfirmation (2026-09-15)

Re-checked the Java references against the implementation during `/speckit-implement`:
`AudioLayer`/`AudioLayerGroup` filter event generation through `processWithSolo`/`isSolo`/`isMuted`
(`AudioLayerGroup.generateForCSD`), and Java `Channel` stores `muted`/`solo` as persisted
properties that the Java mixer never enforces in audio generation. The TypeScript port matches
both behaviors; no new implementation-relevant divergence was found. The only intentional
divergences remain the ones named in the spec: TS realtime CSDs now emit mixer gate machinery
and new projects default `trackLayerMuteSoloMode` to Audio.

## 1. Master controls

**Decision**: Master is mute-only. Retain old master solo as inactive data; reject new master-solo patches. Other channel types share additive solo. Explicit mute wins; a muted-and-soloed channel remains selected but inaudible.

**Rationale**: The user accepted removing a control without useful current output-isolation behavior. REAPER's hardware-output isolation does not require Blue to provide master solo.

**Alternatives considered**: Ordinary bus solo would restore excluded sources. Output-isolation master solo is currently redundant. Manual solo-safe and per-send mute-follow preferences add unrequested scope.

## 2. Route selection and summed signals

**Decision**: A pure policy accepts detached nodes, ordered output/send edges, and explicit flags. For each explicit non-master solo s, select edges on paths reaching s and edges on paths leaving s. Union these edge sets across solos, without admitting other inputs merely because a downstream node is retained. With no solos, include all structurally enabled routes. Determine reachability through unmuted intermediate nodes and block every outgoing edge of a muted node. Discover explicit solos before removing muted paths, so a muted solo does not fall back to the full mix.

Use forward/reverse visited-set traversals, not path enumeration. An enabled send whose amount is zero remains a structural edge, since its amount can be automated. Disabled sends do not contribute. Preserve existing CSD order/cycle behavior; visited sets bound traversal, and cyclic or unresolved graphs are ineligible for pruning. No new feedback scheduling model is introduced.

**Rationale**: `packages/blue-data/src/blue-data/csd-policy.ts` emits sends inside applyEffectsChain. A whole-channel gate cuts feeds needed for wet-only return auditioning. Once inputs are summed into a bus, subsequent permitted outputs carry that combined signal; this is a physical limitation, now explicit in the spec.

**Alternatives considered**: Per-channel flags alone cannot isolate dry versus wet routes. Duplicating effects per source to reconstruct separate signals changes sound and cost. New topology validation/refactoring is outside scope; preserve current diagnostics and fall back conservatively for pruning.

## 3. Gates, effects, meters, and identity

**Decision**: Each send contribution and final channel output gets a separate gate. Gate a copy at the send tap, and final audio after post-effects. Keep the local signal/effects running. Gate final-output meters consistently. Master mute includes any master-owned sends and final output. Use a shared 5 ms transition ramp for changed gates, initialized at desired values; targets settle at exactly 0 or 1, and initial playback never leaks muted audio.

Extend RenderCsdResult with disposable mixerGateBindings. Runtime names use deterministic numeric ordinals under a reserved prefix, not channel display names. Main captures existing editor channel/entry IDs and compile locators before cloning, then attaches them to the catalog for that performance generation. Track association stays Track.uniqueId. Cover standard sync/async and BlueLive render paths; preserve the BlueData façade.

**Rationale**: Channel has no intrinsic durable UUID; editor IDs originate in `shared/project-editor/identity.ts`. Existing meter and BlueX7 catalogs establish a pattern for generation-scoped mappings. Mapping by names after a rename risks writing the wrong control.

**Alternatives considered**: Fader-to-minus-infinity changes gain/automation data; −96 dB is not silence. Skipping effects loses state. New persistent IDs are unnecessary. Broad extraction of the CSD generator is unnecessary.

## 4. Live publication and engine limits

**Decision**: Reuse EngineBridge.setChannels, BlueLiveEngine.setChannels and the existing batch-channels capability. Add one typed mixer-gates runtime work operation, capturing a complete detached target vector from the committed transition. Serialize publication per performance with document/revision/generation and topology guards.

`CsoundEngine::setChannels` validates before enqueue; RealtimeChannelMailbox applies batches between control cycles. Its maximum is 256 entries per batch and 128 queued batches. Emit two initialized gate banks, a commit token and an applied token. Bank index is commit token modulo two. Stage the full desired vector into the inactive bank in batches of at most 256; after every stage succeeds, publish a new monotonically increasing commit token. BlueMixer selects that bank consistently for the whole control cycle and echoes the token after selection. Do not reuse the old bank until the applied token is observed. For small vectors combine staging and commit when they fit one batch. No native protocol change is needed.

Enqueue acknowledgment is not audible application. Observe applied token with existing channel reads before marking runtime applied. Allow bounded queue-full retry only while current; missing capability, failure or stale generation produces an accurate runtime outcome. Preserve prior audible bank on failed staging. If commit acknowledgment is uncertain, inspect the applied token before retrying or reusing a bank. Start a new generation from canonical flags, not prior engine memory. Coalesce pending edits to the latest revision only when no older in-flight publication can overwrite it.

**Rationale**: A solo affects many routes and can exceed 256. Sequential audible writes expose intermediate mixes. The single-channel bridge logs some errors whereas batch calls preserve explicit success/failure.

**Alternatives considered**: Increasing native limits is unnecessary; one unlimited batch is invalid; restart violates the requested audio workflow. Computing graph reachability every audio cycle would move avoidable work into the performance loop.

## 5. Header modes and compatibility

**Decision**: Score owns trackLayerMuteSoloMode (audio/event), persisted only as an attribute on `<score>`. New constructor defaults Audio; XML absence defaults Event, including an absent score. The feature is unreleased, so no migration or fallback from the prerelease ProjectProperties location or score child is provided. Use Event for missing or unsupported values and write the resolved mode on save. Copy operations retain that mode. Existing unknown-data preservation remains authoritative.

Effective mode is Event when mixer disabled, otherwise preference. In Audio mode, Track groups neither contribute to global event-solo discovery nor obey track event flags or another group's event solo. Other groups retain their existing behavior. In Event mode Track groups participate as before. Extend Score's optional generation context and existing ScoreGenerationOptions while preserving legacy boolean callers. Never temporarily mutate Track flags.

Audio headers resolve canonical association and submit channel patches; Event headers use existing layer patches. Main validates expected mode/association against the revision so a stale header action cannot edit the wrong domain. No state copying on mode switch. Legacy active mute/non-master solo receives a non-blocking compatibility notice; master solo alone does not. Load provenance/diagnostics remain disposable.

**Rationale**: Java AudioLayerGroup checks event flags before generating audio clips. Current Score discovers solo globally; changing only local Track filtering leaves hidden coupling. Score.loadFromXML must distinguish the new-score Audio default from legacy Event absence. Java `blue-core/src/main/java/blue/score/Score.java:157–189` dispatches unknown children to layer-group loading but ignores attributes. Its save method at lines 144–154 does not retain unknown attributes: Java file loading remains compatible, but a Java save loses the mode attribute.

**Alternatives considered**: Copying flags destroys independent intent. Per-track mode was not requested. Converting instrument/sub/master flags to events on mixer bypass has no generally correct meaning.

## 6. Safe disk pruning and duration

**Decision**: Initially certify only projects using built-in AudioClip-only Tracks with empty score note-processor chains, no custom global orchestra/score, no authored always-on/track/orchestra instrument code with unknown side effects, no opaque enabled mixer effects, and no unknown executable extensions. Sends/faders may remain. Cycles, unresolved routing or any unknown influence disable pruning. Do not attempt to infer purity from arbitrary code.

Within this subset, prune a track only if no permitted route reaches output. Keep sources feeding soloed returns even when dry output is excluded. Master mute can make all tracks eligible. Effective event filtering remains unchanged and precedes optional audio pruning. Retain mixer execution and gates.

The CSD generator currently derives total duration from the NoteList. Capture an unpruned duration bound using the same AudioClip scheduling/window/tempo calculation before omitting events; share the calculation rather than generate and discard notes. Combine it with existing render-end, global duration and mixer extra-render-time behavior, including all-pruned output. Add a test/internal pruning-disable option for an unoptimized oracle, not a user setting. Sync/async paths share the policy.

**Rationale**: Silence is not proof of absence of shared-state effects. Pruning the longest clip must not shorten the export. A narrow proven subset is useful and preserves correctness for other projects.

**Alternatives considered**: Pruning every muted track can suppress scripts/control effects. Post-generation filtering saves playback but not generation work. Removing effect processing changes tails/state. Broader certification can follow evidence later.

## 7. Verification and Java reference

**Decision**: Use pure policy/XML tests, canonical ProjectHistory tests, browser controls, actual engine audio and latency checks. Java AudioLayer/AudioLayerGroup establish legacy event behavior; Java mixer Channel/MixerNode establish stored but unenforced audio flags. Audio gating is an intentional extension.

**Rationale**: String-only CSD assertions cannot prove sends, tails, duration or atomic live publication. Existing global-history-engine.integration.test.ts provides session setup and optional BLUE_ENGINE_PATH discovery for timeline/BlueLive.

**Alternatives considered**: UI-only tests miss history/runtime authority; arbitrary plugin renders do not provide deterministic equivalence oracles. No new dependencies or general-purpose routing framework are justified.
