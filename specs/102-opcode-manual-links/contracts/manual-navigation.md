# Contract: Csound Manual Navigation

## Setting contract

- Key: `general.csoundManualUrl`
- Default: `https://csound.com/manual`
- Accepted protocols: `https:`, `file:`
- Rejected: relative values, credentials, query strings, fragments, unsupported schemes, malformed URLs
- Entry layout: `<root>/opcodes/<encoded-manual-id>/`
- Reset owner: existing General Settings reset
- Persistence owner: main-process `program-settings.json`

## IPC contract

```ts
interface OpenCsoundManualRequest {
  manualId: string;
}

type ManualAvailability = 'available' | 'missing' | 'indeterminate';

interface OpenCsoundManualResult {
  disposition: 'opened' | 'fallback';
  availability: ManualAvailability;
  reason?: 'invalid-request' | 'invalid-setting' | 'missing' | 'probe-failed' | 'open-failed';
  targetUrl?: string;
  message?: string;
}
```

## Host behavior

1. Load the current main-owned setting; never trust a renderer-supplied root or URL.
2. Validate and normalize the root again at use time.
3. Validate `manualId` as one logical segment, encode it, append fixed `opcodes/` and trailing `/`, and verify containment.
4. For `file:`, convert only at the host boundary and confirm the built entry page exists and is readable.
5. For `https:`, perform a bounded preflight. Classify `404` and `410` as missing; 2xx and redirects as available; method rejection, authentication, server errors, timeout, and transport errors as indeterminate.
6. Do not call an OS opener for invalid or missing targets. Open remote HTTPS with the external URL operation. Open local entries through the native path operation after file-URL conversion.
7. Return `fallback` for validation, confirmed-missing, or launch failure. Never throw raw host errors across IPC.

## Security invariants

- Unsupported schemes never reach Electron shell operations.
- Slash, backslash, dot segment, control character, and empty identifiers are rejected before encoding.
- Local resolved paths remain beneath the configured built-manual root.
- External content is never rendered by a Blue renderer.
- Documentation opening never creates an editor transaction or project mutation.

## UI behavior

- Generated help remains visible while navigation is pending and after failure.
- Missing, invalid, or open failure produces a non-blocking notice and leaves caret, selection, and document unchanged.
- An indeterminate HTTPS target may open because a browser can succeed when preflight cannot; it is not reported as verified availability.
- Successful OS launch does not prove that the browser later rendered a valid page; the contract makes no such claim.
