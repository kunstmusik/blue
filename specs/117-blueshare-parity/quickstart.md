# BlueShare implementation validation guide

Updated: 2026-10-18. Feature closed with the owner-approved Windows/Linux validation waiver
recorded at the end of this guide and in [plan.md](plan.md). Existing macOS/native/service and
regression evidence remains valid; Windows/Linux cases were not run and are unverified.
Dated checkpoints below preserve historical gate status; the final closure record supersedes it.
See [spec.md](spec.md), [tasks.md](tasks.md), and [contracts/desktop.md](contracts/desktop.md).

## Prerequisites

- Existing Blue 3 workspace dependencies/build prerequisites and a disposable app profile.
- Implemented desktop feature; original synthetic current/historical/invalid resource fixtures.
- For service writes, Node 24 and Docker with the blue-site isolated integration harness.
  Never point account/publication/removal tests at production or an ordinary app database.
- For native Electron session checks, a disposable local service/test origin serving synthetic
  fixtures and accounts. Production remains the normal service origin; local injection is test-only.

## Current service verification — rerun 2026-10-17

From blue-site:

```sh
pnpm test
pnpm run test:integration
```

Use its Node 24 runtime. The harness creates guarded temporary PostgreSQL/Nginx containers,
builds a local test app with intercepted reset mail, then removes only its resources. In this
recheck the harness ran from an isolated source/dependency copy under `/private/tmp`, preserving
the user's blue-site checkout/build outputs. Results: 15 unit tests and 20 integration tests,
zero failures/skips; the integration build also passed lint/type validation. Only a Node module-
type warning appeared in unit tests. Source revision and hash are in research.

Read-only production discovery may use, for example:

```sh
curl --fail --silent --show-error https://blue3.kunstmusik.com/api/blueshare/v1/instrument/categories
curl --fail --silent --show-error https://blue3.kunstmusik.com/api/blueshare/v1/effect/latest
```

No credentials are needed. Do not store output as repository fixtures or infer whole-catalog
semantic compatibility from successful HTTP downloads. Exact production commit has not been
obtained from the public health endpoint; record it at deployment/release handoff.

## Automated desktop checks

Run from the Blue 3 repository root after implementation:

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app typecheck:renderer
pnpm --filter @blue/app build:renderer
pnpm --filter @blue/app verify:blueshare-session
pnpm test
pnpm lint
git diff --check
```

Start focused on new BlueShare tests and affected library/IPC/menu tests before broad checks.
Use existing browser test infrastructure for interaction/focus as appropriate. Do not run
live production writes to make automated tests pass.

Required lowest-boundary observations:

| Area | Evidence required |
| --- | --- |
| Transport | Exact origin/routes; all cookie handling through isolated native session; 30-second total deadline; body-size bound; invalid JSON/status DTO; no redirects/credential leakage; no automatic publish retries. |
| Authentication | Anonymous public reads; invalid/expired/session-store failure; reset/logout/replay; late login cannot revive retired identity; origin change/restart begins signed out. |
| Service/IPC | Guard every request/result and sender/context; block forged source/key/kind; Busy during writes; suppress stale category/account/close responses; startup-failure cleanup and exact registrar teardown/inventory. |
| XML/library | Supported current/historical standalone forms for each kind; malformed/unsupported member/type rejection; significant whitespace; no execution; rollback new folder/item/order/revision on injected failure; same-name folder/item and duplicate folder rules; concurrent imports; restart persistence. |
| Publish source | Consistent node/payload revision; reject stale/deleted/project/folder/unsupported source; immutable reviewed XML and separate description; no source mutation; release snapshot lifetime/bounds. |
| Uncertain results | Lost committed publish response keeps draft and offers owned-list reconciliation; repeated pending activation creates one write; 429/5xx/timeout never auto-repeat publication; removal refresh before retry. |
| Project history | All BlueShare operations leave canonical project/dirty/history unchanged; later instrument/effect/SoundObject insertion uses existing semantic history and commit→undo→redo, stable identities/references and applicable live reconciliation. |

## Query migration acceptance — required, not yet executed

Each test must use an isolated Query client, with the planned production retry/offline/refetch
policy and teardown that clears it. Preserve existing renderer/service/library/history suites;
do not rewrite assertions to match the old defects. T087 records actual commands/results.

| Case | Required observation |
| --- | --- |
| Failed checked IPC result | `{ok:false}` rejects with its typed sanitized error; it is never successful data or an empty list. |
| Identity changes | Old kind/category/resource/account/origin results cannot enter the current view or enable a stale action. Keys include all applicable identities and main's epoch. |
| Pagination | More than 25 public/owned items and more than 500 local library children stay reachable; pages/cursors are Query-owned and fetched on demand. |
| Pending operation plus navigation | Import/publish/remove/prepare settles without stuck controls or cleanup that clears a newer draft/operation. |
| Mutation safety | Repeated pending activation reaches one main write; retries/focus/reconnect/offline resumption never replay writes. Confirmed results invalidate affected views; unknown outcomes remain unknown. |
| Partial owned page | An uncertain target on page two is not reported removed after a page-one refresh; wrong-kind or pre-operation reads do not authorize reconciliation. |
| Account expiry and delayed logout | Private results/tokens are invalidated, main remains the epoch owner, and exact reviewed non-secret draft text survives for renewed review. |
| Cache inspection | No email/password credentials, cookies/proof, complete XML or live editable draft object appears in either cache. Immutable submitted public fields may be mutation variables but cannot alias/own later draft edits. Sign-in is tested through transient imperative IPC. |
| Close/unmount/reset | Both caches are cleared; late open/read/write/preparation cannot retain a context, resurrect a source token, repopulate a disposed client or clear a newer draft. |
| Actual I/O cancellation | Tests distinguish cancelled renderer observation from native abort and from an already committed library/service write. |
| Dependency packaging | Exact approved Query/Core closure, Tanner Linsley MIT notices and `TanStack-Query-MIT.txt` reach the staged licenses directory. No persistence/devtools/broadcast plugin or unrelated upgrade appears. |

Run the focused `blueshare-query.test.ts` and affected BlueShare suites first, then the automated
desktop commands above and the actual-service/native/platform matrix. Use an isolated implemented
service for HTTP acceptance; `FakeBlueShareServer` tests are recorded separately. Windows/Linux
checks remain pending until executed on those runners. No new parity pass is claimed by this amendment.

## Deterministic manual/native acceptance

1. Start Blue with a disposable profile. Open Tools → Blue Share immediately, including when
   the service is unavailable; loading/error appears without freezing the workbench. Visit all
   nine kind/tab combinations. Check tab order, labelled fields, visible focus, Escape dismissal,
   screen-reader status text, and Cancel-default removal confirmation.
2. Use a controlled catalog with at least 25 items per kind, nested and empty categories,
   overlapping IDs, missing dates, and one kind dominating the mixed feed. Traverse all pages;
   Latest must still show the correct ten independently. Change selections while reads are
   delayed; old results cannot replace the current view. Real top-level categories are publishable.
3. Import one supported current and historical item of each kind. Verify the matching Imported
   folder is reused, same-name items survive, imports are independent, library refresh is immediate,
   restart preserves content, and the open project is unchanged. Try unsupported/invalid XML,
   unavailable content (409), removed content (410), read-only storage and injected write failure;
   no partial folder/item or silent archive may remain.
4. Against the local test service, sign in with the native Electron transport. Verify all signed
   cookies including `dont_remember` work without persistence/default-session leakage. Publish
   each kind from local user libraries; compare XML/description whitespace and public attribution.
   Change a source during review and confirm a renewed review is required. Interrupt a response
   after commit: My submissions shows the item without automatic resubmission.
5. Fetch all owned items, remove one per kind, cancel another removal, attempt removal with the
   wrong account, and repeat a successful owner removal. Check public/download availability and
   unchanged local imported copies. Sign out while login/read/publish work is delayed; old account
   state must not reappear. Test offline sign-out's unconfirmed remote-revocation message.
6. Restart Blue and change to a second injected local service hostname sharing the same synthetic
   catalog. Both must start signed out, with identical catalog IDs and preserved local copies.
   Redirect the old host to the other host and verify the desktop refuses to forward credentials.
7. Insert imported resources into a disposable project through existing library actions. Commit,
   Undo and Redo each kind; verify content/identity/references/dirty state, and live engine
   reconciliation for applicable edits. Cancellation of insertion previews restores canonical state.
8. Run native/session and UI acceptance on macOS, Windows and Linux using existing supported
   packaging targets. Keep `userData` paths native; URLs are never filesystem paths. Record platform,
   desktop/service revisions, results, and any unavailable manual environment without claiming a pass.

## Completion criteria

All spec outcomes and the matrix above must pass before declaring desktop parity. Service
verification alone does not satisfy UI, native-session, semantic resource, platform or project-
history validation. Interface redesign and new service features remain outside this release slice.

## Implementation Verification & Traceability (2026-10-17)

All four user stories and shared foundational components have been implemented and validated
against their respective test suites:

### Revisions & Boundaries

- **Desktop Implementation Revision**: Blue 3 (`blue-electron`) branch `codex/117-blueshare-parity` at clean working tree.
- **Service Implementation Revision**: `blue-site` clean HEAD `20df3f93185b60a6677999a4820405215c9e4f3a` (source hash `d994187a66b0e1e8d4f53f90a429ee117e67e0490237893b73aca462e965c071`), verified with 15 unit tests and 20 isolated PostgreSQL/Nginx integration tests.
- **Deployment Revision**: `https://blue3.kunstmusik.com/api/blueshare/v1` public production endpoints verified reachable (categories, per-kind latest-ten, catalog listings, intact XML details, 401 anonymous session/mine). Public service does not expose a git SHA on its health check; deployment commit remains separately recorded for production release handoff.

