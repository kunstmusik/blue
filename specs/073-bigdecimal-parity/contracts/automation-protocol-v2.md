# Contract: Automation Protocol Version 2

## Compatibility policy

The Blue app, `@blue/engine-client`, and bundled Blue Engine are changed and released together. Version 2 is an incompatible schema marker, not a promise to serve independently released legacy clients. There is no version-1 automation parser, dual-command transition, reserved `highPrecision` field, or lossy fallback in the new implementation.

The existing capability handshake MUST declare protocol version `2`. An accidentally mixed app/engine pairing MUST fail the handshake before automation publication. The feature list MUST include `automation-decimal-v1`.

## Commands

Command IDs remain stable inside the new protocol:

| Command | Code | Meaning |
|---|---:|---|
| `CREATE_AUTOMATION` | `0x20` | Create or replace an automation by channel name. |
| `UPDATE_AUTOMATION` | `0x21` | Update an existing automation by channel name. |

Both use the same payload. `DELETE`, `ENABLE`, `DISABLE`, `LIST`, and `CLEAR` keep their existing command IDs; any list representation that exposes resolution MUST return canonical decimal text rather than reconstructing it from a double.

## Payload

All integer and binary64 fields are little-endian.

```text
+----------------------+----------------------------------------------+
| Field                | Encoding                                     |
+----------------------+----------------------------------------------+
| channelName          | UTF-8 bytes terminated by one NUL            |
| curve                | u8                                           |
| enabled              | u8 (0 or 1 only)                             |
| resolutionLength     | u32-le                                       |
| resolution           | resolutionLength ASCII bytes                 |
| pointCount           | u32-le                                       |
| points               | pointCount × (time:f64-le, value:f64-le)     |
+----------------------+----------------------------------------------+
```

The outer command frame remains the existing:

```text
command:u8 + payloadLength:u32-le + payload[payloadLength]
```

`resolution` is the authoritative Java-canonical decimal text defined by `exact-decimal-resolution.md`. There are no duplicate resolution-double, scale, or precision-mode fields.

## Encoder contract

The public TypeScript automation API accepts:

```text
channelName
curve
enabled
resolutionDecimal
points
```

The encoder MUST validate or require already validated canonical resolution text and MUST NOT derive it from a JavaScript number. It MUST reject size arithmetic overflow before buffer allocation.

## Parser contract

Before mutating `AutomationStore`, native decoding validates:

1. outer payload length matches the received frame exactly;
2. channel NUL exists within the payload and channel text is valid/non-empty;
3. curve and Boolean encodings are known;
4. `resolutionLength` fits the remaining payload and configured request-size boundary;
5. resolution bytes are canonical ASCII and parse under the exact-decimal contract;
6. `pointCount × 16` cannot overflow and equals the remaining bytes exactly;
7. points satisfy the supported finite-input/order contract;
8. exact decimal and runtime workspace preparation succeeds.

Only after every check succeeds may the store publish the new revision. Update failure preserves the previous definition.

## Responses

Successful commands use the existing `Status::OK` response convention. Invalid commands use `Status::ERROR` with one stable machine-identifiable category and concise context. Required categories include:

- `AUTOMATION_PAYLOAD_INVALID`
- `INVALID_DECIMAL_SYNTAX`
- `DECIMAL_SCALE_OVERFLOW`
- `NON_FINITE_AUTOMATION_INPUT`
- `DECIMAL_WORKSPACE_UNAVAILABLE`
- `AUTOMATION_NOT_FOUND` for update semantics where applicable

Tests assert categories rather than platform-specific allocation or parser text.

## Realtime publication contract

The native parser/control thread publishes a fully prepared automation definition. The performance thread MUST NOT parse the decimal, resize caches, allocate the exact workspace, or construct error strings when adopting the revision. Prepared-resource reclamation occurs on the control thread.

## Required contract tests

- byte-exact encode/decode for `0.1`, `0.10`, exponent forms, negative scale, scale greater than 18, zero/negative values, and a large coefficient;
- truncation at every variable-length boundary;
- missing NUL, invalid UTF-8/name, invalid curve/Boolean, noncanonical or malformed decimal, count overflow, trailing bytes, and non-finite point bits;
- app engine bridge publishes the snapshot's `resolutionDecimal` unchanged;
- create/update round trip preserves canonical text and exact scale;
- protocol metadata/manifests/examples all declare version 2 and the same payload;
- an app/engine protocol mismatch fails before command publication;
- no encoder or parser exposes `highPrecision` as a behavioral argument.
