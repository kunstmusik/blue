# Validation guide

**Date**: 2026-10-04
**Status**: Implemented — all 134 example projects load and survive canonical save/reopen. Manual platform verification limits remain recorded below.

## Prerequisites

Use the repository's pnpm toolchain from the root. Author original synthetic fixture cases from
the family matrices, recording source/support decision, author/origin and independent expected
state/output. Do not copy Java source, sample projects or fixture payloads without provenance and
license review. Java/network/live BlueShare access is unnecessary to execute acceptance checks.

Read [XML acceptance](contracts/xml-loading.md) and
[migration/publication](contracts/migration-and-publication.md). The manifest freezes family case IDs and records the implementing owner suites. Implementation extends the owning suites below and adds the minimum
new suite only if the public report helper's contract needs an independent owner.

## Focused commands

Run from the repository root after the corresponding implementation slice:

```sh
pnpm --filter @blue/data exec vitest run src/serialization/xml-reader.test.ts src/utilities/xml.test.ts
pnpm --filter @blue/data exec vitest run src/migration src/blue-data/xml-policy.test.ts src/time
pnpm --filter @blue/data exec vitest run src/instruments src/mixer src/automation src/opcodes
pnpm --filter @blue/data exec vitest run src/sound-objects src/score src/note-processors src/libraries
pnpm --filter @blue/app exec vitest run src/main/project-replacement-flow.test.ts src/main/project-replacement-entry-points.test.ts src/main/unified-library
pnpm --filter @blue/app exec vitest run src/main/project-history-roundtrip.test.ts
pnpm --filter blue-cli test
```

These commands exercise the implemented owner contracts and their regression cases. A reproduced bug must fail on the pre-fix owner for the
intended reason and pass after its repair. Do not run tests while editing the same owners.

## Observations and primary test ownership

| Case / primary owner | Required observable proof |
| --- | --- |
| Element/primitive suite | Leading/trailing code whitespace and all text/CDATA segments survive; significant mixed content is diagnosed before loss; direct clone/export/input mutation cannot alter canonical trees. Full-token malformed values reject. |
| Project/migration suite: P-210-230-COMPOSE | 0dbfs transfer, Score relocation, TimeState extraction, beta nesting, tempo/context conversion and nested local normalization all apply. Compare independent expected values, not upgrade return booleans; canonical second pass is stable. |
| Project root suite: P-ROOT-CONTEXT-ORDER | Before/after sibling order produces equal timing; conflicting contexts/containers/rates/references reject without partial candidate. Historical instrument category-index references preserve instrument content or report unaccounted old-library content. |
| Time/marker suite | All current and supported historical discriminants/domains; TimePosition frameNumber versus TimeDuration frameCount; exact legacy defaults and warning rules; typed marker ownership. SL-H05 direct written forms normalize, known unsupported development forms reject contextually, and non-beat input never becomes four beats. Invalid types never default to zero/BEATS. |
| Resource suites: R-H01–R-H10 | Same BSB/Effect aliases, versionless relative widgets/lines, decimal resolutions, grid omission and style defaults standalone and embedded. All applicable normalization executes; conflicts/nested scalar attributes reject. |
| Object/layer/processor suites | Every built-in kind plus JMask nested variants, field maps, tracker cells, audio timing/fades and dormant state is validated. PatternData writes are pure; PianoRoll writes one scale and copies relink field definitions. Unknown placeholders reject typed acceptance. |
| Seeds/tuning/ruler owner cases | Signed64 endpoints and >2^53 seed values retain exact digits through XML/copy/snapshot/patch/history; independently specified JavaRandom vector when seeded. Full shared Tuning Scale retains name/octave/ratios; unresolved external path stays explicit and blocked. Historical ruler interval survives save/copy/history with a surfaced warning. |
| Library codec/classification suite | Envelope/category errors reject the source; valid unsupported leaves archive exact Unicode/CDATA/whitespace source. Nested unknown members cannot gain supported status from a known outer type. Saved old supported status is revalidated at use. |
| App replacement suite | Rejection before save/draft/replacement prompts leaves active identity/path/revision/dirty/history/runtime/editor state intact. No rejected input on-load code runs. Accepted warnings are shown with source/path and consequence. |
| Library host suite | A rejected source transaction publishes zero source folders/items; multi-source imports may report partial success explicitly. Unsupported items export intact and cannot hydrate typed editors/insert. Revision/hash fences prevent stale promotion. |
| History suite | One durable edit/insertion per distinct history risk commits with semantic label, undo/redo restores canonical content/ordering/identity/references/dirty state and required runtime reconciliation. Also mutate prior output/memento to prove ownership. |
| CLI suite | Rejection reports source/path to stderr before runtime initialization/output directory/file writes; accepted warning reports and canonical compilation continue. |

