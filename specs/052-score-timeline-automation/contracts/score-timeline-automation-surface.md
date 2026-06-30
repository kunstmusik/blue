# Contract: Score Timeline Automation Surface

**Feature**: `052-score-timeline-automation`
**Date**: 2026-06-04

## Purpose

This contract defines the shared score timeline automation surface between `packages/blue-app/src/shared/project-editor.ts` and the renderer score panel. It extends the existing score snapshot and project patch model rather than introducing a second renderer-only automation document.

## Snapshot Additions

`ScoreLayerSnapshot` gains an optional `automation` field. Patterns layers omit it.

```ts
export interface ScoreLayerSnapshot {
  layerId: string;
  name: string;
  height: number;
  muted?: boolean;
  solo?: boolean;
  items: ScoreRowObjectSnapshot[];
  noteProcessorChain?: NoteProcessorChainSnapshot;
  automation?: ScoreLayerAutomationSnapshot;
}
```

```ts
export type AutomationLayerKind = 'soundObject' | 'audio';
export type AutomationTargetSourceKind =
  | 'instrument'
  | 'mixer'
  | 'audioChannel'
  | 'effect'
  | 'send'
  | 'unknown';

export interface ScoreLayerAutomationSnapshot {
  layerId: string;
  layerKind: AutomationLayerKind;
  parameterIds: string[];
  selectedParameterId?: string;
  parameters: AutomationParameterSnapshot[];
  targetGroups: AutomationTargetGroupSnapshot[];
  missingParameterIds: string[];
}

export interface AutomationParameterSnapshot {
  parameterId: string;
  name: string;
  label: string;
  displayName: string;
  minimum: number;
  maximum: number;
  resolution: number;
  curve: string;
  fixedValue: number;
  automationEnabled: boolean;
  lineColor: number;
  sourceKind: AutomationTargetSourceKind;
  targetPath: string[];
  points: AutomationPointSnapshot[];
}

export interface AutomationPointSnapshot {
  time: number;
  value: number;
}

export interface AutomationTargetGroupSnapshot {
  groupId: string;
  label: string;
  subGroups: AutomationTargetGroupSnapshot[];
  targets: AutomationTargetSnapshot[];
}

export type AutomationAssignmentState =
  | 'available'
  | 'assignedCurrentLayer'
  | 'assignedOtherLayer'
  | 'missing';

export interface AutomationTargetSnapshot {
  parameterId: string;
  label: string;
  sourceKind: AutomationTargetSourceKind;
  automationEnabled: boolean;
  assignmentState: AutomationAssignmentState;
  ownerLayerId?: string;
  ownerLayerName?: string;
}
```

## Patch Additions

Add a score-scoped patch family under the existing `ProjectDocumentPatch` score mutation path.

```ts
export type ScoreAutomationPatch =
  | AssignAutomationToLayerPatch
  | RemoveAutomationFromLayerPatch
  | MoveAutomationToLayerPatch
  | ClearLayerAutomationsPatch
  | SelectLayerAutomationPatch
  | SetAutomationLineColorPatch
  | SetAutomationPointsPatch
  | InsertAutomationPointPatch
  | DeleteAutomationPointPatch
  | MoveAutomationPointPatch
  | MoveAutomationRangePatch
  | ScaleAutomationRangePatch
  | CleanupLayerAutomationPatch;

export interface ScoreAutomationLayerRef {
  rootGroupIndex: number;
  groupId: string;
  layerId: string;
  layerIndex: number;
  layerKind: AutomationLayerKind;
}
```

### Assignment Patches

```ts
export interface AssignAutomationToLayerPatch {
  type: 'assignAutomationToLayer';
  layer: ScoreAutomationLayerRef;
  parameterId: string;
  enableAutomation?: boolean;
}

export interface RemoveAutomationFromLayerPatch {
  type: 'removeAutomationFromLayer';
  layer: ScoreAutomationLayerRef;
  parameterId: string;
}

export interface MoveAutomationToLayerPatch {
  type: 'moveAutomationToLayer';
  fromLayer: ScoreAutomationLayerRef;
  toLayer: ScoreAutomationLayerRef;
  parameterId: string;
}

export interface ClearLayerAutomationsPatch {
  type: 'clearLayerAutomations';
  layer: ScoreAutomationLayerRef;
}

export interface SelectLayerAutomationPatch {
  type: 'selectLayerAutomation';
  layer: ScoreAutomationLayerRef;
  parameterId?: string;
}
```

Rules:

- `assignAutomationToLayer` removes the same `parameterId` from other automatable timeline layers before adding it to the requested layer.
- `removeAutomationFromLayer` removes only the requested id from the requested layer.
- `clearLayerAutomations` removes all assignment ids from the requested layer.
- `selectLayerAutomation` updates the selected layer parameter when this can be represented safely; otherwise renderer derives the selection from current interaction.

### Appearance Patch

