# blue-app Agent Guidance

These rules apply to work in `packages/blue-app`. Repository-wide guidance remains in the root
`AGENTS.md`.

## UI and typography

- Before choosing or changing typography, consult `docs/typography.md`.
- Popups (menus, popovers, tooltips, dialogs) rendered from workbench panel content must follow
  `docs/popout-popup-conventions.md`: portal into, position against, and take dismissal input from
  the panel's hosting window (`useHostDocument`/`Popout*Portal` wrappers), with realm-safe target
  checks (`isNodeLike`/`containsNode`), never global `document`/`window`.
- Use only the approved seven semantic typography roles (`text-role-*` / `--text-role-*`). Do not
  introduce raw font sizes, default Tailwind numeric text scales, or arbitrary `text-[Npx]` sizes
  for application-owned UI.
- Preserve project-authored typography, such as Blue Synth Builder font values and imported
  project data, as canonical project content without coercion.
- Update `docs/typography.md` in the same change whenever typography roles, metrics, ownership
  boundaries, or exception policies change.

## Class styling and composition

- Build `className` attributes that combine multiple sources with `cn()` from
  `src/renderer/lib/cn.ts` (alias `@/lib/cn`), never template literals or array joins. Plain static
  strings do not require `cn()`.
- Components exposing a `className` prop must compose it last: `cn(BASE_CLASS, ..., className)`.
- Use Tailwind utilities for component styling. Do not add new BEM/custom CSS classes to
  `src/renderer/styles/index.css`.
- Put continuous or runtime-calculated pixel coordinates, widths, and heights in `style={{ ... }}`.
- Reserve plain CSS in `src/renderer/styles/index.css` for `@theme` tokens, third-party overrides,
  keyframe animations, scrollbars, and pseudo-elements.
- Retain existing structural/theming classes (`editor-context-menu*`, `workbench-shell`,
  `workbench-aux-slideout`, `workbench-edge-rail`). Port them to utilities only when already
  modifying the component; do not perform batch cleanup.

## Confirmation dialogs

- Never use browser blocking dialogs (`window.confirm`, `window.prompt`, `window.alert`, or their
  bare equivalents) in application source.
- For host-owned decisions, use `showNativeConfirmation` from `src/main/native-confirmation.ts` in
  the main process or `window.blueAPI.showNativeConfirmation` in the renderer. Do not invoke
  `dialog.showMessageBox` outside that wrapper.
- For contextual in-app decisions, use `ConfirmationDialog` from
  `src/renderer/components/dialogs/ConfirmationDialog.tsx`.
- Confirmations must fail closed: Escape, backdrop click, window closure, or unexpected IPC failure
  resolves as Cancel without side effects.
- Destructive confirmations must use destructive styling and focus Cancel by default.
