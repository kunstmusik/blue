# Release Verification Quickstart

Run these checks during implementation and on a release candidate. The archive smoke command and public skill are deliverables of this feature.

## Prerequisites

Use Node 22, the pnpm version pinned by the repository, Java 17 and Maven for the CLI build, and npm with registry access for consumer installs. On the trusted publisher, use Node 22.14.0 or newer and npm 11.5.1 or newer. Run the platform smoke on macOS arm64, Windows x64, and Linux x64. Csound is unnecessary for the checks below.

## 1. Build and pack

Run from the repository root. Use an empty archive destination, outside the working tree. The commands below use a POSIX shell. The release workflow passes the same archives to Windows.

```sh
BLUE_NPM_ARTIFACTS="$(mktemp -d)"
pnpm install --frozen-lockfile
pnpm --filter @blue/data test
pnpm --filter blue-cli test
pnpm --filter @blue/data build
pnpm --filter @blue/data pack --pack-destination "$BLUE_NPM_ARTIFACTS"
pnpm --filter blue-cli pack --pack-destination "$BLUE_NPM_ARTIFACTS"
pnpm lint
pnpm test
git diff --check
```

The CLI pack lifecycle builds its bundle and Java helper. Expect one scoped archive per package at the same version. On the release job, match those versions with the requested tag and retain the two archives, SHA-512 integrity values, full Git commit, and inventory. See the [package contract](contracts/npm-packages.md) for required files.

## 2. Install and exercise the same archives

The planned cross-platform smoke entry point takes both archives explicitly. Use the same paths on every target runner. The example names are for `0.1.0-beta.1`.

```sh
node scripts/verify-npm-packages.mjs \
  "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-data-0.1.0-beta.1.tgz" \
  "$BLUE_NPM_ARTIFACTS/kunstmusik-blue-cli-0.1.0-beta.1.tgz"
```

The command must use a temporary consumer outside the checkout and ordinary npm install behavior. Verify the following.

1. Load the data root from plain Node ESM and CommonJS, compare named exports and model identity, and check declarations with strict NodeNext ESM and CommonJS consumers. Bundle and execute a browser smoke using the portable entry point. Use the workspace’s existing bundler tooling for that check.
2. Run the documented data example on the original sample and exercise a supported historical fixture using existing XML compatibility tests as the reference. Verify the expected title edit, a second preserved field or object on a representative project, and unchanged source bytes. A malformed input must report diagnostics and produce no output.
3. Invoke the installed `blue-cli` shim with the plain fixture and an unavailable Java path, and check it emits a CSD. Exercise disk, realtime, and Blue Live mode selection using the existing fixture expectations, the conflicting-mode rejection, and same-input/output rejection. Use a native path containing spaces and one project-relative resource case drawn from the [CLI host tests](../../packages/blue-cli/src/cli-host.test.ts).
4. Compile a Java-backed fixture with Java 17 and check a generated score or orchestra marker. Run it again with `JAVA_HOME` set to a nonexistent path and a sentinel output file. Expect a nonzero exit, an actionable Java diagnostic, and unchanged input and sentinel output. See the [Java runtime tests](../../packages/blue-cli/src/java-runtime.test.ts) and [binary smoke tests](../../packages/blue-cli/src/cli-smoke.test.ts).

## 3. Verify skill installation and registry resolution

For a prerelease check before registry publication, install the candidate skill from a local source path with `npx skills add <path-to-blue-checkout>/skills/blue-projects --skill blue-projects --agent codex --copy --yes` in an empty consumer workspace. Use the verified tarballs for the walkthrough. After publication, repeat from the tagged GitHub source and use the exact registry versions. The examples below assume `npm-v0.1.0-beta.1`.

```sh
npx skills add https://github.com/kunstmusik/blue/tree/npm-v0.1.0-beta.1/skills/blue-projects \
  --skill blue-projects --agent codex --copy --yes
npx skills list -a codex
npm init -y
npm install --save-exact @kunstmusik/blue-data@0.1.0-beta.1
```

Follow the installed Node reference using its fixture and check that the saved copy reloads with the documented change. Run the scoped on-demand command below from a directory containing a copy of that fixture named `project.blue`.

```sh
npx @kunstmusik/blue-cli@0.1.0-beta.1 compile -p project.blue -o project.csd
npm view @kunstmusik/blue-data@0.1.0-beta.1 dist.integrity
npm view @kunstmusik/blue-cli@0.1.0-beta.1 dist.integrity
npm dist-tag ls @kunstmusik/blue-data
npm dist-tag ls @kunstmusik/blue-cli
```

Expect the named skill and references, an unchanged source, a verified edited copy, and a CSD. Compare npm integrity with the retained archives and confirm the intended channels for both packages before announcement. If publication stops partway through, use the retained archives and the [publication contract](contracts/npm-packages.md#publication) to resume.