Each owner matrix needs root and nested unexpected attribute/child, duplicate/conflicting forms,
and malformed-known-value observations. Extend table-driven cases at the owner instead of
replaying the entire matrix through app/CLI. Host coverage protects distinct lifecycle/report/
transport/transaction behavior. Never derive expected values with the conversion under test or
assert copied descriptor inventories/source strings. No test-only production exports or bypasses.

## Desktop smoke scenarios

1. With a dirty active project, open a synthetic project containing a nested unknown attribute.
   Expect contextual error, no replacement/save prompt, identical active work/history/runtime.
2. Open the composed historical case, inspect old timing/instruments/tempo and significant code,
   save to a new file, reopen, then commit a durable edit and undo/redo. Source file stays unchanged.
3. Import a valid library containing known historical BSB/Effect resources plus one unsupported
   leaf. Expect visible archive warning; exact archive export works, typed edit/insertion is blocked.
4. Edit an archive's raw XML into fully supported shape and validate/publish against its revision.
   Only successful whole acceptance enables typed editing/insertion.
5. Open supported Python/Clojure metadata with Java unavailable. Save/copy/history retain it;
   execution reports runtime availability separately. Rejected XML must not execute code.
6. Open historical ruler/tuning dependency cases. Diagnostics explain retained interval/path,
   unresolved execution limits and safe save behavior; no default substitution loses metadata.
7. Repeat report formatting with synthetic Windows native source paths. Paths remain unchanged;
   this feature adds no POSIX-only permission or path-normalization behavior.

## Handoff commands

```sh
pnpm --filter @blue/data test
pnpm --filter @blue/data build
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm --filter blue-cli test
pnpm test
pnpm lint
git diff --check
```

Record actual results and scoped pre-existing limitations at implementation closure. Any changed
native filesystem/embedded path behavior additionally needs native Windows coverage per AGENTS;
label-only diagnostics do not rewrite those paths. Exact-output fixture changes must identify the
intentional canonical correction (e.g. TimePosition frameNumber) instead of weakening assertions.


## Implementation observations (2026-10-02)

- Full data run: 218 files passed, one skipped; 2,503 tests passed, one skipped before the final
  legacy UDO regression. ESM/CJS builds pass.
- Full app run: 502 files passed; 5,355 tests passed, two skipped. Main/preload/renderer builds pass
  in focused implementation checks; final repository checks are recorded at closure.
- CLI build and package suite: two files/seven tests pass.
- Focused contracts verify rejected candidates before replacement prompts, library publication,
  runtime initialization and output writes. Windows source labels survive plain IPC cloning unchanged.
- History verifies exact signed-64 seed edits and accepted insertion across commit/undo/redo,
  labels, identities, dirty baselines and runtime restart requirements. Independent source/output/
  copy/marker/plugin/PianoRoll ownership checks pass.
- Legacy-only sample-rate, widget identities, unresolved Live IDs and the documented PianoRoll/
  ObjectBuilder warnings are surfaced through explicit reports. Current output is stable and pure.
- External Scala dependency preparation passes focused host tests; unresolved/malformed files block
  execution/insertion while canonical filenames remain unchanged. Host file tests use native temporary
  paths and injected Windows filenames.

No interactive desktop smoke scenario was executed in this terminal session. Lifecycle/UI contracts
are covered by the host/renderer suites; visual dialog presentation and native Windows execution are
unverified. The synthetic Windows tests check identity/diagnostic preservation, not native filesystem
behavior. Existing Vite native-loader, SQLite experimental, jsdom canvas and bundle-size warnings are
reported by the toolchain and are not acceptance test failures. Test-audit was excluded at the user's
explicit request; validation uses pnpm and Vitest.


