# Verification Record for Publishing Blue’s Node Tools and Agent Skill

## T001 — Baseline ESM Failure and CommonJS Load Reproduction

- **Date**: 2026-11-19
- **Source revision**: `0824a20a42cc10f99f98378879514d9050bf1241`
- **Runtime**: Node `v22.23.1`, pnpm `12.8.1`
- **Build command**:
  ```sh
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter @blue/data build
  ```

### Native ESM Import Reproduction (Expected Baseline Failure)

1. Via package export resolution (`@blue/data` in `packages/blue-cli`):
   ```sh
   (cd packages/blue-cli && PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node --input-type=module -e "import { BlueData } from '@blue/data'; console.log('ok', typeof BlueData)")
   ```
   **Result**: Exited `1` with:
   ```text
   Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import '/Users/stevenyi/work/blue3/.worktrees/publish-blue-tooling/packages/blue-data/dist/esm/blue-data' is not supported resolving ES modules imported from /Users/stevenyi/work/blue3/.worktrees/publish-blue-tooling/packages/blue-data/dist/esm/index.js
     code: 'ERR_UNSUPPORTED_DIR_IMPORT'
   ```
2. Direct entry (`./packages/blue-data/dist/esm/index.js`):
   ```sh
   PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node --input-type=module -e "import { BlueData } from './packages/blue-data/dist/esm/index.js'; console.log('ok', typeof BlueData)"
   ```
   **Result**: Exited `1` with identical `ERR_UNSUPPORTED_DIR_IMPORT` (extensionless relative/directory specifiers under `dist/esm` fail native Node ESM resolution, and `dist/esm` lacks explicit `"type": "module"` metadata).

### CommonJS Load Confirmation

1. Via package export resolution (`@blue/data` in `packages/blue-cli`):
   ```sh
   (cd packages/blue-cli && PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node -e "const m = require('@blue/data'); console.log('cjs-pkg', typeof m.BlueData, Object.keys(m).length)")
   ```
   **Result**: Exited `0` — `cjs-pkg function 430`
2. Direct CommonJS entry (`./packages/blue-data/dist/cjs/index.js`):
   ```sh
   PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node -e "const m = require('./packages/blue-data/dist/cjs/index.js'); console.log('cjs-dist', typeof m.BlueData, Object.keys(m).length)"
   ```
   **Result**: Exited `0` — `cjs-dist function 430`

### Baseline Output Hygiene Observation

- `packages/blue-data/tsconfig.esm.json` lacks test exclusion (`tsconfig.cjs.json` already excludes `**/*.test.ts` and `**/*.test.tsx`), causing `dist/esm/` to emit `748` compiled `*.test.*` artifacts alongside runtime code while `dist/cjs/` emits `0` `*.test.*` files.

## T004 — Fixture Selection and Boundary Checks

- **Date**: 2026-11-19
- **Inspected sources**:
  - `fixtures/smoke-test.blue`
  - `packages/blue-data/src/migration/project-xml-compatibility.test.ts`
  - `packages/blue-data/src/blue-data/xml-policy.ts`, `packages/blue-data/src/migration/upgrade-manager.ts`, `packages/blue-data/src/resource-xml-policy.ts`, `packages/blue-data/src/time/time-state.ts`
  - `packages/blue-cli/src/cli-smoke.test.ts`, `packages/blue-cli/src/cli-host.test.ts`, `packages/blue-cli/src/java-runtime.test.ts`, `packages/blue-cli/src/cli.test.ts`, `packages/blue-cli/src/cli.ts`, `packages/blue-cli/src/tuning-scales.ts`, `packages/blue-cli/src/audio-layout.ts`

### 1. Exact Fixture Selections

1. **Current project fixture (`fixtures/smoke-test.blue`)**:
   - `<blueData version="2.10.1">` with `<title>Smoke Test</title>`, `<author>blue-electron</author>`, `<sampleRate>44100</sampleRate>`, and `<arrangement>` instrument `"1"` (`blue.orchestra.BlueSynthBuilder`, `isEnabled="true"`, `<name>All Widgets Synth</name>`).
   - Score includes `SoundObject Layer Group` and `Root` (`PolyObject`) with `GenericScore` (`i1 0 1 440 0.5`), `PythonObject` (`onLoadProcessable="false"`), `JavaScriptObject` (`onLoadProcessable="false"`), `Comment`, `External`, `AudioFile` (`test.wav`), `Sound`, `LineObject`, `ZakLineObject`, `PatternObject`, `PianoRoll`, `TrackerObject`, and `JMask` — supporting both round-trip edit preservation checks and inspection of script-bearing XML without script execution.
