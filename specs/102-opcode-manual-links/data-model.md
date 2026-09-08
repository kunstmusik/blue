# Data Model: Opcode Completion and Manual Links

## Csound Manual Root

App-wide program setting stored as `general.csoundManualUrl`.

| Field | Type | Rules |
|---|---|---|
| value | string | Absolute normalized URL; protocol exactly `https:` or `file:`; no credentials, query, or fragment; default `https://csound.com/manual` |
| ownership | fixed | Electron main program-settings document, never `.blue` |
| lifetime | persistent | Default-merged on load, updated by Settings save, reset with General panel |

Invalid user input fails the settings save and leaves the cached and on-disk last-valid snapshot untouched.

## Normalized Opcode Definition

| Field | Type | Rules |
|---|---|---|
| name | string | Display/completion name |
| manualId | string or absent | Trusted only after host-boundary validation |
| kind | call / statement / declaration | Drives conservative insertion |
| modernSyntax | string list | Authoritative upstream data when available |
| classicSyntax | string list | Authoritative upstream data when available |
| signatures | list | Required output/input types and placeholder names where known |
| summary/category/status/examples | optional | Omitted cleanly from help when absent |

No raw documentation line is considered safe insertion text by itself.

## Opcode Insertion Plan

| Field | Type | Rules |
|---|---|---|
| replacement range | document offsets | Covers only the accepted completion token |
| template | snippet or plain name | Required arguments/outputs only; sequential tab stops; no optional brackets |
| form | expression / classic statement / modern statement / name-only | Selected from current context and opcode kind |

The plan is disposable. Unresolvable or malformed metadata transitions directly to `name-only`.

## Manual Navigation Request

| Field | Type | Rules |
|---|---|---|
| manualId | string | Non-empty single logical segment; no slash, backslash, dot segment, or control character |

The renderer never supplies the configured root or complete target URL.

## Opcode Entry Target

| Field | Type | Rules |
|---|---|---|
| root | normalized URL | Reloaded from current main-owned settings |
| manualId | validated string | Encoded as exactly one path segment |
| url | URL | `<root>/opcodes/<encoded-id>/` |
| nativePath | native path or absent | Present only for `file:` after host conversion |
| availability | available / missing / indeterminate | Local deterministic; remote bounded classification |

For local targets, resolved native paths must remain within the resolved root and identify the expected built page. Native paths are never compared directly with URL text.

## Manual Navigation Result

| Field | Type | Meaning |
|---|---|---|
| disposition | opened / fallback | Whether the host accepted navigation |
| availability | available / missing / indeterminate | Probe outcome |
| reason | optional enum | invalid-request, invalid-setting, missing, probe-failed, open-failed |
| targetUrl | optional string | Validated derived target; never accepted back as authority |
| message | optional string | Safe user explanation without raw host error leakage |

```text
request
  -> invalid request/setting ----------------------> fallback
  -> valid target -> probe -> missing ------------> fallback
                           -> available -> open ---> opened | fallback(open-failed)
                           -> indeterminate -> open -> opened | fallback(open-failed)
```

Generated help exists before this transition and remains present for every result.
