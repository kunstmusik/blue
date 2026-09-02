# BlueX7 Tab and Runtime Presentation Contract

## Scope

This is a renderer UI contract for the BlueX7 editor used from the Orchestra panel and the
track-instrument editor/popout. It describes DOM accessibility, local state, and the existing
effective-value boundary. It adds no preload, main-process, engine, or project-file endpoint.

## Top-level tabs

The tab list exposes four tabs in fixed order:

| Key | Label | Panel contents |
|---|---|---|
| `global` | Voice & Global | Algorithm topology/selector, transpose, feedback, shared sync/PMS, operator enables, and LFO |
| `operators` | Operators | Op 1–Op 6 workstation, tuning, sensitivities, keyboard scaling, and envelope editor |
| `pitch` | Pitch Envelope | Four-stage PEG graph and numeric rate/level controls |
| `csound` | Csound | Full-height Post Code editor |

The top header containing Instrument Name, Enabled, Comment, Import SysEx, Undo, and Redo is
outside the tabpanel stack and remains visible for every active top-level tab.

## Accessibility contract

Each tab list must have `role="tablist"` and an accessible label. Each trigger must have:

- `role="tab"`
- `aria-selected="true"` only for the active tab
- `aria-controls` pointing to its panel ID
- roving `tabIndex`: `0` for the selected tab initially (and for the currently focused candidate
  after arrow movement), `-1` for other tabs

Each panel must have `role="tabpanel"`, a unique `id`, and `aria-labelledby` pointing back to
its tab. Inactive panels remain mounted for local-state preservation but are removed from
accessibility and pointer traversal with `aria-hidden`, `visibility: hidden`, and
`pointer-events: none`; only the active panel is visibly laid out.

Keyboard behavior for every horizontal BlueX7 tab list is manual activation:

- Left/Right Arrow moves the roving focus slot, wrapping at either end, without changing
  `aria-selected` or emitting a patch.
- Enter or Space activates the focused tab.
- Click activates the clicked tab.
- Tab follows the normal browser order into active panel content.

No editor-level shortcut keys are added. The nested operator tab list uses the same contract
independently; Csound has no nested tab list.

## Presentation and persistence contract

The active top-level tab, focused tab index, selected operator, and staged envelope gesture are
renderer-local state. They are not fields in `BlueX7Voice`,
`BlueX7InstrumentSnapshot`, `InstrumentPatch`, project XML, app settings, or the engine client.

Every fresh editor mount starts at Voice & Global with Op 1 selected. Hidden panels stay mounted
so the Csound editor survives a top-level switch; all presentation state is discarded on unmount.

## Effective-value request contract

The existing `BlueX7EffectiveValuesRequest` remains unchanged. `BlueX7Editor` supplies only
parameter IDs corresponding to controls in the active view:

- Voice & Global: `Common` and `LFO` catalog entries plus the six visible
  `operator.1..6.enabled` controls.
- Operators: the selected operator catalog entries plus the shared sync and shared PMS entries.
- Pitch Envelope: `Pitch Envelope` catalog entries.
- Csound: no request.

The request list is derived by semantic key from the immutable
`BLUE_X7_PARAMETER_DESCRIPTORS` catalog and then mapped to the snapshot's stable parameter IDs.
An optional host allowlist may narrow the list but may not add hidden-view IDs. The renderer
clears stale values and rejects late responses whenever the target, session, or active parameter
set generation changes. Sampling remains at the existing default 20 Hz with at most one request
in flight; activation issues a request immediately and the next scheduled sample is within
50 ms.

## Mutation and gesture contract

All value edits continue to call the existing `onInstrumentPatch` path through
`useBlueX7History`. A top-level tab action emits no patch and does not affect undo/redo. A
pending operator or PEG drag is staged locally and produces exactly one patch on an active
pointer-up/explicit commit. Deactivation, pointer-cancel, unmount, and operator sub-tab changes
cancel staged state and release capture without a partial patch.

## Compatibility contract

The feature must leave unchanged:

- all 151 automation descriptors and semantic keys;
- `BlueX7Patch` validation and snapshot patch application;
- `<blue.soundObject.editor.bluex7.BlueX7>` XML shape and unknown-data preservation;
- generated Csound/CSD text and modern module compilation;
- SysEx voice and bank import behavior;
- existing Java-compatible defaults and runtime effective-value IPC envelopes.
