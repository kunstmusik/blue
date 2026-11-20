# Research for Publishing Blue’s Node Tools and Agent Skill

## Registry names and workspace dependencies

**Decision** — Retain `@blue/data` and `blue-cli` as workspace names. Set `publishConfig.name` and public access for the scoped distribution names. Pack using the repository’s pnpm 12.8.1, then publish the finished archives with npm.

**Rationale** — A scratch pack with the pinned pnpm version emitted the scoped name in both the archive filename and its manifest. Keeping the existing workspace names avoids a broad import and build-filter change. Published runtime dependencies must resolve from the registry. In a two-package probe, pnpm resolved the internal development dependency to a version in the packed manifest. Consumer installs ignore these development dependencies. The CLI continues to bundle workspace library code and ships its helper separately.

**Alternatives considered** — Rename workspace packages and update their consumers, or generate a staging manifest. The pinned packer already supplies the required name mapping.

[pnpm package manifest documentation](https://pnpm.io/package_json#publishconfigname)

## Node module loading and package contents

**Decision** — Keep the current TypeScript ESM output for bundlers and use a Node export condition to route native Node imports and CommonJS to one CommonJS build. Explicitly mark output module formats and provide the matching declaration targets. Verify the documented named imports on Node 22. If named-export detection misses an existing export, generate a small explicit ESM facade over the same CommonJS build.

**Rationale** — The current CommonJS build loads. Native ESM fails on extensionless relative imports. A Node 22 probe against a temporary manifest verified all 430 current runtime names, shared `BlueData` identity, a model round trip, and strict NodeNext declaration resolution in both `.mts` and `.cts` consumers. The real release tarballs remain the implementation acceptance boundary. Preserve the existing workspace test-support exports and treat them as outside the documented consumer API. Exclude generated test files from both output trees.

**Alternatives considered** — Rewrite all source specifiers or bundle the data library into a second Node-specific implementation. Conditional resolution keeps the source and current browser build portable and avoids separate Node class identities.

[Node conditional exports](https://nodejs.org/api/packages.html#conditional-exports) · [Node ESM specifiers](https://nodejs.org/api/esm.html#mandatory-file-extensions)

## Versions, credentials, and recovery

**Decision** — Start the public pair at `0.1.0` on `latest`. Cut an optional `0.1.0-beta.1` on `next` and use a dedicated `npm-v<version>` Git tag for each release. During `0.x`, use patch releases for compatible fixes and minor releases for new capabilities or breaking changes. Identify breaking changes in the release notes. Pack once, record the source and SHA-512 integrity, and test and publish those exact archives.

**Rationale** — Two coordinated versions reflect the implementation that is bundled into the CLI. Desktop and project format versions have distinct lifecycles. npm versions are immutable, and the two publishes are independent. Retaining the original archive pair makes a partial release recoverable even if a rebuild yields different bytes. Compare the registry’s integrity before treating a package as already published.

**Alternatives considered** — Desktop-version lockstep, independently released tools, placeholder bootstrap versions, and automatic promotion via extra npm tags. Maintainer authentication with 2FA is enough to bootstrap the actual first release. Once both packages exist, configure GitHub Actions Trusted Publishing per package. Keep dist-tag repair a maintainer operation for the initial workflow.

[npm publish and integrity](https://docs.npmjs.com/cli/v11/commands/npm-publish/) · [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) · [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)

## Platform coverage and runtimes

**Decision** — Validate the same platform-neutral pair of archives on Node 22 across macOS arm64, Windows x64, and Linux x64. Use Java 17 for Java-backed smoke coverage and a deliberately missing native `JAVA_HOME` for the error case. Keep the packaged Java helper and host-installed `zeromq`.

**Rationale** — The CLI archive already includes the shaded JAR, Python libraries, Java source and notices, and relies on the consumer environment to install the native dependency. Its existing smoke tests provide minimal project and failure cases. The existing Java-backed tests provide deterministic score and orchestra markers. The data package already supports browser consumers via bundlers.

**Alternatives considered** — Separate CLI archives per platform, a slimmer CLI with new helper downloads, or the full desktop packaging pipeline. All add release work beyond the existing headless compiler’s dependencies.

[CLI build](../../packages/blue-cli/scripts/build.mjs) · [CLI smoke tests](../../packages/blue-cli/src/cli-smoke.test.ts) · [Java smoke tests](../../packages/blue-cli/src/java-runtime.test.ts)

## Documentation and skill discovery

**Decision** — Publish tested package README workflows, targeted TSDoc comments, and one self-contained skill in `skills/blue-projects/`. Put the Node walkthrough in the skill’s `references/` and use a small original fixture. Defer a generated TypeDoc site.

**Rationale** — The library README has a browser example that points to a path the current package does not emit. A consumer exercise catches both this class of documentation error and API usage drift. The Skills CLI scans `skills/`, can select one skill in a repository, and supports a GitHub tree URL at a release tag.

**Alternatives considered** — Use a separate skills repository or ship the skill inside npm. Keeping the skill in the existing public repository makes the versioned docs and skill available from the same release source.

[Agent Skills specification](https://agentskills.io/specification) · [Skills CLI commands](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add) · [Skills CLI discovery](https://github.com/vercel-labs/skills/blob/main/src/skills.ts#L238-L252)

## Distribution provenance

**Decision** — Include the data package’s referenced BlueX7 attribution and provenance along with its MIT and Apache-2.0 license materials. Audit both archives’ notice targets and preserve the CLI’s ISC notice, Java source, Java and Python notices, and license texts. Add original documentation in the affected package scopes and the repository-default GPL-3.0-or-later skill scope. Bundle the applicable license with the installable skill.

**Rationale** — The current data pack preview omitted the referenced attribution and contained generated tests. The CLI preview already contained its Java helper and was approximately 60 MB compressed. The existing provenance records identify the imported material and its grant. Preserve those materials and confirm all references in each standalone archive.

**Alternatives considered** — Drop attribution or copy a third-party example into the skill. Ship existing attribution alongside an original minimal fixture with no external audio or plugin dependencies.

[Repository license map](../../LICENSING.md) · [BlueX7 provenance](../../packages/blue-data/resources/blue-x7-modern/provenance.json) · [Data notices](../../packages/blue-data/THIRD_PARTY_NOTICES.md) · [CLI notices](../../packages/blue-cli/THIRD_PARTY_NOTICES.md)

## Distribution Audit

Baseline audit of package allowlists, license scopes, attribution links, fixture provenance, and skill licensing recorded for Task T002 against [LICENSING.md](../../LICENSING.md).

### 1. `@kunstmusik/blue-data` (`packages/blue-data`)

- **License expression**: `MIT AND Apache-2.0` (`packages/blue-data/package.json`). Blue-authored code and post-baseline modifications to `bluex7.orc` are `MIT` (`packages/blue-data/LICENSE`, Copyright (c) 2026 Steven Yi). The BlueX7 modern orchestra (`packages/blue-data/resources/blue-x7-modern/bluex7.orc`) and generated module (`src/instruments/blue-x7/modern-orchestra.generated.ts`) incorporate six lookup tables (`giDx7VelTab`, `giDx7ExpScale`, `giDx7LevelLut`, `giDx7PegRate`, `giDx7PegLevel`, `giDx7PmsTab`) transcribed from Google Mobile Synthesis FM (`msfa`, Copyright 2012 Google Inc.) under `Apache-2.0` (`packages/blue-data/LICENSES/Apache-2.0.txt`, matching root `LICENSES/Apache-2.0.txt`). `giDx7AmsTab` is documented in `provenance.json` as reconstructed from the unavailable `hether` repository, while Dexed (`GPL-3.0`) and legacy Pinkston/Blue DX7 renderers are behavioral references only with no expression imported.
- **Runtime dependencies** (resolved from npm; `devDependencies` `typescript` and `vite` are excluded on consumer install):
  - `@rgrove/parse-xml` (`^4.2.0`, lockfile `4.2.3`) — `ISC`
  - `quickjs-emscripten` (`^0.32.0`, lockfile `0.32.0`, with transitive `@jitl/quickjs-ffi-types`, `@jitl/quickjs-wasmfile-{debug,release}-{asyncify,sync}`, and `quickjs-emscripten-core` at `0.32.0`) — `MIT`
- **Current `pnpm --filter @blue/data pack --dry-run` findings**:
  - Current `"files"` allowlist is `["dist", "LICENSE", "LICENSES", "THIRD_PARTY_NOTICES.md"]`.
  - The dry-run archive contains `dist/cjs/` (1,016 files, 0 test files because `tsconfig.cjs.json` excludes `**/*.test.ts` and `**/*.test.tsx`) and `dist/esm/` (1,764 files, including 748 compiled `*.test.*` files because `tsconfig.esm.json` lacks that exclusion).
  - Neither `dist/esm/package.json` nor `dist/cjs/package.json` is emitted yet, and `examples/inspect-edit.mjs`, `resources/blue-x7-modern/ATTRIBUTION.md`, and `resources/blue-x7-modern/provenance.json` are missing from the archive.
- **Required archive files**:
  - `dist/` without compiled `*.test.*` files (while keeping `dist/*/test-support/` for existing workspace subpaths)
  - `dist/esm/package.json` and `dist/cjs/package.json`
  - `examples/inspect-edit.mjs`
  - `README.md` and `package.json` (with `publishConfig.name: "@kunstmusik/blue-data"` and `access: "public"`)
  - `LICENSE` (`MIT`)
  - `LICENSES/Apache-2.0.txt`
  - `THIRD_PARTY_NOTICES.md`
  - `resources/blue-x7-modern/ATTRIBUTION.md`
  - `resources/blue-x7-modern/provenance.json`
- **Broken or missing attribution links to resolve**:
  - `packages/blue-data/THIRD_PARTY_NOTICES.md` line 3 references `resources/blue-x7-modern/ATTRIBUTION.md` (currently omitted from `package.json` `"files"` and missing in the packed tarball) and ends with a bare `` `ATTRIBUTION.md` `` reference ("and `ATTRIBUTION.md` for the exact source files and table names") that does not exist at package root and should point to `resources/blue-x7-modern/ATTRIBUTION.md`.
  - `packages/blue-data/resources/blue-x7-modern/ATTRIBUTION.md` (lines 6 and 39) references `provenance.json` (currently omitted from `package.json` `"files"`). Its license link [`LICENSES/Apache-2.0.txt`](../../LICENSES/Apache-2.0.txt) resolves to package-root `LICENSES/Apache-2.0.txt` once `resources/blue-x7-modern/ATTRIBUTION.md` is included in `"files"`.

### 2. `@kunstmusik/blue-cli` (`packages/blue-cli`)

- **License field & notice structure**: `"license": "SEE LICENSE IN THIRD_PARTY_NOTICES.md"` (`packages/blue-cli/package.json`). The distribution separates two licensing scopes (`LICENSING.md` and `packages/blue-cli/THIRD_PARTY_NOTICES.md`):
  - **Bundled JavaScript CLI (`dist/blue-cli.cjs`)**: Built via esbuild (`packages/blue-cli/scripts/build.mjs`), bundling MIT Blue CLI/data code, Apache-2.0 msfa lookup tables from `@blue/data`, MIT `commander`, and ISC `@rgrove/parse-xml` (`4.2.3`). The CLI bundle therefore declares `MIT AND Apache-2.0 AND ISC`, backed by `LICENSE` (`MIT`), `LICENSES/Apache-2.0.txt`, `LICENSES/ISC.txt` (both byte-identical to root `LICENSES/`), `THIRD_PARTY_NOTICES.md`, and `dist/attribution/`.
  - **Separate-process Java helper (`dist/java/`)**:
    - Blue-owned Java sources (`dist/java/source/java/**` and `dist/java/source/pom.xml`, copied from `packages/blue-java/src/main/java` and `packages/blue-java/pom.xml`) are `EPL-2.0`.
    - Shaded `dist/java/blue-java.jar` is mixed-license (`EPL-1.0` Clojure/spec.alpha/core.specs.alpha/Pomegranate/dynapath, `MPL-2.0` JeroMQ 0.6.0, `BSD-2-Clause` jnacl 1.0.0, `Apache-2.0` Jackson/Maven Resolver/Wagon/Plexus/Guava/Commons/HttpClient/HttpCore, `MIT` jsoup 1.7.2 and SLF4J 1.6.2, `PSF/Jython` Jython 2.7.4, plus `META-INF/NOTICE-BLUE-JAVA.txt`).
    - `dist/java/pythonLib/**` (copied from `packages/blue-java/src/main/resources/jython/pythonLib`) ships Python source libraries with their existing `COPYING` texts: `blue/pmask/COPYING` (`GPL-2.0-or-later`, Copyright 2000 Maurizio Umberto Puxeddu; matches `LICENSES/GPL-2.0.txt`), `blue/orchestra/COPYING` (`GPL-2.0-or-later`, legacy Blue source; matches `LICENSES/GPL-2.0.txt`), and `blue/jythonconsole/COPYING` (`wxWindows Library Licence 3.1`; matches `LICENSES/wxWindows-Library-License-3.1.txt`).
    - `dist/java/licenses/*` copies all 19 shared license texts from root `LICENSES/`.
    - `dist/java/THIRD_PARTY_NOTICES.md` is generated by `build.mjs` from `packages/blue-app/assets/java/THIRD_PARTY_NOTICES.md` with `../../licenses/` rewritten to `licenses/` (so `licenses/jsoup-MIT.txt` and `licenses/slf4j-MIT.txt` resolve inside `dist/java/licenses/`) and the `Resources/licenses/` note updated to reference adjacent `licenses` and `source/`.
- **Runtime dependencies** (externalized in `build.mjs` and kept in `packages/blue-cli/package.json` `"dependencies"`; `@blue/data`, `@blue/java-runtime`, `commander`, and `esbuild` stay in `devDependencies`):
  - `quickjs-emscripten` (`^0.32.0`, lockfile `0.32.0`, plus `@jitl/quickjs-*` and `quickjs-emscripten-core`) — `MIT`
  - `zeromq` (`^6.8.0`, lockfile `6.8.0`, plus transitive `cmake-ts` `1.0.2` `MIT` and `node-addon-api` `8.9.2` `MIT`) — `MIT AND MPL-2.0`
- **Required archive files**:
  - `dist/blue-cli.cjs` (and sourcemap if retained)
  - `dist/java/blue-java.jar`
  - `dist/java/pythonLib/**` (including `COPYING` files for `pmask`, `orchestra`, and `jythonconsole`)
  - `dist/java/source/java/**` and `dist/java/source/pom.xml`
  - `dist/java/THIRD_PARTY_NOTICES.md`
  - `dist/java/licenses/*`
  - `dist/attribution/blue-data.md`
  - `dist/attribution/blue-x7-msfa.md`
  - `dist/attribution/provenance.json`
  - `LICENSE` (`MIT`)
  - `LICENSES/Apache-2.0.txt`
  - `LICENSES/ISC.txt`
  - `THIRD_PARTY_NOTICES.md`
  - `README.md` and `package.json` (with `publishConfig.name: "@kunstmusik/blue-cli"` and `access: "public"`)
- **Required `packages/blue-cli/scripts/build.mjs` attribution updates**:
  - Copy `../blue-data/resources/blue-x7-modern/provenance.json` to `dist/attribution/provenance.json` (currently omitted, leaving `provenance.json` references in `dist/attribution/blue-x7-msfa.md` unresolved).
  - Rewrite relative paths when writing `dist/attribution/blue-data.md` from `../blue-data/THIRD_PARTY_NOTICES.md`: rewrite `resources/blue-x7-modern/ATTRIBUTION.md` and bare `ATTRIBUTION.md` to `blue-x7-msfa.md`, and rewrite `LICENSES/Apache-2.0.txt` to `../../LICENSES/Apache-2.0.txt` so it resolves from `dist/attribution/` to `<pkg-root>/LICENSES/Apache-2.0.txt`. (`../../LICENSES/Apache-2.0.txt` in `dist/attribution/blue-x7-msfa.md` already resolves correctly to `<pkg-root>/LICENSES/Apache-2.0.txt`.)

### 3. Fixture Provenance

- `fixtures/smoke-test.blue` — Repo-authored Blue project fixture (`<blueData version="2.10.1">`, `<author>blue-electron</author>`, added by Steven Yi in commit `f5351217f` and updated in `df32bed85`).
- Historical XML cases in `packages/blue-data/src/migration/project-xml-compatibility.test.ts` — Repo-authored inline XML compatibility fixtures (authored by Steven Yi in `df32bed85` / `3155d2fb5`, covering `2.0.0`, `2.2.0`, `2.3.0_beta1`, `2.7.4_dev`, legacy `<instrumentLibrary>` / `<udo>`, sample-rate, and panning cases with synthetic content).
- CLI host and Java test fixtures (`packages/blue-cli/src/cli-smoke.test.ts`, `packages/blue-cli/src/cli-host.test.ts`, `packages/blue-cli/src/java-runtime.test.ts`) — Synthesized at test time in temporary directories using `@blue/data` model APIs, inline XML/Python/Clojure/JS snippets, minimal synthetic RIFF/WAV headers, `.scl` scale files, and Node helper scripts.
- `skills/blue-projects/assets/example.blue` — Newly authored original minimal asset-free `.blue` project fixture (to be created inside `skills/blue-projects/` with no external audio, sample, or plugin dependencies).

### 4. Skill License (`skills/blue-projects/`)

- `skills/blue-projects/` is outside any narrower package scope in [LICENSING.md](../../LICENSING.md) and therefore falls under the repository-default **GNU GPL-3.0-or-later** license (`GPL-3.0-or-later`).
- The skill directory must ship a verbatim copy of root [LICENSE](../../LICENSE) (GNU General Public License Version 3, 29 June 2007) at `skills/blue-projects/LICENSE` alongside `SKILL.md`, `references/node.md`, and `assets/example.blue`.
