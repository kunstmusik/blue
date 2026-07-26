# Release Workflow Contract

## Workflow Responsibilities

| Workflow      | Trigger                            | Credentials                                                                    | Required Outcome                                                                   | Publication                                                        |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pr.yml`      | Pull requests to `develop`, `main` | Read-only repository token; no production secrets                              | Full build, test, lint, unsigned package, and packaged-app smoke result per target | None; ZIP artifacts uploaded for reviewer download                 |
| `develop.yml` | Push to `develop`                  | Read-only repository token; no production secrets                              | Full build, test, lint, unsigned package, and packaged-app smoke result per target | None; ZIP artifacts uploaded for tester download                   |
| `release.yml` | Stable `vX.Y.Z` tag                | Tag-restricted `release` Environment plus least-privilege repository token      | Complete verified unsigned ZIP set for the tag                                     | One public GitHub Release, published only by the final promoter job |

## Target Matrix

| Target ID     | Runner Family       | Package Formats inside ZIP  | Artifact Naming                                   |
| ------------- | ------------------- | --------------------------- | ------------------------------------------------- |
| `macos-arm64` | macOS Apple Silicon | DMG                         | `blue-macos-arm64-{versionInfo}.zip`               |
| `windows-x64` | Windows             | NSIS                        | `blue-windows-x64-{versionInfo}.zip`               |
| `linux-x64`   | Ubuntu              | AppImage and Debian package | `blue-linux-x64-{versionInfo}.zip`                 |

The `{versionInfo}` is `{version}-pr{number}` for PR builds, `{version}-{short-sha}` for develop builds, and `{version}` for stable builds. macOS x64 is intentionally excluded from the hosted matrix; its local package command is a developer experiment only.

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

- Primary artifact names follow `blue-{os}-{cputype}-{versionInfo}.zip` so they are self-describing and always end in `.zip`.
- Each primary artifact is one ZIP containing only the target's native installer files. Unpacked app directories, `.blockmap` files, helper executables, and builder metadata are excluded.
- A stable workflow uses the exact same three ZIP filenames for its Actions artifacts and GitHub Release assets.
- The stable release also attaches a combined checksum manifest and a machine-readable asset manifest that are independently verified by the publisher.
- No platform job in `pr.yml` or `develop.yml` creates, edits, or publishes a GitHub Release.
- The `release.yml` promoter validates the complete asset set before creating the public release.

## Signing Policy

- Official releases are **unsigned by default** (open-source project, no paid signing accounts).
- The `electron-builder.yml` sets `identity: null` to disable macOS auto-discovery.
- The `release.yml` workflow uses `release-credential-preflight.mjs --advisory` to report credential availability without blocking.
- macOS signing/notarization and Windows signing are not performed by the current workflows, even if credentials are present. They remain future work until the required signing programs and keys are funded.
- The release body labels the packages as unsigned and provides platform-specific installation guidance.

## Security Contract

- `pr.yml` and `develop.yml` must not reference macOS, Windows, or protected release credentials.
- Fork and Dependabot workflows retain normal read-only validation behavior and cannot access protected credentials.
- The `release.yml` workflow uses a tag-restricted GitHub Environment as its publication and future-credential boundary. The current single-maintainer policy does not require a second-person reviewer; the immutable version-tag push is the explicit release decision. No signing-related secret or identity-token permission is used by the current workflows.
- Workflow jobs declare explicit `GITHUB_TOKEN` permissions. The `release.yml` publisher receives `contents: write`; all other jobs default to `contents: read`.
- Workflows pass sensitive values by secret context and environment variables, never by command-line argument or generated release text.

## Release Notes

The stable release body includes:

1. **Source revision** — the immutable commit SHA.
2. **Signing status** — unsigned, with installation workarounds.
3. **Runtime prerequisites** — Java, Csound, `blue-engine` are not bundled.
4. **Verification** — links to `checksums-sha256.txt` and `release-manifest.json`.
5. **Auto-generated changelog** — GitHub's `generate_release_notes: true` appends a "What's Changed" section with merged PR titles and new contributors.

## Failure and Recovery Contract

- A failed, skipped, missing, duplicate, or unexpected target artifact blocks stable publication.
- Any failure before the final promoter step leaves the release unpublished and reports the required remediation.
- A `develop.yml` or `pr.yml` failure retains diagnostic artifacts for 7 days.
- Stable release retry uses the same immutable tag/source revision and validates that the existing release has not already been published before attempting promotion.
