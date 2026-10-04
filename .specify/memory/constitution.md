<!--
Sync Impact Report (2026-10-01)
- Version change: 3.1.0 → 4.0.0
- Modified principles:
  - II. Java-Compatible Behavior and Lossless Project Data →
    II. Java-Compatible Behavior and Explicit Serialization Contracts
  - IV. Host-Owned External Runtimes and Engine Isolation (known runtime metadata)
  - V. Evidence-Driven Parity and Regression Safety (acceptance and rejection evidence)
- Added section: Migration Ownership and Historical Evidence
- Expanded sections: XML and Serialized Resources; Java-First Parity
- Removed rule: blanket retention of unrelated unmodeled/unknown project XML
- Rationale: model expected data, migrate documented historical forms, and diagnose unexpected
  input instead of silently discarding it or implicitly accepting it through opaque storage.
- Synchronized guidance: AGENTS.md; README.md; spec, plan, and tasks templates
- Reviewed/no change: docs/modularization.md (historical extraction behavior descriptions)
- Implementation follow-up: specs/116-xml-compatibility-contracts; existing loaders are not
  declared compliant merely by this amendment.
- Follow-up TODOs: none
-->

<!--
Sync Impact Report (2026-09-30)
- Version change: 3.0.0 → 3.1.0
- Modified principles: none
- Added principle: VI. License Boundaries and Source Provenance
- Expanded sections: Spec-Driven Delivery and Governance (licensing gate and obligations)
- Removed sections: none
- Templates and guidance:
  - updated: AGENTS.md
  - updated: .specify/templates/plan-template.md
  - reviewed/no change: .specify/templates/spec-template.md and tasks-template.md;
    plan and tasks skills already load the constitution and its obligations
- Follow-up TODOs: none
-->

<!--
Sync Impact Report (2026-09-16)
- Version change: 2.2.0 → 3.0.0
- Modified principle: II. Java-Compatible Behavior and Lossless Project Data (one-way file compatibility; no shadow state required for unreleased extensions)
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
-->

<!--
Sync Impact Report (2026-09-11)
- Version change: 2.1.0 → 2.2.0
- Modified principles:
  - III. Canonical State Ownership and Explicit Contracts (expanded with project-history rules)
- Added sections: none
- Removed sections: none
- Templates and guidance:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: .agents/skills/speckit-tasks/SKILL.md
  - ✅ updated: AGENTS.md
  - ✅ reviewed/no change: remaining .agents/skills/speckit-*/SKILL.md files, README.md,
    and docs/modularization.md
- Follow-up TODOs: none
-->

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

### II. Java-Compatible Behavior and Explicit Serialization Contracts
Java Blue is the behavioral reference for parity work, `.blue` XML, CSD generation, rendering,
formatting, migrations, and legacy project semantics. `.blue` XML MUST remain the canonical project
format. Blue TypeScript MUST load supported Java Blue projects and independently serialized
resources through explicit contracts for expected elements, attributes, values, and historical
forms. Supported data MUST survive load/save, copy, and applicable history operations. Java Blue
is not required to load or preserve Blue TypeScript extensions.

Loaders MUST load and validate expected data, migrate documented historical forms, and report
unexpected elements, attributes, types, or values with a warning or error. Unexpected input MUST
be rejected unless a documented compatibility rule permits a warning. A warning may permit
ordinary editing and saving only when that rule establishes that ignoring the input cannot
change supported content or provides an explicit supported retention contract. Potentially
meaningful discarded data MUST NOT be followed by ordinary activation, import, or saving.
Malformed values in known fields MUST have a separately defined rejection or recovery rule;
missing historical fields MAY use documented defaults. Java loaders' incidental tolerance of
unknown input does not establish a supported compatibility form.

Supported fields MUST have an authoritative model representation. Generic unknown-XML bags MUST
NOT substitute for identifying supported fields or diagnosing unexpected input. A named deferred
or extension payload MAY retain serialized data when its accepted shape, owner, validation,
copy/save behavior, and execution limitations are explicitly specified. An unavailable runtime
does not make otherwise supported serialized data unexpected. New TypeScript-only fields MUST
use the simplest representation meeting the feature contract; separate raw-value or presence
state requires an explicit compatibility need.