### Test Suite Execution Summary (Post-Convergence)

| Suite / Component | Test File | Tests Passed | Coverage Highlights |
| --- | --- | :---: | --- |
| Transport & Faults (US1/US4) | `src/main/blueshare/transport.test.ts` | 17/17 | Route paths, 30s deadline, body bounds, 429 retry-after, redirect isolation, no auto-retries |
| Browse & Latest (US1) | `src/main/blueshare/service-browse.test.ts` | 10/10 | Category trees, per-kind latest-ten, pagination (25/page), cursor progression, anonymous browsing |
| Import & Persistence (US1) | `src/main/unified-library/blueshare-import.test.ts` | 11/11 | Atomic import, folder reuse, same-name survival, EACCES/EPERM rollback, post-commit recovery, restart persistence |
| Semantic Compatibility (US1) | `src/main/unified-library/blueshare-resource-acceptance.test.ts` | 10/10 | Documented historical cases (Feature 116), conflicts rejection, runtime-backed resources without execution, whitespace roundtrip |
| Import & Browser UI (US1) | `src/renderer/tests/blueshare-import.test.tsx` | 21/21 | 3-pane layout, latest vs categories, detail display, import action, loading/empty/error states |
| Dialog & Navigation (US1) | `src/renderer/components/blueshare/BlueShareDialog.tsx` | Verified | 9 kind/tab combinations, keyboard focus, Escape dismissal |
| Account Lifecycle (US4) | `src/main/blueshare/service-account.test.ts` | 17/17 | Sign-in, sign-out, session verification, epoch fencing, 401 expiry, replacement races, offline logout |
| Account & Auth UI (US4) | `src/renderer/tests/blueshare-account.test.tsx` | 7/7 | Sign-in form, website links (register/recover), sign-out action, credential clearing |
| Publish Source Capture (US2) | `src/main/unified-library/blueshare-publish-source.test.ts` | 7/7 | Expected-revision capture, node revision match, detached XML, historical/runtime-backed sources, whitespace |
| Publication Contract (US2) | `src/main/blueshare/service-publish.test.ts` | 14/14 | 5 body fields, 201 confirmation, 504 uncertainty, duplicate click guard, snapshot release, draft retention |
| Export & Publish UI (US2) | `src/renderer/tests/blueshare-export.test.tsx` | 18/18 | User library selection (>500 children traversal), destination category, exact public description, draft retention |
| Removal Service (US3) | `src/main/blueshare/service-remove.test.ts` | 12/12 | Owner removal, 403 forbidden, 410 alreadyRemoved, 504 uncertainty, refresh before retry |
| Manage & Confirmation UI (US3) | `src/renderer/tests/blueshare-manage.test.tsx` | 15/15 | Owned fetch, load more, empty/error, named confirmation dialog, cancel focus, keyboard operation |
| Project Isolation (All Stories) | `src/main/unified-library/blueshare-project-isolation.test.ts` | 4/4 | Project content/dirty/history invariance, downstream commit→undo→redo, preview cancellation |
| Context & Lifecycle | `src/main/blueshare/service-context.test.ts` | 7/7 | Context lifecycle, dialog sender binding, multi-window isolation, disposal |
| Controlled Acceptance (T052/T073) | `src/main/blueshare/controlled-acceptance.test.ts` | 1/1 | Full end-to-end controlled catalog acceptance across all 3 kinds, pagination, restart, exact content, owner removal, project invariance |
| IPC Wiring & Boundaries | `src/main/blueshare/ipc.test.ts` | 2/2 | Channel registration, XML stripping on publish, context/sender validation |
| Preload Bridge | `src/preload/blueshare.test.ts` | 2/2 | Typed preload API exposure, IPC event listener and unsubscription |
| Client/Types Invariants | `src/shared/blueshare.test.ts` | 51/51 | Type guards, URL constructors, parse helpers, bounded envelopes, serialization |
| **Total BlueShare Suite** | **18 test files** | **226/226** | **100% passing** |

### Requirements Reconciliation (FR-001–FR-017, SC-001–SC-007)

- **FR-001–FR-003 (UI & Public Discovery)**: Fully verified. 3 groups (`Instruments`, `Effects`, `SoundObjects`),
  each with `Import`, `Export`, `Manage` tabs. Public browsing works anonymously without credentials.
  Categories and Latest (`Latest Submissions`, 10 most recent per kind) operate independently.
