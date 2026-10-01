# Timecode Conversion and Project Contracts

**Spec**: [spec.md](../spec.md) | **Basis**: [public-calculation-basis.md](../public-calculation-basis.md)

## Portable conversion surface

Place a small original module at `packages/blue-data/src/time/smpte-timecode.ts`, with only required static exports. Functions operate without Node, Electron, DOM, filesystem access, or external runtimes.

| Operation | Input | Output/invalid result |
| --- | --- | --- |
| Resolve physical rate | Supported numeric alias | Readonly numerator/denominator/nominal descriptor; null if unsupported. |
| Seconds to physical frame | Finite nonnegative seconds, alias, floor/nearest operation | Supported integer frame index; null if outside domain. |
| Physical frame to seconds | Supported nonnegative integer index, alias | Frame-start elapsed seconds; null if invalid. |
| Format SMPTE | Elapsed seconds, valid format pair | Canonical label; null if invalid. |
| Parse SMPTE | Text, valid format pair | Frame-start elapsed seconds; null if invalid. |

The exact names are implementation choices. Do not export test-only seams or unused field decomposition APIs. Existing renderer wrapper `formatSMPTE` may retain its string return and supply the existing invalid-value placeholder for null. Parsing retains the existing null rejection flow and useful editor feedback.

## Label grammar and validation

Trim surrounding whitespace; match the entire string. Hours accept one or more decimal digits; minutes/seconds/frame accept one or two. No signs, decimal fractions, exponent syntax, internal spaces, or trailing junk. Validate minutes/seconds 0–59 and frames 0–nominal-minus-one. Require colon before frames in NDF and semicolon in DF. Both modes use colons between hours/minutes/seconds. Canonical output pads fields to at least two digits and does not wrap total hours.

For DF reject minute-not-multiple-of-ten labels with second zero and frames below 2 (29.97) or 4 (59.94). No automatic mode or physical-rate inference from punctuation. Extended-hour values are Blue elapsed labels, not serialized 24-hour wire addresses.

## Precision, counting, and duration

Use the minute-segment derivation rather than upstream source. Maximum physical frame is `8,998,201,053,687` for all rates. Validate integer intermediates and finite seconds before conversion.

For physical coordinate `x=t*p/q`, normalize to nearest integer if its distance is at most `8*Number.EPSILON*max(1,abs(x))`. Outside that documented numerical-equivalence band use floor for containing-frame display or the requested nearest/floor snap policy. Reject an index outside the domain after rounding. Values inside the band intentionally share a boundary interpretation; neighboring frames remain distinct.

Parsing resolves exact label frame counts to frame starts. Stored subframe values are never rewritten by formatting. Duration values count frames from duration origin zero; subtraction of two positions uses canonical elapsed time/frame counts rather than label components.

## Document and defaults contract

Add a Boolean to existing serializable snapshots as detailed in [data-model.md](../data-model.md). For `{ score: { type: 'updateTimeState', patch } }`, validate the effective pair formed by submitted fields and current canonical values before all mutations. Invalid format fields reject the request; they must not partially change unrelated TimeState fields. UI applies rate/mode atomically and supplies a semantic history label.

Keep the existing structural history classification. A format-only patch must not invoke existing object/marker timebase conversions; those remain conditional on an explicit primary-timebase change. Snapshot publication and renderer optimistic/rollback paths keep score, transport, and conversion context format synchronized. Playback requires only updated presentation; no engine rate/speed command is sent.

New defaults use the existing preference contract; reject invalid submitted pairs and merge old missing mode to false. Only new-project initialization applies them to document state.

## Frame snap and ruler contract

Snap beat coordinates through complete applicable tempo-map conversion into elapsed physical frame counts, then back. Mode does not participate in grid spacing. Preserve each caller's existing nearest/floor operation and local timeline origin. Generate frame grid/ruler positions from integer frame strides and round only at the physical frame boundary; do not accumulate approximate beat intervals.

Piano-roll receives project format and applicable tempo conversion but retains its existing local-zero coordinate semantics. Changing object offsets, adding timecode offsets, and redesigning piano-roll time behavior are out of scope.

## Error and provenance contract

Invalid input produces existing field validation feedback and no history/content change. Invalid canonical display data produces a placeholder, not a fabricated valid label. Persisted legacy/default recovery follows data-model.md and is distinct from rejecting a submitted patch.

New conversion code/comments/tests derive from public rules and original math. Cite R1 and the derivation and record that no upstream conversion code was ported. Any separately approved adaptation must retain source/license provenance and obligations; AI generation alone is not an audit record.
