# Implementation Plan: BlueShare 3.0 Parity

**Branch**: `codex/117-blueshare-parity` | **Updated**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/117-blueshare-parity/spec.md`

**Closure**: Closed on 2026-10-18 with an owner-approved Windows/Linux validation waiver.
The final closure record below supersedes dated checkpoint statements that keep these platform
and dependent release gates open. No Windows/Linux pass is claimed.

## Summary

Enable Tools → Blue Share with Java's Instruments/Effects/SoundObjects and Import/Export/
Manage organization. Consume the implemented blue-site v1 contract through a main-owned
service, import accepted standalone resources into existing user libraries, publish immutable
user-library snapshots, and list/remove the signed-in owner's submissions. Preserve project
history and data ownership; interface redesign remains deferred.

The owner approved TanStack Query for the renderer on 2026-10-18. Replace the manual
fetched-data/loading/error/pagination machinery with Query over checked preload calls. Keep
drafts and domain reconciliation separate. The earlier no-new-dependency decision is superseded
only for `@tanstack/react-query` and its `@tanstack/query-core` runtime dependency. Remaining
work, including the rememberMe amendment, is ordered in tasks.md; `$speckit-implement` is the next workflow command.

The service dependency passes review at blue-site commit
`20df3f93185b60a6677999a4820405215c9e4f3a`: 15 unit tests and 20 isolated HTTP/PostgreSQL/
Nginx integration tests rerun successfully. Read-only public production checks pass. These
are service results, not proof that every historical resource is semantically supported by Blue 3.

## Technical Context

**Language/Version**: Existing strict TypeScript 5.8-compatible workspace; React 19.2;
Electron 44.5.1. Preserve existing versions; add only the approved dependency below and update
the lockfile for its resolved dependency closure.

**Primary Dependencies**: Existing Electron `net`/`session`, React, existing UI/state utilities,
`@blue/data` standalone loaders and library metadata adapters, existing SQLite worker and
Vitest/Testing Library/browser test infrastructure, plus renderer-only
`@tanstack/react-query@5.104.4` (MIT), which depends on `@tanstack/query-core@5.104.4` (MIT).
Published metadata and license files were checked; provenance is in research.md Decision 7.
Install during implementation, with no Query persistence/devtools/broadcast plugins.

**Storage**: Existing `app.getPath('userData')/blue_libraries.sqlite` for imported copies;
service owns its remote catalog. A dedicated nonpersistent Electron session stores account
cookies in memory. Main memory stores operation fences and bounded publish snapshots;
renderer memory stores a modal-scoped Query client and separate UI selection/drafts.
The rememberMe amendment adds only a main-owned encrypted session-cookie record in the existing
userData profile after explicit opt-in. No project/library schema migration, saved password,
persistent renderer state, offline queue or catalog mirror is added.

**Testing**: Focused Vitest service, transport, IPC/preload, library atomicity/source-snapshot,
and renderer tests; existing serialization and history regressions. Deterministic native
Electron/session and keyboard/manual checks are in [quickstart.md](quickstart.md).

**Target Platform**: Existing macOS, Windows, and Linux Electron distribution targets.

**Project Type**: Desktop application consuming a separately owned HTTPS service.

**Performance Goals**: Pending feedback within one second; a 30-second total request deadline
including response-body reading; page 25 summaries at a time; latest-ten separately per kind.
Keep the rest of Blue usable. Do not prefetch the entire catalog or all XML resources.

**Constraints**: Exact configured service origin, no credential-bearing redirects, active cookies
in memory plus opt-in OS-protected session proof only, no automatic write retries, typed validated
IPC/HTTP boundaries, atomic library
imports, unchanged active project until existing insertion is explicitly invoked. Bound each
response to 16 MiB and each XML to the service's 2 MiB UTF-8 maximum; oversized responses
fail explicitly. Signed-in state is application-wide, not a project property.

**Scale/Scope**: Three kinds × three workflows; current observed production catalog has
91 instruments, 124 effects, and 21 SoundObjects. Counts are observations, not hard limits.
Support nested categories and multi-page lists; do not add search/tags/Update/redesign.

## Constitution Check

*The table below records the earlier design/implementation review. Its implementation PASS
claims do not close the current convergence findings or validate the approved Query migration.*

| Gate | Before research/design | After Phase 1 | Post-Convergence Implementation |
| --- | --- | --- | --- |
| Portable data core | PASS — consume existing `readResourceXml`, raw XML/classification helpers; no host additions to `@blue/data`. | PASS — all new transport/session/UI code is in `@blue/app`; shared DTOs are serializable and use static imports. | PASS — `@blue/data` production source remains 100% host-neutral; browser-safe standalone models and XML loaders unmodified. |
| Java and project compatibility | PASS — Java snapshot `3ca3f40579c48a023299a68130d8ab6b9e950974`, working panes and import folders examined first; historical sources are in research. | PASS — standalone instrument/effect/SoundObject acceptance uses existing shared loaders and feature 116 contracts. No new `.blue`/CSD form, opaque fallback, or resource repair. Transport, email login, responsive UI, diagnostics differ intentionally. | PASS — 3 groups × 3 tabs preserved; documented feature 116 historical fixtures and runtime-backed resources verified with zero code execution; whitespace preserved roundtrip. |
| Migration scope and ordering | PASS — no project/data migration proposed. | PASS — class-local normalization still precedes acceptance for all independent roots; reject conflicts under existing contracts. No project-version prerequisite or BlueShare-only alias list. | PASS — zero project migrations, schema migrations, or disk formats added. Class-local normalization and conflict rejection verified. |
| Canonical ownership and contracts | PASS — service owns catalog; unified library owns local copies; main owns sessions; project bridge remains sole project owner. | PASS — HTTP, typed IPC, immutable source preparation, SQLite receipt/change events, and failure states specified. Existing library recovery remains authoritative. | PASS — main owns session/epochs; unified library SQLite owns imported items; project bridge remains sole owner; typed IPC/preload boundaries verified. |
| Project history and undo/redo | PASS — BlueShare itself has no project writer. | PASS — subsequent insertion uses existing project-history path and semantic labels; all three kinds require insertion undo/redo regression checks. No exception. | PASS — active project invariance verified across all operations; downstream insertion uses canonical `ProjectHistory` commit→undo→redo. |
| Runtime and engine isolation | PASS — network/session/XML acceptance stay host-side, execution unchanged. | PASS — renderer receives DTOs, never raw session proof; no engine/Java calls on import, no asset resolution, no code execution. | PASS — zero script/asset execution on import/browse/publish; credentials stay main-only; renderer receives sanitized DTOs. |
| Host-path portability | PASS — existing native userData path stays unchanged; service URLs are separate identities. | PASS — diagnostics put remote labels in `XmlSource.label`, never `nativePath`; no new path conversion/permission behavior. Existing cross-platform packaged checks remain required. | PASS — native OS `userData` paths used; service URLs separate; cross-platform runners recorded with Windows/Linux pending physical CI. |
| Verification evidence | PASS — implemented service reviewed, 15 unit/20 integration tests pass, public production reads pass. | PASS — lowest-boundary automated matrix and native/manual validation cover cookie behavior, atomic imports, invalid data, revisions, staleness, uncertain writes, keyboard flow, and insertion history. Desktop checks are required during implementation, not reported as already passing. | PASS — 18 test files (226 tests) passed; controlled catalog acceptance (T052/T073) passed; native Electron session verifier passed on macOS darwin; Windows/Linux explicitly pending. |
| License compatibility/provenance | PASS — root scope map and component metadata/notices reviewed; Java/service are behavioral references only. | PASS — original GPL-3.0-or-later app code calls existing MIT data APIs. No Java/site code or production payload fixtures copied, no new dependency/asset. Existing runtime notices remain; any later scope/dependency change must repeat the gate. | PASS — 100% original implementation; zero copied code or assets; no new dependencies or stores added. Licensing audited. |

The plan requires no constitutional exception. Existing resource acceptance and migration
history is inherited from feature 116; a newly discovered incompatibility needs its own
bounded evidence and regression case rather than broadening acceptance here.

### Current amendment check — 2026-10-18

| Principle | Approved design disposition / implementation gate |
| --- | --- |
| I. Portable core | PASS design: Query imports stay in the app renderer; no Query/host/UI dependency enters `@blue/data`, main, or preload. |
| II. Compatibility | PASS design: existing standalone loaders and canonical XML remain authoritative; migration also retains the pending XML validation fix T080. |
| III. Ownership/contracts/history | PASS design: Query owns disposable fetched views only; main owns accounts/epochs and write guards, library owns SQLite, project history stays canonical. Nested validation/privacy findings T074–075 remain open. |
| IV. Runtime isolation | PASS design: all queries call typed preload methods; Electron native transport/cookies stay main-owned. Cancellation cannot roll back dispatched writes. |
| V. Verification | PENDING implementation: regression tests, actual service acceptance, native verification and Windows/Linux evidence remain required. Earlier fake-service results are not actual-service acceptance. |
| VI. Licenses/provenance | PASS design: both proposed 5.104.4 packages contain MIT licenses compatible with this GPL-3.0-or-later app scope; preserve Tanner Linsley's copyright/permission notices, update shipped license text and dependency inventory in T085/T087. No upstream source adaptation or new fixture rights are assumed. |

The amendment authorizes the dependency; it does not mark installation, migration, or validation
complete. No exception to the constitution is requested.

## Project Structure

### Documentation (this feature)

```text
specs/117-blueshare-parity/
├── spec.md
├── service-prerequisites.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── service-api.md
    └── desktop.md
