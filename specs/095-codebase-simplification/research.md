# Research: Codebase Simplification & Overengineering Reduction

## Decision 1: Removal of Java Swing-Era Listeners and Provider Hierarchy from `@blue/data`

* **Decision**: Delete `LayerGroupProviderManager`, `LayerGroupProvider`, `TrackLayerGroupProvider`, `PatternsLayerGroupProvider`, `PolyObjectLayerGroupProvider`, `LayerGroupListener`, `LayerGroupDataEvent`, and `AutomatableCollectionListener`.
* **Rationale**:
  * In Java Blue, `LayerGroupProviderManager` and its providers were used as a dynamic service-provider registry for layer groups, while `LayerGroupListener` was used for Swing GUI event dispatching.
  * In `@blue/data`, `Score.loadFromXML()` directly calls `TrackLayerGroup.loadFromXML()`, `PatternsLayerGroup.loadFromXML()`, and `PolyObject.loadFromXML()`. The manager is never populated or queried.
  * In Blue Electron, UI reactivity is owned by Zustand stores and React render trees fed by immutable project snapshots. No code subscribes to `LayerGroupListener` or `AutomatableCollectionListener`.
* **Alternatives considered**:
  * *Keep no-op stubs*: Retaining empty provider registries and listener arrays adds cognitive clutter and violates Principle I (clean data core). Direct deserialization is already the established pattern in `Score`.

---

## Decision 2: Elimination of Static `CopyBuffer` in `@blue/data`

* **Decision**: Delete `copy-buffer.ts`, `copy-buffer.test.ts`, and their re-exports in `packages/blue-data/src/index.ts`.
* **Rationale**:
  * `CopyBuffer` mirrored Java Blue's single static clipboard (`setCopy`, `getCopy`, `hasContent`, `clear`).
  * In the Electron application, copy/paste operations are handled within specific editor domains (e.g. `score-clipboard-utils.ts`, `patterns-clipboard-utils.ts`, and library transfer dialogs) with domain-specific re-keying and clone safety rules.
  * `CopyBuffer` is never imported or called by `@blue/app` or `@blue/cli`.
* **Alternatives considered**:
  * *Bridge to Electron clipboard*: The system clipboard holds serialized strings/MIME types, whereas `CopyBuffer` held in-memory class instances. Domain utilities already handle serialization; an in-memory static clipboard is obsolete.

---

## Decision 3: Pruning Empty Marker Interfaces and Java Collision Workarounds

* **Decision**: Remove empty interfaces `ScoreObjectLayerGroup`, `ScoreObjectLayer`, and `AutomatableLayerGroup`. Replace `DeepCopyableLG` and `deepCopyLG()` with standard `DeepCopyable` and `deepCopy()`.
* **Rationale**:
  * In TypeScript, structural typing makes empty interfaces (`export interface Foo extends Bar {}`) completely redundant.
  * In Java, `ArrayList` defined `clone()`, which caused return-type conflicts with Java generics when implementing `DeepCopyable<T>`, necessitating `DeepCopyableLG` with method `deepCopyLG()`. In TypeScript, `Array<T>` has no `deepCopy()` method, so layer groups can implement standard `deepCopy()` uniformly.
* **Alternatives considered**:
  * *Keep type aliases*: `type ScoreObjectLayer<T> = Layer & Array<T>` could be kept, but direct use of `Layer` or `LayerGroup<T>` is simpler and already clear.

---

## Decision 4: Standard Platform Modernization

* **Decision**:
  1. Replace custom byte masking, hex formatting, and `Math.random` fallback in `uuid.ts` with standard `crypto.randomUUID()`.
  2. Migrate `RuntimeDeviceField.tsx` to `useHostSurface` (backed by `@floating-ui/dom`) and remove `floating-position-utils.ts`.
  3. Replace `SoundObjectException` subclass with standard `new Error(message, { cause })`.
  4. Consolidate duplicated `clamp(val, min, max)` implementations into shared math utilities.
* **Rationale**:
  * The execution baseline is Node >= 20 and Electron 35 (Chromium 134). Standard web and Node APIs (`crypto.randomUUID()`, `structuredClone`, `Error.cause`) are universally supported.
  * Spec 090 established `@floating-ui/dom` via `useHostSurface` as the standard mechanism for host-realm floating positioning. `RuntimeDeviceField.tsx` was the lone straggler using legacy hand-rolled geometry.
* **Alternatives considered**:
  * *Keep UUID fallback for edge environments*: All target platforms (Electron main, preload, renderer, Node CLI, Vitest) have global `crypto.randomUUID()`. Fallback bit-masking is dead weight.

---

## Decision 5: Main Process Architectural Pruning

* **Decision**:
  1. Remove `editor-open-diagnostics.ts` and `track-editor-diagnostic-attempts.ts`.
  2. Flatten `MAIN_PROCESS_DOMAIN_IPC_ORDER` and handler staging maps in `main-process-domain-ipc.ts` to register directly via `ipcMain.handle()` in their respective domain modules.
* **Rationale**:
  * Spec 093 diagnostics was a transient instrumentation suite for diagnosing an audio glitch during editor window open. The glitch was fixed and verified; the tracing infrastructure remains disabled by default and adds ~670 lines of dead code.
  * `MAIN_PROCESS_DOMAIN_IPC_ORDER` sliced 5 channel arrays into 14 fragments to preserve the arbitrary registration sequence from before a refactor. Electron looks up handlers by channel name in a hash map; registration order has zero semantic impact.
* **Alternatives considered**:
  * *Keep diagnostics behind an environment variable*: Retaining 6 classes and 4 interfaces for a solved bug creates unnecessary maintenance drag. Standard debug logging suffices for future investigation.

---

## Decision 6: Retaining `quickjs-emscripten` in `blue-cli` and `tailwind-merge`/`clsx` in `@blue/app`

* **Decision**: Keep `quickjs-emscripten` in `packages/blue-cli/package.json` dependencies, and keep `tailwind-merge`, `clsx`, and `cn.ts` in `@blue/app`.
* **Rationale**:
  * `esbuild` bundles `@blue/data` into `dist/blue-cli.cjs` but marks `quickjs-emscripten` as `external` due to WebAssembly/native binaries. Standalone CLI installs require it declared in `package.json` to resolve at runtime.
  * `clsx` and `tailwind-merge` provide safe class conflict resolution (especially for Blue's custom typography tokens in `cn.ts`). Standardizing on `cn()` across all UI components will be handled in a dedicated styling normalization spec.