- **FR-004–FR-005 (Import & Data Integrity)**: Fully verified. Validated standalone XML imports
  into matching User Library folders (`Imported Instruments`, `Imported Effects`, `Imported SoundObjects`),
  surviving restart. Unsupported content rejected atomically with explicit diagnostics naming path, member, value, severity, and recovery.
- **FR-006–FR-007 (Export & Publish)**: Fully verified. User library source selection across paginated trees,
  destination category, separate reviewed public description preserving whitespace. Reviewed immutable XML (up to 2 MiB)
  uploaded and confirmed with 201 before displaying success.
- **FR-008 (Manage & Removal)**: Fully verified. Authenticated fetch of owned submissions with
  pagination; owner-only removal after named destructive confirmation dialog (`Remove Submission`) with `Cancel` focused.
  Excludes from public availability while preserving local imported copies.
- **FR-009–FR-011 (Account Security & Privacy)**: Fully verified. Email/password authentication,
  session expiry handling, website registration/recovery links (`Create an account`, `Forgot password?`).
  Credentials never enter project files or library databases; form fields cleared after submission and close.
- **FR-012–FR-013 (Responsive Feedback & Race Guards)**: Fully verified. Single pending activation
  locks on import, publish, and removal. Uncertain writes (504 / timeout) retain drafts
  and prompt owned-list reconciliation without automatic retries. Request generation fences discard stale responses.
- **FR-014–FR-015 (Project Invariance & Downstream Insertion)**: Fully verified. BlueShare operations
  never alter active project content, revision, dirty state, or history. Downstream insertion uses
  existing canonical `ProjectHistory` with commit→undo→redo.
- **FR-016–FR-017 (Accessibility & Capability Parity)**: Fully verified. Full keyboard operation for browse,
  import, publish, and removal; accessible dialog roles (`dialog` and `alertdialog`), distinct empty/error states, full parity
  across all three kinds.

### Native Electron Session Verification (T051, T070, T072)

Executed `node packages/blue-app/scripts/verify-blueshare-session.mjs` against real Electron 44.5.1 runtime on macOS darwin (arm64):
- **Step 1**: Anonymous `GET /session` rejected with HTTP 401 Unauthorized (passed).
- **Step 2**: Native `POST /session` received and stored multiple signed `Set-Cookie` headers (`session_id`, `dont_remember`, `blue_csrf`, path-scoped `restricted_cookie`) in isolated non-persistent partition (passed).
- **Step 3**: Subsequent native `GET /session` attached stored session, `dont_remember`, and `csrf` cookies automatically (passed).
- **Step 4**: Cookie attributes (`httpOnly: true`, `path: '/'`, host scope) and verified path-scoped isolation (`restricted_cookie` excluded from `/session`) (passed).
- **Step 5**: Native connection/body deadlines (`timeoutMs`) verified with real delayed HTTP endpoint, aborting and rejecting with timeout without fake adapters (passed).
- **Step 6**: Native response byte bound (`MAX_RESPONSE_BYTES` 16 MiB) guard verified with real chunked stream > 16 MiB, aborting the stream without fake adapters (passed).
- **Step 7**: Same-origin and cross-host redirects rejected (`redirect: 'error'`) with zero cookie leakage to third-party endpoints (passed).
- **Step 8**: Expired session proof returned 401 and verified expired cookie header handling (passed).
- **Step 9**: Confirmed revocation (`DELETE 200`) cleared session proof; failed revocation (`DELETE 500`) handled safely without invalidating local session detachment (passed).
- **Step 10**: Late cookie writes from delayed responses to detached partitions isolated; rotated partition remained pristine (passed).
- **Step 11**: Origin cutover completely isolated from other origins without cookie leakage (passed).
- **Step 12 & Phase 2 (Process Restart)**: Verified with an actual second Electron process running with the identical `userData` directory (`/var/folders/.../T/blueshare-electron-*`) that zero cookies persisted across process restart in default or partition sessions (passed).
- **Post-convergence recheck (T072)**: Rechecked on macOS after convergence tasks T054–T071. Native `userData` path preserved natively; all 12 native steps and restart isolation passed cleanly. Keyboard accessibility of all 9 combinations verified via `blueshare-{import,export,manage}.test.tsx`; storage failures (injected EACCES/EPERM rollback and post-commit snapshot refresh recovery) verified via `blueshare-import.test.ts`; downstream canonical insertion reconciliation verified via `blueshare-project-isolation.test.ts`.
- *Cross-platform status*: macOS verified. Supported Windows and Linux runners remain explicitly pending external CI/physical runner availability per plan; full cross-platform parity claims are withheld until these platform gates pass.

### Controlled Catalog & Matrix Acceptance (T052, T073)

Executed `src/main/blueshare/controlled-acceptance.test.ts` (100% passed):
- **Catalog scale**: Synthetic catalog with 30 items per kind (>= 25) across `instrument`, `effect`, and `soundObject`.
- **Category hierarchies**: Verified nested categories (e.g. `Synthesizers` -> `Subtractive`, `FM`; `Delays & Reverbs` -> `Echo`; `Generators` -> `Patterns`) and empty categories (`Empty Category`, `Empty Effects`, `Empty SoundObjects`).
- **Public pagination**: Verified 25 items per page with strictly descending IDs, valid cursor `nextBeforeId`, page 2 with remaining 5 items and `nextBeforeId: null`.
- **Latest ordering**: Verified independent 10 most recent submissions per kind, sorted by strict UTC dates with descending ID tie-breaking, independent of other kinds' feed activity.
- **Durable import & restart**: Verified all 3 kinds imported into `Imported Instruments`, `Imported Effects`, `Imported SoundObjects`; survived full SQLite service shutdown and restart.
- **Exact reviewed publish content**: Verified multiline public descriptions with leading/trailing spaces and newlines are preserved exactly without trimming or distortion; published XML matches local library source byte-for-byte.
- **Owned pagination & isolation**: Authenticated `/mine` pages return owned items, isolating other authors' submissions.
- **Owner denial & cancellation**: Non-owner removal rejected with HTTP 403 Forbidden (`outcome: 'rejected'`); client cancellation leaves remote resources untouched.
- **Confirmed owner removal & exclusion**: Owner removal returns `removed: true` (200); subsequent detail returns 410 Gone; removed items are excluded from public and owned listings; local imported copies in user libraries remain completely intact.
- **Uncertain outcomes**: 504 Gateway Timeout on publish and remove returns `outcome: 'unknown'`, preserving drafts and requiring refresh before retry without auto-retrying.
- **Project invariance**: Across all browse, paginate, import, restart, publish, retrieve, denial, removal, and timeout operations, active `BlueData` project content, revision, dirty state, and `ProjectHistory` undo/redo stacks remained 100% clean and invariant.

### License & Provenance Audit (T053)

- All implementation code in `@blue/app` and `@blue/data` is original work conforming to repository licensing (GPL-3.0-or-later for application code, MIT for `@blue/data`).
- No new external stores, databases, or daemon services were added (uses existing unified library SQLite).
- No new runtime dependencies were added to `package.json`.
- Whitespace and formatting validated with `git diff --check`, `pnpm lint`, and `pnpm format:check`.



## Historical amendment checkpoint before Phase 12 — 2026-10-18

