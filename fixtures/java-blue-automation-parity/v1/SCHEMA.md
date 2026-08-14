# Java Blue Automation Parity Fixture Corpus - Schema v1

One logical, versioned development artifact owned by this repository. The
canonical directory is `fixtures/java-blue-automation-parity/v1/` and contains:

```text
manifest.json    provenance, seed, command, and section/category counts
SCHEMA.md        this file
realtime.tsv     Java Line.getValue(double) expectations as raw binary64 bits
resolution.tsv   Java Parameter/Line resolution XML and decimal expectations
offline.tsv      Java CSDRender parameter-automation text as base64 bytes
```

The corpus is a committed development artifact, not user state. Regeneration is
a deliberate maintainer action (`pnpm fixtures:java-automation -- --java-blue-root ...`)
performed only against the pinned Java Blue revision recorded in
`manifest.json`. Normal test runs never invoke Java.

## Common TSV rules

- UTF-8, LF line endings, one header row, no BOM.
- Fields are tab-separated. A field never contains a literal tab or newline.
- Empty field means absence where the section schema permits it.
- Every record begins with `caseId`, `origin`, `category`.
- `origin` is `curated` or `seeded`.
- Every binary64 input/output is exactly 16 lowercase hexadecimal digits
  containing the raw IEEE 754 bits (e.g. `3fb999999999999a` for 0.1).
- Point lists use `timeBits:valueBits` entries separated by `;`
  (e.g. `0000000000000000:3ff0000000000000;4059000000000000:4000000000000000`).
- Expected failures use a stable diagnostic category (see
  `Diagnostic categories`), never full exception text.
- Arbitrary output text is base64 of the exact UTF-8 bytes.
- `caseId` values are stable: seeded rows are `rt-seed-0001`..`rt-seed-2048`;
  curated rows use a `c-` prefix with a descriptive slug.
- Files are sorted by `caseId` in a stable ASCII order.

## Diagnostic categories

Expected failures record one of these stable categories instead of Java
exception text:

```text
NON_FINITE_AUTOMATION_INPUT     NaN/Infinite value or time reaches Java BigDecimal
INVALID_DECIMAL_SYNTAX          Java BigDecimal(String) rejects the text
DECIMAL_SCALE_OVERFLOW          parsed scale outside signed 32-bit range
```

## `manifest.json`

Required fields:

```text
schemaVersion = 1
generator.id / generator.version
java.release                       # major JDK release used to generate
javaBlue.repository
javaBlue.commit                    # exact 40-character SHA
javaBlue.sourceFiles[]             # { path, sha256 } of each reference file
referenceMethods[]                 # oracle methods that produced expectations
seed.algorithm = "SplitMix64"
seed.value                         # fixed hexadecimal seed
generationCommand                  # uses $JAVA_BLUE_ROOT, never a local path
counts.total / counts.bySection / counts.byOrigin / counts.byCategory
```

The manifest MUST NOT contain a generation timestamp, absolute checkout path,
JVM vendor build, hostname, or nondeterministic ordering.

## `realtime.tsv`

Header:

```text
caseId  origin  category  resolutionText  curve  pointsBits  evaluationTimeBits
expectedKind  expectedBits  expectedCategory  sampleRateBits  sampleNumberBits
```

- `resolutionText` is the exact Java-canonical decimal text of the resolution
  (`-1` when unquantized).
- `curve` is `LINEAR`; realtime expectations are authoritative Java
  `Line.getValue(double)` results. Quantizer-only extension-curve cases are not
  part of this schema version.
- `expectedKind` is `bits` or `exception`. For `bits`, `expectedBits` holds the
  raw result bits; for `exception`, `expectedCategory` holds a diagnostic
  category and `expectedBits` is empty.
- `sampleRateBits`/`sampleNumberBits` are empty for direct evaluator cases.
  The manager-level subset fills both; consumers derive the evaluation time
  from `sampleNumber / sampleRate` (IEEE 754 double division) to exercise the
  production elapsed-time boundary. `evaluationTimeBits` still records the
  resulting double for cross-checking.
