# BlueShare desktop boundary contract

Updated: 2026-10-18. Feature closed under the owner-approved Windows/Linux validation waiver
in [plan.md](../plan.md); unrun platform behavior is unverified. Dated pending-gate notes below
are superseded by that closure. Implementation lives entirely in `@blue/app` and consumes
[service-api.md](service-api.md). Models and ownership are in [data-model.md](../data-model.md).

## Main service and preload

`shared/blueshare.ts` owns serializable request/result types, channel constants and runtime
guards. `main/blueshare/ipc.ts` validates sender and payload; preload validates results
before exposing typed methods. Use the existing `registerIpcTransaction` lease/disposer.
No generic renderer fetch/URL/header/cookie method is introduced.

| Proposed blueAPI method | Request / response |
| --- | --- |
| openBlueShare | No payload → opaque dialogContextId, sanitized AccountState, and non-secret main-supplied serviceScope (canonical configured origin; cache identity only). |
| getBlueShareAccount | Context → current sanitized state; service failure differs from signed-out. |
| signInBlueShare | Context, requestId, email/password and optional validated rememberMe:boolean (default false) → sanitized identity/state. Passwords are transient form input only; remembered-session proof never crosses IPC. |
| signOutBlueShare | Context, requestId → locally signed out plus remoteRevocationConfirmed; no false remote-revocation success. |
| getBlueShareCategories | Context, requestId, kind → validated complete category tree DTO. |
| listBlueShareResources | Context, requestId, kind, categoryId, optional beforeId → page of 25 with continuation. |
| getBlueShareLatest | Context, requestId, kind → up to ten summaries. |
| getBlueShareResource | Context, requestId, ResourceKey → summary/detail display DTO without raw XML; remote XML stays main-owned. |
| importBlueShareResource | Context, requestId, ResourceKey → LibraryMutationReceipt plus bounded resource diagnostics. Fetch and acceptance occur in main. |
| prepareBlueSharePublish | Context, requestId, user LibraryItemKey and expectedRevision → opaque sourceToken plus name/type/description seed and validation diagnostics. No XML or authentication proof returned. |
| resetBlueSharePublish | Context, requestId → `{cleared:true}` after releasing main source XML/token and invalidating pending preparation generation. Does not undo an already dispatched write. |
| publishBlueShareResource | Context, requestId, sourceToken, categoryId, description → created summary/key or recoverable failure/uncertainty. |
| listBlueShareMine | Context, requestId, kind, optional beforeId → owner-scoped page. |
| removeBlueShareResource | Context, requestId, ResourceKey → confirmed absent result or failure/uncertainty; dispatched only after UI confirmation. |
| openBlueShareWebsite | Context, purpose `register` or `recover` → opened/cancelled/error. Main constructs fixed site path; arbitrary URLs are rejected. |
| closeBlueShare | Context → release source snapshot and abort/fence pending work for this sender/context. |
| onBlueShareAccountChanged | Sanitized state/epoch event, checked in preload; unsubscribe callback removes the listener. |

Names are implementation targets, not already shipped APIs. Every operation result is a
success/failure discriminated union. Failure includes bounded code/message, optional field
errors/structured XML diagnostics, retry-after, and write outcome when relevant. Catch IPC
failure as failure, never as a successful empty list. Validate positive IDs, exact kind,
source token ownership, field sizes and known request members at the main boundary.

A sourceToken is an opaque main-owned lookup key, not authentication proof. It cannot
authorize a different dialog/sender/account or substitute arbitrary XML. No main resource model or mutable alias crosses IPC.

## Renderer Query integration

Use the owner-approved TanStack Query v5 client local to the BlueShare modal, as specified in
plan.md Decision 7. Query/mutation functions invoke the methods above; renderer never performs
remote HTTP or accepts caller-supplied service origins. `serviceScope` is a read-only identity
from main and cannot override request routing. Add it to open-result guards and preload tests.

Unwrap `{ok:true,value}` to `value` and reject `{ok:false,error}` with a typed bounded error that
preserves outcome/status/fields/diagnostics. Query/Mutation caches may contain sanitized DTOs and
non-secret intent variables only. Sign-in stays an imperative transient credential call: do not
pass email/password through `useMutation` variables, query keys, metadata or cached errors.
Account events and checked account-query replies mirror the monotonic main-owned epoch.

Read keys include serviceScope, dialog context, operation, kind and relevant category/resource;
private reads add public account ID and epoch. Infinite-query pageParam carries the exclusive
beforeId cursor; no placeholder data from another account/resource may enable Import/Remove.
Client defaults explicitly disable retries, focus/reconnect refetch and polling, with
`networkMode:'always'`, `staleTime:30000`, and `gcTime:0`. Reads/mutations therefore do not
pause for navigator connectivity or resume as offline queued writes. Main's deadlines still apply.