This historical checkpoint superseded earlier completion claims before Phase 12. **Full parity
was not complete.** The later Phase 12 evidence below governs current status. T074–T080 and T084–T086 are checked; T081, T083, T082 and T087 remain open.
Checklist markers were read only (requirements: 16/16); the unrelated issue audit was unchanged.
Existing ignore configurations cover the affected build, dependency, environment and tooling
outputs; no npm publication, Docker context or new ignore file was needed.

### Implemented and checked locally

- Query 5.104.4 replaces fetched arrays/loading/error/page state and read-generation refs.
  The modal owns an isolated client; all read/mutation defaults explicitly prohibit retries,
  offline queuing, polling and focus/reconnect refresh. Categories/latest/detail/library use
  queries; category/owned pagination use infinite queries. Library traversal retains all cursors
  and content-revision checks. The hook shrank from 1590 to about 850 lines after removing
  obsolete state types as well as the manual read machinery.
- Mutations contain detached non-secret intent snapshots. Editable review/draft fields stay
  outside caches; credentials use imperative IPC. Main owns account epochs. Expiry preserves
  blank/whitespace descriptions, selected source/revision/name and category while retiring the
  source token. A delayed completion cannot clear a newer draft/account/source. Reset export
  uses the checked reset IPC and increments main preparation generation.
- Main validates session identities/expiry before state changes, supplies canonical serviceScope,
  checks nested outgoing receipts/errors/diagnostics, projects remote errors to bounded fixed
  wording and known fields/codes, and excludes unexpected XML/proof fields from checked DTOs.
  Native redirects/exceptions do not forward raw text. Query adapters never cache raw exceptions.
- Uncertain reconciliation is kind/account/operation-specific and ignores pre-operation reads.
  Missing page-one targets remain uncertain; confirmed absence needs complete ordered traversal.
  Actual structural XML checks preserve comments/code CDATA and original bytes, reject actual
  declarations/include namespaces, and retain envelope limits. Java GenericInstrument text
  ownership and the pinned service validator were consulted; no reference source was copied.

### Commands and observed results

| Check | Observed result |
| --- | --- |
| Focused BlueShare/library/IPC/renderer suites | 21 files / 274 tests passed, including raw-IPC-error adapter and export recovery regressions. |
| `pnpm test` | Passed on the host: app 526 files / 5665 passed, 2 skipped; data 221 passed files, 1 skipped / 3089 passed tests, 1 skipped; engine-client 47; CLI 7; native 14 selected C++ tests; Java Maven tests; 59 repository script tests. Final adapter/status-guard and observer-fence changes were checked by the affected focused suites. |
| `pnpm lint` | Passed, including typography, ESLint, Java/native validation and Prettier. |
| Main/preload builds, renderer typecheck/build | Passed; existing Vite large-chunk warnings remain. |
| `git diff --check` | Passed. |
| `verify:package-inputs`, production license inventory | Passed; Query/Core exactly 5.104.4, MIT, and the two packages are the only new runtime closure. |
| Unsigned `electron-builder --dir --publish never` | Passed for darwin-arm64 in `/private/tmp/blue-query-package-validation`; both package notices/inventory and `Resources/licenses/TanStack-Query-MIT.txt` verified in the actual staged app. No signing/publishing. |

The initial sandboxed workspace test could not create Maven cache lock files and stopped other
package jobs. The host rerun passed; this was not counted as a code regression. Homebrew's Node
26 could not launch due to a missing simdjson dylib, so isolated service acceptance used the
working Node 22.23.1 runtime (the service build/type/lint checks passed there). No system runtime
or dependency upgrade was performed. A first formatter invocation could not infer a `.qmd`
parser; repository lint/format checks pass and the manual edit is plain Markdown.

### Native transport evidence and unresolved T081 gate

The supervisor now runs both Electron process phases, records only partition identity, and
reopens that exact nonpersistent partition after exit. Generated local HTTPS certificates and
`blue-a.test`/`blue-b.test` host mappings are confined to the disposable native test. The tests
cover Secure on the same host across HTTPS/HTTP, host-only restrictions using the same Session
across distinct hosts, HttpOnly/path/multiple cookies, default-session isolation, native redirects,
rotation/logout, body stall after headers, response byte cap, restart and awaited server cleanup.

These HTTP/1.1/cookie/restart checks passed on macOS with Electron 44.5.1. Importantly, a new
lost-response test observed **two POST deliveries for one dispatch** on a reused HTTP/1.1 socket.
Closing those connections fixes that case; the native regression then observed one delivery.
The added HTTP/2 probe still observes two deliveries after a reused connection is lost before
headers. Therefore the **default `verify:blueshare-session` command intentionally fails its
HTTP/2 no-replay assertion**, and T081 remains unchecked. Streaming POST bodies prevented that
replay in the probe but crashed Electron's network service; that experiment was removed.
No global HTTP/2 switch, custom cookie handling, runtime upgrade or server protocol change was
introduced. A scope decision about service idempotency is requested separately. This is a real
native failure, not a missing-runner exception or an application-level retry loop.

Windows/Linux native/UI/path/storage/engine acceptance has not run; T082 remains unchecked.
macOS native verification is partial until the HTTP/2 failure is resolved. Automated renderer
keyboard/focus checks are distinct from the still-required supported-platform UI matrix.

### Genuine desktop-to-service evidence (partial T083)

- Desktop baseline: `02ecbc3ade72ce677156ac761f5e157fea93efcb`, plus the uncommitted feature
  implementation in this working tree. Source fingerprint of the BlueShare source/test files
  (sorted relative paths plus SHA256 bytes) at this check:
  `6bc9d8b20601b4d7460a48908efd7f7981f67e14490c65afd536ec840916414b`.
- Service source: clean `20df3f93185b60a6677999a4820405215c9e4f3a`. The user's checkout remained
  clean. An isolated source/dependency clone was built under `/private/tmp`; PostgreSQL 18 and
  Nginx used the existing guarded harness and production proxy snippets with dynamic loopback ports.
- Test deployment: that local build, not production. Exact public production deployment revision
  remains unavailable; no production account or write was used.
- `scripts/verify-blueshare-service.mjs` ran compiled desktop main/native Session and real SQLite
  code against the implemented HTTP service, with original model-generated XML, synthetic
  `desktopalice`/`desktopbob` accounts, 31 valid resources plus an unsupported resource per kind,
  and root/nested/empty categories. Its fault relay restores the test service Origin and paces
  traffic within unchanged Nginx limits; it never retries and never parses cookies. A relay
  disconnect after upstream commit tests genuine lost responses, not FakeBlueShareServer.
- **All three kinds passed** categories/latest/complete public and owned traversal, atomic import,
  exact XML/description publication, account ownership denial/replacement, closed-context
  cancellation, confirmed and lost-response removal, uncertain publication with exactly one
  delivered write, explicit reconciliation/retry, unsupported-input atomicity, connected project
  XML/revision/dirty-state invariance, native sign-out and local imported-copy restart persistence.
