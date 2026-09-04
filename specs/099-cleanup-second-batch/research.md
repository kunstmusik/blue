# Research: Validated Cleanup Second Batch

## Dead Maintenance Surface

**Decision**: Delete `scripts/engine-realtime-automation-benchmark.mjs`,
`packages/blue-engine-client/src/automation-errors.ts`, and `vitest.workspace.ts`. Remove the stale
workspace entry from `README.md` and the native header comment claiming that its diagnostics mirror
the deleted TypeScript module.

**Rationale**: The benchmark has no package, CI, test, or documentation consumer. The diagnostic
module has no import, barrel export, or package export path; compilation by a broad source include
does not make it a supported API. Root testing uses recursive package scripts, while the workspace
file is unreferenced and omits `blue-cli`.

**Alternatives considered**:

- Retain the benchmark as an undocumented manual tool: rejected because there is no maintained
  workflow or discoverable owner; a newly identified manual use defers its deletion.
- Export the automation diagnostics: rejected because that would create a new public contract
  rather than simplify the current one.
- Make the root workspace configuration authoritative: rejected because package scripts already
  own testing and expanding the workspace is outside this deletion batch.

## Renderer-Store Inventory

**Decision**: Remove only the following present-state zero-consumer members:

- `workbench-store.ts`: `focusPanel`, `isPanelOpen`.
- `output-store.ts`: `closeTab`, `setTabColor`; retain `colorOverrides`.
- `settings-store.ts`: `getRecentFiles`, `setEnginePath`, `setWindowBounds`,
  `setMidiInputDevice`, `setMidiOutputDevice`, `setOscInputPort`, `setOscOutputPort`, and
  `setOscOutputHost`; retain synchronized legacy state fields.
- `layer-selection-store.ts`: `isSelected`, `getSelectedVisibleLayers`,
  `getOperationAvailability`, and `getRemovalPlan`; retain `getSelectedRanges`.
- `score-automation-store.ts`: `mode`, `activeLayerId`, `activeParameterId`, `setMode`, and
  `setActiveParameter`; retain the active selection/preview state and setters. Remove
  `clearAutomationState` only after replacing its test-only teardown use.
- `ui-store.ts`: `selectedLayer`, `zoom`, `selectLayer`, and `setZoom`; retain active panel state.
- `midi-input-store.ts`: `beginDraftFromSaved`, `resetDraftToSaved`, `savedMidiInput`, and exported
  `defaultRuntimeDevices`; retain the active draft, dirty-state, snapshot, and device-editing flow.
- `library-routing.ts`: delete the zero-import module.

**Rationale**: Repository-wide caller searches distinguish public-looking store members from
actual consumers. The score-automation store, MIDI draft core, output color state, selected-range
query, and legacy settings synchronization are active and therefore protected.

**Alternatives considered**:

- Delete whole store slices named by the original audit: rejected because live overlays, settings
  UI, IPC synchronization, and selection behavior consume their retained members.
- Consolidate or redesign the stores: rejected because it adds behavior and abstraction work to a
  zero-consumer deletion batch.
- Delete adjacent output close/color state: deferred because `OutputPanel` still observes color
  overrides and the external input/output contract needs separate analysis.

## OSC Argument Processing

**Decision**: Replace only the custom option-scanning loop with `node:util.parseArgs`. Normalize
away literal `--` tokens passed by the existing pnpm command, retain `parsePort`, defaults,
command/address validation, command lookup, send behavior, help suffix, and exit semantics. Treat
standard inline values such as `--port=9000` as supported; malformed ambiguous values still fail.

**Rationale**: Repository CI and development require Node 22, while `parseArgs` has been available
since Node 16.17/18.3 and is non-experimental in supported releases. Its strict option schema
replaces the hand-written scanner without replacing Blue-specific validation. The official API
supports typed options, short aliases, strict unknown-option handling, defaults, and token details:
[Node.js `util.parseArgs`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilparseargsconfig).

**Alternatives considered**:

- Keep the custom scanner: rejected because the supported runtime already owns generic token
  parsing.