Only confirmed writes invalidate/refetch affected list keys and publish existing canonical library
events. Cached absence from an incomplete owned list never becomes a removal receipt. Unknown
writes retain operation/draft identity and require explicit reconciliation/retry. Neither a Query
mutation nor serialization scope replaces main's one-pending-write Busy guard.

Clear caches on close/unmount; remove old private entries on account/origin changes and reset
main source snapshots through the checked reset intent. Consume query cancellation for stale
renderer reads without claiming IPC cancellation. Retain main context/epoch/write fences; late
callbacks cannot repopulate a closed client, mutate newer drafts or fabricate account epochs.
Keep editable draft ownership outside both caches and preserve non-secret reviewed fields on expiry.
Immutable public submission fields may be copied into mutation variables at explicit submit;
no mutable draft object or credential may be captured there, and settlement cannot own later edits.

## Native transport

Create the Electron session after app readiness using a unique partition without `persist:`
and `{cache:false}`. Only BlueShare main requests use it. Use `net.request` with the Session,
`credentials:'include'`, configured origin and mutation Origin header, `redirect:'error'`, and
`cache:'no-store'`. Chromium manages all Set-Cookie updates; do not split headers by commas or
store one selected cookie manually. Tests must check HttpOnly/Secure/path/host-only cookies,
`dont_remember`, no default-session sharing, and logout/restart/origin isolation. The native
partition remains nonpersistent even for remembered sign-in: FR-022 permits only an explicitly
encrypted main-owned cookie snapshot, restored into a fresh dedicated partition. Chromium's
cookie API owns cookie interpretation; do not write a custom Set-Cookie parser.

An abort timer covers connection, upload, response and body reading, with a 30-second maximum.
Read responses with a running byte count before parsing JSON; fail above 16 MiB. Validate
shapes/statuses/keys and sanitize error messages rather than logging raw body/headers/exceptions.
Bound responses before constructing diagnostics. Do not follow Location or derive request
URLs from response metadata. Do not retry writes automatically, including on 429 or 503.

Use a small injected request function at service tests; the production adapter remains native.
Do not introduce transport plugins or a custom cookie library. Native Electron tests supplement
fake request tests because Node fetch has different cookie semantics.

## Ownership and race rules

1. Context is bound to the creating `webContents`; destruction/close releases it. Subscribe
   with existing application sender-validation conventions and explicit teardown.
2. Main owns accountEpoch and outstanding operation map. Sign-out/replacement/origin change
   advances epoch, fences writes, retires source snapshots, and prevents old login responses
   from restoring identity. A fresh native session prevents late old cookies from resurfacing.
3. Each response carries its request/context identity. Renderer applies it only while its
   dialog generation, kind/tab/category/selection and account epoch still match. Replacing
   the list clears selected details/import eligibility; account changes clear owned results.
4. One local import/publish/remove may be pending per dialog. Main rejects concurrent duplicate
   activation with Busy; renderer also disables the relevant control while pending.
5. Check context/epoch again after awaited preparation and immediately before local durable
   commit or protected HTTP dispatch. Do not claim that abort can undo a commit already begun.
   Closing a dialog suppresses late notifications; completed library commits still publish the
   canonical library change, and already dispatched remote writes may have uncertain outcomes.
6. Explicit 401 clears stale protected state and blocks new protected operations; network/
   database failure does not falsely show an empty owned list or successful logout. Existing
   public browsing remains available. Clear local proof even if remote logout fails.

## Unified-library façade

Add two narrowly scoped methods to the existing `UnifiedLibraryService`, not a second DB owner:

- **Import accepted standalone resource**: accepts main-owned kind/XML/source context, requires
  semantic acceptance, derives existing payload metadata, then uses one repository transaction
  for imported-folder lookup/create plus item insertion. The service owns readiness/writability,
  snapshot refresh, existing LibraryChangedEvent publication, and LibraryMutationReceipt.
- **Capture publish source**: accepts user-only key/expected revision. A consistent worker
  read obtains node and payload together, checks kind/item/revision, and returns a detached
  source to the service for shared-loader acceptance. No file writes, clipboard ownership
  changes, fake legacy envelopes, or project mutation. Recheck revision before final publication.

Expose only those internal operations through repository client/worker messages. Imported
folder lookup and consistent node/payload read belong to the existing repository because it
owns the database transaction. Failed imports cannot leave new folders, ordering changes or
revision increments. Metadata refresh after a committed write must not misreport the durable
commit as rolled back; use the existing recovery/snapshot path, publish a refresh requirement,
and never automatically repeat the import.

