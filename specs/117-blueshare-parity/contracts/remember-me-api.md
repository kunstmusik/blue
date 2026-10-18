# Server handoff: optional remembered BlueShare sign-in

Status: **server implementation delivered** at `fe19eca23294e1ecb00f6847985ed9998868aff2`;
owner confirmed the server update on 2026-10-18. The requirements below remain the accepted
contract. Desktop integration uses the existing response shapes and verified native cookies.
No blue-site files were changed by the desktop agent.

Baseline reviewed: blue-site `20df3f93185b60a6677999a4820405215c9e4f3a`.
Existing API base: `https://blue3.kunstmusik.com/api/blueshare/v1`.

## Requested behavior

Allow a desktop user to opt into a session that survives restarting Blue for up to **seven days
from successful sign-in**. This is a fixed lifetime, not seven days of inactivity or a sliding
renewal. Desktop persistence is separately implemented by Blue; the server continues to own
session validity, expiry and revocation. Do not save passwords or add a new token/refresh API.

## API change

Extend `POST /session` to accept exactly these fields:

| Field        | Contract                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `email`      | Existing email validation; unchanged.                                                             |
| `password`   | Existing string validation; unchanged.                                                            |
| `rememberMe` | Optional JSON boolean; omission means `false`. Reject null, strings, numbers, arrays and objects. |

Example remembered login (synthetic credentials):

```http
POST /api/blueshare/v1/session
Content-Type: application/json
Origin: https://blue3.kunstmusik.com

{"email":"account@example.invalid","password":"example-only","rememberMe":true}
```

- Omitted or `false`: preserve the current 24-hour database session and session-cookie behavior.
  Existing desktop clients sending only email/password continue working unchanged.
- `true`: create a seven-day database session through the existing Better Auth sign-in handler.
  Allow Better Auth to issue its persistent signed cookies and correctly clear/replace any
  `dont_remember` marker. Keep all legitimate `Set-Cookie` headers; do not manufacture a separate
  desktop token or weaken HttpOnly, Secure, host/path or SameSite protections.
- Preserve strict rejection of all other fields and the 16 KiB login-body limit. Malformed
  `rememberMe` returns `400 INVALID_INPUT` in the existing error envelope, with a bounded field
  error for `rememberMe`. Existing 401/403/429/503 handling and rate limiting remain unchanged.
- Keep the successful POST response unchanged: `200 {"user":{"id":"…","name":"…","username":"…"}}`
  plus cookie headers. The client uses the existing GET to discover authoritative expiry.

`GET /session` remains `200 {user:{id,name,username},expiresAt:<UTC ISO string>}` for a valid
session, otherwise 401. For a new remembered login, expiry is seven days from creation; for an
ordinary login, 24 hours. Keep v1's `disableCookieCache:true` and `disableRefresh:true` behavior
for session/protected reads: requests must check database validity and must not extend expiry.
Do not trust a remembered cookie after its database session is revoked or expires.

`DELETE /session` remains the existing revocation contract: revoke the database session, return
`{signedOut:true}` only with the current confirmed-revocation semantics, and expire all applicable
auth cookies/remember markers. Remembered sessions must be revocable in exactly the same way.
Existing password-reset revocation and owner-only publish/list/remove authorization still apply.
Do not expose email, raw tokens or internal session records in response JSON or logs.

## Implementation locations and scope

- `src/lib/blueshare-validation.ts`: extend the strict `loginBody` schema with an optional boolean,
  defaulting to false. Preserve credential/body bounds and unknown-field rejection.
- `src/lib/blueshare-api.ts`: pass the validated choice to Better Auth instead of unconditionally
  overriding it with `rememberMe:false`. Keep the handler path, cookies, Origin checks and sanitized
  responses. Keep `currentSession` database checks and no-refresh policy.
- `src/lib/auth.ts`: ensure the effective remembered-session lifetime is seven days. The pinned
  installed Better Auth already defaults to seven days; make the policy explicit or otherwise
  lock it down in tests. Preserve cookie-cache disabling and password-reset revocation. Avoid
  changing unrelated website login behavior.
- `docs/BLUESHARE_API.md`: replace the email/password-only, forced-false, 24-hour-only statements
  with the optional field, both lifetimes and fixed-expiry semantics.
- Existing unit/integration tests: `scripts/blueshare-validation.test.mjs` and
  `scripts/integration/blueshare-api.test.mjs` (plus appropriate auth/session tests).

This reuses Better Auth's existing session records. No database schema change, new dependency,
new authentication protocol or new endpoint is expected. Verify that against the installed
version; do not rely on an untested upstream default or copy authentication-library source.

## Required evidence before desktop integration

Use synthetic accounts and a disposable service database/profile, never production write tests.
Use controlled time or database expiry fixtures rather than waiting days.

1. Omitted/false/true request validation passes; invalid types and unknown keys reject. Existing
   clients retain exactly the omitted-field behavior. Wrong credentials and missing/invalid
   Origin still reject; rate limiting and body limits remain effective.
2. Fresh false/omitted sessions expire at creation +24 hours; true at creation +7 days. GET reports
   the corresponding UTC expiry. Cookie persistence agrees with the chosen mode; all signed
   cookies/remember markers survive response forwarding with their security attributes intact.
3. Switching false→true and true→false in a cookie jar does not leave an old remember marker
   overriding the new choice. Failed sign-in does not create an authenticated remembered session.
4. Repeated GET/session and authenticated catalog operations do not advance expiry. Expired,
   revoked, and password-reset-invalidated sessions reject even if cookies remain on disk.
5. DELETE revokes remembered sessions and clears cookies. The old cookie jar cannot authenticate
   afterward; database deletion failure retains the existing honest error behavior.
6. Owner-only fetch/publish/remove and sanitized identity/error/log behavior remain intact for
   both modes. Existing service tests pass.

Return the implementation commit, updated API docs, exact validation commands/results and the
origin where the extension is deployed. The desktop must not send `rememberMe` to the old strict
endpoint until support is confirmed. If deployment is delayed, ship no seven-day persistence
claim and do not silently retry credentials or downgrade an opted-in request.


## Delivery evidence (2026-10-18)

Reviewed the clean blue-site commit `fe19eca23294e1ecb00f6847985ed9998868aff2`, updated
BLUESHARE_API.md and BLUESHARE_SERVICE_VERIFICATION.md. The server agent reports 16 unit tests,
25 integration tests including production build, lint/typecheck and whitespace passing. Desktop
independently reran all eight validation tests with Node 24.21.0. Its isolated actual-service
controller also verifies seven-day remembered sign-in, authoritative expiry, native cookie
snapshot, server-validated restoration, durable/remote logout and existing workflows with
original fixtures. See quickstart.md for commands/results and source/compiled fingerprints.
Production deployment confirmation is from the owner; no production credentials or writes were
used to independently authenticate against that deployment. This records delivery, not a new
server-side implementation request.