Established byte-level fixtures MUST continue to match where exact output is part of the
contract. Structural project migrations MUST run on raw XML before model deserialization;
class-local compatibility MUST also work for standalone resources. Any intentional divergence
from Java behavior MUST be named in the feature spec and plan, justified, and covered by
deterministic validation.

### III. Canonical State Ownership and Explicit Contracts
Every durable or runtime state domain MUST have one documented canonical owner. The Electron main
process owns the active `BlueData` project document; renderers consume serializable snapshots and
submit explicit typed patch intents. Renderer session state, caches, derived artifacts, and
app-wide settings MUST NOT enter `.blue` XML unless the project model explicitly defines them.
IPC, preload, engine, and Java-runtime boundaries MUST use typed, serializable, validated
contracts with explicit failure behavior. This prevents split-brain state and accidental changes
to project persistence.

Every user-visible action that changes active `BlueData` project content MUST participate in the
canonical `ProjectHistory` commit path, either through typed document patches or an approved direct
structural mutation adapter. Each action MUST have a semantic history label and support undo and
redo without losing identities, ordering, references, dirty-state accuracy, canonical publication,
or required runtime reconciliation. New or modified project writers MUST include focused
commit→undo→redo coverage at the lowest practical boundary. Transient previews, selection, hover,
playback telemetry, caches, and other disposable session state are not history entries; however, a
preview that results in a durable project edit MUST commit its final value through project history
and MUST restore canonical document/runtime state when cancelled. A deliberately non-undoable
project mutation requires an explicit rationale and project-owner approval in the feature spec and
plan.

### IV. Host-Owned External Runtimes and Engine Isolation
`@blue/data` MAY define abstract execution contracts but MUST NOT launch Java, access files, or
connect directly to the audio engine. Electron main owns Java helper lifecycle, filesystem and
process access, ZeroMQ transport, and host capability detection. Blue Engine communication MUST
flow through the versioned `@blue/engine-client` protocol; renderer and data code MUST NOT couple
to engine-native state. Known, supported Clojure, Jython, and other host-backed project metadata
MUST round-trip when their runtime is unavailable. Serialized-data acceptance MUST be evaluated
separately from runtime availability; unavailable execution MUST produce a clear, recoverable
diagnostic without corrupting the project.

### V. Evidence-Driven Parity and Regression Safety
Behavior, serialization, rendering, runtime, and UI changes MUST include verification proportional
to their risk. Parity fixes MUST begin with the relevant Java source or Java-generated artifact.
Behavioral fixes MUST add or update a focused automated regression test at the lowest practical
boundary; bug fixes MUST reproduce the failure first when the harness supports it. Serialization
changes MUST cover current and historical accepted data, canonical round trips, Java-compatible
XML, unexpected and invalid input diagnostics, and atomic load/import failure. Supported retained
payloads MUST have focused ownership and copy/save coverage. Changes affecting project content
MUST cover applicable history restoration as required by Principle III.
Runtime and IPC changes MUST cover success and failure contracts. If automation is impractical,
the plan MUST record why and the quickstart MUST provide deterministic manual validation. A change
is not complete until affected tests, type checks, lint, and builds pass or a scoped exception is
documented.

### VI. License Boundaries and Source Provenance

Before coding, agents MUST consult `LICENSING.md` and the affected component's license files,
package metadata, third-party notices, and file-specific headers. `LICENSING.md` is the repository's
license-scope map; component and third-party terms MUST be checked rather than inferred from the
repository default or a package's license field. Copying, adapting, translating, or moving code
across scopes, including Java parity work, MUST be checked for compatibility with the destination
and intended distribution. New or changed dependencies, bundled assets, examples, generated tables,
and snippets MUST receive the same check. This protects the repository's existing license boundaries.

Incorporated third-party material MUST have documented provenance: source URL and revision/version
when available, applicable license, destination scope, and required attribution, notices, license
texts, or source distribution. Existing notices MUST be preserved, and affected inventories and
packaging checks MUST be updated. Public availability MUST NOT be treated as permission to reuse
source code. Original implementations from public behavioral or mathematical descriptions MUST cite
their references; translations and AI-generated adaptations MUST NOT be used to bypass the terms
of incorporated material.

