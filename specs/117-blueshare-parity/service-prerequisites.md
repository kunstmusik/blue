# Blue-site prerequisites for Blue 3.0 BlueShare

**Date**: 2026-10-16

**Rechecked**: 2026-10-17 — implemented; ready for desktop design

**Consumer**: [BlueShare specification](spec.md)

**Handoff**: All required capabilities are implemented at blue-site revision
`20df3f93185b60a6677999a4820405215c9e4f3a`. The authoritative service contract is
`docs/BLUESHARE_API.md` in that repository; its exact consumed surface is recorded in
[contracts/service-api.md](contracts/service-api.md). The requirements below remain as
acceptance criteria, not outstanding server work.

Current production base: `https://blue3.kunstmusik.com`. The eventual
`https://blue.kunstmusik.com` cutover must preserve catalog identities. Catalog operations
use JSON responses, carrying complete standalone Blue XML as resource content.

## Required capabilities — fulfilled

| Capability | Required behavior |
| --- | --- |
| Category trees | Public read for Instruments, Effects, and SoundObjects. Stable IDs, names, parent relationships, optional descriptions; define root representation and ordering. Each category belongs to one kind. |
| Category browsing | Public list by kind/category. Document direct-members versus subtree semantics; direct members are the desktop baseline. Every item must be reachable through bounded pagination with deterministic ordering. Exclude removed items. |
| Latest by kind | Public newest-ten view independently for each kind, with stable tie-breaking and documented placement of missing historical dates. Filtering the currently capped mixed feed cannot provide this. |
| Resource detail/download | Public lookup by kind plus ID. Return complete standalone instrument/effect/SoundObject XML, plus metadata. Distinguish missing/removed resources. Preserve significant XML/code/text whitespace. |
| Publish | Authenticated create for each kind: valid category, name, description, applicable Java Blue type identifier, and standalone XML. Derive ownership from the session. Return confirmed created kind/ID and metadata; reject invalid input without partial creation. |
| My submissions | Authenticated list by kind, scoped by the server to the signed-in owner. Pagination reaches the complete available list; empty differs from expired/denied sign-in. |
| Remove submission | Authenticated owner-only removal by kind/ID. Exclude removed items from public/category/latest/owned listings and new downloads. Existing soft deletion can support this. Define already-removed outcomes. |
| Desktop account session | Supported desktop email/password sign-in, current-session/identity checks, sign-out, and expiry. Document how the desktop obtains/presents session proof, origin/CSRF rules, and sign-out invalidation. Website registration/reset stay linked; desktop account creation is not required. |

## Shared contracts and validation

- Use **kind plus ID** for resource/category identity; numeric IDs can overlap across kinds.
  Preserve existing IDs and account ownership mappings.
- Listing metadata: kind, resource ID, name, public author display name and stable public
  identifier, category ID/name, nullable description, applicable Blue type (nullable for
  effects), and creation information. Do not expose login email/credentials as public metadata.
  Detail additionally contains the complete XML; summary metadata is not sufficient for import.
- Specify page size/maximum, continuation/completion, sort/ties, and concurrent-change behavior.
  Latest ordering must work independently for each kind, including null historical timestamps.
- Define required/optional fields, name/description/XML size limits, accepted kinds,
  category-kind consistency, and submitted XML root/type expectations. No code execution is
  required. Rejection must not create partial submissions.
- Distinguish invalid input, unauthenticated/expired session, forbidden ownership,
  unavailable category/resource, excessive payload/rate, and service failure. Include actionable
  field errors; do not return HTML errors as successful JSON or acknowledge uncommitted writes
  as successful submissions.
- Document timeout/retry semantics. Either provide duplicate-request protection or document
  its absence so Blue avoids automatic retries and lets users reconcile uncertain results
  through My submissions. An idempotency framework is not required for this parity slice.
- Document returned identity, migrated-account password-reset behavior, expiry/logout, and
  hostname changes. Working browser login alone does not establish an Electron session contract.
- Provide request/response examples and representative success/failure tests. Use original
  synthetic resources or explicitly licensed fixtures; production test writes are unnecessary.

## Completion checks — service verification complete

1. Browse nested categories and multiple pages for every kind; obtain ten latest per kind
   when one kind dominates the mixed feed.
2. Download complete XML for all kinds with significant whitespace and nullable metadata;
   verify missing/deleted resources are unavailable.
3. With isolated test accounts, sign in, publish one item of each kind, find it publicly and
   in My submissions, and remove it as its owner.
4. Reject anonymous writes/another account's removal. Check expired sessions, invalid
   categories, malformed/oversized submissions, empty lists, and uncertain retries.
5. Record service revision, contract location, and test results for desktop design. Treat
   live production as read-only during discovery.

## Deferred

Editing existing submissions is not required: Java's Update action was unfinished and not
exposed as a working management action. Also defer full-text search, tags, ratings,
thumbnails, audition, attachments/dependency packaging, bulk/offline downloads, UDO/module
endpoints, background sync, and restoration of retired XML-RPC.

## Recheck evidence, 2026-10-17

- Clean blue-site checkout at the revision above; the documented service source hash matches
  the committed implementation. Categories, direct-member pagination, independent latest-ten,
  complete detail XML, publish, My submissions, removal, and desktop sessions are present.
- Public production GETs returned category trees (15/14/1), latest-ten for each kind, complete
  XML for one selected resource per kind, and 401 for anonymous session/My submissions.
  Full available-resource traversal found 91 instruments, 124 effects, and 21 SoundObjects;
  effect traversal covered two pages without duplicate IDs. Counts are dated observations.
- Source and tests enforce server ownership, transactional publication/removal, cookie-based
  native sessions, exact mutation Origin, explicit failures, and publish uncertainty.
- Desktop semantic compatibility remains distinct from service XML-envelope validation.
  Supported/unsupported payload tests and native Electron cookie behavior belong to desktop
  implementation validation; this recheck does not claim every catalog resource imports.
- No production writes, authentication attempts, or production payload fixtures were created.
  See [research.md](research.md) for fresh test outcomes and limitations.
