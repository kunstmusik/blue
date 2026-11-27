# Quickstart — Validate local MCP access

These are acceptance steps for the implemented feature. Record the Blue revision, OS, engine version, and clients used. Exercise Settings at its normal display size, including mouse and keyboard access.

## Prerequisites

- Install the workspace dependencies with `pnpm install --frozen-lockfile`. Use the Blue development prerequisites for Electron and Csound.
- Prepare a disposable project with a saved path, a GenericInstrument, a Blue Synth Builder instrument, and a GenericScore object. For render, use a separate dependency-free sine project with literal score events and an empty output directory.
- Use MCP Inspector 2.16.0 with a supported Node release (`^22.23.4`, `^24.22.1`, or `>=26.12.1`). Keep credential-bearing client config in a private temporary file outside the checkout.

## Connect and inspect

1. Start Blue with `pnpm --filter @blue/app dev`. Verify MCP starts disabled on fresh and pre-feature preferences.
2. Open the disposable project and enable MCP in Program Settings. Copy the current endpoint and token. Read-only is selected initially.
3. Use a private Inspector config with the `mcpServers.blue` entry, containing `type: "http"`, `url` for the actual endpoint, `protocolEra: "modern"`, and `headers.Authorization` set to the copied bearer value. Run these commands with the path to that file.

   ```sh
   npx @modelcontextprotocol/inspector@2.16.0 --cli --config /path/to/private-blue-mcp.json --server blue --method tools/list
   npx @modelcontextprotocol/inspector@2.16.0 --cli --config /path/to/private-blue-mcp.json --server blue --method resources/list
   npx @modelcontextprotocol/inspector@2.16.0 --cli --config /path/to/private-blue-mcp.json --server blue --method tools/call --tool-name get_project_summary
   ```

4. Read all four resources and call the four inspection tools. Compare a representative CSD to the established disk-profile output and check that a fixture with an on-load action or interpreter-backed score is refused without activation. Close the project and verify the project operations return actionable failures while engine status remains available.
5. Use the SDK current-protocol test client to keep a resource subscription open while Blue commits, saves, switches, and closes projects. Check notifications and reread after each. Connect with a handshake-era fixture and check discovery and calls.
6. Try copied Cursor, VS Code, and local Codex configuration with their documented client formats. Record one compatible editor connection in addition to Inspector; verify the other offered snippets against the validated configuration shapes.

## Verify edits and runtime

