# Contract: Native Confirmation

## Boundary

`packages/blue-app/src/shared/confirmation-dialog.ts` defines data-only request/result types and runtime validation. `packages/blue-app/src/main/native-confirmation.ts` is the sole production adapter to Electron `dialog.showMessageBox`. Renderer callers reach it through one context-isolated preload API; they never import Electron.

Conceptual interface:

```ts
showNativeConfirmation(request: NativeConfirmationRequest): Promise<NativeConfirmationResult>
```

Main-owned workflows call the underlying service with their explicit `BrowserWindow`. The IPC handler resolves renderer ownership from `BrowserWindow.fromWebContents(event.sender)` and does not accept a renderer-supplied window identifier.

## Preconditions and validation

- Request data must be plain serializable data of the shape in `data-model.md`.
- Strings are non-empty and bounded; action IDs are unique.
- `defaultActionId` and `cancelActionId` name declared actions.
- Checkbox fields are either wholly absent or valid.
- Invalid requests are rejected before Electron is invoked and cannot perform guarded work.
- A destroyed/missing renderer owner resolves fail-closed to the declared cancel action with `owner-unavailable`.

## Response semantics

- The adapter converts semantic actions to Electron button indexes internally.
- Electron's `response` index is mapped back to the declared action ID before leaving the module.
- Escape, close, out-of-range response, adapter error, and owner loss never map to acceptance.
- Checkbox state is returned only for requests that declared a checkbox.
- Callers branch on semantic action IDs, never array positions or truthiness.

## Ownership and concurrency

- The dialog is parented to the exact valid initiating window.
- No fallback to the first window or an unparented guarded dialog is allowed.
- The API is asynchronous; no `showMessageBoxSync`, browser modal, or event-loop spin is permitted.
- Callers capture and revalidate mutable operation targets after acceptance.

## Error behavior

Validation/programming errors are observable to tests/logging but do not imply acceptance. Runtime owner loss and adapter failure produce the safe cancellation result so a guarded operation can stop deterministically. Subsequent mutation failures use each workflow's existing error surface and do not rewrite the decision as success.

## Verification contract

Tests must cover request validation, unique/default/cancel IDs, each semantic response mapping, checkbox mapping, dismissal, invalid response, adapter rejection, explicit ownership, IPC sender ownership, destroyed owner, and absence of duplicate Electron invocation. ESLint must prevent direct production message-box calls outside this adapter.