- The section contains exactly 2,048 seeded finite linear cases
  (`rt-seed-*`) generated with the documented generator-owned SplitMix64
  implementation, plus curated cases (`c-rt-*`) covering at least:
  empty/single/time-zero/direct point/endpoints, duplicate point times and
  last duplicate selection, before-first and after-last behavior, ascending/
  descending/flat/zero crossing, exact grid and adjacent binary64 values,
  `+0.0`/`-0.0`/subnormal/near-overflow/diagnostic non-finite values, and
  resolutions with scale zero, negative scale, trailing zeros, exponent
  notation, scale greater than 18, positive underflow-to-zero, and coefficient
  magnitudes not recoverable from a double.

## `resolution.tsv`

Header:

```text
caseId  origin  category  operation
parameterBdText  parameterLegacyText  lineBdText  lineLegacyText
snapValueBits  snapMinBits  snapMaxBits
expectedCoefficient  expectedScale  expectedCanonicalText
expectedDoubleBits  expectedActivation
expectedParameterSaveBase64  expectedLineSaveBase64
expectedSnapBits
expectedKind  expectedCategory
```

- `operation` is one of:
  - `parse` - parse `parameterBdText` as an exact decimal
    (Java `new BigDecimal(String)`); legacy fields empty.
  - `legacy-normalize` - normalize `parameterLegacyText` as binary64 through
    Java's `new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros()`.
  - `parameter-load-save` - load a Parameter/line XML combination through Java
    `Parameter.loadFromXML` and save it back.
  - `snap` - apply Java `LineUtils.snapToResolution(value, min, max, resolution)`
    with `parameterBdText` as resolution and the three `snap*Bits` inputs.
- Missing XML attributes are empty fields. Fixed UUIDs are used so generated
  identifiers cannot make output nondeterministic.
- `expectedParameterSaveBase64`/`expectedLineSaveBase64` are the base64 UTF-8
  of the exact `bdresolution` attribute value Java writes on save for the
  parameter and nested line elements respectively.
- `expectedActivation` is `1` when `resolution.doubleValue() > 0.0`, else `0`.
- For `expectedKind = exception`, `expectedCategory` holds the diagnostic
  category and expectation fields are empty.

## `offline.tsv`

Header:

```text
caseId  origin  category  resolutionText  pointsBits  renderStartBits
renderEndBits  instrumentId  expectedInitialBits  expectedInitializationBase64
expectedScoreBase64  expectedKind  expectedCategory
```

- Expectations come from actual Java `CSDRender.appendParameterScore(...)`
  plus its initialization path (`Line.getValue(startTime)` formatted through
  `NumberUtilities.formatDouble`), invoked by reflection on the pinned Java
  Blue artifacts.
- `expectedInitializationBase64` is the base64 UTF-8 of
  `gk_blue_auto<instrumentId> init <formatted value>\n`-shaped init statements.
- `expectedScoreBase64` is the base64 UTF-8 of the exact score fragment Java
  appends (tab-separated `i<instrId>` notes including `.0001` durations).
- `renderEndBits` uses the Java sentinel convention: a render end of `0` (or
  negative) means open-ended rendering.
- Coverage includes positive/zero/negative resolution, ascending/descending/
  flat segments, render clipping, repeated times, zero-step behavior, final
  note emission, and render-end sentinel rules.

## Consumer requirements

Every consumer MUST:

- validate the manifest schema version and section/category counts before
  testing cases;
- decode doubles from raw bits, never through decimal JSON/TSV numbers;
- compare output bits or output bytes exactly;
- print `caseId`, category, resolution, points, and time on failure;
- prove a deliberate one-bit expectation change fails;
- complete normal tests without Java, Maven, network, or an external checkout.

Vitest uses a test-only Node fixture reader in
`packages/blue-data/src/test-support/`. CMake copies the canonical TSV files
into the build tree and passes their paths to CTest; native production code
gains no fixture parser or JSON dependency.

## Reproducibility

Regeneration runs the generator from `tools/java-blue-automation-fixtures/`
through `scripts/generate-java-blue-automation-fixtures.mjs` against the
pinned Java Blue checkout. Output contains no timestamp, absolute path, JVM
vendor string, or other machine-local data, so regeneration at the pinned
commit and seed is byte-identical.
