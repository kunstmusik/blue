# Feature Specification: Number Input Consolidation

**Feature Branch**: `100-number-input-consolidation`

**Created**: 2026-09-04

**Status**: Complete

**Completed**: 2026-09-05

**Input**: User description: "CommitNumberInput's arrow/spinner changes should commit immediately since stepping only produces valid values pre and post press, while typed text keeps free editing and commits only when editing finishes. Audit all number inputs to see if we can replace them all with CommitNumberInput; move the component to a more central location as a generally reusable component."

## Clarifications

### Session 2026-09-04

- Q: Should migration expand to all native number inputs while preserving intentional live updates, dialog-owned drafts, and external validation? → A: Yes. Extend CommitNumberInput to cover all native number inputs while preserving those behaviors; formatted time and unit-aware text editors remain outside scope.
- Q: Should stepping use a valid typed draft, falling back to the last accepted value when the draft is empty or invalid? → A: Yes. Step from the valid typed draft; otherwise step from the last accepted value, applying the field’s step and validation policy and immediately notifying the current editing owner.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Immediate Stepper Commit (Priority: P1)

With the default commit-on-finish editing policy, a user adjusting a numeric field with the spinner arrows (mouse) or the up/down arrow keys sees each step applied to the underlying value immediately, without needing to leave the field. Typing remains a free-form draft: the value is committed only when editing finishes (leaving the field or pressing Enter) and Escape discards the uncommitted draft.

**Why this priority**: Today a stepped value diverges from the model until the field loses focus — the screen shows one number while the saved project holds another — and pressing Escape after stepping silently discards the steps. This is the behavioral defect that motivated the feature, and fixing it in the shared component benefits every existing jmask field immediately.

**Independent Test**: In any jmask numeric field, click the spinner (or press ArrowUp/ArrowDown) several times and inspect the stored value: it equals the stepped result with no blur required. Typing a new value, pressing Escape, retyping, and pressing Enter still commits only the retyped value.

**Acceptance Scenarios**:

1. **Given** a focused numeric field showing 1.0, **When** the user presses ArrowUp three times, **Then** the underlying value receives three updates (1.1, 1.2, 1.3) — one per press, none deferred to blur.
2. **Given** a field showing 1.0, **When** the user presses ArrowUp (which commits 1.1), then types without committing and presses Escape, **Then** the field returns to 1.1 — the last committed value — not the pre-step 1.0.
3. **Given** a field already at its maximum, **When** the user presses ArrowUp, **Then** no change is committed and the next typed value still commits correctly (the no-op step cannot corrupt the following commit).
4. **Given** a focused field, **When** the user types an incomplete number such as `1.` or `-`, **Then** nothing is committed until editing finishes, exactly as today.
5. **Given** a spinner click, **When** the mouse button is released, **Then** one step is applied per click, immediately, without requiring a subsequent blur.

6. **Given** a last accepted value of 1 and step 1, **When** the user types 5 without committing and presses ArrowUp, **Then** 6 is accepted immediately in one update, with no intermediate commit of 5.
7. **Given** a last accepted value of 1 and step 1, **When** the draft is empty or invalid and the user presses ArrowUp, **Then** 2 is accepted immediately in one update.

### User Story 2 - One Shared Component in a Central Location (Priority: P2)

A developer adding or editing any numeric field imports one component from a central, feature-neutral location instead of the jmask-specific directory, and the jmask feature itself consumes it from there. The component keeps its current tested contract: draft editing, commit-on-finish, clamping, and caller styling override.

**Why this priority**: The component is nested five levels deep inside a feature directory and imported via six-level relative paths, yet it is the only commit-style number abstraction in the app. Its home should reflect that it is app-wide, not jmask-owned, before migration multiplies its consumers.

**Independent Test**: After a pure relocation with re-imports and no behavioral edits, every existing jmask field behaves exactly as before and the component's class-composition test still passes.

**Acceptance Scenarios**:

1. **Given** the jmask editors, **When** the component is relocated, **Then** all existing jmask behavior and tests are unchanged.
2. **Given** any area outside the jmask subtree (settings, dialogs, score-object editors, panels), **When** a developer needs a numeric field, **Then** the shared component is importable from the same central location that hosts other cross-cutting input primitives.