- Add a third-party CLI parser: rejected because no dependency is needed.
- Extract a reusable parser module: rejected because there is one small CLI and no second consumer.
- Preserve byte-identical native-parser error text: rejected in favor of preserving error category,
  relevant option, help output, and exit status; Node owns generic parse wording.

## Serializable Snapshot Copying

**Decision**: Replace the two renderer-local `cloneSnapshotValue` helpers in `project-store.ts` and
`project-store/bsb-interface-snapshot.ts` directly with global `structuredClone`. Do not add a
wrapper. Defer the similar `cloneBsbSnapshotValue` in shared project-editor code.

**Rationale**: The two renderer call sets operate on declared snapshot records composed of
primitives, arrays, plain records, and optional values. The supported Node/Electron/Chromium
runtimes provide the standard structured clone operation; Node has exposed it since v17:
[Node.js `structuredClone`](https://nodejs.org/docs/latest-v22.x/api/globals.html#structuredclonevalue-options).
The shared helper also touches live model properties whose serializability and prototype contract
need separate proof.

**Alternatives considered**:

- Create one shared clone wrapper: rejected because it preserves indirection without adding policy
  or compatibility value.
- Replace all similar helpers at once: rejected because the shared model call sites have a broader
  value contract.
- Add a fallback for functions, symbols, or DOM nodes: rejected because those values violate the
  snapshot boundary; native failure is preferable to silently retaining them.

## Explicit Import Guidance

**Decision**: Add the rule to the existing `AGENTS.md` Import discipline section: fixed
application-owned asset and module sets use explicit static imports. `import.meta.glob` requires an
explicit feature-specification need for automatic discovery plus deterministic membership and
naming validation. Keep the BlueX7 algorithm image table unchanged.

**Rationale**: There are currently zero `import.meta.glob` usages in application source. The rule
is stable cross-cutting contributor guidance, not a new constitutional principle. Vite documents
glob imports as build-time transformations and notes that they are Vite-specific rather than a web
standard: [Vite glob imports](https://vite.dev/guide/features.html#glob-import). Fixed sets benefit
from review-visible membership; discovery-oriented features may justify the exception.

**Alternatives considered**:

- Convert the 32 BlueX7 imports to a glob: rejected because the fixed manifest is clearer and
  already has completeness coverage.
- Add a permanent custom linter: rejected as disproportionate machinery for a zero-occurrence rule.
- Amend the constitution: rejected because stable agent guidance is sufficient and a constitution
  amendment would trigger unrelated governance synchronization.

## Protected and Deferred Scope

**Decision**: Retain `program-settings-usage.ts`, `verify-blue-x7-java-resources.mjs`,
`EffectLibraryTree`, both active/protected BlueX7 editor surfaces, `NextNoteBadge`, and
`GeneratorRegistry`. Defer dialogs, tabs, trees, sliders, drag hooks, clipboards, registries,
migrations, OSC routing, workers, IPC, typography, and release validation.

**Rationale**: Protected items either have current production/test consumers, explicit parity-spec
ownership, or direct protection in Spec 099. Broader consolidations have different behavior and
risk profiles and would weaken the reviewability of this batch.

**Alternatives considered**:

- Reopen test-only protected components for deletion: rejected because the specification explicitly
  preserves them and this plan does not override product-owner scope.
- Fold later simplification categories into this feature: rejected to keep the next pass surgical
  and independently revertible.

## Validation and Delivery

**Decision**: Validate each slice at its lowest affected boundary, then run full repository gates.
Keep dead maintenance deletion, store pruning, runtime substitutions, and guidance/closure as
distinct reviewable commits or diffs.

**Rationale**: Focused failures identify the responsible slice, while full validation protects
cross-package contracts and the first batch's established formatting/build baseline.

**Alternatives considered**:

- Run only repository-wide tests at the end: rejected because failures would be harder to localize.
- Add permanent audit infrastructure for this one-time cleanup: rejected because static deletion
  and protection probes are sufficient.
