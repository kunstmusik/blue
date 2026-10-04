# Implementation Plan: Explicit XML Compatibility and Migration Contracts

**Branch**: `codex/116-xml-compatibility-contracts` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/116-xml-compatibility-contracts/spec.md`

**Status**: Completed — all delivery phases and T001–T054 are implemented; convergence verified 2026-10-03.

## Summary

Make acceptance explicit at every existing project/resource XML owner. Preserve significant text
while parsing, validate historical input before rewriting it, run project structural migrators,
apply shared class-local normalization, and validate the complete candidate before publication.
Unexpected data and malformed known values reject by default; named warning exceptions retain
their promised semantics and surface diagnostics. Unsupported library source archiving stays
separate from editable model acceptance. Writer/copy/history paths must own independent data.

Use the installed XML parser, existing Element API, model classes and migration registry, library
transactions, and ProjectHistory. Add a small portable diagnostics/checking helper and root report
loaders, with strict compatibility wrappers for current public methods. Do not add a global schema
language, discoverable plugin system, second history implementation, XSLT processor, or new
BlueShare transport. The [XSLT assessment](xslt-assessment.md) records the requested alternative.

## Technical Context

**Language/Version**: TypeScript strict mode, repository TypeScript 5.8 dependency range;
Node >=20 for CLI; Electron 39.8.10 for the app. Use locked workspace toolchain versions.

**Primary Dependencies**: Existing `@rgrove/parse-xml` 4.2.x, Vitest 4.1.x, pnpm 12.8.1.
React/preload/Electron remain host integrations. No new package.

**Storage**: `.blue` XML; standalone instrument/effect/SoundObject/UDO/preset XML; existing library
XML envelopes and repository records. Source-span archive strings remain in the existing library
store. No diagnostics in project XML and no new database/schema migration system.

**Testing**: Existing Vitest owner suites, original synthetic fixtures with declared provenance,
app replacement/library/history suites, CLI boundary coverage, and desktop smoke scenarios.
No tests are authored or run by planning.

**Target Platform**: Portable data APIs in browser and Node; desktop macOS/Windows/Linux; Node CLI.
No dependency on DOM, native XSLT, Java availability, or network access for acceptance.

**Project Type**: Shared data library, Electron desktop app, and existing compilation CLI.

**Performance Goals**: Parse once per root, validate each owning subtree without reparsing every
child, copy trees directly, retain existing asynchronous host flow. No new timing SLO is invented.
Measure large current projects against baseline; avoid whole-project serialization per field.

**Constraints**: Constitution 4.0.0; Java-first historical evidence; significant text fidelity;
source-preserving archives; pure writers; independent XML ownership; atomic rejection;
no generic raw-data acceptance. Fixed type/asset imports remain explicit.

**Scale/Scope**: All XML owners reachable from existing project/resource roots, including nested
BSB/parameters, SoundObjects, layers, note processors, time primitives, plugins and library wrappers.
Existing TS extensions retain named contracts. Settings/dock XML, engine protocol, new transport,
and general XML authoring are excluded.

## Constitution Check

Evaluated before research against the authorized approach on 2026-10-01, and after design and
XSLT assessment on 2026-10-02. These are design gates, not production compliance/test results.

| Gate | Before research | After design | Evidence / enforcement |
| --- | --- | --- | --- |
| Portable data core | PASS | PASS | Parser/checks/migrators remain host-neutral with static imports; no files, DOM, processes or runtime initialization. |
| Java and project compatibility | PASS | PASS | Pinned writer/loader histories and bounded support decisions in family evidence; acceptance/output rules in contracts. Incidental silent Java tolerance intentionally tightened. |
| Migration scope and ordering | PASS | PASS | Project references/relocations precede model loading; reusable normalization works without project version. All applicable steps run; conflicts and composition explicit. |
| Canonical ownership and contracts | PASS | PASS | Main BlueData and existing library owners; ephemeral diagnostics/serializable reports. Archive retention does not authorize insertion. |
| Project history and undo/redo | PASS | PASS | Load migration establishes baseline. Durable insertion/editing keep history adapters/labels; copy repairs cover commit→undo→redo/runtime reconciliation. No exception. |
| Runtime and engine isolation | PASS | PASS | Inert complete candidate acceptance precedes scripts/runtime setup at host lifecycle; known metadata survives absent runtime. |
| Host-path portability | PASS | PASS | Native paths are diagnostic labels, never globally rewritten. Existing file identities/transactions retained; synthetic Windows labels covered. |
| Verification evidence | PASS | PASS | [quickstart.md](quickstart.md): primary owner tests, distinct lifecycle/transport risks, current/historical diagnostics/atomicity/ownership/history, affected builds/lint. Execution remains implementation work. |
| License compatibility/provenance | PASS | PASS | Consulted LICENSING, data MIT/notices/metadata, app GPL3 notices and CLI scope. Original code/synthetic fixtures only; Java GPL2+ source is behavioral reference, not translated/copied. No new dependency/assets. XSLT alternatives researched, not incorporated. |

Before coding, every owner must have its concrete current/historical members/values, output,
defaults, scope, source/support provenance, and fixture origin in the evidence inventory. Task
generation must not fill an evidence gap with an opaque retention workaround. Fixture authoring
and execution are subsequent work.

## Project Structure

### Documentation (this feature)

```text
specs/116-xml-compatibility-contracts/
├── spec.md
├── plan.md
├── research.md
├── project-evidence.md
├── resource-evidence.md
├── sound-library-evidence.md
├── serialization-inventory.md
├── xslt-assessment.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── xml-loading.md
│   └── migration-and-publication.md
└── checklists/requirements.md
```

`tasks.md` belongs to `$speckit-tasks`; this command stops after design.

### Source Code (repository root)

```text
packages/blue-data/src/
├── serialization/xml-reader.ts       # text, evidence, direct clone
├── serialization/xml-load.ts         # proposed small diagnostics/check helpers and root reports
├── utilities/xml.ts                  # checked primitive conversions
├── migration/                       # existing registry/project transformations
├── blue-data/xml-policy.ts           # project candidate load / pure canonical save
├── time/, automation/               # shared scalar/map/line contracts
├── instruments/, mixer/, opcodes/    # resource and nested owner contracts
├── sound-objects/, score/            # objects, layers, shared primitives
├── note-processors/, live/, midi/, plugins/
├── libraries/                       # envelopes, full classification, raw archive
└── index.ts                         # explicit public report/diagnostic exports
packages/blue-app/src/
├── main/main.ts                     # open/revert/examples report presentation
├── main/project-replacement-flow.ts # existing preparation/publication ordering
├── main/project-history*            # canonical history and restore owners
├── main/unified-library/            # editor/import/insertion/transactions
├── shared/score-object-file.ts      # direct resource reports
├── shared/unified-library.ts        # serializable report fields
├── shared/project-editor/           # resource acceptance before durable mutation
├── preload/preload.ts               # typed existing report channels
└── renderer/                        # existing import/library diagnostic surfaces
packages/blue-cli/src/cli.ts          # acceptance before runtime/output; stderr reports
```

**Structure Decision**: Extend owners in place. One shared helper module initially holds context,
errors, primitive/shape checks, and report adapters. Split only for a distinct production
responsibility; no schema compiler/generator. Rules stay next to owners; nested classes validate
themselves and share base/primitive contracts. The inventory names exact files for task generation.

## Phase 0 — Research decisions

[research.md](research.md) and family matrices establish supported current/historical forms and
bounded rejection decisions. Findings include missing 2.3.0 TimeState extraction/tempo conversion,
skipped composed upgrade, order-dependent root context, old arrangement library references,
versionless relative widget/line data, historical time units, and incomplete library validation.

Pinned sources/writers and inspected release tags establish provenance without promising every
historical version. Evidence-poor arbitrary tags/class names reject by default; supported TS
historical forms/extensions name originating contracts. Synthetic fixtures use independently
specified expected state; Java sources/fixtures are not copied. XSLT alternatives are assessed
in research, with no additional runtime selected. No product-policy clarification is pending.

The [inventory](serialization-inventory.md) assigns 143 production XML-related data files plus
host entry points to the family contracts. The common time supplement also distinguishes direct
written development forms from reader-only wrappers and explicitly rejects unsupported forms
instead of adopting Java's four-beat fallback. This bounded historical contract is ready for
task generation; fixture authoring and runtime verification remain implementation work.

## Phase 1 — Design

### 1. Parse and preserve evidence

Element concatenates scalar text/CDATA in order without trimming. Keep evidence of significant
text mixed with elements until owning validation rejects it; container formatting whitespace is
lexical. Ephemeral source/path anchors survive moves; generated nodes identify their legacy origin.
Never discard input before checking fields a migration consumes. Clone copies names/attributes/
text/children directly with independent parent links, without serialization/reparse. Existing raw
source spans remain separate for exact archive export.

### 2. Validate locally with one operation context

Owner rules enumerate attributes, scalars, containers, cardinality, discriminants, and declared
map shapes. Checked helpers handle full-token numbers/integers/booleans/enums/decimals. Exact
decimal semantics remain in existing helpers. One context carries source/path/diagnostics through
nested owners and migrations; object-reference arguments remain explicit. Known outer types do
not whitelist subtrees. UnknownInstrument/unsupported processor placeholders cannot enter
accepted projects merely because they serialize arbitrary XML.

No second comprehensive schema registry or reflection over writer properties. Named retention
still requires a concrete validated shape. Direct/throwing methods and report roots use the same
checks/conversions, with no permissive bypass option.

### 3. Keep migration ownership explicit

Historical checks precede transformations that consume data. Project changes follow the ordered
pipeline in [migration-and-publication.md](contracts/migration-and-publication.md) before typed
construction. Local aliases/versions/values normalize at classes, including standalone roots.
Canonical member/value validation then cross-owner reference/context validation follow. Results
do not depend on sibling order. Reject conflicts unless a named existing precedence permits them.

### 4. Publish accepted candidates and surface reports

Report roots return a complete validated candidate plus warnings, or rejection with diagnostics;
never a partial model. Strict compatibility methods throw XmlLoadError on errors; warnings require
a caller diagnostic sink or report API, preventing unsurfaced ordinary save-capable state. Nested
direct methods follow the same policy. Diagnostics never enter BlueData XML.

App adapters reuse candidate preparation/replacement and existing native/import/library surfaces.
Rejected input reaches neither save/replacement prompts nor on-load execution. Successful warnings
are shown before activation/insertion. CLI reports to stderr and rejects before runtime/output
writes. Library partial batches retain existing per-source transactions; rejected sources do not
partially publish their own items.

### 5. Separate archive retention and support

Library classification invokes full recursive resource acceptance. Unsupported payloads keep
original source and diagnosed status for exact export. Typed editing/insertion require fresh
acceptance, including stored rows previously marked supported by sentinel scanning. No bulk
payload rewrite or silent envelope-content deletion. Existing source hashes/revisions and draft
transaction fences guard promotion. Raw archive editing stays unsupported until validation passes.

### 6. Repair writers, copies, and history

Replace implicit unknown acceptance only after explicit owner coverage. Typed fields/validated
payloads have one authoritative owner. Writer output is independent, canonical, pure (including
version); retained-tree getters/adders clone or expose immutable typed views. Markers become typed.
History copies preserve identities; user duplication keeps identity remapping. Load migration
establishes a baseline; durable insertion/editing keep semantic labels and runtime reconciliation.

## Delivery and verification sequence

1. Freeze evidence/inventory and synthetic fixture manifest; verify every owner has a rule.
2. Repair Element text/clone/evidence and contextual diagnostics/checked scalar helpers.
3. Repair project order/reference expansion/conflicts and composed normalization before strict
   canonical project validation.
4. Integrate shared primitive and resource/object contracts; pair standalone/embedded cases.
   Classify raw stores before removing fallbacks.
5. Complete library classification, host/CLI reports and publication; retain archive exports and
   transaction scope. Revalidate persisted supported rows at use.
6. Complete pure writer/copy/history coverage, full workspace checks and smoke guide.

Partial contract coverage is not a shippable permissive mode. Extend primary owner tests rather
than replay schema cases at each layer. Host tests cover lifecycle/transport risk, history tests
durable restoration. See quickstart.md for commands/observations. No tasks/source/tests are
generated by planning.

## Complexity Tracking

No constitution violations or exceptions. No new runtime/dependency, schema language, transport,
history system, or migration backend abstraction.


## Implementation closure (2026-10-03)

The final convergence assessment checked 20 functional requirements, eight success criteria,
19 acceptance scenarios, 12 plan decisions, and all six constitution principles. No actionable
missing, partial, contradictory, or unrequested work remains. All 54 tasks are complete;
convergence left tasks.md byte-for-byte unchanged.

The implementation follows the planned portable owner checks, ordered project migrations,
standalone class compatibility, complete candidate acceptance, contextual app/CLI diagnostics,
separate library archives, pure serialization, and independent copy/history ownership. Java
behavioral evidence and original synthetic fixture provenance remain in the family matrices and
manifest; no new runtime, schema system, dependency, or incorporated Java source was introduced.

Final pnpm test and pnpm lint runs pass. Fresh focused acceptance/history suites pass as well.
[The validation guide](quickstart.md#feature-closure-2026-10-03) records actual results, the
Maven-cache retry, existing toolchain warnings, and unexecuted desktop/native Windows scenarios.
The implementation is ready for review; manual platform verification remains distinct from
this completed implementation assessment.
