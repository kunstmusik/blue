# Feature Specification: Standards-Based SMPTE Timecode

**Feature Branch**: `codex/115-smpte-timecode`

**Created**: 2026-09-30

**Status**: Complete — converged 2026-10-01; validation exceptions recorded in [quickstart.md](quickstart.md)

**Input**: Correct Blue's 29.97 drop-frame/non-drop-frame behavior and frame-rate settings in line with industry standards, with public calculation references and license-compatible original implementation.

## User Scenarios & Testing

### User Story 1 - Match the Project's Timecode Format (Priority: P1)

A composer working to picture selects the rate and counting mode used by the source material. Rulers, transport, markers, and score-object editors display and interpret the same frame labels.

**Why this priority**: Incorrect timecode can place an edit on the wrong physical frame even though its displayed time looks correct.

**Independent Test**: Select 29.97 NDF or DF with a known tempo map and compare display and entry with the independent examples in [Public Calculation Basis](public-calculation-basis.md).

**Acceptance Scenarios**:

1. **Given** 29.97 NDF and zero origin, **when** the position is exactly 60 elapsed seconds, **then** every SMPTE display shows `00:00:59:28` using the containing-frame policy.
2. **Given** 29.97 NDF, **when** entering `00:01:00:00`, **then** the position is 1800 physical frames from origin, or 60.060 elapsed seconds.
3. **Given** 29.97 DF, **when** advancing from physical frame 1799 to 1800, **then** the label changes from `00:00:59;29` to `00:01:00;02`.
4. **Given** 29.97 DF, **when** advancing from physical frame 17981 to 17982, **then** the label changes from `00:09:59;29` to `00:10:00;00`.
5. **Given** an existing marker or score object, **when** switching counting mode or physical rate, **then** stored position and duration stay unchanged while SMPTE presentation changes.
6. **Given** a tempo change before an edited position, **when** a valid SMPTE label is entered, **then** Blue locates the specified elapsed-time frame through the complete applicable tempo map.

---

### User Story 2 - Enter Valid Timecode and Snap to Physical Frames (Priority: P1)

A composer enters frame positions or durations and uses frame snapping without nonexistent labels, ambiguous separators, or accumulated rounding errors.

**Why this priority**: Correct display alone does not prevent invalid entry or edits that drift from the physical frame grid.

**Independent Test**: Enter valid and invalid boundary labels and snap near known physical frame boundaries at every supported rate.

**Acceptance Scenarios**:

1. **Given** 29.97 DF, **when** entering `00:01:00;00` or `00:01:00;01`, **then** entry is rejected with a useful validation message and project content is unchanged.
2. **Given** 29.97 DF, **when** entering `00:10:00;00`, **then** Blue accepts it as physical frame 17982.
3. **Given** 29.97 NDF, **when** entering a valid frame component 29, **then** it is accepted and displayed without clamping to 28.
4. **Given** NDF mode, **when** entering semicolon DF notation, **then** Blue rejects the mode mismatch. DF entry requires a semicolon before the frame component.
5. **Given** malformed, negative, non-finite, or out-of-range SMPTE input, **when** submitting it, **then** Blue rejects the complete input rather than accepting a numeric prefix or aliasing another frame.
6. **Given** the same physical rate and frame snap setting, **when** counting mode changes, **then** the physical snap grid is unchanged.
7. **Given** an exact frame-start time obtained from parsing, **when** displaying it again, **then** Blue returns the same label rather than the preceding frame because of numerical representation.
8. **Given** a position or duration at or beyond 24 hours, **when** displaying or entering it, **then** total hours are retained without wrapping to an earlier timeline position.

---

### User Story 3 - Save, Reopen, and Undo Timecode Settings (Priority: P1)

A composer can reopen a project with its selected format intact and undo or redo format changes without losing edits or changing playback timing.

**Why this priority**: Format selection is durable project state; recovery and history must be reliable.

**Independent Test**: Change format, save/reopen, and perform commit→undo→redo while checking project content and dirty state.

**Acceptance Scenarios**:

