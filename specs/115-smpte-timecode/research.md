# Research: Standards-Based SMPTE Timecode

**Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

Pre-research constitution gates passed in [plan.md](plan.md). Read-only research covered public rules/provenance and repository integration. No application source was changed. All design unknowns below are resolved.

## 1. Counting contract and provenance

**Decision**: Original portable MIT-compatible conversion code from [Public Calculation Basis](public-calculation-basis.md), using exact rational rates and independent expected values. No dependency and no upstream source translation.

**Rationale**: Public SMPTE counting rules distinguish physical rate from numbering. Blue's data code is MIT whereas inspected Ardour/libltc routines are GPL/LGPL. The mathematical rules can inform original code; publicly readable implementations are not automatically permissively licensed. Public references are technical/provenance evidence rather than blanket clearance.

**Alternatives considered**: Port Ardour/libltc into the GPL app (possible with obligations but loses shared permissive owner); use an unneeded dependency; treat AI translation as cleared provenance (rejected). Keep source URLs/version/sections/date and an adaptation-free provenance statement with implementation review.

## 2. Fractional rates and high-rate displays

**Decision**: Static rational descriptors for the existing eight rates; DF available at 29.97/59.94 only. Full individual-frame software labels at high rates; no wire encoding.

**Rationale**: R1/R3 in Public Calculation Basis establish exact rates and user conventions. Frame-by-frame independent enumeration confirms every listed 29.97/59.94 DF vector, without using the proposed block equation as its oracle.

**Alternatives considered**: Decimal 29.97 arithmetic, DF at every fractional rate, or adding uncommon exact-30/60 DF (rejected). Preserve TimeBase.FRAME as audio samples; SMPTE snap's FRAME choice is a separate media-frame grid.

## 3. Canonical project ownership

**Decision**: TimeState owns physical-rate alias and explicit Boolean mode; contexts/snapshots derive them. Change toolbar snapshot to read TimeState; leave TimeContext's stored numeric carrier and default intact.

**Rationale**: Ruler/default edits already modify TimeState (default 24). Toolbar alone reads TimeContext (default 30), an existing mismatch. No CSD calculation depends on TimeContext's SMPTE getter; normalizing both persisted models would change unrelated legacy data unnecessarily.

**Alternatives considered**: Synchronize two mutable owners, replace numeric fields with the unused mixed enum, or infer DF from legacy UI text (rejected).

## 4. XML and legacy/default recovery

**Decision**: Optional `smpteDropFrame` child, true only for DF; absent false. Preserve exact numeric recovery of historical `29.97df`/`30df` tokens as NDF when the new explicit mode is absent. Validate supported alias values rather than accepting arbitrary parseFloat prefixes. Do not introduce a raw-XML migration for this additive field.

**Rationale**: Both existing readers strip those suffixes; no supported historical explicit mode contract established DF intent. Numeric aliases must stay Java-compatible. Invalid persisted modes fall back to NDF; invalid patches fail before mutation.

**Alternatives considered**: Suffix-inferred DF, changing 30df to 29.97, and keeping raw/presence shadows for the Boolean (rejected). TimeState has no existing unknown-data overlay: retain only unknown cloned children/attributes in the touched model, with copy/history coverage.

## 5. Numeric equivalence and domain

**Decision**: All rates share maximum physical index `8,998,201,053,687 = floor(Number.MAX_SAFE_INTEGER/1001)`. Validate finite nonnegative times and safe integer counts/intermediates. For coordinate `x=t*p/q`, treat values within `8*Number.EPSILON*max(1,abs(x))` of the nearest integer as that boundary; floor outside the band. Nearest snap uses the existing operation choice after boundary normalization.

**Rationale**: Exact starts can round just below an integer. Research sampled two million starts at each supported rate and found direct error below one scaled epsilon. The chosen band is approximately 9.2e-9 frames at 24h/60fps and below 0.016 even at the domain ceiling. It cannot merge adjacent frames. Values inside the band intentionally share boundary interpretation.

