# Migration and publication contract

**Date**: 2026-10-02

## Project pipeline

Each step works on independent candidate XML, validates historical input it consumes, retains
diagnostic origins, and errors on incompatible representations before removing any evidence.

| Order | Owner / precondition | Canonical result and conflicts |
| --- | --- | --- |
| 1 | Parse/structural selection | Preserve all significant text and members. Validate root/version and historical vocabularies needed to select safe steps. No runtime or active state mutation. |
| 2 | Existing version registry: 2.1.10 | Transfer historical globalOrc 0dbfs into realtime/disk properties; preserve other text. Unequal assignments/destinations reject; equal values coalesce. |
| 3 | Existing registry: 2.3.0 | Create Score, relocate root PolyObject/tempo, extract old timing into TimeState, independently normalize beta pattern containers. Existing populated competing Score/containers reject. No short-circuit after first success. |
| 4 | Shape-selected context/tempo project migrator | Root TimeContext moves to Score; old tempo Line/pairs becomes canonical map. Equal old/current coalesces, unequal rejects. Result independent of sibling order. |
| 5 | Existing legacy audio-layer structural migration | Runs after Score creation only in approved graph positions. Preserve declared deterministic IDs/merge behavior; reject foreign/unknown instrument/processor members before removal. |
| 6 | Project graph/context normalization | Resolve historical instrumentId category-index paths into independent embedded instruments; reconcile score panning/rates/PPQ under named rules. Validate references and all old/current values before precedence. Unused meaningful old library content is not dropped: reject with recovery guidance unless an explicit supported owner accounts for it. |
| 7 | Class-local load/normalization | Local aliases/versions/relative values/time forms/defaults use shared owner boundaries. Resource subtree compatibility never requires a project envelope/version. |
| 8 | Canonical model and graph checks | Fully validate members/values, references, target-kind constraints and timing context. Only then return accepted candidate/warnings. |

Registry version selection stays explicit; shape migrations do not recursively rewrite arbitrary
plugin/archive XML. Missing project version selects historical behavior, but canonical reapplication
must be stable. Migration booleans indicate whether a step changed content; they never suppress
later applicable steps. The family matrices define detailed preconditions and exact support forms.

## Standalone resource pipeline

Parse expected kind/root → validate historical owner shape → local/subtree normalization → canonical
validation → resource-local references → accepted model/report. Instrument/effect disk/library/
BlueShare-shaped payloads do not run project structural upgrades. BSB, Line, parameters, presets,
SoundObject common time and primitive conversions are shared with embedded project loading.
An unresolved declared external dependency is explicit state, not silently defaulted data.

## Project activation

Existing prepare-before-decision replacement flow owns:

1. Read source into candidate/report before save/draft/replacement decisions.
2. If rejected, show contextual diagnostics; preserve active document/path/revision/history,
   runtime/editor state and source files. Run no candidate on-load scripts.
3. If accepted, surface named warnings with recovery/save consequence, then use existing same-file,
   render safety, draft/save and transition fences.
4. Install exactly once through project lifecycle; accepted migration state is the new baseline.
   On-load execution occurs only after acceptance, at the existing host lifecycle point.

Open/recent/example/revert/noninteractive/package verification all reach the same acceptance root.
CLI rejects before runtime initialization/output creation and reports errors/warnings through
stderr. Headless acceptance needs no dialog approval.

## Resource insertion/editing

Validate full candidate and destination dependencies before preparing/committing durable mutation.
Recheck existing document/item revisions at the current history boundary. Use established semantic
history labels, identities/remapping, dirty transitions and runtime reconciliation. Rejection
creates no history entry or partial project mutation. Pure accepted save/export does not create
an edit. Library-only operations use their existing repository/draft scope, not ProjectHistory.

## Library transactions and archives

Validate envelope/category grammar before importing any source folders/items. A valid envelope
may retain unsupported leaves as diagnosed source-span archives. Supported status requires full
recursive resource acceptance; old cached status is revalidated before editing/promotion/insertion.

Manual/automatic imports retain existing **per-source** transactions. One source failure rolls
back that source; other sources may succeed with a completed/partial/failed aggregate report.
Reports identify rejected sources and archived items, not silent skips. Export validates/stages
all output through the existing journal before replacement; raw leaf strings export intact.

Raw archive editing retains unsupported status unless complete acceptance succeeds against the
current item revision/hash. No bulk payload rewrite or automatic loss of unknown wrapper content.
Malformed XML/unsupported envelope has no leaf-archive fallback.

## Composition and independent ownership

Verification includes a project requiring several structural steps and nested local conversions,
equivalent standalone/embedded resources, all conflicting forms, canonical reapplication,
significant code text, caller mutation of input/export, and copied/history mementos. Compare
independently specified supported state/output, not successful boolean flags or self-roundtrips.
