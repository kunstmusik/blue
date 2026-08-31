# Contract: Track Editor Runtime Status

## Purpose

Provide detached Track instrument windows with only the activity state needed to
start and stop runtime-dependent editor behavior, especially BlueX7 effective-value
observation. This intentionally does not install the workbench's broad IPC listeners.

## Typed payload

```ts
interface TrackInstrumentRuntimeStatus {
  sequence: number;
  playbackRunning: boolean;
  blueLiveRunning: boolean;
}
```

The payload is serializable and exposed through the Track instrument editor's preload
API as an initial query plus a subscription with an unsubscribe function.

## Main-process responsibilities

- Main is the canonical owner of playback and Blue Live activity.
- Main returns the current status to an authorized Track instrument window.
- Main publishes a new payload with a strictly increasing `sequence` whenever either
  flag changes.
- Delivery is limited to active, correctly bound Track editor windows.
- Window teardown removes subscriptions. If a conditional pooled shell is selected,
  a rebind invalidates all status work associated with the previous generation.

## Renderer responsibilities

1. Subscribe before or atomically with requesting the initial snapshot so an update
   cannot be lost between query and subscription.
2. Accept only payloads with a `sequence` newer than the last accepted value for the
   current binding.
3. Treat query/subscription failure, unload, or binding reset as
   `{ playbackRunning: false, blueLiveRunning: false }`.
4. Do not begin editor-specific live observation before the `editor-usable` milestone.
5. For BlueX7, begin observation when usable and either flag is true; preserve the
   existing 20 Hz cadence after startup.
6. Stop observation and clear runtime-only effective values when both flags are false,
   the target changes, or the window closes.

## Ordering and race rules

- Sequence numbers are scoped to the application session and never decrease.
- A newer subscription event wins over an older query result.
- A renderer must ignore status or observation results for a stale target identity.
- If pooling is implemented, it must also ignore results for a stale
  `bindingGeneration`.
- Status does not imply that the engine state request will succeed; polling failures
  retain existing retry/error behavior without changing canonical instrument values.

## Security and isolation

- The preload surface exposes booleans and a sequence only.
- The renderer receives no engine socket, process, filesystem, or unrestricted IPC
  access.
- Status messages do not contain project content or mutable engine handles.

## Verification cases

- Initial inactive, playback-only, Blue-Live-only, and both-active snapshots.
- Update delivered after initial query without loss or reversal.
- Older query/update ignored after a newer sequence.
- Closed or rebound window ignores delayed updates and readback results.
- BlueX7 performs no readback before editor usability.
- BlueX7 begins one observation loop at 20 Hz when activity becomes true and stops it
  when both flags become false.
- Generic and Blue Synth Builder editors do not start BlueX7 readback work.
