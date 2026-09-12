# Data Model: Channel Strip Layout and Fader Taper

## Persisted entities — unchanged

### Mixer channel

- **Identity**: Existing stable channel snapshot ID; source/subchannel/master ownership unchanged.
- **Gain**: Existing `level` in dB, with user-edit range -96..+12. -96 is finite attenuation, not mute.
- **Volume parameter**: Existing parameter identity, fixed value, automation enablement, points, time interpolation, and resolution metadata.
- **Routing**: Existing output channel name/identity and validation rules.
- **Chains**: Existing pre/post effects and sends with stable identities/order.
- **Owner/store**: Main-owned active BlueData, serialized in existing .blue representation. No taper fields or migration.

Deliberate gain edits continue to use the existing channel mutation semantics, including how level and fixed/automated parameter values relate. The UI must not reimplement parameter ownership or edit automation points. Render/load/save operations must not mutate any of these fields.

### Mixer presentation settings

Existing `enableMeters` and `meterProfileKey` remain project-owned and serialized. New projects and missing-field legacy projects retain feature 105 defaults. All five profile definitions retain their mapping, labels, references, measurement roles, and thresholds. These values never select a fader taper.

## Disposable view entities

### Fader mapping

One application-owned fixed mathematical rule, not a stored object or setting:

- `gainDb`: Input from canonical state or a current interaction preview.
- `fraction`: Derived upward position in [0,1].
- `unityFraction`: Derived value of the same function at 0 dB (approximately 0.702332).
- Mapping and inverse: Defined in [UI contract](contracts/channel-strip-ui.md).

Finite out-of-range values may clamp for display only; this never writes a corrected value back into the project. Non-finite preview input is rejected before runtime or project mutation. A malformed display input uses a deterministic bottom-position fallback without claiming its stored value has been repaired.

### Gain interaction draft

Owned by one mounted slider, discarded after settlement:

- `documentId`, `channelId`, `gestureId`, sender-monotonic `gestureSequence`, captured canonical `baseRevision`.
- `startGainDb`, `startFraction`, `startClientY`, and pointer ID.
- `previewGainDb` and `hasMoved`; canonical value remains unchanged during preview.
- Status: idle, previewing, finishing, or cancelling.
- References to pending preview acknowledgements and owner-document cleanup/settlement registration.

Transitions:

1. Idle → previewing on pointer start after the existing patch queue is settled; capture exact gain, document, revision, and pointer position. A failed/stale start creates no draft mutation.
2. Previewing → previewing on movement: derive bounded fraction and dB, update local draft, send a typed transient preview. Do not invoke the project patch writer.
3. Previewing → finishing on release with a changed final value: stop new input, close/drain preview work, commit one existing gain patch, flush/settle it, restore display and runtime authority to current canonical state, then return idle.
4. Previewing → cancelling on Escape, pointer cancellation/loss, owner-window blur/teardown, document replacement, or history settlement: close/drain previews, restore current canonical runtime gain, discard draft, return idle. Do not patch the document.
5. No movement or no net change follows the cancellation/no-op path without a durable commit. No-movement preserves even a gain with more decimal precision than the displayed readout.
6. A canonical publication with a newer revision during a draft cancels that draft conservatively. Cancellation uses current canonical gain, not a captured stale starting value. Finishing tracks its own commit settlement separately to avoid cancelling its acknowledged result.

Numeric text drafts remain local until Enter/blur accepts a finite value; Escape cancels. Pointer rounding never applies to text drafts or stored values. Keyboard edits are deliberate direct dB commits; their accessible value is dB rather than normalized travel.

### Local meter label layout

- Input: Existing profile definition, outer meter height, actual subheadline line height.
- Track geometry: Top inset 10 pixels, bottom inset 10 pixels, usable track height.
- Candidate references: Existing major ticks and their profile labels.
- Output: Visible label values and center-y positions after deterministic collision filtering.
- Owner/lifetime: The view; recomputed on profile, height, or font-metric changes. It does not consume telemetry or persist.

### Runtime preview gesture

Main owns a bounded current-document record tied to the originating renderer and channel. It records gesture identity/sequence, base revision, phase, and the active performance generations eligible to receive previews. It contains no independent durable gain. First preview establishes ownership; finish/cancel closes it. Renderer destruction/document replacement releases it. A competing gesture on the same channel rejects rather than silently taking control. One sequence high-water mark per sender prevents old messages reopening released gestures without retaining an unbounded history of gesture IDs.

Late updates cannot reopen a closed gesture. Existing reconciliation queues and generation fences remain the authority for engine writes. Terminal cancellation restores from current canonical state using the existing runtime reconciliation route, not from client-supplied restoration values. See [preview contract](contracts/mixer-gain-preview.md).

## History and compatibility invariants

- Previews, geometry, label thinning, profile rendering, and taper calculations create no dirty-state change or history entry.
- One changed pointer gesture → one `updateChannel` level patch → one semantic history entry.
- Gain, routing, profile, and visibility retain existing labels: `Set Channel Level`, `Set Channel Output`, `Set Meter Profile`, `Enable Meters`/`Disable Meters`.
- Undo/redo preserves channel and parameter identities, automation content, references, dirty-state baseline, and published state in every view.
- Automation interpolation remains in existing gain/parameter semantics; display positions do not become automation data.
- No changes to app settings, library databases, engine protocols, or Java runtime data structures.