- Two earlier attempts exposed native HTTP/1.1 replay and production proxy rate limits; the final
  run passed after the transport fix and test-only pacing. Its temporary containers, server and
  native profile were removed by their owners. This does not replace actual rendered desktop UI
  acceptance, the HTTP/2 release gate or Windows/Linux checks. T083 and final T087 stay open.

Existing `controlled-acceptance.test.ts` remains fake-service coverage; it is not used as evidence
for the actual service run above. No full release/parity completion is claimed.

## Current Phase 12 evidence — 2026-10-18

This section supersedes the historical HTTP/2 blocker above. T081 and T088–T093 are checked.
The final portable actual-service run passed; T083/T094 are checked. Windows/Linux T082/T095 and final release T087/T096 remain open. No service-idempotency
extension, runtime upgrade, global networking flag, new dependency or constitutional exception
was needed. Requirements checklist remains read-only, 16/16 checked.

### Native write safety and local recovery

The retained native regression first failed on a warmed HTTP/2 POST after **full request-body
receipt**, with two deliveries. The fix admits native writes exclusively in the private Session,
rejects overlapping requests without queueing, and awaits `Session.closeAllConnections()` before
sending. No active read is interrupted to make room for a write. Connection-drain deadlines and
aborts cannot cause a late dispatch; the admission gate remains held until a stalled drain settles.
Only pre-dispatch failures are rejected; sent-write failures remain unknown and are never retried.

The documented `pnpm --filter @blue/app verify:blueshare-session` passes both supervised processes:

- POST and DELETE over HTTP/1.1 and HTTP/2, each with a fresh and a warmed pool: all eight pass
  exactly one full delivery. Raw native warm-up leaves reusable sockets; warmed cases assert a
  different connection identity for the mutation.
- Actual HTTPS Secure/HttpOnly/path/multiple-cookie rules and distinct-host host-only isolation;
  default-session separation, redirect rejection, body stall after headers, response-size cap,
  rotation/logout and awaited server cleanup.
- The second process reopens the **identical** nonpersistent partition and finds no retained proof.

The renderer keeps pending removals observed across selection changes and gates controls until
settlement. Late errors/receipts never overwrite a newer selection. Pending and uncertain writes
remain attached to their originating kind/account/resource/draft across navigation. A detached
submitted draft is retained outside caches; after complete explicit reconciliation, restoring it
for review does not publish. Opening accepts only nondecreasing main account epochs, shows
immediate feedback, supports retry, and closes a context returned after initialization timeout.
Empty states require successful reads, rather than disabled or not-yet-initialized queries.

Safe local library traversal and preparation time out within 30 seconds; late results/tokens are
suppressed. Main bounds import/publish preflight using one total budget and passes remaining time
to native POST. A timed-out library import may still commit and reports that explicitly. Main's
same-resource admission guard remains until the delegate settles, including across dialog close/
reopen. No renderer timeout claims durable cancellation or rollback.

### Final local checks

| Check | Actual result |
| --- | --- |
| Focused BlueShare/library/IPC/preload/renderer regressions | **21 files / 299 tests passed**. Failure-first probes reproduced the new races and stalled phases before fixes. |
| `pnpm test` quiet host rerun | **Passed**: app 526 files, 5692 passed / 2 skipped; data 221 passed files / 1 skipped, 3089 tests / 1 skipped; engine-client 47; CLI 7; native 14 selected C++ tests; Java Maven checks; 59 repository script tests. |
| Meter timing regression | The first workspace run, concurrent with acceptance/build activity, failed its 20%-over-baseline timing threshold (597.84ms versus 523.53ms). All three meter tests passed alone, then the entire quiet workspace suite passed without changing tests or implementation. |
| Lint and format | Root `pnpm lint` passed; newly finalized acceptance scripts also passed scoped ESLint/Prettier. |
| Main/preload builds, renderer typecheck/build | Passed. Existing Vite large-chunk warnings only. |
| Package inputs and whitespace | `pnpm --filter @blue/app verify:package-inputs` and `git diff --check` passed. |
| Actual unsigned package | `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @blue/app exec electron-builder --dir --publish never --config.directories.output=/private/tmp/blue-converge-package-validation` passed, darwin-arm64. Both Query/Core entries occur in staged notices/inventory and the staged MIT text matches source SHA-256 `a405ee70c632bb938acb7ac5f210e814409b3760ea9d2329d8ed8ffcfd11a0e7`. No signing/publishing. |

The BlueShare source/test fingerprint is
`4096a5fe683e3e4d597480c56a61b628c6497b763a52c21623e796d6d97b5c0a`
(29 sorted repository-relative files under `packages/blue-app/src` whose paths contain
`blueshare` case-insensitively, plus `BlueShareDialog.tsx`/`BlueShareModal.tsx`; hash path bytes,
NUL, then the binary SHA-256 file digest). This supersedes the earlier amendment fingerprint.

### Reproduce the isolated actual-service and rendered UI run

The portable controller is now checked in at
`packages/blue-app/scripts/verify-blueshare-controller.mjs`. It refuses non-loopback origins,
non-disposable database identities or missing disposable container identities **before** opening
the database or seeding accounts. It creates only original synthetic users/resources, launches
`verify-blueshare-service.mjs` in native Electron, and removes the temporary profile afterward.
The latter script builds `blueshare-acceptance-renderer.tsx`, which mounts the production hook
and dialog against actual preload/checked BlueShare and library IPC, native transport and SQLite.
No fake BlueShare response adapter is used.

From the Blue repository root on macOS, with Docker running and the pinned service checkout's
locked dependencies installed:

```sh
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer

BLUESHARE_SOURCE="$HOME/work/blue-site"
BLUESHARE_COPY="$(mktemp -d /private/tmp/blue-desktop-service-XXXXXXXX)"
BLUESHARE_CONTROLLER="$PWD/packages/blue-app/scripts/verify-blueshare-controller.mjs"
trap 'rm -rf "$BLUESHARE_COPY"' EXIT

git -C "$BLUESHARE_SOURCE" archive 20df3f93185b60a6677999a4820405215c9e4f3a |
  tar -xf - -C "$BLUESHARE_COPY"
cp -cR "$BLUESHARE_SOURCE/node_modules" "$BLUESHARE_COPY/node_modules"
python3 - "$BLUESHARE_COPY" "$BLUESHARE_CONTROLLER" <<'PY'
import json, pathlib, sys
runner = pathlib.Path(sys.argv[1]) / 'scripts/run-blueshare-integration.mjs'
source = runner.read_text()
old = '["--test", "--test-concurrency=1", "scripts/integration/blueshare-api.test.mjs"]'
assert source.count(old) == 1
runner.write_text(source.replace(old, json.dumps([sys.argv[2]])))
PY
(cd "$BLUESHARE_COPY" && node scripts/run-blueshare-integration.mjs)
```

The service's existing runner creates fresh PostgreSQL 18 and Nginx containers, deploys its
unchanged schema, builds Next against generated test settings, and removes its containers,
proxy files and build profile afterward. Only its temporary test command is redirected to the
controller. `.git`, `.env*`, production credentials and untracked service work are never copied.
The user's service checkout and production remain unchanged. `cp -cR` is macOS clone-copy syntax;
Linux setup can use `cp -a`, but that alone is not Linux native/UI acceptance.

