<!--
Sync Impact Report (2026-08-17)
- Version change: 2.0.0 → 2.1.0
- Modified principles: none
- Added sections:
  - Host-Path Portability and Boundary Forms
- Removed sections: none
- Templates and guidance:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: AGENTS.md
  - ✅ reviewed/no change: .specify/templates/spec-template.md and README.md
- Follow-up TODOs: none
-->

<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles:
  - I. Data-First, UI-Separated → I. Portable Data Core and Strict Boundaries
  - II. Backwards-Compatible Serialization → II. Java-Compatible Behavior and Lossless Project Data
  - III. JVM Dependencies Preserved, Not Replaced → IV. Host-Owned External Runtimes and Engine Isolation
  - IV. Engine as External Process → IV. Host-Owned External Runtimes and Engine Isolation
  - V. Test-First for Serialization → V. Evidence-Driven Parity and Regression Safety
- Added sections:
  - III. Canonical State Ownership and Explicit Contracts
  - TypeScript and Import Discipline
  - State and Persistence Boundaries
  - Java-First Parity
  - Change Discipline and Validation
  - Governance
- Removed sections:
  - Porting Order (the dependency-layer port sequence is no longer the active delivery model)
- Templates and guidance:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: .agents/skills/speckit-tasks/SKILL.md
  - ✅ updated: .agents/skills/speckit-git-feature/SKILL.md
  - ✅ updated: README.md
  - ✅ reviewed/no change: all remaining .agents/skills/speckit-*/SKILL.md files
  - ✅ reviewed/no change: AGENTS.md and package runtime README files
- Follow-up TODOs: None
-->

# Blue TypeScript Port Constitution

## Core Principles

### I. Portable Data Core and Strict Boundaries
`@blue/data` MUST contain platform-neutral Blue data models and business logic with no UI,
Node.js built-in, or DOM-only runtime dependency. It MUST use top-level static ES imports;
`require()`, dynamic `import()`, and inline `import("...").Type` annotations are prohibited.
File access, subprocesses, Electron APIs, and presentation logic MUST remain in host packages.
The same data APIs MUST behave consistently in browser and Node.js hosts. This boundary keeps
project logic reusable, bundle-safe, and independently testable.

### II. Java-Compatible Behavior and Lossless Project Data
Java Blue is the behavioral reference for parity work, `.blue` XML, CSD generation, rendering,
formatting, migrations, and legacy project semantics. `.blue` XML MUST remain the canonical
project format. Loading and saving MUST preserve modeled and unmodeled project data and MUST
remain structurally compatible with Java Blue; established byte-level fixtures MUST continue to
match where exact output is part of the contract. Raw-XML migrations MUST run before model
deserialization. Any intentional divergence from Java behavior MUST be named in the feature spec
and plan, justified, and covered by deterministic validation. Data that cannot be executed by the
current host MUST be retained without silent loss.

### III. Canonical State Ownership and Explicit Contracts
Every durable or runtime state domain MUST have one documented canonical owner. The Electron main
process owns the active `BlueData` project document; renderers consume serializable snapshots and
submit explicit typed patch intents. Renderer session state, caches, derived artifacts, and
app-wide settings MUST NOT enter `.blue` XML unless the project model explicitly defines them.
IPC, preload, engine, and Java-runtime boundaries MUST use typed, serializable, validated
contracts with explicit failure behavior. This prevents split-brain state and accidental changes
to project persistence.

### IV. Host-Owned External Runtimes and Engine Isolation
`@blue/data` MAY define abstract execution contracts but MUST NOT launch Java, access files, or
connect directly to the audio engine. Electron main owns Java helper lifecycle, filesystem and
process access, ZeroMQ transport, and host capability detection. Blue Engine communication MUST
flow through the versioned `@blue/engine-client` protocol; renderer and data code MUST NOT couple
to engine-native state. Clojure, Jython, and other host-backed project metadata MUST round-trip
when their runtime is unavailable, and unavailable execution MUST produce a clear, recoverable
diagnostic without corrupting the project.

