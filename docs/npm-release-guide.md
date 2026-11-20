# Blue npm Tooling and Skill Release Guide

This guide defines the maintainer procedure, security boundary, and recovery workflow for publishing Blue's standalone Node/browser npm packages and the matching GitHub-hosted agent skill:

- **`@kunstmusik/blue-data`** (workspace `@blue/data` in [packages/blue-data](../packages/blue-data/package.json)): portable project data model, `.blue` XML inspection/migration/serialization, and Csound CSD generation for Node.js `>=22` (ESM and CommonJS with TypeScript declarations) and browser bundlers.
- **`@kunstmusik/blue-cli`** (workspace `blue-cli` in [packages/blue-cli](../packages/blue-cli/package.json)): headless `blue-cli` compiler bundling `@blue/data`, QuickJS WASM support, and the separate-process Java helper (`dist/java/`).
- **`blue-projects` skill** ([skills/blue-projects](../skills/blue-projects/SKILL.md)): GitHub-installable agent skill and walkthrough pinned to the same release commit and package versions.

## Scope and Independence from Desktop Releases

npm tooling releases are completely independent of Blue desktop application releases and `.blue` project format versions:

- **Desktop releases** follow [the desktop release guide](release-guide.md), use `v*.*.*` tags, run `.github/workflows/release.yml`, and publish unsigned desktop installers through the GitHub `release` Environment.
- **npm tooling and skill releases** follow this guide, use `npm-v*` tags, run `.github/workflows/npm-release.yml`, and publish `@kunstmusik/blue-data` and `@kunstmusik/blue-cli` to npmjs.com through the GitHub `npm-release` Environment while exposing the matching `skills/blue-projects/` snapshot at that Git tag.

`@kunstmusik/blue-data` and `@kunstmusik/blue-cli` are released together as a coordinated pair sharing one version and Git commit because `@kunstmusik/blue-cli` bundles `@blue/data` from the same source tree and `skills/blue-projects` documents both packages at that exact version.

| Channel                     | Trigger                                      | Environment   | Publication                                                          |
| --------------------------- | -------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| PR verification             | Pull request touching npm/tooling/skill code | None          | Read-only archive pack and 3-OS smoke check; zero registry writes    |
| Verification-only candidate | Manual `workflow_dispatch` on a branch/ref   | None          | Read-only archive pack and 3-OS smoke check; zero registry writes    |
| Tooling prerelease (`next`) | Immutable `npm-vX.Y.Z-<prerelease>` tag      | `npm-release` | Verified `@kunstmusik/blue-{data,cli}` published with `--tag next`   |
| Tooling stable (`latest`)   | Immutable `npm-vX.Y.Z` tag                   | `npm-release` | Verified `@kunstmusik/blue-{data,cli}` published with `--tag latest` |

## Version and Tag Policy

- **Initial shared release**: Both `@kunstmusik/blue-data` and `@kunstmusik/blue-cli` start at shared version `0.1.0` on the npm `latest` dist-tag (`npm-v0.1.0`).
- **Optional prereleases**: Before or between stable releases, publish optional prereleases such as `0.1.0-beta.1` (`npm-v0.1.0-beta.1`) or `0.2.0-rc.1` (`npm-v0.2.0-rc.1`) to the npm `next` dist-tag. Any hyphenated version targets `next`; plain `X.Y.Z` versions target `latest`.
- **`0.x` SemVer rules**:
  - Increment **patch** (`0.1.1`, `0.1.2`, …) for backward-compatible bug fixes, packaging fixes, and documentation updates.
  - Increment **minor** (`0.2.0`, `0.3.0`, …) for new features, new CLI or API capabilities, or breaking changes. Clearly identify breaking changes in the release notes.
