# blue-electron Agent Guidance

This file contains stable, cross-cutting rules for coding agents. Feature-specific
requirements belong in `specs/<feature>/`; historical changes belong in git history.
The governing rules are in `.specify/memory/constitution.md`.
See the [maintainer documentation index](docs/README.md) for project-wide
guidance and where to record feature decisions and evidence.

## Repository map

- `packages/blue-data` (`@blue/data`) — platform-neutral project models, XML, and CSD generation.
- `packages/blue-app` (`@blue/app`) — Electron main, preload, and renderer code.
  Before changing this package, read its [agent guidance](packages/blue-app/AGENTS.md).
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
- Keep functional workloads in ordinary CI when separating speed assertions. Use fake clocks
  and work/render counts for deterministic behavior; split oversized correctness cases into
  independent scenarios instead of moving them to performance-only execution.
- Application speed measurements use the opt-in `test:performance`, `test:performance:browser`,
  and `test:performance:engine` commands. Run acceptance on a controlled desktop/reference
  machine; hosted performance CI is manual diagnostic collection, not a PR/push/scheduled gate.
- Follow [the performance testing guide](docs/performance-testing.md) for tags, evidence,
  measured boundaries, and `@blue/data`'s opt-in measurement command. A green
  correctness or collection job does not establish performance acceptance.

## Git worktrees

When the agent is responsible for choosing a Git worktree path, create it under:

`<repository-root>/.worktrees/<worktree-name>`

For example:

`git worktree add .worktrees/feature-name -b feature-name`

Do not manually create worktrees beside the repository or in a tool-specific default directory. If the host application creates the worktree before the task starts, configure that application separately; this instruction does not override its managed-worktree location.

## Architecture boundaries

- For large-module refactors, apply the review rule and boundary maps in `docs/modularization.md`.
- For new or modified lifecycles, gestures, or asynchronous resource ownership, apply the
  [lifecycle and gesture review](docs/modularization.md#lifecycle-and-gesture-review).
  Document the owner, valid transitions, and cancellation/cleanup rules; verify competing
  operations and stale completions at the lowest practical test seam.
- `@blue/data` production source must remain browser-safe and host-neutral: no Node.js
  built-ins, DOM APIs, Electron APIs, `require()`, dynamic `import()`, or inline
  `import("...").Type` annotations.
- Electron main owns filesystem, process, Java-runtime, engine, and other host APIs. Keep
  renderer code on typed, serializable preload/IPC contracts.
- `BlueData` is the canonical in-memory project owner and `.blue` XML is the canonical
  project format. Load expected data, migrate documented historical forms, and diagnose
  unexpected elements/attributes/types/values under explicit serialization contracts. Reject
  unexpected input unless a documented rule permits a warning with safe save behavior;
  do not silently discard meaningful content or accept arbitrary XML through opaque bags.
  Route project mutations through the existing document bridge.

## Licensing and source provenance

- Before coding, read [LICENSING.md](LICENSING.md) and the affected component's license files,
  package metadata, third-party notices, and file-specific headers. Check the destination scope;
  the repository default does not override component or third-party terms.
- Check compatibility before copying, translating, adapting, or moving code across license scopes,
  including Java parity references. Also check new or changed dependencies, bundled assets,
  examples, generated tables, and code snippets against how Blue will distribute them.
- Public availability is not permission to reuse source code. Prefer original implementations
  from public behavioral descriptions or mathematical rules; cite those references. Code
  translation or AI generation does not remove obligations attached to incorporated material.
- Record incorporated third-party material's source URL/revision, license, destination, and required
  attribution, notices, license texts, or source distribution in feature research or the change
  description. Preserve existing notices and update the applicable inventories and release checks.
- Spec Kit plans must explicitly evaluate license compatibility and provenance in the Constitution
  Check. For changes using only original code within an existing scope, a short statement suffices.
- If permission or compatibility is unresolved, do not incorporate the affected material. Continue
  unaffected work and use a compatible alternative or resolve the issue with the project owner;
  owner approval alone does not grant third-party rights or change license terms.

## Java-first parity

- Supported Java fields need authoritative model representations even when their runtime is
  unavailable. Follow the [Java compatibility contract](.specify/memory/constitution.md#ii-java-compatible-behavior-and-explicit-serialization-contracts)
  for load/save, retained payloads, and TypeScript extensions.
- For behavior mismatches, rendering failures, XML compatibility, formatting, or parity bugs,
  consult the Java implementation before changing TypeScript.
- Primary references, when available, are `~/work/nbprojects/blue/blue-core` and
  `~/work/nbprojects/blue/blue-ui-core`.
- Compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`; document any
  intentional TypeScript divergence and cover it with a focused test.
- For serialization changes, record Java loader/writer revisions and evidence for historical
  forms across project, disk, library, and BlueShare entry points. Follow the
  [migration and evidence rules](.specify/memory/constitution.md#migration-ownership-and-historical-evidence).

## Serialization and migration boundaries

- Migrate project-graph changes on raw XML before deserialization. Migrate class-local forms
  at the resource loader shared by all entry points, or in the owning class. Standalone instruments
  and effects must load without a `BlueData` project or a project version.
- Apply the [XML acceptance rules](.specify/memory/constitution.md#xml-and-serialized-resources)
  for diagnostics, atomic failure, significant whitespace, and independent XML copies.

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

- Pass native paths to filesystem and process APIs. Convert at the boundary that needs a host
  identity or external text. In embedded Csound strings, use forward slashes and escape quotes
  and other Csound string syntax.
- Use `path.join()`, `os.tmpdir()`, and synthetic Windows paths in tests. For permission failures,
  inject `EACCES`/`EPERM` or use native Windows ACLs. Follow the
  [host-path rules](.specify/memory/constitution.md#host-path-portability-and-boundary-forms)
  for identity comparisons and Windows validation.

## Import discipline

- Use top-level static ES imports in `@blue/data` production source. Keep any host-specific or
  test-only import exceptions outside that package boundary and document them when they affect
  runtime behavior.
- Fixed application-owned asset and module sets use explicit static imports.
- `import.meta.glob` is prohibited by default. An exception requires an explicit feature
  specification for automatic discovery and deterministic validation of missing, duplicate,
  malformed, unexpected-member, and naming conditions.
