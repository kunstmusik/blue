# Feature Specification for Publishing Blue’s Node Tools and Agent Skill

**Feature Branch** `codex/121-publish-blue-tooling`

**Created** 2026-11-19

**Status** Beta released. Maintainer release closeout is tracked in [T025 verification](verification.md#t025--public-beta-release-verification).

**Input** Publish Blue’s data library and CLI on npm, document their use, and distribute a Blue project skill from the same GitHub repository.

## User Scenarios & Testing

### User Story 1 — Inspect and edit a Blue project from Node (Priority P1)

A developer installs the Blue data package and uses its documented interface to inspect, create, or make a targeted edit to a project.

**Why this priority** — It gives programs and agents a supported way to work with portable Blue project data.

**Independent test** — In a fresh consumer project, follow the library quick start and verify the saved copy.

**Acceptance scenarios**

1. **Given** a fresh Node project outside the Blue repository, **when** the developer installs `@kunstmusik/blue-data`, **then** both ESM and CommonJS consumers can load its documented entry point, and TypeScript can resolve its declarations.
2. **Given** a valid project, **when** a developer inspects it, edits its title, saves to a sibling file, and reloads the copy, **then** the edit is present, unaffected project content is preserved, and the input file is unchanged.
3. **Given** malformed or unsupported project data, **when** the developer runs the inspection example, **then** the example surfaces the available diagnostics and exits before saving a copy when loading fails.

### User Story 2 — Compile a Blue project from the terminal (Priority P1)

A composer or CI maintainer installs the CLI or invokes it on demand and generates a Csound document from a project without launching the desktop application.

**Why this priority** — It makes Blue’s existing headless compiler available to external projects.

**Independent test** — Install the CLI from the release artifact outside the checkout and compile a plain project and a Java-backed project.

**Acceptance scenarios**

1. **Given** a supported Node environment, **when** the user installs `@kunstmusik/blue-cli` or invokes it with `npx`, **then** the `blue-cli` command can generate a disk-render CSD from a plain project without a Java or Csound installation.
2. **Given** a Java-backed project and the documented Java prerequisites, **when** the user compiles the project, **then** the packaged helper supplies the existing runtime behavior and the CSD includes the generated score or orchestra content.
3. **Given** a Java-backed project and an unavailable Java runtime, **when** the user compiles it, **then** the CLI reports the failure and leaves the input and any existing output unchanged.

### User Story 3 — Install a skill for working with Blue projects (Priority P2)

A user installs the `blue-projects` skill into an agent-enabled workspace. The agent follows its instructions to inspect or edit a project with the Node library or compile it with the CLI.

**Why this priority** — It gives agents the same tested starting points available to developers and composers.

**Independent test** — Install the named skill from GitHub into a clean workspace and follow its documented workflows with the corresponding npm release.

**Acceptance scenarios**

1. **Given** a supported agent and a clean workspace, **when** a user installs `blue-projects` from `kunstmusik/blue` using `npx skills`, **then** the agent can discover the skill and its included references.
2. **Given** an installed skill and a project, **when** the user asks to inspect, edit, or compile it, **then** the skill identifies the appropriate package, documents the applicable setup and side effects, and provides enough detail to verify the result.

### Edge Cases

- Inspection of a project containing scripts remains available independently of the execution runtime. Compilation can run project scripts and external score commands and documents that behavior.
- The CLI rejects a source file used as its output. Its documented disk, realtime, and Blue Live modes retain their existing behavior, including mutually exclusive mode flags.
- Release candidates and stable releases must be distinguishable. A partially published release can be resumed without replacing a published version.

## Requirements

### Functional Requirements

- **FR-001** — Publish two public scoped packages, `@kunstmusik/blue-data` and `@kunstmusik/blue-cli`, with coordinated versions and a release procedure that identifies the source revision.
- **FR-002** — The data package must support its documented package-root imports in Node ESM and CommonJS, expose working TypeScript declarations, and preserve its browser-bundler use.
- **FR-003** — The data documentation must include a runnable Node inspect, edit, save, and reload example. It must explain supported entry points, XML diagnostics and normalization, timing units, and runtime requirements for CSD generation. Browser guidance must match a verified integration.
- **FR-004** — The published CLI must preserve the existing `blue-cli compile` command, disk, realtime, and Blue Live modes, output protection, and host handling of project-relative resource and runtime dependencies.
- **FR-005** — The CLI documentation must describe npm install and on-demand invocation, supported environments, Java prerequisites, compilation modes, project code execution, and the relationship between CSD output and audio rendering.
- **FR-006** — The public `blue-projects` skill must be installable by name from the Blue GitHub repository. It must explain when to use the library or CLI, how to preserve the source when editing, and how to verify each result. Its shipped references must work from an installed skill directory.
- **FR-007** — Release verification must use clean consumer installs of the actual publication artifacts. The tarballs must include runtime resources and applicable licenses and notices, and exclude the data package’s compiled test suite.
- **FR-008** — The release procedure must distinguish prerelease and default channels and record how to recover when one package publishes and the other fails.

### Existing Behavior & Data Compatibility

- **Reference behavior** — Preserve the repository’s existing Java-compatible project and CSD behavior. Validate the packaging changes with existing project and CSD regression fixtures. Any behavior mismatch that needs a semantic fix follows Blue’s Java-first review.
- **Compatibility requirements** — Existing accepted current and historical project files retain their documented load and save behavior, known script payloads remain inspectable without execution, and existing warning, rejection, and safe-save behavior is preserved.
- **Migration boundaries** — Existing project and resource loaders retain ownership and ordering. This release introduces no serialized form or migration.
- **Intentional divergences** — None in project XML, runtime behavior, or generated CSD.
- **State ownership** — `BlueData` owns in-memory project state and `.blue` XML remains canonical on disk. A standalone caller owns its input and output paths. A CSD is a generated artifact. npm and Git store release metadata and skill source independently of compositions.
- **Undo/redo impact** — The desktop app gains no project writer. The Node example uses existing APIs on a separately loaded model and writes a new output file.

### Key Entities

- **Blue project** — A canonical `.blue` input or saved copy whose model and diagnostics are available to a caller.
- **Csound document** — A generated `.csd` output for a selected compilation mode.
- **Tooling release** — A versioned pair of installable artifacts tied to one source revision and verified with the matching consumer examples.
- **Agent skill** — An installable set of Blue project workflows and references that names its compatible package versions.

## Success Criteria

### Measurable Outcomes

- **SC-001** — Both documented module-loading paths run the same successful project round trip from a fresh installation. One invalid project case reports diagnostics and leaves the filesystem unchanged.
- **SC-002** — On each declared CLI platform, a fresh installation generates CSDs for one plain fixture and one Java-backed fixture, and the missing-Java case reports failure while preserving the output.
- **SC-003** — The named skill installs in one clean agent workspace. Its instructions reproduce one inspect-and-save workflow and one CLI compilation using the corresponding package versions.
- **SC-004** — Both publishable artifacts pass inventory checks and all applicable consumer acceptance checks before a release is announced. The operator can verify the exact source revision and the intended release channel for each package.

## Assumptions

- The first public release is an early-access SDK and CLI. The release plan proposes a shared initial version independent of the desktop app and project format versions.
- Package publication requires maintainer access to the npm scope and repository release settings.
- The project examples and package READMEs ship with the first release. A generated TypeDoc HTML site is follow-up work.
- Audio rendering, new CLI commands, changes to Blue’s project format, and publication of private workspace packages are outside this feature.