### User Story 3 - Migrate Eligible Number Inputs (Priority: P3)

All 66 audited native number input sites migrate to the shared component. Ordinary fields gain commit-on-finish editing; live editors, dialog-owned drafts, and externally validated settings retain their existing editing policies. Numeric commits must be finite and follow the field’s documented validation rules.

**Why this priority**: Shared editing mechanics remove duplication while preserving each field’s intentional workflow and protecting committed values from invalid numeric input.

**Independent Test**: For each migrated field: clearing it follows the documented fallback or retained validation-draft policy without persisting invalid numeric data, and the area’s existing behavior tests remain applicable.

**Acceptance Scenarios**:

1. **Given** the mixer "extra render time" field, **When** the user clears it and moves focus away, **Then** the stored value does not become NaN (it reverts or applies the documented fallback).
2. **Given** the BlueLive tempo or repeat field, **When** the user clears it and moves focus away, **Then** no NaN reaches the project store.
3. **Given** a migrated integer-only field (for example steps-per-beat), **When** the user types `2.7` and commits, **Then** the integer policy is applied per the field's documented rule rather than storing 2.7.
4. **Given** a migrated field with bounds, **When** the user types an out-of-range value and commits, **Then** the stored value respects that field's documented bound behavior (clamp, revert, or reject), matching what the field guarantees today.
5. **Given** a migrated field whose validity depends on a sibling value (paired line min/max), **When** the user commits a value that violates the pair rule, **Then** the edit is rejected or clamped per the field's documented rule and the pair stays consistent.

### User Story 4 - Preserve Specialized Editing Policies (Priority: P4)

The shared component also serves blue-x7 live editing, OK-commit dialogs, and validator-driven settings. Reuse preserves their update timing, undo granularity, mixed-value display, invalid-draft visibility, and validation messages.

**Why this priority**: These workflows require capabilities beyond the current component's number-only, commit-on-blur contract. Their intentional behavior is a requirement for extending the component, not a reason to exclude them.

**Independent Test**: Each specialized field uses the shared component and its existing live-update, single-patch-on-OK, cancellation, and external-validation tests still pass.

**Acceptance Scenarios**:

1. **Given** a blue-x7 operator field, **When** the user types, **Then** each accepted numeric edit still patches the value immediately with the existing undo granularity; invalid input and mixed selections retain their existing behavior.
2. **Given** the settings freeze-jobs field, **When** the user enters an out-of-range draft and applies, **Then** the draft is still preserved visibly and the main-process validator still reports the actionable error.
3. **Given** the tempo-point dialog, **When** the user edits its fields and confirms with OK, **Then** exactly one value patch is applied per confirm, as today.
4. **Given** an OK-commit dialog, **When** the user steps a field and then cancels, **Then** only the dialog draft changed and no project patch is emitted.
5. **Given** an externally validated settings field, **When** the user enters an invalid value and blurs, **Then** the invalid draft remains available to the existing validator rather than being silently clamped or reverted.

### Edge Cases

