# Feature Specification: Normalize Application Confirmation Dialogs

**Feature Branch**: `083-normalize-confirmation-dialogs`

**Created**: 2026-08-21

**Status**: Complete

**Completed**: 2026-08-22

**Input**: User description: "Create a new branch and spec for normalizing confirmation dialogs. Review the report for replacing window.confirm with Electron methods, evaluate consistency throughout the application, and require the resulting guidance to be recorded in a durable project document."

## Clarifications

### Session 2026-08-21

- Q: How should the repository-wide audit banning synchronous browser confirmations (FR-003/FR-016) be enforced? → A: ESLint rule scoped to production sources; inline disable comments with rationale are the documented exception mechanism.
- Q: What disposition should the adjacent window.prompt() and window.alert() usages receive (FR-013)? → A: Migrate both in this feature — BSB prompt moves to the in-app name-entry pattern; the placeholder alert is replaced with the app notification surface.
- Q: How deep does FR-009's "bring them under the shared policy" go for existing confirmations? → A: Full consolidation — existing native message-box confirmations move onto the shared native confirmation contract and existing in-app confirmation modals adopt the shared in-app behavior, preserving per-flow response semantics.
- Q: What should replace the placeholder window.alert() in workbench-store.ts? → A: Remove the placeholder path entirely; the Tools > Blue Share menu item stays visible but disabled (`enabled: false`).
- Q: What default focus/Enter behavior should the shared in-app confirmation surface use for destructive actions? → A: Cancel receives initial focus and Enter; per-flow overrides require documented rationale in docs/confirmation-dialogs.md.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirm a host-owned operation without freezing the application (Priority: P1)

When a user performs an operation that affects the project lifecycle, shared libraries, files, or another host-owned resource, they want a clear, native confirmation that belongs to the active Blue window and returns an unambiguous decision without freezing the application.

**Why this priority**: These operations can discard or overwrite user data and can be initiated from more than one window or entry path. A predictable, non-blocking confirmation is the primary safety and platform-integration goal.

**Independent Test**: Exercise each host-owned confirmation with an active project window, a secondary/floating window where applicable, keyboard dismissal, explicit cancellation, and explicit acceptance. Verify that the correct owner is used, the operation remains unchanged when cancelled, and the renderer remains responsive while the confirmation is open.

**Acceptance Scenarios**:

1. **Given** a host-owned operation is ready to perform a destructive or replacement action, **when** the user opens its confirmation, **then** the dialog names the action, identifies the affected resource when useful, presents an explicit action and cancel choice, and does not block unrelated renderer event processing.
2. **Given** a host-owned confirmation is open, **when** the user presses Escape, closes the dialog, or selects Cancel, **then** the operation is not performed and the current project, library state, and open editor state remain unchanged.
3. **Given** the initiating window is known and still alive, **when** the confirmation is shown, **then** it is attached to that window and does not appear as an unrelated or orphaned application dialog.
4. **Given** the initiating window is destroyed before the confirmation can be shown, **when** the operation is resumed, **then** the operation fails closed or uses a valid active owner according to the documented policy and never proceeds without an explicit affirmative decision.

---

### User Story 2 - Confirm an editor-local action in a consistent accessible modal (Priority: P1)

When a user discards editor changes or performs an irreversible action inside a score, instrument, or library editor, they want a confirmation that fits the current application surface, explains the consequence, preserves focus, and does not mutate the document until they accept.

**Why this priority**: Editor-local actions require context-rich content and sometimes additional choices. Treating them as browser popups produces inconsistent focus, wording, and keyboard behavior beside the existing in-app dialogs.

**Independent Test**: Open each affected editor-local workflow, trigger its confirmation, accept and cancel it with pointer and keyboard input, and verify focus restoration, accessible dialog semantics, and the exact mutation boundary.

**Acceptance Scenarios**:

1. **Given** an editor-local destructive or discard action has been requested, **when** its confirmation appears, **then** it uses the shared in-app confirmation behavior, exposes an accessible dialog or alert-dialog name and description, moves focus into the dialog, and provides a visible Cancel action.
2. **Given** an editor-local confirmation is open, **when** the user presses Escape, clicks Cancel, or dismisses the modal, **then** the editor remains open with its current draft or selection intact and focus returns to the initiating control or surface.
3. **Given** the user accepts an editor-local confirmation, **when** the mutation completes, **then** the dialog closes, the mutation is applied exactly once, and any affected selection or editor state follows the existing workflow.
4. **Given** a confirmation requires a preview, checkbox, or more than two meaningful actions, **when** the user reviews it, **then** the required context and choices are shown in the in-app surface rather than being compressed into a generic browser prompt.

---

### User Story 3 - Extend confirmation behavior without creating a new exception (Priority: P2)