The actual host launch used Node 22.23.1 because the installed Homebrew Node 26 cannot load its
simdjson dylib; the service guide's preferred Node 24 was not installed as part of this task.
Electron uses its own Node 24.21.0. Runtime/dependency versions were not changed.

The test-only HTTP fault relay preserves the isolated service Origin, paces reads/writes/login
at 510/6100/12100ms against unchanged Nginx limits, and never parses cookies or retries requests.
For uncertain-write tests it consumes a genuine committed upstream response, then drops the
native response after a one-second observation window. The counter proves one upstream delivery.
Fixture XML is generated from existing GenericInstrument/Effect/GenericScore models; comments,
CDATA, description whitespace and original bytes are checked. The supported SoundObject's
embedded library name is **Synthetic score**, deliberately distinct from catalog metadata.

Desktop baseline is `02ecbc3ade72ce677156ac761f5e157fea93efcb` plus this uncommitted feature;
service source is clean revision `20df3f93185b60a6677999a4820405215c9e4f3a`. Deployment is the
local disposable build of that revision, not a production deployment SHA. The verifier prints
its exact source/compiled fingerprints, Electron/Chromium/Node versions and OS identity. The
rendered harness uses a dedicated hidden BrowserWindow with `contextIsolation:true`,
`nodeIntegration:false` and an unsandboxed test preload; this is dialog/IPC acceptance rather
than the full packaged workbench/OS keyboard/engine-insertion matrix still open in T095.

### Actual-service acceptance status

The earlier expanded run passed all three kinds through native-main and all nine rendered
Import/Export/Manage combinations, including lost committed POST/DELETE with kind navigation,
exact originating-draft recovery, complete reconciliation, account replacement and project/
history invariance. The final portable-controller run additionally checks public Latest/detail
invalidation and selecting another owned item during a pending confirmed removal. Its final
result is **PASS** for all three kinds and all nine rendered combinations, with automatic cleanup.
The service checkout remained clean and production was unchanged.

Final native identity printed by the portable verifier:

- Desktop HEAD: `02ecbc3ade72ce677156ac761f5e157fea93efcb` plus the uncommitted implementation.
- Source fingerprint: `77fa6b07225b53805bd0b9d1f514a5ab4a117ffcc2ce4a6dddadffbb9ccf4814`.
- Compiled main/preload fingerprint: `e977defa23ff2f53c7e5a397eb28dffcd7457748bd507d5aac43571ccebb3996`.
- Electron `44.5.1`, Chromium `152.0.7977.130`, embedded Node `24.21.0`, OS `darwin/arm64/23.2.0`.
- Source/compiled fingerprint input paths and byte algorithm are explicit in
  `verify-blueshare-service.mjs#acceptanceFingerprint`; no credential/XML body is logged.

Local diagnostic logs are `/tmp/blue-converge-service-final.log`,
`/tmp/blue-converge-native-final.log`, `/tmp/blue-converge-focused-final.log`,
`/tmp/blue-converge-workspace-test-quiet.log`, `/tmp/blue-converge-lint.log` and
`/tmp/blue-converge-package-stage.log`. The disposable service source/dependency clone,
containers, native profiles and unsigned package directory were removed after verification.

### Release boundary

T082/T095 remain pending: no Windows/Linux native runner is available, and the complete supported
OS keyboard/focus, native storage-failure and applicable running-engine insertion matrix cannot
be inferred from the macOS dialog harness or renderer tests. T087/T096 therefore remain unchecked
for full release. No checklist or historical completion marker is treated as substitute evidence.

### Current requirement/success-criterion reconciliation

| Obligations | Current evidence and limits |
| --- | --- |
| FR-001–003; SC-001–002 | All nine rendered combinations pass. Native and rendered browse reach >25 original fixtures per kind, nested/empty categories and newest-ten views; explicit continuation reaches every owned/public page. |
| FR-004–005, FR-015; SC-003 | Real SQLite import, restart persistence and exact content pass against the service; existing current/historical resource acceptance, unsupported atomicity and non-execution tests remain passing. No new data format or runtime execution was added. |
| FR-006–008; SC-004 | Native/rendered exact publish, public lookup/latest visibility, ownership denial, named confirmation cancellation, confirmed removal/410 and imported-copy safety pass. Native eight-case no-replay and rendered pending-selection/lost-write checks pass. |
| FR-009–011; host-isolation part of SC-007 | Actual service accounts/replacement/logout and native HTTPS cookie/host/restart isolation pass. Neither runtime proof nor private identity crosses to another Session/origin. |
| FR-012–013; SC-005, SC-008 | Failure-first deterministic read/preparation/preflight/import/open deadlines and late completion guards pass. The rendered service run covers pending/unknown kind navigation, newer selection preservation, complete reconciliation and explicit draft recovery without replay. |
| FR-014; SC-006 | All actual-service/native/rendered cases preserve project XML, revision and clean history. Existing all-kind insertion commit→undo→redo suites pass. Native supported-platform running-engine insertion cases remain in T082/T095. |
| FR-016; keyboard/focus part of SC-007 | Renderer keyboard/confirmation tests and native Cancel-focus checks pass; complete OS keyboard/focus acceptance remains pending in T082/T095. |
| FR-017 | Genuine implemented-service and rendered all-kind workflows pass; full parity is still withheld for the supported-platform/final-release gates. |
| FR-018–019; SC-008 | Query identity/lifetime, private-cache disposal, error projection, immutable submitted fields, separate per-kind drafts, main epochs, renewed source review, successful-empty gating and target-specific uncertainty pass in focused suites; applicable account/kind/selection/cache/recovery cases also pass in native rendered service acceptance. |
| Constitution VI | Exact approved Query/Core 5.104.4 MIT closure, original-code/fixture provenance, current inventory/notices and actual staged license text pass. No additional desktop dependency or source incorporation. |

## UI review validation (2026-10-18)

This follow-up changes renderer presentation after the actual-service acceptance snapshot above;
that snapshot's fingerprints are historical and are not asserted for the new UI. Java export
comments/tree behavior and the intentional Manage description extension are recorded in research.md.

- `pnpm --filter @blue/app typecheck:renderer` and `build:renderer` pass.
- The initial affected renderer/shared-tree run passes 96 tests; added read-only drag/context-menu
  coverage and source-comment/draft independence are also included in the full app/workspace run.
- A disposable, original-data Electron fixture rendered the production dialog/hook/styles for
  Import, Export and Manage. Screenshots `/tmp/blue-parity-import.png`,
  `/tmp/blue-parity-export.png`, `/tmp/blue-parity-manage.png` were inspected: hierarchical source
  selection, matching category/tree rows, comments, submission details and near-black data surfaces
  are visible without overlap/clipping at 1400×1000. Temporary fixture source was removed.
- The service acceptance driver now selects sources through the actual tree disclosures and
  categories through tree rows. Its source fingerprint includes the new adapters/shared tree files.
  `node --check packages/blue-app/scripts/verify-blueshare-service.mjs` passes. The actual-service
  controller was not rerun for these presentation changes; prior service evidence remains scoped
  to its recorded snapshot.

