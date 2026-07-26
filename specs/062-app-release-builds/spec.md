# Feature Specification: Blue App Builds and Releases

**Feature Branch**: `062-app-release-builds`

**Created**: 2026-07-21

**Status**: Closed

**Closed**: 2026-07-26

**Input**: User description: "Build Blue as a desktop app and provide automated development and production release builds through GitHub Actions, including a local and GitHub Secrets release guide."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build Blue Locally (Priority: P1)

A Blue contributor can follow one documented local workflow to produce a runnable desktop-app package for their current supported operating system before submitting a change or preparing a release.

**Why this priority**: A reliable local package is the foundation for validating that Blue works outside the development environment and for diagnosing release failures before they reach users.

**Independent Test**: On a clean supported development machine with the documented prerequisites, a contributor follows the local build guide and produces a runnable packaged application without publishing anything.

**Acceptance Scenarios**:

1. **Given** a clean checkout and the documented local prerequisites, **When** a contributor follows the local package-build instructions, **Then** the build produces an application package for the host operating system.
2. **Given** a contributor is missing a required local prerequisite or has future signing variables configured incorrectly, **When** they follow the guide, **Then** it identifies whether the prerequisite is required for the current unsigned build path, future signing, or publication and gives a corrective action.
3. **Given** a locally built package, **When** the contributor opens it and loads a representative Blue project, **Then** the application starts and retains access to its bundled helper resources.

---

### User Story 2 - Trust Every Change (Priority: P1)

A maintainer can rely on automated checks for proposed and integrated changes to confirm that supported desktop distributions can be built and that the repository's required automated checks have passed.

**Why this priority**: Release automation is only dependable when its upstream build and verification path is exercised continuously across the platforms users receive.

**Independent Test**: A proposed change triggers the automated validation workflow, which reports separate, visible results for each supported platform and preserves the output needed to investigate any failure.

**Acceptance Scenarios**:

1. **Given** a pull request or configured integration-branch change, **When** automated validation runs, **Then** the repository build, test suite, and static checks complete on macOS, Windows, and Linux.
2. **Given** automated validation succeeds, **When** packaging validation runs, **Then** it produces an unsigned package or equivalent package evidence for every supported platform without publishing a user-facing release.
3. **Given** a platform-specific build, test, or package check fails, **When** the workflow completes, **Then** the failing platform and failing stage are clearly identified and no release is published from that run.

---

### User Story 3 - Distribute Develop Builds and Publish Stable Releases (Priority: P2)

A release maintainer can create traceable develop builds for early testing through GitHub Actions and publish deliberate stable Blue releases with downloadable ZIP bundles for the supported desktop platforms.

**Why this priority**: Maintainers need a low-friction route for testers while retaining an explicit, auditable promotion point for public releases.

**Independent Test**: A push to `develop` produces clearly named Actions artifacts, and an intentional immutable version-tag trigger publishes a stable release whose assets and metadata identify the exact source revision.

**Acceptance Scenarios**:

1. **Given** a push to `develop`, **When** the workflow runs successfully, **Then** testers can obtain clearly marked unsigned Actions artifacts that are traceable to the source revision that produced them, without a GitHub prerelease.
2. **Given** the maintainer intentionally pushes a stable version tag, **When** the workflow succeeds, **Then** a public release contains unsigned macOS, Windows, and Linux ZIP bundles with a single consistent version.
3. **Given** publication permission is missing or the required platform asset set is incomplete, **When** a stable release is attempted, **Then** publication stops before an incomplete stable release is made available and the maintainer receives an actionable failure message.
4. **Given** an already published version, **When** a maintainer attempts to publish the same version again, **Then** the workflow refuses to overwrite or silently replace the published release.

---

### User Story 4 - Document Release Credentials Safely (Priority: P2)

A release maintainer can use one release guide to configure the current publication boundary and understand future signing credentials without placing sensitive values in source control or workflow output.

**Why this priority**: Publication policy and future signing setup are infrequent, high-impact work that must remain understandable if project maintenance changes hands.

