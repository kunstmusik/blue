# BlueShare data model

Updated: 2026-10-18. This design adds no project fields or database tables.

## Identities and service records

| Entity | Fields and validation | Canonical owner / lifetime |
| --- | --- | --- |
| ResourceKind | Exactly `instrument`, `effect`, `soundObject`; never a display label or Java class name. | Shared serializable contract. |
| ResourceKey | `{kind, id}`; ID is integer 1–2147483647. Kind is required because IDs overlap. | Service; stable across hostname cutover. |
| Category | `{kind,id,parentId,name,description}`; nullable parent/description. Parent references same-kind existing category; reject cycles/duplicates/orphans. Preserve ID order among siblings. | Service; fetched tree is disposable. |
| ResourceSummary | Key, name, nullable description/blueType/createdAt, `category:{id,name}`, `author:{id,name,username}`. Dates are null or valid UTC ISO strings. Effects have null type. Public author is not login email. | Service; renderer Query cache holds disposable viewed pages. |
| ResourceDetail | Summary plus complete `xml` string. Server envelope validity does not establish desktop class/member support. | Service; main owns downloaded body for validation/import. |
| ResourcePage | Summaries and `nextBeforeId:number|null`; strict descending IDs, no duplicate kind/IDs, bounded page size. | Service; live cursor traversal, not a frozen snapshot. |
| LatestResult | Up to ten summaries of one kind; creation descending, null dates last, ID descending for ties. No pagination. | Service. |
| AccountIdentity | `{id,name,username}` and optional session expiry after session GET; never cookies/token/email. | Service; main holds current sanitized identity. |

Top-level categories with numeric IDs are real publish destinations. Synthetic kind roots
and Latest have separate UI discriminants and **no numeric ID**. Direct category browsing
excludes descendants. Missing categories, empty categories, and unavailable trees differ.

## Session and operation state

**Renderer request cache**: one stable, in-memory TanStack Query client per BlueShare modal
instance, cleared on close/unmount. It owns fetched DTOs, read errors/loading/pagination, and
non-authentication mutation lifecycle only. Main/service/library remain authoritative. Query
keys include the service scope supplied by main, dialog context, operation/kind and applicable
category/resource identity; private keys also include public account ID and main-owned epoch.
Infinite-query cursors are page parameters within their list key. No credentials, cookie proof,
complete XML, live editable draft state, persistence, dehydration, broadcast, or offline queue belongs here.
Mutation variables may contain an immutable snapshot of submitted public fields (including the
description); that snapshot is not the editable draft owner and must not alias it.
Sign-in receives credentials through a short-lived imperative call, never mutation-cache variables.
Account snapshots in the cache are checked mirrors of main state, never independently advanced.

- **AccountState**: `signedOut`, `signingIn`, `signedIn`, `signingOut`, or `unavailable`, plus
  monotonic main-owned `accountEpoch` and sanitized identity when known. A service failure is
  not silently converted into anonymous identity. Only a valid signed-in state permits writes.
- **Native account context**: exact configured origin, isolated nonpersistent Electron Session,
  and outstanding native requests. No BrowserWindow uses that session. Chromium processes all
  cookies; proof never becomes a preload DTO. A new account attempt/origin uses a fresh context.
- **DialogContext**: opaque ID tied to requesting `webContents`, opening generation, and at
  most one publish source snapshot. Main rejects an unknown/closed/wrong-sender context.
  Account state is app-wide; UI selections and drafts are per dialog. No project/session fence
  is borrowed for remote work.
- **OperationContext**: request ID, dialog context, account epoch for protected work, kind/key,
  and abort handle. State is `pending → success | failure | cancelled | uncertain`.
  One import/publish/remove slot per dialog prevents duplicate pending activations.
- **Failure**: bounded code/message, optional field errors, optional structured XML diagnostics,
  optional HTTP status/retry-after, and outcome `rejected | unknown`. A write with an incomplete
  or unvalidated response is unknown when commit cannot be ruled out. No exception/body dump.

Sign-in keeps form email/password only until submitted; renderer local input is cleared after
submission and never enters a global store. Main drops request credentials after the attempt.
All post-login DTOs contain only public identity. Sign-out immediately fences new protected
operations, aborts stale work, attempts remote revocation using the old context, and clears old
local proof even on failure. Report unconfirmed remote revocation separately. Late login or
cookie updates cannot revive a retired account context. Confirmed server commits may predate
sign-out and cannot be rolled back by closing the dialog.

## Local import

`ImportRequest` identifies a remote key, not an arbitrary renderer URL/path/XML body. Main
fetches complete detail, applies envelope/size checks, and calls:

`readResourceXml(kind, xml, {kind, label: remote resource identity/name})`.

