# Implementation Handoff: Blue App Builds and Releases

## Status

Planning and implementation are complete for the unsigned release-build slice: `electron-builder` configuration, package scripts, CI/release workflows, release manifest validation, and packaged-app smoke checks are present.

SPEC 062 closed on 2026-07-26. Use [tasks.md](./tasks.md) as the completed implementation checklist and [quickstart.md](./quickstart.md) for the sanitized final acceptance evidence. The local unsigned package path is the MVP, and the protected stable-release workflow publishes unsigned packages by default. Signing credential preflight is advisory future-readiness only.

## Read First

1. [tasks.md](./tasks.md): dependency-ordered implementation checklist.
2. [plan.md](./plan.md): source-file layout, delivery sequence, and constitutional boundaries.
3. [contracts/release-workflows.md](./contracts/release-workflows.md): job permissions, artifact completeness, promotion, and failure behavior.
4. [docs/release-guide.md](../../docs/release-guide.md): maintainer-facing operational and future signing contract that must match the implementation.
5. [packages/blue-app/vite.config.ts](../../packages/blue-app/vite.config.ts), [packages/blue-app/src/main/java-runtime/java-runtime-path.ts](../../packages/blue-app/src/main/java-runtime/java-runtime-path.ts), and [packages/blue-java/pom.xml](../../packages/blue-java/pom.xml): existing build/runtime boundaries to preserve.

## Non-Negotiable Invariants

- Keep `@blue/data` browser-safe and unchanged. Packaging code belongs in app/build/workflow files only.
- Preserve `.blue` XML, CSD generation, renderer/main project ownership, and existing IPC contracts.
- Keep `@blue/data`, `@blue/engine-client`, `zeromq`, and `node:sqlite` external in [packages/blue-app/vite.config.ts](../../packages/blue-app/vite.config.ts). The package must make those runtime dependencies resolvable rather than bundling around that boundary.
- Copy `blue-java.jar` and `pythonLib` to installed `resources/assets/java`. The existing resolver must find that preferred location and retain its compatibility fallbacks.
- Package smoke checks must not require Csound, `blue-engine`, or an installed Java runtime. Those are intentionally external end-user prerequisites for this feature.
- Pull-request, develop, and stable packages are unsigned. Develop builds remain GitHub Actions artifacts and do not create prereleases. Never use `pull_request_target` or grant a pull-request job access to the protected `release` Environment.
- Hosted workflows target macOS arm64, Windows x64, and Linux x64. macOS x64 is intentionally local-only.
- Every primary artifact follows `blue-{os}-{cputype}-{versionInfo}.{ext}` and retains its native package extension; Linux AppImage and Debian packages are separate, and stable Actions artifacts and GitHub Release assets use identical filenames.
- Only a final stable-release promoter job may publish a GitHub Release. Platform jobs upload evidence; they never publish independently.

## Current Implementation Anchors

| Concern              | Current state                                                                         | Implementation direction                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Build output         | `@blue/app` emits `dist/main`, `dist/preload`, and `dist/renderer`                    | Package those outputs with `electron-builder` after the Java helper build completes                             |
| Java helper          | Maven copies the JAR and Python library into `packages/blue-app/assets/java`          | Declare them as `extraResources` under installed `resources/assets/java`                                        |
| Java resource lookup | `java-runtime-path.ts` checks installed resources first, then ASAR-unpacked fallbacks | Add a direct preferred-resource test; do not remove fallback candidates                                         |
| Native runtime       | `zeromq` is native; Electron 35 pins the SQLite runtime                               | Rebuild/load native dependencies against the target Electron runtime and smoke them from packaged app main      |
| Workflows            | `pr.yml` (PR validation), `develop.yml` (develop builds), `release.yml` (stable tag)  | Three separate workflows: PR and develop upload artifacts only; release publishes to GitHub Releases            |
| Version              | `@blue/app` is currently `0.0.1`                                                      | Stable tag `vX.Y.Z` must exactly match the package version                                                      |

## External Operator Prerequisites

These are intentionally not source-controlled. Current workflows do not require production signing credentials. Keep signing values documented for future readiness only; enable signed releases only in a dedicated future slice after the release administrator provisions and tests them.

| Platform | Setup                                                                                                               | Source-controlled consumer                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| macOS    | Future Developer ID Application P12, P12 password, Apple notarization account/app-specific password, Apple team ID  | Future signed-release workflow only                                  |
| Windows  | Future Azure Artifact Signing account/profile and GitHub OIDC federated identity                                    | Future signed-release workflow only                                  |
| GitHub   | Tag-restricted `release` Environment, single-maintainer tag-push policy, least-privilege `GITHUB_TOKEN` permissions | GitHub repository settings and `.github/workflows/release.yml`       |

Use the exact value names and handling rules in [docs/release-guide.md](../../docs/release-guide.md). Never record values in this handoff, source, release notes, terminal arguments, or artifacts.

## Required Evidence

The historical closeout evidence collected on 2026-07-26 verified the superseded three-ZIP contract and includes:

1. A clean local unsigned package and packaged-app smoke result on a supported host.
2. A PR run with independent macOS arm64, Windows x64, and Linux x64 evidence, including artifacts on failure.
3. A `develop` push whose source SHA was present in all three ZIP Actions artifact names, which created no GitHub Release and used no production signing credentials.
4. A protected test stable release showing the same three historical ZIP filenames as its Actions artifacts, verified checksums and manifest, unsigned packages, and atomic final publication.
5. Repository validation from the root: `pnpm build`, `pnpm test`, and `pnpm lint`.

The direct-native-package revision has local workflow-contract and manifest coverage; hosted PR, develop, and stable-release evidence for the revised four-asset contract remains pending.

## Worktree Safety

- The feature was planned under `062-app-release-builds`; its closeout documentation was completed on `develop`.
- Existing untracked [RELEASE_PLAN.md](../../RELEASE_PLAN.md) and [RELEASE_PLAN_GEMINI_3_6.MD](../../RELEASE_PLAN_GEMINI_3_6.MD) are user-provided input. Leave them unchanged.
- Treat the already-authored feature documents and [docs/release-guide.md](../../docs/release-guide.md) as the release contract. Update them only to replace planned command names with the implemented commands or to correct an implementation-discovered fact.
- Do not commit, tag, create a public release, or configure credentials unless a user explicitly requests that operation.
