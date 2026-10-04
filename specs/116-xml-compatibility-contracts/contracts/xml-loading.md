# XML acceptance and diagnostic contract

**Date**: 2026-10-02

## Public boundaries

Proposed portable report APIs, implemented over existing model loaders:

- `readProjectXml(xml, source)` returns `XmlLoadResult<BlueData>`.
- `readResourceXml(kind, xml, source)` returns the corresponding instrument/effect/SoundObject/
  UDO/preset candidate result. Root spelling and kind must agree; preset/presetGroup dispatch is
  explicit. This is the shared disk/library/BlueShare-shaped boundary, without a transport client.
- Current `BlueData.loadFromString` and direct class/registry `loadFromXML` APIs remain strict
  convenience methods using the same rules. Append optional diagnostic/context arguments without
  changing existing object-reference argument meanings. Errors throw `XmlLoadError` carrying plain
  diagnostics. Warnings require an explicit diagnostic sink or the report API; without one,
  throw an error explaining that a report handler is required rather than return a model silently.

Accepted results contain a complete independently owned inert model and warnings only. Rejected
results contain errors and no partial value. No `ignoreUnknown`, `bestEffort`, or global permissive
mode. Known historical normalization without loss is ordinary acceptance, not a warning flood.

The [data model](../data-model.md) defines plain diagnostics. Paths use one-based sibling indices,
for example `/blueData/arrangement[1]/instrumentAssignment[2]/instrument[1]/name[1]/@future`.
Source identifies the file/item/in-memory root. Type/member/value/cardinality/conflict failures
explain recovery. Syntax errors include parser location where available. Generated migration
nodes retain legacy origin for diagnostics; canonical paths can supplement original source paths.

## Common grammar

1. XML must be well formed with the expected single root. Recognized declaration/comments and
   formatting whitespace are lexical, not model fields. DTD/external-entity behavior follows the
   installed parser's supported safe grammar; no input-triggered external document reads.
2. Exact names are case sensitive; namespaces are not stripped to accept unfamiliar names. Root
   and nested attributes must be declared. There is no universal free `version`, `id`, `type`,
   `xml:space`, or namespace-attribute exemption; allowed metadata is owner-specific.
3. Scalar text/CDATA concatenates in source order and preserves significant whitespace. Scalars
   reject attributes/child elements unless their contract declares them. Containers reject
   non-whitespace direct text. Mixed meaningful text/elements rejects before evidence is collapsed.
   Archived raw leaves are independent of editable grammar and retain their source stream.
4. Singleton physical fields cannot repeat. Alias coexistence rejects unless the specific matrix
   permits equal coalescing or a named precedence. Required fields cannot use omission defaults.
   Ordered repeats retain order; declared map keys are unique, with validated fixed entry shapes.
5. Numeric values consume the complete trimmed token, are finite, and meet the owner's domain.
   Integral fields meet the supported exact range; exact decimals retain existing decimal helpers.
   Booleans accept case-insensitive true/false after trim and emit lowercase. Enum tokens follow
   explicitly listed spellings. Present invalid values reject; absent optional historical values
   use the declared defaults. Code/Csound header expressions retain string domains.
6. Polymorphic types have exact approved Java names and named TS/legacy aliases. Arbitrary package
   suffix matching, placeholder serialization, or registration without a validation contract does
   not establish support. Every nested owner validates, including disabled/dormant data.
7. Unfamiliar well-formed project version alone does not reject otherwise fully supported members;
   invalid version syntax rejects. Class-local format versions have explicit known conversion
   semantics; unknown local versions reject when they could change value interpretation.

Specific member/default/value/output decisions are in [project evidence](../project-evidence.md),
[resource evidence](../resource-evidence.md), and [object/library evidence](../sound-library-evidence.md).
The [inventory](../serialization-inventory.md) assigns every scanned production boundary.
Per-field exceptions below override generic alias rejection; physical duplicate singletons still
reject except the documented emitted PianoRoll empty-scale defect.

