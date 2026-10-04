# Research: Explicit XML Compatibility and Migration Contracts

**Date**: 2026-10-01  
**Feature**: [spec.md](spec.md)  
**Status**: Phase 0 decisions consolidated 2026-10-02. Concrete owner matrices are in
[project-evidence.md](project-evidence.md), [resource-evidence.md](resource-evidence.md), and
[sound-library-evidence.md](sound-library-evidence.md), with shared supplements in
[contracts/xml-loading.md](contracts/xml-loading.md) and the
[serialization inventory](serialization-inventory.md).

## Planning decisions and alternatives

- **Decision**: Existing Element-based TypeScript transforms and owner-local checks with one
  contextual diagnostic report. **Rationale**: shares exact-decimal, time and reference semantics
  across project/standalone callers. **Alternatives**: global schema registry or reflection would
  duplicate model rules; global unknown bags would bypass the acceptance policy.
- **Decision**: Keep structural migration before model construction and local compatibility at
  reusable boundaries. **Rationale**: old graph references/context moves require project state,
  while resources carry no project version. **Alternatives**: post-load repair and project-only
  class migration reproduce the historical dependency/standalone failures.
- **Decision**: Return accepted/rejected reports and retain strict throwing compatibility methods.
  **Rationale**: preserves existing callers while hosts can surface warnings before publication.
  **Alternatives**: console-only reports or model-owned diagnostic state hide outcomes or pollute
  canonical persistence. Direct warning acceptance requires an explicit diagnostic sink.
- **Decision**: Exact signed64 seed strings, typed legacy ruler metadata, complete shared tuning
  Scale and named unresolved dependencies. **Rationale**: preserve demonstrated meaningful data
  without numeric loss/default substitution. **Alternatives**: number narrowing or deletion based
  on current editor/runtime availability would silently change supported content.
- **Decision**: Retain source-span library archives; classify/promote through complete resource
  acceptance. **Rationale**: intact export remains contractual, editable insertion is separate.
  **Alternatives**: sentinel-tag checks or bulk reserialization cannot prove support/fidelity.