1. While read-only, invoke a previously known write tool and verify permission denial. Switch to read-write and refresh discovery.
2. Use the [contract](contracts/local-mcp.md#tools) to exercise Generic and Blue Synth Builder code, create and update an instrument assignment, update score timing and GenericScore text, and change title plus audio settings. Read the new receipt after each change. Check the descriptive undo label, dirty indicator, renderer updates and applicable restart-required outcome. Undo and redo each case and verify stable references and saved-state restoration.
3. Resubmit an edit after a UI commit, undo/redo, or project replacement. Expect a conflict and zero extra history entries. Repeat an equal-value update using a current receipt and expect a successful no-op.
4. Start and stop timeline playback twice with the verified project. Check the engine status and decline one requested local activation. Confirm a delayed retry or loop cannot start after authority expires.
5. Render the sine project using a fresh WAV basename in the approved directory. Confirm one final output. On macOS the profile may retain one empty, private scratch file. Verify rejection for an existing result, traversal or a non-leaf name, changed parent/target, unsupported options or content, and an unapproved render. Cancel a running render before publication and verify no final output. Run the platform filesystem cases on Windows as well.

## Exercise access and shutdown

1. Occupy the preferred port using an independent loopback test listener. Enable MCP and verify the copied config points to the actual fallback port. Inject a non-address-in-use bind failure and verify the visible error and safe retry.
2. Use the injected HTTP test seams or loopback smoke harness to check missing/invalid credentials, invalid Host and Origin, exact-limit and oversized chunked bodies, and capacity. Confirm the handler is never reached on rejection. Assert the listener address is IPv4 loopback.
3. Rotate token, rapidly apply changes and disable while a bind is pending, then quit with a subscription open. Confirm stale listeners and streams close, old credentials fail, and an interrupted request waiting to commit cannot apply. Cover a supported protected store and the no-provider state.
4. Remove the private client config and rotate a credential used in manual checks if it was retained by the test client.

## Repository checks

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app typecheck:renderer
pnpm lint
git diff --check
```

Run `pnpm test` when shared behavior changes. For release validation, regenerate the production dependency inventory with `pnpm licenses list --json -P --filter @blue/app`, stage normal package inputs, run `pnpm --filter @blue/app verify:package-inputs`, and check the shipped notices and dependencies on supported installers. Existing packaging prerequisites apply.

## Recorded verification (2026-11-26, macOS `darwin-arm64`)

- **Worktree / revision**: `77507b325` (`codex/implement-mcp`, `.worktrees/implement-mcp`), Phase 8 convergence applied.
- **Native engine build & staging (T048 / T057)**:
  - `VCPKG_ROOT=/Users/stevenyi/work/blue3/native/blue-engine/.vcpkg pnpm --filter @blue/app engine:prepare` built `blue-engine` (`darwin-arm64`, protocol 2) and staged `packages/blue-app/.engine-stage/blue-engine`.
- **Full `@blue/app` test suite (T048 / Phase 8)**:
  - `pnpm --filter @blue/app test` (unsandboxed for `127.0.0.1` loopback and UDP/ZMQ sockets): **562/562 test files passed (0 failed), 6587 passed, 15 skipped (6602 total)** — including `src/main/global-history-engine.integration.test.ts` (11 tests, 1 skipped performance-budget assertion) and all MCP suites:
    - `src/main/mcp-credential.test.ts` (13), `src/main/mcp-server-service.test.ts` (11), `src/main/mcp-inspection-contract.test.ts` (7), `src/main/mcp-write-contract.test.ts` (5), `src/main/mcp-history.integration.test.ts` (5), `src/main/mcp-runtime-contract.test.ts` (4), `src/main/mcp-playback.test.ts` (5), `src/main/mcp-render.test.ts` (46), `src/main/mcp-client-config.test.ts` (3), `src/main/csd-generation.test.ts` (13), `src/main/program-settings-store.test.ts` (42), `src/preload/mcp-server-api.test.ts` (6), `src/renderer/tests/mcp-settings.test.tsx` (6), `src/renderer/tests/settings-window.test.tsx` (23), `src/shared/program-settings.test.ts` (64).
- **Workspace package suites (`macOS` `darwin-arm64`)**:
  - `@blue/data test`: 224 passed, 3 skipped (227 files); 3180 passed, 23 skipped (3203 tests).
  - `@blue/engine-client test`: 4/4 files passed, 53/53 tests passed.
  - `@blue/java-runtime test`: `mvn -q test` passed (exit 0).
  - `@blue/engine-native test`: 30 passed, 8 skipped (38 script/unit assertions without Release `benchmark_engine`), plus 14/14 C++ CTest cases passed (real ZeroMQ loopback).
  - `pnpm test:scripts`: 160 passed, 1 skipped (161 tests).
- **Staged package inputs (T057)**:
  - Built `@blue/data`, `@blue/engine-client`, `@blue/java-runtime` (`blue-java.jar`, `pythonLib`), `@blue/app` (`build:main`, `build:preload`, `build:renderer`), Quarto manual (`docs/manual/_build/html`), `release-metadata.json`, and `.engine-stage/blue-engine`.
  - `pnpm --filter @blue/app verify:package-inputs`: **passed (exit 0)**. Notice files (`LICENSES/`, `THIRD_PARTY_NOTICES.md`, `NPM-PRODUCTION-DEPENDENCIES.md`) verified present in `packages/blue-app/electron-builder.yml` `extraResources`.
- **Builds, lint, and whitespace**:
  - `pnpm --filter @blue/app build:main && pnpm --filter @blue/app build:preload && pnpm --filter @blue/app typecheck:renderer`: passed (0 errors).
  - `pnpm lint`: passed (1941 formatted files, ESLint, native & Java lint, renderer typography audit `passed: true`).
  - `git diff --check`: passed (0 whitespace errors).
- **External verification outstanding at this phase** (see Phase 10 and PR CI below):
  - Windows 2022 `.github/workflows/pr.yml` CI run of `mcp-render.test.ts` and `blue-engine.exe --run-confined-render` native filesystem correctness and full cross-OS tests (T048).
  - Supported installer matrix (`.dmg`, `.exe`, `.AppImage`/`.deb`) packaged notice and dependency checks on CI runners (T057 / T045).
  - Interactive live Electron GUI, `mcp-inspector`, and external local editor (Cursor / VS Code / Codex) acceptance walkthrough (T056 / T019 / T026 / T035 / T043).

### Phase 9 Convergence Verification (2026-11-26, macOS `darwin-arm64`)

- **Native confined render & capability build (`T061`)**:
  - Built `@blue/engine-client` (`4/4` files, `53/53` tests passed) and rebuilt/restaged native `blue-engine` (`csound-confined-render-v1`, `--run-confined-render`) via `VCPKG_ROOT=/Users/stevenyi/work/blue3/native/blue-engine/.vcpkg pnpm --filter @blue/app engine:prepare`.
  - `@blue/engine-native test` (with `BypassSandbox: true` for ZMQ loopback): `30 passed, 8 skipped` script assertions + `14/14` C++ CTest cases passed (including updated `EngineCapabilitiesTests`).
- **Focused & full `@blue/app` verification (`T060`–`T065`)**:
  - Sandboxed `@blue/app` suite (`vp test run --config vitest.config.mts --exclude src/main/mcp-server-service.test.ts --exclude src/shared/send-osc-script.test.ts`): **558 passed, 2 skipped (560 files); 6537 passed, 44 skipped (6581 tests)** — including `src/main/mcp-credential.test.ts` (14), `src/main/engine-bridge.test.ts` (30), `src/main/engine-runtime.test.ts` (23), `src/main/mcp-playback.test.ts` (5), `src/main/mcp-runtime-contract.test.ts` (4), `src/main/csd-generation.test.ts` (14), `src/main/mcp-inspection-contract.test.ts` (7), `src/main/csound-runtime-isolation.test.ts` (1), and `src/shared/csound-runtime.test.ts` (6).
  - Unsandboxed loopback & external Csound 7 suite (`vp test run --config vitest.config.mts src/main/mcp-server-service.test.ts src/main/mcp-render.test.ts src/shared/send-osc-script.test.ts`): **3/3 files passed, 74/74 tests passed** (`mcp-server-service.test.ts` 13/13 covering persisted enabled startup and relaunch credential interlock recovery; `mcp-render.test.ts` 46/46 including real macOS Csound 7 `/Library/Frameworks/CsoundLib64.framework/CsoundLib64` confined sine WAV render and concurrent directory replacement at native `linkat` publication; `send-osc-script.test.ts` 15/15).
- **Builds, packaging inputs, and lint**:
  - `pnpm --filter @blue/app build:main && pnpm --filter @blue/app build:preload && pnpm --filter @blue/app typecheck:renderer`: passed (0 errors).
  - `pnpm --filter @blue/app verify:package-inputs`: passed (`Package input validation passed`).
  - `pnpm lint`: passed (6/6 workspace lint & format checks).
  - `git diff --check`: passed (0 whitespace errors); `packages/blue-data` diff is empty.


### Phase 10 convergence verification

- Ran the built Electron 44.9.1 app on macOS 27.0.1 arm64 with disposable profiles and projects. Used keyboard and pointer at 100% zoom, checked disabled and read-only defaults and preferred-port fallback, and verified all copied configuration shapes. Inspector CLI 2.16.0 negotiated the current protocol and read the live project. The SDK exercised all four resources and inspection tools, a legacy handshake, and a live project subscription. Local Codex CLI 0.169.0 discovered Blue tools and resources using the copied environment-variable configuration.
- Applied all four edit tools, exercised both instrument types and instrument creation and update, undid and redid each edit, rejected a stale receipt, saved, and reopened the changed project in a new Electron process. The history integration suite covers restart-required reconciliation. The desktop run caught a history sequence carried across project replacement. The patch queue now starts a new sequence with each document session, and quit succeeded with a live subscription.
- Exercised local approval and decline, real timeline playback and stop, a Csound 7 RIFF/WAVE render, and refusal to overwrite the published file. The desktop driver supplied the OS dialog responses and the session-only credential-provider outcome in the isolated app. Rotating the credential rejected the previous token. Disable and accepted quit closed the endpoint. Protected persistence and failure recovery are covered by credential and listener tests.
- Ran native macOS publication checks without Csound for replaced destinations, replaced staging directories, replaced WAVs, and competing output creation. Separately verified the real sine render and a destination replacement at the publication callback. The engine runtime tests cover cancellation, grant revocation, stale receipts, child termination, and a cancellation after commit. The Windows directory-handle test and native publication checks are included in normal PR validation. Csound smoke tests report a skip when the required external library is absent.
- Passed package input verification and the packaged-app smoke checks on a local macOS arm64 bundle. The test bundle used ad-hoc signing with hardened runtime disabled through build command options. Verified the packaged MCP server 2.4.0, node transport 2.1.2, Zod 4.6.7, and the Hono, MCP SDK, and Zod notices. The installed verifier now checks MCP dependencies and notices in the PR package matrix.
- Passed the final macOS `pnpm test` run, including 562 app test files, 6,617 app tests passed, and 15 skipped. The workspace also passed 14 native CTest cases, 3,198 data tests, and 160 script tests. An earlier run that overlapped desktop and packaging checks reported one existing engine gate readback failure. The sequential run passed that case. Main and preload builds, renderer type-check, data API documentation, `pnpm lint`, and `git diff --check` passed.

### PR CI verification

- At PR head `0710694b4`, the [PR build matrix](https://github.com/kunstmusik/blue/actions/runs/45928261223) passed workspace tests, lint, package builds, and packaged-app smoke checks on macOS arm64, Windows x64, and Linux x64. The packaged-app checks covered MCP runtime dependencies and notices. CI uploaded the macOS DMG, Windows installer, Linux AppImage, and Linux Debian package.
- The [Windows Server 2022 job](https://github.com/kunstmusik/blue/actions/runs/45928261223/job/140274645625) passed the native `WindowsConfinedRenderLockTests` and ran `mcp-render.test.ts` with 57 tests passed and one skipped. The skipped real Csound 7 sine WAV render remains T076 because the external library was absent. The real sine render passed separately on macOS.

### Phase 11 follow-ups

- Observation-only CSD generation budgets Blue Synth Builder source, widget and stored parameter counts, and literal replacement expansion before copying the project. It supports nested groups and basic controls. It refuses widget types and substitutions without a bound, active automation, preset groups, and local user-defined opcodes.
- On macOS, the 36 focused CSD and MCP inspection tests passed. The full workspace suite, lint, Electron main build, host-test type check, data API documentation build, and whitespace check passed. The workspace test run used an isolated Maven cache to resolve local file-lock errors.
- T073 uses confined-render v4. On macOS verify the real sine WAV, zero-byte scratch after settlement, refusal of a second writer, recovery after child exit, preservation of a replaced scratch path, and recreation after OS eviction. The macOS runtime, native render and recovery suites passed 100 focused tests including the real Csound 7 sine render. The two platform-specific cases skipped on macOS cover Linux and Windows behavior. The macOS workspace suite, main build, host-test type check and lint also passed. Linux and Windows native validation for v4 is pending CI.
- T075 remains deferred as a follow-up. The current render path requires the approved output directory and OS temp directory to share a filesystem.
