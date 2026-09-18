# Audio Routing Contract

Applies when `score.panningEnabled === true`. For false, generate the established legacy route and ignore channel position.

## Layout and value

- `nchnls=1`: output one valid mono signal; no stereo pan stage or second output bus.
- `nchnls=2`: use the rules below.
- `nchnls>2` or source file channels `>2`: fail with a clear unsupported-layout diagnostic before launch. Unreadable file: fail with an input diagnostic.
- Actual file header channel count wins over cached `AudioClip.numChannels`.
- An enabled compile missing the host-supplied layout observation for a referenced file fails explicitly. It must not guess from clip metadata, including when the data compiler is called directly.
- Position `p` is finite in `[0,1]`: `0` hard left, `0.5` center, `1` hard right. User/automation out-of-range input is rejected; invalid XML falls back to center.

## Clip contribution

For a mono sample `x`, contribute `(x/√2, x/√2)` to its destination two-channel bus. For stereo `(L,R)`, contribute `(L,R)`. This happens before clips mix with one another. A mixed track therefore contains centered mono plus uncollapsed stereo. Mixer-disabled direct output follows this rule.

## Channel control

For a verified all-mono source channel whose input is the equal-power mono upmix of `x`, with no upstream stereo-generating effect, apply `sqrt(2)·cos(πp/2)` to its left bus and `sqrt(2)·sin(πp/2)` to its right bus. The resulting mono contribution is `(x·cos(πp/2), x·sin(πp/2))`: center is about −3.01 dB per side; endpoints are unity on the selected side. This is equivalent to Csound's standard two-channel equal-power pan law. Do not sum the two buses first.

For stereo, mixed, or unknown material, use balance gains: left `min(1, 2·(1-p))`, right `min(1, 2·p)`. Center leaves both sides at unity; each endpoint mutes only the opposite side. No left-to-right crossfeed is introduced.

Subchannels and Master use balance unless all their possible upstream sources are verified mono and the compiler can prove that state. The first implementation may conservatively use balance for them. The control runs after the existing post-effects/send chain, before output gate, meter, and route to parent; send feed points remain unchanged.

## Deterministic fixtures

Test impulse/constant-value mono at `p=0,0.5,1`; distinct left/right stereo at the same positions; overlapping mono+stereo on one track; mono direct output with mixer disabled; mono project output; missing/stale clip metadata; legacy disabled CSD; and unsupported source/output channel counts. Assert numeric level tolerance and channel independence, not just text presence.
