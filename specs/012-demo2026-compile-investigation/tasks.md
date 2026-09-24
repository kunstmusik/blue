# Spec 012: Demo2026 Compile Investigation — Closed

**Status**: Closed — compile failure fixed and demo2026 now matches the Java reference `01.csd` byte-for-byte (2026-04-18)

Do not execute the original open task list.

This spec was closed by the completed compile/parity work in `blue-electron`:

- `packages/blue-data/src/blue-data.ts`
	now matches Java CSD assembly order, score scheduling, formatting, and raw output layout for demo2026.
- `packages/blue-data/src/sound-objects/generic-score.ts` and `packages/blue-data/src/sound-objects/javascript-object.ts`
	now apply Java-aligned timing, note processing, and score parsing behavior.
- `packages/blue-data/src/time/time-duration.ts` and `packages/blue-data/src/time/time-position.ts`
	now preserve Java XML tag compatibility, including legacy fallbacks.
- `packages/blue-data/src/mixer/effect.ts` and `packages/blue-data/src/arrangement.ts`
	now match Java UDO formatting and mixer routing semantics.
- `packages/blue-app/src/main/engine-bridge.ts`
	carries the compile diagnostics needed to confirm the normal playback path is healthy.
- `packages/blue-data/tests/integration/score-scheduling-parity.test.ts`
	retains self-contained score scheduling and sound object timing regression coverage.

Use [STATUS.md](/Users/stevenyi/work/blue-electron/STATUS.md) as the authoritative current summary.

The developer-local Demo2026 parity cases were removed from automated tests on
2026-09-24. The verification below records the original 2026-04-18 closeout.

## Final Verification

- `pnpm --filter @blue/data build` passes
- `pnpm --filter @blue/data test -- --maxWorkers=1` passes with **31 test files / 424 tests**
- `diff -u ~/work/blue/demo2026/01.csd /tmp/01_generated.csd | wc -l` returns `0`
- `~/work/blue/demo2026/01.blue` renders successfully through the current `blue-electron` playback path

## Closeout Notes

- The original checklist assumed the fix would land through a narrower investigation harness. The final implementation closed the issue through a broader Java-parity pass across generation, score, XML, and mixer codepaths.
- Repository-level guidance now explicitly says to consult the Java implementation first for parity and behavior bugs (`AGENTS.md`, `CLAUDE.md`).
