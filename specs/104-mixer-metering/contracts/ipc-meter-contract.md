# IPC Meter Contract (Main → Renderer)

## Meter Binding Map

Sent once at playback start after CSD compilation.

**Channel**: `meter-binding-map`
**Direction**: Main → all workbench windows (via `broadcastToWorkbenchWindows`)
**Payload**:

```typescript
interface MeterBindingMapPayload {
  entries: Array<{
    kind: 'source' | 'sub' | 'master';
    csdKey: string;
    stripId: string;
    displayName: string;
  }>;
  nchnls: number;
}
```

## Meter Frame

Streamed during playback at ~30 Hz.

**Channel**: `meter-frame`
**Direction**: Main → all workbench windows (via `broadcastToWorkbenchWindows`)
**Payload**:

```typescript
interface MeterFramePayload {
  sequence: number;
  channels: Array<{
    csdKey: string;
    rms: number[];   // length nchnls, linear amplitude
    peak: number[];  // length nchnls, linear amplitude
  }>;
}
```

Values are sanitized before send: NaN/Infinity → 0.0.

## Meter Reset

Sent on playback stop, end, or engine failure.

**Channel**: `meter-reset`
**Direction**: Main → all workbench windows (via `broadcastToWorkbenchWindows`)
**Payload**: `{}` (empty object — the renderer resets all display state)

## Preload API

```typescript
// In preload.ts — exposed on window.blueAPI
onMeterBindingMap: (callback: (map: MeterBindingMapPayload) => void) => () => void;
onMeterFrame: (callback: (frame: MeterFramePayload) => void) => () => void;
onMeterReset: (callback: () => void) => () => void;
```

Each returns an unsubscribe function. The renderer calls these in the meter store
initialization to wire IPC to the transient meter state.

## Failure Modes

- If `meter-frame` arrives before `meter-binding-map`: frame is dropped (unknown binding).
- If `meter-binding-map` arrives with empty entries: meters remain inactive.
- If `meter-frame` sequence is ≤ last seen: frame is dropped (stale).
- If main process fails to decode engine meter data: frame is dropped silently; no error
  propagated to renderer.
