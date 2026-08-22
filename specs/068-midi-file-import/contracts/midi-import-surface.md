# MIDI Import Surface Contract

This contract describes the main/preload/renderer seam. It is deliberately independent of the `midi-file` package types.

## Native menu

Extend `ApplicationMenuTemplateOptions` with:

```ts
onImportMidiFile?: () => void;
```

`buildFileMenuTemplate` should use this callback for **Import MIDI File** when `hasProject` is true. The disabled/no-project behavior remains consistent with the other import actions.

The main handler owns the file chooser and parser. It does not install a project until the renderer has accepted the mapping dialog.

## Preload API

Expose typed methods on `blueAPI`:

```ts
type MidiImportStartResult =
  | { status: 'cancelled' }
  | { status: 'ready'; token: string; preview: MidiImportPreview }
  | { status: 'error'; message: string };

type MidiImportCommitResult =
  | { status: 'cancelled' }
  | { status: 'installed'; project: ProjectEditorSnapshot }
  | { status: 'error'; message: string };

interface BlueApi {
  startMidiImport(): Promise<MidiImportStartResult>;
  commitMidiImport(
    token: string,
    settings: MidiImportSettings[],
  ): Promise<MidiImportCommitResult>;
  cancelMidiImport(token: string): Promise<void>;
}
```

The exact existing `BlueApi` declaration shape should be extended rather than duplicated. The result snapshot uses the existing project-loaded/editor refresh contract; no new project patch union is needed because this action replaces the project, like CSD import.

## Dialog behavior

1. The native menu callback asks the renderer to open the MIDI import dialog, or the renderer invokes `startMidiImport` in response to the command.
2. `startMidiImport` opens the native file chooser, reads and parses the file in main, validates PPQ format 0/1, stores the normalized document under a pending token, and returns the preview.
3. The dialog renders one row per preview stream and initializes the Java-compatible defaults.
4. Cancel calls `cancelMidiImport`; the dialog closes without a project-loaded event.
5. Accept validates rows locally and sends the token/settings to main. A cancelled replacement confirmation leaves the dialog open; the dialog closes only after an `installed` result.
6. Main revalidates the token/settings, converts the retained document with the pure data helper, applies the current project default layer-group type and extracted MIDI tempo map, then runs save/library replacement confirmations. It revalidates the pending session after those asynchronous confirmations, performs the normal import replacement lifecycle, clears the pending token, and returns the refreshed snapshot.

## Failure semantics

- File chooser cancellation returns `cancelled`.
- Parser errors, malformed chunks, unsupported format/division, invalid settings, and conversion errors return `error` with a user-facing message and leave the current project unchanged.
- A renderer reload or project-session change invalidates pending tokens; a stale commit is rejected rather than applied to a different project.
- The renderer must not display raw parser stack traces or file contents in the error dialog.
