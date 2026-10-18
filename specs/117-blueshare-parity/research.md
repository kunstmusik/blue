# BlueShare research and design decisions

**Updated**: 2026-10-18

**Feature**: [spec.md](spec.md)

**Result**: Feature 117 is closed as of 2026-10-18. The owner accepted stay-signed-in testing
and explicitly waived Windows/Linux acceptance; these platforms remain unverified. All local
implementation, macOS/native, implemented-service and regression work is accepted with that
scoped validation exception. Final closure in [plan.md](plan.md), [quickstart.md](quickstart.md)
and [tasks.md](tasks.md) supersedes earlier pending gate statements; dated research remains
historical evidence.

## Recheck revision and evidence

Blue-site clean HEAD: `20df3f93185b60a6677999a4820405215c9e4f3a`. Its
`docs/BLUESHARE_API.md` and implementation cover every capability in the original handoff.
The service verification document still describes an uncommitted implementation based on
`4a5dcf2...`; its recorded source hash matches the now-committed service bytes:
`d994187a66b0e1e8d4f53f90a429ee117e67e0490237893b73aca462e965c071`.
Do not confuse that stale revision paragraph with the current clean HEAD.

### Fresh verification

- `pnpm test` under Node 24.21.0: **15 passed**, zero failed/skipped. An independent research
  agent also reran the eight pure XML/input/safety tests successfully; no database involved.
- Full isolated integration runner: **20 passed**, zero failed/skipped, approximately 51 seconds
  in the test suite plus build/setup. Next production compilation, lint/type validation,
  PostgreSQL 18 and Nginx exercised the checked-in service/proxy code. It covered all kinds,
  pagination, exact XML, ownership, auth/expiry/reset/logout, failures, ambiguous publication,
  timeouts, late writes and service-host cutover.
- The full runner used a temporary source/dependency copy under `/private/tmp`; no source,
  build output, app database or credentials in the user's blue-site checkout were changed.
  A first attempt with a symlinked node_modules failed because the package manager tried to
  write through that symlink; replacing it with a filesystem clone made the isolated run pass.
  The harness removed its own PostgreSQL/Nginx containers and temporary runtime resources.
- Public HTTPS GETs at blue3.kunstmusik.com on 2026-10-17 succeeded: three category lists
  (15/14/1), three per-kind latest-ten lists, and full available lists (91/124/21). Effects
  spanned two 100-item pages with no duplicate IDs. One selected detail per kind contained
  complete XML (17858/4728/187957 UTF-8 bytes); only size/field observations were retained.
- Anonymous session and owned-list requests correctly returned 401 JSON. No production
  sign-in, publishing, removal, database write or payload fixture capture was performed.
- Public v1 deployment is demonstrably reachable, despite the older verification document's
  statement that its author did not deploy. The exact currently deployed Git revision is not
  exposed by health and was not independently established; record it at release handoff.

### Service semantics that affect desktop design

`src/lib/blueshare-service.ts` owns direct-category/owner filtering, immutable-ID cursor
pagination, latest ordering, intact XML detail, transactional publish and owner-qualified
soft removal. `src/lib/blueshare-api.ts` owns exact mutation Origin, database-backed sessions,
`rememberMe:false`, disabled cookie cache/refresh, and confirmed logout revocation.
`src/lib/blueshare-validation.ts` enforces envelope/type/safety/size limits, not desktop member
compatibility. Production public endpoint behavior matches the documented consumed surface.

The service's historical audit identified 33 malformed class-root legacy instruments, and
the owner subsequently retired them locally/remotely. Current public counts reflect that
retirement. Do not resurrect or normalize them in this desktop feature. Explicit 409/410
outcomes remain necessary; a valid envelope still does not prove that Blue 3 supports every
resource member/type. Existing feature 116 evidence remains the compatibility authority.

## Decision 1 — Consume the implemented v1 surface

**Decision**: Use `/api/blueshare/v1`, exact `instrument/effect/soundObject` kinds, complete
category responses, direct-member pages of 25 with `nextBeforeId`, independent latest-ten,
complete XML detail, authenticated create/mine/remove and `/session`.

**Rationale**: Every required Java workflow now has a tested service operation. IDs/author
ownership survive migration; nullable descriptions/types/dates and actual top-level category
semantics are explicit. The mixed legacy feed is not sufficient for per-kind latest results.

**Alternatives considered**: Restoring XML-RPC duplicates a retired service; inferring routes
or filtering the capped mixed feed gives incomplete results; server Update is not a working
Java requirement. None is needed. See [contracts/service-api.md](contracts/service-api.md).

## Decision 2 — Native in-memory account cookies

**Decision**: Use Electron 44.5.1 native `net.request` with an isolated nonpersistent Session,
`credentials:'include'`, exact configured origin, no-store and redirect errors. Let Chromium
handle all cookie headers. Keep identity/session orchestration in main and password inputs
transient; use account epochs and retire native contexts on replacement/logout/origin change.