1. **Given** a Java Blue project with numeric 29.97 and no explicit mode, **when** opening it in Blue 3, **then** it defaults to NDF and preserves stored positions, durations, and unrelated project data.
2. **Given** a saved DF project or copied project state, **when** loading it, **then** rate and mode are restored across all affected surfaces.
3. **Given** a clean project, **when** committing a format change and undoing it, **then** prior format, canonical snapshots, and clean state are restored; redo restores changed format and dirty state without replacing stable project identities.
4. **Given** active playback, **when** format changes or is undone, **then** displayed timecode reconciles with current playback position without changing engine timing, sample rate, or playback speed.
5. **Given** app-wide defaults, **when** creating a project, **then** it receives the selected valid rate/mode combination; existing projects remain unchanged. Defaults lacking a mode use NDF.
6. **Given** a canceled dialog or no-op change, **when** closing it, **then** neither project content nor history changes.
7. **Given** a DF project, **when** selecting an NDF-only rate, **then** Blue visibly selects NDF in the same undoable change.

---

### User Story 4 - Understand and Audit the Correction (Priority: P2)

Users understand the choices, and maintainers can trace calculations and code provenance to public sources.

**Why this priority**: The existing label repair can be mistaken for standards compliance; traceable evidence also avoids incompatible source imports.

**Independent Test**: Review documentation, public links, independent vectors, and provenance of every new or adapted calculation component.

**Acceptance Scenarios**:

1. **Given** the Time chapter and release notes, **when** reading about 29.97, **then** users learn that DF skips labels rather than media, both modes use the same physical rate, and correcting display does not move stored content.
2. **Given** implementation changes, **when** auditing provenance, **then** rules, derivation, expected results, and applicable licenses are identified without private source access.
3. **Given** historical M18, **when** documenting this correction, **then** the record distinguishes the earlier label repair from this standards-behavior correction.

### Edge Cases

- Zero, first skipped minute, tenth minute, hour boundary, and times at or immediately around frame starts.
- Fractional-rate aliases versus exact rational rates and the last valid nominal frame label.
- Unsupported rate/mode pairs, omitted labels, malformed fields, trailing characters, incompatible separators, and negative input.
- Positions/durations at and above 24 hours; they must not wrap or alias earlier content.
- Exact frame starts after conversion through constant/changing tempo maps.
- Legacy numeric values without a mode, unsupported historical string values, canceled dialogs, no-op changes, copied state, and live playback.

## Requirements

### Functional Requirements