2. **Accepted historical compatibility fixture (derived from `packages/blue-data/src/migration/project-xml-compatibility.test.ts`, lines 51–76 and 100–119)**:
   - `<blueData version="2.2.0">` project with legacy root `<soundObject type="blue.soundObject.PolyObject">`, `<timeUnit>5</timeUnit>`, and a `<soundLayer>` containing a nested `<soundObject type="blue.soundObject.GenericScore">` (`<score>i1 0 2 440</score>`).
   - Loading via `readProjectXml` migrates the root `PolyObject` into `<score>`, moves `<timeUnit>5</timeUnit>` into `<score><timeState>`, emits the non-fatal warning `P-TIME-STATE-HISTORICAL-RULER` (`severity: 'warning'`, `path: '/blueData/soundObject[1]/timeUnit[1]'`, `value: '5'`, emitted in `packages/blue-data/src/time/time-state.ts`), preserves `i1 0 2 440`, and round-trips idempotently on canonical reopen.
3. **Existing CLI Java and host scenarios (`packages/blue-cli/src/cli-smoke.test.ts`, `packages/blue-cli/src/cli-host.test.ts`, `packages/blue-cli/src/java-runtime.test.ts`, `packages/blue-cli/src/cli.test.ts`)**:
   - **Plain disk, realtime, and Blue Live compilation**: Minimal plain project (`<blueData version="5.0.0"><projectProperties/></blueData>` in `cli-smoke.test.ts` emitting `<CsoundSynthesizer>` and `Generated by blue 2.10.1` without Java) and mode selection across default disk (`[]`), `--realtime`, and `--bluelive` (`cli-host.test.ts` lines 93–96).
   - **`TuningProcessor` + `.scl` scale resolution**: `GenericScore` (`i1 0 1 8.01`) with `TuningProcessor` (`baseFrequency` `440`) referencing a `.scl` file (`Test scale\n2\n3/2\n2\n`) resolves `i1 0.0 4 660`, while removing the scale exits `1` (`Cannot resolve tuning scale`) and preserves sentinel output `'previous output'` (`cli-host.test.ts` lines 33–63). Note from `packages/blue-cli/src/tuning-scales.ts`: absolute `<scale>` paths are read directly, whereas relative `<scale>` filenames resolve under `path.join(os.homedir(), '.blue', 'scl', reference.filename)`.
   - **`AudioClip` + relative 1-ch (and 2-ch) WAV**: `TrackLayerGroup` with `AudioClip` referencing relative `'sample.wav'` (resolved via `path.resolve(projectDirectory, filename)` in `audio-layout.ts`, with panning enabled and synthetic RIFF/WAVE header) compiles in disk, `--realtime`, and `--bluelive` modes; removing `sample.wav` exits `1` (`Cannot inspect audio file`) and preserves sentinel output (`cli-host.test.ts` lines 65–106).
   - **Same-file, hard-link, symbolic-link, and conflicting-mode rejection**: `-o` targeting the source `.blue` file directly, a hard link (`hard.csd`), or a symbolic link (`symbolic.csd`) exits `1` (`different file`) with the source `.blue` file untouched (`cli-host.test.ts` lines 158–173); passing both `--realtime` and `--bluelive` throws `` `--realtime` and `--bluelive` are mutually exclusive. `` (`cli.ts` / `cli.test.ts` lines 39–43).
   - **Java-backed `PythonInstrument` + `PythonObject` + `ObjectBuilder` + `PythonProcessor` + `ClojureObject`**: Compiles across `disk`, `realtime`, and `bluelive` modes (`java-runtime.test.ts` lines 32–77), asserting `outs 0, 0` in all modes, `i1 0.0 4 432` and `i1 0.0 4 733` in `disk` and `realtime`, and unchanged source `.blue` bytes (plus Java runtime failure preserving sentinel output in lines 79–94, and QuickJS on-load `JavaScriptObject` and `External`/`ObjectBuilder` command execution in `cli-host.test.ts` lines 108–156).
   - **Missing `JAVA_HOME` failure preserving sentinel output**: `ObjectBuilder` (`PYTHON`) in `disk` and `--realtime` modes (`cli-smoke.test.ts` lines 17–55) and `PythonInstrument` in default `disk` and `--bluelive` modes (`cli-smoke.test.ts` lines 57–83) fail with exit `1` and stderr matching `/Cannot start Java 17/` when `JAVA_HOME` points to a missing directory, preserving sentinel output `'previous output'`.

