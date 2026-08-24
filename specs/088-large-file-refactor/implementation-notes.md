# Implementation Notes: Large File Refactor

**Status**: Closed on 2026-08-23. All T001–T068 tasks are complete; the final validation and
platform-specific follow-up ownership are recorded below.

## Baseline — 2026-08-23

- Owner: Codex implementation session.
- Repository: `/Users/stevenyi/work/blue-electron`.
- Branch: `088-large-file-refactor`.
- Worktree before implementation: only `specs/088-large-file-refactor/` was untracked; no unrelated modified files were present.
- Node: `v22.23.1`.
- pnpm: `10.18.3`.
- TypeScript: `5.9.3`.
- Vitest: `4.1.6`.
- Baseline command: `pnpm --filter @blue/app test`.
- Baseline result: 362 test files passed; 3,581 tests passed and 2 skipped (3,583 total); duration 34.23s.
- Baseline warnings: expected Node SQLite experimental warnings, the existing `nonexistent_command_xyz_12345` fixture diagnostic, and jsdom canvas `getContext()` warnings. No test failures.
- Residual risk at baseline: the large-file refactor still requires focused seam, IPC inventory, main/preload/renderer build, repository test, lint, Windows path, and manual smoke evidence.

## Checkpoints

This file is updated after each task checkpoint with the exact command, result, rollback unit, and any scoped exception.

## Renderer seam checkpoint — 2026-08-23

- BSB direct seam: `bsb-interface-snapshot.test.ts` passed 7 tests; the existing BSB editor,
  presets, and track-instrument queue checkpoint passed 55 tests.
- Queue direct seam: `project-patch-queue.test.ts` passed 7 tests; the project-store and BSB
  performance/transport checkpoint passed 19 tests. `build:renderer` passed.
- Stable façade behavior: the full app suite passed after the seam wiring; optimistic reducers
  outside BSB remain in `project-store.ts` by design.
- Rollback units: restore the BSB implementation and queue protocol in `project-store.ts`, then
  remove their sibling modules/tests without changing renderer consumers.

## Main ownership and lifecycle checkpoint — 2026-08-23

- `project-session.test.ts` and `project-lifecycle.test.ts` passed 7 tests, including POSIX,
  drive-letter, UNC, stale-session, candidate-load, save-as, and close ordering cases.
- `ipc-registration.test.ts` and `startup-lifecycle.test.ts` passed 7 tests; duplicate leases,
  reverse partial rollback, exact listener identity, stale disposers, cleanup errors, and
  initiating-error preservation are covered.
- Existing registrar compatibility passed: unified library/code repository/MIDI/workbench suite
  passed 27 tests. MIDI duplicate registration now fails before side effects and has an explicit
  disposer/reset path.
- Domain registrar channel adapters passed 3 tests; the source inventory oracle passed 3 tests
  and reconciles 110 collected `main.ts` declaration sites (107 handles + 3 listeners) plus the
  three score-object loop endpoints to 112, plus 65 existing-registrar endpoints to 177.
- `build:main` and `build:preload` passed. `project-lifecycle.ts` now coordinates project
  replacement and close around `ProjectSession`; normal shutdown disposes the hardened existing
  registrars.
- Rollback units: restore identity/lifecycle calls in `main.ts`, remove `ProjectSession` and
  `project-lifecycle.ts`, or revert the registration lease adoption independently from handler
  behavior.

## Main registrar composition checkpoint — 2026-08-23

- The legacy handler declarations now collect into injected maps during module evaluation; the
  five domain registrars perform the real Electron registrations through the shared transactional
  lease. `main.ts` no longer directly calls `ipcMain.handle` or `ipcMain.on`.
- `main-process-ipc-inventory.test.ts` now asserts 110 collected declaration sites expand to 112
  domain endpoints, the five domain channel arrays are unique and total 112, and the four existing
  registrar owners contribute 65 endpoints for a process-wide total of 177.
- The registrar disposers are retained by the composition root and invoked in reverse domain order
  during normal shutdown. `build:main` and the focused inventory/domain/lease/startup/session/
  lifecycle checkpoint passed 20 tests.
- Rollback unit: remove the collector and `registerDomainIpc()` composition block to restore the
  prior direct-registration mechanism; handler behavior and the existing registrar modules remain
  independently revertible.

## Combined app checkpoint — 2026-08-23

- `pnpm --filter @blue/app test` passed 370 test files, 3,615 tests, with 2 skipped (3,617 total),
  duration 34.29s. Expected SQLite, canvas, and nonexistent-command fixture warnings remained.