- Stepping after typing: use the draft if valid under the field’s numeric policy; otherwise use the last accepted value. Apply the field’s stepping and validation rules to the result, without first committing the unstepped draft.
- Stepping at a boundary (min/max or dynamic bound): no spurious change event; the following keystroke commits normally.
- External updates to the same value while a field is focused (another panel mutates the shared state): the user's draft must not be clobbered mid-edit; after committing, the display resynchronizes to the authoritative value.
- Empty text: follows the field’s documented fallback or caller-owned draft policy; invalid drafts may remain visible for validation but cannot become a non-finite committed numeric value.
- Incomplete numeric text (`1.`, `-`, `1e`) held mid-edit: default editing does not commit partial text; specialized policies preserve existing draft notification and validation behavior.
- Display-vs-stored unit transforms (MIDI channel 1-based display over 0-based storage; key transpose ±24 offset): display and commit transforms must be inverses and the stored value must remain in storage units.
- Dialogs where Enter/Escape belong to the dialog itself (FontChooser, OK-commit dialogs): a caller-draft input without field finish/cancel callbacks must let those keys bubble and must not blur or double-handle them.
- Fields rendered with a disabled or read-only state must not commit or accept drafts while disabled or read-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shared numeric field MUST apply each stepper change (spinner click and ArrowUp/ArrowDown) to the current editing owner immediately — one update per accepted step, no blur required. For OK/Apply workflows that owner is the caller’s draft, not the persisted project/settings; existing confirmation and cancellation boundaries remain intact.
- **FR-002**: The shared numeric module MUST expose separate named interfaces for commit-on-finish numeric values, live numeric values, and caller-owned text drafts. `CommitNumberInput` provides free editing while focused, commits on blur or Enter, discards on Escape, and reverts unparseable text. `LiveNumberInput` preserves immediate accepted edits. `DraftNumberInput` preserves caller-owned text without imposing default blur/Enter normalization.
- **FR-003**: A step attempt that cannot change the value (already at a bound) MUST NOT emit a spurious change and MUST NOT alter the commit semantics of subsequent typed input.
- **FR-004**: The component MUST live in the central shared components location used by other cross-cutting input primitives, and every existing call site MUST import it from there.
- **FR-005**: Relocation MUST be behavior-preserving for all existing consumers: commit semantics, clamping, and caller styling override precedence are unchanged, apart from the explicitly required immediate stepper behavior. Existing behavior assertions remain applicable; relocation imports may change.
- **FR-006**: The module MUST support the editing capabilities the audit found necessary at migration sites: field-specific integer parsing/rounding, disabled and read-only states, empty-text policies (revert, documented default, or retained caller draft), mixed-value placeholders, live updates, caller-owned text drafts, external validation, dynamic bounds, paired/cross-field validation (clamp or reject per field), commit-time rounding where a field defines it, forwarding of the attributes needed for accessibility and existing test selection, and key handling that does not interfere with dialog-level Enter/Escape.
- **FR-006a**: Editing behavior MUST be selected by the named input interface rather than a public `mode` property. Keyboard ownership MUST NOT be a freely combinable `keyOwner` property: ArrowUp/ArrowDown belong to every numeric input; `CommitNumberInput` and `LiveNumberInput` own Enter/Escape; `DraftNumberInput` owns Enter only when `onFinish` is supplied and Escape only when `onCancel` is supplied, otherwise those keys bubble to the caller.
- **FR-007**: Every native number input in research.md (all 66 audited sites, including the former KEEP sites) MUST be migrated to the shared component.
- **FR-008**: Migration MUST prevent non-finite numeric commits, including MixerPanel extra render time and BlueLive tempo/repeat. Invalid text may remain in caller-owned validation drafts. Clearing the existing Number(text) handlers yields zero, not NaN; validation must test empty and non-finite cases separately.
- **FR-009**: The blue-x7 family, OK-commit dialogs, and validator-driven settings fields MUST migrate while retaining their existing update timing, undo behavior, draft ownership, validation messages, and confirmation/cancellation behavior and coverage.
- **FR-010**: Each migrated field MUST preserve its user-visible value domain — min/max/step semantics and documented bound behavior — as recorded per field in research.md.
- **FR-011**: research.md MUST be maintained as the canonical inventory: every renderer numeric input mapped to a disposition (migrated / kept) and rule, updated if any disposition changes during delivery.
- **FR-012**: Stepping MUST start from the valid typed draft, or the last accepted value when the draft is empty or invalid. The resulting step MUST follow the field’s step and validation policy and notify the current editing owner once if accepted; the unstepped draft MUST NOT produce a separate commit.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue is the field-specific reference, not a uniform commit-timing contract. For example, blue-ui-core’s blue/soundObject/editor/jmask/ConstantEditor.java updates valid values on document changes and restores invalid text on focus loss. Preserve field value domains and document timing differences explicitly.
- **Compatibility Requirements**: No change to `.blue` XML, CSD generation, the project data model, or persisted value formats. Every migrated field accepts and stores the same domain of values it does today, with its bound behavior documented per field in research.md. Automated coverage that asserts input structure (input type, element ids, min attributes) must keep passing.
- **Intentional Divergences**: The default deferred text-editing policy intentionally differs from Java’s live document updates in editors such as ConstantEditor, preserving the existing TypeScript draft workflow. Immediate stepping is the requested behavior; focused tests must cover both timing policies. At ordinary commit-on-finish migration sites the *timing* of when an edited value is applied changes (per-keystroke to commit-on-finish) — that is the feature's purpose and is recorded per field in research.md.
- **State Ownership**: Dialog and settings drafts remain caller-owned and are persisted only through existing OK/Apply actions. Authoritative values remain owned by their current stores — the canonical project document bridge for project data, the app settings store for settings. The shared component owns nothing beyond its transient text draft.