### 2. Compatibility and Ownership Boundary Checks

- **No XML or CSD semantic divergence**: The release preserves existing `.blue` XML parsing, diagnostics, canonical save normalization, and `.csd` generation semantics without intentional divergence.
- **Standalone caller sample-path ownership**: Standalone callers (Node library examples/consumers and CLI invocations) own their native input and output sample paths (`BlueData` owns the in-memory model; `.blue` XML remains canonical on disk; generated `.csd` files are owned by the caller/CLI).
- **Existing migration and loader ownership/ordering**:
  - Project loads remain owned by `readProjectXml` / `loadProjectRoot` in `packages/blue-data/src/blue-data/xml-policy.ts`, which validates `PROJECT_CHILDREN` and `@version`, runs `UpgradeManager.getInstance().performUpgrades(rootElement, context)` (`packages/blue-data/src/migration/upgrade-manager.ts`: versioned `ProjectUpgrader_2_1_10` and `ProjectUpgrader_2_3_0`, unmigrated root `soundObject` check, then `migrateProjectTimeContext`, `migrateAudioLayersToTracks`, `migrateProjectPanning`, and `migrateProjectReferences`), and checks `CANONICAL_PROJECT_CHILDREN` before `BlueData` deserialization.
  - Standalone resource loads remain owned by `readResourceXml` in `packages/blue-data/src/resource-xml-policy.ts`, delegating directly to resource-local owners without project migrations.
  - No new serialized format or migration is introduced.
- **No desktop `ProjectHistory` / undo-redo writer path**: Confirmed `ProjectHistory` is absent from `packages/blue-data` and `packages/blue-cli`. The release adds no desktop `ProjectHistory` or undo/redo writer path (`packages/blue-app` is unmodified; Node examples edit separately loaded `BlueData` instances and write to a separate output path).
- **Java-first parity review gate**: Any semantic mismatch surfaced during verification requires Java-first parity review against `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core` before modifying TypeScript behavior.

## T010 — `@kunstmusik/blue-data` Build, Package Tests, and Isolated Consumer Smoke

- **Build & test commands**:
  ```sh
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter @blue/data build
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter @blue/data test
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter @blue/data pack --pack-destination /tmp/blue-data-pack
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node scripts/verify-npm-packages.mjs --data /tmp/blue-data-pack/kunstmusik-blue-data-0.1.0.tgz
  ```
- **Package test suite (`pnpm --filter @blue/data test`)**: `224 passed | 3 skipped (227)` test files; `3180 passed | 23 skipped (3203)` tests.
- **Packed archive**:
  - **Filename**: `kunstmusik-blue-data-0.1.0.tgz` (`@kunstmusik/blue-data@0.1.0`)
  - **Size**: `1,114,461` bytes
  - **Entries**: `2,026` files (`0` compiled `*.test.*`, `*.spec.*`, or `*-test-fixtures.*` files under `dist/`)
  - **SHA-512 integrity**: `sha512-gndAxgn7Ehkj5mqp9TU9kPz2TjdKh3MAq4rhUynaRH2C8d2mS/aVMIVCW8nKftY5gbEipM2d0WjY1lMnIPJEhA==`
  - **SHA-256**: `ca9b8af52e4321ab60ba8ce9682a4d69762fd0e22100a9049001b36f4cf8407a`
- **Isolated consumer smoke (`scripts/verify-npm-packages.mjs --data`, platform `darwin-arm64`, Node `v22.23.1`)**:
  - **Inventory & notice links**: Passed (`dist/esm/package.json` `{"type":"module"}`, `dist/cjs/package.json` `{"type":"commonjs"}`, `THIRD_PARTY_NOTICES.md` and `resources/blue-x7-modern/ATTRIBUTION.md` relative links resolved).
  - **ESM / CJS parity**: Passed (`430` enumerable CJS exports matched as named ESM exports with identical `BlueData`, `readProjectXml`, and `TimePosition` identity).
  - **Strict `NodeNext` TypeScript declarations**: Passed on both `consumer-esm.mts` and `consumer-cjs.cts`.
  - **Browser bundle & execution**: Passed (`esbuild` `platform: 'browser'`, `format: 'esm'`, `conditions: ['browser', 'import']`, `260` bundled inputs resolving `dist/esm/index.js` without `dist/cjs` or `node:*`; executed round trip in Node-API-free `node:vm` context).
  - **Shipped example (`examples/inspect-edit.mjs`)**: Passed on `fixtures/smoke-test.blue` (title updated, `author`, `sampleRate`, and instrument `'1'` `"All Widgets Synth"` preserved; source bytes unchanged), accepted historical `version="2.2.0"` fixture (`P-TIME-STATE-HISTORICAL-RULER` warning surfaced; `<score>i1 0 2 440</score>` and `<timeUnit>5</timeUnit>` preserved; source unchanged), script-bearing XML without Java or QuickJS execution (`PythonInstrument`, `PythonObject`, `ClojureObject`, `JavaScriptObject`, `External` payloads preserved intact), malformed/unsupported inputs (diagnostics printed, no output created, source unchanged), and same-file rejection.