Require `ok:true` before deriving metadata with `parseRawXmlDocument` and
`classifyLibraryPayload`; do not accept its unsupported archive fallback. Preserve original
payload XML, calculate its raw hash consistently, and use existing canonical hash, embedded
name, object type, preview/dependency metadata and serializer fields. Embedded resource name
is authoritative for imported resource content; the remote display title remains attribution/
diagnostic context. Preserve all significant code/text whitespace. Metadata extraction must
not replace the accepted payload with a lossy reserialization.

The unified-library service calls one worker-owned transaction to:

1. Find the kind's user root. Look only at direct **folder** children with the exact name
   Imported Instruments / Imported Effects / Imported SoundObjects.
2. Reuse the first matching folder ordered by existing `(sortIndex,id)`; ignore same-name
   items and folders of other kinds. Create a folder if none exists.
3. Insert an independent item with a fresh local identity and accepted payload.
4. Advance library content revision once and commit; then publish existing library-change
   notification and return a `LibraryMutationReceipt` with the imported item/folder as needed.

Any failure rolls back folder, item, payload, ordering and content revision together. Concurrent
imports are serialized by the existing repository worker. Name collisions never overwrite;
intentional later imports create distinct items. No remote ID/provenance table or sync relation
is persisted. Restart persistence and the existing library recovery policy remain unchanged.

## Publish source and draft

**SourceSelection**: user-only `LibraryItemKey` of the selected kind plus expected numeric
node revision. Project keys, folders, mismatched kinds and unsupported archives are rejected.

**PublishSourceSnapshot** (main only): dialog-bound opaque token, key/revision, display name,
applicable type from validated XML, original complete XML, and description seed from the
resource comment when supported (otherwise empty). Capture node and payload consistently in
one repository read operation and verify expected revision before accepting it. Validate the
standalone content with the same shared loader; no temporary file or project load.

**PublishDraft** (renderer memory, outside Query caches): reviewed source key/revision and
sanitized summary, real category ID, exact separate description, edit/review generation, and an
optional currently valid source token. Account expiry/replacement invalidates the token and
requires renewed review; it does not clear non-secret reviewed fields. Unknown-write recovery
retains the originating operation/key so a result cannot clear a newer draft. The displayed local library name is
submission metadata; embedded XML names remain unmodified, as the server contract permits.

Keep at most one source snapshot per dialog, bounded by 2 MiB XML. Replace it on new selection;
release it on successful publish, explicit reset, dialog close, account replacement or shutdown.
Before publishing, recheck source existence/revision; if changed, invalidate the token and
request review while preserving the public description. After final validation, send the frozen
reviewed XML even if a later local edit occurs during the network request. No model alias escapes.

Publish consumes only `{categoryId,name,description,blueType,xml}`; service assigns ownership,
ID, timestamps and availability. Pending duplicate clicks fail Busy. On uncertain outcome retain
the draft/snapshot, refresh My submissions, and require an explicit user decision before a new
attempt. No claim of exact-once publication is possible without server idempotency.

Query invalidation refreshes affected public and owned lists after a confirmed write. A cached
page is not proof of remote absence; uncertain removal needs an identity-checked target result
or a sufficiently complete traversal. Clearing/cancelling renderer queries suppresses observation
and stale results; it cannot undo an IPC-dispatched import, publish, or removal.

## Project state

BlueShare has no project patch or direct `BlueData` write. Library import, export drafts,
publication/removal and account changes preserve active document, dirty state and history.
Later library insertion uses existing preview/apply transfer APIs and
`ProjectHistory.commitPreparedStructuralMutation`; existing stable-identity/reference/runtime
reconciliation remains authoritative. Imported code/assets are not executed/resolved by import.


## Remembered-session amendment (implemented main-owned store)

The active AccountState stays main-owned and transient. A checked sign-in intent additionally
permits one encrypted remembered-session record in the existing userData profile, never the
project or library database. Conceptual fields are record version, exact service origin, server
expiry and minimal native auth-cookie attributes/proof; all authentication proof is inside
OS-protected ciphertext. Do not add a saved password, persisted account DTO, catalog, Query state,
draft, pending write or publish-source token. This does not add project fields/database tables.

Main must validate version/shape/bounds/origin and server expiry before installing native cookies,
then GET/session before establishing a fresh sanitized identity/epoch. Restore is not trusted
merely because decryption succeeds. Failed/revoked/expired/corrupt records clear; transient
network failure may retain an unexpired encrypted record without granting signed-in status.
Account replacement, origin change, unchecked login and sign-out invalidate older storage work
and delete prior proof. Serialize saves/deletions and fence their completion with the account
generation. Encryption/write/delete errors are explicit; insecure storage fallback is forbidden.
Detailed lifetime, native-cookie and IPC requirements are in contracts/desktop.md and FR-020–024.
