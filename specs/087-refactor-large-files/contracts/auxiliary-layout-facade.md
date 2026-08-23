# Contract: auxiliary-layout façade (seam 2)

Preserved public contract of
`packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts`. The file
becomes a pure re-export barrel; the 7 runtime consumers (workbench-store, WorkbenchShell,
AuxiliaryRail/Tab/HeaderActions/Slideout, auxiliary-drag) and 10 test files are unchanged.

## Export surface (grouped by internal source)

| Group | Symbols | Internal module |
|---|---|---|
| Model types | `AuxiliaryEdge`, `AuxiliaryGroupSizeAction`, `AuxiliarySeedGroupId`, `AuxiliaryGroupKind`, `AuxiliaryPanelPresentation`, `AuxiliarySeedDefinition`, `AuxiliaryGroupInstance`, `AuxiliaryEdgeSlideoutState`, `MinimizedTabState`, `AuxiliarySlideoutView`, `AuxiliaryDockedSizeSnapshot`, `AuxiliaryLayoutState` | `auxiliary-layout-model.ts` |
| Seed catalog / classification | `getAuxiliarySeedDefinition`, `getAuxiliaryRailLabel`, `getAuxiliarySeedGroupIdForPanel`, `getAuxiliaryGroupIdForPanel`, `getGroupInstanceForPanel`, `isAuxiliaryPanelId` | `auxiliary-layout-model.ts` |
| Pure selectors | `getAuxiliaryPanelPresentation`, `getMinimizedTabsForEdge`, `getAuxiliarySlideoutForEdge` | `auxiliary-layout-model.ts` |
| Pure state commands | `toggleMinimizedAuxiliaryPanel`, `hideAuxiliarySlideout`, `hideAllAuxiliarySlideouts`, `resizeAuxiliarySlideout`, `moveAuxiliaryEdge`, `moveGroupToEdge`, `movePanelToEdge`, `mergeBackToSeededGroup`, `resetAuxiliaryLayout`, `createDefaultAuxiliaryLayoutState`, `cloneAuxiliaryLayoutState` | `auxiliary-layout-model.ts` |
| Normalization | `normalizeAuxiliaryLayoutState` (invariant enforcer, re-exported for tests) | `auxiliary-layout-model.ts` |
| Envelope codec | `StoredWorkbenchLayout` (v7), `createStoredWorkbenchLayout`, `parseStoredWorkbenchLayout` | `workbench-layout-envelope.ts` |
| Dockview/DOM operations | `buildDefaultWorkbenchLayout`, `applyAuxiliaryLayout`, `transitionAuxiliaryLayout` + `AuxiliaryLayoutTransitionResult`, `revealAuxiliaryPanel`, `restoreClosedAuxiliaryPanel`, `dockAuxiliaryPanel`, `minimizeAuxiliaryPanelLayout`, `closeAuxiliaryPanelLayout`, `resizeAuxiliaryGroupLayout`, `minimizeAuxiliaryGroupLayout`, `maximizeAuxiliaryGroupLayout`, `restoreAuxiliaryGroupLayout`, `syncAuxiliaryLayoutFromApi`, `captureAuxiliaryDockedSizes`, `captureAuxiliaryDockedSizesFromApi`, `restoreAuxiliaryDockedSizes`, `scheduleAuxiliaryDockedSizeRestore`, `shouldPreventAuxiliaryPanelDrop`, `isAuxiliaryInteractionTarget` | `auxiliary-layout-dockview.ts` |

## Behavioral invariants

1. **Version funnel unchanged**: `parseStoredWorkbenchLayout` tries guards v7 → v6 → v5 →
   v4 → v3 → v2 → bare `SerializedDockview` → default; every branch funnels through
   seed relocation + invariant normalization; failures degrade to
   `createDefaultAuxiliaryLayoutState()`. Auxiliary model version stays 5; envelope
   version stays 7. No new version is introduced.
2. **Transition contract (SPEC 084)**: only an `applied` transition result may replace
   canonical state; `deferred` (drag-active) and `failed` leave state untouched; rollback
   re-runs reconciliation on the last valid state. The single-apply-path property must
   survive the split (desired-state computation may live in the model, but the transition
   wrapper remains the only mutation entry).
3. **Purity boundary**: model/migrations/envelope modules import neither `dockview`
   runtime code, `dnd-core`/`tree-dnd-domain`, nor the adapter; the drag guard moves to
   the adapter. Viewport clamps keep their SSR-safe fallback (parameterized where tests
   need determinism).
4. **Persistence untouched**: envelope JSON continues to flow through
   `layout-settings-store` → main `window-layout-store.ts` (program settings) with the
   legacy `localStorage` mirror in `WorkbenchShell.tsx` — no store, key, or IPC change.
5. Oracles: `tests/workbench-auxiliary.test.ts` (all migration versions, transitions,
  rollback, ownership invariants, 200px Java Blue parity) and
  `tests/workbench-layout-persistence.test.ts` run unchanged against the barrel.

## Not part of this contract

- `getAuxiliarySeedDefinition` currently has zero external consumers — it remains exported
  (no surface reduction in this feature) but is flagged in the boundary map for a later
  approved API cleanup.
- Moving the model to `src/shared/` (no main-process consumer today).