```

Existing tasks.md is amended in place; completed tasks and existing task IDs remain intact.

### Source Code (repository root)

```text
packages/blue-app/src/
├── shared/blueshare.ts                         # new DTOs, channels, guards
├── shared/workbench-menu.ts                    # open-blue-share menu command
├── main/blueshare/
│   ├── transport.ts                            # native session, bounded HTTP
│   ├── service.ts                              # operation/account/library orchestration
│   └── ipc.ts                                  # validated registrar and teardown
├── main/unified-library/
│   ├── service.ts                              # accepted import and publish-source façade
│   ├── repository.ts                           # atomic imported-item write + snapshot read
│   ├── repository-client.ts                    # worker operation delegates
│   └── repository-worker.ts                    # worker dispatch
├── main/application-menu.ts                    # enable Tools entry
├── main/main.ts                                # service startup/disposal and menu wiring
├── preload/preload.ts                          # checked blueAPI methods
├── renderer/types/global.d.ts                  # matching typed declarations
├── renderer/stores/workbench-store.ts          # open-blue-share dispatch
├── renderer/App.tsx                            # modal mount
└── renderer/components/blueshare/
    ├── BlueShareModal.tsx                      # existing modal/focus convention
    ├── BlueShareDialog.tsx                     # three groups/tabs and existing controls
    ├── blueshare-query.ts                      # scoped client/defaults, keys, checked result adapter
    ├── blueshare-query.test.ts                 # error/key/lifetime regression coverage
    └── use-blueshare.ts                        # Query reads/mutations plus separate draft/domain state
