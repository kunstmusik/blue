# Mute/Solo Precedent Research

Researched 2026-09-15. These are design inputs, not claims that every DAW uses identical rules.

| Source | Documented precedent | Blue decision |
| --- | --- | --- |
| [Ableton Live 12, Mixing §18.6](https://www.ableton.com/en/manual/mixing/#soloing-and-cueing) | In-place source solo can retain returns. Soloing a return keeps its incoming sends while suppressing other tracks' main outputs. | Preserve needed sends; suppress feeder bypass routes when auditioning a return. A simple per-channel on/off decision is insufficient. |
| [Ardour, Muting and Soloing](https://manual.ardour.org/mixing/muting-and-soloing/) | Bus solo includes feeding tracks/buses. Mute targets, exclusive solo, and whether solo overrides mute are configurable. | Use one mixer-wide additive solo selection, mute wins, with visible derived exclusion. |
| [Cubase Pro 15, Pre/Post Fader Sends](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/audio_effects/audio_effects_send_effects_fx_channel_tracks_pre_post_fader_sends_c.html) | The documented Mute Pre-Send when Mute preference makes pre-fader sends follow channel mute. | Pre-fader does not inherently mean pre-mute. Blue fixes all sends to follow explicit mute initially. The page was available through the search index; direct page extraction failed. |
| [REAPER User Guide 7.36, Master Hardware Outputs](https://www.reaper.fm/userguide/ReaperUserGuide736c.pdf) | Master solo suppresses direct hardware outputs from tracks/folders. | Master M/S has an established precedent. This does not establish that master solo overrides upstream solo exclusions. |
| [REAPER User Guide 6.81](https://www.reaper.fm/userguide/ReaperUserGuide681c.pdf) | Solo in place includes outgoing sends, allowing a source to be heard with its reverb. The guide also lists send overrides for source mute among audio mute/solo preferences. | Supports retaining effect routes; send behavior is configurable, so Blue's fixed all-send mute is a deliberate policy. |
| [Logic Pro, Mute and solo channel strips](https://support.apple.com/en-au/guide/logicpro/lgcpbc21a09d/mac) | Channel solos exclude other strips except solo-safe channels; multiple solo and solo-exclusive operations are available. Corresponding track and strip controls are equivalent. | Supports synchronized audio headers/strips and distinguishes explicit state from solo exclusion. Blue's legacy event mode remains independently defined. |
| [Logic Pro, General Audio settings](https://support.apple.com/en-ca/guide/logicpro/lgcp0ed343a9/mac) | Master Dim attenuates output by a configurable amount from 0 to 30 dB. | The screenshot's D means Dim, not Solo. Dim is outside this feature. |
| [Pro Tools First 12.3, Master Fader signal flow](https://apps.avid.com/proToolsFirstHelp/version12.3/enu/Pro%20Tools%20First%20Help/mix1.basic.54.09.html) | Master Fader tracks have neither Mute nor Solo buttons. The [Pro Tools 2020.12 Reference Guide](https://cdn.avid.com/ProTools/2020.12/4A5C431A/Pro_Tools_Reference_Guide_2020.12.pdf) documents the same distinction. | Master controls are not universal; a Pro Tools Master Fader must not be conflated with an Aux bus or VCA Master. |
| [Pro Tools First 12.3, Soloing Tracks in a Submix](https://apps.avid.com/protoolsfirsthelp/version12.3/enu/Pro%20Tools%20First%20Help/mix1.basic.54.54.html) | Solo can implicitly mute Aux Inputs; solo-safe prevents that exclusion and keeps a return passing audio. | Keeping required returns audible has precedent, but Blue automates path inclusion rather than requiring solo-safe setup. |
| [Pro Tools First 12.0, Send and Return Submixing](https://apps.avid.com/proToolsFirstHelp/version12.0/enu/Pro%20Tools%20First%20Help/mix1.basic.54.50.html) | The effects-return workflow explicitly solo-safes the Aux return and supports pre/post-fader sends. | Source solo must not accidentally cut its effect return. This source does not establish a universal pre-fader mute-follow rule. |

## REAPER, Logic, and Pro Tools: master controls are different concepts

The supplied REAPER 6.81 screenshot visibly shows M/S on MASTER. The supplied Logic screenshot shows M/D on Master and a separate Stereo Out strip with effects and meters. These screenshots establish visible controls, not what happens when they are pressed. They were treated as evidence supplied by the user, not as instructions.

REAPER's documented master solo isolates the master hardware-output path against direct track/folder hardware outputs. Master solo itself is therefore not unique to Blue. Blue ultimately omits master solo because its current mixer has no useful separate-output isolation behavior; master retains Mute. No REAPER playback experiment was performed. PDF direct extraction failed; REAPER findings above use the official PDFs' indexed text, with versions named to avoid implying validation of every later release.

Logic's D is Dim, a temporary attenuation control. M is Mute. Neither the screenshot nor Apple's Dim documentation provides a master-solo precedent. Apple's separate mute/solo documentation supports linked track/strip controls and solo-safe exceptions; it does not prove Blue's exact route-selection algorithm.

Pro Tools uses distinct Master Fader, Aux Input, and VCA Master concepts. The cited versioned Avid manuals establish a Master Fader without M/S and an Aux solo-safe workflow for preserving returns. These historical precedents are not a claim about every current Pro Tools edition or preference. Blue selects master Mute only and automatic route preservation; it does not add VCA control, manual solo-safe configuration, or monitor dimming as part of this feature.

## Selected behavior and limits

The selected mute convention gates each outgoing contribution, including sends at their existing positions and the main output after local effects. It preserves ongoing events and effect processing. This cuts local tails at the muted channel while allowing tails already in downstream effects to decay. This is Blue's design choice, not a claim that the referenced manuals specify identical effect-tail behavior.

Solo is routing-aware. Soloing a source keeps its dry and send routes; soloing a return keeps its feeders only along paths through that return. Implicitly retaining a shared downstream bus does not open unrelated inputs. Multiple non-master selections form a union. Explicit mute still blocks a path. Master provides Mute only, and legacy master-solo data is retained but ignored. Once permitted sources have been summed into a bus, subsequent routes carry that combined signal; this design does not unmix it. Blue does not acquire control over user-authored audio that bypasses its mixer simply because REAPER can isolate its own hardware routes.

Example: A and B both feed Reverb R and Master M. Solo A permits A→M, A→R, R→M, but excludes B's contributions. Solo R permits A→R, B→R, R→M, while excluding A→M and B→M. Solo A plus R admits both selections. Muting M silences the result; unmuting it restores the same selection. A stored legacy Solo M flag has no effect. Existing shared reverb history may decay; separate historical contributions cannot be recovered after summing.

## Repository and Java evidence carried forward

- [Track group event filtering](../../packages/blue-data/src/score/track/track-layer-group.ts) and [global score solo](../../packages/blue-data/src/score/score.ts): effective mode must affect both local filtering and global solo discovery.
- [Track model](../../packages/blue-data/src/score/track/track.ts): modern Tracks contain AudioClip or SoundObject; audio-only pruning cannot be assumed for every track.
- [Channel state](../../packages/blue-data/src/mixer/channel.ts) and [CSD mixer generation](../../packages/blue-data/src/blue-data/csd-policy.ts): persistent flags exist but are not currently applied to mixer audio. Render snapshot cloning covers Mixer, not Score; generation must not temporarily change track flags.
- [Runtime reconciliation](../../packages/blue-app/src/main/project-runtime-reconciliation.ts): current M/S edits require restart, so live operation requires planning beyond UI controls.
- Java reference: `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-core/src/main/java/blue/score/layers/audio/core/AudioLayer.java` and `AudioLayerGroup.java`: audio clips and compile-time event filtering.
- Java reference: `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/mixer/Channel.java` and `MixerNode.java`: stored channel flags without mixer audio enforcement.

## Disk optimization consequence

An excluded dry path does not justify dropping events: a soloed return may still require that source. Even a fully excluded audio-only track can affect shared state through custom processing. Pruning needs proven absence of audible/observable influence, must preserve downstream processing, and must fall back to ordinary audio gates whenever uncertain. The implementation plan should define the exact supported proof conditions and reference renders.