## UI behavior and parity

Open immediately from the enabled Tools → Blue Share menu, then load asynchronously. Use
`open-blue-share` in NativeMenuCommand and the existing event/modal convention from
CodeRepositoryEditorModal. Keep one normal tool modal rather than adding a workbench layout
or dedicated remote BrowserWindow.

- Groups: Instruments, Effects, SoundObjects. Each has Import, Export, Manage tabs with clear
  selection and keyboard navigation. Keep semantic headings/labels and existing control styling.
- Import: category tree/Latest on the left, Name/Submitted By list, read-only details, Import.
  Load More for category pages, no Load More for Latest; no automatic bulk fetching.
- Export: matching existing user-library browse control, remote category selection, editable
  public description seeded from resource comments where supported, signed-in identity and
  Submit. Source changes require renewed selection/review; public description is preserved.
- Manage: Fetch, owned list with Load More, Remove. Show signed-in identity/Sign out; prompt
  email/password only when needed and provide registration/recovery links.
- Removal uses existing contextual `ConfirmationDialog`, names the selected item, uses
  destructive styling, and focuses Cancel. Escape/backdrop/closure or unexpected failure
  cancels without dispatch. Server remains authoritative for ownership and final removal.
- Unknown publish result retains the draft and offers Refresh My submissions before an explicit
  retry. Read errors, empty pages, unavailable content, expiry and rate limits have distinct text.

Use `useDialogFocus`, semantic `text-role-*`, Tailwind and `cn()`; follow host-document portal
rules if any control is rendered from floated panel content. Avoid browser blocking dialogs,
new typography roles and interface redesign. No downloaded code runs or referenced asset is
fetched from a preview. Update the manual's currently disabled/historical Blue Share paragraph.


## Remembered-session boundary amendment

FR-020–024 and [remember-me-api.md](remember-me-api.md) extend the original app-lifetime-only
auth design. The main-owned implementation uses RememberedSessionStore and the extended
server contract delivered at fe19eca. Local native/macOS evidence is in quickstart.md;
Windows/Linux acceptance is waived by explicit owner approval for feature closure; it was not run
and remains unverified. Local acceptance and closure are recorded in quickstart.md.

- Add `rememberMe` only to the checked sign-in intent; reject malformed/unknown fields. The
  renderer checkbox defaults to false and uses the standard near-black form style. Keep the
  imperative sign-in path; passwords/proof never enter Query mutation variables, stores or logs.
- Main uses a small versioned encrypted record in the existing userData profile, bound to the
  exact configured origin and authoritative session expiry. Snapshot only legitimate auth cookies
  from the dedicated BlueShare jar, preserving host/path/Secure/HttpOnly/expiry semantics and
  any required signed-cookie/remember markers. Do not copy default browser-session cookies.
- Reuse Electron `safeStorage`; treat unavailable encryption or Linux `basic_text` as unsupported,
  with no plaintext fallback. Store no password. Use bounded validation, atomic replacement and
  profile-private file handling. Do not use POSIX chmod as a Windows security test.
- After opted-in login, obtain authoritative expiry via GET/session before saving proof. A failed
  expiry check/save must never be reported as successful remembering; normal authenticated use
  may continue for the current process. Never infer validity from cookie Max-Age alone.
- On first BlueShare use after restart, validate record version/origin/bounds/expiry, decrypt,
  install cookies into a new native partition and GET/session. Publish sanitized identity only
  after validation, using existing main-owned epochs. Authentication rejection deletes the record;
  transient failure reports unavailable and permits an explicit retry without replaying login/writes.
- Invalidate pending restore/save work and remove saved proof before account replacement,
  origin switch or sign-out network requests. Serialize storage operations with account generation
  checks so a late encryption/write cannot recreate deleted proof. Clear prior saved proof before
  a new login attempt, including when the new choice is unchecked or the attempt fails.
- Sign-out clears local memory and durable proof even offline, reports local deletion failure
  separately, and preserves existing remoteRevocationConfirmed semantics. Close/reopen alone
  does not discard an intentionally remembered session. On orderly shutdown only opted-in proof
  may remain; active partitions and fetched/draft/operation state remain disposable.
- Renderer sees only existing sanitized identity/expiry/epoch and bounded persistence failure
  feedback. Saved proof, encrypted blobs, filesystem paths and encryption details stay in main.
  No startup-restored publish token, draft, query cache or automatic write is introduced.

Native tests must cover actual Electron cookie restore across process restart and expiry/revocation,
plus OS-storage availability on macOS, Windows and Linux. Inject crypt/storage failures in unit
tests; do not substitute a plaintext backend for production remembered-session acceptance.