## Shared time duration supplement

TimeDuration is an independent public class reached by common SoundObject/audio timing. Only
attribute `type` and its selected fields are allowed. Current output comes from Java's
[TimeDuration writer](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/time/TimeDuration.java):

| Type | Current required fields | Accepted existing TS aliases |
| --- | --- | --- |
| BEATS | csoundBeats | CSOUND_BEATS, DurationBeats; legacy numeric text only in a declared historical enclosing root |
| BBT | bars, beats, ticks | DurationBBT; singular bar/beat when no conflicting plural value |
| BBST | bars, beats, sixteenth, ticks | DurationBBST; singular bar/beat |
| BBF | bars, beats, fraction | DurationBBF; singular bar/beat |
| TIME | hours, minutes, seconds, milliseconds | DurationTime |
| SECONDS | totalSeconds | DurationSeconds; seconds alias |
| FRAME | frameCount | DurationFrames; frameNumber alias |

Durations are nonnegative at object/audio uses. Musical/time components are nonnegative exact
integers with the current constructor/unit bounds; BEATS/SECONDS are finite and FRAME integral.
Existing number-backed components reject out-of-safe-integer input rather than round silently.
Equal aliases coalesce; unequal reject. Unknown/missing typed discriminator and missing required
typed fields reject instead of becoming zero beats. Do not confuse TimeDuration frameCount with
TimePosition's Java frameNumber. Historical enclosing-root unit tags/discriminants in SL-H05 are
explicit local normalization records, not new free-form time payloads.

### Development-era common SoundObject time forms