When a maintainer adds or changes a confirmation, they want a documented decision rule, shared wording and button semantics, a known ownership boundary, and a test pattern that makes the new flow consistent with existing ones.

**Why this priority**: Confirmation behavior is cross-cutting. Without a durable inventory and policy, future work will reintroduce synchronous browser dialogs or create another one-off modal variant.

**Independent Test**: Follow the documented addition checklist for a new confirmation, verify that the inventory and policy are updated, and run the repository audit that detects disallowed browser confirmation calls.

**Acceptance Scenarios**:

1. **Given** a new confirmation is proposed, **when** a maintainer classifies it using the documented policy, **then** the chosen native or in-app surface, owner, button order, cancel behavior, and mutation boundary are recorded before implementation.
2. **Given** the application contains a confirmation decision, **when** the repository-wide audit is run, **then** it finds no production use of synchronous browser confirmation APIs and reports any new exception with its documented rationale.
3. **Given** a confirmation policy or ownership rule changes, **when** the implementation is updated, **then** the durable policy document and affected tests are updated in the same change.

### Edge Cases

- A native dialog is dismissed by Escape, the window close affordance, or an operating-system-specific cancel gesture; every such dismissal is treated as Cancel unless the documented flow explicitly requires another safe outcome.
- A user changes the selected object, project revision, library preview, or draft while an asynchronous confirmation is open; the operation revalidates its target and confirmation token before mutation and fails safely if the target is stale.
- A confirmation is requested from a floating editor, settings window, or another auxiliary window; the dialog is associated with that initiating window rather than always using the main workbench window.
- A renderer-local modal is opened while another modal or context menu is active; focus, z-order, keyboard handling, and dismissal remain deterministic and only the topmost confirmation consumes the interaction.
- A user accepts a confirmation but the subsequent save, mutation, or host operation fails; the failure is reported without treating the failed operation as completed or silently discarding the user's data.
- A destructive action has no valid target, its preview fails, or its preview expires; no confirmation is shown for an invalid target and no mutation is attempted.
- A native owner is unavailable because the window is closing or destroyed; the operation must not continue merely because a dialog could not be attached.
- The `window.prompt()` name-entry calls in the BSB preset bar and the placeholder `window.alert()` notification are adjacent synchronous browser APIs, not confirmation decisions; the prompt calls are in-scope migrations to the in-app name-entry pattern under FR-013, and the alert path is removed with the Tools > Blue Share item kept visible but disabled, so neither remains a hidden exception.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide one documented classification policy that distinguishes host-owned confirmations from renderer-local confirmations based on lifecycle ownership, resource impact, need for contextual content, and initiating window.
- **FR-002**: Every production confirmation decision MUST use the classification policy and MUST be represented by either the asynchronous native confirmation mechanism for host-owned workflows or the shared accessible in-app confirmation behavior for renderer-local workflows.
- **FR-003**: Production renderer code MUST NOT use `window.confirm()`, bare `confirm()`, or equivalent synchronous browser confirmation APIs. A repository-wide audit MUST cover TypeScript/TSX production sources and exclude tests, fixtures, generated output, and user-authored project/example content. The audit MUST be enforced as an ESLint rule (e.g. `no-alert` or `no-restricted-syntax`) whose configuration performs the source scoping and exclusions, and any intentional exception MUST be an inline ESLint disable comment carrying its documented rationale.
- **FR-004**: Host-owned confirmations MUST cross the established main/preload boundary through a typed, serializable contract, use an asynchronous native dialog path, attach to the initiating valid window when possible, provide explicit button semantics, and treat an unselected or dismissed response as Cancel.
- **FR-005**: Host-owned confirmations MUST NOT use a synchronous native message-box path or block the renderer or main-process event loop while waiting for user input.
- **FR-006**: Renderer-local confirmations MUST use a reusable in-app surface with consistent focus entry and restoration, modal or alert-dialog semantics, an accessible name and description, Escape/Cancel handling, explicit action labels, and a single mutation callback that cannot run twice for one decision.
- **FR-007**: Confirmation copy MUST identify the action and affected object or resource when it changes the user's decision, use specific action verbs instead of generic OK/Confirm labels for destructive actions, and provide a visible safe cancellation path. Button order and default/cancel behavior MUST be documented for each multi-action flow. The shared in-app confirmation surface MUST give the safe cancellation action initial focus and Enter-default behavior for destructive confirmations; a flow MAY override this only with documented rationale in `docs/confirmation-dialogs.md`.
- **FR-008**: The implementation MUST migrate or otherwise resolve all seven production confirmation call sites identified in the feature audit: linked SoundObject cut and fresh library database creation in `library-store.ts`; Code Repository discard; BSB preset/folder deletion; project SoundObject library deletion; Score Manager layer-group removal; and score-object conversion to Object Builder. No audited call may remain as a synchronous browser confirmation.
- **FR-009**: The implementation MUST audit all existing native message-box confirmations and all existing in-app confirmation-like modals, including project replacement, unsaved settings, unsaved library editors, file overwrite/export, library deletion, and layer removal, and MUST consolidate them onto the shared native confirmation contract or the shared in-app confirmation behavior respectively. Consolidation MUST preserve each flow's semantic response mapping, button order, default/cancel behavior, and cancellation semantics rather than imposing one universal button order. A flow that cannot adopt the shared surface MUST record a specific intentional exception with its rationale.
- **FR-010**: Confirmation flows that depend on a preview, revision, or confirmation token MUST revalidate that state after the asynchronous decision and immediately before mutation; a stale, expired, or invalid target MUST fail closed without applying the action.
- **FR-011**: Cancellation, dismissal, owner-window loss, dialog failure, save failure, and mutation failure MUST preserve the existing project document, file path, dirty state, library state, editor drafts, and selection state unless the user explicitly accepted a completed operation and the existing workflow defines a partial result.
- **FR-012**: Confirmation state MUST remain transient UI/session state. It MUST NOT be written to `.blue` project XML, generated CSD, program settings, library files, or any other persistent project-owned data.
- **FR-013**: The implementation MUST resolve the adjacent production browser-modal usages identified in the feature research as part of this work: the BSB preset/folder `window.prompt()` name-entry calls in `BSBPresetBar.tsx` MUST move to the existing in-app name-entry pattern, and the placeholder `window.alert()` notification path (the `show-not-yet-implemented` command reachable from the Tools > Blue Share menu item) MUST be removed together with its `buildPlaceholderItem`/`onNotYetImplemented` wiring, with the Blue Share menu item remaining visible but disabled. Any other adjacent browser modal API discovered during implementation MUST receive an explicit disposition — migrated, intentionally excluded with reason, or named follow-up with its owning feature area.
- **FR-014**: The implementation MUST create or update `docs/confirmation-dialogs.md` as a durable maintainer reference. The document MUST contain the classification decision table, native versus in-app ownership rules, response/button semantics, accessibility and focus requirements, cancellation and stale-state rules, the audited call-site inventory, adjacent prompt/alert dispositions, testing expectations, and instructions for updating the document when a confirmation is added or changed.
- **FR-015**: The durable documentation and the implementation MUST be updated in the same change when a confirmation is added, removed, reclassified, or intentionally exempted. The documentation MUST link to the relevant tests or verification command without embedding transient implementation notes in project data.
- **FR-016**: Automated coverage MUST exercise each migrated confirmation's acceptance and cancellation path, the relevant keyboard dismissal path, stale-target or failed-operation behavior where applicable, and owner-window or preload/main contract behavior for host-owned confirmations. The ESLint audit rule from FR-003 MUST verify that no disallowed production browser confirmation call remains.

