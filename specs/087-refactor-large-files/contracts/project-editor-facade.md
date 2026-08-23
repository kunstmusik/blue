# Contract: project-editor façade (seam 1)

Preserved public contract of `packages/blue-app/src/shared/project-editor` — the import
specifier keeps resolving for all existing consumers (main, preload type-imports,
renderer, shared siblings, tests). This file documents what must NOT change; the
implementation moves behind it.

## Import specifier

- `@blue/app` internal: `../shared/project-editor`, `../../shared/project-editor`,
  `./project-editor` (shared siblings) — all resolve to `project-editor/index.ts`.
- No consumer file is modified by seam 1.

## Export surface (251 symbols + 5 `bsb-widget-keys` re-exports, grouped)

The barrel re-exports, from the internal modules named in plan.md:

| Group | Representative symbols | Internal source module |
|---|---|---|
| Score/editor/automation/track/mixer/orchestra/instrument snapshot & patch types | `ScoreDocumentSnapshot`, `ScorePatch`, `ScoreAutomationPatch`, `ProjectEditorSnapshot`, `ProjectDocumentPatch`, `InstrumentPatch`, `MixerPatch`, `OrchestraSnapshot`, `ScoreObjectEditorDocumentSnapshot`, `TempoMapPatch`, `MeterMapPatch`, … | `contract.ts` |
| Embedded validators/factories among the types | `BLUE_LIVE_SOUND_OBJECT_TYPES`, `isBlueLiveSoundObjectType`, `isValidLayerRange`, `areLayerRangesValid`, `validateLegacyBlueLiveTriggerRequest`, `createBsbRealtimeControlUpdate`, `isBsbRealtimeControlUpdate`, `isValidBlueX7Voice`, `isValidBlueX7Patch` | `contract.ts` |
| Identity helpers | `getMixerChannelSnapshotId`, `getMixerEntrySnapshotId`, `getScoreObjectId`, `assign*` helpers | `identity.ts` (single WeakMap instance) |
| Empty/default factories | `createEmptyProjectEditorSnapshot`, `createEmptyScoreDocumentSnapshot`, `createEmptyMixerSnapshot`, `createEmptyOrchestraSnapshot`, `createEmptyTempoMapSnapshot`, `createEmptyMeterMapSnapshot`, `createEmptyToolbarProjectTransportSnapshot` | `snapshot-*` modules |
| Snapshot builders | `createProjectEditorSnapshot`, `createScoreObjectEditorDocument`, `createFallbackEditorDocument`, `createScoreDocumentSnapshot`, `resolveTimelineScoreObjects`, `resolveTimelineTarget`, `resolveEditorTarget`, `resolveScoreInsertionLocation`, `createBarRendererForSoundObject`, `createBarRendererForAudioClip`, `createInstrumentSnapshot`, `createOrchestraSnapshot`, `createEffectEditorSnapshot`, `createTrackInstrumentEditorSnapshot`, `createProjectUdoListSnapshot`, `setCodeText`, `createNoteProcessorChainSnapshot` | `snapshot-score.ts` / `snapshot-mixer-orchestra.ts` |
| BSB widget/preset operations | `applyBsbInterfacePatch`, `createWidgetFromSnapshot`, `ensureUniqueName`, `serializeBsbWidgetSnapshot`, preset-group helpers | `bsb-widgets.ts` |
| Patch appliers | `applyProjectDocumentPatch`, `applyScoreObjectPatch`, `applyScoreTimeStatePatch`, `applyTempoMapPatch`, `applyMeterMapPatch`, `applyMixerPatchToData`, `applyEffectEditablePatchToEffect`, `applyBlueLivePatch`, `applyMidiInputPatch`, `applyInstrumentPatch`, `applyProjectUdoPatch`, `applyTrackScorePatch`, `applyScoreAutomationPatch` | `patch-*.ts` |
| Reconciliation & guards | `reconcileMixerSnapshotWithArrangement`, `reconcileMixerWithArrangement`, `isEmptyProjectDocumentPatch`, `findMixerChannelById` | `patch-mixer-bluelive.ts` / `patch-document.ts` |
| Nested document helpers | `createNestedPolyObjectSnapshot`, `convertGenericToBsb`, `createInstrumentForType`, `createInstrumentFromSnapshot` | `snapshot-mixer-orchestra.ts` / `bsb-widgets.ts` |
| Re-exports | `collectBsbReplacementKeys*`, `getBsbReplacementKeys*` from `./bsb-widget-keys` | `index.ts` |

## Behavioral invariants

1. **Identity stability**: the WeakMap ID registries exist as exactly one module instance;
   IDs assigned during snapshot creation must be recognized by later
   `resolveTimelineScoreObjects` / patch calls in the same process. Covered by the
   duplicate/stale-ID rejection tests.
2. **Dependency direction**: `contract` and `identity` are leaves; `bsb-widgets` and
   `snapshot-*` never import `patch-*`; `patch-document.ts` is the only orchestrator that
   composes them. No new runtime import of any sibling that today uses `import type` only.
3. **Purity**: the module stays free of React, Electron, Node built-ins, and DOM APIs
   (it is imported by preload as types and by main at runtime).
4. Signatures, semantics, and patch results of every exported function are byte-identical
   (existing suites are the oracle; FR-012 forbids semantic edits during the move).

## Not part of this contract

- No new public exports are added to the barrel (internal-first clarification).
- Decomposing `applyScoreObjectPatch` or `createScoreObjectEditorDocument` is a later,
  separately specified change.
