# Status: Jython Runtime Support

**Date**: 2026-05-28  
**Branch**: `050-jython-support`  
**State**: Closed and validated

## Summary

Spec 050 is closed. The SPEC 049 Java helper now supports project-scoped Jython execution alongside Clojure, packages Java Blue's Python libraries with the app, and wires PythonObject, Python-language ObjectBuilder, PythonInstrument, and PythonProcessor through the existing Electron main runtime bridge without breaking `@blue/data`'s browser-safe constraints.

Closeout also finished the missing app-side Jython error-formatting layer instead of leaving it as a follow-up. Electron main now maps the stable helper error codes into consistent user-facing messages, while the renderer exposes a dedicated Jython reinitialize/status control for Python-backed score-object editors.

## Handoff State

- `.specify/feature.json` points to `specs/050-jython-support`.
- Current branch is `050-jython-support`.
- `spec.md` status is `Closed`.
- `quickstart.md`, `tasks.md`, `status.md`, package READMEs, and top-level `STATUS.md` are updated for closeout.
- All Spec 050 tasks are checked off.
- Manual smoke scenarios remain listed in `quickstart.md` if one more local end-to-end pass is desired.

## Delivered Scope

- Packaged `org.python:jython-standalone:2.7.4` and Java Blue's `pythonLib` assets for both helper resources and Electron app assets, with library-path resolution for development and packaged layouts.
- Added persistent helper-side Jython session management, import checks, generic script evaluation, score-object evaluation, ObjectBuilder evaluation, instrument evaluation, note-list mutation, reinitialize, and structured stdout/stderr/error envelopes.
- Extended the shared runtime protocol, Electron main runtime client/session manager, preload bridge, and helper startup flow to carry Jython methods and library roots without disturbing the existing Clojure session model.
- Added first-class `ObjectBuilder` and executable `PythonProcessor` models to `@blue/data`, plus async Jython-backed execution for `PythonObject`, Python `ObjectBuilder`, `PythonInstrument`, and note-processor chains.
- Threaded Java-aware async generation through generated CSD, playback/export, score-object test flows, and score on-load processing.
- Added renderer-side Jython runtime recovery affordances and stable Electron-main error formatting for mapped Jython, protocol, and transport failures.

## Validation

- `pnpm --filter @blue/java-runtime test` - pass
- `pnpm --filter @blue/java-runtime build` - pass
- `pnpm --filter @blue/data build` - pass
- `pnpm --filter @blue/data test` - pass (`123` files, `1173` tests)
- `pnpm --filter @blue/data exec vitest run src/instruments/python-instrument.test.ts src/instruments/python-instrument-runtime.test.ts src/blue-data-python-instrument-runtime.test.ts src/blue-data-java-runtime.test.ts src/note-processors/deferred-python-processor.test.ts src/note-processors/processor-serialization-parity.test.ts src/note-processors/note-processor-snapshot.test.ts src/note-processors/python-processor-runtime.test.ts src/note-processors/note-processor-chain-runtime.test.ts src/blue-data-python-processor-runtime.test.ts src/sound-objects/python-object-runtime.test.ts src/sound-objects/object-builder-runtime.test.ts src/sound-objects/clojure-object-runtime.test.ts tests/integration/note-processor-chain-roundtrip.test.ts --maxWorkers=1` - pass (`14` files, `87` tests)
- `pnpm --filter @blue/app test` - pass (`126` files, `1329` passed, `2` skipped)
- `pnpm --filter @blue/app build` - pass
- `pnpm --filter @blue/app exec vitest run src/main/java-runtime/java-runtime-errors.test.ts src/main/java-runtime/java-runtime-session.test.ts --browser.enabled=false --maxWorkers=1` - pass (`2` files, `10` tests)
- `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` - pass
- `git diff --check` - pass

## Next Recommended Step

Spec 050 can be treated as closed. The next useful step is selecting the next Java-backed parity slice or running the optional manual smoke scenarios from `quickstart.md` if one more local UI pass is wanted.
