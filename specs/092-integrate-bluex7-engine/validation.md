# Validation Record: Modern BlueX7 Engine and Automation

**Branch**: `092-integrate-bluex7-engine` | **Date**: 2026-08-27

This file records the validation evidence produced so far, exactly as required
by `quickstart.md`, and names the tasks that remain open. Completed phases:
Setup (T001–T004), Foundational (T005–T017), US1 (T018–T029), and the protocol
through runtime-sync core of US2 (T030–T032, T037–T044).

## 1. Provenance and generated-source check — PASS

- `pnpm --filter @blue/data generate:blue-x7 --check` passes: the generated
  `modern-orchestra.generated.ts` is byte-identical and all recorded current
  digests match. The pinned baseline digest
  `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda` (precursor
  commit `0482f608cae693516321fa7c3f1ccef31e6ee5e4`) remains recorded; the
  current maintained source digest reflects the Blue modifications listed in
  `provenance.json`. No transient-checkout access; the resource directory
  contains only `bluex7.orc`, `ATTRIBUTION.md`, `provenance.json`, and
  `LICENSES/Apache-2.0.txt` (regression-tested).

## 2. Portable data and CSD contracts — PASS

`pnpm --filter @blue/data test` — 173 files, **1716 tests, 0 failures**,
covering: 151 unique parameters (145 voice slots + 6 mask bits); every
transport slot and mask bit; legacy/additive XML round trips; unknown-node
preservation; stable same-owner IDs; disjoint copy IDs; whole-voice replacement
retaining identities and curves; shared sync/PMS mixed-XML policy; generated
CSD structure on the real three-BlueX7 TimewaveCanon project (one shared
module, per-instance transport tables, no legacy Pinkston remnants); host
wrapper semantics; the modern binding report; and compile-once global
orchestra with Track participation.

## 3. Engine protocol — PASS

- `pnpm --filter @blue/engine-client test` — 42 tests, 0 failures: batch
  golden layouts, UTF-8 names, duplicate/NUL/empty/oversized/non-finite
  rejection, response count/length mismatches, unchanged single-channel
  commands, capability negotiation with old-engine failure.
- `ctest --test-dir native/blue-engine/build-darwin-arm64-release` — **16/16
  passed**, including new batch set/get round trips through the real ZMQ
  handler (ordered f64 readback, all-or-error on missing channels,
  validation-before-write, duplicates/NUL/UTF-8/truncation/trailing-byte
  rejection, not-created-engine diagnostics) and the real-Csound bridge run.

## 4. Main/preload/project contracts — PASS (scoped to implemented tasks)

- `blue-x7-runtime-contract.test.ts`: target/update/readback validation and
  serializable result unions.
- `blue-x7-runtime-sync.test.ts`: owner resolution with duplicate names;
  stale session/revision, removed owner, malformed target, ID/key mismatch
  fail-closed; automation-authority matrix; hold -> 151-value batch ->
  release ordering; mid-flight failure clears the hold; visible-only
  readback with late/stale rejection; four owners with disjoint channels.
- `pnpm --filter @blue/app build:main` and `build:preload` pass.
- Not yet written: `score-automation-runtime-sync.test.ts` (US3 scope).

## 5. Renderer/browser behavior — PARTIAL

- `blue-x7-csound-preview.test.tsx` passes: modern transport preview, live
  wrapper body, catalog-driven binding report with active-note/next-note
  classes, and rejection of legacy dormant-field claims.
- Open (T047/T048): 20 Hz effective-value polling hook, editor
  gesture/readback binding, browser editor suites.

## 6–8. Csound render evidence (runs locally with Csound 7)

- All 32 algorithms render finite, audible output with peak ≤ 0.9
  (corpus-wide `giBlueX7OutputCalibration = 0.75`; worst observed 0.8919).
- Zero-mask silence; release completion with the 15 s safety cap (no stuck
  notes, no truncated tails); corrected 3-carrier metadata for algorithms
  6 and 20; accepted reference render hash locked
  (`f7332a5a769e4906af86a62d2d1e6ab272892fdcff8a796baac8cfb7baa85296`).
- Live active-note adaptation verified by render: silencing operator output
  levels mid-note drops the sounding output below -50 dB while the static
  reference hash proves hold=1 behavior is unchanged.
- Full generated live-capable CSD (BlueData -> toCSD -> Csound) renders
  end-to-end with finite, calibrated output.
- Not yet run: the 60 s/four-owner/32-note/600-update stress harness
  (T067/T069) and the 100-repeat atomic-voice observation loop (SC-006).

## 9. Full handoff validation

- `git diff --check` passes.
- Repository-wide `pnpm test`, `pnpm lint`, and the remaining builds are
  pending completion of the open tasks below.

## Open tasks

- US2 remainder: T033–T036 (live integration suites for next-note capture,
  held publication, preload/IPC and renderer tests), T045–T048 (main.ts
  routing, IPC/preload methods, effective-values hook, editor binding).
- US3: T049–T060 (score timeline automation).
- US4: T061–T069 (multi-instance stress evidence).
- US5: T070–T077 (migration fixtures/docs).
- Polish: T078–T085 (audits, full validation record, docs).
