# Review: 29.97 timecode, drop frame, and implementation licensing

Reviewed 2026-09-30 against Blue 3 commit `d5c7ed99b`, the supplied agent report,
Java Blue, and the primary sources linked below. This is a research and design
recommendation; it does not change application behavior.

## Finding

Blue should offer explicit 29.97 non-drop-frame (NDF) and drop-frame (DF)
timecode, with both implemented using the actual rate `30000/1001`. The recent
label change removed an incorrect promise of DF support, but it did not make
the existing arithmetic standard NDF. The report correctly recommends both
modes, but repeats that underlying error and gives an incorrect example for
DF at exactly 60 elapsed seconds.

Use an original implementation derived from the counting rules and rational
frame arithmetic. This fits the MIT license of `@blue/data` and can be consumed
by the GPL desktop application. A TypeScript translation of Ardour's GPL code
or libltc's LGPL code would retain upstream licensing obligations.

## What the standard and DAWs establish

[SMPTE ST 12-1:2014, sections 4.9 and 5.2](https://pub.smpte.org/latest/st12-1/st0012-1-2014.pdf)
distinguishes physical rate from counting mode. For 29.97, the physical rate is
`30/1.001`. NDF assigns successive labels 00–29. DF omits 00 and 01 at the
start of minutes other than multiples of ten. No media frames disappear.
The standard describes approximately 3.6 seconds of uncompensated hourly
error, reduced to approximately 3.6 milliseconds with DF.

[Logic Pro's synchronization settings](https://support.apple.com/en-lk/guide/logicpro/lgcp7c04a41a/mac)
explicitly provide both 29.97 and 29.97d, and both 59.94 and 59.94d. Logic uses
a semicolon before the frame component for DF. [Cubase's frame-rate documentation](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/video/video_frame_rates_c.html)
also explicitly distinguishes 29.97 NDF and DF. These are sufficient primary
examples to support offering both in Blue; the report's blanket claim about
every professional DAW is unnecessary.

DF is appropriate when the timecode must approximately track elapsed time;
NDF is appropriate when the source or delivery workflow uses continuous
numbering. Blue should match the user's source/delivery format. Do not present
DF as universally mandatory for every North American deliverable.

[Apple's MTC documentation](https://support.apple.com/en-au/guide/logicpro/lgcpfffe5fb7/10.7/mac/11.0)
explains that MTC cannot distinguish 29.97 from 30 solely through its encoded
rate category. A future MTC implementation needs an explicit physical-rate
setting; a DF flag or punctuation alone cannot resolve every rate ambiguity.

## Corrections to the supplied report

### The current formatter is not standard NDF

`packages/blue-app/src/renderer/time/time-unit-logic.ts:274` splits elapsed time
into clock hours, minutes, seconds, and a fractional-second frame component.
Its parser at line 468 reverses that construction. Standard NDF instead counts
all physical frames from the timecode origin and decomposes that integer count
at the nominal rate of 30 labels per timecode second.

Consequently, 29.97 NDF `00:01:00:00` means 1800 physical frames and starts at
60.060 elapsed seconds. `00:01:00:01` starts at 60.093366667 seconds. The recent
tests expect 60 and approximately 60.033366700, respectively. They protect the
legacy arithmetic, not an industry NDF contract.

Commit `b72551206` changes the UI label and adds tests; it does not change the
formatter or parser. This is an inherited behavior defect, rather than a new
timing algorithm introduced by the manual integration.

Keep the current non-drop label as an interim measure; restoring the old drop
label would restore a false claim. Record the standards defect as a follow-up
to M18 and implement it through a focused feature spec. The manual's resolved
label issue should not be read as verification of standard NDF conversion.

### The DF transition is not at exactly 60 elapsed seconds

The correct adjacent labels are `00:00:59;29` and `00:01:00;02`. Their frame
starts are approximately 60.026633333 and 60.060 seconds. With a containing-frame
policy (floor the physical frame count), exactly 60 seconds displays
`00:00:59;28`. The report's proposed formatter itself produces that result,
contradicting its narrative expectation of `00:01:00;02` at 60 seconds.

The following values were independently calculated with Python rational
arithmetic, assuming origin zero and a containing-frame display policy:

| Elapsed seconds | Physical frame index | Standard 29.97 NDF | Standard 29.97 DF | Current Blue entry formatter |
| --------------- | -------------------- | ------------------ | ----------------- | ---------------------------- |
| 60              | 1798                 | `00:00:59:28`      | `00:00:59;28`     | `00:01:00:00`                |
| 600             | 17982                | `00:09:59:12`      | `00:10:00;00`     | `00:10:00:00`                |
| 3600            | 107892               | `00:59:56:12`      | `01:00:00;00`     | `01:00:00:00`                |

At frame 108000, NDF `01:00:00:00` starts at 3603.600 seconds. At frame 107892,
DF `01:00:00;00` starts at 3599.996400 seconds. The latter is close to an hour,
not exactly an hour. Frame quantization adds its own display uncertainty.

### Java confirms the bug, not a standards exception

The local Java `RulerConfigDialog.java` offers `29.97 fps (drop)` while
`TimeDisplayFormat.java:298` uses fractional-second arithmetic and colons.
It also clamps using `(int) frameRate - 1`, which makes frame 29 unavailable at
29.97. This establishes the inherited mismatch; it does not prove that the
author intended a particular complete DF implementation. Avoid describing the
routine as an intentional stub without historical evidence.

Blue 3 also has separate formatter copies in the ruler's
`ColumnHeader.tsx:631` and `toolbar-formatters.ts:349`. Both clamp at
`floor(frameRate)-1`, producing the same invalid maximum of 28 at 29.97.
Fixing only the text-entry formatter would leave inconsistent displays.
The elapsed-second approach also affects 23.976 and 59.94 NDF.

### The enum does not provide working DF support

`packages/blue-data/src/time/smpte-frame-rate.ts` contains DF identifiers, but
production state, IPC contracts, and preferences currently carry numbers.
`TimeContext` maps legacy `29.97df` and `30df` strings to plain numeric rates,
discarding the mode distinction. The enum is not an active DF capability or a
sufficient basis for replacing the numeric XML field with strings.

### The proposed DF parser is incomplete

The report's reverse equation works for valid labels, but its example function
does not reject omitted labels or out-of-range fields. `00:01:00;00` and
`00:01:00;01` are invalid; they must not become aliases for preceding frames.
The current parser also accepts minute 60, frame 30, and trailing junk via
`parseInt`. A standards implementation needs complete input validation.

## Recommended Blue contract

1. Keep numeric `smpteFrameRate` for Java XML compatibility. Add a project-owned
   `smpteDropFrame` boolean to `TimeState`, defaulting to false when absent.
   Derive effective conversion contexts and snapshots from this owner; do not
   create independently editable copies of the mode in several models.
2. Resolve display aliases to exact rational rates internally: 23.976 →
   `24000/1001`, 29.97 → `30000/1001`, 59.94 → `60000/1001`. Retain exact integer
   rates 24, 25, 30, 50, and 60. Keep existing XML selector values rather than
   silently rewriting 29.97 to a long decimal approximation.
3. Offer explicit NDF/DF choices for 29.97. Include 59.94 NDF/DF in the same
   contract if completing the existing frame-rate settings: a full-frame
   00–59 display omits labels 00–03 at non-tenth minute starts. Keep 23.976 NDF.
   Do not enable DF at every fractional rate or add unusual 30/60 DF choices
   merely because an enum or another DAW exposes them.
4. Specify the high-rate display convention. ST 12-1 transports can encode
   frame pairs plus a frame identifier; a full-frame 00–59 software display is
   not itself an LTC/MTC wire encoding. Defer synchronization transport work
   until requested.
5. Centralize frame/timecode conversion in a small browser-safe `@blue/data`
   module with original MIT code. Use it for text entry, rulers, transport,
   markers, and score-object displays. Use exact physical frame duration for
   SMPTE snapping; DF changes numbering, not playback speed or sample rate.
6. Format NDF with `:` and DF with `;`. For Blue text entry, use the selected
   project mode as authoritative; reject conflicting explicit DF punctuation
   in NDF mode. If accepting legacy colons in DF mode, document that they use
   the selected DF arithmetic and never infer an unrelated frame rate.
7. Parse complete integers and validate minute/second ranges, nominal frame
   range, and omitted DF labels. Define negative-time handling and the
   distinction between 24-hour timecode addresses and durations exceeding a
   day. Compute differences using physical frame counts, not subtraction of
   printed timecode components. Define floor/nearest policies per operation
   and numerical tolerance at representable frame boundaries.
8. Keep existing stored score/marker positions and durations unchanged when
   correcting display semantics or toggling mode. Existing numeric 29.97
   projects cannot establish historical DF intent, so default to NDF and
   explain the corrected display in release notes. Inspect explicit legacy
   string modes before their current normalization loses them; specify any
   migration separately rather than treating `30df` as `29.97df`.
9. Carry the mode through project XML, copy constructors, document patches,
   snapshots, preferences/new-project defaults, undo/redo, and all display
   consumers. Use canonical ProjectHistory with a semantic label. Document
   the intentional correction of Java's legacy formatting in the feature
   spec and plan, and replace the manual's current arithmetic explanation.

For 29.97, a minimal mathematical basis is:

- Physical frame duration: `1001/30000` seconds.
- NDF frame index: `30*(3600*h + 60*m + s) + f`.
- DF frame index: subtract `2*(totalMinutes - floor(totalMinutes/10))` from
  the NDF label index, after validating the label.
- For forward DF conversion, ten-minute blocks contain 17982 physical frames
  and omit 18 label numbers. Decompose physical frame indices into blocks and
  minute segments, then add the omitted labels before nominal decomposition.

These are counting relationships, not borrowed source code.

## License compatibility

The repository's [LICENSING.md](../LICENSING.md) is decisive:

| Location/source                              | Verified license                                        | Consequence                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Blue desktop application                     | GPL-3.0-or-later                                        | Can incorporate appropriately attributed GPL-compatible adaptations.                                                           |
| Blue-authored `@blue/data`                   | MIT; artifact additionally includes Apache-2.0 material | New conversion code should preserve this permissive boundary.                                                                  |
| Local Ardour `libs/temporal/time.cc` header  | GPL-2.0-or-later                                        | Compatible with the GPLv3 app, with notices and source obligations; cannot simply be published as MIT code.                    |
| Local Ardour `libs/libltc/timecode.c` header | LGPL-3.0-or-later                                       | Compatible with GPLv3 distribution under applicable terms; translating it does not remove those terms or grant an MIT license. |

The FSF explains [GPLv2-or-later compatibility with GPLv3](https://www.gnu.org/licenses/quick-guide-gplv3.html).
The [combined LGPLv3/GPLv3 terms](https://www.gnu.org/licenses/lgpl%2Bgpl-3.0-standalone.html)
explain the LGPL's relationship to GPLv3 and its additional permissions.

The [U.S. Copyright Office](https://www.copyright.gov/register/tx-programs.html)
distinguishes protected source expression from algorithms and program logic.
That supports writing original code from the counting contract without copying
the expression, comments, or tests of another implementation. Having consulted
Ardour means this review is not a formal clean-room exercise. An AI-generated
port is still a port; generation alone does not establish provenance or clear
licensing obligations. If code is adapted, record the source revision, retain
notices, identify modifications, and include required license/source materials.

Recommendation: no new dependency and no source port. Record standards sources
and independently derived golden vectors alongside a small original conversion
module. Do not copy proprietary DAW code or reproduce standards text wholesale.
This is a source-level compatibility assessment, not a patent clearance or a
legal opinion about every distributed component.

## Validation performed and required follow-up

The existing `time-unit-logic.test.ts` suite passes: 155 tests. I also transpiled
and executed the current production formatter/parser and confirmed the table's
Blue outputs and invalid-input acceptance. Independent Python `Fraction`
calculations established the standards vectors. No application code or existing
tests were changed by this review.

A future implementation should have one primary conversion test suite with
independent expected frame indices and labels, rather than expected values
computed using the implementation under test. Important vectors include:

| Physical frame index | 29.97 DF label | Purpose                          |
| -------------------- | -------------- | -------------------------------- |
| 1799                 | `00:00:59;29`  | Last frame before the first skip |
| 1800                 | `00:01:00;02`  | First valid label after the skip |
| 17981                | `00:09:59;29`  | Last frame before a tenth minute |
| 17982                | `00:10:00;00`  | Tenth minute retains label 00    |
| 107891               | `00:59:59;29`  | Last frame before hour one       |
| 107892               | `01:00:00;00`  | Hour boundary                    |

Also cover NDF frame 29, the elapsed-time table, 23.976 and 59.94 rational
rates, invalid omitted labels, malformed input, exact-boundary round trips,
and the chosen 24-hour/duration policy. Add distinct XML/migration coverage and
commit→undo→redo coverage for the new project setting. Verify that applying a
setting changes display without moving canonical project content. UI coverage
should establish that ruler, transport, and editors receive the same mode,
without repeating the arithmetic suite at every component.

Run affected data/app tests, main build if contracts/main code change, and
repository-wide `pnpm test`, `pnpm lint`, and `git diff --check` for the actual
cross-package implementation. Passing today's legacy tests does not establish
SMPTE compliance.