- **FR-001**: Blue MUST present one combined SMPTE Format selector in ruler configuration and new-project defaults. It MUST offer ten valid rate/mode choices: separate `29.97 fps (NDF)`/`29.97 fps (DF)` and `59.94 fps (NDF)`/`59.94 fps (DF)` options, with other rates labeled simply `23.976 fps`, `24 fps`, `25 fps`, `30 fps`, `50 fps`, and `60 fps`. There MUST be no separate counting-mode dropdown; selecting a format MUST update the stored numeric rate and Boolean mode atomically. The Playhead Primary and Secondary format menus MUST offer the same choices in an SMPTE submenu, checking the current project pair only when that readout is explicitly set to SMPTE. No SMPTE option is checked while Sync to Ruler or another display mode is selected. Choosing a submenu option MUST switch that readout to SMPTE and commit the project pair through history; Sync to Ruler remains available.
- **FR-002**: Blue MUST retain rates 23.976, 24, 25, 29.97, 30, 50, 59.94, and 60; offer explicit NDF/DF choices for 29.97 and 59.94; and use NDF for other listed rates. Switching to an NDF-only rate MUST select NDF atomically and visibly.
- **FR-003**: Physical rates behind 23.976, 29.97, and 59.94 MUST be `24000/1001`, `30000/1001`, and `60000/1001`; integer rates MUST remain exact. Display aliases MUST NOT substitute rounded decimal rates in calculations.
- **FR-004**: NDF MUST count every physical frame continuously at the nominal label count. At non-tenth minute starts, 29.97 DF MUST omit labels 00–01; Blue's full-frame 59.94 DF MUST omit 00–03. Outcomes MUST match [Public Calculation Basis](public-calculation-basis.md).
- **FR-005**: Rulers, transport, marker editors, score-object position/duration editors, and other SMPTE surfaces MUST agree on effective project format and use the complete applicable tempo map.
- **FR-006**: NDF MUST display `HH:MM:SS:FF`; DF MUST display `HH:MM:SS;FF`. Entry MUST require the matching separator, complete nonnegative integer fields, minutes/seconds 00–59, and frames within the nominal range. Omitted DF labels and unsupported combinations MUST be rejected without changing content.
- **FR-007**: Display MUST identify the containing physical frame outside a documented numerical-equivalence band at frame boundaries; parsing MUST resolve a valid label to that frame's start. Values inside that narrow band MAY be treated as the same boundary to absorb representation error. Exact starts MUST survive parse→display without a one-frame regression, neighboring frames MUST remain distinct, and input beyond the supported exact-count range MUST be rejected.
- **FR-008**: SMPTE snap MUST use actual physical frame spacing and existing snap rounding behavior, independent of counting mode and through tempo changes.
- **FR-009**: Format changes MUST NOT retime objects, markers, automation, audio, or generated Csound content. Viewing/opening MUST NOT quantize stored subframe values.
- **FR-010**: Rate/mode MUST survive project save/reopen and copies. Existing numeric rate selectors MUST remain readable by the supported Java-compatible reader; absent mode MUST default to NDF. Unrelated modeled/unknown data MUST be preserved.
- **FR-011**: Durable format changes and SMPTE-based edits MUST use canonical ProjectHistory with semantic labels. Focused commit→undo→redo coverage MUST verify canonical values, identities/references, dirty state, publication, and applicable playback reconciliation. Cancel/no-op MUST create no entry.
- **FR-012**: App-wide new-project defaults MUST store a valid rate/mode separately from project content. Opening an existing project MUST NOT override its saved format with those defaults; missing default mode MUST mean NDF.
- **FR-013**: Blue elapsed positions/durations MUST retain total hours beyond 23, reject negative SMPTE entry, and avoid 24-hour wrapping. Document extended hours as a Blue timeline convention rather than a wire address. Duration differences MUST use physical time/frame counts rather than printed component subtraction.
- **FR-014**: Documentation/release notes MUST explain corrected legacy arithmetic, rational aliases, mode/separator rules, and preserved stored timing. M18 MUST NOT be represented as prior standard NDF verification.
- **FR-015**: New calculation code MUST be original work from public counting rules and compatible with its destination package license. GPL/LGPL source MUST NOT be copied or translated into MIT-licensed Blue-authored data code. Public readability MUST NOT be assumed to grant a permissive license.
- **FR-016**: Provenance MUST identify public URLs, versions/sections, access date, independently derived relationships, and boundary values. Any separately approved adaptation MUST identify source revision, license, notices, modifications, and distribution obligations before inclusion. AI generation MUST NOT substitute for provenance review.
- **FR-017**: Validation MUST use independent expected results and cover every supported rate, skipped/non-skipped boundaries, malformed input, persistence, and history. The implementation's arithmetic MUST NOT be the sole producer of expected results.

### Existing Behavior & Data Compatibility

- **Reference Behavior**: Java Blue's `RulerConfigDialog.java` labels 29.97 as drop while `TimeDisplayFormat.java` uses fractional elapsed seconds and clamps frames. Blue 3 inherits this and has separate ruler/transport formatter copies. Source locations and investigation are in [SMPTE Review](../../docs/smpte-timecode-review.md).
- **Compatibility Requirements**: Load supported Java `.blue` projects; preserve numeric selector values, stored timing, identities, and unrelated XML. Java need not preserve the new mode extension. Projects lacking explicit mode use NDF. Planning must inspect unsupported historical string recovery and MUST NOT silently convert `30df` to 29.97.
- **Intentional Divergences**: Replace clock-plus-fraction conversion with physical-frame timecode, allow valid final-frame labels, and offer real DF. These corrections fulfill the requested industry alignment. Stored timing remains unchanged; labels and newly entered text acquire corrected meanings. The plan must trace these divergences and validation.
- **State Ownership**: Active `BlueData` owns effective project format, persisted in canonical `.blue` XML. Derived contexts/snapshots consume it. App preferences own new-project defaults only. Playback telemetry remains transient runtime state.
- **Undo/Redo Impact**: Format changes and durable timecode edits use existing canonical history. Cancel restores prior document/runtime presentation. No non-undoable project mutation is authorized.

