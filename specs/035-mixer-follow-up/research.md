# Research: Mixer Follow-Up

## Scope Disposition (2026-09-13)

The draft playback-aware and windowing-polish direction is withdrawn from
Spec 035. Realtime mixer metering and presentation are covered by Specs 104,
105, and 107; later window and editor behavior is covered by Specs 089 and
103. This research does not authorize new work in the withdrawn area. Any
future exploration must start in a new, explicit specification.

## Decision: Keep durable library persistence out of scope for this follow-up spec

**Rationale**: The user explicitly deferred SQLite and broader user-library storage redesign until a later initiative that can address effects, instruments, code, and similar libraries together. Spec 035 should improve the session-local workflow introduced in Spec 034 without inventing a one-off persistence model.

**Sources Reviewed**:

- User planning note captured during Spec 034/035 planning on 2026-05-01
- `/Users/stevenyi/work/blue-electron/specs/034-mixer-editor-core/spec.md`
- `/Users/stevenyi/work/blue-electron/specs/034-mixer-editor-core/research.md`

**Alternatives considered**:

- Add SQLite just for effects library follow-up work: rejected because it conflicts with the desired cross-library storage initiative.
- Save session-local mutations back to `~/.blue`: rejected because it would reintroduce the same early-risk behavior Spec 034 intentionally avoided.

## Decision: Focus the first follow-up on routing safety and advanced chain operations

**Rationale**: After the core Mixer panel exists, routing correctness and chain-editing ergonomics are the highest-value remaining gaps. Java Blue exposes combobox models and popup flows that prevent invalid destinations and support richer chain actions than the core slice needs.

**Sources Reviewed**:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/ChannelOutComboBoxModel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/SubChannelOutComboBoxModel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectsPopup.java`

**Alternatives considered**:

- Spend the first follow-up on visual polish only: rejected because routing mistakes are higher-risk than cosmetic gaps.

## Decision: Use import/export and reload as explicit library workflow improvements without implying persistence ownership

**Rationale**: Java Blue supports explicit effect import/export operations independent of automatic persistence. Those flows improve development usability while respecting the current no-save stance for the canonical user library path.

**Sources Reviewed**:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectsUtil.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/TransferableEffect.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectsLibraryDialog.java`

**Alternatives considered**:

- Leave the library workspace exactly as Spec 034 delivers it until persistence exists: rejected because reload, import/export, and session organization are useful now and do not commit the app to a storage backend.

## Deferred Beyond Spec 035

- Durable effects-library persistence
- Cross-library storage redesign for effects, instruments, code, and other user assets
- Any broader mixer automation or live-performance slice that goes beyond editor/workflow parity