**Rationale**: Signed-cookie sessions require all Set-Cookie values, including `dont_remember`,
plus normal cookie scope/security. Native APIs already implement that behavior. Installed
Electron declarations confirm Session, credentials, Origin and redirect options. Official
[Session documentation](https://www.electronjs.org/docs/latest/api/session#sessionfrompartitionpartition-options)
and [ClientRequest documentation](https://www.electronjs.org/docs/latest/api/client-request)
confirm nonpersistent partitions and native request options. A native transport validation is
still required in implementation because fake/Node fetch tests cannot prove Chromium behavior.

**Alternatives considered**: Node fetch plus a hand-written cookie parser risks cookie/security
errors; a new jar dependency is unnecessary; default/persistent sessions violate lifetime and
isolation. Renderer fetch puts remote credentials/network configuration in the wrong owner.
No new authentication scheme or transport abstraction framework is needed.

## Decision 3 — Existing semantic acceptance, before any library mutation

**Decision**: Require `readResourceXml(kind,xml,XmlSource).ok` and preserve diagnostics before
using `parseRawXmlDocument`/`classifyLibraryPayload` to derive existing library metadata.
Preserve accepted original XML; do not repair or reserialize it just to import it.

**Rationale**: The shared loader already handles supported standalone roots and historical
normalization independent of project version/runtime availability. Classification intentionally
archives unsupported payloads as warnings for other library workflows; that fallback cannot
meet BlueShare's failed-import atomicity requirement. Remote source labels are labels, not
native filesystem paths. Significant code whitespace and identity relationships must survive.

**Alternatives considered**: Fake legacy-library wrappers duplicate envelope handling;
BlueShare-only loaders fork compatibility; trusting server envelope validity accepts unsupported
members; automatic unsupported archives change the requested user-visible failure contract.

## Decision 4 — Extend the current library owner narrowly

**Decision**: Add accepted-resource import and immutable revision-checked publish-source methods
to UnifiedLibraryService. Add one atomic imported-folder/item write and one coherent node/payload
read to its repository/client/worker boundary; no schema changes.

**Rationale**: Existing `importInstrumentFile` is file/instrument-specific; library-wide imports
have migration semantics inappropriate for one network resource. Existing `createFolder` and
`createItem` have separate transactions, so composing them can leave an empty folder on failure.
A single worker operation provides full rollback/revision ownership. Reading node and payload
consistently avoids publishing a stale revision paired with newer bytes. The existing worker,
receipts, change notifications and recovery remain authoritative.

**Alternatives considered**: Direct SQLite access from BlueShare splits ownership; fake temporary
files impose path/security work; unguarded sequential source reads introduce a revision race;
a new catalog DB or durable provenance/sync graph is unnecessary.

Imported-folder reuse is direct-child exact-name + correct kind + folder node, ordered by
existing `(sortIndex,id)` when duplicates exist. Same-name items never count as folders.
Source preparation accepts user items only, stores detached bounded XML in main, and returns
an opaque dialog-bound source token. Recheck existence/revision at final publication; preserve
user-edited public description when new review is needed.

## Decision 5 — Explicit uncertain writes and stale-operation fences

**Decision**: Bound whole requests to 30 seconds/16 MiB responses, prevent duplicate pending
writes per dialog, and never automatically retry publishes. Retain uncertain drafts, refresh
My submissions, and let the user decide. Main owns context/account fences; UI ignores stale
kind/category/selection responses. Expiry and unavailable service are different outcomes.

**Rationale**: The service deliberately has no publish idempotency key; a lost 201 or timed-out
transaction can have committed. Closing a view/logout cannot retroactively cancel that commit.
Owner removal is state-idempotent but uncertainty still calls for reconciliation. IPC payloads
and responses require runtime validation, not TypeScript casts.

**Alternatives considered**: Automatic retries duplicate content; a persistent offline queue or
custom exact-once protocol exceeds the scope; using active project revision for remote view
fences incorrectly couples account/catalog state to compositions.

## Decision 6 — Familiar UI in existing app conventions

**Decision**: Open a normal tool modal immediately from Tools, keeping all three kind groups and
Import/Export/Manage arrangements. Reuse existing library browse, modal/focus, contextual
confirmation, semantic typography and host-document portal conventions.

**Rationale**: This meets the requested 3.0 parity scope without new workbench panel/window
infrastructure. Java's actual export sources are user libraries, despite one misleading label.
Active project content remains untouched until existing history-backed library insertion.

**Alternatives considered**: New standalone browser window, visual redesign, direct-project
export, search/tags/thumbnail infrastructure and broader module refactors are unnecessary.
See `docs/typography.md`, `docs/popout-popup-conventions.md`, application AGENTS, and
`docs/modularization.md` for constraints respected by the planned seams.

## Decision 7 — TanStack Query for renderer request state (approved 2026-10-18)

**Decision**: Replace BlueShare's manual fetched-result/loading/error/pagination state with
`@tanstack/react-query@5.104.4`, over the existing typed preload API. One modal-scoped client
owns disposable DTOs; main still owns HTTP/cookies/accounts/epochs/write guards, the unified
library owns SQLite, and editable drafts remain separate renderer state. The migration is
specified in plan.md Decision 7 and tasks.md Phases 9–11.

**Evidence and rationale**: `use-blueshare.ts` has roughly 1600 lines with parallel result,
error/loading and generation-ref machinery. Read-only probes reproduced stuck Import after
selection changes, stale publish/logout completions overwriting newer state, draft loss on
expiry and false removal success from an incomplete owned page. Query supplies read/mutation
lifecycle and keyed pages; domain reconciliation, validated boundaries and draft fences still
need explicit fixes. Its caches must replace the duplicated machinery rather than coexist with it.

**Alternatives**: Continuing manual read-generation handling retains the demonstrated failure
pattern. A new custom request framework adds another implementation to maintain. An app-wide
cache, persistent client, background queue, network rewrite, and mutation-scope queuing exceed
the bounded need. The owner approved a renderer-only adoption; unrelated surfaces stay unchanged.

**Behavior references** (official documentation; links rechecked 2026-10-18):

- [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) and
  [infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
  inform identity isolation and cursor-page ownership.
- [Query functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)
  require rejected promises for failures; the checked IPC result union needs an explicit unwrap.
- [Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults),
  [network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) and
  [mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) require
  explicit retry/refetch/offline policy for this desktop feature. Mutations are not a Busy guard.
- [Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
  supplies a signal to the query function; it does not cancel Electron IPC or undo a sent write.

**Dependency and license gate**: `pnpm view` metadata and both published npm tarballs were
read without installation. React Query 5.104.4 requires React `^18 || ^19` (and matching
React types), compatible with this app's React 19.2.5. Its sole runtime dependency is Query Core
5.104.4; Query Core declares no runtime dependencies. Both published `package/LICENSE` files
are MIT with `Copyright (c) 2021-present Tanner Linsley`, and share SHA-256
`a405ee70c632bb938acb7ac5f210e814409b3760ea9d2329d8ed8ffcfd11a0e7`.

| Incorporated package (during implementation) | Published source/version | Destination and obligations |
| --- | --- | --- |
| `@tanstack/react-query` | [5.104.4 tarball](https://registry.npmjs.org/@tanstack/react-query/-/react-query-5.104.4.tgz), MIT | GPL-3.0-or-later app renderer; preserve MIT copyright/permission text, add package inventory/notices and shipped dedicated license text. |
| `@tanstack/query-core` | [5.104.4 tarball](https://registry.npmjs.org/@tanstack/query-core/-/query-core-5.104.4.tgz), MIT | Transitive renderer bundle; same notice/license obligations. No separate direct dependency needed. |

The permissive MIT terms permit incorporation in the app's existing GPL scope with notices
preserved. Use normal package APIs and original integration code; no upstream examples/source
are copied. T085 installs the exact approved version and updates `pnpm-lock.yaml`,
`packages/blue-app/THIRD_PARTY_NOTICES.md`, `NPM-PRODUCTION-DEPENDENCIES.md`, and
`LICENSES/TanStack-Query-MIT.txt`; the existing electron-builder `../../LICENSES` copy includes
that text in `Resources/licenses`. T087 verifies the staged notices and dependency closure.
This replaces the earlier no-new-dependency choice only for these two packages; installation,
shipping checks and runtime tests have not been performed by this documentation amendment.

## Original license gate after design — amended by Decision 7

All integration code is original within GPL-3.0-or-later `@blue/app`, calling existing MIT-scoped data
APIs without moving Java/site implementation into them. Decision 7 adds only the approved MIT
Query packages; no source adaptation, parser translation, bundled upload or asset is planned. Existing Electron/third-party packaging
notices apply. The service added ISC parse-xml notices, but no server code is copied. Java/site
revisions remain behavioral provenance only; public uploads are runtime user data, not licensed
fixtures by default. Unknown permissions still block copying/adaptation, not the original
client design. Both Constitution Check passes are recorded in [plan.md](plan.md).

---

# Initial BlueShare parity evidence — 2026-10-16

**Inspected**: 2026-10-16. Java was inspected before blue-site. This is specification
evidence, not an implementation plan or a claim of implemented parity.

## Source revisions

- Java Blue: `/Users/stevenyi/work/nbprojects/blue`, HEAD
  `3ca3f40579c48a023299a68130d8ab6b9e950974`, upstream
  `https://github.com/kunstmusik/blue`.
- Blue-site: `/Users/stevenyi/work/blue-site`, HEAD
  `4a5dcf2fe561e5ba53f463a1ee1bdac36abebbab`, upstream
  `ssh://steven@kunstmusik.com/home/steven/gitrepos/blue-site.git`.
  The checkout has unrelated uncommitted dependency/operational-document changes; it was
  read only. `NEXT_STEPS.md` is working-tree evidence and identifies deployed revision
  `4224794`; local HEAD must not be treated as the deployed revision.
- Blue 3 starting HEAD: `02ecbc3ade72ce677156ac761f5e157fea93efcb`.

## Historical Java UI and workflows

Primary files under `blue-ui-core/src/main/java/blue/tools/blueShare/`:

| Evidence | Observed behavior | 3.0 disposition |
| --- | --- | --- |
| [BlueShareDialog.java](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/tools/blueShare/BlueShareDialog.java) | Instruments, Effects, SoundObjects; Import, Export, Manage nested tabs. Initial 800×600 dialog and split panes. | Preserve groups, tab names, and functional arrangement; exact Swing styling/pixels are not required. |
| `instruments/InstrumentImportPane.java`, analogous effect/SoundObject panes | Category tree plus synthetic Latest node; resource table, details, import action. Latest requests ten per kind. | Public browse/import with per-kind latest-ten, empty/error states, and responsive interaction. |
| `instruments/InstrumentOptionTableModel.java` and analogous tables | Name and Submitted By columns. Details include name, type where applicable, submitter, description. | Preserve these user-facing details; metadata may be nullable in the new service. |
| `InstrumentExportPane.java`, `EffectExportPane.java`, `SoundObjectExportPane.java` in their resource folders | Read actual user libraries, choose remote category, edit submission description, submit serialized standalone resource. Instruments derive description from comments; Sound/ObjectBuilder use comments where available. | User-library source, remote category, separate description; no direct-project export requirement. One instrument label mentions current project but its actual tree model is the user library. |
| Management panes for each kind | Fetch submissions using credentials; select and confirm removal, then refresh. | Authenticated My submissions and owner-only Remove. |
| `instruments/InstrumentManagementPane.java` | Update listener/button are commented out; update method is a placeholder. | Editing existing submissions is deferred, not a parity prerequisite. |
| `NamePasswordPanel.java` | Username/password form. | Adapt to the current site's email/password accounts and explicit session state. |
| `BlueShare.java`, `BlueShareRemoteCaller.java` | Fixed `https://blue.kunstmusik.com/blue_share/api`; XML-RPC methods return lists/resource XML. | Replace retired transport with the current service. No restoration of XML-RPC is needed. |

Imports target libraries rather than the current project:

- `blue-core/.../blue/InstrumentLibrary.java#importInstrument`: reuse/create
  **Imported Instruments**.
- `blue-ui-core/.../blue/ui/core/mixer/EffectsLibrary.java#importEffect`: reuse/create
  **Imported Effects**, then save; the import pane also calls save.
- `soundObjects/SoundObjectImportPane.java#importSoundObjectToLibrary`: reuse/create
  **Imported SoundObjects** and add a library leaf. Historical fix
  [27079e68cb12b6bc6139aa01dfe18d1c8a7ea56f](https://github.com/kunstmusik/blue/commit/27079e68cb12b6bc6139aa01dfe18d1c8a7ea56f)
  (2022-08-26) corrects folder matching and the success message. The preceding
  `5de1df5e9` (2021-01-31) migrated this pane to the newer library representation;
  the inspected history distinguishes that migration from the later matching fix.

Source/log inspection is the evidence here; the Java UI was not launched and the retired
Java client was not exercised against production. Silent resource-loader catches,
unchecked category selection, blocking calls, and weak success checks are not behaviors
to reproduce under the current constitution.

## Serialization evidence and boundaries

- `BlueShareRemoteCaller.getInstrument` uses the object loader on a standalone root;
  `getEffect` uses `Effect.loadFromXML`; `getSoundObject` uses object loading with a fresh
  reference map. Exports call resource `saveAsXML` (SoundObjects use a reference map).
  No project envelope/version is required for those resource entry points.
- Existing [feature 116 research](../116-xml-compatibility-contracts/research.md#standalone-disk-and-blueshare-paths)
  cross-checks standalone instrument disk import/export and `EffectsUtil` disk paths.
  Its [historical conversion matrix](../116-xml-compatibility-contracts/resource-evidence.md#historical-conversion-matrix)
  records Java loader/writer history, including BSB parameter-list aliases, exact resolution,
  local-version conversions, and standalone Effect defaults. Reuse those supported contracts;
  this feature does not infer additional historical formats from Java tolerance.
- No live resource XML is currently exposed by the implemented overview routes. Therefore
  catalog-wide payload compatibility has not been established. New forms encountered when
  detail/download exists require loader/writer evidence and focused tests before acceptance.

## Initial blue-site implementation — before v1 work

Inspected `src/app/api/blueshare/{catalog,latest}/route.ts`, `src/lib/blueshare.ts`,
`src/app/blue_share/api/route.ts`, `src/lib/auth.ts`, `src/lib/session.ts`,
`prisma/schema.prisma`, `docs/TECHNICAL_SPECS.md`, and `NEXT_STEPS.md`.

| Surface | Implemented behavior | Missing for parity |
| --- | --- | --- |
| `GET /api/blueshare/catalog` | Aggregate counts by kind and category kind; total excludes soft-deleted items. | Not category trees or a resource catalog listing. |
| `GET /api/blueshare/latest?limit=N` | Per-table candidates merged/sorted into a globally capped feed; default 12, clamped 1–24. Summary metadata only. | Per-kind latest-ten, full category traversal/pagination, resource XML retrieval. Filtering the capped feed cannot produce correct latest-ten for all kinds. |
| `/api/auth/[...all]` and website account pages | Email/password accounts, sessions, registration/reset; username is public profile information. Imported accounts may need reset. | Desktop session use/origin behavior must be documented and verified; browser login is not proof of a desktop contract. |
| `/blue_share/api` | GET/POST return XML-RPC fault 410 inside HTTP 200. | Intentionally retired; do not use as a fallback. |
| Domain schema | Separate category trees/resource tables; integer IDs, user ownership, nullable XML text fields, soft deletion. | Models do not establish public browse/detail/create/owner-list/remove routes. |

`docs/TECHNICAL_SPECS.md` explicitly lists per-kind browse, detail, categories,
authenticated create/update/delete, and JSON contracts as next work. Only the subset
required by Java's working workflows is requested in [service-prerequisites.md](service-prerequisites.md).
Server-side Update remains deferred along with desktop Update.

### Read-only live observations

The owner identifies `https://blue3.kunstmusik.com` as production now and
`https://blue.kunstmusik.com` as the eventual hostname for that service. Public GETs on
2026-10-16 around 18:28 UTC returned:

- `/api/health`: HTTP 200 JSON, status `ok`.
- `/api/blueshare/catalog`: HTTP 200 JSON; 124 instruments, 124 effects, 21 SoundObjects,
  269 total available items; category counts 15/14/1. These are dated observations, not
  acceptance constants or a count of all historical/soft-deleted submissions.
- `/api/blueshare/latest?limit=3`: HTTP 200, three SoundObject summaries with kind, ID,
  name, description, blueType, categoryName, authorName, authorUsername, createdAt; no
  resource body. This also illustrates why client filtering of a mixed feed is insufficient.
- `/blue_share/api`: HTTP 200 XML containing the retirement fault and code 410.

No sign-in, write, deletion, database access, or catalog payload copying was performed.
Public web retrieval was unavailable through the web tool; read-only HTTPS GETs from the
local environment succeeded. Authenticated behavior remains unverified, not presumed.

## Existing Blue 3 integration points — initial inspection

- `packages/blue-app/src/main/application-menu.ts`: Tools → Blue Share currently disabled;
  its test documents that historical placeholder state. This feature intentionally enables it.
- `packages/blue-app/src/main/main.ts`: unified library lives in
  `path.join(app.getPath('userData'), 'blue_libraries.sqlite')`.
- Existing unified-library services own library writes/notifications/recovery, resource
  diagnostics, and project transfers. Project insertion remains on the canonical history
  path. BlueShare imports do not themselves insert into an active project.
- `docs/manual/tools.qmd` currently describes Blue Share as unavailable; implementation
  must update that user documentation when the feature becomes available.

## License and provenance assessment

Read repository `LICENSING.md`, constitution 4.0.0, application package metadata/notices,
data package metadata, Java license header, and file-specific headers in the inspected
BlueShare sources. Repository documentation/application scope is GPL-3.0-or-later;
`@blue/data` has its separate MIT scope and bundled-material obligations.

Java's inspected BlueShare headers/license template include GPL-2.0-or-later notices;
do not infer EPL terms from the separate Blue 3 Java helper. This change contains original
requirements and behavioral descriptions only: no Java implementation translation, service
code, dependencies, generated tables, or third-party resource assets are incorporated.
The source links/revisions above provide provenance for those descriptions.

No license/notice was found for blue-site in the inspected source inventory, and its
private package metadata declares no license. Reading its behavior is sufficient for this
specification; it does not grant permission to copy its code. Planning must explicitly check
the destination scope before adaptation, especially into MIT `@blue/data`, and obtain a
compatible alternative if permission remains unresolved. Community uploads have independent
provenance; do not bundle live uploads as fixtures/examples without checking their terms.

## Final Audit & Provenance Verification (T053, T073)

The following is the earlier implementation report. It predates Decision 7 and current open
convergence tasks; its no-new-dependency and acceptance claims are not current completion gates.

- **License Compatibility**: Implementation source files in `@blue/app` and `@blue/data` consist entirely of original code. No third-party or Java source code was copied or adapted.
- **Third-Party Notices**: `packages/blue-app/THIRD_PARTY_NOTICES.md` remains accurate and unchanged. No new third-party licenses, dependencies, or bundled assets were introduced.
- **Persistence Boundaries**: Verified no new file storage, sidecar databases, or background daemons were added. All library mutations persist strictly to the existing unified library SQLite database at `path.join(app.getPath('userData'), 'blue_libraries.sqlite')`.
- **Project Isolation**: Verified that project files, project dirty state, and project history remain completely isolated from BlueShare operations. Downstream insertions route exclusively through existing canonical `ProjectHistory` pathways.
- **Controlled Catalog Acceptance**: End-to-end acceptance verified via `src/main/blueshare/controlled-acceptance.test.ts` across all three kinds with catalog >= 25 items per kind, nested/empty categories, public/owned pagination, independent latest-10, durable import/restart, exact reviewed publish/retrieve content, owner denial/removal exclusion, uncertain outcome recovery, and connected project invariance.
- **Diff Hygiene**: Full diff verified with `git diff --check`, `pnpm lint`, and `pnpm format:check`.

## Workflow note

The mandatory `before_specify` hook pointed to a missing project-local branch script.
The equivalent installed Spec Kit git extension script was invoked once with the chosen
`codex/117-blueshare-parity` name. Its write was blocked by the `.git` sandbox; the same
requested branch was then successfully created using an approved `git switch -c`.
The spec template resolved to `.specify/templates/spec-template.md`; sequential directory
numbering selected `specs/117-blueshare-parity`. `.specify/feature.json` selects that directory.

## Implementation checkpoint — 2026-10-18

The owner-approved renderer Query migration and boundary/draft/reconciliation/reset/XML changes
are implemented. Exact commands/results and limitations are in quickstart.md; T081/T083/T082/T087
remain open, so the amended feature is not release complete.

The installed 5.104.4 Query/Core packages have the previously recorded MIT license hash
`a405ee70c632bb938acb7ac5f210e814409b3760ea9d2329d8ed8ffcfd11a0e7`. Metadata confirms React
`^18 || ^19` compatibility and only Query Core as the added runtime dependency. The dedicated
license text, both package notices and inventory were verified inside a real unsigned
Electron-builder darwin-arm64 app. pnpm added exact-version minimum-release-age exclusions for
these two approved versions; no unrelated dependency version changed. All integration code and
fixtures are original GPL app code/model-generated resources; no Java, Chromium or service
implementation was copied/adapted.

Java `GenericInstrument.java` at the recorded `3ca3f40579c48a023299a68130d8ab6b9e950974`
revision loads `instrumentText` as text and writes it through `Element.setText`; it does not
interpret literal include syntax in code. The pinned service validator parses XML structure and
rejects actual DTD/XInclude namespaces. The desktop change uses the existing Element utilities,
with a declaration-only lexical view excluding comments/CDATA, and preserves the submitted bytes.

Native fault testing found an additional prerequisite: Chromium can replay buffered POSTs when
a reused connection disappears before response headers, even when application retry is disabled.
The HTTP/1.1 case reproduced as two deliveries and is fixed with connection-close requests in
BlueShare's private transport. HTTP/2 reproduced the same issue and remains unresolved. A streamed
POST experiment prevented replay but crashed Electron's network service and was removed. No
app-wide network setting, Electron upgrade or out-of-scope service idempotency scheme was added.

Behavioral references (no source incorporation):
[Chromium network transaction retry rules](https://chromium.googlesource.com/chromium/src/+/HEAD/net/http/http_network_transaction.cc),
[Electron ClientRequest API](https://github.com/electron/electron/blob/main/docs/api/client-request.md),
and [Session API](https://www.electronjs.org/docs/latest/api/session). These corroborate the
observed native failure and available API boundaries; the failing native probe remains the
acceptance authority. A service-idempotency scope decision is pending.

The genuine controlled desktop-main/native/SQLite acceptance passed all three kinds against a
local deployment built from clean service revision `20df3f93185b60a6677999a4820405215c9e4f3a`,
using original fixtures and a disposable database/proxy/profile. It is separate from the existing
fake-service acceptance and from unexecuted real desktop UI/Windows/Linux gates. The user service
checkout and production remained unchanged. Public deployment SHA remains unestablished.


## Phase 12 convergence implementation — 2026-10-18

The native blocker was resolved through the existing Session API, without service idempotency,
runtime changes or global flags. A fresh-connection experiment passed where the warmed HTTP/2
POST failed. The production transport now rejects overlap rather than queueing writes, waits
for `Session.closeAllConnections()` before dispatch, and retains its gate while a timed-out
connection drain is still outstanding. Reads cannot have their sockets closed by a competing
write; writes that have not dispatched return a rejected failure. Sent writes retain unknown
outcomes. Native POST/DELETE verification passes all eight fresh/warmed HTTP/1.1 and HTTP/2
combinations after full request-body receipt; warmed cases assert a new connection identity.
The retained failing assertion reproduced two deliveries before the fix. Cookies remain entirely
Chromium-owned. Both process phases pass against the exact same nonpersistent partition.
Behavioral references remain the official [Electron ClientRequest API](https://www.electronjs.org/docs/latest/api/client-request)
and [Session API](https://www.electronjs.org/docs/latest/api/session#sescloseallconnections).
No upstream implementation was copied or adapted.

Java's recorded `InstrumentManagementPane.removeInstrument()` captures its selected option,
confirms it, removes it and refreshes. The TypeScript UI preserves that originating identity
while intentionally using responsive asynchronous controls. Focused regressions first reproduced
hidden removal pending state, cross-kind write settlement, delayed-open account regression,
stalled library/preparation phases and false initialization empties. Fixes preserve current
selection and per-kind drafts, keep an immutable submitted draft outside either cache for explicit
recovery, apply only checked nondecreasing main epochs, and gate empty views on successful reads.
Original GPL app code only; no Java source translation, new dependency or fixture incorporation.

The 30-second budget now covers local preparation, recursive library traversal and publish/import
preflight. Remaining time is passed to native POST transport. A timeout before sending a durable
write is rejected; an admitted library import can still finish and reports unknown. Its main
admission guard survives closing/reopening the dialog until its delegate settles. Late reads,
source seeds and open contexts cannot reactivate timed-out/disposed UI state. Tests use
deterministic timers; durable cancellation/rollback is never inferred from renderer disposal.

Validation and exact reproducible setup/results are in quickstart.md. The unchanged Query MIT
closure was verified again in a real unsigned darwin-arm64 package. Root lint/builds and the quiet
workspace test run passed after an initial timing-only meter benchmark failure; the benchmark
also passed alone without edits. Windows/Linux native UI evidence is still unavailable and is
not inferred from macOS, fake-service, hook, Docker or historical task-marker evidence.


The final portable controller run passed on Electron 44.5.1 / Chromium 152.0.7977.130 /
embedded Node 24.21.0 / Darwin 23.2.0 arm64. It used desktop HEAD
`02ecbc3ade72ce677156ac761f5e157fea93efcb` plus the uncommitted feature and clean pinned service
source `20df3f93185b60a6677999a4820405215c9e4f3a` in a disposable deployment. Printed source
fingerprint is `77fa6b07225b53805bd0b9d1f514a5ab4a117ffcc2ce4a6dddadffbb9ccf4814`; compiled
main/preload fingerprint is `e977defa23ff2f53c7e5a397eb28dffcd7457748bd507d5aac43571ccebb3996`.
The exact fingerprint inputs, reproducible setup, deliberate test-window boundary and validation
matrix are in quickstart.md and the checked-in controller/verifier. All nine rendered workflows,
public-cache refresh, pending-removal selection changes, unknown writes with kind navigation,
exact content, account isolation and unchanged project/history passed. T083/T094 close; only
platform-dependent T082/T095 and final T087/T096 remain open. Temporary fixtures and test scripts
are original GPL app work; Prisma is loaded from the existing service test checkout, not added
to the desktop runtime or dependency closure. Test-only renderer/controller scripts are excluded
from the application ASAR by the existing build-output allowlist.

## UI parity follow-up: hierarchical pickers and visible descriptions (2026-10-18)

User review requested hierarchical local sources, visible selected-item contents in Export and
Manage, and visual consistency with existing Blue 3 trees and near-black content surfaces.
Java reference remains revision `3ca3f40579c48a023299a68130d8ab6b9e950974`:

- `blue-ui-core/src/main/java/blue/tools/blueShare/instruments/InstrumentExportPane.java`
  uses the user library's `JTree` and a separate category `JTree`; item selection populates the
  description from `Instrument.getComment()`.
- The equivalent effect and sound-object export panes seed comments from `getComments()`,
  `GenericScore.getComment()` or `ObjectBuilder.getComment()`. They do not embed a full resource
  editor or code/XML viewer in Export.
- The three Java management panes provide a submissions table and removal control. Their split
  preview panes are commented out. A selected submission's description/metadata pane in Blue 3
  is therefore an intentional user-requested improvement, not a claim about Java behavior.

Retain folders/root nodes from the existing revision-consistent paged library traversal; reuse
Blue 3's `LibraryTree` in read-only picker mode for sources, import categories and destination
categories. Preserve the existing source-seed and remote-summary contracts: source comments
remain visible separately while the public submission draft is edited, and Manage displays the
selected summary's description/type/category/date. Complete XML remains main-owned (FR-018).
Use existing `app-input`, `app-selection`, hover/focus and semantic typography tokens for data
surfaces, with existing surface-colored chrome. No new styles, dependencies or copied Java
source are needed. These are original GPL-3.0-or-later app changes within the existing scope;
no additional third-party material or licensing obligations are introduced.


## RememberMe contract research and scope amendment (2026-10-18)

The user requested a server-agent handoff and specification/tasks only. No authentication code,
server deployment, or persistence has been changed. Blue-site remains pinned at
`20df3f93185b60a6677999a4820405215c9e4f3a`: `src/lib/blueshare-validation.ts` strictly accepts
only email/password; `src/lib/blueshare-api.ts` forces rememberMe:false and performs session
lookups with disableCookieCache:true and disableRefresh:true. GET/session already supplies
sanitized user and authoritative expiry; POST supplies sanitized user plus signed cookies.

Inspection of the installed Better Auth implementation confirms ordinary dontRememberMe sessions
have a 24-hour database expiry and remembered sessions use the configured expiry (default seven
days). These are evidence for the requested API delta, not a claim of deployed support. The
proposal deliberately preserves no-refresh v1 reads for a fixed seven-day period and keeps the
POST/GET/DELETE JSON shapes unchanged. Existing database sessions should suffice; the server
agent must verify implementation/tests/version behavior and report deployment evidence.

The desktop-only alternative could retain today's proof for at most the current 24-hour session;
it does not meet the chosen seven-day requirement. The approved design instead saves only
opted-in session proof through OS-protected encryption and restores it into the existing isolated
native transport, validating with the server. No passwords, renderer caches or pending operations
are made durable. No new dependencies or third-party code incorporation is planned; server/auth
source was consulted only for behavior. Original documentation and planned original app code
stay in their existing license scopes. See contracts/remember-me-api.md and tasks T100–T108.

## RememberMe implementation evidence (2026-10-18)

The owner subsequently confirmed the updated server and invoked speckit-implement. Reviewed
clean blue-site `fe19eca23294e1ecb00f6847985ed9998868aff2`: strict optional boolean, false/omitted
24-hour session, true fixed seven-day expiry, explicit auth lifetime, dont_remember expiration,
unchanged public JSON shapes and database-backed no-refresh v1 checks. The server report records
16 unit / 25 integration tests; desktop independently reran eight validation tests and exercises
remembered behavior through the isolated native/rendered controller. Production deployment
confirmation is the owner's statement, not an authenticated production probe.

The desktop implementation adds only original code in the existing GPL-3.0-or-later app scope,
using Electron safeStorage/native cookies and Node filesystem operations. No dependencies,
third-party code/fixtures, assets, database schema or @blue/data changes are introduced. Source
inspection supplied behavioral evidence only; no auth-library/server implementation was copied.

The encrypted record is main-owned, versioned, bounded, origin/expiry scoped, and atomically
replaced. Its serialized storage operations and account epochs prevent old save/restore work
from undoing sign-out or account replacement. Native partitions stay memory-only; first OPEN
IPC checks the saved session with the server before exposing signed-in identity. The renderer
adds only the unchecked opt-in, bounded non-secret failure feedback and explicit retry.

Focused tests (283), builds, root lint and full workspace tests pass. The four-process native
verifier passes on macOS with real OS protection and retains the eight no-replay cases. Actual
service/rendered test identities, commands and logs are in quickstart.md. Windows/Linux native
OS-storage/release coverage stays pending; no platform result is inferred from injected crypto
or macOS acceptance. The original requirements checklist and unrelated issue audit remain
unchanged, and the optional Git commit hooks were not executed.


## Phase 14 convergence corrections (2026-10-18)

T109–T111 remove authentication from the public initialization critical path, expose explicit
offline saved-sign-in cleanup, and bound the whole account operation rather than each HTTP call.
The existing main epochs and store generation/serial queue own authority and durable ordering;
renderer timeouts only end observation. A completed local deletion can be reported while remote
logout remains unconfirmed. Stalled persistence may preserve a GET-verified process-only login,
with a warning, while its obsolete save is fenced and followed by serialized cleanup.

Regression coverage includes delayed load/GET, public browsing/import during restore, OPEN/event
ordering, close/reopen and obsolete owner closure, unavailable/offline forgetting with anonymous
next first use, failed deletion, stalled clear/load/cookie capture/save, slow POST+GET under one
budget, authoritative rejection with stalled cleanup, late physical rename, unanswered IPC and
late replies. T109–T111 pass 339 focused tests across 22 files at this source revision.

The acceptance driver now controls only its guarded disposable PostgreSQL database, using atomic
request/response files inside the temporary profile. It ages session creation time and moves expiry
to one hour away, checks unchanged authoritative/database expiry across repeated session/protected
reads, then tests database expiry, deletion and the real website password-reset flow. Captured
cookies and encrypted records are retained deliberately before invalidation; both live verification
and fresh-service restoration must return 401, delete local proof and reject protected mutation
without sending a write. Multiple sessions from account-switching fixtures are expected; every
one must retain the fixed expiry. The native synthetic revocation stub remains separate evidence.

No server implementation source was incorporated. The controller's reset URL/token is read only
from the disposable mail capture, used transiently and never logged. No production request, schema,
protocol or dependency changed. Final runtime fingerprints/results and outstanding platform gates
are tracked in quickstart.md; prior evidence remains scoped to its recorded revision.

Final reporting refinement: an anonymous DELETE response during unavailable-session forgetting
cannot prove revocation of the previously encrypted session. Only a logout dispatched from a
verified signed-in account may report remote revocation confirmed. Unverified forgetting still
confirms successful local deletion separately and reports remote confirmation unavailable. New
authentication also retires the old restore owner so closing that obsolete dialog cannot retire
a newer account, including a newer unavailable verification state.


## Closure decision — 2026-10-18

The owner reported successful stay-signed-in testing and explicitly requested skipping Windows
and Linux tests. Record this as the Constitution V scoped validation exception in plan.md,
not a native-platform test pass. Production-source identity matches the accepted Phase 14 run;
no code, dependencies, assets, provenance or license obligations changed during closure.
Existing macOS/native/actual-service/regression evidence is retained. Five remaining platform
gates are waived and five dependent validation/release entries close under the exception;
all 116 task entries are resolved. Historical outstanding-platform statements are superseded.
