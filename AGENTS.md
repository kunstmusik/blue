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

- Blue TypeScript must load supported Java Blue projects; Java Blue is not required to load or
  preserve Blue TypeScript extensions. Supported fields need authoritative model representations;
  raw-value/presence shadow state or retained deferred payloads require an explicit compatibility
  contract. An unavailable runtime does not make a known serialized format unexpected.
- For behavior mismatches, rendering failures, XML compatibility, formatting, or parity bugs,
  consult the Java implementation before changing TypeScript.
- Primary references, when available, are `~/work/nbprojects/blue/blue-core` and
  `~/work/nbprojects/blue/blue-ui-core`.
- Compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`; document any
  intentional TypeScript divergence and cover it with a focused test.
- For serialization changes, research Java loader/writer history and record revisions and the
  evidence for accepted historical forms. Check standalone disk, library, and BlueShare payloads
  as well as projects; incidental Java tolerance is not a compatibility contract.

## Serialization and migration boundaries

- Cross-section or project-graph restructures belong in project migrators operating on raw XML
  before deserialization and canonical-form validation.
- Class-local aliases, value conversions, defaults, and resource subtree changes belong at the
  class loading boundary or in a shared resource migration reached by all relevant entry points.
  Instruments and effects may load independently from disk, libraries, or BlueShare; their
  local compatibility must not require a `BlueData` load or unavailable project version.
- Give each migration one owner, scope, ordering, and conflict rule. Canonical data must remain
  stable when normalization is reapplied; cover composed migrations and standalone roots.
- Diagnostics must name the source/resource, element path, offending member/value, severity,
  and recovery behavior. Failed acceptance must leave active documents, libraries, and source
  files unchanged. Warnings must not enable an ordinary save after meaningful data is discarded.
- Preserve significant text/code whitespace and avoid mutable XML aliases across loader input,
  serialization output, canonical models, copies, and history mementos.

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