**Alternatives considered**: Blind floor breaks round trips; broad fixed epsilon changes timing; rate-dependent q=1 domains can grow tolerance beyond one frame; BigInt or tagged boundary-number state is unnecessary. Test offsets of `max(32*EPSILON*max(1,n),1e-7)` frames before/after a boundary and explicitly reject values beyond the supported domain.

## 6. Tempo inversion stability

**Decision**: Use the algebraically equivalent rationalized linear-segment inverse `2*elapsed/(sqrt(discriminant)+factor1)` in the existing TempoMap and affected retained adapter copies, preserving constant branches and tempo law.

**Rationale**: Current subtraction cancels at shallow slopes. A 120→120.000001 BPM segment over 1000 beats returns 60.060 seconds about 0.000127 frames late after an inverse/forward round trip; rationalization reduces this example to about 2.1e-13 frames. This is necessary for exact-start integration, not a new curve type.

**Alternatives considered**: Inflate timecode epsilon to hide the tempo error, or redesign all tempo interpolation (rejected). Add one primary shallow-ramp regression and a distinct SMPTE integration case.

## 7. Frame snapping and consumers

**Decision**: Add a focused SMPTE FRAME branch in existing snap utilities, converting through elapsed time and the complete tempo map. Generate visible frame grid lines from integer indices. Keep unrelated snap categories unchanged.

**Rationale**: Current scalar-tempo beat spacing cannot represent physical frames across tempo changes. Relevant consumers and source mapping are in plan.md; text entry already has a cached full-context TempoMap adapter. PianoRoll TimeBar additionally hardcodes 24 and needs project-format propagation without changing its local origin.

**Alternatives considered**: Only replace 1/29.97 with a rational while keeping scalar beat spacing (insufficient), or create a generic snapping framework (unnecessary).

## 8. History and settings

**Decision**: One atomic typed updateTimeState patch through existing structural ProjectHistory with semantic label `Change SMPTE Format`; keep timebase-conversion options inactive unless primary timebase actually changes. Add `defaultSmpteDropFrame=false` to existing preferences.

**Rationale**: Existing updateTimeState history route preserves project identity; current rate validation merely checks positivity and needs strict pair validation. Renderer optimistic score/context/transport state must update or roll back together. Preferences are independent of existing documents.

**Alternatives considered**: Renderer-only mode, direct model writes, separate rate/mode entries, or applying defaults on reopen (rejected).

## Research completion

All decisions are resolved and trace to spec requirements. Planning requires no new dependency, license exception, non-undoable mutation, external transport, or user approval. The implementation phase must verify the documented precision/tempo behavior and actual source provenance; this research is not implementation evidence.

## Implementation provenance review — 2026-09-30

The conversion owner and primary vector suite are original TypeScript written from the independent minute-segment derivation in [Public Calculation Basis](public-calculation-basis.md). Rechecked the public [SMPTE ST 12-1:2014 PDF](https://pub.smpte.org/latest/st12-1/st0012-1-2014.pdf) on 2026-09-30; sections 4.9, 5.1, 5.2.1–5.2.2 and 12 establish rational physical rates, numbering omissions and frame-pair transport distinctions. Blue's 59.94 labels count individual software frames; no wire encoder is included. Source comments and independent vectors link the same rule basis.

Read LICENSING.md, the data package MIT license, metadata and third-party notices, and app GPL-3.0-or-later metadata before implementation. No upstream conversion source, source excerpt, generated table, dependency or external asset was incorporated. The existing Apache-2.0 lookup tables and their notices are unaffected. This is original work within the existing MIT data scope and GPL app/documentation scope, without cross-scope source translation. Prior investigation of Java and upstream implementations remains honestly recorded in the original review; no formal clean-room claim is made.

Consulted Java RulerConfigDialog's eight numeric choices and misleading historical drop label, and TimeUnitTextField's clock-plus-fraction formatter. The intentional divergence corrects fractional NDF and implements explicit DF, without retiming stored content. The rationalized quadratic inverse retains TempoMap's existing tempo law; only cancellation error is corrected. No licensing exception or new distribution obligation is introduced.

Public-reference link check: R1–R5 in Public Calculation Basis were opened successfully on 2026-09-30. The SMPTE summit PDF contains 160 pages; product/manual links remain explanatory corroboration, not incorporated source.
