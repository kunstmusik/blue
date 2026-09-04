# Simplification Compatibility Contract

## Deletion Gate

Before deleting any named file or renderer-store member:

1. Search application source, tests, package exports, package scripts, CI, dynamic access patterns,
   and current documentation.
2. Confirm that no supported consumer or intentionally manual workflow remains.
3. Delete or retarget assertions that exist only for the dead surface; preserve tests of active
   behavior.
4. If an active or ambiguous consumer appears, retain the candidate and record it as deferred
   rather than migrating that consumer.

## Approved Removal Inventory

- `scripts/engine-realtime-automation-benchmark.mjs`
- `packages/blue-engine-client/src/automation-errors.ts` and the native comment claiming a mirror
- `vitest.workspace.ts` and its current README tree entry
- `packages/blue-app/src/renderer/stores/library-routing.ts`
- `workbench-store`: `focusPanel`, `isPanelOpen`
- `output-store`: `closeTab`, `setTabColor`
- `settings-store`: `getRecentFiles`, `setEnginePath`, `setWindowBounds`, `setMidiInputDevice`,
  `setMidiOutputDevice`, `setOscInputPort`, `setOscOutputPort`, `setOscOutputHost`
- `layer-selection-store`: `isSelected`, `getSelectedVisibleLayers`, `getOperationAvailability`,
  `getRemovalPlan`
- `score-automation-store`: `mode`, `activeLayerId`, `activeParameterId`, `setMode`,
  `setActiveParameter`; `clearAutomationState` after its test-only use is removed
- `ui-store`: `selectedLayer`, `zoom`, `selectLayer`, `setZoom`
- `midi-input-store`: `beginDraftFromSaved`, `resetDraftToSaved`, `savedMidiInput`, exported
  `defaultRuntimeDevices`

## Preserved Store and Runtime Surface

- Output `colorOverrides` and all input/output behavior that observes it
- Legacy renderer settings fields consumed by synchronization
- Layer selection state and `getSelectedRanges`
- Score automation range/point selection and both preview domains
- MIDI input draft, dirty state, runtime-device updates, snapshot synchronization, and reset
- UI active-panel state
- All public `@blue/engine-client` exports, protocol commands, capabilities, diagnostics carried by
  the native protocol, client methods, and ZeroMQ behavior

## OSC Command Contract

- Value options: `--command`, `--address`, `--host`, `--port`.
- Boolean options: `--list`, `--help`, and short alias `-h`.
- A literal `--` passed by package-manager invocation is ignored as it is today.
- Help and listing exit successfully without sending.
- A normal send resolves exactly one registered command or custom slash-prefixed address and uses
  the current host/port defaults when omitted.
- Invalid selection, address, command, option, missing value, or port fails before sending, reports
  the relevant problem, includes help text, and exits unsuccessfully.
- Generic runtime-parser wording need not be byte-identical, but error category, relevant option,
  usage guidance, and exit status remain equivalent.
- Standard inline value spelling such as `--port=9000` is accepted by the runtime parser.

## Snapshot Copy Contract

- `NoteProcessorChainSnapshot`, replacement `InstrumentSnapshot`, and renderer BSB widget snapshot
  copies remain structurally equal to their inputs immediately after copying.
- Nested arrays and records do not share mutable references with their inputs.
- Only serializable snapshot values are supported; malformed non-serializable values may surface
  the native clone failure.
- No shared clone wrapper is introduced, and `cloneBsbSnapshotValue` in shared project-editor code
  is not changed by this feature.

## Explicit Import Contract

- Fixed application-owned asset and module sets use explicit static imports.
- `import.meta.glob` is prohibited by default.
- An exception requires an explicit feature-specification requirement for automatic discovery and
  deterministic validation of missing, duplicate, malformed, and unexpected members.
- `packages/blue-app/src/renderer/assets/blue-x7/algorithm-images.ts` remains an explicit 32-entry
  manifest, and its completeness test remains active.

## Named Protected Surface

- `packages/blue-app/src/main/program-settings-usage.ts`
- `scripts/verify-blue-x7-java-resources.mjs` and its test
- `EffectLibraryTree`
- BlueX7 editor surfaces and `NextNoteBadge`
- `GeneratorRegistry` and active JMask behavior
- Dialogs, tabs, tree shells, BSB sliders/drag behavior, clipboard stores, sound-object registry,
  migration infrastructure, OSC router, SQLite workers, IPC registration, typography enforcement,
  and release-workflow validation

## Rollback

Dead maintenance deletion, store pruning, runtime substitutions, and import guidance remain
independently revertible. Reverting one slice must not require restoring or redesigning another.
