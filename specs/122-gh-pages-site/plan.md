# Implementation Plan for the Blue Documentation Site

**Branch** `codex/gh-pages-site` | **Date** 2026-11-20 | **Spec** [spec.md](spec.md)

**Input** Feature specification in this directory.

## Summary

Build a static documentation hub and publish a single complete GitHub Pages artifact from the Blue repository. Keep the product site as the entry point for product information. After verifying the active Blue 3 manual and updating project-controlled links, retire the legacy Java Blue repository and public site in a separate operation. Reuse Quarto, the CLI README, and TypeDoc, and publish versioned editions from an append-only source catalog. Require a strict API documentation check on relevant PRs. Run Pages validation and deployment independently of the desktop and npm release workflows.

## Technical Context

- **Language/Version** Node.js 22 or newer and the workspace's pinned pnpm, Quarto with the repository's current tested manual version, and the source edition's locked TypeDoc.
- **Primary Dependencies** Existing Quarto/Pandoc and TypeDoc plus GitHub's official Pages actions. Use the repository's established browser harness for navigation and search checks.
- **Storage** Git-tracked edition catalog and source revisions, disposable build outputs, and one published Pages artifact.
- **Testing** Catalog and route validation, local link and anchor checks, browser smoke tests under `/blue/`, offline manual smoke, CLI example execution, and edition-retention and cutover checks.
- **Target Platform** GitHub-hosted static project site under `/blue/` and the existing desktop `file://` manual.
- **Project Type** Static documentation and release-independent publishing.
- **Performance Goals** Functional navigation, search, and content correctness in ordinary CI. Stay within the Pages site size limit.
- **Constraints** Read-only PR jobs, protected production deployment, no npm or desktop publishing credentials, immutable edition URLs, public content only, and continued offline manual access.
- **Scale/Scope** Three public sections, two independent release series, a single hosted site, and one coordinated legacy cutover.

## Constitution Check

| Area | Before research | After design |
| --- | --- | --- |
| Portable data core | Pass. The API generator runs at build time. | Pass. Assembly and validation live outside production package source. |
| Java and project compatibility | N/A. The change publishes help and examples. | N/A. No serializer, Java parity, CSD compiler, or runtime behavior changes. CLI smoke uses an existing project fixture. |
| Migration scope and ordering | N/A. The cutover is for documentation URLs. | N/A for project migration. Live Blue 3 verification precedes controlled-link updates and separately authorized retirement. |
| Canonical ownership and contracts | Pass. Existing source owners and release series remain authoritative. | Pass. Maintainer-reviewed catalog owns published editions and recommendation pointers. The artifact is derived, and a failed build preserves the live deployment. |
| Project history and undo/redo | N/A. No project writers are introduced. | N/A. Files created by example commands are disposable validation output. |
| Runtime and engine isolation | Pass. Docs tooling uses the build environment. | Pass. CLI verification uses the published command and its existing host/runtime boundary. |
| Host-path portability | Pass. Browser paths and filesystem paths are distinct. | Pass. Join local paths with host APIs and construct URL paths with forward slashes. Validate the nested public prefix and existing offline `file://` path. |
| Verification evidence | Pass. Independent user flows and failure cases are defined. | Pass. See [quickstart](quickstart.md) for package commands, hosted output, failure cases, and evidence. |
| Correctness/performance separation | Pass. This feature has functional acceptance checks. | Pass. No hosted speed threshold or product performance acceptance. |
| License compatibility and provenance | Pass for design. The repository's GPL default, package MIT notices, and manual GFDL scope were reviewed. | Pass for design. Preserve each publication's own notices, verify Quarto and TypeDoc shipped assets against pinned tool licenses, and retain the Blue 3 manual’s required attribution and source access through the cutover. Resolve any unidentified asset license before copying it into the public artifact. See [research](research.md#copyright-and-attribution). |

## Project Structure

### Documentation for this feature

```text
specs/122-gh-pages-site/
├── checklists/requirements.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/publication.md
```

### Repository layout

```text
.github/workflows/docs-pages.yml   # Proposed verification and protected deployment
docs/site/                        # Proposed landing source, edition catalog, operator guide
docs/manual/                      # Existing Quarto book and offline profile
packages/blue-cli/README.md       # Existing CLI user guide
packages/blue-data/README.md      # Existing Node examples
packages/blue-data/typedoc.json   # Existing strict public API reference
scripts/                          # Site assembly and validation entry points
build/docs-site/                  # Proposed ignored output
```

**Structure Decision**. Keep documentation sources with their owners. Assemble the ignored `build/docs-site/` tree under one public root. Expose `pnpm docs:site:build` and `pnpm docs:site:verify` for local and CI use. Use a single GitHub Actions workflow with read-only verification and a separate protected deployment job. Product-site navigation and other project-controlled manual links are updated after live verification. Retirement of the legacy repository and site is a separate maintainer action.

## Implementation Sequence

1. Build one local site from a catalog with verified source inputs. Add the landing and per-section version navigation. Start with the verified published Blue 3 prerelease and retain the existing installed Quarto profile.
2. Render the CLI and library quickstarts from package-maintained source. Wire strict TypeDoc validation into PR checks and assemble the first versioned tooling pair when a matching public release exists. Until then, section landing pages state that the first versioned docs are pending.
3. Add catalog and URL checks, link and browser checks, and a permissions-limited deployment workflow. Publish from trusted `develop` updates or trusted repair dispatches. Rebuild the retained catalog in each complete artifact. Exercise successive independent releases and a failed update before promotion.
4. Publish and verify the active Blue 3 manual, including the edition label and a representative chapter and image. Update and verify the links the project controls. Schedule legacy site and repository retirement as a separately authorized operation. Tooling release validation proceeds independently.

The plan introduces no constitution exceptions.