### Key Entities *(include if feature involves data)*

- **Shared numeric input module**: a renderer module with named commit, live, and draft interfaces over one private input/stepping implementation; each interface declares only its applicable value ownership and notification contract.
- **Numeric input inventory (research.md)**: the authoritative mapping of every renderer numeric input to its disposition and rule; it drives migration scope and acceptance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of accepted stepper/arrow changes immediately update the appropriate editing owner (one notification per accepted step); boundary no-ops emit zero updates and dialog cancellation emits zero project patches.
- **SC-002**: All 66 audited native number input sites use the shared component, directly or through a wrapper; no independent native number input implementation remains outside the shared component. Additional discovered native number sites must also be inventoried and migrated.
- **SC-003**: No migrated numeric field can persist a non-finite or out-of-policy numeric value; invalid validation drafts remain permitted (targeted tests for project-store-backed and settings-backed fields).
- **SC-004**: All pre-existing renderer tests pass, and new focused tests cover: immediate step commit, boundary step no-op, Escape-after-step reverting to the last committed value, empty-text fallback per policy, stepping from valid drafts and from the last accepted value for empty/invalid drafts, non-interference with dialog-level Enter/Escape, exactly one field finish across Enter followed by blur, and zero finish callbacks from Escape followed by blur.
- **SC-005**: No duplicated generic numeric editing lifecycle remains at migrated sites. Caller-owned domain validation, unit transforms, dialog transactions, and project patch/undo operations remain with their existing owners.

## Assumptions

- blue-x7's live editing, OK-commit dialogs, and validator-error settings fields are in scope through named editing interfaces. The shared module must not take ownership of domain validation or persistence.
- Unit-aware text editors (TimeUnitEditor and its inline duplicates), formatted time fields, double-click-to-edit display widgets, and the four string-typed project-properties numeric fields (sample rate, ksmps, channels, 0dBFS — retaining their existing string data contracts) are out of scope; they are recorded in research.md as future consolidation candidates.
- "Immediate" for mouse spinners means one step per click; whether native spinner events can be distinguished from typing reliably enough, or explicit stepper controls replace them, is an implementation decision deferred to planning — provided FR-001's observable behavior holds.
- Migrated fields keep their current visual width and theme via the component's existing caller-override mechanism; adding size/variant conveniences is optional, not a requirement.
- The component name stays `CommitNumberInput`; co-locating the string analogue `CommitTextInput` alongside it is a desirable but optional part of the relocation.

## Closure

Completed on 2026-09-05. All 50 implementation and convergence tasks are checked, all 66 audited native number-input sites route through the shared `CommitNumberInput`, `LiveNumberInput`, or `DraftNumberInput` implementation, and the old jmask-local implementation is removed.

The focused browser suite, all 429 `@blue/app` test files, the aggregate workspace test suite, renderer build, lint/format checks, and `git diff --check` pass. The renderer-wide TypeScript command retains the explicitly approved baseline of 686 unrelated pre-existing diagnostics; filtering the same output to Spec 100 production paths reports zero diagnostics. Actual Electron 35.7.5 interactions were recorded on macOS, while native Windows and Linux scenarios remain explicitly unavailable rather than inferred from Chromium coverage. See [quickstart.md](quickstart.md) for the complete evidence and [tasks.md](tasks.md) for the closed task ledger.
