# Render and Freeze IPC Contract

This contract defines the main/preload/renderer boundary. The renderer supplies user intent and existing score-object target locations; the main process owns settings lookup, project state, dialogs, filesystem access, subprocesses, and canonical mutation.

## Renderer-to-main methods

```ts
type DiskRenderAction = 'render' | 'play' | 'open';

interface RenderToDiskRequest {
  action: DiskRenderAction;
}

interface FreezeScoreObjectsRequest {
  targets: ScoreObjectEditorTargetSnapshot[];
}

interface CancelRenderOperationRequest {
  operationId: string;
}

blueAPI.renderToDisk(request: RenderToDiskRequest): Promise<RenderOperationResult>;
blueAPI.freezeScoreObjects(request: FreezeScoreObjectsRequest): Promise<FreezeOperationResult>;
blueAPI.cancelRenderOperation(request: CancelRenderOperationRequest): Promise<boolean>;
```

The renderer MUST NOT send an executable path, arbitrary output path for Freeze, raw XML, or a prebuilt normal command. The main process obtains current project data, current project path, Program Disk Render settings, Program Utility settings, and project properties itself.

## Main-to-render status event

```ts
interface RenderOperationStatus {
  operationId: string;
  kind: 'diskRender' | 'freeze';
  phase: 'preparing' | 'rendering' | 'inspecting' | 'committing' | 'completed' | 'cancelled' | 'failed';
  message: string;
  progress: number | null;
  outputPath: string | null;
  error: string | null;
}

blueAPI.onRenderOperationStatus(listener: (status: RenderOperationStatus) => void): () => void;
```

Status events are informational and must not be the source of canonical project state. The existing project-document broadcast remains authoritative after a successful Freeze/Unfreeze mutation.

## Results

```ts
interface RenderOperationResult {
  ok: boolean;
  operationId: string;
  cancelled: boolean;
  outputPath: string | null;
  error: string | null;
}

interface FreezeOperationResult {
  ok: boolean;
  operationId: string;
  cancelled: boolean;
  frozenCount: number;
  unfrozenCount: number;
  deletedFiles: string[];
  rejectedTargets: Array<{ selectionId: string; reason: string }>;
  error: string | null;
  project: ProjectEditorSnapshot | null;
}
```

## Success and failure rules

- Render success requires the expected output file to exist after the child process exits successfully.
- Render-and-play/open follow-up actions run only after Render success and receive the exact output path.
- Freeze success requires a verified freeze artifact and readable WAV/AIFF metadata before canonical replacement.
- A failed/cancelled Freeze returns an error and leaves canonical score content unchanged.
- A successful Freeze/Unfreeze increments the existing project revision and broadcasts `PROJECT_DOCUMENT_UPDATED_CHANNEL` to all workbench windows.
- Concurrent render/freeze requests are rejected or queued behind the single active operation; they must not share a mutable child-process handle.

## Command and path rules

- Normal disk commands use executable-plus-argv execution with the project directory as working directory.
- Complete project overrides preserve Java-compatible command-line semantics and must identify an output file before reporting completion.
- Freeze stores only a project-relative `freezeN.wav`/`freezeN.aif` filename in the project model.
- All filesystem resolution and deletion is performed by the main process after validating the current project directory.