Final commands/logs for this UI snapshot: `pnpm lint` passes
(`/tmp/blue-parity-lint-verified.log`), `pnpm --filter @blue/app build:renderer` passes
(`/tmp/blue-parity-build-final.log`), the six affected test files pass 108 tests
(`/tmp/blue-parity-focused-final.log`), and `pnpm test:scripts` passes 59 tests.
`git diff --check` passes. The full app and workspace attempts each passed 5693 app tests with
2 skipped but hit different pre-existing meter timing tests; their isolated reruns pass (3 and
9 tests, `/tmp/blue-parity-meter-isolated.log`, `/tmp/blue-parity-engine-isolated.log`). The
workspace attempt also passed data 3089/1 skipped, engine-client 47, CLI 7, Java and native 14.
The workspace run is not a full pass; `/tmp/blue-parity-workspace-tests-final.log` preserves
its engine-frequency failure. Existing Windows/Linux and release gates remain open.

## Remembered sign-in implementation and local acceptance (2026-10-18)

The owner confirmed the server update and authorized implementation. Blue-site source is clean
at `fe19eca23294e1ecb00f6847985ed9998868aff2`; its updated API/verification documents were
reviewed. The reported server suite is 16 unit / 25 integration tests, build, lint and typecheck.
Desktop independently reran all eight login/XML validation tests with Node 24.21.0. No production
authentication/write test was performed; deployment confirmation is from the owner.

### Behavior and boundaries

- Unchecked is the default. Ordinary login sends the compatible email/password-only body and
  clears previously remembered proof. Checked login additionally sends rememberMe:true, verifies
  GET/session expiry, and saves only an encrypted origin-bound cookie snapshot.
- Main's RememberedSessionStore uses Electron safeStorage, a versioned/size-bounded record,
  private temporary-file/atomic-replacement handling and serialized, generation-fenced saves/
  deletes. No password, cached identity/catalog, renderer Query cache, draft or pending write is
  persisted. No new dependency, copied server/auth code, asset or project/schema change.
- The active native partition remains nonpersistent. The OPEN IPC path restores into a fresh
  private partition and validates with GET/session before returning signed-in state. Revoked,
  expired, malformed and wrong-origin proof clears. Temporary verification failure reports
  unavailable and permits explicit retry while protected actions stay disabled.
- Sign-out/account replacement invalidates old saves/restores. Tests include sign-out while an
  atomic rename is already in flight, replacement while an old GET is pending, and delayed
  cookie capture. Insecure/unavailable encryption has no plaintext fallback; normal process-only
  sign-in remains usable with feedback. Failed local cleanup and unconfirmed remote revocation
  remain distinct. No automatic login downgrade, credential retry or write replay was added.

### Commands and results

Run from the repository root with the repository's pnpm runtime:

```sh
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
node packages/blue-app/scripts/verify-blueshare-session.mjs
git diff --check
```

- Main/preload/renderer builds and typechecks pass; existing bundle-size advisories are unchanged.
- The focused BlueShare suite passes 283 tests across 17 files. The last account/IPC refinement
  also passes all 14 targeted race/boundary tests.
- The full workspace run passes: app 5732 / 2 skipped (530 files), data 3089 / 1 skipped,
  engine-client 47, CLI 7, Java, native 14 and repository scripts 59. Log:
  `/tmp/blue-remember-workspace-tests.log`. No performance assertions were weakened.
- Root lint/format, typography audit, verifier syntax and whitespace checks pass. Logs:
  `/tmp/blue-remember-lint.log`, `/tmp/blue-remember-build-main-final.log`,
  `/tmp/blue-remember-build-preload-final.log`, `/tmp/blue-remember-build-renderer-final.log`.
- The four-phase native verifier passes on macOS darwin/arm64, Electron 44.5.1 / Chromium
  152.0.7977.130. Phases 1–2 retain the exact-partition memory-only restart and all eight
  HTTP/1.1/HTTP/2 POST/DELETE × fresh/warmed no-replay checks. Phases 3–4 use real safeStorage
  across separate processes, restore Secure/HttpOnly/host-only/path/SameSite cookies, validate
  the new process with the server, reject revoked proof and clear proof on offline sign-out.
  Unsupported crypto is an explicit failure, not a plaintext acceptance mode. Log:
  `/tmp/blue-remember-native-final.log`. macOS Chromium helper shutdown diagnostics appear
  after successful main-process assertions; the supervisor exits zero for all four phases.

### Isolated updated-server acceptance

Use the earlier portable-controller reproduction procedure, replacing its git archive revision
with `fe19eca23294e1ecb00f6847985ed9998868aff2` and using Node 24.21.0 on PATH. The source copy
contains tracked server files and clone-copied installed dependencies only; it excludes .git,
.env files and untracked work. The runner creates disposable PostgreSQL 18/Nginx containers and
a test-only Electron profile, then cleans them up. The server checkout and production remain
unchanged. The controller exports a synthetic-data login-form screenshot to
`path.join(os.tmpdir(), 'blue-remember-login-form.png')` before deleting its private profile.

The extended controller checks actual seven-day server expiry, native cookie snapshot with OS
protection, server-validated restoration and durable/remote logout. The rendered production
checkbox traverses checked preload/IPC and creates a seven-day session. All nine Import/Export/
Manage workflows, exact content, owner isolation, pagination, lost-write reconciliation and
project/history invariance remain covered. The final-source run identity is:

- Desktop HEAD `f3d54808c39fb354b9e27aba879aaf7a4719ac13` plus the uncommitted feature changes.
- Source fingerprint `cae2f88e41d7d9d1c5bcd14c83639175d9c38ad63585491a271b0e6c19b6a7b9`.
- Compiled fingerprint `e2ac5e95043b4ab97a8b6ceafdb4fe1958aaabfa604197fb61429605691dd08e`.
- Runtime Electron 44.5.1, Chromium 152.0.7977.130, Node 24.21.0, darwin/arm64/23.2.0.
- Log `/tmp/blue-remember-actual-service-final.log`. Its scope includes main wiring, store,
  transport/service/IPC, shared/preload/renderer contracts and checked-in acceptance sources.

This evidence supersedes the earlier remembered-session controller pass only for the final
source/compiled identity above. It does not replace unavailable supported-platform acceptance:
Windows/Linux native OS storage remains pending (T107), so full T108 and T082/T087/T095/T096
release gates remain unchecked. No full cross-platform parity/release claim or commit is made.

Final-source controller result: **PASS**, including all nine rendered workflows, remembered
sign-in/restoration/logout, and lost-write lifecycle cases for every kind; exit code zero.
Disposable service copy, containers and profile were removed. The exported checkbox screenshot
was visually inspected with the actual checked state, near-black fields and unclipped labels.


## Phase 14 local acceptance (2026-10-18)

This section supersedes earlier current-source claims for T109–T112 only. Historical passes above
retain their recorded scope. The final source returns public browsing immediately during restore,
offers **Forget saved sign-in** without credentials, and applies one account-operation budget to
storage, cookie and network work. Timeout does not mean rollback or confirmed deletion. Non-secret
drafts remain recoverable; protected actions require a server-checked identity.

