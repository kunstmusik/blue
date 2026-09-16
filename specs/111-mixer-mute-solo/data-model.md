# Data Model

## Canonical state

| Entity | Fields | Rules |
| --- | --- | --- |
| ProjectProperties | trackLayerMuteSoloMode: audio/event; raw XML value/presence metadata | New Audio, loaded absence/invalid Event. Preserve unsupported raw value until explicit replacement. |
| Track | Existing muted, solo, uniqueId | Independent event state; active only in effective Event mode. |
| Channel | Existing muted, solo, association, routing/chains | Mute for all; active solo for non-master only. Preserve inactive master solo. |
| Mixer | Existing enabled | False forces header Event without changing saved preference or flags. |

BlueData remains canonical owner; existing .blue XML is the only durable store. Preserve unrelated unknown data through existing XML policy. Do not serialize route masks, UI capabilities, engine tokens, runtime diagnostics or applied revisions.

## Derived editor state

- effectiveTrackLayerMuteSoloMode: Event if mixer disabled, otherwise parsed preference.
- soloAvailable: false on master; separate from mixer-bypass disabled state.
- outputExcludedBySolo and hasIncludedSend: distinguish silent dry output from surviving wet routes.
- modeDiagnostic and legacyMixerStateNotice: load-derived notices, not persisted settings.
- Existing runtime outcome: desired/applied revision per performance and failure state.

Header intents include existing revision guarding and expected effective mode/association so main can reject stale domain selection. Channel reconciliation preserves stable association rather than matching display names.

## Render topology and bindings

MixerRouteGraph contains detached channel nodes (compile ordinal, kind, explicit flags) and ordered edges (source, target, output/send kind, chain position, enabled state, gate ordinal). Master terminal output is represented explicitly. Model objects are not modified.

MixerGateState contains 0/1 targets and derived output/send inclusion. Fader/send amounts remain independent. Solo exclusion is never written into Channel.muted. Master solo is excluded from solo discovery.

CompiledMixerGateBindings contains topology locators, two bank names per gate, initial targets, commit/applied token names and routing signature. Main attaches canonical editor IDs captured before cloning and scopes the catalog to documentId, performanceKind and generation. No new durable ID migration.

## Runtime transitions

1. M/S edit: validate → ProjectHistory commit → canonical snapshot → detached gate vector → stage inactive bank → publish commit → observe applied token → runtime applied outcome.
2. Undo/redo: restore through existing history and run the same derivation/publication; preserve identities, references, dirty state and associations.
3. Mode change: one history action; leave both flag sets untouched; publish new header authority; event inclusion changes remain restart-required.
4. Mixer disable/enable: existing history action; force/remove Event override; preserve saved state; restart-required.
5. Master-solo edit: reject the entire edit before commit. Loading/copying old master solo remains allowed and inert.
6. Runtime failure: retain canonical intent and accurate pending/failed status; staging failure leaves old audible bank. Uncertain commit acknowledgment requires observing the applied token. New generation initializes latest canonical state.
7. Export: derive detached policy and unpruned duration, optionally prune certified clips, produce artifact; no history entry or dirty-state change on success/failure.
