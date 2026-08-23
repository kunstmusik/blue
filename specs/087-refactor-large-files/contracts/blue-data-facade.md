# Contract: BlueData façade (seam 3)

Preserved public contract of `packages/blue-data` with respect to the `BlueData`
aggregate. The class stays the single public entry point; `xml-policy.ts`,
`csd-policy.ts`, and `runtime-policy.ts` are package-internal (not added to
`src/index.ts`). Consumers: 177 `blue-app` files, `blue-cli`, tests.

## Public class API (unchanged signatures and semantics)

| Member | Notes for the extraction |
|---|---|
| `static loadFromString(xml: string): BlueData` | Delegates to `xml-policy`. Raw-XML migration (`UpgradeManager.performUpgrades`) still runs before deserialization. The load path assigns `renderStartTime/EndTime` directly (raw fields, not the invariant-carrying setters) and replaces `pluginDataXml` wholesale — the extracted code preserves these exactly. |
| `saveAsXML(): Element` / `saveToString(): string` | Delegates to `xml-policy`. Section order stays Java-fixed; `saveAsXML` still sets `this.version = BLUE_VERSION`; `pluginDataXml` children are cloned back verbatim (unknown-data preservation). |
| `toCSD`, `toCSDAsync`, `toDiskCSD`, `toDiskCSDAsync`, `toRealtimePlaybackCSD`, `toRealtimePlaybackCSDAsync` | One-line delegates to `csd-policy`. Sync and async pipelines are moved verbatim as two parallel functions — no unification in this feature. |
| `toBlueLiveCSD(...)` | Delegates to `csd-policy` (BlueLive pipeline + all-notes-off instrument). |
| `processOnLoad`, `processOnLoadAsync`, `processLiveDataOnLoad`, `processLiveDataOnLoadAsync` | Delegate to `runtime-policy`. |
| `usesJavaRuntime(): boolean` | Delegates to `runtime-policy` (whole-graph traversal). |
| Accessors/getters/setters for all 17 fields | Stay on the class, including `setRenderStartTime`'s invariant (`renderEndTime = -1` reset). |
| `deepCopy(): BlueData` | Stays on the class with the `remapInstanceReferences*` free functions. |

## Behavioral invariants

1. `.blue` round-trip fidelity: modeled values, unknown `<pluginData>` content, and
   structural XML compatibility are byte-stable for the same input (oracles:
   `blue-data-frozen-roundtrip`, `blue-data-root-compatibility`, fixture-based
   `migration/track-layer-migration-integration`).
2. CSD output determinism and copy safety are unchanged (oracles:
   `blue-data-csd-{determinism,copy-safety,scheduling,automation}`; Java parity via
   developer-local `demo2026`/`rhythmic` fixtures — run manually where available;
   `blue-live-csd`, `blue-data-{java,python-*}-runtime` for async paths).
3. Module dependency rule: policy modules import the aggregate as `import type` only;
   runtime imports are limited to modules that do not import `blue-data.ts` back
   (`serialization/*`, `migration/*`, `compile-data.ts`, child models). No runtime cycle.
4. Package remains browser-safe: static top-level ES imports only; no Node/DOM/Electron
   APIs in the new modules.

## Explicit in-scope deletions (not behavior changes)

Three grep-verified dead functions are removed during the move and recorded in the
boundary map: `registerNestedEffectOpcodes`, `applyOpcodeNameReplacements`,
`getBlueLiveAlwaysOnInstrumentId`. They appear only in generated `.d.ts` output today.

## Not part of this contract

- `RenderCsdResult` remains non-exported from `src/index.ts` (as today) and moves with
  `csd-policy.ts`.
- No public export is added for the policy modules (internal-first clarification).
- No setter/accessor API changes (e.g., adding a `pluginDataXml` setter to the public
  surface); the policy code uses internal access paths.
