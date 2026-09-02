# Interface & Boundary Contracts: Codebase Simplification

## 1. Exported Symbols Removed from `@blue/data`

The following dead symbols are removed from `packages/blue-data/src/index.ts`:

| Removed Export | Reason | Replacement |
| :--- | :--- | :--- |
| `setCopyBuffer`, `getCopyBuffer`, `hasClipboardContent`, `clearClipboard` | Dead static clipboard from `copy-buffer.ts` | Workbench panel-specific clipboard utilities in `@blue/app` |
| `LayerGroupProviderManager` | Dead provider registry | Direct invocation of `loadFromXML` in `Score` |
| `LayerGroupProvider`, `TrackLayerGroupProvider`, `PatternsLayerGroupProvider`, `PolyObjectLayerGroupProvider` | Dead provider interfaces and factories | Concrete layer group classes |
| `LayerGroupListener`, `LayerGroupDataEvent` | Dead Swing-era listener and event types | Zustand reactive stores |
| `AutomatableCollectionListener` | Dead listener interface | Zustand reactive stores |
| `ScoreObjectLayerGroup`, `ScoreObjectLayer`, `AutomatableLayerGroup` | Empty marker interfaces | Base `LayerGroup` and `Layer` types |
| `DeepCopyableLG` | Java generics workaround interface | Standard `DeepCopyable<T>` interface |

---

## 2. Preserved Utility Signatures

### `generateUuid`
* **Path**: `packages/blue-data/src/utilities/uuid.ts`
* **Signature**:
  ```typescript
  export function generateUuid(): string;
  ```
* **Contract**: Returns a canonical lowercase RFC 4122 v4 UUID string matching `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
* **Implementation**: Calls `crypto.randomUUID()`.

### `SoundObjectException`
* **Path**: `packages/blue-data/src/sound-objects/sound-object-exception.ts`
* **Signature**:
  ```typescript
  export class SoundObjectException extends Error {
    constructor(message: string, cause?: unknown);
  }
  ```
* **Contract**: Standard `Error` subclass with `this.name = 'SoundObjectException'` and optional standard `cause`.

---

## 3. UI Floating Surface Contract (`@blue/app`)

* **Retired**: `computeFloatingPosition` and `getFloatingViewport` in `packages/blue-app/src/renderer/components/floating-position-utils.ts`.
* **Active Contract**: `useHostSurface` in `packages/blue-app/src/renderer/components/host-surface/use-host-surface.ts` following `docs/popout-popup-conventions.md`.
* **Consumer Migration**: `RuntimeDeviceField.tsx` positions its dropdown menu against the trigger button inside the panel's host document with realm-safe coordinates and dismissal.

---

## 4. Main Process IPC Registration Contract

* **Channels**: All IPC channels defined in domain modules (file, project, engine, audio, settings, libraries) remain unchanged.
* **Registration**: Each domain module exports a registration function (e.g. `registerProjectIpc(context)`) that directly registers handlers via `ipcMain.handle(channel, handler)` and listeners via `ipcMain.on(channel, listener)`.
* **Lease Cleanup**: Existing lease tracking in `ipc-registration.ts` cleans up handlers upon window destruction.
