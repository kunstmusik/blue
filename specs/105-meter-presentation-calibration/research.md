# Meter Scale Profile Analysis

**Date**: 2026-09-11

**Purpose**: Select a useful, bounded set of meter presentation profiles for Blue without
turning a presentation feature into a new loudness- or broadcast-metering engine.

## Scope distinction

A meter **profile** maps an already measured dB value to screen position, tick labels, reference
marks, and colors. A meter **type** changes what is measured or how it responds over time (sample
peak, true peak, RMS, VU, PPM, or LUFS). This feature may use the RMS and peak values already
delivered by realtime mixer metering, but it does not add new meter types or standards-compliant
ballistics.

## DAW findings

- **Pro Tools** exposes a broad list including Sample Peak, Classic, Linear, RMS, VU, several PPM
  standards, and K-12/K-14/K-20. Its breadth confirms that peak, RMS, VU, PPM, and K meters are
  not interchangeable labels for one curve. The current Avid documentation also describes K
  scales as RMS-based with a sample-peak secondary value.
  [Avid Pro Tools Reference Guide](https://resources.avid.com/SupportFiles/PT/Pro_Tools_Reference_Guide_2024.3.pdf)
- **Cubase Pro** offers Digital, DIN, EBU, British, Nordic, K-20, K-14, K-12, and digital scales
  with +3, +6, or +12 dB headroom. It separates the scale standard from alignment and meter
  settings, and supports maximum-value reset.
  [Steinberg Cubase Pro 15 Master Meter](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/loudness/loudness_master_meter_r.html)
- **Studio One** documents all three K-System references and explains their different headroom
  targets: K-20 for the greatest dynamic range, then K-14, then K-12.
  [PreSonus K-System overview](https://support.presonus.com/hc/en-us/articles/210044143-Studio-One-What-is-K-system-metering-and-why-do-I-need-it)
- **Ardour** supplies K-20 and K-14 modes alongside its regular metering choices and explicitly
  describes their scale alignment.
  [Ardour metering manual](https://manual.ardour.org/meters/)
- The code-reviewed local Ardour implementation and the prior Blue research show a second useful
  recurring family: a piecewise expanded dB scale that gives more display travel to the critical
  -20 to +6 dBFS mixing region. See `.tmp-research/METER_FADE_ROUND2.md`.

## Recommended initial profiles

| Stable key | Initial visual label | Intended use | Presentation contract |
|------------|----------------------|--------------|-----------------------|
| `peak-rms-linear-plus-6` | **Peak/RMS Linear (+6 dBFS)** | Exact visual continuity for users who prefer the current meter | Uniform linear dB mapping from -60 to +6 dBFS, preserving current color thresholds |
| `peak-rms-mixing-plus-6` | **Peak/RMS (+6 dBFS)** | Recommended general mixing view | Piecewise dB mapping from -70 to +6 dBFS with additional visual resolution from -20 to +6 dBFS |
| `k20-rms-peak` | **K20 (RMS + Peak)** | Wide-dynamic-range mixing reference | RMS-led display with 0 on the displayed scale aligned to -20 dBFS and sample peak retained as the secondary/hold indication |
| `k14-rms-peak` | **K14 (RMS + Peak)** | General music mixing/mastering reference | RMS-led display with 0 on the displayed scale aligned to -14 dBFS and sample peak retained as the secondary/hold indication |
| `k12-rms-peak` | **K12 (RMS + Peak)** | Reduced-headroom/program reference | RMS-led display with 0 on the displayed scale aligned to -12 dBFS and sample peak retained as the secondary/hold indication |

**Peak/RMS (+6 dBFS)** should be the default for newly created projects because it makes the normal
mixing range easier to read. Peak/RMS Linear (+6 dBFS) remains available for familiarity; no loaded
project's audio or stored gain values change when profiles change.

Only the stable key is serialized or used in patch/snapshot contracts. The initial visual label is
presentation metadata resolved from that key. Labels may therefore be revised or localized later
without migrating project files, invalidating history entries, or changing contracts.

The K profiles are named **Reference** because selecting one cannot calibrate speakers, interfaces,
room gain, or acoustic SPL. The settings UI must state this limitation. A future feature may add
an explicit monitoring-calibration workflow.

## Deferred profiles

- **VU, PPM DIN, PPM EBU, BBC, Nordic**: require defined integration, attack, fallback, and in some
  cases alignment behavior. Tick relabeling alone would be misleading.
- **LUFS/EBU R128**: requires new loudness measurements and time-window semantics.
- **True peak**: requires oversampled/inter-sample peak measurement not provided by the current
  telemetry contract.
- **User-authored curves and color editors**: valuable later, but not needed to cover the common
  general-mixing and K-reference cases.

## Product decisions carried into the specification

1. Scale choice is project-owned as a stable profile key and applies consistently to all mixer strips, including the
   master. Per-strip scale selection is deferred.
2. Profile labels are replaceable presentation text and MUST NOT be persisted as profile identity.
3. Profile choice changes only presentation; it never changes fader gain, automation, CSD output,
   offline rendering, or the audio signal.
4. Mixer Settings initially exposes only **Enable Meters**. Scale selection remains available from
   the meters themselves; both values are stored with the project.
5. A missing `enableMeters` value means **disabled** for a loaded legacy project, while a newly
   created project starts with meters enabled.

## Implementation planning decisions

### Decision: Persist stable keys and resolve labels in the renderer

**Rationale**: Project XML, patches, snapshots, history records, tests, and runtime selection remain
stable when wording is improved or localized. A closed key set also permits deterministic validation
at the project boundary.

**Alternatives considered**: Persisting labels was rejected because copy changes would become data
migrations. Persisting numeric ordinals was rejected because reordering a menu could silently change
meaning.

### Decision: Add optional mixer XML children with explicit load defaults

**Rationale**: `<mixer>` already owns mixer-wide project behavior in Java and TypeScript. New
instances initialize `enableMeters=true` and `meterProfile=peak-rms-mixing-plus-6`, while
`loadFromXML()` treats missing children as legacy and resolves them to `enableMeters=false` and
`meterProfileKey='peak-rms-linear-plus-6'`. Explicitly saved values always win.

**Intentional Java divergence & lossless XML boundary**: Java Blue (`blue-core/src/main/java/blue/mixer/Mixer.java`)
does not define `enableMeters` or `meterProfile`. Blue Electron introduces these two optional child elements
under `<mixer>`. The absence of both elements safely and unambiguously identifies pre-feature / Java-authored
projects. When loading legacy XML, missing fields resolve to the legacy defaults without mutating the project
or rewriting unrelated elements. Per constitution rules, unknown or unmodeled project elements and attributes
are preserved losslessly across load and save cycles.

**Alternatives considered**: App-wide preferences violate the requested project ownership. A raw
XML migration was rejected because absence itself cleanly distinguishes legacy data and no
structural rewrite is required.

### Decision: Extend the existing scalar mixer patch/history path

**Rationale**: Visibility and profile are independent scalar values with no structural identity
change. Existing mixer enablement and extra-render-time patches demonstrate the smallest canonical
path for optimistic snapshots, semantic history labels, dirty state, and undo/redo.

**Alternatives considered**: Direct renderer model mutation violates canonical ownership.
Structural mementos are unnecessarily broad for two scalar fields.

### Decision: Keep profile behavior in one renderer registry

**Rationale**: Each key needs the same complete rendering contract—range, monotonic mapping, ticks,
labels, thresholds, and RMS/peak roles—so a keyed registry is simpler and more testable than Canvas
conditionals. Display labels stay adjacent to presentation metadata and outside project data.

**Alternatives considered**: A plugin API and user-authored curve schema are speculative. Embedding
curve behavior in `@blue/data` would mix presentation with the portable project model.

### Decision: Use one project-wide profile and one peak summary per strip

**Rationale**: This matches the approved scope, keeps docked and detached views consistent, and
avoids per-channel persistent state. The numeric value is the maximum held sample peak across the
strip's outputs, while individual channel bars and markers remain visible.

**Alternatives considered**: Per-strip or separate master/track profiles add UI and persistence
without a current requirement. Multiple numeric boxes do not fit the existing compact multichannel
strip layout.

### Decision: Treat meter enablement as presentation with a safe runtime optimization

**Rationale**: Disabling immediately removes and stops renderer animation and clears disposable hold
state. Existing engine behavior remains correct regardless of telemetry. Skipping meter emission or
subscription at the next playback boundary is allowed only if achieved through existing contracts.

**Alternatives considered**: Changing the running Csound program mid-performance is unnecessary and
risky. Continuing hidden animation would defeat the opt-out's performance value.

### Decision: Use a host-document modal dialog for Mixer Settings

**Rationale**: A small one-checkbox dialog follows existing mixer interaction patterns, remains in
the same docked or detached document, and requires no new Electron window lifecycle or IPC surface.
The preferred gear location is the far right of the mixer toolbar, separated from Add Subchannel by
flexible space, so it remains consistently visible regardless of channel-strip scrolling.

**Alternatives considered**: A dedicated native Electron window is excessive for one setting and
introduces synchronization and lifecycle work. A popover is less clearly a settings window and more
fragile near detached-window edges.
