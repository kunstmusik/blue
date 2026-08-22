# Contract: In-App Confirmation

## Boundary

`ConfirmationDialog` is a controlled renderer component. The caller owns visibility, draft/target data, and mutation. The component owns confirmation interaction behavior and returns only a semantic action ID.

Conceptual interface:

```ts
<ConfirmationDialog
  open={open}
  title={title}
  description={description}
  actions={actions}
  cancelActionId="cancel"
  initialFocusActionId={optionalDocumentedOverride}
  onDecision={(actionId) => ...}
>
  {optionalPreviewOrCheckboxContent}
</ConfirmationDialog>
```

## Accessibility and keyboard behavior

- The surface exposes `role="dialog"` or `alertdialog` according to urgency, `aria-modal="true"`, an accessible title, and description.
- Opening captures the invoking element, moves focus into the modal, and traps Tab/Shift+Tab within the topmost modal.
- Escape and backdrop/close dismissal resolve to `cancelActionId`.
- Closing restores focus to the captured opener when it remains connected.
- If any action is destructive, Cancel receives initial focus and therefore Enter activation by default.
- An initial-focus override requires a flow-specific rationale in `docs/confirmation-dialogs.md` and focused test coverage.

## Decision and mutation behavior

- Action IDs are unique; the cancel ID names a declared action.
- Disabled actions cannot resolve the dialog.
- An internal resolved guard allows `onDecision` at most once per opening, including competing click/Escape/unmount events.
- The component does not execute arbitrary mutations. The caller handles the semantic decision and revalidates its captured target before mutation.
- Cancel/dismiss leaves drafts, selection, project state, and library state untouched.

## Composition

Optional children may render previews, affected-item counts, checkboxes, or explanatory content. Existing wrappers may translate their domain callbacks into semantic actions, but must not reimplement focus, Escape, dismissal, or idempotence behavior. Text-entry and informational dialogs remain separate semantics.

## Verification contract

Component tests cover accessible name/description, modal role, safe initial focus, Enter on focused Cancel, Tab cycling, Escape/backdrop cancellation, focus restoration, disabled actions, at-most-once callback, and documented focus overrides. Each adopting flow also tests acceptance, cancellation, no pre-accept mutation, and stale/failed target behavior where relevant.
