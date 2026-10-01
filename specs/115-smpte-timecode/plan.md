# Implementation Plan: Standards-Based SMPTE Timecode

**Branch**: `codex/115-smpte-timecode` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: `specs/115-smpte-timecode/spec.md`

**Status**: Complete — final convergence 2026-10-01; see [quickstart.md](quickstart.md) for validation and exceptions.

## Summary

Correct fractional-rate NDF and provide real 29.97/59.94 DF using original MIT-compatible rational frame/counting code in the portable data package. Keep project format canonical in score TimeState, propagate it to all display/entry paths, persist a mode extension without changing stored timing, and reuse canonical history. Public rules and independent values are recorded in [Public Calculation Basis](public-calculation-basis.md).

## Technical Context

**Language/Version**: Strict TypeScript 5.x, ES2022; existing Electron 39 and React 19 application.

**Primary Dependencies**: Existing `@blue/data`, `@rgrove/parse-xml`, typed project document bridge, ProjectHistory, and TempoMap. No new dependency or conversion source port.

**Storage**: Canonical `.blue` score/timeState XML for project format; existing program-settings store for defaults. Existing TimeContext numeric rate remains a compatibility carrier.

**Testing**: Existing Vitest suites and main-history integration harness; independent fixed vectors and boundary enumeration.

**Target Platform**: Desktop macOS/Windows/Linux; data conversions also browser-safe.

**Project Type**: Portable data library plus Electron desktop app.

**Performance Goals**: Constant-time frame/label conversion, no per-frame scan in playback display; visible grid work proportional to displayed marks.

**Constraints**: MIT-compatible original data code; zero-origin extended-hour timeline; no engine protocol or playback-speed change; no 24-hour wrap; supported integer domain and explicit representation-error policy.

**Scale/Scope**: Eight physical rate selections, ten rate/mode combinations, existing SMPTE consumers, project/default persistence, history, and frame snap. No video/sync transport or speculative format framework.

## Constitution Check

Gate evaluated before Phase 0 research; final design re-evaluation appears below.

| Gate | Initial result | Basis |
| --- | --- | --- |
| Portable data core | PASS | Pure frame/label arithmetic, static imports, existing portable XML utilities; no host/DOM dependencies. |
| Java and project compatibility | PASS | Java dialog/formatter consulted; spec explicitly corrects legacy arithmetic. Numeric XML carriers and stored timing remain compatible. |
| Canonical ownership and contracts | PASS | TimeState owns presentation format; contexts/snapshots derive it; program defaults remain separate. |
| Project history and undo/redo | PASS | Existing typed updateTimeState patch and ProjectHistory handle durable format changes; focused round-trip proof required. |
| Runtime and engine isolation | PASS | Presentation changes do not add engine messages or data-layer host access. |
| Host-path portability | N/A | No host-path transformation or new filesystem code. |
| Verification evidence | PASS | Independent conversion vectors, XML/history tests, surface agreement checks, and commands in quickstart. |

## Project Structure

### Documentation (this feature)

