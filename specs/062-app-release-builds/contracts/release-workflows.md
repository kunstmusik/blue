# Release Workflow Contract

## Workflow Responsibilities

| Workflow          | Trigger                                     | Credentials                                                                     | Required Outcome                                                                                   | Publication                                                         |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ci.yml`          | Pull requests and pushes to `dev` or `main` | Read-only repository token; no production secrets                               | Full build, test, lint, unsigned package, and packaged-app smoke result for every target | None; retain diagnostic artifacts only                              |
| `dev-release.yml` | Scheduled run on `main` and manual dispatch | Release-content token only; no production signing credentials                   | Complete unsigned development package set for one source SHA                                       | One GitHub prerelease with checksums and generated notes            |
| `release.yml`     | Stable `vX.Y.Z` tag                         | Protected release-environment approval plus least-privilege repository token    | Complete unsigned stable package set for the tag                                                   | One public GitHub release, published only by the final promoter job |

## Target Matrix

| Target ID     | Runner Family       | Package Formats             | Required Stable Verification                                                       |
| ------------- | ------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| `macos-x64`   | macOS Intel         | DMG                         | Unsigned package, checksum, and resource smoke                                     |
| `macos-arm64` | macOS Apple Silicon | DMG                         | Unsigned package, checksum, and resource smoke                                     |
| `windows-x64` | Windows             | NSIS                        | Unsigned installer, checksum, and resource smoke                                   |
| `linux-x64`   | Ubuntu              | AppImage and Debian package | Package checksum and resource smoke                                                |

## Build Inputs

Every target job must:

1. Check out the exact source revision identified by the workflow event.
2. Install the pinned Node, pnpm, Java, and Maven-compatible build tooling.
3. Restore dependencies only from the lockfile.
4. Build `@blue/java-runtime` before `@blue/app`, producing `blue-java.jar` and `pythonLib` in the application assets directory.
5. Build the workspace packages needed by the externalized Electron main bundle.
6. Rebuild native modules for the target Electron runtime before producing a package.
7. Run package-input and installed-resource validation before reporting success.

## Artifact Contract

- Every packaged artifact name includes the app version, target platform, and architecture.
- The shared package configuration disables macOS signing identity auto-discovery so local and hosted package scripts are unsigned unless a future signed-release slice changes the config explicitly.
- Every target uploads package artifacts, a per-target SHA-256 checksum file, verification logs, and a machine-readable asset manifest to the workflow run.
- The final promoter downloads artifacts by target ID, consolidates only versioned package assets, and validates the expected complete asset set before creating or publishing a stable release.
- The stable release attaches a single combined checksum manifest and provenance/attestation evidence where supported.
- No platform job creates, edits, or publishes a GitHub Release directly.

## Security Contract

- CI and development workflows must not reference macOS, Windows, or protected release credentials.
- Fork and Dependabot workflows retain normal read-only validation behavior and cannot access protected credentials.
- The stable workflow uses a protected GitHub Environment only for final publication approval. It must not reference Apple signing/notarization credentials, Azure Trusted Signing values, `azure/login`, or `id-token: write` until a future signed-release slice explicitly enables that path.
- Workflow jobs declare explicit `GITHUB_TOKEN` permissions. The final publisher receives `contents: write`; all other permissions default to none unless a required artifact/provenance capability is explicitly named.
- Workflows pass sensitive values by secret context and environment variables, never by command-line argument or generated release text.

## Failure and Recovery Contract

- A failed, skipped, missing, duplicate, or unexpected target artifact blocks stable publication.
- Failure after draft creation leaves the release unpublished and reports the required remediation. The workflow may delete an empty draft but must never publish it.
- A development-release failure publishes no prerelease and retains diagnostic workflow artifacts.
- Stable release retry uses the same immutable tag/source revision and validates that the existing release has not already been published before attempting promotion.