## Final repository verification

All commands ran from the repository root with pnpm; test-audit remained excluded.

| Command | Actual outcome |
| --- | --- |
| `pnpm --filter @blue/data test` / repository rerun | Pass: final 220 files passed, one skipped; 2,575 tests passed, one skipped. |
| `pnpm --filter @blue/data build` | Pass: ESM and CJS TypeScript builds. |
| `pnpm --filter @blue/app test` / repository rerun | Full app suite: 500 files passed, two failed, 5,358 tests passed, and two skipped. The failures were timing-budget checks under parallel load; both pass when rerun alone. The focused PatternLayer ProjectHistory commit/undo/redo case passes after rebuilding `@blue/data`. |
| `pnpm --filter @blue/app build:main` | Pass. |
| `pnpm --filter @blue/app build:preload` | Pass. |
| `pnpm --filter @blue/app build:renderer` | Pass; existing bundle-size warning. |
| `pnpm --filter blue-cli test` | Pass: package build and seven tests in two files. |
| `pnpm test` | Fails only on the two timing-budget app tests listed above; all other package suites pass, including native engine's 14 CTest cases, Java helper checks, Engine Client's 47 tests, CLI, and `@blue/data`. `pnpm test:scripts` passes all 59 tests separately because the full command stopped before that step. |
| `pnpm lint` | Renderer typography audit, ESLint, and workspace lint pass. Final Prettier check fails only for unchanged `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`. `git diff --exit-code HEAD -- <that path>` confirms it matches HEAD; this baseline formatting issue was left outside the feature. |
| `git diff --check` | Pass. |

The optional `after_implement` git extension hook is enabled with no condition, but was not executed:
`$speckit-git-commit` remains available for an explicit commit request. No mandatory after-hook is
registered. All implementation tasks are checked; the desktop/native Windows limitations above
are verification scope limits, not claimed observations.


## T054 convergence verification (2026-10-02)

T054 is complete. The 17 enumerated direct owners now use checkRoot before reading content;
the finite inventory reconciliation found and fixed the same omission in SoundLayer. The explicit
owner table covers 145 acceptance entry points, including BSB instance/dispatch methods, JMask
nested owners, and APIs requiring reference maps, Live bins, field definitions, or a library.
Caller-selected TimePosition/TimeDuration roots and documented historical aliases remain accepted.
All fixture/provenance and owner-exclusion decisions are recorded in the manifest and inventory.

- Red reproduction: all 17 renamed populated inputs failed the desired rejection assertion while
  their accepted inputs and canonical reopening passed, before adding guards. The additional
  SoundLayer case reproduced the same omission during inventory reconciliation.
- Final direct-owner suite: 331 checks pass, covering accepted/canonical reopening, wrong-root
  direct/report equivalence, absent rejected candidates, untouched input trees, root-before-member
  rejection, indexed nested diagnostics, native Windows source labels, and historical aliases.
- Full data suite: 220 files pass, one skips; 2,884 tests pass, one skips. ESM/CJS builds pass.
  The T051 owner checks and T052/T053 pattern copy/reference cases remain included and passing.
- Main, preload, and renderer builds pass; renderer retains the existing bundle-size warning.
- Repository rerun: data, CLI (seven tests), engine-client (47 tests), Java checks, and native
  engine (14 CTest cases) pass. The app suite reports 500 files passing, two failing;
  5,358 tests pass, two fail, two skip. Failures are the previously documented gate-vector latency
  test in global-history-engine.integration and meter-delivery-rate test in meter-engine.integration.
  Both files pass when rerun with one worker: 19 tests. The full run includes the application
  pattern-owned history regressions, which pass.
- Repository script tests pass all 59 checks, run separately because the full command stopped
  at the app timing failures.
- An initial repository run overlapped validation builds and timed out one existing modern-live
  BlueX7 integration case at its 60-second limit. Its isolated seven-test suite passes, and the
  full data suite passes in the subsequent repository rerun.