```

Focused tests are colocated or in the established renderer test directories. Small panes
may be extracted from the dialog when needed for focused behavior; no pane/plugin framework
is introduced. Update `docs/manual/tools.qmd` when enabling the feature. Keep unrelated
application files and the user's untracked issue audit unchanged.

**Structure Decision**: One feature service with a narrow main-only native transport and one
IPC registrar. Unified-library remains the only library persistence façade; do not move its internals
out of the large module or let BlueShare access its private repository client. Follow existing
transactional IPC registration/startup rollback. The endpoint inventory test must explicitly
include the new registrar; preserve all existing endpoints and teardown order.

## Phase 0 — Research decisions

Completed in [research.md](research.md):

1. Consume the verified v1 contract; preserve exact kind spellings/nullability/pagination.
2. Use an isolated nonpersistent Electron Session and native `net.request`, avoiding a custom
   Set-Cookie parser or extra cookie dependency. Set `credentials: 'include'`, exact origin,
   `redirect: 'error'`, and no-store. Chromium owns all cookie processing, including
   `dont_remember`; native tests must verify this against the installed Electron version.
3. Reuse standalone semantic acceptance before library classification. Do not treat archived
   unsupported library payloads as successful network imports.
4. Extend existing library ownership with atomic imported-folder/item creation and a consistent
   revision-checked source snapshot. No file import dialogs, fake library envelopes, or new DB.
5. Preserve ambiguous publish outcomes, retain drafts, and reconcile using My submissions.
6. Keep Java's UI organization; use Blue 3 modal, focus, confirmation, typography conventions.
7. Adopt TanStack Query for renderer request state as specified below; the owner approved this
   bounded dependency after repeated request lifecycle/race defects in the manual hook.

All design unknowns have decisions; there are no unresolved clarification markers.

## Phase 1 — Design and contracts

The [data model](data-model.md) names canonical/transient owners, identities, validation,
state transitions, source snapshot lifetime, and atomic import behavior. The consumed
[service contract](contracts/service-api.md) pins the actual v1 endpoints. The
[desktop contract](contracts/desktop.md) defines IPC, lifetime, error handling, session
fences, library seams, confirmation, and view behavior.

Implementation should proceed in these verifiable slices:

1. Shared contracts and native transport; prove exact-origin cookies, timeout/body bounds,
   response validation, and session/logout behavior with no renderer network access.
2. Library acceptance/import and source capture; prove transactional rollback, folder reuse,
   source-revision coherence, independent copies, restart persistence, and unchanged project.
3. Main service and validated IPC/preload; prove caller checks, account/view fencing,
   single pending writes, resource diagnostics, and uncertain-write outcomes.
4. Enable menu and implement Import; then Export/account and Manage/remove using existing UI.
   Add keyboard/focus and stale-response tests, preserving the familiar nine combinations.
5. Complete history/insertion, native Electron, platform checks, and current user documentation.
   Run the validation commands in quickstart; declare parity only after all three workflows
   work for all kinds against the service.

**Boundary review**: BlueShare service owns remote/session operations and exposes typed intents;
transport depends only on Electron/runtime and contract guards; library owns durable imports;
UI depends only on preload and existing library browse contracts. Lowest seams are transport
fake/native tests, real SQLite worker operations, service/IPC tests, and renderer interactions.
Rollback is the feature registrar/menu/modal plus its two library operations; there is no schema
rollback. Broad `main.ts`, library, renderer, or project-history refactors are deferred.

**Original post-design gate**: All original Constitution Check rows remained PASS. Runtime safety and data-loss
requirements are preserved without a second project owner, a generic network framework, or a
persistent synchronization layer.

## Decision 7 — Renderer request state with TanStack Query

This decision supersedes manual renderer fetched-data/loading/error/pagination ownership and
earlier unqualified no-new-dependency statements. It does not supersede any functional,
serialization, security, uncertain-write, or verification requirement.

- **Scope and seams**: use one stable Query client/provider local to `BlueShareModal.tsx`,
  with small defaults/key/result helpers in `blueshare-query.ts`. Do not add an application-wide
  provider, generic IPC/query framework, backend cache, or new network client. Remove replaced
  result/loading/error/page arrays and read-generation bookkeeping from `use-blueshare.ts`.
  Selection, dialog lifetime, draft identity and write-side-effect fences remain explicit domain state.
- **Reads**: categories, Latest, detail and current user-library listing use `useQuery` over
  existing checked preload methods. Category and owned cursor lists use `useInfiniteQuery`,
  with `nextBeforeId` as `pageParam`; fetching is demand-driven and retains all reached pages.
  User-library traversal must honor every existing `nextCursor` and content-revision check.
  Disabled queries must not appear as active pending operations or successful empty responses.
- **Identity**: main adds a non-secret `serviceScope` (canonical configured origin, identity
  only) to the checked open result. All query keys include that scope and dialog context;
  operation, kind, category and resource key are added when relevant. Private reads also include
  public account ID and main-owned epoch. Cursors belong to infinite-query page parameters.
  Changing identity uses a distinct key; old results never substitute for the new selection.
- **Errors and defaults**: unwrap `BlueShareResult<T>` into `T` or a thrown typed error carrying
  its bounded `BlueShareError`, including `outcome`, status, fields and diagnostics. Never resolve
  `{ok:false}` as successful query data. Set reads and mutations to `retry:false` and
  `networkMode:'always'`; IPC must run and fail explicitly even when navigator reports offline,
  without an offline resume queue. Use `gcTime:0` for queries and mutations; reads use
  `staleTime:30000`, no polling, and
  `refetchOnWindowFocus:false` / `refetchOnReconnect:false` for reads. Explicit Fetch/Retry and
  confirmed-write invalidation control refresh. Main retains the 30-second transport deadline.
- **Mutations**: import, source preparation, publish and remove use `useMutation` with non-secret
  intent variables only, including immutable public submission-field snapshots; no live editable
  draft object is cached. Keep main's single pending write slot and disabled UI; mutation scopes
  or queuing are not duplicate rejection. No optimistic success/removal and no automatic write
  retry or replay. Confirmed writes invalidate affected keys and refresh the canonical library
  through its existing event. Unknown outcomes preserve the originating draft/key and require
  the existing explicit, resource-specific reconciliation; one missing cached page proves nothing.
- **Accounts and drafts**: main remains the account/epoch owner. Sign-in credentials travel
  only through a transient imperative preload call, never Query/Mutation cache variables, keys,
  metadata or logged errors. Sign-out/re-authentication replies and account events apply only
  to the current context/epoch; query an authoritative account snapshot rather than incrementing
  epochs in renderer. Cancel/remove obsolete private queries and invalidate source tokens on
  account replacement/expiry. Preserve separate non-secret draft fields for renewed review;
  late mutation callbacks may not clear a newer draft or repopulate a disposed client.
- **Lifetime and cancellation**: clear query and mutation caches on dialog close/unmount and
  isolate a reopened context. Observe Query's AbortSignal before/after IPC to suppress cancelled
  reads; `ipcRenderer.invoke` does not itself abort main I/O. Keep checked main context/source
  cleanup and native operation fences; do not add arbitrary renderer AbortSignal IPC or claim
  cache cancellation undoes a durable commit. No persistence, dehydration, broadcast or credentials
  in caches; `gcTime:0` does not replace explicit close/account cleanup.
- **Verification**: each test gets an isolated client cleared after use. Reproduce T076–079/T084
  before their fixes; test failure unwrapping, key/account/origin isolation, demand-driven pages,
  read replacement, busy settlement, unknown-write retention/no retry, invalidation, exact draft
  text, credential exclusion from both caches, and cleanup after late open/read/write completions.
  Preserve real service/native/history/platform gates and update license/package checks.

## Complexity Tracking

One new direct dependency and its MIT core dependency replace demonstrated duplicated renderer
request machinery. Further manual request-generation helpers and a generic framework were rejected:
the existing hook's repeated lifecycle defects justify using Query's built-in ownership. Keep the
remaining account/draft/write fences small and domain-specific. No additional stores or constitutional
exceptions are authorized. The scoped validation waiver permitted by Constitution V is recorded
in the final closure section below; dated implementation checkpoints retain their original scope.

## Current implementation assessment — Phase 12, 2026-10-18

T088–T093 and T081 are implemented and checked. Main now admits native writes exclusively
within its private Session, rejects overlap without queuing, and closes idle connections before
dispatch. The native verifier passes all eight POST/DELETE × HTTP/1.1/HTTP/2 × fresh/warmed
cases, including distinct connection identities, plus cookie/origin/restart/deadline checks.
No service protocol, global networking setting, runtime or dependency changed.

Renderer mutations remain observed through selection changes. Settlements, errors, receipts and
unknown outcomes remain attached to the originating kind/resource/account/draft; per-kind drafts
and detached submitted-draft recovery live outside Query. Late opening results use the monotonic
main-owned account mirror. Opening and safe local reads/preparations have bounded recovery;
main bounds the whole import/publish preflight budget. A library import that may still commit
reports an unknown outcome and retains admission protection, including after dialog reopening,
until the delegate settles. No durable rollback or automatic retry is claimed.

Local validation passes: 299 focused tests; the quiet workspace rerun (app 5692 passed / 2 skipped,
data 3089 / 1 skipped, engine-client 47, CLI 7, native 14, Java, repository scripts 59); lint;
main/preload/renderer builds; package inputs; unsigned darwin-arm64 staging with verified Query
license closure. An initial full-suite meter timing failure passed in isolation and in the quiet
workspace rerun without changing the benchmark. Actual-service/UI evidence is recorded in the
latest quickstart section; T083/T094 are checked after the final portable-controller run passed
all three kinds and all nine rendered workflows, public cache invalidation, pending-removal
selection changes, kind-switched lost writes, complete reconciliation and account replacement.

The supported-platform/release gate remains **PENDING**: Windows/Linux runners are unavailable
(T082/T095), so final T087/T096 and full parity remain unchecked. The earlier HTTP/2 blocker and
service-idempotency decision are superseded by the compliant native fix, not by a scope exception.

### UI review follow-up (2026-10-18)

Preserve root/folder/item nodes in the existing revision-consistent library query. Reuse
`LibraryTree` through thin read-only category/source adapters; disable drag preparation and
editing context menus in picker mode. Render source comments from `PublishSourceSeed` and
Manage details from the selected owned `ResourceSummary`; no new IPC, XML exposure or cache
owner is introduced. Normalize content backgrounds and row selection to existing app tokens.
Constitution/license check: original app code in the existing GPL-3.0-or-later scope, no copied
Java source, new dependencies or external assets. Existing release/platform gates remain open.


### RememberMe amendment: approved design (2026-10-18)

The owner requested a server handoff and implementation scope for optional remembered sign-in.
The normative server delta is [contracts/remember-me-api.md](contracts/remember-me-api.md), and
spec FR-020–024 supersede only the original prohibition on durable session proof. Existing native
partitions remain nonpersistent and isolated; no browser-wide cookie jar or new auth protocol.

Keep unchecked login app-lifetime-only. Checked login requests a fixed seven-day server session.
Reuse Electron safeStorage and existing main filesystem primitives for one bounded, versioned,
atomically replaced encrypted cookie record, scoped to the profile and exact origin. Reject
unavailable/insecure encryption backends, including Linux basic_text. Export/restore cookies
through native cookie APIs; do not parse Set-Cookie manually or persist passwords. GET/session
supplies authoritative expiry and validates restart restoration before exposing signed-in state.
Use existing account epochs/generation guards for network work plus serialized record save/delete
so late completions cannot undo logout, overwrite a replacement account or cross an origin change.
Offline sign-out clears local proof and honestly reports remote revocation; failed local deletion
must also be visible. A transient restore failure can retain unexpired encrypted proof for explicit
retry, while protected actions remain disabled. No automatic login retry or write replay is added.

Server implementation/deployment is the blocking external prerequisite for sending the new member
and claiming seven-day support. Baseline strict validation rejects rememberMe. Preserve existing
response shapes and ordinary-login compatibility; do not silently downgrade/retry opted-in login.
Tests precede implementation and cover strict boundaries, storage failure, restart/native cookies,
expiry/revocation, account/origin/shutdown races, renderer defaults and existing uncertain writes.
Native OS storage evidence is required on supported platforms; unavailable platform checks stay open.

Constitution/license check: original documentation now and planned original GPL-3.0-or-later app
code using existing Electron APIs; no copied server/auth-library code, new dependencies/assets or
project-format/history changes. Recheck relevant component notices before implementation. Java is
not the authority for this explicitly requested session extension; existing workflow parity remains.


RememberMe implementation: `RememberedSessionStore` keeps a versioned encrypted cookie record
using Electron safeStorage. The active transport retains nonpersistent partitions. Main's OPEN
IPC path starts initial restore/GET verification without delaying the public browsing context, while account epochs and serialized storage
invalidate stale saves/restores. The renderer adds only the explicit checkbox, non-secret warning
and verification retry. The server extension is delivered at fe19eca; main/preload/renderer builds,
focused tests and native macOS acceptance are recorded in quickstart.md. Existing platform/release
gates remain separate. No new package or third-party material was added.


### Phase 14 account-lifecycle correction

OPEN immediately returns an owned, checked context. Pending restoration is `unavailable`, never
signed in; existing main-owned account events reconcile identity. A checked event received before
OPEN resolves takes precedence over the older OPEN snapshot. Closing the restore owner retires
its pending authority so a reopened dialog can verify independently.

The unavailable-state banner offers offline **Forget saved sign-in** through checked sign-out.
Non-secret drafts survive account changes. Main bounds restore/retry/sign-in/sign-out with one
30-second budget including disk/cookie waits; HTTP gets the remaining budget. Renderer account
observers share their operation budget. Timeouts fence late work, invalidate pending saves and
queue deletion behind in-flight writes; they do not claim cancellation of physical I/O. Only an
already server-verified identity may survive a persistence timeout as a warned process-only
session. Local deletion success and remote revocation confirmation remain separate results. An anonymous
DELETE while forgetting unverified proof does not confirm revocation of that saved session.

License/provenance check: these corrections and disposable test-driver additions are original
code in the existing GPL app scope; no new dependency, asset, server code translation, project
mutation or storage location was introduced. Existing TanStack Query MIT notices/package evidence
remain applicable. Windows/Linux OS-storage and full-release gates remain unfulfilled.


## Feature closure and scoped validation exception — 2026-10-18

The owner accepted the stay-signed-in behavior through testing and explicitly requested:
“I'd like to skip the windows and linux tests.” Feature 117 is closed on that basis.
This is a documented scoped verification exception permitted by Constitution V, with explicit
project-owner approval; it changes no constitution principle or runtime/security contract.

Scope: waive the unexecuted Windows/Linux native, rendered UI, OS-protected storage, path,
failure/recovery and applicable engine/history acceptance cases for this feature's closure.
The compliant alternative was to retain the gates until native Windows/Linux runners executed
the complete matrix. The owner chose closure using successful user testing and existing local
acceptance instead. Platform behavior remains unverified and is not represented as passing;
no plaintext crypto fallback, dependency/license exception or implementation change is authorized.

The accepted evidence is the matching production-source Phase 14 macOS/native/database-backed/
rendered-service run, 339 focused regressions, the recorded 5751 full-app passes (2 existing
skips), workspace tests, builds/typechecks, lint, package/license checks and project/history
regressions in quickstart.md. Production-source identity was rechecked at closure; main/preload/
renderer builds and renderer typecheck pass. Existing Vite chunk-size advisories remain. No source
change requires repeating unchanged native/service suites.

T082/T095/T107/T113/T115 are resolved as waived platform gates, not executed tests.
T087/T096/T108/T114/T116 are complete under the approved exception and existing evidence.
All 116 task entries are resolved; there is no remaining implementation or release-validation
work in this feature's approved closure scope. This records spec closure, not publication of
an installer, a Git commit, or production deployment.