## T015 — `@kunstmusik/blue-cli` Build, Package Tests, and Isolated Consumer Smoke

- **Build, test, & pack commands**:
  ```sh
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter blue-cli test
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" pnpm --filter blue-cli pack --pack-destination /tmp/blue-cli-pack
  PATH="/Users/stevenyi/.nvm/versions/node/v22.23.1/bin:$PATH" node scripts/verify-npm-packages.mjs --cli /tmp/blue-cli-pack/kunstmusik-blue-cli-0.1.0.tgz
  ```
- **Package test suite (`pnpm --filter blue-cli test`)**: `5 passed (5)` test files; `22 passed (22)` tests (`external-commands.test.ts`, `cli.test.ts`, `cli-smoke.test.ts`, `cli-host.test.ts`, `java-runtime.test.ts`).
- **Packed archive**:
  - **Filename**: `kunstmusik-blue-cli-0.1.0.tgz` (`@kunstmusik/blue-cli@0.1.0`)
  - **Size**: `60,042,610` bytes
  - **Entries**: `108` files (including `dist/blue-cli.cjs`, `dist/java/blue-java.jar`, `20` Java source files + `pom.xml`, `pythonLib` with `pmask`/`orchestra`/`jythonconsole` `COPYING` texts, `19` license texts under `dist/java/licenses/`, root `LICENSE`, `LICENSES/{Apache-2.0.txt,ISC.txt}`, `dist/attribution/{blue-data.md,blue-x7-msfa.md,provenance.json}`)
  - **SHA-512 integrity**: `sha512-kjk3udZAHJObHkdq39PuOFhrGsq3SxFyZph28zSwHDKkSwUhfJjLa936fiDaoJpKpXtXFx20ikMtb3MNN3BTEA==`
  - **SHA-256**: `b9a7eb0dda917b94d3dffd52247654e5567bec90cc45ede22053e9c9f851f14c`
- **Isolated consumer smoke (`scripts/verify-npm-packages.mjs --cli`, platform `darwin-arm64`, Node `v22.23.1`)**:
  - **Inventory & notice links**: Passed (all required Java/Python/attribution/license files present; all relative markdown links in `THIRD_PARTY_NOTICES.md`, `dist/java/THIRD_PARTY_NOTICES.md`, `dist/attribution/blue-data.md`, and `dist/attribution/blue-x7-msfa.md` resolved inside the archive).
  - **Plain project modes without Java**: Passed across disk (`ksmps=16`), `--realtime` (`ksmps=64`), and `--bluelive` (`instr blueAllNotesOff`, `e 36000`) with `JAVA_HOME` pointing to a missing path; source unchanged.
  - **Conflict & same-file rejection**: Passed (`--realtime --bluelive` rejected nonzero preserving sentinel output; `-p` equal to `-o` rejected nonzero leaving source intact).
  - **Native path with spaces & relative resources**: Passed (`AudioClip` relative `sample.wav` + `TuningProcessor` `.scl` in `project dir with spaces` resolving `660`; deleting `sample.wav` failed nonzero with `Cannot inspect audio file` while preserving sentinel output).
  - **Java-backed compilation & missing-Java failure**: Passed (`PythonInstrument` `outs 0, 0`, on-load `PythonObject`, Python `ObjectBuilder` using `pmask` + `PythonProcessor` -> `432`, `ClojureObject` -> `733` across disk, `--realtime`, `--bluelive` using Temurin Java 25; nonexistent `JAVA_HOME` failed nonzero matching `/Cannot start Java 17/` and preserved sentinel output and source bytes).

## T016 — Skill Discovery and Walkthrough Checks

