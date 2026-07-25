# Release Workflow Contract

## Workflow Responsibilities

| Workflow        | Trigger                          | Credentials                                                                  | Required Outcome                                                                        | Publication                                                  |
| --------------- | -------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pr.yml`        | Pull requests to `develop`, `main` | Read-only repository token; no production secrets                         | Full build, test, lint, unsigned package, and packaged-app smoke result per target      | None; installer artifacts uploaded for reviewer download     |
| `develop.yml`   | Push to `develop`                | Read-only repository token; no production secrets                            | Full build, test, lint, unsigned package, and packaged-app smoke result per target      | None; installer artifacts uploaded for tester download       |
| `release.yml`   | Stable `vX.Y.Z` tag              | Protected `release` Environment approval plus least-privilege repository token | Complete stable package set for the tag, signed only when credentials are configured     | One public GitHub Release, published only by the final promoter job |

## Target Matrix

| Target ID     | Runner Family       | Package Formats             | Artifact Naming                                              |
| ------------- | ------------------- | --------------------------- | ----------------------------------------------------------- |
| `macos-x64`   | macOS Intel         | DMG                         | `blue-macos-x64-{version}-{suffix}`                        |
| `macos-arm64` | macOS Apple Silicon | DMG                         | `blue-macos-arm64-{version}-{suffix}`                      |
| `windows-x64` | Windows             | NSIS                        | `blue-windows-x64-{version}-{suffix}`                      |
| `linux-x64`   | Ubuntu              | AppImage and Debian package | `blue-linux-x64-{version}-{suffix}`                        |

The `{suffix}` is `pr{number}` for PR builds and `{short-sha}` for develop builds. Stable releases publish directly to the GitHub Release assets list.

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

- Artifact names follow `blue-{os}-{cputype}-{version}-{suffix}` so they are self-describing.
- Only installer files are uploaded as artifacts (`.dmg`, `.exe`, `.AppImage`, `.deb`). Unpacked `.app` bundles, `.blockmap` files, and `builder-debug.yml` are excluded.
- The stable release attaches a single combined checksum manifest and a machine-readable asset manifest.
- No platform job in `pr.yml` or `develop.yml` creates, edits, or publishes a GitHub Release.
- The `release.yml` promoter validates the complete asset set and creates a draft before publishing.

## Signing Policy

- Official releases are **unsigned by default** (open-source project, no paid signing accounts).
- The `electron-builder.yml` sets `identity: null` to disable macOS auto-discovery.
- The `release.yml` workflow uses `release-credential-preflight.mjs --advisory` to report credential availability without blocking.
- macOS signing/notarization and Windows Azure Trusted Signing are performed only when their respective secrets are present in the `release` Environment.
- The release body dynamically labels each platform as signed or unsigned with platform-specific installation workarounds.

## Security Contract

- `pr.yml` and `develop.yml` must not reference macOS, Windows, or protected release credentials.
- Fork and Dependabot workflows retain normal read-only validation behavior and cannot access protected credentials.
- The `release.yml` workflow uses a protected GitHub Environment for publication approval. Signing-related secrets and `id-token: write` are only active when explicitly configured by a maintainer.
- Workflow jobs declare explicit `GITHUB_TOKEN` permissions. The `release.yml` publisher receives `contents: write`; all other jobs default to `contents: read`.
- Workflows pass sensitive values by secret context and environment variables, never by command-line argument or generated release text.

## Release Notes

The stable release body includes:

1. **Source revision** — the immutable commit SHA.
2. **Per-platform signing status** — dynamically generated (signed or unsigned with installation workarounds).
3. **Runtime prerequisites** — Java, Csound, `blue-engine` are not bundled.
4. **Verification** — links to `checksums-sha256.txt` and `release-manifest.json`.
5. **Auto-generated changelog** — GitHub's `generate_release_notes: true` appends a "What's Changed" section with merged PR titles and new contributors.

## Failure and Recovery Contract

- A failed, skipped, missing, duplicate, or unexpected target artifact blocks stable publication.
- Failure after draft creation leaves the release unpublished and reports the required remediation.
- A `develop.yml` or `pr.yml` failure retains diagnostic artifacts for 7 days.
- Stable release retry uses the same immutable tag/source revision and validates that the existing release has not already been published before attempting promotion.