- **Immutable `npm-v<version>` Git tags**:
  - Tag format is strictly `npm-v<version>` (for example, `npm-v0.1.0` or `npm-v0.1.0-beta.1`).
  - **Do not use `+` build metadata** in release versions or Git tags.
  - `packages/blue-data/package.json` and `packages/blue-cli/package.json` must carry the exact same `"version"` string matching `<version>` in the tag, and compatible version references in [skills/blue-projects/SKILL.md](../skills/blue-projects/SKILL.md) and [skills/blue-projects/references/node.md](../skills/blue-projects/references/node.md) must match before tagging.
  - Both Git tags and npm package versions are immutable: never force-move a published `npm-v*` tag or attempt to overwrite an existing npm version.

## Verification-Only Workflows and Local Checks

### Automatic PR Verification

Pull requests that change the data package, CLI, Java helper, `skills/blue-projects/`, npm release scripts, or `.github/workflows/npm-release.yml` automatically trigger `.github/workflows/npm-release.yml` in verification-only mode. PR runs use `contents: read` only, never touch the `npm-release` Environment, never request OIDC tokens, and perform **no registry writes**.

### Manual `workflow_dispatch` Release Candidate Verification

Before pushing an immutable `npm-v<version>` tag, run a manual `workflow_dispatch` invocation of `.github/workflows/npm-release.yml` against the candidate branch or commit via the GitHub Actions UI or `gh workflow run`. A `workflow_dispatch` run executes the full `pack-and-validate` build and the 3-platform `verify-consumers` matrix as a dry-run release candidate check with **zero registry writes** (the `publish-npm` job does not run).

### Local Pre-Release Verification

Run local verification from a clean checkout using Node 22+, the `pnpm` version pinned in [package.json](../package.json), JDK 17+, and Maven 3+ (Csound is unnecessary for packing and archive verification). Pack once into an empty temporary directory outside the repository working tree:

```bash
BLUE_NPM_ARTIFACTS="$(mktemp -d)"
pnpm install --frozen-lockfile
pnpm --filter @blue/data test
pnpm --filter blue-cli test
pnpm --filter @blue/data build
pnpm --filter @blue/data pack --pack-destination "$BLUE_NPM_ARTIFACTS"
pnpm --filter blue-cli pack --pack-destination "$BLUE_NPM_ARTIFACTS"
node scripts/verify-npm-packages.mjs \
  "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-data-<version>.tgz" \
  "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-cli-<version>.tgz"
pnpm lint
pnpm test
git diff --check
```