SL-H05 includes written development formats, without claiming a released-version range.
The [first writer](https://github.com/kunstmusik/blue/blob/3b237ef572853ffc31f45a8c9af3f9c8808c979e/blue-core/src/main/java/blue/soundObject/SoundObjectUtilities.java)
emitted direct typed `startTimeUnit`/`durationUnit` elements even though its reader expected a
nested `timeUnit` child. Support the written direct form; the reader-only nested variant is not
accepted without a separate provenance/support decision. The later writer renamed `durationUnit`
to `subjectiveDurationUnit`; the duration refactor emitted `subjectiveDurationTD`, and the position
refactor emitted `startTimePosition`. Normalize these at the common local owner, including
standalone resources, to current `startTime`/`subjectiveDuration` roots.

| Historical direct type | Required fields | Start position | Duration |
| --- | --- | --- | --- |
| BeatTime | csoundBeats | BEATS | BEATS |
| TimeValue | hours, minutes, seconds, milliseconds | TIME | TIME, retaining interval components |
| FrameValue | frameNumber | FRAME/frameNumber | FRAME/frameCount, retaining audio-sample count |
| MeasureBeatsTime | measureNumber, beatNumber | Known unsupported development form: reject | Known unsupported development form: reject |
| SMPTEValue | hours, minutes, seconds, frames | Known unsupported development form: reject | Known unsupported development form: reject |

Only `type` and the selected fields are allowed. Apply the current corresponding component bounds
and exact-number rules; do not round historical musical fractions or confuse SMPTE frames with
audio samples. MeasureBeatsTime has a fractional, one-based beat representation and SMPTEValue
depends on historical frame-rate interpretation. This feature does not invent a lossy conversion
to the available canonical representations. Diagnose these known unsupported forms with their
source/type and recovery guidance to convert in a compatible historical editor, or archive an
eligible library resource. Do not substitute defaults.

The [duration refactor](https://github.com/kunstmusik/blue/blob/7da35d375be5f17d8a7c42383ad100fb9ce55193/blue-core/src/main/java/blue/soundObject/SoundObjectUtilities.java)
used a four-beat fallback for non-BeatTime legacy durations; that is explicitly rejected as a
support policy. TIME/FRAME mappings above are original, lossless compatibility decisions, not
that fallback. `startTimePosition` and `subjectiveDurationTD` use their demonstrated current
TimePosition/TimeDuration field grammars, not the earlier TimeUnit discriminants. Equal canonical
values across declared alias roots may coalesce; conflicting values or repeated physical roots
reject. Scalar legacy times remain beats. All output uses current typed roots.

## Named warning and retention rules

| Case | Accepted outcome and safe save contract |
| --- | --- |
| Known Clojure/Python metadata with unavailable runtime | Accept typed content; runtime execution availability is separately diagnosed. Do not reject known XML or widen it to unknown types. |
| Historical redundant sample rate / fixed PPQ960 | Project reconciles/transfers rates before omission; conflicting explicit rates/custom PPQ reject. Warn only under P-CONTEXT-RATE/P-PPQ rules. |
| Duplicate widget identities | Existing Spec043 preserves first/rekeys collisions, warns, writes canonical unique identities. Alias identity conflicts reject. |
| Live set unresolved target IDs | Preserve exact typed IDs, warn, application to missing target has no effect; save/copy/history retain them. |
| PianoRoll empty first scale + populated second scale | Recognize exact emitted TS defect, warn, retain populated content, write once. Other duplicates reject. |
| Historical ObjectBuilder default syntaxType | Only proven Python editor hint with normalized PYTHON language may warn/omit as documented in SL-H02; nondefault/conflicting hints reject. |
| Historical PianoRoll timeUnit | Preserve positive integral interval in a named typed legacy ruler metadata field, warn that current ruler cannot display that historical interval. Write timeUnit as an explicit output exception; copy/history retain it. Never infer safe deletion from snap value. |
| Unsupported resource in valid library envelope | Archive original leaf source with diagnostics, exact export, no typed editing/insertion. Revalidation is required for promotion. |

No catch-all harmless warning. Known malformed enums/style/numbers/unknown members are errors.
Warnings about ignored/normalized fields must identify exactly what changes and why no meaningful
state is lost. Named retained editor/runtime settings remain supported data, not generic XML bags.

## Exact seeds and tuning dependencies

JMask and seeded random processor Java-long seeds use one authoritative canonical signed-64-bit
decimal string, including snapshot/patch/IPC fields. Validate the full integer token and range;
use BigInt at the existing JavaRandom boundary before any narrowing. Existing numeric setter
inputs may normalize only if safe integers. Do not retain parallel raw/number seed state.

TuningProcessor uses the same complete typed Scale as PianoRoll/MIDI, retaining name, octave,
frequency and ratios. Existing TS multiline ratios normalize locally to repeated ratio fields;
top-level baseFrequency alias transfers when nested value is absent, equal coalesces, unequal
rejects. A demonstrated external scalar scale filename is a named typed dependency, preserving
its original path. Data loading performs no filesystem reads and never substitutes default scale
for unresolved content. Main resolves through the existing host scale capability before execution
or dependency-requiring insertion; unresolved dependencies remain visibly blocked and saveable
under their explicit retained-path contract.

An independently exported Code processor validates its own type/code scalar contract; it is not
an automatic addition to the registered project chain grammar or proof of executable behavior.

## Writer/copy contract

Canonical output is specified current form, with named retained-output exceptions only. Emit
current project version without assigning to canonical model. Writers must not resize vectors,
insert duplicate scale placeholders, synchronize live state, or return owned mutable XML.
Element clone copies structure directly. Marker and retained payload getters/adders must not
permit hidden canonical mutation. History copies preserve identities/references and relink copied
PianoRoll fields to copied definitions; user duplication keeps its established rekeying behavior.

Shared Line/Parameter exact bdresolution precedence follows Java: validate both lexical forms,
then bdresolution overrides legacy resolution regardless of order. Apply legacy relative-point
conversion before parameter-owned resolution synchronization. This explicit precedence overrides
the general equal-alias rule and applies consistently to line/zak/BSB/automation owners.