```ts
export interface SetAutomationLineColorPatch {
  type: 'setAutomationLineColor';
  parameterId: string;
  lineColor: number;
}
```

Rules:

- `lineColor` updates the canonical `Parameter` line color and persists through `.blue` XML.

### Point Patches

```ts
export interface SetAutomationPointsPatch {
  type: 'setAutomationPoints';
  parameterId: string;
  points: AutomationPointSnapshot[];
}

export interface InsertAutomationPointPatch {
  type: 'insertAutomationPoint';
  parameterId: string;
  point: AutomationPointSnapshot;
}

export interface DeleteAutomationPointPatch {
  type: 'deleteAutomationPoint';
  parameterId: string;
  pointIndex: number;
}

export interface MoveAutomationPointPatch {
  type: 'moveAutomationPoint';
  parameterId: string;
  pointIndex: number;
  point: AutomationPointSnapshot;
}
```

Rules:

- The shared patch handler clamps values using the target parameter bounds and sorts points by time.
- The renderer may dispatch `setAutomationPoints` at gesture completion to keep undo grouping simple.
- Direct point patches are allowed for simple edits and tests.

### Range Patches

```ts
export interface AutomationRangeRef {
  startBeat: number;
  endBeat: number;
  layerIds: string[];
  parameterIdsByLayer: Record<string, string[]>;
}

export interface MoveAutomationRangePatch {
  type: 'moveAutomationRange';
  range: AutomationRangeRef;
  beatDelta: number;
  /** @deprecated Use objectIds for Java shift-gated parity. */
  includeScoreObjects?: boolean;
  /** @deprecated Use objectIds for Java shift-gated parity. */
  includeAudioClips?: boolean;
  /** Explicit object/clip IDs to transform (Java shift-gated selection model). */
  objectIds?: string[];
}

export interface ScaleAutomationRangePatch {
  type: 'scaleAutomationRange';
  range: AutomationRangeRef;
  anchorBeat: number;
  scaleFactor: number;
  /** @deprecated Use objectIds for Java shift-gated parity. */
  includeScoreObjects?: boolean;
  /** @deprecated Use objectIds for Java shift-gated parity. */
  includeAudioClips?: boolean;
  /** Explicit object/clip IDs to transform (Java shift-gated selection model). */
  objectIds?: string[];
}
```

Rules:

- Range move and scale mutate only included layers, included parameter ids, and points inside the selection range.
- `objectIds` (preferred) carries explicit object/clip IDs from the Java shift-gated selection model — only those objects move/scale. Object type (score object vs audio clip) is determined by `instanceof` in the handler.
- `includeScoreObjects` / `includeAudioClips` (deprecated booleans) match objects whose start falls within `[startBeat, endBeat]` on selected layers. Kept for backward compatibility with tests.
- When neither `objectIds` nor the booleans are provided, only automation points are transformed.
- Operations that would move automation before beat `0` must clamp or reject consistently with the existing score object gesture behavior.

### Cleanup Patch

```ts
export interface CleanupLayerAutomationPatch {
  type: 'cleanupLayerAutomation';
  layer: ScoreAutomationLayerRef;
  parameterIds?: string[];
}
```

Rules:

- If `parameterIds` is omitted, remove all missing assignment ids for the layer.
- Cleanup must not remove valid assignments.

## Renderer Component Contract

The renderer automation UI receives row-local snapshots and uses existing canvas sizing props.

```ts
export interface AutomationLayerOverlayProps {
  layer: ScoreLayerSnapshot;
  automation: ScoreLayerAutomationSnapshot;
  pixelsPerBeat: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  mode: 'singleLine' | 'multiLine';
  onPatch: (patch: ScoreAutomationPatch) => void;
}

export interface AutomationLayerHeaderControlsProps {
  layer: ScoreLayerSnapshot;
  automation: ScoreLayerAutomationSnapshot;
  compact: boolean;
  onPatch: (patch: ScoreAutomationPatch) => void;
}
```

Rules:

- `AutomationLayerOverlay` is an overlay inside `ScoreTimeCanvas` and `AudioLayerGroupCanvas`, not a replacement canvas.
- Existing object and audio clip bars remain interactive in score mode.
- In `singleLine` mode only the selected parameter accepts point edits.
- In `multiLine` mode direct point editing is disabled and range gestures are delegated to shared multi-line selection utilities.

## Error Handling

- Missing layers or missing parameters are no-ops with diagnostics in tests, not renderer crashes.
- Stale ids appear in `missingParameterIds` until cleanup or reassignment.
- Audio layers without an associated mixer channel return an empty target group list and remain drawable.

## Compatibility Notes

- The contract intentionally uses `parameterId` instead of renderer-generated ids because Java Blue assignment is based on `Parameter.getUniqueId()`.
- The contract keeps audio clip fades out of automation targets; fades are already clip-level editing behavior.
- Root timeline support is required first. Nested score path support can be added only after confirming Java parity expectations.
