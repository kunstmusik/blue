# Research: Blue App Builds and Releases

## Decision: Use electron-builder for packaging

**Decision**: Add `electron-builder` as the packaging tool for `@blue/app`, with a package-local configuration and root-level package scripts.

**Rationale**: Blue already produces Electron main, preload, and renderer output under `packages/blue-app/dist/`. The selected packager can consume that output, emit the required DMG, NSIS, AppImage, and Debian packages, rebuild the native ZeroMQ module for the target Electron runtime, and declare resources that must remain outside the ASAR archive. It fits the existing Vite-based build instead of replacing the application build system.

**Alternatives considered**:

- Electron Forge: supported by Electron and a sound option for new applications, but would require reworking the established Vite build and packaging surface.
- Hand-authored platform packaging: rejected because native-module rebuilding, code signing, notarization, installer production, and release metadata would become separate bespoke concerns.

## Decision: Build each release package on a native target runner

**Decision**: Build macOS x64, macOS arm64, Windows x64, and Linux x64 packages in separate GitHub Actions jobs on matching hosted runners. Use the same unsigned target matrix for packaging validation, development prereleases, and current stable releases.

**Rationale**: Blue depends on Electron's pinned Node/SQLite runtime and the native `zeromq` package. Native target runners provide the most reliable rebuild and runtime verification path. GitHub Actions supports platform matrices and job dependencies, so the final publication job can run only after all required platform builds succeed.

**Alternatives considered**:

- Cross-compiling all targets from macOS: rejected because it reduces confidence that native dependencies load on Windows and Linux.
- Supporting Windows arm64 now: deferred until its native dependency path is verified; it is not required for the first release.
- Producing Linux Snap, Flatpak, RPM, or enterprise MSI packages now: deferred because their runtime, sandbox, or maintenance requirements do not contribute to the initial supported distribution path.

## Decision: Stage a draft release before publishing complete assets

**Decision**: The stable workflow creates a draft GitHub release, uploads artifacts produced by all successful platform jobs, verifies resource placement, checksums, and the complete asset manifest, then publishes the release in one final protected job. A release tag `vX.Y.Z` is the stable trigger and must match `@blue/app`'s version.

**Rationale**: GitHub Actions job dependencies make the publish job conditional on the complete build matrix. Draft staging prevents users from seeing a release with only a subset of its platform installers. A tag-version check provides a small, explicit versioning policy without introducing a repository-wide automated versioning tool.

**Alternatives considered**:

- Let each platform job publish independently: rejected because a late platform failure leaves a user-visible incomplete release.
- Add release-please or Changesets in this feature: deferred because automated version selection and changelog conventions are independent policy decisions. GitHub-generated release notes satisfy the initial traceable change-summary requirement.

## Decision: Publish scheduled development prereleases from main

**Decision**: A nightly workflow builds the current `main` revision into a clearly marked GitHub prerelease and also supports manual dispatch for an immediate development build. It has no production signing credentials.

**Rationale**: Scheduled runs use the default branch and provide regular tester builds without requiring a new permanent development branch. Manual dispatch makes a specific candidate available when needed. The release name, artifact names, and metadata record the immutable commit SHA and a generated prerelease version.

**Alternatives considered**:

- Publish a development release on every push to `main`: rejected because it creates unnecessary release noise and consumes costly macOS/Windows runner capacity.
- Create a `develop` branch solely for prereleases: deferred until the repository adopts that branching policy.

## Decision: Package Blue's Java helper as an external app resource

**Decision**: The packager copies `assets/java/blue-java.jar` and the generated `assets/java/pythonLib/` tree to the installed application's resource directory. Native `.node` modules remain unpacked from ASAR. Packaged smoke verification must prove that the established Java-helper resource resolver finds both resources and that the Electron main process can load ZeroMQ.

**Rationale**: `@blue/java-runtime` already produces the JAR and Python library at those paths. Existing production resource resolution checks `resources/assets/java` before legacy ASAR-unpacked candidates. The Vite main bundle deliberately externalizes `@blue/data`, `@blue/engine-client`, `zeromq`, and `node:sqlite`, so a package test must confirm all runtime dependencies remain resolvable after installation.

**Alternatives considered**:

- Bundle the Java helper inside the application archive: rejected because it must be passed to an external Java process and its Python support directory must be addressable on disk.
- Bundle Csound, `blue-engine`, or a Java runtime in the first installer: rejected as an intentional scope boundary. Their installation and capability diagnostics remain documented user prerequisites.

## Decision: Defer signed releases while documenting future readiness

**Decision**: Current stable macOS and Windows releases are unsigned. Apple Developer ID signing/notarization and Azure Trusted Signing are documented as future release-readiness inputs but are not consumed by the current workflows.

**Rationale**: The initial goal is repeatable downloadable packages and automated release publication without blocking on signing credentials. Keeping signing out of the current workflow preserves contributor and maintainer velocity while leaving a documented path for future OS trust improvements.

**Alternatives considered**:

- Store a Windows P12 certificate in GitHub Secrets now: rejected because the current slice does not enable signed Windows releases and repository-wide signing secrets would broaden exposure.
- Require signing credentials for stable builds now: rejected because the explicit release policy is unsigned by default, with signed builds reserved for future work.
- Implement full signing now: deferred because Apple notarization, Azure OIDC, signature verification, and installer trust policy should be validated in a dedicated signed-release feature.

## Decision: Isolate credentials and minimize workflow authority

**Decision**: Use a protected GitHub Environment dedicated to stable release publication, require human approval before the publisher job runs, and grant only the permissions required by each workflow job. CI receives `contents: read`; release publication receives `contents: write`; provenance generation receives only its specific attestation permission. Future signing credentials should use the same protected-environment boundary when signing is enabled.

**Rationale**: GitHub recommends protected environments for controlled deployments, passes no secrets to forked pull requests, and supports job-specific `GITHUB_TOKEN` permissions. GitHub artifact attestations provide optional verifiable provenance for published installers.

**Alternatives considered**:

- Make every future signing credential a repository-wide secret: rejected because it broadens access to high-impact credentials.
- Use `pull_request_target` for release validation: rejected because it would expose a higher-permission token to pull-request code.
- Treat Action secrets as command-line arguments: rejected because GitHub advises passing sensitive values through environment variables or standard input rather than process arguments.

## Decision: Keep automatic in-app updates out of this feature

**Decision**: Do not add update-client functionality or update-channel settings in this release-build feature.

**Rationale**: Downloadable releases and reliable CI are independently valuable and can be verified without changing runtime update behavior. An updater changes user-facing application state, release metadata requirements, and support expectations; it should be specified separately.

**Alternatives considered**:

- Add an updater now: rejected to keep the initial delivery focused on local packages, CI evidence, and trustworthy release publication.

## Sources

- Electron, [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing): macOS signing/notarization and modern Windows cloud-signing guidance.
- GitHub, [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions): matrices, dependencies, concurrency, permissions, environments, and secret limitations.
- GitHub, [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions): protected environments, fork behavior, and safe secret handling.
- GitHub, [Using artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations): build-provenance capability.
- Microsoft, [Authenticate to Azure from GitHub Actions by OpenID Connect](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect): OIDC setup and required Azure identity values.
- Microsoft, [Set up Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart): managed Windows certificate profiles and identity-validation requirements.