```text
specs/115-smpte-timecode/
├── spec.md
├── public-calculation-basis.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/timecode-contract.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

All 51 tasks in [tasks.md](tasks.md) are complete. Final convergence leaves that file unchanged.

### Source Code (repository root)

```text
packages/blue-data/src/
├── time/smpte-timecode.ts                 # new pure original conversion owner
├── time/time-state.ts                    # mode and preserved unknown XML
├── time/tempo-map.ts                     # same-law stable inverse
├── time/snap-value.ts                    # rational frame-duration compatibility
└── index.ts                              # required public static exports
packages/blue-app/src/
├── shared/project-editor/                # contracts, patch validation, snapshots
├── shared/program-settings.ts            # defaults and supported-pair validation
├── main/program-settings-application.ts   # seed new-project mode
├── main/project-history-roundtrip.test.ts # canonical restoration proof
├── renderer/time/time-unit-logic.ts       # entry/display and complete tempo conversion
├── renderer/components/menu-bar/toolbar-formatters.ts
├── renderer/components/settings/ProjectDefaultsSettings.tsx
└── renderer/components/workbench/panels/ # score rulers, editors, frame snap
```

**Structure Decision**: One small conversion module in the existing portable package; reuse existing adapters and document/history routes. Replace duplicated label arithmetic, not entire large components. No new service, engine abstraction, or dependency.

## Phase 0 — Research Decisions

See [research.md](research.md). Resolved decisions: exact rates; full-frame high-rate display; one presentation owner; boolean mode extension; preserve legacy numeric recovery as NDF; narrowly bounded floating equivalence; stable existing tempo inverse; physical-time frame snapping; original-code provenance. No unresolved clarification remains.

## Phase 1 — Design and Integration

### Conversion and numerical behavior

Use the independent minute-segment derivation from Public Calculation Basis. Keep rate descriptors static and conversion constant-time. Strict parser returns a rejected value for malformed/omitted/mismatched labels; format consumers show the existing invalid-value placeholder rather than NaN or a fabricated label.

Use physical frame limit `floor(Number.MAX_SAFE_INTEGER/1001)` for every rate and validate count intermediates. In frame coordinate `x=t*p/q`, normalize to the nearest integer only within `8*Number.EPSILON*max(1,abs(x))`; otherwise floor for display. This band is below 0.016 frames even at the thousands-of-years limit. Test exact starts and offsets outside the band. Nearest/floor snap retains the caller's operation policy.

Stabilize `TempoMap.secondsToBeats`' existing linear-segment quadratic inverse as `2*elapsed/(sqrt(discriminant)+factor1)`, with the existing constant-segment branch. Preserve the current tempo law and Java parity outside the explicitly documented numerical improvement. Reuse the existing full-context adapter for new frame snapping; apply the same algebraic stabilization to existing inverse copies that remain on affected paths rather than rewriting tempo semantics.

### Ownership, persistence, and contracts

Add `smpteDropFrame=false` to TimeState; retain numeric alias `smpteFrameRate`. Add mode to ScoreTimeStateSnapshot, TimeConversionContext, and ToolbarProjectTransportSnapshot. Change toolbar snapshot creation to read format from TimeState, matching score/editor snapshots. Leave TimeContext's stored numeric carrier/default untouched; no additional editable mode owner is added there.

Write `<smpteDropFrame>true</smpteDropFrame>` only for DF; omit false to avoid unnecessary Java-fixture changes. Read absence as false, independent of the old UI label or numeric rate. Preserve recognized legacy suffix recovery (`29.97df`→29.97, `30df`→30) as NDF when no explicit new mode exists; do not infer DF from the suffix or map exact 30 to 29.97. Explicit new mode governs if valid. Invalid persisted combinations recover to NDF at the recovered supported rate; invalid/missing TimeState rate uses its existing 24 default. Invalid submitted patches are rejected atomically.

Preserve TimeState's unrelated unknown children/attributes using cloned unknown XML only, including copy/history state; do not keep raw shadow copies of modeled fields. This is scoped lossless-data preservation, not a whole-XML rewrite. Round-trip tests must cover it at the project boundary.

Validate the effective rate/mode pair before any updateTimeState mutation. One combined SMPTE Format selector in Ruler Configuration and Project Defaults lists only the ten valid pairs. The 29.97 and 59.94 choices include explicit (NDF)/(DF) suffixes; other rates have plain fps labels. Reuse one shared option list and retain separate numeric/Boolean storage fields. A selection sends the pair in one patch. Use semantic history label `Change SMPTE Format`; retain existing object/marker edit labels. Update renderer optimistic state and rollback/publication together so timeState, contexts, and transport cannot transiently disagree.

Defaults add `defaultSmpteDropFrame=false` to existing program settings and validation. Missing old preference means false. New projects seed both fields; opening existing projects does not apply defaults. Defaults do not enter project history until embodied in a new document's initial state.

### Consumer and snap integration

Route text entry in time-unit-logic, transport labels, score ColumnHeader, and PianoRoll TimeBar through the shared conversion. Propagate the project format to PianoRollEditor/TimeBar; preserve its local timeline origin while using the applicable complete tempo context. Keep sample FRAME units distinct from SMPTE frames.

SMPTE snap must operate beat→elapsed seconds→physical frame floor/nearest→elapsed seconds→beat. The current scalar beat interval from snapValueToBeats cannot correctly follow a varying tempo map. Add a narrow FRAME branch in existing snap-grid-utils and reuse full tempo conversion, retaining musical/TIME/SAMPLE/AUTO branches. Wire ScoreTimeCanvas, TrackLayerGroupCanvas, MarkersBar, useScoreRulerSelection, tempo-map-utils/tempo views, AutomationLayerOverlay, MultiLineOverlay, and automation-line-utils. Frame grid marks derive integer frame indices at a display-appropriate stride, never accumulated fractional beat intervals. Remove hardcoded 24/30 rates only from affected SMPTE paths.

### Verification and provenance

Primary conversion coverage belongs to a data-package suite with fixed vectors and independent counting checks. App coverage proves mode propagation, complete-tempo integration, validation behavior, and the ownership correction rather than duplicating all arithmetic. Add distinct project XML/copy and history round-trip cases. Include a shallow tempo ramp (120→120.000001 BPM over 1000 beats) because the current inverse exhibits cancellation at exact frame boundaries.

Cite public sources and original derivation alongside the conversion and primary tests. Record no third-party code adaptation/dependency in the implementation review; if that changes, perform the explicit provenance/license review before incorporation. Update docs/manual/time.qmd, release notes, and Spec 114's M18 history accurately.

## Post-Design Constitution Check

All initial PASS gates remain PASS. Public data code stays MIT-compatible and host-neutral; Java divergences are named; TimeState is the presentation owner; typed patches/history persist and restore the mode; telemetry remains transient; no paths or engine protocol change. The unknown-XML retention is limited to touched TimeState data and does not introduce modeled-field shadow state. Planned regression coverage and commands appear in quickstart. There are no requested exceptions.

## Complexity Tracking

No constitution violation or added architectural layer is required. Keep the existing enum export for compatibility; do not repurpose its unused string members as persisted rate identifiers or perform unrelated cleanup.

## Final Design Verification — 2026-10-01

The implementation satisfies the planned portable conversion owner, rational rates and numerical limits, stable tempo inversion, canonical TimeState ownership, compatible persistence and cloned unknown XML, atomic history/publication, separate defaults, shared display/entry consumers, physical-frame snapping, and provenance/documentation obligations. Ruler Configuration, Project Defaults, and both Playhead SMPTE submenus share the ten valid format pairs required by the final FR-001 contract. All six constitution core principles remain satisfied within this scope; only original code was added within the existing MIT data and GPL app/documentation scopes, with no new dependency or third-party source adaptation.

Final validation passes except for the documented renderer no-emit baseline diagnostics. The earlier native engine-stop smoke limitation is retained without claiming stop reliability. The owner-directed save-preservation audit remains deferred to a separate spec and does not weaken this feature's TimeState round-trip obligations.