**Independent Test**: A maintainer can configure a fresh local environment and GitHub repository, run the advisory credential preflight, and complete the current unsigned stable release without consulting source code.

**Acceptance Scenarios**:

1. **Given** a maintainer configures stable publication using the guide, **When** they create the `release` Environment, **Then** the single-maintainer tag policy, token scope, and unsigned publication behavior are clear.
2. **Given** a maintainer uses the guide's future signing preflight procedure, **When** a future signing value is absent or malformed, **Then** the procedure reports the missing value without revealing secret contents and does not block current unsigned releases.
3. **Given** a contributor does not have release credentials, **When** they build or validate a package locally, **Then** they can complete the unsigned development workflow without access to production signing secrets.

### Edge Cases

- A build runs on a supported platform where a native dependency cannot be prepared for the desktop runtime.
- A package omits, corrupts, or cannot locate a required bundled Java helper artifact.
- An external runtime required for a project, such as Csound, `blue-engine`, or Java, is not installed on the end user's machine.
- A hosted development build is unsigned because production credentials are intentionally unavailable to the development workflow.
- A package release succeeds on some platforms but fails on another platform before publication completes.
- A forked pull request cannot access repository secrets and must still receive non-secret validation feedback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide one documented, repeatable local workflow that builds a runnable desktop package for the host supported platform without publishing a release.
- **FR-002**: The local workflow MUST distinguish current unsigned local, CI, development, and stable builds from future signed release builds, including their respective prerequisites.
- **FR-003**: The hosted workflows MUST produce distribution bundles for macOS arm64, Windows x64, and Linux x64. macOS x64 MAY remain available as a local developer packaging experiment but is not part of the required hosted artifact set.
- **FR-004**: Automated change validation MUST build, test, and run the repository's required static checks on macOS, Windows, and Linux.
- **FR-005**: Automated change validation MUST perform a non-publishing packaging check on every supported platform and retain useful failure evidence.
- **FR-006**: The project MUST provide an automated develop-build path that uploads clearly identified GitHub Actions artifacts traceable to an immutable source revision and does not create a GitHub prerelease.
- **FR-007**: The project MUST provide an automated stable-release path that publishes a versioned release only after all required platform packages complete successfully.
- **FR-008**: A stable release MUST not be published with incomplete platform assets, a duplicate published version, or missing package verification.
- **FR-009**: The release process MUST use publication credentials supplied outside source control and MUST prevent credential values from being displayed in workflow logs or documentation examples.
- **FR-010**: The project MUST provide a release guide that lists current publication requirements and future signing environment variables, their purpose, expected format, scope, and the workflow that consumes or may consume them.
- **FR-011**: The release guide MUST identify end-user prerequisites that are intentionally not bundled in the first release and explain how a missing prerequisite is detected and resolved.
- **FR-012**: The packaged app MUST retain access to its Java helper artifact and native runtime dependencies after installation.
- **FR-013**: Develop artifacts and stable releases MUST identify the exact source version; stable releases MUST also expose a change summary.
- **FR-014**: Pull-request, develop, and stable builds MUST remain unsigned and function without production signing credentials. Signing is deferred until the required signing programs and keys are funded.
- **FR-015**: Every primary platform artifact MUST be a ZIP named `blue-{os}-{cputype}-{versionInfo}.zip`. For stable builds, `{versionInfo}` MUST be the application version, and the exact same filenames MUST be used for GitHub Actions artifacts and GitHub Release assets.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: The existing Electron application builds its main, preload, and renderer artifacts; it resolves the Java helper and Python support files from development and packaged-resource locations. Current project XML and runtime behavior remain the reference for application functionality.
- **Compatibility Requirements**: Packaging and release work MUST not alter `.blue` XML serialization, canonical project ownership, existing project-document IPC contracts, or generated CSD behavior. Installed packages MUST preserve the existing packaged-resource lookup contract for the Java helper and Python support files.
- **Intentional Divergences**: The first release does not bundle Csound, `blue-engine`, or a Java runtime. These remain documented end-user prerequisites, with clear diagnostics when unavailable. In-application automatic updates are outside this feature's scope.
- **State Ownership**: Project data remains owned by the main-process `BlueData` document and persisted in `.blue` XML. Release configuration is source-controlled. Published artifacts and release metadata are owned by the repository's hosting service. Publication credentials and future signing credentials remain in GitHub-managed or local environment storage and are never persisted in project data or source control.

