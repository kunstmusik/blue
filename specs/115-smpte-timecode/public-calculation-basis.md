# Public Calculation Basis and Provenance

**Feature**: [Standards-Based SMPTE Timecode](spec.md)

**Verified**: 2026-09-30

This document separates public counting rules from third-party source code. The equations and examples below are independently derived mathematical requirements, not translated upstream source.

## Public primary references

| ID | Source | Relevant location | Use |
| --- | --- | --- | --- |
| R1 | [SMPTE ST 12-1:2014](https://pub.smpte.org/latest/st12-1/st0012-1-2014.pdf) | Sections 4.9, 5.1, 5.2.1–5.2.2, 7.2, 12; printed pages 8–10, 12, 33–34 | Physical rates, NDF/DF counting, and frame-pair transport distinction. |
| R2 | [SMPTE Time Code Summit report, ER-2:2017](https://www.smpte.org/hubfs/er1002-2017%20%282%29.pdf?hsLang=en) | PDF page 140 (one-based), appended slide “Teaching your Editor to count the DF way” | Public explanatory examples of skipped and tenth-minute transitions. |
| R3 | [Logic Pro synchronization settings](https://support.apple.com/en-lk/guide/logicpro/lgcp7c04a41a/mac) | Frame rate settings | Explicit 29.97/59.94 NDF/DF choices and semicolon notation. |
| R4 | [Cubase Pro 15 frame rates](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/video/video_frame_rates_c.html) | 29.97 fps/29.97 dfps | Independent product confirmation of distinct counting modes. |
| R5 | [Ardour Manual: Timecode Generators and Slaves](https://manual.ardour.org/synchronization/timecode-generators-and-slaves/) | 29.97 compatibility discussion | Distinguishes exact 29.970000 device compatibility from standard `30000/1001`; documentation reference only. |
| R6 | [U.S. Copyright Office: Computer Programs](https://www.copyright.gov/register/tx-programs.html) | Copyright scope | Distinguishes protected source expression from algorithms/logic; no source-code license grant. |

R1 governs counting. R2 explains it; R3–R5 establish conventions and distinctions. Do not replace R1's rational rate with a rounded illustrative rate elsewhere.

These documents remain copyrighted. Link and paraphrase rather than vendoring PDFs, reproducing slides, or copying prose into source. Public readability is not an MIT grant. R6 is U.S. copyright-scope guidance, not worldwide clearance or a patent opinion; R1's intellectual-property notice does not guarantee absence of patents.

## Independent mathematical derivation

Let `p/q` be actual frames per elapsed second, `B` the nominal labels per timecode second, and `n` a nonnegative physical frame index from zero origin. Frame starts occur at `n*q/p` seconds. A containing-frame display uses `floor(t*p/q)`, with a validated precision policy at exactly representable boundaries.

For NDF, label index equals `n`. Decompose at `B` frames per label second, 60 seconds per minute, and 60 minutes per hour. Conversely, label index equals `B*(3600*h + 60*m + s) + f`. This is why clock seconds plus `f/fps` is incorrect for fractional-rate NDF.

For 29.97 DF, `B=30`, `p=30000`, `q=1001`, with `d=2` omissions at non-tenth minute starts. Blue's full-frame 59.94 display uses `B=60`, `p=60000`, `q=1001`, `d=4`: doubling the underlying frame-pair numbering, not specifying an LTC/MTC wire format.

Count ten timecode minutes directly:

- First minute physical frames: `L0=60*B`.
- Each of nine remaining minutes: `L1=60*B-d`.
- Ten-minute physical frames: `L10=L0+9*L1=600*B-9*d`.
- Omitted labels per ten-minute block: `9*d`.

Thus 29.97 uses 17982 physical frames/18 omitted labels per block; 59.94 uses 35964/36.

For valid DF input, set `M=60*h+m`. There have been `M-floor(M/10)` skipped minute starts. Subtract `d*(M-floor(M/10))` from nominal label index to obtain `n`; elapsed seconds are `n*q/p`. First reject `s=0`, `m mod 10 != 0`, `f<d`: such a label has no physical frame.

For forward DF conversion, divide `n` into complete `L10` blocks and remainder `r`. Each complete block adds `9*d` omitted label numbers. If `r<L0`, add none for the remainder. Otherwise the remainder is in skipped minute `j=1+floor((r-L0)/L1)` and adds `j*d`. Add omissions to `n` before nominal decomposition. This follows directly from counting minute segments and requires no source adaptation.

The hour values follow from `108000*1001/30000=3603.600` seconds NDF and `(108000-108)*1001/30000=3599.996400` seconds DF. Doubling physical frame count and rate yields identical elapsed hour values at 59.94.

## Independent expected results

Acceptance tests must use fixed, independently verified expected values rather than obtaining expected output from the converter under test.

### 29.97 frame-index boundaries

| Physical frame | NDF | DF | Frame-start seconds |
| --- | --- | --- | --- |
| 0 | `00:00:00:00` | `00:00:00;00` | 0 |
| 29 | `00:00:00:29` | `00:00:00;29` | 0.967633333… |
| 1799 | `00:00:59:29` | `00:00:59;29` | 60.026633333… |
| 1800 | `00:01:00:00` | `00:01:00;02` | 60.060 |
| 17981 | `00:09:59:11` | `00:09:59;29` | 599.966033333… |
| 17982 | `00:09:59:12` | `00:10:00;00` | 599.999400 |
| 107891 | `00:59:56:11` | `00:59:59;29` | 3599.963033333… |
| 107892 | `00:59:56:12` | `01:00:00;00` | 3599.996400 |
| 108000 | `01:00:00:00` | `01:00:03;18` | 3603.600 |

### 59.94 full-frame DF boundaries

| Physical frame | DF | Frame-start seconds |
| --- | --- | --- |
| 59 | `00:00:00;59` | 0.984316666… |
| 3599 | `00:00:59;59` | 60.043316666… |
| 3600 | `00:01:00;04` | 60.060 |
| 35963 | `00:09:59;59` | 599.982716666… |
| 35964 | `00:10:00;00` | 599.999400 |
| 215783 | `00:59:59;59` | 3599.979716666… |
| 215784 | `01:00:00;00` | 3599.996400 |

### Exact elapsed-second display, containing-frame policy

| Rate | Elapsed seconds | Physical frame | NDF | DF |
| --- | --- | --- | --- | --- |
| 23.976 | 60 | 1438 | `00:00:59:22` | Unavailable |
| 24 | 60 | 1440 | `00:01:00:00` | Unavailable |
| 25 | 60 | 1500 | `00:01:00:00` | Unavailable |
| 29.97 | 60 | 1798 | `00:00:59:28` | `00:00:59;28` |
| 29.97 | 600 | 17982 | `00:09:59:12` | `00:10:00;00` |
| 29.97 | 3600 | 107892 | `00:59:56:12` | `01:00:00;00` |
| 30 | 60 | 1800 | `00:01:00:00` | Unavailable |
| 50 | 60 | 3000 | `00:01:00:00` | Unavailable |
| 59.94 | 60 | 3596 | `00:00:59:56` | `00:00:59;56` |
| 60 | 60 | 3600 | `00:01:00:00` | Unavailable |

Invalid examples: 29.97 DF `00:01:00;00`/`00:01:00;01`; 59.94 DF `00:01:00;00` through `00:01:00;03`; minute/second 60; frame 30 at nominal 30; frame 60 at nominal 60; negative input; trailing junk; incompatible separators. Tenth-minute frame-zero labels remain valid.

## Implementation provenance requirements

- Follow [Blue's licensing policy](../../LICENSING.md): Blue-authored data code remains MIT, desktop app GPL-3.0-or-later. Existing additional Apache-2.0 material does not relicense copied GPL code.
- Write original code, comments, and tests from this contract. Do not port report source excerpts, Ardour GPL routines, libltc LGPL routines, or public snippets without a separate license assessment and explicit adaptation record.
- This is not a formal clean-room claim: the prior review consulted upstream source. Record that history honestly; independent mathematics is distinct from copying expression.
- Cite R1 and this derivation from the conversion module and primary regression owner. Record implementation provenance in the plan/final review; AI generation does not replace license/source review.
- Any proposed dependency/adaptation must identify origin, revision, license, and obligations before inclusion. None is needed or authorized merely by these public references.

## Decisions reserved for planning

Map persistence, snapshots, defaults, history, consumers, and frame snapping to this contract. Select and validate exact-boundary precision, document unsupported legacy string recovery, and trace intentional Java divergences. These are design decisions, not reasons to change counting rules or expected values.
