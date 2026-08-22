# Audition ScoreObjects Contracts

## Native menu command

Electron main sends this command to the renderer when the enabled Project-menu item or its accelerator is activated:

```ts
{ type: 'audition-score-objects' }
```

The renderer must flush pending project patches before submitting the invocation request. It must ignore the command when no eligible score selection remains.

## Renderer availability notification

Renderer sends a fire-and-forget availability update whenever the eligible score selection changes and clears it on project close:

```ts
syncAuditionScoreObjectAvailability(canAudition: boolean): void
```

Electron main combines this with loaded-project and exclusive-render state, rebuilds the native menu when its effective value changes, and does not treat it as authority to render an object.

## Renderer invocation request

Renderer invokes this request after flushing patches:

```ts
auditionScoreObjects(objectIds: string[]): Promise<boolean>
```

Validation and results:

- `objectIds` must be a non-empty list of unique, non-blank strings.
- Main resolves every ID against its canonical open project; missing, duplicate, library, Blue Live, nested/out-of-scope, or otherwise non-auditionable IDs reject the complete request.
- `true` means the request was accepted for existing realtime startup; `false` means rejection or startup failure, with existing playback status/error messages used for diagnostics.
- The request must not mutate canonical project data, project XML, the renderer selection, or app settings.

## Accelerator contract

The Project-menu item uses `CmdOrCtrl+Shift+A`:

| Platform | Displayed/effective shortcut |
|---|---|
| macOS | Cmd+Shift+A |
| Windows | Ctrl+Shift+A |
| Linux | Ctrl+Shift+A |

The accelerator must dispatch the same `audition-score-objects` command and availability checks as clicking the menu item.