Unresolved permission or compatibility MUST block incorporation of the affected material, while
unaffected work MAY continue. Use a compatible alternative or resolve the issue with the project
owner before incorporation. Project-owner approval or a constitutional exception MUST NOT be
treated as granting third-party rights or waiving license obligations.

## Additional Constraints

### TypeScript and Import Discipline
Production TypeScript MUST compile in strict mode and use explicit, statically analyzable module
boundaries. New abstractions MUST solve a demonstrated need; changes MUST prefer the simplest
design that preserves existing contracts. Package dependency direction MUST keep `@blue/data`
independent of Electron, React, Node.js, and host runtime implementations.

### XML and Serialized Resources
XML parsing MUST use `@rgrove/parse-xml` through the repository's `Element`/`Elements` utilities.
Callers own file I/O through APIs such as `BlueData.loadFromString(xml)` and
`blueData.saveToString()`. The acceptance policy applies to projects, standalone instruments,
effects, SoundObjects, UDOs, and their supported library or BlueShare payloads. Each serialized
root and owning class MUST define its expected members, historical aliases/forms, cardinality,
value validation, defaults, and warning/error rules. Declared maps or extension points MUST
specify their allowed contents; they are not blanket permission for arbitrary XML.

Unexpected-input diagnostics MUST identify the source/resource context, owning element path,
offending member or value, severity, and recovery behavior. Validation MUST inspect relevant input
before parsing or loading discards information needed to detect violations. Failed loads/imports
MUST leave the active document, destination library, and source files unchanged. Known text/code
content MUST retain significant whitespace. Serialization output and retained payloads MUST NOT
expose mutable aliases into canonical model or history state.

New persistence locations MUST be named in the spec and plan, including their owner, lifetime,
migration behavior, and relationship to `.blue` project data.

### Migration Ownership and Historical Evidence
Changes spanning project sections or restructuring the project graph MUST use project migrators
on raw XML before model deserialization and canonical-form validation. Historical aliases,
value encodings, defaults, or subtree changes confined to a reusable class MUST be handled at
that class's loading boundary or by a shared resource migration reached by every applicable
loader. Standalone instrument/effect/library/BlueShare loading MUST NOT depend on first loading
a `BlueData` project or on a project version that the resource does not carry.

Every migration MUST have one documented owner and scope, defined ordering and preconditions,
and deterministic behavior for conflicting current/historical forms. Reapplying normalization
to canonical data MUST NOT duplicate or alter supported content. Composed project and class
migrations MUST be validated together, including independently serialized roots where applicable.

Compatibility research MUST examine relevant Java loader and writer history, project upgraders,
standalone disk/library/BlueShare entry points, and available historical artifacts. Record source
revisions, the evidence for accepted historical forms, and the canonical output. A historical typo
or permissive loader branch MUST NOT become an accepted form without evidence or an explicit
compatibility decision. Research and fixture provenance remain subject to Principle VI.

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
compare Java-generated artifacts such as `~/work/blue/demo2026/01.csd`. Serialization work MUST
also consult relevant Java Git history and distinguish class-local compatibility from project
structural migrations and standalone resource entry points. TypeScript divergence is permitted
only when intentional and documented.

### Spec-Driven Delivery
Material features follow `/speckit-specify` → `/speckit-clarify` as needed → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. Plans MUST complete the Constitution Check before research
and after design, including an explicit license-compatibility and provenance assessment. That
assessment MUST identify affected license scopes, proposed external material or cross-scope reuse,
and obligations or unresolved issues. A short statement that only original code is added within an
existing scope is sufficient when applicable. Tasks MUST trace compatibility, state ownership,
boundary contracts, verification, and applicable licensing obligations to concrete files and
runnable validation.

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

Every implementation plan MUST evaluate all core principles before research and after design.
Every task list MUST include the constitution-required compatibility, verification, and applicable
licensing work.
Code review MUST treat an unexplained MUST violation as blocking. A necessary exception MUST be
documented in the plan's Complexity Tracking section with the rejected compliant alternative and
MUST receive explicit project-owner approval.

**Version**: 4.0.0 | **Ratified**: 2026-04-11 | **Last Amended**: 2026-10-01