Also verify `skills/blue-projects/` locally before tagging by following [specs/121-publish-blue-tooling/quickstart.md](../specs/121-publish-blue-tooling/quickstart.md#3-verify-skill-installation-and-registry-resolution) against the packed local tarballs.

## Exact-Archive Build and Cross-Platform Verification

`.github/workflows/npm-release.yml` enforces a strict **pack once, verify everywhere, publish the exact verified bytes** invariant:

1. **`pack-and-validate`**:
   - On the initial run (`run_attempt == 1`), confirms both package versions are absent from npm (`npm-v*` tag push) and builds and packs `@kunstmusik/blue-data` (`kunstmusik-blue-data-<version>.tgz`) and `@kunstmusik/blue-cli` (`kunstmusik-blue-cli-<version>.tgz`) **once** from the target commit.
   - Validates package names, coordinated strict SemVer version parity, tag/commit alignment (on `npm-v*` tags), and required archive entries/licenses.
   - Records exact byte counts, per-package sorted archive file inventories (`files`), `entryCount`, full 40-character Git commit SHA, and SHA-512 / SHA-256 digests in `npm-release-manifest.json`.
   - Retains both `.tgz` archives and `npm-release-manifest.json` immutably (`overwrite: false`) under the commit-pinned artifact identity and outputs `artifact-name`, `data-integrity`, and `cli-integrity` so downstream smoke jobs and reruns consume and verify the identical archive bytes.
2. **`verify-consumers` (3-platform matrix)**:
   - Runs in parallel on **`macos-15`** (macOS arm64), **`windows-2022`** (Windows x64), and **`ubuntu-22.04`** (Linux x64).
   - Downloads the exact retained archives and `npm-release-manifest.json` from `pack-and-validate` without re-packing, and verifies version, tag, revision, SHA-512 integrity, and per-package file inventories against the manifest and `pack-and-validate` outputs.
   - Runs `node scripts/verify-npm-packages.mjs` against those tarballs in disposable temporary consumer directories outside the checkout using standard `npm install`, validating:
     - Archive manifests, runtime `engines.node >= 22`, non-workspace dependencies, exclusion of compiled `dist/*.test.*` files, and resolution of all relative license/notice/attribution links.
     - `@kunstmusik/blue-data` ESM/CommonJS export parity and shared `BlueData` identity, strict `NodeNext` `.mts`/`.cts` TypeScript declarations, portable browser ESM bundling and execution, and `examples/inspect-edit.mjs` across current, historical, script-bearing, and malformed inputs.
     - `@kunstmusik/blue-cli` installed `blue-cli` shim across disk, `--realtime`, and `--bluelive` modes, conflicting flag and same-file/hard-link/symlink rejection, native paths with spaces and project-relative resources (including Windows paths), Java 17 compilation, and missing-`JAVA_HOME` failure preservation.

All three `verify-consumers` platform jobs must pass before `publish-npm` can run on a tagged `npm-v*` release.

## GitHub Environment and npm Trusted Publishing (OIDC)

Automated tagged releases use GitHub Actions OIDC via npm Trusted Publishing rather than a long-lived `NPM_TOKEN` secret.

### 1. Protected GitHub `npm-release` Environment

Configure the Environment under **Repository Settings → Environments → `npm-release`**:

1. Leave **Required reviewers** empty while Blue is a single-maintainer project (consistent with [the desktop release guide](release-guide.md#github-configuration)). Pushing an immutable `npm-v*` tag is the maintainer's explicit release action. If Blue gains another active maintainer, add a required reviewer and enable **Prevent self-review**.
2. Under **Deployment branches and tags**, select **Selected branches and tags**, add a **Tag** rule for `npm-v*`, and do **not** add any branch rule. This admits `npm-v0.1.0` and `npm-v0.1.0-beta.1` while blocking pull requests, `workflow_dispatch` branch runs, and desktop `v*.*.*` tags from accessing the `npm-release` Environment.
3. Do not store long-lived npm publish tokens in repository or Environment secrets.

### 2. npm Trusted Publishers on npmjs.com

Configure Trusted Publishing **separately for each package** on npmjs.com (**Package Settings → Trusted Publisher → GitHub Actions**) after the initial 2FA bootstrap creates both packages on the registry:

| Package                 | Owner / Organization | Repository | Workflow filename | Environment name |
| ----------------------- | -------------------- | ---------- | ----------------- | ---------------- |
| `@kunstmusik/blue-data` | `kunstmusik`         | `blue`     | `npm-release.yml` | `npm-release`    |
| `@kunstmusik/blue-cli`  | `kunstmusik`         | `blue`     | `npm-release.yml` | `npm-release`    |

Verify both packages individually; configuring only `@kunstmusik/blue-data` leaves `@kunstmusik/blue-cli` unable to authenticate during `publish-npm`. Once Trusted Publishing is confirmed working, restrict package publishing access on npmjs.com to require 2FA and disallow legacy/granular tokens where possible.

### 3. Publisher Isolation and Tool Floors (`publish-npm`)

In `.github/workflows/npm-release.yml`, the `publish-npm` job enforces:

- **Tag-only gating**: Runs only on `push` to `refs/tags/npm-v*`, after `pack-and-validate` and all three `verify-consumers` jobs succeed, inside `environment: npm-release`.
- **Isolated `id-token: write`**: `id-token: write` (alongside `contents: read`) is granted **only** to `publish-npm`—never at workflow scope, in `pack-and-validate`, or in `verify-consumers`.
- **OIDC tool floors**: `publish-npm` requires **`Node >= 22.14.0`** and **`npm >= 11.5.1`** so npm CLI can perform OIDC token exchange and publish directly from the retained verified `.tgz` archives with `--access public --tag <latest|next>`.

## Initial 2FA Bootstrap Procedure (First Public Release)

npm Trusted Publishing can only be configured on npmjs.com for **existing** packages. Because neither `@kunstmusik/blue-data` nor `@kunstmusik/blue-cli` exists on npm before the initial release, the very first publish must be bootstrapped manually by the maintainer using 2FA. **Never publish placeholder versions** (such as `0.0.0` or dummy tarballs) just to create package records, and **never publish locally re-packed tarballs** that bypassed the 3-platform verification matrix.

1. **Prepare and verify the release commit across the 3-OS matrix**:
   - Ensure `0.1.0` (or `0.1.0-beta.1` if starting with a prerelease) is committed in `packages/blue-data/package.json`, `packages/blue-cli/package.json`, and `skills/blue-projects/`.
   - Trigger a verification-only `workflow_dispatch` run on `.github/workflows/npm-release.yml` (or push the annotated `npm-v<version>` tag so `pack-and-validate` and all three `verify-consumers` jobs run first).
   - Wait for `pack-and-validate` and **all three** `verify-consumers` jobs (`macos-arm64`, `windows-x64`, `linux-x64`) to succeed.

2. **Download and verify the exact matrix-verified archive pair**:
   Download the retained `npm-tooling-archives-<version>-<sha>*` workflow artifact into a clean directory outside the checkout, save a local backup copy in case workflow retention expires before recovery, and verify its manifest, digests, and file inventories against the exact release tag and 40-character source commit SHA:

   ```bash
   BLUE_NPM_ARTIFACTS="$(mktemp -d)"
   # Unzip the downloaded workflow artifact (`kunstmusik-blue-data-<version>.tgz`,
   # `kunstmusik-blue-cli-<version>.tgz`, and `npm-release-manifest.json`) into $BLUE_NPM_ARTIFACTS,
   # then verify the exact retained pair before running `npm publish`:
   node scripts/verify-npm-release.mjs verify-manifest \
     --manifest "$BLUE_NPM_ARTIFACTS/npm-release-manifest.json" \
     --artifacts-dir "$BLUE_NPM_ARTIFACTS" \
     --expected-version "<version>" \
     --expected-tag "npm-v<version>" \
     --expected-revision "<full-40-char-sha>"
   ```

   Download the three `npm-smoke-*` reports from that same workflow run. Confirm they cover `darwin-arm64`, `win32-x64`, and `linux-x64` with Node 22, and that both `archives.data.integrity` and `archives.cli.integrity` in every report match their respective SHA-512 values in the retained manifest. Record the workflow run link, full source revision, both digests, and the three passing reports in [verification.md](../specs/121-publish-blue-tooling/verification.md). These checks are required before either archive can be published.

3. **Tag the verified commit** if this candidate was built via `workflow_dispatch`:

   ```bash
   git tag -a -m "Blue npm tooling <version>" "npm-v<version>" "<full-40-char-sha>"
   git push origin "refs/tags/npm-v<version>"
   ```

   Use the full source revision from the verified manifest in the tag command. Wait for the tagged matrix to pass, then repeat step 2 with the tagged run’s retained archives and reports. This makes the tagged pair the input for both bootstrap and future reruns. The automated publisher may fail until Trusted Publishing is configured.

4. **Publish both verified archives with maintainer 2FA**: Authenticate via `npm login` (interactive 2FA), then publish the exact downloaded, matrix-verified `.tgz` files directly using `--access public` and `--tag latest` (for stable `0.1.0`) or `--tag next` (for prereleases such as `0.1.0-beta.1`):

   ```bash
   npm whoami
   npm publish "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-data-<version>.tgz" --access public --tag <latest|next>
   npm publish "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-cli-<version>.tgz" --access public --tag <latest|next>
   ```

   Do **not** run `npm publish` from source package directories (that would re-pack and change the archive bytes/digest).

5. **Run the post-publication verification checklist** below, then configure npm Trusted Publishing for both `@kunstmusik/blue-data` and `@kunstmusik/blue-cli` on npmjs.com before the next release.

## Standard Automated Tagged Release Procedure

Once both packages exist on npm and Trusted Publishing is configured for both `@kunstmusik/blue-data` and `@kunstmusik/blue-cli`:

1. Update `"version"` in `packages/blue-data/package.json` and `packages/blue-cli/package.json` to the shared `<version>`, and update compatible version references in `skills/blue-projects/SKILL.md` and `skills/blue-projects/references/node.md`.
2. Run local verification (`pnpm test`, `pnpm lint`, single-pack + `node scripts/verify-npm-packages.mjs`, candidate `skills/blue-projects` walkthrough, and `git diff --check`), and optionally run a manual `workflow_dispatch` verification-only run on the candidate commit.
3. Create and push the immutable annotated Git tag:

   ```bash
   git tag -a npm-v<version> -m "Blue npm tooling <version>"
   git push origin npm-v<version>
   ```

4. Wait for `pack-and-validate`, the 3-platform `verify-consumers` matrix, and `publish-npm` in `.github/workflows/npm-release.yml` to succeed.
5. Complete the [post-publication verification checklist](#post-publication-verification-checklist) before announcing.

## Failure and Partial-Release Recovery

| Stage / Failure                                               | Registry State     | Required Action                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack-and-validate` or `verify-consumers` failure             | Nothing published  | Fix the defect on a new commit and cut a new `npm-v<next-version>` tag if a tag was already pushed. Never move or reuse an existing release tag.                                                        |
| Trusted Publishing auth/404 failure on `publish-npm`          | Nothing or partial | Confirm both packages exist and have Trusted Publisher (`kunstmusik/blue`, `npm-release.yml`, `npm-release`) configured, then re-run failed jobs (or recover below).                                    |
| Partial release (one package published, one failed/aborted)   | One version on npm | Prefer **Re-run failed jobs** while the retained artifact exists; even a full **Re-run all jobs** reuses the same retained pair without re-packing.                                                     |
| Tagged rerun after 30-day artifact retention expiry           | Nothing or partial | `pack-and-validate` refuses to re-pack on `run_attempt > 1`. Recover only from locally saved matrix-verified tarballs verified against `npm-release-manifest.json`, or cut a new `npm-v<next-version>`. |
| Existing version on npm has **mismatching** SHA-512 integrity | Conflicting bytes  | **Stop immediately.** Publication is blocked. Bump both packages and `skills/blue-projects/` to `<next-version>` and cut a new `npm-v<next-version>`.                                                   |
| Defect discovered after both packages are published           | Both versions live | Never unpublish/overwrite; deprecate or note the affected version on npm if needed and publish a new patch/prerelease `npm-v<next-version>`.                                                            |

### How Immutable Reruns and Partial-Release Recovery Work

1. **Failed `publish-npm` within retention (preferred recovery)**: Click **Re-run failed jobs** in GitHub Actions so `publish-npm` downloads the original commit-pinned `npm-tooling-archives-<version>-<sha>` artifact directly. Even if an operator clicks **Re-run all jobs**, `pack-and-validate` on `run_attempt > 1` downloads, verifies, and reuses the existing retained artifact (`overwrite: false`) instead of re-packing new tarballs.
2. **Expired retention or missing retained artifact on rerun**: Once GitHub Actions retention expires (after 30 days) and the retained artifact is gone, `pack-and-validate` intentionally stops with a recovery error rather than re-packing new archive bytes under the same `npm-v*` tag. If you downloaded the matrix-verified artifact bundle before expiry, verify those exact files against the original `npm-release-manifest.json` (`node scripts/verify-npm-release.mjs verify-manifest --manifest .../npm-release-manifest.json --artifacts-dir ... --expected-version <ver> --expected-tag npm-v<ver> --expected-revision <sha>`) and publish only the missing archive directly (`npm publish <missing.tgz> --access public --tag <latest|next>`). If no locally saved copy of the verified archive pair remains, cut a new `npm-v<next-version>` release from a new commit instead of re-packing the old tag.
3. **Pre-publish manifest & inventory check**: Before calling `npm publish`, `publish-npm` verifies every archive's byte count, SHA-512 integrity, SHA-256 digest, per-package sorted `files` inventory, and `pack-and-validate` output digests (`data-integrity` / `cli-integrity`).
4. **Registry check per package**: For `@kunstmusik/blue-data` and `@kunstmusik/blue-cli`, `publish-npm` checks the registry with `npm view <pkg>@<ver> dist.integrity`.
   - **Matching SHA-512 integrity**: The already-published package holds the exact verified bytes from `pack-and-validate`. `publish-npm` logs the verified match, **skips that package cleanly**, and continues to publish the missing package from its retained archive.
   - **Mismatching SHA-512 integrity**: `publish-npm` **blocks publication and exits non-zero** without publishing or modifying dist-tags. Treat that version as burned, diagnose how conflicting bytes reached npm, and cut a new `npm-v<next-version>`.

## Maintainer Dist-Tag Repair

If a partial release, manual bootstrap step, or interrupted workflow leaves npm dist-tags (`latest` or `next`) out of sync between `@kunstmusik/blue-data` and `@kunstmusik/blue-cli`, repair the dist-tag without re-publishing:

1. Inspect the registry integrity and current dist-tags for both packages:

   ```bash
   npm view @kunstmusik/blue-data@<ver> dist.integrity
   npm view @kunstmusik/blue-cli@<ver> dist.integrity
   npm dist-tag ls @kunstmusik/blue-data
   npm dist-tag ls @kunstmusik/blue-cli
   ```

2. Confirm each package's `dist.integrity` matches `npm-release-manifest.json` for `<ver>`. Never point `latest` to an unverified version or a broken prerelease.
3. Update the missing or stale tag (`latest` for stable `X.Y.Z`, or `next` for prereleases):

   ```bash
   npm dist-tag add @kunstmusik/blue-data@<ver> <tag>
   npm dist-tag add @kunstmusik/blue-cli@<ver> <tag>
   ```

4. Re-run `npm dist-tag ls` on both packages to confirm they match.

## Post-Publication Verification Checklist

Run these checks from a clean temporary directory outside the Blue repository before announcing a tooling release (replace `<ver>` with the published version, such as `0.1.0`):

1. **Confirm registry integrity and dist-tags match `npm-release-manifest.json`**:

   ```bash
   npm view @kunstmusik/blue-data@<ver> dist.integrity
   npm view @kunstmusik/blue-cli@<ver> dist.integrity
   npm dist-tag ls @kunstmusik/blue-data
   npm dist-tag ls @kunstmusik/blue-cli
   ```

2. **Install the tagged `blue-projects` skill and inspect its files**:

   ```bash
   npx skills add https://github.com/kunstmusik/blue/tree/npm-v<ver>/skills/blue-projects --skill blue-projects
   ```

   For non-interactive validation in a clean workspace (for example with Codex), run:

   ```bash
   npx skills add https://github.com/kunstmusik/blue/tree/npm-v<ver>/skills/blue-projects \
     --skill blue-projects --agent codex --copy --yes
   npx skills list -a codex
   ```

   Confirm `SKILL.md`, `LICENSE`, `references/node.md`, and `assets/example.blue` are present and reference `@kunstmusik/blue-data@<ver>` / `@kunstmusik/blue-cli@<ver>`.

3. **Verify `@kunstmusik/blue-data@<ver>` in a fresh Node consumer**:

   ```bash
   npm init -y
   npm install --save-exact @kunstmusik/blue-data@<ver>
   ```

   Copy the installed skill's `assets/example.blue` to `project.blue` and follow the Node inspect/edit/save/reload walkthrough in `references/node.md`; confirm `project.blue` is unchanged and `project-edited.blue` reloads cleanly with the edited title.

4. **Verify on-demand `@kunstmusik/blue-cli@<ver>` compilation**:

   ```bash
   npx @kunstmusik/blue-cli@<ver> compile -p project.blue -o project.csd
   ```

   Confirm exit code `0`, unchanged `project.blue`, and valid `.csd` output containing `<CsoundSynthesizer>`, `<CsInstruments>`, and `<CsScore>`.