### V. Evidence-Driven Parity and Regression Safety
Behavior, serialization, rendering, runtime, and UI changes MUST include verification proportional
to their risk. Parity fixes MUST begin with the relevant Java source or Java-generated artifact.
Behavioral fixes MUST add or update a focused automated regression test at the lowest practical
boundary; bug fixes MUST reproduce the failure first when the harness supports it. Serialization
changes MUST cover round-trip state, Java-compatible XML, and preservation of unknown data.
Runtime and IPC changes MUST cover success and failure contracts. If automation is impractical,
the plan MUST record why and the quickstart MUST provide deterministic manual validation. A change
is not complete until affected tests, type checks, lint, and builds pass or a scoped exception is
documented.

## Additional Constraints

### TypeScript and Import Discipline
Production TypeScript MUST compile in strict mode and use explicit, statically analyzable module
boundaries. New abstractions MUST solve a demonstrated need; changes MUST prefer the simplest
design that preserves existing contracts. Package dependency direction MUST keep `@blue/data`
independent of Electron, React, Node.js, and host runtime implementations.

### XML and Project Persistence
XML parsing MUST use `@rgrove/parse-xml` through the repository's `Element`/`Elements` utilities.
Callers own file I/O through APIs such as `BlueData.loadFromString(xml)` and
`blueData.saveToString()`. New persistence locations MUST be named in the spec and plan, including
their owner, lifetime, migration behavior, and relationship to `.blue` project data.

### State and Persistence Boundaries
Project XML, app-wide program settings, library databases, renderer session state, and generated
audio/CSD artifacts are distinct stores. A feature MUST identify which store it reads or mutates
and MUST define recovery for migrations or partial failure. Derived state MUST remain disposable;
project mutations MUST flow through the canonical project document bridge.

### Host-Path Portability and Boundary Forms

Host filesystem paths MUST remain in native OS form when passed to `fs`, `path`, `os`, or process
APIs. Values used for identity or de-duplication, and values serialized, embedded, or sent through
external text protocols, MUST be explicitly converted at a named boundary. Native paths, canonical
host identities, and external path text MUST NOT be compared interchangeably. Canonical identity
rules MUST be implemented by a reusable platform-aware helper rather than ad hoc conversion at
call sites. Path-sensitive tests MUST use `path`/`os` builders, synthetic Windows fixtures, and
injected OS errors or native runners for non-portable permissions and symlink behavior; POSIX
`chmod` behavior MUST NOT be assumed on Windows. Cross-platform host-path changes MUST be validated
on the supported Windows CI target.

## Development Workflow

### Java-First Parity
For behavior mismatches, rendering failures, XML compatibility, or formatting defects, work MUST
consult the Java implementation before changing TypeScript. Primary references are
`~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core`; when applicable,
compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`. TypeScript divergence is
permitted only when intentional and documented.

### Spec-Driven Delivery
Material features follow `/speckit-specify` → `/speckit-clarify` as needed → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. Plans MUST complete the Constitution Check before research
and after design. Tasks MUST trace compatibility, state ownership, boundary contracts, and
verification obligations to concrete files and runnable validation.

### Change Discipline and Validation
Implementation MUST preserve unrelated work, keep edits surgical, and avoid speculative
infrastructure. Reviews MUST compare the result with the feature spec, plan, tasks, Java reference
when applicable, and this constitution. Validation MUST target affected packages first and expand
to repository-wide checks in proportion to cross-package risk.

## Governance

This constitution supersedes conflicting project templates, plans, research notes, and runtime
guidance. Amendments require an explicit constitution update that states the rationale, applies a
semantic version bump, prepends a Sync Impact Report, and synchronizes affected templates and
guidance in the same change.

Versioning follows these rules: MAJOR for removed or incompatibly redefined principles or
governance; MINOR for a new principle, section, or materially expanded mandatory guidance; PATCH
for non-semantic clarification or correction. The original ratification date never changes.

Every implementation plan MUST evaluate all five core principles before research and after design.
Every task list MUST include the constitution-required compatibility and verification work.
Code review MUST treat an unexplained MUST violation as blocking. A necessary exception MUST be
documented in the plan's Complexity Tracking section with the rejected compliant alternative and
MUST receive explicit project-owner approval.

**Version**: 2.1.0 | **Ratified**: 2026-04-11 | **Last Amended**: 2026-08-17
