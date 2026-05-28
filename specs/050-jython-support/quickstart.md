# Quickstart: Jython Runtime Support

## Prerequisites

- Java 17 or newer available as `java`.
- Maven available through the existing `@blue/java-runtime` package scripts.
- Repository dependencies installed with `pnpm install`.

## Build and Test Commands

Run helper-side Jython tests:

```bash
pnpm --filter @blue/java-runtime test
```

Build helper and runtime assets:

```bash
pnpm --filter @blue/java-runtime build
```

Build `@blue/data` after touching runtime-aware models or tests:

```bash
pnpm --filter @blue/data build
```

Run the full data-layer suite:

```bash
pnpm --filter @blue/data test
```

Run the focused Jython data regressions when iterating on Python runtime behavior:

```bash
pnpm --filter @blue/data exec vitest run src/instruments/python-instrument.test.ts src/instruments/python-instrument-runtime.test.ts src/blue-data-python-instrument-runtime.test.ts src/blue-data-java-runtime.test.ts src/note-processors/deferred-python-processor.test.ts src/note-processors/processor-serialization-parity.test.ts src/note-processors/note-processor-snapshot.test.ts src/note-processors/python-processor-runtime.test.ts src/note-processors/note-processor-chain-runtime.test.ts src/blue-data-python-processor-runtime.test.ts src/sound-objects/python-object-runtime.test.ts src/sound-objects/object-builder-runtime.test.ts src/sound-objects/clojure-object-runtime.test.ts tests/integration/note-processor-chain-roundtrip.test.ts --maxWorkers=1
```

Run app-side Java runtime and project integration tests:

```bash
pnpm --filter @blue/app test
```

Build the app package:

```bash
pnpm --filter @blue/app build
```

Final hygiene:

```bash
.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks
git diff --check
```

## Required Jython Processing Fixtures

### PythonObject basic score

Code:

```python
score = "i1 0 2 3 4 5"
```

Expected: parsed note has instrument `1`, start `0`, duration `2`, and p-fields `3 4 5`.

### PythonObject persistent setup

On-load/setup object:

```python
def make_score():
    return "i1 0 1 8.00"
```

Later object:

```python
score = make_score()
```

Expected: later object renders after setup object has run in the same project Jython session.

### Packaged library import

Code:

```python
from orchestra import *
from pmask import *
score = "i1 0 1 8.00"
```

Expected: imports succeed without user configuration.

### ObjectBuilder BSB replacement

ObjectBuilder code before replacement:

```python
score = "i1 0 <duration> <pitch>"
```

Expected: runtime receives code with BSB values substituted before Jython evaluation.

### PythonInstrument generation

Instrument code:

```python
instrument = "aout oscili 32000, 440, 1"
```

Expected: generated CSD instrument body contains the returned text.

### PythonProcessor note mutation

Processor code:

```python
for note in noteList:
    note.setPField("0.25", 2)
    note.setPField("77", 5)
```

Expected: output note start time and p5 reflect the mutation.

### Jython reinitialize

1. Evaluate `foo = 12`.
2. Evaluate `score = str(foo)` and confirm it works.
3. Reinitialize Jython.
4. Evaluate `score = str(foo)` again.

Expected: final evaluation fails with a structured Jython evaluation error because `foo` is no longer defined.

## Manual Smoke Scenarios

1. Open a project containing PythonObjects that use one setup object and one dependent object.
2. Test the dependent object from the score-object editor and verify output.
3. Generate CSD and confirm PythonObject output appears in score text.
4. Open a project using `from pmask import *` and confirm render/test does not fail on import.
5. Add a PythonInstrument and confirm generated orchestra text is non-empty.
6. Add a PythonProcessor to a chain and verify note output changes.
7. Use the score-object editor's `Reinitialize Jython` control and rerun a dependent object to confirm setup state must be rebuilt.
8. Temporarily move `packages/blue-app/assets/java/pythonLib` out of the way and verify the app reports a structured unavailable/import error without losing project XML.

## Exit Criteria

- Helper JUnit tests cover Jython library path setup, import checks, score-object evaluation, ObjectBuilder evaluation, instrument evaluation, note-list processor mutation, reinitialize, and error paths.
- Vitest coverage proves PythonObject, ObjectBuilder, PythonInstrument, and PythonProcessor route through injected runtime clients, preserve XML without Java, and surface stable mapped runtime errors in Electron main.
- Existing SPEC 049 Clojure tests still pass.
- `pnpm --filter @blue/java-runtime test`, `pnpm --filter @blue/java-runtime build`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, prerequisite checks, and `git diff --check` pass before closeout.
