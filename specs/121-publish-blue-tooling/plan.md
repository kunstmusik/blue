# Implementation Plan for Publishing Blue’s Node Tools and Agent Skill

**Branch** `codex/121-publish-blue-tooling` · **Date** 2026-11-19 · **Spec** [Feature specification](spec.md)

**Input** `specs/121-publish-blue-tooling/spec.md`

## Summary

Release the portable data library and existing command-line compiler as public npm packages. Verify isolated installs from the exact publishable archives, document the consumer workflows, and publish the GitHub-installable `blue-projects` skill.

## Technical Context

- **Language and runtime** — TypeScript and Node.js. Align the public runtime floor with the tested workspace baseline of Node 22.
- **Dependencies** — pnpm, Vite+, TypeScript, esbuild, QuickJS, `@rgrove/parse-xml`, and the CLI’s existing `zeromq` and Java helper.
- **Storage** — Caller-owned `.blue` input and output, generated `.csd`, npm tarballs and registry metadata, and skill source in Git.
- **Target platforms** — Node and browser bundlers for the data package. macOS arm64, Windows x64, and Linux x64 for the CLI.
- **Testing** — Package and workspace correctness suites, archive inventory, isolated consumer installs, and a clean skill installation.
- **Scope** — Two public packages and one skill. Java 17+ is required for Java-backed sources. This work defines no new performance targets.

## Constitution Check

*Initial gate recorded before research. Re-evaluate against the completed contracts and quickstart.*

- **Portable data core — PASS.** Keep portable static imports in production sources and put any Node-specific packaging steps outside `src`.
- **Java and project compatibility — PASS.** Preserve the current code paths for data and CSD generation. Test existing fixtures including a supported legacy project and a Java-backed compilation. If a semantic defect requires a change, first consult the applicable Java source or generated artifact and record evidence.
- **Migration scope and ordering — N/A.** Existing project and independently serialized resource loaders retain their owning migration boundaries.
- **Canonical ownership and contracts — PASS.** Keep project data under `BlueData` and `.blue` XML. The standalone Node caller owns file I/O and the CLI owns its generated CSD and runtime lifecycle. npm owns package metadata and Git owns release and skill source revisions.
- **Project history and undo/redo — N/A.** The release adds no desktop mutations or new project-write API. The standalone example saves to a new sibling path through the existing serializer.
- **Runtime and engine isolation — PASS.** Retain the CLI’s Java, external-command, filesystem, and ZeroMQ ownership and the data package’s injected runtime contract. No new Csound engine integration.
- **Host-path portability — PASS.** Use native host paths in the examples and harness. Exercise a path with spaces and relative resources on the supported release matrix, including Windows.
- **Verification evidence — PASS.** Define consumer-level checks for module loading, declarations, browser bundling, serialization, CLI success and failure, and skill installation. Use existing targeted tests, type checks, builds, and lint as additional gates.
- **Correctness and performance separation — PASS.** Run functional cases in ordinary CI. Archive size is inventory evidence and carries no speed assertion.
- **License compatibility and provenance — PASS for design.** Review root and package licensing. Keep existing MIT, Apache-2.0, ISC, and separate Java distribution obligations intact. Restore missing attribution in packed output and verify Java sources and notices. Write the skill and examples as original material in their destination scopes. Record any new dependency or reused fixture before incorporation.

## Project Structure

### Documentation for this feature

```text
specs/121-publish-blue-tooling/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── npm-packages.md
│   └── blue-projects-skill.md
└── quickstart.md
```

### Implementation locations

```text
packages/blue-data/                 Package exports, emit configuration, README, API comments
packages/blue-cli/                  Package metadata, README, Java bundle and notice checks
scripts/                            Package archive verification and isolated consumer smoke
.github/workflows/npm-release.yml   npm artifact build, consumer matrix, and trusted publisher
skills/blue-projects/               Installable skill, references, original example, license
docs/release-guide.md               Link to the npm procedure
docs/dependency-license-inventory.md
README.md                           Discoverability for both packages and the skill
```

**Structure decision** — Keep one monorepo and the existing workspace names. The release job uses scoped names in the packed manifests. The npm workflow and instructions can share repository conventions with the [desktop release guide](../../docs/release-guide.md) while keeping their tags and publication independent.

## Implementation Sequence

1. **Prepare the package surface.** Apply the two pnpm publication name mappings and consistent version and runtime metadata. Fix Node conditional resolution and matching declarations without changing host-neutral source ownership. Keep existing workspace test-support entry points. Exclude compiled tests and include applicable attribution and provenance files. Preserve the CLI binary and existing Java build. Verify the published `dependencies` fields contain only installable runtime packages.
2. **Prove the archives.** Build the pair from one commit using the frozen workspace and a focused Node, pnpm, and Java/Maven setup. Pack once, record checksums and source metadata, and distribute those archives to isolated consumer checks on macOS arm64, Windows x64, and Linux x64. Include a browser bundler case, CommonJS and ESM and declarations, project round trip and diagnostics, all CLI mode flags, Java success and failure, and resource paths with spaces. Compare representative output with existing fixtures. See [quickstart](quickstart.md).
3. **Publish the docs and skill source.** Replace stale install and browser instructions and add the tested Node walkthrough and CLI examples. Document the supported API groups and put behavioral TSDoc on their main entry points. Cover CLI exit behavior and runtime prerequisites. Add the skill and validate installation independently of the checkout. See [package contract](contracts/npm-packages.md) and [skill contract](contracts/blue-projects-skill.md).
4. **Wire the npm release.** Validate an immutable `npm-v<version>` tag against both packed manifests. Retain the archive pair and evidence across retries. Gate the isolated publish job on verification. Use explicit dist-tags and compare registry integrity on partial completion. Bootstrap via authenticated maintainer publication of the verified first pair, then configure the protected GitHub Actions trusted publisher per package. Reserve OIDC write permission for the publish job. Confirm both registry versions and the tagged skill install before announcing.

## Post-design Constitution Check

The initial gates still pass. The [package contract](contracts/npm-packages.md) preserves the data and host boundaries and defines safe consumer failure and recovery behavior. The [skill contract](contracts/blue-projects-skill.md) uses a separate output through the current serializer and keeps filesystem operations in the Node example. The [data model](data-model.md) identifies the owners and file lifecycles. The [quickstart](quickstart.md) specifies packed smoke evidence on all declared CLI platforms, including a legacy fixture and failure cases. Existing project histories, migrations, and render semantics stay under their established owners. [Research](research.md#distribution-provenance) records distribution obligations and provenance before implementation. No constitutional exception is needed.
