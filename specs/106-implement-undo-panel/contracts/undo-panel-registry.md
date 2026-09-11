# Contract: Undo History Panel Registration

Registry: `packages/blue-app/src/shared/workbench-menu.ts` + seed list in
`src/renderer/components/workbench/auxiliary-layout-model.ts` | Date: 2026-09-11

The panel integrates exclusively through the existing workbench panel registry; every
placement behavior is derived, none is hand-coded.

## Descriptor

```ts
{
  id: 'UndoHistoryTopComponent',
  title: 'Undo History',
  mode: 'properties',
  openAtStartup: false,
  auxiliaryGroupId: 'properties-main',
  auxiliaryRailLabel: 'Undo History',
}
```

Plus: `'UndoHistoryTopComponent'` appended to
`AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds`; one case in
`WorkbenchPanelContent.tsx` mapping the id to `<UndoHistoryPanel />`.

## Derived behavior (guaranteed by existing systems, not new code)

| Behavior | Mechanism |
|----------|-----------|
| Closed by default (FR-001, FR-013) | `openAtStartup: false` excluded from default seeded layout. |
| Menu entry Window → Properties → "Undo History" (FR-001) | `buildWindowMenuTemplate` iterates `getPanelsByMode('properties')`; label = `title`. |
| Docks into right-edge properties group on first reveal | `auxiliaryGroupId: 'properties-main'` seed definition. |
| Rail button when minimized | `auxiliaryRailLabel`. |
| Reopen at prior placement after close (FR-013) | `closedPanelOrigins` in the stored workbench layout. |
| Layout persistence across restarts (FR-013) | Existing `StoredWorkbenchLayout` v7 save/restore; no schema change. |
| Focus via menu (`focus-panel` command) | Existing `openPanel(panelId)` path. |

## Constraints

- No new `NativeMenuCommand` variants, no `application-menu.ts` changes, no new stored
  settings, no layout-envelope version bump.
- The panel component must be presentation-agnostic: it renders into whatever container
  the auxiliary system provides (docked, slideout, maximized, floated OS window) with no
  viewport assumptions beyond filling its container.
- Panel open/close/reposition MUST NOT touch project content, history, or dirty state
  (FR-007); panel commands are limited to the existing canonical undo/redo dispatch.
- UI must follow `blue-app/AGENTS.md`: `text-role-*` typography roles only, `cn()`
  class composition, Tailwind utilities, no new custom CSS classes.

## Test obligations

- Menu: Window → Properties submenu lists "Undo History"; item click dispatches
  `focus-panel` with the panel id (extend `application-menu.test.ts`).
- Registry: descriptor present with `mode: 'properties'` and `openAtStartup: false`;
  absent from default seeded auxiliary groups; present in `properties-main` seed ordering
  (extend auxiliary-layout-model tests if panel sets are enumerated there).
- Component wiring: `WorkbenchPanelContent` resolves the id to the panel component.