- Repository lint passes typography, ESLint, and workspace checks; Prettier fails only on unchanged
  LiveSpaceTab.tsx. A diff against HEAD confirms that file is unchanged. Targeted ESLint and
  Prettier checks for the expanded owner table pass, and git diff --check passes.

This closure adds only original MIT-scope guards and synthetic tests, without new dependencies,
assets, copied Java source, or changed notices. Manual desktop/native Windows scenarios remain
unexecuted as described above. The optional git commit hook is available and was not executed;
no mandatory implementation hook is registered. All 54 task markers are now checked.


## Feature closure (2026-10-03)

**Superseded by the example corpus audit below.** This initial assessment did not test every
example project, so its no-remaining-work conclusion and closure claim are withdrawn.

Convergence found no remaining work after checking FR-001–FR-020, SC-001–SC-008, all 19 user-story
acceptance scenarios, 12 plan decisions, and six constitution principles. Findings by gap type
(missing/partial/contradicts/unrequested) and severity are all zero. T001–T054 are complete;
tasks.md was left byte-for-byte unchanged, with no empty convergence phase appended.

Fresh verification from the repository root:

| Check | Actual result |
| --- | --- |
| Focused data suites: direct owner roots, copies, migrations, resources, widgets, processors, parser, and project sections | 10 files, 609 tests pass. Vitest cache disabled; runner config loader. |
| Focused app suites: ProjectHistory round trips, replacement flow, and library editor adapters | Three files, 237 tests pass with one worker and cache disabled. The initial runner-loader invocation could not evaluate the app config's CommonJS __dirname; rerunning with the standard config loader passes. |
| Independent current-source probes | 120 renamed owner roots reject; 4,216 injected unknown-member cases reject; 733 padded/case-varied booleans retain canonical semantics. No gaps. Caller-named time primitives and archive-only placeholders are outside the fixed-root probe; the explicit owner suite covers contextual APIs. |
| pnpm test | Pass on retry with access to Maven/native build caches: data 220 files/2,906 tests pass, one test skips; app 502 files/5,360 tests pass, two tests skip; engine-client 47 tests; CLI seven tests; Java checks; native build-script tests and 14 CTest cases; repository scripts 59 checks. |
| pnpm lint | Pass: typography, ESLint, workspace checks, and repository Prettier. |

The first sandboxed workspace run could not acquire a lock in the Maven cache under ~/.m2 and
cancelled remaining suites; it was an incomplete run. Retrying with the required cache access
completed successfully. The previously recorded app timing failures did not recur in this final
workspace run. The pre-existing LiveSpaceTab.tsx formatting correction is present and passes
Prettier; the earlier formatting failure is superseded by the passing final lint run. Earlier
verification sections remain historical records rather than claims about the final result.

Existing Vite loader, SQLite experimental, jsdom canvas, and renderer bundle-size warnings remain
recorded toolchain observations. Interactive desktop smoke tests and native Windows filesystem
execution were not performed; synthetic Windows-label/path and automated lifecycle/history tests
do not claim that platform coverage. No code was changed during convergence or documentation
closure, and no commit was created. The subsequent corpus audit reopened the feature.

## Example project corpus audit (2026-10-03)

Checked every `.blue` file under both example directories against the current source
`readProjectXml` API, rather than a previously built package. Both directories contain 67
project files: 134 files total, representing 73 distinct byte payloads. No file was accepted.
Source hashes before and after the audit match for all files. No projects were saved to disk,
no project scripts were executed, and no Java/audio runtime was initialized.

| First error | Root examples | Bundled examples | Total rejected files |
| --- | --- | --- | --- |
| ProjectProperties `csladspaSettings` unexpected element | 43 | 43 | 86 |
| TimeState `timeUnit` unexpected element | 16 | 16 | 32 |
| PolyObject `isRoot` unexpected element | 6 | 6 | 12 |
| Project version `2.7.4_dev` or `2.7.0_dev` rejected | 2 | 2 | 4 |
| Total | 67 | 67 | 134 |