### Audited Scope and Initial Classification

The implementation plan MUST start from the inventory in [`research.md`](research.md), verify every row against the current tree, and update the classification if implementation evidence changes the boundary.

| Surface | Current behavior | Initial policy classification | Required outcome |
|---|---|---|---|
| Linked SoundObject cut (`library-store.ts`) | Browser confirmation after a deletion preview | Host-owned/shared-library decision with affected-score consequences | Move to the documented confirmation surface; preserve preview/token revalidation and no-op on Cancel |
| Fresh Libraries database (`library-store.ts`) | Browser confirmation before a host storage reset | Host-owned persistent-resource decision | Use the asynchronous native confirmation contract or a documented equivalent with fail-closed behavior |
| Code Repository close | Browser confirmation when a draft is dirty | Renderer-local discard decision | Use the shared in-app confirmation behavior and preserve the draft on Cancel |
| BSB preset/folder deletion | Browser confirmation in the preset manager | Renderer-local editor decision | Use the shared in-app confirmation behavior and specific Delete action wording |
| Project SoundObject library deletion (`SoundObjectLibraryPanel.tsx`) | Browser confirmation after a project-library preview | Renderer-local/library preview decision | Align with the existing library deletion preview surface and preserve linked-editor safeguards |
| Score Manager layer-group removal | Bare browser confirmation; nearby layer removal already uses an in-app dialog | Renderer-local score-editor decision | Use the shared in-app confirmation behavior and align wording/keyboard semantics with layer removal |
| Score-object conversion to Object Builder | Browser confirmation for a non-undoable conversion | Renderer-local score-editor decision | Use the shared in-app confirmation behavior and preserve the existing project-document mutation boundary |