- **Decision**: Bound development-era TimeUnit support explicitly in the
  [common time supplement](contracts/xml-loading.md#development-era-common-soundobject-time-forms).
  **Rationale**: direct written beat/clock/audio-frame forms have lossless current mappings;
  older fractional-measure/SMPTE forms need representations/context this feature does not invent.
  **Alternatives**: Java's historical four-beat duration fallback would change content; accepting
  reader-only wrappers would falsely imply writer provenance. Known unsupported forms diagnose
  rejection or eligible archive retention instead.
- **Decision**: Do not introduce XSLT for this feature. **Rationale**: existing semantic helpers and
  host-neutral parsed trees already cover the transformations. **Alternatives and primary sources**:
  [xslt-assessment.md](xslt-assessment.md), including XSLT validation capabilities, native browser
  deprecation, JavaScript engines, compiler/runtime/distribution costs, and revisit criteria.

## Decisions

1. Load explicitly expected data into its authoritative representation. Accept historical forms
   through documented conversions. Diagnose unexpected members and invalid known values, with
   rejection by default and specific, safe warning exceptions.
2. Keep project structural upgrades before deserialization. Keep class-local aliases, value
   conversion, and resource subtree compatibility at boundaries reached by standalone loaders.
3. Give each conversion one owner and define composition, ordering, conflicting forms, and
   canonical output. A resource without a project version cannot depend on project migration.
4. Keep known runtime metadata independent of runtime availability. Replace implicit unknown-data
   acceptance only after identifying supported fields and explicit retention contracts.
5. Keep the existing unsupported library archive as a separate, diagnosed storage/export contract.
   Retaining original source does not authorize typed model editing or project insertion. Existing
   raw XML archive editing is distinct from editing an accepted model; promotion requires full
   validation of the resulting payload.
6. Validate before evidence is lost, then publish accepted candidates atomically. Saving, copying,
   or restoring accepted data must preserve significant text and independent mutable ownership.

These decisions are governed by [constitution 4.0.0](../../.specify/memory/constitution.md),
replacing the earlier blanket preservation direction in
[Spec 115's deferred note](../115-smpte-timecode/spec.md#deferred-follow-up).

## Research scope and reproducibility

The Java reference was inspected read-only at `/Users/stevenyi/work/nbprojects/blue` on `develop`,
HEAD `3ca3f40579c48a023299a68130d8ab6b9e950974` (2026-06-28). Production sources inspected had no
local modifications. Local Git history was inspected with `git log --follow` and `git show`,
including the pre-Maven source paths. No remote fetch or live BlueShare request was performed.

This snapshot is evidence of source behavior, not a declaration that every observed form shipped
in a stable release. The initial SVN import provides evidence for older writers but is not a
complete history before 2010. Planning must distinguish released artifacts, development/beta
forms, accidental reader tolerance, and explicit TypeScript support decisions. No universal
historical version range is inferred from these findings.

## Historical evidence

### Project migrations

| Evidence | Observed behavior | Ownership consequence |
| --- | --- | --- |
| [XML-only upgrades, 2012-10-13](https://github.com/kunstmusik/blue/commit/9f97c9d187ace846a422515dfdea2ed8b1b103b8) | The change removed post-deserialization upgrades; its recorded rationale was that upgrades could depend on changes needed for the expected loaded state. | Structural migrations must prepare XML before interpreting the canonical model. |
| [Current upgrade manager](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/upgrades/UpgradeManager.java) and [BlueData loader](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/BlueData.java) | Missing project version is treated as old input; applicable registered upgrades run before model loading. | Version/order rules belong to the project envelope, not standalone resource loaders. |
| [2.1.10 upgrader](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/upgrades/ProjectUpgrader_2_1_10.java) | Moves a historical global orchestra `0dbfs` setting into realtime/disk project property fields. | A change spanning code text and project properties is project-owned. Fixtures must cover the text rewrite and both destinations. |
| [2.3.0 upgrader](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/upgrades/ProjectUpgrader_2_3_0.java) | Moves old root PolyObject/tempo content into Score, derives Score TimeState from the old PolyObject, and nests beta pattern layers under their container. Both upgrade operations execute. | Project structure owns relocation; the class loader interprets TimeState values. Composition needs its own fixture. |

The historical 2.3.0 format has more than one intermediate shape. Determine which shapes are
supported and how existing/new Score containers combine before implementing acceptance rules.
Do not mistake an upgrader's boolean success result for permission to skip later work.

### Class-local compatibility

| Evidence | Observed behavior | Support decision to record |
| --- | --- | --- |
| [Historical BSB parameter writer, initial import 2010-05-09](https://github.com/kunstmusik/blue/blob/d1735b6fe22b6e0dee07d665108a50b6151e2cf9/blue-core/src/blue/orchestra/blueSynthBuilder/BSBParameterList.java) | The class writer emitted `bsbParameterList`. | This is evidence of a written historical tag; retain local compatibility independently of a project envelope. |
| [Reader correction, 2017-02-23](https://github.com/kunstmusik/blue/commit/15b54945f5bbb91084d64efc3f9445e6b39adc3f), [current BSB](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/orchestra/BlueSynthBuilder.java), and [current Effect](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/mixer/Effect.java) | Both classes read `bsbParameterList` and current `parameterList`; the 2017 change corrected BSB's uppercase `ParameterList` reader case and added Effect's current lowercase case. Current writers use `parameterList`. | Accept demonstrated old/current forms; specify conflicts. The old uppercase reader typo alone does not prove a historical writer form. |
| [Current TimeState](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/score/TimeState.java) | Handles older `pixelSecond` zoom, numeric snap values, historical snap enum spelling, old integer display modes, and defaults for omitted older fields. | Class-owned value conversion/defaults; verify rounding and malformed/conflicting-value behavior instead of copying silent fallbacks. |
| [Snap encoding change, 2026-02-08](https://github.com/kunstmusik/blue/commit/7c9268215c09c7f16ae5e6b88a79707f2edc0710) and [TimeState version consolidation, 2026-02-15](https://github.com/kunstmusik/blue/commit/58efc8cca281ed60f8a2c8fdea830f1110f29030) | Source history identifies recent TimeState format transitions, corroborated by the current loader. | Record release provenance and representative artifacts before declaring the historical fixture corpus complete. |

These are initial examples, not the entire class inventory. A local change may still need a
shared resource migrator if several loaders would otherwise duplicate the same normalization.
The defining distinction is required context and scope, not how many lines the conversion has.

### Standalone disk and BlueShare paths

At the same Java snapshot:

- [ArrangementEditPanel](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/ui/core/orchestra/ArrangementEditPanel.java)
  reads an `instrument` root through the object loader and writes the instrument's own XML.
- [UserInstrumentLibrary](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/ui/core/orchestra/UserInstrumentLibrary.java)
  uses the same standalone import/export boundary.
- [EffectsUtil](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectsUtil.java)
  writes an effect's XML directly to disk and loads an `effect` root directly through its class.
- [BlueShareRemoteCaller](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/tools/blueShare/BlueShareRemoteCaller.java)
  passes instrument XML to the object loader and effect XML directly to the effect loader.
  Neither path loads BlueData first.
- [InstrumentExportPane](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/tools/blueShare/instruments/InstrumentExportPane.java)
  and [EffectExportPane](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-ui-core/src/main/java/blue/tools/blueShare/effects/EffectExportPane.java)
  submit each resource's serialized XML.

This establishes why instrument/effect compatibility cannot live exclusively in project
upgraders. It does not establish live service availability or add a TypeScript network client.
Java's silent catches/unknown-member tolerance are behavior to assess, not the desired diagnostic
policy under constitution 4.0.0.

## Current TypeScript audit under the new policy

This is a source inspection, not execution evidence. The findings identify planning work;
changing the constitution does not itself repair the loaders.

| Area | Finding | Required disposition |
| --- | --- | --- |
| [`Element`](../../packages/blue-data/src/serialization/xml-reader.ts) | Parsing trims direct text and retains only the first nonempty text segment; serialization places stored text before children. Clone serializes/reparses, inheriting those losses. | Preserve accepted significant scalar text; detect unsupported mixed content before losing evidence. Use independent copies without destructive normalization. Lexical formatting need not become universally contractual. |
| [`BlueData XML policy`](../../packages/blue-data/src/blue-data/xml-policy.ts) | Reads known root sections with no unknown-member diagnostic branch and retains only the known root version attribute. Other owners also have known-only switches. | Inventory every owning boundary and diagnose unexpected members/attributes. Supported fields require explicit models; the solution is not a root unknown bag. |
| [`TimeState`](../../packages/blue-data/src/time/time-state.ts) | Retains unknown direct attributes/children but does not establish nested member contracts; some invalid current values fall back. | Classify retained fields under expected, historical, named retention, or unexpected rules. Specify invalid-value recovery independently. Preserve supported SMPTE fields and historical defaults. |
| [`MarkerList`](../../packages/blue-data/src/markers-list.ts) and [`BlueData`](../../packages/blue-data/src/blue-data.ts) | Marker load/save/access can reuse mutable XML; `getPluginDataXml()` exposes the backing array. Similar nested mutable payloads need inventory. | Accepted payloads need independent input/output/copy/history ownership. Classify plugin payloads explicitly, including known Clojure metadata. |
| [`2.3.0 upgrader`](../../packages/blue-data/src/migration/upgrades/upgrade-2.3.0.ts) | The boolean OR short-circuits beta-pattern normalization when the first operation succeeds. The old TimeState extraction is described as deferred to deserialization rather than performed here. | Run all applicable changes. Trace the claimed deferred behavior and prove old timing content survives; do not treat the comment as implementation evidence. |
| [`UpgradeManager`](../../packages/blue-data/src/migration/upgrade-manager.ts) | Already runs project upgrades before loading and has a separate legacy audio-layer structural pass. | Retain documented shape/version preconditions and ordering; investigate historical evidence for each existing pass. |
| [`Library payload classification`](../../packages/blue-data/src/libraries/library-payload-adapters.ts) | Recognizes outer types and checks only a small set of sentinel unknown child names. Other unexpected members/attributes can still be marked supported. | Supported promotion must use full resource acceptance, including nested fields and values. Source archiving remains a separate outcome. |
| [`Legacy library codec`](../../packages/blue-data/src/libraries/legacy-library-codec.ts) | Uses source spans for leaf payloads, while envelope/category parsing can ignore unfamiliar branches. | Define wrapper/category contracts and diagnostic behavior as well as resource contracts. Reuse existing fidelity machinery where it meets the contract. |
| App [editor adapters](../../packages/blue-app/src/main/unified-library/editor-adapters.ts) and [project adapter](../../packages/blue-app/src/main/unified-library/project-adapter.ts) | Reusable resources already reach direct model loaders. | Keep class compatibility shared across these paths; prevent unsupported insertion and publish only validated candidates. |

The existing [unified library spec](../060-unified-libraries/spec.md) explicitly requires unsupported
resource retention/export and non-insertability (FR-042–FR-046, SC-013). Its
[research](../060-unified-libraries/research.md) already identifies source spans as necessary for
exact raw leaf export. This is a named archive contract, not blanket project support. Existing raw
storage and diagnostics should be reused where sound; the supported classifier needs tightening.

Project copies and history already have canonical ownership machinery. Plan focused restoration
and alias checks at that machinery instead of introducing a second history system. An individual
copy helper passing does not prove the full commit/undo/redo path preserves accepted payloads.

## Evidence matrix and bounded support

For each in-scope project/resource root and reachable model owner, record:

- Current members/attributes/types, cardinality, value domains, defaults, significant text, and
  declared map/extension contents.
- Historical written forms with source revision and release/development provenance; explicit
  decisions for unsupported or evidence-poor forms.
- Migration owner/context, shape/version preconditions, order, conflicts, canonical result,
  repeat normalization, and composition with surrounding project/resource transformations.
- Standalone disk, library, BlueShare-shaped, and embedded applicability; resource formats must
  not inherit a project-version requirement they never serialized.
- Unexpected and malformed-value cases, error/warning severity, safe recovery/save behavior,
  archive eligibility, and user-visible source/path diagnostics.
- Fixture provenance and expected output/state; load/save, independent ownership, atomic rejection,
  runtime availability, and applicable history observations.

The companion matrices cover model families beyond the initial examples: project properties/score/time,
arrangement and instrument variants, mixer/effects, BSB widgets/parameters/presets, SoundObjects
and layer variants, UDOs/note processors, maps/plugins/runtime metadata, and library envelopes.
Existing TypeScript extension contracts are distinguished from Java historical forms.

The completed family research covers old Score/TimeState extraction and tempo paths, conflicting legacy
and current containers, TimeContext/TimeBase transitions, Effect style evolution, older polymorphic
type names and class-local aliases, declared parameter maps, and historical external artifacts.
Only documented support decisions enter acceptance; a permissive Java reader does not expand
support automatically. Evidence-poor forms have bounded explicit rejection/support decisions;
binary verification and fixture authoring remain implementation work, not unresolved policy.

## Licensing and provenance

This change adds original governance/specification/research prose and synchronizes local guidance.
No Java source, translated code, external fixtures/assets, or new dependencies are incorporated.

The inspected Java source headers grant GPL-2.0-or-later. Repository documentation is in the
GPL-3.0-or-later scope described by [LICENSING.md](../../LICENSING.md); `@blue/data` Blue-authored
source is MIT, with separately identified artifact obligations in its
[notices](../../packages/blue-data/THIRD_PARTY_NOTICES.md). Future implementations must be original
and destination-compatible; inspecting behavior does not authorize copying or translating GPL
source into MIT files. Historical fixtures/examples need their own provenance and compatibility
check before incorporation. Prefer original synthetic fixtures representing the documented
formats; retain required notices for any separately approved incorporated material.


## Implementation provenance and contract corrections (2026-10-02)

All acceptance/migration/Scala parser changes are original implementations. Data and CLI changes
remain in their existing MIT scopes; app host/UI changes remain GPL-3.0-or-later. No Java source
was copied, translated, or moved, and no dependency, bundled third-party material, or license notice
was added. Existing Java examples are read-only regression references; full unsupported projects
reject while independently supported sections are tested in fresh original models.

The host Scala reader implements the public mathematical/file-format rules from
[Scala .scl format](https://www.huygens-fokker.org/scala/scl_format.html). It is app-owned GPL code,
not incorporated Scala implementation source. Java behavior was consulted at blue-core revision
`3ca3f40579c48a023299a68130d8ab6b9e950974`; the inspected TuningProcessor/Scale file history reaches
`ecd90f7f23f10cb5e7e6b4872f05291fccad9b0a`. Existing user-config `scl/` lookup and last-interval
period behavior are retained. Resolution occurs only on detached execution candidates or a detached
insertion preflight. Missing/invalid files block the operation; canonical external references stay
saveable. Temporary native path and injected Windows-label tests run locally; native Windows
execution is unverified.

The evidence matrices record corrections for signed BlueX7 detune, finite BSB values outside edit
bounds, unsigned TypeScript ARGB bit patterns, existing FadeType enum aliases and the exact
PianoRoll empty Scale placeholder. Legacy project UDO conversion preserves body whitespace/comments
and rejects incomplete definitions and orphan text rather than silently discarding them. A current
opcodeList may coalesce only with an equal canonical legacy result. The original general-purpose
UDO text utility is unchanged.

P-210-230-COMPOSE uses the compatible root PolyObject/0dbfs/context/tempo sequence. Beta Score
pattern nesting is exercised separately because the explicit existing-Score plus root-PolyObject
conflict still rejects. No interpretation of that combined fixture authorizes merging independent
scores.
