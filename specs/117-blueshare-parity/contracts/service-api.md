# Consumed BlueShare service API

Pinned implementation: blue-site `fe19eca23294e1ecb00f6847985ed9998868aff2` (rememberMe extension).
Authoritative contract: `docs/BLUESHARE_API.md` in `~/work/blue-site`.
Rechecked 2026-10-18. The prior `20df3f9` contract is historical; the current source accepts
optional remembered sign-in. Detailed requirements and server evidence are in
[remember-me-api.md](remember-me-api.md) and [research.md](../research.md). The owner confirmed
the server update; authenticated acceptance uses disposable local accounts, not production writes.

## Origin and routing

Production origin is `https://blue3.kunstmusik.com`; base is `/api/blueshare/v1`.
Main constructs routes from validated kind/ID/known operation; the renderer cannot supply
URLs, headers, arbitrary paths or origin overrides. A future origin change to
`https://blue.kunstmusik.com` clears account state and keeps catalog identities unchanged.
Reject every redirect; never forward credentials to a redirected origin. A loopback HTTP
origin is allowed only by explicitly injected local test configuration, never UI input.

Use `Accept: application/json`, `Content-Type: application/json` for JSON POSTs, and the
exact service `Origin` for every mutation. The native transport handles all cookies in its
isolated in-memory Session, including HttpOnly/Secure/path and `dont_remember` semantics.
Cache is disabled. Bound complete request/response processing to 30 seconds and responses
to 16 MiB; malformed/oversized/non-JSON replies produce a protocol failure, not empty success.

## Endpoints

| Method | Route after base | Consumption |
| --- | --- | --- |
| GET | `/{kind}/categories` | `{items: Category[]}`; complete flat tree, ID ascending, null parent for real top level. |
| GET | `/{kind}/resources?categoryId=C&limit=25&beforeId=B` | `{items: Summary[],nextBeforeId:number|null}`; category optional, direct members, ID descending. Omit absent parameters entirely. |
| GET | `/{kind}/latest` | `{items: Summary[]}`; at most ten, dated descending/null last/ID descending ties; no query parameters. |
| GET | `/{kind}/resources/{id}` | Summary plus complete original `xml`; no reserialization or trimming by the service. |
| POST | `/{kind}/resources` | Five permitted fields below; 201 with created detail after commit and relative Location. |
| GET | `/{kind}/mine?limit=25&beforeId=B` | Same paginated envelope; server scopes by current owner. No user/owner/category filter. |
| DELETE | `/{kind}/resources/{id}` | `{kind,id,removed:true,alreadyRemoved:boolean}`; 200 for first/repeated owner removal. |
| POST | `/session` | `{email,password,rememberMe?:boolean}`; omission defaults to false; response `{user:{id,name,username}}` and all signed cookies. |
| GET | `/session` | `{user:{id,name,username},expiresAt:ISODate}` or 401. |
| DELETE | `/session` | `{signedOut:true}` and cookie cleanup only after server revocation is confirmed. |

Kinds are exactly `instrument`, `effect`, `soundObject`; IDs 1–2147483647. Unknown/repeated
query parameters are errors. Resource/owned-list page size defaults to 25, allowed 1–100; cursor is exclusive
`id < beforeId`, null continuation completes traversal. New higher IDs appear on refresh;
removal of a boundary does not break continuation. This is a live list, not a DB snapshot.
Do not derive latest-ten by filtering the older globally capped mixed latest endpoint.

## Payloads

Summary fields:

- `kind`, `id`, `name`;
- `description:string|null`, `blueType:string|null`, `createdAt:UTC ISO string|null`;
- `category:{id:number,name:string}`;
- `author:{id:string,name:string,username:string}` — never email/session/private auth fields.

Publish body has only `categoryId`, `name`, `description`, `blueType`, `xml`:

| Field | Required validation |
| --- | --- |
| categoryId | Integer ID of a real category of this kind; top-level categories are allowed. |
| name | Trim outer whitespace; 1–255 Unicode code points. Source display name supplies it. |
| description | Omitted/null or string through 64 KiB UTF-8; preserve blank string/whitespace. |
| blueType | Required for instrument/SoundObject, ≤255 ASCII characters, matching XML root type and dotted namespace `blue.orchestra.` / `blue.soundObject.`. Null/omitted for effect. |
| xml | Required original string, ≤2 MiB UTF-8; one matching standalone root. |

Server XML limits are depth 128 and 100000 elements. DTD/custom/external entities and
XInclude reject; predefined escapes, declarations, comments, CDATA and Unicode are accepted.
Server checks the envelope/safety only; desktop shared loaders decide member/type semantics.
JSON upload maximum is 16 MiB including escaping; login bodies 16 KiB. Validate encoded
lengths with UTF-8 bytes, not UTF-16 string length. Do not execute code or fetch referenced assets.

## Authentication and error outcomes

Opaque signed cookies refer to database sessions. Omitted/false rememberMe preserves 24-hour
sessions and session cookies; true selects seven days with persistent cookies and clears the
old dont_remember marker. Both lifetimes are fixed from sign-in, with refresh/cookie-cache lookup
disabled for v1 requests. Main verifies session expiry through the service; do not infer expiry from a
missing cookie Max-Age. Registration `/register`, recovery `/forgot-password` use the system
browser with fixed main-owned URLs. Migrated-account reset preserves ownership and revokes
old sessions. No new OAuth/API-key/JWT mechanism is introduced.

Errors have `{error:{code,message,fields?:Record<string,string>}}`:

| Status | Client behavior |
| --- | --- |
| 400 | Show field/query/category validation error; preserve draft. |
| 401 | Expired/missing session or invalid credentials; clear stale signed-in state for protected calls and offer sign-in/recovery. |
| 403 | Distinguish ownership denial from invalid Origin/configuration; no retry as another identity. |
| 404 | Missing category/resource/path; refresh selection. |
| 409 | Stored resource XML unavailable; metadata may remain browsable, import stays disabled/failed with explanation. |
| 410 | Removed resource; refresh lists; do not change existing local copies. |
| 413 / 415 | Too large/unsupported media; actionable rejection, never truncate. |
| 429 | Honor bounded parsed Retry-After for feedback/disabled retry; do not automatically resubmit writes. |
| 408 / 503 / 504 | Timeout/unavailable; preserve context and classify a sent write conservatively as uncertain. |
| 405 / invalid JSON / unexpected status | Protocol/configuration failure, not empty results. |

Once a publish may have reached the service, transport failure, timeout, proxy error,
invalid success payload or lost response can mean a committed write. **No automatic publish
retry**. Keep the draft, refresh My submissions, and ask the user to decide on another attempt.
Owner removal is state-idempotent, but refresh uncertain results before an explicit retry.
Local sign-out clears proof even offline and reports whether remote revocation was confirmed.

Public GET smoke checks are safe on production. Authenticated/write/expiry/race tests belong
to the isolated service harness and desktop test environment, not the live catalog.


## Remembered sign-in integration

The [server handoff](remember-me-api.md) is implemented by `fe19eca`: optional strict boolean,
existing response shapes, authoritative GET expiry and unchanged revocation/ownership rules.
The desktop sends the new member only when explicitly checked; ordinary login keeps the
compatible email/password-only body. Proof persistence/restoration is main-owned OS-protected
storage as described in contracts/desktop.md, never a renderer cookie/cache owner. Server-source
validation and isolated native/rendered acceptance are recorded in quickstart.md; Windows/Linux
native storage and full release gates remain pending.