Counts use the first **error**, excluding preceding warning diagnostics. Loading can reveal
additional incompatibilities after each blocker is resolved. No canonical save/reopen result
can be claimed for this corpus because no original candidate was accepted.

The persistent regression is
`packages/blue-data/tests/integration/example-projects-load.test.ts`. It discovers both directories,
requires a nonempty inventory in each, and tests each project separately for acceptance, unchanged
source bytes, canonical reopening, and stable canonical serialization. It reads the existing
licensed examples in place; no payload was copied into test fixtures.

```sh
pnpm --filter @blue/data exec vitest run --no-cache --configLoader runner tests/integration/example-projects-load.test.ts
```

Actual result: 134 project tests fail; the two inventory checks pass. This intentionally exposes
the compatibility regression; it does not mark rejected examples as successful or skipped.
The previously passing workspace run predates this new suite and does not establish current
closure. T055 records the completed corpus regression; T056 records the remaining compatibility
work and required final validation. Interactive desktop and native Windows checks remain
unperformed. The example source files remain unchanged.

## Example corpus restoration (2026-10-04)

T056 resolved the nested compatibility cases while keeping unknown-member and invalid-value
rejection strict. Historical content now has typed owners or a bounded warning rule with explicit
save behavior; source project bytes are never rewritten during acceptance.

The final integration run passed **136/136 assertions**: all 134 projects across both example
directories plus both nonempty-inventory checks. Every project passed load, canonical save/reopen,
stable canonical serialization, and unchanged-source checks.

Validation:

- `pnpm --filter @blue/data build` — passed; refreshed the stale local distribution used by app tests.
- `pnpm --filter @blue/data test` — 3,080 passed, 1 skipped.
- `pnpm test` — passed across workspace packages and all 59 script checks. The package totals included
  3,080 data tests, 5,370 app tests, 7 CLI tests, and 14 native engine tests; 3 tests were skipped.
- `pnpm lint` — passed, including ESLint and formatting.
- `git diff --check` — passed.

The initial `pnpm test` attempt used the stale distribution and failed in app BSB tests because
`formatBlueNumber` was absent from its generated index. Rebuilding `@blue/data` resolved that issue;
the final workspace run passed. Interactive desktop and native Windows verification remains
unperformed. Example projects remained read-only throughout.

## XML owner and history-copy convergence (2026-10-04)

T057 rejects meaningful text and CDATA in the retired BSB `uniqueNameManager` helper at all tested
owners. The exact empty helper still produces its named warning and is omitted canonically;
whitespace-only formatting is allowed. The direct BSB, standalone resource, and embedded project
tests verify contextual errors, no rejected candidate, and unchanged source input.

T058 keeps Instance name and background color independent from the referenced sound object when
history copies, duplication, library relinking, and edits rebind references. Library transfer still
seeds those fields when it creates a new Instance. Tests cover Library, Score/PolyObject, Track,
Pattern, Frozen, and Live traversal paths, and a project-history commit→undo→redo round trip. The
example corpus test now checks canonical history-copy equality for all 134 projects.

Validation:

- `pnpm --filter @blue/data build` — passed.
- `pnpm --filter @blue/data test` — 221 files passed, 1 skipped; 3,089 tests passed, 1 skipped.
- `pnpm --filter @blue/app test` — 502 files passed; 5,370 tests passed, 2 skipped.
- `pnpm --filter @blue/app build:main` — passed.
- `pnpm --filter @blue/engine-client test` — 4 files and 47 tests passed.
- Native engine tests — 14/14 passed.
- `pnpm test:scripts` — 59/59 passed.
- `pnpm lint` and `git diff --check` — passed.
- Corpus integration — 136/136 checks passed, including history-copy equality and unchanged source bytes.

The root `pnpm test` command did not complete as a whole. Its initial run hit one timing-sensitive
`meter-stress` limit; that test passed when rerun alone. The serialized package run then passed the
data, engine-client, and native suites but stopped in `@blue/java-runtime`: Maven could not acquire
the cached `maven-resources-plugin:3.5.0` lock after five attempts. The Java package is unchanged by
this feature. The full app suite passed when run alone after that retry. No cache files were changed.
Interactive desktop and native Windows verification remains unperformed.
