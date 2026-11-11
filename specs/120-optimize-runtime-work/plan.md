# Implementation Plan: Remove repeated runtime work

**Branch**: `codex/120-optimize-runtime-work` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

## Summary

Implement the independent first wave and narrow evidence-supported follow-ups of the [audit and delivery roadmap](spec.md#audit-findings-and-delivery-roadmap):
bounded polling, single-copy structural preparation, remapped graph capture, lazy direct
fingerprints and ordered automation lookup. Promoted follow-ups share immutable native definitions, batch fixed startup values, coalesce refreshes, batch/cache SQL reads, cull horizontal Track bars and batch thumbnails. Decoder intermediates are removed without a wire change. Measure the baseline/candidate and retain
explicit gates for larger engine protocol, publication and renderer work.

## Technical Context

TypeScript strict / Node 22+ / Electron main; C++17 native engine. Existing Vitest,
CTest and Java fixtures. No added dependencies, persisted state, IPC schema or XML
changes. Target macOS arm64, Windows x64 and Linux x64. Representative scale: 1,000
clips, 32 instruments, 128 parameters, and 10,000-point curves. Goals are deterministic
work reduction plus unchanged output; product timing budgets remain those in the audit.

## Constitution Check

Checked before research and again after design; no exceptions.

- Portable data: PASS, data remains untouched; app main/renderer, native and client retain their boundaries.
- Java/serialization: PASS, Java Line behavior and exact-bit fixtures constrain lookup;
  no loader/writer, standalone root, migration or CSD format changes.
- Migration scope: N/A, no persisted schema changes.
- Ownership/contracts: PASS, main owns canonical project/history, native control thread
  owns prepared definitions, performer owns mutable cursor, bridge owns poll generation.
- History: PASS, existing semantic paths retained; targeted commit/undo/redo, grouping,
  identity, dirty state, failed preparation and live reconciliation tests required.
- Runtime isolation: PASS, protocol unchanged; no renderer/native coupling.
- Host paths: PASS, no path transformations or filesystem behavior change.
- Evidence: PASS by design, focused tests plus main build, workspace tests/lint and
  native correctness/parity checks. Record actual outcomes in quickstart/audit.
- Correctness/speed separation: PASS, counts and output assertions in ordinary tests;
  temporary opt-in diagnostic collection with retained raw results, not a new CI gate.
  Existing product budgets remain; uncontrolled desktop results are diagnostic only.
- Licensing: PASS, LICENSING.md, app metadata/notices, native MIT license/notices and
  affected headers reviewed. Original code within existing GPL app / MIT engine/client scopes;
  Java GPL source is a behavior reference only. No third-party code/assets/dependencies incorporated.

## Project Structure

Use existing main `engine-bridge`, `project-history-memento`, `project-history-graph`,
`project-history` modules and tests; native `AutomationTypes`, `AutomationStore`,
`AutomationManager` and CTest targets. Retain all façades; no general framework.

## Delivery / verification

Follow [tasks.md](tasks.md) in dependency order. Run new failure/count tests before
implementation. Record original test failures, then focused success, broader regressions
and diagnostic measurements. Baseline fixture and stage boundaries are in quickstart.
Subsequent audit steps remain conditional and must have explicit contracts if promoted.

## Complexity Tracking

None. Optional Git commit hooks are skipped. The configured branch extension script was
missing; the repository's core feature script created specs and Git created the branch.

## Follow-up gate disposition

The spec progress table is authoritative. No section-publication protocol, bulk-envelope
command, local-readback default or shared meter scheduler is introduced without its
remaining boundary evidence/contract. Same-layout readback experiment showed no consistent
local-memory benefit, so retain external compatibility and existing per-cycle freshness.
For UI changes use existing full-model gesture ownership; view culling never edits project
content. No new migration, dependency, asset or public protocol is introduced.

## Validation disposition

Implementation checks and scoped limits are recorded in quickstart.md. No constitutional
exception is requested: the policy permits recorded scoped verification limits. All
changed source passed its package correctness/type/browser/native checks. Unrelated
formatting and optional utility/fixture acceptance failures remain explicitly visible;
no claim of full release or controlled performance acceptance is made.
