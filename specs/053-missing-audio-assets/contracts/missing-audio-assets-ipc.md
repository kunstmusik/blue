# Contract: Missing Audio Assets IPC

**Feature**: Missing Audio Asset Check On Project Load
**Branch**: `053-missing-audio-assets`
**Created**: 2026-07-02

## Shared Types

Define these shared contracts in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/missing-audio-assets.ts`.

```ts
export interface MissingAudioAssetRow {
  originalPath: string;
  replacementPath: string;
}

export interface MissingAudioAssetsSession {
  sessionId: string;
  projectSessionId: number;
  projectFilePath: string | null;
  missingFiles: MissingAudioAssetRow[];
}

export interface MissingAudioAssetReplacement {
  originalPath: string;
  replacementPath: string;
}

export interface MissingAudioAssetsResolveRequest {
  sessionId: string;
  replacements: MissingAudioAssetReplacement[];
}

export interface MissingAudioAssetsResolveResult {
  ok: boolean;
  changed: boolean;
  stale?: boolean;
  project?: import('./project-editor').ProjectEditorSnapshot;
}
```

`ProjectLoadedPayload` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts` gains an optional field:

```ts
missingAudioAssets?: MissingAudioAssetsSession;
```

## Project Loaded Event

### Channel

`project-loaded`

### Payload

Existing `ProjectLoadedPayload`, optionally including `missingAudioAssets`.

### Rules

- `missingAudioAssets` is absent when no missing AudioFile references are found.
- `missingAudioAssets.missingFiles` contains one row per unique unresolved original path.
- Each row starts with `replacementPath: ''`.
- The project is already open when this event is delivered.

## IPC: Choose Replacement File

### Channel

`missing-audio-assets:choose-replacement`

### Request

```ts
{
  sessionId: string;
  originalPath: string;
  currentReplacementPath?: string;
}
```

### Response

```ts
string | null
```

### Rules

- Returns a selected filesystem path when the user chooses a file.
- Returns `null` when the user cancels the native file chooser or the session is stale.
- The selected path is not applied to the project until the user confirms the modal.

## IPC: Resolve Replacements

### Channel

`missing-audio-assets:resolve`

### Request

`MissingAudioAssetsResolveRequest`

### Response

`MissingAudioAssetsResolveResult`

### Rules

- If the session is stale, return `{ ok: false, changed: false, stale: true }` and make no changes.
- Empty replacement lists are successful no-ops: `{ ok: true, changed: false }`.
- Non-empty replacement lists apply only rows whose replacement path is non-empty and different from the original path.
- Applied replacement paths are normalized relative to the current project directory when possible.
- When any AudioFile path changes, return `{ ok: true, changed: true, project }` with a refreshed project snapshot.
- The renderer marks the project dirty only when `changed` is true.

## IPC: Dismiss Session

### Channel

`missing-audio-assets:dismiss`

### Request

```ts
{
  sessionId: string;
}
```

### Response

```ts
{ ok: true }
```

### Rules

- Dismissal clears the pending session if it is still active.
- Dismissal never changes AudioFile paths.
- The project remains open.

## Renderer Expectations

- The modal opens after `project-loaded` if the payload contains `missingAudioAssets`.
- Browse on a row calls `missing-audio-assets:choose-replacement`.
- OK calls `missing-audio-assets:resolve`.
- Cancel, overlay close, or Escape calls `missing-audio-assets:dismiss`.
- If resolve returns a refreshed project snapshot, the renderer applies it to the project store.
