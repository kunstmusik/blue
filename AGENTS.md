# blue-electron Agent Guidance

This file contains stable, cross-cutting rules for coding agents. Feature-specific
requirements belong in `specs/<feature>/`; historical changes belong in git history.
The governing rules are in `.specify/memory/constitution.md`.

## Repository map

- `packages/blue-data` (`@blue/data`) — platform-neutral project models, XML, and CSD generation.
- `packages/blue-app` (`@blue/app`) — Electron main, preload, and renderer code.
- `packages/blue-engine-client` — versioned engine protocol and client.
- `packages/blue-java` (`@blue/java-runtime`) — Java helper integration.
- `native/blue-engine` — native Blue Engine source and build inputs.
- `specs/` — feature specifications, plans, research, and tasks.
- `.specify/` — Spec Kit workflow files and constitution.

## Validation

Run commands from the repository root with `pnpm`.

- Start with the affected package: `pnpm --filter @blue/app test` or the relevant package test.
- For main-process changes, run `pnpm --filter @blue/app build:main`.
- Before handoff, run `pnpm test` and `pnpm lint` when the change spans packages or shared behavior.
- Run `git diff --check` for whitespace errors.

## Git worktrees

When the agent is responsible for choosing a Git worktree path, create it under:

`<repository-root>/.worktrees/<worktree-name>`

For example:

`git worktree add .worktrees/feature-name -b feature-name`

Do not manually create worktrees beside the repository or in a tool-specific default directory. If the host application creates the worktree before the task starts, configure that application separately; this instruction does not override its managed-worktree location.

## Architecture boundaries

- For large-module refactors, apply the review rule and boundary maps in `docs/modularization.md`.
- `@blue/data` production source must remain browser-safe and host-neutral: no Node.js
  built-ins, DOM APIs, Electron APIs, `require()`, dynamic `import()`, or inline
  `import("...").Type` annotations.
- Electron main owns filesystem, process, Java-runtime, engine, and other host APIs. Keep
  renderer code on typed, serializable preload/IPC contracts.
- `BlueData` is the canonical in-memory project owner and `.blue` XML is the canonical
  project format. Preserve unknown project data and route project mutations through the
  existing document bridge.

## Java-first parity

- For behavior mismatches, rendering failures, XML compatibility, formatting, or parity bugs,
  consult the Java implementation before changing TypeScript.
- Primary references, when available, are `~/work/nbprojects/blue/blue-core` and
  `~/work/nbprojects/blue/blue-ui-core`.
- Compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`; document any
  intentional TypeScript divergence and cover it with a focused test.

## Host filesystem and embedded-text paths

- Keep native OS paths unchanged for `fs`, `path`, `os`, and process APIs. Do not globally
  replace separators in filesystem paths.
- Convert paths only at an explicit boundary: canonical host identity, external text, or
  embedded Csound text. Csound paths use forward slashes; escape quotes and Csound string
  syntax at that boundary.
- Build test paths with `path.join()` and `os.tmpdir()`. Include synthetic Windows paths such
  as `C:\\Users\\...`; do not compare native filesystem paths directly with embedded text.
- Do not use POSIX `chmod` as a Windows permission test. Inject `EACCES`/`EPERM` or run a
  native Windows ACL test. Path-sensitive changes require Windows CI or equivalent native
  Windows coverage.

## Import discipline

Use top-level static ES imports in `@blue/data` production source. Keep any host-specific or
test-only import exceptions outside that package boundary and document them when they affect
runtime behavior.

## UI and typography guidance

- Before choosing or changing typography in any UI work, consult `docs/typography.md`.
- Popups (menus, popovers, tooltips, dialogs) rendered from workbench panel
  content MUST follow `docs/popout-popup-conventions.md`: portal into, position
  against, and take dismissal input from the panel's hosting window
  (`useHostDocument`/`Popout*Portal` wrappers), with realm-safe target checks
  (`isNodeLike`/`containsNode`), never global `document`/`window`.
- Use only the approved seven semantic typography roles (`text-role-*` / `--text-role-*`). Never
  introduce raw font sizes, default Tailwind numeric text scales, or arbitrary `text-[Npx]` sizes
  for application-owned UI.
- Preserve project-authored typography (such as Blue Synth Builder font values and imported
  project data) as canonical project content without coercion.
- Keep `docs/typography.md` up to date in the same change whenever typography roles, metrics,
  ownership boundaries, or exception policies are updated.

### Class styling and composition

- **Composition rule**: All `className` attributes built from multiple sources (conditionals, constants, caller overrides) MUST use `cn()` from `packages/blue-app/src/renderer/lib/cn.ts` (alias `@/lib/cn`). Never use template literals (`` `...` ``) or array joins (`[...].join(' ')`) for `className`. Plain static strings (e.g. `className="flex"`) do not require `cn()`.
- **Precedence rule**: Components exposing a `className` prop must compose it last: `cn(BASE_CLASS, ..., className)` so caller utilities deterministically win conflicts.
- **Styling boundary**:
  1. **Component styling**: Use Tailwind utilities in `className`. Do NOT add new BEM/custom CSS classes to `renderer/styles/index.css`.
  2. **Dynamic layout values**: Continuous/runtime-calculated pixel coordinates, widths, and heights belong in `style={{ ... }}` rather than dynamic Tailwind classes.
  3. **Global and third-party overrides**: Plain CSS in `renderer/styles/index.css` is reserved for: `@theme` tokens, third-party library overrides (`.dv-*` for Dockview, `.cm-*` for CodeMirror), keyframe animations, scrollbars, and pseudo-elements.
  4. **Retained custom classes**: Pre-existing structural/theming BEM classes (`editor-context-menu*`, `workbench-shell`, `workbench-aux-slideout`, `workbench-edge-rail`) are deliberately retained. Port existing BEM blocks to utilities only opportunistically when already modifying a component (strangler policy); never perform batch cleanup.
- Consult `specs/097-cn-classname-migration/contracts/classname-composition.md` for the canonical composition contract and ESLint rule details.

## Confirmation dialog guidance

- Never use raw browser blocking dialogs (`window.confirm`, `window.prompt`, `window.alert`, or bare `confirm`, `prompt`, `alert`) in application source.
- For host-owned/system decisions (file replacement, unsaved close, import/export collisions, recovery), use `showNativeConfirmation` from `packages/blue-app/src/main/native-confirmation.ts` in the main process, or `window.blueAPI.showNativeConfirmation` via preload in the renderer. Never invoke `dialog.showMessageBox` directly outside the dedicated wrapper.
- For in-app contextual decisions (item/preset deletion, layer group removal, non-undoable score object conversions, draft discard), use `ConfirmationDialog` from `packages/blue-app/src/renderer/components/dialogs/ConfirmationDialog.tsx`.
- All confirmations must be fail-closed (Escape, backdrop click, closing window, or unexpected IPC failure resolves safely as Cancel with no side-effects).
- Destructive confirmations must explicitly set destructive intent (red styling) and default focus to Cancel.