### Key Entities *(include if feature involves data)*

- **Distribution package**: A platform-specific installable or runnable Blue application artifact associated with one source revision and version.
- **Development build**: A clearly marked unsigned GitHub Actions artifact for tester feedback that is traceable to an immutable source revision and is not published as a GitHub Release.
- **Stable release**: A versioned public distribution containing complete platform packages and verified release metadata.
- **Release credential**: A sensitive local setting, repository secret, or GitHub-provided token used only for publication or future code signing/notarization.
- **Release guide**: Maintainer documentation that defines prerequisites, workflows, credentials, preflight checks, and recovery actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor using a clean supported development environment can produce an unsigned local Blue package by following the release guide with no undocumented steps.
- **SC-002**: 100% of configured pull-request and integration-branch runs report independent build, test, static-check, and packaging results for macOS, Windows, and Linux.
- **SC-003**: A successful develop-build run makes platform ZIP artifacts available in GitHub Actions with the producing source revision visible in each filename and creates no GitHub Release.
- **SC-004**: A successful stable-release run publishes one consistent version with downloadable packages for all defined supported platform and architecture combinations.
- **SC-005**: Advisory credential preflight identifies all absent, invalid, or inapplicable future signing settings and never prints a secret value.
- **SC-006**: The release guide allows a maintainer who did not implement the feature to complete an unsigned local package build, publish a current unsigned stable release, and identify the exact extra credentials required for a future signed public release in one pass.

## Closeout Evidence

- Pull request [#1](https://github.com/kunstmusik/blue-electron-poc/pull/1) [run 30208009454](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30208009454) and [Develop run 30208008087](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30208008087) both passed macOS arm64, Windows x64, and Linux x64 at source revision `b4885819738e0ed697766bb874690bdee056ab67`, including build, test, lint, unsigned packaging, and installed-package smoke verification.
- The successful Develop run retained exactly three primary artifacts named `blue-macos-arm64-0.0.1-b488581.zip`, `blue-windows-x64-0.0.1-b488581.zip`, and `blue-linux-x64-0.0.1-b488581.zip`, and created no GitHub Release.
- Stable Release run [30182366369](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30182366369) published [v0.0.2](https://github.com/kunstmusik/blue-electron-poc/releases/tag/v0.0.2) with identical primary ZIP names in GitHub Actions and GitHub Release assets, plus the verified manifest and checksum file.
- The GitHub `release` Environment has no required reviewer for the current one-maintainer project and permits deployments only from the custom tag rule `v*.*.*`.
- All 57 static release-workflow contract checks pass. The complete sanitized acceptance record is maintained in [quickstart.md](./quickstart.md).

## Assumptions

- Hosted artifacts target macOS arm64, Windows x64, and Linux x64. macOS x64 is intentionally excluded from hosted workflows; a local packaging command may remain for developer experiments. Windows arm64 and additional Linux package managers are deferred until native-runtime support is verified.
- GitHub Actions is the source of truth for pull-request and develop build evidence. GitHub Releases is the source of truth only for stable release assets and metadata.
- The existing pinned Electron runtime, Java helper build, native ZeroMQ dependency, and SQLite runtime remain supported constraints and require package-level validation.
- A maintainer can obtain appropriate Apple and Windows signing credentials before a future signed public release; until then, contributor, CI, development, and stable release builds remain unsigned and usable without those credentials.
- Public release promotion is intentionally explicit and versioned rather than being triggered by every pull request.
- Automatic in-app update delivery, bundled external audio engines, a bundled Java runtime, Snap, Flatpak, and enterprise installer formats are outside this feature's initial scope.