- `pnpm --filter @blue/app build:main`, `build:preload`, and `build:renderer` passed. Renderer
  output retained the repository's existing large-chunk warnings.
- Remaining risk: handler bodies still close over the composition-root host functions in `main.ts`
  rather than being moved into independently-owned host-operation modules; failed-startup
  composition wiring, native Windows execution, and packaged/manual smoke remain separate
  checkpoints.

## Final repository gates — 2026-08-23

- `pnpm --filter @blue/app test` passed: 375 test files; 3,643 passed and 2 skipped
  (3,645 total); duration 42.32s. Expected SQLite, jsdom canvas, and missing-command fixture
  diagnostics remained informational.
- `pnpm test` passed on its final uninterrupted run: all six workspace projects, all 13 native
  engine tests, 168 `@blue/data` files/1,651 tests, 3 engine-client files/35 tests, Java tests,
  2 CLI files/5 tests, 375 app files/3,643 passed/2 skipped, and 38 repository script tests.
  The first sandboxed attempt could not bind native loopback sockets; the first elevated retry
  briefly found fixed port 39173 occupied. `AutomationProtocolTests` then passed alone and the
  full elevated rerun passed, so this was an environment/port collision rather than a code failure.
- `pnpm lint` passed, including the renderer typography audit, ESLint, native-engine lint, and
  Java validation.
- `pnpm --filter @blue/app build:main`, `build:preload`, and `build:renderer` passed. Existing
  renderer large-chunk warnings remain informational.
- `git diff --check` passed after the final task/document synchronization. No new dependency,
  IPC payload, persistence shape, global path normalization, deep clone, or unrelated semantic
  cleanup was introduced.
- Native Windows execution was not available in this macOS session. Synthetic drive/UNC/native
  path cases passed, and `.github/workflows/pr.yml` retains the Windows 2022 matrix; CI remains
  the owner of native Windows and packaged-app verification.

## Convergence checkpoint — 2026-08-23

- Startup composition now uses `StartupLifecycle` for the pre-ready 112-endpoint domain
  transaction and the current `whenReady` stages. Completed reversible work unwinds in reverse
  order on failure, partial library/repository/application-shell stages clean themselves, the
  initiating failure is preserved, and process-lifetime `registerBlueAudioScheme` has no fake
  disposer. The separate explicit normal-shutdown order remains in `main.ts`.
- The executable process-wide oracle invokes the domain, workbench, MIDI, unified-library, and
  code-repository registrars in startup order and proves 177 unique endpoints (171 invoke, 6
  listen), exact modes/order, representative results, partial failure rollback, reverse exact
  teardown, and idempotent disposal. The inventory/startup/existing-registrar checkpoint passed
  5 files and 26 tests; all five focused domain suites plus lifecycle/inventory passed 7 files and
  24 tests.
- Project workflow compatibility passed 4 files and 87 tests. The added end-to-end case covers
  candidate failure, open/new/save/save-as/revert/close, ordered cleanup/publication, monotonic
  session fencing, unchanged Windows path publication, and save/reopen preservation of modeled
  title data plus an unknown `pluginData` element.
- Runtime compatibility passed 6 files and 76 tests across CSD generation/export, audition,
  render, freeze, and REPL. Added cases bind in-flight CSD work to its initiating project, keep
  export cancellation side-effect free, keep audition copies isolated across replacement, and
  prevent runtime globals from leaking into a replacement project session; existing suites prove
  mutual exclusion, cancellation, concurrent-operation limits, temporary cleanup, and failure
  behavior.
- Stable renderer façade convergence passed 16 project-store tests, including exported revision
  and BSB helpers, test flush hooks, cross-domain optimistic patches, in-flight reset/stale receipt
  fencing, monotonic revisions, dirty restoration, and refresh ordering.

## Manual and packaged smoke evidence — 2026-08-23

- User-provided result: manual testing was completed and “things looked good.” The exact actions,
  packaging mode, and project fixture were not enumerated, so this is recorded as a successful
  general interactive sanity check rather than as evidence for every quickstart substep.
- The missing deterministic known-plus-unknown XML save/reopen portion is covered automatically by
  `project-replacement-entry-points.test.ts` with a representative unknown plugin element and a
  native Windows path. The main/preload/renderer builds and all automated compatibility gates pass.
- Still unavailable locally: an explicitly enumerated packaged run of every manual-smoke step and
  native Windows execution. The feature owner (Steven Yi) owns the next packaged interactive pass;
  the Windows 2022 CI job owns native drive/UNC and packaged verification. No unrecorded manual
  claim is used to close those platform-specific follow-ups.
