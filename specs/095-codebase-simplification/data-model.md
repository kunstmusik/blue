# Data Model: Codebase Simplification & Overengineering Reduction

## Entities & Model Changes

### 1. Score & Layer Hierarchy (`@blue/data`)

The core score model is retained in full, while legacy Java GUI listeners, empty marker interfaces, and unused provider registries are pruned.

#### Retained Canonical Entities
* **`Score`** (`packages/blue-data/src/score/score.ts`): Root score container managing layer groups. Deserialization continues to directly instantiate `TrackLayerGroup`, `PatternsLayerGroup`, and `PolyObject` via their respective `loadFromXML()` methods.
* **`TrackLayerGroup`** (`packages/blue-data/src/score/track/track-layer-group.ts`): Container for sound object tracks. Implements standard `DeepCopyable<TrackLayerGroup>` using `deepCopy()`. Internal Swing `_listeners` array is removed.
* **`PatternsLayerGroup`** (`packages/blue-data/src/score/patterns/patterns-layer-group.ts`): Container for pattern layers. Implements standard `DeepCopyable<PatternsLayerGroup>` using `deepCopy()`. Internal Swing `_layerGroupListeners` array is removed.
* **`PolyObject`** (`packages/blue-data/src/sound-objects/poly-object.ts`): Container for polyphonic score objects and nested tracks. Implements standard `DeepCopyable<PolyObject>` using `deepCopy()`. Internal Swing `_layerGroupListeners` array is removed.

#### Deleted Interfaces & Classes
* **`LayerGroupProviderManager`** & **`LayerGroupProvider`** (`src/score/layers/`): Dynamic provider registry originally ported from Java NetBeans service lookups. Removed completely.
* **`TrackLayerGroupProvider`**, **`PatternsLayerGroupProvider`**, **`PolyObjectLayerGroupProvider`**: Concrete provider factories. Removed completely.
* **`LayerGroupListener`** & **`LayerGroupDataEvent`** (`src/score/layers/`): Java Swing mutation event classes. Removed completely.
* **`AutomatableCollectionListener`** (`src/automation/`): Unused mutation listener interface. Removed completely.
* **`ScoreObjectLayerGroup`**, **`ScoreObjectLayer`**, **`AutomatableLayerGroup`**: Empty marker interfaces extending `LayerGroup` / `Layer`. Removed in favor of direct base types.
* **`DeepCopyableLG`**: Java generic collision workaround. Method `deepCopyLG()` is renamed/aliased to standard `deepCopy()`.

---

### 2. Clipboard Model (`@blue/data`)

* **`CopyBuffer`** (`packages/blue-data/src/copy-buffer.ts`): Static in-memory clipboard singleton ported from Java Blue. Removed completely.
* **Active Clipboard Owners**:
  * Score objects: `packages/blue-app/src/renderer/components/workbench/panels/score/score-clipboard-utils.ts`
  * Pattern layers: `packages/blue-app/src/renderer/components/workbench/panels/score/patterns-clipboard-utils.ts`
  * Mixer channels: `packages/blue-app/src/renderer/components/workbench/panels/mixer/mixer-clipboard.ts`

---

### 3. Identity and Math Utilities

* **`generateUuid()`** (`packages/blue-data/src/utilities/uuid.ts`):
  * Previously: Custom 45-line byte masking with fallback pseudo-random number generator.
  * Updated: Standard wrapper calling native `crypto.randomUUID()`:
    ```typescript
    export function generateUuid(): string {
      return crypto.randomUUID();
    }
    ```
* **`clamp()`** (`packages/blue-data/src/utilities/math-utils.ts`):
  * Unified single implementation used across data and app packages:
    ```typescript
    export function clamp(val: number, min: number, max: number): number {
      return Math.min(Math.max(val, min), max);
    }
    ```

---

### 4. Exception Modeling

* **`SoundObjectException`** (`packages/blue-data/src/sound-objects/sound-object-exception.ts`):
  * Previously: Custom class manually wrapping `this.cause` and appending cause message.
  * Updated: Standard ES2022 `Error` constructor options:
    ```typescript
    export class SoundObjectException extends Error {
      constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'SoundObjectException';
      }
    }
    ```

---

### 5. Main Process State & Tracing

* **`EditorOpenDiagnosticCoordinator`** & attempt tracker (`packages/blue-app/src/main/editor-open-diagnostics.ts`, `track-editor-diagnostic-attempts.ts`): Removed completely.
* **Domain IPC Handlers**: Registered directly in their domain modules via `ipcMain.handle()` instead of staged through `MAIN_PROCESS_DOMAIN_IPC_ORDER`.