### Key Entities

- **Physical Frame Rate**: Exact ratio determining elapsed frame duration, with familiar selection/display alias.
- **Counting Mode**: NDF or DF; governs labels without changing physical rate.
- **Project Timecode Format**: Canonical rate/mode shared by display, entry, and snapping.
- **Timecode Label**: Hours, minutes, seconds, frame component, and mode punctuation identifying a frame from origin.
- **New-Project Defaults**: Preferences supplying an initial valid format.
- **Calculation Provenance**: Public rules, original derivation, independent expected values, and license records.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every supported rate/mode passes all applicable independent vectors in Public Calculation Basis, with no missing valid final-frame labels or emitted omitted DF labels.
- **SC-002**: For the same canonical position, 100% of affected SMPTE surfaces agree on labels after format changes, undo/redo, and reopen.
- **SC-003**: All invalid inputs defined by FR-006 are rejected without durable changes; every tested valid exact start returns its original label on parse→display.
- **SC-004**: Changes, save/reopen, and undo/redo preserve stored timing, stable identities, and playback timing in compatibility fixtures; dirty-state transitions match history.
- **SC-005**: At 29.97, NDF `01:00:00:00` resolves to 3603.600 seconds and DF `01:00:00;00` to 3599.996400 seconds. Equivalent 59.94 hour labels resolve to the same elapsed times.
- **SC-006**: Every new/adapted calculation component has an auditable provenance/license record; no incompatible copied code enters permissively licensed Blue-authored packages.
- **SC-007**: The Time chapter, project/default format choices, and release notes consistently explain both modes with at least one correct skipped-minute and one tenth-minute example.

## Assumptions

- Origin remains zero. User-defined offsets, video import/playback, external MTC/LTC synchronization, wire encoders, and audio pull-up/pull-down are out of scope.
- 59.94 DF is included because 59.94 is already supported and follows the same counting contract. Unusual exact-30/60 DF and exact-decimal 29.970000 compatibility modes are excluded.
- High-rate labels count individual frames (00–49 or 00–59) as a software display convention; this feature makes no wire-format conformance claim.
- Correct legacy display without a separate legacy arithmetic mode; preserve canonical timing and explain corrected text semantics in release notes.
- Public references establish technical/provenance evidence rather than blanket legal or patent clearance. Source/package license obligations remain applicable.
- Planning selects the smallest shared conversion design and explicit persistence extension satisfying this contract and the constitution.

## Implementation Closure — 2026-10-01

All 51 tasks are complete, including the prior convergence repairs, combined format selector, and Playhead SMPTE submenus. Final convergence checked all 17 functional requirements, seven success criteria, 24 acceptance scenarios, 13 buildable plan decisions, and six constitution core principles against the current implementation and verification evidence. No missing, partial, contradictory, or unrequested work remains within this feature's specified scope; no further implementation pass is needed.

The final full workspace tests, lint, data build, main/preload compilation, renderer production build, and whitespace checks pass. All 39 fixed label examples in the public calculation basis also pass. Renderer no-emit checking retains the documented 1,557 diagnostics; the earlier native engine-stop timeout remains a smoke-test limitation. See [quickstart.md](quickstart.md) for the closure record and accepted validation limits. The following preservation audit remains a separate follow-up.

## Deferred Follow-up

- **Save-preservation audit (next spec)** — Deferred by project-owner direction on 2026-10-01. Audit project XML load/save and copy/history paths, including TimeState's opaque unknown children and attributes. Distinguish supported fields that need explicit typed modeling from unsupported extensions retained for lossless round trips; evaluate ownership, validation/reporting of unrecognized data, and mutable aliasing. Decide the preservation policy and implementation boundaries in that spec, with focused project round-trip and history coverage. The current TimeState preservation implementation remains in place; this follow-up does not waive FR-010 or claim a repository-wide preservation audit is complete.