- **Local candidate install command (before registry/GitHub tag publication)**:
  ```sh
  npx skills add <path-to-blue-checkout>/skills/blue-projects --skill blue-projects --agent codex --copy --yes
  npx skills list -a codex
  ```
- **Tagged GitHub release install command (for T025 after tag `npm-v0.1.0` & npm publish)**:
  ```sh
  npx skills add https://github.com/kunstmusik/blue/tree/npm-v0.1.0/skills/blue-projects --skill blue-projects --agent codex --copy --yes
  npx skills list -a codex
  ```
- **Expected installed skill files (inside the agent's installed `blue-projects` directory)**:
  - `SKILL.md`
  - `LICENSE` (GPL-3.0-or-later, matching root `LICENSE`)
  - `references/node.md`
  - `assets/example.blue`
- **Acceptance assertions**:
  1. Every local relative markdown link inside installed `SKILL.md` (`references/node.md`, `assets/example.blue`, `LICENSE`) and installed `references/node.md` (`../assets/example.blue`) resolves cleanly within the installed skill directory.
  2. Copying `assets/example.blue` to `project.blue` in a clean consumer workspace and running the Node inspect/edit/save/reload recipe from `references/node.md` with `@kunstmusik/blue-data@0.1.0` leaves `project.blue` byte-identical and verifies the reloaded sibling copy (`project-edited.blue`) has the updated title with zero load errors/warnings.
  3. Running the default CLI disk compile (`blue-cli compile -p project.blue -o project.csd` / `npx @kunstmusik/blue-cli@0.1.0 compile -p project.blue -o project.csd`) against `project.blue` exits `0`, leaves `project.blue` unchanged, and emits `project.csd` containing `<CsoundSynthesizer>`, `<CsInstruments>`, and `<CsScore>`.

## T019 — Candidate Skill Installation and Clean-Workspace Walkthroughs

- **Clean workspace & install commands**:
  ```sh
  npx --yes skills add /Users/stevenyi/work/blue3/.worktrees/publish-blue-tooling/skills/blue-projects --skill blue-projects --agent codex --copy --yes
  npx --yes skills list -a codex
  ```
- **Discovery & shipped files**:
  - Installed into `.agents/skills/blue-projects` (`Codex` universal scope): `LICENSE`, `SKILL.md`, `assets/example.blue`, `references/node.md`.
  - Verified all local relative links inside installed `SKILL.md` (`references/node.md`, `assets/example.blue`, `LICENSE`) and `references/node.md` (`../assets/example.blue`) resolved within the installed skill directory (`SKILL_LINKS_OK`).
- **Walkthrough results (with verified `@kunstmusik/blue-data@0.1.0` & `@kunstmusik/blue-cli@0.1.0` archives)**:
  - Copied installed `assets/example.blue` to `project.blue` (`sha256: 5aa4cb1bda9456faf10ad2fed085ed245d028b15e424cad378dad98fafe32f3f`).
  - Executed the exact ESM snippet from installed `references/node.md`: printed `Title: Blue Projects Skill Example`, `Version: 2.10.1`, `Score layer groups: 1`, `Verified reloaded title: Updated Blue Project`, and `Confirmed source unchanged`.
  - Executed `./node_modules/.bin/blue-cli compile -p project.blue -o project.csd`: exited `0` (`Wrote .../project.csd (disk, 413 bytes)`), emitted `<CsoundSynthesizer>`, `poscil`, and `i1`, and preserved `project.blue` byte-identical (`sha256` unchanged).
- **Root documentation**: Updated `README.md` with `@kunstmusik/blue-data`, `@kunstmusik/blue-cli`, links to `packages/blue-data/README.md`, `packages/blue-cli/README.md`, and `skills/blue-projects/SKILL.md`, and the public `npx skills add kunstmusik/blue --skill blue-projects` install command.

## T024 — Full Prepublication Validation

- **Environment & source baseline**:
  - **Platform**: `macOS 27.0.1` (`darwin-arm64`)
  - **Runtimes & tools**: Node `v22.23.1`, npm `10.9.8`, pnpm `12.8.1`, Eclipse Temurin JDK `25+36`, Apache Maven `3.10.1`
  - **Source revision**: `0824a20a42cc10f99f98378879514d9050bf1241` + uncommitted `codex/121-publish-blue-tooling` worktree changes
- **Final verified archive pair (`npm-v0.1.0`, `latest`, generated before removing `/tmp/blue-npm-artifacts-final`)**:
  - **`kunstmusik-blue-data-0.1.0.tgz` (`@kunstmusik/blue-data@0.1.0`)**:
    - **Size / entries**: `1,114,472` bytes; `2,026` entries (`0` test files under `dist/`)
    - **SHA-512 integrity**: `sha512-J6pyZtWl5JMmtI5Ti/Uw+B9wksYGOc3b+MaYsDyJNDZm19+39Xp3OjGFb+qMWBjIW6W5ajpiATooTKeQMOgoEQ==`
    - **SHA-256**: `85718e7369eca0dbd13b9a4578e874f92e1d5652af7fd809f07bbaf9b2e5142b`
  - **`kunstmusik-blue-cli-0.1.0.tgz` (`@kunstmusik/blue-cli@0.1.0`)**:
    - **Size / entries**: `60,042,627` bytes; `108` entries (`20` Java source files)
    - **SHA-512 integrity**: `sha512-HIIYwuew/p6qyxAZQevlEHCiN63BC4XgZfyoY9CZiko4152r0tohMuQQx3ReRUQ/36El+ZFcmg/CuYtp5cSmbw==`
    - **SHA-256**: `abd35a8f693bbd069e71ec19f877dc65fdaa2f081b4e5a02a191fb3341f196ec`
- **Smoke, release, & workspace verification**:
  - **Dual-archive isolated consumer smoke (`node scripts/verify-npm-packages.mjs ... --expected-version 0.1.0`)**: Exited `0`. Passed all `@kunstmusik/blue-data` checks (`2,026` entries, `430` matching CJS/ESM exports, `NodeNext` `.mts`/`.cts` declaration checks, `260`-input browser bundle executed in Node-API-free `node:vm`, `examples/inspect-edit.mjs` across current, historical `2.2.0`, script-bearing, malformed, and same-file cases) and all `@kunstmusik/blue-cli` checks (`108` entries, notice/attribution links, plain & Java-backed compilation modes, native path with spaces + relative `.wav`/`.scl`, conflict/same-file/missing-Java checks).
  - **Release verifier (`scripts/verify-npm-release.mjs`)**: `validate-tag`, `create-manifest`, and `verify-manifest` exited `0` for `npm-v0.1.0`; `node --test scripts/verify-npm-release.test.mjs` passed `27/27`.
  - **Candidate skill verification (`T019`)**: Clean-workspace `npx --yes skills add ... --skill blue-projects --agent codex --copy --yes` and `npx --yes skills list -a codex` succeeded; installed links resolved cleanly and both Node and `blue-cli` walkthroughs passed against the packed archive pair.
  - **Full workspace test suite (`pnpm test`)**: Exited `0` across all packages:
    - `@blue/data`: `226 passed | 1 skipped (227)` files, `3198 passed | 5 skipped (3203)` tests
    - `@blue/engine-client`: `4 passed (4)` files, `53 passed (53)` tests
    - `blue-cli`: `5 passed (5)` files, `22 passed (22)` tests
    - `@blue/app`: `551 passed (551)` files, `6462 passed | 15 skipped (6477)` tests
    - `@blue/java-runtime`: `mvn -q test` exited `0`
    - `@blue/engine-native`: `30 passed, 0 failed, 8 skipped` (`scripts/*.test.mjs`) and `node scripts/test.mjs` exited `0`
    - `pnpm test:scripts`: `101 passed, 0 failed, 0 skipped`
  - **Typecheck, lint, & workflow contract**: `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app typecheck:renderer`, `pnpm lint` (including `vp fmt --check` on `1886` files), `pnpm verify:release-workflows` (`80/80` checks), and `git diff --check` all exited `0`.
- **Scoped verification exceptions**:
  - Windows `x64` (`windows-2022` / `win32-x64`, including native Windows resource paths) and Linux `x64` (`ubuntu-22.04` / `linux-x64`) consumer smoke runs are defined in `.github/workflows/npm-release.yml` (`verify-consumers`) and await GitHub Actions execution; local consumer smoke ran on `darwin-arm64`.
  - `T025` (initial manual 2FA npm bootstrap, trusted publisher configuration, public registry dist-tag/digest checks, and tagged `npm-v0.1.0` GitHub skill install) remains open for explicit maintainer authorization.

## Phase 7 Convergence — Local Validation (`T026`–`T030`)

- **Shim quoting, release hardening, & workflow checks (`T026`–`T028`, `T030`)**:
  - `node --test scripts/verify-npm-packages.test.mjs scripts/verify-npm-release.test.mjs`: `40/40` passed (`6` in `verify-npm-packages.test.mjs` covering `quoteWindowsCmdArg`, synthetic `win32` `cmd.exe /d /s /c` + `windowsVerbatimArguments: true` verbatim quoting with spaces/metacharacters, zero `shell: true` static guard, and real space-in-shim-path execution via `spawnShimCommand`; `34` in `verify-npm-release.test.mjs` including malformed SemVer, inconsistent tag/prerelease/distTag metadata, extra/duplicate/path-traversal package records, pre-registry fail-closed checks, sorted per-package `files` inventories, `assertRegistryVersionsAbsent`, and immutable rerun workflow assertions).
  - `pnpm test:scripts`: `114/114` passed (`0` failed, `0` skipped).
- **Convergence archive pair & manifest (`npm-v0.1.0`, `latest`, generated before removing `/tmp/blue-npm-convergence-check`)**:
  - **`kunstmusik-blue-data-0.1.0.tgz` (`@kunstmusik/blue-data@0.1.0`)**:
    - **Size / entries / `files` inventory**: `1,114,472` bytes; `2,026` entries (`files.length === 2,026`, `0` test files under `dist/`)
    - **SHA-512 integrity**: `sha512-J6pyZtWl5JMmtI5Ti/Uw+B9wksYGOc3b+MaYsDyJNDZm19+39Xp3OjGFb+qMWBjIW6W5ajpiATooTKeQMOgoEQ==`
    - **SHA-256**: `85718e7369eca0dbd13b9a4578e874f92e1d5652af7fd809f07bbaf9b2e5142b`
  - **`kunstmusik-blue-cli-0.1.0.tgz` (`@kunstmusik/blue-cli@0.1.0`)**:
    - **Size / entries / `files` inventory**: `60,042,628` bytes; `108` entries (`files.length === 108`, `20` Java source files)
    - **SHA-512 integrity**: `sha512-F68oh1akxw8/MzDF+G75Sddl1VIUpPXXAI9Bh8H/L/HW6/G7BOBfDAOrgqiMBEa5soVEFZOqE8ORl1QCU7XaLA==`
    - **SHA-256**: `d8434b8bb3453b0ba45aed6e763ef6b606247f9b153e8d508bb61911564695e5`
  - **`verify-manifest`** (with `--expected-version 0.1.0`, `--expected-tag npm-v0.1.0`, `--expected-revision 0824a20a42cc10f99f98378879514d9050bf1241`, `--expected-data-integrity`, and `--expected-cli-integrity`): exited `0` (`verified: true`).
  - **Dual-archive isolated consumer smoke (`scripts/verify-npm-packages.mjs ... --expected-version 0.1.0` on `darwin-arm64`, Node `v22.23.1`)**: exited `0`. Verified `@kunstmusik/blue-data` (`2,026` entries, `430` CJS/ESM exports, strict `NodeNext` types, `260`-input browser bundle in `node:vm`, all `inspect-edit.mjs` cases) and `@kunstmusik/blue-cli` installed under a consumer path containing spaces (`blue-cli smoke-*`, `108` entries, plain modes without Java, conflict/same-file rejection, host spaces + relative `.wav`/`.scl`, Java-backed modes across disk/`--realtime`/`--bluelive`, and missing-Java output preservation).
- **Full workspace suite & static gates after convergence changes**:
  - `pnpm test`: exited `0` (`@blue/data`: `226 passed | 1 skipped (227)` files / `3198 passed | 5 skipped (3203)` tests; `@blue/engine-client`: `4/4` files / `53/53` tests; `blue-cli`: `5/5` files / `22/22` tests; `@blue/app`: `551/551` files / `6462 passed | 15 skipped (6477)` tests; `@blue/java-runtime`: `mvn -q test` exited `0`; `@blue/engine-native`: `30 passed, 0 failed, 8 skipped` script tests + `node scripts/test.mjs` exited `0`; `pnpm test:scripts`: `114/114` passed).
  - `pnpm lint`, `pnpm format:check` (`1,887` files), `pnpm verify:release-workflows` (`80/80` checks), and `git diff --check`: all exited `0`.
- **Remaining cross-platform & release tasks**:
  - **T029 (`[ ]`)**: At this checkpoint, running the 3-OS GitHub Actions verification-only matrix (`macos-arm64` / `macos-15`, `windows-x64` / `windows-2022`, `linux-x64` / `ubuntu-22.04` with Node 22 and Java 17) for one retained archive pair and recording its CI source revision, digests, and passing matrix links awaited committing and pushing `codex/121-publish-blue-tooling` to GitHub.
  - **T025 (`[ ]`)**: Initial 2FA npm bootstrap (from the matrix-verified downloaded pair per `docs/npm-release-guide.md`), trusted publisher configuration, and live registry / tagged skill checks remain open for explicit maintainer authorization.

## Phase 8 Convergence — Windows Shim and Matrix Evidence

- **T031** — The smoke uses literal percent-delimited text and spaces in the archive directory, the consumer's installed CLI shim path, and the native project and output paths. The Windows job also runs an argument-echo shim with the referenced variable set and checks the exact child arguments. The Windows runner validation is part of T029.
- **T032** — The smoke step resolves the report filename from the matrix target, writes to it, and passes that exact path to the upload step. A missing report fails the job after a successful smoke. Each report records both archive SHA-512 integrities.
- **Focused validation** — With Node 22.23.1 on macOS arm64, all 41 npm package and release tests passed. Workspace lint, all 80 existing release-workflow contract checks, and `git diff --check` passed.

## T029 — Verification-Only Release Matrix

- The verification-only run for draft PR #805 passed all three platforms on November 19, 2026. GitHub tested merge revision `b06e3fda22cfe08a7afa2c9e7e017d906af4e84f` from feature head `1a805869778a25a8b5b91a6eeee5490d7a2a2160`. The candidate manifest identifies version `0.1.0` and intended tag `npm-v0.1.0`. The publisher was skipped. [Workflow run](https://github.com/kunstmusik/blue/actions/runs/44657516540) · [Draft PR #805](https://github.com/kunstmusik/blue/pull/805)
- The downloaded archives matched the manifest's byte counts, SHA-512 and SHA-256 digests, and full file inventories. Both package records in each downloaded smoke report matched that manifest. [Retained archive pair and manifest](https://github.com/kunstmusik/blue/actions/runs/44657516540/artifacts/14593717899)

| Package | Files | SHA-512 integrity |
| --- | ---: | --- |
| `@kunstmusik/blue-data@0.1.0` | 2,026 | `sha512-J6pyZtWl5JMmtI5Ti/Uw+B9wksYGOc3b+MaYsDyJNDZm19+39Xp3OjGFb+qMWBjIW6W5ajpiATooTKeQMOgoEQ==` |
| `@kunstmusik/blue-cli@0.1.0` | 108 | `sha512-SuagehquuiZwLlYhpne5FWOvhtQ+y/aG7dRs/a/Lb4iFc/f/Q792Hd+a8aC5LWaFswVM4VPQQaN6QDk86wsD8Q==` |

| Platform | Node | Temurin | Result |
| --- | --- | --- | --- |
| macOS arm64 (`macos-15`) | 22.23.5 | 17.0.21+9 | [Passed](https://github.com/kunstmusik/blue/actions/runs/44657516540/job/136028286976) · [Report](https://github.com/kunstmusik/blue/actions/runs/44657516540/artifacts/14594725389) |
| Windows x64 (`windows-2022`) | 22.23.4 | 17.0.21+9 | [Passed](https://github.com/kunstmusik/blue/actions/runs/44657516540/job/136028287218) · [Report](https://github.com/kunstmusik/blue/actions/runs/44657516540/artifacts/14593214829) |
| Linux x64 (`ubuntu-22.04`) | 22.23.4 | 17.0.21+9 | [Passed](https://github.com/kunstmusik/blue/actions/runs/44657516540/job/136028286991) · [Report](https://github.com/kunstmusik/blue/actions/runs/44657516540/artifacts/14593897405) |

- The Windows runner verified exact child arguments containing spaces and literal percent-delimited text, resolved the installed npm shim from a clean consumer directory, and compiled through the installed CLI shim with native resource paths. All platforms passed Java-backed compilation and confirmed missing Java preserves output.
- A fresh local Codex workspace installed the candidate skill by name and ran both recipes against these retained archives. The edited copy reloaded with title `Updated Blue Project`, the source was byte-identical to the installed fixture, and the CLI emitted a CSD with the expected sections.
- Local Node 22.23.1 and Zulu Java 17.0.15 validation passed `pnpm test`, `pnpm lint`, the 80 release-workflow contract checks, and `git diff --check`. The 22 CLI tests also passed with the data package's build output absent. The Windows-only npm lookup regression ran on Windows.
- T025 remains open for the authorized maintainer release. Its bootstrap uses the exact archives retained by the passing tagged run.