Reproduce with the build/test commands and pinned portable-controller procedure above, using
server revision `fe19eca23294e1ecb00f6847985ed9998868aff2`, Node 24.21.0, Docker and the checked-in
`verify-blueshare-controller.mjs`. The driver refuses non-loopback/non-disposable database/container
identities. Atomic control files in its temporary profile trigger only fixture session aging,
expiry/deletion, inspection and the actual captured-mail password-reset flow. Server files and
production are unchanged; the temporary checkout/profile/containers are removed after exit.

| Requirement scope | Current local evidence | Remaining gate |
| --- | --- | --- |
| FR-001–009, SC-001–004 | Retained nine native/rendered kind/workflow cases, resource validation, exact payloads, ownership, pagination and persistence | Supported-platform acceptance |
| FR-010–011, FR-015, FR-022 | Main-only encrypted proof, exact origin/native isolation, bounded contracts, no credential/query/project exposure, unchanged default origin | Windows/Linux real OS protection |
| FR-012–013, FR-018–019, SC-005/008 | Single scoped deadline, no replay/duplicates, public browse/import during restore, account/close fences, preserved drafts; focused lifecycle regressions | Platform/UI matrix |
| FR-014, SC-006 | Existing project/history invariance and supported import regressions retained | Applicable platform engine reconciliation |
| FR-016–017, SC-007 | Semantic buttons/labels/focus, unavailable-session cleanup control and macOS workflow checks; no full-parity claim | Windows/Linux keyboard/focus/nine flows |
| FR-020–024, SC-009 | Opt-in, seven-day issue, separate-process OS-encrypted restart, fixed database expiry, retained-cookie rejection after expiry/revocation/reset, offline deletion and late-result fencing | Windows/Linux restart/backend/failure cases |

Final verification results and exact runtime identity are recorded below after the current-source
acceptance controller completes. Unavailable Windows/Linux runners keep T113, T082/T095/T107 and
full-release T087/T096/T108/T114 unchecked; unit tests and macOS do not substitute for them.

### Final build and local regression evidence

- Desktop HEAD: `f3d54808c39fb354b9e27aba879aaf7a4719ac13` plus the uncommitted feature changes.
- Final source fingerprint: `b378ad44b099f556c069409d2e0ab4bcee76b86b4215996fd93a734a81923f3b`.
- Final compiled fingerprint: `a4009ecbaa36d1d8f77610698db262a113072dc81faa6dea6948f4732eb7c2c8`.
- Fingerprint paths/algorithm remain explicit in `verify-blueshare-service.mjs`; these hashes
  cover the production acceptance inputs, not later evidence-only Markdown edits.
- Implemented service revision: `fe19eca23294e1ecb00f6847985ed9998868aff2` in an isolated archive.
- Runtime: Electron 44.5.1, Chromium 152.0.7977.130, embedded Node 24.21.0,
  macOS `darwin/arm64/23.2.0`; native remembered phases use actual OS-protected safeStorage.

| Check | Result / log |
| --- | --- |
| Affected BlueShare regressions | **339 passed / 22 files**, `/tmp/blue-auth-final-regressions.log` |
| Final full app tests | **5751 passed / 2 skipped / 530 files**, `/tmp/blue-auth-app-complete.log` |
| Workspace tests | **PASS**, `/tmp/blue-auth-workspace-tests.log`: data 3089 / 1 skipped, engine-client 47, CLI 7, Java, native 14, repository scripts 59; its earlier app pass (5746) is superseded by the final full app pass above |
| Main build/typecheck | **PASS**, `/tmp/blue-auth-build-main-final.log` |
| Preload / renderer builds and typecheck | **PASS**, `/tmp/blue-auth-build-preload.log`, `/tmp/blue-auth-build-renderer.log`; no renderer change followed these builds |
| Root lint / formatting | **PASS**, `/tmp/blue-auth-lint-complete.log` |
| Package inputs / existing Query license scope | **PASS**, `/tmp/blue-auth-package-final.log`; no new dependency or incorporated third-party material |
| Native session acceptance | **PASS**, `/tmp/blue-auth-native-complete.log`: four separate-process phases, real encrypted restart, exact-origin cookie attributes, offline cleanup and all eight fresh/warmed HTTP/1.1/HTTP/2 POST/DELETE no-replay cases |
| Verifier syntax / whitespace | Node `--check` on the three verifier scripts and `git diff --check`: **PASS** |

Native synthetic rejection is scoped separately from database-backed rejection. Helpers can emit
macOS shutdown diagnostics after successful assertions; the native supervisor exits zero. Passwords,
proof and reset tokens are absent from renderer Query/draft persistence, project/library mutations,
control-file results and logs; local fixtures use synthetic accounts only. No production writes or
server checkout changes were made. The manual documents public availability during verification,
offline forgetting, retries, deadlines and unconfirmed cleanup/revocation.


Final database-backed acceptance at the fingerprints above: **PASS** for fixed absolute expiry
across activity, database expiry, session-row revocation and real password-reset invalidation.
Each invalidation rejects retained native cookies and encrypted restart proof, removes the local
record and prevents protected writes. Log: `/tmp/blue-auth-service-complete.log`. This is actual
PostgreSQL/implemented-service evidence, distinct from the native verifier's synthetic server.

Final matching-source controller result: **PASS / exit 0**, including all nine rendered
Import/Export/Manage workflows, exact payloads/descriptions, owner isolation, pagination,
confirmation cancellation/focus, lost committed POST/DELETE reconciliation, navigation/draft
recovery, no replay and project/history invariance. The final log ends with successful native
UI acceptance and cleanup of that run's temporary service/profile/containers. The exported
synthetic-account checkbox view retains the inspected near-black fields and labelled checked
opt-in. No Windows/Linux or full-release result is inferred from this macOS pass.


## Final feature closure — owner-approved 2026-10-18

The owner reported that stay-signed-in testing looks good and explicitly chose to skip Windows
and Linux testing. The scoped exception in plan.md closes feature 117's platform and dependent
release gates. Windows/Linux native/UI/protected-storage/path/engine cases are **waived and
unverified**, not passed. The waiver does not change product behavior or security requirements.

The Phase 14 final matching-source macOS/native/rendered/database-backed results above remain
the acceptance basis, including fixed expiry, revocation/password reset, offline forgetting,
no replay and project/history invariance. Closure rechecked the same production-source
fingerprint; main/preload/renderer builds, renderer typecheck and staged/unstaged whitespace checks
pass. Existing Vite chunk-size advisories remain. Documentation changes do not require repeating
unchanged application/native/service suites.

| Closure item | Disposition |
| --- | --- |
| Implementation and owner stay-signed-in testing | Accepted |
| Recorded macOS/native/service/regression/build/license evidence | Accepted within its recorded scope |
| Windows/Linux matrix: T082/T095/T107/T113/T115 | Waived by owner; not executed, unverified |
| Final validation/reconciliation: T087/T096/T108/T114/T116 | Complete under the approved scoped exception |
| Feature 117 | Closed; no remaining tasks in the approved scope |

Earlier pending-platform and incomplete-release statements are dated historical evidence.
This closure does not assert an installer publication, production deployment, or Git commit.
