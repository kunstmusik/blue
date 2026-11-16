# Project history footprint audit

Status: implemented and validated, 2026-11-10.

## Cause and completed fix

A preset or slider edit retained complete before/after project graphs. The cumulative admission check then rejected a roughly 2 MiB action when the total history reached 64 MiB, producing the misleading “Action of 2 MiB exceeds the 64 MiB history limit” message. Ordinary whole-entry eviction now handles cumulative growth, admission checks the complete action, and the dialog reports the applicable limit with accurate sizes.

## Scope

Every retained structural record now uses reversible graph deltas. There is no full-project before/after snapshot fallback in completed history, an active group's checkpoint, or a pending direct oversize proposal. Short scalar records remain compact values. Detached preparation may still construct transient project copies; this change addresses retained history size, not all allocation or latency costs.

The shared graph representation fixes the root retention boundary once, rather than introducing separate partial memento formats for every patch. It stores changed fields, collection spans and text spans, plus isolated blueprints for genuinely added/deleted objects. References to unchanged objects are numeric transient identities. Commit and replay apply validated deltas in place; unaffected canonical references survive. Recreated subgraphs preserve prototypes, cycles, shared references and editor sidecars. Nothing new is serialized to disk or exposed through IPC.

## Audit disposition

| Surface audited                                                         | Completed fix and evidence                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 32 BSB interface action variants                                    | Exhaustive typed action matrix for arrangement and Sound owners; every variant has commit/undo/redo or unchanged-selection assertions and bounded records with unrelated large project text.                                                                                                                                    |
| All BSB widget properties                                               | Common property applier now always captures owner deltas: value, appearance, text/file, geometry, names, ranges/resolution, bank entries, dropdown items, XY fields, group settings and automation schema. Additional schema/property matrix covers consequential parameter changes.                                            |
| Groups and preset operations                                            | Delta collection spans cover add/delete/move/reorder, import, preset capture/update/apply/rename/remove, randomize, edit/grid settings and embedded UDOs. Large unchanged presets and widget groups are excluded from retained payloads.                                                                                        |
| Arrangement, Track, effect and Sound ownership                          | Existing typed owner resolution; BSB-only preparation clones affected owners. Sound edits use its typed builder and no longer serialize/reparse the entire builder. Existing owner-specific and engine tests plus Sound matrix cover replay.                                                                                    |
| Score, notes and automation                                             | All static patch variants use graph deltas; existing round-trip family matrix now asserts bounded bytes with unrelated large project content. Recreated implementation arrays/point objects align stable identities. 10,000-point single moves/inserts stay below 8 KiB.                                                        |
| Orchestra, code and voice                                               | Same delta boundary, including add/delete/replace/renumber/conversion. Long changed text uses copied reversible spans; unchanged code is not retained.                                                                                                                                                                          |
| Mixer, effects and sends                                                | Same delta boundary; short scalar channel fields retain existing value records. Runtime replay preserves owner/parameter intent.                                                                                                                                                                                                |
| Blue Live, MIDI, project UDO, tempo/meter, Clojure                      | All structural classification families covered by existing round-trip matrix, now with footprint assertions. Clojure/editor identity sidecars are preserved.                                                                                                                                                                    |
| Mixed batches/groups                                                    | Scalar and graph groups merge earliest preimages/final postimages; temporary endpoints only where needed. No retained project copies. Group net-zero, cancellation, eviction rollback and saved/dirty state tests pass.                                                                                                         |
| Direct freeze/unfreeze, missing-audio relink, project library transfers | Shared detached direct structural adapter creates graph deltas. Pending approval retains a fixed-size fingerprint and revision/document fences, no project roots. Removed unused already-applied direct adapter after checking production callers; migrated its coverage to supported detached mutations.                       |
| Runtime replay hints                                                    | Drop cosmetic payloads; replace restart-only code/XML with internal bounded owner markers; deduplicate earliest inverse/latest forward live operations by semantic target. Preserve ordered incremental operations. Hints count toward byte limits, so genuinely large live data remains bounded by admission.                  |
| Receipts, proposals, checkpoints and caps                               | Fixed-size SHA-256 fingerprints, no retained request JSON/XML; checkpoint shares baseline ledger. Ordinary whole-entry eviction works at the cumulative limit. Completed default cap is 64 MiB/200 entries; one cancelable group allows a further budget temporarily, capped at 128 MiB total with shared records counted once. |

## Bugs caught while completing coverage

- Sound identity transfer used a nonexistent `getInstrument()` accessor. It now transfers through `getBlueSynthBuilder()`.
- Sound builder edits reparsed XML and replaced all widget identities. Typed candidate mutation now preserves them.
- Loaded preset groups could restore historical child order after an explicit reorder. Authored moves now update per-kind slots while retaining historical category interleaving, covered by save/load/history-copy tests.
- BSB inverse capture skipped controls before lazy parameters existed. Inverses now capture widget values without mutating canonical parameters, including multi-control undo/redo against both running performances.
- Inverse deduplication conflated instrument subfields, distinct controls and Track targets. Keys now distinguish semantic fields and stable owners.
- Getter-driven parameter normalization replaced unchanged ParameterList containers. It now retains the original container when the parameter sequence is identical.

## Read-only diagnostic on the reported project

Input: `~/work/blue/rhythmic/01.blue`, instrument 6. A temporary test loaded the file and edited only in-memory canonical data. No project content was copied to committed fixtures or written back; the temporary test was removed.

| Single action             | Estimated retained bytes |
| ------------------------- | -----------------------: |
| Slider value              |                    2,508 |
| Widget comment/appearance |                    1,728 |
| Slider maximum/schema     |                    3,646 |

The original whole-project record estimate was 2,594,550 bytes for an ordinary BSB edit. The new slider record is about 1,034 times smaller. These estimates include retained replay hints and metadata. These are deterministic byte estimates, not actual heap or elapsed-time measurements.

## Implementation validation and provenance

- Full `pnpm test`: PASS. App: 546 files, 6,272 passing tests, 15 existing skips. Data: 225 passing files, 3,152 passing tests, 5 existing skips and one skipped file. Engine-client: 47 tests; CLI: 22 tests. Java, all 14 native engine correctness tests and all 72 root script tests passed. Native tests ran with host access for shared memory.
- `pnpm lint`: PASS, including repository formatting and package checks.
- `pnpm --filter @blue/app build:main`: PASS. `pnpm --filter @blue/data build`: PASS.
- The complete BSB/Sound matrix and structural footprint audit passed 228 tests in two files. Focused graph/history/runtime/direct/coordinator tests and real engine integration also passed.
- `git diff --check`: PASS. No native UI interaction or opt-in timing acceptance run.

Original code only within existing GPL app and MIT data scopes. No dependencies, third-party code/assets, persisted schema or public IPC changes. LICENSING.md, affected metadata/notices and headers were reviewed. Java Sound, BSB slider, Preset and PresetGroup behavior was inspected at revision `3ca3f40579c48a023299a68130d8ab6b9e950974`; no Java implementation was copied. Java writes logical preset lists in order; TypeScript additionally preserves documented historical category interleaving, now updated for explicit authored reorders.

Genuinely large inserted/deleted subgraphs or replacement content still need their changed payload for lossless undo. Transient detached candidates and canonical/runtime graphs are outside the retained-history estimate; no global heap cap or responsiveness acceptance is claimed.
