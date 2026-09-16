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

- Blue TypeScript must load supported Java Blue projects; Java Blue is not required to load or
  preserve Blue TypeScript extensions. Avoid raw-value/presence shadow state for unreleased
  TypeScript-only fields unless a feature contract calls for it.
- For behavior mismatches, rendering failures, XML compatibility, formatting, or parity bugs,
  consult the Java implementation before changing TypeScript.
- Primary references, when available, are `~/work/nbprojects/blue/blue-core` and
  `~/work/nbprojects/blue/blue-ui-core`.
- Compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`; document any
  intentional TypeScript divergence and cover it with a focused test.

## Project history and undo/redo

- Every user-visible action that changes active `BlueData` project content must use the canonical
  `ProjectHistory` path through typed document patches or an approved direct structural mutation
  adapter. Do not add direct project-model writes that bypass history preparation.
- New or modified project mutations must provide a semantic history label and focused
  commit→undo→redo tests covering canonical state, stable identities/references, dirty state, and
  runtime reconciliation when the edit affects a running engine.
- Transient previews and disposable renderer/runtime state are not history entries. If a preview
  produces a durable edit, commit its final value through project history and restore canonical
  document/runtime state on cancellation.
- A deliberately non-undoable project mutation requires an explicit rationale and project-owner
  approval in the feature spec and plan.

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

- Use top-level static ES imports in `@blue/data` production source. Keep any host-specific or
  test-only import exceptions outside that package boundary and document them when they affect
  runtime behavior.
- Fixed application-owned asset and module sets use explicit static imports.
- `import.meta.glob` is prohibited by default. An exception requires an explicit feature
  specification for automatic discovery and deterministic validation of missing, duplicate,
  malformed, unexpected-member, and naming conditions.
