# Contract: Blue Engine Batch Channels

## Purpose

Add bounded batch set/get operations to the versioned `@blue/engine-client` protocol so one BlueX7 editor does not require up to 151 serialized ZeroMQ round trips per update period and one accepted set becomes visible to Csound at a single control boundary.

## Capability

The native capability response advertises a batch-channel feature identifier and the protocol version that introduced it. Electron main must not send new commands until the capability handshake accepts them. An older engine produces a clear unsupported-runtime diagnostic; it must not silently fall back to unbounded polling.

## Commands

Command numbers are allocated from the channel-command range without changing existing values.

### Batch set payload

```text
count:u16
repeat count times:
  nameLength:u16
  name:utf8[nameLength]        # no NUL; non-empty
  value:f64 little-endian
```

Response is ordinary status plus an optional UTF-8 diagnostic. The engine validates the entire payload, every channel name, automation authority, and every finite value before enqueueing one immutable batch. Protocol validation failure enqueues nothing. While the engine is running, the performance thread applies every entry in that batch after one `csoundPerformKsmps` call and before the next automation/Csound cycle; IPC/ZMQ threads never call `csoundSetControlChannel` for an accepted live batch. The command succeeds only when the batch is accepted into the bounded performance queue.

### Batch get payload

```text
count:u16
repeat count times:
  nameLength:u16
  name:utf8[nameLength]
```

Success response payload:

```text
count:u16
repeat count times:
  value:f64 little-endian
```

Values correspond exactly to request order. If any channel is unavailable, the command returns error and no partial value list.

## Bounds and validation

- Count must be 1..151 for the BlueX7 caller; the engine may expose the same or a larger documented protocol maximum.
- Channel names must be valid UTF-8, non-empty, NUL-free, and within the existing engine channel-name limit.
- Total payload length is checked before allocation or indexing.
- All set values must be finite.
- Duplicate batch-set names are rejected to avoid order-dependent meaning.
- The live batch queue has a documented bound and returns an explicit retryable/busy diagnostic rather than dropping or splitting a batch.
- Truncated/trailing payload, count mismatch, unavailable channel, and destroyed/not-created engine are explicit errors.
- Existing single-channel commands remain source- and wire-compatible.

## Client API

```ts
EngineClient.setChannels(
  entries: readonly { name: string; value: number }[],
): Promise<{ ok: boolean; message: string }>;

EngineClient.getChannels(
  names: readonly string[],
): Promise<{ ok: true; values: number[] } | { ok: false; message: string }>;
```

`EngineBridge` exposes equivalent session-aware operations. Request serialization remains inside the client's existing single-request queue.

## Required tests

- Protocol encode/decode golden buffers, including non-ASCII UTF-8 names.
- Empty, oversized, duplicate, NUL, non-finite, truncated, trailing, and count-mismatch rejection.
- Native success and all-or-error behavior for set/get.
- Running-engine set applies on the performance thread between two observed k-cycles; a control-boundary probe sees exactly the old or new complete batch and never a partial set.
- Concurrent IPC submission does not call Csound setters concurrently with `csoundPerformKsmps`; queue-full and stop/rebuild races fail explicitly without splitting a batch.
- Response ordering and exact f64 values.
- Capability mismatch behavior.
- Existing single-channel protocol regression suite unchanged.