The initial classification is a policy starting point, not permission to add a second confirmation implementation. The implementation plan MUST resolve any disagreement with evidence from the affected workflow and update both this inventory and the durable maintainer document.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Existing Blue workflows already use asynchronous native confirmations for project replacement, unsaved settings, unsaved library editors, file overwrite, and library export; renderer workflows already use accessible in-app dialogs for library deletion previews and layer removal. Java Blue remains the behavior reference for non-undoable score operations and destructive editor semantics where applicable. The external platform reference is the [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog), with the [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model) and [IPC guidance](https://www.electronjs.org/docs/latest/tutorial/ipc) defining the main/preload/renderer boundary.
- **Compatibility Requirements**: Existing save/discard/cancel outcomes, project replacement timing, library preview and confirmation-token semantics, editor draft preservation, score mutation semantics, BSB preset behavior, native-window ownership, and `.blue` project data MUST remain compatible except for the presentation and asynchronous execution of the audited browser confirmations. A cancelled or failed decision MUST not emit a successful mutation or close an editor.
- **Intentional Divergences**: The feature intentionally removes synchronous browser confirmations and standardizes their ownership, wording, accessibility, and cancellation semantics. It also resolves the two audited adjacent browser-modal paths under FR-013: the BSB name prompts move to in-app text entry, while the Blue Share placeholder alert path is removed and its menu item remains disabled. Other non-confirmation surfaces are classified rather than converted into confirmations.
- **State Ownership**: Host-owned confirmation decisions and their transient response mapping remain owned by the Electron main process behind typed preload contracts. Renderer-local confirmation visibility and focus state remain transient renderer state. Canonical project mutations continue through the existing document bridge; library mutations continue through the library service and confirmation-token lifecycle. No confirmation state is persisted in project XML or library/project data.

### Key Entities *(include if feature involves data)*

- **Confirmation Request**: A transient request describing the user-visible action, affected resource, owner window, available decisions, and the mutation or operation it guards.
- **Confirmation Decision**: A typed transient result such as accept, discard, overwrite, cancel, or a context-specific action, with dismissal normalized to the safe cancellation outcome.
- **Confirmation Policy Entry**: The durable inventory record that maps a workflow to its ownership classification, presentation surface, button semantics, cancellation rule, tests, and documentation status.
- **Pending Operation Target**: The project, library, editor, selection, preview, revision, or token that must still be valid when the user accepts the confirmation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the seven audited production confirmation paths present an explicit, accessible action and cancellation choice, and 100% of cancellation or dismissal scenarios leave the guarded operation unapplied.
- **SC-002**: 100% of host-owned confirmation paths remain responsive while the user decides and use the initiating valid window when one exists; no synchronous browser or native confirmation path remains in production code.
- **SC-003**: 100% of renderer-local confirmation paths support keyboard and pointer cancellation, return focus to the initiating surface, and apply their guarded mutation at most once after acceptance.
- **SC-004**: 100% of audited preview/token/revision workflows reject stale or invalid targets after an asynchronous decision and before mutation, with no unintended project, library, or editor change.
- **SC-005**: All existing native and in-app confirmation-like workflows reviewed in the audit have a recorded classification and are consolidated onto the shared native contract or shared in-app behavior, or carry a documented intentional exception, with no undocumented parallel confirmation pattern introduced by the feature.
- **SC-006**: The durable documentation in `docs/confirmation-dialogs.md` is present, links the complete current inventory to verification coverage, and is updated in the same change as the implementation.
- **SC-007**: Existing project replacement, unsaved settings, library draft, overwrite/export, library deletion, score layer removal, BSB preset, Code Repository, and score-object regression tests remain green, and new tests cover every migrated acceptance/cancellation branch.

## Assumptions

- Native confirmation is the default for lifecycle, file-system, engine/runtime, and other host-owned decisions that may be initiated outside a renderer-local editor; renderer-local modals remain the default for context-rich editor workflows.
- The existing preload/context-isolated architecture is the only supported renderer-to-host boundary; renderer code will not import Electron modules or receive arbitrary privileged objects.
- “Cancel” includes Escape, dialog close, loss of an owner before a safe prompt can be shown, and any invalid or unrecognized response unless a workflow explicitly documents a safer equivalent.
- The existing library deletion preview and layer-removal modal patterns are reusable evidence for the shared in-app behavior; the feature does not require a new visual component library unless planning finds a concrete gap.
- The feature does not change `.blue` XML, generated CSD, program-settings persistence, or library-file formats.
- The current audit treats user-authored examples and embedded scripting APIs as content rather than application confirmation surfaces; production application code and maintainer-facing documentation remain in scope.
- No clarification is required for the initial native-versus-in-app classification because the implementation plan must verify the inventory against the live workflows and document any evidence-based reclassification.
